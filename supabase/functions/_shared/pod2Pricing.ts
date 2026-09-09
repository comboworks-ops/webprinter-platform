export interface Pod2PriceSnapshotInput {
  quantities?: readonly unknown[] | null;
  supplierCosts?: readonly unknown[] | null;
  webprinterPrices?: readonly unknown[] | null;
  orderedQuantity: number;
}

export interface Pod2PriceSnapshot {
  matchedQuantity: number;
  supplierCost: number;
  webprinterPrice: number;
}

const positiveFinite = (value: unknown): number | null => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

/**
 * Resolves the master price pair for a POD order.
 *
 * Supplier cost remains private to Webprinter. The Webprinter price is the
 * amount the tenant owes before applying its own customer-facing markup.
 */
export function resolvePod2PriceSnapshot(
  input: Pod2PriceSnapshotInput,
): Pod2PriceSnapshot | null {
  const orderedQuantity = Number(input.orderedQuantity);
  const quantities = input.quantities;
  const supplierCosts = input.supplierCosts;
  const webprinterPrices = input.webprinterPrices;

  if (!Number.isInteger(orderedQuantity) || orderedQuantity <= 0) return null;
  if (!Array.isArray(quantities) || quantities.length === 0) return null;
  if (
    !Array.isArray(supplierCosts) || supplierCosts.length !== quantities.length
  ) {
    return null;
  }
  if (
    !Array.isArray(webprinterPrices) ||
    webprinterPrices.length !== quantities.length
  ) {
    return null;
  }

  const tiers = quantities.flatMap((quantity, index) => {
    const matchedQuantity = positiveFinite(quantity);
    const supplierCost = positiveFinite(supplierCosts[index]);
    const webprinterPrice = positiveFinite(webprinterPrices[index]);
    if (
      matchedQuantity === null ||
      !Number.isInteger(matchedQuantity) ||
      supplierCost === null ||
      webprinterPrice === null ||
      webprinterPrice < supplierCost
    ) {
      return [];
    }

    return [{ matchedQuantity, supplierCost, webprinterPrice }];
  }).sort((left, right) => left.matchedQuantity - right.matchedQuantity);

  if (tiers.length !== quantities.length) return null;

  const matched =
    tiers.filter((tier) => tier.matchedQuantity <= orderedQuantity).at(-1) ??
      tiers[0];
  return matched ?? null;
}
