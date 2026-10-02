import test from 'node:test';
import assert from 'node:assert/strict';
import { materialPresentation, materialTooltipDefaults } from './materialPresentation.ts';

test('paper description is retained while the label shows type and grammage', () => {
  const name = 'Naturpapir 90 g/m² – FSC-certificeret. Velegnet til brevpapir.';
  const result = materialPresentation({name});
  assert.equal(result.label, 'Naturpapir 90 g/m²');
  assert.equal(result.text, name);
  assert.equal(result.fsc, true);
});
test('coating and recycled paper identity remain distinguishable', () => {
  for (const name of ['135 g mat silk', '135 g blank silk', 'Genbrugspapir 90 g', '300 g Chromokarton', 'Silk 135 g (mat)', 'Silk 135 g (blank)']) assert.equal(materialPresentation({name}).label, name);
});
test('actual letterhead names move all parenthetical specifications into help', () => {
  for (const weight of [90,120]) {
    const name = `Naturpapir: ${weight}g hvidt offsetpapir (standardpapir, preprint, FSC-certificeret og egnet til laser/inkjet)`;
    const result = materialPresentation({name});
    assert.equal(result.label,`${weight} g hvidt offsetpapir`);
    assert.equal(result.text,name);
    assert.equal(result.fsc,true);
  }
});
test('no guessing of non-paper specifications or certification from absence', () => {
  const name = 'PVC 510 g/m² – udendørs';
  assert.equal(materialPresentation({name}).label, name);
  assert.equal(materialPresentation({name:'Offsetpapir 90 g', description:'Ikke FSC-certificeret'}).fsc, false);
  assert.equal(materialPresentation({name:'Offsetpapir 90 g'}).fsc, false);
});
test('metadata descriptions generate stable editable help points and a separate certification icon', () => {
  const configs = materialTooltipDefaults({name:'Offsetpapir 90 g',meta:{descriptionDa:'FSC-certificeret. Egnet til brevpapir.'}}, 'paper', 'value-id');
  assert.deepEqual(configs.map(item=>item.anchor), ['material:paper:value-id','material:paper:value-id:fsc']);
  assert.match(configs[0].text,/Egnet til brevpapir/);
  assert.equal(configs[1].icon,'leaf');
  assert.ok(configs[1].link?.startsWith('https://fsc.org/'));
  assert.equal(configs[1].iconUrl, undefined);
});
test('shortening labels never changes the supplied source object', () => {
  const source = {name:'Offsetpapir 90 g, FSC-certificeret'};
  const before = JSON.stringify(source);
  assert.equal(materialPresentation(source).label,'Offsetpapir 90 g');
  assert.equal(JSON.stringify(source), before);
});
test('a short display-name override retains the underlying supplier description', () => {
  const result=materialPresentation({name:'Offsetpapir 90 g',sourceName:'Naturpapir: 90g hvidt offsetpapir (FSC-certificeret og egnet til laser/inkjet)'});
  assert.match(result.text,/laser\/inkjet/);
  assert.equal(result.fsc,true);
});

test('reviewed notebook and folder notes move into help without losing weight or paper identity', () => {
  const cases = [
    ['80g naturligt hvidt offsetpapir (skrivebart)', '80 g naturligt hvidt offsetpapir'],
    ['120g naturligt hvidt offsetpapir (skrivebart)', '120 g naturligt hvidt offsetpapir'],
    ['80g 100% genbrugspapir (skrivebart)', '80 g 100% genbrugspapir'],
    ['Offset: 80g kvalitetstryk på offsetpapir (skrivebart, egnet til inkjet og laserprint)', '80 g offsetpapir'],
    ['135g blankt kvalitetstryk', '135 g blankt papir'],
    ['170g mat kvalitetstryk', '170 g mat papir'],
  ];
  for (const [name,label] of cases) {
    const source = Object.freeze({name});
    assert.equal(materialPresentation(source).label,label);
    assert.equal(materialPresentation(source).text,name);
  }
});
test('reviewed foil names retain finish, material, backing and brand distinctions', () => {
  const cases = [
    ['Matt Monomeric Self-Adhesive Vinyl','Mat monomerfolie'],
    ['Gloss Monomeric Self-Adhesive Vinyl','Blank monomerfolie'],
    ['Matt Monomeric Self-Adhesive Vinyl with Grey Back','Mat monomerfolie, grå bagside'],
    ['Gloss Polymeric Self-Adhesive Vinyl with grey back','Blank polymerfolie, grå bagside'],
    ['Transparent Self-Adhesive Vinyl','Transparent klæbefolie'],
    ['Matt PVC-Free Film with Grey Back','Mat PVC-fri folie, grå bagside'],
    ['White PVC-Free EasyWall','Hvid PVC-fri EasyWall'],
  ];
  const labels = cases.map(([name,label]) => {
    const result=materialPresentation({name});
    assert.equal(result.label,label);
    assert.equal(result.text,name);
    assert.equal(result.fsc,false);
    return result.label;
  });
  assert.equal(new Set(labels).size,cases.length);
  assert.equal(materialPresentation({name:'Dibond Brushed 3mm'}).label,'Dibond Brushed 3mm');
  assert.equal(materialPresentation({name:'T-Shirt Herren Budget, farbig - Fruit of the Loom'}).label,'T-Shirt Herren Budget, farbig - Fruit of the Loom');
});
test('recycling help follows explicit source language and invents no percentage or certification', () => {
  const configs=materialTooltipDefaults({name:'100% genbrugspapir 90 g'},'paper','recycled');
  assert.equal(configs.length,1);
  assert.equal(configs[0].icon,'recycle');
  assert.equal(configs[0].anchor,'material:paper:recycled:recycled');
  assert.equal(configs[0].link,undefined);
  assert.equal(materialPresentation({name:'Offsetpapir 90 g',description:'Ikke genbrugspapir'}).recycled,false);
  assert.equal(materialPresentation({name:'Offsetpapir 90 g'}).recycled,false);
});

test('grammage spacing alone does not add an empty-information help button', () => {
  assert.equal(materialPresentation({name:'135g papir'}).label,'135 g papir');
  assert.deepEqual(materialTooltipDefaults({name:'135g papir'},'paper','plain'),[]);
  assert.equal(materialTooltipDefaults({name:'135g 100% genbrugspapir'},'paper','recycled').length,1);
});
