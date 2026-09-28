import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_MASTER_TENANT_ID, customerShopSettings, customerShopTarget, readCustomerShop, type CustomerShopRow } from './shop.ts';

const tenant: CustomerShopRow = { id: 'shop-a', name: 'Trykkeriet', domain: 'shop.test', settings: {} };
function reader(result: { data: CustomerShopRow | null; error: Error | null }) {
  const calls: unknown[][] = [];
  const query = {
    select(...args: unknown[]) { calls.push(['select', ...args]); return query; },
    eq(...args: unknown[]) { calls.push(['eq', ...args]); return query; },
    in(...args: unknown[]) { calls.push(['in', ...args]); return query; },
    async maybeSingle() { calls.push(['maybeSingle']); return result; },
  };
  return { calls, client: { from(...args: unknown[]) { calls.push(['from', ...args]); return query; } } as unknown as SupabaseClient };
}

test('main hosts always select master independently of customer/admin ownership', () => {
  for (const host of ['webprinter.dk', 'www.webprinter.dk', 'WEBPRINTER.DK', 'localhost', '127.0.0.1', 'webprinter-platform.vercel.app']) {
    assert.deepEqual(customerShopTarget(host, ''), { kind: 'id', value: CUSTOMER_MASTER_TENANT_ID });
  }
  assert.deepEqual(customerShopTarget('www.printplatform.test', '', 'printplatform.test'), { kind: 'id', value: CUSTOMER_MASTER_TENANT_ID });
});
test('explicit storefront context wins and custom hosts have no master fallback', () => {
  assert.deepEqual(customerShopTarget('webprinter.dk', '?tenantId=shop-a'), { kind: 'id', value: 'shop-a' });
  assert.deepEqual(customerShopTarget('webprinter.dk', '?tenant_id=shop-b'), { kind: 'id', value: 'shop-b' });
  assert.deepEqual(customerShopTarget('localhost', '?force_domain=https%3A%2F%2Fwww.Shop.Test%2F'), { kind: 'domain', value: 'shop.test' });
  assert.deepEqual(customerShopTarget('localhost', '?force_domain=www.webprinter.dk'), { kind: 'id', value: CUSTOMER_MASTER_TENANT_ID });
  assert.deepEqual(customerShopTarget('www.unknown-shop.test', ''), { kind: 'domain', value: 'unknown-shop.test' });
  assert.deepEqual(customerShopTarget('webprinter.dk.evil.test', ''), { kind: 'domain', value: 'webprinter.dk.evil.test' });
});
test('tenant subdomain and established preview host resolve their exact stored shop domain', () => {
  assert.deepEqual(customerShopTarget('localhost', '?tenant_subdomain=salgsmapper'), { kind: 'domain', value: 'salgsmapper.webprinter.dk' });
  assert.deepEqual(customerShopTarget('shop-a.webprinter-platform.vercel.app', ''), { kind: 'domain', value: 'shop-a.webprinter.dk' });
});
test('empty, conflicting and malformed explicit contexts fail instead of choosing master', () => {
  for (const query of ['?tenantId=', '?tenant_id=', '?tenantId=a&tenant_id=b', '?force_domain=', '?force_domain=https://user:pass@shop.test', '?force_domain=shop.test/path', '?tenant_subdomain=', '?tenant_subdomain=bad.test']) {
    assert.throws(() => customerShopTarget('webprinter.dk', query), undefined, query);
  }
});
test('domain lookup uses only the requested public domain variants, never ownership', async () => {
  const fixture = reader({ data: tenant, error: null });
  assert.equal((await readCustomerShop(fixture.client, { kind: 'domain', value: 'shop.test' })).id, 'shop-a');
  assert.deepEqual(fixture.calls, [['from', 'tenants'], ['select', 'id, name, domain, settings, is_platform_owned'], ['in', 'domain', ['shop.test', 'www.shop.test']], ['maybeSingle']]);
});
test('missing/error/mismatched shop results stop after the requested lookup', async () => {
  for (const result of [{ data: null, error: null }, { data: null, error: new Error('network unavailable') }, { data: { ...tenant, domain: 'wrong.test' }, error: null }]) {
    const fixture = reader(result);
    await assert.rejects(readCustomerShop(fixture.client, { kind: 'domain', value: 'shop.test' }));
    assert.equal(fixture.calls.filter(call => call[0] === 'from').length, 1);
    assert.equal(fixture.calls.some(call => call.includes(CUSTOMER_MASTER_TENANT_ID)), false);
  }
  await assert.rejects(readCustomerShop(reader({ data: tenant, error: null }).client, { kind: 'id', value: 'shop-b' }));
});
test('explicit main shop still requires a real master row', async () => {
  const fixture = reader({ data: null, error: null });
  await assert.rejects(readCustomerShop(fixture.client, customerShopTarget('webprinter.dk', '')));
  assert.deepEqual(fixture.calls.find(call => call[0] === 'eq'), ['eq', 'id', CUSTOMER_MASTER_TENANT_ID]);
});
test('normalization preserves fetched identity and published branding, without inventing another shop', () => {
  const published = { header: { logoText: 'Trykkeriet' } };
  const settings = customerShopSettings({ ...tenant, settings: { branding: { published, draft: { header: { logoText: 'Draft' } } }, checkout: { enabled: true } } });
  assert.equal(settings.id, 'shop-a');
  assert.equal(settings.domain, 'shop.test');
  assert.equal(settings.branding, published);
  assert.deepEqual(settings.checkout, { enabled: true });
});

test('account pages never display unpublished drafts and retain legacy publications', () => {
  const draft = { header: { logoText: 'Private draft' } };
  assert.equal(customerShopSettings({ ...tenant, settings: { branding: { draft } } }).branding, undefined);
  assert.equal(customerShopSettings({ ...tenant, settings: { branding: { published: null, draft } } }).branding, undefined);
  const legacy = { header: { logoText: 'Published legacy' } };
  assert.deepEqual(customerShopSettings({ ...tenant, settings: { branding: legacy } }).branding, legacy);
  assert.deepEqual(customerShopSettings({ ...tenant, settings: { branding_published: legacy, branding_draft: draft } }).branding, legacy);
});
