import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizedEmailDispatcher, buildStorefrontEmail, dispatchStorefrontOrderEmails, validateEmailConfig, validEmailSiteUrl, type EmailRepository, type EmailStatus, type StorefrontEmailConfig, type StorefrontEmailRow } from './storefrontOrderEmail.ts';

const config: StorefrontEmailConfig = { mode: 'test', apiKey: 'synthetic-test-key', from: 'Print <receipts@example.test>', siteUrl: 'https://staging.example.test', allowlist: ['customer@example.test'] };
function fixture(overrides: Partial<StorefrontEmailRow> = {}): StorefrontEmailRow {
  const order = '11111111-1111-4111-8111-111111111111', tenant = '22222222-2222-4222-8222-222222222222';
  return { id: '33333333-3333-4333-8333-333333333333', attempt_id: '44444444-4444-4444-8444-444444444444', order_id: order, tenant_id: tenant,
    notification_type: 'customer_confirmation', recipient_email: 'customer@example.test', livemode: false, provider_payload: null,
    claim_token: '55555555-5555-4555-8555-555555555555', attempts: 1, first_attempt_at: new Date().toISOString(),
    message_snapshot: { version: 1, order_id: order, tenant_id: tenant, order_number: 'WP-123', customer_name: 'Test customer', customer_email: 'customer@example.test',
      product_name: 'Test print', quantity: 25, total_price: 123.45, currency: 'DKK', delivery_type: 'Standard', delivery_summary: 'Testvej 1, 2. th., 5000 Odense, DE', shop_name: 'Shop A', support_email: 'shop@example.test', has_customer_account: true }, ...overrides };
}
function repository(row: StorefrontEmailRow) {
  const finishes: Array<{status: EmailStatus; providerId?: string; errorCode?: string}> = [];
  const repo: EmailRepository = {
    async claim(limit, live, allowlist) { assert.equal(limit, 5); assert.equal(live, false); assert.deepEqual(allowlist, config.allowlist); return [row]; },
    async prepare(_row, payload) { row.provider_payload ??= structuredClone(payload); return structuredClone(row.provider_payload); },
    async finish(_row, status, providerId, errorCode) { finishes.push({status, providerId, errorCode}); return true; },
  };
  return {repo, finishes};
}
const mockFetch = (fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch => fn;

test('dedicated scheduler secret rejects missing, short and unrelated authorization', async () => {
  const secret = 'synthetic-scheduler-secret-32-characters';
  assert.equal(await authorizedEmailDispatcher(`Bearer ${secret}`, secret), true);
  for (const header of [null, secret, 'Bearer user-session', `Bearer ${secret}wrong`]) assert.equal(await authorizedEmailDispatcher(header, secret), false);
  assert.equal(await authorizedEmailDispatcher('Bearer short', 'short'), false);
});
test('dispatch is disabled by default; test mode needs allowlist and verified sender plus HTTPS site origin', () => {
  assert.doesNotThrow(() => validateEmailConfig(config));
  for (const change of [{mode: 'disabled'}, {allowlist: null}, {apiKey: ''}, {from: ''}, {from: 'x@example.test\nBcc: other@example.test'}, {siteUrl: ''}]) {
    assert.throws(() => validateEmailConfig({...config, ...change} as StorefrontEmailConfig));
  }
  for (const url of ['http://staging.example.test', 'https://name:secret@example.test', 'https://example.test/path', 'https://example.test/?next=live', 'https://example.test/#hash', '//example.test', 'https://example.test/\\evil']) assert.equal(validEmailSiteUrl(url), false);
  assert.equal(validEmailSiteUrl('https://staging.example.test/'), true);
  assert.doesNotThrow(() => validateEmailConfig({...config, mode: 'live', allowlist: null}));
});
test('tenant snapshot HTML is escaped; server-configured staged link retains tenant and order', () => {
  const row = fixture(); Object.assign(row.message_snapshot, {shop_name: '<script>alert(1)</script>', product_name: '<img src=x onerror=alert(1)>', delivery_summary: '2. th. & <Spain>', order_number: 'WP-123\nBcc: forged@example.test'});
  const result = buildStorefrontEmail(row, config.from, config.siteUrl);
  assert.match(String(result.html), /&lt;script&gt;/); assert.doesNotMatch(String(result.html), /<script>|<img src/);
  assert.match(String(result.html), /staging\.example\.test\/min-konto\/ordrer\?tenantId=22222222/);
  assert.match(String(result.html), /order=11111111/); assert.doesNotMatch(String(result.html), /https:\/\/webprinter\.dk/);
  assert.doesNotMatch(String(result.subject), /[\r\n]/); assert.deepEqual(result.to, ['customer@example.test']);
  assert.equal(result.reply_to, 'shop@example.test'); assert.match(String(result.text), /123,45 DKK/);
});
test('guest confirmation and operator notification avoid misleading customer account link or guessed support', () => {
  const row = fixture(); row.message_snapshot.has_customer_account = false; row.message_snapshot.support_email = null;
  const guest = buildStorefrontEmail(row, config.from, config.siteUrl);
  assert.doesNotMatch(String(guest.html), /min-konto|mailto:/); assert.equal(guest.reply_to, undefined);
  const operator = buildStorefrontEmail({...row, notification_type: 'operator_new_order', recipient_email: 'shop@example.test'}, config.from, config.siteUrl);
  assert.match(String(operator.text), /Kundens email: customer@example.test/); assert.doesNotMatch(String(operator.html), /min-konto/);
});
test('foreign tenant snapshot and invalid monetary receipt cannot be sent', () => {
  for (const change of [{tenant_id: 'other-tenant'}, {total_price: 0}, {quantity: 1.2}, {currency: 'EUR'}]) {
    const row = fixture(); Object.assign(row.message_snapshot, change);
    assert.throws(() => buildStorefrontEmail(row, config.from, config.siteUrl), /email_snapshot_invalid/);
  }
});
test('accepted provider response checkpoints acceptance, not delivered status', async () => {
  const {repo, finishes} = repository(fixture());
  const result = await dispatchStorefrontOrderEmails(repo, config, mockFetch(async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init?.redirect, 'error');
    assert.equal((init?.headers as Record<string, string>)['Idempotency-Key'], 'storefront-order-email/v1/33333333-3333-4333-8333-333333333333');
    return Response.json({id: 'provider-accepted-id'});
  }));
  assert.equal(result.sent, 1); assert.deepEqual(finishes, [{status: 'sent', providerId: 'provider-accepted-id', errorCode: undefined}]);
});
test('timeout retry keeps exact provider body and stable key despite new sender, site and template snapshot values', async () => {
  const row = fixture(), {repo, finishes} = repository(row); const calls: Array<{body: unknown; key: string}> = [];
  const first = await dispatchStorefrontOrderEmails(repo, config, mockFetch(async (_url, init) => {
    calls.push({body: init?.body, key: (init?.headers as Record<string, string>)['Idempotency-Key']}); throw new Error('simulated ambiguous provider timeout');
  }));
  assert.equal(first.pending, 1); assert.ok(row.provider_payload);
  row.attempts++; row.message_snapshot.shop_name = 'Changed after first send';
  await dispatchStorefrontOrderEmails(repo, {...config, from: 'New sender <new@example.test>', siteUrl: 'https://new.example.test'}, mockFetch(async (_url, init) => {
    calls.push({body: init?.body, key: (init?.headers as Record<string, string>)['Idempotency-Key']}); return Response.json({id: 'same-provider-id'});
  }));
  assert.deepEqual(calls[1], calls[0]); assert.deepEqual(finishes.map(item => item.status), ['pending', 'sent']);
});
test('wrong mode or disallowed recipient is never sent even when adapter returns an invalid row', async () => {
  for (const row of [fixture({livemode: true}), fixture({recipient_email: 'outsider@example.test'})]) {
    const {repo, finishes} = repository(row); let requests = 0;
    const result = await dispatchStorefrontOrderEmails(repo, config, mockFetch(async () => { requests++; return Response.json({id: 'never'}); }));
    assert.equal(requests, 0); assert.equal(result.needs_review, 1); assert.equal(finishes[0].errorCode, 'dispatch_scope_mismatch');
  }
});
test('definite first rejection stops; retry/ambiguous results stay pending; conflict requires review', async () => {
  for (const [response, expected] of [[new Response('bad', {status: 400}), 'failed'], [new Response('throttle', {status: 429}), 'pending'],
    [new Response('broken', {status: 503}), 'pending'], [new Response('invalid json', {status: 200}), 'pending'], [Response.json({}), 'pending'], [new Response('conflict', {status: 409}), 'needs_review']] as const) {
    const {repo, finishes} = repository(fixture()); await dispatchStorefrontOrderEmails(repo, config, mockFetch(async () => response)); assert.equal(finishes[0].status, expected);
  }
  const {repo, finishes} = repository(fixture({attempts: 2}));
  await dispatchStorefrontOrderEmails(repo, config, mockFetch(async () => new Response('credentials revoked after ambiguous first attempt', {status: 401})));
  assert.equal(finishes[0].status, 'needs_review');
});
test('failed provider-payload checkpoint makes no HTTP request; missing acceptance checkpoint remains unrecorded', async () => {
  const {repo, finishes} = repository(fixture()); repo.prepare = async () => { throw new Error('database unavailable'); };
  let requests = 0;
  const result = await dispatchStorefrontOrderEmails(repo, config, mockFetch(async () => { requests++; return Response.json({id: 'never'}); }));
  assert.equal(requests, 0); assert.equal(result.pending, 1); assert.equal(finishes[0].status, 'pending');
  const next = repository(fixture()); next.repo.finish = async () => { throw new Error('database down after provider accepted'); };
  const unrecorded = await dispatchStorefrontOrderEmails(next.repo, config, mockFetch(async () => Response.json({id: 'accepted-but-checkpoint-lost'})));
  assert.equal(unrecorded.unrecorded, 1); assert.equal(unrecorded.sent, 0);
});
