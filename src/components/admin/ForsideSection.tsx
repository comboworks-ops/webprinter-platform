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
import { LogoSection } from "./LogoSection";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Slider } from "@/components/ui/slider";

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
    const productsSection = forside.productsSection || { enabled: true, columns: 4 };
    const layoutStyle = productsSection.layoutStyle || 'cards';
    const buttonConfig = productsSection.button || {
        style: 'default',
        bgColor: '#0EA5E9',
        hoverBgColor: '#0284C7',
        textColor: '#FFFFFF',
        hoverTextColor: '#FFFFFF',
        font: 'Poppins',
        animation: 'none'
    };
    const backgroundConfig = productsSection.background || {
        type: 'solid',
        color: '#FFFFFF',
        gradientStart: '#FFFFFF',
        gradientEnd: '#F1F5F9',
        gradientAngle: 135,
        opacity: 1,
    };

    // Update forside settings
    const updateForside = useCallback((updates: Partial<ForsideSettings>) => {
        updateDraft({
            forside: { ...forside, ...updates },
        });
    }, [forside, updateDraft]);

    const updateProductsSection = useCallback((updates: Partial<ForsideSettings["productsSection"]>) => {
        updateForside({
            productsSection: { ...productsSection, ...updates },
        });
    }, [productsSection, updateForside]);

    const updateButtonConfig = useCallback((updates: Partial<ForsideSettings["productsSection"]["button"]>) => {
        updateProductsSection({
            button: { ...buttonConfig, ...updates },
        });
    }, [buttonConfig, updateProductsSection]);

    const updateBackgroundConfig = useCallback((updates: Partial<ForsideSettings["productsSection"]["background"]>) => {
        updateProductsSection({
            background: { ...backgroundConfig, ...updates },
        });
    }, [backgroundConfig, updateProductsSection]);

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



    return (
        <div className="space-y-4">
            {/* Logo Section */}
            <CollapsibleCard
                title="Logo"
                description="Vælg mellem billede eller tekst-logo"
                icon={<ImageIcon className="h-4 w-4" />}
                defaultOpen={false}
            >
                <LogoSection
                    draft={draft}
                    updateDraft={updateDraft}
                    tenantId={tenantId}
                    savedSwatches={savedSwatches}
                    onSaveSwatch={onSaveSwatch}
                    onRemoveSwatch={onRemoveSwatch}
                />
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
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    )}
                </div>
            </CollapsibleCard>

            {/* Forside produkter */}
            <CollapsibleCard
                title="Forside produkter"
                description="Vælg layout for produktbokse på forsiden"
                icon={<Layout className="h-4 w-4" />}
                defaultOpen={false}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b">
                        <div>
                            <Label>Vis forside produkter</Label>
                            <p className="text-xs text-muted-foreground">Sektionen vises mellem banner og indholdsblokke</p>
                        </div>
                        <Switch
                            checked={productsSection.enabled}
                            onCheckedChange={(checked) => updateProductsSection({ enabled: checked })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Kolonner pr. række</Label>
                        <Select
                            value={String(productsSection.columns)}
                            onValueChange={(value) => updateProductsSection({ columns: Number(value) as 3 | 4 | 5 })}
                            disabled={!productsSection.enabled}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3 pr. række</SelectItem>
                                <SelectItem value="4">4 pr. række</SelectItem>
                                <SelectItem value="5">5 pr. række</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Forside produkt layout</Label>
                        <Select
                            value={layoutStyle}
                            onValueChange={(value) => updateProductsSection({ layoutStyle: value as ForsideSettings["productsSection"]["layoutStyle"] })}
                            disabled={!productsSection.enabled}
                        >
                            <SelectTrigger className="w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cards">Standard (separate bokse)</SelectItem>
                                <SelectItem value="flat">Ingen ramme</SelectItem>
                                <SelectItem value="grouped">En samlet ramme</SelectItem>
                                <SelectItem value="slim">Slim horisontal</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <Label>Vis kategori knap</Label>
                            <p className="text-xs text-muted-foreground">Skjuler fanen “Storformat print”</p>
                        </div>
                        <Switch
                            checked={productsSection.showStorformatTab ?? true}
                            onCheckedChange={(checked) => updateProductsSection({ showStorformatTab: checked })}
                            disabled={!productsSection.enabled}
                        />
                    </div>
                    <div className={cn("space-y-4 border-t pt-4", !productsSection.enabled && "opacity-50")}>
                        <Label className="text-sm font-semibold">Knap design</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Knap type</Label>
                                <Select
                                    value={buttonConfig.style}
                                    onValueChange={(value) => updateButtonConfig({ style: value as ForsideSettings["productsSection"]["button"]["style"] })}
                                    disabled={!productsSection.enabled}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Standard (som nu)</SelectItem>
                                        <SelectItem value="bar">Bund-bjælke</SelectItem>
                                        <SelectItem value="center">Stor centreret</SelectItem>
                                        <SelectItem value="hidden">Skjul knap</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Animation</Label>
                                <Select
                                    value={buttonConfig.animation}
                                    onValueChange={(value) => updateButtonConfig({ animation: value as ForsideSettings["productsSection"]["button"]["animation"] })}
                                    disabled={!productsSection.enabled}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Ingen</SelectItem>
                                        <SelectItem value="lift">Løft</SelectItem>
                                        <SelectItem value="glow">Glow</SelectItem>
                                        <SelectItem value="pulse">Pulse</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <FontSelector
                            label="Knap skrifttype"
                            value={buttonConfig.font}
                            onChange={(value) => updateButtonConfig({ font: value })}
                            description="Vælger font for knapteksten"
                        />
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <ColorPickerWithSwatches
                                label="Knap farve"
                                value={buttonConfig.bgColor}
                                onChange={(value) => updateButtonConfig({ bgColor: value })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <ColorPickerWithSwatches
                                label="Hover farve"
                                value={buttonConfig.hoverBgColor}
                                onChange={(value) => updateButtonConfig({ hoverBgColor: value })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <ColorPickerWithSwatches
                                label="Tekst farve"
                                value={buttonConfig.textColor}
                                onChange={(value) => updateButtonConfig({ textColor: value })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        </div>
                    </div>
                    <div className={cn("space-y-3 border-t pt-4", !productsSection.enabled && "opacity-50")}>
                        <Label className="text-sm font-semibold">Hover tekst</Label>
                        <ColorPickerWithSwatches
                            label="Hover tekstfarve"
                            value={buttonConfig.hoverTextColor}
                            onChange={(value) => updateButtonConfig({ hoverTextColor: value })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>
                    <div className={cn("space-y-3 border-t pt-4", !productsSection.enabled && "opacity-50")}>
                        <Label className="text-sm font-semibold">Produkt-baggrund</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Baggrundstype</Label>
                                <Select
                                    value={backgroundConfig.type}
                                    onValueChange={(value) => updateBackgroundConfig({ type: value as ForsideSettings["productsSection"]["background"]["type"] })}
                                    disabled={!productsSection.enabled}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="solid">Farve</SelectItem>
                                        <SelectItem value="gradient">Gradient</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Opacitet</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(backgroundConfig.opacity * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[backgroundConfig.opacity * 100]}
                                    onValueChange={([value]) => updateBackgroundConfig({ opacity: value / 100 })}
                                    min={0}
                                    max={100}
                                    step={5}
                                    className="py-1"
                                />
                            </div>
                        </div>
                        {backgroundConfig.type === 'solid' ? (
                            <ColorPickerWithSwatches
                                label="Baggrundsfarve"
                                value={backgroundConfig.color}
                                onChange={(value) => updateBackgroundConfig({ color: value })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        ) : (
                            <div className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ColorPickerWithSwatches
                                        label="Gradient start"
                                        value={backgroundConfig.gradientStart}
                                        onChange={(value) => updateBackgroundConfig({ gradientStart: value })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Gradient slut"
                                        value={backgroundConfig.gradientEnd}
                                        onChange={(value) => updateBackgroundConfig({ gradientEnd: value })}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Gradient vinkel</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {backgroundConfig.gradientAngle}°
                                        </span>
                                    </div>
                                    <Slider
                                        value={[backgroundConfig.gradientAngle]}
                                        onValueChange={([value]) => updateBackgroundConfig({ gradientAngle: value })}
                                        min={0}
                                        max={360}
                                        step={5}
                                        className="py-1"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleCard>

            {/* Content Blocks */}
            <CollapsibleCard
                title="Indholdsblokke"
                description="Tilføj sektioner med billede og tekst (maks 4)"
                icon={<Layout className="h-4 w-4" />}
                defaultOpen={false}
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
                                    <div className="flex items-center justify-between gap-4">
                                        <Label>Overskrift (H2)</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-56">
                                                <FontSelector
                                                    label=""
                                                    value={block.headingFont || 'Poppins'}
                                                    onChange={(v) => updateBlock(block.id, { headingFont: v })}
                                                />
                                            </div>
                                            <ColorPickerWithSwatches
                                                label=""
                                                value={block.headingColor || '#1F2937'}
                                                onChange={(color) => updateBlock(block.id, { headingColor: color })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                        </div>
                                    </div>
                                    <Input
                                        placeholder="Indtast overskrift..."
                                        value={block.heading || ''}
                                        onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                                        disabled={!block.enabled}
                                    />
                                </div>

                                {/* Text */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-4">
                                        <Label>Tekst</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-56">
                                                <FontSelector
                                                    label=""
                                                    value={block.textFont || 'Inter'}
                                                    onChange={(v) => updateBlock(block.id, { textFont: v })}
                                                />
                                            </div>
                                            <ColorPickerWithSwatches
                                                label=""
                                                value={block.textColor || '#4B5563'}
                                                onChange={(color) => updateBlock(block.id, { textColor: color })}
                                                savedSwatches={savedSwatches}
                                                onSaveSwatch={onSaveSwatch}
                                                onRemoveSwatch={onRemoveSwatch}
                                            />
                                        </div>
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
