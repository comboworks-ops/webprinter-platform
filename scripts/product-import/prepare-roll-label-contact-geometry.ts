/** Consumes immutable018/019 bounds. No extraction, remote I/O or application
 * binding/policy changes. This packet excludes contacts only conditionally on
 * those analytic bounds, and never selects an actual retained boundary. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { boundSourceShapeBranchContacts, type ContactBranch } from '../../src/lib/designer/sourceShapeContactGeometry.ts';
const base = 'output/qa/roll-labels-2026-10-06';
const target = base + '/contact-geometry-023';
if (fs.existsSync(target)) throw Error('Preserve existing023 output');
const inputs = new Map<string, string>();
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function protect(p: string, expected: string) {
  const actual = sha(p); if (actual !== expected) throw Error('Changed protected input ' + p);
  inputs.set(p, actual);
}
const oldPath = base + '/bounded-geometry-018/bounded-geometry.json';
const nextPath = base + '/endpoint-geometry-019/endpoint-geometry.json';
protect(oldPath, '4308bf7c775f5649b854393603738c1c5fb0d06c5c950376bdbed6396a843b28');
protect(nextPath, '9a0bde65d30381463fc8f599e80175fc38c46ab302cf11b7584dd9b4852877f6');
// Freshly bind the existing independent injectivity/focal evidence without
// claiming its scopes as new contacts or promoting them to retained boundaries.
for (const [name, hash] of [
  ['root-independent-endpoint-direction-partition-020.json', '6377c038b03b11b26878f927dd46f473daf97a990efded761f87053b5a74c6b7'],
  ['root-independent-forward-fragment-chords-020.json', '116c025cfd1218045746e6a7baa65b819992ec969d646a140adcbc9331582bf8'],
  ['root-independent-true-fragment-injectivity-020.json', '6c43bca86aa75ffdb61d6a2811c39f8651c1d0812caf506c8935554c760d0dd3'],
  ['root-independent-whole-branch-projection-020.json', '37e0ce8b9aaedcd2f9ad98de5b395aefa4131ccb89f4f7db8a9d640dc80687dd'],
  ['root-independent-endpoint-whole-branch-injectivity-020.json', 'd3cb0483cb0e050ec608322262f515d69c160cf96c9c5fa696e0e4a69324b9da'],
]) protect(base + '/' + name, hash);
const catalogue = 'output/supplier-imports/roll-labels-catalogue-2026-10-06';
for (const [name, hash] of [
  ['import-review/proposed-exact-prices.jsonl', '645dcab7924b3dbdb7a6db7429708a46756f7027751c63989f9819112efe5f0a'],
  ['dimension-documents/exact-size-bindings.jsonl', '2692827bb169f0e25cb224a072c3a2228953e8b42196fd99a3c29fd1ef9310cb'],
  ['source-cut-contour-contracts.json', '519e99ed8dc4a4aae1f6d0ff6f5526bdf4c09de325f0c976a01cea26aa6eb165'],
]) protect(catalogue + '/' + name, hash);
type Side = { branches: ContactBranch[]; joins: { kind: string }[] };
type Case = { key: string; articleId: string; widthMm: number; heightMm: number; sourceShapeSha256: string; bleed: Side; safe: Side };
const old = JSON.parse(fs.readFileSync(oldPath, 'utf8')) as { cases: Case[]; currentBindings: unknown[] };
const next = JSON.parse(fs.readFileSync(nextPath, 'utf8')) as { cases: Case[]; currentBindings: unknown[] };
const counts = { sizeCases: 0, sideCases: 0, boundedBranches: 0, refusedBranches: 0, inheritedChords: 0,
  allNativeBranchPairs: 0, disjointPairs: 0, unresolvedEnvelopePairs: 0, unconstructedPairs: 0,
  budgetPairs: 0, separationLeaves: 0, pairBoxTests: 0, inheritedRoundArcs: 0, inheritedRefusedJoins: 0 };
const cases = old.cases.map(c => {
  const addition = next.cases.find(n => n.key === c.key);
  if (!addition || addition.sourceShapeSha256 !== c.sourceShapeSha256) throw Error('Changed native case binding');
  counts.sizeCases++;
  const sides = (['bleed', 'safe'] as const).map(side => {
    const branches = c[side].branches.map(b => {
      const replacement = addition[side].branches.find(n => n.segment === b.segment);
      if (replacement && b.status !== 'refused') throw Error('Unexpected019 replacement');
      return replacement ?? b;
    });
    const joins = c[side].joins.map((j, i) => addition[side].joins.find(n => (n as { afterSegment?: number }).afterSegment === i) ?? j);
    const contacts = boundSourceShapeBranchContacts(branches);
    counts.sideCases++; counts.boundedBranches += branches.filter(b => b.status !== 'refused').length;
    counts.refusedBranches += branches.filter(b => b.status === 'refused').length;
    counts.inheritedChords += branches.reduce((n, b) => n + b.chords.length, 0);
    counts.inheritedRoundArcs += joins.filter(j => j.kind === 'analytic_round_arc').length;
    counts.inheritedRefusedJoins += joins.filter(j => j.kind === 'refused').length;
    counts.allNativeBranchPairs += contacts.pairs.length;
    for (const p of contacts.pairs) {
      counts.pairBoxTests += p.work; counts.separationLeaves += p.separationLeaves.length;
      if (p.status === 'disjoint_inherited_curve_envelopes') counts.disjointPairs++;
      else if (p.reason === 'unconstructed_native_branch') counts.unconstructedPairs++;
      else if (p.reason === 'contact_work_budget') counts.budgetPairs++;
      else counts.unresolvedEnvelopePairs++;
    }
    return [side, contacts] as const;
  });
  return { key: c.key, articleId: c.articleId, widthMm: c.widthMm, heightMm: c.heightMm,
    sourceShapeSha256: c.sourceShapeSha256, ...Object.fromEntries(sides) };
});
if (counts.sizeCases !== 135 || counts.boundedBranches !== 6544 || counts.refusedBranches !== 1626 || counts.inheritedChords !== 130410) throw Error('Changed inherited coverage');
for (const [p, hash] of inputs) if (sha(p) !== hash) throw Error('Input changed during contact preparation');
fs.mkdirSync(target, { recursive: true });
const write = (name: string, data: unknown) => fs.writeFileSync(target + '/' + name, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
write('contact-geometry.json', { version: 1, status: 'local_conditional_cross_branch_exclusion', counts, cases,
  inheritedProfileBindings: next.currentBindings, inputHashes: Object.fromEntries(inputs),
  sourceGeometryAccepted: false, globalOffsetTopologyProved: false, retainedBoundaryAccepted: false,
  scalingAuthorityProved: false, supplierJoinPolicyAccepted: false, designerAllowed: false, orderReady: false,
  fullCatalogueComplete: false, remoteWrites: false });
console.log(JSON.stringify({ target, counts, packetSha256: sha(target + '/contact-geometry.json') }));
