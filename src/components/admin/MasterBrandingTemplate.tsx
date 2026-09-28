/**
 * Master Branding Template Page
 *
 * This is the master admin's branding template editor.
 * Uses V2 editor for creating premade designs that can be saved to resources.
 * Only accessible to the platform owner (Master Admin).
 */

import { useMemo } from 'react';
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { SiteDesignEditorV2 } from "./SiteDesignEditorV2";
import {
    createMasterAdapter,
    MASTER_CAPABILITIES,
} from "@/lib/branding";

export function MasterBrandingTemplate() {
    const { isMasterAdmin, loading: roleLoading } = useUserRole();
    const adapter = useMemo(() => createMasterAdapter(), []);
    if (roleLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Only master admin can access
    if (!isMasterAdmin) {
        return <section className="mx-auto max-w-xl space-y-4 p-6" role="status">
            <h1 className="text-xl font-semibold">Designskabeloner kræver masteradgang</h1>
            <p>Din aktuelle session har ikke bekræftet masteradgang. Du kan stadig redigere den valgte shop i Site Design.</p>
            <Link className="inline-flex min-h-11 items-center underline" to="/admin/site-design-v2">Åbn Site Design</Link>
        </section>;
    }



    return (
        <div className="workspace-master-branding">
        <SiteDesignEditorV2
            adapter={adapter}
            capabilities={MASTER_CAPABILITIES}
        />
        </div>
    );
}

export default MasterBrandingTemplate;
