import "@/styles/orderFlowDesigns.css";
import { useEffect, type ReactNode } from "react";
import { resolvePrintDesignBranding } from '@/lib/branding/printDesignPresets';

import {
  ThemeProvider,
  useTheme,
  DEFAULT_THEME_ID,
} from "@/lib/themes";
import {
  buildBrandingCssVariables,
  mergeBrandingWithDefaults,
  type BrandingData,
} from "@/lib/branding";
import {
  resolveShopComponentRecipe,
  resolveStorefrontLayout,
} from "@/lib/storefront/shopTemplates";

import "@/themes/classic";
import "@/themes/glassmorphism";
import "@/themes/taste-style-themes";
import "@/themes/print";
import "@/styles/storefrontShopTemplates.css";
import "@/styles/storefrontVisualStyles.css";

const STOREFRONT_FONTS_LINK_ID = "storefront-branding-fonts";
const IGNORED_FONT_VALUES = new Set(["inherit", "initial", "unset", "sans-serif", "serif", "monospace"]);

function addFont(fonts: Set<string>, font?: string | null) {
  const normalized = String(font || "").trim();
  if (!normalized || IGNORED_FONT_VALUES.has(normalized.toLowerCase())) return;
  fonts.add(normalized);
}

function buildGoogleFontsUrl(fonts: string[]) {
  const uniqueFonts = [...new Set(fonts)].filter(Boolean);
  if (!uniqueFonts.length) return "";

  const families = uniqueFonts
    .map((font) => font.replace(/ /g, "+"))
    .map((font) => `family=${font}:wght@400;500;600;700;800`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function extractStorefrontFonts(branding: BrandingData) {
  const fonts = new Set<string>();
  const data = branding as any;

  addFont(fonts, data.fonts?.heading);
  addFont(fonts, data.fonts?.body);
  addFont(fonts, data.fonts?.pricing);

  addFont(fonts, data.header?.logoFont);
  addFont(fonts, data.header?.fontId);
  addFont(fonts, data.header?.dropdownCategoryFontId);
  addFont(fonts, data.header?.dropdownProductFontId);

  addFont(fonts, data.hero?.overlay?.titleFontId);
  addFont(fonts, data.hero?.overlay?.subtitleFontId);
  (data.hero?.images || []).forEach((image: any) => {
    addFont(fonts, image?.titleFontId);
    addFont(fonts, image?.subtitleFontId);
  });

  addFont(fonts, data.uspStrip?.titleFont);
  addFont(fonts, data.uspStrip?.descriptionFont);

  const productsSection = data.forside?.productsSection;
  addFont(fonts, productsSection?.categoryTabs?.font);
  addFont(fonts, productsSection?.card?.titleFont);
  addFont(fonts, productsSection?.card?.bodyFont);
  addFont(fonts, productsSection?.card?.priceFont);
  addFont(fonts, productsSection?.button?.font);

  const banner2 = data.forside?.banner2;
  addFont(fonts, banner2?.headingFont);
  addFont(fonts, banner2?.subtitleFont);
  (banner2?.slides || []).forEach((slide: any) => {
    (slide?.items || []).forEach((item: any) => {
      addFont(fonts, item?.titleFont);
      addFont(fonts, item?.descriptionFont);
    });
  });

  (data.forside?.contentBlocks || []).forEach((block: any) => {
    addFont(fonts, block?.headingFont);
    addFont(fonts, block?.textFont);
  });

  const productPage = data.productPage;
  addFont(fonts, productPage?.heading?.font);
  addFont(fonts, productPage?.heading?.subtext?.font);
  addFont(fonts, productPage?.infoSection?.titleFont);
  addFont(fonts, productPage?.infoSection?.textFont);
  addFont(fonts, productPage?.matrix?.font);
  addFont(fonts, productPage?.matrix?.textButtons?.fontFamily);
  addFont(fonts, productPage?.orderButtons?.font);

  return Array.from(fonts);
}

interface StorefrontThemeFrameProps {
  branding?: Partial<BrandingData> | null;
  tenantName?: string | null;
  children: ReactNode;
  topSlot?: ReactNode;
  orderDesign?: number;
  isPreviewMode?: boolean;
}

interface StorefrontThemeFrameInnerProps {
  branding: BrandingData;
  tenantName?: string | null;
  children: ReactNode;
  topSlot?: ReactNode;
  orderDesign?: number;
  isPreviewMode: boolean;
}

function StorefrontThemeFrameInner({
  branding,
  tenantName,
  children,
  topSlot,
  isPreviewMode,
  orderDesign,
}: StorefrontThemeFrameInnerProps) {
  const { components: Theme } = useTheme();
  const fontSignature = extractStorefrontFonts(branding).join("|");
  const resolvedTenantName = String(
    branding.shop_name || tenantName || "Din Shop",
  ).trim() || "Din Shop";
  const shopLayout = resolveStorefrontLayout(branding.forside?.layout);
  const shopRecipe = resolveShopComponentRecipe(shopLayout);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const url = buildGoogleFontsUrl(fontSignature.split("|").filter(Boolean));
    if (!url) return;

    let link = document.getElementById(STOREFRONT_FONTS_LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = STOREFRONT_FONTS_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== url) {
      link.href = url;
    }
  }, [fontSignature]);

  return (
    <div
      className="storefront-shop-template-scope"
      data-order-design={orderDesign}
      data-shop-template={shopLayout.templateId}
      data-shop-template-version={shopLayout.version}
      data-shop-content-width={shopLayout.contentWidth}
      data-shop-hero-treatment={shopLayout.heroTreatment}
      data-shop-hero-height={shopLayout.heroHeight}
      data-shop-section-spacing={shopLayout.sectionSpacing}
      data-shop-surface-rhythm={shopLayout.surfaceRhythm}
      data-shop-open-design={shopRecipe.openDesignSystem}
      data-shop-header={shopRecipe.header.variant}
      data-shop-navigation={shopRecipe.navigation}
      data-shop-category-navigation={shopRecipe.categoryNavigation}
      data-shop-product-collection={shopRecipe.productCollection}
      data-shop-product-card={shopRecipe.productCard}
      data-shop-product-page={shopRecipe.productPage}
      data-shop-checkout={shopRecipe.checkout}
      data-shop-footer={shopRecipe.footer}
      data-shop-motion={shopRecipe.motion}
    >
      <Theme.ShopLayout
        branding={branding}
        tenantName={resolvedTenantName}
        isPreviewMode={isPreviewMode}
        cssVariables={buildBrandingCssVariables(branding)}
      >
        {topSlot}
        <Theme.Header
          branding={branding}
          tenantName={resolvedTenantName}
          isPreviewMode={isPreviewMode}
        />
        {children}
        <Theme.Footer
          branding={branding}
          tenantName={resolvedTenantName}
          isPreviewMode={isPreviewMode}
        />
      </Theme.ShopLayout>
    </div>
  );
}

export function StorefrontThemeFrame({
  branding,
  tenantName,
  children,
  topSlot,
  isPreviewMode = false,
  orderDesign,
}: StorefrontThemeFrameProps) {
  const resolvedBranding = resolvePrintDesignBranding(mergeBrandingWithDefaults(branding || {}));

  return (
    <ThemeProvider
      themeId={resolvedBranding.themeId || DEFAULT_THEME_ID}
      themeSettings={resolvedBranding.themeSettings || {}}
    >
      <StorefrontThemeFrameInner
        branding={resolvedBranding}
        orderDesign={orderDesign}
        tenantName={tenantName}
        topSlot={topSlot}
        isPreviewMode={isPreviewMode}
      >
        {children}
      </StorefrontThemeFrameInner>
    </ThemeProvider>
  );
}
