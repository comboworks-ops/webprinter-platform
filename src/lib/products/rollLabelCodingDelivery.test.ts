import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRollLabelCodingDelivery, rollLabelCodingInstructions } from './rollLabelCodingDelivery.ts';
import { rollLabelSizeGuide } from './rollLabelSizeGeometry.ts';
import type { RollLabelReviewProfile } from './rollLabelReview';
const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/30968.json', 'utf8'));
const profiles = family.profiles as RollLabelReviewProfile[];
test('all16 coding profiles bind exact source prose and four guide identities, keeping delivery closed', () => {
  assert.equal(profiles.length, 16);
  const documents = new Set<string>();
  for (const p of profiles) {
    const c = readRollLabelCodingDelivery(p); assert.ok(c, p.key);
    assert.deepEqual(c.instructionsDa, rollLabelCodingInstructions);
    assert.equal(c.sourceEvidenceSha256, p.artworkInstructions!.sourceEvidenceSha256);
    assert.equal(c.codingDeliveryVerified, false); assert.equal(c.orderReady, false);
    documents.add(c.sourceGuidePdfSha256);
  }
  assert.equal(documents.size, 4);
});
test('foreign/stale profile, source, guide, semantic prose or forged delivery permission is discarded', () => {
  for (const p of profiles) for (const change of [
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.profileKey += '-foreign'; },
    (p: RollLabelReviewProfile) => { p.sourceEvidenceSha256 = '0'.repeat(64); },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.sourceEvidenceSha256 = '0'.repeat(64); },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.sourceGuidePdfSha256 = '0'.repeat(64); },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.sourceGuideTextSha256 = '0'.repeat(64); },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.sourceGuideUrl += '?foreign'; },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.instructionsDa[1] = 'Sidste række trykkes først.'; },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.instructionsDa.push('CSV accepteres.'); },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.codingDeliveryVerified = true as false; },
    (p: RollLabelReviewProfile) => { p.codingDeliveryDisplay!.orderReady = true as false; },
    (p: RollLabelReviewProfile) => { p.optionFields = p.optionFields.filter(f => f.sourceFieldId !== '2059'); },
  ]) {
    const changed = structuredClone(p); change(changed);
    assert.equal(readRollLabelCodingDelivery(changed), null, p.key);
  }
});
test('all8 primitive coding guides include required delivery instructions without changing geometry', () => {
  let generated = 0;
  for (const p of profiles) {
    const guide = rollLabelSizeGuide(p, 50, 50);
    if (!guide) continue;
    generated++;
    for (const line of rollLabelCodingInstructions) assert.ok(guide.instructionsDa!.includes(line));
    const old = structuredClone(p); delete old.codingDeliveryDisplay;
    const before = rollLabelSizeGuide(old, 50, 50)!;
    const onlyOldInstructions = structuredClone(guide);
    onlyOldInstructions.instructionsDa = onlyOldInstructions.instructionsDa!.filter(line => !rollLabelCodingInstructions.includes(line));
    assert.deepEqual(onlyOldInstructions, before);
  }
  assert.equal(generated, 8);
});
test('display integration preserves its exact023 delta independently of later024 options', () => {
  const before = JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/coding-display-023/before-artifacts/review/families/30968.json', 'utf8'));
  // Exact024 before copy isolates this historical023 display change. Current
  // integrated options and receipt identities are checked in their own suite.
  const restored = JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/coding-options-024/before-artifacts/review/families/30968.json', 'utf8'));
  for (const p of restored.profiles) {
    delete p.codingDeliveryDisplay; delete p.sourceEvidenceSha256;
    assert.equal(p.optionStates.states.length, 1);
  }
  assert.deepEqual(restored, before);
  for (const key of ['61434:1210903', '61434:1210904']) {
    const p = profiles.find(p => p.key === key)!;
    assert.equal(p.optionStates!.states[0].options['2058'], undefined);
  }
});
