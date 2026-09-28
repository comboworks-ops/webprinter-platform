import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveWorkspaceStructure, moveWorkspaceOption, patchWorkspaceSection, prepareWorkspaceSave, productionMethodLabel, readWorkspaceDraft, setWorkspaceMatrixAxis, validateWorkspace, workspaceGroups } from './productWorkspace.ts';

const fixture = () => ({
  mode: 'matrix_layout_v1', version: 1,
  vertical_axis: { sectionId: 'paper', sectionType: 'materials', groupId: 'paper-source', valueIds: ['silk', 'mat'], title: 'Papir' },
  layout_rows: [{ id: 'row', columns: [{ id: 'format', sectionType: 'formats', groupId: 'format-source', valueIds: ['a4', 'a5'] }, { id: 'fold', sectionType: 'finishes', groupId: 'fold-source', valueIds: ['one', 'roll'] }] }],
  quantities: [100, 500, 1000], supplier: { productId: 'supplier-original', immutablePrices: [81, 164] },
  templateBinding: { axisSections: ['format', 'fold'] }, markup: 1.4,
});
test('moving a value only changes presentation membership; original price and source identities survive', () => {
  const before = fixture(); const snapshot = structuredClone(before);
  const after = moveWorkspaceOption(before, { sectionId: 'fold', valueId: 'roll' }, 'format');
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after.layout_rows, before.layout_rows);
  assert.deepEqual(after.vertical_axis, before.vertical_axis);
  assert.deepEqual(after.workspaceGroups.find(group => group.id === 'format').options.at(-1), { sectionId: 'fold', valueId: 'roll' });
  assert.deepEqual(validateWorkspace(after), []);
});
test('draft reload does not apply any of the draft edits to the live form', () => {
  const initial = fixture(); const draft = patchWorkspaceSection(initial, 'fold', { ui_mode: 'medium', valueSettings: { roll: { imageSizePx: 120 } } });
  const saved = prepareWorkspaceSave(initial, initial, draft, false);
  assert.deepEqual(liveWorkspaceStructure(saved), initial);
  assert.deepEqual(readWorkspaceDraft(saved).structure, draft);
  assert.equal(readWorkspaceDraft(saved).stale, false);
});
test('apply only copies owned presentation fields, preserving prices, supplier and templates', () => {
  const initial = fixture(); const draft = { ...moveWorkspaceOption(initial, { sectionId: 'fold', valueId: 'roll' }, 'format'), quantities: [1], supplier: null, markup: 900, templateBinding: null };
  const result = prepareWorkspaceSave(initial, initial, draft, true);
  assert.deepEqual(result.quantities, initial.quantities);
  assert.deepEqual(result.supplier, initial.supplier);
  assert.deepEqual(result.templateBinding, initial.templateBinding);
  assert.equal(result.markup, initial.markup);
  assert.equal(result.workspaceDraft, undefined);
});
test('stale tabs cannot overwrite newer saved product data or a newer draft', () => {
  const initial = fixture(); const newer = prepareWorkspaceSave(initial, initial, patchWorkspaceSection(initial, 'fold', { title: 'Falsetype' }), false);
  assert.throws(() => prepareWorkspaceSave(newer, initial, initial, true), /andet vindue/);
});
test('a draft based on an older source layout is preserved but never applied automatically', () => {
  const initial = fixture(); const saved = prepareWorkspaceSave(initial, initial, initial, false);
  const newer = { ...saved, quantities: [500, 1000] };
  assert.equal(readWorkspaceDraft(newer).stale, true);
  assert.deepEqual(readWorkspaceDraft(newer).structure.quantities, [500, 1000]);
  assert.ok('workspaceDraft' in newer);
});
test('switching matrix axis preserves all source sections and IDs without changing quantities', () => {
  const before = fixture(); const result = setWorkspaceMatrixAxis(before, 'format');
  assert.equal(result.vertical_axis.sectionId, 'format');
  assert.equal(result.layout_rows[0].columns[0].id, 'paper');
  assert.deepEqual(result.quantities, before.quantities);
  assert.deepEqual(validateWorkspace(result), []);
  assert.throws(() => setWorkspaceMatrixAxis(before, 'fold'), /format eller materiale/);
});
test('unpriced new options can be saved as draft but cannot publish', () => {
  const initial = fixture(); const draft = { ...initial, workspaceGroups: [...workspaceGroups(initial), { id: 'new', title: 'Efterbehandling', options: [], pending: [{ id: 'new-val', name: 'Guldtryk' }] }] };
  assert.ok(prepareWorkspaceSave(initial, initial, draft, false).workspaceDraft);
  assert.throws(() => prepareWorkspaceSave(initial, initial, draft, true), /mangler prisgrundlag/);
});
test('deleted or duplicate source references block apply', () => {
  const initial = fixture(); const groups = workspaceGroups(initial); groups[0].options.pop();
  assert.match(validateWorkspace({ ...initial, workspaceGroups: groups }).join(' '), /mangler en placering/);
  groups[0].options.push(groups[0].options[0]);
  assert.match(validateWorkspace({ ...initial, workspaceGroups: groups }).join(' '), /mere end/);
});
test('production labels require explicit quote-row metadata, never an inferred quantity threshold', () => {
  assert.equal(productionMethodLabel({ quantity: 1000 }), undefined);
  assert.equal(productionMethodLabel({ extra_data: { production_method: 'offset' } }), 'Offsettryk');
  assert.equal(productionMethodLabel({ extra_data: { productionMethod: 'digital' } }), 'Digitaltryk');
  assert.equal(productionMethodLabel({ extra_data: { production_method: 'unknown' } }), undefined);
});
