import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { readTransientString, removeTransientKey, writeTransientString } from "@/lib/storage/transientStorage";

// Default hero slideshow images (External URLs for maximum reliability in production)
const heroPrinting = "/hero-print.jpg";
const heroBanners = "/hero-banner.jpg";
const heroFlyers = "/hero-flyer.jpg";

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
    /** Custom hover background color for the button */
    bgHoverColor?: string;
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
    /** Per-slide overlay color (only used when usePerBannerOverlay is enabled) */
    overlayColor?: string;
    /** Per-slide overlay opacity (only used when usePerBannerOverlay is enabled) */
    overlayOpacity?: number;
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
    /** Toggle for per-banner overlay settings */
    usePerBannerOverlay?: boolean;
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
    imageUrl?: string | null; // Custom image/icon for menu item
    displayMode?: 'text_only' | 'image_only' | 'image_and_text'; // How to display the menu item
    imageSizePx?: number; // Size of the image in pixels (default: 20)
}

// Header CTA button settings
export interface HeaderCtaSettings {
    enabled: boolean;
    label: string;
    href: string;
    variant: 'filled' | 'outline';
    /** Custom background color for the CTA button */
    bgColor?: string;
    /** Custom text color for the CTA button */
    textColor?: string;
    /** Custom hover background color for the CTA button */
    hoverBgColor?: string;
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
    menuFontSizePx?: number;
    bgColor: string;
    bgOpacity: number;
    textColor: string;              // Navigation text color
    hoverTextColor: string;         // Navigation hover text color
    activeTextColor: string;        // Navigation active/pressed text color
    actionHoverTextColor?: string;  // Hover text color for search, language, account icons
    actionHoverBgColor?: string;    // Hover background color for the circular area behind icons
    autoContrastText: boolean;      // Auto-adjust text color for contrast
    transparentOverHero: boolean;
    style: HeaderStyleType;
    height: HeaderHeightType;
    alignment: HeaderAlignmentType;

    // Dropdown styling
    dropdownBgColor: string;        // Dropdown background color
    dropdownBgOpacity: number;      // Dropdown background opacity (0-1)
    dropdownHoverColor?: string;    // Dropdown hover color
    dropdownShowBorder: boolean;    // Show border and shadow on dropdown
    dropdownImageSizePx?: number;   // Large/tile dropdown image size
    dropdownCompactImageSizePx?: number; // Compact/rich dropdown image size
    dropdownBorderRadiusPx?: number;
    dropdownImageRadiusPx?: number;
    dropdownTextPosition?: 'side' | 'below'; // Text position relative to image
    dropdownCustomImageUrl?: string | null; // Custom image for dropdown header

    // Category headers (Tryksager, Storformat, etc.)
    dropdownCategoryFontId: string;    // Category header font
    dropdownCategoryFontSizePx?: number;
    dropdownCategoryColor: string;     // Category header color
    dropdownCategoryImages?: Record<string, string | null>; // Category key -> image URL mapping
    dropdownCategoryDisplayMode?: 'text' | 'image' | 'both'; // Show text, image, or both for categories

    // Product names
    dropdownProductFontId: string;     // Product name font
    dropdownProductFontSizePx?: number;
    dropdownProductColor: string;      // Product name color
    dropdownMetaColor?: string;
    dropdownMetaFontSizePx?: number;

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
    bgColor: '#0EA5E9',
    textColor: '#FFFFFF',
    hoverBgColor: '#0284C7',
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
    logoText: 'WebPrinter',
    logoFont: 'Poppins',
    logoTextColor: '#1F2937',      // Separate color for logo text
    logoImageUrl: null,
    logoLink: '/',
    navItems: DEFAULT_NAV_ITEMS,
    dropdownMode: 'IMAGE_AND_TEXT',
    menuFontSizePx: 14,
    fontId: 'Inter',
    bgColor: '#FFFFFF',
    bgOpacity: 0.95,
    textColor: '#1F2937',
    hoverTextColor: '#0EA5E9',     // Primary blue for hover
    activeTextColor: '#0284C7',    // Darker blue for active/pressed
    actionHoverTextColor: '#0EA5E9',
    actionHoverBgColor: 'rgba(14, 165, 233, 0.1)', // Light version of primary blue
    autoContrastText: true,
    transparentOverHero: true,
    style: 'solid',
    height: 'md',
    alignment: 'left',
    dropdownBgColor: '#FFFFFF',
    dropdownBgOpacity: 0.95,
    dropdownHoverColor: '#F3F4F6', // Light gray hover
    dropdownShowBorder: true,
    dropdownImageSizePx: 56,
    dropdownCompactImageSizePx: 40,
    dropdownBorderRadiusPx: 18,
    dropdownImageRadiusPx: 10,
    dropdownCategoryFontId: 'Inter',
    dropdownCategoryFontSizePx: 13,
    dropdownCategoryColor: '#6B7280',  // Slightly muted for category headers
    dropdownProductFontId: 'Inter',
    dropdownProductFontSizePx: 14,
    dropdownProductColor: '#1F2937',   // Dark color for product names
    dropdownMetaColor: '#6B7280',
    dropdownMetaFontSizePx: 11,
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
    headingFont?: string;       // Font for heading
    headingColor?: string;      // Color for heading
    text?: string;              // Renders as paragraph
    textFont?: string;          // Font for body text
    textColor?: string;         // Color for body text
    imageUrl?: string;
    imagePosition: 'left' | 'right';
    textAlign: 'left' | 'center' | 'right';
}

export type Banner2Mode = 'cards' | 'logo-showcase';
export type Banner2Animation = HeroTextAnimation;

export interface Banner2Item {
    id: string;
    enabled: boolean;
    title: string;
    description: string;
    titleFont: string;
    titleColor: string;
    descriptionFont: string;
    descriptionColor: string;
    iconType: 'icon' | 'image' | 'none';
    iconName?: string;
    iconUrl?: string;
    groupAnimation: Banner2Animation;
    titleAnimation: Banner2Animation;
    descriptionAnimation: Banner2Animation;
    iconAnimation: Banner2Animation;
    linkHref?: string;
}

export interface Banner2Slide {
    id: string;
    enabled: boolean;
    durationSeconds: number;
    items: Banner2Item[];
}

export interface Banner2BackgroundSettings {
    type: 'solid' | 'gradient';
    color: string;
    gradientStart: string;
    gradientEnd: string;
    gradientAngle: number;
    animated: boolean;
    animatedStart: string;
    animatedMiddle: string;
    animatedEnd: string;
    animatedSpeed: 'slow' | 'slower';
}

export interface Banner2Settings {
    enabled: boolean;
    mode: Banner2Mode;
    autoPlay: boolean;
    showArrows: boolean;
    showDots: boolean;
    heading: string;
    subtitle: string;
    headingFont: string;
    headingColor: string;
    subtitleFont: string;
    subtitleColor: string;
    itemsPerRow: number;
    slides: Banner2Slide[];
    background: Banner2BackgroundSettings;
}

export interface FeaturedSidePanelItem {
    id: string;
    mode: 'banner' | 'product';
    productId?: string;
    imageUrl?: string | null;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaHref?: string;
}

export interface FeaturedProductConfig {
    enabled: boolean;
    productId?: string;
    showInProductList?: boolean;
    quantityPresets?: number[];
    showOptions: boolean;
    showPrice: boolean;
    overlapPx: number;
    boxScalePct?: number;
    imageScalePct?: number;
    borderRadiusPx?: number;
    position?: 'above' | 'below';
    productSide?: 'left' | 'right';
    imageMode?: 'contain' | 'full';
    cardStyle?: 'default' | 'glass';
    customTitle?: string;
    customDescription?: string;
    backgroundColor?: string;
    customImageUrl?: string | null;
    galleryEnabled?: boolean;
    galleryImages?: string[];
    galleryIntervalMs?: number;
    ctaLabel?: string;
    ctaColor?: string;
    ctaTextColor?: string;
    ctaBorderRadiusPx?: number;
    sidePanel?: {
        enabled: boolean;
        mode?: 'banner' | 'product';
        items?: FeaturedSidePanelItem[];
        imageUrl?: string | null;
        images?: string[];
        slideshowIntervalMs?: number;
        showNavigationArrows?: boolean;
        fadeTransition?: boolean;
        transitionDurationMs?: number;
        borderRadiusPx?: number;
        boxScalePct?: number;
        imageScalePct?: number;
        title?: string;
        subtitle?: string;
        textAnimation?: HeroTextAnimation;
        overlayColor?: string;
        overlayOpacity?: number;
        titleColor?: string;
        subtitleColor?: string;
        ctaLabel?: string;
        ctaHref?: string;
        ctaColor?: string;
        ctaTextColor?: string;
        productId?: string;
    };
}

export interface ForsideProductsSection {
    enabled: boolean;
    columns: 3 | 4 | 5;
    layoutStyle: 'cards' | 'flat' | 'grouped' | 'slim';
    showStorformatTab: boolean;
    featuredProductConfig: FeaturedProductConfig;
    categoryTabs: {
        font: string;
        borderRadiusPx: number;
        textColor: string;
        hoverTextColor: string;
        activeTextColor: string;
        bgColor: string;
        hoverBgColor: string;
        activeBgColor: string;
        borderColor: string;
        activeBorderColor: string;
    };
    card: {
        titleFont?: string;
        titleColor?: string;
        bodyFont?: string;
        bodyColor?: string;
        priceFont?: string;
        priceColor?: string;
    };
    button: {
        style: 'default' | 'bar' | 'center' | 'hidden';
        bgColor: string;
        hoverBgColor: string;
        textColor: string;
        hoverTextColor: string;
        font: string;
        animation: 'none' | 'lift' | 'glow' | 'pulse';
    };
    background: {
        type: 'solid' | 'gradient';
        color: string;
        gradientStart: string;
        gradientEnd: string;
        gradientAngle: number;
        opacity: number;
    };
}

const DEFAULT_FEATURED_PRODUCT_CONFIG: FeaturedProductConfig = {
    enabled: false,
    productId: undefined,
    showInProductList: false,
    quantityPresets: [200, 500, 1000, 2500, 5000],
    showOptions: true,
    showPrice: true,
    overlapPx: 45,
    boxScalePct: 80,
    imageScalePct: 100,
    borderRadiusPx: 24,
    position: 'above',
    productSide: 'left',
    imageMode: 'contain',
    cardStyle: 'default',
    customTitle: '',
    customDescription: '',
    backgroundColor: '',
    galleryEnabled: false,
    galleryImages: [],
    galleryIntervalMs: 6000,
    ctaLabel: 'Bestil nu',
    ctaColor: '#0EA5E9',
    ctaTextColor: '#FFFFFF',
    sidePanel: {
        enabled: false,
        mode: 'banner',
        items: [],
        imageUrl: null,
        images: [],
        slideshowIntervalMs: 6000,
        showNavigationArrows: false,
        fadeTransition: true,
        transitionDurationMs: 700,
        borderRadiusPx: 24,
        boxScalePct: 80,
        imageScalePct: 100,
        title: 'Fremhæv din kampagne',
        subtitle: 'Brug denne flade til CTA, billede og ekstra budskab ved siden af det fremhævede produkt.',
        textAnimation: 'slide-up',
        overlayColor: '#000000',
        overlayOpacity: 0.35,
        titleColor: '#FFFFFF',
        subtitleColor: 'rgba(255, 255, 255, 0.9)',
        ctaLabel: 'Læs mere',
        ctaHref: '/shop',
        ctaColor: '#0EA5E9',
        ctaTextColor: '#FFFFFF',
        productId: undefined,
    },
};

// Forside (front page) settings
export interface ForsideSettings {
    showBanner: boolean;
    banner2: Banner2Settings;
    productsSection: ForsideProductsSection;
    contentBlocks: ContentBlock[];  // max 4
}

// Default content block
const DEFAULT_CONTENT_BLOCK: ContentBlock = {
    id: 'block-1',
    enabled: false,
    heading: 'Velkommen til Danmarks Billigste tryksager',
    headingFont: 'Poppins',
    headingColor: '#1F2937',
    text: '',
    textFont: 'Inter',
    textColor: '#4B5563',
    imageUrl: undefined,
    imagePosition: 'left',
    textAlign: 'center',
};

const DEFAULT_BANNER2_ITEM: Banner2Item = {
    id: 'banner2-item-1',
    enabled: true,
    title: 'Logo tekst',
    description: '',
    titleFont: 'Poppins',
    titleColor: '#FFFFFF',
    descriptionFont: 'Inter',
    descriptionColor: '#E5E7EB',
    iconType: 'image',
    iconName: 'Sparkles',
    iconUrl: '',
    groupAnimation: 'fade',
    titleAnimation: 'slide-up',
    descriptionAnimation: 'fade',
    iconAnimation: 'fade',
    linkHref: '',
};

const DEFAULT_BANNER2: Banner2Settings = {
    enabled: false,
    mode: 'cards',
    autoPlay: true,
    showArrows: true,
    showDots: true,
    heading: 'Kunder og referencer',
    subtitle: 'Brug denne flade til at vise logoer, testimonials eller visuelle highlights.',
    headingFont: 'Poppins',
    headingColor: '#FFFFFF',
    subtitleFont: 'Inter',
    subtitleColor: '#E5E7EB',
    itemsPerRow: 4,
    slides: [
        {
            id: 'banner2-slide-1',
            enabled: true,
            durationSeconds: 5,
            items: [DEFAULT_BANNER2_ITEM],
        },
    ],
    background: {
        type: 'gradient',
        color: '#0F172A',
        gradientStart: '#0F172A',
        gradientEnd: '#1E293B',
        gradientAngle: 135,
        animated: false,
        animatedStart: '#0F172A',
        animatedMiddle: '#1E293B',
        animatedEnd: '#334155',
        animatedSpeed: 'slow',
    },
};

// Default forside settings
const DEFAULT_FORSIDE: ForsideSettings = {
    showBanner: true,
    banner2: DEFAULT_BANNER2,
    productsSection: {
        enabled: true,
        columns: 4,
        layoutStyle: 'cards',
        showStorformatTab: true,
        featuredProductConfig: DEFAULT_FEATURED_PRODUCT_CONFIG,
        categoryTabs: {
            font: 'Inter',
            borderRadiusPx: 100,
            textColor: '#1F2937',
            hoverTextColor: '#1F2937',
            activeTextColor: '#FFFFFF',
            bgColor: '#FFFFFF',
            hoverBgColor: '#F8FAFC',
            activeBgColor: '#0EA5E9',
            borderColor: '#E2E8F0',
            activeBorderColor: '#0EA5E9',
        },
        card: {},
        button: {
            style: 'default',
            bgColor: '#0EA5E9',
            hoverBgColor: '#0284C7',
            textColor: '#FFFFFF',
            hoverTextColor: '#FFFFFF',
            font: 'Poppins',
            animation: 'none',
        },
        background: {
            type: 'solid',
            color: '#FFFFFF',
            gradientStart: '#FFFFFF',
            gradientEnd: '#F1F5F9',
            gradientAngle: 135,
            opacity: 1,
        },
    },
    contentBlocks: [DEFAULT_CONTENT_BLOCK],
};

// ============================================================================
// USP STRIP (Unique Selling Points) - Below product cards
// ============================================================================

export type USPIconType = 'truck' | 'award' | 'phone' | 'shield' | 'clock' | 'star' | 'heart' | 'check' | 'custom';

export interface USPItem {
    id: string;
    enabled: boolean;
    icon: USPIconType;
    /** Custom icon URL (PNG/SVG upload) */
    customIconUrl?: string;
    title: string;
    description: string;
}

export interface USPStripSettings {
    enabled: boolean;
    mode: 'standard' | 'animated';
    animation: HeroTextAnimation;
    staggerMs: number;
    /** Solid background color (used if gradient not enabled) */
    backgroundColor: string;
    /** Enable gradient background */
    useGradient: boolean;
    /** Gradient start color */
    gradientFrom: string;
    /** Gradient end color */
    gradientTo: string;
    /** Gradient direction: to-r, to-l, to-t, to-b, to-tr, to-tl, to-br, to-bl */
    gradientDirection: string;
    textColor: string;
    iconColor: string;
    titleColor: string;
    descriptionColor: string;
    titleFont: string;
    descriptionFont: string;
    items: USPItem[];
}

const DEFAULT_USP_STRIP: USPStripSettings = {
    enabled: true,
    mode: "standard",
    animation: "slide-up",
    staggerMs: 120,
    backgroundColor: "#0EA5E9",
    useGradient: false,
    gradientFrom: "#0EA5E9",
    gradientTo: "#6366F1",
    gradientDirection: "to-r",
    textColor: "#FFFFFF",
    iconColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    descriptionColor: "#FFFFFF",
    titleFont: "Poppins",
    descriptionFont: "Inter",
    items: [
        {
            id: "usp-1",
            enabled: true,
            icon: "truck",
            title: "Hurtig levering",
            description: "Express-muligheder til hele Danmark",
        },
        {
            id: "usp-2",
            enabled: true,
            icon: "award",
            title: "Kvalitet til skarpe priser",
            description: "25+ års erfaring med professionelt tryk",
        },
        {
            id: "usp-3",
            enabled: true,
            icon: "phone",
            title: "Personlig rådgivning",
            description: "Tlf: 71 99 11 10",
        },
    ],
};

// ============================================================================
// SEO CONTENT (Below USP strip)
// ============================================================================

export interface SEOContentItem {
    id: string;
    enabled: boolean;
    heading: string;
    text: string;
}

export interface SEOContentSettings {
    enabled: boolean;
    backgroundColor: string;
    items: SEOContentItem[];
}

const DEFAULT_SEO_CONTENT: SEOContentSettings = {
    enabled: true,
    backgroundColor: "", // Empty = use secondary color
    items: [
        {
            id: "1",
            enabled: true,
            heading: "Billige tryksager online",
            text: "Webprinter.dk gør det nemt at bestille flyers, foldere, visitkort og hæfter i høj kvalitet til lave priser. Beregn din pris direkte online og få levering i hele Danmark.",
        },
        {
            id: "2",
            enabled: true,
            heading: "Storformat print til enhver opgave",
            text: "Fra bannere og beachflag til skilte og tekstilprint – vi producerer storformat i topkvalitet. Alt printes med UV-bestandige farver og professionel finish.",
        },
        {
            id: "3",
            enabled: true,
            heading: "Dansk trykkeri med hurtig levering",
            text: "Vi har over 25 års erfaring og leverer både til erhverv og private. Kontakt os i dag og oplev service, kvalitet og konkurrencedygtige priser.",
        },
    ],
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
        backgroundType: "solid" as "solid" | "gradient" | "image",
        backgroundGradientType: "linear" as "linear" | "radial",
        backgroundGradientStart: "#F8FAFC",
        backgroundGradientEnd: "#E2E8F0",
        backgroundGradientUseMiddle: false,
        backgroundGradientMiddle: "#FFFFFF",
        backgroundGradientAngle: 135,
        backgroundImageUrl: null as string | null,
        backgroundImageMode: "cover" as "cover" | "contain" | "repeat",
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
    uspStrip: DEFAULT_USP_STRIP,
    seoContent: DEFAULT_SEO_CONTENT,
    // POD3 (Flyer Alarm) - Feature toggles, OFF by default
    pod3: {
        showOnHomepage: false,  // Toggle to show FA products on homepage
    },
    forside: DEFAULT_FORSIDE,
    navigation: {
        dropdown_images: true,
    },
    productPage: {
        heading: {
            // Custom override text - empty = use product name
            customText: "",
            font: "Poppins",
            sizePx: 36,
            color: "",           // empty = use headingText color
            // Optional bold subtext block below the heading
            subtext: {
                enabled: false,
                text: "",
                font: "Poppins",
                sizePx: 18,
                color: "",       // empty = use bodyText color
            },
        },
        infoSection: {
            // Background box
            bgColor: "",          // empty = use card color
            bgBorderRadius: 12,
            borderColor: "",      // empty = use border color
            borderWidthPx: 0,
            paddingPx: 24,
            // Title style
            titleFont: "",        // empty = inherit heading font
            titleColor: "",       // empty = headingText
            titleSizePx: 22,
            titleWeight: "600" as "400" | "500" | "600" | "700",
            // Body text style
            textFont: "",         // empty = inherit body font
            textColor: "",        // empty = bodyText
            textSizePx: 16,
            lineHeight: 1.6,
            descriptionText: "",  // empty = use product's about_description
            // Image placement: "above" | "below" | "left" | "right" | "corners"
            imagePosition: "above" as "above" | "below" | "left" | "right" | "corners",
            imageUrl: "",         // main product image URL
            imageWidthPct: 40,    // % of row when left or right
            imageCornerSizePx: 80, // size when in corners
            imageBorderRadiusPx: 8,
            // Gallery settings
            galleryEnabled: false,
            galleryPosition: "bottom" as "top" | "bottom" | "left" | "right",
            galleryHeightPx: 200,
            galleryBorderRadiusPx: 8,
            galleryImages: [] as string[],
            galleryIntervalMs: 4500,
            // Section header
            headerText: "Om produktet",
            showHeader: true,
        },
        matrix: {
            font: "Inter",
            headerBg: "#F1F5F9",
            headerText: "#1F2937",
            rowHeaderBg: "#FFFFFF",
            rowHeaderText: "#1F2937",
            cellBg: "#FFFFFF",
            cellText: "#1F2937",
            cellHoverBg: "#F8FAFC",
            cellHoverText: "#1F2937",
            selectedBg: "#0EA5E9",
            selectedText: "#FFFFFF",
            borderColor: "#E2E8F0",
            // Box styling
            boxBackgroundColor: "#FFFFFF",
            boxBorderRadiusPx: 12,
            boxBorderWidthPx: 1,
            boxBorderColor: "#E2E8F0",
            boxPaddingPx: 16,
            // Text button styling (fallback defaults)
            textButtons: {
                backgroundColor: "#FFFFFF",
                hoverBackgroundColor: "#F1F5F9",
                textColor: "#1F2937",
                hoverTextColor: "#0EA5E9",
                selectedBackgroundColor: "#0EA5E9",
                selectedTextColor: "#FFFFFF",
                borderRadiusPx: 8,
                borderWidthPx: 1,
                borderColor: "#E2E8F0",
                hoverBorderColor: "#0EA5E9",
                paddingPx: 12,
                fontSizePx: 14,
                minHeightPx: 44,
            },
            // Picture button styling (extended with new fields)
            pictureButtons: {
                // New display options
                size: "medium" as const,
                displayMode: "text_and_image" as const,
                imageBorderRadiusPx: 8,
                gapBetweenPx: 12,
                // Existing hover effects
                hoverEnabled: true,
                hoverColor: "#0EA5E9",
                hoverOpacity: 0.15,
                selectedColor: "#0EA5E9",
                selectedOpacity: 0.22,
                outlineEnabled: true,
                outlineOpacity: 1,
                hoverZoomEnabled: true,
                hoverZoomScale: 1.03,
                hoverZoomDurationMs: 140,
            },
        },
        pricePanel: {
            backgroundType: "solid",
            backgroundColor: "",
            gradientStart: "",
            gradientEnd: "",
            gradientAngle: 135,
            titleColor: "",
            textColor: "",
            mutedTextColor: "",
            priceColor: "",
            borderColor: "",
            borderWidth: 2,
            radiusPx: 12,
            dividerColor: "",
            optionBg: "",
            optionHoverBg: "",
            optionSelectedBg: "",
            optionBorderColor: "",
            optionHoverBorderColor: "",
            optionSelectedBorderColor: "",
            badgeBg: "",
            badgeText: "",
            badgeBorderColor: "",
        },
        orderButtons: {
            font: "Inter",
            animation: "none",
            primary: {
                bgColor: "",
                hoverBgColor: "",
                textColor: "",
                hoverTextColor: "",
                borderColor: "",
                hoverBorderColor: "",
            },
            secondary: {
                bgColor: "",
                hoverBgColor: "",
                textColor: "",
                hoverTextColor: "",
                borderColor: "",
                hoverBorderColor: "",
            },
            selected: {
                bgColor: "#16A34A",
                hoverBgColor: "#15803D",
                textColor: "#FFFFFF",
                hoverTextColor: "#FFFFFF",
                borderColor: "#16A34A",
                hoverBorderColor: "#15803D",
            },
        },
        // Option selector styling (DynamicProductOptions component)
        optionSelectors: {
            // Text/button pills display type
            button: {
                bgColor: "",              // empty = muted
                textColor: "",            // empty = foreground
                selectedBgColor: "",      // empty = primary
                selectedTextColor: "",    // empty = white
                hoverBgColor: "",         // empty = muted/darker
                hoverTextColor: "",       // empty = primary
                borderRadius: 8,
                borderColor: "",          // empty = no border
                borderWidth: 1,
                selectedRingColor: "",    // empty = primary
                hoverRingEnabled: false,
                paddingPx: 12,
                fontSizePx: 14,
            },
            // Image/icon grid display type
            image: {
                sizePx: 144,
                borderRadius: 8,
                bgColor: "",
                selectedBgColor: "",
                hoverBgColor: "",
                selectedRingColor: "",    // empty = primary
                hoverRingEnabled: true,
                hoverRingColor: "",       // empty = primary
                labelColor: "",
                labelSizePx: 14,
            },
            // Dropdown select display type
            dropdown: {
                bgColor: "",
                textColor: "",
                borderColor: "",
                borderRadius: 6,
            },
            // Checkbox display type
            checkbox: {
                accentColor: "",
                labelColor: "",
                labelSizePx: 14,
            },
        },
    },
    // Product Images & Icons
    productImages: {
        setId: 'default',
        hueRotate: 0,
        saturate: 100,
    },
    // Theme selection (Site Designer V2)
    themeId: 'classic',
    themeSettings: {} as Record<string, unknown>,
    selectedIconPackId: "classic",
    // Favicon (browser tab icon)
    favicon: {
        type: 'preset' as 'preset' | 'custom',  // 'preset' = built-in icon, 'custom' = uploaded
        presetId: 'default',                     // ID of the preset icon
        presetColor: '#0EA5E9',                  // Color for preset icons
        customUrl: null as string | null,        // URL to custom uploaded .ico file
    },
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
    DEFAULT_USP_STRIP,
    DEFAULT_SEO_CONTENT,
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

    // Deep merge USP Strip
    if (data.uspStrip) {
        merged.uspStrip = {
            ...DEFAULT_BRANDING.uspStrip,
            ...data.uspStrip,
            items: data.uspStrip.items || DEFAULT_BRANDING.uspStrip.items,
        };
    }

    // Deep merge SEO Content
    if (data.seoContent) {
        merged.seoContent = {
            ...DEFAULT_BRANDING.seoContent,
            ...data.seoContent,
            items: data.seoContent.items || DEFAULT_BRANDING.seoContent.items,
        };
    }

    // Deep merge Hero
    if (data.hero) {
        merged.hero = {
            ...DEFAULT_BRANDING.hero,
            ...data.hero,
            // Prioritize the images array if it exists (even if empty)
            images: (data.hero.images !== undefined)
                ? data.hero.images
                : (data.hero.media && data.hero.media.length > 0)
                    ? data.hero.media.map((url: string, i: number) => ({ id: `migrated-${i}`, url, sortOrder: i }))
                    : (data.hero.images === undefined ? DEFAULT_BRANDING.hero.images : []),
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
            banner2: {
                ...DEFAULT_BRANDING.forside.banner2,
                ...(data.forside.banner2 || {}),
                background: {
                    ...DEFAULT_BRANDING.forside.banner2.background,
                    ...(data.forside.banner2?.background || {}),
                },
                slides: data.forside.banner2?.slides || DEFAULT_BRANDING.forside.banner2.slides,
            },
            contentBlocks: data.forside.contentBlocks || DEFAULT_BRANDING.forside.contentBlocks,
            productsSection: {
                ...DEFAULT_BRANDING.forside.productsSection,
                ...(data.forside.productsSection || {}),
                featuredProductConfig: {
                    ...DEFAULT_BRANDING.forside.productsSection.featuredProductConfig,
                    ...(data.forside.productsSection?.featuredProductConfig || {}),
                    sidePanel: {
                        ...DEFAULT_BRANDING.forside.productsSection.featuredProductConfig.sidePanel,
                        ...(data.forside.productsSection?.featuredProductConfig?.sidePanel || {}),
                    },
                },
                button: {
                    ...DEFAULT_BRANDING.forside.productsSection.button,
                    ...(data.forside.productsSection?.button || {}),
                },
                categoryTabs: {
                    ...DEFAULT_BRANDING.forside.productsSection.categoryTabs,
                    ...(data.forside.productsSection?.categoryTabs || {}),
                },
                card: {
                    ...DEFAULT_BRANDING.forside.productsSection.card,
                    ...(data.forside.productsSection?.card || {}),
                },
                background: {
                    ...DEFAULT_BRANDING.forside.productsSection.background,
                    ...(data.forside.productsSection?.background || {}),
                },
            },
        };
    }

    if (data.productPage) {
        merged.productPage = {
            ...DEFAULT_BRANDING.productPage,
            ...data.productPage,
            heading: {
                ...DEFAULT_BRANDING.productPage.heading,
                ...(data.productPage?.heading || {}),
                subtext: {
                    ...DEFAULT_BRANDING.productPage.heading.subtext,
                    ...(data.productPage?.heading?.subtext || {}),
                },
            },
            infoSection: {
                ...DEFAULT_BRANDING.productPage.infoSection,
                ...(data.productPage?.infoSection || {}),
            },
            matrix: {
                ...DEFAULT_BRANDING.productPage.matrix,
                ...(data.productPage?.matrix || {}),
                pictureButtons: {
                    ...DEFAULT_BRANDING.productPage.matrix.pictureButtons,
                    ...(data.productPage?.matrix?.pictureButtons || {}),
                },
            },
            pricePanel: {
                ...DEFAULT_BRANDING.productPage.pricePanel,
                ...(data.productPage?.pricePanel || {}),
            },
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
            optionSelectors: {
                ...DEFAULT_BRANDING.productPage.optionSelectors,
                ...(data.productPage?.optionSelectors || {}),
                button: {
                    ...DEFAULT_BRANDING.productPage.optionSelectors.button,
                    ...(data.productPage?.optionSelectors?.button || {}),
                },
                image: {
                    ...DEFAULT_BRANDING.productPage.optionSelectors.image,
                    ...(data.productPage?.optionSelectors?.image || {}),
                },
                dropdown: {
                    ...DEFAULT_BRANDING.productPage.optionSelectors.dropdown,
                    ...(data.productPage?.optionSelectors?.dropdown || {}),
                },
                checkbox: {
                    ...DEFAULT_BRANDING.productPage.optionSelectors.checkbox,
                    ...(data.productPage?.optionSelectors?.checkbox || {}),
                },
            },
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
        writeTransientString(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
        console.warn('Failed to save draft to transient storage:', e);
    }
}

// Helper to load draft from localStorage
function loadDraftFromStorage(): BrandingData | null {
    try {
        const stored = readTransientString(DRAFT_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load draft from transient storage:', e);
    }
    return null;
}

// Helper to clear draft from localStorage
function clearDraftStorage() {
    try {
        removeTransientKey(DRAFT_STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear draft from transient storage:', e);
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
                banner2: partial.forside.banner2
                    ? {
                        ...prev.forside.banner2,
                        ...partial.forside.banner2,
                        background: partial.forside.banner2.background
                            ? { ...prev.forside.banner2.background, ...partial.forside.banner2.background }
                            : prev.forside.banner2.background,
                        slides: partial.forside.banner2.slides ?? prev.forside.banner2.slides,
                    }
                    : prev.forside.banner2,
                contentBlocks: partial.forside.contentBlocks ?? prev.forside.contentBlocks,
                productsSection: partial.forside.productsSection
                    ? { ...prev.forside.productsSection, ...partial.forside.productsSection }
                    : prev.forside.productsSection,
            } : prev.forside;

            const newProductPage = partial.productPage ? {
                ...prev.productPage,
                ...partial.productPage,
                heading: partial.productPage.heading
                    ? {
                        ...prev.productPage.heading,
                        ...partial.productPage.heading,
                        subtext: partial.productPage.heading.subtext
                            ? {
                                ...prev.productPage.heading.subtext,
                                ...partial.productPage.heading.subtext,
                            }
                            : prev.productPage.heading.subtext,
                    }
                    : prev.productPage.heading,
                infoSection: partial.productPage.infoSection
                    ? { ...prev.productPage.infoSection, ...partial.productPage.infoSection }
                    : prev.productPage.infoSection,
                matrix: partial.productPage.matrix
                    ? {
                        ...prev.productPage.matrix,
                        ...partial.productPage.matrix,
                        pictureButtons: partial.productPage.matrix.pictureButtons
                            ? {
                                ...prev.productPage.matrix.pictureButtons,
                                ...partial.productPage.matrix.pictureButtons,
                            }
                            : prev.productPage.matrix.pictureButtons,
                    }
                    : prev.productPage.matrix,
                pricePanel: partial.productPage.pricePanel
                    ? {
                        ...prev.productPage.pricePanel,
                        ...partial.productPage.pricePanel,
                    }
                    : prev.productPage.pricePanel,
                orderButtons: partial.productPage.orderButtons
                    ? {
                        ...prev.productPage.orderButtons,
                        ...partial.productPage.orderButtons,
                        primary: partial.productPage.orderButtons.primary
                            ? {
                                ...prev.productPage.orderButtons.primary,
                                ...partial.productPage.orderButtons.primary,
                            }
                            : prev.productPage.orderButtons.primary,
                        secondary: partial.productPage.orderButtons.secondary
                            ? {
                                ...prev.productPage.orderButtons.secondary,
                                ...partial.productPage.orderButtons.secondary,
                            }
                            : prev.productPage.orderButtons.secondary,
                        selected: partial.productPage.orderButtons.selected
                            ? {
                                ...prev.productPage.orderButtons.selected,
                                ...partial.productPage.orderButtons.selected,
                            }
                            : prev.productPage.orderButtons.selected,
                    }
                    : prev.productPage.orderButtons,
                optionSelectors: (partial.productPage as any).optionSelectors
                    ? {
                        ...(prev.productPage as any).optionSelectors,
                        ...(partial.productPage as any).optionSelectors,
                        button: (partial.productPage as any).optionSelectors?.button
                            ? { ...(prev.productPage as any).optionSelectors?.button, ...(partial.productPage as any).optionSelectors.button }
                            : (prev.productPage as any).optionSelectors?.button,
                        image: (partial.productPage as any).optionSelectors?.image
                            ? { ...(prev.productPage as any).optionSelectors?.image, ...(partial.productPage as any).optionSelectors.image }
                            : (prev.productPage as any).optionSelectors?.image,
                        dropdown: (partial.productPage as any).optionSelectors?.dropdown
                            ? { ...(prev.productPage as any).optionSelectors?.dropdown, ...(partial.productPage as any).optionSelectors.dropdown }
                            : (prev.productPage as any).optionSelectors?.dropdown,
                        checkbox: (partial.productPage as any).optionSelectors?.checkbox
                            ? { ...(prev.productPage as any).optionSelectors?.checkbox, ...(partial.productPage as any).optionSelectors.checkbox }
                            : (prev.productPage as any).optionSelectors?.checkbox,
                    }
                    : (prev.productPage as any).optionSelectors,
            } : prev.productPage;

            return {
                ...prev,
                ...partial,
                fonts: { ...prev.fonts, ...(partial.fonts || {}) },
                colors: { ...prev.colors, ...(partial.colors || {}) },
                hero: newHero,
                header: newHeader,
                footer: newFooter,
                forside: newForside,
                productPage: newProductPage,
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
