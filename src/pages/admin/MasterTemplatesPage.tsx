import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import TemplatesManager from "@/components/admin/TemplatesManager";

export function MasterTemplatesPage() {
    const { isMasterAdmin, loading } = useUserRole();

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    // Only master admin can access
    if (!isMasterAdmin) {
        return <Navigate to="/admin" replace />;
    }

    return <TemplatesManager scopeType="MASTER" />;
}

export default MasterTemplatesPage;
