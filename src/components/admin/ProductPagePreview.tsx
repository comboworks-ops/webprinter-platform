import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, Truck, ShoppingCart, Clock, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Define anchor zones that can have tooltips - now includes dynamic IDs
export interface AnchorZone {
    id: string;
    label: string;
    labelDa: string;
}

// Base anchor zones
export const BASE_ANCHOR_ZONES: AnchorZone[] = [
    { id: 'product_title', label: 'Product Title', labelDa: 'Produktnavn' },
    { id: 'format_selector', label: 'Format Selector', labelDa: 'Format/Størrelse' },
    { id: 'material_selector', label: 'Material Selector', labelDa: 'Materiale' },
    { id: 'quantity_row', label: 'Quantity Row', labelDa: 'Antal-række' },
    { id: 'price_matrix', label: 'Price Matrix', labelDa: 'Prismatrix' },
    { id: 'price_display', label: 'Price Calculator', labelDa: 'Prisberegner' },
    { id: 'delivery_section', label: 'Delivery Options', labelDa: 'Leveringsmuligheder' },
    { id: 'checkout_button', label: 'Checkout Button', labelDa: 'Til bestilling' },
];

export interface TooltipConfig {
    anchor: string;
    icon: 'info' | 'question' | 'lightbulb' | 'star';
    color: string;
    animation: 'fade' | 'slide' | 'bounce';
    text: string;
    link?: string;
}

interface DeliveryOption {
    id: string;
    name: string;
    price: number;
    lead_time_days?: number;
}

interface PriceMatrixRow {
    id: string;
    name: string;
    prices: { qty: number; price: number }[];
}

interface ProductPagePreviewProps {
    productId: string;
    productName?: string;
    productImage?: string;
    tooltips?: TooltipConfig[];
    selectedAnchor?: string | null;
    onAnchorClick?: (anchorId: string) => void;
    onAnchorHover?: (anchorId: string | null) => void;
    hoveredAnchor?: string | null;
    isEditMode?: boolean;
    onAnchorsLoaded?: (anchors: AnchorZone[]) => void;
}

export function ProductPagePreview({
    productId,
    productName = "Produktnavn",
    productImage,
    tooltips = [],
    selectedAnchor,
    onAnchorClick,
    onAnchorHover,
    hoveredAnchor,
    isEditMode = true,
    onAnchorsLoaded
}: ProductPagePreviewProps) {
    // State for loaded product data
    const [formats, setFormats] = useState<{ id: string; label: string }[]>([]);
    const [materials, setMaterials] = useState<{ id: string; label: string }[]>([]);
    const [quantities, setQuantities] = useState<number[]>([100, 250, 500, 1000]);
    const [priceMatrix, setPriceMatrix] = useState<PriceMatrixRow[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Load product data
    useEffect(() => {
        if (!productId) return;

        const loadProductData = async () => {
            setLoading(true);

            try {
                // Load product with pricing structure
                const { data: product } = await supabase
                    .from('products' as any)
                    .select('*, banner_config')
                    .eq('id', productId)
                    .single();

                if (!product) return;

                // Load attribute values (formats, materials)
                const { data: attributes } = await supabase
                    .from('product_attributes' as any)
                    .select('*, values:product_attribute_values(*)')
                    .eq('product_id', productId)
                    .order('display_order');

                const loadedFormats: { id: string; label: string }[] = [];
                const loadedMaterials: { id: string; label: string }[] = [];

                (attributes || []).forEach((attr: any) => {
                    const typeLower = attr.type?.toLowerCase() || '';
                    const values = (attr.values || []).map((v: any) => ({ id: v.id, label: v.name }));

                    if (typeLower.includes('format') || typeLower.includes('size')) {
                        loadedFormats.push(...values);
                    } else if (typeLower.includes('material') || typeLower.includes('papir')) {
                        loadedMaterials.push(...values);
                    }
                });

                setFormats(loadedFormats.length > 0 ? loadedFormats : [
                    { id: 'A4', label: 'A4' },
                    { id: 'A5', label: 'A5' },
                    { id: 'A6', label: 'A6' }
                ]);
                setMaterials(loadedMaterials.length > 0 ? loadedMaterials : [
                    { id: 'silk', label: '170g Silk' },
                    { id: 'matt', label: '170g Mat' }
                ]);

                // Load pricing structure for quantities
                const pricingStructure = (product as any).pricing_structure;
                if (pricingStructure?.quantities) {
                    setQuantities(pricingStructure.quantities);
                }

                // Build price matrix
                const matrixRows: PriceMatrixRow[] = loadedMaterials.slice(0, 5).map(m => ({
                    id: m.id,
                    name: m.label,
                    prices: (pricingStructure?.quantities || [100, 250, 500, 1000]).slice(0, 5).map((qty: number) => ({
                        qty,
                        price: Math.round(qty * 0.5 + 100 + Math.random() * 50)
                    }))
                }));
                setPriceMatrix(matrixRows);

                // Load delivery options
                const orderDeliveryConfig = (product as any).order_delivery_config;
                const deliveryMethods = orderDeliveryConfig?.delivery?.methods || [];
                setDeliveryOptions(deliveryMethods.length > 0 ? deliveryMethods.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    price: m.price || 0,
                    lead_time_days: m.lead_time_days
                })) : [
                    { id: 'standard', name: 'Standard levering', price: 49, lead_time_days: 5 },
                    { id: 'express', name: 'Express levering', price: 99, lead_time_days: 2 }
                ]);

            } catch (error) {
                console.error('Error loading product data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProductData();
    }, [productId]);

    // Compute all available anchor zones (base + dynamic)
    const allAnchorZones = useMemo(() => {
        const zones = [...BASE_ANCHOR_ZONES];

        // Add material-specific anchors
        materials.forEach(m => {
            zones.push({ id: `material_${m.id}`, label: `Material: ${m.label}`, labelDa: `Materiale: ${m.label}` });
        });

        // Add format-specific anchors
        formats.forEach(f => {
            zones.push({ id: `format_${f.id}`, label: `Format: ${f.label}`, labelDa: `Format: ${f.label}` });
        });

        // Add delivery-specific anchors
        deliveryOptions.forEach(d => {
            zones.push({ id: `delivery_${d.id}`, label: `Delivery: ${d.name}`, labelDa: `Levering: ${d.name}` });
        });

        return zones;
    }, [materials, formats, deliveryOptions]);

    // Report anchors to parent
    useEffect(() => {
        onAnchorsLoaded?.(allAnchorZones);
    }, [allAnchorZones, onAnchorsLoaded]);

    // Helper to check if an anchor has a tooltip
    const getTooltipForAnchor = (anchorId: string) => tooltips.find(t => t.anchor === anchorId);

    // Helper to get tooltip icon
    const getTooltipIcon = (config: TooltipConfig) => {
        switch (config.icon) {
            case 'question': return '?';
            case 'lightbulb': return '💡';
            case 'star': return '★';
            default: return 'i';
        }
    };

    // Render anchor zone wrapper
    const AnchorZone: React.FC<{
        anchorId: string;
        children: React.ReactNode;
        className?: string;
        inline?: boolean;
    }> = ({ anchorId, children, className = "", inline = false }) => {
        const isHovered = hoveredAnchor === anchorId;
        const isSelected = selectedAnchor === anchorId;
        const tooltip = getTooltipForAnchor(anchorId);
        const zone = allAnchorZones.find(z => z.id === anchorId);

        const Tag = inline ? 'span' : 'div';

        return (
            <Tag
                className={`relative group ${className} ${isEditMode ? 'cursor-pointer' : ''} ${inline ? 'inline-flex' : ''}`}
                onClick={(e) => {
                    if (isEditMode) {
                        e.stopPropagation();
                        onAnchorClick?.(anchorId);
                    }
                }}
                onMouseEnter={() => isEditMode && onAnchorHover?.(anchorId)}
                onMouseLeave={() => isEditMode && onAnchorHover?.(null)}
            >
                {/* Highlight overlay */}
                {isEditMode && (isHovered || isSelected) && (
                    <span
                        className={`absolute inset-0 rounded border-2 pointer-events-none z-10 transition-all ${isSelected ? 'border-primary bg-primary/20' : 'border-primary/50 bg-primary/10'
                            }`}
                    />
                )}

                {/* Anchor label on hover */}
                {isEditMode && isHovered && (
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-30 shadow-lg">
                        {zone?.labelDa || anchorId}
                    </span>
                )}

                {/* Tooltip indicator */}
                {tooltip && (
                    <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold z-20 shadow text-white"
                        style={{ backgroundColor: tooltip.color }}
                    >
                        {getTooltipIcon(tooltip)}
                    </span>
                )}

                {children}
            </Tag>
        );
    };

    if (loading) {
        return (
            <div className="w-full bg-white dark:bg-gray-900 rounded-xl border shadow-lg p-8 flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl border shadow-lg overflow-hidden">
            {/* Preview Header */}
            <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 border-b flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Produktside Preview
                </span>
                <span className="text-[10px] text-muted-foreground">
                    {allAnchorZones.length} anchor points
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
                {/* Left Column: Product Options */}
                <div className="lg:col-span-2 space-y-3">
                    {/* Product Title */}
                    <AnchorZone anchorId="product_title">
                        <div className="flex gap-3 items-start">
                            <div className="flex-1">
                                <h2 className="text-sm font-bold">{productName}</h2>
                                <p className="text-[10px] text-muted-foreground">Produktbeskrivelse...</p>
                            </div>
                            {productImage && (
                                <img src={productImage} alt="" className="w-12 h-12 object-contain rounded" />
                            )}
                        </div>
                    </AnchorZone>

                    {/* Format Selector */}
                    <AnchorZone anchorId="format_selector">
                        <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground">FORMAT</label>
                            <div className="flex gap-1 flex-wrap">
                                {formats.slice(0, 6).map((f, i) => (
                                    <AnchorZone key={f.id} anchorId={`format_${f.id}`} inline>
                                        <span
                                            className={`px-2 py-1 text-[10px] rounded border transition-colors ${i === 0
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary/50'
                                                }`}
                                        >
                                            {f.label}
                                        </span>
                                    </AnchorZone>
                                ))}
                            </div>
                        </div>
                    </AnchorZone>

                    {/* Price Matrix with Materials */}
                    <AnchorZone anchorId="price_matrix">
                        <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground">PRISMATRIX</label>
                            <div className="border rounded-lg overflow-hidden">
                                {/* Header Row - Quantities */}
                                <AnchorZone anchorId="quantity_row">
                                    <div className="grid bg-gray-50 dark:bg-gray-800 border-b" style={{ gridTemplateColumns: `100px repeat(${Math.min(quantities.length, 5)}, 1fr)` }}>
                                        <div className="px-2 py-1 text-[9px] font-medium text-muted-foreground">Materiale</div>
                                        {quantities.slice(0, 5).map(qty => (
                                            <div key={qty} className="px-1 py-1 text-center text-[9px] font-medium text-muted-foreground border-l">
                                                {qty} stk
                                            </div>
                                        ))}
                                    </div>
                                </AnchorZone>

                                {/* Material Rows */}
                                {priceMatrix.map((row, rowIdx) => (
                                    <AnchorZone key={row.id} anchorId={`material_${row.id}`}>
                                        <div
                                            className={`grid border-b last:border-b-0 ${rowIdx === 0 ? 'bg-primary/5' : ''}`}
                                            style={{ gridTemplateColumns: `100px repeat(${Math.min(quantities.length, 5)}, 1fr)` }}
                                        >
                                            <div className="px-2 py-1.5 text-[10px] font-medium truncate">{row.name}</div>
                                            {row.prices.slice(0, 5).map((p, i) => (
                                                <div
                                                    key={p.qty}
                                                    className={`px-1 py-1.5 text-center text-[10px] border-l ${rowIdx === 0 && i === 1 ? 'bg-primary text-primary-foreground font-bold' : ''
                                                        }`}
                                                >
                                                    {p.price} kr
                                                </div>
                                            ))}
                                        </div>
                                    </AnchorZone>
                                ))}
                            </div>
                        </div>
                    </AnchorZone>

                    {/* Delivery Options */}
                    <AnchorZone anchorId="delivery_section">
                        <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                LEVERING
                            </label>
                            <div className="space-y-1">
                                {deliveryOptions.map((opt, i) => (
                                    <AnchorZone key={opt.id} anchorId={`delivery_${opt.id}`}>
                                        <div className={`flex items-center gap-2 border rounded px-2 py-1.5 ${i === 0 ? 'border-primary bg-primary/5' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                            <div className={`w-3 h-3 rounded-full border-2 ${i === 0 ? 'border-primary bg-primary' : 'border-gray-300'}`} />
                                            <div className="flex-1">
                                                <div className="text-[10px] font-medium">{opt.name}</div>
                                                {opt.lead_time_days && (
                                                    <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {opt.lead_time_days} hverdage
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-semibold">{opt.price} kr</span>
                                        </div>
                                    </AnchorZone>
                                ))}
                            </div>
                        </div>
                    </AnchorZone>
                </div>

                {/* Right Column: Prisberegner */}
                <div className="lg:col-span-1">
                    <AnchorZone anchorId="price_display">
                        <Card className="border-2 sticky top-3">
                            <CardContent className="p-3 space-y-2">
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    Prisberegner
                                </div>

                                <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Produkt</span>
                                        <span className="font-medium">449,00 kr</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Levering</span>
                                        <span className="font-medium">49,00 kr</span>
                                    </div>
                                </div>

                                <div className="border-t pt-2">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-medium">498,00 kr</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Moms (25%)</span>
                                        <span>124,50 kr</span>
                                    </div>
                                </div>

                                <div className="border-t pt-2 flex justify-between items-center">
                                    <span className="text-xs font-bold">Total inkl. moms</span>
                                    <span className="text-base font-bold text-primary">622,50 kr</span>
                                </div>

                                <AnchorZone anchorId="checkout_button" className="pt-1">
                                    <Button className="w-full h-8 text-xs" disabled>
                                        <ShoppingCart className="w-3 h-3 mr-1" />
                                        Til bestilling
                                    </Button>
                                </AnchorZone>
                            </CardContent>
                        </Card>
                    </AnchorZone>
                </div>
            </div>
        </div>
    );
}

// Export anchor zones helper
export const ANCHOR_ZONES = BASE_ANCHOR_ZONES;
