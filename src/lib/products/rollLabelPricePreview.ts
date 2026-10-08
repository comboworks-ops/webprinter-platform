import type {RollLabelSelection} from './rollLabelConfiguration';
export type RollLabelPricePoint={id:string;selection:RollLabelSelection;priceDkk:number;capturedAt:string;
  matrix?:{variantName:string;variantValue:string;formatValueId:string;contextValueId:string}};
export type RollLabelPricePreview={version:1;productId:string;familyId:string;ruleKey:string;currency:'DKK';
  status:'captured_price_proposals';points:RollLabelPricePoint[];excludedRows:number;commercialApproved:false;orderReady:false};

/** Full identity, including quantity, dimensions and motif allocation. Never
 * use these development proposals as checkout/payment authority. */
export function rollLabelPriceSelectionKey(selection:RollLabelSelection){
  return JSON.stringify([selection.version,selection.productId,selection.familyId,selection.profileKey,selection.articleId,
    selection.materialId,selection.optionStateId,Object.entries(selection.sourceOptions).sort(([a],[b])=>a.localeCompare(b)),
    selection.widthMm,selection.heightMm,selection.quantity,selection.motifCount,selection.motifAllocations]);
}
export function rollLabelPriceForSelection(packet:RollLabelPricePreview,selection:RollLabelSelection|null){
  if(!selection||packet.productId!==selection.productId||packet.familyId!==selection.familyId)return null;
  const key=rollLabelPriceSelectionKey(selection),matches=packet.points.filter(p=>rollLabelPriceSelectionKey(p.selection)===key);
  return matches.length===1?matches[0]:null;
}
export function rollLabelPriceInitialSelection(packet:RollLabelPricePreview|null,profileKey:string,initialStateId?:string|null){
  const points=packet?.points.filter(p=>p.selection.profileKey===profileKey)??[];
  return (points.find(p=>p.selection.optionStateId===initialStateId&&p.selection.quantity===1000)
    ??points.find(p=>p.selection.optionStateId===initialStateId)??points[0])?.selection??null;
}
