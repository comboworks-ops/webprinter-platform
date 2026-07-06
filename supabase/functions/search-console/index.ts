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
const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const MASTER_ADMIN_EMAILS = new Set(['admin@webprinter.dk', 'info@webprinter.dk']);

class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
    return new Response(
        JSON.stringify(payload),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
}

function resolvePlatformTenantId(input: unknown): string {
    const value = String(input || '').trim();
    if (!value || value === MASTER_TENANT_ID || value === 'platform_master') {
        return MASTER_TENANT_ID;
    }
    throw new HttpError(403, 'Invalid Search Console tenant scope');
}

async function requireMasterAdmin(req: Request, supabase: any) {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        throw new HttpError(401, 'Authentication required');
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
        throw new HttpError(401, 'Invalid session');
    }

    if (user.email && MASTER_ADMIN_EMAILS.has(user.email.toLowerCase())) {
        return user;
    }

    const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'master_admin')
        .limit(1);

    if (roleError) {
        console.error('Role check failed:', roleError);
        throw new HttpError(500, 'Could not verify admin access');
    }

    if (!roleRows || roleRows.length === 0) {
        throw new HttpError(403, 'Master admin access required');
    }

    return user;
}

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
            return jsonResponse({
                error: 'Google OAuth not configured',
                message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in Supabase secrets.'
            }, 500);
        }

        const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
        await requireMasterAdmin(req, supabase);

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

                return jsonResponse({ authUrl: `${GOOGLE_AUTH_URL}?${params}` });
            }

            case 'exchange-code': {
                // Exchange authorization code for tokens
                const { code, redirectUri, tenantId } = await req.json();
                const platformTenantId = resolvePlatformTenantId(tenantId);

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

                const { data: existingIntegration } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('refresh_token')
                    .eq('tenant_id', platformTenantId)
                    .maybeSingle();

                const refreshToken = tokens.refresh_token || existingIntegration?.refresh_token;
                if (!refreshToken) {
                    throw new Error('Google did not return a refresh token. Disconnect and connect again with consent.');
                }

                // Store refresh token in database
                const { error: dbError } = await supabase
                    .from('platform_seo_google_integrations')
                    .upsert({
                        tenant_id: platformTenantId,
                        refresh_token: refreshToken,
                        connected_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'tenant_id' });

                if (dbError) {
                    console.error('Database error:', dbError);
                    throw new Error('Failed to store tokens');
                }

                return jsonResponse({ success: true });
            }

            case 'disconnect': {
                // Remove stored tokens
                const { tenantId } = await req.json();
                const platformTenantId = resolvePlatformTenantId(tenantId);

                const { error: dbError } = await supabase
                    .from('platform_seo_google_integrations')
                    .update({ refresh_token: null, updated_at: new Date().toISOString() })
                    .eq('tenant_id', platformTenantId);

                if (dbError) throw new Error('Failed to disconnect');

                return jsonResponse({ success: true });
            }

            case 'status': {
                // Check connection status
                const { tenantId } = await req.json();
                const platformTenantId = resolvePlatformTenantId(tenantId);

                const { data, error } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('connected_at, refresh_token')
                    .eq('tenant_id', platformTenantId)
                    .maybeSingle();

                if (error || !data?.refresh_token) {
                    return jsonResponse({ connected: false });
                }

                return jsonResponse({ connected: true, connectedAt: data.connected_at });
            }

            case 'query': {
                // Query Search Console API
                const { tenantId, siteUrl, startDate, endDate, dimensions, rowLimit } = await req.json();
                const platformTenantId = resolvePlatformTenantId(tenantId);

                // Get refresh token
                const { data: integration } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('refresh_token')
                    .eq('tenant_id', platformTenantId)
                    .maybeSingle();

                if (!integration?.refresh_token) {
                    return jsonResponse({ error: 'Not connected to Search Console' }, 401);
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
                    return jsonResponse({ error: 'Token expired. Please reconnect.' }, 401);
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

                return jsonResponse(data);
            }

            case 'sites': {
                // Get list of verified sites
                const { tenantId } = await req.json();
                const platformTenantId = resolvePlatformTenantId(tenantId);

                // Get refresh token
                const { data: integration } = await supabase
                    .from('platform_seo_google_integrations')
                    .select('refresh_token')
                    .eq('tenant_id', platformTenantId)
                    .maybeSingle();

                if (!integration?.refresh_token) {
                    return jsonResponse({ error: 'Not connected' }, 401);
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
                    return jsonResponse({ error: 'Token expired' }, 401);
                }

                // Get sites list
                const apiResponse = await fetch(`${SEARCH_CONSOLE_API}/sites`, {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` },
                });

                const data = await apiResponse.json();

                return jsonResponse(data);
            }

            default:
                return jsonResponse({ error: 'Unknown action' }, 400);
        }
    } catch (error) {
        console.error('Search Console error:', error);
        const status = error instanceof HttpError ? error.status : 500;
        const message = error instanceof Error ? error.message : 'Unexpected Search Console error';
        return jsonResponse({ error: message }, status);
    }
});
