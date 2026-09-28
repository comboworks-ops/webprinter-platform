import { resolvePrintCatalogView } from './printCatalogNavigation.ts';
import type { ProductCategoryRecord, ProductOverviewRecord } from '../../utils/productCategories.ts';

type PresentationProduct = { id: string; name: string; icon_text?: string | null; description?: string | null; categoryId?: string | null; categoryKey?: string; categoryLabel?: string; categoryOverviewId?: string | null };

export function filterPresentationProducts<T extends PresentationProduct>(products: T[], query: string): T[] {
  const words = query.trim().toLocaleLowerCase('da').split(/\s+/).filter(Boolean);
  return products.filter(product => {
    const text = `${product.name} ${product.icon_text || ''} ${product.categoryLabel || ''}`.toLocaleLowerCase('da');
    return words.every(word => text.includes(word));
  });
}

/** Every visible product appears once, including unclassified products and nested categories. */
export function groupPresentationProducts<T extends PresentationProduct>(products: T[], categories: ProductCategoryRecord[], overviews: ProductOverviewRecord[]) {
  const assigned = new Set<string>();
  const groups: { id: string; name: string; category?: ProductCategoryRecord; products: T[] }[] = [];
  [...categories].filter(category => !category.parent_category_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach(category => {
    const members = resolvePrintCatalogView(products, categories, overviews, new URLSearchParams({ category: category.id || category.slug })).products.filter(product => !assigned.has(product.id));
    if (!members.length) return;
    members.forEach(product => assigned.add(product.id));
    groups.push({ id: category.id || category.slug, name: category.name, category, products: members });
  });
  const remaining = products.filter(product => !assigned.has(product.id));
  if (remaining.length) groups.push({ id: '__other__', name: groups.length ? 'Flere produkter' : 'Alle produkter', products: remaining });
  return groups;
}
