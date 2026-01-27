/**
 * Platform SEO Types
 * 
 * Types for the Platform SEO & Analytics Center.
 * Only applies to webprinter.dk / www.webprinter.dk
 */

export interface PlatformSeoLocale {
    locale: string;      // e.g. "da-DK"
    lang: string;        // e.g. "da"
    isDefault: boolean;
    pathPrefix: string;  // e.g. "" or "/en"
}

export interface PlatformSeoSettings {
    id: string;
    tenant_id: string;
    primary_domain: string;
    alternate_domains: string[];
    canonical_base_url: string;
    default_title_template: string;
    default_description: string;
    default_robots: string;
    default_og_image_url: string | null;
    organization_jsonld: Record<string, unknown> | null;
    website_jsonld: Record<string, unknown> | null;
    locales: PlatformSeoLocale[];
    updated_at: string;
}

export interface PlatformSeoPage {
    id: string;
    tenant_id: string;
    path: string;
    locale: string | null;
    title: string | null;
    description: string | null;
    robots: string | null;
    canonical_url: string | null;
    og_title: string | null;
    og_description: string | null;
    og_image_url: string | null;
    jsonld: Record<string, unknown> | null;
    lastmod: string | null;
    updated_at: string;
}

export interface PlatformSeoPagespeedSnapshot {
    id: string;
    tenant_id: string;
    url: string;
    strategy: 'mobile' | 'desktop';
    lighthouse: {
        performance?: number;
        accessibility?: number;
        bestPractices?: number;
        seo?: number;
        pwa?: number;
        audits?: Record<string, unknown>;
    };
    created_at: string;
}

export interface PlatformSeoGoogleIntegration {
    id: string;
    tenant_id: string;
    refresh_token: string | null;
    connected_at: string | null;
    updated_at: string;
}

// Computed SEO data for a page
export interface ComputedPlatformSeo {
    title: string;
    description: string;
    robots: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    ogImageUrl: string | null;
    ogUrl: string;
    ogSiteName: string;
    hreflangTags: { lang: string; href: string }[];
    jsonLd: Record<string, unknown>[];
}

// Platform page paths for SEO management
export const PLATFORM_PAGES = [
    { path: '/', label: 'Forside' },
    { path: '/platform', label: 'Platform' },
    { path: '/priser', label: 'Priser' },
    { path: '/white-label', label: 'White Label' },
    { path: '/beregning', label: 'Prisberegning' },
    { path: '/order-flow', label: 'Ordre Workflow' },
    { path: '/online-designer', label: 'Online Designer' },
    { path: '/om-os', label: 'Om Os' },
    { path: '/kontakt', label: 'Kontakt' },
    { path: '/privacy-policy', label: 'Privatlivspolitik' },
    { path: '/handelsbetingelser', label: 'Handelsbetingelser' },
    { path: '/cookiepolitik', label: 'Cookiepolitik' },
    { path: '/auth', label: 'Login' },
    { path: '/opret-shop', label: 'Opret Shop' },
] as const;

// Platform hostnames that this SEO system applies to
export const PLATFORM_HOSTNAMES = ['webprinter.dk', 'www.webprinter.dk', 'localhost'];

// Check if current hostname is a platform host
export function isPlatformHost(hostname: string): boolean {
    return PLATFORM_HOSTNAMES.some(h => hostname === h || hostname.startsWith('localhost'));
}

// Check if path is excluded from platform SEO (demo routes)
export function isExcludedPath(pathname: string): boolean {
    return pathname.startsWith('/demo');
}
