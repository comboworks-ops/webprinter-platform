export { calculateCheckoutTax, readCheckoutTax, hasDanishCheckoutTaxPolicy, type CheckoutTax } from '../../../supabase/functions/_shared/storefrontTax.ts';
import { calculateCheckoutTax } from '../../../supabase/functions/_shared/storefrontTax.ts';

export function checkoutTaxPreview(tenantId: string | undefined, country: string | null, netAmountOre: number) {
  try {
    return { tax: calculateCheckoutTax(tenantId || '', country || '', netAmountOre), message: null };
  } catch (error) {
    return { tax: null, message: error instanceof Error && error.message === 'checkout_delivery_country_unsupported'
      ? 'Vi leverer i øjeblikket kun til Danmark. Vælg en dansk leveringsadresse.'
      : 'Butikkens moms og betalingsbeløb kunne ikke bekræftes. Kontakt butikken.' };
  }
}
