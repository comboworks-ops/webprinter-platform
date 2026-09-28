import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrderFlowPreviewPage, getOrderFlowPreviewPath } from './orderFlowPreview.ts';

test('every order step opens its own preview without entering the transactional checkout', () => {
  for (const page of ['calculator', 'checkout', 'proof', 'designer', 'payment', 'confirmation'] as const) {
    const path = getOrderFlowPreviewPath(page, 'blokke');
    assert.equal(getOrderFlowPreviewPage(path), page);
    assert.notEqual(path, '/checkout/konfigurer');
  }
  assert.equal(getOrderFlowPreviewPath('calculator', 'blokke'), '/produkt/blokke');
  assert.equal(getOrderFlowPreviewPage('/kontakt'), null);
  assert.equal(getOrderFlowPreviewPage('/checkout?tenantId=shop'), 'checkout');
});

test('calculator preview preserves the chosen product and safely encodes its slug', () => {
  assert.equal(getOrderFlowPreviewPath('calculator', 'min blok'), '/produkt/min%20blok');
  assert.equal(getOrderFlowPreviewPath('calculator'), '/produkt');
  assert.equal(getOrderFlowPreviewPage('/produkt/blokke?format=a5'), 'calculator');
});
