import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { SelectorValueGroupConfig } from './selectorValueGroups';

/** Save group presentation only; never republish rates or replace the source quote model. */
export async function persistStorformatValueGroups(
    client: Pick<SupabaseClient<Database>, 'from'>,
    tenantId: string,
    productId: string,
    sectionId: string,
    groups: SelectorValueGroupConfig[],
): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await client.from('storformat_configs').select('id, layout_rows')
            .eq('tenant_id', tenantId).eq('product_id', productId).single();
        if (error || !data) throw error || new Error('Storformat-konfiguration blev ikke fundet i denne shop');
        const rows = Array.isArray(data.layout_rows) ? structuredClone(data.layout_rows) : [];
        let found = false;
        for (const row of rows) {
            if (!row || typeof row !== 'object' || Array.isArray(row) || !Array.isArray(row.sections)) continue;
            for (const section of row.sections) {
                if (!section || typeof section !== 'object' || Array.isArray(section) || section.id !== sectionId) continue;
                const ids = new Set(Array.isArray(section.valueIds) ? section.valueIds : []);
                const claimed = new Set<string>();
                for (const group of groups) for (const id of group.valueIds) {
                    if (!ids.has(id) || claimed.has(id)) throw new Error('Et valg er fjernet eller findes i flere grupper');
                    claimed.add(id);
                }
                section.valueGroups = JSON.parse(JSON.stringify(groups)) as Json;
                delete section.value_groups;
                found = true;
            }
        }
        if (!found) throw new Error('Valgsektionen findes ikke længere');
        // Compare the exact layout read above; rebase if another visual editor saved meanwhile.
        const { data: saved, error: saveError } = await client.from('storformat_configs')
            .update({ layout_rows: rows }).eq('id', data.id).eq('tenant_id', tenantId).eq('product_id', productId)
            .eq('layout_rows', JSON.stringify(data.layout_rows)).select('id').maybeSingle();
        if (saveError) throw saveError;
        if (saved?.id === data.id) return;
    }
    throw new Error('Grupperne blev ikke gemt. Genindlæs og prøv igen.');
}
