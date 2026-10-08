import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRollLabelSavedContext, readSavedRollLabelContext, type RollLabelSavedContext } from './rollLabelSavedContext.ts';
import { encodeDesignerSnapshot, decodeDesignerSnapshot } from './saveDesign.ts';
import { validateRollLabelConfiguration } from '../products/rollLabelConfiguration.ts';
import type { RollLabelReviewFamily } from '../products/rollLabelReview';
const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/29554.json','utf8')) as RollLabelReviewFamily;
const profile = family.profiles.find(p=>p.key==='55062:1007033')!;
const contract = {version:1 as const,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false as const};
const document = {productId:family.productId,tenantId:'00000000-0000-0000-0000-000000000000',widthMm:50,heightMm:50,bleedMm:3,safeMm:3};
const selection = validateRollLabelConfiguration(profile,{dimensions:{},quantity:'1000',allocations:[],optionStateId:profile.optionStates!.initialStateId!},{productId:family.productId,familyId:family.familyId}).selection!;
const template = {url:'https://files.example.test/exact.pdf',sha256:profile.nativeGuide!.vectorGuide!.templateSha256,name:'Rund 50 mm',widthMm:50,heightMm:50,bleedMm:3,safeMm:3,pageCount:1 as const};
const context = ()=>buildRollLabelSavedContext(selection,template,document,contract)!;

test('exact saved roll selection and hash survive real JSON transport independently of checkout',()=>{
 const saved=context();assert.ok(saved);
 const snapshot=decodeDesignerSnapshot(JSON.parse(JSON.stringify(encodeDesignerSnapshot({objects:[{type:'rect',data:{artwork:true}}],rollLabelContext:saved}))));
 assert.deepEqual(readSavedRollLabelContext(snapshot,document,contract),saved);
 assert.deepEqual(saved.selection,selection);assert.equal('price' in saved,false);assert.equal('orderReady' in saved,false);
 const untrusted={rollLabelContext:{...saved,orderReady:true,price:123}};const clean=readSavedRollLabelContext(untrusted,document,contract)!;assert.equal('orderReady' in clean,false);assert.equal('price' in clean,false);
});

test('saved roll context rejects foreign product/shop/family/material/state/options and stale template bindings',()=>{
 const changes:Array<(c:RollLabelSavedContext)=>void>=[c=>c.tenantId='other',c=>c.selection.productId='other',c=>c.selection.familyId='other',c=>c.selection.materialId='other',c=>c.selection.articleId='other',c=>c.selection.profileKey='other',c=>c.selection.optionStateId='other',c=>c.selection.sourceOptions={fake:'1'},c=>c.selection.widthMm=51,c=>c.selection.quantity=0,c=>c.selection.motifAllocations=[999],c=>c.template.sha256='0'.repeat(64),c=>c.template.widthMm=51,c=>c.template.bleedMm=2,c=>c.template.safeMm=2,c=>c.sectionSelections={foreign:'value'}];
 for(const change of changes){const c=structuredClone(context());change(c);assert.equal(readSavedRollLabelContext({rollLabelContext:c},document,contract),null);}
 assert.equal(readSavedRollLabelContext({rollLabelContext:context()},{...document,heightMm:51},contract),null);
 const duplicate=structuredClone(contract);duplicate.profiles.push(structuredClone(profile));assert.equal(readSavedRollLabelContext({rollLabelContext:context()},document,duplicate),null);
 const stale=structuredClone(contract);stale.profiles.find(p=>p.key===profile.key)!.blockers=['geometry_conflict'];assert.equal(readSavedRollLabelContext({rollLabelContext:context()},document,stale),null);
});

test('malformed and unsupported saved contexts cannot trigger template fetches',()=>{
 const c=context();
 for(const bad of [null,[],{}, {...c,selection:null},{...c,selection:{...c.selection,motifAllocations:'bad'}},{...c,template:{...c.template,pageCount:2}},...['javascript:alert(1)','https://user:pass@example.test/x','https://files.test/x#secret','http://remote.test/x','//bad.test/\\x'].map(url=>({...c,template:{...c.template,url}}))])
  assert.equal(readSavedRollLabelContext({rollLabelContext:bad},document,contract),null);
 assert.equal(readSavedRollLabelContext({objects:[]},document,contract),null);
});

test('metadata construction uses the selected profile and never adopts another shape or non-artwork product',()=>{
 assert.equal(buildRollLabelSavedContext({...selection,profileKey:'55058:1006949'},template,document,contract),null);
 const noArtwork=structuredClone(contract);noArtwork.profiles.find(p=>p.key===profile.key)!.customerArtworkRequired=false;
 assert.equal(buildRollLabelSavedContext(selection,template,document,noArtwork),null);
 const c=context();c.selection.sourceOptions.fake='value';assert.equal('fake' in selection.sourceOptions,false);
});

test('one-page saved template cannot carry a valid multiple-motif selection or its local PDF review',()=>{
  const multiple=structuredClone(profile);multiple.format.motifCount=2;
  const multipleContract={...contract,profiles:[multiple]};
  const multipleSelection=validateRollLabelConfiguration(multiple,{dimensions:{},quantity:'1000',allocations:['400','600'],
    optionStateId:multiple.optionStates!.initialStateId!},{productId:family.productId,familyId:family.familyId}).selection!;
  assert.ok(multipleSelection,'Synthetic profile still has a valid full positive allocation');
  assert.equal(buildRollLabelSavedContext(multipleSelection,template,document,multipleContract),null);
  const borrowed={...context(),selection:multipleSelection,motifPdfReview:{reviewedByUser:true,pdfSha256:'1'.repeat(64),pageNumbers:[1,2]}};
  assert.equal(readSavedRollLabelContext({rollLabelContext:borrowed},document,multipleContract),null);
  assert.ok(context(),'Single motif saved Designer remains supported');
});
