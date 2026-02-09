
import { useRef, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { BrandingEditorV2 } from "@/components/admin/BrandingEditorV2";
import { useSidebar } from "@/components/ui/sidebar";
import {
    createTenantAdapter,
    TENANT_CAPABILITIES,
} from "@/lib/branding";
import { useShopSettings } from "@/hooks/useShopSettings";

export function TenantBrandingSettingsV2() {
    const { data: tenant, isLoading } = useShopSettings();
    const { setOpen } = useSidebar();
    const hasOpenedSidebarRef = useRef(false);

    // Memoize the adapter to prevent infinite re-renders.
    // The adapter object reference must stay stable between renders to avoid
    // re-running the loadData effect in useBrandingEditor.
    const adapter = useMemo(() => {
        if (!tenant?.id) return null;
        return createTenantAdapter(tenant.id, tenant.tenant_name || 'Min Shop');
    }, [tenant?.id, tenant?.tenant_name]);

    // Keep admin sidebar visible in the site designer.
    useEffect(() => {
        if (hasOpenedSidebarRef.current) {
            return;
        }
        setOpen(true);
        hasOpenedSidebarRef.current = true;
    }, [setOpen]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!adapter) {
        return (
            <div className="text-center p-8">
                <p className="text-muted-foreground">
                    Kunne ikke finde din shop. Prøv at logge ind igen.
                </p>
            </div>
        );
    }

    return (
        <BrandingEditorV2
            adapter={adapter}
            capabilities={TENANT_CAPABILITIES}
        />
    );
}

export default TenantBrandingSettingsV2;
