import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {brochureChecksum} from '../shared/brochure-bank-draft.js';
import {applyBrochureProductDraft,buildBrochureProductPayloads,brochurePriceId,BROCHURE_SLUG,ensureBrochurePriceWindow,BROCHURE_PRICE_BATCH,BROCHURE_PRICE_CONCURRENCY} from '../shared/brochure-product-draft.js';
import {uploadImmutableAssets,writeResolvedDocuments,streamBrochurePrices} from '../import-brochure-product-draft.mjs';

const id=()=>crypto.randomUUID(),tenantId='00000000-0000-0000-0000-000000000000';
function fixture(){
  const productId=id(),bankProductId=id(),priceSnapshotId=id();
  const artifact={sha256:'a'.repeat(64),rowCount:3},documentArtifact={sha256:'b'.repeat(64),rowCount:173872};
  const plan={databaseWrites:false,proposedIdsOnly:true,runId:'fixture',tenantId,proposedProductId:productId,
    sourcePricingArtifact:artifact,sourceDocumentArtifact:documentArtifact,
    productGroups:Array.from({length:6},(_,index)=>({id:id(),tenant_id:tenantId,product_id:productId,name:`Group${index}`})),
    productValues:[],documents:{exactConfigurationCount:173872,templates:Array.from({length:19},(_,index)=>({
      proposedDesignerTemplateId:id(),selectionConstraints:{format:`format${index}`},contract:{formatSourceKey:`format${index}`,
        templatePdfSha256:String(index).padStart(64,'0'),widthMm:148,heightMm:210,bleedMm:3,safeMm:3,pageCount:1,
        nativeGuideSourceUrl:'https://example.test/guide.pdf',sourceUrl:'https://example.test/template.pdf'}}))},
    freeSize:{articles:Array.from({length:29},()=>({}))},pricingStructure:{templateBinding:{profile:'brochure_v1',axisSections:{format:'format'}}}};
  plan.productValues=plan.productGroups.map(group=>({id:id(),group_id:group.id,tenant_id:tenantId,product_id:productId,name:'Value'}));
  const bank={status:'verified_bank_draft',runId:'fixture',packageChecksum:'c'.repeat(64),ids:{bankProductId,priceSnapshotId}};
  const manifest={runId:'fixture',product:{sourceKey:'wmd-saddle-stitched-brochures-9434',nameDa:'Brochurer',descriptionDa:'Trådhæftet'},
    target:{state:'bank_draft',publishProduct:false,writeLivePricing:false,bankDraft:{...bank.ids,packageChecksum:bank.packageChecksum}},
    pricing:{recordsArtifact:artifact},documents:{recordsArtifact:documentArtifact}};
  const receipt={productId,bankProductId,planChecksum:brochureChecksum(plan),importJobId:id(),createdAt:'2026-10-06T00:00:00.000Z',completedSteps:[],storageObjects:[]};
  const assets=plan.documents.templates.map(row=>({sha256:row.contract.templatePdfSha256,objectPath:row.contract.templatePdfSha256+'.pdf',url:'https://example.test/'+row.contract.templatePdfSha256+'.pdf'}));
  const priceRows=Array.from({length:3},(_,sourceOrder)=>({sourceOrder,id:brochurePriceId(productId,sourceOrder),tenant_id:tenantId,
    product_id:productId,quantity:sourceOrder+1,price_dkk:131+sourceOrder,variant_name:'variant',variant_value:'paper',extra_data:{sourceOrder}}));
  return {plan,bank,manifest,receipt,assets,priceRows};
}
function fakeClient(f,lostTable=null){
  const tables={supplier_bank_products:[{id:f.bank.ids.bankProductId,status:'draft',source_hash:f.bank.packageChecksum,supplier_product_key:f.manifest.product.sourceKey}],
    supplier_bank_price_snapshots:[{id:f.bank.ids.priceSnapshotId,bank_product_id:f.bank.ids.bankProductId,checksum:f.plan.sourcePricingArtifact.sha256}]};
  const inserts=[];let lost=false;
  return {tables,inserts,from(table){
    const filters=[];let payload=null,countMode=false,single=false;
    const query={select(_columns,options){countMode=Boolean(options?.count);return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},
      in(key,values){filters.push(row=>values.includes(row[key]));return query;},insert(rows){payload=rows;return query;},
      maybeSingle(){single=true;return query;},then(resolve,reject){return Promise.resolve().then(()=>{
        tables[table]??=[];
        if(payload){const rows=Array.isArray(payload)?payload:[payload];
          if(rows.some(row=>tables[table].some(existing=>existing.id===row.id)))return {error:{message:'duplicate'},data:null};
          tables[table].push(...structuredClone(rows));inserts.push({table,ids:rows.map(row=>row.id)});
          if(table===lostTable&&!lost){lost=true;throw Error('response lost after committed insert');}
          return {error:null,data:null};}
        const rows=tables[table].filter(row=>filters.every(filter=>filter(row)));
        return {error:null,data:single?rows[0]??null:structuredClone(rows),count:countMode?rows.length:null};
      }).then(resolve,reject);}};return query;
  }};
}
const apply=(f,client,saveReceipt=async()=>{})=>applyBrochureProductDraft({...f,client,saveReceipt});
test('new brochure draft has exact owned catalogue, templates and price rows with publication disabled',async()=>{
  const f=fixture(),client=fakeClient(f);await apply(f,client);
  assert.equal(f.receipt.status,'verified_product_draft');assert.equal(f.receipt.verifiedPriceRows,3);
  assert.equal(client.tables.products[0].is_published,false);assert.equal(client.tables.products[0].is_ready,false);
  assert.equal(client.tables.products[0].technical_specs.site_modes.designer_mode,'brochure');
  assert.equal(client.tables.products[0].template_files.length,19);
  assert.equal(Object.keys(f.receipt.actualDesignerTemplateIds).length,19);
  assert.equal(client.tables.generic_product_prices.length,3);
  assert.equal(client.tables.supplier_bank_import_jobs[0].target_product_id,f.plan.proposedProductId);
});
test('lost price response resumes deterministic IDs without duplicate inserts or changed prices',async()=>{
  const f=fixture(),client=fakeClient(f,'generic_product_prices'),saved=[];
  await assert.rejects(apply(f,client,value=>saved.push(structuredClone(value))),/response lost/);
  assert.equal(saved.at(-1).pendingStep,'prices:0-3');
  await apply(f,client);assert.equal(client.tables.generic_product_prices.length,3);
  assert.equal(client.inserts.filter(row=>row.table==='generic_product_prices').length,1);
  const inserted=client.inserts.length;await apply(f,client);assert.equal(client.inserts.length,inserted);
});
test('parallel price windows persist intent first, respect batch limits and wait for all unknown commits before resuming',async()=>{
  const f=fixture(),base=fakeClient(f,'generic_product_prices'),saved=[];
  const rows=Array.from({length:BROCHURE_PRICE_BATCH*BROCHURE_PRICE_CONCURRENCY},(_,sourceOrder)=>({
    ...f.priceRows[sourceOrder%3],id:brochurePriceId(f.plan.proposedProductId,sourceOrder),extra_data:{sourceOrder}}));
  let active=0,maxActive=0,settled=0;
  const client={from(table){const query=base.from(table),originalThen=query.then;
    query.then=(resolve,reject)=>{assert.equal(saved.at(-1).pendingPriceBatches.length,BROCHURE_PRICE_CONCURRENCY);
      active++;maxActive=Math.max(maxActive,active);
      return new Promise(resolve=>setTimeout(resolve,2)).then(()=>originalThen.call(query,value=>value,error=>{throw error;}))
        .finally(()=>{active--;settled++;}).then(resolve,reject);};return query;}};
  const receipt={verifiedPriceRows:0},saveReceipt=async value=>saved.push(structuredClone(value));
  const run=()=>ensureBrochurePriceWindow({client,rows,startOrder:0,receipt,saveReceipt});
  await assert.rejects(run(),/response lost/);
  assert.equal(active,0);assert(settled>0);assert.equal(receipt.verifiedPriceRows,0);
  assert.equal(receipt.pendingStep,`prices:0-${rows.length}`);assert.equal(base.tables.generic_product_prices.length,rows.length);
  assert(maxActive<=BROCHURE_PRICE_CONCURRENCY);
  assert(base.inserts.every(insert=>insert.ids.length<=BROCHURE_PRICE_BATCH));
  await run();assert.equal(receipt.verifiedPriceRows,rows.length);assert.equal(receipt.pendingStep,null);
  assert.deepEqual(receipt.pendingPriceBatches,[]);assert.equal(base.inserts.length,BROCHURE_PRICE_CONCURRENCY);
});
test('foreign slug or allocated catalogue identities stop before all inserts',async()=>{
  for(const collision of ['slug','catalogue']){
    const f=fixture(),client=fakeClient(f);
    if(collision==='slug')client.tables.products=[{id:id(),tenant_id:tenantId,slug:BROCHURE_SLUG}];
    else client.tables.product_attribute_groups=[{...f.plan.productGroups[0],product_id:id()}];
    await assert.rejects(apply(f,client),/collision|changed field/);assert.equal(client.inserts.length,0);
  }
});
test('bank mismatch, live flags and receipt mismatch never cross the write boundary',async()=>{
  for(const change of [f=>f.manifest.target.publishProduct=true,f=>f.manifest.target.writeLivePricing=true,
    f=>f.bank.status='approved',f=>f.receipt.planChecksum='other',f=>f.manifest.documents.recordsArtifact={sha256:'other',rowCount:173872}]){
    const f=fixture(),client=fakeClient(f);change(f);await assert.rejects(apply(f,client));assert.equal(client.inserts.length,0);
  }
});
test('modified owned prices or extra rows are preserved and require intervention, never replacement',async()=>{
  for(const change of [client=>client.tables.generic_product_prices[0].price_dkk=1,client=>client.tables.generic_product_prices.push({...client.tables.generic_product_prices[0],id:id()})]){
    const f=fixture(),client=fakeClient(f);await apply(f,client);change(client);const before=structuredClone(client.tables.generic_product_prices),inserted=client.inserts.length;
    await assert.rejects(apply(f,client),/changed field|unexpected or missing/);
    assert.deepEqual(client.tables.generic_product_prices,before);assert.equal(client.inserts.length,inserted);
  }
});
test('changed product publication and changed template hash cannot be resumed',async()=>{
  const f=fixture(),client=fakeClient(f);await apply(f,client);client.tables.products[0].is_published=true;
  const count=client.inserts.length;await assert.rejects(apply(f,client),/already published/);assert.equal(client.inserts.length,count);
  const changed=fixture();changed.assets[0].sha256='other';assert.throws(()=>buildBrochureProductPayloads(changed),/Unverified template/);
});
test('immutable template readback handles a committed upload with lost response without overwriting bytes',async()=>{
  const bytes=Buffer.from('owned-test-template'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const objects=new Map();let writes=0,lost=true;
  const store={async download(key){return objects.has(key)?{data:new Blob([objects.get(key)]),error:null}:{error:{statusCode:404}};},
    async upload(key,data,options){assert.equal(options.upsert,false);writes++;objects.set(key,Buffer.from(data));if(lost){lost=false;throw Error('lost upload response');}return {error:null};},
    getPublicUrl(key){return {data:{publicUrl:'https://example.test/'+key}};}};
  const client={storage:{from(){return store;}}},asset={bytes,sha256,objectPath:'owned.pdf'},receipt={storageObjects:[]};
  await assert.rejects(uploadImmutableAssets(client,[asset],receipt,async()=>{}),/lost upload/);
  await uploadImmutableAssets(client,[asset],receipt,async()=>{});assert.equal(writes,1);
  objects.set(asset.objectPath,Buffer.from('changed'));await assert.rejects(uploadImmutableAssets(client,[asset],receipt,async()=>{}),/hash changed/);
  assert.equal(writes,1);
});
test('unavailable storage is not treated as an empty bucket',async()=>{
  let writes=0;const client={storage:{from(){return {async download(){return {error:{statusCode:503}};},async upload(){writes++;}};}}};
  await assert.rejects(uploadImmutableAssets(client,[{sha256:'a'.repeat(64),objectPath:'owned.pdf'}],{storageObjects:[]},async()=>{}),/cannot assume object missing/);
  assert.equal(writes,0);
});
test('SDK binary download response uses the explicit NoSuchKey body while unrelated 400/403 errors stay closed',async()=>{
  for(const [status,body,shouldUpload] of [
    [400,{statusCode:'404',error:'not_found',message:'Object not found',code:'NoSuchKey'},true],
    [400,{statusCode:'400',code:'InvalidRequest'},false],
    [403,{statusCode:'404',code:'NoSuchKey'},false],
    [400,{statusCode:'404',code:'NoSuchBucket'},false],
  ]){
    const bytes=Buffer.from('immutable-qa'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');let uploaded=false;
    const store={async download(){return uploaded?{data:new Blob([bytes]),error:null}:{error:{name:'StorageUnknownError',originalError:new Response(JSON.stringify(body),{status})}};},
      async upload(_path,data,options){assert.equal(options.upsert,false);assert.deepEqual(Buffer.from(data),bytes);uploaded=true;return {error:null};},
      getPublicUrl(){return {data:{publicUrl:'https://example.test/owned.pdf'}};}};
    const run=()=>uploadImmutableAssets({storage:{from(){return store;}}},[{bytes,sha256,objectPath:'owned.pdf'}],{storageObjects:[]},async()=>{});
    if(shouldUpload)await run();else await assert.rejects(run(),/cannot assume object missing/);
    assert.equal(uploaded,shouldUpload);
  }
});
test('persisted template IDs produce a separate checksummed binding artifact while source evidence remains unchanged',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'brochure-product-bindings-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'normalized'));
  const f=fixture(),template=f.plan.documents.templates[0],row={sourceOrder:0,match:{format:template.contract.formatSourceKey},
    template:{sanitizedPdfSha256:template.contract.templatePdfSha256,designerTemplateId:null}};
  const bytes=Buffer.from(JSON.stringify(row)+'\n'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  f.plan.sourceDocumentArtifact={path:'normalized/source.jsonl',rowCount:1,bytes:bytes.length,sha256};
  await fs.writeFile(path.join(root,'normalized/source.jsonl'),bytes);
  f.receipt.actualDesignerTemplateIds={[template.contract.formatSourceKey]:template.proposedDesignerTemplateId};
  const artifact=await writeResolvedDocuments(root,f.plan,f.receipt),resolved=await fs.readFile(path.join(root,artifact.path));
  assert.equal(JSON.parse(resolved).template.designerTemplateId,template.proposedDesignerTemplateId);
  assert.equal(crypto.createHash('sha256').update(resolved).digest('hex'),artifact.sha256);
  assert.deepEqual(await fs.readFile(path.join(root,'normalized/source.jsonl')),bytes);
  f.receipt.actualDesignerTemplateIds[template.contract.formatSourceKey]=id();
  await assert.rejects(writeResolvedDocuments(root,f.plan,f.receipt),/binding mismatch/);
  assert.deepEqual(await fs.readFile(path.join(root,artifact.path)),resolved);
});
test('streamed prices reject a checksum change, source reordering and artifact traversal',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'brochure-product-prices-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const f=fixture(),source={sourceOrder:0,quantity:1,finalPriceDkk:131,supplierPrice:10.88,convertedPriceDkk:81.6,sourceUrl:'https://supplier.test/quote'};
  const bytes=Buffer.from(JSON.stringify(source)+'\n');await fs.writeFile(path.join(root,'prices.jsonl'),bytes);
  f.plan.sourcePricingArtifact={path:'prices.jsonl',rowCount:1,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  const resolver={priceRow:row=>({product_id:f.plan.proposedProductId,tenant_id:tenantId,quantity:row.quantity,price_dkk:row.finalPriceDkk,extra_data:{}})};
  const collect=async()=>{const rows=[];for await(const row of streamBrochurePrices(root,f.manifest,f.plan,resolver,f.bank))rows.push(row);return rows;};
  const rows=await collect();assert.equal(rows[0].id,brochurePriceId(f.plan.proposedProductId,0));
  assert.equal(rows[0].extra_data.supplierPrice,10.88);assert.equal(rows[0].extra_data.supplierBankProductId,f.bank.ids.bankProductId);
  await fs.writeFile(path.join(root,'prices.jsonl'),bytes.toString().replace('131','132'));await assert.rejects(collect(),/checksum\/count/);
  await fs.writeFile(path.join(root,'prices.jsonl'),bytes.toString().replace('"sourceOrder":0','"sourceOrder":1'));await assert.rejects(collect(),/Noncontiguous/);
  f.plan.sourcePricingArtifact.path='../outside.jsonl';await assert.rejects(collect(),/escapes/);
});
