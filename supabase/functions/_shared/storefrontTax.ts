import { CheckoutError } from './storefrontCheckout.ts';

// Explicit initial selling scope, not inferred from a domain, billing address,
// browser location or Stripe destination. Future sellers need a reviewed policy.
const DANISH_LAUNCH_SHOPS = new Set([
  '00000000-0000-0000-0000-000000000000',
  '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba',
  '7cb851f5-c792-40b1-a79a-1f7c7b5f668c',
]);
export type CheckoutTax = {
  policy: 'dk-domestic-v1'; sellerCountry: 'DK'; deliveryCountry: 'DK'; rateBps: 2500;
  netAmountOre: number; vatAmountOre: number; grossAmountOre: number;
};
export const hasDanishCheckoutTaxPolicy = (tenantId: string | null | undefined) => DANISH_LAUNCH_SHOPS.has(tenantId || '');

export function assertCheckoutTaxDestination(tenantId: string, deliveryCountry: string): void {
  if (!hasDanishCheckoutTaxPolicy(tenantId)) throw new CheckoutError('checkout_tax_policy_unavailable', 409);
  if (deliveryCountry.trim().toUpperCase() !== 'DK') throw new CheckoutError('checkout_delivery_country_unsupported', 409);
}

/** Net catalogue/options/delivery prices become one payable, integer-øre total. */
export function calculateCheckoutTax(tenantId: string, deliveryCountry: string, netAmountOre: number): CheckoutTax {
  assertCheckoutTaxDestination(tenantId, deliveryCountry);
  if (!Number.isSafeInteger(netAmountOre) || netAmountOre < 0) throw new CheckoutError('checkout_invalid_amount', 409);
  const vatAmountOre = Math.round(netAmountOre / 4);
  const grossAmountOre = netAmountOre + vatAmountOre;
  if (!Number.isSafeInteger(grossAmountOre)) throw new CheckoutError('checkout_invalid_amount', 409);
  return { policy: 'dk-domestic-v1', sellerCountry: 'DK', deliveryCountry: 'DK', rateBps: 2500,
    netAmountOre, vatAmountOre, grossAmountOre };
}

/** Missing historical data is unknown, never an invented zero-tax exemption. */
export function readCheckoutTax(value: unknown, grossAmountOre: number): CheckoutTax | null {
  if (value == null) return null;
  const tax = value as CheckoutTax;
  if (tax.policy !== 'dk-domestic-v1' || tax.sellerCountry !== 'DK' || tax.deliveryCountry !== 'DK'
    || tax.rateBps !== 2500 || !Number.isSafeInteger(tax.netAmountOre) || tax.netAmountOre < 0
    || !Number.isSafeInteger(tax.vatAmountOre) || tax.vatAmountOre !== Math.round(tax.netAmountOre / 4)
    || !Number.isSafeInteger(tax.grossAmountOre) || tax.grossAmountOre !== tax.netAmountOre + tax.vatAmountOre
    || tax.grossAmountOre !== grossAmountOre) throw new CheckoutError('checkout_tax_snapshot_invalid', 409);
  return tax;
}

export function checkoutTaxEmailFields(value: unknown, totalDkk: number): string[][] {
  const tax = readCheckoutTax(value, Math.round(totalDkk * 100));
  const money = (ore: number) => `${(ore / 100).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DKK`;
  return tax ? [['Beløb ekskl. moms', money(tax.netAmountOre)], ['Moms (25 %)', money(tax.vatAmountOre)]] : [];
}
