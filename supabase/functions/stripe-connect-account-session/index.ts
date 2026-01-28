// Stripe Connect: create account session for embedded onboarding
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

    const { data: settings } = await serviceClient
      .from("tenant_payment_settings")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!settings?.stripe_account_id) {
      return jsonResponse({ error: "Stripe account missing" }, 404);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const accountSessions = (stripe as any).accountSessions;
    if (!accountSessions?.create) {
      return jsonResponse({ error: "Stripe account sessions er ikke tilgængelig for denne API-nøgle." }, 500);
    }

    const session = await accountSessions.create({
      account: settings.stripe_account_id,
      components: { account_onboarding: { enabled: true } },
    });

    return jsonResponse({ client_secret: session.client_secret });
  } catch (error: any) {
    console.error("stripe-connect-account-session error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 500);
  }
});
