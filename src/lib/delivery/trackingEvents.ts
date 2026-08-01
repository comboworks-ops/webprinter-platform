export type TrackingTimelineState =
  | "loading"
  | "empty"
  | "unavailable"
  | "ready";

export type TrackingDisplayEvent = Readonly<{
  id: string;
  label: string;
  carrierLabel: string;
  source: "postnord" | "legacy" | "unknown";
  occurredAt: string | null;
  providerTimestamp: string | null;
  location: string | null;
  description: string | null;
  effect: "display_only";
}>;

export type TrackingTimeline = Readonly<{
  state: TrackingTimelineState;
  events: readonly TrackingDisplayEvent[];
  effect: "display_only";
  suggestedOrderStatus: null;
}>;

const POSTNORD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  information: "Forsendelsesoplysninger modtaget",
  in_transit: "Pakken er undervejs",
  out_for_delivery: "Pakken er ude til levering",
  available_for_pickup: "Pakken er klar til afhentning",
  delivered: "Pakken er leveret",
  exception: "Problem under transport",
  unknown: "Forsendelsesopdatering",
});

const LEGACY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  order_placed: "Ordre modtaget",
  processing: "Behandles",
  in_production: "I produktion",
  quality_check: "Kvalitetskontrol",
  packed: "Pakket",
  picked_up: "Afhentet af fragtfirma",
  in_transit: "Undervejs",
  out_for_delivery: "Ude til levering",
  delivered: "Leveret",
});

export function mapTrackingEventRow(input: unknown): TrackingDisplayEvent {
  const row = isRecord(input) ? input : {};
  const id = safeText(row.id, 128) ?? "tracking-event";
  const description = safeText(row.description, 500);
  const location = safeText(row.location, 256);
  const occurredAt = safeInstant(row.occurred_at);
  const providerTimestamp = safeInstant(row.received_at);
  const isVersionOne = row.schema_version === 1 && row.carrier === "postnord";
  const displayType = safeText(row.display_type, 64);
  const isKnownDisplayType = displayType !== null &&
    Object.hasOwn(POSTNORD_LABELS, displayType);

  return Object.freeze({
    id,
    label: isVersionOne && isKnownDisplayType
      ? POSTNORD_LABELS[displayType]
      : "Forsendelsesopdatering",
    carrierLabel: row.carrier === "postnord" ? "PostNord" : "Fragtfirma",
    source: isVersionOne && isKnownDisplayType
      ? "postnord"
      : "unknown",
    occurredAt,
    providerTimestamp,
    location,
    description,
    effect: "display_only" as const,
  });
}

export function buildTrackingTimeline(input: Readonly<{
  v1Rows: readonly unknown[];
  legacyRows: readonly unknown[];
  loading?: boolean;
  providerUnavailable?: boolean;
}>): TrackingTimeline {
  const current = input.v1Rows.map(mapTrackingEventRow);
  const legacy = input.legacyRows.map(mapLegacyTrackingEventRow);
  const events = [...current, ...legacy].sort(compareEventsNewestFirst);
  const state: TrackingTimelineState = input.loading
    ? "loading"
    : events.length > 0
    ? "ready"
    : input.providerUnavailable
    ? "unavailable"
    : "empty";

  return deepFreeze({
    state,
    events,
    effect: "display_only" as const,
    suggestedOrderStatus: null,
  });
}

function mapLegacyTrackingEventRow(input: unknown): TrackingDisplayEvent {
  const row = isRecord(input) ? input : {};
  const eventType = safeText(row.event_type, 64);
  return Object.freeze({
    id: safeText(row.id, 128) ?? "legacy-tracking-event",
    label: eventType && Object.hasOwn(LEGACY_LABELS, eventType)
      ? LEGACY_LABELS[eventType]
      : "Leveringsopdatering",
    carrierLabel: "Leveringshistorik",
    source: "legacy" as const,
    occurredAt: safeInstant(row.occurred_at),
    providerTimestamp: null,
    location: safeText(row.location, 256),
    description: safeText(row.description, 500),
    effect: "display_only" as const,
  });
}

function compareEventsNewestFirst(
  left: TrackingDisplayEvent,
  right: TrackingDisplayEvent,
): number {
  const leftTime = left.occurredAt ? Date.parse(left.occurredAt) : -Infinity;
  const rightTime = right.occurredAt ? Date.parse(right.occurredAt) : -Infinity;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return left.id.localeCompare(right.id);
}

function safeInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

function safeText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string" || hasControlCharacter(value)) return null;
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) return null;
  return [...normalized].slice(0, maximum).join("");
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}
