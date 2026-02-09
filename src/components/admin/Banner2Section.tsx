import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Trash2, Plus, Upload, Layout } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FontSelector } from "./FontSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import {
    type BrandingData,
    type Banner2Settings,
    type Banner2Slide,
    type Banner2Item,
    DEFAULT_FORSIDE,
} from "@/hooks/useBrandingDraft";
import { BANNER2_ICON_OPTIONS } from "@/components/branding/banner2Icons";

interface Banner2SectionProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
}

const ANIMATION_OPTIONS = [
    { value: "none", label: "Ingen" },
    { value: "fade", label: "Fade In" },
    { value: "slide-up", label: "Slide Op" },
    { value: "slide-down", label: "Slide Ned" },
    { value: "scale", label: "Zoom Ind" },
    { value: "blur", label: "Fokusér" },
] as const;

const MAX_SLIDES = 5;
const MAX_ITEMS_PER_SLIDE = 4;

export function Banner2Section({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
}: Banner2SectionProps) {
    const [uploading, setUploading] = useState<string | null>(null);

    const forside = draft.forside ?? DEFAULT_FORSIDE;
    const banner2 = forside.banner2 ?? DEFAULT_FORSIDE.banner2;

    const updateBanner2 = (updates: Partial<Banner2Settings>) => {
        updateDraft({
            forside: {
                ...forside,
                banner2: { ...banner2, ...updates },
            },
        });
    };

    const updateSlide = (slideId: string, updates: Partial<Banner2Slide>) => {
        const nextSlides = banner2.slides.map((slide) =>
            slide.id === slideId ? { ...slide, ...updates } : slide
        );
        updateBanner2({ slides: nextSlides });
    };

    const updateItem = (slideId: string, itemId: string, updates: Partial<Banner2Item>) => {
        const nextSlides = banner2.slides.map((slide) => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                items: slide.items.map((item) =>
                    item.id === itemId ? { ...item, ...updates } : item
                ),
            };
        });
        updateBanner2({ slides: nextSlides });
    };

    const addSlide = () => {
        if (banner2.slides.length >= MAX_SLIDES) {
            toast.error(`Maksimalt ${MAX_SLIDES} slides tilladt`);
            return;
        }
        const newSlide: Banner2Slide = {
            id: `banner2-slide-${Date.now()}`,
            enabled: true,
            durationSeconds: 5,
            items: [],
        };
        updateBanner2({ slides: [...banner2.slides, newSlide] });
    };

    const removeSlide = (slideId: string) => {
        updateBanner2({ slides: banner2.slides.filter((s) => s.id !== slideId) });
    };

    const moveSlide = (slideId: string, direction: "up" | "down") => {
        const index = banner2.slides.findIndex((s) => s.id === slideId);
        if (index === -1) return;
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= banner2.slides.length) return;
        const next = [...banner2.slides];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        updateBanner2({ slides: next });
    };

    const addItem = (slideId: string) => {
        const slide = banner2.slides.find((s) => s.id === slideId);
        if (!slide) return;
        if (slide.items.length >= MAX_ITEMS_PER_SLIDE) {
            toast.error(`Maksimalt ${MAX_ITEMS_PER_SLIDE} kort pr. slide`);
            return;
        }
        const newItem: Banner2Item = {
            id: `banner2-item-${Date.now()}`,
            enabled: true,
            title: "",
            description: "",
            titleFont: "Poppins",
            titleColor: "#FFFFFF",
            descriptionFont: "Inter",
            descriptionColor: "#E5E7EB",
            iconType: "icon",
            iconName: "Truck",
            iconUrl: undefined,
            groupAnimation: "none",
            titleAnimation: "none",
            descriptionAnimation: "none",
            iconAnimation: "none",
        };
        updateSlide(slideId, { items: [...slide.items, newItem] });
    };

    const removeItem = (slideId: string, itemId: string) => {
        const slide = banner2.slides.find((s) => s.id === slideId);
        if (!slide) return;
        updateSlide(slideId, { items: slide.items.filter((i) => i.id !== itemId) });
    };

    const uploadImageFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Kun billeder er tilladt");
            return null;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Billede må højst være 5MB");
            return null;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `banner2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
        const filePath = `branding/${tenantId || "master"}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleIconUpload = async (slideId: string, itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(itemId);
        try {
            const publicUrl = await uploadImageFile(file);
            if (!publicUrl) return;
            updateItem(slideId, itemId, { iconType: "image", iconUrl: publicUrl });
            toast.success("Ikon uploadet");
        } catch (error) {
            console.error("Error uploading:", error);
            toast.error("Kunne ikke uploade ikon");
        } finally {
            setUploading(null);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Banner 2</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Vis Banner 2</Label>
                        <Switch
                            checked={banner2.enabled}
                            onCheckedChange={(v) => updateBanner2({ enabled: v })}
                        />
                    </div>

                    {banner2.enabled && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Auto slide</Label>
                                    <Switch
                                        checked={banner2.autoPlay}
                                        onCheckedChange={(v) => updateBanner2({ autoPlay: v })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Vis pile</Label>
                                    <Switch
                                        checked={banner2.showArrows}
                                        onCheckedChange={(v) => updateBanner2({ showArrows: v })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Vis prikker</Label>
                                    <Switch
                                        checked={banner2.showDots}
                                        onCheckedChange={(v) => updateBanner2({ showDots: v })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Baggrund</Label>
                                <Select
                                    value={banner2.background.type}
                                    onValueChange={(v: "solid" | "gradient") =>
                                        updateBanner2({ background: { ...banner2.background, type: v } })
                                    }
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                                        <SelectItem value="gradient" className="text-xs">Gradient</SelectItem>
                                    </SelectContent>
                                </Select>

                                {banner2.background.type === "solid" && (
                                    <ColorPickerWithSwatches
                                        label="Baggrundsfarve"
                                        inline
                                        value={banner2.background.color}
                                        onChange={(color) => updateBanner2({ background: { ...banner2.background, color } })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                )}

                                {banner2.background.type === "gradient" && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <ColorPickerWithSwatches
                                                label="Gradient start"
                                                inline
                                                value={banner2.background.gradientStart}
                                                onChange={(color) => updateBanner2({ background: { ...banner2.background, gradientStart: color } })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Gradient slut"
                                                inline
                                                value={banner2.background.gradientEnd}
                                                onChange={(color) => updateBanner2({ background: { ...banner2.background, gradientEnd: color } })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Gradient vinkel (grader)</Label>
                                            <Input
                                                type="number"
                                                value={banner2.background.gradientAngle}
                                                onChange={(e) => updateBanner2({ background: { ...banner2.background, gradientAngle: Number(e.target.value) } })}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Label>Animeret gradient</Label>
                                            <Switch
                                                checked={banner2.background.animated}
                                                onCheckedChange={(v) => updateBanner2({ background: { ...banner2.background, animated: v } })}
                                            />
                                        </div>

                                        {banner2.background.animated && (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    <ColorPickerWithSwatches
                                                        label="Farve 1"
                                                        inline
                                                        value={banner2.background.animatedStart}
                                                        onChange={(color) => updateBanner2({ background: { ...banner2.background, animatedStart: color } })}
                                                        savedSwatches={savedSwatches}
                                                        onSaveSwatch={onSaveSwatch}
                                                        onRemoveSwatch={onRemoveSwatch}
                                                    />
                                                    <ColorPickerWithSwatches
                                                        label="Farve 2"
                                                        inline
                                                        value={banner2.background.animatedMiddle}
                                                        onChange={(color) => updateBanner2({ background: { ...banner2.background, animatedMiddle: color } })}
                                                        savedSwatches={savedSwatches}
                                                        onSaveSwatch={onSaveSwatch}
                                                        onRemoveSwatch={onRemoveSwatch}
                                                    />
                                                    <ColorPickerWithSwatches
                                                        label="Farve 3"
                                                        inline
                                                        value={banner2.background.animatedEnd}
                                                        onChange={(color) => updateBanner2({ background: { ...banner2.background, animatedEnd: color } })}
                                                        savedSwatches={savedSwatches}
                                                        onSaveSwatch={onSaveSwatch}
                                                        onRemoveSwatch={onRemoveSwatch}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Hastighed</Label>
                                                    <Select
                                                        value={banner2.background.animatedSpeed}
                                                        onValueChange={(v: "slow" | "slower") =>
                                                            updateBanner2({ background: { ...banner2.background, animatedSpeed: v } })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="slow" className="text-xs">Langsom</SelectItem>
                                                            <SelectItem value="slower" className="text-xs">Meget langsom</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {banner2.enabled && (
                <div className="space-y-4">
                    {banner2.slides.map((slide, index) => (
                        <Card key={slide.id} className="border-dashed">
                            <CardHeader className="py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <CardTitle className="text-sm font-medium">
                                        Sektion {index + 1}
                                    </CardTitle>
                                    <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1">
                                        <Switch
                                            checked={slide.enabled}
                                            onCheckedChange={(v) => updateSlide(slide.id, { enabled: v })}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => moveSlide(slide.id, "up")}
                                            disabled={index === 0}
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => moveSlide(slide.id, "down")}
                                            disabled={index === banner2.slides.length - 1}
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive"
                                            onClick={() => removeSlide(slide.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className={cn("space-y-4 min-w-0", !slide.enabled && "opacity-50")}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Visning (sek.)</Label>
                                        <Select
                                            value={String(slide.durationSeconds)}
                                            onValueChange={(v) => updateSlide(slide.id, { durationSeconds: Number(v) })}
                                            disabled={!slide.enabled}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5" className="text-xs">5 sek</SelectItem>
                                                <SelectItem value="10" className="text-xs">10 sek</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Kort i sektion</Label>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Layout className="h-4 w-4" />
                                            {slide.items.length}/{MAX_ITEMS_PER_SLIDE}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {slide.items.map((item, itemIndex) => (
                                        <Card key={item.id} className="border border-dashed">
                                            <CardHeader className="py-2">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <CardTitle className="text-xs font-medium">
                                                        Kort {itemIndex + 1}
                                                    </CardTitle>
                                                    <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1">
                                                        <Switch
                                                            checked={item.enabled}
                                                            onCheckedChange={(v) => updateItem(slide.id, item.id, { enabled: v })}
                                                            disabled={!slide.enabled}
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive"
                                                            onClick={() => removeItem(slide.id, item.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className={cn("space-y-3 min-w-0", !item.enabled && "opacity-60")}>
                                                <div className="space-y-2">
                                                    <Label>Ikon / billede</Label>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <Select
                                                            value={item.iconType}
                                                            onValueChange={(v: "icon" | "image" | "none") => updateItem(slide.id, item.id, { iconType: v })}
                                                            disabled={!slide.enabled || !item.enabled}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs w-32">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="icon" className="text-xs">Ikon</SelectItem>
                                                                <SelectItem value="image" className="text-xs">PNG</SelectItem>
                                                                <SelectItem value="none" className="text-xs">Ingen</SelectItem>
                                                            </SelectContent>
                                                        </Select>

                                                        {item.iconType === "icon" && (
                                                            <Select
                                                                value={item.iconName || "Truck"}
                                                                onValueChange={(v) => updateItem(slide.id, item.id, { iconName: v })}
                                                                disabled={!slide.enabled || !item.enabled}
                                                            >
                                                                <SelectTrigger className="h-7 text-xs w-40">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {BANNER2_ICON_OPTIONS.map((opt) => (
                                                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                            {opt.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}

                                                        {item.iconType === "image" && (
                                                            <div className="flex items-center gap-2">
                                                                {item.iconUrl ? (
                                                                    <div className="relative w-12 h-12 border rounded overflow-hidden">
                                                                        <img src={item.iconUrl} alt="" className="w-full h-full object-cover" />
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            className="absolute -top-2 -right-2 h-5 w-5"
                                                                            onClick={() => updateItem(slide.id, item.id, { iconUrl: undefined })}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 text-xs">
                                                                        {uploading === item.id ? (
                                                                            <div className="text-muted-foreground">Uploader...</div>
                                                                        ) : (
                                                                            <>
                                                                                <Upload className="h-4 w-4 text-muted-foreground" />
                                                                                Upload PNG
                                                                            </>
                                                                        )}
                                                                        <input
                                                                            type="file"
                                                                            className="hidden"
                                                                            accept="image/*"
                                                                            onChange={(e) => handleIconUpload(slide.id, item.id, e)}
                                                                            disabled={uploading === item.id || !slide.enabled || !item.enabled}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>Titel</Label>
                                                        <Input
                                                            value={item.title}
                                                            onChange={(e) => updateItem(slide.id, item.id, { title: e.target.value })}
                                                            disabled={!slide.enabled || !item.enabled}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Beskrivelse</Label>
                                                        <Textarea
                                                            value={item.description}
                                                            onChange={(e) => updateItem(slide.id, item.id, { description: e.target.value })}
                                                            rows={2}
                                                            disabled={!slide.enabled || !item.enabled}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3">
                                                    <FontSelector
                                                        label="Titel font"
                                                        inline
                                                        value={item.titleFont || "Poppins"}
                                                        onChange={(v) => updateItem(slide.id, item.id, { titleFont: v })}
                                                    />
                                                    <FontSelector
                                                        label="Beskrivelse font"
                                                        inline
                                                        value={item.descriptionFont || "Inter"}
                                                        onChange={(v) => updateItem(slide.id, item.id, { descriptionFont: v })}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 gap-3">
                                                    <ColorPickerWithSwatches
                                                        label="Titel farve"
                                                        inline
                                                        value={item.titleColor || "#FFFFFF"}
                                                        onChange={(color) => updateItem(slide.id, item.id, { titleColor: color })}
                                                        savedSwatches={savedSwatches}
                                                        onSaveSwatch={onSaveSwatch}
                                                        onRemoveSwatch={onRemoveSwatch}
                                                    />
                                                    <ColorPickerWithSwatches
                                                        label="Beskrivelse farve"
                                                        inline
                                                        value={item.descriptionColor || "#E5E7EB"}
                                                        onChange={(color) => updateItem(slide.id, item.id, { descriptionColor: color })}
                                                        savedSwatches={savedSwatches}
                                                        onSaveSwatch={onSaveSwatch}
                                                        onRemoveSwatch={onRemoveSwatch}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>Animation (kort)</Label>
                                                        <Select
                                                            value={item.groupAnimation || "none"}
                                                            onValueChange={(v) => updateItem(slide.id, item.id, { groupAnimation: v as Banner2Item["groupAnimation"] })}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                        {opt.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Animation (ikon)</Label>
                                                        <Select
                                                            value={item.iconAnimation || "none"}
                                                            onValueChange={(v) => updateItem(slide.id, item.id, { iconAnimation: v as Banner2Item["iconAnimation"] })}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                        {opt.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Animation (titel)</Label>
                                                        <Select
                                                            value={item.titleAnimation || "none"}
                                                            onValueChange={(v) => updateItem(slide.id, item.id, { titleAnimation: v as Banner2Item["titleAnimation"] })}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                        {opt.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Animation (beskrivelse)</Label>
                                                        <Select
                                                            value={item.descriptionAnimation || "none"}
                                                            onValueChange={(v) => updateItem(slide.id, item.id, { descriptionAnimation: v as Banner2Item["descriptionAnimation"] })}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                        {opt.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    {slide.items.length < MAX_ITEMS_PER_SLIDE && (
                                        <Button
                                            variant="outline"
                                            className="w-full border-dashed"
                                            onClick={() => addItem(slide.id)}
                                            disabled={!slide.enabled}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Tilføj kort
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {banner2.slides.length < MAX_SLIDES && (
                        <Button
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={addSlide}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Tilføj sektion
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
