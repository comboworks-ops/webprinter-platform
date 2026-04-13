
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
    Pencil, Eye, EyeOff, Check, History, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, FileText, CheckSquare, DollarSign, type LucideIcon
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
import { supabase } from "@/integrations/supabase/client";
import { usePaidItems } from "@/hooks/usePaidItems";
import { BrandingPaletteProvider } from "@/contexts/BrandingPaletteContext";

import {
    DEFAULT_BRANDING,
    type BrandingStorageAdapter,
    type BrandingCapabilities,
    brandingEquals,
    useBrandingEditor,
} from "@/lib/branding";

interface BrandingEditorV2Props {
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

const PREVIEW_PAGE_LINKS: PreviewPageLink[] = [
    { label: "Forside", path: "/" },
    { label: "Produkter", path: "/produkter" },
    { label: "Bestilling", path: "/produkter", action: "first-product" },
    { label: "Grafisk vejledning", path: "/grafisk-vejledning" },
    { label: "Kontakt", path: "/kontakt" },
    { label: "Om os", path: "/om-os" },
];

const SECTION_LABELS: Record<string, string> = {
    theme: "Tema",
    logo: "Logo & Favicon",
    header: "Header & Menu",
    typography: "Typografi",
    "page-background": "Sidebaggrund",
    colors: "Farver",
    banner: "Banner (Hero)",
    showcase: "Banner 2 / Showcase",
    products: "Forside produkter",
    "product-page-matrix": "Prismatrix",
    "product-price-panel": "Prisboks (prisberegner)",
    "product-order-buttons": "Bestil-knapper",
    "product-info-section": "Produktbeskrivelse (Om produktet)",
    "product-option-selectors": "Tilvalgsknapper & -visning",
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
        description: "Disse værktøjer gælder kun for produktsiden.",
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
        label: "Prismatrix",
        group: "product",
        icon: Layout,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-cyan-100 text-cyan-900 hover:bg-cyan-50/50 hover:border-cyan-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-cyan-100/50 flex items-center justify-center text-cyan-600 group-hover:bg-cyan-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "product-price-panel",
        label: "Prisboks (prisberegner)",
        group: "product",
        icon: DollarSign,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "product-order-buttons",
        label: "Bestil-knapper",
        group: "product",
        icon: ShoppingCart,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-orange-100 text-orange-900 hover:bg-orange-50/50 hover:border-orange-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-orange-100/50 flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "product-info-section",
        label: "Produktbeskrivelse (Om produktet)",
        group: "product",
        icon: FileText,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-teal-100 text-teal-900 hover:bg-teal-50/50 hover:border-teal-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-teal-100/50 flex items-center justify-center text-teal-600 group-hover:bg-teal-100 transition-colors",
        iconClassName: "h-4 w-4",
    },
    {
        id: "product-option-selectors",
        label: "Tilvalgsknapper & -visning",
        group: "product",
        icon: CheckSquare,
        buttonClassName: "menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-violet-100 text-violet-900 hover:bg-violet-50/50 hover:border-violet-200 group",
        iconWrapperClassName: "h-8 w-8 rounded-lg bg-violet-100/50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors",
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

export function BrandingEditorV2({ adapter, capabilities, onSwitchVersion }: BrandingEditorV2Props) {
    const editor = useBrandingEditor({ adapter, capabilities });
    const isDraftLive = brandingEquals(editor.draft, editor.published);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [previewEditMode, setPreviewEditMode] = useState(false);
    const [clearSelectionSignal, setClearSelectionSignal] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
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
    const [featuredProducts, setFeaturedProducts] = useState<FeaturedProductOption[]>([]);
    const [loadingFeaturedProducts, setLoadingFeaturedProducts] = useState(false);
    const [featuredQuantityOptions, setFeaturedQuantityOptions] = useState<number[]>([]);
    const [loadingFeaturedQuantities, setLoadingFeaturedQuantities] = useState(false);
    const [uploadingPageBackgroundImage, setUploadingPageBackgroundImage] = useState(false);
    const [uploadingFeaturedSideImage, setUploadingFeaturedSideImage] = useState(false);
    const [uploadingFeaturedGalleryImage, setUploadingFeaturedGalleryImage] = useState(false);
    const [uploadingFeaturedMainImage, setUploadingFeaturedMainImage] = useState(false);

    // Ref for screenshot capture promise resolution
    const screenshotResolverRef = useRef<{ resolve: (url: string | null) => void; reject: (err: any) => void } | null>(null);

    // Listen for click events from preview AND screenshot responses
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'EDIT_SECTION') {
                const { sectionId } = event.data;
                console.log("Branding Editor received click:", sectionId);

                // Map branding IDs to internal sections
                const sId = sectionId || '';
                if (sId === 'header.logo') {
                    setActiveSection('logo');
                } else if (sId === 'header' || sId === 'header.menu') {
                    setActiveSection('header');
                } else if (sId === 'forside.hero') {
                    setActiveSection('banner');
                } else if (sId === 'footer') {
                    setActiveSection('footer');
                } else if (sId === 'content' || sId.startsWith('block-') || sId.startsWith('content:')) {
                    setActiveSection('content');
                    if (sId.startsWith('block-') || sId.startsWith('content:')) {
                        setFocusedBlockId(sId);
                    }
                } else if (sId.startsWith('forside.products') || sId === 'icons.product-images') {
                    setActiveSection('products');
                } else if (sId === 'usp-strip' || sId.startsWith('usp-strip.')) {
                    setActiveSection('content');
                } else if (sId === 'forside.products.categories' || sId.startsWith('forside.products.categories')) {
                    setActiveSection('products');
                } else if (sId === 'productPage.infoSection') {
                    setActiveSection('product-info-section');
                } else if (sId === 'productPage.optionSelectors' || sId.startsWith('productPage.optionSelectors.')) {
                    setActiveSection('product-option-selectors');
                } else if (sId === 'productPage.matrix' || sId === 'productPage.heading') {
                    setActiveSection('product-page-matrix');
                } else if (sId === 'productPage.pricePanel' || sId.startsWith('productPage.pricePanel.')) {
                    setActiveSection('product-price-panel');
                } else if (sId === 'productPage.orderButtons.primary' || sId === 'productPage.orderButtons.secondary') {
                    setActiveSection('product-order-buttons');
                } else if (sId === 'colors.background') {
                    setActiveSection('page-background');
                } else if (sId.startsWith('colors.')) {
                    setActiveSection('colors');
                } else {
                    setActiveSection(sId);
                }

                setSidebarOpen(true);
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
    }, []);

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
        return currentPreviewPage;
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
            sections.add("products");
            sections.add("content");
            if (capabilities.sections.iconPacks) sections.add("icons");
        }

        if (isProductPreviewPage) {
            sections.add("product-page-matrix");
            sections.add("product-price-panel");
            sections.add("product-order-buttons");
            sections.add("product-info-section");
            sections.add("product-option-selectors");
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
    ]);

    const allowedSectionLabels = useMemo(() => {
        return Array.from(allowedSections).map((section) => SECTION_LABELS[section] || section);
    }, [allowedSections]);

    useEffect(() => {
        if (activeSection && !allowedSections.has(activeSection)) {
            setActiveSection(null);
        }
    }, [activeSection, allowedSections]);

    // ... existing publish/save handlers ...

    // Handle Publish - checks for pending paid items first
    const handlePublish = async () => {
        // If tenant has pending paid items, show payment dialog instead
        if (editor.mode === 'tenant' && paidItems.hasPendingItems) {
            setShowPublishDialog(false);
            setShowPendingPurchasesDialog(true);
            return;
        }

        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setShowPublishDialog(false);
        setPublishLabel("");
    };

    // Handle publish after payment is complete
    const handlePublishAfterPayment = async () => {
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

    const getSectionSummary = (sectionId: string): { text?: string; colors?: string[] } | null => {
        const draft = editor.draft;
        switch (sectionId) {
            case 'theme': {
                const themeId = (draft as any).themeId || 'classic';
                const themeNames: Record<string, string> = {
                    classic: 'Classic', glassmorphism: 'Glass', minimal: 'Minimal', bold: 'Bold', flat: 'Flat',
                };
                return { text: themeNames[themeId] || themeId };
            }
            case 'logo': {
                const hasImage = Boolean(draft.header?.logoImageUrl || (draft as any).logo_url);
                return { text: hasImage ? 'Logo uploadet' : 'Tekst-logo' };
            }
            case 'header': {
                const bgColor = draft.header?.bgColor;
                const style = draft.header?.style || 'solid';
                const styleLabel = style === 'solid' ? 'Solid' : style === 'glass' ? 'Glas' : style === 'transparent' ? 'Transparent' : style;
                return bgColor ? { text: styleLabel, colors: [bgColor] } : { text: styleLabel };
            }
            case 'typography': {
                const heading = (draft as any).fonts?.heading || 'Poppins';
                const body = (draft as any).fonts?.body || 'Inter';
                return { text: `${heading} / ${body}` };
            }
            case 'page-background': {
                const c = draft.colors || {};
                const type = c.backgroundType || 'solid';
                const text = type === 'gradient' ? 'Gradient' : type === 'image' ? 'Billede' : 'Farve';
                return { text, colors: [c.background, c.backgroundGradientStart, c.backgroundGradientEnd].filter(Boolean) as string[] };
            }
            case 'colors': {
                const c = draft.colors || {};
                return { colors: [c.primary, c.card, c.secondary].filter(Boolean) as string[] };
            }
            case 'banner': {
                const hero = (draft as any).hero || {};
                const type = hero.backgroundType || 'color';
                if (type === 'video') return { text: 'Video baggrund' };
                if (type === 'image' || hero.backgroundImage) return { text: 'Billede baggrund' };
                const bgColor = hero.backgroundColor;
                return bgColor ? { text: 'Farve', colors: [bgColor] } : { text: 'Farve baggrund' };
            }
            case 'showcase': {
                const enabled = draft.forside?.banner2?.enabled !== false;
                return { text: enabled ? 'Aktiv' : 'Slået fra' };
            }
            case 'products': {
                const cols = draft.forside?.productsSection?.columns || 4;
                const ls = draft.forside?.productsSection?.layoutStyle || 'cards';
                const lsLabels: Record<string, string> = { cards: 'Kort', flat: 'Flat', grouped: 'Grupper', slim: 'Slim' };
                return { text: `${lsLabels[ls] || ls} · ${cols} kol.` };
            }
            case 'content': {
                const n = (draft.forside?.contentBlocks || []).length;
                return { text: `${n} blok${n === 1 ? '' : 'ke'}` };
            }
            case 'footer': {
                return null;
            }
            case 'icons': {
                const packId = (draft as any).selectedIconPackId || 'classic';
                return { text: packId === 'classic' ? 'Standard' : packId };
            }
            case 'product-page-matrix': {
                const font = (draft as any).productPage?.matrix?.font || 'Inter';
                const accent = (draft as any).productPage?.matrix?.selectedBg || draft.colors?.primary || '#0EA5E9';
                return { text: font, colors: [accent] };
            }
            case 'product-price-panel': {
                const pp = (draft as any).productPage?.pricePanel;
                const bg = pp?.backgroundColor || pp?.gradientStart || draft.colors?.primary || undefined;
                return { colors: bg ? [bg] : [] };
            }
            case 'product-order-buttons': {
                const ob = (draft as any).productPage?.orderButtons?.primary;
                const c = ob?.bgColor || draft.colors?.primary || undefined;
                return { colors: c ? [c] : [] };
            }
            case 'product-info-section': {
                const infoSec = (draft as any).productPage?.infoSection;
                const bg = infoSec?.bgColor || undefined;
                const titleColor = infoSec?.titleColor || draft.colors?.headingText || undefined;
                return { colors: [bg, titleColor].filter(Boolean) as string[] };
            }
            case 'product-option-selectors': {
                const sel = (draft as any).productPage?.optionSelectors?.button;
                const c1 = sel?.selectedBgColor || draft.colors?.primary || undefined;
                const c2 = sel?.bgColor || undefined;
                return { colors: [c1, c2].filter(Boolean) as string[] };
            }
            default: return null;
        }
    };

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
                                            const summary = getSectionSummary(config.id);
                                            return (
                                                <button
                                                    key={config.id}
                                                    className={config.buttonClassName}
                                                    onClick={() => setActiveSection(config.id)}
                                                >
                                                    <div className={config.iconWrapperClassName}>
                                                        <Icon className={config.iconClassName} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <div className="font-semibold leading-tight">{config.label}</div>
                                                        {summary && (
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                {summary.colors && summary.colors.length > 0 && (
                                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                                        {summary.colors.slice(0, 4).map((c, i) => (
                                                                            <span
                                                                                key={i}
                                                                                className="inline-block w-3 h-3 rounded-full border border-black/10 shadow-sm"
                                                                                style={{ backgroundColor: c }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {summary.text && (
                                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                                        {summary.text}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="h-3.5 w-3.5 opacity-30 shrink-0" />
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
            case 'theme':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Tema</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
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
            case 'logo':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Logo & Favicon</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <HeaderSection
                            header={editor.draft.header}
                            onChange={(header) => editor.updateDraft({ header })}
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <BannerEditor
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ContentBlocksSection
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
                            focusedBlockId={focusedBlockId}
                        />
                    </div>
                );
            case 'showcase':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Banner 2 / Showcase</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
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
            case 'products': {
                const forside = editor.draft.forside;
                const productsSection = forside.productsSection || { enabled: true, columns: 4 };
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
                const backgroundConfig = productsSection.background || {
                    type: 'solid',
                    color: '#FFFFFF',
                    gradientStart: '#FFFFFF',
                    gradientEnd: '#F1F5F9',
                    gradientAngle: 135,
                    opacity: 1,
                };
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <Card>
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
                                <div className="space-y-3 border-t pt-4">
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
                                    <div className="space-y-3 border-t pt-4">
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
                                    <div className="space-y-4 border-t pt-4">
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
                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                                        <div className="grid gap-3 md:grid-cols-2">
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
                                        {/* Custom main image override */}
                                        <div className="space-y-3 rounded-lg border border-dashed p-3">
                                            <div>
                                                <Label>Tilpasset produktbillede</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Erstat produktets standard billede med dit eget. Bruges når galleri er slået fra.
                                                </p>
                                            </div>
                                            {featuredProductConfig.customImageUrl && (
                                                <div className="relative w-32 rounded-md overflow-hidden border bg-muted">
                                                    <img
                                                        src={featuredProductConfig.customImageUrl}
                                                        alt="Tilpasset billede"
                                                        className="w-full h-24 object-contain"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        className="absolute top-1 right-1 h-6 w-6 p-0"
                                                        onClick={() => updateFeaturedProductConfig({ customImageUrl: null })}
                                                    >
                                                        ×
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

                                        <div className="space-y-3 rounded-lg border border-dashed p-3">
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
                                        <div className="space-y-4 rounded-lg border border-dashed p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label className="text-sm font-semibold">Sidepanel</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Vælg mellem kampagnebanner eller ekstra produkt ved siden af.
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
                                                            value={featuredProductConfig.sidePanel?.ctaHref ? (featuredProductConfig.ctaColor || '#0EA5E9') : (featuredProductConfig.ctaColor || '#0EA5E9')}
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <FooterSection
                            footer={editor.draft.footer}
                            onChange={(footer) => editor.updateDraft({ footer })}
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
            case 'typography':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Typografi</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <div className="space-y-3 pt-2">
                            <FontSelector
                                label="Overskrifter"
                                inline
                                value={editor.draft.fonts.heading}
                                onChange={(v) => editor.updateDraft({
                                    fonts: { ...editor.draft.fonts, heading: v }
                                })}
                            />
                            <FontSelector
                                label="Brødtekst"
                                inline
                                value={editor.draft.fonts.body}
                                onChange={(v) => editor.updateDraft({
                                    fonts: { ...editor.draft.fonts, body: v }
                                })}
                            />
                            <FontSelector
                                label="Priser"
                                inline
                                value={editor.draft.fonts.pricing}
                                onChange={(v) => editor.updateDraft({
                                    fonts: { ...editor.draft.fonts, pricing: v }
                                })}
                            />
                        </div>
                    </div>
                );
            case 'page-background':
                return (
                    <div id="site-design-focus-page-background" className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Sidebaggrund</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
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
            case 'colors':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Farver</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                Disse farver styrer de delte tema-farver på både live forside og live produktsider.
                                Hero-knapper, header-CTA/dropdowns og forside-produktknapper redigeres stadig i deres egne sektioner.
                            </div>
                            {BRANDING_COLOR_GROUPS.map((group) => (
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
                                        {group.fields.map((field, index) => {
                                            const value = editor.draft.colors[field.key];
                                            return (
                                                <div
                                                    key={field.key}
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
                            ))}
                        </div>
                    </div>
                );
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

                const headingConfig = {
                    ...DEFAULT_BRANDING.productPage.heading,
                    ...(productPage.heading || {}),
                    subtext: {
                        ...DEFAULT_BRANDING.productPage.heading.subtext,
                        ...(productPage.heading?.subtext || {}),
                    },
                };
                const updateHeading = (updates: Partial<typeof headingConfig>) => {
                    const currentProductPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                    editor.updateDraft({
                        productPage: {
                            ...currentProductPage,
                            heading: {
                                ...headingConfig,
                                ...updates,
                            },
                        },
                    });
                };
                const updateHeadingSubtext = (updates: Partial<typeof headingConfig.subtext>) => {
                    updateHeading({
                        subtext: {
                            ...headingConfig.subtext,
                            ...updates,
                        },
                    });
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Produktside prismatrix, prisberegner & knapper</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        {/* Heading & subtext card */}
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Overskrift & fremhævet tekst</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Sæt skrifttype og størrelse på produktsidens overskrift. Lad tekstfeltet stå tomt for at vise produktnavnet automatisk.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Heading text override */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Overskrift tekst <span className="font-normal text-muted-foreground">(tomt = produktnavn)</span></Label>
                                    <Input
                                        value={headingConfig.customText || ""}
                                        placeholder="Produktnavn (automatisk)"
                                        onChange={(e) => updateHeading({ customText: e.target.value })}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* Heading font + size in one row */}
                                <div className="grid grid-cols-[1fr_80px] gap-2 items-end">
                                    <FontSelector
                                        label="Skrifttype"
                                        value={headingConfig.font || "Poppins"}
                                        onChange={(font) => updateHeading({ font })}
                                    />
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Størrelse (px)</Label>
                                        <Input
                                            type="number"
                                            min={16}
                                            max={80}
                                            value={headingConfig.sizePx || 36}
                                            onChange={(e) => updateHeading({ sizePx: Number(e.target.value) })}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Heading color */}
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-medium">Overskrift farve</p>
                                        <p className="text-[10px] text-muted-foreground">Tom = global overskriftsfarve</p>
                                    </div>
                                    <ColorPickerWithSwatches
                                        value={headingConfig.color || editor.draft.colors?.headingText || "#1F2937"}
                                        onChange={(color) => updateHeading({ color })}
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
                                            editor.updateDraft({ savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color) });
                                        }}
                                    />
                                </div>

                                <Separator />

                                {/* Subtext toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium">Fed undertekst</p>
                                        <p className="text-[10px] text-muted-foreground">Ekstra linje med fed tekst under overskriften</p>
                                    </div>
                                    <Switch
                                        checked={headingConfig.subtext.enabled}
                                        onCheckedChange={(enabled) => updateHeadingSubtext({ enabled })}
                                    />
                                </div>

                                {headingConfig.subtext.enabled && (
                                    <div className="space-y-3 pl-0 border-l-2 border-primary/20 pl-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Undertekst indhold</Label>
                                            <Textarea
                                                value={headingConfig.subtext.text || ""}
                                                placeholder="Skriv din fremhævede tekst her..."
                                                onChange={(e) => updateHeadingSubtext({ text: e.target.value })}
                                                className="text-sm min-h-[60px] resize-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-[1fr_80px] gap-2 items-end">
                                            <FontSelector
                                                label="Skrifttype"
                                                value={headingConfig.subtext.font || "Poppins"}
                                                onChange={(font) => updateHeadingSubtext({ font })}
                                            />
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Størrelse (px)</Label>
                                                <Input
                                                    type="number"
                                                    min={12}
                                                    max={48}
                                                    value={headingConfig.subtext.sizePx || 18}
                                                    onChange={(e) => updateHeadingSubtext({ sizePx: Number(e.target.value) })}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-medium">Farve</p>
                                                <p className="text-[10px] text-muted-foreground">Tom = global brødtekstfarve</p>
                                            </div>
                                            <ColorPickerWithSwatches
                                                value={headingConfig.subtext.color || editor.draft.colors?.bodyText || "#4B5563"}
                                                onChange={(color) => updateHeadingSubtext({ color })}
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
                                                    editor.updateDraft({ savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color) });
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
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
                        <Card>
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
                                <div className="space-y-3 border-t border-border/60 pt-4">
                                    {pricePanelColorFields.map((field, index) => {
                                        const value = pricePanelConfig[field.key];
                                        return (
                                            <div key={field.key} className={index === 0 ? "space-y-1.5" : "space-y-1.5 border-t border-border/40 pt-3"}>
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
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
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
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Bestillingsknapper</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Styrer knapperne “Design online” og “Bestil nu!” på produktsiden.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3 rounded-lg border p-3">
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

                                <div className="space-y-3 rounded-lg border p-3">
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

                                <div className="space-y-3 rounded-lg border p-3">
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
            case 'icons':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Produktbilleder</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
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
            case 'product-price-panel': {
                const panelPrimary2 = editor.draft.colors.primary || "#0EA5E9";
                const productPage2 = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                const pricePanel2 = productPage2.pricePanel || DEFAULT_BRANDING.productPage.pricePanel;
                const sw2 = editor.draft.savedSwatches || [];
                const onSave2 = (c: string) => { if (!sw2.includes(c) && sw2.length < 20) editor.updateDraft({ savedSwatches: [...sw2, c] }); };
                const onRemove2 = (c: string) => editor.updateDraft({ savedSwatches: sw2.filter(x => x !== c) });
                const updatePricePanel = (patch: Partial<typeof DEFAULT_BRANDING.productPage.pricePanel>) => {
                    editor.updateDraft({
                        productPage: {
                            ...editor.draft.productPage,
                            pricePanel: { ...pricePanel2, ...patch },
                        } as any,
                    });
                };
                const bgType = pricePanel2.backgroundType || "solid";
                return (
                    <div className="space-y-4 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Prisboks</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        {/* Background */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baggrund</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <Select value={bgType} onValueChange={(v) => updatePricePanel({ backgroundType: v as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="solid">Ensfarvet</SelectItem>
                                        <SelectItem value="gradient">Gradient</SelectItem>
                                    </SelectContent>
                                </Select>
                                {bgType === "solid" && (
                                    <ColorPickerWithSwatches label="Baggrundsfarve" value={pricePanel2.backgroundColor || hexToRgba(panelPrimary2, 0.05)} onChange={(v) => updatePricePanel({ backgroundColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                )}
                                {bgType === "gradient" && (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <ColorPickerWithSwatches label="Fra" value={pricePanel2.gradientStart || hexToRgba(panelPrimary2, 0.1)} onChange={(v) => updatePricePanel({ gradientStart: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                            <ColorPickerWithSwatches label="Til" value={pricePanel2.gradientEnd || editor.draft.colors.card || "#FFFFFF"} onChange={(v) => updatePricePanel({ gradientEnd: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Vinkel ({pricePanel2.gradientAngle ?? 135}°)</label>
                                            <input type="range" min={0} max={360} value={pricePanel2.gradientAngle ?? 135} onChange={(e) => updatePricePanel({ gradientAngle: Number(e.target.value) })} className="w-full" />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Border & Shape */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kant & form</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <ColorPickerWithSwatches label="Kantfarve" value={pricePanel2.borderColor || hexToRgba(panelPrimary2, 0.18)} onChange={(v) => updatePricePanel({ borderColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Kantbredde ({pricePanel2.borderWidth ?? 2}px)</label>
                                        <input type="range" min={0} max={8} value={pricePanel2.borderWidth ?? 2} onChange={(e) => updatePricePanel({ borderWidth: Number(e.target.value) })} className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Afrunding ({pricePanel2.radiusPx ?? 12}px)</label>
                                        <input type="range" min={0} max={40} value={pricePanel2.radiusPx ?? 12} onChange={(e) => updatePricePanel({ radiusPx: Number(e.target.value) })} className="w-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Text colors */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tekstfarver</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <ColorPickerWithSwatches label="Titel" value={pricePanel2.titleColor || ""} onChange={(v) => updatePricePanel({ titleColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                    <ColorPickerWithSwatches label="Tekst" value={pricePanel2.textColor || ""} onChange={(v) => updatePricePanel({ textColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                    <ColorPickerWithSwatches label="Hjælpetekst" value={pricePanel2.mutedTextColor || ""} onChange={(v) => updatePricePanel({ mutedTextColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                    <ColorPickerWithSwatches label="Pris" value={pricePanel2.priceColor || ""} onChange={(v) => updatePricePanel({ priceColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Delivery cards */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leveringskort</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <ColorPickerWithSwatches label="Baggrund" value={pricePanel2.optionBg || ""} onChange={(v) => updatePricePanel({ optionBg: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                    <ColorPickerWithSwatches label="Valgt" value={pricePanel2.optionSelectedBg || ""} onChange={(v) => updatePricePanel({ optionSelectedBg: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                    <ColorPickerWithSwatches label="Kant" value={pricePanel2.optionBorderColor || ""} onChange={(v) => updatePricePanel({ optionBorderColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                    <ColorPickerWithSwatches label="Valgt kant" value={pricePanel2.optionSelectedBorderColor || ""} onChange={(v) => updatePricePanel({ optionSelectedBorderColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                                </div>
                                <ColorPickerWithSwatches label="Separator" value={pricePanel2.dividerColor || ""} onChange={(v) => updatePricePanel({ dividerColor: v })} savedSwatches={sw2} onSaveSwatch={onSave2} onRemoveSwatch={onRemove2} />
                            </CardContent>
                        </Card>

                        <p className="text-[11px] text-muted-foreground px-1">Avancerede indstillinger (badge, hover m.m.) finder du under <button className="underline" onClick={() => setActiveSection('product-page-matrix')}>Prismatrix</button>.</p>
                    </div>
                );
            }
            case 'product-order-buttons': {
                const productPage3 = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                const orderButtons3 = productPage3.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
                const sw3 = editor.draft.savedSwatches || [];
                const onSave3 = (c: string) => { if (!sw3.includes(c) && sw3.length < 20) editor.updateDraft({ savedSwatches: [...sw3, c] }); };
                const onRemove3 = (c: string) => editor.updateDraft({ savedSwatches: sw3.filter(x => x !== c) });
                const updateOB = (key: 'primary' | 'secondary' | 'selected', patch: Record<string, string>) => {
                    editor.updateDraft({
                        productPage: {
                            ...editor.draft.productPage,
                            orderButtons: {
                                ...orderButtons3,
                                [key]: { ...(orderButtons3[key] || {}), ...patch },
                            },
                        } as any,
                    });
                };
                const primary3 = orderButtons3.primary || {};
                const secondary3 = orderButtons3.secondary || {};
                const selected3 = orderButtons3.selected || {};
                return (
                    <div className="space-y-4 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Bestil-knapper</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">"Bestil nu!" (primær)</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <ColorPickerWithSwatches label="Baggrund" value={(primary3 as any).bgColor || ""} onChange={(v) => updateOB('primary', { bgColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Tekst" value={(primary3 as any).textColor || ""} onChange={(v) => updateOB('primary', { textColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Hover baggrund" value={(primary3 as any).hoverBgColor || ""} onChange={(v) => updateOB('primary', { hoverBgColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Hover tekst" value={(primary3 as any).hoverTextColor || ""} onChange={(v) => updateOB('primary', { hoverTextColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">"Design online" (sekundær)</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <ColorPickerWithSwatches label="Baggrund" value={(secondary3 as any).bgColor || ""} onChange={(v) => updateOB('secondary', { bgColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Tekst" value={(secondary3 as any).textColor || ""} onChange={(v) => updateOB('secondary', { textColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Hover baggrund" value={(secondary3 as any).hoverBgColor || ""} onChange={(v) => updateOB('secondary', { hoverBgColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Hover tekst" value={(secondary3 as any).hoverTextColor || ""} onChange={(v) => updateOB('secondary', { hoverTextColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valgt tilstand (grøn)</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <ColorPickerWithSwatches label="Baggrund" value={(selected3 as any).bgColor || "#16A34A"} onChange={(v) => updateOB('selected', { bgColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Tekst" value={(selected3 as any).textColor || "#FFFFFF"} onChange={(v) => updateOB('selected', { textColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Hover baggrund" value={(selected3 as any).hoverBgColor || "#15803D"} onChange={(v) => updateOB('selected', { hoverBgColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                    <ColorPickerWithSwatches label="Hover tekst" value={(selected3 as any).hoverTextColor || "#FFFFFF"} onChange={(v) => updateOB('selected', { hoverTextColor: v })} savedSwatches={sw3} onSaveSwatch={onSave3} onRemoveSwatch={onRemove3} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'product-info-section': {
                const infoSec = (editor.draft.productPage as any)?.infoSection || {};
                const updateInfoSec = (patch: Record<string, unknown>) => {
                    editor.updateDraft({
                        productPage: {
                            ...editor.draft.productPage,
                            infoSection: {
                                ...((editor.draft.productPage as any)?.infoSection || {}),
                                ...patch,
                            },
                        } as any,
                    });
                };
                const imagePos = infoSec.imagePosition || "above";
                const isHorizontal = imagePos === "left" || imagePos === "right";
                return (
                    <div className="space-y-4 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Produktbeskrivelse</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        {/* Background */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baggrund</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <ColorPickerWithSwatches
                                    label="Baggrundsfarve"
                                    value={infoSec.bgColor || ""}
                                    onChange={(v) => updateInfoSec({ bgColor: v })}
                                    savedSwatches={editor.draft.savedSwatches}
                                    onSaveSwatch={(color) => {
                                        const sw = editor.draft.savedSwatches || [];
                                        if (!sw.includes(color) && sw.length < 20) editor.updateDraft({ savedSwatches: [...sw, color] });
                                    }}
                                    onRemoveSwatch={(color) => {
                                        editor.updateDraft({ savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color) });
                                    }}
                                />
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Afrunding ({infoSec.bgBorderRadius ?? 12}px)</label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={40}
                                        value={infoSec.bgBorderRadius ?? 12}
                                        onChange={(e) => updateInfoSec({ bgBorderRadius: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Title */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overskrift</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <FontSelector
                                    label="Skrifttype"
                                    value={infoSec.titleFont || ""}
                                    onChange={(v) => updateInfoSec({ titleFont: v })}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        value={infoSec.titleColor || ""}
                                        onChange={(v) => updateInfoSec({ titleColor: v })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const sw = editor.draft.savedSwatches || [];
                                            if (!sw.includes(color) && sw.length < 20) editor.updateDraft({ savedSwatches: [...sw, color] });
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({ savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color) });
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Størrelse ({infoSec.titleSizePx ?? 22}px)</label>
                                        <input
                                            type="range"
                                            min={12}
                                            max={48}
                                            value={infoSec.titleSizePx ?? 22}
                                            onChange={(e) => updateInfoSec({ titleSizePx: Number(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Body text */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brødtekst</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <FontSelector
                                    label="Skrifttype"
                                    value={infoSec.textFont || ""}
                                    onChange={(v) => updateInfoSec({ textFont: v })}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        value={infoSec.textColor || ""}
                                        onChange={(v) => updateInfoSec({ textColor: v })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const sw = editor.draft.savedSwatches || [];
                                            if (!sw.includes(color) && sw.length < 20) editor.updateDraft({ savedSwatches: [...sw, color] });
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({ savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color) });
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Størrelse ({infoSec.textSizePx ?? 16}px)</label>
                                        <input
                                            type="range"
                                            min={10}
                                            max={32}
                                            value={infoSec.textSizePx ?? 16}
                                            onChange={(e) => updateInfoSec({ textSizePx: Number(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Image position */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billede placering</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <Select
                                    value={imagePos}
                                    onValueChange={(v) => updateInfoSec({ imagePosition: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Vælg placering" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="above">Over teksten</SelectItem>
                                        <SelectItem value="below">Under teksten</SelectItem>
                                        <SelectItem value="left">Venstre for teksten</SelectItem>
                                        <SelectItem value="right">Højre for teksten</SelectItem>
                                    </SelectContent>
                                </Select>
                                {isHorizontal && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Billedbredde ({infoSec.imageWidthPct ?? 40}%)</label>
                                        <input
                                            type="range"
                                            min={20}
                                            max={70}
                                            value={infoSec.imageWidthPct ?? 40}
                                            onChange={(e) => updateInfoSec({ imageWidthPct: Number(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'product-option-selectors': {
                const optSel = (editor.draft.productPage as any)?.optionSelectors ?? {};
                const updateOptSel = (subKey: string, patch: Record<string, unknown>) => {
                    editor.updateDraft({
                        productPage: {
                            ...editor.draft.productPage,
                            optionSelectors: {
                                ...((editor.draft.productPage as any)?.optionSelectors ?? {}),
                                [subKey]: {
                                    ...((editor.draft.productPage as any)?.optionSelectors?.[subKey] ?? {}),
                                    ...patch,
                                },
                            },
                        } as any,
                    });
                };
                const btnCfg = optSel.button ?? {};
                const imgCfg = optSel.image ?? {};
                const ddCfg = optSel.dropdown ?? {};
                const cbCfg = optSel.checkbox ?? {};
                const sw = editor.draft.savedSwatches || [];
                const onSave = (c: string) => { if (!sw.includes(c) && sw.length < 20) editor.updateDraft({ savedSwatches: [...sw, c] }); };
                const onRemove = (c: string) => editor.updateDraft({ savedSwatches: sw.filter(x => x !== c) });

                return (
                    <div className="space-y-4 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Tilvalgsknapper & -visning</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        {/* ── Buttons ── */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tekst-knapper</CardTitle>
                                <CardDescription className="text-[11px]">Stil når display-type er "Knapper"</CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches label="Baggrund" value={btnCfg.bgColor || ""} onChange={(v) => updateOptSel('button', { bgColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Tekst" value={btnCfg.textColor || ""} onChange={(v) => updateOptSel('button', { textColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Valgt baggrund" value={btnCfg.selectedBgColor || ""} onChange={(v) => updateOptSel('button', { selectedBgColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Valgt tekst" value={btnCfg.selectedTextColor || ""} onChange={(v) => updateOptSel('button', { selectedTextColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Hover baggrund" value={btnCfg.hoverBgColor || ""} onChange={(v) => updateOptSel('button', { hoverBgColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Valgt ring" value={btnCfg.selectedRingColor || ""} onChange={(v) => updateOptSel('button', { selectedRingColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Afrunding ({btnCfg.borderRadius ?? 8}px)</label>
                                        <input type="range" min={0} max={32} value={btnCfg.borderRadius ?? 8} onChange={(e) => updateOptSel('button', { borderRadius: Number(e.target.value) })} className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Tekststørrelse ({btnCfg.fontSizePx ?? 14}px)</label>
                                        <input type="range" min={10} max={24} value={btnCfg.fontSizePx ?? 14} onChange={(e) => updateOptSel('button', { fontSizePx: Number(e.target.value) })} className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Kant ({btnCfg.borderWidth ?? 1}px)</label>
                                        <input type="range" min={0} max={4} value={btnCfg.borderWidth ?? 1} onChange={(e) => updateOptSel('button', { borderWidth: Number(e.target.value) })} className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Indre afstand ({btnCfg.paddingPx ?? 12}px)</label>
                                        <input type="range" min={4} max={32} value={btnCfg.paddingPx ?? 12} onChange={(e) => updateOptSel('button', { paddingPx: Number(e.target.value) })} className="w-full" />
                                    </div>
                                </div>
                                {btnCfg.borderWidth > 0 && (
                                    <ColorPickerWithSwatches label="Kantfarve" value={btnCfg.borderColor || ""} onChange={(v) => updateOptSel('button', { borderColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                )}
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input type="checkbox" checked={!!btnCfg.hoverRingEnabled} onChange={(e) => updateOptSel('button', { hoverRingEnabled: e.target.checked })} />
                                    Vis ring ved hover
                                </label>
                            </CardContent>
                        </Card>

                        {/* ── Images ── */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billede-grid</CardTitle>
                                <CardDescription className="text-[11px]">Stil når display-type er "Ikon-grid"</CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches label="Baggrund" value={imgCfg.bgColor || ""} onChange={(v) => updateOptSel('image', { bgColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Valgt baggrund" value={imgCfg.selectedBgColor || ""} onChange={(v) => updateOptSel('image', { selectedBgColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Valgt ring" value={imgCfg.selectedRingColor || ""} onChange={(v) => updateOptSel('image', { selectedRingColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Label farve" value={imgCfg.labelColor || ""} onChange={(v) => updateOptSel('image', { labelColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Billedstørrelse ({imgCfg.sizePx ?? 144}px)</label>
                                        <input type="range" min={48} max={300} value={imgCfg.sizePx ?? 144} onChange={(e) => updateOptSel('image', { sizePx: Number(e.target.value) })} className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Afrunding ({imgCfg.borderRadius ?? 8}px)</label>
                                        <input type="range" min={0} max={32} value={imgCfg.borderRadius ?? 8} onChange={(e) => updateOptSel('image', { borderRadius: Number(e.target.value) })} className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Label størrelse ({imgCfg.labelSizePx ?? 14}px)</label>
                                        <input type="range" min={10} max={22} value={imgCfg.labelSizePx ?? 14} onChange={(e) => updateOptSel('image', { labelSizePx: Number(e.target.value) })} className="w-full" />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input type="checkbox" checked={imgCfg.hoverRingEnabled !== false} onChange={(e) => updateOptSel('image', { hoverRingEnabled: e.target.checked })} />
                                    Vis ring ved hover
                                </label>
                                {imgCfg.hoverRingEnabled !== false && (
                                    <ColorPickerWithSwatches label="Hover ring farve" value={imgCfg.hoverRingColor || ""} onChange={(v) => updateOptSel('image', { hoverRingColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                )}
                            </CardContent>
                        </Card>

                        {/* ── Dropdown ── */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dropdown</CardTitle>
                                <CardDescription className="text-[11px]">Stil når display-type er "Dropdown"</CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches label="Baggrund" value={ddCfg.bgColor || ""} onChange={(v) => updateOptSel('dropdown', { bgColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Tekst" value={ddCfg.textColor || ""} onChange={(v) => updateOptSel('dropdown', { textColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Kantfarve" value={ddCfg.borderColor || ""} onChange={(v) => updateOptSel('dropdown', { borderColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Afrunding ({ddCfg.borderRadius ?? 6}px)</label>
                                    <input type="range" min={0} max={24} value={ddCfg.borderRadius ?? 6} onChange={(e) => updateOptSel('dropdown', { borderRadius: Number(e.target.value) })} className="w-full" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Checkboxes ── */}
                        <Card className="border-0 bg-muted/30">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Afkrydsningsfelter</CardTitle>
                                <CardDescription className="text-[11px]">Stil når display-type er "Afkrydsningsfelter"</CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches label="Aktiv farve" value={cbCfg.accentColor || ""} onChange={(v) => updateOptSel('checkbox', { accentColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                    <ColorPickerWithSwatches label="Label farve" value={cbCfg.labelColor || ""} onChange={(v) => updateOptSel('checkbox', { labelColor: v })} savedSwatches={sw} onSaveSwatch={onSave} onRemoveSwatch={onRemove} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Label størrelse ({cbCfg.labelSizePx ?? 14}px)</label>
                                    <input type="range" min={10} max={22} value={cbCfg.labelSizePx ?? 14} onChange={(e) => updateOptSel('checkbox', { labelSizePx: Number(e.target.value) })} className="w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            default:
                return <div>Ukendt sektion: {activeSection}</div>;
        }
    };

    return (
        <BrandingPaletteProvider colors={editor.draft.colors || {}}>
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
                                    <div className="text-xs font-semibold text-foreground">
                                        {currentPreviewPageLabel}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate">
                                        {currentPreviewPage}
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
                        {activeSection && (
                            <div className="border-b bg-muted/30">
                                <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide">
                                    <button
                                        className="flex items-center gap-1 shrink-0 h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        onClick={() => setActiveSection(null)}
                                    >
                                        <ArrowLeft className="h-3 w-3" />
                                        <span>Menu</span>
                                    </button>
                                    <div className="w-px h-4 bg-border shrink-0" />
                                    {SECTION_BUTTON_CONFIGS.filter(c => allowedSections.has(c.id)).map(config => {
                                        const Icon = config.icon;
                                        const isActive = activeSection === config.id;
                                        return (
                                            <button
                                                key={config.id}
                                                title={config.label}
                                                onClick={() => setActiveSection(config.id)}
                                                className={`flex items-center gap-1 shrink-0 h-7 px-2 rounded-md text-[11px] font-medium transition-colors ${
                                                    isActive
                                                        ? 'bg-foreground text-background'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                                }`}
                                            >
                                                <Icon className="h-3 w-3" />
                                                <span className="hidden sm:inline">{config.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                        <div className="flex-1 w-full bg-white rounded-b-lg border border-t-0 overflow-hidden">
                            <SiteDesignPreviewFrame
                                branding={editor.draft}
                                previewUrl={`/preview-shop?draft=1&tenantId=${editor.entityId}`}
                                tenantName={editor.entityName}
                                onSaveDraft={editor.saveDraft}
                                onResetDesign={() => setShowResetDialog(true)}
                                navigationRequest={previewNavigationRequest}
                                onPreviewPathChange={setCurrentPreviewPage}
                                editMode={previewEditMode}
                                onEditModeChange={setPreviewEditMode}
                                clearSelectionSignal={clearSelectionSignal}
                            />
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
        </BrandingPaletteProvider>
    );
}
