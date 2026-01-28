// Supabase Edge Function: Platform Sitemap & Robots
// Generates sitemap.xml and robots.txt for platform pages only

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLATFORM_HOSTNAMES = ['webprinter.dk', 'www.webprinter.dk'];
const CANONICAL_BASE = 'https://webprinter.dk';

// Platform pages
const PLATFORM_PAGES = [
    { path: '/', priority: 1.0 },
    { path: '/platform', priority: 0.9 },
    { path: '/priser', priority: 0.9 },
    { path: '/white-label', priority: 0.8 },
    { path: '/beregning', priority: 0.8 },
    { path: '/order-flow', priority: 0.8 },
    { path: '/online-designer', priority: 0.8 },
    { path: '/om-os', priority: 0.6 },
    { path: '/kontakt', priority: 0.7 },
    { path: '/privacy-policy', priority: 0.4 },
    { path: '/handelsbetingelser', priority: 0.4 },
    { path: '/cookiepolitik', priority: 0.4 },
    { path: '/auth', priority: 0.5 },
    { path: '/opret-shop', priority: 0.7 },
];

serve(async (req) => {
    const url = new URL(req.url);
    const hostname = req.headers.get('host') || '';
    const action = url.searchParams.get('action'); // 'sitemap' or 'robots'

    // Only serve for platform hosts (or allow any in dev)
    const isPlatformHost = PLATFORM_HOSTNAMES.some(h => hostname.includes(h)) ||
        hostname.includes('localhost') ||
        hostname.includes('supabase');

    if (!isPlatformHost && !action) {
        return new Response('Not found', { status: 404 });
    }

    if (action === 'robots' || url.pathname.includes('robots')) {
        return generateRobotsTxt();
    }

    // Default to sitemap
    return generateSitemapXml();
});

function generateSitemapXml(): Response {
    const today = new Date().toISOString().split('T')[0];

    const urlEntries = PLATFORM_PAGES.map(page => `
  <url>
    <loc>${CANONICAL_BASE}${page.path === '/' ? '' : page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

function generateRobotsTxt(): Response {
    const content = `# Webprinter Platform Robots.txt
User-agent: *
Allow: /

# Sitemap
Sitemap: ${CANONICAL_BASE}/sitemap.xml

# Disallow admin and private routes
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /preview-shop/
Disallow: /local-tenant/
`;

    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
