import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceBankChoices, type WorkspaceBankItem } from './workspaceBankSelection.ts';

const item = (id: string, name: string, width_mm = 100): WorkspaceBankItem => ({
  id, name, width_mm, height_mm: 100, category: 'Format', icon_name: null,
  bleed_mm: 3, safe_area_mm: 3, image_url: null,
});
test('the exact linked choice is first even after a customer-facing rename', () => {
  const items = [item('other', '100x100'), item('linked', 'Square')];
  const before = structuredClone(items);
  const choices = workspaceBankChoices(items, { id: 'product-value', name: 'My square', sourceName: '100x100', libraryTemplateId: 'linked' });
  assert.equal(choices[0].item.id, 'linked'); assert.equal(choices[0].item.name, 'My square');
  assert.equal(choices[0].current, true); assert.equal(choices[1].item.id, 'other');
  assert.deepEqual(items, before);
});
test('an imported choice stays visible first when absent from the bank', () => {
  const choices = workspaceBankChoices([item('a4', 'A4', 210)], { id: 'supplier-format', name: '100x100mm', sourceName: '100x100mm', width_mm: 100, height_mm: 100 });
  assert.equal(choices[0].item.id, 'current:supplier-format');
  assert.equal(choices[0].item.width_mm, 100); assert.equal(choices[1].item.id, 'a4');
});
test('same name with different dimensions is not marked as the product choice', () => {
  const choices = workspaceBankChoices([item('small', 'Square', 80), item('right', 'Square')], { id: 'current', name: 'Custom square', sourceName: 'Square', width_mm: 100, height_mm: 100 });
  assert.equal(choices[0].item.id, 'right'); assert.equal(choices[1].item.id, 'small');
  assert.equal(choices.length, 2);
});
test('a missing explicit library link cannot silently match another entry by name', () => {
  const choices = workspaceBankChoices([item('unrelated', 'Square')], { id: 'current', name: 'Square', sourceName: 'Square', libraryTemplateId: 'removed', width_mm: 100, height_mm: 100 });
  assert.equal(choices[0].item.id, 'current:current'); assert.equal(choices.length, 2);
});
test('empty and loading banks still show the actual selected material', () => {
  const choices = workspaceBankChoices([], { id: 'paper', name: '135g kvalitetstryk', sourceName: '135g kvalitetstryk' });
  assert.equal(choices.length, 1); assert.equal(choices[0].current, true);
  assert.deepEqual(workspaceBankChoices([]), []);
});
