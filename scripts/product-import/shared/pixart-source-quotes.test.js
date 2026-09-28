import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertNewPixartImportTarget, assertPixartEurSourceUrl, assertPixartSettledDimensions, bindPixartSourceQuoteModel, buildPixartSourceQuotePlan, normalizePixartLamination, PIXART_FLAT_URL, REGULAR_PRICE_BASIS, summarizePixartSourceQuotePlan } from "./pixart-source-quotes.js";

const ids = { materialIds: { matt: "11111111-1111-4111-8111-111111111111" }, finishIds: { "standard matt": "22222222-2222-4222-8222-222222222222" },
  productIds: { "standard-delivery": "33333333-3333-4333-8333-333333333333", "fast-delivery": "44444444-4444-4444-8444-444444444444" } };
function fixture() {
  const rows = [];
  for (const lamination of ["None", "Standard Matt"]) for (const area_m2 of [1, 2]) for (const quantity of [1, 2, 3]) {
    const cheapest_quote_eur = (10 + area_m2 * 4) * quantity + (lamination === "None" ? 0 : 3 * quantity);
    const fastest_quote_eur = cheapest_quote_eur + 5;
    rows.push({ material: "Matt", lamination, area_m2, width_cm: 100, height_cm: area_m2 * 100, quantity,
      cheapest_quote_eur, fastest_quote_eur, cheapest_price_per_m2_eur: Number((cheapest_quote_eur / area_m2 / quantity).toFixed(6)),
      fastest_price_per_m2_eur: Number((fastest_quote_eur / area_m2 / quantity).toFixed(6)), error: null });
  }
  return { meta: { url: PIXART_FLAT_URL, extracted_at: "2026-09-09T12:00:00Z", currency: "EUR", price_basis: REGULAR_PRICE_BASIS,
    materials_used: ["Matt"], laminations_used: ["None", "Standard Matt"], areas_used_m2: [1, 2], quantities_used: [1, 2, 3] }, missing: {}, rows };
}
test("two square metres times one and one square metre times two remain distinct full quotes", () => {
  const plan = buildPixartSourceQuotePlan(fixture());
  const points = plan.combinations.find(combo => combo.lamination === "None" && combo.delivery === "standard-delivery").points;
  assert.equal(points.find(point => point.area_m2 === 2 && point.quantity === 1).total_price, 246.24);
  assert.equal(points.find(point => point.area_m2 === 1 && point.quantity === 2).total_price, 383.04);
  assert.equal(points.length, 6);
});
test("full paid-finish and fast-delivery quotes bind to the actual stable selection IDs", () => {
  const model = bindPixartSourceQuoteModel(buildPixartSourceQuotePlan(fixture()), ids);
  assert.deepEqual(model.base_product_ids, [ids.productIds["standard-delivery"]]);
  const combo = model.combinations.find(combo => combo.finish_ids.length && combo.product_ids[0] === ids.productIds["fast-delivery"]);
  assert.equal(combo.material_id, ids.materialIds.matt); assert.deepEqual(combo.finish_ids, [ids.finishIds["standard matt"]]);
  assert.equal(combo.points.find(point => point.quantity === 1 && point.area_m2 === 1).total_price, 22 * 13.68);
});
test("missing coverage, duplicates, source failures and inconsistent geometry or quote math fail closed", () => {
  for (const mutate of [data => data.rows.pop(), data => data.rows.push({ ...data.rows[0] }), data => { data.rows[0].error = "supplier-input-invalid"; },
    data => { data.rows[0].area_m2 = 20; }, data => { data.rows[0].cheapest_price_per_m2_eur = 123; }, data => { data.rows[0].cheapest_quote_eur = null; }]) {
    const data = fixture(); mutate(data); assert.throws(() => buildPixartSourceQuotePlan(data), /source quotes rejected/);
  }
});
test("regular price basis and explicit EUR provenance are mandatory; promotions are excluded in review", () => {
  const data = fixture(); delete data.meta.price_basis; assert.throws(() => buildPixartSourceQuotePlan(data), /regular-price-basis-not-declared/);
  data.meta.price_basis = "regular"; delete data.meta.currency; assert.throws(() => buildPixartSourceQuotePlan(data), /source-currency/);
  const plan = buildPixartSourceQuotePlan(data, { sourceCurrency: "EUR" });
  const summary = summarizePixartSourceQuotePlan(plan);
  assert.equal(summary.source.temporary_promotions_included, false); assert.equal(summary.source.currency_basis, "explicit_import_argument");
  assert.equal(summary.area_pricing_basis, "per_piece_quotes"); assert.equal(summary.coverage.declared, 12);
});
test("paid finishes need matching None source coverage rather than an invented base delta", () => {
  const data = fixture(); data.rows = data.rows.filter(row => row.lamination !== "None"); data.meta.laminations_used = ["Standard Matt"];
  assert.throws(() => buildPixartSourceQuotePlan(data), /no-finish-baseline-missing/);
});
test("exact non-Cartesian coverage permits a supplementary size without inventing quantity points", () => {
  const data = fixture(); data.rows = data.rows.filter(row => row.lamination === "None" && row.quantity === 1);
  data.rows[0] = { ...data.rows[0], area_m2: 0.96, width_cm: 120, height_cm: 80,
    cheapest_price_per_m2_eur: Number((14 / 0.96).toFixed(6)), fastest_price_per_m2_eur: Number((19 / 0.96).toFixed(6)) };
  data.meta.quote_coverage = data.rows.map(({ material, lamination, area_m2, quantity }) => ({ material, lamination, area_m2, quantity }));
  const plan = buildPixartSourceQuotePlan(data);
  assert.equal(plan.coverage.valid, 2); assert.deepEqual(plan.quantities, [1]);
  assert.deepEqual(plan.combinations[0].points.map(point => point.area_m2), [0.96, 2]);
});
test("temporary/missing IDs and mapping collisions cannot become a writable model", () => {
  const plan = buildPixartSourceQuotePlan(fixture());
  assert.throws(() => bindPixartSourceQuoteModel(plan, { ...ids, materialIds: { matt: "preview-matt" } }), /invalid material UUID/);
  assert.throws(() => bindPixartSourceQuoteModel(plan, { ...ids, finishIds: {} }), /invalid finish UUID/);
  assert.throws(() => bindPixartSourceQuoteModel(plan, { ...ids, productIds: { ...ids.productIds, "fast-delivery": ids.productIds["standard-delivery"] } }), /collide/);
});
test("UV parentheses and no-lamination aliases bind with the same normalization as importer option IDs", () => {
  const data = fixture(); data.meta.laminations_used = ["No lamination", "UV filter (5) Matt"];
  data.rows.forEach(row => { row.lamination = row.lamination === "None" ? "No lamination" : "UV filter (5) Matt"; });
  const plan = buildPixartSourceQuotePlan(data);
  const model = bindPixartSourceQuoteModel(plan, { ...ids, finishIds: { "uv filter 5 matt": ids.finishIds["standard matt"] } });
  assert.equal(normalizePixartLamination("UV filter (5) Matt"), "uv filter 5 matt");
  assert.equal(model.combinations.filter(combo => combo.finish_ids.length === 0).length, 2);
  assert.equal(model.combinations.filter(combo => combo.finish_ids[0] === ids.finishIds["standard matt"]).length, 2);
});
test("regional URLs cannot be silently relabelled as EUR, even with an expected-source override", () => {
  assert.doesNotThrow(() => assertPixartEurSourceUrl(PIXART_FLAT_URL));
  const regional = "https://www.pixartprinting.co.uk/wide-format/printing-self-adhesive-pvc/flat-surface-adhesive/";
  assert.throws(() => assertPixartEurSourceUrl(regional), /arbitrary regional URL/);
  const data = fixture(); data.meta.url = regional;
  assert.throws(() => buildPixartSourceQuotePlan(data, { sourceUrl: regional }), /arbitrary regional URL/);
});
test("existing product guard blocks ID recreation before any write", () => {
  assert.doesNotThrow(() => assertNewPixartImportTarget(null));
  assert.throws(() => assertNewPixartImportTarget({ id: "existing-published-product" }), /refusing to recreate/);
});
test("late supplier validation and a 1500 to 1497 cm clamp fail before any quote is trusted", () => {
  assert.doesNotThrow(() => assertPixartSettledDimensions({ widthCm: 100, heightCm: 100, errors: [] }, { widthCm: 100, heightCm: 100 }));
  assert.throws(() => assertPixartSettledDimensions({ widthCm: 100, heightCm: 1500, errors: ["Maximum height 1497 cm"] }, { widthCm: 100, heightCm: 1500 }), /validation-error/);
  assert.throws(() => assertPixartSettledDimensions({ widthCm: 100, heightCm: 1497, errors: [] }, { widthCm: 100, heightCm: 1500 }), /dimensions-changed/);
});

// Exercise the real importer orchestration with an in-memory Supabase boundary.
// This verifies write ordering and refusal paths; it does not claim a hosted transaction test.
function importHarness({ existing = false, missingColumns = false, configFailure = false } = {}) {
  const writes = [];
  const productId = "55555555-5555-4555-8555-555555555555";
  const client = { from(table) {
    let operation = "read";
    const query = {
      select() { return query; }, eq() { return query; },
      limit() { return Promise.resolve({ error: missingColumns ? { message: "source_quote_model column missing" } : null, data: [] }); },
      maybeSingle() { return Promise.resolve({ error: null, data: existing ? { id: productId } : null }); },
      single() { return Promise.resolve({ error: null, data: { id: productId } }); },
      insert(payload) { operation = "insert"; writes.push({ table, operation, payload }); return query; },
      update(payload) { operation = "update"; writes.push({ table, operation, payload }); return query; },
      delete() { operation = "delete"; writes.push({ table, operation }); return query; },
      upsert(payload) { operation = "upsert"; writes.push({ table, operation, payload }); return query; },
      then(resolve) { return Promise.resolve({ error: configFailure && table === "storformat_configs" && operation === "upsert" ? { message: "config write failed" } : null }).then(resolve); },
    };
    return query;
  } };
  const source = readFileSync(new URL("../../fetch-pixart-flat-surface-adhesive-import.mjs", import.meta.url), "utf8");
  const functionSource = source.slice(source.indexOf("async function runImport(args)"), source.indexOf("function selectedRigidsPricePerM2"));
  assert.ok(functionSource.startsWith("async function runImport(args)"));
  const norm = value => String(value || "").trim().toLowerCase();
  const dependencies = {
    resolveInputPath: () => "synthetic-source.json", readJsonFile: () => fixture(), buildPixartSourceQuotePlan,
    parseImportRows: payload => payload.rows, normalizeLabel: value => String(value || "").trim(), normalizeKey: norm,
    normalizeLaminationKey: norm, NONE_LAMINATION_KEY: "none", materialGroupLabel: () => "PVC", finishDisplayNameFromLamination: value => value,
    getProfileDefaults: () => ({ productName: "Fixture", productSlug: "fixture" }), PROFILE_FLAT: "flat-surface-adhesive", slugify: value => norm(value),
    summarizePixartSourceQuotePlan, createSupabaseServiceClient: () => client, DEFAULT_CATEGORY: "storformat",
    DEFAULT_TENANT_ID: "00000000-0000-0000-0000-000000000000", assertNewPixartImportTarget, bindPixartSourceQuoteModel,
    console: { log() {}, warn() {} }, crypto: globalThis.crypto,
  };
  const runImport = new Function(...Object.keys(dependencies), `return (${functionSource});`)(...Object.values(dependencies));
  return { writes, run: () => runImport({ pricingMode: "per-piece-quotes", eurToDkk: 7.6, markupPct: 80, url: PIXART_FLAT_URL,
    roundingStep: 1, priceColumn: "cheapest", productName: "Fixture", productSlug: "fixture", tenantId: dependencies.DEFAULT_TENANT_ID, publish: true }) };
}
test("real importer refuses missing quote columns and existing products before writes", async () => {
  for (const options of [{ missingColumns: true }, { existing: true }]) {
    const harness = importHarness(options);
    await assert.rejects(harness.run(), options.missingColumns ? /migration preflight/ : /refusing to recreate/);
    assert.deepEqual(harness.writes, []);
  }
});
test("new quote import binds actual inserted IDs and publishes only after the complete config", async () => {
  const harness = importHarness(); await harness.run();
  const productInsert = harness.writes.find(write => write.table === "products" && write.operation === "insert");
  assert.equal(productInsert.payload.is_published, false);
  const configWrite = harness.writes.find(write => write.table === "storformat_configs" && write.operation === "upsert");
  const materialRows = harness.writes.find(write => write.table === "storformat_materials" && write.operation === "insert").payload;
  const productionRows = harness.writes.find(write => write.table === "storformat_products" && write.operation === "insert").payload;
  assert.equal(configWrite.payload.area_pricing_basis, "per_piece_quotes");
  assert.ok(configWrite.payload.source_quote_model.combinations.every(combo => materialRows.some(row => row.id === combo.material_id)
    && combo.product_ids.every(id => productionRows.some(row => row.id === id))));
  assert.deepEqual(harness.writes.at(-1), { table: "products", operation: "update", payload: { is_published: true } });
});
test("a failed quote config write leaves the new product unpublished", async () => {
  const harness = importHarness({ configFailure: true });
  await assert.rejects(harness.run(), /config write failed/);
  assert.ok(!harness.writes.some(write => write.table === "products" && write.operation === "update" && write.payload.is_published));
});
