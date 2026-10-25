import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticSelectionChanges, type SelectionSnapshot } from './automaticSelectionNotice.ts';
const before: SelectionSnapshot = {
  material: { value: 'silk', label: 'Silk 300 g', title: 'Materiale' },
  quantity: { value: '500', label: '500 stk.', title: 'Antal' },
};
const after: SelectionSnapshot = {
  material: { value: 'offset', label: 'Offset 250 g', title: 'Materiale' },
  quantity: { value: '100', label: '100 stk.', title: 'Antal' },
};
test('initial defaults and unchanged choices do not produce automatic warnings', () => {
  assert.deepEqual(automaticSelectionChanges({}, after, []), []);
  assert.deepEqual(automaticSelectionChanges(before, before, []), []);
});
test('automatic material and quantity changes retain both old and new labels', () => {
  assert.deepEqual(automaticSelectionChanges(before, after, []), [
    'Materiale: Silk 300 g → Offset 250 g', 'Antal: 500 stk. → 100 stk.',
  ]);
});
test('a manual material choice still reports its dependent quantity correction', () => {
  assert.deepEqual(automaticSelectionChanges(before, after, ['material']), ['Antal: 500 stk. → 100 stk.']);
});
test('manual price-cell selection is not presented as automatic', () => {
  assert.deepEqual(automaticSelectionChanges(before, after, ['material', 'quantity']), []);
});
test('label-only changes and missing values do not invent a replacement', () => {
  assert.deepEqual(automaticSelectionChanges(before, { material: { ...before.material, label: 'Min egen beskrivelse' } }, []), []);
  assert.deepEqual(before.material.label, 'Silk 300 g');
});
