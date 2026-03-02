/**
 * Classic Theme - Shop Layout Component
 *
 * Layout wrapper for the shop page.
 * Provides the standard classic layout structure.
 */

import type { ShopLayoutProps } from '@/lib/themes/types';

export function ClassicShopLayout({ children, cssVariables }: ShopLayoutProps) {
    return (
        <div className="min-h-screen flex flex-col" style={cssVariables}>
            {children}
        </div>
    );
}
