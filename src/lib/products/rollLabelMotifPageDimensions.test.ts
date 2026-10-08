import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {readRollLabelMotifPageDimensions} from './rollLabelMotifPageDimensions';
import {bindRollLabelMotifPdf,reviewRollLabelMotifPdf,rollLabelMotifPdfConfigurationKey} from './rollLabelMotifPdf';
import {rollLabelInitialDraft,validateRollLabelConfiguration} from './rollLabelConfiguration';
import {rollLabelGeneratedDesignerAllowed} from '../designer/rollLabelGeneratedTemplate';
import {readRollLabelSizeGeometry,rollLabelSizeGuide} from './rollLabelSizeGeometry';
import type {RollLabelReviewFamily,RollLabelReviewProfile} from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families';
const families:RollLabelReviewFamily[]=fs.readdirSync(base).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${base}/${f}`,'utf8')));
const profiles=families.flatMap(f=>f.profiles).filter(p=>p.motifDelivery?.pageDimensions);
const output='output/qa/roll-labels-2026-10-06/root-motif-page-dimensions-049/runtime';
function selection(p:RollLabelReviewProfile,w:number,h:number,stateId=p.optionStates!.initialStateId!){
 const f=families.find(f=>f.profiles.some(q=>q.key===p.key))!;
 const draft={...rollLabelInitialDraft(p),dimensions:{width:String(w),height:String(h)},quantity:'1000',optionStateId:stateId,
  allocations:Array.from({length:p.format.motifCount},(_,i)=>String(i===p.format.motifCount-1?1000-100*(p.format.motifCount-1):100))};
 const s=validateRollLabelConfiguration(p,draft,{productId:f.productId,familyId:f.familyId}).selection;assert.ok(s,p.key);return s!;
}
test('all273 source envelopes cover page dimensions only; every current state denies one-page Designer',()=>{
 assert.equal(profiles.length,273);let states=0;
 for(const p of profiles){assert.ok(readRollLabelMotifPageDimensions(p));assert.equal(readRollLabelSizeGeometry(p),null);
  assert.equal(rollLabelSizeGuide(p,50,50),null);
  for(const state of p.optionStates!.states){assert.equal(rollLabelGeneratedDesignerAllowed(p,state.id),false);states++;}
 }
 assert.ok(states>273);
});
test('every profile/state accepts actual PDF dimensions, refuses width/height changes and old acknowledgements',async()=>{
 fs.mkdirSync(output,{recursive:true});const pdfs=new Map<string,{sha256:string;pages:Array<{pageNumber:number;widthMm:number;heightMm:number;rotation:number}>}>();
 const cases:unknown[]=[];
 async function inspection(n:number,w:number,h:number,dx=0,dy=0){
  const key=`${n}-${w}-${h}-${dx}-${dy}`;if(pdfs.has(key))return pdfs.get(key)!;
  const doc=await PDFDocument.create();doc.setCreationDate(new Date('2026-10-06T00:00:00Z'));doc.setModificationDate(new Date('2026-10-06T00:00:00Z'));
  for(let i=0;i<n;i++)doc.addPage([(w+6+dx)*72/25.4,(h+6+dy)*72/25.4]);
  const bytes=await doc.save(),read=await PDFDocument.load(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
  const value={sha256,pages:read.getPages().map((p,i)=>({pageNumber:i+1,widthMm:p.getWidth()*25.4/72,heightMm:p.getHeight()*25.4/72,rotation:p.getRotation().angle}))};
  fs.writeFileSync(`${output}/${key}.pdf`,bytes);pdfs.set(key,value);return value;
 }
 for(const p of profiles)for(const state of p.optionStates!.states)for(const [w,h] of [[10,10],[300,300],[37.125,61.25]]){
  const s=selection(p,w,h,state.id),correct=await inspection(p.format.motifCount,w,h);
  const binding=bindRollLabelMotifPdf(p,s,correct);assert.ok(binding.valid,p.key);if(!binding.valid)throw Error(p.key);
  assert.equal(binding.sizeChecked,true);assert.equal(binding.cutShapeChecked,false);
  assert.equal(binding.productionAccepted||binding.designerAllowed||binding.orderReady,false);
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]])assert.equal(bindRollLabelMotifPdf(p,s,await inspection(p.format.motifCount,w,h,dx,dy)).valid,false);
  const old=structuredClone(p);delete old.motifDelivery!.pageDimensions;
  const oldKey=rollLabelMotifPdfConfigurationKey(old,s);assert.notEqual(binding.configurationKey,oldKey);
  const review={configurationKey:oldKey,sourceEvidenceSha256:binding.sourceEvidenceSha256,pdfSha256:binding.pdfSha256,pageNumbers:binding.pages.map(p=>p.pageNumber)};
  assert.equal(reviewRollLabelMotifPdf(binding,review),null);
  assert.ok(reviewRollLabelMotifPdf(binding,{...review,configurationKey:binding.configurationKey}));
  cases.push({profileKey:p.key,stateId:state.id,widthMm:w,heightMm:h,correctPdfSha256:correct.sha256,wrongWidthsAndHeightsRefused:true,oldReviewRefused:true});
 }
 fs.writeFileSync(`${output}/receipt.json`,JSON.stringify({profiles:profiles.length,cases,pdfs:[...pdfs].map(([key,value])=>({path:`${output}/${key}.pdf`,...value})),
  cutShapeAccepted:false,designerAllowed:false,orderReady:false},null,2)+'\n');
});
test('present but stale/foreign page contracts refuse rather than downgrade to structure-only',()=>{
 const p=profiles[0],s=selection(p,50,50),inspection={sha256:'1'.repeat(64),pages:Array.from({length:p.format.motifCount},(_,i)=>({pageNumber:i+1,widthMm:56,heightMm:56,rotation:0}))};
 for(const edit of [(p:RollLabelReviewProfile)=>p.motifDelivery!.pageDimensions!.bleedMm=2 as 3,
  (p:RollLabelReviewProfile)=>p.motifDelivery!.pageDimensions!.profileKey='foreign',
  (p:RollLabelReviewProfile)=>p.motifDelivery!.pageDimensions!.sizeContract.axes[0].maxMm++,
  (p:RollLabelReviewProfile)=>p.motifDelivery!.pageDimensions!.cutShapeAccepted=true as false,
  (p:RollLabelReviewProfile)=>p.motifDelivery!.pageDimensions!.evidence[0].role='template']){
  const copy=structuredClone(p);edit(copy);assert.equal(readRollLabelMotifPageDimensions(copy),null);assert.equal(bindRollLabelMotifPdf(copy,s,inspection).valid,false);
 }
});
