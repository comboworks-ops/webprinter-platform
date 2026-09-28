/** Shared category artwork already used by the print storefront. Uploaded
 * tenant/category images take precedence at each call site. */
export function getPrintCategoryImage(category: string): string | null {
  const key = category.toLocaleLowerCase('da').replace(/æ/g, 'ae').replace(/ø/g, 'o');
  const images: Record<string, string> = {
    tryksager: '/design-presets/category-print.webp',
    klistermaerker: '/design-presets/category-stickers.webp',
    klistermrker: '/design-presets/category-stickers.webp',
    plakater: '/design-presets/category-posters.webp',
    tekstiltryk: '/design-presets/category-textile.webp',
    tekstil: '/design-presets/category-textile.webp',
  };
  return images[key] || null;
}
