import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Define the root domain for subdomain parsing
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

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

export function useShopSettings() {
    const searchParams = new URLSearchParams(window.location.search);
    const forceDomain = searchParams.get('force_domain');
    const forceSubdomain = searchParams.get('tenant_subdomain');
    const forceTenantId = searchParams.get('tenantId') || searchParams.get('tenant_id');
    const hostname = window.location.hostname;

    // Track session state to invalidate query on login/logout
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id || null);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return useQuery({
        // Include userId in query key to force refetch on login/logout
        queryKey: ["shop-settings", hostname, forceDomain, forceSubdomain, forceTenantId, userId],
        queryFn: async () => {
            const isVercel = hostname.endsWith('.vercel.app');
            const marketingDomains = [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`];
            const isPreviewRoute = window.location.pathname.startsWith('/preview-shop') || window.location.pathname.startsWith('/preview-storefront');
            const isDraftPreview = searchParams.get('draft') === '1' || searchParams.get('preview_mode') === '1';

            // Allow overriding hostname for local testing
            // Check if we're on /local-tenant route - if so, skip localhost check
            const isLocalTenantRoute = window.location.pathname.startsWith('/local-tenant');

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

            // 1. Production: Try to find tenant by Domain or Subdomain
            if (!isEffectiveLocalhost && !marketingDomains.includes(effectiveHostname)) {

                // A. Custom Domain Match (e.g. tryk.dk)
                // Normalize: Check both with and without 'www.' prefix to handle user input variations
                const normalizedHost = effectiveHostname.replace(/^www\./, '');
                const possibleDomains = [effectiveHostname, normalizedHost, `www.${normalizedHost}`];

                // Use 'in' operator equivalent for Supabase
                const { data: tenantByDomain } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .in('domain', possibleDomains)
                    .maybeSingle();

                if (tenantByDomain) {
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
                    const { data: tenantByDomain } = await supabase
                        .from('tenants' as any)
                        .select('*')
                        .eq('domain', constructedDomain)
                        .maybeSingle();

                    if (tenantByDomain) {
                        return normalizeSettings(tenantByDomain);
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
                const { data: tenantsByUser } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .eq('owner_id', userId);

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
                        return normalizeSettings(realShops[0]);
                    }

                    // Fallback: If they ONLY own Master (weird, but possible), show master.
                    return normalizeSettings(list[0]);
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
                const normalized = normalizeSettings(master);
                return { ...normalized, subdomain: 'master' };
            }

            return null;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        retry: 1
    });
}

