import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CenterSlider } from "@/components/ui/center-slider";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Save, Library, Wand2, CloudUpload, ImageIcon, LayoutGrid, RotateCcw, ChevronLeft, ChevronRight, X, Search, Link2, RefreshCw, Settings2, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { TagInput } from "@/components/ui/tag-input";
import { DesignLibrarySelector } from "./DesignLibrarySelector";
import { supabase } from "@/integrations/supabase/client";
import {
  type StorformatConfig,
  type StorformatFinish,
  type StorformatMaterial,
  type StorformatProduct,
  type StorformatTier,
  calculateStorformatM2Price
} from "@/utils/storformatPricing";
import {
  isProductAssignedToSite,
  isSiteExclusiveProduct,
} from "@/lib/sites/productSiteFrontends";
import { cn } from "@/lib/utils";
import { AddonLibraryImportDialog } from "./AddonLibraryImportDialog";
import { useProductAddons } from "@/hooks/useProductAddons";
// SmartM2PriceGenerator and UnifiedPriceGenerator removed - pricing is now inline
import type { ProductPricingType } from "@/lib/storformat-pricing/types";
import type { StorformatFinishPrice, StorformatM2Price, LayoutDisplayMode as LayoutDisplayModeType, PictureSizeMode } from "@/lib/storformat-pricing/types";
import { PICTURE_SIZES } from "@/lib/storformat-pricing/types";

type StorformatManagerProps = {
  productId: string;
  tenantId: string;
  productName: string;
  pricingType?: string | null;
  onPricingTypeChange?: (type: string) => void;
};

type LayoutSectionType = "materials" | "finishes" | "products";
// buttons, dropdown, checkboxes (classic) + small, medium, large, xl (picture sizes)
type LayoutDisplayMode = LayoutDisplayModeType;
type SelectionMode = "required" | "optional";

type MaterialLibraryItem = {
  id: string;
  name: string;
  max_width_mm: number | null;
  max_height_mm: number | null;
  tags?: string[] | null;
  created_at?: string | null;
};

type FinishLibraryItem = {
  id: string;
  name: string;
  tags?: string[] | null;
  created_at?: string | null;
};

type ProductLibraryItem = {
  id: string;
  name: string;
  tags?: string[] | null;
  created_at?: string | null;
};

type LibraryTemplateFallbackRow = {
  id: string;
  name: string;
  category: string | null;
  width_mm: number | null;
  height_mm: number | null;
};

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

type M2PriceDraft = {
  id?: string;
  material_id: string;
  from_m2: number;
  to_m2?: number | null;
  price_per_m2: number;
  is_anchor: boolean;
};

type FinishPriceDraft = {
  pricing_mode: "fixed" | "per_m2";
  fixed_price: number;
  price_per_m2: number;
};

type BannerBuilderPricingSelection = {
  activeFinishIds: string[];
  activeProductItemIds: string[];
};

const defaultQuantities = Array.from({ length: 20 }, (_, i) => i + 1);
const PREVIEW_COLS = 10;
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const BANNER_BUILDER_SITE_ID = "banner-builder-pro";
const BANNER_BUILDER_SYNC_SOURCE = "banner-builder-pro-defaults-v1";
const BANNER_BUILDER_DEFAULT_FINISHES = [
  "Ringe / Øskner",
  "Kantforstærkning",
  "Tunnel",
  "Keder",
  "4+4 print",
  "UV-laminering",
];
const EMPTY_BANNER_BUILDER_SELECTION: BannerBuilderPricingSelection = {
  activeFinishIds: [],
  activeProductItemIds: [],
};
const normalizeLibraryName = (value: string) => value.trim().toLowerCase();

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const toUniqueIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const readBannerBuilderSyncSource = (technicalSpecs: unknown): string | null => {
  const specs = asJsonObject(technicalSpecs);
  const siteFrontends = asJsonObject(specs?.site_frontends);
  const buttons = asJsonObject(siteFrontends?.buttons);
  const bySite =
    asJsonObject(buttons?.[BANNER_BUILDER_SITE_ID]) ||
    asJsonObject(siteFrontends?.[BANNER_BUILDER_SITE_ID]);

  const source =
    bySite?.sync_source ||
    bySite?.syncSource ||
    bySite?.source ||
    null;

  return typeof source === "string" ? source : null;
};

const normalizeSiteText = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isBannerBuilderManagedProduct = (
  technicalSpecs: unknown,
  slug: unknown,
): boolean => {
  const hasBannerBuilderSlug = normalizeSiteText(slug).startsWith("banner-builder-");
  if (!hasBannerBuilderSlug) return false;

  return (
    isProductAssignedToSite(technicalSpecs, BANNER_BUILDER_SITE_ID) &&
    isSiteExclusiveProduct(technicalSpecs) &&
    readBannerBuilderSyncSource(technicalSpecs) === BANNER_BUILDER_SYNC_SOURCE
  );
};

const readBannerBuilderPricingSelection = (
  technicalSpecs: unknown,
): BannerBuilderPricingSelection => {
  const specs = asJsonObject(technicalSpecs);
  const siteFrontends = asJsonObject(specs?.site_frontends);
  if (!siteFrontends) return EMPTY_BANNER_BUILDER_SELECTION;

  const buttons = asJsonObject(siteFrontends.buttons);
  const bySite =
    asJsonObject(buttons?.[BANNER_BUILDER_SITE_ID]) ||
    asJsonObject(siteFrontends[BANNER_BUILDER_SITE_ID]);
  const pricing =
    asJsonObject(bySite?.pricing) || asJsonObject(siteFrontends.pricing);

  return {
    activeFinishIds: toUniqueIdArray(
      pricing?.active_finish_ids ?? pricing?.activeFinishIds,
    ),
    activeProductItemIds: toUniqueIdArray(
      pricing?.active_product_item_ids ?? pricing?.activeProductItemIds,
    ),
  };
};

const writeBannerBuilderPricingSelection = (
  technicalSpecs: unknown,
  selection: BannerBuilderPricingSelection,
): Record<string, unknown> => {
  const specs = asJsonObject(technicalSpecs) || {};
  const siteFrontends = asJsonObject(specs.site_frontends) || {};
  const buttons = asJsonObject(siteFrontends.buttons) || {};
  const currentSiteConfig =
    asJsonObject(buttons[BANNER_BUILDER_SITE_ID]) ||
    asJsonObject(siteFrontends[BANNER_BUILDER_SITE_ID]) ||
    {};
  const currentPricing = asJsonObject(currentSiteConfig.pricing) || {};

  return {
    ...specs,
    site_frontends: {
      ...siteFrontends,
      buttons: {
        ...buttons,
        [BANNER_BUILDER_SITE_ID]: {
          ...currentSiteConfig,
          pricing: {
            ...currentPricing,
            active_finish_ids: toUniqueIdArray(selection.activeFinishIds),
            active_product_item_ids: toUniqueIdArray(
              selection.activeProductItemIds,
            ),
          },
        },
      },
      updatedAt: new Date().toISOString(),
    },
  };
};

const createTier = (overrides: Partial<StorformatTier> = {}): StorformatTier => ({
  id: crypto.randomUUID(),
  from_m2: 0,
  to_m2: null,
  price_per_m2: 0,
  is_anchor: false,
  markup_pct: 0,
  ...overrides
});

const createM2Tier = (materialId: string, overrides: Partial<M2PriceDraft> = {}): M2PriceDraft => ({
  id: crypto.randomUUID(),
  material_id: materialId,
  from_m2: 0,
  to_m2: null,
  price_per_m2: 0,
  is_anchor: false,
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
  createTier({ from_m2: 0, to_m2: 1, is_anchor: false }),
  createTier({ from_m2: 1, to_m2: 3, is_anchor: false }),
  createTier({ from_m2: 3, to_m2: 5, is_anchor: false }),
  createTier({ from_m2: 5, to_m2: 10, is_anchor: false }),
  createTier({ from_m2: 10, to_m2: null, is_anchor: false })
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

const normalizeMaterialPatch = (patch: Partial<StorformatMaterial>) => {
  const next = {
    name: patch.name,
    group_label: patch.group_label,
    tags: (patch as any).tags,
    thumbnail_url: patch.thumbnail_url,
    design_library_item_id: (patch as any).design_library_item_id,
    visibility: (patch as any).visibility,
    bleed_mm: (patch as any).bleed_mm,
    safe_area_mm: (patch as any).safe_area_mm,
    max_width_mm: patch.max_width_mm,
    max_height_mm: patch.max_height_mm,
    allow_split: patch.allow_split,
    interpolation_enabled: patch.interpolation_enabled,
    markup_pct: patch.markup_pct
  };
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
};

const normalizeFinishPatch = (patch: Partial<StorformatFinish>) => {
  const next = {
    name: patch.name,
    group_label: patch.group_label,
    tags: (patch as any).tags,
    thumbnail_url: patch.thumbnail_url,
    visibility: (patch as any).visibility,
    pricing_mode: patch.pricing_mode,
    fixed_price_per_unit: patch.fixed_price_per_unit,
    interpolation_enabled: patch.interpolation_enabled,
    markup_pct: patch.markup_pct
  };
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
};

const normalizeProductPatch = (patch: Partial<StorformatProduct>) => {
  const next = {
    name: patch.name,
    group_label: patch.group_label,
    tags: (patch as any).tags,
    thumbnail_url: patch.thumbnail_url,
    visibility: (patch as any).visibility,
    is_template: patch.is_template
  };
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
};

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
    quantities: defaultQuantities,
    pricing_mode: "m2_rates"
  });
  const [customQuantity, setCustomQuantity] = useState("");
  const [materials, setMaterials] = useState<StorformatMaterial[]>([]);
  const [m2Prices, setM2Prices] = useState<M2PriceDraft[]>([]);
  const [finishes, setFinishes] = useState<StorformatFinish[]>([]);
  const [finishPrices, setFinishPrices] = useState<Record<string, FinishPriceDraft>>({});
  const [products, setProducts] = useState<StorformatProduct[]>([]);
  const [activeCatalogSection, setActiveCatalogSection] = useState<LayoutSectionType>("materials");
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [expandedFinishId, setExpandedFinishId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [activeM2MaterialId, setActiveM2MaterialId] = useState<string | null>(null);
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
  const [m2TierAdjustments, setM2TierAdjustments] = useState<Record<string, number>>({});
  const [m2TierAdjustBasePrices, setM2TierAdjustBasePrices] = useState<Record<string, number>>({});
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

  // Library import dialog state
  const [showProductImportDialog, setShowProductImportDialog] = useState(false);
  const productAddons = useProductAddons({ productId, tenantId });
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBannerBuilderProduct, setIsBannerBuilderProduct] = useState(false);
  const [productTechnicalSpecs, setProductTechnicalSpecs] = useState<unknown>(null);
  const [bannerBuilderPricingSelection, setBannerBuilderPricingSelection] =
    useState<BannerBuilderPricingSelection>(EMPTY_BANNER_BUILDER_SELECTION);
  const [savingBannerBuilderSelection, setSavingBannerBuilderSelection] = useState(false);
  const [showMatrixLayoutTools, setShowMatrixLayoutTools] = useState(false);

  // Design library selector state
  const [showDesignLibrarySelector, setShowDesignLibrarySelector] = useState(false);
  const [designLibrarySelectorTarget, setDesignLibrarySelectorTarget] = useState<string | null>(null);
  const materialSaveQueueRef = useRef<Record<string, Partial<StorformatMaterial>>>({});
  const finishSaveQueueRef = useRef<Record<string, Partial<StorformatFinish>>>({});
  const productSaveQueueRef = useRef<Record<string, Partial<StorformatProduct>>>({});
  const materialSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const finishSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const productSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [allTemplates, setAllTemplates] = useState<any[]>([]);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [materialLibrary, setMaterialLibrary] = useState<MaterialLibraryItem[]>([]);
  const [materialLibraryLoading, setMaterialLibraryLoading] = useState(false);
  const [savingMaterialLibrary, setSavingMaterialLibrary] = useState(false);
  const [materialLibrarySearch, setMaterialLibrarySearch] = useState("");
  const [materialLibraryTagFilter, setMaterialLibraryTagFilter] = useState("");
  const [finishLibrary, setFinishLibrary] = useState<FinishLibraryItem[]>([]);
  const [finishLibraryLoading, setFinishLibraryLoading] = useState(false);
  const [savingFinishLibrary, setSavingFinishLibrary] = useState(false);
  const [finishLibrarySearch, setFinishLibrarySearch] = useState("");
  const [finishLibraryTagFilter, setFinishLibraryTagFilter] = useState("");
  const [productLibrary, setProductLibrary] = useState<ProductLibraryItem[]>([]);
  const [productLibraryLoading, setProductLibraryLoading] = useState(false);
  const [savingProductLibrary, setSavingProductLibrary] = useState(false);
  const [productLibrarySearch, setProductLibrarySearch] = useState("");
  const [productLibraryTagFilter, setProductLibraryTagFilter] = useState("");

  // Tag management dialog state
  const [showTagManagementDialog, setShowTagManagementDialog] = useState(false);
  const [tagManagementType, setTagManagementType] = useState<LayoutSectionType>("materials");
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [copyingItemId, setCopyingItemId] = useState<string | null>(null);

  // Global price adjustment slider state per material
  const [globalAdjustPct, setGlobalAdjustPct] = useState(0);
  const [globalAdjustBasePrices, setGlobalAdjustBasePrices] = useState<Record<string, number>>({});

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

    const finishDraft = finish ? getFinishPriceDraft(finish.id!) : null;
    const finishPrice = finishDraft
      ? ({
        pricing_mode: finishDraft.pricing_mode,
        fixed_price: finishDraft.fixed_price,
        price_per_m2: finishDraft.price_per_m2
      } as StorformatFinishPrice)
      : null;

    return calculateStorformatM2Price({
      widthMm: previewWidthMm,
      heightMm: previewHeightMm,
      quantity,
      material,
      materialPrices: getM2PricesForMaterial(material.id! as string) as StorformatM2Price[],
      finish,
      finishPrice,
      product: null,
      config
    });
  }, [previewWidthMm, previewHeightMm, selectedSectionValues, verticalAxis, layoutRows, materials, finishes, products, config, m2Prices, finishPrices]);

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

  const fetchTemplateLibraryFallback = useCallback(
    async (templateType: "material" | "finish" | "product") => {
      if (!tenantId) return [] as LibraryTemplateFallbackRow[];
      try {
        const { data, error } = await supabase
          .from("designer_templates" as any)
          .select("id, name, category, width_mm, height_mm")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .eq("template_type", templateType)
          .order("name");
        if (error) throw error;
        return (data || []) as LibraryTemplateFallbackRow[];
      } catch (error) {
        console.error(`Error fetching ${templateType} template fallback:`, error);
        return [] as LibraryTemplateFallbackRow[];
      }
    },
    [tenantId]
  );

  const fetchMaterialLibrary = useCallback(async () => {
    if (!tenantId) return;
    setMaterialLibraryLoading(true);
    try {
      const { data, error } = await supabase
        .from("storformat_material_library" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;

      const tableRows = ((data || []) as MaterialLibraryItem[]).filter(
        (item) => !!item?.name
      );
      const fallbackRows = await fetchTemplateLibraryFallback("material");
      const merged = new Map<string, MaterialLibraryItem>();

      tableRows.forEach((item) => {
        merged.set(normalizeLibraryName(item.name), item);
      });

      fallbackRows.forEach((templateRow) => {
        const key = normalizeLibraryName(templateRow.name || "");
        if (!key || merged.has(key)) return;
        merged.set(key, {
          id: `template-${templateRow.id}`,
          name: templateRow.name,
          max_width_mm:
            typeof templateRow.width_mm === "number" && templateRow.width_mm > 0
              ? templateRow.width_mm
              : null,
          max_height_mm:
            typeof templateRow.height_mm === "number" && templateRow.height_mm > 0
              ? templateRow.height_mm
              : null,
          tags: templateRow.category ? [templateRow.category] : [],
          created_at: null,
        });
      });

      setMaterialLibrary(Array.from(merged.values()));
    } catch (error) {
      console.error("Error fetching material library:", error);
    } finally {
      setMaterialLibraryLoading(false);
    }
  }, [tenantId, fetchTemplateLibraryFallback]);

  const fetchFinishLibrary = useCallback(async () => {
    if (!tenantId) return;
    setFinishLibraryLoading(true);
    try {
      const { data, error } = await supabase
        .from("storformat_finish_library" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;

      const tableRows = ((data || []) as FinishLibraryItem[]).filter(
        (item) => !!item?.name
      );
      const fallbackRows = await fetchTemplateLibraryFallback("finish");
      const merged = new Map<string, FinishLibraryItem>();

      tableRows.forEach((item) => {
        merged.set(normalizeLibraryName(item.name), item);
      });

      fallbackRows.forEach((templateRow) => {
        const key = normalizeLibraryName(templateRow.name || "");
        if (!key || merged.has(key)) return;
        merged.set(key, {
          id: `template-${templateRow.id}`,
          name: templateRow.name,
          tags: templateRow.category ? [templateRow.category] : [],
          created_at: null,
        });
      });

      setFinishLibrary(Array.from(merged.values()));
    } catch (error) {
      console.error("Error fetching finish library:", error);
    } finally {
      setFinishLibraryLoading(false);
    }
  }, [tenantId, fetchTemplateLibraryFallback]);

  const fetchProductLibrary = useCallback(async () => {
    if (!tenantId) return;
    setProductLibraryLoading(true);
    try {
      const { data, error } = await supabase
        .from("storformat_product_library" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;

      const tableRows = ((data || []) as ProductLibraryItem[]).filter(
        (item) => !!item?.name
      );
      const fallbackRows = await fetchTemplateLibraryFallback("product");
      const merged = new Map<string, ProductLibraryItem>();

      tableRows.forEach((item) => {
        merged.set(normalizeLibraryName(item.name), item);
      });

      fallbackRows.forEach((templateRow) => {
        const key = normalizeLibraryName(templateRow.name || "");
        if (!key || merged.has(key)) return;
        merged.set(key, {
          id: `template-${templateRow.id}`,
          name: templateRow.name,
          tags: templateRow.category ? [templateRow.category] : [],
          created_at: null,
        });
      });

      setProductLibrary(Array.from(merged.values()));
    } catch (error) {
      console.error("Error fetching product library:", error);
    } finally {
      setProductLibraryLoading(false);
    }
  }, [tenantId, fetchTemplateLibraryFallback]);

  const fetchStorformat = async () => {
    setLoading(true);
    try {
      const { data: productRow, error: productError } = await supabase
        .from("products")
        .select("slug, technical_specs")
        .eq("id", productId)
        .maybeSingle();

      const bannerBuilderManagedProduct =
        !productError &&
        isBannerBuilderManagedProduct(productRow?.technical_specs, productRow?.slug);

      if (productError) {
        console.error("Storformat product fetch error", productError);
        setIsBannerBuilderProduct(false);
        setProductTechnicalSpecs(null);
        setBannerBuilderPricingSelection(EMPTY_BANNER_BUILDER_SELECTION);
      } else {
        setIsBannerBuilderProduct(bannerBuilderManagedProduct);
        setProductTechnicalSpecs(productRow?.technical_specs || null);
        setBannerBuilderPricingSelection(
          bannerBuilderManagedProduct
            ? readBannerBuilderPricingSelection(productRow?.technical_specs)
            : EMPTY_BANNER_BUILDER_SELECTION,
        );
      }

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
          pricing_mode: "m2_rates",
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

      const materialsSimple = (materialRows || []).map((m: any) => ({
        ...m,
        thumbnail_url: m.thumbnail_url ?? null,
        bleed_mm: m.bleed_mm ?? 3,
        safe_area_mm: m.safe_area_mm ?? 3,
        markup_pct: m.markup_pct ?? 0,
        tiers: []
      }));
      setMaterials(materialsSimple);

      const { data: m2PriceRows } = await supabase
        .from("storformat_m2_prices" as any)
        .select("*")
        .eq("product_id", productId)
        .order("from_m2");
      setM2Prices((m2PriceRows || []) as M2PriceDraft[]);

      const { data: finishRowsRaw } = await supabase
        .from("storformat_finishes" as any)
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");

      let finishRows = (finishRowsRaw || []) as any[];
      if (bannerBuilderManagedProduct) {
        const existingNames = new Set(
          finishRows
            .map((row: any) => normalizeLibraryName(String(row?.name || "")))
            .filter(Boolean)
        );
        const missingFinishNames = BANNER_BUILDER_DEFAULT_FINISHES.filter(
          (finishName) => !existingNames.has(normalizeLibraryName(finishName))
        );

        if (missingFinishNames.length > 0) {
          const sortBase = finishRows.reduce((maxSort, row: any) => {
            const sortOrder = Number(row?.sort_order);
            return Number.isFinite(sortOrder) ? Math.max(maxSort, sortOrder) : maxSort;
          }, -1);

          const insertRows = missingFinishNames.map((finishName, index) => ({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            product_id: productId,
            name: finishName,
            group_label: null,
            tags: [],
            thumbnail_url: null,
            visibility: "tenant",
            pricing_mode: "fixed",
            fixed_price_per_unit: 0,
            interpolation_enabled: true,
            markup_pct: 0,
            sort_order: sortBase + index + 1,
          }));

          const { data: insertedFinishRows, error: insertFinishError } = await supabase
            .from("storformat_finishes" as any)
            .insert(insertRows)
            .select("*");

          if (insertFinishError) {
            console.error("Error seeding default banner finishes:", insertFinishError);
          } else {
            finishRows = [...finishRows, ...((insertedFinishRows || []) as any[])].sort(
              (a: any, b: any) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0)
            );
          }
        }
      }

      const finishesSimple = (finishRows || []).map((f: any) => ({
        ...f,
        thumbnail_url: f.thumbnail_url ?? null,
        markup_pct: f.markup_pct ?? 0,
        tiers: []
      }));
      setFinishes(finishesSimple);

      const { data: finishPriceRowsRaw } = await supabase
        .from("storformat_finish_prices" as any)
        .select("*")
        .eq("product_id", productId);

      let finishPriceRows = (finishPriceRowsRaw || []) as any[];
      if (finishRows.length > 0) {
        const existingPriceIds = new Set(
          finishPriceRows
            .map((row: any) => (typeof row?.finish_id === "string" ? row.finish_id : ""))
            .filter(Boolean)
        );
        const missingFinishPriceRows = finishRows
          .filter((row: any) => !!row?.id && !existingPriceIds.has(row.id))
          .map((row: any) => ({
            tenant_id: tenantId,
            product_id: productId,
            finish_id: row.id,
            pricing_mode: row.pricing_mode || "fixed",
            fixed_price: 0,
            price_per_m2: 0,
          }));

        if (missingFinishPriceRows.length > 0) {
          const { error: insertFinishPriceError } = await supabase
            .from("storformat_finish_prices" as any)
            .insert(missingFinishPriceRows);

          if (insertFinishPriceError) {
            console.error("Error ensuring finish price rows:", insertFinishPriceError);
          } else {
            const { data: refreshedFinishPriceRows } = await supabase
              .from("storformat_finish_prices" as any)
              .select("*")
              .eq("product_id", productId);
            finishPriceRows = (refreshedFinishPriceRows || []) as any[];
          }
        }
      }

      const nextFinishPrices: Record<string, FinishPriceDraft> = {};
      (finishPriceRows || []).forEach((row: any) => {
        nextFinishPrices[row.finish_id] = {
          pricing_mode: row.pricing_mode,
          fixed_price: Number(row.fixed_price) || 0,
          price_per_m2: Number(row.price_per_m2) || 0
        };
      });
      setFinishPrices(nextFinishPrices);

      const { data: productRows } = await supabase
        .from("storformat_products" as any)
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");

      const productsSimple: StorformatProduct[] = (productRows || []).map((p: any) => ({
        ...p,
        thumbnail_url: p.thumbnail_url ?? null,
        markup_pct: p.markup_pct ?? 0,
        tiers: [],
        fixed_prices: []
      }));
      setProducts(productsSimple);
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
    setShowMatrixLayoutTools(false);
  }, [productId]);

  useEffect(() => {
    if (showAllTemplates) {
      fetchAllTemplates();
    }
  }, [showAllTemplates]);

  useEffect(() => {
    fetchMaterialLibrary();
    fetchFinishLibrary();
    fetchProductLibrary();
  }, [fetchMaterialLibrary, fetchFinishLibrary, fetchProductLibrary]);

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

  useEffect(() => {
    setM2TierAdjustments({});
    setM2TierAdjustBasePrices({});
  }, [activeM2MaterialId]);

  useEffect(() => {
    if (materials.length > 0 && !activeM2MaterialId) {
      setActiveM2MaterialId(materials[0].id || null);
    }
  }, [materials, activeM2MaterialId]);

  const queueMaterialSave = useCallback((id: string, patch: Partial<StorformatMaterial>) => {
    if (!id) return;
    const payload = normalizeMaterialPatch(patch);
    if (Object.keys(payload).length === 0) return;
    materialSaveQueueRef.current[id] = { ...(materialSaveQueueRef.current[id] || {}), ...payload };
    if (materialSaveTimersRef.current[id]) {
      clearTimeout(materialSaveTimersRef.current[id]);
    }
    materialSaveTimersRef.current[id] = setTimeout(async () => {
      const pending = materialSaveQueueRef.current[id];
      delete materialSaveQueueRef.current[id];
      delete materialSaveTimersRef.current[id];
      if (!pending) return;
      const { error } = await supabase
        .from("storformat_materials" as any)
        .update(pending)
        .eq("id", id);
      if (error) {
        console.error("Auto-save material error", error);
      }
    }, 600);
  }, []);

  const queueFinishSave = useCallback((id: string, patch: Partial<StorformatFinish>) => {
    if (!id) return;
    const payload = normalizeFinishPatch(patch);
    if (Object.keys(payload).length === 0) return;
    finishSaveQueueRef.current[id] = { ...(finishSaveQueueRef.current[id] || {}), ...payload };
    if (finishSaveTimersRef.current[id]) {
      clearTimeout(finishSaveTimersRef.current[id]);
    }
    finishSaveTimersRef.current[id] = setTimeout(async () => {
      const pending = finishSaveQueueRef.current[id];
      delete finishSaveQueueRef.current[id];
      delete finishSaveTimersRef.current[id];
      if (!pending) return;
      const { error } = await supabase
        .from("storformat_finishes" as any)
        .update(pending)
        .eq("id", id);
      if (error) {
        console.error("Auto-save finish error", error);
      }
    }, 600);
  }, []);

  const queueProductSave = useCallback((id: string, patch: Partial<StorformatProduct>) => {
    if (!id) return;
    const payload = normalizeProductPatch(patch);
    if (Object.keys(payload).length === 0) return;
    productSaveQueueRef.current[id] = { ...(productSaveQueueRef.current[id] || {}), ...payload };
    if (productSaveTimersRef.current[id]) {
      clearTimeout(productSaveTimersRef.current[id]);
    }
    productSaveTimersRef.current[id] = setTimeout(async () => {
      const pending = productSaveQueueRef.current[id];
      delete productSaveQueueRef.current[id];
      delete productSaveTimersRef.current[id];
      if (!pending) return;
      const { error } = await supabase
        .from("storformat_products" as any)
        .update(pending)
        .eq("id", id);
      if (error) {
        console.error("Auto-save product error", error);
      }
    }, 600);
  }, []);

  const updateMaterial = (id: string, patch: Partial<StorformatMaterial>) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
    queueMaterialSave(id, patch);
  };

  const updateFinish = (id: string, patch: Partial<StorformatFinish>) => {
    setFinishes((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
    queueFinishSave(id, patch);
  };

  const handleDeleteMaterial = async (material: StorformatMaterial) => {
    if (!material?.id) return;
    if (!confirm("Slet materiale?")) return;
    try {
      if (materialSaveTimersRef.current[material.id]) {
        clearTimeout(materialSaveTimersRef.current[material.id]);
        delete materialSaveTimersRef.current[material.id];
      }
      delete materialSaveQueueRef.current[material.id];

      await supabase
        .from("storformat_m2_prices" as any)
        .delete()
        .eq("product_id", productId)
        .eq("material_id", material.id);

      const { error } = await supabase
        .from("storformat_materials" as any)
        .delete()
        .eq("id", material.id);
      if (error) throw error;

      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      setM2Prices((prev) => prev.filter((p) => p.material_id !== material.id));
      if (activeM2MaterialId === material.id) {
        setActiveM2MaterialId(null);
      }
      setExpandedMaterialId(null);
      toast.success("Materiale slettet");
    } catch (error) {
      console.error("Delete material error", error);
      toast.error("Kunne ikke slette materiale");
    }
  };

  const handleDeleteFinish = async (finish: StorformatFinish) => {
    if (!finish?.id) return;
    if (!confirm("Slet efterbehandling?")) return;
    try {
      if (finishSaveTimersRef.current[finish.id]) {
        clearTimeout(finishSaveTimersRef.current[finish.id]);
        delete finishSaveTimersRef.current[finish.id];
      }
      delete finishSaveQueueRef.current[finish.id];

      await supabase
        .from("storformat_finish_prices" as any)
        .delete()
        .eq("product_id", productId)
        .eq("finish_id", finish.id);

      const { error } = await supabase
        .from("storformat_finishes" as any)
        .delete()
        .eq("id", finish.id);
      if (error) throw error;

      setFinishes((prev) => prev.filter((f) => f.id !== finish.id));
      setFinishPrices((prev) => {
        const next = { ...prev };
        delete next[finish.id || ""];
        return next;
      });
      setExpandedFinishId(null);
      toast.success("Efterbehandling slettet");
    } catch (error) {
      console.error("Delete finish error", error);
      toast.error("Kunne ikke slette efterbehandling");
    }
  };

  const handleDeleteProduct = async (productItem: StorformatProduct) => {
    if (!productItem?.id) return;
    if (!confirm("Slet produkt?")) return;
    try {
      if (productSaveTimersRef.current[productItem.id]) {
        clearTimeout(productSaveTimersRef.current[productItem.id]);
        delete productSaveTimersRef.current[productItem.id];
      }
      delete productSaveQueueRef.current[productItem.id];

      await supabase
        .from("storformat_product_price_tiers" as any)
        .delete()
        .eq("product_item_id", productItem.id);

      await supabase
        .from("storformat_product_fixed_prices" as any)
        .delete()
        .eq("product_item_id", productItem.id);

      await supabase
        .from("storformat_product_m2_prices" as any)
        .delete()
        .eq("storformat_product_id", productItem.id);

      const { error } = await supabase
        .from("storformat_products" as any)
        .delete()
        .eq("id", productItem.id);
      if (error) throw error;

      setProducts((prev) => prev.filter((p) => p.id !== productItem.id));
      setExpandedProductId(null);
      toast.success("Produkt slettet");
    } catch (error) {
      console.error("Delete product error", error);
      toast.error("Kunne ikke slette produkt");
    }
  };

  // Delete a tag from ALL items of a specific type
  const handleDeleteTagFromAll = async (tag: string, type: LayoutSectionType) => {
    const typeLabel = type === "materials" ? "materialer" : type === "finishes" ? "efterbehandlinger" : "produkter";
    if (!confirm(`Er du sikker på at du vil fjerne tagget "${tag}" fra alle ${typeLabel}?`)) return;

    setDeletingTag(tag);
    try {
      const items = type === "materials" ? materials : type === "finishes" ? finishes : products;
      const itemsWithTag = items.filter((item) => item.tags?.includes(tag));

      if (itemsWithTag.length === 0) {
        toast.info("Ingen elementer har dette tag");
        setDeletingTag(null);
        return;
      }

      const tableName = type === "materials"
        ? "storformat_materials"
        : type === "finishes"
          ? "storformat_finishes"
          : "storformat_products";

      // Update each item to remove the tag
      for (const item of itemsWithTag) {
        const newTags = (item.tags || []).filter((t) => t !== tag);
        await supabase
          .from(tableName as any)
          .update({ tags: newTags })
          .eq("id", item.id);
      }

      // Update local state
      if (type === "materials") {
        setMaterials((prev) => prev.map((m) => ({
          ...m,
          tags: (m.tags || []).filter((t) => t !== tag)
        })));
      } else if (type === "finishes") {
        setFinishes((prev) => prev.map((f) => ({
          ...f,
          tags: (f.tags || []).filter((t) => t !== tag)
        })));
      } else {
        setProducts((prev) => prev.map((p) => ({
          ...p,
          tags: (p.tags || []).filter((t) => t !== tag)
        })));
      }

      toast.success(`Tagget "${tag}" fjernet fra ${itemsWithTag.length} ${typeLabel}`);
    } catch (error) {
      console.error("Delete tag error", error);
      toast.error("Kunne ikke fjerne tag");
    } finally {
      setDeletingTag(null);
    }
  };

  // Copy/duplicate a material with all its M2 prices
  const handleCopyMaterial = async (material: StorformatMaterial) => {
    setCopyingItemId(material.id);
    try {
      const newId = crypto.randomUUID();
      const newMaterial: StorformatMaterial = {
        ...material,
        id: newId,
        name: `${material.name} (kopi)`,
        tiers: material.tiers.map((t) => ({ ...t, id: crypto.randomUUID() }))
      };

      // Insert new material
      const { error: materialError } = await supabase
        .from("storformat_materials" as any)
        .insert({
          id: newId,
          tenant_id: tenantId,
          name: newMaterial.name,
          tags: newMaterial.tags,
          thumbnail_url: newMaterial.thumbnail_url,
          max_width_mm: newMaterial.max_width_mm,
          max_height_mm: newMaterial.max_height_mm,
          bleed_mm: newMaterial.bleed_mm,
          safe_area_mm: newMaterial.safe_area_mm,
          interpolation_enabled: newMaterial.interpolation_enabled,
          interpolation_step_m2: newMaterial.interpolation_step_m2,
          tiers: newMaterial.tiers
        });
      if (materialError) throw materialError;

      // Copy M2 prices
      const materialM2Prices = m2Prices.filter((p) => p.material_id === material.id);
      if (materialM2Prices.length > 0) {
        const newM2Prices = materialM2Prices.map((p) => ({
          id: crypto.randomUUID(),
          material_id: newId,
          from_m2: p.from_m2,
          to_m2: p.to_m2,
          price_per_m2: p.price_per_m2,
          is_anchor: p.is_anchor
        }));

        const { error: m2Error } = await supabase
          .from("storformat_m2_prices" as any)
          .insert(newM2Prices);
        if (m2Error) throw m2Error;

        setM2Prices((prev) => [...prev, ...newM2Prices]);
      }

      setMaterials((prev) => [...prev, newMaterial]);
      setExpandedMaterialId(newId);
      toast.success("Materiale kopieret");
    } catch (error) {
      console.error("Copy material error", error);
      toast.error("Kunne ikke kopiere materiale");
    } finally {
      setCopyingItemId(null);
    }
  };

  // Copy/duplicate a finish with its pricing
  const handleCopyFinish = async (finish: StorformatFinish) => {
    setCopyingItemId(finish.id);
    try {
      const newId = crypto.randomUUID();
      const newFinish: StorformatFinish = {
        ...finish,
        id: newId,
        name: `${finish.name} (kopi)`,
        tiers: finish.tiers.map((t) => ({ ...t, id: crypto.randomUUID() }))
      };

      // Insert new finish
      const { error: finishError } = await supabase
        .from("storformat_finishes" as any)
        .insert({
          id: newId,
          tenant_id: tenantId,
          name: newFinish.name,
          tags: newFinish.tags,
          thumbnail_url: newFinish.thumbnail_url,
          max_width_mm: newFinish.max_width_mm,
          max_height_mm: newFinish.max_height_mm,
          tiers: newFinish.tiers
        });
      if (finishError) throw finishError;

      // Copy finish prices
      const existingPrice = finishPrices[finish.id];
      if (existingPrice) {
        const { error: priceError } = await supabase
          .from("storformat_finish_prices" as any)
          .insert({
            id: crypto.randomUUID(),
            finish_id: newId,
            pricing_mode: existingPrice.pricing_mode,
            fixed_price: existingPrice.fixed_price,
            price_per_m2: existingPrice.price_per_m2
          });
        if (priceError) throw priceError;

        setFinishPrices((prev) => ({
          ...prev,
          [newId]: { ...existingPrice }
        }));
      }

      setFinishes((prev) => [...prev, newFinish]);
      setExpandedFinishId(newId);
      toast.success("Efterbehandling kopieret");
    } catch (error) {
      console.error("Copy finish error", error);
      toast.error("Kunne ikke kopiere efterbehandling");
    } finally {
      setCopyingItemId(null);
    }
  };

  // Copy/duplicate a product with all its prices and tiers
  const handleCopyProduct = async (product: StorformatProduct) => {
    setCopyingItemId(product.id);
    try {
      const newId = crypto.randomUUID();
      const newProduct: StorformatProduct = {
        ...product,
        id: newId,
        name: `${product.name} (kopi)`,
        tiers: product.tiers.map((t) => ({ ...t, id: crypto.randomUUID() }))
      };

      // Insert new product
      const { error: productError } = await supabase
        .from("storformat_products" as any)
        .insert({
          id: newId,
          tenant_id: tenantId,
          name: newProduct.name,
          tags: newProduct.tags,
          thumbnail_url: newProduct.thumbnail_url,
          max_width_mm: newProduct.max_width_mm,
          max_height_mm: newProduct.max_height_mm,
          pricing_mode: newProduct.pricing_mode,
          tiers: newProduct.tiers
        });
      if (productError) throw productError;

      // Copy fixed prices
      const existingFixedPrices = productFixedPrices.filter((p) => p.product_item_id === product.id);
      if (existingFixedPrices.length > 0) {
        const newFixedPrices = existingFixedPrices.map((p) => ({
          id: crypto.randomUUID(),
          product_item_id: newId,
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          price: p.price
        }));

        const { error: fixedError } = await supabase
          .from("storformat_product_fixed_prices" as any)
          .insert(newFixedPrices);
        if (fixedError) throw fixedError;

        setProductFixedPrices((prev) => [...prev, ...newFixedPrices]);
      }

      // Copy price tiers
      const existingTiers = productPriceTiers.filter((t) => t.product_item_id === product.id);
      if (existingTiers.length > 0) {
        const newTiers = existingTiers.map((t) => ({
          id: crypto.randomUUID(),
          product_item_id: newId,
          from_m2: t.from_m2,
          to_m2: t.to_m2,
          price_per_m2: t.price_per_m2,
          is_anchor: t.is_anchor
        }));

        const { error: tierError } = await supabase
          .from("storformat_product_price_tiers" as any)
          .insert(newTiers);
        if (tierError) throw tierError;

        setProductPriceTiers((prev) => [...prev, ...newTiers]);
      }

      setProducts((prev) => [...prev, newProduct]);
      setExpandedProductId(newId);
      toast.success("Produkt kopieret");
    } catch (error) {
      console.error("Copy product error", error);
      toast.error("Kunne ikke kopiere produkt");
    } finally {
      setCopyingItemId(null);
    }
  };

  function getM2PricesForMaterial(materialId: string) {
    return m2Prices
      .filter((p) => p.material_id === materialId)
      .sort((a, b) => a.from_m2 - b.from_m2);
  }

  const setM2PricesForMaterial = (materialId: string, prices: M2PriceDraft[]) => {
    const normalized = prices.map((p) => ({
      id: p.id || crypto.randomUUID(),
      material_id: materialId,
      from_m2: p.from_m2,
      to_m2: p.to_m2 ?? null,
      price_per_m2: p.price_per_m2,
      is_anchor: p.is_anchor ?? false
    }));
    setM2Prices((prev) => [
      ...prev.filter((p) => p.material_id !== materialId),
      ...normalized
    ]);
  };

  const updateM2Tier = (materialId: string, tierId: string, patch: Partial<M2PriceDraft>) => {
    setM2Prices((prev) =>
      prev.map((t) =>
        t.material_id === materialId && t.id === tierId
          ? { ...t, ...patch }
          : t
      )
    );
  };

  const addM2Tier = (materialId: string) => {
    setM2Prices((prev) => [...prev, createM2Tier(materialId)]);
  };

  const removeM2Tier = (materialId: string, tierId: string) => {
    setM2Prices((prev) => prev.filter((t) => !(t.material_id === materialId && t.id === tierId)));
  };

  // Interpolate non-anchor rows between anchor points for a material
  const interpolateM2Prices = (materialId: string) => {
    setM2Prices((prev) => {
      const materialPrices = prev.filter((p) => p.material_id === materialId).sort((a, b) => a.from_m2 - b.from_m2);
      const otherPrices = prev.filter((p) => p.material_id !== materialId);
      const anchors = materialPrices.filter((p) => p.is_anchor).sort((a, b) => a.from_m2 - b.from_m2);
      if (anchors.length < 2) return prev; // Need at least 2 anchors to interpolate

      const updated = materialPrices.map((tier) => {
        if (tier.is_anchor) return tier; // Keep anchor prices as-is
        const m2 = tier.from_m2;
        // Find surrounding anchors
        let lower = anchors[0];
        let upper = anchors[anchors.length - 1];
        for (let i = 0; i < anchors.length - 1; i++) {
          if (m2 >= anchors[i].from_m2 && m2 <= anchors[i + 1].from_m2) {
            lower = anchors[i];
            upper = anchors[i + 1];
            break;
          }
        }
        // Below first anchor or above last anchor - use nearest
        if (m2 <= lower.from_m2) return { ...tier, price_per_m2: lower.price_per_m2 };
        if (m2 >= upper.from_m2) return { ...tier, price_per_m2: upper.price_per_m2 };
        // Linear interpolation
        const t = (m2 - lower.from_m2) / (upper.from_m2 - lower.from_m2);
        const interpolated = Math.round(lower.price_per_m2 + t * (upper.price_per_m2 - lower.price_per_m2));
        return { ...tier, price_per_m2: Math.max(1, interpolated) };
      });

      return [...otherPrices, ...updated];
    });
  };

  function getFinishPriceDraft(finishId: string): FinishPriceDraft {
    return finishPrices[finishId] || { pricing_mode: "fixed", fixed_price: 0, price_per_m2: 0 };
  }

  const updateFinishPrice = (finishId: string, patch: Partial<FinishPriceDraft>) => {
    setFinishPrices((prev) => ({
      ...prev,
      [finishId]: {
        pricing_mode: prev[finishId]?.pricing_mode ?? "fixed",
        fixed_price: prev[finishId]?.fixed_price ?? 0,
        price_per_m2: prev[finishId]?.price_per_m2 ?? 0,
        ...patch
      }
    }));
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
    queueProductSave(id, patch);
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
      updateMaterial(valueId, { thumbnail_url: null });
    } else if (catalogType === "finishes") {
      updateFinish(valueId, { thumbnail_url: null });
    } else {
      updateProduct(valueId, { thumbnail_url: null });
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
        if (uploadTarget.catalogType === "materials") {
          updateMaterial(uploadTarget.valueId, { thumbnail_url: publicUrl });
        } else if (uploadTarget.catalogType === "finishes") {
          updateFinish(uploadTarget.valueId, { thumbnail_url: publicUrl });
        } else {
          updateProduct(uploadTarget.valueId, { thumbnail_url: publicUrl });
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
      // Collect both group_label and tags array
      const groupLabels = source.map((item) => (item.group_label || "").trim()).filter(Boolean);
      const tagArrays = source.flatMap((item) => (item as any).tags || []).filter(Boolean);
      return Array.from(new Set([...groupLabels, ...tagArrays])).sort();
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

  const filterCatalogItems = <T extends { name?: string; group_label?: string | null; tags?: string[] }>(
    type: LayoutSectionType,
    items: T[]
  ) => {
    const query = catalogSearchQuery[type].trim().toLowerCase();
    const tag = catalogTagFilter[type];
    return items.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const groupRaw = item.group_label?.trim() || "";
      const group = groupRaw.toLowerCase();
      const itemTags = (item.tags || []).map(t => t.toLowerCase());
      const matchesQuery = !query || name.includes(query) || group.includes(query) || itemTags.some(t => t.includes(query));
      const matchesTag = !tag || groupRaw === tag || (item.tags || []).includes(tag);
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

  const saveBannerBuilderPricingSelection = useCallback(
    async (nextSelection: BannerBuilderPricingSelection) => {
      if (!isBannerBuilderProduct) return;

      const previousSpecs = productTechnicalSpecs;
      const previousSelection = bannerBuilderPricingSelection;
      const nextSpecs = writeBannerBuilderPricingSelection(
        previousSpecs,
        nextSelection,
      );

      setProductTechnicalSpecs(nextSpecs);
      setBannerBuilderPricingSelection(nextSelection);
      setSavingBannerBuilderSelection(true);

      const { error } = await supabase
        .from("products")
        .update({ technical_specs: nextSpecs as any })
        .eq("id", productId);

      if (error) {
        console.error("Error updating Banner Builder pricing selection:", error);
        setProductTechnicalSpecs(previousSpecs);
        setBannerBuilderPricingSelection(previousSelection);
        toast.error("Kunne ikke gemme aktive frontend-valg");
      }

      setSavingBannerBuilderSelection(false);
    },
    [
      bannerBuilderPricingSelection,
      isBannerBuilderProduct,
      productId,
      productTechnicalSpecs,
    ],
  );

  const toggleBannerBuilderSelection = useCallback(
    async (type: "finish" | "product", id: string) => {
      if (!id || !isBannerBuilderProduct) return;

      if (type === "finish") {
        const isActive = bannerBuilderPricingSelection.activeFinishIds.includes(id);
        const activeFinishIds = isActive
          ? bannerBuilderPricingSelection.activeFinishIds.filter((value) => value !== id)
          : [...bannerBuilderPricingSelection.activeFinishIds, id];
        await saveBannerBuilderPricingSelection({
          ...bannerBuilderPricingSelection,
          activeFinishIds,
        });
        return;
      }

      const isActive =
        bannerBuilderPricingSelection.activeProductItemIds.includes(id);
      const activeProductItemIds = isActive
        ? bannerBuilderPricingSelection.activeProductItemIds.filter(
            (value) => value !== id,
          )
        : [...bannerBuilderPricingSelection.activeProductItemIds, id];
      await saveBannerBuilderPricingSelection({
        ...bannerBuilderPricingSelection,
        activeProductItemIds,
      });
    },
    [
      bannerBuilderPricingSelection,
      isBannerBuilderProduct,
      saveBannerBuilderPricingSelection,
    ],
  );

  const toggleCatalogSearch = (type: LayoutSectionType) => {
    setCatalogSearchOpen((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const updateCatalogSearch = (type: LayoutSectionType, value: string) => {
    setCatalogSearchQuery((prev) => ({ ...prev, [type]: value }));
  };

  const updateCatalogTagFilter = (type: LayoutSectionType, value: string) => {
    setCatalogTagFilter((prev) => ({ ...prev, [type]: value }));
  };

  const openDesignLibrarySelector = (materialId: string) => {
    setDesignLibrarySelectorTarget(materialId);
    setShowDesignLibrarySelector(true);
  };

  const handleDesignLibrarySelect = (item: { id: string; name: string; preview_path?: string | null; storage_path?: string | null }) => {
    if (!designLibrarySelectorTarget) return;
    // Update material with the linked design library item
    const thumbnailUrl = item.preview_path || item.storage_path || null;
    updateMaterial(designLibrarySelectorTarget, {
      design_library_item_id: item.id,
      thumbnail_url: thumbnailUrl
    } as any);
    // Also update layout if needed
    if (thumbnailUrl) {
      applyThumbnailToLayout(designLibrarySelectorTarget, thumbnailUrl);
    }
    toast.success(`Linket til "${item.name}"`);
    setDesignLibrarySelectorTarget(null);
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
      quantities: defaultQuantities,
      pricing_mode: "m2_rates"
    }));
    setSelectedSectionValues({});
    setSelectedTarget(null);
    setCustomQuantity("");
    setPreviewWidthMm(1000);
    setPreviewHeightMm(1000);
    setPreviewAmountPage(0);
    setM2Prices([]);
    setFinishPrices({});
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

  const handleSave = async (): Promise<boolean> => {
    const normalizedQuantities = normalizeQuantities(config.quantities || []);
    if (!normalizedQuantities.length) {
      toast.error("Indtast mindst én mængde");
      return false;
    }
    if (materials.length === 0) {
      toast.error("Tilføj mindst ét materiale");
      return false;
    }

    setSaving(true);
    try {
      const updatedConfig = {
        ...config,
        quantities: normalizedQuantities,
        layout_rows: layoutRows,
        vertical_axis: verticalAxis,
        pricing_mode: "m2_rates"
      };
      setConfig(updatedConfig);

      const configRow = {
        tenant_id: tenantId,
        product_id: productId,
        rounding_step: updatedConfig.rounding_step,
        global_markup_pct: updatedConfig.global_markup_pct,
        quantities: updatedConfig.quantities,
        pricing_mode: "m2_rates",
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
        tags: (m as any).tags || [],
        thumbnail_url: m.thumbnail_url || null,
        design_library_item_id: (m as any).design_library_item_id || null,
        visibility: (m as any).visibility || "tenant",
        bleed_mm: typeof m.bleed_mm === "number" ? m.bleed_mm : 3,
        safe_area_mm: typeof m.safe_area_mm === "number" ? m.safe_area_mm : 3,
        max_width_mm: m.max_width_mm || null,
        max_height_mm: m.max_height_mm || null,
        allow_split: m.allow_split ?? true,
        interpolation_enabled: m.interpolation_enabled ?? true,
        markup_pct: m.markup_pct || 0,
        min_price: m.min_price || 0,
        sort_order: idx
      }));

      const finishRows = finishes.map((f, idx) => ({
        id: f.id || crypto.randomUUID(),
        tenant_id: tenantId,
        product_id: productId,
        name: f.name.trim(),
        group_label: f.group_label?.trim() || null,
        tags: (f as any).tags || [],
        thumbnail_url: f.thumbnail_url || null,
        visibility: (f as any).visibility || "tenant",
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
        tags: (p as any).tags || [],
        thumbnail_url: p.thumbnail_url || null,
        visibility: (p as any).visibility || "tenant",
        is_template: (p as any).is_template || false,
        pricing_mode: p.pricing_mode || "fixed",
        pricing_type: p.pricing_type || "fixed",
        initial_price: p.initial_price || 0,
        percentage_markup: p.percentage_markup || 0,
        min_price: p.min_price || 0,
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

      await supabase.from("storformat_m2_prices" as any).delete().eq("product_id", productId);
      await supabase.from("storformat_finish_prices" as any).delete().eq("product_id", productId);

      const m2PriceRows = m2Prices
        .filter((p) => materialIds.has(p.material_id))
        .map((p) => ({
          id: p.id || crypto.randomUUID(),
          tenant_id: tenantId,
          product_id: productId,
          material_id: p.material_id,
          from_m2: p.from_m2,
          to_m2: p.to_m2 ?? null,
          price_per_m2: p.price_per_m2,
          is_anchor: p.is_anchor ?? false
        }));

      if (m2PriceRows.length) {
        const { error } = await supabase.from("storformat_m2_prices" as any).insert(m2PriceRows);
        if (error) throw error;
      }

      const finishPriceRows = Array.from(finishIds).map((finishId) => {
        const finishMeta = finishes.find((f) => f.id === finishId);
        const draft = finishPrices[finishId] || {
          pricing_mode: finishMeta?.pricing_mode || "fixed",
          fixed_price: finishMeta?.fixed_price_per_unit || 0,
          price_per_m2: 0
        };
        return {
          tenant_id: tenantId,
          product_id: productId,
          finish_id: finishId,
          pricing_mode: draft.pricing_mode,
          fixed_price: draft.fixed_price,
          price_per_m2: draft.price_per_m2
        };
      });

      if (finishPriceRows.length) {
        const { error } = await supabase.from("storformat_finish_prices" as any).insert(finishPriceRows);
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
      return true;
    } catch (error: any) {
      console.error("Storformat save error", error);
      toast.error(error.message || "Kunne ikke gemme storformat");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (overwriteId?: string) => {
    if (!saveName.trim()) {
      toast.error("Angiv et navn");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const normalizedConfig = {
        ...config,
        pricing_mode: "m2_rates",
        layout_rows: layoutRows,
        vertical_axis: verticalAxis
      };
      const spec = {
        config: normalizedConfig,
        materials,
        finishes,
        products,
        m2_prices: m2Prices,
        finish_prices: finishPrices,
        layout_rows: layoutRows,
        vertical_axis: verticalAxis
      };
      const payload = {
        name: saveName.trim(),
        spec
      };

      const { error } = overwriteId
        ? await supabase
          .from("storformat_price_list_templates" as any)
          .update(payload)
          .eq("id", overwriteId)
        : await supabase
          .from("storformat_price_list_templates" as any)
          .insert({
            tenant_id: tenantId,
            product_id: productId,
            name: saveName.trim(),
            spec,
            created_by: user?.id
          });
      if (error) throw error;
      toast.success(
        overwriteId
          ? "Skabelon overskrevet (bank). Brug Gem kladde/Publicer for live priser."
          : "Skabelon gemt i banken. Brug Gem kladde/Publicer for live priser."
      );
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
        pricing_mode: "m2_rates",
        layout_rows: spec.config.layout_rows || spec.layout_rows,
        vertical_axis: spec.config.vertical_axis || spec.vertical_axis
      });
    }
    if (spec.materials) setMaterials(spec.materials);
    if (spec.finishes) setFinishes(spec.finishes);
    if (spec.products) setProducts(spec.products);
    if (spec.m2_prices) {
      setM2Prices(spec.m2_prices);
    } else {
      setM2Prices([]);
    }
    if (spec.finish_prices) {
      setFinishPrices(spec.finish_prices);
    } else {
      setFinishPrices({});
    }
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

  const getMaterialKey = (name: string, maxWidth?: number | null, maxHeight?: number | null) =>
    `${name.trim().toLowerCase()}|${maxWidth ?? "null"}|${maxHeight ?? "null"}`;
  const getNameKey = (name: string) => name.trim().toLowerCase();

  const handleSaveMaterialsToLibrary = async () => {
    if (!tenantId) return;
    const candidates = materials
      .map((material) => ({
        name: material.name.trim(),
        max_width_mm: material.max_width_mm ?? null,
        max_height_mm: material.max_height_mm ?? null,
        tags: (material as any).tags || []
      }))
      .filter((item) => item.name.length > 0);

    if (candidates.length === 0) {
      toast.error("Ingen materialer med navn at gemme");
      return;
    }

    const existingMap = new Map(
      materialLibrary.map((item) => [
        getMaterialKey(item.name, item.max_width_mm, item.max_height_mm),
        item
      ])
    );
    const uniqueCandidates = new Map<string, { name: string; max_width_mm: number | null; max_height_mm: number | null; tags: string[] }>();
    candidates.forEach((item) => {
      const key = getMaterialKey(item.name, item.max_width_mm, item.max_height_mm);
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, item);
      }
    });

    const rows = Array.from(uniqueCandidates.values());
    if (rows.length === 0) {
      toast.message("Ingen materialer at gemme");
      return;
    }

    setSavingMaterialLibrary(true);
    try {
      const newCount = rows.filter((row) => !existingMap.has(getMaterialKey(row.name, row.max_width_mm, row.max_height_mm))).length;
      const updateCount = rows.length - newCount;
      const { error } = await supabase
        .from("storformat_material_library" as any)
        .upsert(
          rows.map((row) => ({ tenant_id: tenantId, ...row })),
          { onConflict: "tenant_id,name,max_width_mm,max_height_mm" }
        );
      if (error) throw error;
      if (updateCount > 0 && newCount > 0) {
        toast.success(`Gemt ${newCount} og opdateret ${updateCount} materiale(r)`);
      } else if (updateCount > 0) {
        toast.success(`Opdateret ${updateCount} materiale(r) i biblioteket`);
      } else {
        toast.success(`Gemt ${rows.length} materiale(r) i biblioteket`);
      }
      fetchMaterialLibrary();
    } catch (error: any) {
      console.error("Error saving materials to library:", error);
      toast.error(error.message || "Kunne ikke gemme materialer");
    } finally {
      setSavingMaterialLibrary(false);
    }
  };

  const handleSaveFinishesToLibrary = async () => {
    if (!tenantId) return;
    const candidates = finishes
      .map((finish) => ({
        name: finish.name.trim(),
        tags: (finish as any).tags || []
      }))
      .filter((item) => item.name.length > 0);

    if (candidates.length === 0) {
      toast.error("Ingen efterbehandlinger med navn at gemme");
      return;
    }

    const existingMap = new Map(
      finishLibrary.map((item) => [getNameKey(item.name), item])
    );
    const uniqueCandidates = new Map<string, { name: string; tags: string[] }>();
    candidates.forEach((item) => {
      const key = getNameKey(item.name);
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, item);
      }
    });

    const rows = Array.from(uniqueCandidates.values());
    if (rows.length === 0) {
      toast.message("Ingen efterbehandlinger at gemme");
      return;
    }

    setSavingFinishLibrary(true);
    try {
      const newCount = rows.filter((row) => !existingMap.has(getNameKey(row.name))).length;
      const updateCount = rows.length - newCount;
      const { error } = await supabase
        .from("storformat_finish_library" as any)
        .upsert(rows.map((row) => ({ tenant_id: tenantId, ...row })), { onConflict: "tenant_id,name" });
      if (error) throw error;
      if (updateCount > 0 && newCount > 0) {
        toast.success(`Gemt ${newCount} og opdateret ${updateCount} efterbehandling(er)`);
      } else if (updateCount > 0) {
        toast.success(`Opdateret ${updateCount} efterbehandling(er)`);
      } else {
        toast.success(`Gemt ${rows.length} efterbehandling(er)`);
      }
      fetchFinishLibrary();
    } catch (error: any) {
      console.error("Error saving finishes to library:", error);
      toast.error(error.message || "Kunne ikke gemme efterbehandlinger");
    } finally {
      setSavingFinishLibrary(false);
    }
  };

  const handleSaveProductsToLibrary = async () => {
    if (!tenantId) return;
    const candidates = products
      .map((product) => ({
        name: product.name.trim(),
        tags: (product as any).tags || []
      }))
      .filter((item) => item.name.length > 0);

    if (candidates.length === 0) {
      toast.error("Ingen produkter med navn at gemme");
      return;
    }

    const existingMap = new Map(
      productLibrary.map((item) => [getNameKey(item.name), item])
    );
    const uniqueCandidates = new Map<string, { name: string; tags: string[] }>();
    candidates.forEach((item) => {
      const key = getNameKey(item.name);
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, item);
      }
    });

    const rows = Array.from(uniqueCandidates.values());
    if (rows.length === 0) {
      toast.message("Ingen produkter at gemme");
      return;
    }

    setSavingProductLibrary(true);
    try {
      const newCount = rows.filter((row) => !existingMap.has(getNameKey(row.name))).length;
      const updateCount = rows.length - newCount;
      const { error } = await supabase
        .from("storformat_product_library" as any)
        .upsert(rows.map((row) => ({ tenant_id: tenantId, ...row })), { onConflict: "tenant_id,name" });
      if (error) throw error;
      if (updateCount > 0 && newCount > 0) {
        toast.success(`Gemt ${newCount} og opdateret ${updateCount} produkt(er)`);
      } else if (updateCount > 0) {
        toast.success(`Opdateret ${updateCount} produkt(er)`);
      } else {
        toast.success(`Gemt ${rows.length} produkt(er)`);
      }
      fetchProductLibrary();
    } catch (error: any) {
      console.error("Error saving products to library:", error);
      toast.error(error.message || "Kunne ikke gemme produkter");
    } finally {
      setSavingProductLibrary(false);
    }
  };

  const handleAddMaterialFromLibrary = async (item: MaterialLibraryItem) => {
    if (!tenantId) return;
    const newMaterial = createMaterial();
    newMaterial.name = item.name;
    newMaterial.max_width_mm = item.max_width_mm ?? null;
    newMaterial.max_height_mm = item.max_height_mm ?? null;
    newMaterial.thumbnail_url = null;
    (newMaterial as any).tags = item.tags || [];

    try {
      const { data, error } = await supabase
        .from("storformat_materials" as any)
        .insert({
          id: newMaterial.id,
          tenant_id: tenantId,
          product_id: productId,
          name: newMaterial.name,
          group_label: newMaterial.group_label || null,
          thumbnail_url: null,
          tags: item.tags || [],
          bleed_mm: (newMaterial as any).bleed_mm ?? 3,
          safe_area_mm: (newMaterial as any).safe_area_mm ?? 3,
          max_width_mm: newMaterial.max_width_mm || null,
          max_height_mm: newMaterial.max_height_mm || null,
          allow_split: newMaterial.allow_split ?? true,
          interpolation_enabled: newMaterial.interpolation_enabled ?? true,
          markup_pct: newMaterial.markup_pct || 0,
          sort_order: materials.length,
        })
        .select()
        .single();
      if (error) throw error;
      const saved = { ...newMaterial, id: data.id };
      setMaterials((prev) => [...prev, saved]);
      setExpandedMaterialId(saved.id || null);
      setActiveM2MaterialId(saved.id || null);
      toast.success("Materiale tilføjet fra bibliotek");
    } catch (err: any) {
      console.error("Add material from library error", err);
      setMaterials((prev) => [...prev, newMaterial]);
      setExpandedMaterialId(newMaterial.id || null);
      setActiveM2MaterialId(newMaterial.id || null);
    }
  };

  const handleAddFinishFromLibrary = async (item: FinishLibraryItem) => {
    if (!tenantId) return;
    const newFinish = createFinish();
    newFinish.name = item.name;
    (newFinish as any).tags = item.tags || [];

    try {
      const { data, error } = await supabase
        .from("storformat_finishes" as any)
        .insert({
          id: newFinish.id,
          tenant_id: tenantId,
          product_id: productId,
          name: newFinish.name,
          group_label: newFinish.group_label || null,
          thumbnail_url: newFinish.thumbnail_url || null,
          tags: item.tags || [],
          pricing_mode: newFinish.pricing_mode,
          fixed_price_per_unit: newFinish.fixed_price_per_unit || 0,
          interpolation_enabled: newFinish.interpolation_enabled ?? true,
          markup_pct: newFinish.markup_pct || 0,
          sort_order: finishes.length,
        })
        .select()
        .single();
      if (error) throw error;
      const saved = { ...newFinish, id: data.id };
      setFinishes((prev) => [...prev, saved]);
      setExpandedFinishId(saved.id || null);
      if (saved.id) {
        setFinishPrices((prev) => ({
          ...prev,
          [saved.id as string]: {
            pricing_mode: saved.pricing_mode,
            fixed_price: 0,
            price_per_m2: 0
          }
        }));
      }
      toast.success("Efterbehandling tilføjet fra bibliotek");
    } catch (err: any) {
      console.error("Add finish from library error", err);
      setFinishes((prev) => [...prev, newFinish]);
      setExpandedFinishId(newFinish.id || null);
      if (newFinish.id) {
        setFinishPrices((prev) => ({
          ...prev,
          [newFinish.id as string]: {
            pricing_mode: newFinish.pricing_mode,
            fixed_price: 0,
            price_per_m2: 0
          }
        }));
      }
    }
  };

  const handleAddProductFromLibrary = async (item: ProductLibraryItem) => {
    if (!tenantId) return;
    const newProduct = createProduct();
    newProduct.name = item.name;
    (newProduct as any).tags = item.tags || [];

    try {
      const { data, error } = await supabase
        .from("storformat_products" as any)
        .insert({
          id: newProduct.id,
          tenant_id: tenantId,
          product_id: productId,
          name: newProduct.name,
          group_label: newProduct.group_label || null,
          thumbnail_url: newProduct.thumbnail_url || null,
          tags: item.tags || [],
          pricing_mode: newProduct.pricing_mode || "fixed",
          pricing_type: newProduct.pricing_type || "fixed",
          initial_price: newProduct.initial_price || 0,
          interpolation_enabled: newProduct.interpolation_enabled ?? true,
          markup_pct: newProduct.markup_pct || 0,
          sort_order: products.length,
        })
        .select()
        .single();
      if (error) throw error;
      const saved = { ...newProduct, id: data.id };
      setProducts((prev) => [...prev, saved]);
      setExpandedProductId(saved.id || null);
      toast.success("Produkt tilføjet fra bibliotek");
    } catch (err: any) {
      console.error("Add product from library error", err);
      setProducts((prev) => [...prev, newProduct]);
      setExpandedProductId(newProduct.id || null);
    }
  };

  const visibleMaterials = filterCatalogItems("materials", materials);
  const visibleFinishes = filterCatalogItems("finishes", finishes);
  const visibleProducts = filterCatalogItems("products", products);
  const MAX_VISIBLE_CATALOG = 10;
  const materialKeys = new Set(
    materials.map((material) => getMaterialKey(material.name, material.max_width_mm, material.max_height_mm))
  );
  const finishKeys = new Set(
    finishes.map((finish) => getNameKey(finish.name))
  );
  const productKeys = new Set(
    products.map((product) => getNameKey(product.name))
  );
  const materialLibraryTags = Array.from(
    new Set(materialLibrary.flatMap((item) => item.tags || []).filter(Boolean))
  ).sort();
  const filteredMaterialLibrary = materialLibrary
    .filter((item) => {
      if (!materialLibrarySearch) return true;
      const query = materialLibrarySearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        (item.tags || []).some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .filter((item) => {
      if (!materialLibraryTagFilter) return true;
      return (item.tags || []).includes(materialLibraryTagFilter);
    });
  const finishLibraryTags = Array.from(
    new Set(finishLibrary.flatMap((item) => item.tags || []).filter(Boolean))
  ).sort();
  const filteredFinishLibrary = finishLibrary
    .filter((item) => {
      if (!finishLibrarySearch) return true;
      const query = finishLibrarySearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        (item.tags || []).some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .filter((item) => {
      if (!finishLibraryTagFilter) return true;
      return (item.tags || []).includes(finishLibraryTagFilter);
    });
  const productLibraryTags = Array.from(
    new Set(productLibrary.flatMap((item) => item.tags || []).filter(Boolean))
  ).sort();
  const filteredProductLibrary = productLibrary
    .filter((item) => {
      if (!productLibrarySearch) return true;
      const query = productLibrarySearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        (item.tags || []).some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .filter((item) => {
      if (!productLibraryTagFilter) return true;
      return (item.tags || []).includes(productLibraryTagFilter);
    });

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
  const activeM2Material = materials.find((m) => m.id === activeM2MaterialId) || materials[0] || null;
  // Sorted version for calculations/preview
  const activeM2Prices = activeM2Material ? getM2PricesForMaterial(activeM2Material.id!) : [];
  // Unsorted (insertion-order) version for editing - prevents rows from jumping while typing
  const activeM2PricesUnsorted = activeM2Material
    ? m2Prices.filter((p) => p.material_id === activeM2Material.id!)
    : [];
  const matrixLayoutBypassed = isBannerBuilderProduct;
  const showMatrixLayoutToolsForProduct = !matrixLayoutBypassed || showMatrixLayoutTools;
  const activeFinishIdSet = new Set(
    bannerBuilderPricingSelection.activeFinishIds.filter(Boolean),
  );
  const activeProductItemIdSet = new Set(
    bannerBuilderPricingSelection.activeProductItemIds.filter(Boolean),
  );
  const activeFrontendFinishes = finishes.filter(
    (finish) => !!finish.id && activeFinishIdSet.has(finish.id),
  );
  const activeFrontendProducts = products.filter(
    (item) => !!item.id && activeProductItemIdSet.has(item.id),
  );

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
                        <p className="text-xs text-muted-foreground">Materialer med max mål og produktionsindstillinger. Priser sættes i prisgeneratoren.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTagManagementType("materials");
                            setShowTagManagementDialog(true);
                          }}
                          title="Administrer tags"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                          const newMaterial = createMaterial();
                          newMaterial.name = "Nyt materiale";
                          try {
                            const { data, error } = await supabase
                              .from("storformat_materials" as any)
                              .insert({
                                id: newMaterial.id,
                                tenant_id: tenantId,
                                product_id: productId,
                                name: newMaterial.name,
                                group_label: newMaterial.group_label || null,
                                thumbnail_url: newMaterial.thumbnail_url || null,
                                bleed_mm: (newMaterial as any).bleed_mm ?? 3,
                                safe_area_mm: (newMaterial as any).safe_area_mm ?? 3,
                                max_width_mm: newMaterial.max_width_mm || null,
                                max_height_mm: newMaterial.max_height_mm || null,
                                allow_split: newMaterial.allow_split ?? true,
                                interpolation_enabled: newMaterial.interpolation_enabled ?? true,
                                markup_pct: newMaterial.markup_pct || 0,
                                sort_order: materials.length,
                              })
                              .select()
                              .single();
                            if (error) throw error;
                            const saved = { ...newMaterial, id: data.id };
                            setMaterials((prev) => [...prev, saved]);
                            setExpandedMaterialId(saved.id || null);
                            setActiveM2MaterialId(saved.id || null);
                            toast.success("Materiale oprettet");
                          } catch (err: any) {
                            console.error("Auto-save material error", err);
                            // Fallback: add locally without DB
                            setMaterials((prev) => [...prev, newMaterial]);
                            setExpandedMaterialId(newMaterial.id || null);
                            setActiveM2MaterialId(newMaterial.id || null);
                          }
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                          Opret nyt
                        </Button>
                      </div>
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
                                onClick={() => handleCopyMaterial(material)}
                                disabled={copyingItemId === material.id}
                                title="Kopier materiale"
                              >
                                {copyingItemId === material.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteMaterial(material)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Tags</Label>
                              <TagInput
                                value={(material as any).tags || []}
                                onChange={(tags) => updateMaterial(material.id!, { tags } as any)}
                                suggestions={tagOptionsByType.materials}
                                placeholder="Tilføj tags..."
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Gruppe (valgfri)</Label>
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
                          </div>

                          {/* Design Library Link */}
                          <div className="flex items-center justify-between gap-2 p-3 rounded-md border bg-muted/30">
                            <div>
                              <Label className="text-xs">Designbibliotek</Label>
                              <p className="text-[11px] text-muted-foreground">
                                {(material as any).design_library_item_id
                                  ? "Linket til designbibliotek"
                                  : "Link til et element i designbiblioteket"}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDesignLibrarySelector(material.id!)}
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1" />
                              {(material as any).design_library_item_id ? "Skift" : "Link"}
                            </Button>
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

                          {/* Minimum price */}
                          <div className="space-y-1">
                            <Label className="text-xs">Minimumspris (kr)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={material.min_price ?? 0}
                              onChange={(e) => updateMaterial(material.id!, { min_price: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              className="w-32"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Mindstepris uanset størrelse – bruges til at sikre rentabilitet på små ordrer
                            </p>
                          </div>

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

                          {/* Master tenant sharing toggle */}
                          {tenantId === MASTER_TENANT_ID && (
                            <div className="flex items-center justify-between gap-2 p-3 rounded-md border bg-primary/5">
                              <div>
                                <Label className="text-xs font-medium">Del med alle lejere</Label>
                                <p className="text-[11px] text-muted-foreground">Gør materialet tilgængeligt for alle tenants</p>
                              </div>
                              <Switch
                                checked={(material as any).visibility === "public"}
                                onCheckedChange={(checked) => updateMaterial(material.id!, { visibility: checked ? "public" : "tenant" } as any)}
                              />
                            </div>
                          )}

                          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                            M²-priser redigeres i afsnittet "Prisgenerator" nedenfor.
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Gemte materialer</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={handleSaveMaterialsToLibrary}
                            disabled={savingMaterialLibrary || materials.length === 0}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Gem til bibliotek
                          </Button>
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
                      <p className="text-[11px] text-muted-foreground">
                        Billeder her gælder kun denne prisliste.
                      </p>
                      {visibleMaterials.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen gemte materialer endnu</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {visibleMaterials.slice(0, MAX_VISIBLE_CATALOG).map((material) => {
                            const settings = valueSettingsById[material.id || ""] || {};
                            const thumbnailUrl = settings.customImage || material.thumbnail_url || "";
                            const isSelected = expandedMaterialId === material.id;
                            return (
                              <div
                                key={`saved-${material.id}`}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/40"
                                )}
                                onClick={() => handleCatalogCardClick("materials", material.id!)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleCatalogCardClick("materials", material.id!);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {thumbnailUrl && (
                                    <img src={thumbnailUrl} className="w-7 h-7 rounded object-cover" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{material.name}</div>
                                    {((material as any).tags?.length > 0 || material.group_label) && (
                                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                                        {((material as any).tags || []).slice(0, 2).map((tag: string) => (
                                          <Badge
                                            key={tag}
                                            variant={isSelected ? "outline" : "secondary"}
                                            className="text-[9px] px-1 py-0 h-4"
                                          >
                                            {tag}
                                          </Badge>
                                        ))}
                                        {(material as any).tags?.length > 2 && (
                                          <span className={cn("text-[9px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                            +{(material as any).tags.length - 2}
                                          </span>
                                        )}
                                        {material.group_label && !(material as any).tags?.includes(material.group_label) && (
                                          <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                            {material.group_label}
                                          </span>
                                        )}
                                      </div>
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
                              </div>
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

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Materialebibliotek</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={materialLibrarySearch}
                            onChange={(e) => setMaterialLibrarySearch(e.target.value)}
                            placeholder="Søg..."
                            className="h-8 w-40"
                          />
                          <Select
                            value={materialLibraryTagFilter || "all"}
                            onValueChange={(value) => setMaterialLibraryTagFilter(value === "all" ? "" : value)}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue placeholder="Tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle tags</SelectItem>
                              {materialLibraryTags.map((tag) => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={fetchMaterialLibrary}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {materialLibraryLoading ? (
                        <div className="text-xs text-muted-foreground italic">Indlæser bibliotek...</div>
                      ) : filteredMaterialLibrary.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen materialer i biblioteket</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {filteredMaterialLibrary.map((item) => {
                            const key = getMaterialKey(item.name, item.max_width_mm, item.max_height_mm);
                            const isInProduct = materialKeys.has(key);
                            const maxLabel = item.max_width_mm || item.max_height_mm
                              ? `Max ${item.max_width_mm ? `${item.max_width_mm / 10} cm` : "—"} × ${item.max_height_mm ? `${item.max_height_mm / 10} cm` : "—"}`
                              : "Ingen max størrelse";
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 bg-background"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{item.name}</div>
                                  <div className="text-[11px] text-muted-foreground">{maxLabel}</div>
                                  {(item.tags || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(item.tags || []).slice(0, 3).map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {(item.tags || []).length > 3 && (
                                        <span className="text-[9px] text-muted-foreground">+{(item.tags || []).length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={isInProduct}
                                  onClick={() => handleAddMaterialFromLibrary(item)}
                                >
                                  {isInProduct ? "Tilføjet" : "Tilføj"}
                                </Button>
                              </div>
                            );
                          })}
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
                        <p className="text-xs text-muted-foreground">Efterbehandlinger som navnevalg. Priser sættes i prisgeneratoren.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTagManagementType("finishes");
                            setShowTagManagementDialog(true);
                          }}
                          title="Administrer tags"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                          const newFinish = createFinish();
                          newFinish.name = "Ny efterbehandling";
                          try {
                            const { data, error } = await supabase
                              .from("storformat_finishes" as any)
                              .insert({
                                id: newFinish.id,
                                tenant_id: tenantId,
                                product_id: productId,
                                name: newFinish.name,
                                group_label: newFinish.group_label || null,
                                thumbnail_url: newFinish.thumbnail_url || null,
                                tags: (newFinish as any).tags || [],
                                pricing_mode: newFinish.pricing_mode,
                                fixed_price_per_unit: newFinish.fixed_price_per_unit || 0,
                                interpolation_enabled: newFinish.interpolation_enabled ?? true,
                                markup_pct: newFinish.markup_pct || 0,
                                sort_order: finishes.length,
                              })
                              .select()
                              .single();
                            if (error) throw error;
                            const saved = { ...newFinish, id: data.id };
                            setFinishes((prev) => [...prev, saved]);
                            setExpandedFinishId(saved.id || null);
                            if (saved.id) {
                              setFinishPrices((prev) => ({
                                ...prev,
                                [saved.id as string]: {
                                  pricing_mode: saved.pricing_mode,
                                  fixed_price: 0,
                                  price_per_m2: 0
                                }
                              }));
                            }
                            toast.success("Efterbehandling oprettet");
                          } catch (err: any) {
                            console.error("Auto-save finish error", err);
                            setFinishes((prev) => [...prev, newFinish]);
                            setExpandedFinishId(newFinish.id || null);
                            if (newFinish.id) {
                              setFinishPrices((prev) => ({
                                ...prev,
                                [newFinish.id as string]: {
                                  pricing_mode: newFinish.pricing_mode,
                                  fixed_price: 0,
                                  price_per_m2: 0
                                }
                              }));
                            }
                          }
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                          Opret ny
                        </Button>
                      </div>
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
                                onClick={() => handleCopyFinish(finish)}
                                disabled={copyingItemId === finish.id}
                                title="Kopier efterbehandling"
                              >
                                {copyingItemId === finish.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteFinish(finish)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Tags</Label>
                              <TagInput
                                value={(finish as any).tags || []}
                                onChange={(tags) => updateFinish(finish.id!, { tags } as any)}
                                suggestions={tagOptionsByType.finishes}
                                placeholder="Tilføj tags..."
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Gruppe (valgfri)</Label>
                                <Input
                                  value={finish.group_label ?? ""}
                                  onChange={(e) => updateFinish(finish.id!, { group_label: e.target.value })}
                                  placeholder="F.eks. Lamineret"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Master tenant sharing toggle */}
                          {tenantId === MASTER_TENANT_ID && (
                            <div className="flex items-center justify-between gap-2 p-3 rounded-md border bg-primary/5">
                              <div>
                                <Label className="text-xs font-medium">Del med alle lejere</Label>
                                <p className="text-[11px] text-muted-foreground">Gør efterbehandlingen tilgængelig for alle tenants</p>
                              </div>
                              <Switch
                                checked={(finish as any).visibility === "public"}
                                onCheckedChange={(checked) => updateFinish(finish.id!, { visibility: checked ? "public" : "tenant" } as any)}
                              />
                            </div>
                          )}

                          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                            Priser for efterbehandlinger redigeres i afsnittet "Prisgenerator" nedenfor.
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Gemte efterbehandlinger</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={handleSaveFinishesToLibrary}
                            disabled={savingFinishLibrary || finishes.length === 0}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Gem til bibliotek
                          </Button>
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
                              <div
                                key={`saved-${finish.id}`}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/40"
                                )}
                                onClick={() => handleCatalogCardClick("finishes", finish.id!)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleCatalogCardClick("finishes", finish.id!);
                                  }
                                }}
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
                                  {isBannerBuilderProduct && (
                                    <Button
                                      variant={activeFinishIdSet.has(finish.id || "") ? "default" : "outline"}
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      disabled={savingBannerBuilderSelection}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleBannerBuilderSelection("finish", finish.id!);
                                      }}
                                    >
                                      {activeFinishIdSet.has(finish.id || "") ? "Aktiv" : "Aktiv i frontend"}
                                    </Button>
                                  )}
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
                              </div>
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

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Efterbehandling bibliotek</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={finishLibrarySearch}
                            onChange={(e) => setFinishLibrarySearch(e.target.value)}
                            placeholder="Søg..."
                            className="h-8 w-40"
                          />
                          <Select
                            value={finishLibraryTagFilter || "all"}
                            onValueChange={(value) => setFinishLibraryTagFilter(value === "all" ? "" : value)}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue placeholder="Tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle tags</SelectItem>
                              {finishLibraryTags.map((tag) => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={fetchFinishLibrary}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {finishLibraryLoading ? (
                        <div className="text-xs text-muted-foreground italic">Indlæser bibliotek...</div>
                      ) : filteredFinishLibrary.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen efterbehandlinger i biblioteket</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {filteredFinishLibrary.map((item) => {
                            const isInProduct = finishKeys.has(getNameKey(item.name));
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 bg-background"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{item.name}</div>
                                  {(item.tags || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(item.tags || []).slice(0, 3).map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {(item.tags || []).length > 3 && (
                                        <span className="text-[9px] text-muted-foreground">+{(item.tags || []).length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={isInProduct}
                                  onClick={() => handleAddFinishFromLibrary(item)}
                                >
                                  {isInProduct ? "Tilføjet" : "Tilføj"}
                                </Button>
                              </div>
                            );
                          })}
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
                        <p className="text-xs text-muted-foreground">
                          Produkterne bruges som valg i layoutet. Priser styres i prisgeneratoren.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTagManagementType("products");
                            setShowTagManagementDialog(true);
                          }}
                          title="Administrer tags"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowProductImportDialog(true)}
                        >
                          <Library className="h-3.5 w-3.5 mr-1" />
                          Import fra bibliotek
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const newProduct = createProduct();
                            newProduct.name = "Nyt produkt";
                            try {
                              const { data, error } = await supabase
                                .from("storformat_products" as any)
                                .insert({
                                  id: newProduct.id,
                                  tenant_id: tenantId,
                                  product_id: productId,
                                  name: newProduct.name,
                                  group_label: newProduct.group_label || null,
                                  thumbnail_url: newProduct.thumbnail_url || null,
                                  tags: (newProduct as any).tags || [],
                                  pricing_mode: newProduct.pricing_mode || "fixed",
                                  pricing_type: newProduct.pricing_type || "fixed",
                                  initial_price: newProduct.initial_price || 0,
                                  interpolation_enabled: newProduct.interpolation_enabled ?? true,
                                  markup_pct: newProduct.markup_pct || 0,
                                  sort_order: products.length,
                                })
                                .select()
                                .single();
                              if (error) throw error;
                              const saved = { ...newProduct, id: data.id };
                              setProducts((prev) => [...prev, saved]);
                              setExpandedProductId(saved.id || null);
                              toast.success("Produkt oprettet");
                            } catch (err: any) {
                              console.error("Auto-save product error", err);
                              setProducts((prev) => [...prev, newProduct]);
                              setExpandedProductId(newProduct.id || null);
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Opret nyt
                        </Button>
                      </div>
                    </div>

                    {/* Library Import Dialog for Products */}
                    <AddonLibraryImportDialog
                      open={showProductImportDialog}
                      onOpenChange={setShowProductImportDialog}
                      productId={productId}
                      tenantId={tenantId}
                      onImportComplete={() => productAddons.refresh()}
                    />

                    {/* Design Library Selector for Materials */}
                    <DesignLibrarySelector
                      open={showDesignLibrarySelector}
                      onOpenChange={setShowDesignLibrarySelector}
                      onSelect={handleDesignLibrarySelect}
                      selectedId={designLibrarySelectorTarget ? (materials.find(m => m.id === designLibrarySelectorTarget) as any)?.design_library_item_id : null}
                      title="Link materiale til designbibliotek"
                      filterKinds={["image", "svg"]}
                    />

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
                                onClick={() => handleCopyProduct(productItem)}
                                disabled={copyingItemId === productItem.id}
                                title="Kopier produkt"
                              >
                                {copyingItemId === productItem.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProduct(productItem)}
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
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tags</Label>
                            <TagInput
                              value={(productItem as any).tags || []}
                              onChange={(tags) => updateProduct(productItem.id!, { tags } as any)}
                              suggestions={tagOptionsByType.products}
                              placeholder="Tilføj tags..."
                            />
                          </div>

                          {/* Product Pricing Type Selection */}
                          <div className="space-y-4 pt-4 border-t">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Pristype</Label>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={(productItem.pricing_type || "fixed") === "fixed" ? "default" : "outline"}
                                  onClick={() => updateProduct(productItem.id!, { pricing_type: "fixed" as ProductPricingType })}
                                >
                                  Fast pris
                                </Button>
                                <Button
                                  size="sm"
                                  variant={productItem.pricing_type === "per_item" ? "default" : "outline"}
                                  onClick={() => updateProduct(productItem.id!, { pricing_type: "per_item" as ProductPricingType })}
                                >
                                  Pr. stk
                                </Button>
                                <Button
                                  size="sm"
                                  variant={productItem.pricing_type === "m2" ? "default" : "outline"}
                                  onClick={() => updateProduct(productItem.id!, { pricing_type: "m2" as ProductPricingType })}
                                >
                                  Egen m²-pris
                                </Button>
                              </div>
                            </div>

                            {/* Fixed pricing */}
                            {(productItem.pricing_type === "fixed" || !productItem.pricing_type) && (
                              <div className="space-y-2">
                                <Label className="text-xs">Fast pris pr. stk (kr)</Label>
                                <Input
                                  type="number"
                                  value={productItem.initial_price ?? 0}
                                  onChange={(e) => updateProduct(productItem.id!, { initial_price: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  className="w-32"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Tillægges til materialepris pr. stk
                                </p>
                              </div>
                            )}

                            {/* Per item pricing */}
                            {productItem.pricing_type === "per_item" && (
                              <div className="space-y-2">
                                <Label className="text-xs">Pris pr. antal</Label>
                                <p className="text-xs text-muted-foreground">
                                  Sæt priserne i prisgeneratoren nedenfor
                                </p>
                              </div>
                            )}

                            {/* M2 pricing */}
                            {productItem.pricing_type === "m2" && (
                              <div className="space-y-2">
                                <Label className="text-xs">M²-priser</Label>
                                <p className="text-xs text-muted-foreground">
                                  Sæt priserne i prisgeneratoren nedenfor
                                </p>
                              </div>
                            )}

                            {/* Minimum price */}
                            <div className="space-y-2">
                              <Label className="text-xs">Minimumspris (kr)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={productItem.min_price ?? 0}
                                onChange={(e) => updateProduct(productItem.id!, { min_price: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                                className="w-32"
                              />
                              <p className="text-xs text-muted-foreground">
                                Mindstepris uanset størrelse – bruges til at sikre rentabilitet på små ordrer
                              </p>
                            </div>

                            {/* Master tenant sharing toggle */}
                            {tenantId === MASTER_TENANT_ID && (
                              <div className="flex items-center justify-between gap-2 p-3 rounded-md border bg-primary/5">
                                <div>
                                  <Label className="text-xs font-medium">Del med alle lejere</Label>
                                  <p className="text-[11px] text-muted-foreground">Gør produktet tilgængeligt for alle tenants</p>
                                </div>
                                <Switch
                                  checked={(productItem as any).visibility === "public"}
                                  onCheckedChange={(checked) => updateProduct(productItem.id!, { visibility: checked ? "public" : "tenant" } as any)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Gemte produkter</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={handleSaveProductsToLibrary}
                            disabled={savingProductLibrary || products.length === 0}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Gem til bibliotek
                          </Button>
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
                              <div
                                key={`saved-${productItem.id}`}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/40"
                                )}
                                onClick={() => handleCatalogCardClick("products", productItem.id!)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleCatalogCardClick("products", productItem.id!);
                                  }
                                }}
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
                                  {isBannerBuilderProduct && (
                                    <Button
                                      variant={activeProductItemIdSet.has(productItem.id || "") ? "default" : "outline"}
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      disabled={savingBannerBuilderSelection}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleBannerBuilderSelection("product", productItem.id!);
                                      }}
                                    >
                                      {activeProductItemIdSet.has(productItem.id || "") ? "Aktiv" : "Aktiv i frontend"}
                                    </Button>
                                  )}
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
                              </div>
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

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] text-muted-foreground uppercase">Produktbibliotek</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={productLibrarySearch}
                            onChange={(e) => setProductLibrarySearch(e.target.value)}
                            placeholder="Søg..."
                            className="h-8 w-40"
                          />
                          <Select
                            value={productLibraryTagFilter || "all"}
                            onValueChange={(value) => setProductLibraryTagFilter(value === "all" ? "" : value)}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue placeholder="Tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle tags</SelectItem>
                              {productLibraryTags.map((tag) => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={fetchProductLibrary}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {productLibraryLoading ? (
                        <div className="text-xs text-muted-foreground italic">Indlæser bibliotek...</div>
                      ) : filteredProductLibrary.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Ingen produkter i biblioteket</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {filteredProductLibrary.map((item) => {
                            const isInProduct = productKeys.has(getNameKey(item.name));
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 bg-background"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{item.name}</div>
                                  {(item.tags || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(item.tags || []).slice(0, 3).map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {(item.tags || []).length > 3 && (
                                        <span className="text-[9px] text-muted-foreground">+{(item.tags || []).length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={isInProduct}
                                  onClick={() => handleAddProductFromLibrary(item)}
                                >
                                  {isInProduct ? "Tilføjet" : "Tilføj"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isBannerBuilderProduct && (
              <Card className="border-sky-200 bg-sky-50/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Frontend aktive valg (Banner Builder Pro)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Vælg hvilke efterbehandlinger og produkter der er aktive i live banner-preview.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Aktive efterbehandlinger</Label>
                      {activeFrontendFinishes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Ingen aktive valg endnu. Klik "Aktiv i frontend" pa kortene i Efterbehandling.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {activeFrontendFinishes.map((finish) => (
                            <Badge key={finish.id} variant="secondary">
                              {finish.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Aktive produkter</Label>
                      {activeFrontendProducts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Ingen aktive valg endnu. Klik "Aktiv i frontend" pa kortene i Produkter.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {activeFrontendProducts.map((productItem) => (
                            <Badge key={productItem.id} variant="secondary">
                              {productItem.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {savingBannerBuilderSelection && (
                    <p className="text-xs text-muted-foreground">
                      Gemmer frontend-valg...
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

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

            {matrixLayoutBypassed && !showMatrixLayoutTools && (
              <Card className="border-dashed border-slate-300/90 bg-slate-100/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                    <LayoutGrid className="h-4 w-4" />
                    Prisliste layout (matrix) skjult
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Banner Builder Pro bruger prisgeneratoren som live-kilde til frontend.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 max-w-3xl">
                    Matrix-layout og matrix-forhåndsvisning er skjult for at undgå forvirring.
                    Brug prisgeneratoren nedenfor til priserne, som sendes videre til shoppen.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowMatrixLayoutTools(true)}>
                    Vis matrix-værktøjer
                  </Button>
                </CardContent>
              </Card>
            )}

            {showMatrixLayoutToolsForProduct && (
            <Card ref={layoutRef}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Prisliste Layout
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {matrixLayoutBypassed && (
                      <Button variant="ghost" size="sm" onClick={() => setShowMatrixLayoutTools(false)}>
                        Skjul matrix-værktøjer
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleResetLayoutConfig}>
                      <RotateCcw className="h-3.5 w-3.5 mr-2" />
                      Nulstil layout
                    </Button>
                  </div>
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
                                  <SelectTrigger className="h-7 text-xs w-[130px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="buttons">Knapper</SelectItem>
                                    <SelectItem value="dropdown">Dropdown</SelectItem>
                                    <SelectItem value="checkboxes">Checkboxes</SelectItem>
                                    <SelectItem value="small">Billeder S (40px)</SelectItem>
                                    <SelectItem value="medium">Billeder M (64px)</SelectItem>
                                    <SelectItem value="large">Billeder L (96px)</SelectItem>
                                    <SelectItem value="xl">Billeder XL (128px)</SelectItem>
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
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Prisgenerator
                </CardTitle>
                <CardDescription className="text-xs">
                  Opsæt m²-intervaller og generer priser pr. materiale.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Material buttons */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Materialer</Label>
                  <div className="flex flex-wrap gap-2">
                    {materials.map((material) => (
                      <Button
                        key={material.id}
                        size="sm"
                        variant={activeM2MaterialId === material.id ? "default" : "outline"}
                        onClick={() => {
                          setActiveM2MaterialId(material.id || null);
                          setGlobalAdjustPct(0);
                          setGlobalAdjustBasePrices({});
                        }}
                        className="h-8"
                      >
                        {material.thumbnail_url && (
                          <img src={material.thumbnail_url} className="w-4 h-4 rounded mr-1.5 object-cover" alt="" />
                        )}
                        {material.name || "Unavngivet"}
                      </Button>
                    ))}
                  </div>
                  {/* Copy from material */}
                  {activeM2MaterialId && materials.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Kopier priser fra:</span>
                      <Select onValueChange={(sourceMaterialId) => {
                        const sourcePrices = getM2PricesForMaterial(sourceMaterialId);
                        if (sourcePrices.length > 0 && activeM2MaterialId) {
                          setM2PricesForMaterial(activeM2MaterialId, sourcePrices.map(p => ({
                            from_m2: p.from_m2,
                            to_m2: p.to_m2,
                            price_per_m2: p.price_per_m2,
                            is_anchor: p.is_anchor,
                          })));
                          toast.success("Priser kopieret");
                        }
                      }}>
                        <SelectTrigger className="h-7 w-[180px] text-xs">
                          <SelectValue placeholder="Vælg materiale..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.filter(m => m.id !== activeM2MaterialId).map(m => (
                            <SelectItem key={m.id} value={m.id!}>{m.name || "Unavngivet"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {!activeM2Material ? (
                  <div className="text-xs text-muted-foreground">
                    Opret mindst ét materiale for at sætte m²-priser.
                  </div>
                ) : (
                  <>
                    {/* Simple price rows */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">M²-priser for "{activeM2Material.name || "Unavngivet"}"</Label>
                      {activeM2PricesUnsorted.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
                          Ingen prisintervaller endnu. Tilføj dit første interval nedenfor.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeM2PricesUnsorted.map((tier) => (
                            <div key={tier.id} className="border rounded-lg p-3 space-y-2">
                              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Fra m²</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={tier.from_m2}
                                    onChange={(e) => updateM2Tier(activeM2Material.id!, tier.id!, { from_m2: Number(e.target.value) || 0 })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Til m²</Label>
                                  <Input
                                    type="number"
                                    value={tier.to_m2 ?? ""}
                                    onChange={(e) => updateM2Tier(activeM2Material.id!, tier.id!, { to_m2: e.target.value ? Number(e.target.value) : null })}
                                    className="h-8 text-sm"
                                    placeholder="∞"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Pris kr/m²</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={tier.price_per_m2}
                                    onChange={(e) => {
                                      updateM2Tier(activeM2Material.id!, tier.id!, { price_per_m2: Number(e.target.value) || 0 });
                                      // If this is an anchor, recalculate interpolated prices
                                      if (tier.is_anchor) {
                                        setTimeout(() => interpolateM2Prices(activeM2Material.id!), 0);
                                      }
                                    }}
                                    className={cn("h-8 text-sm", tier.is_anchor && "border-primary/50 bg-primary/5")}
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeM2Tier(activeM2Material.id!, tier.id!)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {/* Per-row anchor toggle + price slider */}
                              <div className="flex items-center gap-3 pl-1">
                                <div className="flex items-center gap-1.5">
                                  <Checkbox
                                    checked={tier.is_anchor ?? false}
                                    onCheckedChange={(checked) => {
                                      updateM2Tier(activeM2Material.id!, tier.id!, { is_anchor: !!checked });
                                      // After toggling, recalculate interpolated prices
                                      setTimeout(() => interpolateM2Prices(activeM2Material.id!), 0);
                                    }}
                                  />
                                  <span className="text-xs text-muted-foreground">Ankerpunkt</span>
                                </div>
                                <div className="flex-1 px-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">-100%</span>
                                    <CenterSlider
                                      value={[m2TierAdjustments[tier.id!] ?? 0]}
                                      min={-100}
                                      max={100}
                                      step={1}
                                      onValueChange={([v]) => {
                                        const hasBase = m2TierAdjustBasePrices[tier.id!];
                                        const basePrice = hasBase ? m2TierAdjustBasePrices[tier.id!] : (tier.price_per_m2 || 100);
                                        if (!hasBase) {
                                          setM2TierAdjustBasePrices(prev => ({ ...prev, [tier.id!]: basePrice }));
                                        }
                                        setM2TierAdjustments(prev => ({ ...prev, [tier.id!]: v }));
                                        const newPrice = Math.max(1, Math.round(basePrice * (1 + v / 100)));
                                        updateM2Tier(activeM2Material.id!, tier.id!, { price_per_m2: newPrice });
                                        // If this is an anchor, recalculate interpolated rows
                                        if (tier.is_anchor) {
                                          setTimeout(() => interpolateM2Prices(activeM2Material.id!), 0);
                                        }
                                      }}
                                      onValueCommit={() => {
                                        setM2TierAdjustBasePrices(prev => {
                                          const next = { ...prev };
                                          delete next[tier.id!];
                                          return next;
                                        });
                                      }}
                                      className="flex-1"
                                    />
                                    <span className="text-[10px] text-muted-foreground">+100%</span>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {(m2TierAdjustments[tier.id!] ?? 0) > 0 ? "+" : ""}
                                      {m2TierAdjustments[tier.id!] ?? 0}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => addM2Tier(activeM2Material.id!)} className="w-full h-8">
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tilføj prisinterval
                      </Button>
                    </div>

                    {/* Inline quick preview */}
                    <div className="border-t pt-3">
                      <Label className="text-xs text-muted-foreground">Hurtig forhåndsvisning</Label>
                      <div className="grid grid-cols-5 gap-1 mt-1">
                        {[0.5, 1, 3, 5, 10].map(m2 => {
                          const tierMatch = [...activeM2Prices].sort((a, b) => a.from_m2 - b.from_m2).find(t => {
                            const toM2 = t.to_m2 ?? Number.POSITIVE_INFINITY;
                            return m2 >= t.from_m2 && m2 <= toM2;
                          });
                          const pricePerM2 = tierMatch?.price_per_m2 || 0;
                          const rounding = config.rounding_step || 1;
                          const total = Math.round((pricePerM2 * m2) / rounding) * rounding;
                          return (
                            <div key={m2} className="text-center p-1.5 bg-muted/20 rounded text-xs">
                              <div className="text-muted-foreground">{m2} m²</div>
                              <div className="font-medium">{total} kr</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Product pricing section */}
                {products.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <Label className="text-xs font-medium">Produktpriser</Label>
                    <div className="space-y-2">
                      {products.map((productItem) => (
                        <div key={productItem.id} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{productItem.name || "Unavngivet"}</span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={(productItem.pricing_type || "fixed") === "fixed" ? "default" : "outline"}
                                onClick={() => updateProduct(productItem.id!, { pricing_type: "fixed" as ProductPricingType })}
                                className="h-6 text-xs px-2"
                              >
                                Fast pris
                              </Button>
                              <Button
                                size="sm"
                                variant={productItem.pricing_type === "per_item" ? "default" : "outline"}
                                onClick={() => updateProduct(productItem.id!, { pricing_type: "per_item" as ProductPricingType })}
                                className="h-6 text-xs px-2"
                              >
                                Pr. stk
                              </Button>
                              <Button
                                size="sm"
                                variant={productItem.pricing_type === "m2" ? "default" : "outline"}
                                onClick={() => updateProduct(productItem.id!, { pricing_type: "m2" as ProductPricingType })}
                                className="h-6 text-xs px-2"
                              >
                                M²-pris
                              </Button>
                            </div>
                          </div>

                          {/* Fixed pricing */}
                          {(productItem.pricing_type === "fixed" || !productItem.pricing_type) && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">Pris:</Label>
                              <Input
                                type="number"
                                value={productItem.initial_price ?? 0}
                                onChange={(e) => updateProduct(productItem.id!, { initial_price: parseFloat(e.target.value) || 0 })}
                                className="h-7 text-sm w-28"
                                placeholder="0 kr"
                              />
                              <span className="text-xs text-muted-foreground">kr pr. stk</span>
                            </div>
                          )}

                          {/* Per item pricing - one field per quantity */}
                          {productItem.pricing_type === "per_item" && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Pris pr. antal</Label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {(config.quantities || []).sort((a, b) => a - b).map((qty) => {
                                  const currentPrice = (productItem.fixed_prices || []).find(fp => fp.quantity === qty)?.price ?? 0;
                                  return (
                                    <div key={qty} className="space-y-0.5">
                                      <Label className="text-[10px] text-muted-foreground">{qty} stk</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={currentPrice}
                                        onChange={(e) => {
                                          const newPrice = Number(e.target.value) || 0;
                                          const existing = productItem.fixed_prices || [];
                                          const updated = existing.filter(fp => fp.quantity !== qty);
                                          updated.push({ quantity: qty, price: newPrice });
                                          updateProduct(productItem.id!, { fixed_prices: updated });
                                        }}
                                        className="h-7 text-sm"
                                        placeholder="0 kr"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* M2 pricing - matching material tiers */}
                          {productItem.pricing_type === "m2" && activeM2Prices.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">M²-priser</Label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {activeM2Prices.map((materialTier) => {
                                  const productTier = (productItem.tiers || []).find(t => t.from_m2 === materialTier.from_m2);
                                  return (
                                    <div key={materialTier.id} className="space-y-0.5">
                                      <Label className="text-[10px] text-muted-foreground">
                                        {materialTier.from_m2}-{materialTier.to_m2 ?? "∞"} m²
                                      </Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={productTier?.price_per_m2 ?? 0}
                                        onChange={(e) => {
                                          const newPrice = Number(e.target.value) || 0;
                                          const existing = productItem.tiers || [];
                                          const updated = existing.filter(t => t.from_m2 !== materialTier.from_m2);
                                          updated.push({
                                            from_m2: materialTier.from_m2,
                                            to_m2: materialTier.to_m2,
                                            price_per_m2: newPrice,
                                            is_anchor: false,
                                          });
                                          updateProduct(productItem.id!, { tiers: updated });
                                        }}
                                        className="h-7 text-sm"
                                        placeholder="kr/m²"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Minimum price */}
                          <div className="flex items-center gap-2 border-t pt-2 mt-2">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Min. pris:</Label>
                            <Input
                              type="number"
                              min={0}
                              value={productItem.min_price ?? 0}
                              onChange={(e) => updateProduct(productItem.id!, { min_price: parseFloat(e.target.value) || 0 })}
                              className="h-7 text-sm w-24"
                              placeholder="0 kr"
                            />
                            <span className="text-[10px] text-muted-foreground">kr</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Finish pricing section */}
                {finishes.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <Label className="text-xs font-medium">Efterbehandling priser</Label>
                    <div className="space-y-2">
                      {finishes.map((finish) => {
                        const draft = getFinishPriceDraft(finish.id!);
                        return (
                          <div key={finish.id} className="border rounded-md p-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                              <div className="text-sm font-medium">{finish.name || "Unavngivet"}</div>
                              <Select
                                value={draft.pricing_mode}
                                onValueChange={(value) => updateFinishPrice(finish.id!, { pricing_mode: value as "fixed" | "per_m2" })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fast pris pr. stk</SelectItem>
                                  <SelectItem value="per_m2">Pris pr. m²</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                className="h-8"
                                value={draft.fixed_price}
                                onChange={(e) => updateFinishPrice(finish.id!, { fixed_price: Number(e.target.value) || 0 })}
                                disabled={draft.pricing_mode !== "fixed"}
                                placeholder="Fast pris"
                              />
                              <Input
                                type="number"
                                className="h-8"
                                value={draft.price_per_m2}
                                onChange={(e) => updateFinishPrice(finish.id!, { price_per_m2: Number(e.target.value) || 0 })}
                                disabled={draft.pricing_mode !== "per_m2"}
                                placeholder="Pris pr. m²"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Global controls */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs font-medium whitespace-nowrap">Afrunding:</Label>
                    <div className="flex gap-1">
                      {[1, 5, 10].map((step) => (
                        <Button
                          key={step}
                          size="sm"
                          variant={config.rounding_step === step ? "default" : "outline"}
                          onClick={() => setConfig((prev) => ({ ...prev, rounding_step: step }))}
                          className="h-7 text-xs px-3"
                        >
                          {step} kr
                        </Button>
                      ))}
                    </div>
                  </div>
                  {activeM2Material && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Prisjustering for "{activeM2Material.name || "Materiale"}"
                        </Label>
                        <span className={cn("text-xs font-medium", globalAdjustPct > 0 && "text-green-600", globalAdjustPct < 0 && "text-red-600")}>
                          {globalAdjustPct > 0 ? "+" : ""}{globalAdjustPct}%
                        </span>
                      </div>
                      <Slider
                        value={[globalAdjustPct]}
                        min={-50}
                        max={50}
                        step={1}
                        onValueChange={([v]) => {
                          if (!activeM2MaterialId) return;
                          setGlobalAdjustPct(v);
                          // Capture base prices on first drag (when coming from 0)
                          const currentBase = globalAdjustBasePrices;
                          const materialPrices = getM2PricesForMaterial(activeM2MaterialId);
                          const hasBase = materialPrices.some(p => p.id && currentBase[p.id!]);
                          if (!hasBase) {
                            const bases: Record<string, number> = {};
                            materialPrices.forEach(p => {
                              if (p.id) bases[p.id] = p.price_per_m2;
                            });
                            setGlobalAdjustBasePrices(bases);
                          }
                          // Apply adjustment from base prices
                          const bases = hasBase ? currentBase : Object.fromEntries(materialPrices.map(p => [p.id, p.price_per_m2]));
                          const adjusted = materialPrices.map(p => ({
                            ...p,
                            price_per_m2: Math.max(1, Math.round((bases[p.id!] || p.price_per_m2) * (1 + v / 100))),
                          }));
                          setM2PricesForMaterial(activeM2MaterialId, adjusted.map(p => ({
                            from_m2: p.from_m2,
                            to_m2: p.to_m2,
                            price_per_m2: p.price_per_m2,
                            is_anchor: p.is_anchor,
                          })));
                        }}
                        onValueCommit={() => {
                          // When user releases slider, reset base prices so next drag starts from new values
                          setGlobalAdjustBasePrices({});
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {showMatrixLayoutToolsForProduct && (
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
                          <SelectItem value="1">Nærmeste 1 kr</SelectItem>
                          <SelectItem value="5">Nærmeste 5 kr</SelectItem>
                          <SelectItem value="10">Nærmeste 10 kr</SelectItem>
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
                              ) : displayMode === "buttons" ? (
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
                              ) : (
                                /* Picture grid display (small / medium / large / xl) */
                                <div className="flex flex-wrap gap-2">
                                  {values.map((v) => {
                                    const settings = section.valueSettings?.[v.id];
                                    const thumbnailUrl = settings?.customImage || v.thumbnail_url;
                                    const isSelected = selectedValue === v.id;
                                    const size = PICTURE_SIZES[displayMode as PictureSizeMode] || PICTURE_SIZES.medium;
                                    return (
                                      <button
                                        key={v.id}
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
                                        className={cn(
                                          "relative rounded-lg border-2 transition-all flex flex-col items-center",
                                          isSelected
                                            ? "border-primary ring-2 ring-primary/20"
                                            : "border-muted hover:border-muted-foreground/50"
                                        )}
                                        style={{ width: size.width, height: size.height + 20 }}
                                      >
                                        {thumbnailUrl ? (
                                          <img
                                            src={thumbnailUrl}
                                            alt={v.name}
                                            className="w-full rounded-t-md object-cover"
                                            style={{ height: size.height }}
                                          />
                                        ) : (
                                          <div
                                            className="w-full flex items-center justify-center bg-muted text-xs font-medium text-muted-foreground rounded-t-md"
                                            style={{ height: size.height }}
                                          >
                                            {v.name.slice(0, 2).toUpperCase()}
                                          </div>
                                        )}
                                        <span
                                          className={cn(
                                            "text-[9px] leading-tight text-center truncate w-full px-0.5",
                                            displayMode === "small" && "hidden"
                                          )}
                                        >
                                          {v.name}
                                        </span>
                                      </button>
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
                                  const result = calculateStorformatM2Price({
                                    widthMm: previewWidthMm,
                                    heightMm: previewHeightMm,
                                    quantity: qty,
                                    material,
                                    materialPrices: getM2PricesForMaterial(material.id! as string) as StorformatM2Price[],
                                    finish,
                                    finishPrice: finish
                                      ? ({
                                        pricing_mode: getFinishPriceDraft(finish.id!).pricing_mode,
                                        fixed_price: getFinishPriceDraft(finish.id!).fixed_price,
                                        price_per_m2: getFinishPriceDraft(finish.id!).price_per_m2
                                      } as StorformatFinishPrice)
                                      : null,
                                    product: null,
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
            )}

            <Card className="border-slate-200 bg-slate-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Library className="h-4 w-4 text-blue-600" />
                  Prisliste Bank
                </CardTitle>
                <CardDescription className="text-xs">
                  Banken fungerer som dit arkiv før publicering. Gem forskellige opsætninger og indlæs dem senere.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Inline saved price lists */}
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground">Gemte prislister</Label>
                    <div className="space-y-1.5">
                      {templates.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded border bg-muted/10">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString("da-DK")}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              handleLoadTemplate(t);
                              toast.success(`"${t.name}" indlæst`);
                            }}>
                              Indlæs
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              handleSaveTemplate(t.id);
                            }}>
                              Overskriv
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteTemplate(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save as new */}
                <div className="flex gap-2">
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Navn på ny prisliste..."
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveTemplate()}
                    disabled={!saveName.trim()}
                    className="whitespace-nowrap"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Gem i bank
                  </Button>
                </div>

                {/* Save draft + Publish */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Gemmer..." : "Gem kladde"}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={async () => {
                      const saved = await handleSave();
                      if (!saved) return;
                      // Mark as published
                      const { error } = await supabase
                        .from("storformat_configs")
                        .update({ is_published: true })
                        .eq("product_id", productId);
                      if (error) {
                        toast.error("Kunne ikke publicere til shoppen");
                        return;
                      }
                      if (onPricingTypeChange && pricingType !== "STORFORMAT") {
                        onPricingTypeChange("STORFORMAT");
                      }
                      toast.success("Prisliste publiceret til shoppen!");
                    }}
                    disabled={saving}
                  >
                    <CloudUpload className="mr-2 h-4 w-4" />
                    Publicer til shop
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <SaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        name={saveName}
        onNameChange={setSaveName}
        templates={templates}
        onSave={(overwriteId: string) => handleSaveTemplate(overwriteId)}
      />

      <LoadTemplateDialog
        open={showLoadDialog}
        onOpenChange={setShowLoadDialog}
        templates={showAllTemplates ? allTemplates : templates}
        showAll={showAllTemplates}
        onShowAllChange={(next: boolean) => {
          setShowAllTemplates(next);
          if (next) fetchAllTemplates();
        }}
        currentProductId={productId}
        currentProductName={productName}
        onLoad={(t: any) => {
          handleLoadTemplate(t);
          setShowLoadDialog(false);
        }}
        onDelete={async (id: string) => {
          await handleDeleteTemplate(id);
        }}
      />

      {/* Tag Management Dialog */}
      <Dialog open={showTagManagementDialog} onOpenChange={setShowTagManagementDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Administrer tags -{" "}
              {tagManagementType === "materials"
                ? "Materialer"
                : tagManagementType === "finishes"
                  ? "Efterbehandlinger"
                  : "Produkter"}
            </DialogTitle>
            <DialogDescription>
              Fjern et tag fra alle elementer ved at klikke på slet-knappen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {(() => {
              const tags = tagOptionsByType[tagManagementType];
              if (tags.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ingen tags oprettet endnu.
                  </p>
                );
              }
              return (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {tags.sort().map((tag) => {
                    const items =
                      tagManagementType === "materials"
                        ? materials
                        : tagManagementType === "finishes"
                          ? finishes
                          : products;
                    const count = items.filter((item) => item.tags?.includes(tag)).length;
                    return (
                      <div
                        key={tag}
                        className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{tag}</Badge>
                          <span className="text-xs text-muted-foreground">
                            ({count} {count === 1 ? "element" : "elementer"})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTagFromAll(tag, tagManagementType)}
                          disabled={deletingTag === tag}
                          className="text-destructive hover:text-destructive"
                        >
                          {deletingTag === tag ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagManagementDialog(false)}>
              Luk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveDialog({ open, onOpenChange, name, onNameChange, templates = [], onSave }: any) {
  const [mode, setMode] = useState<"new" | "overwrite">("new");
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setMode("new");
      setSelectedId("");
    }
  }, [open]);

  useEffect(() => {
    if (mode === "overwrite" && selectedId) {
      const t = templates.find((template: any) => template.id === selectedId);
      if (t) onNameChange(t.name);
    }
  }, [selectedId, mode, templates, onNameChange]);

  const handleConfirm = () => {
    onSave(mode === "overwrite" ? selectedId : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gem prisliste</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {templates.length > 0 && (
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                variant={mode === "new" ? "default" : "ghost"}
                size="sm"
                className="flex-1 shadow-none"
                onClick={() => setMode("new")}
              >
                Ny prisliste
              </Button>
              <Button
                variant={mode === "overwrite" ? "default" : "ghost"}
                size="sm"
                className="flex-1 shadow-none"
                onClick={() => setMode("overwrite")}
              >
                Overskriv eksisterende
              </Button>
            </div>
          )}

          {mode === "overwrite" ? (
            <div className="space-y-2">
              <Label>Vælg prisliste at overskrive</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg prisliste..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dette vil erstatte indholdet i den valgte prisliste med dine nuværende indstillinger.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Navngivning</Label>
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="F.eks. Storformat V2"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Dette navn bruges til at finde skabelonen i banken.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button
            onClick={handleConfirm}
            disabled={mode === "new" ? !name : !selectedId}
          >
            {mode === "overwrite" ? "Overskriv" : "Gem i bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoadTemplateDialog({
  open,
  onOpenChange,
  templates = [],
  showAll,
  onShowAllChange,
  currentProductId,
  currentProductName,
  onLoad,
  onDelete
}: any) {
  const [search, setSearch] = useState("");

  const normalizedSearch = search.toLowerCase();
  const filtered = templates.filter((t: any) => {
    const nameMatch = t.name?.toLowerCase().includes(normalizedSearch);
    const productMatch = t.product?.name?.toLowerCase().includes(normalizedSearch);
    return nameMatch || productMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Indlæs prisliste</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="all-price-lists" className="text-xs text-muted-foreground">Alle prislister</Label>
            <Switch
              id="all-price-lists"
              checked={!!showAll}
              onCheckedChange={onShowAllChange}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {showAll ? "Viser alle prislister i systemet." : `Viser kun prislister for ${currentProductName}.`}
        </p>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen prislister fundet.
            </div>
          ) : (
            filtered.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                    {showAll && t.product?.name ? ` • ${t.product.name}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onLoad(t)}
                    disabled={showAll && t.product_id && currentProductId && t.product_id !== currentProductId}
                  >
                    Indlæs
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-500"
                    onClick={() => onDelete(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
