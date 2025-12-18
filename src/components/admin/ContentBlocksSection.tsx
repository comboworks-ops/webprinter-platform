
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
    Loader2, Trash2, Plus, Upload, Layout
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { FontSelector } from "./FontSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import {
    type BrandingData,
    type ContentBlock,
    type ForsideSettings,
} from "@/hooks/useBrandingDraft";

interface ContentBlocksSectionProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
    focusedBlockId?: string | null;
}

export function ContentBlocksSection({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    focusedBlockId
}: ContentBlocksSectionProps) {
    const [uploading, setUploading] = useState<string | null>(null);

    const forside = draft.forside;
    const contentBlocks = forside.contentBlocks || [];

    const updateForside = (updates: Partial<ForsideSettings>) => {
        updateDraft({
            forside: { ...forside, ...updates },
        });
    };

    // Generate unique ID
    const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add content block
    const addContentBlock = () => {
        if (contentBlocks.length >= 4) {
            toast.error('Maksimalt 4 indholdsblokke tilladt');
            return;
        }
        const newBlock: ContentBlock = {
            id: generateId(),
            enabled: true,
            heading: '',
            text: '',
            imageUrl: undefined,
            imagePosition: 'left',
            textAlign: 'left',
        };
        updateForside({ contentBlocks: [...contentBlocks, newBlock] });
    };

    // Update content block
    const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
        updateForside({
            contentBlocks: contentBlocks.map(b =>
                b.id === id ? { ...b, ...updates } : b
            ),
        });
    };

    // Remove content block
    const removeBlock = (id: string) => {
        updateForside({
            contentBlocks: contentBlocks.filter(b => b.id !== id),
        });
    };

    // Move block up/down
    const moveBlock = (id: string, direction: 'up' | 'down') => {
        const index = contentBlocks.findIndex(b => b.id === id);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= contentBlocks.length) return;

        const newBlocks = [...contentBlocks];
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        updateForside({ contentBlocks: newBlocks });
    };

    // Upload image for content block
    const handleImageUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Billede må højst være 5MB');
            return;
        }

        setUploading(blockId);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `content-block-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            updateBlock(blockId, { imageUrl: publicUrl });
            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade billede');
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
            {contentBlocks.map((block, index) => (
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

                        {/* Image */}
                        <div className="space-y-3">
                            <Label>Billede</Label>

                            <div className="flex items-center gap-4 p-2 border rounded-md">
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
                    </CardContent>
                </Card>
            ))}

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
