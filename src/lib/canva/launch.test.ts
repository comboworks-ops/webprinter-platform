import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCanvaOffer } from './launch.ts';

const context = { workflowEnabled: true, tenantId: 'shop-a', productId: 'flyer', widthMm: 148, heightMm: 210, returnUrl: 'https://shop.test/canva-return' };
const product = { enabled: true, mode: 'autofill' as const, template_keys: ['florist-a5-v1'] };
test('customer launch carries product and shop to the design chooser', () => {
  const result = resolveCanvaOffer({ enabled: true }, product, context);
  assert.equal(result.enabled, true);
  assert.equal(result.launchUrl, 'https://shop.test/canva-designs?tenantId=shop-a&productId=flyer');
  assert.equal(result.buttonLabel, 'Vælg design og tilpas');
});
test('autofill is unavailable for wrong dimensions, disabled shops and unactivated servers', () => {
  for (const changes of [{ widthMm: 210 }, { heightMm: 297 }, { workflowEnabled: false }, { tenantId: null }]) {
    assert.equal(resolveCanvaOffer({ enabled: true }, product, { ...context, ...changes }).enabled, false);
  }
  assert.equal(resolveCanvaOffer({ enabled: false }, product, context).enabled, false);
  assert.equal(resolveCanvaOffer({ enabled: true }, { ...product, template_keys: [] }, context).enabled, false);
});
test('existing manual Canva links remain available without the new feature flag', () => {
  assert.equal(resolveCanvaOffer({ enabled: true }, { enabled: true, template_url: 'https://www.canva.com/example' }, { workflowEnabled: false }).launchUrl, 'https://www.canva.com/example');
});
