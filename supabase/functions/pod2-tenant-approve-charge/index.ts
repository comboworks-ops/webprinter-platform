import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

import { normalizeJobIds } from "../_shared/pod2PrintcomSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth
      .getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let jobId = "";
    try {
      jobId = normalizeJobIds([body?.jobId], 1)?.[0] || "";
    } catch {
      // Invalid identifiers are rejected below.
    }
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "A valid jobId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
      return new Response(
        JSON.stringify({
          error: `Job status is ${job.status}, not awaiting_approval`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: billing } = await serviceClient
      .from("pod2_tenant_billing")
      .select("*")
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    if (
      !billing?.stripe_customer_id || !billing?.default_payment_method_id ||
      !billing?.is_ready
    ) {
      return new Response(
        JSON.stringify({ error: "Billing not configured for this tenant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const amountInOre = Math.round(Number(job.tenant_cost || 0) * 100);
    if (!Number.isInteger(amountInOre) || amountInOre <= 0) {
      return new Response(
        JSON.stringify({ error: "Supplier cost is invalid" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const currency = String(job.currency || "").trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      return new Response(
        JSON.stringify({ error: "Job currency is invalid" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: claimedJob, error: claimError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .update({
        status: "payment_pending",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "awaiting_approval")
      .select("id")
      .maybeSingle();

    if (claimError || !claimedJob) {
      return new Response(
        JSON.stringify({
          error: "Jobbet blev ændret eller betalingen er allerede startet",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountInOre,
          currency,
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
        },
        { idempotencyKey: `pod2-fulfillment-${jobId}` },
      );

      if (paymentIntent.status === "succeeded") {
        const { data: paidJob, error: paidError } = await serviceClient
          .from("pod2_fulfillment_jobs")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntent.id,
            approved_by_tenant_at: new Date().toISOString(),
            approved_by_tenant_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("status", "payment_pending")
          .select("id")
          .maybeSingle();

        if (paidError || !paidJob) {
          return new Response(
            JSON.stringify({
              error:
                "Betalingen lykkedes, men jobstatus kræver manuel afklaring",
              paymentIntentId: paymentIntent.id,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: "paid",
            paymentIntentId: paymentIntent.id,
            message: "Job godkendt og betalt. Afventer master videresendelse.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          status: "failed",
          stripe_payment_intent_id: paymentIntent.id,
          error_message: `Payment status: ${paymentIntent.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "payment_pending");

      return new Response(
        JSON.stringify({
          success: false,
          status: paymentIntent.status,
          error: "Payment did not succeed. Please update payment method.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (stripeError: any) {
      const errorType = String(stripeError?.type || "");
      const isDefinitiveFailure = [
        "StripeCardError",
        "StripeInvalidRequestError",
        "StripeAuthenticationError",
        "StripePermissionError",
      ].includes(errorType);
      const paymentIntentId =
        typeof stripeError?.payment_intent?.id === "string"
          ? stripeError.payment_intent.id
          : null;
      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          status: isDefinitiveFailure ? "failed" : "payment_pending",
          stripe_payment_intent_id: paymentIntentId,
          error_message: isDefinitiveFailure
            ? stripeError.message
            : `Betalingsresultat skal afklares: ${stripeError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "payment_pending");

      return new Response(
        JSON.stringify({
          success: false,
          error: stripeError.message,
          uncertain: !isDefinitiveFailure,
          paymentIntentId,
        }),
        {
          status: isDefinitiveFailure ? 400 : 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("POD2 Approve error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
