import { currentRollLabelSelection, rollLabelPdfHash } from '../designer/rollLabelGeneratedTemplate';
import { assertSourceShapePath, assertSourceShapeSegments, sourceShapeContinuity, reviewSourceShapeAtSize, type SourceShapeSegment } from '../designer/sourceShapeReviewGeometry.ts';
import { readRollLabelCutContourContract } from './rollLabelCutContourContract.ts';
import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelSpecialShapeModel = {
  version:1; status:'native_example_model_unaccepted'; articleId:string; sha256:string;
  sourceAuditSha256:string; exceptionAuditSha256:string;
  sourceDocuments:Array<{role:'guide'|'template';sha256:string;pageCount:1;placeholderDimensions:true;explicitExample:boolean}>;
  templateNativePath:SourceShapeSegment[]; templateSafePaths:SourceShapeSegment[][];
  guideNativePaths:SourceShapeSegment[][]; guideSafePaths:SourceShapeSegment[][];
  guideTemplateCorrespondence:'operator_comparison_only'|'sampled_proximity_only';
  scalingAuthorityProved:false; offsetAuthorityProved:false; sourceGeometryAccepted:false;
};
export type RollLabelSpecialShapeProposal = {
  version:1; status:'source_special_shape_proposed_unaccepted'; model:'native_example_affine_diagnostics_only';
  productId:string;familyId:'25143';profileKey:string;articleId:string;materialId:string;
  currentProfileSha256:string;sourceEvidenceSha256:string;sourceShapeSha256:string;cutContractSha256:string;sha256:string;
  bleedMm:3;safeMm:3;scalingAuthorityProved:false;sourceGeometryAccepted:false;onlineDesignerVerified:false;orderReady:false;
};
const hash = (v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'
  ?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as Record<string,unknown>)[k])}`).join(',')}}`:JSON.stringify(v)??'null';
export const rollLabelSpecialShapeHash=(value:unknown)=>rollLabelPdfHash(new TextEncoder().encode(canonical(value)));
export const rollLabelSpecialCurrentProfileHash=(productId:string,familyId:string,sections:unknown,profile:RollLabelReviewProfile)=>
  rollLabelSpecialShapeHash({productId,familyId,sections,profile});

/** Explicit local review inputs only, absent from ordinary template, Designer,
 * saved-geometry and order resolution. Affine diagnostics NEVER accept a shape. */
export async function reviewCurrentRollLabelSpecialShapeProposal(selection:unknown,productId:string,
  productContract:unknown,candidate:unknown,sourceModel:unknown,cutCandidate:unknown) {
  const current=currentRollLabelSelection(selection,productId,productContract);
  if(!current||!candidate||typeof candidate!=='object'||!sourceModel||typeof sourceModel!=='object')return null;
  const c=candidate as RollLabelSpecialShapeProposal,m=sourceModel as RollLabelSpecialShapeModel;
  const {profile:p,contract,selection:s}=current;
  const cut=readRollLabelCutContourContract(p,contract.familyId,cutCandidate);
  if(!cut||c.version!==1||c.status!=='source_special_shape_proposed_unaccepted'||c.model!=='native_example_affine_diagnostics_only'
    ||c.productId!==productId||c.familyId!=='25143'||c.familyId!==contract.familyId||c.profileKey!==p.key
    ||c.articleId!==p.articleId||c.materialId!==p.sourceMaterialId||p.format.shape!=='source_specific'||!p.format.customSize
    ||![c.sha256,c.currentProfileSha256,c.sourceEvidenceSha256,c.sourceShapeSha256,c.cutContractSha256].every(hash)
    ||c.sourceEvidenceSha256!==cut.sourceEvidenceSha256||c.bleedMm!==3||c.safeMm!==3
    ||c.scalingAuthorityProved!==false||c.sourceGeometryAccepted!==false||c.onlineDesignerVerified!==false||c.orderReady!==false
    ||m.version!==1||m.status!=='native_example_model_unaccepted'||m.articleId!==p.articleId
    ||![m.sha256,m.sourceAuditSha256,m.exceptionAuditSha256].every(hash)||m.sha256!==c.sourceShapeSha256
    ||m.scalingAuthorityProved!==false||m.offsetAuthorityProved!==false||m.sourceGeometryAccepted!==false
    ||!['operator_comparison_only','sampled_proximity_only'].includes(m.guideTemplateCorrespondence)
    ||!Array.isArray(m.sourceDocuments)||m.sourceDocuments.length!==2
    ||['guide','template'].some(role=>m.sourceDocuments.filter(d=>d&&d.role===role&&d.pageCount===1
      &&hash(d.sha256)&&d.placeholderDimensions===true&&typeof d.explicitExample==='boolean').length!==1)
    ||m.sourceDocuments.find(d=>d.role==='guide')!.sha256!==cut.guideSha256
    ||m.sourceDocuments.find(d=>d.role==='template')!.explicitExample!==true
    ||![m.templateSafePaths,m.guideNativePaths,m.guideSafePaths].every(a=>Array.isArray(a)&&a.length<=16)
    ||m.guideNativePaths.length<1)return null;
  const {sha256:proposalSha,...proposalPayload}=c,{sha256:modelSha,...modelPayload}=m;
  if(await rollLabelSpecialShapeHash(proposalPayload)!==proposalSha||await rollLabelSpecialShapeHash(modelPayload)!==modelSha
    ||await rollLabelSpecialCurrentProfileHash(productId,contract.familyId,contract.sections,p)!==c.currentProfileSha256
    ||await rollLabelSpecialShapeHash(cut)!==c.cutContractSha256)return null;
  try {
    [m.templateNativePath,...m.guideNativePaths].forEach(assertSourceShapePath);
    [...m.templateSafePaths,...m.guideSafePaths].forEach(assertSourceShapeSegments);
    const geometry=reviewSourceShapeAtSize(m.templateNativePath,s.widthMm!,s.heightMm!,c.bleedMm,c.safeMm);
    const blockers=['source_example_scaling_unaccepted','source_safe_topology_unaccepted','normal_offset_join_policy_unproved','exact_curve_topology_unproved'];
    if(geometry.diagnostics.nonSmoothJoins)blockers.push('non_smooth_curve_joins');
    if(geometry.diagnostics.stationarySamples)blockers.push('stationary_curve_samples');
    if(geometry.diagnostics.inwardFocalRadiusExceededSamples)blockers.push('inward_offset_focal_radius_exceeded');
    if(geometry.diagnostics.outwardFocalRadiusExceededSamples)blockers.push('outward_offset_focal_radius_exceeded');
    if(geometry.diagnostics.polylineCrossings.length)blockers.push('flattened_outline_crossing');
    const art=p.artworkInstructions;
    if(art?.documentationStatus!=='no_selective_mask_required_by_signals'||!Array.isArray(art.requirements)||art.requirements.length)blockers.push('selective_material_rules_require_review');
    if(p.format.motifCount!==1||(p.format.pageCount!==null&&p.format.pageCount!==1))blockers.push('multiple_motifs_or_pages_unimplemented');
    return {proposal:c,selection:s,geometry,blockers,cutRequirements:cut.requirements,
      sourceSafePaths:{guide:m.guideSafePaths.map(sourceShapeContinuity),template:m.templateSafePaths.map(sourceShapeContinuity)},
      sourceGeometryAccepted:false as const,designerAllowed:false as const,orderReady:false as const};
  }catch{return null;}
}
