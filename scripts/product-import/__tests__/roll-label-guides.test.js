import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildRollLabelNativeGuide,rollLabelSvgPath} from '../shared/roll-label-guides.js';
const root=new URL('../../../docs/roll-labels-2026-09-30/',import.meta.url);
const json=name=>JSON.parse(fs.readFileSync(new URL(name,root)));
const candidates=[...json('designer-preparation/standard-template-candidates.json'),...json('acceptance/booklet/candidates.json'),...json('designer-preparation/wet-glue/candidates.json')];
const guides=[...json('designer-preparation/standard-guides.da.json'),...json('acceptance/booklet/guides.da.json'),...json('designer-preparation/wet-glue/guides.da.json')];
const profiles=fs.readFileSync(new URL('../../../output/supplier-imports/roll-labels-catalogue-2026-10-06/normalized/article-material-profiles.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);

test('native guides retain each exact eligible shape, booklet side order and template hash',()=>{
 let count=0;
 for(const profile of profiles){
  const candidate=candidates.find(c=>String(c.article_id)===profile.articleId);
  const result=buildRollLabelNativeGuide(profile,candidate,guides.find(g=>g.articleId===profile.articleId));
  if(!result)continue;
  count++;assert.equal(result.vectorGuide.articleId,profile.articleId);assert.equal(result.vectorGuide.templateSha256,candidate.sha256);
  assert.equal(result.template,null);assert.ok(result.instructionsDa.length);assert.ok(!JSON.stringify(result).includes('wir-machen-druck'));
  if(candidate.pages){assert.equal(result.vectorGuide.pages.length,2);
   candidate.pages.forEach((p,i)=>assert.deepEqual(result.vectorGuide.pages[i].labels.map(l=>Number(l.text)),p.side_order_left_to_right));
  } else {assert.equal(result.finishedWidthMm,profile.format.dimensions.widthMm);
   assert.deepEqual(result.vectorGuide.pages[0].paths.map(p=>p.d),Object.values(candidate.source_paths).map(rollLabelSvgPath));}
 }
 assert.equal(count,603);
 for(const id of ['55049','55069','63065']){
  const profile=profiles.find(p=>p.articleId===id);
  assert.equal(buildRollLabelNativeGuide(profile,candidates.find(c=>String(c.article_id)===id),guides.find(g=>g.articleId===id)),null);
 }
});

test('wet-glue guides use exact source corners or circles, 2 mm offsets and no generic closed cut rectangle',()=>{
 const wet=profiles.filter(p=>p.familyId==='23954');let count=0;
 for(const profile of wet){
  const candidate=candidates.find(c=>String(c.article_id)===profile.articleId);
  const guide=buildRollLabelNativeGuide(profile,candidate,guides.find(g=>g.articleId===profile.articleId));
  if(!guide)continue;count++;
  assert.equal(guide.bleedMm,2);assert.equal(guide.safeAreaMm,2);
  assert.equal(guide.dataWidthMm,profile.format.dimensions.widthMm+4);
  const cut=guide.vectorGuide.pages[0].paths.find(p=>p.role==='cut').d;
  assert.ok(!cut.includes('Z'));
  if(candidate.source_geometry_style==='source_crop_corners'){
   assert.equal((cut.match(/M /g)||[]).length,4);assert.ok(!cut.includes('C '));
  }else assert.ok(cut.includes('C '));
 }
 assert.equal(count,160);
 assert.ok(wet.filter(p=>p.articleId==='44339').every(p=>p.blockers.includes('wet_glue_geometry_quarantined')));
});

test('vector conversion preserves discontinuities and quad winding; rejects foreign geometry',()=>{
 assert.equal(rollLabelSvgPath([['l',[1,2],[3,4]],['l',[9,8],[7,6]]]),'M 1 2 L 3 4 M 9 8 L 7 6');
 assert.equal(rollLabelSvgPath([['qu',[[0,0],[5,0],[0,6],[5,6]]]]),'M 0 0 L 5 0 L 5 6 L 0 6 Z');
 assert.throws(()=>rollLabelSvgPath([['l',[NaN,0],[1,2]]]));
 const profile=profiles.find(p=>p.articleId==='55058');
 const candidate=candidates.find(c=>String(c.article_id)==='55062');
 assert.throws(()=>buildRollLabelNativeGuide(profile,candidate,guides.find(g=>g.articleId==='55058')),/Foreign/);
 assert.throws(()=>buildRollLabelNativeGuide({...profile,format:{...profile.format,dimensions:{widthMm:40,heightMm:40}}},
  candidates.find(c=>String(c.article_id)==='55058'),guides.find(g=>g.articleId==='55058')),/dimensions/);
});
