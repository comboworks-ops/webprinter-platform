import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadRollLabelMotifPageDimensions,verifyRollLabelMotifPageDimensionDelta} from '../shared/load-roll-label-motif-page-dimensions.js';
import {loadRollLabelMotifDelivery} from '../shared/load-roll-label-motif-delivery.js';
import {buildRollLabelProductReview} from '../shared/roll-label-product-review.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06',out='output/qa/roll-labels-2026-10-06/root-motif-page-dimensions-049';
const json=p=>JSON.parse(fs.readFileSync(p));
test('273 exact source envelopes restore only546 metadata copies with all original inputs retained',()=>{
 const {contracts,beforeFiles}=loadRollLabelMotifPageDimensions(process.cwd());
 assert.equal(contracts.size,273);assert.equal(beforeFiles.size,4);
 assert.equal([...contracts.values()].filter(c=>c.shape==='oval').length,133);
 for(const c of contracts.values())assert.equal(c.cutShapeAccepted||c.designerAllowed||c.orderReady,false);
});
test('foreign rule, size bounds, shape, margins, blockers and option changes fail scoped verification',()=>{
 const relative='review/families/32552.json',current=json(base+'/'+relative),before=json(out+'/before-artifacts/'+relative);
 const rows=json(base+'/source-motif-page-dimension-contracts.json').profiles;
 assert.doesNotThrow(()=>verifyRollLabelMotifPageDimensionDelta(current,before,relative,rows));
 for(const edit of [p=>p.motifDelivery.pageDimensions.bleedMm=2,p=>p.motifDelivery.pageDimensions.sourceEvidenceSha256='0'.repeat(64),
  p=>p.motifDelivery.pageDimensions.cutShapeAccepted=true,p=>p.sizeContract.axes[0].maxMm++,p=>p.format.shape='rectangle',
  p=>p.blockers=['new'],p=>p.optionStates.states[0].options.foreign='x']){
  const changed=structuredClone(current);edit(changed.profiles.find(p=>p.motifDelivery?.pageDimensions));
  assert.throws(()=>verifyRollLabelMotifPageDimensionDelta(changed,before,relative,rows));
 }
});
test('the existing catalogue projector carries exact page metadata through its existing motif map',()=>{
 const families=fs.readdirSync(base+'/families').filter(f=>f.endsWith('.json')).map(f=>json(base+'/families/'+f));
 const delivery=loadRollLabelMotifDelivery(process.cwd(),families),rules=loadRollLabelMotifPageDimensions(process.cwd()).contracts;
 for(const [key,rule] of rules)delivery.set(key,{...delivery.get(key),pageDimensions:rule});
 let count=0;
 for(const family of families.filter(f=>['32552','32553'].includes(f.sourceFamilyId))){
  const generated=buildRollLabelProductReview(family,new Map(),new Map(),new Map(),new Map(),new Map(),new Map(),new Map(),new Map(),delivery);
  const current=json(base+'/review/families/'+family.sourceFamilyId+'.json');
  for(const p of generated.profiles)if(rules.has(p.key)){
   assert.deepEqual(p.motifDelivery,current.profiles.find(q=>q.key===p.key).motifDelivery);
   assert.equal(p.orderReady,false);count++;
  }
 }
 assert.equal(count,273);
});
