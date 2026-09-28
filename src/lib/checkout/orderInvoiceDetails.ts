type InvoiceOrder = {
  checkout_attempt_id?: string | null;
  stripe_payment_intent_id?: string | null;
  created_at: string;
  status_note?: string | null;
};

export function orderInvoiceDetails(order: InvoiceOrder) {
  const date = new Date(order.created_at);
  if (!Number.isFinite(date.getTime())) throw new Error('invoice_date_invalid');
  const checkout = Boolean(order.checkout_attempt_id);
  if (checkout && !order.stripe_payment_intent_id) throw new Error('invoice_payment_evidence_missing');
  const billingDetails = order.status_note?.match(/^\[FAKTURERING\][ \t]*([^\r\n]+)/m)?.[1]?.trim();
  if (checkout && !billingDetails) throw new Error('invoice_billing_details_missing');
  // These two immutable identities are written only by the paid-order finalizer.
  // Fulfillment status (pending/production/etc.) is not a payment status.
  return {
    billingDetails,
    isPaid: checkout,
    paidDate: checkout ? date : undefined,
    dueDate: checkout ? undefined : new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000),
  };
}
