import test from 'node:test';
import assert from 'node:assert/strict';
import { getStorformatSourceQuoteFields, getStorformatQuoteCoverage, normalizeStorformatAnchorState, usesStorformatSourceQuotes } from './storformatQuoteUi.ts';
import { tryCalculateStorformatPrice } from '../../utils/storformatPricing.ts';

const model = {
  version: 1, currency: 'DKK', price_basis: 'regular', base_product_ids: [],
  combinations: [{ material_id: 'mat', finish_ids: [], product_ids: [], points: [
    { area_m2: .15, quantity: 1, total_price: 184 },
    { area_m2: 1, quantity: 1, total_price: 184 },
    { area_m2: 1, quantity: 2, total_price: 354 },
  ] }],
};

test('read -> ordinary admin edit -> save -> reload preserves the supplier model and mappings', () => {
  const row = { area_pricing_basis: 'per_piece_quotes', source_quote_model: model };
  const loaded = { rounding_step: 1, global_markup_pct: 0, quantities: [1, 2, 3], ...getStorformatSourceQuoteFields(row) };
  const edited = { ...loaded, global_markup_pct: 10, layout_rows: [{ id: 'renamed-layout' }] };
  const saved = { rounding_step: edited.rounding_step, ...getStorformatSourceQuoteFields(edited) };
  const reloaded = getStorformatSourceQuoteFields(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reloaded, row);
  assert.strictEqual(getStorformatSourceQuoteFields(edited).source_quote_model, model);
});

test('legacy configs add no migration-dependent fields and never auto opt in', () => {
  assert.deepEqual(getStorformatSourceQuoteFields({ quantities: [1] }), {});
  assert.equal(usesStorformatSourceQuotes({}), false);
});

test('invalid model is preserved to fail closed instead of falling back to legacy prices', () => {
  const row = { area_pricing_basis: 'total_area', source_quote_model: { invalid: true } };
  assert.deepEqual(getStorformatSourceQuoteFields(row), row);
  assert.equal(usesStorformatSourceQuotes(getStorformatSourceQuoteFields(row)), true);
});

test('all genuine point anchors and quote-mode legacy flags survive an admin load', () => {
  const points = [{ from_m2: .15, to_m2: .15, price_per_m2: 100, is_anchor: true }, { from_m2: 1, to_m2: 1, price_per_m2: 90, is_anchor: true }];
  assert.deepEqual(normalizeStorformatAnchorState(points), points);
  const intervals = [{ ...points[0], to_m2: 1 }, { ...points[1], to_m2: null }];
  assert.deepEqual(normalizeStorformatAnchorState(intervals, true), intervals);
  assert.ok(normalizeStorformatAnchorState(intervals).every(tier => !tier.is_anchor));
});

test('coverage labels retain exact sampled quantities and areas', () => {
  assert.deepEqual(getStorformatQuoteCoverage(model), { quantities: [1, 2], areas: [.15, 1], combinations: 1 });
  assert.deepEqual(getStorformatQuoteCoverage(null), { quantities: [], areas: [], combinations: 0 });
});

test('the UI null contract clears a supported price after an unsupported size, count or finish', () => {
  const config = { rounding_step: 1, global_markup_pct: 0, quantities: [1, 2, 3], ...getStorformatSourceQuoteFields({ area_pricing_basis: 'per_piece_quotes', source_quote_model: model }) };
  const input = { widthMm: 1000, heightMm: 1000, quantity: 1, material: { id: 'mat', name: 'Materiale', tiers: [] }, config };
  assert.equal(tryCalculateStorformatPrice(input)?.totalPrice, 184);
  assert.equal(tryCalculateStorformatPrice({ ...input, quantity: 3 }), null);
  assert.equal(tryCalculateStorformatPrice({ ...input, widthMm: 2000 }), null);
  assert.equal(tryCalculateStorformatPrice({ ...input, finish: { id: 'finish', name: 'Mat', pricing_mode: 'per_m2', tiers: [] } }), null);
  assert.equal(tryCalculateStorformatPrice(input)?.totalPrice, 184);
});
