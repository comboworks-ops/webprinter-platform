// Supabase Edge Function: Platform PageSpeed Insights Proxy
// Calls PageSpeed Insights API with server-side API key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url, strategy = 'mobile' } = await req.json();

        if (!url) {
            return new Response(
                JSON.stringify({ error: 'URL is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get API key from environment
        const apiKey = Deno.env.get('PAGESPEED_API_KEY');

        if (!apiKey) {
            // Return mock data if no API key configured
            console.log('PageSpeed API key not configured, returning mock data');

            const mockResult = {
                performance: Math.floor(Math.random() * 30) + 70,
                accessibility: Math.floor(Math.random() * 20) + 80,
                bestPractices: Math.floor(Math.random() * 25) + 75,
                seo: Math.floor(Math.random() * 15) + 85,
            };

            return new Response(
                JSON.stringify({ lighthouse: mockResult, isMock: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Call PageSpeed Insights API
        const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        apiUrl.searchParams.set('url', url);
        apiUrl.searchParams.set('strategy', strategy);
        apiUrl.searchParams.set('key', apiKey);
        apiUrl.searchParams.set('category', 'performance');
        apiUrl.searchParams.set('category', 'accessibility');
        apiUrl.searchParams.set('category', 'best-practices');
        apiUrl.searchParams.set('category', 'seo');

        const response = await fetch(apiUrl.toString());
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'PageSpeed API error');
        }

        // Extract scores
        const lighthouse = {
            performance: Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100),
            accessibility: Math.round((data.lighthouseResult?.categories?.accessibility?.score || 0) * 100),
            bestPractices: Math.round((data.lighthouseResult?.categories?.['best-practices']?.score || 0) * 100),
            seo: Math.round((data.lighthouseResult?.categories?.seo?.score || 0) * 100),
        };

        return new Response(
            JSON.stringify({ lighthouse, isMock: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('PageSpeed error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
