
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Trash2, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FontSelector } from "./FontSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { type BrandingData } from "@/hooks/useBrandingDraft";

interface LogoSectionProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
    focusTargetId?: string | null;
}

export function LogoSection({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    focusTargetId,
}: LogoSectionProps) {
    const [uploading, setUploading] = useState(false);
    const logoHeightPx = Math.min(120, Math.max(24, Number(draft.header.logoHeightPx) || 40));
    const updateLogoHeight = (heightPx: number) => {
        const nextHeight = Math.min(120, Math.max(24, Math.round(heightPx)));
        updateDraft({
            header: {
                ...draft.header,
                logoHeightPx: nextHeight,
            },
        });
    };

    // Handle logo upload
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            updateDraft({ logo_url: publicUrl });
            toast.success('Logo uploadet');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade logo');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div id="site-design-focus-logo" className={focusTargetId === "site-design-focus-logo" ? "space-y-4 rounded-xl ring-2 ring-primary/50 ring-offset-2" : "space-y-4"}>
            {/* Logo Type Toggle */}
            <div className="flex gap-2">
                <Button
                    variant={draft.header.logoType === 'text' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDraft({
                        header: { ...draft.header, logoType: 'text' }
                    })}
                >
                    Tekst
                </Button>
                <Button
                    variant={draft.header.logoType === 'image' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDraft({
                        header: { ...draft.header, logoType: 'image' }
                    })}
                >
                    Billede
                </Button>
            </div>

            {/* Text Logo Options */}
            {draft.header.logoType === 'text' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                        <Label>Logo tekst</Label>
                        <Input
                            placeholder="Indtast shopnavn..."
                            value={draft.header.logoText || ''}
                            onChange={(e) => updateDraft({
                                header: { ...draft.header, logoText: e.target.value }
                            })}
                        />
                    </div>
                    <div className="space-y-2">
                        <FontSelector
                            label="Skrifttype"
                            value={draft.header.logoFont || draft.fonts.heading}
                            onChange={(font) => updateDraft({
                                header: { ...draft.header, logoFont: font }
                            })}
                        />
                    </div>
                    <div className="space-y-2">
                        <ColorPickerWithSwatches
                            label="Logo tekstfarve"
                            value={draft.header.logoTextColor || '#1F2937'}
                            onChange={(color) => updateDraft({
                                header: { ...draft.header, logoTextColor: color }
                            })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>
                    {/* Preview */}
                    <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Forhåndsvisning:</p>
                        <span
                            className="text-xl font-bold"
                            style={{
                                color: draft.header.logoTextColor || '#1F2937',
                                fontFamily: `'${draft.header.logoFont || draft.fonts.heading}', sans-serif`
                            }}
                        >
                            {draft.header.logoText || 'Min Shop'}
                        </span>
                    </div>
                </div>
            )}

            {/* Image Logo Options */}
            {draft.header.logoType === 'image' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-4">
                        {(draft.logo_url || draft.header.logoImageUrl) ? (
                            <div className="relative w-32 h-16 border rounded-lg overflow-hidden bg-white">
                                <img
                                    src={draft.logo_url || draft.header.logoImageUrl || ''}
                                    alt="Logo"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-32 h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                                Intet logo
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <label className="cursor-pointer">
                                <Button variant="outline" size="sm" asChild disabled={uploading}>
                                    <span>
                                        {uploading ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4 mr-2" />
                                        )}
                                        Upload logo
                                    </span>
                                </Button>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    disabled={uploading}
                                />
                            </label>
                            {(draft.logo_url || draft.header.logoImageUrl) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        updateDraft({
                                            logo_url: null,
                                            header: { ...draft.header, logoImageUrl: null }
                                        });
                                    }}
                                    className="text-destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Fjern logo
                                </Button>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Anbefalet: PNG eller SVG. Logoet skaleres automatisk til at passe i headeren.
                    </p>
                    <div className="space-y-3 rounded-lg border bg-background/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label>Logo størrelse</Label>
                                <p className="text-xs text-muted-foreground">Styrer højden på det uploadede logo i headeren.</p>
                            </div>
                            <span className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">
                                {logoHeightPx}px
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => updateLogoHeight(logoHeightPx - 4)}
                                disabled={logoHeightPx <= 24}
                                aria-label="Gør logo mindre"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Slider
                                min={24}
                                max={120}
                                step={2}
                                value={[logoHeightPx]}
                                onValueChange={([value]) => updateLogoHeight(value)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => updateLogoHeight(logoHeightPx + 4)}
                                disabled={logoHeightPx >= 120}
                                aria-label="Gør logo større"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
