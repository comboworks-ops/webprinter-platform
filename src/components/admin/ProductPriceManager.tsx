import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Save, Trash2, ArrowLeft, X, LayoutGrid, Printer, Cpu } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ProductImageUpload } from "./ProductImageUpload";
import { AddPriceRow } from "./AddPriceRow";
import { ProductAboutSection } from "./ProductAboutSection";
import { MatrixDefaultSelector } from "./MatrixDefaultSelector";
import { BannerConfigEditor } from "./BannerConfigEditor";
import { CustomFieldsManager } from "./CustomFieldsManager";
import { BulkCSVImport } from "./BulkCSVImport";
import { BulkCSVExport } from "./BulkCSVExport";
import { BulkCSVTools } from "./BulkCSVTools";
import { ProductTooltipEditor } from "./ProductTooltipEditor";
import { VisualTooltipDesigner } from "./VisualTooltipDesigner";
import { type TooltipConfig } from "./ProductPagePreview";
import { PriceHierarchyFilter } from "./PriceHierarchyFilter";
import { OptionGroupManager } from "./OptionGroupManager";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { STANDARD_FORMATS, getDimensionsFromVariant } from "@/utils/formatStandards";
import { ProductColorProfileSelector } from "./ProductColorProfileSelector";
import { ProductSeoTab } from "./ProductSeoTab";
import { ProductPreviewCard } from "./ProductPreviewCard";
import ColorPickerWithSwatches from "@/components/ui/ColorPickerWithSwatches";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, Type } from "lucide-react";
import { FontSelector } from "./FontSelector";
import { PRODUCT_PRESETS, getPresetLabel } from "./ProductPresetSelector";
import { ProductAttributeBuilder } from "./ProductAttributeBuilder";
import { SpecialBadgeEditor } from "./SpecialBadgeEditor";
import { type ProductBadgeConfig } from "@/components/ProductBadge";

import { SmartPriceGenerator } from "./SmartPriceGenerator";
import { useProductAttributes } from "@/hooks/useProductAttributes";
import { cn } from "@/lib/utils";
import { StorformatManager } from "./StorformatManager";


interface BasePrice {
  id: string;
  price_dkk?: number;
  updated_at?: string;
  updated_by?: string;
}

interface FolderPrice extends BasePrice {
  format: string;
  paper: string;
  fold_type: string;
  quantity: number;
}

interface FlyerPrice extends BasePrice {
  format: string;
  paper: string;
  quantity: number;
  list_price_dkk: number;
}

interface VisitkortPrice extends BasePrice {
  paper: string;
  quantity: number;
}

interface RatePrice extends BasePrice {
  paper?: string;
  material?: string;
  price_per_sqm: number;
}

interface BeachflagPrice extends BasePrice {
  size: string;
  system: string;
  base_price: number;
}

type OrderingType = "standard" | "semi" | "email";
type SenderIdentity = "platform" | "tenant" | "customer";
type DeliveryMode = "manual" | "carrier";

interface DeliveryMethod {
  id: string;
  name: string;
  description?: string;
  lead_time_days?: number;
  production_days?: number;
  shipping_days?: number;
  delivery_window_days?: number;
  auto_mark_delivered?: boolean;
  auto_mark_days?: number;
  price?: number;
  cutoff_time?: string;
  cutoff_label?: "deadline" | "latest";
  cutoff_text?: string;
}

interface PodDeliverySettings {
  enabled: boolean;
  max_options: number;
  labels: {
    best: string;
    cheapest: string;
    fastest: string;
  };
  show_carrier: boolean;
  show_deadline: boolean;
  carrier_logos: Array<{
    carrier: string;
    logo_url: string;
  }>;
}

interface OrderDeliveryConfig {
  ordering: {
    type: OrderingType;
    supplier_name: string;
    supplier_url: string;
    operator_notes: string;
    stop_before_payment: boolean;
    requires_login: boolean;
    email_settings: {
      supplier_email: string;
      subject_template: string;
      body_template: string;
      attach_print_files: boolean;
      attach_spec_sheet: boolean;
      sender_identity: SenderIdentity;
    };
  };
  delivery: {
    mode: DeliveryMode;
    methods: DeliveryMethod[];
    pod_settings?: PodDeliverySettings;
    carrier_settings: {
      enabled: boolean;
      carrier: string;
      api_key: string;
      account_id: string;
    };
    customer_timeline: {
      production_days: number;
      shipping_days: number;
      auto_mark_delivered: boolean;
      auto_mark_days: number;
    };
  };
}

const DEFAULT_DELIVERY_METHODS: DeliveryMethod[] = [
  {
    id: "standard",
    name: "Standard",
    description: "",
    lead_time_days: 4,
    production_days: 2,
    shipping_days: 2,
    delivery_window_days: 0,
    auto_mark_delivered: false,
    auto_mark_days: 0,
    price: 0,
    cutoff_time: "12:00",
    cutoff_label: "deadline",
    cutoff_text: ""
  },
  {
    id: "express",
    name: "Express",
    description: "",
    lead_time_days: 2,
    production_days: 1,
    shipping_days: 1,
    delivery_window_days: 0,
    auto_mark_delivered: false,
    auto_mark_days: 0,
    price: 0,
    cutoff_time: "12:00",
    cutoff_label: "deadline",
    cutoff_text: ""
  }
];

const DEFAULT_ORDER_DELIVERY_CONFIG: OrderDeliveryConfig = {
  ordering: {
    type: "standard",
    supplier_name: "",
    supplier_url: "",
    operator_notes: "",
    stop_before_payment: true,
    requires_login: false,
    email_settings: {
      supplier_email: "",
      subject_template: "Order: {productName} - {orderNumber}",
      body_template: "Order for {productName}\nOrder number: {orderNumber}\nQuantity: {quantity}\nCustomer: {customerName}\nNotes: {notes}",
      attach_print_files: true,
      attach_spec_sheet: true,
      sender_identity: "platform"
    }
  },
  delivery: {
    mode: "manual",
    methods: DEFAULT_DELIVERY_METHODS,
    pod_settings: {
      enabled: true,
      max_options: 3,
      labels: {
        best: "Bedste balance",
        cheapest: "Bedste pris",
        fastest: "Hurtigst",
      },
      show_carrier: false,
      show_deadline: true,
      carrier_logos: [],
    },
    carrier_settings: {
      enabled: false,
      carrier: "UPS",
      api_key: "",
      account_id: ""
    },
    customer_timeline: {
      production_days: 2,
      shipping_days: 2,
      auto_mark_delivered: false,
      auto_mark_days: 0
    }
  }
};

function getPricingTypeLabel(type: string | undefined): string {
  if (!type) return 'Ukendt';
  const labels: Record<string, string> = {
    'matrix': 'Matrix',
    'rate': 'Takst',
    'formula': 'Formel',
    'fixed': 'Fast pris',
    'custom-dimensions': 'Brugerdefinerede dimensioner',
    'machine-priced': 'Maskin-beregning (MPA)',
    'MACHINE_PRICED': 'Maskin-beregning (MPA)',
    'STORFORMAT': 'Storformat'
  };
  return labels[type] || type;
}

export function ProductPriceManager() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [editedListPrices, setEditedListPrices] = useState<Record<string, number>>({});
  const [editedPricePerUnit, setEditedPricePerUnit] = useState<Record<string, number>>({});
  const [editedVariantNames, setEditedVariantNames] = useState<Record<string, string>>({});
  const [editedVariantValues, setEditedVariantValues] = useState<Record<string, string>>({});
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [editedName, setEditedName] = useState("");
  const [editedIconText, setEditedIconText] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  // Usage: "Fra-pris" Styling
  const [editedPriceColor, setEditedPriceColor] = useState("#000000");
  const [editedPriceBgColor, setEditedPriceBgColor] = useState("#FFFFFF");
  const [editedPriceBgEnabled, setEditedPriceBgEnabled] = useState(false);
  const [editedPriceFont, setEditedPriceFont] = useState("inherit");
  const [editedHoverImageUrl, setEditedHoverImageUrl] = useState<string | null>(null);
  const [editedSpecialBadge, setEditedSpecialBadge] = useState<ProductBadgeConfig | undefined>(undefined);
  const [configSectionThumbs, setConfigSectionThumbs] = useState({
    format: null as string | null,
    storformat: null as string | null,
    machine: null as string | null,
  });
  const [activeConfigSection, setActiveConfigSection] = useState<"format" | "storformat" | "machine" | null>(null);

  const [editedPriceFrom, setEditedPriceFrom] = useState("");
  const [editedPromoPrice, setEditedPromoPrice] = useState("");
  const [editedOriginalPrice, setEditedOriginalPrice] = useState("");
  const [editedShowSavingsBadge, setEditedShowSavingsBadge] = useState(false);
  const [editedWidth, setEditedWidth] = useState("");
  const [editedHeight, setEditedHeight] = useState("");
  const [editedBleed, setEditedBleed] = useState("3");
  const [editedMinDpi, setEditedMinDpi] = useState("300");
  const [editedIsFreeForm, setEditedIsFreeForm] = useState(false);
  const [editedStandardFormat, setEditedStandardFormat] = useState("");
  const [editedPodPreflightEnabled, setEditedPodPreflightEnabled] = useState(false);
  const [editedPodPreflightAutoFix, setEditedPodPreflightAutoFix] = useState(true);
  const [hasProductEdits, setHasProductEdits] = useState(false);
  const [hasSpecEdits, setHasSpecEdits] = useState(false);
  const [editedOutputColorProfileId, setEditedOutputColorProfileId] = useState<string | null>(null);
  const [hasMachineEdits, setHasMachineEdits] = useState(false);
  // Removed local color profile state as it is now handled in ProductAboutSection

  // MPA (Machine Pricing Add-On) State
  const [pricingType, setPricingType] = useState<'STANDARD' | 'MACHINE_PRICED'>('STANDARD');
  const [mpaConfig, setMpaConfig] = useState<any>({
    pricing_profile_id: "",
    margin_profile_id: "",
    allowed_sides: "4+0_AND_4+4",
    quantities: [50, 100, 250, 500, 1000],
    bleed_mm: 3,
    gap_mm: 2,
    material_ids: [],
    finish_ids: [],
    numbering_enabled: false,
    numbering_setup_fee: 0,
    numbering_price_per_unit: 0,
    numbering_positions: 1,
    sizes: []
  });
  const [availableMpaData, setAvailableMpaData] = useState<{
    pricingProfiles: any[];
    marginProfiles: any[];
    materials: any[];
    finishes: any[];
    machines: any[];
    inkSets: any[];
  }>({
    pricingProfiles: [],
    marginProfiles: [],
    materials: [],
    finishes: [],
    machines: [],
    inkSets: []
  });
  const [filteredPrices, setFilteredPrices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("about");
  const [orderDeliveryConfig, setOrderDeliveryConfig] = useState<OrderDeliveryConfig>(DEFAULT_ORDER_DELIVERY_CONFIG);
  const [hasOrderDeliveryEdits, setHasOrderDeliveryEdits] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [podCarrierUploadIndex, setPodCarrierUploadIndex] = useState<number | null>(null);

  // Hook for product attribute groups (used in pricing structure)
  const productAttrs = useProductAttributes(product?.id, product?.tenant_id);

  const normalizeDeliveryMethods = (methods?: DeliveryMethod[], fallbackTimeline?: OrderDeliveryConfig["delivery"]["customer_timeline"]) => {
    if (!methods || methods.length === 0) return DEFAULT_DELIVERY_METHODS.map(method => ({ ...method }));
    return methods.map((method) => {
      const productionDays = typeof method.production_days === "number"
        ? method.production_days
        : typeof method.lead_time_days === "number"
          ? method.lead_time_days
          : fallbackTimeline?.production_days ?? DEFAULT_ORDER_DELIVERY_CONFIG.delivery.customer_timeline.production_days;
      const shippingDays = typeof method.shipping_days === "number"
        ? method.shipping_days
        : fallbackTimeline?.shipping_days ?? DEFAULT_ORDER_DELIVERY_CONFIG.delivery.customer_timeline.shipping_days;
      const totalDays = (productionDays || 0) + (shippingDays || 0);
      const deliveryWindowDays = typeof method.delivery_window_days === "number" ? method.delivery_window_days : 0;

      return {
        id: method.id || `method-${Math.random().toString(36).slice(2, 9)}`,
        name: method.name || "Ny levering",
        description: method.description || "",
        lead_time_days: typeof method.lead_time_days === "number" ? method.lead_time_days : totalDays,
        production_days: productionDays,
        shipping_days: shippingDays,
        delivery_window_days: deliveryWindowDays,
        auto_mark_delivered: method.auto_mark_delivered ?? fallbackTimeline?.auto_mark_delivered ?? false,
        auto_mark_days: typeof method.auto_mark_days === "number" ? method.auto_mark_days : fallbackTimeline?.auto_mark_days ?? 0,
        price: typeof method.price === "number" ? method.price : 0,
        cutoff_time: method.cutoff_time || "",
        cutoff_label: method.cutoff_label === "latest" ? "latest" : "deadline",
        cutoff_text: method.cutoff_text || ""
      };
    });
  };

  const applyOrderDeliveryDefaults = (raw?: Partial<OrderDeliveryConfig>): OrderDeliveryConfig => {
    const merged = {
      ...DEFAULT_ORDER_DELIVERY_CONFIG,
      ...raw,
      ordering: {
        ...DEFAULT_ORDER_DELIVERY_CONFIG.ordering,
        ...(raw?.ordering || {}),
        email_settings: {
          ...DEFAULT_ORDER_DELIVERY_CONFIG.ordering.email_settings,
          ...(raw?.ordering?.email_settings || {})
        }
      },
      delivery: {
        ...DEFAULT_ORDER_DELIVERY_CONFIG.delivery,
        ...(raw?.delivery || {}),
        pod_settings: {
          ...DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings,
          ...(raw?.delivery as any)?.pod_settings,
          carrier_logos: Array.isArray((raw?.delivery as any)?.pod_settings?.carrier_logos)
            ? (raw?.delivery as any)?.pod_settings?.carrier_logos
            : (DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings?.carrier_logos || []),
          labels: {
            ...DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings?.labels,
            ...(raw?.delivery as any)?.pod_settings?.labels,
          },
        },
        carrier_settings: {
          ...DEFAULT_ORDER_DELIVERY_CONFIG.delivery.carrier_settings,
          ...(raw?.delivery?.carrier_settings || {})
        },
        customer_timeline: {
          ...DEFAULT_ORDER_DELIVERY_CONFIG.delivery.customer_timeline,
          ...(raw?.delivery?.customer_timeline || {})
        }
      }
    };

    return {
      ...merged,
      delivery: {
        ...merged.delivery,
        methods: normalizeDeliveryMethods(merged.delivery.methods, merged.delivery.customer_timeline)
      }
    };
  };

  const updateOrderDeliveryConfig = (updater: (prev: OrderDeliveryConfig) => OrderDeliveryConfig) => {
    setOrderDeliveryConfig(prev => {
      const next = updater(prev);
      return next;
    });
    setHasOrderDeliveryEdits(true);
  };

  const updatePodCarrierLogos = (nextLogos: PodDeliverySettings["carrier_logos"]) => {
    updateOrderDeliveryConfig(prev => {
      const currentPodSettings = prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings;
      return {
        ...prev,
        delivery: {
          ...prev.delivery,
          pod_settings: {
            ...currentPodSettings,
            carrier_logos: nextLogos,
          },
        },
      };
    });
  };

  const handlePodCarrierLogoUpload = async (index: number, file: File) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Kun billeder (JPG, PNG, WEBP, SVG) er tilladt");
      return;
    }
    if (file.size > 5242880) {
      toast.error("Billedet må højst være 5MB");
      return;
    }

    try {
      setPodCarrierUploadIndex(index);
      const fileExt = file.name.split(".").pop() || "png";
      const carrierName = (orderDeliveryConfig.delivery.pod_settings?.carrier_logos?.[index]?.carrier || "carrier")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const fileName = `pod-carrier-${product?.id || "product"}-${carrierName || "carrier"}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      const currentLogos = orderDeliveryConfig.delivery.pod_settings?.carrier_logos || [];
      const nextLogos = [...currentLogos];
      nextLogos[index] = { ...(nextLogos[index] || { carrier: "" }), logo_url: publicUrl };
      updatePodCarrierLogos(nextLogos);
      toast.success("Logo uploadet");
    } catch (error) {
      console.error("Carrier logo upload error", error);
      toast.error("Kunne ikke uploade logo");
    } finally {
      setPodCarrierUploadIndex(null);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  useEffect(() => {
    resolveAdminTenant().then(({ isMasterAdmin: master }) => {
      setIsMasterAdmin(master);
    });
  }, []);

  useEffect(() => {
    if (product) {
      fetchPrices();
      setEditedName(product.name);
      setEditedIconText(product.icon_text || product.name || "");
      setEditedDescription(product.description || "");
      setEditedPriceFrom((product.banner_config as any)?.price_from?.toString() || "");
      // Styling init
      const bc = (product.banner_config as any) || {};
      setEditedPriceColor(bc.price_color || "#000000");
      setEditedPriceBgColor(bc.price_bg_color || "#FFFFFF");
      setEditedPriceBgEnabled(bc.price_bg_enabled || false);
      setEditedPriceFont(bc.price_font || "inherit");
      setEditedHoverImageUrl(bc.hover_image_url || null);
      setEditedSpecialBadge(bc.special_badge || undefined);
      setEditedPromoPrice(bc.promo_price?.toString() || "");
      setEditedOriginalPrice(bc.original_price?.toString() || "");
      setEditedShowSavingsBadge(bc.show_savings_badge || false);
      const sectionThumbs = (bc.config_section_thumbs as any) || {};
      setConfigSectionThumbs({
        format: sectionThumbs.format || null,
        storformat: sectionThumbs.storformat || null,
        machine: sectionThumbs.machine || null,
      });

      const specs = (product.technical_specs as any) || {};
      setEditedWidth(specs.width_mm?.toString() || "");
      setEditedHeight(specs.height_mm?.toString() || "");
      setEditedBleed(specs.bleed_mm?.toString() || "3");
      setEditedMinDpi(specs.min_dpi?.toString() || "300");
      setEditedIsFreeForm(specs.is_free_form || false);
      setEditedStandardFormat(specs.standard_format || "");
      setEditedPodPreflightEnabled(Boolean(specs.pod_preflight_enabled));
      setEditedPodPreflightAutoFix(specs.pod_preflight_auto_fix ?? true);
      setHasProductEdits(false);
      setHasSpecEdits(false);
      setHasMachineEdits(false);
      setEditedOutputColorProfileId(product.output_color_profile_id || null);
      setOrderDeliveryConfig(applyOrderDeliveryDefaults((bc as any).order_delivery));
      setHasOrderDeliveryEdits(false);
      fetchMpaConfig(product.id);

    }
  }, [product]);

  useEffect(() => {
    if (!product || activeConfigSection) return;
    const bc = (product.banner_config as any) || {};
    const storedChoice = bc.config_section_choice as
      | "format"
      | "storformat"
      | "machine"
      | undefined;
    if (storedChoice) {
      setActiveConfigSection(storedChoice);
      return;
    }
    if (product.pricing_type === "STORFORMAT") {
      setActiveConfigSection("storformat");
      return;
    }
    if (pricingType === "MACHINE_PRICED") {
      setActiveConfigSection("machine");
      return;
    }
  }, [product, pricingType, activeConfigSection]);

  const fetchMpaConfig = async (productId: string) => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      // Fetch Profiles/Materials for selects
      const [pp, mp, mat, fin, cfg] = await Promise.all([
        supabase.from('pricing_profiles' as any).select('*').eq('tenant_id', tenantId),
        supabase.from('margin_profiles' as any).select('*').eq('tenant_id', tenantId),
        supabase.from('materials' as any).select('*').eq('tenant_id', tenantId),
        supabase.from('finish_options' as any).select('*').eq('tenant_id', tenantId),
        supabase.from('product_pricing_configs' as any).select('*').eq('product_id', productId).maybeSingle()
      ]);

      setAvailableMpaData({
        pricingProfiles: pp.data || [],
        marginProfiles: mp.data || [],
        materials: mat.data || [],
        finishes: fin.data || [],
        machines: pp.data || [], // We'll use profile list to find machine/ink for now
        inkSets: [] // Will fetch specifically if needed, but for now we'll just fix the type error
      });

      // Refined fetch to include machines and inkSets
      const [allMachines, allInk] = await Promise.all([
        supabase.from('machines' as any).select('*').eq('tenant_id', tenantId),
        supabase.from('ink_sets' as any).select('*').eq('tenant_id', tenantId)
      ]);

      setAvailableMpaData(prev => ({
        ...prev,
        machines: allMachines.data || [],
        inkSets: allInk.data || []
      }));

      if (cfg.data) {
        setPricingType((cfg.data as any).pricing_type);
        setMpaConfig(cfg.data);
      }
    } catch (e) {
      console.error("Error fetching MPA config:", e);
    }
  };

  const handlePricingTypeChange = async (nextType: string) => {
    if (!product) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ pricing_type: nextType })
        .eq('id', product.id);

      if (error) throw error;
      setProduct((prev: any) => prev ? { ...prev, pricing_type: nextType } : prev);
      toast.success(`Pristype opdateret til ${getPricingTypeLabel(nextType).toLowerCase()}`);
    } catch (error: any) {
      console.error('Error updating pricing type:', error);
      const message = error?.message || 'Kunne ikke opdatere pristype';
      const isConstraintError =
        message.includes('pricing_type') ||
        message.includes('products_pricing_type_check') ||
        message.toLowerCase().includes('check constraint') ||
        message.toLowerCase().includes('invalid input value');

      if (isConstraintError) {
        toast.error('Kunne ikke opdatere pristype. Databasen mangler STORFORMAT i pricing_type-checken. Kør migration: 20260201090000_storformat_pricing.sql');
        return;
      }

      toast.error(message);
    }
  };

  const handleSaveMachineConfig = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      const data = {
        ...mpaConfig,
        product_id: product.id,
        tenant_id: tenantId,
        pricing_type: pricingType,
        updated_at: new Date().toISOString()
      };

      // Check if exists
      const { data: existing } = await supabase.from('product_pricing_configs' as any).select('id').eq('product_id', product.id).maybeSingle();

      let error;
      if (existing) {
        ({ error } = await supabase.from('product_pricing_configs' as any).update(data).eq('product_id', product.id));
      } else {
        ({ error } = await supabase.from('product_pricing_configs' as any).insert(data));
      }

      if (error) throw error;
      toast.success("Maskin-konfiguration gemt");
      setHasMachineEdits(false);
    } catch (err: any) {
      toast.error("Fejl: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchProduct = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      // Get current user's tenant to ensure we pick the right product
      const { tenantId } = await resolveAdminTenant();

      let query = supabase
        .from('products')
        .select('*')
        .eq('slug', slug);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      } else {
        // Fallback for Master Admin or direct access: prefer Master Tenant
        // checks RLS anyway
      }

      const { data, error } = await query.maybeSingle(); // Use maybeSingle to avoid 406 error if multiple

      if (error) throw error;
      if (!data) throw new Error('Product not found');

      setProduct(data);
    } catch (error: any) {
      console.error('Error fetching product:', error);
      toast.error(`Kunne ikke hente produkt: ${error.message || 'Ukendt fejl'}`);
    }
  };

  const getTableName = (slug: string): string => {
    const tableMap: Record<string, string> = {
      'foldere': 'folder_prices',
      'flyers': 'print_flyers',
      'visitkort': 'visitkort_prices',
      'plakater': 'poster_prices',
      'klistermærker': 'sticker_rates',
      'skilte': 'sign_prices',
      'bannere': 'banner_prices',
      'folie': 'foil_prices',
      'beachflag': 'beachflag_prices',
      'haefter': 'booklet_rates',
      'hæfter': 'booklet_rates',
      'salgsmapper': 'salesfolder_rates'
    };
    // Return specific table or fallback to generic
    return tableMap[slug] || 'generic_product_prices';
  };

  const isGenericPricing = (slug: string): boolean => {
    const specificTables = ['foldere', 'flyers', 'visitkort', 'plakater', 'klistermærker', 'skilte', 'bannere', 'folie', 'beachflag', 'hæfter', 'haefter', 'salgsmapper'];
    return !specificTables.includes(slug);
  };

  const fetchPrices = async () => {
    if (!product) return;

    try {
      setLoading(true);
      const tableName = getTableName(product.slug);
      const useGeneric = isGenericPricing(product.slug);

      let query = supabase.from(tableName as any).select('*');

      // For generic pricing, filter by product_id
      if (useGeneric) {
        query = query.eq('product_id', product.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Sort by quantity for products that have it, otherwise keep original order
      const sortedData = (data as any[] || []).sort((a, b) => {
        if (a.quantity !== undefined && b.quantity !== undefined) {
          return a.quantity - b.quantity;
        }
        return 0;
      });

      setPrices(sortedData);
      setFilteredPrices(sortedData);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error('Kunne ikke hente priser');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (id: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice);
    if (!isNaN(numPrice)) {
      setEditedPrices(prev => ({ ...prev, [id]: numPrice }));
    }
  };

  const handleListPriceChange = (id: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice);
    if (!isNaN(numPrice)) {
      setEditedListPrices(prev => ({ ...prev, [id]: numPrice }));
    }
  };

  const handlePricePerUnitChange = (id: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice);
    if (!isNaN(numPrice)) {
      setEditedPricePerUnit(prev => ({ ...prev, [id]: numPrice }));
    }
  };

  const handleVariantNameChange = (id: string, value: string) => {
    setEditedVariantNames(prev => ({ ...prev, [id]: value }));
  };

  const handleVariantValueChange = (id: string, value: string) => {
    setEditedVariantValues(prev => ({ ...prev, [id]: value }));
  };

  const handleQuantityChange = (id: string, value: string) => {
    const numQty = parseInt(value);
    if (!isNaN(numQty)) {
      setEditedQuantities(prev => ({ ...prev, [id]: numQty }));
    }
  };

  const handleProductNameChange = (value: string) => {
    setEditedName(value);
    setHasProductEdits(
      value !== product?.name ||
      editedDescription !== (product?.description || "") ||
      editedIconText !== (product?.icon_text || "")
    );
  };

  const handleProductIconTextChange = (value: string) => {
    setEditedIconText(value);
    setHasProductEdits(
      editedName !== product?.name ||
      editedDescription !== (product?.description || "") ||
      value !== (product?.icon_text || "")
    );
  };

  const handleProductDescriptionChange = (value: string) => {
    setEditedDescription(value);
    setHasProductEdits(
      editedName !== product?.name ||
      value !== (product?.description || "") ||
      editedIconText !== (product?.icon_text || "")
    );
  };

  const handleImageUpdate = (newImageUrl: string) => {
    setProduct({ ...product, image_url: newImageUrl });
  };

  const handleFilterChange = useCallback((filtered: any[]) => {
    setFilteredPrices(filtered);
  }, []);

  const handleSaveProductDetails = async (overrides: any = {}) => {
    // Check if there are any edits to product details (unless overrides force save)
    if (!product || (!hasProductEdits && Object.keys(overrides).length === 0)) return;

    setSaving(true);
    try {
      const currentConfig = (product.banner_config as any) || {};

      // Determine values (state or override)
      const hoverImg = overrides.hover_image_url !== undefined ? overrides.hover_image_url : editedHoverImageUrl;

      const updates: any = {
        name: editedName,
        icon_text: editedIconText,
        description: editedDescription,
        banner_config: {
          ...currentConfig,
          price_from: parseFloat(editedPriceFrom) || null,
          promo_price: parseFloat(editedPromoPrice) || null,
          original_price: parseFloat(editedOriginalPrice) || null,
          show_savings_badge: editedShowSavingsBadge,
          price_color: editedPriceColor,
          price_bg_color: editedPriceBgColor,
          price_bg_enabled: editedPriceBgEnabled,
          price_font: editedPriceFont,
          hover_image_url: hoverImg,
          special_badge: editedSpecialBadge
        }
      };

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Forside information opdateret');
      setHasProductEdits(false);
      await fetchProduct();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Kunne ikke opdatere produktdetaljer');
    } finally {
      setSaving(false);
    }
  };

  const handleHoverImageUpdate = async (url: string | null) => {
    setEditedHoverImageUrl(url);
    await handleSaveProductDetails({ hover_image_url: url });
  };

  const handleSelectConfigSection = async (next: "format" | "storformat" | "machine") => {
    if (!product) return;
    if (activeConfigSection === next) return;

    setActiveConfigSection(next);
    if (next === "storformat" && product.pricing_type !== "STORFORMAT") {
      await handlePricingTypeChange("STORFORMAT");
    }
    if (next !== "storformat" && product.pricing_type === "STORFORMAT") {
      await handlePricingTypeChange("matrix");
    }
    try {
      const currentConfig = (product.banner_config as any) || {};
      const nextConfig = { ...currentConfig, config_section_choice: next };
      const { error } = await supabase
        .from("products")
        .update({ banner_config: nextConfig })
        .eq("id", product.id);

      if (error) throw error;
      setProduct({ ...product, banner_config: nextConfig });
    } catch (error) {
      console.error("Error updating config section choice:", error);
      toast.error("Kunne ikke gemme valg af prisopsætning");
    }
  };

  const handleSaveTechnicalSpecs = async () => {
    if (!product || !hasSpecEdits) return;

    setSaving(true);
    try {
      const existingSpecs = (product.technical_specs as any) || {};
      const isPodProduct = Boolean(existingSpecs.is_pod || existingSpecs.is_pod_v2);
      const nextSpecs: any = {
        ...existingSpecs,
        width_mm: parseFloat(editedWidth) || null,
        height_mm: parseFloat(editedHeight) || null,
        bleed_mm: parseFloat(editedBleed) || null,
        min_dpi: parseInt(editedMinDpi) || null,
        is_free_form: editedIsFreeForm,
        standard_format: editedStandardFormat
      };
      if (isPodProduct) {
        nextSpecs.pod_preflight_enabled = editedPodPreflightEnabled;
        nextSpecs.pod_preflight_auto_fix = editedPodPreflightAutoFix;
      }

      const { error } = await supabase
        .from('products')
        .update({
          output_color_profile_id: editedOutputColorProfileId,
          technical_specs: nextSpecs
        })
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Tekniske specifikationer opdateret');
      setHasSpecEdits(false);
      await fetchProduct();
    } catch (error) {
      console.error('Error updating technical specs:', error);
      toast.error('Kunne ikke opdatere tekniske specifikationer');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrderDelivery = async () => {
    if (!product || !hasOrderDeliveryEdits) return;
    setSaving(true);
    try {
      const currentConfig = (product.banner_config as any) || {};
      const nextConfig = {
        ...currentConfig,
        order_delivery: orderDeliveryConfig
      };

      const { error } = await supabase
        .from("products")
        .update({ banner_config: nextConfig })
        .eq("id", product.id);

      if (error) throw error;
      toast.success("Bestilling og levering gemt");
      setHasOrderDeliveryEdits(false);
      await fetchProduct();
    } catch (error) {
      console.error("Error updating order/delivery config:", error);
      toast.error("Kunne ikke gemme bestilling og levering");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne pris?')) return;

    try {
      const tableName = getTableName(product!.slug);
      if (!tableName) return;

      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', priceId);

      if (error) throw error;

      toast.success('Pris slettet');
      await fetchPrices();
    } catch (error) {
      console.error('Error deleting price:', error);
      toast.error('Kunne ikke slette pris');
    }
  };

  const handleSave = async (priceId: string) => {
    const hasAnyEdit = (priceId in editedPrices) || (priceId in editedListPrices) || (priceId in editedPricePerUnit) || (priceId in editedVariantNames) || (priceId in editedVariantValues) || (priceId in editedQuantities);
    if (!hasAnyEdit) return;

    setSaving(true);
    try {
      const tableName = getTableName(product!.slug);
      if (!tableName) return;

      const updates: any = {};

      if (priceId in editedPrices) {
        const isRateTable = ['poster_rates', 'sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
        const isBeachflag = tableName === 'beachflag_prices';
        const isBooklet = tableName === 'booklet_rates';
        const isSalesFolder = tableName === 'salesfolder_rates';

        if (isRateTable) {
          updates.price_per_sqm = editedPrices[priceId];
        } else if (isBeachflag || isBooklet || isSalesFolder) {
          updates.base_price = editedPrices[priceId];
        } else {
          updates.price_dkk = editedPrices[priceId];
        }
      }
      if (priceId in editedListPrices) {
        updates.list_price_dkk = editedListPrices[priceId];
      }
      if (priceId in editedPricePerUnit) {
        const isTieredAreaPricing = ['sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
        const isFormulaProduct = ['booklet_rates', 'salesfolder_rates'].includes(tableName);
        if (isTieredAreaPricing) {
          updates.discount_percent = editedPricePerUnit[priceId];
        } else if (isFormulaProduct) {
          updates.price_per_unit = editedPricePerUnit[priceId];
        } else {
          updates.price_per_unit = editedPricePerUnit[priceId];
        }
      }

      // Generic product field updates
      if (priceId in editedVariantNames) {
        updates.variant_name = editedVariantNames[priceId];
      }
      if (priceId in editedVariantValues) {
        updates.variant_value = editedVariantValues[priceId];
      }
      if (priceId in editedQuantities) {
        updates.quantity = editedQuantities[priceId];
      }

      const { error } = await supabase
        .from(tableName as any)
        .update(updates)
        .eq('id', priceId);

      if (error) throw error;

      toast.success('Pris opdateret');
      setEditedPrices(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedListPrices(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedPricePerUnit(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedVariantNames(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedVariantValues(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedQuantities(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      await fetchPrices();
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Kunne ikke opdatere pris');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const hasEdits = Object.keys(editedPrices).length > 0 || Object.keys(editedListPrices).length > 0 || Object.keys(editedPricePerUnit).length > 0;
    if (!hasEdits) return;

    setSaving(true);
    try {
      const tableName = getTableName(product!.slug);
      if (!tableName) return;

      const isRateTable = ['poster_rates', 'sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
      const isTieredAreaPricing = ['sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
      const isBeachflag = tableName === 'beachflag_prices';
      const isBooklet = tableName === 'booklet_rates';
      const isSalesFolder = tableName === 'salesfolder_rates';
      const allIds = [...new Set([...Object.keys(editedPrices), ...Object.keys(editedListPrices), ...Object.keys(editedPricePerUnit)])];

      const updates = allIds.map(id => {
        const updateData: any = {};

        if (id in editedPrices) {
          if (isRateTable) {
            updateData.price_per_sqm = editedPrices[id];
          } else if (isBeachflag || isBooklet || isSalesFolder) {
            updateData.base_price = editedPrices[id];
          } else {
            updateData.price_dkk = editedPrices[id];
          }
        }
        if (id in editedListPrices) updateData.list_price_dkk = editedListPrices[id];
        if (id in editedPricePerUnit) {
          if (isTieredAreaPricing) {
            updateData.discount_percent = editedPricePerUnit[id];
          } else {
            updateData.price_per_unit = editedPricePerUnit[id];
          }
        }

        return supabase
          .from(tableName as any)
          .update(updateData)
          .eq('id', id);
      });

      await Promise.all(updates);
      toast.success(`Opdaterede ${updates.length} priser`);
      setEditedPrices({});
      setEditedListPrices({});
      setEditedPricePerUnit({});
      await fetchPrices();
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error('Kunne ikke opdatere priser');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Produkt ikke fundet</CardTitle>
          <CardDescription>Det valgte produkt kunne ikke findes.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasEdits = Object.keys(editedPrices).length > 0 || Object.keys(editedListPrices).length > 0 || Object.keys(editedPricePerUnit).length > 0 || Object.keys(editedVariantNames).length > 0 || Object.keys(editedVariantValues).length > 0 || Object.keys(editedQuantities).length > 0;

  return (
    <div className="space-y-6">
      {/* Sticky back button */}
      <div className="sticky top-0 z-30 bg-background py-3 border-b">
        <Button
          variant="outline"
          onClick={() => navigate('/admin')}
          className="mb-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbage til Produktoversigt
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Produktkonfiguration</h1>
        <p className="text-muted-foreground text-sm">Konfigurer produktets indhold, attributter og priser</p>
      </div>



      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-start overflow-x-auto h-auto p-1 gap-1 bg-muted/50 rounded-lg">
          <TabsTrigger value="about" className="flex-shrink-0">Produktinfo</TabsTrigger>
          <TabsTrigger value="produkt" className="flex-shrink-0">Produkt & Priser</TabsTrigger>
          <TabsTrigger value="order-delivery" className="flex-shrink-0">Bestilling og levering</TabsTrigger>
          <TabsTrigger value="options" className="flex-shrink-0">Valgmuligheder</TabsTrigger>
          <TabsTrigger value="custom-fields" className="flex-shrink-0">Felter</TabsTrigger>
          <TabsTrigger value="seo" className="flex-shrink-0">SEO & Meta</TabsTrigger>
          <TabsTrigger value="tooltips" className="flex-shrink-0">Tooltips</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>SEO & Meta Information</CardTitle>
                <CardDescription>Rediger produktets navn og meta-beskrivelse. Dette bruges primært til SEO og lister.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Info & Settings */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Produktnavn</Label>
                    <Input
                      id="product-name"
                      value={editedName}
                      onChange={(e) => handleProductNameChange(e.target.value)}
                      placeholder="Indtast produktnavn"
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-description">Kort beskrivelse (Meta / Lister)</Label>
                    <Textarea
                      id="product-description"
                      value={editedDescription}
                      onChange={(e) => handleProductDescriptionChange(e.target.value)}
                      placeholder="Kort tekst til produktoversigter og SEO..."
                      className="min-h-[80px]"
                      rows={3}
                    />
                  </div>


                </div>

                {/* Right Column: Image */}
                <div className="lg:col-span-1">
                  <div className="bg-muted/10 p-4 rounded-lg border">
                    <Label className="mb-4 block">Produktbillede</Label>
                    <ProductImageUpload
                      productId={product.id}
                      currentImageUrl={product.image_url}
                      onImageUpdate={handleImageUpdate}
                    />
                  </div>
                </div>
              </div>

              {/* Consolidated Actions */}
              <div className="flex justify-end pt-6 mt-6 border-t">
                <Button
                  onClick={handleSaveProductDetails}
                  disabled={!hasProductEdits || saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Gem SEO & Meta
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produkt Tab - Attribute Builder */}
        <TabsContent value="produkt" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{product.name}</h2>
              <p className="text-muted-foreground">Definer formater, materialer og andre valgmuligheder for dette produkt</p>
            </div>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prisopsætning</CardTitle>
              <CardDescription>
                Vælg hvilken prisopsætning du vil arbejde med. Kun én metode kan være aktiv ad gangen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {([
                  {
                    key: "format",
                    title: "Format / formatpriser",
                    description: "Standard matrix og formatopsætning.",
                    icon: LayoutGrid
                  },
                  {
                    key: "storformat",
                    title: "Storformat priser",
                    description: "Storformat-materialer og prislogik.",
                    icon: Printer
                  },
                  {
                    key: "machine",
                    title: "Maskin-beregning",
                    description: "Avanceret MPA-beregning.",
                    icon: Cpu
                  }
                ] as const).map((option) => {
                  const isActive = activeConfigSection === option.key;
                  const thumbUrl = configSectionThumbs[option.key];
                  const fallbackImage = option.key === "format"
                    ? "/Webprinter_Offset.png"
                    : option.key === "storformat"
                      ? "/Web Printer_storformat.png"
                      : option.key === "machine"
                        ? "/Web Printer_maskineberegner.png"
                        : null;
                  const imageUrl = thumbUrl || fallbackImage;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleSelectConfigSection(option.key)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all flex flex-col gap-3",
                        "hover:border-primary/60 hover:bg-primary/5",
                        isActive && "border-primary/70 bg-primary/10"
                      )}
                    >
                      <div className="w-full rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden h-32">
                        {imageUrl ? (
                          <img src={imageUrl} alt={option.title} className="h-full w-full object-contain" />
                        ) : (
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{option.title}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      {isActive && (
                        <div className="pt-3 text-xs font-medium text-primary">Valgt</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {activeConfigSection === "format" && (
            <ProductAttributeBuilder
              productId={product.id}
              tenantId={product.tenant_id}
              productName={product.name}
              tableName={getTableName(product.slug)}
              productSlug={product.slug}
              onPricesUpdated={fetchPrices}
            />
          )}

          {activeConfigSection === "storformat" && (
            <div className="space-y-6">
              <StorformatManager
                productId={product.id}
                tenantId={product.tenant_id}
                productName={product.name}
                pricingType={product.pricing_type}
                onPricingTypeChange={handlePricingTypeChange}
              />
            </div>
          )}

          {activeConfigSection === "machine" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Maskin-baseret Prisberegning</CardTitle>
                    <CardDescription>Aktiver avanceret prisberegning baseret på maskiner, blæk og materialer.</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pricing-type">Metode:</Label>
                      <Select value={pricingType} onValueChange={(v: any) => { setPricingType(v); setHasMachineEdits(true); }}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">Matrix</SelectItem>
                          <SelectItem value="MACHINE_PRICED">Maskin (MPA)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pricingType === 'MACHINE_PRICED' && (
                      <div className="flex items-center gap-2">
                        <Label>Visning:</Label>
                        <Select value={mpaConfig.display_mode || 'SELECTION'} onValueChange={v => { setMpaConfig({ ...mpaConfig, display_mode: v }); setHasMachineEdits(true); }}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SELECTION">Valgmenu</SelectItem>
                            <SelectItem value="MATRIX">Pris-tabel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {pricingType === 'MACHINE_PRICED' ? (
                    <div className="grid gap-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pris-profil</Label>
                          <Select value={mpaConfig.pricing_profile_id} onValueChange={v => { setMpaConfig({ ...mpaConfig, pricing_profile_id: v }); setHasMachineEdits(true); }}>
                            <SelectTrigger><SelectValue placeholder="Vælg profil" /></SelectTrigger>
                            <SelectContent>
                              {availableMpaData.pricingProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {mpaConfig.pricing_profile_id && (
                            <div className="text-[10px] bg-muted p-1.5 rounded border">
                              {(() => {
                                const p = availableMpaData.pricingProfiles.find(x => x.id === mpaConfig.pricing_profile_id);
                                if (!p) return null;
                                const m = availableMpaData.machines?.find(x => x.id === (p as any).machine_id);
                                const i = availableMpaData.inkSets?.find(x => x.id === (p as any).ink_set_id);
                                return `Maskine: ${m?.name || '?'}, Blæk: ${i?.name || '?'}`;
                              })()}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Margin-profil</Label>
                          <Select value={mpaConfig.margin_profile_id} onValueChange={v => { setMpaConfig({ ...mpaConfig, margin_profile_id: v }); setHasMachineEdits(true); }}>
                            <SelectTrigger><SelectValue placeholder="Vælg margin-profil" /></SelectTrigger>
                            <SelectContent>
                              {availableMpaData.marginProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Bestemmer avance og pris-trapper.</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Tryk-sider</Label>
                        <Select value={mpaConfig.allowed_sides} onValueChange={v => { setMpaConfig({ ...mpaConfig, allowed_sides: v }); setHasMachineEdits(true); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4+0_ONLY">Kun 4+0 (En-sidet)</SelectItem>
                            <SelectItem value="4+4_ONLY">Kun 4+4 (To-sidet)</SelectItem>
                            <SelectItem value="4+0_AND_4+4">Valgfrit (4+0 eller 4+4)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Beskæring (bleed) mm</Label>
                          <Input
                            type="number"
                            value={mpaConfig.bleed_mm}
                            onChange={e => { setMpaConfig({ ...mpaConfig, bleed_mm: parseInt(e.target.value) }); setHasMachineEdits(true); }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mellemrum (gap) mm</Label>
                          <Input
                            type="number"
                            value={mpaConfig.gap_mm}
                            onChange={e => { setMpaConfig({ ...mpaConfig, gap_mm: parseInt(e.target.value) }); setHasMachineEdits(true); }}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Tilgængelige Materialer</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto bg-muted/20">
                          {availableMpaData.materials.map(m => (
                            <div key={m.id} className="flex items-center space-x-2">
                              <Switch
                                checked={mpaConfig.material_ids?.includes(m.id)}
                                onCheckedChange={checked => {
                                  const ids = checked
                                    ? [...(mpaConfig.material_ids || []), m.id]
                                    : (mpaConfig.material_ids || []).filter((id: string) => id !== m.id);
                                  setMpaConfig({ ...mpaConfig, material_ids: ids });
                                  setHasMachineEdits(true);
                                }}
                              />
                              <span className="text-xs">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Tilgængelige Efterbehandlinger</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto bg-muted/20">
                          {availableMpaData.finishes.map(f => (
                            <div key={f.id} className="flex items-center space-x-2">
                              <Switch
                                checked={mpaConfig.finish_ids?.includes(f.id)}
                                onCheckedChange={checked => {
                                  const ids = checked
                                    ? [...(mpaConfig.finish_ids || []), f.id]
                                    : (mpaConfig.finish_ids || []).filter((id: string) => id !== f.id);
                                  setMpaConfig({ ...mpaConfig, finish_ids: ids });
                                  setHasMachineEdits(true);
                                }}
                              />
                              <span className="text-xs">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Mængder (komma-separeret)</Label>
                        <Input
                          value={mpaConfig.quantities?.join(', ')}
                          onChange={e => {
                            const q = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                            setMpaConfig({ ...mpaConfig, quantities: q });
                            setHasMachineEdits(true);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">De mængder kunden kan vælge (f.eks. 100, 250, 500).</p>
                      </div>

                      <div className="space-y-4 p-4 border rounded-md bg-muted/10">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={mpaConfig.numbering_enabled}
                            onCheckedChange={v => { setMpaConfig({ ...mpaConfig, numbering_enabled: v }); setHasMachineEdits(true); }}
                          />
                          <Label className="font-semibold">Tillad numerering</Label>
                        </div>

                        {mpaConfig.numbering_enabled && (
                          <div className="grid grid-cols-3 gap-4 pt-2">
                            <div className="space-y-2">
                              <Label className="text-xs">Opstarts-gebyr</Label>
                              <Input
                                type="number"
                                size={1}
                                value={mpaConfig.numbering_setup_fee}
                                onChange={e => { setMpaConfig({ ...mpaConfig, numbering_setup_fee: parseFloat(e.target.value) }); setHasMachineEdits(true); }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Pris pr. enhed</Label>
                              <Input
                                type="number"
                                size={1}
                                value={mpaConfig.numbering_price_per_unit}
                                onChange={e => { setMpaConfig({ ...mpaConfig, numbering_price_per_unit: parseFloat(e.target.value) }); setHasMachineEdits(true); }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Antal positioner</Label>
                              <Input
                                type="number"
                                size={1}
                                value={mpaConfig.numbering_positions}
                                onChange={e => { setMpaConfig({ ...mpaConfig, numbering_positions: parseInt(e.target.value) }); setHasMachineEdits(true); }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label>Størrelses-presets (valgfrit)</Label>
                        <div className="space-y-2">
                          {(mpaConfig.sizes || []).map((s: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input placeholder="Navn (f.eks. A4)" value={s.name} onChange={e => {
                                const newSizes = [...mpaConfig.sizes];
                                newSizes[idx].name = e.target.value;
                                setMpaConfig({ ...mpaConfig, sizes: newSizes });
                                setHasMachineEdits(true);
                              }} />
                              <Input type="number" placeholder="Bredde" value={s.width} onChange={e => {
                                const newSizes = [...mpaConfig.sizes];
                                newSizes[idx].width = parseInt(e.target.value);
                                setMpaConfig({ ...mpaConfig, sizes: newSizes });
                                setHasMachineEdits(true);
                              }} />
                              <Input type="number" placeholder="Højde" value={s.height} onChange={e => {
                                const newSizes = [...mpaConfig.sizes];
                                newSizes[idx].height = parseInt(e.target.value);
                                setMpaConfig({ ...mpaConfig, sizes: newSizes });
                                setHasMachineEdits(true);
                              }} />
                              <Button variant="ghost" size="icon" onClick={() => {
                                const newSizes = mpaConfig.sizes.filter((_: any, i: number) => i !== idx);
                                setMpaConfig({ ...mpaConfig, sizes: newSizes });
                                setHasMachineEdits(true);
                              }}><X className="h-4 w-4" /></Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => {
                            setMpaConfig({ ...mpaConfig, sizes: [...(mpaConfig.sizes || []), { name: "", width: 210, height: 297 }] });
                            setHasMachineEdits(true);
                          }}>
                            Tilføj størrelse
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={handleSaveMachineConfig}
                          disabled={!hasMachineEdits || saving}
                        >
                          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Gem Maskin-indstillinger
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">Dette produkt bruger standard matrix-prisberegning.</p>
                      <Button variant="outline" className="mt-4" onClick={() => setPricingType('MACHINE_PRICED')}>
                        Skift til Maskin-beregning
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>


        <TabsContent value="order-delivery" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Bestilling og levering</h2>
            <p className="text-muted-foreground">Konfigurer bestillingsflow og leveringsmetoder for dette produkt.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Bestillingsmuligheder</CardTitle>
              <CardDescription>Vælg hvordan dette produkt bestilles hos leverandor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Bestillingsmetode</Label>
                <RadioGroup
                  value={orderDeliveryConfig.ordering.type}
                  onValueChange={(value: OrderingType) => updateOrderDeliveryConfig(prev => ({
                    ...prev,
                    ordering: { ...prev.ordering, type: value }
                  }))}
                  className="grid gap-3 md:grid-cols-3"
                >
                  {[
                    { value: "standard", title: "Standard", description: "Webprinter standard workflow." },
                    { value: "semi", title: "Semi-automatiseret", description: "Assisteret bestilling uden API." },
                    { value: "email", title: "Email-bestilling", description: "Generer en leverandor-email." }
                  ].map(option => (
                    <label
                      key={option.value}
                      htmlFor={`ordering-${option.value}`}
                      className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition"
                    >
                      <RadioGroupItem value={option.value} id={`ordering-${option.value}`} className="mt-1" />
                      <div>
                        <div className="font-medium text-sm">{option.title}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {orderDeliveryConfig.ordering.type === "standard" && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Ingen ekstra felter for standard bestilling.
                </div>
              )}

              {orderDeliveryConfig.ordering.type === "semi" && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Leverandor navn</Label>
                      <Input
                        value={orderDeliveryConfig.ordering.supplier_name}
                        onChange={(e) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: { ...prev.ordering, supplier_name: e.target.value }
                        }))}
                        placeholder="F.eks. Trykkeri A/S"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Start URL</Label>
                      <Input
                        type="url"
                        value={orderDeliveryConfig.ordering.supplier_url}
                        onChange={(e) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: { ...prev.ordering, supplier_url: e.target.value }
                        }))}
                        placeholder="https://leverandor.dk/login"
                      />
                      {orderDeliveryConfig.ordering.supplier_url &&
                        !/^https?:\/\//i.test(orderDeliveryConfig.ordering.supplier_url) && (
                          <p className="text-xs text-red-500">Brug en URL der starter med http/https.</p>
                        )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instruktioner til operator (valgfri)</Label>
                    <Textarea
                      value={orderDeliveryConfig.ordering.operator_notes}
                      onChange={(e) => updateOrderDeliveryConfig(prev => ({
                        ...prev,
                        ordering: { ...prev.ordering, operator_notes: e.target.value }
                      }))}
                      placeholder="Noter til den der udfører bestillingen..."
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={orderDeliveryConfig.ordering.stop_before_payment}
                        onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: { ...prev.ordering, stop_before_payment: checked }
                        }))}
                      />
                      <span className="text-sm">Stop for betaling (kraver godkendelse)</span>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={orderDeliveryConfig.ordering.requires_login}
                        onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: { ...prev.ordering, requires_login: Boolean(checked) }
                        }))}
                      />
                      Kraver login/2FA (information)
                    </label>
                  </div>
                </div>
              )}

              {orderDeliveryConfig.ordering.type === "email" && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Leverandor email</Label>
                      <Input
                        type="email"
                        value={orderDeliveryConfig.ordering.email_settings.supplier_email}
                        onChange={(e) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: {
                            ...prev.ordering,
                            email_settings: { ...prev.ordering.email_settings, supplier_email: e.target.value }
                          }
                        }))}
                        placeholder="orders@leverandor.dk"
                      />
                      {orderDeliveryConfig.ordering.email_settings.supplier_email &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderDeliveryConfig.ordering.email_settings.supplier_email) && (
                          <p className="text-xs text-red-500">Ugyldigt email-format.</p>
                        )}
                    </div>
                    <div className="space-y-2">
                      <Label>Emne-skabelon</Label>
                      <Input
                        value={orderDeliveryConfig.ordering.email_settings.subject_template}
                        onChange={(e) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: {
                            ...prev.ordering,
                            email_settings: { ...prev.ordering.email_settings, subject_template: e.target.value }
                          }
                        }))}
                        placeholder="Order: {productName} - {orderNumber}"
                      />
                      <p className="text-xs text-muted-foreground">Tilgængelige felter: {`{productName}`} {`{orderNumber}`}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Body-skabelon</Label>
                    <Textarea
                      value={orderDeliveryConfig.ordering.email_settings.body_template}
                      onChange={(e) => updateOrderDeliveryConfig(prev => ({
                        ...prev,
                        ordering: {
                          ...prev.ordering,
                          email_settings: { ...prev.ordering.email_settings, body_template: e.target.value }
                        }
                      }))}
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">Brug felter som {`{quantity}`} og {`{customerName}`}. Ingen automatisk udsendelse endnu.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={orderDeliveryConfig.ordering.email_settings.attach_print_files}
                        onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: {
                            ...prev.ordering,
                            email_settings: { ...prev.ordering.email_settings, attach_print_files: checked }
                          }
                        }))}
                      />
                      <span className="text-sm">Vedhaeft printfiler</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={orderDeliveryConfig.ordering.email_settings.attach_spec_sheet}
                        onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          ordering: {
                            ...prev.ordering,
                            email_settings: { ...prev.ordering.email_settings, attach_spec_sheet: checked }
                          }
                        }))}
                      />
                      <span className="text-sm">Vedhaeft specifikation (PDF)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Default afsender-identitet</Label>
                    <Select
                      value={orderDeliveryConfig.ordering.email_settings.sender_identity}
                      onValueChange={(value: SenderIdentity) => updateOrderDeliveryConfig(prev => ({
                        ...prev,
                        ordering: {
                          ...prev.ordering,
                          email_settings: { ...prev.ordering.email_settings, sender_identity: value }
                        }
                      }))}
                    >
                      <SelectTrigger className="w-full md:w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">Platform afsender</SelectItem>
                        <SelectItem value="tenant">Tenant afsender</SelectItem>
                        <SelectItem value="customer">Kunde afsender (senere)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Kunde-afsender kan aktiveres senere.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Levering</CardTitle>
              <CardDescription>Administrer leveringsmetoder og tracking-indstillinger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Leveringsmode</Label>
                <RadioGroup
                  value={orderDeliveryConfig.delivery.mode}
                  onValueChange={(value: DeliveryMode) => updateOrderDeliveryConfig(prev => ({
                    ...prev,
                    delivery: { ...prev.delivery, mode: value }
                  }))}
                  className="grid gap-3 md:grid-cols-2"
                >
                  {[
                    { value: "manual", title: "Manuel levering", description: "Du styrer levering og tider." },
                    { value: "carrier", title: "Carrier tracking", description: "Fremtidig integration til fragtfirma." }
                  ].map(option => (
                    <label
                      key={option.value}
                      htmlFor={`delivery-${option.value}`}
                      className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition"
                    >
                      <RadioGroupItem value={option.value} id={`delivery-${option.value}`} className="mt-1" />
                      <div>
                        <div className="font-medium text-sm">{option.title}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {isMasterAdmin && product?.technical_specs?.is_pod && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">POD levering (master)</h3>
                      <p className="text-xs text-muted-foreground">
                        Tilpas hvilke leveringsvalg der vises til kunderne på POD produkter.
                      </p>
                    </div>
                    <Switch
                      checked={orderDeliveryConfig.delivery.pod_settings?.enabled ?? true}
                      onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                        ...prev,
                        delivery: {
                          ...prev.delivery,
                          pod_settings: {
                            ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                            enabled: checked
                          }
                        }
                      }))}
                    />
                  </div>

                  {(orderDeliveryConfig.delivery.pod_settings?.enabled ?? true) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Antal valg i prisberegner</Label>
                        <Select
                          value={String(orderDeliveryConfig.delivery.pod_settings?.max_options ?? 3)}
                          onValueChange={(value) => updateOrderDeliveryConfig(prev => ({
                            ...prev,
                            delivery: {
                              ...prev.delivery,
                              pod_settings: {
                                ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                                max_options: Number(value)
                              }
                            }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 valg</SelectItem>
                            <SelectItem value="3">3 valg</SelectItem>
                            <SelectItem value="4">4 valg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={orderDeliveryConfig.delivery.pod_settings?.show_deadline ?? true}
                            onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                              ...prev,
                              delivery: {
                                ...prev.delivery,
                                pod_settings: {
                                  ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                                  show_deadline: checked
                                }
                              }
                            }))}
                          />
                          Vis deadline for fil-aflevering
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={orderDeliveryConfig.delivery.pod_settings?.show_carrier ?? false}
                            onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                              ...prev,
                              delivery: {
                                ...prev.delivery,
                                pod_settings: {
                                  ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                                  show_carrier: checked
                                }
                              }
                            }))}
                          />
                          Vis fragtfirma-logo
                        </label>
                      </div>
                    </div>
                  )}

                  {(orderDeliveryConfig.delivery.pod_settings?.enabled ?? true) && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Navn: Bedste balance</Label>
                        <Input
                          value={orderDeliveryConfig.delivery.pod_settings?.labels?.best || ""}
                          onChange={(e) => updateOrderDeliveryConfig(prev => ({
                            ...prev,
                            delivery: {
                              ...prev.delivery,
                              pod_settings: {
                                ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                                labels: {
                                  ...(prev.delivery.pod_settings?.labels || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings?.labels),
                                  best: e.target.value
                                }
                              }
                            }
                          }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Navn: Bedste pris</Label>
                        <Input
                          value={orderDeliveryConfig.delivery.pod_settings?.labels?.cheapest || ""}
                          onChange={(e) => updateOrderDeliveryConfig(prev => ({
                            ...prev,
                            delivery: {
                              ...prev.delivery,
                              pod_settings: {
                                ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                                labels: {
                                  ...(prev.delivery.pod_settings?.labels || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings?.labels),
                                  cheapest: e.target.value
                                }
                              }
                            }
                          }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Navn: Hurtigst</Label>
                        <Input
                          value={orderDeliveryConfig.delivery.pod_settings?.labels?.fastest || ""}
                          onChange={(e) => updateOrderDeliveryConfig(prev => ({
                            ...prev,
                            delivery: {
                              ...prev.delivery,
                              pod_settings: {
                                ...(prev.delivery.pod_settings || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings),
                                labels: {
                                  ...(prev.delivery.pod_settings?.labels || DEFAULT_ORDER_DELIVERY_CONFIG.delivery.pod_settings?.labels),
                                  fastest: e.target.value
                                }
                              }
                            }
                          }))}
                        />
                      </div>
                    </div>
                  )}

                  {(orderDeliveryConfig.delivery.pod_settings?.enabled ?? true) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label className="text-xs">Fragtlogoer (valgfrit)</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Match Print.com carrier-navne, fx DHL, UPS.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const current = orderDeliveryConfig.delivery.pod_settings?.carrier_logos || [];
                            updatePodCarrierLogos([...current, { carrier: "", logo_url: "" }]);
                          }}
                        >
                          Tilfoj logo
                        </Button>
                      </div>

                      {(orderDeliveryConfig.delivery.pod_settings?.carrier_logos || []).length === 0 && (
                        <p className="text-xs text-muted-foreground">Ingen logoer endnu.</p>
                      )}

                      {(orderDeliveryConfig.delivery.pod_settings?.carrier_logos || []).map((entry, index) => (
                        <div key={`pod-carrier-${index}`} className="rounded-md border p-3 space-y-3">
                          <div className="grid gap-3 md:grid-cols-[1.2fr,1.4fr,1fr,auto] items-end">
                            <div className="space-y-1">
                              <Label className="text-xs">Carrier navn</Label>
                              <Input
                                value={entry?.carrier || ""}
                                onChange={(e) => {
                                  const next = [...(orderDeliveryConfig.delivery.pod_settings?.carrier_logos || [])];
                                  next[index] = { ...(next[index] || { logo_url: "" }), carrier: e.target.value };
                                  updatePodCarrierLogos(next);
                                }}
                                placeholder="DHL"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Logo URL</Label>
                              <Input
                                value={entry?.logo_url || ""}
                                onChange={(e) => {
                                  const next = [...(orderDeliveryConfig.delivery.pod_settings?.carrier_logos || [])];
                                  next[index] = { ...(next[index] || { carrier: "" }), logo_url: e.target.value };
                                  updatePodCarrierLogos(next);
                                }}
                                placeholder="https://..."
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Upload logo</Label>
                              <Input
                                type="file"
                                accept="image/*,.svg"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handlePodCarrierLogoUpload(index, file);
                                  }
                                  e.currentTarget.value = "";
                                }}
                                disabled={podCarrierUploadIndex === index}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              {podCarrierUploadIndex === index && <Loader2 className="h-4 w-4 animate-spin" />}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const next = [...(orderDeliveryConfig.delivery.pod_settings?.carrier_logos || [])];
                                  next.splice(index, 1);
                                  updatePodCarrierLogos(next);
                                }}
                                aria-label="Fjern logo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {entry?.logo_url && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <img
                                src={entry.logo_url}
                                alt={entry.carrier || "Carrier"}
                                className="h-6 w-auto object-contain border rounded px-1 py-0.5 bg-background"
                                loading="lazy"
                              />
                              <span>Forhaandsvisning</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {orderDeliveryConfig.delivery.mode === "manual" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Leveringsmetoder</h3>
                      <p className="text-xs text-muted-foreground">Tilfoj eller rediger metoder per produkt.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          delivery: { ...prev.delivery, methods: DEFAULT_DELIVERY_METHODS.map(m => ({ ...m })) }
                        }))}
                      >
                        Nulstil til standard
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          delivery: {
                            ...prev.delivery,
                            methods: [
                              ...prev.delivery.methods,
                              {
                                id: `method-${Math.random().toString(36).slice(2, 9)}`,
                                name: "Ny levering",
                                description: "",
                                lead_time_days: 0,
                                production_days: 0,
                                shipping_days: 0,
                                delivery_window_days: 0,
                                auto_mark_delivered: false,
                                auto_mark_days: 0,
                                price: 0,
                                cutoff_time: "",
                                cutoff_label: "deadline",
                                cutoff_text: ""
                              }
                            ]
                          }
                        }))}
                      >
                        Tilfoj leveringsmetode
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {orderDeliveryConfig.delivery.methods.map((method) => {
                      const totalDays = (method.production_days ?? 0) + (method.shipping_days ?? 0);
                      const cutoffLabelText = method.cutoff_label === "latest" ? "Senest bestilling" : "Deadline";
                      const cutoffTimeLabel = method.cutoff_time ? `${cutoffLabelText} kl. ${method.cutoff_time}` : cutoffLabelText;
                      const previewText = totalDays > 0
                        ? `${cutoffTimeLabel}. Levering om ${totalDays} dage.`
                        : `${cutoffTimeLabel}. Angiv produktion og forsendelse for at vise leveringstid.`;

                      return (
                        <div key={method.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <Input
                              value={method.name}
                              onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                ...prev,
                                delivery: {
                                  ...prev.delivery,
                                  methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, name: e.target.value } : m)
                                }
                              }))}
                              className="max-w-xs"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateOrderDeliveryConfig(prev => ({
                                ...prev,
                                delivery: {
                                  ...prev.delivery,
                                  methods: prev.delivery.methods.filter(m => m.id !== method.id)
                                }
                              }))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Textarea
                            value={method.description || ""}
                            onChange={(e) => updateOrderDeliveryConfig(prev => ({
                              ...prev,
                              delivery: {
                                ...prev.delivery,
                                methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, description: e.target.value } : m)
                              }
                            }))}
                            placeholder="Kort beskrivelse"
                            rows={2}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Kunde-status display</Label>
                            <div className="grid gap-3 md:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Produktion (dage)</Label>
                                <Input
                                  type="number"
                                  value={method.production_days ?? 0}
                                  onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                    ...prev,
                                    delivery: {
                                      ...prev.delivery,
                                      methods: prev.delivery.methods.map(m => m.id === method.id ? {
                                        ...m,
                                        production_days: Number(e.target.value),
                                        lead_time_days: Number(e.target.value) + (m.shipping_days ?? 0)
                                      } : m)
                                    }
                                  }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Forsendelse (dage)</Label>
                                <Input
                                  type="number"
                                  value={method.shipping_days ?? 0}
                                  onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                    ...prev,
                                    delivery: {
                                      ...prev.delivery,
                                      methods: prev.delivery.methods.map(m => m.id === method.id ? {
                                        ...m,
                                        shipping_days: Number(e.target.value),
                                        lead_time_days: (m.production_days ?? 0) + Number(e.target.value)
                                      } : m)
                                    }
                                  }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">+/- dage</Label>
                                <Input
                                  type="number"
                                  value={method.delivery_window_days ?? 0}
                                  onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                    ...prev,
                                    delivery: {
                                      ...prev.delivery,
                                      methods: prev.delivery.methods.map(m => m.id === method.id ? {
                                        ...m,
                                        delivery_window_days: Number(e.target.value)
                                      } : m)
                                    }
                                  }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Auto-leveret efter (dage)</Label>
                                <Input
                                  type="number"
                                  value={method.auto_mark_days ?? 0}
                                  onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                    ...prev,
                                    delivery: {
                                      ...prev.delivery,
                                      methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, auto_mark_days: Number(e.target.value) } : m)
                                    }
                                  }))}
                                  disabled={!method.auto_mark_delivered}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={method.auto_mark_delivered ?? false}
                                onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                                  ...prev,
                                  delivery: {
                                    ...prev.delivery,
                                    methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, auto_mark_delivered: checked } : m)
                                  }
                                }))}
                              />
                              <span className="text-sm">Auto-mark delivered</span>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Pris (kr)</Label>
                              <Input
                                type="number"
                                value={method.price ?? 0}
                                onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                  ...prev,
                                  delivery: {
                                    ...prev.delivery,
                                    methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, price: Number(e.target.value) } : m)
                                  }
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cut-off tidspunkt</Label>
                              <Input
                                type="time"
                                value={method.cutoff_time || ""}
                                onChange={(e) => updateOrderDeliveryConfig(prev => ({
                                  ...prev,
                                  delivery: {
                                    ...prev.delivery,
                                    methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, cutoff_time: e.target.value } : m)
                                  }
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cut-off label</Label>
                              <Select
                                value={method.cutoff_label || "deadline"}
                                onValueChange={(value: "deadline" | "latest") => updateOrderDeliveryConfig(prev => ({
                                  ...prev,
                                  delivery: {
                                    ...prev.delivery,
                                    methods: prev.delivery.methods.map(m => m.id === method.id ? { ...m, cutoff_label: value } : m)
                                  }
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="deadline">Deadline</SelectItem>
                                  <SelectItem value="latest">Senest bestilling</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Samlet leveringstid</Label>
                              <Input value={`${totalDays} dage`} readOnly />
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{previewText}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orderDeliveryConfig.delivery.mode === "carrier" && (
                <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Carrier tracking</h3>
                      <p className="text-xs text-muted-foreground">Status opdateres automatisk fra fragtfirma.</p>
                    </div>
                    <Switch
                      checked={orderDeliveryConfig.delivery.carrier_settings.enabled}
                      onCheckedChange={(checked) => updateOrderDeliveryConfig(prev => ({
                        ...prev,
                        delivery: {
                          ...prev.delivery,
                          carrier_settings: { ...prev.delivery.carrier_settings, enabled: checked }
                        }
                      }))}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Carrier</Label>
                      <Select
                        value={orderDeliveryConfig.delivery.carrier_settings.carrier}
                        onValueChange={(value) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          delivery: {
                            ...prev.delivery,
                            carrier_settings: { ...prev.delivery.carrier_settings, carrier: value }
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPS">UPS</SelectItem>
                          <SelectItem value="DHL">DHL</SelectItem>
                          <SelectItem value="GLS">GLS</SelectItem>
                          <SelectItem value="PostNord">PostNord</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>API key / konto</Label>
                      <Input
                        type="password"
                        value={orderDeliveryConfig.delivery.carrier_settings.api_key}
                        onChange={(e) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          delivery: {
                            ...prev.delivery,
                            carrier_settings: { ...prev.delivery.carrier_settings, api_key: e.target.value }
                          }
                        }))}
                        placeholder="Gemmes som konfiguration (coming later)"
                        disabled={!orderDeliveryConfig.delivery.carrier_settings.enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Konto ID</Label>
                      <Input
                        value={orderDeliveryConfig.delivery.carrier_settings.account_id}
                        onChange={(e) => updateOrderDeliveryConfig(prev => ({
                          ...prev,
                          delivery: {
                            ...prev.delivery,
                            carrier_settings: { ...prev.delivery.carrier_settings, account_id: e.target.value }
                          }
                        }))}
                        disabled={!orderDeliveryConfig.delivery.carrier_settings.enabled}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Ingen API-kald implementeret endnu.</p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button
                  onClick={handleSaveOrderDelivery}
                  disabled={!hasOrderDeliveryEdits || saving}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Gem bestilling og levering
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Valgmuligheder</CardTitle>
              <CardDescription>
                Opret og administrer valgmuligheder som vises på produktsiden. Disse kan have ekstra pris og ikon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OptionGroupManager productId={product.id} tenantId={product.tenant_id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-fields" className="space-y-6">
          <CustomFieldsManager
            productId={product.id}
            tenantId={product.tenant_id}
            onFieldsUpdate={fetchPrices}
          />
        </TabsContent>

        <TabsContent value="tooltips" className="space-y-6">
          <VisualTooltipDesigner
            productId={product.id}
            productName={editedName || product.name}
            productImage={product.image_url || undefined}
            tooltips={(product.banner_config as any)?.visual_tooltips || []}
            onTooltipsChange={(tooltips: TooltipConfig[]) => {
              // Save tooltips to banner_config
              const currentConfig = (product.banner_config as any) || {};
              const newConfig = { ...currentConfig, visual_tooltips: tooltips };
              supabase
                .from('products' as any)
                .update({ banner_config: newConfig })
                .eq('id', product.id)
                .then(() => {
                  fetchProduct();
                  toast.success("Tooltips gemt");
                });
            }}
          />
          <div className="border-t pt-6 mt-6">
            <h4 className="text-sm font-medium mb-4 text-muted-foreground">Legacy Tooltips (Tekst)</h4>
            <ProductTooltipEditor
              productId={product.id}
              tooltipProduct={product.tooltip_product}
              tooltipPrice={product.tooltip_price}
              tooltipQuickTilbud={product.tooltip_quick_tilbud}
              onUpdate={fetchProduct}
            />
          </div>
        </TabsContent>

        <TabsContent value="about">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-md font-medium">Produktnavn (system)</CardTitle>
                <CardDescription>
                  Dette navn bruges i hele bestillingsflowet og vises som produktets officielle navn.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-w-xl">
                  <Label htmlFor="product-system-name" className="text-xs">Produktnavn</Label>
                  <Input
                    id="product-system-name"
                    value={editedName}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="Indtast produktnavn"
                    className="h-9"
                  />
                </div>
                <div className="flex justify-end pt-3">
                  <Button
                    onClick={() => handleSaveProductDetails()}
                    size="sm"
                    disabled={!hasProductEdits || saving}
                  >
                    {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                    Gem produktnavn
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              {/* Sektion 1 (Was Section 2): Forside Information */}
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-md font-medium flex items-center gap-2">
                        <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                        Forside Produkter
                      </CardTitle>
                      {/* Preset Info Badge */}
                      {(product as any).preset_key && (product as any).preset_key !== 'custom' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                          <span>Skabelon:</span>
                          <span className="font-medium text-foreground">
                            {getPresetLabel((product as any).preset_key)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      {/* Left Column: Inputs */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="product-icon-text" className="text-xs">Ikon-tekst (forside)</Label>
                            <Input
                              id="product-icon-text"
                              value={editedIconText}
                              onChange={(e) => handleProductIconTextChange(e.target.value)}
                              placeholder="Kort navn til produktkort"
                              className="h-9"
                            />
                            <p className="text-[10px] text-muted-foreground">Vises på produktkort i oversigter.</p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="product-price-from" className="text-xs">Fra-pris & Udseende</Label>
                            <div className="flex gap-2 items-center">
                              <Input
                                id="product-price-from"
                                type="number"
                                value={editedPriceFrom}
                                onChange={(e) => {
                                  setEditedPriceFrom(e.target.value);
                                  setHasProductEdits(true);
                                }}
                                placeholder="395"
                                className="h-9 w-32"
                              />

                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Tilpas Udseende">
                                    <Palette className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80" align="start">
                                  <div className="space-y-4">
                                    <h4 className="font-medium text-sm border-b pb-2">Pris-udseende & Farver</h4>
                                    <div className="space-y-3">
                                      {/* Font Family Selection */}
                                      <FontSelector
                                        label="Skrifttype"
                                        value={editedPriceFont}
                                        onChange={(val) => {
                                          setEditedPriceFont(val);
                                          setHasProductEdits(true);
                                        }}
                                        inline
                                      />

                                      <div className="h-px bg-border/50 my-2" />

                                      {/* Text Color */}
                                      <ColorPickerWithSwatches
                                        label="Tekstfarve (Pris)"
                                        value={editedPriceColor}
                                        onChange={(c) => {
                                          setEditedPriceColor(c);
                                          setHasProductEdits(true);
                                        }}
                                        inline
                                      />

                                      <div className="h-px bg-border/50 my-2" />

                                      {/* Background Toggle & Color */}
                                      <div className="flex items-center justify-between">
                                        <Label htmlFor="bg-toggle" className="text-xs font-medium cursor-pointer">Vis farvet boks</Label>
                                        <Switch
                                          id="bg-toggle"
                                          checked={editedPriceBgEnabled}
                                          onCheckedChange={(checked) => {
                                            setEditedPriceBgEnabled(checked);
                                            setHasProductEdits(true);
                                          }}
                                        />
                                      </div>

                                      {editedPriceBgEnabled && (
                                        <ColorPickerWithSwatches
                                          label="Baggrundsfarve"
                                          value={editedPriceBgColor}
                                          onChange={(c) => {
                                            setEditedPriceBgColor(c);
                                            setHasProductEdits(true);
                                          }}
                                          inline
                                        />
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Vises som "Fra X,-"</p>
                          </div>
                        </div>

                        {/* Promotional Pricing Section */}
                        <div className="space-y-1.5 pt-3 border-t">
                          <Label className="text-xs font-medium">Kampagnepris</Label>
                          <p className="text-[10px] text-muted-foreground mb-2">Vis tilbudspris med overstreget originalpris og besparelse.</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="original-price" className="text-[10px] text-muted-foreground">Original pris (kr)</Label>
                              <Input
                                id="original-price"
                                type="number"
                                value={editedOriginalPrice}
                                onChange={(e) => {
                                  setEditedOriginalPrice(e.target.value);
                                  setHasProductEdits(true);
                                }}
                                placeholder="399"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="promo-price" className="text-[10px] text-muted-foreground">Kampagnepris (kr)</Label>
                              <Input
                                id="promo-price"
                                type="number"
                                value={editedPromoPrice}
                                onChange={(e) => {
                                  setEditedPromoPrice(e.target.value);
                                  setHasProductEdits(true);
                                }}
                                placeholder="199"
                                className="h-9"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <Label htmlFor="savings-badge" className="text-xs cursor-pointer">Vis "SPAR X%" badge</Label>
                            <Switch
                              id="savings-badge"
                              checked={editedShowSavingsBadge}
                              onCheckedChange={(checked) => {
                                setEditedShowSavingsBadge(checked);
                                setHasProductEdits(true);
                              }}
                            />
                          </div>
                          {editedPromoPrice && editedOriginalPrice && parseFloat(editedOriginalPrice) > parseFloat(editedPromoPrice) && (
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-md mt-2">
                              <span className="text-sm text-muted-foreground line-through">{editedOriginalPrice} kr</span>
                              <span className="text-sm font-bold text-green-600 dark:text-green-400">{editedPromoPrice} kr</span>
                              {editedShowSavingsBadge && (
                                <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">
                                  SPAR {Math.round((1 - parseFloat(editedPromoPrice) / parseFloat(editedOriginalPrice)) * 100)}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="product-description" className="text-xs">Kort beskrivelse (Max 50 tegn anbefales)</Label>
                            <span className={`text-[10px] ${editedDescription.length > 60 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                              {editedDescription.length} tegn
                            </span>
                          </div>
                          <Textarea
                            id="product-description"
                            value={editedDescription}
                            onChange={(e) => handleProductDescriptionChange(e.target.value)}
                            placeholder="Kort tekst til produktoversigter..."
                            className="min-h-[80px] text-sm resize-none"
                            rows={3}
                          />
                          {editedDescription.length > 60 && (
                            <p className="text-[10px] text-red-500 animate-pulse">
                              Beskrivelsen er lidt lang. Hold den kort for bedste visning.
                            </p>
                          )}
                        </div>

                        {/* Image Uploads */}
                        <div className="bg-muted/10 p-3 rounded-md border space-y-4">
                          <div>
                            <ProductImageUpload
                              productId={product.id}
                              currentImageUrl={product.image_url}
                              onImageUpdate={handleImageUpdate}
                              label="Forside Ikon / Billede"
                            />
                          </div>
                          <div className="pt-2 border-t">
                            <ProductImageUpload
                              productId={product.id}
                              currentImageUrl={editedHoverImageUrl}
                              onImageUpdate={(url) => setEditedHoverImageUrl(url)}
                              onUploadComplete={handleHoverImageUpdate}
                              label="Mouseover Billede (Brugereffekt)"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Vises når musen holdes over produktkortet. Valgfrit.
                            </p>
                          </div>
                        </div>

                        {/* Special Badge Editor */}
                        <SpecialBadgeEditor
                          value={editedSpecialBadge}
                          onChange={(config) => {
                            setEditedSpecialBadge(config);
                            setHasProductEdits(true);
                          }}
                        />

                      </div>

                      {/* Right Column: Preview */}
                      <div className="bg-gray-50/50 p-6 rounded-xl border border-dashed flex flex-col items-center justify-center min-h-[300px]">
                        <ProductPreviewCard
                          name={editedIconText || editedName}
                          priceFrom={editedPriceFrom}
                          description={editedDescription}
                          imageUrl={product.image_url}
                          priceColor={editedPriceColor}
                          priceBgColor={editedPriceBgColor}
                          priceBgEnabled={editedPriceBgEnabled}
                          priceFont={editedPriceFont}
                          hoverImageUrl={editedHoverImageUrl}
                          specialBadge={editedSpecialBadge}
                          promoPrice={editedPromoPrice}
                          originalPrice={editedOriginalPrice}
                          showSavingsBadge={editedShowSavingsBadge}
                        />
                        <div className="pt-4 w-full">
                          <Button
                            onClick={() => handleSaveProductDetails()}
                            size="sm"
                            disabled={!hasProductEdits || saving}
                            className="w-full"
                          >
                            {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                            Gem Forside Info
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sektion 2 (Was Section 1): Produktside Information */}
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md font-medium flex items-center gap-2">
                      <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                      Produktside Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductAboutSection
                      productId={product.id}
                      productSlug={product.slug}
                      aboutTitle={product.about_title}
                      aboutDescription={product.about_description}
                      aboutImageUrl={product.about_image_url}
                      templateFiles={product.template_files}
                      technicalSpecs={product.technical_specs}
                      onUpdate={fetchProduct}
                    />
                  </CardContent>
                </Card>
              </div>

              {(product?.technical_specs?.is_pod || product?.technical_specs?.is_pod_v2) && (
                <div className="space-y-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-md font-medium flex items-center gap-2">
                        <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                        Print.com PDF Preflight (POD)
                      </CardTitle>
                      <CardDescription>
                        Valider og auto-fix kundens PDF ved upload. Gælder kun Print.com POD-produkter.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Aktiver preflight ved upload</p>
                          <p className="text-xs text-muted-foreground">
                            Kører Print.com preflight, kontrollerer format/bleed og viser fejl.
                          </p>
                        </div>
                        <Switch
                          checked={editedPodPreflightEnabled}
                          onCheckedChange={(checked) => {
                            setEditedPodPreflightEnabled(checked);
                            if (!checked) setEditedPodPreflightAutoFix(false);
                            setHasSpecEdits(true);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Auto-fix PDF når muligt</p>
                          <p className="text-xs text-muted-foreground">
                            Hvis Print.com kan rette filen, bruges den rettede version til ordren.
                          </p>
                        </div>
                        <Switch
                          checked={editedPodPreflightAutoFix}
                          onCheckedChange={(checked) => {
                            setEditedPodPreflightAutoFix(checked);
                            setHasSpecEdits(true);
                          }}
                          disabled={!editedPodPreflightEnabled}
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleSaveTechnicalSpecs}
                          size="sm"
                          disabled={!hasSpecEdits || saving}
                        >
                          {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                          Gem preflight-indstillinger
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="machine" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Maskin-baseret Prisberegning</CardTitle>
                <CardDescription>Aktiver avanceret prisberegning baseret på maskiner, blæk og materialer.</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pricing-type">Metode:</Label>
                  <Select value={pricingType} onValueChange={(v: any) => { setPricingType(v); setHasMachineEdits(true); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Matrix</SelectItem>
                      <SelectItem value="MACHINE_PRICED">Maskin (MPA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {pricingType === 'MACHINE_PRICED' && (
                  <div className="flex items-center gap-2">
                    <Label>Visning:</Label>
                    <Select value={mpaConfig.display_mode || 'SELECTION'} onValueChange={v => { setMpaConfig({ ...mpaConfig, display_mode: v }); setHasMachineEdits(true); }}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SELECTION">Valgmenu</SelectItem>
                        <SelectItem value="MATRIX">Pris-tabel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {pricingType === 'MACHINE_PRICED' ? (
                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pris-profil</Label>
                      <Select value={mpaConfig.pricing_profile_id} onValueChange={v => { setMpaConfig({ ...mpaConfig, pricing_profile_id: v }); setHasMachineEdits(true); }}>
                        <SelectTrigger><SelectValue placeholder="Vælg profil" /></SelectTrigger>
                        <SelectContent>
                          {availableMpaData.pricingProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {mpaConfig.pricing_profile_id && (
                        <div className="text-[10px] bg-muted p-1.5 rounded border">
                          {(() => {
                            const p = availableMpaData.pricingProfiles.find(x => x.id === mpaConfig.pricing_profile_id);
                            if (!p) return null;
                            const m = availableMpaData.machines?.find(x => x.id === (p as any).machine_id);
                            const i = availableMpaData.inkSets?.find(x => x.id === (p as any).ink_set_id);
                            return `Maskine: ${m?.name || '?'}, Blæk: ${i?.name || '?'}`;
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Margin-profil</Label>
                      <Select value={mpaConfig.margin_profile_id} onValueChange={v => { setMpaConfig({ ...mpaConfig, margin_profile_id: v }); setHasMachineEdits(true); }}>
                        <SelectTrigger><SelectValue placeholder="Vælg margin-profil" /></SelectTrigger>
                        <SelectContent>
                          {availableMpaData.marginProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Bestemmer avance og pris-trapper.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tryk-sider</Label>
                    <Select value={mpaConfig.allowed_sides} onValueChange={v => { setMpaConfig({ ...mpaConfig, allowed_sides: v }); setHasMachineEdits(true); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4+0_ONLY">Kun 4+0 (En-sidet)</SelectItem>
                        <SelectItem value="4+4_ONLY">Kun 4+4 (To-sidet)</SelectItem>
                        <SelectItem value="4+0_AND_4+4">Valgfrit (4+0 eller 4+4)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Beskæring (bleed) mm</Label>
                      <Input
                        type="number"
                        value={mpaConfig.bleed_mm}
                        onChange={e => { setMpaConfig({ ...mpaConfig, bleed_mm: parseInt(e.target.value) }); setHasMachineEdits(true); }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mellemrum (gap) mm</Label>
                      <Input
                        type="number"
                        value={mpaConfig.gap_mm}
                        onChange={e => { setMpaConfig({ ...mpaConfig, gap_mm: parseInt(e.target.value) }); setHasMachineEdits(true); }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Tilgængelige Materialer</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto bg-muted/20">
                      {availableMpaData.materials.map(m => (
                        <div key={m.id} className="flex items-center space-x-2">
                          <Switch
                            checked={mpaConfig.material_ids?.includes(m.id)}
                            onCheckedChange={checked => {
                              const ids = checked
                                ? [...(mpaConfig.material_ids || []), m.id]
                                : (mpaConfig.material_ids || []).filter((id: string) => id !== m.id);
                              setMpaConfig({ ...mpaConfig, material_ids: ids });
                              setHasMachineEdits(true);
                            }}
                          />
                          <span className="text-sm truncate">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Tilgængelige Færdiggørelser</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto bg-muted/20">
                      {availableMpaData.finishes.map(f => (
                        <div key={f.id} className="flex items-center space-x-2">
                          <Switch
                            checked={mpaConfig.finish_ids?.includes(f.id)}
                            onCheckedChange={checked => {
                              const ids = checked
                                ? [...(mpaConfig.finish_ids || []), f.id]
                                : (mpaConfig.finish_ids || []).filter((id: string) => id !== f.id);
                              setMpaConfig({ ...mpaConfig, finish_ids: ids });
                              setHasMachineEdits(true);
                            }}
                          />
                          <span className="text-sm truncate">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mængder (komma-separeret)</Label>
                    <Input
                      value={mpaConfig.quantities?.join(', ')}
                      onChange={e => {
                        const q = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                        setMpaConfig({ ...mpaConfig, quantities: q });
                        setHasMachineEdits(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">De mængder kunden kan vælge (f.eks. 100, 250, 500).</p>
                  </div>

                  <div className="space-y-4 p-4 border rounded-md bg-muted/10">
                    <div className="flex items-center space-x-2">
                      <Switch checked={mpaConfig.numbering_enabled} onCheckedChange={v => { setMpaConfig({ ...mpaConfig, numbering_enabled: v }); setHasMachineEdits(true); }} />
                      <Label className="font-semibold">Tillad numerering</Label>
                    </div>

                    {mpaConfig.numbering_enabled && (
                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Opstarts-gebyr</Label>
                          <Input
                            type="number"
                            size={1}
                            value={mpaConfig.numbering_setup_fee}
                            onChange={e => { setMpaConfig({ ...mpaConfig, numbering_setup_fee: parseFloat(e.target.value) }); setHasMachineEdits(true); }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Pris pr. enhed</Label>
                          <Input
                            type="number"
                            size={1}
                            value={mpaConfig.numbering_price_per_unit}
                            onChange={e => { setMpaConfig({ ...mpaConfig, numbering_price_per_unit: parseFloat(e.target.value) }); setHasMachineEdits(true); }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Antal positioner</Label>
                          <Input
                            type="number"
                            size={1}
                            value={mpaConfig.numbering_positions}
                            onChange={e => { setMpaConfig({ ...mpaConfig, numbering_positions: parseInt(e.target.value) }); setHasMachineEdits(true); }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Størrelses-presets (valgfrit)</Label>
                    <div className="space-y-2">
                      {(mpaConfig.sizes || []).map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input placeholder="Navn (f.eks. A4)" value={s.name} onChange={e => {
                            const newSizes = [...mpaConfig.sizes];
                            newSizes[idx].name = e.target.value;
                            setMpaConfig({ ...mpaConfig, sizes: newSizes });
                            setHasMachineEdits(true);
                          }} />
                          <Input type="number" placeholder="Bredde" value={s.width} onChange={e => {
                            const newSizes = [...mpaConfig.sizes];
                            newSizes[idx].width = parseInt(e.target.value);
                            setMpaConfig({ ...mpaConfig, sizes: newSizes });
                            setHasMachineEdits(true);
                          }} />
                          <Input type="number" placeholder="Højde" value={s.height} onChange={e => {
                            const newSizes = [...mpaConfig.sizes];
                            newSizes[idx].height = parseInt(e.target.value);
                            setMpaConfig({ ...mpaConfig, sizes: newSizes });
                            setHasMachineEdits(true);
                          }} />
                          <Button variant="ghost" size="icon" onClick={() => {
                            const newSizes = mpaConfig.sizes.filter((_: any, i: number) => i !== idx);
                            setMpaConfig({ ...mpaConfig, sizes: newSizes });
                            setHasMachineEdits(true);
                          }}><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => {
                        setMpaConfig({ ...mpaConfig, sizes: [...(mpaConfig.sizes || []), { name: "", width: 210, height: 297 }] });
                        setHasMachineEdits(true);
                      }}>
                        Tilføj størrelse
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex justify-end">
                    <Button disabled={!hasMachineEdits || saving} onClick={handleSaveMachineConfig}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Gem Maskin-opsætning
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center bg-muted/30 border border-dashed rounded-lg">
                  <p className="text-muted-foreground">Dette produkt bruger standard matrix-prisberegning.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setPricingType('MACHINE_PRICED')}>
                    Skift til Maskin-beregning
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="seo" className="space-y-6">
          <ProductSeoTab
            productSlug={product.slug}
            productName={product.name}
            tenantId={product.tenant_id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
