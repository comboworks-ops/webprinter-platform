import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PriceMatrix } from "@/components/product-price-page/PriceMatrix";
import { MatrixLayoutV1Renderer } from "@/components/product-price-page/MatrixLayoutV1Renderer";
import { ProductPricePanel, type DeliveryMethod } from "@/components/product-price-page/ProductPricePanel";
import { ProductFilters } from "@/components/product-price-page/ProductFilters";
import { StaticProductInfo } from "@/components/product-price-page/StaticProductInfo";
import { CustomDimensionsCalculator } from "@/components/product-price-page/CustomDimensionsCalculator";
import { StorformatConfigurator, type StorformatSelection } from "@/components/product-price-page/StorformatConfigurator";
import { DynamicProductOptions } from "@/components/product-price-page/DynamicProductOptions";
import { MachineConfigurator } from "@/components/product-price-page/MachineConfigurator";
import { Input } from "@/components/ui/input";
import { getProductBySlug } from "@/utils/productMetadata";
import { getProductImage } from "@/utils/productImages";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { ProductSchema, BreadcrumbSchema } from "@/components/ProductSchema";
import { useShopSettings } from "@/hooks/useShopSettings";
import {
  type MatrixData
} from "@/utils/productPricing";
import {
  calculateFoilPrice,
  getGenericMatrixDataFromDB
} from "@/utils/pricingDatabase";
import { getDimensionsFromVariant } from "@/utils/formatStandards";
import { readTransientString, writeTransientString } from "@/lib/storage/transientStorage";
import { fetchProductDetailRead } from "@/lib/api/productDetailRead";
import { resolveCanvaOffer } from "@/lib/canva/launch";
import { resolveMatrixLinkedTemplateId } from "@/lib/designer/linkedTemplates";
import {
  getSalgsmapperFallbackTemplates,
  mergeProductTemplates,
  resolveSelectedDesignerTemplateLaunch,
  type ProductTemplateFile,
} from "@/lib/designer/productTemplateLinks";
import { StorefrontThemeFrame } from "@/components/storefront/StorefrontThemeFrame";
import type { SiteCheckoutState } from "@/lib/checkout/siteCheckoutSession";
import { resolveStorefrontProductFlow } from "@/lib/sites/storefrontProductFlow";

// Legacy product configurations removed on user request (2025-01-30)
// specificPricingProducts and productConfigs were deleted to unify on the generic pricing system.

const PRODUCT_DETAIL_CACHE_PREFIX = "product-price-detail-cache-v1";

type ProductDetailCachePayload = {
  at: number;
  tenantId: string;
  product: any;
  mpaConfig: any | null;
};

type SizeDistributionField = {
  key: string;
  label: string;
};

const isTransportError = (error: unknown): boolean => {
  const anyError = error as any;
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  const status = Number(anyError?.status || 0);
  return (
    message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("aborterror")
    || details.includes("failed to fetch")
    || details.includes("aborterror")
    || status === 0
    || status === 522
    || status === 523
    || status === 524
    || status === 503
  );
};

const detailCacheKey = (tenantId: string, slug: string) => `${PRODUCT_DETAIL_CACHE_PREFIX}:${tenantId}:${slug}`;

const readDetailCache = (tenantId: string, slug: string): ProductDetailCachePayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = readTransientString(detailCacheKey(tenantId, slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductDetailCachePayload;
    if (!parsed?.product || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeDetailCache = (tenantId: string, slug: string, payload: ProductDetailCachePayload) => {
  if (typeof window === "undefined") return;
  try {
    writeTransientString(detailCacheKey(tenantId, slug), JSON.stringify(payload));
  } catch {
    // Ignore storage errors.
  }
};

const ProductPrice = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const shopSettings = useShopSettings();
  const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
  const branding = shopSettings.data?.branding;
  const tenantName = String(
    branding?.shop_name
    || shopSettings.data?.tenant_name
    || shopSettings.data?.company?.name
    || "Din Shop",
  ).trim() || "Din Shop";

  const staticProduct = slug ? getProductBySlug(slug) : null;

  // State
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [matrixSelectedSectionValues, setMatrixSelectedSectionValues] = useState<Record<string, string | null>>({});
  const [matrixPricingMeta, setMatrixPricingMeta] = useState<{
    formatId?: string;
    materialId?: string;
    variantKey?: string;
    verticalValueId?: string;
  }>({});
  const [selectedExtraOption, setSelectedExtraOption] = useState<string>("");
  const [matrixData, setMatrixData] = useState<MatrixData>({ rows: [], columns: [], cells: {} });
  const [selectedCell, setSelectedCell] = useState<{ row: string; column: number } | null>(null);
  const [productPrice, setProductPrice] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [customArea, setCustomArea] = useState<number>(1); // m² for area-based products
  const [customWidth, setCustomWidth] = useState<number>(100); // cm
  const [customHeight, setCustomHeight] = useState<number>(100); // cm
  const [basePricePerSqm, setBasePricePerSqm] = useState<Record<string, number>>({});
  const [optionExtraPrice, setOptionExtraPrice] = useState<number>(0);
  const [optionSelections, setOptionSelections] = useState<Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>>({});
  const [sizeDistributionValues, setSizeDistributionValues] = useState<Record<string, number>>({});
  const [pricingStructure, setPricingStructure] = useState<any>(null);
  const [valueNameById, setValueNameById] = useState<Record<string, string>>({});
  const [valueMetaById, setValueMetaById] = useState<Record<string, { width_mm?: number; height_mm?: number; bleed_mm?: number; safe_area_mm?: number }>>({});
  const [matrixSelectionSummary, setMatrixSelectionSummary] = useState<string[]>([]);
  const [storformatSelection, setStorformatSelection] = useState<StorformatSelection | null>(null);
  const [podSelectionMeta, setPodSelectionMeta] = useState<{ variantKey?: string; verticalValueId?: string }>({});
  const [podShippingMethods, setPodShippingMethods] = useState<DeliveryMethod[]>([]);
  const [podShippingLoading, setPodShippingLoading] = useState(false);
  const [podShippingError, setPodShippingError] = useState<string | null>(null);
  const [orderDeliveryConfig, setOrderDeliveryConfig] = useState<any>(null);

  // Debug: Track productPrice state changes
  useEffect(() => {
    console.log('[ProductPrice] productPrice state changed to:', productPrice);
  }, [productPrice]);;
  const [dbProductId, setDbProductId] = useState<string | null>(null);
  const [genericVariantNames, setGenericVariantNames] = useState<string[]>([]);
  const [selectedVariantName, setSelectedVariantName] = useState<string>("");
  const [dbProduct, setDbProduct] = useState<{
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    technical_specs?: any;
    pricing_type?: string;
    category?: string | null;
    banner_config?: any;
    template_files?: ProductTemplateFile[] | null;
    slug?: string | null;
    tenant_id?: string | null;
    is_published?: boolean;
  } | null>(null);
  const [mpaConfig, setMpaConfig] = useState<any>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [productUnavailable, setProductUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const isUuid = useCallback((value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }, []);

  // Use static product if available, otherwise fall back to database product
  const product = useMemo(() => productUnavailable ? null : staticProduct || (dbProduct ? {
    id: slug || '',
    name: dbProduct.name,
    slug: slug || '',
    description: dbProduct.description,
    hasMatrixPricing: false,
    pricingType: 'matrix' as const,
    category: 'tryksager' as const,
    image: dbProduct.image_url || '/placeholder.svg'
  } : null), [productUnavailable, staticProduct, dbProduct, slug]);

  // No legacy config fallback
  const config = null;
  // Always generic if database product exists (unless overridden by specific types below)
  const isGenericPricing = !!dbProduct;
  const isStorformat = !!dbProduct && dbProduct.pricing_type === "STORFORMAT";
  const isPodProduct = !!dbProduct?.technical_specs?.is_pod;
  const podShippingEnabled = isPodProduct
    && pricingStructure?.mode === "matrix_layout_v1"
    && (orderDeliveryConfig?.delivery?.pod_settings?.enabled ?? true);
  const shippingCountry = "DK";

  const sizeDistributionConfig = useMemo(() => {
    const raw = (dbProduct?.technical_specs as any)?.size_distribution;
    if (!raw?.enabled) return null;

    const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
    const fields: SizeDistributionField[] = rawFields
      .map((field: any, index: number) => {
        if (typeof field === "string") {
          const label = field.trim();
          if (!label) return null;
          return {
            key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `field-${index + 1}`,
            label,
          };
        }

        if (field && typeof field === "object") {
          const label = String(field.label || field.name || field.key || "").trim();
          if (!label) return null;
          const key = String(field.key || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          return {
            key: key || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `field-${index + 1}`,
            label,
          };
        }

        return null;
      })
      .filter(Boolean) as SizeDistributionField[];

    if (fields.length === 0) return null;

    return {
      title: String(raw.title || "Størrelsesfordeling"),
      enforceQuantityMatch: raw.enforce_quantity_match !== false,
      fields,
    };
  }, [dbProduct?.technical_specs]);

  const sizeDistributionFields = sizeDistributionConfig?.fields || [];

  useEffect(() => {
    if (!sizeDistributionConfig) {
      setSizeDistributionValues((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    const allowedKeys = new Set(sizeDistributionFields.map((field) => field.key));
    setSizeDistributionValues((prev) => {
      const next: Record<string, number> = {};
      let changed = false;

      sizeDistributionFields.forEach((field) => {
        const current = Number(prev[field.key] || 0);
        next[field.key] = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
      });

      Object.keys(prev).forEach((key) => {
        if (!allowedKeys.has(key)) changed = true;
      });

      if (!changed) {
        changed = sizeDistributionFields.some((field) => (prev[field.key] || 0) !== next[field.key]);
      }

      return changed ? next : prev;
    });
  }, [sizeDistributionConfig, sizeDistributionFields]);

  const sizeDistributionTotal = useMemo(() => {
    if (!sizeDistributionConfig) return 0;
    return sizeDistributionFields.reduce((sum, field) => sum + (Number(sizeDistributionValues[field.key] || 0) || 0), 0);
  }, [sizeDistributionConfig, sizeDistributionFields, sizeDistributionValues]);

  const sizeDistributionEntries = useMemo(() => {
    if (!sizeDistributionConfig) return [] as Array<{ key: string; label: string; value: number }>;
    return sizeDistributionFields
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: Number(sizeDistributionValues[field.key] || 0) || 0,
      }))
      .filter((entry) => entry.value > 0);
  }, [sizeDistributionConfig, sizeDistributionFields, sizeDistributionValues]);

  const sizeDistributionSelectionQuantity = isStorformat
    ? (storformatSelection?.quantity || 0)
    : (selectedCell?.column || 0);

  const sizeDistributionMismatch = useMemo(() => {
    if (!sizeDistributionConfig?.enforceQuantityMatch) return false;
    if (!sizeDistributionSelectionQuantity || sizeDistributionSelectionQuantity <= 0) return false;
    return sizeDistributionTotal !== sizeDistributionSelectionQuantity;
  }, [
    sizeDistributionConfig?.enforceQuantityMatch,
    sizeDistributionSelectionQuantity,
    sizeDistributionTotal,
  ]);

  const orderValidationError = useMemo(() => {
    if (!sizeDistributionMismatch) return null;
    return `Fordel størrelser så summen er ${sizeDistributionSelectionQuantity} stk (nu ${sizeDistributionTotal}).`;
  }, [sizeDistributionMismatch, sizeDistributionSelectionQuantity, sizeDistributionTotal]);

  const sizeDistributionSummary = useMemo(() => {
    if (!sizeDistributionConfig || sizeDistributionEntries.length === 0) return "";
    const entries = sizeDistributionEntries.map((entry) => `${entry.label}: ${entry.value}`).join(", ");
    const totalPart = sizeDistributionSelectionQuantity > 0
      ? ` (sum ${sizeDistributionTotal}/${sizeDistributionSelectionQuantity})`
      : ` (sum ${sizeDistributionTotal})`;
    return `${sizeDistributionConfig.title}: ${entries}${totalPart}`;
  }, [
    sizeDistributionConfig,
    sizeDistributionEntries,
    sizeDistributionTotal,
    sizeDistributionSelectionQuantity,
  ]);

  // Fetch database product ID and data for dynamic options
  useEffect(() => {
    async function fetchDbProduct() {
      if (!slug) return;
      if (shopSettings.isLoading) return;
      setLoading(true);
      setFallbackNotice(null);
      setProductUnavailable(false);
      setMpaConfig(null);
      console.log('[ProductPrice] Fetching product with slug:', slug);
      const productSelect = 'id, slug, name, description, image_url, category, technical_specs, pricing_structure, pricing_type, banner_config, template_files' as any;
      const tenantId = shopSettings.data?.id || MASTER_TENANT_ID;
      const applyProductData = (data: any) => {
        setDbProductId(data.id);
        setDbProduct(data);
        setProductUnavailable(false);
        setOrderDeliveryConfig((data as any).banner_config?.order_delivery || null);
        const rawStructure = (data as any).pricing_structure;
        let parsedStructure = rawStructure;
        if (typeof rawStructure === 'string') {
          try {
            parsedStructure = JSON.parse(rawStructure);
          } catch {
            parsedStructure = null;
          }
        }
        if (parsedStructure && !parsedStructure.mode && parsedStructure.vertical_axis && parsedStructure.layout_rows) {
          parsedStructure = { ...parsedStructure, mode: 'matrix_layout_v1' };
        }
        if (parsedStructure?.mode === 'matrix_layout_v1') {
          setPricingStructure(parsedStructure);
        } else {
          setPricingStructure(null);
        }
      };

      const mapApiProductToLocalShape = (apiProduct: Record<string, unknown> | null) => {
        if (!apiProduct || typeof apiProduct !== "object") return null;
        return {
          id: String(apiProduct.id || ""),
          name: typeof apiProduct.name === "string" ? apiProduct.name : "",
          description: typeof apiProduct.description === "string" ? apiProduct.description : "",
          image_url: typeof apiProduct.image_url === "string" ? apiProduct.image_url : null,
          category: typeof apiProduct.category === "string" ? apiProduct.category : null,
          technical_specs: (apiProduct.technical_specs && typeof apiProduct.technical_specs === "object") ? apiProduct.technical_specs : null,
          pricing_structure: apiProduct.pricing_structure ?? null,
          pricing_type: typeof apiProduct.pricing_type === "string" ? apiProduct.pricing_type : null,
          banner_config: (apiProduct.banner_config && typeof apiProduct.banner_config === "object") ? apiProduct.banner_config : null,
          template_files: Array.isArray(apiProduct.template_files) ? apiProduct.template_files : [],
          slug: typeof apiProduct.slug === "string" ? apiProduct.slug : null,
          tenant_id: typeof apiProduct.tenant_id === "string" ? apiProduct.tenant_id : null,
          is_published: apiProduct.is_published === true,
        };
      };

      const isVisibleStorefrontProduct = (data: any) => {
        if (!data?.id || data.is_published !== true) return false;
        if (data.tenant_id === tenantId) return true;
        return tenantId !== MASTER_TENANT_ID && data.tenant_id === MASTER_TENANT_ID;
      };

      const throwIfTransportError = (err: any, context: string) => {
        if (!err) return;
        if (!isTransportError(err)) return;
        const transportError = new Error(`Product transport failure (${context})`);
        (transportError as any).code = "PRODUCT_TRANSPORT";
        throw transportError;
      };

      try {
        try {
          const apiResult = await fetchProductDetailRead({
            tenantId,
            slug,
            hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
            pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
          });

          const apiProduct = mapApiProductToLocalShape(apiResult.product as Record<string, unknown> | null);
          if (apiResult.success && apiProduct?.id && isVisibleStorefrontProduct(apiProduct)) {
            console.log('[ProductPrice] product-detail-read result:', { data: apiProduct, source: apiResult.source });
            console.log('[ProductPrice] Setting dbProductId to:', apiProduct.id);
            applyProductData(apiProduct);

            const { data: cfg } = await supabase
              .from('product_pricing_configs' as any)
              .select('*')
              .eq('product_id', apiProduct.id)
              .eq('pricing_type', 'MACHINE_PRICED')
              .maybeSingle();

            if (cfg) {
              setMpaConfig(cfg);
            }

            writeDetailCache(tenantId, slug, {
              at: Date.now(),
              tenantId,
              product: apiProduct,
              mpaConfig: cfg || null,
            });

            return;
          }
          if (apiResult.success && apiProduct?.id) {
            console.warn('[ProductPrice] Ignoring product-detail-read result outside storefront visibility rules:', {
              id: apiProduct.id,
              source: apiResult.source,
              tenant_id: apiProduct.tenant_id,
              is_published: apiProduct.is_published,
            });
          }
        } catch (apiError) {
          console.warn('[ProductPrice] product-detail-read failed, falling back to direct query:', apiError);
        }

        const { data: tenantScopedRows, error: tenantScopedError } = await supabase
          .from('products')
          .select(productSelect)
          .eq('slug', slug)
          .eq('tenant_id', tenantId)
          .eq('is_published', true)
          .limit(1);

        if (tenantScopedError) {
          console.warn('[ProductPrice] Tenant-scoped product query error:', tenantScopedError);
          throwIfTransportError(tenantScopedError, 'tenantScoped');
        }

        let data = (tenantScopedRows && tenantScopedRows.length > 0) ? (tenantScopedRows[0] as any) : null;

        if (!data && tenantId !== MASTER_TENANT_ID) {
          const { data: masterRows, error: masterError } = await supabase
            .from('products')
            .select(productSelect)
            .eq('slug', slug)
            .eq('tenant_id', MASTER_TENANT_ID)
            .eq('is_published', true)
            .limit(1);

          if (masterError) {
            console.warn('[ProductPrice] Master fallback product query error:', masterError);
            throwIfTransportError(masterError, 'masterFallback');
          }

          data = (masterRows && masterRows.length > 0) ? (masterRows[0] as any) : null;
        }

        if (!data) {
          const { data: publishedRows, error: publishedError } = await supabase
            .from('products')
            .select(productSelect)
            .eq('slug', slug)
            .eq('tenant_id', MASTER_TENANT_ID)
            .eq('is_published', true)
            .limit(1);

          if (publishedError) {
            console.warn('[ProductPrice] Published fallback product query error:', publishedError);
            throwIfTransportError(publishedError, 'publishedFallback');
          }

          data = (publishedRows && publishedRows.length > 0) ? (publishedRows[0] as any) : null;
        }

        console.log('[ProductPrice] Database result:', { data });

        if (data) {
          console.log('[ProductPrice] Setting dbProductId to:', data.id);
          applyProductData(data);

          // Fetch MPA Config if available
          const { data: cfg } = await supabase
            .from('product_pricing_configs' as any)
            .select('*')
            .eq('product_id', data.id)
            .eq('pricing_type', 'MACHINE_PRICED')
            .maybeSingle();

          if (cfg) {
            setMpaConfig(cfg);
          }

          writeDetailCache(tenantId, slug, {
            at: Date.now(),
            tenantId,
            product: data,
            mpaConfig: cfg || null,
          });
        } else {
          console.warn('[ProductPrice] No product found for slug:', slug);
          setDbProductId(null);
          setDbProduct(null);
          setPricingStructure(null);
          setOrderDeliveryConfig(null);
          setProductUnavailable(tenantId !== MASTER_TENANT_ID);
        }
      } catch (error) {
        console.warn('[ProductPrice] Product fetch failed:', error);
        const isTransport = (error as any)?.code === "PRODUCT_TRANSPORT" || isTransportError(error);
        if (isTransport) {
          const cached = readDetailCache(tenantId, slug) || (tenantId === MASTER_TENANT_ID ? readDetailCache(MASTER_TENANT_ID, slug) : null);
          if (cached) {
            applyProductData(cached.product);
            if (cached.mpaConfig) setMpaConfig(cached.mpaConfig);
            setFallbackNotice('Viser senest gemte produktdata, fordi backend-forbindelsen fejler midlertidigt.');
          }
        }
      } finally {
        setLoading(false);
      }
    }
    fetchDbProduct();
  }, [slug, shopSettings.data?.id, shopSettings.isLoading]);

  useEffect(() => {
    if (!dbProductId || !isGenericPricing) return;

    const fetchAttributeValues = async () => {
      const { data } = await supabase
        .from('product_attribute_groups' as any)
        .select('id, values:product_attribute_values(id, name, width_mm, height_mm, meta)')
        .eq('product_id', dbProductId);

      const map: Record<string, string> = {};
      const metaMap: Record<string, { width_mm?: number; height_mm?: number; bleed_mm?: number; safe_area_mm?: number }> = {};
      (data || []).forEach((group: any) => {
        (group.values || []).forEach((value: any) => {
          map[value.id] = value.name;
          let parsedMeta: any = value.meta || null;
          if (typeof parsedMeta === "string") {
            try {
              parsedMeta = JSON.parse(parsedMeta);
            } catch {
              parsedMeta = null;
            }
          }
          metaMap[value.id] = {
            width_mm: value.width_mm ?? undefined,
            height_mm: value.height_mm ?? undefined,
            bleed_mm: typeof parsedMeta?.bleed_mm === "number" ? parsedMeta.bleed_mm : undefined,
            safe_area_mm: typeof parsedMeta?.safe_area_mm === "number" ? parsedMeta.safe_area_mm : undefined
          };
        });
      });
      setValueNameById(map);
      setValueMetaById(metaMap);
    };

    fetchAttributeValues();
  }, [dbProductId, isGenericPricing]);

  useEffect(() => {
    if (!isGenericPricing) return;

    const ids = new Set<string>();
    const addId = (id: string) => {
      if (isUuid(id)) ids.add(id);
    };

    genericVariantNames.forEach(name => {
      name.split('|').forEach(addId);
    });

    matrixData.rows.forEach(addId);

    const missingIds = Array.from(ids).filter(id => !valueNameById[id]);
    if (missingIds.length === 0) return;

    const fetchMissingValues = async () => {
      const { data } = await supabase
        .from('product_attribute_values' as any)
        .select('id, name, width_mm, height_mm, meta')
        .in('id', missingIds);

      if (!data || data.length === 0) return;

      const map: Record<string, string> = {};
      const metaMap: Record<string, { width_mm?: number; height_mm?: number; bleed_mm?: number; safe_area_mm?: number }> = {};
      (data || []).forEach((value: any) => {
        map[value.id] = value.name;
        let parsedMeta: any = value.meta || null;
        if (typeof parsedMeta === "string") {
          try {
            parsedMeta = JSON.parse(parsedMeta);
          } catch {
            parsedMeta = null;
          }
        }
        metaMap[value.id] = {
          width_mm: value.width_mm ?? undefined,
          height_mm: value.height_mm ?? undefined,
          bleed_mm: typeof parsedMeta?.bleed_mm === "number" ? parsedMeta.bleed_mm : undefined,
          safe_area_mm: typeof parsedMeta?.safe_area_mm === "number" ? parsedMeta.safe_area_mm : undefined
        };
      });
      setValueNameById(prev => ({ ...prev, ...map }));
      setValueMetaById(prev => ({ ...prev, ...metaMap }));
    };

    fetchMissingValues();
  }, [genericVariantNames, matrixData.rows, isGenericPricing, valueNameById, isUuid]);

  const formatVariantLabel = useCallback((variantName: string) => {
    if (!variantName || variantName === 'none') return 'Standard';
    const parts = variantName.split('|').filter(Boolean);
    if (parts.length === 0) return 'Standard';
    return parts.map(id => valueNameById[id] || id).join(', ');
  }, [valueNameById]);

  // Scroll to top when landing on product page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Initialize format and extra options
  useEffect(() => {
  }, [product?.id]);

  // Fetch variant names for generic products
  useEffect(() => {
    if (!isGenericPricing || !dbProductId) return;
    if (isStorformat) return;
    if (pricingStructure?.mode === 'matrix_layout_v1') return;

    const fetchVariantNames = async () => {
      const { matrixData, variantNames } = await getGenericMatrixDataFromDB(dbProductId, undefined);
      if (variantNames.length > 0) {
        setGenericVariantNames(variantNames);
        setSelectedVariantName(prev => prev || variantNames[0]);
      }
    };
    fetchVariantNames();
  }, [isGenericPricing, dbProductId, pricingStructure, isStorformat]);

  // Update matrix data
  useEffect(() => {
    if (!product) return;
    if (isStorformat) return;
    if (pricingStructure?.mode === 'matrix_layout_v1') return;

    // Skip for MPA products - MachineConfigurator handles pricing
    if (mpaConfig) return;

    if (isGenericPricing && (!dbProductId || !selectedVariantName)) return;
    if (!isGenericPricing && !selectedFormat) return;

    const loadMatrixData = async () => {
      let newMatrixData: MatrixData = { rows: [], columns: [], cells: {} };

      if (dbProductId && selectedVariantName) {
        console.log(`Loading generic matrix for product: ${product.id}, variant: ${selectedVariantName}`);
        const { matrixData } = await getGenericMatrixDataFromDB(dbProductId, selectedVariantName);
        newMatrixData = matrixData;
        if (Object.keys(valueNameById).length > 0 && matrixData.rows.length > 0) {
          const mappedRows = matrixData.rows.map(rowId => valueNameById[rowId] || rowId);
          const mappedCells: Record<string, Record<number, number>> = {};
          matrixData.rows.forEach((rowId, index) => {
            mappedCells[mappedRows[index]] = matrixData.cells[rowId] || {};
          });
          newMatrixData = { ...matrixData, rows: mappedRows, cells: mappedCells };
        }
      }

      console.log(`Matrix updated with ${newMatrixData.rows.length} rows and ${newMatrixData.columns.length} columns`);
      setMatrixData(newMatrixData);

      // Deep linking & Selection preservation logic
      const qtyParam = searchParams.get("qty");
      const variantParam = searchParams.get("variant");

      if (qtyParam && variantParam) {
        const qty = parseInt(qtyParam);
        const row = newMatrixData.rows.find(r => r.toLowerCase().includes(variantParam.toLowerCase()));

        if (row && newMatrixData.columns.includes(qty)) {
          const price = newMatrixData.cells[row]?.[qty] || 0;
          setSelectedCell({ row, column: qty });
          setProductPrice(price);
        }
      } else if (selectedCell) {
        const { row: previousRow, column: selectedQty } = selectedCell;
        if (newMatrixData.columns.includes(selectedQty)) {
          const targetRow = newMatrixData.rows.includes(previousRow) ? previousRow : newMatrixData.rows[0];
          const newPrice = newMatrixData.cells[targetRow]?.[selectedQty] || 0;
          setSelectedCell({ row: targetRow, column: selectedQty });
          setProductPrice(newPrice);
        } else {
          setSelectedCell(null);
          setProductPrice(0);
        }
      } else {
        // Default to 500
        if (newMatrixData.rows.length > 0) {
          const defaultRow = newMatrixData.rows[0];
          const defaultQty = newMatrixData.columns.includes(500) ? 500 : (newMatrixData.columns[0] || 0);
          if (defaultQty > 0) {
            const price = newMatrixData.cells[defaultRow]?.[defaultQty] || 0;
            setSelectedCell({ row: defaultRow, column: defaultQty });
            setProductPrice(price);
          }
        }
      }
    };

    loadMatrixData();
  }, [product, selectedFormat, selectedExtraOption, searchParams, dbProductId, selectedVariantName, isGenericPricing, pricingStructure, mpaConfig, valueNameById, isStorformat, selectedCell]);

  const computeOptionExtras = useCallback((selections: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>, quantity: number, area: number) => {
    return Object.values(selections).reduce((sum, sel) => {
      if (sel.priceMode === "per_quantity") {
        return sum + sel.extraPrice * quantity;
      }
      if (sel.priceMode === "per_area") {
        return sum + sel.extraPrice * area * quantity;
      }
      return sum + sel.extraPrice;
    }, 0);
  }, []);

  const handleCellClick = async (_row: string, column: number, basePrice: number, displayPrice: number) => {
    setSelectedCell({ row: _row, column });
    // For all m²-based products, trust the matrix value (already includes any volume-based discount)
    setProductPrice(basePrice);
    const totalExtra = computeOptionExtras(optionSelections, column, customArea || 1);
    setOptionExtraPrice(totalExtra);
  };

  const handleAreaChange = useCallback(async (_area: number, width?: number, height?: number) => {
    // Keep matrix-selected price; do not reapply calculations in the side panel
    setCustomArea(_area);
    if (width !== undefined) setCustomWidth(width);
    if (height !== undefined) setCustomHeight(height);
  }, []);

  const handleShippingChange = (type: string | null, cost: number) => {
    setShippingCost(cost);
  };

  const handleOptionSelectionChange = useCallback((selections: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>) => {
    setOptionSelections(selections);
    const qty = isStorformat ? (storformatSelection?.quantity || 0) : (selectedCell?.column ?? 1);
    const area = isStorformat ? (storformatSelection?.areaM2 || 1) : (customArea || 1);
    const totalExtra = computeOptionExtras(selections, qty, area);
    setOptionExtraPrice(totalExtra);
  }, [selectedCell, computeOptionExtras, customArea, isStorformat, storformatSelection]);

  const handleSizeDistributionChange = useCallback((fieldKey: string, rawValue: string) => {
    const parsed = Number(rawValue);
    const nextValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    setSizeDistributionValues((prev) => ({
      ...prev,
      [fieldKey]: nextValue,
    }));
  }, []);

  const sizeDistributionOptionSelections = useMemo(() => {
    const selections: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }> = {};
    sizeDistributionEntries.forEach((entry) => {
      const optionId = `size-dist-${entry.key}`;
      selections[optionId] = {
        optionId,
        name: `${entry.label}: ${entry.value}`,
        extraPrice: 0,
        priceMode: "fixed",
      };
    });
    return selections;
  }, [sizeDistributionEntries]);

  const combinedOptionSelections = useMemo(
    () => ({ ...optionSelections, ...sizeDistributionOptionSelections }),
    [optionSelections, sizeDistributionOptionSelections]
  );

  useEffect(() => {
    const qty = isStorformat ? (storformatSelection?.quantity || 0) : (selectedCell?.column ?? 1);
    const area = isStorformat ? (storformatSelection?.areaM2 || 1) : (customArea || 1);
    const totalExtra = computeOptionExtras(optionSelections, qty, area);
    setOptionExtraPrice(totalExtra);
  }, [selectedCell, optionSelections, computeOptionExtras, customArea, isStorformat, storformatSelection]);

  // Recalculate base price when area or selection changes for area-based products
  useEffect(() => {
    if (!selectedCell) return;
    if (isStorformat) return;
    // Skip for MPA products - MachineConfigurator handles pricing
    if (mpaConfig) return;
    if (pricingStructure?.mode === 'matrix_layout_v1') return;

    const isAreaBased = product?.id === "bannere" || product?.id === "skilte" || product?.id === "folie";
    const qty = selectedCell.column;
    let base = matrixData.cells[selectedCell.row]?.[qty] || 0;

    if (isAreaBased && basePricePerSqm[selectedCell.row]) {
      base = Math.round((customArea || 1) * qty * basePricePerSqm[selectedCell.row]);
    }

    setProductPrice(base);
    const extra = computeOptionExtras(optionSelections, qty, customArea || 1);
    setOptionExtraPrice(extra);
  }, [selectedCell, customArea, basePricePerSqm, matrixData, product, computeOptionExtras, optionSelections, mpaConfig, isStorformat, pricingStructure]);

  // Memoized handler for MatrixLayoutV1 to avoid conditional hook errors
  const handleMatrixCellClick = useCallback((row: string, column: number, price: number) => {
    setSelectedCell({ row, column });
    setProductPrice(price);
  }, []);

  const podSelectedQuantity = useMemo(() => {
    if (!podShippingEnabled) return 0;
    return selectedCell?.column || 0;
  }, [podShippingEnabled, selectedCell]);

  // Stable selection handler prevents render loops that can break navigation
  const handleMatrixSelectionChange = useCallback((
    selections: Record<string, string | null>,
    formatId?: string,
    materialId?: string,
    meta?: { variantKey?: string; verticalValueId?: string },
  ) => {
    setMatrixSelectedSectionValues((prev) => {
      const prevEntries = Object.entries(prev);
      const nextEntries = Object.entries(selections || {});
      if (
        prevEntries.length === nextEntries.length
        && prevEntries.every(([key, value]) => selections[key] === value)
      ) {
        return prev;
      }
      return selections;
    });
    if (formatId) {
      setSelectedFormat(prev => (prev === formatId ? prev : formatId));
    }
    setMatrixPricingMeta((prev) => {
      const next = {
        formatId,
        materialId,
        variantKey: meta?.variantKey,
        verticalValueId: meta?.verticalValueId,
      };
      return (
        prev.formatId === next.formatId
        && prev.materialId === next.materialId
        && prev.variantKey === next.variantKey
        && prev.verticalValueId === next.verticalValueId
      ) ? prev : next;
    });
    if (meta?.variantKey || meta?.verticalValueId) {
      const nextVariantKey = meta?.variantKey;
      const nextVerticalValueId = meta?.verticalValueId;
      setPodSelectionMeta(prev => (
        prev?.variantKey === nextVariantKey && prev?.verticalValueId === nextVerticalValueId
          ? prev
          : { variantKey: nextVariantKey, verticalValueId: nextVerticalValueId }
      ));
    }
  }, []);

  const pricingQuote = useMemo<SiteCheckoutState["pricingQuote"]>(() => {
    if (!dbProductId) return null;
    const quantity = isStorformat ? (storformatSelection?.quantity || 0) : (selectedCell?.column || 0);
    if (!quantity || quantity <= 0) return null;
    const selectedValues = Object.values(matrixSelectedSectionValues || {})
      .map((value) => String(value || ""))
      .filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

    return {
      productId: dbProductId,
      productSlug: slug || null,
      quantity,
      formatId: matrixPricingMeta.formatId || selectedFormat || null,
      materialId: matrixPricingMeta.materialId || null,
      verticalValueId: matrixPricingMeta.verticalValueId || null,
      variantKey: matrixPricingMeta.variantKey || selectedCell?.row || null,
      variantValueIds: selectedValues,
      variantDisplayLabels: matrixSelectionSummary,
      selectedSectionValues: matrixSelectedSectionValues,
      optionIds: Object.values(optionSelections)
        .map((option) => option.optionId)
        .filter((optionId) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(optionId || ""))),
      shippingSelected: null,
      areaM2: isStorformat ? (storformatSelection?.areaM2 || null) : (customArea || null),
    };
  }, [
    customArea,
    dbProductId,
    isStorformat,
    matrixPricingMeta,
    matrixSelectedSectionValues,
    matrixSelectionSummary,
    optionSelections,
    selectedCell?.column,
    selectedFormat,
    slug,
    storformatSelection?.areaM2,
    storformatSelection?.quantity,
  ]);


  useEffect(() => {
    if (!podShippingEnabled) {
      setPodShippingMethods([]);
      setPodShippingError(null);
      setPodShippingLoading(false);
      return;
    }
    if (!dbProductId) return;
    if (!podSelectedQuantity || podSelectedQuantity <= 0) return;
    if (!podSelectionMeta.variantKey || !podSelectionMeta.verticalValueId) return;
    if (!shippingCountry) return;

    let active = true;

    const fetchShipping = async () => {
      setPodShippingLoading(true);
      setPodShippingError(null);

      const { data, error } = await supabase.functions.invoke("pod-shipping-possibilities", {
        body: {
          productId: dbProductId,
          quantity: podSelectedQuantity,
          variantKey: podSelectionMeta.variantKey,
          verticalValueId: podSelectionMeta.verticalValueId,
          address: { country: shippingCountry },
        },
      });

      if (!active) return;

      const payload = data as any;
      if (error || payload?.error) {
        setPodShippingError(error?.message || payload?.error || "Kunne ikke hente levering.");
        setPodShippingMethods([]);
        setPodShippingLoading(false);
        return;
      }

      const options = payload?.options || [];
      const methods = options.map((option: any) => ({
        id: option.id || `${option.carrier || "carrier"}-${option.method || "method"}-${option.deliveryDate || ""}`,
        name: option.method || "Levering",
        description: "",
        price: Number.isFinite(option.price) ? Math.round(option.price) : 0,
        delivery_date: option.deliveryDate,
        submission: option.submission,
        pickup_date: option.pickupDate,
        carrier: option.carrier,
        method: option.method,
        urgency: option.urgency,
        reliability: option.reliability,
        transit_duration: option.transitDuration,
      })) as DeliveryMethod[];

      setPodShippingMethods(methods);
      setPodShippingLoading(false);
    };

    fetchShipping();
    return () => {
      active = false;
    };
  }, [
    podShippingEnabled,
    dbProductId,
    podSelectedQuantity,
    podSelectionMeta.variantKey,
    podSelectionMeta.verticalValueId,
    shippingCountry,
  ]);

  const handleStorformatSelection = useCallback((selection: StorformatSelection | null) => {
    setStorformatSelection(selection);
    setProductPrice(selection?.totalPrice || 0);
    if (selection?.areaM2) setCustomArea(selection.areaM2);
  }, []);

  // Loading State
  // Determine current dimensions based on selection
  const selectedFormatId = useMemo(() => {
    if (selectedFormat && isUuid(selectedFormat)) return selectedFormat;
    if (selectedVariantName) {
      const candidates = selectedVariantName.split('|').filter(Boolean);
      for (const candidate of candidates) {
        if (isUuid(candidate)) {
          const meta = valueMetaById[candidate];
          if (meta?.width_mm && meta?.height_mm) return candidate;
        }
      }
      if (isUuid(selectedVariantName)) return selectedVariantName;
    }
    return "";
  }, [selectedFormat, selectedVariantName, valueMetaById, isUuid]);
  const selectedFormatLabel = useMemo(() => {
    if (selectedFormatId && valueNameById[selectedFormatId]) return valueNameById[selectedFormatId];
    return selectedFormat || selectedVariantName || "";
  }, [selectedFormat, selectedFormatId, selectedVariantName, valueNameById]);
  const availableProductTemplates = useMemo(() => {
    const fallbackTemplates = getSalgsmapperFallbackTemplates({
      productId: dbProductId || product?.id,
      productName: dbProduct?.name || product?.name,
      productSlug: dbProduct?.slug || slug,
    });
    return mergeProductTemplates(dbProduct?.template_files, fallbackTemplates);
  }, [dbProduct?.name, dbProduct?.slug, dbProduct?.template_files, dbProductId, product?.id, product?.name, slug]);
  const designerTemplateLaunch = useMemo(() => {
    return resolveSelectedDesignerTemplateLaunch({
      templates: availableProductTemplates,
      selectedFormat,
      selectedFormatLabel,
    });
  }, [availableProductTemplates, selectedFormat, selectedFormatLabel]);
  const productFlow = useMemo(() => resolveStorefrontProductFlow({
    name: dbProduct?.name || product?.name,
    category: dbProduct?.category || (product as any)?.category || null,
    pricing_type: dbProduct?.pricing_type || null,
    technical_specs: dbProduct?.technical_specs || null,
  }), [dbProduct?.category, dbProduct?.name, dbProduct?.pricing_type, dbProduct?.technical_specs, product]);
  const currentDimensions = useMemo(() => {
    const techSpecs = dbProduct?.technical_specs;
    if (selectedFormatId) {
      const meta = valueMetaById[selectedFormatId];
      if (meta?.width_mm && meta?.height_mm) {
        return {
          width: meta.width_mm,
          height: meta.height_mm,
          bleed: typeof meta.bleed_mm === "number" ? meta.bleed_mm : (techSpecs?.bleed_mm || 3)
        };
      }
    }

    // 1. Try to get dimensions from the selected variant name (A4, A5, etc.)
    const fallbackLabel = selectedFormatId ? valueNameById[selectedFormatId] : "";
    const variantDims = getDimensionsFromVariant(
      fallbackLabel || selectedFormat || selectedVariantName || ""
    );
    if (variantDims) return { ...variantDims, bleed: parseFloat(techSpecs?.bleed_mm) || 3 };

    // 2. Fall back to product-wide technical specs
    if (techSpecs) {
      return {
        width: techSpecs.width_mm || 210,
        height: techSpecs.height_mm || 297,
        bleed: techSpecs.bleed_mm || 3
      };
    }

    // 3. Ultimate default
    return { width: 210, height: 297, bleed: 3 };
  }, [selectedFormatId, selectedFormat, selectedVariantName, dbProduct?.technical_specs, valueMetaById, valueNameById]);
  const designDimensions = useMemo(() => {
    const isAreaBased = product?.id === "bannere" || product?.id === "skilte" || product?.id === "folie";
    if (isStorformat && storformatSelection) {
      return {
        width: storformatSelection.widthCm * 10,
        height: storformatSelection.heightCm * 10,
        bleed: currentDimensions.bleed
      };
    }
    if (isAreaBased) {
      return {
        width: customWidth * 10,
        height: customHeight * 10,
        bleed: currentDimensions.bleed
      };
    }
    return currentDimensions;
  }, [product?.id, isStorformat, storformatSelection, customWidth, customHeight, currentDimensions]);
  const designSafeAreaMm = useMemo(() => {
    if (selectedFormatId) {
      const meta = valueMetaById[selectedFormatId];
      if (typeof meta?.safe_area_mm === "number") return meta.safe_area_mm;
    }
    if (typeof dbProduct?.technical_specs?.safe_area_mm === "number") {
      return dbProduct.technical_specs.safe_area_mm;
    }
    return undefined;
  }, [selectedFormatId, valueMetaById, dbProduct?.technical_specs]);
  const linkedTemplateId = useMemo(() => {
    if (pricingStructure?.mode === "matrix_layout_v1") {
      return resolveMatrixLinkedTemplateId(pricingStructure, matrixSelectedSectionValues);
    }
    return storformatSelection?.linkedTemplateId || null;
  }, [matrixSelectedSectionValues, pricingStructure, storformatSelection]);
  const currentQuantity = useMemo(() => {
    if (isStorformat) return storformatSelection?.quantity || 0;
    return selectedCell?.column || 0;
  }, [isStorformat, selectedCell?.column, storformatSelection?.quantity]);
  const canvaReturnUrl = useMemo(() => {
    if (typeof window === "undefined") return null;

    const url = new URL("/canva-return", window.location.origin);
    const currentProductPath = `${window.location.pathname}${window.location.search}`;
    const computedTotalPrice = Math.round(
      Math.max(0, Number(productPrice || 0) + Number(optionExtraPrice || 0) + Number(shippingCost || 0)),
    );

    url.searchParams.set("backTo", currentProductPath);
    if (window.location.search) {
      url.searchParams.set("tenantQuery", window.location.search);
    }
    if (dbProduct?.id) {
      url.searchParams.set("productId", dbProduct.id);
    }
    if (slug) {
      url.searchParams.set("productSlug", slug);
    }
    if (dbProduct?.name || product?.name) {
      url.searchParams.set("productName", dbProduct?.name || product?.name || "");
    }
    if (currentQuantity > 0) {
      url.searchParams.set("quantity", String(currentQuantity));
    }
    if (selectedVariantName) {
      url.searchParams.set("selectedVariant", selectedVariantName);
    }
    if (selectedFormat) {
      url.searchParams.set("selectedFormat", selectedFormat);
    }
    if (typeof designDimensions.width === "number" && designDimensions.width > 0) {
      url.searchParams.set("widthMm", String(designDimensions.width));
    }
    if (typeof designDimensions.height === "number" && designDimensions.height > 0) {
      url.searchParams.set("heightMm", String(designDimensions.height));
    }
    if (typeof designDimensions.bleed === "number" && designDimensions.bleed >= 0) {
      url.searchParams.set("bleedMm", String(designDimensions.bleed));
    }
    if (typeof designSafeAreaMm === "number" && designSafeAreaMm >= 0) {
      url.searchParams.set("safeMm", String(designSafeAreaMm));
    }
    if (Number.isFinite(Number(productPrice)) && Number(productPrice) > 0) {
      url.searchParams.set("productPrice", String(Math.round(Number(productPrice))));
    }
    if (Number.isFinite(Number(optionExtraPrice)) && Number(optionExtraPrice) > 0) {
      url.searchParams.set("extraPrice", String(Math.round(Number(optionExtraPrice))));
    }
    if (Number.isFinite(Number(shippingCost)) && Number(shippingCost) > 0) {
      url.searchParams.set("shippingCost", String(Math.round(Number(shippingCost))));
    }
    if (computedTotalPrice > 0) {
      url.searchParams.set("totalPrice", String(computedTotalPrice));
    }

    return url.toString();
  }, [
    currentQuantity,
    dbProduct?.id,
    dbProduct?.name,
    designDimensions.bleed,
    designDimensions.height,
    designDimensions.width,
    designSafeAreaMm,
    optionExtraPrice,
    product?.name,
    productPrice,
    selectedFormat,
    selectedVariantName,
    shippingCost,
    slug,
  ]);
  const canvaOffer = useMemo(() => {
    const tenantCanva = (shopSettings.data as any)?.canva || null;
    const productCanva = (dbProduct?.technical_specs as any)?.canva || null;

    return resolveCanvaOffer(tenantCanva, productCanva, {
      productId: dbProduct?.id || null,
      productSlug: slug || null,
      productName: dbProduct?.name || product?.name || null,
      widthMm: designDimensions.width ?? null,
      heightMm: designDimensions.height ?? null,
      bleedMm: designDimensions.bleed ?? null,
      safeAreaMm: designSafeAreaMm ?? null,
      selectedFormat: selectedFormat || null,
      returnUrl: canvaReturnUrl,
    });
  }, [
    canvaReturnUrl,
    dbProduct?.id,
    dbProduct?.name,
    dbProduct?.technical_specs,
    designDimensions.bleed,
    designDimensions.height,
    designDimensions.width,
    designSafeAreaMm,
    product?.name,
    selectedFormat,
    shopSettings.data,
    slug,
  ]);
  const renderInStorefrontFrame = (content: any, mainClassName: string, topSlot?: any) => (
    <StorefrontThemeFrame
      branding={branding}
      tenantName={tenantName}
      topSlot={topSlot}
    >
      <main
        className={`${mainClassName} storefront-order-flow storefront-product-flow`}
        data-storefront-order-flow="product"
      >
        {content}
      </main>
    </StorefrontThemeFrame>
  );
  if (loading) {
    return renderInStorefrontFrame(
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>,
      "flex-1 container mx-auto px-4 py-16",
    );
  }

  // Not Found State
  if (!product) {
    return renderInStorefrontFrame(
      <h1 className="text-3xl font-heading font-bold text-center">Produkt ikke fundet</h1>,
      "flex-1 container mx-auto px-4 py-16",
    );
  }

  // Main Render
  const sizeDistributionBlock = sizeDistributionConfig ? (
    <div className="storefront-order-surface rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{sizeDistributionConfig.title}</p>
        <p className="text-xs text-muted-foreground">
          Ikke prispåvirkende. Brug felterne til at fordele størrelser på ordren.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sizeDistributionFields.map((field) => (
          <label key={field.key} className="space-y-1">
            <span className="text-xs text-muted-foreground">{field.label}</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={sizeDistributionValues[field.key] ?? 0}
              onChange={(event) => handleSizeDistributionChange(field.key, event.target.value)}
              className="h-9"
            />
          </label>
        ))}
      </div>
      <div className={`text-xs ${sizeDistributionMismatch ? "text-destructive" : "text-muted-foreground"}`}>
        Sum: {sizeDistributionTotal}
        {sizeDistributionSelectionQuantity > 0 ? ` / ${sizeDistributionSelectionQuantity}` : ""} stk
        {sizeDistributionMismatch ? " (matcher ikke valgt antal)" : ""}
      </div>
    </div>
  ) : null;

  const renderPricingInterface = () => {
    if (isStorformat && dbProductId) {
      const storformatDeliveryBusinessDayOffset = /fast production/i.test(
        storformatSelection?.productName || ""
      )
        ? 2
        : 0;
      const summaryParts = [
        product?.name,
        storformatSelection ? `${storformatSelection.widthCm} x ${storformatSelection.heightCm} cm` : null,
        storformatSelection?.materialName,
        storformatSelection?.finishName || null,
        storformatSelection?.productName || null,
        storformatSelection ? `${storformatSelection.quantity} stk` : null,
        sizeDistributionSummary || null,
      ].filter(Boolean);

      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8" data-storefront-order-stage="storformat">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <StorformatConfigurator
              productId={dbProductId}
              onSelectionChange={handleStorformatSelection}
            />
            {dbProductId && (
              <div>
                <DynamicProductOptions
                  productId={dbProductId}
                  onSelectionChange={handleOptionSelectionChange}
                />
              </div>
            )}
            {sizeDistributionBlock}
          </div>
          <div className="min-w-0 lg:col-span-1 lg:self-start">
            <ProductPricePanel
              productId={dbProductId}
              quantity={storformatSelection?.quantity || 0}
              productPrice={storformatSelection?.totalPrice || 0}
              extraPrice={optionExtraPrice}
              branding={shopSettings.data?.branding}
              deliveryBusinessDayOffset={storformatDeliveryBusinessDayOffset}
              orderValidationError={orderValidationError}
              onShippingChange={handleShippingChange}
              optionSelections={combinedOptionSelections}
              pricingQuote={pricingQuote}
              selectedVariant={storformatSelection?.materialName}
              productName={product?.name || ''}
              productSlug={slug || ''}
              selectedFormat={storformatSelection ? `${storformatSelection.widthCm} x ${storformatSelection.heightCm} cm` : undefined}
              linkedTemplateId={linkedTemplateId}
              orderDeliveryConfig={orderDeliveryConfig}
              designWidthMm={designDimensions.width}
              designHeightMm={designDimensions.height}
              designBleedMm={designDimensions.bleed}
              designSafeAreaMm={designSafeAreaMm}
              designerTemplateLaunch={designerTemplateLaunch}
              productFlow={productFlow}
              externalDeliveryEnabled={podShippingEnabled}
              externalDeliveryMethods={podShippingMethods}
              externalDeliveryLoading={podShippingLoading}
              externalDeliveryError={podShippingError}
              externalDeliveryConfig={orderDeliveryConfig?.delivery?.pod_settings}
              canvaOffer={canvaOffer}
              summary={summaryParts.join(' • ')}
            />
          </div>
        </div>
      );
    }

    if (pricingStructure?.mode === 'matrix_layout_v1' && dbProductId) {
      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8" data-storefront-order-stage="matrix">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <MatrixLayoutV1Renderer
              productId={dbProductId}
              pricingStructure={pricingStructure}
              onCellClick={handleMatrixCellClick}
              onSelectionSummary={setMatrixSelectionSummary}
              onSelectionChange={handleMatrixSelectionChange}
            />
            <DynamicProductOptions
              productId={dbProductId}
              onSelectionChange={handleOptionSelectionChange}
            />
            {sizeDistributionBlock}
          </div>
          <div className="min-w-0 lg:col-span-1 lg:self-start">
            <ProductPricePanel
              productId={dbProductId}
              quantity={selectedCell?.column || 0}
              productPrice={productPrice}
              extraPrice={optionExtraPrice}
              branding={shopSettings.data?.branding}
              orderValidationError={orderValidationError}
              onShippingChange={handleShippingChange}
              optionSelections={combinedOptionSelections}
              pricingQuote={pricingQuote}
              selectedVariant={selectedCell?.row}
              productName={product?.name || ''}
              productSlug={slug || ''}
              selectedFormat={selectedFormat}
              linkedTemplateId={linkedTemplateId}
              orderDeliveryConfig={orderDeliveryConfig}
              designWidthMm={designDimensions.width}
              designHeightMm={designDimensions.height}
              designBleedMm={designDimensions.bleed}
              designSafeAreaMm={designSafeAreaMm}
              designerTemplateLaunch={designerTemplateLaunch}
              productFlow={productFlow}
              externalDeliveryEnabled={podShippingEnabled}
              externalDeliveryMethods={podShippingMethods}
              externalDeliveryLoading={podShippingLoading}
              externalDeliveryError={podShippingError}
              externalDeliveryConfig={orderDeliveryConfig?.delivery?.pod_settings}
              canvaOffer={canvaOffer}
              summary={[
                product?.name,
                ...matrixSelectionSummary,
                selectedCell?.row,
                selectedCell ? `${selectedCell.column} stk` : '',
                sizeDistributionSummary || '',
              ].filter(Boolean).join(' • ')}
            />
          </div>
        </div>
      );
    }

    const isAreaBased = product.id === "bannere" || product.id === "skilte" || product.id === "folie";
    const optionsBlock = dbProductId ? (
      <div className="mb-6">
        <DynamicProductOptions
          productId={dbProductId}
          onSelectionChange={handleOptionSelectionChange}
        />
      </div>
    ) : null;

    return (
      <>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8" data-storefront-order-stage="standard">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            {/* For non-area products, keep options above */}
            {!isAreaBased && optionsBlock}

            {isGenericPricing && genericVariantNames.length > 1 && (
              <div>
                <label className="text-base font-semibold mb-3 block">Vælg produkttype</label>
                <div className="flex flex-wrap gap-2">
                  {genericVariantNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedVariantName(name)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${selectedVariantName === name
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                        }`}
                    >
                      {formatVariantLabel(name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {config && (
              <ProductFilters
                formats={config.formats}
                extraOptions={config.extraOptions}
                selectedFormat={selectedFormat}
                selectedExtraOption={selectedExtraOption}
                onFormatChange={setSelectedFormat}
                onExtraOptionChange={setSelectedExtraOption}
                extraOptionsLabel={config.extraOptionsLabel}
              />
            )}

            {isAreaBased && (
              <div className="storefront-order-surface">
                <CustomDimensionsCalculator onAreaChange={handleAreaChange} />
              </div>
            )}

            {/* For area-based products, show options below width/height calculator (e.g., lamination) */}
            {isAreaBased && optionsBlock}

            {sizeDistributionBlock}

            {mpaConfig ? (
              <MachineConfigurator
                productId={dbProductId || ""}
                width={0}
                height={0}
                onPriceUpdate={(data) => {
                  console.log('[ProductPrice] Received from MachineConfigurator:', data);
                  setProductPrice(data.totalPrice);
                  // Update selected cell mock to satisfy ProductPricePanel
                  setSelectedCell({ row: data.materialName || "Special", column: data.quantity });
                }}
              />
            ) : (
              <PriceMatrix
                rows={matrixData.rows}
                columns={matrixData.columns}
                cells={matrixData.cells}
                onCellClick={handleCellClick}
                selectedCell={selectedCell}
                columnUnit="stk"
                customArea={isAreaBased ? customArea : undefined}
                basePricePerSqm={isAreaBased ? basePricePerSqm : undefined}
                computeExtras={(qty, area) => computeOptionExtras(optionSelections, qty, area || 1)}
              />
            )}
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-1">
            <div>
              <ProductPricePanel
                productId={dbProductId || ""}
                quantity={selectedCell?.column || 0}
                productPrice={productPrice}
                extraPrice={optionExtraPrice}
                branding={shopSettings.data?.branding}
                orderValidationError={orderValidationError}
                onShippingChange={handleShippingChange}
                optionSelections={combinedOptionSelections}
                pricingQuote={pricingQuote}
                selectedVariant={selectedCell?.row}
                productName={product.name}
                productSlug={slug || ""}
                selectedFormat={selectedFormat}
                linkedTemplateId={linkedTemplateId}
                orderDeliveryConfig={orderDeliveryConfig}
                designWidthMm={designDimensions.width}
                designHeightMm={designDimensions.height}
                designBleedMm={designDimensions.bleed}
                designSafeAreaMm={designSafeAreaMm}
                designerTemplateLaunch={designerTemplateLaunch}
                productFlow={productFlow}
                externalDeliveryEnabled={podShippingEnabled}
                externalDeliveryMethods={podShippingMethods}
                externalDeliveryLoading={podShippingLoading}
                externalDeliveryError={podShippingError}
                externalDeliveryConfig={orderDeliveryConfig?.delivery?.pod_settings}
                canvaOffer={canvaOffer}
                summary={[
                  product.name,
                  // For area-based products, show custom dimensions instead of format
                  (product.id === "bannere" || product.id === "skilte" || product.id === "folie")
                    ? `${customWidth} x ${customHeight} cm`
                    : (selectedFormat ? config?.formats.find(f => f.id === selectedFormat)?.label : ""),
                  selectedCell ? selectedCell.row : "",
                  selectedExtraOption ? config?.extraOptions?.find(e => e.id === selectedExtraOption)?.label : "",
                  selectedCell ? `${selectedCell.column} stk` : "",
                  sizeDistributionSummary || "",
                ].filter(Boolean).join(" • ")}
              />
            </div>
          </div>
        </div>
      </>
    );
  };

  return renderInStorefrontFrame(
    <>
        {fallbackNotice && (
          <div className="mb-6 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {fallbackNotice}
          </div>
        )}
        <div className="storefront-order-hero flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 mb-8" data-branding-id="productPage.heading">
          <div className="flex-1">
            {(() => {
              const ph = (branding as any)?.productPage?.heading;
              const headingText = ph?.customText?.trim() || product.name;
              const headingFont = ph?.font || 'inherit';
              const headingSize = ph?.sizePx ? `${ph.sizePx}px` : undefined;
              const headingColor = ph?.color || undefined;
              const subtext = ph?.subtext;
              const bodyFont = (branding as any)?.fonts?.body || 'inherit';
              const bodyColor = (branding as any)?.colors?.bodyText || undefined;
              return (
                <>
                  <h1
                    className="font-bold mb-2 leading-tight"
                    style={{
                      fontFamily: headingFont !== 'inherit' ? `'${headingFont}', sans-serif` : undefined,
                      fontSize: headingSize,
                      color: headingColor,
                    }}
                  >
                    {headingText}
                  </h1>
                  {subtext?.enabled && subtext?.text?.trim() && (
                    <p
                      className="font-bold mb-2"
                      style={{
                        fontFamily: subtext.font && subtext.font !== 'inherit' ? `'${subtext.font}', sans-serif` : undefined,
                        fontSize: subtext.sizePx ? `${subtext.sizePx}px` : undefined,
                        color: subtext.color || undefined,
                      }}
                    >
                      {subtext.text}
                    </p>
                  )}
                  {product.description && (
                    <p
                      className="text-muted-foreground"
                      style={{
                        fontFamily: bodyFont !== 'inherit' ? `'${bodyFont}', sans-serif` : undefined,
                        color: bodyColor,
                      }}
                    >
                      {product.description}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
          {product && (
            <div className="storefront-order-product-image w-full h-40 flex-shrink-0 sm:w-48 sm:h-48">
              <img
                src={dbProduct?.image_url || getProductImage(product.slug)}
                alt={product.name}
                className="w-full h-full object-contain"
                style={{ filter: 'var(--product-filter)' }}
              />
            </div>
          )}
        </div>

        {renderPricingInterface()}

        <StaticProductInfo
          productId={dbProductId || product.slug || product.id}
          selectedFormat={selectedFormat}
          selectedFormatLabel={selectedFormatLabel}
        />

        {/* Debug Overlay */}
        {searchParams.get('debug') === 'true' && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded text-xs z-50 max-w-sm overflow-auto max-h-screen">
            <h3 className="font-bold border-b border-gray-600 mb-2">Debug Info</h3>
            <div>Product ID: <span className="font-mono bg-gray-700 px-1">{dbProductId}</span></div>
            <div>Slug: {slug}</div>
            <div>Pricing Mode: {pricingStructure?.mode || 'generic'}</div>
            <div>Generic Variants: {genericVariantNames.length}</div>
            <div>Matrix Rows: {matrixData.rows.length}</div>
            <div>Matrix Cols: {matrixData.columns.length}</div>
          </div>
        )}
    </>,
    "flex-1 container mx-auto px-4 py-8",
    <>
      <SEO
        title={`${product.name} | ${tenantName}`}
        description={product.description}
        forceRender
      />
      <ProductSchema
        name={product.name}
        description={product.description}
        price={productPrice || 99}
        image={dbProduct?.image_url || getProductImage(product.slug)}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Forside', url: '/' },
          { name: 'Produkter', url: '/produkter' },
          { name: product.name, url: `/produkt/${slug}` }
        ]}
      />
    </>,
  );
};

export default ProductPrice;
