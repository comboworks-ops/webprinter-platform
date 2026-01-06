/**
 * PlatformSeoHead Component
 * 
 * Injects SEO meta tags into document head for PLATFORM pages only.
 * Only active on webprinter.dk / www.webprinter.dk
 * Excludes /demo routes.
 * 
 * This is idempotent - updates tags in-place without duplicates.
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    isPlatformHost,
    isExcludedPath,
    type PlatformSeoSettings,
    type PlatformSeoPage,
    type ComputedPlatformSeo,
} from '@/lib/platform-seo/types';

// Default SEO values if no database settings exist
const DEFAULT_SEO: Omit<ComputedPlatformSeo, 'hreflangTags' | 'jsonLd'> = {
    title: 'Webprinter Platform',
    description: 'Den komplette løsning til moderne trykkerier.',
    robots: 'index,follow',
    canonicalUrl: '',
    ogTitle: 'Webprinter Platform',
    ogDescription: 'Den komplette løsning til moderne trykkerier.',
    ogImageUrl: null,
    ogUrl: '',
    ogSiteName: 'Webprinter.dk',
};

/**
 * Set or update a meta tag
 */
function setMetaTag(name: string, content: string, isProperty = false) {
    const attr = isProperty ? 'property' : 'name';
    let element = document.querySelector(`meta[${attr}="${name}"]`);

    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
    }

    element.setAttribute('content', content);
}

/**
 * Set or update a link tag
 */
function setLinkTag(rel: string, href: string, hreflang?: string) {
    const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]:not([hreflang])`;

    let element = document.querySelector(selector);

    if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        if (hreflang) {
            element.setAttribute('hreflang', hreflang);
        }
        document.head.appendChild(element);
    }

    element.setAttribute('href', href);
}

/**
 * Remove all existing hreflang links (to refresh them)
 */
function clearHreflangLinks() {
    const links = document.querySelectorAll('link[rel="alternate"][hreflang]');
    links.forEach(link => link.remove());
}

/**
 * Set or update JSON-LD script
 */
function setJsonLd(id: string, data: Record<string, unknown>) {
    let element = document.querySelector(`script[data-jsonld-id="${id}"]`);

    if (!element) {
        element = document.createElement('script');
        element.setAttribute('type', 'application/ld+json');
        element.setAttribute('data-jsonld-id', id);
        document.head.appendChild(element);
    }

    element.textContent = JSON.stringify(data);
}

/**
 * Compute SEO data from settings and page override
 */
function computeSeo(
    settings: PlatformSeoSettings | null,
    pageOverride: PlatformSeoPage | null,
    pathname: string,
    hostname: string
): ComputedPlatformSeo {
    const baseUrl = settings?.canonical_base_url || `https://${hostname}`;
    const titleTemplate = settings?.default_title_template || '{pageTitle} | Webprinter Platform';

    // Get page-specific title or generate from path
    const pageTitle = pageOverride?.title || getDefaultPageTitle(pathname);
    const title = titleTemplate.replace('{pageTitle}', pageTitle);

    const description = pageOverride?.description || settings?.default_description || DEFAULT_SEO.description;
    const robots = pageOverride?.robots || settings?.default_robots || DEFAULT_SEO.robots;
    const canonicalUrl = pageOverride?.canonical_url || `${baseUrl}${pathname === '/' ? '' : pathname}`;

    const ogTitle = pageOverride?.og_title || pageTitle;
    const ogDescription = pageOverride?.og_description || description;
    const ogImageUrl = pageOverride?.og_image_url || settings?.default_og_image_url || null;

    // Generate hreflang tags
    const locales = settings?.locales || [{ locale: 'da-DK', lang: 'da', isDefault: true, pathPrefix: '' }];
    const hreflangTags = locales.map(loc => ({
        lang: loc.locale,
        href: `${baseUrl}${loc.pathPrefix}${pathname === '/' ? '' : pathname}`,
    }));

    // Add x-default
    const defaultLocale = locales.find(l => l.isDefault);
    if (defaultLocale) {
        hreflangTags.push({
            lang: 'x-default',
            href: `${baseUrl}${defaultLocale.pathPrefix}${pathname === '/' ? '' : pathname}`,
        });
    }

    // Collect JSON-LD data
    const jsonLd: Record<string, unknown>[] = [];

    if (settings?.organization_jsonld) {
        jsonLd.push(settings.organization_jsonld);
    }

    if (settings?.website_jsonld) {
        jsonLd.push(settings.website_jsonld);
    }

    if (pageOverride?.jsonld) {
        jsonLd.push(pageOverride.jsonld);
    }

    return {
        title,
        description,
        robots,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImageUrl,
        ogUrl: canonicalUrl,
        ogSiteName: 'Webprinter.dk',
        hreflangTags,
        jsonLd,
    };
}

/**
 * Get default page title from pathname
 */
function getDefaultPageTitle(pathname: string): string {
    const titleMap: Record<string, string> = {
        '/': 'Forside',
        '/platform': 'Platform',
        '/priser': 'Priser',
        '/white-label': 'White Label Webshop',
        '/beregning': 'Smart Prisberegning',
        '/order-flow': 'Ordre Workflow',
        '/online-designer': 'Online Designer',
        '/om-os': 'Om Os',
        '/kontakt': 'Kontakt',
        '/privacy-policy': 'Privatlivspolitik',
        '/handelsbetingelser': 'Handelsbetingelser',
        '/cookiepolitik': 'Cookiepolitik',
        '/auth': 'Log Ind',
        '/opret-shop': 'Start Din Webshop',
    };

    return titleMap[pathname] || 'Webprinter Platform';
}

/**
 * PlatformSeoHead Component
 */
export function PlatformSeoHead() {
    const location = useLocation();
    const hostname = window.location.hostname;
    const pathname = location.pathname;

    // Only run on platform hosts and non-excluded paths
    const shouldApply = isPlatformHost(hostname) && !isExcludedPath(pathname);

    // Fetch settings (only if should apply)
    const { data: settings } = useQuery({
        queryKey: ['platform-seo-head-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('platform_seo_settings')
                .select('*')
                .single();

            if (error && error.code !== 'PGRST116') {
                console.warn('Platform SEO settings fetch error:', error);
                return null;
            }

            return data as PlatformSeoSettings | null;
        },
        enabled: shouldApply,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Fetch page-specific override
    const { data: pageOverride } = useQuery({
        queryKey: ['platform-seo-head-page', pathname],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('platform_seo_pages')
                .select('*')
                .eq('path', pathname)
                .is('locale', null)
                .single();

            if (error && error.code !== 'PGRST116') {
                // Not found is OK
                return null;
            }

            return data as PlatformSeoPage | null;
        },
        enabled: shouldApply,
        staleTime: 5 * 60 * 1000,
    });

    // Apply SEO to document head
    const applySeo = useCallback((seo: ComputedPlatformSeo) => {
        // Title
        document.title = seo.title;

        // Meta tags
        setMetaTag('description', seo.description);
        setMetaTag('robots', seo.robots);

        // Open Graph tags
        setMetaTag('og:title', seo.ogTitle, true);
        setMetaTag('og:description', seo.ogDescription, true);
        setMetaTag('og:url', seo.ogUrl, true);
        setMetaTag('og:site_name', seo.ogSiteName, true);
        setMetaTag('og:type', 'website', true);

        if (seo.ogImageUrl) {
            setMetaTag('og:image', seo.ogImageUrl, true);
        }

        // Canonical
        setLinkTag('canonical', seo.canonicalUrl);

        // Hreflang
        clearHreflangLinks();
        seo.hreflangTags.forEach(({ lang, href }) => {
            setLinkTag('alternate', href, lang);
        });

        // JSON-LD
        seo.jsonLd.forEach((data, index) => {
            setJsonLd(`platform-seo-${index}`, data);
        });
    }, []);

    useEffect(() => {
        if (!shouldApply) return;

        const seo = computeSeo(settings ?? null, pageOverride ?? null, pathname, hostname);
        applySeo(seo);
    }, [shouldApply, settings, pageOverride, pathname, hostname, applySeo]);

    // This component doesn't render anything visible
    return null;
}

export default PlatformSeoHead;
