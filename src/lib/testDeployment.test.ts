import assert from 'node:assert/strict';
import test from 'node:test';
import { testDeploymentRequestBlock } from './testDeployment.ts';

test('test builds block financial and supplier requests before network access', async () => {
  for (const name of ['stripe-create-payment-intent', 'stripe-finalize-checkout', 'stripe-subscription-create-checkout', 'stripe-connect-create-or-get', 'pod2-tenant-approve-charge', 'pod2-order-submit', 'pod-tenant-approve-charge', 'send-order-email']) {
    const response = testDeploymentRequestBlock(new Request(`https://backend.test/functions/v1/${name}`, { method: 'POST' }), true);
    assert.equal(response?.status, 403);
    assert.equal((await response!.json()).error, 'test_deployment_action_disabled');
  }
});

test('catalog, auth and ordinary shop requests remain available', () => {
  for (const path of ['/functions/v1/product-detail-read', '/functions/v1/catalog-read', '/auth/v1/token', '/rest/v1/products']) {
    assert.equal(testDeploymentRequestBlock(new URL(`https://backend.test${path}`), true), null);
  }
});

test('normal builds retain existing request behavior', () => {
  assert.equal(testDeploymentRequestBlock('https://backend.test/functions/v1/stripe-create-payment-intent', false), null);
});
