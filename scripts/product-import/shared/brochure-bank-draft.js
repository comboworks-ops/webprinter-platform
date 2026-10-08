import crypto from 'node:crypto';

const AXES=['orientation','format','pageCount','paperCover','cover','varnish'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const brochureChecksum=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const assert=(condition,message)=>{if(!condition)throw Error(message);};

/** Same external-artifact staging protocol used by the existing sales-folder
 * draft importer. Never put millions of rows in one JSONB field. No live table
 * or destructive operation is exposed by this writer. */
export function brochureBankPlan(manifest,pricingSummary){
 assert(manifest.schemaVersion===2&&manifest.product?.sourceKey==='wmd-saddle-stitched-brochures-9434','Not the reviewed brochure schema-v2 package');
 assert(manifest.source?.supplierSlug==='wir-machen-druck','Unexpected brochure supplier');
 assert(['extracted','bank_draft'].includes(manifest.target?.state),'Only extracted/bank draft may be staged');
 assert(manifest.target.mode==='supplier_bank'&&manifest.target.publishProduct===false&&manifest.target.writeLivePricing===false,'Bank-only boundary required');
 assert(!manifest.continuation,'This writer creates only the new brochure bank package');
 assert(manifest.pricing?.supplierCurrency==='EUR'&&manifest.pricing.vatState==='excluded'&&manifest.pricing.conversionRuleKey==='wmd_tiered_fx_7_5','Reviewed net EUR and existing WMD conversion required');
 assert(AXES.every(key=>manifest.optionGroups.some(group=>group.key===key))&&manifest.optionGroups.length===AXES.length,'Exactly six brochure axes required');
 for(const artifact of [manifest.pricing.recordsArtifact,manifest.documents.recordsArtifact,manifest.artifacts.configurationEvidence]){
  assert(artifact?.format==='jsonl'&&/^[a-f0-9]{64}$/.test(artifact.sha256)&&Number.isSafeInteger(artifact.bytes)&&artifact.bytes>0&&Number.isSafeInteger(artifact.rowCount)&&artifact.rowCount>0,'Checksum-bound JSONL artifact required');
 }
 assert(pricingSummary.rowCount===manifest.pricing.recordsArtifact.rowCount&&pricingSummary.quantityMin>0&&pricingSummary.quantityMax<=10000&&pricingSummary.priceMinDkk>0&&pricingSummary.priceMaxDkk>=pricingSummary.priceMinDkk,'Price artifact summary mismatch');
 const packageChecksum=brochureChecksum({source:manifest.source,product:manifest.product,optionGroups:manifest.optionGroups,pricing:manifest.pricing,documents:manifest.documents,configurationEvidence:manifest.artifacts.configurationEvidence,nativeApiArchive:manifest.artifacts.nativeApiArchive});
 return {runId:manifest.runId,source:manifest.source,product:manifest.product,optionGroups:manifest.optionGroups,pricing:manifest.pricing,documents:manifest.documents,configurationEvidence:manifest.artifacts.configurationEvidence,rawSnapshot:manifest.artifacts.rawSnapshot,packageChecksum,pricingSummary,documentPairs:manifest.documents.recordsArtifact.rowCount};
}

export function brochureBankPayloads(plan,ids,now){
 const summary={...plan.pricingSummary,exactCombinationCount:plan.documentPairs,sparse:true,interpolationAllowed:false,recordsExternalByDesign:true};
 return {
  supplier:{id:ids.supplierId,name:'WIRmachenDRUCK',slug:'wir-machen-druck',website_url:'https://www.wir-machen-druck.de',country_code:'DE',currency:'EUR',integration_type:'playwright',enabled:true,metadata:{writer:'write-brochure-bank-draft.mjs',insertOnly:true}},
  run:{id:ids.scrapeRunId,supplier_id:ids.supplierId,mode:'product_extract',tool:'playwright',status:'succeeded',input:{sourceUrl:plan.source.entryUrl,runId:plan.runId,packageChecksum:plan.packageChecksum},summary:{...summary,productFamily:plan.product.family,bankOnly:true},started_at:plan.source.capturedAt,finished_at:now},
  product:{id:ids.bankProductId,supplier_id:ids.supplierId,latest_scrape_run_id:ids.scrapeRunId,supplier_product_key:plan.product.sourceKey,source_url:plan.source.entryUrl,source_hash:plan.packageChecksum,product_family:plan.product.family,name_original:plan.product.nameOriginal,name_da:plan.product.nameDa,description_original:plan.product.descriptionOriginal,description_da:plan.product.descriptionDa,source_language:plan.product.sourceLanguage,target_language:'da',status:'draft',normalized_attributes:{axisOrder:AXES,groups:plan.optionGroups},normalized_pricing_summary:summary,raw_snapshot_path:plan.rawSnapshot,scrape_status:'fresh',last_scraped_at:plan.source.capturedAt,last_price_checked_at:now,metadata:{runId:plan.runId,packageChecksum:plan.packageChecksum,pricingArtifact:plan.pricing.recordsArtifact,documentArtifact:plan.documents.recordsArtifact,configurationEvidence:plan.configurationEvidence,externalArtifactsAreAuthoritative:true,freeSizeQuoteRequired:true,approvalBoundary:{bankDraftOnly:true,liveProductWrite:false,livePricingWrite:false,templateUpload:false,publicationWrite:false}}},
  snapshot:{id:ids.priceSnapshotId,bank_product_id:ids.bankProductId,supplier_id:ids.supplierId,scrape_run_id:ids.scrapeRunId,currency:plan.pricing.supplierCurrency,conversion_rule_key:plan.pricing.conversionRuleKey,raw_price_rows:[],normalized_price_rows:[],price_min_dkk:plan.pricingSummary.priceMinDkk,price_max_dkk:plan.pricingSummary.priceMaxDkk,quantity_min:plan.pricingSummary.quantityMin,quantity_max:plan.pricingSummary.quantityMax,checksum:plan.pricing.recordsArtifact.sha256,metadata:{runId:plan.runId,packageChecksum:plan.packageChecksum,recordsExternalByDesign:true,recordsArtifact:plan.pricing.recordsArtifact,rowCount:plan.pricingSummary.rowCount,documentPairCount:plan.documentPairs,rawEvidenceRetainedLocally:true,bankOnly:true}}
 };
}

export function assertBrochureBankReadback(actual,expected,table){
 assert(actual,'Missing bank readback');
 for(const [key,value] of Object.entries(expected)){
  const matches=key.endsWith('_at')?Date.parse(actual[key])===Date.parse(value):brochureChecksum(actual[key])===brochureChecksum(value);
  assert(matches,`${table} readback changed field ${key}; no overwrite permitted`);
 }
}

async function one(query,label){const {data,error}=await query.maybeSingle();if(error)throw Error(`${label}: ${error.message}`);return data;}
export async function brochureBankRemotePreflight(client,plan){
 const supplier=await one(client.from('supplier_bank_suppliers').select('id,slug').eq('slug',plan.source.supplierSlug),'supplier lookup');
 const product=supplier?await one(client.from('supplier_bank_products').select('id,status,source_hash,metadata').eq('supplier_id',supplier.id).eq('supplier_product_key',plan.product.sourceKey),'bank collision lookup'):null;
 return {supplier,product};
}

export async function applyBrochureBankDraft({client,plan,receipt,saveReceipt}){
 assert(receipt.packageChecksum===plan.packageChecksum&&receipt.runId===plan.runId,'Write receipt belongs to another package');
 const existing=await brochureBankRemotePreflight(client,plan);
 if(existing.product){
  assert(existing.product.id===receipt.ids.bankProductId&&existing.product.source_hash===plan.packageChecksum&&existing.product.status==='draft','Existing Supplier Bank product collision; no overwrite permitted');
 }
 if(existing.supplier){
  assert(!receipt.completedSteps.length||receipt.ids.supplierId===existing.supplier.id,'Supplier identity changed during draft resume');
  receipt.ids.supplierId=existing.supplier.id;
 }
 await saveReceipt(receipt);
 const payloads=brochureBankPayloads(plan,receipt.ids,receipt.createdAt);
 const steps=[...(!existing.supplier?[['supplier_bank_suppliers','supplier']]:[]),['supplier_bank_scrape_runs','run'],['supplier_bank_products','product'],['supplier_bank_price_snapshots','snapshot']];
 for(const [table,key] of steps){
  const payload=payloads[key];
  receipt.pendingStep=key;await saveReceipt(receipt); // Durable intent before a request can have an unknown outcome.
  let row=await one(client.from(table).select('*').eq('id',payload.id),`${table} resume read`);
  if(!row){
   const result=await client.from(table).insert(payload).select('*').single();
   if(result.error)throw Error(`${table} insert: ${result.error.message}`);
   row=result.data;
  }
  assertBrochureBankReadback(row,payload,table);
  const verified=await one(client.from(table).select('*').eq('id',payload.id),`${table} persisted readback`);
  assertBrochureBankReadback(verified,payload,table);
  if(!receipt.completedSteps.includes(key))receipt.completedSteps.push(key);
  receipt.pendingStep=null;await saveReceipt(receipt);
 }
 receipt.status='verified_bank_draft';receipt.verifiedAt=new Date().toISOString();
 receipt.approvalBoundary={supplierBankDraftWritten:true,liveProductChanged:false,livePricingChanged:false,templatesUploaded:false,productPublished:false};
 receipt.rollbackNote='Preserve partial/complete receipts. Any cleanup is limited to the recorded rows created for this package, in snapshot → bank product → scrape run order. Never delete a reused supplier or change a live Webprinter product.';
 await saveReceipt(receipt);
 return receipt;
}
