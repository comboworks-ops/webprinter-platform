import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildRollLabelCodingOptions, loadRollLabelCodingOptions, restoreRollLabelCodingOptionDelta } from '../shared/load-roll-label-coding-options.js';
import { loadRollLabelCodingDelivery } from '../shared/load-roll-label-coding-delivery.js';
import { loadRollLabelMotifPageDimensions } from '../shared/load-roll-label-motif-page-dimensions.js';
import { loadRollLabelMotifRectangleGeometry, verifyRollLabelMotifRectangleDelta } from '../shared/load-roll-label-motif-rectangle-geometry.js';
const base = 'output/supplier-imports/roll-labels-catalogue-2026-10-06';
const out = 'output/qa/roll-labels-2026-10-06/coding-options-024';
const json = file => JSON.parse(fs.readFileSync(file));
const bridge = json('output/qa/roll-labels-2026-10-06/predecessor006-coding-canonical-identity-bridge-048/canonical-identity-bindings.json');
const before = json('output/qa/roll-labels-2026-10-06/coding-display-023/before-artifacts/review/families/30968.json');
const contracts = loadRollLabelCodingOptions(process.cwd());
test('all1980 canonical raw-bound witnesses preserve16 defaults and48 older evidence rows', () => {
  let witnesses = 0, historical = 0;
  for (const [key, c] of contracts) {
    const old = before.profiles.find(p => p.key === key).optionStates;
    assert.equal(c.initialStateId, old.initialStateId);
    for (const state of c.states) {
      const previous = old.states.find(s => s.id === state.id);
      if (previous) { assert.deepEqual(state.evidence.slice(0, previous.evidence.length), previous.evidence); historical += previous.evidence.length; }
      const witness = state.evidence.at(-1), binding = bridge.bindings.find(b => b.profileKey === key && b.optionStateId === state.id);
      assert.equal(witness.signature, binding.canonicalSelectionSignature);
      assert.equal(witness.responseSha256, binding.responseSha256);
      assert.equal(witness.sourceReceiptPath, binding.sourceReceiptPath);
      assert.equal(witness.sourceReceiptSha256, binding.sourceReceiptSha256);
      assert.notEqual(witness.signature, witness.qaRequestFingerprint);
      assert.equal(c.pricingReady, false); assert.equal(c.orderReady, false); witnesses++;
    }
  }
  assert.equal(witnesses, 1980); assert.equal(historical, 48);
});
test('foreign, partial, forged identity/evidence and promoted source contracts refuse', () => {
  for (const mutate of [
    b => { b.profiles[0].optionStates.states[0].options['2058'] = 'foreign'; },
    b => { b.profiles[0].optionStates.initialStateId = 'foreign'; },
    b => { b.profiles[0].optionStates.states[0].id = '0'.repeat(64); },
    b => { b.profiles[0].optionStates.states[0].evidence[0].signature = '0'.repeat(64); },
    b => { b.bindings[0].selections.material = 'foreign'; },
    b => { b.profiles[0].optionStates.pricingReady = true; },
    b => { b.profiles[0].optionStates.orderReady = true; },
    b => { b.profiles[0].optionStates.states.pop(); },
    b => { b.profiles.pop(); },
  ]) { const changed = structuredClone(bridge); mutate(changed); assert.throws(() => buildRollLabelCodingOptions(before, changed)); }
  const current = json(`${base}/review/families/30968.json`), historical = json(`${out}/before-artifacts/review/families/30968.json`);
  for (const mutate of [
    c => { c.profiles[0].optionStates.states[0].evidence.at(-1).sourceReceiptSha256 = '0'.repeat(64); },
    c => { c.profiles[0].optionStates.states.pop(); },
    c => { c.profiles[0].optionStates = historical.profiles[0].optionStates; },
  ]) { const changed = structuredClone(current); mutate(changed); assert.throws(() => restoreRollLabelCodingOptionDelta(changed, historical, contracts)); }
});
test('all3 exact application artifact deltas restore only options and aggregate count', () => {
  const receipt = json(`${out}/option-preparation.json`);
  // Verify the complete050->049->048 chain before viewing the historical024
  // product draft. Every later change is checked, never blindly stripped.
  const {beforeFiles} = loadRollLabelMotifPageDimensions(process.cwd());
  loadRollLabelMotifRectangleGeometry(process.cwd());
  const geometryProof = 'output/qa/roll-labels-2026-10-06/root-motif-rectangle-geometry-048';
  const geometryReceipt = json(`${geometryProof}/geometry-preparation.json`);
  const geometryRows = json('output/qa/roll-labels-2026-10-06/predecessor006-motif-rectangle-rule-review-052/source-rule-proposals.json').proposals;
  for (const change of receipt.changes) {
    let bytes = beforeFiles.get(change.path) || fs.readFileSync(change.path);
    const later = geometryReceipt.changes.find(c => c.path === change.path);
    if (later) {
      assert.equal(createHash('sha256').update(bytes).digest('hex'), later.afterSha256);
      const historical = fs.readFileSync(`${geometryProof}/before-artifacts/${change.path.slice(base.length + 1)}`);
      assert.equal(createHash('sha256').update(historical).digest('hex'), later.beforeSha256);
      verifyRollLabelMotifRectangleDelta(JSON.parse(bytes), JSON.parse(historical), change.path.slice(base.length + 1), geometryRows);
      bytes = historical;
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), change.afterSha256);
    const backup = `${out}/before-artifacts/${change.path.slice(base.length + 1)}`;
    assert.equal(createHash('sha256').update(fs.readFileSync(backup)).digest('hex'), change.beforeSha256);
    const current = JSON.parse(bytes), previous = json(backup);
    if (current.families) {
      const f = current.families.find(f => f.familyId === '30968'), old = previous.families.find(f => f.familyId === '30968');
      restoreRollLabelCodingOptionDelta(f.pricingStructure.rollLabelConfiguration, old.pricingStructure.rollLabelConfiguration, contracts);
    } else if (current.familyId) restoreRollLabelCodingOptionDelta(current, previous, contracts);
    else {
      for (const [key, c] of contracts) {
        const i = current.profiles.findIndex(p => p.profileKey === key); assert.deepEqual(current.profiles[i], c);
        current.profiles[i] = previous.profiles.find(p => p.profileKey === key);
      }
      current.counts.states = previous.counts.states;
    }
    assert.deepEqual(current, previous);
  }
});
test('023 display provenance verifies the exact024 delta without accepting foreign family edits', () => {
  const sources = fs.readdirSync(`${base}/families`).filter(f => f.endsWith('.json')).map(f => json(`${base}/families/${f}`));
  assert.equal(loadRollLabelCodingDelivery(process.cwd(), sources).size, 16);
  const current = json(`${base}/review/families/30968.json`);
  restoreRollLabelCodingOptionDelta(current, before, contracts);
  current.profiles.forEach(p => { delete p.codingDeliveryDisplay; delete p.sourceEvidenceSha256; });
  assert.deepEqual(current, before);
  for (const item of json(`${out}/option-preparation.json`).protectedArtifacts) {
    assert.equal(createHash('sha256').update(fs.readFileSync(`${base}/${item[0]}`)).digest('hex'), item[1]);
  }
});
