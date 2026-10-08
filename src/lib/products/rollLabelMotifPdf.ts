import type { RollLabelReviewProfile } from './rollLabelReview';
import { validateRollLabelConfiguration, type RollLabelSelection } from './rollLabelConfiguration';
import { readRollLabelMotifDelivery } from './rollLabelMotifDelivery';
import { readRollLabelSizeGeometry } from './rollLabelSizeGeometry';
import {readRollLabelMotifPageDimensions} from './rollLabelMotifPageDimensions';

export type RollLabelMotifPdfPage = {pageNumber:number;widthMm:number;heightMm:number;rotation:number};
export type RollLabelMotifPdfInspection = {sha256:string;pages:RollLabelMotifPdfPage[]};
export type RollLabelMotifPdfBinding = Extract<ReturnType<typeof bindRollLabelMotifPdf>, {valid:true}>;
export type RollLabelMotifPageReview = {configurationKey:string;sourceEvidenceSha256:string;pdfSha256:string;pageNumbers:number[]};

/** Manual visual acknowledgement of these exact bytes and slots, held in memory
 * only. It establishes neither print suitability nor a stored input contract. */
export function reviewRollLabelMotifPdf(binding:RollLabelMotifPdfBinding, review:RollLabelMotifPageReview) {
  if(review.configurationKey!==binding.configurationKey || review.pdfSha256!==binding.pdfSha256
    || review.sourceEvidenceSha256!==binding.sourceEvidenceSha256 || !Array.isArray(review.pageNumbers)
    || review.pageNumbers.length!==binding.pages.length
    || !binding.pages.every((page,index)=>review.pageNumbers[index]===page.pageNumber)) return null;
  return {...review,pageNumbers:[...review.pageNumbers],reviewedByUser:true as const,
    productionAccepted:false as const,designerAllowed:false as const,orderReady:false as const};
}
const canonical = (value:unknown):string => {
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(value && typeof value==='object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

/** A browser-local receipt, not an upload/order/saved-Designer input contract. */
export function rollLabelMotifPdfConfigurationKey(profile:RollLabelReviewProfile,selection:RollLabelSelection|null) {
  return canonical({profile,selection});
}

export function bindRollLabelMotifPdf(profile:RollLabelReviewProfile,selection:RollLabelSelection|null,inspection:RollLabelMotifPdfInspection) {
  const source=readRollLabelMotifDelivery(profile);
  if(!source || !selection || selection.profileKey!==profile.key || selection.articleId!==profile.articleId
    || selection.materialId!==profile.sourceMaterialId || !Array.isArray(selection.motifAllocations)
    || !/^[a-f0-9]{64}$/.test(inspection.sha256)) return {valid:false as const,reason:'Vælg en dokumenteret profil og en gyldig fordeling først.'};
  const checked=validateRollLabelConfiguration(profile,{dimensions:{width:String(selection.widthMm),height:String(selection.heightMm)},
    quantity:String(selection.quantity),allocations:selection.motifAllocations.map(String),optionStateId:selection.optionStateId},
  {productId:selection.productId,familyId:selection.familyId}).selection;
  if(!checked || canonical(checked)!==canonical(selection)) return {valid:false as const,reason:'PDF-kontrollen svarer ikke til det aktuelle valg.'};
  if(!Array.isArray(inspection.pages) || inspection.pages.length!==source.motifCount) return {valid:false as const,reason:`PDF-filen skal have præcis ${source.motifCount} sider, én pr. motiv.`};
  const geometry=readRollLabelSizeGeometry(profile);
  if(profile.sizeGeometry && (!geometry || geometry.sourceEvidenceSha256!==source.sourceEvidenceSha256))
    return {valid:false as const,reason:'Størrelsesdokumentationen svarer ikke til den valgte kildeprofil.'};
  const pageDimensions=readRollLabelMotifPageDimensions(profile);
  if(source.pageDimensions&&!pageDimensions)
    return {valid:false as const,reason:'Dokumentationen for PDF-mål svarer ikke til den valgte kildeprofil.'};
  const bleedMm=geometry?.bleedMm??pageDimensions?.bleedMm;
  const expected=bleedMm && selection.widthMm && selection.heightMm ? {
    widthMm:selection.widthMm+2*bleedMm,heightMm:selection.heightMm+2*bleedMm} : null;
  for(const [index,page] of inspection.pages.entries()) {
    if(page.pageNumber!==index+1 || page.rotation!==0 || ![page.widthMm,page.heightMm].every(n=>Number.isFinite(n)&&n>0))
      return {valid:false as const,reason:'Siderne skal være i fortløbende rækkefølge uden siderotation.'};
    // Allow only PDF number serialization precision, never artwork rescaling.
    if(expected && (Math.abs(page.widthMm-expected.widthMm)>0.01 || Math.abs(page.heightMm-expected.heightMm)>0.01))
      return {valid:false as const,reason:`PDF-side ${index+1} skal være ${expected.widthMm.toLocaleString('da-DK')} × ${expected.heightMm.toLocaleString('da-DK')} mm inklusive beskæringstillæg.`};
  }
  return {valid:true as const,configurationKey:rollLabelMotifPdfConfigurationKey(profile,selection),sourceEvidenceSha256:source.sourceEvidenceSha256,
    pdfSha256:inspection.sha256,sizeChecked:Boolean(expected),cutShapeChecked:false as const,
    pages:inspection.pages.map((page,index)=>({...page,motifNumber:index+1,quantity:selection.motifAllocations[index]})),
    productionAccepted:false as const,designerAllowed:false as const,orderReady:false as const};
}
