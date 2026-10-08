import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadRollLabelStockDisplay} from '../shared/load-roll-label-stock-display.js';
import {prepareRollLabelStockFormatDisplay,rollLabelStockFormatCaption} from '../shared/roll-label-stock-format-display.js';
import {buildRollLabelProductReview} from '../shared/roll-label-product-review.js';
import {loadRollLabelMotifDelivery} from '../shared/load-roll-label-motif-delivery.js';
import {loadRollLabelCodingDelivery} from '../shared/load-roll-label-coding-delivery.js';
import {loadRollLabelCodingOptions} from '../shared/load-roll-label-coding-options.js';
import {loadRollLabelMotifRectangleGeometry} from '../shared/load-roll-label-motif-rectangle-geometry.js';
import {loadRollLabelMotifPageDimensions} from '../shared/load-roll-label-motif-page-dimensions.js';
import {loadRollLabelContourMetadata} from '../shared/load-roll-label-contour-metadata.js';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06',out='output/qa/roll-labels-2026-10-06/stock-format-016';
const json=file=>JSON.parse(fs.readFileSync(file));
const families=fs.readdirSync(`${base}/families`).filter(f=>f.endsWith('.json')).map(f=>json(`${base}/families/${f}`));
const {stocks,formats}=loadRollLabelStockDisplay(process.cwd(),families);
const motifDelivery=loadRollLabelMotifDelivery(process.cwd(),families);
const codingDelivery=loadRollLabelCodingDelivery(process.cwd(),families);
const codingOptions=loadRollLabelCodingOptions(process.cwd());
const motifRectangleGeometry=loadRollLabelMotifRectangleGeometry(process.cwd());
const motifPageDimensions=loadRollLabelMotifPageDimensions(process.cwd()).contracts;
const contourMetadata=loadRollLabelContourMetadata(process.cwd()).contracts;
test('94 format projections regenerate from94 exact material and89 original article captures',()=>{
  const prepared=json(`${out}/format-display-preparation.json`);
  assert.deepEqual([...formats.values()],prepared.formats);assert.equal(new Set(prepared.formats.map(p=>p.articleId)).size,89);
  assert.equal([...formats.values()].filter(f=>f.dimensions.kind==='diameter_mm').length,2);
  for(const item of prepared.protectedArtifacts)assert.equal(createHash('sha256').update(fs.readFileSync(item.path)).digest('hex'),item.sha256);
});
test('existing selector projection captions preserve all IDs, production dimensions and other profiles',()=>{
  for(const family of families.filter(f=>[...stocks.values()].some(c=>c.familyId===f.sourceFamilyId))) {
    const before=buildRollLabelProductReview(family),after=buildRollLabelProductReview(family,new Map(),new Map(),new Map(),new Map(),new Map(),new Map(),stocks,formats);
    for(const group of after.sourceGroups)for(const v of group.values) {
      const old=before.sourceGroups.flatMap(g=>g.values).find(q=>q.id===v.id);
      assert.deepEqual({...v,name:old.name},old);
      if(group.kind==='format'&&family.profiles.some(p=>p.formatValueId===v.id&&formats.has(p.key)))assert.equal(/variant \d/.test(v.name),false);
    }
    for(const p of after.profiles){const {stockDisplay,stockFormatDisplay,sourceEvidenceSha256,sourceQuantityBindings,...rest}=p;
      assert.deepEqual(rest,before.profiles.find(q=>q.key===p.key));}
  }
});
test('source-copy mismatch and modified/foreign format contracts cannot generate captions',()=>{
  const c=[...stocks.values()].find(c=>c.kind==='blank_a4_sheet_pack'),f=families.find(f=>f.sourceFamilyId===c.familyId),p=f.profiles.find(p=>p.key===c.profileKey);
  assert.throws(()=>prepareRollLabelStockFormatDisplay(f,p,c,Buffer.from(JSON.stringify({article_id:p.articleId,title:'Etiketten 1 x 2 cm',status:200}))));
  const d=formats.get(p.key),article=f.articles.find(a=>a.articleId===p.articleId);
  assert.throws(()=>rollLabelStockFormatCaption(article,c,{...d,dimensions:{kind:'label_mm',widthMm:1,heightMm:2}},'base'));
  assert.throws(()=>rollLabelStockFormatCaption({...article,formatValueId:'foreign'},c,d,'base'));
});
test('current narrow artifact delta preserves all015metadata, prices, shapes, quantities and gates',()=>{
  const receipt=json(`${out}/format-display-preparation.json`);
  for(const change of receipt.changes) {
    const relative=change.path.slice(base.length+1),before=json(`${out}/before-artifacts/${relative}`),after=json(change.path);
    const strip=(a,b)=>{
      const profiles=a.profiles||a.pricingStructure.rollLabelConfiguration.profiles;
      for(const p of profiles) {
        if(contourMetadata.has(p.key)){
          assert.deepEqual(p.cutContourContract,contourMetadata.get(p.key));delete p.cutContourContract;
        }
        delete p.stockFormatDisplay;
        if(motifRectangleGeometry.has(p.key)) {
          assert.deepEqual(p.sizeGeometry,motifRectangleGeometry.get(p.key));
          const previous=(b.profiles||b.pricingStructure.rollLabelConfiguration.profiles).find(q=>q.key===p.key);
          p.sizeGeometry=previous.sizeGeometry;
        }
        // Account for the later independently source-verified021display delta
        // before comparing the historical015->016stock-only change.
        if(p.motifDelivery) {
          if(motifPageDimensions.has(p.key)) {
            assert.deepEqual(p.motifDelivery.pageDimensions,motifPageDimensions.get(p.key));
            delete p.motifDelivery.pageDimensions;
          }
          assert.deepEqual(p.motifDelivery,motifDelivery.get(p.key));
          assert.equal(p.sourceEvidenceSha256,p.motifDelivery.sourceEvidenceSha256);
          const previous=(b.profiles||b.pricingStructure.rollLabelConfiguration.profiles).find(q=>q.key===p.key);
          if(previous.motifDelivery) p.motifDelivery=previous.motifDelivery; else delete p.motifDelivery;
          if(previous.sourceEvidenceSha256) p.sourceEvidenceSha256=previous.sourceEvidenceSha256; else delete p.sourceEvidenceSha256;
        }
        if(p.codingDeliveryDisplay) {
          assert.deepEqual(p.codingDeliveryDisplay,codingDelivery.get(p.key));
          assert.equal(p.sourceEvidenceSha256,p.codingDeliveryDisplay.sourceEvidenceSha256);
          const previous=(b.profiles||b.pricingStructure.rollLabelConfiguration.profiles).find(q=>q.key===p.key);
          assert.deepEqual(p.optionStates,codingOptions.get(p.key));
          p.optionStates=previous.optionStates;
          if(previous.codingDeliveryDisplay) p.codingDeliveryDisplay=previous.codingDeliveryDisplay; else delete p.codingDeliveryDisplay;
          if(previous.sourceEvidenceSha256) p.sourceEvidenceSha256=previous.sourceEvidenceSha256; else delete p.sourceEvidenceSha256;
        }
      }
      const groups=a.sourceGroups||a.proposedAttributeGroups,old=b.sourceGroups||b.proposedAttributeGroups;
      for(const g of groups)for(const v of g.values)v.name=old.find(q=>q.id===g.id).values.find(q=>q.id===v.id).name;
      if(a.articles)for(const x of a.articles)x.name=b.articles.find(q=>q.articleId===x.articleId).name;
    };
    if(after.families)for(const f of after.families)strip(f,before.families.find(q=>q.familyId===f.familyId));else strip(after,before);
    assert.deepEqual(after,before);
  }
});
test('new016 stock packages carry exact captions and German source names while preserving274quotes and all closed gates',()=>{
  const destination=`${base}/canonical-stock-preparation-016`,registry=json(`${destination}/registry.json`);
  const inventory=json('docs/roll-labels-2026-09-30/catalogue.normalized.json');
  let rows=0,profiles=0,quantities=0;
  for(const family of registry.families) {
    const dir=`${destination}/${family.familyId}`,old=`${base}/canonical-stock-preparation-015/${family.familyId}`;
    const manifest=json(`${dir}/import-manifest.proposed.json`),source=inventory.families.find(f=>String(f.source_category_id)===family.familyId);
    assert.equal(manifest.product.nameOriginal,source.name_de);assert.equal(manifest.product.nameDa,source.name_da);
    for(const name of ['pricing.proposed.jsonl','documents.jsonl'])assert.deepEqual(fs.readFileSync(`${dir}/${name}`),fs.readFileSync(`${old}/${name}`));
    for(const field of ['pricing','documents','target','readiness','optionGroups','templateBindingAxes'])assert.deepEqual(manifest[field],json(`${old}/import-manifest.proposed.json`)[field]);
    const stock=fs.readFileSync(`${dir}/stock-display.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
    for(const record of stock)assert.deepEqual(record.stockFormatDisplay,formats.get(record.profileKey));
    const previous=fs.readFileSync(`${old}/stock-display.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(stock.map(({stockFormatDisplay,...record})=>record),previous);
    for(const key of ['pricing','stockDisplay','documents']) {
      const a=manifest[key].recordsArtifact,bytes=fs.readFileSync(`${dir}/${a.path}`);
      assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
    }
    assert.equal(family.canonicalManifestValidated,false);assert.equal(family.validatorExitCode,1);
    assert.match(fs.readFileSync(`${dir}/validation.log`,'utf8'),/documents\.recordsArtifact\.rowCount must be greater than zero/);
    rows+=family.priceRows;profiles+=family.profiles;quantities+=family.sourceQuantityBindings;
  }
  assert.equal(rows,274);assert.equal(profiles,94);assert.equal(quantities,1774);
});
