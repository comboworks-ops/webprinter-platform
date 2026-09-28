// Read-only offline experiment over a previously captured authorized catalog snapshot.
// Usage: node --experimental-strip-types supabase/tests/storefrontStorformatSnapshotParity.mjs /absolute/snapshot.json
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {calculateStorformatPrice} from "../../src/utils/storformatPricing.ts";
import {calculateVerifiedStorformatQuote} from "../functions/_shared/storefrontStorformatQuote.ts";

const rows = JSON.parse(readFileSync(process.argv[2],"utf8"));
const source = readFileSync(new URL("../../src/components/product-price-page/StorformatConfigurator.tsx",import.meta.url),"utf8");
const body = source.slice(source.indexOf("const materialsWithTiers ="),source.indexOf("const idsByType:"));
assert.ok(body.length > 1000,"Could not find existing row assembler");
const compiled = ts.transpileModule(body + "\nreturn {materials: materialsWithTiers,finishes: finishesWithTiers,products: productsWithPricing};",{compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
const entities = new Function("materialRows","materialTiers","legacyMaterialPrices","finishRows","finishTiers","legacyFinishPrices","productRows","productTiers","productFixedPrices","legacyProductM2Rows",compiled)
  (rows.materials,rows.materialTiers,rows.legacyMaterialPrices,rows.finishes,rows.finishTiers,rows.legacyFinishPrices,rows.products,rows.productTiers,rows.productFixedPrices,rows.legacyProductM2Prices);
const sections = [rows.config.vertical_axis,...rows.config.layout_rows.flatMap(row => row.sections)];
function* combinations(index = 0,selected = {}) {
  if (index === sections.length) {yield selected; return;}
  const section = sections[index];
  for (const value of section.valueIds) yield* combinations(index + 1,{...selected,[section.id]: value});
}
const results = [];
let selectionIndex = 0;
for (const selectedSectionValues of combinations()) {
  const ids = type => sections.filter(section => section.sectionType === type).map(section => selectedSectionValues[section.id]);
  const materialId = ids("materials")[0],finishIds = ids("finishes"),productIds = ids("products");
  for (const quantity of [1,2,5,10]) for (const [widthMm,heightMm] of [[1000,500],[1000,1000],[2000,1000]]) {
    const selection = {materialId,finishIds,productIds,widthMm,heightMm,selectedSectionValues};
    const server = calculateVerifiedStorformatQuote(rows,selection,quantity);
    const storefront = calculateStorformatPrice({widthMm,heightMm,quantity,config: rows.config,
      material: entities.materials.find(row => row.id === materialId),
      finishes: entities.finishes.filter(row => finishIds.includes(row.id)),
      products: entities.products.filter(row => productIds.includes(row.id))});
    assert.equal(server.totalPrice,storefront.totalPrice,JSON.stringify({selection,quantity}));
    assert.equal(server.materialPricePerM2,storefront.materialPricePerM2);
    results.push({selectionIndex,quantity,widthMm,heightMm,totalDkk: server.totalPrice});
  }
  selectionIndex += 1;
}
console.log(JSON.stringify({evidence: "Offline calculation against a read-only aluminum catalog snapshot; frontend assembly and formula compared with server quote; no payment or hosted function call",combinations: results.length,minimumTotalDkk: Math.min(...results.map(row => row.totalDkk)),maximumTotalDkk: Math.max(...results.map(row => row.totalDkk)),results},null,2));
