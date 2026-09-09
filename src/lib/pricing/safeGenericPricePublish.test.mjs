import assert from "node:assert/strict";
import test from "node:test";

import {
  getGenericPriceConflictKey,
  publishGenericPricesSafely,
} from "./safeGenericPricePublish.ts";

const row = (quantity, id) => ({
  id,
  product_id: "product-1",
  variant_name: "variant",
  variant_value: "value",
  quantity,
});

test("publishes every batch before updating the product and deleting stale rows", async () => {
  const events = [];
  const progress = [];

  const result = await publishGenericPricesSafely({
    existingRows: [row(10, "keep"), row(99, "stale")],
    desiredRows: [row(10), row(20), row(30)],
    batchSize: 2,
    upsertBatch: async (rows) => {
      events.push(`upsert:${rows.map((item) => item.quantity).join(",")}`);
    },
    updateProduct: async () => {
      events.push("update-product");
    },
    deleteStaleBatch: async (ids) => {
      events.push(`delete:${ids.join(",")}`);
    },
    onProgress: (saved, total) => progress.push(`${saved}/${total}`),
  });

  assert.deepEqual(events, [
    "upsert:10,20",
    "upsert:30",
    "update-product",
    "delete:stale",
  ]);
  assert.deepEqual(progress, ["2/3", "3/3"]);
  assert.deepEqual(result, { saved: 3, deletedStale: 1 });
});

test("does not update the product or delete existing rows when a price batch fails", async () => {
  const events = [];

  await assert.rejects(
    publishGenericPricesSafely({
      existingRows: [row(10, "existing")],
      desiredRows: [row(10), row(20)],
      batchSize: 1,
      upsertBatch: async (rows) => {
        events.push(`upsert:${rows[0].quantity}`);
        if (rows[0].quantity === 20) throw new Error("timeout");
      },
      updateProduct: async () => {
        events.push("update-product");
      },
      deleteStaleBatch: async () => {
        events.push("delete");
      },
    }),
    /timeout/,
  );

  assert.deepEqual(events, ["upsert:10", "upsert:20"]);
});

test("does not remove stale rows when the product update fails", async () => {
  const events = [];

  await assert.rejects(
    publishGenericPricesSafely({
      existingRows: [row(99, "stale")],
      desiredRows: [row(10)],
      upsertBatch: async () => {
        events.push("upsert");
      },
      updateProduct: async () => {
        events.push("update-product");
        throw new Error("product update failed");
      },
      deleteStaleBatch: async () => {
        events.push("delete");
      },
    }),
    /product update failed/,
  );

  assert.deepEqual(events, ["upsert", "update-product"]);
});

test("uses the database conflict key for deduplication", () => {
  assert.equal(
    getGenericPriceConflictKey(row(25)),
    "product-1|variant|value|25",
  );
});
