const SITE_CHECKOUT_SESSION_KEY = "wp_site_checkout_session";
const SITE_CHECKOUT_TRANSFER_KEY = "wp_site_checkout_transfer";

export interface SiteCheckoutUpload {
  name?: string | null;
  mimeType?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  physicalWidthMm?: number | null;
  physicalHeightMm?: number | null;
  estimatedDpi?: number | null;
  sourceDpi?: number | null;
  previewDataUrl?: string | null;
  proofingScalePercent?: number | null;
  proofingOffsetXPercent?: number | null;
  proofingOffsetYPercent?: number | null;
}

export interface SiteCheckoutDesignerExport {
  name?: string | null;
  mimeType?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  sourceMode?: "vector_pdf" | "print_pdf" | null;
  generatedAt?: string | null;
}

export interface SiteCheckoutCustomerDraft {
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerCompany?: string | null;
  deliveryRecipientName?: string | null;
  deliveryCompany?: string | null;
  deliveryAddress?: string | null;
  deliveryZip?: string | null;
  deliveryCity?: string | null;
  selectedSavedAddressId?: string | null;
  saveAddressForLater?: boolean | null;
  addressLabel?: string | null;
  senderMode?: "standard" | "blind" | "custom" | null;
  senderName?: string | null;
  useSeparateBillingAddress?: boolean | null;
  billingName?: string | null;
  billingCompany?: string | null;
  billingAddress?: string | null;
  billingZip?: string | null;
  billingCity?: string | null;
  selectedCustomerProfileId?: string | null;
}

export interface SiteCheckoutState {
  productId?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  selectedVariant?: string | null;
  quantity?: number | null;
  productPrice?: number | null;
  extraPrice?: number | null;
  totalPrice?: number | null;
  shippingCost?: number | null;
  summary?: string | null;
  selectedFormat?: string | null;
  linkedTemplateId?: string | null;
  designWidthMm?: number | null;
  designHeightMm?: number | null;
  designBleedMm?: number | null;
  designSafeAreaMm?: number | null;
  shippingSelected?: string | null;
  optionSelections?: Record<string, unknown>;
  sourceSiteId?: string | null;
  siteUpload?: SiteCheckoutUpload | null;
  designerExport?: SiteCheckoutDesignerExport | null;
  checkoutCustomer?: SiteCheckoutCustomerDraft | null;
  createdAt?: string | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function parseCheckoutState(raw: string | null): SiteCheckoutState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SiteCheckoutState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSiteCheckoutSession(): SiteCheckoutState | null {
  if (!isBrowser()) return null;
  return parseCheckoutState(sessionStorage.getItem(SITE_CHECKOUT_SESSION_KEY));
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

export function stageSiteCheckoutTransfer(input: SiteCheckoutState): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(SITE_CHECKOUT_TRANSFER_KEY, JSON.stringify(input || {}));
    return true;
  } catch {
    return false;
  }
}

export function readSiteCheckoutTransfer(): SiteCheckoutState | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  return parseCheckoutState(localStorage.getItem(SITE_CHECKOUT_TRANSFER_KEY));
}

export function consumeSiteCheckoutTransfer(): SiteCheckoutState | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;

  const parsed = parseCheckoutState(localStorage.getItem(SITE_CHECKOUT_TRANSFER_KEY));

  try {
    localStorage.removeItem(SITE_CHECKOUT_TRANSFER_KEY);
  } catch {
    // Best effort only.
  }

  return parsed;
}
