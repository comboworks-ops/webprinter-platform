import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readRollLabelProductContract,resolveRollLabelProductProfile,rollLabelInitialDraft,rollLabelOptionTransition,validateRollLabelConfiguration} from './rollLabelConfiguration.ts';
import {galleryMatrixSelections} from './productGallery.ts';
import {getSiteCheckoutDesignSignature} from '../checkout/siteCheckoutSession.ts';
import type {RollLabelReviewFamily} from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families';
const families=fs.readdirSync(base).map(file=>JSON.parse(fs.readFileSync(`${base}/${file}`,'utf8')) as RollLabelReviewFamily);
const profiles=families.flatMap(f=>f.profiles);
const identity={productId:'test-product',familyId:'test-family'};

test('ordinary material-row clicks resolve the exact roll profile; unknown and duplicate row labels close it',()=>{
 const family=families.find(f=>f.familyId==='29554')!;
 const contract={version:1 as const,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false as const};
 const selected=family.profiles.find(p=>p.key==='55058:1006954')!;
 const previous=family.profiles.find(p=>p.articleId==='55058'&&p.key!==selected.key&&!p.blockers.length)!;
 const axis={sectionId:family.sections.material,valueIds:family.sourceGroups[1].values.map(v=>v.id)};
 const names=Object.fromEntries(family.sourceGroups[1].values.map(v=>[v.id,v.name]));
 const sections={[family.sections.format]:selected.formatValueId,[family.sections.material]:previous.materialValueId};
 assert.equal(resolveRollLabelProductProfile(contract,family.productId,sections)?.key,previous.key);
 assert.equal(resolveRollLabelProductProfile(contract,family.productId,galleryMatrixSelections(sections,axis,names[selected.materialValueId],names))?.key,selected.key);
 assert.equal(resolveRollLabelProductProfile(contract,family.productId,galleryMatrixSelections(sections,axis,'unknown',names)),null);
 const duplicates={...names,[previous.materialValueId]:names[selected.materialValueId]};
 assert.equal(resolveRollLabelProductProfile(contract,family.productId,galleryMatrixSelections(sections,axis,names[selected.materialValueId],duplicates)),null);
});

test('all 2551 source profiles carry witnessed default states, with no foreign field values',()=>{
  assert.equal(profiles.length,2551);
  assert.equal(profiles.reduce((n,p)=>n+(p.optionStates?.states.length||0),0),9103);
  for(const p of profiles){
    assert.equal(p.optionStates?.profileKey,p.key);
    assert.ok(p.optionStates?.states.some(s=>s.id===p.optionStates?.initialStateId));
    for(const s of p.optionStates!.states) for(const [field,value] of Object.entries(s.options)){
      assert.ok(p.optionFields.find(f=>f.sourceFieldId===field)?.values.some(v=>v.sourceValueId===value));
      assert.ok(s.evidence.length>0);
    }
  }
});

test('machine direction and roll changes cannot invent a combined configuration',()=>{
  const p=profiles.find(p=>p.articleId==='60418')!;
  const initial=p.optionStates!.initialStateId!;
  const direction=rollLabelOptionTransition(p,initial,'222','117');assert.ok(direction);
  const roll=rollLabelOptionTransition(p,initial,'899','4789');assert.ok(roll);
  assert.equal(rollLabelOptionTransition(p,direction.id,'899','4789'),null);
  assert.equal(rollLabelOptionTransition(p,initial,'1279','4789'),null);
  assert.equal(rollLabelOptionTransition(p,initial,'899','made-up'),null);
  const other=profiles.find(x=>x.articleId===p.articleId&&x.key!==p.key)!;
  assert.equal(rollLabelOptionTransition(other,initial,'222','117'),null);
  const manual=structuredClone(profiles.find(p=>p.optionFields.some(f=>f.sourceFieldId==='473'))!);
  manual.optionStates!.transitions=[];
  assert.equal(rollLabelOptionTransition(manual,manual.optionStates!.initialStateId!,'473','1682'),null);
});

test('all 871 freshly checked profiles reset the dependent direction on manual-machine transition',()=>{
  const fresh=profiles.filter(p=>p.optionStates?.transitions?.length);
  assert.equal(fresh.length,871);
  for(const p of fresh){
    const initial=p.optionStates!.states.find(s=>s.id===p.optionStates!.initialStateId)!;
    assert.equal(initial.options['222'],'11293');
    const machine=rollLabelOptionTransition(p,initial.id,'473','1682');assert.ok(machine);
    assert.equal(machine.options['473'],'1682');assert.notEqual(machine.options['222'],'11293');
    assert.equal(rollLabelOptionTransition(p,machine.id,'222','11293'),null);
    assert.equal(rollLabelOptionTransition(p,machine.id,'473','1681')?.id,initial.id);
  }
});

test('circle dimensions are diameter-only; custom limits and malformed input are enforced',()=>{
  const p=profiles.find(p=>p.format.shape==='circle'&&p.format.rollModel&&p.format.motifCount===1&&!p.blockers.length)!;const d=rollLabelInitialDraft(p);d.dimensions={width:'300',height:'99'};d.quantity='1000';
  const ok=validateRollLabelConfiguration(p,d,identity);assert.ok(ok.valid);assert.equal(ok.selection?.heightMm,300);
  for(const width of ['301','9','NaN','Infinity',''])assert.equal(validateRollLabelConfiguration(p,{...d,dimensions:{width}},identity).valid,false);
  assert.equal(validateRollLabelConfiguration(p,{...d,dimensions:{width:'37,5'}},identity).selection?.widthMm,37.5);
  const standard=profiles.find(p=>p.articleId==='54008')!;
  assert.equal(validateRollLabelConfiguration(standard,{...rollLabelInitialDraft(standard),quantity:'1000',dimensions:{width:'201',height:'100'}},identity).valid,false);
});

test('six-motif allocation survives return only for exact profile and changes proof identity',()=>{
  const p=profiles.find(p=>p.articleId==='60458')!;const d=rollLabelInitialDraft(p);d.quantity='1000';d.dimensions={width:'50',height:'50'};d.allocations=['100','100','100','100','100','500'];
  const valid=validateRollLabelConfiguration(p,d,identity);assert.ok(valid.selection);
  const restored=rollLabelInitialDraft(p,valid.selection);assert.deepEqual(restored.allocations,d.allocations);
  assert.deepEqual(rollLabelInitialDraft(p,valid.selection,{...identity,productId:'foreign-product'}).dimensions,{});
  const other=profiles.find(x=>x.articleId===p.articleId&&x.key!==p.key)!;
  assert.deepEqual(rollLabelInitialDraft(other,valid.selection).dimensions,{});
  for(const allocations of [['0','100','100','100','100','600'],['1','1'],['100','100','100','100','100','499']]){
    assert.equal(validateRollLabelConfiguration(p,{...d,allocations},identity).valid,false);
  }
  const state={productId:identity.productId,pricingQuote:{rollLabels:valid.selection}};
  const changed=structuredClone(state);changed.pricingQuote.rollLabels.motifAllocations=[500,100,100,100,100,100];
  assert.notEqual(getSiteCheckoutDesignSignature(state),getSiteCheckoutDesignSignature(changed));
});

test('quarantined profiles and draft readiness cannot be promoted by metadata flags',()=>{
  const p=profiles.find(p=>p.articleId==='55049')!;
  assert.equal(validateRollLabelConfiguration(p,rollLabelInitialDraft(p),identity).valid,false);
  const family=families[0];const contract={version:1,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false};
  assert.ok(readRollLabelProductContract(contract,family.productId));
  assert.equal(readRollLabelProductContract({...contract,orderReady:true},family.productId),null);
  assert.equal(readRollLabelProductContract(contract,'other'),null);
  assert.equal(readRollLabelProductContract({version:1},family.productId),null);
});
