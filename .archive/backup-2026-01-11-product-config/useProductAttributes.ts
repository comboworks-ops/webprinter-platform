import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LibraryGroup, LibraryValue } from './useAttributeLibrary';

export interface ProductAttributeGroup {
    id: string;
    tenant_id: string;
    product_id: string;
    library_group_id: string | null;
    name: string;
    kind: 'format' | 'material' | 'finish' | 'other' | 'custom';
    ui_mode: 'buttons' | 'dropdown';
    source: 'library' | 'product';
    sort_order: number;
    enabled: boolean;
    values?: ProductAttributeValue[];
}

export interface ProductAttributeValue {
    id: string;
    product_id: string;
    group_id: string;
    name: string;
    key: string | null;
    sort_order: number;
    enabled: boolean;
    width_mm: number | null;
    height_mm: number | null;
    meta: any;
}

export function useProductAttributes(productId: string | undefined, tenantId: string | undefined) {
    const [groups, setGroups] = useState<ProductAttributeGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGroups = useCallback(async () => {
        if (!productId || !tenantId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('product_attribute_groups' as any)
                .select('*, values:product_attribute_values(*)')
                .eq('product_id', productId)
                .order('sort_order');

            if (error) throw error;
            setGroups((data as unknown as ProductAttributeGroup[]) || []);
        } catch (error) {
            console.error('Error fetching product attributes:', error);
        } finally {
            setLoading(false);
        }
    }, [productId, tenantId]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    // Snapshot a library group to product (COPY, not reference)
    const addFromLibrary = async (libraryGroup: LibraryGroup) => {
        if (!productId || !tenantId) return;

        try {
            // 1. Create product group (snapshot)
            const { data: newGroup, error: groupError } = await supabase
                .from('product_attribute_groups' as any)
                .insert({
                    tenant_id: tenantId,
                    product_id: productId,
                    library_group_id: libraryGroup.id,
                    name: libraryGroup.name,
                    kind: libraryGroup.kind,
                    ui_mode: libraryGroup.default_ui_mode,
                    source: 'library',
                    sort_order: groups.length,
                    enabled: true
                })
                .select()
                .single();

            if (groupError) throw groupError;
            const createdGroup = newGroup as unknown as ProductAttributeGroup;

            // 2. Snapshot values
            if (libraryGroup.values && libraryGroup.values.length > 0) {
                const valueInserts = libraryGroup.values.map(v => ({
                    tenant_id: tenantId,
                    product_id: productId,
                    group_id: createdGroup.id,
                    name: v.name,
                    key: v.key,
                    sort_order: v.sort_order,
                    enabled: v.enabled,
                    width_mm: v.width_mm,
                    height_mm: v.height_mm,
                    meta: v.meta
                }));

                const { error: valuesError } = await supabase
                    .from('product_attribute_values' as any)
                    .insert(valueInserts);

                if (valuesError) throw valuesError;
            }

            toast.success(`"${libraryGroup.name}" tilføjet til produkt`);
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke tilføje gruppe');
        }
    };

    // Create a new product-specific group
    const createGroup = async (data: Omit<ProductAttributeGroup, 'id' | 'tenant_id' | 'product_id' | 'values'>) => {
        if (!productId || !tenantId) return null;

        try {
            const { data: newGroup, error } = await supabase
                .from('product_attribute_groups' as any)
                .insert({
                    tenant_id: tenantId,
                    product_id: productId,
                    name: data.name,
                    kind: data.kind,
                    ui_mode: data.ui_mode,
                    source: 'product',
                    sort_order: data.sort_order,
                    enabled: data.enabled
                })
                .select()
                .single();

            if (error) throw error;
            toast.success('Gruppe oprettet');
            await fetchGroups();
            return newGroup as unknown as ProductAttributeGroup;
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke oprette gruppe');
            return null;
        }
    };

    const updateGroup = async (id: string, data: Partial<ProductAttributeGroup>) => {
        try {
            const { error } = await supabase
                .from('product_attribute_groups' as any)
                .update({
                    name: data.name,
                    kind: data.kind,
                    ui_mode: data.ui_mode,
                    sort_order: data.sort_order,
                    enabled: data.enabled,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke opdatere gruppe');
        }
    };

    const deleteGroup = async (id: string) => {
        try {
            // Values cascade delete via FK
            const { error } = await supabase
                .from('product_attribute_groups' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Gruppe fjernet');
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke fjerne gruppe');
        }
    };

    const moveGroupUp = async (id: string) => {
        const index = groups.findIndex(g => g.id === id);
        if (index <= 0) return; // Already at top

        try {
            const currentGroup = groups[index];
            const prevGroup = groups[index - 1];

            // Swap sort_order values
            await Promise.all([
                supabase
                    .from('product_attribute_groups' as any)
                    .update({ sort_order: prevGroup.sort_order, updated_at: new Date().toISOString() })
                    .eq('id', currentGroup.id),
                supabase
                    .from('product_attribute_groups' as any)
                    .update({ sort_order: currentGroup.sort_order, updated_at: new Date().toISOString() })
                    .eq('id', prevGroup.id)
            ]);

            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke flytte gruppe');
        }
    };

    const moveGroupDown = async (id: string) => {
        const index = groups.findIndex(g => g.id === id);
        if (index < 0 || index >= groups.length - 1) return; // Already at bottom

        try {
            const currentGroup = groups[index];
            const nextGroup = groups[index + 1];

            // Swap sort_order values
            await Promise.all([
                supabase
                    .from('product_attribute_groups' as any)
                    .update({ sort_order: nextGroup.sort_order, updated_at: new Date().toISOString() })
                    .eq('id', currentGroup.id),
                supabase
                    .from('product_attribute_groups' as any)
                    .update({ sort_order: currentGroup.sort_order, updated_at: new Date().toISOString() })
                    .eq('id', nextGroup.id)
            ]);

            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke flytte gruppe');
        }
    };

    const duplicateGroup = async (id: string) => {
        if (!productId || !tenantId) return;

        const groupToDuplicate = groups.find(g => g.id === id);
        if (!groupToDuplicate) return;

        try {
            // 1. Create new group with copied data
            const { data: newGroup, error: groupError } = await supabase
                .from('product_attribute_groups' as any)
                .insert({
                    tenant_id: tenantId,
                    product_id: productId,
                    library_group_id: groupToDuplicate.library_group_id,
                    name: `${groupToDuplicate.name} (kopi)`,
                    kind: groupToDuplicate.kind,
                    ui_mode: groupToDuplicate.ui_mode,
                    source: groupToDuplicate.source,
                    sort_order: groups.length,
                    enabled: groupToDuplicate.enabled
                })
                .select()
                .single();

            if (groupError) throw groupError;
            const createdGroup = newGroup as unknown as ProductAttributeGroup;

            // 2. Copy values if any
            if (groupToDuplicate.values && groupToDuplicate.values.length > 0) {
                const valueInserts = groupToDuplicate.values.map(v => ({
                    tenant_id: tenantId,
                    product_id: productId,
                    group_id: createdGroup.id,
                    name: v.name,
                    key: v.key,
                    sort_order: v.sort_order,
                    enabled: v.enabled,
                    width_mm: v.width_mm,
                    height_mm: v.height_mm,
                    meta: v.meta
                }));

                const { error: valuesError } = await supabase
                    .from('product_attribute_values' as any)
                    .insert(valueInserts);

                if (valuesError) throw valuesError;
            }

            toast.success(`"${groupToDuplicate.name}" duplikeret`);
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke duplikere gruppe');
        }
    };

    const reorderGroups = async (newOrderIds: string[]) => {
        try {
            // Update sort_order for all groups based on new order
            const updates = newOrderIds.map((id, index) =>
                supabase
                    .from('product_attribute_groups' as any)
                    .update({ sort_order: index, updated_at: new Date().toISOString() })
                    .eq('id', id)
            );

            await Promise.all(updates);
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke ændre rækkefølge');
        }
    };

    const addValue = async (groupId: string, data: Omit<ProductAttributeValue, 'id' | 'product_id' | 'group_id'>) => {
        if (!productId || !tenantId) return;

        try {
            const { error } = await supabase
                .from('product_attribute_values' as any)
                .insert({
                    tenant_id: tenantId,
                    product_id: productId,
                    group_id: groupId,
                    name: data.name,
                    key: data.key,
                    sort_order: data.sort_order,
                    enabled: data.enabled,
                    width_mm: data.width_mm,
                    height_mm: data.height_mm,
                    meta: data.meta
                });

            if (error) throw error;
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke tilføje værdi');
        }
    };

    const updateValue = async (id: string, data: Partial<ProductAttributeValue>) => {
        try {
            const { error } = await supabase
                .from('product_attribute_values' as any)
                .update({
                    ...data,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke opdatere værdi');
        }
    };

    const deleteValue = async (id: string) => {
        try {
            const { error } = await supabase
                .from('product_attribute_values' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke slette værdi');
        }
    };

    return {
        groups,
        loading,
        refresh: fetchGroups,
        addFromLibrary,
        createGroup,
        updateGroup,
        deleteGroup,
        moveGroupUp,
        moveGroupDown,
        duplicateGroup,
        reorderGroups,
        addValue,
        updateValue,
        deleteValue
    };
}
