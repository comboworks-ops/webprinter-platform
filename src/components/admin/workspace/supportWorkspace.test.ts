import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSupportMessages, loadSupportTenants, resolveSupportWorkspace, sendSupportConversationMessage, supportConversationTarget, SUPPORT_MASTER_TENANT_ID } from './supportWorkspace.ts';
import { markSupportConversationRead } from './supportReadReceipts.ts';

type Row = Record<string, any>;
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

function supportStore(options: { pauseRead?: Promise<void>; pauseAuth?: Promise<void>; failure?: unknown; anonymous?: boolean } = {}) {
    const rows: Row[] = [SUPPORT_MASTER_TENANT_ID, 'shop-a', 'shop-b'].flatMap(tenant_id =>
        ['master', 'tenant'].map(sender_role => ({ id: `${tenant_id}:${sender_role}`, tenant_id, sender_role, content: 'Hello', is_read: false })),
    );
    const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
    const inserts: Row[] = [];
    const receipts: string[] = [];
    let authRequests = 0;
    const client = {
        auth: { async getUser() {
            authRequests += 1;
            await options.pauseAuth;
            return { data: { user: options.anonymous ? null : { id: 'operator' } } };
        } },
        from(table: string) {
            return {
                select() {
                    const request = { table, filters: [] as Array<[string, unknown]> };
                    let start = 0;
                    let end = 499;
                    const query: any = {
                        eq(column: string, value: unknown) { request.filters.push([column, value]); return query; },
                        order() { return query; },
                        range(from: number, to: number) { start = from; end = to; return query; },
                        async then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
                            reads.push(request);
                            await options.pauseRead;
                            return Promise.resolve({
                                data: (table === 'tenants' ? [{ id: 'shop-a', name: 'Shop A', domain: 'a.dk' }] : rows)
                                    .filter(row => request.filters.every(([key, value]) => row[key] === value)).slice(start, end + 1),
                                error: options.failure || null,
                            }).then(resolve, reject);
                        },
                    };
                    return query;
                },
                async insert(values: Row) { inserts.push(values); return { error: options.failure || null }; },
                update(values: Row) {
                    const filters: Array<[string, unknown]> = [];
                    const query: any = {
                        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
                        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
                            for (const row of rows.filter(row => filters.every(([key, value]) => row[key] === value))) {
                                Object.assign(row, values); receipts.push(row.id);
                            }
                            return Promise.resolve({ error: null }).then(resolve, reject);
                        },
                    };
                    return query;
                },
            };
        },
    };
    return { client, rows, reads, inserts, receipts, get authRequests() { return authRequests; } };
}

for (const scenario of [
    { label: 'a master account in the master workspace', isMasterAdmin: true, tenantId: SUPPORT_MASTER_TENANT_ID, isMaster: true },
    { label: 'a master account in a tenant workspace', isMasterAdmin: true, tenantId: 'shop-a', isMaster: false },
    { label: 'an ordinary tenant account', isMasterAdmin: false, tenantId: 'shop-a', isMaster: false },
]) {
    test(`${scenario.label} scopes reads, controls, sender role and receipts to its active workspace`, async () => {
        const store = supportStore();
        const workspace = resolveSupportWorkspace(scenario);
        const conversation = { ...workspace, selectedTenantId: 'shop-b' };
        assert.equal(workspace.isMaster, scenario.isMaster);
        const messages = await loadSupportMessages(store.client, workspace, () => true);
        assert.deepEqual([...new Set(messages?.map(message => message.tenant_id))], scenario.isMaster ? [SUPPORT_MASTER_TENANT_ID, 'shop-a', 'shop-b'] : ['shop-a']);
        assert.deepEqual(store.reads[0].filters, scenario.isMaster ? [] : [['tenant_id', 'shop-a']]);
        const tenants = await loadSupportTenants(store.client, workspace, () => true);
        assert.equal(tenants !== null, scenario.isMaster);
        assert.equal(store.reads.some(read => read.table === 'tenants'), scenario.isMaster);
        const target = scenario.isMaster ? 'shop-b' : 'shop-a';
        assert.equal(supportConversationTarget(conversation), target);
        assert.equal(await sendSupportConversationMessage(store.client, conversation, '  Test draft  ', false, () => true), 'sent');
        assert.deepEqual(store.inserts, [{ tenant_id: target, sender_role: scenario.isMaster ? 'master' : 'tenant', content: 'Test draft', sender_user_id: 'operator' }]);
        await markSupportConversationRead(store.client, conversation);
        assert.deepEqual(store.receipts, [`${target}:${scenario.isMaster ? 'tenant' : 'master'}`]);
    });
}

test('unresolved workspace cannot fetch messages or tenant controls, send or mark read', async () => {
    const store = supportStore();
    const context = { ...resolveSupportWorkspace({ isMasterAdmin: true, tenantId: null }), selectedTenantId: 'shop-b' };
    assert.equal(context.isMaster, false);
    assert.equal(await loadSupportMessages(store.client, context, () => true), null);
    assert.equal(await loadSupportTenants(store.client, context, () => true), null);
    assert.equal(await sendSupportConversationMessage(store.client, context, 'Hello', false, () => true), 'cancelled');
    await markSupportConversationRead(store.client, context);
    assert.deepEqual([store.reads, store.inserts, store.receipts], [[], [], []]);
    assert.equal(store.authRequests, 0);
});

test('master support requires a selected conversation before sending or marking read', async () => {
    const store = supportStore();
    const context = { ...resolveSupportWorkspace({ isMasterAdmin: true, tenantId: SUPPORT_MASTER_TENANT_ID }), selectedTenantId: null };
    assert.equal(await sendSupportConversationMessage(store.client, context, 'Hello', false, () => true), 'cancelled');
    await markSupportConversationRead(store.client, context);
    assert.deepEqual([store.inserts, store.receipts], [[], []]);
});

test('the master platform lead log preserves unread evidence and cannot send a support reply', async () => {
    const store = supportStore();
    const context = { ...resolveSupportWorkspace({ isMasterAdmin: true, tenantId: SUPPORT_MASTER_TENANT_ID }), selectedTenantId: SUPPORT_MASTER_TENANT_ID };
    assert.equal(await sendSupportConversationMessage(store.client, context, 'Hello', true, () => true), 'cancelled');
    await markSupportConversationRead(store.client, context);
    assert.deepEqual([store.inserts, store.receipts], [[], []]);
    assert.equal(store.authRequests, 0);
});

test('late platform message and tenant-picker responses are discarded after a workspace switch', async () => {
    const pause = deferred<void>();
    const oldStore = supportStore({ pauseRead: pause.promise });
    const oldContext = resolveSupportWorkspace({ isMasterAdmin: true, tenantId: SUPPORT_MASTER_TENANT_ID });
    let oldActive = true;
    const oldMessages = loadSupportMessages(oldStore.client, oldContext, () => oldActive);
    const oldTenants = loadSupportTenants(oldStore.client, oldContext, () => oldActive);
    oldActive = false;
    const newStore = supportStore();
    const newMessages = await loadSupportMessages(newStore.client, resolveSupportWorkspace({ isMasterAdmin: true, tenantId: 'shop-a' }), () => true);
    pause.resolve();
    assert.equal(await oldMessages, null);
    assert.equal(await oldTenants, null);
    assert.deepEqual(newMessages?.map(message => message.tenant_id), ['shop-a', 'shop-a']);
});

test('switching workspace while authentication is delayed prevents an old draft from being submitted', async () => {
    const pause = deferred<void>();
    const store = supportStore({ pauseAuth: pause.promise });
    const context = { ...resolveSupportWorkspace({ isMasterAdmin: true, tenantId: SUPPORT_MASTER_TENANT_ID }), selectedTenantId: 'shop-b' };
    let active = true;
    const send = sendSupportConversationMessage(store.client, context, 'Old draft', false, () => active);
    active = false;
    pause.resolve();
    assert.equal(await send, 'cancelled');
    assert.deepEqual(store.inserts, []);
});

test('permission failures do not become empty success and missing auth cannot insert', async () => {
    const failure = new Error('Permission denied');
    const store = supportStore({ failure });
    const context = { ...resolveSupportWorkspace({ isMasterAdmin: false, tenantId: 'shop-a' }), selectedTenantId: null };
    await assert.rejects(loadSupportMessages(store.client, context, () => true), failure);
    const anonymous = supportStore({ anonymous: true });
    await assert.rejects(sendSupportConversationMessage(anonymous.client, context, 'Hello', false, () => true), /Log ind igen/);
    assert.deepEqual(anonymous.inserts, []);
});
