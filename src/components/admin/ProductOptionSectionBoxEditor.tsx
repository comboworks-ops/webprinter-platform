import { useCallback, useEffect, useState, useRef } from "react";
import { ArrowLeft, Box, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { supabase } from "@/integrations/supabase/client";
import { applyProductStylingPatches, persistProductStylingPatches, removeSavedStylingPatches, selectorBoxStylingPatches, type ProductStylingChange, type ProductStylingPreview, type ProductStylingPatch } from "@/lib/preview/productStylingSave";
import {
    DEFAULT_SELECTOR_BOX_STYLING,
    type SelectorBoxStyling,
} from "@/types/pricingStructure";

interface ProductOptionSectionBoxEditorProps {
    tenantId: string;
    pricingPreview?: ProductStylingPreview | null;
    persistedStyling?: ProductStylingChange | null;
    onPricingStructureChange?: (change: ProductStylingChange) => void;
    productId: string;
    sectionId: string;
    sectionName: string;
    savedSwatches: string[];
    onSaveSwatch: (color: string) => void;
    onRemoveSwatch: (color: string) => void;
    onBack: () => void;
}

type StoredLocation = "product" | "storformat" | null;

const mergeSettings = (settings?: Partial<SelectorBoxStyling> | null): SelectorBoxStyling => ({
    ...DEFAULT_SELECTOR_BOX_STYLING,
    ...(settings || {}),
});

export function ProductOptionSectionBoxEditor({
    tenantId,
    pricingPreview,
    persistedStyling,
    onPricingStructureChange,
    productId,
    sectionId,
    sectionName,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    onBack,
}: ProductOptionSectionBoxEditorProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [productName, setProductName] = useState("");
    const [resolvedSectionName, setResolvedSectionName] = useState(sectionName || "Valgboks");
    const [location, setLocation] = useState<StoredLocation>(null);
    const [settings, setSettings] = useState<SelectorBoxStyling>(DEFAULT_SELECTOR_BOX_STYLING);

    const [productPricingStructure, setProductPricingStructure] = useState<Record<string, unknown> | null>(null);
    const pricingPreviewRef = useRef(pricingPreview);
    pricingPreviewRef.current = pricingPreview;

    const pendingPatchesRef = useRef<ProductStylingPatch[]>([]);
    const acknowledgePersistedStyling = useCallback((saved: ProductStylingChange | null | undefined) => {
        if (saved?.productId !== productId) return;
        pendingPatchesRef.current = removeSavedStylingPatches(pendingPatchesRef.current, saved.patches);
    }, [productId]);

    useEffect(() => {
        acknowledgePersistedStyling(persistedStyling);
    }, [acknowledgePersistedStyling, persistedStyling]);

    useEffect(() => {
        let cancelled = false;
        async function loadSettings() {
            setLoading(true);

            const { data: product } = await supabase
                .from("products")
                .select("name, pricing_structure")
                .eq("id", productId)
                .eq("tenant_id", tenantId)
                .single();

            if (cancelled) return;
            if (product?.name) {
                setProductName(product.name);
            }

            if (!product) {
                toast.error("Kunne ikke finde produktet i denne shop");
                setLocation(null);
                setLoading(false);
                return;
            }
            const structure = (pricingPreviewRef.current?.productId === productId
                ? pricingPreviewRef.current.pricingStructure : product.pricing_structure || {}) as any;
            setProductPricingStructure(structure);
            let foundSettings: Partial<SelectorBoxStyling> | null = null;
            let foundLabel = sectionName || "";
            let foundLocation: StoredLocation = null;

            if (structure?.vertical_axis?.sectionId === sectionId) {
                foundSettings = structure.vertical_axis.selectorStyling?.selectorBox || null;
                foundLabel = structure.vertical_axis.title || structure.vertical_axis.labelOverride || foundLabel;
                foundLocation = "product";
            }

            if (!foundLocation && Array.isArray(structure?.layout_rows)) {
                for (const row of structure.layout_rows) {
                    for (const column of row.columns || []) {
                        if (column.id !== sectionId) continue;
                        foundSettings = column.selectorStyling?.selectorBox || null;
                        foundLabel = column.title || column.labelOverride || foundLabel;
                        foundLocation = "product";
                        break;
                    }
                    if (foundLocation) break;
                }
            }

            if (!foundLocation) {
                const { data: storformatConfig } = await supabase
                    .from("storformat_configs" as any)
                    .select("vertical_axis, layout_rows")
                    .eq("product_id", productId)
                    .maybeSingle();

                const verticalAxis = (storformatConfig as any)?.vertical_axis;
                if (verticalAxis?.id === sectionId) {
                    foundSettings = verticalAxis.selectorStyling?.selectorBox || null;
                    foundLabel = verticalAxis.title || foundLabel;
                    foundLocation = "storformat";
                }

                for (const row of ((storformatConfig as any)?.layout_rows || [])) {
                    for (const section of row.sections || []) {
                        if (section.id !== sectionId) continue;
                        foundSettings = section.selectorStyling?.selectorBox || null;
                        foundLabel = section.title || foundLabel;
                        foundLocation = "storformat";
                        break;
                    }
                    if (foundLocation) break;
                }
            }

            if (cancelled) return;
            pendingPatchesRef.current = pricingPreviewRef.current?.productId === productId
                ? pricingPreviewRef.current.patches.filter(patch => patch.sectionId === sectionId && patch.path[0] === 'selectorStyling' && patch.path[1] === 'selectorBox') : [];
            setLocation(foundLocation);
            setResolvedSectionName(foundLabel || "Valgboks");
            setSettings(mergeSettings(foundSettings));
            setLoading(false);
        }

        void loadSettings();
        return () => { cancelled = true; };
    }, [productId, sectionId, sectionName, tenantId]);

    const updateSetting = <K extends keyof SelectorBoxStyling>(key: K, value: SelectorBoxStyling[K]) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        const patches = selectorBoxStylingPatches(sectionId, { [key]: value });
        pendingPatchesRef.current = [...new Map([...pendingPatchesRef.current, ...patches].map(patch => [JSON.stringify(patch.path), patch])).values()];
        if (location === 'product' && productPricingStructure) {
            onPricingStructureChange?.({ productId, patches, isDirty: true,
                pricingStructure: applyProductStylingPatches(productPricingStructure, patches) });
        }
    };

    const handleSave = useCallback(async () => {
        setSaving(true);

        const submittedPatches = [...pendingPatchesRef.current];
        const selectorBoxUpdate = Object.fromEntries(submittedPatches.map(patch => [patch.path[patch.path.length - 1], patch.value]));

        let error: any = null;

        if (location === "product") {
            const patches = submittedPatches;
            try {
                const pricingStructure = await persistProductStylingPatches(supabase, tenantId, productId, patches);
                setProductPricingStructure(pricingStructure);
                onPricingStructureChange?.({ productId, pricingStructure, patches, isDirty: false });
            } catch (saveError) { error = saveError; }
        } else if (location === 'storformat') {
            // Verify the owning tenant again before updating its separate config.
            const { data: owner, error: ownerError } = await supabase.from('products')
                .select('id').eq('id', productId).eq('tenant_id', tenantId).single();
            if (ownerError || !owner) {
                toast.error('Kunne ikke finde produktet i denne shop');
                setSaving(false);
                return;
            }
            const { data: storformatConfig, error: loadError } = await supabase
                .from("storformat_configs" as any)
                .select("vertical_axis, layout_rows")
                .eq("product_id", productId)
                .maybeSingle();

            if (loadError || !storformatConfig) {
                error = loadError || new Error("Storformat-konfiguration blev ikke fundet");
            } else {
                let updated = false;
                const updatedVerticalAxis = { ...((storformatConfig as any).vertical_axis || {}) };
                const updatedLayoutRows = (((storformatConfig as any).layout_rows || []) as any[]).map((row) => ({
                    ...row,
                    sections: (row.sections || []).map((section: any) => {
                        if (section.id !== sectionId) return section;
                        updated = true;
                        return {
                            ...section,
                            selectorStyling: {
                                ...(section.selectorStyling || {}),
                                selectorBox: {
                                    ...(section.selectorStyling?.selectorBox || {}),
                                    ...selectorBoxUpdate,
                                },
                            },
                        };
                    }),
                }));

                if (updatedVerticalAxis.id === sectionId) {
                    updatedVerticalAxis.selectorStyling = {
                        ...(updatedVerticalAxis.selectorStyling || {}),
                        selectorBox: {
                            ...(updatedVerticalAxis.selectorStyling?.selectorBox || {}),
                            ...selectorBoxUpdate,
                        },
                    };
                    updated = true;
                }

                if (!updated) {
                    error = new Error("Kunne ikke finde valgboksen i storformat-layoutet");
                } else {
                    const result = await supabase
                        .from("storformat_configs" as any)
                        .update({
                            vertical_axis: updatedVerticalAxis,
                            layout_rows: updatedLayoutRows,
                        } as any)
                        .eq("product_id", productId)
                        .select('product_id').maybeSingle();
                    error = result.error || (!result.data ? new Error('Valgboksen blev ikke opdateret') : null);
                }
            }
        }

        if (!location) error = new Error("Valgboksen blev ikke fundet");

        if (error) {
            console.error("Error saving selector box settings:", error);
            toast.error("Kunne ikke gemme valgboks");
        } else {
            pendingPatchesRef.current = pendingPatchesRef.current.filter(patch => !submittedPatches.some(saved =>
                JSON.stringify(saved.path) === JSON.stringify(patch.path) && JSON.stringify(saved.value) === JSON.stringify(patch.value)));
            toast.success("Valgboks gemt");
        }

        setSaving(false);
    }, [location, productId, sectionId, settings, tenantId, onPricingStructureChange]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 px-3 pb-6">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Tilbage
            </Button>

            <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-orange-600" />
                <div>
                    <h3 className="text-sm font-medium">Rediger valgboks</h3>
                    <p className="text-xs text-muted-foreground">{productName} • {resolvedSectionName}</p>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Boksen rundt om valgene</CardTitle>
                    <CardDescription className="text-xs">
                        Styr baggrund, kant og afstand for denne produktsektion.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ColorPickerWithSwatches
                        label="Baggrund"
                        value={settings.backgroundColor}
                        onChange={(color) => updateSetting("backgroundColor", color)}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />
                    <ColorPickerWithSwatches
                        label="Kant"
                        value={settings.borderColor}
                        onChange={(color) => updateSetting("borderColor", color)}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Hjoernerunding</Label>
                            <span className="text-[11px] text-muted-foreground">{settings.borderRadiusPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={40}
                            step={1}
                            value={[settings.borderRadiusPx]}
                            onValueChange={([value]) => updateSetting("borderRadiusPx", value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Kantbredde</Label>
                            <span className="text-[11px] text-muted-foreground">{settings.borderWidthPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={8}
                            step={1}
                            value={[settings.borderWidthPx]}
                            onValueChange={([value]) => updateSetting("borderWidthPx", value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Indvendig afstand</Label>
                            <span className="text-[11px] text-muted-foreground">{settings.paddingPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={32}
                            step={1}
                            value={[settings.paddingPx]}
                            onValueChange={([value]) => updateSetting("paddingPx", value)}
                        />
                    </div>

                    <div
                        className="space-y-2"
                        style={{
                            backgroundColor: settings.backgroundColor,
                            borderColor: settings.borderColor,
                            borderRadius: `${settings.borderRadiusPx}px`,
                            borderWidth: `${settings.borderWidthPx}px`,
                            borderStyle: "solid",
                            padding: `${settings.paddingPx}px`,
                        }}
                    >
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Preview
                        </div>
                        <div className="flex gap-2">
                            <div className="h-8 w-20 rounded border bg-background" />
                            <div className="h-8 w-20 rounded border bg-background" />
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={saving || !location} className="w-full gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Gem valgboks
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
