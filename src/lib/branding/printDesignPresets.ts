import type { BrandingData } from '@/hooks/useBrandingDraft';
import { resolveDropdownPreset } from './dropdownPresets.ts';

// Display numbers follow the original concept order, corrected on 8 September 2026.
// Stable theme IDs and preview assets retain their existing visual compositions.
export const DEFAULT_PRINT_DESIGN_ID = 'print-familiar';
export const PRINT_DESIGN_PRESETS = [
  { id: 'print-familiar', number: 1, name: 'Refined Familiar', description: 'Blå navigation, stor fotobanner og en enkel vej til bestilling.', previewImage: '/design-presets/preview-2.webp', hero: 'familiar', title: 'Professionelt tryk.\nNemt at bestille.', subtitle: 'Kvalitetstryk til virksomheder og private. Vælg dit produkt, tilpas og bestil online.', action: 'Find dit produkt', blueHeader: true },
  { id: 'print-product', number: 2, name: 'Product First', description: 'Søgning og tydelige produktkategorier kommer først.', previewImage: '/design-presets/preview-4.webp', hero: null, title: 'Hvad skal vi trykke for dig?', subtitle: '', action: 'Se alle produkter', blueHeader: false },
  { id: 'print-nordic', number: 3, name: 'Nordic Print Studio', description: 'Varme papirtoner, rolige billeder og luft mellem produkterne.', previewImage: '/design-presets/preview-3.webp', hero: 'nordic', title: 'Godt tryk starter\nmed et enkelt valg.', subtitle: 'Find dit produkt, vælg format og beregn din pris.', action: 'Se produkter', blueHeader: false },
  { id: 'print-precise', number: 4, name: 'Precise Print Grid', description: 'Præcist overblik med kategorier til venstre og produktet i centrum.', previewImage: '/design-presets/preview-1.webp', hero: 'precise', title: 'Dit print. Helt enkelt.', subtitle: 'Vælg produkt, tilpas dine mål og antal – og bestil online på få minutter.', action: 'Se alle produkter', blueHeader: false },
  { id: 'print-calm', number: 5, name: 'Calm Blue Commerce', description: 'Lyseblå flader, kompakte kategorier og en overskuelig prisboks.', previewImage: '/design-presets/preview-5.webp', hero: 'calm', title: 'Fra idé til\nfærdigt print.', subtitle: 'Vælg dit produkt, tilpas dit print og bestil online.', action: 'Vælg dit produkt', blueHeader: true },
] as const;
export type PrintDesignPreset = typeof PRINT_DESIGN_PRESETS[number];
export const getPrintDesignPreset = (id?: string) => PRINT_DESIGN_PRESETS.find(p => p.id === id);

function isDefaultValue(value: unknown, defaultValue: unknown): boolean {
  return value === undefined || JSON.stringify(value) === JSON.stringify(defaultValue);
}

function preserveCustomValues<T extends object>(applied: T, original: T, defaults: T): T {
  const result = { ...applied };
  for (const key of Object.keys(original) as (keyof T)[]) {
    if (!isDefaultValue(original[key], defaults[key])) result[key] = original[key];
  }
  return result;
}

/** Resolve the shared standard without overwriting a tenant's deliberate design or branding. */
export function inheritSystemPrintDesign(branding: BrandingData, defaults: BrandingData): BrandingData {
  const themeId = String(branding.themeId || '').trim();
  const settings = branding.themeSettings || {};
  const inheritedId = String(settings.inheritedPrintDesignId || '').trim();
  const presetId = String(settings.visualThemePresetId || '').trim();
  const styleId = String(settings.visualStyleId || '').trim();
  const followsInherited = Boolean(inheritedId && themeId === inheritedId && presetId === inheritedId && styleId === inheritedId);

  if (followsInherited && themeId === DEFAULT_PRINT_DESIGN_ID) return branding;
  if (!followsInherited && (inheritedId || presetId || styleId
    || (themeId && themeId !== 'classic' && themeId !== DEFAULT_PRINT_DESIGN_ID))) return branding;

  const result = applyPrintDesignPreset(branding, DEFAULT_PRINT_DESIGN_ID);
  result.themeSettings.inheritedPrintDesignId = DEFAULT_PRINT_DESIGN_ID;
  result.colors = preserveCustomValues(result.colors, branding.colors, defaults.colors);
  result.fonts = preserveCustomValues(result.fonts, branding.fonts, defaults.fonts);
  result.header = preserveCustomValues(result.header, branding.header, defaults.header);

  const stockUrls = new Set(defaults.hero.images.map(image => image.url));
  const hasCustomHero = branding.hero.images.some(image => image.url
    && !stockUrls.has(image.url) && !/^\/design-presets\/[^/]+-hero\.webp(?:[?#].*)?$/.test(image.url));
  if (hasCustomHero || (branding.hero.images.length === 0 && defaults.hero.images.length > 0)) {
    result.hero.images = branding.hero.images;
  }

  const primary = result.colors.primary;
  const hasCustomPrimary = Boolean(primary && !isDefaultValue(branding.colors.primary, defaults.colors.primary));
  if (hasCustomPrimary) {
    if (isDefaultValue(branding.header.bgColor, defaults.header.bgColor)) result.header.bgColor = primary;
    if (isDefaultValue(branding.colors.pricingText, defaults.colors.pricingText)) result.colors.pricingText = primary;
    if (isDefaultValue(branding.colors.linkText, defaults.colors.linkText)) result.colors.linkText = primary;
  }

  const originalProducts = branding.forside.productsSection;
  const defaultProducts = defaults.forside.productsSection;
  const appliedProducts = result.forside.productsSection;
  // Custom CTA colours remain explicit; otherwise the inherited actions follow the brand primary.
  appliedProducts.button.bgColor = isDefaultValue(originalProducts.button.bgColor, defaultProducts.button.bgColor)
    ? (hasCustomPrimary ? primary : appliedProducts.button.bgColor) : originalProducts.button.bgColor;
  appliedProducts.featuredProductConfig.ctaColor = isDefaultValue(originalProducts.featuredProductConfig.ctaColor, defaultProducts.featuredProductConfig.ctaColor)
    ? (hasCustomPrimary ? primary : appliedProducts.featuredProductConfig.ctaColor) : originalProducts.featuredProductConfig.ctaColor;
  return result;
}

export function resolvePrintDesignBranding(branding: BrandingData): BrandingData {
  const preset = getPrintDesignPreset(branding.themeId);
  return preset && !branding.themeSettings.visualThemePresetId && !branding.themeSettings.visualStyleId
    ? applyPrintDesignPreset(branding, preset.id)
    : branding;
}

/** A draft-only visual patch. Product IDs, amounts, content, navigation and tenant identity survive. */
export function applyPrintDesignPreset(draft: BrandingData, id: string): BrandingData {
  const preset = getPrintDesignPreset(id);
  if (!preset) return draft;
  const primary = '#087FC5';
  const heading = '#0B1933';
  const oldPreset = getPrintDesignPreset(draft.themeId);
  const themeSettings = { ...draft.themeSettings };
  delete themeSettings.inheritedPrintDesignId;
  const previousTitle = draft.hero.overlay.title;
  // Keep authored copy. Replace only stock copy from this collection or the old default.
  const replaceHero = !previousTitle || previousTitle === oldPreset?.title || ['Billige tryksager online', 'Velkommen til WebPrinter'].includes(previousTitle);
  return {
    ...draft,
    themeId: preset.id,
    themeSettings: { ...themeSettings, visualStyleId: preset.id, visualThemePresetId: preset.id, printPreviousHeroImages: themeSettings.printPreviousHeroImages || draft.hero.images },
    fonts: { heading: 'Inter', body: 'Inter', pricing: 'Inter' },
    colors: { ...draft.colors, primary, secondary: '#EFF6FC', background: '#FFFFFF', backgroundType: 'solid', card: '#FFFFFF', headingText: heading, bodyText: '#4B5565', pricingText: primary, linkText: primary },
    header: { ...draft.header, fontId: 'Inter', logoFont: 'Inter', style: 'solid', bgOpacity: 1, bgColor: preset.blueHeader ? primary : '#FFFFFF', textColor: preset.blueHeader ? '#FFFFFF' : heading, logoTextColor: preset.blueHeader ? '#FFFFFF' : heading, hoverTextColor: preset.blueHeader ? '#FFFFFF' : primary, transparentOverHero: false, height: 'md', menuFontSizePx: 16, logoHeightPx: 40, dropdownPreset: resolveDropdownPreset(draft.header.dropdownPreset), dropdownBgColor: '#FFFFFF', dropdownBgOpacity: 1, dropdownBorderRadiusPx: 8, dropdownImageRadiusPx: 4, scroll: { ...draft.header.scroll, hideOnScroll: false, fadeOnScroll: false, shrinkOnScroll: false } },
    hero: { ...draft.hero, images: preset.hero ? [{ ...draft.hero.images[0], id: 'print-design-hero', url: `/design-presets/${preset.hero}-hero.webp`, sortOrder: 0 }] : draft.hero.images, overlay: { ...draft.hero.overlay, ...(replaceHero ? { title: preset.title, subtitle: preset.subtitle } : {}),  } },
    forside: { ...draft.forside, productsSection: { ...draft.forside.productsSection, button: { ...draft.forside.productsSection.button, bgColor: primary, textColor: '#FFFFFF', font: 'Inter', animation: 'lift' }, card: { ...draft.forside.productsSection.card, titleFont: 'Inter', bodyFont: 'Inter', priceFont: 'Inter' }, featuredProductConfig: { ...draft.forside.productsSection.featuredProductConfig, cardStyle: 'default', overlapPx: 0, boxScalePct: 100, imageScalePct: 100, imageMode: 'contain', sidePanel: { ...draft.forside.productsSection.featuredProductConfig.sidePanel, enabled: false }, borderRadiusPx: 8, ctaColor: primary, ctaTextColor: '#FFFFFF', ctaBorderRadiusPx: 6 } } },
  };
}
