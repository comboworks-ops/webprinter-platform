// deno-lint-ignore no-import-prefix -- Supabase Edge runtime convention in this repository.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { type NormalizedPostNordEvent } from "../_shared/postnordTracking.ts";
import {
  type AuthorizedPostNordOrder,
  authorizePostNordSyncOrder,
  fetchPostNordTrackingPayload,
  isMatchingPostNordReplayRow,
  parsePostNordSyncRequest,
  PostNordSyncError,
  type PostNordTrackingRepository,
  syncAuthorizedPostNordOrder,
} from "../_shared/postnordTrackingSync.ts";
import {
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/http.ts";

const MAX_REQUEST_BODY_BYTES = 2 * 1024;
const MAX_AUTHORIZATION_HEADER_BYTES = 8 * 1024;

type AuthClient = ReturnType<typeof createAuthClient>;
type ServiceClient = ReturnType<typeof createServiceClient>;
type AuthResult =
  | Readonly<{ ok: true; client: AuthClient; userId: string }>
  | Readonly<{
    ok: false;
    status: 401 | 500;
    category: "unauthorized" | "auth_unavailable" | "auth_check_failed";
  }>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return methodNotAllowed();

  const requestId = crypto.randomUUID();
  try {
    const authentication = await authenticate(req);
    if (!authentication.ok) {
      logOutcome(requestId, authentication.category, 0);
      return jsonResponse(
        {
          error: authentication.status === 401
            ? "Unauthorized"
            : "Authentication could not be verified",
        },
        authentication.status,
      );
    }

    let syncRequest;
    try {
      syncRequest = parsePostNordSyncRequest(
        await readBoundedJson(req, MAX_REQUEST_BODY_BYTES),
      );
    } catch {
      logOutcome(requestId, "invalid_request", 0);
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    let order: AuthorizedPostNordOrder;
    try {
      order = await authorizePostNordSyncOrder(
        syncRequest,
        authentication.userId,
        createOrderAccessDependencies(authentication.client),
      );
    } catch (error) {
      const code = error instanceof PostNordSyncError
        ? error.code
        : "authorization_unavailable";
      logOutcome(requestId, code, 0);
      if (code === "order_not_found") {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      if (code === "forbidden") {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      return jsonResponse({ error: "Order access could not be verified" }, 500);
    }

    try {
      const result = await syncAuthorizedPostNordOrder(order, {
        now: new Date(),
        fetchPayload: (trackingNumber) =>
          fetchPostNordTrackingPayload(trackingNumber, {
            fetchImpl: fetch,
            providerConfig: readProviderConfig(),
          }),
        repository: createLazyRepository(),
      });
      logOutcome(requestId, "success", result.events.length);
      return jsonResponse(result);
    } catch (error) {
      const syncError = error instanceof PostNordSyncError
        ? error
        : new PostNordSyncError("persistence_failed");
      logOutcome(requestId, syncError.code, 0);
      if (syncError.code === "provider_unavailable") {
        return jsonResponse({
          provider: "postnord",
          code: "provider_unavailable",
          effect: "display_only",
          events: [],
        });
      }
      if (syncError.code === "rate_limited") {
        const response = jsonResponse({
          provider: "postnord",
          code: "rate_limited",
          effect: "display_only",
          events: [],
        }, 429);
        if (syncError.retryAfterSeconds !== null) {
          response.headers.set(
            "Retry-After",
            String(syncError.retryAfterSeconds),
          );
        }
        return response;
      }
      return jsonResponse(
        { error: "Tracking evidence could not be stored" },
        500,
      );
    }
  } catch {
    logOutcome(requestId, "internal_failure", 0);
    return jsonResponse({ error: "Request could not be completed" }, 500);
  }
});

async function authenticate(req: Request): Promise<AuthResult> {
  const authorization = req.headers.get("Authorization") ??
    req.headers.get("authorization");
  if (
    !authorization ||
    authorization.length > MAX_AUTHORIZATION_HEADER_BYTES ||
    !/^Bearer\s+\S+$/i.test(authorization)
  ) {
    return { ok: false, status: 401, category: "unauthorized" };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, category: "auth_unavailable" };
  }
  try {
    const client = createAuthClient(supabaseUrl, anonKey, authorization);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.id) {
      return { ok: false, status: 401, category: "unauthorized" };
    }
    return { ok: true, client, userId: user.id };
  } catch {
    return { ok: false, status: 500, category: "auth_check_failed" };
  }
}

function createOrderAccessDependencies(client: AuthClient) {
  return Object.freeze({
    loadOrder: async (orderId: string) => {
      const { data, error } = await client
        .from("orders")
        .select("id,tenant_id,tracking_number")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error("order read failed");
      if (!data) return null;
      return {
        id: String(data.id ?? ""),
        tenantId: String(data.tenant_id ?? ""),
        trackingNumber: String(data.tracking_number ?? ""),
      };
    },
    canAccessTenant: async (tenantId: string) => {
      const { data, error } = await client.rpc("can_access_tenant", {
        _tenant_id: tenantId,
      });
      if (error) throw new Error("tenant access check failed");
      return data === true;
    },
    hasExactMasterRole: async (userId: string) => {
      const { data, error } = await client.rpc("has_role", {
        _user_id: userId,
        _role: "master_admin",
      });
      if (error) throw new Error("master role check failed");
      return data === true;
    },
  });
}

function readProviderConfig() {
  return Object.freeze({
    enabled: Deno.env.get("POSTNORD_TRACKING_ENABLED") === "true",
    environment: Deno.env.get("POSTNORD_TRACKING_ENVIRONMENT") ?? "",
    apiKey: Deno.env.get("POSTNORD_TRACKING_API_KEY") ?? "",
    productionApproved:
      Deno.env.get("POSTNORD_TRACKING_PRODUCTION_APPROVED") === "true",
  });
}

function createLazyRepository(): PostNordTrackingRepository {
  return Object.freeze({
    insertEvents: async (events) => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (!supabaseUrl || !serviceRoleKey) {
        throw new PostNordSyncError("persistence_failed");
      }
      const client = createServiceClient(supabaseUrl, serviceRoleKey);
      let inserted = 0;
      let replayed = 0;
      for (const event of events) {
        const { error } = await client
          .from("carrier_tracking_events_v1")
          .insert(toDatabaseInsert(event));
        if (!error) {
          inserted += 1;
          continue;
        }
        if (error.code !== "23505" || !await isExactReplay(client, event)) {
          throw new PostNordSyncError("persistence_failed");
        }
        replayed += 1;
      }
      return Object.freeze({ inserted, replayed });
    },
  });
}

function toDatabaseInsert(event: NormalizedPostNordEvent) {
  return Object.freeze({
    tenant_id: event.tenantId,
    order_id: event.orderId,
    schema_version: event.schemaVersion,
    carrier: event.carrier,
    tracking_number: event.trackingNumber,
    provider_event_id: event.providerEventId,
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

async function isExactReplay(
  client: ServiceClient,
  event: NormalizedPostNordEvent,
): Promise<boolean> {
  const select =
    "id,schema_version,tenant_id,order_id,carrier,tracking_number,provider_event_id,fallback_dedupe_key,provider_status,display_type,occurred_at,location,description";
  const fallbackResult = await client
    .from("carrier_tracking_events_v1")
    .select(select)
    .eq("carrier", event.carrier)
    .eq("tracking_number", event.trackingNumber)
    .eq("fallback_dedupe_key", event.fallbackDedupeKey)
    .maybeSingle();
  if (fallbackResult.error || !fallbackResult.data) return false;
  if (!isMatchingPostNordReplayRow(event, fallbackResult.data)) return false;

  if (event.providerEventId === null) return true;
  const providerResult = await client
    .from("carrier_tracking_events_v1")
    .select(select)
    .eq("carrier", event.carrier)
    .eq("tracking_number", event.trackingNumber)
    .eq("provider_event_id", event.providerEventId)
    .maybeSingle();
  if (providerResult.error || !providerResult.data) return false;
  return providerResult.data.id === fallbackResult.data.id &&
    isMatchingPostNordReplayRow(event, providerResult.data);
}

function createAuthClient(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createServiceClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readBoundedJson(
  req: Request,
  maximumBytes: number,
): Promise<unknown> {
  const contentType = req.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") throw new Error("invalid body");
  const contentLength = req.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > maximumBytes)
  ) {
    throw new Error("invalid body");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new Error("invalid body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw new Error("invalid body");
      }
      total += result.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("invalid body");
      }
      chunks.push(result.value.slice());
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  if (hasDuplicateJsonObjectKeys(text)) throw new Error("invalid body");
  return JSON.parse(text) as unknown;
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

function logOutcome(
  requestId: string,
  category: string,
  eventCount: number,
): void {
  console.info(JSON.stringify({
    requestId,
    provider: "postnord",
    category,
    eventCount,
  }));
}
