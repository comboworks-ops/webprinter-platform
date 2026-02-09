/**
 * Classic Theme
 *
 * The default theme that wraps the existing components.
 * This ensures backward compatibility - the app looks exactly
 * the same as before when using the Classic theme.
 *
 * Self-registers when imported.
 */

import { registerTheme, type ThemeDefinition } from '@/lib/themes';

// Import wrapper components
import { ClassicHeader } from './components/ClassicHeader';
import { ClassicFooter } from './components/ClassicFooter';
import { ClassicHeroSlider } from './components/ClassicHeroSlider';
import { ClassicProductGrid } from './components/ClassicProductGrid';
import { ClassicShopLayout } from './components/ClassicShopLayout';
import { ClassicProductsSection } from './components/ClassicProductsSection';
import { ClassicBanner2 } from './components/ClassicBanner2';
import { ClassicLowerInfo } from './components/ClassicLowerInfo';
import { ClassicContentBlock } from './components/ClassicContentBlock';

/**
 * Classic theme definition
 */
const classicTheme: ThemeDefinition = {
    metadata: {
        id: 'classic',
        name: 'Classic',
        description: 'Det originale WebPrinter design med moderne styling',
        version: '1.0.0',
        tags: ['professional', 'clean', 'traditional'],
        author: 'WebPrinter',
    },
    components: {
        Header: ClassicHeader,
        Footer: ClassicFooter,
        HeroSlider: ClassicHeroSlider,
        ProductGrid: ClassicProductGrid,
        ShopLayout: ClassicShopLayout,
        ProductsSection: ClassicProductsSection,
        Banner2: ClassicBanner2,
        LowerInfo: ClassicLowerInfo,
        ContentBlock: ClassicContentBlock,
    },
    // No extra settings for classic - uses standard branding
    defaultSettings: {},
    editorSections: [],
};

// Self-register the theme
registerTheme(classicTheme);

export default classicTheme;
