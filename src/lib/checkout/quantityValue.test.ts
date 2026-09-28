import test from 'node:test';
import assert from 'node:assert/strict';
import { quantityValueOptions } from './quantityValue.ts';

test('compares the actual chosen price per item and clearly separates total difference', () => {
  assert.deepEqual(quantityValueOptions([{quantity: 100, price: 600}], 75, 504), [{
    quantity: 100, price: 600, unitPrice: 6, difference: 96, savingPercent: 11,
  }]);
});
test('between tiers offers the next available quantity without skipping it', () => {
  assert.deepEqual(quantityValueOptions([{quantity: 50, price: 400}, {quantity: 100, price: 600}, {quantity: 150, price: 750}], 75, 504).map(x => x.quantity), [100, 150]);
});
test('highest tier and invalid prices clear offers; higher unit prices never claim savings', () => {
  assert.deepEqual(quantityValueOptions([{quantity: 100, price: 600}], 100, 600), []);
  assert.deepEqual(quantityValueOptions([{quantity: 200, price: NaN}, {quantity: 150, price: 0}], 100, 600), []);
  assert.equal(quantityValueOptions([{quantity: 100, price: 900}], 75, 504)[0].savingPercent, 0);
});
