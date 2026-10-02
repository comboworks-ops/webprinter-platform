import test from 'node:test';
import assert from 'node:assert/strict';
import { persistStorformatValueGroups } from './storformatVisualGroups.ts';
import type { SelectorValueGroupConfig } from './selectorValueGroups';

const groups: SelectorValueGroupConfig[] = [{ id: 'special', label: 'Særlige former', valueIds: ['heart'], collapsible: true, initiallyExpanded: false, uiMode: 'large' }];
type Rows = Array<{ id: string; sections: Array<{
    id: string; valueIds: string[]; valueSettings: { heart: { customImage: string } };
    value_groups?: Array<{ id: string }>; valueGroups?: SelectorValueGroupConfig[];
}> }>;
type Result = { data: { id: string; layout_rows: Rows } | null; error: Error | null };

function database() {
    const state = {
        rows: [{ id: 'row', sections: [{ id: 'shape', valueIds: ['rectangle', 'heart'], valueSettings: { heart: { customImage: 'saved.png' } }, value_groups: [{ id: 'old' }] }] }] as Rows,
        source_quote_model: { immutable: true }, quantities: [1, 10], is_published: false,
        conflict: false, writes: 0, missing: false, failed: false,
    };
    const client = { from(table: string) {
        assert.equal(table, 'storformat_configs');
        let patch: { layout_rows: Rows } | undefined;
        const filters = new Map<string, unknown>();
        const execute = (): Result => {
            assert.equal(filters.get('tenant_id'), 'shop');
            assert.equal(filters.get('product_id'), 'product');
            if (state.failed) return { data: null, error: new Error('Denied') };
            if (state.missing) return { data: null, error: null };
            if (patch && state.conflict) {
                state.conflict = false;
                state.rows[0].sections[0].valueSettings.heart.customImage = 'newer.png';
                return { data: null, error: null };
            }
            if (patch) {
                assert.equal(filters.get('id'), 'config');
                assert.equal(filters.get('layout_rows'), JSON.stringify(state.rows));
                state.rows = structuredClone(patch.layout_rows);
                state.writes++;
            }
            return { data: { id: 'config', layout_rows: structuredClone(state.rows) }, error: null };
        };
        const q = {
            select() { return q; }, single() { return q; }, maybeSingle() { return q; },
            eq(key: string, value: unknown) { filters.set(key, value); return q; },
            update(value: { layout_rows: Rows }) { assert.deepEqual(Object.keys(value), ['layout_rows']); patch = value; return q; },
            then: (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
        };
        return q;
    } } as unknown as Parameters<typeof persistStorformatValueGroups>[0];
    return { state, client };
}

test('group save changes only layout metadata and retains pricing/publication and pictures', async () => {
    const { state, client } = database();
    await persistStorformatValueGroups(client, 'shop', 'product', 'shape', groups);
    const section = state.rows[0].sections[0];
    assert.deepEqual(section.valueGroups, groups);
    assert.equal(section.value_groups, undefined);
    assert.equal(section.valueSettings.heart.customImage, 'saved.png');
    assert.deepEqual(state.source_quote_model, { immutable: true });
    assert.deepEqual(state.quantities, [1, 10]);
    assert.equal(state.is_published, false);
});
test('concurrent picture edit is rebased before saving groups', async () => {
    const { state, client } = database();
    state.conflict = true;
    await persistStorformatValueGroups(client, 'shop', 'product', 'shape', groups);
    assert.equal(state.rows[0].sections[0].valueSettings.heart.customImage, 'newer.png');
    assert.equal(state.writes, 1);
});
test('foreign or duplicate group membership rejects before a write', async () => {
    for (const invalid of [[{ ...groups[0], valueIds: ['removed'] }], [...groups, { ...groups[0], id: 'duplicate' }]]) {
        const { state, client } = database();
        await assert.rejects(persistStorformatValueGroups(client, 'shop', 'product', 'shape', invalid));
        assert.equal(state.writes, 0);
    }
});
test('missing configuration, section or denied save cannot report success', async () => {
    for (const failure of ['missing', 'failed', 'section'] as const) {
        const { state, client } = database();
        if (failure !== 'section') state[failure] = true;
        await assert.rejects(persistStorformatValueGroups(client, 'shop', 'product', failure === 'section' ? 'removed' : 'shape', groups));
        assert.equal(state.writes, 0);
    }
});
