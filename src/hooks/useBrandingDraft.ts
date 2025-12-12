import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Default branding configuration
const DEFAULT_BRANDING = {
    logo_url: null as string | null,
    fonts: {
        heading: "Poppins",
        body: "Inter",
        pricing: "Roboto Mono",
    },
    colors: {
        primary: "#0EA5E9",
        secondary: "#F1F5F9",
        background: "#F8FAFC",
        card: "#FFFFFF",
        dropdown: "#FFFFFF",
    },
    hero: {
        type: "image" as "image" | "slideshow" | "video",
        media: [] as string[],
        transition: "fade" as "fade" | "slide",
        parallax: false,
        overlay_color: "#000000",
        overlay_opacity: 0.3,
    },
    navigation: {
        dropdown_images: true,
    },
    selectedIconPackId: "classic",
};

export type BrandingData = typeof DEFAULT_BRANDING;

interface UseBrandingDraftReturn {
    // State
    draft: BrandingData;
    published: BrandingData;
    tenantId: string | null;
    tenantName: string;

    // Status
    isLoading: boolean;
    isSaving: boolean;
    hasUnsavedChanges: boolean;

    // Actions
    updateDraft: (partial: Partial<BrandingData>) => void;
    saveDraft: () => Promise<void>;
    publishDraft: (label?: string) => Promise<void>;
    discardDraft: () => void;
    resetToDefault: () => Promise<void>;
    refetch: () => Promise<void>;
}

export function useBrandingDraft(): UseBrandingDraftReturn {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("Din Shop");
    const [draft, setDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [published, setPublished] = useState<BrandingData>(DEFAULT_BRANDING);
    const [originalDraft, setOriginalDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Check if there are unsaved changes
    const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(originalDraft);

    // Fetch branding from database
    const fetchBranding = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id, name, settings')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (tenant) {
                setTenantId((tenant as any).id);
                setTenantName((tenant as any).name || "Din Shop");

                const settings = (tenant as any).settings || {};
                const brandingSettings = settings.branding || {};

                // Migration: If old format (no draft/published split), migrate it
                if (brandingSettings && !brandingSettings.draft && !brandingSettings.published) {
                    // Old format: branding is the actual data
                    const migratedDraft = { ...DEFAULT_BRANDING, ...brandingSettings };
                    const migratedPublished = { ...DEFAULT_BRANDING, ...brandingSettings };

                    setDraft(migratedDraft);
                    setPublished(migratedPublished);
                    setOriginalDraft(migratedDraft);
                } else {
                    // New format: branding.draft and branding.published
                    const draftData = { ...DEFAULT_BRANDING, ...brandingSettings.draft };
                    const publishedData = { ...DEFAULT_BRANDING, ...brandingSettings.published };

                    setDraft(draftData);
                    setPublished(publishedData);
                    setOriginalDraft(draftData);
                }
            }
        } catch (error) {
            console.error("Error fetching branding:", error);
            toast.error("Kunne ikke hente branding");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBranding();
    }, [fetchBranding]);

    // Update draft locally (no DB call)
    const updateDraft = useCallback((partial: Partial<BrandingData>) => {
        setDraft(prev => ({
            ...prev,
            ...partial,
            fonts: { ...prev.fonts, ...(partial.fonts || {}) },
            colors: { ...prev.colors, ...(partial.colors || {}) },
            hero: { ...prev.hero, ...(partial.hero || {}) },
            navigation: { ...prev.navigation, ...(partial.navigation || {}) },
        }));
    }, []);

    // Save draft to database (without publishing)
    const saveDraft = useCallback(async () => {
        if (!tenantId) return;
        setIsSaving(true);

        try {
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const currentSettings = (tenant as any).settings || {};
            const currentBranding = currentSettings.branding || {};

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    draft,
                    published: currentBranding.published || published,
                },
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            setOriginalDraft(draft);
            toast.success("Kladde gemt");
        } catch (error) {
            console.error("Error saving draft:", error);
            toast.error("Kunne ikke gemme kladde");
        } finally {
            setIsSaving(false);
        }
    }, [tenantId, draft, published]);

    // Publish draft (creates version snapshot, makes draft the published version)
    const publishDraft = useCallback(async (label?: string) => {
        if (!tenantId) return;
        setIsSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Create version snapshot
            const { error: versionError } = await supabase
                .from('branding_versions' as any)
                .insert({
                    tenant_id: tenantId,
                    data: published, // Save the CURRENT published as snapshot before overwriting
                    label: label || `Version ${new Date().toLocaleString('da-DK')}`,
                    created_by: user?.id,
                    type: 'snapshot',
                });

            if (versionError) {
                console.error("Version snapshot error:", versionError);
                // Don't block publishing if snapshot fails
            }

            // 2. Update tenant settings
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const currentSettings = (tenant as any).settings || {};

            const newSettings = {
                ...currentSettings,
                branding: {
                    draft,
                    published: draft, // Draft becomes the new published
                },
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            setPublished(draft);
            setOriginalDraft(draft);
            toast.success("Branding publiceret!");
        } catch (error) {
            console.error("Error publishing:", error);
            toast.error("Kunne ikke publicere branding");
        } finally {
            setIsSaving(false);
        }
    }, [tenantId, draft, published]);

    // Discard draft changes (reset to published)
    const discardDraft = useCallback(() => {
        setDraft(published);
        setOriginalDraft(published);
        toast.info("Ændringer kasseret");
    }, [published]);

    // Reset to platform default
    const resetToDefault = useCallback(async () => {
        if (!tenantId) return;
        setIsSaving(true);

        try {
            // Create snapshot before reset
            const { data: { user } } = await supabase.auth.getUser();

            await supabase
                .from('branding_versions' as any)
                .insert({
                    tenant_id: tenantId,
                    data: published,
                    label: 'Før nulstilling til standard',
                    created_by: user?.id,
                    type: 'snapshot',
                });

            // Update to defaults
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const currentSettings = (tenant as any).settings || {};

            const newSettings = {
                ...currentSettings,
                branding: {
                    draft: DEFAULT_BRANDING,
                    published: DEFAULT_BRANDING,
                },
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            setDraft(DEFAULT_BRANDING);
            setPublished(DEFAULT_BRANDING);
            setOriginalDraft(DEFAULT_BRANDING);
            toast.success("Branding nulstillet til standard");
        } catch (error) {
            console.error("Error resetting:", error);
            toast.error("Kunne ikke nulstille branding");
        } finally {
            setIsSaving(false);
        }
    }, [tenantId, published]);

    return {
        draft,
        published,
        tenantId,
        tenantName,
        isLoading,
        isSaving,
        hasUnsavedChanges,
        updateDraft,
        saveDraft,
        publishDraft,
        discardDraft,
        resetToDefault,
        refetch: fetchBranding,
    };
}

export { DEFAULT_BRANDING };
