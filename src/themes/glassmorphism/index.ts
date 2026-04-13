/**
 * Glassmorphism Theme
 *
 * A modern theme with frosted glass effects, gradient accents,
 * and floating UI elements. Features backdrop blur, soft shadows,
 * and semi-transparent surfaces.
 *
 * Self-registers when imported.
 */

import { registerTheme, type ThemeDefinition } from '@/lib/themes';

// Import theme components
import { GlassProductGrid } from './components/GlassProductGrid';
import { GlassShopLayout } from './components/GlassShopLayout';
import { GlassProductsSection } from './components/GlassProductsSection';
import { GlassLowerInfo } from './components/GlassLowerInfo';
import { ClassicHeader } from '@/themes/classic/components/ClassicHeader';
import { ClassicFooter } from '@/themes/classic/components/ClassicFooter';
import { ClassicHeroSlider } from '@/themes/classic/components/ClassicHeroSlider';
import { ClassicBanner2 } from '@/themes/classic/components/ClassicBanner2';
import { ClassicContentBlock } from '@/themes/classic/components/ClassicContentBlock';

/**
 * Glassmorphism theme definition
 */
const glassmorphismTheme: ThemeDefinition = {
    metadata: {
        id: 'glassmorphism',
        name: 'Glassmorphism',
        description: 'Moderne design med frostede glaseffekter og bløde skygger',
        version: '1.0.0',
        tags: ['modern', 'glass', 'elegant', 'trendy'],
        author: 'WebPrinter',
    },
    components: {
        Header: ClassicHeader,
        Footer: ClassicFooter,
        HeroSlider: ClassicHeroSlider,
        ProductGrid: GlassProductGrid,
        ShopLayout: GlassShopLayout,
        ProductsSection: GlassProductsSection,
        Banner2: ClassicBanner2,
        LowerInfo: GlassLowerInfo,
        ContentBlock: ClassicContentBlock,
    },
    defaultSettings: {
        // Glassmorphism-specific defaults
        blurIntensity: 'medium', // 'light' | 'medium' | 'heavy'
        glassOpacity: 0.7,
    },
    editorSections: [],
};

// Self-register the theme
registerTheme(glassmorphismTheme);

export default glassmorphismTheme;
