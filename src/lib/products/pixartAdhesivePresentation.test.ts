import test from 'node:test';
import assert from 'node:assert/strict';
import { adhesiveOptionLabel, adhesiveTooltipDefault, adhesiveProductionOffset, isPixartAdhesiveMaterials, productionKind } from './pixartAdhesivePresentation.ts';

test('only reviewed adhesive materials enable the compact product presentation', () => {
  assert.equal(isPixartAdhesiveMaterials([{name:'Matt Monomeric Self-Adhesive Vinyl'}]),true);
  assert.equal(isPixartAdhesiveMaterials([]),false);
  assert.equal(isPixartAdhesiveMaterials([{name:'Matt Monomeric Self-Adhesive Vinyl'},{name:'Foamex 3mm'}]),false);
  assert.equal(productionKind('Fast printing'),null);
});
test('supplier finish aliases display Danish or English without changing IDs', () => {
  assert.equal(adhesiveOptionLabel('finishes','Standard matte','da'),'Standard mat');
  assert.equal(adhesiveOptionLabel('finishes','UV Filter 5 Gloss','da'),'UV blank');
  assert.equal(adhesiveOptionLabel('finishes','UV matte','en'),'UV matt');
  assert.equal(adhesiveOptionLabel('products','Fast delivery','da'),'Hurtig');
  assert.equal(adhesiveOptionLabel('finishes','Unknown film','da'),'Unknown film');
});
test('editable help uses stable material, finish and production anchors in both languages', () => {
  const material=adhesiveTooltipDefault('materials',{name:'Kort navn',sourceName:'White PVC-Free EasyWall'},'matrix','id-1');
  assert.equal(material?.anchor,'material:matrix:id-1');
  assert.match(material!.text,/mikrosug/);
  assert.match(material!.translations!.en!.text!,/micro-suction/);
  const finish=adhesiveTooltipDefault('finishes',{name:'UV matte'},'finish-box','id-2');
  assert.equal(finish?.anchor,'finish:finish-box:id-2');
  assert.match(finish!.text,/70 µm/);
  assert.equal(adhesiveTooltipDefault('products',{name:'Standard delivery'},'production-box','id-3')?.anchor,'production:production-box:id-3');
  assert.equal(adhesiveTooltipDefault('finishes',{name:'Unknown'},'finish-box','id-4'),undefined);
});
test('only actual selected fast production advances the delivery estimate', () => {
  assert.equal(adhesiveProductionOffset(['Standard delivery']),0);
  assert.equal(adhesiveProductionOffset([]),0);
  assert.equal(adhesiveProductionOffset(['Fast delivery']),2);
  assert.equal(adhesiveProductionOffset(['Fast delivery'],3),3);
  assert.equal(adhesiveProductionOffset(['Fast delivery'],-1),0);
  assert.equal(adhesiveProductionOffset(['Fast delivery'],Number.NaN),2);
});
