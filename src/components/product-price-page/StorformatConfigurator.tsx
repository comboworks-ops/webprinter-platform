import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceMatrix } from "@/components/product-price-page/PriceMatrix";
import {
  type StorformatConfig,
  type StorformatFinish,
  type StorformatMaterial,
  type StorformatProduct,
  type StorformatFixedPrice,
  calculateStorformatPrice
} from "@/utils/storformatPricing";
import { cn } from "@/lib/utils";
import {
  normalizeThumbnailCustomPx,
  normalizeThumbnailSize,
  resolveThumbnailSizePx,
  type ThumbnailSizeMode
} from "@/lib/pricing/thumbnailSizes";
import { getHiResThumbnailUrl } from "@/lib/pricing/thumbnailImageUrl";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";

export type StorformatSelection = {
  totalPrice: number;
  areaM2: number;
  totalAreaM2: number;
  quantity: number;
  widthCm: number;
  heightCm: number;
  materialName: string;
  finishName?: string | null;
  productName?: string | null;
  splitInfo: {
    isSplit: boolean;
    piecesWide: number;
    piecesHigh: number;
    totalPieces: number;
  } | null;
  exceedsMax: boolean;
  allowSplit: boolean;
};

type StorformatConfiguratorProps = {
  productId: string;
  onSelectionChange: (selection: StorformatSelection | null) => void;
};

type LayoutSectionType = "materials" | "finishes" | "products";
type LayoutDisplayMode = "buttons" | "dropdown" | "checkboxes" | "small" | "medium" | "large" | "xl" | "xl_notext";
type SelectionMode = "required" | "optional";

type ValueSettings = {
  showThumbnail?: boolean;
  customImage?: string;
  displayName?: string;
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
};

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
};

const defaultConfig: StorformatConfig = {
  rounding_step: 1,
  global_markup_pct: 0,
  quantities: [1]
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

export function StorformatConfigurator({
  productId,
  onSelectionChange
}: StorformatConfiguratorProps) {
  const noneFinishValue = "__none__";
  const settings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const activeBranding = (isPreviewMode && previewBranding)
    ? previewBranding
    : settings.data?.branding;
  const [config, setConfig] = useState<StorformatConfig>(defaultConfig);
  const [materials, setMaterials] = useState<StorformatMaterial[]>([]);
  const [finishes, setFinishes] = useState<StorformatFinish[]>([]);
  const [products, setProducts] = useState<StorformatProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([]);
  const [verticalAxis, setVerticalAxis] = useState<VerticalAxisConfig | null>(null);
  const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string | null>>({});

  const [widthCm, setWidthCm] = useState(100);
  const [heightCm, setHeightCm] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [materialId, setMaterialId] = useState<string>("");
  const [finishId, setFinishId] = useState<string>(noneFinishValue);
  const [productIdSelection, setProductIdSelection] = useState<string>(noneFinishValue);
  const [hoveredPictureKey, setHoveredPictureKey] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchStorformat = async () => {
      setLoading(true);
      try {
        const { data: cfg } = await supabase
          .from("storformat_configs" as any)
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
          supabase.from("storformat_materials" as any).select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_material_price_tiers" as any).select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_m2_prices" as any).select("*").eq("product_id", productId).order("from_m2"),
          supabase.from("storformat_finishes" as any).select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_finish_price_tiers" as any).select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_finish_prices" as any).select("*").eq("product_id", productId),
          supabase.from("storformat_products" as any).select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_product_price_tiers" as any).select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("storformat_product_fixed_prices" as any).select("*").eq("product_id", productId).order("sort_order")
        ]);

        let legacyProductM2Rows: any[] = [];
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
                      valueSettings: section?.valueSettings || {}
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
              valueSettings: {}
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
              valueSettings: {}
            });
          }
          if (defaultSections.length) {
            nextLayoutRows = [{ id: "row-1", sections: defaultSections }];
          }
        }

        const cfgVertical = cfg?.vertical_axis;
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
          valueSettings: cfgVertical?.valueSettings || {}
        };

        const nextConfig = cfg
          ? {
              rounding_step: cfg.rounding_step || 1,
              global_markup_pct: cfg.global_markup_pct || 0,
              quantities: cfg.quantities?.length ? cfg.quantities : [1],
              layout_rows: nextLayoutRows,
              vertical_axis: nextVerticalAxis
            }
          : defaultConfig;

        setConfig(nextConfig);
        setQuantity(nextConfig.quantities?.[0] || 1);
        setLayoutRows(nextLayoutRows);
        setVerticalAxis(nextVerticalAxis);
        setMaterials(materialsWithTiers);
        setFinishes(finishesWithTiers);
        setProducts(productsWithPricing);
        if (materialsWithTiers.length) {
          const firstMaterial = materialsWithTiers[0];
          setMaterialId(firstMaterial.id);

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
        if (productsWithPricing.length) {
          setProductIdSelection(productsWithPricing[0].id);
        }
      } catch (error) {
        console.error("Storformat fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorformat();
  }, [productId]);

  const hasLayout = layoutRows.length > 0 || !!verticalAxis;
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

  const getValuesForType = useCallback((type: LayoutSectionType) => {
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
    if (!hasLayout) return;

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
          const values = getSectionValues(section);
          const isOptional = selectionModeById[section.id] === "optional";
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
  }, [hasLayout, layoutRows, verticalAxis, verticalAxisId, getSectionValues, getVerticalAxisValues, selectionModeById]);

  const resolveSelectionsForType = useCallback(
    (
      type: LayoutSectionType,
      options?: {
        overrideVerticalValueId?: string | null;
        overrideSectionSelection?: Record<string, string | null | undefined>;
      }
    ) => {
      if (!hasLayout) return [] as string[];

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
          const values = getSectionValues(section);
          if (!values.length) continue;

          const selectedValue = overrideSelection[section.id] ?? selectedSectionValues[section.id] ?? null;
          if (selectedValue && values.some((value) => value.id === selectedValue)) {
            resolved.push(selectedValue);
            continue;
          }

          if (selectionModeById[section.id] !== "optional") {
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
      hasLayout,
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

  const selection = useMemo<StorformatSelection | null>(() => {
    const selectedMaterialIds = hasLayout ? resolveSelectionsForType("materials") : materialId ? [materialId] : [];
    const selectedMaterialId = selectedMaterialIds[0] || null;
    const material = materials.find((m) => m.id === selectedMaterialId);
    if (!material) return null;
    if (widthCm <= 0 || heightCm <= 0 || quantity <= 0) return null;

    const widthMm = widthCm * 10;
    const heightMm = heightCm * 10;
    const selectedFinishIds = hasLayout
      ? resolveSelectionsForType("finishes")
      : finishId === noneFinishValue
        ? []
        : [finishId];
    const selectedProductIds = hasLayout
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

    const result = calculateStorformatPrice({
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

    const maxW = material.max_width_mm ?? 0;
    const maxH = material.max_height_mm ?? 0;
    const exceedsMax = Boolean(maxW && widthMm > maxW) || Boolean(maxH && heightMm > maxH);

    return {
      totalPrice: result.totalPrice,
      areaM2: result.areaM2,
      totalAreaM2: result.totalAreaM2,
      quantity,
      widthCm,
      heightCm,
      materialName: getConfiguredValueDisplayName("materials", material.id, material.name),
      finishName: selectedFinishes.length
        ? selectedFinishes.map((item) => getConfiguredValueDisplayName("finishes", item.id, item.name)).join(", ")
        : null,
      productName: selectedProducts.length
        ? selectedProducts.map((item) => getConfiguredValueDisplayName("products", item.id, item.name)).join(", ")
        : null,
      splitInfo: result.splitInfo,
      exceedsMax,
      allowSplit: material.allow_split ?? true
    };
  }, [materials, finishes, products, materialId, finishId, productIdSelection, widthCm, heightCm, quantity, config, hasLayout, resolveSelectionsForType, getConfiguredValueDisplayName]);

  useEffect(() => {
    onSelectionChange(selection);
  }, [selection, onSelectionChange]);

  const quantities = config.quantities?.length ? config.quantities : [1];
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

  const renderValueSelector = useCallback((section: LayoutSection, values: Array<StorformatMaterial | StorformatFinish | StorformatProduct>) => {
    const displayMode = section.ui_mode || "buttons";
    const isOptional = selectionModeById[section.id] === "optional";
    const selectedValue = selectedSectionValues[section.id] || "";
    const valueSettings = valueSettingsById[section.id] || {};
    const thumbnailPx = resolveThumbnailSizePx(section.thumbnail_size, section.thumbnail_custom_px);
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

    if (displayMode === "dropdown") {
      return (
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
              const thumbnailUrl = settings?.customImage || value.thumbnail_url;
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
                    {displayName}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }

    if (displayMode === "checkboxes") {
      return (
        <div className={cn("space-y-1", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
          {values.map((value) => {
            const isSelected = selectedValue === value.id;
            const displayName = getDisplayName(value.name, valueSettings[value.id || ""]);
            return (
              <label
                key={value.id}
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                  isSelected ? "bg-primary/10 border-primary" : "bg-background border-muted hover:border-muted-foreground/30"
                )}
                onClick={() => {
                  if (isOptional && isSelected) {
                    handleSelect(null);
                    return;
                  }
                  handleSelect(value.id || null);
                }}
              >
                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                {valueSettings[value.id || ""]?.showThumbnail && (valueSettings[value.id || ""]?.customImage || value.thumbnail_url) && (
                  <img
                    src={getHiResThumbnailUrl(
                      valueSettings[value.id || ""]?.customImage || value.thumbnail_url,
                      thumbnailPx,
                      thumbnailPx
                    )}
                    alt={displayName}
                    className="rounded object-cover shrink-0"
                    style={{ width: thumbnailPx, height: thumbnailPx }}
                  />
                )}
                <span className="font-medium flex-1">{displayName}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (["small", "medium", "large", "xl", "xl_notext"].includes(displayMode)) {
      const pictureMode = displayMode === "xl_notext" ? "xl" : displayMode;
      const pictureSize = pictureMode === "small"
        ? { width: 40, height: 40 }
        : pictureMode === "medium"
          ? { width: 64, height: 64 }
          : pictureMode === "large"
            ? { width: 96, height: 96 }
            : { width: 128, height: 128 };
      const showPictureLabel = pictureMode !== "small" && displayMode !== "xl_notext";

      return (
        <div className={cn("flex flex-wrap gap-2", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
          {values.map((value) => {
            const pictureKey = `${section.id}:${value.id || ""}`;
            const isHovered = hoveredPictureKey === pictureKey;
            const isSelected = selectedValue === value.id;
            const thumbnailUrl = valueSettings[value.id || ""]?.customImage || value.thumbnail_url;
            const displayName = getDisplayName(value.name, valueSettings[value.id || ""]);
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
                key={value.id}
                onClick={() => {
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
                  "relative rounded-lg border-2 transition-all flex flex-col items-center overflow-hidden",
                  isSelected ? "shadow-none" : "",
                  !isOptionalEnabled && "cursor-not-allowed"
                )}
                style={{
                  width: pictureSize.width,
                  minHeight: pictureSize.height + (showPictureLabel ? 22 : 0),
                  backgroundColor: overlayBg,
                  borderColor,
                  transform: `scale(${scale})`,
                  transitionDuration: `${pictureButtonsConfig.hoverZoomDurationMs}ms`,
                }}
              >
                {thumbnailUrl ? (
                  <img
                    src={getHiResThumbnailUrl(thumbnailUrl, pictureSize.width, pictureSize.height)}
                    alt={displayName}
                    className="w-full object-cover rounded-t-md"
                    style={{ height: pictureSize.height }}
                  />
                ) : (
                  <div
                    className={cn(
                      "w-full flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground rounded-t-md",
                    isSelected && "bg-primary/10 text-primary"
                  )}
                  style={{ height: pictureSize.height }}
                >
                  {(displayName || "?").slice(0, 3).toUpperCase()}
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

    return (
      <div className={cn("flex flex-wrap gap-1.5", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
        {values.map((value) => {
          const isSelected = selectedValue === value.id;
          const displayName = getDisplayName(value.name, valueSettings[value.id || ""]);
          return (
            <Button
              key={value.id}
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={() => {
                if (isOptional && isSelected) {
                  handleSelect(null);
                  return;
                }
                handleSelect(value.id || null);
              }}
              className={cn("h-9 px-3 text-sm gap-2", isSelected && "bg-primary hover:bg-primary/90")}
              disabled={!isOptionalEnabled}
            >
              {valueSettings[value.id || ""]?.showThumbnail && (valueSettings[value.id || ""]?.customImage || value.thumbnail_url) && (
                <img
                  src={getHiResThumbnailUrl(
                    valueSettings[value.id || ""]?.customImage || value.thumbnail_url,
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
  }, [hoveredPictureKey, pictureButtonsConfig, selectionModeById, selectedSectionValues, valueSettingsById]);

  const verticalAxisValues = useMemo(() => getVerticalAxisValues(), [getVerticalAxisValues]);

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

    const widthMm = widthCm * 10;
    const heightMm = heightCm * 10;
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

        const result = calculateStorformatPrice({
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
        cells[label][qty] = result.totalPrice;
      });
    });

    return {
      rows,
      columns: sortedQuantities,
      cells,
      rowIdByLabel,
      rowLabelById
    };
  }, [verticalAxis, verticalAxisValues, sortedQuantities, widthCm, heightCm, resolveSelectionForType, resolveSelectionsForType, materials, finishes, products, config, getDisplayName]);

  const matrixSelectedCell = useMemo(() => {
    if (!verticalAxis) return null;
    const selectedId = selectedSectionValues[verticalAxisId];
    if (!selectedId) return null;
    const rowLabel = matrixData.rowLabelById[selectedId];
    if (!rowLabel) return null;
    return { row: rowLabel, column: quantity };
  }, [verticalAxis, verticalAxisId, selectedSectionValues, matrixData.rowLabelById, quantity]);

  const handleMatrixCellClick = useCallback((row: string, column: number) => {
    setQuantity(column);
    if (!verticalAxis) return;
    const rowId = matrixData.rowIdByLabel[row];
    if (!rowId) return;
    setSelectedSectionValues((prev) => ({ ...prev, [verticalAxisId]: rowId }));
  }, [matrixData.rowIdByLabel, verticalAxis, verticalAxisId]);

  return (
    <div className="bg-muted/50 border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Storformat</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {selection && (
            <>
              <span>{selection.totalAreaM2.toFixed(2)} m2 total</span>
              <span>{selection.quantity} stk</span>
            </>
          )}
          {loading && <span>Indlaeser...</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="storformat-width">Længde (cm)</Label>
          <Input
            id="storformat-width"
            type="number"
            min="1"
            value={widthCm}
            onChange={(e) => setWidthCm(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storformat-height">Højde (cm)</Label>
          <Input
            id="storformat-height"
            type="number"
            min="1"
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4 items-end", hasLayout ? "md:grid-cols-1" : "md:grid-cols-4")}>
        {!hasLayout && (
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
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Vaelg materiale" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id!}>{m.name || "Unavngivet"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {hasLayout && (
        <div className="space-y-4">
          {layoutRows.map((row) => {
            const filteredSections = row.sections.filter((section) => {
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
                    const isOptional = selectionModeById[section.id] === "optional";
                    const isOptionalEnabled = !isOptional || Boolean(selectedSectionValues[section.id]);
                    const sectionLabel = getSectionLabel(section.sectionType, section.title);

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
                        className={cn(
                          "space-y-1.5 p-2 rounded",
                          section.sectionType === "finishes" ? "bg-transparent" : "bg-muted/20",
                          isOptionalEnabled && isOptional && "ring-1 ring-primary/20 bg-primary/5",
                          sectionIndex > 0 && section.sectionType !== "finishes" && "border-l-2 border-primary/20 pl-3"
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

      {!materials.length && !loading && (
        <p className="text-sm text-muted-foreground">
          Ingen storformat materialer fundet for dette produkt.
        </p>
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

      {verticalAxis && matrixData.rows.length > 0 && matrixData.columns.length > 0 && (
        <div className="pt-2">
          <PriceMatrix
            rows={matrixData.rows}
            columns={matrixData.columns}
            cells={matrixData.cells}
            onCellClick={(row, column) => handleMatrixCellClick(row, column)}
            selectedCell={matrixSelectedCell}
            columnUnit="stk"
            rowHeaderLabel={verticalAxis.title || getSectionLabel(verticalAxis.sectionType)}
          />
        </div>
      )}
    </div>
  );
}
