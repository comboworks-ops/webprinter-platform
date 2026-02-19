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

interface PreparedPriceRow {
    raw: any;
    quantity: number;
    price: number;
    verticalIds: string[];
    variantName: string;
    variantNameNorm: string;
    selectionMapFormat: string | null;
    selectionMapMaterial: string | null;
    selectionMapVariantSortedKey: string;
    variantValueIdsNorm: string;
}

interface SelectorSectionConfig {
    id: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
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

const CACHE_TTL_MS = 120_000;
const PRICE_PAGE_SIZE = 1000;

const attributeGroupCache = new Map<string, { at: number; data: AttributeGroup[] }>();
const attributeGroupInflight = new Map<string, Promise<AttributeGroup[]>>();

const priceRowsCache = new Map<string, { at: number; data: any[] }>();
const priceRowsInflight = new Map<string, Promise<any[]>>();

const isFresh = (at: number) => (Date.now() - at) < CACHE_TTL_MS;

async function fetchAttributeGroupsCached(productId: string): Promise<AttributeGroup[]> {
    const cached = attributeGroupCache.get(productId);
    if (cached && isFresh(cached.at)) return cached.data;

    const inflight = attributeGroupInflight.get(productId);
    if (inflight) return inflight;

    const request = (async () => {
        const { data, error } = await supabase
            .from('product_attribute_groups' as any)
            .select('*, values:product_attribute_values(*)')
            .eq('product_id', productId)
            .order('sort_order');

        if (error) throw error;

        const rows = (data || []) as unknown as AttributeGroup[];
        attributeGroupCache.set(productId, { at: Date.now(), data: rows });
        return rows;
    })().finally(() => {
        attributeGroupInflight.delete(productId);
    });

    attributeGroupInflight.set(productId, request);
    return request;
}

async function fetchPriceRowsCached(productId: string, forceRefresh = false): Promise<any[]> {
    const cached = priceRowsCache.get(productId);
    if (!forceRefresh && cached && isFresh(cached.at)) return cached.data;

    const inflight = priceRowsInflight.get(productId);
    if (inflight) return inflight;

    const request = (async () => {
        let offset = 0;
        const all: any[] = [];

        while (true) {
            const { data, error } = await supabase
                .from('generic_product_prices')
                .select('variant_name, variant_value, quantity, price_dkk, extra_data')
                .eq('product_id', productId)
                .range(offset, offset + PRICE_PAGE_SIZE - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                all.push(...data);
            }

            if (!data || data.length === 0) break;
            offset += data.length;
        }

        priceRowsCache.set(productId, { at: Date.now(), data: all });
        return all;
    })().finally(() => {
        priceRowsInflight.delete(productId);
    });

    priceRowsInflight.set(productId, request);
    return request;
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
    const lastLoadedProductIdRef = useRef<string | null>(null);

    // Fetch attribute groups for this product
    useEffect(() => {
        let active = true;

        async function fetchGroups() {
            try {
                const data = await fetchAttributeGroupsCached(productId);
                if (active) {
                    setAttributeGroups(data);
                }
            } catch {
                if (active) {
                    setAttributeGroups([]);
                }
            }
        }

        fetchGroups();

        return () => {
            active = false;
        };
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

    const sectionById = useMemo(() => {
        const map: Record<string, LayoutColumn> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                map[col.id] = col;
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

    const finishSectionIds = useMemo(() => {
        const ids: string[] = [];
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (col.sectionType === 'finishes' && !isHiddenColumn(col)) {
                    ids.push(col.id);
                }
            });
        });
        return ids;
    }, [pricingStructure, isHiddenColumn]);

    const formatSectionIds = useMemo(() => {
        const ids: string[] = [];
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (col.sectionType === 'formats' && !isHiddenColumn(col)) {
                    ids.push(col.id);
                }
            });
        });
        return ids;
    }, [pricingStructure, isHiddenColumn]);

    const primaryFinishSectionId = useMemo(() => {
        const nonOptional = finishSectionIds.find(id => !isOptionalSectionId(id));
        return nonOptional || finishSectionIds[0] || null;
    }, [finishSectionIds, isOptionalSectionId]);

    const buildVariantKeyFromSelections = useCallback((selections: Record<string, string | null>) => {
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;
        const verticalSectionType = pricingStructure.vertical_axis.sectionType;

        let activeFinishValue: string | null = null;
        const optionalFinishIds = finishSectionIds.filter(id => isOptionalSectionId(id));
        for (const sectionId of optionalFinishIds) {
            const selected = selections[sectionId];
            if (selected) {
                activeFinishValue = selected;
                break;
            }
        }
        if (!activeFinishValue && primaryFinishSectionId) {
            activeFinishValue = selections[primaryFinishSectionId] || null;
        }
        if (!activeFinishValue) {
            for (const sectionId of finishSectionIds) {
                const selected = selections[sectionId];
                if (selected) {
                    activeFinishValue = selected;
                    break;
                }
            }
        }

        const values = Object.entries(selections)
            .filter(([secId]) => secId !== verticalSectionId)
            .filter(([secId]) => sectionTypeById[secId] !== verticalSectionType)
            .filter(([secId]) => !finishSectionIds.includes(secId))
            .map(([_, valId]) => valId)
            .filter((valId): valId is string => !!valId);

        if (activeFinishValue) {
            values.push(activeFinishValue);
        }

        if (values.length === 0) return 'none';
        return values.sort().join('|');
    }, [
        finishSectionIds,
        isOptionalSectionId,
        primaryFinishSectionId,
        pricingStructure.vertical_axis.sectionId,
        pricingStructure.vertical_axis.sectionType,
        sectionTypeById,
    ]);

    const normalizeVariantKey = useCallback((key?: string | null) => {
        if (!key) return '';
        return key
            .split('|')
            .map(part => part.trim())
            .filter(Boolean)
            .sort()
            .join('|');
    }, []);

    const resolveFormatAndMaterialFromSelections = useCallback((selections: Record<string, string | null>) => {
        let formatId = '';
        let materialId = '';
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;

        if (pricingStructure.vertical_axis.sectionType === 'formats') {
            formatId = selections[verticalSectionId] || '';
        } else if (pricingStructure.vertical_axis.sectionType === 'materials') {
            materialId = selections[verticalSectionId] || '';
        }

        for (const [secId, valueId] of Object.entries(selections)) {
            if (sectionTypeById[secId] === 'formats' && sectionUiModeById[secId] !== 'hidden' && valueId && !formatId) {
                formatId = valueId;
            }
            if (sectionTypeById[secId] === 'materials' && sectionUiModeById[secId] !== 'hidden' && valueId && !materialId) {
                materialId = valueId;
            }
        }

        for (const [secId, valueId] of Object.entries(selections)) {
            if (sectionTypeById[secId] === 'formats' && valueId && !formatId) {
                formatId = valueId;
            }
            if (sectionTypeById[secId] === 'materials' && valueId && !materialId) {
                materialId = valueId;
            }
        }

        return { formatId, materialId };
    }, [
        pricingStructure.vertical_axis.sectionId,
        pricingStructure.vertical_axis.sectionType,
        sectionTypeById,
        sectionUiModeById,
    ]);

    const matchesPreparedPriceForSelection = useCallback((row: PreparedPriceRow, args: {
        variantKey: string;
        variantKeyNorm?: string;
        variantValueIds: string[];
        formatId?: string;
        materialId?: string;
        verticalValueId?: string | null;
        quantity?: number;
    }) => {
        const matchesVertical = !args.verticalValueId
            || row.verticalIds.includes(String(args.verticalValueId));

        let effectiveSelectedIds = args.variantValueIds;
        if (row.selectionMapFormat && args.formatId) {
            effectiveSelectedIds = effectiveSelectedIds.filter(id => id !== args.formatId);
        }
        if (row.selectionMapMaterial && args.materialId) {
            effectiveSelectedIds = effectiveSelectedIds.filter(id => id !== args.materialId);
        }

        const matchesSelectionMap =
            (row.selectionMapFormat ? row.selectionMapFormat === args.formatId : true) &&
            (row.selectionMapMaterial ? row.selectionMapMaterial === args.materialId : true) &&
            (row.variantValueIdsNorm === normalizeVariantKey(effectiveSelectedIds.join('|')));

        const matchesVariant =
            args.variantKey === 'none'
                ? (row.variantName === 'none' || !row.variantName)
                : row.variantName === args.variantKey
                || row.variantNameNorm === (args.variantKeyNorm || normalizeVariantKey(args.variantKey))
                || (row.selectionMapVariantSortedKey === args.variantKey)
                || matchesSelectionMap;

        const matchesQuantity = args.quantity == null || row.quantity === args.quantity;
        return matchesVertical && matchesVariant && matchesQuantity;
    }, [normalizeVariantKey]);

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
        return buildVariantKeyFromSelections(selectedSectionValues);
    }, [buildVariantKeyFromSelections, selectedSectionValues]);

    const selectedVariantKey = computeVariantKey;
    const selectedVariantValueIds = useMemo(() => {
        return selectedVariantKey === 'none'
            ? []
            : selectedVariantKey.split('|').filter(Boolean);
    }, [selectedVariantKey]);

    const selectedFormatMaterial = useMemo(() => {
        return resolveFormatAndMaterialFromSelections(selectedSectionValues);
    }, [resolveFormatAndMaterialFromSelections, selectedSectionValues]);

    const selectedFormatId = selectedFormatMaterial.formatId;
    const selectedMaterialId = selectedFormatMaterial.materialId;

    const preparedPrices = useMemo(() => {
        return prices
            .map((p): PreparedPriceRow | null => {
                const quantity = Number(p.quantity);
                const price = Number(p.price_dkk);
                if (!Number.isFinite(quantity)) return null;

                const extra = p.extra_data || {};
                const selectionMap = extra.selectionMap || {};
                const rawVariantName = (p.variant_name || '') as string;

                const rawVariantValueIds = Array.isArray(selectionMap.variantValueIds)
                    ? selectionMap.variantValueIds
                    : Array.isArray(extra.variantValueIds)
                        ? extra.variantValueIds
                        : [];

                const verticalIds = Array.from(new Set(
                    [p.variant_value, extra.verticalAxisValueId, extra.formatId, extra.materialId]
                        .filter(Boolean)
                        .map(v => String(v))
                ));

                return {
                    raw: p,
                    quantity,
                    price,
                    verticalIds,
                    variantName: rawVariantName,
                    variantNameNorm: normalizeVariantKey(rawVariantName),
                    selectionMapFormat: selectionMap.format ? String(selectionMap.format) : null,
                    selectionMapMaterial: selectionMap.material ? String(selectionMap.material) : null,
                    selectionMapVariantSortedKey: Array.isArray(selectionMap.variantValueIds)
                        ? selectionMap.variantValueIds.slice().sort().join('|')
                        : '',
                    variantValueIdsNorm: normalizeVariantKey(rawVariantValueIds.join('|')),
                };
            })
            .filter((row): row is PreparedPriceRow => row !== null);
    }, [normalizeVariantKey, prices]);

    const selectorSections = useMemo<SelectorSectionConfig[]>(() => {
        const sections: SelectorSectionConfig[] = [
            {
                id: pricingStructure.vertical_axis.sectionId,
                sectionType: pricingStructure.vertical_axis.sectionType,
                groupId: pricingStructure.vertical_axis.groupId,
                valueIds: pricingStructure.vertical_axis.valueIds || [],
            }
        ];

        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (isHiddenColumn(col)) return;
                sections.push({
                    id: col.id,
                    sectionType: col.sectionType,
                    groupId: col.groupId,
                    valueIds: col.valueIds || [],
                });
            });
        });

        return sections;
    }, [pricingStructure, isHiddenColumn]);

    const getSectionValueIdForPreparedRow = useCallback((sectionId: string, row: PreparedPriceRow): string | null => {
        const extra = row.raw?.extra_data || {};
        const sectionType = sectionTypeById[sectionId];
        const groupId = sectionById[sectionId]?.groupId;
        const groupName = (attributeGroups.find(group => group.id === groupId)?.name || '').toLowerCase();

        if (sectionType === 'formats') {
            return row.selectionMapFormat || extra.formatId || null;
        }

        if (sectionType === 'materials') {
            return row.selectionMapMaterial || extra.materialId || row.raw?.variant_value || null;
        }

        if (groupName === 'papirfinish') {
            return extra.surfaceId || null;
        }

        if (groupName === 'foldetype') {
            return extra.foldId || null;
        }

        if (groupName === 'sider') {
            return extra.pagesId || null;
        }

        if (groupName === 'retning') {
            return extra.orientationId || null;
        }

        return null;
    }, [sectionTypeById, sectionById, attributeGroups]);

    const mappableSectionIds = useMemo(() => {
        const ids = new Set<string>();

        selectorSections.forEach(section => {
            const hasAny = preparedPrices.some(row => !!getSectionValueIdForPreparedRow(section.id, row));
            if (hasAny) ids.add(section.id);
        });

        return ids;
    }, [selectorSections, preparedPrices, getSectionValueIdForPreparedRow]);

    const availableValueIdsBySection = useMemo(() => {
        const bySection = new Map<string, Set<string>>();
        const activeSectionIds = selectorSections
            .map(section => section.id)
            .filter(sectionId => mappableSectionIds.has(sectionId));

        if (activeSectionIds.length === 0) return bySection;

        const comboKeys = new Set<string>();
        const combos: Record<string, string>[] = [];

        preparedPrices.forEach(row => {
            const combo: Record<string, string> = {};
            activeSectionIds.forEach(sectionId => {
                const valueId = getSectionValueIdForPreparedRow(sectionId, row);
                if (valueId) combo[sectionId] = valueId;
            });

            const key = activeSectionIds.map(sectionId => combo[sectionId] || '').join('|');
            if (!comboKeys.has(key)) {
                comboKeys.add(key);
                combos.push(combo);
            }
        });

        activeSectionIds.forEach(targetSectionId => {
            const available = new Set<string>();

            combos.forEach(combo => {
                let matches = true;
                for (const sectionId of activeSectionIds) {
                    if (sectionId === targetSectionId) continue;
                    const selectedValueId = selectedSectionValues[sectionId];
                    if (!selectedValueId) continue;
                    if ((combo[sectionId] || null) !== selectedValueId) {
                        matches = false;
                        break;
                    }
                }

                if (!matches) return;
                const targetValueId = combo[targetSectionId];
                if (targetValueId) available.add(targetValueId);
            });

            bySection.set(targetSectionId, available);
        });

        return bySection;
    }, [
        selectorSections,
        mappableSectionIds,
        preparedPrices,
        getSectionValueIdForPreparedRow,
        selectedSectionValues,
    ]);

    const priceIndexByVerticalQty = useMemo(() => {
        const index = new Map<string, PreparedPriceRow[]>();
        preparedPrices.forEach(row => {
            row.verticalIds.forEach(verticalId => {
                const key = `${verticalId}::${row.quantity}`;
                const list = index.get(key);
                if (list) list.push(row);
                else index.set(key, [row]);
            });
        });
        return index;
    }, [preparedPrices]);

    // Fetch all prices once so switching variants doesn't trigger reloads.
    useEffect(() => {
        let active = true;
        const cached = priceRowsCache.get(productId);
        const hasFreshCache = !!cached && isFresh(cached.at);

        async function fetchPrices() {
            try {
                const all = await fetchPriceRowsCached(productId, hasFreshCache);
                if (active) {
                    setPrices(all);
                }
            } catch {
                if (active) {
                    setPrices([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        if (hasFreshCache) {
            setPrices(cached!.data);
            setLoading(false);
        } else {
            setLoading(true);
            if (lastLoadedProductIdRef.current && lastLoadedProductIdRef.current !== productId) {
                setPrices([]);
            }
        }
        lastLoadedProductIdRef.current = productId;

        fetchPrices();

        return () => {
            active = false;
        };
    }, [productId]);

    const attributeGroupById = useMemo(() => {
        const map: Record<string, AttributeGroup> = {};
        attributeGroups.forEach(group => {
            map[group.id] = group;
        });
        return map;
    }, [attributeGroups]);

    const sectionGroupNameById = useMemo(() => {
        const map: Record<string, string> = {};
        Object.entries(sectionById).forEach(([sectionId, section]) => {
            map[sectionId] = attributeGroupById[section.groupId]?.name || '';
        });
        return map;
    }, [attributeGroupById, sectionById]);

    const foldSectionIdForFolders = useMemo(() => {
        return Object.entries(sectionById).find(([sectionId, section]) => {
            if (section.sectionType !== 'finishes') return false;
            const groupName = (sectionGroupNameById[sectionId] || '').toLowerCase();
            return groupName === 'foldetype';
        })?.[0] || null;
    }, [sectionById, sectionGroupNameById]);

    const pagesSectionIdForFolders = useMemo(() => {
        return Object.entries(sectionById).find(([sectionId]) => {
            const groupName = (sectionGroupNameById[sectionId] || '').toLowerCase();
            return groupName === 'sider';
        })?.[0] || null;
    }, [sectionById, sectionGroupNameById]);

    const attributeValueById = useMemo(() => {
        const map: Record<string, AttributeValue> = {};
        attributeGroups.forEach(group => {
            (group.values || []).forEach(value => {
                map[value.id] = value;
            });
        });
        return map;
    }, [attributeGroups]);

    // Get value name by ID
    const getValueName = useCallback((valueId: string): string => {
        return attributeValueById[valueId]?.name || valueId;
    }, [attributeValueById]);

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
        const group = attributeGroupById[groupId];
        if (group) {
            return group.values
                .filter(v => valueIds.includes(v.id) && v.enabled)
                .sort((a, b) => valueIds.indexOf(a.id) - valueIds.indexOf(b.id));
        }

        // Fallback: resolve by valueIds across all groups
        const byId: AttributeValue[] = valueIds
            .map(id => attributeValueById[id])
            .filter((v): v is AttributeValue => !!v && v.enabled);

        return byId.sort((a, b) => valueIds.indexOf(a.id) - valueIds.indexOf(b.id));
    }, [attributeGroupById, attributeValueById]);

    const getAllowedFolderPageNames = useCallback((foldValueName?: string | null): string[] | null => {
        const foldName = (foldValueName || '').toLowerCase();
        if (!foldName) return null;
        if (foldName.includes('midter')) return ['4 sider'];
        if (foldName.includes('rulle') || foldName.includes('zigzag')) return ['6 sider', '8 sider', '10 sider'];
        return null;
    }, []);

    // For folder products, keep Sider choices aligned with selected Foldetype.
    useEffect(() => {
        if (!foldSectionIdForFolders || !pagesSectionIdForFolders) return;

        const foldValueId = selectedSectionValues[foldSectionIdForFolders];
        if (!foldValueId) return;

        const pagesSection = sectionById[pagesSectionIdForFolders];
        if (!pagesSection) return;

        const pagesValues = getSectionValues(pagesSection.groupId, pagesSection.valueIds);
        if (pagesValues.length === 0) return;

        const foldName = getValueName(foldValueId);
        const allowedNames = getAllowedFolderPageNames(foldName);
        if (!allowedNames || allowedNames.length === 0) return;

        const allowedSet = new Set(allowedNames.map(name => name.toLowerCase()));
        const allowedValues = pagesValues.filter(value => allowedSet.has(value.name.toLowerCase()));
        if (allowedValues.length === 0) return;

        const currentPageId = selectedSectionValues[pagesSectionIdForFolders];
        const isCurrentAllowed = !!currentPageId && allowedValues.some(value => value.id === currentPageId);
        if (isCurrentAllowed) return;

        setSelectedSectionValues(prev => {
            const nextCurrent = prev[pagesSectionIdForFolders];
            const stillAllowed = !!nextCurrent && allowedValues.some(value => value.id === nextCurrent);
            if (stillAllowed) return prev;
            return {
                ...prev,
                [pagesSectionIdForFolders]: allowedValues[0].id,
            };
        });
    }, [
        foldSectionIdForFolders,
        pagesSectionIdForFolders,
        selectedSectionValues,
        sectionById,
        getSectionValues,
        getValueName,
        getAllowedFolderPageNames,
    ]);

    // Keep selector values aligned with combinations that exist in imported prices.
    useEffect(() => {
        if (availableValueIdsBySection.size === 0) return;

        setSelectedSectionValues(prev => {
            let changed = false;
            const next = { ...prev };

            selectorSections.forEach(section => {
                if (sectionTypeById[section.id] === 'formats') return;
                if (!mappableSectionIds.has(section.id)) return;

                const availableIds = availableValueIdsBySection.get(section.id);
                if (!availableIds || availableIds.size === 0) return;

                const current = next[section.id];
                const currentAllowed = !!current && availableIds.has(current);
                if (currentAllowed) return;

                const allowedValues = getSectionValues(section.groupId, section.valueIds)
                    .filter(value => availableIds.has(value.id));

                if (allowedValues.length === 0) return;

                if (isOptionalSectionId(section.id)) {
                    if (current != null) {
                        next[section.id] = null;
                        changed = true;
                    }
                    return;
                }

                next[section.id] = allowedValues[0].id;
                changed = true;
            });

            return changed ? next : prev;
        });
    }, [
        availableValueIdsBySection,
        selectorSections,
        mappableSectionIds,
        getSectionValues,
        sectionTypeById,
        isOptionalSectionId,
    ]);

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
        const selectedVariantKeyNorm = normalizeVariantKey(selectedVariantKey);

        // Row labels are vertical axis values
        const allRows: string[] = vertAxis.valueIds
            .map(vId => getValueName(vId))
            .filter(Boolean);

        const columns = [...quantities].sort((a, b) => a - b);
        const cells: Record<string, Record<number, number>> = {};

        // For each vertical axis value, find matching price
        for (const vertValueId of vertAxis.valueIds) {
            const rowLabel = getValueName(vertValueId);
            if (!rowLabel) continue;

            cells[rowLabel] = {};

            for (const qty of columns) {
                const bucketKey = `${vertValueId}::${qty}`;
                const candidateRows = priceIndexByVerticalQty.get(bucketKey) || [];
                const matchingPrice = candidateRows.find(row =>
                    matchesPreparedPriceForSelection(row, {
                        variantKey: selectedVariantKey,
                        variantKeyNorm: selectedVariantKeyNorm,
                        variantValueIds: selectedVariantValueIds,
                        formatId: selectedFormatId,
                        materialId: selectedMaterialId,
                        verticalValueId: vertValueId,
                        quantity: qty,
                    })
                );

                if (matchingPrice) {
                    cells[rowLabel][qty] = matchingPrice.price;
                }
            }
        }

        // Hide rows where every quantity cell is empty for the current selection.
        const rows = allRows.filter(row => {
            const rowCells = cells[row] || {};
            return columns.some(qty => rowCells[qty] != null);
        });

        return { rows, columns, cells };
    }, [computeVariantKey, getValueName, matchesPreparedPriceForSelection, normalizeVariantKey, priceIndexByVerticalQty, pricingStructure, selectedFormatId, selectedMaterialId, selectedVariantValueIds]);

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
        const variantKey = buildVariantKeyFromSelections(updated);

        onSelectionChange(updated, formatId, materialId, { variantKey, verticalValueId });
    }, [buildVariantKeyFromSelections, onSelectionChange, pricingStructure]);

    useEffect(() => {
        emitSelectionChange(selectedSectionValues);
    }, [selectedSectionValues, emitSelectionChange]);

    // Handle section selection change
    const handleSectionSelect = (sectionId: string, valueId: string) => {
        setSelectedSectionValues(prev => {
            const updated = { ...prev };
            const currentValue = prev[sectionId];
            if (isOptionalSectionId(sectionId) && currentValue === valueId) {
                delete updated[sectionId];
            } else {
                updated[sectionId] = valueId;
            }

            if (finishSectionIds.includes(sectionId) && updated[sectionId]) {
                if (isOptionalSectionId(sectionId)) {
                    finishSectionIds.forEach(finishSectionId => {
                        if (finishSectionId !== sectionId && isOptionalSectionId(finishSectionId)) {
                            delete updated[finishSectionId];
                        }
                    });
                } else {
                    finishSectionIds.forEach(finishSectionId => {
                        if (isOptionalSectionId(finishSectionId)) {
                            delete updated[finishSectionId];
                        }
                    });
                }
            }

            // Enforce print 4+4 when a two-sided finish is selected.
            const selectedSectionType = sectionTypeById[sectionId];
            if (selectedSectionType === 'finishes' && updated[sectionId]) {
                const selectedName = getValueName(valueId).toLowerCase();
                const requiresFourFour = selectedName.includes('2 sider') || selectedName.includes('2 side');

                if (requiresFourFour) {
                    const printColumn = pricingStructure.layout_rows
                        .flatMap(row => row.columns)
                        .find(col => col.sectionType === 'products' && !isHiddenColumn(col));

                    if (printColumn) {
                        const printValues = getSectionValues(printColumn.groupId, printColumn.valueIds);
                        const fourFourValue = printValues.find(v => {
                            const n = v.name.toLowerCase();
                            return n.includes('4+4') || n.includes('4/4');
                        });
                        if (fourFourValue) {
                            updated[printColumn.id] = fourFourValue.id;
                        }
                    }
                }
            }

            return updated;
        });
    };

    const clearSectionSelection = (sectionId: string) => {
        setSelectedSectionValues(prev => {
            if (!(sectionId in prev)) return prev;
            const updated = { ...prev };
            delete updated[sectionId];
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
        let visibleValues = values;
        const valueSettings = valueSettingsById[sectionId] || {};
        const isActive = !isOptional || isOptionalEnabled;

        const groupName = (sectionGroupNameById[sectionId] || '').toLowerCase();
        if (groupName === 'sider' && foldSectionIdForFolders) {
            const selectedFoldId = selectedSectionValues[foldSectionIdForFolders];
            const selectedFoldName = selectedFoldId ? getValueName(selectedFoldId) : '';
            const allowedPages = getAllowedFolderPageNames(selectedFoldName);
            if (allowedPages && allowedPages.length > 0) {
                const allowedSet = new Set(allowedPages.map(name => name.toLowerCase()));
                visibleValues = visibleValues.filter(value => allowedSet.has(value.name.toLowerCase()));
            }
        }

        const availableIdsForSection = availableValueIdsBySection.get(sectionId);
        if (sectionTypeById[sectionId] !== 'formats' && availableIdsForSection && availableIdsForSection.size > 0) {
            visibleValues = visibleValues.filter(value => availableIdsForSection.has(value.id));
        }

        const selectedValue = selectedSectionValues[sectionId] ?? (isOptional ? "" : visibleValues[0]?.id || "");

        if (visibleValues.length === 0) return null;

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
                    {visibleValues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            );
        }

        if (uiMode === 'checkboxes') {
            return (
                <div className={cn("space-y-1", !isActive && "opacity-60 pointer-events-none")}>
                    {visibleValues.map(v => {
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
                    {visibleValues.map(v => {
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
                {visibleValues.map(v => {
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
