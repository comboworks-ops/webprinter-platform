import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuredMatrixOfferPrice } from './featuredMatrixOffer.ts';

const offer = { variantName: 'a4-1mm-4+0', rowId: 'chromo', quantity: 50 };
const matrix = { columns: [50, 200], cells: { silk: { 50: 566, 200: 1184 }, chromo: { 50: 573, 200: 1174 } } };
test('advertised standard reads Chromo 50, independently of first matrix row', () => {
  assert.equal(featuredMatrixOfferPrice(offer, offer.variantName, matrix, 50), 573);
});
test('missing or stale advertised combinations never fall back to another offer', () => {
  assert.equal(featuredMatrixOfferPrice(offer, 'a5', matrix, 50), null);
  assert.equal(featuredMatrixOfferPrice(offer, offer.variantName, matrix, 200), null);
  assert.equal(featuredMatrixOfferPrice(offer, offer.variantName, { columns: [50], cells: { silk: matrix.cells.silk } }, 50), null);
  assert.equal(featuredMatrixOfferPrice(offer, offer.variantName, { columns: [50], cells: { chromo: { 50: 0 } } }, 50), null);
});
