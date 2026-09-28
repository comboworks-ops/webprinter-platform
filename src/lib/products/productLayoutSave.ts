import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { sectionId, workspaceGroups, workspaceSections, type WorkspaceStructure } from './productWorkspace.ts';

/** Layout changes never own prices, quantities, supplier metadata or markups. */
export function prepareProductLayoutSave(current: WorkspaceStructure | null, expected: WorkspaceStructure | null, candidate: WorkspaceStructure): WorkspaceStructure {
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('Produktet er ændret. Genindlæs, før du gemmer opsætningen.');
  if (current?.workspaceDraft) throw new Error('Produktsiden har en gemt kladde. Anvend den først, før du ændrer produktets grundopsætning.');
  const existing = workspaceSections(current || {});
  const nextSections = workspaceSections(candidate);
  // Retain identities used by every existing imported or manually entered price.
  if (current?.mode === 'matrix_layout_v1') {
    if (sectionId(current.vertical_axis) !== sectionId(candidate.vertical_axis)) throw new Error('Matrixrækkens prisidentitet skal bevares.');
    for (const section of existing) {
      const next = nextSections.find(item => sectionId(item) === sectionId(section));
      if (!next || next.groupId !== section.groupId || next.sectionType !== section.sectionType || (section.valueIds || []).some((id: string) => !next.valueIds?.includes(id))) {
        throw new Error('Eksisterende prisvalg skal bevares. Skjul dem i Produktside i stedet for at fjerne deres prisgrundlag.');
      }
    }
  }
  const mergeSection = (section: WorkspaceStructure) => ({ ...existing.find(item => sectionId(item) === sectionId(section)), ...section });
  const result: WorkspaceStructure = {
    ...(current || {}), mode: 'matrix_layout_v1', version: 1,
    vertical_axis: mergeSection(candidate.vertical_axis),
    layout_rows: candidate.layout_rows.map((row: WorkspaceStructure) => ({ ...row, columns: row.columns.map(mergeSection) })),
  };
  if (current?.workspaceGroups) {
    const groups = structuredClone(workspaceGroups(current));
    for (const section of workspaceSections(result)) {
      const id = sectionId(section);
      const missing = (section.valueIds || []).filter((valueId: string) => !groups.some(group => group.options.some(option => option.sectionId === id && option.valueId === valueId)));
      let group = groups.find(item => item.id === id);
      if (!group && missing.length) { group = { id, title: section.title || section.labelOverride || 'Valg', options: [] }; groups.push(group); }
      if (group) {
        group.options.push(...missing.map((valueId: string) => ({ sectionId: id, valueId })));
        const previousRow = current.layout_rows?.find((row: WorkspaceStructure) => row.columns.some((col: WorkspaceStructure) => sectionId(col) === id))?.id;
        const nextRow = result.layout_rows.find((row: WorkspaceStructure) => row.columns.some((col: WorkspaceStructure) => sectionId(col) === id))?.id;
        if (previousRow !== nextRow) group.rowId = nextRow;
      }
    }
    result.workspaceGroups = groups;
  }
  return result;
}

/** Uses the caller's authenticated client and compares the tenant-scoped version. */
export async function saveProductLayout(client: Pick<SupabaseClient<Database>, 'from'>, tenantId: string, productId: string, expected: WorkspaceStructure | null, candidate: WorkspaceStructure): Promise<WorkspaceStructure> {
  const { data: current, error: readError } = await client.from('products').select('pricing_structure, updated_at')
    .eq('id', productId).eq('tenant_id', tenantId).single();
  if (readError || !current) throw readError || new Error('Produktet findes ikke i denne shop.');
  const structure = prepareProductLayoutSave(current.pricing_structure as WorkspaceStructure | null, expected, candidate);
  const { data, error } = await client.from('products').update({ pricing_structure: structure })
    .eq('id', productId).eq('tenant_id', tenantId).eq('updated_at', current.updated_at).select('id').maybeSingle();
  if (error) throw error;
  if (data?.id !== productId) throw new Error('Produktet blev ændret samtidig. Genindlæs før du gemmer.');
  return structure;
}
