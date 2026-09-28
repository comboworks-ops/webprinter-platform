import assert from 'node:assert/strict';
import test from 'node:test';
import { readCheckoutRecovery, saveCheckoutRecovery, requireCheckoutV2Response } from './checkoutRecovery.ts';
const recovery = { tenantId: 'shop-a', attemptId: '11111111-1111-4111-8111-111111111111', accessToken: '22222222-2222-4222-8222-222222222222', payloadHash: 'a'.repeat(64) };
test('recovery survives reload and cannot be read in another shop', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) || null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
  saveCheckoutRecovery(storage, recovery);
  assert.deepEqual(readCheckoutRecovery(storage, 'shop-a'), recovery);
  assert.equal(readCheckoutRecovery(storage, 'shop-b'), null);
});
test('blocked recovery storage fails before payment starts', () => {
  assert.throws(() => saveCheckoutRecovery({ getItem: () => null, setItem: () => {}, removeItem: () => {} }, recovery), /ikke gemmes/);
});
test('old deployed create function cannot open payment and another attempt is rejected', () => {
  assert.throws(() => requireCheckoutV2Response({ client_secret: 'old_secret' }, recovery.attemptId), /ikke klar/);
  assert.throws(() => requireCheckoutV2Response({ contract_version: 2, checkout_attempt_id: 'other', payment_intent_id: 'pi_abc', client_secret: 'secret' }, recovery.attemptId));
  assert.doesNotThrow(() => requireCheckoutV2Response({ contract_version: 2, checkout_attempt_id: recovery.attemptId, payment_intent_id: 'pi_abc', client_secret: 'secret' }, recovery.attemptId));
});
