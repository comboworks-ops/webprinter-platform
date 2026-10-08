import type { CSSProperties } from 'react';
import type { HeaderSettings } from '../../hooks/useBrandingDraft';
import { dropdownBackground } from './siteDesignControls.ts';

export const MENU_ENTRANCES = [
  { id: 'fade', name: 'Langsom fade', description: 'En rolig indtoning uden bevægelse.' },
  { id: 'zoom', name: 'Hurtig zoom', description: 'Et kort løft med en lille zoom.' },
  { id: 'bounce', name: 'Bounce', description: 'Menuen springer let frem og falder til ro.' },
  { id: 'unfold', name: 'Udfoldning', description: 'Boksen folder sig ud, før indholdet vises.' },
  { id: 'cascade', name: 'Trinvis opbygning', description: 'Boksen åbner, og punkterne kommer ind ét efter ét.' },
] as const;
export type MenuEntrance = typeof MENU_ENTRANCES[number]['id'];
export const SEARCH_PRESENTATIONS = [
  { id: 'discover', name: 'Søg & opdag', description: 'Produktforslag før kunden skriver.' },
  { id: 'categories', name: 'Kategorier', description: 'Filtrér søgningen med kategoriknapper.' },
  { id: 'visual', name: 'Billedgalleri', description: 'Søg og gennemse store produktkort.' },
  { id: 'command', name: 'Tastatursøgning', description: 'Et bredt søgefelt med genveje og kategoriresultater.' },
  { id: 'compact', name: 'Hurtig søgning', description: 'Skriv først; se derefter en enkel resultatliste.' },
] as const;
export type SearchPresentation = typeof SEARCH_PRESENTATIONS[number]['id'];
export const LANGUAGE_PRESENTATIONS = [
  { id: 'flag', name: 'Flag' }, { id: 'code', name: 'Sprogkode · DA / EN' },
  { id: 'label', name: 'Fuldt sprognavn' }, { id: 'cards', name: 'Sprogkort' },
  { id: 'segmented', name: 'Direkte DA / EN' },
] as const;
export type LanguagePresentation = typeof LANGUAGE_PRESENTATIONS[number]['id'];

export function resolveMenuEntrance(value: unknown): MenuEntrance | undefined {
  return MENU_ENTRANCES.find(option => option.id === value)?.id;
}
export function resolveSearchPresentation(preset: string, override?: unknown): SearchPresentation {
  const selected = SEARCH_PRESENTATIONS.find(option => option.id === override)?.id;
  if (selected) return selected;
  if (['tabbed-explorer', 'open-directory', 'paper-fold'].includes(preset)) return 'categories';
  if (['visual-showroom', 'product-filmstrip', 'gallery-cards'].includes(preset)) return 'visual';
  if (['kinetic-type', 'focus-curtain'].includes(preset)) return 'command';
  if (['quick-list', 'compact-columns'].includes(preset)) return 'compact';
  return 'discover';
}
export function resolveLanguagePresentation(preset: string, override?: unknown): LanguagePresentation {
  const selected = LANGUAGE_PRESENTATIONS.find(option => option.id === override)?.id;
  if (selected) return selected;
  if (['tabbed-explorer', 'open-directory', 'paper-fold'].includes(preset)) return 'label';
  if (['visual-showroom', 'product-filmstrip', 'gallery-cards'].includes(preset)) return 'cards';
  if (preset === 'kinetic-type') return 'segmented';
  if (['quick-list', 'focus-curtain', 'compact-columns'].includes(preset)) return 'code';
  return 'flag';
}

/** Changing behaviour must not accidentally convert the dark preset to white. */
export function menuColorsChanged(before: Partial<HeaderSettings>, after: Partial<HeaderSettings>): boolean {
  return (['dropdownBgColor', 'dropdownBgOpacity', 'dropdownHoverColor', 'dropdownProductColor',
    'dropdownCategoryColor', 'dropdownMetaColor', 'dropdownAccentColor'] as const)
    .some(key => before[key] !== after[key]);
}

/** One palette for Products, portalled menus, search and designer samples. */
export function headerMenuStyle(header: Partial<HeaderSettings>, primary = '#087FC5', customized = false): CSSProperties {
  const background = dropdownBackground(header.dropdownBgColor || '#FFFFFF', header.dropdownBgOpacity ?? 0.95);
  const text = header.dropdownProductColor || '#1F2937';
  return {
    '--menu-bg': background, '--menu-text': text,
    '--menu-dark-bg': customized ? background : undefined, '--menu-dark-text': customized ? text : undefined,
    '--menu-accent': header.dropdownAccentColor || primary,
    '--menu-category-color': header.dropdownCategoryColor || '#6B7280',
    '--menu-category-font': `'${header.dropdownCategoryFontId || 'Inter'}', sans-serif`,
    '--menu-product-font': `'${header.dropdownProductFontId || 'Inter'}', sans-serif`,
    '--menu-category-size': `${Math.min(24, Math.max(10, Number(header.dropdownCategoryFontSizePx ?? 13)))}px`,
    '--menu-product-size': `${Math.min(24, Math.max(10, Number(header.dropdownProductFontSizePx ?? 14)))}px`,
    '--menu-meta-size': `${Math.min(24, Math.max(10, Number(header.dropdownMetaFontSizePx ?? 11)))}px`,
    '--menu-muted': header.dropdownMetaColor || '#6B7280',
    '--menu-radius': `${Math.min(40, Math.max(0, Number(header.dropdownBorderRadiusPx ?? 18)))}px`,
    '--menu-image-radius': `${Math.min(40, Math.max(0, Number(header.dropdownImageRadiusPx ?? 4)))}px`,
    '--menu-icon-animation': header.dropdownIconMotion === 'subtle' ? 'wp-menu-icon-lift' : header.dropdownIconMotion === 'playful' ? 'wp-menu-icon-bounce' : 'none',
    '--menu-hover-bg': header.dropdownHoverColor || '#EFF6FC',
  } as CSSProperties;
}
