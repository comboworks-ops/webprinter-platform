import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

// Dropdown image size (for IMAGE_ONLY and IMAGE_AND_TEXT modes)
export type HeaderDropdownImageSize = 'normal' | 'large' | 'xl';

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

export interface BrandingPage {
    id: string;
    title: string;
    path: string;
    type: 'page' | 'subpage';
    parentPath?: string | null;
    createdAt?: string;
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
    dropdownImageSize: HeaderDropdownImageSize;  // Size of product images in dropdown (normal, large, xl)

    // Styling
    fontId: string;
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

    // Category headers (Tryksager, Storformat, etc.)
    dropdownCategoryFontId: string;    // Category header font
    dropdownCategoryColor: string;     // Category header color

    // Product names
    dropdownProductFontId: string;     // Product name font
    dropdownProductColor: string;      // Product name color

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
    dropdownImageSize: 'normal',     // Default size for product images in dropdown
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
    dropdownCategoryFontId: 'Inter',
    dropdownCategoryColor: '#6B7280',  // Slightly muted for category headers
    dropdownProductFontId: 'Inter',
    dropdownProductColor: '#1F2937',   // Dark color for product names
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
export type FooterBackgroundType = 'themeDark' | 'themeLight' | 'solid' | 'gradient';

// Contact page settings
export type ContactMapPlacement = 'inline' | 'fullWidth' | 'hidden';

export interface ContactMapSettings {
    enabled: boolean;
    imageUrl: string;
    placement: ContactMapPlacement;
    boxBackground: string;
    boxBorderColor: string;
}

export interface ContactFormBoxSettings {
    enabled: boolean;
    backgroundColor: string;
    borderColor: string;
}

export interface ContactInfoOverrides {
    phone: string;
    email: string;
    name: string;
    address: string;
    cvr: string;
}

export interface ContactPageSettings {
    headingFont: string;
    bodyFont: string;
    formFont: string;
    headingColor: string;
    bodyTextColor: string;
    formTextColor: string;
    backgroundEnabled: boolean;
    backgroundColor: string;
    infoBoxBackground: string;
    infoBoxTextColor: string;
    infoBoxBorderColor: string;
    formBox: ContactFormBoxSettings;
    map: ContactMapSettings;
    formRecipientEmail: string;
    contactInfo: ContactInfoOverrides;
}

export type AboutMediaType = 'none' | 'single' | 'gallery';
export type AboutMediaPosition = 'above' | 'left' | 'right';
export type AboutGalleryLayout = 'grid' | 'masonry' | 'carousel' | 'stacked';
export type AboutMediaStyle = 'plain' | 'rounded' | 'shadow' | 'border';

export interface AboutMediaSettings {
    type: AboutMediaType;
    position: AboutMediaPosition;
    imageUrl: string;
    gallery: string[];
    galleryLayout: AboutGalleryLayout;
    imageStyle: AboutMediaStyle;
}

export interface AboutFeatureItem {
    id: string;
    title: string;
    description: string;
    iconType: 'icon' | 'image';
    iconName: string;
    imageUrl?: string;
    linkUrl?: string;
    openInNewTab?: boolean;
}

export interface AboutFeaturesSettings {
    enabled: boolean;
    cardBackground: string;
    cardTextColor: string;
    hoverBackground: string;
    hoverTextColor: string;
    hoverEffect: 'none' | 'lift' | 'shadow' | 'glow';
    items: AboutFeatureItem[];
}

export interface AboutPageSettings {
    title: string;
    description: string;
    textAlign: 'left' | 'center' | 'right';
    media: AboutMediaSettings;
    features: AboutFeaturesSettings;
}

// Complete footer settings
export interface FooterSettings {
    style: FooterStyleType;
    background: FooterBackgroundType;
    bgColor: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientAngle?: number;
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
    gradientStart: '#1F2937',
    gradientEnd: '#0F172A',
    gradientAngle: 135,
    text: 'Din professionelle tryksagspartner.',
    copyrightText: '© {year} {shopName}. Alle rettigheder forbeholdes.',
    showCopyright: true,
    links: DEFAULT_FOOTER_LINKS,
    social: DEFAULT_FOOTER_SOCIAL,
    showSocialIcons: true,
};

const DEFAULT_CONTACT_PAGE: ContactPageSettings = {
    headingFont: 'Poppins',
    bodyFont: 'Inter',
    formFont: 'Inter',
    headingColor: '#1F2937',
    bodyTextColor: '#4B5563',
    formTextColor: '#1F2937',
    backgroundEnabled: false,
    backgroundColor: '#F8FAFC',
    infoBoxBackground: '#F1F5F9',
    infoBoxTextColor: '#1F2937',
    infoBoxBorderColor: '#E2E8F0',
    formBox: {
        enabled: false,
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
    },
    map: {
        enabled: false,
        imageUrl: '',
        placement: 'inline',
        boxBackground: '#F1F5F9',
        boxBorderColor: '#E2E8F0',
    },
    formRecipientEmail: '',
    contactInfo: {
        phone: '',
        email: '',
        name: '',
        address: '',
        cvr: '',
    },
};

const DEFAULT_ABOUT_FEATURE_ITEMS: AboutFeatureItem[] = [
    {
        id: 'about-feature-1',
        title: 'Kvalitet',
        description: 'Topkvalitet i alle vores produkter med moderne printteknik',
        iconType: 'icon',
        iconName: 'award',
        linkUrl: '',
        openInNewTab: false,
    },
    {
        id: 'about-feature-2',
        title: 'Personlig rådgivning',
        description: 'Eksperter der hjælper dig med at vælge den rigtige løsning',
        iconType: 'icon',
        iconName: 'users',
        linkUrl: '',
        openInNewTab: false,
    },
    {
        id: 'about-feature-3',
        title: 'Bæredygtighed',
        description: 'Vi tager ansvar for miljøet i vores produktion',
        iconType: 'icon',
        iconName: 'leaf',
        linkUrl: '',
        openInNewTab: false,
    },
    {
        id: 'about-feature-4',
        title: 'Levering til tiden',
        description: 'Hurtig behandling og præcise leveringstider',
        iconType: 'icon',
        iconName: 'clock',
        linkUrl: '',
        openInNewTab: false,
    },
];

const DEFAULT_ABOUT_PAGE: AboutPageSettings = {
    title: 'Hvem er Webprinter.dk',
    description:
        'Vi er specialister i tryksager – fra visitkort til bannere. Hos Webprinter.dk kombinerer vi moderne produktion med klassisk håndværk og personlig service. Vi leverer til hele Danmark – hurtigt og konkurrencedygtigt.',
    textAlign: 'center',
    media: {
        type: 'none',
        position: 'above',
        imageUrl: '',
        gallery: [],
        galleryLayout: 'grid',
        imageStyle: 'rounded',
    },
    features: {
        enabled: true,
        cardBackground: '#0EA5E9',
        cardTextColor: '#FFFFFF',
        hoverBackground: '#0284C7',
        hoverTextColor: '#FFFFFF',
        hoverEffect: 'lift',
        items: DEFAULT_ABOUT_FEATURE_ITEMS,
    },
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
    gallery?: string[];
    mediaType?: 'single' | 'gallery';
    imagePosition: 'left' | 'right';
    textAlign: 'left' | 'center' | 'right';
    placement?: 'above_products' | 'below_products';
    cta?: {
        enabled: boolean;
        label: string;
        href: string;
        bgColor: string;
        textColor: string;
        hoverBgColor: string;
        hoverTextColor: string;
        font: string;
        style: 'solid' | 'outline';
        size: 'sm' | 'md' | 'lg';

    };
}

export type Banner2Animation = HeroTextAnimation;

export type Banner2IconType = 'icon' | 'image' | 'none';

export interface Banner2Item {
    id: string;
    enabled: boolean;
    title: string;
    description: string;
    titleFont?: string;
    titleColor?: string;
    descriptionFont?: string;
    descriptionColor?: string;
    iconType: Banner2IconType;
    iconName?: string;
    iconUrl?: string;
    groupAnimation?: Banner2Animation;
    titleAnimation?: Banner2Animation;
    descriptionAnimation?: Banner2Animation;
    iconAnimation?: Banner2Animation;
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
    animatedSpeed: 'slow' | 'slower';
    animatedStart: string;
    animatedMiddle: string;
    animatedEnd: string;
}

export interface Banner2Settings {
    enabled: boolean;
    autoPlay: boolean;
    showArrows: boolean;
    showDots: boolean;
    slides: Banner2Slide[];
    background: Banner2BackgroundSettings;
}

export type InfoMediaType = 'none' | 'single' | 'gallery';
export type InfoMediaAlign = 'left' | 'right' | 'center';

export interface LowerInfoItem {
    id: string;
    enabled: boolean;
    title: string;
    description: string;
    titleFont?: string;
    titleColor?: string;
    descriptionFont?: string;
    descriptionColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    mediaType: InfoMediaType;
    imageUrl?: string;
    gallery?: string[];
    mediaAlign: InfoMediaAlign;
}

export interface LowerInfoBackgroundSettings {
    type: 'solid' | 'gradient';
    color: string;
    gradientStart: string;
    gradientEnd: string;
    gradientAngle: number;
}

export interface LowerInfoSettings {
    enabled: boolean;
    items: LowerInfoItem[];
    background: LowerInfoBackgroundSettings;
    layout: 'grid' | 'stacked';
}

export interface PageExtrasSettings {
    contentBlocks: ContentBlock[];
    lowerInfo: LowerInfoSettings;
}

export interface PageExtrasByPage {
    about: PageExtrasSettings;
    contact: PageExtrasSettings;
    grafisk: PageExtrasSettings;
    product: PageExtrasSettings;
}

// Featured Product Quick Configurator settings
export interface FeaturedProductConfig {
    enabled: boolean;
    productId: string | null;        // UUID of featured product
    productSlug: string | null;      // For linking to product page
    quantityPresets: number[];       // e.g., [200, 500, 1000, 2500, 5000]
    overlapPx: number;               // Hero overlap (0-120px)
    showOptions: boolean;            // Show option buttons
    showPrice: boolean;              // Show price badge
    cardStyle: 'solid' | 'glass';    // Visual style
    pricePosition: 'top-right' | 'bottom-right' | 'bottom-left';
    ctaLabel: string;                // Button text
    ctaColor: string;                // Button color
    ctaTextColor: string;
}

export interface ForsideProductsSection {
    enabled: boolean;
    columns: 3 | 4 | 5;
    layoutStyle: 'cards' | 'flat' | 'grouped' | 'slim';
    showStorformatTab: boolean;
    featuredProduct?: FeaturedProductConfig;  // Featured product quick configurator
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

// Forside (front page) settings
export interface ForsideSettings {
    showBanner: boolean;
    productsSection: ForsideProductsSection;
    contentBlocks: ContentBlock[];  // max 4
    banner2: Banner2Settings;
    lowerInfo: LowerInfoSettings;
}

export interface ProductPageOrderButtonStyle {
    bgColor: string;
    hoverBgColor: string;
    textColor: string;
    hoverTextColor: string;
    borderColor?: string;
    hoverBorderColor?: string;
}

export interface ProductPageOrderButtons {
    font: string;
    animation: 'none' | 'lift' | 'glow' | 'pulse';
    primary: ProductPageOrderButtonStyle;
    secondary: ProductPageOrderButtonStyle;
    selected: ProductPageOrderButtonStyle;
}

export interface ProductPageSettings {
    orderButtons: ProductPageOrderButtons;
    matrix: {
        font: string;
        headerBg: string;
        headerText: string;
        rowHeaderBg: string;
        rowHeaderText: string;
        cellBg: string;
        cellText: string;
        cellHoverBg: string;
        cellHoverText: string;
        selectedBg: string;
        selectedText: string;
        borderColor: string;
    };
}

export interface GrafiskVejledningHeaderSettings {
    headerLabel: string;
    title: string;
    description: string;
}

export interface GrafiskVejledningChecklistSettings {
    title: string;
    items: string[];
}

export interface GrafiskVejledningTocItem {
    id: string;
    label: string;
    anchor: string;
    images: string[];
}

export interface GrafiskVejledningTocSettings {
    title: string;
    font: string;
    boxBackground: string;
    boxTextColor: string;
    items: GrafiskVejledningTocItem[];
}

export interface GrafiskVejledningSettings {
    header: GrafiskVejledningHeaderSettings;
    checklist: GrafiskVejledningChecklistSettings;
    toc: GrafiskVejledningTocSettings;
}

// Default content block CTA
const DEFAULT_CONTENT_BLOCK_CTA = {
    enabled: false,
    label: '',
    href: '',
    bgColor: '#0EA5E9',
    textColor: '#FFFFFF',
    hoverBgColor: '#0284C7',
    hoverTextColor: '#FFFFFF',
    font: 'Poppins',
    style: 'solid' as const,
    size: 'md' as const,
};

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
    gallery: [],
    mediaType: 'single',
    imagePosition: 'left',
    textAlign: 'center',
    placement: 'below_products',
    cta: DEFAULT_CONTENT_BLOCK_CTA,
};

const DEFAULT_BANNER2_ITEM_BASE: Banner2Item = {
    id: 'banner2-item-1',
    enabled: true,
    title: '',
    description: '',
    titleFont: 'Poppins',
    titleColor: '#FFFFFF',
    descriptionFont: 'Inter',
    descriptionColor: '#E5E7EB',
    iconType: 'icon',
    iconName: 'Truck',
    iconUrl: undefined,
    groupAnimation: 'none',
    titleAnimation: 'none',
    descriptionAnimation: 'none',
    iconAnimation: 'none',
};

const DEFAULT_BANNER2_ITEMS: Banner2Item[] = [
    {
        ...DEFAULT_BANNER2_ITEM_BASE,
        id: 'banner2-item-1',
        title: 'Hurtig levering',
        description: 'Express-muligheder til hele Danmark',
        iconName: 'Truck',
    },
    {
        ...DEFAULT_BANNER2_ITEM_BASE,
        id: 'banner2-item-2',
        title: 'Kvalitet til skarpe priser',
        description: '25+ års erfaring med professionelt tryk',
        iconName: 'Award',
    },
    {
        ...DEFAULT_BANNER2_ITEM_BASE,
        id: 'banner2-item-3',
        title: 'Personlig rådgivning',
        description: 'Tlf: 71 99 11 10',
        iconName: 'Phone',
    },
];

const DEFAULT_BANNER2_SLIDE: Banner2Slide = {
    id: 'banner2-slide-1',
    enabled: true,
    durationSeconds: 5,
    items: DEFAULT_BANNER2_ITEMS,
};

const DEFAULT_BANNER2: Banner2Settings = {
    enabled: true,
    autoPlay: false,
    showArrows: true,
    showDots: true,
    slides: [DEFAULT_BANNER2_SLIDE],
    background: {
        type: 'solid',
        color: '#0EA5E9',
        gradientStart: '#0EA5E9',
        gradientEnd: '#0284C7',
        gradientAngle: 135,
        animated: false,
        animatedSpeed: 'slow',
        animatedStart: '#0EA5E9',
        animatedMiddle: '#38BDF8',
        animatedEnd: '#0284C7',
    },
};

const DEFAULT_LOWER_INFO_ITEMS: LowerInfoItem[] = [
    {
        id: 'lower-info-1',
        enabled: true,
        title: 'Billige tryksager online',
        description: 'Webprinter.dk gør det nemt at bestille flyers, foldere, visitkort og hæfter i høj kvalitet til lave priser. Beregn din pris direkte online og få levering i hele Danmark.',
        titleFont: 'Poppins',
        titleColor: '#1F2937',
        descriptionFont: 'Inter',
        descriptionColor: '#4B5563',
        mediaType: 'none',
        mediaAlign: 'center',
        textAlign: 'center',
        gallery: [],
    },
    {
        id: 'lower-info-2',
        enabled: true,
        title: 'Storformat print til enhver opgave',
        description: 'Fra bannere og beachflag til skilte og tekstilprint – vi producerer storformat i topkvalitet. Alt printes med UV-bestandige farver og professionel finish.',
        titleFont: 'Poppins',
        titleColor: '#1F2937',
        descriptionFont: 'Inter',
        descriptionColor: '#4B5563',
        mediaType: 'none',
        mediaAlign: 'center',
        textAlign: 'center',
        gallery: [],
    },
    {
        id: 'lower-info-3',
        enabled: true,
        title: 'Dansk trykkeri med hurtig levering',
        description: 'Vi har over 25 års erfaring og leverer både til erhverv og private. Kontakt os i dag og oplev service, kvalitet og konkurrencedygtige priser.',
        titleFont: 'Poppins',
        titleColor: '#1F2937',
        descriptionFont: 'Inter',
        descriptionColor: '#4B5563',
        mediaType: 'none',
        mediaAlign: 'center',
        textAlign: 'center',
        gallery: [],
    },
];

const DEFAULT_LOWER_INFO: LowerInfoSettings = {
    enabled: true,
    items: DEFAULT_LOWER_INFO_ITEMS,
    layout: 'grid',
    background: {
        type: 'solid',
        color: '#F8FAFC',
        gradientStart: '#F8FAFC',
        gradientEnd: '#E2E8F0',
        gradientAngle: 135,
    },
};

const createPageExtrasDefaults = (): PageExtrasSettings => ({
    contentBlocks: [],
    lowerInfo: {
        ...DEFAULT_LOWER_INFO,
        enabled: false,
        items: [],
    },
});

// Default featured product config
const DEFAULT_FEATURED_PRODUCT: FeaturedProductConfig = {
    enabled: false,
    productId: null,
    productSlug: null,
    quantityPresets: [200, 500, 1000, 2500, 5000],
    overlapPx: 200,
    showOptions: true,
    showPrice: true,
    cardStyle: 'solid',
    pricePosition: 'top-right',
    ctaLabel: 'Bestil nu',
    ctaColor: '#0EA5E9',
    ctaTextColor: '#FFFFFF',
};

// Default forside settings
const DEFAULT_FORSIDE: ForsideSettings = {
    showBanner: true,
    productsSection: {
        enabled: true,
        columns: 4,
        layoutStyle: 'cards',
        showStorformatTab: true,
        featuredProduct: DEFAULT_FEATURED_PRODUCT,
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
    banner2: DEFAULT_BANNER2,
    lowerInfo: DEFAULT_LOWER_INFO,
};

const DEFAULT_PRODUCT_PAGE: ProductPageSettings = {
    orderButtons: {
        font: 'Inter',
        animation: 'none',
        primary: {
            bgColor: '#0EA5E9',
            hoverBgColor: '#0284C7',
            textColor: '#FFFFFF',
            hoverTextColor: '#FFFFFF',
        },
        secondary: {
            bgColor: '#FFFFFF',
            hoverBgColor: '#F1F5F9',
            textColor: '#1F2937',
            hoverTextColor: '#1F2937',
            borderColor: '#E2E8F0',
            hoverBorderColor: '#CBD5E1',
        },
        selected: {
            bgColor: '#16A34A',
            hoverBgColor: '#15803D',
            textColor: '#FFFFFF',
            hoverTextColor: '#FFFFFF',
        },
    },
    matrix: {
        font: 'Inter',
        headerBg: '#F1F5F9',
        headerText: '#1F2937',
        rowHeaderBg: '#FFFFFF',
        rowHeaderText: '#1F2937',
        cellBg: '#FFFFFF',
        cellText: '#1F2937',
        cellHoverBg: '#E2E8F0',
        cellHoverText: '#1F2937',
        selectedBg: '#0EA5E9',
        selectedText: '#FFFFFF',
        borderColor: '#E2E8F0',
    },
};

const DEFAULT_GRAFISK_VEJLEDNING: GrafiskVejledningSettings = {
    header: {
        headerLabel: '',
        title: 'Grafisk Vejledning',
        description: 'Alt du skal vide for at levere korrekte trykfiler – fra offsettryk til storformat, spotlak, folie og konturskæring.',
    },
    checklist: {
        title: 'Hurtig Tjekliste – Før du sender',
        items: [
            'PDF-format (helst PDF/X-4)',
            'Korrekt færdigt format + beskæring (bleed)',
            'CMYK farverum (ikke RGB til offsettryk)',
            'Korrekt opløsning (offset vs storformat)',
            'Skrifttyper indlejret eller konverteret til kurver',
            'Billeder indlejret/linket korrekt',
            'Én fil = ét job med korrekt sideantal',
            'Filnavn + ordrereference',
        ],
    },
    toc: {
        title: 'Indholdsfortegnelse',
        font: 'Inter',
        boxBackground: '#F1F5F9',
        boxTextColor: '#1F2937',
        items: [
            { id: 'toc-offsettryk', label: 'Offsettryk (flyers, foldere, plakater)', anchor: 'offsettryk', images: [] },
            { id: 'toc-cmyk-rgb', label: 'CMYK vs RGB + farveforventninger', anchor: 'cmyk-rgb', images: [] },
            { id: 'toc-storformat', label: 'Storformat / Wide-format', anchor: 'storformat', images: [] },
            { id: 'toc-efterbehandling', label: 'Efterbehandling af bannere', anchor: 'efterbehandling', images: [] },
            { id: 'toc-spotlak', label: 'Specielle Effekter (Spotlak, Folie, CutContour, Hvidt Blæk)', anchor: 'spotlak', images: [] },
            { id: 'toc-trykmetoder', label: 'Silketryk vs Digitaltryk', anchor: 'trykmetoder', images: [] },
            { id: 'toc-tekstiltryk', label: 'Tekstiltryk: DTG & DTF', anchor: 'tekstiltryk', images: [] },
            { id: 'toc-pdf-eksport', label: 'PDF-eksport guide', anchor: 'pdf-eksport', images: [] },
            { id: 'toc-skabeloner', label: 'Skabeloner (PDF)', anchor: 'skabeloner', images: [] },
            { id: 'toc-kontakt', label: 'Support & Kontakt', anchor: 'kontakt', images: [] },
        ],
    },
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
        title: "Poppins",
        subtitle: "Poppins",
        description: "Inter",
        system: "Inter",
        button: "Inter",
    },
    colors: {
        primary: "#0EA5E9",
        secondary: "#F1F5F9",
        background: "#F8FAFC",
        card: "#FFFFFF",
        dropdown: "#FFFFFF",
        hover: "#0284C7",
        backgroundType: "solid",
        backgroundGradientType: "linear",
        backgroundGradientStart: "#F8FAFC",
        backgroundGradientEnd: "#E2E8F0",
        backgroundGradientAngle: 135,
        backgroundGradientUseMiddle: false,
        backgroundGradientMiddle: "#FFFFFF",
        // Typography colors
        titleText: "#1F2937",
        subtitleText: "#1F2937",
        headingText: "#1F2937",
        bodyText: "#4B5563",
        pricingText: "#0EA5E9",
        linkText: "#0EA5E9",
        systemText: "#1F2937",
        buttonText: "#FFFFFF",
        tabInactiveBg: "#F1F5F9",
        tabInactiveHoverBg: "#E2E8F0",
        tabActiveHoverBg: "#0284C7",
    },
    // Saved color swatches (max 20)
    savedSwatches: [] as string[],
    hero: DEFAULT_HERO,
    header: DEFAULT_HEADER,
    footer: DEFAULT_FOOTER,
    contactPage: DEFAULT_CONTACT_PAGE,
    aboutPage: DEFAULT_ABOUT_PAGE,
    forside: DEFAULT_FORSIDE,
    productPage: DEFAULT_PRODUCT_PAGE,
    grafiskVejledning: DEFAULT_GRAFISK_VEJLEDNING,
    navigation: {
        dropdown_images: true,
    },
    pageExtras: {
        about: createPageExtrasDefaults(),
        contact: createPageExtrasDefaults(),
        grafisk: createPageExtrasDefaults(),
        product: createPageExtrasDefaults(),
    },
    pages: {
        items: [] as BrandingPage[],
    },
    // Product Images & Icons
    productImages: {
        setId: 'default',
        hueRotate: 0,
        saturate: 100,
    },
    selectedIconPackId: "classic",
    // Favicon (browser tab icon)
    favicon: {
        type: 'preset' as 'preset' | 'custom',  // 'preset' = built-in icon, 'custom' = uploaded
        presetId: 'default',                     // ID of the preset icon
        presetColor: '#0EA5E9',                  // Color for preset icons
        customUrl: null as string | null,        // URL to custom uploaded .ico file
    },
    // Theme System
    themeId: 'classic' as string,                // Selected theme ID
    themeSettings: {} as Record<string, unknown>, // Theme-specific settings
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
    DEFAULT_CONTACT_PAGE,
    DEFAULT_FORSIDE,
    DEFAULT_FEATURED_PRODUCT,
};


const normalizeContentBlock = (block: ContentBlock): ContentBlock => {
    const merged = {
        ...DEFAULT_CONTENT_BLOCK,
        ...block,
        cta: { ...DEFAULT_CONTENT_BLOCK_CTA, ...(block.cta || {}) },
        gallery: block.gallery || [],
    };

    const inferredMediaType =
        merged.mediaType ||
        (merged.gallery && merged.gallery.length > 0 ? 'gallery' : 'single');

    merged.mediaType = inferredMediaType;

    if (merged.mediaType === 'gallery' && merged.gallery.length === 0 && merged.imageUrl) {
        merged.gallery = [merged.imageUrl];
    }

    if (merged.mediaType === 'single' && !merged.imageUrl && merged.gallery.length > 0) {
        merged.imageUrl = merged.gallery[0];
    }

    return merged;
};

const normalizeBanner2Item = (item: Banner2Item): Banner2Item => ({
    ...DEFAULT_BANNER2_ITEM_BASE,
    ...item,
    titleFont: item.titleFont || DEFAULT_BANNER2_ITEM_BASE.titleFont,
    titleColor: item.titleColor || DEFAULT_BANNER2_ITEM_BASE.titleColor,
    descriptionFont: item.descriptionFont || DEFAULT_BANNER2_ITEM_BASE.descriptionFont,
    descriptionColor: item.descriptionColor || DEFAULT_BANNER2_ITEM_BASE.descriptionColor,
});

const normalizeBanner2Slide = (slide: Banner2Slide): Banner2Slide => ({
    ...DEFAULT_BANNER2_SLIDE,
    ...slide,
    items: (slide.items || DEFAULT_BANNER2_SLIDE.items).map((item) => normalizeBanner2Item(item)),
});

const normalizeBanner2 = (banner2: Banner2Settings): Banner2Settings => ({
    ...DEFAULT_BANNER2,
    ...banner2,
    background: { ...DEFAULT_BANNER2.background, ...(banner2.background || {}) },
    slides: (banner2.slides && banner2.slides.length > 0)
        ? banner2.slides.map((slide) => normalizeBanner2Slide(slide))
        : DEFAULT_BANNER2.slides.map((slide) => normalizeBanner2Slide(slide)),
});

const normalizeLowerInfoItem = (item: LowerInfoItem): LowerInfoItem => ({
    ...item,
    titleFont: item.titleFont || 'Poppins',
    titleColor: item.titleColor || '#1F2937',
    descriptionFont: item.descriptionFont || 'Inter',
    descriptionColor: item.descriptionColor || '#4B5563',
    mediaType: item.mediaType || 'none',
    mediaAlign: item.mediaAlign || 'center',
    textAlign: item.textAlign || 'center',
    gallery: item.gallery || [],
});

const normalizeLowerInfo = (lowerInfo: LowerInfoSettings, options?: { allowEmpty?: boolean }): LowerInfoSettings => {
    const allowEmpty = options?.allowEmpty ?? false;
    const hasItems = Array.isArray(lowerInfo.items) && lowerInfo.items.length > 0;
    const items = hasItems
        ? lowerInfo.items.map((item) => normalizeLowerInfoItem(item))
        : allowEmpty
            ? []
            : DEFAULT_LOWER_INFO.items.map((item) => normalizeLowerInfoItem(item));

    return {
        ...DEFAULT_LOWER_INFO,
        ...lowerInfo,
        background: { ...DEFAULT_LOWER_INFO.background, ...(lowerInfo.background || {}) },
        layout: lowerInfo.layout || DEFAULT_LOWER_INFO.layout,
        items,
    };
};

const normalizePageExtras = (extras?: PageExtrasSettings): PageExtrasSettings => {
    if (!extras) return createPageExtrasDefaults();

    const contentBlocks = Array.isArray(extras.contentBlocks)
        ? extras.contentBlocks.map((block) => normalizeContentBlock(block))
        : [];

    const lowerInfo = extras.lowerInfo
        ? {
            ...DEFAULT_LOWER_INFO,
            ...extras.lowerInfo,
            background: { ...DEFAULT_LOWER_INFO.background, ...(extras.lowerInfo.background || {}) },
            layout: extras.lowerInfo.layout || DEFAULT_LOWER_INFO.layout,
            items: Array.isArray(extras.lowerInfo.items)
                ? extras.lowerInfo.items.map((item) => normalizeLowerInfoItem(item))
                : [],
        }
        : createPageExtrasDefaults().lowerInfo;

    return {
        contentBlocks,
        lowerInfo,
    };
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
        const rawBlocks = data.forside.contentBlocks || DEFAULT_BRANDING.forside.contentBlocks;
        const normalizedBlocks = (rawBlocks || []).map((block: ContentBlock) => normalizeContentBlock(block));
        const normalizedBanner2 = normalizeBanner2((data.forside.banner2 || DEFAULT_BRANDING.forside.banner2) as Banner2Settings);
        const normalizedLowerInfo = normalizeLowerInfo((data.forside.lowerInfo || DEFAULT_BRANDING.forside.lowerInfo) as LowerInfoSettings);
        merged.forside = {
            ...DEFAULT_BRANDING.forside,
            ...data.forside,
            contentBlocks: normalizedBlocks,
            banner2: normalizedBanner2,
            lowerInfo: normalizedLowerInfo,
            productsSection: {
                ...DEFAULT_BRANDING.forside.productsSection,
                ...(data.forside.productsSection || {}),
                featuredProduct: {
                    ...DEFAULT_FEATURED_PRODUCT,
                    ...(data.forside.productsSection?.featuredProduct || {}),
                },
                button: {
                    ...DEFAULT_BRANDING.forside.productsSection.button,
                    ...(data.forside.productsSection?.button || {}),
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
            orderButtons: {
                ...DEFAULT_BRANDING.productPage.orderButtons,
                ...(data.productPage.orderButtons || {}),
                primary: {
                    ...DEFAULT_BRANDING.productPage.orderButtons.primary,
                    ...(data.productPage.orderButtons?.primary || {}),
                },
                secondary: {
                    ...DEFAULT_BRANDING.productPage.orderButtons.secondary,
                    ...(data.productPage.orderButtons?.secondary || {}),
                },
                selected: {
                    ...DEFAULT_BRANDING.productPage.orderButtons.selected,
                    ...(data.productPage.orderButtons?.selected || {}),
                },
            },
            matrix: {
                ...DEFAULT_BRANDING.productPage.matrix,
                ...(data.productPage.matrix || {}),
            },
        };
    }

    if (data.contactPage) {
        merged.contactPage = {
            ...DEFAULT_BRANDING.contactPage,
            ...data.contactPage,
            formBox: {
                ...DEFAULT_BRANDING.contactPage.formBox,
                ...(data.contactPage.formBox || {}),
            },
            map: {
                ...DEFAULT_BRANDING.contactPage.map,
                ...(data.contactPage.map || {}),
            },
            contactInfo: {
                ...DEFAULT_BRANDING.contactPage.contactInfo,
                ...(data.contactPage.contactInfo || {}),
            },
        };
    }

    if (data.aboutPage) {
        merged.aboutPage = {
            ...DEFAULT_BRANDING.aboutPage,
            ...data.aboutPage,
            media: {
                ...DEFAULT_BRANDING.aboutPage.media,
                ...(data.aboutPage.media || {}),
            },
            features: {
                ...DEFAULT_BRANDING.aboutPage.features,
                ...(data.aboutPage.features || {}),
                items: Array.isArray(data.aboutPage.features?.items)
                    ? data.aboutPage.features.items
                    : DEFAULT_BRANDING.aboutPage.features.items,
            },
        };
    }

    if (data.pageExtras) {
        merged.pageExtras = {
            ...DEFAULT_BRANDING.pageExtras,
            ...data.pageExtras,
            about: normalizePageExtras(data.pageExtras.about),
            contact: normalizePageExtras(data.pageExtras.contact),
            grafisk: normalizePageExtras(data.pageExtras.grafisk),
            product: normalizePageExtras(data.pageExtras.product),
        };
    }

    if (data.grafiskVejledning) {
        const tocItems = (data.grafiskVejledning.toc?.items ?? DEFAULT_BRANDING.grafiskVejledning.toc.items)
            .map((item: GrafiskVejledningTocItem) => ({
                ...item,
                images: item.images || [],
            }));
        merged.grafiskVejledning = {
            ...DEFAULT_BRANDING.grafiskVejledning,
            ...data.grafiskVejledning,
            header: {
                ...DEFAULT_BRANDING.grafiskVejledning.header,
                ...(data.grafiskVejledning.header || {}),
            },
            checklist: {
                ...DEFAULT_BRANDING.grafiskVejledning.checklist,
                ...(data.grafiskVejledning.checklist || {}),
                items: data.grafiskVejledning.checklist?.items ?? DEFAULT_BRANDING.grafiskVejledning.checklist.items,
            },
            toc: {
                ...DEFAULT_BRANDING.grafiskVejledning.toc,
                ...(data.grafiskVejledning.toc || {}),
                items: tocItems,
            },
        };
    }

    // Deep merge nested objects
    if (data.fonts) merged.fonts = { ...DEFAULT_BRANDING.fonts, ...data.fonts };
    if (data.colors) {
        const mergedColors = { ...DEFAULT_BRANDING.colors, ...data.colors };
        const headingFromData = data.colors.headingText;
        if (!data.colors.titleText && headingFromData) {
            mergedColors.titleText = headingFromData;
        }
        if (!data.colors.subtitleText && headingFromData) {
            mergedColors.subtitleText = headingFromData;
        }
        if (!data.colors.headingText && (data.colors.titleText || data.colors.subtitleText)) {
            mergedColors.headingText = data.colors.titleText || data.colors.subtitleText;
        }
        merged.colors = mergedColors;
    }
    if (data.navigation) merged.navigation = { ...DEFAULT_BRANDING.navigation, ...data.navigation };
    if (data.pages) {
        merged.pages = {
            ...DEFAULT_BRANDING.pages,
            ...data.pages,
            items: data.pages.items || DEFAULT_BRANDING.pages.items,
        };
    }

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

    useEffect(() => {
        if (hasLoadedFromStorage && !hasUnsavedChanges) {
            clearDraftStorage();
        }
    }, [hasLoadedFromStorage, hasUnsavedChanges]);

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
                banner2: partial.forside.banner2 ?? prev.forside.banner2,
                lowerInfo: partial.forside.lowerInfo ?? prev.forside.lowerInfo,
                productsSection: partial.forside.productsSection
                    ? { ...prev.forside.productsSection, ...partial.forside.productsSection }
                    : prev.forside.productsSection,
            } : prev.forside;

            const newPages = partial.pages ? {
                ...prev.pages,
                ...partial.pages,
                items: partial.pages.items ?? prev.pages.items,
            } : prev.pages;

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
                prevEntry: PageExtrasSettings,
                updates: PageExtrasSettings
            ): PageExtrasSettings => {
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
                forside: newForside,
                productPage: newProductPage,
                grafiskVejledning: newGrafiskVejledning,
                contactPage: newContactPage,
                aboutPage: newAboutPage,
                navigation: { ...prev.navigation, ...(partial.navigation || {}) },
                pages: newPages,
                pageExtras: newPageExtras,
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
