import type { SupabaseClient } from '@supabase/supabase-js';

const READ_RECEIPT_ERROR = 'Læsekvitteringen kunne ikke gemmes. Du kan stadig læse og besvare beskederne.';

/** The RPC can only acknowledge operator messages on the caller's own order.
 * Verify the returned IDs; a successful HTTP response alone is not persistence. */
export async function acknowledgeCustomerOrderMessages(
  client: SupabaseClient,
  request: { orderId: string; tenantId: string; messageIds: string[] },
): Promise<Set<string>> {
  const messageIds = [...new Set(request.messageIds)];
  if (!request.orderId || !request.tenantId || messageIds.length > 500 || messageIds.some(id => !id)) {
    throw new Error(READ_RECEIPT_ERROR);
  }
  if (!messageIds.length) return new Set();
  try {
    const result = await client.rpc('customer_mark_order_messages_read', {
      p_order_id: request.orderId,
      p_tenant_id: request.tenantId,
      p_message_ids: messageIds,
    });
    if (result.error || !Array.isArray(result.data)) throw new Error(READ_RECEIPT_ERROR);
    const savedIds = new Set<string>(result.data);
    if (savedIds.size !== messageIds.length || messageIds.some(id => !savedIds.has(id))) {
      throw new Error(READ_RECEIPT_ERROR);
    }
    return savedIds;
  } catch {
    // Reopening the conversation is safe: acknowledgement is idempotent.
    throw new Error(READ_RECEIPT_ERROR);
  }
}
