import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {brochureBankPlan,brochureBankPayloads,applyBrochureBankDraft,assertBrochureBankReadback} from '../shared/brochure-bank-draft.js';
import {inspectBrochureArtifact} from '../write-brochure-bank-draft.mjs';

const artifact={path:'normalized/prices.jsonl',format:'jsonl',sha256:'a'.repeat(64),bytes:100,rowCount:4};
const manifest=()=>({schemaVersion:2,runId:'brochure-fixture',source:{supplierSlug:'wir-machen-druck',entryUrl:'https://www.wir-machen-druck.de/broschuere-drahtheftung,category,9434.html',capturedAt:'2026-10-06T00:00:00.000Z'},product:{sourceKey:'wmd-saddle-stitched-brochures-9434',family:'books',nameOriginal:'Broschüren',nameDa:'Brochurer',descriptionOriginal:'Drahtheftung',descriptionDa:'Trådhæftning',sourceLanguage:'de'},target:{mode:'supplier_bank',state:'extracted',publishProduct:false,writeLivePricing:false},optionGroups:['orientation','format','pageCount','paperCover','cover','varnish'].map(key=>({key,values:[]})),pricing:{supplierCurrency:'EUR',vatState:'excluded',conversionRuleKey:'wmd_tiered_fx_7_5',recordsArtifact:{...artifact}},documents:{recordsArtifact:{...artifact,path:'normalized/documents.jsonl'}},artifacts:{rawSnapshot:'../../discovery.json',configurationEvidence:{...artifact,path:'normalized/evidence.jsonl'}}});
const summary={rowCount:4,quantityMin:1,quantityMax:10000,priceMinDkk:131,priceMaxDkk:11222};
const ids={supplierId:'supplier',scrapeRunId:'run',bankProductId:'product',priceSnapshotId:'snapshot'};
const receiptFor=plan=>({runId:plan.runId,packageChecksum:plan.packageChecksum,createdAt:'2026-10-06T01:00:00.000Z',ids:{...ids},completedSteps:[]});

function fakeClient(seed={},lostInsertTable=null){
 const tables=structuredClone(seed),inserts=[];
 let lost=false;
 return {tables,inserts,from(table){
  const filters=[];let payload=null;
  const result=()=>{
   if(payload){
    tables[table]??=[];
    if(tables[table].some(row=>row.id===payload.id))return {data:null,error:{message:'duplicate ID'}};
    tables[table].push(structuredClone(payload));inserts.push(table);
    if(table===lostInsertTable&&!lost){lost=true;throw Error('response lost after committed insert');}
    return {data:structuredClone(payload),error:null};
   }
   return {data:structuredClone((tables[table]||[]).find(row=>filters.every(([key,value])=>row[key]===value))??null),error:null};
  };
  const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},insert(value){payload=value;return query;},async maybeSingle(){return result();},async single(){return result();}};
  return query;
 }};
}

test('bank writer refuses live publication, live pricing and unrelated/continuation manifests',()=>{
 for(const change of [m=>m.target.publishProduct=true,m=>m.target.writeLivePricing=true,m=>m.target.state='product_draft',m=>m.product.sourceKey='other-product',m=>m.continuation={targetProductId:'existing'}]){
  const m=manifest();change(m);assert.throws(()=>brochureBankPlan(m,summary));
 }
});
test('streamed artifact checksum catches a changed price even when row count is unchanged',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'brochure-bank-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const bytes=Buffer.from(JSON.stringify({quantity:1,finalPriceDkk:131})+'\n'+JSON.stringify({quantity:10000,finalPriceDkk:11222})+'\n');
 const fixture={path:'prices.jsonl',bytes:bytes.length,rowCount:2,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 await fs.writeFile(path.join(root,fixture.path),bytes);
 assert.deepEqual(await inspectBrochureArtifact(root,fixture,{prices:true}),{rowCount:2,quantityMin:1,quantityMax:10000,priceMinDkk:131,priceMaxDkk:11222});
 await fs.writeFile(path.join(root,fixture.path),bytes.toString().replace('131','132'));
 await assert.rejects(inspectBrochureArtifact(root,fixture,{prices:true}),/checksum\/count mismatch/);
});
test('artifact traversal and quantities above the requested cap are rejected before staging',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'brochure-bank-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await assert.rejects(inspectBrochureArtifact(root,{...artifact,path:'../outside.jsonl'}),/escapes/);
 const bytes=Buffer.from(JSON.stringify({quantity:10001,finalPriceDkk:131})+'\n');
 await fs.writeFile(path.join(root,'prices.jsonl'),bytes);
 await assert.rejects(inspectBrochureArtifact(root,{path:'prices.jsonl',bytes:bytes.length,rowCount:1,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},{prices:true}),/Invalid price artifact row/);
});
test('large price/doc artifacts stay authoritative without a giant bank JSONB array',()=>{
 const m=manifest();m.pricing.recordsArtifact.rowCount=5073527;
 const plan=brochureBankPlan(m,{...summary,rowCount:5073527});
 const payloads=brochureBankPayloads(plan,ids,'2026-10-06T01:00:00.000Z');
 assert.deepEqual(payloads.snapshot.normalized_price_rows,[]);
 assert.deepEqual(payloads.snapshot.raw_price_rows,[]);
 assert.equal(payloads.snapshot.metadata.rowCount,5073527);
 assert.equal(payloads.product.metadata.pricingArtifact.sha256,m.pricing.recordsArtifact.sha256);
 assert.equal(payloads.product.metadata.approvalBoundary.livePricingWrite,false);
});
test('an existing bank key stops before any insert or overwrite',async()=>{
 const plan=brochureBankPlan(manifest(),summary),receipt=receiptFor(plan);
 const client=fakeClient({supplier_bank_suppliers:[{id:'supplier',slug:'wir-machen-druck'}],supplier_bank_products:[{id:'unrelated',supplier_id:'supplier',supplier_product_key:plan.product.sourceKey,status:'approved',source_hash:'other'}]});
 await assert.rejects(applyBrochureBankDraft({client,plan,receipt,saveReceipt:async()=>{}}),/collision/);
 assert.deepEqual(client.inserts,[]);
});
test('unknown network outcome resumes recorded IDs and creates no duplicate rows',async()=>{
 const plan=brochureBankPlan(manifest(),summary),receipt=receiptFor(plan);
 const client=fakeClient({},'supplier_bank_price_snapshots'),saved=[];
 const saveReceipt=async value=>saved.push(structuredClone(value));
 await assert.rejects(applyBrochureBankDraft({client,plan,receipt,saveReceipt}),/response lost/);
 assert.equal(saved.at(-1).pendingStep,'snapshot');
 assert.equal(client.tables.supplier_bank_price_snapshots.length,1);
 await applyBrochureBankDraft({client,plan,receipt,saveReceipt});
 assert.equal(receipt.status,'verified_bank_draft');
 assert.equal(client.inserts.length,4);
 assert.deepEqual(receipt.approvalBoundary,{supplierBankDraftWritten:true,liveProductChanged:false,livePricingChanged:false,templatesUploaded:false,productPublished:false});
 for(const rows of Object.values(client.tables))assert.equal(rows.length,1);
});
test('resuming refuses an edited or approved owned row without an update',async()=>{
 const plan=brochureBankPlan(manifest(),summary),receipt=receiptFor(plan),client=fakeClient();
 await applyBrochureBankDraft({client,plan,receipt,saveReceipt:async()=>{}});
 client.tables.supplier_bank_products[0].status='approved';
 const before=client.inserts.length;
 await assert.rejects(applyBrochureBankDraft({client,plan,receipt,saveReceipt:async()=>{}}),/collision/);
 assert.equal(client.inserts.length,before);
});
test('package/receipt mismatch cannot be resumed and readback catches content changes',async()=>{
 const plan=brochureBankPlan(manifest(),summary),receipt=receiptFor(plan),client=fakeClient();receipt.packageChecksum='other';
 await assert.rejects(applyBrochureBankDraft({client,plan,receipt,saveReceipt:async()=>{}}),/another package/);
 assert.equal(client.inserts.length,0);
 const payload=brochureBankPayloads(plan,ids,'2026-10-06T01:00:00.000Z').snapshot;
 assert.throws(()=>assertBrochureBankReadback({...payload,checksum:'modified'},payload,'snapshot'),/changed field checksum/);
});
