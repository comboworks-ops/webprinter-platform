import assert from "node:assert/strict";
import test from "node:test";

import { getSupplierPresentation } from "./supplierPresentation.ts";

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
