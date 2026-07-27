import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireRole } from "../_shared/auth.ts";
import {
  buildPrintcomUrl,
  constantTimeEqual,
  isSafeSupplierStatusTransition,
  MASTER_TENANT_ID,
  normalizeJobIds,
  normalizePrintcomBaseUrl,
} from "../_shared/pod2PrintcomSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pod2-cron-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapPrintcomStatus(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return null;
  if (
    ["shipped", "delivered", "completed", "done", "closed", "fulfilled"]
      .includes(value)
  ) {
    return "completed";
  }
  if (
    ["cancelled", "canceled", "failed", "rejected", "refunded"].includes(value)
  ) {
    return "failed";
  }
  if (
    [
      "processing",
      "in_production",
      "in-production",
      "production",
      "printing",
      "printed",
      "in_progress",
      "accepted",
      "approved",
      "ready",
      "queued",
    ].includes(value)
  ) {
    return "processing";
  }
  if (["new", "submitted", "created", "pending"].includes(value)) {
    return "submitted";
  }
  return null;
}

function buildAuthHeaders(
  connection: Record<string, unknown>,
): Record<string, string> {
  const key = typeof connection.api_key_encrypted === "string"
    ? connection.api_key_encrypted.trim()
    : "";
  if (!key) throw new Error("Print.com credentials are missing");

  const headers: Record<string, string> = { Accept: "application/json" };
  switch (connection.auth_header_mode) {
    case "authorization_bearer":
      headers.Authorization = `Bearer ${key}`;
      break;
    case "x_api_key":
      headers["X-API-Key"] = key;
      break;
    case "custom": {
      const name = typeof connection.auth_header_name === "string"
        ? connection.auth_header_name.trim()
        : "";
      if (!/^[A-Za-z0-9-]+$/.test(name)) {
        throw new Error("Print.com custom auth header is invalid");
      }
      const prefix = typeof connection.auth_header_prefix === "string"
        ? connection.auth_header_prefix.trim()
        : "";
      headers[name] = prefix ? `${prefix} ${key}` : key;
      break;
    }
    default:
      headers.Authorization = `PrintApiKey ${key}`;
  }
  return headers;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedSupplierBody(value: unknown): unknown {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (serialized.length <= 50_000) return value;
  return { truncated: true, preview: serialized.slice(0, 50_000) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const cronSecret = Deno.env.get("POD2_CRON_SECRET") ?? "";
    const providedSecret = req.headers.get("x-pod2-cron-secret") ?? "";
    const isCronCall = cronSecret.length >= 32 &&
      providedSecret.length >= 32 &&
      constantTimeEqual(cronSecret, providedSecret);

    if (!isCronCall) {
      const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
      if (!auth.ok) return auth.response;
    }

    let jobIds: string[] | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      jobIds = normalizeJobIds(asRecord(body).jobIds);
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : "Invalid request",
      }, 400);
    }

    if (jobIds && jobIds.length === 0) {
      return json({
        success: true,
        scanned: 0,
        updated: 0,
        errors: 0,
        jobs: [],
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: connections, error: connectionError } = await serviceClient
      .from("pod2_supplier_connections")
      .select(
        "id, tenant_id, provider_key, base_url, api_key_encrypted, auth_header_mode, auth_header_name, auth_header_prefix",
      )
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("is_active", true)
      .limit(10);
    if (connectionError) {
      return json({ error: "Print.com connection could not be loaded" }, 500);
    }

    const connection = (connections || []).find((candidate) => (
      String(candidate.provider_key || "").toLowerCase().replace(
        /[^a-z0-9]/g,
        "",
      ) === "printcom"
    ));
    if (!connection) {
      return json({ error: "No active Print.com supplier connection" }, 404);
    }

    const baseUrl = normalizePrintcomBaseUrl(connection.base_url);
    const authHeaders = buildAuthHeaders(connection);

    let jobsQuery = serviceClient
      .from("pod2_fulfillment_jobs")
      .select("id, status, printcom_order_id, tenant_id, created_at")
      .not("printcom_order_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(jobIds?.length || 100);

    jobsQuery = jobIds
      ? jobsQuery.in("id", jobIds)
      : jobsQuery.in("status", ["submitted", "processing"]);

    const { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError) return json({ error: jobsError.message }, 500);

    const results: Array<Record<string, unknown>> = [];
    let updatedCount = 0;
    let errorCount = 0;

    for (const job of jobs || []) {
      const orderRef = String(job.printcom_order_id || "").trim();
      if (!orderRef) continue;

      try {
        const url = buildPrintcomUrl(
          baseUrl,
          `/orders/${encodeURIComponent(orderRef)}`,
        );
        const response = await fetch(url, {
          method: "GET",
          headers: authHeaders,
        });
        const contentType = response.headers.get("content-type") || "";
        const responseBody = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : await response.text();
        const safeBody = boundedSupplierBody(responseBody);
        const attemptedAt = new Date().toISOString();

        if (!response.ok) {
          errorCount += 1;
          const preview = typeof responseBody === "string"
            ? responseBody
            : JSON.stringify(responseBody);
          await serviceClient
            .from("pod2_fulfillment_jobs")
            .update({
              printcom_last_attempt_at: attemptedAt,
              printcom_last_error:
                `GET supplier order failed with HTTP ${response.status}: ${preview}`
                  .slice(0, 2000),
            })
            .eq("id", job.id);
          results.push({ jobId: job.id, error: true, status: response.status });
          continue;
        }

        const record = asRecord(responseBody);
        const nestedOrder = asRecord(record.order);
        const rawStatus = record.status ??
          record.orderStatus ??
          record.state ??
          nestedOrder.status ??
          null;
        const mappedStatus = mapPrintcomStatus(rawStatus);
        const safeTransition = mappedStatus
          ? isSafeSupplierStatusTransition(String(job.status), mappedStatus)
          : false;
        const shouldChange = Boolean(
          mappedStatus &&
            mappedStatus !== job.status &&
            safeTransition,
        );
        const updatePayload: Record<string, unknown> = {
          printcom_order_raw: safeBody,
          printcom_last_attempt_at: attemptedAt,
          printcom_last_error: mappedStatus && !safeTransition
            ? `Ignored unsafe supplier status transition ${job.status} -> ${mappedStatus}`
            : null,
        };
        if (shouldChange) updatePayload.status = mappedStatus;

        let updateQuery = serviceClient
          .from("pod2_fulfillment_jobs")
          .update(updatePayload)
          .eq("id", job.id)
          .eq("printcom_order_id", orderRef);
        if (shouldChange) updateQuery = updateQuery.eq("status", job.status);

        const { data: updatedJob, error: updateError } = await updateQuery
          .select("id")
          .maybeSingle();
        if (updateError) throw updateError;
        const changed = shouldChange && Boolean(updatedJob);
        if (changed) updatedCount += 1;

        results.push({
          jobId: job.id,
          before: job.status,
          after: changed ? mappedStatus : job.status,
          rawStatus: typeof rawStatus === "string" ? rawStatus : null,
          mapped: mappedStatus,
          changed,
          ignoredUnsafeTransition: Boolean(mappedStatus && !safeTransition),
        });
      } catch (error) {
        errorCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        await serviceClient
          .from("pod2_fulfillment_jobs")
          .update({
            printcom_last_attempt_at: new Date().toISOString(),
            printcom_last_error: `sync exception: ${message}`.slice(0, 2000),
          })
          .eq("id", job.id);
        results.push({ jobId: job.id, error: true, message });
      }
    }

    return json({
      success: true,
      scanned: (jobs || []).length,
      updated: updatedCount,
      errors: errorCount,
      jobs: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("pod2-printcom-sync-status error:", error);
    return json({ error: message }, 500);
  }
});
