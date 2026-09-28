import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { dashboardContextQueryOptions } from "./dashboardContext.ts";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

test("dashboard identity follows the admin tenant even when the user also owns another shop", async () => {
    const lookups: string[] = [];
    const tenants = [
        { id: MASTER_TENANT_ID, name: "Platform", settings: { branding: { published: { logo_url: "platform.svg" }, draft: { logo_url: "draft.svg" } } } },
        { id: "owned-shop", name: "Owned shop", settings: { branding: { logo_url: "owned.svg" } } },
    ];
    const context = await dashboardContextQueryOptions("default", {
        resolveTenant: async () => ({ tenantId: MASTER_TENANT_ID }),
        readTenant: async tenantId => {
            lookups.push(tenantId);
            return { data: tenants.find(tenant => tenant.id === tenantId) || null, error: null };
        },
    }).queryFn();

    assert.deepEqual(lookups, [MASTER_TENANT_ID]);
    assert.deepEqual(context, { tenantId: MASTER_TENANT_ID, name: "Platform", logoUrl: "platform.svg" });
});

test("an unresolved admin tenant stays null and never looks up a fallback shop", async () => {
    const context = await dashboardContextQueryOptions("default", {
        resolveTenant: async () => ({ tenantId: null }),
        readTenant: async () => { assert.fail("A missing tenant must not query identity"); },
    }).queryFn();
    assert.equal(context, null);
});

test("identity lookup errors remain failures, including permission and transport failures", async () => {
    for (const error of [new Error("Failed to fetch"), { code: "42501", message: "permission denied" }]) {
        const query = dashboardContextQueryOptions("shop.dk", {
            resolveTenant: async () => ({ tenantId: "shop" }),
            readTenant: async () => ({ data: null, error }),
        });
        await assert.rejects(query.queryFn, actual => actual === error);
    }
});

test("a missing or mismatched tenant row cannot become an empty successful dashboard", async () => {
    for (const data of [null, { id: "other-shop", name: "Other", settings: null }]) {
        await assert.rejects(dashboardContextQueryOptions("shop.dk", {
            resolveTenant: async () => ({ tenantId: "shop" }),
            readTenant: async () => ({ data, error: null }),
        }).queryFn, /Den valgte shop kunne ikke hentes/);
    }
});

test("switching admin context clears the old identity while loading and ignores late results", async () => {
    const client = new QueryClient();
    const late = deferred<{ tenantId: string }>();
    const first = dashboardContextQueryOptions("first.dk", {
        resolveTenant: () => late.promise,
        readTenant: async tenantId => ({ data: { id: tenantId, name: "First", settings: null }, error: null }),
    });
    const second = dashboardContextQueryOptions("second.dk", {
        resolveTenant: async () => ({ tenantId: "second" }),
        readTenant: async tenantId => ({ data: { id: tenantId, name: "Second", settings: null }, error: null }),
    });
    const observer = new QueryObserver(client, first);
    const unsubscribe = observer.subscribe(() => {});
    try {
        assert.equal(observer.getCurrentResult().isPending, true);
        observer.setOptions(second);
        assert.equal(observer.getCurrentResult().data, undefined);
        assert.equal(observer.getCurrentResult().isPending, true);
        await client.fetchQuery(second);
        assert.equal(observer.getCurrentResult().data?.tenantId, "second");
        late.resolve({ tenantId: "first" });
        await client.fetchQuery(first);
        assert.equal(observer.getCurrentResult().data?.tenantId, "second");

        const missing = dashboardContextQueryOptions("missing.dk", {
            resolveTenant: async () => ({ tenantId: null }),
            readTenant: async () => { assert.fail("No identity request for unresolved context"); },
        });
        observer.setOptions(missing);
        assert.equal(observer.getCurrentResult().data, undefined);
        await client.fetchQuery(missing);
        assert.equal(observer.getCurrentResult().isSuccess, true);
        assert.equal(observer.getCurrentResult().data, null);
    } finally {
        unsubscribe();
        client.clear();
    }
});

test("failed new context exposes its error without retaining the previous shop identity", async () => {
    const client = new QueryClient();
    const initial = dashboardContextQueryOptions("first.dk", {
        resolveTenant: async () => ({ tenantId: "first" }),
        readTenant: async tenantId => ({ data: { id: tenantId, name: "First", settings: null }, error: null }),
    });
    const failure = new Error("identity unavailable");
    const failed = dashboardContextQueryOptions("failed.dk", {
        resolveTenant: async () => ({ tenantId: "failed" }),
        readTenant: async () => ({ data: null, error: failure }),
    });
    await client.fetchQuery(initial);
    const observer = new QueryObserver(client, initial);
    const unsubscribe = observer.subscribe(() => {});
    try {
        assert.equal(observer.getCurrentResult().data?.tenantId, "first");
        observer.setOptions(failed);
        assert.equal(observer.getCurrentResult().data, undefined);
        await assert.rejects(client.fetchQuery(failed), failure);
        assert.equal(observer.getCurrentResult().isError, true);
        assert.equal(observer.getCurrentResult().data, undefined);
        assert.equal(observer.getCurrentResult().error, failure);
    } finally {
        unsubscribe();
        client.clear();
    }
});
