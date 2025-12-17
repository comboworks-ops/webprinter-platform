
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandingEditorV2 } from "@/components/admin/BrandingEditorV2";
import { useSidebar } from "@/components/ui/sidebar";
import {
    createTenantAdapter,
    TENANT_CAPABILITIES,
} from "@/lib/branding";

export function TenantBrandingSettingsV2() {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("Min Shop");
    const [isLoading, setIsLoading] = useState(true);
    const { setOpen } = useSidebar();

    // Auto-collapse sidebar on mount to give more space for the visual editor
    useEffect(() => {
        setOpen(false);
        // Optional: Re-expand on unmount? 
        // For now, let's leave it collapsed as the user might prefer it, 
        // or they can manually expand it.
        return () => {
            setOpen(true); // Re-open when leaving V2
        };
    }, [setOpen]);

    // Load tenant info
    useEffect(() => {
        async function loadTenantInfo() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsLoading(false);
                    return;
                }

                if (user) {
                    const { data } = await (supabase
                        .from('tenants' as any))
                        .select('id, name')
                        .eq('owner_id', user.id)
                        .maybeSingle();

                    if (data) {
                        const tenant = data as { id: string; name: string };
                        setTenantId(tenant.id);
                        setTenantName(tenant.name || 'Min Shop');
                    }
                }
            } catch (error) {
                console.error('Error loading tenant:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadTenantInfo();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!tenantId) {
        return (
            <div className="text-center p-8">
                <p className="text-muted-foreground">
                    Kunne ikke finde din shop. Prøv at logge ind igen.
                </p>
            </div>
        );
    }

    const adapter = createTenantAdapter(tenantId, tenantName);

    return (
        <BrandingEditorV2
            adapter={adapter}
            capabilities={TENANT_CAPABILITIES}
        />
    );
}

export default TenantBrandingSettingsV2;
