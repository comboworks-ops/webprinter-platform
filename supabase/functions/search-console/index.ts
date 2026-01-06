// Supabase Edge Function: Google Search Console OAuth & API
// Handles OAuth flow and proxies Search Console API requests

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEARCH_CONSOLE_API = 'https://searchconsole.googleapis.com/webmasters/v3';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    try {
        // Get environment variables
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!clientId || !clientSecret) {
            return new Response(
                JSON.stringify({
                    error: 'Google OAuth not configured',
                    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in Supabase secrets.'
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

        switch (action) {
            case 'auth-url': {
                // Generate OAuth authorization URL
                const { redirectUri } = await req.json();

                const params = new URLSearchParams({
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
                    access_type: 'offline',
                    prompt: 'consent',
                });

                return new Response(
                    JSON.stringify({ authUrl: `${GOOGLE_AUTH_URL}?${params}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'exchange-code': {
                // Exchange authorization code for tokens
                const { code, redirectUri, tenantId } = await req.json();

                const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        code,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                    }),
                });

                const tokens = await tokenResponse.json();

                if (tokens.error) {
                    throw new Error(tokens.error_description || tokens.error);
                }

                // Store refresh token in database
                const { error: dbError } = await supabase
                    .from('platform_seo_google_integrations')
                    .upsert({
                        tenant_id: tenantId,
                        refresh_token: tokens.refresh_token,
                        connected_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'tenant_id' });

                if (dbError) {
                    console.error('Database error:', dbError);
                    throw new Error('Failed to store tokens');
                }

                return new Response(
                    JSON.stringify({ success: true }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'disconnect': {
                // Remove stored tokens
                const { tenantId } = await req.json();

                const { error: dbError } = await supabase
                    .from('platform_seo_google_integrations')
                    .update({ refresh_token: null, updated_at: new Date().toISOString() })
                    .eq('tenant_id', tenantId);

                if (dbError) throw new Error('Failed to disconnect');

                return new Response(
                    JSON.stringify({ success: true }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'status': {
                // Check connection status
                const { tenantId } = await req.json();

                const { data, error } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('connected_at, refresh_token')
                    .eq('tenant_id', tenantId)
                    .single();

                if (error || !data?.refresh_token) {
                    return new Response(
                        JSON.stringify({ connected: false }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                return new Response(
                    JSON.stringify({ connected: true, connectedAt: data.connected_at }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'query': {
                // Query Search Console API
                const { tenantId, siteUrl, startDate, endDate, dimensions, rowLimit } = await req.json();

                // Get refresh token
                const { data: integration } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('refresh_token')
                    .eq('tenant_id', tenantId)
                    .single();

                if (!integration?.refresh_token) {
                    return new Response(
                        JSON.stringify({ error: 'Not connected to Search Console' }),
                        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                // Get fresh access token
                const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: integration.refresh_token,
                        grant_type: 'refresh_token',
                    }),
                });

                const tokens = await tokenResponse.json();

                if (tokens.error) {
                    // Token might be revoked
                    return new Response(
                        JSON.stringify({ error: 'Token expired. Please reconnect.' }),
                        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                // Query Search Console API
                const apiUrl = `${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

                const apiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        startDate,
                        endDate,
                        dimensions: dimensions || ['query'],
                        rowLimit: rowLimit || 25,
                    }),
                });

                const data = await apiResponse.json();

                if (!apiResponse.ok) {
                    throw new Error(data.error?.message || 'API request failed');
                }

                return new Response(
                    JSON.stringify(data),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'sites': {
                // Get list of verified sites
                const { tenantId } = await req.json();

                // Get refresh token
                const { data: integration } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('refresh_token')
                    .eq('tenant_id', tenantId)
                    .single();

                if (!integration?.refresh_token) {
                    return new Response(
                        JSON.stringify({ error: 'Not connected' }),
                        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                // Get fresh access token
                const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: integration.refresh_token,
                        grant_type: 'refresh_token',
                    }),
                });

                const tokens = await tokenResponse.json();

                if (tokens.error) {
                    return new Response(
                        JSON.stringify({ error: 'Token expired' }),
                        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                // Get sites list
                const apiResponse = await fetch(`${SEARCH_CONSOLE_API}/sites`, {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` },
                });

                const data = await apiResponse.json();

                return new Response(
                    JSON.stringify(data),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            default:
                return new Response(
                    JSON.stringify({ error: 'Unknown action' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
        }
    } catch (error) {
        console.error('Search Console error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
