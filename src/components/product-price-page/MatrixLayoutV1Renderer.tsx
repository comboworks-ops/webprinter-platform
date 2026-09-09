/**
 * MatrixLayoutV1Renderer - Renders product pricing from pricing_structure.mode === 'matrix_layout_v1'
 * 
 * This component:
 * 1. Renders selector UI from layout_rows (each row with multiple columns/sections)
 * 2. Maintains selectedSectionValues state (sectionId -> valueId)
 * 3. Computes activeVariantKey from selections
 * 4. Queries generic_product_prices and builds the price matrix
 */

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PriceMatrix } from "@/components/product-price-page/PriceMatrix";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { normalizeThumbnailCustomPx, normalizeThumbnailSize, resolveThumbnailSizePx } from "@/lib/pricing/thumbnailSizes";
import { getHiResThumbnailUrl } from "@/lib/pricing/thumbnailImageUrl";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { getMatrixStyleVars } from "@/lib/branding/matrix";
import { readTransientString, writeTransientString } from "@/lib/storage/transientStorage";
import { fetchPricingRead } from "@/lib/api/pricingRead";
import {
    getOptionImageUrl,
    resolvePictureButtonsConfig,
    resolvePictureButtonStateStyles,
    resolveSelectorBoxConfig,
    resolveTextButtonsConfig,
} from "@/lib/pricing/selectorStyling";
import { getApparelColorOption } from "@/lib/designer/apparelDesigner";
import { CheckCircle2, Shirt } from "lucide-react";
import { getBuiltInOptionImage } from "@/lib/pricing/builtInOptionImages";
import { findEmbeddedAdaptiveSelectorSectionId } from "@/lib/pricing/focusedAdaptiveSelector";
import {
    resolveClosestExactCombination,
    type ExactCombinationCandidate,
} from "@/lib/pricing/exactCombinationResolver";
import { shouldShowInitialMatrixSkeleton } from "@/lib/pricing/matrixLoadingPresentation";
import { resolveSelectorValueGroups } from "@/lib/pricing/selectorValueGroups";
import {
    getBuiltInCalendarOptionArtworkLabel,
    getBuiltInCalendarOptionImage,
    type CalendarOptionArtworkLabel,
} from "@/lib/pricing/builtInCalendarOptionImages";
import {
    getBuiltInOptionBrandBadge,
    type OptionBrandBadge,
} from "@/lib/pricing/builtInOptionBrandBadges";

// Types from pricing structure
type ValueSetting = {
    showThumbnail?: boolean;
    customImage?: string;
    preferCustomImage?: boolean;
    prefer_custom_image?: boolean;
    hoverImage?: string;
    imageSizePx?: number;
    brandBadgeImage?: string;
    brandBadgeAlt?: string;
    brandBadgeLabel?: string;
    brandBadgeBackgroundColor?: string;
    displayName?: string;
    backgroundColor?: string;
    hoverBackgroundColor?: string;
    borderColor?: string;
    hoverBorderColor?: string;
    borderRadiusPx?: number;
    borderWidthPx?: number;
    textColor?: string;
    hoverTextColor?: string;
    fontSizePx?: number;
    paddingPx?: number;
    minHeightPx?: number;
};

interface VerticalAxisConfig {
    sectionId: string;
    sectionType: string;
    groupId: string;
    valueIds: string[];
    valueSettings?: Record<string, ValueSetting>;
    selectorStyling?: {
        textButtons?: Record<string, unknown>;
        pictureButtons?: Record<string, unknown>;
        selectorBox?: Record<string, unknown>;
    };
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
    selection_mode?: 'required' | 'optional' | 'free';
    valueSettings?: Record<string, ValueSetting>;
    selectorStyling?: {
        textButtons?: Record<string, unknown>;
        pictureButtons?: Record<string, unknown>;
        selectorBox?: Record<string, unknown>;
    };
    valueGroups?: Array<{ id: string; label: string; valueIds: string[] }>;
    value_groups?: Array<{ id: string; label: string; valueIds: string[] }>;
    labelOverride?: string;
    title?: string;
    description?: string;
    thumbnail_size?: 'small' | 'medium' | 'large' | 'xl';
    thumbnail_custom_px?: number;
    hideUnavailableValues?: boolean;
    hide_unavailable_values?: boolean;
    preferCustomImage?: boolean;
    prefer_custom_image?: boolean;
    focusSelectedValue?: boolean;
    focus_selected_value?: boolean;
    neutralWhiteSurface?: boolean;
    neutral_white_surface?: boolean;
    adaptiveImageSelector?: boolean;
    adaptive_image_selector?: boolean;
    hideSingleAvailableValue?: boolean;
    hide_single_available_value?: boolean;
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
    autoResolveExactCombination?: boolean;
    auto_resolve_exact_combination?: boolean;
    customerSelectionOrder?: string[];
    templateBinding?: {
        profile?: string;
        axisSections?: Record<string, string>;
    };
    hideUnavailableQuantities?: boolean;
    hide_unavailable_quantities?: boolean;
}

type AttributeValueMeta = {
    image?: string;
    descriptionDa?: string;
    formatLabels?: string[];
    materialLabels?: string[];
    fillingLabels?: string[];
    printLabelDa?: string;
    presentationKind?: 'filling' | 'format' | string;
    sourceSelections?: Record<string, unknown>;
};

interface AttributeValue {
    id: string;
    name: string;
    enabled: boolean;
    meta?: AttributeValueMeta;
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

type SectionRuntimeConfig = {
    uiMode?: string;
    displayMode?: string;
    hideUnavailableValues?: boolean;
    hide_unavailable_values?: boolean;
    preferCustomImage?: boolean;
    prefer_custom_image?: boolean;
    focusSelectedValue?: boolean;
    focus_selected_value?: boolean;
    neutralWhiteSurface?: boolean;
    neutral_white_surface?: boolean;
    adaptiveImageSelector?: boolean;
    adaptive_image_selector?: boolean;
    hideSingleAvailableValue?: boolean;
    hide_single_available_value?: boolean;
};

const isOptionalSelectionMode = (mode?: 'required' | 'optional' | 'free') => mode === 'optional';
const isPriceNeutralSectionType = (sectionType?: string) => sectionType !== 'formats' && sectionType !== 'materials';

const prefersConfiguredOptionImage = (
    valueSetting: ValueSetting | undefined,
    sectionPrefersCustomImage?: boolean,
) => Boolean(
    sectionPrefersCustomImage
    || valueSetting?.preferCustomImage
    || valueSetting?.prefer_custom_image
);

const getResolvedOptionImageUrl = (
    valueSetting: ValueSetting | undefined,
    valueName: string,
    options?: {
        allowBuiltInCalendarArtwork?: boolean;
        preferCustomImage?: boolean;
        fallbackImage?: string;
    },
) => {
    const configuredImage = getOptionImageUrl(valueSetting, options?.fallbackImage);
    const builtInCalendarImage = options?.allowBuiltInCalendarArtwork
        ? getBuiltInCalendarOptionImage(valueName)
        : undefined;
    const preferCustomImage = prefersConfiguredOptionImage(valueSetting, options?.preferCustomImage);

    if (preferCustomImage && configuredImage) return configuredImage;
    return builtInCalendarImage || configuredImage || getBuiltInOptionImage(valueName);
};

const getResolvedOptionBrandBadge = (
    valueSetting: ValueSetting | undefined,
    valueName: string,
    allowBuiltInCalendarArtwork: boolean,
): OptionBrandBadge | undefined => {
    const builtInBadge = allowBuiltInCalendarArtwork
        ? getBuiltInOptionBrandBadge(valueName)
        : undefined;
    if (!valueSetting?.brandBadgeImage) return builtInBadge;

    return {
        imageUrl: valueSetting.brandBadgeImage,
        alt: valueSetting.brandBadgeAlt || builtInBadge?.alt || valueName,
        variantLabel: valueSetting.brandBadgeLabel || builtInBadge?.variantLabel,
        backgroundColor: valueSetting.brandBadgeBackgroundColor || builtInBadge?.backgroundColor,
        shape: builtInBadge?.shape || "wide",
    };
};

function OptionBrandBadgeOverlay({
    badge,
    compact = false,
}: {
    badge: OptionBrandBadge;
    compact?: boolean;
}) {
    const isSquare = badge.shape === "square";

    return (
        <span
            aria-hidden="true"
            title={badge.alt}
            className={cn(
                "pointer-events-none absolute right-1.5 top-1.5 z-20 flex flex-col items-center justify-center overflow-hidden border border-white/90 shadow-[0_2px_9px_rgba(15,23,42,0.2)]",
                isSquare ? "rounded-lg p-0.5" : "rounded-md px-1.5 py-1",
                isSquare
                    ? (compact ? "h-9 w-9" : "h-11 w-11")
                    : (compact ? "h-8 w-[4.25rem]" : "h-10 w-20"),
            )}
            style={{ backgroundColor: badge.backgroundColor || "rgba(255,255,255,0.96)" }}
        >
            <img
                src={badge.imageUrl}
                alt=""
                className={cn(
                    "max-h-full max-w-full object-contain",
                    badge.variantLabel && "max-h-[70%]",
                )}
            />
            {badge.variantLabel && (
                <span className="mt-0.5 text-[7px] font-extrabold leading-none tracking-[0.12em] text-[#5B4636]">
                    {badge.variantLabel}
                </span>
            )}
        </span>
    );
}

function CalendarArtworkLabelOverlay({ label }: { label: CalendarOptionArtworkLabel }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 flex items-center justify-center rounded-sm border border-[#0EA5E9] bg-white px-1 text-center text-[8px] font-extrabold leading-none tracking-[0.08em] text-[#0EA5E9] shadow-sm"
            style={{
                left: label.left,
                top: label.top,
                width: label.width,
                height: label.height,
            }}
        >
            {label.text}
        </span>
    );
}

interface MatrixLayoutV1RendererProps {
    productId: string;
    pricingStructure: MatrixLayoutV1;
    /** Exact documented configurations, normally sourced from connected PDF templates. */
    exactCombinationSelections?: Array<Record<string, string | null>>;
    initialSelection?: Record<string, string | null>;
    initialSelectedRow?: string;
    initialSelectedQuantity?: number;
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

const normalizeMetaStringList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
};

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
        const all: any[] = [];
        let offset = 0;

        while (true) {
            const query = supabase
                .from('generic_product_prices')
                .select('id, variant_name, variant_value, quantity, price_dkk, extra_data')
                .eq('product_id', productId)
                .range(offset, offset + pageSize - 1);

            const { data, error } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                all.push(...data);
            }

            if (!data || data.length === 0) break;
            if (data.length < pageSize) break;
            offset += pageSize;
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
    pricingStructure: basePricingStructure,
    exactCombinationSelections,
    initialSelection,
    initialSelectedRow,
    initialSelectedQuantity,
    onCellClick,
    onSelectionChange,
    onSelectionSummary
}: MatrixLayoutV1RendererProps) {
    const settings = useShopSettings();
    const { branding: previewBranding, productPricingOverrides, isPreviewMode } = usePreviewBranding();
    const activeBranding = (isPreviewMode && previewBranding)
        ? previewBranding
        : settings.data?.branding;
    const pricingStructure = useMemo<MatrixLayoutV1>(() => {
        const previewOverride = isPreviewMode ? productPricingOverrides[productId] : null;
        if (previewOverride && typeof previewOverride === "object" && (previewOverride as MatrixLayoutV1).mode === "matrix_layout_v1") {
            return previewOverride as MatrixLayoutV1;
        }
        return basePricingStructure;
    }, [basePricingStructure, isPreviewMode, productId, productPricingOverrides]);
    const matrixStyleVars = getMatrixStyleVars(activeBranding as any, (pricingStructure as any).matrixBox);

    // State: per-section selections (sectionId -> valueId)
    const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string | null>>(
        () => ({ ...(initialSelection || {}) }),
    );
    const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
    const [availabilityPrices, setAvailabilityPrices] = useState<any[]>([]);
    const [variantPrices, setVariantPrices] = useState<any[]>([]);
    const [variantPricesKey, setVariantPricesKey] = useState<string | null>(null);
    const [availabilityLoading, setAvailabilityLoading] = useState(true);
    const [matrixLoading, setMatrixLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState<{ row: string; column: number } | null>(() => (
        initialSelectedRow && initialSelectedQuantity && initialSelectedQuantity > 0
            ? { row: initialSelectedRow, column: initialSelectedQuantity }
            : null
    ));
    const [hoveredPictureKey, setHoveredPictureKey] = useState<string | null>(null);
    const [focusedSelectionSectionIds, setFocusedSelectionSectionIds] = useState<Set<string>>(() => new Set());

    const lastNotifiedCellRef = useRef<string>("");
    const lastLoadedProductIdRef = useRef<string | null>(null);
    const lastVariantProductIdRef = useRef<string | null>(null);
    const lastPresentedProductIdRef = useRef<string | null>(null);
    const pricingShadowSignatureRef = useRef<string>("");
    const focusedSelectionOptionButtonRefs = useRef(new Map<string, HTMLButtonElement>());
    const focusedSelectionDetailRefs = useRef(new Map<string, HTMLElement>());
    const pendingFocusedSelectionFocusRef = useRef<{
        sectionId: string;
        valueId: string;
    } | null>(null);

    // Merge per-product button styling with global branding (per-product takes precedence)
    const pictureButtonsConfig = useMemo(() => {
        // Per-product settings from pricing_structure
        const productCfg = (pricingStructure as any)?.buttonStyling?.pictureButtons || {};
        // Global branding settings
        const globalCfg = activeBranding?.productPage?.matrix?.pictureButtons || {};
        // Merge: product settings override global
        const cfg = { ...globalCfg, ...productCfg };
        
        return {
            // New display options
            size: cfg.size || 'medium',
            displayMode: cfg.displayMode || 'text_and_image',
            imageBorderRadiusPx: cfg.imageBorderRadiusPx ?? 8,
            gapBetweenPx: cfg.gapBetweenPx ?? 12,
            transparentBackground: cfg.transparentBackground === true,
            labelOutsideImage: cfg.labelOutsideImage === true,
            labelFontSizePx: cfg.labelFontSizePx ?? 11,
            backgroundColor: cfg.backgroundColor || "#FFFFFF",
            hoverBackgroundColor: cfg.hoverBackgroundColor || "#F1F5F9",
            textColor: cfg.textColor || "#1F2937",
            hoverTextColor: cfg.hoverTextColor || "#0EA5E9",
            borderWidthPx: cfg.borderWidthPx ?? 1,
            borderColor: cfg.borderColor || "#E2E8F0",
            hoverBorderColor: cfg.hoverBorderColor || cfg.hoverColor || activeBranding?.colors?.hover || activeBranding?.colors?.primary || "#0EA5E9",
            selectedBorderColor: cfg.selectedBorderColor || cfg.selectedColor || activeBranding?.colors?.primary || "#0EA5E9",
            selectedRingColor: cfg.selectedRingColor || cfg.selectedColor || activeBranding?.colors?.primary || "#0EA5E9",
            hoverEffect: cfg.hoverEffect || 'fill',
            selectedEffect: cfg.selectedEffect || 'ring',
            // Existing hover effects
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
    }, [pricingStructure, activeBranding?.productPage?.matrix?.pictureButtons, activeBranding?.colors?.hover, activeBranding?.colors?.primary]);

    // Text button styling (per-product overrides global)
    const textButtonsConfig = useMemo(() => {
        // Per-product settings from pricing_structure
        const productCfg = (pricingStructure as any)?.buttonStyling?.textButtons || {};
        // Global branding settings
        const globalCfg = activeBranding?.productPage?.matrix?.textButtons || {};
        // Merge: product settings override global
        const cfg = { ...globalCfg, ...productCfg };
        
        return {
            backgroundColor: cfg.backgroundColor || "#FFFFFF",
            hoverBackgroundColor: cfg.hoverBackgroundColor || "#F1F5F9",
            textColor: cfg.textColor || "#1F2937",
            hoverTextColor: cfg.hoverTextColor || "#0EA5E9",
            selectedBackgroundColor: cfg.selectedBackgroundColor || "#0EA5E9",
            selectedTextColor: cfg.selectedTextColor || "#FFFFFF",
            borderRadiusPx: cfg.borderRadiusPx ?? 8,
            borderWidthPx: cfg.borderWidthPx ?? 1,
            borderColor: cfg.borderColor || "#E2E8F0",
            hoverBorderColor: cfg.hoverBorderColor || "#0EA5E9",
            paddingPx: cfg.paddingPx ?? 12,
            fontSizePx: cfg.fontSizePx ?? 14,
            minHeightPx: cfg.minHeightPx ?? 44,
        };
    }, [pricingStructure, activeBranding?.productPage?.matrix?.textButtons]);
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

    const sectionConfigs = useMemo<Record<string, SectionRuntimeConfig>>(() => (
        (pricingStructure as MatrixLayoutV1 & {
            sectionConfigs?: Record<string, SectionRuntimeConfig>;
        }).sectionConfigs || {}
    ), [pricingStructure]);
    
    const sectionUiModeById = useMemo(() => {
        const map: Record<string, string> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                // Check sectionConfigs first (overrides column ui_mode)
                const sectionConfig = sectionConfigs[col.id];
                if (sectionConfig?.uiMode) {
                    map[col.id] = sectionConfig.uiMode;
                } else {
                    const uiMode = (col as any).ui_mode || (col as any).uiMode;
                    if (uiMode) {
                        map[col.id] = uiMode;
                    }
                }
            });
        });
        return map;
    }, [pricingStructure, sectionConfigs]);

    const isHiddenColumn = useCallback((col: LayoutColumn) => {
        // Check sectionConfigs first
        const sectionConfig = sectionConfigs[col.id];
        if (sectionConfig?.uiMode === 'hidden') return true;
        
        const uiMode = (col as any).ui_mode || (col as any).uiMode;
        return uiMode === 'hidden' || (col as any).hidden === true;
    }, [sectionConfigs]);

    const selectionModeById = useMemo(() => {
        const map: Record<string, 'required' | 'optional' | 'free'> = {};
        pricingStructure.layout_rows.forEach(row => {
            row.columns.forEach(col => {
                map[col.id] = col.selection_mode || (col.sectionType === 'finishes' || col.sectionType === 'products' ? 'optional' : 'required');
            });
        });
        return map;
    }, [pricingStructure]);

    const valueSettingsById = useMemo(() => {
        const map: Record<string, Record<string, ValueSetting>> = {};
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
        return isOptionalSelectionMode(selectionModeById[sectionId]);
    }, [selectionModeById]);

    const isPriceNeutralSectionId = useCallback((sectionId: string) => {
        return selectionModeById[sectionId] === 'free' && isPriceNeutralSectionType(sectionTypeById[sectionId]);
    }, [sectionTypeById, selectionModeById]);

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
            .filter(([secId]) => !isPriceNeutralSectionId(secId))
            .map(([_, valId]) => valId)
            .filter((valId): valId is string => !!valId);

        if (values.length === 0) return 'none';
        return values.sort().join('|');
    }, [
        isPriceNeutralSectionId,
        pricingStructure.vertical_axis.sectionId,
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

    const availabilityPricesByVariantKey = useMemo(() => {
        const index = new Map<string, PreparedPriceRow[]>();

        availabilityPreparedPrices.forEach((row) => {
            const keys = new Set([
                row.variantName,
                row.variantNameNorm,
                row.selectionMapVariantSortedKey,
                row.variantValueIdsNorm,
            ].filter(Boolean));

            keys.forEach((key) => {
                const rows = index.get(key);
                if (rows) rows.push(row);
                else index.set(key, [row]);
            });
        });

        return index;
    }, [availabilityPreparedPrices]);

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
    const selectedVariantPreparedPrices = useMemo(() => {
        const normalizedKey = normalizeVariantKey(selectedVariantKey);
        return availabilityPricesByVariantKey.get(selectedVariantKey)
            || availabilityPricesByVariantKey.get(normalizedKey)
            || [];
    }, [availabilityPricesByVariantKey, normalizeVariantKey, selectedVariantKey]);

    const matrixPreparedPrices = useMemo(() => {
        if (selectedVariantPreparedPrices.length > 0) {
            return selectedVariantPreparedPrices;
        }
        if (variantPricesKey === selectedVariantKey && variantPrices.length > 0) {
            return preparePriceRows(variantPrices);
        }
        // Older imports can encode variants by display name instead of IDs.
        return availabilityPreparedPrices;
    }, [availabilityPreparedPrices, preparePriceRows, selectedVariantKey, selectedVariantPreparedPrices, variantPrices, variantPricesKey]);

    const hasResolvedPriceRows = matrixPreparedPrices.length > 0
        || (variantPricesKey === selectedVariantKey && variantPrices.length > 0);

    useEffect(() => {
        if (hasResolvedPriceRows) {
            lastPresentedProductIdRef.current = productId;
        }
    }, [hasResolvedPriceRows, productId]);

    const showInitialMatrixSkeleton = shouldShowInitialMatrixSkeleton({
        productId,
        lastPresentedProductId: lastPresentedProductIdRef.current,
        matrixLoading,
        hasResolvedPriceRows,
    });

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

    const autoResolveExactCombination = pricingStructure.autoResolveExactCombination === true
        || pricingStructure.auto_resolve_exact_combination === true;
    const exactCombinationSectionOrder = useMemo(() => {
        const configuredAxisOrder = Array.isArray(pricingStructure.customerSelectionOrder)
            ? pricingStructure.customerSelectionOrder
            : [];
        const axisSections = pricingStructure.templateBinding?.axisSections || {};
        const knownSectionIds = new Set(selectorSections.map((section) => section.id));
        const orderedSectionIds = configuredAxisOrder
            .map((axis) => axisSections[axis] || axis)
            .filter((sectionId) => knownSectionIds.has(sectionId));

        selectorSections.forEach((section) => {
            if (!orderedSectionIds.includes(section.id)) orderedSectionIds.push(section.id);
        });

        return orderedSectionIds;
    }, [pricingStructure.customerSelectionOrder, pricingStructure.templateBinding?.axisSections, selectorSections]);
    const folderModelSectionId = pricingStructure.templateBinding?.axisSections?.folder_model || null;
    const providedExactCombinationCandidates = useMemo<ExactCombinationCandidate[]>(() => {
        if (!autoResolveExactCombination || !Array.isArray(exactCombinationSelections)) return [];

        const requiredSectionIds = selectorSections
            .filter((section) => !isPriceNeutralSectionId(section.id))
            .map((section) => section.id);
        const unique = new Map<string, ExactCombinationCandidate>();

        exactCombinationSelections.forEach((rawSelections) => {
            if (!rawSelections || typeof rawSelections !== 'object') return;
            const selections: Record<string, string | null> = {};
            requiredSectionIds.forEach((sectionId) => {
                const valueId = rawSelections[sectionId];
                if (typeof valueId === 'string' && valueId) selections[sectionId] = valueId;
            });
            if (!requiredSectionIds.every((sectionId) => !!selections[sectionId])) return;

            const key = requiredSectionIds
                .map((sectionId) => `${sectionId}=${selections[sectionId]}`)
                .join('|');
            if (!unique.has(key)) unique.set(key, { selections });
        });

        return Array.from(unique.values());
    }, [
        autoResolveExactCombination,
        exactCombinationSelections,
        isPriceNeutralSectionId,
        selectorSections,
    ]);
    const hasProvidedExactCompatibility = providedExactCombinationCandidates.length > 0;

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

        // Exact connected templates are a compact, validated compatibility index.
        // They avoid downloading an entire large sparse price table just to decide
        // which selector values can be combined. Active prices are still fetched
        // from generic_product_prices for the selected exact variant below.
        if (hasProvidedExactCompatibility) {
            setAvailabilityPrices([]);
            setAvailabilityLoading(false);
            lastLoadedProductIdRef.current = productId;
            return () => {
                active = false;
            };
        }

        async function fetchAvailabilityPrices() {
            try {
                const all = await fetchPriceRowsCached(productId);
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
    }, [hasProvidedExactCompatibility, productId]);

    useEffect(() => {
        let active = true;

        async function fetchActiveVariantPrices() {
            if (!hasCompleteRequiredSelection) {
                if (active) {
                    setVariantPrices([]);
                    setVariantPricesKey(null);
                    setMatrixLoading(false);
                }
                return;
            }

            // The full table can resolve every button change synchronously. Variant reads are
            // only an initial-load fallback while that table is still being downloaded.
            if (availabilityPreparedPrices.length > 0) {
                if (active) {
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
                    setVariantPricesKey(selectedVariantKey);
                }
            } catch {
                if (active) {
                    setVariantPrices([]);
                    setVariantPricesKey(selectedVariantKey);
                }
            } finally {
                if (active) {
                    setMatrixLoading(false);
                }
            }
        }

        if (lastVariantProductIdRef.current && lastVariantProductIdRef.current !== productId) {
            setVariantPrices([]);
            setVariantPricesKey(null);
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
        availabilityPreparedPrices.length,
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
            if (isPriceNeutralSectionId(section.id)) return;
            if (
                hasProvidedExactCompatibility
                && providedExactCombinationCandidates.some((candidate) => !!candidate.selections[section.id])
            ) {
                ids.add(section.id);
                return;
            }
            const hasAny = availabilityPreparedPrices.some(row => !!getSectionValueIdForPreparedRow(section.id, row));
            if (hasAny) ids.add(section.id);
        });

        return ids;
    }, [
        selectorSections,
        hasProvidedExactCompatibility,
        providedExactCombinationCandidates,
        availabilityPreparedPrices,
        getSectionValueIdForPreparedRow,
        isPriceNeutralSectionId,
    ]);

    const exactCombinationCandidates = useMemo<ExactCombinationCandidate[]>(() => {
        if (!autoResolveExactCombination) return [];
        if (hasProvidedExactCompatibility) return providedExactCombinationCandidates;

        const candidates = new Map<string, ExactCombinationCandidate>();
        availabilityPreparedPrices.forEach((row) => {
            const selections: Record<string, string | null> = {};
            exactCombinationSectionOrder.forEach((sectionId) => {
                if (!mappableSectionIds.has(sectionId)) return;
                selections[sectionId] = getSectionValueIdForPreparedRow(sectionId, row);
            });

            const key = exactCombinationSectionOrder
                .filter((sectionId) => mappableSectionIds.has(sectionId))
                .map((sectionId) => `${sectionId}=${selections[sectionId] || ''}`)
                .join('|');
            if (key && !candidates.has(key)) {
                candidates.set(key, { selections });
            }
        });

        return Array.from(candidates.values());
    }, [
        autoResolveExactCombination,
        hasProvidedExactCompatibility,
        providedExactCombinationCandidates,
        availabilityPreparedPrices,
        exactCombinationSectionOrder,
        getSectionValueIdForPreparedRow,
        mappableSectionIds,
    ]);

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

    const candidateMatchesSelections = useCallback((
        candidate: ExactCombinationCandidate,
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
            if (candidate.selections[section.id] !== selectedValueId) return false;
        }
        return true;
    }, [mappableSectionIds, pricingStructure.vertical_axis.sectionId, selectorSections]);

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
            if (hasProvidedExactCompatibility) {
                providedExactCombinationCandidates.forEach((candidate) => {
                    if (!candidateMatchesSelections(
                        candidate,
                        upstreamSelections,
                        section.id,
                        { ignoreVerticalSelection },
                    )) return;
                    const valueId = candidate.selections[section.id];
                    if (valueId && configuredIds.has(valueId)) available.add(valueId);
                });
                map[section.id] = available;
                return;
            }

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
        hasProvidedExactCompatibility,
        providedExactCombinationCandidates,
        candidateMatchesSelections,
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

    const resolveExactCombinationForValue = useCallback((
        sectionId: string,
        valueId: string,
        currentSelections: Record<string, string | null>,
    ): ExactCombinationCandidate | null => {
        if (!autoResolveExactCombination || exactCombinationCandidates.length === 0) return null;

        return resolveClosestExactCombination({
            candidates: exactCombinationCandidates,
            currentSelections,
            requestedSectionId: sectionId,
            requestedValueId: String(valueId),
            sectionOrder: exactCombinationSectionOrder,
            lockedSectionIds: folderModelSectionId && folderModelSectionId !== sectionId
                ? [folderModelSectionId]
                : [],
        });
    }, [
        autoResolveExactCombination,
        exactCombinationCandidates,
        exactCombinationSectionOrder,
        folderModelSectionId,
    ]);

    const isValueSelectable = useCallback((sectionId: string, valueId: string) => {
        if (autoResolveExactCombination && mappableSectionIds.has(sectionId)) {
            return resolveExactCombinationForValue(sectionId, valueId, selectedSectionValues) != null;
        }
        return isValueCurrentlyAvailable(sectionId, valueId);
    }, [
        autoResolveExactCombination,
        isValueCurrentlyAvailable,
        mappableSectionIds,
        resolveExactCombinationForValue,
        selectedSectionValues,
    ]);

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

    const getSectionBooleanFlag = useCallback((
        sectionId: string,
        camelCaseKey: string,
        snakeCaseKey: string,
    ): boolean => {
        const column = sectionById[sectionId];
        const sectionConfig = sectionConfigs[sectionId] as Record<string, unknown> | undefined;
        return sectionConfig?.[camelCaseKey] === true
            || sectionConfig?.[snakeCaseKey] === true
            || column?.[camelCaseKey] === true
            || column?.[snakeCaseKey] === true;
    }, [sectionById, sectionConfigs]);

    const isCalendarFillingSection = useCallback((sectionId: string): boolean => {
        const section = sectionById[sectionId];
        const identity = [
            sectionId,
            section?.title,
            section?.labelOverride,
            sectionGroupNameById[sectionId],
        ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase('da-DK');

        return /filling|fillings|fyld|chokolade|chocolate|füllung|fuellung|konfekt|slik|indhold|contents?/.test(identity);
    }, [sectionById, sectionGroupNameById]);

    const shouldPreferCustomImage = useCallback((sectionId: string): boolean => (
        getSectionBooleanFlag(sectionId, 'preferCustomImage', 'prefer_custom_image')
    ), [getSectionBooleanFlag]);

    const shouldHideUnavailableValues = useCallback((sectionId: string): boolean => (
        getSectionBooleanFlag(sectionId, 'hideUnavailableValues', 'hide_unavailable_values')
    ), [getSectionBooleanFlag]);

    const shouldFocusSelectedValue = useCallback((sectionId: string): boolean => (
        getSectionBooleanFlag(sectionId, 'focusSelectedValue', 'focus_selected_value')
    ), [getSectionBooleanFlag]);

    const shouldUseNeutralWhiteSurface = useCallback((sectionId: string): boolean => (
        getSectionBooleanFlag(sectionId, 'neutralWhiteSurface', 'neutral_white_surface')
    ), [getSectionBooleanFlag]);

    const shouldUseAdaptiveImageSelector = useCallback((sectionId: string): boolean => (
        getSectionBooleanFlag(sectionId, 'adaptiveImageSelector', 'adaptive_image_selector')
    ), [getSectionBooleanFlag]);

    const shouldHideSingleAvailableValue = useCallback((sectionId: string): boolean => (
        getSectionBooleanFlag(sectionId, 'hideSingleAvailableValue', 'hide_single_available_value')
    ), [getSectionBooleanFlag]);

    const progressiveFocusSectionId = useMemo(() => {
        for (const row of pricingStructure.layout_rows) {
            const focusColumn = row.columns.find((column) => shouldFocusSelectedValue(column.id));
            if (focusColumn) return focusColumn.id;
        }
        return null;
    }, [pricingStructure.layout_rows, shouldFocusSelectedValue]);
    const isProgressiveFocusConfirmed = !progressiveFocusSectionId
        || focusedSelectionSectionIds.has(progressiveFocusSectionId);

    useEffect(() => {
        setFocusedSelectionSectionIds(new Set());
        pendingFocusedSelectionFocusRef.current = null;
    }, [productId]);

    useEffect(() => {
        if (!progressiveFocusSectionId || !initialSelection?.[progressiveFocusSectionId]) return;
        setFocusedSelectionSectionIds((previous) => {
            if (previous.has(progressiveFocusSectionId)) return previous;
            const next = new Set(previous);
            next.add(progressiveFocusSectionId);
            return next;
        });
    }, [initialSelection, progressiveFocusSectionId, productId]);

    useEffect(() => {
        const pending = pendingFocusedSelectionFocusRef.current;
        if (!pending || typeof window === 'undefined') return;

        const frame = window.requestAnimationFrame(() => {
            const selectedButton = focusedSelectionOptionButtonRefs.current.get(`${pending.sectionId}:${pending.valueId}`);
            const detail = focusedSelectionDetailRefs.current.get(pending.sectionId);
            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

            selectedButton?.focus({ preventScroll: true });
            detail?.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start',
            });
            pendingFocusedSelectionFocusRef.current = null;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [focusedSelectionSectionIds, selectedSectionValues]);

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
            .filter(([sectionId]) => !isPriceNeutralSectionId(sectionId))
            .map(([sectionId, valueId]) => ({
                valueId: String(valueId),
                label: getDisplayValueName(String(valueId), sectionId),
            }))
            .filter((entry) => !!entry.label);
    }, [getDisplayValueName, isPriceNeutralSectionId, pricingSelectedSectionValues, pricingStructure.vertical_axis.sectionId]);

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

        if (shouldHideUnavailableValues(sectionId) && !availabilityLoading) {
            visibleValues = visibleValues.filter(value => isValueSelectable(sectionId, value.id));
        }

        return sortValuesForDisplay(sectionId, visibleValues);
    }, [
        sectionGroupNameById,
        foldSectionIdForFolders,
        getValueName,
        getAllowedFolderPageNames,
        shouldHideUnavailableValues,
        availabilityLoading,
        isValueSelectable,
        sortValuesForDisplay,
    ]);

    const normalizeVisibleSelections = useCallback((selections: Record<string, string | null>) => {
        const original = selections;
        let changed = false;
        const next = { ...selections };

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

        return changed ? next : original;
    }, [
        selectorSections,
        getSectionValues,
        getVisibleValuesForSection,
        isOptionalSectionId,
    ]);

    // Keep selections valid when layouts or imported option data change.
    useEffect(() => {
        setSelectedSectionValues(prev => normalizeVisibleSelections(prev));
    }, [
        normalizeVisibleSelections,
    ]);

    const embeddedAdaptiveSelectorSectionIdByFocusId = useMemo(() => {
        const candidates = selectorSections.map((section) => {
            const values = getSectionValues(section.groupId, section.valueIds);
            const visibleValues = getVisibleValuesForSection(
                section.id,
                values,
                selectedSectionValues,
            );
            const availableValues = visibleValues.filter((value) => (
                isValueSelectable(section.id, value.id)
            ));

            return {
                id: section.id,
                adaptive: shouldUseAdaptiveImageSelector(section.id),
                availablePresentationKinds: availableValues.map((value) => (
                    value.meta?.presentationKind
                )),
            };
        });
        const result: Record<string, string> = {};

        selectorSections.forEach((section) => {
            if (!shouldFocusSelectedValue(section.id)) return;
            if (!focusedSelectionSectionIds.has(section.id)) return;
            if (!selectedSectionValues[section.id]) return;

            const embeddedSectionId = findEmbeddedAdaptiveSelectorSectionId({
                focusSectionId: section.id,
                sections: candidates,
            });
            if (embeddedSectionId) result[section.id] = embeddedSectionId;
        });

        return result;
    }, [
        focusedSelectionSectionIds,
        getSectionValues,
        getVisibleValuesForSection,
        isValueSelectable,
        selectedSectionValues,
        selectorSections,
        shouldFocusSelectedValue,
        shouldUseAdaptiveImageSelector,
    ]);

    const embeddedAdaptiveSelectorSectionIds = useMemo(() => new Set(
        Object.values(embeddedAdaptiveSelectorSectionIdByFocusId),
    ), [embeddedAdaptiveSelectorSectionIdByFocusId]);

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

        const configuredColumns = [...quantities].sort((a, b) => a - b);
        const cells: Record<string, Record<number, number>> = {};

        // For each vertical axis value, find matching price
        for (const vertValueId of vertAxis.valueIds) {
            const rowLabel = getDisplayValueName(vertValueId, vertAxis.sectionId);
            if (!rowLabel) continue;

            cells[rowLabel] = {};

            for (const qty of configuredColumns) {
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

        const hideUnavailableQuantities = pricingStructure.hideUnavailableQuantities === true
            || pricingStructure.hide_unavailable_quantities === true;
        const columns = hideUnavailableQuantities
            ? configuredColumns.filter(qty => allRows.some(rowLabel => cells[rowLabel]?.[qty] != null))
            : configuredColumns;

        // Keep the default row count stable. Opt-in filtered matrices use the existing empty state
        // when the active combination has no available quantity at all.
        const rows = hideUnavailableQuantities && columns.length === 0 ? [] : allRows;

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
            const rawCurrentPrice = matrixData.cells[selectedCell.row]?.[selectedCell.column];
            const currentPrice = Number(rawCurrentPrice);
            if (rawCurrentPrice != null && Number.isFinite(currentPrice)) {
                // Avoid re-trigger loops when parent callbacks are re-created each render
                notifyCellClick(selectedCell.row, selectedCell.column, Math.round(currentPrice));
                return;
            }

            // A model/variant change can remove the previously selected quantity.
            // Move to the first quantity that is actually priced for the active combination.
            if (selectRow(selectedCell.row)) return;
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
        if (!isValueSelectable(sectionId, valueId)) return;

        if (shouldFocusSelectedValue(sectionId)) {
            pendingFocusedSelectionFocusRef.current = { sectionId, valueId };
            setFocusedSelectionSectionIds((previous) => {
                if (previous.has(sectionId)) return previous;
                const next = new Set(previous);
                next.add(sectionId);
                return next;
            });
        }

        setSelectedSectionValues(prev => {
            const isOptionalToggleOff = isOptionalSectionId(sectionId) && prev[sectionId] === valueId;
            const shouldResolveExactly = autoResolveExactCombination
                && mappableSectionIds.has(sectionId)
                && !isOptionalToggleOff;
            const exactResolution = shouldResolveExactly
                ? resolveExactCombinationForValue(sectionId, valueId, prev)
                : null;
            if (shouldResolveExactly && !exactResolution) return prev;
            if (!shouldResolveExactly && !isValueCurrentlyAvailable(sectionId, valueId)) return prev;

            const updated = { ...prev };
            if (exactResolution) {
                exactCombinationSectionOrder.forEach((resolvedSectionId) => {
                    if (!Object.prototype.hasOwnProperty.call(exactResolution.selections, resolvedSectionId)) return;
                    const resolvedValueId = exactResolution.selections[resolvedSectionId];
                    if (resolvedValueId == null) delete updated[resolvedSectionId];
                    else updated[resolvedSectionId] = resolvedValueId;
                });
            } else {
                const currentValue = prev[sectionId];
                if (isOptionalSectionId(sectionId) && currentValue === valueId) {
                    delete updated[sectionId];
                } else {
                    updated[sectionId] = valueId;
                }
            }

            if (!exactResolution && finishSectionIds.includes(sectionId) && updated[sectionId]) {
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
            if (!exactResolution && selectedSectionType === 'finishes' && updated[sectionId]) {
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

            // A resolved selection is copied from one real price row. The
            // availability map still reflects the previous render here, so let
            // the next render validate it instead of normalizing it against
            // stale upstream selections.
            return exactResolution ? updated : normalizeVisibleSelections(updated);
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
        isOptionalEnabled: boolean,
        groupedRender?: {
            skipValueGroups?: boolean;
            selectedValue?: string;
            valuesAreVisible?: boolean;
        },
    ): ReactNode => {
        const isOptional = isOptionalSectionId(sectionId);
        const visibleValues = groupedRender?.valuesAreVisible
            ? values
            : getVisibleValuesForSection(sectionId, values, selectedSectionValues);
        const valueSettings = valueSettingsById[sectionId] || {};
        const selectorStyling = sectionById[sectionId]?.selectorStyling || {};
        const thumbnailPx = resolveThumbnailSizePx(
            sectionThumbnailConfigById[sectionId]?.size,
            sectionThumbnailConfigById[sectionId]?.customPx
        );
        // Get section config display mode override
        const sectionConfigDisplayMode = sectionConfigs[sectionId]?.displayMode;
        const isActive = !isOptional || isOptionalEnabled;
        const selectedValue = groupedRender?.selectedValue !== undefined
            ? groupedRender.selectedValue
            : selectedSectionValues[sectionId] ?? (isOptional ? "" : visibleValues[0]?.id || "");
        const sectionIdentity = [
            sectionId,
            sectionById[sectionId]?.title,
            sectionGroupNameById[sectionId],
        ].filter(Boolean).join(" ").toLocaleLowerCase("da-DK");
        const isApparelColorSection = /t-?shirt.*farve|tekstilfarve|textilfarbe|shirt.*colou?r|tshirtcolor/.test(sectionIdentity);
        const allowBuiltInCalendarArtwork = isCalendarFillingSection(sectionId);
        const preferCustomImage = shouldPreferCustomImage(sectionId);
        const focusSelectedValue = shouldFocusSelectedValue(sectionId);
        const neutralWhiteSurface = shouldUseNeutralWhiteSurface(sectionId);
        const adaptiveImageSelector = shouldUseAdaptiveImageSelector(sectionId);
        const isEmbeddedAdaptiveSelector = embeddedAdaptiveSelectorSectionIds.has(sectionId);
        const hasAdaptiveVisual = adaptiveImageSelector && visibleValues.some((value) => {
            if (!isValueSelectable(sectionId, value.id)) return false;
            const valueSetting = valueSettings[value.id];
            const displayName = getDisplayValueName(value.id, sectionId);
            const configuredImage = getOptionImageUrl(valueSetting, value.meta?.image);
            const builtInImage = allowBuiltInCalendarArtwork
                ? getBuiltInCalendarOptionImage(displayName)
                : undefined;
            const badge = getResolvedOptionBrandBadge(valueSetting, displayName, allowBuiltInCalendarArtwork);
            return Boolean(configuredImage || builtInImage || badge?.imageUrl);
        });
        const effectiveUiMode = groupedRender?.valuesAreVisible
            ? uiMode
            : adaptiveImageSelector
                ? (hasAdaptiveVisual ? 'small' : 'dropdown')
                : uiMode;

        const sectionTextButtonsConfig = resolveTextButtonsConfig({
            productConfig: textButtonsConfig,
            selectorConfig: selectorStyling.textButtons as Record<string, unknown>,
        });
        const sectionPictureButtonsConfig = resolvePictureButtonsConfig({
            productConfig: pictureButtonsConfig,
            selectorConfig: selectorStyling.pictureButtons as Record<string, unknown>,
            uiMode: sectionConfigDisplayMode || effectiveUiMode,
            thumbnailSize: sectionThumbnailConfigById[sectionId]?.size,
            thumbnailCustomPx: sectionThumbnailConfigById[sectionId]?.customPx,
            fallbackHoverColor: activeBranding?.colors?.hover || activeBranding?.colors?.primary || "#0EA5E9",
            fallbackSelectedColor: activeBranding?.colors?.primary || "#0EA5E9",
        });

        if (visibleValues.length === 0) return null;

        const selectedAttributeValue = visibleValues.find((value) => value.id === selectedValue);
        if (
            focusSelectedValue
            && focusedSelectionSectionIds.has(sectionId)
            && selectedAttributeValue
        ) {
            const valueSetting = valueSettings[selectedAttributeValue.id];
            const displayName = getDisplayValueName(selectedAttributeValue.id, sectionId);
            const selectedModelImage = getResolvedOptionImageUrl(valueSetting, displayName, {
                allowBuiltInCalendarArtwork,
                preferCustomImage: true,
                fallbackImage: selectedAttributeValue.meta?.image,
            });
            const selectedBadge = getResolvedOptionBrandBadge(
                valueSetting,
                displayName,
                allowBuiltInCalendarArtwork,
            );
            const embeddedAdaptiveSectionId = embeddedAdaptiveSelectorSectionIdByFocusId[sectionId];
            const embeddedAdaptiveSection = embeddedAdaptiveSectionId
                ? sectionById[embeddedAdaptiveSectionId]
                : undefined;
            const embeddedAdaptiveValues = embeddedAdaptiveSection
                ? getVisibleValuesForSection(
                    embeddedAdaptiveSectionId,
                    getSectionValues(embeddedAdaptiveSection.groupId, embeddedAdaptiveSection.valueIds),
                    selectedSectionValues,
                )
                : [];
            const availableEmbeddedAdaptiveValues = embeddedAdaptiveValues.filter((value) => (
                isValueSelectable(embeddedAdaptiveSectionId || '', value.id)
            ));
            const selectedEmbeddedAdaptiveId = embeddedAdaptiveSectionId
                ? selectedSectionValues[embeddedAdaptiveSectionId]
                : null;
            const selectedEmbeddedAdaptiveValue = embeddedAdaptiveValues.find((value) => (
                value.id === selectedEmbeddedAdaptiveId
            )) || availableEmbeddedAdaptiveValues[0];
            const selectedEmbeddedAdaptiveSetting = selectedEmbeddedAdaptiveValue && embeddedAdaptiveSectionId
                ? valueSettingsById[embeddedAdaptiveSectionId]?.[selectedEmbeddedAdaptiveValue.id]
                : undefined;
            const selectedEmbeddedPresentationKind = selectedEmbeddedAdaptiveValue?.meta?.presentationKind;
            const selectedFormatImage = selectedEmbeddedPresentationKind === 'format'
                && selectedEmbeddedAdaptiveValue
                ? getOptionImageUrl(
                    selectedEmbeddedAdaptiveSetting,
                    selectedEmbeddedAdaptiveValue.meta?.image,
                )
                : undefined;
            const selectedImage = selectedFormatImage || selectedModelImage;
            const sourceFormatValue = selectedEmbeddedPresentationKind === 'format'
                ? selectedEmbeddedAdaptiveValue?.meta?.sourceSelections?.format
                : undefined;
            const selectedSourceFormat = (
                typeof sourceFormatValue === 'string'
                || typeof sourceFormatValue === 'number'
            )
                ? String(sourceFormatValue).trim()
                : '';
            const selectedImageAlt = selectedSourceFormat
                ? `${displayName} – ${selectedSourceFormat}`
                : displayName;
            const detailRows = [
                {
                    label: selectedSourceFormat ? 'Valgt format' : 'Formatvalg',
                    values: selectedSourceFormat
                        ? [selectedSourceFormat]
                        : normalizeMetaStringList(selectedAttributeValue.meta?.formatLabels),
                },
                { label: 'Materiale', values: normalizeMetaStringList(selectedAttributeValue.meta?.materialLabels) },
                { label: 'Tryk', values: selectedAttributeValue.meta?.printLabelDa ? [selectedAttributeValue.meta.printLabelDa] : [] },
                { label: 'Muligt indhold', values: normalizeMetaStringList(selectedAttributeValue.meta?.fillingLabels) },
            ].filter((row) => row.values.length > 0);
            const embeddedPresentationKinds = new Set(
                availableEmbeddedAdaptiveValues
                    .map((value) => value.meta?.presentationKind)
                    .filter(Boolean),
            );
            const embeddedSelectorLabel = embeddedPresentationKinds.size === 1
                && embeddedPresentationKinds.has('filling')
                ? 'Hvad ønsker du i kalenderen?'
                : embeddedPresentationKinds.size === 1
                    && embeddedPresentationKinds.has('format')
                    ? 'Vælg format eller orientering'
                    : embeddedAdaptiveSection?.title || 'Vælg variant';
            const showEmbeddedAdaptiveSelector = Boolean(
                embeddedAdaptiveSection
                && embeddedAdaptiveSectionId
                && (
                    availableEmbeddedAdaptiveValues.length > 1
                    || !shouldHideSingleAvailableValue(embeddedAdaptiveSectionId)
                )
            );
            const focusedPickerImagePx = Math.min(sectionPictureButtonsConfig.sizePx, 88);
            const focusedPickerCardMinPx = Math.max(112, focusedPickerImagePx + 24);
            const focusedDetailHeadingId = `selected-product-${productId}-${sectionId}`;
            const focusedSelectionSubject = (
                sectionById[sectionId]?.title
                || sectionGroupNameById[sectionId]
                || 'produktvariant'
            )
                .replace(/^vælg\s+/i, '')
                .trim()
                .toLocaleLowerCase('da-DK');
            const focusedPickerHeading = `Vælg ${focusedSelectionSubject}`;

            return (
                <section
                    className="space-y-4"
                    aria-label={`Valgt ${focusedSelectionSubject}: ${displayName}`}
                    data-calendar-selection-stage="true"
                >
                    <div
                        className="space-y-3 rounded-xl border border-border bg-white p-4 sm:p-5"
                        data-calendar-model-picker="true"
                    >
                        <div>
                            <h4 className="text-sm font-semibold text-foreground">{focusedPickerHeading}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Alle relevante valg vises i boksen nedenfor.
                            </p>
                        </div>
                        <div
                            className="grid"
                            style={{
                                gap: `${sectionPictureButtonsConfig.gapBetweenPx}px`,
                                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${focusedPickerCardMinPx}px), 1fr))`,
                            }}
                            role="group"
                            aria-label={focusedPickerHeading}
                        >
                            {visibleValues.map((value) => {
                                const compactValueSetting = valueSettings[value.id];
                                const compactDisplayName = getDisplayValueName(value.id, sectionId);
                                const compactImage = getResolvedOptionImageUrl(
                                    compactValueSetting,
                                    compactDisplayName,
                                    {
                                        allowBuiltInCalendarArtwork,
                                        preferCustomImage: true,
                                        fallbackImage: value.meta?.image,
                                    },
                                );
                                const isSelected = value.id === selectedAttributeValue.id;
                                const isSelectable = isValueSelectable(sectionId, value.id);
                                const compactImagePx = Math.min(
                                    compactValueSetting?.imageSizePx ?? focusedPickerImagePx,
                                    focusedPickerImagePx,
                                );
                                const contextualId = `product-option.${productId}.${sectionId}.${value.id}.${encodeURIComponent(compactDisplayName)}`;

                                return (
                                    <button
                                        key={value.id}
                                        ref={(element) => {
                                            const refKey = `${sectionId}:${value.id}`;
                                            if (element) focusedSelectionOptionButtonRefs.current.set(refKey, element);
                                            else focusedSelectionOptionButtonRefs.current.delete(refKey);
                                        }}
                                        type="button"
                                        data-site-design-target={contextualId}
                                        onClick={() => {
                                            if (window.parent !== window) {
                                                window.parent.postMessage({
                                                    type: 'EDIT_SECTION',
                                                    sectionId: contextualId,
                                                }, '*');
                                            }
                                            handleSectionSelect(sectionId, value.id);
                                        }}
                                        disabled={!isSelectable}
                                        aria-pressed={isSelected}
                                        aria-label={`${isSelected ? 'Valgt: ' : 'Vælg '}${compactDisplayName}`}
                                        className={cn(
                                            "flex min-h-11 min-w-0 touch-manipulation flex-col items-center gap-1.5 rounded-lg border bg-white p-2 text-center text-[11px] font-medium leading-tight text-foreground transition-colors duration-150 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none",
                                            isSelected ? "border-primary ring-1 ring-primary/30" : "border-border",
                                            !isSelectable && "cursor-not-allowed opacity-45",
                                        )}
                                    >
                                        <span
                                            className="flex max-w-full items-center justify-center overflow-hidden rounded-md bg-white"
                                            style={{ width: compactImagePx, height: compactImagePx }}
                                        >
                                            {compactImage ? (
                                                <img
                                                    src={getHiResThumbnailUrl(compactImage, compactImagePx * 2, compactImagePx * 2)}
                                                    alt=""
                                                    className="h-full w-full object-contain"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span aria-hidden="true" className="text-xs font-semibold text-muted-foreground">
                                                    {(compactDisplayName || '?').slice(0, 3).toUpperCase()}
                                                </span>
                                            )}
                                        </span>
                                        <span className="min-h-7 w-full break-words [hyphens:auto]" lang="da">
                                            {compactDisplayName}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div
                        ref={(element) => {
                            if (element) focusedSelectionDetailRefs.current.set(sectionId, element);
                            else focusedSelectionDetailRefs.current.delete(sectionId);
                        }}
                        role="region"
                        tabIndex={-1}
                        aria-labelledby={focusedDetailHeadingId}
                        className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:scroll-mt-28"
                        data-calendar-model-detail="true"
                    >
                        <div className="grid bg-white md:grid-cols-[minmax(12rem,19rem)_minmax(0,1fr)]">
                            <div className="relative flex min-h-52 items-center justify-center bg-white p-4 sm:min-h-64">
                                {selectedImage ? (
                                    <img
                                        src={getHiResThumbnailUrl(selectedImage, 640, 640)}
                                        alt={selectedImageAlt}
                                        className="h-full max-h-72 w-full object-contain"
                                        loading="eager"
                                    />
                                ) : (
                                    <span className="text-sm font-semibold text-foreground">{displayName}</span>
                                )}
                                {selectedBadge && <OptionBrandBadgeOverlay badge={selectedBadge} />}
                            </div>

                            <div className="flex min-w-0 flex-col justify-center gap-4 border-t border-border bg-white p-5 sm:p-6 md:border-l md:border-t-0">
                                <div className="space-y-2">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        Valgt {focusedSelectionSubject}
                                    </span>
                                    <h3
                                        id={focusedDetailHeadingId}
                                        className="text-xl font-semibold leading-tight text-foreground sm:text-2xl"
                                    >
                                        {displayName}
                                    </h3>
                                    {selectedAttributeValue.meta?.descriptionDa && (
                                        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
                                            {selectedAttributeValue.meta.descriptionDa}
                                        </p>
                                    )}
                                </div>

                                {detailRows.length > 0 && (
                                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                        {detailRows.map((row) => (
                                            <div key={row.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {row.label}
                                                </dt>
                                                <dd className="mt-1 font-medium leading-5 text-foreground">
                                                    {row.values.join(' · ')}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}

                                {showEmbeddedAdaptiveSelector && embeddedAdaptiveSection && embeddedAdaptiveSectionId && (
                                    <div
                                        className="space-y-2 rounded-lg border border-border bg-white p-3"
                                        data-site-design-target={`product-selector-box.${productId}.${embeddedAdaptiveSectionId}.${encodeURIComponent(embeddedSelectorLabel)}`}
                                        data-calendar-configuration="true"
                                    >
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            {embeddedSelectorLabel}
                                        </span>
                                        {embeddedAdaptiveSection.description && (
                                            <p className="text-[10px] text-muted-foreground">
                                                {embeddedAdaptiveSection.description}
                                            </p>
                                        )}
                                        {renderValueSelector(
                                            embeddedAdaptiveSectionId,
                                            embeddedAdaptiveValues,
                                            embeddedAdaptiveSection.ui_mode || 'buttons',
                                            !isOptionalSectionId(embeddedAdaptiveSectionId)
                                                || Boolean(selectedSectionValues[embeddedAdaptiveSectionId]),
                                        )}
                                    </div>
                                )}

                                <p className="max-w-prose text-xs leading-5 text-muted-foreground">
                                    {embeddedPresentationKinds.has('format')
                                        ? 'Formatvalget angiver leverandørens bestillings-/trykformat. For foldede modeller kan det færdige produktmål afvige.'
                                        : 'Dit valg opdaterer pris og den tilknyttede trykskabelon automatisk.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            );
        }

        if (isApparelColorSection) {
            return (
                <div className={cn("flex flex-wrap gap-2", !isActive && "pointer-events-none opacity-60")}>
                    {visibleValues.map((value) => {
                        const displayName = getDisplayValueName(value.id, sectionId);
                        const color = getApparelColorOption(displayName);
                        const isSelected = selectedValue === value.id;
                        const isSelectable = isValueSelectable(sectionId, value.id);
                        const fill = color?.hex || "#CBD5E1";
                        const isLight = color?.id === "white" || color?.id === "yellow" || color?.id === "sky-blue";

                        return (
                            <button
                                key={value.id}
                                type="button"
                                aria-pressed={isSelected}
                                aria-label={`${displayName}${color?.pantone ? `, cirka Pantone ${color.pantone}` : ""}`}
                                title={`${displayName}${color?.pantone ? ` · ca. Pantone ${color.pantone}` : ""}`}
                                onClick={() => handleSectionSelect(sectionId, value.id)}
                                disabled={!isActive || !isSelectable}
                                className={cn(
                                    "flex min-h-12 min-w-[5.5rem] touch-manipulation items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                    isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/50",
                                    (!isActive || !isSelectable) && "cursor-not-allowed opacity-45"
                                )}
                            >
                                <Shirt
                                    className="h-6 w-6 shrink-0"
                                    fill={fill}
                                    strokeWidth={isSelected ? 2.5 : 1.8}
                                    style={{ color: isLight ? "#475569" : fill }}
                                />
                                <span className="max-w-24 leading-tight">{color?.label || displayName}</span>
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (effectiveUiMode === 'dropdown') {
            return (
                <select
                    value={selectedValue}
                    onChange={(e) => handleSectionSelect(sectionId, e.target.value)}
                    className="min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    disabled={!isActive}
                    aria-label={sectionById[sectionId]?.title || sectionGroupNameById[sectionId] || 'Vælg mulighed'}
                >
                    {isOptional && (
                        <option value="">Ingen</option>
                    )}
                    {visibleValues.map(v => {
                        const isSelectable = isValueSelectable(sectionId, v.id);
                        return (
                            <option key={v.id} value={v.id} disabled={!isSelectable}>
                                {getDisplayValueName(v.id, sectionId)}
                            </option>
                        );
                    })}
                </select>
            );
        }

        const configuredValueGroups = sectionById[sectionId]?.valueGroups
            || sectionById[sectionId]?.value_groups;
        const resolvedValueGroups = groupedRender?.skipValueGroups
            ? []
            : resolveSelectorValueGroups(visibleValues, configuredValueGroups);

        if (
            resolvedValueGroups.length > 0
            && effectiveUiMode !== 'hidden'
        ) {
            return (
                <div className="space-y-4" data-selector-value-groups="true">
                    {resolvedValueGroups.map((group, groupIndex) => (
                        <section
                            key={`${group.id}:${groupIndex}`}
                            className="space-y-2"
                            data-selector-value-group={group.id}
                        >
                            <h4 className="text-xs font-semibold text-foreground">
                                {group.label}
                            </h4>
                            {renderValueSelector(
                                sectionId,
                                group.values,
                                effectiveUiMode,
                                isOptionalEnabled,
                                {
                                    skipValueGroups: true,
                                    selectedValue,
                                    valuesAreVisible: true,
                                },
                            )}
                        </section>
                    ))}
                </div>
            );
        }

        if (effectiveUiMode === 'checkboxes') {
            return (
                <div className={cn("space-y-1", !isActive && "opacity-60 pointer-events-none")}>
                    {visibleValues.map(v => {
                        const isSelected = selectedValue === v.id;
                        const isSelectable = isValueSelectable(sectionId, v.id);
                        const valueSetting = valueSettings[v.id];
                        const displayName = getDisplayValueName(v.id, sectionId);
                        const checkboxKey = `${sectionId}:${v.id}`;
                        const isHovered = hoveredPictureKey === checkboxKey;
                        const thumbUrl = getResolvedOptionImageUrl(valueSetting, displayName, {
                            allowBuiltInCalendarArtwork,
                            preferCustomImage: preferCustomImage || adaptiveImageSelector,
                            fallbackImage: v.meta?.image,
                        });
                        const renderedThumbUrl = isHovered && valueSetting?.hoverImage
                            ? valueSetting.hoverImage
                            : thumbUrl;
                        const imagePx = valueSetting?.imageSizePx ?? thumbnailPx;
                        return (
                            <label
                                key={v.id}
                                className={cn(
                                    "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                                    isSelected ? "bg-primary/10 border-primary" : "bg-background border-muted hover:border-muted-foreground/30",
                                    !isSelectable && "opacity-45 cursor-not-allowed"
                                )}
                                onClick={() => {
                                    if (!isSelectable) return;
                                    handleSectionSelect(sectionId, v.id);
                                }}
                                onMouseEnter={() => setHoveredPictureKey(checkboxKey)}
                                onMouseLeave={() => setHoveredPictureKey((prev) => prev === checkboxKey ? null : prev)}
                            >
                                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                {valueSetting?.showThumbnail && renderedThumbUrl && (
                                    <img
                                        src={getHiResThumbnailUrl(
                                            renderedThumbUrl,
                                            imagePx,
                                            imagePx
                                        )}
                                        alt={displayName}
                                        className="rounded object-cover shrink-0"
                                        style={{ width: imagePx, height: imagePx }}
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
        if (['small', 'medium', 'large', 'xl', 'xl_notext'].includes(effectiveUiMode)) {
            return (
                <div 
                    className={cn(
                        isEmbeddedAdaptiveSelector
                            ? "grid grid-cols-1 min-[360px]:grid-cols-2"
                            : "flex flex-wrap",
                        !isActive && "opacity-60 pointer-events-none",
                    )}
                    style={{ gap: `${sectionPictureButtonsConfig.gapBetweenPx}px` }}
                >
                    {visibleValues.map(v => {
                        const pictureKey = `${sectionId}:${v.id}`;
                        const isHovered = hoveredPictureKey === pictureKey;
                        const isSelected = selectedValue === v.id;
                        const valueSetting = valueSettings[v.id];
                        const displayName = getDisplayValueName(v.id, sectionId);
                        const primaryThumbUrl = getResolvedOptionImageUrl(valueSetting, displayName, {
                            allowBuiltInCalendarArtwork,
                            preferCustomImage: preferCustomImage || adaptiveImageSelector,
                            fallbackImage: v.meta?.image,
                        });
                        const brandBadge = getResolvedOptionBrandBadge(
                            valueSetting,
                            displayName,
                            allowBuiltInCalendarArtwork,
                        );
                        const artworkLabel = allowBuiltInCalendarArtwork
                            && !(
                                (prefersConfiguredOptionImage(valueSetting, preferCustomImage) || adaptiveImageSelector)
                                && getOptionImageUrl(valueSetting, v.meta?.image)
                            )
                            ? getBuiltInCalendarOptionArtworkLabel(displayName)
                            : undefined;
                        const isSelectable = isValueSelectable(sectionId, v.id);
                        const configuredPictureImagePx = valueSetting?.imageSizePx ?? sectionPictureButtonsConfig.sizePx;
                        const pictureImagePx = isEmbeddedAdaptiveSelector
                            ? Math.min(configuredPictureImagePx, 72)
                            : adaptiveImageSelector
                                ? Math.min(configuredPictureImagePx, 112)
                                : configuredPictureImagePx;
                        const thumbUrl = isHovered && valueSetting?.hoverImage
                            ? valueSetting.hoverImage
                            : primaryThumbUrl;
                        const pictureStateStyles = resolvePictureButtonStateStyles(sectionPictureButtonsConfig, {
                            isHovered,
                            isSelected,
                        });
                        const overlayColor = !neutralWhiteSurface && pictureStateStyles.backgroundColor !== sectionPictureButtonsConfig.backgroundColor
                            ? pictureStateStyles.backgroundColor
                            : undefined;
                        const useDetachedLabel = (
                            isEmbeddedAdaptiveSelector
                            || sectionPictureButtonsConfig.displayMode === "text_below_image"
                            || sectionPictureButtonsConfig.labelOutsideImage
                        )
                            && sectionPictureButtonsConfig.showImage
                            && sectionPictureButtonsConfig.showLabel;

                        const pictureImageSizeCss = `min(${pictureImagePx}px, 36vw)`;
                        const buttonWidth = isEmbeddedAdaptiveSelector
                            ? '100%'
                            : sectionPictureButtonsConfig.showImage
                                ? pictureImageSizeCss
                                : 'auto';
                        const pictureFrameWidth = isEmbeddedAdaptiveSelector
                            ? pictureImageSizeCss
                            : buttonWidth;
                        const buttonHeight = !useDetachedLabel && sectionPictureButtonsConfig.showImage
                            ? `calc(${pictureImageSizeCss} + ${sectionPictureButtonsConfig.showLabel ? 24 : 0}px)`
                            : 'auto';
                        const pictureBackgroundColor = neutralWhiteSurface
                            ? "#FFFFFF"
                            : (valueSetting?.backgroundColor || sectionPictureButtonsConfig.backgroundColor);
                        const pictureTextColor = valueSetting?.textColor || sectionPictureButtonsConfig.textColor;
                        const pictureBorderColor = valueSetting?.borderColor || pictureStateStyles.borderColor;
                        const pictureBorderRadius = valueSetting?.borderRadiusPx ?? sectionPictureButtonsConfig.imageBorderRadiusPx;
                        const pictureBorderWidth = valueSetting?.borderWidthPx ?? sectionPictureButtonsConfig.borderWidthPx;
                        
                        // Build contextual editor ID for click-to-edit
                        const contextualId = `product-option.${productId}.${sectionId}.${v.id}.${encodeURIComponent(displayName)}`;
                        
                        return (
                            <button
                                key={v.id}
                                ref={(element) => {
                                    const refKey = `${sectionId}:${v.id}`;
                                    if (element) focusedSelectionOptionButtonRefs.current.set(refKey, element);
                                    else focusedSelectionOptionButtonRefs.current.delete(refKey);
                                }}
                                type="button"
                                data-site-design-target={contextualId}
                                onClick={(e) => {
                                    // Check if we're in preview/edit mode (parent will handle the event)
                                    if (window.parent !== window) {
                                        // We're in an iframe - let the parent handle the click
                                        window.parent.postMessage({
                                            type: 'EDIT_SECTION',
                                            sectionId: contextualId,
                                        }, '*');
                                    }
                                    handleSectionSelect(sectionId, v.id);
                                }}
                                disabled={!isActive || !isSelectable}
                                aria-pressed={isSelected}
                                aria-label={`${isSelected ? 'Valgt: ' : 'Vælg '}${displayName}`}
                                onMouseEnter={() => setHoveredPictureKey(pictureKey)}
                                onMouseLeave={() => setHoveredPictureKey((prev) => prev === pictureKey ? null : prev)}
                                className={cn(
                                    "min-h-11 min-w-11 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:!transform-none motion-reduce:!transition-none",
                                    useDetachedLabel
                                        ? cn(
                                            "flex max-w-full touch-manipulation flex-col items-center gap-1",
                                            isEmbeddedAdaptiveSelector
                                                ? "rounded-lg border bg-white p-2 hover:border-primary/60"
                                                : "bg-transparent p-0",
                                        )
                                        : "relative flex max-w-full touch-manipulation overflow-hidden border-2 flex-col items-center",
                                    isSelected ? "shadow-none" : "",
                                    (!isActive || !isSelectable) && "cursor-not-allowed opacity-45"
                                )}
                                style={{
                                    width: buttonWidth,
                                    minHeight: buttonHeight,
                                    backgroundColor: useDetachedLabel && !isEmbeddedAdaptiveSelector
                                        ? "transparent"
                                        : pictureBackgroundColor,
                                    borderColor: useDetachedLabel && !isEmbeddedAdaptiveSelector
                                        ? "transparent"
                                        : pictureBorderColor,
                                    borderRadius: useDetachedLabel && !isEmbeddedAdaptiveSelector
                                        ? undefined
                                        : `${pictureBorderRadius}px`,
                                    borderWidth: useDetachedLabel && !isEmbeddedAdaptiveSelector
                                        ? 0
                                        : `${pictureBorderWidth}px`,
                                    borderStyle: useDetachedLabel && !isEmbeddedAdaptiveSelector ? 'none' : 'solid',
                                    boxShadow: useDetachedLabel && !isEmbeddedAdaptiveSelector
                                        ? undefined
                                        : pictureStateStyles.boxShadow,
                                    transform: pictureStateStyles.transform,
                                    transitionDuration: pictureStateStyles.transitionDuration,
                                }}
                            >
                                {useDetachedLabel ? (
                                    <>
                                        <span
                                            className={cn(
                                                "relative mx-auto flex overflow-hidden",
                                                !isEmbeddedAdaptiveSelector && "border-2",
                                            )}
                                            style={{
                                                width: pictureFrameWidth,
                                                minHeight: pictureImageSizeCss,
                                                backgroundColor: pictureBackgroundColor,
                                                borderColor: isEmbeddedAdaptiveSelector ? "transparent" : pictureBorderColor,
                                                borderRadius: `${pictureBorderRadius}px`,
                                                borderWidth: isEmbeddedAdaptiveSelector ? 0 : `${pictureBorderWidth}px`,
                                                borderStyle: isEmbeddedAdaptiveSelector ? 'none' : 'solid',
                                                boxShadow: isEmbeddedAdaptiveSelector ? undefined : pictureStateStyles.boxShadow,
                                            }}
                                        >
                                            {overlayColor && (
                                                <span
                                                    className="pointer-events-none absolute inset-0 z-10"
                                                    style={{ backgroundColor: overlayColor }}
                                                />
                                            )}
                                            {thumbUrl ? (
                                                <img
                                                    src={getHiResThumbnailUrl(thumbUrl, pictureImagePx, pictureImagePx)}
                                                    alt=""
                                                    className={cn(
                                                        "relative z-0 w-full",
                                                        (brandBadge || neutralWhiteSurface || adaptiveImageSelector) ? "object-contain" : "object-cover",
                                                    )}
                                                    style={{
                                                        height: pictureImageSizeCss,
                                                        backgroundColor: (brandBadge || neutralWhiteSurface || adaptiveImageSelector) ? "#FFFFFF" : undefined,
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    className="relative z-0 flex w-full items-center justify-center text-xs font-semibold"
                                                    style={{
                                                        height: pictureImageSizeCss,
                                                        color: pictureTextColor,
                                                        backgroundColor: pictureBackgroundColor,
                                                    }}
                                                >
                                                    {(displayName || '?').slice(0, 3).toUpperCase()}
                                                </div>
                                            )}
                                            {artworkLabel && <CalendarArtworkLabelOverlay label={artworkLabel} />}
                                            {brandBadge && <OptionBrandBadgeOverlay badge={brandBadge} />}
                                        </span>
                                        <span
                                            className={cn(
                                                "w-full whitespace-normal break-words px-1 text-center leading-tight [hyphens:auto]",
                                                isEmbeddedAdaptiveSelector && "min-h-10 px-2 text-balance",
                                            )}
                                            lang="da"
                                            style={{
                                                color: sectionPictureButtonsConfig.textColor,
                                                fontSize: `${valueSetting?.fontSizePx ?? sectionPictureButtonsConfig.labelFontSizePx}px`,
                                            }}
                                        >
                                            {displayName}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {overlayColor && (
                                            <span
                                                className="pointer-events-none absolute inset-0 z-10"
                                                style={{ backgroundColor: overlayColor }}
                                            />
                                        )}
                                        {sectionPictureButtonsConfig.showImage && (
                                            thumbUrl ? (
                                                <img
                                                    src={getHiResThumbnailUrl(thumbUrl, pictureImagePx, pictureImagePx)}
                                                    alt=""
                                                    className={cn(
                                                        "relative z-0 w-full",
                                                        (brandBadge || neutralWhiteSurface || adaptiveImageSelector) ? "object-contain" : "object-cover",
                                                    )}
                                                    style={{ 
                                                        height: pictureImageSizeCss,
                                                        backgroundColor: (brandBadge || neutralWhiteSurface || adaptiveImageSelector) ? "#FFFFFF" : undefined,
                                                        borderRadius: sectionPictureButtonsConfig.isTextBelow ? `${sectionPictureButtonsConfig.imageBorderRadiusPx}px ${sectionPictureButtonsConfig.imageBorderRadiusPx}px 0 0` : undefined
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    className="relative z-0 w-full flex items-center justify-center text-xs font-semibold"
                                                    style={{ 
                                                        height: pictureImageSizeCss,
                                                        color: pictureTextColor,
                                                        backgroundColor: pictureBackgroundColor,
                                                        borderRadius: sectionPictureButtonsConfig.isTextBelow ? `${pictureBorderRadius}px ${pictureBorderRadius}px 0 0` : undefined
                                                    }}
                                                >
                                                    {(displayName || '?').slice(0, 3).toUpperCase()}
                                                </div>
                                            )
                                        )}
                                        {sectionPictureButtonsConfig.showImage && brandBadge && (
                                            <OptionBrandBadgeOverlay badge={brandBadge} />
                                        )}
                                        {sectionPictureButtonsConfig.showImage && artworkLabel && (
                                            <CalendarArtworkLabelOverlay label={artworkLabel} />
                                        )}
                                        {sectionPictureButtonsConfig.showLabel && (
                                            <span
                                                className="relative z-20 w-full whitespace-normal break-words px-1 py-1 text-center leading-tight [hyphens:auto]"
                                                lang="da"
                                                style={{
                                                    color: sectionPictureButtonsConfig.textColor,
                                                    fontSize: `${valueSetting?.fontSizePx ?? sectionPictureButtonsConfig.labelFontSizePx}px`,
                                                }}
                                            >
                                                {displayName}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            );
        }

        // Default: buttons with per-product styling
        return (
            <div 
                className={cn("flex flex-wrap", !isActive && "opacity-60 pointer-events-none")}
                style={{ gap: `${sectionTextButtonsConfig.paddingPx / 2}px` }}
            >
                {visibleValues.map(v => {
                    const isSelected = selectedValue === v.id;
                    const isSelectable = isValueSelectable(sectionId, v.id);
                    const valueSetting = valueSettings[v.id];
                    const displayName = getDisplayValueName(v.id, sectionId);
                    const buttonKey = `${sectionId}:${v.id}`;
                    const isHovered = hoveredPictureKey === buttonKey;
                    const paddingPx = valueSetting?.paddingPx ?? sectionTextButtonsConfig.paddingPx;
                    const borderRadiusPx = valueSetting?.borderRadiusPx ?? sectionTextButtonsConfig.borderRadiusPx;
                    const renderedThumbUrl = isHovered && valueSetting?.hoverImage
                        ? valueSetting.hoverImage
                        : getResolvedOptionImageUrl(valueSetting, displayName, {
                            allowBuiltInCalendarArtwork,
                            preferCustomImage: preferCustomImage || adaptiveImageSelector,
                            fallbackImage: v.meta?.image,
                        });
                    const brandBadge = getResolvedOptionBrandBadge(
                        valueSetting,
                        displayName,
                        allowBuiltInCalendarArtwork,
                    );
                    const artworkLabel = allowBuiltInCalendarArtwork
                        && !(
                            (prefersConfiguredOptionImage(valueSetting, preferCustomImage) || adaptiveImageSelector)
                            && getOptionImageUrl(valueSetting, v.meta?.image)
                        )
                        ? getBuiltInCalendarOptionArtworkLabel(displayName)
                        : undefined;
                    const imagePx = valueSetting?.imageSizePx ?? thumbnailPx;
                    const isInteractiveHover = isHovered && !isSelected;
                    
                    // Determine colors based on state
                    const bgColor = neutralWhiteSurface
                        ? "#FFFFFF"
                        : isSelected
                            ? sectionTextButtonsConfig.selectedBackgroundColor
                            : isInteractiveHover
                            ? (valueSetting?.hoverBackgroundColor || sectionTextButtonsConfig.hoverBackgroundColor)
                            : (valueSetting?.backgroundColor || sectionTextButtonsConfig.backgroundColor);
                    const textColor = neutralWhiteSurface
                        ? (valueSetting?.textColor || sectionTextButtonsConfig.textColor)
                        : isSelected
                            ? sectionTextButtonsConfig.selectedTextColor
                            : isInteractiveHover
                            ? (valueSetting?.hoverTextColor || sectionTextButtonsConfig.hoverTextColor)
                            : (valueSetting?.textColor || sectionTextButtonsConfig.textColor);
                    const borderColor = isSelected 
                        ? sectionTextButtonsConfig.selectedBackgroundColor 
                        : isInteractiveHover
                            ? (valueSetting?.hoverBorderColor || sectionTextButtonsConfig.hoverBorderColor)
                            : (valueSetting?.borderColor || sectionTextButtonsConfig.borderColor);
                    
                    // Build contextual editor ID for click-to-edit
                    const contextualId = `product-option.${productId}.${sectionId}.${v.id}.${encodeURIComponent(displayName)}`;
                    
                    return (
                        <button
                            key={v.id}
                            ref={(element) => {
                                const refKey = `${sectionId}:${v.id}`;
                                if (element) focusedSelectionOptionButtonRefs.current.set(refKey, element);
                                else focusedSelectionOptionButtonRefs.current.delete(refKey);
                            }}
                            type="button"
                            data-site-design-target={contextualId}
                            onClick={(e) => {
                                // Check if we're in preview/edit mode (parent will handle the event)
                                if (window.parent !== window) {
                                    // We're in an iframe - let the parent handle the click
                                    window.parent.postMessage({
                                        type: 'EDIT_SECTION',
                                        sectionId: contextualId,
                                    }, '*');
                                }
                                handleSectionSelect(sectionId, v.id);
                            }}
                            disabled={!isActive || !isSelectable}
                            aria-pressed={isSelected}
                            className={cn(
                                "flex min-h-11 min-w-[min(10rem,100%)] touch-manipulation items-center justify-center gap-2 text-center leading-tight transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:min-w-0",
                                !isSelectable && "opacity-45 cursor-not-allowed"
                            )}
                            style={{
                                backgroundColor: bgColor,
                                color: textColor,
                                borderRadius: `${borderRadiusPx}px`,
                                borderWidth: `${valueSetting?.borderWidthPx ?? sectionTextButtonsConfig.borderWidthPx}px`,
                                borderStyle: 'solid',
                                borderColor: borderColor,
                                padding: `${paddingPx}px ${paddingPx * 1.33}px`,
                                fontSize: `${valueSetting?.fontSizePx ?? sectionTextButtonsConfig.fontSizePx}px`,
                                minHeight: `${valueSetting?.minHeightPx ?? sectionTextButtonsConfig.minHeightPx}px`,
                                fontFamily: sectionTextButtonsConfig.fontFamily || 'inherit',
                            }}
                            onMouseEnter={() => {
                                setHoveredPictureKey(buttonKey);
                            }}
                            onMouseLeave={() => {
                                setHoveredPictureKey((prev) => prev === buttonKey ? null : prev);
                            }}
                        >
                            {valueSetting?.showThumbnail && renderedThumbUrl && (
                                <span
                                    className="relative shrink-0"
                                    style={{
                                        width: imagePx,
                                        height: imagePx,
                                        backgroundColor: (brandBadge || neutralWhiteSurface) ? "#FFFFFF" : undefined,
                                        borderRadius: `${borderRadiusPx / 2}px`,
                                    }}
                                >
                                    <img
                                        src={getHiResThumbnailUrl(
                                            renderedThumbUrl,
                                            imagePx,
                                            imagePx
                                        )}
                                        alt={displayName}
                                        className={cn(
                                            "h-full w-full",
                                            (brandBadge || neutralWhiteSurface) ? "object-contain" : "object-cover",
                                        )}
                                        style={{ borderRadius: `${borderRadiusPx / 2}px` }}
                                    />
                                    {artworkLabel && <CalendarArtworkLabelOverlay label={artworkLabel} />}
                                    {brandBadge && <OptionBrandBadgeOverlay badge={brandBadge} compact />}
                                </span>
                            )}
                            {displayName}
                        </button>
                    );
                })}
            </div>
        );
    };

    if (showInitialMatrixSkeleton) {
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
        <div
            className="space-y-6 [font-family:var(--matrix-font)]"
            style={matrixStyleVars}
            data-branding-id="productPage.matrix"
            data-matrix-loading={matrixLoading ? "true" : "false"}
            aria-busy={matrixLoading}
        >
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
                    const renderableColumns = filteredColumns.filter((col) => {
                        if (
                            !isProgressiveFocusConfirmed
                            && progressiveFocusSectionId
                            && col.id !== progressiveFocusSectionId
                        ) {
                            return false;
                        }
                        if (embeddedAdaptiveSelectorSectionIds.has(col.id)) {
                            return false;
                        }
                        const values = getSectionValues(col.groupId, col.valueIds);
                        const visibleValues = getVisibleValuesForSection(col.id, values, selectedSectionValues);
                        if (visibleValues.length === 0) return false;
                        const availableVisibleValues = visibleValues.filter((value) => (
                            isValueSelectable(col.id, value.id)
                        ));
                        if (
                            shouldHideSingleAvailableValue(col.id)
                            && !isOptionalSectionId(col.id)
                            && availableVisibleValues.length === 1
                        ) {
                            return false;
                        }
                        return true;
                    });

                    if (renderableColumns.length === 0) return null;
                    const rowHasFocusedSelection = renderableColumns.some((col) => (
                        shouldFocusSelectedValue(col.id)
                        && focusedSelectionSectionIds.has(col.id)
                        && Boolean(selectedSectionValues[col.id])
                    ));

                    return (
                        <div key={row.id} className="space-y-2 pb-3 border-b last:border-b-0">
                            {row.title && <div className="text-xs font-medium">{row.title}</div>}
                            {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                            <div className={cn(
                                "grid grid-cols-1 gap-3",
                                renderableColumns.length === 1 && "grid-cols-1",
                                renderableColumns.length === 2 && "sm:grid-cols-2",
                                renderableColumns.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3"
                            )}>
                                {renderableColumns.map((col, colIndex) => {
                                    const values = getSectionValues(col.groupId, col.valueIds);
                                    const visibleValues = getVisibleValuesForSection(col.id, values, selectedSectionValues);
                                    if (visibleValues.length === 0) return null;
                                    const availablePresentationKinds = new Set(
                                        visibleValues
                                            .filter((value) => isValueSelectable(col.id, value.id))
                                            .map((value) => value.meta?.presentationKind)
                                            .filter(Boolean),
                                    );
                                    const adaptiveSectionLabel = shouldUseAdaptiveImageSelector(col.id)
                                        && availablePresentationKinds.size === 1
                                        ? availablePresentationKinds.has('filling')
                                            ? 'Hvad ønsker du i kalenderen?'
                                            : availablePresentationKinds.has('format')
                                                ? 'Vælg format eller orientering'
                                                : null
                                        : null;
                                    const sectionLabel = adaptiveSectionLabel || col.title || getSectionTypeLabel(col.sectionType);
                                    const uiMode = col.ui_mode || 'buttons';
                                    const isOptional = isOptionalSectionId(col.id);
                                    const isOptionalEnabled = isOptional && !!selectedSectionValues[col.id];
                                    const selectorBoxConfig = resolveSelectorBoxConfig(col.selectorStyling?.selectorBox as any);
                                    const selectorBoxTarget = `product-selector-box.${productId}.${col.id}.${encodeURIComponent(sectionLabel)}`;

                                    const handleOptionalToggle = (checked: boolean) => {
                                        if (!isOptional) return;
                                        if (checked) {
                                            const firstSelectableValue = visibleValues.find((value) =>
                                                isValueSelectable(col.id, value.id)
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
                                            data-site-design-target={selectorBoxTarget}
                                            className={cn(
                                                "space-y-1.5 transition-colors",
                                                isOptionalEnabled && "ring-1 ring-primary/20",
                                                colIndex > 0 && col.sectionType !== "finishes" && !rowHasFocusedSelection && "sm:border-l-2 sm:border-primary/20",
                                                rowHasFocusedSelection && "sm:col-span-full"
                                            )}
                                            style={{
                                                backgroundColor: selectorBoxConfig.backgroundColor,
                                                borderColor: selectorBoxConfig.borderColor,
                                                borderRadius: `${selectorBoxConfig.borderRadiusPx}px`,
                                                borderWidth: `${selectorBoxConfig.borderWidthPx}px`,
                                                borderStyle: 'solid',
                                                padding: `${selectorBoxConfig.paddingPx}px`,
                                            }}
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
            {isProgressiveFocusConfirmed && matrixData.rows.length > 0 && matrixData.columns.length > 0 && (
                <div className="mt-6">
                    <PriceMatrix
                        rows={matrixData.rows}
                        columns={matrixData.columns}
                        cells={matrixData.cells}
                        onCellClick={handleCellClick}
                        selectedCell={selectedCell}
                        columnUnit="stk"
                        rowHeaderLabel={pricingStructure.vertical_axis.title || getSectionLabel(pricingStructure.vertical_axis.sectionType, pricingStructure.vertical_axis.groupId, pricingStructure.vertical_axis.labelOverride)}
                        matrixBox={(pricingStructure as any).matrixBox}
                    />
                </div>
            )}

            {/* Empty state */}
            {isProgressiveFocusConfirmed && matrixData.rows.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <p>Ingen priser fundet for dette produkt.</p>
                    <p className="text-sm">Vælg format og produkt ovenfor.</p>
                </div>
            )}
        </div>
    );
}
