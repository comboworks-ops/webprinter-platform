/**
 * Google Search Console Hooks
 * 
 * React hooks for Search Console integration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SearchConsoleResponse, SearchConsoleMetrics } from './search-console-types';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-console`;

// Helper to call edge function
async function callSearchConsole<T>(action: string, body: Record<string, unknown>): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

// Get tenant ID for current user
async function getTenantId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // For master admin, use a fixed tenant ID for platform SEO
    return 'platform_master';
}

// Hook: Check connection status
export function useSearchConsoleStatus() {
    return useQuery({
        queryKey: ['search-console-status'],
        queryFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<{ connected: boolean; connectedAt?: string }>('status', { tenantId });
        },
        staleTime: 30000,
    });
}

// Hook: Get authorization URL
export function useSearchConsoleAuthUrl() {
    return useMutation({
        mutationFn: async () => {
            const redirectUri = `${window.location.origin}/admin/platform-seo/callback`;
            return callSearchConsole<{ authUrl: string }>('auth-url', { redirectUri });
        },
    });
}

// Hook: Exchange authorization code for tokens
export function useSearchConsoleConnect() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (code: string) => {
            const tenantId = await getTenantId();
            const redirectUri = `${window.location.origin}/admin/platform-seo/callback`;
            return callSearchConsole<{ success: boolean }>('exchange-code', { code, redirectUri, tenantId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['search-console-status'] });
        },
    });
}

// Hook: Disconnect from Search Console
export function useSearchConsoleDisconnect() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<{ success: boolean }>('disconnect', { tenantId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['search-console-status'] });
            queryClient.invalidateQueries({ queryKey: ['search-console-data'] });
        },
    });
}

// Hook: Get verified sites
export function useSearchConsoleSites() {
    const { data: status } = useSearchConsoleStatus();

    return useQuery({
        queryKey: ['search-console-sites'],
        queryFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>('sites', { tenantId });
        },
        enabled: status?.connected === true,
    });
}

// Hook: Query Search Console data
export function useSearchConsoleQuery(options: {
    siteUrl?: string;
    startDate?: string;
    endDate?: string;
    dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[];
    rowLimit?: number;
}) {
    const { data: status } = useSearchConsoleStatus();

    return useQuery({
        queryKey: ['search-console-data', options],
        queryFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<SearchConsoleResponse>('query', {
                tenantId,
                siteUrl: options.siteUrl || 'https://webprinter.dk/',
                startDate: options.startDate || getDateDaysAgo(28),
                endDate: options.endDate || getDateDaysAgo(0),
                dimensions: options.dimensions || ['query'],
                rowLimit: options.rowLimit || 25,
            });
        },
        enabled: status?.connected === true && !!options.siteUrl,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// Hook: Get aggregated metrics for dashboard
export function useSearchConsoleMetrics(siteUrl: string) {
    const { data: status } = useSearchConsoleStatus();

    // Fetch queries data
    const queriesQuery = useQuery({
        queryKey: ['search-console-queries', siteUrl],
        queryFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<SearchConsoleResponse>('query', {
                tenantId,
                siteUrl,
                startDate: getDateDaysAgo(28),
                endDate: getDateDaysAgo(0),
                dimensions: ['query'],
                rowLimit: 10,
            });
        },
        enabled: status?.connected === true && !!siteUrl,
    });

    // Fetch pages data
    const pagesQuery = useQuery({
        queryKey: ['search-console-pages', siteUrl],
        queryFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<SearchConsoleResponse>('query', {
                tenantId,
                siteUrl,
                startDate: getDateDaysAgo(28),
                endDate: getDateDaysAgo(0),
                dimensions: ['page'],
                rowLimit: 10,
            });
        },
        enabled: status?.connected === true && !!siteUrl,
    });

    // Fetch date data for chart
    const dateQuery = useQuery({
        queryKey: ['search-console-dates', siteUrl],
        queryFn: async () => {
            const tenantId = await getTenantId();
            return callSearchConsole<SearchConsoleResponse>('query', {
                tenantId,
                siteUrl,
                startDate: getDateDaysAgo(28),
                endDate: getDateDaysAgo(0),
                dimensions: ['date'],
                rowLimit: 30,
            });
        },
        enabled: status?.connected === true && !!siteUrl,
    });

    // Combine into metrics
    const isLoading = queriesQuery.isLoading || pagesQuery.isLoading || dateQuery.isLoading;
    const error = queriesQuery.error || pagesQuery.error || dateQuery.error;

    const metrics: SearchConsoleMetrics | undefined =
        queriesQuery.data && pagesQuery.data && dateQuery.data
            ? {
                totalClicks: dateQuery.data.rows?.reduce((sum, r) => sum + r.clicks, 0) || 0,
                totalImpressions: dateQuery.data.rows?.reduce((sum, r) => sum + r.impressions, 0) || 0,
                averageCtr: calculateAverageCtr(dateQuery.data.rows || []),
                averagePosition: calculateAveragePosition(dateQuery.data.rows || []),
                topQueries: queriesQuery.data.rows || [],
                topPages: pagesQuery.data.rows || [],
                clicksByDate: (dateQuery.data.rows || []).map(r => ({
                    date: r.keys[0],
                    clicks: r.clicks,
                    impressions: r.impressions,
                })).sort((a, b) => a.date.localeCompare(b.date)),
            }
            : undefined;

    return { data: metrics, isLoading, error };
}

// Helpers
function getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

function calculateAverageCtr(rows: { ctr: number; impressions: number }[]): number {
    const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);
    if (totalImpressions === 0) return 0;
    const weightedCtr = rows.reduce((sum, r) => sum + (r.ctr * r.impressions), 0);
    return weightedCtr / totalImpressions;
}

function calculateAveragePosition(rows: { position: number; impressions: number }[]): number {
    const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);
    if (totalImpressions === 0) return 0;
    const weightedPosition = rows.reduce((sum, r) => sum + (r.position * r.impressions), 0);
    return weightedPosition / totalImpressions;
}
