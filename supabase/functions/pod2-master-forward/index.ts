import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireRole } from "../_shared/auth.ts";
import {
  getSubmissionEligibility,
  MASTER_TENANT_ID,
  normalizeJobIds,
} from "../_shared/pod2PrintcomSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
    if (!auth.ok) return auth.response;

    const body = asRecord(await req.json().catch(() => ({})));
    let jobId: string;
    try {
      [jobId] = normalizeJobIds([body.jobId], 1) || [];
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : "Invalid jobId",
      }, 400);
    }
    if (!jobId) return json({ error: "A valid jobId is required" }, 400);

    const providerJobRef = typeof body.providerJobRef === "string"
      ? body.providerJobRef.trim()
      : "";
    if (
      !providerJobRef || providerJobRef.length > 200 ||
      /[\u0000-\u001f]/.test(providerJobRef)
    ) {
      return json({
        error: "A valid supplier reference is required for manual forwarding",
      }, 400);
    }
    const masterNotes = typeof body.masterNotes === "string"
      ? body.masterNotes.trim().slice(0, 2000)
      : "";

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: job, error: jobError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .select(
        "id, tenant_id, status, qty, tenant_cost, currency, stripe_payment_intent_id, provider_job_ref, printcom_order_id, printcom_submission_lock_token",
      )
      .eq("id", jobId)
      .maybeSingle();
    if (jobError || !job) return json({ error: "Job not found" }, 404);

    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("id, pod2_auto_forward")
      .eq("id", job.tenant_id)
      .maybeSingle();
    if (!tenant) return json({ error: "Tenant not found" }, 404);

    const eligibility = getSubmissionEligibility({
      job,
      tenantAutoForward: tenant.pod2_auto_forward === true,
    });
    if (!eligibility.ok) {
      return json({ error: eligibility.message, code: eligibility.code }, 409);
    }

    const now = new Date().toISOString();
    const { data: updatedJob, error: updateError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .update({
        status: "submitted",
        provider_job_ref: providerJobRef,
        master_notes: masterNotes || null,
        submitted_by_master_at: now,
        submitted_by_master_user_id: auth.user.id,
        printcom_payment_verification: eligibility.paymentVerification,
        printcom_payment_verified_at: now,
        updated_at: now,
      })
      .eq("id", jobId)
      .eq("status", "paid")
      .is("provider_job_ref", null)
      .is("printcom_order_id", null)
      .is("printcom_submission_lock_token", null)
      .select("*")
      .maybeSingle();

    if (updateError || !updatedJob) {
      return json({
        error: "Jobbet blev ændret og kunne ikke markeres som videresendt",
      }, 409);
    }

    return json({
      success: true,
      job: updatedJob,
      message: "Job markeret som manuelt videresendt fra master.",
    });
  } catch (error) {
    console.error("POD2 Master Forward error:", error);
    return json({
      error: error instanceof Error ? error.message : "POD2 forwarding failed",
    }, 500);
  }
});
