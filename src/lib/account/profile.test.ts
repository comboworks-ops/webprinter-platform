import assert from 'node:assert/strict';
import test from 'node:test';
import { fillEmptyCustomerContact, resolveCustomerContact } from './profile.ts';

const user = { email: 'customer@example.test', user_metadata: { full_name: 'Old Name', phone: 'old phone', company: 'Old company' } };

test('checkout uses the profile edited in account settings ahead of old auth metadata', () => {
  assert.deepEqual(resolveCustomerContact(user, { first_name: ' Anna ', last_name: ' Jensen ', phone: '12345678', company: 'Studio' }), {
    customerEmail: 'customer@example.test', customerName: 'Anna Jensen', customerPhone: '12345678', customerCompany: 'Studio',
  });
});

test('explicitly cleared saved details do not restore stale metadata', () => {
  const contact = resolveCustomerContact(user, { first_name: '', last_name: '', phone: null, company: '' });
  assert.equal(contact.customerName, '');
  assert.equal(contact.customerPhone, '');
  assert.equal(contact.customerCompany, '');
});

test('accounts without a profile retain the existing identity fallback', () => {
  assert.equal(resolveCustomerContact(user, null).customerName, 'Old Name');
  assert.equal(resolveCustomerContact({ user_metadata: { name: 'Name' } }).customerName, 'Name');
});

test('late profile hydration preserves checkout contact details already entered', () => {
  assert.equal(fillEmptyCustomerContact('Entered recipient', 'Saved account name'), 'Entered recipient');
  assert.equal(fillEmptyCustomerContact('', 'Saved account name'), 'Saved account name');
});
