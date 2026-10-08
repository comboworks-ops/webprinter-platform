import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadRollLabelContourMetadata} from './load-roll-label-contour-metadata.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const proof='output/qa/roll-labels-2026-10-06/root-motif-page-dimensions-049';
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?
  `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);

export function verifyRollLabelMotifPageDimensionDelta(after,before,relative,rows){
  assert.ok(['review/families/32552.json','review/families/32553.json','import-review/product-draft-plans.json'].includes(relative));
  assert.equal(rows.length,273);const byKey=new Map(rows.map(r=>[r.profileKey,r.contract]));assert.equal(byKey.size,273);
  const expected=structuredClone(before),families=expected.families||[expected];let changed=0;
  for(const family of families)for(const p of family.profiles||family.pricingStructure.rollLabelConfiguration.profiles){
    const rule=byKey.get(p.key);if(!rule)continue;
    assert.ok(p.motifDelivery&&!p.motifDelivery.pageDimensions);assert.equal(p.sizeGeometry,null);
    assert.equal(p.sourceEvidenceSha256,rule.sourceEvidenceSha256);assert.equal(p.format.shape,rule.shape);
    assert.equal(p.format.motifCount,rule.motifCount);assert.deepEqual(p.sizeContract,rule.sizeContract);
    assert.deepEqual(p.blockers,[]);assert.equal(p.orderReady,false);
    p.motifDelivery.pageDimensions=rule;changed++;
  }
  assert.equal(changed,relative.includes('32552')?133:relative.includes('32553')?140:273);
  assert.deepEqual(after,expected,'Unexpected change outside exact page-dimension metadata');
}

/** Restore ONLY independently verified049 deltas for earlier pinned readers. */
export function loadRollLabelMotifPageDimensions(root){
  const {beforeFiles:contourBefore}=loadRollLabelContourMetadata(root);
  const readCurrent=p=>contourBefore.get(p)||fs.readFileSync(path.join(root,p));
  const registry=fs.readFileSync(path.join(root,base,'source-motif-page-dimension-contracts.json'));
  assert.equal(sha(registry),'102873b18ac7eacdba064e6e109bd5d405b943d741baa259da0dcb05f8b768b7');
  assert.deepEqual(registry,fs.readFileSync(path.join(root,proof,'source-audit.json')));
  const bytes=fs.readFileSync(path.join(root,proof,'preparation.json'));
  assert.equal(sha(bytes),'59be56f32dfb81e820d3f7fb6cf3c294d936d8d104a2361178ade00b8d975f13');
  const receipt=JSON.parse(bytes),source=JSON.parse(registry),beforeFiles=new Map(contourBefore),contracts=new Map();
  assert.equal(receipt.changes.length,3);assert.equal(source.profiles.length,273);
  for(const change of receipt.changes){
    assert.ok(change.path.startsWith(base+'/'));const relative=change.path.slice(base.length+1);
    const current=readCurrent(change.path),before=fs.readFileSync(path.join(root,proof,'before-artifacts',relative));
    assert.equal(sha(current),change.afterSha256);assert.equal(sha(before),change.beforeSha256);
    verifyRollLabelMotifPageDimensionDelta(JSON.parse(current),JSON.parse(before),relative,source.profiles);
    beforeFiles.set(change.path,before);
  }
  for(const input of source.sourceInputs){
    const bytes=beforeFiles.get(input.path)||fs.readFileSync(path.join(root,input.path));
    assert.equal(sha(bytes),input.sha256,'Changed exact source input: '+input.path);
  }
  for(const row of source.profiles){
    const {sha256,...rule}=row.contract;assert.equal(sha(Buffer.from(canonical(rule))),sha256);
    assert.equal(row.profileKey,rule.profileKey);assert.equal(rule.scope,'pdf_page_dimensions_only');
    assert.equal(rule.bleedMm,3);assert.equal(rule.cutShapeAccepted,false);assert.equal(rule.designerAllowed,false);assert.equal(rule.orderReady,false);
    assert.ok(!contracts.has(row.profileKey));contracts.set(row.profileKey,row.contract);
  }
  return {contracts,beforeFiles};
}
