import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getProductDisplayPrice } from "@/utils/productPriceDisplay";
import { readTransientString, writeTransientString } from "@/lib/storage/transientStorage";
import { fetchCatalogRead } from "@/lib/api/catalogRead";
import {
  buildVisibleProductCategories,
  resolveProductCategory,
  type ProductCategoryRecord,
  type ProductOverviewRecord,
  type ResolvedProductCategory,
} from "@/utils/productCategories";
import {
  isSiteExclusiveProduct,
  isProductAssignedToSite,
} from "@/lib/sites/productSiteFrontends";

export interface StorefrontProduct {
  id: string;
  name: string;
  icon_text?: string | null;
  image_url: string | null;
  description: string | null;
  slug: string;
  category: string;
  technical_specs?: any;
  categoryKey: string;
  categoryLabel: string;
  pricing_type: string;
  default_variant: string | null;
  default_quantity: number | null;
  banner_config: any;
  tooltip_product: string | null;
  tooltip_price: string | null;
  displayPrice?: string;
  categoryId?: string | null;
  categoryOverviewId?: string | null;
  categoryParentId?: string | null;
  categoryNavigationMode?: "all_in_one" | "submenu" | null;
}

type ProductCachePayload = {
  at: number;
  tenantId: string;
  categories: ResolvedProductCategory[];
  categoryRecords: ProductCategoryRecord[];
  overviews: ProductOverviewRecord[];
  products: StorefrontProduct[];
};

type UseStorefrontCatalogOptions = {
  enabled?: boolean;
};

const PRODUCT_CACHE_KEY_PREFIX = "storefront-catalog-cache-v5";
const PRODUCT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const isMissingProductOverviewsTable = (error: unknown) => {
  const anyError = error as any;
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  return anyError?.code === "42P01" || anyError?.code === "PGRST205" || message.includes("product_overviews") || details.includes("product_overviews");
};

const isMissingCategoryHierarchyColumns = (error: unknown) => {
  const anyError = error as any;
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  return (
    anyError?.code === "42703"
    || anyError?.code === "PGRST204"
    || message.includes("parent_category_id")
    || message.includes("navigation_mode")
    || details.includes("parent_category_id")
    || details.includes("navigation_mode")
  );
};

const isMissingFrontendCategoryColumns = (error: unknown) => {
  const anyError = error as any;
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  return (
    anyError?.code === "42703"
    || anyError?.code === "PGRST204"
    || message.includes("frontend_product_id")
    || details.includes("frontend_product_id")
  );
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

const cacheKeyForTenant = (tenantId: string) => `${PRODUCT_CACHE_KEY_PREFIX}:tenant:${tenantId}`;

const readProductCache = (key: string): ProductCachePayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = readTransientString(key);
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
    writeTransientString(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
};

const getFastDisplayPrice = (product: Partial<StorefrontProduct>): string | undefined => {
  const existing = typeof product.displayPrice === "string" ? product.displayPrice.trim() : "";
  if (existing) return existing;

  const priceFrom = (product.banner_config as any)?.price_from;
  if (priceFrom !== undefined && priceFrom !== null && String(priceFrom).trim() !== "") {
    return `${priceFrom} kr`;
  }

  return undefined;
};

const withFastDisplayPrices = (
  products: Array<Omit<StorefrontProduct, "displayPrice"> | StorefrontProduct>,
): StorefrontProduct[] => {
  return products.map((product) => ({
    ...(product as StorefrontProduct),
    displayPrice: getFastDisplayPrice(product as StorefrontProduct),
  }));
};

const filterProductsForActiveSite = (
  products: StorefrontProduct[],
  activeSiteId?: string | null,
): StorefrontProduct[] => {
  if (activeSiteId) {
    return products.filter((product) => isProductAssignedToSite(product.technical_specs, activeSiteId));
  }

  return products.filter((product) => !isSiteExclusiveProduct(product.technical_specs));
};

const resolveDisplayPrices = async (products: StorefrontProduct[]): Promise<StorefrontProduct[]> => {
  return Promise.all(
    products.map(async (product) => ({
      ...product,
      displayPrice: await getProductDisplayPrice(product as any),
    })),
  );
};

export function useStorefrontCatalog(options: UseStorefrontCatalogOptions = {}) {
  const { enabled = true } = options;
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [categories, setCategories] = useState<ResolvedProductCategory[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<ProductCategoryRecord[]>([]);
  const [overviews, setOverviews] = useState<ProductOverviewRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const settings = useShopSettings();

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const applyCatalog = (payload: ProductCachePayload, options?: { warningMessage?: string | null }) => {
      if (cancelled) return;
      setProducts(payload.products);
      setCategories(payload.categories);
      setCategoryRecords(payload.categoryRecords || []);
      setOverviews(payload.overviews || []);
      setErrorMessage(null);
      setWarningMessage(options?.warningMessage ?? null);
      setLoading(false);
    };

    const fetchCatalog = async () => {
      if (settings.isLoading) return;

      const tenantId = settings.data?.id || "00000000-0000-0000-0000-000000000000";
      const activeSiteId = typeof settings.data?.site_frontends?.activeSiteId === "string"
        ? settings.data.site_frontends.activeSiteId
        : null;
      const tenantCacheKey = `${cacheKeyForTenant(tenantId)}:site:${activeSiteId || "default"}`;
      const cachedCatalog = readProductCache(tenantCacheKey);
      const hasCachedCatalog = Boolean(cachedCatalog?.products?.length);

      if (hasCachedCatalog && cachedCatalog) {
        applyCatalog(cachedCatalog);
      } else {
        setLoading(true);
      }

      try {
        setErrorMessage(null);
        setWarningMessage(null);

        try {
          const apiResult = await fetchCatalogRead({
            tenantId,
            hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
            pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
          });

          if (apiResult?.success && Array.isArray(apiResult.products) && Array.isArray(apiResult.categories) && Array.isArray(apiResult.overviews)) {
            const fastProducts = filterProductsForActiveSite(
              withFastDisplayPrices(apiResult.products as Array<Omit<StorefrontProduct, "displayPrice">>),
              activeSiteId,
            );

            const visibleCategories = buildVisibleProductCategories(
              fastProducts.map((product) => product.category),
              (apiResult.categories as ProductCategoryRecord[]) || [],
            );

            const fastPayload: ProductCachePayload = {
              at: Date.now(),
              tenantId,
              categories: visibleCategories,
              categoryRecords: (apiResult.categories as ProductCategoryRecord[]) || [],
              overviews: (apiResult.overviews as ProductOverviewRecord[]) || [],
              products: fastProducts,
            };
            applyCatalog(fastPayload);

            const productsWithPrices = await resolveDisplayPrices(fastProducts);
            if (cancelled) return;

            const payload: ProductCachePayload = {
              at: Date.now(),
              tenantId,
              categories: visibleCategories,
              categoryRecords: (apiResult.categories as ProductCategoryRecord[]) || [],
              overviews: (apiResult.overviews as ProductOverviewRecord[]) || [],
              products: productsWithPrices,
            };
            applyCatalog(payload);
            writeProductCache(tenantCacheKey, payload);
            return;
          }
        } catch (apiError) {
          console.warn("[useStorefrontCatalog] catalog-read fallback to direct queries", apiError);
        }

        const [productsResponse, hierarchyCategoriesResponse, fallbackCategoriesResponse, overviewsResponse] = await Promise.all([
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
              technical_specs,
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
            .select("id, name, slug, sort_order, overview_id, parent_category_id, navigation_mode, frontend_product_id")
            .eq("tenant_id", tenantId)
            .order("sort_order"),
          supabase
            .from("product_categories" as any)
            .select("id, name, slug, sort_order, overview_id")
            .eq("tenant_id", tenantId)
            .order("sort_order"),
          supabase
            .from("product_overviews" as any)
            .select("id, name, slug, sort_order")
            .eq("tenant_id", tenantId)
            .order("sort_order"),
        ]);

        if (productsResponse.error) throw productsResponse.error;

        let categoryRows: ProductCategoryRecord[] = [];
        if (!hierarchyCategoriesResponse.error) {
          categoryRows = ((hierarchyCategoriesResponse.data as ProductCategoryRecord[]) || []).map((row) => ({
            ...row,
            navigation_mode: row.navigation_mode || "all_in_one",
          }));
        } else if (
          isMissingCategoryHierarchyColumns(hierarchyCategoriesResponse.error)
          || isMissingFrontendCategoryColumns(hierarchyCategoriesResponse.error)
        ) {
          categoryRows = ((fallbackCategoriesResponse.error ? [] : fallbackCategoriesResponse.data) || []) as ProductCategoryRecord[];
        } else {
          throw hierarchyCategoriesResponse.error;
        }

        const overviewRows = overviewsResponse.error
          ? (isMissingProductOverviewsTable(overviewsResponse.error) ? [] : (() => { throw overviewsResponse.error; })())
          : ((overviewsResponse.data as ProductOverviewRecord[]) || []);
        const productsData = ((productsResponse.data as any[]) || []) as Array<Omit<StorefrontProduct, "displayPrice" | "categoryKey" | "categoryLabel">>;

        const fastProducts = filterProductsForActiveSite(withFastDisplayPrices(
          productsData.map((product) => {
            const resolvedCategory = resolveProductCategory(product.category, categoryRows);
            return {
              ...product,
              category: product.category || resolvedCategory.label,
              categoryKey: resolvedCategory.key,
              categoryLabel: resolvedCategory.label,
              categoryId: resolvedCategory.id ?? null,
              categoryOverviewId: resolvedCategory.overviewId ?? null,
              categoryParentId: resolvedCategory.parentCategoryId ?? null,
              categoryNavigationMode: resolvedCategory.navigationMode ?? null,
            };
          }),
        ), activeSiteId);

        const visibleCategories = buildVisibleProductCategories(
          fastProducts.map((product) => product.category),
          categoryRows,
        );

        const fastPayload: ProductCachePayload = {
          at: Date.now(),
          tenantId,
          categories: visibleCategories,
          categoryRecords: categoryRows,
          overviews: overviewRows,
          products: fastProducts,
        };
        applyCatalog(fastPayload);

        const productsWithPrices = await resolveDisplayPrices(fastProducts);
        if (cancelled) return;

        const payload: ProductCachePayload = {
          at: Date.now(),
          tenantId,
          categories: visibleCategories,
          categoryRecords: categoryRows,
          overviews: overviewRows,
          products: productsWithPrices,
        };
        applyCatalog(payload);
        writeProductCache(tenantCacheKey, payload);
      } catch (error) {
        console.error("Error fetching storefront catalog:", error);
        if (isTransportError(error)) {
          const tenantCache = readProductCache(tenantCacheKey);
          if (tenantCache) {
            const isFresh = (Date.now() - tenantCache.at) <= PRODUCT_CACHE_TTL_MS;
            applyCatalog(tenantCache, {
              warningMessage: isFresh
                ? "Viser senest gemte produkter, fordi backend-forbindelsen fejler midlertidigt."
                : "Viser gemte produkter, mens backend-forbindelsen fejler midlertidigt.",
            });
          } else {
            if (cancelled) return;
            setProducts([]);
            setCategories([]);
            setCategoryRecords([]);
            setOverviews([]);
            setWarningMessage(null);
            setErrorMessage("Kunne ikke hente produkter lige nu. Backend-forbindelsen fejler midlertidigt.");
          }
        } else {
          if (cancelled) return;
          setProducts([]);
          setCategories([]);
          setCategoryRecords([]);
          setOverviews([]);
          setWarningMessage(null);
          setErrorMessage("Kunne ikke hente produkter.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, [enabled, settings.data?.id, settings.data?.site_frontends?.activeSiteId, settings.isLoading]);

  return {
    products,
    categories,
    categoryRecords,
    overviews,
    loading,
    errorMessage,
    warningMessage,
  };
}
