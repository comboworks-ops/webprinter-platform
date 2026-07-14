import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDistributionRequest,
  distributeProduct,
  loadDistributionShops,
  selectAllShops,
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

test("shop loading removes master and derives eligibility from automatic settlement", async () => {
  const shops = await loadDistributionShops({
    from(table) {
      assert.equal(table, "tenants");
      return {
        select(columns) {
          assert.equal(columns, "id, name, domain, pod2_auto_forward");
          return {
            neq(column, value) {
              assert.equal(column, "id");
              assert.equal(value, MASTER_TENANT_ID);
              return {
                order(orderColumn) {
                  assert.equal(orderColumn, "name");
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
            },
          };
        },
      };
    },
  });

  assert.deepEqual(shops, [
    { id: "eligible", name: "Butik A", domain: "a.dk", eligible: true },
    { id: "ineligible", name: "Butik B", domain: "b.dk", eligible: false },
  ]);
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
