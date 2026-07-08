import type { Json } from "@/integrations/supabase/types";

export const SUPPLIER_BANK_SCHEMA_VERSION = 1;

export const SUPPLIER_BANK_PRODUCT_FAMILIES = [
  "flyers",
  "folders",
  "sales_folders",
  "business_cards",
  "posters",
  "banners",
  "signs",
  "rollups",
  "stickers",
  "labels",
  "books",
  "letterheads",
  "tshirts",
  "packaging",
  "other",
] as const;

export type SupplierBankProductFamily = typeof SUPPLIER_BANK_PRODUCT_FAMILIES[number];

export const SUPPLIER_BANK_PRODUCT_FAMILY_LABELS_DA: Record<SupplierBankProductFamily, string> = {
  flyers: "Flyers",
  folders: "Foldere",
  sales_folders: "Salgsmapper",
  business_cards: "Visitkort",
  posters: "Plakater",
  banners: "Bannere",
  signs: "Skilte",
  rollups: "Roll-ups",
  stickers: "Klistermærker",
  labels: "Etiketter",
  books: "Bøger",
  letterheads: "Brevpapir",
  tshirts: "T-shirts",
  packaging: "Emballage",
  other: "Andet",
};

export const SUPPLIER_BANK_INTEGRATION_TYPES = [
  "api",
  "scrape",
  "playwright",
  "manual",
] as const;

export type SupplierBankIntegrationType = typeof SUPPLIER_BANK_INTEGRATION_TYPES[number];

export const SUPPLIER_BANK_PRODUCT_STATUSES = [
  "draft",
  "reviewed",
  "approved",
  "archived",
  "failed",
] as const;

export type SupplierBankProductStatus = typeof SUPPLIER_BANK_PRODUCT_STATUSES[number];

export const SUPPLIER_BANK_SCRAPE_STATUSES = [
  "pending",
  "fresh",
  "stale",
  "failed",
] as const;

export type SupplierBankScrapeStatus = typeof SUPPLIER_BANK_SCRAPE_STATUSES[number];

export const SUPPLIER_BANK_SCRAPE_RUN_MODES = [
  "catalog_discovery",
  "product_extract",
  "price_refresh",
  "manual_upload",
] as const;

export type SupplierBankScrapeRunMode = typeof SUPPLIER_BANK_SCRAPE_RUN_MODES[number];

export const SUPPLIER_BANK_SCRAPE_TOOLS = [
  "firecrawl",
  "playwright",
  "supplier_api",
  "static_fetch",
  "manual",
] as const;

export type SupplierBankScrapeTool = typeof SUPPLIER_BANK_SCRAPE_TOOLS[number];

export const SUPPLIER_BANK_SCRAPE_RUN_STATUSES = [
  "running",
  "succeeded",
  "partial",
  "failed",
] as const;

export type SupplierBankScrapeRunStatus = typeof SUPPLIER_BANK_SCRAPE_RUN_STATUSES[number];

export const SUPPLIER_BANK_IMPORT_MODES = [
  "matrix_layout_v1",
  "storformat",
  "manual",
] as const;

export type SupplierBankImportMode = typeof SUPPLIER_BANK_IMPORT_MODES[number];

export const SUPPLIER_BANK_IMPORT_STATUSES = [
  "draft",
  "dry_run",
  "imported",
  "failed",
] as const;

export type SupplierBankImportStatus = typeof SUPPLIER_BANK_IMPORT_STATUSES[number];

export const SUPPLIER_BANK_PRICE_DELTA_REVIEW_STATUSES = [
  "draft",
  "reviewed",
  "accepted",
  "rejected",
] as const;

export type SupplierBankPriceDeltaReviewStatus =
  typeof SUPPLIER_BANK_PRICE_DELTA_REVIEW_STATUSES[number];

export type SupplierBankNormalizedAttribute = {
  key: string;
  labelDa: string;
  labelOriginal?: string;
  values: Array<{
    key: string;
    labelDa: string;
    labelOriginal?: string;
    widthMm?: number;
    heightMm?: number;
    metadata?: Record<string, Json>;
  }>;
};

export type SupplierBankNormalizedPriceRow = {
  quantity: number;
  supplierCurrency: string;
  supplierPrice: number | null;
  convertedPriceDkk: number | null;
  proposedPriceDkk: number;
  conversionRuleKey?: string | null;
  selections: Record<string, string>;
  metadata?: Record<string, Json>;
};

export type SupplierBankProductDraft = {
  schemaVersion: typeof SUPPLIER_BANK_SCHEMA_VERSION;
  supplierSlug: string;
  supplierProductKey: string;
  sourceUrl?: string | null;
  productFamily: SupplierBankProductFamily;
  nameOriginal: string;
  nameDa: string;
  descriptionOriginal?: string | null;
  descriptionDa?: string | null;
  sourceLanguage?: string | null;
  targetLanguage: "da";
  normalizedAttributes: SupplierBankNormalizedAttribute[];
  normalizedPriceRows: SupplierBankNormalizedPriceRow[];
  rawSnapshotPath?: string | null;
  metadata?: Record<string, Json>;
};

export function getSupplierBankProductFamilyLabelDa(
  family: string | null | undefined,
): string {
  if (!family || !isSupplierBankProductFamily(family)) return SUPPLIER_BANK_PRODUCT_FAMILY_LABELS_DA.other;
  return SUPPLIER_BANK_PRODUCT_FAMILY_LABELS_DA[family];
}

export function isSupplierBankProductFamily(value: string): value is SupplierBankProductFamily {
  return SUPPLIER_BANK_PRODUCT_FAMILIES.includes(value as SupplierBankProductFamily);
}
