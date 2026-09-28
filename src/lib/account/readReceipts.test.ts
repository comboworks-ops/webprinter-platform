import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acknowledgeCustomerOrderMessages } from './readReceipts.ts';

function clientReturning(result: unknown) {
  const calls: unknown[] = [];
  const client = { rpc: async (...args: unknown[]) => {
    calls.push(args);
    if (result instanceof Error) throw result;
    return result;
  } } as unknown as SupabaseClient;
  return { client, calls };
}
const request = { orderId: 'order-a', tenantId: 'shop-a', messageIds: ['message-a', 'message-b'] };

test('read receipt uses a narrow tenant-scoped RPC and verifies exact persisted IDs', async () => {
  const { client, calls } = clientReturning({ data: ['message-b', 'message-a'], error: null });
  assert.deepEqual(await acknowledgeCustomerOrderMessages(client, request), new Set(['message-b', 'message-a']));
  assert.deepEqual(calls, [['customer_mark_order_messages_read', {
    p_order_id: 'order-a', p_tenant_id: 'shop-a', p_message_ids: ['message-a', 'message-b'],
  }]]);
});
test('missing RPC, denied writes, incomplete acknowledgements and network failures never report success', async () => {
  for (const result of [{ data: null, error: { code: 'PGRST202' } }, { data: [], error: null },
    { data: ['message-a'], error: null }, { data: ['message-a', 'foreign-message'], error: null },
    { data: ['message-a', 'message-b'], error: { code: '42501' } }, new Error('timeout')]) {
    const { client } = clientReturning(result);
    await assert.rejects(acknowledgeCustomerOrderMessages(client, request), /Læsekvitteringen kunne ikke gemmes/);
  }
});
test('empty receipt is a no-op; repeated message IDs are acknowledged once', async () => {
  const { client, calls } = clientReturning({ data: ['message-a'], error: null });
  assert.deepEqual(await acknowledgeCustomerOrderMessages(client, { ...request, messageIds: [] }), new Set());
  assert.equal(calls.length, 0);
  assert.deepEqual(await acknowledgeCustomerOrderMessages(client, { ...request, messageIds: ['message-a', 'message-a'] }), new Set(['message-a']));
});
