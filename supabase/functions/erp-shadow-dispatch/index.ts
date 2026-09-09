import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireRole } from "../_shared/auth.ts";
import {
  buildSyntheticErpShadowEvent,
  isAllowedErpGatewayUrl,
  parseErpShadowMode,
  retryDelaySeconds,
  signErpShadowBody,
  validateErpShadowEvent,
} from "../_shared/erpShadow.ts";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ATTEMPTS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readAdminKey(): string {
  const newKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (newKeys) {
    try {
      const parsed = JSON.parse(newKeys);
      if (typeof parsed?.default === "string") return parsed.default;
    } catch {
      // Fall through to the legacy project key during the 2026 migration.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({
      error: { code: "method_not_allowed", message: "POST is required" },
    }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({
      error: { code: "payload_too_large", message: "Request is too large" },
    }, 413);
  }

  try {
    const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
    if (!auth.ok) return auth.response;

    const mode = parseErpShadowMode(Deno.env.get("ERP_SHADOW_MODE"));
    if (mode === "disabled") {
      return json({
        error: {
          code: "erp_shadow_disabled",
          message: "ERP shadow dispatch is disabled",
        },
      }, 409);
    }

    const rawRequest = await req.text();
    if (new TextEncoder().encode(rawRequest).byteLength > MAX_BODY_BYTES) {
      return json({
        error: { code: "payload_too_large", message: "Request is too large" },
      }, 413);
    }
    const body = asRecord(JSON.parse(rawRequest || "{}"));
    const action = body.action;
    if (action !== "synthetic" && action !== "dispatch") {
      return json({
        error: {
          code: "action_invalid",
          message: "Action must be synthetic or dispatch",
        },
      }, 422);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const adminKey = readAdminKey();
    if (!supabaseUrl || !adminKey) {
      return json({
        error: {
          code: "supabase_admin_key_missing",
          message: "Server database credentials are not configured",
        },
      }, 500);
    }
    const serviceClient = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let outboxId: string;
    if (action === "synthetic") {
      const revision = body.revision === undefined ? 0 : Number(body.revision);
      const event = buildSyntheticErpShadowEvent(revision);
      const validationErrors = validateErpShadowEvent(event);
      if (validationErrors.length) {
        return json({
          error: {
            code: "contract_invalid",
            message: "Synthetic event failed validation",
            details: validationErrors,
          },
        }, 500);
      }

      const row = {
        tenant_id: MASTER_TENANT_ID,
        source_order_id: event.source.orderId,
        source_revision: event.source.revision,
        schema_version: event.schemaVersion,
        event_type: event.eventType,
        idempotency_key: event.idempotencyKey,
        event_payload: event,
        status: "pending",
        created_by: auth.user.id,
      };
      const { data: inserted, error: insertError } = await serviceClient
        .from("erp_shadow_outbox")
        .upsert(row, {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        return json({
          error: {
            code: "outbox_insert_failed",
            message: "Synthetic event could not be queued",
          },
        }, 500);
      }
      if (inserted?.id) {
        outboxId = inserted.id;
      } else {
        const { data: existing, error: existingError } = await serviceClient
          .from("erp_shadow_outbox")
          .select("id, status")
          .eq("idempotency_key", event.idempotencyKey)
          .maybeSingle();
        if (existingError || !existing) {
          return json({
            error: {
              code: "outbox_lookup_failed",
              message: "Existing synthetic event could not be resolved",
            },
          }, 500);
        }
        if (existing.status === "dispatched") {
          return json({
            status: "already_dispatched",
            mode,
            outboxId: existing.id,
            posting: "disabled",
          });
        }
        outboxId = existing.id;
      }
    } else {
      if (!isUuid(body.outboxId)) {
        return json({
          error: {
            code: "outbox_id_invalid",
            message: "A valid outboxId is required",
          },
        }, 422);
      }
      outboxId = body.outboxId;
    }

    const gatewayUrl = Deno.env.get("ERP_SHADOW_GATEWAY_URL") ?? "";
    const gatewaySecret = Deno.env.get("ERP_SHADOW_HMAC_SECRET") ?? "";
    if (
      !isAllowedErpGatewayUrl(gatewayUrl, mode) ||
      gatewaySecret.length < 32
    ) {
      return json({
        error: {
          code: "gateway_misconfigured",
          message: "ERP shadow gateway is not safely configured",
        },
      }, 500);
    }

    const { data: candidate, error: candidateError } = await serviceClient
      .from("erp_shadow_outbox")
      .select("tenant_id")
      .eq("id", outboxId)
      .maybeSingle();
    if (candidateError || !candidate) {
      return json({
        error: {
          code: "outbox_not_found",
          message: "Outbox event was not found",
        },
      }, 404);
    }
    if (mode === "synthetic" && candidate.tenant_id !== MASTER_TENANT_ID) {
      return json({
        error: {
          code: "synthetic_mode_scope",
          message: "Synthetic mode can dispatch only master test events",
        },
      }, 403);
    }

    const { data: claimedRows, error: claimError } = await serviceClient.rpc(
      "erp_shadow_claim_outbox",
      { p_id: outboxId },
    );
    const claimed = Array.isArray(claimedRows) ? claimedRows[0] : null;
    if (claimError || !claimed) {
      return json({
        error: {
          code: "outbox_not_claimed",
          message: "Outbox event is not ready for dispatch",
        },
      }, 409);
    }

    const eventErrors = validateErpShadowEvent(claimed.event_payload);
    if (eventErrors.length) {
      await serviceClient
        .from("erp_shadow_outbox")
        .update({
          status: "dead_letter",
          last_error_code: "contract_invalid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.id)
        .eq("lock_token", claimed.lock_token);
      return json({
        error: {
          code: "contract_invalid",
          message: "Queued event failed validation",
          details: eventErrors,
        },
      }, 422);
    }

    const rawEvent = JSON.stringify(claimed.event_payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signErpShadowBody(
      rawEvent,
      timestamp,
      gatewaySecret,
    );

    let gatewayStatus = 0;
    let gatewayResult: Record<string, unknown> = {};
    let errorCode = "gateway_unreachable";
    try {
      const gatewayResponse = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ERP-Shadow-Source": "webprinter",
          "X-ERP-Shadow-Signature": `sha256=${signature}`,
          "X-ERP-Shadow-Timestamp": timestamp,
        },
        body: rawEvent,
        signal: AbortSignal.timeout(10_000),
      });
      gatewayStatus = gatewayResponse.status;
      gatewayResult = asRecord(await gatewayResponse.json().catch(() => ({})));
      errorCode = gatewayResponse.ok
        ? ""
        : `gateway_http_${gatewayResponse.status}`;
    } catch {
      errorCode = "gateway_unreachable";
    }

    const gatewayAccepted =
      (gatewayStatus === 200 || gatewayStatus === 202) &&
      gatewayResult.posting === "disabled" &&
      (gatewayResult.status === "accepted_shadow" ||
        gatewayResult.status === "duplicate");

    if (gatewayAccepted) {
      const dispatchedAt = new Date().toISOString();
      await serviceClient
        .from("erp_shadow_outbox")
        .update({
          status: "dispatched",
          dispatched_at: dispatchedAt,
          last_http_status: gatewayStatus,
          last_error_code: null,
          lock_token: null,
          locked_at: null,
          updated_at: dispatchedAt,
        })
        .eq("id", claimed.id)
        .eq("lock_token", claimed.lock_token);

      return json({
        status: gatewayResult.status,
        mode,
        outboxId: claimed.id,
        idempotencyKey: claimed.idempotency_key,
        posting: "disabled",
      }, gatewayStatus);
    }

    const attemptCount = Number(claimed.attempt_count || 1);
    const deadLetter = attemptCount >= MAX_ATTEMPTS;
    const nextAttemptAt = new Date(
      Date.now() + retryDelaySeconds(attemptCount) * 1000,
    ).toISOString();
    await serviceClient
      .from("erp_shadow_outbox")
      .update({
        status: deadLetter ? "dead_letter" : "retry",
        next_attempt_at: nextAttemptAt,
        last_http_status: gatewayStatus || null,
        last_error_code: errorCode,
        lock_token: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id)
      .eq("lock_token", claimed.lock_token);

    return json({
      error: {
        code: errorCode,
        message: deadLetter
          ? "Gateway dispatch moved to dead letter"
          : "Gateway dispatch will be retried",
      },
      mode,
      outboxId: claimed.id,
      posting: "disabled",
    }, 502);
  } catch (error) {
    console.error(
      "ERP shadow dispatch failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({
      error: {
        code: "internal_error",
        message: "ERP shadow request could not be processed",
      },
    }, 500);
  }
});
