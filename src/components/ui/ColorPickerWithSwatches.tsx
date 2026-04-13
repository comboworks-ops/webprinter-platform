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

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Save, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrandingPalette, BRANDING_PALETTE_LABELS } from "@/contexts/BrandingPaletteContext";

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
const FALLBACK_COLOR = "#000000";
const SHARED_SWATCHES_STORAGE_KEY = "webprinter.color-picker.shared-swatches";
const SHARED_SWATCHES_EVENT = "webprinter:color-picker-shared-swatches";

const clampRgbChannel = (value: number) => Math.max(0, Math.min(255, value));
const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));
const clampHue = (value: number) => Math.max(0, Math.min(360, value));

const normalizeColorValue = (value: unknown): string => {
    if (typeof value !== "string") {
        return FALLBACK_COLOR;
    }

    const trimmed = value.trim();
    return trimmed || FALLBACK_COLOR;
};

const toHexColor = (value: string): string => {
    const normalized = normalizeColorValue(value);

    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
        return normalized.toUpperCase();
    }

    if (/^#[0-9a-f]{3}$/i.test(normalized)) {
        const [, r, g, b] = normalized;
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch) {
        return FALLBACK_COLOR;
    }

    const channels = rgbMatch[1]
        .split(",")
        .slice(0, 3)
        .map((channel) => Number.parseFloat(channel.trim()));

    if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) {
        return FALLBACK_COLOR;
    }

    return `#${channels
        .map((channel) => clampRgbChannel(channel).toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();
};

const hexToRgb = (hex: string) => {
    const normalizedHex = toHexColor(hex);
    const r = parseInt(normalizedHex.slice(1, 3), 16);
    const g = parseInt(normalizedHex.slice(3, 5), 16);
    const b = parseInt(normalizedHex.slice(5, 7), 16);
    return { r, g, b };
};

type HsvColor = {
    h: number;
    s: number;
    v: number;
};

type EyeDropperResult = {
    sRGBHex: string;
};

type EyeDropperConstructor = new () => {
    open: () => Promise<EyeDropperResult>;
};

const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
        .map((channel) => clampRgbChannel(channel).toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();

const rgbToHsv = ({ r, g, b }: { r: number; g: number; b: number }): HsvColor => {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
        if (max === red) {
            hue = ((green - blue) / delta) % 6;
        } else if (max === green) {
            hue = (blue - red) / delta + 2;
        } else {
            hue = (red - green) / delta + 4;
        }
    }

    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;

    const saturation = max === 0 ? 0 : (delta / max) * 100;
    const value = max * 100;

    return {
        h: clampHue(hue),
        s: clampPercentage(saturation),
        v: clampPercentage(value),
    };
};

const hsvToRgb = ({ h, s, v }: HsvColor) => {
    const hue = ((h % 360) + 360) % 360;
    const saturation = clampPercentage(s) / 100;
    const value = clampPercentage(v) / 100;

    const chroma = value * saturation;
    const huePrime = hue / 60;
    const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

    let red = 0;
    let green = 0;
    let blue = 0;

    if (huePrime >= 0 && huePrime < 1) {
        red = chroma;
        green = x;
    } else if (huePrime < 2) {
        red = x;
        green = chroma;
    } else if (huePrime < 3) {
        green = chroma;
        blue = x;
    } else if (huePrime < 4) {
        green = x;
        blue = chroma;
    } else if (huePrime < 5) {
        red = x;
        blue = chroma;
    } else {
        red = chroma;
        blue = x;
    }

    const match = value - chroma;

    return {
        r: Math.round((red + match) * 255),
        g: Math.round((green + match) * 255),
        b: Math.round((blue + match) * 255),
    };
};

const hsvToHex = (color: HsvColor) => {
    const { r, g, b } = hsvToRgb(color);
    return rgbToHex(r, g, b);
};

const dedupeSwatches = (colors: string[]) => {
    const seen = new Set<string>();
    const normalizedColors: string[] = [];

    colors.forEach((color) => {
        const normalized = toHexColor(color);
        if (seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        normalizedColors.push(normalized);
    });

    return normalizedColors.slice(0, MAX_SAVED_SWATCHES);
};

const readSharedSwatches = () => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const stored = window.localStorage.getItem(SHARED_SWATCHES_STORAGE_KEY);
        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? dedupeSwatches(parsed.filter((value): value is string => typeof value === "string")) : [];
    } catch {
        return [];
    }
};

const writeSharedSwatches = (colors: string[]) => {
    if (typeof window === "undefined") {
        return;
    }

    const nextColors = dedupeSwatches(colors);
    window.localStorage.setItem(SHARED_SWATCHES_STORAGE_KEY, JSON.stringify(nextColors));
    window.dispatchEvent(new CustomEvent<string[]>(SHARED_SWATCHES_EVENT, { detail: nextColors }));
};

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
    /** Array of saved swatches (persisted in branding) */
    savedSwatches?: string[];
    /** Callback to save a swatch */
    onSaveSwatch?: (color: string) => void;
    /** Callback to remove a swatch */
    onRemoveSwatch?: (color: string) => void;
    /** Inline mode - label and input on one line */
    inline?: boolean;
    /** Optional fixed width class for the inline label column */
    inlineLabelClassName?: string;
    /** Align inline label/input block to the top instead of center */
    inlineAlign?: "center" | "start";
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
    onRemoveSwatch,
    inline = false,
    inlineLabelClassName,
    inlineAlign = "center",
}: ColorPickerWithSwatchesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isAdjustingColorRef = useRef(false);
    const activeSaturationPointerIdRef = useRef<number | null>(null);
    const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
    const currentColor = normalizeColorValue(value);
    const openedColorRef = useRef(currentColor);
    const openedOpacityRef = useRef(opacity);
    const [sharedSavedSwatches, setSharedSavedSwatches] = useState<string[]>(() => readSharedSwatches());
    const [draftColor, setDraftColor] = useState(currentColor);
    const [draftOpacity, setDraftOpacity] = useState(opacity);
    const [eyeDropperError, setEyeDropperError] = useState<string | null>(null);
    const brandingPalette = useBrandingPalette();
    const editableColor = isOpen ? draftColor : currentColor;
    const normalizedCurrentColor = toHexColor(currentColor);
    const normalizedDraftColor = toHexColor(draftColor);
    const normalizedOpenedColor = toHexColor(openedColorRef.current);
    const normalizedSavedSwatches = dedupeSwatches(savedSwatches);
    const effectiveSavedSwatches = dedupeSwatches([...savedSwatches, ...sharedSavedSwatches]);
    const hexInputValue = editableColor.startsWith("#")
        ? editableColor.replace("#", "").toUpperCase()
        : toHexColor(editableColor).replace("#", "");
    const eyeDropperSupported =
        typeof window !== "undefined"
        && typeof (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper === "function";

    useEffect(() => {
        if (!isOpen) {
            setDraftColor(currentColor);
            setDraftOpacity(opacity);
            setEyeDropperError(null);
        }
    }, [currentColor, opacity, isOpen]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const syncSharedSwatches = () => {
            setSharedSavedSwatches(readSharedSwatches());
        };

        const handleSharedSwatches = (event: Event) => {
            if (event instanceof CustomEvent && Array.isArray(event.detail)) {
                setSharedSavedSwatches(dedupeSwatches(event.detail));
                return;
            }

            syncSharedSwatches();
        };

        window.addEventListener(SHARED_SWATCHES_EVENT, handleSharedSwatches as EventListener);
        window.addEventListener("storage", syncSharedSwatches);

        return () => {
            window.removeEventListener(SHARED_SWATCHES_EVENT, handleSharedSwatches as EventListener);
            window.removeEventListener("storage", syncSharedSwatches);
        };
    }, []);

    const syncDraftFromCommitted = () => {
        setDraftColor(currentColor);
        setDraftOpacity(opacity);
    };

    const handleSwatchClick = (color: string) => {
        setDraftColor(color);
    };

    const handleSaveCurrentColor = () => {
        const nextSharedSwatches = dedupeSwatches([normalizedDraftColor, ...effectiveSavedSwatches]);
        writeSharedSwatches(nextSharedSwatches);

        if (
            onSaveSwatch
            && !normalizedSavedSwatches.includes(normalizedDraftColor)
            && normalizedSavedSwatches.length < MAX_SAVED_SWATCHES
        ) {
            onSaveSwatch(normalizedDraftColor);
        }
    };

    const handlePickColorFromPage = async () => {
        const EyeDropperApi = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
        if (!EyeDropperApi) {
            setEyeDropperError("Din browser understotter ikke farvevalg fra siden.");
            return;
        }

        try {
            setEyeDropperError(null);
            beginColorAdjustment();
            const result = await new EyeDropperApi().open();
            if (result?.sRGBHex) {
                setDraftColor(toHexColor(result.sRGBHex));
            }
        } catch (error) {
            if ((error as DOMException | null)?.name !== "AbortError") {
                setEyeDropperError("Farven kunne ikke hentes fra siden.");
            }
        } finally {
            endColorAdjustment();
        }
    };

    const rgb = hexToRgb(editableColor);
    const hsv = rgbToHsv(rgb);
    const canSave = !effectiveSavedSwatches.some((color) => color.toLowerCase() === normalizedDraftColor.toLowerCase()) && effectiveSavedSwatches.length < MAX_SAVED_SWATCHES;
    const saturationValueHandleColor = hsv.v > 55 && hsv.s < 55 ? "#111827" : "#FFFFFF";
    const hueSliderBackground = "linear-gradient(90deg, #FF0000 0%, #FFFF00 16.66%, #00FF00 33.33%, #00FFFF 50%, #0000FF 66.66%, #FF00FF 83.33%, #FF0000 100%)";
    const hasPendingChanges = normalizedDraftColor !== normalizedOpenedColor || Math.abs(draftOpacity - openedOpacityRef.current) > Number.EPSILON;

    useEffect(() => {
        if (!isOpen || normalizedDraftColor === normalizedCurrentColor) {
            return;
        }

        onChange(draftColor);
    }, [draftColor, isOpen, normalizedCurrentColor, normalizedDraftColor, onChange]);

    useEffect(() => {
        if (!isOpen || !showOpacity || !onOpacityChange || Math.abs(draftOpacity - opacity) <= Number.EPSILON) {
            return;
        }

        onOpacityChange(draftOpacity);
    }, [draftOpacity, isOpen, onOpacityChange, opacity, showOpacity]);

    const updateColorFromHsv = (nextHsv: HsvColor) => {
        setDraftColor(hsvToHex(nextHsv));
    };

    const applyDraftChanges = () => {
        if (normalizedDraftColor !== normalizedCurrentColor) {
            onChange(draftColor);
        }

        if (showOpacity && onOpacityChange && Math.abs(draftOpacity - opacity) > Number.EPSILON) {
            onOpacityChange(draftOpacity);
        }

        openedColorRef.current = draftColor;
        openedOpacityRef.current = draftOpacity;
        endColorAdjustment();
        setIsOpen(false);
    };

    const cancelDraftChanges = () => {
        if (normalizedCurrentColor !== normalizedOpenedColor) {
            onChange(openedColorRef.current);
        }

        if (showOpacity && onOpacityChange && Math.abs(opacity - openedOpacityRef.current) > Number.EPSILON) {
            onOpacityChange(openedOpacityRef.current);
        }

        endColorAdjustment();
        setDraftColor(openedColorRef.current);
        setDraftOpacity(openedOpacityRef.current);
        setIsOpen(false);
    };

    const beginColorAdjustment = () => {
        isAdjustingColorRef.current = true;
    };

    const endColorAdjustment = () => {
        isAdjustingColorRef.current = false;
    };

    const handlePopoverOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && isAdjustingColorRef.current) {
            return;
        }

        if (nextOpen) {
            openedColorRef.current = currentColor;
            openedOpacityRef.current = opacity;
            syncDraftFromCommitted();
            setIsOpen(true);
            return;
        }

        cancelDraftChanges();
    };

    const preventDismissWhileAdjusting = (event: Event | { preventDefault: () => void }) => {
        if (isAdjustingColorRef.current) {
            event.preventDefault();
        }
    };

    const updateSaturationValueFromPoint = (
        clientX: number,
        clientY: number,
        element: HTMLDivElement,
        hue: number,
    ) => {
        const rect = element.getBoundingClientRect();
        const x = clampPercentage(((clientX - rect.left) / rect.width) * 100);
        const y = clampPercentage(((clientY - rect.top) / rect.height) * 100);

        updateColorFromHsv({
            h: hue,
            s: x,
            v: 100 - y,
        });
    };

    const handleSaturationValuePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        beginColorAdjustment();

        const target = event.currentTarget;
        const currentHue = hsv.h;
        activeSaturationPointerIdRef.current = event.pointerId;
        target.setPointerCapture(event.pointerId);

        updateSaturationValueFromPoint(event.clientX, event.clientY, target, currentHue);
    };

    const handleSaturationValuePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (activeSaturationPointerIdRef.current !== event.pointerId) {
            return;
        }

        event.preventDefault();
        updateSaturationValueFromPoint(event.clientX, event.clientY, event.currentTarget, hsv.h);
    };

    const finishSaturationValuePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (activeSaturationPointerIdRef.current !== null && event.currentTarget.hasPointerCapture(activeSaturationPointerIdRef.current)) {
            event.currentTarget.releasePointerCapture(activeSaturationPointerIdRef.current);
        }

        activeSaturationPointerIdRef.current = null;
        endColorAdjustment();
    };

    // Build the style colors list from branding palette context
    const styleColorEntries = Object.entries(BRANDING_PALETTE_LABELS)
        .map(([key, lbl]) => ({ key, label: lbl, color: brandingPalette[key] }))
        .filter((entry): entry is { key: string; label: string; color: string } => Boolean(entry.color));

    const PickerContent = () => (
        <div className="space-y-3">
            {/* Current Color Preview */}
            <div className="flex items-center gap-3 pb-3 border-b">
                <div
                    className="h-10 w-10 rounded-lg border-2 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: editableColor }}
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold font-mono leading-tight">{editableColor.toUpperCase()}</p>
                    {rgb && (
                        <p className="text-[11px] text-muted-foreground">
                            RGB {rgb.r}, {rgb.g}, {rgb.b}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {eyeDropperSupported && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handlePickColorFromPage}
                            className="h-8 px-2"
                            title="Hent farve fra siden"
                        >
                            <Pipette className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {eyeDropperError && (
                <p className="text-xs text-destructive">{eyeDropperError}</p>
            )}

            {/* Two-column swatch bank */}
            <div className="grid grid-cols-2 gap-3 pb-3 border-b">
                {/* Left: Style colors from branding */}
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Stilfarver
                    </p>
                    {styleColorEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {styleColorEntries.map(({ key, label, color }) => (
                                <button
                                    key={key}
                                    onClick={() => handleSwatchClick(color)}
                                    title={`${label}: ${color}`}
                                    className={cn(
                                        "h-6 w-6 rounded-md border shadow-sm hover:scale-110 transition-transform relative",
                                        draftColor.toLowerCase() === color.toLowerCase()
                                            ? "ring-2 ring-primary ring-offset-1"
                                            : "border-border/60",
                                        color === "#FFFFFF" && "border-gray-300"
                                    )}
                                    style={{ backgroundColor: color }}
                                >
                                    {draftColor.toLowerCase() === color.toLowerCase() && (
                                        <Check className="h-3 w-3 absolute inset-0 m-auto text-white drop-shadow" />
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic">Ingen stilfarver endnu</p>
                    )}
                </div>

                {/* Right: Saved colors */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Gemte farver
                            <span className="ml-1 font-normal">({effectiveSavedSwatches.length}/{MAX_SAVED_SWATCHES})</span>
                        </p>
                        <button
                            onClick={handleSaveCurrentColor}
                            disabled={!canSave}
                            title={canSave ? "Gem denne farve" : "Farven er allerede gemt"}
                            className={cn(
                                "flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                                canSave
                                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                    : "border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
                            )}
                        >
                            <Save className="h-2.5 w-2.5" />
                            <span>Gem</span>
                        </button>
                    </div>
                    {effectiveSavedSwatches.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto">
                            {effectiveSavedSwatches.map((color, index) => (
                                <div key={`saved-${color}-${index}`} className="group relative">
                                    <button
                                        onClick={() => handleSwatchClick(color)}
                                        className={cn(
                                            "h-6 w-6 rounded-md border shadow-sm hover:scale-110 transition-transform relative",
                                            draftColor.toLowerCase() === color.toLowerCase()
                                                ? "ring-2 ring-primary ring-offset-1 border-primary"
                                                : "border-border/60",
                                            color === "#FFFFFF" && "border-gray-300"
                                        )}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    >
                                        {draftColor.toLowerCase() === color.toLowerCase() && (
                                            <Check className="h-3 w-3 absolute inset-0 m-auto text-white drop-shadow" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const normalizedSavedColor = toHexColor(color);
                                            const nextSharedSwatches = effectiveSavedSwatches.filter(
                                                (savedColor) => savedColor.toLowerCase() !== normalizedSavedColor.toLowerCase()
                                            );
                                            writeSharedSwatches(nextSharedSwatches);
                                            const matchingSavedSwatch = savedSwatches.find(
                                                (savedColor) => toHexColor(savedColor) === normalizedSavedColor
                                            );
                                            onRemoveSwatch?.(matchingSavedSwatch ?? normalizedSavedColor);
                                        }}
                                        className="absolute -top-1 -right-1 hidden group-hover:flex bg-destructive text-white rounded-full p-0.5 h-3.5 w-3.5 items-center justify-center cursor-pointer shadow-sm z-10"
                                        title="Fjern farve"
                                    >
                                        <X className="h-2 w-2" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic">Ingen gemte farver</p>
                    )}
                </div>
            </div>

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
                                    }}
                                    className={cn(
                                        "h-6 w-6 rounded border shadow-sm hover:scale-110 transition-transform relative",
                                        draftColor.toLowerCase() === color.toLowerCase()
                                            ? "ring-2 ring-primary ring-offset-1"
                                            : "",
                                        color === "#FFFFFF" && "border-gray-300"
                                    )}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                >
                                    {draftColor.toLowerCase() === color.toLowerCase() && (
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

            <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs font-semibold text-foreground">Finjuster farven</Label>
                <div
                    className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-md border touch-none"
                    style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 100, v: 100 }) }}
                    onPointerDown={handleSaturationValuePointerDown}
                    onPointerMove={handleSaturationValuePointerMove}
                    onPointerUp={finishSaturationValuePointer}
                    onPointerCancel={finishSaturationValuePointer}
                    onLostPointerCapture={finishSaturationValuePointer}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                    <div
                        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
                        style={{
                            left: `${hsv.s}%`,
                            top: `${100 - hsv.v}%`,
                            borderColor: saturationValueHandleColor,
                            backgroundColor: "transparent",
                        }}
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Farvetone</span>
                        <span>{Math.round(hsv.h)}°</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={Math.round(hsv.h)}
                        onPointerDown={beginColorAdjustment}
                        onPointerUp={endColorAdjustment}
                        onPointerCancel={endColorAdjustment}
                        onBlur={endColorAdjustment}
                        onChange={(e) => {
                            updateColorFromHsv({
                                h: Number(e.target.value),
                                s: hsv.s,
                                v: hsv.v,
                            });
                        }}
                        className="h-2 w-full cursor-pointer appearance-none rounded-md border border-border/80"
                        style={{ background: hueSliderBackground }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                        Mætning: {Math.round(hsv.s)}%
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                        Lysstyrke: {Math.round(hsv.v)}%
                    </div>
                </div>

                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">#</span>
                    <Input
                        value={hexInputValue}
                        onChange={(e) => setDraftColor(`#${e.target.value}`)}
                        className="h-9 text-xs font-mono pl-5 uppercase"
                        placeholder="000000"
                        maxLength={6}
                    />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelDraftChanges}
                        className="h-8 px-3 text-xs"
                    >
                        Annuller
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={applyDraftChanges}
                        disabled={!hasPendingChanges}
                        className="h-8 px-3 text-xs"
                    >
                        Gem farve
                    </Button>
                </div>
            </div>

            {/* Opacity slider */}
            {showOpacity && onOpacityChange && (
                <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Gennemsigtighed</span>
                        <span className="font-medium">{Math.round(draftOpacity * 100)}%</span>
                    </div>
                    <Slider
                        value={[draftOpacity * 100]}
                        onValueChange={([v]) => setDraftOpacity(v / 100)}
                        min={0}
                        max={100}
                        step={5}
                        className="py-1"
                    />
                </div>
            )}
        </div>
    );

    // Centered modal portal — always appears in the middle of the viewport
    const pickerModal = isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                onPointerDown={(e) => {
                    if (e.target === e.currentTarget && !isAdjustingColorRef.current) {
                        cancelDraftChanges();
                    }
                }}
            >
                {/* Picker panel */}
                <div className="relative bg-background rounded-2xl shadow-2xl border border-border/60 p-4 w-[min(380px,calc(100vw-2rem))] max-h-[calc(100dvh-4rem)] overflow-y-auto z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-foreground">
                            {label || "Vælg farve"}
                        </p>
                        <button
                            className="h-6 w-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                            onClick={cancelDraftChanges}
                            title="Luk"
                        >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    </div>
                    <PickerContent />
                </div>
            </div>,
            document.body
        )
        : null;

    if (compact) {
        return (
            <>
                <button
                    ref={triggerButtonRef}
                    className="h-8 w-8 rounded border overflow-hidden shadow-sm hover:ring-2 ring-primary transition-all relative flex-shrink-0"
                    style={{ backgroundColor: currentColor }}
                    title={currentColor}
                    onClick={() => {
                        openedColorRef.current = currentColor;
                        openedOpacityRef.current = opacity;
                        syncDraftFromCommitted();
                        setIsOpen(true);
                    }}
                />
                {pickerModal}
            </>
        );
    }

    // Full inline mode
    return (
        <>
            <div className={cn(
                "space-y-2",
                inline && "flex gap-3 space-y-0 w-full",
                inline && (inlineAlign === "start" ? "items-start" : "items-center"),
            )}>
                {label && (
                    <Label className={cn(
                        "text-sm font-medium",
                        inline && "text-xs text-muted-foreground whitespace-nowrap",
                        inline && inlineLabelClassName,
                    )}>
                        {label}
                    </Label>
                )}

                <div className={cn("flex items-center gap-2", inline && "gap-1.5 flex-1 min-w-0")}>
                    <button
                        ref={triggerButtonRef}
                        className={cn(
                            "h-10 w-10 rounded-lg border-2 overflow-hidden shadow-sm hover:ring-2 ring-primary transition-all flex-shrink-0",
                            inline && "h-9 w-9 rounded-md"
                        )}
                        style={{ backgroundColor: currentColor }}
                        title="Klik for at vælge farve"
                        onClick={() => {
                            openedColorRef.current = currentColor;
                            openedOpacityRef.current = opacity;
                            syncDraftFromCommitted();
                            setIsOpen(true);
                        }}
                    />

                    <Input
                        value={currentColor.toUpperCase()}
                        onChange={(e) => onChange(e.target.value)}
                        className={cn("font-mono flex-1 h-10 uppercase min-w-0", inline && "h-9 text-xs px-2")}
                        placeholder="#000000"
                    />
                </div>

                {!inline && rgb && (
                    <p className="text-xs text-muted-foreground">
                        RGB: {rgb.r}, {rgb.g}, {rgb.b}
                        {showOpacity && ` / ${Math.round(opacity * 100)}%`}
                    </p>
                )}
            </div>
            {pickerModal}
        </>
    );
}

export default ColorPickerWithSwatches;
