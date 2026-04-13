/**
 * ProduktvalgknapperSection - Per-product button styling configuration
 * 
 * This component allows editing of button styling for individual products:
 * - Text button colors, hover states, border radius
 * - Picture button size, display mode, hover effects
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { CloudUpload, Image as ImageIcon, Loader2, MousePointer2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontSelector } from "@/components/admin/FontSelector";
import { OptionSelectorStyleEditor } from "@/components/admin/OptionSelectorStyleEditor";
import { useProductAttributes } from "@/hooks/useProductAttributes";
import { getHiResThumbnailUrl } from "@/lib/pricing/thumbnailImageUrl";
import {
    THUMBNAIL_CUSTOM_PX_MAX,
    THUMBNAIL_CUSTOM_PX_MIN,
    THUMBNAIL_CUSTOM_PX_STEP,
    THUMBNAIL_SIZE_OPTIONS,
    normalizeThumbnailCustomPx,
    normalizeThumbnailSize,
    resolveThumbnailSizePx,
    type ThumbnailSizeMode,
} from "@/lib/pricing/thumbnailSizes";
import {
    getOptionImageUrl,
    getThumbnailSizeFromUiMode,
    isPictureUiMode,
    resolvePictureButtonsConfig,
    resolvePictureButtonStateStyles,
    resolveTextButtonsConfig,
} from "@/lib/pricing/selectorStyling";
import {
    DEFAULT_TEXT_BUTTON_STYLING,
    DEFAULT_PICTURE_BUTTON_STYLING,
    type LayoutValueSetting,
    type MatrixLayoutV1,
    type SelectorStyling,
    type SectionType,
    type TextButtonStyling,
    type PictureButtonStyling,
    type UiMode,
} from "@/types/pricingStructure";

type SelectorUiMode = Extract<
    UiMode,
    "buttons" | "dropdown" | "checkboxes" | "hidden" | "small" | "medium" | "large" | "xl" | "xl_notext"
>;

interface SectionConfig {
    id: string;
    title: string;
    sectionType: SectionType;
    groupId: string;
    valueIds: string[];
    uiMode: SelectorUiMode;
    selectionMode: "required" | "optional" | "free";
    selectorStyling: SelectorStyling;
    valueSettings: Record<string, LayoutValueSetting>;
    thumbnailSize: ThumbnailSizeMode;
    thumbnailCustomPx?: number;
    isVerticalAxis?: boolean;
}

interface Product {
    id: string;
    name: string;
    slug: string;
    pricing_structure?: (MatrixLayoutV1 & {
        matrixBox?: {
            backgroundColor?: string;
            borderRadiusPx?: number;
            borderWidthPx?: number;
            borderColor?: string;
            paddingPx?: number;
        };
        vertical_axis?: MatrixLayoutV1["vertical_axis"] & {
            selection_mode?: "required" | "optional" | "free";
        };
        layout_rows?: Array<
            Omit<MatrixLayoutV1["layout_rows"][number], "columns"> & {
                columns: Array<
                    MatrixLayoutV1["layout_rows"][number]["columns"][number] & {
                        selection_mode?: "required" | "optional" | "free";
                    }
                >;
            }
        >;
        buttonStyling?: {
            textButtons?: Partial<TextButtonStyling>;
            pictureButtons?: Partial<PictureButtonStyling>;
        };
    }) | null;
}

interface ProduktvalgknapperSectionProps {
    tenantId: string;
    savedSwatches: string[];
    onSaveSwatch: (color: string) => void;
    onRemoveSwatch: (color: string) => void;
    onPreviewProductChange?: (product: { id: string; slug: string; path: string }) => void;
    onPreviewPricingStructureChange?: (preview: { productId: string; pricingStructure: MatrixLayoutV1 | Record<string, unknown>; isDirty: boolean } | null) => void;
    persistedPricingStructure?: { productId: string; pricingStructure: MatrixLayoutV1 | Record<string, unknown> } | null;
    focusedProductId?: string | null;
    focusedSectionId?: string | null;
}

const UI_MODE_OPTIONS: Array<{ value: SelectorUiMode; label: string }> = [
    { value: "buttons", label: "Knapper" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkboxes", label: "Checkboxes" },
    { value: "hidden", label: "Skjul" },
    { value: "small", label: "Billeder S (20px)" },
    { value: "medium", label: "Billeder M (32px)" },
    { value: "large", label: "Billeder L (48px)" },
    { value: "xl", label: "Billeder XL + tekst" },
    { value: "xl_notext", label: "Billeder XL kun foto" },
];

const DISPLAY_MODE_OPTIONS: Array<{
    value: NonNullable<PictureButtonStyling["displayMode"]>;
    label: string;
}> = [
    { value: "text_only", label: "Kun tekst" },
    { value: "image_only", label: "Kun billede" },
    { value: "text_and_image", label: "Tekst + billede" },
    { value: "text_below_image", label: "Tekst under billede" },
];

const SIDEBAR_PREVIEW_MAX_THUMB_SIZE = 64;
const SIDEBAR_PREVIEW_MAX_GAP = 12;
const SIDEBAR_PREVIEW_MAX_LABEL_SIZE = 13;
const SIDEBAR_ASSET_THUMB_SIZE = 48;

function ColorHelpField({
    help,
    children,
}: {
    help: string;
    children: ReactNode;
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2 items-start">
            <div className="min-w-0">{children}</div>
            <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                {help}
            </p>
        </div>
    );
}

const normalizeUiMode = (value?: string | null): SelectorUiMode => {
    switch (value) {
        case "dropdown":
        case "checkboxes":
        case "hidden":
        case "small":
        case "medium":
        case "large":
        case "xl":
        case "xl_notext":
            return value;
        case "buttons":
        default:
            return "buttons";
    }
};

export function ProduktvalgknapperSection({
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    onPreviewProductChange,
    onPreviewPricingStructureChange,
    persistedPricingStructure,
    focusedProductId,
    focusedSectionId,
}: ProduktvalgknapperSectionProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [hydratedProductId, setHydratedProductId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedProductChanges, setHasUnsavedProductChanges] = useState(false);
    const [activeTab, setActiveTab] = useState("sections");
    
    // Text button state
    const [textButtons, setTextButtons] = useState<TextButtonStyling>(DEFAULT_TEXT_BUTTON_STYLING);
    
    // Picture button state
    const [pictureButtons, setPictureButtons] = useState<PictureButtonStyling>(DEFAULT_PICTURE_BUTTON_STYLING);
    
    // Section configurations
    const [sections, setSections] = useState<SectionConfig[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingTarget, setUploadingTarget] = useState<{ sectionId: string; valueId: string } | null>(null);
    
    // Matrix box styling
    const [matrixBox, setMatrixBox] = useState({
        backgroundColor: "#FFFFFF",
        borderRadiusPx: 12,
        borderWidthPx: 1,
        borderColor: "#E2E8F0",
        paddingPx: 16,
    });

    const productAttrs = useProductAttributes(selectedProductId || undefined, tenantId);

    const valuesById = useMemo(() => {
        const next = new Map<string, { id: string; name: string }>();
        productAttrs.groups.forEach((group) => {
            (group.values || []).forEach((value) => {
                next.set(value.id, {
                    id: value.id,
                    name: value.name,
                });
            });
        });
        return next;
    }, [productAttrs.groups]);

    const groupsById = useMemo(() => {
        const next = new Map<string, string>();
        productAttrs.groups.forEach((group) => {
            next.set(group.id, group.name);
        });
        return next;
    }, [productAttrs.groups]);

    // Load products on mount
    useEffect(() => {
        async function loadProducts() {
            if (!tenantId) return;
            
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('id, name, slug, pricing_structure')
                .eq('tenant_id', tenantId)
                .order('name');

            if (error) {
                console.error('Error loading products:', error);
                toast.error('Kunne ikke indlæse produkter');
            } else {
                setProducts((data || []) as Product[]);
            }
            setLoading(false);
        }

        loadProducts();
    }, [tenantId]);

    useEffect(() => {
        if (focusedProductId && focusedProductId !== selectedProductId) {
            setSelectedProductId(focusedProductId);
        }
    }, [focusedProductId, selectedProductId]);

    useEffect(() => {
        if (focusedProductId || focusedSectionId) {
            setActiveTab("sections");
        }
    }, [focusedProductId, focusedSectionId]);

    const handleSelectedProductChange = useCallback((productId: string) => {
        setSelectedProductId(productId);

        const product = products.find((candidate) => candidate.id === productId);
        if (!product?.slug) return;

        onPreviewProductChange?.({
            id: product.id,
            slug: product.slug,
            path: `/produkt/${product.slug}`,
        });
    }, [onPreviewProductChange, products]);

    const buildUpdatedStructure = useCallback((product?: Product | null) => {
        const currentStructure = (product?.pricing_structure || { mode: 'matrix_layout_v1', version: 1 }) as MatrixLayoutV1 & Record<string, any>;
        const sectionMap = new Map(sections.map((section) => [section.id, section]));

        const currentVerticalAxis = currentStructure.vertical_axis;
        const updatedVerticalAxis = currentVerticalAxis
            ? (() => {
                const section = sectionMap.get(currentVerticalAxis.sectionId);
                if (!section) return currentVerticalAxis;
                return {
                    ...currentVerticalAxis,
                    title: section.title,
                    ui_mode: section.uiMode,
                    selection_mode: section.selectionMode,
                    valueSettings: section.valueSettings,
                    selectorStyling: section.selectorStyling,
                    thumbnail_size: section.thumbnailSize,
                    thumbnail_custom_px: section.thumbnailCustomPx,
                };
            })()
            : currentVerticalAxis;

        return {
            ...currentStructure,
            buttonStyling: {
                textButtons,
                pictureButtons,
            },
            matrixBox,
            vertical_axis: updatedVerticalAxis,
            layout_rows: (currentStructure.layout_rows || []).map((row: any) => ({
                ...row,
                columns: (row.columns || []).map((column: any) => {
                    const section = sectionMap.get(column.id);
                    if (!section) return column;
                    return {
                        ...column,
                        title: section.title,
                        ui_mode: section.uiMode,
                        selection_mode: section.selectionMode,
                        valueSettings: section.valueSettings,
                        selectorStyling: section.selectorStyling,
                        thumbnail_size: section.thumbnailSize,
                        thumbnail_custom_px: section.thumbnailCustomPx,
                    };
                }),
            })),
        };
    }, [matrixBox, pictureButtons, sections, textButtons]);

    // Load product's button styling and sections when selection changes
    useEffect(() => {
        if (!selectedProductId) {
            setTextButtons(DEFAULT_TEXT_BUTTON_STYLING);
            setPictureButtons(DEFAULT_PICTURE_BUTTON_STYLING);
            setSections([]);
            setHydratedProductId("");
            setHasUnsavedProductChanges(false);
            return;
        }

        const product = products.find(p => p.id === selectedProductId);
        const structure = product?.pricing_structure;

        // Load button styling
        if (structure?.buttonStyling) {
            const { textButtons: tb, pictureButtons: pb } = structure.buttonStyling;
            setTextButtons({ ...DEFAULT_TEXT_BUTTON_STYLING, ...tb });
            setPictureButtons({ ...DEFAULT_PICTURE_BUTTON_STYLING, ...pb });
        } else {
            setTextButtons(DEFAULT_TEXT_BUTTON_STYLING);
            setPictureButtons(DEFAULT_PICTURE_BUTTON_STYLING);
        }

        // Load matrix box styling
        if (structure?.matrixBox) {
            setMatrixBox(prev => ({ ...prev, ...structure.matrixBox }));
        } else {
            setMatrixBox({
                backgroundColor: "#FFFFFF",
                borderRadiusPx: 12,
                borderWidthPx: 1,
                borderColor: "#E2E8F0",
                paddingPx: 16,
            });
        }

        if (!structure || structure.mode !== "matrix_layout_v1") {
            setSections([]);
            setHydratedProductId(selectedProductId);
            return;
        }

        const loadedSections: SectionConfig[] = [];

        if (structure.vertical_axis) {
            const va = structure.vertical_axis;
            const uiMode = normalizeUiMode(va.ui_mode);
            loadedSections.push({
                id: va.sectionId,
                title: va.title || groupsById.get(va.groupId) || 'Hovedvalg',
                sectionType: va.sectionType,
                groupId: va.groupId,
                valueIds: [...(va.valueIds || [])],
                uiMode,
                selectionMode: va.selection_mode || "required",
                selectorStyling: va.selectorStyling || {},
                valueSettings: va.valueSettings || {},
                thumbnailSize: normalizeThumbnailSize(va.thumbnail_size || getThumbnailSizeFromUiMode(uiMode)),
                thumbnailCustomPx: normalizeThumbnailCustomPx(va.thumbnail_custom_px),
                isVerticalAxis: true,
            });
        }

        structure.layout_rows?.forEach((row) => {
            row.columns?.forEach((col) => {
                const uiMode = normalizeUiMode(col.ui_mode);
                loadedSections.push({
                    id: col.id,
                    title: col.title || groupsById.get(col.groupId) || col.id,
                    sectionType: col.sectionType,
                    groupId: col.groupId,
                    valueIds: [...(col.valueIds || [])],
                    uiMode,
                    selectionMode: col.selection_mode || "required",
                    selectorStyling: col.selectorStyling || {},
                    valueSettings: col.valueSettings || {},
                    thumbnailSize: normalizeThumbnailSize(col.thumbnail_size || getThumbnailSizeFromUiMode(uiMode)),
                    thumbnailCustomPx: normalizeThumbnailCustomPx(col.thumbnail_custom_px),
                    isVerticalAxis: false,
                });
            });
        });

        setSections(loadedSections);
        setHydratedProductId(selectedProductId);
        setHasUnsavedProductChanges(false);
    }, [selectedProductId, products, groupsById]);

    useEffect(() => {
        if (!onPreviewPricingStructureChange) return;

        if (!selectedProductId) {
            onPreviewPricingStructureChange(null);
            return;
        }
        if (hydratedProductId !== selectedProductId) return;

        const product = products.find((candidate) => candidate.id === selectedProductId);
        if (!product) return;

        onPreviewPricingStructureChange({
            productId: selectedProductId,
            pricingStructure: buildUpdatedStructure(product),
            isDirty: hasUnsavedProductChanges,
        });
    }, [buildUpdatedStructure, hasUnsavedProductChanges, hydratedProductId, onPreviewPricingStructureChange, products, selectedProductId]);

    useEffect(() => {
        if (!persistedPricingStructure?.productId) return;

        setProducts((prev) => prev.map((product) => (
            product.id === persistedPricingStructure.productId
                ? {
                    ...product,
                    pricing_structure: persistedPricingStructure.pricingStructure as Product["pricing_structure"],
                }
                : product
        )));

        if (persistedPricingStructure.productId === selectedProductId) {
            setHasUnsavedProductChanges(false);
        }
    }, [persistedPricingStructure, selectedProductId]);

    useEffect(() => {
        if (!focusedSectionId || activeTab !== "sections" || hydratedProductId !== selectedProductId) return;

        const timeoutId = window.setTimeout(() => {
            const element = document.getElementById(`site-design-focus-produktvalg-section-${focusedSectionId}`);
            if (!element) return;

            element.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);

        return () => window.clearTimeout(timeoutId);
    }, [activeTab, focusedSectionId, hydratedProductId, selectedProductId]);

    const handleSave = useCallback(async () => {
        if (!selectedProductId) {
            toast.error('Vælg et produkt først');
            return;
        }

        setSaving(true);

        const product = products.find(p => p.id === selectedProductId);
        const updatedStructure = buildUpdatedStructure(product);

        const { error } = await supabase
            .from('products')
            .update({ pricing_structure: updatedStructure })
            .eq('id', selectedProductId);

        if (error) {
            console.error('Error saving button styling:', error);
            toast.error('Kunne ikke gemme indstillinger');
        } else {
            toast.success('Indstillinger gemt');
            // Update local state
            setProducts(prev => prev.map(p => 
                p.id === selectedProductId 
                    ? { ...p, pricing_structure: updatedStructure }
                    : p
            ));
            setHasUnsavedProductChanges(false);
        }

        setSaving(false);
    }, [buildUpdatedStructure, selectedProductId, products]);

    const updateTextButton = (key: keyof TextButtonStyling, value: string | number) => {
        setHasUnsavedProductChanges(true);
        setTextButtons(prev => ({ ...prev, [key]: value }));
    };

    const updatePictureButton = (key: keyof PictureButtonStyling, value: string | number | boolean) => {
        setHasUnsavedProductChanges(true);
        setPictureButtons(prev => ({ ...prev, [key]: value }));
    };

    const updateSectionConfig = (sectionId: string, updates: Partial<SectionConfig>) => {
        setHasUnsavedProductChanges(true);
        setSections(prev => prev.map(s => 
            s.id === sectionId
                ? {
                    ...s,
                    ...updates,
                    thumbnailSize: updates.uiMode
                        ? (isPictureUiMode(updates.uiMode) ? getThumbnailSizeFromUiMode(updates.uiMode) : s.thumbnailSize)
                        : (updates.thumbnailSize || s.thumbnailSize),
                    thumbnailCustomPx: updates.uiMode ? undefined : updates.thumbnailCustomPx ?? s.thumbnailCustomPx,
                }
                : s
        ));
    };

    const updateSectionSelectorStyling = (sectionId: string, selectorStyling: SelectorStyling) => {
        setHasUnsavedProductChanges(true);
        setSections((prev) => prev.map((section) => (
            section.id === sectionId ? { ...section, selectorStyling } : section
        )));
    };

    const updateSectionValueSetting = (
        sectionId: string,
        valueId: string,
        updates: Partial<LayoutValueSetting>,
    ) => {
        setHasUnsavedProductChanges(true);
        setSections((prev) => prev.map((section) => {
            if (section.id !== sectionId) return section;
            return {
                ...section,
                valueSettings: {
                    ...section.valueSettings,
                    [valueId]: {
                        ...(section.valueSettings[valueId] || {}),
                        ...updates,
                    },
                },
            };
        }));
    };

    const updateMatrixBox = (updates: Partial<typeof matrixBox>) => {
        setHasUnsavedProductChanges(true);
        setMatrixBox((prev) => ({ ...prev, ...updates }));
    };

    const getDisplayName = useCallback((section: SectionConfig, valueId: string) => {
        const override = section.valueSettings[valueId]?.displayName?.trim();
        if (override) return override;
        return valuesById.get(valueId)?.name || valueId;
    }, [valuesById]);

    const triggerUpload = (sectionId: string, valueId: string) => {
        setUploadingTarget({ sectionId, valueId });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file || !uploadingTarget || !selectedProductId) return;

        try {
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${selectedProductId}-selector-${uploadingTarget.sectionId}-${uploadingTarget.valueId}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

            updateSectionValueSetting(uploadingTarget.sectionId, uploadingTarget.valueId, {
                customImage: data.publicUrl,
                showThumbnail: true,
            });
            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Upload fejlede');
        } finally {
            setUploadingTarget(null);
            input.value = "";
        }
    }, [selectedProductId, updateSectionValueSetting, uploadingTarget]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div id="site-design-focus-produktvalgknapper" className="min-w-0 space-y-4 overflow-x-hidden px-2 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MousePointer2 className="h-5 w-5 text-orange-600" />
                    <h3 className="text-sm font-medium">Produktvalgknapper</h3>
                </div>
            </div>

            {/* Product Selector */}
            <Card className="overflow-hidden">
                <CardHeader className="space-y-1 p-3 pb-0">
                    <CardTitle className="text-sm">Vælg produkt</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        Vælg det produkt du vil style knapperne for. Indstillingerne gemmes per produkt.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3 pt-3">
                    <Select
                        value={selectedProductId}
                        onValueChange={handleSelectedProductChange}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Vælg et produkt..." />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedProductId && (
                        <div className="flex justify-end">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                size="sm"
                                className="gap-2"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Gem indstillinger
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {!selectedProductId ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/25 px-4 py-8 text-center">
                    <MousePointer2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                        Vælg et produkt ovenfor for at konfigurere knap-styling
                    </p>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
                        <TabsTrigger value="sections" className="h-auto whitespace-normal px-2 py-1.5 text-[11px] leading-tight">Sektioner</TabsTrigger>
                        <TabsTrigger value="text" className="h-auto whitespace-normal px-2 py-1.5 text-[11px] leading-tight">Tekst Knapper</TabsTrigger>
                        <TabsTrigger value="picture" className="h-auto whitespace-normal px-2 py-1.5 text-[11px] leading-tight">Billed Knapper</TabsTrigger>
                        <TabsTrigger value="matrix" className="h-auto whitespace-normal px-2 py-1.5 text-[11px] leading-tight">Matrix Boks</TabsTrigger>
                    </TabsList>

                    {/* Text Buttons Tab */}
                    <TabsContent value="text" className="mt-3 space-y-3">
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Farver</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Baggrund og tekstfarver for knapperne
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 p-3 pt-3">
                                <div className="grid gap-4">
                                    <ColorPickerWithSwatches
                                        label="Baggrund"
                                        value={textButtons.backgroundColor}
                                        onChange={(color) => updateTextButton('backgroundColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Hover baggrund"
                                        value={textButtons.hoverBackgroundColor}
                                        onChange={(color) => updateTextButton('hoverBackgroundColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Tekst"
                                        value={textButtons.textColor}
                                        onChange={(color) => updateTextButton('textColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Hover tekst"
                                        description="Tekstfarve når musen er over knappen"
                                        value={textButtons.hoverTextColor}
                                        onChange={(color) => updateTextButton('hoverTextColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                </div>

                                <Separator />

                                <div className="grid gap-4">
                                    <ColorPickerWithSwatches
                                        label="Valgt baggrund"
                                        value={textButtons.selectedBackgroundColor}
                                        onChange={(color) => updateTextButton('selectedBackgroundColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Valgt tekst"
                                        value={textButtons.selectedTextColor}
                                        onChange={(color) => updateTextButton('selectedTextColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Form og størrelse</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-3 pt-3">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Hjørnerunding</Label>
                                        <span className="text-xs text-muted-foreground">{textButtons.borderRadiusPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={30}
                                        step={1}
                                        value={[textButtons.borderRadiusPx]}
                                        onValueChange={([value]) => updateTextButton('borderRadiusPx', value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Kantbredde</Label>
                                        <span className="text-xs text-muted-foreground">{textButtons.borderWidthPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={4}
                                        step={1}
                                        value={[textButtons.borderWidthPx]}
                                        onValueChange={([value]) => updateTextButton('borderWidthPx', value)}
                                    />
                                </div>

                                <div className="grid gap-4">
                                    <ColorPickerWithSwatches
                                        label="Kantfarve"
                                        value={textButtons.borderColor}
                                        onChange={(color) => updateTextButton('borderColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Hover kantfarve"
                                        value={textButtons.hoverBorderColor}
                                        onChange={(color) => updateTextButton('hoverBorderColor', color)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label>Skrifttype</Label>
                                    <FontSelector
                                        value={textButtons.fontFamily || "inherit"}
                                        onChange={(v) => updateTextButton('fontFamily', v === "inherit" ? "" : v)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Tekststørrelse</Label>
                                        <span className="text-xs text-muted-foreground">{textButtons.fontSizePx}px</span>
                                    </div>
                                    <Slider
                                        min={10}
                                        max={20}
                                        step={1}
                                        value={[textButtons.fontSizePx]}
                                        onValueChange={([value]) => updateTextButton('fontSizePx', value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Knaphøjde</Label>
                                        <span className="text-xs text-muted-foreground">{textButtons.minHeightPx}px</span>
                                    </div>
                                    <Slider
                                        min={32}
                                        max={64}
                                        step={2}
                                        value={[textButtons.minHeightPx]}
                                        onValueChange={([value]) => updateTextButton('minHeightPx', value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Indvendig afstand (padding)</Label>
                                        <span className="text-xs text-muted-foreground">{textButtons.paddingPx}px</span>
                                    </div>
                                    <Slider
                                        min={4}
                                        max={24}
                                        step={2}
                                        value={[textButtons.paddingPx]}
                                        onValueChange={([value]) => updateTextButton('paddingPx', value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Forhåndsvisning</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-3">
                                <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/25 p-3">
                                    <button
                                        className="transition-all duration-200"
                                        style={{
                                            backgroundColor: textButtons.backgroundColor,
                                            color: textButtons.textColor,
                                            borderRadius: `${textButtons.borderRadiusPx}px`,
                                            borderWidth: `${textButtons.borderWidthPx}px`,
                                            borderStyle: 'solid',
                                            borderColor: textButtons.borderColor,
                                            padding: `${textButtons.paddingPx}px 16px`,
                                            fontSize: `${textButtons.fontSizePx}px`,
                                            minHeight: `${textButtons.minHeightPx}px`,
                                            fontFamily: textButtons.fontFamily || 'inherit',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = textButtons.hoverBackgroundColor;
                                            e.currentTarget.style.color = textButtons.hoverTextColor;
                                            e.currentTarget.style.borderColor = textButtons.hoverBorderColor;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = textButtons.backgroundColor;
                                            e.currentTarget.style.color = textButtons.textColor;
                                            e.currentTarget.style.borderColor = textButtons.borderColor;
                                        }}
                                    >
                                        Normal knap
                                    </button>
                                    <button
                                        style={{
                                            backgroundColor: textButtons.selectedBackgroundColor,
                                            color: textButtons.selectedTextColor,
                                            borderRadius: `${textButtons.borderRadiusPx}px`,
                                            borderWidth: `${textButtons.borderWidthPx}px`,
                                            borderStyle: 'solid',
                                            borderColor: textButtons.selectedBackgroundColor,
                                            padding: `${textButtons.paddingPx}px 16px`,
                                            fontSize: `${textButtons.fontSizePx}px`,
                                            minHeight: `${textButtons.minHeightPx}px`,
                                            fontFamily: textButtons.fontFamily || 'inherit',
                                        }}
                                    >
                                        Valgt knap
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Picture Buttons Tab */}
                    <TabsContent value="picture" className="mt-3 space-y-3">
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Visning</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Størrelse og layout for billedknapper
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 p-3 pt-3">
                                <div className="space-y-2">
                                    <Label>Størrelse</Label>
                                    <Select
                                        value={pictureButtons.size}
                                        onValueChange={(value) => updatePictureButton('size', value as PictureButtonStyling['size'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="small">Lille (64x64px)</SelectItem>
                                            <SelectItem value="medium">Medium (80x80px)</SelectItem>
                                            <SelectItem value="large">Stor (96x96px)</SelectItem>
                                            <SelectItem value="xl">Extra stor (120x120px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Visningstilstand</Label>
                                    <Select
                                        value={pictureButtons.displayMode}
                                        onValueChange={(value) => updatePictureButton('displayMode', value as PictureButtonStyling['displayMode'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text_and_image">Tekst + Billede side om side</SelectItem>
                                            <SelectItem value="text_below_image">Tekst under billede</SelectItem>
                                            <SelectItem value="image_only">Kun billede</SelectItem>
                                            <SelectItem value="text_only">Kun tekst</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                                    <div>
                                        <div className="text-xs font-medium">Ingen baggrund</div>
                                        <div className="text-[11px] text-muted-foreground">Lad transparente PNG-valg stå uden baggrundsflade.</div>
                                    </div>
                                    <Switch
                                        checked={pictureButtons.transparentBackground === true}
                                        onCheckedChange={(checked) => updatePictureButton('transparentBackground', checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                                    <div>
                                        <div className="text-xs font-medium">Tekst udenfor billede</div>
                                        <div className="text-[11px] text-muted-foreground">Vis navnet under billedfeltet i stedet for inde i selve billedboksen.</div>
                                    </div>
                                    <Switch
                                        checked={pictureButtons.labelOutsideImage === true}
                                        onCheckedChange={(checked) => updatePictureButton('labelOutsideImage', checked)}
                                    />
                                </div>

                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Tekststørrelse</Label>
                                            <span className="text-xs text-muted-foreground">{pictureButtons.labelFontSizePx}px</span>
                                        </div>
                                        <Slider
                                            min={9}
                                            max={24}
                                            step={1}
                                            value={[pictureButtons.labelFontSizePx]}
                                            onValueChange={([value]) => updatePictureButton('labelFontSizePx', value)}
                                        />
                                    </div>
                                    {!pictureButtons.transparentBackground && (
                                        <ColorHelpField help="Fladen bag selve billedet eller placeholderen.">
                                            <ColorPickerWithSwatches
                                                label="Baggrundsfarve"
                                                value={pictureButtons.backgroundColor}
                                                onChange={(color) => updatePictureButton('backgroundColor', color)}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                                compact
                                                showFullSwatches={false}
                                            />
                                        </ColorHelpField>
                                    )}
                                    <ColorHelpField help="Ekstra baggrundstone hvis hover-layoutet bruger en baggrund.">
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={pictureButtons.hoverBackgroundColor}
                                            onChange={(color) => updatePictureButton('hoverBackgroundColor', color)}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                            compact
                                            showFullSwatches={false}
                                        />
                                    </ColorHelpField>
                                    <ColorHelpField help="Navnet paa valget under eller ved billedet.">
                                        <ColorPickerWithSwatches
                                            label="Tekstfarve"
                                            value={pictureButtons.textColor}
                                            onChange={(color) => updatePictureButton('textColor', color)}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                            compact
                                            showFullSwatches={false}
                                        />
                                    </ColorHelpField>
                                    <ColorHelpField help="Tekstfarven naar et valg bliver holdt over.">
                                        <ColorPickerWithSwatches
                                            label="Hover tekstfarve"
                                            value={pictureButtons.hoverTextColor}
                                            onChange={(color) => updatePictureButton('hoverTextColor', color)}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                            compact
                                            showFullSwatches={false}
                                        />
                                    </ColorHelpField>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Billed-runding</Label>
                                        <span className="text-xs text-muted-foreground">{pictureButtons.imageBorderRadiusPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={20}
                                        step={1}
                                        value={[pictureButtons.imageBorderRadiusPx]}
                                        onValueChange={([value]) => updatePictureButton('imageBorderRadiusPx', value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Afstand mellem knapper</Label>
                                        <span className="text-xs text-muted-foreground">{pictureButtons.gapBetweenPx}px</span>
                                    </div>
                                    <Slider
                                        min={4}
                                        max={24}
                                        step={2}
                                        value={[pictureButtons.gapBetweenPx]}
                                        onValueChange={([value]) => updatePictureButton('gapBetweenPx', value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Hover effekter</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-3 pt-3">
                                <div className="flex items-center justify-between">
                                    <Label>Vis hover-overlay</Label>
                                    <Switch
                                        checked={pictureButtons.hoverEnabled}
                                        onCheckedChange={(checked) => updatePictureButton('hoverEnabled', checked)}
                                    />
                                </div>

                                {pictureButtons.hoverEnabled && (
                                    <>
                                        <ColorHelpField help="Overlay eller fyld naar hover-effekt er sat til Farve.">
                                            <ColorPickerWithSwatches
                                                label="Hover farve"
                                                value={pictureButtons.hoverColor}
                                                onChange={(color) => updatePictureButton('hoverColor', color)}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                                compact
                                                showFullSwatches={false}
                                            />
                                        </ColorHelpField>

                                        <div className="space-y-2">
                                            <Label>Hover opacitet ({Math.round(pictureButtons.hoverOpacity * 100)}%)</Label>
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={5}
                                                value={[Math.round(pictureButtons.hoverOpacity * 100)]}
                                                onValueChange={([value]) => updatePictureButton('hoverOpacity', value / 100)}
                                            />
                                        </div>

                                        <Separator />

                                        <ColorHelpField help="Overlay eller fyld naar valgt-effekt er sat til Farve.">
                                            <ColorPickerWithSwatches
                                                label="Valgt farve"
                                                value={pictureButtons.selectedColor}
                                                onChange={(color) => updatePictureButton('selectedColor', color)}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                                compact
                                                showFullSwatches={false}
                                            />
                                        </ColorHelpField>

                                        <div className="space-y-2">
                                            <Label>Valgt opacitet ({Math.round(pictureButtons.selectedOpacity * 100)}%)</Label>
                                            <p className="text-[11px] text-muted-foreground">
                                                Paavirker valgt farve og ring-effekten. Outline bruger kantens egen opacitet.
                                            </p>
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={5}
                                                value={[Math.round(pictureButtons.selectedOpacity * 100)]}
                                                onValueChange={([value]) => updatePictureButton('selectedOpacity', value / 100)}
                                            />
                                        </div>
                                    </>
                                )}

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <Label>Vis outline/kant</Label>
                                    <Switch
                                        checked={pictureButtons.outlineEnabled}
                                        onCheckedChange={(checked) => updatePictureButton('outlineEnabled', checked)}
                                    />
                                </div>

                                {pictureButtons.outlineEnabled && (
                                    <div className="space-y-2">
                                        <Label>Outline opacitet ({Math.round(pictureButtons.outlineOpacity * 100)}%)</Label>
                                        <Slider
                                            min={0}
                                            max={100}
                                            step={5}
                                            value={[Math.round(pictureButtons.outlineOpacity * 100)]}
                                            onValueChange={([value]) => updatePictureButton('outlineOpacity', value / 100)}
                                        />
                                    </div>
                                )}

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <Label>Zoom ved hover</Label>
                                    <Switch
                                        checked={pictureButtons.hoverZoomEnabled}
                                        onCheckedChange={(checked) => updatePictureButton('hoverZoomEnabled', checked)}
                                    />
                                </div>

                                {pictureButtons.hoverZoomEnabled && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Zoom-styrke ({pictureButtons.hoverZoomScale.toFixed(2)}x)</Label>
                                            <Slider
                                                min={100}
                                                max={120}
                                                step={1}
                                                value={[Math.round(pictureButtons.hoverZoomScale * 100)]}
                                                onValueChange={([value]) => updatePictureButton('hoverZoomScale', value / 100)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Animation-hastighed ({pictureButtons.hoverZoomDurationMs}ms)</Label>
                                            <Slider
                                                min={50}
                                                max={300}
                                                step={10}
                                                value={[pictureButtons.hoverZoomDurationMs]}
                                                onValueChange={([value]) => updatePictureButton('hoverZoomDurationMs', value)}
                                            />
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Sections Tab */}
                    <TabsContent value="sections" className="mt-3 space-y-3">
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Sektions-konfiguration</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Denne visning er koblet direkte til produktets rigtige selector-opsætning. Her kan du styre dropdown, billedknapper, størrelse og de enkelte thumbnails.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 p-3 pt-3">
                                {productAttrs.loading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : sections.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Ingen sektioner fundet for dette produkt
                                    </p>
                                ) : (
                                    sections.map((section) => {
                                        const previewValues = section.valueIds
                                            .map((valueId) => ({
                                                id: valueId,
                                                name: getDisplayName(section, valueId),
                                                imageUrl: getOptionImageUrl(section.valueSettings[valueId]),
                                                showThumbnail: section.valueSettings[valueId]?.showThumbnail,
                                            }))
                                            .filter((value) => value.name)
                                            .slice(0, 8);
                                        const thumbnailPx = resolveThumbnailSizePx(section.thumbnailSize, section.thumbnailCustomPx);
                                        const sectionTextButtonsConfig = resolveTextButtonsConfig({
                                            productConfig: textButtons,
                                            selectorConfig: section.selectorStyling?.textButtons as Record<string, unknown>,
                                        });
                                        const sectionPictureButtonsConfig = resolvePictureButtonsConfig({
                                            productConfig: pictureButtons,
                                            selectorConfig: section.selectorStyling?.pictureButtons as Record<string, unknown>,
                                            uiMode: section.uiMode,
                                            thumbnailSize: section.thumbnailSize,
                                            thumbnailCustomPx: section.thumbnailCustomPx,
                                        });
                                        const sidebarThumbPx = Math.min(thumbnailPx, SIDEBAR_PREVIEW_MAX_THUMB_SIZE);
                                        const sidebarPictureSizePx = Math.min(sectionPictureButtonsConfig.sizePx, SIDEBAR_PREVIEW_MAX_THUMB_SIZE);
                                        const sidebarGapPx = Math.min(sectionPictureButtonsConfig.gapBetweenPx, SIDEBAR_PREVIEW_MAX_GAP);
                                        const sidebarLabelFontSizePx = Math.min(
                                            sectionPictureButtonsConfig.labelFontSizePx,
                                            SIDEBAR_PREVIEW_MAX_LABEL_SIZE,
                                        );
                                        const sectionPictureDisplayMode = sectionPictureButtonsConfig.displayMode
                                            || DEFAULT_PICTURE_BUTTON_STYLING.displayMode;

                                        return (
                                            <div
                                                key={section.id}
                                                id={`site-design-focus-produktvalg-section-${section.id}`}
                                                className="min-w-0 space-y-3 rounded-lg border p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-sm">{section.title}</h4>
                                                            {section.isVerticalAxis && (
                                                                <Badge variant="outline" className="text-[10px]">Lodret akse</Badge>
                                                            )}
                                                            {section.selectionMode === "optional" && (
                                                                <Badge variant="secondary" className="text-[10px]">Valgfri</Badge>
                                                            )}
                                                            {section.selectionMode === "free" && (
                                                                <Badge variant="secondary" className="text-[10px]">Gratis</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {section.sectionType} · {section.id}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid gap-3">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Visningstype</Label>
                                                        <Select
                                                            value={section.uiMode}
                                                            onValueChange={(value) => updateSectionConfig(section.id, { uiMode: value as SelectorUiMode })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {UI_MODE_OPTIONS.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Thumbnail størrelse</Label>
                                                        <Select
                                                            value={section.thumbnailSize}
                                                            onValueChange={(value) => updateSectionConfig(section.id, {
                                                                thumbnailSize: value as ThumbnailSizeMode,
                                                                thumbnailCustomPx: undefined,
                                                            })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {THUMBNAIL_SIZE_OPTIONS.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs">Tilpasset thumbnail-størrelse</Label>
                                                        <span className="text-xs text-muted-foreground">
                                                            {thumbnailPx}px
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Slider
                                                            value={[thumbnailPx]}
                                                            min={THUMBNAIL_CUSTOM_PX_MIN}
                                                            max={THUMBNAIL_CUSTOM_PX_MAX}
                                                            step={THUMBNAIL_CUSTOM_PX_STEP}
                                                            onValueChange={([value]) => updateSectionConfig(section.id, { thumbnailCustomPx: value })}
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 text-[11px]"
                                                            onClick={() => updateSectionConfig(section.id, { thumbnailCustomPx: undefined })}
                                                            disabled={section.thumbnailCustomPx === undefined}
                                                        >
                                                            Reset
                                                        </Button>
                                                    </div>
                                                </div>

                                                {isPictureUiMode(section.uiMode) && (
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Billed-visning</Label>
                                                        <Select
                                                            value={sectionPictureDisplayMode}
                                                            onValueChange={(value) => updateSectionSelectorStyling(section.id, {
                                                                ...section.selectorStyling,
                                                                pictureButtons: {
                                                                    ...(section.selectorStyling.pictureButtons || {}),
                                                                    displayMode: value as PictureButtonStyling["displayMode"],
                                                                },
                                                            })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {DISPLAY_MODE_OPTIONS.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                <OptionSelectorStyleEditor
                                                    uiMode={section.uiMode}
                                                    value={section.selectorStyling}
                                                    onChange={(selectorStyling) => updateSectionSelectorStyling(section.id, selectorStyling)}
                                                />

                                                <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <Label className="text-xs">Valg og billeder</Label>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            {previewValues.length} synlige valg
                                                        </span>
                                                    </div>
                                                    <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">
                                                        {previewValues.map((value) => (
                                                            <div key={`${section.id}-${value.id}`} className="flex flex-col gap-2 rounded-md border bg-background px-2.5 py-2">
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <div
                                                                        className="flex shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40"
                                                                        style={{ width: SIDEBAR_ASSET_THUMB_SIZE, height: SIDEBAR_ASSET_THUMB_SIZE }}
                                                                    >
                                                                        {value.showThumbnail && value.imageUrl ? (
                                                                            <img
                                                                                src={getHiResThumbnailUrl(value.imageUrl, SIDEBAR_ASSET_THUMB_SIZE, SIDEBAR_ASSET_THUMB_SIZE)}
                                                                                alt={value.name}
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                                                                {(value.name || "?").slice(0, 2).toUpperCase()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-sm font-medium">{value.name}</p>
                                                                        <p className="text-[11px] text-muted-foreground">
                                                                            {value.showThumbnail ? "Vises med billede" : "Vises uden billede"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant={value.showThumbnail ? "default" : "outline"}
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px]"
                                                                        onClick={() => updateSectionValueSetting(section.id, value.id, {
                                                                            showThumbnail: !value.showThumbnail,
                                                                        })}
                                                                    >
                                                                        <ImageIcon className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px]"
                                                                        onClick={() => triggerUpload(section.id, value.id)}
                                                                    >
                                                                        <CloudUpload className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px]"
                                                                        onClick={() => updateSectionValueSetting(section.id, value.id, {
                                                                            customImage: undefined,
                                                                            showThumbnail: false,
                                                                        })}
                                                                        disabled={!value.imageUrl && !value.showThumbnail}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2 rounded-lg border bg-background/60 p-2.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <Label className="text-xs">Preview</Label>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            Matcher live selector-logik
                                                        </span>
                                                    </div>

                                                    {section.uiMode === "hidden" ? (
                                                        <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                                                            Denne sektion er skjult på storefronten.
                                                        </div>
                                                    ) : section.uiMode === "dropdown" ? (
                                                        <div className="max-h-56 space-y-2 overflow-auto overscroll-contain pr-1">
                                                            <div className="rounded-md border bg-background px-3 py-2 text-sm">
                                                                {previewValues[0]?.name || "Vælg..."}
                                                            </div>
                                                            <div className="flex max-w-full flex-wrap gap-2 overflow-hidden">
                                                                {previewValues.map((value) => (
                                                                    <div key={`dropdown-${section.id}-${value.id}`} className="flex items-center gap-2 rounded-md border bg-muted/10 px-2 py-1 text-xs">
                                                                        {value.showThumbnail && value.imageUrl && (
                                                                            <img
                                                                                src={getHiResThumbnailUrl(value.imageUrl, sidebarThumbPx, sidebarThumbPx)}
                                                                                alt={value.name}
                                                                                className="rounded object-cover"
                                                                                style={{ width: sidebarThumbPx, height: sidebarThumbPx }}
                                                                            />
                                                                        )}
                                                                        <span>{value.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : section.uiMode === "checkboxes" ? (
                                                        <div className="flex max-h-56 max-w-full flex-wrap gap-2 overflow-auto overscroll-contain pr-1">
                                                            {previewValues.map((value, index) => (
                                                                <div
                                                                    key={`checkbox-${section.id}-${value.id}`}
                                                                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${index === 0 ? "border-primary bg-primary/10" : "bg-background"}`}
                                                                >
                                                                    <div className={`h-4 w-4 rounded border ${index === 0 ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                                                                    {value.showThumbnail && value.imageUrl && (
                                                                        <img
                                                                            src={getHiResThumbnailUrl(value.imageUrl, sidebarThumbPx, sidebarThumbPx)}
                                                                            alt={value.name}
                                                                            className="rounded object-cover"
                                                                            style={{ width: sidebarThumbPx, height: sidebarThumbPx }}
                                                                        />
                                                                    )}
                                                                    <span>{value.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : isPictureUiMode(section.uiMode) ? (
                                                        <div className="flex max-h-56 max-w-full flex-wrap overflow-auto overscroll-contain pr-1" style={{ gap: `${sidebarGapPx}px` }}>
                                                            {previewValues.map((value, index) => {
                                                                const stateStyles = resolvePictureButtonStateStyles(sectionPictureButtonsConfig, {
                                                                    isHovered: false,
                                                                    isSelected: index === 0,
                                                                });
                                                                const useDetachedLabel = (
                                                                    sectionPictureButtonsConfig.displayMode === "text_below_image"
                                                                    || sectionPictureButtonsConfig.labelOutsideImage
                                                                )
                                                                    && sectionPictureButtonsConfig.showImage
                                                                    && sectionPictureButtonsConfig.showLabel;
                                                                const buttonHeight = !useDetachedLabel && sectionPictureButtonsConfig.showImage
                                                                    ? sidebarPictureSizePx + (sectionPictureButtonsConfig.showLabel ? 24 : 0)
                                                                    : "auto";
                                                                return (
                                                                    <div
                                                                        key={`picture-${section.id}-${value.id}`}
                                                                        className={useDetachedLabel
                                                                            ? "flex flex-col items-center gap-1"
                                                                            : "relative flex flex-col items-center overflow-hidden border-2"}
                                                                        style={{
                                                                            width: sectionPictureButtonsConfig.showImage ? sidebarPictureSizePx : "auto",
                                                                            minHeight: buttonHeight,
                                                                            backgroundColor: useDetachedLabel ? "transparent" : sectionPictureButtonsConfig.backgroundColor,
                                                                            borderColor: useDetachedLabel ? "transparent" : stateStyles.borderColor,
                                                                            borderRadius: useDetachedLabel ? undefined : `${sectionPictureButtonsConfig.imageBorderRadiusPx}px`,
                                                                            borderWidth: useDetachedLabel ? 0 : `${sectionPictureButtonsConfig.borderWidthPx}px`,
                                                                            borderStyle: useDetachedLabel ? "none" : "solid",
                                                                            boxShadow: useDetachedLabel ? undefined : stateStyles.boxShadow,
                                                                        }}
                                                                    >
                                                                        {useDetachedLabel ? (
                                                                            <>
                                                                                <div
                                                                                    className="relative flex overflow-hidden border-2"
                                                                                    style={{
                                                                                        width: sidebarPictureSizePx,
                                                                                        minHeight: sidebarPictureSizePx,
                                                                                        backgroundColor: sectionPictureButtonsConfig.backgroundColor,
                                                                                        borderColor: stateStyles.borderColor,
                                                                                        borderRadius: `${sectionPictureButtonsConfig.imageBorderRadiusPx}px`,
                                                                                        borderWidth: `${sectionPictureButtonsConfig.borderWidthPx}px`,
                                                                                        borderStyle: "solid",
                                                                                        boxShadow: stateStyles.boxShadow,
                                                                                    }}
                                                                                >
                                                                                    {value.imageUrl ? (
                                                                                        <img
                                                                                            src={getHiResThumbnailUrl(value.imageUrl, sidebarPictureSizePx, sidebarPictureSizePx)}
                                                                                            alt={value.name}
                                                                                            className="w-full object-cover"
                                                                                            style={{ height: sidebarPictureSizePx }}
                                                                                        />
                                                                                    ) : (
                                                                                        <div
                                                                                            className="flex w-full items-center justify-center text-xs font-semibold"
                                                                                            style={{
                                                                                                height: sidebarPictureSizePx,
                                                                                                color: sectionPictureButtonsConfig.textColor,
                                                                                            }}
                                                                                        >
                                                                                            {(value.name || "?").slice(0, 3).toUpperCase()}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div
                                                                                    className="w-full px-1 text-center leading-tight"
                                                                                    style={{
                                                                                        color: sectionPictureButtonsConfig.textColor,
                                                                                        fontSize: `${sidebarLabelFontSizePx}px`,
                                                                                    }}
                                                                                >
                                                                                    {value.name}
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                {sectionPictureButtonsConfig.showImage && (
                                                                                    value.imageUrl ? (
                                                                                        <img
                                                                                            src={getHiResThumbnailUrl(value.imageUrl, sidebarPictureSizePx, sidebarPictureSizePx)}
                                                                                            alt={value.name}
                                                                                            className="w-full object-cover"
                                                                                            style={{
                                                                                                height: sidebarPictureSizePx,
                                                                                                borderRadius: sectionPictureButtonsConfig.isTextBelow
                                                                                                    ? `${sectionPictureButtonsConfig.imageBorderRadiusPx}px ${sectionPictureButtonsConfig.imageBorderRadiusPx}px 0 0`
                                                                                                    : undefined,
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <div
                                                                                            className="flex w-full items-center justify-center text-xs font-semibold"
                                                                                            style={{
                                                                                                height: sidebarPictureSizePx,
                                                                                                color: sectionPictureButtonsConfig.textColor,
                                                                                            }}
                                                                                        >
                                                                                            {(value.name || "?").slice(0, 3).toUpperCase()}
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                                {sectionPictureButtonsConfig.showLabel && (
                                                                                    <div
                                                                                    className="flex items-center justify-center px-2 py-1 text-center leading-tight"
                                                                                    style={{
                                                                                        color: sectionPictureButtonsConfig.textColor,
                                                                                        fontSize: `${sidebarLabelFontSizePx}px`,
                                                                                    }}
                                                                                >
                                                                                    {value.name}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="flex max-h-56 max-w-full flex-wrap gap-2 overflow-auto overscroll-contain pr-1">
                                                            {previewValues.map((value, index) => (
                                                                <div
                                                                    key={`button-${section.id}-${value.id}`}
                                                                    className="flex items-center gap-2 border"
                                                                    style={{
                                                                        backgroundColor: index === 0 ? sectionTextButtonsConfig.selectedBackgroundColor : sectionTextButtonsConfig.backgroundColor,
                                                                        color: index === 0 ? sectionTextButtonsConfig.selectedTextColor : sectionTextButtonsConfig.textColor,
                                                                        borderRadius: `${sectionTextButtonsConfig.borderRadiusPx}px`,
                                                                        borderWidth: `${sectionTextButtonsConfig.borderWidthPx}px`,
                                                                        borderStyle: "solid",
                                                                        borderColor: index === 0 ? sectionTextButtonsConfig.selectedBackgroundColor : sectionTextButtonsConfig.borderColor,
                                                                        padding: `${sectionTextButtonsConfig.paddingPx}px ${sectionTextButtonsConfig.paddingPx * 1.33}px`,
                                                                        fontSize: `${sectionTextButtonsConfig.fontSizePx}px`,
                                                                        minHeight: `${sectionTextButtonsConfig.minHeightPx}px`,
                                                                        fontFamily: sectionTextButtonsConfig.fontFamily || "inherit",
                                                                    }}
                                                                >
                                                                    {value.showThumbnail && value.imageUrl && (
                                                                        <img
                                                                            src={getHiResThumbnailUrl(value.imageUrl, sidebarThumbPx, sidebarThumbPx)}
                                                                            alt={value.name}
                                                                            className="shrink-0 object-cover"
                                                                            style={{
                                                                                width: sidebarThumbPx,
                                                                                height: sidebarThumbPx,
                                                                                borderRadius: `${sectionTextButtonsConfig.borderRadiusPx / 2}px`,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {value.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Matrix Box Tab */}
                    <TabsContent value="matrix" className="mt-3 space-y-3">
                        <Card className="overflow-hidden">
                            <CardHeader className="space-y-1 p-3 pb-0">
                                <CardTitle className="text-sm">Matrix boks styling</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Tilpas udseendet af prislisten / matrix-boksen
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 p-3 pt-3">
                                <ColorPickerWithSwatches
                                    label="Baggrundsfarve"
                                    value={matrixBox.backgroundColor}
                                    onChange={(color) => updateMatrixBox({ backgroundColor: color })}
                                    savedSwatches={savedSwatches}
                                    onSaveSwatch={onSaveSwatch}
                                    onRemoveSwatch={onRemoveSwatch}
                                    compact
                                    showFullSwatches={false}
                                />

                                <ColorPickerWithSwatches
                                    label="Kantfarve"
                                    value={matrixBox.borderColor}
                                    onChange={(color) => updateMatrixBox({ borderColor: color })}
                                    savedSwatches={savedSwatches}
                                    onSaveSwatch={onSaveSwatch}
                                    onRemoveSwatch={onRemoveSwatch}
                                    compact
                                    showFullSwatches={false}
                                />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Hjørnerunding</Label>
                                        <span className="text-xs text-muted-foreground">{matrixBox.borderRadiusPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={30}
                                        step={1}
                                        value={[matrixBox.borderRadiusPx]}
                                        onValueChange={([value]) => updateMatrixBox({ borderRadiusPx: value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Kantbredde</Label>
                                        <span className="text-xs text-muted-foreground">{matrixBox.borderWidthPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={8}
                                        step={1}
                                        value={[matrixBox.borderWidthPx]}
                                        onValueChange={([value]) => updateMatrixBox({ borderWidthPx: value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Indvendig afstand (padding)</Label>
                                        <span className="text-xs text-muted-foreground">{matrixBox.paddingPx}px</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={32}
                                        step={4}
                                        value={[matrixBox.paddingPx]}
                                        onValueChange={([value]) => updateMatrixBox({ paddingPx: value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
            <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
            />
        </div>
    );
}
