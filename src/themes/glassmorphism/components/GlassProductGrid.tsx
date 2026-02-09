/**
 * Glassmorphism Theme - ProductGrid Component
 *
 * Wraps the existing ProductGrid with glass-themed styling.
 * The core product loading logic stays in the original component.
 */

import type { ThemeComponentProps, ProductGridProps } from '@/lib/themes/types';
import ProductGrid from '@/components/ProductGrid';

export function GlassProductGrid(props: ThemeComponentProps & ProductGridProps) {
    const { category, columns, buttonConfig, layoutStyle, backgroundConfig } = props;

    // Use the existing ProductGrid but with glass-themed button styling
    const glassButtonConfig = {
        ...buttonConfig,
        style: buttonConfig?.style || 'default',
        animation: buttonConfig?.animation || 'lift',
    };

    return (
        <div className="glass-product-grid">
            <ProductGrid
                category={category}
                columns={columns}
                buttonConfig={glassButtonConfig}
                layoutStyle={layoutStyle}
                backgroundConfig={backgroundConfig}
            />
        </div>
    );
}
