import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadRollLabelMotifRectangleGeometry,verifyRollLabelMotifRectangleDelta} from '../shared/load-roll-label-motif-rectangle-geometry.js';
import {loadRollLabelMotifPageDimensions} from '../shared/load-roll-label-motif-page-dimensions.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06',out='output/qa/roll-labels-2026-10-06/root-motif-rectangle-geometry-048';
const json=p=>JSON.parse(fs.readFileSync(p));
const source=json('output/qa/roll-labels-2026-10-06/predecessor006-motif-rectangle-rule-review-052/source-rule-proposals.json');
const beforePageDimensions=loadRollLabelMotifPageDimensions(process.cwd()).beforeFiles;
const at048=p=>beforePageDimensions.has(p)?JSON.parse(beforePageDimensions.get(p)):json(p);
test('35 exact same-profile rectangle rules retain document/source hashes and closed geometry gates',()=>{
 const contracts=loadRollLabelMotifRectangleGeometry(process.cwd());assert.equal(contracts.size,35);
 const family=json(base+'/review/families/32553.json');
 for(const row of source.proposals){const p=family.profiles.find(p=>p.key===row.profileKey);
  assert.deepEqual(p.sizeGeometry,contracts.get(p.key));assert.equal(p.sizeGeometry.sourceEvidenceSha256,p.sourceEvidenceSha256);
  assert.equal(p.sizeGeometry.onlineDesignerVerified,false);assert.equal(p.orderReady,false);
 }
});
test('all three current artifact deltas restore exactly with no price/options/shape/blocker changes',()=>{
 for(const c of json(out+'/geometry-preparation.json').changes){const relative=c.path.slice(base.length+1);
  assert.doesNotThrow(()=>verifyRollLabelMotifRectangleDelta(at048(c.path),json(out+'/before-artifacts/'+relative),relative,source.proposals));
 }
});
test('foreign geometry, changed source/margin/options and changed registry counts cannot pass scoped restoration',()=>{
 const relative='review/families/32553.json',current=at048(base+'/'+relative),before=json(out+'/before-artifacts/'+relative),key=source.proposals[0].profileKey;
 for(const edit of [p=>p.sizeGeometry.safeMm=2,p=>p.sizeGeometry.sourceEvidenceSha256='0'.repeat(64),
  p=>p.sizeGeometry.profileKey='foreign',p=>p.optionStates.states[0].options.fake='changed',p=>p.blockers=['changed']]){
  const changed=structuredClone(current);edit(changed.profiles.find(p=>p.key===key));
  assert.throws(()=>verifyRollLabelMotifRectangleDelta(changed,before,relative,source.proposals));
 }
 const registry=json(base+'/source-size-geometry-contracts.json');registry.counts.source_geometry_pending--;
 assert.throws(()=>verifyRollLabelMotifRectangleDelta(registry,json(out+'/before-artifacts/source-size-geometry-contracts.json'),'source-size-geometry-contracts.json',source.proposals));
});
