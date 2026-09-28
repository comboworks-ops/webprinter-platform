import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { resolvePod2PriceSnapshot } from "./pod2Pricing.ts";

Deno.test("tenant cost resolves from the Webprinter price, not supplier cost", () => {
  assertEquals(
    resolvePod2PriceSnapshot({
      quantities: [100, 250],
      supplierCosts: [100, 180],
      webprinterPrices: [150, 260],
      orderedQuantity: 100,
    }),
    {
      matchedQuantity: 100,
      supplierCost: 100,
      webprinterPrice: 150,
    },
  );
});

Deno.test("existing quantity-tier behavior is retained", () => {
  assertEquals(
    resolvePod2PriceSnapshot({
      quantities: [100, 250, 500],
      supplierCosts: [100, 180, 300],
      webprinterPrices: [150, 260, 420],
      orderedQuantity: 300,
    })?.matchedQuantity,
    250,
  );
});

Deno.test("the first tier remains the fallback below the smallest configured quantity", () => {
  assertEquals(
    resolvePod2PriceSnapshot({
      quantities: [100, 250],
      supplierCosts: [100, 180],
      webprinterPrices: [150, 260],
      orderedQuantity: 50,
    })?.webprinterPrice,
    150,
  );
});

Deno.test("invalid or loss-making price pairs fail closed", () => {
  assertEquals(
    resolvePod2PriceSnapshot({
      quantities: [100],
      supplierCosts: [100],
      webprinterPrices: [90],
      orderedQuantity: 100,
    }),
    null,
  );
  assertEquals(
    resolvePod2PriceSnapshot({
      quantities: [100, 250],
      supplierCosts: [100, 180],
      webprinterPrices: [150],
      orderedQuantity: 100,
    }),
    null,
  );
});
