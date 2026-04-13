import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FLYERALARM_BASE_URL = "https://rest.flyeralarm-esolutions.com";

serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    // Get token
    let token = Deno.env.get("FLYERALARM_DEMO_TOKEN") || "";
    token = token.trim().replace(/^["']|["']$/g, '');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "FLYERALARM_DEMO_TOKEN not configured" }),
        { headers, status: 500 }
      );
    }

    const { endpoint, method = "GET", body: requestBody, country = "dk" } = body;

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint" }),
        { headers, status: 400 }
      );
    }

    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${FLYERALARM_BASE_URL}/${country}/v2${path}`;

    // Make request
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText.substring(0, 1000) };
    }

    // Return standardized response
    if (response.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          status: response.status,
          data: responseData,
          url,
        }),
        { headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: "Flyer Alarm API error",
          details: responseData,
          url,
        }),
        { headers, status: response.status }
      );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers, status: 500 }
    );
  }
});
