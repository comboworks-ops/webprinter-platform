import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrintCatalogView, buildPrintCategoryHref, isPrintCatalogRoute } from './printCatalogNavigation.ts';

const overviews = [{ id: 'print', name: 'Tryksager', slug: 'tryk' }, { id: 'large', name: 'Storformat', slug: 'storformat' }];
const categories = [
  { id: 'flyers', name: 'Flyers', slug: 'flyers', overview_id: 'print' },
  { id: 'signs', name: 'Skilte', slug: 'skilte', overview_id: 'large' },
  { id: 'metal', name: 'Metalskilte', slug: 'metalskilte', parent_category_id: 'signs', overview_id: 'large' },
  { id: 'stickers', name: 'Klistermærker', slug: 'klistermrker', overview_id: 'print' },
];
const products = [
  { id: 'a', categoryId: 'metal', categoryKey: 'metalskilte', categoryOverviewId: 'large' },
  { id: 'b', categoryId: 'signs', categoryKey: 'skilte', categoryOverviewId: 'large' },
  { id: 'c', categoryId: 'flyers', categoryKey: 'flyers', categoryOverviewId: 'print' },
  { id: 'd', categoryId: 'stickers', categoryKey: 'klistermrker', categoryOverviewId: 'print' },
];
const resolve = (query: string) => resolvePrintCatalogView(products, categories, overviews, new URLSearchParams(query));

test('category URLs show that branch including child products, without substituting the home product', () => {
  const result = resolve('category=skilte');
  assert.equal(result.title, 'Skilte');
  assert.deepEqual(result.products.map(p => p.id), ['a', 'b']);
});
test('overview and subcategory links preserve their exact scope', () => {
  assert.deepEqual(resolve('overview=storformat').products.map(p => p.id), ['a', 'b']);
  assert.deepEqual(resolve('overview=storformat&category=skilte&subcategory=metalskilte').products.map(p => p.id), ['a']);
  assert.deepEqual(resolve('category=Klistermærker').products.map(p => p.id), ['d']);
});
test('all products includes every supplied published product and invalid branches do not leak unrelated products', () => {
  assert.equal(resolve('').products.length, 4);
  for (const query of ['category=missing', 'overview=missing', 'category=skilte&subcategory=flyers', 'overview=tryk&category=skilte']) {
    assert.deepEqual(resolve(query).products, [], query);
    assert.equal(resolve(query).notFound, true, query);
  }
});
test('category navigation points at the catalogue and carries its overview', () => {
  assert.equal(buildPrintCategoryHref(categories[1], overviews), '/produkter?overview=storformat&category=skilte');
});
test('catalogue intent is distinct from the homepage, including virtual preview paths', () => {
  assert.equal(isPrintCatalogRoute('/produkter?category=skilte'), true);
  assert.equal(isPrintCatalogRoute('/shop', '?category=skilte'), true);
  assert.equal(isPrintCatalogRoute('/'), false);
  assert.equal(isPrintCatalogRoute('/shop', '?design=1'), false);
});
