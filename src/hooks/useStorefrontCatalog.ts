import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getProductDisplayPrice } from "@/utils/productPriceDisplay";
import {
  buildVisibleProductCategories,
  resolveProductCategory,
  type ProductCategoryRecord,
  type ResolvedProductCategory,
} from "@/utils/productCategories";

export interface StorefrontProduct {
  id: string;
  name: string;
  icon_text?: string | null;
  image_url: string | null;
  description: string | null;
  slug: string;
  category: string;
  categoryKey: string;
  categoryLabel: string;
  pricing_type: string;
  default_variant: string | null;
  default_quantity: number | null;
  banner_config: any;
  tooltip_product: string | null;
  tooltip_price: string | null;
  displayPrice?: string;
}

type ProductCachePayload = {
  at: number;
  tenantId: string;
  categories: ResolvedProductCategory[];
  products: StorefrontProduct[];
};

type UseStorefrontCatalogOptions = {
  enabled?: boolean;
};

const PRODUCT_CACHE_KEY_PREFIX = "storefront-catalog-cache-v1";
const PRODUCT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

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

const cacheKeyForTenant = (tenantId: string) => `${PRODUCT_CACHE_KEY_PREFIX}:tenant:${tenantId}`;
const cacheLastSuccessKey = `${PRODUCT_CACHE_KEY_PREFIX}:last-success`;

const readProductCache = (key: string): ProductCachePayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductCachePayload;
    if (!parsed?.at || !Array.isArray(parsed?.products) || !Array.isArray(parsed?.categories)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeProductCache = (key: string, payload: ProductCachePayload) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore quota/storage errors
  }
};

export function useStorefrontCatalog(options: UseStorefrontCatalogOptions = {}) {
  const { enabled = true } = options;
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [categories, setCategories] = useState<ResolvedProductCategory[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const settings = useShopSettings();

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const fetchCatalog = async () => {
      if (settings.isLoading) return;
      setLoading(true);

      const tenantId = settings.data?.id || "00000000-0000-0000-0000-000000000000";
      const tenantCacheKey = cacheKeyForTenant(tenantId);

      try {
        setErrorMessage(null);
        setWarningMessage(null);

        const [productsResponse, categoriesResponse] = await Promise.all([
          supabase
            .from("products")
            .select(`
              id, 
              name, 
              icon_text,
              description,
              slug, 
              image_url, 
              category,
              pricing_type,
              default_variant,
              default_quantity,
              banner_config,
              tooltip_product,
              tooltip_price
            `)
            .eq("is_published", true)
            .eq("tenant_id", tenantId)
            .order("name"),
          supabase
            .from("product_categories" as any)
            .select("name, slug, sort_order")
            .eq("tenant_id", tenantId)
            .order("sort_order"),
        ]);

        if (productsResponse.error) throw productsResponse.error;

        const categoryRows = ((categoriesResponse.error ? [] : categoriesResponse.data) || []) as ProductCategoryRecord[];
        const productsData = ((productsResponse.data as any[]) || []) as Array<Omit<StorefrontProduct, "displayPrice" | "categoryKey" | "categoryLabel">>;

        const productsWithPrices = await Promise.all(
          productsData.map(async (product) => {
            const resolvedCategory = resolveProductCategory(product.category, categoryRows);
            return {
              ...product,
              category: product.category || resolvedCategory.label,
              categoryKey: resolvedCategory.key,
              categoryLabel: resolvedCategory.label,
              displayPrice: await getProductDisplayPrice(product as any),
            };
          }),
        );

        const visibleCategories = buildVisibleProductCategories(
          productsWithPrices.map((product) => product.category),
          categoryRows,
        );

        setProducts(productsWithPrices);
        setCategories(visibleCategories);

        const payload: ProductCachePayload = {
          at: Date.now(),
          tenantId,
          categories: visibleCategories,
          products: productsWithPrices,
        };
        writeProductCache(tenantCacheKey, payload);
        writeProductCache(cacheLastSuccessKey, payload);
      } catch (error) {
        console.error("Error fetching storefront catalog:", error);
        if (isTransportError(error)) {
          const tenantCache = readProductCache(tenantCacheKey);
          const globalCache = readProductCache(cacheLastSuccessKey);
          const candidateCache = tenantCache || globalCache;
          const isFresh = !!candidateCache && (Date.now() - candidateCache.at) <= PRODUCT_CACHE_TTL_MS;
          if (isFresh && candidateCache) {
            setProducts(candidateCache.products);
            setCategories(candidateCache.categories);
            setWarningMessage("Viser senest gemte produkter, fordi backend-forbindelsen fejler midlertidigt.");
            setErrorMessage(null);
          } else {
            setProducts([]);
            setCategories([]);
            setWarningMessage(null);
            setErrorMessage("Kunne ikke hente produkter lige nu. Backend-forbindelsen fejler midlertidigt.");
          }
        } else {
          setProducts([]);
          setCategories([]);
          setWarningMessage(null);
          setErrorMessage("Kunne ikke hente produkter.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [enabled, settings.data?.id, settings.isLoading]);

  return {
    products,
    categories,
    loading,
    errorMessage,
    warningMessage,
  };
}
