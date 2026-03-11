import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

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

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: job, error: jobError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", job.tenant_id)
      .in("role", ["admin", "staff", "master_admin"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status !== "awaiting_approval") {
      return new Response(JSON.stringify({ error: `Job status is ${job.status}, not awaiting_approval` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: billing } = await serviceClient
      .from("pod2_tenant_billing")
      .select("*")
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    if (!billing?.stripe_customer_id || !billing?.default_payment_method_id || !billing?.is_ready) {
      return new Response(JSON.stringify({ error: "Billing not configured for this tenant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await serviceClient
      .from("pod2_fulfillment_jobs")
      .update({ status: "payment_pending", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    const amountInOre = Math.round(Number(job.tenant_cost || 0) * 100);

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInOre,
        currency: String(job.currency || "DKK").toLowerCase(),
        customer: billing.stripe_customer_id,
        payment_method: billing.default_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          tenant_id: job.tenant_id,
          job_id: jobId,
          order_id: job.order_id,
          type: "pod2_fulfillment",
        },
        description: `POD v2 Fulfillment - Job ${String(jobId).slice(0, 8)}`,
      });

      if (paymentIntent.status === "succeeded") {
        await serviceClient
          .from("pod2_fulfillment_jobs")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntent.id,
            approved_by_tenant_at: new Date().toISOString(),
            approved_by_tenant_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return new Response(JSON.stringify({
          success: true,
          status: "paid",
          paymentIntentId: paymentIntent.id,
          message: "Job godkendt og betalt. Afventer master videresendelse.",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          status: "failed",
          stripe_payment_intent_id: paymentIntent.id,
          error_message: `Payment status: ${paymentIntent.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(JSON.stringify({
        success: false,
        status: paymentIntent.status,
        error: "Payment did not succeed. Please update payment method.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (stripeError: any) {
      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          status: "failed",
          error_message: stripeError.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(JSON.stringify({
        success: false,
        error: stripeError.message,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("POD2 Approve error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
