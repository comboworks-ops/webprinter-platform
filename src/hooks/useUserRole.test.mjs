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
  functions: { invoke: async () => ({ data: harness.verification }) },
  from(table) {
    if (table === 'user_roles') return { select: () => ({ eq: async () => ({ data: harness.roles.map(role => ({ role })), error: harness.roleError }) }) };
    if (table === 'tenants') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    throw new Error(`Unexpected table ${table}`);
  },
};
globalThis.__roleTestTenant = async () => ({ tenantId: harness.tenant });
const { useUserRole } = await import('./useUserRole.tsx');
async function run({ verification, roles = [], tenant = 'master', roleError = null, email = 'operator@example.test' }) {
  harness = { cursor: 0, state: [], mounted: false, user: { id: 'user-1', email }, verification, roles, tenant, roleError };
  useUserRole();
  harness.mounted = true;
  const cleanup = harness.effect();
  await new Promise(resolve => setTimeout(resolve, 20));
  harness.cursor = 0;
  const result = useUserRole();
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
