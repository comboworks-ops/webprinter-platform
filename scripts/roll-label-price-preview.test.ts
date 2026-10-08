import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildRollLabelPricePreview,readRollLabelPriceSelection,type SavedRollPrice} from './roll-label-price-preview';
import {rollLabelPriceForSelection,rollLabelPriceInitialSelection} from '../src/lib/products/rollLabelPricePreview';
import type {RollLabelReviewFamily} from '../src/lib/products/rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const bytes=fs.readFileSync(base+'/import-review/proposed-exact-prices.jsonl');
const rows:SavedRollPrice[]=bytes.toString().trim().split('\n').map(line=>JSON.parse(line));
const family=(id:string):RollLabelReviewFamily=>JSON.parse(fs.readFileSync(base+'/review/families/'+id+'.json','utf8'));
const rule='wmd_roll_labels_threshold_fx_7_6';
test('all42 current families reconcile captured proposals without any supplier/private payload in preview',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'645dcab7924b3dbdb7a6db7429708a46756f7027751c63989f9819112efe5f0a');
  const index=JSON.parse(fs.readFileSync(base+'/review/catalogue.json','utf8'));let points=0,excluded=0,pricedFamilies=0;
  for(const entry of index.families){const currentFamily=family(entry.familyId),packet=buildRollLabelPricePreview(currentFamily,rows,rule);
    points+=packet.points.length;excluded+=packet.excludedRows;pricedFamilies+=packet.points.length>0?1:0;
    assert.equal(packet.commercialApproved,false);assert.equal(packet.orderReady,false);
    for(const key of ['supplierPrice','sourceRequest','token','sourceUrl','rawPayload','sourceSetupAndServices'])assert.equal(JSON.stringify(packet).includes('"'+key+'"'),false);
    for(const point of packet.points)assert.deepEqual(readRollLabelPriceSelection(currentFamily,point.selection),point.selection);
  }
  assert.equal(index.families.length,42);assert.equal(points,6998);assert.equal(excluded,791);assert.equal(pricedFamilies,40);
  assert.deepEqual(fs.readFileSync(base+'/import-review/proposed-exact-prices.jsonl'),bytes);
});
test('setup is already included once: captured1000 labels at50mm yields448 DKK',()=>{
  const f=family('20649'),packet=buildRollLabelPricePreview(f,rows,rule),selection=rollLabelPriceInitialSelection(packet,'54008:1003759',f.profiles[0].optionStates?.initialStateId);
  assert.ok(selection);assert.equal(selection.widthMm,50);assert.equal(selection.quantity,1000);
  assert.equal(rollLabelPriceForSelection(packet,selection)?.priceDkk,448);
  assert.equal(buildRollLabelPricePreview(f,rows,'wmd_tiered_fx_7_6').points[0].priceDkk,422);
  assert.throws(()=>buildRollLabelPricePreview(f,rows,'client-supplied-markup'),/Unknown/);
});
test('dimension/quantity/motif/options/family changes cannot reuse a captured price',()=>{
  const f=family('20649'),packet=buildRollLabelPricePreview(f,rows,rule),selection=packet.points[0].selection;
  for(const changed of [{...selection,widthMm:51},{...selection,quantity:999,motifAllocations:[999]},
    {...selection,motifAllocations:[999]},{...selection,sourceOptions:{...selection.sourceOptions,'222':'114'}},
    {...selection,familyId:'29554'},{...selection,productId:'foreign'}])assert.equal(rollLabelPriceForSelection(packet,changed),null);
  assert.ok(readRollLabelPriceSelection(f,{...selection,widthMm:51})); // Valid but unpriced, no interpolation.
  for(const changed of [{...selection,widthMm:0},{...selection,quantity:1.5},{...selection,sourceOptions:{'222':'114'}},
    {...selection,articleId:'foreign'},{...selection,materialId:'foreign'},{...selection,motifCount:2},{...selection,version:2},
    {...selection,familyId:'29554'},{...selection,productId:'foreign'},{...selection,motifAllocations:[999]}])assert.equal(readRollLabelPriceSelection(f,changed),null);
});
test('source identity, context, amount, option or request changes quarantine rather than invent a price',()=>{
  const f=family('20649'),original=rows.find(row=>row.sourceKey==='54008:1003759')!;
  for(const mutate of [(r:SavedRollPrice)=>r.supplierPrice=-1,(r:SavedRollPrice)=>r.supplierCurrency='DKK',
    (r:SavedRollPrice)=>r.selections.delivery='EXPRESS',(r:SavedRollPrice)=>r.rawPayload.sourceRequest.substrateId='foreign',
    (r:SavedRollPrice)=>r.selections.article_services='[]',(r:SavedRollPrice)=>r.rawPayload.sourceRequest.width='6',
    (r:SavedRollPrice)=>r.selections.options='{}',(r:SavedRollPrice)=>r.selections.motif_allocation='{"1":{"Motiv 1":"999"}}']){
    const changed=structuredClone(original);mutate(changed);const packet=buildRollLabelPricePreview(f,[changed],rule);assert.equal(packet.points.length,0);assert.equal(packet.excludedRows,1);
  }
});
test('duplicate full price identity stays ambiguous even if amounts agree',()=>{
  const f=family('20649'),r=rows.find(row=>row.sourceKey==='54008:1003759')!;
  const packet=buildRollLabelPricePreview(f,[r,structuredClone(r)],rule);assert.equal(packet.points.length,0);assert.equal(packet.excludedRows,2);
});
test('blocked profiles and two families without supported price dimensions have no payable fallback',()=>{
  for(const id of ['24682','32244'])assert.equal(buildRollLabelPricePreview(family(id),rows,rule).points.length,0);
  const f=family('20649');f.profiles[0].blockers=['qa-blocked'];const r=rows.find(row=>row.sourceKey===f.profiles[0].key)!;
  assert.equal(buildRollLabelPricePreview(f,[r],rule).points.length,0);
});
