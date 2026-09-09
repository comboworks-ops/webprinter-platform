import assert from 'node:assert/strict';
import test from 'node:test';
import { markSupportConversationRead } from './supportReadReceipts.ts';

const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const tenantContext = { roleReady: true, isMaster: false, selectedTenantId: null, myTenantId: 'shop-a' };

function messageStore(error: unknown = null) {
    const rows = ['shop-a', 'shop-b', MASTER_TENANT_ID].flatMap(tenant_id =>
        ['master', 'tenant'].flatMap(sender_role => [false, true].map(is_read => ({
            id: `${tenant_id}:${sender_role}:${is_read}`, tenant_id, sender_role, is_read,
        }))),
    );
    const updated: string[] = [];
    let requests = 0;
    const client = {
        from(table: string) {
            requests += 1;
            assert.equal(table, 'platform_messages');
            return {
                update(values: { is_read: true }) {
                    assert.deepEqual(values, { is_read: true });
                    const filters: Array<[string, string | boolean]> = [];
                    const query = {
                        eq(column: string, value: string | boolean) { filters.push([column, value]); return query; },
                        then<TResult1 = { error: unknown }, TResult2 = never>(
                            resolve?: ((result: { error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
                            reject?: ((error: unknown) => TResult2 | PromiseLike<TResult2>) | null,
                        ) {
                            if (!error) {
                                for (const row of rows) {
                                    if (filters.every(([column, value]) => row[column as keyof typeof row] === value)) {
                                        row.is_read = values.is_read;
                                        updated.push(row.id);
                                    }
                                }
                            }
                            return Promise.resolve({ error }).then(resolve, reject);
                        },
                    };
                    return query;
                },
            };
        },
    };
    return { client, rows, updated, get requests() { return requests; } };
}

test('opening tenant support without a selected thread reads only its incoming unread messages', async () => {
    const store = messageStore();
    await markSupportConversationRead(store.client, tenantContext);
    assert.deepEqual(store.updated, ['shop-a:master:false']);
});

test('a tenant cannot redirect read receipts using a different selected tenant', async () => {
    const store = messageStore();
    await markSupportConversationRead(store.client, { ...tenantContext, selectedTenantId: 'shop-b' });
    assert.deepEqual(store.updated, ['shop-a:master:false']);
});

test('a master reads only incoming unread messages for the explicitly selected shop', async () => {
    const store = messageStore();
    await markSupportConversationRead(store.client, { ...tenantContext, isMaster: true, myTenantId: MASTER_TENANT_ID, selectedTenantId: 'shop-b' });
    assert.deepEqual(store.updated, ['shop-b:tenant:false']);
});

test('unresolved context, a missing tenant, and an unselected master make no requests', async () => {
    for (const context of [
        { ...tenantContext, roleReady: false, selectedTenantId: 'shop-a' },
        { ...tenantContext, myTenantId: null, selectedTenantId: 'shop-b' },
        { ...tenantContext, isMaster: true, myTenantId: MASTER_TENANT_ID },
    ]) {
        const store = messageStore();
        await markSupportConversationRead(store.client, context);
        assert.equal(store.requests, 0);
    }
});

test('opening the master platform lead log preserves all unread evidence', async () => {
    const store = messageStore();
    await markSupportConversationRead(store.client, { ...tenantContext, isMaster: true, selectedTenantId: MASTER_TENANT_ID });
    assert.equal(store.requests, 0);
    assert.deepEqual(store.updated, []);
});

test('a failed read receipt remains an error and does not claim a local update', async () => {
    const failure = new Error('Permission denied');
    const store = messageStore(failure);
    await assert.rejects(markSupportConversationRead(store.client, { ...tenantContext, selectedTenantId: 'shop-a' }), failure);
    assert.deepEqual(store.updated, []);
});
