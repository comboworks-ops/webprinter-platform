import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadRollLabelCodingOptions, restoreRollLabelCodingOptionDelta } from './load-roll-label-coding-options.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
/** Reuse source-bound046 prose; no coding dataset, quote/state or money writes. */
export function loadRollLabelCodingDelivery(root, families) {
  const file = path.join(root, 'output/qa/roll-labels-2026-10-06/predecessor006-coding-code-font-source-check-046/coding-delivery-display-proposals.json');
  const bytes = fs.readFileSync(file);
  assert.equal(sha(bytes), 'ac9bceb49ffb2100bcd74fb7a91f7062a1e186b79d54cb2e7ed78b9a7326053b');
  const proposal = JSON.parse(bytes), contracts = new Map();
  for (const input of proposal.sourceInputs) {
    const actual = fs.readFileSync(path.join(root, input.path));
    if (sha(actual) === input.sha256) continue;
    //046 also hashed the then-current projection. After local integration,
    // restore ONLY the validated023 display delta against its byte-exact copy.
    assert.equal(input.path, 'output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/30968.json');
    const beforeBytes = fs.readFileSync(path.join(root, 'output/qa/roll-labels-2026-10-06/coding-display-023/before-artifacts/review/families/30968.json'));
    assert.equal(sha(beforeBytes), input.sha256);
    const before = JSON.parse(beforeBytes), restored = JSON.parse(actual);
    if (restored.profiles.some(p => JSON.stringify(p.optionStates) !== JSON.stringify(before.profiles.find(q => q.key === p.key)?.optionStates))) {
      restoreRollLabelCodingOptionDelta(restored, before, loadRollLabelCodingOptions(root));
    }
    for (const p of restored.profiles) {
      const row = proposal.profiles.find(r => r.profileKey === p.key), old = before.profiles.find(o => o.key === p.key);
      assert.ok(row && old);
      assert.deepEqual(p.codingDeliveryDisplay, row.codingDeliveryDisplay);
      assert.equal(p.sourceEvidenceSha256, row.codingDeliveryDisplay.sourceEvidenceSha256);
      for (const field of ['sourceEvidenceSha256', 'codingDeliveryDisplay']) {
        if (Object.hasOwn(old, field)) p[field] = old[field]; else delete p[field];
      }
    }
    assert.deepEqual(restored, before, 'Foreign change in current coding projection');
  }
  assert.equal(proposal.profiles.length, 16);
  for (const row of proposal.profiles) {
    const matches = families.filter(f => f.sourceFamilyId === row.familyId && f.productId === row.productId)
      .flatMap(f => f.profiles).filter(p => p.key === row.profileKey);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].sourceEvidenceSha256, row.codingDeliveryDisplay.sourceEvidenceSha256);
    assert.equal(row.codingDeliveryDisplay.profileKey, row.profileKey);
    assert.equal(row.codingDeliveryDisplay.orderReady, false);
    assert.equal(row.codingDeliveryDisplay.codingDeliveryVerified, false);
    assert.ok(!contracts.has(row.profileKey)); contracts.set(row.profileKey, row.codingDeliveryDisplay);
  }
  return contracts;
}
