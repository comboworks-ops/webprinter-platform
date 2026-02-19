import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyActiveSiteThemeToBranding } from "@/lib/sites/activeSiteBranding";
import { resolveAdminTenant } from "@/lib/adminTenant";

// Define the root domain for subdomain parsing
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const ACTIVE_TENANT_STORAGE_KEY = "wp_active_tenant_id";

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
function normalizeSettings(tenant: any, forceSiteId?: string | null): any {
    const settings = tenant?.settings || {};
    const publishedBranding = extractPublishedBranding(settings);
    const shouldApplySiteTheme =
        (!!forceSiteId && typeof forceSiteId === 'string') ||
        tenant?.id === MASTER_TENANT_ID;
    const siteAwareBranding = shouldApplySiteTheme
        ? applyActiveSiteThemeToBranding(
            publishedBranding,
            settings,
            forceSiteId
        )
        : publishedBranding;

    return {
        ...settings,
        // Override branding with the flattened published version
        branding: siteAwareBranding,
        // Keep rawBranding for debugging if needed
        _rawBranding: settings.branding,
        tenant_name: tenant?.name,
        id: tenant?.id,
        subdomain: settings?.subdomain,
        domain: tenant?.domain,
        is_platform_owned: tenant?.is_platform_owned ?? false
    };
}

function normalizeDomainLike(value: string | null | undefined): string {
    if (!value || typeof value !== "string") return "";

    return value
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/[/?#].*$/, "")
        .replace(/:\d+$/, "")
        .replace(/\.$/, "");
}

function canonicalDomain(value: string | null | undefined): string {
    return normalizeDomainLike(value).replace(/^www\./, "");
}

function rememberTenantId(tenantId?: string | null) {
    if (!tenantId || typeof window === "undefined") return;
    try {
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
    } catch {
        // Ignore storage write failures.
    }
}

function readRememberedTenantId(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
    } catch {
        return null;
    }
}

function normalizeAndRememberTenant(tenant: any, forceSiteId?: string | null) {
    const normalized = normalizeSettings(tenant, forceSiteId);
    rememberTenantId(normalized?.id || tenant?.id || null);
    return normalized;
}

async function findTenantByHostname(hostnameInput: string): Promise<any | null> {
    const normalizedHost = normalizeDomainLike(hostnameInput);
    if (!normalizedHost) return null;

    const canonicalHost = canonicalDomain(normalizedHost);
    const candidateDomains = Array.from(
        new Set(
            [normalizedHost, canonicalHost, `www.${canonicalHost}`].filter(
                (value) => Boolean(value)
            )
        )
    );

    const { data: exactMatch } = await supabase
        .from("tenants" as any)
        .select("*")
        .in("domain", candidateDomains)
        .maybeSingle();

    if (exactMatch) return exactMatch;

    const { data: tenantDomains } = await supabase
        .from("tenants" as any)
        .select("*")
        .not("domain", "is", null);

    if (!tenantDomains) return null;

    return (
        (tenantDomains as any[]).find(
            (tenant) => canonicalDomain(tenant?.domain) === canonicalHost
        ) || null
    );
}

export function useShopSettings() {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const forceDomain = searchParams.get('force_domain');
    const forceSubdomain = searchParams.get('tenant_subdomain');
    const forceTenantId = searchParams.get('tenantId') || searchParams.get('tenant_id');
    const forceSiteId = searchParams.get('siteId') || searchParams.get('site_id');
    const hostname = window.location.hostname;
    const routeContext = pathname.startsWith('/admin')
        ? 'admin'
        : pathname.startsWith('/preview-shop') || pathname.startsWith('/preview-storefront')
            ? 'preview'
            : 'shop';

    // Track auth state - distinguish between "not checked yet" and "checked, no user"
    const [authState, setAuthState] = useState<{ checked: boolean; userId: string | null }>({
        checked: false,
        userId: null
    });

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setAuthState({ checked: true, userId: session?.user?.id || null });
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthState({ checked: true, userId: session?.user?.id || null });
        });

        return () => subscription.unsubscribe();
    }, []);

    return useQuery({
        // Only include userId in query key AFTER auth is checked to prevent key thrashing
        queryKey: [
            "shop-settings",
            hostname,
            routeContext,
            forceDomain,
            forceSubdomain,
            forceTenantId,
            forceSiteId,
            authState.checked ? authState.userId : null
        ],
        // Don't run query until auth state is determined
        enabled: authState.checked,
        queryFn: async () => {
            const isVercel = hostname.endsWith('.vercel.app');
            const marketingDomains = [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`];
            const currentPath = window.location.pathname;
            const isPreviewRoute = currentPath.startsWith('/preview-shop') || currentPath.startsWith('/preview-storefront');
            const isAdminRoute = currentPath.startsWith('/admin');
            const isDraftPreview = searchParams.get('draft') === '1' || searchParams.get('preview_mode') === '1';

            // Allow overriding hostname for local testing
            // Check if we're on /local-tenant route - if so, skip localhost check
            const isLocalTenantRoute = currentPath.startsWith('/local-tenant');

            // 0. Direct Tenant Lookup by ID (explicit override)
            if (forceTenantId) {
                if (forceTenantId === MASTER_TENANT_ID && isPreviewRoute && isDraftPreview) {
                    // In preview, fall back to the logged-in tenant if master is requested.
                } else {
                    const { data: tenantById } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .eq('id', forceTenantId)
                        .maybeSingle();

                    if (tenantById) {
                        return normalizeAndRememberTenant(tenantById, forceSiteId);
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
            const effectiveHostname = normalizeDomainLike(forceDomain || hostname);
            const isEffectiveLocalhost =
                !forceDomain &&
                !isLocalTenantRoute &&
                (effectiveHostname === 'localhost' || effectiveHostname === '127.0.0.1');

            // 1. Production: Try to find tenant by Domain or Subdomain
            if (!isEffectiveLocalhost && !marketingDomains.includes(effectiveHostname)) {
                const tenantByHostname = await findTenantByHostname(effectiveHostname);
                if (tenantByHostname) {
                    return normalizeAndRememberTenant(tenantByHostname, forceSiteId);
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
                    const { data: tenantByDomain } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .eq('domain', constructedDomain)
                        .maybeSingle();

                    if (tenantByDomain) {
                        return normalizeAndRememberTenant(tenantByDomain, forceSiteId);
                    }
                }
            }

            // 2. Dev / Preview: Check Logged In User's Tenant
            // This allows you to see YOUR shop when logged into localhost or the master domain
            // Use the userId from state to ensure we have the latest session
            if (authState.userId) {
                // 2a. In admin routes, prefer the same tenant resolution used by admin modules.
                if (isAdminRoute) {
                    const { tenantId: adminTenantId } = await resolveAdminTenant();

                    if (adminTenantId) {
                        const { data: adminTenant } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('id', adminTenantId)
                            .maybeSingle();

                        if (adminTenant) {
                            return normalizeAndRememberTenant(adminTenant, forceSiteId);
                        }
                    }
                }

                // 2b. Prefer role-bound tenant IDs for deterministic context in multi-tenant accounts.
                const { data: roleRows } = await supabase
                    .from('user_roles' as any)
                    .select('tenant_id')
                    .eq('user_id', authState.userId)
                    .not('tenant_id', 'is', null);

                const roleTenantRows = (roleRows || []) as Array<{ tenant_id: string | null }>;
                const preferredRoleTenantId =
                    roleTenantRows.find((row) => row.tenant_id && row.tenant_id !== MASTER_TENANT_ID)?.tenant_id ||
                    roleTenantRows[0]?.tenant_id ||
                    null;

                if (preferredRoleTenantId) {
                    const { data: roleTenant } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .eq('id', preferredRoleTenantId)
                        .maybeSingle();

                    if (roleTenant) {
                        return normalizeAndRememberTenant(roleTenant, forceSiteId);
                    }
                }

                // 2c. Otherwise use owned tenant list.
                const { data: tenantsByUser } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .eq('owner_id', authState.userId)
                    .order('created_at', { ascending: true });

                if (tenantsByUser && (tenantsByUser as any[]).length > 0) {
                    const list = tenantsByUser as any[];

                    // Fix: Filter OUT Master Tenant from automatic selection (Localhost/Dev).
                    // This ensures we default to the user's actual shop (e.g. "Online Tryksager")
                    // instead of the Platform/Master tenant.
                    // NOTE: We allow is_platform_owned tenants (like Salgsmapper) as long as they are not the Master ID.
                    const realShops = list.filter(t => t.id !== MASTER_TENANT_ID);
                    const rememberedTenantId = readRememberedTenantId();
                    const rememberedTenant =
                        realShops.find((tenant) => tenant.id === rememberedTenantId) ||
                        list.find((tenant) => tenant.id === rememberedTenantId) ||
                        null;

                    if (rememberedTenant) {
                        return normalizeAndRememberTenant(rememberedTenant, forceSiteId);
                    }

                    if (realShops.length > 0) {
                        return normalizeAndRememberTenant(realShops[0], forceSiteId);
                    }

                    // Fallback: If they ONLY own Master (weird, but possible), show master.
                    return normalizeAndRememberTenant(list[0], forceSiteId);
                }
            }

            // 3. Fallback to Master (Default Content)
            const { data: master } = await supabase
                .from('tenants' as any)
                .select('*')
                .eq('id', '00000000-0000-0000-0000-000000000000') // Master ID
                .maybeSingle();

            if (master) {
                // For master, override subdomain with 'master'
                const normalized = normalizeSettings(master, forceSiteId);
                rememberTenantId(master.id);
                return { ...normalized, subdomain: 'master' };
            }

            return null;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        retry: 1
    });
}
