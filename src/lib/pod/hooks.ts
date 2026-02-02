// POD System Hooks

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
    PodSupplierConnection,
    PodApiPreset,
    PodCatalogProduct,
    PodExplorerRequest,
    PodExplorerResponse,
    PodFulfillmentJob,
    PodTenantBilling,
} from './types';

const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

// ============================================================
// Master Admin Hooks
// ============================================================

export function usePodConnections() {
    return useQuery({
        queryKey: ['pod-connections'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pod_supplier_connections' as any)
                .select('id, provider_key, base_url, auth_header_mode, auth_header_name, auth_header_prefix, is_active, created_at, updated_at')
                .eq('tenant_id', MASTER_TENANT_ID)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as unknown as PodSupplierConnection[];
        },
    });
}

export function usePodApiPresets() {
    return useQuery({
        queryKey: ['pod-presets'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pod_api_presets' as any)
                .select('*')
                .eq('tenant_id', MASTER_TENANT_ID)
                .order('name');

            if (error) throw error;
            return data as unknown as PodApiPreset[];
        },
    });
}

export function usePodExplorer() {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<PodExplorerResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (request: PodExplorerRequest) => {
        setLoading(true);
        setError(null);
        setResponse(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('pod-explorer-request', {
                body: request,
            });

            if (fnError) throw fnError;
            setResponse(data as PodExplorerResponse);
            return data;
        } catch (err: any) {
            setError(err.message || 'Request failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { execute, loading, response, error };
}

export function usePodCatalogProducts() {
    return useQuery({
        queryKey: ['pod-catalog'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pod_catalog_products' as any)
                .select(`
          *,
          pod_catalog_attributes (
            *,
            pod_catalog_attribute_values (*)
          ),
          pod_catalog_price_matrix (*)
        `)
                .eq('tenant_id', MASTER_TENANT_ID)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as unknown as PodCatalogProduct[];
        },
    });
}

export function useSavePodConnection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (connection: Partial<PodSupplierConnection> & { api_key?: string }) => {
            const { api_key, id, ...rest } = connection;

            const payload: any = {
                ...rest,
                tenant_id: MASTER_TENANT_ID,
            };

            if (api_key) {
                payload.api_key_encrypted = api_key; // In production, encrypt on server
            }

            const shouldActivate = connection.is_active === true || !id;
            if (shouldActivate) {
                const { error: deactivateError } = await supabase
                    .from('pod_supplier_connections' as any)
                    .update({ is_active: false })
                    .eq('tenant_id', MASTER_TENANT_ID)
                    .neq('id', id || '');
                if (deactivateError) throw deactivateError;
                payload.is_active = true;
            }

            if (id) {
                const { error } = await supabase
                    .from('pod_supplier_connections' as any)
                    .update(payload)
                    .eq('id', id);
                if (error) throw error;
            } else {
                if (!api_key) throw new Error('API key required for new connection');
                const { error } = await supabase
                    .from('pod_supplier_connections' as any)
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-connections'] });
            toast.success('Forbindelse gemt');
        },
        onError: (err: any) => {
            toast.error('Fejl: ' + err.message);
        },
    });
}

export function useDeletePodConnection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('pod_supplier_connections' as any)
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-connections'] });
            toast.success('Forbindelse slettet');
        },
        onError: (err: any) => {
            toast.error('Fejl: ' + err.message);
        },
    });
}

export function useSavePodPreset() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (preset: Partial<PodApiPreset>) => {
            const payload = {
                ...preset,
                tenant_id: MASTER_TENANT_ID,
            };

            if (preset.id) {
                const { error } = await supabase
                    .from('pod_api_presets' as any)
                    .update(payload)
                    .eq('id', preset.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('pod_api_presets' as any)
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-presets'] });
            toast.success('Preset gemt');
        },
        onError: (err: any) => {
            toast.error('Fejl: ' + err.message);
        },
    });
}

export function useDeletePodPreset() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('pod_api_presets' as any)
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-presets'] });
            toast.success('Preset slettet');
        },
    });
}

// ============================================================
// Tenant Admin Hooks
// ============================================================

export function usePodPublishedCatalog() {
    return useQuery({
        queryKey: ['pod-catalog-public'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pod_catalog_public' as any)
                .select('*');

            if (error) throw error;
            return data as unknown as PodCatalogProduct[];
        },
    });
}

export function usePodTenantImports(tenantId?: string) {
    return useQuery({
        queryKey: ['pod-imports', tenantId],
        queryFn: async () => {
            let query = supabase
                .from('pod_tenant_imports' as any)
                .select('*');

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!tenantId,
    });
}

export function usePodImportProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { catalogProductId: string; customName?: string; customCategory?: string; tenantId?: string }) => {
            const { data, error } = await supabase.functions.invoke('pod-tenant-import', {
                body: params,
            });

            if (error) {
                let message = error.message || 'Import failed';
                const context = (error as any).context;
                if (context) {
                    try {
                        const body = await context.json();
                        const details = body?.details ? ` (details: ${JSON.stringify(body.details)})` : "";
                        message = (body?.error || body?.message || message) + details;
                    } catch (e) {
                        // Keep fallback message
                    }
                }
                throw new Error(message);
            }
            if (data.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-imports'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('POD produkt importeret');
        },
        onError: (err: any) => {
            toast.error('Import fejlede: ' + err.message);
        },
    });
}

export function usePodMergeProducts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { targetProductId: string; sourceProductIds: string[] }) => {
            const { data, error } = await supabase.functions.invoke('pod-tenant-merge', {
                body: params,
            });

            if (error) {
                let message = error.message || 'Merge failed';
                const context = (error as any).context;
                if (context) {
                    try {
                        const body = await context.json();
                        const details = body?.details ? ` (details: ${JSON.stringify(body.details)})` : "";
                        message = (body?.error || body?.message || message) + details;
                    } catch {
                        // Keep fallback message
                    }
                }
                throw new Error(message);
            }
            if (data?.error) throw new Error(data.error);
            return data;
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['pod-imports'] });
            const processed = data?.pricesProcessed ?? 0;
            toast.success(`Sammenfletning fuldført (${processed} priser).`);
        },
        onError: (err: any) => {
            toast.error('Sammenfletning fejlede: ' + err.message);
        },
    });
}

export function usePodRemoveImport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { importId: string }) => {
            const { data, error } = await supabase.functions.invoke('pod-tenant-remove', {
                body: params,
            });

            if (error) {
                let message = error.message || 'Delete failed';
                const context = (error as any).context;
                if (context) {
                    try {
                        const body = await context.json();
                        message = body?.error || body?.message || message;
                    } catch (e) {
                        // Keep fallback message
                    }
                }
                throw new Error(message);
            }
            if (data?.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-imports'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('POD import slettet');
        },
        onError: (err: any) => {
            toast.error('Sletning fejlede: ' + err.message);
        },
    });
}

export function usePodTenantBilling(tenantId?: string) {
    return useQuery({
        queryKey: ['pod-billing', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pod_tenant_billing' as any)
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data as unknown as PodTenantBilling | null;
        },
        enabled: !!tenantId,
    });
}

export function usePodFulfillmentJobs(tenantId?: string) {
    return useQuery({
        queryKey: ['pod-jobs', tenantId],
        queryFn: async () => {
            let query = supabase
                .from('pod_fulfillment_jobs' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as unknown as PodFulfillmentJob[];
        },
        enabled: !!tenantId,
    });
}

export function usePodApproveAndCharge() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (jobId: string) => {
            const { data, error } = await supabase.functions.invoke('pod-tenant-approve-charge', {
                body: { jobId },
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Approval failed');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pod-jobs'] });
            toast.success('Job godkendt og betalt');
        },
        onError: (err: any) => {
            toast.error('Godkendelse fejlede: ' + err.message);
        },
    });
}

export function usePodCreateJobsForOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: string) => {
            const { data, error } = await supabase.functions.invoke('pod-create-jobs', {
                body: { orderId },
            });

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['pod-jobs'] });
            toast.success(`${data.jobsCreated} POD job(s) oprettet`);
        },
        onError: (err: any) => {
            toast.error('Oprettelse fejlede: ' + err.message);
        },
    });
}
