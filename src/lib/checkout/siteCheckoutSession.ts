const SITE_CHECKOUT_SESSION_KEY = "wp_site_checkout_session";

export interface SiteCheckoutUpload {
  name?: string | null;
  mimeType?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  estimatedDpi?: number | null;
  previewDataUrl?: string | null;
}

export interface SiteCheckoutState {
  productId?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  quantity?: number | null;
  productPrice?: number | null;
  extraPrice?: number | null;
  totalPrice?: number | null;
  shippingCost?: number | null;
  summary?: string | null;
  selectedFormat?: string | null;
  designWidthMm?: number | null;
  designHeightMm?: number | null;
  designBleedMm?: number | null;
  shippingSelected?: string | null;
  optionSelections?: Record<string, unknown>;
  sourceSiteId?: string | null;
  siteUpload?: SiteCheckoutUpload | null;
  createdAt?: string | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readSiteCheckoutSession(): SiteCheckoutState | null {
  if (!isBrowser()) return null;

  try {
    const raw = sessionStorage.getItem(SITE_CHECKOUT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteCheckoutState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSiteCheckoutSession(input: SiteCheckoutState): boolean {
  if (!isBrowser()) return false;

  try {
    sessionStorage.setItem(SITE_CHECKOUT_SESSION_KEY, JSON.stringify(input || {}));
    return true;
  } catch {
    return false;
  }
}

export function clearSiteCheckoutSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SITE_CHECKOUT_SESSION_KEY);
}
