/**
 * ProductDescriptionSection - Editor for product description box styling
 * 
 * Controls:
 * - Header text and styling (color, font, size, weight)
 * - Body text styling (color, font, size, line height)
 * - Box styling (background, border, radius, padding)
 * - Image placement (left, right, above, below, corners)
 * - Gallery settings
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Type, Box, Image as ImageIcon, Grid3X3, Upload, X, Loader2 } from "lucide-react";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { FontSelector } from "@/components/admin/FontSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductDescriptionSectionProps {
    infoSection: any;
    updateInfoSection: (updates: any) => void;
    savedSwatches: string[];
    onSaveSwatch: (color: string) => void;
    onRemoveSwatch: (color: string) => void;
}

export function ProductDescriptionSection({
    infoSection,
    updateInfoSection,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
}: ProductDescriptionSectionProps) {
    const config = useMemo(() => ({
        // Background box
        bgColor: infoSection?.bgColor ?? "",
        bgBorderRadius: infoSection?.bgBorderRadius ?? 12,
        borderColor: infoSection?.borderColor ?? "",
        borderWidthPx: infoSection?.borderWidthPx ?? 0,
        paddingPx: infoSection?.paddingPx ?? 24,
        // Title
        titleFont: infoSection?.titleFont ?? "",
        titleColor: infoSection?.titleColor ?? "",
        titleSizePx: infoSection?.titleSizePx ?? 22,
        titleWeight: infoSection?.titleWeight ?? "600",
        headerText: infoSection?.headerText ?? "Om produktet",
        showHeader: infoSection?.showHeader ?? true,
        // Body text
        textFont: infoSection?.textFont ?? "",
        textColor: infoSection?.textColor ?? "",
        textSizePx: infoSection?.textSizePx ?? 16,
        lineHeight: infoSection?.lineHeight ?? 1.6,
        descriptionText: infoSection?.descriptionText ?? "",
        // Image
        imagePosition: infoSection?.imagePosition ?? "above",
        imageUrl: infoSection?.imageUrl ?? "",
        imageWidthPct: infoSection?.imageWidthPct ?? 40,
        imageCornerSizePx: infoSection?.imageCornerSizePx ?? 80,
        imageBorderRadiusPx: infoSection?.imageBorderRadiusPx ?? 8,
        // Gallery
        galleryEnabled: infoSection?.galleryEnabled ?? false,
        galleryPosition: infoSection?.galleryPosition ?? "bottom",
        galleryHeightPx: infoSection?.galleryHeightPx ?? 200,
        galleryBorderRadiusPx: infoSection?.galleryBorderRadiusPx ?? 8,
        galleryImages: infoSection?.galleryImages ?? [],
        galleryIntervalMs: infoSection?.galleryIntervalMs ?? 4500,
    }), [infoSection]);

    const update = (key: string, value: any) => {
        updateInfoSection({ [key]: value });
    };

    const [uploading, setUploading] = useState<string | null>(null);

    const uploadImageFile = async (file: File): Promise<string | null> => {
        if (!file.type.startsWith("image/")) {
            toast.error("Kun billeder er tilladt");
            return null;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Billede må højst være 5MB");
            return null;
        }
        const fileExt = file.name.split(".").pop();
        const fileName = `prodbesk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
        const filePath = `branding/product-info/${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);
        return publicUrl;
    };

    const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading("main");
        try {
            const url = await uploadImageFile(file);
            if (url) {
                update("imageUrl", url);
                toast.success("Billede uploadet");
            }
        } catch (err) {
            toast.error("Kunne ikke uploade billede");
        } finally {
            setUploading(null);
        }
    };

    const handleGalleryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading("gallery");
        try {
            const url = await uploadImageFile(file);
            if (url) {
                const current = config.galleryImages || [];
                update("galleryImages", [...current, url]);
                toast.success("Billede tilføjet til galleri");
            }
        } catch (err) {
            toast.error("Kunne ikke uploade billede");
        } finally {
            setUploading(null);
        }
    };

    const removeGalleryImage = (index: number) => {
        const current = [...(config.galleryImages || [])];
        current.splice(index, 1);
        update("galleryImages", current);
    };

    const removeMainImage = () => {
        update("imageUrl", "");
    };

    return (
        <div id="site-design-focus-product-description" className="space-y-6 px-3 pb-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <div>
                    <h3 className="text-sm font-medium">Produktbeskrivelse</h3>
                    <p className="text-xs text-muted-foreground">
                        Tilpas udseendet af produktbeskrivelsesboksen
                    </p>
                </div>
            </div>

            <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="text" className="gap-1">
                        <Type className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Tekst</span>
                    </TabsTrigger>
                    <TabsTrigger value="box" className="gap-1">
                        <Box className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Boks</span>
                    </TabsTrigger>
                    <TabsTrigger value="image" className="gap-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Billede</span>
                    </TabsTrigger>
                    <TabsTrigger value="gallery" className="gap-1">
                        <Grid3X3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Galleri</span>
                    </TabsTrigger>
                </TabsList>

                {/* Text Tab */}
                <TabsContent value="text" className="space-y-4 mt-4">
                    {/* Section Header */}
                    <Card>
                        <CardHeader className="space-y-1 pb-3">
                            <CardTitle className="text-sm">Sektionsoverskrift</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Vis overskrift</Label>
                                <Switch
                                    checked={config.showHeader}
                                    onCheckedChange={(v) => update("showHeader", v)}
                                />
                            </div>
                            
                            {config.showHeader && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Overskrift tekst</Label>
                                        <Input
                                            value={config.headerText}
                                            onChange={(e) => update("headerText", e.target.value)}
                                            placeholder="Om produktet"
                                        />
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div className="space-y-2">
                                        <Label>Skrifttype</Label>
                                        <FontSelector
                                            value={config.titleFont || "inherit"}
                                            onChange={(v) => update("titleFont", v === "inherit" ? "" : v)}
                                        />
                                    </div>
                                    
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        value={config.titleColor}
                                        onChange={(v) => update("titleColor", v)}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                        compact
                                        showFullSwatches={false}
                                    />
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Størrelse</Label>
                                            <span className="text-xs text-muted-foreground">{config.titleSizePx}px</span>
                                        </div>
                                        <Slider
                                            min={14}
                                            max={48}
                                            step={1}
                                            value={[config.titleSizePx]}
                                            onValueChange={([v]) => update("titleSizePx", v)}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Vægt</Label>
                                        <Select
                                            value={config.titleWeight}
                                            onValueChange={(v) => update("titleWeight", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="400">Normal (400)</SelectItem>
                                                <SelectItem value="500">Medium (500)</SelectItem>
                                                <SelectItem value="600">Semibold (600)</SelectItem>
                                                <SelectItem value="700">Bold (700)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Body Text */}
                    <Card>
                        <CardHeader className="space-y-1 pb-3">
                            <CardTitle className="text-sm">Brødtekst</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Skrifttype</Label>
                                <FontSelector
                                    value={config.textFont || "inherit"}
                                    onChange={(v) => update("textFont", v === "inherit" ? "" : v)}
                                />
                            </div>
                            
                            <ColorPickerWithSwatches
                                label="Farve"
                                value={config.textColor}
                                onChange={(v) => update("textColor", v)}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                                compact
                                showFullSwatches={false}
                            />
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Størrelse</Label>
                                    <span className="text-xs text-muted-foreground">{config.textSizePx}px</span>
                                </div>
                                <Slider
                                    min={12}
                                    max={24}
                                    step={1}
                                    value={[config.textSizePx]}
                                    onValueChange={([v]) => update("textSizePx", v)}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Linjehøjde</Label>
                                    <span className="text-xs text-muted-foreground">{config.lineHeight.toFixed(1)}</span>
                                </div>
                                <Slider
                                    min={1}
                                    max={2}
                                    step={0.1}
                                    value={[config.lineHeight]}
                                    onValueChange={([v]) => update("lineHeight", v)}
                                />
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                                <Label>Produktbeskrivelse tekst</Label>
                                <textarea
                                    value={config.descriptionText || ""}
                                    onChange={(e) => update("descriptionText", e.target.value)}
                                    placeholder="Skriv produktbeskrivelsen her..."
                                    className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-y"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Denne tekst vises som produktbeskrivelsen
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Box Tab */}
                <TabsContent value="box" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader className="space-y-1 pb-3">
                            <CardTitle className="text-sm">Boks udseende</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ColorPickerWithSwatches
                                label="Baggrundsfarve"
                                value={config.bgColor}
                                onChange={(v) => update("bgColor", v)}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                                compact
                                showFullSwatches={false}
                            />
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Hjørnerunding</Label>
                                    <span className="text-xs text-muted-foreground">{config.bgBorderRadius}px</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={40}
                                    step={1}
                                    value={[config.bgBorderRadius]}
                                    onValueChange={([v]) => update("bgBorderRadius", v)}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Kantbredde</Label>
                                    <span className="text-xs text-muted-foreground">{config.borderWidthPx}px</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={8}
                                    step={1}
                                    value={[config.borderWidthPx]}
                                    onValueChange={([v]) => update("borderWidthPx", v)}
                                />
                            </div>
                            
                            {config.borderWidthPx > 0 && (
                                <ColorPickerWithSwatches
                                    label="Kantfarve"
                                    value={config.borderColor}
                                    onChange={(v) => update("borderColor", v)}
                                    savedSwatches={savedSwatches}
                                    onSaveSwatch={onSaveSwatch}
                                    onRemoveSwatch={onRemoveSwatch}
                                    compact
                                    showFullSwatches={false}
                                />
                            )}
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Indvendig afstand (padding)</Label>
                                    <span className="text-xs text-muted-foreground">{config.paddingPx}px</span>
                                </div>
                                <Slider
                                    min={8}
                                    max={48}
                                    step={4}
                                    value={[config.paddingPx]}
                                    onValueChange={([v]) => update("paddingPx", v)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Image Tab */}
                <TabsContent value="image" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader className="space-y-1 pb-3">
                            <CardTitle className="text-sm">Billedplacering</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Position</Label>
                                <Select
                                    value={config.imagePosition}
                                    onValueChange={(v) => update("imagePosition", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="above">Over tekst</SelectItem>
                                        <SelectItem value="below">Under tekst</SelectItem>
                                        <SelectItem value="left">Venstre for tekst</SelectItem>
                                        <SelectItem value="right">Højre for tekst</SelectItem>
                                        <SelectItem value="corners">I hjørnerne</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {(config.imagePosition === "left" || config.imagePosition === "right") && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Bredde (%)</Label>
                                        <span className="text-xs text-muted-foreground">{config.imageWidthPct}%</span>
                                    </div>
                                    <Slider
                                        min={20}
                                        max={60}
                                        step={5}
                                        value={[config.imageWidthPct]}
                                        onValueChange={([v]) => update("imageWidthPct", v)}
                                    />
                                </div>
                            )}
                            
                            {config.imagePosition === "corners" && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Hjørnestørrelse</Label>
                                        <span className="text-xs text-muted-foreground">{config.imageCornerSizePx}px</span>
                                    </div>
                                    <Slider
                                        min={40}
                                        max={150}
                                        step={10}
                                        value={[config.imageCornerSizePx]}
                                        onValueChange={([v]) => update("imageCornerSizePx", v)}
                                    />
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Billed-runding</Label>
                                    <span className="text-xs text-muted-foreground">{config.imageBorderRadiusPx}px</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={24}
                                    step={1}
                                    value={[config.imageBorderRadiusPx]}
                                    onValueChange={([v]) => update("imageBorderRadiusPx", v)}
                                />
                            </div>
                            
                            <Separator />
                            
                            {/* Main Image Upload */}
                            <div className="space-y-3">
                                <Label>Produktbillede</Label>
                                
                                {config.imageUrl ? (
                                    <div className="relative">
                                        <img
                                            src={config.imageUrl}
                                            alt="Produktbillede"
                                            className="w-full h-32 object-cover rounded-lg border"
                                        />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7"
                                            onClick={removeMainImage}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                                        <label className="flex flex-col items-center gap-2 cursor-pointer">
                                            {uploading === "main" ? (
                                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                            ) : (
                                                <Upload className="h-8 w-8 text-muted-foreground" />
                                            )}
                                            <span className="text-sm text-muted-foreground">Upload billede</span>
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleMainImageUpload}
                                                disabled={uploading === "main"}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Gallery Tab */}
                <TabsContent value="gallery" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader className="space-y-1 pb-3">
                            <CardTitle className="text-sm">Galleri</CardTitle>
                            <CardDescription className="text-xs">
                                        Tilføj et billedgalleri til produktbeskrivelsen
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Aktiver galleri</Label>
                                <Switch
                                    checked={config.galleryEnabled}
                                    onCheckedChange={(v) => update("galleryEnabled", v)}
                                />
                            </div>
                            
                            {config.galleryEnabled && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Position</Label>
                                        <Select
                                            value={config.galleryPosition}
                                            onValueChange={(v) => update("galleryPosition", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="top">Top</SelectItem>
                                                <SelectItem value="bottom">Bund</SelectItem>
                                                <SelectItem value="left">Venstre</SelectItem>
                                                <SelectItem value="right">Højre</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Højde</Label>
                                            <span className="text-xs text-muted-foreground">{config.galleryHeightPx}px</span>
                                        </div>
                                        <Slider
                                            min={100}
                                            max={400}
                                            step={20}
                                            value={[config.galleryHeightPx]}
                                            onValueChange={([v]) => update("galleryHeightPx", v)}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Runding</Label>
                                            <span className="text-xs text-muted-foreground">{config.galleryBorderRadiusPx}px</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={24}
                                            step={1}
                                            value={[config.galleryBorderRadiusPx]}
                                            onValueChange={([v]) => update("galleryBorderRadiusPx", v)}
                                        />
                                    </div>
                                    
                                    <Separator />
                                    
                                    {/* Gallery Interval */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Skift-interval (sekunder)</Label>
                                            <span className="text-xs text-muted-foreground">{(config.galleryIntervalMs / 1000).toFixed(1)}s</span>
                                        </div>
                                        <Slider
                                            min={1000}
                                            max={10000}
                                            step={500}
                                            value={[config.galleryIntervalMs]}
                                            onValueChange={([v]) => update("galleryIntervalMs", v)}
                                        />
                                    </div>
                                    
                                    <Separator />
                                    
                                    {/* Gallery Images */}
                                    <div className="space-y-3">
                                        <Label>Galleri-billeder ({config.galleryImages?.length || 0})</Label>
                                        
                                        {/* Existing images */}
                                        {config.galleryImages && config.galleryImages.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2">
                                                {config.galleryImages.map((url, index) => (
                                                    <div key={index} className="relative">
                                                        <img
                                                            src={url}
                                                            alt={`Galleri ${index + 1}`}
                                                            className="w-full h-16 object-cover rounded border"
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute -top-1 -right-1 h-5 w-5"
                                                            onClick={() => removeGalleryImage(index)}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Upload new */}
                                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3">
                                            <label className="flex flex-col items-center gap-1 cursor-pointer">
                                                {uploading === "gallery" ? (
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <Upload className="h-5 w-5 text-muted-foreground" />
                                                )}
                                                <span className="text-xs text-muted-foreground">Tilføj billede</span>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleGalleryImageUpload}
                                                    disabled={uploading === "gallery"}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
