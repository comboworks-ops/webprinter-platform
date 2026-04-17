import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { USE_API_TENANT_CONTEXT } from "@/lib/api/featureFlags";
import { fetchTenantContext } from "@/lib/api/tenantContext";

// Define the root domain for subdomain parsing
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const LOCAL_STOREFRONT_TENANT_KEY = "wp_local_storefront_tenant";
const STOREFRONT_SETTINGS_CACHE_PREFIX = "wp_storefront_settings:";

type LocalStorefrontTenantPin = {
    id: string;
    name?: string | null;
    domain?: string | null;
};

type NormalizedShopSettings = ReturnType<typeof normalizeSettings>;

/**
 * Helper to extract the correct branding object.
 * Handles both new format (branding.published/draft) and legacy flat format.
 */
function extractPublishedBranding(settings: any): any {
    const branding = settings?.branding;
    if (!branding) return undefined;

    // New format: branding has 'published' and/or 'draft' keys
    if (branding.published || branding.draft) {
        // Use published if available, otherwise use draft
        return branding.published || branding.draft;
    }

    // Legacy flat format: branding IS the data (has logo_url, colors, etc. directly)
    if (branding.logo_url || branding.colors || branding.fonts || branding.hero || branding.header) {
        return branding;
    }

    // Empty or unknown format
    return undefined;
}

/**
 * Normalize tenant settings to always have flat branding at the top level.
 */
function normalizeSettings(tenant: any): any {
    const settings = tenant?.settings || {};
    const publishedBranding = extractPublishedBranding(settings);

    return {
        ...settings,
        // Override branding with the flattened published version
        branding: publishedBranding,
        // Keep rawBranding for debugging if needed
        _rawBranding: settings.branding,
        tenant_name: tenant?.name,
        id: tenant?.id,
        subdomain: tenant?.subdomain,
        domain: tenant?.domain,
        is_platform_owned: tenant?.is_platform_owned ?? false
    };
}

function readLocalStorefrontTenantPin(): LocalStorefrontTenantPin | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(LOCAL_STOREFRONT_TENANT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LocalStorefrontTenantPin;
        if (!parsed?.id || typeof parsed.id !== "string") return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeLocalStorefrontTenantPin(tenant: any): void {
    if (typeof window === "undefined" || !tenant?.id || tenant.id === MASTER_TENANT_ID) return;
    try {
        const payload: LocalStorefrontTenantPin = {
            id: tenant.id,
            name: tenant.name ?? null,
            domain: tenant.domain ?? null,
        };
        window.localStorage.setItem(LOCAL_STOREFRONT_TENANT_KEY, JSON.stringify(payload));
    } catch {
        // Ignore storage errors
    }
}

function buildStorefrontSettingsCacheKey(kind: "tenant" | "domain", value: string): string {
    return `${STOREFRONT_SETTINGS_CACHE_PREFIX}${kind}:${value.toLowerCase()}`;
}

function getDomainCacheVariants(domain: string): string[] {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!normalized) return [];
    const withoutWww = normalized.replace(/^www\./, "");
    return Array.from(new Set([
        normalized,
        withoutWww,
        `www.${withoutWww}`,
    ]));
}

function readStorefrontSettingsCacheByKey(key: string): NormalizedShopSettings | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as NormalizedShopSettings;
    } catch {
        return null;
    }
}

function readStorefrontSettingsCacheByTenantId(tenantId: string | null | undefined): NormalizedShopSettings | null {
    if (!tenantId) return null;
    return readStorefrontSettingsCacheByKey(buildStorefrontSettingsCacheKey("tenant", tenantId));
}

function readStorefrontSettingsCacheByDomain(domain: string | null | undefined): NormalizedShopSettings | null {
    if (!domain) return null;
    for (const variant of getDomainCacheVariants(domain)) {
        const cached = readStorefrontSettingsCacheByKey(buildStorefrontSettingsCacheKey("domain", variant));
        if (cached) return cached;
    }
    return null;
}

function writeStorefrontSettingsCache(settings: any): void {
    if (typeof window === "undefined" || !settings?.id) return;
    const tenantName = String(settings?.tenant_name || "");
    if (tenantName.includes("(fallback)")) return;

    try {
        window.sessionStorage.setItem(
            buildStorefrontSettingsCacheKey("tenant", settings.id),
            JSON.stringify(settings),
        );

        for (const variant of getDomainCacheVariants(settings.domain || "")) {
            window.sessionStorage.setItem(
                buildStorefrontSettingsCacheKey("domain", variant),
                JSON.stringify(settings),
            );
        }
    } catch {
        // Ignore storage errors
    }
}

function isLocalStorefrontContext(pathname: string): boolean {
    if (!pathname) return true;
    const blockedPrefixes = ["/admin", "/preview", "/platform"];
    if (blockedPrefixes.some((prefix) => pathname.startsWith(prefix))) return false;
    const blockedExactPaths = new Set([
        "/priser",
        "/white-label",
        "/beregning",
        "/order-flow",
        "/online-designer",
        "/privacy-policy",
        "/handelsbetingelser",
        "/cookiepolitik",
        "/opret-shop",
    ]);
    return !blockedExactPaths.has(pathname);
}

function isTransportError(error: any): boolean {
    if (!error) return false;
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const hint = String(error?.hint || '').toLowerCase();
    const status = Number(error?.status || 0);

    return (
        message.includes('failed to fetch')
        || message.includes('networkerror')
        || message.includes('aborterror')
        || details.includes('failed to fetch')
        || details.includes('aborterror')
        || hint.includes('failed to fetch')
        || status === 0
        || status === 522
    );
}

function throwIfTransportError(error: any, context: string): void {
    if (!isTransportError(error)) return;
    const err = new Error(`Shop settings transport failure (${context})`);
    (err as any).code = 'SHOP_SETTINGS_TRANSPORT';
    throw err;
}

export function useShopSettings() {
    const searchParams = new URLSearchParams(window.location.search);
    const forceDomain = searchParams.get('force_domain');
    const forceSubdomain = searchParams.get('tenant_subdomain');
    const forceTenantId = searchParams.get('tenantId') || searchParams.get('tenant_id');
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const shouldHonorLocalStorefrontPin = isLocalhost && isLocalStorefrontContext(pathname);
    const marketingDomains = [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`];
    const cachedTenantPin = shouldHonorLocalStorefrontPin ? readLocalStorefrontTenantPin() : null;
    const cachedMasterStorefrontSettings =
        readStorefrontSettingsCacheByTenantId(MASTER_TENANT_ID)
        || readStorefrontSettingsCacheByDomain(ROOT_DOMAIN);

    const cachedStorefrontSettings = forceTenantId
        ? (
            forceTenantId === MASTER_TENANT_ID
                ? (
                    cachedMasterStorefrontSettings || {
                        branding: undefined,
                        _rawBranding: undefined,
                        tenant_name: 'Webprinter',
                        id: MASTER_TENANT_ID,
                        subdomain: 'master',
                        domain: ROOT_DOMAIN,
                        is_platform_owned: true,
                    }
                )
                : readStorefrontSettingsCacheByTenantId(forceTenantId)
        )
        : forceDomain
            ? readStorefrontSettingsCacheByDomain(forceDomain)
            : (!isLocalhost && !marketingDomains.includes(hostname)
                ? readStorefrontSettingsCacheByDomain(hostname)
                : readStorefrontSettingsCacheByTenantId(cachedTenantPin?.id));

    // Track session state to invalidate query on login/logout
    const [userId, setUserId] = useState<string | null>(null);
    const [brandingPublishedAt, setBrandingPublishedAt] = useState<string>(() => {
        if (typeof window === 'undefined') return '0';
        return window.localStorage.getItem('branding-published-at') || '0';
    });

    useEffect(() => {
        let active = true;

        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (active) setUserId(session?.user?.id || null);
            })
            .catch(() => {
                if (active) setUserId(null);
            });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    // LOCK LF-003: React to publish events so live storefront does not stay on stale branding.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === 'branding-published-at') {
                setBrandingPublishedAt(event.newValue || String(Date.now()));
            }
        };

        const onPublished = () => {
            setBrandingPublishedAt(window.localStorage.getItem('branding-published-at') || String(Date.now()));
        };

        window.addEventListener('storage', onStorage);
        window.addEventListener('branding-published', onPublished as EventListener);

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('branding-published', onPublished as EventListener);
        };
    }, []);

    const query = useQuery({
        // Include userId in query key to force refetch on login/logout
        queryKey: ["shop-settings", hostname, forceDomain, forceSubdomain, forceTenantId, userId, brandingPublishedAt],
        placeholderData: cachedStorefrontSettings || undefined,
        queryFn: async () => {
            const isVercel = hostname.endsWith('.vercel.app');
            const isPreviewRoute = window.location.pathname.startsWith('/preview-shop') || window.location.pathname.startsWith('/preview-storefront');
            const isDraftPreview = searchParams.get('draft') === '1' || searchParams.get('preview_mode') === '1';
            const localhostFallback = {
                branding: undefined,
                _rawBranding: undefined,
                tenant_name: 'Webprinter',
                id: MASTER_TENANT_ID,
                subdomain: 'master',
                domain: ROOT_DOMAIN,
                is_platform_owned: true
            };

            try {
                // Allow overriding hostname for local testing
                // Check if we're on /local-tenant route - if so, skip localhost check
                const isLocalTenantRoute = window.location.pathname.startsWith('/local-tenant');

                // 0. Direct Tenant Lookup by ID (explicit override)
                if (forceTenantId) {
                    if (forceTenantId === MASTER_TENANT_ID && isPreviewRoute && isDraftPreview) {
                        // In preview, fall back to the logged-in tenant if master is requested.
                    } else {
                        const { data: tenantById, error: tenantByIdError } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('id', forceTenantId)
                            .maybeSingle();
                        throwIfTransportError(tenantByIdError, 'tenantById');

                        if (tenantById) {
                            if (shouldHonorLocalStorefrontPin) {
                                writeLocalStorefrontTenantPin(tenantById);
                            }
                            return normalizeSettings(tenantById);
                        }
                    }
                }

                // 0. Direct Tenant Lookup by Subdomain (for local dev)
                // Usage: /local-tenant?tenant_subdomain=demo
                if (forceSubdomain) {
                    // Since subdomain column doesn't exist, we must rely on domain or assume subdomain is part of settings?
                    // For now, let's skip direct subdomain lookup against the table if column missing.
                    // Or if we fixed it, we'd use it. But based on inspection, column is missing.
                    console.warn("Subdomain lookup requested but column missing in DB.");
                }

                // If forcing a domain OR on /local-tenant, treat as a production tenant lookup
                const effectiveHostname = forceDomain || hostname;
                const isEffectiveLocalhost = !forceDomain && !isLocalTenantRoute && (effectiveHostname === 'localhost' || effectiveHostname === '127.0.0.1');

                if (USE_API_TENANT_CONTEXT && !isEffectiveLocalhost && !marketingDomains.includes(effectiveHostname)) {
                    try {
                        const tenantContext = await fetchTenantContext({
                            mode: "storefront",
                            hostname: effectiveHostname,
                            pathname,
                            force_domain: forceDomain || undefined,
                        });

                        const resolvedTenantId = tenantContext.success ? tenantContext.tenant?.id : null;
                        if (resolvedTenantId) {
                            const { data: tenantByContext, error: tenantByContextError } = await supabase
                                .from('tenants' as any)
                                .select('*')
                                .eq('id', resolvedTenantId)
                                .maybeSingle();
                            throwIfTransportError(tenantByContextError, 'tenantByContext');

                            if (tenantByContext) {
                                if (shouldHonorLocalStorefrontPin) {
                                    writeLocalStorefrontTenantPin(tenantByContext);
                                }
                                return normalizeSettings(tenantByContext);
                            }
                        }
                    } catch (tenantContextError) {
                        console.warn("[useShopSettings] tenant-context-read fallback to direct tenant lookup", tenantContextError);
                    }
                }

                // 1. Production: Try to find tenant by Domain or Subdomain
                if (!isEffectiveLocalhost && !marketingDomains.includes(effectiveHostname)) {

                    // A. Custom Domain Match (e.g. tryk.dk)
                    // Normalize: Check both with and without 'www.' prefix to handle user input variations
                    const normalizedHost = effectiveHostname.replace(/^www\./, '');
                    const possibleDomains = [effectiveHostname, normalizedHost, `www.${normalizedHost}`];

                    // Use 'in' operator equivalent for Supabase
                    const { data: tenantByDomain, error: tenantByDomainError } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .in('domain', possibleDomains)
                        .maybeSingle();
                    throwIfTransportError(tenantByDomainError, 'tenantByDomain');

                    if (tenantByDomain) {
                        if (shouldHonorLocalStorefrontPin) {
                            writeLocalStorefrontTenantPin(tenantByDomain);
                        }
                        return normalizeSettings(tenantByDomain);
                    }

                    // B. Subdomain Match (e.g. shop1.webprinter.dk or shop1.webprinter-platform.vercel.app)
                    let subdomain: string | null = null;

                    if (effectiveHostname.endsWith(ROOT_DOMAIN)) {
                        subdomain = effectiveHostname.replace(`.${ROOT_DOMAIN}`, '');
                    } else if (isVercel && effectiveHostname !== "webprinter-platform.vercel.app") {
                        // Handle Vercel preview subdomains: tenant.webprinter-platform.vercel.app
                        subdomain = effectiveHostname.replace('.webprinter-platform.vercel.app', '');
                    }

                    if (subdomain && subdomain !== 'www' && subdomain !== '') {
                        // Try to find by domain constructed from subdomain
                        const constructedDomain = `${subdomain}.${ROOT_DOMAIN}`;
                        const { data: tenantBySubdomainDomain, error: tenantBySubdomainError } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('domain', constructedDomain)
                            .maybeSingle();
                        throwIfTransportError(tenantBySubdomainError, 'tenantByConstructedSubdomain');

                        if (tenantBySubdomainDomain) {
                            if (shouldHonorLocalStorefrontPin) {
                                writeLocalStorefrontTenantPin(tenantBySubdomainDomain);
                            }
                            return normalizeSettings(tenantBySubdomainDomain);
                        }
                    }
                }

                // 1c. Local storefront pin: keep the chosen tenant stable across refresh/logout on localhost.
                if (shouldHonorLocalStorefrontPin) {
                    const pinnedTenant = readLocalStorefrontTenantPin();
                    if (pinnedTenant?.id) {
                        const { data: tenantByPinnedId, error: tenantByPinnedIdError } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('id', pinnedTenant.id)
                            .maybeSingle();
                        throwIfTransportError(tenantByPinnedIdError, 'tenantByPinnedId');

                        if (tenantByPinnedId) {
                            return normalizeSettings(tenantByPinnedId);
                        }
                    }
                }

                // 2. Dev / Preview: Check Logged In User's Tenant
                // This allows you to see YOUR shop when logged into localhost or the master domain
                // Use the userId from state to ensure we have the latest session
                if (userId) {
                    // 2a. Check for Master Admin Role first
                    // FIX: Commented out to prevent Master Admins (who also own shops like Salgsmapper)
                    // from being forced into the Master Tenant context on localhost.
                    /*
                    const { data: roles } = await supabase
                        .from('user_roles' as any)
                        .select('role')
                        .eq('user_id', userId)
                        .eq('role', 'master_admin');

                    if (roles && roles.length > 0) {
                        const { data: master } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('id', MASTER_TENANT_ID)
                            .maybeSingle();

                        if (master) {
                            const normalized = normalizeSettings(master);
                            // Explicitly set subdomain to master to match other master logic
                            return { ...normalized, subdomain: 'master' };
                        }
                    }
                    */

                    // 2b. If not master admin, show owned tenant
                    const { data: tenantsByUser, error: tenantsByUserError } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .eq('owner_id', userId);
                    throwIfTransportError(tenantsByUserError, 'tenantsByUser');

                    if (tenantsByUser && (tenantsByUser as any[]).length > 0) {
                        const list = tenantsByUser as any[];

                        // Fix: Filter OUT Master Tenant from automatic selection (Localhost/Dev).
                        // This ensures we default to the user's actual shop (e.g. "Online Tryksager")
                        // instead of the Platform/Master tenant.
                        // NOTE: We allow is_platform_owned tenants (like Salgsmapper) as long as they are not the Master ID.
                        const realShops = list.filter(t => t.id !== MASTER_TENANT_ID);

                        console.log("[useShopSettings] Found owned tenants:", list.map(t => ({ id: t.id, name: t.name, is_platform_owned: t.is_platform_owned })));
                        console.log("[useShopSettings] Filtered real shops (Fix Applied):", realShops.map(t => t.name));

                        if (realShops.length > 0) {
                            if (shouldHonorLocalStorefrontPin) {
                                writeLocalStorefrontTenantPin(realShops[0]);
                            }
                            return normalizeSettings(realShops[0]);
                        }

                        // Fallback: If they ONLY own Master (weird, but possible), show master.
                        return normalizeSettings(list[0]);
                    }
                }

                // 3. Fallback to Master (Default Content)
                const { data: master, error: masterError } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .eq('id', '00000000-0000-0000-0000-000000000000') // Master ID
                    .maybeSingle();
                throwIfTransportError(masterError, 'masterFallback');

                if (master) {
                    // For master, override subdomain with 'master'
                    const normalized = normalizeSettings(master);
                    return { ...normalized, subdomain: 'master' };
                }

                return null;
            } catch (error) {
                if ((error as any)?.code === 'SHOP_SETTINGS_TRANSPORT') {
                    const fallbackDomain = forceDomain || (isLocalhost ? ROOT_DOMAIN : hostname);

                    // Prefer the previously cached successful tenant over the generic
                    // Webprinter/master fallback. Otherwise a transient Supabase blip
                    // while the user's tab is backgrounded causes a tenant shop (e.g.
                    // onlinetryksager.dk) to visually swap to the Webprinter master
                    // site even though the URL hasn't changed.
                    // Only return the master fallback if we truly have nothing cached.
                    const cachedForThisContext = forceTenantId
                        ? readStorefrontSettingsCacheByTenantId(forceTenantId)
                        : forceDomain
                            ? readStorefrontSettingsCacheByDomain(forceDomain)
                            : (!isLocalhost && !marketingDomains.includes(hostname)
                                ? readStorefrontSettingsCacheByDomain(hostname)
                                : null);

                    if (cachedForThisContext) {
                        console.warn('[useShopSettings] Supabase transport unavailable. Reusing cached tenant settings for', hostname);
                        return cachedForThisContext;
                    }

                    console.warn('[useShopSettings] Supabase transport unavailable and no tenant cache. Using fallback tenant context.');
                    return {
                        ...localhostFallback,
                        tenant_name: isLocalhost ? 'Webprinter' : 'Webprinter (fallback)',
                        domain: fallbackDomain,
                    };
                }
                throw error;
            }
        },
        staleTime: 1000 * 30, // Keep storefront data fresh after branding publishes
        retry: (failureCount, error) => {
            if ((error as any)?.code === 'SHOP_SETTINGS_TRANSPORT') return false;
            return failureCount < 1;
        },
        retryOnMount: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });

    useEffect(() => {
        if (!query.data) return;
        writeStorefrontSettingsCache(query.data);
    }, [query.data]);

    return query;
}
