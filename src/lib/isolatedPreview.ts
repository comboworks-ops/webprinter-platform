/** This switch is set only by the isolated preview build script. */
export const IS_ISOLATED_PREVIEW = import.meta.env?.VITE_ISOLATED_PREVIEW === 'true';
export const PREVIEW_BACKEND = 'cyurochbkxggcobnxaxq.supabase.co';
export const PREVIEW_PAYMENT_MESSAGE = 'Betaling er slået fra i denne testversion.';

export function isolatedCheckoutTestEnabled(config: {isolated: boolean; requested: boolean; backendUrl?: string; publishableKey?: string}): boolean {
  try {
    return config.isolated && config.requested
      && new URL(config.backendUrl || '').origin === `https://${PREVIEW_BACKEND}`
      && /^pk_test_[A-Za-z0-9]+$/.test(config.publishableKey || '');
  } catch { return false; }
}
export const IS_ISOLATED_CHECKOUT_TEST = isolatedCheckoutTestEnabled({
  isolated: IS_ISOLATED_PREVIEW,
  requested: import.meta.env?.VITE_ISOLATED_CHECKOUT_TEST === 'true',
  backendUrl: import.meta.env?.VITE_SUPABASE_URL,
  publishableKey: import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY,
});
export const PREVIEW_PAYMENT_DISABLED = IS_ISOLATED_PREVIEW && !IS_ISOLATED_CHECKOUT_TEST;

const READ_FUNCTIONS = new Set(['catalog-read', 'product-detail-read', 'tenant-context-read']);
const CHECKOUT_TEST_FUNCTIONS = new Set(['stripe-create-payment-intent', 'stripe-finalize-checkout', 'storefront-file-access']);

/** Fail closed before any request can reach a live backend or outbound handler. */
export function isolatedPreviewRequestBlock(input: RequestInfo | URL, enabled: boolean, checkoutTest = false): Response | null {
  if (!enabled) return null;
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, `https://${PREVIEW_BACKEND}`);
  const fn = url.pathname.match(/^\/functions\/v1\/([^/]+)\/?$/)?.[1];
  const allowedPath = !url.pathname.startsWith('/functions/')
    || !!fn && (READ_FUNCTIONS.has(fn) || checkoutTest && CHECKOUT_TEST_FUNCTIONS.has(fn));
  if (url.origin === `https://${PREVIEW_BACKEND}` && allowedPath) return null;
  return new Response(JSON.stringify({error:'isolated_preview_action_disabled',message:'Denne handling er slået fra i testversionen.'}), {
    status:403, headers:{'Content-Type':'application/json'},
  });
}
