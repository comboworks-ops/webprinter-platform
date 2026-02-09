/**
 * Tenant Branding Settings Page
 * 
 * This is the tenant-facing branding editor that uses the unified
 * branding system with tenant-specific capabilities.
 */

import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedBrandingEditor } from "./UnifiedBrandingEditor";
import {
    createTenantAdapter,
    TENANT_CAPABILITIES,
} from "@/lib/branding";

export function TenantBrandingSettings() {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("Min Shop");
    const [isLoading, setIsLoading] = useState(true);

    // Load tenant info
    useEffect(() => {
        async function loadTenantInfo() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsLoading(false);
                    return;
                }

                const { data: tenant } = await (supabase
                    .from('tenants') as any)
                    .select('id, name')
                    .eq('owner_id', user.id)
                    .maybeSingle();

                if (tenant) {
                    setTenantId(tenant.id);
                    setTenantName(tenant.name || 'Min Shop');
                }
            } catch (error) {
                console.error('Error loading tenant:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadTenantInfo();
    }, []);

    // Memoize the adapter to prevent infinite re-renders.
    // The adapter object reference must stay stable between renders to avoid
    // re-running the loadData effect in useBrandingEditor.
    const adapter = useMemo(() => {
        if (!tenantId) return null;
        return createTenantAdapter(tenantId, tenantName);
    }, [tenantId, tenantName]);

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
        <UnifiedBrandingEditor
            adapter={adapter}
            capabilities={TENANT_CAPABILITIES}
        />
    );
}

export default TenantBrandingSettings;
