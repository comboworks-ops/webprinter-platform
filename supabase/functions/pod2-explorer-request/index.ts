// POD v2 Explorer Edge Function - Runs API requests using stored credentials
// MASTER ONLY - Never expose credentials to browser

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireRole } from "../_shared/auth.ts";
import {
  buildPrintcomUrl,
  MASTER_TENANT_ID,
  normalizePrintcomBaseUrl,
  PRINTCOM_EXPLORER_ORIGINS,
} from "../_shared/pod2PrintcomSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const {
      method = "GET",
      path = "/",
      query = {},
      connectionId,
      baseUrlOverride,
    } = body;
    const normalizedMethod = String(method).toUpperCase();
    if (normalizedMethod !== "GET") {
      return new Response(
        JSON.stringify({
          error:
            "The API explorer is read-only. Supplier writes must use the validated production flow.",
        }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (
      !query || typeof query !== "object" || Array.isArray(query) ||
      Object.keys(query).length > 100
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid or oversized query parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get supplier connection (use service role for encrypted key access)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let connection: any | null = null;
    if (connectionId) {
      const { data } = await serviceClient
        .from("pod2_supplier_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("is_active", true)
        .single();
      connection = data;
    } else {
      const { data } = await serviceClient
        .from("pod2_supplier_connections")
        .select("*")
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("is_active", true)
        .limit(10);
      connection = (data || []).find((candidate: any) =>
        String(candidate.provider_key || "").toLowerCase().replace(
          /[^a-z0-9]/g,
          "",
        ) === "printcom"
      ) || null;
    }

    if (
      !connection ||
      String(connection.provider_key || "").toLowerCase().replace(
          /[^a-z0-9]/g,
          "",
        ) !== "printcom"
    ) {
      return new Response(
        JSON.stringify({ error: "No active supplier connection found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let baseUrl: string;
    try {
      baseUrl = normalizePrintcomBaseUrl(
        connection.base_url,
        PRINTCOM_EXPLORER_ORIGINS,
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Invalid base URL",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (baseUrlOverride) {
      try {
        baseUrl = normalizePrintcomBaseUrl(
          baseUrlOverride,
          PRINTCOM_EXPLORER_ORIGINS,
        );
      } catch {
        return new Response(JSON.stringify({ error: "Invalid base URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build request URL
    let url: URL;
    try {
      url = buildPrintcomUrl(baseUrl, path);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error
            ? error.message
            : "Invalid Print.com path",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
    if (url.toString().length > 8_192) {
      return new Response(
        JSON.stringify({ error: "Explorer URL is too long" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = String(connection.api_key_encrypted || "").trim();
    if (!apiKey || /[\u0000-\u001f\u007f]/.test(apiKey)) {
      return new Response(
        JSON.stringify({
          error: "Supplier credentials are missing or invalid",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const buildHeaders = (overrideMode?: "x_api_key") => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      if (overrideMode === "x_api_key") {
        headers["X-API-Key"] = apiKey;
        return headers;
      }

      if (connection.auth_header_mode === "oauth_client_credentials") {
        return headers;
      }

      switch (connection.auth_header_mode) {
        case "authorization_bearer":
          headers["Authorization"] = `Bearer ${apiKey}`;
          break;
        case "x_api_key":
          headers["X-API-Key"] = apiKey;
          break;
        case "custom":
          if (
            !/^[A-Za-z0-9-]+$/.test(
              String(connection.auth_header_name || ""),
            ) ||
            /[\u0000-\u001f\u007f]/.test(
              String(connection.auth_header_prefix || ""),
            )
          ) {
            throw new Error("Supplier custom auth header is invalid");
          }
          {
            const prefix = String(connection.auth_header_prefix || "").trim();
            headers[connection.auth_header_name] = prefix
              ? `${prefix} ${apiKey}`
              : apiKey;
          }
          break;
        case "authorization_printapikey":
        default:
          headers["Authorization"] = `PrintApiKey ${apiKey}`;
          break;
      }

      return headers;
    };

    const runRequest = async (headers: Record<string, string>) => {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });
      const contentType = response.headers.get("content-type") || "";

      let responseData;
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
        if (typeof responseData === "string" && responseData.length > 50000) {
          responseData = responseData.substring(0, 50000) + "\n... [TRUNCATED]";
        }
      }

      const serialized = typeof responseData === "string"
        ? responseData
        : JSON.stringify(responseData);
      if (serialized.length > 50_000) {
        responseData = {
          truncated: true,
          preview: serialized.slice(0, 50_000),
        };
      }

      return { response, responseData };
    };

    // Handle OAuth 2.0 Client Credentials Flow (if configured)
    let headers = buildHeaders();
    if (connection.auth_header_mode === "oauth_client_credentials") {
      const [clientId, clientSecret] = apiKey.includes(":")
        ? apiKey.split(":")
        : [apiKey, apiKey];

      const tokenUrl = new URL("/v2/oauth", `${baseUrl}/`);
      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      const tokenData = await tokenResponse.json();
      if (tokenData?.access_token) {
        headers["Authorization"] = `Bearer ${tokenData.access_token}`;
      }
    }

    let { response, responseData } = await runRequest(headers);

    if (response.status === 401) {
      const fallbackHeaders = buildHeaders("x_api_key");
      const retry = await runRequest(fallbackHeaders);
      response = retry.response;
      responseData = retry.responseData;
    }

    return new Response(
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: {
          "content-type": response.headers.get("content-type"),
          "retry-after": response.headers.get("retry-after"),
          "x-request-id": response.headers.get("x-request-id"),
        },
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("POD2 Explorer error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "POD2 Explorer request failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
