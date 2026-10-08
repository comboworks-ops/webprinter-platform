#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {config as dotenv} from 'dotenv';
import {brochureBankPlan,brochureBankRemotePreflight,applyBrochureBankDraft} from './shared/brochure-bank-draft.js';

export async function inspectBrochureArtifact(root,artifact,{prices=false}={}){
 const filename=path.resolve(root,artifact.path);
 if(!filename.startsWith(path.resolve(root)+path.sep))throw Error('Brochure artifact escapes the reviewed packet');
 const input=createReadStream(filename),hash=crypto.createHash('sha256');
 let bytes=0,rowCount=0,quantityMin=Infinity,quantityMax=0,priceMinDkk=Infinity,priceMaxDkk=0;
 input.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk);});
 for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
  if(!line.trim())throw Error('Blank row in brochure artifact');
  rowCount++;
  if(prices){const row=JSON.parse(line);if(!Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>10000||!Number.isFinite(row.finalPriceDkk)||row.finalPriceDkk<=0)throw Error('Invalid price artifact row');quantityMin=Math.min(quantityMin,row.quantity);quantityMax=Math.max(quantityMax,row.quantity);priceMinDkk=Math.min(priceMinDkk,row.finalPriceDkk);priceMaxDkk=Math.max(priceMaxDkk,row.finalPriceDkk);}
 }
 if(bytes!==artifact.bytes||rowCount!==artifact.rowCount||hash.digest('hex')!==artifact.sha256)throw Error(`Reviewed artifact checksum/count mismatch: ${artifact.path}`);
 return {rowCount,...(prices?{quantityMin,quantityMax,priceMinDkk,priceMaxDkk}:{})};
}
const atomicJson=async(filename,value)=>{await fs.writeFile(filename+'.tmp',JSON.stringify(value,null,2)+'\n');await fs.rename(filename+'.tmp',filename);};
function validate(manifestPath){
 const result=spawnSync(process.execPath,['--max-old-space-size=8192','.agents/skills/import-supplier-product/scripts/validate-import-manifest.mjs',manifestPath],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.status!==0)throw Error(`Active schema-v2 validator rejected package: ${result.stderr||result.stdout}`);
}
export async function main(args=process.argv.slice(2)){
 const manifestArg=args.find(value=>!value.startsWith('--'));
 if(!manifestArg)throw Error('Usage: node scripts/product-import/write-brochure-bank-draft.mjs manifest.json [--preflight-remote | --confirm-bank-write]');
 if(args.some(value=>value.startsWith('--')&&!['--preflight-remote','--confirm-bank-write'].includes(value)))throw Error('Unknown brochure bank flag');
 const manifestPath=path.resolve(manifestArg),root=path.dirname(manifestPath),manifest=JSON.parse(await fs.readFile(manifestPath));
 brochureBankPlan(manifest,{rowCount:manifest.pricing.recordsArtifact.rowCount,quantityMin:1,quantityMax:10000,priceMinDkk:1,priceMaxDkk:1});
 console.log('Checking checksum-bound brochure artifacts without loading them into memory…');
 const pricingSummary=await inspectBrochureArtifact(root,manifest.pricing.recordsArtifact,{prices:true});
 await inspectBrochureArtifact(root,manifest.documents.recordsArtifact);
 await inspectBrochureArtifact(root,manifest.artifacts.configurationEvidence);
 const plan=brochureBankPlan(manifest,pricingSummary);
 const confirmed=args.includes('--confirm-bank-write'),remote=args.includes('--preflight-remote')||confirmed;
 let client,preflight=null;
 if(remote){
  dotenv({path:'.env',quiet:true});dotenv({path:'.env.local',quiet:true});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error('Server-only Supabase configuration missing');
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  preflight=await brochureBankRemotePreflight(client,plan);
 }
 const preflightReport={runId:plan.runId,packageChecksum:plan.packageChecksum,pricingArtifact:plan.pricing.recordsArtifact,documentArtifact:plan.documents.recordsArtifact,pricingSummary,existingSupplierId:preflight?.supplier?.id??null,existingBankProduct:preflight?.product??null,remotePreflight:remote,databaseWrites:false,mutationBoundary:'Only supplier_bank_* rows; authoritative checksum-bound external artifact protocol reused from sales-folder draft import'};
 await atomicJson(path.join(root,'bank-write-preflight.json'),preflightReport);
 console.log(JSON.stringify(preflightReport,null,2));
 if(!confirmed){console.log('No database writes. --confirm-bank-write requires the separate human Supplier Bank approval.');return preflightReport;}
 validate(manifestPath); // All source/template/compatibility safeguards still apply at the write boundary.
 const receiptPath=path.join(root,'bank-draft-receipt.json');
 let receipt;
 try{receipt=JSON.parse(await fs.readFile(receiptPath));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!receipt){
  if(preflight.product)throw Error('Existing bank product collision; no new or overwritten rows');
  receipt={version:1,runId:plan.runId,packageChecksum:plan.packageChecksum,status:'pending',createdAt:new Date().toISOString(),ids:{supplierId:preflight.supplier?.id||crypto.randomUUID(),scrapeRunId:crypto.randomUUID(),bankProductId:crypto.randomUUID(),priceSnapshotId:crypto.randomUUID()},completedSteps:[]};
 }
 try{
  const saveReceipt=value=>atomicJson(receiptPath,value);
  await applyBrochureBankDraft({client,plan,receipt,saveReceipt});
  manifest.target={...manifest.target,state:'bank_draft',bankDraft:{...receipt.ids,packageChecksum:plan.packageChecksum,priceChecksum:plan.pricing.recordsArtifact.sha256,verifiedAt:receipt.verifiedAt}};
  manifest.artifacts={...manifest.artifacts,bankDraftVerification:'bank-draft-receipt.json'};
  await atomicJson(manifestPath,manifest);
  validate(manifestPath);
  console.log(JSON.stringify({state:'bank_draft',verified:true,remote:receipt.ids,priceRows:pricingSummary.rowCount,liveProductChanged:false},null,2));
  return receipt;
 }catch(error){receipt.status='needs_resume';receipt.error=error.message;await atomicJson(receiptPath,receipt);throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
