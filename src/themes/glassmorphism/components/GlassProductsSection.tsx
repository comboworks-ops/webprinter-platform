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
    const hiddenFeaturedProductIds = hasFeaturedProduct && featuredProductConfig?.showInProductList === false
        ? [featuredProductConfig.productId as string]
        : [];
    const featuredAboveCategories = (featuredProductConfig?.position || 'above') === 'above';
    const categoryTabsConfig = branding?.forside?.productsSection?.categoryTabs;

    // For glassmorphism, prefer glass card style
    const glassConfig = featuredProductConfig ? {
        ...featuredProductConfig,
        cardStyle: featuredProductConfig.cardStyle || 'glass',
    } : undefined;

    return (
        <section
            className="py-20 relative"
            id="produkter"
            data-branding-id="forside.products"
            style={{
                paddingTop: hasFeaturedProduct && featuredAboveCategories
                    ? "80px"
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
                {hasFeaturedProduct && glassConfig && featuredAboveCategories && (
                    <div className="mb-12 relative z-10">
                        <FeaturedProductConfigurator
                            config={glassConfig}
                            branding={branding}
                        />
                    </div>
                )}

                <StorefrontProductTabs
                    columns={productColumns as 3 | 4 | 5}
                    buttonConfig={productButtonConfig}
                    categoryTabsConfig={categoryTabsConfig}
                    backgroundConfig={productBackgroundConfig}
                    layoutStyle={productLayoutStyle}
                    showCategoryTabs={showStorformatTab}
                    hiddenProductIds={hiddenFeaturedProductIds}
                    variant="glass"
                />

                {hasFeaturedProduct && glassConfig && !featuredAboveCategories && (
                    <div className="mt-12">
                        <FeaturedProductConfigurator
                            config={glassConfig}
                            branding={branding}
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
