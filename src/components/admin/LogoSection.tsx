
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";
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
}

export function LogoSection({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
}: LogoSectionProps) {
    const [uploading, setUploading] = useState(false);

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
        <div className="space-y-4">
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
                </div>
            )}
        </div>
    );
}
