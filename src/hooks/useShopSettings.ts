import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useShopSettings() {
    return useQuery({
        queryKey: ["shop-settings"],
        queryFn: async () => {
            // 1. Check Domain (Simulated)
            const hostname = window.location.hostname;
            // If we were live, we'd check DB for domain match here.

            // 2. Dev / Preview: Check Logged In User's Tenant
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
                        tenant_name: (tenantByUser as any).name
                    };
                }
            }

            // 3. Fallback to Master
            const { data: master } = await supabase
                .from('tenants' as any)
                .select('*')
                .eq('id', '00000000-0000-0000-0000-000000000000')
                .maybeSingle();

            if (master) {
                return {
                    ...(master as any).settings,
                    tenant_name: (master as any).name
                };
            }

            return null;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
}
