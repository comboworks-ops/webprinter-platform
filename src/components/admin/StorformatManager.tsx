import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CenterSlider } from "@/components/ui/center-slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Save, Library, Wand2, CloudUpload, ImageIcon, LayoutGrid, RotateCcw, ChevronLeft, ChevronRight, X, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  type StorformatConfig,
  type StorformatFinish,
  type StorformatMaterial,
  type StorformatProduct,
  type StorformatTier,
  calculateStorformatPrice
} from "@/utils/storformatPricing";
import { cn } from "@/lib/utils";

type StorformatManagerProps = {
  productId: string;
  tenantId: string;
  productName: string;
  pricingType?: string | null;
  onPricingTypeChange?: (type: string) => void;
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

type SelectedTarget = {
  type: "vertical" | "section";
  id: string;
};

type UploadTarget =
  | { scope: "section"; sectionId: string; valueId: string }
  | { scope: "vertical"; sectionId: string; valueId: string }
  | { scope: "catalog"; catalogType: LayoutSectionType; valueId: string };

const defaultQuantities = Array.from({ length: 20 }, (_, i) => i + 1);
const PREVIEW_COLS = 10;

const createTier = (overrides: Partial<StorformatTier> = {}): StorformatTier => ({
  id: crypto.randomUUID(),
  from_m2: 0,
  to_m2: null,
  price_per_m2: 0,
  is_anchor: true,
  markup_pct: 0,
  ...overrides
});

const getInterpolationInfo = (
  tiers: StorformatTier[],
  targetFromM2: number,
  interpolationEnabled: boolean
) => {
  if (!interpolationEnabled) {
    return { isBetweenAnchors: false, rawInterpolatedBase: null as number | null };
  }
  const anchors = tiers
    .filter((tier) => tier.is_anchor && Number(tier.price_per_m2) > 0)
    .sort((a, b) => a.from_m2 - b.from_m2);
  if (anchors.length < 2) {
    return { isBetweenAnchors: false, rawInterpolatedBase: null as number | null };
  }
  const before = anchors.filter((a) => a.from_m2 < targetFromM2).pop();
  const after = anchors.find((a) => a.from_m2 > targetFromM2);
  if (!before || !after) {
    return { isBetweenAnchors: false, rawInterpolatedBase: null as number | null };
  }
  const t = (targetFromM2 - before.from_m2) / (after.from_m2 - before.from_m2);
  const baseBefore = before.price_per_m2 * (1 + (before.markup_pct ?? 0) / 100);
  const baseAfter = after.price_per_m2 * (1 + (after.markup_pct ?? 0) / 100);
  return {
    isBetweenAnchors: true,
    rawInterpolatedBase: baseBefore + t * (baseAfter - baseBefore)
  };
};

const createDefaultTiers = (): StorformatTier[] => ([
  createTier({ from_m2: 0, to_m2: 1, is_anchor: true }),
  createTier({ from_m2: 1, to_m2: 3, is_anchor: false }),
  createTier({ from_m2: 3, to_m2: 5, is_anchor: false }),
  createTier({ from_m2: 5, to_m2: 10, is_anchor: true }),
  createTier({ from_m2: 10, to_m2: null, is_anchor: true })
]);

const createMaterial = (): StorformatMaterial => ({
  id: crypto.randomUUID(),
  name: "",
  group_label: "",
  thumbnail_url: null,
  bleed_mm: 3,
  safe_area_mm: 3,
  max_width_mm: null,
  max_height_mm: null,
  allow_split: true,
  interpolation_enabled: true,
  markup_pct: 0,
  tiers: createDefaultTiers()
});

const createFinish = (): StorformatFinish => ({
  id: crypto.randomUUID(),
  name: "",
  group_label: "",
  thumbnail_url: null,
  pricing_mode: "per_m2",
  fixed_price_per_unit: 0,
  interpolation_enabled: true,
  markup_pct: 0,
  tiers: createDefaultTiers()
});

const createProduct = (): StorformatProduct => ({
  id: crypto.randomUUID(),
  name: "",
  group_label: "",
  thumbnail_url: null,
  pricing_mode: "per_m2",
  initial_price: 0,
  interpolation_enabled: true,
  markup_pct: 0,
  tiers: createDefaultTiers(),
  fixed_prices: []
});

export function StorformatManager({
  productId,
  tenantId,
  productName,
  pricingType,
  onPricingTypeChange
}: StorformatManagerProps) {
  const [config, setConfig] = useState<StorformatConfig>({
    rounding_step: 1,
    global_markup_pct: 0,
    quantities: defaultQuantities
  });
  const [customQuantity, setCustomQuantity] = useState("");
  const [materials, setMaterials] = useState<StorformatMaterial[]>([]);
  const [finishes, setFinishes] = useState<StorformatFinish[]>([]);
  const [products, setProducts] = useState<StorformatProduct[]>([]);
  const [activeCatalogSection, setActiveCatalogSection] = useState<LayoutSectionType>("materials");
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [expandedFinishId, setExpandedFinishId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [catalogSearchOpen, setCatalogSearchOpen] = useState<Record<LayoutSectionType, boolean>>({
    materials: false,
    finishes: false,
    products: false
  });
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<Record<LayoutSectionType, string>>({
    materials: "",
    finishes: "",
    products: ""
  });
  const [catalogTagFilter, setCatalogTagFilter] = useState<Record<LayoutSectionType, string>>({
    materials: "",
    finishes: "",
    products: ""
  });
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([
    {
      id: "row-1",
      sections: [
        { id: "section-products", sectionType: "products", ui_mode: "buttons", selection_mode: "required", valueIds: [] },
        { id: "section-finishes", sectionType: "finishes", ui_mode: "buttons", selection_mode: "required", valueIds: [] }
      ]
    }
  ]);
  const [verticalAxis, setVerticalAxis] = useState<VerticalAxisConfig>({
    id: "vertical-axis",
    sectionType: "materials",
    valueIds: [],
    valueSettings: {}
  });
  const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string>>({});
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [allTemplates, setAllTemplates] = useState<any[]>([]);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const [previewWidthMm, setPreviewWidthMm] = useState(1000);
  const [previewHeightMm, setPreviewHeightMm] = useState(1000);
  const [previewAmountPage, setPreviewAmountPage] = useState(0);


  const previewResult = useMemo(() => {
    if (previewWidthMm <= 0 || previewHeightMm <= 0) return null;
    const verticalSelection = selectedSectionValues[verticalAxis.id];
    const resolveSelectionForType = (type: LayoutSectionType, overrideId?: string) => {
      if (verticalAxis.sectionType === type && overrideId) return overrideId;
      const section = layoutRows.flatMap((r) => r.sections).find((s) => s.sectionType === type);
      if (!section) return null;
      const selected = selectedSectionValues[section.id];
      if (section.selection_mode === "optional") {
        return selected || null;
      }
      return selected || section.valueIds?.[0] || null;
    };

    const materialId = resolveSelectionForType("materials", verticalSelection || undefined);
    if (!materialId) return null;
    const finishId = resolveSelectionForType("finishes");
    const productId = resolveSelectionForType("products");

    const material = materials.find((m) => m.id === materialId);
    if (!material) return null;
    const finish = finishes.find((f) => f.id === finishId) || null;
    const product = products.find((p) => p.id === productId) || null;
    const quantity = [...(config.quantities || [])].sort((a, b) => a - b)[0] || 1;

    return calculateStorformatPrice({
      widthMm: previewWidthMm,
      heightMm: previewHeightMm,
      quantity,
      material,
      finish,
      product,
      config
    });
  }, [previewWidthMm, previewHeightMm, selectedSectionValues, verticalAxis, layoutRows, materials, finishes, products, config]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("storformat_price_list_templates" as any)
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setTemplates(data || []);
  };

  const fetchAllTemplates = async () => {
    const { data } = await supabase
      .from("storformat_price_list_templates" as any)
      .select("*, product:products(name)" as any)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setAllTemplates(data || []);
  };

  const fetchStorformat = async () => {
    setLoading(true);
    try {
      const { data: cfg } = await supabase
        .from("storformat_configs" as any)
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      if (cfg) {
        const storedQuantities = cfg.quantities?.length ? cfg.quantities : defaultQuantities;
        setConfig({
          rounding_step: cfg.rounding_step || 1,
          global_markup_pct: cfg.global_markup_pct || 0,
          quantities: storedQuantities,
          layout_rows: cfg.layout_rows || undefined,
          vertical_axis: cfg.vertical_axis || undefined
        });
        if (cfg.layout_rows?.length) {
          setLayoutRows(cfg.layout_rows);
        }
        if (cfg.vertical_axis) {
          setVerticalAxis({ ...cfg.vertical_axis, id: cfg.vertical_axis.id || "vertical-axis" });
        }
      }

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
        thumbnail_url: m.thumbnail_url ?? null,
        bleed_mm: m.bleed_mm ?? 3,
        safe_area_mm: m.safe_area_mm ?? 3,
        markup_pct: m.markup_pct ?? 0,
        tiers: (materialTiers || []).filter((t: any) => t.material_id === m.id).map((t: any) => ({
          ...t,
          markup_pct: t.markup_pct ?? 0
        }))
      }));
      setMaterials(materialsWithTiers);

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
        thumbnail_url: f.thumbnail_url ?? null,
        markup_pct: f.markup_pct ?? 0,
        tiers: (finishTiers || []).filter((t: any) => t.finish_id === f.id).map((t: any) => ({
          ...t,
          markup_pct: t.markup_pct ?? 0
        }))
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
        thumbnail_url: p.thumbnail_url ?? null,
        markup_pct: p.markup_pct ?? 0,
        tiers: (productTiers || []).filter((t: any) => t.product_item_id === p.id).map((t: any) => ({
          ...t,
          markup_pct: t.markup_pct ?? 0
        })),
        fixed_prices: (productFixedPrices || []).filter((fp: any) => fp.product_item_id === p.id)
      }));
      setProducts(productsWithPricing);
    } catch (error) {
      console.error("Storformat fetch error", error);
      toast.error("Kunne ikke hente storformat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorformat();
    fetchTemplates();
  }, [productId]);

  useEffect(() => {
    if (showAllTemplates) {
      fetchAllTemplates();
    }
  }, [showAllTemplates]);

  useEffect(() => {
    const next = { ...selectedSectionValues };
    let changed = false;

    const ensureSelection = (sectionId: string, values: string[] | undefined, mode: SelectionMode = "required") => {
      if (!values || values.length === 0) {
        if (next[sectionId]) {
          delete next[sectionId];
          changed = true;
        }
        return;
      }
      if (mode === "optional") {
        if (next[sectionId] && !values.includes(next[sectionId])) {
          delete next[sectionId];
          changed = true;
        }
        return;
      }
      if (!next[sectionId] || !values.includes(next[sectionId])) {
        next[sectionId] = values[0];
        changed = true;
      }
    };

    const verticalValues = (verticalAxis.valueIds || []).filter(Boolean);
    ensureSelection(verticalAxis.id, verticalValues, "required");

    layoutRows.forEach((row) => {
      row.sections.forEach((section) => {
        const values = (section.valueIds || []).filter(Boolean);
        ensureSelection(section.id, values, section.selection_mode || "required");
      });
    });

    if (changed) setSelectedSectionValues(next);
  }, [layoutRows, verticalAxis, materials, finishes, products, selectedSectionValues]);

  useEffect(() => {
    const totalQuantities = (config.quantities || []).length;
    const startCol = previewAmountPage * PREVIEW_COLS;
    if (startCol >= totalQuantities && totalQuantities > 0) {
      setPreviewAmountPage(0);
    }
  }, [config.quantities, previewAmountPage]);

  useEffect(() => {
    setExpandedMaterialId(null);
    setExpandedFinishId(null);
    setExpandedProductId(null);
  }, [activeCatalogSection]);

  const updateMaterial = (id: string, patch: Partial<StorformatMaterial>) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  };

  const updateFinish = (id: string, patch: Partial<StorformatFinish>) => {
    setFinishes((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const updateTier = (
    collection: "material" | "finish",
    parentId: string,
    tierId: string,
    patch: Partial<StorformatTier>
  ) => {
    const updater = collection === "material" ? updateMaterial : updateFinish;
    const list = collection === "material" ? materials : finishes;
    const parent = list.find((item) => item.id === parentId);
    if (!parent) return;
    const tiers = parent.tiers.map((t) => (t.id === tierId ? { ...t, ...patch } : t));
    updater(parentId, { tiers });
  };

  const updateProduct = (id: string, patch: Partial<StorformatProduct>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const updateProductTier = (productId: string, tierId: string, patch: Partial<StorformatTier>) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const tiers = (p.tiers || []).map((t) => (t.id === tierId ? { ...t, ...patch } : t));
        return { ...p, tiers };
      })
    );
  };

  const addProductTier = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return { ...p, tiers: [...(p.tiers || []), createTier()] };
      })
    );
  };

  const removeProductTier = (productId: string, tierId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return { ...p, tiers: (p.tiers || []).filter((t) => t.id !== tierId) };
      })
    );
  };

  const updateProductFixedPrice = (productId: string, quantity: number, price: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const fixedPrices = [...(p.fixed_prices || [])];
        const idx = fixedPrices.findIndex((fp) => fp.quantity === quantity);
        if (idx >= 0) {
          fixedPrices[idx] = { ...fixedPrices[idx], price };
        } else {
          fixedPrices.push({ id: crypto.randomUUID(), quantity, price });
        }
        return { ...p, fixed_prices: fixedPrices };
      })
    );
  };

  const normalizeQuantities = (values: number[]) =>
    Array.from(new Set(values.filter((v) => Number.isFinite(v) && v > 0))).sort((a, b) => a - b);

  const toggleQuantity = (qty: number) => {
    setConfig((prev) => {
      const current = new Set(prev.quantities || []);
      if (current.has(qty)) {
        current.delete(qty);
      } else {
        current.add(qty);
      }
      return { ...prev, quantities: normalizeQuantities(Array.from(current)) };
    });
  };

  const addCustomQuantity = () => {
    const qty = parseInt(customQuantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Indtast en gyldig mængde");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      quantities: normalizeQuantities([...(prev.quantities || []), qty])
    }));
    setCustomQuantity("");
  };

  const applyThumbnailToLayout = (valueId: string, url: string) => {
    setVerticalAxis((prev) => {
      if (!prev.valueIds?.includes(valueId)) return prev;
      const nextSettings = {
        ...(prev.valueSettings || {}),
        [valueId]: {
          ...(prev.valueSettings?.[valueId] || {}),
          customImage: url,
          showThumbnail: true
        }
      };
      return { ...prev, valueSettings: nextSettings };
    });

    setLayoutRows((prev) =>
      prev.map((row) => ({
        ...row,
        sections: row.sections.map((section) => {
          if (!section.valueIds?.includes(valueId)) return section;
          return {
            ...section,
            valueSettings: {
              ...(section.valueSettings || {}),
              [valueId]: {
                ...(section.valueSettings?.[valueId] || {}),
                customImage: url,
                showThumbnail: true
              }
            }
          };
        })
      }))
    );
  };

  const clearThumbnailFromLayout = (valueId: string) => {
    setVerticalAxis((prev) => {
      if (!prev.valueSettings?.[valueId]) return prev;
      return {
        ...prev,
        valueSettings: {
          ...prev.valueSettings,
          [valueId]: {
            ...(prev.valueSettings?.[valueId] || {}),
            customImage: undefined,
            showThumbnail: false
          }
        }
      };
    });

    setLayoutRows((prev) =>
      prev.map((row) => ({
        ...row,
        sections: row.sections.map((section) => {
          if (!section.valueSettings?.[valueId]) return section;
          return {
            ...section,
            valueSettings: {
              ...section.valueSettings,
              [valueId]: {
                ...(section.valueSettings?.[valueId] || {}),
                customImage: undefined,
                showThumbnail: false
              }
            }
          };
        })
      }))
    );
  };

  const triggerUpload = (scope: "section" | "vertical", sectionId: string, valueId: string) => {
    setUploadTarget({ scope, sectionId, valueId });
    fileInputRef.current?.click();
  };

  const triggerCatalogUpload = (catalogType: LayoutSectionType, valueId: string) => {
    setUploadTarget({ scope: "catalog", catalogType, valueId });
    fileInputRef.current?.click();
  };

  const clearCatalogThumbnail = (catalogType: LayoutSectionType, valueId: string) => {
    if (catalogType === "materials") {
      setMaterials((prev) => prev.map((item) => (item.id === valueId ? { ...item, thumbnail_url: null } : item)));
    } else if (catalogType === "finishes") {
      setFinishes((prev) => prev.map((item) => (item.id === valueId ? { ...item, thumbnail_url: null } : item)));
    } else {
      setProducts((prev) => prev.map((item) => (item.id === valueId ? { ...item, thumbnail_url: null } : item)));
    }
    clearThumbnailFromLayout(valueId);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `storformat-${productId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      if (uploadTarget.scope === "vertical") {
        setVerticalAxis((prev) => ({
          ...prev,
          valueSettings: {
            ...prev.valueSettings,
            [uploadTarget.valueId]: {
              ...(prev.valueSettings?.[uploadTarget.valueId] || {}),
              customImage: publicUrl,
              showThumbnail: true
            }
          }
        }));
      } else if (uploadTarget.scope === "section") {
        setLayoutRows((prev) =>
          prev.map((row) => ({
            ...row,
            sections: row.sections.map((section) => {
              if (section.id !== uploadTarget.sectionId) return section;
              return {
                ...section,
                valueSettings: {
                  ...section.valueSettings,
                  [uploadTarget.valueId]: {
                    ...(section.valueSettings?.[uploadTarget.valueId] || {}),
                    customImage: publicUrl,
                    showThumbnail: true
                  }
                }
              };
            })
          }))
        );
      } else if (uploadTarget.scope === "catalog") {
        const updateCatalogItems = <T extends { id?: string; thumbnail_url?: string | null }>(
          items: T[]
        ) => items.map((item) => (
          item.id === uploadTarget.valueId
            ? { ...item, thumbnail_url: publicUrl }
            : item
        ));

        if (uploadTarget.catalogType === "materials") {
          setMaterials((prev) => updateCatalogItems(prev));
        } else if (uploadTarget.catalogType === "finishes") {
          setFinishes((prev) => updateCatalogItems(prev));
        } else {
          setProducts((prev) => updateCatalogItems(prev));
        }

        applyThumbnailToLayout(uploadTarget.valueId, publicUrl);
      }
    } catch (error) {
      console.error("Storformat image upload error", error);
      toast.error("Kunne ikke uploade billede");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadTarget(null);
    }
  };

  const tagOptionsByType = useMemo(() => {
    const collectTags = (type: LayoutSectionType) => {
      const source = type === "materials" ? materials : type === "finishes" ? finishes : products;
      const tags = source.map((item) => (item.group_label || "").trim()).filter(Boolean) as string[];
      return Array.from(new Set(tags));
    };
    return {
      materials: collectTags("materials"),
      finishes: collectTags("finishes"),
      products: collectTags("products")
    };
  }, [materials, finishes, products]);

  const valueSettingsById = useMemo(() => {
    const map: Record<string, { customImage?: string; showThumbnail?: boolean }> = {};
    if (verticalAxis?.valueSettings) {
      Object.entries(verticalAxis.valueSettings).forEach(([valueId, settings]) => {
        map[valueId] = settings || {};
      });
    }
    layoutRows.forEach((row) => {
      row.sections.forEach((section) => {
        if (!section.valueSettings) return;
        Object.entries(section.valueSettings).forEach(([valueId, settings]) => {
          if (!map[valueId]) {
            map[valueId] = settings || {};
          }
        });
      });
    });
    return map;
  }, [layoutRows, verticalAxis]);

  const filterCatalogItems = <T extends { name?: string; group_label?: string | null }>(
    type: LayoutSectionType,
    items: T[]
  ) => {
    const query = catalogSearchQuery[type].trim().toLowerCase();
    const tag = catalogTagFilter[type];
    return items.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const groupRaw = item.group_label?.trim() || "";
      const group = groupRaw.toLowerCase();
      const matchesQuery = !query || name.includes(query) || group.includes(query);
      const matchesTag = !tag || groupRaw === tag;
      return matchesQuery && matchesTag && (item.name || "").trim();
    });
  };

  const getValuesForType = (type: LayoutSectionType) => {
    if (type === "materials") return materials;
    if (type === "finishes") return finishes;
    return products;
  };

  const addValueToTarget = (type: LayoutSectionType, valueId: string) => {
    if (!selectedTarget) {
      toast.error("Klik på en boks i “Prisliste Layout” for at vælge hvor elementet skal tilføjes.");
      return;
    }

    const targetItem = getValuesForType(type).find((value) => value.id === valueId);
    const thumbnailUrl = targetItem?.thumbnail_url || null;

    if (selectedTarget.type === "vertical") {
      if (verticalAxis.sectionType !== type) {
        toast.error("Lodret akse er sat til en anden type. Skift typen før du tilføjer denne værdi.");
        return;
      }
      setVerticalAxis((prev) => ({
        ...prev,
        valueIds: Array.from(new Set([...(prev.valueIds || []), valueId])),
        valueSettings: thumbnailUrl
          ? {
            ...(prev.valueSettings || {}),
            [valueId]: {
              ...(prev.valueSettings?.[valueId] || {}),
              customImage: prev.valueSettings?.[valueId]?.customImage || thumbnailUrl,
              showThumbnail: true
            }
          }
          : prev.valueSettings
      }));
      return;
    }

    const targetSection = layoutRows.flatMap((r) => r.sections).find((s) => s.id === selectedTarget.id);
    if (!targetSection) {
      toast.error("Vælg en gyldig sektion i layoutet.");
      return;
    }
    if (targetSection.sectionType !== type) {
      toast.error("Sektionen er sat til en anden type. Skift sektionstype før du tilføjer denne værdi.");
      return;
    }

    setLayoutRows((prev) =>
      prev.map((row) => ({
        ...row,
        sections: row.sections.map((section) => {
          if (section.id !== selectedTarget.id) return section;
          const nextValueIds = Array.from(new Set([...(section.valueIds || []), valueId]));
          const nextValueSettings = thumbnailUrl
            ? {
              ...(section.valueSettings || {}),
              [valueId]: {
                ...(section.valueSettings?.[valueId] || {}),
                customImage: section.valueSettings?.[valueId]?.customImage || thumbnailUrl,
                showThumbnail: true
              }
            }
            : section.valueSettings;
          return {
            ...section,
            valueIds: nextValueIds,
            valueSettings: nextValueSettings
          };
        })
      }))
    );
  };

  const getSelectedTargetType = () => {
    if (!selectedTarget) return null;
    if (selectedTarget.type === "vertical") {
      return verticalAxis.sectionType;
    }
    const targetSection = layoutRows.flatMap((r) => r.sections).find((s) => s.id === selectedTarget.id);
    return targetSection?.sectionType || null;
  };

  const handleCatalogCardClick = (type: LayoutSectionType, valueId: string) => {
    const selectedType = getSelectedTargetType();
    if (selectedType === type) {
      addValueToTarget(type, valueId);
      layoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (type === "materials") {
      setExpandedMaterialId((prev) => (prev === valueId ? null : valueId));
    } else if (type === "finishes") {
      setExpandedFinishId((prev) => (prev === valueId ? null : valueId));
    } else {
      setExpandedProductId((prev) => (prev === valueId ? null : valueId));
    }
  };

  const toggleCatalogSearch = (type: LayoutSectionType) => {
    setCatalogSearchOpen((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const updateCatalogSearch = (type: LayoutSectionType, value: string) => {
    setCatalogSearchQuery((prev) => ({ ...prev, [type]: value }));
  };

  const updateCatalogTagFilter = (type: LayoutSectionType, value: string) => {
    setCatalogTagFilter((prev) => ({ ...prev, [type]: value }));
  };

  const removeSectionValue = (sectionId: string, valueId: string) => {
    setLayoutRows((prev) =>
      prev.map((row) => ({
        ...row,
        sections: row.sections.map((section) => {
          if (section.id !== sectionId) return section;
          return {
            ...section,
            valueIds: (section.valueIds || []).filter((id) => id !== valueId)
          };
        })
      }))
    );
  };

  const removeVerticalValue = (valueId: string) => {
    setVerticalAxis((prev) => ({
      ...prev,
      valueIds: (prev.valueIds || []).filter((id) => id !== valueId)
    }));
  };

  const toggleSectionThumbnail = (sectionId: string, valueId: string) => {
    setLayoutRows((prev) =>
      prev.map((row) => ({
        ...row,
        sections: row.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const current = section.valueSettings?.[valueId] || {};
          const nextShow = !current.showThumbnail;
          const thumbnailUrl = getValuesForType(section.sectionType).find((value) => value.id === valueId)?.thumbnail_url || null;
          return {
            ...section,
            valueSettings: {
              ...section.valueSettings,
              [valueId]: {
                ...current,
                showThumbnail: nextShow,
                customImage: current.customImage || (nextShow ? thumbnailUrl : current.customImage)
              }
            }
          };
        })
      }))
    );
  };

  const toggleVerticalThumbnail = (valueId: string) => {
    setVerticalAxis((prev) => {
      const current = prev.valueSettings?.[valueId] || {};
      const nextShow = !current.showThumbnail;
      const thumbnailUrl = getValuesForType(prev.sectionType).find((value) => value.id === valueId)?.thumbnail_url || null;
      return {
        ...prev,
        valueSettings: {
          ...prev.valueSettings,
          [valueId]: {
            ...current,
            showThumbnail: nextShow,
            customImage: current.customImage || (nextShow ? thumbnailUrl : current.customImage)
          }
        }
      };
    });
  };

  const handleResetLayoutConfig = () => {
    if (!confirm("Nulstil prisliste-layout? Ugemte ændringer går tabt.")) return;
    setLayoutRows([
      {
        id: "row-1",
        sections: [
          { id: "section-products", sectionType: "products", ui_mode: "buttons", selection_mode: "required", valueIds: [] },
          { id: "section-finishes", sectionType: "finishes", ui_mode: "buttons", selection_mode: "required", valueIds: [] }
        ]
      }
    ]);
    setVerticalAxis({
      id: "vertical-axis",
      sectionType: "materials",
      valueIds: [],
      valueSettings: {}
    });
    setSelectedSectionValues({});
    setSelectedTarget(null);
    toast.success("Prisliste-layout nulstillet");
  };

  const handleResetPriceListConfig = () => {
    if (!confirm("Nulstil prisliste-opsætning? Ugemte ændringer går tabt.")) return;
    setConfig((prev) => ({
      ...prev,
      rounding_step: 1,
      global_markup_pct: 0,
      quantities: defaultQuantities
    }));
    setSelectedSectionValues({});
    setSelectedTarget(null);
    setCustomQuantity("");
    setPreviewWidthMm(1000);
    setPreviewHeightMm(1000);
    setPreviewAmountPage(0);
    toast.success("Prisliste-opsætning nulstillet");
  };
  const addTier = (collection: "material" | "finish", parentId: string) => {
    const updater = collection === "material" ? updateMaterial : updateFinish;
    const list = collection === "material" ? materials : finishes;
    const parent = list.find((item) => item.id === parentId);
    if (!parent) return;
    updater(parentId, { tiers: [...parent.tiers, createTier()] });
  };

  const removeTier = (collection: "material" | "finish", parentId: string, tierId: string) => {
    const updater = collection === "material" ? updateMaterial : updateFinish;
    const list = collection === "material" ? materials : finishes;
    const parent = list.find((item) => item.id === parentId);
    if (!parent) return;
    updater(parentId, { tiers: parent.tiers.filter((t) => t.id !== tierId) });
  };

  const handleSave = async () => {
    const normalizedQuantities = normalizeQuantities(config.quantities || []);
    if (!normalizedQuantities.length) {
      toast.error("Indtast mindst én mængde");
      return;
    }
    if (materials.length === 0) {
      toast.error("Tilføj mindst ét materiale");
      return;
    }

    setSaving(true);
    try {
      const updatedConfig = {
        ...config,
        quantities: normalizedQuantities,
        layout_rows: layoutRows,
        vertical_axis: verticalAxis
      };
      setConfig(updatedConfig);

      const configRow = {
        tenant_id: tenantId,
        product_id: productId,
        rounding_step: updatedConfig.rounding_step,
        global_markup_pct: updatedConfig.global_markup_pct,
        quantities: updatedConfig.quantities,
        layout_rows: updatedConfig.layout_rows || [],
        vertical_axis: updatedConfig.vertical_axis || null
      };

      const { error: cfgError } = await supabase
        .from("storformat_configs" as any)
        .upsert(configRow, { onConflict: "product_id" });
      if (cfgError) throw cfgError;

      const materialRows = materials.map((m, idx) => ({
        id: m.id || crypto.randomUUID(),
        tenant_id: tenantId,
        product_id: productId,
        name: m.name.trim(),
        group_label: m.group_label?.trim() || null,
        thumbnail_url: m.thumbnail_url || null,
        bleed_mm: typeof m.bleed_mm === "number" ? m.bleed_mm : 3,
        safe_area_mm: typeof m.safe_area_mm === "number" ? m.safe_area_mm : 3,
        max_width_mm: m.max_width_mm || null,
        max_height_mm: m.max_height_mm || null,
        allow_split: m.allow_split ?? true,
        interpolation_enabled: m.interpolation_enabled ?? true,
        markup_pct: m.markup_pct || 0,
        sort_order: idx
      }));

      const finishRows = finishes.map((f, idx) => ({
        id: f.id || crypto.randomUUID(),
        tenant_id: tenantId,
        product_id: productId,
        name: f.name.trim(),
        group_label: f.group_label?.trim() || null,
        thumbnail_url: f.thumbnail_url || null,
        pricing_mode: f.pricing_mode,
        fixed_price_per_unit: f.fixed_price_per_unit || 0,
        interpolation_enabled: f.interpolation_enabled ?? true,
        markup_pct: f.markup_pct || 0,
        sort_order: idx
      }));

      const productRows = products.map((p, idx) => ({
        id: p.id || crypto.randomUUID(),
        tenant_id: tenantId,
        product_id: productId,
        name: p.name.trim(),
        group_label: p.group_label?.trim() || null,
        thumbnail_url: p.thumbnail_url || null,
        pricing_mode: p.pricing_mode,
        initial_price: p.initial_price || 0,
        interpolation_enabled: p.interpolation_enabled ?? true,
        markup_pct: p.markup_pct || 0,
        sort_order: idx
      }));

      const { data: existingMaterials } = await supabase
        .from("storformat_materials" as any)
        .select("id")
        .eq("product_id", productId);

      const { data: existingFinishes } = await supabase
        .from("storformat_finishes" as any)
        .select("id")
        .eq("product_id", productId);

      const { data: existingProducts } = await supabase
        .from("storformat_products" as any)
        .select("id")
        .eq("product_id", productId);

      const materialIds = new Set(materialRows.map((m) => m.id));
      const finishIds = new Set(finishRows.map((f) => f.id));
      const productIds = new Set(productRows.map((p) => p.id));

      const materialIdsToDelete = (existingMaterials || [])
        .map((m: any) => m.id)
        .filter((id: string) => !materialIds.has(id));

      const finishIdsToDelete = (existingFinishes || [])
        .map((f: any) => f.id)
        .filter((id: string) => !finishIds.has(id));

      const productIdsToDelete = (existingProducts || [])
        .map((p: any) => p.id)
        .filter((id: string) => !productIds.has(id));

      if (materialIdsToDelete.length) {
        await supabase.from("storformat_materials" as any).delete().in("id", materialIdsToDelete);
      }
      if (finishIdsToDelete.length) {
        await supabase.from("storformat_finishes" as any).delete().in("id", finishIdsToDelete);
      }
      if (productIdsToDelete.length) {
        await supabase.from("storformat_products" as any).delete().in("id", productIdsToDelete);
      }

      const { error: materialsError } = await supabase
        .from("storformat_materials" as any)
        .upsert(materialRows, { onConflict: "id" });
      if (materialsError) throw materialsError;

      const { error: finishesError } = await supabase
        .from("storformat_finishes" as any)
        .upsert(finishRows, { onConflict: "id" });
      if (finishesError) throw finishesError;

      const { error: productsError } = await supabase
        .from("storformat_products" as any)
        .upsert(productRows, { onConflict: "id" });
      if (productsError) throw productsError;

      // Replace tiers each save (simpler and safe for small datasets)
      await supabase.from("storformat_material_price_tiers" as any).delete().eq("product_id", productId);
      await supabase.from("storformat_finish_price_tiers" as any).delete().eq("product_id", productId);
      await supabase.from("storformat_product_price_tiers" as any).delete().eq("product_id", productId);
      await supabase.from("storformat_product_fixed_prices" as any).delete().eq("product_id", productId);

      const materialTierRows = materials.flatMap((m) =>
        m.tiers.map((tier, idx) => ({
          id: tier.id || crypto.randomUUID(),
          tenant_id: tenantId,
          product_id: productId,
          material_id: m.id,
          from_m2: tier.from_m2,
          to_m2: tier.to_m2 ?? null,
          price_per_m2: tier.price_per_m2,
          is_anchor: tier.is_anchor ?? true,
          markup_pct: tier.markup_pct ?? 0,
          sort_order: idx
        }))
      );

      const finishTierRows = finishes.flatMap((f) =>
        f.tiers.map((tier, idx) => ({
          id: tier.id || crypto.randomUUID(),
          tenant_id: tenantId,
          product_id: productId,
          finish_id: f.id,
          from_m2: tier.from_m2,
          to_m2: tier.to_m2 ?? null,
          price_per_m2: tier.price_per_m2,
          is_anchor: tier.is_anchor ?? true,
          markup_pct: tier.markup_pct ?? 0,
          sort_order: idx
        }))
      );

      const productTierRows = products
        .filter((p) => p.pricing_mode === "per_m2")
        .flatMap((p) =>
          (p.tiers || []).map((tier, idx) => ({
            id: tier.id || crypto.randomUUID(),
            tenant_id: tenantId,
            product_id: productId,
            product_item_id: p.id,
            from_m2: tier.from_m2,
            to_m2: tier.to_m2 ?? null,
            price_per_m2: tier.price_per_m2,
            is_anchor: tier.is_anchor ?? true,
            markup_pct: tier.markup_pct ?? 0,
            sort_order: idx
          }))
        );

      const productFixedPriceRows = products
        .filter((p) => p.pricing_mode === "fixed")
        .flatMap((p) =>
          (p.fixed_prices || []).map((fp, idx) => ({
            id: fp.id || crypto.randomUUID(),
            tenant_id: tenantId,
            product_id: productId,
            product_item_id: p.id,
            quantity: fp.quantity,
            price: fp.price,
            sort_order: idx
          }))
        );

      if (materialTierRows.length) {
        const { error } = await supabase.from("storformat_material_price_tiers" as any).insert(materialTierRows);
        if (error) throw error;
      }

      if (finishTierRows.length) {
        const { error } = await supabase.from("storformat_finish_price_tiers" as any).insert(finishTierRows);
        if (error) throw error;
      }

      if (productTierRows.length) {
        const { error } = await supabase.from("storformat_product_price_tiers" as any).insert(productTierRows);
        if (error) throw error;
      }

      if (productFixedPriceRows.length) {
        const { error } = await supabase.from("storformat_product_fixed_prices" as any).insert(productFixedPriceRows);
        if (error) throw error;
      }

      if (onPricingTypeChange && pricingType !== "STORFORMAT") {
        onPricingTypeChange("STORFORMAT");
      }

      toast.success("Storformat opsætning gemt");
      setExpandedMaterialId(null);
      setExpandedFinishId(null);
      setExpandedProductId(null);
      fetchStorformat();
    } catch (error: any) {
      console.error("Storformat save error", error);
      toast.error(error.message || "Kunne ikke gemme storformat");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) {
      toast.error("Angiv et navn");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const spec = {
        config,
        materials,
        finishes,
        products,
        layout_rows: layoutRows,
        vertical_axis: verticalAxis
      };
      const { error } = await supabase
        .from("storformat_price_list_templates" as any)
        .insert({
          tenant_id: tenantId,
          product_id: productId,
          name: saveName.trim(),
          spec,
          created_by: user?.id
        });
      if (error) throw error;
      toast.success("Skabelon gemt i banken");
      setSaveName("");
      setShowSaveDialog(false);
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke gemme skabelon");
    }
  };

  const handleLoadTemplate = (t: any) => {
    const spec = t.spec || {};
    if (spec.config) {
      setConfig({
        rounding_step: spec.config.rounding_step || 1,
        global_markup_pct: spec.config.global_markup_pct || 0,
        quantities: spec.config.quantities?.length ? spec.config.quantities : defaultQuantities,
        layout_rows: spec.config.layout_rows || spec.layout_rows,
        vertical_axis: spec.config.vertical_axis || spec.vertical_axis
      });
    }
    if (spec.materials) setMaterials(spec.materials);
    if (spec.finishes) setFinishes(spec.finishes);
    if (spec.products) setProducts(spec.products);
    if (spec.layout_rows) setLayoutRows(spec.layout_rows);
    if (spec.vertical_axis) setVerticalAxis({ ...spec.vertical_axis, id: spec.vertical_axis.id || "vertical-axis" });
    toast.success("Skabelon indlæst");
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Slet denne skabelon?")) return;
    const { error } = await supabase.from("storformat_price_list_templates" as any).delete().eq("id", id);
    if (error) {
      toast.error("Kunne ikke slette skabelon");
      return;
    }
    toast.success("Skabelon slettet");
    fetchTemplates();
    if (showAllTemplates) fetchAllTemplates();
  };

  const visibleMaterials = filterCatalogItems("materials", materials);
  const visibleFinishes = filterCatalogItems("finishes", finishes);
  const visibleProducts = filterCatalogItems("products", products);
  const MAX_VISIBLE_CATALOG = 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-muted-foreground text-sm">Indlæser storformat...</span>
      </div>
    );
  }

  const sortedQuantities = [...(config.quantities || [])].sort((a, b) => a - b);
  const startCol = previewAmountPage * PREVIEW_COLS;
  const visibleQuantities = sortedQuantities.slice(startCol, startCol + PREVIEW_COLS);

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} />
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Materialer, Efterbehandling & Produkter</CardTitle>
                <CardDescription>
                  Opret elementer og vælg hvor de skal placeres i prislisten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={activeCatalogSection === "materials" ? "default" : "outline"}
                    className={cn(activeCatalogSection === "materials" && "bg-[#00a8e8] hover:bg-[#0090c8]")}
                    onClick={() => setActiveCatalogSection("materials")}
                  >
                    Materialer
                  </Button>
                  <Button
                    size="sm"
                    variant={activeCatalogSection === "finishes" ? "default" : "outline"}
                    className={cn(activeCatalogSection === "finishes" && "bg-[#00a8e8] hover:bg-[#0090c8]")}
                    onClick={() => setActiveCatalogSection("finishes")}
                  >
                    Efterbehandling
                  </Button>
                  <Button
                    size="sm"
                    variant={activeCatalogSection === "products" ? "default" : "outline"}
                    className={cn(activeCatalogSection === "products" && "bg-[#00a8e8] hover:bg-[#0090c8]")}
                    onClick={() => setActiveCatalogSection("products")}
                  >
                    Produkter
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Klik på en boks i “Prisliste Layout” nedenfor for at vælge hvor elementet skal tilføjes.
                </div>
                {activeCatalogSection === "materials" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Materialer</Label>
                        <p className="text-xs text-muted-foreground">Materialer med max mål, pris pr. m² og interpolation.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newMaterial = createMaterial();
                          setMaterials((prev) => [...prev, newMaterial]);
                          setExpandedMaterialId(newMaterial.id || null);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Opret nyt
                      </Button>
                    </div>

                    {expandedMaterialId && (() => {
                      const material = materials.find((m) => m.id === expandedMaterialId);
                      if (!material) return null;
                      const materialIndex = materials.findIndex((m) => m.id === material.id);
                      return (
                        <div key={material.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">#{materialIndex + 1}</Badge>
                              <Input
                                value={material.name}
                                onChange={(e) => updateMaterial(material.id!, { name: e.target.value })}
                                placeholder="Materiale navn"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setExpandedMaterialId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setMaterials((prev) => prev.filter((m) => m.id !== material.id));
                                  setExpandedMaterialId(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Tag/gruppe</Label>
                              <Input
                                value={material.group_label ?? ""}
                                onChange={(e) => updateMaterial(material.id!, { group_label: e.target.value })}
                                placeholder="F.eks. Banner"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Maks længde (cm)</Label>
                              <Input
                                type="number"
                                value={material.max_width_mm ? material.max_width_mm / 10 : ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateMaterial(material.id!, { max_width_mm: raw === "" ? null : Number(raw) * 10 });
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Maks højde (cm)</Label>
                              <Input
                                type="number"
                                value={material.max_height_mm ? material.max_height_mm / 10 : ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateMaterial(material.id!, { max_height_mm: raw === "" ? null : Number(raw) * 10 });
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Bleed (mm)</Label>
                              <Input
                                type="number"
                                value={material.bleed_mm ?? 3}
                                onChange={(e) => updateMaterial(material.id!, { bleed_mm: Number(e.target.value) || 0 })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Safe zone (mm)</Label>
                              <Input
                                type="number"
                                value={material.safe_area_mm ?? 3}
                                onChange={(e) => updateMaterial(material.id!, { safe_area_mm: Number(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Bleed er beskæringsområdet. Safe zone er området til vigtigt indhold (brug større værdi ved ringe/forstærkning).
                          </p>

                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <Label className="text-xs">Split ved overskridelse</Label>
                              <p className="text-[11px] text-muted-foreground">Vis split-besked i frontend</p>
                            </div>
                            <Switch
                              checked={material.allow_split ?? true}
                              onCheckedChange={(checked) => updateMaterial(material.id!, { allow_split: checked })}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Interpolation</Label>
                              <p className="text-[11px] text-muted-foreground">Lineær mellem ankerpunkter</p>
                            </div>
                            <Switch
                              checked={material.interpolation_enabled ?? true}
                              onCheckedChange={(checked) => updateMaterial(material.id!, { interpolation_enabled: checked })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Produkt markup (%)</Label>
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                className="w-20"
                                value={material.markup_pct ?? 0}
                                onChange={(e) => updateMaterial(material.id!, { markup_pct: Number(e.target.value) || 0 })}
                              />
                              <CenterSlider
                                value={[Number(material.markup_pct) || 0]}
                                onValueChange={(value) => updateMaterial(material.id!, { markup_pct: value[0] })}
                                min={-100}
                                max={200}
                                step={1}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Pris pr. m² (tiers)</Label>
                            <div className="space-y-3">
                              {material.tiers.map((tier) => {
                                const itemMarkup = Number(material.markup_pct) || 0;
                                const interpolationEnabled = material.interpolation_enabled ?? true;
                                const { isBetweenAnchors, rawInterpolatedBase } = getInterpolationInfo(
                                  material.tiers,
                                  tier.from_m2,
                                  interpolationEnabled
                                );
                                const isOverride = interpolationEnabled && !tier.is_anchor && isBetweenAnchors && Number(tier.markup_pct) !== 0;
                                const useInterpolated = interpolationEnabled && !tier.is_anchor && isBetweenAnchors && !isOverride;
                                const displayBase = useInterpolated ? (rawInterpolatedBase ?? 0) : (tier.price_per_m2 || 0);
                                const displayMarkup = useInterpolated ? 0 : (tier.markup_pct ?? 0);
                                const displayPrice = displayBase * (1 + displayMarkup / 100) * (1 + itemMarkup / 100);
                                const displayValue = displayBase > 0 || useInterpolated ? Math.round(displayPrice) : "";
                                const totalMultiplier = (1 + (tier.markup_pct ?? 0) / 100) * (1 + itemMarkup / 100);

                                return (
                                  <div key={tier.id} className="border rounded-md p-2 space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                      <Input
                                        type="number"
                                        value={tier.from_m2}
                                        onChange={(e) => updateTier("material", material.id!, tier.id!, { from_m2: Number(e.target.value) || 0 })}
                                        placeholder="Fra m²"
                                      />
                                      <Input
                                        type="number"
                                        value={tier.to_m2 ?? ""}
                                        onChange={(e) => updateTier("material", material.id!, tier.id!, { to_m2: e.target.value ? Number(e.target.value) : null })}
                                        placeholder="Til m²"
                                      />
                                      <Input
                                        type="number"
                                        value={displayValue}
                                        onChange={(e) => {
                                          const finalPrice = Number(e.target.value) || 0;
                                          const basePrice = totalMultiplier ? finalPrice / totalMultiplier : 0;
                                          updateTier("material", material.id!, tier.id!, { price_per_m2: basePrice });
                                        }}
                                        placeholder="Pris pr. m²"
                                      />
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={tier.is_anchor ?? true}
                                          onCheckedChange={(checked) => updateTier("material", material.id!, tier.id!, { is_anchor: checked })}
                                        />
                                        <span className="text-xs text-muted-foreground">Anker</span>
                                      </div>
                                      <Button variant="ghost" size="icon" onClick={() => removeTier("material", material.id!, tier.id!)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Label className="text-[10px]">Markup %</Label>
                                      <Input
                                        type="number"
                                        className="w-20 h-8"
                                        value={tier.markup_pct ?? 0}
                                        onChange={(e) => updateTier("material", material.id!, tier.id!, { markup_pct: Number(e.target.value) || 0 })}
                                      />
                                      <CenterSlider
                                        value={[Number(tier.markup_pct) || 0]}
                                        onValueChange={(value) => {
                                          const nextValue = value[0];
                                          if (interpolationEnabled && isBetweenAnchors && !tier.is_anchor) {
                                            if (nextValue !== 0 && rawInterpolatedBase != null) {
                                              updateTier("material", material.id!, tier.id!, {
                                                markup_pct: nextValue,
                                                price_per_m2: rawInterpolatedBase
                                              });
                                              return;
                                            }
                                            if (nextValue === 0) {
                                              updateTier("material", material.id!, tier.id!, { markup_pct: 0, price_per_m2: 0 });
                                              return;
                                            }
                                          }
                                          updateTier("material", material.id!, tier.id!, { markup_pct: nextValue });
                                        }}
                                        min={-100}
                                        max={200}
                                        step={1}
                                        className="flex-1"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => addTier("material", material.id!)} className="mt-2">
                              <Plus className="h-4 w-4 mr-2" /> Tilføj tier
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Gemte materialer</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleCatalogSearch("materials")}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                          {(catalogSearchOpen.materials || catalogSearchQuery.materials) && (
                            <Input
                              value={catalogSearchQuery.materials}
                              onChange={(e) => updateCatalogSearch("materials", e.target.value)}
                              placeholder="Søg..."
                              className="h-8 w-40"
                            />
                          )}
                          <Select
                            value={catalogTagFilter.materials || "all"}
                            onValueChange={(value) => updateCatalogTagFilter("materials", value === "all" ? "" : value)}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue placeholder="Tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle tags</SelectItem>
                              {tagOptionsByType.materials.map((tag) => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {visibleMaterials.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen gemte materialer endnu</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {visibleMaterials.slice(0, MAX_VISIBLE_CATALOG).map((material) => {
                            const settings = valueSettingsById[material.id || ""] || {};
                            const thumbnailUrl = settings.customImage || material.thumbnail_url || "";
                            const isSelected = expandedMaterialId === material.id;
                            return (
                              <button
                                key={`saved-${material.id}`}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/40"
                                )}
                                onClick={() => handleCatalogCardClick("materials", material.id!)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {thumbnailUrl && (
                                    <img src={thumbnailUrl} className="w-7 h-7 rounded object-cover" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{material.name}</div>
                                    {material.group_label && (
                                      <div className={cn("text-[11px] truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>{material.group_label}</div>
                                    )}
                                  </div>
                                </div>
                                <div className={cn("flex items-center gap-1", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerCatalogUpload("materials", material.id!);
                                    }}
                                  >
                                    <ImageIcon className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={!thumbnailUrl}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clearCatalogThumbnail("materials", material.id!);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {visibleMaterials.length > MAX_VISIBLE_CATALOG && (
                        <div className="text-[11px] text-muted-foreground">
                          Viser {MAX_VISIBLE_CATALOG} af {visibleMaterials.length} materialer
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeCatalogSection === "finishes" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Efterbehandling</Label>
                        <p className="text-xs text-muted-foreground">Efterbehandlinger med fixed pris eller m² tiers.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newFinish = createFinish();
                          setFinishes((prev) => [...prev, newFinish]);
                          setExpandedFinishId(newFinish.id || null);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Opret ny
                      </Button>
                    </div>

                    {expandedFinishId && (() => {
                      const finish = finishes.find((f) => f.id === expandedFinishId);
                      if (!finish) return null;
                      const finishIndex = finishes.findIndex((f) => f.id === finish.id);
                      return (
                        <div key={finish.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">#{finishIndex + 1}</Badge>
                              <Input
                                value={finish.name}
                                onChange={(e) => updateFinish(finish.id!, { name: e.target.value })}
                                placeholder="Efterbehandling navn"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setExpandedFinishId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setFinishes((prev) => prev.filter((f) => f.id !== finish.id));
                                  setExpandedFinishId(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Tag/gruppe</Label>
                              <Input
                                value={finish.group_label ?? ""}
                                onChange={(e) => updateFinish(finish.id!, { group_label: e.target.value })}
                                placeholder="F.eks. Lamineret"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Pris-mode</Label>
                              <Select
                                value={finish.pricing_mode}
                                onValueChange={(value) => updateFinish(finish.id!, { pricing_mode: value as "fixed" | "per_m2" })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="per_m2">Pris pr. m²</SelectItem>
                                  <SelectItem value="fixed">Fast pris pr. stk</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fast pris pr. stk</Label>
                              <Input
                                type="number"
                                value={finish.fixed_price_per_unit ?? 0}
                                onChange={(e) => updateFinish(finish.id!, { fixed_price_per_unit: Number(e.target.value) || 0 })}
                                disabled={finish.pricing_mode !== "fixed"}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <Label className="text-xs">Interpolation</Label>
                              <p className="text-[11px] text-muted-foreground">Lineær mellem ankerpunkter</p>
                            </div>
                            <Switch
                              checked={finish.interpolation_enabled ?? true}
                              onCheckedChange={(checked) => updateFinish(finish.id!, { interpolation_enabled: checked })}
                              disabled={finish.pricing_mode !== "per_m2"}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Produkt markup (%)</Label>
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                className="w-20"
                                value={finish.markup_pct ?? 0}
                                onChange={(e) => updateFinish(finish.id!, { markup_pct: Number(e.target.value) || 0 })}
                              />
                              <CenterSlider
                                value={[Number(finish.markup_pct) || 0]}
                                onValueChange={(value) => updateFinish(finish.id!, { markup_pct: value[0] })}
                                min={-100}
                                max={200}
                                step={1}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          {finish.pricing_mode === "per_m2" && (
                            <div className="space-y-2">
                              <Label className="text-xs">Pris pr. m² (tiers)</Label>
                              <div className="space-y-3">
                                {finish.tiers.map((tier) => {
                                  const itemMarkup = Number(finish.markup_pct) || 0;
                                  const interpolationEnabled = finish.interpolation_enabled ?? true;
                                  const { isBetweenAnchors, rawInterpolatedBase } = getInterpolationInfo(
                                    finish.tiers,
                                    tier.from_m2,
                                    interpolationEnabled
                                  );
                                  const isOverride = interpolationEnabled && !tier.is_anchor && isBetweenAnchors && Number(tier.markup_pct) !== 0;
                                  const useInterpolated = interpolationEnabled && !tier.is_anchor && isBetweenAnchors && !isOverride;
                                  const displayBase = useInterpolated ? (rawInterpolatedBase ?? 0) : (tier.price_per_m2 || 0);
                                  const displayMarkup = useInterpolated ? 0 : (tier.markup_pct ?? 0);
                                  const displayPrice = displayBase * (1 + displayMarkup / 100) * (1 + itemMarkup / 100);
                                  const displayValue = displayBase > 0 || useInterpolated ? Math.round(displayPrice) : "";
                                  const totalMultiplier = (1 + (tier.markup_pct ?? 0) / 100) * (1 + itemMarkup / 100);

                                  return (
                                    <div key={tier.id} className="border rounded-md p-2 space-y-2">
                                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                        <Input
                                          type="number"
                                          value={tier.from_m2}
                                          onChange={(e) => updateTier("finish", finish.id!, tier.id!, { from_m2: Number(e.target.value) || 0 })}
                                          placeholder="Fra m²"
                                        />
                                        <Input
                                          type="number"
                                          value={tier.to_m2 ?? ""}
                                          onChange={(e) => updateTier("finish", finish.id!, tier.id!, { to_m2: e.target.value ? Number(e.target.value) : null })}
                                          placeholder="Til m²"
                                        />
                                        <Input
                                          type="number"
                                          value={displayValue}
                                          onChange={(e) => {
                                            const finalPrice = Number(e.target.value) || 0;
                                            const basePrice = totalMultiplier ? finalPrice / totalMultiplier : 0;
                                            updateTier("finish", finish.id!, tier.id!, { price_per_m2: basePrice });
                                          }}
                                          placeholder="Pris pr. m²"
                                        />
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={tier.is_anchor ?? true}
                                            onCheckedChange={(checked) => updateTier("finish", finish.id!, tier.id!, { is_anchor: checked })}
                                          />
                                          <span className="text-xs text-muted-foreground">Anker</span>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeTier("finish", finish.id!, tier.id!)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Label className="text-[10px]">Markup %</Label>
                                        <Input
                                          type="number"
                                          className="w-20 h-8"
                                          value={tier.markup_pct ?? 0}
                                          onChange={(e) => updateTier("finish", finish.id!, tier.id!, { markup_pct: Number(e.target.value) || 0 })}
                                        />
                                        <CenterSlider
                                          value={[Number(tier.markup_pct) || 0]}
                                          onValueChange={(value) => {
                                            const nextValue = value[0];
                                            if (interpolationEnabled && isBetweenAnchors && !tier.is_anchor) {
                                              if (nextValue !== 0 && rawInterpolatedBase != null) {
                                                updateTier("finish", finish.id!, tier.id!, {
                                                  markup_pct: nextValue,
                                                  price_per_m2: rawInterpolatedBase
                                                });
                                                return;
                                              }
                                              if (nextValue === 0) {
                                                updateTier("finish", finish.id!, tier.id!, { markup_pct: 0, price_per_m2: 0 });
                                                return;
                                              }
                                            }
                                            updateTier("finish", finish.id!, tier.id!, { markup_pct: nextValue });
                                          }}
                                          min={-100}
                                          max={200}
                                          step={1}
                                          className="flex-1"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <Button variant="outline" size="sm" onClick={() => addTier("finish", finish.id!)} className="mt-2">
                                <Plus className="h-4 w-4 mr-2" /> Tilføj tier
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Gemte efterbehandlinger</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleCatalogSearch("finishes")}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                          {(catalogSearchOpen.finishes || catalogSearchQuery.finishes) && (
                            <Input
                              value={catalogSearchQuery.finishes}
                              onChange={(e) => updateCatalogSearch("finishes", e.target.value)}
                              placeholder="Søg..."
                              className="h-8 w-40"
                            />
                          )}
                          <Select
                            value={catalogTagFilter.finishes || "all"}
                            onValueChange={(value) => updateCatalogTagFilter("finishes", value === "all" ? "" : value)}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue placeholder="Tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle tags</SelectItem>
                              {tagOptionsByType.finishes.map((tag) => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {visibleFinishes.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen gemte efterbehandlinger endnu</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {visibleFinishes.slice(0, MAX_VISIBLE_CATALOG).map((finish) => {
                            const settings = valueSettingsById[finish.id || ""] || {};
                            const thumbnailUrl = settings.customImage || finish.thumbnail_url || "";
                            const isSelected = expandedFinishId === finish.id;
                            return (
                              <button
                                key={`saved-${finish.id}`}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/40"
                                )}
                                onClick={() => handleCatalogCardClick("finishes", finish.id!)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {thumbnailUrl && (
                                    <img src={thumbnailUrl} className="w-7 h-7 rounded object-cover" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{finish.name}</div>
                                    {finish.group_label && (
                                      <div className={cn("text-[11px] truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>{finish.group_label}</div>
                                    )}
                                  </div>
                                </div>
                                <div className={cn("flex items-center gap-1", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerCatalogUpload("finishes", finish.id!);
                                    }}
                                  >
                                    <ImageIcon className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={!thumbnailUrl}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clearCatalogThumbnail("finishes", finish.id!);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {visibleFinishes.length > MAX_VISIBLE_CATALOG && (
                        <div className="text-[11px] text-muted-foreground">
                          Viser {MAX_VISIBLE_CATALOG} af {visibleFinishes.length} efterbehandlinger
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeCatalogSection === "products" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Produkter</Label>
                        <p className="text-xs text-muted-foreground">Produkterne kan prissættes pr. m² eller som fast pris pr. mængde.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newProduct = createProduct();
                          setProducts((prev) => [...prev, newProduct]);
                          setExpandedProductId(newProduct.id || null);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Opret nyt
                      </Button>
                    </div>

                    {expandedProductId && (() => {
                      const productItem = products.find((p) => p.id === expandedProductId);
                      if (!productItem) return null;
                      const productIndex = products.findIndex((p) => p.id === productItem.id);
                      return (
                        <div key={productItem.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">#{productIndex + 1}</Badge>
                              <Input
                                value={productItem.name}
                                onChange={(e) => updateProduct(productItem.id!, { name: e.target.value })}
                                placeholder="Produkt navn"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setExpandedProductId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setProducts((prev) => prev.filter((p) => p.id !== productItem.id));
                                  setExpandedProductId(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Gruppe/tag</Label>
                              <Input
                                value={productItem.group_label ?? ""}
                                onChange={(e) => updateProduct(productItem.id!, { group_label: e.target.value })}
                                placeholder="F.eks. Banner"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Pris-mode</Label>
                              <Select
                                value={productItem.pricing_mode}
                                onValueChange={(value) => updateProduct(productItem.id!, { pricing_mode: value as "fixed" | "per_m2" })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="per_m2">Pris pr. m²</SelectItem>
                                  <SelectItem value="fixed">Fast pris pr. mængde</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Produkt markup (%)</Label>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  className="w-20"
                                  value={productItem.markup_pct ?? 0}
                                  onChange={(e) => updateProduct(productItem.id!, { markup_pct: Number(e.target.value) || 0 })}
                                />
                                <CenterSlider
                                  value={[Number(productItem.markup_pct) || 0]}
                                  onValueChange={(value) => updateProduct(productItem.id!, { markup_pct: value[0] })}
                                  min={-100}
                                  max={200}
                                  step={1}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>

                          {productItem.pricing_mode === "fixed" ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-xs">Initial pris (pr. ordre)</Label>
                                  <Input
                                    type="number"
                                    value={productItem.initial_price ?? 0}
                                    onChange={(e) => updateProduct(productItem.id!, { initial_price: Number(e.target.value) || 0 })}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Fast pris pr. mængde hentes fra tabellen nedenfor og lægges til initial prisen.
                                </div>
                              </div>
                              {sortedQuantities.length ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Mængde</TableHead>
                                      <TableHead>Pris</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sortedQuantities.map((qty) => {
                                      const fixedPrice = (productItem.fixed_prices || []).find((fp) => fp.quantity === qty)?.price ?? 0;
                                      return (
                                        <TableRow key={qty}>
                                          <TableCell>{qty}</TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              value={fixedPrice}
                                              onChange={(e) => updateProductFixedPrice(productItem.id!, qty, Number(e.target.value) || 0)}
                                              className="h-8"
                                          />
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-xs text-muted-foreground">Tilføj antal under “Antal” for at udfylde priser.</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-xs">Interpolation</Label>
                                  <p className="text-[11px] text-muted-foreground">Lineær mellem ankerpunkter</p>
                                </div>
                                <Switch
                                  checked={productItem.interpolation_enabled ?? true}
                                  onCheckedChange={(checked) => updateProduct(productItem.id!, { interpolation_enabled: checked })}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">Pris pr. m² (tiers)</Label>
                                <div className="space-y-3">
                                  {(productItem.tiers || []).map((tier) => {
                                    const itemMarkup = Number(productItem.markup_pct) || 0;
                                    const interpolationEnabled = productItem.interpolation_enabled ?? true;
                                    const { isBetweenAnchors, rawInterpolatedBase } = getInterpolationInfo(
                                      productItem.tiers || [],
                                      tier.from_m2,
                                      interpolationEnabled
                                    );
                                    const isOverride = interpolationEnabled && !tier.is_anchor && isBetweenAnchors && Number(tier.markup_pct) !== 0;
                                    const useInterpolated = interpolationEnabled && !tier.is_anchor && isBetweenAnchors && !isOverride;
                                    const displayBase = useInterpolated ? (rawInterpolatedBase ?? 0) : (tier.price_per_m2 || 0);
                                    const displayMarkup = useInterpolated ? 0 : (tier.markup_pct ?? 0);
                                    const displayPrice = displayBase * (1 + displayMarkup / 100) * (1 + itemMarkup / 100);
                                    const displayValue = displayBase > 0 || useInterpolated ? Math.round(displayPrice) : "";
                                    const totalMultiplier = (1 + (tier.markup_pct ?? 0) / 100) * (1 + itemMarkup / 100);

                                    return (
                                      <div key={tier.id} className="border rounded-md p-2 space-y-2">
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                          <Input
                                            type="number"
                                            value={tier.from_m2}
                                            onChange={(e) => updateProductTier(productItem.id!, tier.id!, { from_m2: Number(e.target.value) || 0 })}
                                            placeholder="Fra m²"
                                          />
                                          <Input
                                            type="number"
                                            value={tier.to_m2 ?? ""}
                                            onChange={(e) => updateProductTier(productItem.id!, tier.id!, { to_m2: e.target.value ? Number(e.target.value) : null })}
                                            placeholder="Til m²"
                                          />
                                          <Input
                                            type="number"
                                            value={displayValue}
                                            onChange={(e) => {
                                              const finalPrice = Number(e.target.value) || 0;
                                              const basePrice = totalMultiplier ? finalPrice / totalMultiplier : 0;
                                              updateProductTier(productItem.id!, tier.id!, { price_per_m2: basePrice });
                                            }}
                                            placeholder="Pris pr. m²"
                                          />
                                          <div className="flex items-center gap-2">
                                            <Switch
                                              checked={tier.is_anchor ?? true}
                                              onCheckedChange={(checked) => updateProductTier(productItem.id!, tier.id!, { is_anchor: checked })}
                                            />
                                            <span className="text-xs text-muted-foreground">Anker</span>
                                          </div>
                                          <Button variant="ghost" size="icon" onClick={() => removeProductTier(productItem.id!, tier.id!)}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Label className="text-[10px]">Markup %</Label>
                                          <Input
                                            type="number"
                                            className="w-20 h-8"
                                            value={tier.markup_pct ?? 0}
                                            onChange={(e) => updateProductTier(productItem.id!, tier.id!, { markup_pct: Number(e.target.value) || 0 })}
                                          />
                                          <CenterSlider
                                            value={[Number(tier.markup_pct) || 0]}
                                            onValueChange={(value) => {
                                              const nextValue = value[0];
                                              if (interpolationEnabled && isBetweenAnchors && !tier.is_anchor) {
                                                if (nextValue !== 0 && rawInterpolatedBase != null) {
                                                  updateProductTier(productItem.id!, tier.id!, {
                                                    markup_pct: nextValue,
                                                    price_per_m2: rawInterpolatedBase
                                                  });
                                                  return;
                                                }
                                                if (nextValue === 0) {
                                                  updateProductTier(productItem.id!, tier.id!, { markup_pct: 0, price_per_m2: 0 });
                                                  return;
                                                }
                                              }
                                              updateProductTier(productItem.id!, tier.id!, { markup_pct: nextValue });
                                            }}
                                            min={-100}
                                            max={200}
                                            step={1}
                                            className="flex-1"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => addProductTier(productItem.id!)} className="mt-2">
                                  <Plus className="h-4 w-4 mr-2" /> Tilføj tier
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Gemte produkter</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleCatalogSearch("products")}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                          {(catalogSearchOpen.products || catalogSearchQuery.products) && (
                            <Input
                              value={catalogSearchQuery.products}
                              onChange={(e) => updateCatalogSearch("products", e.target.value)}
                              placeholder="Søg..."
                              className="h-8 w-40"
                            />
                          )}
                          <Select
                            value={catalogTagFilter.products || "all"}
                            onValueChange={(value) => updateCatalogTagFilter("products", value === "all" ? "" : value)}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue placeholder="Tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle tags</SelectItem>
                              {tagOptionsByType.products.map((tag) => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {visibleProducts.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen gemte produkter endnu</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {visibleProducts.slice(0, MAX_VISIBLE_CATALOG).map((productItem) => {
                            const settings = valueSettingsById[productItem.id || ""] || {};
                            const thumbnailUrl = settings.customImage || productItem.thumbnail_url || "";
                            const isSelected = expandedProductId === productItem.id;
                            return (
                              <button
                                key={`saved-${productItem.id}`}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/40"
                                )}
                                onClick={() => handleCatalogCardClick("products", productItem.id!)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {thumbnailUrl && (
                                    <img src={thumbnailUrl} className="w-7 h-7 rounded object-cover" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{productItem.name}</div>
                                    {productItem.group_label && (
                                      <div className={cn("text-[11px] truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>{productItem.group_label}</div>
                                    )}
                                  </div>
                                </div>
                                <div className={cn("flex items-center gap-1", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerCatalogUpload("products", productItem.id!);
                                    }}
                                  >
                                    <ImageIcon className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={!thumbnailUrl}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clearCatalogThumbnail("products", productItem.id!);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {visibleProducts.length > MAX_VISIBLE_CATALOG && (
                        <div className="text-[11px] text-muted-foreground">
                          Viser {MAX_VISIBLE_CATALOG} af {visibleProducts.length} produkter
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Antal</CardTitle>
                <CardDescription className="text-xs">
                  Vælg hvilke mængder der skal indgå i prislisten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {defaultQuantities.map((qty) => (
                    <button
                      key={qty}
                      onClick={() => toggleQuantity(qty)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                        (config.quantities || []).includes(qty)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 max-w-xs">
                  <Input
                    type="number"
                    placeholder="Brugerdefineret antal"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(e.target.value)}
                    className="h-9"
                    onKeyDown={(e) => e.key === "Enter" && addCustomQuantity()}
                  />
                  <Button size="sm" variant="outline" onClick={addCustomQuantity}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(config.quantities || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sortedQuantities.map((qty) => (
                      <Badge key={qty} variant="secondary" className="gap-1">
                        {qty}
                        <button onClick={() => toggleQuantity(qty)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card ref={layoutRef}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Prisliste Layout
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleResetLayoutConfig}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Nulstil layout
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  Organiser materialer, efterbehandling og produkter i rækker og sektioner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="flex gap-4 min-h-[380px]">
                <div
                  className={cn(
                    "w-1/4 min-w-[240px] p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col gap-3",
                    selectedTarget?.type === "vertical" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-muted bg-muted/10 hover:border-primary/50"
                  )}
                  onClick={() => setSelectedTarget({ type: "vertical", id: verticalAxis.id })}
                >
                  <div>
                    <Label className="text-sm font-bold block">Lodret akse</Label>
                    <span className="text-[10px] text-muted-foreground uppercase">Værdier</span>
                  </div>
                  <Select
                    value={verticalAxis.sectionType}
                    onValueChange={(value) => setVerticalAxis((prev) => ({
                      ...prev,
                      sectionType: value as LayoutSectionType,
                      valueIds: [],
                      valueSettings: {}
                    }))}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="materials">Materialer</SelectItem>
                      <SelectItem value="finishes">Efterbehandling</SelectItem>
                      <SelectItem value="products">Produkter</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <Input
                      placeholder="Titel"
                      value={verticalAxis.title || ""}
                      onChange={(e) => setVerticalAxis((prev) => ({ ...prev, title: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-xs"
                    />
                    <Input
                      placeholder="Beskrivelse"
                      value={verticalAxis.description || ""}
                      onChange={(e) => setVerticalAxis((prev) => ({ ...prev, description: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-xs text-muted-foreground"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1 p-1 min-h-[60px]">
                    {(verticalAxis.valueIds || []).map((id) => {
                      const value = getValuesForType(verticalAxis.sectionType).find((v) => v.id === id);
                      if (!value) return null;
                      const settings = verticalAxis.valueSettings?.[id];
                      const thumbnailUrl = settings?.customImage || value.thumbnail_url;
                      return (
                        <div key={id} className="group flex items-center justify-between p-1 rounded border bg-card/50 text-[10px]">
                          <div className="flex items-center gap-2 truncate">
                            {settings?.showThumbnail && thumbnailUrl && (
                              <img src={thumbnailUrl} className="w-4 h-4 rounded object-cover" />
                            )}
                            <span className="truncate">{value.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant={settings?.showThumbnail ? "default" : "ghost"}
                              size="icon"
                              className="h-4 w-4"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVerticalThumbnail(id);
                              }}
                            >
                              <ImageIcon className="h-2.5 w-2.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerUpload("vertical", verticalAxis.id, id);
                              }}
                            >
                              <CloudUpload className="h-2.5 w-2.5" />
                            </Button>
                            <div
                              className="h-4 w-4 flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeVerticalValue(id);
                              }}
                            >
                              <X className="h-2.5 w-2.5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!verticalAxis.valueIds || verticalAxis.valueIds.length === 0) && (
                      <span className="text-[10px] text-muted-foreground italic p-1 text-center mt-2">
                        Klik for at vælge
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  {layoutRows.map((row, rowIndex) => (
                    <div key={row.id} className="border rounded-lg p-3 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Række {rowIndex + 1}</Label>
                        {layoutRows.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLayoutRows((prev) => prev.filter((r) => r.id !== row.id))}
                          >
                            Fjern række
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          placeholder="Række titel"
                          value={row.title || ""}
                          onChange={(e) => setLayoutRows((prev) => prev.map((r) => r.id === row.id ? { ...r, title: e.target.value } : r))}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Beskrivelse"
                          value={row.description || ""}
                          onChange={(e) => setLayoutRows((prev) => prev.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                          className="h-7 text-xs text-muted-foreground"
                        />
                      </div>
                      <div className={cn(
                        "grid gap-3",
                        row.sections.length === 1 && "grid-cols-1",
                        row.sections.length === 2 && "grid-cols-1 md:grid-cols-2",
                        row.sections.length >= 3 && "grid-cols-1 md:grid-cols-3"
                      )}>
                        {row.sections.map((section) => (
                          <div
                            key={section.id}
                            className={cn(
                              "border rounded-lg p-2 bg-card/50 space-y-2 cursor-pointer",
                              selectedTarget?.type === "section" && selectedTarget.id === section.id
                                ? "border-primary ring-1 ring-primary"
                                : "border-muted hover:border-primary/50"
                            )}
                            onClick={() => setSelectedTarget({ type: "section", id: section.id })}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={section.sectionType}
                                onValueChange={(value) => {
                                  setLayoutRows((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      sections: r.sections.map((s) => {
                                        if (s.id !== section.id) return s;
                                        return {
                                          ...s,
                                          sectionType: value as LayoutSectionType,
                                          valueIds: [],
                                          valueSettings: {}
                                        };
                                      })
                                    }))
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="materials">Materialer</SelectItem>
                                  <SelectItem value="finishes">Efterbehandling</SelectItem>
                                  <SelectItem value="products">Produkter</SelectItem>
                                </SelectContent>
                              </Select>
                              <Label className="text-[10px] text-muted-foreground">Regel:</Label>
                              <Select
                                value={section.selection_mode || "required"}
                                onValueChange={(value) => {
                                  setLayoutRows((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      sections: r.sections.map((s) => s.id === section.id ? { ...s, selection_mode: value as SelectionMode } : s)
                                    }))
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="required">Påkrævet</SelectItem>
                                  <SelectItem value="optional">Valgfri</SelectItem>
                                </SelectContent>
                              </Select>
                              <Label className="text-[10px] text-muted-foreground">Visning:</Label>
                              <Select
                                value={section.ui_mode || "buttons"}
                                onValueChange={(value) => {
                                  setLayoutRows((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      sections: r.sections.map((s) => s.id === section.id ? { ...s, ui_mode: value as LayoutDisplayMode } : s)
                                    }))
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="buttons">Knapper</SelectItem>
                                  <SelectItem value="dropdown">Dropdown</SelectItem>
                                  <SelectItem value="checkboxes">Checkboxes</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLayoutRows((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      sections: r.sections.filter((s) => s.id !== section.id)
                                    }))
                                  );
                                }}
                              >
                                Fjern
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <Input
                                placeholder="Sektion titel"
                                value={section.title || ""}
                                onChange={(e) => {
                                  setLayoutRows((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      sections: r.sections.map((s) => s.id === section.id ? { ...s, title: e.target.value } : s)
                                    }))
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs"
                              />
                              <Input
                                placeholder="Beskrivelse"
                                value={section.description || ""}
                                onChange={(e) => {
                                  setLayoutRows((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      sections: r.sections.map((s) => s.id === section.id ? { ...s, description: e.target.value } : s)
                                    }))
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs text-muted-foreground"
                              />
                            </div>

                            <div className="flex-1 flex flex-col gap-1 p-1 min-h-[60px]">
                              {(section.valueIds || []).map((id) => {
                                const value = getValuesForType(section.sectionType).find((v) => v.id === id);
                                if (!value) return null;
                                const settings = section.valueSettings?.[id];
                                const thumbnailUrl = settings?.customImage || value.thumbnail_url;
                                return (
                                  <div key={id} className="group flex items-center justify-between p-1 rounded border bg-card/50 text-[10px]">
                                    <div className="flex items-center gap-2 truncate">
                                      {settings?.showThumbnail && thumbnailUrl && (
                                        <img src={thumbnailUrl} className="w-4 h-4 rounded object-cover" />
                                      )}
                                      <span className="truncate">{value.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant={settings?.showThumbnail ? "default" : "ghost"}
                                        size="icon"
                                        className="h-4 w-4"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSectionThumbnail(section.id, id);
                                        }}
                                      >
                                        <ImageIcon className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-4"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerUpload("section", section.id, id);
                                        }}
                                      >
                                        <CloudUpload className="h-2.5 w-2.5" />
                                      </Button>
                                      <div
                                        className="h-4 w-4 flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeSectionValue(section.id, id);
                                        }}
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {(!section.valueIds || section.valueIds.length === 0) && (
                                <span className="text-[10px] text-muted-foreground italic p-1 text-center mt-2">
                                  Klik for at vælge
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setLayoutRows((prev) =>
                            prev.map((r) => {
                              if (r.id !== row.id) return r;
                              return {
                                ...r,
                                sections: [
                                  ...r.sections,
                                  { id: `section-${Date.now()}`, sectionType: "products", ui_mode: "buttons", selection_mode: "required", valueIds: [] }
                                ]
                              };
                            })
                          );
                        }}
                      >
                        <Plus className="h-3 w-3 mr-2" /> Tilføj sektion
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setLayoutRows((prev) => [
                      ...prev,
                      {
                        id: `row-${Date.now()}`,
                        sections: [{ id: `section-${Date.now()}`, sectionType: "products", ui_mode: "buttons", selection_mode: "required", valueIds: [] }]
                      }
                    ])}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Tilføj ny række
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Prisliste forhåndsvisning
                </CardTitle>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 justify-center flex-1 min-w-[260px]">
                    <Label className="text-[11px] text-muted-foreground">Master Markup</Label>
                    <Input
                      type="number"
                      className="h-8 w-16"
                      value={config.global_markup_pct}
                      onChange={(e) => setConfig((prev) => ({ ...prev, global_markup_pct: Number(e.target.value) || 0 }))}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">-100%</span>
                      <CenterSlider
                        value={[Number(config.global_markup_pct) || 0]}
                        onValueChange={(value) => setConfig((prev) => ({ ...prev, global_markup_pct: value[0] }))}
                        min={-100}
                        max={200}
                        step={1}
                        className="w-72"
                      />
                      <span className="text-[10px] text-muted-foreground">+200%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground">Afrunding</Label>
                    <Select
                      value={String(config.rounding_step)}
                      onValueChange={(value) => setConfig((prev) => ({ ...prev, rounding_step: parseInt(value, 10) }))}
                    >
                      <SelectTrigger className="h-8 w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 kr</SelectItem>
                        <SelectItem value="2">2 kr</SelectItem>
                        <SelectItem value="5">5 kr</SelectItem>
                        <SelectItem value="10">10 kr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleResetPriceListConfig}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Nulstil prisliste
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs">Kontrollér layout og prisberegning før udgivelse.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Længde (cm)</Label>
                  <Input
                    type="number"
                    value={previewWidthMm ? previewWidthMm / 10 : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPreviewWidthMm(raw === "" ? 0 : Number(raw) * 10);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Højde (cm)</Label>
                  <Input
                    type="number"
                    value={previewHeightMm ? previewHeightMm / 10 : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPreviewHeightMm(raw === "" ? 0 : Number(raw) * 10);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Areal (m²)</Label>
                  <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md text-xs">
                    {(previewWidthMm * previewHeightMm / 1_000_000).toFixed(2)}
                  </div>
                </div>
              </div>

              {previewResult && (
                <div className="border rounded-lg p-3 bg-muted/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Pris (første mængde)</div>
                    <div className="text-lg font-semibold">{previewResult.totalPrice.toFixed(0)} kr</div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>{previewResult.totalAreaM2.toFixed(2)} m² total</div>
                    <div>Materiale: {previewResult.materialPricePerM2.toFixed(0)} kr/m²</div>
                    {previewResult.finishPricePerM2 > 0 && (
                      <div>Efterbehandling: {previewResult.finishPricePerM2.toFixed(0)} kr/m²</div>
                    )}
                    {previewResult.productPricePerM2 > 0 && (
                      <div>Produkt: {previewResult.productPricePerM2.toFixed(0)} kr/m²</div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {layoutRows.map((row, rowIndex) => (
                  <div key={row.id} className="space-y-2 pb-3 border-b last:border-b-0">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Række {rowIndex + 1}</Label>
                      {row.title && <div className="text-xs font-medium">{row.title}</div>}
                      {row.description && <div className="text-[11px] text-muted-foreground">{row.description}</div>}
                    </div>
                    <div className={cn(
                      "grid gap-3",
                      row.sections.length === 1 && "grid-cols-1",
                      row.sections.length === 2 && "grid-cols-2",
                      row.sections.length >= 3 && "grid-cols-3"
                    )}>
                      {row.sections.map((section, sectionIndex) => {
                        const values = getValuesForType(section.sectionType).filter((v) => section.valueIds?.includes(v.id));
                        const selectionMode = section.selection_mode || "required";
                        const selectedValue = selectionMode === "optional"
                          ? (selectedSectionValues[section.id] || "")
                          : (selectedSectionValues[section.id] || values[0]?.id || "");
                        const displayMode = section.ui_mode || "buttons";

                        const defaultLabel = section.sectionType === "materials"
                          ? "Materialer"
                          : section.sectionType === "finishes"
                            ? "Efterbehandling"
                            : "Produkter";
                        const renderLabel = section.title || defaultLabel;

                        return (
                          <div
                            key={section.id}
                            className={cn(
                              "space-y-1.5 p-2 rounded bg-muted/20",
                              sectionIndex > 0 && "border-l-2 border-primary/20 pl-3"
                            )}
                          >
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              {renderLabel}
                            </span>
                            {section.description && (
                              <span className="text-[10px] text-muted-foreground">{section.description}</span>
                            )}

                            {values.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground italic">Ingen værdier tilføjet</span>
                            ) : displayMode === "dropdown" ? (
                              <Select
                                value={selectedValue || (selectionMode === "optional" ? "__none__" : "")}
                                onValueChange={(value) => {
                                  if (selectionMode === "optional" && value === "__none__") {
                                    setSelectedSectionValues((prev) => {
                                      const next = { ...prev };
                                      delete next[section.id];
                                      return next;
                                    });
                                    return;
                                  }
                                  setSelectedSectionValues((prev) => ({ ...prev, [section.id]: value }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectionMode === "optional" && (
                                    <SelectItem value="__none__">Ingen</SelectItem>
                                  )}
                                  {values.map((v) => {
                                    const settings = section.valueSettings?.[v.id];
                                    const thumbnailUrl = settings?.customImage || v.thumbnail_url;
                                    return (
                                      <SelectItem key={v.id} value={v.id}>
                                        <div className="flex items-center gap-2">
                                          {settings?.showThumbnail && thumbnailUrl && (
                                            <img src={thumbnailUrl} className="w-5 h-5 rounded object-cover" />
                                          )}
                                          {v.name}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            ) : displayMode === "checkboxes" ? (
                              <div className="space-y-1">
                                {values.map((v) => {
                                  const settings = section.valueSettings?.[v.id];
                                  const thumbnailUrl = settings?.customImage || v.thumbnail_url;
                                  const isSelected = selectedValue === v.id;
                                  return (
                                    <label
                                      key={v.id}
                                      className={cn(
                                        "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                                        isSelected ? "bg-primary/10 border-primary" : "border-muted"
                                      )}
                                      onClick={() => {
                                        if (selectionMode === "optional" && isSelected) {
                                          setSelectedSectionValues((prev) => {
                                            const next = { ...prev };
                                            delete next[section.id];
                                            return next;
                                          });
                                          return;
                                        }
                                        setSelectedSectionValues((prev) => ({ ...prev, [section.id]: v.id }));
                                      }}
                                    >
                                      <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                      {settings?.showThumbnail && thumbnailUrl && (
                                        <img src={thumbnailUrl} className="w-5 h-5 rounded object-cover" />
                                      )}
                                      <span className="font-medium flex-1">{v.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {values.map((v) => {
                                  const settings = section.valueSettings?.[v.id];
                                  const thumbnailUrl = settings?.customImage || v.thumbnail_url;
                                  const isSelected = selectedValue === v.id;
                                  return (
                                    <Button
                                      key={v.id}
                                      size="sm"
                                      variant={isSelected ? "default" : "outline"}
                                      onClick={() => {
                                        if (selectionMode === "optional" && isSelected) {
                                          setSelectedSectionValues((prev) => {
                                            const next = { ...prev };
                                            delete next[section.id];
                                            return next;
                                          });
                                          return;
                                        }
                                        setSelectedSectionValues((prev) => ({ ...prev, [section.id]: v.id }));
                                      }}
                                      className={cn("h-7 text-xs", isSelected && "bg-primary hover:bg-primary/90")}
                                    >
                                      {settings?.showThumbnail && thumbnailUrl && (
                                        <img src={thumbnailUrl} className="w-4 h-4 rounded object-cover mr-2" />
                                      )}
                                      {v.name}
                                    </Button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {sortedQuantities.length === 0
                    ? "Ingen antal valgt endnu"
                    : `Viser ${startCol + 1}-${Math.min(startCol + PREVIEW_COLS, sortedQuantities.length)} af ${sortedQuantities.length} antal`}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewAmountPage((p) => Math.max(0, p - 1))}
                    disabled={previewAmountPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewAmountPage((p) => p + 1)}
                    disabled={startCol + PREVIEW_COLS >= sortedQuantities.length}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">
                        {(verticalAxis.title
                          ? verticalAxis.title
                          : verticalAxis.sectionType === "materials"
                            ? "Materiale"
                            : verticalAxis.sectionType === "finishes"
                              ? "Efterbehandling"
                              : "Produkt")} / Antal
                      </TableHead>
                      {visibleQuantities.map((qty) => (
                        <TableHead key={qty} className="text-center font-medium">
                          {qty} stk
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleQuantities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={1} className="text-center text-muted-foreground py-8">
                          Tilføj antal for at se priser her.
                        </TableCell>
                      </TableRow>
                    ) : getValuesForType(verticalAxis.sectionType).filter((v) => verticalAxis.valueIds?.includes(v.id)).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleQuantities.length + 1} className="text-center text-muted-foreground py-8">
                          Tilføj værdier til lodret akse for at se priser her.
                        </TableCell>
                      </TableRow>
                    ) : (
                      getValuesForType(verticalAxis.sectionType)
                        .filter((v) => verticalAxis.valueIds?.includes(v.id))
                        .map((verticalValue) => {
                          const isSelected = selectedSectionValues[verticalAxis.id] === verticalValue.id;
                          const settings = verticalAxis.valueSettings?.[verticalValue.id];
                          const thumbnailUrl = settings?.customImage || verticalValue.thumbnail_url;
                          return (
                            <TableRow
                              key={verticalValue.id}
                              className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                              onClick={() => setSelectedSectionValues((prev) => ({ ...prev, [verticalAxis.id]: verticalValue.id }))}
                            >
                              <TableCell className={cn("font-medium", isSelected && "text-primary")}>
                                <div className="flex items-center gap-2">
                                  {settings?.showThumbnail && thumbnailUrl && (
                                    <img src={thumbnailUrl} className="w-5 h-5 object-cover rounded" />
                                  )}
                                  <span>{verticalValue.name}</span>
                                  {isSelected && <span className="text-xs">(valgt)</span>}
                                </div>
                              </TableCell>
                              {visibleQuantities.map((qty) => {
                                const resolveSelection = (type: LayoutSectionType) => {
                                  if (verticalAxis.sectionType === type) return verticalValue.id;
                                  const section = layoutRows.flatMap((r) => r.sections).find((s) => s.sectionType === type);
                                  if (!section) return null;
                                  const selected = selectedSectionValues[section.id];
                                  if (section.selection_mode === "optional") {
                                    return selected || null;
                                  }
                                  return selected || section.valueIds?.[0] || null;
                                };
                                const materialId = resolveSelection("materials");
                                const finishId = resolveSelection("finishes");
                                const productId = resolveSelection("products");

                                const material = materials.find((m) => m.id === materialId);
                                if (!material) {
                                  return (
                                    <TableCell key={`${verticalValue.id}-${qty}`} className="text-center text-muted-foreground">
                                      -
                                    </TableCell>
                                  );
                                }
                                const finish = finishes.find((f) => f.id === finishId) || null;
                                const productSelection = products.find((p) => p.id === productId) || null;
                                const result = calculateStorformatPrice({
                                  widthMm: previewWidthMm,
                                  heightMm: previewHeightMm,
                                  quantity: qty,
                                  material,
                                  finish,
                                  product: productSelection,
                                  config
                                });
                                return (
                                  <TableCell key={`${verticalValue.id}-${qty}`} className="text-center">
                                    {result.totalPrice.toFixed(0)} kr
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </div>

              {previewResult?.splitInfo?.isSplit && (
                <p className="text-xs text-amber-600">
                  Overskrider max størrelse. Varen deles i {previewResult.splitInfo.totalPieces} felter ({previewResult.splitInfo.piecesWide} × {previewResult.splitInfo.piecesHigh}).
                </p>
              )}
            </CardContent>
          </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prisbank & Udgivelse</CardTitle>
                <CardDescription className="text-xs">Gem i bank eller udgiv ændringerne til produktet.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setShowSaveDialog(true)}
                    >
                      <Save className="h-4 w-4 mr-2" /> Gem i bank
                    </Button>
                    <Button variant="outline" onClick={() => setShowLoadDialog(true)}>
                      <Library className="h-4 w-4 mr-2" /> Indlæs
                    </Button>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Gemmer..." : `Gem storformat for ${productName}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Gem i storformat bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Navn</Label>
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="F.eks. Storformat V1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Annuller</Button>
            <Button onClick={handleSaveTemplate}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Indlæs storformat skabelon</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Alle prislister</Label>
              <Switch
                checked={showAllTemplates}
                onCheckedChange={(checked) => {
                  setShowAllTemplates(checked);
                  if (checked) fetchAllTemplates();
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {showAllTemplates ? "Viser alle storformat skabeloner" : "Viser kun dette produkt"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {(showAllTemplates ? allTemplates : templates).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Ingen skabeloner fundet.</div>
            ) : (
              (showAllTemplates ? allTemplates : templates).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                      {showAllTemplates && t.product?.name ? ` • ${t.product.name}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={showAllTemplates && t.product_id !== productId}
                      onClick={() => {
                        handleLoadTemplate(t);
                        setShowLoadDialog(false);
                      }}
                    >
                      <Wand2 className="h-3 w-3 mr-1" /> Indlæs
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteTemplate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
