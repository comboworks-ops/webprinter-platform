/** Separate local review packet. Never updates the geometry registry, catalogue,
 * canonical packages, templates or prices. No network or hosted writes. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { rollLabelOvalCurrentProfileHash, rollLabelOvalProposalHash, reviewCurrentRollLabelOvalProposal,
  type RollLabelOvalProposal, type RollLabelOvalRestriction } from '../../src/lib/products/rollLabelOvalProposal';
import { validateRollLabelConfiguration } from '../../src/lib/products/rollLabelConfiguration';
import type { RollLabelReviewFamily } from '../../src/lib/products/rollLabelReview';
const root = process.cwd(), target = path.join(root,'output/qa/roll-labels-2026-10-06/semantic-014');
const sourceBytes = fs.readFileSync(path.join(target,'oval-source-review.json'));
const source = JSON.parse(sourceBytes.toString());
if (source.records.length !== 302 || source.sourceGeometryAccepted !== false || source.remoteWrites !== false) throw Error('Invalid source review scope');
const families = new Map<string,RollLabelReviewFamily>();
const proposals: RollLabelOvalProposal[] = [], checks: unknown[] = [];
for (const r of source.records.filter(r => r.proposalEligible)) {
  let family = families.get(r.familyId);
  if (!family) { family = JSON.parse(fs.readFileSync(path.join(root,`output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/${r.familyId}.json`),'utf8')); families.set(r.familyId,family!); }
  const p = family!.profiles.find(p => p.key === r.profileKey);
  if (!p || (p.artworkInstructions && p.artworkInstructions.sourceEvidenceSha256 !== r.sourceEvidenceSha256)) throw Error('Changed current material evidence '+r.profileKey);
  const rules = r.sourceDocuments[0].explicitRules;
  const payload: Omit<RollLabelOvalProposal,'sha256'> = {
    version: 1, status: 'source_semantics_proposed_unaccepted', model: 'mathematical_ellipse_true_normal_offsets',
    productId: family!.productId, familyId: r.familyId, profileKey: p.key, articleId: p.articleId, materialId: p.sourceMaterialId,
    currentProfileSha256: await rollLabelOvalCurrentProfileHash(family!.productId,r.familyId,family!.sections,p), sourceEvidenceSha256:r.sourceEvidenceSha256,
    bleedMm:rules.bleedMm,safeMm:rules.safeMm,
    sourceDocuments:r.sourceDocuments.map(d => ({role:d.role,sha256:d.sha256,textSha256:d.textSha256,pageCount:d.pageCount})),
    sourceRestrictions:[...new Set(r.sourceRestrictions.map(c => c.kind))] as RollLabelOvalRestriction[],
    supplierEllipseIdentityProved:false,sourceGeometryAccepted:false,onlineDesignerVerified:false,orderReady:false };
  const proposal = {...payload,sha256:await rollLabelOvalProposalHash(payload)};
  const contract = {version:1,productId:family!.productId,familyId:r.familyId,sections:family!.sections,profiles:family!.profiles,orderReady:false};
  const w=p.sizeContract!.axes.find(a=>a.axis==='width')!,h=p.sizeContract!.axes.find(a=>a.axis==='height')!;
  const cases = [[50,50],[w.minMm,h.minMm],[w.minMm,h.maxMm],[w.maxMm,h.minMm],[w.maxMm,h.maxMm]].map(([width,height])=>
    [Math.max(w.minMm,Math.min(w.maxMm,width)),Math.max(h.minMm,Math.min(h.maxMm,height))]);
  for (const [width,height] of cases) {
    const selection=validateRollLabelConfiguration(p,{dimensions:{width:String(width),height:String(height)},quantity:String(1000*p.format.motifCount),
      allocations:Array(p.format.motifCount).fill('1000'),optionStateId:p.optionStates!.initialStateId!},contract).selection;
    // Multi-motif source quantities use an exact integer allocation.
    if (!selection) throw Error('Invalid proposal selection '+p.key);
    const checked=await reviewCurrentRollLabelOvalProposal(selection,family!.productId,contract,proposal);
    if (!checked && p.artworkInstructions) throw Error('Proposal gate failure '+p.key);
    if (checked && (checked.designerAllowed || checked.orderReady || checked.sourceGeometryAccepted)) throw Error('Proposal opened a gate');
    checks.push({profileKey:p.key,widthMm:width,heightMm:height,geometryConstructed:Boolean(checked?.geometry),
      geometryError:checked?.geometryError ?? null,blockers:checked?.blockers ?? ['material_binding_missing','supplier_ellipse_semantics_unaccepted'],
      productionCutlinePolicy:checked?.productionCutlinePolicy ?? 'unproved'});
  }
  proposals.push(proposal);
}
if (proposals.length !== 179 || new Set(proposals.map(p=>p.profileKey)).size !== 179) throw Error('Incomplete exact proposals');
const result={version:1,sourceReviewSha256:createHash('sha256').update(sourceBytes).digest('hex'),proposals,checks,
  counts:{proposals:proposals.length,families:families.size,selectionChecks:checks.length},sourceGeometryAccepted:false,remoteWrites:false};
const output=path.join(target,'oval-proposals.json');fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({path:output,counts:result.counts,sha256:createHash('sha256').update(fs.readFileSync(output)).digest('hex')}));
