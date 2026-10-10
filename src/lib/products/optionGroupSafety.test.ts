import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createProductOptionGroup, detachProductOptionGroup, tenantReleaseConfirmation } from './optionGroupSafety.ts';

function fixture() {
  const rows: Record<string, Record<string, unknown>[]> = {
    products: [{ id: 'product-a', tenant_id: 'shop-a' }, { id: 'product-b', tenant_id: 'shop-b' }],
    product_option_groups: [
      { id: 'group-a', name: 'same_shop', tenant_id: 'shop-a', label: 'Keep label', display_type: 'dropdown', description: 'Keep description' },
      { id: 'group-b', name: 'foreign', tenant_id: 'shop-b', label: 'Foreign label', display_type: 'buttons' },
    ],
    product_option_group_assignments: [{ id: 'link-b', tenant_id: 'shop-b', product_id: 'product-b', option_group_id: 'group-a' }],
    product_options: [{ id: 'option-a', group_id: 'group-a', tenant_id: 'shop-a', label: 'Preserve option' }],
  };
  const calls: { table: string; operation: string }[] = [];
  let nextId = 1;
  const client = { from(table: string) {
    let operation = 'read'; let payload: Record<string, unknown>;
    const filters: [string, unknown][] = [];
    const run = () => {
      calls.push({ table, operation });
      const matches = (row: Record<string, unknown>) => filters.every(([key, value]) => row[key] === value);
      if (operation === 'insert') {
        const row = { id: 'new-' + nextId++, ...payload };
        rows[table].push(row);
        return { data: row, error: null };
      }
      if (operation === 'delete') {
        rows[table] = rows[table].filter(row => !matches(row));
        return { data: null, error: null };
      }
      return { data: rows[table].find(matches) || null, error: null };
    };
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
      insert: (value: Record<string, unknown>) => { operation = 'insert'; payload = value; return chain; },
      delete: () => { operation = 'delete'; return chain; },
      maybeSingle: async () => run(), single: async () => run(),
      then: (resolve: (value: ReturnType<typeof run>) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return chain;
  } } as unknown as Parameters<typeof createProductOptionGroup>[0];
  return { client, rows, calls };
}
const input = { tenantId: 'shop-a', productId: 'product-a', name: 'New Group', label: 'New label', displayType: 'buttons', description: 'Description', sortOrder: 2 };

test('a foreign-shop name collision performs no mutation, even for a main-admin client', async () => {
  const f = fixture(); const before = structuredClone(f.rows);
  await assert.rejects(createProductOptionGroup(f.client, { ...input, name: 'foreign' }), /anden shop/);
  assert.deepEqual(f.rows, before);
  assert.ok(f.calls.every(call => call.operation === 'read'));
});
test('same-shop reuse adds only a scoped assignment and preserves the shared definition/options', async () => {
  const f = fixture(); const groups = structuredClone(f.rows.product_option_groups); const options = structuredClone(f.rows.product_options);
  const result = await createProductOptionGroup(f.client, { ...input, name: 'same_shop' });
  assert.equal(result.reused, true);
  assert.deepEqual(f.rows.product_option_groups, groups); assert.deepEqual(f.rows.product_options, options);
  assert.deepEqual(f.rows.product_option_group_assignments[1], { id: 'new-1', tenant_id: 'shop-a', product_id: 'product-a', option_group_id: 'group-a', sort_order: 2 });
});
test('new group and assignment explicitly belong to the selected product shop', async () => {
  const f = fixture(); const foreign = structuredClone(f.rows.product_option_groups[1]);
  const result = await createProductOptionGroup(f.client, input);
  assert.equal(result.reused, false);
  assert.deepEqual(f.rows.product_option_groups[2], { id: 'new-1', name: 'new_group', label: 'New label', display_type: 'buttons', description: 'Description', tenant_id: 'shop-a' });
  assert.equal(f.rows.product_option_group_assignments[1].tenant_id, 'shop-a');
  assert.deepEqual(f.rows.product_option_groups[1], foreign);
});
test('missing shop and mismatched product fail before any write', async () => {
  const f = fixture(); const before = structuredClone(f.rows);
  await assert.rejects(createProductOptionGroup(f.client, { ...input, tenantId: '' }), /Vælg en shop/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(createProductOptionGroup(f.client, { ...input, productId: 'product-b' }), /tilhører ikke/);
  assert.deepEqual(f.rows, before);
});
test('re-adding an assigned group leaves all records unchanged', async () => {
  const f = fixture(); await createProductOptionGroup(f.client, { ...input, name: 'same_shop' });
  const before = structuredClone(f.rows);
  await assert.rejects(createProductOptionGroup(f.client, { ...input, name: 'same_shop' }), /allerede tilføjet/);
  assert.deepEqual(f.rows, before);
});
test('detach preserves group/options and another product assignment', async () => {
  const f = fixture(); await createProductOptionGroup(f.client, { ...input, name: 'same_shop' });
  const groups = structuredClone(f.rows.product_option_groups); const options = structuredClone(f.rows.product_options);
  await detachProductOptionGroup(f.client, 'shop-a', 'product-a', 'group-a');
  assert.deepEqual(f.rows.product_option_groups, groups); assert.deepEqual(f.rows.product_options, options);
  assert.deepEqual(f.rows.product_option_group_assignments, [{ id: 'link-b', tenant_id: 'shop-b', product_id: 'product-b', option_group_id: 'group-a' }]);
});
test('wrong-shop detach cannot remove a product link', async () => {
  const f = fixture(); const before = structuredClone(f.rows);
  await assert.rejects(detachProductOptionGroup(f.client, 'shop-a', 'product-b', 'group-a'), /tilhører ikke/);
  assert.deepEqual(f.rows, before);
});
test('release prompt states all-shop notification and includes missing-price warning when needed', () => {
  assert.match(tenantReleaseConfirmation('Product', false), /Alle andre shops modtager en besked/);
  assert.doesNotMatch(tenantReleaseConfirmation('Product', false), /ingen Matrix/);
  assert.match(tenantReleaseConfirmation('Product', true), /ingen Matrix-prisrækker/);
});

// Run the actual component handler with isolated dependencies, not a reimplementation.
function releaseHandler(confirmResult: boolean, canDistribute = true, priceWarning = false) {
  const source = fs.readFileSync(new URL('../../components/admin/ProductOverview.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('overview.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'toggleAvailableToTenants') initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(initializer);
  const prompts: string[] = []; const writes: unknown[] = []; const filters: unknown[][] = [];
  const chain = { update: (value: unknown) => { writes.push(value); return chain; }, eq: (...args: unknown[]) => { filters.push(args); return chain; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  const code = ts.transpileModule('(' + initializer.getText(ast) + ')', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const handler = new vm.Script(code).runInNewContext({
    productsTenantId: 'shop-a', canDistributeToTenants: canDistribute,
    getProductPriceHealth: () => ({ tone: priceWarning ? 'warning' : 'normal' }),
    tenantReleaseConfirmation, window: { confirm: (text: string) => { prompts.push(text); return confirmResult; } },
    supabase: { from: () => chain }, toast: { success: () => {}, error: () => {} }, fetchProducts: () => {}, console,
  });
  return { handler, prompts, writes, filters };
}
test('cancelling the actual tenant-release handler performs no database write', async () => {
  const f = releaseHandler(false);
  await f.handler({ id: 'product-a', tenant_id: 'shop-a', name: 'Product', is_available_to_tenants: false });
  assert.equal(f.prompts.length, 1); assert.equal(f.writes.length, 0);
});
test('intentional release still updates only the selected product and shop after confirmation', async () => {
  const f = releaseHandler(true, true, true);
  await f.handler({ id: 'product-a', tenant_id: 'shop-a', name: 'Product', is_available_to_tenants: false });
  assert.equal(f.prompts.length, 1); assert.match(f.prompts[0], /Alle andre shops/); assert.match(f.prompts[0], /ingen Matrix/);
  assert.equal(JSON.stringify(f.writes), JSON.stringify([{ is_available_to_tenants: true }]));
  assert.deepEqual(f.filters, [['id', 'product-a'], ['tenant_id', 'shop-a']]);
});
test('wrong-shop and non-distribution contexts cannot use the release handler', async () => {
  const f = releaseHandler(true);
  await f.handler({ id: 'product-b', tenant_id: 'shop-b', name: 'Wrong shop', is_available_to_tenants: false });
  assert.equal(f.writes.length, 0); assert.equal(f.prompts.length, 0);
  const tenant = releaseHandler(true, false);
  await tenant.handler({ id: 'product-a', tenant_id: 'shop-a', name: 'Product', is_available_to_tenants: false });
  assert.equal(tenant.writes.length, 0); assert.equal(tenant.prompts.length, 0);
});
test('making an already available product private retains the existing scoped behavior', async () => {
  const f = releaseHandler(false);
  await f.handler({ id: 'product-a', tenant_id: 'shop-a', name: 'Product', is_available_to_tenants: true });
  assert.equal(f.prompts.length, 0);
  assert.equal(JSON.stringify(f.writes), JSON.stringify([{ is_available_to_tenants: false }]));
});
