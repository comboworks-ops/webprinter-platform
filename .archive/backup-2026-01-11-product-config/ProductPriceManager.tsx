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
import { Loader2, Save, Trash2, ArrowLeft, X, Settings2 } from "lucide-react";
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
import { PricingMethodSelector, PricingMethodKey } from "./PricingMethodSelector";
import { ProductTooltipEditor } from "./ProductTooltipEditor";
import { PriceHierarchyFilter } from "./PriceHierarchyFilter";
import { OptionGroupManager } from "./OptionGroupManager";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { SmartPriceGenerator } from "./SmartPriceGenerator";
import { useProductAttributes } from "@/hooks/useProductAttributes";
import { cn } from "@/lib/utils";


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

function getPricingTypeLabel(type: string | undefined): string {
  if (!type) return 'Ukendt';
  const labels: Record<string, string> = {
    'matrix': 'Matrix',
    'rate': 'Takst',
    'formula': 'Formel',
    'fixed': 'Fast pris',
    'custom-dimensions': 'Brugerdefinerede dimensioner',
    'machine-priced': 'Maskin-beregning (MPA)'
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
  const [editedDescription, setEditedDescription] = useState("");
  // Usage: "Fra-pris" Styling
  const [editedPriceColor, setEditedPriceColor] = useState("#000000");
  const [editedPriceBgColor, setEditedPriceBgColor] = useState("#FFFFFF");
  const [editedPriceBgEnabled, setEditedPriceBgEnabled] = useState(false);
  const [editedPriceFont, setEditedPriceFont] = useState("inherit");
  const [editedHoverImageUrl, setEditedHoverImageUrl] = useState<string | null>(null);

  const [editedPriceFrom, setEditedPriceFrom] = useState("");
  const [editedWidth, setEditedWidth] = useState("");
  const [editedHeight, setEditedHeight] = useState("");
  const [editedBleed, setEditedBleed] = useState("3");
  const [editedMinDpi, setEditedMinDpi] = useState("300");
  const [editedIsFreeForm, setEditedIsFreeForm] = useState(false);
  const [editedStandardFormat, setEditedStandardFormat] = useState("");
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

  // Hook for product attribute groups (used in pricing structure)
  const productAttrs = useProductAttributes(product?.id, product?.tenant_id);

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  useEffect(() => {
    if (product) {
      fetchPrices();
      setEditedName(product.name);
      setEditedDescription(product.description || "");
      setEditedPriceFrom((product.banner_config as any)?.price_from?.toString() || "");
      // Styling init
      const bc = (product.banner_config as any) || {};
      setEditedPriceColor(bc.price_color || "#000000");
      setEditedPriceBgColor(bc.price_bg_color || "#FFFFFF");
      setEditedPriceBgEnabled(bc.price_bg_enabled || false);
      setEditedPriceFont(bc.price_font || "inherit");
      setEditedHoverImageUrl(bc.hover_image_url || null);

      const specs = (product.technical_specs as any) || {};
      setEditedWidth(specs.width_mm?.toString() || "");
      setEditedHeight(specs.height_mm?.toString() || "");
      setEditedBleed(specs.bleed_mm?.toString() || "3");
      setEditedMinDpi(specs.min_dpi?.toString() || "300");
      setEditedIsFreeForm(specs.is_free_form || false);
      setEditedStandardFormat(specs.standard_format || "");
      setHasProductEdits(false);
      setHasSpecEdits(false);
      setHasMachineEdits(false);
      setEditedOutputColorProfileId(product.output_color_profile_id || null);
      fetchMpaConfig(product.id);
    }
  }, [product]);

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
    setHasProductEdits(value !== product?.name || editedDescription !== product?.description);
  };

  const handleProductDescriptionChange = (value: string) => {
    setEditedDescription(value);
    setHasProductEdits(editedName !== product?.name || value !== product?.description);
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
        description: editedDescription,
        banner_config: {
          ...currentConfig,
          price_from: parseFloat(editedPriceFrom) || null,
          price_color: editedPriceColor,
          price_bg_color: editedPriceBgColor,
          price_bg_enabled: editedPriceBgEnabled,
          price_font: editedPriceFont,
          hover_image_url: hoverImg
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

  const handleSaveTechnicalSpecs = async () => {
    if (!product || !hasSpecEdits) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          output_color_profile_id: editedOutputColorProfileId,
          technical_specs: {
            width_mm: parseFloat(editedWidth) || null,
            height_mm: parseFloat(editedHeight) || null,
            bleed_mm: parseFloat(editedBleed) || null,
            min_dpi: parseInt(editedMinDpi) || null,
            is_free_form: editedIsFreeForm,
            standard_format: editedStandardFormat
          }
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
          <TabsTrigger value="produkt" className="flex-shrink-0">Produkt</TabsTrigger>
          <TabsTrigger value="pricing" className="flex-shrink-0">Priser</TabsTrigger>
          <TabsTrigger value="options" className="flex-shrink-0">Valgmuligheder</TabsTrigger>
          <TabsTrigger value="custom-fields" className="flex-shrink-0">Felter</TabsTrigger>
          <TabsTrigger value="format" className="flex-shrink-0">Format & Preflight</TabsTrigger>
          <TabsTrigger value="machine" className="flex-shrink-0">Maskin-beregning (MPA)</TabsTrigger>
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

        <TabsContent value="format" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Format & Preflight Indstillinger</CardTitle>
                  <CardDescription>
                    Definer de præcise mål for produktet. Dette bruges til beskæringslinjer og automatisk fil-tjek.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-free-form" className="text-sm font-medium">Fripas / Fri format</Label>
                  <Switch
                    id="edit-free-form"
                    checked={editedIsFreeForm}
                    onCheckedChange={(checked) => {
                      setEditedIsFreeForm(checked);
                      if (checked) setEditedStandardFormat("");
                      setHasSpecEdits(true);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-standard-format">Vælg Format</Label>
                    <Select
                      value={editedStandardFormat}
                      onValueChange={(value) => {
                        const format = STANDARD_FORMATS.find(f => f.id === value);
                        if (format && value !== 'custom') {
                          setEditedStandardFormat(value);
                          setEditedWidth(format.width.toString());
                          setEditedHeight(format.height.toString());
                          setHasSpecEdits(true);
                        } else if (value === 'custom') {
                          setEditedStandardFormat('custom');
                          setEditedIsFreeForm(true);
                          setHasSpecEdits(true);
                        }
                      }}
                    >
                      <SelectTrigger id="edit-standard-format">
                        <SelectValue placeholder="Vælg format..." />
                      </SelectTrigger>
                      <SelectContent>
                        {STANDARD_FORMATS.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-width">Bredde (mm)</Label>
                      <Input
                        id="edit-width"
                        type="number"
                        value={editedWidth}
                        onChange={(e) => {
                          setEditedWidth(e.target.value);
                          setEditedStandardFormat("");
                          setHasSpecEdits(true);
                        }}
                        placeholder="f.eks. 210"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-height">Højde (mm)</Label>
                      <Input
                        id="edit-height"
                        type="number"
                        value={editedHeight}
                        onChange={(e) => {
                          setEditedHeight(e.target.value);
                          setEditedStandardFormat("");
                          setHasSpecEdits(true);
                        }}
                        placeholder="f.eks. 297"
                      />
                    </div>
                  </div>



                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-bleed">Bleed (mm)</Label>
                      <Input
                        id="edit-bleed"
                        type="number"
                        value={editedBleed}
                        onChange={(e) => {
                          setEditedBleed(e.target.value);
                          setHasSpecEdits(true);
                        }}
                        placeholder="f.eks. 3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-dpi">Min. DPI</Label>
                      <Input
                        id="edit-dpi"
                        type="number"
                        value={editedMinDpi}
                        onChange={(e) => {
                          setEditedMinDpi(e.target.value);
                          setHasSpecEdits(true);
                        }}
                        placeholder="f.eks. 300"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="mb-2 block font-semibold">Farvestyring (ICC)</Label>
                    <ProductColorProfileSelector
                      productId={product.id}
                      currentProfileId={editedOutputColorProfileId}
                      onProfileChange={(id) => {
                        setEditedOutputColorProfileId(id);
                        setHasSpecEdits(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Vælg den ICC-profil der skal bruges til soft-proofing og konvertering.
                    </p>
                  </div>
                </div>

                {/* Visual Preview */}
                <div className="bg-slate-50 p-6 rounded-xl border flex items-center justify-center min-h-[200px]">
                  <div className="text-center w-full">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-4">Live Preflight Preview</p>
                    <div
                      className="relative bg-white border shadow-sm mx-auto flex items-center justify-center transition-all duration-300"
                      style={{
                        width: '120px',
                        height: `${(parseFloat(editedHeight) / parseFloat(editedWidth)) * 120 || 160}px`,
                        maxHeight: '200px'
                      }}
                    >
                      {/* Bleed line */}
                      <div
                        className="absolute border border-red-500 border-dashed pointer-events-none"
                        style={{
                          top: `${(parseFloat(editedBleed) / (parseFloat(editedHeight) + parseFloat(editedBleed) * 2)) * 100}%`,
                          bottom: `${(parseFloat(editedBleed) / (parseFloat(editedHeight) + parseFloat(editedBleed) * 2)) * 100}%`,
                          left: `${(parseFloat(editedBleed) / (parseFloat(editedWidth) + parseFloat(editedBleed) * 2)) * 100}%`,
                          right: `${(parseFloat(editedBleed) / (parseFloat(editedWidth) + parseFloat(editedBleed) * 2)) * 100}%`,
                        }}
                      />
                      <div className="text-[8px] text-slate-400 font-medium">Design Zone</div>
                    </div>
                    <p className="text-[10px] text-red-500 font-bold mt-2">Rød linje = Beskæring (Bleed)</p>
                    {!editedIsFreeForm && editedStandardFormat && (
                      <p className="text-[10px] text-slate-500 font-medium mt-1">Valgt: {STANDARD_FORMATS.find(f => f.id === editedStandardFormat)?.name}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveTechnicalSpecs}
                  disabled={!hasSpecEdits || saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Gem Format Indstillinger
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
          <ProductAttributeBuilder
            productId={product.id}
            tenantId={product.tenant_id}
          />
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Priser for {product.name}</h2>
              <p className="text-muted-foreground">
                {prices.length > 0 ? `${prices.length} priser i alt` : "Ingen priser oprettet endnu"}
              </p>
            </div>
            <Button
              onClick={handleSaveAll}
              disabled={!hasEdits || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gem Alle Priser ({Object.keys(editedPrices).length + Object.keys(editedListPrices).length + Object.keys(editedPricePerUnit).length})
            </Button>
          </div>

          {/* SECTION 1: Pris metode */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Pris metode</CardTitle>
              <CardDescription>
                Vælg hvordan priser beregnes for dette produkt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PricingMethodSelector
                value={product.pricing_type || 'matrix'}
                onChange={async (method) => {
                  try {
                    setSaving(true);
                    const { error } = await supabase
                      .from('products')
                      .update({ pricing_type: method })
                      .eq('id', product.id);
                    if (error) throw error;
                    toast.success('Prismetode opdateret');
                    await fetchProduct();
                  } catch (e) {
                    toast.error('Kunne ikke opdatere prismetode');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* SECTION 1.5: Prisstruktur */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Prisstruktur
              </CardTitle>
              <CardDescription>
                Definer hvordan priser skal struktureres for dette produkt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prisberegningsmode</Label>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        setSaving(true);
                        const currentStructure = (product as any).pricing_structure || {};
                        const { error } = await supabase
                          .from('products')
                          .update({ pricing_structure: { ...currentStructure, mode: 'matrix', axis_a_group_id: null, axis_b_group_id: null } } as any)
                          .eq('id', product.id);
                        if (error) throw error;
                        toast.success('Prisstruktur opdateret');
                        await fetchProduct();
                      } catch (e) {
                        toast.error('Kunne ikke opdatere prisstruktur');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className={cn(
                      "flex-1 p-3 rounded-lg border-2 transition-all text-left",
                      (product as any)?.pricing_structure?.mode === 'matrix' || !(product as any)?.pricing_structure?.mode
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <p className="font-medium text-sm">Fast format</p>
                    <p className="text-xs text-muted-foreground">Format × Materiale matrix</p>
                  </button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          disabled
                          className={cn(
                            "flex-1 p-3 rounded-lg border-2 transition-all text-left opacity-50 cursor-not-allowed",
                            (product as any)?.pricing_structure?.mode === 'm2'
                              ? "border-primary bg-primary/10"
                              : "border-border"
                          )}
                        >
                          <p className="font-medium text-sm">M2 takst</p>
                          <p className="text-xs text-muted-foreground">Frit størrelsesvalg</p>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Kommer snart</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {((product as any)?.pricing_structure?.mode === 'matrix' || !(product as any)?.pricing_structure?.mode) && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Akse A (Format)</Label>
                    <Select
                      value={(product as any)?.pricing_structure?.axis_a_group_id || ''}
                      onValueChange={async (v) => {
                        try {
                          setSaving(true);
                          const currentStructure = (product as any).pricing_structure || { mode: 'matrix' };
                          const { error } = await supabase
                            .from('products')
                            .update({ pricing_structure: { ...currentStructure, axis_a_group_id: v } } as any)
                            .eq('id', product.id);
                          if (error) throw error;
                          toast.success('Akse A opdateret');
                          await fetchProduct();
                        } catch (e) {
                          toast.error('Kunne ikke opdatere akse');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg formatgruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        {productAttrs.groups.filter(g => g.kind === 'format').length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            Ingen formatgrupper oprettet
                          </div>
                        ) : (
                          productAttrs.groups.filter(g => g.kind === 'format').map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Akse B (Materiale)</Label>
                    <Select
                      value={(product as any)?.pricing_structure?.axis_b_group_id || ''}
                      onValueChange={async (v) => {
                        try {
                          setSaving(true);
                          const currentStructure = (product as any).pricing_structure || { mode: 'matrix' };
                          const { error } = await supabase
                            .from('products')
                            .update({ pricing_structure: { ...currentStructure, axis_b_group_id: v } } as any)
                            .eq('id', product.id);
                          if (error) throw error;
                          toast.success('Akse B opdateret');
                          await fetchProduct();
                        } catch (e) {
                          toast.error('Kunne ikke opdatere akse');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg materialegruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        {productAttrs.groups.filter(g => g.kind === 'material').length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            Ingen materialegrupper oprettet
                          </div>
                        ) : (
                          productAttrs.groups.filter(g => g.kind === 'material').map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2: Prisvisning */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Prisvisning</CardTitle>
              <CardDescription>
                Vælg hvordan prislisten vises i admin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <Button
                    variant={typeof window !== 'undefined' && localStorage.getItem(`priceViewMode_${product.id}`) !== 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      localStorage.setItem(`priceViewMode_${product.id}`, 'table');
                      window.location.reload();
                    }}
                  >
                    Pristabel
                  </Button>
                  <Button
                    variant={typeof window !== 'undefined' && localStorage.getItem(`priceViewMode_${product.id}`) === 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      localStorage.setItem(`priceViewMode_${product.id}`, 'single');
                      window.location.reload();
                    }}
                  >
                    Enkelpris
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Kun til admin visning, påvirker ikke butikken</p>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: Prisliste */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Prisliste</CardTitle>
              <CardDescription>
                Administrer priser for dette produkt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddPriceRow
                productId={product.id}
                productSlug={product.slug}
                tableName={getTableName(product.slug)}
                onPriceAdded={fetchPrices}
                existingPrice={prices[0]}
                isGeneric={isGenericPricing(product.slug)}
              />
              {prices.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <div className="text-muted-foreground">
                    <p className="font-medium">
                      Ingen priser oprettet endnu. Klik "Tilføj ny pris" for at starte.
                      {product.pricing_type && ` Pristype: ${getPricingTypeLabel(product.pricing_type).toLowerCase()}.`}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <PriceHierarchyFilter
                    prices={prices}
                    productSlug={product.slug}
                    onFilterChange={handleFilterChange}
                  />
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* Generic pricing columns */}
                          {isGenericPricing(product.slug) && <TableHead>Variant navn</TableHead>}
                          {isGenericPricing(product.slug) && <TableHead>Variant værdi</TableHead>}

                          {/* Specific product columns */}
                          {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "salgsmapper") && <TableHead>Format</TableHead>}
                          {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "plakater" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && <TableHead>Papir</TableHead>}
                          {(product.slug === "klistermærker" || product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Material</TableHead>}
                          {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Fra m²</TableHead>}
                          {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Til m²</TableHead>}
                          {product.slug === "foldere" && <TableHead>Falsetype</TableHead>}
                          {(product.slug === "hæfter" || product.slug === "haefter") && <TableHead>Antal sider</TableHead>}
                          {product.slug === "salgsmapper" && <TableHead>Sidetype</TableHead>}
                          {product.slug === "beachflag" && <TableHead>Størrelse</TableHead>}
                          {product.slug === "beachflag" && <TableHead>System</TableHead>}
                          {(isGenericPricing(product.slug) || product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "beachflag") && <TableHead>Antal</TableHead>}
                          <TableHead>Pris (DKK)</TableHead>
                          {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Rabat %</TableHead>}
                          {product.slug === "flyers" && <TableHead>Listepris (DKK)</TableHead>}
                          {(product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && <TableHead>Pris per enhed (DKK)</TableHead>}
                          <TableHead className="text-right">Handlinger</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPrices.map((price: any) => {
                          const isTieredAreaPricing = ['skilte', 'bannere', 'folie'].includes(product.slug);
                          const isBooklet = product.slug === 'hæfter' || product.slug === 'haefter';
                          const isSalgsmappe = product.slug === 'salgsmapper';
                          const useGeneric = isGenericPricing(product.slug);
                          const priceValue = useGeneric ? price.price_dkk : (isTieredAreaPricing ? price.price_per_sqm : (product.slug === 'beachflag' ? price.base_price : (isBooklet || isSalgsmappe ? price.base_price : price.price_dkk)));

                          return (
                            <TableRow key={price.id}>
                              {/* Generic pricing cells - editable */}
                              {useGeneric && (
                                <TableCell>
                                  <Input
                                    type="text"
                                    defaultValue={price.variant_name}
                                    onChange={(e) => handleVariantNameChange(price.id, e.target.value)}
                                    className="w-32"
                                  />
                                </TableCell>
                              )}
                              {useGeneric && (
                                <TableCell>
                                  <Input
                                    type="text"
                                    defaultValue={price.variant_value}
                                    onChange={(e) => handleVariantValueChange(price.id, e.target.value)}
                                    className="w-32"
                                  />
                                </TableCell>
                              )}

                              {/* Specific product cells */}
                              {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "salgsmapper") && <TableCell>{price.format}</TableCell>}
                              {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "plakater" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && <TableCell>{price.paper}</TableCell>}
                              {(product.slug === "klistermærker" || product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableCell>{price.material}</TableCell>}
                              {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableCell>{price.from_sqm}</TableCell>}
                              {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableCell>{price.to_sqm}</TableCell>}
                              {product.slug === "foldere" && <TableCell>{price.fold_type}</TableCell>}
                              {(product.slug === "hæfter" || product.slug === "haefter") && <TableCell>{price.pages}</TableCell>}
                              {product.slug === "salgsmapper" && <TableCell>{price.side_type}</TableCell>}
                              {product.slug === "beachflag" && <TableCell>{price.size}</TableCell>}
                              {product.slug === "beachflag" && <TableCell>{price.system}</TableCell>}
                              {/* Quantity - editable for generic, display-only for others */}
                              {useGeneric && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    defaultValue={price.quantity}
                                    onChange={(e) => handleQuantityChange(price.id, e.target.value)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              {(!useGeneric && (product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "beachflag")) && <TableCell>{price.quantity}</TableCell>}
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={priceValue}
                                  onChange={(e) => handlePriceChange(price.id, e.target.value)}
                                  className="w-24"
                                />
                              </TableCell>
                              {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    defaultValue={price.discount_percent || 0}
                                    onChange={(e) => handlePricePerUnitChange(price.id, e.target.value)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              {product.slug === "flyers" && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={price.list_price_dkk}
                                    onChange={(e) => handleListPriceChange(price.id, e.target.value)}
                                    className="w-24"
                                  />
                                </TableCell>
                              )}
                              {(product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={price.price_per_unit}
                                    onChange={(e) => handlePricePerUnitChange(price.id, e.target.value)}
                                    className="w-24"
                                  />
                                </TableCell>
                              )}
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(price.id)}
                                    disabled={!(price.id in editedPrices) && !(price.id in editedListPrices) && !(price.id in editedPricePerUnit) && !(price.id in editedVariantNames) && !(price.id in editedVariantValues) && !(price.id in editedQuantities) || saving}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeletePrice(price.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* SECTION 4: Prisværktøjer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Prisværktøjer</CardTitle>
              <CardDescription>
                Automatisk prisgenering og masseimport/eksport via CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Smart Price Generator */}
              <SmartPriceGenerator
                productId={product.id}
                productSlug={product.slug}
                pricingType={product.pricing_type || 'matrix'}
                tableName={getTableName(product.slug)}
                existingPrices={prices}
                onPricesGenerated={fetchPrices}
              />

              {/* CSV Tools */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">CSV værktøjer</h4>
                <BulkCSVTools
                  tableName={getTableName(product.slug)}
                  productSlug={product.slug}
                  productName={product.name}
                  productId={product.id}
                  onImportComplete={fetchPrices}
                />
              </div>
            </CardContent>
          </Card>

          {/* SECTION 5: Avanceret (MPA) */}
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                5. Avanceret
                {pricingType === 'MACHINE_PRICED' && (
                  <Badge className="bg-orange-500 text-white">MPA Aktiv</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Maskinberegning (MPA) til avanceret omkostningsbaseret prissætning
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pricingType === 'MACHINE_PRICED' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex-1">
                      <p className="font-medium">Maskinberegning er aktiveret</p>
                      <p className="text-sm text-muted-foreground">
                        Priser beregnes automatisk baseret på maskinkonfiguration
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('machine')}
                    >
                      Gå til MPA indstillinger
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-3">
                      Maskinberegning (MPA) er en avanceret prismotor, der beregner priser baseret på
                      maskinomkostninger, materialer, blæk og efterbehandling.
                    </p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          Aktivér Maskinberegning
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Aktivér Maskinberegning (MPA)</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                              Vigtig information
                            </p>
                            <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
                              <li>MPA er en avanceret beregningsmotor til komplekse produkter</li>
                              <li>Priser beregnes automatisk baseret på omkostninger og avance</li>
                              <li>Dine manuelle priser slettes ikke, men MPA overskriver prisvisningen</li>
                              <li>Du kan altid deaktivere MPA og vende tilbage til manuelle priser</li>
                            </ul>
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Afbryd</Button>
                          </DialogClose>
                          <Button
                            className="bg-orange-500 hover:bg-orange-600"
                            onClick={async () => {
                              try {
                                setSaving(true);
                                setPricingType('MACHINE_PRICED');
                                const { error } = await supabase
                                  .from('products')
                                  .update({ pricing_type: 'machine-priced' })
                                  .eq('id', product.id);
                                if (error) throw error;
                                toast.success('Maskinberegning aktiveret');
                                await fetchProduct();
                                setActiveTab('machine');
                              } catch (e) {
                                toast.error('Kunne ikke aktivere maskinberegning');
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            Aktivér
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
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
          <ProductTooltipEditor
            productId={product.id}
            tooltipProduct={product.tooltip_product}
            tooltipPrice={product.tooltip_price}
            tooltipQuickTilbud={product.tooltip_quick_tilbud}
            onUpdate={fetchProduct}
          />
        </TabsContent>

        <TabsContent value="about">
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
                      <div className="space-y-1.5">
                        <Label htmlFor="product-name" className="text-xs">Navn (Ikon-tekst)</Label>
                        <Input
                          id="product-name"
                          value={editedName}
                          onChange={(e) => handleProductNameChange(e.target.value)}
                          placeholder="F.eks. Flyers"
                          className="h-9"
                        />
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
                            onImageUpdate={(url) => setEditedHoverImageUrl(url)} // UI update only? No, onUploadComplete handles save
                            onUploadComplete={handleHoverImageUpdate}
                            label="Mouseover Billede (Brugereffekt)"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Vises når musen holdes over produktkortet. Valgfrit.
                          </p>
                        </div>
                      </div>

                      {/* Styling Section Moved to Popover */}

                      <div className="pt-2">
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

                    {/* Right Column: Preview */}
                    <div className="bg-gray-50/50 p-6 rounded-xl border border-dashed flex flex-col items-center justify-center min-h-[300px]">
                      <ProductPreviewCard
                        name={editedName}
                        priceFrom={editedPriceFrom}
                        description={editedDescription}
                        imageUrl={product.image_url}
                        priceColor={editedPriceColor}
                        priceBgColor={editedPriceBgColor}
                        priceBgEnabled={editedPriceBgEnabled}
                        priceFont={editedPriceFont}
                        hoverImageUrl={editedHoverImageUrl}
                      />
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
