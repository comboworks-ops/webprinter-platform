import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadRollLabelContourMetadata,verifyRollLabelContourMetadataDelta} from '../shared/load-roll-label-contour-metadata.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06',proof='output/qa/roll-labels-2026-10-06/root-contour-metadata-050';
const json=p=>JSON.parse(fs.readFileSync(p));
test('all459 source contracts are projected twice with no other field or source changes',()=>{
 const {contracts,beforeFiles}=loadRollLabelContourMetadata(process.cwd());assert.equal(contracts.size,459);assert.equal(beforeFiles.size,2);
 for(const [file,before] of beforeFiles)assert.doesNotThrow(()=>verifyRollLabelContourMetadataDelta(json(file),JSON.parse(before),file.slice(base.length+1),contracts));
});
test('changed requirements, source, options, prices, geometry and flags fail exact scoped verification',()=>{
 const {contracts}=loadRollLabelContourMetadata(process.cwd()),relative='review/families/25143.json';
 const before=json(proof+'/before-artifacts/'+relative),current=json(base+'/'+relative);
 for(const edit of [p=>p.cutContourContract.requirements.lineWidthPt=1,p=>p.cutContourContract.sourceEvidenceSha256='0'.repeat(64),
  p=>p.cutContourContract.geometryVerified=true,p=>p.orderReady=true,p=>p.optionStates.states[0].options.foreign='1',p=>p.blockers=['changed']]){
  const changed=structuredClone(current);edit(changed.profiles[0]);assert.throws(()=>verifyRollLabelContourMetadataDelta(changed,before,relative,contracts));
 }
 const packet=json(base+'/import-review/product-draft-plans.json');packet.families[0].priceReviewRows++;
 assert.throws(()=>verifyRollLabelContourMetadataDelta(packet,json(proof+'/before-artifacts/import-review/product-draft-plans.json'),'import-review/product-draft-plans.json',contracts));
});
