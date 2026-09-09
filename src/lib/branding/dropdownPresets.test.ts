import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_DROPDOWN_PRESETS,
  DEFAULT_DROPDOWN_PRESET,
  LEGACY_DROPDOWN_PRESETS,
  isApprovedDropdownPreset,
  resolveDropdownPreset,
} from './dropdownPresets.ts';
import { SHOP_NAVIGATION_OPTIONS } from '../storefront/shopTemplates.ts';

test('the approved catalog retains the user selection and original gallery numbers', () => {
  assert.equal(DEFAULT_DROPDOWN_PRESET, 'search-and-discover');
  assert.deepEqual(APPROVED_DROPDOWN_PRESETS.map(preset => [preset.number, preset.id]), [
    [1, 'tabbed-explorer'], [2, 'visual-showroom'], [3, 'kinetic-type'],
    [4, 'quick-list'], [5, 'search-and-discover'], [7, 'paper-fold'],
    [8, 'open-directory'], [9, 'product-filmstrip'], [10, 'focus-curtain'],
  ]);
  assert.equal(isApprovedDropdownPreset('editorial-feature'), false);
  assert.deepEqual(SHOP_NAVIGATION_OPTIONS.map(option => option.id), APPROVED_DROPDOWN_PRESETS.map(preset => preset.id));
});

test('old defaults and malformed stored settings resolve to Search & Discover', () => {
  for (const value of [undefined, null, '', 'classic', 'editorial-feature', 'unknown', {}, 5]) {
    assert.equal(resolveDropdownPreset(value), DEFAULT_DROPDOWN_PRESET);
  }
});

test('explicit approved and legacy alternative menus survive normalization', () => {
  for (const { id } of APPROVED_DROPDOWN_PRESETS) {
    assert.equal(isApprovedDropdownPreset(id), true);
    assert.equal(resolveDropdownPreset(id), id);
    assert.equal(resolveDropdownPreset(resolveDropdownPreset(id)), id);
  }
  for (const id of LEGACY_DROPDOWN_PRESETS.filter(id => id !== 'classic')) {
    assert.equal(isApprovedDropdownPreset(id), false);
    assert.equal(resolveDropdownPreset(id), id);
  }
});
