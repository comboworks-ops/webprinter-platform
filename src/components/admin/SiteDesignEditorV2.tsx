import { IconPackProvider } from "@/components/icons/IconFamily";
import { applySiteColor, buildSiteColorPatch } from '@/lib/branding/siteColors';
import { SiteColorResetControls } from './SiteColorResetControls';
import { SharedButtonLocalControls } from './SharedButtonsControls';
import { FeaturedProductInspector } from './FeaturedProductInspector';
import { FIRST_FEATURED_SLIDE, getFeaturedSlides } from '@/lib/branding/featuredProductPresentation';
import type { USPIconType, BrandingData } from "@/hooks/useBrandingDraft";
import { requestPreviewScreenshot } from '@/lib/preview/previewScreenshot';
import { assignDesignToShop, loadShopDesignLibrary } from '@/lib/branding/premadeDesignLibrary';
import { HeroQuickControls, HeaderQuickControls, MainButtonsControls } from './SiteDesignQuickControls';
import { standardSiteDesign, applyMainButtonSettings } from '@/lib/branding/siteDesignControls';
import { ProductPresentationPicker } from "@/components/admin/ProductPresentationPicker";
import { applyProductPresentation, PRODUCT_PRESENTATIONS, resolveProductPresentation } from "@/lib/branding/productPresentations";
import { resolveDropdownPreset } from "@/lib/branding/dropdownPresets";
import { menuColorsChanged } from "@/lib/branding/headerMenuSettings";

import { OrderFlowDesignInspector } from "@/components/admin/OrderFlowDesignInspector";
import { SiteDesignWorkspace, SiteDesignNavigation } from "@/components/admin/SiteDesignWorkspace";
import { applyOrderFlowDesign, ORDER_FLOW_DESIGNS, resolveOrderFlowDesign, type OrderFlowPage } from "@/lib/branding/orderFlowDesigns";
import { getOrderFlowPreviewPage, getOrderFlowPreviewPath } from "@/lib/preview/orderFlowPreview";
import { getSiteDesignPreviewPathname } from "@/lib/preview/siteDesignPreviewNavigation";
import { PrintDesignPicker } from "@/components/admin/PrintDesignPicker";
import { applyPrintDesignPreset, getPrintDesignPreset, selectPrintDesignPreset } from "@/lib/branding/printDesignPresets";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Loader2, Save, RotateCcw, Undo2, Redo2, Send, Trash2, List,
    X, Layout, Type, Palette, Sparkles, Image as ImageIcon,
    ExternalLink, Monitor, Smartphone, Tablet, FolderUp, LayoutTemplate, ShoppingCart,
    Pencil, Eye, EyeOff, Check, History, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Award, Plus, Truck, Phone, Shield, Clock, Star, Heart, MousePointer2, FileText,
    Store, PackagePlus, CheckCircle2, Layers3, Globe, type LucideIcon
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { LowerInfoSection } from "@/components/admin/LowerInfoSection";
import { PageBackgroundControls } from "@/components/admin/PageBackgroundControls";
import { PendingPurchasesDialog, PendingPurchasesBadge } from "@/components/admin/PendingPurchasesDialog";
import { ThemeSelector } from "@/components/admin/ThemeSelector";
import { ShopTemplatePicker } from "@/components/admin/ShopTemplatePicker";
import { ProduktvalgknapperSection } from "@/components/admin/ProduktvalgknapperSection";
import { ProductOptionButtonEditor } from "@/components/admin/ProductOptionButtonEditor";
import { ProductOptionSectionBoxEditor } from "@/components/admin/ProductOptionSectionBoxEditor";
import { mergeProductStylingChange, persistProductStylingPatches, type ProductStylingChange, type ProductStylingPreview } from "@/lib/preview/productStylingSave";
import { ProductDescriptionSection } from "@/components/admin/ProductDescriptionSection";
import { supabase } from "@/integrations/supabase/client";
import { usePaidItems } from "@/hooks/usePaidItems";
import { SITE_PACKAGES, type SitePackage } from "@/lib/sites/sitePackages";
import {
    installSitePackageTemplates,
    type SiteInstallSummary,
} from "@/lib/sites/installSitePackage";
import { buildPreviewShopUrl } from "@/lib/preview/previewSession";
import {
    readProductSiteIds,
    removeProductSiteAssignment,
    writeProductSiteIds,
} from "@/lib/sites/productSiteFrontends";
import {
    PRODUCT_DESIGNER_MODE_OPTIONS,
    PRODUCT_PRICING_MODEL_OPTIONS,
    getProductDesignerModeLabel,
    getProductPricingModelLabel,
    readProductSiteModes,
    resolveProductSiteModes,
    writeProductSiteModes,
    type ProductDesignerMode,
    type ProductPricingModel,
    type ProductSiteModes,
} from "@/lib/sites/productSiteModes";
import {
    resolveStorefrontLayout,
    type ShopTemplateDefinition,
} from "@/lib/storefront/shopTemplates";

import {
    DEFAULT_BRANDING,
    type BrandingStorageAdapter,
    type BrandingCapabilities,
    brandingEquals,
    useBrandingEditor,
} from "@/lib/branding";
import { isSiteDesignSelectionMessage, resolveSiteDesignTarget } from "@/lib/siteDesignTargets";

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

interface SiteMappingProduct {
    id: string;
    name: string;
    slug: string;
    category?: string | null;
    pricing_type?: string | null;
    is_published?: boolean | null;
    technical_specs?: unknown;
    priceReady: boolean;
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
    themeId: string;
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

type VisualThemePresetConfig = Pick<VisualThemePreset, "id" | "name" | "description" | "tags" | "colors"> &
    Partial<Omit<VisualThemePreset, "id" | "name" | "description" | "tags" | "colors">>;

const createVisualThemePreset = (config: VisualThemePresetConfig): VisualThemePreset => {
    const primary = config.colors.primary;
    const hover = config.colors.hover;
    return {
        themeId: "classic",
        fonts: {
            heading: "Poppins",
            body: "Inter",
            pricing: "Roboto Mono",
        },
        headerStyle: "solid",
        headerOpacity: 0.97,
        dropdownPreset: "compact-columns",
        dropdownRadiusPx: 16,
        dropdownImageRadiusPx: 10,
        cardStyle: "default",
        radiusPx: 14,
        tightRadiusPx: 9,
        borderWidthPx: 1,
        pageBackgroundType: "solid",
        productBackgroundType: "solid",
        buttonAnimation: "lift",
        orderButtonAnimation: "none",
        heroTransition: "fade",
        heroTextAnimation: "fade",
        parallaxStyle: "soft-depth",
        parallaxIntensity: 16,
        heroOverlayOpacity: 0.36,
        matrixPaddingPx: 16,
        optionButtonPaddingPx: 12,
        optionImageSizePx: 144,
        pictureHoverScale: 1.025,
        buttonRadiusPx: 10,
        buttonHoverScale: 1.015,
        buttonHoverY: -1,
        buttonTapScale: 0.98,
        buttonTransitionMs: 180,
        buttonShadow: `0 10px 24px ${primary}24`,
        buttonHoverShadow: `0 16px 34px ${primary}33`,
        buttonSurfaceStyle: "satin",
        buttonTextColor: "#FFFFFF",
        buttonHoverTextColor: "#FFFFFF",
        buttonGradientStart: primary,
        buttonGradientEnd: hover,
        buttonHoverGradientStart: hover,
        buttonHoverGradientEnd: primary,
        buttonInnerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(15, 23, 42, 0.16)",
        buttonSheenColor: "rgba(255, 255, 255, 0.32)",
        dropdownMotionStyle: "soft-slide",
        pageTransitionStyle: "subtle-fade",
        pictureHoverEffect: "outline",
        pictureSelectedEffect: "ring",
        ...config,
    };
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
    createVisualThemePreset({
        id: "taste-glassmorphism",
        name: "Glassmorphism",
        description: "Frostede flader, rolig dybde og premium digital energi uden at miste kontrast.",
        tags: ["Glas", "Premium", "Digital"],
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
        fonts: { heading: "Manrope", body: "Inter", pricing: "Space Grotesk" },
        headerStyle: "glass",
        headerOpacity: 0.76,
        dropdownPreset: "showcase-bar",
        dropdownRadiusPx: 24,
        dropdownImageRadiusPx: 18,
        cardStyle: "glass",
        radiusPx: 24,
        tightRadiusPx: 16,
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        buttonAnimation: "glow",
        heroTransition: "cross-zoom",
        heroTextAnimation: "soft-mask",
        parallaxStyle: "slow-zoom",
        parallaxIntensity: 24,
        heroOverlayOpacity: 0.28,
        buttonRadiusPx: 999,
        buttonHoverScale: 1.025,
        buttonHoverY: -3,
        buttonTransitionMs: 240,
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
        glassOpacity: 0.72,
    }),
    createVisualThemePreset({
        id: "taste-neo-brutalism",
        name: "Neo-Brutalism",
        description: "Tykke streger, hårde skygger og direkte kampagnefølelse til modige brands.",
        tags: ["Bold", "Grafisk", "Ung"],
        colors: {
            primary: "#111827",
            secondary: "#FFE566",
            background: "#F8F4E8",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#EF4444",
            headingText: "#111827",
            bodyText: "#374151",
            pricingText: "#B91C1C",
            linkText: "#111827",
        },
        fonts: { heading: "Archivo Black", body: "IBM Plex Sans", pricing: "IBM Plex Mono" },
        dropdownPreset: "gallery-cards",
        dropdownRadiusPx: 6,
        dropdownImageRadiusPx: 3,
        radiusPx: 4,
        tightRadiusPx: 3,
        borderWidthPx: 3,
        buttonRadiusPx: 3,
        buttonSurfaceStyle: "pressed",
        buttonShadow: "0 6px 0 rgba(17, 24, 39, 1)",
        buttonHoverShadow: "0 8px 0 rgba(17, 24, 39, 1)",
        buttonGradientStart: "#111827",
        buttonGradientEnd: "#111827",
        buttonHoverGradientStart: "#EF4444",
        buttonHoverGradientEnd: "#B91C1C",
        buttonHoverY: -2,
        buttonTapScale: 0.95,
        buttonTransitionMs: 130,
        heroTransition: "slide",
        heroTextAnimation: "stagger-rise",
        parallaxStyle: "classic",
        parallaxIntensity: 10,
        dropdownMotionStyle: "gallery-rise",
        pageTransitionStyle: "direct-snap",
        pictureHoverEffect: "outline",
        pictureSelectedEffect: "outline",
    }),
    createVisualThemePreset({
        id: "taste-minimalism",
        name: "Minimalism",
        description: "Masser af luft, klare flader og stille professionalisme med fokus på handling.",
        tags: ["Minimal", "Rolig", "Klar"],
        colors: {
            primary: "#0F172A",
            secondary: "#EEF2F7",
            background: "#FBFCFE",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#334155",
            headingText: "#0F172A",
            bodyText: "#526071",
            pricingText: "#0F766E",
            linkText: "#0F172A",
        },
        fonts: { heading: "Inter", body: "Inter", pricing: "Roboto Mono" },
        dropdownPreset: "compact-columns",
        radiusPx: 12,
        tightRadiusPx: 8,
        heroTransition: "fade",
        heroTextAnimation: "fade",
        parallaxStyle: "fixed-focus",
        parallaxIntensity: 8,
        heroOverlayOpacity: 0.26,
        buttonAnimation: "none",
        buttonSurfaceStyle: "matte",
        buttonShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
        buttonHoverShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
        pageTransitionStyle: "subtle-fade",
    }),
    createVisualThemePreset({
        id: "taste-neumorphism",
        name: "Neumorphism",
        description: "Bløde appflader, pressede knapper og lavmælt dybde til en rolig designeroplevelse.",
        tags: ["Blød", "App", "Taktil"],
        colors: {
            primary: "#486581",
            secondary: "#E5ECF3",
            background: "#EEF3F8",
            card: "#F8FBFE",
            dropdown: "#F8FBFE",
            hover: "#334E68",
            headingText: "#102A43",
            bodyText: "#52606D",
            pricingText: "#0F766E",
            linkText: "#486581",
        },
        fonts: { heading: "Nunito", body: "Inter", pricing: "Roboto Mono" },
        radiusPx: 22,
        tightRadiusPx: 16,
        buttonRadiusPx: 18,
        buttonSurfaceStyle: "pressed",
        buttonTextColor: "#FFFFFF",
        buttonShadow: "8px 8px 18px rgba(72, 101, 129, 0.18), -8px -8px 18px rgba(255, 255, 255, 0.86)",
        buttonHoverShadow: "10px 10px 22px rgba(72, 101, 129, 0.22), -10px -10px 22px rgba(255, 255, 255, 0.9)",
        buttonGradientStart: "#486581",
        buttonGradientEnd: "#334E68",
        heroTransition: "zoom-fade",
        heroTextAnimation: "slide-up",
        parallaxStyle: "soft-depth",
    }),
    createVisualThemePreset({
        id: "taste-flat-design",
        name: "Flat Design",
        description: "Rene farveblokke, simple ikoner og hurtig læsbarhed til praktiske shops.",
        tags: ["Flad", "Hurtig", "Simpel"],
        colors: {
            primary: "#2563EB",
            secondary: "#DBEAFE",
            background: "#F8FAFC",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#1D4ED8",
            headingText: "#111827",
            bodyText: "#4B5563",
            pricingText: "#059669",
            linkText: "#2563EB",
        },
        fonts: { heading: "Rubik", body: "Open Sans", pricing: "Roboto Mono" },
        radiusPx: 8,
        tightRadiusPx: 6,
        buttonRadiusPx: 6,
        buttonSurfaceStyle: "matte",
        buttonShadow: "none",
        buttonHoverShadow: "none",
        heroTransition: "slide",
        heroTextAnimation: "fade",
        parallaxStyle: "classic",
        parallaxIntensity: 8,
        pageTransitionStyle: "direct-snap",
    }),
    createVisualThemePreset({
        id: "taste-material-design",
        name: "Material Design",
        description: "Strukturerede kort, tydelig elevation og velkendte SaaS-mønstre.",
        tags: ["Material", "SaaS", "Struktur"],
        colors: {
            primary: "#0B57D0",
            secondary: "#E8F0FE",
            background: "#F8FAFD",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#174EA6",
            headingText: "#202124",
            bodyText: "#5F6368",
            pricingText: "#188038",
            linkText: "#0B57D0",
        },
        fonts: { heading: "Roboto", body: "Roboto", pricing: "Roboto Mono" },
        dropdownPreset: "split-preview",
        radiusPx: 16,
        tightRadiusPx: 12,
        buttonRadiusPx: 999,
        buttonSurfaceStyle: "satin",
        buttonShadow: "0 2px 6px rgba(60, 64, 67, 0.18)",
        buttonHoverShadow: "0 8px 18px rgba(60, 64, 67, 0.2)",
        heroTransition: "soft-wipe",
        heroTextAnimation: "reveal-up",
        dropdownMotionStyle: "soft-slide",
    }),
    createVisualThemePreset({
        id: "taste-swiss-international",
        name: "Swiss International",
        description: "Præcis gridfølelse, disciplineret typografi og høj tillid til B2B.",
        tags: ["Grid", "B2B", "Præcis"],
        colors: {
            primary: "#111827",
            secondary: "#E5E7EB",
            background: "#F9FAFB",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#D01F2F",
            headingText: "#111827",
            bodyText: "#4B5563",
            pricingText: "#111827",
            linkText: "#D01F2F",
        },
        fonts: { heading: "Work Sans", body: "Inter", pricing: "IBM Plex Mono" },
        dropdownPreset: "compact-columns",
        radiusPx: 2,
        tightRadiusPx: 2,
        borderWidthPx: 1,
        buttonRadiusPx: 2,
        buttonSurfaceStyle: "matte",
        buttonShadow: "none",
        buttonHoverShadow: "0 0 0 2px rgba(208, 31, 47, 0.24)",
        heroTransition: "fade",
        heroTextAnimation: "reveal-up",
        pageTransitionStyle: "editorial-rise",
    }),
    createVisualThemePreset({
        id: "taste-retro-y2k",
        name: "Retro Y2K",
        description: "Nostalgisk digital energi, klare accenter og moderne kontrol over kontrasten.",
        tags: ["Retro", "Y2K", "Legende"],
        colors: {
            primary: "#7C3AED",
            secondary: "#D9F99D",
            background: "#FFF7ED",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#DB2777",
            headingText: "#2E1065",
            bodyText: "#5B4674",
            pricingText: "#C026D3",
            linkText: "#7C3AED",
        },
        fonts: { heading: "Sora", body: "Nunito", pricing: "Space Mono" },
        dropdownPreset: "gallery-cards",
        radiusPx: 20,
        tightRadiusPx: 12,
        buttonRadiusPx: 999,
        buttonAnimation: "glow",
        buttonSurfaceStyle: "luminous",
        heroTransition: "cross-zoom",
        heroTextAnimation: "stagger-rise",
        parallaxStyle: "slow-zoom",
        parallaxIntensity: 20,
        dropdownMotionStyle: "gallery-rise",
        pageTransitionStyle: "soft-depth",
    }),
    createVisualThemePreset({
        id: "taste-editorial-magazine",
        name: "Editorial Magazine",
        description: "Store overskrifter, magasinrytme og billeddrevet premium fortælling.",
        tags: ["Editorial", "Story", "Premium"],
        colors: {
            primary: "#1F2937",
            secondary: "#E6EDF5",
            background: "#FAFAF8",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#345C72",
            headingText: "#111827",
            bodyText: "#52525B",
            pricingText: "#345C72",
            linkText: "#1F2937",
        },
        fonts: { heading: "Cormorant Garamond", body: "Source Sans 3", pricing: "IBM Plex Mono" },
        dropdownPreset: "split-preview",
        radiusPx: 14,
        tightRadiusPx: 8,
        productBackgroundType: "gradient",
        heroTransition: "zoom-fade",
        heroTextAnimation: "cinematic",
        parallaxStyle: "fixed-focus",
        heroOverlayOpacity: 0.44,
        pageTransitionStyle: "editorial-rise",
    }),
    createVisualThemePreset({
        id: "taste-dark-futuristic",
        name: "Dark Futuristic",
        description: "Dyb teknisk kontrast, fokuserede cyan-accenter og kontrolleret glow.",
        tags: ["Dark", "Tech", "Fokus"],
        colors: {
            primary: "#22D3EE",
            secondary: "#172033",
            background: "#050816",
            card: "#0B1120",
            dropdown: "#0F172A",
            hover: "#38BDF8",
            headingText: "#F8FAFC",
            bodyText: "#CBD5E1",
            pricingText: "#A5F3FC",
            linkText: "#67E8F9",
        },
        fonts: { heading: "Space Grotesk", body: "Inter", pricing: "JetBrains Mono" },
        cardStyle: "glass",
        headerStyle: "solid",
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        buttonAnimation: "glow",
        buttonSurfaceStyle: "luminous",
        heroTransition: "ken-burns",
        heroTextAnimation: "reveal-up",
        parallaxStyle: "slow-zoom",
        heroOverlayOpacity: 0.54,
        dropdownMotionStyle: "focus-slide",
        pageTransitionStyle: "dark-focus",
        glassOpacity: 0.84,
    }),
    createVisualThemePreset({
        id: "taste-luxury-premium",
        name: "Luxury Premium",
        description: "Elegant luksus med kølige neutrale flader, rolig rytme og diskret metallisk accent.",
        tags: ["Luksus", "Elegant", "Rolig"],
        colors: {
            primary: "#1F2937",
            secondary: "#E5E7EB",
            background: "#F7F8FA",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#6B7280",
            headingText: "#111827",
            bodyText: "#4B5563",
            pricingText: "#374151",
            linkText: "#1F2937",
        },
        fonts: { heading: "DM Serif Display", body: "Source Sans 3", pricing: "Roboto Mono" },
        dropdownPreset: "split-preview",
        radiusPx: 20,
        tightRadiusPx: 14,
        productBackgroundType: "gradient",
        buttonRadiusPx: 999,
        buttonSurfaceStyle: "satin",
        heroTransition: "zoom-fade",
        heroTextAnimation: "cinematic",
        parallaxStyle: "fixed-focus",
        pageTransitionStyle: "editorial-rise",
    }),
    createVisualThemePreset({
        id: "taste-corporate-enterprise",
        name: "Corporate Enterprise",
        description: "Skalerbar og professionel B2B-flade med klare formularer og sikre valg.",
        tags: ["Corporate", "B2B", "Tillid"],
        colors: {
            primary: "#1E3A8A",
            secondary: "#E8EEF7",
            background: "#F6F8FB",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#1D4ED8",
            headingText: "#111827",
            bodyText: "#475569",
            pricingText: "#0F766E",
            linkText: "#1E3A8A",
        },
        fonts: { heading: "Inter", body: "Source Sans 3", pricing: "IBM Plex Mono" },
        dropdownPreset: "compact-columns",
        radiusPx: 10,
        tightRadiusPx: 8,
        heroTransition: "soft-wipe",
        heroTextAnimation: "reveal-up",
        parallaxIntensity: 12,
        pageTransitionStyle: "subtle-fade",
    }),
    createVisualThemePreset({
        id: "taste-playful-cartoon",
        name: "Playful Cartoon",
        description: "Venlig, rund og farverig stil til lette kundeoplevelser uden at blive barnlig.",
        tags: ["Venlig", "Rund", "Farverig"],
        colors: {
            primary: "#0EA5E9",
            secondary: "#FEF3C7",
            background: "#FFFDF7",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#F97316",
            headingText: "#1F2937",
            bodyText: "#4B5563",
            pricingText: "#EA580C",
            linkText: "#0284C7",
        },
        fonts: { heading: "Nunito", body: "Nunito", pricing: "Space Mono" },
        dropdownPreset: "gallery-cards",
        radiusPx: 28,
        tightRadiusPx: 18,
        buttonRadiusPx: 999,
        buttonAnimation: "lift",
        buttonSurfaceStyle: "satin",
        heroTransition: "slide",
        heroTextAnimation: "stagger-rise",
        dropdownMotionStyle: "gallery-rise",
        pictureHoverScale: 1.04,
    }),
    createVisualThemePreset({
        id: "taste-organic-natural",
        name: "Organic Natural",
        description: "Jordnære farver, bløde former og varm menneskelig tone til lokale brands.",
        tags: ["Organisk", "Varm", "Lokal"],
        colors: {
            primary: "#3F6B4F",
            secondary: "#E8F1E8",
            background: "#FAFBF7",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#2F513C",
            headingText: "#102116",
            bodyText: "#45574A",
            pricingText: "#2F6B4F",
            linkText: "#3F6B4F",
        },
        fonts: { heading: "Lora", body: "Lato", pricing: "Roboto Mono" },
        radiusPx: 24,
        tightRadiusPx: 16,
        productBackgroundType: "gradient",
        heroTransition: "zoom-fade",
        heroTextAnimation: "slide-up",
        parallaxStyle: "soft-depth",
    }),
    createVisualThemePreset({
        id: "taste-industrial-technical",
        name: "Industrial Technical",
        description: "Robuste paneler, tekniske linjer og specifikationsklar produktvisning.",
        tags: ["Teknisk", "Robust", "Data"],
        colors: {
            primary: "#334155",
            secondary: "#E2E8F0",
            background: "#F1F5F9",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#F97316",
            headingText: "#0F172A",
            bodyText: "#475569",
            pricingText: "#C2410C",
            linkText: "#334155",
        },
        fonts: { heading: "IBM Plex Sans", body: "Inter", pricing: "IBM Plex Mono" },
        radiusPx: 6,
        tightRadiusPx: 4,
        borderWidthPx: 2,
        buttonRadiusPx: 4,
        buttonSurfaceStyle: "pressed",
        buttonShadow: "0 4px 0 rgba(51, 65, 85, 0.82)",
        buttonHoverShadow: "0 6px 0 rgba(51, 65, 85, 0.88)",
        heroTransition: "soft-wipe",
        heroTextAnimation: "reveal-up",
        pageTransitionStyle: "direct-snap",
    }),
    createVisualThemePreset({
        id: "taste-apple-clean",
        name: "Apple Clean",
        description: "Poleret, let og præcis premium enkelhed med bløde gradients og rolig motion.",
        tags: ["Clean", "Apple", "Poleret"],
        themeId: "glassmorphism",
        colors: {
            primary: "#2563EB",
            secondary: "#EEF2FF",
            background: "#F7F9FC",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#64748B",
            headingText: "#0F172A",
            bodyText: "#475569",
            pricingText: "#2563EB",
            linkText: "#2563EB",
        },
        fonts: { heading: "Manrope", body: "Inter", pricing: "Space Grotesk" },
        headerStyle: "glass",
        cardStyle: "glass",
        radiusPx: 28,
        tightRadiusPx: 18,
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        buttonRadiusPx: 999,
        buttonSurfaceStyle: "apple-glass",
        buttonTextColor: "#10202C",
        buttonHoverTextColor: "#10202C",
        buttonGradientStart: "rgba(255, 255, 255, 0.9)",
        buttonGradientEnd: "rgba(226, 232, 240, 0.68)",
        buttonHoverGradientStart: "rgba(255, 255, 255, 0.98)",
        buttonHoverGradientEnd: "rgba(219, 234, 254, 0.82)",
        heroTransition: "cross-zoom",
        heroTextAnimation: "soft-mask",
        parallaxStyle: "slow-zoom",
        dropdownMotionStyle: "liquid",
        pageTransitionStyle: "soft-depth",
        glassOpacity: 0.76,
    }),
    createVisualThemePreset({
        id: "taste-dashboard-saas",
        name: "Dashboard SaaS",
        description: "Tæt, handlingsklar adminfølelse med kort, status og hurtig scanning.",
        tags: ["SaaS", "Dashboard", "Overblik"],
        colors: {
            primary: "#4F46E5",
            secondary: "#EEF2FF",
            background: "#F8FAFC",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#3730A3",
            headingText: "#111827",
            bodyText: "#475569",
            pricingText: "#0F766E",
            linkText: "#4F46E5",
        },
        fonts: { heading: "Plus Jakarta Sans", body: "Inter", pricing: "JetBrains Mono" },
        dropdownPreset: "compact-columns",
        radiusPx: 14,
        tightRadiusPx: 10,
        matrixPaddingPx: 14,
        optionButtonPaddingPx: 11,
        heroTransition: "soft-wipe",
        heroTextAnimation: "reveal-up",
        pageTransitionStyle: "subtle-fade",
    }),
    createVisualThemePreset({
        id: "taste-ecommerce-modern",
        name: "E-commerce Modern",
        description: "Produktkort, tydelige priser og stærke CTA'er til hurtig bestilling.",
        tags: ["Shop", "Pris", "CTA"],
        colors: {
            primary: "#0F766E",
            secondary: "#DFF7EF",
            background: "#F7FBFA",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#115E59",
            headingText: "#102A2A",
            bodyText: "#4B635F",
            pricingText: "#047857",
            linkText: "#0F766E",
        },
        fonts: { heading: "Rubik", body: "Open Sans", pricing: "IBM Plex Mono" },
        dropdownPreset: "showcase-bar",
        radiusPx: 18,
        tightRadiusPx: 12,
        buttonRadiusPx: 999,
        heroTransition: "zoom-fade",
        heroTextAnimation: "slide-up",
        parallaxStyle: "soft-depth",
    }),
    createVisualThemePreset({
        id: "taste-cinematic-storytelling",
        name: "Cinematic Storytelling",
        description: "Mørkere billedbehandling, stærke hero-momenter og langsom fortællerytme.",
        tags: ["Cinematic", "Story", "Billeder"],
        colors: {
            primary: "#D97706",
            secondary: "#1F2937",
            background: "#0B0F17",
            card: "#111827",
            dropdown: "#111827",
            hover: "#F59E0B",
            headingText: "#F9FAFB",
            bodyText: "#D1D5DB",
            pricingText: "#FBBF24",
            linkText: "#F59E0B",
        },
        fonts: { heading: "Playfair Display", body: "Source Sans 3", pricing: "Roboto Mono" },
        cardStyle: "glass",
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        heroTransition: "ken-burns",
        heroTextAnimation: "cinematic",
        parallaxStyle: "fixed-focus",
        heroOverlayOpacity: 0.58,
        dropdownPreset: "split-preview",
        pageTransitionStyle: "editorial-rise",
        glassOpacity: 0.82,
    }),
    createVisualThemePreset({
        id: "taste-gaming-ui",
        name: "Gaming UI",
        description: "Energi, badges og høj kontrast til gamifiede flows uden at gøre siden rodet.",
        tags: ["Gaming", "Energi", "Kontrast"],
        colors: {
            primary: "#22C55E",
            secondary: "#1E1B4B",
            background: "#070A12",
            card: "#111827",
            dropdown: "#0F172A",
            hover: "#A3E635",
            headingText: "#F8FAFC",
            bodyText: "#CBD5E1",
            pricingText: "#BEF264",
            linkText: "#86EFAC",
        },
        fonts: { heading: "Sora", body: "Inter", pricing: "Space Mono" },
        cardStyle: "glass",
        pageBackgroundType: "gradient",
        productBackgroundType: "gradient",
        buttonAnimation: "glow",
        buttonSurfaceStyle: "luminous",
        heroTransition: "cross-zoom",
        heroTextAnimation: "stagger-rise",
        dropdownMotionStyle: "focus-slide",
        pageTransitionStyle: "dark-focus",
        glassOpacity: 0.84,
    }),
    createVisualThemePreset({
        id: "taste-government-public-service",
        name: "Government Public Service",
        description: "Officiel, rolig og meget tydelig stil med høj kontrast og enkle valg.",
        tags: ["Offentlig", "Tilgængelig", "Klar"],
        colors: {
            primary: "#1D4ED8",
            secondary: "#DBEAFE",
            background: "#FFFFFF",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#1E3A8A",
            headingText: "#111827",
            bodyText: "#374151",
            pricingText: "#065F46",
            linkText: "#1D4ED8",
        },
        fonts: { heading: "Inter", body: "Open Sans", pricing: "Roboto Mono" },
        radiusPx: 6,
        tightRadiusPx: 4,
        borderWidthPx: 1,
        buttonRadiusPx: 4,
        buttonAnimation: "none",
        buttonSurfaceStyle: "matte",
        buttonShadow: "none",
        buttonHoverShadow: "0 0 0 3px rgba(29, 78, 216, 0.18)",
        heroTransition: "fade",
        heroTextAnimation: "none",
        parallaxStyle: "fixed-focus",
        parallaxIntensity: 0,
        pageTransitionStyle: "direct-snap",
    }),
    createVisualThemePreset({
        id: "taste-marketplace-ui",
        name: "Marketplace UI",
        description: "Søgning, filtrering og sammenligning får tydelige kort og stærk informationshierarki.",
        tags: ["Marked", "Filter", "Kort"],
        colors: {
            primary: "#0F766E",
            secondary: "#ECFDF5",
            background: "#F8FAFC",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#0F5E59",
            headingText: "#0F172A",
            bodyText: "#475569",
            pricingText: "#047857",
            linkText: "#0F766E",
        },
        fonts: { heading: "Plus Jakarta Sans", body: "Inter", pricing: "IBM Plex Mono" },
        dropdownPreset: "showcase-bar",
        radiusPx: 16,
        tightRadiusPx: 10,
        heroTransition: "soft-wipe",
        heroTextAnimation: "slide-up",
        matrixPaddingPx: 14,
        optionButtonPaddingPx: 11,
    }),
    createVisualThemePreset({
        id: "taste-mobile-first-app",
        name: "Mobile-First App UI",
        description: "Store trykflader, korte tekster og app-lignende rytme til hurtige kundevalg.",
        tags: ["Mobil", "App", "Touch"],
        colors: {
            primary: "#2563EB",
            secondary: "#DBEAFE",
            background: "#F6F8FC",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#1D4ED8",
            headingText: "#111827",
            bodyText: "#4B5563",
            pricingText: "#2563EB",
            linkText: "#2563EB",
        },
        fonts: { heading: "Figtree", body: "Inter", pricing: "Roboto Mono" },
        radiusPx: 24,
        tightRadiusPx: 16,
        buttonRadiusPx: 999,
        optionButtonPaddingPx: 15,
        optionImageSizePx: 160,
        heroTransition: "slide",
        heroTextAnimation: "slide-up",
        dropdownMotionStyle: "soft-slide",
    }),
    createVisualThemePreset({
        id: "taste-print-cmyk-graphic",
        name: "Print CMYK Graphic",
        description: "CMYK-referencer, crop-mark energi og grafisk printfornemmelse til web-to-print.",
        tags: ["CMYK", "Print", "Grafisk"],
        colors: {
            primary: "#00A3E0",
            secondary: "#FFF200",
            background: "#FFFFFF",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#EC008C",
            headingText: "#111827",
            bodyText: "#374151",
            pricingText: "#00A651",
            linkText: "#0076A8",
        },
        fonts: { heading: "Space Grotesk", body: "Inter", pricing: "IBM Plex Mono" },
        dropdownPreset: "gallery-cards",
        radiusPx: 8,
        tightRadiusPx: 4,
        borderWidthPx: 2,
        buttonRadiusPx: 4,
        buttonSurfaceStyle: "pressed",
        buttonShadow: "0 4px 0 rgba(17, 24, 39, 0.9)",
        buttonHoverShadow: "0 6px 0 rgba(236, 0, 140, 0.82)",
        buttonGradientStart: "#00A3E0",
        buttonGradientEnd: "#0076A8",
        buttonHoverGradientStart: "#EC008C",
        buttonHoverGradientEnd: "#C00073",
        heroTransition: "soft-wipe",
        heroTextAnimation: "stagger-rise",
        dropdownMotionStyle: "gallery-rise",
    }),
    createVisualThemePreset({
        id: "taste-restaurant-menu",
        name: "Restaurant Menu UI",
        description: "Varme tilbud, klare kategorier og læsbare prisflader til mad og takeaway.",
        tags: ["Menu", "Varm", "Bestilling"],
        colors: {
            primary: "#B91C1C",
            secondary: "#FEF3C7",
            background: "#FFF8F0",
            card: "#FFFFFF",
            dropdown: "#FFFFFF",
            hover: "#EA580C",
            headingText: "#2B1712",
            bodyText: "#5F3B30",
            pricingText: "#B45309",
            linkText: "#B91C1C",
        },
        fonts: { heading: "Lora", body: "Nunito", pricing: "Roboto Mono" },
        dropdownPreset: "gallery-cards",
        radiusPx: 22,
        tightRadiusPx: 14,
        buttonRadiusPx: 999,
        heroTransition: "zoom-fade",
        heroTextAnimation: "slide-up",
        parallaxStyle: "slow-zoom",
        dropdownMotionStyle: "gallery-rise",
    }),
];


const buildVisualThemePresetPatch = (
    draft: BrandingData,
    preset: VisualThemePreset,
): Partial<BrandingData> => {
    const basePatch = buildSiteColorPatch(draft, preset.colors);
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
    const isDark = isDarkThemeBackground(background);
    const isGlassPreset = preset.cardStyle === "glass" || preset.headerStyle === "glass" || preset.buttonSurfaceStyle === "apple-glass";
    const isBoldPreset = preset.buttonSurfaceStyle === "pressed" || preset.borderWidthPx >= 2;
    const isEditorialPreset = preset.pageTransitionStyle === "editorial-rise";
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
    const themeId = preset.id.startsWith("taste-") ? preset.id : preset.themeId;
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
        themeId,
        themeSettings: {
            ...(basePatch.themeSettings || draft.themeSettings),
            visualThemePresetId: preset.id,
            visualThemePresetName: preset.name,
            visualStyleId: preset.id,
            visualStyleName: preset.name,
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
            backgroundGradientUseMiddle: isGlassPreset,
            backgroundGradientMiddle: isGlassPreset ? secondary : card,
            backgroundGradientAngle: isBoldPreset ? 180 : 135,
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
            dropdownPreset: resolveDropdownPreset(draft.header?.dropdownPreset),
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
            gradientDirection: isBoldPreset ? "to-r" : "to-br",
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
                    gradientAngle: isEditorialPreset ? 145 : 135,
                    animated: isGlassPreset,
                    animatedStart: primary,
                    animatedMiddle: secondary,
                    animatedEnd: hover,
                },
            },
            productsSection: {
                ...baseProductsSection,
                layoutStyle: isBoldPreset ? "flat" : "cards",
                categoryTabs: {
                    ...baseProductsSection.categoryTabs,
                    borderRadiusPx: isBoldPreset ? preset.tightRadiusPx : 100,
                    textColor: heading,
                    hoverTextColor: hover,
                    activeTextColor: primaryFillText,
                    bgColor: panelBg,
                    hoverBgColor: isBoldPreset ? secondary : softHover,
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
                cellHoverBg: isBoldPreset ? secondary : softHover,
                cellHoverText: isBoldPreset ? heading : hover,
                selectedBg: primary,
                selectedText: primaryFillText,
                borderColor: subtleBorder,
                navButtonBg: panelBg,
                navButtonText: heading,
                navButtonHoverBg: isBoldPreset ? secondary : softHover,
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
                    hoverBackgroundColor: isBoldPreset ? secondary : softHover,
                    textColor: heading,
                    hoverTextColor: hover,
                    selectedBackgroundColor: primary,
                    selectedTextColor: primaryFillText,
                    borderRadiusPx: preset.tightRadiusPx,
                    borderWidthPx: preset.borderWidthPx,
                    borderColor: subtleBorder,
                    hoverBorderColor: primary,
                    paddingPx: preset.optionButtonPaddingPx,
                    minHeightPx: isBoldPreset ? 46 : 44,
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
                optionHoverBg: isBoldPreset ? secondary : softHover,
                optionSelectedBg: softPrimary,
                optionBorderColor: subtleBorder,
                optionHoverBorderColor: primary,
                optionSelectedBorderColor: primary,
                badgeBg: softPrimary,
                badgeText: pricing,
                badgeBorderColor: primary,
                downloadButtonBg: panelBg,
                downloadButtonHoverBg: isBoldPreset ? secondary : softHover,
                downloadButtonText: heading,
                downloadButtonHoverText: hover,
                downloadButtonBorder: subtleBorder,
                downloadButtonHoverBorder: primary,
                downloadButtonSurfaceStyle: preset.buttonSurfaceStyle,
                downloadButtonGradientStart: panelBg,
                downloadButtonGradientEnd: isDark ? "#0B1220" : hexToRgba(card, 0.72),
                downloadButtonHoverGradientStart: isGlassPreset ? "rgba(255, 255, 255, 0.92)" : softHover,
                downloadButtonHoverGradientEnd: isBoldPreset ? secondary : panelBg,
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
                motionStyle: isGlassPreset ? "elastic" : isBoldPreset ? "press" : "smooth",
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
                    hoverBgColor: isBoldPreset ? secondary : softHover,
                    gradientStart: panelBg,
                    gradientEnd: preset.cardStyle === "glass" ? hexToRgba(card, 0.58) : panelBg,
                    hoverGradientStart: isBoldPreset ? secondary : softHover,
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
                    hoverBgColor: isBoldPreset ? secondary : softHover,
                    hoverTextColor: hover,
                    borderRadius: preset.tightRadiusPx,
                    borderColor: subtleBorder,
                    borderWidth: preset.borderWidthPx,
                    selectedRingColor: primary,
                    hoverRingEnabled: true,
                    paddingPx: preset.optionButtonPaddingPx,
                    fontSizePx: isBoldPreset ? 15 : 14,
                    shadow: isBoldPreset ? preset.buttonShadow : "0 6px 16px rgba(15, 23, 42, 0.08)",
                    hoverShadow: preset.buttonHoverShadow,
                    selectedShadow: preset.buttonHoverShadow,
                    hoverScale: preset.buttonHoverScale,
                    hoverY: preset.buttonHoverY,
                    tapScale: preset.buttonTapScale,
                    transitionMs: preset.buttonTransitionMs,
                    motionStyle: isGlassPreset ? "elastic" : isBoldPreset ? "press" : "smooth",
                    surfaceStyle: preset.buttonSurfaceStyle,
                    gradientStart: preset.cardStyle === "glass" ? preset.buttonGradientStart : panelBg,
                    gradientEnd: preset.cardStyle === "glass" ? preset.buttonGradientEnd : panelBg,
                    hoverGradientStart: isBoldPreset ? secondary : softHover,
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
                    hoverBgColor: isBoldPreset ? secondary : softHover,
                    selectedRingColor: primary,
                    hoverRingEnabled: true,
                    hoverRingColor: hover,
                    labelColor: heading,
                    shadow: isBoldPreset ? preset.buttonShadow : "0 8px 20px rgba(15, 23, 42, 0.08)",
                    hoverShadow: preset.buttonHoverShadow,
                    selectedShadow: preset.buttonHoverShadow,
                    hoverScale: preset.pictureHoverScale,
                    hoverY: preset.buttonHoverY,
                    tapScale: preset.buttonTapScale,
                    transitionMs: preset.buttonTransitionMs,
                    motionStyle: isGlassPreset ? "elastic" : isBoldPreset ? "press" : "smooth",
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
    draft: BrandingData,
    presetFonts: BrandingFontPresetFonts,
): Partial<BrandingData> => {
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

type MatrixSettings = typeof DEFAULT_BRANDING.productPage.matrix;
type MatrixColorKey = Exclude<{
    [Key in keyof MatrixSettings]: MatrixSettings[Key] extends string ? Key : never;
}[keyof MatrixSettings], "font">;

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
};

type SiteFrontendState = {
    activeSiteId: string | null;
    installedSiteIds: string[];
    lastInstallBySite: Record<string, SiteInstallSummary & { installedAt: string }>;
};

type SiteReadinessStats = {
    mapped: number;
    published: number;
    priceReady: number;
    siteOnly: number;
    modeReady: number;
    modeNeedsReview: number;
};

const EMPTY_SITE_READINESS: SiteReadinessStats = {
    mapped: 0,
    published: 0,
    priceReady: 0,
    siteOnly: 0,
    modeReady: 0,
    modeNeedsReview: 0,
};

const SITE_PACKAGE_GROUPS: Array<{
    id: string;
    label: string;
    description: string;
    siteIds: string[];
}> = [
    {
        id: "general-print",
        label: "General print",
        description: "Bred webshop til flyers, foldere, visitkort og standard tryksager.",
        siteIds: ["print-playground", "print-pop"],
    },
    {
        id: "signage",
        label: "Storformat og skilte",
        description: "Bannere, skilte, folie og facade-orienterede shops.",
        siteIds: ["banner-builder-pro", "shopfront-designer"],
    },
    {
        id: "apparel",
        label: "Tøj og merch",
        description: "T-shirts, hoodies og merchandise-orienterede shopflows.",
        siteIds: ["tee-design-hub", "vibe-tees", "vibe-prints-co"],
    },
    {
        id: "photo-art",
        label: "Foto og kunst",
        description: "Fotoprodukter, plakater, art prints og personlige produkter.",
        siteIds: ["art-canvas-studio", "snap-cherish"],
    },
    {
        id: "education",
        label: "Læring og specialprint",
        description: "Læringsprodukter, gulvgrafikker og institutionsrettede løsninger.",
        siteIds: ["learning-landscapes-shop"],
    },
];

function parseSiteFrontendState(settings: any): SiteFrontendState {
    const root = settings?.site_frontends || {};

    return {
        activeSiteId: typeof root.activeSiteId === "string" ? root.activeSiteId : null,
        installedSiteIds: Array.isArray(root.installedSiteIds)
            ? root.installedSiteIds.filter((value: unknown): value is string => typeof value === "string")
            : [],
        lastInstallBySite:
            root.lastInstallBySite && typeof root.lastInstallBySite === "object"
                ? root.lastInstallBySite
                : {},
    };
}

function mergeSiteFrontendState(settings: any, patch: Partial<SiteFrontendState>) {
    const current = parseSiteFrontendState(settings);
    const currentRaw = settings?.site_frontends || {};

    return {
        ...(settings || {}),
        site_frontends: {
            ...currentRaw,
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
        },
    };
}

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

const isDarkThemeBackground = (color: string): boolean => {
    const normalized = String(color || "").trim();
    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    const hex = shortMatch
        ? shortMatch[1].split("").map((part) => `${part}${part}`).join("")
        : longMatch?.[1];

    if (!hex) return false;

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((value) => Number.isNaN(value))) return false;

    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 96;
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
    { label: "Checkout", path: "/checkout" },
    { label: "Grafisk vejledning", path: "/grafisk-vejledning" },
    { label: "Kontakt", path: "/kontakt" },
    { label: "Om os", path: "/om-os" },
];

const USP_ICON_OPTIONS: Array<{ value: USPIconType; label: string; icon: LucideIcon }> = [
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

    // Product option button click: product-option.<productId>.<sectionId>.<valueId>.<valueName>
    const productOptionMatch = /^product-option\.([^.]+)\.([^.]+)\.([^.]+)\.(.+)$/.exec(rawId);
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
    const productSelectorBoxMatch = /^product-selector-box\.([^.]+)\.([^.]+)\.(.+)$/.exec(rawId);
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
    "shop-layout": "Shopdesign",
    "site-package": "Shop type",
    theme: "Tema",
    logo: "Logo & Favicon",
    header: "Header & Menu",
    typography: "Typografi",
    "page-background": "Sidebaggrund",
    colors: "Farver",
    banner: "Banner (Hero)",
    showcase: "Ekstra banner / galleri",
    "lower-info": "Nedre infobokse",
    "usp-strip": "Fordelsbjælke",
    "seo-content": "SEO Tekst",
    products: "Produktvisning",
    "featured-products": "Fremhævede produkter",
    "product-page-matrix": "Produktside matrix, prisberegner & knapper",
    "produktvalgknapper": "Produktvalgknapper",
    "product-description": "Produktbeskrivelse",
    content: "Indholdsblokke",
    footer: "Footer",
    icons: "Billeder og ikoner",
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
        id: "shop-layout",
        label: "Shopdesign",
        group: "global",
        icon: Layers3,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-cyan-100 text-cyan-900 hover:bg-cyan-50/50 hover:border-cyan-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-cyan-100/50 flex items-center justify-center text-cyan-700 group-hover:bg-cyan-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "site-package",
        label: "Shop type",
        group: "global",
        icon: Store,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
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
        id: "featured-products", label: "Fremhævede produkter", group: "home", icon: ShoppingCart,
        buttonClassName: "bg-blue-50/70", iconWrapperClassName: "bg-blue-100/70", iconClassName: "h-4 w-4",
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
        id: "lower-info",
        label: "Nedre infobokse",
        group: "home",
        icon: Layout,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-cyan-100 text-cyan-900 hover:bg-cyan-50/50 hover:border-cyan-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-cyan-100/50 flex items-center justify-center text-cyan-600 group-hover:bg-cyan-100 transition-colors",
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
        label: "Billeder og ikoner",
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
            { key: "background", label: "Sidebaggrund", description: "Ensfarvet baggrund bag sidens indhold. Erstatter baggrundsbillede eller gradient." },
            { key: "dropdown", label: "Dropdownmenu", description: "Baggrund i headerens produktmenu." },
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
            { key: "hover", label: "Hoverfarve", description: "Knapper og links, når markøren holdes over dem." },
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

];

export function SiteDesignEditorV2({ adapter, capabilities, onSwitchVersion }: SiteDesignEditorV2Props) {
    const editor = useBrandingEditor({ adapter, capabilities });
    const isDraftLive = brandingEquals(editor.draft, editor.published);
    const [activeSection, setActiveSection] = useState<string | null>("theme");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sectionFocusRequest, setSectionFocusRequest] = useState<{ id: number; target: string } | null>(null);
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

    const [resourceDesignVisible, setResourceDesignVisible] = useState(true);
    const [showPremadeDesignsDialog, setShowPremadeDesignsDialog] = useState(false);
    const [availablePremadeDesigns, setAvailablePremadeDesigns] = useState<any[]>([]);
    const [loadingPremadeDesigns, setLoadingPremadeDesigns] = useState(false);
    const [capturingThumbnail, setCapturingThumbnail] = useState(false);
    const designLibraryRequest = useRef(0);
    useEffect(() => {
        designLibraryRequest.current += 1;
        setAvailablePremadeDesigns([]);
        return () => { designLibraryRequest.current += 1; };
    }, [editor.entityId]);
    const loadPremadeDesigns = useCallback(async () => {
        const request = ++designLibraryRequest.current;
        setLoadingPremadeDesigns(true);
        try {
            const designs = await loadShopDesignLibrary(editor.entityId);
            if (request === designLibraryRequest.current) setAvailablePremadeDesigns(designs);
        } catch (error) {
            if (request === designLibraryRequest.current) {
                setAvailablePremadeDesigns([]);
                toast.error('Kunne ikke hente designskabeloner. Prøv igen.');
            }
        } finally {
            if (request === designLibraryRequest.current) setLoadingPremadeDesigns(false);
        }
    }, [editor.entityId]);


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
    const [persistedProductPricing, setPersistedProductPricing] = useState<ProductStylingPreview | null>(null);
    const [productPricingPreview, setProductPricingPreview] = useState<ProductStylingPreview | null>(null);
    const [focusRequestId, setFocusRequestId] = useState(0);
    const [selectedFeaturedSlideId, setSelectedFeaturedSlideId] = useState(FIRST_FEATURED_SLIDE);
    const [featuredProducts, setFeaturedProducts] = useState<FeaturedProductOption[]>([]);
    const [loadingFeaturedProducts, setLoadingFeaturedProducts] = useState(false);
    const [uploadingPageBackgroundImage, setUploadingPageBackgroundImage] = useState(false);
    const [uploadingFeaturedMainImage, setUploadingFeaturedMainImage] = useState(false);
    const [colorPresetName, setColorPresetName] = useState("");
    const [tenantSettings, setTenantSettings] = useState<any>(null);
    const [siteReadinessById, setSiteReadinessById] = useState<Record<string, SiteReadinessStats>>({});
    const [siteMappingProducts, setSiteMappingProducts] = useState<SiteMappingProduct[]>([]);
    const [loadingSitePackages, setLoadingSitePackages] = useState(false);
    const [workingSiteId, setWorkingSiteId] = useState<string | null>(null);

    // Keep preview selection and capture scoped to this editor instance.
    const workspaceRef = useRef<HTMLDivElement>(null);
    const siteState = useMemo(() => parseSiteFrontendState(tenantSettings), [tenantSettings]);
    const activeSitePackage = useMemo(
        () => SITE_PACKAGES.find((sitePackage) => sitePackage.id === siteState.activeSiteId) || null,
        [siteState.activeSiteId],
    );

    const currentPreviewProduct = useMemo(() => {
        const match = /^\/produkt\/([^/?#]+)/.exec(currentPreviewPage);
        if (!match) return null;

        const slug = decodeURIComponent(match[1]);
        return featuredProducts.find((product) => product.slug === slug) || null;
    }, [currentPreviewPage, featuredProducts]);

    const loadSitePackageState = useCallback(async () => {
        if (!editor.entityId) return;

        setLoadingSitePackages(true);
        try {
            const { data: tenantRow, error: tenantError } = await supabase
                .from("tenants")
                .select("settings")
                .eq("id", editor.entityId)
                .maybeSingle();

            if (tenantError) throw tenantError;

            const settings = (tenantRow as any)?.settings || {};
            setTenantSettings(settings);

            const { data: productRows, error: productError } = await supabase
                .from("products")
                .select("id, name, slug, category, is_published, pricing_type, technical_specs")
                .eq("tenant_id", editor.entityId);

            if (productError) throw productError;

            const rows = (productRows || []) as Array<{
                id: string;
                name?: string | null;
                slug?: string | null;
                category?: string | null;
                is_published?: boolean | null;
                pricing_type?: string | null;
                technical_specs?: unknown;
            }>;
            const mappedProductIds = rows.map((row) => row.id).filter(Boolean);
            const matrixPriceReadyIds = new Set<string>();

            if (mappedProductIds.length > 0) {
                const { data: priceRows, error: priceError } = await supabase
                    .from("generic_product_prices")
                    .select("product_id")
                    .in("product_id", mappedProductIds);

                if (!priceError) {
                    (priceRows || []).forEach((row: any) => {
                        if (row?.product_id) matrixPriceReadyIds.add(row.product_id);
                    });
                }
            }

            const nextStats: Record<string, SiteReadinessStats> = Object.fromEntries(
                SITE_PACKAGES.map((sitePackage) => [sitePackage.id, { ...EMPTY_SITE_READINESS }]),
            );

            const nextMappingProducts: SiteMappingProduct[] = rows
                .map((product) => {
                    const isSpecialPricing = product.pricing_type === "STORFORMAT" || product.pricing_type === "MACHINE_PRICED";
                    return {
                        id: product.id,
                        name: product.name || "Unavngivet produkt",
                        slug: product.slug || product.id,
                        category: product.category || null,
                        is_published: product.is_published,
                        pricing_type: product.pricing_type || null,
                        technical_specs: product.technical_specs,
                        priceReady: isSpecialPricing || matrixPriceReadyIds.has(product.id),
                    };
                })
                .sort((a, b) => {
                    const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""), "da");
                    if (categoryCompare !== 0) return categoryCompare;
                    return a.name.localeCompare(b.name, "da");
                });

            nextMappingProducts.forEach((product) => {
                const siteIds = readProductSiteIds(product.technical_specs);
                const siteModes = readProductSiteModes(product.technical_specs);
                const hasExplicitModes = Boolean(siteModes.designerMode && siteModes.pricingModel);
                const specs = product.technical_specs as any;
                const siteFrontends = specs?.site_frontends || {};
                const isSiteOnly =
                    siteFrontends.site_only === true
                    || siteFrontends.siteOnly === true
                    || siteFrontends.catalog_scope === "site_only"
                    || siteFrontends.catalogScope === "site_only"
                    || siteFrontends.visibility === "site_only";

                siteIds.forEach((siteId) => {
                    if (!nextStats[siteId]) return;
                    nextStats[siteId] = {
                        mapped: nextStats[siteId].mapped + 1,
                        published: nextStats[siteId].published + (product.is_published ? 1 : 0),
                        priceReady: nextStats[siteId].priceReady + (product.priceReady ? 1 : 0),
                        siteOnly: nextStats[siteId].siteOnly + (isSiteOnly ? 1 : 0),
                        modeReady: nextStats[siteId].modeReady + (hasExplicitModes ? 1 : 0),
                        modeNeedsReview: nextStats[siteId].modeNeedsReview + (hasExplicitModes ? 0 : 1),
                    };
                });
            });

            setSiteMappingProducts(nextMappingProducts);
            setSiteReadinessById(nextStats);
        } catch (error) {
            console.error("Could not load site package state:", error);
            toast.error("Kunne ikke hente shop type-status");
        } finally {
            setLoadingSitePackages(false);
        }
    }, [editor.entityId]);

    useEffect(() => {
        loadSitePackageState();
    }, [loadSitePackageState]);

    const persistTenantSiteSettings = useCallback(async (nextSettings: any) => {
        if (!editor.entityId) return false;

        const { error } = await supabase
            .from("tenants" as any)
            .update({ settings: nextSettings })
            .eq("id", editor.entityId);

        if (error) {
            console.error("Could not save site package settings:", error);
            toast.error("Kunne ikke gemme shop type");
            return false;
        }

        setTenantSettings(nextSettings);
        return true;
    }, [editor.entityId]);

    const handleActivateSitePackage = useCallback(async (sitePackage: SitePackage) => {
        setWorkingSiteId(sitePackage.id);
        try {
            const nextSettings = mergeSiteFrontendState(tenantSettings, {
                activeSiteId: sitePackage.id,
            });
            const saved = await persistTenantSiteSettings(nextSettings);
            if (!saved) return;

            editor.updateDraft({
                themeSettings: {
                    ...(editor.draft.themeSettings || {}),
                    activeSiteId: sitePackage.id,
                },
            });
            toast.success(`${sitePackage.name} er valgt som aktiv shop type`);
        } finally {
            setWorkingSiteId(null);
        }
    }, [editor, persistTenantSiteSettings, tenantSettings]);

    const handleInstallSitePackage = useCallback(async (sitePackage: SitePackage) => {
        if (!editor.entityId) return;

        setWorkingSiteId(sitePackage.id);
        try {
            const summary = await installSitePackageTemplates({
                sitePackage,
                tenantId: editor.entityId,
            });

            const installedSiteIds = Array.from(new Set([...siteState.installedSiteIds, sitePackage.id]));
            const lastInstallBySite = {
                ...siteState.lastInstallBySite,
                [sitePackage.id]: {
                    ...summary,
                    installedAt: new Date().toISOString(),
                },
            };
            const nextSettings = mergeSiteFrontendState(tenantSettings, {
                installedSiteIds,
                activeSiteId: siteState.activeSiteId || sitePackage.id,
                lastInstallBySite,
            });

            const saved = await persistTenantSiteSettings(nextSettings);
            if (!saved) return;

            toast.success(`${sitePackage.name}: ${summary.inserted} nye bibliotekselementer installeret`);
            await loadSitePackageState();
        } catch (error: any) {
            console.error("Could not install site package:", error);
            toast.error(error?.message || "Kunne ikke installere shop type");
        } finally {
            setWorkingSiteId(null);
        }
    }, [
        editor.entityId,
        loadSitePackageState,
        persistTenantSiteSettings,
        siteState.activeSiteId,
        siteState.installedSiteIds,
        siteState.lastInstallBySite,
        tenantSettings,
    ]);

    const handleToggleProductSiteMapping = useCallback(async (
        product: SiteMappingProduct,
        sitePackage: SitePackage,
        checked: boolean,
    ) => {
        if (!editor.entityId) return;

        const existingSiteIds = readProductSiteIds(product.technical_specs);
        const nextSiteIds = checked
            ? Array.from(new Set([...existingSiteIds, sitePackage.id]))
            : existingSiteIds.filter((siteId) => siteId !== sitePackage.id);
        const nextSpecs = checked
            ? writeProductSiteIds(product.technical_specs, nextSiteIds)
            : removeProductSiteAssignment(product.technical_specs, sitePackage.id);

        setWorkingSiteId(`${sitePackage.id}:${product.id}`);
        try {
            const { error } = await supabase
                .from("products")
                .update({ technical_specs: nextSpecs })
                .eq("id", product.id)
                .eq("tenant_id", editor.entityId);

            if (error) throw error;

            setSiteMappingProducts((current) =>
                current.map((candidate) =>
                    candidate.id === product.id
                        ? { ...candidate, technical_specs: nextSpecs }
                        : candidate
                )
            );
            toast.success(
                checked
                    ? `${product.name} er tilføjet til ${sitePackage.name}`
                    : `${product.name} er fjernet fra ${sitePackage.name}`,
            );
            await loadSitePackageState();
        } catch (error: any) {
            console.error("Could not update product site mapping:", error);
            toast.error(error?.message || "Kunne ikke opdatere produktmapping");
        } finally {
            setWorkingSiteId(null);
        }
    }, [editor.entityId, loadSitePackageState]);

    const handleUpdateProductSiteModes = useCallback(async (
        product: SiteMappingProduct,
        patch: Partial<ProductSiteModes>,
    ) => {
        if (!editor.entityId) return;

        const nextSpecs = writeProductSiteModes(product.technical_specs, patch);
        setWorkingSiteId(`mode:${product.id}`);

        try {
            const { error } = await supabase
                .from("products")
                .update({ technical_specs: nextSpecs })
                .eq("id", product.id)
                .eq("tenant_id", editor.entityId);

            if (error) throw error;

            setSiteMappingProducts((current) =>
                current.map((candidate) =>
                    candidate.id === product.id
                        ? { ...candidate, technical_specs: nextSpecs }
                        : candidate
                )
            );
            toast.success(`${product.name}: flowklassifikation opdateret`);
            await loadSitePackageState();
        } catch (error: any) {
            console.error("Could not update product site modes:", error);
            toast.error(error?.message || "Kunne ikke opdatere produktets flow");
        } finally {
            setWorkingSiteId(null);
        }
    }, [editor.entityId, loadSitePackageState]);

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
        if (activeSection === "produktvalgknapper") {
            setProductPricingPreview(current => current?.isDirty ? current : null);
        }
        setActiveSection(null);
        setFocusedBlockId(null);
        setFocusedTargetId(null);
        setContextualEditor(null);
        setClearSelectionSignal(prev => prev + 1);
    }, [activeSection]);

    useEffect(() => {
        if (!activeSection || !focusedTargetId) return;

        const timeoutId = window.setTimeout(() => {
            const sharedPrintText = Boolean(getPrintDesignPreset(editor.draft.themeId)) && editor.draft.hero.textSource !== 'slides';
            const targetId = sharedPrintText && focusedTargetId === 'site-design-focus-banner-title' ? 'sd-hero-title'
                : sharedPrintText && focusedTargetId === 'site-design-focus-banner-subtitle' ? 'sd-hero-subtitle' : focusedTargetId;
            const element = document.getElementById(targetId);
            if (!element) return;
            const details = element.closest('details');
            if (details) details.open = true;

            const inspector = element.closest('.sd-workspace-inspector-content');
            if (inspector && getComputedStyle(inspector).overflowY === 'auto') {
                inspector.scrollTo({ top: inspector.scrollTop + element.getBoundingClientRect().top - inspector.getBoundingClientRect().top - 24, behavior: 'smooth' });
            } else {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            element.classList.add("ring-2", "ring-primary", "ring-offset-2");

            window.setTimeout(() => {
                element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
            }, 1800);
        }, 120);

        return () => window.clearTimeout(timeoutId);
    }, [activeSection, focusedTargetId, focusRequestId, editor.draft.themeId, editor.draft.hero.textSource]);

    useEffect(() => {
        if (!previewEditMode) {
            setContextualEditor(null);
        }
    }, [previewEditMode]);

    useEffect(() => {
        setContextualEditor(null);
    }, [currentPreviewPage]);

    // Only this workspace's iframe may select controls or change preview navigation.
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const iframe = workspaceRef.current?.querySelector<HTMLIFrameElement>('iframe[title="Branding Preview"]');
            if (event.origin !== window.location.origin || !iframe?.contentWindow || event.source !== iframe.contentWindow) return;

            if (event.data?.type === 'FEATURED_PRODUCT_SELECTED' && typeof event.data.slideId === 'string') {
                const config = editor.draft.forside.productsSection.featuredProductConfig;
                if (getFeaturedSlides(config).some(slide => slide.id === event.data.slideId)) setSelectedFeaturedSlideId(event.data.slideId);
            }
            if (
                isSiteDesignSelectionMessage(event.data)
                || event.data?.type === 'EDIT_SECTION'
                || event.data?.type === 'ELEMENT_CLICKED'
            ) {
                if (previewEditMode) {
                    console.log('[Editor] Opening section:', event.data?.sectionId);
                    openPreviewSelection(event.data?.sectionId);
                }
            }

            if (event.data?.type === 'PREVIEW_PAGE_CHANGED' || event.data?.type === 'PREVIEW_NAVIGATION') {
                const path = typeof event.data.path === 'string' ? event.data.path : '/';
                setCurrentPreviewPage(path);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [openPreviewSelection, previewEditMode, editor.draft.forside.productsSection.featuredProductConfig]);

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



    // Capture and upload a thumbnail from the preview iframe
    const capturePreviewThumbnail = useCallback(async (): Promise<string | null> => {
        setCapturingThumbnail(true);
        try {
            // Find the preview iframe
            const iframe = workspaceRef.current?.querySelector<HTMLIFrameElement>('iframe[title="Branding Preview"]');
            if (!iframe || !iframe.contentWindow) {
                console.warn('Preview iframe not found');
                return null;
            }

            const dataUrl = await requestPreviewScreenshot({
                target: iframe.contentWindow,
                host: window,
                origin: window.location.origin,
            });
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



    const navigatePreviewTo = useCallback((path: string) => {
        setCurrentPreviewPage(path);
        setPreviewNavigationRequest({
            id: Date.now(),
            type: "path",
            path,
        });
    }, []);

    const navigatePreviewToProduct = useCallback((slug: string) => {
        const productPath = `/produkt/${encodeURIComponent(slug)}`;
        setCurrentPreviewPage(productPath);
        setPreviewNavigationRequest({
            id: Date.now(),
            type: "path",
            path: productPath,
        });
    }, []);

    const lastOrderPreviewProduct = useRef<string | null>(null);
    useEffect(() => {
        if (currentPreviewProduct?.slug) lastOrderPreviewProduct.current = currentPreviewProduct.slug;
    }, [currentPreviewProduct?.slug]);

    const navigatePreviewToOrderStep = (page: OrderFlowPage) => {
        const slug = currentPreviewProduct?.slug || lastOrderPreviewProduct.current || featuredProducts.find(item => item.slug)?.slug;
        if (page === 'calculator' && !slug) {
            setPreviewNavigationRequest({ id: Date.now(), type: 'first-product' });
        } else {
            navigatePreviewTo(getOrderFlowPreviewPath(page, slug));
        }
    };

    const previewPathname = getSiteDesignPreviewPathname(currentPreviewPage);
    const isHomePreviewPage = previewPathname === "/"
        || previewPathname === "/shop"
        || previewPathname === "/produkter"
        || previewPathname === "/prisberegner";
    const isProductPreviewPage = previewPathname === "/produkt" || previewPathname.startsWith("/produkt/");
    const isCheckoutPreviewPage = previewPathname === "/checkout";

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

    const currentPreviewPageTypeLabel = isCheckoutPreviewPage
        ? "Checkout"
        : isProductPreviewPage
        ? "Produktside"
        : isHomePreviewPage
            ? "Forside / katalog"
            : "Indholdsside";

    const allowedSections = useMemo(() => {
        const sections = new Set<string>(["shop-layout", "site-package", "theme", "products", "featured-products", "order-flow", "main-buttons"]);
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
            sections.add("lower-info");
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

        if (isCheckoutPreviewPage) {
            sections.add("product-page-matrix");
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
        isCheckoutPreviewPage,
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
        if (!productPricingPreview?.productId || !productPricingPreview.isDirty) return true;
        const submitted = productPricingPreview;
        try {
            const pricingStructure = await persistProductStylingPatches(supabase, editor.entityId, submitted.productId, submitted.patches);
            const saved = { ...submitted, pricingStructure, isDirty: false };
            setProductPricingPreview(current => {
                if (current?.productId !== submitted.productId) return current;
                return mergeProductStylingChange(current, saved);
            });
            setPersistedProductPricing(saved);
            return true;
        } catch (error) {
            console.error('Error saving tenant-owned Produktvalgknapper settings:', error);
            toast.error('Kunne ikke gemme produktvalg-indstillinger');
            return false;
        }
    }, [editor.entityId, productPricingPreview]);

    const handleProductOptionPricingStructureChange = useCallback((change: ProductStylingChange | null) => {
        if (!change) return;
        setProductPricingPreview(current => !change.isDirty && current && current.productId !== change.productId
            ? current : mergeProductStylingChange(current, change));
        if (!change.isDirty && change.patches.length) setPersistedProductPricing(change);
    }, []);

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
            case 'main-buttons':
                return <MainButtonsControls draft={editor.draft} updateDraft={editor.updateDraft} designDefaults={(() => {
                    const preset = VISUAL_THEME_PRESETS.find(item => item.id === String(editor.draft.themeSettings.visualThemePresetId || editor.draft.themeId));
                    if (preset) return { ...DEFAULT_BRANDING, ...buildVisualThemePresetPatch(DEFAULT_BRANDING, preset) };
                    if (getPrintDesignPreset(editor.draft.themeId)) {
                        const base = applyPrintDesignPreset(DEFAULT_BRANDING, editor.draft.themeId);
                        return { ...base, ...applyMainButtonSettings(base, { bgColor: '#087FC5', hoverBgColor: '#066BA8', textColor: '#FFFFFF', radiusPx: 6, fontSizePx: 16, paddingYPx: 14 }) };
                    }
                    return DEFAULT_BRANDING;
                })()} />;
            case 'shop-layout': {
                const selectedTemplateId = resolveStorefrontLayout(
                    editor.draft.forside?.layout,
                ).templateId;
                const selectedNavigationPreset = resolveDropdownPreset(editor.draft.header?.dropdownPreset);

                const applyShopTemplate = (template: ShopTemplateDefinition) => {
                    const currentForside = editor.draft.forside || DEFAULT_BRANDING.forside;
                    const currentProducts = currentForside.productsSection
                        || DEFAULT_BRANDING.forside.productsSection;
                    const currentFeatured = currentProducts.featuredProductConfig
                        || DEFAULT_BRANDING.forside.productsSection.featuredProductConfig;

                    editor.updateDraft({
                        header: {
                            ...editor.draft.header,
                            transparentOverHero: template.layout.sectionOrder[0] === "hero",
                            alignment: template.recipe.header.alignment,
                            height: template.recipe.header.height,
                            style: template.recipe.header.style,
                            dropdownPreset: resolveDropdownPreset(editor.draft.header?.dropdownPreset),
                        },
                        footer: {
                            ...editor.draft.footer,
                            style: template.recipe.footer,
                        },
                        forside: {
                            ...currentForside,
                            layout: {
                                ...template.layout,
                                sectionOrder: [...template.layout.sectionOrder],
                            },
                            productsSection: {
                                ...currentProducts,
                                columns: template.productDefaults.columns,
                                layoutStyle: template.productDefaults.layoutStyle,
                                featuredProductConfig: {
                                    ...currentFeatured,
                                    position: template.productDefaults.featuredPosition,
                                    productSide: template.productDefaults.featuredProductSide,
                                },
                            },
                        },
                    });

                    toast.success(`${template.name} er anvendt. Produkter og brandindhold er bevaret.`);
                };

                return (
                    <ShopTemplatePicker
                        selectedTemplateId={selectedTemplateId}
                        selectedNavigationPreset={selectedNavigationPreset}
                        onSelect={applyShopTemplate}
                        onNavigationPresetChange={(dropdownPreset) => {
                            editor.updateDraft({
                                header: {
                                    ...editor.draft.header,
                                    dropdownPreset,
                                },
                            });
                        }}
                        onClose={closeSection}
                    />
                );
            }
            case 'site-package': {
                const previewSite = (sitePackage: SitePackage) => {
                    const url = buildPreviewShopUrl({
                        tenantId: editor.entityId,
                        siteId: sitePackage.id,
                        sitePreviewMode: true,
                        page: "/",
                    });
                    window.open(url, "_blank");
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Shop type</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                        </div>

                        <Card>
                            <CardHeader className="space-y-1 p-3">
                                <div className="flex items-center gap-2">
                                    <Store className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-sm">Aktiv shop</CardTitle>
                                </div>
                                <CardDescription className="text-[11px] leading-4">
                                    Shop typen bestemmer koncept, produktfiltrering, templates og senere designer-flow. Farver og temaer bevares separat.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 p-3 pt-0">
                                {activeSitePackage ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge className="gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {activeSitePackage.name}
                                        </Badge>
                                        <Badge variant="outline" className="font-normal">
                                            {activeSitePackage.recommendedThemeId || "classic"}
                                        </Badge>
                                    </div>
                                ) : (
                                    <Badge variant="outline" className="font-normal">Ingen shop type valgt</Badge>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    Brug preview for at prøve et site uden at gøre det aktivt. Aktivér skifter kun shop type, ikke produkter eller priser.
                                </p>
                            </CardContent>
                        </Card>

                        {loadingSitePackages ? (
                            <div className="flex items-center justify-center rounded-lg border py-8 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Henter shop typer...
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {SITE_PACKAGE_GROUPS.map((group) => {
                                    const packages = group.siteIds
                                        .map((siteId) => SITE_PACKAGES.find((sitePackage) => sitePackage.id === siteId))
                                        .filter((sitePackage): sitePackage is SitePackage => Boolean(sitePackage));

                                    if (packages.length === 0) return null;

                                    return (
                                        <div key={group.id} className="space-y-2">
                                            <div className="px-1">
                                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {group.label}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {group.description}
                                                </div>
                                            </div>

                                            <div className="grid gap-2">
                                                {packages.map((sitePackage) => {
                                                    const isActive = siteState.activeSiteId === sitePackage.id;
                                                    const isInstalled = siteState.installedSiteIds.includes(sitePackage.id);
                                                    const stats = siteReadinessById[sitePackage.id] || EMPTY_SITE_READINESS;
                                                    const isWorking = workingSiteId === sitePackage.id;
                                                    const hasMappedProducts = stats.mapped > 0;
                                                    const previewUrl = buildPreviewShopUrl({
                                                        tenantId: editor.entityId,
                                                        siteId: sitePackage.id,
                                                        sitePreviewMode: true,
                                                        page: "/",
                                                    });
                                                    const assignedProducts = siteMappingProducts.filter((product) =>
                                                        readProductSiteIds(product.technical_specs).includes(sitePackage.id),
                                                    );

                                                    return (
                                                        <Card
                                                            key={sitePackage.id}
                                                            className={isActive ? "border-primary bg-primary/5" : "bg-background"}
                                                        >
                                                            <CardContent className="space-y-3 p-3">
                                                                <div className="flex items-start gap-2">
                                                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                                        {sitePackage.tags.includes("storformat") || sitePackage.tags.includes("signage") ? (
                                                                            <Globe className="h-4 w-4" />
                                                                        ) : sitePackage.tags.includes("apparel") ? (
                                                                            <Layers3 className="h-4 w-4" />
                                                                        ) : (
                                                                            <Store className="h-4 w-4" />
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <p className="truncate text-sm font-semibold">{sitePackage.name}</p>
                                                                            {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                                                                        </div>
                                                                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                                                                            {sitePackage.description}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                                                                    <div className="rounded border bg-muted/30 px-2 py-1">
                                                                        <span className="text-muted-foreground">Produkter</span>
                                                                        <span className="ml-1 font-semibold">{stats.mapped}</span>
                                                                    </div>
                                                                    <div className="rounded border bg-muted/30 px-2 py-1">
                                                                        <span className="text-muted-foreground">Publiceret</span>
                                                                        <span className="ml-1 font-semibold">{stats.published}</span>
                                                                    </div>
                                                                    <div className="rounded border bg-muted/30 px-2 py-1">
                                                                        <span className="text-muted-foreground">Pris-klar</span>
                                                                        <span className="ml-1 font-semibold">{stats.priceReady}</span>
                                                                    </div>
                                                                    <div className="rounded border bg-muted/30 px-2 py-1">
                                                                        <span className="text-muted-foreground">Flow sat</span>
                                                                        <span className="ml-1 font-semibold">{stats.modeReady}</span>
                                                                    </div>
                                                                    <div className="rounded border bg-muted/30 px-2 py-1">
                                                                        <span className="text-muted-foreground">Tjek</span>
                                                                        <span className="ml-1 font-semibold">{stats.modeNeedsReview}</span>
                                                                    </div>
                                                                    <div className="rounded border bg-muted/30 px-2 py-1">
                                                                        <span className="text-muted-foreground">Bibliotek</span>
                                                                        <span className="ml-1 font-semibold">{isInstalled ? "Ja" : "Nej"}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-1">
                                                                    {sitePackage.tags.slice(0, 4).map((tag) => (
                                                                        <Badge key={tag} variant="outline" className="h-5 rounded-sm px-1.5 text-[10px] font-normal">
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                </div>

                                                                {!hasMappedProducts && (
                                                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                                                                        Ingen produkter er knyttet til denne shop type endnu.
                                                                    </div>
                                                                )}

                                                                {hasMappedProducts && stats.modeNeedsReview > 0 && (
                                                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-900">
                                                                        {stats.modeNeedsReview} produkter bruger auto-forslag til designer/pris-flow. Gennemgå dem før demo eller kundebrug.
                                                                    </div>
                                                                )}

                                                                <details className="rounded-md border bg-muted/10">
                                                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-semibold text-foreground">
                                                                        <span>Administrer produkter</span>
                                                                        <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[10px] font-normal">
                                                                            {assignedProducts.length} valgt
                                                                        </Badge>
                                                                    </summary>
                                                                    <div className="max-h-60 space-y-1 overflow-y-auto border-t p-2">
                                                                        {siteMappingProducts.length === 0 ? (
                                                                            <p className="px-1 py-2 text-[11px] text-muted-foreground">
                                                                                Ingen produkter fundet i denne tenant.
                                                                            </p>
                                                                        ) : (
                                                                            siteMappingProducts.map((product) => {
                                                                                const productSiteIds = readProductSiteIds(product.technical_specs);
                                                                                const checked = productSiteIds.includes(sitePackage.id);
                                                                                const productWorking = workingSiteId === `${sitePackage.id}:${product.id}`;
                                                                                const productModeWorking = workingSiteId === `mode:${product.id}`;
                                                                                const resolvedModes = resolveProductSiteModes(product);
                                                                                return (
                                                                                    <div
                                                                                        key={product.id}
                                                                                        className={`flex items-start gap-2 rounded-md border px-2 py-2 transition ${checked ? "border-primary/50 bg-primary/5" : "border-transparent bg-background hover:border-border"}`}
                                                                                    >
                                                                                        <Checkbox
                                                                                            checked={checked}
                                                                                            disabled={productWorking}
                                                                                            onCheckedChange={(value) =>
                                                                                                handleToggleProductSiteMapping(product, sitePackage, value === true)
                                                                                            }
                                                                                            className="mt-0.5 cursor-pointer"
                                                                                        />
                                                                                        <div className="min-w-0 flex-1">
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <span className="truncate text-[11px] font-medium">
                                                                                                    {product.name}
                                                                                                </span>
                                                                                                {(productWorking || productModeWorking) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                                                            </div>
                                                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                                                {product.category && (
                                                                                                    <Badge variant="outline" className="h-4 rounded-sm px-1 text-[9px] font-normal">
                                                                                                        {product.category}
                                                                                                    </Badge>
                                                                                                )}
                                                                                                <Badge
                                                                                                    variant={product.is_published ? "secondary" : "outline"}
                                                                                                    className="h-4 rounded-sm px-1 text-[9px] font-normal"
                                                                                                >
                                                                                                    {product.is_published ? "Publiceret" : "Ikke publiceret"}
                                                                                                </Badge>
                                                                                                <Badge
                                                                                                    variant={product.priceReady ? "secondary" : "outline"}
                                                                                                    className="h-4 rounded-sm px-1 text-[9px] font-normal"
                                                                                                >
                                                                                                    {product.priceReady ? "Pris klar" : "Mangler pris"}
                                                                                                </Badge>
                                                                                                <Badge
                                                                                                    variant={resolvedModes.source === "explicit" ? "secondary" : "outline"}
                                                                                                    className="h-4 rounded-sm px-1 text-[9px] font-normal"
                                                                                                >
                                                                                                    {resolvedModes.source === "explicit" ? "Flow sat" : "Auto forslag"}
                                                                                                </Badge>
                                                                                            </div>
                                                                                            {checked && (
                                                                                                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                                                                                    <Select
                                                                                                        value={resolvedModes.designerMode || "flat_print"}
                                                                                                        disabled={productWorking || productModeWorking}
                                                                                                        onValueChange={(value) =>
                                                                                                            handleUpdateProductSiteModes(product, {
                                                                                                                designerMode: value as ProductDesignerMode,
                                                                                                                pricingModel: resolvedModes.pricingModel,
                                                                                                            })
                                                                                                        }
                                                                                                    >
                                                                                                        <SelectTrigger className="h-7 rounded-md bg-background px-2 text-[10px]">
                                                                                                            <SelectValue placeholder="Designer-flow" />
                                                                                                        </SelectTrigger>
                                                                                                        <SelectContent>
                                                                                                            {PRODUCT_DESIGNER_MODE_OPTIONS.map((option) => (
                                                                                                                <SelectItem key={option.value} value={option.value}>
                                                                                                                    {option.label}
                                                                                                                </SelectItem>
                                                                                                            ))}
                                                                                                        </SelectContent>
                                                                                                    </Select>
                                                                                                    <Select
                                                                                                        value={resolvedModes.pricingModel || "matrix"}
                                                                                                        disabled={productWorking || productModeWorking}
                                                                                                        onValueChange={(value) =>
                                                                                                            handleUpdateProductSiteModes(product, {
                                                                                                                designerMode: resolvedModes.designerMode,
                                                                                                                pricingModel: value as ProductPricingModel,
                                                                                                            })
                                                                                                        }
                                                                                                    >
                                                                                                        <SelectTrigger className="h-7 rounded-md bg-background px-2 text-[10px]">
                                                                                                            <SelectValue placeholder="Pris-model" />
                                                                                                        </SelectTrigger>
                                                                                                        <SelectContent>
                                                                                                            {PRODUCT_PRICING_MODEL_OPTIONS.map((option) => (
                                                                                                                <SelectItem key={option.value} value={option.value}>
                                                                                                                    {option.label}
                                                                                                                </SelectItem>
                                                                                                            ))}
                                                                                                        </SelectContent>
                                                                                                    </Select>
                                                                                                </div>
                                                                                            )}
                                                                                            {!checked && (
                                                                                                <p className="mt-1 text-[10px] text-muted-foreground">
                                                                                                    Foreslået: {getProductDesignerModeLabel(resolvedModes.designerMode)} / {getProductPricingModelLabel(resolvedModes.pricingModel)}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </div>
                                                                </details>

                                                                <div className="grid grid-cols-3 gap-1.5">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 gap-1 px-2 text-[11px]"
                                                                        onClick={() => previewSite(sitePackage)}
                                                                        title={previewUrl}
                                                                    >
                                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                                        Preview
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 gap-1 px-2 text-[11px]"
                                                                        onClick={() => handleInstallSitePackage(sitePackage)}
                                                                        disabled={isWorking}
                                                                    >
                                                                        {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackagePlus className="h-3.5 w-3.5" />}
                                                                        Installér
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 gap-1 px-2 text-[11px]"
                                                                        onClick={() => handleActivateSitePackage(sitePackage)}
                                                                        disabled={isWorking || isActive}
                                                                    >
                                                                        {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                                        {isActive ? "Aktiv" : "Aktivér"}
                                                                    </Button>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }
            case 'order-flow':
                return <OrderFlowDesignInspector branding={editor.draft}
                    page={getOrderFlowPreviewPage(currentPreviewPage) || 'calculator'}
                    onPageChange={navigatePreviewToOrderStep} onChange={(page, design) => {
                    editor.updateDraft(applyOrderFlowDesign(editor.draft, page, design));
                    if (getOrderFlowPreviewPage(currentPreviewPage) !== page) navigatePreviewToOrderStep(page);
                }} />;
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
                        <PrintDesignPicker compact value={editor.draft.themeId} presentation={editor.draft.forside.productsSection.presentation} onChange={(id) => {
                            editor.updateDraft(selectPrintDesignPreset(editor.draft, id));
                            navigatePreviewTo('/');
                            toast.success("Shopdesign anvendt i kladden");
                        }} />
                        <details className="rounded-lg border p-3">
                            <summary className="cursor-pointer text-xs font-medium">Tidligere temaer og effekter</summary>
                            <div className="mt-3 space-y-3">
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-2.5 pb-0">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-sm">Komplette visuelle presets</CardTitle>
                                </div>
                                <CardDescription className="text-[11px] leading-4 text-muted-foreground">
                                    25 Taste-temaer plus eksisterende presets. Skifter farver, flader, radius, dropdown, hero-effekter, produktknapper, matrix og prisboks samlet.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-2 p-2.5 pt-2">
                                {VISUAL_THEME_PRESETS.map((preset) => {
                                    const isSelected = activeVisualThemePresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            title={preset.description}
                                            className={`min-h-[76px] rounded-md border p-2 text-left transition hover:border-primary/60 hover:bg-muted/30 ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/70 bg-background"}`}
                                            onClick={() => applyVisualThemePreset(preset)}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-4">{preset.name}</span>
                                                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                                            </div>
                                            <div className="mt-1.5 flex h-4 overflow-hidden rounded border">
                                                {BRANDING_COLOR_KEYS.slice(0, 7).map((key) => (
                                                    <span
                                                        key={key}
                                                        className="flex-1"
                                                        style={{ backgroundColor: preset.colors[key] }}
                                                        title={`${key}: ${preset.colors[key]}`}
                                                    />
                                                ))}
                                            </div>
                                            <div className="mt-1.5 flex min-w-0 gap-1 overflow-hidden">
                                                {preset.tags.slice(0, 2).map((tag) => (
                                                    <Badge key={tag} variant="outline" className="h-4 max-w-[72px] truncate rounded-sm px-1 text-[9px] uppercase">
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
                                const matchingPreset = VISUAL_THEME_PRESETS.find((preset) => preset.id === themeId);
                                if (matchingPreset) {
                                    editor.updateDraft(buildVisualThemePresetPatch(editor.draft, matchingPreset));
                                    toast.success(`${matchingPreset.name} anvendt på hele designet`);
                                    return;
                                }

                                editor.updateDraft({
                                    themeId,
                                    themeSettings: {
                                        ...(editor.draft.themeSettings || {}),
                                        visualStyleId: themeId,
                                        visualThemePresetId: themeId,
                                    },
                                });
                            }}
                            themeSettings={editor.draft.themeSettings}
                            compact
                            onThemeSettingsChange={(themeSettings) => {
                                editor.updateDraft({ themeSettings });
                            }}
                        />
                            </div>
                        </details>
                    </div>
                );
            }
            case 'logo':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Logo & Favicon</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId === "site-design-focus-logo" && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <LogoSection
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

                        {/* Favicon Editor */}
                        {focusedTargetId !== "site-design-focus-logo" && (
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
                        )}
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
                        <HeaderQuickControls draft={editor.draft} updateDraft={editor.updateDraft} />
                        <details className="sd-banner-details" open={Boolean(focusedTargetId)} key={focusedTargetId || 'header-details'}>
                            <summary>Menulayout, links og detaljer</summary>
                        <HeaderSection
                            header={editor.draft.header}
                            dropdownColorsCustomized={Boolean(editor.draft.themeSettings?.dropdownColorsCustomized)}
                            primaryColor={editor.draft.colors.primary}
                            onChange={(header) => editor.updateDraft({ header, themeSettings: { ...editor.draft.themeSettings, dropdownColorsCustomized: editor.draft.themeSettings?.dropdownColorsCustomized || menuColorsChanged(editor.draft.header, header) } })}
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
                        </details>
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
                        <HeroQuickControls draft={editor.draft} updateDraft={editor.updateDraft} />
                        <details className="sd-banner-details" open={Boolean(focusedTargetId) && !(getPrintDesignPreset(editor.draft.themeId) && editor.draft.hero.textSource !== 'slides' && ['site-design-focus-banner-title', 'site-design-focus-banner-subtitle'].includes(focusedTargetId!))}>
                            <summary>Billeder, video og detaljer</summary>
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
                        </details>
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
            case 'lower-info':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Nedre infobokse</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-lower-info") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <LowerInfoSection
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
            case 'featured-products': {
                const productsSection = editor.draft.forside.productsSection;
                const config = productsSection.featuredProductConfig;
                return <FeaturedProductInspector config={config} products={featuredProducts}
                    selectedSlideId={selectedFeaturedSlideId} onSelectSlide={setSelectedFeaturedSlideId}
                    onChange={featuredProductConfig => editor.updateDraft({ forside: { ...editor.draft.forside, productsSection: { ...productsSection, featuredProductConfig } } })}
                    disabled={!productsSection.enabled} loadingProducts={loadingFeaturedProducts}
                    printDesign={Boolean(getPrintDesignPreset(editor.draft.themeId))}
                    primaryColor={editor.draft.colors.primary || '#0EA5E9'}
                    backgroundColor={editor.draft.themeId === 'print-nordic' ? '#f4f7f9' : editor.draft.themeId === 'print-product' ? '#f0f6fc' : '#ffffff'}
                    titleColor={editor.draft.colors.headingText || '#0b1933'} bodyColor={editor.draft.colors.bodyText || '#4b5565'}
                    buttonFontSize={productsSection.button.fontSizePx || 16} buttonPadding={productsSection.button.paddingYPx || 12}
                    focusTarget={focusedTargetId} uploadImage={uploadFeaturedMainImage} uploading={uploadingFeaturedMainImage}
                />;
            }
            case 'products': {
                const forside = editor.draft.forside;
                const productsSection = forside.productsSection || DEFAULT_BRANDING.forside.productsSection;
                const layoutStyle = productsSection.layoutStyle || 'cards';
                const isPrintDesign = Boolean(getPrintDesignPreset(editor.draft.themeId));
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

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Forside og produktoversigt</h3>
                            <div className="flex items-center gap-2">
                                {focusedTargetId?.startsWith("site-design-focus-products") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>
                        <Card>
                            <CardContent className="space-y-4 pt-5">
                                <ProductPresentationPicker value={productsSection.presentation} onChange={(presentation) => {
                                    const updated = applyProductPresentation(editor.draft, presentation);
                                    editor.updateDraft({ forside: updated.forside });
                                    if (!isHomePreviewPage) navigatePreviewTo('/produkter');
                                }} />
                                {resolveProductPresentation(productsSection.presentation) !== 'standard' && <div className="space-y-4 border-t pt-4">
                                    <div className="flex items-center justify-between gap-3"><Label htmlFor="product-presentation-enabled">Vis produkter på forsiden</Label><Switch id="product-presentation-enabled" checked={productsSection.enabled} onCheckedChange={checked => updateProductsSection({ enabled: checked })} /></div>
                                    <div className="space-y-2"><Label htmlFor="product-presentation-title">Overskrift</Label><Input id="product-presentation-title" value={productsSection.presentationTitle || ''} placeholder={PRODUCT_PRESENTATIONS.find(item => item.id === productsSection.presentation)?.title} onChange={event => updateProductsSection({ presentationTitle: event.target.value })} /></div>
                                    <div className="space-y-2"><Label htmlFor="product-presentation-subtitle">Undertekst</Label><Input id="product-presentation-subtitle" value={productsSection.presentationSubtitle || ''} placeholder="Vælg et produkt. Gør det til dit eget." onChange={event => updateProductsSection({ presentationSubtitle: event.target.value })} /></div>
                                    <div className="flex items-center justify-between gap-3"><Label htmlFor="product-presentation-motion">Animation ved hover og tastaturfokus</Label><Switch id="product-presentation-motion" checked={productsSection.presentationMotion !== false} onCheckedChange={checked => updateProductsSection({ presentationMotion: checked })} /></div>
                                    <p className="text-xs leading-relaxed text-muted-foreground">Visningen bruger shoppens produktbilleder og navne. Skift billeder under Produkter eller Ikoner. Kunder med reduceret bevægelse får rolige overgange.</p>
                                    <Button variant="outline" size="sm" onClick={() => navigatePreviewTo('/produkter')}>Se produktoversigten i preview</Button>
                                    <div className="sd-control-note"><p className="text-xs leading-relaxed">Det fremhævede produkt med prisberegner og billedgalleri hører til standardvisningen. De fire produktpræsentationer viser kataloget.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => editor.updateDraft({ forside: applyProductPresentation(editor.draft, 'standard').forside })}>Brug standard med fremhævet produkt</Button></div>
                                </div>}
                            </CardContent>
                        </Card>
                        {resolveProductPresentation(productsSection.presentation) === 'standard' && <>
                        <Card id="site-design-focus-products-layout">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">{isPrintDesign ? "Produktbokse i kataloget" : "Produktbokse på forsiden"}</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    {isPrintDesign ? "Kolonner og kort gælder standardkataloget. Forsidens kategorier og fremhævede produkt følger shopdesignet." : "Vælg hvor mange produktbokse der skal vises pr. række."}
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
                                    <Label>{isPrintDesign ? "Produktkort i kataloget" : "Forside produkt layout"}</Label>
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
                                <div hidden={isPrintDesign} className={isPrintDesign ? "hidden" : "flex items-center justify-between"}>
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
                                <div hidden={isPrintDesign} id="site-design-focus-products-category-tabs" className="space-y-4 border-t pt-4">
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
                                    <Button variant="outline" onClick={() => setActiveSection('featured-products')}>Redigér fremhævede produkter</Button>
                                </div>
                            </CardContent>
                        </Card>
                        </>}
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
                            <h3 className="text-sm font-medium">Fordelsbjælke</h3>
                            <div className="flex items-center gap-2">
                                {isUSPFocusMode && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFocusedSelection}>Vis alt</Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
                            </div>
                        </div>

                        {/* Enable/Disable */}
                        <div id="site-design-focus-usp-strip" className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <Label className="text-sm" htmlFor="usp-strip-visible">Vis fordelsbjælke</Label>
                            <Switch
                                id="usp-strip-visible"
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

                                <details className="sd-banner-details">
                                    <summary>Baggrund, farver og skrifttyper</summary>
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

                                </details>

                                {/* USP Items */}
                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-xs font-medium text-muted-foreground uppercase">Fordele</h4>
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
	                const applyTypographyFonts = (fonts: typeof DEFAULT_BRANDING.fonts) => {
	                    editor.updateDraft(buildFontPresetThemePatch(editor.draft, fonts));
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
                                        onChange={(v) => applyTypographyFonts({
                                            ...editor.draft.fonts,
                                            heading: v,
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
                                        onChange={(v) => applyTypographyFonts({
                                            ...editor.draft.fonts,
                                            body: v,
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
                                        onChange={(v) => applyTypographyFonts({
                                            ...editor.draft.fonts,
                                            pricing: v,
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
	                    editor.updateDraft(buildSiteColorPatch(editor.draft, preset.colors));
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
                        <div className="space-y-3 pt-2">
                            <div className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
		                                Farverne bruges på tværs af shoppen. En enkelt farve ændrer kun de tilhørende elementer. Et farvesæt erstatter alle temaets farver; indhold og layout bevares.
                            </div>
                            {!isColorsFocusMode && <SiteColorResetControls draft={editor.draft} updateDraft={editor.updateDraft} />}
                            {!isColorsFocusMode && (
                                <details className="rounded-md border">
                                    <summary className="cursor-pointer px-2.5 py-3 text-xs font-medium">Farvesæt · vælg eller gem</summary>
                                <Card className="overflow-hidden border-0 shadow-none">
                                    <CardHeader className="space-y-1 p-2.5 pb-0">
                                        <CardTitle className="text-sm">Farvesæt</CardTitle>
                                        <CardDescription className="text-[11px] leading-4 text-muted-foreground">
                                            Vælg et samlet farvesæt, eller gem de aktuelle farver til senere brug.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 p-2.5 pt-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            {colorPresets.map((preset) => (
                                                <div
                                                    key={preset.id}
                                                    className="rounded-md border bg-background p-1.5"
                                                >
                                                    <div className="flex items-start justify-between gap-1.5">
                                                        <button
                                                            type="button"
                                                            title={preset.name}
                                                            className="min-w-0 flex-1 text-left"
                                                            onClick={() => applyColorPreset(preset)}
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="truncate text-[11px] font-semibold leading-4">{preset.name}</span>
                                                                {preset.isSystem ? (
                                                                    <Badge variant="outline" className="h-4 rounded-sm px-1 text-[9px] uppercase">Demo</Badge>
                                                                ) : null}
                                                            </div>
                                                            <div className="mt-1.5 flex h-4 overflow-hidden rounded border">
                                                                {BRANDING_COLOR_KEYS.slice(0, 7).map((key) => (
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
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8"
                                                                onClick={() => applyColorPreset(preset)}
                                                                title="Brug farvesæt"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {!preset.isSystem && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => removeColorPreset(preset.id)}
                                                                    title="Slet farvesæt"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-md border border-dashed p-2">
                                            <div className="space-y-1.5">
                                                <Label className="text-[11px]">Gem aktuelle farver som preset</Label>
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
                                </details>
                            )}
                            {BRANDING_COLOR_GROUPS.map((group) => {
                                const visibleFields = group.fields.filter((field) => (
                                    !isColorsFocusMode || focusedTargetId === `site-design-focus-colors-${field.key}`
                                ));

                                if (visibleFields.length === 0) {
                                    return null;
                                }

                                return (
                                <div key={group.title} className="space-y-2 rounded-md border p-2.5">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-semibold">{group.title}</h4>
                                            {group.badge ? (
                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                                    {group.badge}
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="text-[11px] leading-4 text-muted-foreground">{group.description}</p>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-1 gap-2">
                                        {visibleFields.map((field, index) => {
                                            const value = editor.draft.colors[field.key];
                                            return (
                                                <div
                                                    key={field.key}
                                                    id={`site-design-focus-colors-${field.key}`}
                                                    className="rounded-md border border-border/50 bg-background/60 p-2"
                                                >
                                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
                                                        <div className="min-w-0 space-y-0.5 pr-1">
                                                            <p className="truncate text-xs font-medium leading-4">{field.label}</p>
                                                            <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                                                                {field.description}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <ColorPickerWithSwatches
                                                                value={value}
                                                                label={field.label}
                                                                onChange={(color) => editor.updateDraft({
                                                                    ...applySiteColor(editor.draft, field.key, color)
                                                                })}
                                                                compact={true}
                                                                showFullSwatches={false}
                                                                savedSwatches={editor.draft.savedSwatches}
                                                                onSaveSwatch={saveColorSwatch}
                                                                onRemoveSwatch={removeColorSwatch}
                                                            />
                                                            <span className="text-[10px] font-mono uppercase text-muted-foreground">
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
                const headingConfig = {
                    ...DEFAULT_BRANDING.productPage.heading,
                    ...(productPage.heading || {}),
                    subtext: {
                        ...DEFAULT_BRANDING.productPage.heading.subtext,
                        ...(productPage.heading?.subtext || {}),
                    },
                };
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
                    button: typeof orderButtons.secondary,
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
                const updateProductHeading = (updates: Omit<Partial<typeof DEFAULT_BRANDING.productPage.heading>, 'subtext'> & {
                    subtext?: Partial<typeof DEFAULT_BRANDING.productPage.heading.subtext>;
                }) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    const currentHeading = {
                        ...DEFAULT_BRANDING.productPage.heading,
                        ...(currentProductPage.heading || {}),
                        subtext: {
                            ...DEFAULT_BRANDING.productPage.heading.subtext,
                            ...(currentProductPage.heading?.subtext || {}),
                        },
                    };
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            heading: {
                                ...currentHeading,
                                ...updates,
                                subtext: updates.subtext
                                    ? {
                                        ...currentHeading.subtext,
                                        ...updates.subtext,
                                    }
                                    : currentHeading.subtext,
                            },
                        },
                    });
                };
                const updateProductHeadingSubtext = (
                    updates: Partial<typeof DEFAULT_BRANDING.productPage.heading.subtext>,
                ) => {
                    updateProductHeading({ subtext: updates });
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
                const updateOrderButtons = (
                    updates: Partial<typeof DEFAULT_BRANDING.productPage.orderButtons>,
                ) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    const currentOrderButtons = currentProductPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            orderButtons: {
                                ...currentOrderButtons,
                                ...updates,
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
                const isProductPageFocusMode = Boolean(focusedTargetId?.startsWith("site-design-focus-product-page"));
                const productPageFocusMatches = (...targetIds: string[]) => Boolean(focusedTargetId && targetIds.includes(focusedTargetId));
                const shouldShowProductPageTarget = (...targetIds: string[]) => !isProductPageFocusMode || productPageFocusMatches(...targetIds);
                const pricePanelTargetIds = [
                    "site-design-focus-product-page-price-panel",
                    "site-design-focus-product-page-price-panel-box",
                    "site-design-focus-product-page-price-panel-title",
                    "site-design-focus-product-page-price-panel-download-button",
                    "site-design-focus-product-page-price-panel-text",
                    "site-design-focus-product-page-price-panel-price",
                    "site-design-focus-product-page-price-panel-delivery-card",
                    "site-design-focus-product-page-price-panel-badge",
                ];
                const orderButtonTargetIds = [
                    "site-design-focus-product-page-order-buttons",
                    "site-design-focus-product-page-order-primary",
                    "site-design-focus-product-page-order-secondary",
                    "site-design-focus-product-page-order-selected",
                ];
                const shouldShowPricePanelPart = (...targetIds: string[]) =>
                    !isProductPageFocusMode
                    || focusedTargetId === "site-design-focus-product-page-price-panel"
                    || productPageFocusMatches(...targetIds);
                const shouldShowOrderButtonPart = (...targetIds: string[]) =>
                    !isProductPageFocusMode
                    || focusedTargetId === "site-design-focus-product-page-order-buttons"
                    || productPageFocusMatches(...targetIds);

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
                        {shouldShowProductPageTarget("site-design-focus-product-page-heading") && (
                        <Card id="site-design-focus-product-page-heading">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Produkttitel og beskrivelse</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer teksten over produktvalgene. En tom titel bruger stadig produktets eget navn.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                    Klik på titlen i previewet for at lande direkte her. Titel-override er fælles for produktsidens design; tom titel viser den valgte produktside med produktets rigtige navn.
                                </div>

                                <div className="space-y-4 rounded-lg border border-border/60 p-4">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-medium">Titel</h4>
                                        <p className="text-xs text-muted-foreground">Tekst, skrifttype, størrelse og farve på overskriften.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="product-page-heading-title">Titeltekst</Label>
                                        <Input
                                            id="product-page-heading-title"
                                            value={headingConfig.customText || ""}
                                            placeholder="Tom = brug produktets navn"
                                            onChange={(event) => updateProductHeading({ customText: event.target.value })}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => updateProductHeading({ customText: "" })}
                                        >
                                            Brug produktnavn
                                        </Button>
                                    </div>
                                    <FontSelector
                                        label="Titel skrifttype"
                                        value={headingConfig.font || editor.draft.fonts.heading || "Poppins"}
                                        onChange={(font) => updateProductHeading({ font })}
                                    />
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Titelstørrelse</Label>
                                            <span className="text-xs text-muted-foreground">{headingConfig.sizePx || 36}px</span>
                                        </div>
                                        <Slider
                                            min={24}
                                            max={72}
                                            step={1}
                                            value={[headingConfig.sizePx || 36]}
                                            onValueChange={([value]) => updateProductHeading({ sizePx: value })}
                                        />
                                    </div>
                                    <ColorPickerWithSwatches
                                        label="Titelfarve"
                                        value={headingConfig.color || editor.draft.colors.headingText || "#1F2937"}
                                        onChange={(color) => updateProductHeading({ color })}
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

                                <div className="space-y-4 rounded-lg border border-border/60 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-medium">Ekstra tekst over valgene</h4>
                                            <p className="text-xs text-muted-foreground">En valgfri tekstlinje mellem titlen og produktets normale beskrivelse.</p>
                                        </div>
                                        <Switch
                                            checked={Boolean(headingConfig.subtext.enabled)}
                                            onCheckedChange={(enabled) => updateProductHeadingSubtext({ enabled })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="product-page-heading-subtext">Tekst</Label>
                                        <Textarea
                                            id="product-page-heading-subtext"
                                            value={headingConfig.subtext.text || ""}
                                            placeholder="Skriv en kort produkttekst, kampagnetekst eller forklaring"
                                            rows={3}
                                            disabled={!headingConfig.subtext.enabled}
                                            onChange={(event) => updateProductHeadingSubtext({ text: event.target.value })}
                                        />
                                    </div>
                                    <FontSelector
                                        label="Tekst skrifttype"
                                        value={headingConfig.subtext.font || editor.draft.fonts.body || "Poppins"}
                                        onChange={(font) => updateProductHeadingSubtext({ font })}
                                    />
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Tekststørrelse</Label>
                                            <span className="text-xs text-muted-foreground">{headingConfig.subtext.sizePx || 18}px</span>
                                        </div>
                                        <Slider
                                            min={12}
                                            max={32}
                                            step={1}
                                            value={[headingConfig.subtext.sizePx || 18]}
                                            disabled={!headingConfig.subtext.enabled}
                                            onValueChange={([value]) => updateProductHeadingSubtext({ sizePx: value })}
                                        />
                                    </div>
                                    <ColorPickerWithSwatches
                                        label="Tekstfarve"
                                        value={headingConfig.subtext.color || editor.draft.colors.bodyText || "#475569"}
                                        onChange={(color) => updateProductHeadingSubtext({ color })}
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
                            </CardContent>
                        </Card>
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-box") && (
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
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-matrix-top-row") && (
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
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-matrix-vertical") && (
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
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-matrix-pricing") && (
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
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-matrix-buttons") && (
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
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-colors") && (
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
                        )}
                        {shouldShowProductPageTarget(...pricePanelTargetIds) && (
                        <Card id="site-design-focus-product-page-price-panel">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Prisberegner</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Gælder kun boksen med “Prisberegning”, levering og samlet pris. Påvirker ikke prismatrixen eller CTA-knapperne.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!isProductPageFocusMode && (
                                    <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                        Brug denne sektion til højrepanelet med priser, levering, badges og total.
                                    </div>
                                )}
                                {shouldShowPricePanelPart("site-design-focus-product-page-price-panel-box") && (
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
                                )}
                                {pricePanelTitleField && shouldShowPricePanelPart("site-design-focus-product-page-price-panel-title") && (
                                    <div id="site-design-focus-product-page-price-panel-title" className="space-y-3 rounded-lg border border-border/60 p-4">
                                        <div>
                                            <h4 className="text-sm font-medium">Titel</h4>
                                            <p className="text-xs text-muted-foreground">Overskriften “Prisberegning”.</p>
                                        </div>
                                        {renderPricePanelField(pricePanelTitleField)}
                                    </div>
                                )}
                                {shouldShowPricePanelPart("site-design-focus-product-page-price-panel-download-button") && (
                                <div id="site-design-focus-product-page-price-panel-download-button" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">“Download tilbud”-knap</h4>
                                        <p className="text-xs text-muted-foreground">Baggrund, tekst, ikon og border for download-knappen i toppen af prisberegneren.</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {pricePanelDownloadButtonFields.map(renderPricePanelField)}
                                    </div>
                                </div>
                                )}
                                {shouldShowPricePanelPart("site-design-focus-product-page-price-panel-text") && (
                                <div id="site-design-focus-product-page-price-panel-text" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Informationstekst</h4>
                                        <p className="text-xs text-muted-foreground">Labels, hjælpetekster, leveringsinfo og anden tekst i prisberegneren.</p>
                                    </div>
                                    {pricePanelTextFields.map(renderPricePanelField)}
                                </div>
                                )}
                                {pricePanelPriceField && shouldShowPricePanelPart("site-design-focus-product-page-price-panel-price") && (
                                    <div id="site-design-focus-product-page-price-panel-price" className="space-y-3 rounded-lg border border-border/60 p-4">
                                        <div>
                                            <h4 className="text-sm font-medium">Priser</h4>
                                            <p className="text-xs text-muted-foreground">Hovedpris, leveringspris og samlet pris.</p>
                                        </div>
                                        {renderPricePanelField(pricePanelPriceField)}
                                    </div>
                                )}
                                {shouldShowPricePanelPart("site-design-focus-product-page-price-panel-delivery-card") && (
                                <div id="site-design-focus-product-page-price-panel-delivery-card" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Leveringskort</h4>
                                        <p className="text-xs text-muted-foreground">Baggrund og border for leveringsboksene i normal, hover og valgt tilstand.</p>
                                    </div>
                                    {pricePanelDeliveryCardFields.map(renderPricePanelField)}
                                </div>
                                )}
                                {shouldShowPricePanelPart("site-design-focus-product-page-price-panel-badge") && (
                                <div id="site-design-focus-product-page-price-panel-badge" className="space-y-3 rounded-lg border border-border/60 p-4">
                                    <div>
                                        <h4 className="text-sm font-medium">Tidstæller</h4>
                                        <p className="text-xs text-muted-foreground">Farver og border for countdown-badget.</p>
                                    </div>
                                    {pricePanelBadgeFields.map(renderPricePanelField)}
                                </div>
                                )}
                            </CardContent>
                        </Card>
                        )}
                        {shouldShowProductPageTarget("site-design-focus-product-page-picture-buttons") && (
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
                        )}
                        {shouldShowProductPageTarget(...orderButtonTargetIds) && (
                        <Card id="site-design-focus-product-page-order-buttons">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Bestillingsknapper</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer knapperne “Design online” og “Bestil nu!” på produktsiden.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
                                    <h4 className="text-sm font-medium">Form og typografi</h4>
                                    <FontSelector
                                        label="Skrifttype"
                                        inline
                                        value={orderButtons.font || "Inter"}
                                        onChange={(font) => updateOrderButtons({ font })}
                                    />
                                    <div className="space-y-2">
                                        <Label>Tekststørrelse ({orderButtons.fontSizePx ?? 16}px)</Label>
                                        <Slider min={11} max={28} step={1} value={[orderButtons.fontSizePx ?? 16]} onValueChange={([fontSizePx]) => updateOrderButtons({ fontSizePx })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Skrifttykkelse</Label>
                                        <Select value={String(orderButtons.fontWeight ?? 600)} onValueChange={(value) => updateOrderButtons({ fontWeight: Number(value) })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="400">Normal</SelectItem>
                                                <SelectItem value="500">Medium</SelectItem>
                                                <SelectItem value="600">Semibold</SelectItem>
                                                <SelectItem value="700">Fed</SelectItem>
                                                <SelectItem value="800">Ekstra fed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Runding ({orderButtons.radiusPx ?? 10}px)</Label>
                                        <Slider min={0} max={40} step={1} value={[orderButtons.radiusPx ?? 10]} onValueChange={([radiusPx]) => updateOrderButtons({ radiusPx })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Kant ({orderButtons.borderWidthPx ?? 1}px)</Label>
                                        <Slider min={0} max={6} step={1} value={[orderButtons.borderWidthPx ?? 1]} onValueChange={([borderWidthPx]) => updateOrderButtons({ borderWidthPx })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Lodret luft ({orderButtons.paddingYPx ?? 16}px)</Label>
                                        <Slider min={8} max={28} step={1} value={[orderButtons.paddingYPx ?? 16]} onValueChange={([paddingYPx]) => updateOrderButtons({ paddingYPx })} />
                                    </div>
                                </div>
                                {shouldShowOrderButtonPart("site-design-focus-product-page-order-primary") && (
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
                                )}

                                {shouldShowOrderButtonPart("site-design-focus-product-page-order-secondary") && (
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
                                )}

                                {shouldShowOrderButtonPart("site-design-focus-product-page-order-selected") && (
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
                                )}
                            </CardContent>
                        </Card>
                        )}
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
                            key={`${editor.entityId}:${focusedProductOption.productId}:${focusedProductOption.sectionId}`}
                            tenantId={editor.entityId}
                            pricingPreview={productPricingPreview}
                            persistedStyling={persistedProductPricing}
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
                            onPricingStructureChange={handleProductOptionPricingStructureChange}
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
                            branding={editor.draft}
                            onEditSharedButtons={() => setActiveSection('main-buttons')}
                            key={`${editor.entityId}:${focusedProductOption.productId}:${focusedProductOption.sectionId}:${focusedProductOption.valueId}`}
                            pricingPreview={productPricingPreview}
                            persistedStyling={persistedProductPricing}
                            tenantId={editor.entityId}
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
                            onPricingStructureChange={handleProductOptionPricingStructureChange}
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
                        onPreviewPricingStructureChange={handleProductOptionPricingStructureChange}
                        pricingPreview={productPricingPreview}
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
                                    if (!USP_ICON_OPTIONS.some(option => option.value === value)) return;
                                    nextItems[itemIndex] = { ...item, icon: value as USPIconType };
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
                            branding={editor.draft}
                            onEditSharedButtons={() => setActiveSection('main-buttons')}
                        key={`${editor.entityId}:${contextualEditor.productId}:${contextualEditor.sectionId}:${contextualEditor.valueId}`}
                        pricingPreview={productPricingPreview}
                        persistedStyling={persistedProductPricing}
                        tenantId={editor.entityId}
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
                        onPricingStructureChange={handleProductOptionPricingStructureChange}
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
        <IconPackProvider packId={editor.draft.selectedIconPackId}><div ref={workspaceRef} className="workspace-site-design-v2 flex flex-col">
            <SiteDesignWorkspace
                title={editor.mode === 'master' ? 'Designskabeloner til shops' : 'Site Design'}
                description={editor.mode === 'master' ? 'Genbrugelige udgangspunkter til shops. Den enkelte shop redigeres i Site Design.' : `Design for ${editor.entityName}. Tilpas siden, og se ændringerne med det samme.`}
                status={editor.hasUnsavedChanges ? "Du har ændringer, der ikke er gemt" : isDraftLive ? "Live version er opdateret" : "Du redigerer en kladde"}
                actions={<>
                    <Button variant="ghost" size="sm" onClick={editor.undo} disabled={!editor.canUndo || editor.isSaving} title="Fortryd seneste designændring"><Undo2 className="mr-1 h-4 w-4" />Fortryd</Button>
                    <Button variant="ghost" size="sm" onClick={editor.redo} disabled={!editor.canRedo || editor.isSaving} title="Gentag designændring"><Redo2 className="mr-1 h-4 w-4" />Gentag</Button>
                    <Button variant="outline" size="sm" onClick={saveDraftWithProductSettings} disabled={editor.isSaving}>Gem kladde</Button>
                    <Button size="sm" onClick={() => setShowPublishDialog(true)} disabled={editor.isSaving}><Send className="mr-2 h-4 w-4" />Publicér</Button>
                </>}
                moreActions={<>
                    <Button variant="ghost" size="sm" onClick={() => editor.replaceDraft(editor.published)} disabled={editor.isSaving || isDraftLive}>Tilbage til publiceret design</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowResetDialog(true)}>Gendan standarddesign</Button>

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
                                                supabase.from('premade_designs').select('*').order('created_at', { ascending: false }),
                                                supabase.from('tenants').select('id, name').neq('id', '00000000-0000-0000-0000-000000000000')
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
                                        void loadPremadeDesigns();
                                    }}
                                    disabled={editor.isSaving}
                                    className="gap-2"
                                >
                                    <LayoutTemplate className="h-4 w-4" />
                                    Designskabeloner
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


                </>}
                navigation={<SiteDesignNavigation
                    currentPage={currentPreviewPage}
                    activeSection={activeSection}
                    sections={Array.from(allowedSections).map(id => ({ id, label: id === "order-flow" ? "Bestillingsflow" : SECTION_LABELS[id] || id }))}
                    onNavigate={path => {
                        if (path === "/produkt") {
                            const product = currentPreviewProduct || featuredProducts.find(item => item.slug);
                            if (product) navigatePreviewToProduct(product.slug);
                            else setPreviewNavigationRequest({ id: Date.now(), type: "first-product" });
                        } else {
                            navigatePreviewTo(path);
                            if (getSiteDesignPreviewPathname(path) === '/produkter') {
                                closeSection();
                                setActiveSection('products');
                                setSidebarOpen(true);
                            }
                        }
                    }}
                    onSectionChange={section => {
                        closeSection();
                        setActiveSection(section);
                        setSidebarOpen(true);
                        const targets: Record<string, string> = { banner: 'forside.hero.media', showcase: 'forside.banner2', 'usp-strip': 'usp-strip', header: 'header', footer: 'footer', products: 'forside.products', 'featured-products': 'forside.products.featured' };
                        if (targets[section]) setSectionFocusRequest({ id: Date.now(), target: targets[section] });
                        if (section === 'order-flow' && !getOrderFlowPreviewPage(currentPreviewPage)) navigatePreviewToOrderStep('calculator');
                        if (section === 'products' && !isHomePreviewPage) navigatePreviewTo('/produkter');
                        if (section === 'featured-products' && !['/', '/shop'].includes(previewPathname)) navigatePreviewTo('/');
                    }}
                    productSelect={<>
                        <Label htmlFor="site-design-product-preview">Vælg produkt</Label>
                                <Select
                                    value={currentPreviewProduct?.slug || ""}
                                    onValueChange={navigatePreviewToProduct}
                                    disabled={loadingFeaturedProducts || featuredProducts.length === 0}
                                >
                                    <SelectTrigger
                                        id="site-design-product-preview"
                                        className="h-7 min-w-0 text-xs"
                                    >
                                        <SelectValue
                                            placeholder={
                                                loadingFeaturedProducts
                                                    ? "Henter produkter..."
                                                    : featuredProducts.length === 0
                                                        ? "Ingen produkter"
                                                        : "Vælg produkt"
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {featuredProducts
                                            .filter((product) => Boolean(product.slug))
                                            .map((product) => (
                                                <SelectItem key={product.id} value={product.slug}>
                                                    {product.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>

                    </>}
                />}
                inspectorTitle={activeSection === "main-buttons" ? "Fælles knapper" : activeSection === "theme" ? "Shopdesign" : activeSection === "order-flow" ? "Bestillingsflow" : SECTION_LABELS[activeSection || ""] || "Vælg en indstilling"}
                inspectorOpen={sidebarOpen}
                onInspectorClose={() => setSidebarOpen(false)}
                onInspectorOpen={() => setSidebarOpen(true)}
                inspector={activeSection ? <>
                    {(['header', 'banner', 'products', 'featured-products', 'product-page-matrix', 'order-flow'].includes(activeSection)) && <SharedButtonLocalControls
                        draft={editor.draft} updateDraft={editor.updateDraft} role="cta"
                        buttonKey={activeSection === 'header' ? 'header' : activeSection === 'banner' ? 'hero' : activeSection === 'products' ? 'catalogue' : activeSection === 'featured-products' ? 'featured' : 'order'}
                        title={activeSection === 'header' ? 'headerknapper' : activeSection === 'banner' ? 'bannerknapper' : activeSection === 'products' ? 'produktknapper' : activeSection === 'featured-products' ? 'fremhævede knapper' : 'bestillingsknapper'}
                    />}
                    {activeSection === 'product-page-matrix' && <SharedButtonLocalControls draft={editor.draft} updateDraft={editor.updateDraft} role="selection" buttonKey="matrix" title="prismatricens valgknapper" />}
                    {renderSidebarContent()}</> : <p className="sd-inspector-empty">Vælg en indstilling i venstre side, eller aktivér Redigér og klik på et element i previewet.</p>}
            >
                                <SiteDesignPreviewFrame presentation="workspace" featuredSlideId={selectedFeaturedSlideId}
                                    branding={editor.draft}
                                    previewUrl={`/preview-shop?draft=1&preview_mode=1&tenantId=${editor.entityId}&editor=site-design-v2`}
                                    tenantName={editor.entityName}
                                    onSaveDraft={saveDraftWithProductSettings}
                                    onResetDesign={() => setShowResetDialog(true)}
                                    navigationRequest={previewNavigationRequest}
                                    sectionFocusRequest={sectionFocusRequest}
                                    productPricingPreview={productPricingPreview}
                                    onPreviewPathChange={path => {
                                        setCurrentPreviewPage(path);
                                        if (getSiteDesignPreviewPathname(path) === '/produkter' && previewPathname !== '/produkter') {
                                            closeSection();
                                            setActiveSection('products');
                                            setSidebarOpen(true);
                                        }
                                    }}
                                    editMode={previewEditMode}
                                    onEditModeChange={setPreviewEditMode}
                                    clearSelectionSignal={clearSelectionSignal}
                                    previewProducts={featuredProducts}
                                />
            </SiteDesignWorkspace>

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
                            Standarddesignet Refined Familiar indlæses i din kladde. Farver på siden og i fælles knapper nulstilles også, og lokale knaplåse fjernes. Shopnavn, logo, tekster, produktvalg, priser og gemte farvesæt/knapdesign bevares.
                            <br /><br />
                            Du kan fortryde ændringen. Kunderne ser først ændringerne, når du vælger Publicér.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                editor.replaceDraft(standardSiteDesign(editor.draft));
                                toast.success('Standarddesign indlæst i kladden — kan fortrydes');
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
                            {editor.mode === "master" ? "Publicér skabelon?" : "Publicér shopdesign?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-4">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                                {editor.mode === "master" ? "Skabelonens publicerede version opdateres. Eksisterende shops ændres ikke automatisk. Gem som skabelon gør designet tilgængeligt i biblioteket." : "Publicering vil ændre din live hjemmeside øjeblikkeligt."}
                            </div>
                            <section aria-label="Layouts der publiceres" className="rounded-md border p-3">
                                <h3 className="mb-2 font-medium text-foreground">Forside og produktoversigt</h3>
                                <p className="mb-4 text-xs">{PRODUCT_PRESENTATIONS.find(item => item.id === editor.draft.forside?.productsSection?.presentation)?.name || 'Temaets oprindelige produktvisning'}</p>
                                <h3 className="mb-2 font-medium text-foreground">Bestillingsflow</h3>
                                <dl className="space-y-1.5 text-xs">
                                    {ORDER_FLOW_DESIGNS.map(item => {
                                        const design = resolveOrderFlowDesign(item.page, editor.draft);
                                        return <div key={item.page} className="flex justify-between gap-3"><dt>{item.label}</dt><dd>{design} · {design === item.default ? 'Standard' : 'Alternativ'}</dd></div>;
                                    })}
                                </dl>
                            </section>

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
                            Gem en gratis skabelon. Synlige skabeloner kan bruges af alle shops; skjulte skabeloner tildeles af Webprinter.
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
                                <Label htmlFor="resource-design-price">Gratis skabelon</Label>
                                <Input
                                    id="resource-design-price"
                                    type="number"
                                    min="0"
                                    placeholder="0 = Gratis"
                                    value={0}
                                    readOnly
                                    disabled

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
                                            price: 0,
                                            created_by: user?.id,
                                        });

                                    if (error) throw error;

                                    toast.success(`Design "${resourceDesignName}" gemt til ressourcer! ${resourceDesignVisible ? 'Synlig for lejere.' : 'Skjult indtil publiceret.'}`, { id: 'save-design' });
                                    setResourceDesignName("");
                                    setResourceDesignDescription("");

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
                        void loadPremadeDesigns();
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="h-5 w-5 text-primary" />
                            Designskabeloner
                        </DialogTitle>
                        <DialogDescription>
                            Gratis skabeloner og skabeloner tildelt af Webprinter kan anvendes på kladden. Du kan fortryde ændringen før publicering.
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
                                <p className="text-sm">Ingen designskabeloner tilgængelige</p>
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
                                                <Badge className="absolute top-2 right-2">{design.assignedToShop ? "Tildelt din shop" : "Kræver tildeling"}</Badge>
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
                                                disabled={design.price > 0 && !design.assignedToShop && !paidItems.isItemPurchased('premade_design', design.id)}
                                                onClick={async () => {
                                                    if (design.price > 0 && !design.assignedToShop && !paidItems.isItemPurchased('premade_design', design.id)) {
                                                        toast.error('Kontakt Webprinter for at få denne skabelon tildelt din shop.');
                                                        return;
                                                    }
                                                    if (design.branding_data) {
                                                        // Apply the design to current draft
                                                        editor.updateDraft(design.branding_data);

                                                        toast.success(`Design "${design.name}" anvendt på kladden.`);

                                                        setShowPremadeDesignsDialog(false);
                                                    } else {
                                                        toast.error('Design data ikke tilgængelig');
                                                    }
                                                }}
                                            >
                                                {design.price > 0 && !design.assignedToShop && !paidItems.isItemPurchased('premade_design', design.id) ? (
                                                    <>Kontakt Webprinter for tildeling</>
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
                            .from('premade_designs')
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
                            Administrer gemte designskabeloner og deres tilgængelighed for shops.
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
                                                                        const select = e.currentTarget;
                                                                        const tenantId = select.value;
                                                                        if (!tenantId) return;
                                                                        select.disabled = true;
                                                                        try {
                                                                            await assignDesignToShop(tenantId, design.id);
                                                                            const tenant = tenantList.find(t => t.id === tenantId);
                                                                            toast.success(`Tildelt til ${tenant?.name || 'lejer'}`);
                                                                        } catch (error) {
                                                                            toast.error('Designet blev ikke tildelt. Kontrollér masteradgang og prøv igen.');
                                                                        } finally {
                                                                            select.value = '';
                                                                            select.disabled = false;
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
                                                                <Label htmlFor="edit-price" className="text-xs">Tidligere pris (bevares)</Label>
                                                                <Input
                                                                    id="edit-price"
                                                                    type="number"
                                                                    min="0"
                                                                    value={editingDesign.price}
                                                                    readOnly
                                                                    disabled
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
        </div></IconPackProvider>
    );
}
