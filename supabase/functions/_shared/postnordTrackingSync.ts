import {
  assertPostNordEventForPersistence,
  canonicalizePostNordTrackingNumber,
  type NormalizedPostNordEvent,
  normalizePostNordTrackingPayload,
  POSTNORD_TRACKING_MAX_BODY_BYTES,
  PostNordTrackingError,
} from "./postnordTracking.ts";

export const POSTNORD_SANDBOX_TRACKING_URL =
  "https://atapi2.postnord.com/rest/shipment/v5/trackandtrace/findByIdentifier.json";
export const POSTNORD_PRODUCTION_TRACKING_URL =
  "https://api2.postnord.com/rest/shipment/v5/trackandtrace/findByIdentifier.json";
export const POSTNORD_TRACKING_TIMEOUT_MS = 5_000;
export const POSTNORD_MAX_RETRY_AFTER_SECONDS = 2_147_483_647;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORED_UTC_INSTANT =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/;
const REQUEST_KEYS = new Set(["orderId"]);
const MAX_API_KEY_LENGTH = 2_048;
const ADMISSION_DISPOSITIONS = new Set(
  [
    "claimed",
    "cached",
    "in_flight",
    "provider_blocked",
    "rate_limited",
  ] as const,
);
const DEFAULT_PROVIDER_RETRY_AFTER_SECONDS = 60;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type PostNordSyncErrorCode =
  | "invalid_request"
  | "order_not_found"
  | "forbidden"
  | "authorization_unavailable"
  | "provider_unavailable"
  | "rate_limited"
  | "persistence_failed";

export class PostNordSyncError extends Error {
  readonly code: PostNordSyncErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: PostNordSyncErrorCode,
    options: Readonly<{ retryAfterSeconds?: number | null }> = {},
  ) {
    super(messageForCode(code));
    this.name = "PostNordSyncError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export type PostNordSyncRequest = Readonly<{ orderId: string }>;

export type AuthorizedPostNordOrder = Readonly<{
  id: string;
  tenantId: string;
  trackingNumber: string;
}>;

export type PostNordOrderAccessDependencies = Readonly<{
  loadOrder: (orderId: string) => Promise<unknown | null>;
  canAccessTenant: (tenantId: string) => Promise<boolean>;
  hasExactMasterRole: (userId: string) => Promise<boolean>;
}>;

export type PostNordProviderConfig = Readonly<{
  enabled: boolean;
  environment: "sandbox" | "production" | string;
  apiKey: string;
  productionApproved: boolean;
}>;

export type PostNordTrackingRepository = Readonly<{
  insertEvents: (
    claimToken: string,
    events: readonly NormalizedPostNordEvent[],
  ) => Promise<Readonly<{ inserted: number; replayed: number }>>;
}>;

export type PostNordAdmission = Readonly<{
  disposition:
    | "claimed"
    | "cached"
    | "in_flight"
    | "provider_blocked"
    | "rate_limited";
  retryAfterSeconds: number;
  claimToken: string | null;
}>;

export type PostNordStateRpcClient = Readonly<{
  rpc: (
    name: string,
    args: Readonly<Record<string, unknown>>,
  ) => PromiseLike<Readonly<{ data: unknown; error: unknown }>>;
}>;

export type PostNordClaimOutcome = "failed" | "provider_rate_limited";

export type PostNordEventDisplayDto = Readonly<{
  schemaVersion: 1;
  carrier: "postnord";
  providerEventId: string | null;
  providerEventCode: string | null;
  providerStatus: string;
  displayType: NormalizedPostNordEvent["displayType"];
  occurredAt: string;
  receivedAt: string;
  location: string | null;
  description: string | null;
  effect: "display_only";
}>;

export type PostNordSyncResult = Readonly<{
  provider: "postnord";
  effect: "display_only";
  cached: boolean;
  inserted: number;
  replayed: number;
  events: readonly PostNordEventDisplayDto[];
}>;

export function parsePostNordSyncRequest(input: unknown): PostNordSyncRequest {
  try {
    if (!isPlainRecord(input) || !hasExactStringKeys(input, REQUEST_KEYS)) {
      throw invalidRequest();
    }
    if (!isUuid(input.orderId)) throw invalidRequest();
    return Object.freeze({ orderId: input.orderId });
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw invalidRequest();
  }
}

export async function authorizePostNordSyncOrder(
  request: PostNordSyncRequest,
  verifiedUserId: string,
  dependencies: PostNordOrderAccessDependencies,
): Promise<AuthorizedPostNordOrder> {
  try {
    const parsedRequest = parsePostNordSyncRequest(request);
    if (!isUuid(verifiedUserId)) throw forbidden();

    const candidate = await dependencies.loadOrder(parsedRequest.orderId);
    if (candidate === null) throw orderNotFound();
    const order = normalizeAuthorizedOrder(candidate, parsedRequest.orderId);

    const canAccessTenant = await dependencies.canAccessTenant(order.tenantId);
    if (canAccessTenant === true) return order;
    const isMaster = await dependencies.hasExactMasterRole(verifiedUserId);
    if (isMaster !== true) throw forbidden();
    return order;
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw new PostNordSyncError("authorization_unavailable");
  }
}

export async function fetchPostNordTrackingPayload(
  trackingNumber: string,
  options: Readonly<{
    fetchImpl: FetchLike;
    providerConfig: PostNordProviderConfig;
  }>,
): Promise<string> {
  try {
    const normalizedTrackingNumber = canonicalizePostNordTrackingNumber(
      trackingNumber,
    );
    const provider = normalizeProviderConfig(options.providerConfig);
    if (typeof options.fetchImpl !== "function") throw providerUnavailable();

    const requestUrl = new URL(provider.baseUrl);
    requestUrl.searchParams.set("apikey", provider.apiKey);
    requestUrl.searchParams.set("id", normalizedTrackingNumber);
    requestUrl.searchParams.set("locale", "en");
    const exactRequestUrl = requestUrl.toString();

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(providerUnavailable());
      }, POSTNORD_TRACKING_TIMEOUT_MS);
    });
    const providerPromise = (async () => {
      let response: Response;
      try {
        response = await options.fetchImpl(exactRequestUrl, {
          method: "GET",
          redirect: "manual",
          headers: Object.freeze({ Accept: "application/json" }),
          signal: controller.signal,
        });
      } catch {
        throw providerUnavailable();
      }
      if (!(response instanceof Response) || response.url !== exactRequestUrl) {
        throw providerUnavailable();
      }
      if (response.status === 429) {
        throw new PostNordSyncError("rate_limited", {
          retryAfterSeconds: parsePostNordRetryAfter(
            response.headers.get("retry-after"),
          ),
        });
      }
      if (!response.ok || (response.status >= 300 && response.status < 400)) {
        throw providerUnavailable();
      }
      const mediaType = response.headers.get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== "application/json") throw providerUnavailable();
      const contentLength = response.headers.get("content-length");
      if (
        contentLength !== null &&
        (!/^\d+$/.test(contentLength) ||
          Number(contentLength) > POSTNORD_TRACKING_MAX_BODY_BYTES)
      ) {
        throw providerUnavailable();
      }
      const bytes = await readBoundedBody(
        response,
        POSTNORD_TRACKING_MAX_BODY_BYTES,
      );
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw providerUnavailable();
      }
    })();

    try {
      return await Promise.race([providerPromise, timeoutPromise]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw providerUnavailable();
  }
}

export async function syncAuthorizedPostNordOrder(
  authorizedOrder: AuthorizedPostNordOrder,
  dependencies: Readonly<{
    now: Date;
    admit: (order: AuthorizedPostNordOrder) => Promise<PostNordAdmission>;
    renew: (claimToken: string) => Promise<void>;
    finish: (
      claimToken: string,
      outcome: PostNordClaimOutcome,
      retryAfterSeconds: number | null,
    ) => Promise<void>;
    fetchPayload: (trackingNumber: string) => Promise<string>;
    repository: PostNordTrackingRepository;
  }>,
): Promise<PostNordSyncResult> {
  try {
    const order = normalizeAuthorizedOrder(authorizedOrder, authorizedOrder.id);
    const admission = normalizeAdmission(await dependencies.admit(order));
    if (admission.disposition === "cached") {
      return deepFreeze({
        provider: "postnord" as const,
        effect: "display_only" as const,
        cached: true,
        inserted: 0,
        replayed: 0,
        events: [],
      });
    }
    if (admission.disposition !== "claimed") {
      throw new PostNordSyncError("rate_limited", {
        retryAfterSeconds: admission.retryAfterSeconds,
      });
    }
    const claimToken = admission.claimToken;
    if (claimToken === null) throw persistenceFailed();

    try {
      await dependencies.renew(claimToken);
      const rawBody = await dependencies.fetchPayload(order.trackingNumber);
      const events = await normalizePostNordTrackingPayload(rawBody, {
        requestedTenantId: order.tenantId,
        requestedOrderId: order.id,
        order: {
          id: order.id,
          tenantId: order.tenantId,
          trackingNumber: order.trackingNumber,
        },
        receivedAt: dependencies.now,
      });
      for (const event of events) {
        assertPostNordEventForPersistence(event, {
          tenantId: order.tenantId,
          orderId: order.id,
          trackingNumber: order.trackingNumber,
        });
      }
      await dependencies.renew(claimToken);
      const persistence = await dependencies.repository.insertEvents(
        claimToken,
        events,
      );
      if (
        !isNonNegativeSafeInteger(persistence.inserted) ||
        !isNonNegativeSafeInteger(persistence.replayed) ||
        persistence.inserted + persistence.replayed !== events.length
      ) {
        throw persistenceFailed();
      }
      return deepFreeze({
        provider: "postnord" as const,
        effect: "display_only" as const,
        cached: false,
        inserted: persistence.inserted,
        replayed: persistence.replayed,
        events: events.map(toDisplayDto),
      });
    } catch (error) {
      const retryAfterSeconds = error instanceof PostNordSyncError &&
          error.code === "rate_limited"
        ? error.retryAfterSeconds ?? DEFAULT_PROVIDER_RETRY_AFTER_SECONDS
        : null;
      try {
        await dependencies.finish(
          claimToken,
          retryAfterSeconds === null ? "failed" : "provider_rate_limited",
          retryAfterSeconds,
        );
      } catch {
        throw persistenceFailed();
      }
      if (retryAfterSeconds !== null) {
        throw new PostNordSyncError("rate_limited", { retryAfterSeconds });
      }
      if (error instanceof PostNordSyncError) throw error;
      if (error instanceof PostNordTrackingError) throw providerUnavailable();
      throw persistenceFailed();
    }
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    if (error instanceof PostNordTrackingError) throw providerUnavailable();
    throw persistenceFailed();
  }
}

export async function claimPostNordTrackingSync(
  authorizedOrder: AuthorizedPostNordOrder,
  verifiedUserId: string,
  client: PostNordStateRpcClient,
): Promise<PostNordAdmission> {
  try {
    const order = normalizeAuthorizedOrder(authorizedOrder, authorizedOrder.id);
    if (!isUuid(verifiedUserId) || !client) throw persistenceFailed();
    const response = await client.rpc("claim_postnord_tracking_sync", {
      _tenant_id: order.tenantId,
      _order_id: order.id,
      _user_id: verifiedUserId,
      _tracking_identity: order.trackingNumber,
    });
    if (
      response.error !== null ||
      !Array.isArray(response.data) ||
      response.data.length !== 1
    ) {
      throw persistenceFailed();
    }
    return normalizeAdmission(response.data[0]);
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw persistenceFailed();
  }
}

export async function renewPostNordTrackingSync(
  claimToken: string,
  client: PostNordStateRpcClient,
): Promise<void> {
  try {
    if (!isUuid(claimToken) || !client) throw persistenceFailed();
    const response = await client.rpc("renew_postnord_tracking_sync", {
      _claim_token: claimToken,
    });
    if (response.error !== null || response.data !== true) {
      throw persistenceFailed();
    }
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw persistenceFailed();
  }
}

export async function finishPostNordTrackingSync(
  claimToken: string,
  outcome: PostNordClaimOutcome,
  retryAfterSeconds: number | null,
  client: PostNordStateRpcClient,
): Promise<void> {
  try {
    if (
      !isUuid(claimToken) ||
      !client ||
      !["failed", "provider_rate_limited"].includes(outcome) ||
      (outcome === "failed" && retryAfterSeconds !== null) ||
      (outcome === "provider_rate_limited" &&
        (!Number.isSafeInteger(retryAfterSeconds) ||
          Number(retryAfterSeconds) < 1 ||
          Number(retryAfterSeconds) > POSTNORD_MAX_RETRY_AFTER_SECONDS))
    ) {
      throw persistenceFailed();
    }
    const response = await client.rpc("finish_postnord_tracking_sync", {
      _claim_token: claimToken,
      _outcome: outcome,
      _retry_after_seconds: retryAfterSeconds,
    });
    const expected = outcome === "provider_rate_limited"
      ? retryAfterSeconds
      : 0;
    if (response.error !== null || response.data !== expected) {
      throw persistenceFailed();
    }
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw persistenceFailed();
  }
}

export function isMatchingPostNordReplayRow(
  event: NormalizedPostNordEvent,
  row: unknown,
): boolean {
  try {
    if (!isPlainRecord(row)) return false;
    return row.schema_version === event.schemaVersion &&
      row.carrier === event.carrier &&
      row.tenant_id === event.tenantId &&
      row.order_id === event.orderId &&
      row.tracking_number === event.trackingNumber &&
      nullableString(row.provider_event_id) === event.providerEventId &&
      nullableString(row.provider_event_code) === event.providerEventCode &&
      row.fallback_dedupe_key === event.fallbackDedupeKey &&
      row.provider_status === event.providerStatus &&
      row.display_type === event.displayType &&
      canonicalStoredInstant(row.occurred_at) === event.occurredAt &&
      nullableString(row.location) === event.location &&
      nullableString(row.description) === event.description;
  } catch {
    return false;
  }
}

export async function persistPostNordEventsAtomically(
  claimToken: string,
  events: readonly NormalizedPostNordEvent[],
  client: PostNordStateRpcClient,
): Promise<Readonly<{ inserted: number; replayed: number }>> {
  try {
    if (
      !isUuid(claimToken) ||
      !Array.isArray(events) ||
      events.length > 200 ||
      !client
    ) {
      throw persistenceFailed();
    }
    for (const event of events) {
      assertPostNordEventForPersistence(event, {
        tenantId: event.tenantId,
        orderId: event.orderId,
        trackingNumber: event.trackingNumber,
      });
    }
    const response = await client.rpc(
      "complete_postnord_tracking_sync",
      {
        _claim_token: claimToken,
        _events: events.map(toAtomicRpcEvent),
      },
    );
    if (
      response.error !== null || !Array.isArray(response.data) ||
      response.data.length !== 1 || !isPlainRecord(response.data[0])
    ) {
      throw persistenceFailed();
    }
    const inserted = response.data[0].inserted_count;
    const replayed = response.data[0].replayed_count;
    if (
      !isNonNegativeSafeInteger(inserted) ||
      !isNonNegativeSafeInteger(replayed) ||
      inserted + replayed !== events.length
    ) {
      throw persistenceFailed();
    }
    return Object.freeze({ inserted, replayed });
  } catch (error) {
    if (error instanceof PostNordSyncError) throw error;
    throw persistenceFailed();
  }
}

function normalizeProviderConfig(input: PostNordProviderConfig): Readonly<{
  baseUrl: string;
  apiKey: string;
}> {
  if (!isPlainRecord(input) || input.enabled !== true) {
    throw providerUnavailable();
  }
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  if (
    apiKey.length < 16 ||
    apiKey.length > MAX_API_KEY_LENGTH ||
    /\s/.test(apiKey) ||
    hasControlCharacter(apiKey)
  ) {
    throw providerUnavailable();
  }
  if (input.environment === "sandbox") {
    return Object.freeze({
      baseUrl: POSTNORD_SANDBOX_TRACKING_URL,
      apiKey,
    });
  }
  if (
    input.environment === "production" &&
    input.productionApproved === true
  ) {
    return Object.freeze({
      baseUrl: POSTNORD_PRODUCTION_TRACKING_URL,
      apiKey,
    });
  }
  throw providerUnavailable();
}

function normalizeAuthorizedOrder(
  input: unknown,
  expectedOrderId: string,
): AuthorizedPostNordOrder {
  if (!isPlainRecord(input)) throw orderNotFound();
  const id = input.id;
  const tenantId = input.tenantId;
  let trackingNumber: string;
  try {
    trackingNumber = canonicalizePostNordTrackingNumber(input.trackingNumber);
  } catch {
    throw orderNotFound();
  }
  if (
    !isUuid(expectedOrderId) ||
    !isUuid(id) ||
    id !== expectedOrderId ||
    !isUuid(tenantId)
  ) {
    throw orderNotFound();
  }
  return Object.freeze({ id, tenantId, trackingNumber });
}

function toDisplayDto(event: NormalizedPostNordEvent): PostNordEventDisplayDto {
  return Object.freeze({
    schemaVersion: event.schemaVersion,
    carrier: event.carrier,
    providerEventId: event.providerEventId,
    providerEventCode: event.providerEventCode,
    providerStatus: event.providerStatus,
    displayType: event.displayType,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    location: event.location,
    description: event.description,
    effect: "display_only" as const,
  });
}

function toAtomicRpcEvent(
  event: NormalizedPostNordEvent,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    tenant_id: event.tenantId,
    order_id: event.orderId,
    schema_version: event.schemaVersion,
    carrier: event.carrier,
    tracking_number: event.trackingNumber,
    provider_event_id: event.providerEventId,
    provider_event_code: event.providerEventCode,
    fallback_dedupe_key: event.fallbackDedupeKey,
    provider_status: event.providerStatus,
    display_type: event.displayType,
    occurred_at: event.occurredAt,
    received_at: event.receivedAt,
    location: event.location,
    description: event.description,
    source_digest: event.sourceDigest,
  });
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw providerUnavailable();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) throw providerUnavailable();
      total += result.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw providerUnavailable();
      }
      chunks.push(result.value.slice());
    }
  } catch {
    throw providerUnavailable();
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export function parsePostNordRetryAfter(
  value: string | null,
  now: Date = new Date(),
): number | null {
  if (
    value === null ||
    value.length === 0 ||
    value !== value.trim() ||
    !Number.isFinite(now.getTime())
  ) return null;

  if (/^\d+$/.test(value)) {
    if (value.length > 10) return POSTNORD_MAX_RETRY_AFTER_SECONDS;
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds)) return POSTNORD_MAX_RETRY_AFTER_SECONDS;
    return Math.max(
      1,
      Math.min(seconds, POSTNORD_MAX_RETRY_AFTER_SECONDS),
    );
  }

  if (value.length > 128 || hasControlCharacter(value)) return null;
  const deadline = Date.parse(value);
  if (!Number.isFinite(deadline)) return null;
  const seconds = Math.max(1, Math.ceil((deadline - now.getTime()) / 1_000));
  return Math.min(seconds, POSTNORD_MAX_RETRY_AFTER_SECONDS);
}

function canonicalStoredInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !STORED_UTC_INSTANT.test(value)
  ) {
    throw persistenceFailed();
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw persistenceFailed();
  return parsed.toISOString();
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw persistenceFailed();
  return value;
}

function normalizeAdmission(value: unknown): PostNordAdmission {
  if (!isPlainRecord(value)) throw persistenceFailed();
  const disposition = value.disposition;
  const retryAfterSeconds = value.retryAfterSeconds ??
    value.retry_after_seconds;
  const claimToken = value.claimToken ?? value.claim_token ?? null;
  const normalizedClaimToken = typeof claimToken === "string"
    ? claimToken
    : null;
  if (
    typeof disposition !== "string" ||
    !ADMISSION_DISPOSITIONS.has(
      disposition as PostNordAdmission["disposition"],
    ) ||
    !Number.isSafeInteger(retryAfterSeconds) ||
    Number(retryAfterSeconds) < 0 ||
    Number(retryAfterSeconds) > POSTNORD_MAX_RETRY_AFTER_SECONDS ||
    (["claimed", "cached"].includes(disposition) && retryAfterSeconds !== 0) ||
    (!["claimed", "cached"].includes(disposition) &&
      Number(retryAfterSeconds) < 1) ||
    (disposition === "claimed" && !isUuid(normalizedClaimToken)) ||
    (disposition !== "claimed" && claimToken !== null)
  ) {
    throw persistenceFailed();
  }
  return Object.freeze({
    disposition: disposition as PostNordAdmission["disposition"],
    retryAfterSeconds: Number(retryAfterSeconds),
    claimToken: normalizedClaimToken,
  });
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function hasExactStringKeys(
  value: Record<string, unknown>,
  expected: ReadonlySet<string>,
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.size &&
    keys.every((key) => typeof key === "string" && expected.has(key));
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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

function messageForCode(code: PostNordSyncErrorCode): string {
  switch (code) {
    case "invalid_request":
      return "Invalid PostNord tracking request";
    case "order_not_found":
      return "Order was not found";
    case "forbidden":
      return "PostNord tracking access denied";
    case "authorization_unavailable":
      return "PostNord tracking authorization unavailable";
    case "provider_unavailable":
      return "PostNord tracking provider unavailable";
    case "rate_limited":
      return "PostNord tracking provider rate limited";
    case "persistence_failed":
      return "PostNord tracking evidence could not be stored";
  }
}

function invalidRequest(): PostNordSyncError {
  return new PostNordSyncError("invalid_request");
}

function orderNotFound(): PostNordSyncError {
  return new PostNordSyncError("order_not_found");
}

function forbidden(): PostNordSyncError {
  return new PostNordSyncError("forbidden");
}

function providerUnavailable(): PostNordSyncError {
  return new PostNordSyncError("provider_unavailable");
}

function persistenceFailed(): PostNordSyncError {
  return new PostNordSyncError("persistence_failed");
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
