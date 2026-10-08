import {createHash} from 'node:crypto';
import {applyConversionRule} from './product-import/shared/conversion.js';
import {validateRollLabelConfiguration,type RollLabelSelection} from '../src/lib/products/rollLabelConfiguration';
import {rollLabelPriceSelectionKey,type RollLabelPricePreview,type RollLabelPricePoint} from '../src/lib/products/rollLabelPricePreview';
import type {RollLabelReviewFamily} from '../src/lib/products/rollLabelReview';

export const rollLabelPreviewRules=['wmd_roll_labels_threshold_fx_7_6','wmd_tiered_fx_7_6'] as const;
export type SavedRollPrice={sourceKey:string;quantity:number;supplierPrice:number;supplierCurrency:string;extractedAt:string;
  dimensions:{widthMm:number|null;heightMm:number|null};selections:Record<string,string>;extraData:{familyId:string;signature:string;
    commercialApproval:boolean;livePrice:boolean;responseSha256:string};rawPayload:{sourceRequest:Record<string,unknown>}};
const object=(value:string)=>JSON.parse(value) as Record<string,unknown>;
const canonical=(value:Record<string,unknown>)=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));

export function buildRollLabelPricePreview(family:RollLabelReviewFamily,rows:SavedRollPrice[],ruleKey:string):RollLabelPricePreview{
  if(!rollLabelPreviewRules.some(rule=>rule===ruleKey))throw Error('Unknown preview pricing rule');
  const points=new Map<string,RollLabelPricePoint>(),ambiguous=new Set<string>();let excludedRows=0;
  for(const row of rows){
    if(row.extraData.familyId!==family.familyId)continue;
    const profile=family.profiles.find(p=>p.key===row.sourceKey);
    if(!profile||profile.blockers.length){excludedRows++;continue;}
    try{
      if(row.supplierCurrency!=='EUR'||!Number.isFinite(row.supplierPrice)||row.supplierPrice<=0
        ||row.extraData.livePrice!==false||row.extraData.commercialApproval!==false
        ||!row.extraData.responseSha256||!Number.isFinite(Date.parse(row.extractedAt))
        ||row.selections.article!==profile.articleId||row.selections.material!==profile.sourceMaterialId
        ||row.selections.delivery!=='STANDARD_PRODUCTION'||row.selections.additional_options!=='[]'||row.selections.artwork_mode!=='1')throw Error('Foreign or incomplete captured price');
      const request=row.rawPayload.sourceRequest;
      if(String(request.articleId)!==profile.articleId||String(request.substrateId)!==profile.sourceMaterialId
        ||Number(request.quantity)!==row.quantity||request.deliveryOption!==row.selections.delivery
        ||String(request.ownPrintData)!==row.selections.artwork_mode
        ||JSON.stringify(request.articleOptions)!==row.selections.article_services
        ||JSON.stringify(request.additionalOptions)!==row.selections.additional_options)throw Error('Changed quote context');
      const options=object(row.selections.options);
      const requestOptions=Object.fromEntries(Object.entries((request.additionalUpsells??{}) as Record<string,{id:unknown}>).map(([key,value])=>[key,String(value.id)]));
      if(canonical(requestOptions)!==canonical(options)
        ||(request.width!==undefined&&Number(request.width)*10!==row.dimensions.widthMm)
        ||(request.height!==undefined&&Number(request.height)*10!==row.dimensions.heightMm)
        ||(profile.format.customSize&&(request.width===undefined||request.height===undefined)))throw Error('Changed source options or dimensions');
      const states=profile.optionStates?.states.filter(s=>canonical(s.options)===canonical(options));
      if(states?.length!==1)throw Error('Unknown exact option state');
      const allocation=object(row.selections.motif_allocation);
      if(canonical((request.enhancedSize??{}) as Record<string,unknown>)!==canonical(allocation))throw Error('Changed motif request');
      const allocations=Object.keys(allocation).length===0&&profile.format.motifCount===1?[row.quantity]:
        Object.values(allocation).flatMap(group=>{
          if(!group||typeof group!=='object'||Array.isArray(group))throw Error('Invalid motif slots');
          const entries=Object.entries(group).sort(([a],[b])=>Number(a.replace('Motiv ',''))-Number(b.replace('Motiv ','')));
          if(entries.some(([key],i)=>key!==`Motiv ${i+1}`))throw Error('Invalid motif order');
          return entries.map(([,q])=>Number(q));
        });
      if(Object.keys(allocation).length>1)throw Error('Ambiguous motif slots');
      const checked=validateRollLabelConfiguration(profile,{dimensions:{width:String(row.dimensions.widthMm??''),height:String(row.dimensions.heightMm??'')},
        quantity:String(row.quantity),allocations:allocations.map(String),optionStateId:states[0].id},{productId:family.productId,familyId:family.familyId});
      const selection=checked.selection;
      if(!selection||selection.widthMm!==row.dimensions.widthMm||selection.heightMm!==row.dimensions.heightMm
        ||Number(row.selections.width_mm)!==selection.widthMm||Number(row.selections.height_mm)!==selection.heightMm
        ||selection.motifAllocations.some((q,i)=>q!==allocations[i]))throw Error('Captured configuration not supported');
      const priceDkk=applyConversionRule(row.supplierPrice,ruleKey).finalPriceDkk;
      if(!Number.isSafeInteger(priceDkk)||priceDkk<=0)throw Error('Invalid DKK proposal');
      const key=rollLabelPriceSelectionKey(selection);
      // Even same-price duplicates may differ in service context: no merging.
      if(points.has(key)||ambiguous.has(key)){excludedRows+=points.has(key)?2:1;points.delete(key);ambiguous.add(key);continue;}
      points.set(key,{id:createHash('sha256').update(JSON.stringify([key,row.selections,row.extraData.signature,ruleKey])).digest('hex'),selection,priceDkk,capturedAt:row.extractedAt});
    }catch{excludedRows++;}
  }
  return {version:1,status:'captured_price_proposals',productId:family.productId,familyId:family.familyId,ruleKey,currency:'DKK',
    points:[...points.values()],excludedRows,commercialApproved:false,orderReady:false};
}

/** Reject client-created identities, option maps and dimension/quantity errors.
 * The rebuilt selection must match every supplied field exactly. */
export function readRollLabelPriceSelection(family:RollLabelReviewFamily,input:unknown):RollLabelSelection|null{
  if(!input||typeof input!=='object')return null;
  const s=input as RollLabelSelection,profile=family.profiles.find(p=>p.key===s.profileKey);
  const fields=['version','productId','familyId','profileKey','articleId','materialId','optionStateId','sourceOptions','widthMm','heightMm','quantity','motifCount','motifAllocations'];
  if(Object.keys(s).length!==fields.length||Object.keys(s).some(key=>!fields.includes(key)))return null;
  if(!profile||!Array.isArray(s.motifAllocations)||!s.sourceOptions||typeof s.sourceOptions!=='object'
    ||Array.isArray(s.sourceOptions)||typeof s.widthMm!=='number'||typeof s.heightMm!=='number')return null;
  const checked=validateRollLabelConfiguration(profile,{dimensions:{width:String(s.widthMm),height:String(s.heightMm)},quantity:String(s.quantity),
    allocations:s.motifAllocations.map(String),optionStateId:s.optionStateId},{productId:family.productId,familyId:family.familyId});
  return checked.selection&&rollLabelPriceSelectionKey(checked.selection)===rollLabelPriceSelectionKey(s)?checked.selection:null;
}
