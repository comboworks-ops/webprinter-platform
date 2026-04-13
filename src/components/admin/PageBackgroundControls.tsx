import { useMemo, useRef, type ChangeEvent } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { BrandingData } from "@/lib/branding";
import { getPageBackgroundStyle } from "@/lib/branding/background";

type BrandingColors = BrandingData["colors"];
type BackgroundType = NonNullable<BrandingColors["backgroundType"]>;
type GradientType = NonNullable<BrandingColors["backgroundGradientType"]>;
type ImageMode = NonNullable<BrandingColors["backgroundImageMode"]>;

interface PageBackgroundControlsProps {
    colors: BrandingColors;
    savedSwatches?: string[];
    onColorsChange: (patch: Partial<BrandingColors>) => void;
    onSaveSwatch: (color: string) => void;
    onRemoveSwatch: (color: string) => void;
    onUploadImage: (file: File) => Promise<void> | void;
    uploadingImage?: boolean;
}

export function PageBackgroundControls({
    colors,
    savedSwatches,
    onColorsChange,
    onSaveSwatch,
    onRemoveSwatch,
    onUploadImage,
    uploadingImage = false,
}: PageBackgroundControlsProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const backgroundType: BackgroundType = colors.backgroundType || "solid";
    const gradientType: GradientType = colors.backgroundGradientType || "linear";
    const imageMode: ImageMode = colors.backgroundImageMode || "cover";
    const gradientAngle = typeof colors.backgroundGradientAngle === "number"
        ? colors.backgroundGradientAngle
        : 135;
    const previewStyle = useMemo(() => ({
        ...getPageBackgroundStyle({ colors } as BrandingData),
        minHeight: "7rem",
    }), [colors]);

    const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        await onUploadImage(file);
    };

    return (
        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                        <h5 className="text-sm font-medium">Sidebaggrund</h5>
                        <p className="text-xs text-muted-foreground">
                            Skift mellem ensfarvet baggrund, gradient eller baggrundsbillede for hele siden.
                        </p>
                    </div>
                    <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {backgroundType === "solid" ? "Farve" : backgroundType === "gradient" ? "Gradient" : "Billede"}
                    </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/60">
                    <div style={previewStyle} className="w-full" />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Baggrundstype</Label>
                    <Select
                        value={backgroundType}
                        onValueChange={(value) => onColorsChange({ backgroundType: value as BackgroundType })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="solid">Farve</SelectItem>
                            <SelectItem value="gradient">Gradient</SelectItem>
                            <SelectItem value="image">Billede</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <ColorPickerWithSwatches
                    label={backgroundType === "solid" ? "Baggrundsfarve" : "Basis / fallback-farve"}
                    value={colors.background || "#F8FAFC"}
                    onChange={(value) => onColorsChange({ background: value })}
                    savedSwatches={savedSwatches}
                    onSaveSwatch={onSaveSwatch}
                    onRemoveSwatch={onRemoveSwatch}
                />
            </div>

            {backgroundType === "gradient" ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-background/70 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Gradienttype</Label>
                            <Select
                                value={gradientType}
                                onValueChange={(value) => onColorsChange({ backgroundGradientType: value as GradientType })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="linear">Lineær</SelectItem>
                                    <SelectItem value="radial">Radial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                            <div className="space-y-1">
                                <Label className="text-sm">Midterfarve</Label>
                                <p className="text-xs text-muted-foreground">Tilføj et tredje farvestop i gradienten.</p>
                            </div>
                            <Switch
                                checked={colors.backgroundGradientUseMiddle ?? false}
                                onCheckedChange={(checked) => onColorsChange({ backgroundGradientUseMiddle: checked })}
                            />
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <ColorPickerWithSwatches
                            label="Gradient start"
                            value={colors.backgroundGradientStart || colors.background || "#F8FAFC"}
                            onChange={(value) => onColorsChange({ backgroundGradientStart: value })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                        <ColorPickerWithSwatches
                            label="Gradient slut"
                            value={colors.backgroundGradientEnd || colors.background || "#E2E8F0"}
                            onChange={(value) => onColorsChange({ backgroundGradientEnd: value })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>
                    {(colors.backgroundGradientUseMiddle ?? false) && (
                        <ColorPickerWithSwatches
                            label="Midterfarve"
                            value={colors.backgroundGradientMiddle || colors.background || "#FFFFFF"}
                            onChange={(value) => onColorsChange({ backgroundGradientMiddle: value })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    )}
                    {gradientType === "linear" ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Gradient vinkel</Label>
                                <span className="text-xs text-muted-foreground">{gradientAngle}°</span>
                            </div>
                            <Slider
                                min={0}
                                max={360}
                                step={5}
                                value={[gradientAngle]}
                                onValueChange={([value]) => onColorsChange({ backgroundGradientAngle: value })}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {backgroundType === "image" ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-background/70 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Billedetilpasning</Label>
                            <Select
                                value={imageMode}
                                onValueChange={(value) => onColorsChange({ backgroundImageMode: value as ImageMode })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cover">Dæk hele siden</SelectItem>
                                    <SelectItem value="contain">Vis hele billedet</SelectItem>
                                    <SelectItem value="repeat">Gentag mønster</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploader...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload billede
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onColorsChange({ backgroundImageUrl: null })}
                                disabled={!colors.backgroundImageUrl}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Billede-URL</Label>
                        <Input
                            value={colors.backgroundImageUrl || ""}
                            onChange={(event) => onColorsChange({ backgroundImageUrl: event.target.value || null })}
                            placeholder="https://... eller upload et billede"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Basisfarven vises bag billedet og bruges også hvis billedet ikke kan indlæses.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
