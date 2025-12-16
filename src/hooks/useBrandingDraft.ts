import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Default hero slideshow images
import heroPrinting from "@/assets/hero-printing.jpg";
import heroBanners from "@/assets/hero-banners.jpg";
import heroFlyers from "@/assets/hero-flyers.jpg";

// Hero banner dimension constants (can be changed platform-wide here)
export const HERO_RECOMMENDED_WIDTH = 1920;
export const HERO_RECOMMENDED_HEIGHT = 600;
export const HERO_MAX_IMAGES = 10;
export const HERO_MAX_VIDEOS = 3;

// Hero button link types
export type HeroButtonLinkType = 'ALL_PRODUCTS' | 'PRODUCT' | 'INTERNAL_PAGE' | 'EXTERNAL_URL';

// Hero media type
export type HeroMediaType = 'images' | 'video';

// Hero button interface (with color customization)
export interface HeroButton {
    id: string;
    label: string;
    variant: 'primary' | 'secondary';
    linkType: HeroButtonLinkType;
    target: {
        productId?: string;
        productSlug?: string;
        path?: string;
        url?: string;
    };
    /** Custom text color for the button */
    textColor?: string;
    /** Custom background color for the button */
    bgColor?: string;
    /** Background opacity (0-1) */
    bgOpacity?: number;
}

// Text animation types for banner headlines
export type HeroTextAnimation = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'scale' | 'blur';

// Hero image interface
export interface HeroImage {
    id: string;
    url: string;
    alt?: string;
    sortOrder: number;
    /** Optional: reference to master asset ID */
    masterAssetId?: string;
    /** Per-slide headline text */
    headline?: string;
    /** Per-slide subtitle/subline text */
    subline?: string;
    /** Per-slide CTA button text (legacy - use buttons array instead) */
    ctaText?: string;
    /** Per-slide CTA button link (legacy - use buttons array instead) */
    ctaLink?: string;
    /** Per-slide buttons array (max 2 buttons per slide) */
    buttons?: HeroButton[];
    /** Text animation effect for this slide */
    textAnimation?: HeroTextAnimation;
}

// Hero video interface
export interface HeroVideo {
    id: string;
    url: string;
    posterUrl?: string;
    sortOrder: number;
    /** Optional: reference to master asset ID */
    masterAssetId?: string;
}

// Slideshow settings interface
export interface HeroSlideshowSettings {
    enabled: boolean;
    transition: 'fade' | 'slide';
    autoplay: boolean;
    intervalMs: number;
}

// Video settings interface
export interface HeroVideoSettings {
    fitMode: 'cover' | 'contain';
    parallaxEnabled: boolean;
    muted: boolean;
    loop: boolean;
}

// Overlay settings interface (with text color customization)
export interface HeroOverlaySettings {
    title: string;
    subtitle: string;
    /** Custom title text color */
    titleColor?: string;
    /** Custom subtitle text color */
    subtitleColor?: string;
    showButtons: boolean;
    buttons: HeroButton[];
}

// Complete hero settings interface
export interface HeroSettings {
    recommendedWidthPx: number;
    recommendedHeightPx: number;
    mediaType: HeroMediaType;
    fitMode: 'cover' | 'contain';
    images: HeroImage[];
    videos: HeroVideo[];
    /** @deprecated Legacy field for backwards compatibility */
    media: string[];
    /** @deprecated Legacy field */
    type: 'image' | 'slideshow' | 'video';
    slideshow: HeroSlideshowSettings;
    /** @deprecated Legacy field */
    transition: 'fade' | 'slide';
    parallax: boolean;
    videoSettings: HeroVideoSettings;
    overlay_color: string;
    overlay_opacity: number;
    overlay: HeroOverlaySettings;
}

// Default slideshow settings
const DEFAULT_SLIDESHOW: HeroSlideshowSettings = {
    enabled: true,
    transition: 'fade',
    autoplay: true,
    intervalMs: 5000,
};

// Default video settings
const DEFAULT_VIDEO_SETTINGS: HeroVideoSettings = {
    fitMode: 'cover',
    parallaxEnabled: false,
    muted: true,
    loop: true,
};

// Default overlay settings - includes demo banner content and default button
const DEFAULT_OVERLAY: HeroOverlaySettings = {
    title: 'Billige tryksager online',
    subtitle: 'Professionelt tryk med hurtig levering til hele Danmark',
    titleColor: '#FFFFFF',
    subtitleColor: 'rgba(255, 255, 255, 0.9)',
    showButtons: true,
    buttons: [
        {
            id: 'default-cta-1',
            label: 'Se produkter',
            variant: 'primary',
            linkType: 'ALL_PRODUCTS',
            target: {},
            textColor: '#FFFFFF',
            bgColor: '#0EA5E9',
            bgOpacity: 1,
        },
        {
            id: 'default-cta-2',
            label: 'Kontakt os',
            variant: 'secondary',
            linkType: 'INTERNAL_PAGE',
            target: { path: '/kontakt' },
            textColor: '#FFFFFF',
        },
    ],
};

// Default hero images (these are the template slideshow images with per-slide text)

const DEFAULT_HERO_IMAGES: HeroImage[] = [
    {
        id: 'default-1',
        url: heroPrinting,
        alt: 'Professionelt tryk',
        sortOrder: 0,
        headline: 'Professionelt tryk – hurtig levering i hele Danmark',
        subline: 'Flyers, foldere, plakater, bannere m.m. — beregn prisen direkte.',
        ctaText: 'Se tryksager',
        ctaLink: '#tryksager',
    },
    {
        id: 'default-2',
        url: heroBanners,
        alt: 'Storformat print',
        sortOrder: 1,
        headline: 'Storformat print i topkvalitet',
        subline: 'Bannere, beachflag, skilte og messeudstyr – til konkurrencedygtige priser.',
        ctaText: 'Se storformat',
        ctaLink: '#storformat',
    },
    {
        id: 'default-3',
        url: heroFlyers,
        alt: 'Billige tryksager',
        sortOrder: 2,
        headline: 'Billige tryksager online',
        subline: 'Bestil nemt og hurtigt – personlig service og dansk produktion.',
        ctaText: 'Beregn pris',
        ctaLink: '/prisberegner',
    },
];

// Default hero settings
const DEFAULT_HERO: HeroSettings = {
    recommendedWidthPx: HERO_RECOMMENDED_WIDTH,
    recommendedHeightPx: HERO_RECOMMENDED_HEIGHT,
    mediaType: 'images',
    fitMode: 'cover',
    images: DEFAULT_HERO_IMAGES,
    videos: [],
    media: DEFAULT_HERO_IMAGES.map(img => img.url),
    type: 'slideshow',
    slideshow: DEFAULT_SLIDESHOW,
    transition: 'fade',
    parallax: false,
    videoSettings: DEFAULT_VIDEO_SETTINGS,
    overlay_color: '#000000',
    overlay_opacity: 0.3,
    overlay: DEFAULT_OVERLAY,
};

// ============================================================================
// HEADER SETTINGS (Extended)
// ============================================================================

// Dropdown content mode
export type HeaderDropdownMode = 'TEXT_ONLY' | 'IMAGE_ONLY' | 'IMAGE_AND_TEXT';

// Header scroll settings
export interface HeaderScrollSettings {
    sticky: boolean;           // Fixed to top when scrolling
    hideOnScroll: boolean;     // Hide when scrolling down, show on scroll up
    fadeOnScroll: boolean;     // Fade opacity as user scrolls
    shrinkOnScroll: boolean;   // Shrink height on scroll
    heightPx: number;          // Normal header height
    collapsedHeightPx: number; // Collapsed header height (when shrink is on)
}

// Header navigation item
export interface HeaderNavItem {
    id: string;
    label: string;
    href: string;
    isVisible: boolean;
    order: number;
}

// Header CTA button settings
export interface HeaderCtaSettings {
    enabled: boolean;
    label: string;
    href: string;
    variant: 'filled' | 'outline';
}

// Header style settings
export type HeaderStyleType = 'auto' | 'solid' | 'glass';
export type HeaderHeightType = 'sm' | 'md' | 'lg';
export type HeaderAlignmentType = 'left' | 'center' | 'right';

// Complete header settings
export interface HeaderSettings {
    // Logo
    logoType: 'image' | 'text';
    logoText: string;
    logoFont: string;              // Font for text logo
    logoTextColor: string;         // Color for text logo (separate from nav)
    logoImageUrl: string | null;
    logoLink: string;

    // Navigation
    navItems: HeaderNavItem[];
    dropdownMode: HeaderDropdownMode;

    // Styling
    fontId: string;
    bgColor: string;
    bgOpacity: number;
    textColor: string;              // Navigation text color
    autoContrastText: boolean;      // Auto-adjust text color for contrast
    transparentOverHero: boolean;
    style: HeaderStyleType;
    height: HeaderHeightType;
    alignment: HeaderAlignmentType;

    // Dropdown styling
    dropdownBgColor: string;        // Dropdown background color
    dropdownBgOpacity: number;      // Dropdown background opacity (0-1)

    // Scroll behavior
    scroll: HeaderScrollSettings;

    // CTA Button
    cta: HeaderCtaSettings;
}

// Default header scroll settings
const DEFAULT_HEADER_SCROLL: HeaderScrollSettings = {
    sticky: true,
    hideOnScroll: false,
    fadeOnScroll: false,
    shrinkOnScroll: false,
    heightPx: 72,
    collapsedHeightPx: 56,
};

// Default header CTA
const DEFAULT_HEADER_CTA: HeaderCtaSettings = {
    enabled: false,
    label: 'Kontakt os',
    href: '/kontakt',
    variant: 'filled',
};

// Default nav items
const DEFAULT_NAV_ITEMS: HeaderNavItem[] = [
    { id: 'home', label: 'Hjem', href: '/', isVisible: true, order: 0 },
    { id: 'products', label: 'Produkter', href: '/produkter', isVisible: true, order: 1 },
    { id: 'grafisk', label: 'Grafisk vejledning', href: '/grafisk-vejledning', isVisible: true, order: 2 },
    { id: 'contact', label: 'Kontakt', href: '/kontakt', isVisible: true, order: 3 },
    { id: 'about', label: 'Om os', href: '/om-os', isVisible: true, order: 4 },
];

// Default header settings
const DEFAULT_HEADER: HeaderSettings = {
    logoType: 'text',
    logoText: 'Min Shop',
    logoFont: 'Inter',
    logoTextColor: '#1F2937',      // Separate color for logo text
    logoImageUrl: null,
    logoLink: '/',
    navItems: DEFAULT_NAV_ITEMS,
    dropdownMode: 'IMAGE_AND_TEXT',
    fontId: 'Inter',
    bgColor: '#FFFFFF',
    bgOpacity: 0.95,
    textColor: '#1F2937',
    autoContrastText: true,
    transparentOverHero: true,
    style: 'solid',
    height: 'md',
    alignment: 'left',
    dropdownBgColor: '#FFFFFF',
    dropdownBgOpacity: 0.95,
    scroll: DEFAULT_HEADER_SCROLL,
    cta: DEFAULT_HEADER_CTA,
};

// ============================================================================
// FOOTER SETTINGS
// ============================================================================

// Footer link item
export interface FooterLinkItem {
    id: string;
    label: string;
    href: string;
    isVisible: boolean;
    order: number;
}

// Social media platform settings
export interface SocialPlatformSettings {
    enabled: boolean;
    url: string;
}

// Footer social settings
export interface FooterSocialSettings {
    facebook: SocialPlatformSettings;
    instagram: SocialPlatformSettings;
    linkedin: SocialPlatformSettings;
    twitter: SocialPlatformSettings;
    youtube: SocialPlatformSettings;
}

// Footer layout style
export type FooterStyleType = 'minimal' | 'columns' | 'centered';
export type FooterBackgroundType = 'themeDark' | 'themeLight' | 'solid';

// Complete footer settings
export interface FooterSettings {
    style: FooterStyleType;
    background: FooterBackgroundType;
    bgColor: string;
    text: string;
    copyrightText: string;
    showCopyright: boolean;
    links: FooterLinkItem[];
    social: FooterSocialSettings;
    showSocialIcons: boolean;
}

// Default footer social settings (enabled with placeholder URLs)
const DEFAULT_FOOTER_SOCIAL: FooterSocialSettings = {
    facebook: { enabled: true, url: 'https://facebook.com/' },
    instagram: { enabled: true, url: 'https://instagram.com/' },
    linkedin: { enabled: true, url: 'https://linkedin.com/' },
    twitter: { enabled: false, url: '' },
    youtube: { enabled: true, url: 'https://youtube.com/' },
};

// Default footer links
const DEFAULT_FOOTER_LINKS: FooterLinkItem[] = [
    { id: 'privacy', label: 'Privatlivspolitik', href: '/privatliv', isVisible: true, order: 0 },
    { id: 'terms', label: 'Handelsbetingelser', href: '/vilkaar', isVisible: true, order: 1 },
    { id: 'contact', label: 'Kontakt', href: '/kontakt', isVisible: true, order: 2 },
    { id: 'grafisk', label: 'Grafisk vejledning', href: '/grafisk-vejledning', isVisible: true, order: 3 },
];

// Default footer settings
const DEFAULT_FOOTER: FooterSettings = {
    style: 'minimal',
    background: 'themeDark',
    bgColor: '#1F2937',
    text: 'Din professionelle tryksagspartner.',
    copyrightText: '© {year} {shopName}. Alle rettigheder forbeholdes.',
    showCopyright: true,
    links: DEFAULT_FOOTER_LINKS,
    social: DEFAULT_FOOTER_SOCIAL,
    showSocialIcons: true,
};

// ============================================================================
// FORSIDE (FRONT PAGE) SETTINGS
// ============================================================================

// Content block for front page sections
export interface ContentBlock {
    id: string;
    enabled: boolean;
    heading?: string;           // Renders as H2 for SEO
    text?: string;              // Renders as paragraph
    imageUrl?: string;
    imagePosition: 'left' | 'right';
    textAlign: 'left' | 'center' | 'right';
}

// Forside (front page) settings
export interface ForsideSettings {
    showBanner: boolean;
    contentBlocks: ContentBlock[];  // max 4
}

// Default content block
const DEFAULT_CONTENT_BLOCK: ContentBlock = {
    id: 'block-1',
    enabled: true,
    heading: 'Velkommen til vores butik',
    text: 'Vi tilbyder professionelt tryk og hurtig levering til hele Danmark.',
    imageUrl: undefined,
    imagePosition: 'left',
    textAlign: 'left',
};

// Default forside settings
const DEFAULT_FORSIDE: ForsideSettings = {
    showBanner: true,
    contentBlocks: [DEFAULT_CONTENT_BLOCK],
};

// ============================================================================
// COMPLETE BRANDING CONFIGURATION
// ============================================================================

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
        hover: "#0284C7",
        // Typography colors
        headingText: "#1F2937",
        bodyText: "#4B5563",
        pricingText: "#0EA5E9",
        linkText: "#0EA5E9",
    },
    // Saved color swatches (max 20)
    savedSwatches: [] as string[],
    hero: DEFAULT_HERO,
    header: DEFAULT_HEADER,
    footer: DEFAULT_FOOTER,
    forside: DEFAULT_FORSIDE,
    navigation: {
        dropdown_images: true,
    },
    selectedIconPackId: "classic",
};

export type BrandingData = typeof DEFAULT_BRANDING;

// Export defaults for use in components
export {
    DEFAULT_BRANDING,
    DEFAULT_HERO,
    DEFAULT_SLIDESHOW,
    DEFAULT_VIDEO_SETTINGS,
    DEFAULT_OVERLAY,
    DEFAULT_HEADER,
    DEFAULT_HEADER_SCROLL,
    DEFAULT_HEADER_CTA,
    DEFAULT_NAV_ITEMS,
    DEFAULT_FOOTER,
    DEFAULT_FOOTER_SOCIAL,
    DEFAULT_FOOTER_LINKS,
    DEFAULT_FORSIDE,
};



// Helper to deep merge branding with defaults
export function mergeBrandingWithDefaults(data?: any): BrandingData {
    if (!data) return DEFAULT_BRANDING;

    // Start with defaults
    const merged = { ...DEFAULT_BRANDING, ...data };

    // Deep merge Header
    if (data.header) {
        merged.header = {
            ...DEFAULT_BRANDING.header,
            ...data.header,
            scroll: { ...DEFAULT_BRANDING.header.scroll, ...(data.header.scroll || {}) },
            cta: { ...DEFAULT_BRANDING.header.cta, ...(data.header.cta || {}) },
            // Keep arrays from data if present, otherwise use default
            navItems: data.header.navItems || DEFAULT_BRANDING.header.navItems,
        };
    }

    // Deep merge Footer
    if (data.footer) {
        merged.footer = {
            ...DEFAULT_BRANDING.footer,
            ...data.footer,
            social: { ...DEFAULT_BRANDING.footer.social, ...(data.footer.social || {}) },
            links: data.footer.links || DEFAULT_BRANDING.footer.links,
        };
    }

    // Deep merge Hero
    if (data.hero) {
        merged.hero = {
            ...DEFAULT_BRANDING.hero,
            ...data.hero,
            slideshow: { ...DEFAULT_BRANDING.hero.slideshow, ...(data.hero.slideshow || {}) },
            overlay: { ...DEFAULT_BRANDING.hero.overlay, ...(data.hero.overlay || {}) },
            videoSettings: { ...DEFAULT_BRANDING.hero.videoSettings, ...(data.hero.videoSettings || {}) },
        };
    }

    // Deep merge Forside
    if (data.forside) {
        merged.forside = {
            ...DEFAULT_BRANDING.forside,
            ...data.forside,
            contentBlocks: data.forside.contentBlocks || DEFAULT_BRANDING.forside.contentBlocks,
        };
    }

    // Deep merge nested objects
    if (data.fonts) merged.fonts = { ...DEFAULT_BRANDING.fonts, ...data.fonts };
    if (data.colors) merged.colors = { ...DEFAULT_BRANDING.colors, ...data.colors };
    if (data.navigation) merged.navigation = { ...DEFAULT_BRANDING.navigation, ...data.navigation };

    return merged;
}

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
    saveDraft: (options?: { label?: string }) => Promise<void>;
    publishDraft: (label?: string) => Promise<void>;
    discardDraft: () => void;
    resetToDefault: () => Promise<void>;
    refetch: () => Promise<void>;
}

// LocalStorage key for persisting draft across refreshes
const DRAFT_STORAGE_KEY = 'branding-draft-unsaved';

// Helper to save draft to localStorage
function saveDraftToStorage(draft: BrandingData) {
    try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
        console.warn('Failed to save draft to localStorage:', e);
    }
}

// Helper to load draft from localStorage
function loadDraftFromStorage(): BrandingData | null {
    try {
        const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load draft from localStorage:', e);
    }
    return null;
}

// Helper to clear draft from localStorage
function clearDraftStorage() {
    try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear draft from localStorage:', e);
    }
}

export function useBrandingDraft(): UseBrandingDraftReturn {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("Din Shop");
    const [draft, setDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [published, setPublished] = useState<BrandingData>(DEFAULT_BRANDING);
    const [originalDraft, setOriginalDraft] = useState<BrandingData>(DEFAULT_BRANDING);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

    // Check if there are unsaved changes
    const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(originalDraft);

    // Save draft to localStorage whenever it changes (after initial load)
    useEffect(() => {
        if (hasLoadedFromStorage && hasUnsavedChanges) {
            saveDraftToStorage(draft);
        }
    }, [draft, hasLoadedFromStorage, hasUnsavedChanges]);

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
                    const migrated = mergeBrandingWithDefaults(brandingSettings);
                    setDraft(migrated);
                    setPublished(migrated);
                    setOriginalDraft(migrated);
                } else {
                    // New format: branding.draft and branding.published
                    const draftData = mergeBrandingWithDefaults(brandingSettings.draft);
                    const publishedData = mergeBrandingWithDefaults(brandingSettings.published);

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

        // Check localStorage for unsaved changes from previous session
        const storedDraft = loadDraftFromStorage();
        if (storedDraft) {
            // Merge with defaults to ensure new fields are present
            const mergedStored = mergeBrandingWithDefaults(storedDraft);
            setDraft(mergedStored);
            toast.info('Gendannet ændringer fra forrige session', { duration: 3000 });
        }
        setHasLoadedFromStorage(true);
    }, []);

    useEffect(() => {
        fetchBranding();
    }, [fetchBranding]);

    // Update draft locally (no DB call)
    const updateDraft = useCallback((partial: Partial<BrandingData>) => {
        setDraft(prev => {
            // Deep merge hero
            const newHero = partial.hero ? {
                ...prev.hero,
                ...partial.hero,
                // Deep merge slideshow if provided
                slideshow: partial.hero.slideshow
                    ? { ...prev.hero.slideshow, ...partial.hero.slideshow }
                    : prev.hero.slideshow,
                // Deep merge overlay if provided
                overlay: partial.hero.overlay
                    ? { ...prev.hero.overlay, ...partial.hero.overlay }
                    : prev.hero.overlay,
            } : prev.hero;

            // Deep merge header
            const newHeader = partial.header ? {
                ...prev.header,
                ...partial.header,
                scroll: partial.header.scroll
                    ? { ...prev.header.scroll, ...partial.header.scroll }
                    : prev.header.scroll,
                cta: partial.header.cta
                    ? { ...prev.header.cta, ...partial.header.cta }
                    : prev.header.cta,
                navItems: partial.header.navItems ?? prev.header.navItems,
            } : prev.header;

            // Deep merge footer
            const newFooter = partial.footer ? {
                ...prev.footer,
                ...partial.footer,
                social: partial.footer.social
                    ? { ...prev.footer.social, ...partial.footer.social }
                    : prev.footer.social,
                links: partial.footer.links ?? prev.footer.links,
            } : prev.footer;

            // Deep merge forside
            const newForside = partial.forside ? {
                ...prev.forside,
                ...partial.forside,
                contentBlocks: partial.forside.contentBlocks ?? prev.forside.contentBlocks,
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

    // Save draft to database (without publishing)
    const saveDraft = useCallback(async (options?: { label?: string }) => {
        if (!tenantId) return;
        setIsSaving(true);
        // Handle case where Event is passed by mistake
        const label = options && typeof options === 'object' && 'label' in options ? options.label : undefined;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. If label provided, create version snapshot
            if (label) {
                const { error: versionError } = await supabase
                    .from('branding_versions' as any)
                    .insert({
                        tenant_id: tenantId,
                        data: draft,
                        label: label,
                        created_by: user?.id,
                        type: 'snapshot',
                    });

                if (versionError) console.error("Error creating draft version:", versionError);
            }

            // 2. Update tenant settings (current draft state)
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
            clearDraftStorage(); // Clear localStorage since changes are now saved
            toast.success(label ? `Kladde "${label}" gemt` : "Kladde gemt");
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
                    data: draft, // Save the NEW state as a snapshot history entry
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
            clearDraftStorage(); // Clear localStorage on reset
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
