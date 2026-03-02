/**
 * Classic Theme - Footer Component
 *
 * Thin wrapper around the existing Footer component.
 * The existing Footer reads branding from context, so no props needed.
 */

import type { ThemeComponentProps } from '@/lib/themes/types';
import Footer from '@/components/Footer';

export function ClassicFooter(_props: ThemeComponentProps) {
    // The existing Footer component reads branding from usePreviewBranding()
    // and useShopSettings() internally - no changes needed
    return <Footer />;
}
