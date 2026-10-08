#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {once} from 'node:events';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {config as dotenv} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {allocateBrochureProductPlan} from './shared/brochure-product-plan.js';
import {brochureChecksum} from './shared/brochure-bank-draft.js';
import {inspectBrochureArtifact} from './write-brochure-bank-draft.mjs';
import {assertBrochureProductPacket,brochurePriceId,brochureProductRemotePreflight,applyBrochureProductDraft} from './shared/brochure-product-draft.js';
import {brochureManagementCounter} from './shared/brochure-management-count.js';

const atomicJson=async(file,value)=>{await fs.writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');await fs.rename(file+'.tmp',file);};
const hashBytes=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function rebuildBrochurePriceResolver(manifest,plan){
  const ids=plan.productGroups.flatMap(group=>[group.id,...plan.productValues.filter(value=>value.group_id===group.id).map(value=>value.id)]);
  const rebuilt=allocateBrochureProductPlan(manifest,{tenantId:plan.tenantId,productId:plan.proposedProductId,idFactory:()=>ids.shift()});
  assert(ids.length===0 && brochureChecksum([...rebuilt.catalogs.values()].map(row=>row.group))===brochureChecksum(plan.productGroups)
    && brochureChecksum([...rebuilt.catalogs.values()].flatMap(row=>row.values))===brochureChecksum(plan.productValues),'Allocated catalogue no longer matches source');
  return rebuilt;
}
/** Bounded-memory original-artifact scan. The reused publisher is the only
 * price mapper; its destructive replacement operation is never called. */
export async function* streamBrochurePrices(root,manifest,plan,resolver,bank){
  const artifact=plan.sourcePricingArtifact,filename=path.resolve(root,artifact.path);
  assert(filename.startsWith(path.resolve(root)+path.sep),'Price path escapes reviewed packet');
  const input=createReadStream(filename),hash=crypto.createHash('sha256');let bytes=0,order=0;
  input.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk);});
  for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
    assert(line.trim(),'Blank source price row');const source=JSON.parse(line);
    assert(source.sourceOrder===order,'Noncontiguous original source price order');
    const row=resolver.priceRow(source);
    row.id=brochurePriceId(plan.proposedProductId,order);
    row.extra_data={...row.extra_data,sourceOrder:order,supplierPrice:source.supplierPrice,supplierCurrency:'EUR',
      convertedPriceDkk:source.convertedPriceDkk,conversionRuleKey:'wmd_tiered_fx_7_5',sourceUrl:source.sourceUrl,
      priceArtifactSha256:artifact.sha256,...(bank?{supplierBankProductId:bank.ids.bankProductId,priceSnapshotId:bank.ids.priceSnapshotId}:{})};
    yield {sourceOrder:order++,...row};
  }
  assert(order===artifact.rowCount && bytes===artifact.bytes && hash.digest('hex')===artifact.sha256,'Source price stream checksum/count changed');
}
export async function prepareBrochureTemplateAssets(root,plan){
  return Promise.all(plan.documents.templates.map(async template=>{
    const c=template.contract,file=path.resolve(root,c.sanitizedPdfPath);
    assert(file.startsWith(path.resolve(root)+path.sep),'Template path escapes packet');
    const bytes=await fs.readFile(file);
    assert(hashBytes(bytes)===c.templatePdfSha256,'Reviewed template bytes changed');
    return {file,sha256:c.templatePdfSha256,objectPath:`template-pdfs/${plan.tenantId}/supplier-imports/brochures/${plan.proposedProductId}/${c.templatePdfSha256}.pdf`,bytes};
  }));
}
async function missingBrochureStorageObject(error){
  if(Number(error?.statusCode||error?.status)===404)return true;
  // Binary downloads set noResolveJson in storage-js: a non-2xx Response
  // becomes StorageUnknownError even when it has a documented NoSuchKey body.
  // Decode that precise case; never infer absence from a generic 400 or denial.
  const response=error?.originalError;
  if(!(response instanceof Response)||![400,404].includes(response.status))return false;
  try{const body=await response.clone().json();
    return body.code==='NoSuchKey'&&Number(body.statusCode)===404;
  }catch{return false;}
}
export async function uploadImmutableAssets(client,assets,receipt,saveReceipt){
  const store=client.storage.from('design-library'),uploaded=[];
  for(const asset of assets){
    receipt.pendingStep=`asset:${asset.sha256}`;await saveReceipt(receipt);
    let result=await store.download(asset.objectPath);
    if(result.error){
      assert(await missingBrochureStorageObject(result.error),'Storage read unavailable; cannot assume object missing');
      const inserted=await store.upload(asset.objectPath,asset.bytes,{contentType:'application/pdf',upsert:false,cacheControl:'31536000'});
      if(inserted.error)throw Error(`Immutable template upload: ${inserted.error.message}`);
      result=await store.download(asset.objectPath);
    }
    assert(!result.error && result.data,'Immutable template persisted readback unavailable');
    assert(hashBytes(Buffer.from(await result.data.arrayBuffer()))===asset.sha256,'Immutable template hash changed; no overwrite permitted');
    const url=store.getPublicUrl(asset.objectPath).data.publicUrl;
    assert(url,'Template public URL missing');
    uploaded.push({sha256:asset.sha256,objectPath:asset.objectPath,url});
    receipt.storageObjects=[...receipt.storageObjects.filter(row=>row.objectPath!==asset.objectPath),{bucket:'design-library',objectPath:asset.objectPath,sha256:asset.sha256,url}];
    receipt.pendingStep=null;await saveReceipt(receipt);
  }
  return uploaded;
}
export async function writeResolvedDocuments(root,plan,receipt){
  const artifact=plan.sourceDocumentArtifact,input=createReadStream(path.resolve(root,artifact.path)),sourceHash=crypto.createHash('sha256');
  const relative='normalized/document-bindings-product.jsonl',filename=path.join(root,relative),output=createWriteStream(filename+'.tmp');
  let outputError;output.on('error',error=>{outputError=error;});
  const outputHash=crypto.createHash('sha256');let sourceBytes=0,bytes=0,rowCount=0;
  input.on('data',chunk=>{sourceBytes+=chunk.length;sourceHash.update(chunk);});
  const templates=new Map(plan.documents.templates.map(template=>[template.contract.formatSourceKey,template]));
  try{
    for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
      if(outputError)throw outputError;
      const row=JSON.parse(line),template=templates.get(row.match.format),id=receipt.actualDesignerTemplateIds[row.match.format];
      assert(id===template?.proposedDesignerTemplateId && row.template.sanitizedPdfSha256===template.contract.templatePdfSha256,'Persisted template binding mismatch');
      row.template.designerTemplateId=id;
      const data=Buffer.from(JSON.stringify(row)+'\n');bytes+=data.length;rowCount++;outputHash.update(data);
      if(!output.write(data))await once(output,'drain');
    }
    if(outputError)throw outputError;output.end();await once(output,'finish');
    assert(rowCount===artifact.rowCount && sourceBytes===artifact.bytes && sourceHash.digest('hex')===artifact.sha256,'Original document artifact changed');
    await fs.rename(filename+'.tmp',filename);
    return {path:relative,format:'jsonl',rowCount,bytes,sha256:outputHash.digest('hex')};
  }catch(error){output.destroy();throw error;}
}
function validate(manifestPath){
  const checked=spawnSync(process.execPath,['--max-old-space-size=8192','.agents/skills/import-supplier-product/scripts/validate-import-manifest.mjs',manifestPath],{encoding:'utf8',maxBuffer:4*1024*1024});
  if(checked.status!==0)throw Error(`Active manifest validator rejected packet: ${checked.stderr||checked.stdout}`);
}
export async function main(args=process.argv.slice(2)){
  assert(args.every(value=>!value.startsWith('--')||['--confirm-product-draft','--preflight-remote'].includes(value)),'Unknown brochure product flag');
  const supplied=args.filter(value=>!value.startsWith('--'));assert(supplied.length===1,'Usage: import-brochure-product-draft.mjs manifest.json [--preflight-remote | --confirm-product-draft]');
  const manifestPath=path.resolve(supplied[0]),root=path.dirname(manifestPath),manifest=JSON.parse(await fs.readFile(manifestPath));
  const plan=JSON.parse(await fs.readFile(path.join(root,'product-resolution-plan.json'))),resolver=rebuildBrochurePriceResolver(manifest,plan);
  assert(plan.databaseWrites===false && plan.proposedIdsOnly===true && plan.tenantId==='00000000-0000-0000-0000-000000000000'
    && plan.sourcePricingArtifact.sha256===manifest.pricing.recordsArtifact.sha256,'Only the reviewed local brochure resolution plan is allowed');
  const assets=await prepareBrochureTemplateAssets(root,plan);
  // All rows are mapped and checksummed before a write boundary is crossed.
  let mapped=0;const quantities=new Set();for await(const row of streamBrochurePrices(root,manifest,plan,resolver,null)){mapped++;quantities.add(row.quantity);}
  assert(brochureChecksum([...quantities].sort((a,b)=>a-b))===brochureChecksum(plan.pricingStructure.quantities),'Configured quantities do not match original source tiers');
  await inspectBrochureArtifact(root,plan.sourceDocumentArtifact);
  const confirmed=args.includes('--confirm-product-draft'),remote=confirmed||args.includes('--preflight-remote');
  const summary={databaseWrites:false,proposedProductId:plan.proposedProductId,tenantId:plan.tenantId,priceRows:mapped,
    templates:assets.length,groups:plan.productGroups.length,values:plan.productValues.length,planChecksum:brochureChecksum(plan),
    sourcePricingArtifact:plan.sourcePricingArtifact,sourceDocumentArtifact:plan.sourceDocumentArtifact,
    mutationBoundary:'Insert-only new unpublished brochure product; existing generic matrix publisher row contract; separate verified bank receipt required'};
  await atomicJson(path.join(root,'product-write-preflight.json'),summary);
  if(!remote){console.log(JSON.stringify(summary,null,2));return summary;}
  const bank=JSON.parse(await fs.readFile(path.join(root,'bank-draft-receipt.json')));assertBrochureProductPacket(manifest,plan,bank);
  const receiptPath=path.join(root,'product-draft-receipt.json');let receipt;
  try{receipt=JSON.parse(await fs.readFile(receiptPath));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(receipt)assert(receipt.planChecksum===summary.planChecksum && receipt.productId===plan.proposedProductId,'Preserve receipt from another packet');
  dotenv({path:'.env',quiet:true});dotenv({path:'.env.local',quiet:true});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url&&key,'Server-only Supabase configuration missing');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const projectRef=new URL(url).hostname.split('.')[0];
  const managementCount=process.env.SUPABASE_ACCESS_TOKEN?brochureManagementCounter({projectRef,accessToken:process.env.SUPABASE_ACCESS_TOKEN}):undefined;
  summary.remote=await brochureProductRemotePreflight(client,plan,bank,receipt);await atomicJson(path.join(root,'product-write-preflight.json'),summary);
  if(!confirmed){console.log(JSON.stringify(summary,null,2));return summary;}
  validate(manifestPath);
  receipt??={version:1,runId:manifest.runId,productId:plan.proposedProductId,bankProductId:bank.ids.bankProductId,
    planChecksum:summary.planChecksum,status:'pending',createdAt:new Date().toISOString(),importJobId:crypto.randomUUID(),
    completedSteps:[],storageObjects:[],verifiedPriceRows:0};
  const saveReceipt=value=>atomicJson(receiptPath,value);await saveReceipt(receipt);
  try{
    const uploaded=await uploadImmutableAssets(client,assets,receipt,saveReceipt);
    let lastProgress=0;
    await applyBrochureProductDraft({client,manifest,plan,bank,receipt,saveReceipt,assets:uploaded,managementCount,
      priceRows:streamBrochurePrices(root,manifest,plan,resolver,bank),onProgress:progress=>{
        if(Date.now()-lastProgress>=30000||progress.verifiedPriceRows===progress.totalPriceRows){
          console.log(JSON.stringify({phase:'price_readback',...progress,at:new Date().toISOString()}));lastProgress=Date.now();
        }
      }});
    const resolved=await writeResolvedDocuments(root,plan,receipt);
    manifest.documents.recordsArtifact=resolved;
    manifest.target={...manifest.target,state:'product_draft',productDraft:{productId:receipt.productId,tenantId:plan.tenantId,verifiedAt:receipt.verifiedAt,planChecksum:receipt.planChecksum}};
    manifest.artifacts={...manifest.artifacts,productDraftVerification:'product-draft-receipt.json',originalDocumentArtifact:plan.sourceDocumentArtifact};
    await atomicJson(manifestPath,manifest);validate(manifestPath);
    receipt.postWriteManifestValidated=true;await saveReceipt(receipt);
    console.log(JSON.stringify({state:'product_draft',productId:receipt.productId,priceRows:receipt.verifiedPriceRows,
      documentBindings:resolved.rowCount,templates:19,published:false,postWriteManifestValidated:true},null,2));return receipt;
  }catch(error){receipt.status='needs_resume';receipt.error=error.message;await saveReceipt(receipt);throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
