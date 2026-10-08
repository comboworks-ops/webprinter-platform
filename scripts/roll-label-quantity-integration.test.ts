import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRollLabelLocalPricePreview, readRollLabelLocalPriceLedgers, rollLabelBasePriceLedger, rollLabelLocalPriceAdditions } from './roll-label-local-price-ledgers';
import { buildRollLabelPricePreview } from './roll-label-price-preview';
import { buildRollLabelSystemProduct } from './roll-label-system-product';
import { buildRollLabelPriceMatrix, rollLabelPricesFromGenericRows } from '../src/lib/products/rollLabelPriceMatrix';
import { rollLabelPriceSelectionKey } from '../src/lib/products/rollLabelPricePreview';
import { validateRollLabelConfiguration } from '../src/lib/products/rollLabelConfiguration';

const base = 'output/supplier-imports/roll-labels-catalogue-2026-10-06/review';
const family = JSON.parse(fs.readFileSync(base + '/families/20649.json', 'utf8'));
const ledgers = await readRollLabelLocalPriceLedgers(process.cwd());
const original = buildRollLabelPricePreview(family, ledgers.baseRows, 'wmd_roll_labels_threshold_fx_7_6');
const merged = buildRollLabelLocalPricePreview(family, ledgers, 'wmd_roll_labels_threshold_fx_7_6');

test('sealed quantity additions preserve all 300 old points and every other family', () => {
  const observerOnly=buildRollLabelLocalPricePreview(family,{...ledgers,additions:ledgers.additions.slice(0,1)},merged.ruleKey);
  assert.equal(original.points.length, 300); assert.equal(observerOnly.points.length,320);
  assert.equal(merged.points.length, 2201);
  for (const point of original.points) assert.deepEqual(merged.points.find(item => item.id === point.id), point);
  let total = 0;
  for (const entry of JSON.parse(fs.readFileSync(base + '/native-catalogue.json', 'utf8')).families) {
    const f = JSON.parse(fs.readFileSync(base + '/families/' + entry.familyId + '.json', 'utf8'));
    const packet = buildRollLabelLocalPricePreview(f, ledgers, 'wmd_roll_labels_threshold_fx_7_6'); total += packet.points.length;
    if (entry.familyId !== '20649') assert.deepEqual(packet, buildRollLabelPricePreview(f, ledgers.baseRows, packet.ruleKey));
  }
  assert.equal(total, 8899);
});

test('all 100 materials and shapes have the complete exact ladder without changing old generic rows', () => {
  const previous=buildRollLabelSystemProduct(family,original,'etiketter-i-egne-maal');
  const current=buildRollLabelSystemProduct(family,merged,'etiketter-i-egne-maal');
  const byIdentity=new Map(current.genericPriceRows.map(row=>[rollLabelPriceSelectionKey(row.extra_data.rollLabels),row]));
  for (const row of previous.genericPriceRows) assert.deepEqual(byIdentity.get(rollLabelPriceSelectionKey(row.extra_data.rollLabels)),row);
  const packet=rollLabelPricesFromGenericRows(current.product.pricing_structure.rollLabelPricing,current.genericPriceRows,current.product.tenant_id);
  assert.equal(family.profiles.length,100);
  const ladder=[50,100,200,250,500,750,1000,1500,2000,2500,3000,4000,5000,7500,10000,15000,20000,25000,50000,100000,200000,300000];
  for (const profile of family.profiles) {
    const sample=packet.points.find(point=>point.selection.profileKey===profile.key)!;
    const matrix=buildRollLabelPriceMatrix(packet,profile,sample.selection,'Materiale');
    assert.deepEqual(matrix.columns.filter(quantity=>quantity!==137),ladder);
    for (const quantity of ladder) {
      const point=Object.values(matrix.selections).map(row=>row[quantity]).find(Boolean)!;
      assert.ok(point);assert.equal(point.selection.profileKey,profile.key);
      const selected=buildRollLabelPriceMatrix(packet,profile,point.selection,'Materiale');
      assert.equal(selected.cells[selected.selectedCell!.row][quantity],point.priceDkk);
    }
  }
});

test('all 23 exact quantity cells use the normal generic publisher and price reader', () => {
  const draft = buildRollLabelSystemProduct(family, merged, 'etiketter-i-egne-maal');
  const packet = rollLabelPricesFromGenericRows(draft.product.pricing_structure.rollLabelPricing, draft.genericPriceRows, draft.product.tenant_id);
  const profile = family.profiles.find((p: {key: string}) => p.key === '54008:1003759');
  const points = packet.points.filter(point => point.selection.profileKey === profile.key && point.selection.widthMm === 50 && point.selection.heightMm === 50
    && point.selection.sourceOptions['222'] === '11293' && point.selection.sourceOptions['473'] === '1681');
  assert.equal(points.length, 23);
  const matrix = buildRollLabelPriceMatrix(packet, profile, points[0].selection, 'Materiale');
  assert.deepEqual(matrix.columns, [50, 100, 137, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 100000, 200000, 300000]);
  for (const point of points) {
    const exact = buildRollLabelPriceMatrix(packet, profile, point.selection, 'Materiale');
    assert.equal(exact.cells[exact.selectedCell!.row][point.selection.quantity], point.priceDkk);
    assert.equal(rollLabelPriceSelectionKey(exact.selections[exact.selectedCell!.row][point.selection.quantity].selection), rollLabelPriceSelectionKey(point.selection));
  }
  for (const [quantity, price] of [[50,239], [100,285], [137,319], [250,423], [1000,448], [4000,540], [300000,21887]])
    assert.equal(points.find(point => point.selection.quantity === quantity)!.priceDkk, price);
  const sample = points[0].selection;
  const uncaptured = validateRollLabelConfiguration(profile, { dimensions:{width:'50',height:'50'}, quantity:'138', allocations:[], optionStateId:sample.optionStateId }, {productId:family.productId,familyId:family.familyId}).selection!;
  assert.ok(uncaptured); assert.equal(buildRollLabelPriceMatrix(packet, profile, uncaptured, 'Materiale').selectedCell, null);
});

test('duplicates and invalid additions fail closed without altering the base ledger', () => {
  for (const rows of [[ledgers.baseRows.find(row => row.sourceKey === '54008:1003759')!],
    [ledgers.additions[0].rows[0], ledgers.additions[0].rows[0]],
    [{...ledgers.additions[0].rows[0],quantity:0}]]) {
    assert.throws(() => buildRollLabelLocalPricePreview(family, {...ledgers, additions:[{...ledgers.additions[0],rows}]}, merged.ruleKey));
  }
});

test('changed sealed evidence refuses instead of falling back to old prices', async () => {
  const temp = fs.mkdtempSync('/private/tmp/roll-label-quantity-integrity-');
  fs.mkdirSync(temp + '/' + rollLabelBasePriceLedger.path.split('/').slice(0,-1).join('/'), {recursive:true});
  fs.copyFileSync(rollLabelBasePriceLedger.path, temp + '/' + rollLabelBasePriceLedger.path);
  for (const addition of rollLabelLocalPriceAdditions) {
    fs.mkdirSync(temp + '/' + addition.path.split('/').slice(0,-1).join('/'), {recursive:true});
    fs.copyFileSync(addition.path,temp+'/'+addition.path);
  }
  for (const addition of rollLabelLocalPriceAdditions) {
    const bytes=fs.readFileSync(addition.path);
    fs.writeFileSync(temp+'/'+addition.path,Buffer.concat([bytes,Buffer.from(' ')]));
    await assert.rejects(readRollLabelLocalPriceLedgers(temp), /evidence changed/);
    fs.writeFileSync(temp+'/'+addition.path,bytes);
  }
});
