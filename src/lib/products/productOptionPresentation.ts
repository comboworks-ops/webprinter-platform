import { patchWorkspaceSection, sectionId, workspaceGroups, workspaceSections, type WorkspaceStructure } from './productWorkspace.ts';

export const pictureModes = ['small', 'medium', 'large', 'xl', 'xl_notext', 'image_only', 'text_below_image'];
export function pictureModeSize(mode: string, custom?: number): number {
  return custom == null ? ({ small: 64, medium: 112, large: 176, xl: 256, xl_notext: 256 }[mode] || 112) : Math.max(32, Math.min(480, custom));
}

/** A selected preset replaces old thumbnail sizes, never the imported image or price ID. */
export function setWorkspaceGroupMode(structure: WorkspaceStructure, id: string, mode: string): WorkspaceStructure {
  let next = structuredClone(structure);
  next.workspaceGroups = workspaceGroups(next).map(group => group.id === id ? { ...group, uiMode: mode, imageSizePx: undefined } : group);
  const group = next.workspaceGroups.find(group => group.id === id);
  const native = workspaceSections(next).find(section => sectionId(section) === id);
  if (native) next = patchWorkspaceSection(next, id, { ui_mode: mode });
  if (pictureModes.includes(mode)) for (const ref of group?.options || []) {
    const section = workspaceSections(next).find(item => sectionId(item) === ref.sectionId);
    if (!section?.valueSettings?.[ref.valueId]) continue;
    const settings = { ...section.valueSettings, [ref.valueId]: { ...section.valueSettings[ref.valueId] } };
    delete settings[ref.valueId].imageSizePx;
    next = patchWorkspaceSection(next, ref.sectionId, { valueSettings: settings });
  }
  return next;
}

/** Section controls must replace conflicting per-option styles, retaining option content. */
export function patchWorkspaceSelectorStyle(structure: WorkspaceStructure, id: string, styling: WorkspaceStructure, reset = false): WorkspaceStructure {
  const section = workspaceSections(structure).find(item => sectionId(item) === id);
  const before = section?.selectorStyling || {};
  const resetKeys = ['backgroundColor', 'hoverBackgroundColor', 'textColor', 'hoverTextColor', 'borderColor', 'hoverBorderColor', 'borderRadiusPx', 'borderWidthPx', 'fontSizePx', 'minHeightPx', 'paddingPx', 'imageSizePx'];
  const changed = new Set(reset ? resetKeys : []);
  for (const kind of ['textButtons', 'pictureButtons']) for (const [key, value] of Object.entries(styling[kind] || {})) {
    if (value !== before[kind]?.[key]) changed.add(key === 'imageBorderRadiusPx' ? 'borderRadiusPx' : key === 'labelFontSizePx' ? 'fontSizePx' : key);
  }
  const valueSettings = Object.fromEntries(Object.entries(section?.valueSettings || {}).map(([valueId, raw]) => {
    const setting = { ...(raw as WorkspaceStructure) };
    for (const key of changed) delete setting[key];
    return [valueId, setting];
  }));
  return patchWorkspaceSection(structure, id, { selectorStyling: styling, valueSettings });
}
