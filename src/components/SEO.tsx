
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
    const [metadata, setMetadata] = useState({
        title: defaultTitle,
        description: defaultDescription,
        image: defaultImage,
        structuredData: structuredData
    });

    useEffect(() => {
        // Reset to defaults when location changes, then fetch overrides
        setMetadata({
            title: defaultTitle,
            description: defaultDescription,
            image: defaultImage,
            structuredData: structuredData
        });

        const fetchSEO = async () => {
            const { data, error } = await supabase
                .from('page_seo' as any)
                .select('*')
                .eq('slug', location.pathname)
                .single();

            const typedData = data as any;

            if (typedData && !error) {
                setMetadata({
                    title: typedData.title || defaultTitle,
                    description: typedData.meta_description || defaultDescription,
                    image: typedData.og_image_url || defaultImage,
                    structuredData: typedData.structured_data || structuredData
                });
            }
        };

        fetchSEO();
    }, [location.pathname, defaultTitle, defaultDescription, defaultImage, structuredData]);

    const siteUrl = window.location.origin;
    const currentUrl = `${siteUrl}${location.pathname}`;

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
