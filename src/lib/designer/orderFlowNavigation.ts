export const STOREFRONT_CONTEXT_QUERY_KEYS = [
  "force_domain",
  "tenantId",
  "siteId",
  "sitePreview",
  "preview_mode",
] as const;

export function getSafeInternalPath(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (
    !normalized.startsWith("/")
    || normalized.startsWith("//")
    || normalized.includes("\\")
  ) return null;
  return normalized;
}

export function copyStorefrontContextParams(
  target: URLSearchParams,
  source: URLSearchParams,
): void {
  STOREFRONT_CONTEXT_QUERY_KEYS.forEach((key) => {
    const value = source.get(key);
    if (value) target.set(key, value);
  });
}

export function buildCurrentInternalPath(pathname: string, search = ""): string | null {
  const safePathname = getSafeInternalPath(pathname);
  if (!safePathname) return null;

  const normalizedSearch = search
    ? search.startsWith("?") ? search : `?${search}`
    : "";

  return `${safePathname}${normalizedSearch}`;
}

export function buildDesignerCheckoutPath(source: URLSearchParams): string {
  const checkoutParams = new URLSearchParams();
  copyStorefrontContextParams(checkoutParams, source);
  const checkoutQuery = checkoutParams.toString();
  return `/checkout/konfigurer${checkoutQuery ? `?${checkoutQuery}` : ""}`;
}

export function buildProductFallbackPath(
  productSlug: string | null | undefined,
  source: URLSearchParams,
): string | null {
  const normalizedSlug = String(productSlug || "").trim();
  if (!normalizedSlug) return null;

  const productParams = new URLSearchParams();
  copyStorefrontContextParams(productParams, source);
  const productQuery = productParams.toString();
  const productPath = `/produkt/${encodeURIComponent(normalizedSlug)}`;
  return `${productPath}${productQuery ? `?${productQuery}` : ""}`;
}

export function applyDesignerDocumentParams(
  target: URLSearchParams,
  input: {
    formatLabel?: string | null;
    widthMm?: number | null;
    heightMm?: number | null;
    bleedMm?: number | null;
    safeMm?: number | null;
  },
): void {
  const formatLabel = String(input.formatLabel || "").trim();
  if (formatLabel && formatLabel !== "Standard") {
    target.set("format", formatLabel);
  }

  if (
    typeof input.widthMm === "number"
    && input.widthMm > 0
    && typeof input.heightMm === "number"
    && input.heightMm > 0
  ) {
    target.set("widthMm", String(input.widthMm));
    target.set("heightMm", String(input.heightMm));
  }

  if (typeof input.bleedMm === "number" && input.bleedMm >= 0) {
    target.set("bleedMm", String(input.bleedMm));
  }

  if (typeof input.safeMm === "number" && input.safeMm >= 0) {
    target.set("safeMm", String(input.safeMm));
  }
}
