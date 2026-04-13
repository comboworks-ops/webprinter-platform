/**
 * Classic Theme - ProductsSection Component
 *
 * Renders the products section with tabs for tryksager/storformat.
 * Optionally includes a featured product quick configurator.
 */

import type { ProductsSectionProps } from '@/lib/themes/types';
import { FeaturedProductConfigurator } from '@/components/FeaturedProductConfigurator';
import { StorefrontProductTabs } from '@/components/StorefrontProductTabs';

export function ClassicProductsSection({
    branding,
    showProducts,
    showStorformatTab,
    productColumns,
    productButtonConfig,
    productBackgroundConfig,
    productLayoutStyle,
    featuredProductConfig,
}: ProductsSectionProps) {
    if (!showProducts) return null;

    const hasFeaturedProduct = featuredProductConfig?.enabled && featuredProductConfig?.productId;
    const hiddenFeaturedProductIds = hasFeaturedProduct && featuredProductConfig?.showInProductList === false
        ? [featuredProductConfig.productId as string]
        : [];
    const featuredAboveCategories = (featuredProductConfig?.position || 'above') === 'above';
    const categoryTabsConfig = branding?.forside?.productsSection?.categoryTabs;

    return (
        <section
            className="py-16"
            id="produkter"
            data-branding-id="forside.products"
            style={{
                paddingTop: hasFeaturedProduct && featuredAboveCategories
                    ? "64px"
                    : undefined,
            }}
        >
            <div className="container mx-auto px-4">
                {hasFeaturedProduct && featuredAboveCategories && (
                    <div className="mb-8 relative z-10">
                        <FeaturedProductConfigurator
                            config={featuredProductConfig}
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
                />

                {hasFeaturedProduct && !featuredAboveCategories && (
                    <div className="mt-8">
                        <FeaturedProductConfigurator
                            config={featuredProductConfig}
                            branding={branding}
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
