import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const calls = [];
const query = {
  select() { return this; },
  eq(...args) { calls.push(['eq', ...args]); return this; },
  is(...args) { calls.push(['is', ...args]); return this; },
  update() { return this; },
  single: async () => ({ data: { id: 'existing-page' }, error: null }),
};
globalThis.__seoLocaleClient = { from: () => query };
registerHooks({resolve(specifier, context, next) {
  if (specifier === '@/integrations/supabase/client') return {url:'data:text/javascript,export const supabase = globalThis.__seoLocaleClient',shortCircuit:true};
  if (specifier === '@tanstack/react-query') return {url:'data:text/javascript,export const useMutation = options => options; export const useQueryClient = () => ({}); export const useQuery = options => options;',shortCircuit:true};
  if (specifier === 'sonner') return {url:'data:text/javascript,export const toast = {};',shortCircuit:true};
  return next(specifier, context);
}});
const {useUpsertPlatformSeoPage} = await import('./hooks.ts');
for (const locale of ['da-DK', '', null, undefined]) {
  test(`SEO page lookup matches locale ${JSON.stringify(locale)} without a live request`, async () => {
    calls.length = 0;
    await useUpsertPlatformSeoPage().mutationFn({path:'/kontakt',locale});
    assert.deepEqual(calls.filter(call=>call[1]==='locale'), [locale == null ? ['is','locale',null] : ['eq','locale',locale]]);
  });
}
