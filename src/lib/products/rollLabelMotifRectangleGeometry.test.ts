import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {bindRollLabelMotifPdf,reviewRollLabelMotifPdf} from './rollLabelMotifPdf';
import {validateRollLabelConfiguration} from './rollLabelConfiguration';
import {readRollLabelSizeGeometry,rollLabelSizeGuide} from './rollLabelSizeGeometry';
import {rollLabelGeneratedDesignerAllowed} from '../designer/rollLabelGeneratedTemplate';
import type {RollLabelReviewFamily} from './rollLabelReview';
const family=JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/32553.json','utf8')) as RollLabelReviewFamily;
const before=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/root-motif-rectangle-geometry-048/before-artifacts/review/families/32553.json','utf8')) as RollLabelReviewFamily;
const proof=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/predecessor006-motif-rectangle-rule-review-052/runtime-differential.json','utf8'));
const proposal=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/predecessor006-motif-rectangle-rule-review-052/source-rule-proposals.json','utf8'));

test('all35 applied rules and65 actual states refuse one-page Designer access',()=>{
  let states=0;
  for(const row of proposal.proposals){
    const p=family.profiles.find(p=>p.key===row.profileKey)!;
    assert.ok(readRollLabelSizeGeometry(p));assert.equal(p.sizeGeometry!.sha256,row.contract.sha256);
    for(const state of p.optionStates!.states){assert.equal(rollLabelGeneratedDesignerAllowed(p,state.id),false);states++;}
    assert.equal(p.orderReady,false);
  }
  assert.equal(states,65);
});

test('260 current actual PDF bindings reject wrong widths and prior structure-only acknowledgements',()=>{
  for(const pdf of proof.actualPdfInspections){
    assert.equal(createHash('sha256').update(fs.readFileSync(pdf.path)).digest('hex'),pdf.sha256);
  }
  let checked=0;
  for(const c of proof.cases){
    const p=family.profiles.find(p=>p.key===c.profileKey)!,old=before.profiles.find(p=>p.key===c.profileKey)!;
    const n=p.format.motifCount;
    const selection=validateRollLabelConfiguration(p,{dimensions:{width:String(c.widthMm),height:String(c.heightMm)},quantity:'1000',
      allocations:c.selection.motifAllocations.map(String),optionStateId:c.stateId},{productId:family.productId,familyId:family.familyId}).selection!;
    assert.deepEqual(selection,c.selection);
    const correct=proof.actualPdfInspections.find(d=>d.key===`${n}:${c.widthMm}:${c.heightMm}:false`);
    const wrong=proof.actualPdfInspections.find(d=>d.key===`${n}:${c.widthMm}:${c.heightMm}:true`);
    const oldBinding=bindRollLabelMotifPdf(old,selection,correct),binding=bindRollLabelMotifPdf(p,selection,correct);
    assert.ok(oldBinding.valid&&binding.valid);
    if(!oldBinding.valid||!binding.valid)throw Error('Expected valid actual PDF binding');
    assert.equal(oldBinding.sizeChecked,false);assert.equal(binding.sizeChecked,true);
    assert.equal(bindRollLabelMotifPdf(p,selection,wrong).valid,false);
    const review={configurationKey:oldBinding.configurationKey,sourceEvidenceSha256:oldBinding.sourceEvidenceSha256,
      pdfSha256:oldBinding.pdfSha256,pageNumbers:oldBinding.pages.map(x=>x.pageNumber)};
    assert.ok(reviewRollLabelMotifPdf(oldBinding,review));assert.equal(reviewRollLabelMotifPdf(binding,review),null);
    const guide=rollLabelSizeGuide(p,c.widthMm,c.heightMm,c.stateId)!;
    assert.equal(guide.dataWidthMm,c.widthMm+6);assert.equal(guide.dataHeightMm,c.heightMm+6);
    assert.equal(binding.productionAccepted,false);assert.equal(binding.designerAllowed,false);assert.equal(binding.orderReady,false);checked++;
  }
  assert.equal(checked,260);
});
