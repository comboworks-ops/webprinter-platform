/**
 * Classic Theme - ProductsSection Component
 *
 * Renders the products section with tabs for tryksager/storformat.
 * Optionally includes a featured product quick configurator.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/lib/themes';
import type { ProductsSectionProps } from '@/lib/themes/types';
import { FeaturedProductConfigurator } from '@/components/FeaturedProductConfigurator';

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
    const { components: Theme } = useTheme();

    if (!showProducts) return null;

    const themeProps = { branding, tenantName, isPreviewMode };
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

                {showStorformatTab ? (
                    <Tabs defaultValue="tryksager" className="w-full">
                        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                            <TabsTrigger value="tryksager">Tryksager</TabsTrigger>
                            <TabsTrigger value="storformat">Storformat print</TabsTrigger>
                        </TabsList>

                        <TabsContent value="tryksager" id="tryksager">
                            <Theme.ProductGrid
                                {...themeProps}
                                category="tryksager"
                                columns={productColumns as 3 | 4 | 5}
                                buttonConfig={productButtonConfig}
                                backgroundConfig={productBackgroundConfig}
                                layoutStyle={productLayoutStyle}
                            />
                        </TabsContent>

                        <TabsContent value="storformat" id="storformat">
                            <Theme.ProductGrid
                                {...themeProps}
                                category="storformat"
                                columns={productColumns as 3 | 4 | 5}
                                buttonConfig={productButtonConfig}
                                backgroundConfig={productBackgroundConfig}
                                layoutStyle={productLayoutStyle}
                            />
                        </TabsContent>
                    </Tabs>
                ) : (
                    <Theme.ProductGrid
                        {...themeProps}
                        category="tryksager"
                        columns={productColumns as 3 | 4 | 5}
                        buttonConfig={productButtonConfig}
                        backgroundConfig={productBackgroundConfig}
                        layoutStyle={productLayoutStyle}
                    />
                )}
            </div>
        </section>
    );
}
