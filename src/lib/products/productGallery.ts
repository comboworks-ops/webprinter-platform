export type GalleryCondition = { sectionId: string; valueId: string };
export type ProductGalleryImage = { id: string; url: string; alt: string; conditions: GalleryCondition[] };

/** Older URL galleries stay readable until the editor explicitly changes them. */
export function readProductGallery(content: unknown): ProductGalleryImage[] {
  if (!content || typeof content !== 'object') return [];
  const value = content as { gallery?: unknown; images?: unknown };
  if (Array.isArray(value.gallery)) return value.gallery.filter((item): item is ProductGalleryImage =>
    !!item && typeof item.id === 'string' && typeof item.url === 'string'
    && typeof item.alt === 'string' && Array.isArray(item.conditions)
    && item.conditions.every((condition: GalleryCondition) => condition && typeof condition.sectionId === 'string' && typeof condition.valueId === 'string'));
  return Array.isArray(value.images) ? value.images.filter((url): url is string => typeof url === 'string').map((url, index) => ({ id: `legacy-${index}`, url, alt: '', conditions: [] })) : [];
}

export function usableGalleryUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url);
}

/** All conditions must match. Most specific wins; editor order breaks ties. */
export function matchProductGallery(images: ProductGalleryImage[], selections: Record<string, string | null | undefined>): ProductGalleryImage | undefined {
  let best: ProductGalleryImage | undefined;
  for (const image of images) {
    if (!usableGalleryUrl(image.url) || !image.conditions.length) continue;
    if (image.conditions.every(condition => !!condition.sectionId && !!condition.valueId && selections[condition.sectionId] === condition.valueId)
      && (!best || image.conditions.length > best.conditions.length)) best = image;
  }
  return best;
}

/** Stable across object allocation and key order; quantity is deliberately absent. */
export function gallerySelectionKey(selections: Record<string, string | null | undefined>): string {
  return JSON.stringify(Object.entries(selections).filter(([, value]) => value != null && value !== '').sort(([a], [b]) => a.localeCompare(b)));
}

/** Matrix row clicks are separate from selector state. Read the chosen row for
 * presentation only, without altering pricing or checkout selection handlers. */
export function galleryMatrixSelections(selections: Record<string, string | null | undefined>, axis: {
  sectionId: string; valueIds: string[]; valueSettings?: Record<string, { displayName?: string }>;
} | undefined, row: string | undefined, names: Record<string, string>): Record<string, string | null | undefined> {
  if (!axis?.sectionId || !row) return selections;
  const matches = (axis.valueIds || []).filter(id => id === row || (axis.valueSettings?.[id]?.displayName?.trim() || names[id]) === row);
  return { ...selections, [axis.sectionId]: matches.length === 1 ? matches[0] : null };
}
