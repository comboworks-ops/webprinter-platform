import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Database,
  ExternalLink,
  FileText,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SUPPLIER_BANK_PRODUCT_FAMILIES,
  SUPPLIER_BANK_PRODUCT_STATUSES,
  getSupplierBankProductFamilyLabelDa,
  type SupplierBankProductFamily,
  type SupplierBankProductStatus,
} from "@/lib/supplier-bank";
import {
  SUPPLIER_BANK_PRODUCT_FAMILY_URL_CANDIDATES,
  SUPPLIER_BANK_SUPPLIER_LIBRARY_FAMILIES,
  type SupplierSourceUrlCandidate,
} from "@/lib/supplier-bank/sourceRegistry";
import { useUserRole } from "@/hooks/useUserRole";

type SupplierRow = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  integration_type: string;
  country_code: string;
  currency: string;
  metadata: Record<string, unknown> | null;
};

type BankProductRow = {
  id: string;
  supplier_id: string;
  supplier_product_key?: string;
  name_da: string;
  name_original: string;
  product_family: SupplierBankProductFamily;
  status: SupplierBankProductStatus;
  scrape_status: string;
  source_url: string | null;
  last_scraped_at: string | null;
  last_price_checked_at: string | null;
  raw_snapshot_path: string | null;
  normalized_attributes: NormalizedAttribute[] | null;
  normalized_pricing_summary: Record<string, unknown> | null;
  updated_at: string;
};

type ImportJobRow = {
  id: string;
  bank_product_id: string;
  target_tenant_id: string | null;
  target_product_id: string | null;
  import_mode: string;
  status: string;
  import_summary: Record<string, unknown> | null;
  rollback_note: string | null;
  created_at: string;
};

type DeltaReviewRow = {
  id: string;
  bank_product_id: string;
  new_price_snapshot_id: string | null;
  status: string;
  threshold_pct: number | null;
  change_summary: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

type RefreshJobRow = {
  id: string;
  supplier_id: string | null;
  bank_product_id: string;
  mode: string;
  tool: string;
  status: string;
  request_summary: Record<string, unknown> | null;
  result_summary: Record<string, unknown> | null;
  error: string | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type ImportedTargetProductRow = {
  id: string;
  name: string;
  slug: string;
  pricing_type: string | null;
  is_published: boolean | null;
};

type ImportedTargetRowCounts = {
  genericPrices: number | null;
  storformatMaterials: number | null;
  storformatFinishes: number | null;
  storformatVariants: number | null;
};

type ExistingProductRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  pricing_type: string | null;
  is_published: boolean | null;
};

type ExistingProductOptionGroup = {
  id: string;
  product_id: string;
  name: string;
  kind: string | null;
  sort_order: number | null;
  values?: Array<{
    id: string;
    name: string;
    enabled: boolean | null;
    sort_order: number | null;
  }> | null;
};

type ProductMatchSuggestion = {
  product: ExistingProductRow;
  score: number;
  statusLabel: string;
  reasons: string[];
  matchingSupplierValues: string[];
  missingSupplierValues: string[];
  optionGroupCount: number;
  optionValueCount: number;
  alreadyImportedTarget: boolean;
};

type ProductLinkPreview = {
  bankProduct: BankProductRow;
  suggestion: ProductMatchSuggestion;
};

type DeltaReviewStatus = "draft" | "reviewed" | "accepted" | "rejected";

type PricingSummary = {
  rows?: number;
  quantityMin?: number;
  quantityMax?: number;
  priceMinDkk?: number;
  priceMaxDkk?: number;
  quantity_min?: number;
  quantity_max?: number;
  price_min_dkk?: number;
  price_max_dkk?: number;
  rowCount?: number;
  rows_count?: number;
  minQuantity?: number;
  maxQuantity?: number;
  minPriceDkk?: number;
  maxPriceDkk?: number;
  minPrice?: number;
  maxPrice?: number;
  row_count?: number;
  qtyMin?: number;
  qtyMax?: number;
  priceMin?: number;
  priceMax?: number;
};

type NormalizedAttribute = {
  key?: string;
  labelDa?: string;
  labelOriginal?: string;
  values?: Array<{
    key?: string;
    labelDa?: string;
    labelOriginal?: string;
    widthMm?: number | null;
    heightMm?: number | null;
  }>;
};

type PriceSnapshotPreview = {
  id: string;
  currency: string | null;
  created_at: string;
  quantity_min: number | null;
  quantity_max: number | null;
  price_min_dkk: number | null;
  price_max_dkk: number | null;
};

type DraftImportPreview = {
  rowsPrepared?: number;
  rowsAvailableInSnapshot?: number;
  quantityMin?: number | null;
  quantityMax?: number | null;
  priceMinDkk?: number | null;
  priceMaxDkk?: number | null;
  rowFilter?: Record<string, string>;
  rowFilterActive?: boolean;
  productSlug?: string;
  conversionGate?: {
    allowed?: boolean;
    reason?: string | null;
  };
  priceReview?: {
    allowed?: boolean;
    reason?: string | null;
  };
};

type PriceSnapshotStat = {
  count: number;
  latestSnapshotId: string | null;
  latestCreatedAt: string | null;
  quantityMin: number | null;
  quantityMax: number | null;
  priceMinDkk: number | null;
  priceMaxDkk: number | null;
};

type ReadinessSummary = {
  ready: number;
  blocked: number;
  imported: number;
};

type ReadinessFilter = "all" | "ready" | "imported" | "blocked";
type BankStatusFilter = "all" | SupplierBankProductStatus;
type BankReadSource = "none" | "secure_admin_endpoint" | "direct_rls";

type ProductNextAction = {
  tone: "ready" | "info" | "warning" | "blocked";
  label: string;
  description: string;
};

type SupplierCoverageSummary = {
  expectedFamilies: SupplierBankProductFamily[];
  stagedFamilies: SupplierBankProductFamily[];
  missingFamilies: SupplierBankProductFamily[];
  productCount: number;
};

type SupplierCoverageAction = {
  tone: ProductNextAction["tone"];
  label: string;
  description: string;
};

type DecisionQueueItem = {
  priority: "high" | "medium" | "low";
  tone: ProductNextAction["tone"];
  title: string;
  description: string;
  details: string[];
};

type ImportedDraftQaSummary = {
  checked: number;
  ok: number;
  warnings: number;
  errors: number;
  published: number;
  matrix: number;
  storformat: number;
};

type NextExpansionItem = {
  supplierId: string;
  supplierName: string;
  tone: ProductNextAction["tone"];
  title: string;
  description: string;
  missingFamilies: SupplierBankProductFamily[];
  stagedFamilies: SupplierBankProductFamily[];
  readiness: ReadinessSummary;
};

type GateRoadmapItem = {
  order: number;
  tone: ProductNextAction["tone"];
  priority: DecisionQueueItem["priority"];
  title: string;
  description: string;
  details: string[];
  actionLabel: string;
  supplierId?: string;
};

type ApprovalCandidateItem = {
  priority: DecisionQueueItem["priority"];
  tone: ProductNextAction["tone"];
  title: string;
  supplierName: string;
  familyLabel: string;
  statusLabel: string;
  description: string;
  evidence: string[];
  proofTrail: Array<{
    label: string;
    value: string;
  }>;
  approvalNote: string;
  approveImpact: string;
  deferImpact: string;
  guardrails: string[];
  decisionChecklist: string[];
  approvalPhrase: string;
  deferPhrase: string;
  safeCheckCommand: string;
  supplierId?: string;
};

type CoverageGapItem = {
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  family: SupplierBankProductFamily;
  tone: ProductNextAction["tone"];
  statusLabel: string;
  blocker: string;
  nextStep: string;
  safeCheckCommand: string;
  urlCandidateCount: number;
  confirmedUrlCandidateCount: number;
  urlCandidatePreview: SupplierSourceUrlCandidate | null;
  pixartProfile?: string;
  pixartReadinessGates?: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
};

type GateTypeOverviewItem = {
  key: string;
  tone: ProductNextAction["tone"];
  title: string;
  statusLabel: string;
  description: string;
  items: string[];
};

type SupplierUrlCandidateRow = {
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  family: SupplierBankProductFamily;
  candidate: SupplierSourceUrlCandidate;
};

type SupplierFamilyOverviewRow = {
  family: SupplierBankProductFamily;
  state: "staged" | "missing";
  productCount: number;
  urlCandidateCount: number;
};

type SupplierFamilyShelfRow = SupplierFamilyOverviewRow & {
  readiness: ReadinessSummary;
  priceRows: number;
  priceMinDkk: number | null;
  priceMaxDkk: number | null;
  latestUpdatedAt: string | null;
  nextStep: string;
  safeCheckCommand: string | null;
};

type SupplierCatalogCard = {
  supplierId: string;
  name: string;
  enabled: boolean;
  productCount: number;
  expectedFamilyCount: number;
  stagedFamilies: SupplierBankProductFamily[];
  missingFamilies: SupplierBankProductFamily[];
  readiness: ReadinessSummary;
  tone: ProductNextAction["tone"];
  statusLabel: string;
  description: string;
};

type BusinessImportQueueItem = {
  product: BankProductRow;
  supplierName: string;
  productName: string;
  family: SupplierBankProductFamily;
  tone: ProductNextAction["tone"];
  statusLabel: string;
  description: string;
  priceRows: number;
  importedProductSlug: string | null;
  safeCheckCommand: string | null;
};

type ProductSpotlightItem = {
  product: BankProductRow;
  supplierName: string;
  productName: string;
  familyLabel: string;
  readinessLabel: string;
  readinessVariant: string;
  importedProductSlug: string | null;
  importBlockReason: string | null;
  priceRows: number;
  priceMinDkk: number | null;
  priceMaxDkk: number | null;
  latestUpdatedAt: string | null;
  attributePreviewRows: ReturnType<typeof getAttributePreviewRows>;
};

type SimpleFamilyPickerItem = {
  family: SupplierBankProductFamily;
  label: string;
  productCount: number;
};

type ProductFinderSupplierItem = {
  supplierId: string | "all";
  name: string;
  productCount: number;
  readyCount: number;
};

type ProofFileItem = {
  title: string;
  gate: string;
  path: string;
  description: string;
  tone: ProductNextAction["tone"];
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const SUPPLIER_BANK_READ_PAGE_SIZE = 1000;
const SIMPLE_PRODUCT_PAGE_SIZE = 18;
const PIXART_FLAT_BANK_PRODUCT_KEY = "pixart-flat-surface-adhesive";
const PIXART_RIGIDS_BANK_PRODUCT_KEY = "pixart-rigids";
const PIXART_EXTRACTOR_SUPPORTED_PROFILES = new Set(["flat-surface-adhesive", "rigids"]);
const PIXART_SUPPLIER_BANK_NORMALIZER_SUPPORTED_PROFILES = new Set(["flat-surface-adhesive", "rigids"]);
const PIXART_FAMILY_PROFILE_MAP: Partial<Record<SupplierBankProductFamily, string>> = {
  stickers: "flat-surface-adhesive",
  signs: "rigids",
  posters: "posters",
  banners: "banners",
  rollups: "rollups",
  labels: "labels",
};
const PIXART_URL_CONFIRMATION_CHECKLIST = [
  "Åbn URL'en manuelt som human review; kør ikke probe eller extract.",
  "Bekræft at siden er den eksakte produkt/configurator-side, ikke kun en kategori.",
  "Sammenlign synlige valg med den planlagte Pixart-profil og første slice.",
  "Bekræft at extractor og supplier-bank normalizer findes for profilen.",
  "Marker kun som confirmed_source_url efter dokumenteret review; ellers behold kandidat eller afvis med evidens.",
];

const SUPPLIER_BANK_PROOF_FILES: ProofFileItem[] = [
  {
    title: "Report index",
    gate: "Bevis-overblik",
    path: "docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md",
    description: "Read-only indeks over de seneste Supplier Bank rapporter og proof-filer.",
    tone: "info",
  },
  {
    title: "Goal snapshot",
    gate: "Aktuel goal-kontrol",
    path: "docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md",
    description: "Samlet read-only status med åbne gates, sikre checks, approval-tekster og seneste bevisfiler.",
    tone: "warning",
  },
  {
    title: "Approval packet",
    gate: "Beslutninger",
    path: "docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md",
    description: "Read-only approval/defer packet med sikre checks, write-gates og eksakte business-tekster.",
    tone: "warning",
  },
  {
    title: "Gate roadmap",
    gate: "Næste gates",
    path: "docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md",
    description: "Femtrins roadmap med approval/defer fraser for de gates, der kan flytte banken videre.",
    tone: "info",
  },
  {
    title: "Status report",
    gate: "Aktuel bank-status",
    path: "docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md",
    description: "Read-only coverage/import/plan-status med Pixart URL-checklisten som latest proof.",
    tone: "info",
  },
  {
    title: "Executive summary",
    gate: "Overblik",
    path: "docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST.md",
    description: "Kort business-status for coverage, QA, beslutninger og næste skridt.",
    tone: "info",
  },
  {
    title: "Completion audit",
    gate: "Goal-status",
    path: "docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md",
    description: "Beviser 5/8 krav og holder goal åbent, fordi tre krav stadig er uloste.",
    tone: "warning",
  },
  {
    title: "Imported draft QA",
    gate: "Draft-sikkerhed",
    path: "docs/SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST.md",
    description: "Read-only QA for importerede supplier-bank drafts: publicering, pricing-type og prisrækker.",
    tone: "info",
  },
  {
    title: "Pixart rigids preflight",
    gate: "High priority",
    path: "docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md",
    description: "No-write preflight for Plastic+Plexiglass-kandidaten; bank-write kræver eksplicit approval.",
    tone: "blocked",
  },
  {
    title: "Print.com placemats preflight",
    gate: "Print.com other",
    path: "docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md",
    description: "No-write preflight for placemats som første smalle Print.com other-slice.",
    tone: "warning",
  },
  {
    title: "Coverage gap plan",
    gate: "Manglende familier",
    path: "docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST.md",
    description: "Plan for Print.com other og Pixart banners, labels, posters og rollups.",
    tone: "warning",
  },
  {
    title: "Pixart readiness",
    gate: "Før probe",
    path: "docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md",
    description: "Viser at 0/4 manglende Pixart-familier er klar til probe uden profil og bekræftet URL.",
    tone: "blocked",
  },
  {
    title: "URL confirmation checklist",
    gate: "Pixart URL-gate",
    path: "docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md",
    description: "Manual read-only checkliste for at bekræfte eller afvise Pixart URL-kandidater før extractor/probe.",
    tone: "warning",
  },
];

function getEmptySnapshotStats(): PriceSnapshotStat {
  return {
    count: 0,
    latestSnapshotId: null,
    latestCreatedAt: null,
    quantityMin: null,
    quantityMax: null,
    priceMinDkk: null,
    priceMaxDkk: null,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Ikke kørt endnu";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status: string) {
  if (status === "approved" || status === "succeeded" || status === "fresh") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function formatNumber(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("da-DK").format(Number(value));
}

function toNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;

  if (hasComma && hasDot) {
    normalized = raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (hasComma) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    normalized = raw.replace(/\s/g, "");
  }

  normalized = normalized.replace(/[^\d.+-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getPricingSummary(summary: Record<string, unknown> | null): PricingSummary {
  const source = summary || {};
  const readNumber = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = (source as Record<string, unknown>)[key];
      const parsed = toNumber(candidate);
      if (parsed != null) return parsed;
    }
    return null;
  };

  return {
    rows: readNumber("rows", "rowCount", "rows_count", "row_count") ?? undefined,
    quantityMin: readNumber("quantityMin", "quantity_min", "minQuantity", "qtyMin") ?? undefined,
    quantityMax: readNumber("quantityMax", "quantity_max", "maxQuantity", "qtyMax") ?? undefined,
    priceMinDkk: readNumber("priceMinDkk", "price_min_dkk", "minPriceDkk", "priceMin", "minPrice", "price_min") ?? undefined,
    priceMaxDkk: readNumber("priceMaxDkk", "price_max_dkk", "maxPriceDkk", "priceMax", "maxPrice", "price_max") ?? undefined,
  } satisfies PricingSummary;
}

function resolveProductPricingSummary(product: BankProductRow, snapshotStats?: PriceSnapshotStat | null) {
  const summary = getPricingSummary(product.normalized_pricing_summary);
  return {
    rows: toNumber(summary.rows) || 0,
    quantityMin: toNumber(summary.quantityMin ?? summary.quantity_min) ?? toNumber(snapshotStats?.quantityMin),
    quantityMax: toNumber(summary.quantityMax ?? summary.quantity_max) ?? toNumber(snapshotStats?.quantityMax),
    priceMinDkk: toNumber(summary.priceMinDkk ?? summary.price_min_dkk) ?? toNumber(snapshotStats?.priceMinDkk),
    priceMaxDkk: toNumber(summary.priceMaxDkk ?? summary.price_max_dkk) ?? toNumber(snapshotStats?.priceMaxDkk),
  } as const;
}

function getAttributeLabel(attribute: NormalizedAttribute) {
  return attribute.labelDa || attribute.labelOriginal || attribute.key || "Ukendt";
}

function getAttributeValueLabel(value: NonNullable<NormalizedAttribute["values"]>[number]) {
  return value.labelDa || value.labelOriginal || value.key || "Ukendt";
}

function normalizeMatchText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchTokens(...values: Array<string | null | undefined>) {
  const stopWords = new Set(["og", "eller", "med", "uden", "the", "and", "for", "til", "der", "den"]);
  return Array.from(new Set(values
    .flatMap((value) => normalizeMatchText(value).split(" "))
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token))));
}

function getFamilyMatchKeywords(family: SupplierBankProductFamily) {
  const keywords: Record<SupplierBankProductFamily, string[]> = {
    flyers: ["flyer", "flyers", "falzflyer", "foldet flyer"],
    folders: ["folder", "foldere", "falset", "faltblaetter", "flyer"],
    sales_folders: ["salgsmappe", "salgsmapper", "praesentationsmappe", "presentation folder", "mappe"],
    business_cards: ["visitkort", "visitenkarte", "business card"],
    posters: ["plakat", "plakater", "poster"],
    banners: ["banner", "bannere", "planer", "presenning"],
    signs: ["skilt", "skilte", "plade", "plattendruck"],
    rollups: ["rollup", "roll-up", "roll ups", "display"],
    stickers: ["klistermaerke", "klistermærke", "sticker", "aufkleber"],
    labels: ["etiket", "etiketter", "label", "etiketten"],
    books: ["bog", "boeger", "bøger", "brochure", "katalog"],
    letterheads: ["brevpapir", "letterhead", "briefpapier"],
    tshirts: ["tshirt", "t-shirt", "shirt", "tekstil"],
    packaging: ["emballage", "packaging", "box", "aeske", "æske"],
    other: [],
  };
  return getMatchTokens(getSupplierBankProductFamilyLabelDa(family), ...keywords[family]);
}

function getSupplierOptionValueLabels(product: BankProductRow) {
  return getNormalizedAttributeArray(product.normalized_attributes)
    .flatMap((attribute) => attribute.values || [])
    .map(getAttributeValueLabel)
    .filter((label) => normalizeMatchText(label).length > 0);
}

function getExistingProductOptionLabels(groups: ExistingProductOptionGroup[]) {
  return groups
    .flatMap((group) => group.values || [])
    .filter((value) => value.enabled !== false)
    .map((value) => value.name)
    .filter((label) => normalizeMatchText(label).length > 0);
}

function countExistingProductOptionValues(groups: ExistingProductOptionGroup[]) {
  return groups.reduce((count, group) => {
    return count + (group.values || []).filter((value) => value.enabled !== false).length;
  }, 0);
}

function getProductMatchStatusLabel(score: number, alreadyImportedTarget: boolean) {
  if (alreadyImportedTarget) return "allerede importeret";
  if (score >= 80) return "stærkt match";
  if (score >= 55) return "muligt match";
  return "svagt match";
}

function getProductMatchBadgeVariant(score: number, alreadyImportedTarget: boolean) {
  if (alreadyImportedTarget || score >= 80) return "default";
  if (score >= 55) return "secondary";
  return "outline";
}

function getExistingProductMatchSuggestions({
  bankProduct,
  existingProducts,
  optionsByProductId,
  importedTargetProduct,
}: {
  bankProduct: BankProductRow;
  existingProducts: ExistingProductRow[];
  optionsByProductId: Record<string, ExistingProductOptionGroup[]>;
  importedTargetProduct: ImportedTargetProductRow | null;
}): ProductMatchSuggestion[] {
  const supplierNameTokens = getMatchTokens(bankProduct.name_da, bankProduct.name_original);
  const familyTokens = getFamilyMatchKeywords(bankProduct.product_family);
  const supplierOptionLabels = getSupplierOptionValueLabels(bankProduct);
  const supplierOptionTokenByLabel = supplierOptionLabels.map((label) => ({
    label,
    normalized: normalizeMatchText(label),
    tokens: getMatchTokens(label),
  }));

  return existingProducts
    .map((product) => {
      const groups = optionsByProductId[product.id] || [];
      const productText = `${product.name} ${product.slug} ${product.category || ""}`;
      const productTokens = getMatchTokens(product.name, product.slug, product.category || "");
      const productTokenSet = new Set(productTokens);
      const productOptionLabels = getExistingProductOptionLabels(groups);
      const productOptionNormalized = new Set(productOptionLabels.map(normalizeMatchText));
      const productOptionTokenSet = new Set(getMatchTokens(...productOptionLabels));
      const alreadyImportedTarget = importedTargetProduct?.id === product.id;

      let score = alreadyImportedTarget ? 100 : 0;
      const reasons: string[] = [];

      const familyHits = familyTokens.filter((token) => normalizeMatchText(productText).includes(token));
      if (familyHits.length > 0) {
        score += Math.min(35, 18 + familyHits.length * 6);
        reasons.push("samme produktfamilie");
      }

      const nameHits = supplierNameTokens.filter((token) => productTokenSet.has(token));
      if (nameHits.length > 0) {
        score += Math.min(25, nameHits.length * 7);
        reasons.push("navn matcher");
      }

      const matchingSupplierValues = supplierOptionTokenByLabel
        .filter((supplierValue) => {
          if (productOptionNormalized.has(supplierValue.normalized)) return true;
          return supplierValue.tokens.some((token) => productOptionTokenSet.has(token));
        })
        .map((supplierValue) => supplierValue.label);
      const missingSupplierValues = supplierOptionTokenByLabel
        .filter((supplierValue) => !matchingSupplierValues.includes(supplierValue.label))
        .map((supplierValue) => supplierValue.label);

      if (matchingSupplierValues.length > 0) {
        score += Math.min(30, 8 + matchingSupplierValues.length * 4);
        reasons.push("valg/materialer overlapper");
      }

      if (groups.length > 0) {
        score += 4;
        reasons.push("produkt har valgstruktur");
      }

      if (alreadyImportedTarget) {
        reasons.unshift("findes som importeret draft");
      }

      return {
        product,
        score,
        statusLabel: getProductMatchStatusLabel(score, alreadyImportedTarget),
        reasons: Array.from(new Set(reasons)).slice(0, 3),
        matchingSupplierValues: Array.from(new Set(matchingSupplierValues)).slice(0, 6),
        missingSupplierValues: Array.from(new Set(missingSupplierValues)).slice(0, 8),
        optionGroupCount: groups.length,
        optionValueCount: countExistingProductOptionValues(groups),
        alreadyImportedTarget,
      } satisfies ProductMatchSuggestion;
    })
    .filter((suggestion) => suggestion.alreadyImportedTarget || suggestion.score >= 32)
    .sort((left, right) => {
      if (left.alreadyImportedTarget !== right.alreadyImportedTarget) return left.alreadyImportedTarget ? -1 : 1;
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      return left.product.name.localeCompare(right.product.name, "da");
    })
    .slice(0, 3);
}

function getSupplierExpectedFamilies(supplier: SupplierRow): SupplierBankProductFamily[] {
  const rawFamilies = supplier.metadata?.productFamilies;
  const metadataFamilies = Array.isArray(rawFamilies) ? rawFamilies : [];
  const registryFamilies = SUPPLIER_BANK_SUPPLIER_LIBRARY_FAMILIES[supplier.slug] || [];
  const families = [...metadataFamilies, ...registryFamilies].filter((family): family is SupplierBankProductFamily => (
    typeof family === "string" && SUPPLIER_BANK_PRODUCT_FAMILIES.includes(family as SupplierBankProductFamily)
  ));
  return Array.from(new Set(families));
}

function formatFamilyLabels(families: SupplierBankProductFamily[]) {
  if (families.length === 0) return "Ingen";
  return families.map((family) => getSupplierBankProductFamilyLabelDa(family)).join(", ");
}

function normalizeSupplierUrlCandidates(value: unknown): SupplierSourceUrlCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object") return null;
      const row = candidate as Record<string, unknown>;
      const url = typeof row.url === "string" ? row.url.trim() : "";
      const status = typeof row.status === "string" ? row.status.trim() : "candidate_needs_confirmation";
      const evidence = typeof row.evidence === "string" ? row.evidence.trim() : "Registry URL candidate; option shape and extractor profile are not confirmed.";
      if (!url) return null;
      return {
        url,
        status: status as SupplierSourceUrlCandidate["status"],
        evidence,
      };
    })
    .filter((candidate): candidate is SupplierSourceUrlCandidate => Boolean(candidate));
}

function getSupplierFamilyUrlCandidates(supplier: SupplierRow | undefined, family: SupplierBankProductFamily) {
  if (!supplier) return [];
  const metadataCandidates = supplier.metadata?.productFamilyUrlCandidates;
  if (metadataCandidates && typeof metadataCandidates === "object" && !Array.isArray(metadataCandidates)) {
    const byFamily = metadataCandidates as Partial<Record<SupplierBankProductFamily, unknown>>;
    const candidates = normalizeSupplierUrlCandidates(byFamily[family]);
    if (candidates.length > 0) return candidates;
  }

  return SUPPLIER_BANK_PRODUCT_FAMILY_URL_CANDIDATES[supplier.slug]?.[family] || [];
}

function getUrlCandidateStatusLabel(status: string) {
  if (status === "confirmed_source_url") return "bekræftet";
  if (status === "rejected") return "afvist";
  if (status === "official_candidate_needs_confirmation") return "officiel kandidat";
  return "skal bekræftes";
}

function getImportedProductSlug(job: ImportJobRow | undefined) {
  const slug = job?.import_summary?.productSlug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function getNormalizedAttributeArray(attributes: NormalizedAttribute[] | Record<string, unknown> | null | undefined): NormalizedAttribute[] {
  return Array.isArray(attributes) ? attributes : [];
}

function getAttributePreviewRows(
  attributes: NormalizedAttribute[] | Record<string, unknown> | null | undefined,
  limit = 4,
) {
  return getNormalizedAttributeArray(attributes)
    .map((attribute) => {
      const values = attribute.values || [];
      return {
        key: attribute.key || getAttributeLabel(attribute),
        label: getAttributeLabel(attribute),
        valueCount: values.length,
        preview: values.slice(0, 3).map(getAttributeValueLabel).join(", "),
      };
    })
    .filter((row) => row.label && row.valueCount > 0)
    .slice(0, limit);
}

function getSelectionFilter(selection: Record<string, string>) {
  return Object.entries(selection).reduce((acc, [key, value]) => {
    if (key && value) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
}

function hasSelectionFilter(selection: Record<string, string>) {
  return Object.keys(getSelectionFilter(selection)).length > 0;
}

function getSelectionLabelParts(
  attributes: NormalizedAttribute[] | Record<string, unknown> | null | undefined,
  selection: Record<string, string>,
) {
  return getNormalizedAttributeArray(attributes)
    .map((attribute) => {
      const key = attribute.key || getAttributeLabel(attribute);
      const selected = selection[key];
      if (!selected) return null;
      const value = (attribute.values || []).find((item) => (
        getAttributeValueLabel(item) === selected || item.key === selected
      ));
      return value ? getAttributeValueLabel(value) : selected;
    })
    .filter((value): value is string => Boolean(value));
}

function getSelectionSuffix(
  attributes: NormalizedAttribute[] | Record<string, unknown> | null | undefined,
  selection: Record<string, string>,
) {
  return getSelectionLabelParts(attributes, selection).slice(0, 4).join(" - ");
}

function getDraftImportIdentity(product: BankProductRow, selection: Record<string, string>) {
  const productName = product.name_da || product.name_original || "Supplier product";
  const suffix = getSelectionSuffix(product.normalized_attributes, selection);
  const productSlugBase = product.supplier_product_key || product.name_da || product.name_original;
  const selectedSlug = slugify(suffix);
  return {
    productName: suffix ? `${productName} - ${suffix}` : productName,
    productSlug: slugify(`${productSlugBase}${selectedSlug ? `-${selectedSlug}` : ""}-${product.id.slice(0, 8)}`),
  };
}

function getImportJobRowFilter(job: ImportJobRow | undefined) {
  const filter = job?.import_summary?.rowFilter;
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) return {};
  return Object.entries(filter as Record<string, unknown>).reduce((acc, [key, value]) => {
    if (typeof value === "string" && value.trim()) acc[key] = value.trim();
    return acc;
  }, {} as Record<string, string>);
}

function rowFiltersEqual(left: Record<string, string>, right: Record<string, string>) {
  const leftEntries = Object.entries(left).filter(([, value]) => Boolean(value));
  const rightEntries = Object.entries(right).filter(([, value]) => Boolean(value));
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value]) => right[key] === value || slugify(right[key]) === slugify(value));
}

function getImportedJobForSelection(
  jobs: ImportJobRow[],
  productId: string,
  selection: Record<string, string>,
) {
  const selectedFilter = getSelectionFilter(selection);
  return jobs
    .filter((job) => job.bank_product_id === productId && job.status === "imported")
    .find((job) => rowFiltersEqual(getImportJobRowFilter(job), selectedFilter));
}

function getSummaryNumber(summary: Record<string, unknown> | null | undefined, key: string) {
  return toNumber(summary?.[key]) || 0;
}

function extractExpectedMatrixRows(importSummary: Record<string, unknown> | null | undefined) {
  if (!importSummary || typeof importSummary !== "object") return null;
  const candidates = [
    importSummary.rowsInserted,
    importSummary.rowsPrepared,
    importSummary.genericRowsPrepared,
    importSummary.genericPriceRows,
    importSummary.normalizedRows,
    importSummary.priceRows,
  ];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }
  return null;
}

function needsMatrixRepair(job: ImportJobRow | undefined, targetProduct: ImportedTargetProductRow | null | undefined, rowCounts: ImportedTargetRowCounts | null | undefined) {
  if (!job || job.import_mode !== "matrix_layout_v1" || !targetProduct || targetProduct.is_published) return false;
  if (!rowCounts) return true;
  const expectedRows = extractExpectedMatrixRows(job.import_summary && typeof job.import_summary === "object" ? job.import_summary : {});
  if (rowCounts.genericPrices === 0) return true;
  return expectedRows !== null && rowCounts.genericPrices != null && expectedRows !== rowCounts.genericPrices;
}

function getExpectedStorformatCount(importSummary: Record<string, unknown> | null | undefined, key: string) {
  const counts = importSummary?.storformatCounts;
  if (!counts || typeof counts !== "object") return null;
  const value = (counts as Record<string, unknown>)[key];
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function isMatrixPricingType(value: string | null | undefined) {
  return ["matrix", "MATRIX", "matrix_layout_v1"].includes(String(value || ""));
}

function getDeltaReviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "kladde",
    reviewed: "gennemgået",
    accepted: "accepteret",
    rejected: "afvist",
  };
  return labels[status] || status;
}

function getNextDeltaReviewStatuses(status: string): Array<{ status: DeltaReviewStatus; label: string }> {
  if (status === "draft") return [{ status: "reviewed", label: "Marker gennemgået" }];
  if (status === "reviewed") {
    return [
      { status: "accepted", label: "Accepter" },
      { status: "rejected", label: "Afvis" },
    ];
  }
  return [];
}

function getMatrixDraftImportUnsupportedReason(product: BankProductRow) {
  if (product.supplier_product_key === PIXART_FLAT_BANK_PRODUCT_KEY) {
    return "Pixart flat-surface skal konverteres via storformat-flowet før draft import.";
  }
  if (product.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY) {
    return "Pixart pladematerialer skal konverteres via rigids/storformat-flowet før draft import.";
  }
  return null;
}

function getImportModeLabel(product: BankProductRow, importedJob?: ImportJobRow) {
  if (importedJob?.import_mode === "storformat") return "Storformat";
  if (importedJob?.import_mode === "matrix_layout_v1") return "Matrix Layout";
  if (getMatrixDraftImportUnsupportedReason(product)) return "Storformat";
  return "Matrix Layout";
}

function deltaReviewVariant(status: string) {
  if (status === "accepted") return "default";
  if (status === "rejected") return "destructive";
  return "outline";
}

function getImportBlockReason(
  product: BankProductRow,
  deltaReview: DeltaReviewRow | undefined,
  snapshotStats: PriceSnapshotStat | undefined
) {
  if (product.status === "archived" || product.status === "failed") {
    return "Produktet er arkiveret eller fejlet.";
  }

  const snapshotCount = snapshotStats?.count || 0;
  if (snapshotCount === 0) {
    return "Kræver mindst et gemt price snapshot.";
  }

  if (snapshotCount >= 2) {
    if (!deltaReview) {
      return "Opret og gennemgå prisreview før import.";
    }
    if (snapshotStats?.latestSnapshotId && deltaReview.new_price_snapshot_id !== snapshotStats.latestSnapshotId) {
      return "Prisreview matcher ikke seneste price snapshot.";
    }
    if (deltaReview.status === "draft") {
      return "Prisreview er stadig kladde.";
    }
    if (deltaReview.status === "reviewed") {
      return "Prisreview skal accepteres før import.";
    }
    if (deltaReview.status === "rejected") {
      return "Seneste prisreview er afvist.";
    }
  }

  return getMatrixDraftImportUnsupportedReason(product);
}

function getImportReadinessLabel(
  product: BankProductRow,
  importedProductSlug: string | null,
  importBlockReason: string | null
) {
  if (importedProductSlug) return "draft oprettet";
  if (importBlockReason) return "blokeret";
  if (product.status === "approved") return "klar nu";
  return "klar efter godkendelse";
}

function getImportReadinessVariant(
  importedProductSlug: string | null,
  importBlockReason: string | null
) {
  if (importedProductSlug) return "outline";
  if (importBlockReason) return "destructive";
  return "default";
}

function getProductReadinessState(
  importedProductSlug: string | null,
  importBlockReason: string | null
): Exclude<ReadinessFilter, "all"> {
  if (importedProductSlug) return "imported";
  if (importBlockReason) return "blocked";
  return "ready";
}

function getReadinessFilterLabel(filter: ReadinessFilter) {
  if (filter === "ready") return "klar";
  if (filter === "imported") return "drafts";
  if (filter === "blocked") return "blokeret";
  return "alle";
}

function getBankStatusFilterLabel(status: BankStatusFilter) {
  const labels: Record<BankStatusFilter, string> = {
    all: "Alle statusser",
    draft: "Kladde",
    reviewed: "Gennemgået",
    approved: "Godkendt",
    failed: "Fejlet",
    archived: "Arkiveret",
  };
  return labels[status] || status;
}

function getProductNextAction({
  product,
  supplier,
  importedProductSlug,
  importBlockReason,
  deltaReview,
  snapshotStats,
  refreshJob,
}: {
  product: BankProductRow;
  supplier: SupplierRow | undefined;
  importedProductSlug: string | null;
  importBlockReason: string | null;
  deltaReview: DeltaReviewRow | undefined;
  snapshotStats: PriceSnapshotStat;
  refreshJob: RefreshJobRow | undefined;
}): ProductNextAction {
  if (importedProductSlug) {
    return {
      tone: "info",
      label: "Åbn og gennemgå draft",
      description: "Produktet ligger som upubliceret Webprinter-draft. Næste skridt er almindelig produktkontrol.",
    };
  }

  if (refreshJob && ["queued", "running"].includes(refreshJob.status)) {
    return {
      tone: "info",
      label: "Refresh er i gang",
      description: "Vent på at køn bliver behandlet, og gennemgå derefter det nye prisreview.",
    };
  }

  if (snapshotStats.count >= 2 && !deltaReview) {
    return {
      tone: "warning",
      label: "Opret prisreview",
      description: "Der er flere snapshots. Sammenlign priserne før produktet kan importeres sikkert.",
    };
  }

  if (deltaReview?.status === "draft") {
    return {
      tone: "warning",
      label: "Gennemgå prisreview",
      description: "Prisreviewet er stadig en kladde og skal gennemgås før import.",
    };
  }

  if (deltaReview?.status === "reviewed") {
    return {
      tone: "warning",
      label: "Accepter eller afvis prisreview",
      description: "Reviewet er gennemgået, men skal accepteres før importen åbnes.",
    };
  }

  if (deltaReview?.status === "rejected") {
    if (supplier?.slug === "pixartprinting") {
      return {
        tone: "blocked",
        label: "Gendan sikker Pixart-baseline",
        description: "Seneste Pixart-snapshot er afvist. Kør safe-baseline restore preview før nye Pixart-familier eller import.",
      };
    }

    return {
      tone: "blocked",
      label: "Blokeret af afvist prisreview",
      description: "Lav en ny godkendt snapshot/review-runde før import.",
    };
  }

  if (importBlockReason) {
    return {
      tone: "blocked",
      label: "Import blokeret",
      description: importBlockReason,
    };
  }

  if (product.status !== "approved") {
    return {
      tone: "ready",
      label: "Klar efter godkendelse",
      description: "Importer-knappen godkender bankproduktet og opretter en upubliceret draft.",
    };
  }

  return {
    tone: "ready",
    label: "Klar til import",
    description: "Produktet kan importeres som upubliceret Webprinter-draft.",
  };
}

function getNextActionClasses(tone: ProductNextAction["tone"]) {
  if (tone === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "blocked") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/40 text-foreground";
}

function getFamilyStateClasses(state: SupplierFamilyOverviewRow["state"]) {
  if (state === "staged") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function getFamilyStateLabel(state: SupplierFamilyOverviewRow["state"]) {
  if (state === "staged") return "i bank";
  return "mangler";
}

function getSupplierCoverageAction({
  coverage,
  readiness,
  supplier,
}: {
  coverage: SupplierCoverageSummary;
  readiness: ReadinessSummary;
  supplier: SupplierRow;
}): SupplierCoverageAction {
  if (readiness.blocked > 0) {
    if (supplier.slug === "pixartprinting") {
      return {
        tone: "blocked",
        label: "Afklar Pixart importvej",
        description: "Pixart wide-format skal bruge storformat-konvertering eller recovery-review, før draft import åbnes.",
      };
    }

    return {
      tone: "blocked",
      label: "Løs blokeret bankprodukt først",
      description: "Gennemgå prisreview eller snapshot-kvalitet, før flere familier importeres fra denne leverandør.",
    };
  }

  if (readiness.imported > 0 && coverage.missingFamilies.length === 0) {
    return {
      tone: "info",
      label: "Gennemgå importerede drafts",
      description: "De planlagte familier er dækket. Næste skridt er produktkontrol i admin.",
    };
  }

  if (coverage.missingFamilies.length > 0 && coverage.stagedFamilies.length > 0) {
    return {
      tone: "warning",
      label: `Udvid med ${getSupplierBankProductFamilyLabelDa(coverage.missingFamilies[0])}`,
      description: "Der findes allerede en bank-slice. Næste sikre skridt er en ny dry extraction for den næste manglende familie.",
    };
  }

  if (coverage.missingFamilies.length > 0) {
    return {
      tone: supplier.enabled ? "warning" : "info",
      label: `Start første slice: ${getSupplierBankProductFamilyLabelDa(coverage.missingFamilies[0])}`,
      description: "Lav først en lokal dry extraction og normaliseret preview. Vent med bank write til previewet er godkendt.",
    };
  }

  return {
    tone: "ready",
    label: "Dækning ser komplet ud",
    description: "Hold fokus på refresh/review-flow og almindelig produktkontrol før publicering.",
  };
}

function getSupplierExpansionRank(item: NextExpansionItem) {
  if (item.readiness.blocked > 0) return 0;
  if (item.missingFamilies.length > 0 && item.stagedFamilies.length > 0) return 1;
  if (item.missingFamilies.length > 0) return 2;
  return 3;
}

function getSupplierCatalogCardStatus({
  readiness,
  missingFamilies,
}: {
  readiness: ReadinessSummary;
  missingFamilies: SupplierBankProductFamily[];
}): Pick<SupplierCatalogCard, "tone" | "statusLabel" | "description"> {
  if (readiness.ready > 0) {
    return {
      tone: "ready",
      statusLabel: "Klar til import",
      description: "Der er produkter, som kan åbnes, tjekkes og importeres som upublicerede drafts.",
    };
  }

  if (readiness.blocked > 0) {
    return {
      tone: "blocked",
      statusLabel: "Afventer beslutning",
      description: "Et eller flere produkter skal have review, snapshot eller importvej afklaret før import.",
    };
  }

  if (readiness.imported > 0) {
    return {
      tone: missingFamilies.length > 0 ? "warning" : "info",
      statusLabel: "Drafts oprettet",
      description: missingFamilies.length > 0
        ? "Nogle produkter ligger som drafts, men der mangler stadig planlagte familier."
        : "Produkterne ligger som upublicerede drafts og kan gennemgås i produktadmin.",
    };
  }

  if (missingFamilies.length > 0) {
    return {
      tone: "warning",
      statusLabel: "Mangler familier",
      description: "Start næste familie som lokal preview, før noget skrives i banken.",
    };
  }

  return {
    tone: "info",
    statusLabel: "Katalog",
    description: "Leverandøren er klar i oversigten, men har ingen aktive importvalg i det aktuelle filter.",
  };
}

function getSupplierFamilyShelfNextStep({
  supplier,
  family,
  state,
  readiness,
}: {
  supplier: SupplierRow;
  family: SupplierBankProductFamily;
  state: SupplierFamilyOverviewRow["state"];
  readiness: ReadinessSummary;
}): { nextStep: string; safeCheckCommand: string | null } {
  if (state === "missing") {
    if (supplier.slug === "wir-machen-druck") {
      return {
        nextStep: "Vælg denne WIRmachenDRUCK-hylde som næste familie, lav dry extraction og vis et normaliseret preview før bank write.",
        safeCheckCommand: "npm run supplier-bank:url-candidates",
      };
    }

    if (supplier.slug === "pixartprinting") {
      return {
        nextStep: "Bekræft eksakt Pixart produkt-URL og extractor-profil før probe eller extraction.",
        safeCheckCommand: `npm run supplier-bank:pixart-readiness -- --family ${family}`,
      };
    }

    if (supplier.slug === "print-com" && family === "other") {
      return {
        nextStep: "Start med lokal Print.com other preview og placemats preflight; bank-write kræver separat approval.",
        safeCheckCommand: "npm run supplier-bank:print-com-other-first-slice:preview",
      };
    }

    return {
      nextStep: "Start med dry extraction og normaliseret preview. Vent med bank-write til previewet er gennemgået.",
      safeCheckCommand: null,
    };
  }

  if (readiness.blocked > 0) {
    if (supplier.slug === "pixartprinting" && family === "signs") {
      return {
        nextStep: "Afklar Pixart Plastic+Plexiglass bank-only beslutningen før draft import.",
        safeCheckCommand: "npm run supplier-bank:pixart-rigids-bank-write-preflight",
      };
    }

    return {
      nextStep: "Gennemgå blocker, snapshots og prisreview før import.",
      safeCheckCommand: "npm run supplier-bank:review-import-eligibility",
    };
  }

  if (readiness.ready > 0) {
    return {
      nextStep: "Åbn produktet, tjek previewet, og importer som upubliceret draft.",
      safeCheckCommand: null,
    };
  }

  if (readiness.imported > 0) {
    return {
      nextStep: "Gennemgå de importerede drafts i produktadmin før publicering besluttes separat.",
      safeCheckCommand: "npm run supplier-bank:review-imported-drafts",
    };
  }

  return {
    nextStep: "Hold hylden i banken og genkør coverage/status, når nye snapshots eller previews er klar.",
    safeCheckCommand: "npm run supplier-bank:review-source-coverage",
  };
}

function getProductSafeActionSummary({
  product,
  supplier,
  importedProductSlug,
  importBlockReason,
}: {
  product: BankProductRow;
  supplier: SupplierRow | undefined;
  importedProductSlug: string | null;
  importBlockReason: string | null;
}): { title: string; description: string; safeCheckCommand: string | null; tone: ProductNextAction["tone"] } {
  if (importedProductSlug) {
    return {
      title: "Draft er oprettet",
      description: "Gennemgå den upublicerede draft i produktadmin. Publicering er en separat beslutning.",
      safeCheckCommand: "npm run supplier-bank:review-imported-drafts",
      tone: "info",
    };
  }

  if (supplier?.slug === "pixartprinting" && product.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY) {
    return {
      title: "Pixart pladematerialer afventer bank-only beslutning",
      description: "Kør kun no-write preflight som check. Bank snapshot, draft import og publicering kræver separat approval.",
      safeCheckCommand: "npm run supplier-bank:pixart-rigids-bank-write-preflight",
      tone: "blocked",
    };
  }

  if (importBlockReason) {
    return {
      title: "Import afventer review",
      description: importBlockReason,
      safeCheckCommand: "npm run supplier-bank:review-import-eligibility",
      tone: "warning",
    };
  }

  return {
    title: "Klar til upubliceret draft",
    description: "Tjek attributter og prislinjer her, og importer kun som upubliceret draft.",
    safeCheckCommand: null,
    tone: "ready",
  };
}

function getRefreshJobStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "i kø",
    running: "kører",
    succeeded: "færdig",
    failed: "fejlet",
    cancelled: "annulleret",
  };
  return labels[status] || status;
}

function getRefreshTool(integrationType: string | undefined) {
  if (integrationType === "api") return "supplier_api";
  if (integrationType === "manual") return "manual";
  return "playwright";
}

function getDecisionPriorityLabel(priority: DecisionQueueItem["priority"]) {
  if (priority === "high") return "høj";
  if (priority === "medium") return "mellem";
  return "lav";
}

function getDecisionPriorityVariant(priority: DecisionQueueItem["priority"]) {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "secondary";
  return "outline";
}

function getApprovalStatusVariant(tone: ProductNextAction["tone"]) {
  if (tone === "blocked") return "destructive";
  if (tone === "ready") return "default";
  return "secondary";
}

function getCoverageGapItem(
  supplier: SupplierRow,
  family: SupplierBankProductFamily,
  urlCandidates: SupplierSourceUrlCandidate[]
): CoverageGapItem {
  const confirmedUrlCandidateCount = urlCandidates.filter((candidate) => candidate.status === "confirmed_source_url").length;

  if (supplier.slug === "pixartprinting") {
    const pixartProfile = PIXART_FAMILY_PROFILE_MAP[family] || family;
    const extractorSupported = PIXART_EXTRACTOR_SUPPORTED_PROFILES.has(pixartProfile);
    const normalizerSupported = PIXART_SUPPLIER_BANK_NORMALIZER_SUPPORTED_PROFILES.has(pixartProfile);
    const exactUrlConfirmed = confirmedUrlCandidateCount > 0;
    const blockers = [
      extractorSupported ? null : `extractor profile '${pixartProfile}' mangler`,
      normalizerSupported ? null : `supplier-bank normalizer profile '${pixartProfile}' mangler`,
      exactUrlConfirmed ? null : "eksakt produkt-URL mangler",
    ].filter((item): item is string => Boolean(item));
    const readinessGates = [
      {
        key: "extractor",
        label: "Extractor",
        ready: extractorSupported,
        detail: extractorSupported ? "klar" : "mangler",
      },
      {
        key: "normalizer",
        label: "Normalizer",
        ready: normalizerSupported,
        detail: normalizerSupported ? "klar" : "mangler",
      },
      {
        key: "exact-url",
        label: "Eksakt URL",
        ready: exactUrlConfirmed,
        detail: exactUrlConfirmed ? "bekræftet" : "mangler",
      },
    ];

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierSlug: supplier.slug,
      family,
      tone: "blocked",
      statusLabel: "blokeret før probe",
      blocker: blockers.join(" og "),
      nextStep: extractorSupported && normalizerSupported
        ? "Bekræft eksakt Pixart produkt-URL før probe eller extraction."
        : "Implementer extractor og supplier-bank normalizer for profilen, og bekræft eksakt Pixart produkt-URL før probe.",
      safeCheckCommand: `npm run supplier-bank:pixart-readiness -- --family ${family}`,
      urlCandidateCount: urlCandidates.length,
      confirmedUrlCandidateCount,
      urlCandidatePreview: urlCandidates[0] || null,
      pixartProfile,
      pixartReadinessGates: readinessGates,
    };
  }

  if (supplier.slug === "print-com" && family === "other") {
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierSlug: supplier.slug,
      family,
      tone: "warning",
      statusLabel: "approval-gate",
      blocker: "Placemats er scoped som første smalle slice, men bank-only write er ikke godkendt.",
      nextStep: "Brug placemats preflight/approval-pakken og hold det bank-only indtil godkendt.",
      safeCheckCommand: "npm run supplier-bank:print-com-placemats-bank-write-preflight",
      urlCandidateCount: urlCandidates.length,
      confirmedUrlCandidateCount,
      urlCandidatePreview: urlCandidates[0] || null,
    };
  }

  if (supplier.slug === "wir-machen-druck") {
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierSlug: supplier.slug,
      family,
      tone: "warning",
      statusLabel: "bibliotekshylde",
      blocker: "Familien findes kun som planlagt WIRmachenDRUCK-bibliotekshylde endnu.",
      nextStep: "Lav dry extraction og normaliseret preview for denne familie, før der skrives bankdata eller oprettes produktdrafts.",
      safeCheckCommand: "npm run supplier-bank:coverage-gap-plan",
      urlCandidateCount: urlCandidates.length,
      confirmedUrlCandidateCount,
      urlCandidatePreview: urlCandidates[0] || null,
    };
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierSlug: supplier.slug,
    family,
    tone: "warning",
    statusLabel: "lokal preview mangler",
    blocker: "Familien har endnu ikke en lokal supplier-bank preview.",
    nextStep: "Start med dry extraction og normaliseret JSON, uden bank write eller produktimport.",
    safeCheckCommand: "npm run supplier-bank:coverage-gap-plan",
    urlCandidateCount: urlCandidates.length,
    confirmedUrlCandidateCount,
    urlCandidatePreview: urlCandidates[0] || null,
  };
}

async function countProductRowsForIds(tableName: string, productIds: string[]) {
  const entries = await Promise.all(productIds.map(async (productId) => {
    const { count, error } = await (supabase.from(tableName as any) as any)
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    return [productId, error ? null : (count ?? 0)] as const;
  }));

  return entries.reduce((acc, [productId, count]) => {
    acc[productId] = count;
    return acc;
  }, {} as Record<string, number | null>);
}

async function fetchAllSupabaseRows<T>(makeQuery: () => any) {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPPLIER_BANK_READ_PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + SUPPLIER_BANK_READ_PAGE_SIZE - 1);
    if (error) return { data: null, error };

    const pageRows = Array.isArray(data) ? data as T[] : [];
    rows.push(...pageRows);

    if (pageRows.length < SUPPLIER_BANK_READ_PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchExistingProductMatchData() {
  const productResult = await fetchAllSupabaseRows<ExistingProductRow>(() => (supabase.from("products" as any) as any)
    .select("id,name,slug,category,pricing_type,is_published")
    .order("name"));

  if (productResult.error) {
    return {
      products: [] as ExistingProductRow[],
      optionsByProductId: {} as Record<string, ExistingProductOptionGroup[]>,
      errorMessage: productResult.error.message || "Eksisterende produkter kunne ikke læses.",
    };
  }

  const productRows = productResult.data || [];
  const productIds = productRows.map((product) => product.id).filter(Boolean);
  const optionGroups: ExistingProductOptionGroup[] = [];

  for (const productIdChunk of chunkArray(productIds, 150)) {
    const groupResult = await fetchAllSupabaseRows<ExistingProductOptionGroup>(() => (supabase.from("product_attribute_groups" as any) as any)
      .select("id,product_id,name,kind,sort_order,values:product_attribute_values(id,name,enabled,sort_order)")
      .in("product_id", productIdChunk)
      .order("sort_order"));

    if (groupResult.error) {
      return {
        products: productRows,
        optionsByProductId: {} as Record<string, ExistingProductOptionGroup[]>,
        errorMessage: groupResult.error.message || "Produktvalg kunne ikke læses.",
      };
    }

    optionGroups.push(...(groupResult.data || []));
  }

  const optionsByProductId = optionGroups.reduce((acc, group) => {
    if (!acc[group.product_id]) acc[group.product_id] = [];
    acc[group.product_id].push({
      ...group,
      values: [...(group.values || [])].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0)),
    });
    return acc;
  }, {} as Record<string, ExistingProductOptionGroup[]>);

  return {
    products: productRows,
    optionsByProductId,
    errorMessage: null as string | null,
  };
}

export default function SupplierBank() {
  const { isAdmin, isMasterAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [products, setProducts] = useState<BankProductRow[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobRow[]>([]);
  const [importedTargetProductsById, setImportedTargetProductsById] = useState<Record<string, ImportedTargetProductRow>>({});
  const [importedTargetRowCountsById, setImportedTargetRowCountsById] = useState<Record<string, ImportedTargetRowCounts>>({});
  const [existingProducts, setExistingProducts] = useState<ExistingProductRow[]>([]);
  const [existingProductOptionsById, setExistingProductOptionsById] = useState<Record<string, ExistingProductOptionGroup[]>>({});
  const [existingProductMatchError, setExistingProductMatchError] = useState<string | null>(null);
  const [deltaReviews, setDeltaReviews] = useState<DeltaReviewRow[]>([]);
  const [refreshJobs, setRefreshJobs] = useState<RefreshJobRow[]>([]);
  const [snapshotStatsByProductId, setSnapshotStatsByProductId] = useState<Record<string, PriceSnapshotStat>>({});
  const [loading, setLoading] = useState(true);
  const [previewProduct, setPreviewProduct] = useState<BankProductRow | null>(null);
  const [linkPreview, setLinkPreview] = useState<ProductLinkPreview | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<PriceSnapshotPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSelection, setPreviewSelection] = useState<Record<string, string>>({});
  const [previewDraftImport, setPreviewDraftImport] = useState<DraftImportPreview | null>(null);
  const [previewDraftImportLoading, setPreviewDraftImportLoading] = useState(false);
  const [importingDraft, setImportingDraft] = useState(false);
  const [creatingDeltaReviewProductId, setCreatingDeltaReviewProductId] = useState<string | null>(null);
  const [updatingDeltaReviewId, setUpdatingDeltaReviewId] = useState<string | null>(null);
  const [queueingRefreshProductId, setQueueingRefreshProductId] = useState<string | null>(null);
  const [repairingImportJobId, setRepairingImportJobId] = useState<string | null>(null);
  const [repairingAllJobs, setRepairingAllJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankReadSource, setBankReadSource] = useState<BankReadSource>("none");
  const [bankReadDiagnostic, setBankReadDiagnostic] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSupplierId, setActiveSupplierId] = useState<string | "all">("all");
  const [familyFilter, setFamilyFilter] = useState<"all" | SupplierBankProductFamily>("all");
  const [bankStatusFilter, setBankStatusFilter] = useState<BankStatusFilter>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [showAdvancedProductTools, setShowAdvancedProductTools] = useState(false);
  const [simpleProductLimit, setSimpleProductLimit] = useState(SIMPLE_PRODUCT_PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    async function loadBank() {
      if (roleLoading) return;

      if (!isAdmin) {
        setLoading(false);
        setBankReadSource("none");
        setBankReadDiagnostic("Denne session har ikke admin-adgang til leverandørbanken.");
        setExistingProducts([]);
        setExistingProductOptionsById({});
        setExistingProductMatchError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setBankReadSource("none");
      setBankReadDiagnostic(null);

      const loadExistingMatches = async () => {
        const matchData = await fetchExistingProductMatchData();
        if (cancelled) return;
        setExistingProducts(matchData.products);
        setExistingProductOptionsById(matchData.optionsByProductId);
        setExistingProductMatchError(matchData.errorMessage);
      };

      const { data: adminReadData, error: adminReadError } = await supabase.functions.invoke("supplier-bank-admin-read", {
        body: {},
      });

      if (!cancelled && !adminReadError && !(adminReadData as any)?.error) {
        const payload = (adminReadData || {}) as any;
        setSuppliers((payload.suppliers || []) as SupplierRow[]);
        setProducts((payload.products || []) as BankProductRow[]);
        setImportJobs((payload.importJobs || []) as ImportJobRow[]);
        setImportedTargetProductsById((payload.importedTargetProductsById || {}) as Record<string, ImportedTargetProductRow>);
        setImportedTargetRowCountsById((payload.importedTargetRowCountsById || {}) as Record<string, ImportedTargetRowCounts>);
        setDeltaReviews((payload.deltaReviews || []) as DeltaReviewRow[]);
        setRefreshJobs((payload.refreshJobs || []) as RefreshJobRow[]);
        setSnapshotStatsByProductId((payload.snapshotStatsByProductId || {}) as Record<string, PriceSnapshotStat>);
        setBankReadSource("secure_admin_endpoint");
        setBankReadDiagnostic(null);
        await loadExistingMatches();
        if (cancelled) return;
        setLoading(false);
        return;
      }

      const adminReadMessage = adminReadError?.message
        || (adminReadData as any)?.error
        || "Det sikre admin-endpoint returnerede ingen supplier-bank data.";

      const [supplierResult, productResult, importJobResult, deltaReviewResult, refreshJobResult] = await Promise.all([
        fetchAllSupabaseRows<SupplierRow>(() => (supabase.from("supplier_bank_suppliers" as any) as any)
          .select("id,name,slug,enabled,integration_type,country_code,currency,metadata")
          .order("name")),
        fetchAllSupabaseRows<BankProductRow>(() => (supabase.from("supplier_bank_products" as any) as any)
          .select("id,supplier_id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,source_url,last_scraped_at,last_price_checked_at,raw_snapshot_path,normalized_attributes,normalized_pricing_summary,updated_at")
          .neq("status", "archived")
          .order("updated_at", { ascending: false })),
        fetchAllSupabaseRows<ImportJobRow>(() => (supabase.from("supplier_bank_import_jobs" as any) as any)
          .select("id,bank_product_id,target_tenant_id,target_product_id,import_mode,status,import_summary,rollback_note,created_at")
          .order("created_at", { ascending: false })),
        fetchAllSupabaseRows<DeltaReviewRow>(() => (supabase.from("supplier_bank_price_delta_reviews" as any) as any)
          .select("id,bank_product_id,new_price_snapshot_id,status,threshold_pct,change_summary,notes,created_at")
          .order("created_at", { ascending: false })),
        fetchAllSupabaseRows<RefreshJobRow>(() => (supabase.from("supplier_bank_refresh_jobs" as any) as any)
          .select("id,supplier_id,bank_product_id,mode,tool,status,request_summary,result_summary,error,queued_at,started_at,finished_at")
          .order("queued_at", { ascending: false })),
      ]);

      if (cancelled) return;

      const firstError = supplierResult.error || productResult.error;
      if (firstError) {
        setError(firstError.message || "Supplierbanken kunne ikke indlæses.");
        setBankReadSource("direct_rls");
        setBankReadDiagnostic(`${adminReadMessage} Direkte database-læsning fejlede også: ${firstError.message || "ukendt fejl"}`);
        setSuppliers([]);
        setProducts([]);
        setImportJobs([]);
        setImportedTargetProductsById({});
        setImportedTargetRowCountsById({});
        setSnapshotStatsByProductId({});
        setExistingProducts([]);
        setExistingProductOptionsById({});
        setExistingProductMatchError(null);
      } else {
        const productRows = (productResult.data || []) as BankProductRow[];
        const importJobRows = importJobResult.error ? [] : ((importJobResult.data || []) as ImportJobRow[]);
        let snapshotStats: Record<string, PriceSnapshotStat> = {};
        let importedTargetProducts: Record<string, ImportedTargetProductRow> = {};
        let importedTargetRowCounts: Record<string, ImportedTargetRowCounts> = {};

        if (productRows.length > 0) {
          const { data: snapshotRows, error: snapshotStatsError } = await fetchAllSupabaseRows<any>(() => (supabase.from("supplier_bank_price_snapshots" as any) as any)
            .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
            .in("bank_product_id", productRows.map((product) => product.id))
            .order("created_at", { ascending: false }));

          if (!snapshotStatsError) {
            snapshotStats = (snapshotRows || []).reduce((acc, row: any) => {
              const productId = row.bank_product_id as string | undefined;
              if (!productId) return acc;
              const current = acc[productId] || {
                count: 0,
                latestSnapshotId: null,
                latestCreatedAt: null,
                quantityMin: null,
                quantityMax: null,
                priceMinDkk: null,
                priceMaxDkk: null,
              };
              acc[productId] = {
                count: current.count + 1,
                latestSnapshotId: current.latestSnapshotId || row.id || null,
                latestCreatedAt: current.latestCreatedAt || row.created_at || null,
                quantityMin: current.quantityMin ?? toNumber(row.quantity_min),
                quantityMax: current.quantityMax ?? toNumber(row.quantity_max),
                priceMinDkk: current.priceMinDkk ?? toNumber(row.price_min_dkk),
                priceMaxDkk: current.priceMaxDkk ?? toNumber(row.price_max_dkk),
              };
              return acc;
            }, {} as Record<string, PriceSnapshotStat>);
          }
        }

        const targetProductIds = Array.from(new Set(
          importJobRows
            .map((job) => job.target_product_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        ));

        if (targetProductIds.length > 0) {
          const { data: targetProducts, error: targetProductsError } = await (supabase.from("products" as any) as any)
            .select("id,name,slug,pricing_type,is_published")
            .in("id", targetProductIds);

          if (!targetProductsError) {
            importedTargetProducts = ((targetProducts || []) as ImportedTargetProductRow[]).reduce((acc, product) => {
              acc[product.id] = product;
              return acc;
            }, {} as Record<string, ImportedTargetProductRow>);
          }

          const [
            genericPriceCounts,
            storformatMaterialCounts,
            storformatFinishCounts,
            storformatVariantCounts,
          ] = await Promise.all([
            countProductRowsForIds("generic_product_prices", targetProductIds),
            countProductRowsForIds("storformat_materials", targetProductIds),
            countProductRowsForIds("storformat_finishes", targetProductIds),
            countProductRowsForIds("storformat_products", targetProductIds),
          ]);

          importedTargetRowCounts = targetProductIds.reduce((acc, productId) => {
            acc[productId] = {
              genericPrices: genericPriceCounts[productId] ?? null,
              storformatMaterials: storformatMaterialCounts[productId] ?? null,
              storformatFinishes: storformatFinishCounts[productId] ?? null,
              storformatVariants: storformatVariantCounts[productId] ?? null,
            };
            return acc;
          }, {} as Record<string, ImportedTargetRowCounts>);
        }

        if (cancelled) return;

        setSuppliers((supplierResult.data || []) as SupplierRow[]);
        setProducts(productRows);
        setImportJobs(importJobRows);
        setImportedTargetProductsById(importedTargetProducts);
        setImportedTargetRowCountsById(importedTargetRowCounts);
        setDeltaReviews(deltaReviewResult.error ? [] : ((deltaReviewResult.data || []) as DeltaReviewRow[]));
        setRefreshJobs(refreshJobResult.error ? [] : ((refreshJobResult.data || []) as RefreshJobRow[]));
        setSnapshotStatsByProductId(snapshotStats);
        setBankReadSource("direct_rls");
        setBankReadDiagnostic(adminReadMessage);
        await loadExistingMatches();
        if (cancelled) return;
      }

      setLoading(false);
    }

    loadBank();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, roleLoading]);

  const supplierById = useMemo(() => {
    return new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  }, [suppliers]);

  const baseFilteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const supplier = supplierById.get(product.supplier_id);
      const matchesSearch = !query
        || product.name_da.toLowerCase().includes(query)
        || product.name_original.toLowerCase().includes(query)
        || supplier?.name.toLowerCase().includes(query);
      const matchesSupplier = activeSupplierId === "all" || product.supplier_id === activeSupplierId;
      const matchesFamily = familyFilter === "all" || product.product_family === familyFilter;
      return matchesSearch && matchesSupplier && matchesFamily;
    });
  }, [activeSupplierId, familyFilter, products, search, supplierById]);

  useEffect(() => {
    setSimpleProductLimit(SIMPLE_PRODUCT_PAGE_SIZE);
  }, [activeSupplierId, familyFilter, search]);
  const statusFilteredProducts = useMemo(() => {
    if (bankStatusFilter === "all") return baseFilteredProducts;
    return baseFilteredProducts.filter((product) => product.status === bankStatusFilter);
  }, [bankStatusFilter, baseFilteredProducts]);

  const selectedSupplier = activeSupplierId === "all"
    ? null
    : suppliers.find((supplier) => supplier.id === activeSupplierId) || null;
  const importedJobCount = importJobs.filter((job) => job.status === "imported").length;
  const activeRefreshJobCount = refreshJobs.filter((job) => ["queued", "running"].includes(job.status)).length;
  const latestImportedJobByProductId = useMemo(() => {
    const entries = new Map<string, ImportJobRow>();
    importJobs
      .filter((job) => job.status === "imported" && job.bank_product_id)
      .forEach((job) => {
        if (!entries.has(job.bank_product_id)) entries.set(job.bank_product_id, job);
      });
    return entries;
  }, [importJobs]);
  const latestDeltaReviewByProductId = useMemo(() => {
    const entries = new Map<string, DeltaReviewRow>();
    deltaReviews
      .filter((review) => review.bank_product_id)
      .forEach((review) => {
        if (!entries.has(review.bank_product_id)) entries.set(review.bank_product_id, review);
      });
    return entries;
  }, [deltaReviews]);
  const latestRefreshJobByProductId = useMemo(() => {
    const entries = new Map<string, RefreshJobRow>();
    refreshJobs
      .filter((job) => job.bank_product_id)
      .forEach((job) => {
        if (!entries.has(job.bank_product_id)) entries.set(job.bank_product_id, job);
      });
    return entries;
  }, [refreshJobs]);
  const existingProductMatchSuggestionsByBankProductId = useMemo(() => {
    const entries = new Map<string, ProductMatchSuggestion[]>();
    products.forEach((product) => {
      const importedJob = latestImportedJobByProductId.get(product.id);
      const importedTargetProduct = importedJob?.target_product_id
        ? importedTargetProductsById[importedJob.target_product_id] || null
        : null;
      entries.set(product.id, getExistingProductMatchSuggestions({
        bankProduct: product,
        existingProducts,
        optionsByProductId: existingProductOptionsById,
        importedTargetProduct,
      }));
    });
    return entries;
  }, [
    existingProductOptionsById,
    existingProducts,
    importedTargetProductsById,
    latestImportedJobByProductId,
    products,
  ]);
  const readinessBySupplierId = useMemo(() => {
    const result = new Map<string, ReadinessSummary>();
    products.forEach((product) => {
      const current = result.get(product.supplier_id) || { ready: 0, blocked: 0, imported: 0 };
      const importedSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
      if (importedSlug) {
        current.imported += 1;
      } else {
        const reason = getImportBlockReason(
          product,
          latestDeltaReviewByProductId.get(product.id),
          snapshotStatsByProductId[product.id]
        );
        if (reason) current.blocked += 1;
        else current.ready += 1;
      }
      result.set(product.supplier_id, current);
    });
    return result;
  }, [latestDeltaReviewByProductId, latestImportedJobByProductId, products, snapshotStatsByProductId]);
  const allReadiness = useMemo(() => {
    return Array.from(readinessBySupplierId.values()).reduce((summary, item) => ({
      ready: summary.ready + item.ready,
      blocked: summary.blocked + item.blocked,
      imported: summary.imported + item.imported,
    }), { ready: 0, blocked: 0, imported: 0 });
  }, [readinessBySupplierId]);
  const coverageBySupplierId = useMemo(() => {
    const stagedFamiliesBySupplierId = products.reduce((acc, product) => {
      const family = product.product_family;
      if (!acc.has(product.supplier_id)) acc.set(product.supplier_id, new Set<SupplierBankProductFamily>());
      acc.get(product.supplier_id)?.add(family);
      return acc;
    }, new Map<string, Set<SupplierBankProductFamily>>());

    return new Map(suppliers.map((supplier) => {
      const expectedFamilies = getSupplierExpectedFamilies(supplier);
      const stagedFamilies = Array.from(stagedFamiliesBySupplierId.get(supplier.id) || []);
      const missingFamilies = expectedFamilies.filter((family) => !stagedFamilies.includes(family));
      const productCount = products.filter((product) => product.supplier_id === supplier.id).length;
      return [supplier.id, {
        expectedFamilies,
        stagedFamilies,
        missingFamilies,
        productCount,
      } satisfies SupplierCoverageSummary] as const;
    }));
  }, [products, suppliers]);
  const coverageTotals = useMemo(() => {
    return Array.from(coverageBySupplierId.values()).reduce((summary, coverage) => ({
      expected: summary.expected + coverage.expectedFamilies.length,
      staged: summary.staged + coverage.stagedFamilies.length,
      missing: summary.missing + coverage.missingFamilies.length,
    }), { expected: 0, staged: 0, missing: 0 });
  }, [coverageBySupplierId]);
  const selectedSupplierCoverage = selectedSupplier
    ? coverageBySupplierId.get(selectedSupplier.id) || null
    : null;
  const selectedReadiness = useMemo(() => {
    if (activeSupplierId !== "all") {
      return readinessBySupplierId.get(activeSupplierId) || { ready: 0, blocked: 0, imported: 0 };
    }
    return allReadiness;
  }, [activeSupplierId, allReadiness, readinessBySupplierId]);
  const selectedSupplierAction = useMemo(() => {
    if (selectedReadiness.ready > 0) {
      return {
        tone: "ready" as const,
        label: `${selectedReadiness.ready} produkt${selectedReadiness.ready === 1 ? "" : "er"} klar til import`,
        description: "Start med at åbne produktet, tjek previewet og importer som upubliceret draft.",
      };
    }
    if (selectedReadiness.imported > 0) {
      return {
        tone: "info" as const,
        label: `${selectedReadiness.imported} draft${selectedReadiness.imported === 1 ? "" : "s"} oprettet`,
        description: "Næste skridt er at gennemgå de importerede drafts i produktadmin.",
      };
    }
    if (selectedReadiness.blocked > 0) {
      return {
        tone: "blocked" as const,
        label: `${selectedReadiness.blocked} produkt${selectedReadiness.blocked === 1 ? "" : "er"} blokeret`,
        description: "Løs prisreview, snapshots eller kilde-refresh før import.",
      };
    }
    return {
      tone: "info" as const,
      label: "Ingen aktive produkter i dette filter",
      description: "Vælg en anden leverandør eller ryd filteret.",
    };
  }, [selectedReadiness]);
  const activeProductFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (search.trim()) labels.push(`Søgning: ${search.trim()}`);
    if (familyFilter !== "all") labels.push(`Familie: ${getSupplierBankProductFamilyLabelDa(familyFilter)}`);
    if (bankStatusFilter !== "all") labels.push(`Bankstatus: ${getBankStatusFilterLabel(bankStatusFilter)}`);
    if (readinessFilter !== "all") labels.push(`Import: ${getReadinessFilterLabel(readinessFilter)}`);
    return labels;
  }, [bankStatusFilter, familyFilter, readinessFilter, search]);
  const supplierCatalogCards = useMemo(() => {
    return suppliers.map((supplier) => {
      const coverage = coverageBySupplierId.get(supplier.id) || {
        expectedFamilies: [],
        stagedFamilies: [],
        missingFamilies: [],
        productCount: 0,
      };
      const readiness = readinessBySupplierId.get(supplier.id) || { ready: 0, blocked: 0, imported: 0 };
      const status = getSupplierCatalogCardStatus({
        readiness,
        missingFamilies: coverage.missingFamilies,
      });

      return {
        supplierId: supplier.id,
        name: supplier.name,
        enabled: supplier.enabled,
        productCount: coverage.productCount,
        expectedFamilyCount: coverage.expectedFamilies.length,
        stagedFamilies: coverage.stagedFamilies,
        missingFamilies: coverage.missingFamilies,
        readiness,
        ...status,
      } satisfies SupplierCatalogCard;
    }).sort((left, right) => {
      const toneRank = { ready: 0, blocked: 1, warning: 2, info: 3 } as Record<ProductNextAction["tone"], number>;
      const toneDelta = toneRank[left.tone] - toneRank[right.tone];
      if (toneDelta !== 0) return toneDelta;
      const readyDelta = right.readiness.ready - left.readiness.ready;
      if (readyDelta !== 0) return readyDelta;
      return left.name.localeCompare(right.name);
    });
  }, [coverageBySupplierId, readinessBySupplierId, suppliers]);
  const selectedSupplierFamilyRows = useMemo(() => {
    if (!selectedSupplier || !selectedSupplierCoverage) return [];

    const plannedFamilies = selectedSupplierCoverage.expectedFamilies.length > 0
      ? selectedSupplierCoverage.expectedFamilies
      : selectedSupplierCoverage.stagedFamilies;

    return plannedFamilies.map((family) => {
      const productCount = products.filter((product) => (
        product.supplier_id === selectedSupplier.id && product.product_family === family
      )).length;
      const state: SupplierFamilyOverviewRow["state"] = productCount > 0 ? "staged" : "missing";

      return {
        family,
        state,
        productCount,
        urlCandidateCount: state === "missing"
          ? getSupplierFamilyUrlCandidates(selectedSupplier, family).length
          : 0,
      } satisfies SupplierFamilyOverviewRow;
    });
  }, [products, selectedSupplier, selectedSupplierCoverage]);
  const selectedSupplierFamilyShelves = useMemo(() => {
    if (!selectedSupplier || !selectedSupplierCoverage) return [];

    return selectedSupplierFamilyRows.map((row) => {
      const familyProducts = products.filter((product) => (
        product.supplier_id === selectedSupplier.id && product.product_family === row.family
      ));
      const readiness = familyProducts.reduce((summary, product) => {
        const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
        if (importedProductSlug) {
          summary.imported += 1;
          return summary;
        }

        const importBlockReason = getImportBlockReason(
          product,
          latestDeltaReviewByProductId.get(product.id),
          snapshotStatsByProductId[product.id]
        );
        if (importBlockReason) summary.blocked += 1;
        else summary.ready += 1;
        return summary;
      }, { ready: 0, imported: 0, blocked: 0 });

      const pricing = familyProducts.reduce((summary, product) => {
        const productPricing = resolveProductPricingSummary(product, snapshotStatsByProductId[product.id]);
        const rowCount = productPricing.rows;
        const priceMin = productPricing.priceMinDkk;
        const priceMax = productPricing.priceMaxDkk;
        const latestUpdatedAt = snapshotStatsByProductId[product.id]?.latestCreatedAt || product.last_price_checked_at || product.updated_at || null;

        summary.priceRows += rowCount;
        if (priceMin != null) summary.priceMinDkk = summary.priceMinDkk == null ? priceMin : Math.min(summary.priceMinDkk, priceMin);
        if (priceMax != null) summary.priceMaxDkk = summary.priceMaxDkk == null ? priceMax : Math.max(summary.priceMaxDkk, priceMax);
        if (latestUpdatedAt && (!summary.latestUpdatedAt || new Date(latestUpdatedAt) > new Date(summary.latestUpdatedAt))) {
          summary.latestUpdatedAt = latestUpdatedAt;
        }
        return summary;
      }, {
        priceRows: 0,
        priceMinDkk: null as number | null,
        priceMaxDkk: null as number | null,
        latestUpdatedAt: null as string | null,
      });
      const nextStep = getSupplierFamilyShelfNextStep({
        supplier: selectedSupplier,
        family: row.family,
        state: row.state,
        readiness,
      });

      return {
        ...row,
        readiness,
        ...pricing,
        ...nextStep,
      } satisfies SupplierFamilyShelfRow;
    });
  }, [
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    products,
    selectedSupplier,
    selectedSupplierCoverage,
    selectedSupplierFamilyRows,
    snapshotStatsByProductId,
  ]);
  const bankStatusCounts = useMemo(() => {
    return baseFilteredProducts.reduce((summary, product) => {
      summary[product.status] = (summary[product.status] || 0) + 1;
      return summary;
    }, {} as Partial<Record<SupplierBankProductStatus, number>>);
  }, [baseFilteredProducts]);
  const baseFilteredReadiness = useMemo(() => {
    return statusFilteredProducts.reduce((summary, product) => {
      const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
      const importBlockReason = getImportBlockReason(
        product,
        latestDeltaReviewByProductId.get(product.id),
        snapshotStatsByProductId[product.id]
      );
      const state = getProductReadinessState(importedProductSlug, importBlockReason);
      summary[state] += 1;
      return summary;
    }, { ready: 0, imported: 0, blocked: 0 });
  }, [latestDeltaReviewByProductId, latestImportedJobByProductId, snapshotStatsByProductId, statusFilteredProducts]);
  const filteredProducts = useMemo(() => {
    if (readinessFilter === "all") return statusFilteredProducts;
    return statusFilteredProducts.filter((product) => {
      const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
      const importBlockReason = getImportBlockReason(
        product,
        latestDeltaReviewByProductId.get(product.id),
        snapshotStatsByProductId[product.id]
      );
      return getProductReadinessState(importedProductSlug, importBlockReason) === readinessFilter;
    });
  }, [
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    readinessFilter,
    snapshotStatsByProductId,
    statusFilteredProducts,
  ]);
  const businessImportQueueItems = useMemo(() => {
    const toneRank = { ready: 0, warning: 1, blocked: 2, info: 3 } as Record<ProductNextAction["tone"], number>;

    return filteredProducts
      .map((product) => {
        const supplier = supplierById.get(product.supplier_id);
        const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
        const importBlockReason = getImportBlockReason(
          product,
          latestDeltaReviewByProductId.get(product.id),
          snapshotStatsByProductId[product.id]
        );
        const safeAction = getProductSafeActionSummary({
          product,
          supplier,
          importedProductSlug,
          importBlockReason,
        });
        const pricing = resolveProductPricingSummary(product, snapshotStatsByProductId[product.id]);

        return {
          product,
          supplierName: supplier?.name || "Ukendt leverandør",
          productName: product.name_da || product.name_original,
          family: product.product_family,
          tone: safeAction.tone,
          statusLabel: getImportReadinessLabel(product, importedProductSlug, importBlockReason),
          description: safeAction.description,
          priceRows: pricing.rows,
          importedProductSlug,
          safeCheckCommand: safeAction.safeCheckCommand,
        } satisfies BusinessImportQueueItem;
      })
      .sort((left, right) => {
        const toneDelta = toneRank[left.tone] - toneRank[right.tone];
        if (toneDelta !== 0) return toneDelta;
        const rowDelta = right.priceRows - left.priceRows;
        if (rowDelta !== 0) return rowDelta;
        return left.productName.localeCompare(right.productName);
      })
      .slice(0, 6);
  }, [
    filteredProducts,
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    snapshotStatsByProductId,
    supplierById,
  ]);
  const productSpotlightItems = useMemo(() => {
    return baseFilteredProducts.slice(0, simpleProductLimit).map((product) => {
      const supplier = supplierById.get(product.supplier_id);
      const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
      const importBlockReason = getImportBlockReason(
        product,
        latestDeltaReviewByProductId.get(product.id),
        snapshotStatsByProductId[product.id]
      );
      const pricing = resolveProductPricingSummary(product, snapshotStatsByProductId[product.id]);

      return {
        product,
        supplierName: supplier?.name || "Ukendt leverandør",
        productName: product.name_da || product.name_original,
        familyLabel: getSupplierBankProductFamilyLabelDa(product.product_family),
        readinessLabel: getImportReadinessLabel(product, importedProductSlug, importBlockReason),
        readinessVariant: getImportReadinessVariant(importedProductSlug, importBlockReason),
        importedProductSlug,
        importBlockReason,
        priceRows: pricing.rows,
        priceMinDkk: pricing.priceMinDkk,
        priceMaxDkk: pricing.priceMaxDkk,
        latestUpdatedAt: snapshotStatsByProductId[product.id]?.latestCreatedAt || product.last_price_checked_at || product.updated_at || null,
        attributePreviewRows: getAttributePreviewRows(product.normalized_attributes, 6),
      } satisfies ProductSpotlightItem;
    });
  }, [
    baseFilteredProducts,
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    simpleProductLimit,
    snapshotStatsByProductId,
    supplierById,
  ]);
  const hiddenSimpleProductCount = Math.max(0, baseFilteredProducts.length - productSpotlightItems.length);
  const simpleFamilyPickerItems = useMemo(() => {
    const counts = products.reduce((acc, product) => {
      acc[product.product_family] = (acc[product.product_family] || 0) + 1;
      return acc;
    }, {} as Partial<Record<SupplierBankProductFamily, number>>);

    return SUPPLIER_BANK_PRODUCT_FAMILIES
      .map((family) => ({
        family,
        label: getSupplierBankProductFamilyLabelDa(family),
        productCount: counts[family] || 0,
      } satisfies SimpleFamilyPickerItem))
      .filter((item) => item.productCount > 0);
  }, [products]);
  const productFinderSupplierItems = useMemo(() => {
    const familyProducts = products.filter((product) => (
      familyFilter === "all" || product.product_family === familyFilter
    ));
    const activeProducts = familyProducts.filter((product) => product.status !== "archived");
    const allReadyCount = activeProducts.filter((product) => {
      const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
      const importBlockReason = getImportBlockReason(
        product,
        latestDeltaReviewByProductId.get(product.id),
        snapshotStatsByProductId[product.id]
      );
      return !importedProductSlug && !importBlockReason;
    }).length;

    const supplierItems = suppliers
      .map((supplier) => {
        const supplierProducts = activeProducts.filter((product) => product.supplier_id === supplier.id);
        const readyCount = supplierProducts.filter((product) => {
          const importedProductSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
          const importBlockReason = getImportBlockReason(
            product,
            latestDeltaReviewByProductId.get(product.id),
            snapshotStatsByProductId[product.id]
          );
          return !importedProductSlug && !importBlockReason;
        }).length;
        return {
          supplierId: supplier.id,
          name: supplier.name,
          productCount: supplierProducts.length,
          readyCount,
        } satisfies ProductFinderSupplierItem;
      })
      .filter((item) => item.productCount > 0)
      .sort((left, right) => {
        const countDelta = right.productCount - left.productCount;
        if (countDelta !== 0) return countDelta;
        return left.name.localeCompare(right.name);
      });

    return [
      {
        supplierId: "all",
        name: "Alle trykkerier",
        productCount: activeProducts.length,
        readyCount: allReadyCount,
      } satisfies ProductFinderSupplierItem,
      ...supplierItems,
    ];
  }, [
    familyFilter,
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    products,
    snapshotStatsByProductId,
    suppliers,
  ]);
  const importEligibilitySummary = useMemo(() => {
    return products.reduce((summary, product) => {
      const importedSlug = getImportedProductSlug(latestImportedJobByProductId.get(product.id));
      if (importedSlug) return summary;

      const reason = getImportBlockReason(
        product,
        latestDeltaReviewByProductId.get(product.id),
        snapshotStatsByProductId[product.id]
      );

      if (reason) summary.blocked += 1;
      else summary.ready += 1;
      return summary;
    }, { ready: 0, blocked: 0 });
  }, [latestDeltaReviewByProductId, latestImportedJobByProductId, products, snapshotStatsByProductId]);
  const importedDraftQaSummary = useMemo(() => {
    return importJobs
      .filter((job) => job.status === "imported")
      .reduce((summary, job) => {
        summary.checked += 1;
        if (job.import_mode === "matrix_layout_v1") summary.matrix += 1;
        if (job.import_mode === "storformat") summary.storformat += 1;

        const targetProduct = job.target_product_id ? importedTargetProductsById[job.target_product_id] : null;
        const rowCounts = job.target_product_id ? importedTargetRowCountsById[job.target_product_id] : null;
        const importSummary = job.import_summary && typeof job.import_summary === "object" ? job.import_summary : {};
        const issues: string[] = [];
        const warnings: string[] = [];

        if (!targetProduct) {
          issues.push("target mangler");
        } else {
          if (targetProduct.is_published) issues.push("publiceret");
          if (job.import_mode === "matrix_layout_v1") {
            const expectedRows = extractExpectedMatrixRows(importSummary);
            if (!isMatrixPricingType(targetProduct.pricing_type)) {
              issues.push("forkert pricing type");
            }
            if (rowCounts?.genericPrices == null) {
              warnings.push("matrix-prislinjer kan ikke tælles");
            }
            if (rowCounts?.genericPrices === 0) {
              issues.push("ingen matrix-prislinjer");
            }
            if (expectedRows != null && rowCounts?.genericPrices != null && expectedRows !== rowCounts.genericPrices) {
              warnings.push("matrix row mismatch");
            }
          } else if (job.import_mode === "storformat") {
            if (targetProduct.pricing_type !== "STORFORMAT") {
              issues.push("forkert storformat pricing type");
            }
            if (rowCounts?.storformatMaterials === 0) issues.push("ingen materialer");
            if (rowCounts?.storformatVariants === 0) issues.push("ingen varianter");
            const expectedMaterials = getExpectedStorformatCount(importSummary, "materials");
            const expectedVariants = getExpectedStorformatCount(importSummary, "variants");
            if (expectedMaterials != null && rowCounts?.storformatMaterials != null && expectedMaterials !== rowCounts.storformatMaterials) {
              warnings.push("materiale-count mismatch");
            }
            if (expectedVariants != null && rowCounts?.storformatVariants != null && expectedVariants !== rowCounts.storformatVariants) {
              warnings.push("variant-count mismatch");
            }
          } else {
            warnings.push("ukendt import mode");
          }
        }

        if (targetProduct?.is_published) summary.published += 1;
        if (issues.length > 0) summary.errors += 1;
        else if (warnings.length > 0) summary.warnings += 1;
        else summary.ok += 1;
        return summary;
      }, {
        checked: 0,
        ok: 0,
        warnings: 0,
        errors: 0,
        published: 0,
        matrix: 0,
        storformat: 0,
      } satisfies ImportedDraftQaSummary);
  }, [importJobs, importedTargetProductsById, importedTargetRowCountsById]);
  const publishedImportedTargets = useMemo(() => {
    return importJobs
      .filter((job) => job.status === "imported" && job.target_product_id)
      .map((job) => {
        const targetProduct = job.target_product_id
          ? importedTargetProductsById[job.target_product_id]
          : null;
        if (!targetProduct?.is_published) return null;
        const bankProduct = products.find((product) => product.id === job.bank_product_id) || null;
        return {
          job,
          targetProduct,
          bankProduct,
        };
      })
      .filter((item): item is {
        job: ImportJobRow;
        targetProduct: ImportedTargetProductRow;
        bankProduct: BankProductRow | null;
      } => Boolean(item));
  }, [importJobs, importedTargetProductsById, products]);
  const matrixRepairJobs = useMemo(() => {
    return importJobs
      .filter((job) => job.import_mode === "matrix_layout_v1" && job.status === "imported")
      .filter((job) => {
        const targetProduct = job.target_product_id ? importedTargetProductsById[job.target_product_id] : null;
        const rowCounts = job.target_product_id ? importedTargetRowCountsById[job.target_product_id] : null;
        return needsMatrixRepair(job, targetProduct, rowCounts);
      });
  }, [importJobs, importedTargetProductsById, importedTargetRowCountsById]);
  const decisionQueueItems = useMemo(() => {
    const items: DecisionQueueItem[] = [];
    const pixartRigidsProduct = products.find((product) => product.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY);

    if (pixartRigidsProduct) {
      const snapshotStats = snapshotStatsByProductId[pixartRigidsProduct.id] || getEmptySnapshotStats();
      const deltaReview = latestDeltaReviewByProductId.get(pixartRigidsProduct.id);
      const importedSlug = getImportedProductSlug(latestImportedJobByProductId.get(pixartRigidsProduct.id));
      const blockReason = getImportBlockReason(pixartRigidsProduct, deltaReview, snapshotStats);

      if (!importedSlug && blockReason) {
        items.push({
          priority: "high",
          tone: "blocked",
          title: "Pixart pladematerialer afventer beslutning",
          description: "Det gemte bankprodukt er blokeret for almindelig Matrix-import og skal afklares via bank-only snapshot/storformat-flowet.",
          details: [
            `Status: ${pixartRigidsProduct.status}`,
            `Snapshots: ${snapshotStats.count}`,
            deltaReview ? `Prisreview: ${getDeltaReviewStatusLabel(deltaReview.status)}` : "Prisreview: mangler eller ikke relevant endnu",
            blockReason,
          ],
        });
      }
    }

    const importedJobs = importJobs.filter((job) => job.status === "imported");
    const publishedTargets = importedJobs.filter((job) => {
      const targetProduct = job.target_product_id ? importedTargetProductsById[job.target_product_id] : null;
      return targetProduct?.is_published === true;
    });

    if (importedDraftQaSummary.errors > 0 || publishedTargets.length > 0) {
      items.push({
        priority: "high",
        tone: "blocked",
        title: "Importerede drafts kræver QA-kontrol",
        description: "Et eller flere importerede supplier-bank drafts har publish-, pricing- eller row-count problemer.",
        details: [
          `${importedDraftQaSummary.errors} fejl`,
          `${importedDraftQaSummary.published} publicerede target produkter`,
          `${importedDraftQaSummary.matrix}/${importedDraftQaSummary.storformat} Matrix/STORFORMAT imports`,
          ...publishedTargets.slice(0, 2).map((job) => {
            const targetProduct = job.target_product_id ? importedTargetProductsById[job.target_product_id] : null;
            return targetProduct ? `${targetProduct.name} (${targetProduct.slug})` : job.target_product_id || job.id;
          }),
        ],
      });
    } else if (importedDraftQaSummary.warnings > 0) {
      items.push({
        priority: "medium",
        tone: "warning",
        title: "Importerede drafts har QA-advarsler",
        description: "Drafts er ikke publiceret, men en eller flere row counts matcher ikke import-auditsporet helt.",
        details: [
          `${importedDraftQaSummary.warnings} advarsler`,
          `${importedDraftQaSummary.ok} OK`,
          `${importedDraftQaSummary.matrix}/${importedDraftQaSummary.storformat} Matrix/STORFORMAT imports`,
        ],
      });
    } else if (importedJobs.length > 0) {
      const readableTargets = importedJobs.filter((job) => job.target_product_id && importedTargetProductsById[job.target_product_id]).length;
      items.push({
        priority: "low",
        tone: "info",
        title: "Importerede drafts er QA-rene og upublicerede",
        description: "Supplier-bank har oprettet drafts; næste skridt er almindelig produktkontrol, ikke automatisk publicering.",
        details: [
          `${importedDraftQaSummary.ok}/${importedDraftQaSummary.checked} drafts OK`,
          `${readableTargets} target produkter kunne læses i browseren`,
          `${importedDraftQaSummary.matrix}/${importedDraftQaSummary.storformat} Matrix/STORFORMAT imports`,
        ],
      });
    }

    const coverageGaps = suppliers
      .map((supplier) => {
        const coverage = coverageBySupplierId.get(supplier.id);
        if (!coverage || coverage.missingFamilies.length === 0) return null;
        return `${supplier.name}: ${formatFamilyLabels(coverage.missingFamilies)}`;
      })
      .filter((value): value is string => Boolean(value));

    if (coverageGaps.length > 0) {
      items.push({
        priority: "medium",
        tone: "warning",
        title: "Der mangler stadig planlagte produktfamilier",
        description: "Næste nye supplier-slice bør starte som lokal dry extraction og preview, ikke som produktimport.",
        details: coverageGaps,
      });
    }

    if (activeRefreshJobCount > 0) {
      items.push({
        priority: "medium",
        tone: "info",
        title: "Refresh jobs afventer worker/CLI",
        description: "Refresh-køn ændrer ikke priser alene; den skal behandles af den godkendte worker/CLI og derefter prisreviewes.",
        details: [`${activeRefreshJobCount} refresh job(s) er queued/running.`],
      });
    }

    if (items.length === 0) {
      items.push({
        priority: "low",
        tone: "ready",
        title: "Ingen åbne supplier-bank beslutninger i visningen",
        description: "Fortsat arbejde kan planlægges fra dækningskortet eller med en ny lokal supplier-slice.",
        details: ["Ingen blokerede produkter, publicerede import-targets eller coverage gaps blev fundet."],
      });
    }

    return items.slice(0, 5);
  }, [
    activeRefreshJobCount,
    coverageBySupplierId,
    importJobs,
    importedDraftQaSummary,
    importedTargetProductsById,
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    products,
    snapshotStatsByProductId,
    suppliers,
  ]);
  const pixartUrlCandidateRows = useMemo(() => {
    const pixartSupplier = suppliers.find((supplier) => supplier.slug === "pixartprinting");
    if (!pixartSupplier) return [];
    const coverage = coverageBySupplierId.get(pixartSupplier.id);
    const missingFamilies = coverage?.missingFamilies || [];
    const rows: SupplierUrlCandidateRow[] = [];

    missingFamilies.forEach((family) => {
      getSupplierFamilyUrlCandidates(pixartSupplier, family).forEach((candidate) => {
        rows.push({
          supplierId: pixartSupplier.id,
          supplierName: pixartSupplier.name,
          supplierSlug: pixartSupplier.slug,
          family,
          candidate,
        });
      });
    });

    return rows;
  }, [coverageBySupplierId, suppliers]);
  const pixartUrlCandidateSummary = useMemo(() => {
    return pixartUrlCandidateRows.reduce(
      (acc, row) => {
        if (row.candidate.status === "confirmed_source_url") acc.confirmed += 1;
        else if (row.candidate.status === "rejected") acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, confirmed: 0, rejected: 0 }
    );
  }, [pixartUrlCandidateRows]);
  const gateRoadmapItems = useMemo(() => {
    const items: GateRoadmapItem[] = [];
    const pixartSupplier = suppliers.find((supplier) => supplier.slug === "pixartprinting");
    const printComSupplier = suppliers.find((supplier) => supplier.slug === "print-com");
    const pixartCoverage = pixartSupplier ? coverageBySupplierId.get(pixartSupplier.id) : undefined;
    const printComCoverage = printComSupplier ? coverageBySupplierId.get(printComSupplier.id) : undefined;
    const pixartRigidsProduct = products.find((product) => product.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY);
    const printComOtherMissing = Boolean(printComCoverage?.missingFamilies.includes("other" as SupplierBankProductFamily));
    const pixartMissingFamilies = pixartCoverage?.missingFamilies || [];
    const confirmedPixartUrlCandidates = pixartUrlCandidateRows.filter((row) => row.candidate.status === "confirmed_source_url").length;
    const importedDraftsAreClean = importedDraftQaSummary.checked > 0
      && importedDraftQaSummary.errors === 0
      && importedDraftQaSummary.warnings === 0
      && importedDraftQaSummary.published === 0;

    if (pixartRigidsProduct) {
      const snapshotStats = snapshotStatsByProductId[pixartRigidsProduct.id] || getEmptySnapshotStats();
      const deltaReview = latestDeltaReviewByProductId.get(pixartRigidsProduct.id);
      const importedSlug = getImportedProductSlug(latestImportedJobByProductId.get(pixartRigidsProduct.id));
      const blockReason = getImportBlockReason(pixartRigidsProduct, deltaReview, snapshotStats);

      items.push({
        order: 1,
        tone: blockReason && !importedSlug ? "blocked" : "info",
        priority: "high",
        title: "Afklar Pixart pladematerialer",
        description: "Det er hovedporten før rigids/signs kan komme videre fra den gamle Plastic-only bankstatus.",
        details: [
          `Status: ${pixartRigidsProduct.status}`,
          `Snapshots: ${snapshotStats.count}`,
          deltaReview ? `Prisreview: ${getDeltaReviewStatusLabel(deltaReview.status)}` : "Prisreview: ikke klar",
          importedSlug ? `Draft: ${importedSlug}` : (blockReason || "Afventer bank-only beslutning"),
        ],
        actionLabel: "Review packet + preflight",
        supplierId: pixartSupplier?.id,
      });
    } else {
      items.push({
        order: 1,
        tone: "warning",
        priority: "high",
        title: "Find Pixart rigids bankprodukt",
        description: "Rigids gate kan ikke lukkes, før bankproduktet og dets snapshotstatus kan læses.",
        details: ["Pixart rigids blev ikke fundet i de aktive bankprodukter."],
        actionLabel: "Tjek Pixart bankdata",
        supplierId: pixartSupplier?.id,
      });
    }

    items.push({
      order: 2,
      tone: printComOtherMissing ? "warning" : "ready",
      priority: "medium",
      title: "Luk Print.com other med placemats",
      description: printComOtherMissing
        ? "Print.com other mangler stadig i bankdækningen; placemats er den smalle slice, der allerede har lokal preflight."
        : "Print.com other er ikke længere en aktiv coverage gap i den aktuelle bankvisning.",
      details: [
        `Print.com familier i banken: ${formatFamilyLabels(printComCoverage?.stagedFamilies || [])}`,
        `Mangler: ${formatFamilyLabels(printComCoverage?.missingFamilies || [])}`,
        "Næste write kræver eksplicit bank-only godkendelse.",
      ],
      actionLabel: printComOtherMissing ? "Kør placemats preflight" : "Genkør completion audit",
      supplierId: printComSupplier?.id,
    });

    items.push({
      order: 3,
      tone: pixartMissingFamilies.length > 0 ? "warning" : "ready",
      priority: "medium",
      title: "Forbered manglende Pixart familier",
      description: pixartMissingFamilies.length > 0
        ? "Banners, labels, posters og rollups må først blive lokale no-write previews, når profil og eksakt URL er afklaret."
        : "Der er ikke registrerede Pixart-familier tilbage som mangler i denne visning.",
      details: [
        `Mangler: ${formatFamilyLabels(pixartMissingFamilies)}`,
        `URL-kandidater: ${pixartUrlCandidateRows.length} (${confirmedPixartUrlCandidates} bekræftet)`,
        "Profiler for manglende Pixart-familier er planlægning, ikke kørbare imports endnu.",
        "Brug URL-kandidat og readiness rapporter før probe/extract.",
      ],
      actionLabel: "Opdater readiness",
      supplierId: pixartSupplier?.id,
    });

    items.push({
      order: 4,
      tone: importedDraftsAreClean ? "ready" : "blocked",
      priority: importedDraftsAreClean ? "low" : "high",
      title: "Hold importerede drafts rene",
      description: "Importer fra banken skal blive upublicerede drafts, indtil produktadmin har lavet en separat publiceringsbeslutning.",
      details: [
        `${importedDraftQaSummary.ok}/${importedDraftQaSummary.checked} drafts OK`,
        `${importedDraftQaSummary.warnings} advarsler`,
        `${importedDraftQaSummary.errors} fejl`,
        `${importedDraftQaSummary.published} publicerede targets`,
      ],
      actionLabel: "Gennemgå draft QA",
    });

    items.push({
      order: 5,
      tone: importEligibilitySummary.blocked === 0 && pixartMissingFamilies.length === 0 && !printComOtherMissing ? "ready" : "info",
      priority: "medium",
      title: "Genbevis completion efter gate-ændringer",
      description: "Supplier-bank goal er først færdigt, når completion audit beviser alle krav, ikke bare når en enkelt preflight er grøn.",
      details: [
        `${importEligibilitySummary.ready} klar / ${importEligibilitySummary.blocked} blokeret`,
        `${products.length} aktive bankprodukter`,
        `${suppliers.length} leverandører i visningen`,
      ],
      actionLabel: "Kør status + completion audit",
    });

    return items;
  }, [
    coverageBySupplierId,
    importEligibilitySummary,
    importedDraftQaSummary,
    latestDeltaReviewByProductId,
    latestImportedJobByProductId,
    pixartUrlCandidateRows,
    products,
    snapshotStatsByProductId,
    suppliers,
  ]);
  const approvalCandidateItems = useMemo(() => {
    const items: ApprovalCandidateItem[] = [];
    const pixartSupplier = suppliers.find((supplier) => supplier.slug === "pixartprinting");
    const printComSupplier = suppliers.find((supplier) => supplier.slug === "print-com");
    const pixartRigidsProduct = products.find((product) => product.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY);
    const printComCoverage = printComSupplier ? coverageBySupplierId.get(printComSupplier.id) : undefined;
    const printComOtherMissing = Boolean(printComCoverage?.missingFamilies.includes("other" as SupplierBankProductFamily));

    if (pixartRigidsProduct || pixartSupplier) {
      const snapshotStats = pixartRigidsProduct
        ? snapshotStatsByProductId[pixartRigidsProduct.id] || getEmptySnapshotStats()
        : getEmptySnapshotStats();
      const deltaReview = pixartRigidsProduct ? latestDeltaReviewByProductId.get(pixartRigidsProduct.id) : undefined;
      const blockReason = pixartRigidsProduct
        ? getImportBlockReason(pixartRigidsProduct, deltaReview, snapshotStats)
        : "Pixart rigids bankproduktet blev ikke fundet i den aktive visning.";

      items.push({
        priority: "high",
        tone: "blocked",
        title: "Pixart pladematerialer",
        supplierName: pixartSupplier?.name || "Pixartprinting",
        familyLabel: "Skilte",
        statusLabel: "Afventer bank-only beslutning",
        description: "Plastic+Plexiglass-kandidaten er klar som beslutningspunkt, men må ikke skrives til banken uden eksplicit godkendelse.",
        evidence: [
          pixartRigidsProduct ? `Bankprodukt: ${pixartRigidsProduct.name_da}` : "Bankprodukt: mangler i visningen",
          `Snapshots i aktiv bankvisning: ${snapshotStats.count}`,
          deltaReview ? `Prisreview: ${getDeltaReviewStatusLabel(deltaReview.status)}` : "Prisreview: ikke klar eller ikke relevant endnu",
          blockReason || "Klar til bank-only approval-gate",
        ],
        proofTrail: [
          {
            label: "Kandidat JSON",
            value: "pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json",
          },
          {
            label: "Baseline JSON",
            value: "pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json",
          },
          {
            label: "Decision packet",
            value: "docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-075836.md",
          },
          {
            label: "No-write preflight",
            value: "docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md",
          },
          {
            label: "Storformat review",
            value: "docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-075859.md",
          },
        ],
        approvalNote: "Godkendelse vil kun være til supplier-bank snapshot/delta-review, ikke Webprinter produkt, publicering eller live priser.",
        approveImpact: "Næste gate bliver bank-only snapshot + draft delta-review for Plastic+Plexiglass.",
        deferImpact: "Pixart signs bliver stående på Plastic-only baseline, og completion audit bliver ved med at have en high-priority åben beslutning.",
        guardrails: [
          "No-write preflight findes",
          "Bank-write kræver eksplicit approval",
          "Matrix-import er blokeret",
        ],
        decisionChecklist: [
          "Review preflight og packet for Plastic+Plexiglass-kandidaten.",
          "Beslut kun om bank-only snapshot/delta-review må køres.",
          "Bekræft at dette ikke er Webprinter draft-import, publicering eller live pricing.",
        ],
        approvalPhrase: "Jeg godkender kun bank-only write for Pixart rigids Plastic+Plexiglass snapshot og draft delta-review. Ingen Webprinter draft, publicering eller live priser.",
        deferPhrase: "Jeg afventer Pixart rigids bank-only write. Behold Plastic-only baseline, og kør ingen bank write, draft-import, publicering eller live priser.",
        safeCheckCommand: "npm run supplier-bank:pixart-rigids-bank-write-preflight",
        supplierId: pixartSupplier?.id,
      });
    }

    if (printComSupplier || printComOtherMissing) {
      items.push({
        priority: "medium",
        tone: printComOtherMissing ? "warning" : "ready",
        title: "Print.com placemats",
        supplierName: printComSupplier?.name || "Print.com",
        familyLabel: "Andet",
        statusLabel: printComOtherMissing ? "Klar til small-slice approval" : "Dækning findes i banken",
        description: printComOtherMissing
          ? "Placemats er den smalle Print.com `other` kandidat, der kan lukke den manglende familie efter eksplicit bank-only godkendelse."
          : "Print.com `other` er ikke længere markeret som manglende i den aktive coverage-visning.",
        evidence: [
          `I banken: ${formatFamilyLabels(printComCoverage?.stagedFamilies || [])}`,
          `Mangler: ${formatFamilyLabels(printComCoverage?.missingFamilies || [])}`,
          "Seneste lokale placemats-preflight er et no-write bevispunkt, ikke en automatisk import.",
        ],
        proofTrail: [
          {
            label: "Catalog preview",
            value: "pricing_raw/supplier-bank-normalized/print-com/other/20260703-131707.json",
          },
          {
            label: "Price preview",
            value: "pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-131715.json",
          },
          {
            label: "No-write preflight",
            value: "docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md",
          },
          {
            label: "Coverage plan",
            value: "docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST.md",
          },
          {
            label: "Decision queue",
            value: "docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md",
          },
        ],
        approvalNote: "Godkendelse må kun skrive supplier-bank snapshot. Ingen POD v2 rows, produkter, publicering eller live priser.",
        approveImpact: "Print.com `other` kan lukkes som bank-only placemats snapshot efter den godkendte preflight.",
        deferImpact: "Print.com `other` bliver ved med at tælle som manglende coverage, men ingen produktdata ændres.",
        guardrails: [
          "No-write preflight findes",
          "Bank-write kræver eksplicit approval",
          "POD v2 og live priser røres ikke",
        ],
        decisionChecklist: [
          "Review placemats preflight og local price preview.",
          "Beslut kun om Print.com other må lukkes som bank-only placemats snapshot.",
          "Bekræft at POD v2, produktimport, publicering og live priser ikke indgår.",
        ],
        approvalPhrase: "Jeg godkender kun bank-only write for Print.com placemats snapshot for other. Ingen POD v2, produktimport, publicering eller live priser.",
        deferPhrase: "Jeg afventer Print.com placemats bank-only write. Behold placemats som lokal preview, og kør ingen bank write, POD v2, produktimport, publicering eller live priser.",
        safeCheckCommand: "npm run supplier-bank:print-com-placemats-bank-write-preflight",
        supplierId: printComSupplier?.id,
      });
    }

    return items;
  }, [
    coverageBySupplierId,
    latestDeltaReviewByProductId,
    products,
    snapshotStatsByProductId,
    suppliers,
  ]);
  const coverageGapItems = useMemo(() => {
    return suppliers
      .flatMap((supplier) => {
        const coverage = coverageBySupplierId.get(supplier.id);
        if (!coverage) return [];
        return coverage.missingFamilies.map((family) => (
          getCoverageGapItem(supplier, family, getSupplierFamilyUrlCandidates(supplier, family))
        ));
      })
      .sort((left, right) => {
        const toneRank = { blocked: 0, warning: 1, info: 2, ready: 3 } as Record<ProductNextAction["tone"], number>;
        const toneDelta = toneRank[left.tone] - toneRank[right.tone];
        if (toneDelta !== 0) return toneDelta;
        const supplierDelta = left.supplierName.localeCompare(right.supplierName);
        if (supplierDelta !== 0) return supplierDelta;
        return getSupplierBankProductFamilyLabelDa(left.family).localeCompare(getSupplierBankProductFamilyLabelDa(right.family));
      });
  }, [coverageBySupplierId, suppliers]);
  const gateTypeOverviewItems = useMemo(() => {
    const openApprovalItems = approvalCandidateItems.filter((item) => item.tone !== "ready");
    const engineeringReadinessItems = coverageGapItems.filter((item) => item.supplierSlug === "pixartprinting");
    const localPreviewItems = coverageGapItems.filter((item) => item.supplierSlug !== "pixartprinting");
    const draftQaClean = importedDraftQaSummary.checked > 0
      && importedDraftQaSummary.errors === 0
      && importedDraftQaSummary.warnings === 0
      && importedDraftQaSummary.published === 0;
    const completionOpen = coverageTotals.missing > 0
      || openApprovalItems.length > 0
      || importedDraftQaSummary.errors > 0
      || importedDraftQaSummary.published > 0;

    return [
      {
        key: "business-approval",
        tone: openApprovalItems.length > 0 ? "warning" : "ready",
        title: "Business approval",
        statusLabel: openApprovalItems.length > 0 ? `${openApprovalItems.length} gate(s)` : "klar",
        description: openApprovalItems.length > 0
          ? "Kræver eksplicit approve eller afvent-beslutning. UI viser kun teksten og kører ingen writes."
          : "Ingen synlige approval-gates i den aktuelle bankvisning.",
        items: openApprovalItems.length > 0
          ? openApprovalItems.map((item) => `${item.title}: ${item.statusLabel}`)
          : ["Ingen approval-gates i visningen."],
      },
      {
        key: "engineering-readiness",
        tone: engineeringReadinessItems.length > 0 ? "blocked" : "ready",
        title: "Engineering readiness",
        statusLabel: engineeringReadinessItems.length > 0 ? `${engineeringReadinessItems.length} familie(r)` : "klar",
        description: engineeringReadinessItems.length > 0
          ? "Pixart-familier må ikke probes, før profil og eksakt produkt-URL er klar."
          : "Ingen Pixart readiness-blockers i den aktuelle coverage-visning.",
        items: engineeringReadinessItems.length > 0
          ? engineeringReadinessItems.map((item) => {
            const gateSummary = item.pixartReadinessGates
              ?.map((gate) => `${gate.label} ${gate.detail}`)
              .join(", ");
            const profileLabel = item.pixartProfile ? `profile ${item.pixartProfile}` : "profile mangler";
            return `${getSupplierBankProductFamilyLabelDa(item.family)} (${profileLabel}): ${gateSummary || item.blocker}`;
          })
          : ["Ingen Pixart readiness-blockers i visningen."],
      },
      {
        key: "local-preview",
        tone: localPreviewItems.length > 0 ? "warning" : "ready",
        title: "Local preview",
        statusLabel: localPreviewItems.length > 0 ? `${localPreviewItems.length} gap(s)` : "clear",
        description: localPreviewItems.length > 0
          ? "Disse kan kun flyttes via lokal/no-write preview eller preflight før bank-write approval."
          : "Ingen ekstra local-preview gaps udenfor approval/readiness.",
        items: localPreviewItems.length > 0
          ? localPreviewItems.map((item) => `${item.supplierName} / ${getSupplierBankProductFamilyLabelDa(item.family)}: ${item.nextStep}`)
          : ["Ingen local-preview gaps i visningen."],
      },
      {
        key: "draft-qa",
        tone: draftQaClean ? "ready" : importedDraftQaSummary.errors > 0 || importedDraftQaSummary.published > 0 ? "blocked" : "warning",
        title: "Draft QA",
        statusLabel: draftQaClean ? "ren" : "kræver check",
        description: "Importerede supplier-bank produkter skal blive upublicerede drafts indtil separat produktadmin-beslutning.",
        items: [
          `${importedDraftQaSummary.ok}/${importedDraftQaSummary.checked} OK`,
          `${importedDraftQaSummary.warnings} advarsler`,
          `${importedDraftQaSummary.errors} fejl`,
          `${importedDraftQaSummary.published} publicerede targets`,
        ],
      },
      {
        key: "completion-proof",
        tone: completionOpen ? "info" : "ready",
        title: "Completion proof",
        statusLabel: completionOpen ? "ikke bevist" : "klar til audit",
        description: "Goal kan kun lukkes, når completion audit beviser alle krav uden åbne gates.",
        items: completionOpen
          ? [
              `${coverageTotals.missing} manglende familie(r)`,
              `${openApprovalItems.length} approval-gate(s)`,
              `${importedDraftQaSummary.errors} draft-fejl`,
              `${importedDraftQaSummary.published} publicerede targets`,
            ]
          : ["Alle synlige gates er lukket; kør completion audit for proof."],
      },
    ] satisfies GateTypeOverviewItem[];
  }, [approvalCandidateItems, coverageGapItems, coverageTotals, importedDraftQaSummary]);
  const goalStatusItems = useMemo(() => {
    const draftQaClean = importedDraftQaSummary.checked > 0
      && importedDraftQaSummary.errors === 0
      && importedDraftQaSummary.warnings === 0
      && importedDraftQaSummary.published === 0;
    const highPriorityApprovals = approvalCandidateItems.filter((item) => item.priority === "high");
    const openApprovalCount = approvalCandidateItems.filter((item) => item.tone !== "ready").length;
    const openGateCount = openApprovalCount + coverageGapItems.length;

    return [
      {
        key: "coverage",
        tone: coverageTotals.missing === 0 ? "ready" as const : "warning" as const,
        label: "Familiedækning",
        value: `${coverageTotals.staged}/${coverageTotals.expected}`,
        description: coverageTotals.missing === 0
          ? "Alle registrerede supplier-familier er repræsenteret i banken."
          : `${coverageTotals.missing} registrerede familier mangler stadig lokal preview eller bank-snapshot.`,
      },
      {
        key: "draft-qa",
        tone: draftQaClean ? "ready" as const : importedDraftQaSummary.errors > 0 ? "blocked" as const : "warning" as const,
        label: "Importerede drafts",
        value: `${importedDraftQaSummary.ok}/${importedDraftQaSummary.checked}`,
        description: draftQaClean
          ? "Importerede supplier-bank drafts er upublicerede og QA-rene i den seneste browserkontrol."
          : `${importedDraftQaSummary.errors} fejl, ${importedDraftQaSummary.warnings} advarsler, ${importedDraftQaSummary.published} publicerede targets.`,
      },
      {
        key: "gates",
        tone: openGateCount === 0 ? "ready" as const : "warning" as const,
        label: "Åbne gates",
        value: String(openGateCount),
        description: openGateCount === 0
          ? "Ingen approval- eller coverage-gates er synlige i den aktuelle bankvisning."
          : `${openApprovalCount} approval-gate(s) og ${coverageGapItems.length} coverage-gap(s) holder goal åbent.`,
      },
      {
        key: "high-priority",
        tone: highPriorityApprovals.length === 0 ? "ready" as const : "blocked" as const,
        label: "Hoj prioritet",
        value: String(highPriorityApprovals.length),
        description: highPriorityApprovals.length === 0
          ? "Ingen high-priority approval-gate er synlig."
          : "Pixart rigids/signs bank-only beslutningen er stadig hovedporten.",
      },
    ];
  }, [approvalCandidateItems, coverageGapItems.length, coverageTotals, importedDraftQaSummary]);
  const goalSafeCheckCommands = useMemo(() => {
    const commands = [
      "npm run supplier-bank:review-source-coverage",
      "npm run supplier-bank:review-imported-drafts",
      "npm run supplier-bank:completion-audit",
    ];

    if (approvalCandidateItems.some((item) => item.priority === "high")) {
      commands.push("npm run supplier-bank:pixart-rigids-bank-write-preflight");
    }

    if (coverageGapItems.length > 0) {
      commands.push("npm run supplier-bank:coverage-gap-plan");
    }

    if (coverageGapItems.some((item) => item.supplierSlug === "pixartprinting")) {
      commands.push("npm run supplier-bank:url-confirmation-checklist:write -- --supplier pixartprinting");
    }

    commands.push("npm run supplier-bank:report-index:write");

    return commands;
  }, [approvalCandidateItems, coverageGapItems]);
  const nextExpansionItems = useMemo(() => {
    const items = suppliers.map((supplier) => {
      const coverage = coverageBySupplierId.get(supplier.id) || {
        expectedFamilies: [],
        stagedFamilies: [],
        missingFamilies: [],
        productCount: 0,
      };
      const readiness = readinessBySupplierId.get(supplier.id) || { ready: 0, blocked: 0, imported: 0 };
      const coverageAction = getSupplierCoverageAction({ coverage, readiness, supplier });
      const firstMissingFamily = coverage.missingFamilies[0];
      const title = readiness.blocked > 0
        ? `${supplier.name}: afklar blokeret produkt`
        : firstMissingFamily
          ? `${supplier.name}: ${getSupplierBankProductFamilyLabelDa(firstMissingFamily)}`
          : `${supplier.name}: produktkontrol`;

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        tone: coverageAction.tone,
        title,
        description: coverageAction.description,
        missingFamilies: coverage.missingFamilies,
        stagedFamilies: coverage.stagedFamilies,
        readiness,
      } satisfies NextExpansionItem;
    })
      .filter((item) => item.missingFamilies.length > 0 || item.readiness.blocked > 0 || item.readiness.ready > 0)
      .sort((left, right) => {
        const rankDelta = getSupplierExpansionRank(left) - getSupplierExpansionRank(right);
        if (rankDelta !== 0) return rankDelta;
        const missingDelta = right.missingFamilies.length - left.missingFamilies.length;
        if (missingDelta !== 0) return missingDelta;
        return left.supplierName.localeCompare(right.supplierName);
      });

    return items.slice(0, 4);
  }, [coverageBySupplierId, readinessBySupplierId, suppliers]);
  const previewImportedJob = previewProduct
    ? getImportedJobForSelection(importJobs, previewProduct.id, previewSelection)
    : undefined;
  const previewImportedProductSlug = getImportedProductSlug(previewImportedJob);
  const previewDeltaReview = previewProduct ? latestDeltaReviewByProductId.get(previewProduct.id) : undefined;
  const previewSnapshotStats = previewProduct ? snapshotStatsByProductId[previewProduct.id] : undefined;
  const previewImportBlockReason = previewProduct
    ? getImportBlockReason(previewProduct, previewDeltaReview, previewSnapshotStats)
    : null;
  const previewMatrixUnsupportedReason = previewProduct
    ? getMatrixDraftImportUnsupportedReason(previewProduct)
    : null;
  const previewSafeActionSummary = previewProduct
    ? getProductSafeActionSummary({
      product: previewProduct,
      supplier: supplierById.get(previewProduct.supplier_id),
      importedProductSlug: previewImportedProductSlug,
      importBlockReason: previewImportBlockReason,
    })
    : null;
  const previewPricingSummary = previewProduct
    ? resolveProductPricingSummary(previewProduct, snapshotStatsByProductId[previewProduct.id])
    : null;
  const previewPricingHasData = previewPricingSummary
    ? previewPricingSummary.rows > 0
      || previewPricingSummary.quantityMin != null
      || previewPricingSummary.quantityMax != null
      || previewPricingSummary.priceMinDkk != null
      || previewPricingSummary.priceMaxDkk != null
      || !!previewSnapshot
    : false;
  const linkPreviewSnapshotStats = linkPreview
    ? snapshotStatsByProductId[linkPreview.bankProduct.id]
    : undefined;
  const linkPreviewPricingSummary = linkPreview
    ? resolveProductPricingSummary(linkPreview.bankProduct, linkPreviewSnapshotStats)
    : null;
  const linkPreviewSupplier = linkPreview
    ? supplierById.get(linkPreview.bankProduct.supplier_id)
    : undefined;
  const previewSelectionActive = hasSelectionFilter(previewSelection);
  const previewSelectionSuffix = previewProduct ? getSelectionSuffix(previewProduct.normalized_attributes, previewSelection) : "";
  const previewDraftImportBlockReason = previewDraftImport?.conversionGate?.allowed === false
    ? previewDraftImport.conversionGate.reason || "Den valgte variant kan ikke konverteres til Matrix Layout."
    : previewDraftImport?.priceReview?.allowed === false
      ? previewDraftImport.priceReview.reason || "Prisreview blokerer import."
      : null;

  useEffect(() => {
    if (!previewProduct) return;
    loadDraftImportPreview(previewProduct, previewSelection);
  }, [previewProduct, previewSelection]);

  async function loadDraftImportPreview(product: BankProductRow, selection: Record<string, string>) {
    setPreviewDraftImportLoading(true);
    const identity = getDraftImportIdentity(product, selection);
    const rowFilter = getSelectionFilter(selection);
    const { data, error: invokeError } = await supabase.functions.invoke("supplier-bank-import-draft", {
      body: {
        bankProductId: product.id,
        targetTenantId: MASTER_TENANT_ID,
        productName: identity.productName,
        productSlug: identity.productSlug,
        rowFilter,
        dryRun: true,
      },
    });

    if (invokeError || (data as any)?.error) {
      setPreviewDraftImport({
        rowFilter,
        rowFilterActive: hasSelectionFilter(selection),
        conversionGate: {
          allowed: false,
          reason: invokeError?.message || (data as any)?.error || "Draft-preview kunne ikke beregnes.",
        },
      });
    } else {
      setPreviewDraftImport((data || null) as DraftImportPreview | null);
    }

    setPreviewDraftImportLoading(false);
  }

  async function createPriceDeltaReview(product: BankProductRow) {
    const snapshotStats = snapshotStatsByProductId[product.id] || getEmptySnapshotStats();
    if (snapshotStats.count < 2) {
      toast({
        title: "Prisreview kan ikke oprettes endnu",
        description: "Der skal være mindst to gemte pris-snapshots for dette bankprodukt.",
        variant: "destructive",
      });
      return;
    }

    setCreatingDeltaReviewProductId(product.id);
    const { data, error: invokeError } = await supabase.functions.invoke("supplier-bank-create-delta-review", {
      body: {
        bankProductId: product.id,
        thresholdPct: 0,
        notes: "Manual admin price-delta review",
      },
    });

    if (invokeError || (data as any)?.error) {
      toast({
        title: "Prisreview blev ikke oprettet",
        description: invokeError?.message || (data as any)?.error || "Kunne ikke sammenligne de seneste snapshots.",
        variant: "destructive",
      });
    } else {
      const review = (data as any)?.review as DeltaReviewRow | undefined;
      if (review?.id) {
        setDeltaReviews((currentReviews) => [review, ...currentReviews.filter((item) => item.id !== review.id)].slice(0, 100));
      }
      toast({
        title: "Prisreview oprettet",
        description: "De seneste to supplier-bank snapshots er sammenlignet som et draft review.",
      });
    }

    setCreatingDeltaReviewProductId(null);
  }

  async function updateDeltaReviewStatus(review: DeltaReviewRow, nextStatus: DeltaReviewStatus) {
    const allowed = getNextDeltaReviewStatuses(review.status).some((item) => item.status === nextStatus);
    if (!allowed) return;

    setUpdatingDeltaReviewId(review.id);
    const { error: updateError } = await (supabase.from("supplier_bank_price_delta_reviews" as any) as any)
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", review.id);

    if (updateError) {
      toast({
        title: "Prisreview blev ikke opdateret",
        description: updateError.message || "Status kunne ikke gemmes.",
        variant: "destructive",
      });
    } else {
      setDeltaReviews((currentReviews) =>
        currentReviews.map((item) => item.id === review.id ? { ...item, status: nextStatus } : item)
      );
      toast({
        title: "Prisreview opdateret",
        description: `Review er nu ${getDeltaReviewStatusLabel(nextStatus)}.`,
      });
    }

    setUpdatingDeltaReviewId(null);
  }

  async function queueRefreshJob(product: BankProductRow) {
    const latestJob = latestRefreshJobByProductId.get(product.id);
    if (latestJob && ["queued", "running"].includes(latestJob.status)) {
      toast({
        title: "Refresh ligger allerede i kø",
        description: "Afvent den eksisterende refresh-forespørgsel før der oprettes en ny.",
      });
      return;
    }

    const supplier = supplierById.get(product.supplier_id);
    setQueueingRefreshProductId(product.id);

    const { data, error: insertError } = await (supabase.from("supplier_bank_refresh_jobs" as any) as any)
      .insert({
        supplier_id: product.supplier_id,
        bank_product_id: product.id,
        mode: "price_refresh",
        tool: getRefreshTool(supplier?.integration_type),
        status: "queued",
        priority: 100,
        request_summary: {
          supplierSlug: supplier?.slug || null,
          supplierProductKey: product.supplier_product_key || null,
          productName: product.name_da || product.name_original,
          requestedFrom: "admin_supplier_bank",
          note: "Queue only. Worker/CLI must create supplier-bank snapshots and delta reviews; no live pricing writes.",
        },
      })
      .select("id,supplier_id,bank_product_id,mode,tool,status,request_summary,result_summary,error,queued_at,started_at,finished_at")
      .single();

    if (insertError) {
      toast({
        title: "Refresh kunne ikke lægges i kø",
        description: insertError.message || "Supplier-bank refresh blev ikke oprettet.",
        variant: "destructive",
      });
    } else {
      setRefreshJobs((currentJobs) => [data as RefreshJobRow, ...currentJobs].slice(0, 100));
      toast({
        title: "Refresh lagt i kø",
        description: "Der er oprettet en supplier-bank refresh-forespørgsel. Den ændrer ikke priser eller produkter før en worker/CLI behandler den.",
      });
    }

    setQueueingRefreshProductId(null);
  }

  async function openDryRunPreview(product: BankProductRow) {
    setPreviewProduct(product);
    setPreviewSnapshot(null);
    setPreviewSelection({});
    setPreviewDraftImport(null);
    setPreviewLoading(true);

    const { data, error: snapshotError } = await (supabase.from("supplier_bank_price_snapshots" as any) as any)
      .select("id,currency,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
      .eq("bank_product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      toast({
        title: "Preview kunne ikke indlæses",
        description: snapshotError.message || "Pris-snapshot kunne ikke hentes.",
        variant: "destructive",
      });
    } else {
      setPreviewSnapshot((data || null) as PriceSnapshotPreview | null);
    }

    setPreviewLoading(false);
  }

  function openSupplierCatalog(supplierId: string) {
    setActiveSupplierId(supplierId);
    setFamilyFilter("all");
    setBankStatusFilter("all");
    setReadinessFilter("all");
    setSearch("");
    window.requestAnimationFrame(() => {
      document.getElementById("supplier-product-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function importProductAsDraft(product: BankProductRow, selection: Record<string, string> = {}) {
    const deltaReview = latestDeltaReviewByProductId.get(product.id);
    const snapshotStats = snapshotStatsByProductId[product.id];
    const importBlockReason = getImportBlockReason(product, deltaReview, snapshotStats);

    if (importBlockReason) {
      toast({
        title: "Produktet kan ikke importeres",
        description: importBlockReason,
        variant: "destructive",
      });
      return;
    }

    const { productName, productSlug } = getDraftImportIdentity(product, selection);
    const rowFilter = getSelectionFilter(selection);

    setImportingDraft(true);
    let approvedProduct = product;

    if (product.status !== "approved") {
      const { error: approveError } = await (supabase.from("supplier_bank_products" as any) as any)
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (approveError) {
        toast({
          title: "Produktet kunne ikke importeres",
          description: approveError.message || "Produktet kunne ikke gøres klar til import.",
          variant: "destructive",
        });
        setImportingDraft(false);
        return;
      }

      approvedProduct = { ...product, status: "approved" };
      setProducts((currentProducts) =>
        currentProducts.map((item) => item.id === product.id ? approvedProduct : item)
      );
    }

    const { data, error: invokeError } = await supabase.functions.invoke("supplier-bank-import-draft", {
      body: {
        bankProductId: approvedProduct.id,
        targetTenantId: MASTER_TENANT_ID,
        productName,
        productSlug,
        rowFilter,
        dryRun: false,
      },
    });

    if (invokeError || (data as any)?.error) {
      toast({
        title: "Draft import blev ikke oprettet",
        description: invokeError?.message || (data as any)?.error || "Supplier bank import kunne ikke gennemføres.",
        variant: "destructive",
      });
    } else {
      const result = (data || {}) as any;
      if (result.importJobId) {
        setImportJobs((currentJobs) => [{
          id: result.importJobId,
          bank_product_id: approvedProduct.id,
          target_tenant_id: MASTER_TENANT_ID,
          target_product_id: result.productId || null,
          import_mode: result.importMode || "matrix_layout_v1",
          status: "imported",
          import_summary: {
            rowsInserted: result.rowsInserted,
            rowsPrepared: result.rowsPrepared,
            productSlug: result.productSlug,
            rowFilter,
            rowFilterActive: hasSelectionFilter(selection),
          },
          rollback_note: "Created as unpublished draft product from supplier bank.",
          created_at: new Date().toISOString(),
        }, ...currentJobs].slice(0, 8));
      }
      toast({
        title: "Produkt importeret",
        description: `${productName} ligger nu klar som upubliceret Webprinter-produkt.`,
      });
    }

    setImportingDraft(false);
  }

  async function importPreviewProductAsDraft() {
    if (!previewProduct) return;
    await importProductAsDraft(previewProduct, previewSelection);
    setPreviewProduct(null);
  }

  async function repairImportedDraftPrices(job: ImportJobRow, options?: { silent?: boolean }) {
    const { silent = false } = options || {};
    if (!job.target_product_id || !job.bank_product_id) {
      if (!silent) {
        toast({
          title: "Kan ikke reparere draft",
          description: "Importjob mangler target produkt id.",
          variant: "destructive",
        });
      }
      return false;
    }

    const bankProduct = products.find((product) => product.id === job.bank_product_id);
    const importedTargetProduct = importedTargetProductsById[job.target_product_id];
    if (!bankProduct) {
      if (!silent) {
        toast({
          title: "Kan ikke reparere draft",
          description: "Bankproduktet blev ikke fundet i den nuværende visning.",
          variant: "destructive",
        });
      }
      return false;
    }

    const rowFilter = getImportJobRowFilter(job);
    const identity = getDraftImportIdentity(bankProduct, rowFilter);
    setRepairingImportJobId(job.id);
    const { data, error: invokeError } = await supabase.functions.invoke("supplier-bank-import-draft", {
      body: {
        bankProductId: bankProduct.id,
        targetTenantId: job.target_tenant_id || MASTER_TENANT_ID,
        productName: importedTargetProduct?.name || identity.productName,
        productSlug: importedTargetProduct?.slug || identity.productSlug,
        rowFilter,
        repairProductId: job.target_product_id,
        repairImportJobId: job.id,
        dryRun: false,
      },
    });

    if (invokeError || (data as any)?.error) {
      if (!silent) {
        toast({
          title: "Reparation af draft slog fejl",
          description: invokeError?.message || (data as any)?.error || "Kunne ikke reparere matrix-prisrækker.",
          variant: "destructive",
        });
      }
      setRepairingImportJobId(null);
      return false;
    }

    const result = (data || {}) as any;
    const rowsInserted = typeof result.rowsInserted === "number"
      ? result.rowsInserted
      : Number(result.rowsInserted);
    const normalizedRowsInserted = Number.isFinite(rowsInserted) ? rowsInserted : null;

    setImportJobs((currentJobs) => currentJobs.map((currentJob) => (
      currentJob.id === job.id
        ? {
          ...currentJob,
          import_summary: {
            ...(typeof currentJob.import_summary === "object" && currentJob.import_summary !== null ? currentJob.import_summary : {}),
            rowsInserted: normalizedRowsInserted ?? getSummaryNumber((currentJob.import_summary as any) || {}, "rowsInserted"),
            rowFilter,
          },
        }
        : currentJob
    )));

    if (job.target_product_id && normalizedRowsInserted != null) {
      setImportedTargetRowCountsById((currentCounts) => ({
        ...currentCounts,
        [job.target_product_id]: {
          ...currentCounts[job.target_product_id],
          genericPrices: normalizedRowsInserted,
        },
      }));
    }

    setRepairingImportJobId(null);
    if (!silent) {
      toast({
        title: "Draft repareret",
        description: `Matrix-prisrækker for ${importedTargetProduct?.name || bankProduct.name_da} er nu ${formatNumber(normalizedRowsInserted)}.`,
      });
    }
    return true;
  }

  async function repairAllMatrixDraftImports() {
    if (matrixRepairJobs.length === 0 || repairingAllJobs) return;
    setRepairingAllJobs(true);
    let repaired = 0;
    let failed = 0;

    for (const job of matrixRepairJobs) {
      const repairedJob = await repairImportedDraftPrices(job, { silent: true });
      if (repairedJob) repaired += 1;
      else failed += 1;
    }

    setRepairingAllJobs(false);
    setRepairingImportJobId(null);

    toast({
      title: "Batch-reparation gennemført",
      description: `${repaired} produkter repareret, ${failed} fejl.`,
    });
  }

  function clearProductFilters() {
    setSearch("");
    setFamilyFilter("all");
    setBankStatusFilter("all");
    setReadinessFilter("all");
  }

  function adminPathWithCurrentContext(path: string) {
    const forceDomain = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("force_domain")
      : null;
    if (!forceDomain || !path.startsWith("/admin") || path.includes("?")) return path;
    return `${path}?force_domain=${encodeURIComponent(forceDomain)}`;
  }

  const bankReadSourceLabel: Record<BankReadSource, string> = {
    none: "ikke startet",
    secure_admin_endpoint: "sikkert admin-endpoint",
    direct_rls: "direkte database/RLS",
  };
  const bankDataIsNotVisible = !loading && suppliers.length === 0 && products.length === 0;

  if (roleLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supplier Product Bank</CardTitle>
          <CardDescription>Indlæser adgang og supplier-bank data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supplier Product Bank</CardTitle>
          <CardDescription>Kun admin/master-admin kan se og administrere leverandørbanken.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <Badge variant="outline">Produktbank</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Leverandør katalog</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Vælg en leverandør, find et produkt, og importer det som et upubliceret Webprinter-produkt.
          </p>
          {!isMasterAdmin ? (
            <p className="mt-2 text-sm text-amber-700">
              Admin-konteksten er aktiv. Databasen håndhæver stadig master-admin adgang via RLS.
            </p>
          ) : null}
        </div>
      </div>

      {(bankDataIsNotVisible || bankReadDiagnostic) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold">
                  {bankDataIsNotVisible
                    ? "Bankdata er ikke synlig i denne browsersession"
                    : "Supplier Bank læser via fallback"}
                </p>
                <p className="mt-1 text-sm">
                  Datakilde: {bankReadSourceLabel[bankReadSource]}.{" "}
                  {bankReadDiagnostic || "Ingen fejlbesked fra databasen."}
                </p>
                {bankDataIsNotVisible ? (
                  <p className="mt-2 text-sm">
                    Banken er ikke nødvendigvis tom. Prøv central admin uden tenant-parameter, eller log ind igen som admin@webprinter.dk.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/admin/supplier-bank">Åbn central admin</a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Genindlæs
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Leverandører</CardDescription>
            <CardTitle>{suppliers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bank produkter</CardDescription>
            <CardTitle>{products.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Importerede drafts</CardDescription>
            <CardTitle>{importedJobCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Importstatus</CardDescription>
            <CardTitle>
              {importEligibilitySummary.ready}/{importEligibilitySummary.blocked}
            </CardTitle>
            <p className="text-xs text-muted-foreground">klar / blokeret</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft QA</CardDescription>
            <CardTitle>
              {importedDraftQaSummary.ok}/{importedDraftQaSummary.checked}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              OK · {importedDraftQaSummary.warnings} advarsler · {importedDraftQaSummary.errors} fejl
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Refresh i kø</CardDescription>
            <CardTitle>{activeRefreshJobCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {!error && importedDraftQaSummary.checked > 0 && (importedDraftQaSummary.errors > 0 || importedDraftQaSummary.published > 0 || importedDraftQaSummary.warnings > 0) ? (
        <div className={`rounded-md border p-4 text-sm ${
          importedDraftQaSummary.errors > 0 || importedDraftQaSummary.published > 0
            ? "border-destructive/25 bg-destructive/10 text-destructive"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Importerede supplier-bank drafts kræver kontrol</p>
                <p className="mt-1">
                  {formatNumber(importedDraftQaSummary.checked)} importerede drafts er kontrolleret:
                  {" "}{formatNumber(importedDraftQaSummary.ok)} OK,
                  {" "}{formatNumber(importedDraftQaSummary.warnings)} advarsler,
                  {" "}{formatNumber(importedDraftQaSummary.errors)} fejl.
                  {importedDraftQaSummary.published > 0
                    ? ` ${formatNumber(importedDraftQaSummary.published)} target produkt er publiceret og skal gennemgås manuelt.`
                    : ""}
                </p>
                {publishedImportedTargets.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {publishedImportedTargets.slice(0, 3).map((item) => (
                      <Button key={item.job.id} asChild size="sm" variant="outline">
                        <a href={adminPathWithCurrentContext(`/admin/product/${item.targetProduct.slug}`)}>
                          Åbn {item.targetProduct.name}
                        </a>
                      </Button>
                    ))}
                    {publishedImportedTargets.length > 3 ? (
                      <Badge variant="outline">
                        +{publishedImportedTargets.length - 3} flere
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <p className="mt-2 text-xs opacity-80">
                  Denne advarsel ændrer ikke produkter. Publicering skal håndteres bevidst i produktadmin.
                </p>
              </div>
            </div>
            <Badge variant={importedDraftQaSummary.errors > 0 || importedDraftQaSummary.published > 0 ? "destructive" : "secondary"}>
              Draft QA
            </Badge>
          </div>
        </div>
      ) : null}

      <section className="space-y-5 rounded-md border bg-background p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Vælg produkt</h2>
            <p className="text-sm text-muted-foreground">
              Produktgruppe, trykkeri, produkt, og så papir/sider/fold i previewet.
            </p>
          </div>
          <Badge variant="outline">{products.length} produkter i banken</Badge>
        </div>

        {bankDataIsNotVisible ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <p className="font-semibold">Leverandørbanken har data, men denne session læser 0 rækker.</p>
            <p className="mt-2">
              Jeg har verificeret, at banken indeholder trykkerier og produkter. Hvis denne besked bliver stående efter genindlæsning,
              er login-sessionen ikke matchet som master-admin i Supabase.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Genindlæs
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href="/admin/supplier-bank">Åbn central admin</a>
              </Button>
            </div>
          </div>
        ) : (
          <>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Produktgruppe</p>
            {familyFilter !== "all" ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setFamilyFilter("all")}>
                Vis alle
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              <Button
                type="button"
                size="lg"
                variant={familyFilter === "all" ? "default" : "outline"}
                className="h-auto justify-between px-4 py-3"
                onClick={() => setFamilyFilter("all")}
              >
                <span>Alle produkter</span>
                <span className="ml-3 rounded bg-background/20 px-1.5 text-xs">{products.length}</span>
              </Button>
              {simpleFamilyPickerItems.map((item) => (
                <Button
                  key={item.family}
                  type="button"
                  size="lg"
                  variant={familyFilter === item.family ? "default" : "outline"}
                  className="h-auto justify-between px-4 py-3"
                  onClick={() => setFamilyFilter(item.family)}
                >
                  {item.label}
                  <span className="ml-3 rounded bg-background/20 px-1.5 text-xs">{item.productCount}</span>
                </Button>
              ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Trykkeri</p>
          <div className="flex flex-wrap gap-2">
            {productFinderSupplierItems.map((item) => (
              <Button
                key={item.supplierId}
                type="button"
                size="lg"
                variant={activeSupplierId === item.supplierId ? "default" : "outline"}
                className="h-auto px-4 py-3"
                onClick={() => setActiveSupplierId(item.supplierId)}
              >
                <span>{item.name}</span>
                <span className="ml-3 rounded bg-background/20 px-1.5 text-xs">
                  {item.productCount}
                </span>
                {item.readyCount > 0 ? (
                  <span className="ml-2 rounded bg-emerald-500/15 px-1.5 text-xs text-emerald-700">
                    {item.readyCount} klar
                  </span>
                ) : null}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Produkt</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Viser {formatNumber(productSpotlightItems.length)} af {formatNumber(baseFilteredProducts.length)} produkter i valget.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Søg produkt"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Indlæser bankprodukter...</p>
          ) : productSpotlightItems.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm">
              <p className="font-medium">Ingen produkter matcher valget.</p>
              <p className="mt-2 text-muted-foreground">Vælg en anden produktgruppe, et andet trykkeri eller ryd søgningen.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {productSpotlightItems.map((item) => (
                  <button
                    key={item.product.id}
                    type="button"
                    onClick={() => openDryRunPreview(item.product)}
                    className="rounded-md border bg-background px-4 py-3 text-left transition hover:border-primary/50 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.productName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.supplierName}</p>
                      </div>
                      <Badge variant={item.readinessVariant as any}>{item.readinessLabel}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{item.familyLabel}</Badge>
                      <Badge variant="outline">{formatNumber(item.priceRows)} prislinjer</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {item.priceMinDkk != null || item.priceMaxDkk != null
                        ? `${formatNumber(item.priceMinDkk)}-${formatNumber(item.priceMaxDkk)} DKK`
                        : "Prisinterval ikke vist"}
                      {" · "}
                      {formatDate(item.latestUpdatedAt)}
                    </p>
                    {item.attributePreviewRows.length > 0 ? (
                      <div className="mt-3 space-y-2 rounded border bg-muted/30 px-2 py-2">
                        {item.attributePreviewRows.map((row) => (
                          <div key={row.key} className="text-xs">
                            <p className="font-medium">{row.label}</p>
                            <p className="mt-0.5 text-muted-foreground">
                              {row.preview}
                              {row.valueCount > 3 ? ` +${row.valueCount - 3}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs font-medium text-primary">Vælg papir, sider og importer</p>
                  </button>
                ))}
              </div>
              {hiddenSimpleProductCount > 0 ? (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground">
                    {formatNumber(hiddenSimpleProductCount)} flere produkter matcher dette valg.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSimpleProductLimit((current) => current + SIMPLE_PRODUCT_PAGE_SIZE)}
                    >
                      Vis {Math.min(SIMPLE_PRODUCT_PAGE_SIZE, hiddenSimpleProductCount)} flere
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSimpleProductLimit(baseFilteredProducts.length)}
                    >
                      Vis alle
                    </Button>
                  </div>
                </div>
              ) : baseFilteredProducts.length > SIMPLE_PRODUCT_PAGE_SIZE ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSimpleProductLimit(SIMPLE_PRODUCT_PAGE_SIZE)}
                  >
                    Vis færre
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
          </>
        )}
        <div className="flex justify-end border-t pt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAdvancedProductTools((current) => !current)}
          >
            {showAdvancedProductTools ? "Skjul teknisk overblik" : "Vis teknisk overblik"}
          </Button>
        </div>
      </section>

      {showAdvancedProductTools ? (
        <>
      {!error ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Målestatus</CardTitle>
                <CardDescription>
                  Read-only status for supplier-bank goal. Panelet forklarer, hvorfor banken kan bruges, men ikke er komplet endnu.
                </CardDescription>
              </div>
              <Badge variant={coverageTotals.missing === 0 && approvalCandidateItems.length === 0 ? "default" : "secondary"}>
                {coverageTotals.missing === 0 && approvalCandidateItems.length === 0 ? "klar til audit" : "goal åben"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {goalStatusItems.map((item) => (
              <div key={item.key} className={`rounded-md border px-3 py-3 text-sm ${getNextActionClasses(item.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.label}</p>
                  <span className="text-lg font-semibold leading-none">{item.value}</span>
                </div>
                <p className="mt-2 text-xs opacity-80">{item.description}</p>
              </div>
            ))}
          </CardContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium">Gate typer</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Samme inddeling som goal snapshot: approval, readiness, preview, draft QA og final proof.
                  </p>
                </div>
                <Badge variant="outline">{gateTypeOverviewItems.length} typer</Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
                {gateTypeOverviewItems.map((item) => (
                  <div key={item.key} className={`rounded-md border px-3 py-3 text-sm ${getNextActionClasses(item.tone)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium leading-snug">{item.title}</p>
                      <Badge variant={getApprovalStatusVariant(item.tone) as any}>
                        {item.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{item.description}</p>
                    <ul className="mt-3 space-y-1 text-xs opacity-80">
                      {item.items.slice(0, 4).map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium">Næste sikre checks</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plain-text kommandoer til read-only audit/preflight. De køres ikke fra UI.
                  </p>
                </div>
                <Badge variant="outline">{goalSafeCheckCommands.length} checks</Badge>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {goalSafeCheckCommands.map((command) => (
                  <code key={command} className="block break-all rounded border bg-background px-2 py-2 font-mono text-xs">
                    {command}
                  </code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!error ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Bevisfiler
                </CardTitle>
                <CardDescription>
                  Seneste lokale rapporter for de åbne gates. Stierne er dokumentation og starter ingen scrape, bank write, import, publicering eller prisopdatering.
                </CardDescription>
              </div>
              <Badge variant="outline">{SUPPLIER_BANK_PROOF_FILES.length} rapporter</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SUPPLIER_BANK_PROOF_FILES.map((item) => (
              <div key={item.path} className={`rounded-md border px-3 py-3 text-sm ${getNextActionClasses(item.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs opacity-75">{item.gate}</p>
                  </div>
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                </div>
                <p className="mt-2 text-xs opacity-80">{item.description}</p>
                <code className="mt-3 block break-all rounded border bg-background/70 px-2 py-2 font-mono text-[11px]">
                  {item.path}
                </code>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!error && supplierCatalogCards.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Leverandør-menu</CardTitle>
                <CardDescription>
                  Vælg trykkeri og se de produkter, der ligger klar i banken eller afventer en beslutning.
                </CardDescription>
              </div>
              <Badge variant="outline">{supplierCatalogCards.length} trykkerier</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-3">
            {supplierCatalogCards.map((item) => (
              <button
                key={item.supplierId}
                type="button"
                onClick={() => openSupplierCatalog(item.supplierId)}
                className={`rounded-md border px-4 py-4 text-left transition hover:shadow-sm ${getNextActionClasses(item.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs opacity-80">
                      {item.productCount} produkt{item.productCount === 1 ? "" : "er"}
                      {item.expectedFamilyCount > 0
                        ? ` · ${item.stagedFamilies.length}/${item.expectedFamilyCount} familier`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={item.enabled ? "default" : "secondary"}>
                    {item.enabled ? "aktiv" : "senere"}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded border bg-background/70 px-2 py-2">
                    <p className="font-semibold">{item.readiness.ready}</p>
                    <p className="opacity-75">klar</p>
                  </div>
                  <div className="rounded border bg-background/70 px-2 py-2">
                    <p className="font-semibold">{item.readiness.imported}</p>
                    <p className="opacity-75">drafts</p>
                  </div>
                  <div className="rounded border bg-background/70 px-2 py-2">
                    <p className="font-semibold">{item.readiness.blocked}</p>
                    <p className="opacity-75">afventer</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.stagedFamilies.slice(0, 4).map((family) => (
                    <span key={`staged-${family}`} className="rounded border border-emerald-200 bg-background/60 px-2 py-0.5 text-[11px] text-emerald-950">
                      {getSupplierBankProductFamilyLabelDa(family)}
                    </span>
                  ))}
                  {item.missingFamilies.slice(0, 3).map((family) => (
                    <span key={`missing-${family}`} className="rounded border border-amber-200 bg-background/60 px-2 py-0.5 text-[11px] text-amber-950">
                      {getSupplierBankProductFamilyLabelDa(family)}
                    </span>
                  ))}
                  {item.stagedFamilies.length + item.missingFamilies.length > 7 ? (
                    <span className="rounded border bg-background/60 px-2 py-0.5 text-[11px] opacity-75">
                      +{item.stagedFamilies.length + item.missingFamilies.length - 7}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.statusLabel}</p>
                    <p className="mt-1 text-xs opacity-80">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium opacity-85">Åbn</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Supplierbanken er ikke klar i databasen endnu.</p>
              <p className="mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!error ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Gate roadmap
                </CardTitle>
                <CardDescription>
                  Fem trin der samler beslutninger, coverage gaps og QA. Overblikket er read-only og ændrer ingen bankdata, produkter eller priser.
                </CardDescription>
              </div>
              <Badge variant="outline">{gateRoadmapItems.length} gates</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-5">
              {gateRoadmapItems.map((item) => {
                return (
                  <button
                    key={`${item.order}-${item.title}`}
                    type="button"
                    disabled={!item.supplierId}
                    onClick={item.supplierId ? () => setActiveSupplierId(item.supplierId as string) : undefined}
                    className={`rounded-md border px-3 py-3 text-left text-sm ${item.supplierId ? "transition hover:shadow-sm" : "cursor-default"} ${getNextActionClasses(item.tone)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                          {item.order}
                        </span>
                        <p className="font-medium leading-snug">{item.title}</p>
                      </div>
                      <Badge variant={getDecisionPriorityVariant(item.priority) as any}>
                        {getDecisionPriorityLabel(item.priority)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{item.description}</p>
                    <ul className="mt-3 space-y-1 text-xs opacity-80">
                      {item.details.slice(0, 4).map((detail) => (
                        <li key={detail}>- {detail}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-medium">{item.actionLabel}</p>
                  </button>
                );
              })}
            </div>

            {pixartUrlCandidateRows.length > 0 ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Pixart URL-kandidater</p>
                    <p className="text-xs text-muted-foreground">
                      Planlægning fra supplier registry. Links må ikke bruges til probe/extract, før eksakt URL og profil er bekræftet.
                    </p>
                  </div>
                  <Badge variant="outline">{pixartUrlCandidateRows.length} kandidater</Badge>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <div className="rounded-md border bg-background/70 px-3 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{pixartUrlCandidateSummary.pending} afventer</Badge>
                      <Badge variant={pixartUrlCandidateSummary.confirmed > 0 ? "default" : "secondary"}>
                        {pixartUrlCandidateSummary.confirmed} bekræftet
                      </Badge>
                      <Badge variant={pixartUrlCandidateSummary.rejected > 0 ? "destructive" : "secondary"}>
                        {pixartUrlCandidateSummary.rejected} afvist
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      En URL er stadig kun planlægning, indtil eksakt produkt/configurator-side, synlig option shape og profil-support er dokumenteret.
                    </p>
                    <div className="mt-3 rounded border bg-muted/30 px-3 py-2">
                      <p className="font-medium">Næste sikre check</p>
                      <code className="mt-1 block break-all font-mono opacity-85">
                        npm run supplier-bank:url-confirmation-checklist:write -- --supplier pixartprinting
                      </code>
                    </div>
                  </div>
                  <div className="rounded-md border bg-background/70 px-3 py-3 text-xs">
                    <p className="font-medium">Manual URL-checkliste</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {PIXART_URL_CONFIRMATION_CHECKLIST.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {pixartUrlCandidateRows.map((row) => (
                    <a
                      key={`${row.family}-${row.candidate.url}`}
                      href={row.candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border bg-background px-3 py-2 text-sm transition hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{getSupplierBankProductFamilyLabelDa(row.family)}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{row.candidate.url}</p>
                        </div>
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={row.candidate.status === "confirmed_source_url" ? "default" : "secondary"}>
                          {getUrlCandidateStatusLabel(row.candidate.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{row.candidate.evidence}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!error && approvalCandidateItems.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Afventer godkendelse
                </CardTitle>
                <CardDescription>
                  Business-beslutninger der kan flytte banken videre. Kortene er read-only og starter ingen import, scrape, publicering eller prisopdatering.
                </CardDescription>
              </div>
              <Badge variant="outline">{approvalCandidateItems.length} kandidater</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {approvalCandidateItems.map((item) => (
              <button
                key={`${item.supplierName}-${item.title}`}
                type="button"
                onClick={item.supplierId ? () => setActiveSupplierId(item.supplierId as string) : undefined}
                className={`rounded-md border px-4 py-4 text-left transition hover:shadow-sm ${getNextActionClasses(item.tone)}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getDecisionPriorityVariant(item.priority) as any}>
                        {getDecisionPriorityLabel(item.priority)}
                      </Badge>
                      <Badge variant={getApprovalStatusVariant(item.tone) as any}>
                        {item.statusLabel}
                      </Badge>
                      <Badge variant="outline">{item.familyLabel}</Badge>
                    </div>
                    <h3 className="mt-3 font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs opacity-75">{item.supplierName}</p>
                  </div>
                  <span className="text-xs font-medium opacity-80">
                    Åbn leverandør
                  </span>
                </div>
                <p className="mt-3 text-sm opacity-85">{item.description}</p>
                <ul className="mt-3 space-y-1 text-xs opacity-80">
                  {item.evidence.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
                <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                  <p className="font-medium">Bevisspor før beslutning</p>
                  <div className="mt-2 grid gap-2">
                    {item.proofTrail.map((proof) => (
                      <div key={`${proof.label}-${proof.value}`} className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
                        <span className="font-medium opacity-80">{proof.label}</span>
                        <code className="break-all font-mono opacity-85">{proof.value}</code>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded border bg-background/60 px-3 py-2">
                    <p className="font-medium">Hvis godkendt</p>
                    <p className="mt-1 opacity-85">{item.approveImpact}</p>
                  </div>
                  <div className="rounded border bg-background/60 px-3 py-2">
                    <p className="font-medium">Hvis afventer</p>
                    <p className="mt-1 opacity-85">{item.deferImpact}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.guardrails.map((guardrail) => (
                    <Badge key={guardrail} variant="outline">
                      {guardrail}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                  <p className="font-medium">Beslutningscheckliste</p>
                  <ul className="mt-2 space-y-1 opacity-85">
                    {item.decisionChecklist.map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                  <p className="font-medium">Eksakt approval-tekst</p>
                  <code className="mt-1 block whitespace-pre-wrap break-words font-mono opacity-85">{item.approvalPhrase}</code>
                </div>
                <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                  <p className="font-medium">Eksakt afvent-tekst</p>
                  <code className="mt-1 block whitespace-pre-wrap break-words font-mono opacity-85">{item.deferPhrase}</code>
                </div>
                <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                  <p className="font-medium">Næste sikre check</p>
                  <code className="mt-1 block break-all font-mono opacity-85">{item.safeCheckCommand}</code>
                </div>
                <p className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs opacity-90">
                  {item.approvalNote}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!error && coverageGapItems.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Manglende familier</CardTitle>
                <CardDescription>
                  Hvor den planlagte supplier coverage stadig mangler. Listen er read-only og starter ingen probe, scrape, import eller prisopdatering.
                </CardDescription>
              </div>
              <Badge variant="outline">{coverageGapItems.length} gaps</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {coverageGapItems.map((item) => (
              <button
                key={`${item.supplierSlug}-${item.family}`}
                type="button"
                onClick={() => {
                  setActiveSupplierId(item.supplierId);
                  setFamilyFilter(item.family);
                }}
                className={`rounded-md border px-4 py-4 text-left text-sm transition hover:shadow-sm ${getNextActionClasses(item.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{getSupplierBankProductFamilyLabelDa(item.family)}</p>
                    <p className="mt-1 text-xs opacity-75">{item.supplierName}</p>
                  </div>
                  <Badge variant={item.tone === "blocked" ? "destructive" : "secondary"}>
                    {item.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2 text-xs opacity-85">
                  <p>
                    <span className="font-medium">Blokerer: </span>
                    {item.blocker}
                  </p>
                  <p>
                    <span className="font-medium">Næste sikre skridt: </span>
                    {item.nextStep}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {item.urlCandidateCount} URL-kandidat{item.urlCandidateCount === 1 ? "" : "er"}
                  </Badge>
                  <Badge variant={item.confirmedUrlCandidateCount > 0 ? "default" : "secondary"}>
                    {item.confirmedUrlCandidateCount} bekræftet
                  </Badge>
                  {item.pixartProfile ? (
                    <Badge variant="outline">
                      profile: {item.pixartProfile}
                    </Badge>
                  ) : null}
                </div>
                {item.pixartReadinessGates?.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {item.pixartReadinessGates.map((gate) => (
                      <div
                        key={gate.key}
                        className={`rounded border px-2 py-2 text-xs ${
                          gate.ready
                            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                            : "border-destructive/25 bg-destructive/10 text-destructive"
                        }`}
                      >
                        <p className="font-medium">{gate.label}</p>
                        <p className="mt-1 opacity-85">{gate.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {item.urlCandidatePreview ? (
                  <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">Første URL-kandidat</p>
                      <Badge variant={item.urlCandidatePreview.status === "confirmed_source_url" ? "default" : "secondary"}>
                        {getUrlCandidateStatusLabel(item.urlCandidatePreview.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 break-all font-mono opacity-85">{item.urlCandidatePreview.url}</p>
                    <p className="mt-2 opacity-75">{item.urlCandidatePreview.evidence}</p>
                    {item.urlCandidateCount > 1 ? (
                      <p className="mt-2 opacity-75">
                        +{item.urlCandidateCount - 1} flere kandidat{item.urlCandidateCount - 1 === 1 ? "" : "er"} i Pixart URL-listen.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 rounded border bg-background/60 px-3 py-2 text-xs">
                  <p className="font-medium">Næste sikre check</p>
                  <code className="mt-1 block break-all font-mono opacity-85">{item.safeCheckCommand}</code>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!error ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  Beslutningskø
                </CardTitle>
                <CardDescription>
                  Næste praktiske supplier-bank beslutninger. Listen læser kun data og kører ingen import, publicering eller prisopdatering.
                </CardDescription>
              </div>
              <Badge variant="outline">{decisionQueueItems.length} punkter</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-3">
            {decisionQueueItems.map((item) => (
              <div key={`${item.priority}-${item.title}`} className={`rounded-md border px-3 py-3 text-sm ${getNextActionClasses(item.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant={getDecisionPriorityVariant(item.priority) as any}>
                    {getDecisionPriorityLabel(item.priority)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs opacity-80">{item.description}</p>
                <ul className="mt-3 space-y-1 text-xs opacity-80">
                  {item.details.slice(0, 4).map((detail) => (
                    <li key={detail}>- {detail}</li>
                  ))}
                  {item.details.length > 4 ? (
                    <li>+ {item.details.length - 4} flere</li>
                  ) : null}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!error && nextExpansionItems.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Næste udvidelser</CardTitle>
                <CardDescription>
                  Prioriteret overblik over de næste leverandørfamilier og afklaringer i banken.
                </CardDescription>
              </div>
              <Badge variant="outline">{nextExpansionItems.length} forslag</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-4">
            {nextExpansionItems.map((item) => (
              <button
                key={item.supplierId}
                type="button"
                onClick={() => setActiveSupplierId(item.supplierId)}
                className={`rounded-md border px-3 py-3 text-left text-sm transition hover:shadow-sm ${getNextActionClasses(item.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant="outline">{item.readiness.blocked > 0 ? "afklar" : "næste"}</Badge>
                </div>
                <p className="mt-2 text-xs opacity-80">{item.description}</p>
                <p className="mt-3 text-xs opacity-80">
                  Mangler: {formatFamilyLabels(item.missingFamilies)}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  I banken: {formatFamilyLabels(item.stagedFamilies)}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div id="supplier-product-list" className="grid scroll-mt-6 gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leverandører</CardTitle>
            <CardDescription>Vælg hvor produkterne skal komme fra.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen leverandører endnu.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSupplierId("all")}
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    activeSupplierId === "all" ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">Alle leverandører</p>
                    <Badge variant="outline">overblik</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {products.length} produkter i banken
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px]">
                    <div className="rounded border bg-background px-1.5 py-1">
                      <p className="font-semibold">{allReadiness.ready}</p>
                      <p className="text-muted-foreground">klar</p>
                    </div>
                    <div className="rounded border bg-background px-1.5 py-1">
                      <p className="font-semibold">{allReadiness.imported}</p>
                      <p className="text-muted-foreground">drafts</p>
                    </div>
                    <div className="rounded border bg-background px-1.5 py-1">
                      <p className="font-semibold">{allReadiness.blocked}</p>
                      <p className="text-muted-foreground">stop</p>
                    </div>
                  </div>
                </button>
                {suppliers.map((supplier) => {
                  const supplierProductCount = products.filter((product) => product.supplier_id === supplier.id).length;
                  const readiness = readinessBySupplierId.get(supplier.id) || { ready: 0, blocked: 0, imported: 0 };
                  const coverage = coverageBySupplierId.get(supplier.id) || {
                    expectedFamilies: [],
                    stagedFamilies: [],
                    missingFamilies: [],
                    productCount: 0,
                  };
                  const familyPreview = [
                    ...coverage.stagedFamilies.slice(0, 3).map((family) => ({
                      family,
                      state: "staged" as const,
                    })),
                    ...coverage.missingFamilies.slice(0, 2).map((family) => ({
                      family,
                      state: "missing" as const,
                    })),
                  ];
                  const hiddenFamilyCount = Math.max(
                    0,
                    coverage.stagedFamilies.length + coverage.missingFamilies.length - familyPreview.length
                  );
                  const isActive = activeSupplierId === supplier.id;
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      onClick={() => setActiveSupplierId(supplier.id)}
                      className={`w-full rounded-md border px-3 py-3 text-left transition ${
                        isActive ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{supplier.name}</p>
                        <Badge variant={supplier.enabled ? "default" : "secondary"}>
                          {supplier.enabled ? "aktiv" : "klar senere"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {supplierProductCount} produkter i banken
                        {coverage.expectedFamilies.length > 0
                          ? ` · ${coverage.stagedFamilies.length}/${coverage.expectedFamilies.length} familier`
                          : ""}
                      </p>
                      {familyPreview.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {familyPreview.map((item) => (
                            <span
                              key={`${item.state}-${item.family}`}
                              className={`rounded border px-1.5 py-0.5 text-[10px] ${getFamilyStateClasses(item.state)}`}
                            >
                              {getSupplierBankProductFamilyLabelDa(item.family)}
                            </span>
                          ))}
                          {hiddenFamilyCount > 0 ? (
                            <span className="rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{hiddenFamilyCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px]">
                        <div className="rounded border bg-background px-1.5 py-1">
                          <p className="font-semibold">{readiness.ready}</p>
                          <p className="text-muted-foreground">klar</p>
                        </div>
                        <div className="rounded border bg-background px-1.5 py-1">
                          <p className="font-semibold">{readiness.imported}</p>
                          <p className="text-muted-foreground">drafts</p>
                        </div>
                        <div className="rounded border bg-background px-1.5 py-1">
                          <p className="font-semibold">{readiness.blocked}</p>
                          <p className="text-muted-foreground">stop</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedSupplier?.name || "Alle leverandører"}</CardTitle>
            <CardDescription>
              {selectedReadiness.ready} klar · {selectedReadiness.imported} drafts · {selectedReadiness.blocked} blokeret
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded-md border px-3 py-2 text-sm ${getNextActionClasses(selectedSupplierAction.tone)}`}>
              <p className="font-medium">{selectedSupplierAction.label}</p>
              <p className="mt-1 text-xs opacity-80">{selectedSupplierAction.description}</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">Match mod eksisterende produkter</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Viser mulige forbindelser mellem supplier-bank produkter og de produkter, der allerede findes i Webprinter.
                    Det er kun et læseværktøj og ændrer ikke produkter, valg eller priser.
                  </p>
                </div>
                <Badge variant={existingProductMatchError ? "secondary" : "outline"}>
                  {existingProductMatchError
                    ? "matchdata delvis"
                    : `${existingProducts.length} produkter`}
                </Badge>
              </div>
              {existingProductMatchError ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Matchdata kunne ikke læses fuldt: {existingProductMatchError}
                </p>
              ) : null}
            </div>
            {businessImportQueueItems.length > 0 ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Næste importvalg</p>
                    <p className="text-xs text-muted-foreground">
                      Prioriteret efter de aktuelle filtre. Kortene åbner kun preview og skriver ikke bankdata, produkter eller priser.
                    </p>
                  </div>
                  <Badge variant="outline">{businessImportQueueItems.length} forslag</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {businessImportQueueItems.map((item) => (
                    <button
                      key={item.product.id}
                      type="button"
                      onClick={() => openDryRunPreview(item.product)}
                      className={`rounded-md border px-3 py-3 text-left text-xs transition hover:shadow-sm ${getNextActionClasses(item.tone)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.productName}</p>
                          <p className="mt-0.5 opacity-75">{item.supplierName}</p>
                        </div>
                        <Badge variant={getImportReadinessVariant(item.importedProductSlug, item.tone === "blocked" || item.tone === "warning" ? item.description : null) as any}>
                          {item.statusLabel}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{getSupplierBankProductFamilyLabelDa(item.family)}</Badge>
                        <Badge variant="outline">{formatNumber(item.priceRows)} prislinjer</Badge>
                      </div>
                      <p className="mt-3 opacity-85">{item.description}</p>
                      {item.safeCheckCommand ? (
                        <code className="mt-2 block break-all rounded border bg-background/70 px-2 py-1 font-mono text-[11px]">
                          {item.safeCheckCommand}
                        </code>
                      ) : null}
                      <p className="mt-3 font-medium opacity-85">Åbn preview</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {selectedSupplier && selectedSupplierFamilyShelves.length > 0 ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Kataloghylder hos {selectedSupplier.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Hver hylde viser bankstatus for en produktfamilie. Klik for at filtrere produktlisten.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {selectedSupplierCoverage?.stagedFamilies.length || 0}/{selectedSupplierCoverage?.expectedFamilies.length || selectedSupplierFamilyShelves.length} i bank
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedSupplierFamilyShelves.map((row) => {
                    const shelfTone: ProductNextAction["tone"] = row.state === "missing"
                      ? "warning"
                      : row.readiness.blocked > 0
                        ? "blocked"
                        : row.readiness.ready > 0
                          ? "ready"
                          : "info";
                    return (
                      <button
                        key={row.family}
                        type="button"
                        onClick={() => {
                          setFamilyFilter(row.family);
                          setBankStatusFilter("all");
                          setReadinessFilter("all");
                        }}
                        className={`rounded-md border px-3 py-3 text-left text-xs transition hover:shadow-sm ${getNextActionClasses(shelfTone)} ${
                          familyFilter === row.family ? "ring-2 ring-primary/35" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="block text-sm font-semibold">{getSupplierBankProductFamilyLabelDa(row.family)}</span>
                            <span className="mt-0.5 block opacity-80">
                              {getFamilyStateLabel(row.state)}
                              {row.productCount > 0 ? ` · ${row.productCount} produkt${row.productCount === 1 ? "" : "er"}` : ""}
                            </span>
                          </div>
                          <Badge variant={row.state === "missing" ? "secondary" : "outline"}>
                            {row.state === "missing" ? "plan" : "bank"}
                          </Badge>
                        </div>
                        {row.state === "staged" ? (
                          <>
                            <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                              <div className="rounded border bg-background/60 px-1.5 py-1">
                                <p className="font-semibold">{row.readiness.ready}</p>
                                <p className="opacity-75">klar</p>
                              </div>
                              <div className="rounded border bg-background/60 px-1.5 py-1">
                                <p className="font-semibold">{row.readiness.imported}</p>
                                <p className="opacity-75">drafts</p>
                              </div>
                              <div className="rounded border bg-background/60 px-1.5 py-1">
                                <p className="font-semibold">{row.readiness.blocked}</p>
                                <p className="opacity-75">afventer</p>
                              </div>
                            </div>
                            <p className="mt-3 opacity-85">
                              {formatNumber(row.priceRows)} prislinjer
                              {row.priceMinDkk != null || row.priceMaxDkk != null
                                ? ` · ${formatNumber(row.priceMinDkk)}-${formatNumber(row.priceMaxDkk)} DKK`
                                : ""}
                            </p>
                            <p className="mt-1 opacity-75">
                              Senest opdateret {formatDate(row.latestUpdatedAt)}
                            </p>
                          </>
                        ) : (
                          <div className="mt-3 rounded border bg-background/60 px-2 py-2">
                            <p className="font-medium">Afventer lokal preview</p>
                            <p className="mt-1 opacity-80">
                              {row.urlCandidateCount > 0
                                ? `${row.urlCandidateCount} URL-kandidat${row.urlCandidateCount === 1 ? "" : "er"} skal bekræftes før extraction.`
                              : "Start med dry extraction og normaliseret preview før bank write."}
                            </p>
                          </div>
                        )}
                        <div className="mt-3 rounded border bg-background/60 px-2 py-2">
                          <p className="font-medium">Næste sikre skridt</p>
                          <p className="mt-1 opacity-80">{row.nextStep}</p>
                          {row.safeCheckCommand ? (
                            <code className="mt-2 block break-all rounded bg-muted/60 px-2 py-1 font-mono text-[11px]">
                              {row.safeCheckCommand}
                            </code>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Søg produkt"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={familyFilter}
                onChange={(event) => setFamilyFilter(event.target.value as "all" | SupplierBankProductFamily)}
              >
                <option value="all">Alle produkttyper</option>
                {SUPPLIER_BANK_PRODUCT_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {getSupplierBankProductFamilyLabelDa(family)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Aktive filtre</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {activeProductFilterLabels.length > 0 ? (
                    activeProductFilterLabels.map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Ingen produktfiltre er aktive.</span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={activeProductFilterLabels.length === 0}
                onClick={clearProductFilters}
              >
                Ryd filtre
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["all", getBankStatusFilterLabel("all"), baseFilteredProducts.length],
                ...SUPPLIER_BANK_PRODUCT_STATUSES
                  .filter((status) => status !== "archived")
                  .map((status) => [status, getBankStatusFilterLabel(status), bankStatusCounts[status] || 0] as const),
              ] as Array<[BankStatusFilter, string, number]>).map(([filter, label, count]) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={bankStatusFilter === filter ? "default" : "outline"}
                  onClick={() => setBankStatusFilter(filter)}
                >
                  {label}
                  <span className="ml-2 rounded bg-background/20 px-1.5 text-xs">{count}</span>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "Alle", statusFilteredProducts.length],
                ["ready", "Klar", baseFilteredReadiness.ready],
                ["imported", "Drafts", baseFilteredReadiness.imported],
                ["blocked", "Blokeret", baseFilteredReadiness.blocked],
              ] as Array<[ReadinessFilter, string, number]>).map(([filter, label, count]) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={readinessFilter === filter ? "default" : "outline"}
                  onClick={() => setReadinessFilter(filter)}
                >
                  {label}
                  <span className="ml-2 rounded bg-background/20 px-1.5 text-xs">{count}</span>
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Produktkortene viser normale importvalg først</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Refresh og prisreview er avancerede værktøjer og skjules, indtil de skal bruges.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showAdvancedProductTools ? "default" : "outline"}
                onClick={() => setShowAdvancedProductTools((current) => !current)}
              >
                {showAdvancedProductTools ? "Skjul avanceret" : "Vis avanceret"}
              </Button>
            </div>
            {matrixRepairJobs.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Reparer matrix-drafts</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(matrixRepairJobs.length)} importerede matrixdrafts mangler gyldige prisrækker.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={repairingAllJobs}
                  onClick={repairAllMatrixDraftImports}
                >
                  {repairingAllJobs ? "Reparerer..." : "Reparer alle matrixdrafts"}
                </Button>
              </div>
            ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Indlæser supplier bank...</p>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">
                {products.length === 0 ? "Ingen synlige bankprodukter" : "Ingen produkter matcher filteret"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {products.length === 0
                  ? "Hvis du forventer data her, er det typisk fordi browser-sessionen ikke har master-admin RLS adgang endnu."
                  : `Ingen ${getReadinessFilterLabel(readinessFilter)} produkter matcher statusfilteret ${getBankStatusFilterLabel(bankStatusFilter).toLowerCase()}.`}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {filteredProducts.map((product) => {
                const supplier = supplierById.get(product.supplier_id);
                const pricing = resolveProductPricingSummary(
                  product,
                  snapshotStatsByProductId[product.id]
                );
                const rowCount = pricing.rows;
                const quantityMin = pricing.quantityMin;
                const quantityMax = pricing.quantityMax;
                const priceMin = pricing.priceMinDkk;
                const priceMax = pricing.priceMaxDkk;
                const snapshotStats = snapshotStatsByProductId[product.id] || getEmptySnapshotStats();
                const importedJob = latestImportedJobByProductId.get(product.id);
                const importedProductSlug = getImportedProductSlug(importedJob);
                const importedTargetProduct = importedJob?.target_product_id ? importedTargetProductsById[importedJob.target_product_id] : null;
                const importedTargetRowCounts = importedJob?.target_product_id ? importedTargetRowCountsById[importedJob.target_product_id] : null;
                const needsMatrixRepairForJob = needsMatrixRepair(importedJob, importedTargetProduct, importedTargetRowCounts);
                const deltaReview = latestDeltaReviewByProductId.get(product.id);
                const refreshJob = latestRefreshJobByProductId.get(product.id);
                const hasActiveRefreshJob = !!refreshJob && ["queued", "running"].includes(refreshJob.status);
                const canCreateDeltaReview = snapshotStats.count >= 2 && !deltaReview;
                const isCreatingDeltaReview = creatingDeltaReviewProductId === product.id;
                const isQueueingRefresh = queueingRefreshProductId === product.id;
                const importBlockReason = getImportBlockReason(product, deltaReview, snapshotStats);
                const readinessLabel = getImportReadinessLabel(product, importedProductSlug, importBlockReason);
                const readinessVariant = getImportReadinessVariant(importedProductSlug, importBlockReason);
                const importModeLabel = getImportModeLabel(product, importedJob);
                const attributePreviewRows = getAttributePreviewRows(product.normalized_attributes);
                const nextAction = getProductNextAction({
                  product,
                  supplier,
                  importedProductSlug,
                  importBlockReason,
                  deltaReview,
                  snapshotStats,
                  refreshJob,
                });
                const matchSuggestions = existingProductMatchSuggestionsByBankProductId.get(product.id) || [];
                return (
                  <div key={product.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {getSupplierBankProductFamilyLabelDa(product.product_family)}
                          </Badge>
                          <Badge variant="outline">
                            {importModeLabel}
                          </Badge>
                          <Badge variant={readinessVariant as any}>
                            {readinessLabel}
                          </Badge>
                          {deltaReview ? (
                            <Badge variant={deltaReviewVariant(deltaReview.status) as any}>
                              prisreview {getDeltaReviewStatusLabel(deltaReview.status)}
                            </Badge>
                          ) : null}
                          {refreshJob ? (
                            <Badge variant="outline">refresh {getRefreshJobStatusLabel(refreshJob.status)}</Badge>
                          ) : null}
                        </div>
                        <h3 className="font-semibold">{product.name_da}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {supplier?.name || "Ukendt leverandør"}
                        </p>
                        <p className="mt-3 text-sm">
                          {formatNumber(rowCount)} prislinjer · Oplag {formatNumber(quantityMin)}-{formatNumber(quantityMax)}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          Fra {formatNumber(priceMin)} til {formatNumber(priceMax)} DKK
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {snapshotStats.count} snapshots · Opdateret {formatDate(snapshotStats.latestCreatedAt || product.last_price_checked_at)}
                        </p>
                        {attributePreviewRows.length > 0 ? (
                          <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2">
                            <p className="text-xs font-medium text-muted-foreground">Valgmuligheder</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {attributePreviewRows.map((attribute) => (
                                <div key={attribute.key} className="rounded border bg-background/70 px-2 py-2 text-xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium">{attribute.label}</p>
                                    <Badge variant="outline">{attribute.valueCount}</Badge>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-muted-foreground">
                                    {attribute.preview}
                                    {attribute.valueCount > 3 ? " ..." : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Match mod eksisterende produkt</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Brug dette som beslutningshjælp: forbind til eksisterende produkt, opret ny draft, eller tilføj manglende valg i en draft senere.
                              </p>
                            </div>
                            <Badge variant="outline">
                              {matchSuggestions.length > 0 ? `${matchSuggestions.length} forslag` : "ingen forslag"}
                            </Badge>
                          </div>
                          {matchSuggestions.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {matchSuggestions.map((suggestion) => (
                                <div key={suggestion.product.id} className="rounded border bg-background/70 px-3 py-2 text-xs">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">{suggestion.product.name}</p>
                                        <Badge variant={getProductMatchBadgeVariant(suggestion.score, suggestion.alreadyImportedTarget) as any}>
                                          {suggestion.statusLabel}
                                        </Badge>
                                        <Badge variant="outline">{suggestion.score}/100</Badge>
                                      </div>
                                      <p className="mt-1 text-muted-foreground">
                                        {suggestion.product.pricing_type || "ukendt pris"} · {suggestion.optionGroupCount} grupper · {suggestion.optionValueCount} valg
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => setLinkPreview({ bankProduct: product, suggestion })}
                                      >
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        Forbered
                                      </Button>
                                      <Button asChild size="sm" variant="outline">
                                        <a href={adminPathWithCurrentContext(`/admin/product/${suggestion.product.slug}`)}>
                                          <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                                          Åbn
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                  {suggestion.reasons.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {suggestion.reasons.map((reason) => (
                                        <Badge key={reason} variant="secondary">{reason}</Badge>
                                      ))}
                                    </div>
                                  ) : null}
                                  {suggestion.matchingSupplierValues.length > 0 ? (
                                    <div className="mt-2">
                                      <p className="font-medium text-emerald-700">Findes allerede</p>
                                      <p className="mt-1 text-muted-foreground line-clamp-2">
                                        {suggestion.matchingSupplierValues.join(", ")}
                                      </p>
                                    </div>
                                  ) : null}
                                  {suggestion.missingSupplierValues.length > 0 ? (
                                    <div className="mt-2">
                                      <p className="font-medium text-amber-700">Mangler som mulige nye valg</p>
                                      <p className="mt-1 text-muted-foreground line-clamp-2">
                                        {suggestion.missingSupplierValues.join(", ")}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Ingen tydelige match fundet. Den sikre vej er at oprette en upubliceret draft og gennemgå navn, materialer og valgmuligheder manuelt.
                            </p>
                          )}
                        </div>
                        <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${getNextActionClasses(nextAction.tone)}`}>
                          <p className="font-medium">{nextAction.label}</p>
                          <p className="mt-1 text-xs opacity-80">{nextAction.description}</p>
                        </div>
                        {importedJob ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p>Seneste draft importeret {formatDate(importedJob.created_at)}</p>
                            {importedTargetProduct ? (
                              <p>
                                Draft QA: {importedTargetProduct.is_published ? "publiceret" : "upubliceret"} · {importedTargetProduct.pricing_type || "ukendt pricing"}
                                {importedJob.import_mode === "matrix_layout_v1"
                                  ? ` · ${formatNumber(importedTargetRowCounts?.genericPrices)} matrix-prislinjer`
                                  : importedJob.import_mode === "storformat"
                                    ? ` · ${formatNumber(importedTargetRowCounts?.storformatMaterials)} materialer · ${formatNumber(importedTargetRowCounts?.storformatVariants)} varianter`
                                    : ""}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {needsMatrixRepairForJob ? (
                          <p className="mt-2 text-xs text-destructive">
                            Matrix-priser mangler eller matcher ikke import-auditet; brug Reparer matrix-priser.
                          </p>
                        ) : null}
                        {deltaReview ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Seneste prisreview oprettet {formatDate(deltaReview.created_at)}
                          </p>
                        ) : null}
                        {importBlockReason && !importedProductSlug ? (
                          <p className="mt-2 text-xs text-destructive">
                            Import blokeret: {importBlockReason}
                          </p>
                        ) : null}
                        {refreshJob ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Seneste refresh {getRefreshJobStatusLabel(refreshJob.status)} {formatDate(refreshJob.queued_at)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-start gap-2 lg:justify-end">
                        {importedProductSlug ? (
                          <Button asChild size="sm" variant="default">
                            <a href={adminPathWithCurrentContext(`/admin/product/${importedProductSlug}`)}>
                              <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                              Åbn draft
                            </a>
                          </Button>
                        ) : null}
                        {product.source_url ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={product.source_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Kilde
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDryRunPreview(product)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Se produkt
                        </Button>
                        <Button
                          size="sm"
                          disabled={importingDraft || !!importedProductSlug || !!importBlockReason}
                          onClick={() => importProductAsDraft(product)}
                          title={importBlockReason || undefined}
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          {importedProductSlug ? "Importeret" : "Importer produkt"}
                        </Button>
                        {needsMatrixRepairForJob && importedJob?.import_mode === "matrix_layout_v1" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={repairingImportJobId === importedJob.id || repairingAllJobs}
                            onClick={() => repairImportedDraftPrices(importedJob)}
                          >
                            <RefreshCw className={`mr-2 h-4 w-4 ${repairingImportJobId === importedJob.id ? "animate-spin" : ""}`} />
                            Reparer matrix-priser
                          </Button>
                        ) : null}
                        {showAdvancedProductTools ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={hasActiveRefreshJob || isQueueingRefresh}
                              onClick={() => queueRefreshJob(product)}
                              title={hasActiveRefreshJob ? "Refresh ligger allerede i kø" : undefined}
                            >
                              <ListChecks className={`mr-2 h-4 w-4 ${isQueueingRefresh ? "animate-pulse" : ""}`} />
                              {hasActiveRefreshJob ? "Refresh i kø" : isQueueingRefresh ? "Lægger i kø..." : "Kø refresh"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canCreateDeltaReview || isCreatingDeltaReview}
                              onClick={() => createPriceDeltaReview(product)}
                              title={snapshotStats.count < 2 ? "Kræver mindst to snapshots" : deltaReview ? "Prisreview findes allerede" : undefined}
                            >
                              <RefreshCw className={`mr-2 h-4 w-4 ${isCreatingDeltaReview ? "animate-spin" : ""}`} />
                              {deltaReview ? "Review klar" : isCreatingDeltaReview ? "Opretter..." : "Opret prisreview"}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dækningskort</CardTitle>
          <CardDescription>
            Sammenligner leverandørens planlagte produktfamilier med de aktive produkter, der ligger i banken.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen leverandører endnu.</p>
          ) : suppliers.map((supplier) => {
            const coverage = coverageBySupplierId.get(supplier.id) || {
              expectedFamilies: [],
              stagedFamilies: [],
              missingFamilies: [],
              productCount: 0,
            };
            const readiness = readinessBySupplierId.get(supplier.id) || { ready: 0, blocked: 0, imported: 0 };
            const coverageAction = getSupplierCoverageAction({ coverage, readiness, supplier });
            return (
              <div key={supplier.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{supplier.name}</h3>
                      <Badge variant={supplier.enabled ? "default" : "secondary"}>
                        {supplier.enabled ? "aktiv" : "kandidat"}
                      </Badge>
                      <Badge variant="outline">{coverage.productCount} bankprodukter</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Planlagt: {formatFamilyLabels(coverage.expectedFamilies)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      I banken: {formatFamilyLabels(coverage.stagedFamilies)}
                    </p>
                  </div>
                  <div className="min-w-[220px] rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <p className="font-medium">
                      {coverage.missingFamilies.length === 0 ? "Dækket" : `${coverage.missingFamilies.length} mangler`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {coverage.missingFamilies.length === 0
                        ? "Alle planlagte familier er repræsenteret i banken."
                        : formatFamilyLabels(coverage.missingFamilies)}
                    </p>
                  </div>
                </div>
                <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${getNextActionClasses(coverageAction.tone)}`}>
                  <p className="font-medium">{coverageAction.label}</p>
                  <p className="mt-1 text-xs opacity-80">{coverageAction.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prisreviews</CardTitle>
          <CardDescription>
            Gennemse prisforskelle mellem gemte supplier-bank snapshots. Status ændrer kun reviewet, ikke webshoppriser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deltaReviews.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Ingen prisreviews endnu. Opret et review fra et bankprodukt med mindst to snapshots.
            </div>
          ) : (
            deltaReviews.slice(0, 8).map((review) => {
              const product = products.find((item) => item.id === review.bank_product_id);
              const nextStatuses = getNextDeltaReviewStatuses(review.status);
              const changedRows = getSummaryNumber(review.change_summary, "changedRows");
              const addedRows = getSummaryNumber(review.change_summary, "addedRows");
              const removedRows = getSummaryNumber(review.change_summary, "removedRows");
              const increasedRows = getSummaryNumber(review.change_summary, "increasedRows");
              const decreasedRows = getSummaryNumber(review.change_summary, "decreasedRows");
              const netDelta = toNumber(review.change_summary?.netChangedRowDeltaDkk);
              return (
                <div key={review.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {getDeltaReviewStatusLabel(review.status)}
                        </Badge>
                        <Badge variant="secondary">
                          {changedRows} ændret
                        </Badge>
                        <Badge variant="secondary">
                          {addedRows} nye
                        </Badge>
                        <Badge variant="secondary">
                          {removedRows} fjernet
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-semibold">{product?.name_da || "Supplier-bank produkt"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {increasedRows} steget · {decreasedRows} faldet
                        {netDelta != null ? ` · netto ${formatNumber(netDelta)} DKK` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Oprettet {formatDate(review.created_at)}
                        {review.threshold_pct != null ? ` · tærskel ${review.threshold_pct}%` : ""}
                      </p>
                      {review.notes ? (
                        <p className="mt-2 text-xs text-muted-foreground">{review.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                      {nextStatuses.length === 0 ? (
                        <Badge variant="outline">Ingen næste handling</Badge>
                      ) : nextStatuses.map((next) => (
                        <Button
                          key={next.status}
                          size="sm"
                          variant={next.status === "accepted" ? "default" : "outline"}
                          disabled={updatingDeltaReviewId === review.id}
                          onClick={() => updateDeltaReviewStatus(review, next.status)}
                        >
                          {updatingDeltaReviewId === review.id ? "Gemmer..." : next.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refresh kø</CardTitle>
          <CardDescription>
            Admin-forespørgsler til supplier-bank refresh. Køen opretter ikke snapshots eller live priser alene.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {refreshJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Ingen refresh-forespørgsler endnu.
            </div>
          ) : (
            refreshJobs.slice(0, 8).map((job) => {
              const product = products.find((item) => item.id === job.bank_product_id);
              const supplier = job.supplier_id ? supplierById.get(job.supplier_id) : null;
              return (
                <div key={job.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusVariant(job.status) as any}>
                          {getRefreshJobStatusLabel(job.status)}
                        </Badge>
                        <Badge variant="outline">{job.mode}</Badge>
                        <Badge variant="secondary">{job.tool}</Badge>
                      </div>
                      <h3 className="mt-3 font-semibold">{product?.name_da || "Supplier-bank produkt"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {supplier?.name || "Ukendt leverandør"} · Oprettet {formatDate(job.queued_at)}
                      </p>
                      {job.error ? (
                        <p className="mt-2 text-sm text-destructive">{job.error}</p>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground lg:text-right">
                      <p>Job ID</p>
                      <p className="font-mono">{job.id}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
        </>
      ) : null}

      <Dialog open={!!linkPreview} onOpenChange={(open) => !open && setLinkPreview(null)}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Forbered forbindelse til eksisterende produkt</DialogTitle>
            <DialogDescription>
              Læsepreview før en mulig senere handling. Denne dialog opretter ikke produkter, valg, priser eller links.
            </DialogDescription>
          </DialogHeader>

          {linkPreview ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Supplier-bank produkt</p>
                  <p className="mt-1 font-semibold">{linkPreview.bankProduct.name_da}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {linkPreviewSupplier?.name || "Ukendt leverandør"} · {getSupplierBankProductFamilyLabelDa(linkPreview.bankProduct.product_family)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{formatNumber(linkPreviewPricingSummary?.rows || 0)} prislinjer</Badge>
                    <Badge variant="outline">{linkPreviewSnapshotStats?.count || 0} snapshots</Badge>
                    <Badge variant={statusVariant(linkPreview.bankProduct.status) as any}>{linkPreview.bankProduct.status}</Badge>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Eksisterende Webprinter produkt</p>
                  <p className="mt-1 font-semibold">{linkPreview.suggestion.product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {linkPreview.suggestion.product.pricing_type || "ukendt pris"} · {linkPreview.suggestion.product.is_published ? "publiceret" : "upubliceret"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant={getProductMatchBadgeVariant(linkPreview.suggestion.score, linkPreview.suggestion.alreadyImportedTarget) as any}>
                      {linkPreview.suggestion.statusLabel}
                    </Badge>
                    <Badge variant="outline">{linkPreview.suggestion.score}/100</Badge>
                    <Badge variant="outline">{linkPreview.suggestion.optionValueCount} eksisterende valg</Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-md border px-3 py-3 text-sm">
                <p className="font-medium">Hvad previewet betyder</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Match</p>
                    <p className="mt-1 font-semibold">{linkPreview.suggestion.matchingSupplierValues.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Supplier-valg ser ud til at findes allerede.</p>
                  </div>
                  <div className="rounded border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Mulige nye valg</p>
                    <p className="mt-1 font-semibold">{linkPreview.suggestion.missingSupplierValues.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Skal kun oprettes i en draft efter senere approval.</p>
                  </div>
                  <div className="rounded border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Prisrækker</p>
                    <p className="mt-1 font-semibold">{formatNumber(linkPreviewPricingSummary?.rows || 0)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Kun læst fra supplier-bank preview.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border px-3 py-3 text-sm">
                  <p className="font-medium text-emerald-700">Findes allerede</p>
                  {linkPreview.suggestion.matchingSupplierValues.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {linkPreview.suggestion.matchingSupplierValues.map((value) => (
                        <Badge key={value} variant="secondary">{value}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Ingen tydelige option-match fundet.</p>
                  )}
                </div>
                <div className="rounded-md border px-3 py-3 text-sm">
                  <p className="font-medium text-amber-700">Kandidat til nye draft-valg</p>
                  {linkPreview.suggestion.missingSupplierValues.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {linkPreview.suggestion.missingSupplierValues.map((value) => (
                        <Badge key={value} variant="outline">{value}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Ingen manglende supplier-valg i denne korte previewliste.</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="font-medium">Sikkerhedsgrænse</p>
                <p className="mt-1 text-xs">
                  Næste write-flow må først bygges som en separat approval-gate: opret kun upubliceret draft, overskriv ikke eksisterende produkter,
                  skriv ikke live priser, og vis fuld diff før noget gemmes.
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {linkPreview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    openDryRunPreview(linkPreview.bankProduct);
                    setLinkPreview(null);
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Åbn supplier preview
                </Button>
                <Button asChild type="button" variant="outline">
                  <a href={adminPathWithCurrentContext(`/admin/product/${linkPreview.suggestion.product.slug}`)}>
                    <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                    Åbn eksisterende produkt
                  </a>
                </Button>
              </>
            ) : null}
            <Button type="button" onClick={() => setLinkPreview(null)}>
              Luk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewProduct} onOpenChange={(open) => !open && setPreviewProduct(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewImportedProductSlug
                ? "Draft er oprettet"
                : previewImportBlockReason
                  ? "Produkt kræver review"
                  : "Produkt klar til import"}
            </DialogTitle>
            <DialogDescription>
              {previewImportedProductSlug
                ? "Gennemgå den upublicerede Webprinter-draft i produktadmin."
                : previewImportBlockReason
                  ? "Gennemse produktet og løs den viste næste handling, før det kan importeres."
                  : "Gennemse produktet kort, eller importer det som upubliceret Webprinter-produkt."}
            </DialogDescription>
          </DialogHeader>

          {previewProduct ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Produkt</p>
                  <p className="font-medium">{previewProduct.name_da}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{previewProduct.name_original}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Import</p>
                  <p className="font-medium">
                    {previewImportedProductSlug
                      ? "Draft er oprettet"
                      : previewMatrixUnsupportedReason
                        ? "Storformat-flow"
                        : previewImportBlockReason
                          ? "Import blokeret"
                          : "Webprinter produkt"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {previewImportedProductSlug
                      ? `Seneste draft blev importeret ${formatDate(previewImportedJob?.created_at)}.`
                      : previewMatrixUnsupportedReason
                        ? "Dette produkt må ikke importeres med Matrix Layout. Brug den godkendte storformat-import."
                        : previewImportBlockReason
                          ? "Produktet skal have review, snapshot eller importvej afklaret før draft."
                      : "Oprettes upubliceret, så det kan gennemgås før visning i shoppen."}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant={statusVariant(previewProduct.status) as any}>
                      {previewProduct.status}
                    </Badge>
                    <Badge variant="outline">
                      {getImportModeLabel(previewProduct, previewImportedJob)}
                    </Badge>
                    <Badge variant="outline">
                      {getSupplierBankProductFamilyLabelDa(previewProduct.product_family)}
                    </Badge>
                    {previewDeltaReview ? (
                      <Badge variant={deltaReviewVariant(previewDeltaReview.status) as any}>
                        prisreview {getDeltaReviewStatusLabel(previewDeltaReview.status)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              {previewImportBlockReason ? (
                <div className={`rounded-md border px-4 py-3 text-sm ${getNextActionClasses(previewMatrixUnsupportedReason ? "blocked" : "warning")}`}>
                  <p className="font-medium">
                    {previewMatrixUnsupportedReason ? "Storformat-import påkrævet" : "Import afventer review"}
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    {previewMatrixUnsupportedReason
                      ? `${previewMatrixUnsupportedReason} Kør storformat-preview og review, og opret kun en upubliceret draft gennem den godkendte storformat-import.`
                      : previewImportBlockReason}
                  </p>
                </div>
              ) : null}

              {previewSafeActionSummary ? (
                <div className={`rounded-md border px-4 py-3 text-sm ${getNextActionClasses(previewSafeActionSummary.tone)}`}>
                  <p className="font-medium">Næste sikre skridt</p>
                  <p className="mt-1 text-xs opacity-80">{previewSafeActionSummary.title}</p>
                  <p className="mt-1 text-xs opacity-80">{previewSafeActionSummary.description}</p>
                  {previewSafeActionSummary.safeCheckCommand ? (
                    <code className="mt-2 block break-all rounded bg-background/60 px-2 py-1 font-mono text-[11px]">
                      {previewSafeActionSummary.safeCheckCommand}
                    </code>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-md border p-4">
                <h3 className="font-medium">Produktoversigt</h3>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                  {(() => {
                    const pricing = resolveProductPricingSummary(
                      previewProduct,
                      snapshotStatsByProductId[previewProduct.id]
                    );
                    const rowCount = pricing.rows;
                    const quantityMin = toNumber(pricing.quantityMin ?? previewSnapshot?.quantity_min);
                    const quantityMax = toNumber(pricing.quantityMax ?? previewSnapshot?.quantity_max);
                    const priceMin = toNumber(pricing.priceMinDkk ?? previewSnapshot?.price_min_dkk);
                    const priceMax = toNumber(pricing.priceMaxDkk ?? previewSnapshot?.price_max_dkk);
                    return (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Prislinjer</p>
                          <p className="font-medium">{formatNumber(rowCount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Oplag</p>
                          <p className="font-medium">
                            {formatNumber(quantityMin)}-{formatNumber(quantityMax)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pris DKK</p>
                          <p className="font-medium">
                            {formatNumber(priceMin)}-{formatNumber(priceMax)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Kilde</p>
                          <p className="truncate font-medium" title={previewProduct.raw_snapshot_path || ""}>
                            {previewProduct.raw_snapshot_path || "-"}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-medium">Konkret produktvalg</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vælg de dele, du vil importere som draft. Uden valg bruges hele bankproduktet.
                    </p>
                  </div>
                  {previewSelectionActive ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPreviewSelection({})}>
                      Nulstil valg
                    </Button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-4">
                  {getNormalizedAttributeArray(previewProduct.normalized_attributes).map((attribute) => {
                    const attributeKey = attribute.key || getAttributeLabel(attribute);
                    const selectedValue = previewSelection[attributeKey];
                    const values = attribute.values || [];
                    return (
                      <div key={attributeKey}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{getAttributeLabel(attribute)}</p>
                          {selectedValue ? <Badge variant="secondary">{selectedValue}</Badge> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {values.map((value) => {
                            const label = getAttributeValueLabel(value);
                            const isSelected = selectedValue === label || selectedValue === value.key;
                            return (
                              <Button
                                key={`${attributeKey}-${value.key || label}`}
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => {
                                  setPreviewSelection((currentSelection) => {
                                    const nextSelection = { ...currentSelection };
                                    if (isSelected) delete nextSelection[attributeKey];
                                    else nextSelection[attributeKey] = label;
                                    return nextSelection;
                                  });
                                }}
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">
                        {previewSelectionActive ? "Valgt variant" : "Hele bankproduktet"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {previewSelectionActive
                          ? previewSelectionSuffix
                          : "Vælg et eller flere valg ovenfor for at indsnævre importen."}
                      </p>
                    </div>
                    {previewDraftImportLoading ? (
                      <Badge variant="outline">beregner...</Badge>
                    ) : (
                      <Badge variant={previewDraftImportBlockReason ? "destructive" : "outline"}>
                        {formatNumber(previewDraftImport?.rowsPrepared || 0)} prislinjer
                      </Badge>
                    )}
                  </div>
                  {!previewDraftImportLoading && previewDraftImport ? (
                    <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                      <div>
                        <p className="text-muted-foreground">Oplag</p>
                        <p className="font-medium">
                          {formatNumber(toNumber(previewDraftImport.quantityMin))}-{formatNumber(toNumber(previewDraftImport.quantityMax))}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pris DKK</p>
                        <p className="font-medium">
                          {formatNumber(toNumber(previewDraftImport.priceMinDkk))}-{formatNumber(toNumber(previewDraftImport.priceMaxDkk))}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Snapshot</p>
                        <p className="font-medium">
                          {formatNumber(previewDraftImport.rowsAvailableInSnapshot || 0)} total
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {previewDraftImportBlockReason ? (
                    <p className="mt-3 text-xs text-destructive">{previewDraftImportBlockReason}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="font-medium">
                  {previewMatrixUnsupportedReason ? "Importopsætning" : "Attributter"}
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {getNormalizedAttributeArray(previewProduct.normalized_attributes).map((attribute) => (
                    <div key={attribute.key || getAttributeLabel(attribute)} className="rounded-md bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{getAttributeLabel(attribute)}</p>
                        <Badge variant="secondary">{attribute.values?.length || 0}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {(attribute.values || []).slice(0, 8).map(getAttributeValueLabel).join(", ")}
                        {(attribute.values?.length || 0) > 8 ? " ..." : ""}
                      </p>
                    </div>
                  ))}
                  {getNormalizedAttributeArray(previewProduct.normalized_attributes).length === 0 ? (
                    <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                      {previewMatrixUnsupportedReason
                        ? "Dette bankprodukt bruger storformat-data i stedet for Matrix Layout-attributter."
                        : "Dette bankprodukt har ikke Matrix Layout-attributter klar endnu."}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">Prisgrundlag</h3>
                  {previewSnapshot ? (
                    <Badge variant="outline">{formatDate(previewSnapshot.created_at)}</Badge>
                  ) : null}
                </div>
                {previewLoading ? (
                  <p className="mt-3 text-sm text-muted-foreground">Indlæser prisgrundlag...</p>
                ) : !previewPricingHasData ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Ingen priser fundet endnu.
                  </p>
                ) : !previewSnapshot ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Prislinjerne ligger klar i bankens registrerede pricing summary.
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {previewImportBlockReason
                      ? "Prislinjerne ligger i seneste snapshot, men produktet skal løses via den viste næste handling før import."
                      : previewSelectionActive
                        ? "De matchende prislinjer ligger klar i seneste snapshot og importeres som en separat upubliceret draft."
                        : "Prislinjerne ligger klar i seneste snapshot og importeres samlet som et upubliceret Webprinter-produkt."}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2 rounded-md bg-muted/40 p-3 text-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">Prisreview</p>
                    <p className="text-xs text-muted-foreground">
                      {previewDeltaReview
                        ? `Seneste review er ${getDeltaReviewStatusLabel(previewDeltaReview.status)} og blev oprettet ${formatDate(previewDeltaReview.created_at)}.`
                        : "Kræver mindst to gemte snapshots. Review sammenligner kun supplier-bank data."}
                    </p>
                    {previewImportBlockReason ? (
                      <p className="mt-2 text-xs text-destructive">
                        Import blokeret: {previewImportBlockReason}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !previewProduct
                      || !!previewDeltaReview
                      || (snapshotStatsByProductId[previewProduct.id]?.count || 0) < 2
                      || creatingDeltaReviewProductId === previewProduct.id
                    }
                    onClick={() => previewProduct && createPriceDeltaReview(previewProduct)}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${creatingDeltaReviewProductId === previewProduct.id ? "animate-spin" : ""}`} />
                    {previewDeltaReview ? "Review klar" : "Opret prisreview"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {previewImportedProductSlug ? (
              <Button asChild variant="default">
                <a href={adminPathWithCurrentContext(`/admin/product/${previewImportedProductSlug}`)}>
                  <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                  Åbn draft
                </a>
              </Button>
            ) : null}
            <Button
              disabled={!previewProduct || importingDraft || previewDraftImportLoading || !!previewImportedProductSlug || !!previewImportBlockReason || !!previewDraftImportBlockReason}
              onClick={importPreviewProductAsDraft}
              title={previewImportBlockReason || previewDraftImportBlockReason || undefined}
            >
              {previewImportedProductSlug
                ? "Importeret"
                : importingDraft
                  ? "Importerer..."
                  : previewMatrixUnsupportedReason
                    ? "Storformat påkrævet"
                    : previewImportBlockReason || previewDraftImportBlockReason
                      ? "Import blokeret"
                      : previewSelectionActive
                        ? "Importer valgt variant"
                        : "Importer produkt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
