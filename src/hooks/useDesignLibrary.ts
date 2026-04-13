import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    getTemplateCategoryLabel,
    isAttributeTemplateType,
    MASTER_TENANT_ID,
    normalizeTemplateTags,
} from "@/lib/designer/templateLibrary";

export type DesignLibraryItem = {
    id: string;
    name: string;
    description: string | null;
    kind: 'fabric_json' | 'svg' | 'pdf' | 'image' | 'template';
    preview_path?: string | null;
    preview_thumbnail_url?: string | null;
    storage_path: string | null;
    fabric_json: any;
    tags: string[];
    product_id: string | null;
    visibility: 'tenant' | 'public';
    created_at: string;
    // Template-specific fields
    width_mm?: number;
    height_mm?: number;
    bleed_mm?: number;
    icon_name?: string;
    template_type?: string;
    tenant_id?: string | null;
    safe_area_mm?: number;
    dpi_default?: number;
    color_profile?: string | null;
    template_pdf_url?: string | null;
    editor_json?: any;
    library_kind?: string | null;
    source_kind?: string | null;
    external_launch_url?: string | null;
    tags?: string[];
    category_label?: string;
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
                    .select('*')
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
                    preview_thumbnail_url: d.preview_thumbnail_url,
                    fabric_json: d.editor_json,
                    tags: [],
                    created_at: d.updated_at
                }));
            }

            // Templates from designer_templates table
            if (options.tab === 'skabeloner') {
                const { data, error } = await supabase
                    .from('designer_templates' as any)
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })
                    .order('category', { ascending: true })
                    .order('name', { ascending: true });
                if (error) throw error;

                // Map designer_templates to DesignLibraryItem format
                const filtered = (data || []).filter((t: any) => {
                    if (isAttributeTemplateType(t.template_type)) return false;

                    const isTenantTemplate = t.tenant_id === tenantId;
                    const isSharedMasterTemplate = t.tenant_id === MASTER_TENANT_ID && t.is_public;
                    if (!isTenantTemplate && !isSharedMasterTemplate) return false;

                    if (!options.search) return true;

                    const haystack = [
                        t.name,
                        t.description,
                        t.category,
                        ...(Array.isArray(t.tags) ? t.tags : []),
                        getTemplateCategoryLabel(t.category),
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return haystack.includes(options.search.toLowerCase());
                });

                return filtered.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    kind: 'template' as const,
                    preview_path: t.preview_image_url,
                    preview_thumbnail_url: t.preview_image_url,
                    storage_path: t.template_pdf_url,
                    fabric_json: null,
                    tags: normalizeTemplateTags(t.tags),
                    product_id: null,
                    visibility: t.is_public ? 'public' : 'tenant',
                    created_at: t.created_at || new Date().toISOString(),
                    // Extra template-specific fields
                    width_mm: t.width_mm,
                    height_mm: t.height_mm,
                    bleed_mm: t.bleed_mm,
                    safe_area_mm: t.safe_area_mm,
                    dpi_default: t.dpi_default,
                    color_profile: t.color_profile,
                    icon_name: t.icon_name,
                    template_type: t.template_type,
                    tenant_id: t.tenant_id,
                    template_pdf_url: t.template_pdf_url,
                    editor_json: t.editor_json,
                    library_kind: t.library_kind,
                    source_kind: t.source_kind,
                    external_launch_url: t.external_launch_url,
                    category_label: getTemplateCategoryLabel(t.category),
                })) as any[];
            }

            // Ressourcer from design_library_items (public resources)
            let query = supabase
                .from('design_library_items' as any)
                .select('*')
                .eq('visibility', 'public');

            if (options.search) {
                query = query.ilike('name', `%${options.search}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as unknown as DesignLibraryItem[];
        },
        staleTime: 0, // Always fetch fresh to ensure thumb/save visibility
    });
}
