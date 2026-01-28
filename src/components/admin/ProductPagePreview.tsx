import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, Truck, ShoppingCart, Clock, Package, Info, HelpCircle, Lightbulb, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Anchor zone definition
export interface AnchorZone {
    id: string;
    label: string;
    labelDa: string;
}

// Base anchor zones (always available)
export const BASE_ANCHOR_ZONES: AnchorZone[] = [
    { id: 'product_title', label: 'Product Title', labelDa: 'Produktnavn' },
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

// Types from pricing_structure
interface VerticalAxisConfig {
    sectionId: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    title?: string;
}

interface LayoutColumn {
    id: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    ui_mode: string;
    title?: string;
}

interface LayoutRow {
    id: string;
    title?: string;
    columns: LayoutColumn[];
}

interface PricingStructure {
    mode: string;
    vertical_axis?: VerticalAxisConfig;
    layout_rows?: LayoutRow[];
    quantities?: number[];
}

interface AttributeValue {
    id: string;
    name: string;
    enabled: boolean;
}

interface AttributeGroup {
    id: string;
    name: string;
    kind: string;
    values: AttributeValue[];
}

interface DeliveryOption {
    id: string;
    name: string;
    price: number;
    lead_time_days?: number;
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
    const [pricingStructure, setPricingStructure] = useState<PricingStructure | null>(null);
    const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
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
                    .select('*')
                    .eq('id', productId)
                    .single();

                if (!product) {
                    setLoading(false);
                    return;
                }

                // Set pricing structure
                const ps = (product as any).pricing_structure;
                if (ps?.mode === 'matrix_layout_v1') {
                    setPricingStructure(ps);
                }

                // Load attribute groups with values
                const { data: groups } = await supabase
                    .from('product_attribute_groups' as any)
                    .select('*, values:product_attribute_values(*)')
                    .eq('product_id', productId)
                    .order('sort_order');

                if (groups) {
                    setAttributeGroups(groups as unknown as AttributeGroup[]);
                }

                // Load delivery options
                const orderDeliveryConfig = (product as any).order_delivery_config;
                const deliveryMethods = orderDeliveryConfig?.delivery?.methods || [];
                setDeliveryOptions(deliveryMethods.length > 0 ? deliveryMethods.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    price: m.price || 0,
                    lead_time_days: m.lead_time_days
                })) : [
                    { id: 'standard', name: 'Standard levering', price: 49, lead_time_days: 5 }
                ]);

            } catch (error) {
                console.error('Error loading product data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProductData();
    }, [productId]);

    // Get value name by ID
    const getValueName = useCallback((valueId: string): string => {
        for (const group of attributeGroups) {
            const val = group.values?.find(v => v.id === valueId);
            if (val) return val.name;
        }
        return valueId;
    }, [attributeGroups]);

    // Get values for a section by groupId and valueIds
    const getSectionValues = useCallback((groupId: string, valueIds: string[]): AttributeValue[] => {
        if (!valueIds || valueIds.length === 0) return [];
        const group = attributeGroups.find(g => g.id === groupId);
        if (group) {
            return group.values
                .filter(v => valueIds.includes(v.id) && v.enabled !== false)
                .sort((a, b) => valueIds.indexOf(a.id) - valueIds.indexOf(b.id));
        }
        return [];
    }, [attributeGroups]);

    // Compute all available anchor zones
    const allAnchorZones = useMemo(() => {
        const zones: AnchorZone[] = [...BASE_ANCHOR_ZONES];

        if (!pricingStructure) return zones;

        // Add layout_rows columns as anchor zones
        pricingStructure.layout_rows?.forEach((row, rowIdx) => {
            row.columns.forEach((col, colIdx) => {
                const sectionLabel = col.title || getSectionTypeLabel(col.sectionType);
                zones.push({
                    id: `section_${col.id}`,
                    label: `Section: ${sectionLabel}`,
                    labelDa: `Sektion: ${sectionLabel}`
                });

                // Add individual values as anchor zones
                const values = getSectionValues(col.groupId, col.valueIds);
                values.forEach(val => {
                    zones.push({
                        id: `value_${val.id}`,
                        label: `Value: ${val.name}`,
                        labelDa: `Værdi: ${val.name}`
                    });
                });
            });
        });

        // Add vertical axis values (materials)
        if (pricingStructure.vertical_axis) {
            const vertTitle = pricingStructure.vertical_axis.title || getSectionTypeLabel(pricingStructure.vertical_axis.sectionType);
            zones.push({
                id: `vertical_axis`,
                label: `Vertical Axis: ${vertTitle}`,
                labelDa: `Y-akse: ${vertTitle}`
            });

            pricingStructure.vertical_axis.valueIds.forEach(valId => {
                const name = getValueName(valId);
                zones.push({
                    id: `vertical_${valId}`,
                    label: `Material: ${name}`,
                    labelDa: `Materiale: ${name}`
                });
            });
        }

        // Add delivery options
        deliveryOptions.forEach(opt => {
            zones.push({
                id: `delivery_${opt.id}`,
                label: `Delivery: ${opt.name}`,
                labelDa: `Levering: ${opt.name}`
            });
        });

        return zones;
    }, [pricingStructure, attributeGroups, deliveryOptions, getValueName, getSectionValues]);

    // Report anchors to parent
    useEffect(() => {
        onAnchorsLoaded?.(allAnchorZones);
    }, [allAnchorZones, onAnchorsLoaded]);

    // Section type label helper
    function getSectionTypeLabel(sectionType: string): string {
        switch (sectionType) {
            case 'formats': return 'Format';
            case 'materials': return 'Materiale';
            case 'finishes': return 'Efterbehandling';
            case 'products': return 'Produkt';
            default: return 'Valgmulighed';
        }
    }

    // Tooltip helpers
    const getTooltipForAnchor = (anchorId: string) => tooltips.find(t => t.anchor === anchorId);

    const getTooltipIcon = (config: TooltipConfig) => {
        const Icon = config.icon === 'question' ? HelpCircle :
            config.icon === 'lightbulb' ? Lightbulb :
                config.icon === 'star' ? Star : Info;
        return <Icon className="w-3 h-3" />;
    };

    // Anchor zone wrapper component
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
                {isEditMode && (isHovered || isSelected) && (
                    <span
                        className={`absolute inset-0 rounded border-2 pointer-events-none z-10 transition-all ${isSelected ? 'border-primary bg-primary/20' : 'border-primary/50 bg-primary/10'
                            }`}
                    />
                )}

                {isEditMode && isHovered && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-30 shadow-lg">
                        {zone?.labelDa || anchorId}
                    </span>
                )}

                {tooltip && (
                    <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white z-20 shadow"
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
            <div className="w-full bg-white dark:bg-gray-900 rounded-xl border shadow-lg p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    const vertAxis = pricingStructure?.vertical_axis;
    const layoutRows = pricingStructure?.layout_rows || [];
    const quantities = pricingStructure?.quantities || [100, 250, 500, 1000];

    // Get vertical axis values (material rows)
    const verticalValues = vertAxis
        ? getSectionValues(vertAxis.groupId, vertAxis.valueIds)
        : [];

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

                    {/* Render layout_rows - these are the selectable sections */}
                    {layoutRows.map((row, rowIdx) => {
                        // Filter out columns that match vertical axis type (shown in matrix)
                        const visibleColumns = row.columns.filter(
                            col => !vertAxis || col.sectionType !== vertAxis.sectionType
                        );

                        if (visibleColumns.length === 0) return null;

                        return (
                            <div key={row.id} className="space-y-2 border-b pb-3 last:border-b-0">
                                {row.title && (
                                    <div className="text-[10px] font-medium text-muted-foreground">{row.title}</div>
                                )}
                                <div className="space-y-2">
                                    {visibleColumns.map((col, colIdx) => {
                                        const values = getSectionValues(col.groupId, col.valueIds);
                                        if (values.length === 0) return null;

                                        const sectionLabel = col.title || getSectionTypeLabel(col.sectionType);
                                        const uiMode = col.ui_mode || 'buttons';

                                        return (
                                            <AnchorZone key={col.id} anchorId={`section_${col.id}`}>
                                                <div className="space-y-1 p-2 bg-muted/20 rounded">
                                                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                                        {sectionLabel}
                                                    </label>

                                                    {/* Render values based on ui_mode */}
                                                    {uiMode === 'dropdown' ? (
                                                        <div className="flex items-center gap-2 border rounded px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-[10px]">
                                                            <span className="flex-1">{values[0]?.name || 'Vælg...'}</span>
                                                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {values.map((val, valIdx) => (
                                                                <AnchorZone key={val.id} anchorId={`value_${val.id}`} inline>
                                                                    <span
                                                                        className={`px-2 py-1 text-[10px] rounded border transition-colors ${valIdx === 0
                                                                                ? 'bg-primary text-primary-foreground border-primary'
                                                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                                                            }`}
                                                                    >
                                                                        {val.name}
                                                                    </span>
                                                                </AnchorZone>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </AnchorZone>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Price Matrix with Vertical Axis (Materials) */}
                    {verticalValues.length > 0 && (
                        <AnchorZone anchorId="price_matrix">
                            <div className="space-y-1">
                                <AnchorZone anchorId="vertical_axis">
                                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                        {vertAxis?.title || getSectionTypeLabel(vertAxis?.sectionType || 'materials')} / Pris
                                    </label>
                                </AnchorZone>
                                <div className="border rounded-lg overflow-hidden">
                                    {/* Header Row - Quantities */}
                                    <div
                                        className="grid bg-gray-50 dark:bg-gray-800 border-b"
                                        style={{ gridTemplateColumns: `120px repeat(${Math.min(quantities.length, 5)}, 1fr)` }}
                                    >
                                        <div className="px-2 py-1 text-[9px] font-medium text-muted-foreground">
                                            {vertAxis?.title || 'Materiale'}
                                        </div>
                                        {quantities.slice(0, 5).map(qty => (
                                            <div key={qty} className="px-1 py-1 text-center text-[9px] font-medium text-muted-foreground border-l">
                                                {qty} stk
                                            </div>
                                        ))}
                                    </div>

                                    {/* Material Rows */}
                                    {verticalValues.map((val, rowIdx) => (
                                        <AnchorZone key={val.id} anchorId={`vertical_${val.id}`}>
                                            <div
                                                className={`grid border-b last:border-b-0 ${rowIdx === 0 ? 'bg-primary/5' : ''}`}
                                                style={{ gridTemplateColumns: `120px repeat(${Math.min(quantities.length, 5)}, 1fr)` }}
                                            >
                                                <div className="px-2 py-1.5 text-[10px] font-medium truncate">{val.name}</div>
                                                {quantities.slice(0, 5).map((qty, colIdx) => {
                                                    const mockPrice = Math.round(qty * 0.4 + 80 + rowIdx * 20);
                                                    return (
                                                        <div
                                                            key={qty}
                                                            className={`px-1 py-1.5 text-center text-[10px] border-l ${rowIdx === 0 && colIdx === 1 ? 'bg-primary text-primary-foreground font-bold' : ''
                                                                }`}
                                                        >
                                                            {mockPrice} kr
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </AnchorZone>
                                    ))}
                                </div>
                            </div>
                        </AnchorZone>
                    )}

                    {/* Delivery Options */}
                    <AnchorZone anchorId="delivery_section">
                        <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                                <Truck className="w-3 h-3" />
                                Levering
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
