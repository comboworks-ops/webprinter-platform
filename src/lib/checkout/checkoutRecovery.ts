export interface CheckoutRecovery {
  tenantId: string;
  attemptId: string;
  accessToken: string;
  payloadHash: string;
  checkoutInstanceId?: string;
  completed?: boolean;
  paymentIntentId?: string;
  companyOrderRequestId?: string;
}
export interface RecoveryStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const key = (tenantId: string) => `wp_checkout_recovery_v2:${tenantId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readCheckoutRecovery(storage: RecoveryStorage, tenantId: string): CheckoutRecovery | null {
  const raw = storage.getItem(key(tenantId));
  if (!raw) return null;
  const value = JSON.parse(raw) as CheckoutRecovery;
  if (value.tenantId !== tenantId || !uuid.test(value.attemptId) || !uuid.test(value.accessToken) || (value.companyOrderRequestId != null && !uuid.test(value.companyOrderRequestId)) || !/^[a-f0-9]{64}$/.test(value.payloadHash)) {
    throw new Error('Den gemte betalingsreference kunne ikke læses. Kontakt butikken før en ny betaling.');
  }
  return value;
}
export function saveCheckoutRecovery(storage: RecoveryStorage, value: CheckoutRecovery): void {
  storage.setItem(key(value.tenantId), JSON.stringify(value));
  if (storage.getItem(key(value.tenantId)) !== JSON.stringify(value)) throw new Error('Betalingsreferencen kunne ikke gemmes. Betalingen er ikke startet.');
}
export function clearCheckoutRecovery(storage: RecoveryStorage, tenantId: string): void { storage.removeItem(key(tenantId)); }

/** An older deployed function must never open a payment form. */
export function requireCheckoutV2Response(value: unknown, attemptId: string): void {
  const data = value as { contract_version?: unknown; checkout_attempt_id?: unknown; payment_intent_id?: string; client_secret?: unknown } | null;
  if (data?.contract_version !== 2 || data?.checkout_attempt_id !== attemptId || !/^pi_[a-zA-Z0-9]+$/.test(data?.payment_intent_id || '') || !data?.client_secret) {
    throw new Error('Butikkens betaling er ikke klar til sikker ordreoprettelse. Kontakt butikken.');
  }
}
