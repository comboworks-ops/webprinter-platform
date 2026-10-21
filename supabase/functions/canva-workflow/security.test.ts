import assert from 'node:assert/strict';
import { CANVA_FIELDS, CANVA_TEMPLATES, assertCanvaDataset, assertCustomerCopy, canvaUrl, validateCanvaText, validateCanvaPhoto } from '../../../shared/canva.ts';
import { tokenVault, boundedBytes, callbackUri, sha256 } from './security.ts';

Deno.test('encrypted tokens cannot cross customer or tenant boundaries, or be tampered with', async () => {
  const vault = await tokenVault('a'.repeat(64));
  const token = { access_token: 'secret', refresh_token: 'rotation' };
  const sealed = await vault.seal(token, 'customer-a:shop-a');
  assert.ok(!sealed.includes('secret'));
  assert.deepEqual(await vault.open(sealed, 'customer-a:shop-a'), token);
  await assert.rejects(() => vault.open(sealed, 'customer-b:shop-a'));
  await assert.rejects(() => vault.open(sealed, 'customer-a:shop-b'));
  await assert.rejects(() => vault.open(sealed.slice(0,-4) + 'AAAA', 'customer-a:shop-a'));
  await assert.rejects(() => tokenVault('short'));
});
Deno.test('PKCE uses a URL-safe SHA256 challenge', async () => {
  assert.equal(await sha256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});
Deno.test('callbacks and provider URLs reject arbitrary origins, credentials and redirects to private hosts', () => {
  assert.equal(callbackUri('https://shop.test', ['https://shop.test']), 'https://shop.test/canva-designs');
  assert.throws(() => callbackUri('https://evil.test', ['https://shop.test']));
  for (const raw of ['http://127.0.0.1/x', 'https://export-download.canva.com.evil.test/a', 'https://user@export-download.canva.com/a', 'https://export-download.canva.com:444/a']) assert.throws(() => canvaUrl(raw, 'download'));
  assert.equal(canvaUrl('https://export-download.canva.com/a', 'download'), 'https://export-download.canva.com/a');
});
Deno.test('oversized bodies are rejected even without content-length', async () => {
  await assert.rejects(() => boundedBytes(new Response(new Uint8Array(11)), 10));
  assert.equal((await boundedBytes(new Response(new Uint8Array(10)), 10)).length, 10);
});
Deno.test('text cannot silently skip unknown fields or overflow reviewed limits', () => {
  const valid = Object.fromEntries(CANVA_FIELDS.map(field => [field.key, 'Min tekst']));
  assert.equal(validateCanvaText(valid).business_name, 'Min tekst');
  assert.throws(() => validateCanvaText({ ...valid, address: '' }));
  assert.throws(() => validateCanvaText({ ...valid, business_name: 'x'.repeat(27) }));
  assert.throws(() => validateCanvaText({ ...valid, business_name: 'Navn\nEkstra' }));
  assert.throws(() => validateCanvaText({ ...valid, unexpected: 'ignored?' }));
});
Deno.test('dataset drift and attempts to reuse a master are rejected', () => {
  const dataset = { ...Object.fromEntries(CANVA_FIELDS.map(field => [field.key, { type: 'text' }])), hero_image: { type: 'image' } };
  assertCanvaDataset(dataset);
  assert.throws(() => assertCanvaDataset({ ...dataset, hero_image: { type: 'text' } }));
  assert.throws(() => assertCanvaDataset({ ...dataset, new_field: { type: 'text' } }));
  for (const template of CANVA_TEMPLATES) assert.throws(() => assertCustomerCopy(template.designId, 'Dsource'));
  assert.throws(() => assertCustomerCopy('Dsource', 'Dsource'));
  assertCustomerCopy('Dcustomer', 'Dsource');
});
Deno.test('image MIME types must match bytes; SVG and spoofed photos are rejected', () => {
  validateCanvaPhoto(new Uint8Array([255,216,255,1]), 'image/jpeg');
  validateCanvaPhoto(new Uint8Array([137,80,78,71,13,10,26,10]), 'image/png');
  assert.throws(() => validateCanvaPhoto(new TextEncoder().encode('<svg/>'), 'image/png'));
  assert.throws(() => validateCanvaPhoto(new Uint8Array([255,216,255,1]), 'image/png'));
});
