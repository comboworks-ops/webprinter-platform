import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BrandingEditorV2 } from "@/components/admin/BrandingEditorV2";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import {
    createTenantAdapter,
    TENANT_CAPABILITIES,
} from "@/lib/branding";

export function TenantBrandingSettingsV2() {
    const [tenant, setTenant] = useState<{ id: string; tenant_name: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        let active = true;

        const loadTenant = async () => {
            try {
                const { tenantId } = await resolveAdminTenant();
                if (!tenantId) {
                    if (active) setTenant(null);
                    return;
                }

                const { data, error } = await (supabase.from("tenants") as any)
                    .select("id, name")
                    .eq("id", tenantId)
                    .maybeSingle();

                if (error) throw error;

                if (!active) return;

                if (data?.id) {
                    setTenant({
                        id: data.id,
                        tenant_name: data.name || "Min Shop",
                    });
                } else {
                    setTenant(null);
                }
            } catch (error) {
                console.error("[TenantBrandingSettingsV2] Failed to resolve tenant context:", error);
                if (active) setTenant(null);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        void loadTenant();

        return () => {
            active = false;
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!tenant?.id) {
        return (
            <div className="text-center p-8">
                <p className="text-muted-foreground">
                    Kunne ikke finde din shop. Prøv at logge ind igen.
                </p>
            </div>
        );
    }

    const adapter = createTenantAdapter(tenant.id, tenant.tenant_name || 'Min Shop');

    return (
        <section>
        <header className="mb-6"><h1>Branding</h1><p className="mt-2 text-muted-foreground">Tilpas udseendet af {tenant.tenant_name}.</p></header>
        <BrandingEditorV2
            adapter={adapter}
            capabilities={TENANT_CAPABILITIES}
        />
        </section>
    );
}

export default TenantBrandingSettingsV2;
