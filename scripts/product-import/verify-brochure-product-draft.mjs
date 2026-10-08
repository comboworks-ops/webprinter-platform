#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import crypto from 'node:crypto';
import {config as dotenv} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {rebuildBrochurePriceResolver} from './import-brochure-product-draft.mjs';
import {brochurePriceId,countBrochureOwned} from './shared/brochure-product-draft.js';
import {brochureManagementCounter} from './shared/brochure-management-count.js';
import {assertBrochureBankReadback,brochureChecksum} from './shared/brochure-bank-draft.js';

const assert=(ok,message)=>{if(!ok)throw Error(message);};
const root=path.resolve(process.argv[2]||'output/brochure-2026-10-06/review/complete');
const allowPartial=process.argv.includes('--allow-partial');
const read=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const [manifest,plan,receipt,bank]=await Promise.all(['import-manifest.json','product-resolution-plan.json','product-draft-receipt.json','bank-draft-receipt.json'].map(read));
const complete=receipt.status==='verified_product_draft'&&receipt.postWriteManifestValidated===true&&manifest.target.state==='product_draft';
assert((complete||(allowPartial&&receipt.status==='needs_resume'))&&receipt.planChecksum===brochureChecksum(plan),'Complete persisted draft receipt required, or explicitly request partial readback');
const countProofPath=process.argv.find(arg=>arg.startsWith('--count-proof='))?.slice('--count-proof='.length);
const countProof=countProofPath?JSON.parse(await fs.readFile(path.resolve(countProofPath),'utf8')):null;
if(countProof)assert(!complete&&allowPartial&&countProof.method.startsWith('Supabase MCP read-only SQL')
  &&countProof.productId===receipt.productId&&countProof.tenantId===plan.tenantId
  &&Date.now()-Date.parse(countProof.verifiedAt)>=0&&Date.now()-Date.parse(countProof.verifiedAt)<15*60*1000,'Recent scoped partial MCP count proof required');
dotenv({path:'.env',quiet:true});dotenv({path:'.env.local',quiet:true});
const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
const create=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const client=create(process.env.SUPABASE_SERVICE_ROLE_KEY),publicClient=create(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const managementCount=process.env.SUPABASE_ACCESS_TOKEN?brochureManagementCounter({projectRef:new URL(url).hostname.split('.')[0],accessToken:process.env.SUPABASE_ACCESS_TOKEN}):undefined;
const productResult=await client.from('products').select('*').eq('id',receipt.productId).eq('tenant_id',plan.tenantId).single();
assert(!productResult.error&&productResult.data,'Saved brochure product missing');
const product=productResult.data;
assert(product.is_published===false&&product.is_ready===false&&product.is_available_to_tenants===false,'Draft publication boundary changed');
assert(brochureChecksum(product.pricing_structure)===brochureChecksum(plan.pricingStructure),'Saved matrix structure changed');
assert(product.technical_specs?.site_modes?.designer_mode==='brochure'&&product.template_files?.length===19,'Saved brochure workflow/template metadata missing');
const counts={};
for(const [table,expected] of [['generic_product_prices',complete?plan.sourcePricingArtifact.rowCount:receipt.verifiedPriceRows],['product_attribute_groups',plan.productGroups.length],['product_attribute_values',plan.productValues.length]]){
  const result=countProof?{count:countProof.counts[table],error:null}:{count:await countBrochureOwned(client,table,plan,expected,managementCount),error:null};
  assert(!result.error&&result.count===expected,`${table} count readback: ${result.error?.message||`expected ${expected}, received ${result.count}`}`);counts[table]=result.count;
}
const templateResult=await client.from('designer_templates').select('id,tenant_id,width_mm,height_mm,template_pdf_url,tags,is_public,is_active')
  .in('id',complete?Object.values(receipt.actualDesignerTemplateIds):plan.documents.templates.map(row=>row.proposedDesignerTemplateId));
assert(!templateResult.error&&templateResult.data?.length===19,'Saved templates missing');
const templateProof=[];
for(const native of templateResult.data){
  const definition=plan.documents.templates.find(row=>row.proposedDesignerTemplateId===native.id),contract=definition?.contract;
  assert(contract&&native.tenant_id===plan.tenantId&&native.is_public===false&&native.is_active===true
    &&native.width_mm===contract.widthMm&&native.height_mm===contract.heightMm&&native.tags.includes(contract.templatePdfSha256),'Saved template contract changed');
  const linked=product.template_files.find(row=>row.designerTemplateId===native.id);
  assert(linked?.pdfUrl===native.template_pdf_url&&linked.templatePdfSha256===contract.templatePdfSha256,'Product template link changed');
  const response=await fetch(native.template_pdf_url);assert(response.ok,'Public template bytes unavailable');
  const bytes=Buffer.from(await response.arrayBuffer()),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  assert(sha256===contract.templatePdfSha256,'Public template byte hash changed');
  templateProof.push({format:contract.formatSourceKey,designerTemplateId:native.id,url:native.template_pdf_url,sha256,bytes:bytes.length});
}
// Independently sample every format's original low/high source tiers and each
// cover/varnish type. Complete per-row readback is already in the apply receipt.
const samples=new Map(),input=createReadStream(path.join(root,plan.sourcePricingArtifact.path));
for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
  const source=JSON.parse(line);if(![1,10000].includes(source.quantity)||(!complete&&source.sourceOrder>=receipt.verifiedPriceRows))continue;
  const selections=source.selections;
  for(const key of [`format:${selections.format}:${source.quantity}`,`cover:${selections.cover}:${source.quantity}`,`varnish:${selections.varnish}:${source.quantity}`]){
    if(!samples.has(key))samples.set(key,source);
  }
}
const sampledFormats=new Set([...samples.values()].map(row=>row.selections.format)).size;
assert(complete?sampledFormats===19:sampledFormats>0,'Source format sample coverage missing');
const resolver=rebuildBrochurePriceResolver(manifest,plan),expected=new Map();
for(const source of samples.values()){
  const row=resolver.priceRow(source);row.id=brochurePriceId(product.id,source.sourceOrder);
  row.extra_data={...row.extra_data,sourceOrder:source.sourceOrder,supplierPrice:source.supplierPrice,supplierCurrency:'EUR',
    convertedPriceDkk:source.convertedPriceDkk,conversionRuleKey:'wmd_tiered_fx_7_5',sourceUrl:source.sourceUrl,
    priceArtifactSha256:plan.sourcePricingArtifact.sha256,supplierBankProductId:bank.ids.bankProductId,priceSnapshotId:bank.ids.priceSnapshotId};
  expected.set(row.id,row);
}
const saved=await publicClient.from('generic_product_prices').select('*').eq('product_id',product.id).in('id',[...expected.keys()]);
assert(!saved.error&&saved.data?.length===expected.size,'Normal public matrix price read failed');
for(const row of saved.data)assertBrochureBankReadback(row,expected.get(row.id),'public brochure sample');
const proof={verifiedAt:new Date().toISOString(),complete,productId:product.id,slug:product.slug,published:false,counts,
  countVerification:countProof?{method:countProof.method,path:countProofPath,verifiedAt:countProof.verifiedAt}:'Live REST exact counts with scoped read-only Management API fallback on REST failure',
  expectedPriceRows:plan.sourcePricingArtifact.rowCount,remainingPriceRows:plan.sourcePricingArtifact.rowCount-counts.generic_product_prices,
  templates:templateProof,publicMatrixSourceSamples:expected.size,sampledSourceFormats:sampledFormats,priceRowVerification:'Every completed prefix row read back by insert-only writer, independently sampled again through normal public price permissions',
  accountSaveReopen:'Requires an existing authenticated user; no credentials or access permissions changed',paymentCreated:false,existingProductsChanged:false};
const filename=path.join(root,complete?'persisted-product-verification.json':'persisted-product-partial-verification.json');await fs.writeFile(filename,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({verified:true,complete,productId:product.id,priceRows:counts.generic_product_prices,remainingPriceRows:proof.remainingPriceRows,publicMatrixSourceSamples:expected.size,templateHashesVerified:19,published:false},null,2));
