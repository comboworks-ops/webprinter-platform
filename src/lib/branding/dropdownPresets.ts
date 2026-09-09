/** Approved menu concepts retain their original gallery numbers and stable IDs. */
export const APPROVED_DROPDOWN_PRESETS = [
  { id: 'tabbed-explorer', number: 1, name: 'Tabbed Explorer', description: 'Kategorifaner med produktbilleder og roligt skift mellem kategorier.', previewImage: '/menu-presets/01-tabbed-explorer.png' },
  { id: 'visual-showroom', number: 2, name: 'Visual Showroom', description: 'Store produktbilleder med et enkelt visuelt overblik.', previewImage: '/menu-presets/02-visual-showroom.png' },
  { id: 'kinetic-type', number: 3, name: 'Kinetic Type', description: 'Store kategorinavne med en kort, forskudt åbning.', previewImage: '/menu-presets/03-kinetic-type.png' },
  { id: 'quick-list', number: 4, name: 'Quick List', description: 'En kompakt liste med ikoner og direkte links.', previewImage: '/menu-presets/04-quick-list.png' },
  { id: 'search-and-discover', number: 5, name: 'Search & Discover', description: 'Søgning, kategorier og produktbilleder samlet i menuen.', previewImage: '/menu-presets/05-search-and-discover.png' },
  { id: 'paper-fold', number: 7, name: 'Paper Fold', description: 'Papirinspirerede felter med en kort udfoldning.', previewImage: '/menu-presets/07-paper-fold.png' },
  { id: 'open-directory', number: 8, name: 'Open Directory', description: 'Et luftigt katalog med tydelige kolonner og produktlinks.', previewImage: '/menu-presets/08-open-directory.png' },
  { id: 'product-filmstrip', number: 9, name: 'Product Filmstrip', description: 'En vandret billedrække, som kunden selv bladrer i.', previewImage: '/menu-presets/09-product-filmstrip.png' },
  { id: 'focus-curtain', number: 10, name: 'Focus Curtain', description: 'Et rummeligt menufelt, som åbner blødt over siden.', previewImage: '/menu-presets/10-focus-curtain.png' },
] as const;

export type ApprovedDropdownPreset = (typeof APPROVED_DROPDOWN_PRESETS)[number]['id'];
export const LEGACY_DROPDOWN_PRESETS = ['classic', 'showcase-bar', 'split-preview', 'compact-columns', 'gallery-cards'] as const;
export type LegacyDropdownPreset = (typeof LEGACY_DROPDOWN_PRESETS)[number];
export type HeaderDropdownPreset = ApprovedDropdownPreset | LegacyDropdownPreset;
export const DEFAULT_DROPDOWN_PRESET: ApprovedDropdownPreset = 'search-and-discover';

const approvedIds = new Set<string>(APPROVED_DROPDOWN_PRESETS.map(preset => preset.id));
const legacyIds = new Set<string>(LEGACY_DROPDOWN_PRESETS);

export function isApprovedDropdownPreset(value: unknown): value is ApprovedDropdownPreset {
  return typeof value === 'string' && approvedIds.has(value);
}

/** Legacy Classic represented the old default; deliberate alternative menus survive. */
export function resolveDropdownPreset(value: unknown): HeaderDropdownPreset {
  if (isApprovedDropdownPreset(value)) return value;
  if (typeof value === 'string' && value !== 'classic' && legacyIds.has(value)) {
    return value as LegacyDropdownPreset;
  }
  return DEFAULT_DROPDOWN_PRESET;
}
