// deno-lint-ignore no-import-prefix -- Supabase Edge runtime convention in this repository.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  BusinessEvidenceError,
  type BusinessEvidenceRepository,
  type BusinessEvidenceResultStatus,
  type BusinessEvidenceType,
  type DatafordelerCredential,
  decideBusinessEvidenceTenantAccess,
  parseBusinessEvidenceRequest,
  processBusinessEvidence,
  type ProviderDisplayFields,
  savedStructuredCvrMatchesRequest,
  type StoredBusinessEvidence,
} from "../_shared/businessEvidence.ts";
import { createViesProvider } from "../_shared/providers/viesProvider.ts";
import { createDanishCompanyProvider } from "../_shared/providers/danishCompanyProvider.ts";
import { createDanishAddressProvider } from "../_shared/providers/danishAddressProvider.ts";
import {
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/http.ts";

const MAX_REQUEST_BODY_BYTES = 4 * 1024;
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
type AccessResult =
  | Readonly<{ ok: true }>
  | Readonly<{
    ok: false;
    status: 403 | 404 | 500;
    category: "forbidden" | "tenant_not_found" | "access_check_failed";
  }>;
type SavedIdentityResult =
  | Readonly<{ ok: true }>
  | Readonly<{
    ok: false;
    status: 409 | 500;
    category: "saved_identity_mismatch" | "saved_identity_check_failed";
  }>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return methodNotAllowed();

  const requestId = crypto.randomUUID();
  let operation: string | null = null;
  try {
    const authentication = await authenticate(req);
    if (!authentication.ok) {
      logOutcome(requestId, operation, authentication.category);
      return jsonResponse(
        {
          error: authentication.status === 401
            ? "Unauthorized"
            : "Authentication could not be verified",
        },
        authentication.status,
      );
    }

    let parsedRequest;
    try {
      const body = await readBoundedJson(req, MAX_REQUEST_BODY_BYTES);
      parsedRequest = parseBusinessEvidenceRequest(body);
      operation = parsedRequest.operation;
    } catch {
      logOutcome(requestId, operation, "invalid_request");
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const access = await authorizeTenant(
      authentication.client,
      authentication.userId,
      parsedRequest.tenantId,
    );
    if (!access.ok) {
      logOutcome(requestId, operation, access.category);
      const error = access.status === 403
        ? "Forbidden"
        : access.status === 404
        ? "Tenant not found"
        : "Tenant access could not be verified";
      return jsonResponse({ error }, access.status);
    }

    const savedIdentity = await verifySavedStructuredIdentity(
      authentication.client,
      parsedRequest,
    );
    if (!savedIdentity.ok) {
      logOutcome(requestId, operation, savedIdentity.category);
      return jsonResponse(
        {
          error: savedIdentity.status === 409
            ? "Save the matching business identity before verification"
            : "Saved business identity could not be verified",
        },
        savedIdentity.status,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      logOutcome(requestId, operation, "persistence_unavailable");
      return jsonResponse({ error: "Evidence store unavailable" }, 500);
    }
    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);
    const credential = readDatafordelerCredential(parsedRequest.operation);
    const providers = Object.freeze({
      vies: createViesProvider(),
      danish_company: createDanishCompanyProvider(
        parsedRequest.operation === "danish_company" ? credential : null,
      ),
      danish_address: createDanishAddressProvider(
        parsedRequest.operation === "danish_address" ? credential : null,
      ),
    });

    try {
      const result = await processBusinessEvidence(parsedRequest, {
        providers,
        repository: createRepository(serviceClient, authentication.userId),
        context: {
          fetchImpl: fetch,
          now: new Date(),
          correlationId: requestId,
        },
      });
      logOutcome(
        requestId,
        operation,
        result.replayed ? "replay" : result.status,
      );
      return jsonResponse(result);
    } catch (error) {
      const category = error instanceof BusinessEvidenceError
        ? error.code
        : "persistence_failed";
      logOutcome(requestId, operation, category);
      if (
        error instanceof BusinessEvidenceError &&
        (error.code === "rate_limited" || error.code === "request_in_flight")
      ) {
        const retryAfterSeconds = error.retryAfterSeconds ?? 30;
        const response = jsonResponse({
          error: "Verification is temporarily unavailable",
          retryAfterSeconds,
        }, 429);
        response.headers.set("Retry-After", String(retryAfterSeconds));
        return response;
      }
      return jsonResponse({ error: "Evidence could not be stored" }, 500);
    }
  } catch {
    logOutcome(requestId, operation, "internal_failure");
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

async function verifySavedStructuredIdentity(
  client: AuthClient,
  request: ReturnType<typeof parseBusinessEvidenceRequest>,
): Promise<SavedIdentityResult> {
  if (request.operation === "danish_address") return { ok: true };
  try {
    const { data, error } = await client
      .from("tenants")
      .select("settings")
      .eq("id", request.tenantId)
      .maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        status: 500,
        category: "saved_identity_check_failed",
      };
    }
    return savedStructuredCvrMatchesRequest(data.settings, request)
      ? { ok: true }
      : {
        ok: false,
        status: 409,
        category: "saved_identity_mismatch",
      };
  } catch {
    return {
      ok: false,
      status: 500,
      category: "saved_identity_check_failed",
    };
  }
}

async function authorizeTenant(
  client: AuthClient,
  userId: string,
  tenantId: string,
): Promise<AccessResult> {
  const decision = await decideBusinessEvidenceTenantAccess(
    { tenantId, userId },
    {
      canAccessTenant: async (requestedTenantId) => {
        const { data, error } = await client.rpc("can_access_tenant", {
          _tenant_id: requestedTenantId,
        });
        if (error) throw new Error("access check failed");
        return data === true;
      },
      hasExactMasterRole: async (requestedUserId) => {
        const { data, error } = await client.rpc("has_role", {
          _user_id: requestedUserId,
          _role: "master_admin",
        });
        if (error) throw new Error("role check failed");
        return data === true;
      },
      tenantExists: async (requestedTenantId) => {
        const { data, error } = await client
          .from("tenants")
          .select("id")
          .eq("id", requestedTenantId)
          .maybeSingle();
        if (error) throw new Error("tenant check failed");
        return typeof data?.id === "string" && data.id === requestedTenantId;
      },
    },
  );
  if (decision.ok) return { ok: true };
  if (decision.reason === "forbidden") {
    return { ok: false, status: 403, category: "forbidden" };
  }
  if (decision.reason === "not_found") {
    return { ok: false, status: 404, category: "tenant_not_found" };
  }
  return { ok: false, status: 500, category: "access_check_failed" };
}

function createRepository(
  serviceClient: ServiceClient,
  userId: string,
): BusinessEvidenceRepository {
  return Object.freeze({
    findExact: async (query) => {
      const { data, error } = await serviceClient
        .from("tenant_business_evidence")
        .select(
          "id,tenant_id,schema_version,evidence_type,normalized_identifier,provider,result_status,provider_reference,checked_at,received_at,request_fingerprint,response_digest,display_fields",
        )
        .eq("tenant_id", query.tenantId)
        .eq("provider", query.provider)
        .eq("request_fingerprint", query.requestFingerprint)
        .maybeSingle();
      if (error) throw new BusinessEvidenceError("persistence_failed");
      return data ? rowFromDatabase(data) : null;
    },
    claim: async (query) => {
      const { data, error } = await serviceClient.rpc(
        "claim_tenant_business_evidence_request",
        {
          _tenant_id: query.tenantId,
          _user_id: userId,
          _operation: query.operation,
          _provider: query.provider,
          _request_fingerprint: query.requestFingerprint,
        },
      );
      if (error) throw new BusinessEvidenceError("persistence_failed");
      const raw = Array.isArray(data) ? data[0] : data;
      if (!isPlainRecord(raw) || typeof raw.disposition !== "string") {
        throw new BusinessEvidenceError("persistence_failed");
      }
      if (raw.disposition === "claimed" || raw.disposition === "replay") {
        return { status: raw.disposition } as const;
      }
      const retryAfterSeconds = Number(raw.retry_after_seconds);
      if (
        (raw.disposition === "in_flight" ||
          raw.disposition === "rate_limited") &&
        Number.isSafeInteger(retryAfterSeconds) &&
        retryAfterSeconds >= 1 && retryAfterSeconds <= 3_600
      ) {
        return {
          status: raw.disposition,
          retryAfterSeconds,
        } as const;
      }
      throw new BusinessEvidenceError("persistence_failed");
    },
    insert: async (row) => {
      const { data, error } = await serviceClient
        .from("tenant_business_evidence")
        .insert({
          tenant_id: row.tenantId,
          schema_version: row.schemaVersion,
          evidence_type: row.evidenceType,
          normalized_identifier: row.normalizedIdentifier,
          provider: row.provider,
          result_status: row.resultStatus,
          provider_reference: row.providerReference,
          checked_at: row.checkedAt,
          received_at: row.receivedAt,
          request_fingerprint: row.requestFingerprint,
          response_digest: row.responseDigest,
          display_fields: row.displayFields,
        })
        .select("id")
        .single();
      if (error?.code === "23505") return { status: "conflict" } as const;
      if (error || !data?.id) {
        throw new BusinessEvidenceError("persistence_failed");
      }
      return { status: "inserted", id: String(data.id) } as const;
    },
  });
}

function rowFromDatabase(input: unknown): StoredBusinessEvidence {
  if (!isPlainRecord(input)) {
    throw new BusinessEvidenceError("persistence_failed");
  }
  return {
    id: String(input.id ?? ""),
    tenantId: String(input.tenant_id ?? ""),
    schemaVersion: Number(input.schema_version) as 1,
    evidenceType: String(input.evidence_type ?? "") as BusinessEvidenceType,
    normalizedIdentifier: String(input.normalized_identifier ?? ""),
    provider: String(input.provider ?? ""),
    resultStatus: String(
      input.result_status ?? "",
    ) as BusinessEvidenceResultStatus,
    providerReference: input.provider_reference === null
      ? null
      : String(input.provider_reference ?? ""),
    checkedAt: String(input.checked_at ?? ""),
    receivedAt: String(input.received_at ?? ""),
    requestFingerprint: String(input.request_fingerprint ?? ""),
    responseDigest: String(input.response_digest ?? ""),
    displayFields: input.display_fields as ProviderDisplayFields,
  };
}

function readDatafordelerCredential(
  operation: string,
): DatafordelerCredential | null {
  const bearer = Deno.env.get("DATAFORDELER_ACCESS_TOKEN")?.trim() ?? "";
  if (bearer) return { kind: "bearer", value: bearer };
  const operationKey = operation === "danish_company"
    ? Deno.env.get("DATAFORDELER_CVR_API_KEY")
    : operation === "danish_address"
    ? Deno.env.get("DATAFORDELER_DAR_API_KEY")
    : null;
  const apiKey = operationKey?.trim() ||
    Deno.env.get("DATAFORDELER_API_KEY")?.trim() || "";
  return apiKey ? { kind: "api_key", value: apiKey } : null;
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
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > maximumBytes) {
      throw new Error("invalid body");
    }
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
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
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
          key = JSON.parse(text.slice(index, end + 1));
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
  operation: string | null,
  category: string,
): void {
  console.info(JSON.stringify({ requestId, operation, category }));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
