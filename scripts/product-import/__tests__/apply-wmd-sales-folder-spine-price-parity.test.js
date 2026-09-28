import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  EXPECTED_SOURCE_PRICE_SHA256,
  MASTER_TENANT_ID,
  TARGET_PRODUCT_ID,
  TARGET_SLUG,
  assertReadback,
  buildCorrectedProductPatch,
  buildPlannedPriceTargets,
  buildPriceUpdatePayload,
  exactProductPriceCount,
  loadExactTargetPriceRows,
  mapPlanUpdatesToLiveRows,
  parseArgs,
  sha256Json,
  sourceKeyForAttributeValue,
  stableJson,
  validatePlan,
} from "../apply-wmd-sales-folder-spine-price-parity.js";

const PLAN_SHA = "a".repeat(64);
const APPLIED_AT = "2026-09-01T12:00:00.000Z";
const SMALL_EXPECTED = Object.freeze({
  priceRows: 3,
  priceUpdates: 2,
  templateFiles: 2,
  attributeAxes: 5,
  attributeValues: 7,
});

const axisKeys = Object.freeze({
  folder_model: "a4-standard",
  print: "4+0",
  paper: "chromo",
  finish: "none",
});

const ids = Object.freeze({
  folder_model: "value-model",
  print: "value-print",
  paper: "value-paper",
  finish: "value-finish",
  "1mm": "value-spine-1",
  "3mm": "value-spine-3",
  "5mm": "value-spine-5",
});

function targetSupplierValues({ spine, supplierCost }) {
  return {
    supplierPrice: supplierCost / 7.5,
    supplierCurrency: "EUR",
    convertedPriceDkk: supplierCost,
    conversionRuleKey: "wmd-eur-dkk-v1",
    conversionFactor: 7.5,
    tierMultiplier: 1,
    sourceEvidence: {
      sourceUrl: `https://supplier.example.test/${spine}`,
    },
  };
}

function deltaItem({ spine, quantity = 100, before, after, supplierCost }) {
  const supplierValues = targetSupplierValues({ spine, supplierCost });
  return {
    operation: "update",
    priceSignature: `folder_model=a4-standard|print=4%2B0|spine=${spine}|paper=chromo|finish=none|quantity=${quantity}`,
    paritySignature: `folder_model=a4-standard|print=4%2B0|paper=chromo|finish=none|quantity=${quantity}`,
    selections: { ...axisKeys, spine },
    quantity,
    before: { finalPriceDkk: before, targetSupplierValues: structuredClone(supplierValues) },
    after: {
      finalPriceDkk: after,
      supplierValuesWritePolicy: "preserve_exact_target_supplier_values_and_evidence",
      targetSupplierValues: structuredClone(supplierValues),
      canonical1mmSupplierValues: targetSupplierValues({ spine: "1mm", supplierCost: 60 }),
    },
    canonicalPriceSource: {
      strategy: "max_existing_webprinter_price",
      priceSignature: "canonical-1mm",
      spine: "1mm",
      finalPriceDkk: after,
    },
    exactTemplateBinding: {
      documentKey: `template-${spine}`,
      sanitizedPdfPath: `documents/template-${spine}.pdf`,
      sanitizedPdfSha256: spine.padEnd(64, "b").slice(0, 64),
      designerTemplateId: null,
      artworkMode: "professional_upload",
    },
    writeBoundary: ["price_dkk"],
  };
}

function planFixture() {
  const delta = [
    deltaItem({ spine: "3mm", before: 90, after: 100, supplierCost: 70 }),
    deltaItem({ spine: "5mm", before: 95, after: 100, supplierCost: 80 }),
  ];
  return {
    schemaVersion: 1,
    readyForSeparateReviewedWrite: true,
    blockers: [],
    proposedStrategy: "max_existing_webprinter_price",
    inputs: { prices: { sha256: EXPECTED_SOURCE_PRICE_SHA256 } },
    invariants: {
      sparseCompatibilityPreserved: true,
      targetSupplierValuesPreservedOnUpdate: true,
      onlySellingPriceCanonicalized: true,
      missingPriceRowsAreNeverInferred: true,
    },
    before: {
      priceRows: SMALL_EXPECTED.priceRows,
      templateBindingRows: SMALL_EXPECTED.templateFiles,
    },
    strategies: {
      max_existing_webprinter_price: {
        updateRows: SMALL_EXPECTED.priceUpdates,
        insertRows: 0,
        afterRows: SMALL_EXPECTED.priceRows,
        plannedSignatureCollisionCount: 0,
        commercialSafety: { totals: { belowSupplierCostRows: 0 } },
        delta,
      },
    },
  };
}

function pricingSection(axis) {
  return {
    id: `sales-folder-${axis}`,
    sectionId: `sales-folder-${axis}`,
    groupId: `group-${axis}`,
    valueIds: [],
  };
}

function productFixture() {
  return {
    id: TARGET_PRODUCT_ID,
    tenant_id: MASTER_TENANT_ID,
    slug: TARGET_SLUG,
    name: "Salgsmapper med eget design",
    updated_at: "2026-09-01T10:00:00.000Z",
    is_published: false,
    is_available_to_tenants: false,
    is_ready: false,
    pricing_structure: {
      mode: "matrix_layout_v1",
      autoResolveExactCombination: false,
      vertical_axis: pricingSection("paper"),
      layout_rows: [{
        columns: [
          pricingSection("folder_model"),
          pricingSection("print"),
          pricingSection("spine"),
          pricingSection("finish"),
        ],
      }],
      templateBinding: {
        axisSections: Object.fromEntries(
          ["folder_model", "print", "spine", "paper", "finish"]
            .map((axis) => [axis, `sales-folder-${axis}`]),
        ),
      },
    },
    technical_specs: {
      supplierProductKey: TARGET_SLUG,
      priceArtifactSha256: EXPECTED_SOURCE_PRICE_SHA256,
      unrelatedSetting: "preserve-me",
    },
    template_files: [{ id: "template-a" }, { id: "template-b" }],
    unrelated_product_field: "preserve-me",
  };
}

function attributeValuesFixture() {
  return [
    { id: ids.folder_model, product_id: TARGET_PRODUCT_ID, group_id: "group-folder_model", key: "fallback-model", meta: { sourceKey: axisKeys.folder_model } },
    { id: ids.print, product_id: TARGET_PRODUCT_ID, group_id: "group-print", key: axisKeys.print, meta: {} },
    { id: ids.paper, product_id: TARGET_PRODUCT_ID, group_id: "group-paper", key: axisKeys.paper, meta: {} },
    { id: ids.finish, product_id: TARGET_PRODUCT_ID, group_id: "group-finish", key: axisKeys.finish, meta: {} },
    { id: ids["1mm"], product_id: TARGET_PRODUCT_ID, group_id: "group-spine", key: "1mm", meta: { sourceKey: "1mm" } },
    { id: ids["3mm"], product_id: TARGET_PRODUCT_ID, group_id: "group-spine", key: "legacy-3", meta: { sourceKey: "3mm" } },
    { id: ids["5mm"], product_id: TARGET_PRODUCT_ID, group_id: "group-spine", key: "5mm", meta: {} },
  ];
}

function priceRow({ id, spine, price, supplierCost, updatedAt = "2026-09-01T10:00:00.000Z" }) {
  const selectionMap = {
    folder_model: ids.folder_model,
    print: ids.print,
    spine: ids[spine],
    paper: ids.paper,
    finish: ids.finish,
  };
  const variantValueIds = [
    selectionMap.folder_model,
    selectionMap.print,
    selectionMap.spine,
    selectionMap.finish,
  ];
  selectionMap.variantValueIds = variantValueIds;
  return {
    id,
    tenant_id: MASTER_TENANT_ID,
    product_id: TARGET_PRODUCT_ID,
    variant_name: [...variantValueIds].sort().join("|"),
    variant_value: selectionMap.paper,
    quantity: 100,
    price_dkk: price,
    created_at: "2026-08-31T22:00:00.000Z",
    updated_at: updatedAt,
    updated_by: null,
    extra_data: {
      selectionMap,
      variantValueIds,
      supplierPrice: supplierCost / 7.5,
      supplierCurrency: "EUR",
      convertedPriceDkk: supplierCost,
      conversionRuleKey: "wmd-eur-dkk-v1",
      sourceUrl: `https://supplier.example.test/${spine}`,
      noInterpolation: true,
    },
  };
}

function stateFixture() {
  return {
    product: productFixture(),
    attributeValues: attributeValuesFixture(),
    priceRowCount: 3,
    targetPrices: [
      priceRow({ id: "price-3", spine: "3mm", price: 90, supplierCost: 70 }),
      priceRow({ id: "price-5", spine: "5mm", price: 95, supplierCost: 80 }),
    ],
  };
}

test("confirmed writer requires exact product, slug, plan and source-artifact guards", () => {
  const valid = [
    "--confirm-write",
    "--expected-product-id", TARGET_PRODUCT_ID,
    "--expected-slug", TARGET_SLUG,
    "--expected-plan-sha256", PLAN_SHA,
    "--expected-source-price-sha256", EXPECTED_SOURCE_PRICE_SHA256,
  ];
  assert.throws(() => parseArgs(valid.filter((item) => item !== "--confirm-write")), /confirm-write/);
  assert.throws(() => parseArgs(valid.with(2, "00000000-0000-4000-8000-000000000001")), /product id must be exactly/i);
  assert.throws(() => parseArgs(valid.with(4, "another-product")), /slug must be exactly/i);
  assert.throws(() => parseArgs(valid.with(6, "not-a-hash")), /SHA-256/);
  assert.throws(() => parseArgs(valid.with(8, "b".repeat(64))), /source price SHA-256 must be exactly/i);
  const parsed = parseArgs(valid);
  assert.equal(parsed.expectedProductId, TARGET_PRODUCT_ID);
  assert.equal(parsed.expectedPlanSha256, PLAN_SHA);
});

test("plan guard admits only the reviewed 274-row max-existing policy shape", () => {
  const plan = planFixture();
  assert.equal(validatePlan(plan, { expected: SMALL_EXPECTED }).delta.length, 2);

  const unsafe = structuredClone(plan);
  unsafe.strategies.max_existing_webprinter_price.delta[0].after.finalPriceDkk = 65;
  assert.throws(() => validatePlan(unsafe, { expected: SMALL_EXPECTED }), /lower an existing Webprinter price/);

  const sourceMutation = structuredClone(plan);
  sourceMutation.strategies.max_existing_webprinter_price.delta[0].after.targetSupplierValues.sourceEvidence.sourceUrl = "changed";
  assert.throws(() => validatePlan(sourceMutation, { expected: SMALL_EXPECTED }), /supplier evidence/);
});

test("source keys map through meta.sourceKey or key and exact selectionMap signatures", () => {
  const state = stateFixture();
  assert.equal(sourceKeyForAttributeValue(state.attributeValues[0]), axisKeys.folder_model);
  assert.equal(sourceKeyForAttributeValue(state.attributeValues[1]), axisKeys.print);
  const mapped = mapPlanUpdatesToLiveRows({
    plan: planFixture(),
    product: state.product,
    attributeValues: state.attributeValues,
    prices: state.targetPrices,
    expected: SMALL_EXPECTED,
  });
  assert.deepEqual(mapped.map((item) => item.id), ["price-3", "price-5"]);
  assert.deepEqual(mapped.map((item) => item.afterPriceDkk), [100, 100]);
  assert.ok(mapped.every((item) => item.sourceEvidenceSha256 === sha256Json(
    state.targetPrices.find((row) => row.id === item.id).extra_data,
  )));

  const wrongSignature = structuredClone(state);
  wrongSignature.targetPrices[0].extra_data.selectionMap.paper = "another-paper-id";
  assert.throws(() => mapPlanUpdatesToLiveRows({
    plan: planFixture(),
    product: wrongSignature.product,
    attributeValues: wrongSignature.attributeValues,
    prices: wrongSignature.targetPrices,
    expected: SMALL_EXPECTED,
  }), /vertical paper ID disagrees/);
});

test("product patch changes only pricing_structure and technical_specs and keeps the product unpublished", () => {
  const product = productFixture();
  const patch = buildCorrectedProductPatch({
    product,
    plan: planFixture(),
    planSha256: PLAN_SHA,
    appliedAt: APPLIED_AT,
    expected: SMALL_EXPECTED,
  });
  assert.deepEqual(Object.keys(patch).sort(), ["pricing_structure", "technical_specs"]);
  assert.equal(product.pricing_structure.autoResolveExactCombination, false);
  assert.equal(patch.pricing_structure.autoResolveExactCombination, true);
  const spineSection = patch.pricing_structure.layout_rows[0].columns
    .find((section) => section.id === "sales-folder-spine");
  assert.equal(spineSection.hideUnavailableValues, true);
  assert.equal(patch.technical_specs.unrelatedSetting, "preserve-me");
  assert.equal(patch.technical_specs.spinePriceParityPolicy.strategy, "max_existing_webprinter_price");
  assert.equal(patch.technical_specs.spinePriceParityPolicy.updatedRows, 2);
  assert.equal(product.template_files.length, 2);
  assert.deepEqual(buildPriceUpdatePayload({ afterPriceDkk: 123.45 }), { price_dkk: 123.45 });
});

test("readback proves exact price count, 2 scoped updates, source evidence, templates and flags", () => {
  const before = stateFixture();
  const plan = planFixture();
  const mapped = mapPlanUpdatesToLiveRows({
    plan,
    product: before.product,
    attributeValues: before.attributeValues,
    prices: before.targetPrices,
    expected: SMALL_EXPECTED,
  });
  const patch = buildCorrectedProductPatch({
    product: before.product,
    plan,
    planSha256: PLAN_SHA,
    appliedAt: APPLIED_AT,
    expected: SMALL_EXPECTED,
  });
  const after = structuredClone(before);
  after.product = {
    ...after.product,
    ...patch,
    updated_at: "2026-09-01T12:01:00.000Z",
  };
  after.targetPrices.find((row) => row.id === "price-3").price_dkk = 100;
  after.targetPrices.find((row) => row.id === "price-3").updated_at = "2026-09-01T12:01:00.000Z";
  after.targetPrices.find((row) => row.id === "price-5").price_dkk = 100;
  after.targetPrices.find((row) => row.id === "price-5").updated_at = "2026-09-01T12:01:00.000Z";

  const readback = assertReadback({
    before,
    after,
    mappedUpdates: mapped,
    expectedProductPatch: patch,
    expected: SMALL_EXPECTED,
  });
  assert.equal(readback.verifiedPriceUpdates, 2);
  assert.equal(readback.unchangedPriceRowCount, 3);
  assert.equal(readback.templateFiles, 2);
  assert.equal(readback.sourceEvidenceUnchanged, true);

  const tampered = structuredClone(after);
  tampered.targetPrices[0].extra_data.sourceUrl = "https://attacker.example.test";
  assert.throws(() => assertReadback({
    before,
    after: tampered,
    mappedUpdates: mapped,
    expectedProductPatch: patch,
    expected: SMALL_EXPECTED,
  }), /source evidence|column other than/i);
});

test("writer source has no insert, upsert or delete call on any database table", () => {
  const source = fs.readFileSync(
    new URL("../apply-wmd-sales-folder-spine-price-parity.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\.insert\s*\(/);
  assert.doesNotMatch(source, /\.upsert\s*\(/);
  assert.doesNotMatch(source, /\.delete\s*\(/);
  assert.match(source, /\.from\("generic_product_prices"\)\s*\n\s*\.update\(payload\)/);
  assert.match(source, /\.from\("products"\)\s*\n\s*\.update\(patch\)/);
  assert.doesNotMatch(source, /\.range\s*\(/);
  assert.doesNotMatch(source, /\.gt\s*\(/);
  assert.doesNotMatch(source, /fetchAll|loadTargetState/);
  assert.equal((source.match(/\.from\("generic_product_prices"\)/g) || []).length, 3,
    "generic_product_prices may be touched only by exact count, exact target read and guarded target update");
  assert.match(source, /\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(source, /\.eq\("variant_name", target\.variantName\)[\s\S]*\.eq\("variant_value", target\.variantValue\)[\s\S]*\.eq\("quantity", target\.quantity\)[\s\S]*\.maybeSingle\(\)/);
  assert.ok(stableJson(["price_dkk"]) === '["price_dkk"]');
});

test("target reads use only exact unique price keys plus one head count", async () => {
  const fixture = stateFixture();
  const targets = buildPlannedPriceTargets({
    plan: planFixture(),
    product: fixture.product,
    attributeValues: fixture.attributeValues,
    expected: SMALL_EXPECTED,
  });
  const calls = [];
  const client = {
    from(table) {
      const state = { table, filters: [], selectOptions: null };
      const builder = {
        select(columns, options) {
          state.columns = columns;
          state.selectOptions = options || null;
          return builder;
        },
        eq(column, value) {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle() {
          calls.push(structuredClone(state));
          const filters = Object.fromEntries(state.filters);
          const row = fixture.targetPrices.find((candidate) => (
            candidate.variant_name === filters.variant_name
              && candidate.variant_value === filters.variant_value
              && candidate.quantity === filters.quantity
          ));
          return Promise.resolve({ data: row || null, error: null });
        },
        then(resolve, reject) {
          calls.push(structuredClone(state));
          return Promise.resolve({ data: null, count: fixture.priceRowCount, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  const rows = await loadExactTargetPriceRows(client, targets, { batchSize: 1 });
  assert.deepEqual(rows.map((row) => row.id), ["price-3", "price-5"]);
  assert.equal(await exactProductPriceCount(client), 3);

  const targetCalls = calls.filter((call) => call.selectOptions === null);
  assert.equal(targetCalls.length, 2);
  for (const call of targetCalls) {
    const filters = Object.fromEntries(call.filters);
    assert.equal(filters.tenant_id, MASTER_TENANT_ID);
    assert.equal(filters.product_id, TARGET_PRODUCT_ID);
    assert.ok(filters.variant_name);
    assert.equal(filters.variant_value, ids.paper);
    assert.equal(filters.quantity, 100);
  }
  const countCall = calls.find((call) => call.selectOptions?.head === true);
  assert.deepEqual(countCall.selectOptions, { count: "exact", head: true });
});
