import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRollLabelStockFormatDisplay,rollLabelStockFormatLine} from './rollLabelStockFormatDisplay.ts';
import type {RollLabelReviewProfile} from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const json=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const packet=json('output/qa/roll-labels-2026-10-06/semantic-014/stock-contracts.json');
const fixture=(key:string)=>{
  const c=packet.contracts.find(c=>c.profileKey===key);
  const family=json(`${base}/review/families/${c.familyId}.json`);
  return {c,p:family.profiles.find(p=>p.key===key) as RollLabelReviewProfile};
};
test('all94 current stock format displays are source-bound with closed geometry and order gates',()=>{
  for(const c of packet.contracts) {
    const {p}=fixture(c.profileKey),display=readRollLabelStockFormatDisplay(p,c.productId,c.familyId);
    assert.ok(display,c.profileKey);assert.equal(display.geometryAccepted,false);assert.equal(display.orderReady,false);
    assert.equal(/sourceLabel|sourceTitle|EUR|€|sourceEvidencePath|request/.test(JSON.stringify(display)),false);
  }
});
test('sheet labels, neutral sample diameter and ribbon length use distinct display units',()=>{
  for(const [key,line] of [['65435:1299395','Etiketmål: 210 × 297 mm'],['65450:1299410','Etiketmål: 48,5 × 25,4 mm'],
    ['65928:1300602','Etiketdiameter: Ø 40 mm'],['65929:1300603','Etiketdiameter: Ø 55 mm'],
    ['44696:792216','Båndformat: 50 mm bredde × 350 m længde']]) {
    const {p,c}=fixture(key);assert.equal(rollLabelStockFormatLine(readRollLabelStockFormatDisplay(p,c.productId,c.familyId)!),line);
    assert.equal(p.format.dimensions,null,'Display-only gaps remain absent from production geometry');
  }
});
test('stale, foreign, malformed format display and reopened stock gates are refused',()=>{
  const {p,c}=fixture('44696:792216');
  for(const patch of [{formatValueId:'foreign'},{materialId:'foreign'},{sourceEvidenceSha256:'0'.repeat(64)},
    {sourceStockContractSha256:'0'.repeat(64)},{articleEvidenceSha256:'bad'},{geometryAccepted:true},{orderReady:true},
    {dimensions:{kind:'ribbon_mm_m',widthMm:50,lengthM:350000}}, {dimensions:{kind:'ribbon_mm_m',widthMm:NaN,lengthM:350}},
    {dimensions:{kind:'label_mm',widthMm:50,heightMm:350000}},{sourceTitle:'private price text'}]) {
    const copy=structuredClone(p);Object.assign(copy.stockFormatDisplay!,patch);
    assert.equal(readRollLabelStockFormatDisplay(copy,c.productId,c.familyId),null);
  }
  assert.equal(readRollLabelStockFormatDisplay(p,'foreign',c.familyId),null);
  assert.equal(readRollLabelStockFormatDisplay({...p,orderReady:true} as unknown as RollLabelReviewProfile,c.productId,c.familyId),null);
  const label=fixture('44680:792201');label.p.stockFormatDisplay!.dimensions={kind:'label_mm',widthMm:350,heightMm:25};
  assert.equal(readRollLabelStockFormatDisplay(label.p,label.c.productId,label.c.familyId),null);
});
