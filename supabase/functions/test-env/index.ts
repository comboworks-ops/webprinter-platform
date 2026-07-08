import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireLocalOnly } from "../_shared/localOnly.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  const localOnlyError = requireLocalOnly(req);
  if (localOnlyError) return localOnlyError;

  try {
    return jsonResponse({
      FLYERALARM_DEMO_TOKEN: Boolean(Deno.env.get("FLYERALARM_DEMO_TOKEN")),
      SUPABASE_URL: Boolean(Deno.env.get("SUPABASE_URL")),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment check failed";
    return jsonResponse({ error: message }, 500);
  }
});
