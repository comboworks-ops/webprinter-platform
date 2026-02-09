/**
 * Color Picker with Swatches Component
 * 
 * The MASTER color picker for the entire branding system.
 * Use this component anywhere you need a color picker - it provides:
 * - Quick-select swatch colors for common choices (scrollable)
 * - Saved personal color swatches (up to 20, persisted with branding)
 * - Native color picker for custom colors
 * - Hex input field for precise values
 * - Opacity slider (optional)
 */

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Palette, Plus, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

// Predefined swatch colors - curated for branding (organized by hue)
const DEFAULT_SWATCHES = [
    // Row 1: Neutrals
    "#FFFFFF", "#F8FAFC", "#E2E8F0", "#94A3B8", "#64748B", "#475569", "#1E293B", "#0F172A", "#000000",
    // Row 2: Warm colors (Red)
    "#FEF2F2", "#FEE2E2", "#FECACA", "#F87171", "#EF4444", "#DC2626", "#B91C1C", "#991B1B", "#7F1D1D",
    // Row 3: Orange/Amber
    "#FFF7ED", "#FFEDD5", "#FED7AA", "#FDBA74", "#FB923C", "#F97316", "#EA580C", "#C2410C", "#9A3412",
    // Row 4: Yellow
    "#FEFCE8", "#FEF9C3", "#FEF08A", "#FDE047", "#FACC15", "#EAB308", "#CA8A04", "#A16207", "#854D0E",
    // Row 5: Lime/Green
    "#F7FEE7", "#ECFCCB", "#D9F99D", "#BEF264", "#A3E635", "#84CC16", "#65A30D", "#4D7C0F", "#3F6212",
    // Row 6: Green
    "#F0FDF4", "#DCFCE7", "#BBF7D0", "#86EFAC", "#4ADE80", "#22C55E", "#16A34A", "#15803D", "#166534",
    // Row 7: Emerald
    "#ECFDF5", "#D1FAE5", "#A7F3D0", "#6EE7B7", "#34D399", "#10B981", "#059669", "#047857", "#065F46",
    // Row 8: Teal/Cyan
    "#F0FDFA", "#CCFBF1", "#99F6E4", "#5EEAD4", "#2DD4BF", "#14B8A6", "#0D9488", "#0F766E", "#115E59",
    // Row 9: Sky/Cyan
    "#ECFEFF", "#CFFAFE", "#A5F3FC", "#67E8F9", "#22D3EE", "#06B6D4", "#0891B2", "#0E7490", "#155E75",
    // Row 10: Blue
    "#EFF6FF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#1E40AF",
    // Row 11: Indigo
    "#EEF2FF", "#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#4338CA", "#3730A3",
    // Row 12: Violet/Purple
    "#F5F3FF", "#EDE9FE", "#DDD6FE", "#C4B5FD", "#A78BFA", "#8B5CF6", "#7C3AED", "#6D28D9", "#5B21B6",
    // Row 13: Fuchsia
    "#FDF4FF", "#FAE8FF", "#F5D0FE", "#F0ABFC", "#E879F9", "#D946EF", "#C026D3", "#A21CAF", "#86198F",
    // Row 14: Pink/Rose
    "#FDF2F8", "#FCE7F3", "#FBCFE8", "#F9A8D4", "#F472B6", "#EC4899", "#DB2777", "#BE185D", "#9D174D",
    // Row 15: Stone (Warm Grays)
    "#FAFAF9", "#F5F5F4", "#E7E5E4", "#D6D3D1", "#A8A29E", "#78716C", "#57534E", "#44403C", "#292524",
    // Row 16: Slate (Cool Grays)
    "#F8FAFC", "#F1F5F9", "#E2E8F0", "#CBD5E1", "#94A3B8", "#64748B", "#475569", "#334155", "#1E293B",
    // Row 17: Bronze/Gold
    "#FDF8EE", "#F9EECF", "#F0D89E", "#D4B660", "#B8963F", "#967830", "#785E24", "#5A461B", "#3D2E12",
];

// Maximum saved swatches
const MAX_SAVED_SWATCHES = 20;

interface ColorPickerWithSwatchesProps {
    /** Current color value (hex) */
    value: string;
    /** Callback when color changes */
    onChange: (color: string) => void;
    /** Optional label */
    label?: string;
    /** Optional tooltip text to explain what this color controls */
    tooltip?: string;
    /** Show opacity slider */
    showOpacity?: boolean;
    /** Current opacity (0-1) */
    opacity?: number;
    /** Callback when opacity changes */
    onOpacityChange?: (opacity: number) => void;
    /** Compact mode - just shows the color swatch that opens a popover */
    compact?: boolean;
    /** Show the full swatch grid or just quick swatches */
    showFullSwatches?: boolean;
    /** Array of saved swatches (persisted in branding) */
    savedSwatches?: string[];
    /** Callback to save a swatch */
    onSaveSwatch?: (color: string) => void;
    /** Callback to remove a swatch */
    onRemoveSwatch?: (color: string) => void;
    /** Inline mode - label and input on one line */
    inline?: boolean;
}

export function ColorPickerWithSwatches({
    value,
    onChange,
    label,
    tooltip,
    showOpacity = false,
    opacity = 1,
    onOpacityChange,
    compact = false,
    showFullSwatches = true,
    savedSwatches = [],
    onSaveSwatch,
    onRemoveSwatch,
    inline = false
}: ColorPickerWithSwatchesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const colorInputRef = useRef<HTMLInputElement>(null);

    const handleSwatchClick = (color: string) => {
        onChange(color);
    };

    const handleCustomColorClick = () => {
        colorInputRef.current?.click();
    };

    const handleSaveCurrentColor = () => {
        if (onSaveSwatch && !savedSwatches.includes(value) && savedSwatches.length < MAX_SAVED_SWATCHES) {
            onSaveSwatch(value);
        }
    };

    // Parse hex to extract RGB for display
    const hexToRgb = (hex: string) => {
        if (!hex || !hex.startsWith('#')) return null;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };

    const rgb = hexToRgb(value);
    const canSave = onSaveSwatch && !savedSwatches.includes(value) && savedSwatches.length < MAX_SAVED_SWATCHES;

    const PickerContent = () => (
        <div className="space-y-3">
            {/* Current Color Preview & Save */}
            <div className="flex items-center gap-3 pb-3 border-b">
                <div
                    className="h-12 w-12 rounded-lg border-2 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: value }}
                />
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium font-mono">{value.toUpperCase()}</p>
                    {rgb && (
                        <p className="text-xs text-muted-foreground">
                            RGB: {rgb.r}, {rgb.g}, {rgb.b}
                        </p>
                    )}
                </div>
                {onSaveSwatch && (
                    <Button
                        variant={canSave ? "default" : "ghost"}
                        size="sm"
                        onClick={handleSaveCurrentColor}
                        disabled={!canSave}
                        className="h-8 px-2"
                        title={canSave ? "Gem denne farve" : savedSwatches.includes(value) ? "Farven er allerede gemt" : "Max 20 farver"}
                    >
                        <Save className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Saved Swatches Section */}
            {(savedSwatches.length > 0 || onSaveSwatch) && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">
                            Dine gemte farver
                            <span className="ml-1 text-muted-foreground font-normal">
                                ({savedSwatches.length}/{MAX_SAVED_SWATCHES})
                            </span>
                        </Label>
                    </div>

                    {savedSwatches.length > 0 ? (
                        <ScrollArea className="h-auto max-h-[72px]">
                            <div className="flex flex-wrap gap-1.5 pr-2">
                                {savedSwatches.map((color, index) => (
                                    <div key={`saved-${color}-${index}`} className="group relative">
                                        <button
                                            onClick={() => handleSwatchClick(color)}
                                            className={cn(
                                                "h-7 w-7 rounded-md border-2 shadow-sm hover:scale-110 transition-transform relative",
                                                value.toLowerCase() === color.toLowerCase()
                                                    ? "ring-2 ring-primary ring-offset-1"
                                                    : "",
                                                color === "#FFFFFF" && "border-gray-300"
                                            )}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        >
                                            {value.toLowerCase() === color.toLowerCase() && (
                                                <Check className={cn(
                                                    "h-3.5 w-3.5 absolute inset-0 m-auto",
                                                    color === "#FFFFFF" || color.startsWith("#FEF") || color.startsWith("#F0F")
                                                        ? "text-gray-800"
                                                        : "text-white"
                                                )} />
                                            )}
                                        </button>
                                        {onRemoveSwatch && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemoveSwatch(color);
                                                }}
                                                className="absolute -top-1 -right-1 hidden group-hover:flex bg-destructive text-white rounded-full p-0.5 h-4 w-4 items-center justify-center cursor-pointer shadow-sm z-10"
                                                title="Fjern farve"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="text-xs text-muted-foreground italic py-2 px-3 bg-muted/30 rounded-md">
                            Vælg en farve og klik gem-knappen for at tilføje den her
                        </div>
                    )}
                </div>
            )}

            {/* Default Swatches Grid - Scrollable */}
            {showFullSwatches && (
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground">Farvepalette</Label>
                    <ScrollArea className="h-[180px] rounded-md border p-2">
                        <div
                            className="grid gap-1"
                            style={{
                                gridTemplateColumns: 'repeat(9, 1fr)',
                            }}
                        >
                            {DEFAULT_SWATCHES.map((color, index) => (
                                <button
                                    key={`${color}-${index}`}
                                    onClick={() => {
                                        handleSwatchClick(color);
                                        if (compact) setIsOpen(false);
                                    }}
                                    className={cn(
                                        "h-6 w-6 rounded border shadow-sm hover:scale-110 transition-transform relative",
                                        value.toLowerCase() === color.toLowerCase()
                                            ? "ring-2 ring-primary ring-offset-1"
                                            : "",
                                        color === "#FFFFFF" && "border-gray-300"
                                    )}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                >
                                    {value.toLowerCase() === color.toLowerCase() && (
                                        <Check className={cn(
                                            "h-3 w-3 absolute inset-0 m-auto",
                                            color === "#FFFFFF" || color.startsWith("#FEF") || color.startsWith("#F0F")
                                                ? "text-gray-800"
                                                : "text-white"
                                        )} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}

            {/* Custom picker & Hex input */}
            <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCustomColorClick}
                    className="flex-1 gap-2 text-xs h-9"
                >
                    <Palette className="h-4 w-4" />
                    Vælg farve
                </Button>
                <input
                    ref={colorInputRef}
                    type="color"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                    className="sr-only"
                />
                <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">#</span>
                    <Input
                        value={value.replace('#', '').toUpperCase()}
                        onChange={(e) => onChange(`#${e.target.value}`)}
                        className="h-9 text-xs font-mono pl-5 uppercase"
                        placeholder="000000"
                        maxLength={6}
                    />
                </div>
            </div>

            {/* Opacity slider */}
            {showOpacity && onOpacityChange && (
                <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Gennemsigtighed</span>
                        <span className="font-medium">{Math.round(opacity * 100)}%</span>
                    </div>
                    <Slider
                        value={[opacity * 100]}
                        onValueChange={([v]) => onOpacityChange(v / 100)}
                        min={0}
                        max={100}
                        step={5}
                        className="py-1"
                    />
                </div>
            )}
        </div>
    );

    if (compact) {
        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className="h-8 w-8 rounded border overflow-hidden shadow-sm hover:ring-2 ring-primary transition-all relative"
                        style={{ backgroundColor: value }}
                        title={value}
                    />
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-4" align="start">
                    {label && <Label className="text-sm font-medium mb-3 block">{label}</Label>}
                    <PickerContent />
                </PopoverContent>
            </Popover>
        );
    }

    // Full inline mode with popover for the picker
    return (
        <div className="flex flex-col gap-1.5 h-full">
            {label && (
                <div className="flex items-center gap-1 flex-1">
                    <Label className="text-xs text-muted-foreground leading-tight">
                        {label}
                    </Label>
                    {tooltip && <InfoTooltip content={tooltip} />}
                </div>
            )}

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            "h-8 w-8 rounded-md border-2 overflow-hidden shadow-sm hover:ring-2 ring-primary transition-all flex-shrink-0",
                            inline && "h-7 w-7"
                        )}
                        style={{ backgroundColor: value }}
                        title={`${value.toUpperCase()} - Klik for at vælge farve`}
                    />
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-4" align="start" sideOffset={5}>
                    <PickerContent />
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default ColorPickerWithSwatches;
