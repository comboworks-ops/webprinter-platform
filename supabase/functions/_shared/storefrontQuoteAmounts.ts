import { CheckoutError, UUID } from "./storefrontCheckout.ts";

export function assertQuoteableProduct(product: any,tenantId: string): void {
  if (!product || product.tenant_id !== tenantId || product.is_published !== true) throw new CheckoutError("checkout_product_unavailable",409);
  // Fixed/rate labels use the current storefront's generic matrix path. They
  // still require a unique stored generic price; no global legacy-rate fallback.
  if (!["matrix","fixed","rate","storformat"].includes(String(product.pricing_type).toLowerCase())) {
    throw new CheckoutError("checkout_pricing_model_unsupported",422);
  }
}

export function roundCheckoutAmounts(productDkk: number,optionsDkk: number,shippingDkk: number) {
  if ([productDkk,optionsDkk,shippingDkk].some(value => !Number.isFinite(value) || value < 0)) {
    throw new CheckoutError("checkout_invalid_amount",409);
  }
  // Same independent whole-DKK normalization as ProductPricePanel, lines473-475.
  const productPriceOre = Math.round(productDkk) * 100;
  const optionExtraOre = Math.round(optionsDkk) * 100;
  const shippingOre = Math.round(shippingDkk) * 100;
  return {productPriceOre,optionExtraOre,shippingOre,amountOre: productPriceOre + optionExtraOre + shippingOre};
}

export function verifiedFormatArea(format: any,quote: any,priceRow: any): number {
  const formatId = quote.formatId;
  const storedRowIds = [priceRow.selectionMapFormat,...String(priceRow.variant_name || "").split("|")];
  if (!UUID.test(String(formatId || "")) || !format || format.id !== formatId || !storedRowIds.includes(formatId)) {
    throw new CheckoutError("checkout_format_dimensions_unverified",409);
  }
  const width = Number(format.width_mm),height = Number(format.height_mm);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new CheckoutError("checkout_format_dimensions_unverified",409);
  }
  if (quote.widthMm != null && (!Number.isFinite(Number(quote.widthMm)) || Math.abs(Number(quote.widthMm) - width) > 0.000001)
    || quote.heightMm != null && (!Number.isFinite(Number(quote.heightMm)) || Math.abs(Number(quote.heightMm) - height) > 0.000001)) {
    throw new CheckoutError("checkout_dimensions_mismatch",409);
  }
  const area = width * height / 1_000_000;
  if (quote.areaM2 != null && (!Number.isFinite(Number(quote.areaM2)) || Math.abs(Number(quote.areaM2) - area) > 0.000001)) {
    throw new CheckoutError("checkout_area_mismatch",409);
  }
  return area;
}

export function calculateVerifiedOptionExtras(options: any[],quantity: number,areaM2: number | null): number {
  return options.reduce((sum,option) => {
    const price = Number(option.extra_price || 0),mode = option.price_mode || "fixed";
    if (!Number.isFinite(price) || price < 0) throw new CheckoutError("checkout_option_price_invalid",409);
    if (mode === "fixed") return sum + price;
    if (mode === "per_quantity") return sum + price * quantity;
    if (mode === "per_area") {
      if (areaM2 == null || !Number.isFinite(areaM2) || areaM2 <= 0) throw new CheckoutError("checkout_format_dimensions_unverified",409);
      return sum + price * areaM2 * quantity;
    }
    throw new CheckoutError("checkout_pricing_model_unsupported",422);
  },0);
}
