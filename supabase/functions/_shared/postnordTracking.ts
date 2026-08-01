export const POSTNORD_TRACKING_SCHEMA_VERSION = 1 as const;
export const POSTNORD_TRACKING_MAX_BODY_BYTES = 32 * 1024;

const SHA256_HEX = /^[a-f0-9]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_INSTANT_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const PERSISTED_EVENT_KEYS = new Set([
  "schemaVersion",
  "tenantId",
  "orderId",
  "carrier",
  "trackingNumber",
  "providerEventId",
  "fallbackDedupeKey",
  "providerStatus",
  "displayType",
  "occurredAt",
  "receivedAt",
  "location",
  "description",
  "sourceDigest",
  "effect",
]);

const DISPLAY_TYPES = new Set<PostNordDisplayType>([
  "information",
  "in_transit",
  "out_for_delivery",
  "available_for_pickup",
  "delivered",
  "exception",
  "unknown",
]);

const STATUS_TYPES: Readonly<Record<string, PostNordDisplayType>> = Object
  .freeze({
    INFORMATION_RECEIVED: "information",
    ELECTRONIC_NOTIFICATION: "information",
    PRE_ADVICE: "information",
    REGISTERED: "information",
    IN_TRANSIT: "in_transit",
    INTRANSIT: "in_transit",
    TRANSPORTING: "in_transit",
    SORTED: "in_transit",
    DEPARTED: "in_transit",
    ARRIVED: "in_transit",
    OUT_FOR_DELIVERY: "out_for_delivery",
    OUTFORDELIVERY: "out_for_delivery",
    OFD: "out_for_delivery",
    AVAILABLE_FOR_PICKUP: "available_for_pickup",
    READY_FOR_PICKUP: "available_for_pickup",
    AVAILABLE_FOR_DELIVERY: "available_for_pickup",
    PICKUP: "available_for_pickup",
    DELIVERED: "delivered",
    DELIVERY: "delivered",
    DELIVERY_FAILED: "exception",
    EXCEPTION: "exception",
    RETURNED: "exception",
    CUSTOMS_HOLD: "exception",
    DELAYED: "exception",
  });

export type PostNordDisplayType =
  | "information"
  | "in_transit"
  | "out_for_delivery"
  | "available_for_pickup"
  | "delivered"
  | "exception"
  | "unknown";

export type TrackingOrderScope = Readonly<{
  tenantId: string;
  orderId: string;
  trackingNumber: string;
}>;

export type PostNordOrderContext = Readonly<{
  requestedTenantId: string;
  requestedOrderId: string;
  order: Readonly<{
    id: string;
    tenantId: string;
    trackingNumber: string;
  }>;
  receivedAt: Date;
}>;

export type NormalizedPostNordEvent = Readonly<{
  schemaVersion: 1;
  tenantId: string;
  orderId: string;
  carrier: "postnord";
  trackingNumber: string;
  providerEventId: string | null;
  fallbackDedupeKey: string;
  providerStatus: string;
  displayType: PostNordDisplayType;
  occurredAt: string;
  receivedAt: string;
  location: string | null;
  description: string | null;
  sourceDigest: string;
  effect: "display_only";
}>;

export type PostNordTrackingErrorCode = "invalid_tracking_data";

export class PostNordTrackingError extends Error {
  readonly code: PostNordTrackingErrorCode;

  constructor(code: PostNordTrackingErrorCode = "invalid_tracking_data") {
    super("Invalid PostNord tracking evidence");
    this.name = "PostNordTrackingError";
    this.code = code;
  }
}

export async function normalizePostNordTrackingPayload(
  rawBody: string,
  context: PostNordOrderContext,
): Promise<readonly NormalizedPostNordEvent[]> {
  try {
    const scope = normalizeOrderContext(context);
    const receivedAt = canonicalDate(context.receivedAt);
    const bytes = exactUtf8Bytes(rawBody);
    if (
      bytes.byteLength < 2 ||
      bytes.byteLength > POSTNORD_TRACKING_MAX_BODY_BYTES
    ) {
      throw invalidTrackingData();
    }
    if (hasDuplicateJsonObjectKeys(rawBody)) throw invalidTrackingData();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody) as unknown;
    } catch {
      throw invalidTrackingData();
    }
    const sourceDigest = await sha256Bytes(bytes);
    const candidates = await normalizeProviderResponse(
      parsed,
      scope,
      receivedAt,
      sourceDigest,
    );
    return deepFreeze(deduplicateAndSort(candidates));
  } catch (error) {
    if (error instanceof PostNordTrackingError) throw error;
    throw invalidTrackingData();
  }
}

export function assertPostNordEventForPersistence(
  input: unknown,
  expected: TrackingOrderScope,
): NormalizedPostNordEvent {
  try {
    const scope = normalizeScope(expected);
    if (!isPlainRecord(input)) throw invalidTrackingData();
    if (
      !hasExactStringKeys(input, PERSISTED_EVENT_KEYS) ||
      input.schemaVersion !== POSTNORD_TRACKING_SCHEMA_VERSION ||
      input.tenantId !== scope.tenantId ||
      input.orderId !== scope.orderId ||
      input.carrier !== "postnord" ||
      input.trackingNumber !== scope.trackingNumber ||
      input.effect !== "display_only" ||
      !isNullableBoundedText(input.providerEventId, 256) ||
      !isSha256(input.fallbackDedupeKey) ||
      !isBoundedText(input.providerStatus, 120) ||
      !DISPLAY_TYPES.has(input.displayType as PostNordDisplayType) ||
      !isCanonicalInstant(input.occurredAt) ||
      !isCanonicalInstant(input.receivedAt) ||
      !isNullableBoundedText(input.location, 256) ||
      !isNullableBoundedText(input.description, 500) ||
      !isSha256(input.sourceDigest)
    ) {
      throw invalidTrackingData();
    }
    return input as NormalizedPostNordEvent;
  } catch (error) {
    if (error instanceof PostNordTrackingError) throw error;
    throw invalidTrackingData();
  }
}

async function normalizeProviderResponse(
  input: unknown,
  scope: TrackingOrderScope,
  receivedAt: string,
  sourceDigest: string,
): Promise<NormalizedPostNordEvent[]> {
  if (!isPlainRecord(input)) throw invalidTrackingData();
  const response = input.TrackingInformationResponse;
  if (!isPlainRecord(response) || !Array.isArray(response.shipments)) {
    throw invalidTrackingData();
  }
  if (response.shipments.length < 1 || response.shipments.length > 10) {
    throw invalidTrackingData();
  }

  const expectedIdentifier = canonicalIdentifier(scope.trackingNumber);
  let foundMatchingIdentifier = false;
  let itemCount = 0;
  let eventCount = 0;
  const events: NormalizedPostNordEvent[] = [];

  for (const shipmentValue of response.shipments) {
    if (!isPlainRecord(shipmentValue) || !Array.isArray(shipmentValue.items)) {
      throw invalidTrackingData();
    }
    const shipmentId = optionalIdentifier(shipmentValue.shipmentId);
    const shipmentMatches = shipmentId !== null &&
      canonicalIdentifier(shipmentId) === expectedIdentifier;
    if (shipmentValue.items.length > 50) throw invalidTrackingData();

    for (const itemValue of shipmentValue.items) {
      itemCount += 1;
      if (itemCount > 50 || !isPlainRecord(itemValue)) {
        throw invalidTrackingData();
      }
      const itemId = requiredIdentifier(itemValue.itemId);
      const itemMatches = canonicalIdentifier(itemId) === expectedIdentifier;
      if (!shipmentMatches && !itemMatches) continue;
      foundMatchingIdentifier = true;
      if (!Array.isArray(itemValue.events) || itemValue.events.length > 200) {
        throw invalidTrackingData();
      }
      for (const eventValue of itemValue.events) {
        eventCount += 1;
        if (eventCount > 200) throw invalidTrackingData();
        events.push(
          await normalizeProviderEvent(
            eventValue,
            scope,
            receivedAt,
            sourceDigest,
          ),
        );
      }
    }
  }

  if (!foundMatchingIdentifier) throw invalidTrackingData();
  return events;
}

async function normalizeProviderEvent(
  input: unknown,
  scope: TrackingOrderScope,
  receivedAt: string,
  sourceDigest: string,
): Promise<NormalizedPostNordEvent> {
  if (!isPlainRecord(input)) throw invalidTrackingData();
  const providerEventId = optionalBoundedText(input.eventId, 256);
  const statusValue = input.eventCode ?? input.status;
  const providerStatus = requiredBoundedText(statusValue, 120);
  const occurredAt = canonicalInstant(input.eventTime);
  const description = optionalBoundedText(input.eventDescription, 500);
  const location = normalizeLocation(input.location);
  const displayType = mapProviderStatus(providerStatus);
  const fallbackDedupeKey = await sha256CanonicalJson({
    carrier: "postnord",
    trackingNumber: scope.trackingNumber,
    providerEventId,
    providerStatus,
    occurredAt,
    location,
    description,
  });

  return deepFreeze({
    schemaVersion: POSTNORD_TRACKING_SCHEMA_VERSION,
    tenantId: scope.tenantId,
    orderId: scope.orderId,
    carrier: "postnord" as const,
    trackingNumber: scope.trackingNumber,
    providerEventId,
    fallbackDedupeKey,
    providerStatus,
    displayType,
    occurredAt,
    receivedAt,
    location,
    description,
    sourceDigest,
    effect: "display_only" as const,
  });
}

function deduplicateAndSort(
  input: readonly NormalizedPostNordEvent[],
): NormalizedPostNordEvent[] {
  const seen = new Map<string, NormalizedPostNordEvent>();
  for (const event of input) {
    const key = event.providerEventId === null
      ? `fallback:${event.fallbackDedupeKey}`
      : `provider:${event.providerEventId}`;
    const previous = seen.get(key);
    if (
      previous &&
      canonicalEventIdentity(previous) !== canonicalEventIdentity(event)
    ) {
      throw invalidTrackingData();
    }
    if (!previous) seen.set(key, event);
  }
  return [...seen.values()].sort((left, right) => {
    const occurred = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (occurred !== 0) return occurred;
    return eventStableKey(left).localeCompare(eventStableKey(right));
  });
}

function normalizeOrderContext(
  input: PostNordOrderContext,
): TrackingOrderScope {
  if (!isPlainRecord(input) || !isPlainRecord(input.order)) {
    throw invalidTrackingData();
  }
  const scope = normalizeScope({
    tenantId: input.order.tenantId,
    orderId: input.order.id,
    trackingNumber: input.order.trackingNumber,
  });
  if (
    input.requestedTenantId !== scope.tenantId ||
    input.requestedOrderId !== scope.orderId
  ) {
    throw invalidTrackingData();
  }
  return scope;
}

function normalizeScope(input: TrackingOrderScope): TrackingOrderScope {
  if (
    !isPlainRecord(input) ||
    !isUuid(input.tenantId) ||
    !isUuid(input.orderId) ||
    !isBoundedText(input.trackingNumber, 100)
  ) {
    throw invalidTrackingData();
  }
  return Object.freeze({
    tenantId: input.tenantId,
    orderId: input.orderId,
    trackingNumber: input.trackingNumber,
  });
}

function mapProviderStatus(value: string): PostNordDisplayType {
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_TYPES[key] ?? "unknown";
}

function normalizeLocation(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return optionalBoundedText(value, 256);
  if (!isPlainRecord(value)) throw invalidTrackingData();
  if (value.displayName !== undefined && value.displayName !== null) {
    return optionalBoundedText(value.displayName, 256);
  }
  if (value.name !== undefined && value.name !== null) {
    return optionalBoundedText(value.name, 256);
  }
  return null;
}

function canonicalEventIdentity(value: NormalizedPostNordEvent): string {
  return stableJson({
    tenantId: value.tenantId,
    orderId: value.orderId,
    carrier: value.carrier,
    trackingNumber: value.trackingNumber,
    providerEventId: value.providerEventId,
    fallbackDedupeKey: value.fallbackDedupeKey,
    providerStatus: value.providerStatus,
    displayType: value.displayType,
    occurredAt: value.occurredAt,
    receivedAt: value.receivedAt,
    location: value.location,
    description: value.description,
    sourceDigest: value.sourceDigest,
    effect: value.effect,
  });
}

function eventStableKey(value: NormalizedPostNordEvent): string {
  return value.providerEventId ?? value.fallbackDedupeKey;
}

function canonicalDate(value: Date): string {
  try {
    const milliseconds = Reflect.apply(Date.prototype.getTime, value, []);
    if (!Number.isFinite(milliseconds)) throw invalidTrackingData();
    return new Date(milliseconds).toISOString();
  } catch {
    throw invalidTrackingData();
  }
}

function canonicalInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !ISO_INSTANT_WITH_ZONE.test(value)
  ) {
    throw invalidTrackingData();
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw invalidTrackingData();
  return parsed.toISOString();
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return canonicalInstant(value) === value;
  } catch {
    return false;
  }
}

function requiredIdentifier(value: unknown): string {
  const identifier = optionalIdentifier(value);
  if (identifier === null) throw invalidTrackingData();
  return identifier;
}

function optionalIdentifier(value: unknown): string | null {
  return optionalBoundedText(value, 100);
}

function canonicalIdentifier(value: string): string {
  return value.toUpperCase();
}

function requiredBoundedText(value: unknown, maximum: number): string {
  const text = optionalBoundedText(value, maximum);
  if (text === null) throw invalidTrackingData();
  return text;
}

function optionalBoundedText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw invalidTrackingData();
  if ([...value].length > maximum || hasControlCharacter(value)) {
    throw invalidTrackingData();
  }
  const text = value.replace(/\s+/gu, " ").trim();
  if (!text || [...text].length > maximum || hasControlCharacter(text)) {
    throw invalidTrackingData();
  }
  return text;
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    [...value].length <= maximum &&
    value === value.trim() &&
    !hasControlCharacter(value);
}

function isNullableBoundedText(
  value: unknown,
  maximum: number,
): value is string | null {
  return value === null || isBoundedText(value, maximum);
}

function exactUtf8Bytes(value: unknown): Uint8Array {
  if (typeof value !== "string") throw invalidTrackingData();
  return new TextEncoder().encode(value);
}

function sha256CanonicalJson(value: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(stableJson(value)));
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function stableJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isPlainRecord(value)) throw invalidTrackingData();
  return "{" +
    Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    ).join(",") + "}";
}

function hasDuplicateJsonObjectKeys(text: string): boolean {
  const stack: Array<
    { kind: "object"; keys: Set<string> } | { kind: "array" }
  > = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      const end = findJsonStringEnd(text, index);
      if (end < 0) return true;
      let cursor = end + 1;
      while (/\s/.test(text[cursor] ?? "")) cursor += 1;
      const container = stack.at(-1);
      if (container?.kind === "object" && text[cursor] === ":") {
        let key: string;
        try {
          key = JSON.parse(text.slice(index, end + 1)) as string;
        } catch {
          return true;
        }
        if (container.keys.has(key)) return true;
        container.keys.add(key);
      }
      index = end;
      continue;
    }
    if (character === "{") stack.push({ kind: "object", keys: new Set() });
    else if (character === "[") stack.push({ kind: "array" });
    else if (character === "}" || character === "]") stack.pop();
  }
  return false;
}

function findJsonStringEnd(text: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') return index;
  }
  return -1;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactStringKeys(
  value: Record<string, unknown>,
  expected: ReadonlySet<string>,
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.size &&
    keys.every((key) => typeof key === "string" && expected.has(key));
}

function invalidTrackingData(): PostNordTrackingError {
  return new PostNordTrackingError();
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
