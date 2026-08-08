import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStorformatPrice,
  normalizeStorformatPricingConfig,
} from "./storformatPricing.ts";

const input = {
  widthMm: 501,
  heightMm: 1000,
  quantity: 100,
  material: {
    name: "Snapshot material",
    interpolation_enabled: true,
    markup_pct: 0,
    tiers: [
      {
        from_m2: 100,
        to_m2: null,
        price_per_m2: 12.7,
        is_anchor: true,
        markup_pct: 0,
      },
    ],
  },
};

test("legacy storformat rounding remains nearest by default", () => {
  const result = calculateStorformatPrice({
    ...input,
    config: { rounding_step: 5, global_markup_pct: 0, quantities: [100] },
  });

  assert.equal(result.materialCost, 636.27);
  assert.equal(result.totalPrice, 635);
});

test("snapshot ceil_v1 rounding changes the monetary total without changing legacy", () => {
  const result = calculateStorformatPrice({
    ...input,
    config: {
      rounding_step: 5,
      rounding_mode: "ceil_v1",
      global_markup_pct: 0,
      quantities: [100],
    },
  });

  assert.equal(result.materialCost, 636.27);
  assert.equal(result.totalPrice, 640);
});

test("database config normalization preserves snapshot ceil rounding", () => {
  assert.deepEqual(
    normalizeStorformatPricingConfig({
      rounding_step: 5,
      rounding_mode: "ceil_v1",
      global_markup_pct: 0,
      quantities: [100, 500],
    }),
    {
      rounding_step: 5,
      rounding_mode: "ceil_v1",
      global_markup_pct: 0,
      quantities: [100, 500],
    },
  );
});
