import { patchWorkspaceSection, placeWorkspaceGroup, sectionId, workspaceGroups, workspaceRows, workspaceSections, type WorkspaceGroup, type WorkspaceStructure } from './productWorkspace.ts';

export const WORKSPACE_EDITOR_STATE = 'PRODUCT_WORKSPACE_EDITOR_STATE';
export const WORKSPACE_EDITOR_ACTION = 'PRODUCT_WORKSPACE_EDITOR_ACTION';
export type WorkspaceEditAction = {
  groupId: string;
  action: 'select' | 'add' | 'before' | 'after' | 'up' | 'down' | 'swap' | 'beside' | 'detach' | 'option-before';
  targetId?: string;
  valueId?: string;
  sectionId?: string;
};

/** Moves change visual positions, never source membership or price identities. */
export function editWorkspacePlacement(structure: WorkspaceStructure, action: WorkspaceEditAction): WorkspaceStructure {
  const groups = structuredClone(workspaceRows(workspaceGroups(structure)).flat());
  const group = groups.find(item => item.id === action.groupId);
  if (!group) return structure;
  if (action.action === 'option-before') {
    const from = group.options.findIndex(option => option.valueId === action.valueId && option.sectionId === action.sectionId);
    const to = group.options.findIndex(option => `${option.sectionId}:${option.valueId}` === action.targetId);
    if (from < 0 || to < 0 || from === to) return structure;
    group.options.splice(to, 0, group.options.splice(from, 1)[0]);
    const source = workspaceSections(structure).find(section => sectionId(section) === action.sectionId);
    const ordered = group.options.filter(option => option.sectionId === action.sectionId).map(option => option.valueId);
    // Matrix rows use source ordering; keep the same IDs and only reorder the
    // positions belonging to this presentation group.
    const reorderedIds = new Set(ordered);
    const next = source ? patchWorkspaceSection(structure, action.sectionId!, {
      valueIds: source.valueIds.map((id: string) => reorderedIds.has(id) ? ordered.shift() : id),
    }) : structure;
    return { ...next, workspaceGroups: groups };
  }
  const axis = structure.vertical_axis && sectionId(structure.vertical_axis);
  const movable = groups.filter(item => !item.options.some(option => option.sectionId === axis));
  if (!movable.includes(group)) return structure;
  const index = movable.indexOf(group);
  const target = movable.find(item => item.id === action.targetId)
    || (action.action === 'up' ? movable[index - 1] : action.action === 'down' ? movable[index + 1] : undefined);
  if (action.action === 'detach') return placeWorkspaceGroup(structure, group.id);
  if (!target || target === group) return structure;
  if (action.action === 'beside') return placeWorkspaceGroup(structure, group.id, target.id);
  if (action.action === 'swap') {
    const from = groups.indexOf(group); const to = groups.indexOf(target);
    [group.rowId, target.rowId] = [target.rowId, group.rowId];
    [groups[from], groups[to]] = [groups[to], groups[from]];
  } else if (['up', 'down', 'before', 'after'].includes(action.action)) {
    const after = action.action === 'down' || action.action === 'after';
    const sameRow = group.rowId && group.rowId === target.rowId;
    groups.splice(groups.indexOf(group), 1);
    // Crossing a row puts the section on its own row. Otherwise an old rowId
    // would silently pull it back to its former position when rendering.
    if (!sameRow) group.rowId = `group:${group.id}`;
    const targetRow = sameRow ? [target] : groups.filter(item => item.id === target.id || (target.rowId && item.rowId === target.rowId));
    const at = after ? Math.max(...targetRow.map(item => groups.indexOf(item))) + 1 : Math.min(...targetRow.map(item => groups.indexOf(item)));
    groups.splice(at, 0, group);
  } else return structure;
  return { ...structure, workspaceGroups: groups, customerSelectionOrder: [...new Set(groups.flatMap(item => item.options.map(option => option.sectionId)))] };
}

export function restoreWorkspacePlacement(current: WorkspaceStructure, previous: WorkspaceStructure): WorkspaceStructure {
  const now = workspaceGroups(current);
  const before = workspaceGroups(previous);
  const groups: WorkspaceGroup[] = before.flatMap(old => {
    const group = now.find(item => item.id === old.id);
    if (!group) return [];
    const options = old.options.flatMap(option => group.options.filter(item => item.sectionId === option.sectionId && item.valueId === option.valueId));
    return [{ ...group, rowId: old.rowId, options: [...options, ...group.options.filter(option => !options.some(item => item.sectionId === option.sectionId && item.valueId === option.valueId))] }];
  });
  groups.push(...now.filter(group => !before.some(old => old.id === group.id)));
  let next = current;
  for (const old of workspaceSections(previous)) {
    const section = workspaceSections(current).find(item => sectionId(item) === sectionId(old));
    if (!section) continue;
    next = patchWorkspaceSection(next, sectionId(old), { valueIds: [...old.valueIds.filter((id: string) => section.valueIds.includes(id)), ...section.valueIds.filter((id: string) => !old.valueIds.includes(id))] });
  }
  return { ...next, workspaceGroups: groups, customerSelectionOrder: [...new Set(groups.flatMap(group => group.options.map(option => option.sectionId)))] };
}
