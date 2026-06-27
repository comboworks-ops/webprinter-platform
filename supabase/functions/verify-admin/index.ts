import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles, error } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id);

    if (error) {
      return jsonResponse({ isAdmin: false, isMasterAdmin: false, error: "Could not verify role" }, 500);
    }

    const roleNames = (roles || []).map((entry: any) => entry.role);
    const isMasterAdmin = roleNames.includes("master_admin");
    const isAdmin = isMasterAdmin || roleNames.includes("admin");

    return new Response(
      JSON.stringify({ isAdmin, isMasterAdmin, userId: auth.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verify admin failed";
    return jsonResponse({ isAdmin: false, isMasterAdmin: false, error: message }, 500);
  }
});
