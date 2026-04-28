import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Box, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { supabase } from "@/integrations/supabase/client";
import {
    DEFAULT_SELECTOR_BOX_STYLING,
    type SelectorBoxStyling,
} from "@/types/pricingStructure";

interface ProductOptionSectionBoxEditorProps {
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

    useEffect(() => {
        async function loadSettings() {
            setLoading(true);

            const { data: product } = await supabase
                .from("products")
                .select("name, pricing_structure")
                .eq("id", productId)
                .single();

            if (product?.name) {
                setProductName(product.name);
            }

            const structure = (product?.pricing_structure || {}) as any;
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

            setLocation(foundLocation);
            setResolvedSectionName(foundLabel || "Valgboks");
            setSettings(mergeSettings(foundSettings));
            setLoading(false);
        }

        void loadSettings();
    }, [productId, sectionId, sectionName]);

    const updateSetting = <K extends keyof SelectorBoxStyling>(key: K, value: SelectorBoxStyling[K]) => {
        setSettings((current) => ({ ...current, [key]: value }));
    };

    const handleSave = useCallback(async () => {
        setSaving(true);

        const selectorBoxUpdate = {
            backgroundColor: settings.backgroundColor,
            borderColor: settings.borderColor,
            borderRadiusPx: settings.borderRadiusPx,
            borderWidthPx: settings.borderWidthPx,
            paddingPx: settings.paddingPx,
        };

        let error: any = null;

        if (location === "product") {
            const { data: product, error: loadError } = await supabase
                .from("products")
                .select("pricing_structure")
                .eq("id", productId)
                .single();

            if (loadError || !product) {
                error = loadError || new Error("Produktet blev ikke fundet");
            } else {
                const updatedStructure = { ...((product.pricing_structure || {}) as any) };
                let updated = false;

                if (updatedStructure.vertical_axis?.sectionId === sectionId) {
                    updatedStructure.vertical_axis = {
                        ...updatedStructure.vertical_axis,
                        selectorStyling: {
                            ...(updatedStructure.vertical_axis.selectorStyling || {}),
                            selectorBox: {
                                ...(updatedStructure.vertical_axis.selectorStyling?.selectorBox || {}),
                                ...selectorBoxUpdate,
                            },
                        },
                    };
                    updated = true;
                }

                updatedStructure.layout_rows = (updatedStructure.layout_rows || []).map((row: any) => ({
                    ...row,
                    columns: (row.columns || []).map((column: any) => {
                        if (column.id !== sectionId) return column;
                        updated = true;
                        return {
                            ...column,
                            selectorStyling: {
                                ...(column.selectorStyling || {}),
                                selectorBox: {
                                    ...(column.selectorStyling?.selectorBox || {}),
                                    ...selectorBoxUpdate,
                                },
                            },
                        };
                    }),
                }));

                if (!updated) {
                    error = new Error("Kunne ikke finde valgboksen i produktets layout");
                } else {
                    const result = await supabase
                        .from("products")
                        .update({ pricing_structure: updatedStructure })
                        .eq("id", productId);
                    error = result.error;
                }
            }
        } else {
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
                        .eq("product_id", productId);
                    error = result.error;
                }
            }
        }

        if (error) {
            console.error("Error saving selector box settings:", error);
            toast.error("Kunne ikke gemme valgboks");
        } else {
            toast.success("Valgboks gemt");
        }

        setSaving(false);
    }, [location, productId, sectionId, settings]);

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

                    <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Gem valgboks
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
