import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleFormat, buildRollLabelCatalogue, rollLabelPlannedId, rollLabelDanishLabel } from '../shared/roll-label-catalogue.js';
import { buildRollLabelProductReview, buildRollLabelReviewIndex } from '../shared/roll-label-product-review.js';
import { buildRollLabelSizeContract } from '../shared/roll-label-size-contract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = path.join(root,'docs/roll-labels-2026-09-30');
const catalogue = JSON.parse(fs.readFileSync(path.join(source,'catalogue.normalized.json')));
const bookletCandidates = JSON.parse(fs.readFileSync(path.join(source,'acceptance/booklet/candidates.json')));
const standardCandidates = JSON.parse(fs.readFileSync(path.join(source,'designer-preparation/standard-template-candidates.json')));
const wetGlueGeometry = JSON.parse(fs.readFileSync(path.join(source,'designer-preparation/wet-glue/geometry-audit.json')));
const materials = new Map(catalogue.articles.map(article => {
  const dir = path.join(source,'extraction/articles',article.supplier_article_id);
  return [article.supplier_article_id,fs.existsSync(dir) ? fs.readdirSync(dir).filter(name=>/^\d+\.json$/.test(name))
    .map(name=>JSON.parse(fs.readFileSync(path.join(dir,name)))) : []];
}));
const loadMaterials = id => materials.get(id);
const plan = buildRollLabelCatalogue({catalogue,loadMaterials,bookletCandidates,standardCandidates,wetGlueGeometry,sourceSha256:'test'});
const reviews = plan.families.map(family => buildRollLabelProductReview({ ...family,
  profiles: plan.profiles.filter(profile => profile.familyId === family.sourceFamilyId) }));

test('repeated centimetre units resolve every fixed wet-glue title without substituting notched ovals',()=>{
  for(const article of catalogue.articles.filter(a=>a.family_ids.includes('23954')&&!a.quantity_and_dimensions_inputs.some(i=>i.name==='grossdruck_width'))){
    assert.ok(articleFormat(article).dimensions,article.supplier_article_id);
  }
  assert.deepEqual(plan.profiles.find(p=>p.articleId==='44327').format.dimensions,{widthMm:35,heightMm:35});
  assert.deepEqual(plan.profiles.find(p=>p.articleId==='44332').format.dimensions,{widthMm:46,heightMm:28});
  assert.equal(plan.profiles.find(p=>p.articleId==='44336').format.shape,'source_specific');
  assert.equal(articleFormat({title_de:'Etikett rund (35 mm x 35 cm)',quantity_and_dimensions_inputs:[]}).dimensions,null);
});

test('all conflicting wet-glue source curves stay unselectable for every exact material',()=>{
  const review=reviews.find(f=>f.familyId==='23954');
  const quarantines=plan.profiles.filter(p=>p.blockers.includes('wet_glue_geometry_quarantined'));
  assert.equal(quarantines.length,110);
  assert.equal(new Set(quarantines.map(p=>p.articleId)).size,22);
  for(const profile of quarantines)assert.ok(!review.exactSelections.some(s=>s[review.sections.format]===profile.formatValueId));
  assert.ok(quarantines.some(p=>p.articleId==='44339'));
  assert.deepEqual(plan.profiles.find(p=>p.articleId==='44328').blockers,[]);
});

test('all machine motif counts agree with exact source allocation fields, including comma titles', () => {
  const machine = plan.profiles.filter(p => p.optionFields.some(f => f.labelOriginal === 'Motivanzahl'));
  assert.equal(new Set(machine.map(p => p.articleId)).size, 96);
  for (const profile of machine) {
    assert.equal(profile.format.motifCount, profile.optionFields.find(f => f.labelOriginal === 'Motivanzahl').values.length, profile.key);
  }
  assert.equal(machine.find(p => p.articleId === '60465').format.motifCount, 6);
});

test('all custom-size contracts use evidenced units and exact axes without shared maxima', () => {
  const audit = JSON.parse(fs.readFileSync(path.join(root,'output/supplier-imports/roll-labels-catalogue-2026-10-06/source-size-limit-audit.json')));
  const byKey = new Map(audit.profiles.map(p => [p.profileKey,p]));
  let count = 0;
  for (const profile of plan.profiles) {
    const row = byKey.get(profile.key);
    const contract = buildRollLabelSizeContract(profile,row);
    if (!profile.format.customSize) { assert.equal(contract,null); continue; }
    count++;
    assert.equal(contract.sourceUnit,'cm');
    assert.deepEqual(contract.axes.map(a => a.sourceInputName), row.sourceSizeInputNames);
    for (const axis of contract.axes) {
      assert.equal(axis.minMm, Number(row.rawLimits[`grossdruck_${axis.axis}_min`])*10);
      assert.equal(axis.maxMm, Number(row.rawLimits[`grossdruck_${axis.axis}_max`])*10);
    }
    if (profile.format.shape === 'circle') assert.equal(contract.axes.length,1);
  }
  assert.equal(count,1677);
  const standard = plan.profiles.find(p=>p.articleId==='54008');
  const machine = plan.profiles.find(p=>p.articleId==='60420');
  assert.equal(buildRollLabelSizeContract(standard,byKey.get(standard.key)).axes[0].maxMm,200);
  assert.equal(buildRollLabelSizeContract(machine,byKey.get(machine.key)).axes[0].maxMm,300);
  assert.throws(()=>buildRollLabelSizeContract(standard,{...byKey.get(standard.key),sourceUnit:null}),/Missing verified/);
  assert.throws(()=>buildRollLabelSizeContract(standard,byKey.get(machine.key)),/Missing verified/);
});

test('both known standard geometry quarantines block all 42 exact material profiles', () => {
  const fixed = reviews.find(r => r.familyId === '29554');
  for (const articleId of ['55049','55069']) {
    const profiles = fixed.profiles.filter(p => p.articleId === articleId);
    assert.equal(profiles.length, 21);
    assert.ok(profiles.every(p => p.blockers.includes('standard_geometry_quarantined')));
    assert.ok(!fixed.exactSelections.some(s => s[fixed.sections.format] === profiles[0].formatValueId));
  }
  assert.deepEqual(plan.profiles.find(p => p.articleId === '55049').format.dimensions, { widthMm: 105, heightMm: 148 });
  assert.equal(plan.profiles.find(p => p.articleId === '55049').format.shape, 'rectangle');
  const inkjet = reviews.find(r => r.familyId === '28276');
  assert.deepEqual(inkjet.articles[0].format.dimensions, { widthMm: 102, heightMm: 152 });
  assert.ok(reviews.find(r => r.familyId === '25143').articles.some(a => a.name.startsWith('Hjerte')));
});

test('shared product review resolves only exact, unblocked article/material pairs in every family', () => {
  assert.equal(reviews.length, 42);
  assert.equal(reviews.flatMap(f => f.articles).length, 472);
  for (const review of reviews) {
    for (const selected of review.exactSelections) {
      const matching = review.profiles.filter(profile => profile.formatValueId === selected[review.sections.format]
        && profile.materialValueId === selected[review.sections.material]);
      assert.equal(matching.length, 1);
      assert.deepEqual(matching[0].blockers, []);
      for (const group of review.sourceGroups) {
        const section = group.kind === 'format' ? review.sections.format : review.sections.material;
        assert.ok(group.values.some(v => v.id === selected[section]));
      }
    }
    assert.equal(review.exactSelections.length, review.profiles.filter(p => p.blockers.length === 0).length);
  }
});

test('format labels distinguish print, finish, blank substrate and ready-printed German artwork', () => {
  for (const review of reviews) {
    const names = review.sourceGroups[0].values.map(value => value.name);
    assert.equal(new Set(names).size,names.length,review.familyId);
  }
  const variable=reviews.find(r=>r.familyId==='30968');
  assert.ok(variable.articles.some(a=>a.name.endsWith('1/0-tryk')));
  assert.ok(variable.articles.some(a=>a.name.endsWith('4/0-tryk')));
  assert.ok(reviews.find(r=>r.familyId==='30969').articles.some(a=>a.name.endsWith('Uden tryk')));
  assert.ok(reviews.find(r=>r.familyId==='27140').articles.every(a=>a.name.includes('Tysk motiv:')));
});

test('unavailable articles, quarantined booklets and missing templates remain visible but unselectable', () => {
  for (const review of reviews) {
    for (const article of review.articles.filter(a => a.blockers.length > 0)) {
      const original = plan.families.flatMap(f => f.articles).find(a => a.articleId === article.articleId);
      assert.ok(original);
      const blockedProfiles = review.profiles.filter(p => p.articleId === article.articleId && p.blockers.length > 0);
      for (const profile of blockedProfiles) assert.ok(!review.exactSelections.some(s =>
        s[review.sections.format] === profile.formatValueId && s[review.sections.material] === profile.materialValueId));
    }
  }
  assert.deepEqual(reviews.flatMap(f => f.articles).filter(a => a.blockers.includes('source_article_unavailable')).map(a => a.articleId), ['63078','63079']);
});

test('review payload excludes supplier prices, raw quote requests and unsanitized document downloads', () => {
  const payload = JSON.stringify({ index: buildRollLabelReviewIndex(plan), families: reviews });
  for (const forbidden of ['supplierNetTotal','supplierPrice','sourceRequest','sourceEvidencePath','responseSha256','sourceUrl','canonical_document_bindings','https://www.wir-machen-druck.de']) {
    assert.ok(!payload.includes(forbidden), forbidden);
  }
  assert.ok(reviews.every(r => r.retailPricesIncluded === false && r.orderReady === false));
});

test('captured options and quantities reset to the exact material profile rather than a family union', () => {
  for (const review of reviews) for (const profile of review.profiles) {
    const original = plan.profiles.find(p => p.key === profile.key);
    assert.deepEqual(profile.sourceQuantities, original.sourceQuantities.map(q => q.quantity));
    assert.equal(profile.optionDependencyStatus, 'captured_material_and_default_options_only');
    for (const field of profile.optionFields) for (const value of field.values) {
      assert.equal(value.selected, String(original.defaultSourceOptions?.[field.sourceFieldId]?.id) === value.sourceValueId);
      assert.ok(original.optionFields.find(f => f.sourceFieldId === field.sourceFieldId).values.some(v => v.sourceValueId === value.sourceValueId));
    }
  }
});

test('foreign or ambiguous profiles are rejected before a product review is generated', () => {
  const family = { ...plan.families[0], profiles: plan.profiles.filter(p => p.familyId === plan.families[0].sourceFamilyId) };
  assert.throws(() => buildRollLabelProductReview({ ...family, profiles: [...family.profiles, plan.profiles.find(p => p.familyId !== family.sourceFamilyId)] }), /Foreign family/);
  assert.throws(() => buildRollLabelProductReview({ ...family, profiles: [...family.profiles, family.profiles[0]] }), /Ambiguous/);
});

test('all source families, articles and captured prices survive without live write flags',()=>{
  assert.deepEqual(plan.counts,{families:42,articles:472,materialProfiles:2551,sourcePriceRows:37605,exactQuotes:7645,
    unavailableArticles:['63078','63079']});
  assert.equal(plan.hierarchy.overview.name,'Klistermærker');
  assert.equal(plan.hierarchy.categories[0].name,'Etiketter på rulle');
  assert.equal(plan.hierarchy.categories.length,6);
  assert.equal(new Set(plan.families.map(f=>f.categoryId)).size,5);
  assert.equal(plan.databaseWrites,false);
  assert.ok(Object.values(plan.approvals).every(value=>value===false));
  assert.ok(plan.families.every(f=>!f.proposedProduct.is_ready && !f.proposedProduct.is_published));
});

test('same-named materials retain article-specific identities, fields and quantity-price IDs',()=>{
  for(const profile of plan.profiles){
    const raw=materials.get(profile.articleId).find(m=>String(m.material.value)===profile.sourceMaterialId);
    assert.equal(profile.labelOriginal,raw.material.label);
    assert.deepEqual(profile.sourceQuantities.map(q=>q.sourcePriceScaleId),raw.price_rows.filter(r=>Number(r.wert)>0).map(r=>String(r.id)));
    assert.deepEqual(profile.defaultSourceOptions,raw.default_upsells);
    const fields=raw.options_evidence?.response?.data?.response?.additionalFieldsData||{};
    for(const field of profile.optionFields){
      assert.deepEqual(field.values.map(v=>v.sourceValueId),Object.values(fields[field.sourceFieldId].werte)
        .sort((a,b)=>Number(a.sort)-Number(b.sort)).map(v=>String(v.id)));
    }
  }
  const article=catalogue.articles.find(a=>a.supplier_article_id==='54008');
  assert.deepEqual(plan.profiles.filter(p=>p.articleId==='54008').map(p=>p.sourceMaterialId),
    article.selects_initial_state.find(s=>s.name==='sorten').options.filter(v=>Number(v.value)>0).map(v=>String(v.value)));
});

test('source price decreases and unit-labelled prices remain raw; setup is preserved separately',()=>{
  const profile=plan.sourcePrices.filter(r=>r.articleId==='55058' && r.materialId==='1006962');
  const raw=materials.get('55058').find(m=>String(m.material.value)==='1006962');
  assert.ok(raw);
  assert.deepEqual(profile.map(p=>p.supplierPrice),raw.price_rows.filter(r=>Number(r.wert)>0).map(r=>r.preis));
  const quote=plan.exactQuotes.find(q=>q.profileKey==='54008:1003759' && Number(q.quantity)===1000);
  assert.equal(Number(quote.supplierNetTotal),34.70);
  assert.equal(Number(quote.basePrice),19.80);
  assert.equal(Number(quote.setupAndServices.option08_jn),14.90);
  assert.equal(quote.commercialApproval,false);
});

test('free-size and machine profiles keep their dimensions and roll models separate',()=>{
  const standard=plan.profiles.find(p=>p.articleId==='54008');
  const fixed=plan.profiles.find(p=>p.articleId==='55058');
  const machine=plan.profiles.find(p=>p.articleId==='60420');
  assert.equal(standard.format.customSize,true);
  assert.deepEqual(fixed.format.dimensions,{widthMm:50,heightMm:50});
  assert.equal(machine.format.rollModel,'outer_diameter');
  assert.equal(machine.format.shape,'circle');
  assert.ok(machine.blockers.includes('missing_source_template'));
  const directions=fixed.optionFields.find(f=>f.sourceFieldId==='222');
  assert.deepEqual(directions.values.filter(v=>v.rotationDegrees!==null).map(v=>v.rotationDegrees),[0,90,270,180]);
  assert.equal(standard.optionFields.find(f=>f.sourceFieldId==='222').values.length,1,
    'machine directions must not be invented from another captured state');
});

test('booklet conflicts stay blocked while samples and blank goods need no artwork',()=>{
  assert.equal(new Set(plan.profiles.filter(p=>p.blockers.includes('booklet_geometry_quarantined')).map(p=>p.articleId)).size,25);
  assert.ok(plan.profiles.find(p=>p.articleId==='63065').blockers.includes('booklet_geometry_quarantined'));
  assert.equal(plan.profiles.find(p=>p.articleId==='65927').customerArtworkRequired,false);
  for(const p of plan.profiles.filter(p=>['28276','26161','24671','32515','24682','32244'].includes(p.familyId))){
    assert.equal(p.customerArtworkRequired,false);assert.ok(!p.blockers.includes('missing_source_template'));
  }
  assert.equal(plan.families.find(f=>f.sourceFamilyId==='20649').existingProductToPreserve.id,'f4d530bd-d80a-4cd7-8745-8e5431a18fe4');
});

test('a missing supplier group or foreign material cannot silently produce a partial package',()=>{
  assert.throws(()=>buildRollLabelCatalogue({catalogue:{...catalogue,category_graph:[]},loadMaterials}),/Missing source group/);
  assert.throws(()=>buildRollLabelCatalogue({catalogue,standardCandidates,loadMaterials:id=>id==='54008'?[{...loadMaterials(id)[0],article_id:'55058'}]:loadMaterials(id)}),/Foreign article/);
  assert.throws(()=>buildRollLabelCatalogue({catalogue,loadMaterials}),/Reviewed standard geometry/);
  assert.match(rollLabelPlannedId('example'),/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(rollLabelDanishLabel('rechts voraus (Drehung um 90 Grad)'),'Højre kant først');
});
