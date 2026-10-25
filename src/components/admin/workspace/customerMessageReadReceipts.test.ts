import assert from 'node:assert/strict';
import test from 'node:test';
import { markDisplayedCustomerMessagesRead } from './customerMessageReadReceipts.ts';

function store(options: { error?: Error; onWrite?: () => void } = {}) {
    const rows = [
        { id: 'visible', order_id: 'a', sender_type: 'customer', is_read: false },
        { id: 'new-unseen', order_id: 'a', sender_type: 'customer', is_read: false },
        { id: 'outgoing', order_id: 'a', sender_type: 'admin', is_read: false },
        { id: 'other-order', order_id: 'b', sender_type: 'customer', is_read: false },
    ];
    const requests: Array<{ ids: string[]; filters: Array<[string, string | boolean]> }> = [];
    const client = { from(table: string) {
        assert.equal(table, 'order_messages');
        return { update(values: { is_read: true }) {
            const request = { ids: [] as string[], filters: [] as Array<[string, string | boolean]> };
            const query = {
                eq(column: string, value: string | boolean) { request.filters.push([column, value]); return query; },
                in(column: string, values: string[]) { assert.equal(column, 'id'); request.ids = values; return query; },
                then<TResult1 = { error: Error | null }, TResult2 = never>(
                    resolve?: ((value: { error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
                    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
                ) {
                    requests.push(request);
                    if (!options.error) for (const row of rows) {
                        if (request.ids.includes(row.id) && request.filters.every(([column, value]) => row[column as keyof typeof row] === value)) Object.assign(row, values);
                    }
                    options.onWrite?.();
                    return Promise.resolve({ error: options.error || null }).then(resolve, reject);
                },
            };
            return query;
        } };
    } };
    return { rows, requests, client };
}

test('receipts acknowledge only displayed incoming IDs in the selected order', async () => {
    const data = store();
    const displayed = [data.rows[0], data.rows[2], data.rows[3]].map(row => ({ ...row }));
    assert.deepEqual(await markDisplayedCustomerMessagesRead(data.client, 'a', displayed, () => true), ['visible']);
    assert.deepEqual(data.rows.filter(row => row.is_read).map(row => row.id), ['visible']);
});

test('no selected order, no incoming unread messages or inactive workspace makes no write', async () => {
    for (const [orderId, active, messages] of [['', true, ['visible']], ['a', false, ['visible']], ['a', true, ['outgoing']]] as const) {
        const data = store();
        await markDisplayedCustomerMessagesRead(data.client, orderId, data.rows.filter(row => messages.some(id => id === row.id)), () => active);
        assert.equal(data.requests.length, 0);
    }
});

test('failed receipts do not acknowledge local success', async () => {
    const error = new Error('Permission denied');
    const data = store({ error });
    await assert.rejects(markDisplayedCustomerMessagesRead(data.client, 'a', data.rows, () => true), error);
    assert.equal(data.rows.some(row => row.is_read), false);
});

test('late completion after a workspace switch cannot change local state or start another batch', async () => {
    let active = true;
    const data = store({ onWrite: () => { active = false; } });
    const messages = Array.from({ length: 201 }, (_, index) => ({ ...data.rows[0], id: `visible-${index}` }));
    assert.deepEqual(await markDisplayedCustomerMessagesRead(data.client, 'a', messages, () => active), []);
    assert.equal(data.requests.length, 1);
    assert.equal(data.requests[0].ids.length, 100);
});
