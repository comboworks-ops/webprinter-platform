/**
 * Master Branding Template Page
 * 
 * This is the master admin's branding template editor.
 * Only accessible to the platform owner (Master Admin).
 */

import { Loader2, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { UnifiedBrandingEditor } from "./UnifiedBrandingEditor";
import {
    createMasterAdapter,
    MASTER_CAPABILITIES,
} from "@/lib/branding";

export function MasterBrandingTemplate() {
    const { isMasterAdmin, loading: roleLoading } = useUserRole();

    if (roleLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Only master admin can access
    if (!isMasterAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const adapter = createMasterAdapter();

    return (
        <UnifiedBrandingEditor
            adapter={adapter}
            capabilities={MASTER_CAPABILITIES}
        />
    );
}

export default MasterBrandingTemplate;
