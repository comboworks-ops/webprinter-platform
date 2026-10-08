import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rollLabelSvgPath} from '../shared/roll-label-guides.js';
const root=new URL('../../../',import.meta.url);
const json=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const review=json('output/qa/roll-labels-2026-10-06/wet-glue-review-only-007.json');
const source=json('docs/roll-labels-2026-09-30/designer-preparation/wet-glue/candidates.json');

test('isolated wet-glue review binds all 160 exact material guides and excludes every conflicting article',()=>{
 assert.equal(review.familyId,'23954');assert.equal(review.profiles.length,280);
 assert.equal(review.profiles.filter(p=>p.nativeGuide).length,160);
 const quarantined=review.profiles.filter(p=>p.blockers.includes('wet_glue_geometry_quarantined'));
 assert.equal(quarantined.length,110);
 for(const p of quarantined){
  assert.equal(p.nativeGuide,null);
  assert.ok(!review.exactSelections.some(s=>s[review.sections.format]===p.formatValueId));
 }
 for(const p of review.profiles.filter(p=>p.nativeGuide)){
  const c=source.find(c=>c.article_id===p.articleId);
  assert.equal(p.nativeGuide.bleedMm,2);assert.equal(p.nativeGuide.safeAreaMm,2);
  assert.equal(p.nativeGuide.vectorGuide.templateSha256,c.sha256);
  assert.deepEqual(p.nativeGuide.vectorGuide.pages[0].paths.map(p=>p.d),Object.values(c.source_paths).map(rollLabelSvgPath));
  assert.ok(c.bindings.some(b=>b.profileKey===p.key));
 }
});

test('related wet-glue product preserves its separate use, foil rules and draft order gate',()=>{
 assert.equal(review.orderReady,false);
 const plain=review.profiles.find(p=>p.articleId==='44315');
 const foil=review.profiles.find(p=>p.articleId==='44342');
 assert.ok(plain.nativeGuide.instructionsDa.some(t=>t.includes('særskilt påføring med vådlim')));
 assert.equal(foil.artworkInstructions.onlineDesignerVerified,false);
 assert.ok(foil.artworkInstructions.requirements.some(r=>r.kind==='hot_foil'&&r.documented));
 assert.ok(!plain.artworkInstructions.requirements.some(r=>r.kind==='hot_foil'));
 assert.deepEqual(review.articles.find(a=>a.articleId==='44339').format.dimensions,{widthMm:168,heightMm:64});
});
