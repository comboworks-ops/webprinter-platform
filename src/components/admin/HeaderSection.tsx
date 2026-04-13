/**
 * Header Branding Section
 * 
 * Shared UI section for configuring header styling, navigation, CTA, and scroll behaviors.
 * Used by both Master and Tenant branding editors.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { cn } from "@/lib/utils";
import { FontSelector } from "./FontSelector";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
    type HeaderSettings,
    type HeaderDropdownMode,
    type HeaderNavItem,
    type HeaderStyleType,
    type HeaderHeightType,
    type HeaderAlignmentType,
    DEFAULT_HEADER,
} from "@/lib/branding";
import {
    StickyNote,
    EyeOff,
    Minimize2,
    Layers,
    Image as ImageIcon,
    Type,
    Info,
    Plus,
    Trash2,
    GripVertical,
    Eye,
    Link as LinkIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    MousePointer2,
    ArrowRight,
    ArrowDown,
} from "lucide-react";

interface HeaderSectionProps {
    header: HeaderSettings;
    onChange: (header: HeaderSettings) => void;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
    focusTargetId?: string | null;
}

export function HeaderSection({ header, onChange, savedSwatches, onSaveSwatch, onRemoveSwatch, focusTargetId }: HeaderSectionProps) {
    // Upload state for dropdown image
    const [uploadingDropdownImage, setUploadingDropdownImage] = useState(false);

    // Upload function for dropdown image
    const uploadDropdownImage = useCallback(async (file: File): Promise<string | null> => {
        setUploadingDropdownImage(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `header-dropdown-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file, { 
                    cacheControl: '3600',
                    upsert: false 
                });
            
            if (uploadError) {
                console.error('Dropdown image upload error:', uploadError);
                toast.error('Kunne ikke uploade billede');
                return null;
            }
            
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
            
            toast.success('Billede uploadet');
            return publicUrl;
        } catch (error) {
            console.error('Error uploading dropdown image:', error);
            toast.error('Fejl ved upload');
            return null;
        } finally {
            setUploadingDropdownImage(false);
        }
    }, []);

    // Ensure header has all required fields
    const safeHeader: HeaderSettings = {
        ...DEFAULT_HEADER,
        ...header,
        scroll: { ...DEFAULT_HEADER.scroll, ...header?.scroll },
        cta: { ...DEFAULT_HEADER.cta, ...header?.cta },
        navItems: header?.navItems || DEFAULT_HEADER.navItems,
    };

    const updateHeader = (partial: Partial<HeaderSettings>) => {
        onChange({ ...safeHeader, ...partial });
    };

    const updateScroll = (partial: Partial<HeaderSettings['scroll']>) => {
        onChange({
            ...safeHeader,
            scroll: { ...safeHeader.scroll, ...partial },
        });
    };

    const updateCta = (partial: Partial<HeaderSettings['cta']>) => {
        onChange({
            ...safeHeader,
            cta: { ...safeHeader.cta, ...partial },
        });
    };

    // Navigation items management
    const addNavItem = () => {
        const newItem: HeaderNavItem = {
            id: `nav_${Date.now()}`,
            label: 'Ny side',
            href: '/',
            isVisible: true,
            order: safeHeader.navItems.length,
        };
        updateHeader({ navItems: [...safeHeader.navItems, newItem] });
    };

    const updateNavItem = (id: string, data: Partial<HeaderNavItem>) => {
        const newItems = safeHeader.navItems.map(item =>
            item.id === id ? { ...item, ...data } : item
        );
        updateHeader({ navItems: newItems });
    };

    // Upload image for a specific nav item
    const uploadNavItemImage = useCallback(async (itemId: string, file: File) => {
        const publicUrl = await uploadDropdownImage(file);
        if (publicUrl) {
            updateNavItem(itemId, { imageUrl: publicUrl });
        }
    }, [uploadDropdownImage]);

    const removeNavItem = (id: string) => {
        updateHeader({ navItems: safeHeader.navItems.filter(item => item.id !== id) });
    };

    // Convert hex + opacity to rgba for display
    const getBgColorWithOpacity = () => {
        const hex = safeHeader.bgColor;
        const opacity = safeHeader.bgOpacity;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const isHeaderFocusMode = Boolean(focusTargetId?.startsWith("site-design-focus-header"));
    const matchesFocus = (...targetIds: string[]) => Boolean(focusTargetId && targetIds.includes(focusTargetId));
    const shouldShowCard = (...targetIds: string[]) => !isHeaderFocusMode || matchesFocus(...targetIds);
    const focusCardClass = (...targetIds: string[]) => cn(
        "rounded-xl transition-all duration-200",
        matchesFocus(...targetIds) && "ring-2 ring-primary/50 ring-offset-2"
    );
    const dropdownCategoryFontSizePx = safeHeader.dropdownCategoryFontSizePx ?? 13;
    const dropdownProductFontSizePx = safeHeader.dropdownProductFontSizePx ?? 14;
    const dropdownMetaFontSizePx = safeHeader.dropdownMetaFontSizePx ?? 11;
    const dropdownRadiusPx = safeHeader.dropdownBorderRadiusPx ?? 18;
    const dropdownImageRadiusPx = safeHeader.dropdownImageRadiusPx ?? 10;
    const dropdownBgOpacity = safeHeader.dropdownBgOpacity ?? 0.95;
    const menuFontSizePx = safeHeader.menuFontSizePx ?? 14;

    return (
        <div className="space-y-4">
            {shouldShowCard("site-design-focus-header-nav") && (
                <div id="site-design-focus-header-nav" className={focusCardClass("site-design-focus-header-nav")}>
                    <CollapsibleCard
                        key={`header-nav-${matchesFocus("site-design-focus-header-nav") ? focusTargetId : "default"}`}
                        title="Navigation"
                        description="Tilføj, skjul og omdøb menupunkter."
                        icon={<LinkIcon className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-nav")}
                    >
                        <div className="space-y-3">
                            {safeHeader.navItems.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                                    <div className="mt-2 cursor-grab text-muted-foreground">
                                        <GripVertical className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                value={item.label}
                                                onChange={(e) => updateNavItem(item.id, { label: e.target.value })}
                                                placeholder="Label"
                                            />
                                            <Input
                                                value={item.href}
                                                onChange={(e) => updateNavItem(item.id, { href: e.target.value })}
                                                placeholder="/side"
                                            />
                                        </div>
                                        {/* Nav Item Image */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                {item.imageUrl ? (
                                                    <div className="relative w-10 h-10 rounded border overflow-hidden flex-shrink-0">
                                                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => updateNavItem(item.id, { imageUrl: null })}
                                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ) : null}
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    disabled={uploadingDropdownImage}
                                                    className="text-xs h-8"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        const input = e.currentTarget;
                                                        if (file) {
                                                            await uploadNavItemImage(item.id, file);
                                                            input.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                            {/* Display Mode Toggle */}
                                            {item.imageUrl && (
                                                <>
                                                    <div className="flex flex-wrap gap-1">
                                                        <Button
                                                            type="button"
                                                            variant={!item.displayMode || item.displayMode === 'text_only' ? 'default' : 'outline'}
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => updateNavItem(item.id, { displayMode: 'text_only' })}
                                                        >
                                                            Kun tekst
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={item.displayMode === 'image_only' ? 'default' : 'outline'}
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => updateNavItem(item.id, { displayMode: 'image_only' })}
                                                        >
                                                            Kun billede
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={item.displayMode === 'image_and_text' ? 'default' : 'outline'}
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => updateNavItem(item.id, { displayMode: 'image_and_text' })}
                                                        >
                                                            Begge
                                                        </Button>
                                                    </div>
                                                    {/* Image Size Slider */}
                                                    {(item.displayMode === 'image_only' || item.displayMode === 'image_and_text') && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-xs">Billedstørrelse</Label>
                                                                <span className="text-xs text-muted-foreground">{item.imageSizePx || 40}px</span>
                                                            </div>
                                                            <Slider
                                                                value={[item.imageSizePx || 40]}
                                                                onValueChange={([value]) => updateNavItem(item.id, { imageSizePx: value })}
                                                                min={20}
                                                                max={200}
                                                                step={5}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => updateNavItem(item.id, { isVisible: !item.isVisible })}
                                        className="h-8 w-8"
                                    >
                                        {item.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => removeNavItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}

                            <Button variant="outline" className="w-full" onClick={addNavItem}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tilføj menupunkt
                            </Button>
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-menu-typography") && (
                <div id="site-design-focus-header-menu-typography" className={focusCardClass("site-design-focus-header-menu-typography")}>
                    <CollapsibleCard
                        key={`header-menu-type-${matchesFocus("site-design-focus-header-menu-typography") ? focusTargetId : "default"}`}
                        title="Menu typografi"
                        description="Skrifttype, størrelse og tekstfarver for menuen."
                        icon={<Type className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-menu-typography")}
                    >
                        <div className="space-y-4">
                            <FontSelector
                                label="Menu skrifttype"
                                value={safeHeader.fontId}
                                onChange={(value) => updateHeader({ fontId: value })}
                            />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Tekststørrelse</Label>
                                    <span className="text-xs text-muted-foreground">{menuFontSizePx}px</span>
                                </div>
                                <Slider
                                    value={[menuFontSizePx]}
                                    onValueChange={([value]) => updateHeader({ menuFontSizePx: value })}
                                    min={12}
                                    max={22}
                                    step={1}
                                />
                            </div>
                            <ColorPickerWithSwatches
                                label="Skriftfarve"
                                value={safeHeader.textColor || "#1F2937"}
                                onChange={(color) => updateHeader({ textColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <ColorPickerWithSwatches
                                label="Hover farve"
                                value={safeHeader.hoverTextColor || "#0EA5E9"}
                                onChange={(color) => updateHeader({ hoverTextColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <ColorPickerWithSwatches
                                label="Valgt menu farve"
                                value={safeHeader.activeTextColor || "#0284C7"}
                                onChange={(color) => updateHeader({ activeTextColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-layout") && (
                <div id="site-design-focus-header-layout" className={focusCardClass("site-design-focus-header-layout")}>
                    <CollapsibleCard
                        key={`header-layout-${matchesFocus("site-design-focus-header-layout") ? focusTargetId : "default"}`}
                        title="Menu layout"
                        description="Placering, højde og overlay-adfærd."
                        icon={<Layers className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-layout")}
                    >
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label>Header højde</Label>
                                <RadioGroup
                                    value={safeHeader.height}
                                    onValueChange={(v) => updateHeader({ height: v as HeaderHeightType })}
                                    className="grid grid-cols-3 gap-4"
                                >
                                    <div className="relative">
                                        <RadioGroupItem value="sm" id="height-sm" className="peer sr-only" />
                                        <label htmlFor="height-sm" className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                            <div className="h-4 w-full rounded bg-muted" />
                                            <span className="text-xs">Lille</span>
                                        </label>
                                    </div>
                                    <div className="relative">
                                        <RadioGroupItem value="md" id="height-md" className="peer sr-only" />
                                        <label htmlFor="height-md" className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                            <div className="h-6 w-full rounded bg-muted" />
                                            <span className="text-xs">Medium</span>
                                        </label>
                                    </div>
                                    <div className="relative">
                                        <RadioGroupItem value="lg" id="height-lg" className="peer sr-only" />
                                        <label htmlFor="height-lg" className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                            <div className="h-8 w-full rounded bg-muted" />
                                            <span className="text-xs">Stor</span>
                                        </label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <Label>Menu placering</Label>
                                <RadioGroup
                                    value={safeHeader.alignment}
                                    onValueChange={(v) => updateHeader({ alignment: v as HeaderAlignmentType })}
                                    className="grid grid-cols-3 gap-4"
                                >
                                    <div className="relative">
                                        <RadioGroupItem value="left" id="align-left" className="peer sr-only" />
                                        <label htmlFor="align-left" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                            <AlignLeft className="h-5 w-5" />
                                            <span className="text-xs">Venstre</span>
                                        </label>
                                    </div>
                                    <div className="relative">
                                        <RadioGroupItem value="center" id="align-center" className="peer sr-only" />
                                        <label htmlFor="align-center" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                            <AlignCenter className="h-5 w-5" />
                                            <span className="text-xs">Center</span>
                                        </label>
                                    </div>
                                    <div className="relative">
                                        <RadioGroupItem value="right" id="align-right" className="peer sr-only" />
                                        <label htmlFor="align-right" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                            <AlignRight className="h-5 w-5" />
                                            <span className="text-xs">Højre</span>
                                        </label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Transparent over hero</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Headeren lægger sig oven på banneret på forsiden.
                                    </p>
                                </div>
                                <Switch
                                    checked={safeHeader.transparentOverHero}
                                    onCheckedChange={(value) => updateHeader({ transparentOverHero: value })}
                                />
                            </div>
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-background", "site-design-focus-header-appearance") && (
                <div id="site-design-focus-header-background" className={focusCardClass("site-design-focus-header-background", "site-design-focus-header-appearance")}>
                    <CollapsibleCard
                        key={`header-background-${matchesFocus("site-design-focus-header-background", "site-design-focus-header-appearance") ? focusTargetId : "default"}`}
                        title="Header baggrund"
                        description="Baggrundsfarve, opacitet og kontrast."
                        icon={<Layers className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-background", "site-design-focus-header-appearance")}
                    >
                        <div className="space-y-4">
                            <ColorPickerWithSwatches
                                label="Baggrundsfarve"
                                value={safeHeader.bgColor}
                                onChange={(color) => updateHeader({ bgColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Gennemsigtighed</Label>
                                    <span className="text-sm text-muted-foreground">{Math.round(safeHeader.bgOpacity * 100)}%</span>
                                </div>
                                <Slider
                                    value={[safeHeader.bgOpacity]}
                                    onValueChange={([value]) => updateHeader({ bgOpacity: value })}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                />
                                <div className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium" style={{ backgroundColor: getBgColorWithOpacity() }}>
                                    Preview
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Auto-kontrast tekst</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Bruger automatisk kontrast. Slå fra hvis du vil styre tekstfarver manuelt i “Menu typografi”.
                                    </p>
                                </div>
                                <Switch
                                    checked={safeHeader.autoContrastText ?? true}
                                    onCheckedChange={(value) => updateHeader({ autoContrastText: value })}
                                />
                            </div>
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-actions") && (
                <div id="site-design-focus-header-actions" className={focusCardClass("site-design-focus-header-actions")}>
                    <CollapsibleCard
                        title="Header elementer"
                        description="Hover-effekter på søgning, sprog og konto-ikoner."
                        icon={<MousePointer2 className="h-4 w-4" />}
                    >
                        <div className="space-y-4">
                            <ColorPickerWithSwatches
                                label="Hover baggrund"
                                value={safeHeader.actionHoverBgColor || "rgba(0,0,0,0.05)"}
                                onChange={(color) => updateHeader({ actionHoverBgColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <ColorPickerWithSwatches
                                label="Hover tekstfarve"
                                value={safeHeader.actionHoverTextColor || "#0EA5E9"}
                                onChange={(color) => updateHeader({ actionHoverTextColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-cta") && (
                <div id="site-design-focus-header-cta" className={focusCardClass("site-design-focus-header-cta")}>
                    <CollapsibleCard
                        key={`header-cta-${matchesFocus("site-design-focus-header-cta") ? focusTargetId : "default"}`}
                        title="CTA knap"
                        description="Call-to-action i højre side af headeren."
                        icon={<MousePointer2 className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-cta")}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Vis CTA knap</Label>
                                <Switch
                                    checked={safeHeader.cta.enabled}
                                    onCheckedChange={(value) => updateCta({ enabled: value })}
                                />
                            </div>

                            {safeHeader.cta.enabled && (
                                <>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Knap tekst</Label>
                                            <Input
                                                value={safeHeader.cta.label}
                                                onChange={(e) => updateCta({ label: e.target.value })}
                                                placeholder="Kontakt os"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Link URL</Label>
                                            <Input
                                                value={safeHeader.cta.href}
                                                onChange={(e) => updateCta({ href: e.target.value })}
                                                placeholder="/kontakt"
                                            />
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <ColorPickerWithSwatches
                                            label="Knap baggrund"
                                            value={safeHeader.cta.bgColor || "#0EA5E9"}
                                            onChange={(color) => updateCta({ bgColor: color })}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Knap tekst"
                                            value={safeHeader.cta.textColor || "#FFFFFF"}
                                            onChange={(color) => updateCta({ textColor: color })}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Knap hover"
                                            value={safeHeader.cta.hoverBgColor || "#0284C7"}
                                            onChange={(color) => updateCta({ hoverBgColor: color })}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-dropdown-layout") && (
                <div id="site-design-focus-header-dropdown-layout" className={focusCardClass("site-design-focus-header-dropdown-layout")}>
                    <CollapsibleCard
                        key={`header-dropdown-layout-${matchesFocus("site-design-focus-header-dropdown-layout") ? focusTargetId : "default"}`}
                        title="Dropdown layout"
                        description="Vælg hvordan produkter vises i dropdown-menuen."
                        icon={<ImageIcon className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-dropdown-layout")}
                    >
                        <RadioGroup
                            value={safeHeader.dropdownMode}
                            onValueChange={(value) => updateHeader({ dropdownMode: value as HeaderDropdownMode })}
                            className="grid grid-cols-3 gap-4"
                        >
                            <div className="relative">
                                <RadioGroupItem value="TEXT_ONLY" id="dropdown-text" className="peer sr-only" />
                                <label htmlFor="dropdown-text" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                    <Type className="h-8 w-8" />
                                    <span className="font-medium">Tekst</span>
                                    <span className="text-center text-xs text-muted-foreground">Kun produktnavne</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="IMAGE_ONLY" id="dropdown-images" className="peer sr-only" />
                                <label htmlFor="dropdown-images" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                    <ImageIcon className="h-8 w-8" />
                                    <span className="font-medium">Billeder</span>
                                    <span className="text-center text-xs text-muted-foreground">Kun produktbilleder</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="IMAGE_AND_TEXT" id="dropdown-both" className="peer sr-only" />
                                <label htmlFor="dropdown-both" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50">
                                    <div className="flex gap-1">
                                        <ImageIcon className="h-6 w-6" />
                                        <Type className="h-6 w-6" />
                                    </div>
                                    <span className="font-medium">Begge</span>
                                    <span className="text-center text-xs text-muted-foreground">Billeder og tekst</span>
                                </label>
                            </div>
                        </RadioGroup>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-dropdown-media", "site-design-focus-header-dropdown-images") && (
                <div id="site-design-focus-header-dropdown-media" className={focusCardClass("site-design-focus-header-dropdown-media", "site-design-focus-header-dropdown-images")}>
                    <CollapsibleCard
                        key={`header-dropdown-media-${matchesFocus("site-design-focus-header-dropdown-media", "site-design-focus-header-dropdown-images") ? focusTargetId : "default"}`}
                        title="Dropdown billeder"
                        description="Styr størrelse og form på billederne i dropdown-menuen."
                        icon={<ImageIcon className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-dropdown-media", "site-design-focus-header-dropdown-images")}
                    >
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Stor dropdown-billede</Label>
                                    <span className="text-xs text-muted-foreground">{safeHeader.dropdownImageSizePx ?? 56}px</span>
                                </div>
                                <Slider
                                    value={[safeHeader.dropdownImageSizePx ?? 56]}
                                    onValueChange={([value]) => updateHeader({ dropdownImageSizePx: value })}
                                    min={32}
                                    max={120}
                                    step={2}
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Kompakt preview-billede</Label>
                                    <span className="text-xs text-muted-foreground">{safeHeader.dropdownCompactImageSizePx ?? 40}px</span>
                                </div>
                                <Slider
                                    value={[safeHeader.dropdownCompactImageSizePx ?? 40]}
                                    onValueChange={([value]) => updateHeader({ dropdownCompactImageSizePx: value })}
                                    min={24}
                                    max={96}
                                    step={2}
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Billede hjørner</Label>
                                    <span className="text-xs text-muted-foreground">{dropdownImageRadiusPx}px</span>
                                </div>
                                <Slider
                                    value={[dropdownImageRadiusPx]}
                                    onValueChange={([value]) => updateHeader({ dropdownImageRadiusPx: value })}
                                    min={0}
                                    max={32}
                                    step={1}
                                />
                            </div>
                            <div className="space-y-3 pt-2 border-t">
                                <Label>Tekst position</Label>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant={safeHeader.dropdownTextPosition === 'side' ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => updateHeader({ dropdownTextPosition: 'side' })}
                                    >
                                        <ArrowRight className="h-4 w-4 mr-1" />
                                        Ved siden af
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={safeHeader.dropdownTextPosition === 'below' || !safeHeader.dropdownTextPosition ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => updateHeader({ dropdownTextPosition: 'below' })}
                                    >
                                        <ArrowDown className="h-4 w-4 mr-1" />
                                        Under billedet
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Placer teksten ved siden af eller under produktbilledet
                                </p>
                            </div>
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-dropdown-panel", "site-design-focus-header-dropdown-colors") && (
                <div id="site-design-focus-header-dropdown-panel" className={focusCardClass("site-design-focus-header-dropdown-panel", "site-design-focus-header-dropdown-colors")}>
                    <CollapsibleCard
                        key={`header-dropdown-panel-${matchesFocus("site-design-focus-header-dropdown-panel", "site-design-focus-header-dropdown-colors") ? focusTargetId : "default"}`}
                        title="Dropdown panel"
                        description="Baggrund, hover, afrundede hjørner og ramme."
                        icon={<Layers className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-dropdown-panel", "site-design-focus-header-dropdown-colors")}
                    >
                        <div className="space-y-4">
                            <ColorPickerWithSwatches
                                label="Baggrundsfarve"
                                value={safeHeader.dropdownBgColor || "#FFFFFF"}
                                onChange={(color) => updateHeader({ dropdownBgColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Transparens</Label>
                                    <span className="text-xs text-muted-foreground">{Math.round(dropdownBgOpacity * 100)}%</span>
                                </div>
                                <Slider
                                    value={[Math.round(dropdownBgOpacity * 100)]}
                                    onValueChange={([value]) => updateHeader({ dropdownBgOpacity: value / 100 })}
                                    min={0}
                                    max={100}
                                    step={1}
                                />
                            </div>
                            <ColorPickerWithSwatches
                                label="Hover farve"
                                value={safeHeader.dropdownHoverColor || "#F3F4F6"}
                                onChange={(color) => updateHeader({ dropdownHoverColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Afrundede hjørner</Label>
                                    <span className="text-xs text-muted-foreground">{dropdownRadiusPx}px</span>
                                </div>
                                <Slider
                                    value={[dropdownRadiusPx]}
                                    onValueChange={([value]) => updateHeader({ dropdownBorderRadiusPx: value })}
                                    min={0}
                                    max={40}
                                    step={1}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Vis ramme og skygge</Label>
                                    <p className="text-xs text-muted-foreground">Tilføj kant og skygge omkring dropdown-menuen.</p>
                                </div>
                                <Switch
                                    checked={safeHeader.dropdownShowBorder ?? true}
                                    onCheckedChange={(value) => updateHeader({ dropdownShowBorder: value })}
                                />
                            </div>
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-dropdown-category") && (
                <div id="site-design-focus-header-dropdown-category" className={focusCardClass("site-design-focus-header-dropdown-category")}>
                    <CollapsibleCard
                        key={`header-dropdown-category-${matchesFocus("site-design-focus-header-dropdown-category") ? focusTargetId : "default"}`}
                        title="Dropdown kategorier"
                        description="Typografi for kategorioverskrifter som “Tryksager” og “Storformat”."
                        icon={<Type className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-dropdown-category")}
                    >
                        <div className="space-y-4">
                            <FontSelector
                                label="Kategori skrifttype"
                                value={safeHeader.dropdownCategoryFontId || "Inter"}
                                onChange={(value) => updateHeader({ dropdownCategoryFontId: value })}
                            />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Tekststørrelse</Label>
                                    <span className="text-xs text-muted-foreground">{dropdownCategoryFontSizePx}px</span>
                                </div>
                                <Slider
                                    value={[dropdownCategoryFontSizePx]}
                                    onValueChange={([value]) => updateHeader({ dropdownCategoryFontSizePx: value })}
                                    min={10}
                                    max={24}
                                    step={1}
                                />
                            </div>
                            <ColorPickerWithSwatches
                                label="Kategori farve"
                                value={safeHeader.dropdownCategoryColor || "#6B7280"}
                                onChange={(color) => updateHeader({ dropdownCategoryColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            {/* Category Images Section */}
                            <div className="space-y-3 pt-4 border-t">
                                <Label className="font-medium">Kategori billeder</Label>
                                <p className="text-xs text-muted-foreground">
                                    Upload billeder til at erstatte kategoritekst i dropdown-menuen.
                                </p>
                                
                                {/* Display Mode for Categories */}
                                <div className="flex flex-wrap gap-1">
                                    <Button
                                        type="button"
                                        variant={!safeHeader.dropdownCategoryDisplayMode || safeHeader.dropdownCategoryDisplayMode === 'text' ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => updateHeader({ dropdownCategoryDisplayMode: 'text' })}
                                    >
                                        Kun tekst
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={safeHeader.dropdownCategoryDisplayMode === 'image' ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => updateHeader({ dropdownCategoryDisplayMode: 'image' })}
                                    >
                                        Kun billede
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={safeHeader.dropdownCategoryDisplayMode === 'both' ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => updateHeader({ dropdownCategoryDisplayMode: 'both' })}
                                    >
                                        Begge
                                    </Button>
                                </div>

                                {/* Category Image Uploads */}
                                {(safeHeader.dropdownCategoryDisplayMode === 'image' || safeHeader.dropdownCategoryDisplayMode === 'both') && (
                                    <div className="space-y-3 pt-2">
                                        {[
                                            { key: 'tryksager', label: 'Tryk sager' },
                                            { key: 'storformat', label: 'Stor format' },
                                            { key: 'plakater', label: 'Plakater' },
                                            { key: 'tekstil', label: 'Tekstil tryk' },
                                            { key: 'skilte', label: 'Skilte' },
                                            { key: 'folie', label: 'Folie' },
                                        ].map((cat) => {
                                            const images = safeHeader.dropdownCategoryImages || {};
                                            const imageUrl = images[cat.key];
                                            return (
                                                <div key={cat.key} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                                                    {imageUrl ? (
                                                        <div className="relative w-12 h-8 rounded border overflow-hidden flex-shrink-0">
                                                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newImages = { ...images, [cat.key]: null };
                                                                    updateHeader({ dropdownCategoryImages: newImages });
                                                                }}
                                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                                            >
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-8 rounded border bg-muted flex items-center justify-center flex-shrink-0">
                                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <span className="flex-1 text-sm">{cat.label}</span>
                                                    <Input
                                                        type="file"
                                                        accept="image/*"
                                                        disabled={uploadingDropdownImage}
                                                        className="text-xs h-7 w-28"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            const input = e.currentTarget;
                                                            if (!file) return;
                                                            const publicUrl = await uploadDropdownImage(file);
                                                            if (publicUrl) {
                                                                const newImages = { ...images, [cat.key]: publicUrl };
                                                                updateHeader({ dropdownCategoryImages: newImages });
                                                            }
                                                            input.value = '';
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {shouldShowCard("site-design-focus-header-dropdown-product") && (
                <div id="site-design-focus-header-dropdown-product" className={focusCardClass("site-design-focus-header-dropdown-product")}>
                    <CollapsibleCard
                        key={`header-dropdown-product-${matchesFocus("site-design-focus-header-dropdown-product") ? focusTargetId : "default"}`}
                        title="Dropdown produkter"
                        description="Typografi og farver for produktnavne og den sekundære tekstlinje."
                        icon={<Type className="h-4 w-4" />}
                        defaultOpen={matchesFocus("site-design-focus-header-dropdown-product")}
                    >
                        <div className="space-y-4">
                            <FontSelector
                                label="Produkt skrifttype"
                                value={safeHeader.dropdownProductFontId || "Inter"}
                                onChange={(value) => updateHeader({ dropdownProductFontId: value })}
                            />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Produkt tekststørrelse</Label>
                                    <span className="text-xs text-muted-foreground">{dropdownProductFontSizePx}px</span>
                                </div>
                                <Slider
                                    value={[dropdownProductFontSizePx]}
                                    onValueChange={([value]) => updateHeader({ dropdownProductFontSizePx: value })}
                                    min={11}
                                    max={22}
                                    step={1}
                                />
                            </div>
                            <ColorPickerWithSwatches
                                label="Produkt farve"
                                value={safeHeader.dropdownProductColor || "#1F2937"}
                                onChange={(color) => updateHeader({ dropdownProductColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                            <Separator />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Sekundær tekststørrelse</Label>
                                    <span className="text-xs text-muted-foreground">{dropdownMetaFontSizePx}px</span>
                                </div>
                                <Slider
                                    value={[dropdownMetaFontSizePx]}
                                    onValueChange={([value]) => updateHeader({ dropdownMetaFontSizePx: value })}
                                    min={10}
                                    max={18}
                                    step={1}
                                />
                            </div>
                            <ColorPickerWithSwatches
                                label="Sekundær tekstfarve"
                                value={safeHeader.dropdownMetaColor || "#6B7280"}
                                onChange={(color) => updateHeader({ dropdownMetaColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        </div>
                    </CollapsibleCard>
                </div>
            )}

            {!isHeaderFocusMode && (
                <CollapsibleCard
                    title="Scroll-adfærd"
                    description="Konfigurér hvordan headeren opfører sig ved scroll."
                    icon={<StickyNote className="h-4 w-4" />}
                >
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="flex items-center gap-2">
                                    <StickyNote className="h-4 w-4" />
                                    Sticky header
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Headeren forbliver fastgjort til toppen ved scroll.
                                </p>
                            </div>
                            <Switch
                                checked={safeHeader.scroll.sticky}
                                onCheckedChange={(value) => updateScroll({ sticky: value })}
                            />
                        </div>
                    </div>
                </CollapsibleCard>
            )}
        </div >
    );
}

export default HeaderSection;
