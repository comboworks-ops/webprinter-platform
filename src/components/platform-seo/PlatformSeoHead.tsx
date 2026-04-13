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
    type ComputedPlatformSeo,
    isPlatformHost,
    isExcludedPath,
    type PlatformSeoSettings,
    type PlatformSeoPage,
} from '@/lib/platform-seo/types';
import { computePlatformSeo } from '@/lib/platform-seo/metadata';

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
 * PlatformSeoHead Component
 */
export function PlatformSeoHead() {
    const location = useLocation();
    const hostname = window.location.hostname;
    const pathname = location.pathname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    // Only run on platform hosts and non-excluded paths
    const shouldApply = !isLocalhost && isPlatformHost(hostname) && !isExcludedPath(pathname);
    const isNoRowsError = (error: any) => {
        const code = String(error?.code || '');
        const details = String(error?.details || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();
        return code === 'PGRST116' || details.includes('0 rows') || message.includes('0 rows');
    };
    const isAbortError = (error: any) => {
        const message = String(error?.message || '').toLowerCase();
        const details = String(error?.details || '').toLowerCase();
        return message.includes('aborterror') || details.includes('aborterror') || message.includes('signal is aborted');
    };
    const isTransportError = (error: any) => {
        const message = String(error?.message || '').toLowerCase();
        const details = String(error?.details || '').toLowerCase();
        const status = Number(error?.status || 0);
        return (
            message.includes('failed to fetch')
            || message.includes('networkerror')
            || details.includes('failed to fetch')
            || details.includes('networkerror')
            || status === 0
            || status === 522
        );
    };

    // Fetch settings (only if should apply)
    const { data: settings } = useQuery({
        queryKey: ['platform-seo-head-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('platform_seo_settings')
                .select('*')
                .maybeSingle();

            if (error && !isNoRowsError(error) && !isAbortError(error) && !isTransportError(error)) {
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
                .maybeSingle();

            if (error && !isNoRowsError(error) && !isAbortError(error) && !isTransportError(error)) {
                console.warn('Platform SEO page fetch error:', error);
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
        setLinkTag('icon', seo.iconUrl);

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

        const seo = computePlatformSeo(settings ?? null, pageOverride ?? null, pathname, hostname);
        applySeo(seo);
    }, [shouldApply, settings, pageOverride, pathname, hostname, applySeo]);

    // This component doesn't render anything visible
    return null;
}

export default PlatformSeoHead;
