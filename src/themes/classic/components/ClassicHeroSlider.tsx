/**
 * Classic Theme - HeroSlider Component
 *
 * Thin wrapper around the existing HeroSlider component.
 * The existing HeroSlider reads branding from context.
 */

import type { ThemeComponentProps } from '@/lib/themes/types';
import HeroSlider from '@/components/HeroSlider';

export function ClassicHeroSlider(_props: ThemeComponentProps) {
    // The existing HeroSlider component reads hero settings from
    // usePreviewBranding() context - no changes needed
    return <HeroSlider />;
}
