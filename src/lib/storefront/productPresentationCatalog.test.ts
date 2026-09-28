import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPresentationProducts, groupPresentationProducts } from './productPresentationCatalog.ts';
import { resolvePrintCatalogView } from './printCatalogNavigation.ts';

const categories = [{ id: 'paper', slug: 'tryksager', name: 'Tryksager', sort_order: 2 }, { id: 'large', slug: 'storformat', name: 'Storformat', sort_order: 1 }, { id: 'cards', slug: 'visitkort', name: 'Visitkort', parent_category_id: 'paper' }];
const products = [{ id: 'a', name: 'Visitkort', icon_text: 'Matte visitkort', categoryId: 'cards', categoryLabel: 'Tryksager' }, { id: 'b', name: 'Plakater', categoryId: 'large', categoryLabel: 'Storformat' }, { id: 'c', name: 'Ukendt produkt', categoryKey: 'ukendt' }, { id: 'd', name: 'Flyers', categoryKey: 'tryksager' }];

test('category shelves include children and legacy keys, retain unclassified products, and never duplicate products', () => {
  const groups = groupPresentationProducts(products, categories, []);
  assert.deepEqual(groups.map(group => group.name), ['Storformat', 'Tryksager', 'Flere produkter']);
  assert.deepEqual(groups.map(group => group.products.map(product => product.id)), [['b'], ['a', 'd'], ['c']]);
  assert.equal(new Set(groups.flatMap(group => group.products.map(product => product.id))).size, products.length);
  assert.deepEqual(groupPresentationProducts(products, [], [])[0].products, products);
});

test('search combines Danish product names, visible titles and categories without mutating the source catalogue', () => {
  assert.deepEqual(filterPresentationProducts(products, 'MATTE tryksager').map(product => product.id), ['a']);
  assert.deepEqual(filterPresentationProducts(products, '  ').map(product => product.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(filterPresentationProducts(products, 'missing'), []);
  assert.equal(products.length, 4);
});

test('invalid and conflicting category links cannot broaden the visible catalogue', () => {
  assert.equal(resolvePrintCatalogView(products, categories, [], new URLSearchParams('category=missing')).products.length, 0);
  assert.equal(resolvePrintCatalogView(products, categories, [], new URLSearchParams('category=large&subcategory=cards')).products.length, 0);
});
