import assert from 'node:assert/strict';
import test from 'node:test';
import { applyProductStylingPatches, collectProductStylingPatches, mergeProductStylingChange, persistProductStylingPatches, selectorBoxStylingPatches, valueStylingPatches, type ProductStylingPreview } from './productStylingSave.ts';

const fixture = () => ({
    quantities: [100, 500], template_files: [{ id: 'exact-template' }],
    vertical_axis: { sectionId: 'paper', valueIds: ['silk', 'matte'],
        valueSettings: { silk: { backgroundColor: 'white' }, matte: { backgroundColor: 'green' } },
        selectorStyling: { selectorBox: { backgroundColor: 'white', paddingPx: 12 } } },
    layout_rows: [{ id: 'row', columns: [{ id: 'finish', valueIds: ['foil'], title: 'Finish' }] }],
});

function fakeDatabase() {
    const state = { structure: fixture() as Record<string, unknown>, writes: [] as Record<string, unknown>[], fail: false, noRows: false, noUpdatedRows: false, concurrentWrite: false, revision: 1 };
    const client = { from(table: string) {
        assert.equal(table, 'products');
        let patch: { pricing_structure: Record<string, unknown> } | null = null;
        const filters = new Map<string, unknown>();
        const query = {
            select() { return query; }, single() { return query; }, maybeSingle() { return query; },
            update(value: typeof patch) { patch = value; return query; },
            eq(key: string, value: unknown) { filters.set(key, value); return query; },
            is(key: string, value: unknown) { filters.set(key, value); return query; },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
                assert.equal(filters.get('tenant_id'), 'shop');
                assert.equal(filters.get('id'), 'product');
                if (patch && state.concurrentWrite) {
                    state.concurrentWrite = false;
                    state.revision += 1;
                    state.structure = { ...state.structure, quantities: [200, 800] };
                }
                const matches = !patch || filters.get('updated_at') === String(state.revision);
                const data = state.noRows || (patch && state.noUpdatedRows) || !matches ? null : { id: 'product', pricing_structure: structuredClone(state.structure), updated_at: String(state.revision) };
                if (patch && matches && !state.fail && !state.noRows && !state.noUpdatedRows) {
                    state.structure = structuredClone(patch.pricing_structure);
                    state.revision += 1;
                    state.writes.push(structuredClone(state.structure));
                    data!.pricing_structure = structuredClone(state.structure);
                }
                return Promise.resolve({ data, error: state.fail ? new Error('Synthetic save failure') : null }).then(resolve, reject);
            },
        };
        return query;
    } } as unknown as Parameters<typeof persistProductStylingPatches>[0];
    return { state, client };
}

const button = valueStylingPatches('paper', 'silk', { backgroundColor: 'blue' });
const box = selectorBoxStylingPatches('paper', { backgroundColor: 'red' });
const change = (patches = button, isDirty = true, pricingStructure: Record<string, unknown> = fixture()) => ({ productId: 'product', patches, isDirty, pricingStructure });

test('box save then main draft save retains the saved box and independent unsaved button edit', async () => {
    const { client, state } = fakeDatabase();
    let preview = mergeProductStylingChange(null, change());
    const savedBox = await persistProductStylingPatches(client, 'shop', 'product', box);
    preview = mergeProductStylingChange(preview, change(box, false, savedBox));
    assert.equal(preview.isDirty, true);
    assert.deepEqual(preview.patches, button);
    const saved = await persistProductStylingPatches(client, 'shop', 'product', preview.patches);
    preview = mergeProductStylingChange(preview, change(preview.patches, false, saved));
    assert.equal((state.structure as ReturnType<typeof fixture>).vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
    assert.equal((state.structure as ReturnType<typeof fixture>).vertical_axis.valueSettings.silk.backgroundColor, 'blue');
    assert.deepEqual(state.structure.quantities, [100, 500]);
    assert.deepEqual(state.structure.template_files, [{ id: 'exact-template' }]);
    assert.equal(preview.isDirty, false);
});

test('button save then main draft save retains the saved button and unsaved box edit', async () => {
    const { client, state } = fakeDatabase();
    let preview = mergeProductStylingChange(null, change(box));
    const savedButton = await persistProductStylingPatches(client, 'shop', 'product', button);
    preview = mergeProductStylingChange(preview, change(button, false, savedButton));
    assert.deepEqual(preview.patches, box);
    await persistProductStylingPatches(client, 'shop', 'product', preview.patches);
    assert.equal((state.structure as ReturnType<typeof fixture>).vertical_axis.valueSettings.silk.backgroundColor, 'blue');
    assert.equal((state.structure as ReturnType<typeof fixture>).vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
});

test('save acknowledgements preserve later same-field edits and independent sibling edits', () => {
    const submitted = mergeProductStylingChange(null, change());
    const newer = valueStylingPatches('paper', 'silk', { backgroundColor: 'purple' });
    let current = mergeProductStylingChange(submitted, change(newer));
    current = mergeProductStylingChange(current, change(box));
    const result = mergeProductStylingChange(current, change(submitted.patches, false, applyProductStylingPatches(fixture(), submitted.patches)));
    assert.equal(result.isDirty, true);
    assert.deepEqual(result.patches, [...newer, ...box]);
    assert.equal((result.pricingStructure as ReturnType<typeof fixture>).vertical_axis.valueSettings.silk.backgroundColor, 'purple');
});

test('failed and zero-row saves reject without clearing pending edits', async () => {
    for (const failure of ['fail', 'noRows', 'noUpdatedRows'] as const) {
        const { client, state } = fakeDatabase();
        state[failure] = true;
        const preview = mergeProductStylingChange(null, change());
        await assert.rejects(persistProductStylingPatches(client, 'shop', 'product', preview.patches));
        assert.equal(preview.isDirty, true);
        assert.equal(state.writes.length, 0);
    }
});

test('concurrent local saves serialize and preserve both updates', async () => {
    const { client, state } = fakeDatabase();
    await Promise.all([persistProductStylingPatches(client, 'shop', 'product', box), persistProductStylingPatches(client, 'shop', 'product', button)]);
    assert.equal((state.structure as ReturnType<typeof fixture>).vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
    assert.equal((state.structure as ReturnType<typeof fixture>).vertical_axis.valueSettings.silk.backgroundColor, 'blue');
});

test('a concurrent database change is reloaded before the conditional update is retried', async () => {
    const { client, state } = fakeDatabase();
    state.concurrentWrite = true;
    await persistProductStylingPatches(client, 'shop', 'product', button);
    assert.deepEqual(state.structure.quantities, [200, 800]);
    assert.equal(state.writes.length, 1);
});

test('broad editor patches include actual display edits and retain latest pricing, templates, sibling styling and section order', () => {
    const original = fixture();
    const draft = structuredClone(original);
    draft.vertical_axis.valueSettings.silk.backgroundColor = 'blue';
    const patches = collectProductStylingPatches(original, draft);
    assert.deepEqual(patches, button);
    const latest = applyProductStylingPatches(original, box);
    latest.quantities = [900];
    const updated = applyProductStylingPatches(latest, patches) as ReturnType<typeof fixture>;
    assert.equal(updated.vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
    assert.equal(updated.vertical_axis.valueSettings.matte.backgroundColor, 'green');
    assert.deepEqual(updated.quantities, [900]);
    assert.deepEqual(updated.layout_rows, original.layout_rows);
    assert.deepEqual(updated.template_files, original.template_files);
});

test('an edit reverted while saving stays pending until its own acknowledgement', () => {
    const submitted = mergeProductStylingChange(null, change());
    const reverted = collectProductStylingPatches(submitted.pricingStructure, fixture());
    const current = mergeProductStylingChange(submitted, change(reverted));
    const ack = mergeProductStylingChange(current, change(submitted.patches, false, submitted.pricingStructure));
    assert.equal(ack.isDirty, true);
    assert.equal((ack.pricingStructure as ReturnType<typeof fixture>).vertical_axis.valueSettings.silk.backgroundColor, 'white');
});

test('missing or removed option targets reject rather than recreating configuration', () => {
    const latest = fixture();
    latest.vertical_axis.valueIds = ['matte'];
    assert.throws(() => applyProductStylingPatches(latest, button), /findes ikke/);
    assert.throws(() => applyProductStylingPatches(latest, selectorBoxStylingPatches('removed', { paddingPx: 16 })), /findes ikke/);
});
