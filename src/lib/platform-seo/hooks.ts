/**
 * Platform SEO Hooks
 * 
 * React hooks for fetching and managing platform SEO data.
 * Master-admin only access via RLS.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
    PlatformSeoSettings,
    PlatformSeoPage,
    PlatformSeoPagespeedSnapshot,
} from './types';

const MASTER_TENANT_ID = 'e1c1a2b3-4d5e-6f7a-8b9c-0d1e2f3a4b5c'; // TODO: Get from config

/**
 * Fetch platform SEO settings
 */
export function usePlatformSeoSettings() {
    return useQuery({
        queryKey: ['platform-seo-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('platform_seo_settings')
                .select('*')
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data as PlatformSeoSettings | null;
        },
    });
}

/**
 * Update platform SEO settings
 */
export function useUpdatePlatformSeoSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: Partial<PlatformSeoSettings>) => {
            const { data: existing } = await supabase
                .from('platform_seo_settings')
                .select('id')
                .single();

            if (existing) {
                const { data, error } = await supabase
                    .from('platform_seo_settings')
                    .update(settings)
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from('platform_seo_settings')
                    .insert({ ...settings, tenant_id: MASTER_TENANT_ID })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-seo-settings'] });
        },
    });
}

/**
 * Fetch all platform SEO pages
 */
export function usePlatformSeoPages() {
    return useQuery({
        queryKey: ['platform-seo-pages'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('platform_seo_pages')
                .select('*')
                .order('path');

            if (error) throw error;
            return data as PlatformSeoPage[];
        },
    });
}

/**
 * Fetch single platform SEO page by path
 */
export function usePlatformSeoPage(path: string, locale?: string) {
    return useQuery({
        queryKey: ['platform-seo-page', path, locale],
        queryFn: async () => {
            let query = supabase
                .from('platform_seo_pages')
                .select('*')
                .eq('path', path);

            if (locale) {
                query = query.eq('locale', locale);
            } else {
                query = query.is('locale', null);
            }

            const { data, error } = await query.single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data as PlatformSeoPage | null;
        },
        enabled: !!path,
    });
}

/**
 * Upsert platform SEO page
 */
export function useUpsertPlatformSeoPage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (page: Partial<PlatformSeoPage> & { path: string }) => {
            const { data: existing } = await supabase
                .from('platform_seo_pages')
                .select('id')
                .eq('path', page.path)
                .is('locale', page.locale ?? null)
                .single();

            if (existing) {
                const { data, error } = await supabase
                    .from('platform_seo_pages')
                    .update({ ...page, lastmod: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from('platform_seo_pages')
                    .insert({
                        ...page,
                        tenant_id: MASTER_TENANT_ID,
                        lastmod: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-seo-pages'] });
            queryClient.invalidateQueries({ queryKey: ['platform-seo-page'] });
        },
    });
}

/**
 * Delete platform SEO page
 */
export function useDeletePlatformSeoPage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('platform_seo_pages')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-seo-pages'] });
        },
    });
}

/**
 * Fetch PageSpeed snapshots
 */
export function usePlatformPagespeedSnapshots(url?: string) {
    return useQuery({
        queryKey: ['platform-seo-pagespeed', url],
        queryFn: async () => {
            let query = supabase
                .from('platform_seo_pagespeed_snapshots')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (url) {
                query = query.eq('url', url);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as PlatformSeoPagespeedSnapshot[];
        },
    });
}

/**
 * Save PageSpeed snapshot
 */
export function useSavePagespeedSnapshot() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (snapshot: Omit<PlatformSeoPagespeedSnapshot, 'id' | 'tenant_id' | 'created_at'>) => {
            const { data, error } = await supabase
                .from('platform_seo_pagespeed_snapshots')
                .insert({ ...snapshot, tenant_id: MASTER_TENANT_ID })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-seo-pagespeed'] });
        },
    });
}
