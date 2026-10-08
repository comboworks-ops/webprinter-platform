export interface HeaderSearchProduct {
  id: string;
  name: string;
  slug: string;
  icon_text?: string | null;
  category?: string | null;
  image_url?: string | null;
}
/** Search the full catalogue; discovery limits belong to presentation only. */
export function filterHeaderProducts<T extends HeaderSearchProduct>(products: T[], query: string, category = ''): T[] {
  const tokens = query.trim().toLocaleLowerCase('da').split(/\s+/).filter(Boolean);
  return products.filter(product => {
    if (category && product.category !== category) return false;
    const text = `${product.name} ${product.icon_text || ''} ${product.slug} ${product.category || ''}`.toLocaleLowerCase('da');
    return tokens.every(token => text.includes(token));
  });
}
