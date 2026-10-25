import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the actual UI callbacks, with failed storage operations, without a
// browser or network. Hook errors have already displayed their failure toast.
const source = ts.createSourceFile('editor.tsx', readFileSync(new URL('../../components/admin/SiteDesignEditorV2.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['saveDraftWithProductSettings', 'handlePublish', 'handlePublishAfterPayment', 'handleSaveDesign', 'handleOverwriteDesign'];
const declarations = new Map();
function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(source))) declarations.set(node.name.getText(source), node.initializer.getText(source));
    ts.forEachChild(node, visit);
}
visit(source);

function fixture(failingOperation) {
    const calls = [];
    const state = { name: 'My unsaved design', overwriteId: 'existing', saveDialog: true, publishDialog: true, label: 'My version' };
    const operation = name => async () => {
        calls.push(name);
        if (name === failingOperation) throw new Error('Storage rejected the write');
    };
    const bindings = {
        useCallback: callback => callback,
        editor: { mode: 'tenant', hasUnsavedChanges: true, savedDesigns: [{ id: 'existing', name: 'Original' }], saveDraft: operation('draft'), publish: operation('publish'), saveDesign: operation('design') },
        persistCurrentProductPricingPreview: async () => failingOperation !== 'product',
        paidItems: { hasPendingItems: false },
        publishLabel: state.label, saveDesignName: state.name, overwriteDesignId: state.overwriteId,
        setShowPublishDialog: value => { state.publishDialog = value; },
        setShowPendingPurchasesDialog: () => {},
        setPublishLabel: value => { state.label = value; },
        setSaveDesignName: value => { state.name = value; },
        setOverwriteDesignId: value => { state.overwriteId = value; },
        setShowSaveDesignDialog: value => { state.saveDialog = value; },
        toast: { error: () => {} },
    };
    const handlers = Object.fromEntries(names.map(name => {
        const code = ts.transpile(`const callback = ${declarations.get(name)};`, { target: ts.ScriptTarget.ES2022 });
        return [name, new Function(...Object.keys(bindings), `${code}; return callback;`)(...Object.values(bindings))];
    }));
    return { handlers, state, calls };
}

for (const [handler, failure] of [
    ['saveDraftWithProductSettings', 'draft'], ['handlePublish', 'draft'], ['handlePublish', 'publish'],
    ['handleSaveDesign', 'design'], ['handleOverwriteDesign', 'design'],
]) {
    test(`${handler}: ${failure} rejection stays in the editor and preserves retry inputs`, async () => {
        const { handlers, state, calls } = fixture(failure);
        const before = { ...state };
        await assert.doesNotReject(handlers[handler]());
        assert.deepEqual(state, before);
        if (failure === 'draft') assert.ok(!calls.includes('publish'));
    });
}

test('paid-item publication propagates failure to its existing dialog error handler', async () => {
    const { handlers, state } = fixture('publish');
    await assert.rejects(handlers.handlePublishAfterPayment(), /Storage rejected/);
    assert.equal(state.label, 'My version');
});

test('successful publish saves the draft first and clears only completed dialog state', async () => {
    const { handlers, state, calls } = fixture();
    await handlers.handlePublish();
    assert.deepEqual(calls, ['draft', 'publish']);
    assert.equal(state.publishDialog, false);
    assert.equal(state.label, '');
});

for (const handler of ['handleSaveDesign', 'handleOverwriteDesign']) {
    test(`${handler}: successful save clears inputs and closes the dialog`, async () => {
        const { handlers, state, calls } = fixture();
        await handlers[handler]();
        assert.deepEqual(calls, ['design']);
        assert.equal(state.name, '');
        assert.equal(state.overwriteId, 'none');
        assert.equal(state.saveDialog, false);
    });
}

test('failed product styling prevents both draft save and publication', async () => {
    const { handlers, calls, state } = fixture('product');
    await handlers.handlePublish();
    assert.deepEqual(calls, []);
    assert.equal(state.publishDialog, true);
});
