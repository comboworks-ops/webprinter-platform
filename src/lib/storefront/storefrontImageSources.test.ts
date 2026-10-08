import test from 'node:test';
import assert from 'node:assert/strict';
import { getStorefrontImageSources } from './storefrontImageSources.ts';

const original = 'https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/product-images/shop/my%20photo.png?v=2';

test('small category images request compressed, uncropped responsive files rather than the original', () => {
  const result = getStorefrontImageSources(original, 'thumbnail');
  const url = new URL(result.src);
  assert.match(url.pathname, /\/render\/image\/public\/product-images\/shop\/my%20photo.png$/);
  assert.equal(url.searchParams.get('width'), '192');
  assert.equal(url.searchParams.get('quality'), '78');
  assert.equal(url.searchParams.get('resize'), 'contain');
  assert.equal(url.searchParams.get('v'), '2');
  assert.equal(url.searchParams.has('height'), false);
  assert.match(result.srcSet!, /96w/);
  assert.match(result.srcSet!, /192w/);
  assert.doesNotMatch(result.srcSet!, /1280w/);
});

test('cards and larger showcases have separate bounded resolutions for sharp screens', () => {
  for (const [variant, max] of [['card', 960], ['feature', 1280]] as const) {
    const result = getStorefrontImageSources(original, variant);
    assert.match(result.srcSet!, new RegExp(`${max}w`));
    for (const candidate of result.srcSet!.split(', ')) {
      assert.ok(Number(new URL(candidate.split(' ')[0]).searchParams.get('width')) <= max);
    }
  }
});

test('signed, private, animated, vector and foreign sources retain their existing delivery', () => {
  for (const src of [
    original.replace('/object/public/', '/object/sign/') + '&token=secret',
    original + '&token=secret', original.replace('.png', '.gif'), original.replace('.png', '.svg'),
    'https://images.example.com/storage/v1/object/public/brand/photo.png',
    'https://example.com/category.jpg', '/custom-category.jpg', '/placeholder.svg', 'blob:https://webprinter.dk/id',
  ]) assert.deepEqual(getStorefrontImageSources(src), {src});
});

test('a public render URL is resized once without doubling endpoints or retaining a crop', () => {
  const result = getStorefrontImageSources(original.replace('/object/public/', '/render/image/public/') + '&width=2500&height=500&resize=cover');
  const url = new URL(result.src);
  assert.equal(url.searchParams.get('width'), '640');
  assert.equal(url.searchParams.has('height'), false);
  assert.equal(url.pathname.split('/render/image/public/').length, 2);
});

test('built-in product and category artwork use generated WebP variants in development and production', () => {
  for (const src of ['/src/assets/products/folie.png', '/assets/folie-abc123.png', '/design-presets/category-print.webp']) {
    const result = getStorefrontImageSources(src);
    assert.match(result.src, /^\/storefront-images\/.+\.webp$/);
    assert.match(result.srcSet!, /320w/);
    assert.notEqual(result.src, src);
  }
  assert.deepEqual(getStorefrontImageSources('https://foreign.example/assets/folie-abc123.png'), {src:'https://foreign.example/assets/folie-abc123.png'});
});
