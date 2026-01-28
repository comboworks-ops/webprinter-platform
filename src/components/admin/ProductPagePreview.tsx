import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronDown, Truck, CreditCard, ShoppingCart } from "lucide-react";

// Define anchor zones that can have tooltips
export interface AnchorZone {
    id: string;
    label: string;
    labelDa: string;
}

export const ANCHOR_ZONES: AnchorZone[] = [
    { id: 'product_title', label: 'Product Title', labelDa: 'Produktnavn' },
    { id: 'format_selector', label: 'Format Selector', labelDa: 'Format/Størrelse' },
    { id: 'material_selector', label: 'Material Selector', labelDa: 'Materiale' },
    { id: 'quantity_input', label: 'Quantity Input', labelDa: 'Antal/Oplag' },
    { id: 'price_matrix', label: 'Price Matrix', labelDa: 'Prismatrix' },
    { id: 'price_display', label: 'Price Calculator', labelDa: 'Prisberegner' },
    { id: 'delivery_section', label: 'Delivery Options', labelDa: 'Levering' },
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

interface ProductPagePreviewProps {
    productName?: string;
    productImage?: string;
    formats?: { id: string; label: string }[];
    materials?: { id: string; label: string }[];
    quantities?: number[];
    tooltips?: TooltipConfig[];
    selectedAnchor?: string | null;
    onAnchorClick?: (anchorId: string) => void;
    onAnchorHover?: (anchorId: string | null) => void;
    hoveredAnchor?: string | null;
    isEditMode?: boolean;
}

export function ProductPagePreview({
    productName = "Produktnavn",
    productImage,
    formats = [{ id: 'A4', label: 'A4' }, { id: 'A5', label: 'A5' }, { id: 'A6', label: 'A6' }],
    materials = [{ id: 'silk', label: '170g Silk' }, { id: 'matt', label: '170g Mat' }],
    quantities = [100, 250, 500, 1000],
    tooltips = [],
    selectedAnchor,
    onAnchorClick,
    onAnchorHover,
    hoveredAnchor,
    isEditMode = true
}: ProductPagePreviewProps) {

    // Helper to check if an anchor has a tooltip
    const getTooltipForAnchor = (anchorId: string) => tooltips.find(t => t.anchor === anchorId);

    // Helper to get tooltip icon component
    const getTooltipIcon = (config: TooltipConfig) => {
        const iconClass = `w-4 h-4 text-white`;
        switch (config.icon) {
            case 'question': return <span className={iconClass}>?</span>;
            case 'lightbulb': return <span className={iconClass}>💡</span>;
            case 'star': return <span className={iconClass}>★</span>;
            default: return <span className={iconClass}>i</span>;
        }
    };

    // Render anchor zone wrapper
    const AnchorZone: React.FC<{
        anchorId: string;
        children: React.ReactNode;
        className?: string;
    }> = ({ anchorId, children, className = "" }) => {
        const isHovered = hoveredAnchor === anchorId;
        const isSelected = selectedAnchor === anchorId;
        const tooltip = getTooltipForAnchor(anchorId);
        const zone = ANCHOR_ZONES.find(z => z.id === anchorId);

        return (
            <div
                className={`relative group ${className} ${isEditMode ? 'cursor-pointer' : ''}`}
                onClick={() => isEditMode && onAnchorClick?.(anchorId)}
                onMouseEnter={() => isEditMode && onAnchorHover?.(anchorId)}
                onMouseLeave={() => isEditMode && onAnchorHover?.(null)}
            >
                {/* Highlight overlay when hovered/selected in edit mode */}
                {isEditMode && (isHovered || isSelected) && (
                    <div
                        className={`absolute inset-0 rounded-lg border-2 pointer-events-none z-10 transition-all ${isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-primary/50 bg-primary/5'
                            }`}
                    />
                )}

                {/* Anchor label on hover */}
                {isEditMode && isHovered && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md whitespace-nowrap z-20 shadow-lg">
                        {zone?.labelDa || anchorId}
                    </div>
                )}

                {/* Tooltip indicator */}
                {tooltip && (
                    <div
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-20 shadow-md"
                        style={{ backgroundColor: tooltip.color }}
                    >
                        {getTooltipIcon(tooltip)}
                    </div>
                )}

                {children}
            </div>
        );
    };

    return (
        <div className="w-full max-w-[500px] mx-auto bg-white dark:bg-gray-900 rounded-xl border shadow-lg overflow-hidden">
            {/* Preview Header */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Produktside Preview
                </span>
            </div>

            <div className="p-4 space-y-4">
                {/* Product Title & Image */}
                <div className="flex gap-4">
                    <AnchorZone anchorId="product_title" className="flex-1">
                        <h2 className="text-lg font-bold">{productName}</h2>
                        <p className="text-xs text-muted-foreground">Kort produktbeskrivelse her...</p>
                    </AnchorZone>
                    {productImage && (
                        <img src={productImage} alt={productName} className="w-16 h-16 object-contain" />
                    )}
                </div>

                {/* Format Selector */}
                <AnchorZone anchorId="format_selector">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Format</label>
                        <div className="flex gap-1 flex-wrap">
                            {formats.slice(0, 4).map((f, i) => (
                                <div
                                    key={f.id}
                                    className={`px-2 py-1 text-xs rounded border ${i === 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                >
                                    {f.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </AnchorZone>

                {/* Material Selector */}
                <AnchorZone anchorId="material_selector">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Materiale</label>
                        <div className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-gray-50 dark:bg-gray-800">
                            <span className="text-xs flex-1">{materials[0]?.label || 'Vælg materiale'}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </div>
                    </div>
                </AnchorZone>

                {/* Price Matrix */}
                <AnchorZone anchorId="price_matrix">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Prismatrix</label>
                        <div className="grid grid-cols-4 gap-1 text-[10px]">
                            {quantities.slice(0, 4).map((qty, i) => (
                                <div
                                    key={qty}
                                    className={`text-center py-1.5 rounded border ${i === 1 ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                >
                                    <div className="font-semibold">{qty}</div>
                                    <div className="text-muted-foreground">{(qty * 0.5 + 100).toFixed(0)} kr</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </AnchorZone>

                {/* Quantity Input */}
                <AnchorZone anchorId="quantity_input">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Antal</label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 border rounded-md px-2 py-1 bg-gray-50 dark:bg-gray-800 text-xs">
                                500
                            </div>
                            <span className="text-xs text-muted-foreground">stk</span>
                        </div>
                    </div>
                </AnchorZone>

                {/* Price Display / Calculator */}
                <AnchorZone anchorId="price_display">
                    <Card className="border-2">
                        <CardContent className="p-3 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Subtotal</span>
                                <span className="text-sm font-semibold">449,00 kr</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Moms (25%)</span>
                                <span className="text-sm">112,25 kr</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between items-center">
                                <span className="text-sm font-bold">Total</span>
                                <span className="text-lg font-bold text-primary">561,25 kr</span>
                            </div>
                        </CardContent>
                    </Card>
                </AnchorZone>

                {/* Delivery Section */}
                <AnchorZone anchorId="delivery_section">
                    <div className="space-y-1">
                        <label className="text-xs font-medium flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            Levering
                        </label>
                        <div className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-gray-50 dark:bg-gray-800">
                            <span className="text-xs flex-1">Standard levering (3-5 dage)</span>
                            <span className="text-xs font-medium">49 kr</span>
                        </div>
                    </div>
                </AnchorZone>

                {/* Checkout Button */}
                <AnchorZone anchorId="checkout_button">
                    <Button className="w-full" disabled>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Til bestilling
                    </Button>
                </AnchorZone>
            </div>
        </div>
    );
}
