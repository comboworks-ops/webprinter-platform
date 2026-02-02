// Stripe Connect: sync account status
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

function computeStatus(account: Stripe.Account) {
  if (account.charges_enabled) return "connected";
  const requirements = account.requirements;
  const hasDue =
    (requirements?.currently_due?.length || 0) > 0 ||
    (requirements?.past_due?.length || 0) > 0 ||
    (requirements?.pending_verification?.length || 0) > 0;
  return hasDue ? "restricted" : "pending";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id: tenantId } = await req.json().catch(() => ({ tenant_id: null }));
    if (!tenantId) {
      return jsonResponse({ error: "tenant_id required" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);

    const isMasterAdmin = (roles || []).some((role: any) => role.role === "master_admin");
    const hasTenantRole = (roles || []).some(
      (role: any) => ["admin", "staff"].includes(role.role) && role.tenant_id === tenantId
    );

    let isOwner = false;
    if (!isMasterAdmin && !hasTenantRole) {
      const { data: owned } = await serviceClient
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .eq("owner_id", user.id)
        .maybeSingle();
      isOwner = !!owned;
    }

    if (!isMasterAdmin && !hasTenantRole && !isOwner) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: settings } = await serviceClient
      .from("tenant_payment_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!settings?.stripe_account_id) {
      return jsonResponse({ error: "Stripe account missing" }, 404);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const account = await stripe.accounts.retrieve(settings.stripe_account_id);
    const nextStatus = settings.status === "disabled" ? "disabled" : computeStatus(account);

    const payload = {
      status: nextStatus,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      country: account.country,
      currency: account.default_currency,
    };

    const { data: saved, error: saveError } = await serviceClient
      .from("tenant_payment_settings")
      .update(payload)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();

    if (saveError) {
      throw saveError;
    }

    return jsonResponse(saved);
  } catch (error: any) {
    console.error("stripe-connect-sync-status error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 500);
  }
});
