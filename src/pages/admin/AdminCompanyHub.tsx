import { resolveAdminTenant } from "@/lib/adminTenant";
import { AdminCompanyHubManager } from "@/components/companyhub/AdminCompanyHubManager";
import { AdminCompanyWorkspace } from "@/components/companyhub/v2/AdminCompanyWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { detectCompanyHubV2 } from "@/lib/company-hub";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function AdminCompanyHub() {
    const { data: tenantData, isLoading } = useQuery({
        queryKey: ["admin_tenant"],
        queryFn: resolveAdminTenant
    });
    const capabilityQuery = useQuery({
        queryKey: ["company-hub-v2", "admin-capability", tenantData?.tenantId],
        queryFn: () => detectCompanyHubV2(supabase as any),
        enabled: Boolean(tenantData?.tenantId),
        staleTime: 5 * 60_000,
        retry: 1,
    });

    if (isLoading || (tenantData?.tenantId && capabilityQuery.isLoading)) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Henter butiks-data...</span>
            </div>
        );
    }

    if (!tenantData?.tenantId) {
        return (
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Kunne ikke identificere din shop (Tenant ID mangler).</p>
            </div>
        );
    }

    if (capabilityQuery.data?.status === "available") {
        return <AdminCompanyWorkspace tenantId={tenantData.tenantId} />;
    }

    return (
        <div className="space-y-6">
            {capabilityQuery.data?.status === "error" && (
                <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950" role="status">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-medium">Den nye firmahub kunne ikke kontrolleres</p>
                        <p className="mt-1 text-xs">Den eksisterende administration vises, så arbejdet kan fortsætte.</p>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Firmahub</h1>
                <p className="text-muted-foreground">
                    Administrer firmakonti, medlemmer og genbestillingsprodukter.
                </p>
            </div>

            <AdminCompanyHubManager tenantId={tenantData.tenantId} />
        </div>
    );
}
