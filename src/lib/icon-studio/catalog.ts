export const ICON_STUDIO_PRODUCT_KEYS = [
  "business_card",
  "folded_business_card",
  "flyer",
  "leaflet",
  "brochure",
  "booklet",
  "presentation_folder",
  "document_folder",
  "envelope",
  "sticker",
  "product_label",
  "poster",
  "rollup_banner",
  "pvc_banner",
  "mesh_banner",
  "textile_banner",
  "beach_flag",
  "menu_card",
  "postcard",
  "hang_tag",
  "calendar",
  "softcover_book",
  "hardcover_book",
  "invitation_card",
  "ticket",
  "badge",
] as const;

export type IconStudioProductKey = (typeof ICON_STUDIO_PRODUCT_KEYS)[number];

const PRODUCT_LABELS: Record<IconStudioProductKey, string> = {
  business_card: "Visitkort",
  folded_business_card: "Foldet visitkort",
  flyer: "Flyer",
  leaflet: "Leaflet",
  brochure: "Brochure",
  booklet: "Hæfte",
  presentation_folder: "Præsentationsmappe",
  document_folder: "Dokumentmappe",
  envelope: "Konvolut",
  sticker: "Klistermærke",
  product_label: "Produktetiket",
  poster: "Plakat",
  rollup_banner: "Roll-up banner",
  pvc_banner: "PVC banner",
  mesh_banner: "Mesh banner",
  textile_banner: "Tekstilbanner",
  beach_flag: "Beachflag",
  menu_card: "Menukort",
  postcard: "Postkort",
  hang_tag: "Hangtag",
  calendar: "Kalender",
  softcover_book: "Softcover bog",
  hardcover_book: "Hardcover bog",
  invitation_card: "Invitation",
  ticket: "Billet",
  badge: "Badge",
};

export const ICON_STUDIO_PRODUCTS = ICON_STUDIO_PRODUCT_KEYS.map((key) => ({
  key,
  label: PRODUCT_LABELS[key],
}));

export const ICON_STUDIO_STYLE_KEYS = [
  "flat_clean",
  "outline_technical",
  "soft_3d",
  "print_material_realistic",
  "brand_custom",
] as const;

export type IconStudioStyleKey = (typeof ICON_STUDIO_STYLE_KEYS)[number];

const STYLE_LABELS: Record<IconStudioStyleKey, string> = {
  flat_clean: "Flat / Clean",
  outline_technical: "Outline / Technical",
  soft_3d: "Soft 3D",
  print_material_realistic: "Print Material Realistic",
  brand_custom: "Brand Custom",
};

export const ICON_STUDIO_STYLES = ICON_STUDIO_STYLE_KEYS.map((key) => ({
  key,
  label: STYLE_LABELS[key],
}));

export const ICON_STUDIO_VARIANT_KEYS = [
  "front",
  "angled_front",
  "top_view",
  "stacked",
  "hanging",
  "closed",
  "open",
  "rolled",
  "standing",
] as const;

export type IconStudioVariantKey = (typeof ICON_STUDIO_VARIANT_KEYS)[number];

const VARIANT_LABELS: Record<IconStudioVariantKey, string> = {
  front: "Front",
  angled_front: "Angled Front",
  top_view: "Top View",
  stacked: "Stacked",
  hanging: "Hanging",
  closed: "Closed",
  open: "Open",
  rolled: "Rolled",
  standing: "Standing",
};

export const ICON_STUDIO_VARIANTS = ICON_STUDIO_VARIANT_KEYS.map((key) => ({
  key,
  label: VARIANT_LABELS[key],
}));

export const ICON_STUDIO_BRAND_FINISH_KEYS = [
  "flat",
  "embossed_light",
  "debossed_light",
  "gloss_surface",
  "inherit_surface",
] as const;

export type IconStudioBrandFinishKey = (typeof ICON_STUDIO_BRAND_FINISH_KEYS)[number];

const BRAND_FINISH_LABELS: Record<IconStudioBrandFinishKey, string> = {
  flat: "Flat",
  embossed_light: "Embossed Light",
  debossed_light: "Debossed Light",
  gloss_surface: "Gloss Surface",
  inherit_surface: "Inherit Surface",
};

export const ICON_STUDIO_BRAND_FINISHES = ICON_STUDIO_BRAND_FINISH_KEYS.map((key) => ({
  key,
  label: BRAND_FINISH_LABELS[key],
}));

export const ICON_STUDIO_OUTPUT_FORMATS = ["png", "svg"] as const;
export type IconStudioOutputFormat = (typeof ICON_STUDIO_OUTPUT_FORMATS)[number];

export const ICON_STUDIO_OUTPUT_SIZES = [512, 1024, 1536, 2048] as const;
export type IconStudioOutputSize = (typeof ICON_STUDIO_OUTPUT_SIZES)[number];

export const ICON_STUDIO_PLACEMENT_PRESET_KEYS = [
  "front_upper_right",
  "front_center",
  "front_lower_left",
  "lower_left",
  "spine_center",
  "banner_top",
  "banner_center",
  "label_center",
] as const;

export type IconStudioPlacementPresetKey = (typeof ICON_STUDIO_PLACEMENT_PRESET_KEYS)[number];

const PLACEMENT_PRESET_LABELS: Record<IconStudioPlacementPresetKey, string> = {
  front_upper_right: "Front Upper Right",
  front_center: "Front Center",
  front_lower_left: "Front Lower Left",
  lower_left: "Lower Left",
  spine_center: "Spine Center",
  banner_top: "Banner Top",
  banner_center: "Banner Center",
  label_center: "Label Center",
};

const DEFAULT_VARIANT_PLACEMENTS: Record<IconStudioVariantKey, IconStudioPlacementPresetKey[]> = {
  front: ["front_upper_right", "front_center", "front_lower_left"],
  angled_front: ["front_upper_right", "front_center", "front_lower_left"],
  top_view: ["front_center", "label_center", "lower_left"],
  stacked: ["front_center", "front_upper_right", "lower_left"],
  hanging: ["front_center", "front_upper_right", "label_center"],
  closed: ["front_center", "front_upper_right", "spine_center"],
  open: ["front_center", "front_lower_left", "spine_center"],
  rolled: ["banner_top", "banner_center"],
  standing: ["banner_top", "banner_center", "front_center"],
};

const BANNER_PRODUCTS = new Set<IconStudioProductKey>([
  "rollup_banner",
  "pvc_banner",
  "mesh_banner",
  "textile_banner",
  "beach_flag",
]);

const LABEL_PRODUCTS = new Set<IconStudioProductKey>([
  "sticker",
  "product_label",
  "hang_tag",
  "badge",
]);

const BOOK_PRODUCTS = new Set<IconStudioProductKey>([
  "brochure",
  "booklet",
  "softcover_book",
  "hardcover_book",
]);

export function getIconStudioPlacementPresets(
  productKey: IconStudioProductKey,
  variantKey: IconStudioVariantKey,
) {
  let placements = DEFAULT_VARIANT_PLACEMENTS[variantKey];

  if (BANNER_PRODUCTS.has(productKey)) {
    placements = variantKey === "rolled"
      ? ["banner_top", "banner_center"]
      : ["banner_top", "banner_center", "front_center"];
  } else if (LABEL_PRODUCTS.has(productKey)) {
    placements = ["label_center", "front_upper_right", "lower_left"];
  } else if (BOOK_PRODUCTS.has(productKey) && (variantKey === "closed" || variantKey === "open")) {
    placements = ["front_center", "spine_center", "front_upper_right"];
  }

  return placements.map((key) => ({
    key,
    label: PLACEMENT_PRESET_LABELS[key],
  }));
}

export function getIconStudioProductLabel(productKey: IconStudioProductKey) {
  return PRODUCT_LABELS[productKey];
}

export function getIconStudioStyleLabel(styleKey: IconStudioStyleKey) {
  return STYLE_LABELS[styleKey];
}

export function getIconStudioVariantLabel(variantKey: IconStudioVariantKey) {
  return VARIANT_LABELS[variantKey];
}

export function getIconStudioBrandFinishLabel(finishKey: IconStudioBrandFinishKey) {
  return BRAND_FINISH_LABELS[finishKey];
}
