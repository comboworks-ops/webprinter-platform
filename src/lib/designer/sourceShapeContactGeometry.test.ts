import test from 'node:test';
import assert from 'node:assert/strict';
import { boundSourceShapeBranchContacts, type ContactBranch, type ContactChord } from './sourceShapeContactGeometry.ts';
const line = (y: number, error = 0.01): ContactChord => ({ start: [0, y], end: [10, y], t0: 0, t1: 1, maxErrorMm: error });
const branch = (segment: number, chords: ContactChord[]): ContactBranch => ({ segment, status: 'bounded_normal_branch', chords });

test('exact envelopes prove separated true-curve bounds, with no topology or production upgrade', () => {
  const input = [branch(0, [line(0)]), branch(1, [line(1)])], original = JSON.stringify(input);
  const g = boundSourceShapeBranchContacts(input), p = g.pairs[0];
  assert.equal(p.status, 'disjoint_inherited_curve_envelopes');
  assert.equal(p.reason, null); assert.equal(p.separationLeaves.length, 1);
  assert.ok(BigInt(p.separationLeaves[0][6]) > 0n);
  assert.equal(g.boundValidityInherited, true);
  for (const k of ['globalOffsetTopologyProved', 'retainedBoundaryAccepted', 'withinBranchInjectivityProved', 'joinsExamined', 'focalFragmentsExamined', 'scalingAuthorityProved', 'sourceGeometryAccepted', 'designerAllowed', 'orderReady'] as const) assert.equal(g[k], false);
  assert.equal(JSON.stringify(input), original);
});
test('crossing, tangency and disjoint chords with overlapping error tubes stay unresolved', () => {
  const crossing: ContactChord = { start: [5, -1], end: [5, 1], t0: 0, t1: 1, maxErrorMm: 0.01 };
  for (const c of [crossing, line(0), line(0.015), line(0.02)]) {
    const p = boundSourceShapeBranchContacts([branch(0, [line(0)]), branch(1, [c])]).pairs[0];
    assert.equal(p.status, 'unresolved'); assert.equal(p.reason, 'envelopes_overlap_contact_unresolved');
    assert.equal(p.separationLeaves.length, 0); assert.deepEqual(p.unresolvedChordRanges, [[0, 1], [0, 1]]);
  }
});
test('subnormal and large-coordinate gaps use exact sums that floating inflation loses', () => {
  for (const [base, gap, r] of [[0, Number.MIN_VALUE * 4, Number.MIN_VALUE], [1e6 - 1, 2 ** -32, 2 ** -35]]) {
    const p = boundSourceShapeBranchContacts([branch(0, [line(base, r)]), branch(1, [line(base + gap, r)])]).pairs[0];
    assert.equal(p.status, 'disjoint_inherited_curve_envelopes');
  }
  // Binary values 0.02 and 2*0.01 are equal: an exact touching tube is refused.
  assert.equal(boundSourceShapeBranchContacts([branch(0, [line(0)]), branch(1, [line(0.02)])]).pairs[0].status, 'unresolved');
});
test('hierarchical exclusion covers all chord pairs while respecting a hard work budget', () => {
  const a: ContactChord[] = [
    { start: [0, 0], end: [0, 10], t0: 0, t1: 0.5, maxErrorMm: 0.01 },
    { start: [0, 10], end: [10, 10], t0: 0.5, t1: 1, maxErrorMm: 0.01 },
  ];
  const b: ContactChord = { start: [2, 2], end: [8, 8], t0: 0, t1: 1, maxErrorMm: 0.01 };
  const p = boundSourceShapeBranchContacts([branch(0, a), branch(1, [b])]).pairs[0];
  assert.equal(p.status, 'disjoint_inherited_curve_envelopes'); assert.equal(p.separationLeaves.length, 2);
  assert.equal(p.separationLeaves.reduce((n, l) => n + (l[1] - l[0]) * (l[3] - l[2]), 0), 2);
  const limited = boundSourceShapeBranchContacts([branch(0, a), branch(1, [b])], 2).pairs[0];
  assert.equal(limited.status, 'unresolved'); assert.equal(limited.reason, 'contact_work_budget');
  assert.equal(limited.work, 2); assert.deepEqual(limited.separationLeaves, []);
});
test('unconstructed branches and broken parameter coverage cannot disappear from the pair inventory', () => {
  const refused: ContactBranch = { segment: 7, status: 'refused', chords: [] };
  const g = boundSourceShapeBranchContacts([branch(0, [line(0)]), branch(1, [line(2)]), refused]);
  assert.equal(g.pairs.length, 3); assert.equal(g.pairs.filter(p => p.reason === 'unconstructed_native_branch').length, 2);
  for (const mutation of [
    (c: ContactChord) => { c.t0 = 0.1; },
    (c: ContactChord) => { c.t1 = 0.9; },
    (c: ContactChord) => { c.maxErrorMm = 0; },
    (c: ContactChord) => { c.start = [NaN, 0]; },
  ]) {
    const c = line(0); mutation(c);
    assert.throws(() => boundSourceShapeBranchContacts([branch(0, [c]), branch(1, [line(1)])]));
  }
  assert.throws(() => boundSourceShapeBranchContacts([branch(0, [line(0)]), branch(0, [line(1)])]), /identity/);
  assert.throws(() => boundSourceShapeBranchContacts([branch(0, [line(0)]), { ...refused, chords: [line(1)] }]), /partial/);
  assert.throws(() => boundSourceShapeBranchContacts([branch(0, [line(0)]), branch(1, [line(1)])], 0), /budget/);
});
