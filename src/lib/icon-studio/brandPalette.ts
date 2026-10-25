import type { BrandingData } from '@/hooks/useBrandingDraft';
import { signalSettings } from '../branding/pvcbannerSettings.ts';
import { usesWideFormat, wideFormatDesign } from '../branding/wideFormatDesigns.ts';

export type StudioPaletteMode = 'saved' | 'published' | 'custom';
export interface StudioBrandPalette {
  palette: [string, string];
  designName: string;
}

function hexColour(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${hex.slice(1).split('').map(c => c + c).join('')}`;
  return null;
}

/** Read the same design bank as the homepage. Conventional colours must not
 * leak into a wide-format recipe whose accent lives in its own settings. */
export function studioBrandPalette(branding: BrandingData, tenantId: string): StudioBrandPalette | null {
  const wide = usesWideFormat(branding, tenantId);
  const site = wide ? signalSettings(branding) : null;
  const primary = hexColour(site?.primary ?? branding.colors.primary);
  const wideColours = wide
    ? (branding.themeSettings.wideFormatEditor as Record<string, {patch?: {colors?: {secondary?: string}}}> | undefined)?.[site!.designId]?.patch?.colors
    : undefined;
  const secondary = hexColour(wide ? wideColours?.secondary ?? site?.accent : branding.colors.secondary);
  const background = hexColour(site?.background ?? branding.colors.background);
  if (!primary || !secondary) return null;
  return {
    // After Hours deliberately uses one accent for both roles. Its dark page
    // background supplies the second surface rather than a stale light palette.
    palette: [primary, secondary === primary ? background || secondary : secondary],
    designName: wide ? wideFormatDesign(branding.themeSettings.wideFormatDesign).name : 'Webprinter',
  };
}
