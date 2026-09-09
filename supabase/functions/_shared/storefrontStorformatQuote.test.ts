import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {calculateStorformatPrice as existingFormula} from "../../../src/utils/storformatPricing.ts";
import {assembleStorformatRows,calculateVerifiedStorformatQuote,loadStorformatQuoteRows,type StorformatQuoteRows} from "./storefrontStorformatQuote.ts";
import {assertQuoteableProduct,calculateVerifiedOptionExtras,roundCheckoutAmounts,verifiedFormatArea} from "./storefrontQuoteAmounts.ts";

const materialId = "11111111-1111-4111-8111-111111111111";
const finishId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
function rows(): StorformatQuoteRows {
  return {
    config: {rounding_step: 1,global_markup_pct: 0,quantities: [1,2,5,10],layout_rows: [],vertical_axis: null},
    materials: [{id: materialId,name: "Material",max_width_mm: 2000,max_height_mm: 1000,allow_split: false,markup_pct: 0,interpolation_enabled: true}],
    materialTiers: [{material_id: materialId,from_m2: 0,to_m2: null,price_per_m2: 100,is_anchor: true,markup_pct: 0}],
    legacyMaterialPrices: [],finishes: [],finishTiers: [],legacyFinishPrices: [],products: [],productTiers: [],productFixedPrices: [],legacyProductM2Prices: [],
  };
}
const selection = () => ({widthMm: 1000,heightMm: 500,materialId,finishIds: [],productIds: [],selectedSectionValues: {"vertical-axis": materialId}});

test("deployment-local formula is exactly the current storefront formula, guarding drift", () => {
  const frontend = readFileSync(new URL("../../../src/utils/storformatPricing.ts",import.meta.url),"utf8");
  const server = readFileSync(new URL("./storefrontStorformatFormula.ts",import.meta.url),"utf8").split("// BEGIN STOREFRONT FORMULA\n")[1];
  assert.equal(server,frontend);
});
test("quote mode verifies source totals without legacy tiers and maps coverage gaps to unavailable checkout prices", () => {
  const data = rows(); data.materialTiers = []; data.config.quantities = [1,2,3,4,5];
  data.products = [{id: productId, name: "Standard", pricing_mode: "fixed", initial_price: 0, markup_pct: 0}];
  data.config.area_pricing_basis = "per_piece_quotes";
  data.config.source_quote_model = {version: 1, currency: "DKK", price_basis: "regular", base_product_ids: [productId],
    combinations: [{material_id: materialId, finish_ids: [], product_ids: [productId],
      points: [13.42,25.87,38.8,51.74].map((price,index) => ({area_m2: 0.96,quantity: index + 1,total_price: price * 13.68}))}]};
  const selected = {...selection(),widthMm: 1200,heightMm: 800,productIds: [productId],
    selectedSectionValues: {"vertical-axis": materialId,"section-products": productId}};
  for (const [index,expected] of [184,354,531,708].entries()) {
    const actual = calculateVerifiedStorformatQuote(data,selected,index + 1,0.96);
    assert.equal(actual.totalPrice,expected);
    assert.equal(actual.source,"storformat_source_quotes_v1");
  }
  assert.throws(() => calculateVerifiedStorformatQuote(data,selected,5),/checkout_storformat_price_missing/);
  assert.throws(() => calculateVerifiedStorformatQuote(data,{...selected,widthMm: 1000},1),/checkout_storformat_price_missing/);
  data.config.source_quote_model = null;
  assert.throws(() => calculateVerifiedStorformatQuote(data,selected,1),/checkout_storformat_price_missing/);
});
test("quote mode finish and fast production selection uses the full matching combination without legacy option rates", () => {
  const data = rows(); data.materialTiers = []; data.config.quantities = [1];
  data.products = [{id: productId,name: "Standard",pricing_mode: "fixed",initial_price: 0},
    {id: otherId,name: "Fast",pricing_mode: "per_m2",markup_pct: 10}];
  data.finishes = [{id: finishId,name: "Matt",pricing_mode: "per_m2",markup_pct: 20}];
  data.config.area_pricing_basis = "per_piece_quotes";
  const combination = (finish_ids: string[],product_ids: string[],total_price: number) =>
    ({material_id: materialId,finish_ids,product_ids,points: [{area_m2: 0.5,quantity: 1,total_price}]});
  data.config.source_quote_model = {version: 1,currency: "DKK",price_basis: "regular",base_product_ids: [productId],
    combinations: [combination([],[productId],100),combination([finishId],[productId],130),combination([finishId],[otherId],150)]};
  const selected = {...selection(),finishIds: [finishId],productIds: [otherId],selectedSectionValues: {
    "vertical-axis": materialId,"section-finishes": finishId,"section-products": otherId}};
  assert.equal(calculateVerifiedStorformatQuote(data,selected,1).totalPrice,158);
  data.config.source_quote_model.combinations.pop();
  assert.throws(() => calculateVerifiedStorformatQuote(data,selected,1),/checkout_storformat_price_missing/);
});
test("Pixart 0.96 m2 uses the first imported rate instead of the 20+ m2 bulk fallback", () => {
  const data = rows(); data.config.quantities = [1,2,3,4];
  const points = [[1,2,178.6608],[2,3,169.7688],[3,5,113.179195],[5,10,164.0232],
    [10,12,162.14904],[12,15,162.165005],[15,20,161.952965],[20,null,161.32824]];
  data.materialTiers = points.map(([from_m2,to_m2,price_per_m2]) =>
    ({material_id: materialId,from_m2,to_m2,price_per_m2,is_anchor: false,markup_pct: 0}));
  const selected = {...selection(),widthMm: 1200,heightMm: 800};
  const material = assembleStorformatRows(data).materials[0];
  for (const [index,expectedTotal] of [172,343,489,435].entries()) {
    const quantity = index + 1;
    const verified = calculateVerifiedStorformatQuote(data,selected,quantity,0.96);
    assert.equal(verified.totalPrice,expectedTotal,`${quantity} piece(s) at 120 x 80 cm`);
    assert.deepEqual(verified,{...existingFormula({...selected,quantity,material,config: data.config}),selection: selected,source: "storformat_existing_formula_v1"});
  }
});
test("below-first rates preserve tier, item and global markup with interpolation off or fewer than two anchors", () => {
  for (const interpolationEnabled of [false,true]) for (const anchorIndex of [-1,0,1]) {
    const data = rows(); data.materials[0].interpolation_enabled = interpolationEnabled;
    data.materials[0].markup_pct = 10; data.config.global_markup_pct = 15; data.config.rounding_step = 5;
    data.materialTiers = [
      {material_id: materialId,from_m2: 1,to_m2: 2,price_per_m2: 100,is_anchor: anchorIndex === 0,markup_pct: 20},
      {material_id: materialId,from_m2: 3,to_m2: 4,price_per_m2: 80,is_anchor: anchorIndex === 1,markup_pct: 10},
    ].reverse();
    const selected = {...selection(),widthMm: 1200,heightMm: 800};
    const result = calculateVerifiedStorformatQuote(data,selected,1,0.96);
    assert.equal(result.materialPricePerM2,132);
    assert.equal(result.totalPrice,145);
    assert.deepEqual(result,{...existingFormula({...selected,quantity: 1,material: assembleStorformatRows(data).materials[0],config: data.config}),selection: selected,source: "storformat_existing_formula_v1"});
  }
});
test("below-first correction preserves inclusive boundaries, gap fallback and above-last behavior", () => {
  for (const interpolationEnabled of [false,true]) for (const anchorIndex of [-1,0,1]) {
    const data = rows(); data.materials[0].interpolation_enabled = interpolationEnabled; data.materials[0].allow_split = true;
    data.materialTiers = [
      {material_id: materialId,from_m2: 1,to_m2: 2,price_per_m2: 100,is_anchor: anchorIndex === 0,markup_pct: 0},
      {material_id: materialId,from_m2: 3,to_m2: 4,price_per_m2: 60,is_anchor: anchorIndex === 1,markup_pct: 0},
    ];
    for (const [area,expectedRate] of [[1,100],[1.5,100],[2,100],[2.001,60],[2.5,60],[3,60],[4,60],[5,60]]) {
      const selected = {...selection(),widthMm: area * 1000,heightMm: 1000};
      const result = calculateVerifiedStorformatQuote(data,selected,1,area);
      assert.equal(result.materialPricePerM2,expectedRate,`${area} m2, interpolation ${interpolationEnabled}, anchor ${anchorIndex}`);
      assert.deepEqual(result,{...existingFormula({...selected,quantity: 1,material: assembleStorformatRows(data).materials[0],config: data.config}),selection: selected,source: "storformat_existing_formula_v1"});
    }
  }
});
test("existing dimension, quantity, tier/item/global markup and rounding calculation is preserved", () => {
  const data = rows(); data.config.global_markup_pct = 15; data.config.rounding_step = 5;
  data.materials[0].markup_pct = 10; data.materialTiers[0].markup_pct = 20;
  const result = calculateVerifiedStorformatQuote(data,selection(),2,0.5);
  assert.equal(result.totalPrice,150); assert.equal(result.areaM2,0.5);
});
test("tier boundaries, interpolation anchors and overridden tiers retain storefront behavior", () => {
  const data = rows(); data.config.quantities = [1,2,5,10,20]; data.materials[0].allow_split = true;
  data.materialTiers = [
    {material_id: materialId,from_m2: 0,to_m2: 1,price_per_m2: 100,is_anchor: true,markup_pct: 0},
    {material_id: materialId,from_m2: 1,to_m2: 10,price_per_m2: 85,is_anchor: false,markup_pct: 0},
    {material_id: materialId,from_m2: 10,to_m2: null,price_per_m2: 60,is_anchor: true,markup_pct: 0},
  ];
  for (const quantity of data.config.quantities) for (const widthMm of [100,1000,1500]) {
    const selected = {...selection(),widthMm};
    const result = calculateVerifiedStorformatQuote(data,selected,quantity);
    const material = assembleStorformatRows(data).materials[0];
    assert.equal(result.totalPrice,existingFormula({...selected,quantity,material,config: data.config}).totalPrice);
  }
  data.materialTiers[1].markup_pct = 15;
  const result = calculateVerifiedStorformatQuote(data,selection(),5);
  assert.equal(result.materialPricePerM2,97.74999999999999);
});
test("fixed finishes and initial-plus-quantity product prices match current formula", () => {
  const data = rows();
  data.finishes = [{id: finishId,name: "Finish",pricing_mode: "fixed",fixed_price_per_unit: 12.5,markup_pct: 20}];
  data.products = [{id: productId,name: "Setup",pricing_mode: "fixed",initial_price: 30,markup_pct: 10}];
  data.productFixedPrices = [{product_item_id: productId,quantity: 2,price: 40}];
  const selected = {...selection(),finishIds: [finishId],productIds: [productId],selectedSectionValues: {"vertical-axis": materialId,"section-finishes": finishId,"section-products": productId}};
  assert.equal(calculateVerifiedStorformatQuote(data,selected,2).totalPrice,207);
  assert.throws(() => calculateVerifiedStorformatQuote(data,selected,5),/quantity_price_missing/);
});
test("primary prices precede legacy data; legacy material/finish/product fallbacks match real component assembly", () => {
  const data = rows(); data.materialTiers = [];
  data.legacyMaterialPrices = [{material_id: materialId,from_m2: 0,to_m2: null,price_per_m2: 80,is_anchor: true}];
  data.finishes = [{id: finishId,name: "Finish",pricing_mode: "per_m2",fixed_price_per_unit: null}];
  data.legacyFinishPrices = [{id: otherId,finish_id: finishId,price_per_m2: 20,fixed_price: 9}];
  data.products = [{id: productId,name: "Print",pricing_mode: "per_m2"}];
  data.legacyProductM2Prices = [{storformat_product_id: productId,from_m2: 0,to_m2: null,price_per_m2: 10,is_anchor: true}];
  // Execute only the existing component's pure row assembly against fixture rows.
  const source = readFileSync(new URL("../../../src/components/product-price-page/StorformatConfigurator.tsx",import.meta.url),"utf8");
  const assembly = source.slice(source.indexOf("const materialsWithTiers ="),source.indexOf("const idsByType:"));
  const compiled = ts.transpileModule(assembly + "\nreturn {materials: materialsWithTiers,finishes: finishesWithTiers,products: productsWithPricing};",{compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
  const original = new Function("materialRows","materialTiers","legacyMaterialPrices","finishRows","finishTiers","legacyFinishPrices","productRows","productTiers","productFixedPrices","legacyProductM2Rows",compiled)
    (data.materials,data.materialTiers,data.legacyMaterialPrices,data.finishes,data.finishTiers,data.legacyFinishPrices,data.products,data.productTiers,data.productFixedPrices,data.legacyProductM2Prices);
  const selected = {...selection(),finishIds: [finishId],productIds: [productId],selectedSectionValues: {"vertical-axis": materialId,"section-finishes": finishId,"section-products": productId}};
  const result = calculateVerifiedStorformatQuote(data,selected,2);
  assert.equal(result.totalPrice,existingFormula({...selected,quantity: 2,material: original.materials[0],finishes: original.finishes,products: original.products,config: data.config}).totalPrice);
  assert.equal(result.totalPrice,110);
  data.materialTiers = [{material_id: materialId,from_m2: 0,to_m2: null,price_per_m2: 150,is_anchor: true}];
  assert.equal(calculateVerifiedStorformatQuote(data,selected,2).totalPrice,180);
});
test("required/optional/free layout sections cannot omit charges or inject components", () => {
  const data = rows(); data.products = [{id: productId,name: "Printing",pricing_mode: "fixed",initial_price: 10},{id: otherId,name: "Free visual",pricing_mode: "fixed",initial_price: 500}];
  data.config.layout_rows = [{sections: [{id: "printing",sectionType: "products",selection_mode: "required",valueIds: [productId]},
    {id: "visual",sectionType: "products",selection_mode: "free",valueIds: [otherId]}]}];
  const selected = {...selection(),productIds: [productId],selectedSectionValues: {"vertical-axis": materialId,printing: productId,visual: otherId}};
  assert.equal(calculateVerifiedStorformatQuote(data,selected,1).totalPrice,60);
  assert.throws(() => calculateVerifiedStorformatQuote(data,{...selected,productIds: []},1),/selection_invalid/);
  assert.throws(() => calculateVerifiedStorformatQuote(data,{...selected,selectedSectionValues: {"vertical-axis": materialId}},1),/required_selection_missing/);
  assert.throws(() => calculateVerifiedStorformatQuote(data,{...selected,productIds: [productId,otherId]},1),/selection_invalid/);
});
test("invalid dimensions, manipulated area, unsupported quantity and missing price are held before payment", () => {
  const data = rows();
  assert.throws(() => calculateVerifiedStorformatQuote(data,{...selection(),widthMm: 2100},1),/dimensions_exceed/);
  assert.throws(() => calculateVerifiedStorformatQuote(data,{...selection(),heightMm: 0},1),/dimensions_invalid/);
  assert.throws(() => calculateVerifiedStorformatQuote(data,selection(),3),/quantity_unavailable/);
  assert.throws(() => calculateVerifiedStorformatQuote(data,selection(),1,0.001),/area_mismatch/);
  data.materialTiers = []; assert.throws(() => calculateVerifiedStorformatQuote(data,selection(),1),/price_missing/);
});
test("matrix/fixed/rate labels share stored price contract; unsupported engines remain blocked", () => {
  for (const pricing_type of ["matrix","fixed","rate","STORFORMAT"]) assertQuoteableProduct({pricing_type,is_published: true,tenant_id: otherId},otherId);
  for (const pricing_type of ["MACHINE_PRICED","custom-dimensions","formula"]) assert.throws(() => assertQuoteableProduct({pricing_type,is_published: true,tenant_id: otherId},otherId),/unsupported/);
});
test("per-area extras use matched format dimensions, preserving current option formula and panel rounding", () => {
  const quote = {formatId: materialId,widthMm: 210,heightMm: 297,areaM2: 0.06237};
  const area = verifiedFormatArea({id: materialId,width_mm: 210,height_mm: 297},quote,{selectionMapFormat: materialId});
  const extras = calculateVerifiedOptionExtras([{extra_price: 10.25,price_mode: "fixed"},{extra_price: 0.2,price_mode: "per_quantity"},{extra_price: 5,price_mode: "per_area"}],100,area);
  assert.equal(extras,61.435);
  assert.deepEqual(roundCheckoutAmounts(100.51,extras,49),{productPriceOre: 10100,optionExtraOre: 6100,shippingOre: 4900,amountOre: 21100});
  assert.throws(() => verifiedFormatArea({id: materialId,width_mm: 210,height_mm: 297},{...quote,areaM2: 0.001},{selectionMapFormat: materialId}),/area_mismatch/);
  assert.throws(() => verifiedFormatArea({id: materialId,width_mm: 210,height_mm: 297},quote,{selectionMapFormat: otherId}),/unverified/);
});

function rowClient(tables: Record<string, any[]>, errors: Record<string, any> = {}) {
  const calls: any[] = [];
  const client = {from: (table: string) => {
    const call = {table, filters: [] as any[], orders: [] as string[], range: [] as number[]};
    calls.push(call);
    const query: any = {select: () => query,eq: (key: string,value: any) => {call.filters.push([key,value]); return query;},
      order: (key: string) => {call.orders.push(key); return query;},
      maybeSingle: async () => ({data: rows().config,error: errors[table] || null}),
      range: async (from: number,to: number) => {
        call.range = [from,to]; return {data: (tables[table] || []).slice(from,to + 1),error: errors[table] || null};
      }};
    return query;
  }};
  return {client,calls};
}
test("catalog loading scopes every read to product and tenant and retrieves every tier page", async () => {
  const f = rowClient({storformat_material_price_tiers: Array.from({length: 1001},(_,id) => ({id}))});
  const loaded = await loadStorformatQuoteRows(f.client,productId,otherId);
  assert.equal(loaded.materialTiers.length,1001);
  assert.deepEqual(f.calls.filter(c => c.table === "storformat_material_price_tiers").map(c => c.range),[[0,999],[1000,1999]]);
  for (const call of f.calls) assert.deepEqual(call.filters,[["product_id",productId],["tenant_id",otherId]]);
  assert.equal(f.calls.some(c => c.table === "storformat_product_m2_prices"),false);
});
test("absent optional legacy table is allowed but permission and required-table errors fail closed", async () => {
  const tables = {storformat_products: [{id: productId,pricing_mode: "per_m2"}]};
  for (const code of ["42P01","PGRST205"]) {
    const f = rowClient(tables,{storformat_product_m2_prices: {code}});
    const loaded = await loadStorformatQuoteRows(f.client,productId,otherId);
    assert.deepEqual(loaded.legacyProductM2Prices,[]);
  }
  const denied = rowClient(tables,{storformat_product_m2_prices: {code: "42501"}});
  await assert.rejects(loadStorformatQuoteRows(denied.client,productId,otherId),/backend_unavailable/);
  const missingRequired = rowClient(tables,{storformat_material_price_tiers: {code: "42P01"}});
  await assert.rejects(loadStorformatQuoteRows(missingRequired.client,productId,otherId),/backend_unavailable/);
});
