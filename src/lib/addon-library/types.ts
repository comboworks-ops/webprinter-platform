/**
 * Addon Library Types
 *
 * Shared add-ons that can be imported into both Tryksager and Storformat products.
 */

// =============================================================================
// Category and Display Types
// =============================================================================

export type AddonCategory = 'addon' | 'finish' | 'accessory' | 'service' | 'material';

export type AddonDisplayType = 'buttons' | 'icon_grid' | 'dropdown' | 'checkboxes';

export type AddonPricingMode = 'fixed' | 'per_quantity' | 'per_area' | 'tiered';

export type AddonImportMode = 'reference' | 'copy';

// =============================================================================
// Library Group
// =============================================================================

export interface AddonLibraryGroup {
  id: string;
  tenant_id: string;
  name: string;
  display_label: string;
  description?: string | null;
  category: AddonCategory;
  display_type: AddonDisplayType;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AddonLibraryGroupInput {
  name: string;
  display_label: string;
  description?: string | null;
  category?: AddonCategory;
  display_type?: AddonDisplayType;
  sort_order?: number;
}

// =============================================================================
// Library Item
// =============================================================================

export interface AddonLibraryItem {
  id: string;
  tenant_id: string;
  group_id: string;
  name: string;
  display_label: string;
  description?: string | null;
  icon_url?: string | null;
  thumbnail_url?: string | null;
  pricing_mode: AddonPricingMode;
  base_price: number;
  markup_pct: number;
  sort_order: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AddonLibraryItemInput {
  group_id: string;
  name: string;
  display_label: string;
  description?: string | null;
  icon_url?: string | null;
  thumbnail_url?: string | null;
  pricing_mode?: AddonPricingMode;
  base_price?: number;
  markup_pct?: number;
  sort_order?: number;
  enabled?: boolean;
}

// =============================================================================
// Price Tiers (for tiered/per_area pricing)
// =============================================================================

export interface AddonLibraryPriceTier {
  id: string;
  tenant_id: string;
  addon_item_id: string;
  from_m2: number;
  to_m2?: number | null;
  price_per_m2: number;
  is_anchor: boolean;
  markup_pct: number;
  sort_order: number;
  created_at?: string;
}

export interface AddonLibraryPriceTierInput {
  addon_item_id: string;
  from_m2: number;
  to_m2?: number | null;
  price_per_m2: number;
  is_anchor?: boolean;
  markup_pct?: number;
  sort_order?: number;
}

// =============================================================================
// Fixed Prices (for quantity-based pricing)
// =============================================================================

export interface AddonLibraryFixedPrice {
  id: string;
  tenant_id: string;
  addon_item_id: string;
  quantity: number;
  price: number;
  sort_order: number;
  created_at?: string;
}

export interface AddonLibraryFixedPriceInput {
  addon_item_id: string;
  quantity: number;
  price: number;
  sort_order?: number;
}

// =============================================================================
// Product Import (links library group to a product)
// =============================================================================

export interface ProductAddonImport {
  id: string;
  tenant_id: string;
  product_id: string;
  addon_group_id: string;
  import_mode: AddonImportMode;
  override_label?: string | null;
  override_display_type?: AddonDisplayType | null;
  is_required: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductAddonImportInput {
  product_id: string;
  addon_group_id: string;
  import_mode?: AddonImportMode;
  override_label?: string | null;
  override_display_type?: AddonDisplayType | null;
  is_required?: boolean;
  sort_order?: number;
}

// =============================================================================
// Item Override (per-product price/setting overrides)
// =============================================================================

export interface ProductAddonItemOverride {
  id: string;
  tenant_id: string;
  product_id: string;
  addon_item_id: string;
  override_price?: number | null;
  override_pricing_mode?: AddonPricingMode | null;
  override_markup_pct?: number | null;
  is_enabled: boolean;
  override_sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductAddonItemOverrideInput {
  product_id: string;
  addon_item_id: string;
  override_price?: number | null;
  override_pricing_mode?: AddonPricingMode | null;
  override_markup_pct?: number | null;
  is_enabled?: boolean;
  override_sort_order?: number | null;
}

// =============================================================================
// Resolved Types (for customer-facing display)
// =============================================================================

/**
 * A fully resolved add-on item with all overrides applied.
 * Used for displaying add-ons on the product page.
 */
export interface ResolvedAddonItem {
  id: string;
  group_id: string;
  name: string;
  display_label: string;
  description?: string | null;
  icon_url?: string | null;
  thumbnail_url?: string | null;
  pricing_mode: AddonPricingMode;
  base_price: number;
  markup_pct: number;
  sort_order: number;
  enabled: boolean;
  // From library
  is_from_library: true;
  library_item_id: string;
  // Override info
  has_override: boolean;
}

/**
 * A fully resolved add-on group with all items and overrides applied.
 */
export interface ResolvedAddonGroup {
  id: string;
  name: string;
  display_label: string;
  description?: string | null;
  category: AddonCategory;
  display_type: AddonDisplayType;
  sort_order: number;
  is_required: boolean;
  // From library
  is_from_library: true;
  library_group_id: string;
  import_mode: AddonImportMode;
  // Items with overrides applied
  items: ResolvedAddonItem[];
}

// =============================================================================
// Price Calculation Types
// =============================================================================

export interface AddonPriceCalculationParams {
  item: AddonLibraryItem;
  tiers?: AddonLibraryPriceTier[];
  fixedPrices?: AddonLibraryFixedPrice[];
  override?: ProductAddonItemOverride | null;
  quantity: number;
  areaM2?: number;
}

export interface AddonPriceCalculationResult {
  unitPrice: number;
  totalPrice: number;
  pricingMode: AddonPricingMode;
  hasMarkup: boolean;
}

// =============================================================================
// Group with Items (for admin UI)
// =============================================================================

export interface AddonLibraryGroupWithItems extends AddonLibraryGroup {
  items: AddonLibraryItem[];
  usage_count?: number; // Number of products using this group
}

export interface AddonLibraryItemWithPricing extends AddonLibraryItem {
  tiers: AddonLibraryPriceTier[];
  fixed_prices: AddonLibraryFixedPrice[];
}
