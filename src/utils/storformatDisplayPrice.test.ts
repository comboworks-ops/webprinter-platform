import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStorformatDisplayPrice } from './storformatDisplayPrice.ts';

const materials = [{id: 'matt', name: 'Matt', tiers: [{from_m2: 1, price_per_m2: 99}]}];
const products = ['express', 'standard'].map(id => ({id, name: id, pricing_mode: 'fixed' as const, tiers: [], fixed_prices: [{quantity: 1, price: 10}]}));
const config = {rounding_step: 1, global_markup_pct: 0, quantities: [1], area_pricing_basis: 'per_piece_quotes' as const,
  source_quote_model: {version: 1, currency: 'DKK', price_basis: 'regular', base_product_ids: ['standard'], combinations: [
    {material_id: 'matt', finish_ids: [], product_ids: ['standard'], points: [{area_m2: 1, quantity: 1, total_price: 183.5856}]},
  ]}};

test('catalogue price uses the quoted base option, regardless of product sort order', () => {
  assert.equal(calculateStorformatDisplayPrice(config, materials, products), 184);
});
test('catalogue never displays old tier prices for missing or malformed source coverage', () => {
  assert.equal(calculateStorformatDisplayPrice(config, materials, products.slice(0, 1)), null);
  assert.equal(calculateStorformatDisplayPrice({...config, quantities: [2]}, materials, products), null);
  assert.equal(calculateStorformatDisplayPrice({...config, source_quote_model: null}, materials, products), null);
});
test('catalogue retains legacy one-square-metre price calculation', () => {
  assert.equal(calculateStorformatDisplayPrice({...config, area_pricing_basis: 'total_area', source_quote_model: null}, materials, products), 109);
});
