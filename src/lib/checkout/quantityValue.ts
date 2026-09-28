export type QuantityTier = { quantity: number; price: number };

/** Presentation only: prices are supplied by the product's existing calculator. */
export function quantityValueOptions(tiers: QuantityTier[], quantity: number, total: number) {
  if (!(quantity > 0 && total > 0)) return [];
  const currentUnitPrice = total / quantity;
  return tiers.filter(tier => Number.isFinite(tier.price) && tier.price > 0
    && Number.isInteger(tier.quantity) && tier.quantity > quantity)
    .sort((a, b) => a.quantity - b.quantity)
    .filter((tier, index, all) => index === 0 || tier.quantity !== all[index - 1].quantity)
    .slice(0, 2)
    .map(tier => ({ ...tier, unitPrice: tier.price / tier.quantity,
      difference: tier.price - total,
      savingPercent: Math.max(0, Math.round((1 - tier.price / tier.quantity / currentUnitPrice) * 100)),
    }));
}
