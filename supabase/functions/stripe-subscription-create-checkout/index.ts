// Stripe Billing: create Checkout Session for tenant subscription
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_PLANS = new Set(["starter", "professional", "enterprise"]);
const VALID_CYCLES = new Set(["monthly", "yearly"]);

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPriceId(planId: string, billingCycle: string): string {
  const envKey = `STRIPE_SUBSCRIPTION_PRICE_${planId.toUpperCase()}_${billingCycle.toUpperCase()}`;
  const value = Deno.env.get(envKey);
  if (!value) {
    throw new Error(`Missing environment variable: ${envKey}`);
  }
  return value;
}

async function assertTenantAccess(serviceClient: ReturnType<typeof createClient>, userId: string, tenantId: string) {
  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", userId);

  const isMasterAdmin = (roles || []).some((role: any) => role.role === "master_admin");
  const hasTenantRole = (roles || []).some(
    (role: any) => ["admin", "staff"].includes(role.role) && role.tenant_id === tenantId,
  );

  if (isMasterAdmin || hasTenantRole) return;

  const { data: owned } = await serviceClient
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!owned) {
    throw new Error("Forbidden");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id as string | undefined;
    const planId = String(body.plan_id || "").toLowerCase();
    const billingCycle = String(body.billing_cycle || "").toLowerCase();
    const successUrl = body.success_url as string | undefined;
    const cancelUrl = body.cancel_url as string | undefined;

    if (!tenantId) return jsonResponse({ error: "tenant_id required" }, 400);
    if (!VALID_PLANS.has(planId)) return jsonResponse({ error: "plan_id invalid" }, 400);
    if (!VALID_CYCLES.has(billingCycle)) return jsonResponse({ error: "billing_cycle invalid" }, 400);
    if (!successUrl || !cancelUrl) return jsonResponse({ error: "success_url and cancel_url required" }, 400);

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authedClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    await assertTenantAccess(serviceClient, user.id, tenantId);

    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    const { data: existing } = await serviceClient
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(existing.status || "")) {
      return jsonResponse(
        { error: "Tenant already has an active subscription. Use the billing portal to change plan." },
        409,
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const priceId = getPriceId(planId, billingCycle);

    let customerId = existing?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: (tenant as any)?.name || undefined,
        metadata: {
          tenant_id: tenantId,
        },
      });
      customerId = customer.id;
    }

    const trialDaysRaw = Deno.env.get("STRIPE_SUBSCRIPTION_TRIAL_DAYS");
    const trialDays = trialDaysRaw ? Number(trialDaysRaw) : 14;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: tenantId,
        plan_id: planId,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan_id: planId,
          billing_cycle: billingCycle,
        },
        trial_period_days: Number.isFinite(trialDays) && trialDays > 0 ? Math.floor(trialDays) : undefined,
      },
    });

    const mergeMetadata = {
      ...(existing?.metadata || {}),
      last_checkout_session_id: session.id,
      last_checkout_at: new Date().toISOString(),
    };

    const { error: saveError } = await serviceClient
      .from("tenant_subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          provider: "stripe",
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          plan_id: planId,
          billing_cycle: billingCycle,
          metadata: mergeMetadata,
        },
        { onConflict: "tenant_id" },
      );

    if (saveError) throw saveError;

    return jsonResponse({
      url: session.url,
      session_id: session.id,
      customer_id: customerId,
    });
  } catch (error: any) {
    console.error("stripe-subscription-create-checkout error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Forbidden" ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
