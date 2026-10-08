/** Offline cross-branch exclusion, CONDITIONAL on the inherited analytic chord
 * bounds. Disjoint enclosing boxes exclude true-curve contact; overlapping
 * boxes never establish a contact, trim choice or complete-loop topology. */
import type { ShapePoint } from './sourceShapeReviewGeometry.ts';

export type ContactChord = {
  start: ShapePoint; end: ShapePoint; t0: number; t1: number; maxErrorMm: number;
};
export type ContactBranch = {
  segment: number; status: 'bounded_normal_branch' | 'bounded_endpoint_normal_branch' | 'refused';
  chords: ContactChord[];
};
type Box = readonly [bigint, bigint, bigint, bigint];
type Tree = { box: Box; first: number; last: number; left?: Tree; right?: Tree };
/** Half-open chord ranges, separating axis, orientation, exact positive gap.
 * gap * 2^scale2Exponent is a lower bound on Euclidean separation in mm. */
export type SeparationLeaf = readonly [number, number, number, number, 0 | 1, 1 | -1, string];
const bits = new DataView(new ArrayBuffer(8));
function dyadic(n: number): readonly [bigint, number] {
  if (n === 0) return [0n, 0];
  bits.setFloat64(0, n);
  const b = bits.getBigUint64(0), k = Number((b >> 52n) & 2047n);
  return [(b >> 63n ? -1n : 1n) * ((b & ((1n << 52n) - 1n)) + (k ? 1n << 52n : 0n)), k ? k - 1075 : -1074];
}
const min = (a: bigint, b: bigint) => a < b ? a : b;
const max = (a: bigint, b: bigint) => a > b ? a : b;
function validate(branches: ContactBranch[]) {
  if (!Array.isArray(branches) || branches.length < 2 || branches.length > 512) throw Error('Invalid contact branch budget');
  const ids = new Set<number>();
  let total = 0, exponent = Infinity;
  for (const b of branches) {
    if (!Number.isInteger(b.segment) || b.segment < 0 || ids.has(b.segment)) throw Error('Invalid native segment identity');
    ids.add(b.segment);
    if (!['bounded_normal_branch', 'bounded_endpoint_normal_branch', 'refused'].includes(b.status) || !Array.isArray(b.chords)) throw Error('Invalid branch status');
    if (b.status === 'refused') {
      if (b.chords.length) throw Error('Refused branch retains partial chords');
      continue;
    }
    if (!b.chords.length || b.chords.length > 32768) throw Error('Missing bounded branch');
    total += b.chords.length;
    if (total > 250000) throw Error('Contact chord budget exceeded');
    for (let i = 0; i < b.chords.length; i++) {
      const c = b.chords[i], prior = b.chords[i - 1];
      if (!Number.isFinite(c.t0) || !Number.isFinite(c.t1) || c.t0 < 0 || c.t1 > 1 || c.t0 >= c.t1
        || (i === 0 ? c.t0 !== 0 : c.t0 !== prior.t1) || (i === b.chords.length - 1 && c.t1 !== 1)) throw Error('Incomplete native parameter coverage');
      for (const p of [c.start, c.end]) if (!Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) throw Error('Invalid chord endpoint');
      if (!Number.isFinite(c.maxErrorMm) || c.maxErrorMm <= 0 || c.maxErrorMm > 0.05) throw Error('Invalid inherited error bound');
      if (prior && c.start.some((v, k) => v !== prior.end[k])) throw Error('Disconnected chord endpoints');
      for (const n of [...c.start, ...c.end, c.maxErrorMm]) {
        const [v, e] = dyadic(n); if (v !== 0n) exponent = Math.min(exponent, e);
      }
    }
  }
  return Number.isFinite(exponent) ? exponent : 0;
}
function tree(chords: ContactChord[], e: number): Tree {
  const integer = (n: number) => { const [v, k] = dyadic(n); return v === 0n ? 0n : v << BigInt(k - e); };
  const boxes: Box[] = chords.map(c => {
    const a = c.start.map(integer), b = c.end.map(integer), r = integer(c.maxErrorMm);
    // |Q(t)-L(t)| <= r implies each coordinate lies within this box.
    // Endpoint extrema plus/minus r are EXACT integer additions, no rounding.
    return [min(a[0], b[0]) - r, max(a[0], b[0]) + r, min(a[1], b[1]) - r, max(a[1], b[1]) + r];
  });
  const build = (first: number, last: number): Tree => {
    if (last - first === 1) return { box: boxes[first], first, last };
    const mid = first + Math.floor((last - first) / 2), left = build(first, mid), right = build(mid, last);
    const a = left.box, b = right.box;
    return { first, last, left, right, box: [min(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), max(a[3], b[3])] };
  };
  return build(0, chords.length);
}

/** A box certificate covers whole chord-index rectangles. A tube certificate
 * covers one chord pair with an exact separating projection. All integers use
 * the returned binary scale; tube gap has squared coordinate units. */
export type RefinedSeparationLeaf =
  | readonly ['box', number, number, number, number, 0 | 1, 1 | -1, string]
  | readonly ['tube', number, number, string, string, string, string];

function chordTubeSeparation(a: ContactChord, b: ContactChord, e: number): readonly [string, string, string, string] | null {
  const integer = (n: number) => { const [v, k] = dyadic(n); return v === 0n ? 0n : v << BigInt(k - e); };
  const ap = [a.start.map(integer), a.end.map(integer)], bp = [b.start.map(integer), b.end.map(integer)];
  const radius = integer(a.maxErrorMm) + integer(b.maxErrorMm);
  const axes: bigint[][] = [ap, bp].map(([p, q]) => [p[1] - q[1], q[0] - p[0]]);
  for (const p of ap) for (const q of bp) axes.push([q[0] - p[0], q[1] - p[1]]);
  for (let [nx, ny] of axes) {
    const normSquared = nx * nx + ny * ny;
    if (normSquared === 0n) continue;
    const project = (p: bigint[]) => nx * p[0] + ny * p[1];
    const aa = ap.map(project), bb = bp.map(project);
    let gap = min(bb[0], bb[1]) - max(aa[0], aa[1]);
    if (gap <= 0n) {
      gap = min(aa[0], aa[1]) - max(bb[0], bb[1]);
      nx = -nx; ny = -ny;
    }
    // For every true curve point the projection error is at most r*|n|.
    // Compare squared integers, with strict inequality and no sqrt/epsilon.
    if (gap > 0n && gap * gap > radius * radius * normSquared)
      return [String(nx), String(ny), String(gap), String(radius)];
  }
  return null;
}

/** Refine an explicit list of unresolved023 pairs, without changing023's
 * certificates. True curves remain conditional on inherited interpolation
 * bounds. Touching/overlapping tubes never prove an actual curve contact. */
export function refineSourceShapeBranchContacts(branches: ContactBranch[], candidates: readonly (readonly [number, number])[], maxWorkPerPair = 100000) {
  if (!Number.isInteger(maxWorkPerPair) || maxWorkPerPair < 1 || maxWorkPerPair > 1000000) throw Error('Invalid contact work budget');
  const scale2Exponent = validate(branches);
  if (!Array.isArray(candidates) || candidates.length > 130816) throw Error('Invalid candidate pair budget');
  const bySegment = new Map(branches.map((b, i) => [b.segment, i])), seen = new Set<string>();
  for (const pair of candidates) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || !pair.every(id => bySegment.has(id))) throw Error('Invalid candidate identity');
    const key = [...pair].sort((a, b) => a - b).join(':');
    if (seen.has(key)) throw Error('Duplicate candidate pair'); seen.add(key);
  }
  const trees = branches.map(b => b.status === 'refused' ? null : tree(b.chords, scale2Exponent));
  const pairs = candidates.map(segments => {
    const i = bySegment.get(segments[0])!, j = bySegment.get(segments[1])!;
    const a = trees[i], b = trees[j], separationLeaves: RefinedSeparationLeaf[] = [];
    let work = 0, tubeTests = 0, reason: string | null = null, unresolvedChordRanges: number[][] | null = null;
    const visit = (a: Tree, b: Tree): boolean => {
      if (work >= maxWorkPerPair) { reason = 'contact_work_budget'; return false; }
      work++;
      const gap = separation(a.box, b.box);
      if (gap) { separationLeaves.push(['box', a.first, a.last, b.first, b.last, gap[0], gap[1], String(gap[2])]); return true; }
      if (!a.left && !b.left) {
        tubeTests++;
        const tube = chordTubeSeparation(branches[i].chords[a.first], branches[j].chords[b.first], scale2Exponent);
        if (tube) { separationLeaves.push(['tube', a.first, b.first, ...tube]); return true; }
        reason = 'chord_tubes_overlap_contact_unresolved'; unresolvedChordRanges = [[a.first, a.last], [b.first, b.last]];
        return false;
      }
      if (a.left && (!b.left || a.last - a.first >= b.last - b.first)) return visit(a.left, b) && visit(a.right!, b);
      return visit(a, b.left!) && visit(a, b.right!);
    };
    const proved = a && b ? visit(a, b) : false;
    if (!a || !b) reason = 'unconstructed_native_branch';
    if (!proved) separationLeaves.length = 0;
    return { segments: [...segments], status: proved ? 'disjoint_inherited_curve_tubes' as const : 'unresolved' as const,
      reason, work, tubeTests, unresolvedChordRanges, separationLeaves };
  });
  return { arithmetic: 'exact_integer_dyadic_projection_separation' as const, scale2Exponent, maxWorkPerPair, pairs,
    boundValidityInherited: true as const, withinBranchInjectivityProved: false as const, actualContactsIsolated: false as const, joinsExamined: false as const,
    focalFragmentsExamined: false as const, retainedBoundaryAccepted: false as const, globalOffsetTopologyProved: false as const,
    scalingAuthorityProved: false as const, supplierJoinPolicyAccepted: false as const, sourceGeometryAccepted: false as const,
    designerAllowed: false as const, orderReady: false as const };
}
function separation(a: Box, b: Box): readonly [0 | 1, 1 | -1, bigint] | null {
  for (const axis of [0, 1] as const) {
    const k = axis * 2;
    if (a[k + 1] < b[k]) return [axis, 1, b[k] - a[k + 1]];
    if (b[k + 1] < a[k]) return [axis, -1, a[k] - b[k + 1]];
  }
  return null;
}

export function boundSourceShapeBranchContacts(branches: ContactBranch[], maxWorkPerPair = 100000) {
  if (!Number.isInteger(maxWorkPerPair) || maxWorkPerPair < 1 || maxWorkPerPair > 1000000) throw Error('Invalid contact work budget');
  const scale2Exponent = validate(branches);
  const trees = branches.map(b => b.status === 'refused' ? null : tree(b.chords, scale2Exponent));
  const pairs = [];
  for (let i = 0; i < branches.length; i++) for (let j = i + 1; j < branches.length; j++) {
    const a = trees[i], b = trees[j], separationLeaves: SeparationLeaf[] = [];
    let work = 0, reason: string | null = null, unresolvedChordRanges: number[][] | null = null;
    const visit = (a: Tree, b: Tree): boolean => {
      if (work >= maxWorkPerPair) { reason = 'contact_work_budget'; return false; }
      work++;
      const gap = separation(a.box, b.box);
      if (gap) { separationLeaves.push([a.first, a.last, b.first, b.last, gap[0], gap[1], String(gap[2])]); return true; }
      if (!a.left && !b.left) {
        reason = 'envelopes_overlap_contact_unresolved';
        unresolvedChordRanges = [[a.first, a.last], [b.first, b.last]];
        return false;
      }
      if (a.left && (!b.left || a.last - a.first >= b.last - b.first)) return visit(a.left, b) && visit(a.right!, b);
      return visit(a, b.left!) && visit(a, b.right!);
    };
    const proved = a && b ? visit(a, b) : false;
    if (!a || !b) reason = 'unconstructed_native_branch';
    // A failed traversal cannot retain a partial separation certificate.
    if (!proved) separationLeaves.length = 0;
    pairs.push({ segments: [branches[i].segment, branches[j].segment],
      status: proved ? 'disjoint_inherited_curve_envelopes' as const : 'unresolved' as const,
      reason, work, unresolvedChordRanges, separationLeaves });
  }
  return { arithmetic: 'exact_integer_dyadic_envelope_separation' as const, scale2Exponent, maxWorkPerPair, pairs,
    boundValidityInherited: true as const, withinBranchInjectivityProved: false as const,
    joinsExamined: false as const, focalFragmentsExamined: false as const, retainedBoundaryAccepted: false as const,
    globalOffsetTopologyProved: false as const, scalingAuthorityProved: false as const,
    supplierJoinPolicyAccepted: false as const, sourceGeometryAccepted: false as const,
    designerAllowed: false as const, orderReady: false as const };
}
