import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelStockDisplay = {
  version:1; familyId:string; productId:string; profileKey:string; articleId:string; materialId:string;
  sourceEvidenceSha256:string; sourceContractSha256:string;
  kind:'blank_label_roll'|'preprinted_notice_roll'|'thermal_transfer_ribbon'|'blank_a4_sheet_pack'|'neutral_booklet_sample';
  sourceQuantityUnit:'rolls'|'source_items'; quantities:Array<{quantity:number;sourcePriceScaleId:string}>;
  packaging:Partial<Record<'labelsPerRoll'|'ribbonWidthMm'|'ribbonLengthM'|'sheetsPerPack'|'labelsPerSheet'|'labelsPerPack'|'sampleLabels',number>>;
  customerArtworkRequired:false; onlineDesignerAllowed:false; quantityConvertedToLabels:false; orderReady:false;
};
const keys = ['version','familyId','productId','profileKey','articleId','materialId','sourceEvidenceSha256','sourceContractSha256',
  'kind','sourceQuantityUnit','quantities','packaging','customerArtworkRequired','onlineDesignerAllowed','quantityConvertedToLabels','orderReady'];
const packagingKeys = {
  blank_label_roll:['labelsPerRoll'], preprinted_notice_roll:['labelsPerRoll'],
  thermal_transfer_ribbon:['ribbonWidthMm','ribbonLengthM'], blank_a4_sheet_pack:['sheetsPerPack','labelsPerSheet','labelsPerPack'],
  neutral_booklet_sample:['sampleLabels'],
};
const hash = (value:unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
/** Current backend-owned evidence only. No query/saved overrides, conversion,
 * price authority or artwork/order permission is derived from this display. */
export function readRollLabelStockDisplay(profile:RollLabelReviewProfile, productId:string, familyId:string):RollLabelStockDisplay|null {
  const c=profile.stockDisplay;
  if (!c || Object.keys(c).length !== keys.length || Object.keys(c).some(key => !keys.includes(key))
    || c.version!==1 || c.productId!==productId || c.familyId!==familyId || c.profileKey!==profile.key
    || c.articleId!==profile.articleId || c.materialId!==profile.sourceMaterialId
    || profile.key!==`${profile.articleId}:${profile.sourceMaterialId}` || profile.customerArtworkRequired!==false
    || profile.blockers.length || profile.orderReady!==false || c.customerArtworkRequired!==false
    || c.onlineDesignerAllowed!==false || c.quantityConvertedToLabels!==false || c.orderReady!==false
    || !hash(c.sourceEvidenceSha256) || c.sourceEvidenceSha256!==profile.sourceEvidenceSha256
    || c.sourceEvidenceSha256!==profile.artworkInstructions?.sourceEvidenceSha256 || !hash(c.sourceContractSha256)
    || !['rolls','source_items'].includes(c.sourceQuantityUnit) || !Array.isArray(c.quantities)
    || !Array.isArray(profile.sourceQuantityBindings) || c.quantities.length!==profile.sourceQuantities.length
    || c.quantities.length!==profile.sourceQuantityBindings.length || !c.quantities.length
    || !c.quantities.every((q,i) => q && typeof q==='object' && !Array.isArray(q) && Object.keys(q).length===2 && Number.isSafeInteger(q.quantity) && q.quantity>0
      && q.quantity===profile.sourceQuantities[i] && q.quantity===profile.sourceQuantityBindings?.[i].quantity
      && typeof q.sourcePriceScaleId==='string' && /^\d+$/.test(q.sourcePriceScaleId)
      && q.sourcePriceScaleId===profile.sourceQuantityBindings?.[i].sourcePriceScaleId)) return null;
  if (!Object.prototype.hasOwnProperty.call(packagingKeys,c.kind)) return null;
  const allowed=packagingKeys[c.kind];
  if (!c.packaging || typeof c.packaging!=='object' || Array.isArray(c.packaging) || Object.keys(c.packaging).some(key => !allowed.includes(key))
    || Object.values(c.packaging).some(n => !Number.isFinite(n) || (n as number)<=0)) return null;
  if (c.kind==='blank_a4_sheet_pack' && (!Number.isSafeInteger(c.packaging.sheetsPerPack)
    || !Number.isSafeInteger(c.packaging.labelsPerSheet) || !Number.isSafeInteger(c.packaging.labelsPerPack)
    || c.packaging.sheetsPerPack! * c.packaging.labelsPerSheet! !== c.packaging.labelsPerPack)) return null;
  if (c.kind==='thermal_transfer_ribbon' && (!c.packaging.ribbonWidthMm || !c.packaging.ribbonLengthM)) return null;
  if (c.kind==='neutral_booklet_sample' && !Number.isSafeInteger(c.packaging.sampleLabels)) return null;
  if (c.packaging.labelsPerRoll!==undefined && !Number.isSafeInteger(c.packaging.labelsPerRoll)) return null;
  return c;
}
export function rollLabelStockPackagingLines(c:RollLabelStockDisplay):string[] {
  const p=c.packaging, n=(value:number)=>value.toLocaleString('da-DK');
  if(c.kind==='thermal_transfer_ribbon') return [`Båndbredde: ${n(p.ribbonWidthMm!)} mm`, `Båndlængde: ${n(p.ribbonLengthM!)} m`];
  if(c.kind==='blank_a4_sheet_pack') return [`${n(p.sheetsPerPack!)} A4-ark pr. pakke`, `${n(p.labelsPerSheet!)} ${p.labelsPerSheet===1 ? 'etiket' : 'etiketter'} pr. ark`, `${n(p.labelsPerPack!)} etiketter pr. pakke`];
  if(c.kind==='neutral_booklet_sample') return [`Neutral prøvestrimmel med ${n(p.sampleLabels!)} etiketter`];
  return [...(p.labelsPerRoll ? [`${n(p.labelsPerRoll)} etiketter pr. rulle`] : []),
    ...(c.kind==='preprinted_notice_roll' ? ['Leveres med fortrykt tysk motiv.'] : ['Leveres uden tryk.'])];
}
