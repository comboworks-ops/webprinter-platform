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
import { GlassHeader } from './components/GlassHeader';
import { GlassFooter } from './components/GlassFooter';
import { GlassHeroSlider } from './components/GlassHeroSlider';
import { GlassProductGrid } from './components/GlassProductGrid';
import { GlassShopLayout } from './components/GlassShopLayout';
import { GlassProductsSection } from './components/GlassProductsSection';
import { GlassBanner2 } from './components/GlassBanner2';
import { GlassLowerInfo } from './components/GlassLowerInfo';
import { GlassContentBlock } from './components/GlassContentBlock';

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
        Header: GlassHeader,
        Footer: GlassFooter,
        HeroSlider: GlassHeroSlider,
        ProductGrid: GlassProductGrid,
        ShopLayout: GlassShopLayout,
        ProductsSection: GlassProductsSection,
        Banner2: GlassBanner2,
        LowerInfo: GlassLowerInfo,
        ContentBlock: GlassContentBlock,
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
