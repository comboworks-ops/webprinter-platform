/**
 * Classic Theme - ProductsSection Component
 *
 * Renders the products section with tabs for tryksager/storformat.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/lib/themes';
import type { ProductsSectionProps } from '@/lib/themes/types';

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
}: ProductsSectionProps) {
    const { components: Theme } = useTheme();

    if (!showProducts) return null;

    const themeProps = { branding, tenantName, isPreviewMode };

    return (
        <section className="py-16" id="produkter">
            <div className="container mx-auto px-4">
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
