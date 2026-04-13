
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
    const [focusedProductOption, setFocusedProductOption] = useState<{ productId: string; sectionId: string | null } | null>(null);
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
        
        // For product-option-button clicks, open the sidebar instead of contextual popup
        const isProductOptionButton = contextualSelection?.kind === 'product-option-button';

        if (isProductOptionButton && contextualSelection.kind === "product-option-button") {
            setFocusedProductOption({
                productId: contextualSelection.productId,
                sectionId: contextualSelection.sectionId,
            });
        } else if (selection?.sectionId === "produktvalgknapper" && currentPreviewProduct?.id) {
            setFocusedProductOption({
                productId: currentPreviewProduct.id,
                sectionId: null,
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

        // Only show contextual editor for non-product-option clicks
        if (!isProductOptionButton) {
            setContextualEditor(contextualSelection);
        } else {
            setContextualEditor(null);
        }

        if (!contextualSelection || isProductOptionButton) {
            // Clear any existing selection highlight in preview
            setClearSelectionSignal(prev => prev + 1);
        }

        setFocusRequestId((current) => current + 1);
        // Open sidebar for product-option clicks too
        if (!contextualSelection || isProductOptionButton) {
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
            case 'theme':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Tema</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeSection}>Luk</Button>
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
                                Disse farver styrer de delte tema-farver på både live forside og live produktsider.
                                Hero-knapper, header-CTA/dropdowns og forside-produktknapper redigeres stadig i deres egne sektioner.
                            </div>
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
