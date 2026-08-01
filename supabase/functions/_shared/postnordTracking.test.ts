import assert from "node:assert/strict";
import test from "node:test";

import OFFICIAL_V5_SUCCESS from "./fixtures/postnord-v5-track-by-identifier-success.json" with {
  type: "json",
};

import * as trackingModule from "./postnordTracking.ts";
import {
  assertPostNordEventForPersistence,
  normalizePostNordTrackingPayload,
  PostNordTrackingError,
} from "./postnordTracking.ts";
import {
  authorizePostNordSyncOrder,
  fetchPostNordTrackingPayload,
  isMatchingPostNordReplayRow,
  parsePostNordSyncRequest,
  persistPostNordEventsAtomically,
  POSTNORD_PRODUCTION_TRACKING_URL,
  POSTNORD_SANDBOX_TRACKING_URL,
  PostNordSyncError,
  syncAuthorizedPostNordOrder,
} from "./postnordTrackingSync.ts";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const ORDER_ID = "20000000-0000-4000-8000-000000000002";
const TRACKING_NUMBER = "00373500489530470000";
const RECEIVED_AT = new Date("2026-08-01T12:00:00.000Z");
const OFFICIAL_V5_SUCCESS_FIXTURE = JSON.stringify(OFFICIAL_V5_SUCCESS);

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

test("normalizes the official PostNord v5 event shape using semantic status and preserves eventCode", async () => {
  const trackingNumber = "96932007555SE";
  const events = await normalizePostNordTrackingPayload(
    OFFICIAL_V5_SUCCESS_FIXTURE,
    {
      requestedTenantId: TENANT_ID,
      requestedOrderId: ORDER_ID,
      order: {
        id: ORDER_ID,
        tenantId: TENANT_ID,
        trackingNumber,
      },
      receivedAt: RECEIVED_AT,
    },
  );

  assert.deepEqual(
    events.map((event) => ({
      providerEventId: event.providerEventId,
      providerEventCode: event.providerEventCode,
      providerStatus: event.providerStatus,
      displayType: event.displayType,
      occurredAt: event.occurredAt,
    })),
    [
      {
        providerEventId: null,
        providerEventCode: "21",
        providerStatus: "DELIVERED",
        displayType: "delivered",
        occurredAt: "2026-07-16T10:00:00.000Z",
      },
      {
        providerEventId: null,
        providerEventCode: "31",
        providerStatus: "EN_ROUTE",
        displayType: "in_transit",
        occurredAt: "2026-07-15T10:00:00.000Z",
      },
      {
        providerEventId: null,
        providerEventCode: "68",
        providerStatus: "INFORMED",
        displayType: "information",
        occurredAt: "2026-01-15T11:00:00.000Z",
      },
    ],
  );
});

test("uses deterministic Europe/Copenhagen DST handling for timezone-less PostNord event times", async () => {
  const overlap = await normalizePostNordTrackingPayload(
    payload([{
      eventTime: "2026-10-25T02:30:00",
      eventCode: "31",
      status: "EN_ROUTE",
    }]),
    context(),
  );
  assert.equal(overlap[0].occurredAt, "2026-10-25T00:30:00.000Z");

  await assert.rejects(
    () =>
      normalizePostNordTrackingPayload(
        payload([{
          eventTime: "2026-03-29T02:30:00",
          eventCode: "31",
          status: "EN_ROUTE",
        }]),
        context(),
      ),
    (error) =>
      error instanceof PostNordTrackingError &&
      error.code === "invalid_tracking_data",
  );
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

test("sync requests accept one exact order ID and never accept tracking numbers or provider URLs", () => {
  const request = parsePostNordSyncRequest({ orderId: ORDER_ID });
  assert.deepEqual(request, { orderId: ORDER_ID });
  assert.ok(Object.isFrozen(request));

  for (
    const bad of [
      {},
      { orderId: "not-a-uuid" },
      { orderId: ORDER_ID, trackingNumber: TRACKING_NUMBER },
      { orderId: ORDER_ID, providerUrl: "https://example.invalid" },
      { orderIds: [ORDER_ID] },
    ]
  ) {
    assert.throws(
      () => parsePostNordSyncRequest(bad),
      (error) =>
        error instanceof PostNordSyncError && error.code === "invalid_request",
    );
  }
});

test("order authorization binds the verified user, tenant, order, and server-side tracking number", async () => {
  const calls: string[] = [];
  const authorized = await authorizePostNordSyncOrder(
    parsePostNordSyncRequest({ orderId: ORDER_ID }),
    "30000000-0000-4000-8000-000000000003",
    {
      loadOrder(orderId) {
        calls.push(`order:${orderId}`);
        return Promise.resolve({
          id: ORDER_ID,
          tenantId: TENANT_ID,
          trackingNumber: TRACKING_NUMBER,
        });
      },
      canAccessTenant(tenantId) {
        calls.push(`tenant:${tenantId}`);
        return Promise.resolve(true);
      },
      hasExactMasterRole() {
        calls.push("master");
        return Promise.resolve(false);
      },
    },
  );

  assert.deepEqual(authorized, {
    id: ORDER_ID,
    tenantId: TENANT_ID,
    trackingNumber: TRACKING_NUMBER,
  });
  assert.deepEqual(calls, [`order:${ORDER_ID}`, `tenant:${TENANT_ID}`]);
  assert.ok(Object.isFrozen(authorized));
});

test("cross-tenant order access fails before provider or persistence work while exact master access is explicit", async () => {
  let masterChecks = 0;
  const dependencies = {
    loadOrder: () =>
      Promise.resolve({
        id: ORDER_ID,
        tenantId: TENANT_ID,
        trackingNumber: TRACKING_NUMBER,
      }),
    canAccessTenant: () => Promise.resolve(false),
    hasExactMasterRole: () => {
      masterChecks += 1;
      return Promise.resolve(false);
    },
  };
  await assert.rejects(
    () =>
      authorizePostNordSyncOrder(
        { orderId: ORDER_ID },
        "30000000-0000-4000-8000-000000000003",
        dependencies,
      ),
    (error) => error instanceof PostNordSyncError && error.code === "forbidden",
  );
  assert.equal(masterChecks, 1);

  const master = await authorizePostNordSyncOrder(
    { orderId: ORDER_ID },
    "40000000-0000-4000-8000-000000000004",
    { ...dependencies, hasExactMasterRole: () => Promise.resolve(true) },
  );
  assert.equal(master.id, ORDER_ID);
  assert.equal(master.trackingNumber, TRACKING_NUMBER);
});

test("disabled, incomplete, and unapproved provider configuration fails before fetch", async () => {
  let fetchCalls = 0;
  const fetchImpl = () => {
    fetchCalls += 1;
    return Promise.reject(new Error("must not run"));
  };
  const invalidConfigurations = [
    {
      enabled: false,
      environment: "sandbox",
      apiKey: "a".repeat(32),
      productionApproved: false,
    },
    {
      enabled: true,
      environment: "sandbox",
      apiKey: "",
      productionApproved: false,
    },
    {
      enabled: true,
      environment: "production",
      apiKey: "a".repeat(32),
      productionApproved: false,
    },
    {
      enabled: true,
      environment: "https://attacker.invalid",
      apiKey: "a".repeat(32),
      productionApproved: true,
    },
  ] as const;

  for (const providerConfig of invalidConfigurations) {
    await assert.rejects(
      () =>
        fetchPostNordTrackingPayload(TRACKING_NUMBER, {
          fetchImpl,
          providerConfig,
        }),
      (error) =>
        error instanceof PostNordSyncError &&
        error.code === "provider_unavailable",
    );
  }
  assert.equal(fetchCalls, 0);
});

test("provider fetch uses only the fixed v5 sandbox or production endpoint", async () => {
  const raw = payload([{
    eventTime: "2026-08-01T09:15:00.000Z",
    eventCode: "IN_TRANSIT",
  }]);
  for (
    const [environment, baseUrl] of [
      ["sandbox", POSTNORD_SANDBOX_TRACKING_URL],
      ["production", POSTNORD_PRODUCTION_TRACKING_URL],
    ] as const
  ) {
    const apiKey = `${environment}-` + "a".repeat(32);
    let observedUrl = "";
    const result = await fetchPostNordTrackingPayload(TRACKING_NUMBER, {
      providerConfig: {
        enabled: true,
        environment,
        apiKey,
        productionApproved: environment === "production",
      },
      fetchImpl(input, init) {
        observedUrl = String(input);
        const url = new URL(observedUrl);
        assert.equal(url.origin + url.pathname, baseUrl);
        assert.equal(url.searchParams.get("apikey"), apiKey);
        assert.equal(url.searchParams.get("id"), TRACKING_NUMBER);
        assert.equal(url.searchParams.get("locale"), "en");
        assert.equal(init?.method, "GET");
        assert.equal(init?.redirect, "manual");
        assert.equal(
          new Headers(init?.headers).get("accept"),
          "application/json",
        );
        const response = new Response(raw, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
        Object.defineProperty(response, "url", { value: observedUrl });
        return Promise.resolve(response);
      },
    });
    assert.equal(result, raw);
  }
});

test("provider fetch never follows redirects, bounds bodies, and surfaces 429 without retrying", async () => {
  const providerConfig = {
    enabled: true,
    environment: "sandbox",
    apiKey: "a".repeat(32),
    productionApproved: false,
  } as const;
  let rateLimitCalls = 0;
  await assert.rejects(
    () =>
      fetchPostNordTrackingPayload(TRACKING_NUMBER, {
        providerConfig,
        fetchImpl(input) {
          rateLimitCalls += 1;
          const response = new Response("{}", {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "120",
            },
          });
          Object.defineProperty(response, "url", { value: String(input) });
          return Promise.resolve(response);
        },
      }),
    (error) =>
      error instanceof PostNordSyncError &&
      error.code === "rate_limited" &&
      error.retryAfterSeconds === 120,
  );
  assert.equal(rateLimitCalls, 1);

  for (
    const makeResponse of [
      (url: string) => {
        const response = new Response("{}", {
          status: 302,
          headers: { location: "https://attacker.invalid" },
        });
        Object.defineProperty(response, "url", { value: url });
        return response;
      },
      (_url: string) => {
        const response = new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
        Object.defineProperty(response, "url", {
          value: "https://attacker.invalid/redirected",
        });
        return response;
      },
      (url: string) => {
        const response = new Response("{}", {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": String(32 * 1024 + 1),
          },
        });
        Object.defineProperty(response, "url", { value: url });
        return response;
      },
    ]
  ) {
    await assert.rejects(
      () =>
        fetchPostNordTrackingPayload(TRACKING_NUMBER, {
          providerConfig,
          fetchImpl(input) {
            return Promise.resolve(makeResponse(String(input)));
          },
        }),
      (error) =>
        error instanceof PostNordSyncError &&
        error.code === "provider_unavailable",
    );
  }
});

test("authorized sync inserts carrier evidence only and returns a minimal display DTO", async () => {
  const authorizedOrder = {
    id: ORDER_ID,
    tenantId: TENANT_ID,
    trackingNumber: TRACKING_NUMBER,
  } as const;
  let insertedEvents: readonly unknown[] = [];
  let fetchTrackingNumber = "";
  const result = await syncAuthorizedPostNordOrder(authorizedOrder, {
    now: RECEIVED_AT,
    fetchPayload(trackingNumber) {
      fetchTrackingNumber = trackingNumber;
      return Promise.resolve(payload([{
        eventId: "event-1",
        eventTime: "2026-08-01T09:15:00.000Z",
        eventCode: "DELIVERED",
        eventDescription: "Leveret",
      }]));
    },
    repository: {
      insertEvents(events) {
        insertedEvents = events;
        return Promise.resolve({ inserted: 1, replayed: 0 });
      },
    },
  });

  assert.equal(fetchTrackingNumber, TRACKING_NUMBER);
  assert.equal(insertedEvents.length, 1);
  assert.equal(
    (insertedEvents[0] as { effect: string }).effect,
    "display_only",
  );
  assert.equal(result.effect, "display_only");
  assert.equal(result.inserted, 1);
  assert.equal(result.replayed, 0);
  assert.equal(result.events[0].displayType, "delivered");
  assert.equal("trackingNumber" in result.events[0], false);
  assert.equal("sourceDigest" in result.events[0], false);
  assert.equal("fallbackDedupeKey" in result.events[0], false);
  assert.equal("orderStatus" in result, false);
});

test("malformed provider evidence remains unavailable and never reaches persistence", async () => {
  let insertCalls = 0;
  await assert.rejects(
    () =>
      syncAuthorizedPostNordOrder({
        id: ORDER_ID,
        tenantId: TENANT_ID,
        trackingNumber: TRACKING_NUMBER,
      }, {
        now: RECEIVED_AT,
        fetchPayload: () => Promise.resolve('{"unexpected":true}'),
        repository: {
          insertEvents() {
            insertCalls += 1;
            return Promise.resolve({ inserted: 0, replayed: 0 });
          },
        },
      }),
    (error) =>
      error instanceof PostNordSyncError &&
      error.code === "provider_unavailable",
  );
  assert.equal(insertCalls, 0);
});

test("database conflicts count as replay only when immutable scope and event identity match", async () => {
  const [event] = await normalizePostNordTrackingPayload(
    payload([{
      eventId: "event-1",
      eventTime: "2026-08-01T09:15:00.000Z",
      eventCode: "IN_TRANSIT",
      eventDescription: "Undervejs",
    }]),
    context(),
  );
  const row = {
    schema_version: event.schemaVersion,
    carrier: event.carrier,
    tenant_id: event.tenantId,
    order_id: event.orderId,
    tracking_number: event.trackingNumber,
    provider_event_id: event.providerEventId,
    provider_event_code: event.providerEventCode,
    fallback_dedupe_key: event.fallbackDedupeKey,
    provider_status: event.providerStatus,
    display_type: event.displayType,
    occurred_at: event.occurredAt,
    location: event.location,
    description: event.description,
  };
  assert.equal(isMatchingPostNordReplayRow(event, row), true);
  assert.equal(
    isMatchingPostNordReplayRow(event, {
      ...row,
      order_id: "50000000-0000-4000-8000-000000000005",
    }),
    false,
  );
  assert.equal(
    isMatchingPostNordReplayRow(event, {
      ...row,
      fallback_dedupe_key: "f".repeat(64),
    }),
    false,
  );
});

test("persistence crosses the database boundary once with the exact immutable event batch", async () => {
  const events = await normalizePostNordTrackingPayload(
    payload([
      {
        eventId: "event-1",
        eventTime: "2026-08-01T09:15:00.000Z",
        eventCode: "31",
        status: "EN_ROUTE",
      },
      {
        eventId: "event-2",
        eventTime: "2026-08-01T10:15:00.000Z",
        eventCode: "21",
        status: "DELIVERED",
      },
    ]),
    context(),
  );
  const calls: Array<readonly [string, unknown]> = [];

  const result = await persistPostNordEventsAtomically(events, {
    rpc(name, args) {
      calls.push([name, args]);
      return Promise.resolve({
        data: [{ inserted_count: 2, replayed_count: 0 }],
        error: null,
      });
    },
  });

  assert.deepEqual(result, { inserted: 2, replayed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "persist_postnord_tracking_events_v1");
  const args = calls[0][1] as { _events: Array<Record<string, unknown>> };
  assert.equal(args._events.length, 2);
  assert.deepEqual(Object.keys(args._events[0]).sort(), [
    "carrier",
    "description",
    "display_type",
    "fallback_dedupe_key",
    "location",
    "occurred_at",
    "order_id",
    "provider_event_code",
    "provider_event_id",
    "provider_status",
    "received_at",
    "schema_version",
    "source_digest",
    "tenant_id",
    "tracking_number",
  ]);
  assert.deepEqual(
    args._events.map((event) => event.provider_event_code),
    ["21", "31"],
  );
  assert.equal("effect" in args._events[0], false);
});

test("atomic persistence fails closed on an RPC error or malformed count result", async () => {
  const events = await normalizePostNordTrackingPayload(
    payload([{
      eventId: "event-1",
      eventTime: "2026-08-01T09:15:00.000Z",
      eventCode: "31",
      status: "EN_ROUTE",
    }]),
    context(),
  );

  for (const response of [
    { data: null, error: { code: "23505" } },
    { data: [{ inserted_count: 2, replayed_count: 0 }], error: null },
    { data: [], error: null },
  ]) {
    await assert.rejects(
      () =>
        persistPostNordEventsAtomically(events, {
          rpc: () => Promise.resolve(response),
        }),
      (error) =>
        error instanceof PostNordSyncError &&
        error.code === "persistence_failed",
    );
  }
});
