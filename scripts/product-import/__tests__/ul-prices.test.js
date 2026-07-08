import test from "node:test";
import assert from "node:assert/strict";

import {
  parseLocalizedNumber,
  extractEurAmount,
  resolveTierMultiplier,
  roundToStep,
  transformLiTextsToRows,
} from "../ul-prices.js";

test("parseLocalizedNumber handles common EUR number formats", () => {
  assert.equal(parseLocalizedNumber("12,50"), 12.5);
  assert.equal(parseLocalizedNumber("1.234,56"), 1234.56);
  assert.equal(parseLocalizedNumber("1,234.56"), 1234.56);
  assert.equal(parseLocalizedNumber("2 345,00"), 2345);
});

test("extractEurAmount parses currency before or after amount", () => {
  assert.equal(extractEurAmount("Pris: €12.50"), 12.5);
  assert.equal(extractEurAmount("12,50 EUR pr. stk"), 12.5);
  assert.equal(extractEurAmount("Total 1.234,56 € inkl."), 1234.56);
});

test("resolveTierMultiplier applies boundary tiers", () => {
  const tiers = [
    { max_dkk_base: 3000, multiplier: 1.5 },
    { max_dkk_base: 10000, multiplier: 1.4 },
    { multiplier: 1.3 },
  ];

  assert.equal(resolveTierMultiplier(3000, tiers), 1.5);
  assert.equal(resolveTierMultiplier(3001, tiers), 1.4);
  assert.equal(resolveTierMultiplier(10000, tiers), 1.4);
  assert.equal(resolveTierMultiplier(10001, tiers), 1.3);
});

test("roundToStep rounds to nearest step", () => {
  assert.equal(roundToStep(15.2, 1), 15);
  assert.equal(roundToStep(15.8, 1), 16);
  assert.equal(roundToStep(153, 10), 150);
  assert.equal(roundToStep(156, 10), 160);
});

test("transformLiTextsToRows computes base/tier/final prices", () => {
  const input = [
    "100 stk - 10,00 EUR",
    "200 stk - 100,00 EUR",
  ];

  const result = transformLiTextsToRows(input, {
    eur_to_dkk: 7.5,
    rounding_step: 1,
    default_quantity_start: 1,
    default_quantity_step: 1,
    tiers: [
      { max_dkk_base: 3000, multiplier: 1.5 },
      { max_dkk_base: 10000, multiplier: 1.4 },
      { multiplier: 1.3 },
    ],
  });

  assert.equal(result.rows.length, 2);

  assert.equal(result.rows[0].quantity, 100);
  assert.equal(result.rows[0].eur, 10);
  assert.equal(result.rows[0].dkk_base, 75);
  assert.equal(result.rows[0].tier_multiplier, 1.5);
  assert.equal(result.rows[0].dkk_final, 113);

  assert.equal(result.rows[1].quantity, 200);
  assert.equal(result.rows[1].eur, 100);
  assert.equal(result.rows[1].dkk_base, 750);
  assert.equal(result.rows[1].tier_multiplier, 1.5);
  assert.equal(result.rows[1].dkk_final, 1125);
});
