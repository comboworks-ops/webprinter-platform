import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildRollLabelPricePreview } from './roll-label-price-preview';
import { buildRollLabelSystemProduct } from './roll-label-system-product';
import { readRollLabelProductContract } from '../src/lib/products/rollLabelConfiguration';
import { buildRollLabelPriceMatrix, readRollLabelPriceMatrixContract, rollLabelPricesFromGenericRows } from '../src/lib/products/rollLabelPriceMatrix';
import { rollLabelPriceSelectionKey } from '../src/lib/products/rollLabelPricePreview';
import { prepareRollLabelGeneratedTemplate, verifyRollLabelGeneratedTemplate } from '../src/lib/designer/rollLabelGeneratedTemplate';

const base = 'output/supplier-imports/roll-labels-catalogue-2026-10-06';
const ledger = fs.readFileSync(base+'/import-review/proposed-exact-prices.jsonl');
const rows = ledger.toString().trim().split('\n').map(line => JSON.parse(line));
const index = JSON.parse(fs.readFileSync(base+'/review/native-catalogue.json','utf8'));
const drafts = index.families.map((entry:{familyId:string;slug:string}) => {
  const family = JSON.parse(fs.readFileSync(base+'/review/families/'+entry.familyId+'.json','utf8'));
  return { family, draft: buildRollLabelSystemProduct(family, buildRollLabelPricePreview(family,rows,'wmd_roll_labels_threshold_fx_7_6'),entry.slug) };
});

test('all42 product drafts use the existing generic row schema without collapsing6998 full identities', () => {
  let prices = 0;
  for (const {family,draft} of drafts) {
    const contract = readRollLabelProductContract(draft.product.pricing_structure.rollLabelConfiguration,draft.product.id)!;
    const packet = readRollLabelPriceMatrixContract(draft.product.pricing_structure.rollLabelPricing,contract)!;
    assert.ok(packet); assert.equal(draft.product.is_published,false); assert.equal(contract.orderReady,false);
    assert.equal(draft.genericPriceRows.length,packet.points.length);
    const keys = draft.genericPriceRows.map(row=>JSON.stringify([row.product_id,row.variant_name,row.variant_value,row.quantity]));
    assert.equal(new Set(keys).size,keys.length);
    const restored = rollLabelPricesFromGenericRows(packet,draft.genericPriceRows,draft.product.tenant_id);
    assert.equal(restored.points.length,packet.points.length);
    assert.deepEqual(restored.points.map(point=>rollLabelPriceSelectionKey(point.selection)).sort(),packet.points.map(point=>rollLabelPriceSelectionKey(point.selection)).sort());
    for (const point of restored.points) {
      const profile = family.profiles.find((p:{key:string})=>p.key===point.selection.profileKey);
      const matrix = buildRollLabelPriceMatrix(restored,profile,point.selection,'Valgt materiale');
      assert.ok(matrix.selectedCell);
      assert.equal(matrix.cells[matrix.selectedCell.row][matrix.selectedCell.column],point.priceDkk);
    }
    assert.ok(!JSON.stringify(draft).includes('supplierPrice'));
    prices += packet.points.length;
  }
  assert.equal(prices,6998);
  assert.deepEqual(fs.readFileSync(base+'/import-review/proposed-exact-prices.jsonl'),ledger);
});

test('ordinary generic prices are displayed, with no metadata fallback for missing, foreign or ambiguous rows', () => {
  const {draft} = drafts.find(item=>item.family.familyId==='20649')!;
  const packet=draft.product.pricing_structure.rollLabelPricing,row=draft.genericPriceRows[0],tenant=draft.product.tenant_id;
  const updated=rollLabelPricesFromGenericRows(packet,[{...row,price_dkk:501}],tenant);
  assert.equal(updated.points[0].priceDkk,501);
  assert.equal(rollLabelPricesFromGenericRows(packet,[],tenant).points.length,0);
  for (const bad of [{...row,tenant_id:'foreign'},{...row,product_id:'foreign'},{...row,variant_name:'other'},
    {...row,price_dkk:-1},{...row,extra_data:{...row.extra_data,selectionMap:{}}},
    {...row,extra_data:{...row.extra_data,rollLabels:{...row.extra_data.rollLabels,widthMm:51}}}]) {
    assert.equal(rollLabelPricesFromGenericRows(packet,[bad],tenant).points.length,0);
  }
  assert.equal(rollLabelPricesFromGenericRows(packet,[row,row],tenant).points.length,0);
});

test('different motif allocations at the same total remain separate matrix rows, and duplicate cells close', () => {
  const {draft,family}=drafts.find(item=>item.family.familyId==='32553')!;
  const packet=draft.product.pricing_structure.rollLabelPricing;
  const point=packet.points.find(p=>p.selection.motifCount===2&&p.selection.quantity===1000)!;
  const other={...point,id:'different-allocation',priceDkk:999,selection:{...point.selection,motifAllocations:[600,400]}};
  const profile=family.profiles.find((p:{key:string})=>p.key===point.selection.profileKey);
  const matrix=buildRollLabelPriceMatrix({...packet,points:[point,other]},profile,point.selection,'Materiale');
  assert.equal(matrix.rows.length,2); assert.deepEqual(matrix.columns,[1000]);
  assert.deepEqual(matrix.rows.map(row=>matrix.cells[row][1000]),[point.priceDkk,999]);
  assert.equal(buildRollLabelPriceMatrix({...packet,points:[point,point]},profile,point.selection,'Materiale').selectedCell,null);
});

test('product-bound price contracts reject readiness changes, altered source configuration and incorrect matrix bindings', () => {
  const {draft}=drafts.find(item=>item.family.familyId==='20649')!;
  const contract=draft.product.pricing_structure.rollLabelConfiguration,packet=draft.product.pricing_structure.rollLabelPricing;
  for (const bad of [{...packet,orderReady:true},{...packet,commercialApproved:true},{...packet,productId:'foreign'},
    {...packet,currency:'EUR'}, {...packet,points:[packet.points[0],packet.points[0]]},
    {...packet,points:[{...packet.points[0],matrix:{...packet.points[0].matrix,variantName:'wrong'}}]}]) {
    assert.equal(readRollLabelPriceMatrixContract(bad,contract),null);
  }
});

test('the same product contract generates physical designer PDFs and detects changed dimensions or template bytes', async () => {
  const {draft}=drafts.find(item=>item.family.familyId==='20649')!;
  const packet=draft.product.pricing_structure.rollLabelPricing,contract=draft.product.pricing_structure.rollLabelConfiguration;
  const point=packet.points.find(p=>p.selection.profileKey==='54008:1003759'&&p.selection.quantity===1000)!;
  const generated=await prepareRollLabelGeneratedTemplate(point.selection,draft.product.id,contract);
  assert.ok(generated); assert.equal(generated.designerAllowed,true);
  const pdf=await PDFDocument.load(generated.bytes);
  assert.equal(pdf.getPageCount(),1);
  const media=pdf.getPages()[0].getMediaBox(),pt=72/25.4;
  assert.ok(Math.abs(media.width-(50+2*generated.guide.bleedMm)*pt)<0.01);
  assert.ok(await verifyRollLabelGeneratedTemplate(generated.descriptor,generated.sha256,point.selection,draft.product.id,contract));
  assert.equal(await verifyRollLabelGeneratedTemplate(generated.descriptor,'0'.repeat(64),point.selection,draft.product.id,contract),null);
  assert.equal(await verifyRollLabelGeneratedTemplate(generated.descriptor,generated.sha256,{...point.selection,widthMm:51},draft.product.id,contract),null);
});
