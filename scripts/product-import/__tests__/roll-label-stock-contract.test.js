import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareRollLabelStockContract } from '../shared/roll-label-stock-contract.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/families';
const packet=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/semantic-014/stock-contracts.json'));
const fixture=key=>{
  const c=packet.contracts.find(p=>p.profileKey===key),family=JSON.parse(fs.readFileSync(`${base}/${c.familyId}.json`));
  const profile=family.profiles.find(p=>p.key===key),bytes=fs.readFileSync(`docs/roll-labels-2026-09-30/${profile.sourceEvidencePath}`);
  return {c,family,profile,bytes};
};
test('94 exact stock contracts regenerate with all 1774 original quantity/scale identities',()=>{
  assert.equal(packet.contracts.length,94);assert.equal(new Set(packet.contracts.map(p=>p.profileKey)).size,94);
  let count=0,quotes=0;
  for(const c of packet.contracts) {
    const f=fixture(c.profileKey);assert.deepEqual(prepareRollLabelStockContract(f.family,f.profile,f.bytes),c);
    count+=c.quantities.length;quotes+=c.quoteIdentities.length;
    assert.equal(c.customerArtworkRequired,false);assert.equal(c.quantityConvertedToLabels,false);
    assert.equal(c.onlineDesignerAllowed,false);assert.equal(c.orderReady,false);
  }
  assert.equal(count,1774);assert.equal(quotes,274);
});
test('ribbon metres, roll labels, sheet packs and neutral samples preserve independent units',()=>{
  const ribbon=fixture('44696:792216').c;assert.equal(ribbon.packaging.ribbonWidthMm,50);assert.equal(ribbon.packaging.ribbonLengthM,350);
  assert.equal(ribbon.sourceQuantityUnit,'rolls');assert.equal(ribbon.quantities[0].quantity,3);
  const sheets=fixture('65435:1299395').c;assert.deepEqual(sheets.packaging,{sheetsPerPack:100,labelsPerSheet:1,labelsPerPack:100});
  assert.equal(sheets.quantities[0].quantity,1);assert.equal(sheets.sourceQuantityUnit,'source_items');
  const rolls=fixture('44680:792201').c;assert.equal(rolls.packaging.labelsPerRoll,3000);assert.equal(rolls.quantities[0].quantity,3);
  const sample=fixture('65927:1300601').c;assert.equal(sample.kind,'neutral_booklet_sample');assert.equal(sample.packaging.sampleLabels,8);
  assert.equal(sample.quantities[0].quantity,1);
});
test('foreign material, changed original quantities/hash and artwork-enabled profiles are refused',()=>{
  const f=fixture('44680:792201');
  for(const patch of [{customerArtworkRequired:true},{sourceMaterialId:'foreign'},{sourceEvidenceSha256:'0'.repeat(64)},
    {blockers:['blocked']},{sourceQuantities:f.profile.sourceQuantities.slice(1)}]) {
    assert.throws(()=>prepareRollLabelStockContract(f.family,{...f.profile,...patch},f.bytes));
  }
  const changed=structuredClone(f.profile);changed.sourceQuantities[0].quantity*=3000;
  assert.throws(()=>prepareRollLabelStockContract(f.family,changed,f.bytes),/quantity/);
});
test('article H and caller no-artwork signal do not replace explicit source stock wording',()=>{
  const f=fixture('44680:792201'),raw=JSON.parse(f.bytes);
  for(const q of raw.quotes) q.evidence.response.data.response.articleDescription='An ordinary printed product with customer artwork';
  const bytes=Buffer.from(JSON.stringify(raw)),profile={...f.profile,sourceEvidenceSha256:createHash('sha256').update(bytes).digest('hex')};
  assert.throws(()=>prepareRollLabelStockContract(f.family,profile,bytes),/classification/);
});
