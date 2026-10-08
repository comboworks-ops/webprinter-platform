#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {brochureVariants, brochureSupplierNet, brochurePricePolicy} from './shared/brochure-pricing.js';
import {applyConversionRule} from './shared/conversion.js';
import {brochurePaperLabelDa as danish} from './shared/brochure-copy.js';

const root='output/brochure-2026-10-06', target=path.join(root,'preview');
const articleFilter=process.argv.includes('--article')?process.argv[process.argv.indexOf('--article')+1]:null;
async function writeAtomic(file,value){await fs.writeFile(`${file}.part`,value);await fs.rename(`${file}.part`,file);}
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const readGz=async file=>JSON.parse(gunzipSync(await fs.readFile(file)).toString());
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const formatNames={'210x297':'A4','148x210':'A5','105x148':'A6','74x105':'A7','52x74':'A8','297x420':'A3','99x210':'DIN lang','297x210':'A4','210x148':'A5','148x105':'A6','105x74':'A7','210x99':'DIN lang'};
await fs.mkdir(path.join(target,'articles'),{recursive:true});
const discovery=await read(path.join(root,'discovery.json'));
const templates=await read(path.join(root,'documents/templates.json'));
let policyIndex;
try { policyIndex=await read(path.join(root,'verified-policy-index.json')); } catch {}
const bindings=new Map((policyIndex?.verified?policyIndex.bindings:[]).map(value=>[`${value.articleId}/${value.substrateId}`,value]));
const formats=new Map(), articles=[];
let baseComplete=0, attributeComplete=0, priceRows=0, verifiedMaterials=0;
const failures=[];
for(const article of discovery.articles) {
 const inventory=await read(path.join(root,'inventory',`${article.articleId}.json`));
 const key=inventory.orientation==='free'?'free':`${inventory.widthMm}x${inventory.heightMm}`;
 if(!formats.has(key)) formats.set(key,{key,orientation:inventory.orientation,widthMm:inventory.widthMm,heightMm:inventory.heightMm,label:inventory.orientation==='free'?'Fri størrelse':`${formatNames[key]?`${formatNames[key]} · `:''}${inventory.widthMm} × ${inventory.heightMm} mm`,pages:[],template:templates.find(t=>t.key===key)||null});
 const format=formats.get(key); format.pages.push({pageCount:inventory.pageCount,articleId:inventory.articleId});
 let base,attributes,baseHash;
 try{const bytes=await fs.readFile(path.join(root,'base-prices',`${article.articleId}.json.gz`));base=JSON.parse(gunzipSync(bytes));baseHash=createHash('sha256').update(bytes).digest('hex');baseComplete++;}catch{}
 try{attributes=await readGz(path.join(root,'attributes',`${article.articleId}.json.gz`));attributeComplete++;}catch{}
 const rows=[];
 for(const material of inventory.materials) {
  const tiers=base?.rows.find(r=>r.substrateId===material.id)?.tiers||[];
  const fields=attributes?.materials.find(r=>r.substrateId===material.id)?.fields;
  let variants=[];
  try {
   if(fields) {
    const signature=hash(fields),binding=bindings.get(`${article.articleId}/${material.id}`);
    let verified=binding?.fieldsSha256===signature && binding?.basePricesSha256===baseHash && binding?.policyKey===hash({format:key,policy:brochurePricePolicy(fields)});
    // Legacy proofs may have covered fewer options; never use them for a newly
    // expanded finish policy without the current exact policy verification.
    if(verified) { variants=brochureVariants(fields);verifiedMaterials++; }
   }
  } catch(error) { if(!['ENOENT'].includes(error.code))failures.push({articleId:inventory.articleId,substrateId:material.id,reason:error.message}); }
  rows.push({id:material.id,labelOriginal:material.label,labelDa:danish(material.label),sourceOrder:material.sourceOrder,
   variants:variants.map(v=>({cover:v.cover,varnish:v.varnish,selections:v.selections,prices:tiers.map(t=>{const eur=brochureSupplierNet(t.supplierNetEur,v.percentage);priceRows++;return[t.quantity,applyConversionRule(eur,'wmd_tiered_fx_7_5').finalPriceDkk,eur,t.priceScaleId];})}))});
 }
 const quantities=[...new Set(base?.rows.flatMap(r=>r.tiers.map(t=>t.quantity))||[])].sort((a,b)=>a-b);
 const payload={articleId:inventory.articleId,pageCount:inventory.pageCount,formatKey:key,quantities,rows,priceComplete:rows.every(r=>r.variants.length>0)&&quantities.length>0};
 if(!articleFilter||articleFilter===inventory.articleId)await writeAtomic(path.join(target,'articles',`${inventory.articleId}.json`),JSON.stringify(payload));
 articles.push({articleId:inventory.articleId,formatKey:key,pageCount:inventory.pageCount,materials:rows.length,priceComplete:payload.priceComplete});
}
const ordered=[...formats.values()].map(f=>({...f,pages:f.pages.sort((a,b)=>a.pageCount-b.pageCount)}));
ordered.sort((a,b)=>['portrait','landscape','square','free'].indexOf(a.orientation)-['portrait','landscape','square','free'].indexOf(b.orientation)||b.widthMm*b.heightMm-a.widthMm*a.heightMm);
const catalog={version:1,name:'Brochurer med trådhæftning',generatedAt:new Date().toISOString(),formats:ordered,freeSize:{minWidthMm:98,minHeightMm:98,maxWidthMm:297,maxHeightMm:297,sourceArtifact:'free-get-options.json',sourceArticleId:'2009'},
 counts:{articles:articles.length,baseComplete,attributeComplete,verifiedMaterials,priceRows,completeArticles:articles.filter(a=>a.priceComplete).length},articles,
 descriptionDa:'Magasiner, programmer og brochurer med klassisk trådhæftning. Vælg format, sidetal, indholdspapir og omslag. Alle sider trykkes i fuldfarve på begge sider. Sidetallet omfatter omslaget.'};
await writeAtomic(path.join(target,'catalog.json'),JSON.stringify(catalog));
await fs.writeFile(path.join(root,'package-progress.json'),JSON.stringify({...catalog.counts,failures,databaseWrites:false,published:false},null,2));
console.log(JSON.stringify(catalog.counts));
