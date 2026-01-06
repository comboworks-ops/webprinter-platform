/**
 * Google Search Console Integration Types
 * 
 * Types for Search Console API integration.
 */

export interface SearchConsoleQuery {
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[];
    rowLimit?: number;
    startRow?: number;
}

export interface SearchConsoleRow {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

export interface SearchConsoleResponse {
    rows?: SearchConsoleRow[];
    responseAggregationType?: string;
}

export interface SearchConsoleSiteInfo {
    siteUrl: string;
    permissionLevel: string;
}

export interface SearchConsoleTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: string;
    scope: string;
}

// Aggregated metrics for dashboard
export interface SearchConsoleMetrics {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
    topQueries: SearchConsoleRow[];
    topPages: SearchConsoleRow[];
    clicksByDate: { date: string; clicks: number; impressions: number }[];
}
