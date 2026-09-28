import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

let pending = [], cursor = 0, writes = 0;
globalThis.__paidTestReact = {
  useState(value) { const index = cursor++; return [index === 0 ? pending : value, () => {}]; },
  useEffect() {},
  useCallback(fn) { return fn; },
};
globalThis.__paidTestClient = { from() { writes++; throw new Error('Unexpected database access'); } };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'data:text/javascript,export const {useState,useEffect,useCallback}=globalThis.__paidTestReact', shortCircuit: true };
    if (specifier === '@/integrations/supabase/client') return { url: 'data:text/javascript,export const supabase=globalThis.__paidTestClient', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/usePaidItems.ts')) return { format: 'module-typescript', source: readFileSync(new URL(url), 'utf8').replace('import.meta.env.DEV', 'false'), shortCircuit: true };
    return next(url, context);
  },
});
const { usePaidItems } = await import('./usePaidItems.ts');
for (const tenant of ['shop-a', null]) {
  test(`unconnected paid-design checkout never reports payment or writes purchases (${tenant})`, async () => {
    pending = [{ id: 'pending-1', type: 'premade_design', itemId: 'design-1', name: 'Test design', price: 500 }];
    cursor = 0; writes = 0;
    assert.equal(await usePaidItems(tenant).processPurchase(), false);
    assert.equal(writes, 0);
  });
}
test('empty paid-design checkout cannot claim a successful payment', async () => {
  pending = []; cursor = 0; writes = 0;
  assert.equal(await usePaidItems('shop-a').processPurchase(), false);
  assert.equal(writes, 0);
});
