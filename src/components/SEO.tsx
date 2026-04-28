
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useShopSettings } from '@/hooks/useShopSettings';
import { isPlatformHost } from '@/lib/platform-seo/types';
import { PLATFORM_META_PATHS } from '@/lib/platform-seo/metadata';
import {
    DEFAULT_ROOT_DOMAIN,
    MASTER_TENANT_ID,
    normalizeStorefrontPathname,
    shouldUseTenantStorefrontSeo,
    type StorefrontSettings,
} from '@/lib/storefront/seo';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    structuredData?: object;
}

export function SEO({
    title: defaultTitle = 'Webprinter.dk – Danmarks billigste tryksager √ bannere √ print',
    description: defaultDescription = 'Få professionelt tryk af foldere, flyers og visitkort til markedets bedste priser. Hurtig levering og høj kvalitet.',
    image: defaultImage = '/og-image.png',
    type = 'website',
    structuredData
}: SEOProps) {
    const location = useLocation();
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const { data: shopSettings } = useShopSettings();
    const settings = (shopSettings || {}) as StorefrontSettings;
    const normalizedPathname = normalizeStorefrontPathname(location.pathname);
    const [metadata, setMetadata] = useState({
        title: defaultTitle,
        description: defaultDescription,
        image: defaultImage,
        structuredData: structuredData
    });

    const platformManagedRoute = isPlatformHost(hostname) && PLATFORM_META_PATHS.has(normalizedPathname);
    const tenantScopedSeo = shouldUseTenantStorefrontSeo({
        settings,
        hostname,
        rootDomain: import.meta.env.VITE_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN,
    });

    useEffect(() => {
        if (platformManagedRoute) return;

        // Reset to defaults when location changes, then fetch overrides
        setMetadata({
            title: defaultTitle,
            description: defaultDescription,
            image: defaultImage,
            structuredData: structuredData
        });

        const fetchSEO = async () => {
            let query = supabase
                .from('page_seo' as any)
                .select('*')
                .eq('slug', normalizedPathname);

            if (tenantScopedSeo && settings.id) {
                query = query.eq('tenant_id', settings.id);
            } else {
                query = query.eq('tenant_id', MASTER_TENANT_ID);
            }

            const { data, error } = await query.maybeSingle();

            const typedData = data as any;

            if (error) {
                console.warn('[SEO] Could not load page_seo row', { path: normalizedPathname, error });
                return;
            }

            if (typedData) {
                setMetadata({
                    title: typedData.title || defaultTitle,
                    description: typedData.meta_description || defaultDescription,
                    image: typedData.og_image_url || defaultImage,
                    structuredData: typedData.structured_data || structuredData
                });
            }
        };

        fetchSEO();
    }, [
        normalizedPathname,
        defaultTitle,
        defaultDescription,
        defaultImage,
        structuredData,
        platformManagedRoute,
        tenantScopedSeo,
        settings.id,
    ]);

    if (platformManagedRoute) {
        return null;
    }

    if (tenantScopedSeo) {
        return null;
    }

    const siteUrl = window.location.origin;
    const currentUrl = `${siteUrl}${normalizedPathname}`;

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{metadata.title}</title>
            <meta name="description" content={metadata.description} />
            <link rel="canonical" href={currentUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={metadata.title} />
            <meta property="og:description" content={metadata.description} />
            <meta property="og:image" content={metadata.image.startsWith('http') ? metadata.image : `${siteUrl}${metadata.image}`} />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={currentUrl} />
            <meta property="twitter:title" content={metadata.title} />
            <meta property="twitter:description" content={metadata.description} />
            <meta property="twitter:image" content={metadata.image.startsWith('http') ? metadata.image : `${siteUrl}${metadata.image}`} />

            {/* Structured Data (JSON-LD) */}
            {metadata.structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(metadata.structuredData)}
                </script>
            )}
        </Helmet>
    );
}
