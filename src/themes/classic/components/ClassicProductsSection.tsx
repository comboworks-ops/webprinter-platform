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
    if (!showProducts) return null;

    const hasFeaturedProduct = featuredProductConfig?.enabled && featuredProductConfig?.productId;

    return (
        <section
            className="py-16"
            id="produkter"
            style={{
                // Adjust padding when featured product overlaps
                paddingTop: hasFeaturedProduct && featuredProductConfig?.overlapPx
                    ? `${64 + (featuredProductConfig.overlapPx || 0)}px`
                    : undefined,
            }}
        >
            <div className="container mx-auto px-4">
                {/* Featured Product (positioned to overlap hero) */}
                {hasFeaturedProduct && (
                    <div
                        className="mb-8"
                        style={{
                            marginTop: `-${featuredProductConfig.overlapPx || 60}px`,
                            position: 'relative',
                            zIndex: 10,
                        }}
                    >
                        <FeaturedProductConfigurator
                            config={featuredProductConfig}
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
                />
            </div>
        </section>
    );
}
