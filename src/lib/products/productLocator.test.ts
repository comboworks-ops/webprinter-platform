import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocatorItems, filterLocatorItems, locatorUrl } from './productLocator.ts';

const products = [
  { id: 'a', name: 'Foldere', slug: 'foldere', category: 'Tryksager', is_published: true },
  { id: 'b', name: 'Økologiske plakater', slug: 'plakater', category: 'Plakater', is_published: false },
];
const items = buildLocatorItems(products, [
  { product_id: 'a', kind: 'format', values: [{ name: 'A4' }] },
  { product_id: 'a', kind: 'material', values: [{ name: '170 g silk' }, { name: 'Fjernet', enabled: false }] },
  { product_id: 'b', kind: 'format', values: [{ name: 'A3' }] },
  { product_id: 'b', kind: 'material', enabled: false, values: [{ name: 'Skjult papir' }] },
]);
const empty = { query: '', category: '', format: '', material: '', status: '' };
test('search combines actual product and attribute words without matching another product’s data', () => {
  assert.deepEqual(filterLocatorItems(items, { ...empty, query: 'A4 fold silk' }).map(item => item.id), ['a']);
  assert.equal(filterLocatorItems(items, { ...empty, query: 'A3 silk' }).length, 0);
  assert.deepEqual(filterLocatorItems(items, { ...empty, query: 'okologiske' }).map(item => item.id), ['b']);
});
test('filters combine and disabled metadata does not appear', () => {
  assert.deepEqual(items[0].materials, ['170 g silk']);
  assert.deepEqual(items[1].materials, []);
  assert.deepEqual(filterLocatorItems(items, { ...empty, category: 'Tryksager', format: 'A4', material: '170 g silk', status: 'published' }).map(item => item.id), ['a']);
  assert.deepEqual(filterLocatorItems(items, { ...empty, status: 'draft' }).map(item => item.id), ['b']);
});
test('opening and returning retains tenant, search, and selected-product context', () => {
  const search = '?tenantId=shop&force_domain=print.example&findQuery=A4+silk&view=manage';
  const url = locatorUrl('/admin/product/foldere', search, { view: '', findSelected: 'a' });
  const parsed = new URL(url, 'https://local.example');
  assert.equal(parsed.searchParams.get('tenantId'), 'shop');
  assert.equal(parsed.searchParams.get('force_domain'), 'print.example');
  assert.equal(parsed.searchParams.get('findQuery'), 'A4 silk');
  assert.equal(parsed.searchParams.get('findSelected'), 'a');
  assert.equal(parsed.searchParams.has('view'), false);
});
