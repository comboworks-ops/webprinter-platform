/**
 * Classic Theme - Header Component
 *
 * Thin wrapper around the existing Header component.
 * The existing Header reads branding from context, so no props needed.
 */

import type { ThemeComponentProps } from '@/lib/themes/types';
import Header from '@/components/Header';

export function ClassicHeader(_props: ThemeComponentProps) {
    // The existing Header component reads branding from usePreviewBranding()
    // and useShopSettings() internally - no changes needed
    return <Header />;
}
