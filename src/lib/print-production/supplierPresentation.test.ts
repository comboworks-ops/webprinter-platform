import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupplierPresentation,
  isSupplierPricingComplete,
} from "./supplierPresentation.ts";

test("guided mode hides technical controls and auto-publishes a validated catalog item", () => {
  assert.deepEqual(getSupplierPresentation("guided"), {
    showPresets: false,
    showApiLimits: false,
    showRegionCurrency: false,
    showBatchToggle: false,
    matrixInitiallyExpanded: false,
    autoPublishDefault: true,
  });
});

test("advanced mode preserves the current POD v2 workbench", () => {
  const result = getSupplierPresentation("advanced");
  assert.equal(result.showPresets, true);
  assert.equal(result.showApiLimits, true);
  assert.equal(result.matrixInitiallyExpanded, true);
  assert.equal(result.autoPublishDefault, false);
});

const completeMatrixRow = () => ({
  needs_quote: false,
  quantities: [10, 25],
  base_costs: [100, 180],
  recommended_retail: [125, 225],
});

test("pricing is complete when every offered matrix row has finite aligned cells", () => {
  assert.equal(isSupplierPricingComplete([
    completeMatrixRow(),
    {
      needs_quote: false,
      quantities: [50],
      base_costs: [250],
      recommended_retail: [312.5],
    },
  ]), true);
});

test("pricing is incomplete when matrix rows are missing or empty", () => {
  assert.equal(isSupplierPricingComplete(undefined), false);
  assert.equal(isSupplierPricingComplete([]), false);
});

test("pricing is incomplete when any matrix row requires a quote or lacks an explicit quote flag", () => {
  assert.equal(isSupplierPricingComplete([
    completeMatrixRow(),
    { ...completeMatrixRow(), needs_quote: true },
  ]), false);
  assert.equal(isSupplierPricingComplete([
    { ...completeMatrixRow(), needs_quote: undefined },
  ]), false);
});

test("pricing is incomplete when a matrix row has no quantities", () => {
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [],
    base_costs: [],
    recommended_retail: [],
  }]), false);
});

test("pricing is incomplete when cost or retail arrays are missing", () => {
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10],
    recommended_retail: [125],
  }]), false);
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10],
    base_costs: [100],
  }]), false);
});

test("pricing is incomplete when matrix cell counts do not match quantities", () => {
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10, 25],
    base_costs: [100],
    recommended_retail: [125, 225],
  }]), false);
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10, 25],
    base_costs: [100, 180],
    recommended_retail: [125],
  }]), false);
});

test("pricing is incomplete when any quantity, cost, or retail cell is null", () => {
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10, null],
    base_costs: [100, 180],
    recommended_retail: [125, 225],
  }]), false);
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10],
    base_costs: [null],
    recommended_retail: [125],
  }]), false);
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10],
    base_costs: [100],
    recommended_retail: [null],
  }]), false);
});

test("pricing is incomplete when any matrix cell is non-numeric or non-finite", () => {
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: ["10"],
    base_costs: [100],
    recommended_retail: [125],
  }]), false);
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10],
    base_costs: [Number.NaN],
    recommended_retail: [125],
  }]), false);
  assert.equal(isSupplierPricingComplete([{
    needs_quote: false,
    quantities: [10],
    base_costs: [100],
    recommended_retail: [Number.POSITIVE_INFINITY],
  }]), false);
});
