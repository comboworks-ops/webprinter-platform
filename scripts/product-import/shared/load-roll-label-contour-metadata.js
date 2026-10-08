import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const proof='output/qa/roll-labels-2026-10-06/root-contour-metadata-050';

export function verifyRollLabelContourMetadataDelta(after,before,relative,contracts){
  assert.ok(['review/families/25143.json','import-review/product-draft-plans.json'].includes(relative));
  assert.equal(contracts.size,459);const expected=structuredClone(before);
  const profiles=expected.profiles||expected.families.find(f=>f.familyId==='25143').pricingStructure.rollLabelConfiguration.profiles;
  assert.equal(profiles.length,459);
  for(const p of profiles){
    const c=contracts.get(p.key);assert.ok(c&&!Object.hasOwn(p,'cutContourContract'));
    assert.equal(p.artworkInstructions.sourceEvidenceSha256,c.sourceEvidenceSha256);
    assert.equal(p.format.shape,'source_specific');assert.equal(p.orderReady,false);
    assert.equal(c.familyId,'25143');assert.equal(c.geometryVerified,false);assert.equal(c.onlineDesignerVerified,false);assert.equal(c.orderReady,false);
    p.cutContourContract=c;
  }
  assert.deepEqual(after,expected,'Unexpected change outside459 exact production requirement metadata fields');
}

/** Exact050 additions restored only for historical049/048 evidence readers. */
export function loadRollLabelContourMetadata(root){
  const read=p=>fs.readFileSync(path.join(root,p));
  const receiptBytes=read(proof+'/preparation.json');
  const receipt=JSON.parse(receiptBytes),registry=read(base+'/source-cut-contour-contracts.json');
  assert.equal(sha(receiptBytes),'2680f0dc9db3f9cb79e326ececd833caaefcace82fdadea327b53ab109a12390');
  assert.equal(sha(registry),'519e99ed8dc4a4aae1f6d0ff6f5526bdf4c09de325f0c976a01cea26aa6eb165');
  assert.equal(sha(read(receipt.proposalPath)),'e5f905da1a9bf1699ac35da21c1521eeddb1e056d77dbd5589ffe573e3c7285a');
  const contracts=new Map(JSON.parse(registry).contracts.map(c=>[c.profileKey,c])),beforeFiles=new Map();
  assert.equal(receipt.changes.length,2);assert.equal(receipt.projectionCopies,918);
  for(const change of receipt.changes){
    assert.ok(change.path.startsWith(base+'/'));const relative=change.path.slice(base.length+1);
    const current=read(change.path),before=read(proof+'/before-artifacts/'+relative);
    assert.equal(sha(current),change.afterSha256);assert.equal(sha(before),change.beforeSha256);
    verifyRollLabelContourMetadataDelta(JSON.parse(current),JSON.parse(before),relative,contracts);
    beforeFiles.set(change.path,before);
  }
  for(const input of receipt.sourceInputs)assert.equal(sha(beforeFiles.get(input.path)||read(input.path)),input.sha256,input.path);
  return {contracts,beforeFiles};
}
