import test from 'node:test';
import assert from 'node:assert/strict';
import { readBrochureNativeFreeTiers, validateBrochureFreeSelection } from '../shared/brochure-free-quote.js';
const registry = { '2009': { sourceUrl: 'https://www.wir-machen-druck.de/brochure.html', pageCount: 8, materials: ['282595'] } };
const selection = { articleId: '2009', substrateId: '282595', widthMm: 148, heightMm: 210 };
test('free brochure excludes A3, unknown materials and unsupported precision before any supplier call', () => {
  assert.equal(validateBrochureFreeSelection(registry, selection).widthMm, 148);
  for (const change of [{ heightMm: 420 }, { widthMm: 97.9 }, { widthMm: 148.01 }, { substrateId: 'other' }, { articleId: 'other' }]) {
    assert.throws(() => validateBrochureFreeSelection(registry, { ...selection, ...change }));
  }
});
test('German net prices and sparse source quantities are retained without samples, gross VAT or invented tiers', () => {
  const rows = readBrochureNativeFreeTiers([
    { id: 0, wert: -1, artikel_sorten__id: 282595, bezeichnung: 'Gratis Probe' },
    { id: 1, wert: 250, artikel_sorten__id: 282595, bezeichnung: '250 Stück (1.234,56 Euro netto)' },
    { id: 2, wert: 10000, artikel_sorten__id: 282595, preis: '3456.78' },
    { id: 3, wert: 15000, artikel_sorten__id: 282595, preis: '5000.00' },
  ], '282595');
  assert.deepEqual(rows.map(row => row.quantity), [250, 10000]);
  assert.equal(rows[0].supplierNetEur, 1234.56);
  assert.throws(() => readBrochureNativeFreeTiers([{ id: 1, wert: 250, artikel_sorten__id: 282595, bezeichnung: '250 Stück (1.234,56 Euro brutto)' }], '282595'));
  assert.throws(() => readBrochureNativeFreeTiers([{ id: 1, wert: 250, artikel_sorten__id: 2, preis: '5' }], '282595'));
});
