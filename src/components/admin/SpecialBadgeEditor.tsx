/**
 * SpecialBadgeEditor - Admin UI for configuring the special badge on product cards
 *
 * Allows configuration of:
 * - Enable/disable badge
 * - Badge text (e.g., "Tilbud", "Nyhed", "Bestseller")
 * - Animation effect (bounce, spin-fade, pulse)
 * - Background color
 * - Text color
 */

import { WorkspaceImageInput } from "./WorkspaceImageInput";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Sparkles, RotateCw, Zap, Circle } from "lucide-react";
import { ProductBadge, type ProductBadgeConfig, type BadgeAnimation } from "@/components/ProductBadge";

interface SpecialBadgeEditorProps {
    tenantId?: string;
    productId?: string;
    value: ProductBadgeConfig | undefined;
    onChange: (config: ProductBadgeConfig) => void;
}

const DEFAULT_CONFIG: ProductBadgeConfig = {
    enabled: false,
    text: "Tilbud",
    animation: "bounce",
    bgColor: "hsl(var(--primary))",
    textColor: "#FFFFFF",
};

const ANIMATION_OPTIONS: { value: BadgeAnimation; label: string; icon: React.ReactNode; description: string }[] = [
    {value: "none", label: "Ingen", icon: <Circle className="h-4 w-4" />, description: "Står stille"},
    {value: "spin", label: "Rotation", icon: <RotateCw className="h-4 w-4" />, description: "Drejer kontinuerligt"},
    {value: "float", label: "Svæv", icon: <Sparkles className="h-4 w-4" />, description: "Svæver roligt"},
    {
        value: "bounce",
        label: "Bounce",
        icon: <Zap className="h-4 w-4" />,
        description: "Hopper op og ned kontinuerligt",
    },
    {
        value: "spin-fade",
        label: "Spin & Fade In",
        icon: <RotateCw className="h-4 w-4" />,
        description: "Roterer ind og fader - så forbliver den",
    },
    {
        value: "pulse",
        label: "Pulse",
        icon: <Circle className="h-4 w-4" />,
        description: "Blød pulserende glødeeffekt",
    },
];

const PRESET_TEXTS = ["Tilbud", "Nyhed", "Bestseller", "Populær", "-20%", "Gratis fragt"];

export function SpecialBadgeEditor({ value, onChange, tenantId, productId }: SpecialBadgeEditorProps) {
    const [config, setConfig] = useState<ProductBadgeConfig>(value || DEFAULT_CONFIG);

    // Sync with parent when value changes
    useEffect(() => {
        if (value) {
            setConfig(value);
        }
    }, [value]);

    const updateConfig = (updates: Partial<ProductBadgeConfig>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        onChange(newConfig);
    };

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        <CardTitle className="text-base">Special Badge</CardTitle>
                    </div>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={(enabled) => updateConfig({ enabled })}
                    />
                </div>
                <CardDescription className="text-xs">
                    Tilføj en animeret badge i hjørnet af produktkortet
                </CardDescription>
            </CardHeader>

            {config.enabled && (
                <CardContent className="space-y-4">
                    {/* Live Preview */}
                    <div className="relative bg-muted/50 rounded-lg p-8 flex items-center justify-center min-h-[100px]">
                        <div className="relative w-24 h-24 bg-card border rounded-lg shadow-sm">
                            <ProductBadge config={config} />
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                                Preview
                            </div>
                        </div>
                    </div>

                    {tenantId && productId && <WorkspaceImageInput label="Eget badge-billede (PNG, JPG eller WebP)" value={config.imageUrl || ''} tenantId={tenantId} productId={productId} onChange={imageUrl => updateConfig({imageUrl})} />}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm">Størrelse (px)<Input type="number" min={32} max={160} value={config.size || 64} onChange={e => updateConfig({size:Number(e.target.value)})}/></label>
                      <label className="text-sm">Varighed (sekunder)<Input type="number" min={1} max={20} value={config.duration || 4} onChange={e => updateConfig({duration:Number(e.target.value)})}/></label>
                      <label className="text-sm">Placering<select className="block w-full rounded border p-2" value={config.position || 'top-left'} onChange={e => updateConfig({position:e.target.value as ProductBadgeConfig['position']})}>{[['top-left','Øverst til venstre'],['top-right','Øverst til højre'],['bottom-left','Nederst til venstre'],['bottom-right','Nederst til højre']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
                    </div>
                    {/* Badge Text */}
                    <div className="space-y-2">
                        <Label>Badge tekst</Label>
                        <Input
                            value={config.text}
                            onChange={(e) => updateConfig({ text: e.target.value })}
                            placeholder="f.eks. Tilbud, Nyhed..."
                            maxLength={15}
                        />
                        <div className="flex flex-wrap gap-1 mt-1">
                            {PRESET_TEXTS.map((preset) => (
                                <Button
                                    key={preset}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => updateConfig({ text: preset })}
                                >
                                    {preset}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Animation Effect */}
                    <div className="space-y-2">
                        <Label>Animation effekt</Label>
                        <Select
                            value={config.animation}
                            onValueChange={(animation: BadgeAnimation) => updateConfig({ animation })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ANIMATION_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                            {option.icon}
                                            <div>
                                                <div className="font-medium">{option.label}</div>
                                                <div className="text-xs text-muted-foreground">{option.description}</div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Show on Hover Toggle */}
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div className="space-y-0.5">
                            <Label htmlFor="hover-toggle" className="text-sm font-medium cursor-pointer">
                                Vis kun ved hover
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Badge vises kun når musen er over produktkortet
                            </p>
                        </div>
                        <Switch
                            id="hover-toggle"
                            checked={config.showOnHover || false}
                            onCheckedChange={(showOnHover) => updateConfig({ showOnHover })}
                        />
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Baggrundsfarve</Label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={config.bgColor?.startsWith('#') ? config.bgColor : '#0EA5E9'}
                                    onChange={(e) => updateConfig({ bgColor: e.target.value })}
                                    className="w-10 h-10 rounded cursor-pointer"
                                />
                                <Input
                                    value={config.bgColor || ''}
                                    onChange={(e) => updateConfig({ bgColor: e.target.value })}
                                    placeholder="#0EA5E9"
                                    className="flex-1"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Tekstfarve</Label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={config.textColor || '#FFFFFF'}
                                    onChange={(e) => updateConfig({ textColor: e.target.value })}
                                    className="w-10 h-10 rounded cursor-pointer"
                                />
                                <Input
                                    value={config.textColor || ''}
                                    onChange={(e) => updateConfig({ textColor: e.target.value })}
                                    placeholder="#FFFFFF"
                                    className="flex-1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Reset Button */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const reset = { ...DEFAULT_CONFIG, enabled: true };
                            setConfig(reset);
                            onChange(reset);
                        }}
                    >
                        Nulstil til standard
                    </Button>
                </CardContent>
            )}
        </Card>
    );
}

export default SpecialBadgeEditor;
