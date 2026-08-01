import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrackingTimeline,
  canonicalizePostNordTrackingNumber,
  mapTrackingEventRow,
} from "./trackingEvents.ts";

const POSTNORD_ROW = {
  id: "10000000-0000-4000-8000-000000000001",
  schema_version: 1,
  carrier: "postnord",
  tracking_number: "00373500489530470000",
  provider_status: "DELIVERED",
  display_type: "delivered",
  occurred_at: "2026-08-01T10:00:00.000Z",
  received_at: "2026-08-01T10:01:00.000Z",
  location: "København Ø",
  description: "Forsendelsen er leveret",
} as const;

test("maps version 1 carrier evidence to Danish display labels", () => {
  const event = mapTrackingEventRow(POSTNORD_ROW);

  assert.equal(event.label, "Pakken er leveret");
  assert.equal(event.carrierLabel, "PostNord");
  assert.equal(event.source, "postnord");
  assert.equal(event.occurredAt, POSTNORD_ROW.occurred_at);
  assert.equal(event.providerTimestamp, POSTNORD_ROW.received_at);
  assert.equal(event.location, "København Ø");
  assert.equal(event.effect, "display_only");
  assert.equal("orderStatus" in event, false);
});

test("unknown schema versions and event types render a safe generic event", () => {
  const event = mapTrackingEventRow({
    ...POSTNORD_ROW,
    schema_version: 99,
    display_type: "future_autonomous_delivery",
    description: "Ny leveringshændelse",
  });

  assert.equal(event.label, "Forsendelsesopdatering");
  assert.equal(event.source, "unknown");
  assert.equal(event.description, "Ny leveringshændelse");
  assert.equal(event.effect, "display_only");
});

test("legacy delivery_tracking rows remain available as a fallback", () => {
  const timeline = buildTrackingTimeline({
    v1Rows: [],
    legacyRows: [
      {
        id: "legacy-1",
        event_type: "picked_up",
        location: "Aarhus",
        description: "Afhentet",
        occurred_at: "2026-07-31T09:00:00.000Z",
      },
    ],
  });

  assert.equal(timeline.state, "ready");
  assert.equal(timeline.events.length, 1);
  assert.equal(timeline.events[0].label, "Afhentet af fragtfirma");
  assert.equal(timeline.events[0].source, "legacy");
  assert.equal(timeline.events[0].carrierLabel, "Leveringshistorik");
});

test("canonical tracking identity ignores display separators but rejects ambiguous characters", () => {
  assert.equal(
    canonicalizePostNordTrackingNumber(" 0037 3500-4895 3047 0000 "),
    "00373500489530470000",
  );
  assert.equal(canonicalizePostNordTrackingNumber("96932007555se"), "96932007555SE");
  assert.equal(canonicalizePostNordTrackingNumber("0037/3500"), null);
  assert.equal(canonicalizePostNordTrackingNumber("   "), null);
});

test("a reassigned order shows events only for its current canonical tracking identity", () => {
  const timeline = buildTrackingTimeline({
    trackingNumber: "0037 3500-4895 3047 0000",
    v1Rows: [
      POSTNORD_ROW,
      {
        ...POSTNORD_ROW,
        id: "10000000-0000-4000-8000-000000000099",
        tracking_number: "OLD-TRACKING-IDENTITY",
        description: "Old parcel",
      },
    ],
    legacyRows: [],
  });

  assert.deepEqual(timeline.events.map((event) => event.id), [POSTNORD_ROW.id]);
});

test("mixed timelines sort newest first without inferring an order status", () => {
  const timeline = buildTrackingTimeline({
    v1Rows: [
      POSTNORD_ROW,
      {
        ...POSTNORD_ROW,
        id: "20000000-0000-4000-8000-000000000002",
        display_type: "unknown",
        occurred_at: "invalid-provider-time",
      },
    ],
    legacyRows: [
      {
        id: "legacy-1",
        event_type: "in_transit",
        location: null,
        description: null,
        occurred_at: "2026-07-31T09:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(
    timeline.events.map((event) => event.id),
    [POSTNORD_ROW.id, "legacy-1", "20000000-0000-4000-8000-000000000002"],
  );
  assert.equal(timeline.effect, "display_only");
  assert.equal(timeline.suggestedOrderStatus, null);
});

test("loading, empty, and unavailable states are explicit and non-authoritative", () => {
  assert.equal(
    buildTrackingTimeline({ v1Rows: [], legacyRows: [], loading: true }).state,
    "loading",
  );
  assert.equal(
    buildTrackingTimeline({ v1Rows: [], legacyRows: [] }).state,
    "empty",
  );
  const unavailable = buildTrackingTimeline({
    v1Rows: [],
    legacyRows: [],
    providerUnavailable: true,
  });
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.suggestedOrderStatus, null);
});
