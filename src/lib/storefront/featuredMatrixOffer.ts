export type FeaturedMatrixOffer = {
  variantName: string;
  rowId: string;
  quantity: number;
};

/** Read an explicitly advertised combination without nearest-price fallback. */
export function featuredMatrixOfferPrice(
  offer: FeaturedMatrixOffer,
  activeVariant: string | undefined,
  matrix: { columns: number[]; cells: Record<string, Record<number, number>> },
  quantity: number,
): number | null {
  if (activeVariant !== offer.variantName || quantity !== offer.quantity
    || !matrix.columns.includes(quantity)) return null;
  const price = Number(matrix.cells[offer.rowId]?.[quantity]);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}
