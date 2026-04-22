// POD v2: Poll Print.com for status updates on submitted jobs.
//
// Print.com does not publish webhook documentation (as of 2026-04-22;
// available only via integration partner support). Until that lands, we
// keep job status in sync by polling `GET /orders/{orderNumber}` for
// every job still in a non-terminal state (`submitted`, `processing`).
//
// Input:  { jobIds?: string[] }  — optional list of specific job ids to
//                                  sync. Omit to sync all non-terminal jobs.
// Output: { success, scanned, updated, errors, jobs: [{ jobId, before, after, raw? }] }
//
// MASTER ONLY. Can be invoked manually from POD v2 Ordrer, or on a cron.
// The same status-mapping logic is reused when we eventually receive
// real webhooks — only the transport changes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Map Print.com's order status string onto our pod2_fulfillment_jobs.status
// check constraint (awaiting_approval | payment_pending | paid | submitted |
// failed | completed). We keep this lenient because Print.com's docs don't
// enumerate every possible status — unknown values fall through as null and
// leave our status unchanged.
function mapPrintcomStatus(raw: string | null | undefined): string | null {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return null;
    // Known terminal = completed
    if (
        v === "shipped"
        || v === "delivered"
        || v === "completed"
        || v === "done"
        || v === "closed"
        || v === "fulfilled"
    ) return "completed";
    // Known terminal = failed / cancelled
    if (
        v === "cancelled"
        || v === "canceled"
        || v === "failed"
        || v === "rejected"
        || v === "refunded"
    ) return "failed";
    // In-flight states — normalize anything that smells like production
    // progress as `processing` so the UI can distinguish "just submitted"
    // from "print-house is actually working on it".
    if (
        v === "processing"
        || v === "in_production"
        || v === "in-production"
        || v === "production"
        || v === "printing"
        || v === "printed"
        || v === "in_progress"
        || v === "accepted"
        || v === "approved"
        || v === "ready"
        || v === "queued"
    ) return "processing";
    // Anything that looks brand new — keep as `submitted`.
    if (v === "new" || v === "submitted" || v === "created" || v === "pending") {
        return "submitted";
    }
    return null;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Two entry paths:
        //   1. Master admin clicks the "Sync Print.com status" button in the
        //      UI — arrives with a real user JWT.
        //   2. pg_cron invokes the function on a schedule — arrives with a
        //      shared cron secret in the X-Pod2-Cron-Secret header. No user
        //      session to check.
        //
        // We accept either. The cron secret is a dedicated env var
        // (POD2_CRON_SECRET) so we don't have to guess which flavor of
        // service role key Supabase injects (legacy JWT vs. the newer
        // sb_secret_* format).
        const cronSecret = Deno.env.get("POD2_CRON_SECRET") ?? "";
        const providedSecret = req.headers.get("x-pod2-cron-secret") || "";
        const isCronCall = Boolean(cronSecret) && providedSecret === cronSecret;

        if (!isCronCall) {
            const authHeader = req.headers.get("Authorization") || "";
            if (!authHeader) {
                return json({ error: "Unauthorized" }, 401);
            }
            const supabaseClient = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_ANON_KEY") ?? "",
                { global: { headers: { Authorization: authHeader } } },
            );

            const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
            if (authError || !user) {
                return json({ error: "Unauthorized" }, 401);
            }

            // Master-only gate.
            const { data: masterRole } = await supabaseClient
                .from("user_roles")
                .select("role, tenant_id")
                .eq("user_id", user.id)
                .eq("tenant_id", MASTER_TENANT_ID)
                .in("role", ["admin", "master_admin"])
                .limit(1)
                .maybeSingle();
            if (!masterRole) {
                return json({ error: "Kun master admin kan synkronisere Print.com status" }, 403);
            }
        }

        const body = await req.json().catch(() => ({}));
        const jobIdsInput: string[] | undefined = Array.isArray(body?.jobIds) ? body.jobIds : undefined;

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // ---------- load Print.com connection ----------
        const { data: connection } = await serviceClient
            .from("pod2_supplier_connections")
            .select("id, base_url, api_key_encrypted, auth_header_mode, auth_header_name, auth_header_prefix")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
        if (!connection) return json({ error: "No active Print.com supplier connection" }, 404);

        const baseUrl: string = connection.base_url || "https://api.print.com";

        const authHeaders = (): Record<string, string> => {
            const h: Record<string, string> = { Accept: "application/json" };
            const key: string = connection.api_key_encrypted;
            switch (connection.auth_header_mode) {
                case "authorization_bearer":
                    h["Authorization"] = `Bearer ${key}`;
                    break;
                case "authorization_printapikey":
                    h["Authorization"] = `PrintApiKey ${key}`;
                    break;
                case "x_api_key":
                    h["X-API-Key"] = key;
                    break;
                case "custom":
                    if (connection.auth_header_name) {
                        const prefix = connection.auth_header_prefix || "";
                        h[connection.auth_header_name] = prefix ? `${prefix} ${key}` : key;
                    }
                    break;
                default:
                    h["Authorization"] = `PrintApiKey ${key}`;
            }
            return h;
        };

        // ---------- pick jobs to sync ----------
        let jobsQuery = serviceClient
            .from("pod2_fulfillment_jobs")
            .select("id, status, printcom_order_id, provider_job_ref, tenant_id")
            .not("printcom_order_id", "is", null);

        if (jobIdsInput && jobIdsInput.length > 0) {
            jobsQuery = jobsQuery.in("id", jobIdsInput);
        } else {
            jobsQuery = jobsQuery.in("status", ["submitted", "processing"]);
        }

        const { data: jobs, error: jobsError } = await jobsQuery;
        if (jobsError) return json({ error: jobsError.message }, 500);

        const results: any[] = [];
        let updatedCount = 0;
        let errorCount = 0;

        for (const job of jobs || []) {
            const orderRef = job.printcom_order_id || job.provider_job_ref;
            if (!orderRef) {
                results.push({ jobId: job.id, skipped: true, reason: "no printcom_order_id" });
                continue;
            }

            const url = new URL(`/orders/${encodeURIComponent(orderRef)}`, baseUrl).toString();
            try {
                const resp = await fetch(url, { method: "GET", headers: authHeaders() });
                const contentType = resp.headers.get("content-type") || "";
                const respBody = contentType.includes("application/json")
                    ? await resp.json().catch(() => null)
                    : await resp.text();

                if (!resp.ok) {
                    errorCount += 1;
                    await serviceClient
                        .from("pod2_fulfillment_jobs")
                        .update({
                            printcom_last_attempt_at: new Date().toISOString(),
                            printcom_last_error: `GET /orders/${orderRef} -> ${resp.status}: ${
                                typeof respBody === "string" ? respBody : JSON.stringify(respBody)
                            }`.slice(0, 2000),
                        })
                        .eq("id", job.id);
                    results.push({
                        jobId: job.id,
                        error: true,
                        status: resp.status,
                        body: respBody,
                    });
                    continue;
                }

                // Print.com's response shape is not fully documented; probe a
                // couple of common field names so we don't miss the status.
                const r = (respBody || {}) as Record<string, any>;
                const rawStatus: string | null =
                    r.status
                    || r.orderStatus
                    || r.state
                    || r.order?.status
                    || null;
                const mapped = mapPrintcomStatus(rawStatus);

                const updatePayload: Record<string, any> = {
                    printcom_order_raw: respBody ?? null,
                    printcom_last_attempt_at: new Date().toISOString(),
                    printcom_last_error: null,
                };

                if (mapped && mapped !== job.status) {
                    updatePayload.status = mapped;
                    updatedCount += 1;
                }

                await serviceClient
                    .from("pod2_fulfillment_jobs")
                    .update(updatePayload)
                    .eq("id", job.id);

                results.push({
                    jobId: job.id,
                    before: job.status,
                    after: mapped && mapped !== job.status ? mapped : job.status,
                    rawStatus,
                    mapped,
                    changed: Boolean(mapped && mapped !== job.status),
                });
            } catch (err) {
                errorCount += 1;
                const msg = err instanceof Error ? err.message : String(err);
                await serviceClient
                    .from("pod2_fulfillment_jobs")
                    .update({
                        printcom_last_attempt_at: new Date().toISOString(),
                        printcom_last_error: `sync exception: ${msg}`.slice(0, 2000),
                    })
                    .eq("id", job.id);
                results.push({ jobId: job.id, error: true, message: msg });
            }
        }

        return json({
            success: true,
            scanned: (jobs || []).length,
            updated: updatedCount,
            errors: errorCount,
            jobs: results,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("pod2-printcom-sync-status error:", err);
        return json({ error: msg }, 500);
    }
});
