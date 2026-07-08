export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function optionsResponse(): Response {
  return new Response("ok", { headers: corsHeaders });
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: "Method not allowed" }, 405);
}
