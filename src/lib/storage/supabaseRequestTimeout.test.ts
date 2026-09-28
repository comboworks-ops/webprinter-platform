import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseRequestTimeoutMs } from './supabaseRequestTimeout.ts';

test('product image uploads have time to finish on slow connections', () => {
  const request = new Request('https://example.supabase.co/storage/v1/object/product-images/photo.png', {
    method: 'POST',
  });
  assert.equal(supabaseRequestTimeoutMs(request), 120_000);
  assert.equal(
    supabaseRequestTimeoutMs('https://example.supabase.co/storage/v1/object/product-images/photo.png', { method: 'PUT' }),
    120_000,
  );
});

test('reads, deletes and database writes retain the existing short timeout', () => {
  const objectUrl = 'https://example.supabase.co/storage/v1/object/product-images/photo.png';
  assert.equal(supabaseRequestTimeoutMs(objectUrl), 12_000);
  assert.equal(supabaseRequestTimeoutMs(objectUrl, { method: 'DELETE' }), 12_000);
  assert.equal(supabaseRequestTimeoutMs('https://example.supabase.co/rest/v1/products', { method: 'PATCH' }), 12_000);
});

test('checkout verification has time to copy and hash large files before payment', () => {
  assert.equal(supabaseRequestTimeoutMs('https://example.supabase.co/functions/v1/stripe-create-payment-intent', {method:'POST'}),150_000);
  assert.equal(supabaseRequestTimeoutMs('https://example.supabase.co/functions/v1/unrelated', {method:'POST'}),12_000);
});
