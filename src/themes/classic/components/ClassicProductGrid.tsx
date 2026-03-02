/**
 * Classic Theme - ProductGrid Component
 *
 * Wrapper around the existing ProductGrid component.
 * Passes through the product-specific props.
 */

import type { ThemeComponentProps, ProductGridProps } from '@/lib/themes/types';
import ProductGrid from '@/components/ProductGrid';

export function ClassicProductGrid(
    props: ThemeComponentProps & ProductGridProps
) {
    const { category, columns, buttonConfig, layoutStyle, backgroundConfig } = props;

    // Pass through product grid specific props
    // The existing ProductGrid handles its own data fetching
    return (
        <ProductGrid
            category={category}
            columns={columns}
            buttonConfig={buttonConfig}
            layoutStyle={layoutStyle}
            backgroundConfig={backgroundConfig}
        />
    );
}
