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
}));

/**
 * Get the display label for a slide.
 */
export function getSlideLabel(slide: PlatformSlide): string {
    return slide.label;
}

/**
 * Legacy helper - kept for compatibility but PNG slides don't use WebP.
 */
export function hasWebpSource(_slide: PlatformSlide): boolean {
    return false;
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
