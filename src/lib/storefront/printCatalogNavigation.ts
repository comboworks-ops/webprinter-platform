import { findProductCategoryRecord, getProductCategoryDescendantIds, normalizeProductCategoryKey, type ProductCategoryRecord, type ProductOverviewRecord } from '../../utils/productCategories.ts';

type CatalogProduct = { categoryId?: string | null; categoryKey?: string; categoryOverviewId?: string | null };

export function isPrintCatalogRoute(path: string, search = ''): boolean {
  const url = new URL(path + (path.includes('?') ? '' : search), 'http://storefront.local');
  return url.pathname === '/produkter' || (url.pathname === '/shop' && ['overview', 'category', 'subcategory'].some(key => url.searchParams.has(key)));
}

export function buildPrintCategoryHref(category: ProductCategoryRecord, overviews: ProductOverviewRecord[] = [], parent?: ProductCategoryRecord | null): string {
  const params = new URLSearchParams();
  const overview = overviews.find(item => item.id === category.overview_id);
  if (overview) params.set('overview', overview.slug);
  params.set('category', parent?.slug || category.slug);
  if (parent) params.set('subcategory', category.slug);
  return `/produkter?${params}`;
}

/** Resolve the URL against the already tenant-scoped, published catalogue. */
export function resolvePrintCatalogView<T extends CatalogProduct>(products: T[], categories: ProductCategoryRecord[], overviews: ProductOverviewRecord[], params: URLSearchParams) {
  const overviewValue = params.get('overview');
  const categoryValue = params.get('category');
  const subcategoryValue = params.get('subcategory');
  const overview = overviewValue ? overviews.find(item => item.id === overviewValue || normalizeProductCategoryKey(item.slug) === normalizeProductCategoryKey(overviewValue) || normalizeProductCategoryKey(item.name) === normalizeProductCategoryKey(overviewValue)) : undefined;
  const findCategory = (value: string | null) => categories.find(item => item.id === value) || findProductCategoryRecord(value, categories);
  const category = categoryValue ? findCategory(categoryValue) : null;
  const subcategory = subcategoryValue ? findCategory(subcategoryValue) : null;
  const branchIds = category?.id ? new Set(getProductCategoryDescendantIds(categories, category.id)) : null;
  const notFound = Boolean(
    (overviewValue && !overview) || (categoryValue && !category) || (subcategoryValue && !subcategory)
    || (overview && category?.overview_id && category.overview_id !== overview.id)
    || (subcategory && category && (!subcategory.id || !branchIds?.has(subcategory.id)))
    || (subcategoryValue && !categoryValue)
  );
  const target = subcategory || category;
  const targetIds = target?.id ? new Set(getProductCategoryDescendantIds(categories, target.id)) : null;
  const filtered = notFound ? [] : products.filter(product => {
    if (overview && product.categoryOverviewId !== overview.id) return false;
    if (!target) return true;
    if (product.categoryId && targetIds) return targetIds.has(product.categoryId);
    return normalizeProductCategoryKey(product.categoryKey) === normalizeProductCategoryKey(target.slug);
  });
  return { products: filtered, category, subcategory, overview, notFound, title: notFound ? 'Kategorien blev ikke fundet' : target?.name || overview?.name || 'Alle produkter' };
}
