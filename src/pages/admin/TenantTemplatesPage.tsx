import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TemplatesManager from "@/components/admin/TemplatesManager";

export function TenantTemplatesPage() {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTenantId() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data: tenant } = await supabase
                .from("tenants" as any)
                .select("id")
                .eq("owner_id", user.id)
                .maybeSingle();

            if (tenant) {
                setTenantId((tenant as any).id);
            }
            setLoading(false);
        }

        fetchTenantId();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    if (!tenantId) {
        return (
            <div className="text-center p-12 text-muted-foreground">
                <p>Kunne ikke finde din butik.</p>
            </div>
        );
    }

    return <TemplatesManager scopeType="TENANT" tenantId={tenantId} />;
}

export default TenantTemplatesPage;
