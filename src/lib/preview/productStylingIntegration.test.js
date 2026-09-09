import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { updateProductOptionValueSetting } from '../pricing/productOptionSettings.ts';
import { applyProductStylingPatches, mergeProductStylingChange, persistProductStylingPatches, removeSavedStylingPatches, selectorBoxStylingPatches, valueStylingPatches } from './productStylingSave.ts';

const buttonFile = '../../components/admin/ProductOptionButtonEditor.tsx';
const boxFile = '../../components/admin/ProductOptionSectionBoxEditor.tsx';
const parentFile = '../../components/admin/SiteDesignEditorV2.tsx';
const broadFile = '../../components/admin/ProduktvalgknapperSection.tsx';
function source(file) { return ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Execute the current component callbacks, so a disconnected callback or old save handler fails this regression.
function extracted(file, name, environment = {}) {
    const tree = source(file);
    let expression;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
            const initial = node.initializer;
            expression = ts.isCallExpression(initial) && initial.expression.getText(tree) === 'useCallback'
                ? initial.arguments[0].getText(tree) : initial.getText(tree);
        }
        ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.ok(expression, `Missing source handler ${name}`);
    const js = ts.transpileModule(`const handler = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    return new Function(...Object.keys(environment), `${js}\nreturn handler;`)(...Object.values(environment));
}

function harness() {
    let stored = { id: 'product', tenant_id: 'shop', updated_at: '1', pricing_structure: {
        quantities: [100, 500], vertical_axis: { sectionId: 'paper', valueIds: ['silk'],
            valueSettings: { silk: { backgroundColor: 'white' } },
            selectorStyling: { selectorBox: { backgroundColor: 'white' } } },
    } };
    const writes = [], notifications = [];
    let preview = null, persisted = null;
    const supabase = { from(table) {
        assert.equal(table, 'products');
        let patch = null;
        const filters = [];
        const query = {
            select() { return query; }, single() { return query; }, maybeSingle() { return query; },
            update(value) { patch = value; return query; },
            eq(key, value) { filters.push([key, value]); return query; },
            then(resolve, reject) {
                assert.ok(filters.some(([key, value]) => key === 'tenant_id' && value === 'shop'));
                assert.ok(filters.every(([key, value]) => stored[key] === value));
                if (patch) { stored = { ...stored, ...structuredClone(patch), updated_at: String(+stored.updated_at + 1) }; writes.push(structuredClone(stored)); }
                return Promise.resolve({ data: structuredClone(stored), error: null }).then(resolve, reject);
            },
        };
        return query;
    } };
    const setProductPricingPreview = value => { preview = typeof value === 'function' ? value(preview) : value; };
    const setPersistedProductPricing = value => { persisted = value; };
    const onPricingStructureChange = extracted(parentFile, 'handleProductOptionPricingStructureChange', {
        setProductPricingPreview, setPersistedProductPricing, mergeProductStylingChange,
    });
    const toast = { success: value => notifications.push(value), error: value => notifications.push(`ERROR: ${value}`) };
    return {
        bindings: { supabase, onPricingStructureChange, toast },
        get stored() { return stored; }, get preview() { return preview; }, get persisted() { return persisted; }, writes, notifications,
        externallyUpdateButton(patch) {
            Object.assign(stored.pricing_structure.vertical_axis.valueSettings.silk, patch);
            stored.updated_at = String(+stored.updated_at + 1);
        },
        externallyUpdateBox(patch) {
            Object.assign(stored.pricing_structure.vertical_axis.selectorStyling.selectorBox, patch);
            stored.updated_at = String(+stored.updated_at + 1);
        },
        emitButton(color) {
            const emit = extracted(buttonFile, 'emitPricingPreview', { productId: 'product', sectionId: 'paper', valueId: 'silk',
                productPricingStructure: structuredClone(stored.pricing_structure), onPricingStructureChange, updateProductOptionValueSetting,
                valueStylingPatches, emittedSettingsRef: { current: extracted(buttonFile, 'DEFAULT_SETTINGS') }, pendingPatchesRef: { current: [] }, buildValueSettingUpdate: extracted(buttonFile, 'buildValueSettingUpdate') });
            emit({ ...extracted(buttonFile, 'DEFAULT_SETTINGS'), backgroundColor: color }, false);
        },
        saveBox(color) {
            return extracted(boxFile, 'handleSave', { setSaving() {}, settings: { backgroundColor: color, borderColor: 'black', borderRadiusPx: 8, borderWidthPx: 1, paddingPx: 16 },
                location: 'product', pendingPatchesRef: { current: selectorBoxStylingPatches('paper', { backgroundColor: color }) }, productId: 'product', tenantId: 'shop', sectionId: 'paper', supabase, toast, console: { error() {} },
                selectorBoxStylingPatches, persistProductStylingPatches, setProductPricingStructure() {}, onPricingStructureChange })();
        },
        saveMain(persist = persistProductStylingPatches) {
            return extracted(parentFile, 'persistCurrentProductPricingPreview', { productPricingPreview: preview, supabase, editor: { entityId: 'shop' }, toast, console: { error() {} },
                persistProductStylingPatches: persist, mergeProductStylingChange, setProductPricingPreview, setPersistedProductPricing })();
        },
        saveButton(color) {
            const settings = { ...extracted(buttonFile, 'DEFAULT_SETTINGS'), backgroundColor: color };
            return extracted(buttonFile, 'handleSave', { setSaving() {}, settings, pendingPatchesRef: { current: valueStylingPatches('paper', 'silk', { backgroundColor: color }) }, settingsRef: { current: settings }, hasImageSizeChange: false,
                productId: 'product', tenantId: 'shop', sectionId: 'paper', valueId: 'silk', supabase, toast, console: { error() {} },
                updateProductOptionValueSetting, valueStylingPatches, persistProductStylingPatches,
                buildValueSettingUpdate: extracted(buttonFile, 'buildValueSettingUpdate'), setProductPricingStructure() {}, setHasImageSizeChange() {}, onPricingStructureChange })();
        },
        editBox(color) {
            const patches = selectorBoxStylingPatches('paper', { backgroundColor: color });
            onPricingStructureChange({ productId: 'product', pricingStructure: applyProductStylingPatches(stored.pricing_structure, patches), patches, isDirty: true });
        },
    };
}

test('actual box and parent save callbacks preserve button edits and saved box styling', async () => {
    const app = harness();
    app.emitButton('blue');
    await app.saveBox('red');
    assert.equal(app.preview.isDirty, true);
    assert.equal(app.preview.pricingStructure.vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
    assert.equal(await app.saveMain(), true);
    assert.equal(app.stored.pricing_structure.vertical_axis.valueSettings.silk.backgroundColor, 'blue');
    assert.equal(app.stored.pricing_structure.vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
    assert.equal(app.preview.isDirty, false);
    assert.deepEqual(app.stored.pricing_structure.quantities, [100, 500]);
    assert.deepEqual(app.notifications, ['Valgboks gemt']);
});

test('actual button save callback retains independent dirty box settings', async () => {
    const app = harness();
    app.editBox('red');
    await app.saveButton('blue');
    assert.equal(app.preview.isDirty, true);
    assert.equal(await app.saveMain(), true);
    assert.equal(app.stored.pricing_structure.vertical_axis.valueSettings.silk.backgroundColor, 'blue');
    assert.equal(app.stored.pricing_structure.vertical_axis.selectorStyling.selectorBox.backgroundColor, 'red');
});

test('a contextual background edit leaves a newer padding edit on the same button intact', async () => {
    const app = harness();
    app.emitButton('blue');
    assert.deepEqual(app.preview.patches, valueStylingPatches('paper', 'silk', { backgroundColor: 'blue' }));
    app.externallyUpdateButton({ paddingPx: 37 });
    await app.saveButton('blue');
    assert.equal(app.stored.pricing_structure.vertical_axis.valueSettings.silk.paddingPx, 37);
    assert.equal(app.stored.pricing_structure.vertical_axis.valueSettings.silk.backgroundColor, 'blue');
});

test('the actual box field handler records only the changed field', () => {
    const app = harness();
    const pendingPatchesRef = { current: [] };
    let emitted;
    const edit = extracted(boxFile, 'updateSetting', {
        settings: { backgroundColor: 'white', paddingPx: 12 }, setSettings() {},
        location: 'product', sectionId: 'paper', productId: 'product', productPricingStructure: app.stored.pricing_structure,
        pendingPatchesRef, selectorBoxStylingPatches, applyProductStylingPatches,
        onPricingStructureChange(change) { emitted = change; },
    });
    edit('backgroundColor', 'red');
    assert.deepEqual(emitted.patches, selectorBoxStylingPatches('paper', { backgroundColor: 'red' }));
    assert.deepEqual(pendingPatchesRef.current, emitted.patches);
});

test('actual parent save acknowledgement keeps edits made while its request is in flight', async () => {
    const app = harness();
    app.emitButton('blue');
    let resume;
    const blocked = new Promise(resolve => { resume = resolve; });
    const request = app.saveMain(async (...args) => { await blocked; return persistProductStylingPatches(...args); });
    app.emitButton('purple');
    resume();
    assert.equal(await request, true);
    assert.equal(app.preview.isDirty, true);
    assert.equal(app.preview.pricingStructure.vertical_axis.valueSettings.silk.backgroundColor, 'purple');
    assert.equal(app.stored.pricing_structure.vertical_axis.valueSettings.silk.backgroundColor, 'blue');
    await app.saveMain();
    assert.equal(app.stored.pricing_structure.vertical_axis.valueSettings.silk.backgroundColor, 'purple');
});

test('actual parent failure returns false and leaves edits pending', async () => {
    const app = harness();
    app.emitButton('blue');
    assert.equal(await app.saveMain(async () => { throw new Error('Synthetic denied write'); }), false);
    assert.equal(app.preview.isDirty, true);
    assert.equal(app.writes.length, 0);
});

test('an old product save acknowledgement cannot replace a newly selected dirty product', () => {
    const other = { productId: 'other-product', pricingStructure: { matrixBox: { backgroundColor: 'purple' } },
        patches: [{ path: ['matrixBox', 'backgroundColor'], value: 'purple' }], isDirty: true };
    let preview = other;
    const callback = extracted(parentFile, 'handleProductOptionPricingStructureChange', {
        setProductPricingPreview(update) { preview = update(preview); }, setPersistedProductPricing() {}, mergeProductStylingChange,
    });
    callback({ productId: 'old-product', pricingStructure: {}, patches: [], isDirty: false });
    assert.equal(preview, other);
});

test('the broad editor save acknowledgement rebases later form edits and keeps them dirty', () => {
    const fixture = harness();
    fixture.emitButton('blue');
    const submitted = fixture.preview;
    fixture.emitButton('purple');
    const localPreviewRef = { current: fixture.preview };
    const lastEmittedStructureRef = { current: null };
    let products = [{ id: 'product', pricing_structure: submitted.pricingStructure }];
    let dirty = false;
    const acknowledge = extracted(broadFile, 'acknowledgeSavedStyling', {
        localPreviewRef, lastEmittedStructureRef, mergeProductStylingChange,
        setProducts(update) { products = update(products); }, setHasUnsavedProductChanges(value) { dirty = value; },
    });
    acknowledge({ ...submitted, isDirty: false });
    assert.equal(dirty, true);
    assert.equal(products[0].pricing_structure.vertical_axis.valueSettings.silk.backgroundColor, 'purple');
    assert.equal(localPreviewRef.current.isDirty, true);
});

for (const kind of ['button', 'box']) {
    test(`main save acknowledges the ${kind} form before a later edit and direct save`, async () => {
        const app = harness();
        const file = kind === 'button' ? buttonFile : boxFile;
        const pendingPatchesRef = { current: [] };
        let settings = kind === 'button' ? extracted(buttonFile, 'DEFAULT_SETTINGS') : { backgroundColor: 'white', paddingPx: 12 };
        const emittedSettingsRef = { current: settings };
        const shared = { ...app.bindings, productId: 'product', tenantId: 'shop', sectionId: 'paper', valueId: 'silk',
            pendingPatchesRef, emittedSettingsRef, location: 'product', productPricingStructure: structuredClone(app.stored.pricing_structure),
            selectorBoxStylingPatches, valueStylingPatches, applyProductStylingPatches, updateProductOptionValueSetting,
            buildValueSettingUpdate: extracted(buttonFile, 'buildValueSettingUpdate') };
        function edit(key, value) {
            if (kind === 'button') {
                settings = { ...settings, [key]: value };
                extracted(buttonFile, 'emitPricingPreview', shared)(settings, false);
            } else {
                extracted(boxFile, 'updateSetting', { ...shared, settings, setSettings(next) { settings = next; } })(key, value);
            }
        }
        edit('backgroundColor', 'blue');
        assert.equal(pendingPatchesRef.current.length, 1);
        await app.saveMain();
        extracted(file, 'acknowledgePersistedStyling', { productId: 'product', pendingPatchesRef, removeSavedStylingPatches })(app.persisted);
        assert.deepEqual(pendingPatchesRef.current, []);
        if (kind === 'button') app.externallyUpdateButton({ backgroundColor: 'red' });
        else app.externallyUpdateBox({ backgroundColor: 'red' });
        edit('paddingPx', 30);
        assert.equal(pendingPatchesRef.current.length, 1);
        extracted(file, 'acknowledgePersistedStyling', { productId: 'product', pendingPatchesRef, removeSavedStylingPatches })(app.persisted);
        assert.equal(pendingPatchesRef.current.length, 1, 'Repeated old acknowledgements must retain newer edits');
        await extracted(file, 'handleSave', { ...shared, settings, settingsRef: { current: settings }, hasImageSizeChange: false,
            setSaving() {}, setProductPricingStructure() {}, setHasImageSizeChange() {}, persistProductStylingPatches, console: { error() {} } })();
        const saved = kind === 'button' ? app.stored.pricing_structure.vertical_axis.valueSettings.silk : app.stored.pricing_structure.vertical_axis.selectorStyling.selectorBox;
        assert.equal(saved.backgroundColor, 'red');
        assert.equal(saved.paddingPx, 30);
    });

    test(`the ${kind} form keeps a same-field edit made while the main save is in flight`, () => {
        const make = value => kind === 'button' ? valueStylingPatches('paper', 'silk', { backgroundColor: value }) : selectorBoxStylingPatches('paper', { backgroundColor: value });
        const pendingPatchesRef = { current: make('purple') };
        extracted(kind === 'button' ? buttonFile : boxFile, 'acknowledgePersistedStyling', {
            productId: 'product', pendingPatchesRef, removeSavedStylingPatches,
        })({ productId: 'product', patches: make('blue'), isDirty: false, pricingStructure: {} });
        assert.deepEqual(pendingPatchesRef.current, make('purple'));
    });
}

test('the contextual and broad editors are wired to the parent reconciliation callback', () => {
    const tree = source(parentFile);
    let checked = 0;
    function visit(node) {
        if (ts.isJsxSelfClosingElement(node) && ['ProductOptionButtonEditor', 'ProductOptionSectionBoxEditor', 'ProduktvalgknapperSection'].includes(node.tagName.getText(tree))) {
            const attrs = new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(tree), attr.initializer?.getText(tree)]));
            assert.equal(attrs.get(node.tagName.getText(tree) === 'ProduktvalgknapperSection' ? 'onPreviewPricingStructureChange' : 'onPricingStructureChange'), '{handleProductOptionPricingStructureChange}');
            assert.equal(attrs.get('tenantId'), '{editor.entityId}');
            assert.equal(attrs.get('pricingPreview'), '{productPricingPreview}');
            if (node.tagName.getText(tree) !== 'ProduktvalgknapperSection') {
                assert.ok(attrs.has('key'), 'Selection identity must remount contextual form state');
                assert.equal(attrs.get('persistedStyling'), '{persistedProductPricing}');
            }
            checked += 1;
        }
        ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.equal(checked, 4);
    for (const file of [buttonFile, boxFile]) {
        assert.ok(source(file).getText().includes('acknowledgePersistedStyling(persistedStyling)'), 'Contextual effect must deliver the saved prop to its acknowledgement handler');
    }
});
