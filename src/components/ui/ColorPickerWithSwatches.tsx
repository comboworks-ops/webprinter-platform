/**
 * Color Picker with Swatches Component
 * 
 * A color picker that provides:
 * - Quick-select swatch colors for common choices
 * - Native color picker for custom colors
 * - Hex input field for precise values
 * - Opacity slider (optional)
 */

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Palette, Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Predefined swatch colors - curated for branding
const DEFAULT_SWATCHES = [
    // Row 1: Neutrals
    "#FFFFFF", "#F8FAFC", "#E2E8F0", "#94A3B8", "#64748B", "#475569", "#1E293B", "#0F172A", "#000000",
    // Row 2: Warm colors
    "#FEF2F2", "#FEE2E2", "#FECACA", "#F87171", "#EF4444", "#DC2626", "#B91C1C", "#991B1B", "#7F1D1D",
    // Row 3: Orange/Amber
    "#FFF7ED", "#FFEDD5", "#FED7AA", "#FDBA74", "#FB923C", "#F97316", "#EA580C", "#C2410C", "#9A3412",
    // Row 4: Yellow
    "#FEFCE8", "#FEF9C3", "#FEF08A", "#FDE047", "#FACC15", "#EAB308", "#CA8A04", "#A16207", "#854D0E",
    // Row 5: Green
    "#F0FDF4", "#DCFCE7", "#BBF7D0", "#86EFAC", "#4ADE80", "#22C55E", "#16A34A", "#15803D", "#166534",
    // Row 6: Teal/Cyan
    "#F0FDFA", "#CCFBF1", "#99F6E4", "#5EEAD4", "#2DD4BF", "#14B8A6", "#0D9488", "#0F766E", "#115E59",
    // Row 7: Blue
    "#EFF6FF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#1E40AF",
    // Row 8: Indigo/Purple  
    "#EEF2FF", "#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#4338CA", "#3730A3",
    // Row 9: Pink/Rose
    "#FDF2F8", "#FCE7F3", "#FBCFE8", "#F9A8D4", "#F472B6", "#EC4899", "#DB2777", "#BE185D", "#9D174D",
];

// Common brand colors as a quick subset
const QUICK_SWATCHES = [
    "#FFFFFF", "#000000", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6",
    "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
];

interface ColorPickerWithSwatchesProps {
    /** Current color value (hex) */
    value: string;
    /** Callback when color changes */
    onChange: (color: string) => void;
    /** Optional label */
    label?: string;
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

    // New props for saved swatches
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
}

export function ColorPickerWithSwatches({
    value,
    onChange,
    label,
    showOpacity = false,
    opacity = 1,
    onOpacityChange,
    compact = false,
    showFullSwatches = true,
    savedSwatches = [],
    onSaveSwatch,
    onRemoveSwatch
}: ColorPickerWithSwatchesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const colorInputRef = useRef<HTMLInputElement>(null);

    const swatches = showFullSwatches ? DEFAULT_SWATCHES : QUICK_SWATCHES;

    const handleSwatchClick = (color: string) => {
        onChange(color);
    };

    const handleCustomColorClick = () => {
        colorInputRef.current?.click();
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

    const PickerContent = () => (
        <div className="space-y-4">
            {/* Header / Saved Swatches Section */}
            {(savedSwatches.length > 0 || onSaveSwatch) && (
                <div className="space-y-2 pb-2 border-b">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground">Dine farver</Label>
                        {onSaveSwatch && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => onSaveSwatch(value)}
                                disabled={savedSwatches.includes(value) || savedSwatches.length >= 20}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Gem
                            </Button>
                        )}
                    </div>

                    {savedSwatches.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {savedSwatches.map((color, index) => (
                                <div key={`saved-${color}-${index}`} className="group relative">
                                    <button
                                        onClick={() => handleSwatchClick(color)}
                                        className={cn(
                                            "h-6 w-6 rounded-full border shadow-sm hover:scale-110 transition-transform",
                                            color === "#FFFFFF" && "border-gray-300"
                                        )}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                    {onRemoveSwatch && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveSwatch(color);
                                            }}
                                            className="absolute -top-1 -right-1 hidden group-hover:flex bg-destructive text-white rounded-full p-0.5 h-3.5 w-3.5 items-center justify-center cursor-pointer shadow-sm z-10"
                                            title="Fjern farve"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">Ingen gemte farver</p>
                    )}
                </div>
            )}

            {/* Default Swatches Grid */}
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Standard</Label>
                <div
                    className="grid gap-1"
                    style={{
                        gridTemplateColumns: `repeat(${showFullSwatches ? 9 : 6}, 1fr)`,
                    }}
                >
                    {swatches.map((color, index) => (
                        <button
                            key={`${color}-${index}`}
                            onClick={() => {
                                handleSwatchClick(color);
                                if (compact) setIsOpen(false);
                            }}
                            className={cn(
                                "h-6 w-6 rounded border shadow-sm hover:scale-110 transition-transform relative",
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
            </div>

            {/* Custom picker button */}
            <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCustomColorClick}
                    className="flex-1 gap-2 text-xs h-8"
                >
                    <Palette className="h-3 w-3" />
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
                        value={value.replace('#', '')}
                        onChange={(e) => onChange(`#${e.target.value}`)}
                        className="h-8 text-xs font-mono pl-5"
                        placeholder="000000"
                        maxLength={6}
                    />
                </div>
            </div>

            {/* Opacity slider */}
            {showOpacity && onOpacityChange && (
                <div className="space-y-1 pt-1 border-t">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Gennemsigtighed</span>
                        <span>{Math.round(opacity * 100)}%</span>
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
                    >
                        {/* Optional check if transparent/white just to show border */}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                    {label && <Label className="text-sm font-medium mb-3 block">{label}</Label>}
                    <PickerContent />
                </PopoverContent>
            </Popover>
        );
    }

    // Full inline mode (but still using Popover for the grid to save space? Or inline grid?)
    // The original implementation used a Popover even in inline mode. I'll stick to that but improve the trigger.
    return (
        <div className="space-y-2">
            {label && <Label className="text-sm font-medium">{label}</Label>}

            <div className="flex items-center gap-2">
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="h-10 w-10 rounded-lg border-2 overflow-hidden shadow-sm hover:ring-2 ring-primary transition-all flex-shrink-0"
                            style={{ backgroundColor: value }}
                            title="Klik for at vælge farve"
                        />
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-3" align="start" sideOffset={5}>
                        <PickerContent />
                    </PopoverContent>
                </Popover>

                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="font-mono flex-1 h-10"
                    placeholder="#000000"
                />
            </div>

            {/* RGB display (optional info) */}
            {rgb && (
                <p className="text-xs text-muted-foreground">
                    RGB: {rgb.r}, {rgb.g}, {rgb.b}
                    {showOpacity && ` / ${Math.round(opacity * 100)}%`}
                </p>
            )}
        </div>
    );
}

export default ColorPickerWithSwatches;
