import assert from 'node:assert/strict';
import test from 'node:test';
import { canHydrateDeliveryAddress, checkoutCountryCode, deliveryAddressLines } from './addressIntegrity.ts';

test('late default address cannot replace partially typed recipient or line 2', () => {
  for (const key of ['name', 'company', 'address', 'address2', 'zip', 'city']) {
    assert.equal(canHydrateDeliveryAddress({ [key]: 'Typed' }), false);
  }
  assert.equal(canHydrateDeliveryAddress({ name: '', address: ' ' }), true);
});
test('line 2 and non-Danish country survive order serialization', () => {
  assert.equal(deliveryAddressLines(' Main St 1 ', ' Floor 2 '), 'Main St 1, Floor 2');
  assert.equal(checkoutCountryCode('se'), 'SE');
  assert.equal(checkoutCountryCode('Danmark'), 'DK');
  assert.equal(checkoutCountryCode('Atlantis'), null);
});
