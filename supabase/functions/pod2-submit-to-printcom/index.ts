import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { requireRole } from "../_shared/auth.ts";
import { MASTER_TENANT_ID } from "../_shared/pod2PrintcomSafety.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
  if (!auth.ok) return auth.response;

  return json({
    error:
      "The legacy Print.com adapter is disabled. Use pod2-order-submit after a fresh server-side validation.",
    code: "legacy_adapter_disabled",
  }, 410);
});
