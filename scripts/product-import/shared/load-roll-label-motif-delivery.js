import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Reuse the audited saved evidence; no extraction, monetary or remote writes. */
export function loadRollLabelMotifDelivery(root, families) {
  const directory = path.join(root, 'output/qa/roll-labels-2026-10-06/root-motif-delivery-audit-041');
  const auditBytes = fs.readFileSync(path.join(directory, 'saved-motif-delivery-audit.json'));
  const proposalBytes = fs.readFileSync(path.join(directory, 'display-contract-proposals.json'));
  assert.equal(sha(auditBytes), '2ff0cacc2a3f7b2b6aa509a1286d5b065f6be154f36c969b0b8ecc0980395725');
  assert.equal(sha(proposalBytes), 'c910a54f9c591c8b50290df6c5a10bc04b36bf8898ae090af42d4051556a80f8');
  const audit = JSON.parse(auditBytes), proposals = JSON.parse(proposalBytes), contracts = new Map();
  assert.equal(proposals.rows.length, 560);
  for (const row of proposals.rows) {
    const matches = families.flatMap(f => f.profiles).filter(p => p.key === row.profileKey);
    assert.equal(matches.length, 1); const p = matches[0];
    const evidence = audit.rows.find(e => e.profileKey === p.key);
    assert.ok(evidence?.separateRollDeliveryExplicit && evidence.pdfPageToMotifOrderExplicit && evidence.uniqueExactMotifLabels);
    assert.equal(p.format.motifCount, row.motifCount);
    assert.equal(p.sourceEvidenceSha256, row.sourceMaterialSha256);
    assert.equal(evidence.sourceSha256, row.sourceMaterialSha256);
    assert.equal(sha(fs.readFileSync(path.join(root, evidence.sourcePath))), row.sourceMaterialSha256);
    assert.equal(row.orderReady, false); assert.ok(!contracts.has(p.key));
    contracts.set(p.key, {version: 1, profileKey: p.key, sourceEvidenceSha256: row.sourceMaterialSha256,
      motifCount: row.motifCount, deliveryInstructionDa: row.deliveryInstructionDa, pdfInstructionDa: row.pdfInstructionDa, orderReady: false});
  }
  assert.equal(families.flatMap(f => f.profiles).filter(p => p.format.motifCount > 1).length, contracts.size);
  return contracts;
}
