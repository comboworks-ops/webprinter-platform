import assert from 'node:assert/strict';
import test from 'node:test';
import { CHECKOUT_MASTER_TENANT_ID, checkoutProductReturnPath, checkoutTenantConflict, readCheckoutProduct } from './checkoutProduct.ts';

type Product = { id: string; tenant_id: string; is_published: boolean; slug: string };
const own: Product = { id: 'product-b', tenant_id: 'shop-b', is_published: true, slug: 'shared-product' };
const foreign: Product = { ...own, id: 'product-a', tenant_id: 'shop-a' };
const master: Product = { ...own, id: 'product-master', tenant_id: CHECKOUT_MASTER_TENANT_ID };
function database(rows: Product[], error: Error | null = null, ignoreFilters = false) {
  const queries: Array<Array<[string, unknown]>> = [];
  return { queries, client: { from(table: string) {
    assert.equal(table, 'products');
    const filters: Array<[string, unknown]> = [];
    const query = { select() { return query; }, eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      async limit(count: number) { queries.push(filters); return { error, data: rows.filter(row => ignoreFilters || filters.every(([key, value]) => row[key as keyof Product] === value)).slice(0, count) }; } };
    return query;
  } } };
}

test('a previous shop product ID is rejected without changing the saved state', async () => {
  const db = database([foreign, own, master]);
  const state = { productId: foreign.id, productSlug: foreign.slug, checkoutCustomer: { customerName: 'Saved customer' } };
  const original = structuredClone(state);
  await assert.rejects(readCheckoutProduct(db.client as never, 'shop-b', state), /ikke tilgængeligt/);
  assert.deepEqual(state, original);
  assert.deepEqual(db.queries.map(query => query.find(([key]) => key === 'tenant_id')?.[1]), ['shop-b', CHECKOUT_MASTER_TENANT_ID]);
});

test('a duplicate slug selects the current shop before the published master fallback', async () => {
  const db = database([foreign, master, own]);
  assert.equal((await readCheckoutProduct(db.client as never, 'shop-b', { productSlug: own.slug })).id, own.id);
  assert.equal(db.queries.length, 1);
  const fallback = database([foreign, master]);
  assert.equal((await readCheckoutProduct(fallback.client as never, 'shop-b', { productSlug: own.slug })).id, master.id);
});

test('legacy own and master UUID drafts remain valid, unpublished drafts do not', async () => {
  const db = database([foreign, master, own, { ...own, id: 'draft', is_published: false }]);
  assert.equal((await readCheckoutProduct(db.client as never, 'shop-b', { productId: own.id })).id, own.id);
  assert.equal((await readCheckoutProduct(db.client as never, 'shop-b', { productId: master.id })).id, master.id);
  await assert.rejects(readCheckoutProduct(db.client as never, 'shop-b', { productId: 'draft' }), /ikke tilgængeligt/);
});

test('failed product queries never fall back to another product or trust an out-of-scope response', async () => {
  const db = database([master], new Error('network unavailable'));
  await assert.rejects(readCheckoutProduct(db.client as never, 'shop-b', { productSlug: own.slug }), /network unavailable/);
  assert.equal(db.queries.length, 1);
  const bad = database([foreign], null, true);
  await assert.rejects(readCheckoutProduct(bad.client as never, 'shop-b', { productSlug: own.slug }), /matcher ikke/);
});

test('shop binding and historical product URL reject cross-shop restoration while retaining legacy drafts', () => {
  const shop = { id: 'shop-b', domain: 'b.example.test' };
  assert.equal(checkoutTenantConflict({ checkoutTenantId: 'shop-a' }, shop), true);
  assert.equal(checkoutTenantConflict({ checkoutTenantId: 'shop-b' }, shop), false);
  assert.equal(checkoutTenantConflict({ productReturnPath: '/produkt/x?tenantId=shop-a' }, shop), true);
  assert.equal(checkoutTenantConflict({ productReturnPath: '/produkt/x?force_domain=a.example.test' }, shop), true);
  assert.equal(checkoutTenantConflict({ productReturnPath: '/produkt/x?force_domain=www.b.example.test' }, shop), false);
  assert.equal(checkoutTenantConflict({ productId: master.id }, shop), false);
  const masterShop = { id: CHECKOUT_MASTER_TENANT_ID, domain: 'demo.webprinter.dk' };
  for (const domain of ['webprinter.dk', 'www.webprinter.dk', 'demo.webprinter.dk', 'www.demo.webprinter.dk']) {
    assert.equal(checkoutTenantConflict({ productReturnPath: `/produkt/x?force_domain=${domain}` }, masterShop), false);
  }
  assert.equal(checkoutTenantConflict({ productReturnPath: '/produkt/x?force_domain=a.example.test' }, masterShop), true);
});

test('verified draft preview can read its own unpublished product without broadening tenant scope', async () => {
  const draft = { ...own, id: 'draft', is_published: false };
  const db = database([foreign, master, draft]);
  assert.equal((await readCheckoutProduct(db.client as never, 'shop-b', { productId: draft.id }, { allowUnpublished: true })).id, draft.id);
  await assert.rejects(readCheckoutProduct(db.client as never, 'shop-b', { productId: foreign.id }, { allowUnpublished: true }), /ikke tilgængeligt/);
  await assert.rejects(readCheckoutProduct(db.client as never, 'shop-b', { productId: master.id }, { allowUnpublished: true }), /ikke tilgængeligt/);
});

test('blocked checkout returns to its original product and shop without allowing external navigation', () => {
  assert.equal(checkoutProductReturnPath({ checkoutTenantId: 'shop-a', productReturnPath: '/produkt/folder?force_domain=a.example.test' }), '/produkt/folder?force_domain=a.example.test&tenantId=shop-a');
  assert.equal(checkoutProductReturnPath({ checkoutTenantId: 'shop-a', productSlug: 'shared product' }), '/produkt/shared%20product?tenantId=shop-a');
  assert.equal(checkoutProductReturnPath({ productReturnPath: '/\n/elsewhere.test' }), null);
  assert.equal(checkoutProductReturnPath({ productReturnPath: '//elsewhere.test' }), null);
});
