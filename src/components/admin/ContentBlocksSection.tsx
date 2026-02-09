
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight,
    Loader2, Trash2, Plus, Upload, Images
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { FontSelector } from "./FontSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import {
    type BrandingData,
    type ContentBlock,
} from "@/hooks/useBrandingDraft";

interface ContentBlocksSectionProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
    focusedBlockId?: string | null;
    contentBlocks?: ContentBlock[];
    onChangeContentBlocks?: (blocks: ContentBlock[]) => void;
    maxBlocks?: number;
    showPlacement?: boolean;
}

export function ContentBlocksSection({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    focusedBlockId,
    contentBlocks: contentBlocksProp,
    onChangeContentBlocks,
    maxBlocks,
    showPlacement = true,
}: ContentBlocksSectionProps) {
    const [uploading, setUploading] = useState<string | null>(null);

    const forside = draft.forside;
    const contentBlocks = (contentBlocksProp ?? forside.contentBlocks) || [];
    const maxAllowed = maxBlocks ?? 4;
    const defaultCta = {
        enabled: false,
        label: '',
        href: '',
        bgColor: '#0EA5E9',
        textColor: '#FFFFFF',
        hoverBgColor: '#0284C7',
        hoverTextColor: '#FFFFFF',
        font: 'Poppins',
        style: 'solid' as const,
        size: 'md' as const,
    };

    const updateBlocks = (blocks: ContentBlock[]) => {
        if (onChangeContentBlocks) {
            onChangeContentBlocks(blocks);
            return;
        }
        updateDraft({
            forside: { ...forside, contentBlocks: blocks },
        });
    };

    // Generate unique ID
    const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add content block
    const addContentBlock = () => {
        if (contentBlocks.length >= maxAllowed) {
            toast.error(`Maksimalt ${maxAllowed} indholdsblokke tilladt`);
            return;
        }
        const newBlock: ContentBlock = {
            id: generateId(),
            enabled: true,
            heading: '',
            text: '',
            imageUrl: undefined,
            gallery: [],
            mediaType: 'single',
            imagePosition: 'left',
            textAlign: 'left',
            placement: 'below_products',
            cta: defaultCta,
        };
        updateBlocks([...contentBlocks, newBlock]);
    };

    // Update content block
    const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
        updateBlocks(
            contentBlocks.map(b => b.id === id ? { ...b, ...updates } : b)
        );
    };

    // Remove content block
    const removeBlock = (id: string) => {
        updateBlocks(contentBlocks.filter(b => b.id !== id));
    };

    // Move block up/down
    const moveBlock = (id: string, direction: 'up' | 'down') => {
        const index = contentBlocks.findIndex(b => b.id === id);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= contentBlocks.length) return;

        const newBlocks = [...contentBlocks];
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        updateBlocks(newBlocks);
    };

    const uploadImageFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return null;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Billede må højst være 5MB');
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `content-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
        const filePath = `branding/${tenantId || 'master'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    // Upload image for content block (single)
    const handleImageUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(blockId);
        try {
            const publicUrl = await uploadImageFile(file);
            if (!publicUrl) return;
            updateBlock(blockId, { imageUrl: publicUrl });
            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade billede');
        } finally {
            setUploading(null);
        }
    };

    const handleGalleryUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploading(blockId);
        try {
            const uploaded: string[] = [];
            for (const file of files) {
                const publicUrl = await uploadImageFile(file);
                if (publicUrl) uploaded.push(publicUrl);
            }

            if (uploaded.length === 0) return;

            const block = contentBlocks.find((b) => b.id === blockId);
            const existing = block?.gallery || [];
            updateBlock(blockId, { gallery: [...existing, ...uploaded] });
            toast.success('Galleri opdateret');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade billeder');
        } finally {
            setUploading(null);
        }
    };

    // Auto-scroll to focused block
    useEffect(() => {
        if (focusedBlockId) {
            const element = document.getElementById(`editor-${focusedBlockId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional: add a highlight effect here
                element.classList.add('ring-2', 'ring-primary');
                setTimeout(() => element.classList.remove('ring-2', 'ring-primary'), 2000);
            }
        }
    }, [focusedBlockId]);

    return (
        <div className="space-y-4">
            {contentBlocks.map((block, index) => {
                const safeCta = { ...defaultCta, ...(block.cta || {}) };
                const mediaType = block.mediaType || (block.gallery?.length ? 'gallery' : 'single');
                const gallery = block.gallery || [];

                return (
                    <Card
                        key={block.id}
                        id={`editor-${block.id}`}
                        className={cn(
                            "border-dashed transition-all duration-300",
                            focusedBlockId === block.id && "border-primary shadow-md"
                        )}
                    >
                        <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">
                                    Blok {index + 1}
                                </CardTitle>
                                <div className="flex items-center gap-1">
                                    <Switch
                                        checked={block.enabled}
                                        onCheckedChange={(v) => updateBlock(block.id, { enabled: v })}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveBlock(block.id, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveBlock(block.id, 'down')}
                                        disabled={index === contentBlocks.length - 1}
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => removeBlock(block.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className={cn("space-y-4", !block.enabled && "opacity-50")}>
                            {showPlacement && (
                                <div className="space-y-2">
                                    <Label>Placering i forhold til produkter</Label>
                                    <Select
                                        value={block.placement || 'below_products'}
                                        onValueChange={(v: 'above_products' | 'below_products') => updateBlock(block.id, { placement: v })}
                                        disabled={!block.enabled}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="above_products" className="text-xs">Over produkter</SelectItem>
                                            <SelectItem value="below_products" className="text-xs">Under produkter</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {/* Heading */}
                            <div className="space-y-3">
                                <Label>Overskrift (H2)</Label>

                                <div className="space-y-3 pt-1">
                                    <FontSelector
                                        label="Skrifttype"
                                        inline
                                        value={block.headingFont || 'Poppins'}
                                        onChange={(v) => updateBlock(block.id, { headingFont: v })}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        inline
                                        value={block.headingColor || '#1F2937'}
                                        onChange={(color) => updateBlock(block.id, { headingColor: color })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                </div>

                                <Input
                                    placeholder="Indtast overskrift..."
                                    value={block.heading || ''}
                                    onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                                    disabled={!block.enabled}
                                />
                            </div>

                            {/* Text */}
                            <div className="space-y-3">
                                <Label>Tekst</Label>

                                <div className="space-y-3 pt-1">
                                    <FontSelector
                                        label="Skrifttype"
                                        inline
                                        value={block.textFont || 'Inter'}
                                        onChange={(v) => updateBlock(block.id, { textFont: v })}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        inline
                                        value={block.textColor || '#4B5563'}
                                        onChange={(color) => updateBlock(block.id, { textColor: color })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                </div>

                                <Textarea
                                    placeholder="Indtast brødtekst..."
                                    value={block.text || ''}
                                    onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                                    rows={3}
                                    disabled={!block.enabled}
                                />
                            </div>

                            {/* Media */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Medie</Label>
                                    <Select
                                        value={mediaType}
                                        onValueChange={(v: 'single' | 'gallery') => {
                                            if (v === 'gallery' && block.imageUrl && gallery.length === 0) {
                                                updateBlock(block.id, { mediaType: v, gallery: [block.imageUrl], imageUrl: undefined });
                                                return;
                                            }
                                            if (v === 'single' && !block.imageUrl && gallery.length > 0) {
                                                updateBlock(block.id, { mediaType: v, imageUrl: gallery[0], gallery: [] });
                                                return;
                                            }
                                            updateBlock(block.id, { mediaType: v });
                                        }}
                                        disabled={!block.enabled}
                                    >
                                        <SelectTrigger className="h-7 text-xs w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single" className="text-xs">Enkelt billede</SelectItem>
                                            <SelectItem value="gallery" className="text-xs">Galleri</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-start gap-4 p-2 border rounded-md">
                                    {mediaType === 'single' ? (
                                        <>
                                            {block.imageUrl ? (
                                                <div className="relative w-24 h-16 border rounded overflow-hidden flex-shrink-0">
                                                    <img
                                                        src={block.imageUrl}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-5 w-5"
                                                        onClick={() => updateBlock(block.id, { imageUrl: undefined })}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <label className="w-24 h-16 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 flex-shrink-0">
                                                    {uploading === block.id ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                                                        onChange={(e) => handleImageUpload(block.id, e)}
                                                        disabled={uploading === block.id || !block.enabled}
                                                    />
                                                </label>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <label className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 text-xs">
                                                    {uploading === block.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                                                        onChange={(e) => handleGalleryUpload(block.id, e)}
                                                        disabled={uploading === block.id || !block.enabled}
                                                    />
                                                </label>
                                                <span className="text-xs text-muted-foreground">{gallery.length} billeder</span>
                                            </div>

                                            {gallery.length > 0 && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {gallery.map((url, i) => (
                                                        <div key={`${block.id}-gallery-${i}`} className="relative h-16 border rounded overflow-hidden">
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                            <Button
                                                                variant="destructive"
                                                                size="icon"
                                                                className="absolute top-1 right-1 h-5 w-5"
                                                                onClick={() => updateBlock(block.id, { gallery: gallery.filter((_, idx) => idx !== i) })}
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
                                        {/* Image Position */}
                                        <div className="flex items-center justify-between gap-3">
                                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Placering</Label>
                                            <Select
                                                value={block.imagePosition}
                                                onValueChange={(v: 'left' | 'right') => updateBlock(block.id, { imagePosition: v })}
                                                disabled={!block.enabled}
                                            >
                                                <SelectTrigger className="h-7 text-xs w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="left" className="text-xs">Venstre</SelectItem>
                                                    <SelectItem value="right" className="text-xs">Højre</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Text Alignment */}
                                        <div className="flex items-center justify-between gap-3">
                                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Justering</Label>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant={block.textAlign === 'left' ? 'secondary' : 'ghost'}
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateBlock(block.id, { textAlign: 'left' })}
                                                    disabled={!block.enabled}
                                                >
                                                    <AlignLeft className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant={block.textAlign === 'center' ? 'secondary' : 'ghost'}
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateBlock(block.id, { textAlign: 'center' })}
                                                    disabled={!block.enabled}
                                                >
                                                    <AlignCenter className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant={block.textAlign === 'right' ? 'secondary' : 'ghost'}
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateBlock(block.id, { textAlign: 'right' })}
                                                    disabled={!block.enabled}
                                                >
                                                    <AlignRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Call-to-action knap</Label>
                                    <Switch
                                        checked={safeCta.enabled}
                                        onCheckedChange={(v) => updateBlock(block.id, { cta: { ...safeCta, enabled: v } })}
                                    />
                                </div>

                                {safeCta.enabled && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Knaptekst</Label>
                                                <Input
                                                    value={safeCta.label}
                                                    onChange={(e) => updateBlock(block.id, { cta: { ...safeCta, label: e.target.value } })}
                                                    placeholder="Kontakt os"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Link URL</Label>
                                                <Input
                                                    value={safeCta.href}
                                                    onChange={(e) => updateBlock(block.id, { cta: { ...safeCta, href: e.target.value } })}
                                                    placeholder="/kontakt"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Stil</Label>
                                                <Select
                                                    value={safeCta.style}
                                                    onValueChange={(v: 'solid' | 'outline') => updateBlock(block.id, { cta: { ...safeCta, style: v } })}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="solid" className="text-xs">Fyldt</SelectItem>
                                                        <SelectItem value="outline" className="text-xs">Outline</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label>Størrelse</Label>
                                                    <Select
                                                        value={safeCta.size}
                                                        onValueChange={(v: 'sm' | 'md' | 'lg') => updateBlock(block.id, { cta: { ...safeCta, size: v } })}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="sm" className="text-xs">Lille</SelectItem>
                                                            <SelectItem value="md" className="text-xs">Mellem</SelectItem>
                                                            <SelectItem value="lg" className="text-xs">Stor</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <FontSelector
                                                label="Skrifttype"
                                                inline
                                                value={safeCta.font || 'Poppins'}
                                                onChange={(v) => updateBlock(block.id, { cta: { ...safeCta, font: v } })}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Knap baggrundsfarve"
                                                inline
                                                value={safeCta.bgColor || '#0EA5E9'}
                                                onChange={(color) => updateBlock(block.id, { cta: { ...safeCta, bgColor: color } })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Knap tekstfarve"
                                                inline
                                                value={safeCta.textColor || '#FFFFFF'}
                                                onChange={(color) => updateBlock(block.id, { cta: { ...safeCta, textColor: color } })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Knap hover farve"
                                                inline
                                                value={safeCta.hoverBgColor || '#0284C7'}
                                                onChange={(color) => updateBlock(block.id, { cta: { ...safeCta, hoverBgColor: color } })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Knap hover tekstfarve"
                                                inline
                                                value={safeCta.hoverTextColor || '#FFFFFF'}
                                                onChange={(color) => updateBlock(block.id, { cta: { ...safeCta, hoverTextColor: color } })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {contentBlocks.length < 4 && (
                <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={addContentBlock}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Tilføj indholdsblok
                </Button>
            )}

            {contentBlocks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                    Ingen indholdsblokke endnu. Klik på knappen ovenfor for at tilføje en.
                </p>
            )}
        </div>
    );
}
