const SITE_CHECKOUT_SESSION_KEY = "wp_site_checkout_session";
const SITE_CHECKOUT_TRANSFER_KEY = "wp_site_checkout_transfer";
const SITE_CHECKOUT_DESIGN_READY_PREFIX = "order-design";
const SITE_CHECKOUT_DESIGN_SIGNATURE_PREFIX = "order-design-signature";

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
  designerMode?: string | null;
  pricingModel?: string | null;
  productFlowLabel?: string | null;
  productFlowHelpText?: string | null;
  checkoutTitle?: string | null;
  checkoutUploadTitle?: string | null;
  checkoutUploadHelpText?: string | null;
  selectedVariant?: string | null;
  quantity?: number | null;
  productPrice?: number | null;
  extraPrice?: number | null;
  totalPrice?: number | null;
  shippingCost?: number | null;
  summary?: string | null;
  selectedFormat?: string | null;
  linkedTemplateId?: string | null;
  templatePdfName?: string | null;
  templatePdfUrl?: string | null;
  templateDownloadedAt?: string | null;
  designWidthMm?: number | null;
  designHeightMm?: number | null;
  designBleedMm?: number | null;
  designSafeAreaMm?: number | null;
  shippingSelected?: string | null;
  optionSelections?: Record<string, unknown>;
  pricingQuote?: {
    productId?: string | null;
    productSlug?: string | null;
    quantity?: number | null;
    formatId?: string | null;
    materialId?: string | null;
    verticalValueId?: string | null;
    variantKey?: string | null;
    variantValueIds?: string[] | null;
    variantDisplayLabels?: string[] | null;
    selectedSectionValues?: Record<string, string | null> | null;
    optionIds?: string[] | null;
    shippingSelected?: string | null;
    areaM2?: number | null;
  } | null;
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

export function getSiteCheckoutDesignSignature(input: SiteCheckoutState | null | undefined): string {
  if (!input) return "";

  return stableJson({
    productId: input.productId || null,
    productSlug: input.productSlug || null,
    designerMode: input.designerMode || null,
    pricingModel: input.pricingModel || null,
    productFlowLabel: input.productFlowLabel || null,
    selectedVariant: input.selectedVariant || null,
    selectedFormat: input.selectedFormat || null,
    linkedTemplateId: input.linkedTemplateId || null,
    templatePdfName: input.templatePdfName || null,
    templatePdfUrl: input.templatePdfUrl || null,
    quantity: Number(input.quantity || 0),
    summary: input.summary || null,
    designWidthMm: input.designWidthMm ?? null,
    designHeightMm: input.designHeightMm ?? null,
    designBleedMm: input.designBleedMm ?? null,
    designSafeAreaMm: input.designSafeAreaMm ?? null,
    optionSelections: input.optionSelections || null,
    pricingQuote: input.pricingQuote || null,
  });
}

export function getSiteCheckoutDesignReadyKey(productId: string): string {
  return `${SITE_CHECKOUT_DESIGN_READY_PREFIX}:${productId}`;
}

export function getSiteCheckoutDesignSignatureKey(productId: string): string {
  return `${SITE_CHECKOUT_DESIGN_SIGNATURE_PREFIX}:${productId}`;
}

export function markSiteCheckoutDesignReady(productId: string, state?: SiteCheckoutState | null): void {
  if (!isBrowser() || !productId) return;

  sessionStorage.setItem(getSiteCheckoutDesignReadyKey(productId), "1");
  sessionStorage.setItem(getSiteCheckoutDesignSignatureKey(productId), getSiteCheckoutDesignSignature(state || readSiteCheckoutSession()));
}

export function clearSiteCheckoutDesignReady(productId: string): void {
  if (!isBrowser() || !productId) return;

  sessionStorage.removeItem(getSiteCheckoutDesignReadyKey(productId));
  sessionStorage.removeItem(getSiteCheckoutDesignSignatureKey(productId));
}

export function isSiteCheckoutDesignReady(productId: string, state?: SiteCheckoutState | null): boolean {
  if (!isBrowser() || !productId) return false;
  if (sessionStorage.getItem(getSiteCheckoutDesignReadyKey(productId)) !== "1") return false;

  const expectedSignature = getSiteCheckoutDesignSignature(state || readSiteCheckoutSession());
  const storedSignature = sessionStorage.getItem(getSiteCheckoutDesignSignatureKey(productId));

  return Boolean(expectedSignature && storedSignature && expectedSignature === storedSignature);
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
