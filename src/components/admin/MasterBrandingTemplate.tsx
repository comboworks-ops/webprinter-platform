/**
 * Master Branding Template Page
 * 
 * This is the master admin's branding template editor.
 * Uses V2 editor for creating premade designs that can be saved to resources.
 * Only accessible to the platform owner (Master Admin).
 */

import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { BrandingEditorV2 } from "./BrandingEditorV2";
import { useSidebar } from "@/components/ui/sidebar";
import { useEffect, useRef } from "react";
import {
    createMasterAdapter,
    MASTER_CAPABILITIES,
} from "@/lib/branding";

export function MasterBrandingTemplate() {
    const { isMasterAdmin, loading: roleLoading } = useUserRole();
    const { setOpen } = useSidebar();
    const hasOpenedSidebarRef = useRef(false);

    // Keep admin sidebar visible in the site designer.
    useEffect(() => {
        if (hasOpenedSidebarRef.current) {
            return;
        }
        setOpen(true);
        hasOpenedSidebarRef.current = true;
    }, [setOpen]);

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
        <BrandingEditorV2
            adapter={adapter}
            capabilities={MASTER_CAPABILITIES}
        />
    );
}

export default MasterBrandingTemplate;
