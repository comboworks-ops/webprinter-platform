import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRollLabelMotifDelivery} from './rollLabelMotifDelivery';
import {bindRollLabelMotifPdf,rollLabelMotifPdfConfigurationKey} from './rollLabelMotifPdf';
import {rollLabelInitialDraft,validateRollLabelConfiguration} from './rollLabelConfiguration';
import type {RollLabelReviewFamily,RollLabelReviewProfile} from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families';
const families:RollLabelReviewFamily[]=fs.readdirSync(base).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${base}/${f}`,'utf8')));
const motifs=families.flatMap(f=>f.profiles).filter(p=>p.format.motifCount>1);
const fixture=(p=motifs.find(p=>p.format.motifCount===6&&p.sizeGeometry&&!p.blockers.length)! )=>{
  const family=families.find(f=>f.profiles.some(q=>q.key===p.key))!;
  const draft={...rollLabelInitialDraft(p),dimensions:{width:'50',height:'50'},quantity:'1000',
    allocations:Array.from({length:p.format.motifCount},(_,i)=>String(i===p.format.motifCount-1?1000-100*(p.format.motifCount-1):100))};
  const selection=validateRollLabelConfiguration(p,draft,{productId:family.productId,familyId:family.familyId}).selection!;
  assert.ok(selection,p.key);
  const bleed=p.sizeGeometry?.bleedMm??3;
  const inspection={sha256:'1'.repeat(64),pages:Array.from({length:p.format.motifCount},(_,i)=>({pageNumber:i+1,widthMm:50+2*bleed,heightMm:50+2*bleed,rotation:0}))};
  return {p,selection,inspection};
};
test('all560 exact motif displays remain bound to their original source hashes',()=>{
  assert.equal(motifs.length,560);
  for(const p of motifs) assert.ok(readRollLabelMotifDelivery(p),p.key);
  for(const p of families.flatMap(f=>f.profiles).filter(p=>p.format.motifCount===1)) assert.equal(readRollLabelMotifDelivery(p),null);
});
test('all560 profiles retain blockers:511 check page order and data size;49 missing-template profiles stay closed',()=>{
  let sizeChecked=0,boundCount=0,blockedCount=0;
  for(const p of motifs) {
    if(p.blockers.length) {
      const family=families.find(f=>f.profiles.some(q=>q.key===p.key))!;
      const draft={...rollLabelInitialDraft(p),dimensions:{width:'50',height:'50'},quantity:'1000',
        allocations:Array.from({length:p.format.motifCount},(_,i)=>String(i===p.format.motifCount-1?1000-100*(p.format.motifCount-1):100))};
      assert.equal(validateRollLabelConfiguration(p,draft,{productId:family.productId,familyId:family.familyId}).selection,null);
      assert.equal(bindRollLabelMotifPdf(p,null,fixture().inspection).valid,false);blockedCount++;continue;
    }
    const {selection,inspection}=fixture(p),bound=bindRollLabelMotifPdf(p,selection,inspection);
    assert.ok(bound.valid,p.key);
    if(bound.valid) {boundCount++;sizeChecked+=Number(bound.sizeChecked);assert.equal(bound.pages.length,p.format.motifCount);assert.equal(bound.orderReady,false);}
  }
  assert.equal(sizeChecked,511);assert.equal(boundCount,511);assert.equal(blockedCount,49);
});
test('foreign, stale, missing or reopened delivery metadata is refused',()=>{
  const {p}=fixture();
  for(const patch of [{profileKey:'foreign'},{sourceEvidenceSha256:'0'.repeat(64)},{motifCount:2},{orderReady:true},{deliveryInstructionDa:'Én rulle pr. motiv'}]) {
    const copy=structuredClone(p);Object.assign(copy.motifDelivery!,patch);assert.equal(readRollLabelMotifDelivery(copy),null);
  }
  assert.equal(readRollLabelMotifDelivery({...p,sourceEvidenceSha256:undefined}),null);
  assert.equal(readRollLabelMotifDelivery({...p,sourceMaterialId:'foreign'}),null);
  const {selection,inspection}=fixture();
  const changed=structuredClone(p);changed.sizeGeometry!.sourceEvidenceSha256='0'.repeat(64);
  assert.equal(bindRollLabelMotifPdf(changed,selection,inspection).valid,false);
});
test('PDF bytes, complete selection and ordered positive allocations are bound with closed gates',()=>{
  const {p,selection,inspection}=fixture(),bound=bindRollLabelMotifPdf(p,selection,inspection);
  assert.ok(bound.valid); if(!bound.valid) return;
  assert.deepEqual(bound.pages.map(p=>p.quantity),selection.motifAllocations);
  assert.deepEqual(bound.pages.map(p=>[p.pageNumber,p.motifNumber]),[[1,1],[2,2],[3,3],[4,4],[5,5],[6,6]]);
  assert.equal(bound.sizeChecked,true);assert.equal(bound.orderReady,false);assert.equal(bound.designerAllowed,false);assert.equal(bound.productionAccepted,false);
  for(const s of [{...selection,materialId:'foreign'},{...selection,motifAllocations:[0,200,200,200,200,200]},
    {...selection,motifAllocations:[100,100,100,100,100,499]},{...selection,sourceOptions:{foreign:'1'}}]) assert.equal(bindRollLabelMotifPdf(p,s,inspection).valid,false);
  const changed={...selection,motifAllocations:[500,100,100,100,100,100]};
  assert.notEqual(rollLabelMotifPdfConfigurationKey(p,selection),rollLabelMotifPdfConfigurationKey(p,changed));
  assert.equal(bindRollLabelMotifPdf(p,changed,inspection).valid,true,'Same-sum reassignment requires a new current receipt');
});
test('missing, duplicate, rotated and wrong-size pages cannot masquerade as exact-size PDF',()=>{
  const {p,selection,inspection}=fixture();
  const edits=[{sha256:'not-a-hash'},{pages:inspection.pages.slice(1)},
    {pages:inspection.pages.map((p,i)=>i===1?{...p,pageNumber:1}:p)},
    {pages:inspection.pages.map((p,i)=>i===1?{...p,rotation:90}:p)},
    {pages:inspection.pages.map((p,i)=>i===1?{...p,widthMm:p.widthMm-1}:p)},
    {pages:inspection.pages.map((p,i)=>i===1?{...p,heightMm:NaN}:p)}];
  for(const patch of edits) assert.equal(bindRollLabelMotifPdf(p,selection,{...inspection,...patch}).valid,false);
});
test('documented oval/custom-contour page sizes do not accept the cutting shape',()=>{
  for(const shape of ['oval','custom_contour']) {
    const {p,selection,inspection}=fixture(motifs.find(p=>p.format.shape===shape&&!p.blockers.length)!);
    const bound=bindRollLabelMotifPdf(p,selection,inspection);assert.ok(bound.valid);
    if(bound.valid) {assert.equal(bound.sizeChecked,true);assert.equal(bound.cutShapeChecked,false);assert.equal(bound.productionAccepted,false);}
  }
});

test('manual page review binds exact file/source/configuration and every sequential page with closed gates',async()=>{
  const {reviewRollLabelMotifPdf}=await import('./rollLabelMotifPdf');
  const {p,selection,inspection}=fixture(),binding=bindRollLabelMotifPdf(p,selection,inspection);
  assert.ok(binding.valid);if(!binding.valid)return;
  const review={configurationKey:binding.configurationKey,sourceEvidenceSha256:binding.sourceEvidenceSha256,
    pdfSha256:binding.pdfSha256,pageNumbers:binding.pages.map(p=>p.pageNumber)};
  const accepted=reviewRollLabelMotifPdf(binding,review);assert.ok(accepted);
  assert.equal(accepted.reviewedByUser,true);assert.equal(accepted.productionAccepted,false);
  assert.equal(accepted.designerAllowed,false);assert.equal(accepted.orderReady,false);
  for(const patch of [{configurationKey:'old'}, {sourceEvidenceSha256:'0'.repeat(64)}, {pdfSha256:'2'.repeat(64)},
    {pageNumbers:[1,2,3,4,5]}, {pageNumbers:[1,2,3,4,5,5]}, {pageNumbers:[6,5,4,3,2,1]}])
    assert.equal(reviewRollLabelMotifPdf(binding,{...review,...patch}),null);
  review.pageNumbers[0]=99;assert.equal(accepted.pageNumbers[0],1,'Receipt does not borrow the mutable checkbox array');
});
