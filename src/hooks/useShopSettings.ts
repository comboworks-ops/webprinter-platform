import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Define the root domain for subdomain parsing
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";

export function useShopSettings() {
    return useQuery({
        queryKey: ["shop-settings"],
        queryFn: async () => {
            const hostname = window.location.hostname;
            const isVercel = hostname.endsWith('.vercel.app');
            const marketingDomains = [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`];

            // Allow overriding hostname for local testing
            const searchParams = new URLSearchParams(window.location.search);
            const forceDomain = searchParams.get('force_domain');
            const forceSubdomain = searchParams.get('tenant_subdomain');

            // Check if we're on /local-tenant route - if so, skip localhost check
            const isLocalTenantRoute = window.location.pathname.startsWith('/local-tenant');

            // 0. Direct Tenant Lookup by Subdomain (for local dev)
            // Usage: /local-tenant?tenant_subdomain=demo
            if (forceSubdomain) {
                const { data: tenantBySub } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .eq('subdomain', forceSubdomain)
                    .maybeSingle();

                if (tenantBySub) {
                    return {
                        ...(tenantBySub as any).settings,
                        tenant_name: (tenantBySub as any).name,
                        id: (tenantBySub as any).id,
                        subdomain: (tenantBySub as any).subdomain
                    };
                }
            }

            // If forcing a domain OR on /local-tenant, treat as a production tenant lookup
            const effectiveHostname = forceDomain || hostname;
            const isEffectiveLocalhost = !forceDomain && !isLocalTenantRoute && (effectiveHostname === 'localhost' || effectiveHostname === '127.0.0.1');

            // 1. Production: Try to find tenant by Domain or Subdomain
            if (!isEffectiveLocalhost && !isVercel && !marketingDomains.includes(effectiveHostname)) {

                // A. Custom Domain Match (e.g. tryk.dk)
                const { data: tenantByDomain } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .eq('domain', effectiveHostname)
                    .maybeSingle();

                if (tenantByDomain) {
                    return {
                        ...(tenantByDomain as any).settings,
                        tenant_name: (tenantByDomain as any).name,
                        id: (tenantByDomain as any).id,
                        subdomain: (tenantByDomain as any).subdomain
                    };
                }

                // B. Subdomain Match (e.g. shop1.webprinter.dk)
                if (effectiveHostname.endsWith(ROOT_DOMAIN)) {
                    const subdomain = effectiveHostname.replace(`.${ROOT_DOMAIN}`, '');
                    if (subdomain !== 'www' && subdomain !== '') {
                        const { data: tenantBySub } = await supabase
                            .from('tenants' as any)
                            .select('*')
                            .eq('subdomain', subdomain)
                            .maybeSingle();

                        if (tenantBySub) {
                            return {
                                ...(tenantBySub as any).settings,
                                tenant_name: (tenantBySub as any).name,
                                id: (tenantBySub as any).id,
                                subdomain: (tenantBySub as any).subdomain
                            };
                        }
                    }
                }
            }

            // 2. Dev / Preview: Check Logged In User's Tenant
            // This allows you to see YOUR shop when logged into localhost or the master domain
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: tenantByUser } = await supabase
                    .from('tenants' as any)
                    .select('*')
                    .eq('owner_id', user.id)
                    .maybeSingle();

                if (tenantByUser) {
                    return {
                        ...(tenantByUser as any).settings,
                        tenant_name: (tenantByUser as any).name,
                        id: (tenantByUser as any).id,
                        subdomain: (tenantByUser as any).subdomain
                    };
                }
            }

            // 3. Fallback to Master (Default Content)
            const { data: master } = await supabase
                .from('tenants' as any)
                .select('*')
                .eq('id', '00000000-0000-0000-0000-000000000000') // Master ID
                .maybeSingle();

            if (master) {
                return {
                    ...(master as any).settings,
                    tenant_name: (master as any).name,
                    id: (master as any).id,
                    subdomain: 'master'
                };
            }

            return null;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        retry: 1
    });
}
