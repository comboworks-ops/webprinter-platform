/**
 * Taste style themes
 *
 * These register the UI/UX style-library presets as selectable storefront
 * themes. They intentionally reuse the existing production component contracts
 * and apply the style as a visual layer through `themeId`/`visualStyleId`.
 */

import { registerTheme, type ThemeDefinition } from '@/lib/themes';

import { ClassicHeader } from '@/themes/classic/components/ClassicHeader';
import { ClassicFooter } from '@/themes/classic/components/ClassicFooter';
import { ClassicHeroSlider } from '@/themes/classic/components/ClassicHeroSlider';
import { ClassicProductGrid } from '@/themes/classic/components/ClassicProductGrid';
import { ClassicShopLayout } from '@/themes/classic/components/ClassicShopLayout';
import { ClassicProductsSection } from '@/themes/classic/components/ClassicProductsSection';
import { ClassicBanner2 } from '@/themes/classic/components/ClassicBanner2';
import { ClassicLowerInfo } from '@/themes/classic/components/ClassicLowerInfo';
import { ClassicContentBlock } from '@/themes/classic/components/ClassicContentBlock';

import { GlassProductGrid } from '@/themes/glassmorphism/components/GlassProductGrid';
import { GlassShopLayout } from '@/themes/glassmorphism/components/GlassShopLayout';
import { GlassProductsSection } from '@/themes/glassmorphism/components/GlassProductsSection';
import { GlassLowerInfo } from '@/themes/glassmorphism/components/GlassLowerInfo';

const classicComponents: ThemeDefinition['components'] = {
    Header: ClassicHeader,
    Footer: ClassicFooter,
    HeroSlider: ClassicHeroSlider,
    ProductGrid: ClassicProductGrid,
    ShopLayout: ClassicShopLayout,
    ProductsSection: ClassicProductsSection,
    Banner2: ClassicBanner2,
    LowerInfo: ClassicLowerInfo,
    ContentBlock: ClassicContentBlock,
};

const glassComponents: ThemeDefinition['components'] = {
    ...classicComponents,
    ProductGrid: GlassProductGrid,
    ShopLayout: GlassShopLayout,
    ProductsSection: GlassProductsSection,
    LowerInfo: GlassLowerInfo,
};

const tasteThemes: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    components?: ThemeDefinition['components'];
}> = [
    {
        id: 'taste-glassmorphism',
        name: 'Glassmorphism',
        description: 'Frostede paneler, blød dybde og moderne premium-fornemmelse.',
        tags: ['glass', 'premium', 'modern'],
        components: glassComponents,
    },
    {
        id: 'taste-neo-brutalism',
        name: 'Neo-Brutalism',
        description: 'Tykke borders, hårde skygger og grafisk kampagnestil.',
        tags: ['bold', 'graphic', 'brutal'],
    },
    {
        id: 'taste-minimalism',
        name: 'Minimalism',
        description: 'Roligt, luftigt og professionelt med maksimal klarhed.',
        tags: ['minimal', 'clean', 'calm'],
    },
    {
        id: 'taste-neumorphism',
        name: 'Neumorphism',
        description: 'Bløde appflader, pressede knapper og taktil dybde.',
        tags: ['soft', 'app', 'tactile'],
    },
    {
        id: 'taste-flat-design',
        name: 'Flat Design',
        description: 'Rene farveflader, enkel hierarki og hurtig produktlæsning.',
        tags: ['flat', 'simple', 'fast'],
    },
    {
        id: 'taste-material-design',
        name: 'Material Design',
        description: 'Velkendte kort, tydelig elevation og strukturerede flows.',
        tags: ['material', 'structured', 'cards'],
    },
    {
        id: 'taste-swiss-international',
        name: 'Swiss / International',
        description: 'Præcis typografi, stramme grids og disciplineret B2B-stil.',
        tags: ['swiss', 'grid', 'typography'],
    },
    {
        id: 'taste-retro-y2k',
        name: 'Retro / Y2K',
        description: 'Nostalgisk digital energi med moderne kontrol og læsbarhed.',
        tags: ['retro', 'playful', 'digital'],
    },
    {
        id: 'taste-editorial-magazine',
        name: 'Editorial / Magazine',
        description: 'Store overskrifter, billedbåret fortælling og magasinrytme.',
        tags: ['editorial', 'story', 'image-led'],
    },
    {
        id: 'taste-dark-futuristic',
        name: 'Dark Futuristic',
        description: 'Mørke paneler, teknisk kontrast og kontrolleret glow.',
        tags: ['dark', 'tech', 'futuristic'],
    },
    {
        id: 'taste-luxury-premium',
        name: 'Luxury / Premium',
        description: 'Raffineret, rummelig og eksklusiv med stille selvtillid.',
        tags: ['luxury', 'premium', 'refined'],
    },
    {
        id: 'taste-corporate-enterprise',
        name: 'Corporate / Enterprise',
        description: 'Struktureret, troværdig og skalerbar til professionelle shops.',
        tags: ['corporate', 'b2b', 'trust'],
    },
    {
        id: 'taste-playful-cartoon',
        name: 'Playful / Cartoon',
        description: 'Venlige former, positiv energi og blød produktpræsentation.',
        tags: ['playful', 'friendly', 'rounded'],
    },
    {
        id: 'taste-organic-natural',
        name: 'Organic / Natural',
        description: 'Naturlig varme, bløde flader og rolig menneskelig tone.',
        tags: ['organic', 'natural', 'warm'],
    },
    {
        id: 'taste-industrial-technical',
        name: 'Industrial / Technical',
        description: 'Robuste linjer, teknisk præcision og praktisk produktfokus.',
        tags: ['industrial', 'technical', 'robust'],
    },
    {
        id: 'taste-apple-clean',
        name: 'Apple-Style Clean',
        description: 'Poleret, rolig og produktorienteret med blød premiumdybde.',
        tags: ['clean', 'apple', 'polished'],
    },
    {
        id: 'taste-dashboard-saas',
        name: 'Dashboard / SaaS',
        description: 'Overskuelige kort, statusfølelse og hurtige handlinger.',
        tags: ['saas', 'dashboard', 'overview'],
    },
    {
        id: 'taste-ecommerce-modern',
        name: 'E-commerce Modern',
        description: 'Stærke produktkort, tydelige priser og klar købsretning.',
        tags: ['shop', 'commerce', 'conversion'],
    },
    {
        id: 'taste-cinematic-storytelling',
        name: 'Cinematic / Storytelling',
        description: 'Dramatiske flader, stærke billeder og narrativ pacing.',
        tags: ['cinematic', 'story', 'immersive'],
    },
    {
        id: 'taste-gaming-ui',
        name: 'Gaming UI',
        description: 'Energi, badges, high contrast og tydelig visuel feedback.',
        tags: ['gaming', 'energy', 'contrast'],
    },
    {
        id: 'taste-government-public-service',
        name: 'Government / Public Service',
        description: 'Ekstra klar, rolig, tilgængelig og tillidsvækkende.',
        tags: ['public', 'accessible', 'trust'],
    },
    {
        id: 'taste-marketplace-ui',
        name: 'Marketplace UI',
        description: 'Browse, sammenlign og vælg produkter med stærk oversigt.',
        tags: ['marketplace', 'browse', 'compare'],
    },
    {
        id: 'taste-mobile-first-app',
        name: 'Mobile-First App UI',
        description: 'Store touch targets, korte tekster og app-lignende handlinger.',
        tags: ['mobile', 'app', 'touch'],
    },
    {
        id: 'taste-print-cmyk-graphic',
        name: 'Print / CMYK Graphic',
        description: 'Printinspireret, grafisk og tydeligt forbundet til tryksager.',
        tags: ['print', 'cmyk', 'graphic'],
    },
    {
        id: 'taste-restaurant-menu',
        name: 'Restaurant / Menu UI',
        description: 'Kategorier, tilbud og prisoverblik med varm menuklarhed.',
        tags: ['menu', 'warm', 'ordering'],
    },
];

tasteThemes.forEach((theme) => {
    registerTheme({
        metadata: {
            id: theme.id,
            name: theme.name,
            description: theme.description,
            version: '1.0.0',
            tags: theme.tags,
            author: 'WebPrinter',
        },
        components: theme.components || classicComponents,
        defaultSettings: {
            visualStyleId: theme.id,
        },
        editorSections: [],
    });
});

export default tasteThemes;
