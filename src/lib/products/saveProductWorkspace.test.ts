import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveProductWorkspace } from './saveProductWorkspace.ts';

function database({ conflict = false, tenant = 'shop' } = {}) {
  const structure = { mode: 'matrix_layout_v1', vertical_axis: { sectionId: 'paper', valueIds: ['silk'] }, layout_rows: [], quantities: [100, 1000], supplier: { id: 'fixed' } };
  const state = { row: { id: 'product', tenant_id: tenant, name: 'Foldere', description: '', image_url: '', updated_at: 'original', pricing_structure: structure }, writes: [] as any[] };
  const client = { from: (table: string) => {
    assert.equal(table, 'products'); const filters: Record<string, unknown> = {}; let update: any;
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; }, update: (value: unknown) => { update = value; return query; }, single: () => query, maybeSingle: () => query,
      then(resolve: any, reject: any) {
        let row = Object.entries(filters).every(([key, value]) => state.row[key as keyof typeof state.row] === value) ? state.row : null;
        if (update) { assert.deepEqual(filters, { id: 'product', tenant_id: 'shop', updated_at: 'original' }); if (conflict) row = null; if (row) { state.writes.push(update); state.row = { ...row, ...update, updated_at: 'new' }; row = state.row; } }
        return Promise.resolve({ data: row, error: null }).then(resolve, reject);
      } };
    return query;
  } } as unknown as Parameters<typeof saveProductWorkspace>[0];
  return { client, state, structure };
}
test('tenant and timestamp guarded draft write leaves canonical text and pricing untouched', async () => {
  const { client, state, structure } = database();
  await saveProductWorkspace(client, 'shop', 'product', structure, { ...structure, workspaceContent: { name: 'Ny folder' } });
  assert.equal(state.row.name, 'Foldere');
  assert.equal(state.writes.length, 1);
  assert.deepEqual(Object.keys(state.writes[0]), ['pricing_structure']);
  assert.deepEqual(state.row.pricing_structure.quantities, [100, 1000]);
});
test('apply updates canonical catalogue fields and layout together without a stale content override', async () => {
  const { client, state, structure } = database();
  const saved = await saveProductWorkspace(client, 'shop', 'product', structure, { ...structure, workspaceContent: { name: 'Ny folder', image_url: '/folder.png', images: ['/detail.png'] } }, true, { name: 'Foldere', image_url: '' });
  assert.equal(state.row.name, 'Ny folder');
  assert.equal(state.row.image_url, '/folder.png');
  assert.equal(saved.workspaceContent.name, undefined);
  assert.deepEqual(saved.workspaceContent.images, ['/detail.png']);
  assert.deepEqual(saved.supplier, { id: 'fixed' });
});
test('a concurrent content change or failed compare-and-swap does not produce a successful save', async () => {
  const first = database();
  await assert.rejects(saveProductWorkspace(first.client, 'shop', 'product', first.structure, { ...first.structure, workspaceContent: { name: 'Ny' } }, true, { name: 'Old title' }), /andet vindue/);
  assert.equal(first.state.writes.length, 0);
  const second = database({ conflict: true });
  await assert.rejects(saveProductWorkspace(second.client, 'shop', 'product', second.structure, second.structure), /samtidig/);
  assert.equal(second.state.writes.length, 0);
});
test('a product from another tenant cannot be saved', async () => {
  const { client, state, structure } = database({ tenant: 'other' });
  await assert.rejects(saveProductWorkspace(client, 'shop', 'product', structure, structure), /denne shop/);
  assert.equal(state.writes.length, 0);
});
