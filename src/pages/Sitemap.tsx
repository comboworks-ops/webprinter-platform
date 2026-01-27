import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Product {
    slug: string;
    updated_at?: string;
}

/**
 * Dynamic Sitemap Generator
 * Access at /sitemap.xml - serves XML sitemap for search engines
 */
export default function Sitemap() {
    const [xml, setXml] = useState<string>('');

    useEffect(() => {
        const generateSitemap = async () => {
            const baseUrl = 'https://webprinter.dk';
            const today = new Date().toISOString().split('T')[0];

            // Static pages
            const staticPages = [
                { url: '/', priority: '1.0', changefreq: 'daily' },
                { url: '/produkter', priority: '0.9', changefreq: 'daily' },
                { url: '/shop', priority: '0.9', changefreq: 'daily' },
                { url: '/om-os', priority: '0.5', changefreq: 'monthly' },
                { url: '/kontakt', priority: '0.5', changefreq: 'monthly' },
                { url: '/betingelser', priority: '0.3', changefreq: 'yearly' },
            ];

            // Fetch products from database
            const { data: products } = await supabase
                .from('products')
                .select('slug, updated_at');

            const productPages = (products || []).map((p: Product) => ({
                url: `/produkt/${p.slug}`,
                priority: '0.8',
                changefreq: 'weekly',
                lastmod: p.updated_at ? p.updated_at.split('T')[0] : today
            }));

            const allPages = [...staticPages, ...productPages];

            const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${(page as any).lastmod || today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

            setXml(sitemapXml);
        };

        generateSitemap();
    }, []);

    // Return raw XML
    if (!xml) {
        return <div>Generating sitemap...</div>;
    }

    return (
        <pre style={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            padding: '20px',
            background: '#f5f5f5'
        }}>
            {xml}
        </pre>
    );
}
