/**
 * Classic Theme - Shop Layout Component
 *
 * Layout wrapper for the shop page.
 * Provides the standard classic layout structure.
 */

import type { ShopLayoutProps } from '@/lib/themes/types';
import { getPageBackgroundStyle } from '@/lib/branding/background';

export function ClassicShopLayout({ children, cssVariables, branding }: ShopLayoutProps) {
    const pageBackgroundStyle = getPageBackgroundStyle(branding);

    return (
        <div
            className="min-h-screen flex flex-col"
            data-branding-id="colors.background"
            style={{
                ...cssVariables,
                ...pageBackgroundStyle,
            }}
        >
            {children}
        </div>
    );
}
