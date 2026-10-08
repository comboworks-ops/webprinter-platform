import {rollLabelDanishLabel,rollLabelHash} from './roll-label-catalogue.js';
import {rollLabelOptionKey} from './roll-label-option-states.js';

/** Fresh source evidence adds explicit parent/child transitions to a single
 * article/material. It cannot refresh prices or lend fields to other profiles. */
export function appendRollLabelSourceTransitions(profile,contract,record) {
  if(record.profileKey!==profile.key || record.status!=='passed' || record.sourceMaterialSha256!==profile.sourceEvidenceSha256) throw Error('Foreign or stale roll transition evidence');
  const source=record.optionsEvidence?.response?.data?.response;
  if(record.optionsEvidence?.response?.code!==200) throw Error('Roll transition options unavailable');
  const fields=Object.values(source.additionalFieldsData||{});
  const values=field=>Array.isArray(field.werte)?field.werte:Object.values(field.werte||{});
  const fieldValues=Object.fromEntries(profile.optionFields.map(f=>[f.sourceFieldId,f.values.map(v=>({sourceValueId:v.sourceValueId,labelDa:v.labelDa,rotationDegrees:v.rotationDegrees}))]));
  for(const field of fields) {
    const key=String(field.id);if(!fieldValues[key]) throw Error('Unexpected roll transition field');
    for(const value of values(field).sort((a,b)=>Number(a.sort)-Number(b.sort))) {
      const id=String(value.id);
      if(!fieldValues[key].some(v=>v.sourceValueId===id)) fieldValues[key].push({sourceValueId:id,labelDa:rollLabelDanishLabel(value.bezeichnung),
        rotationDegrees:key==='222'?({'117':0,'114':90,'115':270,'116':180}[id]??null):null});
    }
  }
  const result={...contract,states:[...contract.states],fieldValues,transitions:[]};
  const baseline=result.states.find(s=>s.id===contract.initialStateId);
  if(!baseline || baseline.options['473']!=='1681') throw Error('Manual baseline absent');
  const machine=[];
  for(const row of record.quotes) {
    const request=row.evidence.request,response=row.evidence?.response?.data?.response;
    if(row.status!=='passed'||!Object.values(row.checks).every(Boolean)||String(request.articleId)!==profile.articleId||String(request.substrateId)!==profile.sourceMaterialId
      ||row.evidence?.response?.code!==200||response?.currency!=='EUR'||!(Number(response.price)>0)||Number(response.quantity)!==Number(request.quantity)) throw Error('Invalid roll transition quote');
    if(!Object.entries(request.additionalUpsells).every(([key,value])=>fieldValues[key]?.some(v=>v.sourceValueId===String(value.id))
      && (response.additionalUpsells[key]||[]).some(echo=>echo.value===value.value))) throw Error('Roll transition echo mismatch');
    const options=Object.fromEntries(Object.entries(request.additionalUpsells).map(([id,value])=>[id,String(value.id)]));
    const key=rollLabelOptionKey(options),id=rollLabelHash({profileKey:profile.key,options:key});
    if(options['473']!=='1682'||options['222']==='11293') throw Error('Unresolved dependent direction');
    const state={id,options,evidence:[{signature:rollLabelHash(request),responseSha256:row.evidence.response_sha256,
      widthMm:request.width?Number(request.width)*10:profile.format.dimensions?.widthMm??null,
      heightMm:request.height?Number(request.height)*10:request.width&&profile.format.shape==='circle'?Number(request.width)*10:profile.format.dimensions?.heightMm??null,
      quantity:Number(request.quantity)}]};
    if(!result.states.some(s=>s.id===id))result.states.push(state);
    machine.push(state);
  }
  if(!machine.length)throw Error('No accepted machine transition');
  // Source has no preselected machine direction. Choose its first recorded
  // direction explicitly, resetting the dependent child; never retain manual's
  // invalid arbitrary direction. Reverse restores the witnessed manual vector.
  result.transitions.push({fromStateId:baseline.id,fieldId:'473',valueId:'1682',toStateId:machine[0].id});
  for(const state of machine) result.transitions.push({fromStateId:state.id,fieldId:'473',valueId:'1681',toStateId:baseline.id});
  return result;
}
