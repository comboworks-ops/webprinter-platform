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
  calculateStorformatM2Price
} from "@/utils/storformatPricing";
import type { StorformatFinishPrice, StorformatM2Price, LayoutDisplayMode as LayoutDisplayModeImport, PictureSizeMode } from "@/lib/storformat-pricing/types";
import { PICTURE_SIZES } from "@/lib/storformat-pricing/types";
import { cn } from "@/lib/utils";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useProductAddons, calculateAddonPrice } from "@/hooks/useProductAddons";
import type { ResolvedAddonGroup, ResolvedAddonItem } from "@/lib/addon-library/types";

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
type LayoutDisplayMode = LayoutDisplayModeImport;
type SelectionMode = "required" | "optional";

type ValueSettings = {
  showThumbnail?: boolean;
  customImage?: string;
};

type LayoutSection = {
  id: string;
  sectionType: LayoutSectionType;
  ui_mode?: LayoutDisplayMode;
  selection_mode?: SelectionMode;
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
  title?: string;
  description?: string;
  valueIds?: string[];
  valueSettings?: Record<string, ValueSettings>;
};

const defaultConfig: StorformatConfig = {
  rounding_step: 1,
  global_markup_pct: 0,
  quantities: [1],
  pricing_mode: "m2_rates"
};

export function StorformatConfigurator({
  productId,
  onSelectionChange
}: StorformatConfiguratorProps) {
  const noneFinishValue = "__none__";
  const [config, setConfig] = useState<StorformatConfig>(defaultConfig);
  const [materials, setMaterials] = useState<StorformatMaterial[]>([]);
  const [m2Prices, setM2Prices] = useState<StorformatM2Price[]>([]);
  const [finishes, setFinishes] = useState<StorformatFinish[]>([]);
  const [finishPrices, setFinishPrices] = useState<StorformatFinishPrice[]>([]);
  const [products, setProducts] = useState<StorformatProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([]);
  const [verticalAxis, setVerticalAxis] = useState<VerticalAxisConfig | null>(null);
  const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string | null>>({});

  // Library-imported add-ons
  const settings = useShopSettings();
  const tenantId = settings.data?.id || "";
  const productAddons = useProductAddons({ productId, tenantId });
  const [librarySelections, setLibrarySelections] = useState<Record<string, string>>({});

  const [widthCm, setWidthCm] = useState(100);
  const [heightCm, setHeightCm] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [materialId, setMaterialId] = useState<string>("");
  const [finishId, setFinishId] = useState<string>(noneFinishValue);
  const [productIdSelection, setProductIdSelection] = useState<string>(noneFinishValue);

  useEffect(() => {
    const fetchStorformat = async () => {
      setLoading(true);
      try {
        const { data: cfg } = await supabase
          .from("storformat_configs" as any)
          .select("*")
          .eq("product_id", productId)
          .maybeSingle();

        const nextConfig = cfg
          ? {
            rounding_step: cfg.rounding_step || 1,
            global_markup_pct: cfg.global_markup_pct || 0,
            quantities: cfg.quantities?.length ? cfg.quantities : [1],
            pricing_mode: "m2_rates",
            layout_rows: cfg.layout_rows || [],
            vertical_axis: cfg.vertical_axis || null
          }
          : defaultConfig;
        setConfig(nextConfig);
        setIsPublished(cfg?.is_published ?? false);
        setQuantity(nextConfig.quantities?.[0] || 1);
        setLayoutRows(cfg?.layout_rows || []);
        setVerticalAxis(cfg?.vertical_axis ? { ...cfg.vertical_axis, id: cfg.vertical_axis.id || "vertical-axis" } : null);

        const { data: materialRows } = await supabase
          .from("storformat_materials" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const { data: m2PriceRows } = await supabase
          .from("storformat_m2_prices" as any)
          .select("*")
          .eq("product_id", productId)
          .order("from_m2");

        const materialsSimple = (materialRows || []).map((m: any) => ({
          ...m,
          tiers: []
        }));
        setMaterials(materialsSimple);
        setM2Prices((m2PriceRows || []) as StorformatM2Price[]);
        if (materialsSimple.length) {
          setMaterialId(materialsSimple[0].id);
        }

        const { data: finishRows } = await supabase
          .from("storformat_finishes" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const { data: finishPriceRows } = await supabase
          .from("storformat_finish_prices" as any)
          .select("*")
          .eq("product_id", productId);

        const finishesSimple = (finishRows || []).map((f: any) => ({
          ...f,
          tiers: []
        }));
        setFinishes(finishesSimple);
        setFinishPrices((finishPriceRows || []) as StorformatFinishPrice[]);

        const { data: productRows } = await supabase
          .from("storformat_products" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const productsSimple: StorformatProduct[] = (productRows || []).map((p: any) => ({
          ...p,
          tiers: [],
          fixed_prices: []
        }));
        setProducts(productsSimple);
        if (productsSimple.length) {
          setProductIdSelection(productsSimple[0].id);
        }
      } catch (error) {
        console.error("Storformat fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorformat();
  }, [productId]);

  // Fetch library add-ons when tenant is ready
  useEffect(() => {
    if (tenantId && productId) {
      productAddons.fetchResolvedAddons().then((resolved) => {
        // Set default selections for library groups
        const initialLibrarySelections: Record<string, string> = {};
        for (const group of resolved) {
          if (group.items.length > 0) {
            initialLibrarySelections[group.id] = group.items[0].id;
          }
        }
        setLibrarySelections(initialLibrarySelections);
      });
    }
  }, [tenantId, productId]);

  // Handle library item selection
  const handleLibrarySelect = useCallback((groupId: string, itemId: string) => {
    setLibrarySelections((prev) => ({ ...prev, [groupId]: itemId }));
  }, []);

  // Calculate total price from library add-ons
  const libraryAddonsTotal = useMemo(() => {
    let total = 0;
    for (const [groupId, itemId] of Object.entries(librarySelections)) {
      const group = productAddons.resolvedGroups.find((g) => g.id === groupId);
      const item = group?.items.find((i) => i.id === itemId);
      if (item) {
        const areaM2 = (widthCm * 10 / 1000) * (heightCm * 10 / 1000); // Convert cm to m²
        const { totalPrice } = calculateAddonPrice({
          item,
          quantity,
          areaM2
        });
        total += totalPrice;
      }
    }
    return total;
  }, [librarySelections, productAddons.resolvedGroups, widthCm, heightCm, quantity]);

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

  const resolveSelectionForType = useCallback((type: LayoutSectionType) => {
    if (!hasLayout) return null;
    if (verticalAxis?.sectionType === type) {
      return selectedSectionValues[verticalAxisId] || null;
    }

    for (const row of layoutRows) {
      for (const section of row.sections) {
        if (section.sectionType !== type) continue;
        const values = getSectionValues(section);
        if (values.length === 0) continue;
        const selected = selectedSectionValues[section.id];
        if (selected && values.some((value) => value.id === selected)) {
          return selected;
        }
        if (selectionModeById[section.id] !== "optional") {
          return values[0].id || null;
        }
      }
    }

    return null;
  }, [getSectionValues, hasLayout, layoutRows, selectedSectionValues, selectionModeById, verticalAxis, verticalAxisId]);

  const getM2PricesForMaterial = useCallback((materialId: string) => {
    return m2Prices
      .filter((p) => p.material_id === materialId)
      .sort((a, b) => a.from_m2 - b.from_m2);
  }, [m2Prices]);

  const getFinishPrice = useCallback((finishId: string) => {
    return finishPrices.find((p) => p.finish_id === finishId) || null;
  }, [finishPrices]);

  const selection = useMemo<StorformatSelection | null>(() => {
    const selectedMaterialId = hasLayout ? resolveSelectionForType("materials") : materialId;
    const material = materials.find((m) => m.id === selectedMaterialId);
    if (!material) return null;
    if (widthCm <= 0 || heightCm <= 0 || quantity <= 0) return null;

    const widthMm = widthCm * 10;
    const heightMm = heightCm * 10;
    const selectedFinishId = hasLayout ? resolveSelectionForType("finishes") : (finishId === noneFinishValue ? null : finishId);
    const selectedProductId = hasLayout ? resolveSelectionForType("products") : (productIdSelection === noneFinishValue ? null : productIdSelection);
    const finish = selectedFinishId ? (finishes.find((f) => f.id === selectedFinishId) || null) : null;
    const product = selectedProductId ? (products.find((p) => p.id === selectedProductId) || null) : null;
    const result = calculateStorformatM2Price({
      widthMm,
      heightMm,
      quantity,
      material,
      materialPrices: getM2PricesForMaterial(material.id!),
      finish,
      finishPrice: finish ? getFinishPrice(finish.id!) : null,
      product: null,
      config
    });

    const maxW = material.max_width_mm ?? 0;
    const maxH = material.max_height_mm ?? 0;
    const exceedsMax = Boolean(maxW && widthMm > maxW) || Boolean(maxH && heightMm > maxH);

    return {
      totalPrice: result.totalPrice + libraryAddonsTotal,
      areaM2: result.areaM2,
      totalAreaM2: result.totalAreaM2,
      quantity,
      widthCm,
      heightCm,
      materialName: material.name,
      finishName: finish?.name || null,
      productName: product?.name || null,
      splitInfo: result.splitInfo,
      exceedsMax,
      allowSplit: material.allow_split ?? true
    };
  }, [materials, finishes, products, materialId, finishId, productIdSelection, widthCm, heightCm, quantity, config, hasLayout, resolveSelectionForType, libraryAddonsTotal, m2Prices, finishPrices]);

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

    // Dropdown mode
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
              return (
                <SelectItem key={value.id} value={value.id || ""}>
                  <div className="flex items-center gap-2">
                    {settings?.showThumbnail && thumbnailUrl && (
                      <img src={thumbnailUrl} className="w-5 h-5 rounded object-cover" />
                    )}
                    {value.name || "Unavngivet"}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }

    // Checkboxes mode
    if (displayMode === "checkboxes") {
      return (
        <div className={cn("space-y-1", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
          {values.map((value) => {
            const isSelected = selectedValue === value.id;
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
                    src={valueSettings[value.id || ""]?.customImage || value.thumbnail_url}
                    alt={value.name || ""}
                    className="h-8 w-8 rounded object-cover"
                  />
                )}
                <span className="font-medium flex-1">{value.name || "Unavngivet"}</span>
              </label>
            );
          })}
        </div>
      );
    }

    // Buttons mode
    if (displayMode === "buttons") {
      return (
        <div className={cn("flex flex-wrap gap-1.5", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
          {values.map((value) => {
            const isSelected = selectedValue === value.id;
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
                    src={valueSettings[value.id || ""]?.customImage || value.thumbnail_url}
                    alt={value.name || ""}
                    className="h-8 w-8 rounded object-cover"
                  />
                )}
                {value.name || "Unavngivet"}
              </Button>
            );
          })}
        </div>
      );
    }

    // Picture grid display (small / medium / large / xl)
    const pictureSize = PICTURE_SIZES[displayMode as PictureSizeMode] || PICTURE_SIZES.medium;

    return (
      <div className={cn("flex flex-wrap gap-2", !isOptionalEnabled && "opacity-60 pointer-events-none")}>
        {values.map((value) => {
          const isSelected = selectedValue === value.id;
          const settings = valueSettings[value.id || ""];
          const thumbnailUrl = settings?.customImage || value.thumbnail_url;
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
              className={cn(
                "relative rounded-lg border-2 transition-all flex flex-col items-center overflow-hidden",
                isSelected
                  ? "border-transparent shadow-none"
                  : "border-transparent",
                !isOptionalEnabled && "cursor-not-allowed"
              )}
              style={{ width: pictureSize.width, minHeight: pictureSize.height + (displayMode !== "small" ? 22 : 0) }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={value.name || ""}
                  className="w-full object-cover rounded-t-md"
                  style={{ height: pictureSize.height }}
                />
              ) : (
                <div
                  className={cn(
                    "w-full flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground rounded-t-md",
                    isSelected && "bg-accent text-foreground"
                  )}
                  style={{ height: pictureSize.height }}
                >
                  {(value.name || "?").slice(0, 3).toUpperCase()}
                </div>
              )}
              {displayMode !== "small" && (
                <span className="text-[10px] leading-tight text-center truncate w-full px-1 py-0.5">
                  {value.name || "Unavngivet"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }, [selectionModeById, selectedSectionValues, valueSettingsById]);

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
    const baseFinishId = resolveSelectionForType("finishes");
    const baseProductId = resolveSelectionForType("products");

    verticalAxisValues.forEach((value) => {
      const baseName = value.name || "Unavngivet";
      const count = nameCounts.get(baseName) || 0;
      const label = count === 0 ? baseName : `${baseName} (${count + 1})`;
      nameCounts.set(baseName, count + 1);
      rows.push(label);
      rowIdByLabel[label] = value.id || "";
      rowLabelById[value.id || ""] = label;
      cells[label] = {};

      sortedQuantities.forEach((qty) => {
        const materialIdForRow = verticalAxis.sectionType === "materials" ? value.id : baseMaterialId;
        const finishIdForRow = verticalAxis.sectionType === "finishes" ? value.id : baseFinishId;
        const productIdForRow = verticalAxis.sectionType === "products" ? value.id : baseProductId;

        const material = materialIdForRow ? materials.find((m) => m.id === materialIdForRow) : null;
        const finish = finishIdForRow ? finishes.find((f) => f.id === finishIdForRow) : null;
        const product = productIdForRow ? products.find((p) => p.id === productIdForRow) : null;
        if (!material) return;

        const result = calculateStorformatM2Price({
          widthMm,
          heightMm,
          quantity: qty,
          material,
          materialPrices: getM2PricesForMaterial(material.id!),
          finish,
          finishPrice: finish ? getFinishPrice(finish.id!) : null,
          product: null,
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
  }, [verticalAxis, verticalAxisValues, sortedQuantities, widthCm, heightCm, resolveSelectionForType, materials, finishes, products, config, m2Prices, finishPrices]);

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

  if (loading) {
    return (
      <div className="bg-muted/50 border rounded-lg p-6 text-center text-muted-foreground">
        Indlæser storformat...
      </div>
    );
  }

  if (!isPublished) {
    return null;
  }

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

      {/* Library-imported add-on groups */}
      {productAddons.resolvedGroups.length > 0 && (
        <div className="space-y-4 pt-2 border-t">
          {productAddons.resolvedGroups.map((libGroup) => (
            <div key={libGroup.id} className="space-y-2">
              <Label className="text-sm font-medium">{libGroup.display_label}</Label>

              {libGroup.display_type === 'buttons' && (
                <div className="flex flex-wrap gap-1.5">
                  {libGroup.items.map((item) => {
                    const isSelected = librarySelections[libGroup.id] === item.id;
                    return (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => handleLibrarySelect(libGroup.id, item.id)}
                        className={cn("h-9 px-3 text-sm gap-2", isSelected && "bg-primary hover:bg-primary/90")}
                      >
                        {item.icon_url && (
                          <img src={item.icon_url} alt={item.display_label} className="h-5 w-5 rounded object-cover" />
                        )}
                        {item.display_label}
                      </Button>
                    );
                  })}
                </div>
              )}

              {libGroup.display_type === 'icon_grid' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {libGroup.items.map((item) => {
                    const isSelected = librarySelections[libGroup.id] === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleLibrarySelect(libGroup.id, item.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-lg border transition-all",
                          isSelected
                            ? "bg-primary/10 border-primary ring-1 ring-primary"
                            : "bg-background border-muted hover:border-muted-foreground/30"
                        )}
                      >
                        {item.icon_url || item.thumbnail_url ? (
                          <img
                            src={item.icon_url || item.thumbnail_url || ''}
                            alt={item.display_label}
                            className="w-full h-16 object-contain"
                          />
                        ) : (
                          <div className="w-full h-16 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                            Intet ikon
                          </div>
                        )}
                        <span className="text-xs font-medium text-center">{item.display_label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {libGroup.display_type === 'dropdown' && (
                <Select
                  value={librarySelections[libGroup.id] || ""}
                  onValueChange={(value) => handleLibrarySelect(libGroup.id, value)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Vælg" />
                  </SelectTrigger>
                  <SelectContent>
                    {libGroup.items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2">
                          {item.icon_url && (
                            <img src={item.icon_url} alt="" className="w-4 h-4 rounded" />
                          )}
                          {item.display_label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {libGroup.description && (
                <p className="text-xs text-muted-foreground">{libGroup.description}</p>
              )}
            </div>
          ))}
        </div>
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
