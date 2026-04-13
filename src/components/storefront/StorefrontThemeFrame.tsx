import type { ReactNode } from "react";

import {
  ThemeProvider,
  useTheme,
} from "@/lib/themes";
import {
  buildBrandingCssVariables,
  mergeBrandingWithDefaults,
  type BrandingData,
} from "@/lib/branding";

import "@/themes/classic";
import "@/themes/glassmorphism";

interface StorefrontThemeFrameProps {
  branding?: Partial<BrandingData> | null;
  tenantName?: string | null;
  children: ReactNode;
  topSlot?: ReactNode;
  isPreviewMode?: boolean;
}

interface StorefrontThemeFrameInnerProps {
  branding: BrandingData;
  tenantName?: string | null;
  children: ReactNode;
  topSlot?: ReactNode;
  isPreviewMode: boolean;
}

function StorefrontThemeFrameInner({
  branding,
  tenantName,
  children,
  topSlot,
  isPreviewMode,
}: StorefrontThemeFrameInnerProps) {
  const { components: Theme } = useTheme();
  const resolvedTenantName = String(
    branding.shop_name || tenantName || "Din Shop",
  ).trim() || "Din Shop";

  return (
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
  );
}

export function StorefrontThemeFrame({
  branding,
  tenantName,
  children,
  topSlot,
  isPreviewMode = false,
}: StorefrontThemeFrameProps) {
  const resolvedBranding = mergeBrandingWithDefaults(branding || {});

  return (
    <ThemeProvider
      themeId={resolvedBranding.themeId || "classic"}
      themeSettings={resolvedBranding.themeSettings || {}}
    >
      <StorefrontThemeFrameInner
        branding={resolvedBranding}
        tenantName={tenantName}
        topSlot={topSlot}
        isPreviewMode={isPreviewMode}
      >
        {children}
      </StorefrontThemeFrameInner>
    </ThemeProvider>
  );
}
