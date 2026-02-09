import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CenterSlider } from "@/components/ui/center-slider";
import { Calculator, Plus, Trash2, Wand2, AlertCircle, TrendingUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Feature flag for Phase 2 curve tool
const ENABLE_CURVE_TOOL = false;

interface AnchorPoint {
    quantity: number;
    price: number;
}

interface SmartPriceGeneratorProps {
    productId: string;
    productSlug: string;
    pricingType: string;
    tableName: string;
    existingPrices: any[];
    onPricesGenerated: () => void;
    formats?: { id: string; name: string }[];
    materials?: { id: string; name: string }[];
}

const PRESET_QUANTITIES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const ROUNDING_OPTIONS = [
    { value: 1, label: 'Nærmeste 1 kr' },
    { value: 5, label: 'Nærmeste 5 kr' },
    { value: 10, label: 'Nærmeste 10 kr' },
];

// Linear interpolation between anchor points
function interpolatePrice(quantity: number, anchors: AnchorPoint[]): number {
    if (anchors.length === 0) return 0;
    if (anchors.length === 1) return anchors[0].price;

    // Sort anchors by quantity
    const sorted = [...anchors].sort((a, b) => a.quantity - b.quantity);

    // Find surrounding anchors
    if (quantity <= sorted[0].quantity) return sorted[0].price;
    if (quantity >= sorted[sorted.length - 1].quantity) return sorted[sorted.length - 1].price;

    for (let i = 0; i < sorted.length - 1; i++) {
        if (quantity >= sorted[i].quantity && quantity <= sorted[i + 1].quantity) {
            const t = (quantity - sorted[i].quantity) / (sorted[i + 1].quantity - sorted[i].quantity);
            return sorted[i].price + t * (sorted[i + 1].price - sorted[i].price);
        }
    }

    return sorted[sorted.length - 1].price;
}

// Apply rounding
function roundPrice(price: number, rounding: number): number {
    return Math.round(price / rounding) * rounding;
}

export function SmartPriceGenerator({
    productId,
    productSlug,
    pricingType,
    tableName,
    existingPrices,
    onPricesGenerated,
    formats = [],
    materials = []
}: SmartPriceGeneratorProps) {
    // State
    const [selectedQuantities, setSelectedQuantities] = useState<number[]>([]);
    const [customQuantity, setCustomQuantity] = useState('');
    const [anchors, setAnchors] = useState<AnchorPoint[]>([
        { quantity: 100, price: 199 },
        { quantity: 1000, price: 599 }
    ]);
    const [rounding, setRounding] = useState(5);
    const [markup, setMarkup] = useState(0);
    const [overwriteExisting, setOverwriteExisting] = useState(false);
    const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
    const [generating, setGenerating] = useState(false);
    const [previewFormat, setPreviewFormat] = useState<string>('');
    const [previewMaterial, setPreviewMaterial] = useState<string>('');

    const isMatrixMode = pricingType === 'matrix' || !pricingType;
    const hasFormatsOrMaterials = formats.length > 0 || materials.length > 0;

    // Generate preview prices
    const previewPrices = useMemo(() => {
        return selectedQuantities.map(qty => {
            let price = interpolatePrice(qty, anchors);
            price = price * (1 + markup / 100);
            price = roundPrice(price, rounding);
            return { quantity: qty, price };
        });
    }, [selectedQuantities, anchors, markup, rounding]);

    // Handle adding preset quantity
    const toggleQuantity = (qty: number) => {
        setSelectedQuantities(prev =>
            prev.includes(qty)
                ? prev.filter(q => q !== qty)
                : [...prev, qty].sort((a, b) => a - b)
        );
    };

    // Handle custom quantity
    const addCustomQuantity = () => {
        const qty = parseInt(customQuantity);
        if (qty > 0 && !selectedQuantities.includes(qty)) {
            setSelectedQuantities(prev => [...prev, qty].sort((a, b) => a - b));
            setCustomQuantity('');
        }
    };

    // Handle anchor management
    const addAnchor = () => {
        if (anchors.length < 5) {
            const lastQty = anchors.length > 0 ? anchors[anchors.length - 1].quantity : 0;
            setAnchors([...anchors, { quantity: lastQty + 500, price: 0 }]);
        }
    };

    const removeAnchor = (index: number) => {
        if (anchors.length > 2) {
            setAnchors(anchors.filter((_, i) => i !== index));
        }
    };

    const updateAnchor = (index: number, field: 'quantity' | 'price', value: number) => {
        const updated = [...anchors];
        updated[index][field] = value;
        setAnchors(updated);
    };

    // Generate prices
    const handleGenerate = async () => {
        if (selectedQuantities.length === 0) {
            toast.error('Vælg mindst ét oplag');
            return;
        }
        if (anchors.length < 2) {
            toast.error('Definer mindst 2 ankerpunkter');
            return;
        }

        try {
            setGenerating(true);
            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            // For each selected quantity
            for (const qty of selectedQuantities) {
                let price = interpolatePrice(qty, anchors);
                price = price * (1 + markup / 100);
                price = roundPrice(price, rounding);

                // Check if price exists
                const existing = existingPrices.find(p => p.quantity === qty);

                if (existing) {
                    if (overwriteExisting) {
                        // Update existing
                        const { error } = await supabase
                            .from(tableName as any)
                            .update({ price_dkk: price })
                            .eq('id', existing.id);
                        if (error) throw error;
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    // Insert new - use generic pricing structure
                    const insertData: any = {
                        product_id: productId,
                        quantity: qty,
                        price_dkk: price,
                        variant_name: 'Standard',
                        variant_value: `${qty} stk`
                    };

                    const { error } = await supabase
                        .from(tableName as any)
                        .insert(insertData);
                    if (error) throw error;
                    inserted++;
                }
            }

            toast.success(`Priser genereret: ${inserted} nye, ${updated} opdateret, ${skipped} sprunget over`);
            onPricesGenerated();
        } catch (error: any) {
            console.error('Generate error:', error);
            toast.error(error.message || 'Kunne ikke generere priser');
        } finally {
            setGenerating(false);
        }
    };

    if (!isMatrixMode) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-8">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <Lock className="h-5 w-5" />
                        <div>
                            <p className="font-medium">Smart prisgenerator kræver Matrix-prissætning</p>
                            <p className="text-sm">Skift til "Fast format (Matrix)" under Pris metode for at aktivere denne funktion.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Main Generator Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5" />
                        Smart prisgenerator
                    </CardTitle>
                    <CardDescription>
                        Generer priser automatisk baseret på ankerpunkter og linear interpolation
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Quantity Ladder */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Oplag (mængder)</Label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_QUANTITIES.map(qty => (
                                <button
                                    key={qty}
                                    onClick={() => toggleQuantity(qty)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                        selectedQuantities.includes(qty)
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    )}
                                >
                                    {qty.toLocaleString()}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 max-w-xs">
                            <Input
                                type="number"
                                placeholder="Brugerdefineret oplag"
                                value={customQuantity}
                                onChange={(e) => setCustomQuantity(e.target.value)}
                                className="h-9"
                            />
                            <Button size="sm" variant="outline" onClick={addCustomQuantity}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {selectedQuantities.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Valgt: {selectedQuantities.map(q => q.toLocaleString()).join(', ')}
                            </p>
                        )}
                    </div>

                    {/* Anchor Points */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Ankerpunkter (2-5)</Label>
                            <Button size="sm" variant="outline" onClick={addAnchor} disabled={anchors.length >= 5}>
                                <Plus className="h-4 w-4 mr-1" /> Tilføj
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {anchors.map((anchor, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={anchor.quantity}
                                                onChange={(e) => updateAnchor(i, 'quantity', parseInt(e.target.value) || 0)}
                                                className="pr-12"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">stk</span>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={anchor.price}
                                                onChange={(e) => updateAnchor(i, 'price', parseFloat(e.target.value) || 0)}
                                                className="pr-10"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kr</span>
                                        </div>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => removeAnchor(i)}
                                        disabled={anchors.length <= 2}
                                        className="h-9 w-9"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Afrunding</Label>
                            <Select value={String(rounding)} onValueChange={(v) => setRounding(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROUNDING_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Avance markup (%)</Label>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">-100%</span>
                                <CenterSlider
                                    value={[markup]}
                                    onValueChange={([v]) => setMarkup(v)}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    className="flex-1"
                                />
                                <span className="text-xs text-muted-foreground">+100%</span>
                                <span className="text-sm font-medium w-16 text-right">
                                    {markup > 0 ? "+" : ""}{markup}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Overwrite Option */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Checkbox
                            id="overwrite"
                            checked={overwriteExisting}
                            onCheckedChange={(c) => setOverwriteExisting(c as boolean)}
                        />
                        <div>
                            <Label htmlFor="overwrite" className="text-sm font-medium cursor-pointer">
                                Overskriv eksisterende priser
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {overwriteExisting
                                    ? 'Eksisterende priser vil blive overskrevet'
                                    : 'Kun tomme felter udfyldes (anbefalet)'}
                            </p>
                        </div>
                    </div>

                    {/* Preview */}
                    {selectedQuantities.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Forhåndsvisning</Label>
                            <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg">
                                {previewPrices.slice(0, 8).map(({ quantity, price }) => (
                                    <div key={quantity} className="text-center">
                                        <p className="text-xs text-muted-foreground">{quantity.toLocaleString()} stk</p>
                                        <p className="font-medium">{price.toLocaleString()} kr</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={generating || selectedQuantities.length === 0}
                        className="w-full"
                    >
                        {generating ? (
                            <>Genererer...</>
                        ) : (
                            <>
                                <Calculator className="mr-2 h-4 w-4" />
                                Generér priser ({selectedQuantities.length} oplag)
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Phase 2: Curve Tool Shell */}
            {ENABLE_CURVE_TOOL ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Kurve justering
                        </CardTitle>
                        <CardDescription>
                            Juster priskurven ved at trække ankerpunkter
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Curve editor would go here */}
                        <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center">
                            <p className="text-muted-foreground">Kurve editor kommer snart</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="py-6">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <TrendingUp className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Kurve justering</p>
                                <p className="text-sm">Kommer snart – juster priskurven visuelt</p>
                            </div>
                            <Badge variant="outline" className="ml-auto">Kommer snart</Badge>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
