/**
 * Classic Theme - Banner2 Component
 *
 * Reuses the production Banner2 implementation so preview and live
 * remain aligned for Site Design V2.
 */

import { Banner2Showcase } from '@/components/Banner2Showcase';
import type { Banner2Props } from '@/lib/themes/types';

export function ClassicBanner2({ banner2 }: Banner2Props) {
    return <Banner2Showcase banner2={banner2 as any} />;
}
