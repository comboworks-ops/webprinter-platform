/**
 * Platform Slider Configuration
 * 
 * This file contains the static configuration for the Platform landing page slider.
 * Images are served from /public/platform/slider/ and are NOT sourced from tenant data.
 * 
 * Label is derived from the filename (without .png extension).
 * NO LINKS - slider is purely visual/decorative.
 */

export interface PlatformSlide {
    key: string;
    label: string;
    alt: string;
    src: string;
    webpSrc?: string;
}

/**
 * Platform slides configuration.
 * Label is derived from filename (without .png).
 * NO LINKS - slider is purely visual/decorative.
 */
export const PLATFORM_SLIDES: PlatformSlide[] = [
    "Bannere",
    "Beachflags",
    "Blokke",
    "Bogtryk",
    "Emballagetryk",
    "Flag",
    "Folder",
    "Foldere",
    "Gadeskilte",
    "Hæfter",
    "Magasiner",
    "Messeudstyr",
    "Roll-up",
    "Salgsmapper",
    "Skilteplancher",
    "Stickers",
    "Tekstiltryk",
    "Visitkort",
].map(name => ({
    key: name.toLowerCase().replace(/[æøå]/g, c => ({ 'æ': 'ae', 'ø': 'oe', 'å': 'aa' }[c] || c)),
    label: name,
    alt: name,
    src: `/platform/slider/${name}.png`,
    webpSrc: `/platform/slider/${name}.webp`,
}));

/**
 * Get the display label for a slide.
 */
export function getSlideLabel(slide: PlatformSlide): string {
    return slide.label;
}

/**
 * Whether an optimized WebP derivative is available; PNGs remain the fallback.
 */
export function hasWebpSource(slide: PlatformSlide): boolean {
    return Boolean(slide.webpSrc);
}

/**
 * Legacy helper - derive label from key (kept for compatibility).
 */
export function deriveLabelFromKey(key: string): string {
    const withoutPrefix = key.replace(/^\d+-/, '');
    const withSpaces = withoutPrefix.replace(/[-_]/g, ' ');
    return withSpaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
