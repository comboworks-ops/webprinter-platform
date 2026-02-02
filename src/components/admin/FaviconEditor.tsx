/**
 * FaviconEditor Component
 * 
 * Allows users to customize their browser tab icon (favicon).
 * Supports:
 * - Preset icons with customizable colors
 * - Custom uploaded .ico files
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Upload, Check, Loader2, Info, Store, Printer,
    ShoppingBag, ShoppingCart, Package, Box, Sparkles,
    Star, Palette, Globe, Heart, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";

// Preset favicon icons
const FAVICON_PRESETS = [
    { id: 'default', name: 'Standard', icon: Globe, description: 'Standard globe ikon' },
    { id: 'store', name: 'Butik', icon: Store, description: 'Butik/shop ikon' },
    { id: 'printer', name: 'Printer', icon: Printer, description: 'Printer ikon' },
    { id: 'shopping-bag', name: 'Indkøbspose', icon: ShoppingBag, description: 'Indkøbspose' },
    { id: 'shopping-cart', name: 'Indkøbskurv', icon: ShoppingCart, description: 'Indkøbskurv' },
    { id: 'package', name: 'Pakke', icon: Package, description: 'Pakke/forsendelse' },
    { id: 'box', name: 'Kasse', icon: Box, description: 'Produktkasse' },
    { id: 'sparkles', name: 'Gnister', icon: Sparkles, description: 'Gnister/kvalitet' },
    { id: 'star', name: 'Stjerne', icon: Star, description: 'Stjerne/favorit' },
    { id: 'palette', name: 'Palette', icon: Palette, description: 'Kreativ/design' },
    { id: 'heart', name: 'Hjerte', icon: Heart, description: 'Hjerte/favorit' },
    { id: 'zap', name: 'Lyn', icon: Zap, description: 'Hurtig/energisk' },
];

interface FaviconSettings {
    type: 'preset' | 'custom';
    presetId: string;
    presetColor: string;
    customUrl: string | null;
}

interface FaviconEditorProps {
    favicon: FaviconSettings;
    onChange: (favicon: FaviconSettings) => void;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
    tenantId?: string;
}

export function FaviconEditor({
    favicon,
    onChange,
    savedSwatches = [],
    onSaveSwatch,
    onRemoveSwatch,
    tenantId,
}: FaviconEditorProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePresetSelect = (presetId: string) => {
        onChange({
            ...favicon,
            type: 'preset',
            presetId,
        });
    };

    const handleColorChange = (color: string) => {
        onChange({
            ...favicon,
            presetColor: color,
        });
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.ico')) {
            toast.error('Kun .ico, .png og .svg filer understøttes');
            return;
        }

        // Validate file size (max 500KB)
        if (file.size > 500 * 1024) {
            toast.error('Filen er for stor. Maksimum 500KB.');
            return;
        }

        setIsUploading(true);

        try {
            // Generate unique filename
            const ext = file.name.split('.').pop() || 'ico';
            const fileName = `favicon-${Date.now()}.${ext}`;
            const storagePath = tenantId
                ? `tenants/${tenantId}/favicons/${fileName}`
                : `master/favicons/${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('branding-assets')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('branding-assets')
                .getPublicUrl(storagePath);

            onChange({
                ...favicon,
                type: 'custom',
                customUrl: urlData.publicUrl,
            });

            toast.success('Favicon uploadet!');
        } catch (error: any) {
            console.error('Error uploading favicon:', error);
            const message = error?.message ? `: ${error.message}` : '';
            toast.error(`Kunne ikke uploade favicon${message}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveCustom = () => {
        onChange({
            ...favicon,
            type: 'preset',
            presetId: 'default',
            customUrl: null,
        });
    };

    const selectedPreset = FAVICON_PRESETS.find(p => p.id === favicon.presetId);
    const PresetIcon = selectedPreset?.icon || Globe;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            Browser Tab Ikon (Favicon)
                        </CardTitle>
                        <CardDescription>
                            Vælg et ikon der vises i browserens faneblad
                        </CardDescription>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                                <p className="font-semibold mb-1">Favicon Krav:</p>
                                <ul className="text-xs space-y-1">
                                    <li>• Anbefalede formater: .ico, .png, .svg</li>
                                    <li>• Anbefalede størrelser: 16x16, 32x32, 48x48 px</li>
                                    <li>• For .ico: Multi-resolution (16, 32, 48 px)</li>
                                    <li>• Maksimal filstørrelse: 500KB</li>
                                    <li>• PNG/SVG konverteres automatisk</li>
                                </ul>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Preview */}
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="w-12 h-12 rounded-lg bg-white border shadow-sm flex items-center justify-center">
                        {favicon.type === 'custom' && favicon.customUrl ? (
                            <img
                                src={favicon.customUrl}
                                alt="Custom favicon"
                                className="w-8 h-8 object-contain"
                            />
                        ) : (
                            <PresetIcon
                                className="w-6 h-6"
                                style={{ color: favicon.presetColor }}
                            />
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-medium">
                            {favicon.type === 'custom'
                                ? 'Brugerdefineret ikon'
                                : selectedPreset?.name || 'Standard'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Sådan vil dit ikon se ud i browserfanen
                        </p>
                    </div>
                </div>

                <Tabs defaultValue={favicon.type} onValueChange={(v) => {
                    if (v === 'preset') {
                        onChange({ ...favicon, type: 'preset' });
                    }
                    // Don't auto-switch to custom - user needs to upload first
                }}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="preset" className="gap-1">
                            <Palette className="w-4 h-4" />
                            Vælg ikon
                        </TabsTrigger>
                        <TabsTrigger value="custom" className="gap-1">
                            <Upload className="w-4 h-4" />
                            Upload eget
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="preset" className="space-y-4 mt-4">
                        {/* Color Picker */}
                        <div className="space-y-2">
                            <Label>Ikon farve</Label>
                            <ColorPickerWithSwatches
                                value={favicon.presetColor}
                                onChange={handleColorChange}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        </div>

                        {/* Preset Grid */}
                        <div className="space-y-2">
                            <Label>Vælg ikon</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {FAVICON_PRESETS.map((preset) => {
                                    const Icon = preset.icon;
                                    const isSelected = favicon.type === 'preset' && favicon.presetId === preset.id;

                                    return (
                                        <TooltipProvider key={preset.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => handlePresetSelect(preset.id)}
                                                        className={cn(
                                                            "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                                            isSelected
                                                                ? "border-primary bg-primary/5"
                                                                : "border-muted hover:border-primary/50"
                                                        )}
                                                    >
                                                        <Icon
                                                            className="w-6 h-6 mb-1"
                                                            style={{ color: favicon.presetColor }}
                                                        />
                                                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                                                            {preset.name}
                                                        </span>
                                                        {isSelected && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                                                <Check className="w-2.5 h-2.5 text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{preset.description}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="custom" className="space-y-4 mt-4">
                        {/* Upload Area */}
                        <div className="space-y-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml"
                                onChange={handleFileUpload}
                                className="hidden"
                            />

                            {favicon.type === 'custom' && favicon.customUrl ? (
                                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={favicon.customUrl}
                                            alt="Uploaded favicon"
                                            className="w-10 h-10 object-contain bg-white rounded border"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-green-800">Brugerdefineret ikon uploadet</p>
                                            <p className="text-xs text-green-600">Klik for at erstatte</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                'Erstat'
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleRemoveCustom}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            Fjern
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className={cn(
                                        "w-full border-2 border-dashed rounded-lg p-6 text-center transition-all",
                                        "hover:border-primary hover:bg-primary/5",
                                        isUploading && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isUploading ? (
                                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                                    ) : (
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                    )}
                                    <p className="text-sm font-medium">
                                        {isUploading ? 'Uploader...' : 'Klik for at uploade'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        .ico, .png eller .svg (max 500KB)
                                    </p>
                                </button>
                            )}

                            {/* Info Box */}
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-800">
                                    <strong>Tip:</strong> For bedste resultat, brug et kvadratisk billede
                                    (32x32 eller 64x64 px) med transparent baggrund.
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
