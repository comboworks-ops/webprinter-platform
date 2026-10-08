import { resolveWideFormatShape, proportionalSize, type WideFormatShape, type WideFormatShapeBinding } from "@/lib/designer/wideFormatGeometry";
import type { SiteCheckoutState } from "@/lib/checkout/siteCheckoutSession";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { readFeaturedStorformatSelection, resolveFeaturedQuantity } from "@/lib/storefront/featuredProductNavigation";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MaterialLabel, MaterialOptionHelp } from './MaterialLabel';
import { materialPresentation } from '@/lib/products/materialPresentation';
import { adhesiveOptionLabel, adhesiveTooltipDefault, adhesiveProductionOffset, isPixartAdhesiveMaterials, productionKind } from '@/lib/products/pixartAdhesivePresentation';
import { ProductTooltipIcon } from '@/components/ProductTooltipIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProductTooltipConfigs } from '@/hooks/useProductAvailabilityTooltips';
import { PriceMatrix } from "@/components/product-price-page/PriceMatrix";
import {
  type StorformatConfig,
  type StorformatFinish,
  type StorformatMaterial,
  type StorformatProduct,
  type StorformatFixedPrice,
  tryCalculateStorformatPrice
} from "@/utils/storformatPricing";
import { cn } from "@/lib/utils";
import { usesStorformatSourceQuotes, getStorformatSourceQuoteFields, STORFORMAT_QUOTE_UNAVAILABLE_MESSAGE } from "@/lib/pricing/storformatQuoteUi";
import { prepareStorformatQuoteModel } from "@/utils/storformatQuoteModel";
import {
  normalizeThumbnailCustomPx,
  normalizeThumbnailSize,
  resolveThumbnailSizePx,
  type ThumbnailSizeMode
} from "@/lib/pricing/thumbnailSizes";
import { getHiResThumbnailUrl } from "@/lib/pricing/thumbnailImageUrl";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import {
  getOptionImageUrl,
  resolvePictureButtonsConfig,
  resolvePictureButtonStateStyles,
  resolveSelectorBoxConfig,
  resolveTextButtonsConfig,
  type SelectorStyling
} from "@/lib/pricing/selectorStyling";
import { resolveStorformatLinkedTemplateId } from "@/lib/designer/linkedTemplates";
import { resolveSelectorValueGroups, type SelectorValueGroupConfig } from "@/lib/pricing/selectorValueGroups";
import { SelectorValueGroupSection } from "./SelectorValueGroupSection";

export type StorformatSelection = {
  totalPrice: number;
  areaM2: number;
  totalAreaM2: number;
  quantity: number;
  widthCm: number;
  heightCm: number;
  materialId: string;
  finishIds: string[];
  productIds: string[];
  selectedSectionValues: Record<string, string | null>;
  materialName: string;
  finishName?: string | null;
  productName?: string | null;
  deliveryBusinessDayOffset?: number;
  splitInfo: {
    isSplit: boolean;
    piecesWide: number;
    piecesHigh: number;
    totalPieces: number;
  } | null;
  exceedsMax: boolean;
  allowSplit: boolean;
  linkedTemplateId?: string | null;
  templateShape?: WideFormatShape | null;
};

type StorformatConfiguratorProps = {
  productId: string;
  initialState?: SiteCheckoutState | null;
  sourceShapeBindings?: WideFormatShapeBinding[];
  layout?: { design: number; intro: ReactNode; media?: ReactNode; summary: ReactNode | ((productionControls: ReactNode) => ReactNode); extras: ReactNode; details?: ReactNode };
  fastProductionDayOffset?: number;
  onSelectionChange: (selection: StorformatSelection | null) => void;
};

type LayoutSectionType = "materials" | "finishes" | "products";
type LayoutDisplayMode = "buttons" | "dropdown" | "checkboxes" | "small" | "medium" | "large" | "xl" | "xl_notext";
type SelectionMode = "required" | "optional" | "free";

type ValueSettings = {
  showThumbnail?: boolean;
  customImage?: string;
  hoverImage?: string;
  imageSizePx?: number;
  displayName?: string;
  linkedTemplateId?: string;
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

type LayoutSection = {
  id: string;
  sectionType: LayoutSectionType;
  ui_mode?: LayoutDisplayMode;
  selection_mode?: SelectionMode;
  thumbnail_size?: ThumbnailSizeMode;
  thumbnail_custom_px?: number;
  title?: string;
  description?: string;
  valueIds?: string[];
  valueSettings?: Record<string, ValueSettings>;
  valueGroups?: SelectorValueGroupConfig[];
  selectorStyling?: SelectorStyling;
};

const isOptionalSelectionMode = (mode?: SelectionMode) => mode === "optional";
const isPriceNeutralSection = (section: LayoutSection, verticalAxisType?: LayoutSectionType | null) =>
  section.selection_mode === "free"
  && section.sectionType !== "materials"
  && section.sectionType !== verticalAxisType;

type LayoutRow = {
  id: string;
  title?: string;
  description?: string;
  sections: LayoutSection[];
};

type VerticalAxisConfig = {
  id: string;
  sectionType: LayoutSectionType;
  thumbnail_size?: ThumbnailSizeMode;
  thumbnail_custom_px?: number;
  title?: string;
  description?: string;
  valueIds?: string[];
  valueSettings?: Record<string, ValueSettings>;
  selectorStyling?: SelectorStyling;
};

const defaultConfig: StorformatConfig = {
  rounding_step: 1,
  global_markup_pct: 0,
  quantities: [1]
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function StorformatConfigurator({
  layout,
  productId,
  initialState,
  sourceShapeBindings,
  fastProductionDayOffset = 2,
  onSelectionChange
}: StorformatConfiguratorProps) {
  const materialTooltips = useProductTooltipConfigs(productId);
  const { language } = useLanguage();
  const noneFinishValue = "__none__";
  const [searchParams] = useSearchParams();
  const requested = readFeaturedStorformatSelection(searchParams);
  const restored = initialState?.productId === productId ? initialState.pricingQuote?.storformat : null;
  const initialWidthCm = restored ? restored.widthMm / 10 : requested.widthCm;
  const initialHeightCm = restored ? restored.heightMm / 10 : requested.heightCm;
  const initialQuantity = restored ? initialState!.quantity || 1 : requested.quantity;
  const settings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const activeBranding = (isPreviewMode && previewBranding)
    ? previewBranding
    : settings.data?.branding;
  const [config, setConfig] = useState<StorformatConfig>(defaultConfig);
  const [materials, setMaterials] = useState<StorformatMaterial[]>([]);
  const [finishes, setFinishes] = useState<StorformatFinish[]>([]);
  const [products, setProducts] = useState<StorformatProduct[]>([]);
  const isAdhesive = isPixartAdhesiveMaterials(materials);
  const [loading, setLoading] = useState(true);
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([]);
  const [verticalAxis, setVerticalAxis] = useState<VerticalAxisConfig | null>(null);
  const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string | null>>(restored?.selectedSectionValues || {});

  const [widthCm, setWidthCm] = useState(initialWidthCm);
  const [heightCm, setHeightCm] = useState(initialHeightCm);
  const [quantity, setQuantity] = useState(1);
  const [materialId, setMaterialId] = useState<string>("");
  const [finishId, setFinishId] = useState<string>(noneFinishValue);
  const [productIdSelection, setProductIdSelection] = useState<string>(noneFinishValue);
  const [hoveredPictureKey, setHoveredPictureKey] = useState<string | null>(null);

  // Use global branding for Storformat (per-product styling only applies to matrix_layout_v1)
  const pictureButtonsConfig = useMemo(() => {
    const cfg = activeBranding?.productPage?.matrix?.pictureButtons || {};
    return {
      // Display options (new)
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
      // Hover effects (existing)
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

  // Text button styling from global branding
  const textButtonsConfig = useMemo(() => {
    const cfg = activeBranding?.productPage?.matrix?.textButtons || {};
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
  }, [activeBranding?.productPage?.matrix?.textButtons]);
  useEffect(() => {
    const fetchStorformat = async () => {
      setLoading(true);
      setWidthCm(initialWidthCm);
      setHeightCm(initialHeightCm);
      try {
        const { data: cfg } = await supabase
          .from("storformat_configs")
          .select("*")
          .eq("product_id", productId)
          .maybeSingle();

        const [
          { data: materialRows },
          { data: materialTiers },
          { data: legacyMaterialPrices },
          { data: finishRows },
          { data: finishTiers },
          { data: legacyFinishPrices },
          { data: productRows },
          { data: productTiers },
          { data: productFixedPrices }
        ] = await Promise.all([
          supabase.from("storformat_materials").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_material_price_tiers").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_m2_prices").select("*").eq("product_id", productId).order("from_m2"),
          supabase.from("storformat_finishes").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_finish_price_tiers").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_finish_prices").select("*").eq("product_id", productId),
          supabase.from("storformat_products").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_product_price_tiers").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_product_fixed_prices").select("*").eq("product_id", productId).order("sort_order")
        ]);

        const perM2ProductIds = (productRows || [])
          .filter((row: any) => row?.pricing_mode === "per_m2")
          .map((row: any) => row.id)
          .filter((id: unknown): id is string => typeof id === "string");
        const hasCompletePrimaryProductTiers = perM2ProductIds.every((id) =>
          (productTiers || []).some((tier: any) => tier?.product_item_id === id)
        );

        let legacyProductM2Rows: any[] = [];
        if (perM2ProductIds.length > 0 && !hasCompletePrimaryProductTiers) {
          try {
            const { data } = await supabase
              .from("storformat_product_m2_prices" as any)
              .select("*")
              .eq("product_id", productId)
              .order("from_m2");
            legacyProductM2Rows = data || [];
          } catch {
            legacyProductM2Rows = [];
          }
        }

        const materialsWithTiers = (materialRows || []).map((m: any) => {
          const primaryTiers = (materialTiers || []).filter((t: any) => t.material_id === m.id);
          const fallbackTiers = (legacyMaterialPrices || [])
            .filter((t: any) => t.material_id === m.id)
            .map((t: any, idx: number) => ({
              id: t.id || `legacy-material-tier-${m.id}-${idx}`,
              material_id: m.id,
              from_m2: Number(t.from_m2) || 0,
              to_m2: t.to_m2 ?? null,
              price_per_m2: Number(t.price_per_m2) || 0,
              is_anchor: t.is_anchor ?? true,
              markup_pct: 0,
              sort_order: t.sort_order ?? idx
            }));
          const resolvedTiers = primaryTiers.length ? primaryTiers : fallbackTiers;
          return { ...m, tiers: resolvedTiers };
        });

        const finishesWithTiers = (finishRows || []).map((f: any) => {
          const primaryTiers = (finishTiers || []).filter((t: any) => t.finish_id === f.id);
          const legacyFinish = (legacyFinishPrices || []).find((row: any) => row.finish_id === f.id) || null;
          const fallbackTiers = legacyFinish && Number(legacyFinish.price_per_m2) > 0
            ? [{
                id: legacyFinish.id || `legacy-finish-tier-${f.id}`,
                finish_id: f.id,
                from_m2: 0,
                to_m2: null,
                price_per_m2: Number(legacyFinish.price_per_m2) || 0,
                is_anchor: true,
                markup_pct: 0,
                sort_order: 0
              }]
            : [];
          const resolvedTiers = primaryTiers.length ? primaryTiers : fallbackTiers;
          return {
            ...f,
            fixed_price_per_unit: f.fixed_price_per_unit ?? legacyFinish?.fixed_price ?? 0,
            tiers: resolvedTiers
          };
        });

        const productsWithPricing: StorformatProduct[] = (productRows || []).map((p: any) => {
          const primaryTiers = (productTiers || []).filter((t: any) => t.product_item_id === p.id);
          const fallbackTiers = legacyProductM2Rows
            .filter((t: any) => t.product_item_id === p.id || t.storformat_product_id === p.id)
            .map((t: any, idx: number) => ({
              id: t.id || `legacy-product-tier-${p.id}-${idx}`,
              product_item_id: p.id,
              from_m2: Number(t.from_m2) || 0,
              to_m2: t.to_m2 ?? null,
              price_per_m2: Number(t.price_per_m2) || 0,
              is_anchor: t.is_anchor ?? true,
              markup_pct: 0,
              sort_order: t.sort_order ?? idx
            }));
          return {
            ...p,
            tiers: primaryTiers.length ? primaryTiers : fallbackTiers,
            fixed_prices: (productFixedPrices || []).filter((fp: any) => fp.product_item_id === p.id)
          };
        });

        const idsByType: Record<LayoutSectionType, string[]> = {
          materials: materialsWithTiers.map((m) => m.id).filter(Boolean) as string[],
          finishes: finishesWithTiers.map((f) => f.id).filter(Boolean) as string[],
          products: productsWithPricing.map((p) => p.id).filter(Boolean) as string[]
        };

        const normalizeValueIds = (ids: unknown, available: string[]) => {
          if (!available.length) return [] as string[];
          const incoming = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
          const filtered = incoming.filter((id) => available.includes(id));
          return filtered.length ? filtered : [...available];
        };

        const rawLayoutRows = Array.isArray(cfg?.layout_rows) ? cfg.layout_rows : [];
        let nextLayoutRows: LayoutRow[] = rawLayoutRows
          .map((row: any, rowIndex: number) => ({
            id: row?.id || `row-${rowIndex + 1}`,
            title: row?.title,
            description: row?.description,
            sections: Array.isArray(row?.sections)
              ? row.sections
                  .map((section: any, sectionIndex: number) => {
                    const type: LayoutSectionType = section?.sectionType === "materials" || section?.sectionType === "finishes" || section?.sectionType === "products"
                      ? section.sectionType
                      : "products";
                    const available = idsByType[type];
                    if (!available.length) return null;
                    return {
                      id: section?.id || `section-${rowIndex + 1}-${sectionIndex + 1}`,
                      sectionType: type,
                      ui_mode: section?.ui_mode || "buttons",
                      selection_mode: section?.selection_mode || (type === "finishes" ? "optional" : "required"),
                      thumbnail_size: normalizeThumbnailSize(section?.thumbnail_size),
                      thumbnail_custom_px: normalizeThumbnailCustomPx(section?.thumbnail_custom_px),
                      title: section?.title,
                      description: section?.description,
                      valueIds: normalizeValueIds(section?.valueIds, available),
                      valueSettings: section?.valueSettings || {},
                      valueGroups: section?.valueGroups || section?.value_groups,
                      selectorStyling: section?.selectorStyling || {}
                    } satisfies LayoutSection;
                  })
                  .filter(Boolean) as LayoutSection[]
              : []
          }))
          .filter((row: LayoutRow) => row.sections.length > 0);

        if (!nextLayoutRows.length) {
          const defaultSections: LayoutSection[] = [];
          if (idsByType.products.length) {
            defaultSections.push({
              id: "section-products",
              sectionType: "products",
              ui_mode: "buttons",
              selection_mode: "required",
              thumbnail_size: "small",
              valueIds: [...idsByType.products],
              valueSettings: {},
              selectorStyling: {}
            });
          }
          if (idsByType.finishes.length) {
            defaultSections.push({
              id: "section-finishes",
              sectionType: "finishes",
              ui_mode: "buttons",
              selection_mode: "optional",
              thumbnail_size: "small",
              valueIds: [...idsByType.finishes],
              valueSettings: {},
              selectorStyling: {}
            });
          }
          if (defaultSections.length) {
            nextLayoutRows = [{ id: "row-1", sections: defaultSections }];
          }
        }

        const cfgVertical = cfg?.vertical_axis as Partial<VerticalAxisConfig> | null;
        const verticalType: LayoutSectionType = cfgVertical?.sectionType === "materials" || cfgVertical?.sectionType === "finishes" || cfgVertical?.sectionType === "products"
          ? cfgVertical.sectionType
          : "materials";
        const nextVerticalAxis: VerticalAxisConfig = {
        id: cfgVertical?.id || "vertical-axis",
        sectionType: verticalType,
        thumbnail_size: normalizeThumbnailSize(cfgVertical?.thumbnail_size),
        thumbnail_custom_px: normalizeThumbnailCustomPx(cfgVertical?.thumbnail_custom_px),
        title: cfgVertical?.title,
        description: cfgVertical?.description,
        valueIds: normalizeValueIds(cfgVertical?.valueIds, idsByType[verticalType]),
        valueSettings: cfgVertical?.valueSettings || {},
        selectorStyling: cfgVertical?.selectorStyling || {}
      };

        const nextConfig = cfg
          ? {
              ...getStorformatSourceQuoteFields(cfg),
              rounding_step: cfg.rounding_step || 1,
              global_markup_pct: cfg.global_markup_pct || 0,
              quantities: cfg.quantities?.length ? cfg.quantities : [1],
              layout_rows: nextLayoutRows,
              vertical_axis: nextVerticalAxis
            }
          : defaultConfig;

        if (nextConfig.source_quote_model != null) {
          try {
            nextConfig.source_quote_model = prepareStorformatQuoteModel(nextConfig.source_quote_model);
          } catch {
            // Keep malformed opt-in data unavailable; never replace it with a legacy pricing fallback.
          }
        }
        setConfig(nextConfig);
        setQuantity(resolveFeaturedQuantity(initialQuantity, nextConfig.quantities || [1]));
        setLayoutRows(nextLayoutRows);
        setVerticalAxis(nextVerticalAxis);
        setMaterials(materialsWithTiers);
        setFinishes(finishesWithTiers);
        setProducts(productsWithPricing);
        if (materialsWithTiers.length) {
          const firstMaterial = materialsWithTiers.find(item => item.id === restored?.materialId) || materialsWithTiers[0];
          setMaterialId(restored?.materialId || firstMaterial.id);

          const maxWidthCm =
            Number(firstMaterial.max_width_mm) > 0 ? Number(firstMaterial.max_width_mm) / 10 : null;
          const maxHeightCm =
            Number(firstMaterial.max_height_mm) > 0 ? Number(firstMaterial.max_height_mm) / 10 : null;

          if (maxWidthCm) {
            setWidthCm((prev) => Math.max(1, Math.min(prev, maxWidthCm)));
          }
          if (maxHeightCm) {
            setHeightCm((prev) => Math.max(1, Math.min(prev, maxHeightCm)));
          }
        }
        setFinishId(restored?.finishIds?.[0] || noneFinishValue);
        if (productsWithPricing.length) {
          setProductIdSelection(restored?.productIds?.[0] || productsWithPricing[0].id);
        }
      } catch (error) {
        console.error("Storformat fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorformat();
  }, [productId, initialWidthCm, initialHeightCm, initialQuantity]);

  const hasConfiguredLayout = layoutRows.length > 0 || !!verticalAxis;
  const verticalAxisId = verticalAxis?.id || "vertical-axis";

  const selectionModeById = useMemo<Record<string, SelectionMode>>(() => {
    const map: Record<string, SelectionMode> = {};
    layoutRows.forEach((row) => {
      row.sections.forEach((section) => {
        map[section.id] = section.selection_mode || (section.sectionType === "finishes" || section.sectionType === "products" ? "optional" : "required");
      });
    });
    return map;
  }, [layoutRows]);

  const valueSettingsById = useMemo<Record<string, Record<string, ValueSettings>>>(() => {
    const map: Record<string, Record<string, ValueSettings>> = {};
    layoutRows.forEach((row) => {
      row.sections.forEach((section) => {
        if (section.valueSettings) {
          map[section.id] = section.valueSettings;
        }
      });
    });
    if (verticalAxis?.valueSettings) {
      map[verticalAxisId] = verticalAxis.valueSettings;
    }
    return map;
  }, [layoutRows, verticalAxis, verticalAxisId]);

  const getDisplayName = useCallback((baseName?: string | null, settings?: ValueSettings) => {
    const override = settings?.displayName?.trim();
    return override || baseName || "Unavngivet";
  }, []);

  const getConfiguredValueDisplayName = useCallback((
    sectionType: LayoutSectionType,
    valueId: string | undefined,
    fallbackName?: string | null
  ) => {
    if (!valueId) return fallbackName || "Unavngivet";
    if (verticalAxis?.sectionType === sectionType) {
      const verticalName = verticalAxis.valueSettings?.[valueId]?.displayName?.trim();
      if (verticalName) return verticalName;
    }
    for (const row of layoutRows) {
      for (const section of row.sections) {
        if (section.sectionType !== sectionType) continue;
        if (!section.valueIds?.includes(valueId)) continue;
        const sectionName = section.valueSettings?.[valueId]?.displayName?.trim();
        if (sectionName) return sectionName;
      }
    }
    return fallbackName || "Unavngivet";
  }, [layoutRows, verticalAxis]);

  const getValuesForType = useCallback((type: LayoutSectionType): Array<StorformatMaterial | StorformatFinish | StorformatProduct> => {
    switch (type) {
      case "materials":
        return materials;
      case "finishes":
        return finishes;
      case "products":
        return products;
      default:
        return [];
    }
  }, [materials, finishes, products]);

  const orderValuesByIds = useCallback(<T extends { id?: string }>(values: T[], ids?: string[]) => {
    if (ids === undefined) return values;
    if (ids.length === 0) return [];
    const valueMap = new Map(values.map((value) => [value.id, value]));
    return ids.map((id) => valueMap.get(id)).filter((value): value is T => Boolean(value));
  }, []);

  const getSectionValues = useCallback((section: LayoutSection) => {
    const values = getValuesForType(section.sectionType);
    const ordered = orderValuesByIds(values, section.valueIds);
    return ordered;
  }, [getValuesForType, orderValuesByIds]);

  const getVerticalAxisValues = useCallback(() => {
    if (!verticalAxis) return [];
    const values = getValuesForType(verticalAxis.sectionType);
    return orderValuesByIds(values, verticalAxis.valueIds);
  }, [getValuesForType, orderValuesByIds, verticalAxis]);

  useEffect(() => {
    if (!hasConfiguredLayout) return;

    setSelectedSectionValues((prev) => {
      let changed = false;
      const next: Record<string, string | null> = { ...prev };

      if (verticalAxis) {
        const axisValues = getVerticalAxisValues();
        if (axisValues.length) {
          const current = next[verticalAxisId];
          if (!current || !axisValues.some((v) => v.id === current)) {
            next[verticalAxisId] = axisValues[0].id || null;
            changed = true;
          }
        } else if (next[verticalAxisId]) {
          delete next[verticalAxisId];
          changed = true;
        }
      }

      layoutRows.forEach((row) => {
        row.sections.forEach((section) => {
          if (verticalAxis && section.sectionType === verticalAxis.sectionType) return;
          if (isPriceNeutralSection(section, verticalAxis?.sectionType)) return;
          const values = getSectionValues(section);
          const isOptional = isOptionalSelectionMode(selectionModeById[section.id]);
          if (values.length === 0) {
            if (next[section.id]) {
              delete next[section.id];
              changed = true;
            }
            return;
          }
          const current = next[section.id];
          const isValid = current && values.some((value) => value.id === current);
          if (!isValid) {
            if (!isOptional) {
              next[section.id] = values[0].id || null;
              changed = true;
            } else if (current != null) {
              delete next[section.id];
              changed = true;
            }
          }
        });
      });

      const validIds = new Set<string>();
      if (verticalAxis) {
        validIds.add(verticalAxisId);
      }
      layoutRows.forEach((row) => {
        row.sections.forEach((section) => {
          if (verticalAxis && section.sectionType === verticalAxis.sectionType) return;
          validIds.add(section.id);
        });
      });
      Object.keys(next).forEach((id) => {
        if (!validIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [hasConfiguredLayout, layoutRows, verticalAxis, verticalAxisId, getSectionValues, getVerticalAxisValues, selectionModeById]);

  const hasUsableLayout = useMemo(() => {
    if (!hasConfiguredLayout || materials.length === 0) return false;
    const hasAxisValues = Boolean(verticalAxis && getVerticalAxisValues().length > 0);
    const hasRenderableSections = layoutRows.some((row) =>
      row.sections.some((section) => {
        if (verticalAxis && section.sectionType === verticalAxis.sectionType) return false;
        return getSectionValues(section).length > 0;
      })
    );
    return hasAxisValues || hasRenderableSections;
  }, [getSectionValues, getVerticalAxisValues, hasConfiguredLayout, layoutRows, materials.length, verticalAxis]);

  const resolveSelectionsForType = useCallback(
    (
      type: LayoutSectionType,
      options?: {
        overrideVerticalValueId?: string | null;
        overrideSectionSelection?: Record<string, string | null | undefined>;
      }
    ) => {
      if (!hasUsableLayout) return [] as string[];

      const overrideSelection = options?.overrideSectionSelection || {};
      if (verticalAxis?.sectionType === type) {
        const selectedValue =
          options?.overrideVerticalValueId ??
          overrideSelection[verticalAxisId] ??
          selectedSectionValues[verticalAxisId] ??
          null;
        return selectedValue ? [selectedValue] : [];
      }

      const resolved: string[] = [];
      for (const row of layoutRows) {
        for (const section of row.sections) {
          if (section.sectionType !== type) continue;
          if (isPriceNeutralSection(section, verticalAxis?.sectionType)) continue;
          const values = getSectionValues(section);
          if (!values.length) continue;

          const selectedValue = overrideSelection[section.id] ?? selectedSectionValues[section.id] ?? null;
          if (selectedValue && values.some((value) => value.id === selectedValue)) {
            resolved.push(selectedValue);
            continue;
          }

          if (!isOptionalSelectionMode(selectionModeById[section.id])) {
            const fallback = values[0]?.id;
            if (fallback) {
              resolved.push(fallback);
            }
          }
        }
      }

      return [...new Set(resolved)];
    },
    [
      getSectionValues,
      hasUsableLayout,
      layoutRows,
      selectedSectionValues,
      selectionModeById,
      verticalAxis,
      verticalAxisId,
    ]
  );

  const resolveSelectionForType = useCallback(
    (
      type: LayoutSectionType,
      options?: {
        overrideVerticalValueId?: string | null;
        overrideSectionSelection?: Record<string, string | null | undefined>;
      }
    ) => resolveSelectionsForType(type, options)[0] || null,
    [resolveSelectionsForType]
  );

  const templateShape = useMemo(() => {
    const ids = hasUsableLayout ? resolveSelectionsForType("products") : productIdSelection === noneFinishValue ? [] : [productIdSelection];
    return resolveWideFormatShape(products.filter(product => ids.includes(product.id || "")), sourceShapeBindings);
  }, [hasUsableLayout, resolveSelectionsForType, productIdSelection, products, sourceShapeBindings]);
  const effectiveSize = proportionalSize(templateShape, widthCm, heightCm);
  const effectiveWidthCm = effectiveSize.width;
  const effectiveHeightCm = effectiveSize.height;
  // Keep the actual input/quote dimensions in sync when a proportional shape is selected.
  useEffect(() => {
    if (templateShape?.ratio) setHeightCm(effectiveHeightCm);
  }, [templateShape?.ratio, effectiveHeightCm]);
  const editDimension = (axis: 'width' | 'height', value: number) => {
    const next = proportionalSize(templateShape, axis === 'width' ? value : widthCm, axis === 'height' ? value : heightCm, axis);
    setWidthCm(next.width); setHeightCm(next.height);
  };

  const selection = useMemo<StorformatSelection | null>(() => {
    const selectedMaterialIds = hasUsableLayout ? resolveSelectionsForType("materials") : materialId ? [materialId] : [];
    const selectedMaterialId = selectedMaterialIds[0] || null;
    const material = materials.find((m) => m.id === selectedMaterialId);
    if (!material) return null;
    if (widthCm <= 0 || heightCm <= 0 || quantity <= 0) return null;

    const widthMm = effectiveWidthCm * 10;
    const heightMm = effectiveHeightCm * 10;
    const selectedFinishIds = hasUsableLayout
      ? resolveSelectionsForType("finishes")
      : finishId === noneFinishValue
        ? []
        : [finishId];
    const selectedProductIds = hasUsableLayout
      ? resolveSelectionsForType("products")
      : productIdSelection === noneFinishValue
        ? []
        : [productIdSelection];
    const selectedFinishes = selectedFinishIds
      .map((id) => finishes.find((f) => f.id === id) || null)
      .filter((value): value is StorformatFinish => Boolean(value));
    const selectedProducts = selectedProductIds
      .map((id) => products.find((p) => p.id === id) || null)
      .filter((value): value is StorformatProduct => Boolean(value));

    const result = tryCalculateStorformatPrice({
      widthMm,
      heightMm,
      quantity,
      material,
      finish: selectedFinishes[0] || null,
      finishes: selectedFinishes,
      product: selectedProducts[0] || null,
      products: selectedProducts,
      config
    });

    if (!result) return null;

    const maxW = material.max_width_mm ?? 0;
    const maxH = material.max_height_mm ?? 0;
    const exceedsMax = Boolean(maxW && widthMm > maxW) || Boolean(maxH && heightMm > maxH);

    return {
      totalPrice: result.totalPrice,
      areaM2: result.areaM2,
      totalAreaM2: result.totalAreaM2,
      quantity,
      widthCm: effectiveWidthCm,
      heightCm: effectiveHeightCm,
      templateShape,
      materialId: material.id,
      finishIds: selectedFinishes.map((item) => item.id),
      productIds: selectedProducts.map((item) => item.id),
      selectedSectionValues: { ...selectedSectionValues },
      materialName: getConfiguredValueDisplayName("materials", material.id, material.name),
      finishName: selectedFinishes.length
        ? selectedFinishes.map((item) => getConfiguredValueDisplayName("finishes", item.id, item.name)).join(", ")
        : null,
      productName: selectedProducts.length
        ? selectedProducts.map((item) => getConfiguredValueDisplayName("products", item.id, item.name)).join(", ")
        : null,
      deliveryBusinessDayOffset: isAdhesive ? adhesiveProductionOffset(selectedProducts.map(item => item.name), fastProductionDayOffset) : undefined,
      splitInfo: result.splitInfo,
      exceedsMax,
      allowSplit: material.allow_split ?? true,
      linkedTemplateId: resolveStorformatLinkedTemplateId(
        {
          verticalAxis,
          layoutRows,
        },
        selectedSectionValues,
      ),
    };
  }, [materials, finishes, products, materialId, finishId, productIdSelection, effectiveWidthCm, effectiveHeightCm, widthCm, heightCm, templateShape, quantity, config, hasUsableLayout, resolveSelectionsForType, getConfiguredValueDisplayName, verticalAxis, layoutRows, selectedSectionValues, isAdhesive, fastProductionDayOffset]);

  useEffect(() => {
    onSelectionChange(selection);
  }, [selection, onSelectionChange]);

  const quantities = useMemo(() => config.quantities?.length ? config.quantities : [1], [config.quantities]);
  const sortedQuantities = useMemo(() => [...quantities].sort((a, b) => a - b), [quantities]);

  const getSectionLabel = useCallback((sectionType: LayoutSectionType, title?: string) => {
    if (title) return title;
    switch (sectionType) {
      case "materials":
        return "Materialer";
      case "finishes":
        return "Efterbehandling";
      case "products":
        return "Produkter";
      default:
        return "Valgmuligheder";
    }
  }, []);

  const renderUngroupedValueSelector = useCallback((section: LayoutSection, values: Array<StorformatMaterial | StorformatFinish | StorformatProduct>) => {
    const displayMode = section.ui_mode || "buttons";
    const isOptional = isOptionalSelectionMode(selectionModeById[section.id]);
    const selectedValue = selectedSectionValues[section.id] || "";
    const valueSettings = valueSettingsById[section.id] || {};
    const thumbnailPx = resolveThumbnailSizePx(section.thumbnail_size, section.thumbnail_custom_px);
    const selectorStyling = section.selectorStyling || {};
    const sectionTextButtonsConfig = resolveTextButtonsConfig({
      productConfig: textButtonsConfig,
      selectorConfig: selectorStyling.textButtons,
    });
    const sectionPictureButtonsConfig = resolvePictureButtonsConfig({
      productConfig: pictureButtonsConfig,
      selectorConfig: selectorStyling.pictureButtons,
      uiMode: displayMode,
      thumbnailSize: section.thumbnail_size,
      thumbnailCustomPx: section.thumbnail_custom_px,
      fallbackHoverColor: activeBranding?.colors?.hover || activeBranding?.colors?.primary || "#0EA5E9",
      fallbackSelectedColor: activeBranding?.colors?.primary || "#0EA5E9",
    });
    const sourceFor = (value: StorformatMaterial | StorformatFinish | StorformatProduct) => ({name:getDisplayName(value.name,valueSettings[value.id || ""]),sourceName:value.name || ""});
    const presentedName = (value: StorformatMaterial | StorformatFinish | StorformatProduct) => isAdhesive ? adhesiveOptionLabel(section.sectionType, value.name, language) : section.sectionType === "materials" ? materialPresentation(sourceFor(value)).label : sourceFor(value).name;
    const selectedMaterial = values.find(value=>value.id===selectedValue);
    const isOptionalEnabled = !isOptional || Boolean(selectedSectionValues[section.id]);

    const handleSelect = (valueId: string | null) => {
      setSelectedSectionValues((prev) => {
        const next = { ...prev };
        if (!valueId) {
          delete next[section.id];
        } else {
          next[section.id] = valueId;
        }
        return next;
      });
    };

    if (isAdhesive && (section.sectionType === 'finishes' || (section.sectionType === 'products' && values.every(value => productionKind(value.name))))) {
      return <div className="adhesive-option-buttons" role="group" aria-label={section.sectionType === 'finishes' ? (language === 'en' ? 'Finishing' : 'Efterbehandling') : (language === 'en' ? 'Production time' : 'Produktionstid')}>
        {isOptional && section.sectionType === 'finishes' && <button type="button" aria-pressed={!selectedValue} className="adhesive-option-button" onClick={() => handleSelect(null)}>{language === 'en' ? 'None' : 'Ingen'}</button>}
        {values.map(value => {
          const help = adhesiveTooltipDefault(section.sectionType, sourceFor(value), section.id, value.id || '');
          const savedHelp = help && (materialTooltips.find(item => item.anchor === help.anchor) || help);
          return <span key={value.id} className="adhesive-option-with-help" data-tooltip-anchor={help?.anchor}>
            <button type="button" className="adhesive-option-button" aria-pressed={selectedValue === value.id} data-site-design-target={`product-option.${productId}.${section.id}.${value.id}.${encodeURIComponent(value.name)}`} onClick={() => handleSelect(value.id || null)} style={{backgroundColor:selectedValue === value.id ? sectionTextButtonsConfig.selectedBackgroundColor : sectionTextButtonsConfig.backgroundColor,color:selectedValue === value.id ? sectionTextButtonsConfig.selectedTextColor : sectionTextButtonsConfig.textColor,borderColor:selectedValue === value.id ? sectionTextButtonsConfig.selectedBackgroundColor : sectionTextButtonsConfig.borderColor}}><span className="adhesive-option-text">{presentedName(value)}</span></button>
            {savedHelp && <ProductTooltipIcon config={savedHelp} className="adhesive-option-help"/>}
          </span>;
        })}
      </div>;
    }

    if (displayMode === "dropdown") {
      return (
        <MaterialOptionHelp source={selectedMaterial ? sourceFor(selectedMaterial) : {name:''}} sectionId={section.id} valueId={selectedValue} tooltips={materialTooltips} enabled={section.sectionType==='materials' && Boolean(selectedMaterial)}>
        <Select
          value={selectedValue || (isOptional ? "__none__" : "")}
          onValueChange={(value) => {
            if (isOptional && value === "__none__") {
              handleSelect(null);
              return;
            }
            handleSelect(value);
          }}
          disabled={!isOptionalEnabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Vaelg" />
          </SelectTrigger>
          <SelectContent>
            {isOptional && <SelectItem value="__none__">Ingen</SelectItem>}
            {values.map((value) => {
              const settings = valueSettings[value.id || ""];
              const thumbnailUrl = getOptionImageUrl(settings, value.thumbnail_url);
              const displayName = getDisplayName(value.name, settings);
              return (
                <SelectItem key={value.id} value={value.id || ""}>
                  <div className="flex items-center gap-2">
                    {settings?.showThumbnail && thumbnailUrl && (
                      <img
                        src={getHiResThumbnailUrl(thumbnailUrl, thumbnailPx, thumbnailPx)}
                        className="rounded object-cover shrink-0"
                        style={{ width: thumbnailPx, height: thumbnailPx }}
                      />
                    )}
                    {presentedName(value)}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        </MaterialOptionHelp>
      );
    }

    if (displayMode === "checkboxes") {
      return (
        <div className={cn("space-y-1", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
          {values.map((value) => {
            const isSelected = selectedValue === value.id;
            const valueSetting = valueSettings[value.id || ""];
            const displayName = getDisplayName(value.name, valueSetting);
            const checkboxKey = `${section.id}:${value.id || ""}`;
            const isHovered = hoveredPictureKey === checkboxKey;
            const primaryThumbUrl = getOptionImageUrl(valueSetting, value.thumbnail_url);
            const renderedThumbUrl = isHovered && valueSetting?.hoverImage
              ? valueSetting.hoverImage
              : primaryThumbUrl;
            const imagePx = valueSetting?.imageSizePx ?? thumbnailPx;
            const contextualId = `product-option.${productId}.${section.id}.${value.id || ""}.${encodeURIComponent(displayName)}`;
            return (
              <MaterialOptionHelp key={value.id} source={sourceFor(value)} sectionId={section.id} valueId={value.id || ''} tooltips={materialTooltips} enabled={section.sectionType==='materials'}>
              <label
                data-site-design-target={contextualId}
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                  isSelected ? "bg-primary/10 border-primary" : "bg-background border-muted hover:border-muted-foreground/30"
                )}
                onClick={() => {
                  if (window.parent !== window) {
                    window.parent.postMessage({
                      type: "EDIT_SECTION",
                      sectionId: contextualId,
                    }, "*");
                  }
                  if (isOptional && isSelected) {
                    handleSelect(null);
                    return;
                  }
                  handleSelect(value.id || null);
                }}
                onMouseEnter={() => setHoveredPictureKey(checkboxKey)}
                onMouseLeave={() => setHoveredPictureKey((prev) => (prev === checkboxKey ? null : prev))}
              >
                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                {valueSetting?.showThumbnail && renderedThumbUrl && (
                  <img
                    src={getHiResThumbnailUrl(
                      renderedThumbUrl,
                      imagePx,
                      imagePx
                    )}
                    alt={presentedName(value)}
                    className="rounded object-cover shrink-0"
                    style={{ width: imagePx, height: imagePx }}
                  />
                )}
                <span className="font-medium flex-1">{presentedName(value)}</span>
              </label>
              </MaterialOptionHelp>
            );
          })}
        </div>
      );
    }

    if (["small", "medium", "large", "xl", "xl_notext"].includes(displayMode)) {
      return (
        <div
          className={cn("flex flex-wrap", !isOptionalEnabled && "opacity-60 pointer-events-none")}
          style={{ gap: `${sectionPictureButtonsConfig.gapBetweenPx}px` }}
        >
          {values.map((value) => {
            const pictureKey = `${section.id}:${value.id || ""}`;
            const isHovered = hoveredPictureKey === pictureKey;
            const isSelected = selectedValue === value.id;
            const valueSetting = valueSettings[value.id || ""];
            const primaryThumbnailUrl = getOptionImageUrl(valueSetting, value.thumbnail_url);
            const displayName = getDisplayName(value.name, valueSetting);
            const pictureImagePx = valueSetting?.imageSizePx ?? sectionPictureButtonsConfig.sizePx;
            const thumbnailUrl = isHovered && valueSetting?.hoverImage
              ? valueSetting.hoverImage
              : primaryThumbnailUrl;
            const pictureStateStyles = resolvePictureButtonStateStyles(sectionPictureButtonsConfig, {
              isHovered,
              isSelected,
            });
            const overlayColor = pictureStateStyles.backgroundColor !== sectionPictureButtonsConfig.backgroundColor
              ? pictureStateStyles.backgroundColor
              : undefined;
            const useDetachedLabel = (
              sectionPictureButtonsConfig.displayMode === "text_below_image"
              || sectionPictureButtonsConfig.labelOutsideImage
            )
              && sectionPictureButtonsConfig.showImage
              && sectionPictureButtonsConfig.showLabel;
            const buttonWidth = sectionPictureButtonsConfig.showImage ? pictureImagePx : 'auto';
            const buttonHeight = !useDetachedLabel && sectionPictureButtonsConfig.showImage
              ? pictureImagePx + (sectionPictureButtonsConfig.showLabel ? 24 : 0)
              : 'auto';
            const contextualId = `product-option.${productId}.${section.id}.${value.id || ""}.${encodeURIComponent(displayName)}`;
            const pictureBackgroundColor = valueSetting?.backgroundColor || sectionPictureButtonsConfig.backgroundColor;
            const pictureTextColor = valueSetting?.textColor || sectionPictureButtonsConfig.textColor;
            const pictureBorderColor = valueSetting?.borderColor || pictureStateStyles.borderColor;
            const pictureBorderRadius = valueSetting?.borderRadiusPx ?? sectionPictureButtonsConfig.imageBorderRadiusPx;
            const pictureBorderWidth = valueSetting?.borderWidthPx ?? sectionPictureButtonsConfig.borderWidthPx;

            return (
              <MaterialOptionHelp key={value.id} source={sourceFor(value)} sectionId={section.id} valueId={value.id || ''} tooltips={materialTooltips} enabled={section.sectionType==='materials'}>
              <button
                data-site-design-target={contextualId}
                type="button"
                aria-pressed={isSelected}
                aria-label={presentedName(value)}
                onClick={() => {
                  if (window.parent !== window) {
                    window.parent.postMessage({
                      type: "EDIT_SECTION",
                      sectionId: contextualId,
                    }, "*");
                  }
                  if (isOptional && isSelected) {
                    handleSelect(null);
                    return;
                  }
                  handleSelect(value.id || null);
                }}
                disabled={!isOptionalEnabled}
                onMouseEnter={() => setHoveredPictureKey(pictureKey)}
                onMouseLeave={() => setHoveredPictureKey((prev) => (prev === pictureKey ? null : prev))}
                className={cn(
                  "transition-all",
                  useDetachedLabel
                    ? "flex flex-col items-center gap-1 bg-transparent p-0"
                    : "relative flex overflow-hidden border-2 flex-col items-center",
                  isSelected ? "shadow-none" : "",
                  !isOptionalEnabled && "cursor-not-allowed"
                )}
                style={{
                  width: buttonWidth,
                  minHeight: buttonHeight,
                  backgroundColor: useDetachedLabel ? "transparent" : pictureBackgroundColor,
                  borderColor: useDetachedLabel ? "transparent" : pictureBorderColor,
                  borderRadius: useDetachedLabel ? undefined : `${pictureBorderRadius}px`,
                  borderWidth: useDetachedLabel ? 0 : `${pictureBorderWidth}px`,
                  borderStyle: useDetachedLabel ? 'none' : 'solid',
                  boxShadow: useDetachedLabel ? undefined : pictureStateStyles.boxShadow,
                  transform: pictureStateStyles.transform,
                  transitionDuration: pictureStateStyles.transitionDuration,
                }}
              >
                {useDetachedLabel ? (
                  <>
                    <span
                      className="relative flex overflow-hidden border-2"
                      style={{
                        width: buttonWidth,
                        minHeight: pictureImagePx,
                        backgroundColor: pictureBackgroundColor,
                        borderColor: pictureBorderColor,
                        borderRadius: `${pictureBorderRadius}px`,
                        borderWidth: `${pictureBorderWidth}px`,
                        borderStyle: 'solid',
                        boxShadow: pictureStateStyles.boxShadow,
                      }}
                    >
                      {overlayColor && (
                        <span
                          className="pointer-events-none absolute inset-0 z-10"
                          style={{ backgroundColor: overlayColor }}
                        />
                      )}
                      {thumbnailUrl ? (
                        <img
                          src={getHiResThumbnailUrl(thumbnailUrl, pictureImagePx, pictureImagePx)}
                          alt={presentedName(value)}
                          className="relative z-0 w-full object-cover"
                          style={{ height: pictureImagePx }}
                        />
                      ) : (
                        <div
                          className="relative z-0 flex w-full items-center justify-center text-xs font-semibold"
                          style={{
                            height: pictureImagePx,
                            color: pictureTextColor,
                            backgroundColor: pictureBackgroundColor,
                          }}
                        >
                          {(presentedName(value) || "?").slice(0, 3).toUpperCase()}
                        </div>
                      )}
                    </span>
                    <span
                      className="w-full break-words px-1 text-center leading-snug"
                      style={{
                        color: sectionPictureButtonsConfig.textColor,
                        fontSize: `${valueSetting?.fontSizePx ?? sectionPictureButtonsConfig.labelFontSizePx}px`,
                      }}
                    >
                      {presentedName(value)}
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
                    {sectionPictureButtonsConfig.showImage && (thumbnailUrl ? (
                      <img
                        src={getHiResThumbnailUrl(thumbnailUrl, pictureImagePx, pictureImagePx)}
                        alt={presentedName(value)}
                        className="relative z-0 w-full object-cover"
                        style={{
                          height: pictureImagePx,
                          borderRadius: sectionPictureButtonsConfig.isTextBelow ? `${sectionPictureButtonsConfig.imageBorderRadiusPx}px ${sectionPictureButtonsConfig.imageBorderRadiusPx}px 0 0` : undefined
                        }}
                      />
                    ) : (
                      <div
                        className="relative z-0 w-full flex items-center justify-center text-xs font-semibold"
                        style={{
                          height: pictureImagePx,
                          color: pictureTextColor,
                          backgroundColor: pictureBackgroundColor,
                          borderRadius: sectionPictureButtonsConfig.isTextBelow ? `${pictureBorderRadius}px ${pictureBorderRadius}px 0 0` : undefined
                        }}
                      >
                        {(presentedName(value) || "?").slice(0, 3).toUpperCase()}
                      </div>
                    ))}
                    {sectionPictureButtonsConfig.showLabel && (
                      <span
                        className="relative z-20 w-full truncate px-1 py-1 text-center leading-tight"
                        style={{
                          color: sectionPictureButtonsConfig.textColor,
                          fontSize: `${valueSetting?.fontSizePx ?? sectionPictureButtonsConfig.labelFontSizePx}px`,
                        }}
                      >
                        {presentedName(value)}
                      </span>
                    )}
                  </>
                )}
              </button>
              </MaterialOptionHelp>
            );
          })}
        </div>
      );
    }

    // Apply per-product text button styling
    return (
      <div
        className={cn("flex flex-wrap", !isOptionalEnabled && "opacity-60 pointer-events-none")}
        style={{ gap: `${sectionTextButtonsConfig.paddingPx / 2}px` }}
      >
        {values.map((value) => {
          const isSelected = selectedValue === value.id;
          const valueSetting = valueSettings[value.id || ""];
          const displayName = getDisplayName(value.name, valueSetting);
          const buttonKey = `${section.id}:${value.id || ""}`;
          const isHovered = hoveredPictureKey === buttonKey;
          const paddingPx = valueSetting?.paddingPx ?? sectionTextButtonsConfig.paddingPx;
          const borderRadiusPx = valueSetting?.borderRadiusPx ?? sectionTextButtonsConfig.borderRadiusPx;
          const primaryThumbUrl = getOptionImageUrl(valueSetting, value.thumbnail_url);
          const renderedThumbUrl = isHovered && valueSetting?.hoverImage
            ? valueSetting.hoverImage
            : primaryThumbUrl;
          const imagePx = valueSetting?.imageSizePx ?? thumbnailPx;
          const contextualId = `product-option.${productId}.${section.id}.${value.id || ""}.${encodeURIComponent(displayName)}`;

          // Determine colors based on state
          const bgColor = isSelected
            ? sectionTextButtonsConfig.selectedBackgroundColor
            : (valueSetting?.backgroundColor || sectionTextButtonsConfig.backgroundColor);
          const textColor = isSelected
            ? sectionTextButtonsConfig.selectedTextColor
            : (valueSetting?.textColor || sectionTextButtonsConfig.textColor);
          const borderColor = isSelected
            ? sectionTextButtonsConfig.selectedBackgroundColor
            : (valueSetting?.borderColor || sectionTextButtonsConfig.borderColor);

          return (
            <MaterialOptionHelp key={value.id} source={sourceFor(value)} sectionId={section.id} valueId={value.id || ''} tooltips={materialTooltips} enabled={section.sectionType==='materials'}>
            <button
              data-site-design-target={contextualId}
              type="button"
              aria-pressed={isSelected}
              aria-label={presentedName(value)}
              onClick={() => {
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: "EDIT_SECTION",
                    sectionId: contextualId,
                  }, "*");
                }
                if (isOptional && isSelected) {
                  handleSelect(null);
                  return;
                }
                handleSelect(value.id || null);
              }}
              disabled={!isOptionalEnabled}
              className={cn(
                "transition-all duration-200 flex items-center gap-2",
                isSelected && "font-semibold",
                !isOptionalEnabled && "opacity-45 cursor-not-allowed"
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
              }}
              onMouseEnter={(e) => {
                setHoveredPictureKey(buttonKey);
                if (isSelected) return;
                e.currentTarget.style.backgroundColor = valueSetting?.hoverBackgroundColor || sectionTextButtonsConfig.hoverBackgroundColor;
                e.currentTarget.style.color = valueSetting?.hoverTextColor || sectionTextButtonsConfig.hoverTextColor;
                e.currentTarget.style.borderColor = valueSetting?.hoverBorderColor || sectionTextButtonsConfig.hoverBorderColor;
              }}
              onMouseLeave={(e) => {
                setHoveredPictureKey((prev) => (prev === buttonKey ? null : prev));
                if (isSelected) return;
                e.currentTarget.style.backgroundColor = valueSetting?.backgroundColor || sectionTextButtonsConfig.backgroundColor;
                e.currentTarget.style.color = valueSetting?.textColor || sectionTextButtonsConfig.textColor;
                e.currentTarget.style.borderColor = valueSetting?.borderColor || sectionTextButtonsConfig.borderColor;
              }}
            >
              {valueSetting?.showThumbnail && renderedThumbUrl && (
                <img
                  src={getHiResThumbnailUrl(
                    renderedThumbUrl,
                    imagePx,
                    imagePx
                  )}
                  alt={presentedName(value)}
                  className={cn("object-contain shrink-0", isSelected && "bg-white p-1")}
                  style={{
                    width: imagePx,
                    height: imagePx,
                    borderRadius: `${borderRadiusPx / 2}px`
                  }}
                />
              )}
              {presentedName(value)}
            </button>
            </MaterialOptionHelp>
          );
        })}
      </div>
    );
  }, [materialTooltips, getDisplayName, productId, activeBranding?.colors?.hover, activeBranding?.colors?.primary, hoveredPictureKey, pictureButtonsConfig, textButtonsConfig, selectionModeById, selectedSectionValues, valueSettingsById, isAdhesive, language]);

  const verticalAxisValues = useMemo(() => getVerticalAxisValues(), [getVerticalAxisValues]);

  const renderValueSelector = (section: LayoutSection, values: Array<StorformatMaterial | StorformatFinish | StorformatProduct>) => {
    if (isAdhesive && section.sectionType !== 'materials') return renderUngroupedValueSelector(section, values);
    const groups = resolveSelectorValueGroups(
      values.filter((value): value is typeof value & { id: string } => typeof value.id === "string"),
      section.valueGroups,
    );
    if (!groups.length) return renderUngroupedValueSelector(section, values);
    const selectedId = selectedSectionValues[section.id];
    return (
      <div className="space-y-4" data-selector-value-groups="true">
        {groups.map((group) => {
          const selected = group.values.find(value => value.id === selectedId);
          return (
            <SelectorValueGroupSection
              key={group.id}
              group={group}
              selectedLabel={selected ? (section.sectionType === "materials" ? materialPresentation({name:getDisplayName(selected.name,section.valueSettings?.[selected.id]),sourceName:selected.name || ""}).label : getDisplayName(selected.name, section.valueSettings?.[selected.id])) : undefined}
            >
              {renderUngroupedValueSelector({ ...section, ui_mode: (group.uiMode as LayoutDisplayMode) || section.ui_mode }, group.values)}
            </SelectorValueGroupSection>
          );
        })}
      </div>
    );
  };

  const matrixData = useMemo(() => {
    if (!verticalAxis || verticalAxisValues.length === 0 || sortedQuantities.length === 0) {
      return {
        rows: [] as string[],
        columns: [] as number[],
        cells: {} as Record<string, Record<number, number>>,
        rowIdByLabel: {} as Record<string, string>,
        rowLabelById: {} as Record<string, string>
      };
    }

    const widthMm = effectiveWidthCm * 10;
    const heightMm = effectiveHeightCm * 10;
    const rows: string[] = [];
    const cells: Record<string, Record<number, number>> = {};
    const rowIdByLabel: Record<string, string> = {};
    const rowLabelById: Record<string, string> = {};
    const nameCounts = new Map<string, number>();

    const baseMaterialId = resolveSelectionForType("materials");
    const baseFinishIds = resolveSelectionsForType("finishes");
    const baseProductIds = resolveSelectionsForType("products");

    verticalAxisValues.forEach((value) => {
      const baseName = getDisplayName(value.name, verticalAxis.valueSettings?.[value.id || ""]);
      const count = nameCounts.get(baseName) || 0;
      const label = count === 0 ? baseName : `${baseName} (${count + 1})`;
      nameCounts.set(baseName, count + 1);
      rows.push(label);
      rowIdByLabel[label] = value.id || "";
      rowLabelById[value.id || ""] = label;
      cells[label] = {};

      sortedQuantities.forEach((qty) => {
        const materialIdForRow = verticalAxis.sectionType === "materials" ? value.id : baseMaterialId;
        const finishIdsForRow = verticalAxis.sectionType === "finishes" ? [value.id || ""] : baseFinishIds;
        const productIdsForRow = verticalAxis.sectionType === "products" ? [value.id || ""] : baseProductIds;

        const material = materialIdForRow ? materials.find((m) => m.id === materialIdForRow) : null;
        const selectedFinishes = finishIdsForRow
          .map((id) => finishes.find((f) => f.id === id) || null)
          .filter((item): item is StorformatFinish => Boolean(item));
        const selectedProducts = productIdsForRow
          .map((id) => products.find((p) => p.id === id) || null)
          .filter((item): item is StorformatProduct => Boolean(item));
        if (!material) return;

        const result = tryCalculateStorformatPrice({
          widthMm,
          heightMm,
          quantity: qty,
          material,
          finish: selectedFinishes[0] || null,
          finishes: selectedFinishes,
          product: selectedProducts[0] || null,
          products: selectedProducts,
          config
        });
        if (result) cells[label][qty] = result.totalPrice;
      });
    });

    return {
      rows,
      columns: sortedQuantities,
      cells,
      rowIdByLabel,
      rowLabelById
    };
  }, [verticalAxis, verticalAxisValues, sortedQuantities, effectiveWidthCm, effectiveHeightCm, resolveSelectionForType, resolveSelectionsForType, materials, finishes, products, config, getDisplayName]);

  const matrixSelectedCell = useMemo(() => {
    if (!verticalAxis) return null;
    const selectedId = selectedSectionValues[verticalAxisId];
    if (!selectedId) return null;
    const rowLabel = matrixData.rowLabelById[selectedId];
    if (!rowLabel) return null;
    return { row: rowLabel, column: quantity };
  }, [verticalAxis, verticalAxisId, selectedSectionValues, matrixData.rowLabelById, quantity]);

  const handleMatrixCellClick = useCallback((row: string, column: number) => {
    if (usesStorformatSourceQuotes(config) && matrixData.cells[row]?.[column] === undefined) return;
    setQuantity(column);
    if (!verticalAxis) return;
    const rowId = matrixData.rowIdByLabel[row];
    if (!rowId) return;
    setSelectedSectionValues((prev) => ({ ...prev, [verticalAxisId]: rowId }));
  }, [config, matrixData.cells, matrixData.rowIdByLabel, verticalAxis, verticalAxisId]);

  const isProductionSection = (section: LayoutSection) => isAdhesive && section.sectionType === 'products' && getSectionValues(section).length > 0 && getSectionValues(section).every(value => productionKind(value.name));
  const productionSections = layoutRows.flatMap(row => row.sections).filter(isProductionSection);
  const productionControls = productionSections.length > 0 ? <div className="adhesive-production-controls space-y-2">
    <span className="text-sm font-semibold">{language === 'en' ? 'Production time' : 'Produktionstid'}</span>
    {productionSections.map(section => <div key={section.id}>{renderValueSelector(section, getSectionValues(section))}</div>)}
  </div> : null;
  const controls = <div className="order-calculator-controls space-y-4">
      <div className="order-calculator-controls-heading flex items-center justify-between">
        <h3 className="font-semibold">{layout ? "Beregn din pris" : "Storformat"}</h3>
        <div className="order-calculator-controls-meta flex items-center gap-3 text-xs text-muted-foreground">
          {selection && (
            <>
              <span>{selection.totalAreaM2.toFixed(2)} m2 total</span>
              <span>{selection.quantity} stk</span>
            </>
          )}
          {loading && <span>Indlæser…</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="storformat-width">{templateShape?.id === "round" ? "Diameter (cm)" : "Længde (cm)"}</Label>
          <Input
            id="storformat-width"
            type="number"
            min="1"
            step="any"
            value={effectiveWidthCm}
            onChange={(e) => editDimension("width", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storformat-height">Højde (cm)</Label>
          <Input
            id="storformat-height"
            type="number"
            min="1"
            step="any"
            value={effectiveHeightCm}
            onChange={(e) => editDimension("height", Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {templateShape?.ratio ? <p className="text-sm text-muted-foreground">Formens proportioner bevares. Ændrer du ét mål, følger det andet med. Skabelonen har 3 mm udfald omkring skærelinjen.</p> : templateShape?.kind === 'freeform' ? <p className="text-sm text-muted-foreground">Fri form har ingen standardskabelon. Upload PDF i designeren, og tilføj én sammenhængende, lukket skærelinje fra motivet eller en SVG-fil. Har du EPS, gem først filen som PDF eller SVG.</p> : null}
      <div className={cn("grid grid-cols-1 gap-4 items-end", hasUsableLayout ? "md:grid-cols-1" : "md:grid-cols-4")}>
        {!hasUsableLayout && (
          <>
            <div className="space-y-2">
              <Label>Antal</Label>
              <Select value={String(quantity)} onValueChange={(value) => setQuantity(parseInt(value, 10))}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedQuantities.map((q) => (
                    <SelectItem key={q} value={String(q)}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Materiale</Label>
              <MaterialOptionHelp source={{name:materials.find(m=>m.id===materialId)?.name || ''}} sectionId={verticalAxisId} valueId={materialId} tooltips={materialTooltips}>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Vaelg materiale" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id!}>{materialPresentation({name:m.name || "Unavngivet"}).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </MaterialOptionHelp>
            </div>
            <div className="space-y-2">
              <Label>Efterbehandling</Label>
              <Select value={finishId} onValueChange={setFinishId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Ingen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneFinishValue}>Ingen</SelectItem>
                  {finishes.map((f) => (
                    <SelectItem key={f.id} value={f.id!}>{f.name || "Unavngivet"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Produkt</Label>
                <Select value={productIdSelection} onValueChange={setProductIdSelection}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Ingen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noneFinishValue}>Ingen</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id!}>{p.name || "Unavngivet"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </div>

      {hasUsableLayout && (
        <div className="space-y-4">
          {layoutRows.map((row) => {
            const filteredSections = row.sections.filter((section) => {
              if (layout && isProductionSection(section)) return false;
              if (verticalAxis && section.sectionType === verticalAxis.sectionType) return false;
              return getSectionValues(section).length > 0;
            });

            if (filteredSections.length === 0) return null;

            return (
              <div key={row.id} className="space-y-2 pb-3 border-b last:border-b-0">
                {row.title && <div className="text-xs font-medium">{row.title}</div>}
                {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                <div
                  className={cn(
                    "grid gap-3",
                    filteredSections.length === 1 && "grid-cols-1",
                    filteredSections.length === 2 && "grid-cols-2",
                    filteredSections.length >= 3 && "grid-cols-3"
                  )}
                >
                  {filteredSections.map((section, sectionIndex) => {
                    const values = getSectionValues(section);
                    if (values.length === 0) return null;
                    const isOptional = isOptionalSelectionMode(selectionModeById[section.id]);
                    const compactFinish = isAdhesive && section.sectionType === 'finishes';
                    const isOptionalEnabled = !isOptional || Boolean(selectedSectionValues[section.id]);
                    const sectionLabel = compactFinish ? (language === 'en' ? 'Finishing' : 'Efterbehandling') : getSectionLabel(section.sectionType, section.title);
                    const selectorBoxConfig = resolveSelectorBoxConfig(section.selectorStyling?.selectorBox);
                    const selectorBoxTarget = `product-selector-box.${productId}.${section.id}.${encodeURIComponent(sectionLabel)}`;

                    const handleOptionalToggle = (checked: boolean) => {
                      if (!isOptional) return;
                      if (checked) {
                        const firstValue = values[0];
                        if (firstValue?.id) {
                          setSelectedSectionValues((prev) => ({ ...prev, [section.id]: firstValue.id }));
                        }
                      } else {
                        setSelectedSectionValues((prev) => {
                          const next = { ...prev };
                          delete next[section.id];
                          return next;
                        });
                      }
                    };

                    return (
                      <div
                        key={section.id}
                        data-site-design-target={selectorBoxTarget}
                        className={cn(
                          "space-y-1.5 transition-colors",
                          isOptionalEnabled && isOptional && "ring-1 ring-primary/20",
                          sectionIndex > 0 && section.sectionType !== "finishes" && "border-l-2 border-primary/20"
                        )}
                        style={{
                          backgroundColor: selectorBoxConfig.backgroundColor,
                          borderColor: selectorBoxConfig.borderColor,
                          borderRadius: `${selectorBoxConfig.borderRadiusPx}px`,
                          borderWidth: `${selectorBoxConfig.borderWidthPx}px`,
                          borderStyle: "solid",
                          padding: `${selectorBoxConfig.paddingPx}px`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isOptional && !compactFinish && (
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
                        {section.description && <p className="text-[10px] text-muted-foreground">{section.description}</p>}
                        {renderValueSelector(section, values)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

  </div>;
  const notices = <div className="order-calculator-notices">
      {!materials.length && !loading && (
        <p className="text-sm text-muted-foreground">
          Ingen storformat materialer fundet for dette produkt.
        </p>
      )}

      {!loading && materials.length > 0 && !selection && usesStorformatSourceQuotes(config) && (
        <p className="text-sm text-muted-foreground" role="status">{STORFORMAT_QUOTE_UNAVAILABLE_MESSAGE}</p>
      )}

      {selection?.splitInfo?.isSplit && (
        <p className="text-xs text-amber-600">
          Overskrider max stoerrelse. Varen deles i {selection.splitInfo.totalPieces} felter ({selection.splitInfo.piecesWide} x {selection.splitInfo.piecesHigh}).
        </p>
      )}
      {selection?.exceedsMax && !selection.allowSplit && (
        <p className="text-xs text-amber-600">
          Overskrider max stoerrelse. Kontakt os hvis du har brug for en specialloesning.
        </p>
      )}

  </div>;
  const matrix = <div className="order-calculator-matrix">
      {verticalAxis && matrixData.rows.length > 0 && matrixData.columns.length > 0 && (
        <div className="pt-2">
          <PriceMatrix
            maxColumnsPerPage={layout ? 4 : undefined}
            renderRowLabel={(row) => {
              const valueId=matrixData.rowIdByLabel[row];
              const value=verticalAxisValues.find(item=>item.id===valueId);
              return verticalAxis.sectionType==='materials' && value ? <MaterialLabel source={{name:getDisplayName(value.name,verticalAxis.valueSettings?.[valueId]),sourceName:value.name || ''}} sectionId={verticalAxisId} valueId={valueId} tooltips={materialTooltips}/> : row;
            }}
            rows={matrixData.rows}
            columns={matrixData.columns}
            cells={matrixData.cells}
            isCellUnavailable={usesStorformatSourceQuotes(config)
              ? (row, column) => matrixData.cells[row]?.[column] === undefined
              : undefined}
            onCellClick={(row, column) => handleMatrixCellClick(row, column)}
            selectedCell={matrixSelectedCell}
            columnUnit="stk"
            rowHeaderLabel={isAdhesive && language === 'en' && verticalAxis.sectionType === 'materials' ? 'Materials' : verticalAxis.title || getSectionLabel(verticalAxis.sectionType)}
          />
        </div>
      )}  </div>;
  if (layout) {
    const intro = <div className="order-calculator-product">{layout.intro}{layout.media}</div>;
    const extras = <div className="order-calculator-extras">{notices}{layout.extras}</div>;
    const summary = <aside className="order-calculator-summary" aria-label="Din bestilling" aria-busy={loading}>
      {loading ? <div className="py-6 text-sm text-muted-foreground" role="status">Indlæser priser…</div> : typeof layout.summary === 'function' ? layout.summary(productionControls) : <>{productionControls}{layout.summary}</>}
    </aside>;
    return <div className="order-calculator-layout" data-calculator-design={layout.design} data-adhesive-product={isAdhesive ? 'true' : undefined}>
      <div className="order-calculator-left">{intro}{layout.design === 1 && controls}{matrix}{layout.details && <div className="order-calculator-details">{layout.details}</div>}{layout.design === 1 && extras}</div>
      <div className="order-calculator-right">{layout.design === 2 && controls}{layout.design === 2 && extras}{summary}</div>
    </div>;
  }
  return <div className="bg-muted/50 border rounded-lg p-6 space-y-4">{controls}{notices}{matrix}</div>;
}
