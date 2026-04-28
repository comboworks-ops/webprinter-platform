/**
 * ProductOptionButtonEditor - Contextual editor for a single product option button
 * 
 * Shows only the specific settings for one button:
 * - Button color (background)
 * - Hover color
 * - Text
 * - Text color
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save, ArrowLeft, MousePointer2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Switch } from "@/components/ui/switch";

interface ProductOptionButtonEditorProps {
    productId: string;
    sectionId: string;
    valueId: string;
    valueName: string;
    savedSwatches: string[];
    onSaveSwatch: (color: string) => void;
    onRemoveSwatch: (color: string) => void;
    onBack: () => void;
}

interface ButtonSettings {
    // Appearance
    backgroundColor: string;
    hoverBackgroundColor: string;
    borderColor: string;
    hoverBorderColor: string;
    borderRadiusPx: number;
    borderWidthPx: number;
    // Text
    displayName: string;
    textColor: string;
    hoverTextColor: string;
    fontSizePx: number;
    // Size
    paddingPx: number;
    minHeightPx: number;
    // Picture
    showThumbnail: boolean;
    customImage: string | null;
    hoverImage: string | null;
    imageSizePx: number;
}

const DEFAULT_SETTINGS: ButtonSettings = {
    backgroundColor: "#FFFFFF",
    hoverBackgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    hoverBorderColor: "#0EA5E9",
    borderRadiusPx: 8,
    borderWidthPx: 1,
    displayName: "",
    textColor: "#1F2937",
    hoverTextColor: "#0EA5E9",
    fontSizePx: 14,
    paddingPx: 12,
    minHeightPx: 44,
    showThumbnail: false,
    customImage: null,
    hoverImage: null,
    imageSizePx: 48,
};

export function ProductOptionButtonEditor({
    productId,
    sectionId,
    valueId,
    valueName,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    onBack,
}: ProductOptionButtonEditorProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<ButtonSettings>(DEFAULT_SETTINGS);
    const [productName, setProductName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadTarget, setUploadTarget] = useState<"customImage" | "hoverImage" | null>(null);
    const [previewHovered, setPreviewHovered] = useState(false);

    // Load current settings
    useEffect(() => {
        async function loadSettings() {
            setLoading(true);
            
            // Load product info
            const { data: product } = await supabase
                .from('products')
                .select('name, pricing_structure')
                .eq('id', productId)
                .single();
            
            if (product) {
                setProductName(product.name);
                
                // Extract value settings from pricing_structure
                const structure = product.pricing_structure || {};
                const layoutRows = structure.layout_rows || [];
                const verticalAxis = structure.vertical_axis;
                
                // Find the section and value settings
                let valueSettings: any = {};
                let foundValueSettings = false;
                
                // Check the clicked section only.
                if (verticalAxis?.sectionId === sectionId && verticalAxis?.valueSettings?.[valueId]) {
                    valueSettings = verticalAxis.valueSettings[valueId];
                    foundValueSettings = true;
                }
                
                // Check layout rows
                for (const row of layoutRows) {
                    for (const col of row.columns || []) {
                        if (col.id === sectionId && col.valueSettings?.[valueId]) {
                            valueSettings = col.valueSettings[valueId];
                            foundValueSettings = true;
                            break;
                        }
                    }
                }

                if (!foundValueSettings) {
                    const { data: storformatConfig } = await supabase
                        .from("storformat_configs" as any)
                        .select("vertical_axis, layout_rows")
                        .eq("product_id", productId)
                        .maybeSingle();

                    const storformatVerticalAxis = (storformatConfig as any)?.vertical_axis;
                    if (storformatVerticalAxis?.id === sectionId && storformatVerticalAxis?.valueSettings?.[valueId]) {
                        valueSettings = storformatVerticalAxis.valueSettings[valueId];
                        foundValueSettings = true;
                    }

                    for (const row of ((storformatConfig as any)?.layout_rows || [])) {
                        for (const section of row.sections || []) {
                            if (section.id === sectionId && section.valueSettings?.[valueId]) {
                                valueSettings = section.valueSettings[valueId];
                                foundValueSettings = true;
                                break;
                            }
                        }
                    }
                }
                
                setSettings({
                    ...DEFAULT_SETTINGS,
                    displayName: valueSettings.displayName || valueName,
                    backgroundColor: valueSettings.backgroundColor || DEFAULT_SETTINGS.backgroundColor,
                    hoverBackgroundColor: valueSettings.hoverBackgroundColor || DEFAULT_SETTINGS.hoverBackgroundColor,
                    borderColor: valueSettings.borderColor || DEFAULT_SETTINGS.borderColor,
                    hoverBorderColor: valueSettings.hoverBorderColor || DEFAULT_SETTINGS.hoverBorderColor,
                    borderRadiusPx: valueSettings.borderRadiusPx ?? DEFAULT_SETTINGS.borderRadiusPx,
                    borderWidthPx: valueSettings.borderWidthPx ?? DEFAULT_SETTINGS.borderWidthPx,
                    textColor: valueSettings.textColor || DEFAULT_SETTINGS.textColor,
                    hoverTextColor: valueSettings.hoverTextColor || DEFAULT_SETTINGS.hoverTextColor,
                    fontSizePx: valueSettings.fontSizePx ?? DEFAULT_SETTINGS.fontSizePx,
                    paddingPx: valueSettings.paddingPx ?? DEFAULT_SETTINGS.paddingPx,
                    minHeightPx: valueSettings.minHeightPx ?? DEFAULT_SETTINGS.minHeightPx,
                    showThumbnail: valueSettings.showThumbnail || false,
                    customImage: valueSettings.customImage || null,
                    hoverImage: valueSettings.hoverImage || null,
                    imageSizePx: valueSettings.imageSizePx ?? DEFAULT_SETTINGS.imageSizePx,
                });
            }
            
            setLoading(false);
        }
        
        loadSettings();
    }, [productId, sectionId, valueId, valueName]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        
        // Get current pricing_structure
        const { data: product } = await supabase
            .from('products')
            .select('pricing_structure')
            .eq('id', productId)
            .single();
        
        const structure = product?.pricing_structure || { mode: 'matrix_layout_v1', version: 1 };
        
        // Update valueSettings in the appropriate location
        const valueSettingUpdate = {
            displayName: settings.displayName,
            backgroundColor: settings.backgroundColor,
            hoverBackgroundColor: settings.hoverBackgroundColor,
            borderColor: settings.borderColor,
            hoverBorderColor: settings.hoverBorderColor,
            borderRadiusPx: settings.borderRadiusPx,
            borderWidthPx: settings.borderWidthPx,
            textColor: settings.textColor,
            hoverTextColor: settings.hoverTextColor,
            fontSizePx: settings.fontSizePx,
            paddingPx: settings.paddingPx,
            minHeightPx: settings.minHeightPx,
            showThumbnail: settings.showThumbnail,
            customImage: settings.customImage,
            hoverImage: settings.hoverImage,
            imageSizePx: settings.imageSizePx,
        };
        
        const updatedStructure = { ...structure };
        let updatedProductPricingStructure = false;
        
        // Update only the clicked section so identical value ids in other sections are not affected.
        if (updatedStructure.vertical_axis?.sectionId === sectionId) {
            updatedStructure.vertical_axis.valueSettings = updatedStructure.vertical_axis.valueSettings || {};
            updatedStructure.vertical_axis.valueSettings[valueId] = {
                ...updatedStructure.vertical_axis.valueSettings[valueId],
                ...valueSettingUpdate,
            };
            updatedProductPricingStructure = true;
        }
        
        // Update in layout rows
        if (updatedStructure.layout_rows) {
            for (const row of updatedStructure.layout_rows) {
                for (const col of row.columns || []) {
                    if (col.id !== sectionId) continue;
                    col.valueSettings = col.valueSettings || {};
                    col.valueSettings[valueId] = {
                        ...col.valueSettings[valueId],
                        ...valueSettingUpdate,
                    };
                    updatedProductPricingStructure = true;
                }
            }
        }

        let error: any = null;
        if (updatedProductPricingStructure) {
            const result = await supabase
                .from('products')
                .update({ pricing_structure: updatedStructure })
                .eq('id', productId);
            error = result.error;
        } else {
            const { data: storformatConfig, error: loadError } = await supabase
                .from("storformat_configs" as any)
                .select("vertical_axis, layout_rows")
                .eq("product_id", productId)
                .maybeSingle();

            if (loadError || !storformatConfig) {
                error = loadError || new Error("Storformat-konfiguration blev ikke fundet");
            } else {
                const updatedVerticalAxis = { ...((storformatConfig as any).vertical_axis || {}) };
                const updatedLayoutRows = (((storformatConfig as any).layout_rows || []) as any[]).map((row) => ({
                    ...row,
                    sections: (row.sections || []).map((section: any) => ({ ...section })),
                }));
                let updatedStorformatConfig = false;

                if (updatedVerticalAxis.id === sectionId) {
                    updatedVerticalAxis.valueSettings = updatedVerticalAxis.valueSettings || {};
                    updatedVerticalAxis.valueSettings[valueId] = {
                        ...updatedVerticalAxis.valueSettings[valueId],
                        ...valueSettingUpdate,
                    };
                    updatedStorformatConfig = true;
                }

                for (const row of updatedLayoutRows) {
                    for (const section of row.sections || []) {
                        if (section.id !== sectionId) continue;
                        section.valueSettings = section.valueSettings || {};
                        section.valueSettings[valueId] = {
                            ...section.valueSettings[valueId],
                            ...valueSettingUpdate,
                        };
                        updatedStorformatConfig = true;
                    }
                }

                if (!updatedStorformatConfig) {
                    error = new Error("Kunne ikke finde den valgte knap i produktets konfiguration");
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
            console.error('Error saving button settings:', error);
            toast.error('Kunne ikke gemme indstillinger');
        } else {
            toast.success('Knap-indstillinger gemt');
        }
        
        setSaving(false);
    }, [productId, sectionId, valueId, settings]);

    const handleImageUpload = useCallback(async (file: File, target: "customImage" | "hoverImage") => {
        setUploading(true);
        setUploadTarget(target);
        
        try {
            const fileExt = file.name.split('.').pop();
            const suffix = target === "hoverImage" ? "hover" : "primary";
            const fileName = `product-option-${productId}-${sectionId}-${valueId}-${suffix}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
            
            setSettings(prev => ({ ...prev, [target]: publicUrl, showThumbnail: true }));
            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Kunne ikke uploade billede');
        }
        
        setUploading(false);
        setUploadTarget(null);
    }, [productId, sectionId, valueId]);

    const updateSetting = <K extends keyof ButtonSettings>(key: K, value: ButtonSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 px-3 pb-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    Tilbage
                </Button>
            </div>

            {/* Title */}
            <div className="flex items-center gap-2">
                <MousePointer2 className="h-5 w-5 text-orange-600" />
                <div>
                    <h3 className="text-sm font-medium">Rediger knap</h3>
                    <p className="text-xs text-muted-foreground">{productName} • {valueName}</p>
                </div>
            </div>

            {/* Text / Label */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Tekst</CardTitle>
                    <CardDescription className="text-xs">
                        Knappens visningsnavn
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Visningsnavn</Label>
                        <Input
                            value={settings.displayName}
                            onChange={(e) => updateSetting('displayName', e.target.value)}
                            placeholder={valueName}
                        />
                        <p className="text-xs text-muted-foreground">
                            Lad være tom for at bruge standardnavnet
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Colors */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Farver</CardTitle>
                    <CardDescription className="text-xs">
                        Baggrund og tekstfarver
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4">
                        <ColorPickerWithSwatches
                            label="Baggrundsfarve"
                            value={settings.backgroundColor}
                            onChange={(color) => updateSetting('backgroundColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ColorPickerWithSwatches
                            label="Hover baggrund"
                            value={settings.hoverBackgroundColor}
                            onChange={(color) => updateSetting('hoverBackgroundColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ColorPickerWithSwatches
                            label="Tekstfarve"
                            value={settings.textColor}
                            onChange={(color) => updateSetting('textColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ColorPickerWithSwatches
                            label="Hover tekstfarve"
                            value={settings.hoverTextColor}
                            onChange={(color) => updateSetting('hoverTextColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Shape */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Form</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Hjørnerunding</Label>
                            <span className="text-xs text-muted-foreground">{settings.borderRadiusPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={30}
                            step={1}
                            value={[settings.borderRadiusPx]}
                            onValueChange={([value]) => updateSetting('borderRadiusPx', value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Kantbredde</Label>
                            <span className="text-xs text-muted-foreground">{settings.borderWidthPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={4}
                            step={1}
                            value={[settings.borderWidthPx]}
                            onValueChange={([value]) => updateSetting('borderWidthPx', value)}
                        />
                    </div>

                    <div className="grid gap-4">
                        <ColorPickerWithSwatches
                            label="Kantfarve"
                            value={settings.borderColor}
                            onChange={(color) => updateSetting('borderColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ColorPickerWithSwatches
                            label="Hover kantfarve"
                            value={settings.hoverBorderColor}
                            onChange={(color) => updateSetting('hoverBorderColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Picture */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Billede</CardTitle>
                    <CardDescription className="text-xs">
                        Brug et normalt billede og evt. et separat hover-billede.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Vis miniaturebillede</Label>
                        <Switch
                            checked={settings.showThumbnail}
                            onCheckedChange={(checked) => updateSetting('showThumbnail', checked)}
                        />
                    </div>

                    {settings.showThumbnail && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Billedstørrelse</Label>
                                    <span className="text-xs text-muted-foreground">{settings.imageSizePx}px</span>
                                </div>
                                <Slider
                                    min={24}
                                    max={160}
                                    step={4}
                                    value={[settings.imageSizePx]}
                                    onValueChange={([value]) => updateSetting('imageSizePx', value)}
                                />
                            </div>

                            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                                <Label>Normalt billede</Label>
                                {settings.customImage ? (
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={settings.customImage}
                                            alt="Button thumbnail"
                                            className="rounded-lg object-cover border"
                                            style={{ width: settings.imageSizePx, height: settings.imageSizePx }}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateSetting('customImage', null)}
                                        >
                                            Fjern
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file, "customImage");
                                            }}
                                            disabled={uploading}
                                        />
                                        {uploading && uploadTarget === "customImage" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                                <Label>Hover-billede</Label>
                                <p className="text-xs text-muted-foreground">
                                    Vises kun når kunden holder musen over knappen.
                                </p>
                                {settings.hoverImage ? (
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={settings.hoverImage}
                                            alt="Button hover thumbnail"
                                            className="rounded-lg object-cover border"
                                            style={{ width: settings.imageSizePx, height: settings.imageSizePx }}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateSetting('hoverImage', null)}
                                        >
                                            Fjern
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file, "hoverImage");
                                            }}
                                            disabled={uploading}
                                        />
                                        {uploading && uploadTarget === "hoverImage" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Forhåndsvisning</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-4 rounded-lg border bg-muted/25">
                        <button
                            className="transition-all duration-200"
                            style={{
                                backgroundColor: settings.backgroundColor,
                                color: settings.textColor,
                                borderRadius: `${settings.borderRadiusPx}px`,
                                borderWidth: `${settings.borderWidthPx}px`,
                                borderStyle: 'solid',
                                borderColor: settings.borderColor,
                                padding: `${settings.paddingPx}px ${settings.paddingPx * 1.5}px`,
                                fontSize: `${settings.fontSizePx}px`,
                                minHeight: `${settings.minHeightPx}px`,
                            }}
                            onMouseEnter={(e) => {
                                setPreviewHovered(true);
                                e.currentTarget.style.backgroundColor = settings.hoverBackgroundColor;
                                e.currentTarget.style.color = settings.hoverTextColor;
                                e.currentTarget.style.borderColor = settings.hoverBorderColor;
                            }}
                            onMouseLeave={(e) => {
                                setPreviewHovered(false);
                                e.currentTarget.style.backgroundColor = settings.backgroundColor;
                                e.currentTarget.style.color = settings.textColor;
                                e.currentTarget.style.borderColor = settings.borderColor;
                            }}
                        >
                            {settings.showThumbnail && (previewHovered && settings.hoverImage ? settings.hoverImage : settings.customImage) && (
                                <img
                                    src={(previewHovered && settings.hoverImage ? settings.hoverImage : settings.customImage) || ""}
                                    alt=""
                                    className="mr-2 inline-block object-cover align-middle"
                                    style={{
                                        width: settings.imageSizePx,
                                        height: settings.imageSizePx,
                                        borderRadius: `${Math.max(2, settings.borderRadiusPx / 2)}px`,
                                    }}
                                />
                            )}
                            {settings.displayName || valueName}
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end pt-2">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Gem knap
                </Button>
            </div>
        </div>
    );
}
