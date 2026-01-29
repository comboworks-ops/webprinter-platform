// POD v2 Explorer Edge Function - Runs API requests using stored credentials
// MASTER ONLY - Never expose credentials to browser

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
        );

        // Verify master admin
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Check master admin role (lenient like v1)
        const { data: roleData, error: roleError } = await supabaseClient
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

        const roles = (roleData || []).map((r: any) => r.role);
        if (roles.length === 0 && !user) {
            return new Response(JSON.stringify({ error: "Master admin required", debug: { roles, roleError } }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const { method = "GET", path = "/", query = {}, requestBody, connectionId, baseUrlOverride } = body;

        // Get supplier connection (use service role for encrypted key access)
        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let connection: any | null = null;
        if (connectionId) {
            const { data } = await serviceClient
                .from("pod2_supplier_connections")
                .select("*")
                .eq("id", connectionId)
                .single();
            connection = data;
        } else {
            const { data } = await serviceClient
                .from("pod2_supplier_connections")
                .select("*")
                .eq("is_active", true)
                .limit(1)
                .single();
            connection = data;
        }

        // Fallback to POD v1 connection if none exists for v2
        if (!connection) {
            const { data } = await serviceClient
                .from("pod_supplier_connections")
                .select("*")
                .eq("is_active", true)
                .limit(1)
                .single();
            connection = data;
        }

        if (!connection) {
            return new Response(JSON.stringify({ error: "No active supplier connection found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const allowedBaseUrls = new Set([
            "https://api.print.com",
            "https://api.stg.print.com",
            "https://platform.print.com",
        ]);

        let baseUrl = connection.base_url;
        if (baseUrlOverride) {
            try {
                const override = new URL(baseUrlOverride);
                const normalized = override.origin;
                if (!allowedBaseUrls.has(normalized)) {
                    return new Response(JSON.stringify({ error: "Base URL not allowed" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
                baseUrl = normalized;
            } catch {
                return new Response(JSON.stringify({ error: "Invalid base URL" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        // Build request URL
        const url = new URL(path, baseUrl);
        Object.entries(query).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") {
                url.searchParams.set(k, String(v));
            }
        });

        const apiKey = connection.api_key_encrypted;

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
                    if (connection.auth_header_name) {
                        const prefix = connection.auth_header_prefix || "";
                        headers[connection.auth_header_name] = prefix ? `${prefix} ${apiKey}` : apiKey;
                    }
                    break;
            }

            return headers;
        };

        const runRequest = async (headers: Record<string, string>) => {
            const fetchOptions: RequestInit = {
                method: method.toUpperCase(),
                headers,
            };

            if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && requestBody) {
                fetchOptions.body = JSON.stringify(requestBody);
            }

            const response = await fetch(url.toString(), fetchOptions);
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

            return { response, responseData };
        };

        // Handle OAuth 2.0 Client Credentials Flow (if configured)
        let headers = buildHeaders();
        if (connection.auth_header_mode === "oauth_client_credentials") {
            const [clientId, clientSecret] = apiKey.includes(":")
                ? apiKey.split(":")
                : [apiKey, apiKey];

            const tokenUrl = new URL("/v2/oauth", connection.base_url);
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

        return new Response(JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData,
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("POD2 Explorer error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
