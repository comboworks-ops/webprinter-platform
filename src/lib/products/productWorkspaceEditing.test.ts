import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editWorkspacePlacement, restoreWorkspacePlacement } from './productWorkspaceEditing.ts';
import { workspaceGroups, workspaceRows, validateWorkspace, prepareWorkspaceSave, readWorkspaceDraft } from './productWorkspace.ts';
import { prepareProductLayoutSave } from './productLayoutSave.ts';

const fixture = () => {
  const source = { mode: 'matrix_layout_v1', version: 1, quantities: [100, 500], supplier: { id: 'unchanged' },
    vertical_axis: { sectionId: 'paper', sectionType: 'materials', groupId: 'm', valueIds: ['silk', 'mat'] },
    layout_rows: [
      { id: 'shared', columns: [{ id: 'format', sectionType: 'formats', groupId: 'f', valueIds: ['a4', 'a5'] }, { id: 'finish', sectionType: 'finishes', groupId: 'e', valueIds: ['matte', 'gloss'] }] },
      { id: 'uv-row', columns: [{ id: 'uv', sectionType: 'finishes', groupId: 'u', valueIds: ['front', 'both'] }] },
    ] };
  return { ...source, workspaceGroups: workspaceGroups(source) };
};
const order = (value: ReturnType<typeof fixture>) => workspaceRows(workspaceGroups(value)).map(row => row.map(group => group.id));
test('moving UV above a shared row changes visible position without changing price identities', () => {
  const before = fixture(); const saved = structuredClone(before);
  const next = editWorkspacePlacement(before, { groupId: 'uv', action: 'before', targetId: 'format' });
  assert.deepEqual(order(next as typeof before), [['paper'], ['uv'], ['format', 'finish']]);
  assert.deepEqual(before, saved);
  assert.deepEqual(next.layout_rows, before.layout_rows);
  assert.deepEqual(next.supplier, before.supplier);
  assert.deepEqual(validateWorkspace(next), []);
});
test('moving a member out of a shared row does not pull it back into its old row', () => {
  const before = fixture(); const next = editWorkspacePlacement(before, { groupId: 'format', action: 'after', targetId: 'uv' });
  assert.deepEqual(order(next as typeof before), [['paper'], ['finish'], ['uv'], ['format']]);
});
test('swap exchanges physical positions including membership in a shared row', () => {
  const before = fixture(); const next = editWorkspacePlacement(before, { groupId: 'uv', action: 'swap', targetId: 'format' });
  assert.deepEqual(order(next as typeof before), [['paper'], ['uv', 'finish'], ['format']]);
});
test('matrix rows cannot be dragged out and unknown targets are ignored', () => {
  const before = fixture();
  assert.equal(editWorkspacePlacement(before, { groupId: 'paper', action: 'after', targetId: 'uv' }), before);
  assert.equal(editWorkspacePlacement(before, { groupId: 'uv', action: 'before', targetId: 'missing' }), before);
});
test('button order updates both selectors and matrix order, retaining the same values', () => {
  const before = fixture();
  const next = editWorkspacePlacement(before, { groupId: 'paper', action: 'option-before', sectionId: 'paper', valueId: 'mat', targetId: 'paper:silk' });
  assert.deepEqual(next.vertical_axis.valueIds, ['mat', 'silk']);
  assert.deepEqual(next.workspaceGroups[0].options.map(option => option.valueId), ['mat', 'silk']);
  assert.deepEqual(validateWorkspace(next), []);
});
test('undo keeps appearance and content edits made after a move', () => {
  const before = fixture(); const moved = editWorkspacePlacement(before, { groupId: 'uv', action: 'swap', targetId: 'format' });
  moved.workspaceGroups.find(group => group.id === 'uv').motion = 'lift';
  moved.workspaceContent = { name: 'Keep this name' };
  const undone = restoreWorkspacePlacement(moved, before);
  assert.deepEqual(order(undone as typeof before), order(before));
  assert.equal(undone.workspaceGroups.find(group => group.id === 'uv').motion, 'lift');
  assert.equal(undone.workspaceContent.name, 'Keep this name');
});
test('bank additions merge into the open draft and survive draft save/reload', () => {
  const live = fixture(); const draft = editWorkspacePlacement(live, { groupId: 'uv', action: 'swap', targetId: 'format' });
  draft.workspaceContent = { description: 'Keep gallery and text' };
  const candidate = structuredClone(draft); candidate.vertical_axis.valueIds.push('new-paper');
  const next = prepareProductLayoutSave(draft, draft, candidate);
  assert.deepEqual(order(next as typeof live), order(draft as typeof live));
  assert.equal(next.workspaceContent.description, 'Keep gallery and text');
  assert.deepEqual(validateWorkspace(next), []);
  const saved = prepareWorkspaceSave(live, live, next, false);
  assert.deepEqual(saved.vertical_axis, live.vertical_axis);
  assert.deepEqual(readWorkspaceDraft(saved).structure, next);
});
