import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelArtworkInstructions = {
  version:1; profileKey:string; sourceEvidenceSha256:string; documentationStatus:string;
  requirements:Array<{kind:'white'|'hot_foil'|'spot_uv';
    condition:{type:'source_option'|'material'|'material_or_article';sourceFieldId?:string;sourceValueId?:string};
    documented:boolean;instructionsDa:string[]}>;
  onlineDesignerVerified:false;
};

/** Resolve requirements from the currently witnessed complete source vector. */
export function rollLabelArtworkForState(profile:RollLabelReviewProfile,stateId:string) {
  const contract=profile.artworkInstructions;
  if(!contract || contract.version!==1 || contract.profileKey!==profile.key || contract.onlineDesignerVerified!==false) return [];
  const state=profile.optionStates?.states.find(state=>state.id===stateId);
  return contract.requirements.filter(requirement=>requirement.condition.type==='material' || requirement.condition.type==='material_or_article'
    || (requirement.condition.type==='source_option' && state && requirement.condition.sourceFieldId
      && state.options[requirement.condition.sourceFieldId]===requirement.condition.sourceValueId));
}
