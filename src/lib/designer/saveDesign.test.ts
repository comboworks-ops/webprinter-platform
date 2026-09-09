import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { assertDesignerDocumentSaveSupported, decodeDesignerSnapshot, encodeDesignerSnapshot, resolveDesignerSaveTenant, updateOwnedDesign } from './saveDesign.ts';
test('zero-row design save fails and constrains design, customer and shop', async () => {
  const filters: unknown[] = [];
  const q = { update: () => q, eq: (...args: unknown[]) => { filters.push(args); return q; }, select: () => q, single: async () => ({ data: null, error: null }) };
  const client = { from: () => q } as unknown as Parameters<typeof updateOwnedDesign>[0];
  await assert.rejects(updateOwnedDesign(client, 'design-a', 'customer-a', 'shop-a', {}), /ikke gemt/);
  assert.deepEqual(filters, [['id', 'design-a'], ['user_id', 'customer-a'], ['tenant_id', 'shop-a']]);
});

function tenantReader(tenant: Record<string, unknown> | null, product: Record<string, unknown> | null = null) {
  const calls: unknown[][] = [];
  return { calls, client: { from(table: string) {
    calls.push(['from', table]);
    const q = { select: () => q, eq: (...values: unknown[]) => { calls.push(['eq', ...values]); return q; },
      in: (...values: unknown[]) => { calls.push(['in', ...values]); return q; },
      maybeSingle: async () => ({ data: table === 'tenants' ? tenant : product, error: null }) };
    return q;
  } } as unknown as Parameters<typeof resolveDesignerSaveTenant>[0] };
}
const context = { embedded: false, queryTenantId: null, documentTenantId: null, hostname: 'shop-a.test', search: '' };

test('a new customer design uses the actual shop domain without an admin role or master fallback', async () => {
  const fixture = tenantReader({ id: 'shop-a', domain: 'shop-a.test' });
  assert.equal(await resolveDesignerSaveTenant(fixture.client, context), 'shop-a');
  assert.deepEqual(fixture.calls, [['from', 'tenants'], ['in', 'domain', ['shop-a.test', 'www.shop-a.test']]]);
});

test('missing or mismatched shops reject before saving instead of using master', async () => {
  for (const tenant of [null, { id: 'other-shop', domain: 'different.test' }]) {
    const fixture = tenantReader(tenant);
    await assert.rejects(resolveDesignerSaveTenant(fixture.client, context));
    assert.equal(fixture.calls.filter(call => call[0] === 'from').length, 1);
  }
  await assert.rejects(resolveDesignerSaveTenant(tenantReader({ id: 'shop-a', domain: 'shop-a.test' }).client,
    { ...context, documentTenantId: 'shop-b' }), /anden butik/);
});

test('embedded Designer requires its explicitly selected shop and rejects cross-shop documents', async () => {
  const fixture = tenantReader({ id: 'shop-a', domain: 'shop-a.test' });
  await assert.rejects(resolveDesignerSaveTenant(fixture.client, { ...context, embedded: true }), /Vælg en butik/);
  assert.equal(fixture.calls.length, 0);
  assert.equal(await resolveDesignerSaveTenant(fixture.client, { ...context, embedded: true, queryTenantId: 'shop-a' }), 'shop-a');
  await assert.rejects(resolveDesignerSaveTenant(fixture.client, { ...context, embedded: true, queryTenantId: 'shop-a', documentTenantId: 'shop-b' }), /anden butik/);
});

test('product lookup is constrained to the resolved shop', async () => {
  const fixture = tenantReader({ id: 'shop-a', domain: 'shop-a.test' }, { id: 'product-a', tenant_id: 'shop-a' });
  assert.equal(await resolveDesignerSaveTenant(fixture.client, { ...context, productId: 'product-a' }), 'shop-a');
  assert.deepEqual(fixture.calls.slice(-3), [['from', 'products'], ['eq', 'id', 'product-a'], ['eq', 'tenant_id', 'shop-a']]);
  await assert.rejects(resolveDesignerSaveTenant(tenantReader({ id: 'shop-a', domain: 'shop-a.test' }, null).client,
    { ...context, productId: 'product-b' }), /Produktet/);
});

test('a single-page vector PDF keeps its exact source bytes after database JSON transport', () => {
  const bytes = Uint8Array.from([37, 80, 68, 70, 0, 127, 128, 255]);
  const snapshot = { objects: [{ type: 'image', data: { kind: 'pdf_page_background', originalPdfBytes: bytes.buffer, pageIndex: 2 } },
    { type: 'i-text', text: 'Kundens ændringer', left: 32, top: 47 }] };
  const encoded = encodeDesignerSnapshot(snapshot);
  assert.notDeepEqual((encoded as { objects: { data: { originalPdfBytes: unknown } }[] }).objects[0].data.originalPdfBytes, {});
  const reloaded = decodeDesignerSnapshot(JSON.parse(JSON.stringify(encoded))) as typeof snapshot;
  assert.deepEqual(new Uint8Array(reloaded.objects[0].data!.originalPdfBytes), bytes);
  assert.equal(reloaded.objects[0].data!.pageIndex, 2);
  assert.deepEqual(reloaded.objects[1], snapshot.objects[1]);
  assert.equal(snapshot.objects[0].data!.originalPdfBytes, bytes.buffer);
});

test('a real vector PDF remains parseable with identical bytes after save and reopen', async () => {
  const document = await PDFDocument.create();
  document.addPage([200, 300]).drawText('Vector artwork kept', { x: 20, y: 200 });
  const original = await document.save();
  const snapshot = { objects: [{ data: { kind: 'pdf_page_background', originalPdfBytes: original, pageIndex: 0 } }] };
  const restored = decodeDesignerSnapshot(JSON.parse(JSON.stringify(encodeDesignerSnapshot(snapshot)))) as { objects: { data: { originalPdfBytes: ArrayBuffer } }[] };
  const bytes = restored.objects[0].data.originalPdfBytes;
  assert.deepEqual(new Uint8Array(bytes), original);
  const reopened = await PDFDocument.load(bytes);
  assert.equal(reopened.getPageCount(), 1);
  assert.deepEqual(reopened.getPage(0).getSize(), { width: 200, height: 300 });
});

test('binary snapshot transport handles large buffers, grouped objects and sliced views without extra bytes', () => {
  const bytes = Uint8Array.from({ length: 90000 }, (_, index) => index % 256);
  const source = { objects: [{ objects: [{ data: { originalPdfBytes: bytes.subarray(17, 80000) } }] }] };
  const roundTrip = decodeDesignerSnapshot(JSON.parse(JSON.stringify(encodeDesignerSnapshot(source)))) as { objects: { objects: { data: { originalPdfBytes: ArrayBuffer } }[] }[] };
  assert.deepEqual(new Uint8Array(roundTrip.objects[0].objects[0].data.originalPdfBytes), bytes.subarray(17, 80000));
});

test('ordinary saved designs and existing in-memory PDF snapshots remain readable', () => {
  const text = { objects: [{ type: 'i-text', text: 'Existing design' }] };
  assert.deepEqual(decodeDesignerSnapshot(text), text);
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  assert.deepEqual(new Uint8Array((decodeDesignerSnapshot({ bytes }) as { bytes: ArrayBuffer }).bytes), new Uint8Array(bytes));
});

test('unsupported multi-page and multi-side design saves stop before an incomplete save can be claimed', () => {
  assert.doesNotThrow(() => assertDesignerDocumentSaveSupported(1, 1));
  assert.throws(() => assertDesignerDocumentSaveSupported(2, 0), /Behold fanen åben/);
  assert.throws(() => assertDesignerDocumentSaveSupported(0, 2), /produktionsfilerne/);
});
