/**
 * Shared Branding Editor Hook
 * 
 * A React hook that provides branding editing state and actions,
 * working with any storage adapter (Master or Tenant).
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    type BrandingData,
    type BrandingStorageAdapter,
    type BrandingHistoryEntry,
    type BrandingCapabilities,
    type BrandingMode,
    type SavedDesign,
    DEFAULT_BRANDING,
    brandingEquals,
    mergeBrandingWithDefaults,
} from './types';

export interface UseBrandingEditorOptions {
    adapter: BrandingStorageAdapter;
    capabilities: BrandingCapabilities;
}

export interface UseBrandingEditorReturn {
    // State
    draft: BrandingData;
    published: BrandingData;
    isLoading: boolean;
    isSaving: boolean;
    hasUnsavedChanges: boolean;

    // Metadata
    mode: BrandingMode;
    entityId: string;
    entityName: string;
    capabilities: BrandingCapabilities;

    // Draft operations
    updateDraft: (partial: Partial<BrandingData>) => void;
    saveDraft: () => Promise<void>;
    discardDraft: () => Promise<void>;

    // Publish operations
    publish: (label?: string) => Promise<void>;
    resetToDefault: () => Promise<void>;

    // History (published versions)
    history: BrandingHistoryEntry[];
    loadHistory: () => Promise<void>;
    restoreVersion: (versionId: string) => Promise<void>;

    // Saved Designs (user-named snapshots)
    savedDesigns: SavedDesign[];
    loadSavedDesigns: () => Promise<void>;
    saveDesign: (name?: string, overwriteId?: string) => Promise<void>;
    loadDesign: (id: string) => Promise<void>;
    deleteSavedDesign: (id: string) => Promise<void>;

    // Asset operations
    uploadAsset: (file: File, type: 'logo' | 'hero-image' | 'hero-video') => Promise<string>;
    deleteAsset: (url: string) => Promise<void>;

    // Refresh
    refetch: () => Promise<void>;
}

export function useBrandingEditor(options: UseBrandingEditorOptions): UseBrandingEditorReturn {
    const { adapter, capabilities } = options;
    const queryClient = useQueryClient();

    const [draft, setDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [published, setPublished] = useState<BrandingData>(DEFAULT_BRANDING);
    const [originalDraft, setOriginalDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [history, setHistory] = useState<BrandingHistoryEntry[]>([]);
    const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const hasUnsavedChanges = !brandingEquals(draft, originalDraft);

    // LOCK LF-003: Publish must invalidate/refetch storefront settings immediately.
    const refreshShopSettings = useCallback(async () => {
        const stamp = String(Date.now());

        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem('branding-published-at', stamp);
                window.dispatchEvent(
                    new CustomEvent('branding-published', {
                        detail: { at: stamp, entityId: adapter.entityId },
                    })
                );
            } catch {
                // Best effort only; cache invalidation below still runs.
            }
        }

        await queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
        await queryClient.refetchQueries({ queryKey: ['shop-settings'], type: 'active' });
    }, [adapter.entityId, queryClient]);

    // Load initial data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [draftData, publishedData, savedDesignsData, historyData] = await Promise.all([
                adapter.loadDraft(),
                adapter.loadPublished(),
                adapter.loadSavedDesigns(),
                adapter.loadHistory(),
            ]);

            const mergedDraft = mergeBrandingWithDefaults(draftData);
            const mergedPublished = mergeBrandingWithDefaults(publishedData);

            setDraft(mergedDraft);
            setPublished(mergedPublished);
            setOriginalDraft(mergedDraft);
            setSavedDesigns(savedDesignsData);
            setHistory(historyData || []);
        } catch (error) {
            console.error('Error loading branding data:', error);
            toast.error('Kunne ikke indlæse branding data');
        } finally {
            setIsLoading(false);
        }
    }, [adapter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Update draft (local state only)
    const updateDraft = useCallback((partial: Partial<BrandingData>) => {
        setDraft(prev => {
            // Deep merge for nested objects
            const newHero = partial.hero ? {
                ...prev.hero,
                ...partial.hero,
                slideshow: partial.hero.slideshow
                    ? { ...prev.hero.slideshow, ...partial.hero.slideshow }
                    : prev.hero.slideshow,
                overlay: partial.hero.overlay
                    ? { ...prev.hero.overlay, ...partial.hero.overlay }
                    : prev.hero.overlay,
                videoSettings: partial.hero.videoSettings
                    ? { ...prev.hero.videoSettings, ...partial.hero.videoSettings }
                    : prev.hero.videoSettings,
            } : prev.hero;

            const newHeader = partial.header ? {
                ...prev.header,
                ...partial.header,
                scroll: partial.header.scroll
                    ? { ...prev.header.scroll, ...partial.header.scroll }
                    : prev.header.scroll,
                cta: partial.header.cta
                    ? { ...prev.header.cta, ...partial.header.cta }
                    : prev.header.cta,
            } : prev.header;

            const newFooter = partial.footer ? {
                ...prev.footer,
                ...partial.footer,
                social: partial.footer.social ? {
                    ...prev.footer.social,
                    ...partial.footer.social,
                    facebook: { ...prev.footer.social.facebook, ...partial.footer.social.facebook },
                    instagram: { ...prev.footer.social.instagram, ...partial.footer.social.instagram },
                    linkedin: { ...prev.footer.social.linkedin, ...partial.footer.social.linkedin },
                    twitter: { ...prev.footer.social.twitter, ...partial.footer.social.twitter },
                    youtube: { ...prev.footer.social.youtube, ...partial.footer.social.youtube },
                } : prev.footer.social,
            } : prev.footer;

            const newForside = partial.forside ? {
                ...prev.forside,
                ...partial.forside,
                banner2: partial.forside.banner2 ? {
                    ...prev.forside.banner2,
                    ...partial.forside.banner2,
                    background: partial.forside.banner2.background
                        ? { ...prev.forside.banner2.background, ...partial.forside.banner2.background }
                        : prev.forside.banner2.background,
                    slides: partial.forside.banner2.slides ?? prev.forside.banner2.slides,
                } : prev.forside.banner2,
                contentBlocks: partial.forside.contentBlocks ?? prev.forside.contentBlocks,
                productsSection: partial.forside.productsSection ? {
                    ...prev.forside.productsSection,
                    ...partial.forside.productsSection,
                } : prev.forside.productsSection,
            } : prev.forside;

            return {
                ...prev,
                ...partial,
                fonts: { ...prev.fonts, ...(partial.fonts || {}) },
                colors: { ...prev.colors, ...(partial.colors || {}) },
                hero: newHero,
                header: newHeader,
                footer: newFooter,
                forside: newForside,
                navigation: { ...prev.navigation, ...(partial.navigation || {}) },
            };
        });
    }, []);

    // Save draft to storage
    const saveDraft = useCallback(async () => {
        setIsSaving(true);
        try {
            await adapter.saveDraft(draft);
            setOriginalDraft(draft);
            toast.success('Kladde gemt (ikke live endnu)');
        } catch (error) {
            console.error('Error saving draft:', error);
            toast.error('Kunne ikke gemme kladde');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, draft]);

    // Discard draft
    const discardDraft = useCallback(async () => {
        setIsSaving(true);
        try {
            const publishedData = await adapter.discardDraft();
            const merged = mergeBrandingWithDefaults(publishedData);
            setDraft(merged);
            setOriginalDraft(merged);
            toast.success('Ændringer kasseret');
        } catch (error) {
            console.error('Error discarding draft:', error);
            toast.error('Kunne ikke kassere ændringer');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter]);

    // Publish
    const publish = useCallback(async (label?: string) => {
        setIsSaving(true);
        try {
            await adapter.publish(draft, label);
            setPublished(draft);
            setOriginalDraft(draft);
            await refreshShopSettings();
            toast.success('Branding publiceret (live opdateret)');
        } catch (error) {
            console.error('Error publishing:', error);
            toast.error('Kunne ikke publicere');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, draft, refreshShopSettings]);

    // Reset to default
    const resetToDefault = useCallback(async () => {
        setIsSaving(true);
        try {
            const defaultData = await adapter.resetToDefault();
            setDraft(defaultData);
            setPublished(defaultData);
            setOriginalDraft(defaultData);
            await refreshShopSettings();
            toast.success('Nulstillet til standard');
        } catch (error) {
            console.error('Error resetting:', error);
            toast.error('Kunne ikke nulstille');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, refreshShopSettings]);

    // Load history
    const loadHistory = useCallback(async () => {
        try {
            const historyData = await adapter.loadHistory();
            setHistory(historyData);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }, [adapter]);

    // Restore version
    const restoreVersion = useCallback(async (versionId: string) => {
        setIsSaving(true);
        try {
            const restoredData = await adapter.restoreVersion(versionId);
            const merged = mergeBrandingWithDefaults(restoredData);
            setDraft(merged);
            setOriginalDraft(merged);
            toast.success('Version gendannet');
        } catch (error) {
            console.error('Error restoring version:', error);
            toast.error('Kunne ikke gendanne version');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter]);

    // Load saved designs
    const loadSavedDesigns = useCallback(async () => {
        try {
            const designs = await adapter.loadSavedDesigns();
            setSavedDesigns(designs);
        } catch (error) {
            console.error('Error loading saved designs:', error);
        }
    }, [adapter]);

    // Save design (user-named)
    const saveDesign = useCallback(async (name?: string, overwriteId?: string) => {
        setIsSaving(true);
        try {
            // If name provided, save as new design
            if (name || overwriteId) {
                await adapter.saveDesign(name || '', draft, false, overwriteId);
                toast.success(overwriteId ? 'Design overskrevet' : 'Design gemt');
                await loadSavedDesigns(); // Refresh list
            } else {
                // If no name, just save current draft state (standard save)
                await adapter.saveDraft(draft);
                setOriginalDraft(draft);
                toast.success('Kladde gemt (ikke live endnu)');
            }
        } catch (error) {
            console.error('Error saving design:', error);
            toast.error('Kunne ikke gemme');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, draft, loadSavedDesigns]);

    // Load saved design
    const loadDesign = useCallback(async (id: string) => {
        setIsSaving(true);
        try {
            const designData = await adapter.loadSavedDesign(id);
            const merged = mergeBrandingWithDefaults(designData);
            setDraft(merged);
            setOriginalDraft(merged); // Treat loaded design as new baseline
            toast.success('Design indlæst');
        } catch (error) {
            console.error('Error loading design:', error);
            toast.error('Kunne ikke indlæse design');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter]);

    // Delete saved design
    const deleteSavedDesign = useCallback(async (id: string) => {
        setIsSaving(true);
        try {
            await adapter.deleteSavedDesign(id);
            await loadSavedDesigns();
            toast.success('Design slettet');
        } catch (error) {
            console.error('Error deleting design:', error);
            toast.error('Kunne ikke slette design');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, loadSavedDesigns]);

    // Upload asset
    const uploadAsset = useCallback(async (
        file: File,
        type: 'logo' | 'hero-image' | 'hero-video'
    ): Promise<string> => {
        return adapter.uploadAsset(file, type);
    }, [adapter]);

    // Delete asset
    const deleteAsset = useCallback(async (url: string) => {
        return adapter.deleteAsset(url);
    }, [adapter]);

    return {
        // State
        draft,
        published,
        isLoading,
        isSaving,
        hasUnsavedChanges,

        // Metadata
        mode: adapter.mode,
        entityId: adapter.entityId,
        entityName: adapter.entityName,
        capabilities,

        // Draft operations
        updateDraft,
        saveDraft,
        discardDraft,

        // Publish operations
        publish,
        resetToDefault,

        // History
        history,
        loadHistory,
        restoreVersion,

        // Saved Designs
        savedDesigns,
        loadSavedDesigns,
        saveDesign,
        loadDesign,
        deleteSavedDesign,

        // Asset operations
        uploadAsset,
        deleteAsset,

        // Refresh
        refetch: loadData,
    };
}
