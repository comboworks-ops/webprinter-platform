import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

// Run the actual hook with a small React lifecycle harness and no network client.
let harness;
registerHooks({
  resolve(specifier, context, next) {
    const modules = {
      react: 'export const {useState,useEffect,useRef}=globalThis.__roleTestReact;',
      '@/integrations/supabase/client': 'export const supabase=globalThis.__roleTestClient;',
      '@/lib/adminTenant': 'export const MASTER_TENANT_ID="master"; export const resolveAdminTenant=()=>globalThis.__roleTestTenant();',
    };
    if (modules[specifier]) return { url: `data:text/javascript,${encodeURIComponent(modules[specifier])}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/useUserRole.tsx')) {
      const source = readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env.DEV', 'true');
      return { format: 'module', source: stripTypeScriptTypes(source), shortCircuit: true };
    }
    return next(url, context);
  },
});
globalThis.__roleTestReact = {
  useState(initial) {
    const index = harness.cursor++;
    if (!(index in harness.state)) harness.state[index] = initial;
    const owner = harness;
    return [owner.state[index], value => { owner.state[index] = value; }];
  },
  useRef(initial) { return harness.ref ||= { current: initial }; },
  useEffect(effect) { if (!harness.mounted) harness.effect = effect; },
};
globalThis.__roleTestClient = {
  auth: {
    getSession: async () => ({ data: { session: harness.user ? { user: harness.user } : null } }),
    getUser: async () => ({ data: { user: harness.user } }),
    onAuthStateChange(callback) { harness.authChanged = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  functions: { invoke: async () => ({ data: harness.verify ? await harness.verify() : harness.verification }) },
  from(table) {
    if (table === 'user_roles') return { select: () => ({ eq: async () => ({ data: harness.roles.map(role => ({ role })), error: harness.roleError }) }) };
    if (table === 'tenants') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: harness.owned ? { id: harness.tenant } : null }) }) }) };
    throw new Error(`Unexpected table ${table}`);
  },
};
globalThis.__roleTestTenant = async () => ({ tenantId: harness.tenant });
const { useUserRole } = await import('./useUserRole.tsx');
function mount({ verification, roles = [], tenant = 'master', roleError = null, email = 'operator@example.test', owned = false, user = { id: 'user-1', email }, verify }) {
  harness = { cursor: 0, state: [], mounted: false, user, verification, roles, tenant, roleError, owned, verify };
  useUserRole();
  harness.mounted = true;
  return harness.effect();
}
function render() { harness.cursor = 0; return useUserRole(); }
async function run(options) {
  const cleanup = mount(options);
  await new Promise(resolve => setTimeout(resolve, 20));
  const result = render();
  cleanup();
  return result;
}

test('legacy verify-admin response does not hide a database master role', async () => {
  const result = await run({ verification: { isAdmin: true, userId: 'user-1' }, roles: ['master_admin', 'admin'] });
  assert.equal(result.isMasterAdmin, true);
  assert.equal(result.loading, false);
});
test('legacy response and a normal admin role never grant master access', async () => {
  const result = await run({ verification: { isAdmin: true }, roles: ['admin'] });
  assert.equal(result.isAdmin, true);
  assert.equal(result.isMasterAdmin, false);
});
test('explicit modern ordinary-admin response stays ordinary admin', async () => {
  const result = await run({ verification: { isAdmin: true, isMasterAdmin: false }, roles: ['master_admin'] });
  assert.equal(result.isMasterAdmin, false);
});
test('a verified master viewing a tenant remains in tenant mode', async () => {
  const result = await run({ verification: { isAdmin: true, isMasterAdmin: true }, tenant: 'shop-a' });
  assert.equal(result.isAdmin, true);
  assert.equal(result.isMasterAdmin, false);
});
test('an unresolved tenant context cannot open master tools', async () => {
  const result = await run({ verification: { isAdmin: true, isMasterAdmin: true }, tenant: null });
  assert.equal(result.isMasterAdmin, false);
});
test('known operator email on localhost is not evidence of a role', async () => {
  const result = await run({ verification: { isAdmin: false }, email: 'admin@webprinter.dk' });
  assert.equal(result.isAdmin, false);
  assert.equal(result.isMasterAdmin, false);
});
test('failed direct role lookup cannot infer master from a legacy response', async () => {
  const result = await run({ verification: { isAdmin: true }, roleError: { message: 'denied' } });
  assert.equal(result.isMasterAdmin, false);
});
test('tenant ownership uses the same verified admin path as stored admin roles', async () => {
  const result = await run({ verification: { isAdmin: false }, owned: true, tenant: 'shop-a' });
  assert.equal(result.isAdmin, true);
  assert.equal(result.userId, 'user-1');
});
for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION']) {
  test(`${event} for the current administrator keeps the editor mounted during re-verification`, async () => {
    const cleanup = mount({ verification: { isAdmin: true, isMasterAdmin: false } });
    try {
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(render().isAdmin, true);
      let finish;
      harness.verify = () => new Promise(resolve => { finish = resolve; });
      harness.authChanged(event, { user: harness.user });
      assert.equal(render().loading, false, 'routine session events must not replace the editor with a spinner');
      assert.equal(render().isAdmin, true);
      assert.equal(render().userId, 'user-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(typeof finish, 'function', 'permissions are still re-verified');
      harness.roles = ['user'];
      finish({ isAdmin: false });
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(render().isAdmin, false, 'a new denial must still revoke admin access');
      assert.equal(render().loading, false);
    } finally { cleanup(); }
  });
}
test('repeated preview-session notifications keep both editor and dashboard mounted', async () => {
  let verifications = 0;
  const cleanup = mount({ tenant: 'shop-a', verify: async () => {
    verifications++;
    return { isAdmin: true, isMasterAdmin: true };
  } });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    for (let count = 0; count < 8; count++) {
      harness.authChanged('SIGNED_IN', { user: harness.user });
      const pending = render();
      assert.equal(pending.loading, false, 'a shared-session notification must not remove the admin subtree');
      assert.equal(pending.isAdmin, true);
      await new Promise(resolve => setTimeout(resolve, 20));
      const verified = render();
      assert.equal(verified.loading, false);
      assert.equal(verified.isAdmin, true);
      assert.equal(verified.isMasterAdmin, false, 'tenant masking remains intact');
    }
    assert.equal(verifications, 9, 'each notification still re-verifies permissions');
  } finally { cleanup(); }
});
test('signing out during background verification invalidates its unfinished admin response', async () => {
  const cleanup = mount({ verification: { isAdmin: true, isMasterAdmin: false } });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    let finish;
    harness.verify = () => new Promise(resolve => { finish = resolve; });
    harness.authChanged('TOKEN_REFRESHED', { user: harness.user });
    await new Promise(resolve => setTimeout(resolve, 10));
    harness.user = null;
    harness.authChanged('SIGNED_OUT', null);
    assert.equal(render().isAdmin, false);
    assert.equal(render().loading, true);
    finish({ isAdmin: true, isMasterAdmin: true });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(render().isAdmin, false);
    assert.equal(render().userId, null);
  } finally { cleanup(); }
});
test('user-update events still clear access immediately even for the same account', async () => {
  const cleanup = mount({ verification: { isAdmin: true, isMasterAdmin: false } });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    harness.authChanged('USER_UPDATED', { user: harness.user });
    assert.equal(render().isAdmin, false);
    assert.equal(render().loading, true);
  } finally { cleanup(); }
});
test('switching from admin to customer clears access before the next role lookup', async () => {
  const cleanup = mount({ verification: { isAdmin: true, isMasterAdmin: false } });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(render().isAdmin, true);
    harness.user = { id: 'customer-2' };
    harness.verification = { isAdmin: false };
    harness.roles = ['user'];
    harness.authChanged('SIGNED_IN', { user: harness.user });
    assert.equal(render().loading, true);
    assert.equal(render().isAdmin, false);
    assert.equal(render().userId, null);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(render().isAdmin, false);
    assert.equal(render().loading, false);
    assert.equal(render().userId, 'customer-2');
  } finally { cleanup(); }
});
test('signing out invalidates an unfinished admin response', async () => {
  let finish;
  const cleanup = mount({ verify: () => new Promise(resolve => { finish = resolve; }) });
  try {
    await new Promise(resolve => setTimeout(resolve, 10));
    harness.user = null;
    harness.authChanged('SIGNED_OUT', null);
    finish({ isAdmin: true, isMasterAdmin: true });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(render().isAdmin, false);
    assert.equal(render().isMasterAdmin, false);
    assert.equal(render().userId, null);
    assert.equal(render().loading, false);
  } finally { cleanup(); }
});
