/**
 * Shared Branding Editor Hook
 * 
 * A React hook that provides branding editing state and actions,
 * working with any storage adapter (Master or Tenant).
 */

import { useState, useEffect, useCallback } from 'react';
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
    saveDraftSnapshot: (data: BrandingData, options?: { toast?: boolean }) => Promise<void>;
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
    saveDesign: (name?: string) => Promise<void>;
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

    const [draft, setDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [published, setPublished] = useState<BrandingData>(DEFAULT_BRANDING);
    const [originalDraft, setOriginalDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [history, setHistory] = useState<BrandingHistoryEntry[]>([]);
    const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const hasUnsavedChanges = !brandingEquals(draft, originalDraft);

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

            const newProductPage = partial.productPage ? {
                ...prev.productPage,
                ...partial.productPage,
                orderButtons: partial.productPage.orderButtons
                    ? {
                        ...prev.productPage.orderButtons,
                        ...partial.productPage.orderButtons,
                        primary: {
                            ...prev.productPage.orderButtons.primary,
                            ...(partial.productPage.orderButtons.primary || {}),
                        },
                        secondary: {
                            ...prev.productPage.orderButtons.secondary,
                            ...(partial.productPage.orderButtons.secondary || {}),
                        },
                        selected: {
                            ...prev.productPage.orderButtons.selected,
                            ...(partial.productPage.orderButtons.selected || {}),
                        },
                    }
                    : prev.productPage.orderButtons,
                matrix: partial.productPage.matrix
                    ? {
                        ...prev.productPage.matrix,
                        ...partial.productPage.matrix,
                    }
                    : prev.productPage.matrix,
            } : prev.productPage;

            const newGrafiskVejledning = partial.grafiskVejledning ? {
                ...prev.grafiskVejledning,
                ...partial.grafiskVejledning,
                header: partial.grafiskVejledning.header
                    ? { ...prev.grafiskVejledning.header, ...partial.grafiskVejledning.header }
                    : prev.grafiskVejledning.header,
                checklist: partial.grafiskVejledning.checklist
                    ? {
                        ...prev.grafiskVejledning.checklist,
                        ...partial.grafiskVejledning.checklist,
                        items: partial.grafiskVejledning.checklist.items ?? prev.grafiskVejledning.checklist.items,
                    }
                    : prev.grafiskVejledning.checklist,
                toc: partial.grafiskVejledning.toc
                    ? {
                        ...prev.grafiskVejledning.toc,
                        ...partial.grafiskVejledning.toc,
                        items: partial.grafiskVejledning.toc.items ?? prev.grafiskVejledning.toc.items,
                    }
                    : prev.grafiskVejledning.toc,
            } : prev.grafiskVejledning;

            const newContactPage = partial.contactPage ? {
                ...prev.contactPage,
                ...partial.contactPage,
                formBox: partial.contactPage.formBox
                    ? { ...prev.contactPage.formBox, ...partial.contactPage.formBox }
                    : prev.contactPage.formBox,
                map: partial.contactPage.map
                    ? { ...prev.contactPage.map, ...partial.contactPage.map }
                    : prev.contactPage.map,
                contactInfo: partial.contactPage.contactInfo
                    ? { ...prev.contactPage.contactInfo, ...partial.contactPage.contactInfo }
                    : prev.contactPage.contactInfo,
            } : prev.contactPage;

            const newAboutPage = partial.aboutPage ? {
                ...prev.aboutPage,
                ...partial.aboutPage,
                media: partial.aboutPage.media
                    ? { ...prev.aboutPage.media, ...partial.aboutPage.media }
                    : prev.aboutPage.media,
                features: partial.aboutPage.features
                    ? {
                        ...prev.aboutPage.features,
                        ...partial.aboutPage.features,
                        items: partial.aboutPage.features.items ?? prev.aboutPage.features.items,
                    }
                    : prev.aboutPage.features,
            } : prev.aboutPage;

            const mergePageExtrasEntry = (
                prevEntry: BrandingData["pageExtras"][keyof BrandingData["pageExtras"]],
                updates: BrandingData["pageExtras"][keyof BrandingData["pageExtras"]]
            ) => {
                const nextLowerInfo = updates.lowerInfo
                    ? {
                        ...prevEntry.lowerInfo,
                        ...updates.lowerInfo,
                        background: updates.lowerInfo.background
                            ? { ...prevEntry.lowerInfo.background, ...updates.lowerInfo.background }
                            : prevEntry.lowerInfo.background,
                        items: updates.lowerInfo.items ?? prevEntry.lowerInfo.items,
                        layout: updates.lowerInfo.layout ?? prevEntry.lowerInfo.layout,
                    }
                    : prevEntry.lowerInfo;

                return {
                    ...prevEntry,
                    ...updates,
                    contentBlocks: updates.contentBlocks ?? prevEntry.contentBlocks,
                    lowerInfo: nextLowerInfo,
                };
            };

            const newPageExtras = partial.pageExtras ? {
                ...prev.pageExtras,
                ...partial.pageExtras,
                about: partial.pageExtras.about
                    ? mergePageExtrasEntry(prev.pageExtras.about, partial.pageExtras.about)
                    : prev.pageExtras.about,
                contact: partial.pageExtras.contact
                    ? mergePageExtrasEntry(prev.pageExtras.contact, partial.pageExtras.contact)
                    : prev.pageExtras.contact,
                grafisk: partial.pageExtras.grafisk
                    ? mergePageExtrasEntry(prev.pageExtras.grafisk, partial.pageExtras.grafisk)
                    : prev.pageExtras.grafisk,
                product: partial.pageExtras.product
                    ? mergePageExtrasEntry(prev.pageExtras.product, partial.pageExtras.product)
                    : prev.pageExtras.product,
            } : prev.pageExtras;

            return {
                ...prev,
                ...partial,
                fonts: { ...prev.fonts, ...(partial.fonts || {}) },
                colors: { ...prev.colors, ...(partial.colors || {}) },
                hero: newHero,
                header: newHeader,
                footer: newFooter,
                productPage: newProductPage,
                grafiskVejledning: newGrafiskVejledning,
                contactPage: newContactPage,
                aboutPage: newAboutPage,
                navigation: { ...prev.navigation, ...(partial.navigation || {}) },
                pageExtras: newPageExtras,
            };
        });
    }, []);

    // Save draft to storage
    const saveDraft = useCallback(async () => {
        setIsSaving(true);
        try {
            await adapter.saveDraft(draft);
            setOriginalDraft(draft);
            toast.success('Kladde gemt');
        } catch (error) {
            console.error('Error saving draft:', error);
            toast.error('Kunne ikke gemme kladde');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, draft]);

    const saveDraftSnapshot = useCallback(async (data: BrandingData, options?: { toast?: boolean }) => {
        setIsSaving(true);
        try {
            const merged = mergeBrandingWithDefaults(data);
            await adapter.saveDraft(merged);
            setDraft(merged);
            setOriginalDraft(merged);
            if (options?.toast !== false) {
                toast.success('Kladde gemt');
            }
        } catch (error) {
            console.error('Error saving draft snapshot:', error);
            toast.error('Kunne ikke gemme kladde');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter]);

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
            toast.success('Branding publiceret!');
        } catch (error) {
            console.error('Error publishing:', error);
            toast.error('Kunne ikke publicere');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter, draft]);

    // Reset to default
    const resetToDefault = useCallback(async () => {
        setIsSaving(true);
        try {
            const defaultData = await adapter.resetToDefault();
            setDraft(defaultData);
            setPublished(defaultData);
            setOriginalDraft(defaultData);
            toast.success('Nulstillet til standard');
        } catch (error) {
            console.error('Error resetting:', error);
            toast.error('Kunne ikke nulstille');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [adapter]);

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
    const saveDesign = useCallback(async (name?: string) => {
        setIsSaving(true);
        try {
            // If name provided, save as new design
            if (name) {
                await adapter.saveDesign(name, draft);
                toast.success('Design gemt');
                await loadSavedDesigns(); // Refresh list
            } else {
                // If no name, just save current draft state (standard save)
                await adapter.saveDraft(draft);
                setOriginalDraft(draft);
                toast.success('Kladde gemt');
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
        saveDraftSnapshot,
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
