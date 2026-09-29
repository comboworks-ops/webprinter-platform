import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCheckoutFormatKey, checkoutTemplateFormatLabel } from './formatLabels.ts';

const squareId = 'dc2464ba-3614-4a13-91f7-dd8c5fc9fbd4';
const hash = 'c0225e43cc2d5a052cac29867bde02bcbdf56ea5dd7913754a6af3b16725c6fc';
const template = { name: 'Square 5 mm', url: 'template.pdf', format: '21 x 21 salgsmappe med laminering', templatePdfSha256: hash, selectionConstraints: { 'format-section': squareId } };

test('a format UUID containing a13 is never interpreted as A1', () => {
  assert.equal(normalizeCheckoutFormatKey(squareId), null);
  assert.equal(normalizeCheckoutFormatKey('0a89086a-5f6c-4545-86db-5c5257f46ee5'), null);
});
test('normal format names retain their existing normalized keys', () => {
  for (const [input, expected] of [['A4 salgsmappe', 'A4'], ['DIN A5', 'A5'], ['DIN lang salgsmappe', 'M65'], ['M65', 'M65'], ['85 x 55 mm', '85x55'], ['21 x 21 cm', '21 x 21 cm']]) assert.equal(normalizeCheckoutFormatKey(input), expected);
});
test('checkout resolves the selected square format from its exact template', () => {
  assert.equal(checkoutTemplateFormatLabel(squareId, hash, [template]), template.format);
  assert.equal(checkoutTemplateFormatLabel(squareId, hash, [template, { ...template, name: 'Same format on another paper' }]), template.format);
});
test('different or absent template identities cannot rename the selected format', () => {
  assert.equal(checkoutTemplateFormatLabel(squareId, 'a'.repeat(64), [template]), null);
  assert.equal(checkoutTemplateFormatLabel(squareId, null, [template]), null);
  assert.equal(checkoutTemplateFormatLabel('bad60435-a5ab-4ce1-a188-0b13d9385f48', hash, [template]), null);
});
test('conflicting format metadata is not resolved by array order', () => {
  assert.equal(checkoutTemplateFormatLabel(squareId, hash, [template, { ...template, format: 'A1' }]), null);
});
