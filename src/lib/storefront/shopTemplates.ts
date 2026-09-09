import { APPROVED_DROPDOWN_PRESETS, type HeaderDropdownPreset } from "../branding/dropdownPresets.ts";

export const STOREFRONT_SECTION_IDS = [
  "hero",
  "products",
  "usp",
  "banner2",
  "content",
  "seo",
] as const;

export type StorefrontSectionId = (typeof STOREFRONT_SECTION_IDS)[number];

export const SHOP_TEMPLATE_IDS = [
  "classic-catalog",
  "quick-order",
  "corporate-b2b",
  "editorial-studio",
  "marketplace",
  "campaign-launch",
  "local-service",
  "minimal-gallery",
  "takeaway-print",
  "large-format-showroom",
] as const;

export type ShopTemplateId = (typeof SHOP_TEMPLATE_IDS)[number];
export type ShopHeroTreatment = "full" | "inset" | "framed";
export type ShopHeroHeight = "compact" | "standard" | "immersive";
export type ShopContentWidth = "contained" | "wide" | "full";
export type ShopSectionSpacing = "compact" | "balanced" | "generous";
export type ShopSurfaceRhythm = "seamless" | "bands" | "editorial";
export type ShopNavigationPreset = HeaderDropdownPreset;
export type ShopHeaderVariant =
  | "catalog"
  | "compact"
  | "corporate"
  | "editorial"
  | "market"
  | "campaign"
  | "service"
  | "minimal"
  | "takeaway"
  | "showroom";
export type ShopCategoryNavigationVariant =
  | "pills"
  | "segmented"
  | "underline"
  | "editorial-rail"
  | "market-bar"
  | "campaign-chips"
  | "service-tabs"
  | "minimal-links"
  | "menu-filter"
  | "showroom-rail";
export type ShopProductCollectionVariant =
  | "catalog-grid"
  | "rapid-list"
  | "spec-grid"
  | "editorial-grid"
  | "market-grid"
  | "campaign-grid"
  | "service-grid"
  | "gallery-grid"
  | "menu-list"
  | "showroom-grid";
export type ShopProductCardVariant =
  | "classic"
  | "quick-row"
  | "spec-sheet"
  | "editorial"
  | "market-tile"
  | "campaign"
  | "service"
  | "gallery"
  | "menu-row"
  | "showroom";
export type ShopProductPageVariant =
  | "balanced"
  | "config-first"
  | "spec-led"
  | "editorial"
  | "commerce"
  | "campaign"
  | "consultative"
  | "gallery"
  | "quick-order"
  | "project";
export type ShopCheckoutVariant =
  | "two-column"
  | "compact"
  | "stepper"
  | "editorial"
  | "commerce"
  | "campaign"
  | "assisted"
  | "minimal"
  | "express"
  | "project";
export type ShopFooterVariant = "columns" | "minimal" | "centered";
export type ShopMotionVariant =
  | "subtle"
  | "direct"
  | "precise"
  | "editorial"
  | "market"
  | "dramatic";

export const SHOP_NAVIGATION_OPTIONS = APPROVED_DROPDOWN_PRESETS.map(preset => ({
  id: preset.id,
  name: `${preset.number}. ${preset.name}${preset.id === 'search-and-discover' ? ' · Standard' : ''}`,
  description: preset.description,
}));

export interface ShopComponentRecipe {
  openDesignSystem:
    | "clean"
    | "minimal"
    | "corporate"
    | "warm-editorial"
    | "shopify"
    | "dramatic"
    | "premium"
    | "neobrutalism";
  header: {
    variant: ShopHeaderVariant;
    alignment: "left" | "center" | "right";
    height: "sm" | "md" | "lg";
    style: "solid" | "glass";
  };
  navigation: ShopNavigationPreset;
  categoryNavigation: ShopCategoryNavigationVariant;
  productCollection: ShopProductCollectionVariant;
  productCard: ShopProductCardVariant;
  productPage: ShopProductPageVariant;
  checkout: ShopCheckoutVariant;
  footer: ShopFooterVariant;
  motion: ShopMotionVariant;
}

export interface StorefrontLayoutSettings {
  version: 1;
  templateId: ShopTemplateId;
  sectionOrder: StorefrontSectionId[];
  heroTreatment: ShopHeroTreatment;
  heroHeight: ShopHeroHeight;
  contentWidth: ShopContentWidth;
  sectionSpacing: ShopSectionSpacing;
  surfaceRhythm: ShopSurfaceRhythm;
}

export interface ShopTemplateDefinition {
  id: ShopTemplateId;
  name: string;
  category: string;
  description: string;
  bestFor: string;
  layout: StorefrontLayoutSettings;
  recipe: ShopComponentRecipe;
  productDefaults: {
    columns: 3 | 4 | 5;
    layoutStyle: "cards" | "flat" | "grouped" | "slim";
    featuredPosition: "above" | "below";
    featuredProductSide: "left" | "right";
  };
}

function createLayout(
  templateId: ShopTemplateId,
  settings: Omit<StorefrontLayoutSettings, "version" | "templateId">,
): StorefrontLayoutSettings {
  return {
    version: 1,
    templateId,
    ...settings,
  };
}

export const SHOP_TEMPLATES: readonly ShopTemplateDefinition[] = [
  {
    id: "classic-catalog",
    name: "Klassisk Trykshop",
    category: "Alsidig",
    description: "Klassisk produktmenu, rolige katalogkort, balanceret produktside og todelt checkout.",
    bestFor: "Bredt produktsortiment",
    layout: createLayout("classic-catalog", {
      sectionOrder: ["hero", "banner2", "products", "content", "usp", "seo"],
      heroTreatment: "full",
      heroHeight: "standard",
      contentWidth: "wide",
      sectionSpacing: "balanced",
      surfaceRhythm: "seamless",
    }),
    recipe: {
      openDesignSystem: "clean",
      header: { variant: "catalog", alignment: "left", height: "md", style: "solid" },
      navigation: "classic",
      categoryNavigation: "pills",
      productCollection: "catalog-grid",
      productCard: "classic",
      productPage: "balanced",
      checkout: "two-column",
      footer: "columns",
      motion: "subtle",
    },
    productDefaults: {
      columns: 4,
      layoutStyle: "cards",
      featuredPosition: "above",
      featuredProductSide: "left",
    },
  },
  {
    id: "quick-order",
    name: "Hurtig Bestilling",
    category: "Konvertering",
    description: "Kompakt menu, brede produktrækker, konfiguration først og et kort checkoutforløb.",
    bestFor: "Faste kunder og genbestilling",
    layout: createLayout("quick-order", {
      sectionOrder: ["usp", "products", "hero", "content", "banner2", "seo"],
      heroTreatment: "full",
      heroHeight: "compact",
      contentWidth: "wide",
      sectionSpacing: "compact",
      surfaceRhythm: "bands",
    }),
    recipe: {
      openDesignSystem: "clean",
      header: { variant: "compact", alignment: "left", height: "sm", style: "solid" },
      navigation: "compact-columns",
      categoryNavigation: "segmented",
      productCollection: "rapid-list",
      productCard: "quick-row",
      productPage: "config-first",
      checkout: "compact",
      footer: "minimal",
      motion: "direct",
    },
    productDefaults: {
      columns: 5,
      layoutStyle: "slim",
      featuredPosition: "below",
      featuredProductSide: "left",
    },
  },
  {
    id: "corporate-b2b",
    name: "Corporate B2B",
    category: "Erhverv",
    description: "Præcis B2B-menu, specifikationskort, teknisk produktside og trinopdelt checkout.",
    bestFor: "Trykkerier og firmakunder",
    layout: createLayout("corporate-b2b", {
      sectionOrder: ["hero", "usp", "content", "products", "banner2", "seo"],
      heroTreatment: "inset",
      heroHeight: "compact",
      contentWidth: "contained",
      sectionSpacing: "balanced",
      surfaceRhythm: "bands",
    }),
    recipe: {
      openDesignSystem: "corporate",
      header: { variant: "corporate", alignment: "left", height: "md", style: "solid" },
      navigation: "compact-columns",
      categoryNavigation: "underline",
      productCollection: "spec-grid",
      productCard: "spec-sheet",
      productPage: "spec-led",
      checkout: "stepper",
      footer: "columns",
      motion: "precise",
    },
    productDefaults: {
      columns: 4,
      layoutStyle: "grouped",
      featuredPosition: "above",
      featuredProductSide: "right",
    },
  },
  {
    id: "editorial-studio",
    name: "Editorial Studio",
    category: "Historie",
    description: "Billedbåret navigation, redaktionelle produktkort og et rummeligt købsforløb.",
    bestFor: "Design, foto og premium print",
    layout: createLayout("editorial-studio", {
      sectionOrder: ["hero", "content", "banner2", "products", "usp", "seo"],
      heroTreatment: "inset",
      heroHeight: "immersive",
      contentWidth: "contained",
      sectionSpacing: "generous",
      surfaceRhythm: "editorial",
    }),
    recipe: {
      openDesignSystem: "warm-editorial",
      header: { variant: "editorial", alignment: "center", height: "lg", style: "solid" },
      navigation: "split-preview",
      categoryNavigation: "editorial-rail",
      productCollection: "editorial-grid",
      productCard: "editorial",
      productPage: "editorial",
      checkout: "editorial",
      footer: "centered",
      motion: "editorial",
    },
    productDefaults: {
      columns: 3,
      layoutStyle: "flat",
      featuredPosition: "below",
      featuredProductSide: "right",
    },
  },
  {
    id: "marketplace",
    name: "Produktmarked",
    category: "Katalog",
    description: "Visuel kategorimenu, tæt produktmarked, handelsfokuseret produktside og checkout.",
    bestFor: "Mange kategorier og produkter",
    layout: createLayout("marketplace", {
      sectionOrder: ["products", "hero", "usp", "banner2", "content", "seo"],
      heroTreatment: "framed",
      heroHeight: "compact",
      contentWidth: "wide",
      sectionSpacing: "compact",
      surfaceRhythm: "bands",
    }),
    recipe: {
      openDesignSystem: "shopify",
      header: { variant: "market", alignment: "left", height: "md", style: "solid" },
      navigation: "showcase-bar",
      categoryNavigation: "market-bar",
      productCollection: "market-grid",
      productCard: "market-tile",
      productPage: "commerce",
      checkout: "commerce",
      footer: "columns",
      motion: "market",
    },
    productDefaults: {
      columns: 5,
      layoutStyle: "cards",
      featuredPosition: "above",
      featuredProductSide: "left",
    },
  },
  {
    id: "campaign-launch",
    name: "Kampagnebutik",
    category: "Kampagne",
    description: "Fremhævet kampagnemenu, visuelle produktkort og et markant købsforløb.",
    bestFor: "Tilbud, sæsoner og lanceringer",
    layout: createLayout("campaign-launch", {
      sectionOrder: ["hero", "banner2", "products", "usp", "content", "seo"],
      heroTreatment: "full",
      heroHeight: "immersive",
      contentWidth: "wide",
      sectionSpacing: "generous",
      surfaceRhythm: "bands",
    }),
    recipe: {
      openDesignSystem: "dramatic",
      header: { variant: "campaign", alignment: "center", height: "lg", style: "glass" },
      navigation: "split-preview",
      categoryNavigation: "campaign-chips",
      productCollection: "campaign-grid",
      productCard: "campaign",
      productPage: "campaign",
      checkout: "campaign",
      footer: "centered",
      motion: "dramatic",
    },
    productDefaults: {
      columns: 4,
      layoutStyle: "cards",
      featuredPosition: "above",
      featuredProductSide: "right",
    },
  },
  {
    id: "local-service",
    name: "Lokal Service",
    category: "Relation",
    description: "Serviceorienteret menu, rådgivende produktkort og et assisteret checkoutforløb.",
    bestFor: "Lokale trykkerier og rådgivning",
    layout: createLayout("local-service", {
      sectionOrder: ["hero", "usp", "content", "products", "seo", "banner2"],
      heroTreatment: "framed",
      heroHeight: "standard",
      contentWidth: "contained",
      sectionSpacing: "balanced",
      surfaceRhythm: "seamless",
    }),
    recipe: {
      openDesignSystem: "clean",
      header: { variant: "service", alignment: "left", height: "md", style: "solid" },
      navigation: "classic",
      categoryNavigation: "service-tabs",
      productCollection: "service-grid",
      productCard: "service",
      productPage: "consultative",
      checkout: "assisted",
      footer: "columns",
      motion: "subtle",
    },
    productDefaults: {
      columns: 3,
      layoutStyle: "grouped",
      featuredPosition: "above",
      featuredProductSide: "left",
    },
  },
  {
    id: "minimal-gallery",
    name: "Minimal Galleri",
    category: "Minimal",
    description: "Diskret navigation, luftige billedkort, enkel produktside og minimalistisk checkout.",
    bestFor: "Kuraterede sortimenter",
    layout: createLayout("minimal-gallery", {
      sectionOrder: ["hero", "products", "content", "usp", "banner2", "seo"],
      heroTreatment: "inset",
      heroHeight: "standard",
      contentWidth: "contained",
      sectionSpacing: "generous",
      surfaceRhythm: "seamless",
    }),
    recipe: {
      openDesignSystem: "minimal",
      header: { variant: "minimal", alignment: "center", height: "md", style: "solid" },
      navigation: "compact-columns",
      categoryNavigation: "minimal-links",
      productCollection: "gallery-grid",
      productCard: "gallery",
      productPage: "gallery",
      checkout: "minimal",
      footer: "minimal",
      motion: "precise",
    },
    productDefaults: {
      columns: 3,
      layoutStyle: "flat",
      featuredPosition: "below",
      featuredProductSide: "right",
    },
  },
  {
    id: "takeaway-print",
    name: "Takeaway Print",
    category: "Branche",
    description: "Visuel menu, kompakte varerækker, hurtig bestilling og express checkout.",
    bestFor: "Restauranter og takeaway",
    layout: createLayout("takeaway-print", {
      sectionOrder: ["hero", "products", "banner2", "usp", "content", "seo"],
      heroTreatment: "full",
      heroHeight: "compact",
      contentWidth: "wide",
      sectionSpacing: "compact",
      surfaceRhythm: "bands",
    }),
    recipe: {
      openDesignSystem: "neobrutalism",
      header: { variant: "takeaway", alignment: "left", height: "sm", style: "solid" },
      navigation: "showcase-bar",
      categoryNavigation: "menu-filter",
      productCollection: "menu-list",
      productCard: "menu-row",
      productPage: "quick-order",
      checkout: "express",
      footer: "minimal",
      motion: "direct",
    },
    productDefaults: {
      columns: 4,
      layoutStyle: "grouped",
      featuredPosition: "above",
      featuredProductSide: "left",
    },
  },
  {
    id: "large-format-showroom",
    name: "Storformat Showroom",
    category: "Storformat",
    description: "Galleri-menu, store produktbilleder, projektbaseret produktside og checkout.",
    bestFor: "Skilte, bannere og storformat",
    layout: createLayout("large-format-showroom", {
      sectionOrder: ["hero", "banner2", "products", "content", "usp", "seo"],
      heroTreatment: "full",
      heroHeight: "immersive",
      contentWidth: "full",
      sectionSpacing: "balanced",
      surfaceRhythm: "editorial",
    }),
    recipe: {
      openDesignSystem: "premium",
      header: { variant: "showroom", alignment: "center", height: "lg", style: "glass" },
      navigation: "gallery-cards",
      categoryNavigation: "showroom-rail",
      productCollection: "showroom-grid",
      productCard: "showroom",
      productPage: "project",
      checkout: "project",
      footer: "centered",
      motion: "dramatic",
    },
    productDefaults: {
      columns: 3,
      layoutStyle: "cards",
      featuredPosition: "above",
      featuredProductSide: "right",
    },
  },
];

const SHOP_TEMPLATE_BY_ID = new Map(
  SHOP_TEMPLATES.map((template) => [template.id, template]),
);

export const DEFAULT_SHOP_TEMPLATE = SHOP_TEMPLATES[0];
export const DEFAULT_STOREFRONT_LAYOUT = DEFAULT_SHOP_TEMPLATE.layout;

export function getShopTemplate(templateId?: unknown): ShopTemplateDefinition {
  const normalizedId = String(templateId || "").trim() as ShopTemplateId;
  return SHOP_TEMPLATE_BY_ID.get(normalizedId) || DEFAULT_SHOP_TEMPLATE;
}

export function resolveShopComponentRecipe(
  layout?: Partial<StorefrontLayoutSettings> | null,
): ShopComponentRecipe {
  return getShopTemplate(layout?.templateId).recipe;
}

export function normalizeStorefrontSectionOrder(order?: unknown): StorefrontSectionId[] {
  const seen = new Set<StorefrontSectionId>();
  const normalized: StorefrontSectionId[] = [];

  if (Array.isArray(order)) {
    order.forEach((candidate) => {
      if (
        typeof candidate === "string"
        && (STOREFRONT_SECTION_IDS as readonly string[]).includes(candidate)
        && !seen.has(candidate as StorefrontSectionId)
      ) {
        seen.add(candidate as StorefrontSectionId);
        normalized.push(candidate as StorefrontSectionId);
      }
    });
  }

  STOREFRONT_SECTION_IDS.forEach((sectionId) => {
    if (!seen.has(sectionId)) normalized.push(sectionId);
  });

  return normalized;
}

export function resolveStorefrontLayout(
  layout?: Partial<StorefrontLayoutSettings> | null,
): StorefrontLayoutSettings {
  const template = getShopTemplate(layout?.templateId);

  return {
    ...template.layout,
    ...layout,
    version: 1,
    templateId: template.id,
    sectionOrder: normalizeStorefrontSectionOrder(
      layout?.sectionOrder || template.layout.sectionOrder,
    ),
  };
}
