import { Helmet } from 'react-helmet-async';

interface ProductSchemaProps {
    name: string;
    description: string;
    image?: string;
    price?: number;
    currency?: string;
    sku?: string;
    brand?: string;
    availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
    url?: string;
}

/**
 * Injects Product structured data (JSON-LD) for rich Google search results.
 * This enables price display directly in search results.
 */
export function ProductSchema({
    name,
    description,
    image = '/og-image.png',
    price,
    currency = 'DKK',
    sku,
    brand = 'Webprinter',
    availability = 'InStock',
    url
}: ProductSchemaProps) {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://webprinter.dk';

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: name,
        description: description,
        image: image.startsWith('http') ? image : `${siteUrl}${image}`,
        sku: sku || name.toLowerCase().replace(/\s+/g, '-'),
        brand: {
            '@type': 'Brand',
            name: brand
        },
        offers: {
            '@type': 'AggregateOffer',
            priceCurrency: currency,
            lowPrice: price ? price.toString() : '99',
            highPrice: price ? (price * 10).toString() : '9999',
            availability: `https://schema.org/${availability}`,
            url: url || (typeof window !== 'undefined' ? window.location.href : siteUrl),
            seller: {
                '@type': 'Organization',
                name: 'Webprinter.dk'
            }
        }
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(schema)}
            </script>
        </Helmet>
    );
}

/**
 * Organization schema for the homepage / about page.
 */
export function OrganizationSchema() {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Webprinter.dk',
        url: 'https://webprinter.dk',
        logo: 'https://webprinter.dk/logo.png',
        description: 'Danmarks billigste tryksager - foldere, flyers, visitkort, bannere og skilte',
        address: {
            '@type': 'PostalAddress',
            addressCountry: 'DK'
        },
        sameAs: [
            // Add social media URLs here when available
        ]
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(schema)}
            </script>
        </Helmet>
    );
}

/**
 * Breadcrumb schema for better navigation display in search results.
 */
export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://webprinter.dk';

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`
        }))
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(schema)}
            </script>
        </Helmet>
    );
}
