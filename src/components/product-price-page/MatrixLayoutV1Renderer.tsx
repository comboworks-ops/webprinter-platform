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
import { normalizeThumbnailCustomPx, normalizeThumbnailSize, resolveThumbnailSizePx } from "@/lib/pricing/thumbnailSizes";
import { getHiResThumbnailUrl } from "@/lib/pricing/thumbnailImageUrl";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { readTransientString, writeTransientString } from "@/lib/storage/transientStorage";
import { fetchPricingRead } from "@/lib/api/pricingRead";

// Types from pricing structure
interface VerticalAxisConfig {
    sectionId: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    valueSettings?: Record<string, { showThumbnail?: boolean; customImage?: string; displayName?: string }>;
    ui_mode?: string;
    labelOverride?: string;
    title?: string;
    description?: string;
    thumbnail_size?: 'small' | 'medium' | 'large' | 'xl';
    thumbnail_custom_px?: number;
}

interface LayoutColumn {
    id: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    ui_mode: string;
    selection_mode?: 'required' | 'optional';
    valueSettings?: Record<string, { showThumbnail?: boolean; customImage?: string; displayName?: string }>;
    labelOverride?: string;
    title?: string;
    description?: string;
    thumbnail_size?: 'small' | 'medium' | 'large' | 'xl';
    thumbnail_custom_px?: number;
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
    variantNameLooseNorm: string;
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
const PERSISTED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRICE_PAGE_SIZE = 500;
const PRICE_PAGE_FALLBACK_SIZES = [PRICE_PAGE_SIZE, 250, 100, 50, 25] as const;
const PRICING_SHADOW_READ_ENABLED = false;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeLooseText = (value?: string | null): string => {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\buv[\s-]*varnish\b/g, "uv lak")
        .replace(/\buv[\s-]*lak\b/g, "uv lak")
        .replace(/\bgloss(?:y)?\b/g, "glans")
        .replace(/\bmatte\b/g, "matt")
        .replace(/\bmat\b/g, "matt")
        .replace(/\b(?:cashiering|cachering|kachering|kachering|kashering|kasjering)\b/g, "kashering")
        .replace(/[^a-z0-9+]+/g, " ")
        .trim();
};

const normalizeLooseVariantKey = (value?: string | null): string => {
    return String(value || "")
        .split("|")
        .map((part) => normalizeLooseText(part))
        .filter(Boolean)
        .sort()
        .join("|");
};

const RESERVED_SELECTION_MAP_KEYS = new Set([
    "format",
    "material",
    "variant",
    "variantvalueids",
    "formatid",
    "materialid",
]);

const collectSelectionMapVariantIds = (
    selectionMap: any,
    options?: {
        allowedIds?: Set<string>;
        excludedIds?: Set<string>;
    }
): string[] => {
    const allowedIds = options?.allowedIds;
    const excludedIds = options?.excludedIds;

    const rawValues = [
        ...(Array.isArray(selectionMap?.variantValueIds) ? selectionMap.variantValueIds : []),
        ...Object.entries(selectionMap || {}).flatMap(([key, value]) => {
            const normalizedKey = key.toLowerCase();
            if (RESERVED_SELECTION_MAP_KEYS.has(normalizedKey)) {
                return [];
            }
            if (Array.isArray(value)) {
                return value.map((entry) => String(entry));
            }
            if (typeof value === "string" || typeof value === "number") {
                return [String(value)];
            }
            return [];
        }),
    ]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean);

    return Array.from(
        new Set(
            rawValues.filter((valueId) => {
                if (excludedIds?.has(valueId)) return false;
                if (allowedIds && allowedIds.size > 0) {
                    return allowedIds.has(valueId);
                }
                return true;
            })
        )
    );
};

const collectLegacyVariantIds = (extra: any): string[] => {
    return [
        extra?.printModeId,
        extra?.uvLakId,
        extra?.kacheringId,
        extra?.glossCachingId,
        extra?.surfaceId,
        extra?.foldId,
        extra?.pagesId,
        extra?.orientationId,
    ]
        .filter(Boolean)
        .map((value) => String(value));
};

const hexToRgba = (color: string, alpha: number): string => {
    const normalized = String(color || "").trim();
    const a = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);

    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split("").map((c) => parseInt(c + c, 16));
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    if (longMatch) {
        const hex = longMatch[1];
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    return normalized || `rgba(0, 0, 0, ${a})`;
};

const attributeGroupCache = new Map<string, { at: number; data: AttributeGroup[] }>();
const attributeGroupInflight = new Map<string, Promise<AttributeGroup[]>>();

const priceRowsCache = new Map<string, { at: number; data: any[] }>();
const priceRowsInflight = new Map<string, Promise<any[]>>();
const variantPriceRowsCache = new Map<string, { at: number; data: any[] }>();
const variantPriceRowsInflight = new Map<string, Promise<any[]>>();

const isFresh = (at: number) => (Date.now() - at) < CACHE_TTL_MS;

function readPersistedCache<T>(key: string): { at: number; data: T } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = readTransientString(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { at?: number; data?: T };
        if (typeof parsed?.at !== 'number' || parsed.data == null) return null;
        if ((Date.now() - parsed.at) > PERSISTED_CACHE_TTL_MS) return null;
        return { at: parsed.at, data: parsed.data };
    } catch {
        return null;
    }
}

function writePersistedCache<T>(key: string, payload: { at: number; data: T }) {
    if (typeof window === 'undefined') return;
    try {
        writeTransientString(key, JSON.stringify(payload));
    } catch {
        // Ignore storage errors.
    }
}

async function fetchAttributeGroupsCached(productId: string): Promise<AttributeGroup[]> {
    const persistedKey = `matrix-v1:attribute-groups:${productId}`;
    const persisted = readPersistedCache<AttributeGroup[]>(persistedKey);
    const cached = attributeGroupCache.get(productId);
    if (cached && isFresh(cached.at)) return cached.data;

    const inflight = attributeGroupInflight.get(productId);
    if (inflight) return inflight;

    const request = (async () => {
        try {
            const { data, error } = await supabase
                .from('product_attribute_groups' as any)
                .select('*, values:product_attribute_values(*)')
                .eq('product_id', productId)
                .order('sort_order');

            if (error) throw error;

            const rows = (data || []) as unknown as AttributeGroup[];
            const payload = { at: Date.now(), data: rows };
            attributeGroupCache.set(productId, payload);
            writePersistedCache(persistedKey, payload);
            return rows;
        } catch (error) {
            if (persisted) {
                attributeGroupCache.set(productId, persisted);
                return persisted.data;
            }
            throw error;
        }
    })().finally(() => {
        attributeGroupInflight.delete(productId);
    });

    attributeGroupInflight.set(productId, request);
    return request;
}

async function fetchPriceRowsCached(productId: string, forceRefresh = false): Promise<any[]> {
    const persistedKey = `matrix-v1:price-rows:v2:${productId}`;
    const persisted = readPersistedCache<any[]>(persistedKey);
    const cached = priceRowsCache.get(productId);
    if (!forceRefresh && cached && isFresh(cached.at)) return cached.data;

    const inflight = priceRowsInflight.get(productId);
    if (inflight) return inflight;

    const fetchAllPriceRows = async (pageSize: number): Promise<any[]> => {
        let cursorId: string | null = null;
        const all: any[] = [];

        while (true) {
            let query = supabase
                .from('generic_product_prices')
                .select('id, variant_name, variant_value, quantity, price_dkk, extra_data')
                .eq('product_id', productId)
                .order('id', { ascending: true })
                .limit(pageSize);

            // Use keyset pagination to avoid high OFFSET scans on large products.
            if (cursorId) {
                query = query.gt('id', cursorId);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                all.push(...data);
            }

            if (!data || data.length === 0) break;
            if (data.length < pageSize) break;

            const nextCursor = data[data.length - 1]?.id ?? null;
            if (!nextCursor || nextCursor === cursorId) break;
            cursorId = nextCursor;
        }

        return all;
    };

    const request = (async () => {
        try {
            let all: any[] = [];
            let lastError: unknown = null;

            for (const pageSize of PRICE_PAGE_FALLBACK_SIZES) {
                try {
                    all = await fetchAllPriceRows(pageSize);
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    console.warn(
                        '[Matrix V1] generic_product_prices read failed. Retrying with smaller page size.',
                        { productId, pageSize, error }
                    );
                }
            }

            if (lastError) throw lastError;

            const deduped = Array.from(
                new Map(
                    all.map((row) => [
                        row.id ?? `${row.variant_name}|${row.variant_value}|${row.quantity}|${JSON.stringify(row.extra_data || {})}`,
                        row,
                    ])
                ).values()
            );

            const payload = { at: Date.now(), data: deduped };
            priceRowsCache.set(productId, payload);
            writePersistedCache(persistedKey, payload);
            return deduped;
        } catch (error) {
            if (persisted) {
                priceRowsCache.set(productId, persisted);
                return persisted.data;
            }
            throw error;
        }
    })().finally(() => {
        priceRowsInflight.delete(productId);
    });

    priceRowsInflight.set(productId, request);
    return request;
}

async function fetchVariantPriceRowsCached(
    productId: string,
    variantName: string,
    verticalValueIds: string[],
    forceRefresh = false,
): Promise<any[]> {
    const cacheKey = `${productId}::${variantName}::${verticalValueIds.slice().sort().join('|')}`;
    const cached = variantPriceRowsCache.get(cacheKey);
    if (!forceRefresh && cached && isFresh(cached.at)) return cached.data;

    const inflight = variantPriceRowsInflight.get(cacheKey);
    if (inflight) return inflight;

    const request = (async () => {
        const { data, error } = await supabase
            .from('generic_product_prices')
            .select('id, variant_name, variant_value, quantity, price_dkk, extra_data')
            .eq('product_id', productId)
            .eq('variant_name', variantName)
            .in('variant_value', verticalValueIds)
            .order('quantity', { ascending: true });

        if (error) throw error;

        const rows = (data || []) as any[];
        const payload = { at: Date.now(), data: rows };
        variantPriceRowsCache.set(cacheKey, payload);
        return rows;
    })().finally(() => {
        variantPriceRowsInflight.delete(cacheKey);
    });

    variantPriceRowsInflight.set(cacheKey, request);
    return request;
}

export function MatrixLayoutV1Renderer({
    productId,
    pricingStructure,
    onCellClick,
    onSelectionChange,
    onSelectionSummary
}: MatrixLayoutV1RendererProps) {
    const settings = useShopSettings();
    const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
    const activeBranding = (isPreviewMode && previewBranding)
        ? previewBranding
        : settings.data?.branding;

    // State: per-section selections (sectionId -> valueId)
    const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string | null>>({});
    const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
    const [availabilityPrices, setAvailabilityPrices] = useState<any[]>([]);
    const [variantPrices, setVariantPrices] = useState<any[]>([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(true);
    const [matrixLoading, setMatrixLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState<{ row: string; column: number } | null>(null);
    const [hoveredPictureKey, setHoveredPictureKey] = useState<string | null>(null);

    const lastNotifiedCellRef = useRef<string>("");
    const lastLoadedProductIdRef = useRef<string | null>(null);
    const lastVariantProductIdRef = useRef<string | null>(null);
    const pricingShadowSignatureRef = useRef<string>("");

    const pictureButtonsConfig = useMemo(() => {
        const cfg = activeBranding?.productPage?.matrix?.pictureButtons || {};
        return {
            hoverEnabled: cfg.hoverEnabled !== false,
            hoverColor: cfg.hoverColor || activeBranding?.colors?.hover || activeBranding?.colors?.primary || "#0EA5E9",
            hoverOpacity: clamp(Number(cfg.hoverOpacity ?? 0.15), 0, 1),
            selectedColor: cfg.selectedColor || activeBranding?.colors?.primary || "#0EA5E9",
            selectedOpacity: clamp(Number(cfg.selectedOpacity ?? 0.22), 0, 1),
            outlineEnabled: cfg.outlineEnabled !== false,
            outlineOpacity: clamp(Number(cfg.outlineOpacity ?? 1), 0, 1),
            hoverZoomEnabled: cfg.hoverZoomEnabled !== false,
            hoverZoomScale: clamp(Number(cfg.hoverZoomScale ?? 1.03), 1, 1.2),
            hoverZoomDurationMs: clamp(Number(cfg.hoverZoomDurationMs ?? 140), 80, 400),
        };
    }, [activeBranding?.productPage?.matrix?.pictureButtons, activeBranding?.colors?.hover, activeBranding?.colors?.primary]);

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
        const map: Record<string, Record<string, { showThumbnail?: boolean; customImage?: string; displayName?: string }>> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (col.valueSettings) {
                    map[col.id] = col.valueSettings;
                }
            });
        });
        return map;
    }, [pricingStructure]);

    const sectionThumbnailConfigById = useMemo(() => {
        const map: Record<string, { size?: 'small' | 'medium' | 'large' | 'xl'; customPx?: number }> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                map[col.id] = {
                    size: normalizeThumbnailSize((col as any).thumbnail_size),
                    customPx: normalizeThumbnailCustomPx((col as any).thumbnail_custom_px)
                };
            });
        });
        return map;
    }, [pricingStructure]);

    const formatValueIdSet = useMemo(() => {
        const ids = new Set<string>();
        if (pricingStructure.vertical_axis.sectionType === "formats") {
            (pricingStructure.vertical_axis.valueIds || []).forEach((valueId) => ids.add(String(valueId)));
        }
        pricingStructure.layout_rows.forEach((row) => {
            row.columns.forEach((col) => {
                if (col.sectionType === "formats") {
                    (col.valueIds || []).forEach((valueId) => ids.add(String(valueId)));
                }
            });
        });
        return ids;
    }, [pricingStructure]);

    const materialValueIdSet = useMemo(() => {
        const ids = new Set<string>();
        if (pricingStructure.vertical_axis.sectionType === "materials") {
            (pricingStructure.vertical_axis.valueIds || []).forEach((valueId) => ids.add(String(valueId)));
        }
        pricingStructure.layout_rows.forEach((row) => {
            row.columns.forEach((col) => {
                if (col.sectionType === "materials") {
                    (col.valueIds || []).forEach((valueId) => ids.add(String(valueId)));
                }
            });
        });
        return ids;
    }, [pricingStructure]);

    const nonVerticalSelectorValueIdSet = useMemo(() => {
        const ids = new Set<string>();
        pricingStructure.layout_rows.forEach((row) => {
            row.columns.forEach((col) => {
                if (col.id === pricingStructure.vertical_axis.sectionId) return;
                (col.valueIds || []).forEach((valueId) => ids.add(String(valueId)));
            });
        });
        return ids;
    }, [pricingStructure]);

    const nonVerticalExcludedValueIdSet = useMemo(() => {
        return new Set<string>([
            ...Array.from(formatValueIdSet),
            ...Array.from(materialValueIdSet),
        ]);
    }, [formatValueIdSet, materialValueIdSet]);

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

    const buildVariantKeyFromSelections = useCallback((selections: Record<string, string | null>) => {
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;

        const values = Object.entries(selections)
            .filter(([secId]) => secId !== verticalSectionId)
            .map(([_, valId]) => valId)
            .filter((valId): valId is string => !!valId);

        if (values.length === 0) return 'none';
        return values.sort().join('|');
    }, [
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
        variantDisplayParts?: { valueId: string; label: string }[];
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

        let effectiveDisplayParts = args.variantDisplayParts || [];
        if (row.selectionMapFormat && args.formatId) {
            effectiveDisplayParts = effectiveDisplayParts.filter(entry => entry.valueId !== args.formatId);
        }
        if (row.selectionMapMaterial && args.materialId) {
            effectiveDisplayParts = effectiveDisplayParts.filter(entry => entry.valueId !== args.materialId);
        }

        const matchesSelectionMap =
            (row.selectionMapFormat ? row.selectionMapFormat === args.formatId : true) &&
            (row.selectionMapMaterial ? row.selectionMapMaterial === args.materialId : true) &&
            (row.variantValueIdsNorm === normalizeVariantKey(effectiveSelectedIds.join('|')));

        const selectedDisplayKeyNorm = normalizeLooseVariantKey(
            effectiveDisplayParts.map(entry => entry.label).join('|')
        );
        const matchesLegacyDisplayNames =
            !!selectedDisplayKeyNorm && row.variantNameLooseNorm === selectedDisplayKeyNorm;

        const matchesVariant =
            args.variantKey === 'none'
                ? (row.variantName === 'none' || !row.variantName)
                : row.variantName === args.variantKey
                || row.variantNameNorm === (args.variantKeyNorm || normalizeVariantKey(args.variantKey))
                || (row.selectionMapVariantSortedKey === args.variantKey)
                || matchesSelectionMap
                || matchesLegacyDisplayNames;

        const matchesQuantity = args.quantity == null || row.quantity === args.quantity;
        return matchesVertical && matchesVariant && matchesQuantity;
    }, [normalizeVariantKey]);

    // Initialize and keep selections in sync with layout/vertical axis
    useEffect(() => {
        const vertAxis = pricingStructure.vertical_axis;
        const verticalSectionId = vertAxis.sectionId || 'vertical-axis';

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
                    if (col.id === verticalSectionId) return;
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
                    if (col.id !== verticalSectionId) {
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

    const preparePriceRows = useCallback((sourceRows: any[]): PreparedPriceRow[] => {
        return sourceRows
            .map((p): PreparedPriceRow | null => {
                const quantity = Number(p.quantity);
                const price = Number(p.price_dkk);
                if (!Number.isFinite(quantity)) return null;

                const extra = p.extra_data || {};
                const selectionMap = extra.selectionMap || {};
                const rawVariantName = (p.variant_name || '') as string;
                const selectionMapVariantValueIds = collectSelectionMapVariantIds(selectionMap, {
                    allowedIds: nonVerticalSelectorValueIdSet,
                    excludedIds: nonVerticalExcludedValueIdSet,
                });
                const extraVariantValueIds = (Array.isArray(extra.variantValueIds) ? extra.variantValueIds : [])
                    .filter(Boolean)
                    .map((value) => String(value))
                    .filter((valueId) => !nonVerticalExcludedValueIdSet.has(valueId))
                    .filter((valueId) => nonVerticalSelectorValueIdSet.has(valueId));
                const legacyVariantIds = collectLegacyVariantIds(extra)
                    .filter((valueId) => !nonVerticalExcludedValueIdSet.has(valueId))
                    .filter((valueId) => nonVerticalSelectorValueIdSet.has(valueId));

                const rawVariantValueIds = Array.from(new Set(
                    [
                        ...selectionMapVariantValueIds,
                        ...extraVariantValueIds,
                        ...legacyVariantIds,
                    ]
                        .filter(Boolean)
                        .map((value) => String(value))
                ));

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
                    variantNameLooseNorm: normalizeLooseVariantKey(rawVariantName),
                    selectionMapFormat: selectionMap.format ? String(selectionMap.format) : (extra.formatId ? String(extra.formatId) : null),
                    selectionMapMaterial: selectionMap.material ? String(selectionMap.material) : (extra.materialId ? String(extra.materialId) : null),
                    selectionMapVariantSortedKey: selectionMapVariantValueIds.length > 0
                        ? selectionMapVariantValueIds.slice().sort().join('|')
                        : '',
                    variantValueIdsNorm: normalizeVariantKey(rawVariantValueIds.join('|')),
                };
            })
            .filter((row): row is PreparedPriceRow => row !== null);
    }, [nonVerticalExcludedValueIdSet, nonVerticalSelectorValueIdSet, normalizeVariantKey]);

    const availabilityPreparedPrices = useMemo(() => {
        return preparePriceRows(availabilityPrices);
    }, [availabilityPrices, preparePriceRows]);

    const matrixPreparedPrices = useMemo(() => {
        if (variantPrices.length > 0) {
            return preparePriceRows(variantPrices);
        }
        return availabilityPreparedPrices;
    }, [variantPrices, availabilityPreparedPrices, preparePriceRows]);

    const hasResolvedPriceRows = availabilityPreparedPrices.length > 0 || variantPrices.length > 0;

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

    const normalizeSelectionsForPricing = useCallback((selections: Record<string, string | null>) => {
        const normalized = { ...selections };
        const finishSectionsByGroup = new Map<string, string[]>();

        selectorSections.forEach((section) => {
            if (section.sectionType !== "finishes") return;
            const groupKey = section.groupId || section.id;
            const entries = finishSectionsByGroup.get(groupKey) || [];
            entries.push(section.id);
            finishSectionsByGroup.set(groupKey, entries);
        });

        finishSectionsByGroup.forEach((sectionIds) => {
            const hasOptionalFinishSelected = sectionIds.some((sectionId) =>
                isOptionalSectionId(sectionId) && !!normalized[sectionId]
            );
            if (!hasOptionalFinishSelected) return;

            sectionIds.forEach((sectionId) => {
                if (!isOptionalSectionId(sectionId)) {
                    delete normalized[sectionId];
                }
            });
        });

        return normalized;
    }, [isOptionalSectionId, selectorSections]);

    const pricingSelectedSectionValues = useMemo(() => {
        return normalizeSelectionsForPricing(selectedSectionValues);
    }, [normalizeSelectionsForPricing, selectedSectionValues]);

    const computeVariantKey = useMemo(() => {
        return buildVariantKeyFromSelections(pricingSelectedSectionValues);
    }, [buildVariantKeyFromSelections, pricingSelectedSectionValues]);

    const selectedVariantKey = computeVariantKey;
    const selectedVariantValueIds = useMemo(() => {
        return selectedVariantKey === 'none'
            ? []
            : selectedVariantKey.split('|').filter(Boolean);
    }, [selectedVariantKey]);

    const selectedFormatMaterial = useMemo(() => {
        return resolveFormatAndMaterialFromSelections(pricingSelectedSectionValues);
    }, [pricingSelectedSectionValues, resolveFormatAndMaterialFromSelections]);

    const selectedFormatId = selectedFormatMaterial.formatId;
    const selectedMaterialId = selectedFormatMaterial.materialId;

    const sectionOrderById = useMemo(() => {
        const map: Record<string, number> = {};
        selectorSections.forEach((section, index) => {
            map[section.id] = index;
        });
        return map;
    }, [selectorSections]);

    const hasCompleteRequiredSelection = useMemo(() => {
        return selectorSections.every(section => {
            if (section.id === pricingStructure.vertical_axis.sectionId) return true;
            if (isOptionalSectionId(section.id)) return true;
            return !!selectedSectionValues[section.id];
        });
    }, [
        selectorSections,
        pricingStructure.vertical_axis.sectionId,
        isOptionalSectionId,
        selectedSectionValues,
    ]);

    useEffect(() => {
        let active = true;
        const cached = priceRowsCache.get(productId);
        const hasFreshCache = !!cached && isFresh(cached.at);

        async function fetchAvailabilityPrices() {
            try {
                const all = await fetchPriceRowsCached(productId, hasFreshCache);
                if (active) {
                    setAvailabilityPrices(all);
                }
            } catch {
                if (active) {
                    setAvailabilityPrices([]);
                }
            } finally {
                if (active) {
                    setAvailabilityLoading(false);
                }
            }
        }

        if (hasFreshCache) {
            setAvailabilityPrices(cached!.data);
            setAvailabilityLoading(false);
        } else {
            setAvailabilityLoading(true);
            if (lastLoadedProductIdRef.current && lastLoadedProductIdRef.current !== productId) {
                setAvailabilityPrices([]);
            }
        }
        lastLoadedProductIdRef.current = productId;

        fetchAvailabilityPrices();

        return () => {
            active = false;
        };
    }, [productId]);

    useEffect(() => {
        let active = true;

        async function fetchActiveVariantPrices() {
            if (!hasCompleteRequiredSelection) {
                if (active) {
                    setVariantPrices([]);
                    setMatrixLoading(false);
                }
                return;
            }

            try {
                const rows = await fetchVariantPriceRowsCached(
                    productId,
                    selectedVariantKey,
                    pricingStructure.vertical_axis.valueIds || [],
                );
                if (active) {
                    setVariantPrices(rows);
                }
            } catch {
                if (active) {
                    setVariantPrices([]);
                }
            } finally {
                if (active) {
                    setMatrixLoading(false);
                }
            }
        }

        if (lastVariantProductIdRef.current && lastVariantProductIdRef.current !== productId) {
            setVariantPrices([]);
        }
        lastVariantProductIdRef.current = productId;
        setMatrixLoading(true);
        fetchActiveVariantPrices();

        return () => {
            active = false;
        };
    }, [
        productId,
        selectedVariantKey,
        pricingStructure.vertical_axis.valueIds,
        hasCompleteRequiredSelection,
    ]);

    const getSectionValueIdForPreparedRow = useCallback((sectionId: string, row: PreparedPriceRow): string | null => {
        const extra = row.raw?.extra_data || {};
        const sectionType = sectionTypeById[sectionId];
        const section = sectionById[sectionId];
        const groupName = (attributeGroups.find(group => group.id === section?.groupId)?.name || '').toLowerCase();
        const selectionMap = extra.selectionMap || {};
        const selectionMapVariantValueIds = collectSelectionMapVariantIds(selectionMap, {
            allowedIds: nonVerticalSelectorValueIdSet,
            excludedIds: nonVerticalExcludedValueIdSet,
        });
        const variantValueIds = Array.from(new Set(
            [
                ...selectionMapVariantValueIds,
                ...(Array.isArray(extra.variantValueIds)
                    ? extra.variantValueIds.map((id: unknown) => String(id))
                    : []),
                ...collectLegacyVariantIds(extra),
            ]
                .map((id) => String(id))
                .filter((valueId) => !nonVerticalExcludedValueIdSet.has(valueId))
                .filter((valueId) => nonVerticalSelectorValueIdSet.has(valueId))
        ));

        if (sectionType === 'formats') {
            return row.selectionMapFormat || extra.formatId || null;
        }

        if (sectionType === 'materials') {
            return row.selectionMapMaterial || extra.materialId || row.raw?.variant_value || null;
        }

        // Preferred path for matrix-v1 imports: section values are encoded in selectionMap.variantValueIds.
        if (section?.valueIds?.length) {
            const matched = section.valueIds.find(valueId => variantValueIds.includes(String(valueId)));
            if (matched) return matched;
        }

        const directLegacyId = collectLegacyVariantIds(extra).find((valueId) =>
            section?.valueIds?.includes(String(valueId))
        );
        if (directLegacyId) {
            return directLegacyId;
        }

        // Legacy fallback path for older imports using explicit keys.
        if (groupName === 'papirfinish' || groupName.includes('papirfinish')) {
            return extra.surfaceId || null;
        }

        if (groupName === 'foldetype' || groupName.includes('foldetype')) {
            return extra.foldId || null;
        }

        if (groupName === 'sider' || groupName.includes('sider')) {
            return extra.pagesId || null;
        }

        if (groupName === 'retning' || groupName.includes('retning')) {
            return extra.orientationId || null;
        }

        if (groupName.includes('uv-lak') || groupName.includes('uv lak')) {
            return extra.uvLakId || null;
        }

        if (groupName.includes('gloss') && (groupName.includes('cach') || groupName.includes('kasher') || groupName.includes('kacher'))) {
            return extra.glossCachingId || null;
        }

        if (groupName.includes('kacher') || groupName.includes('kasher')) {
            return extra.kacheringId || null;
        }

        if (section?.valueIds?.length) {
            const groupValues = attributeGroups.find(group => group.id === section.groupId)?.values || [];
            const rowText = normalizeLooseText([
                row.variantName,
                row.raw?.variant_value,
                JSON.stringify(extra || {}),
            ].filter(Boolean).join(' | '));

            if (rowText) {
                const matchedByName = section.valueIds
                    .map((valueId) => ({
                        valueId,
                        label: groupValues.find((value) => value.id === valueId)?.name || "",
                    }))
                    .filter((entry) => !!entry.label)
                    .sort((a, b) => b.label.length - a.label.length)
                    .find((entry) => {
                        const candidate = normalizeLooseText(entry.label);
                        return candidate.length >= 4 && rowText.includes(candidate);
                    });

                if (matchedByName) return matchedByName.valueId;
            }
        }

        return null;
    }, [sectionTypeById, sectionById, attributeGroups, nonVerticalExcludedValueIdSet, nonVerticalSelectorValueIdSet]);

    const mappableSectionIds = useMemo(() => {
        const ids = new Set<string>();

        selectorSections.forEach(section => {
            const hasAny = availabilityPreparedPrices.some(row => !!getSectionValueIdForPreparedRow(section.id, row));
            if (hasAny) ids.add(section.id);
        });

        return ids;
    }, [selectorSections, availabilityPreparedPrices, getSectionValueIdForPreparedRow]);

    const rowMatchesSelections = useCallback((
        row: PreparedPriceRow,
        selections: Record<string, string | null>,
        excludeSectionId?: string,
        options?: { ignoreVerticalSelection?: boolean },
    ) => {
        for (const section of selectorSections) {
            if (section.id === excludeSectionId) continue;
            if (!mappableSectionIds.has(section.id)) continue;

            if (options?.ignoreVerticalSelection && section.id === pricingStructure.vertical_axis.sectionId) {
                continue;
            }

            const selectedValueId = selections[section.id];
            if (!selectedValueId) continue;

            if (section.id === pricingStructure.vertical_axis.sectionId) {
                if (!row.verticalIds.includes(selectedValueId)) return false;
                continue;
            }

            const rowValueId = getSectionValueIdForPreparedRow(section.id, row);
            if (rowValueId !== selectedValueId) return false;
        }

        return true;
    }, [selectorSections, mappableSectionIds, pricingStructure.vertical_axis.sectionId, getSectionValueIdForPreparedRow]);

    const availableValueIdsBySection = useMemo(() => {
        const map: Record<string, Set<string>> = {};

        selectorSections.forEach(section => {
            const configuredIds = new Set((section.valueIds || []).map(id => String(id)));

            // Sections not represented in price rows should keep all configured values visible.
            if (!mappableSectionIds.has(section.id)) {
                map[section.id] = configuredIds;
                return;
            }

            const available = new Set<string>();
            const ignoreVerticalSelection = section.id !== pricingStructure.vertical_axis.sectionId;
            const currentSectionOrder = sectionOrderById[section.id] ?? 0;
            const upstreamSelections = Object.fromEntries(
                Object.entries(pricingSelectedSectionValues).filter(([selectedSectionId]) => {
                    if (selectedSectionId === pricingStructure.vertical_axis.sectionId) return true;
                    if (selectedSectionId === section.id) return false;
                    return (sectionOrderById[selectedSectionId] ?? 0) < currentSectionOrder;
                })
            );
            availabilityPreparedPrices.forEach(row => {
                if (!rowMatchesSelections(row, upstreamSelections, section.id, { ignoreVerticalSelection })) return;

                if (section.id === pricingStructure.vertical_axis.sectionId) {
                    row.verticalIds.forEach(valueId => {
                        if (configuredIds.has(valueId)) available.add(valueId);
                    });
                    return;
                }

                const rowValueId = getSectionValueIdForPreparedRow(section.id, row);
                if (rowValueId && configuredIds.has(rowValueId)) {
                    available.add(rowValueId);
                }
            });

            map[section.id] = available;
        });

        return map;
    }, [
        selectorSections,
        sectionOrderById,
        mappableSectionIds,
        availabilityPreparedPrices,
        rowMatchesSelections,
        pricingSelectedSectionValues,
        pricingStructure.vertical_axis.sectionId,
        getSectionValueIdForPreparedRow,
    ]);

    const isValueCurrentlyAvailable = useCallback((sectionId: string, valueId: string) => {
        const available = availableValueIdsBySection[sectionId];
        if (!available || available.size === 0) return true;
        return available.has(String(valueId));
    }, [availableValueIdsBySection]);

    useEffect(() => {
        if (availabilityLoading) return;
        setSelectedSectionValues(prev => {
            let changed = false;
            const next = { ...prev };

            selectorSections.forEach(section => {
                if (section.id === pricingStructure.vertical_axis.sectionId) return;
                if (isOptionalSectionId(section.id)) return;

                const available = availableValueIdsBySection[section.id];
                if (!available || available.size === 0) return;

                const current = next[section.id];
                if (current && available.has(String(current))) return;

                const nextValue = (section.valueIds || []).find(valueId => available.has(String(valueId))) || null;
                if (nextValue !== current) {
                    next[section.id] = nextValue;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [availableValueIdsBySection, availabilityLoading, isOptionalSectionId, pricingStructure.vertical_axis.sectionId, selectorSections]);

    const priceIndexByVerticalQty = useMemo(() => {
        const index = new Map<string, PreparedPriceRow[]>();
        matrixPreparedPrices.forEach(row => {
            row.verticalIds.forEach(verticalId => {
                const key = `${verticalId}::${row.quantity}`;
                const list = index.get(key);
                if (list) list.push(row);
                else index.set(key, [row]);
            });
        });
        return index;
    }, [matrixPreparedPrices]);

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

    const getDisplayValueName = useCallback((valueId: string, sectionId?: string): string => {
        const fallback = attributeValueById[valueId]?.name || valueId;
        if (sectionId === pricingStructure.vertical_axis.sectionId) {
            const verticalName = pricingStructure.vertical_axis.valueSettings?.[valueId]?.displayName?.trim();
            return verticalName || fallback;
        }
        const sectionName = sectionId ? valueSettingsById[sectionId]?.[valueId]?.displayName?.trim() : "";
        return sectionName || fallback;
    }, [attributeValueById, pricingStructure.vertical_axis.sectionId, pricingStructure.vertical_axis.valueSettings, valueSettingsById]);

    const selectedVariantDisplayParts = useMemo(() => {
        return Object.entries(pricingSelectedSectionValues)
            .filter(([sectionId, valueId]) => sectionId !== pricingStructure.vertical_axis.sectionId && !!valueId)
            .map(([sectionId, valueId]) => ({
                valueId: String(valueId),
                label: getDisplayValueName(String(valueId), sectionId),
            }))
            .filter((entry) => !!entry.label);
    }, [getDisplayValueName, pricingSelectedSectionValues, pricingStructure.vertical_axis.sectionId]);

    const sortValuesForDisplay = useCallback((sectionId: string, values: AttributeValue[]): AttributeValue[] => {
        const groupName = (sectionGroupNameById[sectionId] || '').toLowerCase();
        const sectionTitle = (sectionById[sectionId]?.title || '').toLowerCase();
        const isPageLike = groupName.includes('page') || groupName.includes('sider') || groupName.includes('side') || sectionTitle.includes('page') || sectionTitle.includes('sider') || sectionTitle.includes('side');
        if (!isPageLike || values.length <= 1) return values;

        const numericValue = (label: string): number | null => {
            const match = String(label || '').match(/(\d+(?:[.,]\d+)?)/);
            if (!match) return null;
            const parsed = Number.parseFloat(match[1].replace(',', '.'));
            return Number.isFinite(parsed) ? parsed : null;
        };

        return [...values].sort((a, b) => {
            const aValue = numericValue(a.name);
            const bValue = numericValue(b.name);
            if (aValue != null && bValue != null && aValue !== bValue) {
                return aValue - bValue;
            }
            return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true });
        });
    }, [sectionById, sectionGroupNameById]);

    useEffect(() => {
        if (!onSelectionSummary) return;
        const verticalSectionId = pricingStructure.vertical_axis.sectionId;
        const summaryParts: string[] = [];

        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                if (col.id === verticalSectionId) return;
                if (isHiddenColumn(col)) return;
                const selectedValueId = selectedSectionValues[col.id];
                if (selectedValueId) {
                    summaryParts.push(getDisplayValueName(selectedValueId, col.id));
                }
            });
        });

        onSelectionSummary(summaryParts);
    }, [onSelectionSummary, pricingStructure, selectedSectionValues, getDisplayValueName]);

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

    const getVisibleValuesForSection = useCallback((
        sectionId: string,
        values: AttributeValue[],
        selections: Record<string, string | null>,
    ): AttributeValue[] => {
        let visibleValues = values;
        const groupName = (sectionGroupNameById[sectionId] || '').toLowerCase();

        if (groupName === 'sider' && foldSectionIdForFolders) {
            const selectedFoldId = selections[foldSectionIdForFolders];
            const selectedFoldName = selectedFoldId ? getValueName(selectedFoldId) : '';
            const allowedPages = getAllowedFolderPageNames(selectedFoldName);
            if (allowedPages && allowedPages.length > 0) {
                const allowedSet = new Set(allowedPages.map(name => name.toLowerCase()));
                const filtered = visibleValues.filter(value => allowedSet.has(value.name.toLowerCase()));
                if (filtered.length > 0) {
                    visibleValues = filtered;
                }
            }
        }

        return sortValuesForDisplay(sectionId, visibleValues);
    }, [
        sectionGroupNameById,
        foldSectionIdForFolders,
        getValueName,
        getAllowedFolderPageNames,
        sortValuesForDisplay,
    ]);

    // Keep selections valid as folders/options/finishes change.
    useEffect(() => {
        setSelectedSectionValues(prev => {
            let changed = false;
            const next = { ...prev };

            selectorSections.forEach(section => {
                const allValues = getSectionValues(section.groupId, section.valueIds);
                const visibleValues = getVisibleValuesForSection(section.id, allValues, next);
                const currentValue = next[section.id];
                const isCurrentVisible = !!currentValue && visibleValues.some(value => value.id === currentValue);

                if (isCurrentVisible) return;

                if (isOptionalSectionId(section.id)) {
                    if (currentValue != null) {
                        delete next[section.id];
                        changed = true;
                    }
                    return;
                }

                if (visibleValues.length > 0) {
                    next[section.id] = visibleValues[0].id;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [
        selectorSections,
        getSectionValues,
        getVisibleValuesForSection,
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
        const selectedSectionPairs = selectorSections
            .filter(section => section.id !== pricingStructure.vertical_axis.sectionId)
            .filter(section => mappableSectionIds.has(section.id))
            .map(section => {
                const valueId = pricingSelectedSectionValues[section.id];
                return valueId ? { sectionId: section.id, valueId } : null;
            })
            .filter((entry): entry is { sectionId: string; valueId: string } => !!entry);

        // Row labels are vertical axis values
        const allRows: string[] = vertAxis.valueIds
            .map(vId => getDisplayValueName(vId, vertAxis.sectionId))
            .filter(Boolean);

        const columns = [...quantities].sort((a, b) => a - b);
        const cells: Record<string, Record<number, number>> = {};

        // For each vertical axis value, find matching price
        for (const vertValueId of vertAxis.valueIds) {
            const rowLabel = getDisplayValueName(vertValueId, vertAxis.sectionId);
            if (!rowLabel) continue;

            cells[rowLabel] = {};

            for (const qty of columns) {
                const bucketKey = `${vertValueId}::${qty}`;
                const candidateRows = priceIndexByVerticalQty.get(bucketKey) || [];
                let matchingPrice = candidateRows.find(row =>
                    selectedSectionPairs.every(({ sectionId, valueId }) => {
                        const rowValueId = getSectionValueIdForPreparedRow(sectionId, row);
                        return rowValueId === valueId;
                    })
                );

                // Legacy fallback: variant-key matching for rows that don't map cleanly by section.
                if (!matchingPrice) {
                    matchingPrice = candidateRows.find(row =>
                    matchesPreparedPriceForSelection(row, {
                        variantKey: selectedVariantKey,
                        variantKeyNorm: selectedVariantKeyNorm,
                        variantValueIds: selectedVariantValueIds,
                        variantDisplayParts: selectedVariantDisplayParts,
                        formatId: selectedFormatId,
                        materialId: selectedMaterialId,
                        verticalValueId: vertValueId,
                        quantity: qty,
                    })
                    );
                }

                if (matchingPrice) {
                    cells[rowLabel][qty] = matchingPrice.price;
                }
            }
        }

        // Keep row count stable to avoid layout jump while selections/prices update.
        const rows = allRows;

        return { rows, columns, cells };
    }, [computeVariantKey, getDisplayValueName, getSectionValueIdForPreparedRow, matchesPreparedPriceForSelection, mappableSectionIds, normalizeVariantKey, priceIndexByVerticalQty, pricingSelectedSectionValues, pricingStructure, selectedFormatId, selectedMaterialId, selectedVariantDisplayParts, selectedVariantValueIds, selectorSections]);

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
        const variantKey = buildVariantKeyFromSelections(normalizeSelectionsForPricing(updated));

        onSelectionChange(updated, formatId, materialId, { variantKey, verticalValueId });
    }, [buildVariantKeyFromSelections, normalizeSelectionsForPricing, onSelectionChange, pricingStructure]);

    useEffect(() => {
        emitSelectionChange(selectedSectionValues);
    }, [selectedSectionValues, emitSelectionChange]);

    useEffect(() => {
        if (!PRICING_SHADOW_READ_ENABLED) return;
        if (settings.isLoading) return;
        if (matrixLoading) return;
        if (!selectedCell) return;
        if (!selectedFormatId || !selectedMaterialId) return;

        const currentMatrixPrice = matrixData.cells[selectedCell.row]?.[selectedCell.column] ?? null;
        if (currentMatrixPrice == null) return;

        const tenantId = settings.data?.id || "00000000-0000-0000-0000-000000000000";
        const selectedVerticalValueId = pricingSelectedSectionValues[pricingStructure.vertical_axis.sectionId] || null;
        const expectedRowLabel = selectedVerticalValueId
            ? getDisplayValueName(selectedVerticalValueId, pricingStructure.vertical_axis.sectionId)
            : null;

        if (expectedRowLabel && selectedCell.row !== expectedRowLabel) {
            return;
        }

        const requestSignature = JSON.stringify({
            productId,
            tenantId,
            formatId: selectedFormatId,
            materialId: selectedMaterialId,
            quantity: selectedCell.column,
            variantValueIds: selectedVariantValueIds,
            selectedSectionValues: pricingSelectedSectionValues,
            verticalValueId: selectedVerticalValueId,
            row: selectedCell.row,
        });

        if (pricingShadowSignatureRef.current === requestSignature) return;

        let active = true;
        const timeout = window.setTimeout(async () => {
            if (!active) return;
            pricingShadowSignatureRef.current = requestSignature;
            try {
                const result = await fetchPricingRead({
                    tenantId,
                    productId,
                    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
                    pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
                    formatId: selectedFormatId,
                    materialId: selectedMaterialId,
                    verticalValueId: selectedVerticalValueId || undefined,
                    variantKey: selectedVariantKey,
                    quantity: selectedCell.column,
                    variantValueIds: selectedVariantValueIds,
                    variantDisplayLabels: selectedVariantDisplayParts.map((entry) => entry.label),
                    selectedSectionValues: pricingSelectedSectionValues,
                });

                if (!active || !result?.success) return;

                const apiPrice = Number(result.bestMatch?.price_dkk || 0);
                const uiPrice = Number(currentMatrixPrice || 0);
                const matchedRows = Number(result.summary?.matchedRows || 0);

                if (!result.bestMatch || matchedRows === 0) {
                    console.warn("[Matrix V1][shadow-read] pricing-read mismatch", {
                        productId,
                        tenantId,
                        reason: "no_best_match",
                        request: result.request,
                        ui: {
                            row: selectedCell.row,
                            quantity: selectedCell.column,
                            price: uiPrice,
                        },
                        api: {
                            matchedRows,
                            bestMatch: result.bestMatch,
                        },
                    });
                    return;
                }

                if (Math.round(apiPrice) !== Math.round(uiPrice)) {
                    console.warn("[Matrix V1][shadow-read] pricing-read mismatch", {
                        productId,
                        tenantId,
                        reason: "price_mismatch",
                        request: result.request,
                        ui: {
                            row: selectedCell.row,
                            quantity: selectedCell.column,
                            price: uiPrice,
                        },
                        api: {
                            matchedRows,
                            price: apiPrice,
                            bestMatch: result.bestMatch,
                        },
                    });
                    return;
                }

                console.debug("[Matrix V1][shadow-read] pricing-read ok", {
                    productId,
                    tenantId,
                    quantity: selectedCell.column,
                    price: uiPrice,
                    matchedRows,
                    request: result.request,
                });
            } catch (error) {
                if (!active) return;
                console.warn("[Matrix V1][shadow-read] pricing-read failed", {
                    productId,
                    tenantId,
                    error,
                    selection: {
                        formatId: selectedFormatId,
                        materialId: selectedMaterialId,
                        quantity: selectedCell.column,
                        variantValueIds: selectedVariantValueIds,
                    },
                });
            }
        }, 250);

        return () => {
            active = false;
            window.clearTimeout(timeout);
        };
    }, [
        settings.isLoading,
        settings.data?.id,
        matrixLoading,
        productId,
        selectedCell,
        selectedFormatId,
        selectedMaterialId,
        selectedVariantValueIds,
        selectedVariantKey,
        selectedVariantDisplayParts,
        pricingSelectedSectionValues,
        pricingStructure.vertical_axis.sectionId,
        matrixData.cells,
        getDisplayValueName,
    ]);

    // Handle section selection change
    const handleSectionSelect = (sectionId: string, valueId: string) => {
        if (!isValueCurrentlyAvailable(sectionId, valueId)) return;
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
        const visibleValues = getVisibleValuesForSection(sectionId, values, selectedSectionValues);
        const valueSettings = valueSettingsById[sectionId] || {};
        const thumbnailPx = resolveThumbnailSizePx(
            sectionThumbnailConfigById[sectionId]?.size,
            sectionThumbnailConfigById[sectionId]?.customPx
        );
        const isActive = !isOptional || isOptionalEnabled;

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
                    {visibleValues.map(v => {
                        const isAvailable = isValueCurrentlyAvailable(sectionId, v.id);
                        return (
                            <option key={v.id} value={v.id} disabled={!isAvailable}>
                                {getDisplayValueName(v.id, sectionId)}
                            </option>
                        );
                    })}
                </select>
            );
        }

        if (uiMode === 'checkboxes') {
            return (
                <div className={cn("space-y-1", !isActive && "opacity-60 pointer-events-none")}>
                    {visibleValues.map(v => {
                        const isSelected = selectedValue === v.id;
                        const isAvailable = isValueCurrentlyAvailable(sectionId, v.id);
                        const displayName = getDisplayValueName(v.id, sectionId);
                        return (
                            <label
                                key={v.id}
                                className={cn(
                                    "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                                    isSelected ? "bg-primary/10 border-primary" : "bg-background border-muted hover:border-muted-foreground/30",
                                    !isAvailable && "opacity-45 cursor-not-allowed"
                                )}
                                onClick={() => {
                                    if (!isAvailable) return;
                                    handleSectionSelect(sectionId, v.id);
                                }}
                            >
                                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                {valueSettings[v.id]?.showThumbnail && valueSettings[v.id]?.customImage && (
                                    <img
                                        src={getHiResThumbnailUrl(
                                            valueSettings[v.id].customImage,
                                            thumbnailPx,
                                            thumbnailPx
                                        )}
                                        alt={displayName}
                                        className="rounded object-cover shrink-0"
                                        style={{ width: thumbnailPx, height: thumbnailPx }}
                                    />
                                )}
                                <span className="font-medium">{displayName}</span>
                            </label>
                        );
                    })}
                </div>
            );
        }

        // Picture grid display (small / medium / large / xl + xl_notext)
        if (['small', 'medium', 'large', 'xl', 'xl_notext'].includes(uiMode)) {
            const pictureMode = uiMode === 'xl_notext' ? 'xl' : uiMode;
            const size = PICTURE_SIZES[pictureMode as PictureSizeMode] || PICTURE_SIZES.medium;
            const showPictureLabel = pictureMode !== 'small' && uiMode !== 'xl_notext';
            return (
                <div className={cn("flex flex-wrap gap-2", !isActive && "opacity-60 pointer-events-none")}>
                    {visibleValues.map(v => {
                        const pictureKey = `${sectionId}:${v.id}`;
                        const isHovered = hoveredPictureKey === pictureKey;
                        const isSelected = selectedValue === v.id;
                        const thumbUrl = valueSettings[v.id]?.customImage;
                        const displayName = getDisplayValueName(v.id, sectionId);
                        const isAvailable = isValueCurrentlyAvailable(sectionId, v.id);
                        const hoverActive = pictureButtonsConfig.hoverEnabled && isHovered && !isSelected;
                        const overlayBg = isSelected
                            ? hexToRgba(pictureButtonsConfig.selectedColor, pictureButtonsConfig.selectedOpacity)
                            : hoverActive
                                ? hexToRgba(pictureButtonsConfig.hoverColor, pictureButtonsConfig.hoverOpacity)
                                : "transparent";
                        const borderColor = !pictureButtonsConfig.outlineEnabled
                            ? "transparent"
                            : isSelected
                                ? hexToRgba(pictureButtonsConfig.selectedColor, pictureButtonsConfig.outlineOpacity)
                                : hoverActive
                                    ? hexToRgba(pictureButtonsConfig.hoverColor, pictureButtonsConfig.outlineOpacity)
                                    : "transparent";
                        const scale = pictureButtonsConfig.hoverZoomEnabled && isHovered
                            ? pictureButtonsConfig.hoverZoomScale
                            : 1;
                        return (
                            <button
                                key={v.id}
                                onClick={() => handleSectionSelect(sectionId, v.id)}
                                disabled={!isActive || !isAvailable}
                                onMouseEnter={() => setHoveredPictureKey(pictureKey)}
                                onMouseLeave={() => setHoveredPictureKey((prev) => prev === pictureKey ? null : prev)}
                                className={cn(
                                    "relative rounded-lg border-2 transition-all flex flex-col items-center overflow-hidden",
                                    isSelected ? "shadow-none" : "",
                                    (!isActive || !isAvailable) && "cursor-not-allowed opacity-45"
                                )}
                                style={{
                                    width: size.width,
                                    minHeight: size.height + (showPictureLabel ? 22 : 0),
                                    backgroundColor: overlayBg,
                                    borderColor,
                                    transform: `scale(${scale})`,
                                    transitionDuration: `${pictureButtonsConfig.hoverZoomDurationMs}ms`,
                                }}
                            >
                            {thumbUrl ? (
                                <img
                                    src={getHiResThumbnailUrl(thumbUrl, size.width, size.height)}
                                    alt={displayName}
                                    className="w-full object-cover rounded-t-md"
                                    style={{ height: size.height }}
                                />
                                ) : (
                                    <div
                                        className={cn(
                                            "w-full flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground rounded-t-md",
                                            isSelected && "bg-accent text-foreground"
                                        )}
                                        style={{ height: size.height }}
                                    >
                                    {(displayName || '?').slice(0, 3).toUpperCase()}
                                </div>
                            )}
                            {showPictureLabel && (
                                <span className="text-[10px] leading-tight text-center truncate w-full px-1 py-0.5">
                                    {displayName}
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
                    const isAvailable = isValueCurrentlyAvailable(sectionId, v.id);
                    const displayName = getDisplayValueName(v.id, sectionId);
                    return (
                        <Button
                            key={v.id}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                "h-9 px-3 text-sm gap-2",
                                isSelected && "bg-primary hover:bg-primary/90",
                                !isAvailable && "opacity-45"
                            )}
                            onClick={() => handleSectionSelect(sectionId, v.id)}
                            disabled={!isActive || !isAvailable}
                        >
                            {valueSettings[v.id]?.showThumbnail && valueSettings[v.id]?.customImage && (
                                <img
                                src={getHiResThumbnailUrl(
                                    valueSettings[v.id].customImage,
                                    thumbnailPx,
                                    thumbnailPx
                                )}
                                alt={displayName}
                                className="rounded object-cover shrink-0"
                                style={{ width: thumbnailPx, height: thumbnailPx }}
                            />
                        )}
                            {displayName}
                        </Button>
                    );
                })}
            </div>
        );
    };

    if (matrixLoading && !hasResolvedPriceRows) {
        return (
            <div className="space-y-6 min-h-[560px]">
                <div className="h-4 text-xs text-muted-foreground" aria-live="polite">
                    Opdaterer priser...
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="space-y-2 rounded bg-muted/20 p-3">
                                <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 3 }).map((__, valueIndex) => (
                                        <div
                                            key={valueIndex}
                                            className="h-9 w-24 rounded-md bg-muted/60 animate-pulse"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 min-h-[320px]">
                        <div className="grid grid-cols-5 gap-2">
                            {Array.from({ length: 20 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="h-10 rounded bg-muted/60 animate-pulse"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="h-4 text-xs text-muted-foreground" aria-live="polite">
                {matrixLoading ? 'Opdaterer priser...' : '\u00A0'}
            </div>
            {/* Render layout rows */}
            <div className="space-y-4">
                {pricingStructure.layout_rows.map((row) => {
                    const filteredColumns = row.columns.filter(
                        col => col.id !== pricingStructure.vertical_axis.sectionId
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
                                    const visibleValues = getVisibleValuesForSection(col.id, values, selectedSectionValues);
                                    if (visibleValues.length === 0) return null;
                                    const sectionLabel = col.title || getSectionTypeLabel(col.sectionType);
                                    const uiMode = col.ui_mode || 'buttons';
                                    const isOptional = isOptionalSectionId(col.id);
                                    const isOptionalEnabled = isOptional && !!selectedSectionValues[col.id];

                                    const handleOptionalToggle = (checked: boolean) => {
                                        if (!isOptional) return;
                                        if (checked) {
                                            const firstSelectableValue = visibleValues.find((value) =>
                                                isValueCurrentlyAvailable(col.id, value.id)
                                            ) || visibleValues[0];
                                            if (!selectedSectionValues[col.id] && firstSelectableValue) {
                                                handleSectionSelect(col.id, firstSelectableValue.id);
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
                                            {renderValueSelector(col.id, visibleValues, uiMode, isOptionalEnabled)}
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
