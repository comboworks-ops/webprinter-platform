import { resolveAdminTenant } from "@/lib/adminTenant";
import { AdminCompanyHubManager } from "@/components/companyhub/AdminCompanyHubManager";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function AdminCompanyHub() {
    const { data: tenantData, isLoading } = useQuery({
        queryKey: ["admin_tenant"],
        queryFn: resolveAdminTenant
    });

    if (isLoading) {
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">CompanyHub</h1>
                <p className="text-muted-foreground">
                    Administrer firma-konti, medlemmer og genbestillings-skabeloner (Hub Items).
                </p>
            </div>

            <AdminCompanyHubManager tenantId={tenantData.tenantId} />
        </div>
    );
}
