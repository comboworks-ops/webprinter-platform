// Stripe Billing: create customer portal session
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
    const returnUrl = body.return_url as string | undefined;

    if (!tenantId) return jsonResponse({ error: "tenant_id required" }, 400);
    if (!returnUrl) return jsonResponse({ error: "return_url required" }, 400);

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

    const { data: subscription } = await serviceClient
      .from("tenant_subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      return jsonResponse({ error: "No Stripe customer found for tenant subscription" }, 404);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    return jsonResponse({ url: session.url });
  } catch (error: any) {
    console.error("stripe-subscription-create-portal error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Forbidden" ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
