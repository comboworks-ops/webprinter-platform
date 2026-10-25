import type { BrandingData } from '@/hooks/useBrandingDraft';
import { signalSettings } from './pvcbannerSettings';
import { usesWideFormat, wideFormatDesign } from './wideFormatDesigns';

/** Each recipe uses the existing BrandingData model, stored inside its own draft bank. */
type Entry = { patch?: Partial<BrandingData>; sections?: Record<string, boolean> };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function merge<T>(base: T, patch: unknown): T {
  const result = { ...record(base) };
  for (const [key, value] of Object.entries(record(patch))) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    result[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(result[key], value) : value;
  }
  return result as T;
}
export function wideFormatEditorEntry(branding: Pick<BrandingData, 'themeSettings'>): Entry {
  return record(record(branding.themeSettings?.wideFormatEditor)[wideFormatDesign(branding.themeSettings?.wideFormatDesign).id]) as Entry;
}
export function wideFormatSectionIsShared(branding: Pick<BrandingData, 'themeSettings'>, section: string) {
  return wideFormatEditorEntry(branding).sections?.[section] === true;
}
export function withWideFormatSection(branding: BrandingData, section: string, shared: boolean): Partial<BrandingData> {
  const id = wideFormatDesign(branding.themeSettings?.wideFormatDesign).id;
  const bank = record(branding.themeSettings?.wideFormatEditor);
  const entry = wideFormatEditorEntry(branding);
  return { themeSettings: { ...branding.themeSettings, wideFormatEditor: { ...bank, [id]: { ...entry, sections: { ...entry.sections, [section]: shared } } } } };
}
export function resolveWideFormatEditorBranding(branding: BrandingData, tenantId?: string | null): BrandingData {
  if (!usesWideFormat(branding, tenantId)) return branding;
  const b = signalSettings(branding);
  const buttons = [{id:'wide-primary',label:b.heroButton,variant:'primary' as const,linkType:'INTERNAL_PAGE' as const,target:{path:b.heroLink}}, ...(b.showSecondaryButton ? [{id:'wide-secondary',label:b.secondaryButton,variant:'secondary' as const,linkType:'INTERNAL_PAGE' as const,target:{path:b.secondaryLink}}] : [])];
  const seed = {
    ...branding, themeId: 'classic', themeSettings: { ...branding.themeSettings, shopFamily: 'wide-format' },
    colors: { ...branding.colors, primary: b.primary, background: b.background, headingText: b.ink, bodyText: b.ink, linkText: b.primary },
    fonts: { ...branding.fonts, heading: b.headingFont, body: b.bodyFont },
    forside: { ...branding.forside, contentBlocks: [], lowerInfo: { ...branding.forside.lowerInfo, enabled: false } },
    seoContent: { ...branding.seoContent, enabled: false, items: [] },
    logo_url: b.logo,
    footer: { ...branding.footer, text: b.footerText },
    header: { ...branding.header, logoText: b.brand, logoFont: b.bodyFont, fontId: b.bodyFont, bgColor: b.headerBackground, textColor: b.headerTextColor, dropdownBgColor: b.dropdownBackground, dropdownTextColor: b.dropdownTextColor, transparentOverHero: false },
    hero: { ...branding.hero, images: [{ id: 'wide-hero', url: b.heroImage, alt: b.heroImageAlt, sortOrder: 0, headline:b.heroTitle, subline:b.heroDescription, buttons }], overlay: { ...branding.hero.overlay, buttons, title: b.heroTitle, subtitle: b.heroDescription, titleFontId: b.headingFont, subtitleFontId: b.bodyFont } },
  };
  return merge(seed, wideFormatEditorEntry(branding).patch);
}
/** Never flatten a recipe into the conventional shop or into another recipe. */
export function wideFormatEditorPatch(base: BrandingData, patch: Partial<BrandingData>, tenantId?: string | null): Partial<BrandingData> {
  if (!usesWideFormat(base, tenantId)) return patch;
  const current = resolveWideFormatEditorBranding(base, tenantId);
  const id = wideFormatDesign(base.themeSettings?.wideFormatDesign).id;
  const theme = { ...base.themeSettings };
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'themeSettings') {
      for (const [setting, next] of Object.entries(record(value))) {
        if (JSON.stringify(next) === JSON.stringify(current.themeSettings?.[setting])) continue;
        if (/^(wideFormat|pvcbanner|shopFamily)/.test(setting)) theme[setting] = next;
        else changed.themeSettings = { ...record(changed.themeSettings), [setting]: next };
      }
    } else if (JSON.stringify(value) !== JSON.stringify(current[key as keyof BrandingData])) changed[key] = value;
  }
  const bank = record(theme.wideFormatEditor);
  const entry = record(bank[id]) as Entry;
  if (Object.keys(changed).length) theme.wideFormatEditor = { ...bank, [id]: { ...entry, patch: merge(entry.patch || {}, changed) } };
  return { themeSettings: theme };
}

export const WIDE_FORMAT_SECTION_ORDER = ['hero','banner2','products','content','usp','seo'] as const;
export function wideFormatSectionOrder(branding: BrandingData): Array<typeof WIDE_FORMAT_SECTION_ORDER[number]> {
  const saved = wideFormatEditorEntry(branding).patch?.forside?.layout?.sectionOrder || [];
  return [...new Set([...saved, ...WIDE_FORMAT_SECTION_ORDER])].filter((id): id is typeof WIDE_FORMAT_SECTION_ORDER[number] => WIDE_FORMAT_SECTION_ORDER.includes(id as typeof WIDE_FORMAT_SECTION_ORDER[number]));
}
