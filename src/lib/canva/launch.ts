export type TenantCanvaSettings = {
  enabled?: boolean;
  button_label?: string | null;
  helper_text?: string | null;
};

export type ProductCanvaSettings = {
  enabled?: boolean;
  template_url?: string | null;
  button_label?: string | null;
  helper_text?: string | null;
};

export type CanvaLaunchContext = {
  productId?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  bleedMm?: number | null;
  safeAreaMm?: number | null;
  selectedFormat?: string | null;
  returnUrl?: string | null;
};

export type ResolvedCanvaOffer = {
  enabled: boolean;
  launchUrl: string | null;
  buttonLabel: string;
  helperText: string | null;
};

const DEFAULT_BUTTON_LABEL = "Design i Canva";

function replacePlaceholder(template: string, key: string, value: string | number | null | undefined): string {
  return template.replaceAll(`{${key}}`, value === null || value === undefined ? "" : String(value));
}

export function buildCanvaLaunchUrl(
  templateUrl: string | null | undefined,
  context: CanvaLaunchContext,
): string | null {
  const normalized = String(templateUrl || "").trim();
  if (!normalized) return null;

  let resolved = normalized;
  resolved = replacePlaceholder(resolved, "product_id", context.productId);
  resolved = replacePlaceholder(resolved, "product_slug", context.productSlug);
  resolved = replacePlaceholder(resolved, "product_name", context.productName);
  resolved = replacePlaceholder(resolved, "width_mm", context.widthMm);
  resolved = replacePlaceholder(resolved, "height_mm", context.heightMm);
  resolved = replacePlaceholder(resolved, "bleed_mm", context.bleedMm);
  resolved = replacePlaceholder(resolved, "safe_area_mm", context.safeAreaMm);
  resolved = replacePlaceholder(resolved, "selected_format", context.selectedFormat);
  resolved = replacePlaceholder(
    resolved,
    "return_url",
    context.returnUrl ? encodeURIComponent(context.returnUrl) : "",
  );

  return resolved;
}

export function resolveCanvaOffer(
  tenantSettings: TenantCanvaSettings | null | undefined,
  productSettings: ProductCanvaSettings | null | undefined,
  context: CanvaLaunchContext,
): ResolvedCanvaOffer {
  const tenantEnabled = tenantSettings?.enabled === true;
  const productEnabled = productSettings?.enabled === true;
  const launchUrl = buildCanvaLaunchUrl(productSettings?.template_url, context);

  return {
    enabled: tenantEnabled && productEnabled && Boolean(launchUrl),
    launchUrl,
    buttonLabel: String(
      productSettings?.button_label
      || tenantSettings?.button_label
      || DEFAULT_BUTTON_LABEL,
    ),
    helperText: String(
      productSettings?.helper_text
      || tenantSettings?.helper_text
      || "",
    ).trim() || null,
  };
}
