import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {orderInvoiceDetails} from './orderInvoiceDetails.ts';
const order = {created_at: '2026-09-16T10:00:00Z', checkout_attempt_id: 'test-attempt',
  stripe_payment_intent_id: 'pi_test', status_note: '[MODTAGER] Delivery recipient\n[FAKTURERING] Buyer, Accounts, Billing street 2, 8000, Aarhus, DK'};
test('paid checkout invoice uses the billing record and no new payment deadline', () => {
  const d=orderInvoiceDetails(order);
  assert.equal(d.billingDetails, 'Buyer, Accounts, Billing street 2, 8000, Aarhus, DK');
  assert.equal(d.isPaid,true);assert.equal(d.dueDate,undefined);
  assert.equal(d.paidDate?.toISOString(),order.created_at.replace('Z','.000Z'));
});
test('invoice refuses incomplete checkout payment or billing evidence', () => {
  assert.throws(()=>orderInvoiceDetails({...order,stripe_payment_intent_id:null}),/payment_evidence/);
  assert.throws(()=>orderInvoiceDetails({...order,status_note:'[MODTAGER] Delivery recipient'}),/billing_details/);
});
test('legacy order has no inferred payment and a stable deadline based on order date', () => {
  const d=orderInvoiceDetails({created_at:order.created_at});
  assert.equal(d.isPaid,false);assert.equal(d.paidDate,undefined);
  assert.equal(d.dueDate?.toISOString(),'2026-09-30T10:00:00.000Z');
});
test('admin invoice actually passes paid evidence and saved billing to the PDF', () => {
  const s=readFileSync(new URL('../../components/admin/OrderManager.tsx',import.meta.url),'utf8');
  assert.match(s,/orderInvoiceDetails\(selectedOrder\)/);
  assert.match(s,/billingDetails: invoiceDetails\.billingDetails/);
  assert.match(s,/isPaid: invoiceDetails\.isPaid/);
  assert.doesNotMatch(s,/dueDate: new Date\(Date\.now\(\)/);
});
