import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {applyConversionRule} from '../shared/conversion.js';
const root=new URL('../../../output/supplier-imports/roll-labels-catalogue-2026-10-06/import-review/',import.meta.url);
const json=name=>JSON.parse(fs.readFileSync(new URL(name,root)));
const rows=name=>fs.readFileSync(new URL(name,root),'utf8').trim().split('\n').map(JSON.parse);
const summary=json('review-summary.json');
const prices=rows('proposed-exact-prices.jsonl');
const documents=rows('document-bindings.jsonl');

test('price review contains exact totals once and excludes all invalid machine allocations',()=>{
 const signatures=new Set();
 for(const record of prices){
  assert.equal(record.finalPriceDkk,applyConversionRule(record.supplierPrice,record.conversionRuleKey).finalPriceDkk);
  assert.equal(record.extraData.commercialApproval,false);
  assert.equal(record.extraData.livePrice,false);
  assert.ok(!signatures.has(record.extraData.signature));signatures.add(record.extraData.signature);
  const request=record.rawPayload.sourceRequest;
  assert.equal(record.quantity,Number(request.quantity));
  const allocations=Object.values(request.enhancedSize||{}).flatMap(group=>Object.values(group)).map(Number);
  if(allocations.length){assert.ok(allocations.every(q=>Number.isInteger(q)&&q>0));assert.equal(allocations.reduce((a,b)=>a+b,0),record.quantity);}
 }
 assert.equal(prices.length,7789);
 assert.equal(rows('quote-quarantine.jsonl').length,106);
 assert.equal(summary.counts.machineValidatedQuotes,2160);
 const exact=prices.find(p=>p.sourceKey==='54008:1003759'&&p.quantity===1000);
 assert.equal(exact.supplierPrice,34.70);assert.equal(exact.extraData.sourceSetupAndServices.option08_jn,14.90);
});

test('all profiles keep document status and quarantines rather than falling back to a first PDF',()=>{
 assert.equal(documents.length,2551);assert.equal(new Set(documents.map(d=>d.profileKey)).size,2551);
 assert.equal(documents.filter(d=>d.candidate).length,603);
 for(const document of documents){
  assert.equal(document.designerTemplateId,null);assert.equal(document.onlineDesignerAllowed,false);
  if(document.blockers.length)assert.equal(document.candidate,null);
  if(document.candidate){const file=new URL(document.candidate.path,root);assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),document.candidate.sha256);}
 }
 for(const id of ['55049','55069','63065'])assert.ok(documents.filter(d=>d.articleId===id).every(d=>d.status==='profile_quarantined'));
});

test('all 42 product plans preserve the old Rullelabels and every independent approval boundary',()=>{
 const plans=json('product-draft-plans.json').families;assert.equal(plans.length,42);
 assert.equal(plans.flatMap(p=>p.sourceProfileKeys).length,2551);
 for(const plan of plans){assert.equal(plan.tenantId,null);for(const key of ['writeBank','writeProduct','writeLivePricing','publishProduct'])assert.equal(plan[key],false);}
 assert.equal(plans.find(p=>p.familyId==='20649').existingProductToPreserve.id,'f4d530bd-d80a-4cd7-8745-8e5431a18fe4');
 assert.equal(summary.canonicalImportManifestValidated,false);assert.equal(summary.databaseWrites,false);
});
