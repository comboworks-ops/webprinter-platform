import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Exercise the real adapters/branding defaults while replacing only their network client.
// No environment files, credentials, live requests or browser storage are used.
const clientKey = '__brandingAdapterTestClient';
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '@/integrations/supabase/client') {
            return { url: `data:text/javascript,export const supabase = globalThis.${clientKey}`, shortCircuit: true };
        }
        const candidate = specifier.startsWith('@/')
            ? new URL(`../../${specifier.slice(2)}`, import.meta.url)
            : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
                ? new URL(specifier, context.parentURL) : null;
        if (candidate && !existsSync(candidate) && existsSync(`${fileURLToPath(candidate)}.ts`)) {
            return nextResolve(pathToFileURL(`${fileURLToPath(candidate)}.ts`).href, context);
        }
        return nextResolve(specifier, context);
    },
});

type Settings = Record<string, any>;
let active: ReturnType<typeof database>;
(globalThis as any)[clientKey] = {
    from: (table: string) => active.client.from(table),
    rpc: (...args: Parameters<ReturnType<typeof database>['client']['rpc']>) => active.client.rpc(...args),
};
const { createTenantAdapter } = await import('./tenant-adapter.ts');
const { createMasterAdapter } = await import('./master-adapter.ts');
const { extractPublishedBranding } = await import('./settings-persistence.ts');
const masterId = '00000000-0000-0000-0000-000000000000';

function database(settings: Settings | null, id = 'shop-a') {
    const state = { settings: structuredClone(settings), id, writes: 0, zeroRows: false, readFailure: false,
        concurrent: null as null | ((settings: Settings) => Settings), updateFailure: false };
    const client = {
    rpc(name: string, args: { p_tenant_id: string; p_expected_settings: unknown; p_branding_patch: Settings }) {
        assert.equal(name, 'tenant_branding_settings_compare_and_swap');
        if (state.concurrent) {
            state.settings = state.concurrent(state.settings || {});
            state.concurrent = null;
        }
        const matches = args.p_tenant_id === state.id && JSON.stringify(args.p_expected_settings) === JSON.stringify(state.settings);
        const written = matches && !state.zeroRows && !state.updateFailure;
        if (written) { state.settings = { ...state.settings, ...structuredClone(args.p_branding_patch) }; state.writes += 1; }
        return { maybeSingle: async () => ({ data: written ? { id: state.id } : null, error: state.updateFailure ? new Error('Synthetic database failure') : null }) };
    },
    from(table: string) {
        assert.equal(table, 'tenants');
        const filters = new Map<string, unknown>();
        let patch: { settings: Settings } | undefined;
        const query = {
            select() { return query; }, single() { return query; }, maybeSingle() { return query; },
            eq(key: string, value: unknown) { filters.set(key, value); return query; },
            is(key: string, value: unknown) { filters.set(key, value); return query; },
            update(value: { settings: Settings }) { patch = value; return query; },
            then(resolve: (result: unknown) => unknown, reject: (reason: unknown) => unknown) {
                if (patch && state.concurrent) {
                    state.settings = state.concurrent(state.settings || {});
                    state.concurrent = null;
                }
                const condition = filters.get('settings');
                const matches = filters.get('id') === state.id && (!filters.has('settings') ||
                    (condition === null ? state.settings === null : condition === JSON.stringify(state.settings)));
                const error = (!patch && state.readFailure) || (patch && state.updateFailure) ? new Error('Synthetic database failure') : null;
                const visible = matches && !error && !(patch && state.zeroRows);
                if (patch && visible) { state.settings = structuredClone(patch.settings); state.writes += 1; }
                return Promise.resolve({ data: visible ? { id: state.id, settings: structuredClone(state.settings) } : null, error }).then(resolve, reject);
            },
        };
        return query;
    } };
    const fixture = { state, client };
    active = fixture;
    return fixture;
}

const branding = (name: string) => ({ logo_url: name, themeId: 'print-precise', themeSettings: { explicitThemeSelection: true } }) as any;

test('tenant save and publish reject an update that affects zero rows', async () => {
    for (const action of ['saveDraft', 'publish'] as const) {
        const { state } = database({ unrelated: { keep: true }, branding: { published: branding('Live') } });
        state.zeroRows = true;
        await assert.rejects(createTenantAdapter('shop-a', 'A')[action](branding('Changed')));
        assert.equal(state.writes, 0);
        assert.equal(state.settings!.branding.published.logo_url, 'Live');
    }
});

test('saving a legacy flat draft keeps the existing published shop unchanged', async () => {
    const { state } = database({ branding: branding('Live'), unrelated: { keep: true } });
    const adapter = createTenantAdapter('shop-a', 'A');
    await adapter.saveDraft(branding('Draft'));
    assert.equal((await adapter.loadPublished()).logo_url, 'Live');
    assert.equal((await adapter.loadDraft()).logo_url, 'Draft');
    assert.deepEqual(state.settings!.unrelated, { keep: true });
});

test('new nested branding takes precedence over old root draft and published values', async () => {
    database({ branding_draft: branding('Old draft'), branding_published: branding('Old published'),
        branding: { draft: branding('New draft'), published: branding('New published') } });
    const adapter = createTenantAdapter('shop-a', 'A');
    assert.equal((await adapter.loadDraft()).logo_url, 'New draft');
    assert.equal((await adapter.loadPublished()).logo_url, 'New published');
});

test('master reload retains draft changes over published fields', async () => {
    database({ branding_template_draft: branding('New draft'), branding_template_published: branding('Published') }, masterId);
    assert.equal((await createMasterAdapter().loadDraft()).logo_url, 'New draft');
});

test('master draft cannot report success when its backend read fails', async () => {
    const { state } = database({}, masterId);
    state.readFailure = true;
    await assert.rejects(createMasterAdapter().saveDraft(branding('Draft')));
    assert.equal(state.writes, 0);
});

test('a first draft stays unpublished across storefront and editor reloads, including null settings', async () => {
    for (const initial of [null, {}]) {
        const { state } = database(initial);
        const adapter = createTenantAdapter('shop-a', 'A');
        await adapter.saveDraft(branding('First draft'));
        assert.equal(state.settings!.branding.published, null);
        assert.equal(extractPublishedBranding(state.settings), undefined);
        assert.equal((await adapter.loadDraft()).logo_url, 'First draft');
        assert.notEqual((await adapter.loadPublished()).logo_url, 'First draft');
        await adapter.publish(branding('Now live'));
        assert.equal(extractPublishedBranding(state.settings)!.logo_url, 'Now live');
    }
});

test('root legacy data is preserved on migration and canonical published data overrides stale root drafts', async () => {
    const { state } = database({ branding_published: branding('Legacy live'), branding_draft: branding('Legacy draft') });
    const adapter = createTenantAdapter('shop-a', 'A');
    assert.equal((await adapter.loadDraft()).logo_url, 'Legacy draft');
    await adapter.saveDraft(branding('New draft'));
    assert.equal(extractPublishedBranding(state.settings)!.logo_url, 'Legacy live');
    assert.equal((await adapter.loadDraft()).logo_url, 'New draft');
    await adapter.publish(branding('New live'));
    assert.equal((await adapter.loadPublished()).logo_url, 'New live');
    assert.equal(state.settings!.branding.history[0].data.logo_url, 'Legacy live');
    delete state.settings!.branding.draft;
    assert.equal((await adapter.loadDraft()).logo_url, 'New live');
});

test('old flat siblings from an earlier draft save remain live, but an explicit null publication never falls back', () => {
    assert.equal(extractPublishedBranding({ branding: { ...branding('Live'), draft: branding('Hidden') } })!.logo_url, 'Live');
    assert.equal(extractPublishedBranding({ branding: { draft: branding('Hidden') } }), undefined);
    assert.equal(extractPublishedBranding({ branding: { published: null, draft: branding('Hidden') }, branding_published: branding('Stale') }), undefined);
    assert.equal(extractPublishedBranding({ branding_draft: branding('Hidden') }), undefined);
});

test('concurrent changes are not overwritten by either branding adapter', async () => {
    for (const mode of ['tenant', 'master'] as const) {
        for (const action of ['saveDraft', 'publish'] as const) {
            const { state } = database({ branding: { published: branding('Live') }, address: 'Old address' }, mode === 'master' ? masterId : 'shop-a');
            const adapter = mode === 'master' ? createMasterAdapter() : createTenantAdapter('shop-a', 'A');
            state.concurrent = settings => ({ ...settings, address: 'Changed in another window' });
            await assert.rejects(adapter[action](branding('Local edit')), /ikke gemt/);
            assert.equal(state.writes, 0);
            assert.equal(state.settings!.address, 'Changed in another window');
            assert.equal(state.settings!.branding.published.logo_url, 'Live');
        }
    }
});

test('saved-design, delete, and reset actions also reject zero-row writes for tenant and master', async () => {
    for (const mode of ['tenant', 'master'] as const) {
        for (const action of ['saveDesign', 'deleteSavedDesign', 'resetToDefault'] as const) {
            const { state } = database({ branding: { published: branding('Live') } }, mode === 'master' ? masterId : 'shop-a');
            state.zeroRows = true;
            const adapter = mode === 'master' ? createMasterAdapter() : createTenantAdapter('shop-a', 'A');
            await assert.rejects(action === 'saveDesign' ? adapter.saveDesign('Saved', branding('Draft'))
                : action === 'deleteSavedDesign' ? adapter.deleteSavedDesign('missing') : adapter.resetToDefault());
            assert.equal(state.writes, 0);
        }
    }
});

test('successful save and publish preserve a selected preset, sibling settings, archives and another tenant boundary', async () => {
    const { state } = database({ branding: { published: branding('Live'), savedDesigns: [{ id: 'old-design' }] }, taxes: { enabled: true } });
    const adapter = createTenantAdapter('shop-a', 'A');
    const selected = { ...branding('Edited'), themeId: 'print-nordic', themeSettings: { custom: { value: 'keep' } } };
    await adapter.saveDraft(selected);
    assert.equal((await adapter.loadDraft()).themeId, 'print-nordic');
    await adapter.publish(selected);
    assert.equal((await adapter.loadPublished()).themeId, 'print-nordic');
    assert.deepEqual(state.settings!.branding.published.themeSettings, { custom: { value: 'keep' } });
    assert.deepEqual(state.settings!.taxes, { enabled: true });
    assert.deepEqual(state.settings!.branding.savedDesigns, [{ id: 'old-design' }]);
    const before = structuredClone(state.settings);
    await assert.rejects(createTenantAdapter('shop-b', 'B').publish(branding('Other shop')));
    assert.deepEqual(state.settings, before);
});

test('database errors reject without a successful write for tenant and master', async () => {
    for (const mode of ['tenant', 'master'] as const) {
        const { state } = database({}, mode === 'master' ? masterId : 'shop-a');
        state.updateFailure = true;
        const adapter = mode === 'master' ? createMasterAdapter() : createTenantAdapter('shop-a', 'A');
        await assert.rejects(adapter.saveDraft(branding('Draft')), /Synthetic database failure/);
        assert.equal(state.writes, 0);
    }
});
