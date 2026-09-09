import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_DETAIL_COLUMNS, assertOrderScope, customerOrderHref, filterCustomerOrders, orderConfiguration, orderStatus, reorderProductHref, requirePersistedRow, safeOrderDocumentUrl, safeProductImageUrl, scopedOrderDetailQuery, scopedOrdersQuery, type CustomerOrder } from './orders.ts';

const sample: CustomerOrder = { id: 'one', order_number: 'WP-1048', product_name: 'Brochurer A4', quantity: 250, total_price: 1000, status: 'pending', created_at: '2026-09-07T10:00:00Z' };
const scope = { userId: 'customer-a', tenantId: 'shop-a' };
function queryRecorder() {
  const calls: unknown[][] = [];
  const query = { select(...args: unknown[]) { calls.push(['select', ...args]); return query; }, eq(...args: unknown[]) { calls.push(['eq', ...args]); return query; } };
  return { calls, client: { from(table: string) { calls.push(['from', table]); return query; } } as unknown as SupabaseClient };
}

test('list requests always include both authenticated customer and current shop', () => {
  const recorder = queryRecorder();
  scopedOrdersQuery(recorder.client, scope);
  assert.deepEqual(recorder.calls, [['from', 'orders'], ['select', '*'], ['eq', 'user_id', 'customer-a'], ['eq', 'tenant_id', 'shop-a']]);
});

test('all detail tables constrain order id and both parent ownership predicates', () => {
  for (const table of ['order_messages', 'order_files', 'delivery_tracking', 'order_invoices', 'order_status_history']) {
    const recorder = queryRecorder();
    scopedOrderDetailQuery(recorder.client, table, 'one', scope);
    assert.deepEqual(recorder.calls, [['from', table], ['select', `${CUSTOMER_DETAIL_COLUMNS[table]}, orders!inner(user_id, tenant_id)`], ['eq', 'order_id', 'one'], ['eq', 'orders.user_id', 'customer-a'], ['eq', 'orders.tenant_id', 'shop-a']]);
  }
});

test('customer history and tracking reads omit internal notes and raw carrier payloads', () => {
  assert.equal(CUSTOMER_DETAIL_COLUMNS.order_status_history.includes('note'), false);
  assert.equal(CUSTOMER_DETAIL_COLUMNS.delivery_tracking.includes('tracking_data'), false);
});

test('unknown customer/shop, missing order and unapproved tables fail before a request', () => {
  assert.throws(() => assertOrderScope({ userId: '', tenantId: 'shop-a' }));
  const recorder = queryRecorder();
  assert.throws(() => scopedOrdersQuery(recorder.client, { userId: 'customer-a', tenantId: '' }));
  assert.throws(() => scopedOrderDetailQuery(recorder.client, 'order_notes', 'one', scope));
  assert.throws(() => scopedOrderDetailQuery(recorder.client, 'order_messages', '', scope));
  assert.deepEqual(recorder.calls, []);
});

test('writes must return the actual affected row; RLS zero rows is not success', () => {
  assert.throws(() => requirePersistedRow({ data: null, error: null }));
  assert.throws(() => requirePersistedRow({ data: { id: 'other' }, error: null }, 'one'));
  assert.throws(() => requirePersistedRow({ data: { id: 'one' }, error: new Error('denied') }, 'one'));
  assert.deepEqual(requirePersistedRow({ data: { id: 'one' }, error: null }, 'one'), { id: 'one' });
});

test('exact order deep links preserve shop context and replace an old order id', () => {
  const url = new URL(customerOrderHref('new/id', '?tenantId=shop-a&order=old'), 'https://shop.example');
  assert.equal(url.pathname, '/min-konto/ordrer');
  assert.equal(url.searchParams.get('tenantId'), 'shop-a');
  assert.deepEqual(url.searchParams.getAll('order'), ['new/id']);
});

test('search handles order numbers, Danish product names, whitespace and no match', () => {
  const rows = [sample, { ...sample, id: 'two', order_number: 'WP-2', product_name: 'Klæbemærker' }];
  assert.deepEqual(filterCustomerOrders(rows, '  #wp-1048 '), [sample]);
  assert.equal(filterCustomerOrders(rows, 'KLÆBE')[0].id, 'two');
  assert.equal(filterCustomerOrders(rows, ' ')[0], sample);
  assert.deepEqual(filterCustomerOrders(rows, 'absent'), []);
});

test('requested replacement takes priority and unknown statuses are not invented', () => {
  assert.equal(orderStatus({ status: 'production', requires_file_reupload: true }).label, 'Afventer ny fil');
  assert.equal(orderStatus({ status: 'production', has_problem: true }).tone, 'danger');
  assert.equal(orderStatus({ status: 'other' }).label, 'Status ikke oplyst');
});

test('old size distribution remains visible while internal fulfillment tags stay out', () => {
  assert.equal(orderConfiguration({ ...sample, status_note: '[SIZE-DISTRIBUTION] S: 2, XL: 3\n[PRODUKTIONSFLOW] internal' }), 'S: 2, XL: 3');
  assert.equal(orderConfiguration({ ...sample, status_note: '[PRODUKTIONSFLOW] internal' }), null);
  assert.equal(orderConfiguration({ ...sample, product_configuration: ' A4, 170 g ' }), 'A4, 170 g');
});

test('reorder opens only a verified published product with no old prices or options', () => {
  assert.equal(reorderProductHref(sample), null);
  assert.equal(reorderProductHref({ ...sample, product: { slug: 'flyers', image_url: null, is_published: false } }), null);
  assert.equal(reorderProductHref({ ...sample, product: { slug: 'flyers', image_url: null, is_published: true } }), '/produkt/flyers');
});

test('download links reject executable/local URLs; images may use safe local assets', () => {
  for (const input of ['javascript:alert(1)', 'data:text/html,secret', '//evil.example/x', '/private-document.pdf', 'file:///secret', 'http://files.example/one.pdf']) assert.equal(safeOrderDocumentUrl(input), null);
  assert.equal(safeOrderDocumentUrl('https://files.example/one.pdf'), 'https://files.example/one.pdf');
  assert.equal(safeProductImageUrl('/design-presets/category-print.webp'), '/design-presets/category-print.webp');
  assert.equal(safeProductImageUrl('//evil.example/image.png'), null);
  assert.equal(safeProductImageUrl('/\\evil.example/image.png'), null);
  assert.equal(safeProductImageUrl('/\n/evil.example/image.png'), null);
});
