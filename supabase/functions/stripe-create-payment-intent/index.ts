// Stripe PaymentIntent creation with tenant-aware destination charges
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id as string | undefined;
    const amountOre = Number(body.amount_ore);
    const currency = (body.currency as string | undefined) || "dkk";
    const metadata = body.metadata as Record<string, string> | undefined;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id required" }, 400);
    }
    if (!Number.isFinite(amountOre) || amountOre <= 0) {
      return jsonResponse({ error: "amount_ore must be a positive number" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await serviceClient
      .from("tenant_payment_settings")
      .select("stripe_account_id, status, charges_enabled, platform_fee_percent, platform_fee_flat_ore")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const canUseConnected =
      !!settings?.stripe_account_id &&
      settings?.charges_enabled &&
      settings?.status !== "disabled";

    const percentFee = Number(settings?.platform_fee_percent || 0);
    const flatFee = Number(settings?.platform_fee_flat_ore || 0);
    const percentAmount = Math.round(amountOre * (percentFee / 100));
    const applicationFee = Math.max(0, Math.min(amountOre, percentAmount + flatFee));

    if (canUseConnected) {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(amountOre),
          currency,
          application_fee_amount: applicationFee > 0 ? applicationFee : undefined,
          metadata: {
            tenant_id: tenantId,
            ...(metadata || {}),
          },
        },
        { stripeAccount: settings!.stripe_account_id! }
      );

      return jsonResponse({
        client_secret: paymentIntent.client_secret,
        connected: true,
        mode: "direct",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountOre),
      currency,
      metadata: {
        tenant_id: tenantId,
        ...(metadata || {}),
      },
    });

    return jsonResponse({
      client_secret: paymentIntent.client_secret,
      connected: false,
      mode: "platform",
    });
  } catch (error: any) {
    console.error("stripe-create-payment-intent error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 500);
  }
});
