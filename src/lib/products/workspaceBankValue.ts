import { patchWorkspaceSection, sectionId, workspaceGroups, workspaceSections, type WorkspaceStructure } from './productWorkspace.ts';

export type BankValueType = 'format' | 'material' | 'finish' | 'product';
export const bankSectionTypes = { format: 'formats', material: 'materials', finish: 'finishes', product: 'products' } as const;

/** Only the draft's references change. Existing source values, prices and supplier
 * mappings stay intact; a replacement must obtain its own matching prices. */
export function attachWorkspaceBankValue(structure: WorkspaceStructure, input: {
  groupId: string; sourceId: string; sourceGroupId: string; valueId: string;
  type: BankValueType; replaceValueId?: string;
}): WorkspaceStructure {
  const groups = structuredClone(workspaceGroups(structure));
  const group = groups.find(item => item.id === input.groupId);
  if (!group) throw new Error('Sektionen findes ikke længere.');
  const source = workspaceSections(structure).find(item => sectionId(item) === input.sourceId);
  if (source && source.sectionType !== bankSectionTypes[input.type]) throw new Error('Vælg samme type som sektionen.');
  if (source?.groupId && source.groupId !== input.sourceGroupId) throw new Error('Valget skal tilhøre sektionens prisgruppe.');
  const existing = group.options.some(option => option.sectionId === input.sourceId && option.valueId === input.valueId);
  if (existing) throw new Error('Valget er allerede i sektionen.');
  const oldIndex = group.options.findIndex(option => option.sectionId === input.sourceId && option.valueId === input.replaceValueId);
  if (input.replaceValueId && oldIndex < 0) throw new Error('Valget er ændret. Vælg det igen.');
  const option = { sectionId: input.sourceId, valueId: input.valueId };
  if (oldIndex >= 0) group.options.splice(oldIndex, 1, option);
  else group.options.push(option);
  const replacedStillUsed = input.replaceValueId && groups.some(item => item.options.some(option => option.sectionId === input.sourceId && option.valueId === input.replaceValueId));
  const valueIds = [...(source?.valueIds || [])] as string[];
  const index = valueIds.indexOf(input.replaceValueId || '');
  if (index >= 0 && !replacedStillUsed) valueIds.splice(index, 1, input.valueId);
  else valueIds.push(input.valueId);
  const patch = { groupId: input.sourceGroupId, valueIds: [...new Set(valueIds)] };
  let next: WorkspaceStructure;
  if (source) next = patchWorkspaceSection(structure, input.sourceId, patch);
  else {
    next = { ...structure, layout_rows: [...(structure.layout_rows || []), { id: `row-${input.sourceId}`, columns: [{
      id: input.sourceId, title: group.title, sectionType: bankSectionTypes[input.type], ...patch,
      ui_mode: group.uiMode || 'buttons', selection_mode: ['finish', 'product'].includes(input.type) ? 'optional' : 'required',
    }] }] };
  }
  return { ...next, workspaceGroups: groups, customerSelectionOrder: [...new Set(groups.flatMap(item => item.options.map(option => option.sectionId)))] };
}
