import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeaturedStorformatHref, readFeaturedStorformatSelection, resolveFeaturedQuantity } from './featuredProductNavigation.ts';

test('continuing from the homepage carries dimensions and quantity while preserving tenant context', () => {
  const href = buildFeaturedStorformatHref('/produkt/aluminium?tenantId=shop#calculator', { widthCm: 80, heightCm: 100, quantity: 2 });
  const url = new URL(href, 'http://storefront.local');
  assert.equal(url.pathname, '/produkt/aluminium');
  assert.equal(url.searchParams.get('tenantId'), 'shop');
  assert.equal(url.hash, '#calculator');
  assert.deepEqual(readFeaturedStorformatSelection(url.searchParams), { widthCm: 80, heightCm: 100, quantity: 2 });
  assert.equal(url.searchParams.has('price'), false);
});

test('category landing links remain category links', () => {
  const href = '/produkter?category=storformat&tenantId=shop';
  assert.equal(buildFeaturedStorformatHref(href, { widthCm: 80, heightCm: 100, quantity: 2 }), href);
});

test('invalid inputs fall back and unsupported quantities cannot bypass the existing product choices', () => {
  assert.deepEqual(readFeaturedStorformatSelection(new URLSearchParams('widthCm=Infinity&heightCm=-20&qty=1.5')), { widthCm: 100, heightCm: 100, quantity: 1 });
  assert.deepEqual(readFeaturedStorformatSelection(new URLSearchParams()), { widthCm: 100, heightCm: 100, quantity: 1 });
  assert.equal(resolveFeaturedQuantity(2, [1, 2, 3]), 2);
  assert.equal(resolveFeaturedQuantity(999, [5, 10]), 5);
});
