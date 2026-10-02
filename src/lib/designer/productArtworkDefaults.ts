/** Presentation/artwork orientation only; preserve supplier selections and prices. */
export function productArtworkDimensions<T extends { width: number; height: number }>(
  product: { slug?: string | null; name?: string | null } | null | undefined,
  dimensions: T,
  selectedLabels: readonly string[] = [],
): T {
  if (!/bordservietter/i.test(`${product?.slug || ''} ${product?.name || ''}`)) return dimensions;
  const portrait = selectedLabels.some(label => /\b(?:lodret|stående|portrait)\b/i.test(label));
  return { ...dimensions,
    width: portrait ? Math.min(dimensions.width, dimensions.height) : Math.max(dimensions.width, dimensions.height),
    height: portrait ? Math.max(dimensions.width, dimensions.height) : Math.min(dimensions.width, dimensions.height),
  };
}
