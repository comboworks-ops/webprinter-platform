import assert from "node:assert/strict";
import test from "node:test";

import * as trackingModule from "./postnordTracking.ts";
import {
  assertPostNordEventForPersistence,
  normalizePostNordTrackingPayload,
  PostNordTrackingError,
} from "./postnordTracking.ts";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const ORDER_ID = "20000000-0000-4000-8000-000000000002";
const TRACKING_NUMBER = "00373500489530470000";
const RECEIVED_AT = new Date("2026-08-01T12:00:00.000Z");

function context(
  overrides: Record<string, unknown> = {},
): Parameters<typeof normalizePostNordTrackingPayload>[1] {
  return {
    requestedTenantId: TENANT_ID,
    requestedOrderId: ORDER_ID,
    order: {
      id: ORDER_ID,
      tenantId: TENANT_ID,
      trackingNumber: TRACKING_NUMBER,
    },
    receivedAt: RECEIVED_AT,
    ...overrides,
  } as Parameters<typeof normalizePostNordTrackingPayload>[1];
}

function payload(
  events: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    TrackingInformationResponse: {
      shipments: [
        {
          shipmentId: TRACKING_NUMBER,
          items: [{ itemId: TRACKING_NUMBER, events }],
        },
      ],
      ...overrides,
    },
  });
}

test("normalizes supported PostNord v5 events as immutable display-only evidence", async () => {
  const raw = payload([
    {
      eventId: "event-information",
      eventTime: "2026-07-31T08:00:00+02:00",
      eventCode: "INFORMATION_RECEIVED",
      eventDescription: "Forsendelsesoplysninger modtaget",
      location: { displayName: "København Pakkecenter" },
    },
    {
      eventId: "event-delivered",
      eventTime: "2026-08-01T11:22:33Z",
      eventCode: "DELIVERED",
      eventDescription: "Forsendelsen er leveret",
      location: { displayName: "København Ø" },
    },
  ]);

  const events = await normalizePostNordTrackingPayload(raw, context());

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.displayType), [
    "delivered",
    "information",
  ]);
  assert.equal(events[0].schemaVersion, 1);
  assert.equal(events[0].carrier, "postnord");
  assert.equal(events[0].effect, "display_only");
  assert.equal(events[0].trackingNumber, TRACKING_NUMBER);
  assert.equal(events[0].providerEventId, "event-delivered");
  assert.equal(events[0].providerStatus, "DELIVERED");
  assert.equal(events[0].occurredAt, "2026-08-01T11:22:33.000Z");
  assert.equal(events[0].receivedAt, RECEIVED_AT.toISOString());
  assert.equal(events[0].location, "København Ø");
  assert.equal(events[0].description, "Forsendelsen er leveret");
  assert.match(events[0].sourceDigest, /^[a-f0-9]{64}$/);
  assert.match(events[0].fallbackDedupeKey, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(events));
  assert.ok(Object.isFrozen(events[0]));
});

test("uses deterministic fallback dedupe and collapses exact provider replay", async () => {
  const repeated = {
    eventTime: "2026-08-01T09:15:00.000Z",
    eventCode: "IN_TRANSIT",
    eventDescription: "Undervejs",
    location: { name: "Taulov" },
  };
  const first = await normalizePostNordTrackingPayload(
    payload([repeated, repeated]),
    context(),
  );
  const second = await normalizePostNordTrackingPayload(
    payload([repeated, repeated]),
    context(),
  );

  assert.equal(first.length, 1);
  assert.equal(first[0].providerEventId, null);
  assert.equal(first[0].fallbackDedupeKey, second[0].fallbackDedupeKey);
  assert.equal(first[0].displayType, "in_transit");
});

test("unknown provider statuses remain displayable and never imply an order mutation", async () => {
  const [event] = await normalizePostNordTrackingPayload(
    payload([
      {
        eventTime: "2026-08-01T09:15:00.000Z",
        eventCode: "FUTURE_STATUS_9000",
        eventDescription: "Ny hændelse",
      },
    ]),
    context(),
  );

  assert.equal(event.providerStatus, "FUTURE_STATUS_9000");
  assert.equal(event.displayType, "unknown");
  assert.equal(event.effect, "display_only");
  assert.equal("orderStatus" in event, false);
  assert.equal("suggestedOrderStatus" in event, false);
});

test("fails closed on invalid time, tracking mismatch, oversized text, malformed payload, or unrelated order", async () => {
  const validEvent = {
    eventTime: "2026-08-01T09:15:00.000Z",
    eventCode: "IN_TRANSIT",
  };
  const badCases: ReadonlyArray<
    readonly [string, string, ReturnType<typeof context>]
  > = [
    [
      "invalid time",
      payload([{ ...validEvent, eventTime: "not-a-time" }]),
      context(),
    ],
    [
      "tracking mismatch",
      JSON.stringify({
        TrackingInformationResponse: {
          shipments: [{
            shipmentId: "UNRELATED123",
            items: [{ itemId: "UNRELATED123", events: [validEvent] }],
          }],
        },
      }),
      context(),
    ],
    [
      "oversized description",
      payload([{ ...validEvent, eventDescription: "x".repeat(501) }]),
      context(),
    ],
    ["malformed payload", "{not-json", context()],
    [
      "unrelated tenant",
      payload([validEvent]),
      context({ requestedTenantId: "30000000-0000-4000-8000-000000000003" }),
    ],
    [
      "unrelated order",
      payload([validEvent]),
      context({ requestedOrderId: "40000000-0000-4000-8000-000000000004" }),
    ],
  ];

  for (const [label, raw, orderContext] of badCases) {
    await assert.rejects(
      () => normalizePostNordTrackingPayload(raw, orderContext),
      (error) =>
        error instanceof PostNordTrackingError &&
        error.code === "invalid_tracking_data",
      label,
    );
  }
});

test("the source digest binds the exact provider bytes", async () => {
  const event = {
    eventTime: "2026-08-01T09:15:00.000Z",
    eventCode: "IN_TRANSIT",
  };
  const compact = payload([event]);
  const spaced = JSON.stringify(JSON.parse(compact), null, 2);

  const [first] = await normalizePostNordTrackingPayload(compact, context());
  const [second] = await normalizePostNordTrackingPayload(spaced, context());

  assert.notEqual(first.sourceDigest, second.sourceDigest);
  assert.equal(first.fallbackDedupeKey, second.fallbackDedupeKey);
});

test("persistence validation accepts only the exact display-only order scope", async () => {
  const [event] = await normalizePostNordTrackingPayload(
    payload([{
      eventTime: "2026-08-01T09:15:00.000Z",
      eventCode: "IN_TRANSIT",
    }]),
    context(),
  );

  assert.equal(
    assertPostNordEventForPersistence(event, {
      tenantId: TENANT_ID,
      orderId: ORDER_ID,
      trackingNumber: TRACKING_NUMBER,
    }),
    event,
  );
  assert.throws(
    () =>
      assertPostNordEventForPersistence(
        { ...event, effect: "update_order" } as never,
        {
          tenantId: TENANT_ID,
          orderId: ORDER_ID,
          trackingNumber: TRACKING_NUMBER,
        },
      ),
    PostNordTrackingError,
  );
  assert.throws(
    () =>
      assertPostNordEventForPersistence(event, {
        tenantId: TENANT_ID,
        orderId: "50000000-0000-4000-8000-000000000005",
        trackingNumber: TRACKING_NUMBER,
      }),
    PostNordTrackingError,
  );
  assert.throws(
    () =>
      assertPostNordEventForPersistence(
        { ...event, mutateOrderStatus: "delivered" },
        {
          tenantId: TENANT_ID,
          orderId: ORDER_ID,
          trackingNumber: TRACKING_NUMBER,
        },
      ),
    PostNordTrackingError,
  );
});

test("the pure tracking module exposes no order-write or notification operation", () => {
  const forbidden = /update.*order|order.*status|send.*email|notify/i;
  assert.deepEqual(
    Object.keys(trackingModule).filter((name) => forbidden.test(name)),
    [],
  );
});
