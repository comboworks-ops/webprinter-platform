import test from 'node:test';
import assert from 'node:assert/strict';
import { brochureVariants, brochureSupplierNet, brochurePricePolicy } from '../shared/brochure-pricing.js';
test('percentage pricing follows exact source cents without applying margin to a rounded DKK base', () => {
  assert.equal(brochureSupplierNet(10.88, 2), 11.10); assert.equal(brochureSupplierNet(100.25, 2), 102.26);
});
test('only classic stitching and requested cover/dispersion combinations enter the import', () => {
  const value = (id,label,percentage=0,preselected=false) => ({id,labelOriginal:label,percentage,preselected,salePrice:0,basePrice:0,minimumPrice:0});
  const fields = [{id:1,labelOriginal:'Heftung',priceType:2,values:[value(10,'Klassische Drahtheftung'),value(11,'Ringösen',2)]},
    {id:2,labelOriginal:'Umschlag Papier',priceType:0,values:[value(20,'Umschlag matt gestrichen'),value(21,'Umschlag Recyclingpapier weiß')]},
    {id:3,labelOriginal:'Dispersionslack auf Umschlag',priceType:2,values:[value(30,'Standard ohne zusätzliche Lackierung'),value(31,'Dispersionslack matt',2)]}];
  const variants=brochureVariants(fields);assert.equal(variants.length,4);assert.ok(variants.every(v=>v.upsells[1].id===10));assert.deepEqual([...new Set(variants.map(v=>v.percentage))],[0,2]);
});
test('unexpected compulsory fees fail closed', () => {
  assert.throws(()=>brochureVariants([{id:1,labelOriginal:'Unknown',values:[]}]),/reviewed default/);
});
test('the explicit uncoated cover survives a missing native preselection flag', () => {
  const none = {id:14039,labelOriginal:'Umschlag ohne Veredelung',preselected:false,percentage:0,salePrice:0,basePrice:0,minimumPrice:0};
  const field = {id:2223,labelOriginal:'Einfache Veredelung',priceType:5,values:[none,{...none,id:14042,labelOriginal:'UV-Lack glänzend',salePrice:0.04286}]};
  assert.equal(brochureVariants([field])[0].upsells[2223].id,14039);
  assert.throws(()=>brochureVariants([{...field,values:[{...none,labelOriginal:'Unknown free finish'}]}]),/reviewed default/);
  assert.throws(()=>brochureVariants([{...field,values:[none,{...none,id:42}]}]),/reviewed default/);
  assert.throws(()=>brochureVariants([{...field,values:[{...none,minimumPrice:1}]}]),/reviewed default/);
});
test('dispersion varnish in the combined finish menu remains selectable', () => {
  const none = {id:1,labelOriginal:'Umschlag ohne Veredelung',preselected:true,percentage:0,salePrice:0,basePrice:0,minimumPrice:0};
  const field = {id:2236,labelOriginal:'Einfache Veredelung',priceType:5,values:[none,{...none,id:2,labelOriginal:'Umschlag einseitig vollflächiger Dispersionslack matt',preselected:false,percentage:2},{...none,id:3,labelOriginal:'Mattfolie',salePrice:0.04756}]};
  assert.deepEqual(brochureVariants([field]).map(v=>[v.varnish,v.percentage]),[['none',0],['dispersion_matte',0]]);
  assert.equal(field.values[1].percentage,2); // retain the contradictory native inventory as evidence
  assert.throws(()=>brochureVariants([{...field,values:[none,{...field.values[1],minimumPrice:1}]}]),/Unsupported supplier fee/);
});
test('natural cover is a distinct choice and equivalent policies retain explicit fee differences', () => {
  const value = (id,label,percentage=0) => ({id,labelOriginal:label,percentage,salePrice:0,basePrice:0,minimumPrice:0});
  const fields = [{id:1,labelOriginal:'Umschlag Papier',priceType:0,values:[value(10,'Umschlag matt gestrichen'),value(11,'Umschlag Offset/Naturpapier weiß')]}];
  assert.deepEqual(brochurePricePolicy(fields).map(value=>value.cover),['matte','natural']);
  const renamed=structuredClone(fields);renamed[0].id=200;renamed[0].values[0].id=300;
  assert.deepEqual(brochurePricePolicy(renamed),brochurePricePolicy(fields));
  renamed[0].priceType=2;renamed[0].values[0].percentage=2;
  assert.notDeepEqual(brochurePricePolicy(renamed),brochurePricePolicy(fields));
  renamed[0].values[0].minimumPrice=1;
  assert.throws(()=>brochurePricePolicy(renamed),/Unsupported supplier fee/);
});
