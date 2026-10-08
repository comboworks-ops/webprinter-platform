import type {RollLabelReviewProfile} from './rollLabelReview';
import {readRollLabelMotifDelivery} from './rollLabelMotifDelivery';

/** Data-page envelope only. No oval identity, contour offsets or mask proof. */
export type RollLabelMotifPageDimensions = {
  version:1;profileKey:string;sourceEvidenceSha256:string;shape:'oval'|'custom_contour';motifCount:number;
  sizeContract:NonNullable<RollLabelReviewProfile['sizeContract']>;bleedMm:3;
  scope:'pdf_page_dimensions_only';sha256:string;
  evidence:Array<{role:'guide'|'template';sha256:string;textSha256:string}>;
  cutShapeAccepted:false;designerAllowed:false;orderReady:false;
};
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:
  v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);

export function readRollLabelMotifPageDimensions(profile:RollLabelReviewProfile):RollLabelMotifPageDimensions|null {
  const delivery=readRollLabelMotifDelivery(profile),r=delivery?.pageDimensions;
  if(!r||r.version!==1||r.profileKey!==profile.key||r.sourceEvidenceSha256!==profile.sourceEvidenceSha256
    ||!hash(r.sha256)||!hash(r.sourceEvidenceSha256)||profile.blockers.length||!profile.format.customSize
    ||r.shape!==profile.format.shape||!['oval','custom_contour'].includes(r.shape)||r.motifCount!==profile.format.motifCount
    ||r.bleedMm!==3||r.scope!=='pdf_page_dimensions_only'||r.cutShapeAccepted!==false||r.designerAllowed!==false||r.orderReady!==false
    ||!profile.sizeContract||canonical(r.sizeContract)!==canonical(profile.sizeContract)
    ||!Array.isArray(r.evidence)||r.evidence.length!==2
    ||['guide','template'].some(role=>r.evidence.filter(e=>e.role===role&&hash(e.sha256)&&hash(e.textSha256)).length!==1))return null;
  return r;
}
