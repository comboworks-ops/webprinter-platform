import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { handleStorefrontStatusEmail, type StatusEmailOrder, type StatusEmailRepository } from './storefrontStatusEmail.ts';
import type { StorefrontEmailConfig } from './storefrontOrderEmail.ts';

const S = '11111111-1111-4111-8111-111111111111';
const T = '22222222-2222-4222-8222-222222222222';
const O = '33333333-3333-4333-8333-333333333333';
const A = '44444444-4444-4444-8444-444444444444';
const OWNER = '55555555-5555-4555-8555-555555555555';
const CUSTOMER = '66666666-6666-4666-8666-666666666666';
const config: StorefrontEmailConfig = { mode: 'test', apiKey: 'synthetic-key', from: 'Test Shop <sender@example.test>', siteUrl: 'https://staging.example.test', allowlist: ['customer@example.test'] };
const identity = { type: 'status_change', order_id: O, tenant_id: S };
function fixture() {
  const order: StatusEmailOrder = {
    id: O, tenant_id: S, checkout_attempt_id: A, order_number: 'TEST-1', product_name: '<img src=x onerror="alert(1)">',
    quantity: 2, total_price: 125, currency: 'DKK', status: 'shipped', customer_email: 'Customer@example.test',
    customer_name: '<script>customer</script>', tracking_number: '<b>tracking</b>', estimated_delivery: '2026-09-10',
    has_problem: false, problem_description: null, user_id: CUSTOMER,
  };
  const state = {
    user: { id: OWNER } as { id: string } | null,
    roles: [] as Array<{ role: string; tenant_id: string | null }>, order,
    tenant: { id: S, owner_id: OWNER as string | null, name: 'Saved Shop', settings: { company: { name: '<script>shop</script>', email: 'support@example.test' } } },
    attempt: { id: A, order_id: O, tenant_id: S, state: 'completed', livemode: false },
    calls: [] as unknown[][],
    sent: [] as Array<{ url: string; headers: Headers; payload: Record<string, unknown> }>,
    providerStatus: 200, providerBody: { id: 'synthetic_provider_id' } as unknown,
  };
  const repository: StatusEmailRepository = {
    async getUser(token) { state.calls.push(['getUser', token]); return state.user; },
    async getTenant(id) { state.calls.push(['getTenant', id]); return state.tenant; },
    async getRoles(id) { state.calls.push(['getRoles', id]); return state.roles; },
    async getOrder(id, tenantId) { state.calls.push(['getOrder', id, tenantId]); return state.order; },
    async getAttempt(id, orderId, tenantId) { state.calls.push(['getAttempt', id, orderId, tenantId]); return state.attempt; },
  };
  const fetcher: typeof fetch = async (url, options) => {
    state.sent.push({ url: String(url), headers: new Headers(options?.headers), payload: JSON.parse(String(options?.body)) });
    return new Response(JSON.stringify(state.providerBody), { status: state.providerStatus });
  };
  const send = (body: unknown = identity, options: Partial<StorefrontEmailConfig> = {}, authorization: string | null = 'Bearer synthetic-user-token') => handleStorefrontStatusEmail(new Request('https://fixture.invalid/functions/v1/send-order-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body),
  }), repository, { ...config, ...options }, fetcher);
  return { state, repository, send };
}
async function expectDenied(response: Response, status: number, code: string) {
  assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: code });
  assert.equal(response.headers.get('cache-control'), 'no-store');
}

test('anon app keys and missing authorization cannot send status mail', async () => {
  const { state, send } = fixture();
  await expectDenied(await send(identity, {}, null), 401, 'unauthorized');
  assert.equal(state.calls.length, 0);
  state.user = null;
  await expectDenied(await send(identity, {}, 'Bearer synthetic-anon-app-key'), 401, 'unauthorized');
  assert.deepEqual(state.calls.map(call => call[0]), ['getUser']);
  assert.equal(state.sent.length, 0);
});

test('customers and other-shop admins/staff cannot reach order content or provider', async () => {
  for (const role of [null, 'admin', 'staff']) {
    const { state, send } = fixture(); state.user = { id: CUSTOMER };
    state.roles = role ? [{ role, tenant_id: T }] : [];
    await expectDenied(await send(), 403, 'forbidden');
    assert.equal(state.calls.some(call => call[0] === 'getOrder'), false);
    assert.equal(state.sent.length, 0);
  }
});

test('owner, scoped admin/staff and master_admin can request only trusted saved data', async () => {
  for (const role of ['owner', 'admin', 'staff', 'master_admin']) {
    const { state, send } = fixture();
    if (role !== 'owner') { state.user = { id: CUSTOMER }; state.roles = [{ role, tenant_id: role === 'master_admin' ? T : S }]; }
    const response = await send({ ...identity, recipient: { email: 'attacker@example.test' }, customer: { email: 'attacker@example.test' }, order: { status: 'cancelled' }, shop: { orderUrl: 'https://attacker.invalid', name: 'Forged shop' } });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true, accepted: true });
    assert.deepEqual(state.calls.find(call => call[0] === 'getOrder'), ['getOrder', O, S]);
    assert.deepEqual(state.calls.find(call => call[0] === 'getAttempt'), ['getAttempt', A, O, S]);
    const { payload, url } = state.sent[0];
    assert.equal(url, 'https://api.resend.com/emails');
    assert.deepEqual(payload.to, ['customer@example.test']); assert.equal(payload.reply_to, 'support@example.test');
    assert.equal(payload.subject, 'Ordre TEST-1 - Afsendt');
    const html = String(payload.html);
    assert.match(html, /&lt;script&gt;shop&lt;\/script&gt;/); assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(html, /&lt;b&gt;tracking&lt;\/b&gt;/); assert.doesNotMatch(html, /<script>|<img src|attacker|Forged/);
    assert.match(html, new RegExp(`https://staging.example.test/min-konto/ordrer\\?tenantId=${S}&amp;order=${O}`));
  }
});

test('order and attempt identities are checked even if repository returns unexpected rows', async () => {
  for (const mismatch of ['order', 'tenant', 'attempt', 'attemptTenant', 'attemptOrder', 'attemptState']) {
    const { state, send } = fixture();
    if (mismatch === 'order') state.order.id = A;
    if (mismatch === 'tenant') state.order.tenant_id = T;
    if (mismatch === 'attempt') state.attempt.id = O;
    if (mismatch === 'attemptTenant') state.attempt.tenant_id = T;
    if (mismatch === 'attemptOrder') state.attempt.order_id = A;
    if (mismatch === 'attemptState') state.attempt.state = 'prepared';
    const response = await send(); assert.equal(response.status, mismatch === 'order' || mismatch === 'tenant' ? 403 : 409);
    assert.equal(state.sent.length, 0);
  }
});

test('legacy confirmation/admin messages cannot bypass durable checkout notifications', async () => {
  const { state, send } = fixture();
  for (const type of ['order_confirmation', 'admin_new_order']) await expectDenied(await send({ type, customer: { email: 'attacker@example.test' } }, {}, null), 409, 'use_durable_checkout_notifications');
  assert.equal(state.calls.length, 0); assert.equal(state.sent.length, 0);
});

test('disabled, wrong payment mode, incomplete attempts and test legacy orders never send', async () => {
  const disabled = fixture(); await expectDenied(await disabled.send(identity, { mode: 'disabled' }), 409, 'email_dispatch_disabled');
  const liveAttempt = fixture(); liveAttempt.state.attempt.livemode = true; await expectDenied(await liveAttempt.send(), 409, 'email_mode_mismatch');
  const testAttempt = fixture(); await expectDenied(await testAttempt.send(identity, { mode: 'live' }), 409, 'email_mode_mismatch');
  const legacy = fixture(); legacy.state.order.checkout_attempt_id = null; await expectDenied(await legacy.send(), 409, 'email_mode_mismatch');
  for (const scenario of [disabled, liveAttempt, testAttempt, legacy]) assert.equal(scenario.state.sent.length, 0);
  assert.equal((await legacy.send(identity, { mode: 'live' })).status, 200, 'Explicitly authorized live operator may notify a legacy saved order.');
});

test('recipient allowlist and verified HTTPS site configuration apply to manual messages', async () => {
  for (const options of [{ allowlist: [] }, { siteUrl: 'http://staging.example.test' }, { from: 'Bad\r\nBcc: attacker@example.test' }]) {
    const { state, send } = fixture(); await expectDenied(await send(identity, options), 503, 'email_dispatch_not_configured'); assert.equal(state.sent.length, 0);
  }
  const { state, send } = fixture();
  await expectDenied(await send(identity, { allowlist: ['someoneelse@example.test'] }), 409, 'recipient_not_allowed');
  state.order.customer_email = 'customer@example.test\r\nBcc: attacker@example.test';
  await expectDenied(await send(), 409, 'recipient_not_allowed'); assert.equal(state.sent.length, 0);
});

test('problem messages require saved problem state and escape saved problem content', async () => {
  const { state, send } = fixture(); const request = { ...identity, type: 'problem_notification', problem_description: 'forged' };
  await expectDenied(await send(request), 409, 'saved_order_not_emailable');
  state.order.has_problem = true; state.order.problem_description = '<a href="https://attacker.invalid">Saved issue</a>';
  assert.equal((await send(request)).status, 200);
  assert.match(String(state.sent[0].payload.html), /&lt;a href=&quot;https:\/\/attacker.invalid&quot;&gt;Saved issue&lt;\/a&gt;/);
  assert.doesNotMatch(String(state.sent[0].payload.html), /forged/);
});

test('unsafe subject and unknown stored status do not reach provider', async () => {
  for (const mutation of [{ order_number: 'TEST\r\nBcc: attacker@example.test' }, { status: '__proto__' }, { order_number: 'x'.repeat(101) }]) {
    const { state, send } = fixture(); Object.assign(state.order, mutation);
    await expectDenied(await send(), 409, 'saved_order_not_emailable'); assert.equal(state.sent.length, 0);
  }
});

test('identical manual payloads reuse provider key; changed saved status has a new key', async () => {
  const { state, send } = fixture();
  await send(); await send({ ...identity, recipient: 'ignored@example.test' });
  assert.deepEqual(state.sent[0].payload, state.sent[1].payload);
  assert.equal(state.sent[0].headers.get('Idempotency-Key'), state.sent[1].headers.get('Idempotency-Key'));
  state.order.status = 'delivered'; await send();
  assert.notEqual(state.sent[0].headers.get('Idempotency-Key'), state.sent[2].headers.get('Idempotency-Key'));
});

test('provider errors and missing provider identity never return successful acceptance', async () => {
  const { state, send, repository } = fixture();
  state.providerStatus = 500; await expectDenied(await send(), 503, 'email_provider_unconfirmed');
  state.providerStatus = 200; state.providerBody = {}; await expectDenied(await send(), 503, 'email_provider_unconfirmed');
  repository.getRoles = async () => { throw new Error('private backend failure'); };
  await expectDenied(await send(), 503, 'email_temporarily_unavailable'); assert.equal(state.sent.length, 2);
});

test('browser helpers forward only identity/type, reject legacy confirmation calls and require verified provider acceptance', async () => {
  const calls: unknown[] = []; let result: unknown = { success: true, accepted: true };
  const runtime = globalThis as unknown as Record<string, unknown>;
  runtime.__statusEmailInvoke = async (name: string, options: unknown) => { calls.push([name, options]); return { data: result, error: null }; };
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@/integrations/supabase/client') return { url: 'data:text/javascript,export const supabase={functions:{invoke:(...args)=>globalThis.__statusEmailInvoke(...args)}}', shortCircuit: true };
    return next(specifier, context);
  } });
  try {
    const service = await import('../../../src/lib/emailService.ts');
    const request = { id: O, tenant_id: S, customer_email: 'attacker@example.test', shop: { orderUrl: 'https://attacker.invalid' } };
    assert.equal(await service.sendStatusChangeEmail(request), true);
    assert.deepEqual(calls[0], ['send-order-email', { body: identity }]);
    assert.equal(await service.sendOrderConfirmation(request), false); assert.equal(await service.sendAdminNewOrderNotification(request), false); assert.equal(calls.length, 1);
    for (const invalid of [{ success: true }, { accepted: true }, { success: false, accepted: true }, null]) { result = invalid; assert.equal(await service.sendProblemNotification(request), false); }
  } finally { hooks.deregister(); delete runtime.__statusEmailInvoke; }
});
