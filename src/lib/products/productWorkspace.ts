/** Presentation drafts never own price rows, supplier IDs, or fulfillment settings. */
export type WorkspaceStructure = Record<string, any>;
export type WorkspaceOption = { sectionId: string; valueId: string };
export type WorkspaceGroup = {
  id: string;
  title: string;
  uiMode?: string;
  motion?: 'none' | 'lift' | 'zoom' | 'bounce' | 'liquid';
  imageSizePx?: number;
  reveal?: boolean;
  /** Groups sharing a row are shown beside each other; source price IDs stay intact. */
  rowId?: string;
  options: WorkspaceOption[];
  pending?: { id: string; name: string }[];
};
export const WORKSPACE_FIELDS = ['vertical_axis', 'layout_rows', 'customerSelectionOrder', 'workspaceGroups', 'workspaceContent'] as const;
export const sectionId = (section: WorkspaceStructure) => String(section.sectionId || section.id);
export function workspaceSections(structure: WorkspaceStructure): WorkspaceStructure[] {
  return [structure.vertical_axis, ...(structure.layout_rows || []).flatMap((row: WorkspaceStructure) => row.columns || [])]
    .filter(Boolean).filter((section, index, all) => all.findIndex(item => sectionId(item) === sectionId(section)) === index);
}
export function liveWorkspaceStructure(structure: WorkspaceStructure): WorkspaceStructure {
  const result = structuredClone(structure || {});
  delete result.workspaceDraft;
  return result;
}
export function workspaceFingerprint(structure: WorkspaceStructure): string {
  return JSON.stringify(liveWorkspaceStructure(structure));
}
export function workspaceGroups(structure: WorkspaceStructure, names: Record<string, string> = {}): WorkspaceGroup[] {
  if (Array.isArray(structure.workspaceGroups)) return structure.workspaceGroups.map((group: WorkspaceGroup) => {
    const source = workspaceSections(structure).find(section => sectionId(section) === group.id);
    // Original sections share these settings with Site Design. Newly-created
    // presentation categories may group several sources and own their labels.
    return source ? { ...group, title: source.title || group.title, uiMode: source.ui_mode || group.uiMode } : group;
  });
  return workspaceSections(structure).map(section => ({
    id: sectionId(section), title: section.title || names[section.groupId] || section.labelOverride || 'Valg',
    rowId: structure.layout_rows?.find((row: WorkspaceStructure) => row.columns?.some((col: WorkspaceStructure) => sectionId(col) === sectionId(section)))?.id,
    options: (section.valueIds || []).map((valueId: string) => ({ sectionId: sectionId(section), valueId })),
  }));
}
export function workspaceRows(groups: WorkspaceGroup[]): WorkspaceGroup[][] {
  const rows: WorkspaceGroup[][] = [];
  const byId = new Map<string, WorkspaceGroup[]>();
  for (const group of groups) {
    const id = group.rowId || `group:${group.id}`;
    let row = byId.get(id);
    if (!row) { row = []; byId.set(id, row); rows.push(row); }
    row.push(group);
  }
  return rows;
}
export function placeWorkspaceGroup(structure: WorkspaceStructure, id: string, besideId?: string, names: Record<string, string> = {}): WorkspaceStructure {
  const groups = structuredClone(workspaceGroups(structure, names));
  const group = groups.find(item => item.id === id);
  const target = groups.find(item => item.id === besideId);
  if (!group || (besideId && (!target || target.id === id))) throw new Error('Vælg en anden sektion at placere ved siden af.');
  const axisId = structure.vertical_axis && sectionId(structure.vertical_axis);
  if (group.options.some(option => option.sectionId === axisId) || target?.options.some(option => option.sectionId === axisId)) throw new Error('Matrixrækken placeres i pristabellen.');
  if (target) {
    const rowId = target.rowId || `group:${target.id}`;
    const count = groups.filter(item => item.id !== id && (item.rowId || `group:${item.id}`) === rowId).length;
    if (count >= 3) throw new Error('Der kan højst være tre sektioner ved siden af hinanden.');
    target.rowId = rowId; group.rowId = rowId;
    groups.splice(groups.indexOf(group), 1);
    groups.splice(groups.indexOf(target) + 1, 0, group);
  } else {
    group.rowId = `group:${group.id}`;
  }
  return { ...structure, workspaceGroups: groups };
}
export function patchWorkspaceSection(structure: WorkspaceStructure, id: string, patch: WorkspaceStructure): WorkspaceStructure {
  const next = structuredClone(structure);
  const section = workspaceSections(next).find(item => sectionId(item) === id);
  if (!section) throw new Error('Valgsektionen findes ikke længere.');
  Object.assign(section, patch);
  // Some imports repeat the matrix axis in layout_rows. Keep both copies aligned.
  for (const row of next.layout_rows || []) for (const col of row.columns || []) {
    if (sectionId(col) === id) Object.assign(col, patch);
  }
  return next;
}
export function moveWorkspaceOption(structure: WorkspaceStructure, option: WorkspaceOption, targetId: string, names: Record<string, string> = {}): WorkspaceStructure {
  const groups = structuredClone(workspaceGroups(structure, names));
  const target = groups.find(group => group.id === targetId);
  if (!target) throw new Error('Gruppen findes ikke.');
  for (const group of groups) group.options = group.options.filter(item => item.sectionId !== option.sectionId || item.valueId !== option.valueId);
  target.options.push(option);
  return { ...structure, workspaceGroups: groups };
}
export function setWorkspaceMatrixAxis(structure: WorkspaceStructure, id: string): WorkspaceStructure {
  const next = structuredClone(structure);
  const nextAxis = workspaceSections(next).find(section => sectionId(section) === id);
  if (!nextAxis) throw new Error('Valgsektionen findes ikke.');
  if (!['formats', 'materials'].includes(nextAxis.sectionType)) throw new Error('Matrixrækker skal være format eller materiale.');
  const oldAxis = next.vertical_axis;
  next.vertical_axis = { ...nextAxis, sectionId: id };
  next.layout_rows = (next.layout_rows || []).map((row: WorkspaceStructure) => ({ ...row, columns: row.columns.filter((col: WorkspaceStructure) => sectionId(col) !== id && sectionId(col) !== sectionId(oldAxis)) }));
  if (sectionId(oldAxis) !== id) next.layout_rows.unshift({ id: `workspace-row-${sectionId(oldAxis)}`, columns: [{ ...oldAxis, id: sectionId(oldAxis) }] });
  return next;
}
export function validateWorkspace(structure: WorkspaceStructure): string[] {
  const issues: string[] = [];
  const sections = workspaceSections(structure);
  const refs = new Set<string>();
  for (const group of workspaceGroups(structure)) {
    if (!group.title.trim()) issues.push('Giv alle grupper et navn.');
    if (group.pending?.length) issues.push(`“${group.title}” har nye valg, der mangler prisgrundlag.`);
    for (const ref of group.options) {
      const key = `${ref.sectionId}:${ref.valueId}`;
      const source = sections.find(section => sectionId(section) === ref.sectionId);
      if (!source?.valueIds?.includes(ref.valueId)) issues.push('Et importeret valg findes ikke længere i prisgrundlaget.');
      if (refs.has(key)) issues.push('Et valg er placeret i mere end én gruppe.');
      refs.add(key);
    }
  }
  for (const section of sections) for (const valueId of section.valueIds || []) {
    if (!refs.has(`${sectionId(section)}:${valueId}`)) issues.push('Et importeret valg mangler en placering.');
  }
  return [...new Set(issues)];
}
/** Merge only editor-owned fields into the freshly read live structure. */
export function prepareWorkspaceSave(current: WorkspaceStructure, expected: WorkspaceStructure, draft: WorkspaceStructure, publish: boolean): WorkspaceStructure {
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('Produktet er ændret i et andet vindue. Genindlæs, før du gemmer; dine ændringer er stadig åbne her.');
  const live = liveWorkspaceStructure(current);
  const presentation = Object.fromEntries(WORKSPACE_FIELDS.filter(key => draft[key] !== undefined).map(key => [key, structuredClone(draft[key])]));
  if (!publish) return { ...live, workspaceDraft: { version: 1, base: workspaceFingerprint(live), presentation, savedAt: new Date().toISOString() } };
  const result = { ...live, ...presentation };
  const issues = validateWorkspace(result);
  if (issues.length) throw new Error(issues.join(' '));
  return result;
}
export function readWorkspaceDraft(structure: WorkspaceStructure): { structure: WorkspaceStructure; stale: boolean } {
  const live = liveWorkspaceStructure(structure);
  const saved = structure?.workspaceDraft;
  if (!saved || saved.version !== 1) return { structure: live, stale: false };
  const stale = saved.base !== workspaceFingerprint(live);
  return { structure: stale ? live : { ...live, ...saved.presentation }, stale };
}

/** Only explicit metadata is a production method; quantity alone is never evidence. */
export function productionMethodLabel(priceRow: WorkspaceStructure): string | undefined {
  const method = String(priceRow?.extra_data?.production_method || priceRow?.extra_data?.productionMethod || priceRow?.production_method || '').toLowerCase();
  if (['digital', 'digitaltryk', 'digital_print'].includes(method)) return 'Digitaltryk';
  if (['offset', 'offsettryk', 'offset_print'].includes(method)) return 'Offsettryk';
  return undefined;
}
