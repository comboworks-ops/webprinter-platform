import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DesignLibraryItem = {
    id: string;
    name: string;
    description: string | null;
    kind: 'fabric_json' | 'svg' | 'pdf' | 'image';
    preview_path: string | null;
    storage_path: string | null;
    fabric_json: any;
    tags: string[];
    product_id: string | null;
    visibility: 'tenant' | 'public';
    created_at: string;
};

export function useDesignLibrary(options: {
    search?: string;
    productId?: string | null;
    tab: 'skabeloner' | 'mine' | 'ressourcer'
}) {
    return useQuery({
        queryKey: ['design-library', options],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data: userRole } = await supabase
                .from('user_roles')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            // Fallback: If no direct tenant on user_roles, try to find a tenant owned by this user
            let tenantId = (userRole as any)?.tenant_id;

            if (!tenantId) {
                const { data: tenant } = await supabase
                    .from('tenants' as any)
                    .select('id')
                    .eq('owner_id', user.id)
                    .maybeSingle();
                tenantId = (tenant as any)?.id;
            }

            tenantId = tenantId || '00000000-0000-0000-0000-000000000000';

            if (options.tab === 'mine') {
                let query = supabase
                    .from('designer_saved_designs' as any)
                    .select('id, name, preview_path, updated_at, editor_json')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false });

                if (options.search) {
                    query = query.ilike('name', `%${options.search}%`);
                }

                const { data, error } = await query;
                if (error) throw error;

                return (data || []).map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    kind: 'fabric_json' as const,
                    preview_path: d.preview_path,
                    fabric_json: d.editor_json,
                    tags: [],
                    created_at: d.updated_at
                }));
            }

            // Templates and Resources from design_library_items
            let query = supabase
                .from('design_library_items' as any)
                .select('*');

            if (options.tab === 'skabeloner') {
                // Shared templates (public from master) OR tenant templates
                query = query.or(`tenant_id.eq.${tenantId},and(visibility.eq.public,tenant_id.eq.00000000-0000-0000-0000-000000000000)`);
            } else {
                // Ressourcer - strictly public items
                query = query.eq('visibility', 'public');
            }

            if (options.search) {
                query = query.ilike('name', `%${options.search}%`);
            }

            if (options.productId && options.tab === 'skabeloner') {
                // For templates, prioritize matching product_id or null
                query = query.or(`product_id.eq.${options.productId},product_id.is.null`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as unknown as DesignLibraryItem[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
