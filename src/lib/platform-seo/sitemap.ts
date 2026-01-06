/**
 * Platform Sitemap Generator
 * 
 * Utility functions to generate sitemap XML for platform pages.
 * For production, these should be called from a serverless function.
 */

import { PLATFORM_PAGES } from './types';

export interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}

/**
 * Generate sitemap XML string
 */
export function generateSitemapXml(urls: SitemapUrl[]): string {
    const urlEntries = urls.map(url => `
  <url>
    <loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `
    <lastmod>${url.lastmod}</lastmod>` : ''}${url.changefreq ? `
    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority !== undefined ? `
    <priority>${url.priority.toFixed(1)}</priority>` : ''}
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Generate platform sitemap URLs
 */
export function generatePlatformSitemapUrls(
    baseUrl: string,
    pages: { path: string; lastmod?: string }[]
): SitemapUrl[] {
    return pages.map(page => ({
        loc: `${baseUrl}${page.path === '/' ? '' : page.path}`,
        lastmod: page.lastmod || new Date().toISOString().split('T')[0],
        changefreq: 'weekly' as const,
        priority: page.path === '/' ? 1.0 : 0.8,
    }));
}

/**
 * Generate default platform sitemap
 */
export function generateDefaultPlatformSitemap(baseUrl: string = 'https://webprinter.dk'): string {
    const urls = generatePlatformSitemapUrls(
        baseUrl,
        PLATFORM_PAGES.map(p => ({ path: p.path }))
    );
    return generateSitemapXml(urls);
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(canonicalUrl: string = 'https://webprinter.dk'): string {
    return `# Webprinter Platform Robots.txt
User-agent: *
Allow: /

# Sitemap
Sitemap: ${canonicalUrl}/sitemap.xml

# Disallow admin and private routes
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /preview-shop/
`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
