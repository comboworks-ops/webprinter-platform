// Stripe Connect: create or retrieve a tenant account
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

    const { data: existing } = await serviceClient
      .from("tenant_payment_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing?.stripe_account_id) {
      return jsonResponse(existing);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("name, settings")
      .eq("id", tenantId)
      .maybeSingle();

    const company = (tenant as any)?.settings?.company || {};
    const country = company?.country || "DK";
    const email = company?.email || user.email || undefined;

    const account = await stripe.accounts.create({
      type: "express",
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        tenant_id: tenantId,
        tenant_name: (tenant as any)?.name || "",
      },
    });

    const status = account.charges_enabled ? "connected" : "pending";
    const payload = {
      tenant_id: tenantId,
      provider: "stripe",
      stripe_account_id: account.id,
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      country: account.country,
      currency: account.default_currency,
    };

    const { data: saved, error: saveError } = await serviceClient
      .from("tenant_payment_settings")
      .upsert(payload, { onConflict: "tenant_id" })
      .select("*")
      .maybeSingle();

    if (saveError) {
      throw saveError;
    }

    return jsonResponse(saved);
  } catch (error: any) {
    console.error("stripe-connect-create-or-get error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 500);
  }
});
