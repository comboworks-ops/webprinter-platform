import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reviewCurrentRollLabelOvalProposal, rollLabelOvalProposalHash, type RollLabelOvalProposal } from './rollLabelOvalProposal';
import { validateRollLabelConfiguration } from './rollLabelConfiguration';
import { readRollLabelSizeGeometry } from './rollLabelSizeGeometry';
import { prepareRollLabelGeneratedTemplate, rollLabelGeneratedDesignerAllowed } from '../designer/rollLabelGeneratedTemplate';
import type { RollLabelReviewFamily } from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families';
const packet=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/semantic-014/oval-proposals.json','utf8'));
const source=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/semantic-014/oval-source-review.json','utf8'));
function fixture(key='54011:1003822',width=50,height=50) {
  const proposal=packet.proposals.find(p=>p.profileKey===key) as RollLabelOvalProposal;
  const family=JSON.parse(fs.readFileSync(`${base}/${proposal.familyId}.json`,'utf8')) as RollLabelReviewFamily;
  const profile=family.profiles.find(p=>p.key===key)!;
  const contract={version:1 as const,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false as const};
  const selection=validateRollLabelConfiguration(profile,{dimensions:{width:String(width),height:String(height)},quantity:String(1000*profile.format.motifCount),
    allocations:Array(profile.format.motifCount).fill('1000'),optionStateId:profile.optionStates!.initialStateId!},contract).selection!;
  assert.ok(selection);
  return {proposal,family,profile,contract,selection};
}

test('302 exact oval profiles retain separate source outcomes; 179 proposals never open ordinary access',async()=>{
  assert.equal(source.records.length,302);assert.equal(new Set(source.records.map(r=>r.profileKey)).size,302);
  assert.equal(packet.proposals.length,179);assert.equal(new Set(packet.proposals.map(p=>p.profileKey)).size,179);
  assert.equal(source.records.find(p=>p.profileKey==='63738:1269564').proposalEligible,false);
  assert.equal(packet.proposals.some(p=>p.profileKey==='63738:1269564'),false);
  assert.equal(packet.checks.length,895);
  for(const p of packet.proposals) {
    const f=fixture(p.profileKey);
    const r=await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,f.contract,f.proposal);
    if (!f.profile.artworkInstructions) {assert.equal(r,null);continue;}
    assert.ok(r);assert.ok(r.blockers.includes('supplier_ellipse_semantics_unaccepted'));
    assert.equal(r.sourceGeometryAccepted,false);assert.equal(r.designerAllowed,false);assert.equal(r.orderReady,false);
    assert.equal(readRollLabelSizeGeometry(f.profile),null);
    assert.equal(rollLabelGeneratedDesignerAllowed(f.profile,f.selection.optionStateId),false);
    assert.equal(await prepareRollLabelGeneratedTemplate(f.selection,f.family.productId,f.contract),null);
  }
});

test('current source profile, product, options and dimensions reconstruct independently',async()=>{
  const f=fixture('54011:1003822',104,154);
  const a=await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,f.contract,f.proposal);
  assert.ok(a?.geometry);assert.equal(a.geometry.widthMm,104);assert.equal(a.geometry.heightMm,154);
  assert.equal(a.geometry.bleedMm,3);assert.equal(a.geometry.safeMm,3);
  const restored=await reviewCurrentRollLabelOvalProposal(JSON.parse(JSON.stringify(f.selection)),f.family.productId,f.contract,JSON.parse(JSON.stringify(f.proposal)));
  assert.deepEqual(restored,a);
  for(const patch of [{productId:'foreign'},{familyId:'foreign'},{profileKey:'54011:1003823'},{materialId:'other'},
    {sourceOptions:{fake:'1'}},{optionStateId:'stale'},{motifAllocations:[999]},{widthMm:201}]) {
    assert.equal(await reviewCurrentRollLabelOvalProposal({...f.selection,...patch},f.family.productId,f.contract,f.proposal),null);
  }
  const duplicate=structuredClone(f.contract);duplicate.profiles.push(structuredClone(f.profile));
  assert.equal(await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,duplicate,f.proposal),null);
  for(const change of [p=>{p.artworkInstructions=null;},p=>{p.optionFields[0].labelDa='changed';},p=>{p.sizeContract!.axes[0].maxMm=199;},
    p=>{p.blockers.push('blocked');},p=>{p.format.shape='rectangle';}]) {
    const stale=structuredClone(f.contract);change(stale.profiles.find(p=>p.key===f.profile.key)!);
    assert.equal(await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,stale,f.proposal),null);
  }
});

test('tampered proposal offsets/evidence and attempted readiness upgrades fail closed',async()=>{
  const f=fixture();
  for(const patch of [{bleedMm:2},{safeMm:2},{sourceEvidenceSha256:'1'.repeat(64)},
    {currentProfileSha256:'2'.repeat(64)},{model:'source_vectors'},{orderReady:true},{sourceGeometryAccepted:true},
    {supplierEllipseIdentityProved:true},{onlineDesignerVerified:true},{sourceDocuments:[]},{sourceRestrictions:['sandwich_inner_cutouts']}]) {
    const changed={...structuredClone(f.proposal),...patch};
    assert.equal(await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,f.contract,changed),null);
  }
  // A self-rehashed proposal cannot promote any acceptance flag either.
  const changed={...structuredClone(f.proposal),orderReady:true};const {sha256:_,...payload}=changed;
  changed.sha256=await rollLabelOvalProposalHash(payload);
  assert.equal(await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,f.contract,changed),null);
});

test('source cutline conflicts, supplier-created cuts, coding, masks and multiple motifs remain distinct',async()=>{
  const ordinary=fixture();const plain=await reviewCurrentRollLabelOvalProposal(ordinary.selection,ordinary.family.productId,ordinary.contract,ordinary.proposal);
  assert.ok(plain);assert.deepEqual(plain.blockers,['supplier_ellipse_semantics_unaccepted']);
  const conflicting=fixture('48188:973520');const c=await reviewCurrentRollLabelOvalProposal(conflicting.selection,conflicting.family.productId,conflicting.contract,conflicting.proposal);
  assert.ok(c?.blockers.includes('customer_cutline_contract_unproved'));assert.ok(c?.blockers.includes('conflicting_cutline_instructions'));
  const coded=fixture('61431:1210897');const v=await reviewCurrentRollLabelOvalProposal(coded.selection,coded.family.productId,coded.contract,coded.proposal);
  assert.ok(v?.blockers.includes('variable_data_companion_files_unimplemented'));
  const multiKey=packet.proposals.find(p=>p.familyId==='32553' && fixture(p.profileKey).profile.format.motifCount>1).profileKey;
  const multi=fixture(multiKey);const m=await reviewCurrentRollLabelOvalProposal(multi.selection,multi.family.productId,multi.contract,multi.proposal);
  assert.equal(m?.productionCutlinePolicy,'supplier_creates_cutline');assert.ok(m?.blockers.includes('multiple_motifs_or_pages_unimplemented'));
  const maskedKey=packet.proposals.find(p=>fixture(p.profileKey).profile.artworkInstructions?.requirements.length>0).profileKey;
  const masked=fixture(maskedKey);const mask=await reviewCurrentRollLabelOvalProposal(masked.selection,masked.family.productId,masked.contract,masked.proposal);
  assert.ok(mask?.blockers.includes('selective_material_rules_require_review'));
});

test('source-valid elongated dimensions are refused for singular safety offsets without narrowing supplier bounds',async()=>{
  const f=fixture('54011:1003822',10,200);
  const r=await reviewCurrentRollLabelOvalProposal(f.selection,f.family.productId,f.contract,f.proposal);
  assert.ok(r);assert.equal(r.geometry,null);assert.ok(r.blockers.includes('physical_offset_geometry_refused'));
  assert.equal(f.profile.sizeContract!.axes.find(a=>a.axis==='width')!.minMm,10);
  assert.equal(f.profile.sizeContract!.axes.find(a=>a.axis==='height')!.maxMm,200);
});
