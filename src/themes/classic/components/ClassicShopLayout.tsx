/**
 * Classic Theme - Shop Layout Component
 *
 * Layout wrapper for the shop page.
 * Provides the standard classic layout structure.
 */

import type { ShopLayoutProps } from '@/lib/themes/types';
import { getPageBackgroundStyle } from '@/lib/branding/background';

function getVisualStyleId(branding: ShopLayoutProps["branding"]) {
    const themeSettings = (branding?.themeSettings || {}) as Record<string, unknown>;
    const rawStyleId = String(themeSettings.visualStyleId || themeSettings.visualThemePresetId || branding?.themeId || "classic");
    return rawStyleId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        || "classic";
}

export function ClassicShopLayout({ children, cssVariables, branding }: ShopLayoutProps) {
    const pageBackgroundStyle = getPageBackgroundStyle(branding);
    const visualStyleId = getVisualStyleId(branding);

    return (
        <div
            className={`min-h-screen flex flex-col storefront-visual-style storefront-style-${visualStyleId}`}
            data-branding-id="colors.background"
            data-storefront-style={visualStyleId}
            data-storefront-theme={branding?.themeId || "classic"}
            style={{
                ...cssVariables,
                ...pageBackgroundStyle,
            }}
        >
            {children}
        </div>
    );
}
