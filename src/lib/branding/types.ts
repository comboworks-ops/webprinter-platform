/**
 * Shared Branding Types & Adapter Interfaces
 * 
 * This module provides:
 * - Common branding schema/types used by both Master and Tenant
 * - Storage adapter interface for data operations
 * - Capability configuration for feature gating
 */

import {
    type BrandingData,
    type HeroSettings,
    type HeroImage,
    type HeroVideo,
    type HeroButton,
    type HeaderSettings,
    type HeaderScrollSettings,
    type HeaderDropdownMode,
    type HeaderDropdownImageSize,
    type HeaderNavItem,
    type HeaderCtaSettings,
    type HeaderStyleType,
    type HeaderHeightType,
    type HeaderAlignmentType,
    type FooterSettings,
    type FooterLinkItem,
    type FooterSocialSettings,
    type SocialPlatformSettings,
    type FooterStyleType,
    type FooterBackgroundType,
    type PageExtrasSettings,
    DEFAULT_BRANDING,
    DEFAULT_HERO,
    DEFAULT_HEADER,
    DEFAULT_HEADER_SCROLL,
    DEFAULT_HEADER_CTA,
    DEFAULT_NAV_ITEMS,
    DEFAULT_FOOTER,
    DEFAULT_FOOTER_SOCIAL,
    DEFAULT_FOOTER_LINKS,
} from '@/hooks/useBrandingDraft';

// Re-export types for convenience
export type {
    BrandingData,
    HeroSettings,
    HeroImage,
    HeroVideo,
    HeroButton,
    HeaderSettings,
    HeaderScrollSettings,
    HeaderDropdownMode,
    HeaderDropdownImageSize,
    HeaderNavItem,
    HeaderCtaSettings,
    HeaderStyleType,
    HeaderHeightType,
    HeaderAlignmentType,
    FooterSettings,
    FooterLinkItem,
    FooterSocialSettings,
    SocialPlatformSettings,
    FooterStyleType,
    FooterBackgroundType,
};
export {
    DEFAULT_BRANDING,
    DEFAULT_HERO,
    DEFAULT_HEADER,
    DEFAULT_HEADER_SCROLL,
    DEFAULT_HEADER_CTA,
    DEFAULT_NAV_ITEMS,
    DEFAULT_FOOTER,
    DEFAULT_FOOTER_SOCIAL,
    DEFAULT_FOOTER_LINKS,
};

// =============================================================================
// BRANDING MODE
// =============================================================================

export type BrandingMode = 'master' | 'tenant';

// =============================================================================
// HISTORY ENTRY
// =============================================================================

export interface BrandingHistoryEntry {
    id: string;
    label: string;
    data: BrandingData;
    timestamp: string;
    publishedBy?: string;
}

// =============================================================================
// SAVED DESIGN (User-named snapshots)
// =============================================================================

/**
 * A saved design snapshot with a user-provided name.
 * Separate from publish history - these are explicit saves by the user.
 */
export interface SavedDesign {
    id: string;
    name: string;           // User-provided name (e.g., "Sommer kampagne")
    data: BrandingData;
    createdAt: string;
    isAutoSave?: boolean;   // True for auto-saves (e.g., before reset)
}

// =============================================================================
// STORAGE ADAPTER INTERFACE
// =============================================================================

/**
 * Storage adapter for branding data operations.
 * Implemented differently for Master vs Tenant contexts.
 */
export interface BrandingStorageAdapter {
    /** Mode identifier */
    mode: BrandingMode;

    /** Unique identifier (master UUID or tenant UUID) */
    entityId: string;

    /** Display name (e.g., "Platform Template" or tenant shop name) */
    entityName: string;

    // Data operations

    /** Load current draft branding data */
    loadDraft(): Promise<BrandingData>;

    /** Load published branding data */
    loadPublished(): Promise<BrandingData>;

    /** Save draft (local/DB) without publishing */
    saveDraft(data: BrandingData): Promise<void>;

    /** Publish draft to live (moves draft -> published) */
    publish(data: BrandingData, label?: string): Promise<void>;

    /** Discard draft, revert to published */
    discardDraft(): Promise<BrandingData>;

    /** Reset to platform default (auto-saves current state first) */
    resetToDefault(): Promise<BrandingData>;

    // History (published versions)

    /** Load version history */
    loadHistory(): Promise<BrandingHistoryEntry[]>;

    /** Restore a specific version */
    restoreVersion(versionId: string): Promise<BrandingData>;

    // Saved Designs (user-named snapshots)

    /** Save current draft as a named design */
    saveDesign(name: string, data: BrandingData, isAutoSave?: boolean): Promise<SavedDesign>;

    /** Load all saved designs */
    loadSavedDesigns(): Promise<SavedDesign[]>;

    /** Load a specific saved design */
    loadSavedDesign(id: string): Promise<BrandingData>;

    /** Delete a saved design */
    deleteSavedDesign(id: string): Promise<void>;

    // Asset management

    /** Upload an asset (image/video) - returns public URL */
    uploadAsset(file: File, type: 'logo' | 'hero-image' | 'hero-video'): Promise<string>;

    /** Delete an uploaded asset */
    deleteAsset(url: string): Promise<void>;
}

// =============================================================================
// CAPABILITY CONFIGURATION
// =============================================================================

/**
 * Defines what features are available/editable in the branding editor.
 * Used for feature gating between Master and Tenant modes.
 */
export interface BrandingCapabilities {
    // Section visibility
    sections: {
        typography: boolean;
        colors: boolean;
        logo: boolean;
        hero: boolean;
        header: boolean;
        footer: boolean;
        navigation: boolean;
        iconPacks: boolean;
    };

    // Hero-specific capabilities
    hero: {
        canUploadImages: boolean;
        canUploadVideos: boolean;
        canSelectMasterBackgrounds: boolean;  // Tenants can pick from master library
        canManageMasterAssets: boolean;       // Master-only: upload to global library
        maxImages: number;
        maxVideos: number;
    };

    // Icon pack capabilities
    iconPacks: {
        canSelectPacks: boolean;
        canManagePacks: boolean;  // Master-only: upload/edit packs
    };

    // History
    canViewHistory: boolean;
    canRestoreHistory: boolean;

    // Template actions
    canApplyMasterTemplate: boolean;  // Tenant-only: copy from master
}

// =============================================================================
// DEFAULT CAPABILITIES
// =============================================================================

export const MASTER_CAPABILITIES: BrandingCapabilities = {
    sections: {
        typography: true,
        colors: true,
        logo: true,
        hero: true,
        header: true,
        footer: true,
        navigation: true,
        iconPacks: true,
    },
    hero: {
        canUploadImages: true,
        canUploadVideos: true,
        canSelectMasterBackgrounds: false,  // Master IS the source
        canManageMasterAssets: true,
        maxImages: 10,
        maxVideos: 3,
    },
    iconPacks: {
        canSelectPacks: true,
        canManagePacks: true,
    },
    canViewHistory: true,
    canRestoreHistory: true,
    canApplyMasterTemplate: false,
};

export const TENANT_CAPABILITIES: BrandingCapabilities = {
    sections: {
        typography: true,
        colors: true,
        logo: true,
        hero: true,
        header: true,
        footer: true,
        navigation: true,
        iconPacks: true,
    },
    hero: {
        canUploadImages: true,
        canUploadVideos: true,
        canSelectMasterBackgrounds: true,   // Can pick from master library
        canManageMasterAssets: false,       // Cannot manage master assets
        maxImages: 10,
        maxVideos: 3,
    },
    iconPacks: {
        canSelectPacks: true,
        canManagePacks: false,
    },
    canViewHistory: true,
    canRestoreHistory: true,
    canApplyMasterTemplate: true,  // Can copy from master template
};

// =============================================================================
// EDITOR CONTEXT
// =============================================================================

/**
 * Full context passed to the BrandingEditor.
 */
export interface BrandingEditorContext {
    mode: BrandingMode;
    adapter: BrandingStorageAdapter;
    capabilities: BrandingCapabilities;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Merge branding data with defaults to ensure all fields exist.
 */
export function mergeBrandingWithDefaults(data: Partial<BrandingData>): BrandingData {
    const mergePageExtrasEntry = (entry?: PageExtrasSettings): PageExtrasSettings => {
        if (!entry) {
            return {
                ...DEFAULT_BRANDING.pageExtras.about,
                lowerInfo: {
                    ...DEFAULT_BRANDING.pageExtras.about.lowerInfo,
                    background: { ...DEFAULT_BRANDING.pageExtras.about.lowerInfo.background },
                    items: [...DEFAULT_BRANDING.pageExtras.about.lowerInfo.items],
                },
                contentBlocks: [...DEFAULT_BRANDING.pageExtras.about.contentBlocks],
            };
        }

        const base = DEFAULT_BRANDING.pageExtras.about;
        const lowerInfo = entry.lowerInfo
            ? {
                ...base.lowerInfo,
                ...entry.lowerInfo,
                background: { ...base.lowerInfo.background, ...(entry.lowerInfo.background || {}) },
                layout: entry.lowerInfo.layout || base.lowerInfo.layout,
                items: Array.isArray(entry.lowerInfo.items) ? entry.lowerInfo.items : [],
            }
            : base.lowerInfo;

        return {
            ...base,
            ...entry,
            contentBlocks: Array.isArray(entry.contentBlocks) ? entry.contentBlocks : [],
            lowerInfo,
        };
    };

    return {
        ...DEFAULT_BRANDING,
        ...data,
        fonts: { ...DEFAULT_BRANDING.fonts, ...data.fonts },
        colors: { ...DEFAULT_BRANDING.colors, ...data.colors },
        productPage: {
            ...DEFAULT_BRANDING.productPage,
            ...data.productPage,
            orderButtons: {
                ...DEFAULT_BRANDING.productPage.orderButtons,
                ...(data.productPage?.orderButtons || {}),
                primary: {
                    ...DEFAULT_BRANDING.productPage.orderButtons.primary,
                    ...(data.productPage?.orderButtons?.primary || {}),
                },
                secondary: {
                    ...DEFAULT_BRANDING.productPage.orderButtons.secondary,
                    ...(data.productPage?.orderButtons?.secondary || {}),
                },
                selected: {
                    ...DEFAULT_BRANDING.productPage.orderButtons.selected,
                    ...(data.productPage?.orderButtons?.selected || {}),
                },
            },
            matrix: {
                ...DEFAULT_BRANDING.productPage.matrix,
                ...(data.productPage?.matrix || {}),
            },
        },
        hero: {
            ...DEFAULT_HERO,
            ...data.hero,
            // Ensure empty arrays are not refilled by defaults during merge
            images: (data.hero?.images !== undefined)
                ? data.hero.images
                : (data.hero?.media && data.hero.media.length > 0)
                    ? data.hero.media.map((url: string, i: number) => ({ id: `migrated-${i}`, url, sortOrder: i }))
                    : (data.hero?.images === undefined ? DEFAULT_HERO.images : []),
            slideshow: { ...DEFAULT_HERO.slideshow, ...data.hero?.slideshow },
            overlay: { ...DEFAULT_HERO.overlay, ...data.hero?.overlay },
            videoSettings: { ...DEFAULT_HERO.videoSettings, ...data.hero?.videoSettings },
        },
        header: {
            ...DEFAULT_HEADER,
            ...data.header,
            scroll: { ...DEFAULT_HEADER_SCROLL, ...data.header?.scroll },
            cta: { ...DEFAULT_HEADER_CTA, ...data.header?.cta },
        },
        footer: {
            ...DEFAULT_FOOTER,
            ...data.footer,
            social: {
                ...DEFAULT_FOOTER_SOCIAL,
                ...data.footer?.social,
                facebook: { ...DEFAULT_FOOTER_SOCIAL.facebook, ...data.footer?.social?.facebook },
                instagram: { ...DEFAULT_FOOTER_SOCIAL.instagram, ...data.footer?.social?.instagram },
                linkedin: { ...DEFAULT_FOOTER_SOCIAL.linkedin, ...data.footer?.social?.linkedin },
                twitter: { ...DEFAULT_FOOTER_SOCIAL.twitter, ...data.footer?.social?.twitter },
                youtube: { ...DEFAULT_FOOTER_SOCIAL.youtube, ...data.footer?.social?.youtube },
            },
        },
        contactPage: {
            ...DEFAULT_BRANDING.contactPage,
            ...data.contactPage,
            formBox: {
                ...DEFAULT_BRANDING.contactPage.formBox,
                ...(data.contactPage?.formBox || {}),
            },
            map: {
                ...DEFAULT_BRANDING.contactPage.map,
                ...(data.contactPage?.map || {}),
            },
            contactInfo: {
                ...DEFAULT_BRANDING.contactPage.contactInfo,
                ...(data.contactPage?.contactInfo || {}),
            },
        },
        aboutPage: {
            ...DEFAULT_BRANDING.aboutPage,
            ...data.aboutPage,
            media: {
                ...DEFAULT_BRANDING.aboutPage.media,
                ...(data.aboutPage?.media || {}),
            },
            features: {
                ...DEFAULT_BRANDING.aboutPage.features,
                ...(data.aboutPage?.features || {}),
                items: Array.isArray(data.aboutPage?.features?.items)
                    ? data.aboutPage?.features?.items
                    : DEFAULT_BRANDING.aboutPage.features.items,
            },
        },
        pageExtras: {
            ...DEFAULT_BRANDING.pageExtras,
            ...data.pageExtras,
            about: mergePageExtrasEntry(data.pageExtras?.about),
            contact: mergePageExtrasEntry(data.pageExtras?.contact),
            grafisk: mergePageExtrasEntry(data.pageExtras?.grafisk),
            product: mergePageExtrasEntry(data.pageExtras?.product),
        },
        navigation: { ...DEFAULT_BRANDING.navigation, ...data.navigation },
        // Theme system
        themeId: data.themeId || DEFAULT_BRANDING.themeId,
        themeSettings: { ...DEFAULT_BRANDING.themeSettings, ...data.themeSettings },
    };
}

/**
 * Check if two branding data objects are equal.
 */
export function brandingEquals(a: BrandingData, b: BrandingData): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
