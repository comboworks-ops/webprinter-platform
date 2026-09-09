import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { mergeBrandingWithDefaults } from "@/hooks/useBrandingDraft";
import { supabase } from "@/integrations/supabase/client";
import { USE_API_TENANT_CONTEXT } from "@/lib/api/featureFlags";
import { fetchTenantContext } from "@/lib/api/tenantContext";
import { extractPublishedBranding } from "@/lib/branding/settings-persistence";
import { isLocalStorefrontContext, shopSettingsRouteScope, storefrontPinContextId } from "@/lib/storefront/tenantContext";
import { customerShopTarget, type CustomerShopTarget } from "@/lib/account/shop";

// Define the root domain for subdomain parsing
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const LOCAL_STOREFRONT_TENANT_KEY = "wp_local_storefront_tenant";
const LOCAL_STOREFRONT_TENANT_EVENT = "wp-local-storefront-tenant-changed";
const STOREFRONT_SETTINGS_CACHE_PREFIX = "wp_storefront_settings:";

type LocalStorefrontTenantPin = {
    id: string;
    name?: string | null;
    domain?: string | null;
};

type NormalizedShopSettings = ReturnType<typeof normalizeSettings>;

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
    if (typeof window === "undefined" || !tenant?.id) return;
    try {
        const previousId = readLocalStorefrontTenantPin()?.id;
        const payload: LocalStorefrontTenantPin = {
            id: tenant.id,
            name: tenant.name ?? null,
            domain: tenant.domain ?? null,
        };
        window.localStorage.setItem(LOCAL_STOREFRONT_TENANT_KEY, JSON.stringify(payload));
        if (previousId !== payload.id) window.dispatchEvent(new Event(LOCAL_STOREFRONT_TENANT_EVENT));
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
    const cached = readStorefrontSettingsCacheByKey(buildStorefrontSettingsCacheKey("tenant", tenantId));
    return cached?.id === tenantId ? cached : null;
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
        || (error?.status !== undefined && status === 0)
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
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const forceDomain = searchParams.get('force_domain');
    const forceSubdomain = searchParams.get('tenant_subdomain');
    const forceTenantId = searchParams.get('tenantId') || searchParams.get('tenant_id');
    const hostname = window.location.hostname;
    let subdomainTarget: CustomerShopTarget | null = null;
    let subdomainTargetError: unknown = null;
    if (!forceTenantId && !forceDomain && forceSubdomain !== null) {
        try {
            subdomainTarget = customerShopTarget(hostname, location.search, ROOT_DOMAIN);
        } catch (error) {
            subdomainTargetError = error;
        }
    }
    const lookupTenantId = forceTenantId || (subdomainTarget?.kind === 'id' ? subdomainTarget.value : null);
    const lookupDomain = forceDomain || (subdomainTarget?.kind === 'domain' ? subdomainTarget.value : null);
    const pathname = location.pathname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const shouldHonorLocalStorefrontPin = isLocalhost && isLocalStorefrontContext(pathname);
    const marketingDomains = [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`];
    const [localTenantPin, setLocalTenantPin] = useState(readLocalStorefrontTenantPin);
    const cachedTenantPin = shouldHonorLocalStorefrontPin ? localTenantPin : null;
    const pinContextId = storefrontPinContextId({
        honorPin: shouldHonorLocalStorefrontPin,
        pinnedTenantId: cachedTenantPin?.id,
        forceTenantId,
        forceDomain,
        forceSubdomain,
    });
    const isPreviewRoute = pathname.startsWith('/preview-shop') || pathname.startsWith('/preview-storefront');
    const isDraftPreview = searchParams.get('draft') === '1' || searchParams.get('preview_mode') === '1';
    const routeScope = shopSettingsRouteScope(pathname, isDraftPreview);

    const cachedStorefrontSettings = lookupTenantId
        ? (lookupTenantId === MASTER_TENANT_ID && isPreviewRoute && isDraftPreview
            ? null
            : readStorefrontSettingsCacheByTenantId(lookupTenantId))
        : lookupDomain
            ? readStorefrontSettingsCacheByDomain(lookupDomain)
            : forceSubdomain !== null
                ? null
            : (!isLocalhost && !marketingDomains.includes(hostname)
                ? readStorefrontSettingsCacheByDomain(hostname)
                : readStorefrontSettingsCacheByTenantId(pinContextId));

    useEffect(() => {
        const refreshPin = () => setLocalTenantPin(readLocalStorefrontTenantPin());
        const onStorage = (event: StorageEvent) => {
            if (event.key === LOCAL_STOREFRONT_TENANT_KEY || event.key === null) refreshPin();
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener(LOCAL_STOREFRONT_TENANT_EVENT, refreshPin);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(LOCAL_STOREFRONT_TENANT_EVENT, refreshPin);
        };
    }, []);

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
        queryKey: ["shop-settings", hostname, forceDomain, forceSubdomain, forceTenantId, routeScope, pinContextId, userId, brandingPublishedAt],
        placeholderData: cachedStorefrontSettings || undefined,
        queryFn: async ({ signal }) => {
            const isVercel = hostname.endsWith('.vercel.app');
            const rememberLocalTenant = (tenant: any) => {
                if (!shouldHonorLocalStorefrontPin || signal.aborted) return;
                const currentSearch = new URLSearchParams(window.location.search);
                const currentDraftPreview = currentSearch.get('draft') === '1' || currentSearch.get('preview_mode') === '1';
                // A previous query can still have observers after navigation. Its result
                // may populate its own cache, but must not replace the newly selected shop.
                if (window.location.hostname !== hostname
                    || shopSettingsRouteScope(window.location.pathname, currentDraftPreview) !== routeScope
                    || (currentSearch.get('tenantId') || currentSearch.get('tenant_id')) !== forceTenantId
                    || currentSearch.get('force_domain') !== forceDomain
                    || currentSearch.get('tenant_subdomain') !== forceSubdomain) return;
                // An automatic owner lookup also yields to a selection made while it was loading.
                if (!forceTenantId && !forceDomain && !forceSubdomain
                    && (readLocalStorefrontTenantPin()?.id || null) !== (cachedTenantPin?.id || null)) return;
                writeLocalStorefrontTenantPin(tenant);
            };
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
                if (subdomainTargetError) throw subdomainTargetError;
                // Allow overriding hostname for local testing
                // Check if we're on /local-tenant route - if so, skip localhost check
                const isLocalTenantRoute = pathname.startsWith('/local-tenant');

                // 0. Direct Tenant Lookup by ID (explicit override)
                if (lookupTenantId) {
                    if (lookupTenantId === MASTER_TENANT_ID && isPreviewRoute && isDraftPreview) {
                        // In preview, fall back to the logged-in tenant if master is requested.
                    } else {
                        const { data: tenantById, error: tenantByIdError } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('id', lookupTenantId)
                            .maybeSingle();
                        throwIfTransportError(tenantByIdError, 'tenantById');
                        if (tenantByIdError) throw tenantByIdError;

                        if (tenantById) {
                            rememberLocalTenant(tenantById);
                            return normalizeSettings(tenantById);
                        }
                        throw new Error('Den valgte shop blev ikke fundet eller er ikke tilgængelig.');
                    }
                }

                // If forcing a domain OR on /local-tenant, treat as a production tenant lookup
                // Valid tenant_subdomain values share the account flow's exact domain mapping.
                const effectiveHostname = lookupDomain || hostname;
                const isEffectiveLocalhost = !lookupDomain && !isLocalTenantRoute && (effectiveHostname === 'localhost' || effectiveHostname === '127.0.0.1');

                if (USE_API_TENANT_CONTEXT && !isEffectiveLocalhost && !marketingDomains.includes(effectiveHostname)) {
                    try {
                        const tenantContext = await fetchTenantContext({
                            mode: "storefront",
                            hostname: effectiveHostname,
                            pathname,
                            force_domain: lookupDomain || undefined,
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
                                rememberLocalTenant(tenantByContext);
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
                        rememberLocalTenant(tenantByDomain);
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
                            rememberLocalTenant(tenantBySubdomainDomain);
                            return normalizeSettings(tenantBySubdomainDomain);
                        }
                    }
                }

                if (lookupDomain && !marketingDomains.includes(lookupDomain)) {
                    throw new Error('Den valgte shops domæne blev ikke fundet eller er ikke tilgængeligt.');
                }

                // 1c. Local storefront pin: keep the chosen tenant stable across refresh/logout on localhost.
                if (pinContextId) {
                    const { data: tenantByPinnedId, error: tenantByPinnedIdError } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .eq('id', pinContextId)
                        .maybeSingle();
                    throwIfTransportError(tenantByPinnedIdError, 'tenantByPinnedId');
                    if (tenantByPinnedIdError) throw tenantByPinnedIdError;

                    if (tenantByPinnedId) {
                        return normalizeSettings(tenantByPinnedId);
                    }
                    throw new Error('Den valgte shop blev ikke fundet eller er ikke tilgængelig.');
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
                            rememberLocalTenant(realShops[0]);
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
                    const fallbackDomain = lookupDomain || (isLocalhost ? ROOT_DOMAIN : hostname);

                    // Prefer the previously cached successful tenant over the generic
                    // Webprinter/master fallback. Otherwise a transient Supabase blip
                    // while the user's tab is backgrounded causes a tenant shop (e.g.
                    // onlinetryksager.dk) to visually swap to the Webprinter master
                    // site even though the URL hasn't changed.
                    // Local previews and explicit selections fail if their own cache is missing.
                    const cachedForThisContext = lookupTenantId && !(lookupTenantId === MASTER_TENANT_ID && isPreviewRoute && isDraftPreview)
                        ? readStorefrontSettingsCacheByTenantId(lookupTenantId)
                        : lookupDomain
                            ? readStorefrontSettingsCacheByDomain(lookupDomain)
                            : (!isLocalhost && !marketingDomains.includes(hostname)
                                ? readStorefrontSettingsCacheByDomain(hostname)
                                : readStorefrontSettingsCacheByTenantId(pinContextId));

                    if (cachedForThisContext) {
                        console.warn('[useShopSettings] Supabase transport unavailable. Reusing cached tenant settings for', hostname);
                        return cachedForThisContext;
                    }

                    // A requested shop must never turn into another shop on a network failure.
                    if (isLocalhost || forceTenantId || forceDomain || forceSubdomain || pinContextId) throw error;

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

    // Every tenant inherits the shared standard unless it has selected a theme.
    // Normalize only the consumer's view; caches and hosted settings retain their source data.
    const storefrontData = useMemo(() => query.data ? {
        ...query.data,
        branding: mergeBrandingWithDefaults(query.data.branding),
    } : query.data, [query.data]);

    return { ...query, data: storefrontData };
}
