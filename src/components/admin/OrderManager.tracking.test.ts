import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./OrderManager.tsx", import.meta.url);

test("OrderManager queries and maps carrier evidence only for the saved canonical identity", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /canonicalizePostNordTrackingNumber\(savedTrackingNumber\)/,
  );
  assert.match(
    source,
    /select\('id,schema_version,carrier,tracking_number,provider_status,[^']+'\)/,
  );
  assert.match(
    source,
    /\.eq\('order_id', orderId\)\s*\.eq\('tracking_number', trackingIdentity\)/,
  );
  assert.match(
    source,
    /buildTrackingTimeline\(\{\s*trackingNumber: trackingIdentity,/,
  );
  assert.match(
    source,
    /coordinator\.beginRequest\(orderId, trackingIdentity\)/,
  );
});
