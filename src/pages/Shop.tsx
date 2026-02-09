import { type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";
import { PreviewBrandingProvider } from "@/contexts/PreviewBrandingContext";
import { mergeBrandingWithDefaults, DEFAULT_BRANDING } from "@/hooks/useBrandingDraft";
import { getPageBackgroundStyle } from "@/lib/branding/background";

// Theme System
import { ThemeProvider, useTheme } from "@/lib/themes";
import "@/themes/classic"; // Register classic theme
import "@/themes/glassmorphism"; // Register glassmorphism theme

// Helper to convert hex to HSL for CSS variables
function hexToHsl(hex: string): string {
    if (!hex || !hex.startsWith("#")) return "0 0% 0%";

    let c = hex.substring(1).split("");
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    const r = parseInt(c.slice(0, 2).join(""), 16) / 255;
    const g = parseInt(c.slice(2, 4).join(""), 16) / 255;
    const b = parseInt(c.slice(4, 6).join(""), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Inner shop content component that uses branding from context
 */
const ShopContent = ({ branding, tenantName }: { branding: any; tenantName: string }) => {
    // Get theme components
    const { components: Theme } = useTheme();

    const productsSection = branding?.forside?.productsSection;
    const showProducts = productsSection?.enabled ?? true;
    const productColumns = productsSection?.columns ?? 4;
    const productButtonConfig = productsSection?.button;
    const productBackgroundConfig = productsSection?.background;
    const productLayoutStyle = productsSection?.layoutStyle;
    const showStorformatTab = productsSection?.showStorformatTab ?? true;
    const contentBlocks = branding?.forside?.contentBlocks?.filter((block: any) => block.enabled) || [];
    const blocksAbove = contentBlocks.filter((block: any) => block.placement === 'above_products');
    const blocksBelow = contentBlocks.filter((block: any) => block.placement !== 'above_products');
    const banner2 = branding?.forside?.banner2;
    const lowerInfo = branding?.forside?.lowerInfo;

    const primaryColor = branding?.colors?.primary || DEFAULT_BRANDING.colors.primary;
    const secondaryColor = branding?.colors?.secondary || DEFAULT_BRANDING.colors.secondary;
    const cardColor = branding?.colors?.card || DEFAULT_BRANDING.colors.card;

    const titleFont = branding?.fonts?.title || branding?.fonts?.heading || "Poppins";
    const subtitleFont = branding?.fonts?.subtitle || branding?.fonts?.heading || "Poppins";
    const descriptionFont = branding?.fonts?.description || branding?.fonts?.body || "Inter";
    const systemFont = branding?.fonts?.system || branding?.fonts?.body || "Inter";
    const buttonFont = branding?.fonts?.button || branding?.fonts?.body || "Inter";
    const pricingFont = branding?.fonts?.pricing || "Roboto Mono";

    const headingFallback = branding?.colors?.headingText || DEFAULT_BRANDING.colors.headingText;
    const titleTextColor = branding?.colors?.titleText || headingFallback;
    const subtitleTextColor = branding?.colors?.subtitleText || headingFallback;
    const bodyTextColor = branding?.colors?.bodyText || DEFAULT_BRANDING.colors.bodyText;
    const pricingTextColor = branding?.colors?.pricingText || DEFAULT_BRANDING.colors.pricingText;
    const linkTextColor = branding?.colors?.linkText || DEFAULT_BRANDING.colors.linkText;
    const systemTextColor = branding?.colors?.systemText || headingFallback;
    const buttonTextColor = branding?.colors?.buttonText || DEFAULT_BRANDING.colors.buttonText;
    const headingTextColor = headingFallback;
    const tabInactiveBg = branding?.colors?.tabInactiveBg || branding?.colors?.secondary || DEFAULT_BRANDING.colors.tabInactiveBg;
    const tabInactiveHoverBg = branding?.colors?.tabInactiveHoverBg || DEFAULT_BRANDING.colors.tabInactiveHoverBg;
    const tabActiveHoverBg = branding?.colors?.tabActiveHoverBg || branding?.colors?.hover || DEFAULT_BRANDING.colors.tabActiveHoverBg;

    const cssVariables = {
        "--primary": hexToHsl(primaryColor),
        "--secondary": hexToHsl(secondaryColor),
        "--card": hexToHsl(cardColor),
        "--font-heading": `'${titleFont}', sans-serif`,
        "--font-title": `'${titleFont}', sans-serif`,
        "--font-subtitle": `'${subtitleFont}', sans-serif`,
        "--font-body": `'${systemFont}', sans-serif`,
        "--font-system": `'${systemFont}', sans-serif`,
        "--font-description": `'${descriptionFont}', sans-serif`,
        "--font-button": `'${buttonFont}', sans-serif`,
        "--font-pricing": `'${pricingFont}', monospace`,
        "--heading-text": headingTextColor,
        "--title-text": titleTextColor,
        "--subtitle-text": subtitleTextColor,
        "--body-text": bodyTextColor,
        "--system-text": systemTextColor,
        "--description-text": bodyTextColor,
        "--button-text": buttonTextColor,
        "--pricing-text": pricingTextColor,
        "--link-text": linkTextColor,
        "--tabs-inactive-bg": tabInactiveBg,
        "--tabs-inactive-hover-bg": tabInactiveHoverBg,
        "--tabs-active-hover-bg": tabActiveHoverBg,
        "--foreground": hexToHsl(systemTextColor),
        "--muted-foreground": hexToHsl(bodyTextColor),
        "--primary-foreground": hexToHsl(buttonTextColor),
        "--secondary-foreground": hexToHsl(buttonTextColor),
        fontFamily: `'${systemFont}', sans-serif`,
    } as CSSProperties;

    const pageBackgroundStyle = getPageBackgroundStyle(branding);

    // Common theme props
    const themeProps = { branding, tenantName };

    return (
        <Theme.ShopLayout {...themeProps} cssVariables={cssVariables}>
            <Theme.Header {...themeProps} />

            {/* Main content - HeroSlider uses negative margin to slide under the Header */}
            <main className="flex-1" style={{ marginTop: '-80px', ...pageBackgroundStyle }}>
                <Theme.HeroSlider {...themeProps} />

                {/* Content Blocks (Above Products) */}
                {blocksAbove.map((block: any) => (
                    <Theme.ContentBlock key={block.id} {...themeProps} block={block} />
                ))}

                {/* Products Section */}
                <Theme.ProductsSection
                    {...themeProps}
                    showProducts={showProducts}
                    showStorformatTab={showStorformatTab}
                    productColumns={productColumns}
                    productButtonConfig={productButtonConfig}
                    productBackgroundConfig={productBackgroundConfig}
                    productLayoutStyle={productLayoutStyle}
                />

                {/* Banner 2 (below products) */}
                <Theme.Banner2 {...themeProps} banner2={banner2} />

                {/* Lower Info Section */}
                <Theme.LowerInfo {...themeProps} lowerInfo={lowerInfo} />

                {/* Content Blocks (Below Products) */}
                {blocksBelow.map((block: any) => (
                    <Theme.ContentBlock key={block.id} {...themeProps} block={block} />
                ))}
            </main>

            <Theme.Footer {...themeProps} />
        </Theme.ShopLayout>
    );
};

/**
 * Shop page wrapper that provides branding and theme context
 * This ensures HeroSlider and other components receive the published branding
 */
const Shop = () => {
    const { data: settings, isLoading } = useShopSettings();

    // Show loading state while fetching settings
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Get branding from settings and merge with defaults
    // Always use mergeBrandingWithDefaults to ensure complete branding structure
    const branding = mergeBrandingWithDefaults(settings?.branding || null);
    const tenantName = settings?.tenant_name || "WebPrinter";

    // Get theme ID from branding (defaults to 'classic')
    const themeId = branding.themeId || 'classic';
    const themeSettings = branding.themeSettings || {};

    return (
        <ThemeProvider themeId={themeId} themeSettings={themeSettings}>
            <PreviewBrandingProvider
                initialBranding={branding}
                initialTenantName={tenantName}
            >
                <ShopContent branding={branding} tenantName={tenantName} />
            </PreviewBrandingProvider>
        </ThemeProvider>
    );
};

export default Shop;
