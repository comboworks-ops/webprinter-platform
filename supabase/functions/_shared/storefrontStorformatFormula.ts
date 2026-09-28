// Exact deployment-local mirror of src/utils/storformatPricing.ts.
// Parity tests compare this body and numerical behavior; do not change the formula here independently.
// BEGIN STOREFRONT FORMULA
import { resolveStorformatSourceQuote, StorformatQuoteUnavailableError } from "./storformatQuoteModel.ts";
export { StorformatQuoteUnavailableError, validateStorformatQuoteModel } from "./storformatQuoteModel.ts";
export type { StorformatSourceQuoteModel, StorformatQuotePoint, StorformatQuoteCombination } from "./storformatQuoteModel.ts";

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
  thumbnail_url?: string | null;
  max_width_mm?: number | null;
  max_height_mm?: number | null;
  allow_split?: boolean;
  interpolation_enabled?: boolean;
  markup_pct?: number | null;
  tiers: StorformatTier[];
};

export type StorformatFinish = {
  id?: string;
  name: string;
  group_label?: string | null;
  thumbnail_url?: string | null;
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
  thumbnail_url?: string | null;
  pricing_mode: "fixed" | "per_m2";
  initial_price?: number | null;
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
  area_pricing_basis?: "total_area" | "per_piece_quotes";
  source_quote_model?: unknown;
};

type SplitInfo = {
  isSplit: boolean;
  piecesWide: number;
  piecesHigh: number;
  totalPieces: number;
};

export type StorformatCalculationInput = {
  widthMm: number;
  heightMm: number;
  quantity: number;
  material: StorformatMaterial;
  finish?: StorformatFinish | null;
  finishes?: StorformatFinish[] | null;
  product?: StorformatProduct | null;
  products?: StorformatProduct[] | null;
  config: StorformatConfig;
};

export type StorformatCalculationResult = {
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
    const fallbackTier = totalArea < sorted[0].from_m2 ? sorted[0] : sorted[sorted.length - 1];
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
    const fallbackTier = totalArea < sorted[0].from_m2 ? sorted[0] : sorted[sorted.length - 1];
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
  finishes,
  product,
  products,
  config
}: StorformatCalculationInput): StorformatCalculationResult => {
  const areaM2 = (widthMm * heightMm) / 1_000_000;
  const totalAreaM2 = areaM2 * quantity;

  const basis = config.area_pricing_basis ?? "total_area";
  if (basis !== "total_area" && basis !== "per_piece_quotes") throw new StorformatQuoteUnavailableError();
  if (basis === "per_piece_quotes") {
    if (![widthMm, heightMm, areaM2, totalAreaM2].every(value => Number.isFinite(value) && value > 0)) {
      throw new StorformatQuoteUnavailableError("selection_unavailable");
    }
    const selectedFinishes = Array.isArray(finishes) && finishes.length ? finishes : finish ? [finish] : [];
    const selectedProducts = Array.isArray(products) && products.length ? products : product ? [product] : [];
    const quote = resolveStorformatSourceQuote({model: config.source_quote_model, materialId: material.id,
      finishIds: selectedFinishes.map(item => item.id), productIds: selectedProducts.map(item => item.id), areaM2, quantity});
    const mark = (price: number, markup?: number | null) => {
      const pct = markup ?? 0;
      if (!Number.isFinite(pct) || pct <= -100) throw new StorformatQuoteUnavailableError();
      return price * (1 + pct / 100);
    };
    const materialCost = mark(quote.baseTotal, material.markup_pct);
    const finishCost = mark(quote.finishedTotal - quote.baseTotal, selectedFinishes[0]?.markup_pct);
    const productCost = mark(quote.selectedTotal - quote.finishedTotal, selectedProducts[0]?.markup_pct);
    const rounding = config.rounding_step ?? 1;
    if (!Number.isFinite(rounding) || rounding <= 0) throw new StorformatQuoteUnavailableError();
    const subtotal = mark(materialCost + finishCost + productCost, config.global_markup_pct);
    const totalPrice = Math.round(subtotal / rounding) * rounding;
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) throw new StorformatQuoteUnavailableError();
    return {areaM2, totalAreaM2, materialPricePerM2: materialCost / totalAreaM2,
      finishPricePerM2: finishCost / totalAreaM2, productPricePerM2: productCost / totalAreaM2,
      materialCost, finishCost, productCost, totalPrice,
      splitInfo: material.allow_split ? buildSplitInfo(widthMm, heightMm, material) : null};
  }
  if (config.source_quote_model != null) throw new StorformatQuoteUnavailableError();

  const materialPricePerM2 = resolveTierPricePerM2(
    totalAreaM2,
    material.tiers || [],
    !!material.interpolation_enabled,
    material.markup_pct
  );

  const materialCost = materialPricePerM2 * totalAreaM2;

  const selectedFinishes = (
    Array.isArray(finishes) && finishes.length ? finishes : finish ? [finish] : []
  ).filter(Boolean);

  let finishPricePerM2 = 0;
  let finishCost = 0;
  selectedFinishes.forEach((selectedFinish) => {
    if (selectedFinish.pricing_mode === "fixed") {
      const base = (selectedFinish.fixed_price_per_unit || 0) * quantity;
      finishCost += applyMarkup(base, selectedFinish.markup_pct);
      return;
    }

    const componentPricePerM2 = resolveTierPricePerM2(
      totalAreaM2,
      selectedFinish.tiers || [],
      !!selectedFinish.interpolation_enabled,
      selectedFinish.markup_pct
    );
    finishPricePerM2 += componentPricePerM2;
    finishCost += componentPricePerM2 * totalAreaM2;
  });

  const selectedProducts = (
    Array.isArray(products) && products.length ? products : product ? [product] : []
  ).filter(Boolean);

  let productPricePerM2 = 0;
  let productCost = 0;
  selectedProducts.forEach((selectedProduct) => {
    if (selectedProduct.pricing_mode === "fixed") {
      const fixedPrice =
        (selectedProduct.fixed_prices || []).find((p) => p.quantity === quantity)?.price ?? 0;
      const base = (selectedProduct.initial_price || 0) + fixedPrice;
      productCost += applyMarkup(base, selectedProduct.markup_pct);
      return;
    }

    const componentPricePerM2 = resolveTierPricePerM2(
      totalAreaM2,
      selectedProduct.tiers || [],
      !!selectedProduct.interpolation_enabled,
      selectedProduct.markup_pct
    );
    productPricePerM2 += componentPricePerM2;
    productCost += componentPricePerM2 * totalAreaM2;
  });

  const subtotal = materialCost + finishCost + productCost;
  const markup = config.global_markup_pct || 0;
  const rounding = config.rounding_step || 1;
  const totalPrice = Math.round((subtotal * (1 + markup / 100)) / rounding) * rounding;

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

/** Quote-mode gaps are unavailable prices, never a fabricated zero or a legacy-rate fallback. */
export const tryCalculateStorformatPrice = (input: StorformatCalculationInput): StorformatCalculationResult | null => {
  try {
    return calculateStorformatPrice(input);
  } catch (error) {
    if (error instanceof StorformatQuoteUnavailableError) return null;
    throw error;
  }
};
