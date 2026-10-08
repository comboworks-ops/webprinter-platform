import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rollLabelHash } from './roll-label-catalogue.js';
import { rollLabelOptionKey } from './roll-label-option-states.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'output/qa/roll-labels-2026-10-06/predecessor006-coding-canonical-identity-bridge-048';
const baselinePath = 'output/qa/roll-labels-2026-10-06/coding-display-023/before-artifacts/review/families/30968.json';
const projectionPath = 'output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/30968.json';
const baselineHash = '0ff75bb37c5837fe0d8aa4a3c8aeb85b5c9a0191c3e47279861db6faa7918d67';

/** Preserve every historical evidence row. Add only048 canonical witnesses,
 * retaining the exact raw receipt and separate QA request identity. */
export function buildRollLabelCodingOptions(baseline, bridge) {
  assert.equal(bridge.profiles.length, 16);
  assert.equal(bridge.bindings.length, 1980);
  const contracts = new Map(), signatures = new Set();
  for (const row of bridge.profiles) {
    const profile = baseline.profiles.find(p => p.key === row.profileKey);
    assert.ok(profile && !contracts.has(profile.key));
    const candidate = structuredClone(row.optionStates), old = profile.optionStates;
    assert.equal(candidate.initialStateId, old.initialStateId);
    assert.equal(candidate.profileKey, profile.key);
    assert.equal(candidate.coverage, 'observed_complete_option_vectors_only');
    assert.equal(candidate.pricingReady, false); assert.equal(candidate.orderReady, false);
    assert.equal(candidate.states.length, profile.optionFields.some(f => f.sourceFieldId === '2058') ? 135 : 45);
    const ids = new Set();
    for (const state of candidate.states) {
      assert.ok(!ids.has(state.id)); ids.add(state.id);
      assert.equal(state.id, rollLabelHash({ profileKey: profile.key, options: rollLabelOptionKey(state.options) }));
      assert.deepEqual(Object.keys(state.options).sort(), profile.optionFields.map(f => f.sourceFieldId).sort());
      for (const [field, value] of Object.entries(state.options)) {
        assert.ok(profile.optionFields.find(f => f.sourceFieldId === field)?.values.some(v => v.sourceValueId === value));
      }
      const binding = bridge.bindings.find(b => b.profileKey === profile.key && b.optionStateId === state.id);
      assert.ok(binding); assert.deepEqual(JSON.parse(binding.selections.options), state.options);
      assert.equal(binding.selections.article, profile.articleId); assert.equal(binding.selections.material, profile.sourceMaterialId);
      assert.equal(binding.canonicalSelectionSignature, rollLabelHash({ selections: binding.selections, quantity: binding.quantity }));
      assert.ok(!signatures.has(binding.canonicalSelectionSignature)); signatures.add(binding.canonicalSelectionSignature);
      assert.equal(binding.widthMm, 50); assert.equal(binding.heightMm, 50); assert.equal(binding.quantity, 1000);
      assert.deepEqual(state.evidence, [{ signature: binding.canonicalSelectionSignature, responseSha256: binding.responseSha256,
        widthMm: 50, heightMm: 50, quantity: 1000 }]);
      const witness = { ...state.evidence[0], sourceReceiptPath: binding.sourceReceiptPath,
        sourceReceiptSha256: binding.sourceReceiptSha256, qaRequestFingerprint: binding.qaRequestFingerprint };
      const prior = old.states.find(s => s.id === state.id);
      if (prior) assert.deepEqual(prior.options, state.options);
      state.evidence = [...structuredClone(prior?.evidence || []), witness];
    }
    assert.ok(old.states.every(s => ids.has(s.id)), 'Historical option state lost');
    // Keep the default first, as before. IDs and every previous evidence row stay.
    candidate.states.sort((a, b) => a.id === old.initialStateId ? -1 : b.id === old.initialStateId ? 1 : 0);
    contracts.set(profile.key, candidate);
  }
  assert.equal(signatures.size, 1980);
  return contracts;
}

/** Only the exact checked024 option delta may be removed for historical source
 * verification. A baseline-only projection is also valid before integration. */
export function restoreRollLabelCodingOptionDelta(current, before, contracts) {
  let integrated = 0;
  for (const p of current.profiles) {
    const old = before.profiles.find(q => q.key === p.key); assert.ok(old);
    if (JSON.stringify(p.optionStates) === JSON.stringify(old.optionStates)) continue;
    assert.deepEqual(p.optionStates, contracts.get(p.key), 'Foreign coding option-state change');
    p.optionStates = structuredClone(old.optionStates); integrated++;
  }
  assert.ok(integrated === 0 || integrated === 16, 'Partial coding option integration');
  return current;
}

/** Offline source reader; never transfers money, creates quotes or runs imports.
 * Hash checks include all raw receipts and the independent048 readback. */
export function loadRollLabelCodingOptions(root) {
  const read = relative => fs.readFileSync(path.join(root, relative));
  const bridgeBytes = read(`${folder}/canonical-identity-bindings.json`);
  assert.equal(sha(bridgeBytes), 'f2a38355a8d25ca47f3e5350f909fe36789ea65dfe78a8382ee29198e66f6c46');
  assert.equal(sha(read(`${folder}/independent-readback.json`)), 'ef01d5b7989779e4834b863b9d2d1ce141804a463ddd8d9f1f9124dc202c27a6');
  const beforeBytes = read(baselinePath); assert.equal(sha(beforeBytes), baselineHash);
  const before = JSON.parse(beforeBytes), bridge = JSON.parse(bridgeBytes);
  const contracts = buildRollLabelCodingOptions(before, bridge);
  for (const input of bridge.sourceInputs) {
    const actual = read(input.path);
    if (sha(actual) === input.sha256) continue;
    assert.equal(input.path, projectionPath, `Changed coding source input: ${input.path}`);
    assert.equal(input.sha256, baselineHash);
    const current = restoreRollLabelCodingOptionDelta(JSON.parse(actual), before, contracts);
    const displayBytes = read('output/qa/roll-labels-2026-10-06/predecessor006-coding-code-font-source-check-046/coding-delivery-display-proposals.json');
    assert.equal(sha(displayBytes), 'ac9bceb49ffb2100bcd74fb7a91f7062a1e186b79d54cb2e7ed78b9a7326053b');
    const proposal = JSON.parse(displayBytes);
    for (const p of current.profiles) {
      const original = before.profiles.find(q => q.key === p.key);
      const display = proposal.profiles.find(q => q.profileKey === p.key)?.codingDeliveryDisplay;
      assert.deepEqual(p.codingDeliveryDisplay, display);
      assert.equal(p.sourceEvidenceSha256, display.sourceEvidenceSha256);
      for (const field of ['codingDeliveryDisplay', 'sourceEvidenceSha256']) {
        if (Object.hasOwn(original, field)) p[field] = original[field]; else delete p[field];
      }
    }
    assert.deepEqual(current, before, 'Foreign change in coding family projection');
  }
  for (const binding of bridge.bindings) assert.equal(sha(read(binding.sourceReceiptPath)), binding.sourceReceiptSha256);
  return contracts;
}
