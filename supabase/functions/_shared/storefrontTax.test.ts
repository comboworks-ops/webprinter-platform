import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateCheckoutTax, checkoutTaxEmailFields, readCheckoutTax} from './storefrontTax.ts';
import {checkoutTaxPreview} from '../../../src/lib/checkout/tax.ts';
import {orderInvoiceAmounts} from '../../../src/lib/checkout/orderInvoiceAmounts.ts';

const master = '00000000-0000-0000-0000-000000000000';
test('Danish checkout adds 25% to products, extras and delivery exactly once, in øre', () => {
  for (const shop of [master, '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba', '7cb851f5-c792-40b1-a79a-1f7c7b5f668c']) {
    const tax = calculateCheckoutTax(shop, 'dk', 31400 + 12900);
    assert.equal(tax.netAmountOre, 44300);
    assert.equal(tax.vatAmountOre, 11075);
    assert.equal(tax.grossAmountOre, 55375);
    assert.deepEqual(checkoutTaxPreview(shop, 'DK', 44300).tax, tax);
    assert.deepEqual(orderInvoiceAmounts({total_price: 553.75, checkout_attempt_id: 'test', checkout_tax: tax}),
      {subtotal: 443, taxAmount: 110.75, taxRate: 25});
    assert.deepEqual(checkoutTaxEmailFields(tax, 553.75), [['Beløb ekskl. moms', '443,00 DKK'], ['Moms (25 %)', '110,75 DKK']]);
  }
  assert.equal(calculateCheckoutTax(master, 'DK', 101).vatAmountOre, 25);
  assert.equal(calculateCheckoutTax(master, 'DK', 102).vatAmountOre, 26);
});
test('foreign delivery and unconfigured sellers cannot become zero-VAT payments', () => {
  for (const country of ['NO', 'DE', 'CY', 'SE', 'GL', 'FO', '']) {
    assert.throws(() => calculateCheckoutTax(master, country, 44300), /checkout_delivery_country_unsupported/);
    assert.equal(checkoutTaxPreview(master, country, 44300).tax, null);
    assert.ok(checkoutTaxPreview(master, country, 44300).message);
  }
  assert.throws(() => calculateCheckoutTax('11111111-1111-4111-8111-111111111111', 'DK', 44300), /checkout_tax_policy_unavailable/);
  for (const value of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => calculateCheckoutTax(master, 'DK', value));
});
test('invoice and mail reject inconsistent snapshots; legacy checkout tax stays unknown', () => {
  const tax = calculateCheckoutTax(master, 'DK', 44300);
  for (const patch of [{vatAmountOre: 0}, {rateBps: 0}, {grossAmountOre: 44300}, {deliveryCountry: 'NO'}, {netAmountOre: 443}]) {
    assert.throws(() => readCheckoutTax({...tax, ...patch}, 55375), /checkout_tax_snapshot_invalid/);
  }
  assert.throws(() => orderInvoiceAmounts({total_price: 443, checkout_tax: tax}));
  assert.equal(readCheckoutTax(undefined, 44300), null);
  assert.deepEqual(checkoutTaxEmailFields(null, 443), []);
  assert.throws(() => orderInvoiceAmounts({total_price: 443, checkout_attempt_id: 'historical'}), /invoice_checkout_tax_missing/);
  assert.deepEqual(orderInvoiceAmounts({total_price: 125}), {subtotal: 100, taxAmount: 25, taxRate: 25});
});
