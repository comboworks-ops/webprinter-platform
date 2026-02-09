/**
 * MatrixLayoutV1Renderer - Renders product pricing from pricing_structure.mode === 'matrix_layout_v1'
 * 
 * This component:
 * 1. Renders selector UI from layout_rows (each row with multiple columns/sections)
 * 2. Maintains selectedSectionValues state (sectionId -> valueId)
 * 3. Computes activeVariantKey from selections
 * 4. Queries generic_product_prices and builds the price matrix
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PriceMatrix } from "@/components/product-price-page/PriceMatrix";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PICTURE_SIZES, type PictureSizeMode } from "@/lib/storformat-pricing/types";

// Types from pricing structure
interface VerticalAxisConfig {
    sectionId: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    ui_mode?: string;
    labelOverride?: string;
    title?: string;
    description?: string;
}

interface LayoutColumn {
    id: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    ui_mode: string;
    selection_mode?: 'required' | 'optional';
    valueSettings?: Record<string, { showThumbnail?: boolean; customImage?: string }>;
    labelOverride?: string;
    title?: string;
    description?: string;
}

interface LayoutRow {
    id: string;
    title?: string;
    description?: string;
    columns: LayoutColumn[];
}

interface MatrixLayoutV1 {
    mode: 'matrix_layout_v1';
    version: number;
    vertical_axis: VerticalAxisConfig;
    layout_rows: LayoutRow[];
    quantities?: number[];
}

interface AttributeValue {
    id: string;
    name: string;
    enabled: boolean;
    meta?: { image?: string };
}

interface AttributeGroup {
    id: string;
    name: string;
    kind: string;
    values: AttributeValue[];
}

interface MatrixLayoutV1RendererProps {
    productId: string;
    pricingStructure: MatrixLayoutV1;
    onCellClick?: (row: string, column: number, price: number) => void;
    onSelectionChange?: (
        selections: Record<string, string | null>,
        formatId?: string,
        materialId?: string,
        meta?: { variantKey?: string; verticalValueId?: string },
    ) => void;
    onSelectionSummary?: (summary: string[]) => void;
}

export function MatrixLayoutV1Renderer({
    productId,
    pricingStructure,
    onCellClick,
    onSelectionChange,
    onSelectionSummary
}: MatrixLayoutV1RendererProps) {
    // State: per-section selections (sectionId -> valueId)
    const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string | null>>({});
    const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
    const [prices, setPrices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState<{ row: string; column: number } | null>(null);

    const lastNotifiedCellRef = useRef<string>("");

    // Fetch attribute groups for this product
    useEffect(() => {
        async function fetchGroups() {
            const { data } = await supabase
                .from('product_attribute_groups' as any)
                .select('*, values:product_attribute_values(*)')
                .eq('product_id', productId)
                .order('sort_order');

            if (data) {
                setAttributeGroups(data as unknown as AttributeGroup[]);
            }
        }
        fetchGroups();
    }, [productId]);

    const sectionTypeById = useMemo(() => {
        const map: Record<string, string> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                map[col.id] = col.sectionType;
            });
        });
        return map;
    }, [pricingStructure]);

    const sectionUiModeById = useMemo(() => {
        const map: Record<string, string> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                const uiMode = (col as any).ui_mode || (col as any).uiMode;
                if (uiMode) {
                    map[col.id] = uiMode;
                }
            });
        });
        return map;
    }, [pricingStructure]);

    const isHiddenColumn = useCallback((col: LayoutColumn) => {
        const uiMode = (col as any).ui_mode || (col as any).uiMode;
        return uiMode === 'hidden' || (col as any).hidden === true;
    }, []);

    const selectionModeById = useMemo(() => {
        const map: Record<string, 'required' | 'optional'> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                map[col.id] = col.selection_mode || (col.sectionType === 'finishes' || col.sectionType === 'products' ? 'optional' : 'required');
            });
        });
        return map;
    }, [pricingStructure]);

    const valueSettingsById = useMemo(() => {
        const map: Record<string, Record<string, { showThumbnail?: boolean; customImage?: string }>> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (col.valueSettings) {
                    map[col.id] = col.valueSettings;
                }
            });
        });
        return map;
    }, [pricingStructure]);

    const isOptionalSectionId = useCallback((sectionId: string) => {
        return selectionModeById[sectionId] === 'optional';
    }, [selectionModeById]);

    // Initialize and keep selections in sync with layout/vertical axis
    useEffect(() => {
        const vertAxis = pricingStructure.vertical_axis;
        const verticalSectionId = vertAxis.sectionId || 'vertical-axis';
        const verticalSectionType = vertAxis.sectionType;

        setSelectedSectionValues(prev => {
            let changed = false;
            const next = { ...prev };

            if (vertAxis.valueIds?.length) {
                const current = next[verticalSectionId];
                if (!current || !vertAxis.valueIds.includes(current)) {
                    next[verticalSectionId] = vertAxis.valueIds[0];
                    changed = true;
                }
            }

            pricingStructure.layout_rows.forEach(row => {
                row.columns.forEach(col => {
                    if (col.sectionType === verticalSectionType) return;
                    if (!col.valueIds || col.valueIds.length === 0) return;
                    const current = next[col.id];
                    const isOptional = isOptionalSectionId(col.id);
                    const isValid = !!current && col.valueIds.includes(current);

                    if (!isValid) {
                        if (!isOptional) {
                            next[col.id] = col.valueIds[0];
                            changed = true;
                        } else if (current != null) {
                            next[col.id] = null;
                            changed = true;
                        }
                    }
                });
            });

            const validSectionIds = new Set<string>([verticalSectionId]);
            pricingStructure.layout_rows.forEach(row => {
                row.columns.forEach(col => {
                    if (col.sectionType !== verticalSectionType) {
                        validSectionIds.add(col.id);
                    }
                });
            });
            Object.keys(next).forEach(sectionId => {
                if (!validSectionIds.has(sectionId)) {
                    delete next[sectionId];
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [pricingStructure, isOptionalSectionId]);

    const computeVariantKey = useMemo(() => {
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;
        const verticalSectionType = pricingStructure.vertical_axis.sectionType;
        const entries = Object.entries(selectedSectionValues)
            .filter(([secId]) => secId !== verticalSectionId)
            .filter(([secId]) => sectionTypeById[secId] !== verticalSectionType)
            .filter(([_, valId]) => !!valId); // Skip duplicate vertical type and empty selections

        if (entries.length === 0) return 'none';

        // Use simple sorted value IDs to match backend format
        // This is robust against section ID changes and supports multiple variant columns
        return entries
            .map(([_, valId]) => valId as string)
            .sort()
            .join('|');
    }, [selectedSectionValues, pricingStructure.vertical_axis.sectionId, pricingStructure.vertical_axis.sectionType, sectionTypeById]);

    const selectedVariantKey = computeVariantKey;
    const selectedVariantValueIds = useMemo(() => {
        return selectedVariantKey === 'none'
            ? []
            : selectedVariantKey.split('|').filter(Boolean);
    }, [selectedVariantKey]);

    const selectedFormatId = useMemo(() => {
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;
        if (pricingStructure.vertical_axis.sectionType === 'formats') {
            return selectedSectionValues[verticalSectionId] || '';
        }
        for (const [secId, valueId] of Object.entries(selectedSectionValues)) {
            if (sectionTypeById[secId] === 'formats' && sectionUiModeById[secId] !== 'hidden' && valueId) {
                return valueId;
            }
        }
        for (const [secId, valueId] of Object.entries(selectedSectionValues)) {
            if (sectionTypeById[secId] === 'formats' && valueId) {
                return valueId;
            }
        }
        return '';
    }, [pricingStructure.vertical_axis.sectionId, pricingStructure.vertical_axis.sectionType, selectedSectionValues, sectionTypeById, sectionUiModeById]);

    const selectedMaterialId = useMemo(() => {
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;
        if (pricingStructure.vertical_axis.sectionType === 'materials') {
            return selectedSectionValues[verticalSectionId] || '';
        }
        for (const [secId, valueId] of Object.entries(selectedSectionValues)) {
            if (sectionTypeById[secId] === 'materials' && sectionUiModeById[secId] !== 'hidden' && valueId) {
                return valueId;
            }
        }
        for (const [secId, valueId] of Object.entries(selectedSectionValues)) {
            if (sectionTypeById[secId] === 'materials' && valueId) {
                return valueId;
            }
        }
        return '';
    }, [pricingStructure.vertical_axis.sectionId, pricingStructure.vertical_axis.sectionType, selectedSectionValues, sectionTypeById, sectionUiModeById]);

    // Fetch all prices once so switching variants doesn't trigger reloads.
    useEffect(() => {
        let isMounted = true;

        async function fetchPrices() {
            setLoading(true);
            setPrices([]);

            const pageSize = 1000;
            let offset = 0;
            const all: any[] = [];

            while (true) {
                const { data } = await supabase
                    .from('generic_product_prices')
                    .select('*')
                    .eq('product_id', productId)
                    .range(offset, offset + pageSize - 1);

                if (data && data.length > 0) {
                    all.push(...data);
                }

                if (!data || data.length < pageSize) {
                    break;
                }

                offset += pageSize;
            }

            if (!isMounted) return;

            setPrices(all);
            setLoading(false);
        }

        fetchPrices();
        return () => {
            isMounted = false;
        };
    }, [productId]);

    // Get value name by ID
    const getValueName = useCallback((valueId: string): string => {
        for (const group of attributeGroups) {
            const val = group.values?.find(v => v.id === valueId);
            if (val) return val.name;
        }
        return valueId;
    }, [attributeGroups]);

    useEffect(() => {
        if (!onSelectionSummary) return;
        const verticalSectionType = pricingStructure.vertical_axis.sectionType;
        const summaryParts: string[] = [];

        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (col.sectionType === verticalSectionType) return;
                if (isHiddenColumn(col)) return;
                const selectedValueId = selectedSectionValues[col.id];
                if (selectedValueId) {
                    summaryParts.push(getValueName(selectedValueId));
                }
            });
        });

        onSelectionSummary(summaryParts);
    }, [onSelectionSummary, pricingStructure, selectedSectionValues, getValueName]);

    // Get values for a section by its config
    const getSectionValues = useCallback((groupId: string, valueIds: string[]): AttributeValue[] => {
        if (!valueIds || valueIds.length === 0) return [];
        const group = attributeGroups.find(g => g.id === groupId);
        if (group) {
            return group.values
                .filter(v => valueIds.includes(v.id) && v.enabled)
                .sort((a, b) => valueIds.indexOf(a.id) - valueIds.indexOf(b.id));
        }

        // Fallback: resolve by valueIds across all groups
        const byId: AttributeValue[] = [];
        const seen = new Set<string>();
        attributeGroups.forEach(g => {
            (g.values || []).forEach(v => {
                if (valueIds.includes(v.id) && v.enabled && !seen.has(v.id)) {
                    seen.add(v.id);
                    byId.push(v);
                }
            });
        });

        return byId.sort((a, b) => valueIds.indexOf(a.id) - valueIds.indexOf(b.id));
    }, [attributeGroups]);

    // Get section type label
    const getSectionLabel = useCallback((sectionType: string, groupId: string, labelOverride?: string, title?: string): string => {
        if (title) return title;
        if (labelOverride) return labelOverride;
        const group = attributeGroups.find(g => g.id === groupId);
        if (group) return group.name;

        switch (sectionType) {
            case 'formats': return 'Format';
            case 'materials': return 'Materiale';
            case 'finishes': return 'Efterbehandling';
            default: return 'Valgmulighed';
        }
    }, [attributeGroups]);

    const getSectionTypeLabel = (sectionType: string) => {
        switch (sectionType) {
            case 'formats': return 'Formater';
            case 'materials': return 'Materialer';
            case 'finishes': return 'Efterbehandling';
            default: return 'Produkter';
        }
    };


    // Build matrix data from prices
    const matrixData = useMemo(() => {
        const vertAxis = pricingStructure.vertical_axis;
        const quantities = pricingStructure.quantities || [];
        const selectedVariantKey = computeVariantKey;

        // Row labels are vertical axis values
        const rows: string[] = vertAxis.valueIds
            .map(vId => getValueName(vId))
            .filter(Boolean);

        const columns = quantities.sort((a, b) => a - b);
        const cells: Record<string, Record<number, number>> = {};

        // For each vertical axis value, find matching price
        for (const vertValueId of vertAxis.valueIds) {
            const rowLabel = getValueName(vertValueId);
            if (!rowLabel) continue;

            cells[rowLabel] = {};

            for (const qty of columns) {
                // Find price matching: variant_value = vertValueId (or extra_data lookup)
                const matchingPrice = prices.find(p => {
                    const normalizeVariantKey = (key?: string) => {
                        if (!key) return '';
                        return key
                            .split('|')
                            .map(part => part.trim())
                            .filter(Boolean)
                            .sort()
                            .join('|');
                    };
                    // Check extra_data for formatId/materialId/verticalAxisValueId
                    const extra = p.extra_data || {};
                    const matchesVertical =
                        p.variant_value === vertValueId ||
                        extra.verticalAxisValueId === vertValueId ||
                        extra.formatId === vertValueId ||
                        extra.materialId === vertValueId;

                    // Check variant_name matches our computed key
                    const selectionMap = extra.selectionMap || {};
                    const variantValueIds = Array.isArray(selectionMap.variantValueIds)
                        ? selectionMap.variantValueIds
                        : Array.isArray(extra.variantValueIds)
                            ? extra.variantValueIds
                            : [];

                    // FIX: If the DB explicitly maps Format or Material in selectionMap,
                    // we must NOT expect them to appear in the variantValueIds list.
                    // We filter them out of our LOCAL selection list before comparing.
                    let effectiveSelectedIds = selectedVariantValueIds;
                    if (selectionMap.format) {
                        effectiveSelectedIds = effectiveSelectedIds.filter(id => id !== selectedFormatId);
                    }
                    if (selectionMap.material) {
                        effectiveSelectedIds = effectiveSelectedIds.filter(id => id !== selectedMaterialId);
                    }

                    const matchesSelectionMap =
                        (selectionMap.format ? selectionMap.format === selectedFormatId : true) &&
                        (selectionMap.material ? selectionMap.material === selectedMaterialId : true) &&
                        (normalizeVariantKey(variantValueIds.join('|')) === normalizeVariantKey(effectiveSelectedIds.join('|')));

                    const matchesVariant =
                        selectedVariantKey === 'none' ? (p.variant_name === 'none' || !p.variant_name) :
                            p.variant_name === selectedVariantKey ||
                            normalizeVariantKey(p.variant_name) === normalizeVariantKey(selectedVariantKey) ||
                            (Array.isArray(extra.selectionMap?.variantValueIds) && extra.selectionMap.variantValueIds.slice().sort().join('|') === selectedVariantKey) ||
                            matchesSelectionMap;

                    return matchesVertical && matchesVariant && p.quantity === qty;
                });

                if (matchingPrice) {
                    cells[rowLabel][qty] = matchingPrice.price_dkk;
                }
            }
        }

        return { rows, columns, cells };
    }, [prices, pricingStructure, selectedSectionValues, computeVariantKey, getValueName]);

    // Ensure a default selection so the price panel can render totals.
    useEffect(() => {
        if (matrixData.rows.length === 0 || matrixData.columns.length === 0) return;

        const notifyCellClick = (row: string, column: number, price: number) => {
            if (!onCellClick) return;
            const key = `${row}|${column}|${price}`;
            if (lastNotifiedCellRef.current === key) return;
            lastNotifiedCellRef.current = key;
            onCellClick(row, column, price);
        };

        const selectRow = (row: string) => {
            const rowCells = matrixData.cells[row] || {};
            const firstQty = matrixData.columns.find(qty => rowCells[qty] != null);
            if (firstQty != null) {
                const price = Math.round(Number(rowCells[firstQty]) || 0);
                setSelectedCell({ row, column: firstQty });
                notifyCellClick(row, firstQty, price);
                return true;
            }
            return false;
        };

        if (selectedCell && matrixData.rows.includes(selectedCell.row)) {
            const currentPrice = Math.round(Number(matrixData.cells[selectedCell.row]?.[selectedCell.column]) || 0);
            if (currentPrice !== undefined) {
                // Avoid re-trigger loops when parent callbacks are re-created each render
                notifyCellClick(selectedCell.row, selectedCell.column, currentPrice);
            }
            return;
        }

        if (selectedCell) {
            const mappedRow = getValueName(selectedCell.row);
            if (mappedRow !== selectedCell.row && matrixData.rows.includes(mappedRow)) {
                if (selectRow(mappedRow)) return;
            }
        }

        for (const row of matrixData.rows) {
            if (selectRow(row)) break;
        }
    }, [matrixData, selectedCell, onCellClick, getValueName]);

    const emitSelectionChange = useCallback((updated: Record<string, string | null>) => {
        if (!onSelectionChange) return;

        let formatId: string | undefined;
        let materialId: string | undefined;

        if (pricingStructure.vertical_axis.sectionType === 'formats') {
            formatId = updated[pricingStructure.vertical_axis.sectionId] || undefined;
        } else if (pricingStructure.vertical_axis.sectionType === 'materials') {
            materialId = updated[pricingStructure.vertical_axis.sectionId] || undefined;
        }

        for (const row of pricingStructure.layout_rows) {
            for (const col of row.columns) {
                if (col.sectionType === 'formats' && !isHiddenColumn(col) && !formatId) {
                    formatId = updated[col.id] || undefined;
                } else if (col.sectionType === 'materials' && !isHiddenColumn(col) && !materialId) {
                    materialId = updated[col.id] || undefined;
                }
            }
        }

        const verticalValueId = updated[pricingStructure.vertical_axis.sectionId] || undefined;
        const variantEntries = Object.entries(updated)
            .filter(([secId]) => secId !== pricingStructure.vertical_axis.sectionId)
            .filter(([secId]) => sectionTypeById[secId] !== pricingStructure.vertical_axis.sectionType)
            .filter(([_, valId]) => !!valId);
        const variantKey = variantEntries.length > 0
            ? variantEntries
                .map(([_, valId]) => valId as string)
                .sort()
                .join('|')
            : 'none';

        onSelectionChange(updated, formatId, materialId, { variantKey, verticalValueId });
    }, [onSelectionChange, pricingStructure, sectionTypeById]);

    useEffect(() => {
        emitSelectionChange(selectedSectionValues);
    }, [selectedSectionValues, emitSelectionChange]);

    // Handle section selection change
    const handleSectionSelect = (sectionId: string, valueId: string) => {
        setSelectedSectionValues(prev => {
            const updated = { ...prev, [sectionId]: valueId };
            emitSelectionChange(updated);
            return updated;
        });
    };

    const clearSectionSelection = (sectionId: string) => {
        setSelectedSectionValues(prev => {
            if (!(sectionId in prev)) return prev;
            const updated = { ...prev };
            delete updated[sectionId];
            emitSelectionChange(updated);
            return updated;
        });
    };

    // Handle cell click
    const handleCellClick = (row: string, column: number, basePrice: number, displayPrice: number) => {
        setSelectedCell({ row, column });
        if (onCellClick) {
            onCellClick(row, column, Math.round(Number(displayPrice) || 0));
        }
    };

    const renderValueSelector = (
        sectionId: string,
        values: AttributeValue[],
        uiMode: string,
        isOptionalEnabled: boolean
    ) => {
        const isOptional = isOptionalSectionId(sectionId);
        const valueSettings = valueSettingsById[sectionId] || {};
        const isActive = !isOptional || isOptionalEnabled;
        const selectedValue = selectedSectionValues[sectionId] ?? (isOptional ? "" : values[0]?.id || "");

        if (values.length === 0) return null;

        if (uiMode === 'dropdown') {
            return (
                <select
                    value={selectedValue}
                    onChange={(e) => handleSectionSelect(sectionId, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    disabled={!isActive}
                >
                    {isOptional && (
                        <option value="">Ingen</option>
                    )}
                    {values.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            );
        }

        if (uiMode === 'checkboxes') {
            return (
                <div className={cn("space-y-1", !isActive && "opacity-60 pointer-events-none")}>
                    {values.map(v => {
                        const isSelected = selectedValue === v.id;
                        return (
                            <label
                                key={v.id}
                                className={cn(
                                    "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                                    isSelected ? "bg-primary/10 border-primary" : "bg-background border-muted hover:border-muted-foreground/30"
                                )}
                                onClick={() => handleSectionSelect(sectionId, v.id)}
                            >
                                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                {valueSettings[v.id]?.showThumbnail && valueSettings[v.id]?.customImage && (
                                    <img
                                        src={valueSettings[v.id].customImage}
                                        alt={v.name}
                                        className="h-8 w-8 rounded object-cover"
                                    />
                                )}
                                <span className="font-medium">{v.name}</span>
                            </label>
                        );
                    })}
                </div>
            );
        }

        // Picture grid display (small / medium / large / xl)
        if (['small', 'medium', 'large', 'xl'].includes(uiMode)) {
            const size = PICTURE_SIZES[uiMode as PictureSizeMode] || PICTURE_SIZES.medium;
            return (
                <div className={cn("flex flex-wrap gap-2", !isActive && "opacity-60 pointer-events-none")}>
                    {values.map(v => {
                        const isSelected = selectedValue === v.id;
                        const thumbUrl = valueSettings[v.id]?.customImage;
                        return (
                            <button
                                key={v.id}
                                onClick={() => handleSectionSelect(sectionId, v.id)}
                                disabled={!isActive}
                                className={cn(
                                    "relative rounded-lg border-2 transition-all flex flex-col items-center overflow-hidden",
                                    isSelected
                                        ? "border-transparent shadow-none"
                                        : "border-transparent",
                                    !isActive && "cursor-not-allowed"
                                )}
                                style={{ width: size.width, minHeight: size.height + (uiMode !== 'small' ? 22 : 0) }}
                            >
                                {thumbUrl ? (
                                    <img src={thumbUrl} alt={v.name} className="w-full object-cover rounded-t-md" style={{ height: size.height }} />
                                ) : (
                                    <div
                                        className={cn(
                                            "w-full flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground rounded-t-md",
                                            isSelected && "bg-accent text-foreground"
                                        )}
                                        style={{ height: size.height }}
                                    >
                                        {(v.name || '?').slice(0, 3).toUpperCase()}
                                    </div>
                                )}
                                {uiMode !== 'small' && (
                                    <span className="text-[10px] leading-tight text-center truncate w-full px-1 py-0.5">
                                        {v.name}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            );
        }

        // Default: buttons
        return (
            <div className={cn("flex flex-wrap gap-1.5", !isActive && "opacity-60 pointer-events-none")}>
                {values.map(v => {
                    const isSelected = selectedValue === v.id;
                    return (
                        <Button
                            key={v.id}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                "h-9 px-3 text-sm gap-2",
                                isSelected && "bg-primary hover:bg-primary/90"
                            )}
                            onClick={() => handleSectionSelect(sectionId, v.id)}
                            disabled={!isActive}
                        >
                            {valueSettings[v.id]?.showThumbnail && valueSettings[v.id]?.customImage && (
                                <img
                                    src={valueSettings[v.id].customImage}
                                    alt={v.name}
                                    className="h-8 w-8 rounded object-cover"
                                />
                            )}
                            {v.name}
                        </Button>
                    );
                })}
            </div>
        );
    };

    if (loading && prices.length === 0) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {loading && prices.length > 0 && (
                <div className="text-xs text-muted-foreground">Opdaterer priser...</div>
            )}
            {/* Render layout rows */}
            <div className="space-y-4">
                {pricingStructure.layout_rows.map((row) => {
                    const filteredColumns = row.columns.filter(
                        col => col.sectionType !== pricingStructure.vertical_axis.sectionType
                            && !isHiddenColumn(col)
                    );

                    if (filteredColumns.length === 0) return null;

                    return (
                        <div key={row.id} className="space-y-2 pb-3 border-b last:border-b-0">
                            {row.title && <div className="text-xs font-medium">{row.title}</div>}
                            {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                            <div className={cn(
                                "grid gap-3",
                                filteredColumns.length === 1 && "grid-cols-1",
                                filteredColumns.length === 2 && "grid-cols-2",
                                filteredColumns.length >= 3 && "grid-cols-3"
                            )}>
                                {filteredColumns.map((col, colIndex) => {
                                    const values = getSectionValues(col.groupId, col.valueIds);
                                    if (values.length === 0) return null;
                                    const sectionLabel = col.title || getSectionTypeLabel(col.sectionType);
                                    const uiMode = col.ui_mode || 'buttons';
                                    const isOptional = isOptionalSectionId(col.id);
                                    const isOptionalEnabled = isOptional && !!selectedSectionValues[col.id];

                                    const handleOptionalToggle = (checked: boolean) => {
                                        if (!isOptional) return;
                                        if (checked) {
                                            if (!selectedSectionValues[col.id] && values.length > 0) {
                                                handleSectionSelect(col.id, values[0].id);
                                            }
                                        } else {
                                            clearSectionSelection(col.id);
                                        }
                                    };

                                    return (
                                        <div
                                            key={col.id}
                                            className={cn(
                                                "space-y-1.5 p-2 rounded",
                                                col.sectionType === "finishes" ? "bg-transparent" : "bg-muted/20",
                                                isOptionalEnabled && "ring-1 ring-primary/20 bg-primary/5",
                                                colIndex > 0 && col.sectionType !== "finishes" && "border-l-2 border-primary/20 pl-3"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isOptional && (
                                                    <Checkbox
                                                        checked={isOptionalEnabled}
                                                        onCheckedChange={(checked) => handleOptionalToggle(Boolean(checked))}
                                                        className="h-3.5 w-3.5"
                                                    />
                                                )}
                                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                                    {sectionLabel}
                                                </span>
                                            </div>
                                            {col.description && <p className="text-[10px] text-muted-foreground">{col.description}</p>}
                                            {renderValueSelector(col.id, values, uiMode, isOptionalEnabled)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Price Matrix */}
            {matrixData.rows.length > 0 && matrixData.columns.length > 0 && (
                <div className="mt-6">
                    <PriceMatrix
                        rows={matrixData.rows}
                        columns={matrixData.columns}
                        cells={matrixData.cells}
                        onCellClick={handleCellClick}
                        selectedCell={selectedCell}
                        columnUnit="stk"
                        rowHeaderLabel={pricingStructure.vertical_axis.title || getSectionLabel(pricingStructure.vertical_axis.sectionType, pricingStructure.vertical_axis.groupId, pricingStructure.vertical_axis.labelOverride)}
                    />
                </div>
            )}

            {/* Empty state */}
            {matrixData.rows.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <p>Ingen priser fundet for dette produkt.</p>
                    <p className="text-sm">Vælg format og produkt ovenfor.</p>
                </div>
            )}
        </div>
    );
}
