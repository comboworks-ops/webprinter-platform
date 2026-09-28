import type { FeaturedProductConfig, FeaturedProductSlide, FeaturedProductSlideConfig } from '../../hooks/useBrandingDraft';

export const FIRST_FEATURED_SLIDE = 'featured-first';

export function featuredSlideConfig(config: FeaturedProductConfig): FeaturedProductSlideConfig {
  const { slides: _slides, presentation: _presentation, ...settings } = config;
  return structuredClone(settings);
}

/** Old single-product settings remain the first slide, without rewriting stored designs. */
export function getFeaturedSlides(config?: FeaturedProductConfig): FeaturedProductSlide[] {
  if (!config) return [];
  const seen = new Set([FIRST_FEATURED_SLIDE]);
  return [{ id: FIRST_FEATURED_SLIDE, config: featuredSlideConfig(config) }, ...(config.slides || []).filter(slide => {
    if (!slide?.id || !slide.config || seen.has(slide.id)) return false;
    seen.add(slide.id);
    return true;
  })];
}

export function updateFeaturedSlide(config: FeaturedProductConfig, id: string, patch: Partial<FeaturedProductSlideConfig>): FeaturedProductConfig {
  if (id === FIRST_FEATURED_SLIDE) return { ...config, ...patch };
  return { ...config, slides: (config.slides || []).map(slide => slide.id === id ? { ...slide, config: { ...slide.config, ...patch } } : slide) };
}

/** Explicit reorder/removal: promote the first item while retaining global display settings. */
export function setFeaturedSlides(config: FeaturedProductConfig, slides: FeaturedProductSlide[]): FeaturedProductConfig {
  const [first, ...rest] = slides;
  if (!first) return { ...config, productId: undefined, customTitle: '', customDescription: '', customImageUrl: null, galleryEnabled: false, galleryImages: [], sidePanel: { ...config.sidePanel, enabled: false }, slides: [] };
  return { ...first.config, enabled: config.enabled, presentation: config.presentation,
    slides: rest.map(slide => ({ ...slide, id: slide.id === FIRST_FEATURED_SLIDE ? crypto.randomUUID() : slide.id })) };
}

export function hasFeaturedProducts(config?: FeaturedProductConfig): boolean {
  return Boolean(config?.enabled && getFeaturedSlides(config).some(slide => slide.config.productId));
}

export function hiddenFeaturedProductIds(config?: FeaturedProductConfig): string[] {
  if (!config?.enabled) return [];
  return [...new Set(getFeaturedSlides(config).filter(slide => slide.config.productId && slide.config.showInProductList === false).map(slide => slide.config.productId!))];
}

export function styleFeaturedButtons(config: FeaturedProductConfig, patch: Partial<FeaturedProductSlideConfig>): FeaturedProductConfig {
  const apply = (item: FeaturedProductSlideConfig): FeaturedProductSlideConfig => ({ ...item, ...patch,
    sidePanel: { ...item.sidePanel, enabled: item.sidePanel?.enabled ?? false,
      ctaColor: patch.ctaColor, ctaHoverColor: patch.ctaHoverColor, ctaTextColor: patch.ctaTextColor } });
  return { ...config, ...apply(featuredSlideConfig(config)), slides: config.slides?.map(slide => ({ ...slide, config: apply(slide.config) })) };
}
