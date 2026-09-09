/** A build-time switch for the explicitly requested domain-test branch. */
export const IS_TEST_DEPLOYMENT = import.meta.env?.VITE_TEST_DEPLOYMENT === 'true';

export const TEST_PAYMENT_MESSAGE = 'Betaling er slået fra i denne testversion.';

const OUTBOUND_FUNCTIONS = new Set([
  'pod2-tenant-billing-setup', 'pod2-tenant-approve-charge', 'pod2-master-forward',
  'pod2-order-submit', 'pod2-submit-to-printcom', 'pod-order-submit',
  'pod-tenant-billing-setup', 'pod-tenant-approve-charge',
  'pod-submit-to-printcom', 'pod-master-forward',
  'send-order-email', 'storefront-order-email-dispatch',
]);

/** Prevent accidental financial/supplier effects in this UI; backend authorization is unchanged. */
export function testDeploymentRequestBlock(input: RequestInfo | URL, enabled: boolean): Response | null {
  if (!enabled) return null;
  const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const match = new URL(value, 'https://test.invalid').pathname.match(/\/functions\/v1\/([^/]+)\/?$/);
  if (!match || (!match[1].startsWith('stripe-') && !OUTBOUND_FUNCTIONS.has(match[1]))) return null;
  return new Response(JSON.stringify({ error: 'test_deployment_action_disabled', message: TEST_PAYMENT_MESSAGE }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
}
