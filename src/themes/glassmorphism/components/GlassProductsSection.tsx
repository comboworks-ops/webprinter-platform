/**
 * Glassmorphism Theme - ProductsSection Component
 *
 * Products section with frosted glass tabs and floating cards.
 * Optionally includes a featured product quick configurator with glass effects.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/lib/themes';
import type { ProductsSectionProps } from '@/lib/themes/types';
import { FeaturedProductConfigurator } from '@/components/FeaturedProductConfigurator';

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
    const { components: Theme } = useTheme();
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    if (!showProducts) return null;

    const themeProps = { branding, tenantName, isPreviewMode };
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

                {showStorformatTab ? (
                    <Tabs defaultValue="tryksager" className="w-full">
                        {/* Glass Tab Container */}
                        <div
                            className="w-full max-w-md mx-auto mb-16 p-1.5 rounded-2xl"
                            style={{
                                background: 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.5)',
                            }}
                        >
                            <TabsList className="grid w-full grid-cols-2 bg-transparent h-auto p-0">
                                <TabsTrigger
                                    value="tryksager"
                                    className="rounded-xl py-3 px-6 font-medium transition-all data-[state=active]:shadow-lg data-[state=active]:!bg-white data-[state=inactive]:!bg-transparent data-[state=active]:!text-gray-900 !text-gray-600"
                                >
                                    Tryksager
                                </TabsTrigger>
                                <TabsTrigger
                                    value="storformat"
                                    className="rounded-xl py-3 px-6 font-medium transition-all data-[state=active]:shadow-lg data-[state=active]:!bg-white data-[state=inactive]:!bg-transparent data-[state=active]:!text-gray-900 !text-gray-600"
                                >
                                    Storformat print
                                </TabsTrigger>
                            </TabsList>
                        </div>

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
