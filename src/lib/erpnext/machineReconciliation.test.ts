import assert from "node:assert/strict";
import test from "node:test";

import { simulateMachineCost } from "../pricing/machineCostSimulator.ts";
import { buildErpShadowEvent } from "./shadowContract.ts";
import { reconcileMachineCalculation } from "./machineReconciliation.ts";

test("reconciles sheet waste and machine time without enabling ERP posting", () => {
  const calculation = simulateMachineCost(
    {
      mode: "SHEET",
      sheet_width_mm: 450,
      sheet_height_mm: 320,
      margin_left_mm: 5,
      margin_right_mm: 5,
      margin_top_mm: 5,
      margin_bottom_mm: 5,
      duplex_supported: true,
      setup_waste_sheets: 10,
      run_waste_pct: 2,
      setup_time_min: 8,
      sheets_per_hour: 1200,
      machine_rate_per_hour: 450,
    },
    {
      pricing_mode: "PER_SHEET",
      price_per_sheet: 2.25,
      sheet_width_mm: 450,
      sheet_height_mm: 320,
    },
    {
      price_per_ml: 0,
      ml_per_m2_at_100pct: 0,
      default_coverage_pct: 0,
      tolerance_pct: 0,
    },
    {
      costModel: "DIGITAL_CLICK",
      quantity: 100,
      widthMm: 210,
      heightMm: 297,
      bleedMm: 3,
      gapMm: 4,
      sides: 1,
      coveragePct: 0,
      targetMarginPct: 35,
      clickCostPerSide: 0.12,
    },
  );

  const line = reconcileMachineCalculation({
    sourceOrderItemId: "line-1",
    sourceProductId: "folder-a4",
    title: "A4 folder",
    quantity: 100,
    unitSellingPrice: 12.49,
    selectedOptions: { paper: "350g silk" },
    productionRecipeRef: "folder-a4-v1",
    machineProfileRef: "digital-sheet-1",
    primaryMaterialRef: "sheet-450x320-350g-silk",
    primaryMaterialUnit: "sheet",
    calculation,
  });

  assert.equal(line.materialRequirements[0].quantity, calculation.totalUnits);
  assert.equal(line.estimatedRunMinutes, calculation.totalTimeMin);

  const event = buildErpShadowEvent({
    tenantId: "tenant-1",
    orderId: "order-1",
    revision: 0,
    occurredAt: "2026-07-27T12:00:00.000Z",
    currency: "DKK",
    totalSellingPrice: 1249,
    fulfillmentMode: "internal",
    lines: [line],
  });

  assert.equal(event.effect, "shadow_only");
  assert.equal(event.payload.production.inventoryPosting, "disabled");
  assert.equal(event.payload.accounting.posting, "disabled");
  assert.equal(
    event.payload.lines[0].materialRequirements[0].quantity,
    calculation.totalUnits,
  );
});

test("maps roll calculations to consumed linear meters", () => {
  const calculation = simulateMachineCost(
    {
      mode: "ROLL",
      roll_width_mm: 1370,
      margin_left_mm: 10,
      margin_right_mm: 10,
      setup_waste_sheets: 1,
      run_waste_pct: 3,
      setup_time_min: 5,
      m2_per_hour: 20,
      machine_rate_per_hour: 300,
    },
    {
      pricing_mode: "PER_M2",
      price_per_m2: 30,
    },
    {
      price_per_ml: 1.25,
      ml_per_m2_at_100pct: 12,
      default_coverage_pct: 45,
      tolerance_pct: 5,
    },
    {
      costModel: "INKJET",
      quantity: 20,
      widthMm: 210,
      heightMm: 297,
      bleedMm: 3,
      gapMm: 5,
      sides: 1,
      coveragePct: 45,
      targetMarginPct: 40,
    },
  );

  const line = reconcileMachineCalculation({
    sourceOrderItemId: "line-roll-1",
    sourceProductId: "poster-a4",
    title: "A4 posters",
    quantity: 20,
    unitSellingPrice: 25,
    machineProfileRef: "wide-format-1",
    primaryMaterialRef: "poster-roll-1370",
    primaryMaterialUnit: "meter",
    calculation,
  });

  assert.equal(
    line.materialRequirements[0].quantity,
    calculation.consumedLengthM,
  );
});
