/**
 * Storformat M² Pricing Types
 *
 * New simplified pricing model:
 * - Materials are just names/metadata
 * - M² rates stored separately in storformat_m2_prices
 * - Smart Price Generator manages tiered rates
 */

export type StorformatPricingMode = 'legacy' | 'm2_rates';

// Layout display modes: classic modes + picture size modes
export type LayoutDisplayMode = 'buttons' | 'dropdown' | 'checkboxes' | 'small' | 'medium' | 'large' | 'xl';

// Picture size subset
export type PictureSizeMode = 'small' | 'medium' | 'large' | 'xl';

// Picture size configurations (in pixels)
export const PICTURE_SIZES: Record<PictureSizeMode, { width: number; height: number }> = {
  small: { width: 40, height: 40 },
  medium: { width: 64, height: 64 },
  large: { width: 96, height: 96 },
  xl: { width: 128, height: 128 },
};

// Product pricing types
export type ProductPricingType = 'fixed' | 'per_item' | 'm2';

// Visibility type for sharing
export type VisibilityType = 'tenant' | 'public';

// Simplified material (no embedded pricing)
export interface StorformatMaterialSimple {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  group_label?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  design_library_item_id?: string | null;
  visibility?: VisibilityType;
  bleed_mm: number;
  safe_area_mm: number;
  max_width_mm?: number | null;
  max_height_mm?: number | null;
  allow_split: boolean;
  sort_order: number;
}

// M² price tier (stored separately)
export interface StorformatM2Price {
  id: string;
  tenant_id: string;
  product_id: string;
  material_id: string;
  from_m2: number;
  to_m2?: number | null;
  price_per_m2: number;
  is_anchor: boolean;
}

// Simplified finish (no embedded tier pricing)
export interface StorformatFinishSimple {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  group_label?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  visibility?: VisibilityType;
  sort_order: number;
}

// Fixed price per quantity (for per_item pricing)
export interface StorformatProductFixedPrice {
  id?: string;
  tenant_id?: string;
  product_id?: string;
  storformat_product_id: string;
  quantity: number;
  price: number;
}

// Enhanced product type with pricing options
export interface StorformatProductV2 {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  group_label?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  visibility: VisibilityType;
  is_template: boolean;
  pricing_type: ProductPricingType;
  // For 'fixed' pricing
  initial_price?: number;
  // For 'per_item' pricing - uses storformat_product_fixed_prices table
  fixed_prices?: StorformatProductFixedPrice[];
  // For 'm2' pricing - uses separate storformat_product_m2_prices table
  sort_order: number;
}

// Product M2 price tier (for products with m2-based pricing)
export interface StorformatProductM2Price {
  id: string;
  tenant_id: string;
  product_id: string;
  storformat_product_id: string;
  from_m2: number;
  to_m2?: number | null;
  price_per_m2: number;
  is_anchor: boolean;
}

// Finish pricing (stored separately)
export interface StorformatFinishPrice {
  id: string;
  tenant_id: string;
  product_id: string;
  finish_id: string;
  pricing_mode: 'fixed' | 'per_m2';
  fixed_price: number;
  price_per_m2: number;
}

// Config with pricing mode
export interface StorformatConfigV2 {
  id: string;
  tenant_id: string;
  product_id: string;
  pricing_mode: StorformatPricingMode;
  rounding_step: number;
  global_markup_pct: number;
  quantities: number[];
  layout_rows?: any[];
  vertical_axis?: any;
  is_published?: boolean;
}

// Anchor point for Smart Price Generator
export interface M2AnchorPoint {
  from_m2: number;
  price_per_m2: number;
}

// Preset tier ranges (common configurations)
export const PRESET_M2_TIERS = [
  { from_m2: 0, to_m2: 1 },
  { from_m2: 1, to_m2: 3 },
  { from_m2: 3, to_m2: 5 },
  { from_m2: 5, to_m2: 10 },
  { from_m2: 10, to_m2: 20 },
  { from_m2: 20, to_m2: 50 },
  { from_m2: 50, to_m2: null },  // 50+ m²
];

// Calculate price using new M² rate system
export function calculateM2Price(
  areaM2: number,
  quantity: number,
  prices: StorformatM2Price[],
  interpolate: boolean = true
): number {
  const totalArea = areaM2 * quantity;

  if (prices.length === 0) return 0;

  // Sort by from_m2
  const sorted = [...prices].sort((a, b) => a.from_m2 - b.from_m2);

  // Find matching tier
  const matchingTier = sorted.find(tier => {
    const toM2 = tier.to_m2 ?? Number.POSITIVE_INFINITY;
    return totalArea >= tier.from_m2 && totalArea <= toM2;
  });

  if (!interpolate || !matchingTier) {
    // Use direct tier price or last tier
    const tier = matchingTier || sorted[sorted.length - 1];
    return tier.price_per_m2 * totalArea;
  }

  // Interpolation between anchor points
  const anchors = sorted.filter(t => t.is_anchor);
  if (anchors.length < 2) {
    return matchingTier.price_per_m2 * totalArea;
  }

  // Find surrounding anchors
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];

  for (let i = 0; i < anchors.length - 1; i++) {
    if (totalArea >= anchors[i].from_m2 && totalArea <= anchors[i + 1].from_m2) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }

  // Linear interpolation
  if (totalArea <= lower.from_m2) return lower.price_per_m2 * totalArea;
  if (totalArea >= upper.from_m2) return upper.price_per_m2 * totalArea;

  const t = (totalArea - lower.from_m2) / (upper.from_m2 - lower.from_m2);
  const interpolatedRate = lower.price_per_m2 + t * (upper.price_per_m2 - lower.price_per_m2);

  return interpolatedRate * totalArea;
}

// Calculate finish price
export function calculateFinishPrice(
  areaM2: number,
  quantity: number,
  finishPrice: StorformatFinishPrice | null
): number {
  if (!finishPrice) return 0;

  if (finishPrice.pricing_mode === 'fixed') {
    return finishPrice.fixed_price * quantity;
  }

  return finishPrice.price_per_m2 * areaM2 * quantity;
}

// Calculate product price based on pricing type
export function calculateProductPriceV2(
  areaM2: number,
  quantity: number,
  product: StorformatProductV2 | null,
  productM2Prices: StorformatProductM2Price[]
): number {
  if (!product) return 0;

  switch (product.pricing_type) {
    case 'fixed':
      return (product.initial_price || 0) * quantity;

    case 'per_item': {
      // Look up fixed price for the exact quantity
      const fixedPrices = product.fixed_prices || [];
      const match = fixedPrices.find(fp => fp.quantity === quantity);
      if (match) return match.price;
      // If no exact match, find closest quantity that doesn't exceed
      const sorted = [...fixedPrices].sort((a, b) => a.quantity - b.quantity);
      const closest = sorted.filter(fp => fp.quantity <= quantity).pop();
      return closest ? closest.price : (sorted[0]?.price || 0);
    }

    case 'm2':
      // Use m2-based pricing with interpolation
      const prices = productM2Prices.filter(p => p.storformat_product_id === product.id);
      return calculateM2PriceGeneric(areaM2, quantity, prices);

    default:
      return 0;
  }
}

// Generic M2 price calculation (works with any M2 price array)
export function calculateM2PriceGeneric(
  areaM2: number,
  quantity: number,
  prices: Array<{ from_m2: number; to_m2?: number | null; price_per_m2: number; is_anchor: boolean }>,
  interpolate: boolean = true
): number {
  const totalArea = areaM2 * quantity;

  if (prices.length === 0) return 0;

  // Sort by from_m2
  const sorted = [...prices].sort((a, b) => a.from_m2 - b.from_m2);

  // Find matching tier
  const matchingTier = sorted.find(tier => {
    const toM2 = tier.to_m2 ?? Number.POSITIVE_INFINITY;
    return totalArea >= tier.from_m2 && totalArea <= toM2;
  });

  if (!interpolate || !matchingTier) {
    // Use direct tier price or last tier
    const tier = matchingTier || sorted[sorted.length - 1];
    return tier.price_per_m2 * totalArea;
  }

  // Interpolation between anchor points
  const anchors = sorted.filter(t => t.is_anchor);
  if (anchors.length < 2) {
    return matchingTier.price_per_m2 * totalArea;
  }

  // Find surrounding anchors
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];

  for (let i = 0; i < anchors.length - 1; i++) {
    if (totalArea >= anchors[i].from_m2 && totalArea <= anchors[i + 1].from_m2) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }

  // Linear interpolation
  if (totalArea <= lower.from_m2) return lower.price_per_m2 * totalArea;
  if (totalArea >= upper.from_m2) return upper.price_per_m2 * totalArea;

  const t = (totalArea - lower.from_m2) / (upper.from_m2 - lower.from_m2);
  const interpolatedRate = lower.price_per_m2 + t * (upper.price_per_m2 - lower.price_per_m2);

  return interpolatedRate * totalArea;
}
