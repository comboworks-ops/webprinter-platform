import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewCurrentRollLabelSpecialShapeProposal,rollLabelSpecialShapeHash} from './rollLabelSpecialShapeProposal.ts';
import {validateRollLabelConfiguration} from './rollLabelConfiguration';
import {readRollLabelSizeGeometry} from './rollLabelSizeGeometry';
import {rollLabelGeneratedDesignerAllowed,prepareRollLabelGeneratedTemplate} from '../designer/rollLabelGeneratedTemplate';
import {loadRollLabelContourMetadata} from '../../../scripts/product-import/shared/load-roll-label-contour-metadata.js';
import {loadRollLabelMotifPageDimensions} from '../../../scripts/product-import/shared/load-roll-label-motif-page-dimensions.js';
import {loadRollLabelMotifRectangleGeometry} from '../../../scripts/product-import/shared/load-roll-label-motif-rectangle-geometry.js';
import {loadRollLabelCodingOptions} from '../../../scripts/product-import/shared/load-roll-label-coding-options.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const family=JSON.parse(fs.readFileSync(base+'/review/families/25143.json','utf8'));
const cuts=JSON.parse(fs.readFileSync(base+'/source-cut-contour-contracts.json','utf8'));
const originalPacket=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/special-shapes-017/special-shape-proposals.json','utf8'));
const currentBindings=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/root-contour-metadata-050/current-source-shape-bindings.json','utf8'));
const packet={...originalPacket,proposals:currentBindings.proposals};
const contract={version:1,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false};
function fixture(key=family.profiles[0].key) {
  const p=family.profiles.find(p=>p.key===key),proposal=packet.proposals.find(p=>p.profileKey===key);
  const model=packet.models.find(m=>m.articleId===p.articleId),cut=cuts.contracts.find(c=>c.profileKey===key);
  const selection=validateRollLabelConfiguration(p,{dimensions:{width:'50',height:'50'},quantity:'1000',allocations:['1000'],optionStateId:p.optionStates.initialStateId},contract).selection;
  assert.ok(selection);return {p,proposal,model,cut,selection};
}
const review=(f:ReturnType<typeof fixture>)=>reviewCurrentRollLabelSpecialShapeProposal(f.selection,family.productId,contract,f.proposal,f.model,f.cut);

test('all459 exact current profiles use27 source models and retain every ordinary gate',async()=>{
  assert.equal(packet.proposals.length,459);assert.equal(new Set(packet.proposals.map(p=>p.profileKey)).size,459);
  assert.equal(packet.models.length,27);assert.equal(packet.checks.length,2295);assert.equal(packet.counts.uniqueSizeDiagnostics,135);
  for(const proposal of packet.proposals) {
    const f=fixture(proposal.profileKey),r=await review(f);assert.ok(r);
    assert.equal(r.sourceGeometryAccepted,false);assert.equal(r.designerAllowed,false);assert.equal(r.orderReady,false);
    assert.equal(r.geometry.offsetGeometryConstructed,false);assert.ok(r.blockers.includes('source_example_scaling_unaccepted'));
    assert.equal(readRollLabelSizeGeometry(f.p),null);assert.equal(rollLabelGeneratedDesignerAllowed(f.p,f.selection.optionStateId),false);
    assert.equal(await prepareRollLabelGeneratedTemplate(f.selection,family.productId,contract),null);
    assert.deepEqual(r.cutRequirements,{version:1,spotName:'Cutkontur',lineWidthPt:.25,tint:1,alternateCmyk:[0,1,0,0],separateLayer:true,strokeOverprint:true});
  }
});

test('original multi-loop, open/disconnected safe marks and duplicate guide strokes remain distinct',async()=>{
  const apple=fixture('25011:804742'),r=await review(apple);assert.ok(r);
  assert.equal(apple.model.templateSafePaths.length,2);assert.equal(apple.model.guideSafePaths.length,4);
  const heart=packet.models.find(m=>m.articleId==='25024');assert.equal(heart.guideNativePaths.length,2);
  assert.deepEqual(heart.guideNativePaths[0],heart.guideNativePaths[1]);
  const open=fixture(family.profiles.find(p=>p.articleId==='25021').key),o=await review(open);assert.ok(o);
  assert.ok(o.sourceSafePaths.template.some(p=>!p.closed||p.gaps.some(g=>g>0)));
  assert.equal(heart.guideTemplateCorrespondence,'sampled_proximity_only');
  assert.equal(packet.models.find(m=>m.articleId==='25019').guideTemplateCorrespondence,'sampled_proximity_only');
});

test('changed identity, current options, source hash, dimensions or candidate geometry are refused',async()=>{
  const f=fixture();assert.ok(await review(f));
  for(const patch of [{productId:'foreign'},{familyId:'foreign'},{profileKey:'other'},{sourceOptions:{fake:'1'}},{widthMm:201},{optionStateId:'stale'}]) {
    assert.equal(await reviewCurrentRollLabelSpecialShapeProposal({...f.selection,...patch},family.productId,contract,f.proposal,f.model,f.cut),null);
  }
  for(const patch of [{bleedMm:2},{safeMm:2},{sourceEvidenceSha256:'f'.repeat(64)},{sourceShapeSha256:'1'.repeat(64)},
    {cutContractSha256:'2'.repeat(64)},{currentProfileSha256:'3'.repeat(64)},{orderReady:true},{scalingAuthorityProved:true},{sourceGeometryAccepted:true},{onlineDesignerVerified:true}]) {
    assert.equal(await review({...f,proposal:{...f.proposal,...patch}}),null);
  }
  const stale=structuredClone(contract);stale.profiles[0].optionFields[0].labelDa='Changed';
  assert.equal(await reviewCurrentRollLabelSpecialShapeProposal(f.selection,family.productId,stale,f.proposal,f.model,f.cut),null);
  const duplicate=structuredClone(contract);duplicate.profiles.push(structuredClone(f.p));
  assert.equal(await reviewCurrentRollLabelSpecialShapeProposal(f.selection,family.productId,duplicate,f.proposal,f.model,f.cut),null);
  const changed=structuredClone(f.model);changed.templateNativePath[0].pointsPt[1][0]+=1;
  assert.equal(await review({...f,model:changed}),null);
  assert.equal(await review({...f,cut:{...f.cut,requirements:{...f.cut.requirements,spotName:'CutContour'}}}),null);
});

test('even self-rehashed acceptance flags, repaired examples or stale evidence never grant production',async()=>{
  const f=fixture();
  for(const field of ['orderReady','sourceGeometryAccepted','onlineDesignerVerified','scalingAuthorityProved']) {
    const c={...f.proposal,[field]:true};const {sha256:_,...payload}=c;c.sha256=await rollLabelSpecialShapeHash(payload);
    assert.equal(await review({...f,proposal:c}),null);
  }
  for(const patch of [{offsetAuthorityProved:true},{sourceGeometryAccepted:true},{scalingAuthorityProved:true},
    {sourceDocuments:f.model.sourceDocuments.map(d=>({...d,placeholderDimensions:false}))}]) {
    const model={...structuredClone(f.model),...patch};const {sha256:_,...payload}=model;
    model.sha256=await rollLabelSpecialShapeHash(payload);
    const proposal={...f.proposal,sourceShapeSha256:model.sha256};const {sha256:__,...p}=proposal;proposal.sha256=await rollLabelSpecialShapeHash(p);
    assert.equal(await review({...f,proposal,model}),null);
  }
  assert.deepEqual(await review({...f,selection:JSON.parse(JSON.stringify(f.selection))}),await review(f));
});

test('original inputs retain exact bytes or preserved epoch copies; current metadata passes its explicit provenance chain',()=>{
  const integrity=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/special-shapes-017/input-integrity.json','utf8'));
  assert.equal(integrity.allUnchanged,true);
  assert.equal(integrity.inputs.filter(p=>p.path.endsWith('.pdf')).length,54);
  assert.equal(integrity.inputs.filter(p=>p.path.includes('/extraction/articles/')).length,459);
  assert.equal(integrity.inputs.filter(p=>p.path.includes('/review/families/')).length,42);
  const epochCopies=new Map<string,string>([
    [base+'/review/families/25143.json','output/qa/roll-labels-2026-10-06/root-contour-metadata-050/before-artifacts/review/families/25143.json'],
    [base+'/review/families/30968.json','output/qa/roll-labels-2026-10-06/coding-display-023/before-artifacts/review/families/30968.json'],
    ...['review/families/32552.json','review/families/32553.json','import-review/product-draft-plans.json'].map(p=>
      [base+'/'+p,'output/qa/roll-labels-2026-10-06/motif-binding-021/before-artifacts/'+p] as [string,string])
  ]);
  for(const input of integrity.inputs)assert.equal(createHash('sha256').update(fs.readFileSync(epochCopies.get(input.path)||input.path)).digest('hex'),input.sha256,input.path);
  assert.equal(loadRollLabelContourMetadata(process.cwd()).contracts.size,459);
  assert.equal(loadRollLabelMotifPageDimensions(process.cwd()).contracts.size,273);
  assert.equal(loadRollLabelMotifRectangleGeometry(process.cwd()).size,35);
  assert.equal(loadRollLabelCodingOptions(process.cwd()).size,16);
});
test('every old shape proposal is stale on new metadata; exact050 rebind retains source models and closed gates',async()=>{
 assert.equal(currentBindings.proposals.length,459);assert.equal(currentBindings.sourceModelsChanged,false);
 for(const old of originalPacket.proposals){
  const f=fixture(old.profileKey);
  assert.equal(await review({...f,proposal:old}),null);
  const updated=packet.proposals.find(p=>p.profileKey===old.profileKey);
  const {sha256,currentProfileSha256,...rest}=updated;
  const {sha256:oldSha,currentProfileSha256:oldProfile,...oldRest}=old;
  assert.deepEqual(rest,oldRest);assert.notEqual(sha256,oldSha);assert.notEqual(currentProfileSha256,oldProfile);
  const checked=await review(f);assert.ok(checked);assert.equal(checked.sourceGeometryAccepted||checked.designerAllowed||checked.orderReady,false);
 }
});
