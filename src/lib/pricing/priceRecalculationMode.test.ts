import assert from "node:assert/strict";
import test from "node:test";

import { shouldRunLegacyMatrixPriceRecalculation } from "./priceRecalculationMode.ts";

test("matrix layout v1 keeps the price emitted by its renderer", () => {
  assert.equal(
    shouldRunLegacyMatrixPriceRecalculation({
      hasSelectedCell: true,
      isStorformat: false,
      pricingMode: "matrix_layout_v1",
    }),
    false,
  );
});

test("legacy matrices still recalculate after a cell selection", () => {
  assert.equal(
    shouldRunLegacyMatrixPriceRecalculation({
      hasSelectedCell: true,
      isStorformat: false,
      pricingMode: "generic",
    }),
    true,
  );
});

test("recalculation waits for a cell and stays out of storformat", () => {
  assert.equal(
    shouldRunLegacyMatrixPriceRecalculation({
      hasSelectedCell: false,
      isStorformat: false,
      pricingMode: "generic",
    }),
    false,
  );
  assert.equal(
    shouldRunLegacyMatrixPriceRecalculation({
      hasSelectedCell: true,
      isStorformat: true,
      pricingMode: "generic",
    }),
    false,
  );
});
