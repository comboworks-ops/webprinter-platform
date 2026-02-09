import {
  calculateFinishPrice as calculateFinishPriceV2,
  calculateM2Price,
  calculateProductPriceV2,
  type StorformatFinishPrice,
  type StorformatM2Price,
  type StorformatProductV2,
  type StorformatProductM2Price,
  type VisibilityType,
  type ProductPricingType,
} from "@/lib/storformat-pricing/types";

export type StorformatTier = {
  id?: string;
  from_m2: number;
  to_m2?: number | null;
  price_per_m2: number;
  is_anchor?: boolean;
  markup_pct?: number | null;
};

export type StorformatMaterial = {
  id?: string;
  name: string;
  group_label?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  design_library_item_id?: string | null;
  visibility?: VisibilityType;
  max_width_mm?: number | null;
  max_height_mm?: number | null;
  allow_split?: boolean;
  interpolation_enabled?: boolean;
  markup_pct?: number | null;
  // Minimum price for this material regardless of size
  min_price?: number | null;
  tiers: StorformatTier[];
};

export type StorformatFinish = {
  id?: string;
  name: string;
  group_label?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  visibility?: VisibilityType;
  pricing_mode: "fixed" | "per_m2";
  fixed_price_per_unit?: number | null;
  interpolation_enabled?: boolean;
  markup_pct?: number | null;
  tiers: StorformatTier[];
};

export type StorformatFixedPrice = {
  id?: string;
  quantity: number;
  price: number;
};

export type StorformatProduct = {
  id?: string;
  name: string;
  group_label?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  visibility?: VisibilityType;
  is_template?: boolean;
  // Legacy pricing mode (for backward compatibility)
  pricing_mode?: "fixed" | "per_m2";
  // New pricing type (fixed, percentage, m2)
  pricing_type?: ProductPricingType;
  initial_price?: number | null;
  // For percentage pricing - markup on material cost
  percentage_markup?: number | null;
  // Minimum price for 0-1m² range
  min_price?: number | null;
  interpolation_enabled?: boolean;
  markup_pct?: number | null;
  tiers: StorformatTier[];
  fixed_prices?: StorformatFixedPrice[];
};

export type StorformatConfig = {
  rounding_step: number;
  global_markup_pct: number;
  quantities: number[];
  layout_rows?: any[];
  vertical_axis?: any;
  pricing_mode?: "legacy" | "m2_rates";
};

type SplitInfo = {
  isSplit: boolean;
  piecesWide: number;
  piecesHigh: number;
  totalPieces: number;
};

type StorformatCalculationInput = {
  widthMm: number;
  heightMm: number;
  quantity: number;
  material: StorformatMaterial;
  finish?: StorformatFinish | null;
  product?: StorformatProduct | null;
  config: StorformatConfig;
};

type StorformatCalculationResult = {
  areaM2: number;
  totalAreaM2: number;
  materialPricePerM2: number;
  finishPricePerM2: number;
  productPricePerM2: number;
  materialCost: number;
  finishCost: number;
  productCost: number;
  totalPrice: number;
  splitInfo: SplitInfo | null;
};

const applyMarkup = (price: number, markupPct?: number | null) => {
  const pct = Number(markupPct) || 0;
  return price * (1 + pct / 100);
};

const resolveTierPricePerM2 = (
  totalArea: number,
  tiers: StorformatTier[],
  interpolationEnabled: boolean,
  itemMarkupPct?: number | null
) => {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.from_m2 - b.from_m2);
  const match = sorted.find((t) => {
    const to = t.to_m2 ?? Number.POSITIVE_INFINITY;
    return totalArea >= t.from_m2 && totalArea <= to;
  });

  if (!interpolationEnabled) {
    const fallbackTier = sorted[sorted.length - 1];
    const basePrice = match?.price_per_m2 ?? fallbackTier.price_per_m2;
    const tierMarkup = match?.markup_pct ?? fallbackTier.markup_pct ?? 0;
    return applyMarkup(applyMarkup(basePrice, tierMarkup), itemMarkupPct);
  }

  const isOverride = (tier?: StorformatTier | null) =>
    !!tier && !tier.is_anchor && Number(tier.markup_pct) !== 0;

  if (match && (match.is_anchor || isOverride(match))) {
    const basePrice = match.price_per_m2;
    const tierMarkup = match.markup_pct ?? 0;
    return applyMarkup(applyMarkup(basePrice, tierMarkup), itemMarkupPct);
  }

  const anchors = sorted.filter((t) => t.is_anchor);
  if (anchors.length < 2) {
    const fallbackTier = sorted[sorted.length - 1];
    const basePrice = match?.price_per_m2 ?? fallbackTier.price_per_m2;
    const tierMarkup = match?.markup_pct ?? fallbackTier.markup_pct ?? 0;
    return applyMarkup(applyMarkup(basePrice, tierMarkup), itemMarkupPct);
  }
  const sortedAnchors = [...anchors].sort((a, b) => a.from_m2 - b.from_m2);

  let lower = sortedAnchors[0];
  let upper = sortedAnchors[sortedAnchors.length - 1];

  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    if (totalArea >= sortedAnchors[i].from_m2 && totalArea <= sortedAnchors[i + 1].from_m2) {
      lower = sortedAnchors[i];
      upper = sortedAnchors[i + 1];
      break;
    }
  }

  const lowerPrice = applyMarkup(
    applyMarkup(lower.price_per_m2, lower.markup_pct ?? 0),
    itemMarkupPct
  );
  const upperPrice = applyMarkup(
    applyMarkup(upper.price_per_m2, upper.markup_pct ?? 0),
    itemMarkupPct
  );

  if (totalArea <= lower.from_m2) return lowerPrice;
  if (totalArea >= upper.from_m2) return upperPrice;

  const t = (totalArea - lower.from_m2) / (upper.from_m2 - lower.from_m2);
  return lowerPrice + t * (upperPrice - lowerPrice);
};

const buildSplitInfo = (widthMm: number, heightMm: number, material: StorformatMaterial): SplitInfo | null => {
  const maxW = material.max_width_mm ?? 0;
  const maxH = material.max_height_mm ?? 0;
  if (!maxW || !maxH) return null;
  if (widthMm <= maxW && heightMm <= maxH) return null;

  const piecesWide = Math.max(1, Math.ceil(widthMm / maxW));
  const piecesHigh = Math.max(1, Math.ceil(heightMm / maxH));
  return {
    isSplit: true,
    piecesWide,
    piecesHigh,
    totalPieces: piecesWide * piecesHigh
  };
};

export const calculateStorformatPrice = ({
  widthMm,
  heightMm,
  quantity,
  material,
  finish,
  product,
  config
}: StorformatCalculationInput): StorformatCalculationResult => {
  const areaM2 = (widthMm * heightMm) / 1_000_000;
  const totalAreaM2 = areaM2 * quantity;

  const materialPricePerM2 = resolveTierPricePerM2(
    totalAreaM2,
    material.tiers || [],
    !!material.interpolation_enabled,
    material.markup_pct
  );

  const materialCost = materialPricePerM2 * totalAreaM2;

  let finishPricePerM2 = 0;
  let finishCost = 0;
  if (finish) {
    if (finish.pricing_mode === "fixed") {
      const base = (finish.fixed_price_per_unit || 0) * quantity;
      finishCost = applyMarkup(base, finish.markup_pct);
    } else {
      finishPricePerM2 = resolveTierPricePerM2(
        totalAreaM2,
        finish.tiers || [],
        !!finish.interpolation_enabled,
        finish.markup_pct
      );
      finishCost = finishPricePerM2 * totalAreaM2;
    }
  }

  let productPricePerM2 = 0;
  let productCost = 0;
  if (product) {
    // Determine pricing type - use new pricing_type if available, fallback to pricing_mode
    const pricingType = product.pricing_type ||
      (product.pricing_mode === "fixed" ? "fixed" : "m2");

    switch (pricingType) {
      case "fixed": {
        const fixedPrice = (product.fixed_prices || []).find((p) => p.quantity === quantity)?.price ?? 0;
        const base = (product.initial_price || 0) + fixedPrice;
        productCost = applyMarkup(base, product.markup_pct);
        break;
      }
      case "per_item":
      case "percentage": {
        // Per-item: look up fixed price for the quantity
        const perItemPrice = (product.fixed_prices || []).find((p) => p.quantity === quantity)?.price ?? 0;
        productCost = applyMarkup(perItemPrice, product.markup_pct);
        break;
      }
      case "m2":
      default: {
        productPricePerM2 = resolveTierPricePerM2(
          totalAreaM2,
          product.tiers || [],
          !!product.interpolation_enabled,
          product.markup_pct
        );
        productCost = productPricePerM2 * totalAreaM2;
        break;
      }
    }
  }

  const subtotal = materialCost + finishCost + productCost;
  const markup = config.global_markup_pct || 0;
  const rounding = config.rounding_step || 1;
  let totalPrice = Math.round((subtotal * (1 + markup / 100)) / rounding) * rounding;

  // Enforce minimum price - material min_price takes precedence over product min_price
  const minPrice = material.min_price ?? product?.min_price ?? 0;
  if (minPrice > 0 && totalPrice < minPrice) {
    totalPrice = minPrice;
  }

  return {
    areaM2,
    totalAreaM2,
    materialPricePerM2,
    finishPricePerM2,
    productPricePerM2,
    materialCost,
    finishCost,
    productCost,
    totalPrice,
    splitInfo: material.allow_split ? buildSplitInfo(widthMm, heightMm, material) : null
  };
};

type StorformatM2CalculationInput = {
  widthMm: number;
  heightMm: number;
  quantity: number;
  material: StorformatMaterial;
  materialPrices: StorformatM2Price[];
  finish?: StorformatFinish | null;
  finishPrice?: StorformatFinishPrice | null;
  product?: StorformatProduct | null;
  config: StorformatConfig;
};

export const calculateStorformatM2Price = ({
  widthMm,
  heightMm,
  quantity,
  material,
  materialPrices,
  finish,
  finishPrice,
  product,
  config
}: StorformatM2CalculationInput): StorformatCalculationResult => {
  const areaM2 = (widthMm * heightMm) / 1_000_000;
  const totalAreaM2 = areaM2 * quantity;

  const materialBase = calculateM2Price(
    areaM2,
    quantity,
    materialPrices || [],
    !!material.interpolation_enabled
  );
  const materialCost = applyMarkup(materialBase, material.markup_pct);
  const materialPricePerM2 = totalAreaM2 > 0 ? materialCost / totalAreaM2 : 0;

  let finishPricePerM2 = 0;
  let finishCost = 0;
  if (finishPrice) {
    const finishBase = calculateFinishPriceV2(areaM2, quantity, finishPrice);
    finishCost = applyMarkup(finishBase, finish?.markup_pct ?? 0);
    if (finishPrice.pricing_mode === "per_m2" && totalAreaM2 > 0) {
      finishPricePerM2 = finishCost / totalAreaM2;
    }
  }

  let productPricePerM2 = 0;
  let productCost = 0;
  if (product) {
    // Determine pricing type - use new pricing_type if available, fallback to pricing_mode
    const pricingType = product.pricing_type ||
      (product.pricing_mode === "fixed" ? "fixed" : "m2");

    switch (pricingType) {
      case "fixed": {
        const fixedPrice = (product.fixed_prices || []).find((p) => p.quantity === quantity)?.price ?? 0;
        const base = (product.initial_price || 0) + fixedPrice;
        productCost = applyMarkup(base, product.markup_pct);
        break;
      }
      case "per_item":
      case "percentage": {
        // Per-item: look up fixed price for the quantity
        const perItemPrice = (product.fixed_prices || []).find((p) => p.quantity === quantity)?.price ?? 0;
        productCost = applyMarkup(perItemPrice, product.markup_pct);
        break;
      }
      case "m2":
      default: {
        productPricePerM2 = resolveTierPricePerM2(
          totalAreaM2,
          product.tiers || [],
          !!product.interpolation_enabled,
          product.markup_pct
        );
        productCost = productPricePerM2 * totalAreaM2;
        break;
      }
    }
  }

  const subtotal = materialCost + finishCost + productCost;
  const markup = config.global_markup_pct || 0;
  const rounding = config.rounding_step || 1;
  let totalPrice = Math.round((subtotal * (1 + markup / 100)) / rounding) * rounding;

  // Enforce minimum price - material min_price takes precedence over product min_price
  const minPrice = material.min_price ?? product?.min_price ?? 0;
  if (minPrice > 0 && totalPrice < minPrice) {
    totalPrice = minPrice;
  }

  return {
    areaM2,
    totalAreaM2,
    materialPricePerM2,
    finishPricePerM2,
    productPricePerM2,
    materialCost,
    finishCost,
    productCost,
    totalPrice,
    splitInfo: material.allow_split ? buildSplitInfo(widthMm, heightMm, material) : null
  };
};
