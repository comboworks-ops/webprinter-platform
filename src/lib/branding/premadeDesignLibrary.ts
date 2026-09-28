import { supabase } from '@/integrations/supabase/client';

/** Visible templates plus private templates explicitly assigned to this shop.
 * RLS remains authoritative; never fetch another shop's assignments. */
export async function loadShopDesignLibrary(tenantId: string) {
    if (!tenantId) throw new Error('Vælg en shop for at hente designskabeloner.');
    const [visible, assignments] = await Promise.all([
        supabase.from('premade_designs' as never).select('*').eq('is_visible', true).order('created_at', { ascending: false }),
        supabase.from('tenant_premade_designs' as never).select('design_id').eq('tenant_id', tenantId),
    ]);
    if (visible.error) throw visible.error;
    if (assignments.error) throw assignments.error;
    const ids = [...new Set((assignments.data || []).map(row => (row as { design_id: string }).design_id))];
    const assigned = ids.length
        ? await supabase.from('premade_designs' as never).select('*').in('id', ids)
        : { data: [], error: null };
    if (assigned.error) throw assigned.error;
    const designs = [...(visible.data || []), ...(assigned.data || [])] as Array<{ id: string } & Record<string, unknown>>;
    return [...new Map(designs.map(design => [design.id, { ...design, assignedToShop: ids.includes(design.id) }])).values()];
}

export async function assignDesignToShop(tenantId: string, designId: string) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user || !tenantId || !designId) throw new Error('Shop og design skal vælges af en bruger med masteradgang.');
    const { data, error } = await supabase.from('tenant_premade_designs' as never)
        .upsert({ tenant_id: tenantId, design_id: designId, granted_by: user.id } as never, { onConflict: 'tenant_id,design_id' })
        .select('tenant_id, design_id').single();
    if (error) throw error;
    const row = data as { tenant_id: string; design_id: string } | null;
    if (row?.tenant_id !== tenantId || row?.design_id !== designId) throw new Error('Tildelingen blev ikke bekræftet. Prøv igen.');
}
