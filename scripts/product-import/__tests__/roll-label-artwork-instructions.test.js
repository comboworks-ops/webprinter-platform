import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildRollLabelArtworkInstructions} from '../shared/roll-label-artwork-instructions.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const profiles=fs.readFileSync(`${base}/normalized/article-material-profiles.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
const audits=JSON.parse(fs.readFileSync(`${base}/artwork-instructions.json`)).profiles;

test('exact documentation retains effect conditions and cannot promote Designer or foreign source',()=>{
 const profile=profiles.find(p=>p.key==='65613:1299749');const audit=audits.find(p=>p.profileKey===profile.key);
 const result=buildRollLabelArtworkInstructions(profile,audit);
 assert.equal(result.requirements.length,10);assert.equal(result.onlineDesignerVerified,false);
 for(const requirement of result.requirements){assert.equal(requirement.condition.sourceFieldId,'2861');assert.ok(requirement.documented);
  assert.ok(requirement.instructionsDa[0].includes(requirement.kind==='hot_foil'?'praegung':'lack'));
  assert.ok(requirement.instructionsDa.some(line=>line.includes('0,5 mm')));
  assert.ok(requirement.instructionsDa.some(line=>line.includes('2 mm')));}
 for(const changed of [{...audit,sourceMaterialId:'foreign'},{...audit,sourceEvidenceSha256:'0'.repeat(64)},
  {...audit,onlineDesignerVerified:true},{...audit,productionLayerNamesApproved:['praegung']}])
  assert.throws(()=>buildRollLabelArtworkInstructions(profile,changed));
 const wrong=structuredClone(audit);wrong.requiredMasks[0].condition.sourceValueId='foreign';
 assert.throws(()=>buildRollLabelArtworkInstructions(profile,wrong),/Foreign mask option/);
});

test('all runtime profiles keep pending fixed white masks explicit without exposing raw evidence',()=>{
 let documented=0,pending=0,nativePending=0;
 for(const filename of fs.readdirSync(`${base}/review/families`)){
  const family=JSON.parse(fs.readFileSync(`${base}/review/families/${filename}`));
  for(const profile of family.profiles){
   const contract=profile.artworkInstructions;
   if(!contract)continue;
   if(contract.documentationStatus==='mask_rules_documented')documented++;
   if(contract.documentationStatus==='source_instructions_pending')pending++;
   assert.equal(contract.profileKey,profile.key);assert.equal(contract.onlineDesignerVerified,false);
   assert.ok(!JSON.stringify(contract).includes('sourceTextOriginal'));assert.ok(!JSON.stringify(contract).includes('get-price'));
   if(profile.nativeGuide && contract.requirements.some(r=>!r.documented)){
    nativePending++;assert.ok(profile.nativeGuide.instructionsDa.some(line=>line.includes('mangler for dette valg')));
   }
  }
 }
 assert.equal(documented,716);assert.equal(pending,130);assert.equal(nativePending,100);
});
