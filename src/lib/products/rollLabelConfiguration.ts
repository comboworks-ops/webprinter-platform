import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelSelection = {
  version: 1; productId: string; familyId: string; profileKey: string;
  articleId: string; materialId: string; optionStateId: string;
  sourceOptions: Record<string,string>; widthMm: number | null; heightMm: number | null;
  quantity: number; motifCount: number; motifAllocations: number[];
};
export type RollLabelProductContract = {
  version: 1; productId: string; familyId: string;
  sections: {format:string;material:string}; profiles: RollLabelReviewProfile[];
  orderReady: false;
};
export type RollLabelConfigurationDraft = {dimensions:Record<string,string>;quantity:string;allocations:string[];optionStateId:string};

export function readRollLabelProductContract(value:unknown,productId:string):RollLabelProductContract|null {
  if (!value || typeof value!=='object') return null;
  const contract=value as RollLabelProductContract;
  if(contract.version!==1 || contract.productId!==productId || contract.orderReady!==false
    || typeof contract.familyId!=='string' || !contract.sections?.format || !contract.sections?.material
    || !Array.isArray(contract.profiles) || !contract.profiles.every(profile=>typeof profile.key==='string'
      && Array.isArray(profile.blockers) && Array.isArray(profile.optionFields) && Array.isArray(profile.quantityInputs)
      && Array.isArray(profile.sourceQuantities) && profile.format && profile.optionStates?.version===1
      && profile.optionStates.profileKey===profile.key && Array.isArray(profile.optionStates.states))) return null;
  return contract;
}

export function rollLabelOptionTransition(profile:RollLabelReviewProfile,currentId:string,fieldId:string,valueId:string) {
  const current = profile.optionStates?.states.find(state=>state.id===currentId);
  if (!current || !Object.prototype.hasOwnProperty.call(current.options,fieldId)) return null;
  const transition=profile.optionStates?.transitions?.find(t=>t.fromStateId===currentId&&t.fieldId===fieldId&&t.valueId===valueId);
  if(transition) return profile.optionStates?.states.find(state=>state.id===transition.toStateId) || null;
  const wanted = {...current.options,[fieldId]:valueId};
  const matches = profile.optionStates?.states.filter(state=>Object.keys(state.options).length===Object.keys(wanted).length
    && Object.entries(wanted).every(([key,value])=>state.options[key]===value));
  return matches?.length===1 ? matches[0] : null;
}

/** Reconstruct from the current exact profile. Foreign or stale return state is
 * discarded instead of leaking dimensions/options into another material. */
export function rollLabelInitialDraft(profile:RollLabelReviewProfile,selection?:RollLabelSelection|null,identity?:{productId:string;familyId:string}):RollLabelConfigurationDraft {
  const restored = selection?.version===1 && (!identity || (selection.productId===identity.productId && selection.familyId===identity.familyId))
    && selection?.profileKey===profile.key && selection.articleId===profile.articleId
    && selection.materialId===profile.sourceMaterialId
    && selection.motifCount===profile.format.motifCount && Array.isArray(selection.motifAllocations)
    && profile.optionStates?.states.some(state=>state.id===selection.optionStateId);
  return {dimensions:restored ? {width:String(selection.widthMm??''),height:String(selection.heightMm??'')} : {},
    quantity:restored ? String(selection.quantity) : String(profile.sourceQuantities[0]||''),
    allocations:restored && selection.motifAllocations.length===profile.format.motifCount
      ? selection.motifAllocations.map(String) : Array(profile.format.motifCount).fill(''),
    optionStateId:restored ? selection.optionStateId : profile.optionStates?.initialStateId || ''};
}

export function validateRollLabelConfiguration(profile:RollLabelReviewProfile,draft:RollLabelConfigurationDraft,identity:{productId:string;familyId:string}) {
  const state = profile.optionStates?.states.find(state=>state.id===draft.optionStateId);
  const axes = profile.sizeContract?.axes || [];
  const entered = (axis:string)=>Number((draft.dimensions[axis]||'').replace(',','.'));
  const sizeValid = !profile.format.customSize || (axes.length>0 && axes.every(axis=>Number.isFinite(entered(axis.axis))
    && entered(axis.axis)>=axis.minMm && entered(axis.axis)<=axis.maxMm));
  const quantity = Number(draft.quantity);
  const input = profile.quantityInputs.find(input=>input.name==='menge');
  const quantityValid = Number.isSafeInteger(quantity) && quantity>=Number(input?.min||1)
    && (!input?.max||quantity<=Number(input.max))
    && (input || !profile.sourceQuantities.length || profile.sourceQuantities.includes(quantity));
  const motifCount = profile.format.motifCount;
  const allocations = motifCount===1 ? [quantity] : draft.allocations.map(Number);
  const allocationValid = allocations.length===motifCount && allocations.every(value=>Number.isSafeInteger(value)&&value>0)
    && allocations.reduce((a,b)=>a+b,0)===quantity;
  const valid = Boolean(profile.format.motifCount>=1 && Number.isSafeInteger(profile.format.motifCount)
    && !profile.blockers.length && sizeValid && quantityValid && allocationValid && state
    && profile.optionStates?.profileKey===profile.key);
  const widthMm = profile.format.customSize ? entered('width') : profile.format.dimensions?.widthMm??null;
  const heightMm = profile.format.customSize ? (profile.sizeContract?.heightFromWidth ? widthMm : entered('height')) : profile.format.dimensions?.heightMm??null;
  const selection:RollLabelSelection|null = valid && state ? {version:1,...identity,profileKey:profile.key,
    articleId:profile.articleId,materialId:profile.sourceMaterialId,optionStateId:state.id,sourceOptions:{...state.options},
    widthMm,heightMm,quantity,motifCount,motifAllocations:allocations} : null;
  return {valid,sizeValid,quantityValid:Boolean(quantityValid),allocationValid,selection};
}

export function resolveRollLabelProductProfile(contract:RollLabelProductContract,productId:string,selection:Record<string,string|null|undefined>) {
  if (contract.version!==1 || contract.productId!==productId || contract.orderReady!==false || !Array.isArray(contract.profiles)) return null;
  const matches = contract.profiles.filter(profile=>!profile.blockers.length
    && profile.formatValueId===selection[contract.sections.format] && profile.materialValueId===selection[contract.sections.material]);
  return matches.length===1 ? matches[0] : null;
}
