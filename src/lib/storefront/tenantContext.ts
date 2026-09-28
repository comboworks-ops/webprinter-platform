export const MASTER_STOREFRONT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export function isLocalStorefrontContext(pathname: string): boolean {
  if (["/admin", "/preview", "/platform"].some((prefix) => pathname.startsWith(prefix))) return false;
  return !new Set([
    "/priser", "/white-label", "/beregning", "/order-flow", "/online-designer",
    "/privacy-policy", "/handelsbetingelser", "/cookiepolitik", "/opret-shop",
  ]).has(pathname);
}

// These routes resolve tenants differently, even when hostname and query overrides match.
export function shopSettingsRouteScope(pathname: string, isDraftPreview: boolean): string {
  if (pathname.startsWith("/preview-shop") || pathname.startsWith("/preview-storefront")) {
    return isDraftPreview ? "preview-draft" : "preview-published";
  }
  if (pathname.startsWith("/local-tenant")) return "local-tenant";
  return isLocalStorefrontContext(pathname) ? "storefront" : "non-storefront";
}

export function storefrontPinContextId(options: {
  honorPin: boolean;
  pinnedTenantId?: string | null;
  forceTenantId?: string | null;
  forceDomain?: string | null;
  forceSubdomain?: string | null;
}): string | null {
  if (!options.honorPin || options.forceTenantId || options.forceDomain || options.forceSubdomain != null) return null;
  return options.pinnedTenantId || null;
}

export function resolveCatalogTenantId(settings: {
  data?: { id?: string | null } | null;
  isLoading: boolean;
  isError: boolean;
}): string | null {
  return settings.isLoading || settings.isError ? null : settings.data?.id || null;
}

export function storefrontCatalogContextKey(tenantId: string | null, activeSiteId?: string | null): string | null {
  return tenantId ? `${tenantId}:site:${activeSiteId || "default"}` : null;
}
