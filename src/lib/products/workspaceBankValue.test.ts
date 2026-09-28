import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachWorkspaceBankValue } from './workspaceBankValue.ts';
import { workspaceSections } from './productWorkspace.ts';

const fixture = () => ({
  supplier: { product: 'immutable' }, prices: [{ value: 'a', price: 123 }],
  vertical_axis: { sectionId: 'paper', sectionType: 'materials', groupId: 'papers', valueIds: ['a', 'b'], valueSettings: { a: { displayName: 'Paper A' } } },
  layout_rows: [], workspaceGroups: [{ id: 'paper', title: 'Papir', options: [{ sectionId: 'paper', valueId: 'a' }, { sectionId: 'paper', valueId: 'b' }] }, { id: 'empty', title: 'Nye valg', options: [] }],
});
test('replacing a matrix material preserves source metadata, supplier identity and price rows', () => {
  const before = fixture(); const copy = structuredClone(before);
  const after = attachWorkspaceBankValue(before, { groupId: 'paper', sourceId: 'paper', sourceGroupId: 'papers', valueId: 'c', type: 'material', replaceValueId: 'a' });
  assert.deepEqual(after.vertical_axis.valueIds, ['c', 'b']);
  assert.deepEqual(after.workspaceGroups[0].options.map((item: { valueId: string }) => item.valueId), ['c', 'b']);
  assert.deepEqual(after.vertical_axis.valueSettings, before.vertical_axis.valueSettings);
  assert.deepEqual(after.prices, before.prices); assert.deepEqual(after.supplier, before.supplier); assert.deepEqual(before, copy);
});
test('adding to an empty presentation box creates a matching source section', () => {
  const after = attachWorkspaceBankValue(fixture(), { groupId: 'empty', sourceId: 'empty', sourceGroupId: 'formats', valueId: 'a5', type: 'format' });
  const added = workspaceSections(after).find(item => item.id === 'empty');
  assert.equal(added?.groupId, 'formats'); assert.equal(added?.sectionType, 'formats');
  assert.equal(added?.selection_mode, 'required'); assert.deepEqual(added?.valueIds, ['a5']);
  assert.deepEqual(after.vertical_axis, fixture().vertical_axis);
});
test('an optional finishing section starts optional and retains existing layout', () => {
  const before = fixture();
  const after = attachWorkspaceBankValue(before, { groupId: 'empty', sourceId: 'empty', sourceGroupId: 'finishes', valueId: 'uv', type: 'finish' });
  assert.equal(after.layout_rows[0].columns[0].selection_mode, 'optional');
  assert.deepEqual(after.workspaceGroups[0].options, before.workspaceGroups[0].options);
  assert.deepEqual(after.vertical_axis, before.vertical_axis);
});
test('replacements keep an old source value if another presentation still uses it', () => {
  const before = fixture(); before.workspaceGroups[1].options = [{ sectionId: 'paper', valueId: 'a' }];
  const after = attachWorkspaceBankValue(before, { groupId: 'paper', sourceId: 'paper', sourceGroupId: 'papers', valueId: 'c', type: 'material', replaceValueId: 'a' });
  assert.deepEqual(after.vertical_axis.valueIds, ['a', 'b', 'c']);
});
test('type, source group, duplicate and stale replacement mismatches are rejected', () => {
  const input = { groupId: 'paper', sourceId: 'paper', sourceGroupId: 'papers', valueId: 'c', type: 'material' as const };
  assert.throws(() => attachWorkspaceBankValue(fixture(), { ...input, type: 'format' }));
  assert.throws(() => attachWorkspaceBankValue(fixture(), { ...input, sourceGroupId: 'other' }));
  assert.throws(() => attachWorkspaceBankValue(fixture(), { ...input, valueId: 'a' }));
  assert.throws(() => attachWorkspaceBankValue(fixture(), { ...input, replaceValueId: 'missing' }));
});
