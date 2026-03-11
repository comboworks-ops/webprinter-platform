import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { jobId, providerJobRef, masterNotes } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: masterRole } = await supabaseClient
      .from("user_roles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("tenant_id", MASTER_TENANT_ID)
      .in("role", ["admin", "master_admin"])
      .limit(1)
      .maybeSingle();

    if (!masterRole) {
      return new Response(JSON.stringify({ error: "Kun master admin kan videresende POD v2 jobs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: job, error: jobError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .select("id, status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status !== "paid") {
      return new Response(JSON.stringify({ error: `Job status is ${job.status}, expected paid` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      status: "submitted",
      submitted_by_master_at: new Date().toISOString(),
      submitted_by_master_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (typeof providerJobRef === "string" && providerJobRef.trim()) {
      payload.provider_job_ref = providerJobRef.trim();
    }
    if (typeof masterNotes === "string") {
      payload.master_notes = masterNotes.trim() || null;
    }

    const { data: updatedJob, error: updateError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .update(payload)
      .eq("id", jobId)
      .select()
      .maybeSingle();

    if (updateError || !updatedJob) {
      throw updateError || new Error("Failed to update POD v2 job");
    }

    return new Response(JSON.stringify({
      success: true,
      job: updatedJob,
      message: "Job markeret som videresendt fra master.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POD2 Master Forward error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
