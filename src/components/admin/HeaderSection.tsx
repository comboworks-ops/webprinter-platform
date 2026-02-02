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
import { FontSelector } from "./FontSelector";
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
} from "lucide-react";

interface HeaderSectionProps {
    header: HeaderSettings;
    onChange: (header: HeaderSettings) => void;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
}

export function HeaderSection({ header, onChange, savedSwatches, onSaveSwatch, onRemoveSwatch }: HeaderSectionProps) {
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

    return (
        <div className="space-y-4">
            {/* Navigation Items */}
            <CollapsibleCard
                title="Navigation"
                description="Tilføj og rediger menupunkter i headeren"
                icon={<LinkIcon className="h-4 w-4" />}
                defaultOpen={false}
            >
                <div className="space-y-3">
                    {safeHeader.navItems.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="cursor-grab text-muted-foreground mt-2">
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
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateNavItem(item.id, { isVisible: !item.isVisible })}
                                className="h-8 w-8"
                            >
                                {item.isVisible ? (
                                    <Eye className="h-4 w-4" />
                                ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
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

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={addNavItem}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Tilføj menupunkt
                    </Button>
                </div>
            </CollapsibleCard>

            {/* CTA Button */}
            <CollapsibleCard
                title="CTA Knap"
                description="Tilføj en call-to-action knap i headeren"
                icon={<MousePointer2 className="h-4 w-4" />}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Vis CTA knap</Label>
                        <Switch
                            checked={safeHeader.cta.enabled}
                            onCheckedChange={(v) => updateCta({ enabled: v })}
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
                                    label="Knap baggrundsfarve"
                                    value={safeHeader.cta.bgColor || '#0EA5E9'}
                                    onChange={(color) => updateCta({ bgColor: color })}
                                    savedSwatches={savedSwatches}
                                    onSaveSwatch={onSaveSwatch}
                                    onRemoveSwatch={onRemoveSwatch}
                                />
                                <ColorPickerWithSwatches
                                    label="Knap tekstfarve"
                                    value={safeHeader.cta.textColor || '#FFFFFF'}
                                    onChange={(color) => updateCta({ textColor: color })}
                                    savedSwatches={savedSwatches}
                                    onSaveSwatch={onSaveSwatch}
                                    onRemoveSwatch={onRemoveSwatch}
                                />
                                <ColorPickerWithSwatches
                                    label="Knap hover farve"
                                    value={safeHeader.cta.hoverBgColor || '#0284C7'}
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

            {/* Header Style */}
            <CollapsibleCard
                title="Udseende"
                description="Konfigurér headerens udseende"
                icon={<Layers className="h-4 w-4" />}
            >
                <div className="space-y-6">
                    {/* Font */}
                    <FontSelector
                        label="Header skrifttype"
                        value={safeHeader.fontId}
                        onChange={(v) => updateHeader({ fontId: v })}
                    />

                    {/* Font Color */}
                    <ColorPickerWithSwatches
                        label="Skriftfarve (menu tekst)"
                        value={safeHeader.textColor || '#1F2937'}
                        onChange={(color) => updateHeader({ textColor: color })}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />

                    {/* Hover Color */}
                    <ColorPickerWithSwatches
                        label="Hover over"
                        value={safeHeader.hoverTextColor || '#0EA5E9'}
                        onChange={(color) => updateHeader({ hoverTextColor: color })}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />

                    {/* Active/Pressed Color */}
                    <ColorPickerWithSwatches
                        label="Menu valgt"
                        value={safeHeader.activeTextColor || '#0284C7'}
                        onChange={(color) => updateHeader({ activeTextColor: color })}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />

                    <Separator />

                    {/* Action Elements Hover Color */}
                    <ColorPickerWithSwatches
                        label="Hover over element"
                        value={safeHeader.actionHoverBgColor || 'rgba(0,0,0,0.05)'}
                        onChange={(color) => updateHeader({ actionHoverBgColor: color })}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />
                    <ColorPickerWithSwatches
                        label="Hover over element tekst"
                        value={safeHeader.actionHoverTextColor || '#0EA5E9'}
                        onChange={(color) => updateHeader({ actionHoverTextColor: color })}
                        savedSwatches={savedSwatches}
                        onSaveSwatch={onSaveSwatch}
                        onRemoveSwatch={onRemoveSwatch}
                    />

                    <Separator />

                    {/* Header Height */}
                    <div className="space-y-3">
                        <Label>Header højde</Label>
                        <RadioGroup
                            value={safeHeader.height}
                            onValueChange={(v) => updateHeader({ height: v as HeaderHeightType })}
                            className="grid grid-cols-3 gap-4"
                        >
                            <div className="relative">
                                <RadioGroupItem value="sm" id="height-sm" className="peer sr-only" />
                                <label
                                    htmlFor="height-sm"
                                    className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <div className="h-4 w-full bg-muted rounded" />
                                    <span className="text-xs">Lille</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="md" id="height-md" className="peer sr-only" />
                                <label
                                    htmlFor="height-md"
                                    className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <div className="h-6 w-full bg-muted rounded" />
                                    <span className="text-xs">Medium</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="lg" id="height-lg" className="peer sr-only" />
                                <label
                                    htmlFor="height-lg"
                                    className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <div className="h-8 w-full bg-muted rounded" />
                                    <span className="text-xs">Stor</span>
                                </label>
                            </div>
                        </RadioGroup>
                    </div>

                    <Separator />

                    {/* Alignment */}
                    <div className="space-y-3">
                        <Label>Menu placering</Label>
                        <RadioGroup
                            value={safeHeader.alignment}
                            onValueChange={(v) => updateHeader({ alignment: v as HeaderAlignmentType })}
                            className="grid grid-cols-3 gap-4"
                        >
                            <div className="relative">
                                <RadioGroupItem value="left" id="align-left" className="peer sr-only" />
                                <label
                                    htmlFor="align-left"
                                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <AlignLeft className="h-5 w-5" />
                                    <span className="text-xs">Venstre</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="center" id="align-center" className="peer sr-only" />
                                <label
                                    htmlFor="align-center"
                                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <AlignCenter className="h-5 w-5" />
                                    <span className="text-xs">Center</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="right" id="align-right" className="peer sr-only" />
                                <label
                                    htmlFor="align-right"
                                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <AlignRight className="h-5 w-5" />
                                    <span className="text-xs">Højre</span>
                                </label>
                            </div>
                        </RadioGroup>
                    </div>

                    <Separator />

                    {/* Background Color */}
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
                                <span className="text-sm text-muted-foreground">
                                    {Math.round(safeHeader.bgOpacity * 100)}%
                                </span>
                            </div>
                            <Slider
                                value={[safeHeader.bgOpacity]}
                                onValueChange={([v]) => updateHeader({ bgOpacity: v })}
                                min={0}
                                max={1}
                                step={0.05}
                                className="w-full"
                            />
                            <div
                                className="h-12 rounded-lg border flex items-center justify-center text-sm font-medium"
                                style={{ backgroundColor: getBgColorWithOpacity() }}
                            >
                                Preview
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Text Color */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Auto-kontrast tekst</Label>
                                <p className="text-xs text-muted-foreground">
                                    Justér automatisk tekstfarve for bedre læsbarhed
                                </p>
                            </div>
                            <Switch
                                checked={safeHeader.autoContrastText ?? true}
                                onCheckedChange={(v) => updateHeader({ autoContrastText: v })}
                            />
                        </div>

                        {!(safeHeader.autoContrastText ?? true) && (
                            <ColorPickerWithSwatches
                                label="Tekstfarve"
                                value={safeHeader.textColor || '#1F2937'}
                                onChange={(color) => updateHeader({ textColor: color })}
                                savedSwatches={savedSwatches}
                                onSaveSwatch={onSaveSwatch}
                                onRemoveSwatch={onRemoveSwatch}
                            />
                        )}
                    </div>

                    <Separator />

                    {/* Transparent over hero */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Transparent over hero</Label>
                            <p className="text-xs text-muted-foreground">
                                Headeren er gennemsigtig over hero-banneret på forsiden
                            </p>
                        </div>
                        <Switch
                            checked={safeHeader.transparentOverHero}
                            onCheckedChange={(v) => updateHeader({ transparentOverHero: v })}
                        />
                    </div>
                </div>
            </CollapsibleCard>

            {/* Dropdown Content Mode */}
            <CollapsibleCard
                title="Dropdown Indhold"
                description="Vælg hvordan produkter vises i dropdown-menuen"
                icon={<ImageIcon className="h-4 w-4" />}
            >
                <div className="space-y-6">
                    <RadioGroup
                        value={safeHeader.dropdownMode}
                        onValueChange={(v) => updateHeader({ dropdownMode: v as HeaderDropdownMode })}
                        className="grid grid-cols-3 gap-4"
                    >
                        <div className="relative">
                            <RadioGroupItem value="TEXT_ONLY" id="dropdown-text" className="peer sr-only" />
                            <label
                                htmlFor="dropdown-text"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                            >
                                <Type className="h-8 w-8" />
                                <span className="font-medium">Tekst</span>
                                <span className="text-xs text-muted-foreground text-center">
                                    Kun produktnavne
                                </span>
                            </label>
                        </div>

                        <div className="relative">
                            <RadioGroupItem value="IMAGE_ONLY" id="dropdown-images" className="peer sr-only" />
                            <label
                                htmlFor="dropdown-images"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                            >
                                <ImageIcon className="h-8 w-8" />
                                <span className="font-medium">Billeder</span>
                                <span className="text-xs text-muted-foreground text-center">
                                    Kun produktbilleder
                                </span>
                            </label>
                        </div>

                        <div className="relative">
                            <RadioGroupItem value="IMAGE_AND_TEXT" id="dropdown-both" className="peer sr-only" />
                            <label
                                htmlFor="dropdown-both"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                            >
                                <div className="flex gap-1">
                                    <ImageIcon className="h-6 w-6" />
                                    <Type className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Begge</span>
                                <span className="text-xs text-muted-foreground text-center">
                                    Billeder og tekst
                                </span>
                            </label>
                        </div>
                    </RadioGroup>

                    <Separator />

                    <div className="space-y-4">
                        <ColorPickerWithSwatches
                            label="Dropdown Baggrundsfarve"
                            value={safeHeader.dropdownBgColor || '#FFFFFF'}
                            onChange={(color) => updateHeader({ dropdownBgColor: color })}
                            showOpacity
                            opacity={safeHeader.dropdownBgOpacity ?? 0.95}
                            onOpacityChange={(opacity) => updateHeader({ dropdownBgOpacity: opacity })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                        <ColorPickerWithSwatches
                            label="Dropdown Hover Farve"
                            value={safeHeader.dropdownHoverColor || '#F3F4F6'}
                            onChange={(color) => updateHeader({ dropdownHoverColor: color })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>

                    <Separator />

                    {/* Dropdown Border Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Vis ramme og skygge</Label>
                            <p className="text-xs text-muted-foreground">
                                Tilføj ramme og skygge omkring dropdown-menuen
                            </p>
                        </div>
                        <Switch
                            checked={safeHeader.dropdownShowBorder ?? true}
                            onCheckedChange={(v) => updateHeader({ dropdownShowBorder: v })}
                        />
                    </div>

                    <Separator />

                    {/* Category Headers */}
                    <div className="space-y-3 pt-2">
                        <Label className="text-sm font-medium">Kategori-overskrifter</Label>
                        <p className="text-xs text-muted-foreground -mt-2">
                            Styling for "Tryksager", "Storformat", osv.
                        </p>
                        <FontSelector
                            label="Kategori skrifttype"
                            value={safeHeader.dropdownCategoryFontId || 'Inter'}
                            onChange={(v) => updateHeader({ dropdownCategoryFontId: v })}
                        />
                        <ColorPickerWithSwatches
                            label="Kategori farve"
                            value={safeHeader.dropdownCategoryColor || '#6B7280'}
                            onChange={(color) => updateHeader({ dropdownCategoryColor: color })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>

                    <Separator />

                    {/* Product Names */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Produktnavne</Label>
                        <p className="text-xs text-muted-foreground -mt-2">
                            Styling for produktnavne i dropdown
                        </p>
                        <FontSelector
                            label="Produkt skrifttype"
                            value={safeHeader.dropdownProductFontId || 'Inter'}
                            onChange={(v) => updateHeader({ dropdownProductFontId: v })}
                        />
                        <ColorPickerWithSwatches
                            label="Produkt farve"
                            value={safeHeader.dropdownProductColor || '#1F2937'}
                            onChange={(color) => updateHeader({ dropdownProductColor: color })}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>
                </div>
            </CollapsibleCard>

            {/* Scroll Behaviors */}
            <CollapsibleCard
                title="Scroll-adfærd"
                description="Konfigurér hvordan headeren opfører sig ved scroll"
                icon={<StickyNote className="h-4 w-4" />}
            >
                <div className="space-y-6">
                    {/* Sticky */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                                <StickyNote className="h-4 w-4" />
                                Sticky header
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Headeren forbliver fastgjort til toppen ved scroll
                            </p>
                        </div>
                        <Switch
                            checked={safeHeader.scroll.sticky}
                            onCheckedChange={(v) => updateScroll({ sticky: v })}
                        />
                    </div>
                </div>
            </CollapsibleCard >
        </div >
    );
}

export default HeaderSection;

