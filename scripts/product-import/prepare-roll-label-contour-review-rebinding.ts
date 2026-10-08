/** Exact profile-version rebind only; native source models and geometry
 * calculations are retained, never accepted or rewritten. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {rollLabelSpecialCurrentProfileHash,rollLabelSpecialShapeHash,reviewCurrentRollLabelSpecialShapeProposal} from '../../src/lib/products/rollLabelSpecialShapeProposal';
import {validateRollLabelConfiguration} from '../../src/lib/products/rollLabelConfiguration';
const proof='output/qa/roll-labels-2026-10-06/root-contour-metadata-050';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const sourcePath='output/qa/roll-labels-2026-10-06/special-shapes-017/special-shape-proposals.json';
const inputs=new Map<string,string>();
const json=(p:string)=>{const b=fs.readFileSync(p);inputs.set(p,createHash('sha256').update(b).digest('hex'));return JSON.parse(b.toString());};
const oldPacket=json(sourcePath),before=json(proof+'/before-artifacts/review/families/25143.json'),family=json(base+'/review/families/25143.json');
const contract=f=>({version:1,productId:f.productId,familyId:f.familyId,sections:f.sections,profiles:f.profiles,orderReady:false});
const proposals=[],checks=[];
assert.equal(oldPacket.proposals.length,459);
for(const old of oldPacket.proposals){
 const p=family.profiles.find(p=>p.key===old.profileKey),prior=before.profiles.find(p=>p.key===old.profileKey);
 assert.equal(await rollLabelSpecialCurrentProfileHash(before.productId,before.familyId,before.sections,prior),old.currentProfileSha256);
 const {cutContourContract,...rest}=p;assert.deepEqual(rest,prior);
 const currentProfileSha256=await rollLabelSpecialCurrentProfileHash(family.productId,family.familyId,family.sections,p);
 const {sha256:oldSha,...payload}=old;
 const proposalPayload={...payload,currentProfileSha256};
 const updated={...proposalPayload,sha256:await rollLabelSpecialShapeHash(proposalPayload)};
 assert.equal(oldSha,await rollLabelSpecialShapeHash(payload));
 const selection=validateRollLabelConfiguration(p,{dimensions:{width:'50',height:'50'},quantity:'1000',allocations:['1000'],optionStateId:p.optionStates.initialStateId},contract(family)).selection;
 assert.ok(selection);
 const model=oldPacket.models.find(m=>m.articleId===p.articleId);
 assert.equal(await reviewCurrentRollLabelSpecialShapeProposal(selection,family.productId,contract(family),old,model,cutContourContract),null);
 const oldResult=await reviewCurrentRollLabelSpecialShapeProposal(selection,before.productId,contract(before),old,model,cutContourContract);
 const current=await reviewCurrentRollLabelSpecialShapeProposal(selection,family.productId,contract(family),updated,model,cutContourContract);
 assert.ok(oldResult&&current);
 const {proposal:oldBoundProposal,...oldDiagnostics}=oldResult;
 const {proposal:currentBoundProposal,...currentDiagnostics}=current;
 assert.deepEqual(oldBoundProposal,old);assert.deepEqual(currentBoundProposal,updated);
 assert.deepEqual(currentDiagnostics,oldDiagnostics);
 assert.equal(current.sourceGeometryAccepted||current.designerAllowed||current.orderReady,false);
 proposals.push(updated);checks.push({profileKey:p.key,beforeProfileSha256:old.currentProfileSha256,currentProfileSha256,
  oldProposalSha256:old.sha256,currentProposalSha256:updated.sha256,diagnosticsUnchanged:true,oldProposalRefusedOnCurrentProfile:true});
}
for(const [p,h] of inputs)assert.equal(createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h);
const output={version:1,scope:'exact459_profile_hashes_rebound_after_metadata_only_addition',sourcePath,sourceSha256:inputs.get(sourcePath),
 proposals,checks,sourceModelsChanged:false,sourceGeometryAccepted:false,designerAllowed:false,orderReady:false,
 sourceInputs:[...inputs].map(([path,sha256])=>({path,sha256}))};
fs.writeFileSync(proof+'/current-source-shape-bindings.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({profiles:proposals.length,diagnosticsUnchanged:checks.length,oldProposalsRefused:checks.length}));
