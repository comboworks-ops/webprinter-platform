import type {RollLabelReviewProfile} from './rollLabelReview';
import {readRollLabelStockDisplay} from './rollLabelStockDisplay';
export type RollLabelStockFormatDisplay={
  version:1;productId:string;familyId:string;profileKey:string;articleId:string;materialId:string;formatValueId:string;
  sourceEvidenceSha256:string;sourceStockContractSha256:string;articleEvidenceSha256:string;sha256:string;
  dimensions:{kind:'label_mm';widthMm:number;heightMm:number}|{kind:'diameter_mm';diameterMm:number}|{kind:'ribbon_mm_m';widthMm:number;lengthM:number};
  geometryAccepted:false;orderReady:false;
};
const keys=['version','productId','familyId','profileKey','articleId','materialId','formatValueId','sourceEvidenceSha256',
  'sourceStockContractSha256','articleEvidenceSha256','sha256','dimensions','geometryAccepted','orderReady'];
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const n=(value:number)=>value.toLocaleString('da-DK',{maximumFractionDigits:6});
/** Display is bound to the current exact stock selection. It never supplies a
 * production size, Designer document or pricing dimension. */
export function readRollLabelStockFormatDisplay(profile:RollLabelReviewProfile,productId:string,familyId:string):RollLabelStockFormatDisplay|null {
  const stock=readRollLabelStockDisplay(profile,productId,familyId),c=profile.stockFormatDisplay;
  if(!stock||!c||Object.keys(c).length!==keys.length||Object.keys(c).some(k=>!keys.includes(k))
    ||c.version!==1||c.productId!==productId||c.familyId!==familyId||c.profileKey!==profile.key
    ||c.articleId!==profile.articleId||c.materialId!==profile.sourceMaterialId||c.formatValueId!==profile.formatValueId
    ||c.sourceEvidenceSha256!==stock.sourceEvidenceSha256||c.sourceStockContractSha256!==stock.sourceContractSha256
    ||!hash(c.articleEvidenceSha256)||!hash(c.sha256)||c.geometryAccepted!==false||c.orderReady!==false
    ||profile.format.customSize!==false||!c.dimensions||typeof c.dimensions!=='object'||Array.isArray(c.dimensions))return null;
  const d=c.dimensions;
  const allowed=d.kind==='label_mm'?['kind','widthMm','heightMm']:d.kind==='diameter_mm'?['kind','diameterMm']:
    d.kind==='ribbon_mm_m'?['kind','widthMm','lengthM']:null;
  if(!allowed||Object.keys(d).length!==allowed.length||Object.keys(d).some(k=>!allowed.includes(k))
    ||Object.entries(d).some(([key,value])=>key!=='kind'&&(typeof value!=='number'||!Number.isFinite(value)||value<=0)))return null;
  if(stock.kind==='thermal_transfer_ribbon') {
    if(d.kind!=='ribbon_mm_m'||d.widthMm!==stock.packaging.ribbonWidthMm||d.lengthM!==stock.packaging.ribbonLengthM)return null;
  } else if(stock.kind==='neutral_booklet_sample'&&profile.format.shape==='circle') {
    if(d.kind!=='diameter_mm')return null;
    if(profile.format.dimensions&&(profile.format.dimensions.widthMm!==d.diameterMm||profile.format.dimensions.heightMm!==d.diameterMm))return null;
  } else {
    if(d.kind!=='label_mm')return null;
    if(profile.format.dimensions&&(Math.abs(profile.format.dimensions.widthMm-d.widthMm)>1e-8||Math.abs(profile.format.dimensions.heightMm-d.heightMm)>1e-8))return null;
  }
  return c;
}
export function rollLabelStockFormatLine(c:RollLabelStockFormatDisplay):string {
  const d=c.dimensions;
  if(d.kind==='ribbon_mm_m')return `Båndformat: ${n(d.widthMm)} mm bredde × ${n(d.lengthM)} m længde`;
  if(d.kind==='diameter_mm')return `Etiketdiameter: Ø ${n(d.diameterMm)} mm`;
  return `Etiketmål: ${n(d.widthMm)} × ${n(d.heightMm)} mm`;
}
