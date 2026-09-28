import assert from "node:assert/strict";
import test from "node:test";

import {
  AVAILABILITY_SECTION_IDS,
  SPINES,
  STRATEGIES,
  SpineParityPlanBlockedError,
  applySparseAvailabilityPatch,
  assertSpinePriceParityPlanReady,
  buildSpinePriceParityPlan,
  parseArgs,
} from "../plan-wmd-sales-folder-spine-price-parity.js";

function row({
  model = "a4-standard",
  print = "4+0",
  spine = "1mm",
  paper = "chromo",
  finish = "none",
  quantity = 100,
  finalPriceDkk = 100,
  convertedPriceDkk = 60,
  supplierPrice = convertedPriceDkk / 7.5,
}) {
  return {
    selections: { folder_model: model, print, spine, paper, finish },
    quantity,
    finalPriceDkk,
    convertedPriceDkk,
    supplierPrice,
    supplierCurrency: "EUR",
    conversionRuleKey: "test-rule",
    sourceEvidence: {
      sourceUrl: `https://supplier.example.test/${model}/${finish}/${spine}`,
      rawPricingEvidencePath: "raw/pricing.jsonl",
    },
  };
}

function binding({
  model = "a4-standard",
  print = "4+0",
  spine = "1mm",
  paper = "chromo",
  finish = "none",
}) {
  return {
    documentKey: `${model}-${print}-${spine}-${paper}-${finish}`,
    match: { folder_model: model, print, spine, paper, finish },
    template: {
      sanitizedPdfPath: `documents/${model}-${print}-${spine}-${paper}-${finish}.pdf`,
      sanitizedPdfSha256: spine.padEnd(64, "a").slice(0, 64),
      artworkMode: "online_designer",
    },
  };
}

function bindingsFor(configurations) {
  return configurations.flatMap((configuration) => SPINES.map((spine) => binding({ ...configuration, spine })));
}

test("sparse paper and finishing compatibility is preserved without crossing finish rows", () => {
  const priceRows = [
    row({ finish: "none", finalPriceDkk: 100 }),
    row({ finish: "soft-touch", paper: "silk", finalPriceDkk: 180 }),
    row({ finish: "none", spine: "3mm", finalPriceDkk: 105, convertedPriceDkk: 70 }),
  ];
  const templateBindings = bindingsFor([
    { finish: "none", paper: "chromo" },
    { finish: "soft-touch", paper: "silk" },
  ]);
  const plan = assertSpinePriceParityPlanReady(buildSpinePriceParityPlan({ priceRows, templateBindings }));
  const copy = plan.strategies[STRATEGIES.copy1mm];

  assert.equal(copy.updateRows, 1);
  assert.equal(copy.insertRows, 0);
  assert.equal(plan.suppressedMissingRows.proposedInsertsIntentionallySuppressed, 5);
  assert.equal(copy.deltaByFinish.none, 1);
  assert.equal(copy.deltaByFinish["soft-touch"], undefined);
  const softTouch = copy.delta.filter((item) => item.selections.finish === "soft-touch");
  assert.equal(softTouch.length, 0);
  assert.equal(plan.suppressedMissingRows.byFinish["soft-touch"], 3);
  assert.ok(plan.suppressedMissingRows.configurations.some((item) => (
    item.selections.paper === "silk" && item.selections.finish === "soft-touch"
  )));
  assert.ok(copy.delta.every((item) => item.after.canonical1mmSupplierValues.sourceEvidence.sourceUrl.includes(item.selections.finish)));
});

test("239 differing parity groups produce exactly 274 max-existing updates and no unrelated changes", () => {
  const priceRows = [];
  for (let quantity = 1; quantity <= 239; quantity += 1) {
    const canonicalPrice = 100 + quantity;
    priceRows.push(
      row({ quantity, spine: "1mm", finalPriceDkk: canonicalPrice, convertedPriceDkk: 50 }),
      row({ quantity, spine: "3mm", finalPriceDkk: canonicalPrice - 1, convertedPriceDkk: 55 }),
      row({
        quantity,
        spine: "5mm",
        finalPriceDkk: quantity <= 35 ? canonicalPrice - 1 : canonicalPrice,
        convertedPriceDkk: 57,
      }),
      row({ quantity, spine: "10mm", finalPriceDkk: canonicalPrice, convertedPriceDkk: 59 }),
    );
  }
  const templateBindings = bindingsFor([{ finish: "none", paper: "chromo" }]);
  const plan = assertSpinePriceParityPlanReady(buildSpinePriceParityPlan({ priceRows, templateBindings }));
  const max = plan.strategies[STRATEGIES.maxExisting];

  assert.equal(max.updateRows, 274);
  assert.equal(max.insertRows, 0);
  assert.equal(max.updatedParityGroups, 239);
  assert.equal(max.insertedParityGroups, 0);
  assert.equal(max.changedParityGroups, 239);
  assert.equal(max.delta.length, 274);
  assert.ok(max.delta.every((item) => item.operation === "update"));
  assert.ok(max.delta.every((item) => ["3mm", "5mm"].includes(item.selections.spine)));
  assert.ok(max.delta.every((item) => item.after.targetSupplierValues.convertedPriceDkk === item.before.targetSupplierValues.convertedPriceDkk));
  assert.ok(max.delta.every((item) => item.writeBoundary.length === 1 && item.writeBoundary[0] === "price_dkk"));
});

test("both parity strategies quantify changed and loss-making rows while max-existing stays the reviewed proposal", () => {
  const priceRows = [
    row({ spine: "1mm", finalPriceDkk: 100, convertedPriceDkk: 50 }),
    row({ spine: "3mm", finalPriceDkk: 120, convertedPriceDkk: 110 }),
    row({ spine: "5mm", finalPriceDkk: 90, convertedPriceDkk: 105 }),
  ];
  const templateBindings = bindingsFor([{ finish: "none", paper: "chromo" }]);
  const plan = assertSpinePriceParityPlanReady(buildSpinePriceParityPlan({ priceRows, templateBindings }));
  const copy = plan.strategies[STRATEGIES.copy1mm];
  const max = plan.strategies[STRATEGIES.maxExisting];

  assert.equal(plan.proposedStrategy, STRATEGIES.maxExisting);
  assert.equal(plan.rejectedComparisonStrategy, STRATEGIES.copy1mm);
  assert.equal(plan.commercialDecision.selectedByPlanner, false);
  assert.equal(copy.updateRows, 2);
  assert.equal(copy.insertRows, 0);
  assert.equal(plan.suppressedMissingRows.proposedInsertsIntentionallySuppressed, 1);
  assert.equal(copy.commercialSafety.totals.belowSupplierCostRows, 2);
  assert.equal(copy.commercialSafety.totals.exactTargetSupplierCostRows, 3);
  assert.equal(copy.commercialSafety.totals.canonical1mmProxyCostRows, 0);
  assert.equal(copy.commercialSafety.totals.minimumGrossMarginDkk.grossMarginDkk, -10);
  assert.equal(max.updateRows, 2);
  assert.equal(max.insertRows, 0);
  assert.equal(max.commercialSafety.totals.belowSupplierCostRows, 0);
  assert.equal(max.commercialSafety.totals.minimumGrossMarginDkk.grossMarginDkk, 10);
  const threeMillimeterUpdate = copy.delta.find((item) => item.selections.spine === "3mm");
  assert.equal(threeMillimeterUpdate.before.targetSupplierValues.convertedPriceDkk, 110);
  assert.equal(threeMillimeterUpdate.after.targetSupplierValues.convertedPriceDkk, 110);
  assert.match(
    threeMillimeterUpdate.before.targetSupplierValues.sourceEvidence.sourceUrl,
    /3mm$/,
  );
});

test("absent target rows and templates are intentionally suppressed rather than becoming blockers or inserts", () => {
  const plan = buildSpinePriceParityPlan({
    priceRows: [row({ spine: "1mm" })],
    templateBindings: [binding({ spine: "1mm" })],
  });
  assert.equal(plan.readyForSeparateReviewedWrite, true);
  assert.equal(plan.strategies[STRATEGIES.maxExisting].insertRows, 0);
  assert.equal(plan.suppressedMissingRows.proposedInsertsIntentionallySuppressed, 3);
  assert.equal(plan.suppressedMissingRows.uniqueConfigurations, 3);
  assert.equal(plan.suppressedMissingRows.newTemplateBindingsRequired, 0);
  assert.equal(plan.invariants.newTemplateBindingsRequiredByPlan, 0);
  assert.deepEqual(plan.productStructurePatch.oneMillimeterOnlyModels, [{
    folderModel: "a4-standard",
    availableSpines: ["1mm"],
    hiddenSpines: ["3mm", "5mm", "10mm"],
    reason: "A spine is available only when existing exact price rows and exact template bindings both exist.",
  }]);
  assert.doesNotThrow(() => assertSpinePriceParityPlanReady(plan));
});

test("an existing price configuration without an exact template still blocks the correction", () => {
  const plan = buildSpinePriceParityPlan({
    priceRows: [row({ spine: "1mm" }), row({ spine: "3mm" })],
    templateBindings: [binding({ spine: "1mm" })],
  });
  assert.equal(plan.readyForSeparateReviewedWrite, false);
  assert.equal(
    plan.blockers.find((item) => item.code === "missing_exact_template_bindings_for_existing_price_rows").count,
    1,
  );
  assert.throws(
    () => assertSpinePriceParityPlanReady(plan),
    (error) => error instanceof SpineParityPlanBlockedError
      && /missing_exact_template_bindings_for_existing_price_rows/.test(error.message),
  );
});

test("the dry-run product-structure patch hides only unavailable spines and leaves paper and finishing visible", () => {
  const plan = assertSpinePriceParityPlanReady(buildSpinePriceParityPlan({
    priceRows: [row({ spine: "1mm" })],
    templateBindings: [binding({ spine: "1mm" })],
  }));
  const original = {
    vertical_axis: { id: "sales-folder-paper" },
    layout_rows: [{ columns: [
      { id: "sales-folder-folder_model" },
      { id: AVAILABILITY_SECTION_IDS.spine },
      { id: "sales-folder-finish" },
    ] }],
  };
  const patched = applySparseAvailabilityPatch(original, plan.productStructurePatch);
  assert.equal(original.vertical_axis.hideUnavailableValues, undefined);
  assert.equal(patched.vertical_axis.hideUnavailableValues, undefined);
  const columns = patched.layout_rows[0].columns;
  assert.equal(columns.find((item) => item.id === AVAILABILITY_SECTION_IDS.spine).hide_unavailable_values, true);
  assert.equal(columns.find((item) => item.id === "sales-folder-finish").hideUnavailableValues, undefined);
  assert.deepEqual(plan.productStructurePatch.preservedVisibleCompatibilityAxes, ["paper", "finish"]);
});

test("duplicate price signatures and duplicate exact template bindings are reported as collisions", () => {
  const duplicatePrice = row({ spine: "1mm" });
  const duplicateBinding = binding({ spine: "3mm" });
  const plan = buildSpinePriceParityPlan({
    priceRows: [duplicatePrice, { ...duplicatePrice }],
    templateBindings: [
      binding({ spine: "1mm" }),
      duplicateBinding,
      { ...duplicateBinding },
      binding({ spine: "5mm" }),
      binding({ spine: "10mm" }),
    ],
  });
  assert.equal(plan.blockers.find((item) => item.code === "duplicate_price_signatures").count, 1);
  assert.equal(plan.blockers.find((item) => item.code === "duplicate_template_bindings").count, 1);
  assert.throws(() => assertSpinePriceParityPlanReady(plan), SpineParityPlanBlockedError);
});

test("the command accepts only a local dry-run surface", () => {
  assert.throws(() => parseArgs(["--write"]), /dry-run-only/);
  assert.throws(() => parseArgs(["--confirm-price-correction"]), /dry-run-only/);
  const args = parseArgs(["--run-dir", "/tmp/folder-run"]);
  assert.equal(args.pricesPath, "/tmp/folder-run/review/proposed-price-rows.jsonl");
  assert.equal(args.bindingsPath, "/tmp/folder-run/review/import-template-binding-map.jsonl");
});
