
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Loader2, Save, RotateCcw, Send, Trash2, List,
    X, ChevronRight, Layout, Type, Palette, Sparkles, Image as ImageIcon,
    ExternalLink, Monitor, Smartphone, Tablet, FolderUp, LayoutTemplate, ShoppingCart,
    Pencil, Eye, EyeOff, Check, History, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Award, Plus, Truck, Phone, Shield, Clock, Star, Heart, MousePointer2, FileText, type LucideIcon
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { da } from "date-fns/locale";

import { SiteDesignPreviewFrame } from "@/components/admin/SiteDesignPreviewFrame";
import { FontSelector } from "@/components/admin/FontSelector";
import { IconPackSelector } from "@/components/admin/IconPackSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Slider } from "@/components/ui/slider";
import { ProductAssetsSection } from "@/components/admin/ProductAssetsSection";
import { HeaderSection } from "@/components/admin/HeaderSection";
import { FooterSection } from "@/components/admin/FooterSection";
import { BannerEditor } from "@/components/admin/BannerEditor";
import { Banner2Section } from "@/components/admin/Banner2Section";
import { LogoSection } from "@/components/admin/LogoSection";
import { FaviconEditor } from "@/components/admin/FaviconEditor";
import { ContentBlocksSection } from "@/components/admin/ContentBlocksSection";
import { PageBackgroundControls } from "@/components/admin/PageBackgroundControls";
import { PendingPurchasesDialog, PendingPurchasesBadge } from "@/components/admin/PendingPurchasesDialog";
import { ThemeSelector } from "@/components/admin/ThemeSelector";
import { ProduktvalgknapperSection } from "@/components/admin/ProduktvalgknapperSection";
import { ProductOptionButtonEditor } from "@/components/admin/ProductOptionButtonEditor";
import { ProductOptionSectionBoxEditor } from "@/components/admin/ProductOptionSectionBoxEditor";
import { ProductDescriptionSection } from "@/components/admin/ProductDescriptionSection";
import { supabase } from "@/integrations/supabase/client";
import { usePaidItems } from "@/hooks/usePaidItems";

import {
    DEFAULT_BRANDING,
    type BrandingStorageAdapter,
    type BrandingCapabilities,
    brandingEquals,
    useBrandingEditor,
} from "@/lib/branding";
import { resolveSiteDesignTarget } from "@/lib/siteDesignTargets";

interface SiteDesignEditorV2Props {
    adapter: BrandingStorageAdapter;
    capabilities: BrandingCapabilities;
    onSwitchVersion?: () => void;
}

interface FeaturedProductOption {
    id: string;
    name: string;
    slug: string;
    pricing_type?: string | null;
}

type BrandingColorKey =
    | "primary"
    | "secondary"
    | "background"
    | "card"
    | "dropdown"
    | "hover"
    | "headingText"
    | "bodyText"
    | "pricingText"
    | "linkText";

const BRANDING_COLOR_KEYS: BrandingColorKey[] = [
    "primary",
    "secondary",
    "background",
    "card",
    "dropdown",
    "hover",
    "headingText",
    "bodyText",
    "pricingText",
    "linkText",
];

type BrandingColorPresetColors = Record<BrandingColorKey, string>;
type BrandingFontPresetFonts = typeof DEFAULT_BRANDING.fonts;

type VisualThemePreset = {
    id: string;
    name: string;
    description: string;
    tags: string[];
    themeId: "classic" | "glassmorphism";
    colors: BrandingColorPresetColors;
    fonts: BrandingFontPresetFonts;
    headerStyle: typeof DEFAULT_BRANDING.header.style;
    headerOpacity: number;
    dropdownPreset: NonNullable<typeof DEFAULT_BRANDING.header.dropdownPreset>;
    dropdownRadiusPx: number;
    dropdownImageRadiusPx: number;
    cardStyle: NonNullable<typeof DEFAULT_BRANDING.forside.productsSection.featuredProductConfig.cardStyle>;
    radiusPx: number;
    tightRadiusPx: number;
    borderWidthPx: number;
    pageBackgroundType: typeof DEFAULT_BRANDING.colors.backgroundType;
    productBackgroundType: typeof DEFAULT_BRANDING.forside.productsSection.background.type;
    buttonAnimation: typeof DEFAULT_BRANDING.forside.productsSection.button.animation;
    orderButtonAnimation: typeof DEFAULT_BRANDING.productPage.orderButtons.animation;
    heroTransition: typeof DEFAULT_BRANDING.hero.slideshow.transition;
    heroTextAnimation: NonNullable<typeof DEFAULT_BRANDING.hero.images[number]["textAnimation"]>;
    parallaxStyle: NonNullable<typeof DEFAULT_BRANDING.hero.parallaxStyle>;
    parallaxIntensity: number;
    heroOverlayOpacity: number;
    matrixPaddingPx: number;
    optionButtonPaddingPx: number;
    optionImageSizePx: number;
    pictureHoverScale: number;
    buttonRadiusPx: number;
    buttonHoverScale: number;
    buttonHoverY: number;
    buttonTapScale: number;
    buttonTransitionMs: number;
    buttonShadow: string;
    buttonHoverShadow: string;
    buttonSurfaceStyle: "matte" | "apple-glass" | "satin" | "pressed" | "luminous";
    buttonTextColor: string;
    buttonHoverTextColor: string;
    buttonGradientStart: string;
    buttonGradientEnd: string;
    buttonHoverGradientStart: string;
    buttonHoverGradientEnd: string;
    buttonInnerShadow: string;
    buttonSheenColor: string;
    dropdownMotionStyle: "precision" | "liquid" | "gallery-rise" | "soft-slide" | "focus-slide";
    pageTransitionStyle: "subtle-fade" | "soft-depth" | "editorial-rise" | "direct-snap" | "dark-focus";
    pictureHoverEffect: "fill" | "outline" | "none";
    pictureSelectedEffect: "fill" | "outline" | "ring" | "none";
    glassOpacity?: number;
};

const VISUAL_THEME_PRESETS: VisualThemePreset[] = [
    {
        id: "precision-print",
        name: "Precision Print",
        description: "Sharp, clean B2B print shop with crisp borders, calm blues and compact controls.",
        tags: ["Clean", "B2B", "Sharp"],
        themeId: "classic",
        colors: {
            primary: "#1D4ED8",
            secondary: "#E8EEF7",
            background: "#F7F9FC",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#153E75",
            headingText: "#0F172A",
            bodyText: "#475569",
            pricingText: "#0F766E",
            linkText: "#1D4ED8",
        },
        fonts: {
            heading: "Poppins",
            body: "Inter",
            pricing: "Roboto Mono",
        },
        headerStyle: "solid",
        headerOpacity: 0.98,
        dropdownPreset: "compact-columns",
        dropdownRadiusPx: 14,
        dropdownImageRadiusPx: 8,
        cardStyle: "default",
        radiusPx: 10,
        tightRadiusPx: 6,
        borderWidthPx: 1,
        pageBackgroundType: "solid",
        productBackgroundType: "solid",
        buttonAnimation: "lift",
        orderButtonAnimation: "none",
        heroTransition: "soft-wipe",
        heroTextAnimation: "reveal-up",
        parallaxStyle: "soft-depth",
        parallaxIntensity: 18,
        heroOverlayOpacity: 0.36,
        matrixPaddingPx: 16,
        optionButtonPaddingPx: 12,
        optionImageSizePx: 144,
        pictureHoverScale: 1.025,
        buttonRadiusPx: 8,
        buttonHoverScale: 1.015,
        buttonHoverY: -1,
        buttonTapScale: 0.98,
        buttonTransitionMs: 170,
        buttonShadow: "0 8px 18px rgba(29, 78, 216, 0.12)",
        buttonHoverShadow: "0 14px 28px rgba(29, 78, 216, 0.2)",
        buttonSurfaceStyle: "satin",
        buttonTextColor: "#FFFFFF",
        buttonHoverTextColor: "#FFFFFF",
        buttonGradientStart: "#2B66E8",
        buttonGradientEnd: "#1747B8",
        buttonHoverGradientStart: "#335FBC",
        buttonHoverGradientEnd: "#123B80",
        buttonInnerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.24), inset 0 -1px 0 rgba(15, 23, 42, 0.18)",
        buttonSheenColor: "rgba(255, 255, 255, 0.38)",
        dropdownMotionStyle: "precision",
        pageTransitionStyle: "subtle-fade",
        pictureHoverEffect: "outline",
        pictureSelectedEffect: "ring",
    },
    {
        id: "glass-studio",
        name: "Glass Studio",
        description: "Soft glass surfaces, airy dropdowns, cyan-indigo accents and smooth depth effects.",
        tags: ["Glass", "Modern", "Soft"],
        themeId: "glassmorphism",
        colors: {
            primary: "#315E72",
            secondary: "#E7EEF3",
            background: "#F3F6F8",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#6B7AA1",
            headingText: "#0F172A",
            bodyText: "#475569",
            pricingText: "#315E72",
            linkText: "#4E6388",
        },
        fonts: {
            heading: "Manrope",
            body: "Inter",
            pricing: "Space Grotesk",
        },
        headerStyle: "glass",
        headerOpacity: 0.76,
        dropdownPreset: "showcase-bar",
        dropdownRadiusPx: 24,
        dropdownImageRadiusPx: 18,
        cardStyle: "glass",
        radiusPx: 24,
        tightRadiusPx: 16,
        borderWidthPx: 1,
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        buttonAnimation: "glow",
        orderButtonAnimation: "none",
        heroTransition: "cross-zoom",
        heroTextAnimation: "soft-mask",
        parallaxStyle: "slow-zoom",
        parallaxIntensity: 24,
        heroOverlayOpacity: 0.28,
        matrixPaddingPx: 20,
        optionButtonPaddingPx: 14,
        optionImageSizePx: 156,
        pictureHoverScale: 1.035,
        buttonRadiusPx: 999,
        buttonHoverScale: 1.025,
        buttonHoverY: -3,
        buttonTapScale: 0.97,
        buttonTransitionMs: 240,
        buttonShadow: "0 14px 34px rgba(49, 94, 114, 0.16)",
        buttonHoverShadow: "0 20px 52px rgba(77, 96, 126, 0.24)",
        buttonSurfaceStyle: "apple-glass",
        buttonTextColor: "#10202C",
        buttonHoverTextColor: "#10202C",
        buttonGradientStart: "rgba(255, 255, 255, 0.88)",
        buttonGradientEnd: "rgba(230, 240, 246, 0.64)",
        buttonHoverGradientStart: "rgba(255, 255, 255, 0.96)",
        buttonHoverGradientEnd: "rgba(215, 230, 240, 0.78)",
        buttonInnerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), inset 0 -1px 0 rgba(49, 94, 114, 0.16)",
        buttonSheenColor: "rgba(255, 255, 255, 0.58)",
        dropdownMotionStyle: "liquid",
        pageTransitionStyle: "soft-depth",
        pictureHoverEffect: "fill",
        pictureSelectedEffect: "ring",
        glassOpacity: 0.72,
    },
    {
        id: "premium-press",
        name: "Premium Press",
        description: "Editorial print feel with navy, restrained gold accents and premium rounded surfaces.",
        tags: ["Premium", "Editorial", "Warm"],
        themeId: "classic",
        colors: {
            primary: "#22314D",
            secondary: "#EFE7D6",
            background: "#FAF8F3",
            card: "#FFFFFF",
            dropdown: "#FBF7EF",
            hover: "#8A6A2F",
            headingText: "#111827",
            bodyText: "#52525B",
            pricingText: "#6F5425",
            linkText: "#22314D",
        },
        fonts: {
            heading: "Playfair Display",
            body: "Source Sans 3",
            pricing: "Roboto Mono",
        },
        headerStyle: "solid",
        headerOpacity: 0.96,
        dropdownPreset: "split-preview",
        dropdownRadiusPx: 20,
        dropdownImageRadiusPx: 12,
        cardStyle: "default",
        radiusPx: 18,
        tightRadiusPx: 12,
        borderWidthPx: 1,
        pageBackgroundType: "solid",
        productBackgroundType: "gradient",
        buttonAnimation: "lift",
        orderButtonAnimation: "none",
        heroTransition: "zoom-fade",
        heroTextAnimation: "cinematic",
        parallaxStyle: "fixed-focus",
        parallaxIntensity: 16,
        heroOverlayOpacity: 0.42,
        matrixPaddingPx: 18,
        optionButtonPaddingPx: 13,
        optionImageSizePx: 148,
        pictureHoverScale: 1.025,
        buttonRadiusPx: 14,
        buttonHoverScale: 1.018,
        buttonHoverY: -2,
        buttonTapScale: 0.985,
        buttonTransitionMs: 220,
        buttonShadow: "0 10px 24px rgba(34, 49, 77, 0.14)",
        buttonHoverShadow: "0 18px 38px rgba(111, 84, 37, 0.22)",
        buttonSurfaceStyle: "satin",
        buttonTextColor: "#FFFFFF",
        buttonHoverTextColor: "#FFFFFF",
        buttonGradientStart: "#2F405F",
        buttonGradientEnd: "#17233A",
        buttonHoverGradientStart: "#8A6A2F",
        buttonHoverGradientEnd: "#5F461D",
        buttonInnerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.22)",
        buttonSheenColor: "rgba(255, 255, 255, 0.32)",
        dropdownMotionStyle: "soft-slide",
        pageTransitionStyle: "editorial-rise",
        pictureHoverEffect: "outline",
        pictureSelectedEffect: "fill",
    },
    {
        id: "bold-maker",
        name: "Bold Maker",
        description: "High-contrast commerce style with strong borders, warm neutral energy and direct CTAs.",
        tags: ["Bold", "Contrast", "Campaign"],
        themeId: "classic",
        colors: {
            primary: "#1F2937",
            secondary: "#E7DDC8",
            background: "#F6F1E8",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#374151",
            headingText: "#111827",
            bodyText: "#374151",
            pricingText: "#7A4F20",
            linkText: "#1F2937",
        },
        fonts: {
            heading: "Archivo Black",
            body: "IBM Plex Sans",
            pricing: "IBM Plex Mono",
        },
        headerStyle: "solid",
        headerOpacity: 1,
        dropdownPreset: "gallery-cards",
        dropdownRadiusPx: 8,
        dropdownImageRadiusPx: 4,
        cardStyle: "default",
        radiusPx: 6,
        tightRadiusPx: 4,
        borderWidthPx: 2,
        pageBackgroundType: "solid",
        productBackgroundType: "solid",
        buttonAnimation: "lift",
        orderButtonAnimation: "none",
        heroTransition: "slide",
        heroTextAnimation: "stagger-rise",
        parallaxStyle: "classic",
        parallaxIntensity: 12,
        heroOverlayOpacity: 0.34,
        matrixPaddingPx: 14,
        optionButtonPaddingPx: 12,
        optionImageSizePx: 140,
        pictureHoverScale: 1.03,
        buttonRadiusPx: 4,
        buttonHoverScale: 1.01,
        buttonHoverY: -2,
        buttonTapScale: 0.96,
        buttonTransitionMs: 140,
        buttonShadow: "0 5px 0 rgba(31, 41, 55, 1)",
        buttonHoverShadow: "0 7px 0 rgba(31, 41, 55, 1)",
        buttonSurfaceStyle: "pressed",
        buttonTextColor: "#FFFFFF",
        buttonHoverTextColor: "#FFFFFF",
        buttonGradientStart: "#2B3543",
        buttonGradientEnd: "#151C27",
        buttonHoverGradientStart: "#3B4655",
        buttonHoverGradientEnd: "#1F2937",
        buttonInnerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.14)",
        buttonSheenColor: "rgba(255, 255, 255, 0.18)",
        dropdownMotionStyle: "gallery-rise",
        pageTransitionStyle: "direct-snap",
        pictureHoverEffect: "outline",
        pictureSelectedEffect: "outline",
    },
    {
        id: "dark-production",
        name: "Dark Production",
        description: "Dark production dashboard look with bright cyan pricing, deep panels and focused contrast.",
        tags: ["Dark", "Technical", "Contrast"],
        themeId: "classic",
        colors: {
            primary: "#60A5FA",
            secondary: "#1E293B",
            background: "#070A12",
            card: "#111827",
            dropdown: "#0F172A",
            hover: "#93C5FD",
            headingText: "#F8FAFC",
            bodyText: "#CBD5E1",
            pricingText: "#BAE6FD",
            linkText: "#93C5FD",
        },
        fonts: {
            heading: "Space Grotesk",
            body: "Inter",
            pricing: "JetBrains Mono",
        },
        headerStyle: "solid",
        headerOpacity: 0.96,
        dropdownPreset: "split-preview",
        dropdownRadiusPx: 18,
        dropdownImageRadiusPx: 10,
        cardStyle: "glass",
        radiusPx: 16,
        tightRadiusPx: 10,
        borderWidthPx: 1,
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        buttonAnimation: "glow",
        orderButtonAnimation: "none",
        heroTransition: "ken-burns",
        heroTextAnimation: "reveal-up",
        parallaxStyle: "slow-zoom",
        parallaxIntensity: 18,
        heroOverlayOpacity: 0.52,
        matrixPaddingPx: 18,
        optionButtonPaddingPx: 13,
        optionImageSizePx: 148,
        pictureHoverScale: 1.028,
        buttonRadiusPx: 12,
        buttonHoverScale: 1.02,
        buttonHoverY: -2,
        buttonTapScale: 0.98,
        buttonTransitionMs: 190,
        buttonShadow: "0 10px 26px rgba(96, 165, 250, 0.14)",
        buttonHoverShadow: "0 0 0 1px rgba(186, 230, 253, 0.28), 0 18px 42px rgba(96, 165, 250, 0.2)",
        buttonSurfaceStyle: "luminous",
        buttonTextColor: "#FFFFFF",
        buttonHoverTextColor: "#FFFFFF",
        buttonGradientStart: "#3B82F6",
        buttonGradientEnd: "#1D4ED8",
        buttonHoverGradientStart: "#60A5FA",
        buttonHoverGradientEnd: "#2563EB",
        buttonInnerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.36), inset 0 -1px 0 rgba(2, 6, 23, 0.32)",
        buttonSheenColor: "rgba(255, 255, 255, 0.42)",
        dropdownMotionStyle: "focus-slide",
        pageTransitionStyle: "dark-focus",
        pictureHoverEffect: "fill",
        pictureSelectedEffect: "ring",
        glassOpacity: 0.82,
    },
];

const buildColorPresetThemePatch = (
    draft: typeof DEFAULT_BRANDING,
    presetColors: BrandingColorPresetColors,
): Partial<typeof DEFAULT_BRANDING> => {
    const colors = {
        ...draft.colors,
        ...presetColors,
        backgroundType: "solid" as const,
        backgroundGradientType: draft.colors.backgroundGradientType || "linear",
        backgroundGradientStart: presetColors.background,
        backgroundGradientEnd: presetColors.secondary,
        backgroundGradientUseMiddle: false,
        backgroundGradientMiddle: presetColors.card,
        backgroundGradientAngle: draft.colors.backgroundGradientAngle ?? 135,
        backgroundImageUrl: null,
    };
    const primary = colors.primary || DEFAULT_BRANDING.colors.primary;
    const secondary = colors.secondary || DEFAULT_BRANDING.colors.secondary;
    const background = colors.background || DEFAULT_BRANDING.colors.background;
    const card = colors.card || DEFAULT_BRANDING.colors.card;
    const dropdown = colors.dropdown || card;
    const hover = colors.hover || primary;
    const heading = colors.headingText || DEFAULT_BRANDING.colors.headingText;
    const body = colors.bodyText || DEFAULT_BRANDING.colors.bodyText;
    const pricing = colors.pricingText || primary;
    const primaryFillText = getReadableTextForSolid(primary);
    const hoverFillText = getReadableTextForSolid(hover, primaryFillText);
    const cardFillText = getReadableTextForSolid(card, heading);
    const buttonText = primaryFillText;

    const currentProductPage = draft.productPage || DEFAULT_BRANDING.productPage;
    const currentHero = draft.hero || DEFAULT_BRANDING.hero;
    const currentHeroOverlay = currentHero.overlay || DEFAULT_BRANDING.hero.overlay;
    const currentUspStrip = draft.uspStrip || DEFAULT_BRANDING.uspStrip;
    const currentMatrix = currentProductPage.matrix || DEFAULT_BRANDING.productPage.matrix;
    const currentPricePanel = currentProductPage.pricePanel || DEFAULT_BRANDING.productPage.pricePanel;
    const currentOrderButtons = currentProductPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
    const currentOptionSelectors = currentProductPage.optionSelectors || DEFAULT_BRANDING.productPage.optionSelectors;
    const currentForside = draft.forside || DEFAULT_BRANDING.forside;
    const currentProductsSection = currentForside.productsSection || DEFAULT_BRANDING.forside.productsSection;
    const currentFeatured = currentProductsSection.featuredProductConfig || DEFAULT_BRANDING.forside.productsSection.featuredProductConfig;
    const themeHeroButton = (
        button: typeof DEFAULT_BRANDING.hero.overlay.buttons[number],
        index = 0,
    ) => {
        const isSecondary = button.variant === "secondary" || index > 0;
        const backgroundColor = isSecondary ? card : primary;
        return {
            ...button,
            textColor: isSecondary ? cardFillText : buttonText,
            bgColor: backgroundColor,
            bgHoverColor: isSecondary ? secondary : hover,
            bgOpacity: button.bgOpacity ?? 1,
        };
    };
    const themedHeroButtons = (currentHeroOverlay.buttons?.length
        ? currentHeroOverlay.buttons
        : DEFAULT_BRANDING.hero.overlay.buttons
    ).map(themeHeroButton);

    return {
        colors,
        hero: {
            ...currentHero,
            overlay_color: heading,
            overlay_opacity: currentHero.overlay_opacity ?? 0.3,
            overlay: {
                ...currentHeroOverlay,
                titleColor: buttonText,
                subtitleColor: hexToRgba(buttonText, 0.9),
                buttons: themedHeroButtons,
            },
            images: (currentHero.images || []).map((image) => ({
                ...image,
                overlayColor: currentHero.usePerBannerOverlay ? heading : image.overlayColor,
                overlayOpacity: currentHero.usePerBannerOverlay ? (image.overlayOpacity ?? currentHero.overlay_opacity ?? 0.3) : image.overlayOpacity,
                buttons: image.buttons?.map(themeHeroButton),
            })),
        },
        header: {
            ...draft.header,
            logoTextColor: heading,
            bgColor: card,
            textColor: heading,
            hoverTextColor: hover,
            activeTextColor: primary,
            actionHoverBgColor: hexToRgba(primary, 0.1),
            actionHoverTextColor: hover,
            dropdownBgColor: dropdown,
            dropdownHoverColor: secondary,
            dropdownCategoryColor: body,
            dropdownProductColor: heading,
            dropdownMetaColor: body,
            cta: {
                ...draft.header.cta,
                bgColor: primary,
                textColor: buttonText,
                hoverBgColor: hover,
                hoverTextColor: hoverFillText,
            },
        },
        footer: {
            ...draft.footer,
            background: "solid" as const,
            bgColor: heading,
        },
        uspStrip: {
            ...currentUspStrip,
            backgroundColor: primary,
            useGradient: true,
            gradientFrom: primary,
            gradientTo: hover,
            textColor: buttonText,
            iconColor: buttonText,
            titleColor: buttonText,
            descriptionColor: hexToRgba(buttonText, 0.9),
        },
        forside: {
            ...currentForside,
            productsSection: {
                ...currentProductsSection,
                categoryTabs: {
                    ...currentProductsSection.categoryTabs,
                    textColor: heading,
                    hoverTextColor: hover,
                    activeTextColor: primaryFillText,
                    bgColor: card,
                    hoverBgColor: secondary,
                    activeBgColor: primary,
                    borderColor: secondary,
                    activeBorderColor: primary,
                },
                card: {
                    ...currentProductsSection.card,
                    titleColor: heading,
                    bodyColor: body,
                    priceColor: pricing,
                },
                button: {
                    ...currentProductsSection.button,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: hoverFillText,
                },
                background: {
                    ...currentProductsSection.background,
                    type: "solid" as const,
                    color: background,
                    gradientStart: background,
                    gradientEnd: secondary,
                    opacity: 1,
                },
                featuredProductConfig: {
                    ...currentFeatured,
                    backgroundColor: card,
                    ctaColor: primary,
                    ctaTextColor: buttonText,
                    sidePanel: {
                        ...currentFeatured.sidePanel,
                        ctaColor: primary,
                        ctaTextColor: buttonText,
                    },
                },
            },
        },
        productPage: {
            ...currentProductPage,
            heading: {
                ...currentProductPage.heading,
                color: heading,
                subtext: {
                    ...currentProductPage.heading.subtext,
                    color: body,
                },
            },
            infoSection: {
                ...currentProductPage.infoSection,
                bgColor: card,
                borderColor: secondary,
                titleColor: heading,
                textColor: body,
            },
            matrix: {
                ...currentMatrix,
                headerBg: secondary,
                headerText: heading,
                rowHeaderBg: card,
                rowHeaderText: heading,
                cellBg: card,
                cellText: heading,
                cellHoverBg: secondary,
                cellHoverText: heading,
                selectedBg: primary,
                selectedText: buttonText,
                borderColor: secondary,
                navButtonBg: card,
                navButtonText: heading,
                navButtonHoverBg: secondary,
                navButtonHoverText: hover,
                navButtonBorder: secondary,
                navButtonHoverBorder: primary,
                boxBackgroundColor: card,
                boxBorderColor: secondary,
                textButtons: {
                    ...currentMatrix.textButtons,
                    backgroundColor: card,
                    hoverBackgroundColor: secondary,
                    textColor: heading,
                    hoverTextColor: hover,
                    selectedBackgroundColor: primary,
                    selectedTextColor: buttonText,
                    borderColor: secondary,
                    hoverBorderColor: primary,
                },
                pictureButtons: {
                    ...currentMatrix.pictureButtons,
                    hoverColor: primary,
                    selectedColor: primary,
                },
            },
            pricePanel: {
                ...currentPricePanel,
                backgroundType: "solid" as const,
                backgroundColor: hexToRgba(primary, 0.05),
                gradientStart: hexToRgba(primary, 0.1),
                gradientEnd: card,
                titleColor: heading,
                textColor: heading,
                mutedTextColor: body,
                priceColor: pricing,
                borderColor: hexToRgba(primary, 0.18),
                dividerColor: hexToRgba(primary, 0.12),
                optionBg: card,
                optionHoverBg: hexToRgba(primary, 0.06),
                optionSelectedBg: hexToRgba(primary, 0.1),
                optionBorderColor: secondary,
                optionHoverBorderColor: hexToRgba(primary, 0.35),
                optionSelectedBorderColor: primary,
                badgeBg: hexToRgba(primary, 0.1),
                badgeText: primary,
                badgeBorderColor: primary,
                downloadButtonBg: card,
                downloadButtonHoverBg: secondary,
                downloadButtonText: heading,
                downloadButtonHoverText: hover,
                downloadButtonBorder: secondary,
                downloadButtonHoverBorder: primary,
            },
            orderButtons: {
                ...currentOrderButtons,
                primary: {
                    ...currentOrderButtons.primary,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: hoverFillText,
                    borderColor: primary,
                    hoverBorderColor: hover,
                },
                secondary: {
                    ...currentOrderButtons.secondary,
                    bgColor: card,
                    hoverBgColor: secondary,
                    textColor: heading,
                    hoverTextColor: hover,
                    borderColor: secondary,
                    hoverBorderColor: primary,
                },
                selected: {
                    ...currentOrderButtons.selected,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: hoverFillText,
                    borderColor: primary,
                    hoverBorderColor: hover,
                },
            },
            optionSelectors: {
                ...currentOptionSelectors,
                button: {
                    ...currentOptionSelectors.button,
                    bgColor: card,
                    textColor: heading,
                    selectedBgColor: primary,
                    selectedTextColor: buttonText,
                    hoverBgColor: secondary,
                    hoverTextColor: hover,
                    borderColor: secondary,
                    selectedRingColor: primary,
                },
                image: {
                    ...currentOptionSelectors.image,
                    bgColor: card,
                    selectedBgColor: hexToRgba(primary, 0.1),
                    hoverBgColor: secondary,
                    selectedRingColor: primary,
                    hoverRingColor: primary,
                    labelColor: heading,
                },
                dropdown: {
                    ...currentOptionSelectors.dropdown,
                    bgColor: card,
                    textColor: heading,
                    borderColor: secondary,
                },
                checkbox: {
                    ...currentOptionSelectors.checkbox,
                    accentColor: primary,
                    labelColor: heading,
                },
            },
        },
    };
};

const buildVisualThemePresetPatch = (
    draft: typeof DEFAULT_BRANDING,
    preset: VisualThemePreset,
): Partial<typeof DEFAULT_BRANDING> => {
    const basePatch = buildColorPresetThemePatch(draft, preset.colors);
    const primary = preset.colors.primary;
    const secondary = preset.colors.secondary;
    const background = preset.colors.background;
    const card = preset.colors.card;
    const dropdown = preset.colors.dropdown;
    const hover = preset.colors.hover;
    const heading = preset.colors.headingText;
    const body = preset.colors.bodyText;
    const pricing = preset.colors.pricingText;
    const buttonText = preset.buttonTextColor;
    const buttonHoverText = preset.buttonHoverTextColor;
    const primaryFillText = getReadableTextForSolid(primary);
    const hoverFillText = getReadableTextForSolid(hover, buttonHoverText);
    const isDark = background === "#070A12";
    const subtleBorder = isDark ? hexToRgba("#FFFFFF", 0.12) : hexToRgba(primary, 0.18);
    const softPrimary = hexToRgba(primary, isDark ? 0.16 : 0.08);
    const softHover = hexToRgba(hover, isDark ? 0.2 : 0.1);
    const panelBg = preset.cardStyle === "glass"
        ? hexToRgba(card, preset.glassOpacity ?? 0.82)
        : card;
    const baseHero = basePatch.hero || draft.hero || DEFAULT_BRANDING.hero;
    const baseHeroOverlay = baseHero.overlay || draft.hero?.overlay || DEFAULT_BRANDING.hero.overlay;
    const baseHeader = basePatch.header || draft.header || DEFAULT_BRANDING.header;
    const baseUspStrip = basePatch.uspStrip || draft.uspStrip || DEFAULT_BRANDING.uspStrip;
    const baseForside = basePatch.forside || draft.forside || DEFAULT_BRANDING.forside;
    const baseProductsSection = baseForside.productsSection || draft.forside?.productsSection || DEFAULT_BRANDING.forside.productsSection;
    const baseFeatured = baseProductsSection.featuredProductConfig || DEFAULT_BRANDING.forside.productsSection.featuredProductConfig;
    const baseBanner2 = baseForside.banner2 || draft.forside?.banner2 || DEFAULT_BRANDING.forside.banner2;
    const baseProductPage = basePatch.productPage || draft.productPage || DEFAULT_BRANDING.productPage;
    const baseMatrix = baseProductPage.matrix || DEFAULT_BRANDING.productPage.matrix;
    const basePricePanel = baseProductPage.pricePanel || DEFAULT_BRANDING.productPage.pricePanel;
    const baseOrderButtons = baseProductPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
    const baseOptionSelectors = baseProductPage.optionSelectors || DEFAULT_BRANDING.productPage.optionSelectors;
    const heroSecondaryOpacity = preset.cardStyle === "glass" ? 0.82 : 1;
    const getHeroButtonColors = (index: number) => {
        const isPrimary = index === 0;
        const bgColor = isPrimary ? primary : card;
        const bgHoverColor = isPrimary ? hover : secondary;
        return {
            bgColor,
            bgHoverColor,
            textColor: getReadableTextForSolid(bgColor, isPrimary ? buttonText : heading),
            hoverTextColor: getReadableTextForSolid(bgHoverColor, isPrimary ? hoverFillText : heading),
            bgOpacity: isPrimary ? 1 : heroSecondaryOpacity,
        };
    };

    return {
        ...basePatch,
        themeId: preset.themeId,
        themeSettings: {
            ...(draft.themeSettings || {}),
            visualThemePresetId: preset.id,
            visualThemePresetName: preset.name,
            pageTransitionStyle: preset.pageTransitionStyle,
        },
        fonts: {
            ...draft.fonts,
            ...preset.fonts,
        },
        colors: {
            ...(basePatch.colors || draft.colors),
            backgroundType: preset.pageBackgroundType,
            backgroundGradientType: "linear",
            backgroundGradientStart: background,
            backgroundGradientEnd: isDark ? "#111827" : secondary,
            backgroundGradientUseMiddle: preset.id === "glass-studio",
            backgroundGradientMiddle: preset.id === "glass-studio" ? "#F8FAFC" : card,
            backgroundGradientAngle: preset.id === "bold-maker" ? 180 : 135,
            backgroundImageUrl: null,
        },
        header: {
            ...baseHeader,
            style: preset.headerStyle,
            bgColor: isDark ? "#0B1120" : card,
            bgOpacity: preset.headerOpacity,
            textColor: heading,
            logoTextColor: heading,
            logoFont: preset.fonts.heading,
            fontId: preset.fonts.body,
            dropdownCategoryFontId: preset.fonts.body,
            dropdownProductFontId: preset.fonts.body,
            hoverTextColor: hover,
            activeTextColor: primary,
            actionHoverBgColor: softPrimary,
            actionHoverTextColor: hover,
            dropdownPreset: preset.dropdownPreset,
            dropdownBgColor: dropdown,
            dropdownBgOpacity: preset.headerStyle === "glass" ? 0.86 : 0.98,
            dropdownShowBorder: true,
            dropdownHoverColor: preset.id === "bold-maker" ? secondary : softHover,
            dropdownBorderRadiusPx: preset.dropdownRadiusPx,
            dropdownImageRadiusPx: preset.dropdownImageRadiusPx,
            dropdownCategoryColor: body,
            dropdownProductColor: heading,
            dropdownMetaColor: body,
            dropdownMotionStyle: preset.dropdownMotionStyle,
            cta: {
                ...baseHeader.cta,
                    bgColor: primary,
                    textColor: buttonText,
                    hoverBgColor: hover,
                },
        },
        footer: {
            ...(basePatch.footer || draft.footer),
            background: "solid" as const,
            bgColor: isDark ? "#030712" : heading,
        },
        hero: {
            ...baseHero,
            overlay_color: isDark ? "#000000" : heading,
            overlay_opacity: preset.heroOverlayOpacity,
            parallax: true,
            parallaxStyle: preset.parallaxStyle,
            parallaxIntensity: preset.parallaxIntensity,
            slideshow: {
                ...baseHero.slideshow,
                transition: preset.heroTransition,
            },
            transition: preset.heroTransition,
            overlay: {
                ...baseHeroOverlay,
                titleColor: "#FFFFFF",
                subtitleColor: hexToRgba("#FFFFFF", 0.9),
                titleFontId: preset.fonts.heading,
                subtitleFontId: preset.fonts.body,
                buttons: (baseHeroOverlay.buttons?.length ? baseHeroOverlay.buttons : DEFAULT_BRANDING.hero.overlay.buttons).map((button, index) => {
                    const colors = getHeroButtonColors(index);
                    return {
                        ...button,
                        bgColor: colors.bgColor,
                        bgHoverColor: colors.bgHoverColor,
                        textColor: colors.textColor,
                        bgOpacity: colors.bgOpacity,
                    };
                }),
            },
            images: (baseHero.images || []).map((image) => ({
                ...image,
                textAnimation: preset.heroTextAnimation,
                titleFontId: preset.fonts.heading,
                subtitleFontId: preset.fonts.body,
                overlayColor: baseHero.usePerBannerOverlay ? (isDark ? "#000000" : heading) : image.overlayColor,
                overlayOpacity: baseHero.usePerBannerOverlay ? preset.heroOverlayOpacity : image.overlayOpacity,
                buttons: image.buttons?.map((button, index) => {
                    const colors = getHeroButtonColors(index);
                    return {
                        ...button,
                        bgColor: colors.bgColor,
                        bgHoverColor: colors.bgHoverColor,
                        textColor: colors.textColor,
                        bgOpacity: colors.bgOpacity,
                    };
                }),
            })),
        },
        uspStrip: {
            ...baseUspStrip,
            mode: "animated" as const,
            animation: preset.heroTextAnimation,
            staggerMs: 90,
            backgroundColor: primary,
            useGradient: true,
            gradientFrom: primary,
            gradientTo: hover,
            gradientDirection: preset.id === "bold-maker" ? "to-r" : "to-br",
            textColor: primaryFillText,
            iconColor: primaryFillText,
            titleColor: primaryFillText,
            descriptionColor: hexToRgba(primaryFillText, 0.88),
        },
        forside: {
            ...baseForside,
            banner2: {
                ...baseBanner2,
                headingColor: primaryFillText,
                subtitleColor: hexToRgba(primaryFillText, 0.88),
                headingFont: preset.fonts.heading,
                subtitleFont: preset.fonts.body,
                background: {
                    ...baseBanner2.background,
                    type: "gradient" as const,
                    color: primary,
                    gradientStart: primary,
                    gradientEnd: isDark ? "#0F172A" : hover,
                    gradientAngle: preset.id === "premium-press" ? 145 : 135,
                    animated: preset.id === "glass-studio",
                    animatedStart: primary,
                    animatedMiddle: secondary,
                    animatedEnd: hover,
                },
            },
            productsSection: {
                ...baseProductsSection,
                layoutStyle: preset.id === "bold-maker" ? "flat" : "cards",
                categoryTabs: {
                    ...baseProductsSection.categoryTabs,
                    borderRadiusPx: preset.id === "bold-maker" ? preset.tightRadiusPx : 100,
                    textColor: heading,
                    hoverTextColor: hover,
                    activeTextColor: primaryFillText,
                    bgColor: panelBg,
                    hoverBgColor: preset.id === "bold-maker" ? secondary : softHover,
                    activeBgColor: primary,
                    borderColor: subtleBorder,
                    activeBorderColor: primary,
                },
                card: {
                    ...baseProductsSection.card,
                    titleFont: preset.fonts.heading,
                    titleColor: heading,
                    bodyFont: preset.fonts.body,
                    bodyColor: body,
                    priceFont: preset.fonts.pricing,
                    priceColor: pricing,
                },
                button: {
                    ...baseProductsSection.button,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: buttonHoverText,
                    font: preset.fonts.heading,
                    animation: preset.buttonAnimation,
                    borderRadiusPx: preset.buttonRadiusPx,
                    shadow: preset.buttonShadow,
                    hoverShadow: preset.buttonHoverShadow,
                    hoverScale: preset.buttonHoverScale,
                    hoverY: preset.buttonHoverY,
                    tapScale: preset.buttonTapScale,
                    transitionMs: preset.buttonTransitionMs,
                    surfaceStyle: preset.buttonSurfaceStyle,
                    gradientStart: preset.buttonGradientStart,
                    gradientEnd: preset.buttonGradientEnd,
                    hoverGradientStart: preset.buttonHoverGradientStart,
                    hoverGradientEnd: preset.buttonHoverGradientEnd,
                    innerShadow: preset.buttonInnerShadow,
                    sheenColor: preset.buttonSheenColor,
                },
                background: {
                    ...baseProductsSection.background,
                    type: preset.productBackgroundType,
                    color: background,
                    gradientStart: background,
                    gradientEnd: isDark ? "#111827" : secondary,
                    gradientAngle: 135,
                    opacity: 1,
                },
                featuredProductConfig: {
                    ...baseFeatured,
                    cardStyle: preset.cardStyle,
                    borderRadiusPx: preset.radiusPx,
                    backgroundColor: panelBg,
                    ctaColor: primary,
                    ctaTextColor: buttonText,
                    ctaBorderRadiusPx: preset.tightRadiusPx,
                    sidePanel: {
                        ...baseFeatured.sidePanel,
                        borderRadiusPx: preset.radiusPx,
                        textAnimation: preset.heroTextAnimation,
                        overlayColor: isDark ? "#000000" : heading,
                        overlayOpacity: preset.heroOverlayOpacity,
                        titleColor: "#FFFFFF",
                        subtitleColor: hexToRgba("#FFFFFF", 0.9),
                        ctaColor: primary,
                        ctaTextColor: buttonText,
                    },
                },
            },
        },
        productPage: {
            ...baseProductPage,
            heading: {
                ...baseProductPage.heading,
                font: preset.fonts.heading,
                color: heading,
                subtext: {
                    ...baseProductPage.heading.subtext,
                    font: preset.fonts.body,
                    color: body,
                },
            },
            infoSection: {
                ...baseProductPage.infoSection,
                bgColor: panelBg,
                bgBorderRadius: preset.radiusPx,
                borderColor: subtleBorder,
                borderWidthPx: preset.borderWidthPx,
                titleFont: preset.fonts.heading,
                titleColor: heading,
                textFont: preset.fonts.body,
                textColor: body,
                imageBorderRadiusPx: preset.tightRadiusPx,
                galleryBorderRadiusPx: preset.tightRadiusPx,
            },
            matrix: {
                ...baseMatrix,
                font: preset.fonts.body,
                headerBg: isDark ? "#172033" : secondary,
                headerText: heading,
                rowHeaderBg: panelBg,
                rowHeaderText: heading,
                cellBg: panelBg,
                cellText: heading,
                cellHoverBg: preset.id === "bold-maker" ? secondary : softHover,
                cellHoverText: preset.id === "bold-maker" ? heading : hover,
                selectedBg: primary,
                selectedText: primaryFillText,
                borderColor: subtleBorder,
                navButtonBg: panelBg,
                navButtonText: heading,
                navButtonHoverBg: preset.id === "bold-maker" ? secondary : softHover,
                navButtonHoverText: hover,
                navButtonBorder: subtleBorder,
                navButtonHoverBorder: primary,
                boxBackgroundColor: panelBg,
                boxBorderRadiusPx: preset.radiusPx,
                boxBorderWidthPx: preset.borderWidthPx,
                boxBorderColor: subtleBorder,
                boxPaddingPx: preset.matrixPaddingPx,
                textButtons: {
                    ...baseMatrix.textButtons,
                    backgroundColor: panelBg,
                    hoverBackgroundColor: preset.id === "bold-maker" ? secondary : softHover,
                    textColor: heading,
                    hoverTextColor: hover,
                    selectedBackgroundColor: primary,
                    selectedTextColor: primaryFillText,
                    borderRadiusPx: preset.tightRadiusPx,
                    borderWidthPx: preset.borderWidthPx,
                    borderColor: subtleBorder,
                    hoverBorderColor: primary,
                    paddingPx: preset.optionButtonPaddingPx,
                    minHeightPx: preset.id === "bold-maker" ? 46 : 44,
                    fontFamily: preset.fonts.body,
                },
                pictureButtons: {
                    ...baseMatrix.pictureButtons,
                    imageBorderRadiusPx: preset.tightRadiusPx,
                    backgroundColor: panelBg,
                    textColor: heading,
                    hoverTextColor: hover,
                    borderWidthPx: preset.borderWidthPx,
                    borderColor: subtleBorder,
                    hoverBorderColor: hover,
                    selectedBorderColor: primary,
                    selectedRingColor: primary,
                    hoverEffect: preset.pictureHoverEffect,
                    selectedEffect: preset.pictureSelectedEffect,
                    hoverColor: hover,
                    hoverOpacity: isDark ? 0.2 : 0.14,
                    selectedColor: primary,
                    selectedOpacity: isDark ? 0.28 : 0.2,
                    outlineEnabled: true,
                    outlineOpacity: 1,
                    hoverZoomEnabled: true,
                    hoverZoomScale: preset.pictureHoverScale,
                    hoverZoomDurationMs: 180,
                },
            },
            pricePanel: {
                ...basePricePanel,
                backgroundType: preset.productBackgroundType,
                backgroundColor: panelBg,
                gradientStart: isDark ? "#0F172A" : softPrimary,
                gradientEnd: panelBg,
                gradientAngle: 135,
                shadow: preset.buttonShadow,
                titleColor: heading,
                textColor: heading,
                mutedTextColor: body,
                priceColor: pricing,
                borderColor: subtleBorder,
                borderWidth: preset.borderWidthPx,
                radiusPx: preset.radiusPx,
                dividerColor: subtleBorder,
                optionBg: panelBg,
                optionHoverBg: preset.id === "bold-maker" ? secondary : softHover,
                optionSelectedBg: softPrimary,
                optionBorderColor: subtleBorder,
                optionHoverBorderColor: primary,
                optionSelectedBorderColor: primary,
                badgeBg: softPrimary,
                badgeText: pricing,
                badgeBorderColor: primary,
                downloadButtonBg: panelBg,
                downloadButtonHoverBg: preset.id === "bold-maker" ? secondary : softHover,
                downloadButtonText: heading,
                downloadButtonHoverText: hover,
                downloadButtonBorder: subtleBorder,
                downloadButtonHoverBorder: primary,
                downloadButtonSurfaceStyle: preset.buttonSurfaceStyle,
                downloadButtonGradientStart: panelBg,
                downloadButtonGradientEnd: isDark ? "#0B1220" : hexToRgba(card, 0.72),
                downloadButtonHoverGradientStart: preset.id === "glass-studio" ? "rgba(255, 255, 255, 0.92)" : softHover,
                downloadButtonHoverGradientEnd: preset.id === "bold-maker" ? secondary : panelBg,
                downloadButtonShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
                downloadButtonHoverShadow: preset.buttonShadow,
            },
            orderButtons: {
                ...baseOrderButtons,
                font: preset.fonts.heading,
                animation: preset.orderButtonAnimation,
                radiusPx: preset.buttonRadiusPx,
                shadow: preset.buttonShadow,
                hoverShadow: preset.buttonHoverShadow,
                hoverScale: preset.buttonHoverScale,
                hoverY: preset.buttonHoverY,
                tapScale: preset.buttonTapScale,
                transitionMs: preset.buttonTransitionMs,
                motionStyle: preset.id === "glass-studio" ? "elastic" : preset.id === "bold-maker" ? "press" : "smooth",
                surfaceStyle: preset.buttonSurfaceStyle,
                gradientStart: preset.buttonGradientStart,
                gradientEnd: preset.buttonGradientEnd,
                hoverGradientStart: preset.buttonHoverGradientStart,
                hoverGradientEnd: preset.buttonHoverGradientEnd,
                innerShadow: preset.buttonInnerShadow,
                sheenColor: preset.buttonSheenColor,
                primary: {
                    ...baseOrderButtons.primary,
                    bgColor: primary,
                    hoverBgColor: hover,
                    gradientStart: preset.buttonGradientStart,
                    gradientEnd: preset.buttonGradientEnd,
                    hoverGradientStart: preset.buttonHoverGradientStart,
                    hoverGradientEnd: preset.buttonHoverGradientEnd,
                    textColor: buttonText,
                    hoverTextColor: buttonHoverText,
                    borderColor: primary,
                    hoverBorderColor: hover,
                },
                secondary: {
                    ...baseOrderButtons.secondary,
                    bgColor: panelBg,
                    hoverBgColor: preset.id === "bold-maker" ? secondary : softHover,
                    gradientStart: panelBg,
                    gradientEnd: preset.cardStyle === "glass" ? hexToRgba(card, 0.58) : panelBg,
                    hoverGradientStart: preset.id === "bold-maker" ? secondary : softHover,
                    hoverGradientEnd: panelBg,
                    textColor: heading,
                    hoverTextColor: hover,
                    borderColor: subtleBorder,
                    hoverBorderColor: primary,
                },
                selected: {
                    ...baseOrderButtons.selected,
                    bgColor: primary,
                    hoverBgColor: hover,
                    gradientStart: preset.buttonGradientStart,
                    gradientEnd: preset.buttonGradientEnd,
                    hoverGradientStart: preset.buttonHoverGradientStart,
                    hoverGradientEnd: preset.buttonHoverGradientEnd,
                    textColor: buttonText,
                    hoverTextColor: buttonHoverText,
                    borderColor: primary,
                    hoverBorderColor: hover,
                },
            },
            optionSelectors: {
                ...baseOptionSelectors,
                button: {
                    ...baseOptionSelectors.button,
                    bgColor: panelBg,
                    textColor: heading,
                    selectedBgColor: primary,
                    selectedTextColor: primaryFillText,
                    hoverBgColor: preset.id === "bold-maker" ? secondary : softHover,
                    hoverTextColor: hover,
                    borderRadius: preset.tightRadiusPx,
                    borderColor: subtleBorder,
                    borderWidth: preset.borderWidthPx,
                    selectedRingColor: primary,
                    hoverRingEnabled: true,
                    paddingPx: preset.optionButtonPaddingPx,
                    fontSizePx: preset.id === "bold-maker" ? 15 : 14,
                    shadow: preset.id === "bold-maker" ? preset.buttonShadow : "0 6px 16px rgba(15, 23, 42, 0.08)",
                    hoverShadow: preset.buttonHoverShadow,
                    selectedShadow: preset.buttonHoverShadow,
                    hoverScale: preset.buttonHoverScale,
                    hoverY: preset.buttonHoverY,
                    tapScale: preset.buttonTapScale,
                    transitionMs: preset.buttonTransitionMs,
                    motionStyle: preset.id === "glass-studio" ? "elastic" : preset.id === "bold-maker" ? "press" : "smooth",
                    surfaceStyle: preset.buttonSurfaceStyle,
                    gradientStart: preset.cardStyle === "glass" ? preset.buttonGradientStart : panelBg,
                    gradientEnd: preset.cardStyle === "glass" ? preset.buttonGradientEnd : panelBg,
                    hoverGradientStart: preset.id === "bold-maker" ? secondary : softHover,
                    hoverGradientEnd: panelBg,
                    innerShadow: preset.cardStyle === "glass" ? preset.buttonInnerShadow : "inset 0 1px 0 rgba(255, 255, 255, 0.18)",
                    sheenColor: preset.buttonSheenColor,
                },
                image: {
                    ...baseOptionSelectors.image,
                    sizePx: preset.optionImageSizePx,
                    borderRadius: preset.tightRadiusPx,
                    bgColor: panelBg,
                    selectedBgColor: softPrimary,
                    hoverBgColor: preset.id === "bold-maker" ? secondary : softHover,
                    selectedRingColor: primary,
                    hoverRingEnabled: true,
                    hoverRingColor: hover,
                    labelColor: heading,
                    shadow: preset.id === "bold-maker" ? preset.buttonShadow : "0 8px 20px rgba(15, 23, 42, 0.08)",
                    hoverShadow: preset.buttonHoverShadow,
                    selectedShadow: preset.buttonHoverShadow,
                    hoverScale: preset.pictureHoverScale,
                    hoverY: preset.buttonHoverY,
                    tapScale: preset.buttonTapScale,
                    transitionMs: preset.buttonTransitionMs,
                    motionStyle: preset.id === "glass-studio" ? "elastic" : preset.id === "bold-maker" ? "press" : "smooth",
                    surfaceStyle: preset.buttonSurfaceStyle,
                    innerShadow: preset.buttonInnerShadow,
                    sheenColor: preset.buttonSheenColor,
                },
                dropdown: {
                    ...baseOptionSelectors.dropdown,
                    bgColor: panelBg,
                    textColor: heading,
                    borderColor: subtleBorder,
                    borderRadius: preset.tightRadiusPx,
                },
                checkbox: {
                    ...baseOptionSelectors.checkbox,
                    accentColor: primary,
                    labelColor: heading,
                },
            },
        },
    };
};

const buildFontPresetThemePatch = (
    draft: typeof DEFAULT_BRANDING,
    presetFonts: BrandingFontPresetFonts,
): Partial<typeof DEFAULT_BRANDING> => {
    const fonts = {
        ...draft.fonts,
        ...presetFonts,
    };
    const heading = fonts.heading || DEFAULT_BRANDING.fonts.heading;
    const body = fonts.body || DEFAULT_BRANDING.fonts.body;
    const pricing = fonts.pricing || DEFAULT_BRANDING.fonts.pricing;
    const currentHero = draft.hero || DEFAULT_BRANDING.hero;
    const currentHeroOverlay = currentHero.overlay || DEFAULT_BRANDING.hero.overlay;
    const currentUspStrip = draft.uspStrip || DEFAULT_BRANDING.uspStrip;
    const currentForside = draft.forside || DEFAULT_BRANDING.forside;
    const currentProductsSection = currentForside.productsSection || DEFAULT_BRANDING.forside.productsSection;
    const currentBanner2 = currentForside.banner2 || DEFAULT_BRANDING.forside.banner2;
    const currentProductPage = draft.productPage || DEFAULT_BRANDING.productPage;
    const currentMatrix = currentProductPage.matrix || DEFAULT_BRANDING.productPage.matrix;
    const currentOrderButtons = currentProductPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;

    return {
        fonts,
        header: {
            ...draft.header,
            logoFont: heading,
            fontId: body,
            dropdownCategoryFontId: body,
            dropdownProductFontId: body,
        },
        hero: {
            ...currentHero,
            overlay: {
                ...currentHeroOverlay,
                titleFontId: heading,
                subtitleFontId: body,
            } as typeof currentHeroOverlay,
            images: (currentHero.images || []).map((image) => ({
                ...image,
                titleFontId: heading,
                subtitleFontId: body,
            })),
        },
        uspStrip: {
            ...currentUspStrip,
            titleFont: heading,
            descriptionFont: body,
        },
        forside: {
            ...currentForside,
            banner2: {
                ...currentBanner2,
                headingFont: heading,
                subtitleFont: body,
                slides: (currentBanner2.slides || []).map((slide) => ({
                    ...slide,
                    items: (slide.items || []).map((item) => ({
                        ...item,
                        titleFont: heading,
                        descriptionFont: body,
                    })),
                })),
            },
            productsSection: {
                ...currentProductsSection,
                card: {
                    ...currentProductsSection.card,
                    titleFont: heading,
                    bodyFont: body,
                    priceFont: pricing,
                },
                button: {
                    ...currentProductsSection.button,
                    font: heading,
                },
            },
            contentBlocks: (currentForside.contentBlocks || []).map((block) => ({
                ...block,
                headingFont: heading,
                textFont: body,
            })),
        },
        productPage: {
            ...currentProductPage,
            heading: {
                ...currentProductPage.heading,
                font: heading,
                subtext: {
                    ...currentProductPage.heading.subtext,
                    font: body,
                },
            },
            infoSection: {
                ...currentProductPage.infoSection,
                titleFont: heading,
                textFont: body,
            },
            matrix: {
                ...currentMatrix,
                font: body,
            },
            orderButtons: {
                ...currentOrderButtons,
                font: heading,
            },
        },
    };
};

interface BrandingColorFieldConfig {
    key: BrandingColorKey;
    label: string;
    description: string;
}

type MatrixColorKey = Exclude<keyof typeof DEFAULT_BRANDING.productPage.matrix, "font" | "pictureButtons">;

interface MatrixColorFieldConfig {
    key: MatrixColorKey;
    label: string;
    description: string;
}

type PricePanelColorKey = Exclude<
    keyof typeof DEFAULT_BRANDING.productPage.pricePanel,
    "backgroundType" | "gradientAngle" | "borderWidth" | "radiusPx"
>;

interface PricePanelColorFieldConfig {
    key: PricePanelColorKey;
    label: string;
    description: string;
}

interface BrandingColorGroupConfig {
    title: string;
    description: string;
    badge?: string;
    fields: BrandingColorFieldConfig[];
}

type ContextualEditorState =
    | {
        kind: "usp-icon";
        itemId: string;
        rawId: string;
        label: string;
    }
    | {
        kind: "product-option-button";
        productId: string;
        sectionId: string;
        valueId: string;
        valueName: string;
        rawId: string;
        label: string;
    }
    | {
        kind: "product-option-section-box";
        productId: string;
        sectionId: string;
        sectionName: string;
        rawId: string;
        label: string;
    };

type PreviewPageLink = {
    label: string;
    path: string;
    action?: "first-product";
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hexToRgba = (color: string, alpha: number): string => {
    const normalized = String(color || "").trim();
    const a = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);

    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split("").map((c) => parseInt(c + c, 16));
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    if (longMatch) {
        const hex = longMatch[1];
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    return normalized || `rgba(0, 0, 0, ${a})`;
};

const getReadableTextForSolid = (background: string, preferred = "#FFFFFF"): string => {
    const normalized = String(background || "").trim();
    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    const hex = shortMatch
        ? shortMatch[1].split("").map((part) => `${part}${part}`).join("")
        : longMatch?.[1];

    if (!hex) return preferred;

    const channels = [0, 2, 4].map((index) => {
        const value = parseInt(hex.slice(index, index + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance > 0.48 ? "#0F172A" : "#FFFFFF";
};

const PREVIEW_PAGE_LINKS: PreviewPageLink[] = [
    { label: "Forside", path: "/" },
    { label: "Produkter", path: "/produkter" },
    { label: "Bestilling", path: "/produkter", action: "first-product" },
    { label: "Grafisk vejledning", path: "/grafisk-vejledning" },
    { label: "Kontakt", path: "/kontakt" },
    { label: "Om os", path: "/om-os" },
];

const USP_ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
    { value: "truck", label: "Lastbil", icon: Truck },
    { value: "award", label: "Pris", icon: Award },
    { value: "phone", label: "Support", icon: Phone },
    { value: "shield", label: "Sikkerhed", icon: Shield },
    { value: "clock", label: "Hurtigt", icon: Clock },
    { value: "star", label: "Anbefalet", icon: Star },
    { value: "heart", label: "Favorit", icon: Heart },
    { value: "check", label: "Godkendt", icon: Check },
];

function resolveContextualEditor(rawId?: string | null): ContextualEditorState | null {
    if (!rawId) return null;

    const uspIconMatch = /^usp-strip\.item\.([^.]+)\.icon$/.exec(rawId);
    if (uspIconMatch) {
        return {
            kind: "usp-icon",
            itemId: uspIconMatch[1],
            rawId,
            label: "USP ikon",
        };
    }

    // Product option button click: product-option.<productId>.<sectionId>.<valueId>.<valueName>
    const productOptionMatch = /^product-option\.([^\.]+)\.([^\.]+)\.([^\.]+)\.(.+)$/.exec(rawId);
    if (productOptionMatch) {
        const [, productId, sectionId, valueId, valueName] = productOptionMatch;
        return {
            kind: "product-option-button",
            productId,
            sectionId,
            valueId,
            valueName: decodeURIComponent(valueName),
            rawId,
            label: `Knap: ${decodeURIComponent(valueName)}`,
        };
    }

    // Product selector box click: product-selector-box.<productId>.<sectionId>.<sectionName>
    const productSelectorBoxMatch = /^product-selector-box\.([^\.]+)\.([^\.]+)\.(.+)$/.exec(rawId);
    if (productSelectorBoxMatch) {
        const [, productId, sectionId, sectionName] = productSelectorBoxMatch;
        const decodedSectionName = decodeURIComponent(sectionName);
        return {
            kind: "product-option-section-box",
            productId,
            sectionId,
            sectionName: decodedSectionName,
            rawId,
            label: `Valgboks: ${decodedSectionName}`,
        };
    }

    return null;
}

const SECTION_LABELS: Record<string, string> = {
    theme: "Tema",
    logo: "Logo & Favicon",
    header: "Header & Menu",
    typography: "Typografi",
    "page-background": "Sidebaggrund",
    colors: "Farver",
    banner: "Banner (Hero)",
    showcase: "Banner 2 / Showcase",
    "usp-strip": "USP Strip (Fordele)",
    "seo-content": "SEO Tekst",
    products: "Forside produkter",
    "product-page-matrix": "Produktside matrix, prisberegner & knapper",
    "produktvalgknapper": "Produktvalgknapper",
    "product-description": "Produktbeskrivelse",
    content: "Indholdsblokke",
    footer: "Footer",
    icons: "Produktbilleder (Ikoner)",
};

type SectionGroupId = "global" | "home" | "product";

interface SectionGroupConfig {
    id: SectionGroupId;
    title: string;
    description: string;
}

interface SectionButtonConfig {
    id: string;
    label: string;
    group: SectionGroupId;
    icon: LucideIcon;
    buttonClassName: string;
    iconWrapperClassName: string;
    iconClassName: string;
}

const SECTION_GROUPS: SectionGroupConfig[] = [
    {
        id: "global",
        title: "Globalt",
        description: "Disse indstillinger påvirker overordnede dele af sitet på tværs af sider.",
    },
    {
        id: "home",
        title: "Forside",
        description: "Disse værktøjer bruges på forsiden og katalogvisningen.",
    },
    {
        id: "product",
        title: "Produktside",
        description: "Disse værktøjer gælder kun for produktsidens prismatrix, prisberegner og valgknapper.",
    },
];

const SECTION_BUTTON_CONFIGS: SectionButtonConfig[] = [
    {
        id: "logo",
        label: "Logo & Favicon",
        group: "global",
        icon: ImageIcon,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-indigo-100 text-indigo-900 hover:bg-indigo-50/50 hover:border-indigo-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "header",
        label: "Header & Menu",
        group: "global",
        icon: Layout,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-slate-100 text-slate-900 hover:bg-slate-50/50 hover:border-slate-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-slate-100/50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "typography",
        label: "Typografi",
        group: "global",
        icon: Type,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-amber-100 text-amber-900 hover:bg-amber-50/50 hover:border-amber-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-amber-100/50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "page-background",
        label: "Sidebaggrund",
        group: "global",
        icon: Palette,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-rose-100 text-rose-900 hover:bg-rose-50/50 hover:border-rose-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-rose-100/50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "colors",
        label: "Farver",
        group: "global",
        icon: Palette,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-pink-100 text-pink-900 hover:bg-pink-50/50 hover:border-pink-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-pink-100/50 flex items-center justify-center text-pink-600 group-hover:bg-pink-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "theme",
        label: "Tema",
        group: "global",
        icon: LayoutTemplate,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-violet-100 text-violet-900 hover:bg-violet-50/50 hover:border-violet-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-violet-100/50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "footer",
        label: "Footer",
        group: "global",
        icon: Layout,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-slate-100 text-slate-900 hover:bg-slate-50/50 hover:border-slate-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-slate-100/50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "usp-strip",
        label: "USP Strip (Fordele)",
        group: "home",
        icon: Award,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-teal-100 text-teal-900 hover:bg-teal-50/50 hover:border-teal-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-teal-100/50 flex items-center justify-center text-teal-600 group-hover:bg-teal-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "seo-content",
        label: "SEO Tekst",
        group: "home",
        icon: Type,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "banner",
        label: "Banner (Hero)",
        group: "home",
        icon: ImageIcon,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-blue-100 text-blue-900 hover:bg-blue-50/50 hover:border-blue-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-blue-100/50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "showcase",
        label: "Banner 2 / Showcase",
        group: "home",
        icon: Sparkles,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-fuchsia-100 text-fuchsia-900 hover:bg-fuchsia-50/50 hover:border-fuchsia-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-fuchsia-100/50 flex items-center justify-center text-fuchsia-600 group-hover:bg-fuchsia-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "products",
        label: "Forside produkter",
        group: "home",
        icon: ShoppingCart,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-sky-100 text-sky-900 hover:bg-sky-50/50 hover:border-sky-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-sky-100/50 flex items-center justify-center text-sky-600 group-hover:bg-sky-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "content",
        label: "Indholdsblokke",
        group: "home",
        icon: Layout,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-violet-100 text-violet-900 hover:bg-violet-50/50 hover:border-violet-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-violet-100/50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "icons",
        label: "Produktbilleder (Ikoner)",
        group: "home",
        icon: Sparkles,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "product-page-matrix",
        label: "Produktside matrix, prisberegner & knapper",
        group: "product",
        icon: Layout,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-cyan-100 text-cyan-900 hover:bg-cyan-50/50 hover:border-cyan-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-cyan-100/50 flex items-center justify-center text-cyan-600 group-hover:bg-cyan-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "produktvalgknapper",
        label: "Produktvalgknapper",
        group: "product",
        icon: MousePointer2,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-orange-100 text-orange-900 hover:bg-orange-50/50 hover:border-orange-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-orange-100/50 flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "product-description",
        label: "Produktbeskrivelse",
        group: "product",
        icon: FileText,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-indigo-100 text-indigo-900 hover:bg-indigo-50/50 hover:border-indigo-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
];

const BRANDING_COLOR_GROUPS: BrandingColorGroupConfig[] = [
    {
        title: "Side og flader",
        description: "Disse farver styrer de store flader og bokse, som brugeren ser først på forsiden.",
        fields: [
            {
                key: "secondary",
                label: "Sektioner / bløde flader",
                description: "Lyse baggrundssektioner som kategoriområder, infoblokke og skiftende content-bånd.",
            },
            {
                key: "card",
                label: "Bokse og kort",
                description: "Produktbokse, paneler, kort og andre hvide eller løftede flader.",
            },
        ],
    },
    {
        title: "Brand og handlinger",
        description: "Disse farver driver knapper, accenter og de elementer, der skal trække brugerens blik.",
        fields: [
            {
                key: "primary",
                label: "Primær accent",
                description: "Primære knapper, aktive states, highlights og brand-accenter på tværs af siden.",
            },
            {
                key: "pricingText",
                label: "Prisfarve",
                description: "Priser og fremhævede tal, hvor pris skal stå tydeligt frem.",
            },
            {
                key: "linkText",
                label: "Linkfarve",
                description: "Klikbare links i tekst og mindre tekstnære call-to-actions.",
            },
        ],
    },
    {
        title: "Tekst",
        description: "De centrale tekstfarver på siden. Disse skal læses let på tværs af tema og baggrunde.",
        fields: [
            {
                key: "headingText",
                label: "Overskrifter",
                description: "Hovedoverskrifter og stærk forgrundstekst, som sætter den visuelle tone.",
            },
            {
                key: "bodyText",
                label: "Brødtekst",
                description: "Beskrivelser, hjælpe-tekst og almindeligt indhold i produkt- og infosnit.",
            },
        ],
    },
    {
        title: "Avanceret / reserveret",
        description: "Disse felter er ikke de primære storefront-farver. Brug dem kun ved særlige behov.",
        badge: "Avanceret",
        fields: [
            {
                key: "dropdown",
                label: "Dropdown base",
                description: "Reserveret farvefelt. Headerens rigtige dropdown-farver styres i Header-sektionen.",
            },
            {
                key: "hover",
                label: "Generisk hover-accent",
                description: "Reserveret hover-farve. Bruges ikke som den primære hover-styring i hele sitet.",
            },
        ],
    },
];

export function SiteDesignEditorV2({ adapter, capabilities, onSwitchVersion }: SiteDesignEditorV2Props) {
    const editor = useBrandingEditor({ adapter, capabilities });
    const isDraftLive = brandingEquals(editor.draft, editor.published);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false); // Start collapsed for full-screen preview
    const [previewEditMode, setPreviewEditMode] = useState(false);
    const [clearSelectionSignal, setClearSelectionSignal] = useState(0);
    const [currentPreviewPage, setCurrentPreviewPage] = useState<string>("/");
    const [previewNavigationRequest, setPreviewNavigationRequest] = useState<{
        id: number;
        type: "path" | "first-product";
        path?: string;
    } | null>(null);

    // Paid items management (only for tenants)
    const paidItems = usePaidItems(editor.mode === 'tenant' ? editor.entityId : null);
    const [showPendingPurchasesDialog, setShowPendingPurchasesDialog] = useState(false);

    // Dialog States
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [publishLabel, setPublishLabel] = useState("");
    const [showSaveDesignDialog, setShowSaveDesignDialog] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState("");
    const [overwriteDesignId, setOverwriteDesignId] = useState("none");
    const [showSavedDesignsDialog, setShowSavedDesignsDialog] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);

    // Premade Designs feature
    const [showSaveToResourcesDialog, setShowSaveToResourcesDialog] = useState(false);
    const [resourceDesignName, setResourceDesignName] = useState("");
    const [resourceDesignDescription, setResourceDesignDescription] = useState("");
    const [resourceDesignPrice, setResourceDesignPrice] = useState(0);
    const [resourceDesignVisible, setResourceDesignVisible] = useState(true);
    const [showPremadeDesignsDialog, setShowPremadeDesignsDialog] = useState(false);
    const [availablePremadeDesigns, setAvailablePremadeDesigns] = useState<any[]>([]);
    const [loadingPremadeDesigns, setLoadingPremadeDesigns] = useState(false);
    const [capturingThumbnail, setCapturingThumbnail] = useState(false);

    // Saved Premade Designs management (Master)
    const [showSavedPremadeDesignsDialog, setShowSavedPremadeDesignsDialog] = useState(false);
    const [savedPremadeDesigns, setSavedPremadeDesigns] = useState<any[]>([]);
    const [loadingSavedDesigns, setLoadingSavedDesigns] = useState(false);
    const [tenantList, setTenantList] = useState<any[]>([]);

    // Edit premade design state
    const [editingDesign, setEditingDesign] = useState<{
        id: string;
        name: string;
        description: string;
        price: number;
        is_visible: boolean;
        thumbnail_url?: string;
    } | null>(null);
    const [savingDesignEdit, setSavingDesignEdit] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
    const [focusedTargetId, setFocusedTargetId] = useState<string | null>(null);
    const [contextualEditor, setContextualEditor] = useState<ContextualEditorState | null>(null);
    const [focusedProductOption, setFocusedProductOption] = useState<{ productId: string; sectionId: string | null; valueId?: string | null; valueName?: string | null } | null>(null);
    const [persistedProductPricing, setPersistedProductPricing] = useState<{ productId: string; pricingStructure: unknown } | null>(null);
    const [productPricingPreview, setProductPricingPreview] = useState<{
        productId: string;
        pricingStructure: unknown;
        isDirty: boolean;
    } | null>(null);
    const [focusRequestId, setFocusRequestId] = useState(0);
    const [featuredProducts, setFeaturedProducts] = useState<FeaturedProductOption[]>([]);
    const [loadingFeaturedProducts, setLoadingFeaturedProducts] = useState(false);
    const [featuredQuantityOptions, setFeaturedQuantityOptions] = useState<number[]>([]);
    const [loadingFeaturedQuantities, setLoadingFeaturedQuantities] = useState(false);
    const [uploadingPageBackgroundImage, setUploadingPageBackgroundImage] = useState(false);
    const [uploadingFeaturedSideImage, setUploadingFeaturedSideImage] = useState(false);
    const [uploadingFeaturedMainImage, setUploadingFeaturedMainImage] = useState(false);
    const [uploadingFeaturedGalleryImage, setUploadingFeaturedGalleryImage] = useState(false);
    const [colorPresetName, setColorPresetName] = useState("");

    // Ref for screenshot capture promise resolution
    const screenshotResolverRef = useRef<{ resolve: (url: string | null) => void; reject: (err: any) => void } | null>(null);

    const currentPreviewProduct = useMemo(() => {
        const match = /^\/produkt\/([^/?#]+)/.exec(currentPreviewPage);
        if (!match) return null;

        const slug = decodeURIComponent(match[1]);
        return featuredProducts.find((product) => product.slug === slug) || null;
    }, [currentPreviewPage, featuredProducts]);

    const saveColorSwatch = useCallback((color: string) => {
        const swatches = editor.draft.savedSwatches || [];
        if (!swatches.includes(color) && swatches.length < 20) {
            editor.updateDraft({ savedSwatches: [...swatches, color] });
        }
    }, [editor]);

    const removeColorSwatch = useCallback((color: string) => {
        editor.updateDraft({
            savedSwatches: (editor.draft.savedSwatches || []).filter((candidate) => candidate !== color),
        });
    }, [editor]);

    const updatePageBackgroundColors = useCallback((patch: Partial<typeof DEFAULT_BRANDING.colors>) => {
        editor.updateDraft({
            colors: {
                ...editor.draft.colors,
                ...patch,
            },
        });
    }, [editor]);

    const handlePageBackgroundImageUpload = useCallback(async (file: File) => {
        try {
            setUploadingPageBackgroundImage(true);
            const url = await editor.uploadAsset(file, "hero-image");
            updatePageBackgroundColors({
                backgroundImageUrl: url,
                backgroundType: "image",
            });
        } catch (error) {
            console.error("Error uploading page background image:", error);
            toast.error("Kunne ikke uploade baggrundsbilledet");
        } finally {
            setUploadingPageBackgroundImage(false);
        }
    }, [editor, updatePageBackgroundColors]);

    const openPreviewSelection = useCallback((rawSectionId?: string | null) => {
        console.log('[Editor] openPreviewSelection called with:', rawSectionId);
        if (!rawSectionId) return;

        const selection = resolveSiteDesignTarget(rawSectionId);
        const contextualSelection = resolveContextualEditor(rawSectionId);
        console.log('[Editor] Resolved selection:', selection, 'contextual:', contextualSelection);
        
        // For product option clicks, open the sidebar instead of the floating contextual popup.
        const isProductOptionButton = contextualSelection?.kind === 'product-option-button';
        const isProductOptionSectionBox = contextualSelection?.kind === 'product-option-section-box';

        if (isProductOptionButton && contextualSelection.kind === "product-option-button") {
            setFocusedProductOption({
                productId: contextualSelection.productId,
                sectionId: contextualSelection.sectionId,
                valueId: contextualSelection.valueId,
                valueName: contextualSelection.valueName,
            });
        } else if (isProductOptionSectionBox && contextualSelection.kind === "product-option-section-box") {
            setFocusedProductOption({
                productId: contextualSelection.productId,
                sectionId: contextualSelection.sectionId,
                valueId: null,
                valueName: contextualSelection.sectionName,
            });
        } else if (selection?.sectionId === "produktvalgknapper" && currentPreviewProduct?.id) {
            setFocusedProductOption({
                productId: currentPreviewProduct.id,
                sectionId: null,
                valueId: null,
                valueName: null,
            });
        } else if (selection?.sectionId !== "produktvalgknapper") {
            setFocusedProductOption(null);
        }
        
        if (selection) {
            console.log('[Editor] Setting active section to:', selection.sectionId);
            setActiveSection(selection.sectionId);
            setFocusedBlockId(selection.focusedBlockId ?? null);
            setFocusedTargetId(selection.focusTargetId ?? null);
        } else {
            console.log('[Editor] No selection found, using raw ID:', rawSectionId);
            setActiveSection(rawSectionId);
            setFocusedBlockId(null);
            setFocusedTargetId(null);
        }

        // Product option buttons are handled directly by the Produktvalgknapper sidebar.
        if (!isProductOptionButton) {
            setContextualEditor(contextualSelection);
        } else {
            setContextualEditor(null);
        }

        if (!contextualSelection || isProductOptionButton || isProductOptionSectionBox) {
            // Clear any existing selection highlight in preview
            setClearSelectionSignal(prev => prev + 1);
        }

        setFocusRequestId((current) => current + 1);
        // Open sidebar for product option clicks too.
        if (!contextualSelection || isProductOptionButton || isProductOptionSectionBox) {
            setSidebarOpen(true);
        }
    }, [currentPreviewProduct]);

    const clearFocusedSelection = useCallback(() => {
        setFocusedBlockId(null);
        setFocusedTargetId(null);
        setContextualEditor(null);
        setFocusedProductOption(null);
        setFocusRequestId((current) => current + 1);
    }, []);
    
    const closeSection = useCallback(() => {
        setActiveSection(null);
        setFocusedBlockId(null);
        setFocusedTargetId(null);
        setContextualEditor(null);
        setClearSelectionSignal(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!activeSection || !focusedTargetId) return;

        const timeoutId = window.setTimeout(() => {
            const element = document.getElementById(focusedTargetId);
            if (!element) return;

            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("ring-2", "ring-primary", "ring-offset-2");

            window.setTimeout(() => {
                element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
            }, 1800);
        }, 120);

        return () => window.clearTimeout(timeoutId);
    }, [activeSection, focusedTargetId, focusRequestId]);

    useEffect(() => {
        if (!previewEditMode) {
            setContextualEditor(null);
        }
    }, [previewEditMode]);

    useEffect(() => {
        setContextualEditor(null);
    }, [currentPreviewPage]);

    // Listen for click events from preview AND screenshot responses
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            console.log('[Editor] Received message:', event.data);
            
            if (event.data?.type === 'EDIT_SECTION' || event.data?.type === 'ELEMENT_CLICKED') {
                console.log('[Editor] Opening section:', event.data?.sectionId);
                openPreviewSelection(event.data?.sectionId);
            }

            if (event.data?.type === 'PREVIEW_PAGE_CHANGED' || event.data?.type === 'PREVIEW_NAVIGATION') {
                const path = typeof event.data.path === 'string' ? event.data.path : '/';
                setCurrentPreviewPage(path);
            }

            // Handle screenshot capture response
            if (event.data?.type === 'SCREENSHOT_CAPTURED' && screenshotResolverRef.current) {
                screenshotResolverRef.current.resolve(event.data.dataUrl);
                screenshotResolverRef.current = null;
            }
            if (event.data?.type === 'SCREENSHOT_ERROR' && screenshotResolverRef.current) {
                console.error('Screenshot error:', event.data.error);
                screenshotResolverRef.current.resolve(null); // Resolve with null instead of rejecting
                screenshotResolverRef.current = null;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [openPreviewSelection]);

    useEffect(() => {
        let cancelled = false;

        async function loadFeaturedProducts() {
            if (!editor.entityId) return;
            setLoadingFeaturedProducts(true);

            const { data, error } = await supabase
                .from('products')
                .select('id, name, slug, pricing_type')
                .eq('tenant_id', editor.entityId)
                .order('name');

            if (cancelled) return;

            if (error) {
                console.error('Error loading featured products:', error);
                setFeaturedProducts([]);
            } else {
                setFeaturedProducts((data || []) as FeaturedProductOption[]);
            }

            setLoadingFeaturedProducts(false);
        }

        loadFeaturedProducts();

        return () => {
            cancelled = true;
        };
    }, [editor.entityId]);

    useEffect(() => {
        const featuredProductId = editor.draft.forside?.productsSection?.featuredProductConfig?.productId;
        const selectedFeaturedProduct = featuredProducts.find((product) => product.id === featuredProductId);

        if (!featuredProductId || selectedFeaturedProduct?.pricing_type === "STORFORMAT") {
            setFeaturedQuantityOptions([]);
            setLoadingFeaturedQuantities(false);
            return;
        }

        let cancelled = false;

        async function loadFeaturedQuantities() {
            setLoadingFeaturedQuantities(true);

            const { data, error } = await supabase
                .from('generic_product_prices')
                .select('quantity')
                .eq('product_id', featuredProductId)
                .order('quantity');

            if (cancelled) return;

            if (error) {
                console.error('Error loading featured product quantities:', error);
                setFeaturedQuantityOptions([]);
            } else {
                const quantities = Array.from(
                    new Set(
                        (data || [])
                            .map((row: any) => Number(row.quantity))
                            .filter((value) => Number.isFinite(value) && value > 0)
                    )
                ).sort((a, b) => a - b);
                setFeaturedQuantityOptions(quantities);
            }

            setLoadingFeaturedQuantities(false);
        }

        loadFeaturedQuantities();

        return () => {
            cancelled = true;
        };
    }, [editor.draft.forside?.productsSection?.featuredProductConfig?.productId, featuredProducts]);

    // Capture and upload a thumbnail from the preview iframe
    const capturePreviewThumbnail = useCallback(async (): Promise<string | null> => {
        setCapturingThumbnail(true);
        try {
            // Find the preview iframe
            const iframe = document.querySelector('iframe[title="Branding Preview"]') as HTMLIFrameElement;
            if (!iframe || !iframe.contentWindow) {
                console.warn('Preview iframe not found');
                return null;
            }

            // Request screenshot from iframe
            const requestId = Date.now().toString();
            const screenshotPromise = new Promise<string | null>((resolve, reject) => {
                screenshotResolverRef.current = { resolve, reject };

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (screenshotResolverRef.current) {
                        screenshotResolverRef.current.resolve(null);
                        screenshotResolverRef.current = null;
                    }
                }, 10000);
            });

            iframe.contentWindow.postMessage({ type: 'CAPTURE_SCREENSHOT', requestId }, '*');

            const dataUrl = await screenshotPromise;
            if (!dataUrl) {
                console.warn('Screenshot capture failed or timed out');
                return null;
            }

            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // Upload to Supabase storage
            const fileName = `premade-thumb-${Date.now()}.jpg`;
            const filePath = `premade-designs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, blob, { contentType: 'image/jpeg' });

            if (uploadError) {
                console.error('Thumbnail upload error:', uploadError);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error capturing thumbnail:', error);
            return null;
        } finally {
            setCapturingThumbnail(false);
        }
    }, []);

    const uploadFeaturedSidePanelImage = useCallback(async (file: File): Promise<string | null> => {
        try {
            setUploadingFeaturedSideImage(true);
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `featured-side-panel-${Date.now()}.${fileExt}`;
            const filePath = `branding/${editor.entityId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.error('Featured side panel upload error:', uploadError);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading featured side panel image:', error);
            return null;
        } finally {
            setUploadingFeaturedSideImage(false);
        }
    }, [editor.entityId]);

    const uploadFeaturedMainImage = useCallback(async (file: File): Promise<string | null> => {
        try {
            setUploadingFeaturedMainImage(true);
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `featured-main-image-${Date.now()}.${fileExt}`;
            const filePath = `branding/${editor.entityId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.error('Featured main image upload error:', uploadError);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading featured main image:', error);
            return null;
        } finally {
            setUploadingFeaturedMainImage(false);
        }
    }, [editor.entityId]);

    const uploadFeaturedGalleryImage = useCallback(async (file: File): Promise<string | null> => {
        try {
            setUploadingFeaturedGalleryImage(true);
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `featured-gallery-${Date.now()}.${fileExt}`;
            const filePath = `branding/${editor.entityId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.error('Featured gallery upload error:', uploadError);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading featured gallery image:', error);
            return null;
        } finally {
            setUploadingFeaturedGalleryImage(false);
        }
    }, [editor.entityId]);

    const navigatePreviewTo = useCallback((path: string) => {
        setCurrentPreviewPage(path);
        setPreviewNavigationRequest({
            id: Date.now(),
            type: "path",
            path,
        });
    }, []);

    const navigatePreviewToFirstProduct = useCallback(() => {
        setCurrentPreviewPage("/produkt");
        setPreviewNavigationRequest({
            id: Date.now(),
            type: "first-product",
        });
    }, []);

    const isHomePreviewPage = currentPreviewPage === "/"
        || currentPreviewPage === "/shop"
        || currentPreviewPage === "/produkter"
        || currentPreviewPage === "/prisberegner";
    const isProductPreviewPage = currentPreviewPage === "/produkt" || currentPreviewPage.startsWith("/produkt/");

    const currentPreviewPageLabel = useMemo(() => {
        if (currentPreviewPage.startsWith("/produkt/") || currentPreviewPage === "/produkt") {
            return "Produktside";
        }
        const exactMatch = PREVIEW_PAGE_LINKS.find((page) => page.path === currentPreviewPage);
        if (exactMatch) return exactMatch.label;
        if (currentPreviewPage === "/shop" || currentPreviewPage === "/prisberegner") {
            return "Produkter";
        }
        return "Aktuel side";
    }, [currentPreviewPage]);

    const currentPreviewPageTypeLabel = isProductPreviewPage
        ? "Produktside"
        : isHomePreviewPage
            ? "Forside / katalog"
            : "Indholdsside";

    const allowedSections = useMemo(() => {
        const sections = new Set<string>(["theme"]);
        if (capabilities.sections.logo) sections.add("logo");
        if (capabilities.sections.header) sections.add("header");
        if (capabilities.sections.footer) sections.add("footer");
        if (capabilities.sections.typography) sections.add("typography");
        if (capabilities.sections.colors) {
            sections.add("page-background");
            sections.add("colors");
        }

        if (isHomePreviewPage) {
            sections.add("banner");
            sections.add("showcase");
            sections.add("usp-strip");
            sections.add("seo-content");
            sections.add("products");
            sections.add("content");
            if (capabilities.sections.iconPacks) sections.add("icons");
        }

        if (isProductPreviewPage) {
            sections.add("product-page-matrix");
            sections.add("produktvalgknapper");
            sections.add("product-description");
        }

        return sections;
    }, [
        capabilities.sections.colors,
        capabilities.sections.footer,
        capabilities.sections.header,
        capabilities.sections.iconPacks,
        capabilities.sections.logo,
        capabilities.sections.typography,
        isHomePreviewPage,
        isProductPreviewPage,
        // Note: usp-strip is always shown on home preview
    ]);

    const allowedSectionLabels = useMemo(() => {
        return Array.from(allowedSections).map((section) => SECTION_LABELS[section] || section);
    }, [allowedSections]);

    useEffect(() => {
        if (activeSection && !allowedSections.has(activeSection)) {
            closeSection();
        }
    }, [activeSection, allowedSections]);

    // ... existing publish/save handlers ...

    const persistCurrentProductPricingPreview = useCallback(async () => {
        if (!productPricingPreview?.productId || !productPricingPreview.isDirty) {
            return true;
        }

        const { error } = await supabase
            .from('products')
            .update({ pricing_structure: productPricingPreview.pricingStructure })
            .eq('id', productPricingPreview.productId)
            .eq('tenant_id', editor.entityId);

        if (error) {
            console.error('Error saving Produktvalgknapper settings:', error);
            toast.error('Kunne ikke gemme produktvalg-indstillinger');
            return false;
        }

        setProductPricingPreview((current) => (
            current?.productId === productPricingPreview.productId
                ? { ...current, isDirty: false }
                : current
        ));
        setPersistedProductPricing({
            productId: productPricingPreview.productId,
            pricingStructure: productPricingPreview.pricingStructure,
        });

        return true;
    }, [editor.entityId, productPricingPreview]);

    const saveDraftWithProductSettings = useCallback(async () => {
        const productSettingsSaved = await persistCurrentProductPricingPreview();
        if (!productSettingsSaved) return;
        await editor.saveDraft();
    }, [editor, persistCurrentProductPricingPreview]);

    // Handle Publish - checks for pending paid items first
    const handlePublish = async () => {
        // If tenant has pending paid items, show payment dialog instead
        if (editor.mode === 'tenant' && paidItems.hasPendingItems) {
            setShowPublishDialog(false);
            setShowPendingPurchasesDialog(true);
            return;
        }

        const productSettingsSaved = await persistCurrentProductPricingPreview();
        if (!productSettingsSaved) return;

        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setShowPublishDialog(false);
        setPublishLabel("");
    };

    // Handle publish after payment is complete
    const handlePublishAfterPayment = async () => {
        const productSettingsSaved = await persistCurrentProductPricingPreview();
        if (!productSettingsSaved) return;

        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setPublishLabel("");
    };

    // Handle Save Design
    const handleSaveDesign = async () => {
        if (!saveDesignName.trim()) {
            toast.error("Giv venligst dit design et navn");
            return;
        }
        const productSettingsSaved = await persistCurrentProductPricingPreview();
        if (!productSettingsSaved) return;
        await editor.saveDesign(saveDesignName);
        setSaveDesignName("");
        setOverwriteDesignId("none");
        setShowSaveDesignDialog(false);
    };

    const handleOverwriteDesign = async () => {
        if (overwriteDesignId === "none") {
            toast.error("Vælg et eksisterende design at overskrive");
            return;
        }
        const existingDesign = editor.savedDesigns.find((design) => design.id === overwriteDesignId);
        if (!existingDesign) {
            toast.error("Kunne ikke finde det valgte design");
            return;
        }
        const productSettingsSaved = await persistCurrentProductPricingPreview();
        if (!productSettingsSaved) return;
        await editor.saveDesign(existingDesign.name, overwriteDesignId);
        setSaveDesignName("");
        setOverwriteDesignId("none");
        setShowSaveDesignDialog(false);
    };

    const formatDate = (timestamp: string) => {
        try {
            return format(new Date(timestamp), "d. MMM yyyy", { locale: da });
        } catch {
            return timestamp;
        }
    };

    if (editor.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const renderSidebarContent = () => {
        if (!activeSection) {
            return (
                <div className="space-y-2 p-3">
                    <h2 className="font-extrabold text-2xl text-foreground pb-4 px-1">
                        Vælg sektion:
                    </h2>
                    <div className="space-y-4">
                        {SECTION_GROUPS.map((group) => {
                            const groupButtons = SECTION_BUTTON_CONFIGS.filter((config) =>
                                config.group === group.id && allowedSections.has(config.id)
                            );

                            if (groupButtons.length === 0) return null;

                            return (
                                <div key={group.id} className="space-y-2">
                                    <div className="px-1">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            {group.title}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {group.description}
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        {groupButtons.map((config) => {
                                            const Icon = config.icon;
                                            return (
                                                <button
                                                    key={config.id}
                                                    className={config.buttonClassName}
                                                    onClick={() => {
                                                        setActiveSection(config.id);
                                                        setFocusedBlockId(null);
                                                        setFocusedTargetId(null);
                                                    }}
                                                >
                                                    <div className={config.iconWrapperClassName}>
                                                        <Icon className={config.iconClassName} />
                                                    </div>
                                                    <span className="font-semibold">{config.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        switch (activeSection) {
            case 'theme': {
                const activeVisualThemePresetId = String((editor.draft.themeSettings as Record<string, unknown> | undefined)?.visualThemePresetId || "");
                const applyVisualThemePreset = (preset: VisualThemePreset) => {
                    editor.updateDraft(buildVisualThemePresetPatch(editor.draft, preset));
                    toast.success(`${preset.name} anvendt på hele designet`);
                };
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Tema</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                        </div>
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-sm">Komplette visuelle presets</CardTitle>
                                </div>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Skifter farver, flader, radius, dropdown, hero-effekter, produktknapper, matrix og prisboks samlet.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 p-3 pt-3">
                                {VISUAL_THEME_PRESETS.map((preset) => {
                                    const isSelected = activeVisualThemePresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            className={`w-full rounded-lg border p-3 text-left transition hover:border-primary/60 hover:bg-muted/30 ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/70 bg-background"}`}
                                            onClick={() => applyVisualThemePreset(preset)}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-xs font-semibold">{preset.name}</span>
                                                        {isSelected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                                                    </div>
                                                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                                        {preset.description}
                                                    </p>
                                                </div>
                                                <div className="flex h-7 w-24 shrink-0 overflow-hidden rounded-md border">
                                                    {BRANDING_COLOR_KEYS.slice(0, 6).map((key) => (
                                                        <span
                                                            key={key}
                                                            className="flex-1"
                                                            style={{ backgroundColor: preset.colors[key] }}
                                                            title={`${key}: ${preset.colors[key]}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {preset.tags.map((tag) => (
                                                    <Badge key={tag} variant="outline" className="h-4 rounded-sm px-1 text-[9px] uppercase">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </CardContent>
                        </Card>
                        <ThemeSelector
                            selectedThemeId={editor.draft.themeId || 'classic'}
                            onThemeChange={(themeId) => {
                                editor.updateDraft({ themeId });
                            }}
                            themeSettings={editor.draft.themeSettings}
                            onThemeSettingsChange={(themeSettings) => {
                                editor.updateDraft({ themeSettings });
                            }}
                        />
                    </div>
                );
            }
            case 'logo':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Logo & Favicon</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                        </div>
                        <LogoSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />

                        {/* Favicon Editor */}
                        <FaviconEditor
                            favicon={editor.draft.favicon}
                            onChange={(favicon) => editor.updateDraft({ favicon })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            tenantId={editor.entityId}
                        />
                    </div>
                );
            case 'header':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Header</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-header") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <HeaderSection
                            header={editor.draft.header}
                            onChange={(header) => editor.updateDraft({ header })}
                            focusTargetId={focusedTargetId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'banner':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Banner (Hero)</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-banner") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <BannerEditor
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            focusTargetId={focusedTargetId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'showcase':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Banner 2 / Showcase</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-showcase") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <Banner2Section
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'content':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Indholdsblokke</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-content") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <ContentBlocksSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            focusTargetId={focusedTargetId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            focusedBlockId={focusedBlockId}
                        />
                    </div>
                );
            case 'products': {
                const forside = editor.draft.forside;
                const productsSection = forside.productsSection || DEFAULT_BRANDING.forside.productsSection;
                const layoutStyle = productsSection.layoutStyle || 'cards';
                const buttonConfig = productsSection.button || {
                    style: 'default',
                    bgColor: '#0EA5E9',
                    hoverBgColor: '#0284C7',
                    textColor: '#FFFFFF',
                    hoverTextColor: '#FFFFFF',
                    font: 'Poppins',
                    animation: 'none'
                };
                const categoryTabsConfig = productsSection.categoryTabs || {
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
                };
                const backgroundConfig = productsSection.background || {
                    type: 'solid',
                    color: '#FFFFFF',
                    gradientStart: '#FFFFFF',
                    gradientEnd: '#F1F5F9',
                    gradientAngle: 135,
                    opacity: 1,
                };
                const cardConfig = productsSection.card || {};
                const featuredProductConfig = productsSection.featuredProductConfig || {
                    enabled: false,
                    productId: undefined,
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
                const updateProductsSection = (updates: Partial<typeof productsSection>) => {
                    editor.updateDraft({
                        forside: {
                            ...forside,
                            productsSection: { ...productsSection, ...updates },
                        },
                    });
                };
                const updateButtonConfig = (updates: Partial<typeof buttonConfig>) => {
                    updateProductsSection({
                        button: { ...buttonConfig, ...updates },
                    });
                };
                const updateCategoryTabsConfig = (updates: Partial<typeof categoryTabsConfig>) => {
                    updateProductsSection({
                        categoryTabs: { ...categoryTabsConfig, ...updates },
                    });
                };
                const updateCardConfig = (updates: Partial<NonNullable<typeof productsSection.card>>) => {
                    updateProductsSection({
                        card: { ...cardConfig, ...updates },
                    });
                };
                const saveProductSwatch = (color: string) => {
                    const swatches = editor.draft.savedSwatches || [];
                    if (!swatches.includes(color) && swatches.length < 20) {
                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                    }
                };
                const removeProductSwatch = (color: string) => {
                    editor.updateDraft({
                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                    });
                };
                const updateFeaturedProductConfig = (updates: Partial<typeof featuredProductConfig>) => {
                    updateProductsSection({
                        featuredProductConfig: {
                            ...featuredProductConfig,
                            ...updates,
                        },
                    });
                };
                const updateFeaturedSidePanel = (updates: Partial<NonNullable<typeof featuredProductConfig.sidePanel>>) => {
                    updateFeaturedProductConfig({
                        sidePanel: {
                            ...featuredProductConfig.sidePanel,
                            ...updates,
                        },
                    });
                };
                const selectedFeaturedProduct = featuredProducts.find((product) => product.id === featuredProductConfig.productId);
                const isFeaturedStorformat = selectedFeaturedProduct?.pricing_type === "STORFORMAT";
                const quantityPresetSlots = Array.from({ length: 8 }, (_, index) => featuredProductConfig.quantityPresets?.[index] || null);
                const updateQuantityPresetSlot = (index: number, value: string) => {
                    const nextSlots = [...quantityPresetSlots];
                    nextSlots[index] = value === "none" ? null : Number(value);
                    const nextPresets = nextSlots.filter((entry): entry is number => Number.isFinite(entry) && entry > 0);
                    updateFeaturedProductConfig({ quantityPresets: nextPresets });
                };
                const featuredSidePanelItems = (featuredProductConfig.sidePanel?.items || []).slice(0, 5);
                const featuredSidePanelMode = featuredProductConfig.sidePanel?.mode || "banner";
                const hasFeaturedSidePanelItems = featuredSidePanelItems.length > 0;
                const isSimpleSideProductMode = !hasFeaturedSidePanelItems && featuredSidePanelMode === "product";
                const isSimpleSideBannerMode = !hasFeaturedSidePanelItems && featuredSidePanelMode === "banner";
                const showSidePanelTransitionControls = hasFeaturedSidePanelItems || featuredSidePanelMode === "banner";
                const updateFeaturedSidePanelItems = (items: typeof featuredSidePanelItems) => {
                    updateFeaturedSidePanel({ items: items.slice(0, 5) });
                };
                const createFeaturedSidePanelItemId = () => {
                    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
                        return crypto.randomUUID();
                    }
                    return `side-panel-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                };
                const addFeaturedSidePanelItem = (mode: "banner" | "product") => {
                    if (featuredSidePanelItems.length >= 5) return;
                    updateFeaturedSidePanelItems([
                        ...featuredSidePanelItems,
                        {
                            id: createFeaturedSidePanelItemId(),
                            mode,
                            productId: undefined,
                            imageUrl: null,
                            title: mode === "banner" ? "Nyt banner" : "",
                            subtitle: "",
                            ctaLabel: mode === "banner" ? "Læs mere" : "",
                            ctaHref: mode === "banner" ? "/shop" : "",
                        },
                    ]);
                };
                const updateFeaturedSidePanelItem = (
                    itemId: string,
                    updates: Partial<(typeof featuredSidePanelItems)[number]>
                ) => {
                    updateFeaturedSidePanelItems(
                        featuredSidePanelItems.map((item) => (
                            item.id === itemId ? { ...item, ...updates } : item
                        ))
                    );
                };
                const removeFeaturedSidePanelItem = (itemId: string) => {
                    updateFeaturedSidePanelItems(
                        featuredSidePanelItems.filter((item) => item.id !== itemId)
                    );
                };
                const featuredSideImages = Array.from(
                    new Set(
                        [
                            ...(featuredProductConfig.sidePanel?.imageUrl ? [featuredProductConfig.sidePanel.imageUrl] : []),
                            ...((featuredProductConfig.sidePanel?.images || []).filter(Boolean)),
                        ].filter(Boolean)
                    )
                ).slice(0, 5) as string[];
                const appendFeaturedSidePanelImage = (imageUrl: string) => {
                    const nextImages = [...featuredSideImages, imageUrl].slice(0, 5);
                    updateFeaturedSidePanel({
                        imageUrl: nextImages[0] || null,
                        images: nextImages,
                    });
                };
                const removeFeaturedSidePanelImage = (imageUrl: string) => {
                    const nextImages = featuredSideImages.filter((existing) => existing !== imageUrl);
                    updateFeaturedSidePanel({
                        imageUrl: nextImages[0] || null,
                        images: nextImages,
                    });
                };
                const featuredGalleryImages = Array.from(
                    new Set((featuredProductConfig.galleryImages || []).filter(Boolean))
                ).slice(0, 8) as string[];
                const appendFeaturedGalleryImage = (imageUrl: string) => {
                    const nextImages = [...featuredGalleryImages, imageUrl].slice(0, 8);
                    updateFeaturedProductConfig({ galleryImages: nextImages });
                };
                const removeFeaturedGalleryImage = (imageUrl: string) => {
                    const nextImages = featuredGalleryImages.filter((existing) => existing !== imageUrl);
                    updateFeaturedProductConfig({ galleryImages: nextImages });
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Forside produkter</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-products") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <Card id="site-design-focus-products-layout">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Produktbokse på forsiden</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Vælg hvor mange produktbokse der skal vises pr. række.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Vis forside produkter</Label>
                                    <Switch
                                        checked={productsSection.enabled}
                                        onCheckedChange={(checked) => updateProductsSection({ enabled: checked })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kolonner pr. række</Label>
                                    <Select
                                        value={String(productsSection.columns)}
                                        onValueChange={(value) => updateProductsSection({ columns: Number(value) as 3 | 4 | 5 })}
                                        disabled={!productsSection.enabled}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Vælg layout" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3">3 kolonner</SelectItem>
                                            <SelectItem value="4">4 kolonner</SelectItem>
                                            <SelectItem value="5">5 kolonner</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Forside produkt layout</Label>
                                    <Select
                                        value={layoutStyle}
                                        onValueChange={(value) => updateProductsSection({ layoutStyle: value as typeof layoutStyle })}
                                        disabled={!productsSection.enabled}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Vælg layout" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cards">Standard (separate bokse)</SelectItem>
                                            <SelectItem value="flat">Ingen ramme</SelectItem>
                                            <SelectItem value="grouped">En samlet ramme</SelectItem>
                                            <SelectItem value="slim">Slim horisontal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Vis kategori knap</Label>
                                        <p className="text-xs text-muted-foreground">Skjuler fanen “Storformat print”</p>
                                    </div>
                                    <Switch
                                        checked={productsSection.showStorformatTab ?? true}
                                        onCheckedChange={(checked) => updateProductsSection({ showStorformatTab: checked })}
                                        disabled={!productsSection.enabled}
                                    />
                                </div>
                                <div id="site-design-focus-products-category-tabs" className="space-y-4 border-t pt-4">
                                    <div>
                                        <Label className="text-sm font-semibold">Kategori-knapper</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Styr fanerne som “Alle produkter” og de øvrige produktkategorier.
                                        </p>
                                    </div>
                                    <FontSelector
                                        label="Kategori skrifttype"
                                        value={categoryTabsConfig.font}
                                        onChange={(value) => updateCategoryTabsConfig({ font: value })}
                                        description="Bruges på overview- og kategori-knapperne"
                                    />
                                    <div className="space-y-2">
                                        {(() => {
                                            const categoryTabRadius = Math.max(0, Math.min(100, categoryTabsConfig.borderRadiusPx ?? 100));
                                            return (
                                                <>
                                        <div className="flex items-center justify-between">
                                            <Label>Hjørnerunding</Label>
                                            <span className="text-xs text-muted-foreground">
                                                {categoryTabRadius}
                                            </span>
                                        </div>
                                        <Slider
                                            value={[categoryTabRadius]}
                                            onValueChange={([value]) => updateCategoryTabsConfig({ borderRadiusPx: value })}
                                            min={0}
                                            max={100}
                                            step={2}
                                            className="py-1"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            0 = firkantet, 100 = helt rund pill-form
                                        </p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={categoryTabsConfig.bgColor}
                                            onChange={(value) => updateCategoryTabsConfig({ bgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={categoryTabsConfig.textColor}
                                            onChange={(value) => updateCategoryTabsConfig({ textColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Border"
                                            value={categoryTabsConfig.borderColor}
                                            onChange={(value) => updateCategoryTabsConfig({ borderColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={categoryTabsConfig.hoverBgColor}
                                            onChange={(value) => updateCategoryTabsConfig({ hoverBgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={categoryTabsConfig.hoverTextColor}
                                            onChange={(value) => updateCategoryTabsConfig({ hoverTextColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Aktiv baggrund"
                                            value={categoryTabsConfig.activeBgColor}
                                            onChange={(value) => updateCategoryTabsConfig({ activeBgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Aktiv tekst"
                                            value={categoryTabsConfig.activeTextColor}
                                            onChange={(value) => updateCategoryTabsConfig({ activeTextColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Aktiv border"
                                            value={categoryTabsConfig.activeBorderColor}
                                            onChange={(value) => updateCategoryTabsConfig({ activeBorderColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={saveProductSwatch}
                                            onRemoveSwatch={removeProductSwatch}
                                        />
                                    </div>
                                </div>
                                <div id="site-design-focus-products-buttons" className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Knap design</Label>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Knap type</Label>
                                            <Select
                                                value={buttonConfig.style}
                                                onValueChange={(value) => updateButtonConfig({ style: value as typeof buttonConfig.style })}
                                                disabled={!productsSection.enabled}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="default">Standard (som nu)</SelectItem>
                                                    <SelectItem value="bar">Bund-bjælke</SelectItem>
                                                    <SelectItem value="center">Stor centreret</SelectItem>
                                                    <SelectItem value="hidden">Skjul knap</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Animation</Label>
                                            <Select
                                                value={buttonConfig.animation}
                                                onValueChange={(value) => updateButtonConfig({ animation: value as typeof buttonConfig.animation })}
                                                disabled={!productsSection.enabled}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Ingen</SelectItem>
                                                    <SelectItem value="lift">Løft</SelectItem>
                                                    <SelectItem value="glow">Glow</SelectItem>
                                                    <SelectItem value="pulse">Pulse</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <FontSelector
                                        label="Knap skrifttype"
                                        value={buttonConfig.font}
                                        onChange={(value) => updateButtonConfig({ font: value })}
                                        description="Vælger font for knapteksten"
                                    />
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        <ColorPickerWithSwatches
                                            label="Knap farve"
                                            value={buttonConfig.bgColor}
                                            onChange={(value) => updateButtonConfig({ bgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover farve"
                                            value={buttonConfig.hoverBgColor}
                                            onChange={(value) => updateButtonConfig({ hoverBgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst farve"
                                            value={buttonConfig.textColor}
                                            onChange={(value) => updateButtonConfig({ textColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-3 border-t pt-4">
                                        <Label className="text-sm font-semibold">Hover tekst</Label>
                                        <ColorPickerWithSwatches
                                            label="Hover tekstfarve"
                                            value={buttonConfig.hoverTextColor}
                                            onChange={(value) => updateButtonConfig({ hoverTextColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div id="site-design-focus-products-background" className="space-y-3 border-t pt-4">
                                        <Label className="text-sm font-semibold">Produkt-baggrund</Label>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Baggrundstype</Label>
                                                <Select
                                                    value={backgroundConfig.type}
                                                    onValueChange={(value) => updateProductsSection({
                                                        background: { ...backgroundConfig, type: value as typeof backgroundConfig.type }
                                                    })}
                                                    disabled={!productsSection.enabled}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="solid">Farve</SelectItem>
                                                        <SelectItem value="gradient">Gradient</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Opacitet</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {Math.round(backgroundConfig.opacity * 100)}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[backgroundConfig.opacity * 100]}
                                                    onValueChange={([value]) => updateProductsSection({
                                                        background: { ...backgroundConfig, opacity: value / 100 }
                                                    })}
                                                    min={0}
                                                    max={100}
                                                    step={5}
                                                    className="py-1"
                                                />
                                            </div>
                                        </div>
                                        {backgroundConfig.type === 'solid' ? (
                                            <ColorPickerWithSwatches
                                                label="Baggrundsfarve"
                                                value={backgroundConfig.color}
                                                onChange={(value) => updateProductsSection({
                                                    background: { ...backgroundConfig, color: value }
                                                })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <ColorPickerWithSwatches
                                                        label="Gradient start"
                                                        value={backgroundConfig.gradientStart}
                                                        onChange={(value) => updateProductsSection({
                                                            background: { ...backgroundConfig, gradientStart: value }
                                                        })}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                    <ColorPickerWithSwatches
                                                        label="Gradient slut"
                                                        value={backgroundConfig.gradientEnd}
                                                        onChange={(value) => updateProductsSection({
                                                            background: { ...backgroundConfig, gradientEnd: value }
                                                        })}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Gradient vinkel</Label>
                                                        <span className="text-xs text-muted-foreground">
                                                            {backgroundConfig.gradientAngle}°
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[backgroundConfig.gradientAngle]}
                                                        onValueChange={([value]) => updateProductsSection({
                                                            background: { ...backgroundConfig, gradientAngle: value }
                                                        })}
                                                        min={0}
                                                        max={360}
                                                        step={5}
                                                        className="py-1"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div id="site-design-focus-products-card-copy" className="space-y-4 border-t pt-4">
                                        <div>
                                            <Label className="text-sm font-semibold">Produktkort tekst</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Styr titel og beskrivelse direkte på forsidekortene.
                                            </p>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <FontSelector
                                                label="Titel skrifttype"
                                                value={cardConfig.titleFont || editor.draft.fonts.heading}
                                                onChange={(value) => updateCardConfig({ titleFont: value })}
                                                description="Lokalt override for produktkort-titler"
                                            />
                                            <ColorPickerWithSwatches
                                                label="Titel farve"
                                                value={cardConfig.titleColor || editor.draft.colors.headingText}
                                                onChange={(value) => updateCardConfig({ titleColor: value })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <FontSelector
                                                label="Beskrivelse skrifttype"
                                                value={cardConfig.bodyFont || editor.draft.fonts.body}
                                                onChange={(value) => updateCardConfig({ bodyFont: value })}
                                                description="Lokalt override for produktkort-beskrivelser"
                                            />
                                            <ColorPickerWithSwatches
                                                label="Beskrivelse farve"
                                                value={cardConfig.bodyColor || editor.draft.colors.bodyText}
                                                onChange={(value) => updateCardConfig({ bodyColor: value })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div id="site-design-focus-products-card-pricing" className="space-y-4 border-t pt-4">
                                        <div>
                                            <Label className="text-sm font-semibold">Produktkort pris</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Brug dette til prisfeltet uden at ændre globale prisstile andre steder.
                                            </p>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <FontSelector
                                                label="Pris skrifttype"
                                                value={cardConfig.priceFont || editor.draft.fonts.pricing}
                                                onChange={(value) => updateCardConfig({ priceFont: value })}
                                                description="Lokalt override for forsidekortets prisfelt"
                                            />
                                            <ColorPickerWithSwatches
                                                label="Pris farve"
                                                value={cardConfig.priceColor || editor.draft.colors.pricingText}
                                                onChange={(value) => updateCardConfig({ priceColor: value })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div id="site-design-focus-products-featured" className="space-y-4 border-t pt-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label className="text-sm font-semibold">Fremhævet produkt</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Stor produktboks med valgfri sidebanner eller sideprodukt.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={featuredProductConfig.enabled}
                                                onCheckedChange={(checked) => updateFeaturedProductConfig({ enabled: checked })}
                                                disabled={!productsSection.enabled}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Produkt</Label>
                                            <Select
                                                value={featuredProductConfig.productId || "none"}
                                                onValueChange={(value) => updateFeaturedProductConfig({
                                                    productId: value === "none" ? undefined : value,
                                                })}
                                                disabled={!productsSection.enabled || loadingFeaturedProducts}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={loadingFeaturedProducts ? "Indlæser produkter..." : "Vælg produkt"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Ingen valgt</SelectItem>
                                                    {featuredProducts.map((product) => (
                                                        <SelectItem key={product.id} value={product.id}>
                                                            {product.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {featuredProductConfig.productId && (
                                                <p className="text-xs text-muted-foreground">
                                                    Den store produktboks vises kun på forsiden.
                                                </p>
                                            )}
                                        </div>

                                        {/* Focused Box Styling Panel */}
                                        <div id="site-design-focus-products-featured-box" className="space-y-4 rounded-lg border border-dashed border-orange-200 bg-orange-50/30 p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 rounded-full bg-orange-500" />
                                                <Label className="text-sm font-semibold">Boks styling</Label>
                                                <span className="text-xs text-muted-foreground">- Klik på boksen i preview</span>
                                            </div>
                                            
                                            {/* Box Background Color */}
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <ColorPickerWithSwatches
                                                    label="Boks farve"
                                                    value={featuredProductConfig.backgroundColor || '#FFFFFF'}
                                                    onChange={(value) => updateFeaturedProductConfig({ backgroundColor: value })}
                                                    savedSwatches={editor.draft.savedSwatches}
                                                    onSaveSwatch={(color) => {
                                                        const swatches = editor.draft.savedSwatches || [];
                                                        if (!swatches.includes(color) && swatches.length < 20) {
                                                            editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                        }
                                                    }}
                                                    onRemoveSwatch={(color) => {
                                                        editor.updateDraft({
                                                            savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                        });
                                                    }}
                                                />
                                            </div>

                                            {/* Border Radius */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Runding på hjørner</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.borderRadiusPx ?? 24}px
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.borderRadiusPx ?? 24]}
                                                    onValueChange={([value]) => updateFeaturedProductConfig({ borderRadiusPx: value })}
                                                    min={0}
                                                    max={48}
                                                    step={2}
                                                    className="py-1"
                                                />
                                            </div>

                                            {/* Box Scale */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Størrelse på boks</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.boxScalePct ?? 80}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.boxScalePct ?? 80]}
                                                    onValueChange={([value]) => updateFeaturedProductConfig({ boxScalePct: value })}
                                                    min={60}
                                                    max={140}
                                                    step={5}
                                                    className="py-1"
                                                />
                                            </div>

                                            {/* Margin to Banner */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Margin til banner</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.overlapPx || 0}px
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.overlapPx || 0]}
                                                    onValueChange={([value]) => updateFeaturedProductConfig({ overlapPx: value })}
                                                    min={0}
                                                    max={140}
                                                    step={5}
                                                    className="py-1"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 xl:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Placering</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={featuredProductConfig.position === 'above' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => updateFeaturedProductConfig({ position: 'above' })}
                                                        disabled={!productsSection.enabled}
                                                    >
                                                        <ArrowUp className="h-4 w-4" />
                                                        Over kategorier
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={featuredProductConfig.position === 'below' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => updateFeaturedProductConfig({ position: 'below' })}
                                                        disabled={!productsSection.enabled}
                                                    >
                                                        <ArrowDown className="h-4 w-4" />
                                                        Under kategorier
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Produktside</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={featuredProductConfig.productSide === 'left' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => updateFeaturedProductConfig({ productSide: 'left' })}
                                                        disabled={!productsSection.enabled}
                                                    >
                                                        <ArrowLeft className="h-4 w-4" />
                                                        Produkt venstre
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={featuredProductConfig.productSide === 'right' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => updateFeaturedProductConfig({ productSide: 'right' })}
                                                        disabled={!productsSection.enabled}
                                                    >
                                                        <ArrowRight className="h-4 w-4" />
                                                        Produkt højre
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Vis optioner</Label>
                                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        Viser de første option-knapper i boksen
                                                    </span>
                                                    <Switch
                                                        checked={featuredProductConfig.showOptions}
                                                        onCheckedChange={(checked) => updateFeaturedProductConfig({ showOptions: checked })}
                                                        disabled={!productsSection.enabled}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Vis pris</Label>
                                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        Viser stor prisvisning i boksen
                                                    </span>
                                                    <Switch
                                                        checked={featuredProductConfig.showPrice}
                                                        onCheckedChange={(checked) => updateFeaturedProductConfig({ showPrice: checked })}
                                                        disabled={!productsSection.enabled}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Vis også i produktliste</Label>
                                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        Vis det fremhævede produkt igen i den normale produktliste
                                                    </span>
                                                    <Switch
                                                        checked={featuredProductConfig.showInProductList ?? false}
                                                        onCheckedChange={(checked) => updateFeaturedProductConfig({ showInProductList: checked })}
                                                        disabled={!productsSection.enabled}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div id="site-design-focus-products-featured-basics" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label>Kort stil</Label>
                                                <Select
                                                    value={featuredProductConfig.cardStyle || "default"}
                                                    onValueChange={(value) => updateFeaturedProductConfig({
                                                        cardStyle: value as "default" | "glass",
                                                    })}
                                                    disabled={!productsSection.enabled}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="default">Standard med let skygge</SelectItem>
                                                        <SelectItem value="glass">Ingen skygge</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Produktbillede</Label>
                                                <Select
                                                    value={featuredProductConfig.imageMode || "contain"}
                                                    onValueChange={(value) => updateFeaturedProductConfig({
                                                        imageMode: value as "contain" | "full",
                                                    })}
                                                    disabled={!productsSection.enabled}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="contain">Indsat billede</SelectItem>
                                                        <SelectItem value="full">Fuldt billede i side</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>CTA tekst</Label>
                                                <Input
                                                    value={featuredProductConfig.ctaLabel || ""}
                                                    onChange={(event) => updateFeaturedProductConfig({ ctaLabel: event.target.value })}
                                                    placeholder="Bestil nu"
                                                    disabled={!productsSection.enabled}
                                                />
                                            </div>
                                        </div>
                                        <div id="site-design-focus-products-featured-copy" className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Alternativ titel</Label>
                                                <Input
                                                    value={featuredProductConfig.customTitle || ""}
                                                    onChange={(event) => updateFeaturedProductConfig({ customTitle: event.target.value })}
                                                    placeholder="Vises kun i fremhævet boks"
                                                    disabled={!productsSection.enabled}
                                                />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label>Alternativ beskrivelse</Label>
                                                <Textarea
                                                    value={featuredProductConfig.customDescription || ""}
                                                    onChange={(event) => updateFeaturedProductConfig({ customDescription: event.target.value })}
                                                    placeholder="Denne tekst påvirker ikke selve produktet"
                                                    disabled={!productsSection.enabled}
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                        {/* CTA Button Styling Panel */}
                                        <div id="site-design-focus-products-featured-cta" className="space-y-4 rounded-lg border border-dashed border-blue-200 bg-blue-50/30 p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 rounded-full bg-blue-500" />
                                                <Label className="text-sm font-semibold">CTA Knap</Label>
                                                <span className="text-xs text-muted-foreground">- Klik på knappen i preview</span>
                                            </div>

                                            {/* Button Text */}
                                            <div className="space-y-2">
                                                <Label>Knap tekst</Label>
                                                <Input
                                                    value={featuredProductConfig.ctaLabel || ""}
                                                    onChange={(event) => updateFeaturedProductConfig({ ctaLabel: event.target.value })}
                                                    placeholder="Bestil nu"
                                                    disabled={!productsSection.enabled}
                                                />
                                            </div>

                                            {/* Button Colors */}
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <ColorPickerWithSwatches
                                                    label="Knap farve"
                                                    value={featuredProductConfig.ctaColor || '#0EA5E9'}
                                                    onChange={(value) => updateFeaturedProductConfig({ ctaColor: value })}
                                                    savedSwatches={editor.draft.savedSwatches}
                                                    onSaveSwatch={(color) => {
                                                        const swatches = editor.draft.savedSwatches || [];
                                                        if (!swatches.includes(color) && swatches.length < 20) {
                                                            editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                        }
                                                    }}
                                                    onRemoveSwatch={(color) => {
                                                        editor.updateDraft({
                                                            savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                        });
                                                    }}
                                                />
                                                <ColorPickerWithSwatches
                                                    label="Tekst farve"
                                                    value={featuredProductConfig.ctaTextColor || '#FFFFFF'}
                                                    onChange={(value) => updateFeaturedProductConfig({ ctaTextColor: value })}
                                                    savedSwatches={editor.draft.savedSwatches}
                                                    onSaveSwatch={(color) => {
                                                        const swatches = editor.draft.savedSwatches || [];
                                                        if (!swatches.includes(color) && swatches.length < 20) {
                                                            editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                        }
                                                    }}
                                                    onRemoveSwatch={(color) => {
                                                        editor.updateDraft({
                                                            savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                        });
                                                    }}
                                                />
                                            </div>

                                            {/* Button Border Radius */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Runding på knap</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.ctaBorderRadiusPx ?? 8}px
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.ctaBorderRadiusPx ?? 8]}
                                                    onValueChange={([value]) => updateFeaturedProductConfig({ ctaBorderRadiusPx: value })}
                                                    min={0}
                                                    max={32}
                                                    step={2}
                                                    className="py-1"
                                                />
                                            </div>
                                        </div>

                                        {/* Image Panel - Focused */}
                                        <div id="site-design-focus-products-featured-image" className="space-y-4 rounded-lg border border-dashed border-purple-200 bg-purple-50/30 p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 rounded-full bg-purple-500" />
                                                <Label className="text-sm font-semibold">Produktbillede</Label>
                                                <span className="text-xs text-muted-foreground">- Klik på billedet i preview</span>
                                            </div>

                                            {/* Image Mode */}
                                            <div className="space-y-2">
                                                <Label>Billedvisning</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={featuredProductConfig.imageMode === 'contain' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => updateFeaturedProductConfig({ imageMode: 'contain' })}
                                                        disabled={!productsSection.enabled}
                                                    >
                                                        Standard (i boks)
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={featuredProductConfig.imageMode === 'full' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => updateFeaturedProductConfig({ imageMode: 'full' })}
                                                        disabled={!productsSection.enabled}
                                                    >
                                                        Fuld flade
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Image Scale */}
                                            {featuredProductConfig.imageMode !== 'full' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Billede størrelse</Label>
                                                        <span className="text-xs text-muted-foreground">
                                                            {featuredProductConfig.imageScalePct ?? 100}%
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[featuredProductConfig.imageScalePct ?? 100]}
                                                        onValueChange={([value]) => updateFeaturedProductConfig({ imageScalePct: value })}
                                                        min={60}
                                                        max={140}
                                                        step={5}
                                                        className="py-1"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Skalerer kun billedet i venstre felt, uden at påvirke tekst/pris til højre
                                                    </p>
                                                </div>
                                            )}

                                            <div className="space-y-3 rounded-lg border border-dashed border-purple-200/80 bg-white/70 p-3">
                                                <div>
                                                    <Label>Tilpasset produktbillede</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Erstat produktets standard billede med dit eget. Bruges når galleri er slået fra.
                                                    </p>
                                                </div>
                                                {featuredProductConfig.customImageUrl && (
                                                    <div className="flex items-start gap-3">
                                                        <div className="relative w-32 overflow-hidden rounded-md border bg-muted">
                                                            <img
                                                                src={featuredProductConfig.customImageUrl}
                                                                alt="Tilpasset billede"
                                                                className="h-24 w-full object-contain"
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            className="shrink-0"
                                                            onClick={() => updateFeaturedProductConfig({ customImageUrl: null })}
                                                            disabled={!productsSection.enabled || uploadingFeaturedMainImage}
                                                        >
                                                            Fjern billede
                                                        </Button>
                                                    </div>
                                                )}
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    disabled={!productsSection.enabled || uploadingFeaturedMainImage}
                                                    onChange={async (event) => {
                                                        const input = event.currentTarget;
                                                        const file = input.files?.[0];
                                                        if (!file) return;
                                                        const publicUrl = await uploadFeaturedMainImage(file);
                                                        if (publicUrl) {
                                                            updateFeaturedProductConfig({ customImageUrl: publicUrl });
                                                        }
                                                        input.value = "";
                                                    }}
                                                />
                                                {uploadingFeaturedMainImage && (
                                                    <p className="text-xs text-muted-foreground">Uploader...</p>
                                                )}
                                            </div>

                                            {/* Gallery Toggle */}
                                            <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                                                <div>
                                                    <Label className="text-sm">Brug galleri</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Vis flere billeder som slideshow
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={featuredProductConfig.galleryEnabled ?? false}
                                                    onCheckedChange={(checked) => updateFeaturedProductConfig({ galleryEnabled: checked })}
                                                    disabled={!productsSection.enabled}
                                                />
                                            </div>
                                        </div>

                                        {/* Gallery Panel */}
                                        <div id="site-design-focus-products-featured-gallery" className="space-y-3 rounded-lg border border-dashed p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label>Brug galleri i stedet for produktfoto</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Upload flere billeder og roter dem i den fremhævede boks.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={featuredProductConfig.galleryEnabled ?? false}
                                                    onCheckedChange={(checked) => updateFeaturedProductConfig({ galleryEnabled: checked })}
                                                    disabled={!productsSection.enabled}
                                                />
                                            </div>
                                            {(featuredProductConfig.galleryEnabled ?? false) && (
                                                <div className="space-y-3">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label>Galleri billeder</Label>
                                                            <span className="text-xs text-muted-foreground">
                                                                {featuredGalleryImages.length}/8
                                                            </span>
                                                        </div>
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            disabled={!productsSection.enabled || uploadingFeaturedGalleryImage || featuredGalleryImages.length >= 8}
                                                            onChange={async (event) => {
                                                                const input = event.currentTarget;
                                                                const file = input.files?.[0];
                                                                if (!file) return;
                                                                const publicUrl = await uploadFeaturedGalleryImage(file);
                                                                if (publicUrl) {
                                                                    appendFeaturedGalleryImage(publicUrl);
                                                                }
                                                                input.value = "";
                                                            }}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            Der må være op til 8 billeder i galleriet.
                                                        </p>
                                                    </div>
                                                    {featuredGalleryImages.length > 0 && (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {featuredGalleryImages.map((imageUrl, index) => (
                                                                <div key={`${imageUrl}-${index}`} className="rounded-md border bg-background p-2">
                                                                    <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                                                                        <img
                                                                            src={imageUrl}
                                                                            alt={`Galleri billede ${index + 1}`}
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    </div>
                                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Billede {index + 1}
                                                                        </span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-destructive"
                                                                            onClick={() => removeFeaturedGalleryImage(imageUrl)}
                                                                        >
                                                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                                            Fjern
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label>Skifteinterval</Label>
                                                            <span className="text-xs text-muted-foreground">
                                                                {Math.round((featuredProductConfig.galleryIntervalMs ?? 6000) / 1000)} sek
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[(featuredProductConfig.galleryIntervalMs ?? 6000) / 1000]}
                                                            onValueChange={([value]) => updateFeaturedProductConfig({ galleryIntervalMs: value * 1000 })}
                                                            min={3}
                                                            max={12}
                                                            step={1}
                                                            className="py-1"
                                                            disabled={!productsSection.enabled}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Runding på produktboks</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.borderRadiusPx ?? 24}px
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.borderRadiusPx ?? 24]}
                                                    onValueChange={([value]) => updateFeaturedProductConfig({ borderRadiusPx: value })}
                                                    min={0}
                                                    max={48}
                                                    step={2}
                                                    className="py-1"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Runding på sidepanel</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.sidePanel?.borderRadiusPx ?? 24}px
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.sidePanel?.borderRadiusPx ?? 24]}
                                                    onValueChange={([value]) => updateFeaturedSidePanel({ borderRadiusPx: value })}
                                                    min={0}
                                                    max={48}
                                                    step={2}
                                                    className="py-1"
                                                    disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Størrelse på sidepanel</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.sidePanel?.boxScalePct ?? 80}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.sidePanel?.boxScalePct ?? 80]}
                                                    onValueChange={([value]) => updateFeaturedSidePanel({ boxScalePct: value })}
                                                    min={60}
                                                    max={140}
                                                    step={5}
                                                    className="py-1"
                                                    disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Størrelse på sidepanel-billede</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.sidePanel?.imageScalePct ?? 100}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[featuredProductConfig.sidePanel?.imageScalePct ?? 100]}
                                                    onValueChange={([value]) => updateFeaturedSidePanel({ imageScalePct: value })}
                                                    min={60}
                                                    max={140}
                                                    step={5}
                                                    className="py-1"
                                                    disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Mængdeknapper</Label>
                                            {isFeaturedStorformat ? (
                                                <div className="rounded-md border px-3 py-3 text-xs text-muted-foreground">
                                                    Storformat bruger faste mængdeknapper sammen med bredde/højde i den fremhævede boks.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="grid gap-2 md:grid-cols-4">
                                                        {quantityPresetSlots.map((quantity, index) => (
                                                            <Select
                                                                key={`featured-qty-slot-${index}`}
                                                                value={quantity ? String(quantity) : "none"}
                                                                onValueChange={(value) => updateQuantityPresetSlot(index, value)}
                                                                disabled={!productsSection.enabled || loadingFeaturedQuantities}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={`Plads ${index + 1}`} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">Tom</SelectItem>
                                                                    {featuredQuantityOptions.map((optionQuantity) => (
                                                                        <SelectItem
                                                                            key={`featured-qty-${index}-${optionQuantity}`}
                                                                            value={String(optionQuantity)}
                                                                        >
                                                                            {optionQuantity.toLocaleString("da-DK")}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ))}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Op til 2 rækker med 4 mængdeknapper. Tomme pladser vises ikke på forsiden.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Margin til banner</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.overlapPx || 0}px
                                                    </span>
                                                </div>
                                            <Slider
                                                value={[featuredProductConfig.overlapPx || 0]}
                                                onValueChange={([value]) => updateFeaturedProductConfig({ overlapPx: value })}
                                                min={0}
                                                max={140}
                                                step={5}
                                                className="py-1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Størrelse på fremhævet boks</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.boxScalePct ?? 80}%
                                                    </span>
                                                </div>
                                            <Slider
                                                value={[featuredProductConfig.boxScalePct ?? 80]}
                                                onValueChange={([value]) => updateFeaturedProductConfig({ boxScalePct: value })}
                                                min={60}
                                                max={140}
                                                step={5}
                                                className="py-1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Venstre billede (højde)</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {featuredProductConfig.imageScalePct ?? 100}%
                                                    </span>
                                                </div>
                                            <Slider
                                                value={[featuredProductConfig.imageScalePct ?? 100]}
                                                onValueChange={([value]) => updateFeaturedProductConfig({ imageScalePct: value })}
                                                min={60}
                                                max={140}
                                                step={5}
                                                className="py-1"
                                                disabled={(featuredProductConfig.imageMode || 'contain') === 'full'}
                                            />
                                            {(featuredProductConfig.imageMode || 'contain') === 'full' && (
                                                <p className="text-xs text-muted-foreground">
                                                    Virker kun når billedet vises som venstrestillet billede og ikke som fuld flade.
                                                </p>
                                            )}
                                            {(featuredProductConfig.imageMode || 'contain') !== 'full' && (
                                                <p className="text-xs text-muted-foreground">
                                                    Billedet skaleres kun i venstre felt, forankret i bunden, og påvirker ikke tekst/prisfeltet til højre.
                                                </p>
                                            )}
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <ColorPickerWithSwatches
                                                label="Baggrund på produktboks"
                                                value={featuredProductConfig.backgroundColor || '#FFFFFF'}
                                                onChange={(value) => updateFeaturedProductConfig({ backgroundColor: value })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="CTA farve"
                                                value={featuredProductConfig.ctaColor || '#0EA5E9'}
                                                onChange={(value) => updateFeaturedProductConfig({ ctaColor: value })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="CTA tekstfarve"
                                                value={featuredProductConfig.ctaTextColor || '#FFFFFF'}
                                                onChange={(value) => updateFeaturedProductConfig({ ctaTextColor: value })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div id="site-design-focus-products-featured-side-panel" className="space-y-4 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/20 p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label className="text-sm font-semibold">Sidepanel</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Vælg mellem kampagnebanner eller ekstra produkt ved siden af.
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Klik direkte på sidepanelet i preview for at hoppe hertil.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={featuredProductConfig.sidePanel?.enabled ?? false}
                                                    onCheckedChange={(checked) => updateFeaturedSidePanel({ enabled: checked })}
                                                    disabled={!productsSection.enabled}
                                                />
                                            </div>
                                            <div className="grid gap-3">
                                                <div className="space-y-2">
                                                    <Label>Sidepanel type</Label>
                                                    <Select
                                                        value={featuredSidePanelMode}
                                                        onValueChange={(value) => updateFeaturedSidePanel({ mode: value as "banner" | "product" })}
                                                        disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="banner">Banner</SelectItem>
                                                            <SelectItem value="product">Produktkort</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {isSimpleSideProductMode && (
                                                    <div className="space-y-2">
                                                        <Label>Sideprodukt</Label>
                                                        <Select
                                                            value={featuredProductConfig.sidePanel?.productId || "none"}
                                                            onValueChange={(value) => updateFeaturedSidePanel({
                                                                productId: value === "none" ? undefined : value,
                                                            })}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Vælg produkt" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Ingen valgt</SelectItem>
                                                                {featuredProducts.map((product) => (
                                                                    <SelectItem key={product.id} value={product.id}>
                                                                        {product.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-xs text-muted-foreground">
                                                            Vælg et ekstra produkt til sidepanelet. Bannerfelter skjules i denne tilstand.
                                                        </p>
                                                    </div>
                                                )}
                                                {showSidePanelTransitionControls && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Skifteinterval</Label>
                                                        <span className="text-xs text-muted-foreground">
                                                            {Math.round((featuredProductConfig.sidePanel?.slideshowIntervalMs ?? 6000) / 1000)} sek
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[(featuredProductConfig.sidePanel?.slideshowIntervalMs ?? 6000) / 1000]}
                                                        onValueChange={([value]) => updateFeaturedSidePanel({ slideshowIntervalMs: value * 1000 })}
                                                        min={2}
                                                        max={15}
                                                        step={1}
                                                        className="py-1"
                                                        disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                    />
                                                </div>
                                                )}
                                                {showSidePanelTransitionControls && (
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                        <div>
                                                            <Label>Fade overgang</Label>
                                                            <p className="text-xs text-muted-foreground">
                                                                Blød overgang mellem bannere
                                                            </p>
                                                        </div>
                                                        <Switch
                                                            checked={featuredProductConfig.sidePanel?.fadeTransition ?? true}
                                                            onCheckedChange={(checked) => updateFeaturedSidePanel({ fadeTransition: checked })}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                        <div>
                                                            <Label>Vis pile i banner</Label>
                                                            <p className="text-xs text-muted-foreground">
                                                                Manuel forrige/næste i banneret
                                                            </p>
                                                        </div>
                                                        <Switch
                                                            checked={featuredProductConfig.sidePanel?.showNavigationArrows ?? false}
                                                            onCheckedChange={(checked) => updateFeaturedSidePanel({ showNavigationArrows: checked })}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                        />
                                                    </div>
                                                </div>
                                                )}
                                                {showSidePanelTransitionControls && (featuredProductConfig.sidePanel?.fadeTransition ?? true) && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label>Fade varighed</Label>
                                                            <span className="text-xs text-muted-foreground">
                                                                {featuredProductConfig.sidePanel?.transitionDurationMs ?? 700} ms
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[featuredProductConfig.sidePanel?.transitionDurationMs ?? 700]}
                                                            onValueChange={([value]) => updateFeaturedSidePanel({ transitionDurationMs: value })}
                                                            min={150}
                                                            max={1800}
                                                            step={50}
                                                            className="py-1"
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                        />
                                                    </div>
                                                )}
                                                <div className="space-y-3 rounded-lg border border-dashed p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <Label>Roterende elementer</Label>
                                                            <p className="text-xs text-muted-foreground">
                                                                Tilføj op til 5 sidepanel-elementer. Hvis der er elementer her, bruges de i stedet for det enkle sidepanel ovenfor.
                                                            </p>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {featuredSidePanelItems.length}/5
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => addFeaturedSidePanelItem("product")}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false) || featuredSidePanelItems.length >= 5}
                                                        >
                                                            Tilføj produkt
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => addFeaturedSidePanelItem("banner")}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false) || featuredSidePanelItems.length >= 5}
                                                        >
                                                            Tilføj banner
                                                        </Button>
                                                    </div>
                                                    {featuredSidePanelItems.length > 0 && (
                                                        <div className="space-y-3">
                                                            {featuredSidePanelItems.map((item, index) => (
                                                                <div key={item.id} className="rounded-lg border bg-background p-3 space-y-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <Badge variant="secondary">
                                                                            {item.mode === "product" ? `Produkt ${index + 1}` : `Banner ${index + 1}`}
                                                                        </Badge>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 px-2 text-destructive"
                                                                            onClick={() => removeFeaturedSidePanelItem(item.id)}
                                                                        >
                                                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                                            Fjern
                                                                        </Button>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label>Type</Label>
                                                                        <Select
                                                                            value={item.mode}
                                                                            onValueChange={(value) => updateFeaturedSidePanelItem(item.id, { mode: value as "banner" | "product" })}
                                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                                        >
                                                                            <SelectTrigger>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="product">Produktkort</SelectItem>
                                                                                <SelectItem value="banner">Banner</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    {item.mode === "product" ? (
                                                                        <div className="space-y-2">
                                                                            <Label>Produkt</Label>
                                                                            <Select
                                                                                value={item.productId || "none"}
                                                                                onValueChange={(value) => updateFeaturedSidePanelItem(item.id, {
                                                                                    productId: value === "none" ? undefined : value,
                                                                                })}
                                                                                disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                                            >
                                                                                <SelectTrigger>
                                                                                    <SelectValue placeholder="Vælg produkt" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="none">Ingen valgt</SelectItem>
                                                                                    {featuredProducts.map((product) => (
                                                                                        <SelectItem key={product.id} value={product.id}>
                                                                                            {product.name}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-2">
                                                                                <Label>Banner billede</Label>
                                                                                <Input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false) || uploadingFeaturedSideImage}
                                                                                    onChange={async (event) => {
                                                                                        const input = event.currentTarget;
                                                                                        const file = input.files?.[0];
                                                                                        if (!file) return;
                                                                                        const publicUrl = await uploadFeaturedSidePanelImage(file);
                                                                                        if (publicUrl) {
                                                                                            updateFeaturedSidePanelItem(item.id, { imageUrl: publicUrl });
                                                                                        }
                                                                                        input.value = "";
                                                                                    }}
                                                                                />
                                                                                {item.imageUrl && (
                                                                                    <div className="rounded-md border bg-muted p-2 space-y-2">
                                                                                        <div className="aspect-[4/3] overflow-hidden rounded-md bg-background">
                                                                                            <img
                                                                                                src={item.imageUrl}
                                                                                                alt={`Banner ${index + 1}`}
                                                                                                className="h-full w-full object-cover"
                                                                                            />
                                                                                        </div>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            className="h-8 px-2 text-destructive"
                                                                                            onClick={() => updateFeaturedSidePanelItem(item.id, { imageUrl: null })}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                                                            Fjern billede
                                                                                        </Button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label>Overskrift</Label>
                                                                                <Input
                                                                                    value={item.title || ""}
                                                                                    onChange={(event) => updateFeaturedSidePanelItem(item.id, { title: event.target.value })}
                                                                                    disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label>Underrubrik</Label>
                                                                                <Input
                                                                                    value={item.subtitle || ""}
                                                                                    onChange={(event) => updateFeaturedSidePanelItem(item.id, { subtitle: event.target.value })}
                                                                                    disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                                                />
                                                                            </div>
                                                                            <div className="grid gap-3 md:grid-cols-2">
                                                                                <div className="space-y-2">
                                                                                    <Label>CTA tekst</Label>
                                                                                    <Input
                                                                                        value={item.ctaLabel || ""}
                                                                                        onChange={(event) => updateFeaturedSidePanelItem(item.id, { ctaLabel: event.target.value })}
                                                                                        disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    <Label>CTA link</Label>
                                                                                    <Input
                                                                                        value={item.ctaHref || ""}
                                                                                        onChange={(event) => updateFeaturedSidePanelItem(item.id, { ctaHref: event.target.value })}
                                                                                        placeholder="/shop eller https://..."
                                                                                        disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isSimpleSideBannerMode && (
                                                <>
                                                    <div className="space-y-3 rounded-lg border border-dashed p-3">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label>Banner billeder</Label>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {featuredSideImages.length}/5
                                                                </span>
                                                            </div>
                                                            <Input
                                                                type="file"
                                                                accept="image/*"
                                                                disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false) || uploadingFeaturedSideImage || featuredSideImages.length >= 5}
                                                                onChange={async (event) => {
                                                                    const input = event.currentTarget;
                                                                    const file = input.files?.[0];
                                                                    if (!file) return;
                                                                    const publicUrl = await uploadFeaturedSidePanelImage(file);
                                                                    if (publicUrl) {
                                                                        appendFeaturedSidePanelImage(publicUrl);
                                                                    }
                                                                    input.value = "";
                                                                }}
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Upload op til 5 billeder. Hvis der er flere end ét, roterer sidepanelet automatisk.
                                                            </p>
                                                        </div>
                                                        {featuredSideImages.length > 0 && (
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                {featuredSideImages.map((imageUrl, index) => (
                                                                    <div key={`${imageUrl}-${index}`} className="rounded-md border bg-background p-2">
                                                                        <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                                                                            <img
                                                                                src={imageUrl}
                                                                                alt={`Sidepanel banner ${index + 1}`}
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        </div>
                                                                        <div className="mt-2 flex items-center justify-between gap-2">
                                                                            <span className="text-xs text-muted-foreground">
                                                                                Banner {index + 1}
                                                                            </span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-7 px-2 text-destructive"
                                                                                onClick={() => removeFeaturedSidePanelImage(imageUrl)}
                                                                            >
                                                                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                                                Fjern
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Overskrift</Label>
                                                            <Input
                                                                value={featuredProductConfig.sidePanel?.title || ""}
                                                                onChange={(event) => updateFeaturedSidePanel({ title: event.target.value })}
                                                                disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Teksteffekt</Label>
                                                            <Select
                                                                value={featuredProductConfig.sidePanel?.textAnimation || "slide-up"}
                                                                onValueChange={(value) => updateFeaturedSidePanel({ textAnimation: value as any })}
                                                                disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">Ingen</SelectItem>
                                                                    <SelectItem value="fade">Fade</SelectItem>
                                                                    <SelectItem value="slide-up">Slide op</SelectItem>
                                                                    <SelectItem value="slide-down">Slide ned</SelectItem>
                                                                    <SelectItem value="scale">Scale</SelectItem>
                                                                    <SelectItem value="blur">Blur</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Underrubrik</Label>
                                                        <Input
                                                            value={featuredProductConfig.sidePanel?.subtitle || ""}
                                                            onChange={(event) => updateFeaturedSidePanel({ subtitle: event.target.value })}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                        />
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>CTA tekst</Label>
                                                            <Input
                                                                value={featuredProductConfig.sidePanel?.ctaLabel || ""}
                                                                onChange={(event) => updateFeaturedSidePanel({ ctaLabel: event.target.value })}
                                                                disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>CTA link</Label>
                                                            <Input
                                                                value={featuredProductConfig.sidePanel?.ctaHref || ""}
                                                                onChange={(event) => updateFeaturedSidePanel({ ctaHref: event.target.value })}
                                                                placeholder="/shop eller https://..."
                                                                disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label>Overlay opacitet</Label>
                                                            <span className="text-xs text-muted-foreground">
                                                                {Math.round((featuredProductConfig.sidePanel?.overlayOpacity ?? 0.35) * 100)}%
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[(featuredProductConfig.sidePanel?.overlayOpacity ?? 0.35) * 100]}
                                                            onValueChange={([value]) => updateFeaturedSidePanel({ overlayOpacity: value / 100 })}
                                                            min={0}
                                                            max={100}
                                                            step={5}
                                                            className="py-1"
                                                        />
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                        <ColorPickerWithSwatches
                                                            label="Overlay farve"
                                                            value={featuredProductConfig.sidePanel?.overlayColor || '#000000'}
                                                            onChange={(value) => updateFeaturedSidePanel({ overlayColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="Overskrift farve"
                                                            value={featuredProductConfig.sidePanel?.titleColor || '#FFFFFF'}
                                                            onChange={(value) => updateFeaturedSidePanel({ titleColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="Underrubrik farve"
                                                            value={featuredProductConfig.sidePanel?.subtitleColor || 'rgba(255, 255, 255, 0.9)'}
                                                            onChange={(value) => updateFeaturedSidePanel({ subtitleColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="CTA farve"
                                                            value={featuredProductConfig.sidePanel?.ctaColor || '#0EA5E9'}
                                                            onChange={(value) => updateFeaturedSidePanel({ ctaColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="CTA tekstfarve"
                                                            value={featuredProductConfig.sidePanel?.ctaTextColor || '#FFFFFF'}
                                                            onChange={(value) => updateFeaturedSidePanel({ ctaTextColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            {featuredSidePanelItems.length > 0 && featuredProductConfig.sidePanel?.mode === 'banner' && (
                                                <div className="space-y-3 rounded-lg border border-dashed p-3">
                                                    <p className="text-xs text-muted-foreground">
                                                        Udseende for banner-elementer (gælder alle bannere i rotationen).
                                                    </p>
                                                    <div className="space-y-2">
                                                        <Label>Teksteffekt</Label>
                                                        <Select
                                                            value={featuredProductConfig.sidePanel?.textAnimation || "slide-up"}
                                                            onValueChange={(value) => updateFeaturedSidePanel({ textAnimation: value as any })}
                                                            disabled={!productsSection.enabled || !(featuredProductConfig.sidePanel?.enabled ?? false)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Ingen</SelectItem>
                                                                <SelectItem value="fade">Fade</SelectItem>
                                                                <SelectItem value="slide-up">Slide op</SelectItem>
                                                                <SelectItem value="slide-down">Slide ned</SelectItem>
                                                                <SelectItem value="scale">Scale</SelectItem>
                                                                <SelectItem value="blur">Blur</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label>Overlay opacitet</Label>
                                                            <span className="text-xs text-muted-foreground">
                                                                {Math.round((featuredProductConfig.sidePanel?.overlayOpacity ?? 0.35) * 100)}%
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[(featuredProductConfig.sidePanel?.overlayOpacity ?? 0.35) * 100]}
                                                            onValueChange={([value]) => updateFeaturedSidePanel({ overlayOpacity: value / 100 })}
                                                            min={0}
                                                            max={100}
                                                            step={5}
                                                            className="py-1"
                                                        />
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                        <ColorPickerWithSwatches
                                                            label="Overlay farve"
                                                            value={featuredProductConfig.sidePanel?.overlayColor || '#000000'}
                                                            onChange={(value) => updateFeaturedSidePanel({ overlayColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="Overskrift farve"
                                                            value={featuredProductConfig.sidePanel?.titleColor || '#FFFFFF'}
                                                            onChange={(value) => updateFeaturedSidePanel({ titleColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="Underrubrik farve"
                                                            value={featuredProductConfig.sidePanel?.subtitleColor || 'rgba(255, 255, 255, 0.9)'}
                                                            onChange={(value) => updateFeaturedSidePanel({ subtitleColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="CTA farve"
                                                            value={featuredProductConfig.sidePanel?.ctaColor || '#0EA5E9'}
                                                            onChange={(value) => updateFeaturedSidePanel({ ctaColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="CTA tekstfarve"
                                                            value={featuredProductConfig.sidePanel?.ctaTextColor || '#FFFFFF'}
                                                            onChange={(value) => updateFeaturedSidePanel({ ctaTextColor: value })}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'footer':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Footer</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-footer") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <FooterSection
                            footer={editor.draft.footer}
                            onChange={(footer) => editor.updateDraft({ footer })}
                            focusTargetId={focusedTargetId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'usp-strip': {
                const uspStrip = editor.draft.uspStrip || { enabled: true, mode: 'standard', animation: 'slide-up', staggerMs: 120, items: [], backgroundColor: '#0EA5E9', textColor: '', iconColor: '', titleColor: '', descriptionColor: '', titleFont: 'Poppins', descriptionFont: 'Inter', useGradient: false, gradientFrom: '#0EA5E9', gradientTo: '#6366F1', gradientDirection: 'to-r' };
                const uspItems = uspStrip.items || [];
                const maxUSPItems = 20;
                const updateUSPItems = (items: typeof uspItems) => {
                    editor.updateDraft({ uspStrip: { ...uspStrip, items } });
                };
                const saveUSPStripSwatch = (color: string) => {
                    const swatches = editor.draft.savedSwatches || [];
                    if (!swatches.includes(color) && swatches.length < 20) {
                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                    }
                };
                const removeUSPStripSwatch = (color: string) => {
                    editor.updateDraft({
                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                    });
                };
                const addUSPItem = () => {
                    if (uspItems.length >= maxUSPItems) {
                        toast.error(`Maksimalt ${maxUSPItems} USP punkter`);
                        return;
                    }

                    updateUSPItems([
                        ...uspItems,
                        {
                            id: `usp-${Date.now()}`,
                            enabled: true,
                            icon: 'star',
                            title: '',
                            description: '',
                        },
                    ]);
                };
                const removeUSPItem = (itemId: string) => {
                    updateUSPItems(uspItems.filter((entry: any) => entry.id !== itemId));
                };
                const isUSPFocusMode = Boolean(focusedTargetId?.startsWith("site-design-focus-usp"));
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">USP Strip (Fordele)</h3>
                            <div className="flex items-center gap-2">
                                {isUSPFocusMode && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        
                        {/* Enable/Disable */}
                        <div id="site-design-focus-usp-strip" className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <Label className="text-sm">Vis USP strip</Label>
                            <Switch 
                                checked={uspStrip.enabled !== false} 
                                onCheckedChange={(checked) => editor.updateDraft({ 
                                    uspStrip: { ...uspStrip, enabled: checked } 
                                })} 
                            />
                        </div>

                        {uspStrip.enabled !== false && (
                            <>
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Visning</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant={(uspStrip.mode || 'standard') === "standard" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => editor.updateDraft({ uspStrip: { ...uspStrip, mode: 'standard' } })}
                                        >
                                            Standard
                                        </Button>
                                        <Button
                                            variant={(uspStrip.mode || 'standard') === "animated" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => editor.updateDraft({ uspStrip: { ...uspStrip, mode: 'animated' } })}
                                        >
                                            Animeret
                                        </Button>
                                    </div>

                                    {(uspStrip.mode || 'standard') === 'animated' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Animation</Label>
                                                <Select
                                                    value={uspStrip.animation || 'slide-up'}
                                                    onValueChange={(value) => editor.updateDraft({ uspStrip: { ...uspStrip, animation: value as any } })}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="fade">Fade</SelectItem>
                                                        <SelectItem value="slide-up">Slide op</SelectItem>
                                                        <SelectItem value="slide-down">Slide ned</SelectItem>
                                                        <SelectItem value="scale">Zoom ind</SelectItem>
                                                        <SelectItem value="blur">Blur ind</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Forsinkelse mellem kort</Label>
                                                <Select
                                                    value={String(uspStrip.staggerMs || 120)}
                                                    onValueChange={(value) => editor.updateDraft({ uspStrip: { ...uspStrip, staggerMs: Number(value) } })}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">Ingen</SelectItem>
                                                        <SelectItem value="80">Kort</SelectItem>
                                                        <SelectItem value="120">Normal</SelectItem>
                                                        <SelectItem value="180">Lang</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Background Type */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Baggrund</h4>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={uspStrip.useGradient ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => editor.updateDraft({ uspStrip: { ...uspStrip, useGradient: false } })}
                                            className="flex-1"
                                        >
                                            Ensfarvet
                                        </Button>
                                        <Button
                                            variant={uspStrip.useGradient ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => editor.updateDraft({ uspStrip: { ...uspStrip, useGradient: true } })}
                                            className="flex-1"
                                        >
                                            Gradient
                                        </Button>
                                    </div>
                                    
                                    {!uspStrip.useGradient && (
                                        <ColorPickerWithSwatches
                                            label="Baggrundsfarve"
                                            value={uspStrip.backgroundColor || ''}
                                            fallback="Standard blå"
                                            onChange={(color) => editor.updateDraft({ 
                                                uspStrip: { ...uspStrip, backgroundColor: color } 
                                            })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    )}
                                    
                                    {uspStrip.useGradient && (
                                        <div className="space-y-3">
                                            <ColorPickerWithSwatches
                                                label="Gradient start"
                                                value={uspStrip.gradientFrom || '#0EA5E9'}
                                                onChange={(color) => editor.updateDraft({ 
                                                    uspStrip: { ...uspStrip, gradientFrom: color } 
                                                })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Gradient slut"
                                                value={uspStrip.gradientTo || '#6366F1'}
                                                onChange={(color) => editor.updateDraft({ 
                                                    uspStrip: { ...uspStrip, gradientTo: color } 
                                                })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <div className="space-y-1">
                                                <Label className="text-xs">Retning</Label>
                                                <Select
                                                    value={uspStrip.gradientDirection || 'to-r'}
                                                    onValueChange={(v) => editor.updateDraft({ uspStrip: { ...uspStrip, gradientDirection: v } })}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="to-r">→ Højre</SelectItem>
                                                        <SelectItem value="to-l">← Venstre</SelectItem>
                                                        <SelectItem value="to-b">↓ Ned</SelectItem>
                                                        <SelectItem value="to-t">↑ Op</SelectItem>
                                                        <SelectItem value="to-tr">↗ Diagonal (op-højre)</SelectItem>
                                                        <SelectItem value="to-tl">↖ Diagonal (op-venstre)</SelectItem>
                                                        <SelectItem value="to-br">↘ Diagonal (ned-højre)</SelectItem>
                                                        <SelectItem value="to-bl">↙ Diagonal (ned-venstre)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Colors */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Farver</h4>
                                    <ColorPickerWithSwatches
                                        label="Ikonfarve"
                                        value={uspStrip.iconColor || uspStrip.textColor || '#FFFFFF'}
                                        onChange={(color) => editor.updateDraft({ 
                                            uspStrip: { ...uspStrip, iconColor: color } 
                                        })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={saveUSPStripSwatch}
                                        onRemoveSwatch={removeUSPStripSwatch}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Overskriftsfarve"
                                        value={uspStrip.titleColor || uspStrip.textColor || '#FFFFFF'}
                                        onChange={(color) => editor.updateDraft({ 
                                            uspStrip: { ...uspStrip, titleColor: color } 
                                        })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={saveUSPStripSwatch}
                                        onRemoveSwatch={removeUSPStripSwatch}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Beskrivelsesfarve"
                                        value={uspStrip.descriptionColor || uspStrip.textColor || '#FFFFFF'}
                                        onChange={(color) => editor.updateDraft({ 
                                            uspStrip: { ...uspStrip, descriptionColor: color } 
                                        })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={saveUSPStripSwatch}
                                        onRemoveSwatch={removeUSPStripSwatch}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Fælles fallback-farve"
                                        value={uspStrip.textColor || '#FFFFFF'}
                                        onChange={(color) => editor.updateDraft({ 
                                            uspStrip: { ...uspStrip, textColor: color } 
                                        })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={saveUSPStripSwatch}
                                        onRemoveSwatch={removeUSPStripSwatch}
                                    />
                                </div>

                                {/* Fonts */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Skrifttyper</h4>
                                    <FontSelector
                                        label="Overskrifter"
                                        value={uspStrip.titleFont || 'Poppins'}
                                        onChange={(v) => editor.updateDraft({ 
                                            uspStrip: { ...uspStrip, titleFont: v } 
                                        })}
                                    />
                                    <FontSelector
                                        label="Beskrivelser"
                                        value={uspStrip.descriptionFont || 'Inter'}
                                        onChange={(v) => editor.updateDraft({ 
                                            uspStrip: { ...uspStrip, descriptionFont: v } 
                                        })}
                                    />
                                </div>

                                {/* USP Items */}
                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-xs font-medium text-muted-foreground uppercase">USP Punkter</h4>
                                            <p className="text-[11px] text-muted-foreground">{uspItems.length}/{maxUSPItems}</p>
                                        </div>
                                        {uspItems.length < maxUSPItems && (
                                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addUSPItem}>
                                                <Plus className="mr-1 h-3.5 w-3.5" />
                                                Tilføj punkt
                                            </Button>
                                        )}
                                    </div>
                                    {uspItems.map((item: any, index: number) => (
                                        <div 
                                            key={item.id} 
                                            id={`site-design-focus-usp-item-${item.id}`}
                                            className="p-3 bg-muted/30 rounded-lg space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{index + 1}. {item.title || 'USP punkt'}</span>
                                                <div className="flex items-center gap-1">
                                                    <Switch 
                                                        checked={item.enabled !== false} 
                                                        onCheckedChange={(checked) => {
                                                            const newItems = [...uspItems];
                                                            newItems[index] = { ...item, enabled: checked };
                                                            updateUSPItems(newItems);
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive"
                                                        onClick={() => removeUSPItem(item.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            {item.enabled !== false && (
                                                <>
                                                    {/* Icon Selection */}
                                                    <div 
                                                        id={`site-design-focus-usp-item-${item.id}-icon`}
                                                        className="space-y-2"
                                                    >
                                                        {(() => {
                                                            const selectedUSPOption = USP_ICON_OPTIONS.find((option) => option.value === item.icon) || USP_ICON_OPTIONS[0];
                                                            const SelectedIcon = selectedUSPOption.icon;
                                                            return (
                                                                <>
                                                        <Label className="text-xs">Ikon</Label>
                                                        <Select
                                                            value={item.icon || 'truck'}
                                                            onValueChange={(v) => {
                                                                const newItems = [...uspItems];
                                                                newItems[index] = { ...item, icon: v };
                                                                updateUSPItems(newItems);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <div className="flex items-center gap-2 text-left">
                                                                    {item.icon === "custom" ? (
                                                                        item.customIconUrl ? (
                                                                            <img
                                                                                src={item.customIconUrl}
                                                                                alt="Valgt ikon"
                                                                                className="h-4 w-4 shrink-0 object-contain"
                                                                            />
                                                                        ) : (
                                                                            <ImageIcon className="h-4 w-4 shrink-0 text-foreground" />
                                                                        )
                                                                    ) : (
                                                                        <SelectedIcon className="h-4 w-4 shrink-0 text-foreground" />
                                                                    )}
                                                                    <span className="truncate">
                                                                        {item.icon === "custom" ? "Upload eget ikon" : selectedUSPOption.label}
                                                                    </span>
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {USP_ICON_OPTIONS.map((option) => {
                                                                    const OptionIcon = option.icon;
                                                                    return (
                                                                        <SelectItem key={option.value} value={option.value}>
                                                                            <div className="flex items-center gap-2">
                                                                                <OptionIcon className="h-4 w-4 text-foreground" />
                                                                                <span>{option.label}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                                <SelectItem value="custom">
                                                                    <div className="flex items-center gap-2">
                                                                        <ImageIcon className="h-4 w-4 text-foreground" />
                                                                        <span>Upload eget ikon</span>
                                                                    </div>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                                </>
                                                            );
                                                        })()}
                                                        
                                                        {/* Custom Icon Upload */}
                                                        {item.icon === 'custom' && (
                                                            <div className="space-y-2 pt-2">
                                                                {item.customIconUrl && (
                                                                    <div className="flex items-center gap-2">
                                                                        <img 
                                                                            src={item.customIconUrl} 
                                                                            alt="Custom icon" 
                                                                            className="h-8 w-8 object-contain border rounded p-1"
                                                                        />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 text-xs text-destructive"
                                                                            onClick={() => {
                                                                                const newItems = [...uspItems];
                                                                                newItems[index] = { ...item, customIconUrl: undefined };
                                                                                updateUSPItems(newItems);
                                                                            }}
                                                                        >
                                                                            Fjern
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                <Input
                                                                    type="file"
                                                                    accept="image/png,image/svg+xml,image/webp"
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;
                                                                        
                                                                        // Upload using the branding adapter
                                                                        try {
                                                                            const url = await editor.uploadAsset(file, 'usp-icon');
                                                                            const newItems = [...uspItems];
                                                                            newItems[index] = { ...item, customIconUrl: url };
                                                                            updateUSPItems(newItems);
                                                                            toast.success('Ikon uploadet');
                                                                        } catch (err) {
                                                                            toast.error('Upload fejlede');
                                                                        }
                                                                    }}
                                                                    className="text-xs h-8"
                                                                />
                                                                <p className="text-[10px] text-muted-foreground">PNG, SVG eller WebP. Anbefalet: 48x48px.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Title Textarea */}
                                                    <div 
                                                        id={`site-design-focus-usp-item-${item.id}-title`}
                                                        className="space-y-1"
                                                    >
                                                        <Label className="text-xs">Overskrift</Label>
                                                        <Textarea
                                                            value={item.title}
                                                            onChange={(e) => {
                                                                const newItems = [...uspItems];
                                                                newItems[index] = { ...item, title: e.target.value };
                                                                updateUSPItems(newItems);
                                                            }}
                                                            placeholder="F.eks. Hurtig levering"
                                                            className="text-sm min-h-[60px] resize-none"
                                                        />
                                                    </div>
                                                    
                                                    {/* Description Textarea */}
                                                    <div 
                                                        id={`site-design-focus-usp-item-${item.id}-description`}
                                                        className="space-y-1"
                                                    >
                                                        <Label className="text-xs">Beskrivelse</Label>
                                                        <Textarea
                                                            value={item.description}
                                                            onChange={(e) => {
                                                                const newItems = [...uspItems];
                                                                newItems[index] = { ...item, description: e.target.value };
                                                                updateUSPItems(newItems);
                                                            }}
                                                            placeholder="F.eks. 1-3 hverdage til hele Danmark"
                                                            className="text-sm min-h-[60px] resize-none"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                );
            }
            case 'seo-content': {
                const seoContent = editor.draft.seoContent || {
                    enabled: true,
                    backgroundColor: '',
                    items: [
                        { id: '1', heading: 'Billige tryksager online', text: 'Webprinter.dk gør det nemt at bestille flyers, foldere, visitkort og hæfter i høj kvalitet til lave priser. Beregn din pris direkte online og få levering i hele Danmark.', enabled: true },
                        { id: '2', heading: 'Storformat print til enhver opgave', text: 'Fra bannere og beachflag til skilte og tekstilprint – vi producerer storformat i topkvalitet. Alt printes med UV-bestandige farver og professionel finish.', enabled: true },
                        { id: '3', heading: 'Dansk trykkeri med hurtig levering', text: 'Vi har over 25 års erfaring og leverer både til erhverv og private. Kontakt os i dag og oplev service, kvalitet og konkurrencedygtige priser.', enabled: true },
                    ]
                };
                const isSEOFocusMode = Boolean(focusedTargetId?.startsWith("site-design-focus-seo"));
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">SEO Tekst</h3>
                            <div className="flex items-center gap-2">
                                {isSEOFocusMode && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        
                        {/* Enable/Disable */}
                        <div id="site-design-focus-seo-content" className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <Label className="text-sm">Vis SEO sektion</Label>
                            <Switch 
                                checked={seoContent.enabled !== false} 
                                onCheckedChange={(checked) => editor.updateDraft({ 
                                    seoContent: { ...seoContent, enabled: checked } 
                                })} 
                            />
                        </div>

                        {seoContent.enabled !== false && (
                            <>
                                {/* Background Color */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Baggrund</h4>
                                    <ColorPickerWithSwatches
                                        label="Baggrundsfarve"
                                        value={seoContent.backgroundColor || ''}
                                        fallback="Bruger sekundær farve"
                                        onChange={(color) => editor.updateDraft({ 
                                            seoContent: { ...seoContent, backgroundColor: color } 
                                        })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>

                                {/* SEO Items */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Tekstblokke</h4>
                                    {seoContent.items?.map((item: any, index: number) => (
                                        <div 
                                            key={item.id} 
                                            id={`site-design-focus-seo-item-${item.id}`}
                                            className="p-3 bg-muted/30 rounded-lg space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{index + 1}. {item.heading}</span>
                                                <Switch 
                                                    checked={item.enabled !== false} 
                                                    onCheckedChange={(checked) => {
                                                        const newItems = [...(seoContent.items || [])];
                                                        newItems[index] = { ...item, enabled: checked };
                                                        editor.updateDraft({ seoContent: { ...seoContent, items: newItems } });
                                                    }}
                                                />
                                            </div>
                                            {item.enabled !== false && (
                                                <>
                                                    {/* Heading */}
                                                    <div 
                                                        id={`site-design-focus-seo-item-${item.id}-heading`}
                                                        className="space-y-1"
                                                    >
                                                        <Label className="text-xs">Overskrift</Label>
                                                        <Textarea
                                                            value={item.heading}
                                                            onChange={(e) => {
                                                                const newItems = [...(seoContent.items || [])];
                                                                newItems[index] = { ...item, heading: e.target.value };
                                                                editor.updateDraft({ seoContent: { ...seoContent, items: newItems } });
                                                            }}
                                                            placeholder="F.eks. Billige tryksager online"
                                                            className="text-sm min-h-[50px] resize-none"
                                                        />
                                                    </div>
                                                    
                                                    {/* Text */}
                                                    <div 
                                                        id={`site-design-focus-seo-item-${item.id}-text`}
                                                        className="space-y-1"
                                                    >
                                                        <Label className="text-xs">Tekst</Label>
                                                        <Textarea
                                                            value={item.text}
                                                            onChange={(e) => {
                                                                const newItems = [...(seoContent.items || [])];
                                                                newItems[index] = { ...item, text: e.target.value };
                                                                editor.updateDraft({ seoContent: { ...seoContent, items: newItems } });
                                                            }}
                                                            placeholder="Beskrivende tekst..."
                                                            className="text-sm min-h-[100px] resize-none"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                );
	            }
	            case 'typography': {
	                const isTypographyFocusMode = Boolean(focusedTargetId?.startsWith("site-design-focus-typography"));
	                const fontPresets = editor.draft.fontPresets?.length
	                    ? editor.draft.fontPresets
	                    : DEFAULT_BRANDING.fontPresets;
	                const applyFontPreset = (preset: typeof DEFAULT_BRANDING.fontPresets[number]) => {
	                    editor.updateDraft(buildFontPresetThemePatch(editor.draft, preset.fonts));
	                    toast.success("Font preset anvendt");
	                };
	                return (
	                    <div className="space-y-3 px-3 pb-6">
	                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Typografi</h3>
                            <div className="flex items-center gap-2">
                                {isTypographyFocusMode && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
	                            </div>
	                        </div>
	                        <div className="space-y-3 pt-2">
	                            {!isTypographyFocusMode && (
	                                <Card className="overflow-hidden">
	                                    <CardHeader className="space-y-1 p-3 pb-0">
	                                        <CardTitle className="text-sm">Font presets</CardTitle>
	                                        <CardDescription className="text-xs text-muted-foreground">
	                                            Vælg en samlet skrifttype-pakke til header, banner, USP strip, produkter, matrix og priser.
	                                        </CardDescription>
	                                    </CardHeader>
	                                    <CardContent className="space-y-2 p-3 pt-3">
	                                        {fontPresets.map((preset) => (
	                                            <div key={preset.id} className="rounded-lg border bg-background p-2">
	                                                <div className="flex items-start justify-between gap-2">
	                                                    <button
	                                                        type="button"
	                                                        className="min-w-0 flex-1 text-left"
	                                                        onClick={() => applyFontPreset(preset)}
	                                                    >
	                                                        <div className="flex items-center gap-2">
	                                                            <span
	                                                                className="truncate text-sm font-semibold"
	                                                                style={{ fontFamily: `'${preset.fonts.heading}', sans-serif` }}
	                                                            >
	                                                                {preset.name}
	                                                            </span>
	                                                            {preset.isSystem ? (
	                                                                <Badge variant="outline" className="h-4 rounded-sm px-1 text-[9px] uppercase">Preset</Badge>
	                                                            ) : null}
	                                                        </div>
	                                                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
	                                                            {preset.description}
	                                                        </p>
	                                                        <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
	                                                            <span className="truncate rounded bg-muted px-1.5 py-1" style={{ fontFamily: `'${preset.fonts.heading}', sans-serif` }}>
	                                                                {preset.fonts.heading}
	                                                            </span>
	                                                            <span className="truncate rounded bg-muted px-1.5 py-1" style={{ fontFamily: `'${preset.fonts.body}', sans-serif` }}>
	                                                                {preset.fonts.body}
	                                                            </span>
	                                                            <span className="truncate rounded bg-muted px-1.5 py-1" style={{ fontFamily: `'${preset.fonts.pricing}', monospace` }}>
	                                                                {preset.fonts.pricing}
	                                                            </span>
	                                                        </div>
	                                                    </button>
	                                                    <Button
	                                                        size="sm"
	                                                        variant="outline"
	                                                        className="h-7 shrink-0 px-2 text-[11px]"
	                                                        onClick={() => applyFontPreset(preset)}
	                                                    >
	                                                        Brug
	                                                    </Button>
	                                                </div>
	                                            </div>
	                                        ))}
	                                    </CardContent>
	                                </Card>
	                            )}
	                            {(!isTypographyFocusMode || focusedTargetId === "site-design-focus-typography-heading") && (
	                                <div id="site-design-focus-typography-heading">
                                    <FontSelector
                                        label="Overskrifter"
                                        inline
                                        value={editor.draft.fonts.heading}
                                        onChange={(v) => editor.updateDraft({
                                            fonts: { ...editor.draft.fonts, heading: v }
                                        })}
                                    />
                                </div>
                            )}
                            {(!isTypographyFocusMode || focusedTargetId === "site-design-focus-typography-body") && (
                                <div id="site-design-focus-typography-body">
                                    <FontSelector
                                        label="Brødtekst"
                                        inline
                                        value={editor.draft.fonts.body}
                                        onChange={(v) => editor.updateDraft({
                                            fonts: { ...editor.draft.fonts, body: v }
                                        })}
                                    />
                                </div>
                            )}
                            {(!isTypographyFocusMode || focusedTargetId === "site-design-focus-typography-pricing") && (
                                <div id="site-design-focus-typography-pricing">
                                    <FontSelector
                                        label="Priser"
                                        inline
                                        value={editor.draft.fonts.pricing}
                                        onChange={(v) => editor.updateDraft({
                                            fonts: { ...editor.draft.fonts, pricing: v }
                                        })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            case 'page-background': {
                return (
                    <div id="site-design-focus-page-background" className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Sidebaggrund</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                Denne sektion styrer kun den overordnede sidebaggrund bag shoppen, inkl. farve, gradient og baggrundsbillede.
                            </div>
                            <PageBackgroundControls
                                colors={editor.draft.colors}
                                savedSwatches={editor.draft.savedSwatches}
                                onColorsChange={updatePageBackgroundColors}
                                onSaveSwatch={saveColorSwatch}
                                onRemoveSwatch={removeColorSwatch}
                                onUploadImage={handlePageBackgroundImageUpload}
                                uploadingImage={uploadingPageBackgroundImage}
                            />
                        </div>
                    </div>
                );
            }
            case 'colors': {
                const isColorsFocusMode = Boolean(focusedTargetId?.startsWith("site-design-focus-colors"));
                const colorPresets = editor.draft.colorPresets?.length
                    ? editor.draft.colorPresets
                    : DEFAULT_BRANDING.colorPresets;
	                const presetName = colorPresetName.trim();
	                const applyColorPreset = (preset: typeof DEFAULT_BRANDING.colorPresets[number]) => {
	                    editor.updateDraft(buildColorPresetThemePatch(editor.draft, preset.colors));
	                    toast.success("Farvesæt anvendt på temaet");
	                };
                const saveCurrentColorPreset = () => {
                    const name = presetName || `Farvesæt ${colorPresets.length + 1}`;
                    const colors = BRANDING_COLOR_KEYS.reduce((acc, key) => {
                        acc[key] = editor.draft.colors[key] || DEFAULT_BRANDING.colors[key];
                        return acc;
                    }, {} as Record<BrandingColorKey, string>);

                    editor.updateDraft({
                        colorPresets: [
                            ...colorPresets,
                            {
                                id: `custom-${Date.now()}`,
                                name,
                                colors,
                                createdAt: new Date().toISOString(),
                                isSystem: false,
                            },
                        ],
                    });
                    setColorPresetName("");
                    toast.success("Farvesæt gemt");
                };
                const removeColorPreset = (presetId: string) => {
                    editor.updateDraft({
                        colorPresets: colorPresets.filter((preset) => preset.id !== presetId),
                    });
                };
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Farver</h3>
                            <div className="flex items-center gap-2">
                                {isColorsFocusMode && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
	                                Farvesæt opdaterer nu de delte tema-farver samt header, sidebaggrund, produktknapper, matrix, prisboks og hover-tilstande.
                            </div>
                            {!isColorsFocusMode && (
                                <Card className="overflow-hidden">
                                    <CardHeader className="space-y-1 p-3 pb-0">
                                        <CardTitle className="text-sm">Farvesæt</CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground">
                                            Vælg et samlet sæt med sikre tekst/flade-kontraster, eller gem de aktuelle farver som et nyt preset.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 p-3 pt-3">
                                        <div className="grid gap-2">
                                            {colorPresets.map((preset) => (
                                                <div
                                                    key={preset.id}
                                                    className="rounded-lg border bg-background p-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <button
                                                            type="button"
                                                            className="min-w-0 flex-1 text-left"
                                                            onClick={() => applyColorPreset(preset)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="truncate text-xs font-semibold">{preset.name}</span>
                                                                {preset.isSystem ? (
                                                                    <Badge variant="outline" className="h-4 rounded-sm px-1 text-[9px] uppercase">Demo</Badge>
                                                                ) : null}
                                                            </div>
                                                            <div className="mt-2 flex h-6 overflow-hidden rounded border">
                                                                {BRANDING_COLOR_KEYS.map((key) => (
                                                                    <span
                                                                        key={key}
                                                                        className="flex-1"
                                                                        style={{ backgroundColor: preset.colors[key] }}
                                                                        title={`${key}: ${preset.colors[key]}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </button>
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 px-2 text-[11px]"
                                                                onClick={() => applyColorPreset(preset)}
                                                            >
                                                                Brug
                                                            </Button>
                                                            {!preset.isSystem && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => removeColorPreset(preset.id)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-lg border border-dashed p-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Gem aktuelle farver som preset</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={colorPresetName}
                                                        onChange={(event) => setColorPresetName(event.target.value)}
                                                        placeholder="Navn på farvesæt"
                                                        className="h-8 text-xs"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8 shrink-0 gap-1"
                                                        onClick={saveCurrentColorPreset}
                                                    >
                                                        <Save className="h-3.5 w-3.5" />
                                                        Gem
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            {BRANDING_COLOR_GROUPS.map((group) => {
                                const visibleFields = group.fields.filter((field) => (
                                    !isColorsFocusMode || focusedTargetId === `site-design-focus-colors-${field.key}`
                                ));

                                if (visibleFields.length === 0) {
                                    return null;
                                }

                                return (
                                <div key={group.title} className="space-y-3 rounded-lg border p-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-semibold">{group.title}</h4>
                                            {group.badge ? (
                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                                    {group.badge}
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{group.description}</p>
                                    </div>
                                    <Separator />
                                    <div className="space-y-3">
                                        {visibleFields.map((field, index) => {
                                            const value = editor.draft.colors[field.key];
                                            return (
                                                <div
                                                    key={field.key}
                                                    id={`site-design-focus-colors-${field.key}`}
                                                    className={index === 0 ? "space-y-1.5" : "space-y-1.5 border-t border-border/60 pt-3"}
                                                >
                                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
                                                        <div className="space-y-1 pr-2">
                                                            <p className="text-sm font-medium leading-5">{field.label}</p>
                                                            <p className="text-xs leading-5 text-muted-foreground">
                                                                {field.description}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 pt-0.5">
                                                            <ColorPickerWithSwatches
                                                                value={value}
                                                                onChange={(color) => editor.updateDraft({
                                                                    colors: { ...editor.draft.colors, [field.key]: color }
                                                                })}
                                                                compact={true}
                                                                showFullSwatches={false}
                                                                savedSwatches={editor.draft.savedSwatches}
                                                                onSaveSwatch={saveColorSwatch}
                                                                onRemoveSwatch={removeColorSwatch}
                                                            />
                                                            <span className="text-[11px] font-mono uppercase text-muted-foreground">
                                                                {String(value)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                );
            }
            case 'product-page-matrix': {
                const matrixFields: MatrixColorFieldConfig[] = [
                    {
                        key: "headerBg",
                        label: "Kolonneheader baggrund",
                        description: "Baggrund for top-rækken i prismatrixen.",
                    },
                    {
                        key: "headerText",
                        label: "Kolonneheader tekst",
                        description: "Tekstfarve i top-rækken i prismatrixen.",
                    },
                    {
                        key: "rowHeaderBg",
                        label: "Venstre kolonne baggrund",
                        description: "Baggrund for venstre kolonne med materialer i prismatrixen.",
                    },
                    {
                        key: "rowHeaderText",
                        label: "Venstre kolonne tekst",
                        description: "Tekstfarve for materialer i venstre kolonne i prismatrixen.",
                    },
                    {
                        key: "cellBg",
                        label: "Prisfelt baggrund",
                        description: "Standard baggrund for selve prisfelterne i matrixen.",
                    },
                    {
                        key: "cellText",
                        label: "Prisfelt tekst",
                        description: "Standard tekstfarve for selve prisfelterne i matrixen.",
                    },
                    {
                        key: "cellHoverBg",
                        label: "Hover baggrund",
                        description: "Baggrund når man holder musen over et prisfelt i matrixen.",
                    },
                    {
                        key: "cellHoverText",
                        label: "Hover tekst",
                        description: "Tekstfarve ved hover på et prisfelt i matrixen.",
                    },
                    {
                        key: "selectedBg",
                        label: "Valgt baggrund",
                        description: "Baggrund for det valgte prisfelt i matrixen.",
                    },
                    {
                        key: "selectedText",
                        label: "Valgt tekst",
                        description: "Tekstfarve for det valgte prisfelt i matrixen.",
                    },
                    {
                        key: "borderColor",
                        label: "Border og separator",
                        description: "Bruges til borders, skillelinjer og matrixens ydre ramme.",
                    },
                    {
                        key: "navButtonBg",
                        label: "Knap baggrund",
                        description: "Baggrund på Forrige/Næste-knapperne ved matrixen.",
                    },
                    {
                        key: "navButtonText",
                        label: "Knap tekst",
                        description: "Tekst- og ikonfarve på Forrige/Næste-knapperne.",
                    },
                    {
                        key: "navButtonHoverBg",
                        label: "Knap hover baggrund",
                        description: "Baggrund når man holder over Forrige/Næste-knapperne.",
                    },
                    {
                        key: "navButtonHoverText",
                        label: "Knap hover tekst",
                        description: "Tekst- og ikonfarve ved hover på Forrige/Næste-knapperne.",
                    },
                    {
                        key: "navButtonBorder",
                        label: "Knap border",
                        description: "Kantfarve på Forrige/Næste-knapperne.",
                    },
                    {
                        key: "navButtonHoverBorder",
                        label: "Knap hover border",
                        description: "Kantfarve ved hover på Forrige/Næste-knapperne.",
                    },
                ];
                const pricePanelColorFields: PricePanelColorFieldConfig[] = [
                    {
                        key: "titleColor",
                        label: "Titel",
                        description: "Overskriften “Prisberegning”.",
                    },
                    {
                        key: "textColor",
                        label: "Brødtekst",
                        description: "Standardtekst i prisberegneren.",
                    },
                    {
                        key: "mutedTextColor",
                        label: "Hjælpetekst",
                        description: "Små labels, beskrivelser og sekundær tekst.",
                    },
                    {
                        key: "priceColor",
                        label: "Prisfarve",
                        description: "Store priser, leveringspriser og total.",
                    },
                    {
                        key: "borderColor",
                        label: "Ydre border",
                        description: "Rammen rundt om hele prisberegneren.",
                    },
                    {
                        key: "dividerColor",
                        label: "Separatorer",
                        description: "Skillelinjer mellem sektioner i prisberegneren.",
                    },
                    {
                        key: "optionBg",
                        label: "Leveringskort baggrund",
                        description: "Standard baggrund for leveringsvalgene.",
                    },
                    {
                        key: "optionHoverBg",
                        label: "Leveringskort hover",
                        description: "Baggrund når man holder over et leveringsvalg.",
                    },
                    {
                        key: "optionSelectedBg",
                        label: "Valgt leveringskort",
                        description: "Baggrund for det valgte leveringsvalg.",
                    },
                    {
                        key: "optionBorderColor",
                        label: "Leveringskort border",
                        description: "Standard border for leveringsvalgene.",
                    },
                    {
                        key: "optionHoverBorderColor",
                        label: "Hover border",
                        description: "Border når man holder over et leveringsvalg.",
                    },
                    {
                        key: "optionSelectedBorderColor",
                        label: "Valgt border",
                        description: "Border for det valgte leveringsvalg og badge-kant.",
                    },
                    {
                        key: "badgeBg",
                        label: "Deadline-badge baggrund",
                        description: "Baggrund for de små deadline-badges.",
                    },
                    {
                        key: "badgeText",
                        label: "Deadline-badge tekst",
                        description: "Tekstfarve i de små deadline-badges.",
                    },
                    {
                        key: "badgeBorderColor",
                        label: "Deadline-badge border",
                        description: "Kanten rundt om de små deadline-badges.",
                    },
                    {
                        key: "downloadButtonBg",
                        label: "Download-knap baggrund",
                        description: "Baggrund på “Download tilbud”-knappen.",
                    },
                    {
                        key: "downloadButtonHoverBg",
                        label: "Download-knap hover",
                        description: "Baggrund når man holder over “Download tilbud”.",
                    },
                    {
                        key: "downloadButtonText",
                        label: "Download-knap tekst",
                        description: "Tekst- og ikonfarve på “Download tilbud”.",
                    },
                    {
                        key: "downloadButtonHoverText",
                        label: "Download-knap hover tekst",
                        description: "Tekst- og ikonfarve ved hover.",
                    },
                    {
                        key: "downloadButtonBorder",
                        label: "Download-knap border",
                        description: "Kantfarve på “Download tilbud”-knappen.",
                    },
                    {
                        key: "downloadButtonHoverBorder",
                        label: "Download-knap hover border",
                        description: "Kantfarve ved hover.",
                    },
                ];
                const pictureButtons = editor.draft.productPage?.matrix?.pictureButtons
                    || DEFAULT_BRANDING.productPage.matrix.pictureButtons;
                const productPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                const matrixConfig = {
                    ...DEFAULT_BRANDING.productPage.matrix,
                    ...(productPage.matrix || {}),
                    pictureButtons: {
                        ...DEFAULT_BRANDING.productPage.matrix.pictureButtons,
                        ...(productPage.matrix?.pictureButtons || {}),
                    },
                };
                const panelPrimary = editor.draft.colors.primary || "#0EA5E9";
                const pricePanelDefaults = {
                    backgroundColor: hexToRgba(panelPrimary, 0.05),
                    gradientStart: hexToRgba(panelPrimary, 0.1),
                    gradientEnd: editor.draft.colors.card || "#FFFFFF",
                    titleColor: editor.draft.colors.headingText || "#1F2937",
                    textColor: editor.draft.colors.headingText || "#1F2937",
                    mutedTextColor: editor.draft.colors.bodyText || "#475569",
                    priceColor: panelPrimary,
                    borderColor: hexToRgba(panelPrimary, 0.18),
                    dividerColor: hexToRgba(panelPrimary, 0.12),
                    optionBg: editor.draft.colors.card || "#FFFFFF",
                    optionHoverBg: hexToRgba(panelPrimary, 0.04),
                    optionSelectedBg: hexToRgba(panelPrimary, 0.08),
                    optionBorderColor: editor.draft.colors.secondary || "#E2E8F0",
                    optionHoverBorderColor: hexToRgba(panelPrimary, 0.3),
                    optionSelectedBorderColor: panelPrimary,
                    badgeBg: hexToRgba(panelPrimary, 0.1),
                    badgeText: panelPrimary,
                    badgeBorderColor: panelPrimary,
                    downloadButtonBg: editor.draft.colors.card || "#FFFFFF",
                    downloadButtonHoverBg: hexToRgba(panelPrimary, 0.04),
                    downloadButtonText: editor.draft.colors.headingText || "#1F2937",
                    downloadButtonHoverText: editor.draft.colors.headingText || "#1F2937",
                    downloadButtonBorder: editor.draft.colors.secondary || "#E2E8F0",
                    downloadButtonHoverBorder: hexToRgba(panelPrimary, 0.3),
                };
                const pricePanel = productPage.pricePanel || DEFAULT_BRANDING.productPage.pricePanel;
                const pricePanelConfig = {
                    ...DEFAULT_BRANDING.productPage.pricePanel,
                    ...(productPage.pricePanel || {}),
                    backgroundColor: pricePanel.backgroundColor || pricePanelDefaults.backgroundColor,
                    gradientStart: pricePanel.gradientStart || pricePanelDefaults.gradientStart,
                    gradientEnd: pricePanel.gradientEnd || pricePanelDefaults.gradientEnd,
                    titleColor: pricePanel.titleColor || pricePanelDefaults.titleColor,
                    textColor: pricePanel.textColor || pricePanelDefaults.textColor,
                    mutedTextColor: pricePanel.mutedTextColor || pricePanelDefaults.mutedTextColor,
                    priceColor: pricePanel.priceColor || pricePanelDefaults.priceColor,
                    borderColor: pricePanel.borderColor || pricePanelDefaults.borderColor,
                    dividerColor: pricePanel.dividerColor || pricePanelDefaults.dividerColor,
                    optionBg: pricePanel.optionBg || pricePanelDefaults.optionBg,
                    optionHoverBg: pricePanel.optionHoverBg || pricePanelDefaults.optionHoverBg,
                    optionSelectedBg: pricePanel.optionSelectedBg || pricePanelDefaults.optionSelectedBg,
                    optionBorderColor: pricePanel.optionBorderColor || pricePanelDefaults.optionBorderColor,
                    optionHoverBorderColor: pricePanel.optionHoverBorderColor || pricePanelDefaults.optionHoverBorderColor,
                    optionSelectedBorderColor: pricePanel.optionSelectedBorderColor || pricePanelDefaults.optionSelectedBorderColor,
                    badgeBg: pricePanel.badgeBg || pricePanelDefaults.badgeBg,
                    badgeText: pricePanel.badgeText || pricePanelDefaults.badgeText,
                    badgeBorderColor: pricePanel.badgeBorderColor || pricePanelDefaults.badgeBorderColor,
                    downloadButtonBg: pricePanel.downloadButtonBg || pricePanelDefaults.downloadButtonBg,
                    downloadButtonHoverBg: pricePanel.downloadButtonHoverBg || pricePanelDefaults.downloadButtonHoverBg,
                    downloadButtonText: pricePanel.downloadButtonText || pricePanelDefaults.downloadButtonText,
                    downloadButtonHoverText: pricePanel.downloadButtonHoverText || pricePanelDefaults.downloadButtonHoverText,
                    downloadButtonBorder: pricePanel.downloadButtonBorder || pricePanelDefaults.downloadButtonBorder,
                    downloadButtonHoverBorder: pricePanel.downloadButtonHoverBorder || pricePanelDefaults.downloadButtonHoverBorder,
                    borderWidth: clamp(Number(pricePanel.borderWidth) || 2, 0, 8),
                    radiusPx: clamp(Number(pricePanel.radiusPx) || 12, 0, 40),
                    gradientAngle: clamp(Number(pricePanel.gradientAngle) || 135, 0, 360),
                };
                const orderButtons = productPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
                const orderButtonFallbacks = {
                    primary: {
                        bgColor: editor.draft.colors.primary,
                        hoverBgColor: editor.draft.colors.primary,
                        textColor: "#FFFFFF",
                        hoverTextColor: "#FFFFFF",
                        borderColor: editor.draft.colors.primary,
                        hoverBorderColor: editor.draft.colors.primary,
                    },
                    secondary: {
                        bgColor: editor.draft.colors.card,
                        hoverBgColor: editor.draft.colors.secondary,
                        textColor: editor.draft.colors.bodyText,
                        hoverTextColor: editor.draft.colors.headingText,
                        borderColor: editor.draft.colors.secondary || "#E2E8F0",
                        hoverBorderColor: editor.draft.colors.primary,
                    },
                    selected: {
                        bgColor: "#16A34A",
                        hoverBgColor: "#15803D",
                        textColor: "#FFFFFF",
                        hoverTextColor: "#FFFFFF",
                        borderColor: "#16A34A",
                        hoverBorderColor: "#15803D",
                    },
                };
                const resolveOrderButton = (
                    button: typeof orderButtons.primary,
                    fallback: typeof orderButtonFallbacks.primary,
                ) => ({
                    bgColor: button?.bgColor || fallback.bgColor,
                    hoverBgColor: button?.hoverBgColor || fallback.hoverBgColor,
                    textColor: button?.textColor || fallback.textColor,
                    hoverTextColor: button?.hoverTextColor || fallback.hoverTextColor,
                    borderColor: button?.borderColor || fallback.borderColor,
                    hoverBorderColor: button?.hoverBorderColor || fallback.hoverBorderColor,
                });
                const primaryOrderButton = resolveOrderButton(orderButtons.primary, orderButtonFallbacks.primary);
                const secondaryOrderButton = resolveOrderButton(orderButtons.secondary, orderButtonFallbacks.secondary);
                const selectedOrderButton = resolveOrderButton(orderButtons.selected, orderButtonFallbacks.selected);

                const updateMatrix = (updates: Partial<typeof matrixConfig>) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    const currentMatrix = {
                        ...DEFAULT_BRANDING.productPage.matrix,
                        ...(currentProductPage.matrix || {}),
                        pictureButtons: {
                            ...DEFAULT_BRANDING.productPage.matrix.pictureButtons,
                            ...(currentProductPage.matrix?.pictureButtons || {}),
                        },
                    };
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            matrix: {
                                ...currentMatrix,
                                ...updates,
                            },
                        },
                    });
                };
                const updatePricePanel = (updates: Partial<typeof DEFAULT_BRANDING.productPage.pricePanel>) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    const currentPricePanel = currentProductPage.pricePanel || DEFAULT_BRANDING.productPage.pricePanel;
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            pricePanel: {
                                ...currentPricePanel,
                                ...updates,
                            },
                        },
                    });
                };
                const updatePictureButtons = (updates: Partial<typeof pictureButtons>) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    const currentMatrix = currentProductPage.matrix || DEFAULT_BRANDING.productPage.matrix;
                    const currentPictureButtons = currentMatrix.pictureButtons || DEFAULT_BRANDING.productPage.matrix.pictureButtons;
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            matrix: {
                                ...currentMatrix,
                                pictureButtons: {
                                    ...currentPictureButtons,
                                    ...updates,
                                },
                            },
                        },
                    });
                };
                const updateOrderButton = (
                    buttonKey: "primary" | "secondary" | "selected",
                    updates: Partial<typeof orderButtons.primary>,
                ) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    const currentOrderButtons = currentProductPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            orderButtons: {
                                ...currentOrderButtons,
                                [buttonKey]: {
                                    ...currentOrderButtons[buttonKey],
                                    ...updates,
                                },
                            },
                        },
                    });
                };
                const renderPricePanelField = (field: PricePanelColorFieldConfig) => {
                    const value = pricePanelConfig[field.key];

                    return (
                        <div key={field.key} className="space-y-1.5">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
                                <div className="space-y-1 pr-2">
                                    <p className="text-sm font-medium leading-5">{field.label}</p>
                                    <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 pt-0.5">
                                    <ColorPickerWithSwatches
                                        value={value}
                                        onChange={(color) => updatePricePanel({ [field.key]: color })}
                                        compact={true}
                                        showFullSwatches={false}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <span className="text-[11px] font-mono uppercase text-muted-foreground">
                                        {String(value)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                };
                const renderMatrixField = (field: MatrixColorFieldConfig) => {
                    const value = matrixConfig[field.key];

                    return (
                        <div key={field.key} className="space-y-1.5">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
                                <div className="space-y-1 pr-2">
                                    <p className="text-sm font-medium leading-5">{field.label}</p>
                                    <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 pt-0.5">
                                    <ColorPickerWithSwatches
                                        value={String(value)}
                                        onChange={(color) => updateMatrix({ [field.key]: color } as Partial<typeof matrixConfig>)}
                                        compact={true}
                                        showFullSwatches={false}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <span className="text-[11px] font-mono uppercase text-muted-foreground">
                                        {String(value)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                };
                const matrixTopRowFields = matrixFields.filter((field) =>
                    field.key === "headerBg"
                    || field.key === "headerText"
                    || field.key === "borderColor"
                );
                const matrixVerticalFields = matrixFields.filter((field) =>
                    field.key === "rowHeaderBg"
                    || field.key === "rowHeaderText"
                    || field.key === "borderColor"
                );
                const matrixPricingFields = matrixFields.filter((field) =>
                    field.key === "cellBg"
                    || field.key === "cellText"
                    || field.key === "cellHoverBg"
                    || field.key === "cellHoverText"
                    || field.key === "selectedBg"
                    || field.key === "selectedText"
                    || field.key === "borderColor"
                );
                const matrixButtonFields = matrixFields.filter((field) =>
                    field.key === "navButtonBg"
                    || field.key === "navButtonText"
                    || field.key === "navButtonHoverBg"
                    || field.key === "navButtonHoverText"
                    || field.key === "navButtonBorder"
                    || field.key === "navButtonHoverBorder"
                );
                const pricePanelTitleField = pricePanelColorFields.find((field) => field.key === "titleColor");
                const pricePanelPriceField = pricePanelColorFields.find((field) => field.key === "priceColor");
                const pricePanelTextFields = pricePanelColorFields.filter((field) => field.key === "textColor" || field.key === "mutedTextColor");
                const pricePanelBoxFields = pricePanelColorFields.filter((field) => field.key === "borderColor" || field.key === "dividerColor");
                const pricePanelDeliveryCardFields = pricePanelColorFields.filter((field) =>
                    field.key === "optionBg"
                    || field.key === "optionHoverBg"
                    || field.key === "optionSelectedBg"
                    || field.key === "optionBorderColor"
                    || field.key === "optionHoverBorderColor"
                    || field.key === "optionSelectedBorderColor"
                );
                const pricePanelBadgeFields = pricePanelColorFields.filter((field) =>
                    field.key === "badgeBg"
                    || field.key === "badgeText"
                    || field.key === "badgeBorderColor"
                );
                const pricePanelDownloadButtonFields = pricePanelColorFields.filter((field) =>
                    field.key === "downloadButtonBg"
                    || field.key === "downloadButtonHoverBg"
                    || field.key === "downloadButtonText"
                    || field.key === "downloadButtonHoverText"
                    || field.key === "downloadButtonBorder"
                    || field.key === "downloadButtonHoverBorder"
                );

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Produktside prismatrix, prisberegner & knapper</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-product-page") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <Card id="site-design-focus-product-page-box">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prismatrix-boks</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer den afrundede boks rundt om selve prismatrixen.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                    Brug denne sektion til den hvide/afrundede ramme omkring tabellen, ikke cellerne inde i tabellen.
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ColorPickerWithSwatches
                                        label="Boks baggrund"
                                        value={matrixConfig.boxBackgroundColor}
                                        onChange={(color) => updateMatrix({ boxBackgroundColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Boks border"
                                        value={matrixConfig.boxBorderColor}
                                        onChange={(color) => updateMatrix({ boxBorderColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Runding</Label>
                                        <span className="text-xs text-muted-foreground">{matrixConfig.boxBorderRadiusPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={40}
                                        step={1}
                                        value={[matrixConfig.boxBorderRadiusPx]}
                                        onValueChange={([value]) => updateMatrix({ boxBorderRadiusPx: value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Border-bredde</Label>
                                        <span className="text-xs text-muted-foreground">{matrixConfig.boxBorderWidthPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={8}
                                        step={1}
                                        value={[matrixConfig.boxBorderWidthPx]}
                                        onValueChange={([value]) => updateMatrix({ boxBorderWidthPx: value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Indvendig afstand</Label>
                                        <span className="text-xs text-muted-foreground">{matrixConfig.boxPaddingPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={40}
                                        step={1}
                                        value={[matrixConfig.boxPaddingPx]}
                                        onValueChange={([value]) => updateMatrix({ boxPaddingPx: value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-matrix-top-row">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prismatrix top-række</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer antal-rækken øverst i matrixen.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {matrixTopRowFields.map(renderMatrixField)}
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-matrix-vertical">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prismatrix venstre kolonne</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer den lodrette kolonne med materialer eller rækkevalg.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {matrixVerticalFields.map(renderMatrixField)}
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-matrix-pricing">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prismatrix priser</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer prisfelterne, hover og valgt prisfelt.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {matrixPricingFields.map(renderMatrixField)}
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-matrix-buttons">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prismatrix knapper</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer Forrige/Næste-knapperne ved matrixen.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {matrixButtonFields.map(renderMatrixField)}
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-colors">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Farver for prismatrixen</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Gælder kun selve prismatrixen med materialer, antal og priser. Påvirker ikke dropdowns, valgfelter, prispanel eller tekstsektioner.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                    Brug denne sektion til den lille pristabel med materialer, antal og priser.
                                    Alt andet på produktsiden styres separat.
                                </div>
                                {matrixFields.map((field, index) => {
                                    const value = matrixConfig[field.key];
                                    return (
                                        <div
                                            key={field.key}
                                            id={`site-design-focus-product-page-colors-${field.key}`}
                                            className={index === 0 ? "space-y-1.5" : "space-y-1.5 border-t border-border/60 pt-3"}
                                        >
                                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
                                                <div className="space-y-1 pr-2">
                                                    <p className="text-sm font-medium leading-5">{field.label}</p>
                                                    <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 pt-0.5">
                                                    <ColorPickerWithSwatches
                                                        value={value}
                                                        onChange={(color) => updateMatrix({ [field.key]: color })}
                                                        compact={true}
                                                        showFullSwatches={false}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                    <span className="text-[11px] font-mono uppercase text-muted-foreground">
                                                        {String(value)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-price-panel">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prisberegner</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Gælder kun boksen med “Prisberegning”, levering og samlet pris. Påvirker ikke prismatrixen eller CTA-knapperne.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                    Brug denne sektion til højrepanelet med priser, levering, badges og total.
                                </div>
                                <div id="site-design-focus-product-page-price-panel-box" className="space-y-4 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Prisberegner-boks</h4>
                                        <p className="text-xs text-muted-foreground">Baggrund, gradient, rounding, panel-border og separatorer.</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Baggrundstype</Label>
                                            <Select
                                                value={pricePanelConfig.backgroundType}
                                                onValueChange={(value) => updatePricePanel({ backgroundType: value as typeof pricePanelConfig.backgroundType })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="solid">Farve</SelectItem>
                                                    <SelectItem value="gradient">Gradient</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label>Runding</Label>
                                                <span className="text-xs text-muted-foreground">{pricePanelConfig.radiusPx}px</span>
                                            </div>
                                            <Slider
                                                min={0}
                                                max={40}
                                                step={1}
                                                value={[pricePanelConfig.radiusPx]}
                                                onValueChange={([value]) => updatePricePanel({ radiusPx: value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Border-bredde</Label>
                                            <span className="text-xs text-muted-foreground">{pricePanelConfig.borderWidth}px</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={8}
                                            step={1}
                                            value={[pricePanelConfig.borderWidth]}
                                            onValueChange={([value]) => updatePricePanel({ borderWidth: value })}
                                        />
                                    </div>
                                    {pricePanelConfig.backgroundType === "solid" ? (
                                        <ColorPickerWithSwatches
                                            label="Baggrundsfarve"
                                            value={pricePanelConfig.backgroundColor}
                                            onChange={(color) => updatePricePanel({ backgroundColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <ColorPickerWithSwatches
                                                    label="Gradient start"
                                                    value={pricePanelConfig.gradientStart}
                                                    onChange={(color) => updatePricePanel({ gradientStart: color })}
                                                    savedSwatches={editor.draft.savedSwatches}
                                                    onSaveSwatch={(color) => {
                                                        const swatches = editor.draft.savedSwatches || [];
                                                        if (!swatches.includes(color) && swatches.length < 20) {
                                                            editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                        }
                                                    }}
                                                    onRemoveSwatch={(color) => {
                                                        editor.updateDraft({
                                                            savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                        });
                                                    }}
                                                />
                                                <ColorPickerWithSwatches
                                                    label="Gradient slut"
                                                    value={pricePanelConfig.gradientEnd}
                                                    onChange={(color) => updatePricePanel({ gradientEnd: color })}
                                                    savedSwatches={editor.draft.savedSwatches}
                                                    onSaveSwatch={(color) => {
                                                        const swatches = editor.draft.savedSwatches || [];
                                                        if (!swatches.includes(color) && swatches.length < 20) {
                                                            editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                        }
                                                    }}
                                                    onRemoveSwatch={(color) => {
                                                        editor.updateDraft({
                                                            savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Gradient vinkel</Label>
                                                    <span className="text-xs text-muted-foreground">{pricePanelConfig.gradientAngle}°</span>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={360}
                                                    step={5}
                                                    value={[pricePanelConfig.gradientAngle]}
                                                    onValueChange={([value]) => updatePricePanel({ gradientAngle: value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-3 border-t border-border/40 pt-3">
                                        {pricePanelBoxFields.map(renderPricePanelField)}
                                    </div>
                                </div>
                                {pricePanelTitleField && (
                                    <div id="site-design-focus-product-page-price-panel-title" className="space-y-3 rounded-lg border border-border/60 p-4">
                                        <div>
                                            <h4 className="text-sm font-medium">Titel</h4>
                                            <p className="text-xs text-muted-foreground">Overskriften “Prisberegning”.</p>
                                        </div>
                                        {renderPricePanelField(pricePanelTitleField)}
                                    </div>
                                )}
                                <div id="site-design-focus-product-page-price-panel-download-button" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">“Download tilbud”-knap</h4>
                                        <p className="text-xs text-muted-foreground">Baggrund, tekst, ikon og border for download-knappen i toppen af prisberegneren.</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {pricePanelDownloadButtonFields.map(renderPricePanelField)}
                                    </div>
                                </div>
                                <div id="site-design-focus-product-page-price-panel-text" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Informationstekst</h4>
                                        <p className="text-xs text-muted-foreground">Labels, hjælpetekster, leveringsinfo og anden tekst i prisberegneren.</p>
                                    </div>
                                    {pricePanelTextFields.map(renderPricePanelField)}
                                </div>
                                {pricePanelPriceField && (
                                    <div id="site-design-focus-product-page-price-panel-price" className="space-y-3 rounded-lg border border-border/60 p-4">
                                        <div>
                                            <h4 className="text-sm font-medium">Priser</h4>
                                            <p className="text-xs text-muted-foreground">Hovedpris, leveringspris og samlet pris.</p>
                                        </div>
                                        {renderPricePanelField(pricePanelPriceField)}
                                    </div>
                                )}
                                <div id="site-design-focus-product-page-price-panel-delivery-card" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Leveringskort</h4>
                                        <p className="text-xs text-muted-foreground">Baggrund og border for leveringsboksene i normal, hover og valgt tilstand.</p>
                                    </div>
                                    {pricePanelDeliveryCardFields.map(renderPricePanelField)}
                                </div>
                                <div id="site-design-focus-product-page-price-panel-badge" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Tidstæller</h4>
                                        <p className="text-xs text-muted-foreground">Farver og border for countdown-badget.</p>
                                    </div>
                                    {pricePanelBadgeFields.map(renderPricePanelField)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-picture-buttons">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Billedknapper (matrix)</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Disse knapper er separate og påvirkes ikke af farverne for prismatrixen ovenfor.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Vis hover-overlay på billeder</Label>
                                    <Switch
                                        checked={pictureButtons.hoverEnabled ?? true}
                                        onCheckedChange={(checked) => updatePictureButtons({ hoverEnabled: checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Hover-farve</Label>
                                    <ColorPickerWithSwatches
                                        value={pictureButtons.hoverColor || DEFAULT_BRANDING.productPage.matrix.pictureButtons.hoverColor}
                                        onChange={(color) => updatePictureButtons({ hoverColor: color })}
                                        compact={true}
                                        showFullSwatches={false}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Hover-opacitet ({Math.round((pictureButtons.hoverOpacity ?? 0.15) * 100)}%)</Label>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[Math.round((pictureButtons.hoverOpacity ?? 0.15) * 100)]}
                                        onValueChange={([value]) => updatePictureButtons({ hoverOpacity: value / 100 })}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label>Valgt-farve</Label>
                                    <ColorPickerWithSwatches
                                        value={pictureButtons.selectedColor || DEFAULT_BRANDING.productPage.matrix.pictureButtons.selectedColor}
                                        onChange={(color) => updatePictureButtons({ selectedColor: color })}
                                        compact={true}
                                        showFullSwatches={false}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Valgt-opacitet ({Math.round((pictureButtons.selectedOpacity ?? 0.22) * 100)}%)</Label>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[Math.round((pictureButtons.selectedOpacity ?? 0.22) * 100)]}
                                        onValueChange={([value]) => updatePictureButtons({ selectedOpacity: value / 100 })}
                                    />
                                </div>

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <Label>Vis outline på billeder</Label>
                                    <Switch
                                        checked={pictureButtons.outlineEnabled ?? true}
                                        onCheckedChange={(checked) => updatePictureButtons({ outlineEnabled: checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Outline-opacitet ({Math.round((pictureButtons.outlineOpacity ?? 1) * 100)}%)</Label>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[Math.round((pictureButtons.outlineOpacity ?? 1) * 100)]}
                                        onValueChange={([value]) => updatePictureButtons({ outlineOpacity: value / 100 })}
                                        disabled={!(pictureButtons.outlineEnabled ?? true)}
                                    />
                                </div>

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <Label>Lille zoom ved hover</Label>
                                    <Switch
                                        checked={pictureButtons.hoverZoomEnabled ?? true}
                                        onCheckedChange={(checked) => updatePictureButtons({ hoverZoomEnabled: checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Zoom-styrke ({(pictureButtons.hoverZoomScale ?? 1.03).toFixed(2)}x)</Label>
                                    <Slider
                                        min={100}
                                        max={115}
                                        step={1}
                                        value={[Math.round((pictureButtons.hoverZoomScale ?? 1.03) * 100)]}
                                        onValueChange={([value]) => updatePictureButtons({ hoverZoomScale: value / 100 })}
                                        disabled={!(pictureButtons.hoverZoomEnabled ?? true)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Animation-hastighed ({pictureButtons.hoverZoomDurationMs ?? 140} ms)</Label>
                                    <Slider
                                        min={80}
                                        max={300}
                                        step={10}
                                        value={[pictureButtons.hoverZoomDurationMs ?? 140]}
                                        onValueChange={([value]) => updatePictureButtons({ hoverZoomDurationMs: value })}
                                        disabled={!(pictureButtons.hoverZoomEnabled ?? true)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card id="site-design-focus-product-page-order-buttons">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Bestillingsknapper</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer knapperne “Design online” og “Bestil nu!” på produktsiden.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div id="site-design-focus-product-page-order-primary" className="space-y-3 rounded-lg border p-3">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-medium">“Bestil nu!”</h4>
                                        <p className="text-xs text-muted-foreground">Primær CTA-knap.</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={primaryOrderButton.bgColor}
                                            onChange={(color) => updateOrderButton("primary", { bgColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={primaryOrderButton.hoverBgColor}
                                            onChange={(color) => updateOrderButton("primary", { hoverBgColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={primaryOrderButton.textColor}
                                            onChange={(color) => updateOrderButton("primary", { textColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={primaryOrderButton.hoverTextColor}
                                            onChange={(color) => updateOrderButton("primary", { hoverTextColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div id="site-design-focus-product-page-order-secondary" className="space-y-3 rounded-lg border p-3">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-medium">“Design online”</h4>
                                        <p className="text-xs text-muted-foreground">Sekundær knap med kant/outline.</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={secondaryOrderButton.bgColor}
                                            onChange={(color) => updateOrderButton("secondary", { bgColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={secondaryOrderButton.hoverBgColor}
                                            onChange={(color) => updateOrderButton("secondary", { hoverBgColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={secondaryOrderButton.textColor}
                                            onChange={(color) => updateOrderButton("secondary", { textColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={secondaryOrderButton.hoverTextColor}
                                            onChange={(color) => updateOrderButton("secondary", { hoverTextColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Kant"
                                            value={secondaryOrderButton.borderColor}
                                            onChange={(color) => updateOrderButton("secondary", { borderColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover kant"
                                            value={secondaryOrderButton.hoverBorderColor}
                                            onChange={(color) => updateOrderButton("secondary", { hoverBorderColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div id="site-design-focus-product-page-order-selected" className="space-y-3 rounded-lg border p-3">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-medium">“Klar til design”</h4>
                                        <p className="text-xs text-muted-foreground">Vises når der allerede er valgt et design.</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={selectedOrderButton.bgColor}
                                            onChange={(color) => updateOrderButton("selected", { bgColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={selectedOrderButton.hoverBgColor}
                                            onChange={(color) => updateOrderButton("selected", { hoverBgColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={selectedOrderButton.textColor}
                                            onChange={(color) => updateOrderButton("selected", { textColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={selectedOrderButton.hoverTextColor}
                                            onChange={(color) => updateOrderButton("selected", { hoverTextColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'produktvalgknapper':
                if (
                    contextualEditor?.kind === "product-option-section-box"
                    && focusedProductOption?.productId
                    && focusedProductOption.sectionId
                ) {
                    return (
                        <ProductOptionSectionBoxEditor
                            productId={focusedProductOption.productId}
                            sectionId={focusedProductOption.sectionId}
                            sectionName={contextualEditor.sectionName}
                            savedSwatches={editor.draft.savedSwatches || []}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            onBack={() => {
                                setContextualEditor(null);
                                setFocusedProductOption({
                                    productId: focusedProductOption.productId,
                                    sectionId: focusedProductOption.sectionId,
                                    valueId: null,
                                    valueName: null,
                                });
                            }}
                        />
                    );
                }

                if (focusedProductOption?.productId && focusedProductOption.sectionId && focusedProductOption.valueId) {
                    return (
                        <ProductOptionButtonEditor
                            productId={focusedProductOption.productId}
                            sectionId={focusedProductOption.sectionId}
                            valueId={focusedProductOption.valueId}
                            valueName={focusedProductOption.valueName || "Valg"}
                            savedSwatches={editor.draft.savedSwatches || []}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            onBack={() => {
                                setFocusedProductOption({
                                    productId: focusedProductOption.productId,
                                    sectionId: focusedProductOption.sectionId,
                                    valueId: null,
                                    valueName: null,
                                });
                                setContextualEditor(null);
                            }}
                        />
                    );
                }

                return (
                    <ProduktvalgknapperSection
                        tenantId={editor.entityId}
                        savedSwatches={editor.draft.savedSwatches || []}
                        onPreviewProductChange={({ path }) => {
                            navigatePreviewTo(path);
                        }}
                        onPreviewPricingStructureChange={setProductPricingPreview}
                        persistedPricingStructure={persistedProductPricing}
                        focusedProductId={focusedProductOption?.productId || null}
                        focusedSectionId={focusedProductOption?.sectionId || null}
                        focusedValueId={focusedProductOption?.valueId || null}
                        onSaveSwatch={(color) => {
                            const swatches = editor.draft.savedSwatches || [];
                            if (!swatches.includes(color) && swatches.length < 20) {
                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                            }
                        }}
                        onRemoveSwatch={(color) => {
                            editor.updateDraft({
                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                            });
                        }}
                    />
                );
            case 'product-description':
                return (
                    <ProductDescriptionSection
                        infoSection={editor.draft.productPage?.infoSection}
                        updateInfoSection={(updates) => {
                            const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                            editor.updateDraft({
                                productPage: {
                                    ...currentProductPage,
                                    infoSection: {
                                        ...currentProductPage.infoSection,
                                        ...updates,
                                    },
                                },
                            });
                        }}
                        savedSwatches={editor.draft.savedSwatches || []}
                        onSaveSwatch={(color) => {
                            const swatches = editor.draft.savedSwatches || [];
                            if (!swatches.includes(color) && swatches.length < 20) {
                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                            }
                        }}
                        onRemoveSwatch={(color) => {
                            editor.updateDraft({
                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                            });
                        }}
                    />
                );
            case 'icons':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Produktbilleder</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                        </div>
                        <ProductAssetsSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            onAddPaidItem={editor.mode === 'tenant' ? paidItems.addPendingItem : undefined}
                            isItemPurchased={editor.mode === 'tenant' ? paidItems.isItemPurchased : undefined}
                            isItemPending={editor.mode === 'tenant' ? paidItems.isItemPending : undefined}
                        />
                    </div>
                );
            default:
                return <div>Ukendt sektion: {activeSection}</div>;
        }
    };

    const renderContextualEditor = () => {
        if (!contextualEditor) return null;

        if (contextualEditor.kind === "usp-icon") {
            const uspStrip = editor.draft.uspStrip;
            const uspItems = uspStrip?.items || [];
            const itemIndex = uspItems.findIndex((item: any) => item.id === contextualEditor.itemId);
            const item = itemIndex >= 0 ? uspItems[itemIndex] : null;

            if (!uspStrip || !item) return null;

            const selectedUSPOption = USP_ICON_OPTIONS.find((option) => option.value === item.icon) || null;
            const SelectedIcon = selectedUSPOption?.icon || Truck;
            const saveUSPContextSwatch = (color: string) => {
                const swatches = editor.draft.savedSwatches || [];
                if (!swatches.includes(color) && swatches.length < 20) {
                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                }
            };
            const removeUSPContextSwatch = (color: string) => {
                editor.updateDraft({
                    savedSwatches: (editor.draft.savedSwatches || []).filter((entry) => entry !== color),
                });
            };

            return (
                <Card className="absolute right-6 top-6 z-30 w-[320px] border-border/70 bg-background/95 shadow-2xl backdrop-blur animate-in fade-in-0 zoom-in-95 slide-in-from-right-4 duration-200">
                    <CardHeader className="space-y-1 pb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-base">{contextualEditor.label}</CardTitle>
                                <CardDescription className="text-xs">
                                    {item.title || `USP punkt ${itemIndex + 1}`}
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                    setContextualEditor(null);
                                    setClearSelectionSignal((prev) => prev + 1);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Ikon</Label>
                            <Select
                                value={item.icon || "truck"}
                                onValueChange={(value) => {
                                    const nextItems = [...uspItems];
                                    nextItems[itemIndex] = { ...item, icon: value };
                                    editor.updateDraft({
                                        uspStrip: {
                                            ...uspStrip,
                                            items: nextItems,
                                        },
                                    });
                                }}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <div className="flex items-center gap-2 text-left">
                                        {item.icon === "custom" ? (
                                            item.customIconUrl ? (
                                                <img
                                                    src={item.customIconUrl}
                                                    alt="Valgt ikon"
                                                    className="h-4 w-4 shrink-0 object-contain"
                                                />
                                            ) : (
                                                <ImageIcon className="h-4 w-4 shrink-0 text-foreground" />
                                            )
                                        ) : (
                                            <SelectedIcon className="h-4 w-4 shrink-0 text-foreground" />
                                        )}
                                        <span className="truncate">
                                            {item.icon === "custom" ? "Uploadet ikon" : selectedUSPOption?.label || "Vælg ikon"}
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {USP_ICON_OPTIONS.map((option) => {
                                        const OptionIcon = option.icon;
                                        return (
                                            <SelectItem key={option.value} value={option.value}>
                                                <div className="flex items-center gap-2">
                                                    <OptionIcon className="h-4 w-4 text-foreground" />
                                                    <span>{option.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                    {item.icon === "custom" && (
                                        <SelectItem value="custom">
                                            <div className="flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4 text-foreground" />
                                                <span>Uploadet ikon</span>
                                            </div>
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {item.icon === "custom" && (
                                <p className="text-[11px] text-muted-foreground">
                                    Upload af eget ikon styres stadig i sidepanelet.
                                </p>
                            )}
                        </div>

                        <ColorPickerWithSwatches
                            label="Ikonfarve"
                            value={uspStrip.iconColor || uspStrip.textColor || "#FFFFFF"}
                            onChange={(color) => editor.updateDraft({
                                uspStrip: {
                                    ...uspStrip,
                                    iconColor: color,
                                },
                            })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={saveUSPContextSwatch}
                            onRemoveSwatch={removeUSPContextSwatch}
                        />

                        <div className="flex items-center justify-between gap-2 pt-1">
                            <p className="text-[11px] text-muted-foreground">
                                Kladde opdateres med det samme.
                            </p>
                            <Button
                                size="sm"
                                className="h-8"
                                disabled={editor.isSaving}
                                onClick={() => void saveDraftWithProductSettings()}
                            >
                                {editor.isSaving ? "Gemmer..." : "Gem kladde"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        if (contextualEditor.kind === "product-option-button") {
            return (
                <Card className="absolute right-6 top-6 z-30 w-[360px] border-border/70 bg-background/95 shadow-2xl backdrop-blur animate-in fade-in-0 zoom-in-95 slide-in-from-right-4 duration-200 max-h-[80vh] overflow-y-auto">
                    <ProductOptionButtonEditor
                        productId={contextualEditor.productId}
                        sectionId={contextualEditor.sectionId}
                        valueId={contextualEditor.valueId}
                        valueName={contextualEditor.valueName}
                        savedSwatches={editor.draft.savedSwatches || []}
                        onSaveSwatch={(color) => {
                            const swatches = editor.draft.savedSwatches || [];
                            if (!swatches.includes(color) && swatches.length < 20) {
                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                            }
                        }}
                        onRemoveSwatch={(color) => {
                            editor.updateDraft({
                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                            });
                        }}
                        onBack={() => {
                            setContextualEditor(null);
                            setClearSelectionSignal((prev) => prev + 1);
                        }}
                    />
                </Card>
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative min-h-0">
                {/* Left Sidebar - Collapsible */}
                <div
                    className={`
                        absolute inset-y-0 left-0 z-10 w-96 flex-shrink-0 bg-background border-r transform transition-transform duration-300 ease-in-out
                        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                        lg:relative lg:translate-x-0
                        overflow-hidden
                        branding-sidebar
                    `}
                >
                    <div className="h-full flex flex-col">
                        <div className="px-3 py-2.5 border-b flex items-center justify-between bg-muted/20">
                            <h2 className="font-extrabold text-2xl text-foreground px-1">
                                {activeSection ? 'Redigerer' : 'Værktøjer'}
                            </h2>
                            <Button variant="ghost" size="icon" className="h-6 w-6 lg:hidden" onClick={() => setSidebarOpen(false)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="border-b bg-white/90 px-2.5 py-2 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Preview side
                                    </div>
                                    <div className="text-xs font-semibold text-foreground truncate">
                                        {currentPreviewPageLabel}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">
                                        {currentPreviewPageTypeLabel}
                                    </Badge>
                                    {activeSection && (
                                        <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-[10px] max-w-[160px] truncate">
                                            {SECTION_LABELS[activeSection] || activeSection}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {PREVIEW_PAGE_LINKS.map((page) => {
                                    const isActive = page.action === "first-product"
                                        ? isProductPreviewPage
                                        : page.path === currentPreviewPage
                                            || (page.path === "/produkter" && currentPreviewPage === "/shop");
                                    return (
                                        <Button
                                            key={`${page.label}-${page.path}-${page.action || "path"}`}
                                            variant="outline"
                                            size="sm"
                                            className={
                                                isActive
                                                    ? "h-6 px-2 text-[11px] rounded-sm border-slate-300 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                                                    : "h-6 px-2 text-[11px] rounded-sm border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                            }
                                            onClick={() => {
                                                if (page.action === "first-product") {
                                                    navigatePreviewToFirstProduct();
                                                } else {
                                                    navigatePreviewTo(page.path);
                                                }
                                            }}
                                        >
                                            {page.label}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground">
                                    Værktøjer på denne side
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {allowedSectionLabels.map((label) => (
                                        <Badge key={label} variant="outline" className="rounded-sm px-1.5 py-0 text-[10px] font-normal">
                                            {label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="py-2">
                                {renderSidebarContent()}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Main Preview Area */}
                <div className="flex-1 bg-muted/10 relative flex flex-col">
                    {/* Toggle Sidebar Button (visible when closed on mobile) */}
                    {!sidebarOpen && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-4 left-4 z-20 lg:hidden shadow-md"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}

                    <div className="flex-1 p-8 overflow-hidden flex flex-col">
                        {/* ACTION BAR - aligned with preview frame */}
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-card border rounded-t-lg mb-0">
                            {/* 1. Gem design */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    editor.loadSavedDesigns();
                                    setSaveDesignName("");
                                    setOverwriteDesignId("none");
                                    setShowSaveDesignDialog(true);
                                }}
                                disabled={editor.isSaving}
                                className="gap-2"
                            >
                                <Save className="h-4 w-4" />
                                Gem design
                            </Button>

                            {/* 2. Gemte designs */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.loadSavedDesigns();
                                    setShowSavedDesignsDialog(true);
                                }}
                                disabled={editor.isSaving}
                                className="gap-2"
                            >
                                <List className="h-4 w-4" />
                                Gemte designs
                            </Button>

                            {/* 3. Premade Designs - Master: Save to resources + View saved, Tenant: Browse designs */}
                            {editor.mode === 'master' ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowSaveToResourcesDialog(true)}
                                        disabled={editor.isSaving}
                                        className="gap-2"
                                    >
                                        <FolderUp className="h-4 w-4" />
                                        Gem som skabelon
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowSavedPremadeDesignsDialog(true);
                                            setLoadingSavedDesigns(true);
                                            // Fetch saved designs and tenants
                                            Promise.all([
                                                supabase.from('premade_designs' as any).select('*').order('created_at', { ascending: false }),
                                                supabase.from('tenants' as any).select('id, name').neq('id', '00000000-0000-0000-0000-000000000000')
                                            ]).then(([designsRes, tenantsRes]) => {
                                                if (!designsRes.error) setSavedPremadeDesigns(designsRes.data || []);
                                                if (!tenantsRes.error) setTenantList(tenantsRes.data || []);
                                                setLoadingSavedDesigns(false);
                                            });
                                        }}
                                        className="gap-2"
                                    >
                                        <LayoutTemplate className="h-4 w-4" />
                                        Mine skabeloner
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowPremadeDesignsDialog(true);
                                        // Fetch designs when button is clicked
                                        setLoadingPremadeDesigns(true);
                                        supabase
                                            .from('premade_designs' as any)
                                            .select('*')
                                            .eq('is_visible', true)
                                            .order('created_at', { ascending: false })
                                            .then(({ data, error }) => {
                                                console.log('Premade designs fetch result:', { data, error });
                                                if (error) {
                                                    console.error('Error fetching premade designs:', error);
                                                    toast.error('Kunne ikke hente designs');
                                                }
                                                if (data) {
                                                    setAvailablePremadeDesigns(data);
                                                }
                                                setLoadingPremadeDesigns(false);
                                            });
                                    }}
                                    disabled={editor.isSaving}
                                    className="gap-2"
                                >
                                    <LayoutTemplate className="h-4 w-4" />
                                    Premade Designs
                                </Button>
                            )}

                            {/* Pending Purchases Badge (Tenant only) */}
                            {editor.mode === 'tenant' && paidItems.hasPendingItems && (
                                <PendingPurchasesBadge
                                    count={paidItems.pendingItems.length}
                                    totalCost={paidItems.totalPendingCost}
                                    onClick={() => setShowPendingPurchasesDialog(true)}
                                />
                            )}

                            <div className="hidden lg:flex items-center rounded-md border bg-muted/40 px-2.5 py-1">
                                <span className="text-xs text-muted-foreground">
                                    {isDraftLive
                                        ? 'Live version er opdateret'
                                        : 'Du redigerer kladde (ikke live endnu)'}
                                </span>
                            </div>

                            <div className="flex-1" />

                            {/* 3. Fortryd */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.discardDraft()}
                                disabled={!editor.hasUnsavedChanges || editor.isSaving}
                                className="gap-2 text-muted-foreground hover:text-foreground"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Fortryd
                            </Button>

                            {/* 4. Publicér */}
                            <Button
                                size="sm"
                                onClick={() => setShowPublishDialog(true)}
                                disabled={editor.isSaving}
                                className="gap-2"
                            >
                                <Send className="h-4 w-4" />
                                Publicér
                            </Button>
                        </div>

                        {/* Preview Frame */}
                        <div className="relative flex-1 w-full">
                            {renderContextualEditor()}
                            <div className="h-full w-full bg-white rounded-b-lg border border-t-0 overflow-hidden">
                                <SiteDesignPreviewFrame
                                    branding={editor.draft}
                                    previewUrl={`/preview-shop?draft=1&preview_mode=1&tenantId=${editor.entityId}&editor=site-design-v2`}
                                    tenantName={editor.entityName}
                                    onSaveDraft={saveDraftWithProductSettings}
                                    onResetDesign={() => setShowResetDialog(true)}
                                    navigationRequest={previewNavigationRequest}
                                    productPricingPreview={productPricingPreview}
                                    onPreviewPathChange={setCurrentPreviewPage}
                                    editMode={previewEditMode}
                                    onEditModeChange={setPreviewEditMode}
                                    clearSelectionSignal={clearSelectionSignal}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- DIALOGS (Copied from V1) --- */}
            {/* 1. Save Design Modal */}
            <Dialog open={showSaveDesignDialog} onOpenChange={setShowSaveDesignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gem design</DialogTitle>
                        <DialogDescription>
                            Du kan enten gemme som nyt design eller overskrive et eksisterende.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Navn på design <span className="text-destructive">*</span></Label>
                            <Input
                                id="name"
                                value={saveDesignName}
                                onChange={(e) => setSaveDesignName(e.target.value)}
                                placeholder="F.eks. Sommer Kampagne"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="overwrite-design">Overskriv eksisterende design</Label>
                            <Select value={overwriteDesignId} onValueChange={setOverwriteDesignId}>
                                <SelectTrigger id="overwrite-design">
                                    <SelectValue placeholder="Vælg design" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Vælg design</SelectItem>
                                    {editor.savedDesigns.map((design) => (
                                        <SelectItem key={design.id} value={design.id}>
                                            {design.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Overskriv bruger det valgte designnavn og erstatter indholdet med din nuværende kladde.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDesignDialog(false)}>Annuller</Button>
                        <Button onClick={handleSaveDesign} disabled={!saveDesignName.trim() || editor.isSaving}>
                            Gem som ny
                        </Button>
                        <Button onClick={handleOverwriteDesign} disabled={overwriteDesignId === "none" || editor.isSaving}>
                            Overskriv
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. Saved Designs List Modal */}
            <Dialog open={showSavedDesignsDialog} onOpenChange={setShowSavedDesignsDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Gemte designs</DialogTitle>
                        <DialogDescription>
                            Klik 'Indlæs' for at anvende et design. Dette vil overskrive din nuværende kladde.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4 minimal-scrollbar">
                        {editor.savedDesigns.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Ingen gemte designs fundet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {editor.savedDesigns.map((design) => (
                                    <div
                                        key={design.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Palette className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">{design.name}</h4>
                                                <p className="text-xs text-muted-foreground">{formatDate(design.createdAt)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={async () => {
                                                    await editor.loadDesign(design.id);
                                                    setShowSavedDesignsDialog(false);
                                                }}
                                            >
                                                Indlæs
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => {
                                                    if (confirm('Er du sikker på at du vil slette dette design?')) {
                                                        editor.deleteSavedDesign(design.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* 3. Reset Dialog */}
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Nulstil til standard?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dette vil fjerne alle dine branding-tilpasninger og gendanne standardindstillingerne.
                            <br /><br />
                            Vi gemmer en automatisk sikkerhedskopi før vi nulstiller.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                await editor.resetToDefault();
                                // Also clear any pending paid items since we're resetting to default
                                if (editor.mode === 'tenant' && paidItems.hasPendingItems) {
                                    await paidItems.clearPendingItems();
                                    toast.success('Design nulstillet og indkøbskurv ryddet');
                                }
                                setShowResetDialog(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Nulstil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Publish Dialog */}
            <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-primary" />
                            Publicér branding?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                                <strong>Bemærk:</strong> Publicering vil ændre din live hjemmeside øjeblikkeligt.
                            </div>

                            {/* Recent Publishes Section */}
                            {editor.history.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seneste udgivelser</Label>
                                    <div className="space-y-1 max-h-[120px] overflow-y-auto minimal-scrollbar px-1">
                                        {editor.history.slice(0, 3).map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => setPublishLabel(v.label)}
                                                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent border border-transparent hover:border-accent transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <History className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                                                    <span className="text-sm font-medium truncate">{v.label}</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                                    {format(new Date(v.timestamp), 'd. MMM HH:mm', { locale: da })}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <Separator className="my-2" />
                                </div>
                            )}

                            <div className="space-y-2 pt-1">
                                <Label htmlFor="publish-label">Navngiv denne version (valgfrit)</Label>
                                <div className="relative">
                                    <Input
                                        id="publish-label"
                                        placeholder="F.eks. 'Nyt logo design'"
                                        value={publishLabel}
                                        onChange={(e) => setPublishLabel(e.target.value)}
                                        className="pr-10"
                                    />
                                    {publishLabel && (
                                        <button
                                            onClick={() => setPublishLabel("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Tip: Klik på en seneste udgave ovenfor for at genbruge navnet.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePublish} disabled={editor.isSaving}>
                            Publicér nu
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 4. Save to Resources Dialog (Master Only) */}
            <Dialog open={showSaveToResourcesDialog} onOpenChange={setShowSaveToResourcesDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderUp className="h-5 w-5 text-primary" />
                            Gem til ressourcer
                        </DialogTitle>
                        <DialogDescription>
                            Gem dette design som en premade design skabelon, der kan tildeles til lejere.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="resource-design-name">Navn *</Label>
                            <Input
                                id="resource-design-name"
                                placeholder="F.eks. 'Moderne Trykkeri Design'"
                                value={resourceDesignName}
                                onChange={(e) => setResourceDesignName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="resource-design-desc">Beskrivelse</Label>
                            <Input
                                id="resource-design-desc"
                                placeholder="Kort beskrivelse af designet..."
                                value={resourceDesignDescription}
                                onChange={(e) => setResourceDesignDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="resource-design-price">Pris (kr)</Label>
                                <Input
                                    id="resource-design-price"
                                    type="number"
                                    min="0"
                                    placeholder="0 = Gratis"
                                    value={resourceDesignPrice}
                                    onChange={(e) => setResourceDesignPrice(Number(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Synlighed</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        checked={resourceDesignVisible}
                                        onChange={(e) => setResourceDesignVisible(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <span className="text-sm">{resourceDesignVisible ? 'Synlig for alle lejere' : 'Skjult'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowSaveToResourcesDialog(false)}>
                            Annuller
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!resourceDesignName.trim()) {
                                    toast.error("Indtast et navn for designet");
                                    return;
                                }
                                try {
                                    // Capture thumbnail from preview
                                    toast.loading('Opretter thumbnail fra preview...', { id: 'save-design' });
                                    const thumbnailUrl = await capturePreviewThumbnail();

                                    const { data: { user } } = await supabase.auth.getUser();

                                    toast.loading('Gemmer design...', { id: 'save-design' });
                                    const { error } = await supabase
                                        .from('premade_designs' as any)
                                        .insert({
                                            name: resourceDesignName.trim(),
                                            description: resourceDesignDescription.trim() || null,
                                            thumbnail_url: thumbnailUrl,
                                            branding_data: editor.draft,
                                            is_visible: resourceDesignVisible,
                                            price: resourceDesignPrice,
                                            created_by: user?.id,
                                        });

                                    if (error) throw error;

                                    toast.success(`Design "${resourceDesignName}" gemt til ressourcer! ${resourceDesignVisible ? 'Synlig for lejere.' : 'Skjult indtil publiceret.'}`, { id: 'save-design' });
                                    setResourceDesignName("");
                                    setResourceDesignDescription("");
                                    setResourceDesignPrice(0);
                                    setResourceDesignVisible(true);
                                    setShowSaveToResourcesDialog(false);
                                } catch (error: any) {
                                    console.error('Error saving premade design:', error);
                                    toast.error(error.message || 'Kunne ikke gemme design', { id: 'save-design' });
                                }
                            }}
                            disabled={!resourceDesignName.trim() || capturingThumbnail}
                        >
                            {capturingThumbnail ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <FolderUp className="h-4 w-4 mr-2" />
                            )}
                            {capturingThumbnail ? 'Opretter thumbnail...' : 'Gem design'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 5. Premade Designs Browser Dialog (Tenant Only) */}
            <Dialog
                open={showPremadeDesignsDialog}
                onOpenChange={(open) => {
                    setShowPremadeDesignsDialog(open);
                    if (open) {
                        // Fetch designs when dialog opens
                        setLoadingPremadeDesigns(true);
                        supabase
                            .from('premade_designs' as any)
                            .select('*')
                            .eq('is_visible', true)
                            .order('created_at', { ascending: false })
                            .then(({ data, error }) => {
                                console.log('Premade designs fetch result:', { data, error });
                                if (error) {
                                    console.error('Error fetching premade designs:', error);
                                    toast.error('Kunne ikke hente designs');
                                }
                                if (data) {
                                    setAvailablePremadeDesigns(data);
                                }
                                setLoadingPremadeDesigns(false);
                            });
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="h-5 w-5 text-primary" />
                            Premade Designs
                        </DialogTitle>
                        <DialogDescription>
                            Vælg et forudlavet design at anvende på din hjemmeside. Dit nuværende design erstattes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {loadingPremadeDesigns ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : availablePremadeDesigns.length === 0 ? (
                            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                                <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Ingen premade designs tilgængelige</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {availablePremadeDesigns.map((design) => (
                                    <Card key={design.id} className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group">
                                        <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
                                            {design.thumbnail_url ? (
                                                <img src={design.thumbnail_url} alt={design.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <LayoutTemplate className="w-16 h-16 text-primary/30" />
                                            )}
                                            {design.price > 0 && (
                                                <Badge className="absolute top-2 right-2">{design.price} kr</Badge>
                                            )}
                                            {design.price === 0 && (
                                                <Badge variant="secondary" className="absolute top-2 right-2">Gratis</Badge>
                                            )}
                                        </div>
                                        <CardContent className="p-4">
                                            <h4 className="font-semibold mb-1">{design.name}</h4>
                                            {design.description && (
                                                <p className="text-sm text-muted-foreground mb-3">{design.description}</p>
                                            )}
                                            <Button
                                                className="w-full"
                                                onClick={async () => {
                                                    if (design.branding_data) {
                                                        // Apply the design to current draft
                                                        editor.updateDraft(design.branding_data);

                                                        // If design has a price, add to pending purchases
                                                        if (design.price > 0 && !paidItems.isItemPurchased('premade_design', design.id)) {
                                                            await paidItems.addPendingItem({
                                                                type: 'premade_design',
                                                                itemId: design.id,
                                                                name: design.name,
                                                                price: design.price,
                                                                thumbnailUrl: design.thumbnail_url,
                                                            });
                                                            toast.success(
                                                                `Design "${design.name}" anvendt! Husk: ${design.price} kr skal betales ved publicering.`,
                                                                { duration: 5000 }
                                                            );
                                                        } else if (paidItems.isItemPurchased('premade_design', design.id)) {
                                                            toast.success(`Design "${design.name}" anvendt! (Allerede købt)`);
                                                        } else {
                                                            toast.success(`Design "${design.name}" anvendt!`);
                                                        }

                                                        setShowPremadeDesignsDialog(false);
                                                    } else {
                                                        toast.error('Design data ikke tilgængelig');
                                                    }
                                                }}
                                            >
                                                {design.price > 0 && !paidItems.isItemPurchased('premade_design', design.id) ? (
                                                    <>Anvend design ({design.price} kr)</>
                                                ) : paidItems.isItemPurchased('premade_design', design.id) ? (
                                                    <>Anvend design ✓</>
                                                ) : (
                                                    <>Anvend design</>
                                                )}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowPremadeDesignsDialog(false)}>
                            Luk
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 6. Saved Premade Designs Management Dialog (Master Only) */}
            <Dialog
                open={showSavedPremadeDesignsDialog}
                onOpenChange={(open) => {
                    setShowSavedPremadeDesignsDialog(open);
                    if (open) {
                        setLoadingSavedDesigns(true);
                        supabase
                            .from('premade_designs' as any)
                            .select('*')
                            .order('created_at', { ascending: false })
                            .then(({ data, error }) => {
                                if (data) setSavedPremadeDesigns(data);
                                if (error) console.error('Error fetching master premade designs:', error);
                                setLoadingSavedDesigns(false);
                            });
                    }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="h-5 w-5 text-primary" />
                            Mine Gemte Skabeloner
                        </DialogTitle>
                        <DialogDescription>
                            Administrer dine gemte premade designs. Rediger, slet, eller tildel til lejere.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {loadingSavedDesigns ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : savedPremadeDesigns.length === 0 ? (
                            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                                <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Ingen gemte skabeloner endnu</p>
                                <p className="text-xs mt-1">Brug "Gem som skabelon" for at gemme dit nuværende design</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {savedPremadeDesigns.map((design) => (
                                    <Card key={design.id} className="overflow-hidden">
                                        {/* View Mode */}
                                        {editingDesign?.id !== design.id ? (
                                            <div className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-28 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {design.thumbnail_url ? (
                                                            <img src={design.thumbnail_url} alt={design.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <LayoutTemplate className="w-10 h-10 text-primary/30" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h4 className="font-semibold text-lg">{design.name}</h4>
                                                                {design.description && (
                                                                    <p className="text-sm text-muted-foreground mt-1">{design.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 ml-4">
                                                                <Badge variant={design.is_visible ? "default" : "secondary"}>
                                                                    {design.is_visible ? (
                                                                        <><Eye className="w-3 h-3 mr-1" /> Synlig</>
                                                                    ) : (
                                                                        <><EyeOff className="w-3 h-3 mr-1" /> Skjult</>
                                                                    )}
                                                                </Badge>
                                                                <Badge variant="outline" className="font-mono">
                                                                    {design.price > 0 ? `${design.price} kr` : 'Gratis'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-3">
                                                            {/* Edit button */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setEditingDesign({
                                                                    id: design.id,
                                                                    name: design.name,
                                                                    description: design.description || '',
                                                                    price: design.price || 0,
                                                                    is_visible: design.is_visible ?? true,
                                                                    thumbnail_url: design.thumbnail_url,
                                                                })}
                                                                className="gap-1"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                                Rediger
                                                            </Button>
                                                            {/* Load into editor */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (design.branding_data) {
                                                                        editor.updateDraft(design.branding_data);
                                                                        toast.success(`Design "${design.name}" indlæst i editor`);
                                                                        setShowSavedPremadeDesignsDialog(false);
                                                                    }
                                                                }}
                                                            >
                                                                Indlæs i editor
                                                            </Button>
                                                            {/* Assign to specific tenant */}
                                                            {tenantList.length > 0 && (
                                                                <select
                                                                    className="h-8 px-2 text-sm border rounded-md bg-background"
                                                                    defaultValue=""
                                                                    onChange={async (e) => {
                                                                        const tenantId = e.target.value;
                                                                        if (tenantId) {
                                                                            const { data: { user } } = await supabase.auth.getUser();
                                                                            await supabase
                                                                                .from('tenant_premade_designs' as any)
                                                                                .upsert({
                                                                                    tenant_id: tenantId,
                                                                                    design_id: design.id,
                                                                                    granted_by: user?.id
                                                                                });
                                                                            const tenant = tenantList.find(t => t.id === tenantId);
                                                                            toast.success(`Tildelt til ${tenant?.name || 'lejer'}`);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Tildel til...</option>
                                                                    {tenantList.map((tenant) => (
                                                                        <option key={tenant.id} value={tenant.id}>
                                                                            {tenant.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                            {/* Delete */}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive ml-auto"
                                                                onClick={() => setShowDeleteConfirm(design.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Edit Mode */
                                            <div className="p-4 bg-muted/30 border-l-4 border-primary">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-28 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {editingDesign.thumbnail_url ? (
                                                            <img src={editingDesign.thumbnail_url} alt={editingDesign.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <LayoutTemplate className="w-10 h-10 text-primary/30" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <Label htmlFor="edit-name" className="text-xs">Navn</Label>
                                                                <Input
                                                                    id="edit-name"
                                                                    value={editingDesign.name}
                                                                    onChange={(e) => setEditingDesign(prev => prev ? { ...prev, name: e.target.value } : null)}
                                                                    className="h-9"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label htmlFor="edit-price" className="text-xs">Pris (kr)</Label>
                                                                <Input
                                                                    id="edit-price"
                                                                    type="number"
                                                                    min="0"
                                                                    value={editingDesign.price}
                                                                    onChange={(e) => setEditingDesign(prev => prev ? { ...prev, price: Number(e.target.value) || 0 } : null)}
                                                                    className="h-9"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="edit-desc" className="text-xs">Beskrivelse</Label>
                                                            <Input
                                                                id="edit-desc"
                                                                value={editingDesign.description}
                                                                onChange={(e) => setEditingDesign(prev => prev ? { ...prev, description: e.target.value } : null)}
                                                                placeholder="Kort beskrivelse af dette design..."
                                                                className="h-9"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editingDesign.is_visible}
                                                                    onChange={(e) => setEditingDesign(prev => prev ? { ...prev, is_visible: e.target.checked } : null)}
                                                                    className="h-4 w-4 rounded"
                                                                />
                                                                <span className="text-sm">
                                                                    {editingDesign.is_visible ? (
                                                                        <span className="text-green-600 flex items-center gap-1">
                                                                            <Eye className="w-4 h-4" /> Synlig for alle lejere
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground flex items-center gap-1">
                                                                            <EyeOff className="w-4 h-4" /> Skjult for lejere
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditingDesign(null)}
                                                                    disabled={savingDesignEdit}
                                                                >
                                                                    Annuller
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        if (!editingDesign.name.trim()) {
                                                                            toast.error('Navn er påkrævet');
                                                                            return;
                                                                        }
                                                                        setSavingDesignEdit(true);
                                                                        try {
                                                                            const { error } = await supabase
                                                                                .from('premade_designs' as any)
                                                                                .update({
                                                                                    name: editingDesign.name.trim(),
                                                                                    description: editingDesign.description.trim() || null,
                                                                                    price: editingDesign.price,
                                                                                    is_visible: editingDesign.is_visible,
                                                                                })
                                                                                .eq('id', editingDesign.id);

                                                                            if (error) throw error;

                                                                            // Update local state
                                                                            setSavedPremadeDesigns(prev =>
                                                                                prev.map(d => d.id === editingDesign.id ? {
                                                                                    ...d,
                                                                                    name: editingDesign.name.trim(),
                                                                                    description: editingDesign.description.trim() || null,
                                                                                    price: editingDesign.price,
                                                                                    is_visible: editingDesign.is_visible,
                                                                                } : d)
                                                                            );
                                                                            toast.success('Skabelon opdateret');
                                                                            setEditingDesign(null);
                                                                        } catch (error: any) {
                                                                            console.error('Error updating design:', error);
                                                                            toast.error(error.message || 'Kunne ikke opdatere');
                                                                        } finally {
                                                                            setSavingDesignEdit(false);
                                                                        }
                                                                    }}
                                                                    disabled={savingDesignEdit || !editingDesign.name.trim()}
                                                                    className="gap-1"
                                                                >
                                                                    {savingDesignEdit ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Check className="h-4 w-4" />
                                                                    )}
                                                                    Gem ændringer
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            setShowSavedPremadeDesignsDialog(false);
                            setEditingDesign(null);
                        }}>
                            Luk
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Slet skabelon?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Er du sikker på at du vil slette denne skabelon? Denne handling kan ikke fortrydes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                                if (!showDeleteConfirm) return;
                                try {
                                    await supabase
                                        .from('premade_designs' as any)
                                        .delete()
                                        .eq('id', showDeleteConfirm);
                                    setSavedPremadeDesigns(prev => prev.filter(d => d.id !== showDeleteConfirm));
                                    toast.success('Skabelon slettet');
                                } catch (error) {
                                    toast.error('Kunne ikke slette skabelon');
                                }
                                setShowDeleteConfirm(null);
                            }}
                        >
                            Slet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 7. Pending Purchases Dialog (Tenant Only) */}
            {editor.mode === 'tenant' && (
                <PendingPurchasesDialog
                    open={showPendingPurchasesDialog}
                    onOpenChange={setShowPendingPurchasesDialog}
                    pendingItems={paidItems.pendingItems}
                    totalCost={paidItems.totalPendingCost}
                    onRemoveItem={paidItems.removePendingItem}
                    onConfirmPurchase={paidItems.processPurchase}
                    onPublish={handlePublishAfterPayment}
                    isPublishing={editor.isSaving}
                />
            )}
        </div>
    );
}
