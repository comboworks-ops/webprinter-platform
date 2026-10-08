import type { HeaderSettings } from '@/hooks/useBrandingDraft';
import { resolveDropdownPreset } from '../lib/branding/dropdownPresets.ts';
import { resolveMenuEntrance, SEARCH_PRESENTATIONS, LANGUAGE_PRESENTATIONS } from '../lib/branding/headerMenuSettings.ts';

export const MENU_REVIEW_STORAGE_KEY = 'webprinter:dropdown-menu-review:v1';
const colors = ['dropdownBgColor', 'dropdownProductColor', 'dropdownHoverColor', 'dropdownAccentColor'] as const;
/** Only public visual choices travel between the two DEV review pages. */
export function menuReviewLink(path: string, header: HeaderSettings, customized = false, iconPack?: string): string {
  const query = new URLSearchParams({ menu: header.dropdownPreset, entrance: header.dropdownEntrance || '', search: header.dropdownSearchPresentation || '', language: header.dropdownLanguagePresentation || '', palette: String(customized) });
  if (iconPack) query.set('icons', iconPack);
  if (header.dropdownIconMotion) query.set('iconMotion', header.dropdownIconMotion);
  for (const key of colors) query.set(key, header[key] || '');
  return `${path}?${query}`;
}
export function readMenuReviewQuery(header: HeaderSettings, search: string): HeaderSettings {
  const query = new URLSearchParams(search);
  const patch: Partial<HeaderSettings> = {};
  if (query.has('iconMotion')) patch.dropdownIconMotion = ['none','subtle','playful'].includes(query.get('iconMotion') || '') ? query.get('iconMotion') as HeaderSettings['dropdownIconMotion'] : undefined;
  if (query.has('menu')) patch.dropdownPreset = resolveDropdownPreset(query.get('menu'));
  if (query.has('entrance')) patch.dropdownEntrance = resolveMenuEntrance(query.get('entrance'));
  if (query.has('search')) patch.dropdownSearchPresentation = SEARCH_PRESENTATIONS.find(option => option.id === query.get('search'))?.id;
  if (query.has('language')) patch.dropdownLanguagePresentation = LANGUAGE_PRESENTATIONS.find(option => option.id === query.get('language'))?.id;
  for (const key of colors) {
    const value = query.get(key);
    if (value && /^#[\da-f]{6}$/i.test(value)) patch[key] = value;
    if (key === 'dropdownAccentColor' && value === '') patch[key] = undefined;
  }
  return { ...header, ...patch };
}

export function readMenuReviewPalette(fallback: boolean, search: string): boolean {
  const value = new URLSearchParams(search).get('palette');
  return value === 'true' ? true : value === 'false' ? false : fallback;
}
