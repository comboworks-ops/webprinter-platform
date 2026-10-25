import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductOptionAppearance, optionAppearanceSettings } from './productOptionAppearance.ts';
import { legacyButtonStyle } from './sharedButtons.ts';
import type { BrandingData } from '@/hooks/useBrandingDraft';

const shared = { ...legacyButtonStyle(undefined, 'selection'), bgColor: '#123456', hoverBgColor: '#234567', selectedBgColor: '#345678', radiusPx: 0 };
const draft = (style = shared) => ({ themeSettings: { sharedButtons: { selection: style } } }) as unknown as BrandingData;
const structure = { layout_rows: [{ columns: [{ id: 's', selectorStyling: { textButtons: { backgroundColor: '#112233' } }, valueSettings: { v: { textColor: '#ABCDEF' } } }] }], cells: [{ price: 243 }] };

test('the inspector follows shared colors and subsequent draft palette changes without mutating product settings', () => {
  const before = structuredClone(structure);
  assert.equal(resolveProductOptionAppearance(draft(), structure, 'p', 's', 'v').backgroundColor, '#123456');
  assert.equal(resolveProductOptionAppearance(draft({ ...shared, bgColor: '#998877' }), structure, 'p', 's', 'v').backgroundColor, '#998877');
  assert.deepEqual(structure, before);
});
test('exact contextual overrides match the storefront and do not leak into another option', () => {
  const branding = { themeSettings: { sharedButtons: { selection: shared, overrides: { 'product-option.p.s.v': { role: 'selection', style: { ...shared, bgColor: '#654321' } } } } } } as unknown as BrandingData;
  assert.equal(resolveProductOptionAppearance(branding, structure, 'p', 's', 'v').backgroundColor, '#654321');
  assert.equal(resolveProductOptionAppearance(branding, structure, 'p', 's', 'other').backgroundColor, '#123456');
});
test('locking captures the visible appearance and survives later shared changes; unlocking resumes inheritance', () => {
  const local = { ...optionAppearanceSettings(shared), lockFromSharedButtons: true };
  const next = draft({ ...shared, bgColor: '#998877' });
  assert.equal(resolveProductOptionAppearance(next, structure, 'p', 's', 'v', local).backgroundColor, '#123456');
  assert.equal(resolveProductOptionAppearance(next, structure, 'p', 's', 'v', { ...local, lockFromSharedButtons: false }).backgroundColor, '#998877');
});
test('legacy appearance respects global, product, section and value precedence, including zero radius', () => {
  const branding = { productPage: { matrix: { textButtons: { backgroundColor: '#445566', selectedBackgroundColor: '#556677' } } } } as unknown as BrandingData;
  const product = { ...structure, buttonStyling: { textButtons: { backgroundColor: '#667788' } } };
  const result = resolveProductOptionAppearance(branding, product, 'p', 's', 'v', { textColor: '#ABCDEF', borderRadiusPx: 0 });
  assert.equal(result.backgroundColor, '#112233');
  assert.equal(result.textColor, '#ABCDEF');
  assert.equal(result.selectedBackgroundColor, '#556677');
  assert.equal(result.borderRadiusPx, 0);
});
test('shared and locked edge colors and border width match the actual CSS rules', () => {
  const result = resolveProductOptionAppearance(draft(), structure, 'p', 's', 'v');
  assert.equal(result.hoverBorderColor, shared.hoverBgColor);
  assert.equal(result.borderWidthPx, 1);
  assert.equal(result.selectedTextColor, shared.selectedTextColor);
});
