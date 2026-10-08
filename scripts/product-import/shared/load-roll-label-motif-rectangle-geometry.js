import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadRollLabelMotifPageDimensions} from './load-roll-label-motif-page-dimensions.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const proof='output/qa/roll-labels-2026-10-06/predecessor006-motif-rectangle-rule-review-052';
const applied='output/qa/roll-labels-2026-10-06/root-motif-rectangle-geometry-048';
const relativePaths=['review/families/32553.json','import-review/product-draft-plans.json','source-size-geometry-contracts.json'];
export const rollLabelMotifRectangleContract=row=>({...row.contract,
 evidence:row.contract.evidence.map(({role,sha256,textSha256})=>({role,sha256,textSha256}))});

/** Only the 35 exact reviewed rules may change; preserve every other field. */
export function verifyRollLabelMotifRectangleDelta(after,before,relative,rows) {
  assert.ok(relativePaths.includes(relative));assert.equal(rows.length,35);
  const expected=structuredClone(before),byKey=new Map(rows.map(r=>[r.profileKey,r]));
  assert.equal(byKey.size,35);
  if(relative==='source-size-geometry-contracts.json') {
    let changed=0;
    for(const p of expected.profiles) if(byKey.has(p.profileKey)) {
      const row=byKey.get(p.profileKey);assert.equal(p.status,'source_geometry_pending');
      assert.equal(p.contract,null);assert.equal(p.sourceEvidenceSha256,row.sourceEvidenceSha256);
      assert.deepEqual(p.blockers,['Source PDF does not echo the selected primitive shape']);
      p.status='primitive_size_geometry_documented';p.contract=row.contract;p.blockers=[];changed++;
    }
    assert.equal(changed,35);expected.counts.primitive_size_geometry_documented+=35;expected.counts.source_geometry_pending-=35;
  } else {
    const profiles=relative.startsWith('review/')?expected.profiles:
      expected.families.find(f=>f.familyId==='32553').pricingStructure.rollLabelConfiguration.profiles;
    let changed=0;
    for(const p of profiles) if(byKey.has(p.key)) {
      const row=byKey.get(p.key);assert.equal(p.sizeGeometry,null);assert.equal(p.format.shape,'rectangle');
      assert.equal(p.format.motifCount,row.motifCount);assert.equal(p.sourceEvidenceSha256,row.sourceEvidenceSha256);
      assert.deepEqual(p.optionStates.states.map(s=>s.id),row.optionStateIds);
      p.sizeGeometry=rollLabelMotifRectangleContract(row);changed++;
    }
    assert.equal(changed,35);
  }
  assert.deepEqual(after,expected,'Unexpected change outside exact 35 geometry rules');
}

/** Source evidence plus exact scoped projection restoration, never pricing or
 * source recapture. Original strict shape-word audit stays unchanged. */
export function loadRollLabelMotifRectangleGeometry(root) {
  const {beforeFiles}=loadRollLabelMotifPageDimensions(root);
  const readCurrent=p=>beforeFiles.get(p)||fs.readFileSync(path.join(root,p));
  const bytes=fs.readFileSync(path.join(root,proof,'source-rule-proposals.json'));
  assert.equal(sha(bytes),'d645bc4d10a1388a4349ce8ccac9603bca509dce290edbc9d9970df9d00a7751');
  assert.equal(sha(fs.readFileSync(path.join(root,proof,'independent-readback.json'))),'5c69fe65b59814f6ce79c08cac55aff3bd98ae9d33579297c50dfca2e1857360');
  const source=JSON.parse(bytes);assert.equal(source.proposals.length,35);
  const preparationBytes=fs.readFileSync(path.join(root,applied,'geometry-preparation.json'));
  assert.equal(sha(preparationBytes),'8c3b71245b31be6a82e8203b95d6c01513061a003e9c7d6b121c853a807f56e2');
  const preparation=JSON.parse(preparationBytes);assert.equal(preparation.changes.length,3);
  for(const relative of relativePaths) {
    const change=preparation.changes.find(c=>c.path===base+'/'+relative);assert.ok(change);
    const current=readCurrent(change.path);assert.equal(sha(current),change.afterSha256);
    const before=fs.readFileSync(path.join(root,applied,'before-artifacts',relative));assert.equal(sha(before),change.beforeSha256);
    verifyRollLabelMotifRectangleDelta(JSON.parse(current),JSON.parse(before),relative,source.proposals);
  }
  for(const input of source.sourceInputs) {
    const currentBytes=readCurrent(input.path);
    if(sha(currentBytes)===input.sha256)continue;
    const relative=input.path.slice(base.length+1);
    assert.ok(input.path.startsWith(base+'/')&&relativePaths.includes(relative),'Unreviewed source input mutation');
    const receipt=JSON.parse(fs.readFileSync(path.join(root,applied,'geometry-preparation.json')));
    const change=receipt.changes.find(c=>c.path===input.path);assert.ok(change);
    assert.equal(change.beforeSha256,input.sha256);assert.equal(sha(currentBytes),change.afterSha256);
    const beforeBytes=fs.readFileSync(path.join(root,applied,'before-artifacts',relative));assert.equal(sha(beforeBytes),input.sha256);
    verifyRollLabelMotifRectangleDelta(JSON.parse(currentBytes),JSON.parse(beforeBytes),relative,source.proposals);
  }
  const contracts=new Map();
  for(const row of source.proposals) {
    assert.equal(row.familyId,'32553');assert.equal(row.contract.profileKey,row.profileKey);
    assert.equal(row.contract.sourceEvidenceSha256,row.sourceEvidenceSha256);assert.equal(row.contract.shape,'rectangle');
    assert.ok(row.motifCount>=2&&row.motifCount<=6);assert.equal(row.contract.onlineDesignerVerified,false);
    assert.equal(row.contract.bleedMm,3);assert.equal(row.contract.safeMm,3);assert.equal(row.contract.cornerRadiusMm,2);
    assert.equal(row.contract.evidence.length,2);assert.ok(!contracts.has(row.profileKey));
    contracts.set(row.profileKey,rollLabelMotifRectangleContract(row));
  }
  return contracts;
}
