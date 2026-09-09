import assert from "node:assert/strict";
import test from "node:test";

import { planJobPool, type JobPoolSettings } from "./jobPoolOptimizer.ts";

const machine = {
  mode: "SHEET" as const,
  sheet_width_mm: 720,
  sheet_height_mm: 1020,
  margin_left_mm: 10,
  margin_right_mm: 10,
  margin_top_mm: 10,
  margin_bottom_mm: 10,
  duplex_supported: true,
  setup_waste_sheets: 10,
  run_waste_pct: 2,
  setup_time_min: 20,
  sheets_per_hour: 2500,
  machine_rate_per_hour: 600,
};

const material = {
  pricing_mode: "PER_SHEET" as const,
  price_per_sheet: 3.5,
  sheet_width_mm: 700,
  sheet_height_mm: 1000,
};

const inkSet = {
  price_per_ml: 1.1,
  ml_per_m2_at_100pct: 10,
  default_coverage_pct: 30,
  tolerance_pct: 5,
};

const settings: JobPoolSettings = {
  costModel: "DIGITAL_CLICK",
  bleedMm: 3,
  gapMm: 4,
  sides: 2,
  coveragePct: 30,
  targetMarginPct: 40,
  roundingStep: 1,
  clickCostPerSide: 0.12,
};

test("builds one mixed form and shares setup across compatible formats", () => {
  const plan = planJobPool(machine, material, inkSet, [
    { id: "a5", name: "A5 flyer", quantity: 1000, widthMm: 148, heightMm: 210 },
    { id: "a6", name: "A6 flyer", quantity: 2000, widthMm: 105, heightMm: 148 },
  ], settings);

  assert.equal(plan.status, "ready");
  assert.equal(plan.forms.length, 1);
  assert.ok(plan.forms[0].jobs.every((job) => job.slotsPerSheet >= 1));
  assert.ok(plan.forms[0].placements.length > 2);
  assert.ok(plan.pooledCost < plan.standaloneCost);
  assert.ok(plan.materialSheetsSaved > 0);
  assert.equal(plan.setupMinutesSaved, 20);
});

test("keeps every placement inside the printable sheet", () => {
  const plan = planJobPool(machine, material, inkSet, [
    { id: "a4", name: "A4", quantity: 500, widthMm: 210, heightMm: 297 },
    { id: "m65", name: "M65", quantity: 1500, widthMm: 99, heightMm: 210 },
    { id: "square", name: "Kvadrat", quantity: 750, widthMm: 148, heightMm: 148 },
  ], settings);

  assert.equal(plan.status, "ready");
  for (const form of plan.forms) {
    for (const placement of form.placements) {
      assert.ok(placement.xMm >= 0);
      assert.ok(placement.yMm >= 0);
      assert.ok(placement.xMm + placement.widthMm <= form.printableWidthMm);
      assert.ok(placement.yMm + placement.heightMm <= form.printableHeightMm);
    }
  }
});

test("blocks a format that cannot fit the selected raw sheet", () => {
  const plan = planJobPool(machine, material, inkSet, [
    { id: "oversized", name: "For stort skilt", quantity: 10, widthMm: 900, heightMm: 1200 },
  ], settings);

  assert.equal(plan.status, "blocked");
  assert.match(plan.errors.join(" "), /kan ikke være på råarket/i);
});

test("uses material sheet dimensions rather than the machine maximum", () => {
  const plan = planJobPool(machine, {
    ...material,
    sheet_width_mm: 450,
    sheet_height_mm: 320,
  }, inkSet, [
    { id: "a5", name: "A5", quantity: 250, widthMm: 148, heightMm: 210 },
  ], settings);

  assert.equal(plan.status, "ready");
  assert.equal(plan.forms[0].sheetWidthMm, 450);
  assert.equal(plan.forms[0].sheetHeightMm, 320);
});

test("two non-duplex passes cost more machine time than one side", () => {
  const nonDuplexMachine = { ...machine, duplex_supported: false };
  const jobs = [{ id: "a5", name: "A5", quantity: 1000, widthMm: 148, heightMm: 210 }];
  const oneSide = planJobPool(nonDuplexMachine, material, inkSet, jobs, { ...settings, sides: 1 });
  const twoSides = planJobPool(nonDuplexMachine, material, inkSet, jobs, { ...settings, sides: 2 });

  assert.equal(oneSide.status, "ready");
  assert.equal(twoSides.status, "ready");
  assert.ok(twoSides.forms[0].cost.totalTimeMin > oneSide.forms[0].cost.totalTimeMin);
  assert.ok(twoSides.pooledCost > oneSide.pooledCost);
});
