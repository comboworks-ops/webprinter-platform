import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRollLabelStockDisplay,rollLabelStockPackagingLines} from './rollLabelStockDisplay.ts';
import {buildRollLabelStockDisplay} from '../../../scripts/product-import/shared/roll-label-stock-display.js';
import type {RollLabelReviewProfile} from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const packet=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/semantic-014/stock-contracts.json','utf8'));
const fixture=(c=packet.contracts[0])=>{
  const family=JSON.parse(fs.readFileSync(`${base}/families/${c.familyId}.json`,'utf8'));
  const source=family.profiles.find(p=>p.key===c.profileKey);
  const current:RollLabelReviewProfile=JSON.parse(fs.readFileSync(`${base}/review/families/${c.familyId}.json`,'utf8')).profiles.find(p=>p.key===c.profileKey);
  current.sourceEvidenceSha256=source.sourceEvidenceSha256;
  current.sourceQuantityBindings=source.sourceQuantities.map(q=>({quantity:q.quantity,sourcePriceScaleId:q.sourcePriceScaleId}));
  current.stockDisplay=buildRollLabelStockDisplay(family,source,c);
  return {c,family,source,current};
};
test('94 display contracts retain 1774 exact quantities/scales and expose only whitelisted evidence',()=>{
  let quantities=0;
  for(const c of packet.contracts) {
    const f=fixture(c), display=readRollLabelStockDisplay(f.current,c.productId,c.familyId);
    assert.ok(display,c.profileKey);quantities+=display.quantities.length;
    assert.deepEqual(display.quantities,c.quantities.map(q=>({quantity:q.quantity,sourcePriceScaleId:q.sourcePriceScaleId})));
    assert.equal(/sourceDescriptions|sourceLabel|EUR|€|quoteIdentities|sourceTitle/.test(JSON.stringify(display)),false);
    assert.equal(display.orderReady,false);assert.equal(display.onlineDesignerAllowed,false);
  }
  assert.equal(quantities,1774);
});
test('current product/family/material/source/quantity identity and all closed gates are required',()=>{
  const f=fixture();
  for(const patch of [{sourceEvidenceSha256:'0'.repeat(64)},{sourceMaterialId:'other'}, {articleId:'other'},
    {sourceQuantities:f.current.sourceQuantities.slice(1)},{customerArtworkRequired:true},{orderReady:true},{blockers:['blocked']}]) {
    assert.equal(readRollLabelStockDisplay({...f.current,...patch} as RollLabelReviewProfile,f.c.productId,f.c.familyId),null);
  }
  assert.equal(readRollLabelStockDisplay(f.current,'foreign',f.c.familyId),null);
  assert.equal(readRollLabelStockDisplay(f.current,f.c.productId,'foreign'),null);
  for(const patch of [{sourceQuantityUnit:'labels'},{onlineDesignerAllowed:true},{orderReady:true},{quantityConvertedToLabels:true},
    {sourceLabel:'3 Rollen - 42 EUR'},{packaging:{labelsPerRoll:NaN}},{quantities:f.c.quantities},
    {sourceContractSha256:'bad'},{kind:'constructor'},{packaging:[]},{quantities:[null,...f.current.stockDisplay!.quantities.slice(1)]}]) {
    const current=structuredClone(f.current);Object.assign(current.stockDisplay!,patch);
    assert.equal(readRollLabelStockDisplay(current,f.c.productId,f.c.familyId),null);
  }
  const changed=structuredClone(f.current);changed.sourceQuantityBindings![0].sourcePriceScaleId='999999';
  assert.equal(readRollLabelStockDisplay(changed,f.c.productId,f.c.familyId),null);
  const currentSource=structuredClone(f.current);currentSource.artworkInstructions!.sourceEvidenceSha256='0'.repeat(64);
  assert.equal(readRollLabelStockDisplay(currentSource,f.c.productId,f.c.familyId),null);
});
test('projection rejects modified contracts and package arithmetic is checked independently',()=>{
  const f=fixture();
  assert.throws(()=>buildRollLabelStockDisplay(f.family,f.source,{...f.c,packaging:{labelsPerRoll:12}}));
  assert.throws(()=>buildRollLabelStockDisplay(f.family,{...f.source,sourceEvidenceSha256:'0'.repeat(64)},f.c));
  const sheet=fixture(packet.contracts.find(c=>c.kind==='blank_a4_sheet_pack'));
  sheet.current.stockDisplay!.packaging.labelsPerPack!++;
  assert.equal(readRollLabelStockDisplay(sheet.current,sheet.c.productId,sheet.c.familyId),null);
});
test('roll, ribbon, sheet and sample descriptions never multiply selected purchase quantities',()=>{
  const expectations=[['44680:792201','3.000 etiketter pr. rulle'],['44696:792216','Båndlængde: 350 m'],
    ['65435:1299395','100 A4-ark pr. pakke'],['65927:1300601','Neutral prøvestrimmel med 8 etiketter']];
  for(const [key,line] of expectations) {
    const f=fixture(packet.contracts.find(c=>c.profileKey===key)), display=readRollLabelStockDisplay(f.current,f.c.productId,f.c.familyId)!;
    assert.ok(rollLabelStockPackagingLines(display).includes(line));
    assert.deepEqual(display.quantities.map(q=>q.quantity),f.current.sourceQuantities);
  }
  assert.equal(packet.contracts.filter(c=>c.sourceQuantityUnit==='rolls').length,32);
  assert.equal(packet.contracts.filter(c=>c.sourceQuantityUnit==='source_items').length,62);
});
