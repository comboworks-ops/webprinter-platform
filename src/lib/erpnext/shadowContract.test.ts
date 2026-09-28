import assert from "node:assert/strict";
import test from "node:test";

import {
  buildErpShadowEvent,
  parseErpShadowEvent,
} from "./shadowContract.ts";
import { evaluateErpShadowPolicy } from "./shadowPolicy.ts";

const validInput = {
  tenantId: "tenant-demo",
  orderId: "order-1001",
  revision: 0,
  occurredAt: "2026-07-27T08:30:00.000Z",
  currency: "DKK",
  totalSellingPrice: 1249,
  customerRef: "customer-42",
  fulfillmentMode: "internal" as const,
  lines: [
    {
      sourceOrderItemId: "item-1",
      sourceProductId: "folder-a4",
      title: "A4 mappe",
      quantity: 100,
      unitSellingPrice: 12.49,
      selectedOptions: {
        paper: "350g silk",
        color: "4+0",
      },
      productionRecipeRef: "recipe-folder-a4-v1",
      machineProfileRef: "machine-komori-1",
      estimatedRunMinutes: 18,
      materialRequirements: [
        {
          materialRef: "paper-350g-silk",
          quantity: 125,
          unit: "sheet" as const,
        },
      ],
    },
  ],
};

test("builds a deterministic, shadow-only production event", () => {
  const event = buildErpShadowEvent(validInput);

  assert.equal(event.effect, "shadow_only");
  assert.equal(event.payload.production.inventoryPosting, "disabled");
  assert.equal(event.payload.accounting.posting, "disabled");
  assert.equal(
    event.idempotencyKey,
    "webprinter:tenant-demo:production-order:order-1001:revision-0",
  );
  assert.deepEqual(Object.keys(event.payload.lines[0].selectedOptions), [
    "color",
    "paper",
  ]);
});

test("strict contract rejects personal and payment data", () => {
  assert.throws(() =>
    buildErpShadowEvent({
      ...validInput,
      customerEmail: "person@example.test",
      cardNumber: "4111111111111111",
    } as never)
  );

  const serialized = JSON.stringify(buildErpShadowEvent(validInput));
  assert.doesNotMatch(serialized, /@|card|password|secret/i);
});

test("event parser refuses any request for live effects", () => {
  const event = buildErpShadowEvent(validInput);

  assert.throws(() =>
    parseErpShadowEvent({
      ...event,
      effect: "live",
    })
  );
});

test("invalid quantities and currencies fail at the boundary", () => {
  assert.throws(() =>
    buildErpShadowEvent({
      ...validInput,
      currency: "dkk",
      lines: [{ ...validInput.lines[0], quantity: 0 }],
    })
  );
});

test("policy is disabled by default and requires master context", () => {
  assert.deepEqual(
    evaluateErpShadowPolicy({
      enabled: false,
      environment: "production",
      isMasterContext: true,
      endpoint: "https://erp.example.test/events",
    }),
    {
      canDispatch: false,
      mode: "disabled",
      reason: "feature_disabled",
      endpoint: null,
    },
  );

  assert.equal(
    evaluateErpShadowPolicy({
      enabled: true,
      environment: "production",
      isMasterContext: false,
      endpoint: "https://erp.example.test/events",
    }).reason,
    "non_master_context",
  );
});

test("policy allows local HTTP only outside production", () => {
  assert.equal(
    evaluateErpShadowPolicy({
      enabled: true,
      environment: "development",
      isMasterContext: true,
      endpoint: "http://127.0.0.1:8789/v1/events",
    }).canDispatch,
    true,
  );

  assert.equal(
    evaluateErpShadowPolicy({
      enabled: true,
      environment: "production",
      isMasterContext: true,
      endpoint: "http://erp.example.test/v1/events",
    }).reason,
    "insecure_endpoint",
  );
});
