import test from 'node:test';
import assert from 'node:assert/strict';
import { productArtworkDimensions } from './productArtworkDefaults.ts';
import { getDimensionsFromVariant } from '../../utils/formatStandards.ts';

test('supplier landscape format names retain their physical orientation', () => {
  assert.deepEqual(getDimensionsFromVariant('size:a3_landscape'), { width: 420, height: 297 });
  assert.deepEqual(getDimensionsFromVariant('A4 vandret'), { width: 297, height: 210 });
  assert.deepEqual(getDimensionsFromVariant('A3 portrait'), { width: 297, height: 420 });
});
test('bordservietter defaults to landscape while preserving bleed and explicit portrait choices', () => {
  const product = { slug: 'bordservietter' }, portrait = { width: 297, height: 420, bleed: 3 };
  assert.deepEqual(productArtworkDimensions(product, portrait), { width: 420, height: 297, bleed: 3 });
  assert.deepEqual(productArtworkDimensions(product, portrait, ['Lodret']), portrait);
  assert.deepEqual(productArtworkDimensions({ name: 'Bordservietter kopi' }, { width: 300, height: 300 }), { width: 300, height: 300 });
  assert.strictEqual(productArtworkDimensions({ slug: 'flyers' }, portrait), portrait);
});
