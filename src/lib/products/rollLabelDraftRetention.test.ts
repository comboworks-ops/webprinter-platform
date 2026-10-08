import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rollLabelDraftForProfileChange } from './rollLabelDraftRetention';
import { validateRollLabelConfiguration } from './rollLabelConfiguration';
import type { RollLabelReviewFamily } from './rollLabelReview';

const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/20649.json','utf8')) as RollLabelReviewFamily;
const previous = family.profiles.find(profile => profile.key === '54008:1003759')!;
const draft = {dimensions:{width:'51',height:'60'},quantity:'137',allocations:['137'],optionStateId:previous.optionStates!.initialStateId!};
test('material changes preserve dimensions and custom quantity without reusing the previous identity', () => {
  const next = family.profiles.find(profile => profile.articleId === previous.articleId && profile.key !== previous.key)!;
  const retained = rollLabelDraftForProfileChange(next, previous, draft);
  assert.deepEqual(retained.dimensions, draft.dimensions); assert.equal(retained.quantity,'137');
  const selection = validateRollLabelConfiguration(next, retained,{productId:family.productId,familyId:family.familyId}).selection!;
  assert.ok(selection); assert.equal(selection.profileKey,next.key); assert.equal(selection.materialId,next.sourceMaterialId);
  assert.equal(selection.quantity,137); assert.equal(selection.widthMm,51);
});
test('range violations remain visible and invalid; fixed quantities keep native choices', () => {
  const limited = {...previous, quantityInputs:[{...previous.quantityInputs[0],name:'menge',min:'1',max:'100'}]};
  const retained = rollLabelDraftForProfileChange(limited,previous,draft);
  assert.equal(retained.quantity,'137');
  assert.equal(validateRollLabelConfiguration(limited,retained,{productId:family.productId,familyId:family.familyId}).quantityValid,false);
  const fixed = {...previous,quantityInputs:[],sourceQuantities:[500,1000]};
  assert.equal(rollLabelDraftForProfileChange(fixed,previous,draft).quantity,'500');
  assert.equal(rollLabelDraftForProfileChange(fixed,previous,{...draft,quantity:'1000'}).quantity,'1000');
});
test('source option vectors and motif allocations are never mixed or redistributed', () => {
  const foreign = {...previous,optionStates:{...previous.optionStates!,initialStateId:'fresh',states:[{...previous.optionStates!.states[0],id:'fresh',options:{'999':'different'}}]}};
  assert.equal(rollLabelDraftForProfileChange(foreign,previous,draft).optionStateId,'fresh');
  const two = {...previous,format:{...previous.format,motifCount:2}};
  assert.deepEqual(rollLabelDraftForProfileChange(two,previous,draft).allocations,['','']);
  const uneven = {...draft,allocations:['136','1']};
  assert.deepEqual(rollLabelDraftForProfileChange(two,two,uneven).allocations,['136','1']);
});
