/**
 * Theme System Type Definitions
 *
 * Defines the contract that all themes must implement.
 * Themes provide different visual designs while using the same branding data.
 */

import type { ComponentType, ReactNode } from 'react';
import type { BrandingData } from '@/hooks/useBrandingDraft';

// =============================================================================
// THEME COMPONENT PROPS
// =============================================================================

/**
 * Base props that ALL theme components receive.
 * This is the contract between the theme system and theme implementations.
 */
export interface ThemeComponentProps {
    branding: BrandingData;
    tenantName: string;
    isPreviewMode?: boolean;
}

/**
 * Props for ProductGrid theme component.
 * Extends base props with product-specific configuration.
 */
export interface ProductGridProps {
    category: 'tryksager' | 'storformat';
    columns?: 3 | 4 | 5;
    buttonConfig?: {
        style?: 'default' | 'bar' | 'center' | 'hidden';
        bgColor?: string;
        hoverBgColor?: string;
        textColor?: string;
        hoverTextColor?: string;
        font?: string;
        animation?: 'none' | 'lift' | 'glow' | 'pulse';
    };
    layoutStyle?: 'cards' | 'flat' | 'grouped' | 'slim';
    backgroundConfig?: {
        type?: 'solid' | 'gradient';
        color?: string;
        gradientStart?: string;
        gradientEnd?: string;
        gradientAngle?: number;
        opacity?: number;
    };
}

/**
 * Props for ShopLayout theme component.
 * Wraps the entire shop page content.
 */
export interface ShopLayoutProps extends ThemeComponentProps {
    children: ReactNode;
    cssVariables?: React.CSSProperties;
}

/**
 * Props for content page layouts.
 */
export interface PageLayoutProps extends ThemeComponentProps {
    children: ReactNode;
}

/**
 * Props for ProductsSection theme component.
 * Wraps the products area including tabs.
 */
export interface ProductsSectionProps extends ThemeComponentProps {
    showProducts: boolean;
    showStorformatTab: boolean;
    productColumns: number;
    productButtonConfig?: ProductGridProps['buttonConfig'];
    productBackgroundConfig?: ProductGridProps['backgroundConfig'];
    productLayoutStyle?: ProductGridProps['layoutStyle'];
}

/**
 * Props for Banner2 theme component.
 */
export interface Banner2Props extends ThemeComponentProps {
    banner2: {
        enabled?: boolean;
        slides?: Array<{
            id: string;
            enabled: boolean;
            title?: string;
            items?: Array<{
                id: string;
                enabled: boolean;
                icon?: string;
                title?: string;
                description?: string;
            }>;
        }>;
    } | null;
}

/**
 * Props for LowerInfo theme component.
 */
export interface LowerInfoProps extends ThemeComponentProps {
    lowerInfo: {
        enabled?: boolean;
        cards?: Array<{
            id: string;
            enabled: boolean;
            icon?: string;
            title?: string;
            description?: string;
        }>;
    } | null;
}

/**
 * Props for ContentBlock theme component.
 */
export interface ContentBlockProps extends ThemeComponentProps {
    block: {
        id: string;
        type: string;
        enabled: boolean;
        placement?: string;
        title?: string;
        subtitle?: string;
        content?: string;
        buttonText?: string;
        buttonLink?: string;
        imageUrl?: string;
        imagePosition?: string;
        backgroundColor?: string;
        textColor?: string;
        alignment?: string;
    };
}

// =============================================================================
// THEME COMPONENTS INTERFACE
// =============================================================================

/**
 * The component set that each theme must provide.
 * All themes implement this same interface, enabling seamless switching.
 */
export interface ThemeComponents {
    /** Main header/navigation component */
    Header: ComponentType<ThemeComponentProps>;

    /** Footer component */
    Footer: ComponentType<ThemeComponentProps>;

    /** Hero slider/banner component */
    HeroSlider: ComponentType<ThemeComponentProps>;

    /** Product grid display component */
    ProductGrid: ComponentType<ThemeComponentProps & ProductGridProps>;

    /** Shop page layout wrapper */
    ShopLayout: ComponentType<ShopLayoutProps>;

    /** Products section with tabs */
    ProductsSection: ComponentType<ProductsSectionProps>;

    /** Secondary banner (Banner2) */
    Banner2: ComponentType<Banner2Props>;

    /** Lower info cards section */
    LowerInfo: ComponentType<LowerInfoProps>;

    /** Content block renderer */
    ContentBlock: ComponentType<ContentBlockProps>;

    /** Optional: Contact page layout */
    ContactLayout?: ComponentType<PageLayoutProps>;

    /** Optional: About page layout */
    AboutLayout?: ComponentType<PageLayoutProps>;
}

// =============================================================================
// THEME METADATA
// =============================================================================

/**
 * Metadata for theme display in the selector UI.
 */
export interface ThemeMetadata {
    /** Unique identifier (e.g., 'classic', 'glassmorphism') */
    id: string;

    /** Display name shown in UI */
    name: string;

    /** Description for theme selector */
    description: string;

    /** Preview thumbnail URL */
    thumbnail?: string;

    /** Theme author/creator */
    author?: string;

    /** Theme version */
    version: string;

    /** Searchable tags */
    tags?: string[];

    /** Whether this is a premium/paid theme */
    isPremium?: boolean;
}

// =============================================================================
// THEME-SPECIFIC SETTINGS
// =============================================================================

/**
 * Theme-specific settings that extend base branding.
 * Each theme can define additional controls unique to its design.
 */
export interface ThemeSpecificSettings {
    [key: string]: unknown;
}

/**
 * Editor section for theme-specific controls in the branding editor.
 */
export interface ThemeEditorSection {
    /** Unique section identifier */
    id: string;

    /** Display label in sidebar */
    label: string;

    /** Optional icon name */
    icon?: string;

    /** Component that renders the section's controls */
    render: ComponentType<{
        settings: ThemeSpecificSettings;
        onChange: (settings: ThemeSpecificSettings) => void;
    }>;
}

// =============================================================================
// THEME DEFINITION
// =============================================================================

/**
 * Complete theme definition.
 * This is what each theme exports and registers with the system.
 */
export interface ThemeDefinition {
    /** Theme metadata for UI display */
    metadata: ThemeMetadata;

    /** The component set this theme provides */
    components: ThemeComponents;

    /** Default theme-specific settings */
    defaultSettings?: ThemeSpecificSettings;

    /** Extra editor sections for theme-specific controls */
    editorSections?: ThemeEditorSection[];
}

// =============================================================================
// THEME CONTEXT VALUE
// =============================================================================

/**
 * Value provided by ThemeProvider context.
 */
export interface ThemeContextValue {
    /** Current theme ID */
    themeId: string;

    /** Full theme definition */
    theme: ThemeDefinition;

    /** Quick access to theme components */
    components: ThemeComponents;

    /** Merged theme-specific settings */
    themeSettings: ThemeSpecificSettings;
}
