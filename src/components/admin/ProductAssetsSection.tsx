import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Check, Lock, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconPackSelector, ICON_PACKS } from "./IconPackSelector";
import type { BrandingData } from "@/hooks/useBrandingDraft";
import type { PaidItemType } from "@/hooks/usePaidItems";
import { toast } from "sonner";
import flyersPng from "@/assets/products/flyers.png";

// Sample Product Image Sets
const PRODUCT_IMAGE_SETS = [
    {
        id: "default",
        name: "Studio Clean",
        description: "Rene studieoptagelser på hvid baggrund",
        price: 0,
        isPremium: false,
        previewImage: flyersPng,
    },
    {
        id: "lifestyle",
        name: "Lifestyle",
        description: "Produkter i naturlige omgivelser",
        price: 299,
        isPremium: true,
        previewImage: flyersPng, // Placeholder using same image
    },
    {
        id: "dark",
        name: "Dark Mode",
        description: "Elegant mørk stil til eksklusive brands",
        price: 299,
        isPremium: true,
        previewImage: flyersPng, // Placeholder using same image
    }
];

interface ProductAssetsSectionProps {
    draft: BrandingData;
    updateDraft: (updates: Partial<BrandingData>) => void;
    // Paid items callbacks (optional - only provided for tenants)
    onAddPaidItem?: (item: { type: PaidItemType; itemId: string; name: string; price: number }) => Promise<void>;
    isItemPurchased?: (type: PaidItemType, itemId: string) => boolean;
    isItemPending?: (type: PaidItemType, itemId: string) => boolean;
}

export function ProductAssetsSection({
    draft,
    updateDraft,
    onAddPaidItem,
    isItemPurchased,
    isItemPending,
}: ProductAssetsSectionProps) {
    const { productImages, selectedIconPackId } = draft;

    const handleFilterChange = (key: 'hueRotate' | 'saturate', value: number[]) => {
        if (!productImages) return;
        updateDraft({
            productImages: {
                ...productImages,
                [key]: value[0]
            }
        });
    };

    const handleSetChange = async (setId: string) => {
        if (!productImages) return;

        // Find the set
        const set = PRODUCT_IMAGE_SETS.find(s => s.id === setId);
        if (!set) return;

        // If it's a premium set and we have the paid items handler
        if (set.isPremium && set.price > 0 && onAddPaidItem) {
            const alreadyPurchased = isItemPurchased?.('icon_pack', `product-images-${set.id}`);

            if (!alreadyPurchased) {
                await onAddPaidItem({
                    type: 'icon_pack', // Using icon_pack type for product images too
                    itemId: `product-images-${set.id}`,
                    name: `Produktbilleder: ${set.name}`,
                    price: set.price,
                });
                toast.success(
                    `${set.name} valgt! ${set.price} kr tilføjet til kurv.`,
                    { duration: 4000 }
                );
            } else {
                toast.success(`${set.name} valgt! (Allerede købt)`);
            }
        }

        updateDraft({
            productImages: {
                ...productImages,
                setId
            }
        });
    };

    const handleIconPackChange = async (packId: string) => {
        // Find the pack
        const pack = ICON_PACKS.find(p => p.id === packId);
        if (!pack) return;

        // If it's a premium pack and we have the paid items handler
        if (pack.isPremium && pack.price && pack.price > 0 && onAddPaidItem) {
            const alreadyPurchased = isItemPurchased?.('icon_pack', `icon-pack-${pack.id}`);

            if (!alreadyPurchased) {
                await onAddPaidItem({
                    type: 'icon_pack',
                    itemId: `icon-pack-${pack.id}`,
                    name: `Ikon Pakke: ${pack.name}`,
                    price: pack.price,
                });
                toast.success(
                    `${pack.name} valgt! ${pack.price} kr tilføjet til kurv.`,
                    { duration: 4000 }
                );
            } else {
                toast.success(`${pack.name} valgt! (Allerede købt)`);
            }
        }

        updateDraft({ selectedIconPackId: packId });
    };

    // Safe values with defaults
    const hue = productImages?.hueRotate ?? 0;
    const saturation = productImages?.saturate ?? 100;

    return (
        <div className="space-y-8 px-4 pb-8">
            {/* 1. Product Image Sets */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Produktbilleder</h3>
                    <Badge variant="outline" className="gap-1">
                        <ImageIcon className="w-3 h-3" />
                        Beta
                    </Badge>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    {PRODUCT_IMAGE_SETS.map((set) => {
                        const isSelected = productImages?.setId === set.id;
                        return (
                            <div
                                key={set.id}
                                onClick={() => handleSetChange(set.id)}
                                className={cn(
                                    "relative group cursor-pointer rounded-xl border-2 overflow-hidden transition-all",
                                    isSelected
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-muted hover:border-primary/50"
                                )}
                            >
                                {/* Preview Image Container */}
                                <div className="aspect-video bg-muted relative overflow-hidden border-b">
                                    <img
                                        src={set.previewImage}
                                        alt={set.name}
                                        className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                                        style={{
                                            filter: isSelected ? `hue-rotate(${hue}deg) saturate(${saturation}%)` : 'none'
                                        }}
                                    />

                                    {/* Selection Check */}
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-100 transition-transform">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                    )}

                                    {/* Premium Badge */}
                                    {set.isPremium && (
                                        <Badge className="absolute top-2 left-2 bg-black/50 hover:bg-black/70 backdrop-blur border-white/20 text-white gap-1">
                                            <Lock className="w-3 h-3" />
                                            {set.price} DKK
                                        </Badge>
                                    )}
                                </div>

                                {/* Text Content */}
                                <div className="p-3 bg-card">
                                    <p className="font-semibold text-sm text-foreground">{set.name}</p>
                                    <p className="text-xs text-muted-foreground">{set.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 2. Color Filter Adjustment */}
            <Card className="border-primary/20 bg-primary/5 overflow-hidden">
                <CardHeader className="pb-3 border-b border-primary/10 bg-white/50 backdrop-blur-sm">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Farvetilpasning
                    </CardTitle>
                    <CardDescription>
                        Juster farvetonen på produktbilleder så de matcher dit brand.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="hue-slider">Farvetone (Hue)</Label>
                            <span className="text-xs font-mono text-muted-foreground">{hue}°</span>
                        </div>
                        <Slider
                            id="hue-slider"
                            min={0}
                            max={360}
                            step={1}
                            value={[hue]}
                            onValueChange={(val) => handleFilterChange('hueRotate', val)}
                            className="[&>.relative>.absolute]:bg-gradient-to-r [&>.relative>.absolute]:from-red-500 [&>.relative>.absolute]:via-green-500 [&>.relative>.absolute]:to-blue-500"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="saturate-slider">Farvemætning (Saturation)</Label>
                            <span className="text-xs font-mono text-muted-foreground">{saturation}%</span>
                        </div>
                        <Slider
                            id="saturate-slider"
                            min={0}
                            max={200}
                            step={5}
                            value={[saturation]}
                            onValueChange={(val) => handleFilterChange('saturate', val)}
                        />
                    </div>

                    <div className="p-3 bg-white rounded-lg border text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">Bemærk:</span> Disse justeringer påvirker alle produktbilleder i det valgte sæt, men ændrer ikke selve originalfilerne.
                    </div>
                </CardContent>
            </Card>

            {/* 3. Icon Packs */}
            <div className="space-y-4 pt-4 border-t">
                <IconPackSelector
                    selectedPackId={selectedIconPackId}
                    onChange={handleIconPackChange}
                />
            </div>
        </div>
    );
}
