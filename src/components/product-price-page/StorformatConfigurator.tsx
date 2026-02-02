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
type LayoutDisplayMode = "buttons" | "dropdown" | "checkboxes";
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
  quantities: [1]
};

export function StorformatConfigurator({
  productId,
  onSelectionChange
}: StorformatConfiguratorProps) {
  const noneFinishValue = "__none__";
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
            layout_rows: cfg.layout_rows || [],
            vertical_axis: cfg.vertical_axis || null
          }
          : defaultConfig;
        setConfig(nextConfig);
        setQuantity(nextConfig.quantities?.[0] || 1);
        setLayoutRows(cfg?.layout_rows || []);
        setVerticalAxis(cfg?.vertical_axis ? { ...cfg.vertical_axis, id: cfg.vertical_axis.id || "vertical-axis" } : null);

        const { data: materialRows } = await supabase
          .from("storformat_materials" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const { data: materialTiers } = await supabase
          .from("storformat_material_price_tiers" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const materialsWithTiers = (materialRows || []).map((m: any) => ({
          ...m,
          tiers: (materialTiers || []).filter((t: any) => t.material_id === m.id)
        }));
        setMaterials(materialsWithTiers);
        if (materialsWithTiers.length) {
          setMaterialId(materialsWithTiers[0].id);
        }

        const { data: finishRows } = await supabase
          .from("storformat_finishes" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const { data: finishTiers } = await supabase
          .from("storformat_finish_price_tiers" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const finishesWithTiers = (finishRows || []).map((f: any) => ({
          ...f,
          tiers: (finishTiers || []).filter((t: any) => t.finish_id === f.id)
        }));
        setFinishes(finishesWithTiers);

        const { data: productRows } = await supabase
          .from("storformat_products" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const { data: productTiers } = await supabase
          .from("storformat_product_price_tiers" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const { data: productFixedPrices } = await supabase
          .from("storformat_product_fixed_prices" as any)
          .select("*")
          .eq("product_id", productId)
          .order("sort_order");

        const productsWithPricing: StorformatProduct[] = (productRows || []).map((p: any) => ({
          ...p,
          tiers: (productTiers || []).filter((t: any) => t.product_item_id === p.id),
          fixed_prices: (productFixedPrices || []).filter((fp: any) => fp.product_item_id === p.id)
        }));
        setProducts(productsWithPricing);
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

    const result = calculateStorformatPrice({
      widthMm,
      heightMm,
      quantity,
      material,
      finish,
      product,
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
      materialName: material.name,
      finishName: finish?.name || null,
      productName: product?.name || null,
      splitInfo: result.splitInfo,
      exceedsMax,
      allowSplit: material.allow_split ?? true
    };
  }, [materials, finishes, products, materialId, finishId, productIdSelection, widthCm, heightCm, quantity, config, hasLayout, resolveSelectionForType]);

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

        const result = calculateStorformatPrice({
          widthMm,
          heightMm,
          quantity: qty,
          material,
          finish,
          product,
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
  }, [verticalAxis, verticalAxisValues, sortedQuantities, widthCm, heightCm, resolveSelectionForType, materials, finishes, products, config]);

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
