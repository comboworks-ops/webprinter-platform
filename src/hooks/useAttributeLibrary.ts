import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LibraryGroup {
    id: string;
    tenant_id: string;
    name: string;
    kind: 'format' | 'material' | 'finish' | 'other' | 'custom';
    default_ui_mode: 'buttons' | 'dropdown' | 'checkboxes';
    sort_order: number;
    values?: LibraryValue[];
}

export interface LibraryValue {
    id: string;
    group_id: string;
    name: string;
    key: string | null;
    sort_order: number;
    enabled: boolean;
    width_mm: number | null;
    height_mm: number | null;
    meta: any;
}

export function useAttributeLibrary(tenantId: string | undefined) {
    const [groups, setGroups] = useState<LibraryGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGroups = useCallback(async () => {
        if (!tenantId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('attribute_library_groups' as any)
                .select('*, values:attribute_library_values(*)')
                .eq('tenant_id', tenantId)
                .order('sort_order');

            if (error) throw error;
            setGroups((data as unknown as LibraryGroup[]) || []);
        } catch (error) {
            console.error('Error fetching library groups:', error);
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    const createGroup = async (data: Omit<LibraryGroup, 'id' | 'tenant_id' | 'values'>) => {
        if (!tenantId) return null;

        try {
            const { data: newGroup, error } = await supabase
                .from('attribute_library_groups' as any)
                .insert({
                    tenant_id: tenantId,
                    name: data.name,
                    kind: data.kind,
                    default_ui_mode: data.default_ui_mode,
                    sort_order: data.sort_order
                })
                .select()
                .single();

            if (error) throw error;
            toast.success('Gruppe oprettet i bibliotek');
            await fetchGroups();
            return newGroup as unknown as LibraryGroup;
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke oprette gruppe');
            return null;
        }
    };

    const updateGroup = async (id: string, data: Partial<LibraryGroup>) => {
        try {
            const { error } = await supabase
                .from('attribute_library_groups' as any)
                .update({
                    name: data.name,
                    kind: data.kind,
                    default_ui_mode: data.default_ui_mode,
                    sort_order: data.sort_order,
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
            const { error } = await supabase
                .from('attribute_library_groups' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Gruppe slettet');
            await fetchGroups();
        } catch (error: any) {
            toast.error(error.message || 'Kunne ikke slette gruppe');
        }
    };

    const addValue = async (groupId: string, data: Omit<LibraryValue, 'id' | 'group_id'>) => {
        if (!tenantId) return;

        try {
            const { error } = await supabase
                .from('attribute_library_values' as any)
                .insert({
                    tenant_id: tenantId,
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

    const updateValue = async (id: string, data: Partial<LibraryValue>) => {
        try {
            const { error } = await supabase
                .from('attribute_library_values' as any)
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
                .from('attribute_library_values' as any)
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
        createGroup,
        updateGroup,
        deleteGroup,
        addValue,
        updateValue,
        deleteValue
    };
}
