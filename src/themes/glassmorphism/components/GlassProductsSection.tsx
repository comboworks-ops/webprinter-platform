/**
 * Glassmorphism Theme - ProductsSection Component
 *
 * Products section with frosted glass tabs and floating cards.
 * Optionally includes a featured product quick configurator with glass effects.
 */

import type { ProductsSectionProps } from '@/lib/themes/types';
import { FeaturedProductConfigurator } from '@/components/FeaturedProductConfigurator';
import { StorefrontProductTabs } from '@/components/StorefrontProductTabs';

export function GlassProductsSection({
    branding,
    tenantName,
    isPreviewMode,
    showProducts,
    showStorformatTab,
    productColumns,
    productButtonConfig,
    productBackgroundConfig,
    productLayoutStyle,
    featuredProductConfig,
}: ProductsSectionProps) {
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    if (!showProducts) return null;

    const hasFeaturedProduct = featuredProductConfig?.enabled && featuredProductConfig?.productId;

    // For glassmorphism, prefer glass card style
    const glassConfig = featuredProductConfig ? {
        ...featuredProductConfig,
        cardStyle: featuredProductConfig.cardStyle || 'glass',
    } : undefined;

    return (
        <section
            className="py-20 relative"
            id="produkter"
            style={{
                // Adjust padding when featured product overlaps
                paddingTop: hasFeaturedProduct && featuredProductConfig?.overlapPx
                    ? `${80 + (featuredProductConfig.overlapPx || 0)}px`
                    : undefined,
            }}
        >
            {/* Decorative gradient blobs */}
            <div
                className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
            />
            <div
                className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
            />

            <div className="container mx-auto px-4 relative z-10">
                {/* Featured Product (positioned to overlap hero) */}
                {hasFeaturedProduct && glassConfig && (
                    <div
                        className="mb-12"
                        style={{
                            marginTop: `-${featuredProductConfig.overlapPx || 60}px`,
                            position: 'relative',
                            zIndex: 10,
                        }}
                    >
                        <FeaturedProductConfigurator
                            config={glassConfig}
                            branding={branding}
                        />
                    </div>
                )}

                <StorefrontProductTabs
                    columns={productColumns as 3 | 4 | 5}
                    buttonConfig={productButtonConfig}
                    backgroundConfig={productBackgroundConfig}
                    layoutStyle={productLayoutStyle}
                    showCategoryTabs={showStorformatTab}
                    variant="glass"
                />
            </div>
        </section>
    );
}
