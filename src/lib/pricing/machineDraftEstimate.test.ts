import test from "node:test";
import assert from "node:assert/strict";
import { estimateMachineDraft } from "./machineDraftEstimate.ts";

const machine = {
  mode: "SHEET" as const, sheet_width_mm: 450, sheet_height_mm: 320,
  margin_left_mm: 5, margin_right_mm: 5, margin_top_mm: 5, margin_bottom_mm: 5,
  setup_waste_sheets: 10, run_waste_pct: 2, setup_time_min: 8,
  sheets_per_hour: 1200, machine_rate_per_hour: 450,
};
const job = { widthMm: 210, heightMm: 297, quantity: 100, bleedMm: 3, gapMm: 2, cuttingMinutes: 0, cuttingRatePerHour: 0 };

test("live A4 and rotated A5 counts use the existing cost simulator", () => {
  const a4 = estimateMachineDraft(machine, job);
  const a5 = estimateMachineDraft(machine, { ...job, widthMm: 148, heightMm: 210 });
  assert.equal(a4.result.itemsPerSheet, 2);
  assert.equal(a4.result.totalUnits, 61);
  assert.equal(a4.totalCost, 82.875);
  assert.equal(a5.result.itemsPerSheet, 4);
  assert.equal(a5.result.orientation, 90);
  assert.equal(a5.result.totalUnits, 36);
  assert.ok(Math.abs(a5.totalCost! - 73.5) < 0.000001);
});

test("blank data, impossible format and zero quantity never show a setup-only price", () => {
  for (const [draft, input] of [
    [{ ...machine, sheet_width_mm: 0 }, job],
    [{ ...machine, sheets_per_hour: 0 }, job],
    [{ ...machine, machine_rate_per_hour: 0 }, job],
    [machine, { ...job, widthMm: 999 }],
    [machine, { ...job, quantity: 0 }],
  ] as const) {
    const value = estimateMachineDraft(draft, input);
    assert.equal(value.ready, false);
    assert.equal(value.totalCost, null);
    assert.equal(value.unitCost, null);
    assert.ok(value.missing.length > 0);
  }
});

test("cutting time contributes separately and requires its own hourly rate", () => {
  const original = structuredClone(machine);
  const withCutting = estimateMachineDraft(machine, { ...job, cuttingMinutes: 15, cuttingRatePerHour: 300 });
  assert.equal(withCutting.cuttingCost, 75);
  assert.equal(withCutting.totalCost, 157.875);
  assert.equal(withCutting.unitCost, 1.57875);
  assert.deepEqual(machine, original);
  assert.equal(estimateMachineDraft(machine, { ...job, cuttingMinutes: 15 }).ready, false);
});

test("roll result reports columns and consumed length, with the existing area-speed cost", () => {
  const estimate = estimateMachineDraft({ ...machine, mode: "ROLL", roll_width_mm: 1370, m2_per_hour: 20 }, job);
  assert.equal(estimate.ready, true);
  assert.ok(estimate.result.columns > 0);
  assert.ok(estimate.result.consumedLengthM > 0);
  assert.equal(estimate.result.itemsPerSheet, estimate.result.columns);
  assert.equal(estimate.totalCost, estimate.result.machineCost);
});

test("transient negative margins or test values cannot produce an overstated fit or price", () => {
  const negativeMargin = estimateMachineDraft({ ...machine, margin_left_mm: -500 }, job);
  assert.equal(negativeMargin.ready, false);
  assert.equal(negativeMargin.result.itemsPerSheet, 2);
  assert.equal(negativeMargin.totalCost, null);
  for (const input of [{ ...job, bleedMm: -30 }, { ...job, cuttingMinutes: -5 }, { ...job, quantity: 1.5 }]) {
    assert.equal(estimateMachineDraft(machine, input).ready, false);
  }
});
