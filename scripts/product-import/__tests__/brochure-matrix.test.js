import test from 'node:test';
import assert from 'node:assert/strict';
import {brochureMatrixAdapter} from '../shared/brochure-matrix.js';
import {buildGenericPriceRowsFromNormalized} from '../shared/matrix-publisher.js';
const option=(key,label,meta={})=>({key,labelOriginal:label,labelDa:label,meta});
function manifest(){return {runId:'review',source:{supplierSlug:'wir-machen-druck'},product:{sourceKey:'brochure',family:'books'},pricing:{conversionRuleKey:'wmd_tiered_fx_7_5'},optionGroups:[
  ['orientation',[option('portrait','Lodret')]],['format',[option('210x297','A4',{widthMm:210,heightMm:297}),option('free','Fri størrelse')]],['pageCount',[option('56','56 sider',{brochurePageCount:56})]],['paperCover',[option('native-1','Indhold 135g / omslag 250g'),option('native-2','Indhold 135g / omslag 250g')]],['cover',[option('matte','Mat')]],['varnish',[option('none','Uden lak')]]].map(([key,values])=>({key,labelDa:key,values}))};}
const record={quantity:100,supplierPrice:10,convertedPriceDkk:75,finalPriceDkk:120,sourceUrl:'https://www.wir-machen-druck.de/wmdrest/article/get-price',selections:{orientation:'portrait',format:'210x297',pageCount:'56',paperCover:'native-2',cover:'matte',varnish:'none'}};
test('brochure rows reuse the generic publisher while retaining the exact native identity',()=>{
  const adapter=brochureMatrixAdapter(manifest());assert.equal(adapter.matrixConfig.verticalAxis.valueSpecs.length,1);
  assert.equal(adapter.matrixConfig.sections.find(s=>s.key==='pageCount').valueSpecs[0].meta.brochurePageCount,56);
  const normalized=adapter.rehydrate(record),def=adapter.matrixConfig;
  const section=(definition)=>({definition,group:{id:definition.key},values:definition.valueSpecs.map((v,i)=>({id:definition.key+'-'+i,name:v.name})),valueByName:new Map(definition.valueSpecs.map((v,i)=>[v.name,{id:definition.key+'-'+i}]))});
  const resolved={verticalAxis:section(def.verticalAxis),sections:def.sections,resolvedSections:new Map(def.sections.map(d=>[d.key,section(d)]))};
  const [row]=buildGenericPriceRowsFromNormalized({tenantId:'tenant',productId:'new-draft',matrixConfig:def,resolved,normalizedRows:[normalized]});
  assert.equal(row.price_dkk,120);assert.equal(row.quantity,100);assert.equal(row.extra_data.brochureSourceSelections.paperCover,'native-2');assert.equal(row.extra_data.brochurePageCount,56);assert.equal(row.extra_data.selectionMap.pageCount,'pageCount-0');
  assert.deepEqual(row.extra_data.variantValueIds,['orientation-0','format-0','pageCount-0','cover-0','varnish-0']);
  assert.deepEqual(row.extra_data.selectionMap.variantValueIds,row.extra_data.variantValueIds);
});
test('source-label collisions, unknown selections and free-size fixed rows fail closed',()=>{
  const m=manifest();m.optionGroups.find(g=>g.key==='paperCover').values[1].labelOriginal='A different paper';assert.throws(()=>brochureMatrixAdapter(m),/Distinct source choices/);
  const a=brochureMatrixAdapter(manifest());assert.throws(()=>a.rehydrate({...record,selections:{...record.selections,paperCover:'missing'}}),/Unknown/);assert.throws(()=>a.rehydrate({...record,selections:{...record.selections,format:'free'}}),/exact-dimension/);
});
