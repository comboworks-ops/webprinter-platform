import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SelectedObjectProps, AVAILABLE_FONTS } from "./EditorCanvas";
import { FONT_CATALOG, FontDefinition } from "./fontCatalog";
import { cn } from "@/lib/utils";
import {
    AlignLeft,
    AlignCenter,
    AlignRight,
    Bold,
    Italic,
    Underline,
    ArrowUp,
    ArrowDown,
    Check,
    ChevronsUpDown,
    Search
} from "lucide-react";

interface PropertiesPanelProps {
    selectedObject: SelectedObjectProps | null;
    onUpdateProps: (props: Partial<SelectedObjectProps>) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
}

export function PropertiesPanel({
    selectedObject,
    onUpdateProps,
    onBringToFront,
    onSendToBack
}: PropertiesPanelProps) {
    const [fontSearchOpen, setFontSearchOpen] = useState(false);

    if (!selectedObject) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                Vælg et objekt for at redigere egenskaber
            </div>
        );
    }

    const isText = selectedObject.type === 'i-text' || selectedObject.type === 'text' || selectedObject.type === 'textbox';
    const isShape = selectedObject.type === 'rect' || selectedObject.type === 'circle' || selectedObject.type === 'line';
    const isRectangle = selectedObject.type === 'rect';
    const isImage = selectedObject.type === 'image';

    // For rectangles: determine if border is enabled (has stroke and strokeWidth > 0)
    const hasBorder = isRectangle && selectedObject.stroke && (selectedObject.strokeWidth || 0) > 0;

    // Calculate max corner radius based on rectangle dimensions
    const maxCornerRadius = isRectangle ? Math.min(selectedObject.width || 100, selectedObject.height || 60) / 2 : 50;

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-semibold text-sm">Egenskaber</h3>

            {/* Position & Size */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label className="text-xs">X</Label>
                    <Input
                        type="number"
                        value={selectedObject.left || 0}
                        className="h-8 text-sm"
                        readOnly
                    />
                </div>
                <div>
                    <Label className="text-xs">Y</Label>
                    <Input
                        type="number"
                        value={selectedObject.top || 0}
                        className="h-8 text-sm"
                        readOnly
                    />
                </div>
                <div>
                    <Label className="text-xs">B</Label>
                    <Input
                        type="number"
                        value={selectedObject.width || 0}
                        className="h-8 text-sm"
                        readOnly
                    />
                </div>
                <div>
                    <Label className="text-xs">H</Label>
                    <Input
                        type="number"
                        value={selectedObject.height || 0}
                        className="h-8 text-sm"
                        readOnly
                    />
                </div>
            </div>

            {/* Opacity */}
            <div>
                <Label className="text-xs">Gennemsigtighed</Label>
                <div className="flex items-center gap-2">
                    <Slider
                        value={[(selectedObject.opacity ?? 1) * 100]}
                        onValueChange={([val]) => onUpdateProps({ opacity: val / 100 })}
                        max={100}
                        step={1}
                        className="flex-1"
                    />
                    <span className="text-xs w-8 text-right">{Math.round((selectedObject.opacity || 1) * 100)}%</span>
                </div>
            </div>

            {/* Blend Mode for Images */}
            {isImage && (
                <div>
                    <Label className="text-xs">Blandingsform</Label>
                    <Select
                        value={selectedObject.blendMode || 'source-over'}
                        onValueChange={(val) => onUpdateProps({ blendMode: val })}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="source-over">Normal</SelectItem>
                            <SelectItem value="multiply">Multiply (Gange)</SelectItem>
                            <SelectItem value="screen">Screen (Lysne)</SelectItem>
                            <SelectItem value="overlay">Overlay</SelectItem>
                            <SelectItem value="soft-light">Soft Light (Blødt lys)</SelectItem>
                            <SelectItem value="hard-light">Hard Light</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Z-Order controls removed as requested (handled in Layers panel) */}


            {/* Fill Color */}
            {(isShape || isText) && (
                <div>
                    <Label className="text-xs">Fyld farve</Label>
                    <div className="flex gap-2 mt-1">
                        <input
                            type="color"
                            value={selectedObject.fill || '#000000'}
                            onChange={(e) => onUpdateProps({ fill: e.target.value })}
                            className="w-10 h-8 rounded border cursor-pointer"
                        />
                        <Input
                            type="text"
                            value={selectedObject.fill || '#000000'}
                            onChange={(e) => onUpdateProps({ fill: e.target.value })}
                            className="h-8 text-sm flex-1"
                            placeholder="#000000"
                        />
                    </div>
                </div>
            )}

            {/* Rect-specific: Corner Radius */}
            {isRectangle && (
                <div className="space-y-2 border-t pt-4">
                    <Label className="text-xs">Hjørneafrunding</Label>
                    <div className="flex items-center gap-2">
                        <Slider
                            value={[selectedObject.rx || 0]}
                            onValueChange={([val]) => onUpdateProps({ rx: val, ry: val })}
                            max={maxCornerRadius}
                            step={1}
                            className="flex-1"
                        />
                        <Input
                            type="number"
                            value={Math.round(selectedObject.rx || 0)}
                            onChange={(e) => {
                                const val = Math.min(maxCornerRadius, Math.max(0, parseInt(e.target.value) || 0));
                                onUpdateProps({ rx: val, ry: val });
                            }}
                            className="h-8 w-12 text-xs px-1"
                        />
                    </div>
                </div>
            )}

            {/* Stroke / Kant */}
            {isShape && (
                <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Kant (Border)</Label>
                        {isRectangle && (
                            <Switch
                                checked={!!(selectedObject.stroke && (selectedObject.strokeWidth || 0) > 0)}
                                onCheckedChange={(enabled) => {
                                    if (enabled) {
                                        onUpdateProps({
                                            stroke: selectedObject.stroke || '#000000',
                                            strokeWidth: (selectedObject.strokeWidth && selectedObject.strokeWidth > 0) ? selectedObject.strokeWidth : 2
                                        });
                                    } else {
                                        onUpdateProps({
                                            stroke: null,
                                            strokeWidth: 0
                                        });
                                    }
                                }}
                            />
                        )}
                    </div>

                    {(!isRectangle || (selectedObject.stroke && (selectedObject.strokeWidth || 0) > 0)) && (
                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs text-muted-foreground">Farve</Label>
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="color"
                                        value={selectedObject.stroke && typeof selectedObject.stroke === 'string' ? selectedObject.stroke : '#000000'}
                                        onChange={(e) => onUpdateProps({ stroke: e.target.value })}
                                        className="w-10 h-8 rounded border cursor-pointer"
                                    />
                                    <Input
                                        type="text"
                                        value={selectedObject.stroke && typeof selectedObject.stroke === 'string' ? selectedObject.stroke : ''}
                                        onChange={(e) => onUpdateProps({ stroke: e.target.value })}
                                        className="h-8 text-sm flex-1"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Tykkelse</Label>
                                <div className="flex items-center gap-2">
                                    <Slider
                                        value={[selectedObject.strokeWidth || 0]}
                                        onValueChange={([val]) => onUpdateProps({ strokeWidth: val })}
                                        max={20}
                                        step={1}
                                        className="flex-1"
                                    />
                                    <Input
                                        type="number"
                                        value={selectedObject.strokeWidth || 0}
                                        onChange={(e) => onUpdateProps({ strokeWidth: parseInt(e.target.value) || 0 })}
                                        className="h-8 w-12 text-xs px-1"
                                        min={0}
                                        max={50}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Shadow Section */}
            <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Skygge (Shadow)</Label>
                    <Switch
                        checked={selectedObject.shadow?.enabled || false}
                        onCheckedChange={(enabled) => {
                            const currentShadow = selectedObject.shadow || {
                                color: '#000000',
                                blur: 8,
                                offsetX: 4,
                                offsetY: 4,
                                opacity: 0.35
                            };
                            onUpdateProps({
                                shadow: { ...currentShadow, enabled }
                            });
                        }}
                    />
                </div>

                {selectedObject.shadow?.enabled && (
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">Farve</Label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="color"
                                    value={selectedObject.shadow.color || '#000000'}
                                    onChange={(e) => onUpdateProps({
                                        shadow: { ...selectedObject.shadow!, color: e.target.value }
                                    })}
                                    className="w-10 h-8 rounded border cursor-pointer"
                                />
                                <Input
                                    type="text"
                                    value={selectedObject.shadow.color || '#000000'}
                                    onChange={(e) => onUpdateProps({
                                        shadow: { ...selectedObject.shadow!, color: e.target.value }
                                    })}
                                    className="h-8 text-sm flex-1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-muted-foreground">Skyggestyrke (Opacity)</Label>
                            <div className="flex items-center gap-2">
                                <Slider
                                    value={[(selectedObject.shadow.opacity || 0) * 100]}
                                    onValueChange={([val]) => onUpdateProps({
                                        shadow: { ...selectedObject.shadow!, opacity: val / 100 }
                                    })}
                                    max={100}
                                    step={1}
                                    className="flex-1"
                                />
                                <span className="text-xs w-8 text-right font-mono">{Math.round((selectedObject.shadow.opacity || 0) * 100)}%</span>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-muted-foreground">Sløring (Blur)</Label>
                            <div className="flex items-center gap-2">
                                <Slider
                                    value={[selectedObject.shadow.blur || 0]}
                                    onValueChange={([val]) => onUpdateProps({
                                        shadow: { ...selectedObject.shadow!, blur: val }
                                    })}
                                    max={50}
                                    step={1}
                                    className="flex-1"
                                />
                                <span className="text-xs w-6 text-right">{selectedObject.shadow.blur || 0}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs text-muted-foreground">Offset X</Label>
                                <Input
                                    type="number"
                                    value={selectedObject.shadow.offsetX || 0}
                                    onChange={(e) => onUpdateProps({
                                        shadow: { ...selectedObject.shadow!, offsetX: parseInt(e.target.value) || 0 }
                                    })}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Offset Y</Label>
                                <Input
                                    type="number"
                                    value={selectedObject.shadow.offsetY || 0}
                                    onChange={(e) => onUpdateProps({
                                        shadow: { ...selectedObject.shadow!, offsetY: parseInt(e.target.value) || 0 }
                                    })}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Text Properties */}
            {isText && (
                <>
                    <div className="border-t pt-4">
                        <Label className="text-xs font-medium">Tekst</Label>
                    </div>

                    {/* Font Family (Searchable) */}
                    <div>
                        <Label className="text-xs">Skrifttype</Label>
                        <Popover open={fontSearchOpen} onOpenChange={setFontSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={fontSearchOpen}
                                    className="w-full justify-between h-8 text-sm px-2 font-normal"
                                >
                                    <span className="truncate">
                                        {selectedObject.fontFamily ?
                                            FONT_CATALOG.find(f => f.family === selectedObject.fontFamily)?.name || selectedObject.fontFamily :
                                            "Vælg skrifttype..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[240px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Søg skrifttype..." className="h-9" />
                                    <CommandList className="max-h-[300px]">
                                        <CommandEmpty>Ingen skrifttype fundet.</CommandEmpty>
                                        <CommandGroup heading="Sans-Serif">
                                            {FONT_CATALOG.filter(f => f.category === 'sans').map((font) => (
                                                <CommandItem
                                                    key={font.id}
                                                    value={font.name}
                                                    onSelect={() => {
                                                        onUpdateProps({ fontFamily: font.family });
                                                        setFontSearchOpen(false);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedObject.fontFamily === font.family ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span style={{ fontFamily: font.family }}>{font.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandGroup heading="Serif">
                                            {FONT_CATALOG.filter(f => f.category === 'serif').map((font) => (
                                                <CommandItem
                                                    key={font.id}
                                                    value={font.name}
                                                    onSelect={() => {
                                                        onUpdateProps({ fontFamily: font.family });
                                                        setFontSearchOpen(false);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedObject.fontFamily === font.family ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span style={{ fontFamily: font.family }}>{font.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandGroup heading="Display">
                                            {FONT_CATALOG.filter(f => f.category === 'display').map((font) => (
                                                <CommandItem
                                                    key={font.id}
                                                    value={font.name}
                                                    onSelect={() => {
                                                        onUpdateProps({ fontFamily: font.family });
                                                        setFontSearchOpen(false);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedObject.fontFamily === font.family ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span style={{ fontFamily: font.family }}>{font.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandGroup heading="Monospace">
                                            {FONT_CATALOG.filter(f => f.category === 'mono').map((font) => (
                                                <CommandItem
                                                    key={font.id}
                                                    value={font.name}
                                                    onSelect={() => {
                                                        onUpdateProps({ fontFamily: font.family });
                                                        setFontSearchOpen(false);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedObject.fontFamily === font.family ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span style={{ fontFamily: font.family }}>{font.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {/* Font Weight */}
                        <div>
                            <Label className="text-xs">Vægt</Label>
                            <Select
                                value={String(selectedObject.fontWeight || 400)}
                                onValueChange={(val) => onUpdateProps({ fontWeight: parseInt(val) })}
                                disabled={!FONT_CATALOG.find(f => f.family === selectedObject.fontFamily)}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(() => {
                                        const font = FONT_CATALOG.find(f => f.family === selectedObject.fontFamily);
                                        const weights = font?.weights || [400];
                                        return weights.map(w => (
                                            <SelectItem key={w} value={String(w)}>
                                                {w === 400 ? 'Normal (400)' : w === 700 ? 'Fed (700)' : w}
                                            </SelectItem>
                                        ));
                                    })()}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Font Size */}
                        <div>
                            <Label className="text-xs">Størrelse</Label>
                            <Input
                                type="number"
                                value={selectedObject.fontSize || 24}
                                onChange={(e) => onUpdateProps({ fontSize: parseInt(e.target.value) || 24 })}
                                className="h-8 text-sm"
                                min={8}
                                max={200}
                            />
                        </div>
                    </div>

                    {/* Font Style Buttons */}
                    <div>
                        <Label className="text-xs mb-2 block">Stil</Label>
                        <div className="flex gap-1">
                            <Button
                                variant={selectedObject.fontStyle === 'italic' ? "default" : "outline"}
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onUpdateProps({
                                    fontStyle: selectedObject.fontStyle === 'italic' ? 'normal' : 'italic'
                                })}
                                disabled={!FONT_CATALOG.find(f => f.family === selectedObject.fontFamily)?.hasItalic && selectedObject.fontStyle !== 'italic'}
                                title="Kursiv"
                            >
                                <Italic className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={selectedObject.underline ? "default" : "outline"}
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onUpdateProps({ underline: !selectedObject.underline })}
                                title="Understreget"
                            >
                                <Underline className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Text Alignment */}
                    <div>
                        <Label className="text-xs mb-2 block">Justering</Label>
                        <div className="flex gap-1">
                            <Button
                                variant={selectedObject.textAlign === 'left' ? "default" : "outline"}
                                size="sm"
                                onClick={() => onUpdateProps({ textAlign: 'left' })}
                                title="Venstrejusteret"
                            >
                                <AlignLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={selectedObject.textAlign === 'center' ? "default" : "outline"}
                                size="sm"
                                onClick={() => onUpdateProps({ textAlign: 'center' })}
                                title="Centreret"
                            >
                                <AlignCenter className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={selectedObject.textAlign === 'right' ? "default" : "outline"}
                                size="sm"
                                onClick={() => onUpdateProps({ textAlign: 'right' })}
                                title="Højrejusteret"
                            >
                                <AlignRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default PropertiesPanel;
