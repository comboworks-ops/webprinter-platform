import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateStorformatPrice, tryCalculateStorformatPrice } from "./storformatPricing.ts";
import { StorformatQuoteUnavailableError, validateStorformatQuoteModel } from "./storformatQuoteModel.ts";
import { calculateStorformatPrice as serverPrice } from "../../supabase/functions/_shared/storefrontStorformatFormula.ts";

function fixture() {
  return {
    widthMm: 1200, heightMm: 800, quantity: 1,
    material: { id: "material", name: "Matt", tiers: [], markup_pct: 0 },
    products: [{ id: "standard", name: "Standard", pricing_mode: "fixed" as const, tiers: [] }],
    config: { rounding_step: 1, global_markup_pct: 0, quantities: [1, 2, 3, 4],
      area_pricing_basis: "per_piece_quotes" as const,
      source_quote_model: { version: 1 as const, currency: "DKK" as const, price_basis: "regular" as const,
        base_product_ids: ["standard"], combinations: [{ material_id: "material", finish_ids: [], product_ids: ["standard"],
          points: [13.42, 25.87, 38.8, 51.74].map((price, index) => ({ area_m2: 0.96, quantity: index + 1, total_price: price * 13.68 })) }] } }
  };
}

test("source totals preserve the user's piece area and exact quantity on frontend and server", () => {
  for (const [index, expected] of [184, 354, 531, 708].entries()) {
    const input = fixture(); input.quantity = index + 1;
    const actual = calculateStorformatPrice(input);
    assert.equal(actual.totalPrice, expected);
    assert.equal(actual.areaM2, 0.96);
    assert.equal(actual.totalAreaM2, 0.96 * input.quantity);
    assert.deepEqual(serverPrice(input), actual);
  }
});

test("sampled small-order prices interpolate order totals within the same quantity only", () => {
  const input = fixture(); input.widthMm = 500; input.heightMm = 500; input.quantity = 2;
  input.config.source_quote_model.combinations[0].points = [
    {area_m2: 0.1, quantity: 1, total_price: 50}, {area_m2: 0.4, quantity: 1, total_price: 50},
    {area_m2: 0.1, quantity: 2, total_price: 75}, {area_m2: 0.4, quantity: 2, total_price: 120},
  ];
  assert.equal(calculateStorformatPrice(input).totalPrice, 98);
  input.quantity = 1; assert.equal(calculateStorformatPrice(input).totalPrice, 50);
  input.quantity = 3; assert.equal(tryCalculateStorformatPrice(input), null);
  input.quantity = 2; input.widthMm = 100; assert.equal(tryCalculateStorformatPrice(input), null);
  input.widthMm = 1000; assert.equal(tryCalculateStorformatPrice(input), null);
  for (const area of [0.1, 0.4]) {
    input.widthMm = area * 2000;
    assert.equal(calculateStorformatPrice(input).totalPrice, area === 0.1 ? 75 : 120);
  }
});

test("captured Pixart small orders retain the sampled minimum shape at each quantity", () => {
  // Regular-price source: pixart-flat-surface-adhesive-2026-09-09T12-44-48-285Z.json.
  // The minimum differs by count, so it cannot be inferred from a single per-m² rate or fixed minimum coefficient.
  const sampled = [
    [0.15, [13.42, 14.77, 16.13, 17.48]],
    [0.5, [13.42, 14.77, 22.16, 29.54]],
    [0.96, [13.42, 25.87, 38.8, 51.74]],
    [1, [13.42, 26.83, 40.25, 53.67]],
    [2, [25.48, 50.96, 76.43, 101.91]],
  ] as const;
  const input = fixture(); input.widthMm = 1000;
  input.config.source_quote_model.combinations[0].points = sampled.flatMap(([area, prices]) =>
    prices.map((price, index) => ({area_m2: area, quantity: index + 1, total_price: price * 13.68})));
  for (const [area, prices] of sampled) for (const [index, price] of prices.entries()) {
    input.heightMm = area * 1000; input.quantity = index + 1;
    assert.equal(calculateStorformatPrice(input).totalPrice, Math.round(price * 13.68));
    assert.deepEqual(serverPrice(input), calculateStorformatPrice(input));
  }
  input.heightMm = 325;
  for (const [index, expected] of [184, 202, 262, 322].entries()) {
    input.quantity = index + 1;
    assert.equal(calculateStorformatPrice(input).totalPrice, expected);
  }
  input.heightMm = 149; assert.equal(tryCalculateStorformatPrice(input), null);
  input.heightMm = 2001; assert.equal(tryCalculateStorformatPrice(input), null);
});

test("full option combinations derive exact component deltas before item/global markup and rounding", () => {
  const input: any = fixture();
  const combo = (finish_ids: string[], product_ids: string[], total_price: number) =>
    ({material_id: "material", finish_ids, product_ids, points: [{area_m2: 0.96, quantity: 1, total_price}]});
  input.config.source_quote_model.combinations = [combo([], ["standard"], 100), combo(["finish"], ["standard"], 130), combo(["finish"], ["fast"], 150)];
  input.material.markup_pct = 10;
  input.finishes = [{id: "finish", name: "Finish", pricing_mode: "per_m2", markup_pct: 20, tiers: []}];
  input.products = [{id: "fast", name: "Fast", pricing_mode: "per_m2", markup_pct: 30, tiers: []}];
  input.config.global_markup_pct = 15; input.config.rounding_step = 5;
  const result = calculateStorformatPrice(input);
  assert.ok(Math.abs(result.materialCost - 110) < 1e-8);
  assert.equal(result.finishCost, 36); assert.equal(result.productCost, 26);
  assert.equal(result.totalPrice, 200);
  assert.deepEqual(serverPrice(input), result);
  input.products[0].id = "unknown"; assert.equal(tryCalculateStorformatPrice(input), null);
  input.products = [{id: "standard", name: "Standard", pricing_mode: "fixed", tiers: []}];
  input.finishes.push({...input.finishes[0], id: "other"}); assert.equal(tryCalculateStorformatPrice(input), null);
});

test("invalid quote data, conflicting duplicate keys and unsupported opt-in modes fail closed", () => {
  const mutations = [
    (i: any) => {i.config.source_quote_model = null;},
    (i: any) => {i.config.area_pricing_basis = "unknown";},
    (i: any) => {i.config.source_quote_model.currency = "EUR";},
    (i: any) => {i.config.source_quote_model.price_basis = "sale";},
    (i: any) => {i.config.source_quote_model.version = 2;},
    (i: any) => {i.config.source_quote_model.combinations[0].points[0].total_price = 0;},
    (i: any) => {i.config.source_quote_model.combinations[0].points[0].total_price = NaN;},
    (i: any) => {i.config.source_quote_model.combinations[0].points[0].area_m2 = -1;},
    (i: any) => {i.config.source_quote_model.combinations[0].points[0].quantity = 1.5;},
    (i: any) => {i.config.source_quote_model.combinations[0].points.push({area_m2: 0.96, quantity: 1, total_price: 1});},
    (i: any) => {i.config.source_quote_model.combinations.push(i.config.source_quote_model.combinations[0]);},
    (i: any) => {i.config.source_quote_model.base_product_ids = ["standard", "standard"];},
    (i: any) => {i.material.id = "unknown";},
    (i: any) => {i.widthMm = Infinity;},
    (i: any) => {i.quantity = 0;},
    (i: any) => {i.config.rounding_step = -1;},
    (i: any) => {i.config.global_markup_pct = -100;},
    (i: any) => {i.material.markup_pct = Infinity;},
  ];
  for (const mutate of mutations) {
    const input = fixture(); mutate(input);
    assert.throws(() => calculateStorformatPrice(input), StorformatQuoteUnavailableError);
    assert.equal(tryCalculateStorformatPrice(input), null);
    assert.throws(() => serverPrice(input), /storformat_quote_/);
  }
  const input = fixture();
  input.config.source_quote_model.combinations[0].points.push({...input.config.source_quote_model.combinations[0].points[0]});
  assert.equal(validateStorformatQuoteModel(input.config.source_quote_model).combinations[0].points.length, 4);
});

test("legacy products stay on the existing formula without quote data", () => {
  const input: any = fixture(); delete input.config.area_pricing_basis; delete input.config.source_quote_model;
  input.material.tiers = [{from_m2: 1, to_m2: 2, price_per_m2: 178.6608}];
  assert.equal(calculateStorformatPrice(input).totalPrice, 172);
  input.config.area_pricing_basis = "total_area";
  assert.equal(calculateStorformatPrice(input).totalPrice, 172);
  assert.deepEqual(serverPrice(input), calculateStorformatPrice(input));
});

test("deployment-local quote resolver is an exact source mirror", () => {
  const source = readFileSync(new URL("./storformatQuoteModel.ts", import.meta.url), "utf8");
  const mirror = readFileSync(new URL("../../supabase/functions/_shared/storformatQuoteModel.ts", import.meta.url), "utf8");
  assert.equal(mirror.split("// BEGIN STOREFRONT QUOTE MODEL\n")[1], source);
});
