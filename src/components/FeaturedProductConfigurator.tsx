/**
 * Featured Product Quick Configurator
 *
 * Displays a featured product on the front page with:
 * - Product image and info (half-page width)
 * - Quantity preset buttons
 * - Option buttons with icons/photos when available
 * - Large blue price text with VAT disclaimer
 * - "Bestil nu" CTA button to full product page
 *
 * This component is READ-ONLY - it fetches existing data and displays it.
 * All actual business logic stays on the product page.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getProductImage } from "@/utils/productImages";
import { getGenericMatrixDataFromDB } from "@/utils/pricingDatabase";
import { cn } from "@/lib/utils";
import type { FeaturedProductConfig } from "@/hooks/useBrandingDraft";

interface FeaturedProductConfiguratorProps {
    config: FeaturedProductConfig;
    branding: any;
    className?: string;
}

interface ProductData {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
}

interface OptionGroup {
    id: string;
    name: string;
    label: string;
    display_type: string;
}

interface ProductOption {
    id: string;
    group_id: string;
    name: string;
    label: string;
    extra_price: number;
    price_mode: "fixed" | "per_quantity" | "per_area";
    icon_url: string | null;
}

export function FeaturedProductConfigurator({
    config,
    branding,
    className,
}: FeaturedProductConfiguratorProps) {
    const [product, setProduct] = useState<ProductData | null>(null);
    const [groups, setGroups] = useState<OptionGroup[]>([]);
    const [options, setOptions] = useState<Record<string, ProductOption[]>>({});
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [selectedQuantity, setSelectedQuantity] = useState<number>(
        config.quantityPresets?.[0] || 500
    );
    const [basePrice, setBasePrice] = useState<number>(0);
    const [availableQuantities, setAvailableQuantities] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    // Fetch product data
    useEffect(() => {
        if (!config.productId) {
            setLoading(false);
            return;
        }

        async function fetchProduct() {
            setLoading(true);
            const { data } = await supabase
                .from('products')
                .select('id, name, slug, description, image_url')
                .eq('id', config.productId)
                .single();

            if (data) {
                setProduct(data);
            }
            setLoading(false);
        }

        fetchProduct();
    }, [config.productId]);

    // Fetch option groups and options
    useEffect(() => {
        if (!config.productId || !config.showOptions) return;

        async function fetchOptions() {
            // Fetch assigned groups
            const { data: assignments } = await supabase
                .from('product_option_group_assignments')
                .select('option_group_id, sort_order')
                .eq('product_id', config.productId)
                .order('sort_order')
                .limit(3);

            if (!assignments || assignments.length === 0) return;

            const groupIds = assignments.map(a => a.option_group_id);

            // Fetch groups
            const { data: groupsData } = await supabase
                .from('product_option_groups')
                .select('*')
                .in('id', groupIds);

            if (groupsData) {
                const sortedGroups = groupsData.sort((a, b) => {
                    const aOrder = assignments.find(x => x.option_group_id === a.id)?.sort_order || 0;
                    const bOrder = assignments.find(x => x.option_group_id === b.id)?.sort_order || 0;
                    return aOrder - bOrder;
                });
                setGroups(sortedGroups);

                // Fetch options for each group
                const optionsMap: Record<string, ProductOption[]> = {};
                const initialSelections: Record<string, string> = {};

                for (const group of sortedGroups) {
                    const { data: optionsData } = await supabase
                        .from('product_options')
                        .select('*')
                        .eq('group_id', group.id)
                        .order('sort_order')
                        .limit(6);

                    if (optionsData && optionsData.length > 0) {
                        optionsMap[group.id] = optionsData;
                        initialSelections[group.id] = optionsData[0].id;
                    }
                }
                setOptions(optionsMap);
                setSelections(initialSelections);
            }
        }

        fetchOptions();
    }, [config.productId, config.showOptions]);

    // Fetch pricing for selected quantity
    useEffect(() => {
        if (!config.productId) return;

        async function fetchPrice() {
            try {
                const { matrixData } = await getGenericMatrixDataFromDB(config.productId!, undefined);

                if (matrixData.rows.length > 0 && matrixData.columns.length > 0) {
                    // Store available quantities from matrix
                    setAvailableQuantities(matrixData.columns);

                    // Find closest quantity to the selected one
                    const closestQty = matrixData.columns.reduce((prev, curr) =>
                        Math.abs(curr - selectedQuantity) < Math.abs(prev - selectedQuantity) ? curr : prev
                    );

                    const firstRow = matrixData.rows[0];
                    const price = matrixData.cells[firstRow]?.[closestQty] || 0;
                    setBasePrice(price);
                }
            } catch (error) {
                console.error('Error fetching price:', error);
            }
        }

        fetchPrice();
    }, [config.productId, selectedQuantity]);

    // Calculate total price with option extras
    const totalPrice = useMemo(() => {
        let price = basePrice;

        Object.entries(selections).forEach(([groupId, optionId]) => {
            const option = options[groupId]?.find(o => o.id === optionId);
            if (option && option.extra_price > 0) {
                if (option.price_mode === 'per_quantity') {
                    price += option.extra_price * selectedQuantity;
                } else {
                    price += option.extra_price;
                }
            }
        });

        return Math.round(price);
    }, [basePrice, selections, options, selectedQuantity]);

    const handleOptionSelect = useCallback((groupId: string, optionId: string) => {
        setSelections(prev => ({ ...prev, [groupId]: optionId }));
    }, []);

    // Get quantity presets that exist in the matrix, or use config presets
    const displayQuantities = useMemo(() => {
        if (availableQuantities.length === 0) {
            return config.quantityPresets || [200, 500, 1000, 2500, 5000];
        }
        // Filter config presets to only show quantities that exist in matrix
        const validPresets = (config.quantityPresets || []).filter(q =>
            availableQuantities.includes(q)
        );
        // If no valid presets, use first 5 from matrix
        return validPresets.length > 0 ? validPresets : availableQuantities.slice(0, 5);
    }, [config.quantityPresets, availableQuantities]);

    if (!config.productId) {
        return null;
    }

    if (loading) {
        return (
            <div className={cn("animate-pulse", className)}>
                <div className="h-64 bg-muted rounded-2xl" />
            </div>
        );
    }

    if (!product) {
        return null;
    }

    const isGlass = config.cardStyle === 'glass';

    return (
        <div
            className={cn(
                "relative rounded-2xl overflow-hidden max-w-2xl",
                isGlass
                    ? "bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl"
                    : "bg-card shadow-xl border",
                className
            )}
            style={{
                marginTop: config.overlapPx ? `-${config.overlapPx}px` : undefined,
            }}
        >
            <div className="flex flex-col lg:flex-row gap-6 p-6">
                {/* Product Image */}
                <div className="lg:w-2/5 flex-shrink-0">
                    <img
                        src={getProductImage(product.slug, product.image_url)}
                        alt={product.name}
                        className="w-full h-48 lg:h-full object-contain rounded-lg"
                    />
                </div>

                {/* Configuration Area */}
                <div className="lg:w-3/5 flex flex-col gap-4">
                    <div>
                        <h3 className="text-3xl lg:text-4xl font-bold mb-2">{product.name}</h3>
                        {product.description && (
                            <p className="text-muted-foreground text-sm line-clamp-2">
                                {product.description}
                            </p>
                        )}
                    </div>

                    {/* Quantity Presets */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Antal</label>
                        <div className="flex flex-wrap gap-2">
                            {displayQuantities.map((qty) => (
                                <button
                                    key={qty}
                                    onClick={() => setSelectedQuantity(qty)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg font-medium transition-all",
                                        selectedQuantity === qty
                                            ? "shadow-md"
                                            : "bg-muted hover:bg-muted/80"
                                    )}
                                    style={selectedQuantity === qty ? {
                                        backgroundColor: primaryColor,
                                        color: '#FFFFFF',
                                    } : undefined}
                                >
                                    {qty.toLocaleString('da-DK')} stk
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Option Groups with icons/photos when available */}
                    {config.showOptions && groups.slice(0, 2).map((group) => (
                        <div key={group.id} className="space-y-2">
                            <label className="text-sm font-medium">{group.label}</label>
                            <div className="flex flex-wrap gap-2">
                                {options[group.id]?.slice(0, 4).map((option) => {
                                    const isSelected = selections[group.id] === option.id;
                                    const hasIcon = option.icon_url;

                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => handleOptionSelect(group.id, option.id)}
                                            className={cn(
                                                "rounded-lg font-medium transition-all flex items-center gap-2",
                                                hasIcon ? "p-2" : "px-3 py-1.5",
                                                isSelected
                                                    ? "ring-2"
                                                    : "bg-muted hover:bg-muted/80"
                                            )}
                                            style={isSelected ? {
                                                backgroundColor: `${primaryColor}15`,
                                                color: primaryColor,
                                                ringColor: primaryColor,
                                            } : undefined}
                                        >
                                            {hasIcon && (
                                                <img
                                                    src={option.icon_url!}
                                                    alt={option.label}
                                                    className="w-8 h-8 object-contain rounded"
                                                />
                                            )}
                                            <span className="text-sm">
                                                {option.label}
                                                {option.extra_price > 0 && (
                                                    <span className="ml-1 text-xs opacity-70">
                                                        +{option.extra_price} kr
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Price and CTA - bottom right */}
                    <div className="mt-auto pt-4 flex flex-col sm:flex-row items-end justify-between gap-4">
                        {/* Price display - large blue text */}
                        {config.showPrice && totalPrice > 0 && (
                            <div className="text-right">
                                <div
                                    className="text-3xl lg:text-4xl font-bold"
                                    style={{ color: primaryColor }}
                                >
                                    {totalPrice.toLocaleString('da-DK')} kr
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ekskl. moms og levering
                                </p>
                            </div>
                        )}

                        {/* CTA Button */}
                        <Button
                            size="lg"
                            style={{
                                backgroundColor: config.ctaColor || primaryColor,
                                color: config.ctaTextColor || '#FFFFFF',
                            }}
                            asChild
                        >
                            <Link to={`/produkt/${product.slug}`}>
                                {config.ctaLabel || 'Bestil nu'}
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
