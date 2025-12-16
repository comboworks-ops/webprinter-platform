/**
 * Forside (Front Page) Editor Section
 * 
 * Unified section that combines Logo, Header, Banner toggle, Content Blocks, and Footer
 * into a single "Forside" tab with collapsible subsections.
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import {
    ChevronDown, Image as ImageIcon, Layout, Plus, Trash2,
    Upload, ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Import existing section components
import { HeaderSection } from "./HeaderSection";
import { BannerEditor } from "./BannerEditor";
import { FooterSection } from "./FooterSection";
import { FontSelector } from "./FontSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";

import {
    type BrandingData,
    type ContentBlock,
    type ForsideSettings,
    type HeaderSettings,
    type FooterSettings,
} from "@/hooks/useBrandingDraft";

interface ForsideSectionProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
}

export function ForsideSection({
    draft,
    updateDraft,
    tenantId,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
}: ForsideSectionProps) {
    const [uploading, setUploading] = useState<string | null>(null);

    const forside = draft.forside;
    const contentBlocks = forside.contentBlocks || [];

    // Update forside settings
    const updateForside = useCallback((updates: Partial<ForsideSettings>) => {
        updateDraft({
            forside: { ...forside, ...updates },
        });
    }, [forside, updateDraft]);

    // Update header
    const handleHeaderChange = useCallback((header: HeaderSettings) => {
        updateDraft({ header });
    }, [updateDraft]);

    // Update footer
    const handleFooterChange = useCallback((footer: FooterSettings) => {
        updateDraft({ footer });
    }, [updateDraft]);

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

    // Handle logo upload
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return;
        }

        setUploading('logo');
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
            setUploading(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Logo Section */}
            <CollapsibleCard
                title="Logo"
                description="Vælg mellem billede eller tekst-logo"
                icon={<ImageIcon className="h-4 w-4" />}
                defaultOpen={false}
            >
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
                                        <Button variant="outline" size="sm" asChild disabled={uploading === 'logo'}>
                                            <span>
                                                {uploading === 'logo' ? (
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
                                            disabled={uploading === 'logo'}
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
            </CollapsibleCard>

            {/* Header Section */}
            <CollapsibleCard
                title="Header"
                description="Navigation, styling og scroll-opførsel"
                icon={<Layout className="h-4 w-4" />}
                defaultOpen={false}
            >
                <HeaderSection
                    header={draft.header}
                    onChange={handleHeaderChange}
                    savedSwatches={savedSwatches}
                    onSaveSwatch={onSaveSwatch}
                    onRemoveSwatch={onRemoveSwatch}
                />
            </CollapsibleCard>

            {/* Banner Toggle + Editor */}
            <CollapsibleCard
                title="Banner"
                description="Vis/skjul hero banner og rediger indhold"
                icon={<ImageIcon className="h-4 w-4" />}
                defaultOpen={false}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b">
                        <div>
                            <Label>Vis banner</Label>
                            <p className="text-xs text-muted-foreground">Aktiver hero-sektionen på forsiden</p>
                        </div>
                        <Switch
                            checked={forside.showBanner}
                            onCheckedChange={(checked) => updateForside({ showBanner: checked })}
                        />
                    </div>
                    {forside.showBanner && (
                        <BannerEditor
                            draft={draft}
                            updateDraft={updateDraft}
                            tenantId={tenantId}
                        />
                    )}
                </div>
            </CollapsibleCard>

            {/* Content Blocks */}
            <CollapsibleCard
                title="Indholdsblokke"
                description="Tilføj sektioner med billede og tekst (maks 4)"
                icon={<Layout className="h-4 w-4" />}
                defaultOpen={true}
            >
                <div className="space-y-4">
                    {contentBlocks.map((block, index) => (
                        <Card key={block.id} className="border-dashed">
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
                                <div className="space-y-2">
                                    <Label>Overskrift (H2)</Label>
                                    <Input
                                        placeholder="Indtast overskrift..."
                                        value={block.heading || ''}
                                        onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                                        disabled={!block.enabled}
                                    />
                                </div>

                                {/* Text */}
                                <div className="space-y-2">
                                    <Label>Tekst</Label>
                                    <Textarea
                                        placeholder="Indtast brødtekst..."
                                        value={block.text || ''}
                                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                                        rows={3}
                                        disabled={!block.enabled}
                                    />
                                </div>

                                {/* Image */}
                                <div className="space-y-2">
                                    <Label>Billede</Label>
                                    <div className="flex items-center gap-4">
                                        {block.imageUrl ? (
                                            <div className="relative w-24 h-16 border rounded overflow-hidden">
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
                                            <label className="w-24 h-16 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50">
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

                                        {/* Image Position */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Placering</Label>
                                            <Select
                                                value={block.imagePosition}
                                                onValueChange={(v: 'left' | 'right') => updateBlock(block.id, { imagePosition: v })}
                                                disabled={!block.enabled}
                                            >
                                                <SelectTrigger className="w-24 h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="left">Venstre</SelectItem>
                                                    <SelectItem value="right">Højre</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Text Alignment */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Tekstjustering</Label>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant={block.textAlign === 'left' ? 'default' : 'outline'}
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => updateBlock(block.id, { textAlign: 'left' })}
                                                    disabled={!block.enabled}
                                                >
                                                    <AlignLeft className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant={block.textAlign === 'center' ? 'default' : 'outline'}
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => updateBlock(block.id, { textAlign: 'center' })}
                                                    disabled={!block.enabled}
                                                >
                                                    <AlignCenter className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant={block.textAlign === 'right' ? 'default' : 'outline'}
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => updateBlock(block.id, { textAlign: 'right' })}
                                                    disabled={!block.enabled}
                                                >
                                                    <AlignRight className="h-4 w-4" />
                                                </Button>
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
            </CollapsibleCard>

            {/* Footer Section */}
            <CollapsibleCard
                title="Footer"
                description="Links, sociale medier og copyright"
                icon={<Layout className="h-4 w-4" />}
                defaultOpen={false}
            >
                <FooterSection
                    footer={draft.footer}
                    onChange={handleFooterChange}
                    savedSwatches={savedSwatches}
                    onSaveSwatch={onSaveSwatch}
                    onRemoveSwatch={onRemoveSwatch}
                />
            </CollapsibleCard>
        </div>
    );
}

export default ForsideSection;
