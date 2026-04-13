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
                
                // Check vertical axis
                if (verticalAxis?.valueSettings?.[valueId]) {
                    valueSettings = verticalAxis.valueSettings[valueId];
                }
                
                // Check layout rows
                for (const row of layoutRows) {
                    for (const col of row.columns || []) {
                        if (col.valueSettings?.[valueId]) {
                            valueSettings = col.valueSettings[valueId];
                            break;
                        }
                    }
                }
                
                setSettings({
                    ...DEFAULT_SETTINGS,
                    displayName: valueSettings.displayName || valueName,
                    showThumbnail: valueSettings.showThumbnail || false,
                    customImage: valueSettings.customImage || null,
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
            showThumbnail: settings.showThumbnail,
            customImage: settings.customImage,
        };
        
        // We need to preserve the existing structure but update valueSettings
        // This is a simplified version - in practice you'd need to find the exact path
        const updatedStructure = { ...structure };
        
        // Update in vertical axis if exists
        if (updatedStructure.vertical_axis?.valueSettings) {
            updatedStructure.vertical_axis.valueSettings[valueId] = {
                ...updatedStructure.vertical_axis.valueSettings[valueId],
                ...valueSettingUpdate,
            };
        }
        
        // Update in layout rows
        if (updatedStructure.layout_rows) {
            for (const row of updatedStructure.layout_rows) {
                for (const col of row.columns || []) {
                    if (col.valueSettings) {
                        col.valueSettings[valueId] = {
                            ...col.valueSettings[valueId],
                            ...valueSettingUpdate,
                        };
                    }
                }
            }
        }
        
        const { error } = await supabase
            .from('products')
            .update({ pricing_structure: updatedStructure })
            .eq('id', productId);
        
        if (error) {
            console.error('Error saving button settings:', error);
            toast.error('Kunne ikke gemme indstillinger');
        } else {
            toast.success('Knap-indstillinger gemt');
        }
        
        setSaving(false);
    }, [productId, sectionId, valueId, settings]);

    const handleImageUpload = useCallback(async (file: File) => {
        setUploading(true);
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `product-option-${productId}-${sectionId}-${valueId}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
            
            setSettings(prev => ({ ...prev, customImage: publicUrl, showThumbnail: true }));
            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Kunne ikke uploade billede');
        }
        
        setUploading(false);
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
                        <div className="space-y-3">
                            {settings.customImage ? (
                                <div className="relative">
                                    <img
                                        src={settings.customImage}
                                        alt="Button thumbnail"
                                        className="w-20 h-20 rounded-lg object-cover border"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                                        onClick={() => updateSetting('customImage', null)}
                                    >
                                        ×
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file);
                                        }}
                                        disabled={uploading}
                                    />
                                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                            )}
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
                                e.currentTarget.style.backgroundColor = settings.hoverBackgroundColor;
                                e.currentTarget.style.color = settings.hoverTextColor;
                                e.currentTarget.style.borderColor = settings.hoverBorderColor;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = settings.backgroundColor;
                                e.currentTarget.style.color = settings.textColor;
                                e.currentTarget.style.borderColor = settings.borderColor;
                            }}
                        >
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
