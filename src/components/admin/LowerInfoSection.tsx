import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Trash2, Plus, Upload, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FontSelector } from "./FontSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { type BrandingData, type LowerInfoSettings, type LowerInfoItem, DEFAULT_FORSIDE } from "@/hooks/useBrandingDraft";

interface LowerInfoSectionProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
    lowerInfo?: LowerInfoSettings;
    onChangeLowerInfo?: (lowerInfo: LowerInfoSettings) => void;
}

const MAX_ITEMS = 6;

export function LowerInfoSection({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    lowerInfo: lowerInfoProp,
    onChangeLowerInfo,
}: LowerInfoSectionProps) {
    const [uploading, setUploading] = useState<string | null>(null);

    const forside = draft.forside ?? DEFAULT_FORSIDE;
    const lowerInfo = lowerInfoProp ?? forside.lowerInfo ?? DEFAULT_FORSIDE.lowerInfo;

    const updateLowerInfo = (updates: Partial<LowerInfoSettings>) => {
        const next: LowerInfoSettings = {
            ...lowerInfo,
            ...updates,
            background: updates.background
                ? { ...lowerInfo.background, ...updates.background }
                : lowerInfo.background,
            items: updates.items ?? lowerInfo.items,
            layout: updates.layout ?? lowerInfo.layout,
        };

        if (onChangeLowerInfo) {
            onChangeLowerInfo(next);
            return;
        }

        updateDraft({
            forside: {
                ...forside,
                lowerInfo: next,
            },
        });
    };

    const updateItem = (itemId: string, updates: Partial<LowerInfoItem>) => {
        const nextItems = lowerInfo.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
        );
        updateLowerInfo({ items: nextItems });
    };

    const addItem = () => {
        if (lowerInfo.items.length >= MAX_ITEMS) {
            toast.error(`Maksimalt ${MAX_ITEMS} bokse tilladt`);
            return;
        }
        const newItem: LowerInfoItem = {
            id: `lower-info-${Date.now()}`,
            enabled: true,
            title: "",
            description: "",
            titleFont: "Poppins",
            titleColor: "#1F2937",
            descriptionFont: "Inter",
            descriptionColor: "#4B5563",
            textAlign: "center",
            mediaType: "none",
            mediaAlign: "center",
            gallery: [],
        };
        updateLowerInfo({ items: [...lowerInfo.items, newItem] });
    };

    const removeItem = (itemId: string) => {
        updateLowerInfo({ items: lowerInfo.items.filter((i) => i.id !== itemId) });
    };

    const moveItem = (itemId: string, direction: "up" | "down") => {
        const index = lowerInfo.items.findIndex((i) => i.id === itemId);
        if (index === -1) return;
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= lowerInfo.items.length) return;
        const next = [...lowerInfo.items];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        updateLowerInfo({ items: next });
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
        const fileName = `lower-info-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
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

    const handleImageUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(itemId);
        try {
            const publicUrl = await uploadImageFile(file);
            if (!publicUrl) return;
            updateItem(itemId, { mediaType: "single", imageUrl: publicUrl });
            toast.success("Billede uploadet");
        } catch (error) {
            console.error("Error uploading:", error);
            toast.error("Kunne ikke uploade billede");
        } finally {
            setUploading(null);
        }
    };

    const handleGalleryUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploading(itemId);
        try {
            const uploaded: string[] = [];
            for (const file of files) {
                const publicUrl = await uploadImageFile(file);
                if (publicUrl) uploaded.push(publicUrl);
            }
            if (uploaded.length === 0) return;
            const item = lowerInfo.items.find((i) => i.id === itemId);
            const existing = item?.gallery || [];
            updateItem(itemId, { mediaType: "gallery", gallery: [...existing, ...uploaded] });
            toast.success("Galleri opdateret");
        } catch (error) {
            console.error("Error uploading:", error);
            toast.error("Kunne ikke uploade billeder");
        } finally {
            setUploading(null);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Nedre infobokse</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Vis sektion</Label>
                        <Switch
                            checked={lowerInfo.enabled}
                            onCheckedChange={(v) => updateLowerInfo({ enabled: v })}
                        />
                    </div>

                    {lowerInfo.enabled && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label>Layout</Label>
                                <Select
                                    value={lowerInfo.layout || "grid"}
                                    onValueChange={(v: "grid" | "stacked") => updateLowerInfo({ layout: v })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="grid" className="text-xs">Række (flere pr. række)</SelectItem>
                                        <SelectItem value="stacked" className="text-xs">Stakket (én pr. række)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Label>Baggrund</Label>
                            <Select
                                value={lowerInfo.background.type}
                                onValueChange={(v: "solid" | "gradient") =>
                                    updateLowerInfo({ background: { ...lowerInfo.background, type: v } })
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

                            {lowerInfo.background.type === "solid" && (
                                <ColorPickerWithSwatches
                                    label="Baggrundsfarve"
                                    inline
                                    value={lowerInfo.background.color}
                                    onChange={(color) => updateLowerInfo({ background: { ...lowerInfo.background, color } })}
                                    savedSwatches={savedSwatches}
                                    onSaveSwatch={onSaveSwatch}
                                    onRemoveSwatch={onRemoveSwatch}
                                />
                            )}

                            {lowerInfo.background.type === "gradient" && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <ColorPickerWithSwatches
                                            label="Gradient start"
                                            inline
                                            value={lowerInfo.background.gradientStart}
                                            onChange={(color) => updateLowerInfo({ background: { ...lowerInfo.background, gradientStart: color } })}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Gradient slut"
                                            inline
                                            value={lowerInfo.background.gradientEnd}
                                            onChange={(color) => updateLowerInfo({ background: { ...lowerInfo.background, gradientEnd: color } })}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Gradient vinkel (grader)</Label>
                                        <Input
                                            type="number"
                                            value={lowerInfo.background.gradientAngle}
                                            onChange={(e) => updateLowerInfo({ background: { ...lowerInfo.background, gradientAngle: Number(e.target.value) } })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {lowerInfo.enabled && (
                <div className="space-y-4">
                    {lowerInfo.items.map((item, index) => (
                        <Card key={item.id} className="border-dashed">
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium">Boks {index + 1}</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <Switch
                                            checked={item.enabled}
                                            onCheckedChange={(v) => updateItem(item.id, { enabled: v })}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => moveItem(item.id, "up")}
                                            disabled={index === 0}
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => moveItem(item.id, "down")}
                                            disabled={index === lowerInfo.items.length - 1}
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive"
                                            onClick={() => removeItem(item.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className={cn("space-y-4", !item.enabled && "opacity-50")}>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Titel</Label>
                                        <Input
                                            value={item.title}
                                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                                            disabled={!item.enabled}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Beskrivelse</Label>
                                        <Textarea
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                            rows={2}
                                            disabled={!item.enabled}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <FontSelector
                                        label="Titel font"
                                        inline
                                        value={item.titleFont || "Poppins"}
                                        onChange={(v) => updateItem(item.id, { titleFont: v })}
                                    />
                                    <FontSelector
                                        label="Beskrivelse font"
                                        inline
                                        value={item.descriptionFont || "Inter"}
                                        onChange={(v) => updateItem(item.id, { descriptionFont: v })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <ColorPickerWithSwatches
                                        label="Titel farve"
                                        inline
                                        value={item.titleColor || "#1F2937"}
                                        onChange={(color) => updateItem(item.id, { titleColor: color })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Beskrivelse farve"
                                        inline
                                        value={item.descriptionColor || "#4B5563"}
                                        onChange={(color) => updateItem(item.id, { descriptionColor: color })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Tekst justering</Label>
                                    <Select
                                        value={item.textAlign || "center"}
                                        onValueChange={(v: "left" | "center" | "right") => updateItem(item.id, { textAlign: v })}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left" className="text-xs">Venstre</SelectItem>
                                            <SelectItem value="center" className="text-xs">Center</SelectItem>
                                            <SelectItem value="right" className="text-xs">Højre</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>Medie</Label>
                                        <Select
                                            value={item.mediaType}
                                            onValueChange={(v: "none" | "single" | "gallery") => updateItem(item.id, { mediaType: v })}
                                        >
                                            <SelectTrigger className="h-7 text-xs w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs">Ingen</SelectItem>
                                                <SelectItem value="single" className="text-xs">Billede</SelectItem>
                                                <SelectItem value="gallery" className="text-xs">Galleri</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {item.mediaType !== "none" && (
                                        <div className="flex items-start gap-4 p-2 border rounded-md">
                                            {item.mediaType === "single" ? (
                                                <>
                                                    {item.imageUrl ? (
                                                        <div className="relative w-24 h-16 border rounded overflow-hidden flex-shrink-0">
                                                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                                            <Button
                                                                variant="destructive"
                                                                size="icon"
                                                                className="absolute top-1 right-1 h-5 w-5"
                                                                onClick={() => updateItem(item.id, { imageUrl: undefined })}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <label className="w-24 h-16 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 flex-shrink-0">
                                                            {uploading === item.id ? (
                                                                <div className="text-xs text-muted-foreground">Uploader...</div>
                                                            ) : (
                                                                <>
                                                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                                                    <span className="text-[10px] text-muted-foreground">Upload</span>
                                                                </>
                                                            )}
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={(e) => handleImageUpload(item.id, e)}
                                                                disabled={uploading === item.id || !item.enabled}
                                                            />
                                                        </label>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <label className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 text-xs">
                                                            {uploading === item.id ? (
                                                                <div className="text-muted-foreground">Uploader...</div>
                                                            ) : (
                                                                <>
                                                                    <Images className="h-4 w-4 text-muted-foreground" />
                                                                    Tilføj billeder
                                                                </>
                                                            )}
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                multiple
                                                                onChange={(e) => handleGalleryUpload(item.id, e)}
                                                                disabled={uploading === item.id || !item.enabled}
                                                            />
                                                        </label>
                                                        <span className="text-xs text-muted-foreground">{(item.gallery || []).length} billeder</span>
                                                    </div>

                                                    {(item.gallery || []).length > 0 && (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {(item.gallery || []).map((url, i) => (
                                                                <div key={`${item.id}-gallery-${i}`} className="relative h-16 border rounded overflow-hidden">
                                                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="icon"
                                                                        className="absolute top-1 right-1 h-5 w-5"
                                                                        onClick={() => updateItem(item.id, { gallery: (item.gallery || []).filter((_, idx) => idx !== i) })}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex-1 space-y-2">
                                                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Placering</Label>
                                                <Select
                                                    value={item.mediaAlign}
                                                    onValueChange={(v: "left" | "right" | "center") => updateItem(item.id, { mediaAlign: v })}
                                                >
                                                    <SelectTrigger className="h-7 text-xs w-28">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="left" className="text-xs">Venstre</SelectItem>
                                                        <SelectItem value="center" className="text-xs">Center</SelectItem>
                                                        <SelectItem value="right" className="text-xs">Højre</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {lowerInfo.items.length < MAX_ITEMS && (
                        <Button
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={addItem}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Tilføj boks
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
