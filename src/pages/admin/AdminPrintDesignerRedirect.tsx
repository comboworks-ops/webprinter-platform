import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { resolveAdminTenant } from "@/lib/adminTenant";

export default function AdminPrintDesignerRedirect() {
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        const openDesigner = async () => {
            const resolution = await resolveAdminTenant();
            if (cancelled) return;

            const params = new URLSearchParams({
                format: "A4",
            });

            if (resolution.tenantId) {
                params.set("tenantId", resolution.tenantId);
            }

            navigate(`/designer?${params.toString()}`, { replace: true });
        };

        openDesigner();

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    return (
        <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
    );
}
