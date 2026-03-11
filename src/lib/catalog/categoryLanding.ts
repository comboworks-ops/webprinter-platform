import {
  normalizeProductCategoryKey,
  normalizeProductOverviewKey,
  type ProductCategoryRecord,
  type ProductOverviewRecord,
} from "@/utils/productCategories";
import { appendStorefrontTenantContext } from "@/lib/storefrontTenantContext";

export type CategoryLandingConfig = {
  enabled: boolean;
  overviewId?: string | null;
  overviewSlug?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  subcategoryId?: string | null;
  subcategorySlug?: string | null;
};

type ProductWithLandingSpecs = {
  slug: string;
  technical_specs?: unknown;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readCategoryLandingConfig = (technicalSpecs: unknown): CategoryLandingConfig => {
  if (!isObjectRecord(technicalSpecs)) {
    return { enabled: false };
  }

  const raw = technicalSpecs.category_landing;
  if (!isObjectRecord(raw) || raw.enabled !== true) {
    return { enabled: false };
  }

  return {
    enabled: true,
    overviewId: typeof raw.overviewId === "string" ? raw.overviewId : null,
    overviewSlug: typeof raw.overviewSlug === "string" ? raw.overviewSlug : null,
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : null,
    categorySlug: typeof raw.categorySlug === "string" ? raw.categorySlug : null,
    subcategoryId: typeof raw.subcategoryId === "string" ? raw.subcategoryId : null,
    subcategorySlug: typeof raw.subcategorySlug === "string" ? raw.subcategorySlug : null,
  };
};

export const isCategoryLandingProduct = (product: ProductWithLandingSpecs): boolean =>
  readCategoryLandingConfig(product.technical_specs).enabled;

export const buildCategoryLandingHref = (
  config: CategoryLandingConfig,
  categories: ProductCategoryRecord[] = [],
  overviews: ProductOverviewRecord[] = [],
): string | null => {
  if (!config.enabled) return null;

  const overviewSlug = config.overviewSlug
    || overviews.find((overview) => overview.id === config.overviewId)?.slug
    || normalizeProductOverviewKey(
      overviews.find((overview) => overview.id === config.overviewId)?.name || "",
    );

  const categorySlug = config.categorySlug
    || categories.find((category) => category.id === config.categoryId)?.slug
    || normalizeProductCategoryKey(
      categories.find((category) => category.id === config.categoryId)?.name || "",
    );

  const subcategorySlug = config.subcategorySlug
    || categories.find((category) => category.id === config.subcategoryId)?.slug
    || normalizeProductCategoryKey(
      categories.find((category) => category.id === config.subcategoryId)?.name || "",
    );

  const params = new URLSearchParams();
  if (overviewSlug) params.set("overview", overviewSlug);
  if (categorySlug) params.set("category", categorySlug);
  if (subcategorySlug) params.set("subcategory", subcategorySlug);

  const query = params.toString();
  if (!query) return null;
  return appendStorefrontTenantContext(`/produkter?${query}`);
};

export const buildStorefrontProductHref = (
  product: ProductWithLandingSpecs,
  categories: ProductCategoryRecord[] = [],
  overviews: ProductOverviewRecord[] = [],
): string => {
  const categoryHref = buildCategoryLandingHref(
    readCategoryLandingConfig(product.technical_specs),
    categories,
    overviews,
  );
  return categoryHref || appendStorefrontTenantContext(`/produkt/${product.slug}`);
};

export const getStorefrontProductButtonLabel = (product: ProductWithLandingSpecs): string =>
  isCategoryLandingProduct(product) ? "Se produkter" : "Priser";
