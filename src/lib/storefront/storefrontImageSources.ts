import { STOREFRONT_IMAGE_VARIANTS } from './storefrontImageManifest.ts';

export type StorefrontImageVariant = 'thumbnail' | 'card' | 'feature';
const WIDTHS = {
  thumbnail: [96, 192],
  card: [192, 320, 480, 640, 960],
  feature: [320, 480, 640, 960, 1280],
};
const DEFAULT_WIDTH = { thumbnail: 192, card: 640, feature: 960 };

/** Only public Supabase raster images and our generated built-in assets qualify.
 * Originals remain available for detail pages, admin editing and error recovery. */
export function getStorefrontImageSources(src: string, variant: StorefrontImageVariant = 'card'): {src: string; srcSet?: string} {
  const widths = WIDTHS[variant];
  // Vite's dev URL and hashed production URL both identify the same built-in art.
  const product = src.match(/^\/(?:src\/assets\/products\/([a-z]+)|assets\/([a-z]+)-[\w-]+)\.png(?:\?.*)?$/);
  const category = src.match(/^\/design-presets\/(category-[a-z]+)\.webp(?:\?.*)?$/);
  const localKey = product ? `products/${product[1] || product[2]}` : category ? `categories/${category[1]}` : '';
  const local = STOREFRONT_IMAGE_VARIANTS[localKey];
  if (local) {
    const candidates = local.filter(item => item.width <= widths[widths.length - 1]);
    const fallback = candidates.find(item => item.width >= DEFAULT_WIDTH[variant]) || candidates[candidates.length - 1];
    return {src: fallback.src, srcSet: candidates.map(item => `${item.src} ${item.width}w`).join(', ')};
  }

  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
      || url.username || url.password || url.searchParams.has('token')
      || !/\/storage\/v1\/(?:object|render\/image)\/public\/.+\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)) return {src};
    url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    // Do not bake a crop into an image reused by differently shaped design sets.
    url.searchParams.delete('height');
    url.searchParams.delete('format');
    url.searchParams.set('quality', '78');
    url.searchParams.set('resize', 'contain');
    const resized = (width: number) => { url.searchParams.set('width', String(width)); return url.toString(); };
    return {src: resized(DEFAULT_WIDTH[variant]), srcSet: widths.map(width => `${resized(width)} ${width}w`).join(', ')};
  } catch {
    return {src};
  }
}
