import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDistributionRequest,
  distributeProduct,
  isProductDistributable,
  loadDistributionShops,
  loadPendingDistributions,
  selectAllShops,
  validateDistributionSelection,
} from "./distribution.ts";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

test("distribution rejects an empty selection", () => {
  assert.throws(
    () => buildDistributionRequest({ productId: "product-1", selectedTenantIds: [] }),
    /mindst én butik/i,
  );
});

test("distribution removes master and duplicate ids", () => {
  assert.deepEqual(
    buildDistributionRequest({
      productId: "product-1",
      selectedTenantIds: ["tenant-a", "tenant-a", MASTER_TENANT_ID],
    }),
    {
      master_product_id: "product-1",
      tenant_ids: ["tenant-a"],
      delivery_mode: "pod_price_list",
    },
  );
});

test("distribution rejects a selection containing only the master tenant", () => {
  assert.throws(
    () => buildDistributionRequest({
      productId: "product-1",
      selectedTenantIds: [MASTER_TENANT_ID, MASTER_TENANT_ID],
    }),
    /mindst én butik/i,
  );
});

test("select all is explicit and derives only from unique eligible shops", () => {
  assert.deepEqual(
    selectAllShops([
      { id: "a", eligible: true },
      { id: "b", eligible: false },
      { id: "a", eligible: true },
      { id: MASTER_TENANT_ID, eligible: true },
    ]),
    ["a"],
  );
});

test("draft products with a retained master import are never distributable", () => {
  for (const readinessStatus of ["ready", "distributed"] as const) {
    assert.equal(isProductDistributable({
      catalog: { status: "draft" },
      masterProduct: { id: "master-product" },
      readiness: { status: readinessStatus },
    }), false);
  }
});

test("published products with a retained master import and eligible readiness are distributable", () => {
  for (const readinessStatus of ["ready", "distributed"] as const) {
    assert.equal(isProductDistributable({
      catalog: { status: "published" },
      masterProduct: { id: "master-product" },
      readiness: { status: readinessStatus },
    }), true);
  }
});

test("shop loading removes master and derives eligibility from automatic settlement", async () => {
  const ranges: Array<[number, number]> = [];
  const orderColumns: string[] = [];
  const shops = await loadDistributionShops({
    from(table) {
      assert.equal(table, "tenants");
      return {
        select(columns) {
          assert.equal(columns, "id, name, domain, pod2_auto_forward");
          const query = {
            neq(column, value) {
              assert.equal(column, "id");
              assert.equal(value, MASTER_TENANT_ID);
              return query;
            },
            order(orderColumn) {
              orderColumns.push(orderColumn);
              return query;
            },
            range(from: number, to: number) {
              ranges.push([from, to]);
              return Promise.resolve({
                data: [
                  { id: "eligible", name: "Butik A", domain: "a.dk", pod2_auto_forward: true },
                  { id: "ineligible", name: "Butik B", domain: "b.dk", pod2_auto_forward: false },
                  { id: MASTER_TENANT_ID, name: "Master", domain: "webprinter.dk", pod2_auto_forward: true },
                ],
                error: null,
              });
            },
          };
          return query;
        },
      };
    },
  });

  assert.deepEqual(shops, [
    { id: "eligible", name: "Butik A", domain: "a.dk", eligible: true },
    { id: "ineligible", name: "Butik B", domain: "b.dk", eligible: false },
  ]);
  assert.deepEqual(orderColumns, ["name", "id"]);
  assert.deepEqual(ranges, [[0, 199]]);
});

test("shop loading fails closed when the bounded directory window is exhausted", async () => {
  const ranges: Array<[number, number]> = [];

  await assert.rejects(
    loadDistributionShops({
      from() {
        return {
          select() {
            const query = {
              neq() {
                return query;
              },
              order() {
                return query;
              },
              range(from: number, to: number) {
                ranges.push([from, to]);
                return Promise.resolve({
                  data: [
                    { id: `tenant-${from}`, name: `Butik ${from}`, pod2_auto_forward: true },
                    { id: `tenant-${from + 1}`, name: `Butik ${from + 1}`, pod2_auto_forward: true },
                  ],
                  error: null,
                });
              },
            };
            return query;
          },
        };
      },
    }, { pageSize: 2, maxPages: 2 }),
    /butikslisten er for stor til at kunne indlæses sikkert/i,
  );

  assert.deepEqual(ranges, [[0, 1], [2, 3]]);
});

test("latest directory validation returns every valid selected shop", () => {
  const shops = [
    { id: "tenant-a", name: "Butik A", domain: "a.dk", eligible: true },
    { id: "tenant-b", name: "Butik B", domain: "b.dk", eligible: true },
  ];

  assert.deepEqual(
    validateDistributionSelection(["tenant-a", "tenant-b"], shops),
    shops,
  );
});

test("latest directory validation rejects a disappeared shop", () => {
  assert.throws(
    () => validateDistributionSelection(["tenant-a", "tenant-missing"], [
      { id: "tenant-a", name: "Butik A", domain: "a.dk", eligible: true },
    ]),
    /findes ikke længere/i,
  );
});

test("latest directory validation rejects a newly ineligible shop", () => {
  assert.throws(
    () => validateDistributionSelection(["tenant-a"], [
      { id: "tenant-a", name: "Butik A", domain: "a.dk", eligible: false },
    ]),
    /ikke længere klar til automatisk afregning/i,
  );
});

test("latest directory validation never accepts the master tenant", () => {
  assert.throws(
    () => validateDistributionSelection([MASTER_TENANT_ID], [{
      id: MASTER_TENANT_ID,
      name: "Master",
      domain: "webprinter.dk",
      eligible: true,
    }]),
    /masterbutikken kan ikke vælges/i,
  );
});

test("pending distribution loading paginates, normalizes, and filters current products", async () => {
  const ranges: Array<[number, number]> = [];
  const productScopes: string[][] = [];
  const rows = [
    {
      id: "pending-new",
      tenant_id: "tenant-a",
      status: "pending",
      created_at: "2026-07-14T12:00:00Z",
      data: { product_id: "product-1", delivery_mode: "pod_price_list" },
    },
    {
      id: "other-product",
      tenant_id: "tenant-x",
      status: "pending",
      created_at: "2026-07-14T13:00:00Z",
      data: { product_id: "product-outside-page", delivery_mode: "pod_price_list" },
    },
    {
      id: "pending-old",
      tenant_id: "tenant-a",
      status: "pending",
      created_at: "2026-07-14T10:00:00Z",
      data: { product_id: "product-1", delivery_mode: "pod_price_list" },
    },
    {
      id: "pending-second",
      tenant_id: "tenant-b",
      status: "pending",
      created_at: "2026-07-14T11:00:00Z",
      data: { product_id: "product-2", delivery_mode: "pod_price_list" },
    },
    {
      id: "wrong-mode",
      tenant_id: "tenant-c",
      status: "pending",
      created_at: "2026-07-14T09:00:00Z",
      data: { product_id: "product-2", delivery_mode: "price_list" },
    },
  ];

  const pending = await loadPendingDistributions({
    from(table) {
      assert.equal(table, "tenant_notifications");
      return {
        select(columns) {
          assert.equal(columns, "id, tenant_id, status, created_at, data");
          const query = {
            eq() {
              return query;
            },
            contains() {
              return query;
            },
            in(column: string, values: string[]) {
              assert.equal(column, "data->>product_id");
              productScopes.push(values);
              return query;
            },
            order() {
              return query;
            },
            range(from: number, to: number) {
              ranges.push([from, to]);
              return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
            },
          };
          return query;
        },
      };
    },
  }, ["product-1", "product-2"], { pageSize: 2, maxPages: 3 });

  assert.deepEqual(ranges, [[0, 1], [2, 3], [4, 5]]);
  assert.deepEqual(productScopes, [
    ["product-1", "product-2"],
    ["product-1", "product-2"],
    ["product-1", "product-2"],
  ]);
  assert.deepEqual(pending, [
    {
      id: "pending-new",
      tenantId: "tenant-a",
      productId: "product-1",
      createdAt: "2026-07-14T12:00:00Z",
    },
    {
      id: "pending-second",
      tenantId: "tenant-b",
      productId: "product-2",
      createdAt: "2026-07-14T11:00:00Z",
    },
  ]);
});

test("pending distribution loading fails closed when relevant results may be truncated", async () => {
  const ranges: Array<[number, number]> = [];

  await assert.rejects(
    loadPendingDistributions({
      from() {
        return {
          select() {
            const query = {
              eq() {
                return query;
              },
              contains() {
                return query;
              },
              in(column: string, values: string[]) {
                assert.equal(column, "data->>product_id");
                assert.deepEqual(values, ["product-1"]);
                return query;
              },
              order() {
                return query;
              },
              range(from: number, to: number) {
                ranges.push([from, to]);
                return Promise.resolve({
                  data: [
                    {
                      id: `pending-${from}`,
                      tenant_id: `tenant-${from}`,
                      status: "pending",
                      created_at: `2026-07-14T1${from}:00:00Z`,
                      data: { product_id: "product-1", delivery_mode: "pod_price_list" },
                    },
                    {
                      id: `pending-${from + 1}`,
                      tenant_id: `tenant-${from + 1}`,
                      status: "pending",
                      created_at: `2026-07-14T1${from + 1}:00:00Z`,
                      data: { product_id: "product-1", delivery_mode: "pod_price_list" },
                    },
                  ],
                  error: null,
                });
              },
            };
            return query;
          },
        };
      },
    }, ["product-1"], { pageSize: 2, maxPages: 2 }),
    /kan ikke afgrænses sikkert/i,
  );

  assert.deepEqual(ranges, [[0, 1], [2, 3]]);
});

test("distributeProduct calls the RPC once and preserves selection on a partial result", async () => {
  const selectedTenantIds = ["tenant-a", "tenant-b", "tenant-c"];
  const selectionBefore = [...selectedTenantIds];
  const calls: Array<{ name: string; request: unknown }> = [];

  const result = await distributeProduct({
    async rpc(name, request) {
      calls.push({ name, request });
      return {
        data: { copied: 1, notified: 1, skipped_existing: 1 },
        error: null,
      };
    },
  }, {
    productId: "product-1",
    selectedTenantIds,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    name: "send_product_to_tenants",
    request: {
      master_product_id: "product-1",
      tenant_ids: selectedTenantIds,
      delivery_mode: "pod_price_list",
    },
  });
  assert.deepEqual(result, { copied: 1, notified: 1, skipped_existing: 1 });
  assert.deepEqual(selectedTenantIds, selectionBefore);
});

test("distributeProduct throws the RPC message after one call", async () => {
  let callCount = 0;
  const selectedTenantIds = ["tenant-a"];

  await assert.rejects(
    distributeProduct({
      async rpc() {
        callCount += 1;
        return { data: null, error: { message: "Distributionen kunne ikke gennemføres" } };
      },
    }, {
      productId: "product-1",
      selectedTenantIds,
    }),
    /Distributionen kunne ikke gennemføres/,
  );

  assert.equal(callCount, 1);
  assert.deepEqual(selectedTenantIds, ["tenant-a"]);
});
