import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollLabelCodingOptionReference } from './rollLabelCodingOptions';
import { rollLabelOptionTransition, validateRollLabelConfiguration } from './rollLabelConfiguration';
import { currentRollLabelSelection, prepareRollLabelGeneratedTemplate } from '../designer/rollLabelGeneratedTemplate';
import { buildVerifiedRollLabelContext, readVerifiedRollLabelContext } from '../designer/rollLabelSavedContext';
import { encodeDesignerSnapshot, decodeDesignerSnapshot } from '../designer/saveDesign';
import type { RollLabelReviewFamily } from './rollLabelReview';
const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/30968.json', 'utf8')) as RollLabelReviewFamily;
const identity = { productId: family.productId, familyId: family.familyId };
const contract = { version: 1 as const, ...identity, sections: family.sections, profiles: family.profiles, orderReady: false as const };
const draft = (id: string) => ({ dimensions: { width: '50', height: '50' }, quantity: '1000', allocations: [], optionStateId: id });
test('all1980 actual integrated selections and33390 individual code/font/feed transitions retain full source vectors', () => {
  let selections = 0, transitions = 0;
  const receiptRounds = new Map<string, number>();
  for (const p of family.profiles) for (const state of p.optionStates!.states) {
    const checked = validateRollLabelConfiguration(p, draft(state.id), identity);
    assert.ok(checked.selection, p.key); assert.deepEqual(checked.selection.sourceOptions, state.options);
    assert.equal(rollLabelCodingOptionReference(p, checked.selection), 'documented');
    const receiptRound = state.evidence[state.evidence.length - 1].sourceReceiptPath!.split('/')[3];
    receiptRounds.set(receiptRound, (receiptRounds.get(receiptRound) || 0) + 1);
    assert.ok(currentRollLabelSelection(checked.selection, family.productId, contract)); selections++;
    for (const field of p.optionFields) for (const value of field.values) {
      const next = rollLabelOptionTransition(p, state.id, field.sourceFieldId, value.sourceValueId); assert.ok(next);
      assert.deepEqual(next.options, { ...state.options, [field.sourceFieldId]: value.sourceValueId }); transitions++;
    }
    if (!Object.prototype.hasOwnProperty.call(state.options, '2058')) assert.equal(rollLabelOptionTransition(p, state.id, '2058', '13433'), null);
  }
  assert.equal(selections, 1980); assert.equal(transitions, 33390);
  assert.equal(receiptRounds.get('predecessor006-coding-option-source-check-045'), 144);
  assert.equal(receiptRounds.get('predecessor006-coding-code-font-source-check-046'), 252);
  assert.equal(receiptRounds.get('predecessor006-coding-code-font-feed-source-check-047'), 1584);
});
test('other dimensions/quantities or changed/foreign metadata never inherit reference-point source proof', () => {
  for (const p of family.profiles) {
    const selected = validateRollLabelConfiguration(p, draft(p.optionStates!.initialStateId!), identity).selection!;
    for (const change of [
      { quantity: 10000 }, { widthMm: 51 }, { heightMm: 51 }, { profileKey: 'foreign' },
      { articleId: 'foreign' }, { materialId: 'foreign' }, { optionStateId: 'foreign' },
      { sourceOptions: { ...selected.sourceOptions, '2059': 'foreign' } },
      { sourceOptions: { ...selected.sourceOptions, unexpected: 'foreign' } },
    ]) assert.equal(rollLabelCodingOptionReference(p, { ...selected, ...change }), 'pending');
    assert.equal(rollLabelCodingOptionReference(p, null), 'pending');
    const stale = structuredClone(p); stale.optionStates!.states.find(s => s.id === selected.optionStateId)!.evidence.at(-1)!.sourceReceiptSha256 = 'invalid';
    assert.equal(rollLabelCodingOptionReference(stale, selected), 'pending');
    const noDisplay = structuredClone(p); delete noDisplay.codingDeliveryDisplay;
    assert.equal(rollLabelCodingOptionReference(noDisplay, selected), null);
  }
});

test('900 current primitive states survive native save/restore;1080 unsupported shapes and stale023 descriptors stay refused', async () => {
  const priorFamily = JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/coding-options-024/before-artifacts/review/families/30968.json', 'utf8')) as RollLabelReviewFamily;
  const priorContract = { ...contract, profiles: priorFamily.profiles };
  let restored = 0, unsupported = 0, stale = 0, changed = 0, foreignTenant = 0;
  for (const p of family.profiles) {
    const oldProfile = priorFamily.profiles.find(q => q.key === p.key)!;
    const oldSelection = validateRollLabelConfiguration(oldProfile, draft(oldProfile.optionStates!.initialStateId!), identity).selection!;
    const oldGenerated = await prepareRollLabelGeneratedTemplate(oldSelection, family.productId, priorContract);
    for (const state of p.optionStates!.states) {
      const selection = validateRollLabelConfiguration(p, draft(state.id), identity).selection!;
      const generated = await prepareRollLabelGeneratedTemplate(selection, family.productId, contract);
      if (!generated) { assert.ok(['oval', 'custom_contour'].includes(p.format.shape)); unsupported++; continue; }
      assert.ok(generated.designerAllowed);
      const document = { productId: family.productId, tenantId: 'local-coding-024', widthMm: 50, heightMm: 50,
        bleedMm: generated.guide.bleedMm, safeMm: generated.guide.safeAreaMm };
      const template = { url: generated.descriptor, sha256: generated.sha256, name: 'Coding metadata transport check',
        widthMm: 50, heightMm: 50, bleedMm: document.bleedMm, safeMm: document.safeMm, pageCount: 1 as const };
      const context = await buildVerifiedRollLabelContext(selection, template, document, contract); assert.ok(context);
      const object = { type: 'rect', left: 4, top: 5, width: 6, height: 7,
        data: { originalPdfBytes: Array.from(generated.bytes), qaSyntheticObject: true } };
      const encoded = JSON.stringify(encodeDesignerSnapshot({ objects: [object], rollLabelContext: context }));
      const decoded = decodeDesignerSnapshot(JSON.parse(encoded));
      assert.deepEqual((decoded as { objects: unknown[] }).objects, [object]);
      const checked = await readVerifiedRollLabelContext(decoded, document, contract); assert.deepEqual(checked, context);
      assert.deepEqual(checked!.selection.sourceOptions, state.options); restored++;
      const modified = structuredClone(context); modified.selection.sourceOptions['2059'] = 'foreign';
      assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: modified }, document, contract), null); changed++;
      assert.equal(await readVerifiedRollLabelContext(decoded, { ...document, tenantId: 'foreign' }, contract), null); foreignTenant++;
      assert.ok(oldGenerated); assert.notEqual(generated.descriptor, oldGenerated.descriptor);
      const oldDescriptor = structuredClone(context); oldDescriptor.template.url = oldGenerated.descriptor;
      assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: oldDescriptor }, document, contract), null); stale++;
    }
  }
  assert.equal(restored, 900); assert.equal(unsupported, 1080);
  assert.equal(stale, 900); assert.equal(changed, 900); assert.equal(foreignTenant, 900);
  // This verifies base-guide and selection metadata transport only. The current
  // PDFs contain no rendered coding artwork, selected font or Excel/JPG bundle.
});
