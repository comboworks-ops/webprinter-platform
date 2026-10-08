/** Seal a locally captured family delta through the existing canonical
 * normalization, conversion and generic-row publisher. No remote mutations. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createNormalizedMatrixRecord} from './product-import/shared/normalized-pricing.js';
import {applyConversionRule} from './product-import/shared/conversion.js';
import {rollLabelHash} from './product-import/shared/roll-label-catalogue.js';
import {readRollLabelLocalPriceLedgers,buildRollLabelLocalPricePreview} from './roll-label-local-price-ledgers';
import {buildRollLabelPricePreview} from './roll-label-price-preview';
import {buildRollLabelSystemProduct} from './roll-label-system-product';
import {rollLabelPriceSelectionKey} from '../src/lib/products/rollLabelPricePreview';

const familyId = process.argv[process.argv.indexOf('--family')+1];
if (!/^[0-9]+$/.test(familyId||'')) throw Error('An exact family is required');
const root = process.cwd(), output = 'output/qa/roll-labels-2026-10-07/quantity-integration-025';
const sha = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');
const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/'+familyId+'.json','utf8'));
const jobs = fs.readFileSync(output+'/quote-jobs.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line)).filter(job=>job.familyId===familyId);
const captures = new Map();
for (const article of fs.readdirSync(output+'/capture')) {
  const directory=output+'/capture/'+article+'/quotes';
  if (!fs.existsSync(directory)) continue;
  for (const file of fs.readdirSync(directory).filter(file=>file.endsWith('.json'))) {
    const record=JSON.parse(fs.readFileSync(directory+'/'+file,'utf8'));
    if (record.job.familyId===familyId) captures.set(rollLabelPriceSelectionKey(record.job.selection),record);
  }
}
const ledgerPath=output+'/sealed-family-'+familyId+'/proposed-price-delta.jsonl';
const activeLedgers=await readRollLabelLocalPriceLedgers(root);
// Resealing an already reviewed family compares against the same pre-delta
// inputs, then requires byte-identical output; it never reapplies old rows.
const ledgers={...activeLedgers,additions:activeLedgers.additions.filter(item=>item.path!==ledgerPath)};
const original=buildRollLabelLocalPricePreview(family,ledgers,'wmd_roll_labels_threshold_fx_7_6');
const signatures=new Set([...ledgers.baseRows,...ledgers.additions.flatMap(item=>item.rows)].map(row=>row.extraData.signature));
const rows=[],missing=[],quarantined=[],evidenceHashes=[];
for (const job of jobs) {
  const record=captures.get(rollLabelPriceSelectionKey(job.selection));
  if (!record) {missing.push(job.selection);continue;}
  assert.deepEqual(record.job,job);
  if (record.status!=='passed') {quarantined.push({selection:job.selection,error:record.error});continue;}
  assert.ok(Object.values(record.checks).every(value=>value===true));
  const evidence=record.evidence,request=evidence.request,quote=evidence.response.data.response;
  assert.equal(evidence.response.code,200);
  const bytes=fs.readFileSync(path.join(root,evidence.rawPath));
  assert.equal(sha(bytes),evidence.response_sha256);
  const pagePath=record.sourcePagePath||output+'/capture/'+job.request.articleId+'/page.html.gz';
  assert.equal(sha(gunzipSync(fs.readFileSync(pagePath))),record.sourcePageSha256);
  assert.deepEqual(request,job.request);
  assert.equal(Number(quote.quantity),job.selection.quantity);
  assert.equal(quote.currency,'EUR');assert.ok(Number(quote.price)>0);
  for (const dimension of ['width','height']) if (dimension in request)
    assert.equal(Number(quote.dimension?.[dimension]),Number(request[dimension]));
  for (const [field,selected] of Object.entries(request.additionalUpsells) as [string,{value:string}][])
    assert.ok(quote.additionalUpsells?.[field]?.some((value:{value:string})=>value.value===selected.value));
  const profile=family.profiles.find((item:{key:string})=>item.key===job.profileKey);
  assert.ok(profile);
  const converted=applyConversionRule(quote.price,original.ruleKey);
  const signature=rollLabelHash({selections:job.selections,quantity:Number(quote.quantity)});
  assert.ok(!signatures.has(signature));signatures.add(signature);
  rows.push(createNormalizedMatrixRecord({supplier:'wir-machen-druck',sourceType:'saved_exact_supplier_quote',
    sourceUrl:job.sourceUrl,sourceKey:job.profileKey,importerKey:'roll-label-quantity-continuation-025',productFamily:'labels',
    supplierCurrency:'EUR',supplierPrice:Number(quote.price),convertedPriceDkk:converted.convertedPriceDkk,
    finalPriceDkk:converted.finalPriceDkk,conversionRuleKey:converted.ruleKey,quantity:Number(quote.quantity),
    dimensions:{widthMm:job.selection.widthMm,heightMm:job.selection.heightMm},selections:job.selections,
    extractedAt:evidence.captured_at,sourceIdentifiers:{articleId:profile.articleId,materialId:profile.sourceMaterialId,profileKey:profile.key},
    extraData:{familyId,formatValueId:profile.formatValueId,materialValueId:profile.materialValueId,
      responseSha256:evidence.response_sha256,sourceEvidencePath:evidence.rawPath,commercialApproval:false,
      DenmarkDeliveryVerified:false,livePrice:false,signature},rawPayload:{sourceRequest:request}}));
  evidenceHashes.push({path:evidence.rawPath,sha256:evidence.response_sha256});
}
const delta=buildRollLabelPricePreview(family,rows,original.ruleKey);
assert.equal(delta.excludedRows,0);assert.equal(delta.points.length,rows.length);
const proposed=buildRollLabelLocalPricePreview(family,{...ledgers,additions:[...ledgers.additions,
  {familyId,profileKey:'reviewed-family-delta',rows}]},original.ruleKey);
for (const point of original.points) assert.deepEqual(proposed.points.find(item=>item.id===point.id),point);
const catalogue=JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/native-catalogue.json','utf8'));
const entry=catalogue.families.find((item:{familyId:string})=>item.familyId===familyId);
assert.ok(entry?.slug);
const draft=buildRollLabelSystemProduct(family,proposed,entry.slug);
assert.equal(draft.genericPriceRows.length,proposed.points.length);
const directory=output+'/sealed-family-'+familyId;
const bytes=Buffer.from(rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
const manifest={familyId,path:ledgerPath,sha256:sha(bytes),rows:rows.length,
  profileKeys:[...new Set(rows.map(row=>row.sourceKey))].sort(),plannedQuotes:jobs.length,missing:missing.length,
  quarantined:quarantined.length,oldPointsPreserved:original.points.length,mergedPoints:proposed.points.length,
  normalizedThroughNativePublisher:true,remoteWrites:false,commercialApproved:false,orderReady:false,
  fullCatalogueComplete:false,evidenceHashes};
if (process.argv.includes('--write')) {
  assert.equal(missing.length,0,'Complete the planned family capture before sealing');
  assert.equal(quarantined.length,0,'Quarantined supplier responses need review');
  if (fs.existsSync(ledgerPath)) assert.deepEqual(fs.readFileSync(ledgerPath),bytes,'Sealed family delta is immutable');
  else {fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(ledgerPath,bytes);}
  const manifestPath=directory+'/manifest.json',manifestBytes=JSON.stringify(manifest,null,2)+'\n';
  if (fs.existsSync(manifestPath)) assert.equal(fs.readFileSync(manifestPath,'utf8'),manifestBytes);
  else fs.writeFileSync(manifestPath,manifestBytes);
}
console.log(JSON.stringify({...manifest,evidenceHashes:manifest.evidenceHashes.length}));
