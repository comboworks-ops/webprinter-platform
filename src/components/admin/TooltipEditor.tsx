import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, HelpCircle, Lightbulb, Star, Save, Trash2, Palette } from "lucide-react";
import { ANCHOR_ZONES, type TooltipConfig } from "./ProductPagePreview";

const ICON_OPTIONS = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'question', label: 'Spørgsmål', icon: HelpCircle },
    { id: 'lightbulb', label: 'Tip', icon: Lightbulb },
    { id: 'star', label: 'Stjerne', icon: Star },
] as const;

const ANIMATION_OPTIONS = [
    { id: 'fade', label: 'Fade ind' },
    { id: 'slide', label: 'Glid op' },
    { id: 'bounce', label: 'Spring' },
] as const;

const COLOR_PRESETS = [
    '#0EA5E9', // Sky blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
];

interface TooltipEditorProps {
    selectedAnchor: string | null;
    existingTooltip?: TooltipConfig | null;
    onSave: (tooltip: TooltipConfig) => void;
    onDelete: (anchorId: string) => void;
    onCancel: () => void;
}

export function TooltipEditor({
    selectedAnchor,
    existingTooltip,
    onSave,
    onDelete,
    onCancel
}: TooltipEditorProps) {
    const [icon, setIcon] = useState<TooltipConfig['icon']>(existingTooltip?.icon || 'info');
    const [color, setColor] = useState(existingTooltip?.color || '#0EA5E9');
    const [animation, setAnimation] = useState<TooltipConfig['animation']>(existingTooltip?.animation || 'fade');
    const [text, setText] = useState(existingTooltip?.text || '');
    const [link, setLink] = useState(existingTooltip?.link || '');

    const selectedZone = ANCHOR_ZONES.find(z => z.id === selectedAnchor);

    const handleSave = () => {
        if (!selectedAnchor || !text.trim()) return;

        onSave({
            anchor: selectedAnchor,
            icon,
            color,
            animation,
            text: text.trim(),
            link: link.trim() || undefined
        });
    };

    if (!selectedAnchor) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                <Info className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Klik på et område i preview'et for at tilføje en tooltip</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            {/* Header */}
            <div className="border-b pb-3">
                <h3 className="font-semibold text-sm">Rediger Tooltip</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Område: <span className="font-medium text-foreground">{selectedZone?.labelDa}</span>
                </p>
            </div>

            {/* Icon Selection */}
            <div className="space-y-2">
                <Label className="text-xs">Ikon</Label>
                <div className="flex gap-2">
                    {ICON_OPTIONS.map((opt) => {
                        const IconComponent = opt.icon;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => setIcon(opt.id as TooltipConfig['icon'])}
                                className={`p-2 rounded-lg border-2 transition-all ${icon === opt.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                    }`}
                                title={opt.label}
                            >
                                <IconComponent className="w-4 h-4" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-2">
                <Label className="text-xs">Farve</Label>
                <div className="flex gap-2 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                                }`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center hover:border-primary"
                                title="Vælg anden farve"
                            >
                                <Palette className="w-3 h-3" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                            <Input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="w-16 h-8 p-0 border-0"
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Animation Selection */}
            <div className="space-y-2">
                <Label className="text-xs">Effekt</Label>
                <Select value={animation} onValueChange={(v) => setAnimation(v as TooltipConfig['animation'])}>
                    <SelectTrigger className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ANIMATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Text */}
            <div className="space-y-2">
                <Label className="text-xs">Tekst</Label>
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Skriv din tooltip-tekst her..."
                    className="min-h-[80px] text-sm resize-none"
                />
            </div>

            {/* Optional Link */}
            <div className="space-y-2">
                <Label className="text-xs">Link (valgfrit)</Label>
                <Input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    className="h-9 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                    Tilføj et link for at give brugeren mere information
                </p>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-3 bg-muted/30">
                <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                <div className="flex items-start gap-2">
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: color }}
                    >
                        {icon === 'info' && 'i'}
                        {icon === 'question' && '?'}
                        {icon === 'lightbulb' && '💡'}
                        {icon === 'star' && '★'}
                    </div>
                    <div className="text-sm">
                        {text || <span className="text-muted-foreground italic">Din tekst her...</span>}
                        {link && (
                            <span className="text-primary text-xs ml-1 underline">Læs mere →</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
                {existingTooltip && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => onDelete(selectedAnchor)}
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Slet
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={onCancel}
                >
                    Annuller
                </Button>
                <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleSave}
                    disabled={!text.trim()}
                >
                    <Save className="w-3 h-3 mr-1" />
                    Gem
                </Button>
            </div>
        </div>
    );
}
