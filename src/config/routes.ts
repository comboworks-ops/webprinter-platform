/**
 * Centralized Routes Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all public-facing pages.
 * 
 * When adding a new page:
 * 1. Add the route config here
 * 2. Import the component in App.tsx
 * 3. The SEO Manager will automatically pick it up
 * 
 * NOTE: Dynamic routes (like /produkt/:slug) are handled separately via product data
 */

export interface RouteConfig {
    /** URL path (e.g. '/om-os') */
    path: string;
    /** Display title for SEO and admin (e.g. 'Om Os') */
    title: string;
    /** Whether this page should appear in SEO Manager */
    showInSeoManager: boolean;
    /** Whether this page should appear in sitemap */
    showInSitemap: boolean;
    /** Category for grouping in admin (optional) */
    category?: 'main' | 'account' | 'admin' | 'system' | 'info';
}

/**
 * All public-facing pages
 * These are automatically synced with SEO Manager
 */
export const PUBLIC_ROUTES: RouteConfig[] = [
    // Main Pages
    { path: '/', title: 'Forside', showInSeoManager: true, showInSitemap: true, category: 'main' },
    { path: '/shop', title: 'Shop', showInSeoManager: true, showInSitemap: true, category: 'main' },
    { path: '/produkter', title: 'Produkter', showInSeoManager: true, showInSitemap: true, category: 'main' },
    { path: '/prisberegner', title: 'Prisberegner', showInSeoManager: true, showInSitemap: true, category: 'main' },

    // Info Pages
    { path: '/om-os', title: 'Om Os', showInSeoManager: true, showInSitemap: true, category: 'info' },
    { path: '/kontakt', title: 'Kontakt', showInSeoManager: true, showInSitemap: true, category: 'info' },
    { path: '/betingelser', title: 'Handelsbetingelser', showInSeoManager: true, showInSitemap: true, category: 'info' },
    { path: '/grafisk-vejledning', title: 'Grafisk Vejledning', showInSeoManager: true, showInSitemap: true, category: 'info' },

    // Account Pages (logged-in users)
    { path: '/auth', title: 'Log ind', showInSeoManager: true, showInSitemap: false, category: 'account' },
    { path: '/profil', title: 'Min Profil', showInSeoManager: false, showInSitemap: false, category: 'account' },
    { path: '/min-konto', title: 'Min Konto', showInSeoManager: false, showInSitemap: false, category: 'account' },
    { path: '/min-konto/ordrer', title: 'Mine Ordrer', showInSeoManager: false, showInSitemap: false, category: 'account' },
    { path: '/min-konto/adresser', title: 'Mine Adresser', showInSeoManager: false, showInSitemap: false, category: 'account' },
    { path: '/min-konto/indstillinger', title: 'Indstillinger', showInSeoManager: false, showInSitemap: false, category: 'account' },
    { path: '/mine-ordrer', title: 'Mine Ordrer', showInSeoManager: false, showInSitemap: false, category: 'account' },

    // System Pages (not shown in SEO manager)
    { path: '/opret-shop', title: 'Opret Shop', showInSeoManager: false, showInSitemap: false, category: 'system' },
    { path: '/platform', title: 'Platform', showInSeoManager: false, showInSitemap: false, category: 'system' },
    { path: '/local-tenant', title: 'Local Tenant', showInSeoManager: false, showInSitemap: false, category: 'system' },
    { path: '/preview', title: 'Preview', showInSeoManager: false, showInSitemap: false, category: 'system' },
    { path: '/preview-shop', title: 'Preview Shop', showInSeoManager: false, showInSitemap: false, category: 'system' },
    { path: '/sitemap.xml', title: 'Sitemap', showInSeoManager: false, showInSitemap: false, category: 'system' },

    // Admin Pages
    { path: '/admin/login', title: 'Admin Login', showInSeoManager: false, showInSitemap: false, category: 'admin' },
];

/**
 * Get routes for SEO Manager
 * Filters to only show pages that should appear in SEO admin
 */
export function getSeoManagerRoutes(): { slug: string; title: string }[] {
    return PUBLIC_ROUTES
        .filter(route => route.showInSeoManager)
        .map(route => ({
            slug: route.path,
            title: route.title
        }));
}

/**
 * Get routes for Sitemap
 * Filters to only show pages that should appear in public sitemap
 */
export function getSitemapRoutes(): RouteConfig[] {
    return PUBLIC_ROUTES.filter(route => route.showInSitemap);
}

/**
 * Get routes by category
 */
export function getRoutesByCategory(category: RouteConfig['category']): RouteConfig[] {
    return PUBLIC_ROUTES.filter(route => route.category === category);
}
