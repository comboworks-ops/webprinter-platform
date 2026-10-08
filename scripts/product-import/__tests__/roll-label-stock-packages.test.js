import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const output=`${base}/canonical-stock-preparation-015`;
const json=file=>JSON.parse(fs.readFileSync(file));
const lines=file=>fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const registry=json(`${output}/registry.json`);
const originals=new Map(lines(`${base}/import-review/proposed-exact-prices.jsonl`).map(r=>[r.extraData.signature,r]));
test('eight stock slices preserve all 274 existing normalized quote rows and 1774 quantity bindings',()=>{
  assert.equal(registry.families.length,8);let rows=0,profiles=0,quantities=0;
  for(const family of registry.families) {
    const dir=`${output}/${family.familyId}`, manifest=json(`${dir}/import-manifest.proposed.json`);
    for(const name of ['pricing','stockDisplay','documents']) {
      const a=manifest[name].recordsArtifact,bytes=fs.readFileSync(`${dir}/${a.path}`);
      assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
      assert.equal(lines(`${dir}/${a.path}`).length,a.rowCount);
    }
    for(const r of lines(`${dir}/pricing.proposed.jsonl`)) {
      const {sourceOrder:originalOrder,...original}=originals.get(r.extraData.signature);
      const {sourceOrder:sliceOrder,...sliced}=r;
      assert.deepEqual(sliced,original);assert.ok(Number.isInteger(originalOrder)&&Number.isInteger(sliceOrder));rows++;
    }
    const contracts=json(`${dir}/raw-snapshot.json`).contracts;
    profiles+=contracts.length;quantities+=contracts.reduce((n,c)=>n+c.quantities.length,0);
    assert.equal(manifest.target.writeBank,false);assert.equal(manifest.target.writeProduct,false);
    assert.equal(manifest.target.writeLivePricing,false);assert.equal(manifest.target.publishProduct,false);
    assert.equal(family.canonicalManifestValidated,false);assert.equal(family.validatorExitCode,1);
    assert.match(fs.readFileSync(`${dir}/validation.log`,'utf8'),/documents\.recordsArtifact\.rowCount must be greater than zero/);
    assert.equal(manifest.documents.recordsArtifact.rowCount,0);
  }
  assert.equal(rows,274);assert.equal(profiles,94);assert.equal(quantities,1774);
});
test('checkpoint015 display artifact updates preserve every existing field in all42 draft families',()=>{
  const receipt=json('output/qa/roll-labels-2026-10-06/stock-015/display-preparation.json');
  for(const change of receipt.changes) {
    const before=json(`output/qa/roll-labels-2026-10-06/stock-015/before-artifacts/${change.path.replace(base+'/','')}`);
    const checkpoint=`output/qa/roll-labels-2026-10-06/stock-format-016/before-artifacts/${change.path.replace(base+'/','')}`;
    const bytes=fs.readFileSync(fs.existsSync(checkpoint)?checkpoint:change.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),change.afterSha256,'Historical015 checkpoint drift');
    const current=JSON.parse(bytes);
    const profiles=current.families ? current.families.flatMap(f=>f.pricingStructure.rollLabelConfiguration.profiles) : current.profiles;
    for(const p of profiles) if(p.stockDisplay) for(const key of ['stockDisplay','sourceEvidenceSha256','sourceQuantityBindings']) delete p[key];
    assert.deepEqual(current,before);
  }
});
