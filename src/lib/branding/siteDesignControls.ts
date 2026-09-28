import { styleFeaturedButtons } from './featuredProductPresentation.ts';
import type { BrandingData, HeroButton, HeroSettings } from '@/hooks/useBrandingDraft';
import { DEFAULT_DROPDOWN_PRESET } from './dropdownPresets.ts';
import { DEFAULT_STOREFRONT_LAYOUT } from '../storefront/shopTemplates.ts';
import { applyPrintDesignPreset, DEFAULT_PRINT_DESIGN_ID, getPrintDesignPreset } from './printDesignPresets.ts';

/** Adapt the print composition to the existing banner engine without storing fallback copy. */
export function resolvePrintHero(draft: BrandingData): HeroSettings {
  const preset = getPrintDesignPreset(draft.themeId);
  const hero = draft.hero;
  if (!preset) return hero;
  const stockTitle = ['Billige tryksager online', 'Velkommen til WebPrinter'].includes(hero.overlay.title);
  const stockButtons = hero.overlay.buttons?.length === 2
    && hero.overlay.buttons[0].id === 'default-cta-1' && hero.overlay.buttons[0].label === 'Se produkter'
    && hero.overlay.buttons[1].id === 'default-cta-2' && hero.overlay.buttons[1].label === 'Kontakt os';
  const buttons: HeroButton[] = stockButtons ? (preset.id === 'print-precise' ? [] : [{
    ...hero.overlay.buttons[0], label: preset.action, bgColor: draft.colors.primary, linkType: 'ALL_PRODUCTS',
  }]) : hero.overlay.buttons;
  // Old print presets copied hidden per-slide demo text along with the image.
  // Shared text is the default for this collection; per-slide text is an explicit choice.
  const images = [...hero.images].sort((a, b) => a.sortOrder - b.sortOrder).map(image => hero.textSource === 'slides' ? image : {
    ...image, headline: undefined, subline: undefined, buttons: undefined, ctaText: undefined, ctaLink: undefined,
  });
  return { ...hero, images, overlay: { ...hero.overlay,
    ...(stockTitle ? { title: preset.title, subtitle: preset.subtitle } : {}), buttons,
  } };
}

export interface MainButtonSettings { bgColor: string; hoverBgColor: string; textColor: string; radiusPx: number; fontSizePx: number; paddingYPx: number; }
export function getMainButtonSettings(draft: BrandingData): MainButtonSettings {
  const buttons = draft.productPage.orderButtons;
  return { bgColor: buttons.primary.bgColor || draft.colors.primary, hoverBgColor: buttons.primary.hoverBgColor || draft.colors.hover || draft.colors.primary,
    textColor: buttons.primary.textColor || '#FFFFFF', radiusPx: buttons.radiusPx, fontSizePx: buttons.fontSizePx, paddingYPx: buttons.paddingYPx };
}

/** An explicit apply-to-all operation on existing visual fields. No links, products or amounts change. */
export function applyMainButtonSettings(draft: BrandingData, settings: MainButtonSettings): Partial<BrandingData> {
  const styleButton = (button: HeroButton) => button.variant === 'secondary' ? button : {
    ...button, bgColor: settings.bgColor, bgHoverColor: settings.hoverBgColor, textColor: settings.textColor,
  };
  const hero = resolvePrintHero(draft);
  const products = draft.forside.productsSection;
  const productButton = { ...products.button, bgColor: settings.bgColor, hoverBgColor: settings.hoverBgColor,
    textColor: settings.textColor, hoverTextColor: settings.textColor, borderRadiusPx: settings.radiusPx,
    fontSizePx: settings.fontSizePx, paddingYPx: settings.paddingYPx,
    gradientStart: settings.bgColor, gradientEnd: settings.bgColor,
    hoverGradientStart: settings.hoverBgColor, hoverGradientEnd: settings.hoverBgColor,
  };
  return {
    hero: { ...hero, overlay: { ...hero.overlay, buttons: hero.overlay.buttons.map(styleButton) },
      // Preserve all authored per-slide content even when shared text is currently selected.
      images: draft.hero.images.map(image => ({ ...image, ...(image.buttons ? { buttons: image.buttons.map(styleButton) } : {}) })) },
    forside: { ...draft.forside, productsSection: { ...products,
      button: productButton,
      featuredProductConfig: styleFeaturedButtons(products.featuredProductConfig, { ctaColor: settings.bgColor, ctaHoverColor: settings.hoverBgColor, ctaTextColor: settings.textColor, ctaBorderRadiusPx: settings.radiusPx, ctaFontSizePx: settings.fontSizePx, ctaPaddingYPx: settings.paddingYPx }),
    } },
    productPage: { ...draft.productPage, orderButtons: { ...draft.productPage.orderButtons,
      radiusPx: settings.radiusPx, fontSizePx: settings.fontSizePx, paddingYPx: settings.paddingYPx,
      primary: { ...draft.productPage.orderButtons.primary, bgColor: settings.bgColor, hoverBgColor: settings.hoverBgColor,
        textColor: settings.textColor, hoverTextColor: settings.textColor, borderColor: settings.bgColor, hoverBorderColor: settings.hoverBgColor,
        gradientStart: settings.bgColor, gradientEnd: settings.bgColor, hoverGradientStart: settings.hoverBgColor, hoverGradientEnd: settings.hoverBgColor },
    } },
  };
}

/** Restore the standard presentation as an unsaved draft, retaining shop content and product selections. */
export function standardSiteDesign(draft: BrandingData): BrandingData {
  const standard = applyPrintDesignPreset({ ...draft, forside: { ...draft.forside,
    layout: { ...DEFAULT_STOREFRONT_LAYOUT },
    productsSection: { ...draft.forside.productsSection, presentation: 'standard' },
  } }, DEFAULT_PRINT_DESIGN_ID);
  const buttons = applyMainButtonSettings(standard, { bgColor: '#087FC5', hoverBgColor: '#066BA8', textColor: '#FFFFFF', radiusPx: 6, fontSizePx: 16, paddingYPx: 14 });
  return { ...standard, ...buttons,
    themeSettings: { ...standard.themeSettings, dropdownColorsCustomized: false },
    header: { ...standard.header, dropdownPreset: DEFAULT_DROPDOWN_PRESET, dropdownCategoryColor: '#6B7280', dropdownProductColor: '#1F2937', dropdownHoverColor: '#EFF6FC' },
    hero: { ...buttons.hero!, mediaType: 'images', parallax: false, heightPx: undefined, overlay_opacity: 0, textSource: 'shared',
    videoSettings: { ...standard.hero.videoSettings, parallaxEnabled: false },
    overlay: { ...buttons.hero!.overlay, titleColor: '#FFFFFF', subtitleColor: '#FFFFFF', titleFontId: 'Inter', subtitleFontId: 'Inter' },
  } };
}

export function dropdownBackground(color: string, opacity: number): string {
  const hex = /^#[\da-f]{6}$/i.test(color) ? color : '#FFFFFF';
  const values = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  return `rgba(${values.join(', ')}, ${Math.min(1, Math.max(0, opacity))})`;
}
