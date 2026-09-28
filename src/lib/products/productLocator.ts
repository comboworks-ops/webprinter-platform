export type LocatorProduct = {
  id: string; name: string; slug: string; description?: string | null;
  category?: string | null; pricing_type?: string | null;
  is_published?: boolean; image_url?: string | null;
};
export type LocatorAttributeGroup = {
  product_id: string; kind: string; enabled?: boolean;
  values?: { name: string; enabled?: boolean }[];
};
export type LocatorItem = LocatorProduct & { formats: string[]; materials: string[]; searchText: string };
export type LocatorFilters = { query: string; category: string; format: string; material: string; status: string };
export const normalizeLocatorText = (value: string) => value.toLocaleLowerCase('da').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o');
export function buildLocatorItems(products: LocatorProduct[], groups: LocatorAttributeGroup[]): LocatorItem[] {
  const byProduct = new Map<string, LocatorAttributeGroup[]>();
  for (const group of groups) if (group.enabled !== false) byProduct.set(group.product_id, [...(byProduct.get(group.product_id) || []), group]);
  return products.map(product => {
    const attributes = byProduct.get(product.id) || [];
    const names = (kind?: string) => [...new Set(attributes.filter(group => !kind || group.kind === kind).flatMap(group => (group.values || []).filter(value => value.enabled !== false).map(value => value.name)))];
    return { ...product, formats: names('format'), materials: names('material'), searchText: normalizeLocatorText([product.name, product.slug, product.category, product.description, ...names()].filter(Boolean).join(' ')) };
  });
}
export function filterLocatorItems(items: LocatorItem[], filters: LocatorFilters): LocatorItem[] {
  const terms = normalizeLocatorText(filters.query.trim()).split(/\s+/).filter(Boolean);
  return items.filter(item => terms.every(term => item.searchText.includes(term))
    && (!filters.category || (item.category || 'Uden kategori') === filters.category)
    && (!filters.format || item.formats.includes(filters.format))
    && (!filters.material || item.materials.includes(filters.material))
    && (!filters.status || (filters.status === 'published' ? item.is_published : !item.is_published)));
}
export function locatorUrl(path: string, search: string, patch: Record<string, string> = {}): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) { if (value) params.set(key, value); else params.delete(key); }
  return `${path}${params.size ? `?${params}` : ''}`;
}
