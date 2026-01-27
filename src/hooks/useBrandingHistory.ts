import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BrandingData } from "./useBrandingDraft";

export interface BrandingVersion {
    id: string;
    tenant_id: string;
    data: BrandingData;
    label: string | null;
    created_at: string;
    created_by: string | null;
    type: "snapshot" | "auto_save";
}

interface UseBrandingHistoryReturn {
    versions: BrandingVersion[];
    isLoading: boolean;
    isRestoring: boolean;
    restoreVersion: (versionId: string) => Promise<void>;
    deleteVersion: (versionId: string) => Promise<void>;
    refetch: () => Promise<void>;
}

export function useBrandingHistory(tenantId: string | null): UseBrandingHistoryReturn {
    const [versions, setVersions] = useState<BrandingVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState(false);

    const fetchVersions = useCallback(async () => {
        if (!tenantId) {
            setVersions([]);
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('branding_versions' as any)
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            setVersions((data as unknown as BrandingVersion[]) || []);
        } catch (error) {
            console.error("Error fetching branding history:", error);
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const restoreVersion = useCallback(async (versionId: string) => {
        if (!tenantId) return;

        const version = versions.find(v => v.id === versionId);
        if (!version) {
            toast.error("Version ikke fundet");
            return;
        }

        setIsRestoring(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Create snapshot of current state before restore
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const currentSettings = (tenant as any).settings || {};
            const currentBranding = currentSettings.branding || {};
            const currentPublished = currentBranding.published || currentBranding;

            // Save current as snapshot
            await supabase
                .from('branding_versions' as any)
                .insert({
                    tenant_id: tenantId,
                    data: currentPublished,
                    label: `Før gendannelse af "${version.label || 'Unavngivet'}"`,
                    created_by: user?.id,
                    type: 'snapshot',
                });

            // 2. Restore the selected version
            const newSettings = {
                ...currentSettings,
                branding: {
                    draft: version.data,
                    published: version.data,
                },
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            toast.success(`Gendannet til "${version.label || 'Unavngivet'}"`);

            // Refetch versions
            await fetchVersions();

            // Return success - caller should refetch branding
        } catch (error) {
            console.error("Error restoring version:", error);
            toast.error("Kunne ikke gendanne version");
        } finally {
            setIsRestoring(false);
        }
    }, [tenantId, versions, fetchVersions]);

    const deleteVersion = useCallback(async (versionId: string) => {
        try {
            const { error } = await supabase
                .from('branding_versions' as any)
                .delete()
                .eq('id', versionId);

            if (error) throw error;

            setVersions(prev => prev.filter(v => v.id !== versionId));
            toast.success("Version slettet");
        } catch (error) {
            console.error("Error deleting version:", error);
            toast.error("Kunne ikke slette version");
        }
    }, []);

    return {
        versions,
        isLoading,
        isRestoring,
        restoreVersion,
        deleteVersion,
        refetch: fetchVersions,
    };
}
