import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

let denied = false, zeroRows = false;
const queries: Array<{ table: string; field?: string; value?: unknown }> = [];
const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'master-1' } }, error: null }) },
    from(table: string) {
        const query: { table: string; field?: string; value?: unknown } = { table }; queries.push(query);
        return {
            select() { return this; },
            eq(field: string, value: unknown) { Object.assign(query, { field, value }); return this; },
            in(field: string, value: unknown) { Object.assign(query, { field, value }); return this; },
            order() { return this; },
            upsert(value: unknown, options: unknown) { query.value = value; assert.deepEqual(options, { onConflict: 'tenant_id,design_id' }); return this; },
            async single() { return { data: zeroRows ? null : query.value, error: denied ? new Error('permission denied') : null }; },
            then(resolve: (value: unknown) => void) {
                resolve({ error: denied ? new Error('permission denied') : null, data: table === 'tenant_premade_designs'
                    ? [{ design_id: 'private' }, { design_id: 'visible' }]
                    : query.field === 'id' ? [{ id: 'private', is_visible: false }, { id: 'visible', is_visible: true }]
                        : [{ id: 'visible', is_visible: true }, { id: 'free', is_visible: true }] });
            },
        };
    },
};
(globalThis as Record<string, unknown>).__designLibraryTest = db;
registerHooks({ resolve(specifier, context, next) {
    return specifier === '@/integrations/supabase/client'
        ? { url: 'data:text/javascript,export const supabase=globalThis.__designLibraryTest', shortCircuit: true }
        : next(specifier, context);
} });
const { loadShopDesignLibrary, assignDesignToShop } = await import('./premadeDesignLibrary.ts');
test('assigned private templates reach only the selected shop and duplicates are removed', async () => {
    queries.length = 0;
    const library = await loadShopDesignLibrary('shop-a');
    assert.deepEqual(library.map(row => row.id), ['visible', 'free', 'private']);
    assert.equal(library.find(row => row.id === 'private')?.assignedToShop, true);
    assert.equal(library.find(row => row.id === 'free')?.assignedToShop, false);
    assert.deepEqual(queries.find(query => query.table === 'tenant_premade_designs'), { table: 'tenant_premade_designs', field: 'tenant_id', value: 'shop-a' });
});
test('failed library reads do not return an apparently empty successful library', async () => {
    denied = true;
    await assert.rejects(loadShopDesignLibrary('shop-a'), /permission denied/);
    denied = false;
});
test('assignment requires a confirmed row and reports RLS denial', async () => {
    await assignDesignToShop('shop-a', 'private');
    denied = true;
    await assert.rejects(assignDesignToShop('shop-a', 'private'), /permission denied/);
    denied = false; zeroRows = true;
    await assert.rejects(assignDesignToShop('shop-a', 'private'), /ikke bekræftet/);
    zeroRows = false;
});
test('an unresolved shop never runs a library query', async () => {
    queries.length = 0;
    await assert.rejects(loadShopDesignLibrary(''), /Vælg en shop/);
    assert.equal(queries.length, 0);
});
