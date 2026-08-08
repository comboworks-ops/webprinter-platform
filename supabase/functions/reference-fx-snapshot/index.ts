// deno-lint-ignore no-import-prefix -- Supabase Edge runtime convention in this repository.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  assertExpectedRateDate,
  fetchFrankfurterEurDkkSnapshot,
  type FxSnapshotRepository,
  parseReferenceFxRequest,
  persistReferenceFxSnapshot,
  ReferenceFxError,
  type ReferenceFxSnapshot,
  toPublicReferenceFxSnapshot,
} from "../_shared/referenceFx.ts";
import {
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/http.ts";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const MAX_REQUEST_BODY_BYTES = 2 * 1024;
const PROVIDER = "frankfurter_ecb";

type AuthDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 500; category: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return methodNotAllowed();

  const requestId = crypto.randomUUID();
  let rateDate: string | null = null;

  try {
    const authorization = await authorizeMasterContext(req);
    if (!authorization.ok) {
      logOutcome(requestId, rateDate, authorization.category);
      const error = authorization.status === 401
        ? "Unauthorized"
        : authorization.status === 403
        ? "Forbidden"
        : "Authorization could not be verified";
      return jsonResponse({ error }, authorization.status);
    }

    let requestBody: unknown;
    try {
      requestBody = await readBoundedJson(req, MAX_REQUEST_BODY_BYTES);
    } catch {
      logOutcome(requestId, rateDate, "invalid_request");
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    let input;
    try {
      input = parseReferenceFxRequest(requestBody);
    } catch {
      logOutcome(requestId, rateDate, "invalid_request");
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    let snapshot: ReferenceFxSnapshot;
    try {
      snapshot = await fetchFrankfurterEurDkkSnapshot({
        fetchImpl: fetch,
        now: new Date(),
      });
      rateDate = snapshot.rateDate;
      assertExpectedRateDate(snapshot, input.expectedRateDate);
    } catch (error) {
      if (
        error instanceof ReferenceFxError &&
        error.code === "rate_date_mismatch"
      ) {
        logOutcome(requestId, rateDate, "rate_date_mismatch");
        return jsonResponse({
          error: "Provider rate date did not match the requested date",
          code: "rate_date_mismatch",
        }, 409);
      }
      logOutcome(requestId, rateDate, "provider_unavailable");
      return jsonResponse({
        error: "Exchange-rate provider unavailable",
        code: "provider_unavailable",
      }, 502);
    }

    // The service-role secret is read and its client is created only after
    // caller authentication, exact master-role authorization, master-tenant
    // context authorization, request validation, and provider validation.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      logOutcome(requestId, rateDate, "persistence_unavailable");
      return jsonResponse({ error: "Evidence store unavailable" }, 500);
    }
    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);

    try {
      const persisted = await persistReferenceFxSnapshot(
        snapshot,
        createRepository(serviceClient),
      );
      const response = toPublicReferenceFxSnapshot(persisted);
      logOutcome(
        requestId,
        rateDate,
        response.replayed ? "replay" : "created",
      );
      return jsonResponse(response);
    } catch {
      logOutcome(requestId, rateDate, "persistence_failed");
      return jsonResponse({ error: "Evidence could not be stored" }, 500);
    }
  } catch {
    logOutcome(requestId, rateDate, "internal_failure");
    return jsonResponse({ error: "Request could not be completed" }, 500);
  }
});

async function authorizeMasterContext(req: Request): Promise<AuthDecision> {
  const authHeader = req.headers.get("Authorization") ??
    req.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, status: 401, category: "unauthorized" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, category: "auth_unavailable" };
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await authClient.auth
      .getUser();
    if (userError || !user) {
      return { ok: false, status: 401, category: "unauthorized" };
    }

    const { data: hasExactRole, error: roleError } = await authClient.rpc(
      "has_role",
      { _user_id: user.id, _role: "master_admin" },
    );
    if (roleError) {
      return { ok: false, status: 500, category: "role_check_failed" };
    }
    if (hasExactRole !== true) {
      return { ok: false, status: 403, category: "forbidden" };
    }

    const { data: hasMasterContext, error: contextError } = await authClient
      .rpc(
        "can_access_tenant",
        { _tenant_id: MASTER_TENANT_ID },
      );
    if (contextError) {
      return { ok: false, status: 500, category: "context_check_failed" };
    }
    if (hasMasterContext !== true) {
      return { ok: false, status: 403, category: "forbidden" };
    }

    return { ok: true };
  } catch {
    return { ok: false, status: 500, category: "auth_check_failed" };
  }
}

function createRepository(
  serviceClient: ReturnType<typeof createServiceClient>,
): FxSnapshotRepository {
  const findExact = async (snapshot: ReferenceFxSnapshot) => {
    const { data, error } = await serviceClient
      .from("supplier_fx_rate_snapshots")
      .select(
        "id,schema_version,provider,base_currency,quote_currency,rate,rate_date,fetched_at,source_payload_sha256",
      )
      .eq("provider", snapshot.provider)
      .eq("base_currency", snapshot.baseCurrency)
      .eq("quote_currency", snapshot.quoteCurrency)
      .eq("rate_date", snapshot.rateDate)
      .eq("source_payload_sha256", snapshot.sourcePayloadSha256)
      .maybeSingle();
    if (error) throw new ReferenceFxError("persistence_failed");
    return data
      ? {
        id: String(data.id),
        snapshot: {
          schemaVersion: Number(data.schema_version) as 1,
          provider: String(data.provider) as "frankfurter_ecb",
          baseCurrency: String(data.base_currency) as "EUR",
          quoteCurrency: String(data.quote_currency) as "DKK",
          rate: Number(data.rate),
          rateDate: String(data.rate_date),
          fetchedAt: String(data.fetched_at),
          sourcePayloadSha256: String(data.source_payload_sha256),
        },
      }
      : null;
  };

  return {
    findExact,
    insert: async (snapshot) => {
      const { data, error } = await serviceClient
        .from("supplier_fx_rate_snapshots")
        .insert({
          schema_version: snapshot.schemaVersion,
          provider: snapshot.provider,
          base_currency: snapshot.baseCurrency,
          quote_currency: snapshot.quoteCurrency,
          rate: snapshot.rate,
          rate_date: snapshot.rateDate,
          fetched_at: snapshot.fetchedAt,
          source_payload_sha256: snapshot.sourcePayloadSha256,
        })
        .select("id")
        .single();
      if (error?.code === "23505") return { status: "conflict" } as const;
      if (error || !data) throw new ReferenceFxError("persistence_failed");
      return {
        status: "inserted",
        row: { id: String(data.id), snapshot },
      } as const;
    },
  };
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
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new Error("invalid body");
    if (Number(contentLength) > maximumBytes) throw new Error("invalid body");
  }

  const reader = req.body?.getReader();
  if (!reader) throw new Error("invalid body");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw new Error("invalid body");
      }
      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("invalid body");
      }
      chunks.push(result.value.slice());
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

function logOutcome(
  requestId: string,
  rateDate: string | null,
  category: string,
): void {
  console.info(
    JSON.stringify({ requestId, provider: PROVIDER, rateDate, category }),
  );
}
