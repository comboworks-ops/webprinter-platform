import { assertCutContourRequirements, type CutContourRequirements } from '../designer/cutContourRequirements.ts';
import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelCutContourContract = {
  version:1; familyId:'25143'; profileKey:string; sourceEvidenceSha256:string;
  guideSha256:string; guideTextSha256:string; requirements:CutContourRequirements;
  geometryVerified:false; onlineDesignerVerified:false; orderReady:false;
};
const hash = (value:unknown) => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
/** Read exact profile evidence only; this is never permission to generate a
 * supplier shape, launch Designer, waive masks, price or prepare an order. */
export function readRollLabelCutContourContract(profile:RollLabelReviewProfile, familyId:string, candidate:unknown):RollLabelCutContourContract|null {
  if(!candidate || typeof candidate!=='object')return null;
  const c=candidate as RollLabelCutContourContract;
  if(c.version!==1 || familyId!=='25143' || c.familyId!==familyId || c.profileKey!==profile.key
    || profile.key!==`${profile.articleId}:${profile.sourceMaterialId}` || profile.format.shape!=='source_specific'
    || !profile.customerArtworkRequired || c.geometryVerified!==false || c.onlineDesignerVerified!==false || c.orderReady!==false
    || !hash(c.sourceEvidenceSha256) || c.sourceEvidenceSha256!==profile.artworkInstructions?.sourceEvidenceSha256
    || !hash(c.guideSha256) || !hash(c.guideTextSha256))return null;
  try{assertCutContourRequirements(c.requirements);}catch{return null;}
  return c;
}

/** Source-required production instructions, never a check of uploaded paths. */
export function rollLabelCutContourInstructions(profile:RollLabelReviewProfile,familyId:string):string[] {
  const c=readRollLabelCutContourContract(profile,familyId,profile.cutContourContract);
  if(!c)return [];
  return [
    `Læg skærelinjen på et separat lag med særfarven “${c.requirements.spotName}”.`,
    'Brug 100 % magenta og 100 % farvetone til skærelinjen.',
    'Linjen skal være 0,25 pt og stå til overtryk (overprint).',
  ];
}
