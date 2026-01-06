/**
 * Platform Slider Configuration
 * 
 * This file contains the static configuration for the Platform landing page slider.
 * Images are served from /public/platform/slider/ and are NOT sourced from tenant data.
 * 
 * File naming convention:
 * - {order}-{key}@1x.jpg  (standard resolution)
 * - {order}-{key}@2x.jpg  (retina resolution)
 * - {order}-{key}@1x.webp (optional WebP)
 * - {order}-{key}@2x.webp (optional WebP retina)
 * 
 * Label derivation:
 * - If label is not provided, it's derived from the key:
 *   - Strip numeric prefix (01-)
 *   - Replace hyphens/underscores with spaces
 *   - Title-case the result
 */

export interface PlatformSlide {
    key: string;
    label?: string; // Optional explicit label; derived from key if not provided
    alt: string;
    // NO href - slider is purely visual
    sources: {
        webp1x?: string;
        webp2x?: string;
        jpg1x: string;
        jpg2x: string;
    };
}

/**
 * Derive a display label from the slide key.
 * Example: "01-sales-folders" -> "Sales Folders"
 */
export function deriveLabelFromKey(key: string): string {
    // Strip numeric prefix like "01-"
    const withoutPrefix = key.replace(/^\d+-/, '');
    // Replace hyphens and underscores with spaces
    const withSpaces = withoutPrefix.replace(/[-_]/g, ' ');
    // Title case
    return withSpaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Get the display label for a slide (explicit or derived).
 */
export function getSlideLabel(slide: PlatformSlide): string {
    return slide.label ?? deriveLabelFromKey(slide.key);
}

/**
 * Platform slides configuration.
 * Order is controlled by the array order.
 * NO LINKS - slider is purely visual/decorative.
 */
export const PLATFORM_SLIDES: PlatformSlide[] = [
    {
        key: "01-sales-folders",
        label: "Salgsfoldere",
        alt: "Professionelle salgsfoldere",
        sources: {
            jpg1x: "/platform/slider/01-webshop@1x.jpg",
            jpg2x: "/platform/slider/01-webshop@2x.jpg",
        },
    },
    {
        key: "02-banners",
        label: "Bannere",
        alt: "Store format bannere",
        sources: {
            jpg1x: "/platform/slider/02-designer@1x.jpg",
            jpg2x: "/platform/slider/02-designer@2x.jpg",
        },
    },
    {
        key: "03-business-cards",
        label: "Visitkort",
        alt: "Elegante visitkort",
        sources: {
            jpg1x: "/platform/slider/03-pricing@1x.jpg",
            jpg2x: "/platform/slider/03-pricing@2x.jpg",
        },
    },
    {
        key: "04-flyers",
        label: "Flyers",
        alt: "Professionelle flyers",
        sources: {
            jpg1x: "/platform/slider/04-orders@1x.jpg",
            jpg2x: "/platform/slider/04-orders@2x.jpg",
        },
    },
];

/**
 * Helper to check if a WebP source exists in the config.
 * Returns true if the source string is defined and non-empty.
 */
export function hasWebpSource(slide: PlatformSlide): boolean {
    return !!(slide.sources.webp1x && slide.sources.webp2x);
}
