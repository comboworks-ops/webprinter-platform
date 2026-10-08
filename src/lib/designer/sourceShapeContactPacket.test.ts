import fs from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boundSourceShapeBranchContacts } from './sourceShapeContactGeometry.ts';
const base = 'output/qa/roll-labels-2026-10-06';
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const packet = read(base + '/contact-geometry-023/contact-geometry.json');
const original = read(base + '/bounded-geometry-018/bounded-geometry.json');
const endpoint = read(base + '/endpoint-geometry-019/endpoint-geometry.json');
test('contact packet preserves all135 cases/459 profile identities and every closed permission', () => {
  assert.equal(packet.cases.length, 135);
  assert.deepEqual(packet.inheritedProfileBindings, endpoint.currentBindings);
  assert.equal(packet.inheritedProfileBindings.length, 459);
  assert.equal(packet.counts.allNativeBranchPairs, 199870);
  assert.equal(packet.counts.disjointPairs, 132555);
  assert.equal(packet.counts.unresolvedEnvelopePairs, 4517);
  assert.equal(packet.counts.unconstructedPairs, 62798);
  assert.equal(packet.counts.budgetPairs, 0);
  assert.equal(packet.counts.inheritedChords, 130410);
  for (const k of ['sourceGeometryAccepted', 'globalOffsetTopologyProved', 'retainedBoundaryAccepted', 'scalingAuthorityProved', 'supplierJoinPolicyAccepted', 'designerAllowed', 'orderReady', 'fullCatalogueComplete', 'remoteWrites']) assert.equal(packet[k], false);
  for (const c of packet.cases) for (const side of ['bleed', 'safe']) {
    assert.equal(c[side].joinsExamined, false);
    assert.equal(c[side].focalFragmentsExamined, false);
    assert.equal(c[side].withinBranchInjectivityProved, false);
    assert.equal(c[side].globalOffsetTopologyProved, false);
  }
});
test('six complex source cases reproduce the entire cross-branch decision and certificate inventory', () => {
  for (const articleId of ['25016', '25019', '25021', '25027', '25034', '25039']) {
    const c = original.cases.find(c => c.articleId === articleId && c.widthMm === 50 && c.heightMm === 50);
    const extra = endpoint.cases.find(n => n.key === c.key), saved = packet.cases.find(n => n.key === c.key);
    assert.equal(saved.sourceShapeSha256, c.sourceShapeSha256);
    for (const side of ['bleed', 'safe']) {
      const branches = c[side].branches.map(b => extra[side].branches.find(n => n.segment === b.segment) ?? b);
      assert.deepEqual(boundSourceShapeBranchContacts(branches), saved[side]);
    }
  }
});
test('all consumed geometry/focal/injectivity and protected price/document/cut artifacts remain byte-identical', () => {
  assert.equal(Object.keys(packet.inputHashes).length, 10);
  for (const [path, hash] of Object.entries(packet.inputHashes)) assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'), hash, path);
  const verified = read(base + '/contact-geometry-023/independent-verification.json');
  assert.equal(verified.packetSha256, createHash('sha256').update(fs.readFileSync(base + '/contact-geometry-023/contact-geometry.json')).digest('hex'));
  assert.equal(verified.counts.disjointPairs, packet.counts.disjointPairs);
  assert.equal(verified.analyticChordBoundsReconstructed, false);
  assert.equal(verified.globalOffsetTopologyProved, false);
});
