import { readCheckoutTax } from './tax.ts';

export function orderInvoiceAmounts(order: { total_price: number; checkout_attempt_id?: string | null; checkout_tax?: unknown }) {
  const grossOre = Math.round(Number(order.total_price) * 100);
  if (!Number.isSafeInteger(grossOre) || grossOre < 0) throw new Error('invoice_amount_invalid');
  const tax = readCheckoutTax(order.checkout_tax, grossOre);
  if (tax) return { subtotal: tax.netAmountOre / 100, taxAmount: tax.vatAmountOre / 100, taxRate: tax.rateBps / 100 };
  // Unchanged legacy/manual order convention. Checkout v2 requires evidence;
  // missing historical tax data must not fabricate an invoice tax breakdown.
  if (order.checkout_attempt_id) throw new Error('invoice_checkout_tax_missing');
  const netOre = Math.round(grossOre / 1.25);
  return { subtotal: netOre / 100, taxAmount: (grossOre - netOre) / 100, taxRate: 25 };
}
