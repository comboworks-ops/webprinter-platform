#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";
import { loadBlueprintFile } from "./product-import/blueprint-schema.js";
import { extractLiTexts } from "./product-import/extractors.js";
import { transformLiTextsToRows } from "./product-import/ul-prices.js";
import {
  ensureDir,
  timestampForFile,
  writeRawSnapshot,
} from "./product-import/snapshot-io.js";
import {
  buildFoldersMatrixConfig,
  createFolderNormalizedRows,
  sortFolderTransformedRows,
} from "./product-import/shared/folders-matrix.js";
import { publishNormalizedMatrixProduct } from "./product-import/shared/matrix-publisher.js";
import { buildTshirtTechnicalSpecs } from "./product-import/tshirt-size-distribution-lock.js";

loadDotenv({ path: ".env", quiet: true });
loadDotenv({ path: ".env.local", quiet: true });

const PRODUCT_FAMILIES = new Set([
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
]);

const SUPPLIER_INTEGRATION_TYPES = new Set(["api", "scrape", "playwright", "manual"]);
const SUPPLIER_SOURCE_STATUSES = new Set(["active", "candidate", "blocked", "internal_excluded"]);
const SUPPLIER_FAMILY_URL_CANDIDATE_STATUSES = new Set([
  "candidate_needs_confirmation",
  "official_candidate_needs_confirmation",
  "confirmed_source_url",
  "rejected",
]);
const DEFAULT_SUPPLIER_SOURCE_REGISTRY = path.join("config", "supplier-bank", "sources.json");
const WMD_FULL_BANK_PRODUCT_KEY = "wmd-folder-bank";
const WMD_FULL_BANK_PRODUCT_NAME = "WIRmachenDRUCK Foldere";
const PIXART_FLAT_BANK_PRODUCT_KEY = "pixart-flat-surface-adhesive";
const PIXART_RIGIDS_BANK_PRODUCT_KEY = "pixart-rigids";
const PRINT_COM_SUPPLIER_SLUG = "print-com";
const SUPPLIER_BANK_DECISION_PHRASES = Object.freeze({
  pixartRigids: Object.freeze({
    approval: "Jeg godkender kun bank-only write for Pixart rigids Plastic+Plexiglass snapshot og draft delta-review. Ingen Webprinter draft, publicering eller live priser.",
    deferral: "Jeg afventer Pixart rigids bank-only write. Behold Plastic-only baseline, og koer ingen bank write, draft-import, publicering eller live priser.",
  }),
  printComPlacemats: Object.freeze({
    approval: "Jeg godkender kun bank-only write for Print.com placemats snapshot for other. Ingen POD v2, produktimport, publicering eller live priser.",
    deferral: "Jeg afventer Print.com placemats bank-only write. Behold placemats som lokal preview, og koer ingen bank write, POD v2, produktimport, publicering eller live priser.",
  }),
});
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const PRINT_COM_ALLOWED_BASE_URLS = new Set([
  "https://api.print.com",
  "https://api.stg.print.com",
  "https://platform.print.com",
]);
const PRINT_COM_FAMILY_KEYWORDS = {
  flyers: ["flyer", "flyers", "leaflet", "leaflets"],
  folders: ["folder", "folders", "brochure", "brochures"],
  business_cards: ["businesscard", "businesscards", "business card", "business cards"],
  letterheads: ["letterhead", "letterheads"],
  tshirts: ["t-shirt", "tshirt", "shirt"],
  packaging: ["packaging", "box", "boxes", "package"],
  other: [],
};
const PRINT_COM_DEFAULT_QUANTITIES = [10, 25, 50, 100, 250, 500, 1000];
const PRINT_COM_MIN_PROBE_QUANTITY = 10;
const PRINT_COM_EUR_TO_DKK = 7.45;
const PRINT_COM_INTERNAL_OPTION_KEYS = new Set(["article_number", "brezo_article"]);
const SUPPLIER_BANK_TSHIRT_FORMAT = Object.freeze({
  label: "Standard",
  widthMm: 300,
  heightMm: 400,
});
const PRINT_COM_PRICE_POLICIES = {
  "flyers-core-a5-130gsm-gloss": {
    supplierProductKey: "flyers",
    productFamily: "flyers",
    label: "Flyers A5 130gsm gloss 4/0",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [10, 50, 100, 250],
    optionOverrides: {
      size: "a5",
      material: "135gr_gesatineerd_mc",
      printtype: 40,
      finish: "geen",
      spot_finish: "none",
      spot_finish_back: "none",
      flexibleprintingmethod: false,
      variable_creasing_line: "none",
      perforation: "none",
      personalize: "none",
      die_cut: "no",
      drillholes: "none",
      rounded_corners: "none",
      pallet_delivery: "none",
      sealed: "none",
      urgency: "standard",
      delivery: "box_max_weight_15_kg",
      standard_bundle: "no",
      cross_bundle: "no",
      printingmethod: "digital",
      box_delivery: 15,
      sheet_size: "not_defined",
      bundle: "bundle_per_100",
    },
  },
  "presentation-folders-a4-1mm-slits-300gsm-gloss": {
    supplierProductKey: "presentation-folders",
    productFamily: "folders",
    label: "Presentation folders A4 1mm spine with slits 300gsm gloss 4/0",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [10, 50, 100, 250],
    optionOverrides: {
      shape: "presentation_folder_basic_1mm_with_slits",
      size: "presentation_folder_basic_1mm",
      material: "300gr_gesatineerd_mc",
      printtype: 40,
      finish: "geen",
      die_cut: "punching",
      businesscard_slits: "with_slits",
      sample: "none",
      printingmethod: "digital",
      urgency: "standard",
    },
  },
  "businesscards-standard-85x55-300gsm-gloss": {
    supplierProductKey: "businesscards",
    productFamily: "business_cards",
    label: "Business cards 85x55 300gsm gloss 4/0",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [25, 50, 100, 250],
    optionOverrides: {
      summary_image: "businesscards",
      fold: "no_fold",
      printtype: 40,
      finish: "geen",
      spot_finish: "none",
      spot_finish_back: "none",
      delivery: "default_businesscard",
      size: "bc",
      material: "300gr_gesatineerd_mc",
      personalize: "none",
      rounded_corners: "none",
      drillholes: "none",
      variable_creasing_line: "none",
      die_cut: "no",
      perforation: "none",
      urgency: "standard",
      printingmethod: "digital",
      sheet_size: "not_defined",
      bundle: "bundle_per_50",
    },
  },
  "letterheads-a4-90gsm-4-0": {
    supplierProductKey: "printed-letterheads",
    productFamily: "letterheads",
    label: "Letterheads A4 90gsm 4/0",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [100, 150, 200, 250],
    optionOverrides: {
      size: "a4",
      printtype: 40,
      material: "90gr_hv_bankpost",
      flexibleprintingmethod: false,
      perforation: "none",
      drillholes: "one_drillhole",
      rounded_corners: "3,5_mm_radius",
      sealed: "none",
      personalize: "personalize_from_excel",
      delivery: "box_max_weight_15_kg",
      urgency: "standard",
      printingmethod: "digital",
      standard_bundle: "no",
      bundle: "bundle_per_100",
    },
  },
  "businesscard-boxes-90x60x60-unprinted": {
    supplierProductKey: "businesscard-boxes",
    productFamily: "packaging",
    label: "Business card boxes 90x60x60 unprinted",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [10, 25, 50],
    optionOverrides: {
      summary_image: "businesscard-boxes",
      product_size: "90_x_60_x_60_mm",
      printtype: "00",
      material: "300gr_duplex_white",
      urgency: "standard",
      size: "150_x_135_mm",
      printingmethod: "raw_material",
      stock_item: "svisitkaartkarton",
    },
  },
  "tshirt-basic-7-front-transfer-black-s": {
    supplierProductKey: "t-shirt-basic-7",
    productFamily: "tshirts",
    label: "Russell Classic T-shirt black S front transfer",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [10, 25, 50, 100],
    optionOmitKeys: [
      "positions_back",
      "positions_chest",
      "positions_chest_right",
      "positions_sleeve_left",
      "positions_sleeve_right",
    ],
    optionOverrides: {
      "summary_image:color_textile": "black_tshirt_russell_authentic",
      brand_name: "russell_classic_tee",
      material: "210gr_cotton",
      fitting: "regular",
      positions_front: "transfer",
      color_textile: "black_tshirt_russell_authentic",
      textile_sizes: "unisex_s",
      color: "textile_black",
      printtype: "variable",
      printingmethod: "heat_transfer",
      urgency: "standard",
      quality_level: "basic",
      size: "t_shirt_nul_price",
      product_weight: "200gr",
      individually_sealed: "no",
    },
  },
  "placemats-a4-landscape-135gsm-coated-4-0": {
    supplierProductKey: "placemats",
    productFamily: "other",
    label: "Placemats A4 landscape 135gsm coated 4/0",
    region: "DK",
    currency: "DKK",
    deliveryPromise: 0,
    quantities: [10, 25, 50, 100],
    optionOverrides: {
      summary_image: "placemats",
      printtype: 40,
      material: "135gr_gesatineerd_mc",
      finish: "geen",
      flexibleprintingmethod: false,
      size: "a4_landscape",
      printingmethod: "digital",
      urgency: "standard",
      standard_bundle: "no",
      box_delivery: 15,
      drillholes: "one_drillhole",
      rounded_corners: "none",
    },
  },
};
const PRINT_COM_DRAFT_ANCHOR_OPTION_KEYS = new Set(["material", "size", "printtype", "finish"]);
const PIXART_PROFILES = new Set(["flat-surface-adhesive", "rigids"]);
const PIXART_EXTRACTOR_PROFILES = new Set(["flat-surface-adhesive", "rigids"]);
const PIXART_SUPPLIER_BANK_NORMALIZER_PROFILES = new Set(["flat-surface-adhesive", "rigids"]);
const PIXART_IMPORT_PREFIX_BY_PROFILE = {
  "flat-surface-adhesive": "pixart-flat-surface-adhesive-",
  rigids: "pixart-rigids-",
};
const DELTA_REVIEW_STATUSES = new Set(["draft", "reviewed", "accepted", "rejected"]);
const DEFAULT_SUPABASE_TIMEOUT_MS = 30000;
const DEFAULT_CLI_TIMEOUT_MS = 120000;
const SUPPLIER_BANK_REPORT_INDEX_LATEST_PATH = "docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md";
const SUPPLIER_BANK_STATUS_REPORT_LATEST_PATH = "docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md";
const SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST_PATH = "docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md";
const SUPPLIER_BANK_GATE_ROADMAP_LATEST_PATH = "docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md";
const SUPPLIER_BANK_APPROVAL_PACKET_LATEST_PATH = "docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md";
const SUPPLIER_BANK_DECISION_QUEUE_LATEST_PATH = "docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md";
const SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST_PATH = "docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST.md";
const SUPPLIER_BANK_COMPLETION_AUDIT_LATEST_PATH = "docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md";
const SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST_PATH = "docs/SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST.md";
const SUPPLIER_BANK_EXPANSION_PACKET_LATEST_PATH = "docs/SUPPLIER_BANK_EXPANSION_PACKET_LATEST.md";
const SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST_PATH = "docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST.md";
const SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST_PATH = "docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md";
const SUPPLIER_BANK_PIXART_READINESS_LATEST_PATH = "docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md";
const SUPPLIER_BANK_URL_CANDIDATES_LATEST_PATH = "docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md";
const SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST_PATH = "docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md";
const PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST_PATH = "docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md";
const SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST_PATH = "docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md";
const SUPPLIER_BANK_STABLE_LATEST_REPORT_PATHS = {
  reportIndex: SUPPLIER_BANK_REPORT_INDEX_LATEST_PATH,
  statusReport: SUPPLIER_BANK_STATUS_REPORT_LATEST_PATH,
  goalSnapshot: SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST_PATH,
  gateRoadmap: SUPPLIER_BANK_GATE_ROADMAP_LATEST_PATH,
  completionAudit: SUPPLIER_BANK_COMPLETION_AUDIT_LATEST_PATH,
  approvalPacket: SUPPLIER_BANK_APPROVAL_PACKET_LATEST_PATH,
  decisionQueue: SUPPLIER_BANK_DECISION_QUEUE_LATEST_PATH,
  executiveSummary: SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST_PATH,
  expansionPacket: SUPPLIER_BANK_EXPANSION_PACKET_LATEST_PATH,
  coverageGapPlan: SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST_PATH,
  importedDraftQa: SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST_PATH,
  pixartAdapterPlan: SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST_PATH,
  pixartReadiness: SUPPLIER_BANK_PIXART_READINESS_LATEST_PATH,
  urlCandidates: SUPPLIER_BANK_URL_CANDIDATES_LATEST_PATH,
  urlConfirmationChecklist: SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST_PATH,
  pixartRigidsPreflight: PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST_PATH,
  printComPlacematsPreflight: SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST_PATH,
};

function usage() {
  return [
    "Usage:",
    "  node scripts/supplier-bank-cli.mjs doctor",
    "  node scripts/supplier-bank-cli.mjs validate-supplier-sources [--path <sources.json>]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-url-candidate-report [--path <sources.json>] [--supplier <slug>] [--family <family>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-url-confirmation-checklist [--path <sources.json>] [--supplier <slug>] [--family <family>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs seed-supplier-sources [--path <sources.json>] [--write-bank]",
    "  node scripts/supplier-bank-cli.mjs verify-supplier-sources [--path <sources.json>]",
    "  node scripts/supplier-bank-cli.mjs smoke-wmd-bank-pilot [--limit <number>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs preflight-wmd-bank-pilot [--limit <number>]",
    "  node scripts/supplier-bank-cli.mjs apply-wmd-bank [--confirm-remote-write] [--skip-migration-apply] [--skip-function-deploy]",
    "  node scripts/supplier-bank-cli.mjs refresh-wmd-bank [--confirm-bank-write] [--from-clean-csv <path>] [--max-detail-pages <number>]",
    "  node scripts/supplier-bank-cli.mjs process-refresh-queue [--job-id <uuid>] [--limit <number>] [--confirm-process] [--from-clean-csv <path>]",
    "  node scripts/supplier-bank-cli.mjs pixart-bank-first-slice [--profile flat-surface-adhesive|rigids] [--url <pixart-url>] [--materials <csv>] [--laminations <csv>] [--headful|--headless] [--require-valid-rows]",
    "  node scripts/supplier-bank-cli.mjs normalize-pixart-extraction-preview <raw-extraction.json> [--profile flat-surface-adhesive|rigids]",
    "  node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot <preview.json> [--write-bank]",
    "  node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline [--safe-preview <preview.json>] [--rejected-preview <preview.json>] [--write-bank] [--write-delta-review]",
    "  node scripts/supplier-bank-cli.mjs preview-pixart-storformat-import [--tenant <uuid>] [--product-name <name>] [--product-slug <slug>] [--write-draft-product]",
    "  node scripts/supplier-bank-cli.mjs preview-pixart-rigids-storformat-import [--tenant <uuid>] [--product-prefix <name>] [--product-slug-prefix <slug>] [--categories <csv>]",
    "  node scripts/supplier-bank-cli.mjs review-pixart-rigids-storformat-preview [--preview <preview.json>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs review-pixart-rigids-bank-candidate [candidate-preview.json] [--baseline <baseline-preview.json>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs review-pixart-rigids-candidate-packet [candidate-preview.json] [--baseline <baseline-preview.json>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs preflight-pixart-rigids-bank-write [candidate-preview.json] [--baseline <baseline-preview.json>] [--packet <packet.md>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs review-wmd-refresh",
    "  node scripts/supplier-bank-cli.mjs review-pixart-refresh",
    "  node scripts/supplier-bank-cli.mjs review-import-eligibility [--limit <number>] [--include-archived]",
    "  node scripts/supplier-bank-cli.mjs review-imported-drafts [--limit <number>] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs review-source-coverage [--path <sources.json>] [--include-archived]",
    "  node scripts/supplier-bank-cli.mjs plan-next-expansion [--path <sources.json>] [--include-archived]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-status-report [--path <sources.json>] [--limit <number>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-decision-queue [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-approval-packet [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-expansion-packet [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-gate-roadmap [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-executive-summary [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-completion-audit [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-goal-snapshot [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-report-index [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-coverage-gap-plan [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-pixart-adapter-plan [--family <family>] [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-pixart-readiness-report [--family <family>] [--path <sources.json>] [--include-archived] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs plan-print-com-bank-slice [--family <family>] [--path <sources.json>]",
    "  node scripts/supplier-bank-cli.mjs print-com-bank-first-slice [--family <family>] [--limit <number>] [--details-limit <number>]",
    "  node scripts/supplier-bank-cli.mjs print-com-bank-price-preview [--policy <policy-key>] [--family <family>] [--sku <sku>] [--quantity-limit <number>] [--currency <code>] [--region <code>]",
    "  node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot <price-preview.json> [--write-bank] [--allow-preview-bank-write]",
    "  node scripts/supplier-bank-cli.mjs preflight-print-com-placemats-bank-write [preview.json] [--write-report]",
    "  node scripts/supplier-bank-cli.mjs approve-bank-product --supplier-slug <slug> --product-key <key> [--confirm-status-update]",
    "  node scripts/supplier-bank-cli.mjs preview-bank-draft-import --supplier-slug <slug> --product-key <key> [--tenant <uuid>] [--name <draft product name>] [--slug <draft-product-slug>] [--write-draft-product]",
    "  node scripts/supplier-bank-cli.mjs update-delta-review-status (--review-id <uuid>|--latest-wmd|--latest-pixart) --status <reviewed|accepted|rejected> [--confirm-status-update]",
    "  node scripts/supplier-bank-cli.mjs verify-wmd-bank [--supplier-slug <slug>]",
    "  node scripts/supplier-bank-cli.mjs apply-wmd-bank-pilot [--confirm-remote-write] [--skip-migration-apply] [--skip-function-deploy]",
    "  node scripts/supplier-bank-cli.mjs verify-wmd-bank-pilot [--supplier-slug <slug>] [--product-key <key>]",
    "  node scripts/supplier-bank-cli.mjs ingest-blueprint <blueprint.yml> \\",
    "    --supplier-slug <slug> --supplier-name <name> --product-family <family> [options]",
    "  node scripts/supplier-bank-cli.mjs import-normalized-snapshot <snapshot.json> \\",
    "    --tenant <uuid> --name <draft product name> --slug <draft-product-slug> [--write-draft-product]",
    "  node scripts/supplier-bank-cli.mjs compare-normalized-snapshots <old.json> <new.json> \\",
    "    [--threshold-pct <number>] [--limit <number>]",
    "",
    "Options:",
    "  --supplier-website <url>      Supplier website URL",
    "  --supplier-country <code>     Country code, default: DE",
    "  --supplier-currency <code>    Currency, default: EUR",
    "  --integration-type <type>     api|scrape|playwright|manual, default: scrape",
    "  --write-bank                  Write supplier/product/snapshot rows to Supabase",
    "  --write-draft-product         Create an unpublished draft product from a reviewed bank snapshot",
    "  --write-delta-review          Store a snapshot comparison in supplier_bank_price_delta_reviews",
    "  --threshold-pct <number>      Only list price changes at or above this percent, default: 0",
    "  --limit <number>              Max changed rows to print, default: 12",
    "  --notes <text>                Optional note stored with a delta review",
    "  --no-extract                  Build shape only from blueprint, with zero price rows",
    "",
    "Examples:",
    "  node scripts/supplier-bank-cli.mjs doctor",
    "  node scripts/supplier-bank-cli.mjs validate-supplier-sources",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-url-candidate-report --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-url-confirmation-checklist --supplier pixartprinting --write-report",
    "  node scripts/supplier-bank-cli.mjs seed-supplier-sources",
    "  node scripts/supplier-bank-cli.mjs verify-supplier-sources",
    "  node scripts/supplier-bank-cli.mjs smoke-wmd-bank-pilot",
    "  node scripts/supplier-bank-cli.mjs preflight-wmd-bank-pilot",
    "  node scripts/supplier-bank-cli.mjs apply-wmd-bank",
    "  node scripts/supplier-bank-cli.mjs apply-wmd-bank --confirm-remote-write",
    "  node scripts/supplier-bank-cli.mjs refresh-wmd-bank",
    "  node scripts/supplier-bank-cli.mjs refresh-wmd-bank --confirm-bank-write",
    "  node scripts/supplier-bank-cli.mjs process-refresh-queue",
    "  node scripts/supplier-bank-cli.mjs pixart-bank-first-slice",
    "  node scripts/supplier-bank-cli.mjs normalize-pixart-extraction-preview pricing_raw/pixart-rigids-<timestamp>.json --profile rigids",
    "  node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-010323.json",
    "  node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline",
    "  node scripts/supplier-bank-cli.mjs preview-pixart-storformat-import",
    "  node scripts/supplier-bank-cli.mjs preview-pixart-rigids-storformat-import",
    "  node scripts/supplier-bank-cli.mjs review-pixart-rigids-storformat-preview",
    "  node scripts/supplier-bank-cli.mjs review-pixart-rigids-bank-candidate --write-report",
    "  node scripts/supplier-bank-cli.mjs review-pixart-rigids-candidate-packet --write-report",
    "  node scripts/supplier-bank-cli.mjs preflight-pixart-rigids-bank-write",
    "  node scripts/supplier-bank-cli.mjs review-wmd-refresh",
    "  node scripts/supplier-bank-cli.mjs review-pixart-refresh",
    "  node scripts/supplier-bank-cli.mjs review-import-eligibility",
    "  node scripts/supplier-bank-cli.mjs review-import-eligibility --include-archived",
    "  node scripts/supplier-bank-cli.mjs review-imported-drafts --write-report",
    "  node scripts/supplier-bank-cli.mjs review-source-coverage",
    "  node scripts/supplier-bank-cli.mjs plan-next-expansion",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-status-report --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-decision-queue --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-approval-packet --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-expansion-packet --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-gate-roadmap --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-executive-summary --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-completion-audit --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-goal-snapshot --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-report-index --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-coverage-gap-plan --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-pixart-adapter-plan --write-report",
    "  node scripts/supplier-bank-cli.mjs supplier-bank-pixart-readiness-report --write-report",
    "  node scripts/supplier-bank-cli.mjs plan-print-com-bank-slice",
    "  node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family flyers",
    "  node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy flyers-core-a5-130gsm-gloss",
    "  node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy presentation-folders-a4-1mm-slits-300gsm-gloss",
    "  node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot pricing_raw/supplier-bank-normalized/print-com/flyers/prices/<preview.json>",
    "  node scripts/supplier-bank-cli.mjs preflight-print-com-placemats-bank-write --write-report",
    "  node scripts/supplier-bank-cli.mjs approve-bank-product --supplier-slug pixartprinting --product-key pixart-flat-surface-adhesive",
    "  node scripts/supplier-bank-cli.mjs preview-bank-draft-import --supplier-slug print-com --product-key flyers",
    "  node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status reviewed",
    "  node scripts/supplier-bank-cli.mjs verify-wmd-bank",
    "  node scripts/supplier-bank-cli.mjs ingest-blueprint blueprints/fetch-master-webprinter.yml --supplier-slug wir-machen-druck --supplier-name WIRmachenDRUCK --product-family flyers",
    "  node scripts/supplier-bank-cli.mjs import-normalized-snapshot pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-125441.json --tenant 00000000-0000-0000-0000-000000000000 --name \"WMD Folder Draft\" --slug wmd-folder-draft",
    "  node scripts/supplier-bank-cli.mjs compare-normalized-snapshots pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-124922.json pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-125441.json",
  ].join("\n");
}

function parseArgs(args) {
  const result = {
    flags: new Set(),
    values: {},
    positionals: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      result.positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      result.flags.add(key);
      continue;
    }

    result.values[key] = next;
    index += 1;
  }

  return result;
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) throw new Error(`Missing --${key}`);
  return value;
}

function quoteShellArg(value) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function fileExists(relativePath) {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function findFiles(relativeDir, predicate) {
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];

  const results = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        return;
      }
      const relativePath = path.relative(process.cwd(), entryPath);
      if (!predicate || predicate(relativePath)) results.push(relativePath);
    });
  };

  walk(absoluteDir);
  return results.sort();
}

function resolveLocalNodeBinary() {
  const localPath = "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node";
  return fs.existsSync(localPath) ? localPath : process.execPath;
}

function resolveDenoBinary() {
  const homeDeno = path.join(process.env.HOME || "", ".deno", "bin", "deno");
  if (homeDeno && fs.existsSync(homeDeno)) return homeDeno;
  if (process.env.DENO_BIN && fs.existsSync(process.env.DENO_BIN)) return process.env.DENO_BIN;
  const pathMatch = process.env.PATH?.split(path.delimiter).find((dir) => fs.existsSync(path.join(dir, "deno")));
  return pathMatch ? path.join(pathMatch, "deno") : null;
}

function formatDoctorStatus(ok) {
  return ok ? "OK" : "MISSING";
}

function addDoctorCheck(checks, label, ok, detail, required = true) {
  checks.push({ label, ok, detail, required });
}

function findLatestWmdCleanCsv(productSlug = "wmd-folder-bank-pilot") {
  const cleanCsvs = findFiles(
    path.join("pricing_clean", productSlug),
    (filePath) => filePath.endsWith(".csv")
  );
  return cleanCsvs[cleanCsvs.length - 1] || null;
}

function runCommand(command, args, label) {
  console.log("");
  console.log(`> ${[command, ...args].join(" ")}`);
  const nodeDir = path.dirname(resolveLocalNodeBinary());
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${nodeDir}${path.delimiter}${process.env.PATH || ""}`,
    },
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label || command} failed with exit code ${result.status}`);
  }
}

function runCommandCapture(command, args, label) {
  console.log("");
  console.log(`> ${[command, ...args].join(" ")}`);
  const nodeDir = path.dirname(resolveLocalNodeBinary());
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${nodeDir}${path.delimiter}${process.env.PATH || ""}`,
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label || command} failed with exit code ${result.status}`);
  }

  return `${result.stdout || ""}${result.stderr || ""}`;
}

function runCommandWithRetry(command, args, label, attempts = 2) {
  let lastError = null;
  const totalAttempts = Math.max(1, Math.floor(attempts));

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      runCommand(command, args, attempt === 1 ? label : `${label} retry ${attempt}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= totalAttempts) break;
      console.log("");
      console.log(`${label || command} failed on attempt ${attempt}; retrying once with a fresh browser session.`);
    }
  }

  throw lastError;
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url, serviceRoleKey };
}

function getSupabaseTimeoutMs() {
  const configured = Number(process.env.SUPPLIER_BANK_SUPABASE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SUPABASE_TIMEOUT_MS;
}

function getCliTimeoutMs() {
  const configured = Number(process.env.SUPPLIER_BANK_CLI_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CLI_TIMEOUT_MS;
}

function installCliTimeout() {
  const timeoutMs = getCliTimeoutMs();
  const timer = setTimeout(() => {
    console.error(
      `Error: supplier-bank CLI timed out after ${timeoutMs}ms. Set SUPPLIER_BANK_CLI_TIMEOUT_MS to adjust.`
    );
    process.exit(124);
  }, timeoutMs);
  timer.unref?.();
}

function createSupabaseFetchWithTimeout() {
  return async (input, init = {}) => {
    const timeoutMs = getSupabaseTimeoutMs();
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    let upstreamAborted = false;

    const abortFromUpstream = () => {
      upstreamAborted = true;
      controller.abort(upstreamSignal?.reason);
    };

    if (upstreamSignal?.aborted) {
      abortFromUpstream();
    } else if (upstreamSignal) {
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }

    const timer = setTimeout(() => {
      controller.abort(new Error(`Supabase request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (!upstreamAborted && controller.signal.aborted) {
        throw new Error(
          `Supabase request timed out after ${timeoutMs}ms. Set SUPPLIER_BANK_SUPABASE_TIMEOUT_MS to adjust.`
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener("abort", abortFromUpstream);
      }
    }
  };
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function finiteNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function summarizePrices(rows) {
  const quantities = rows.map((row) => Number(row.quantity)).filter(Number.isFinite);
  const prices = rows.map((row) => Number(row.dkk_final)).filter(Number.isFinite);

  return {
    rows: rows.length,
    quantity_min: quantities.length ? Math.min(...quantities) : null,
    quantity_max: quantities.length ? Math.max(...quantities) : null,
    price_min_dkk: prices.length ? Math.min(...prices) : null,
    price_max_dkk: prices.length ? Math.max(...prices) : null,
  };
}

function buildNormalizedAttributes(blueprint) {
  const format = blueprint.matrix.format;
  const material = blueprint.matrix.material;

  return [
    {
      key: "format",
      labelDa: format.group_name || "Format",
      labelOriginal: format.group_name || "Format",
      values: [
        {
          key: format.value_name,
          labelDa: format.value_name,
          labelOriginal: format.value_name,
          widthMm: format.width_mm ?? null,
          heightMm: format.height_mm ?? null,
          metadata: {},
        },
      ],
    },
    {
      key: "material",
      labelDa: material.group_name || "Materiale",
      labelOriginal: material.group_name || "Material",
      values: [
        {
          key: material.value_name,
          labelDa: material.value_name,
          labelOriginal: material.value_name,
          metadata: {},
        },
      ],
    },
  ];
}

function buildNormalizedPriceRows({ blueprint, rows }) {
  return rows.map((row) => ({
    quantity: row.quantity,
    supplierCurrency: "EUR",
    supplierPrice: row.eur,
    convertedPriceDkk: row.dkk_base,
    proposedPriceDkk: row.dkk_final,
    conversionRuleKey: `blueprint_ul_fx_${blueprint.pricing_import.eur_to_dkk}`,
    selections: {
      format: blueprint.matrix.format.value_name,
      material: blueprint.matrix.material.value_name,
    },
    metadata: {
      sourceIndex: row.source_index,
      sourceLiText: row.li_text,
      tierMultiplier: row.tier_multiplier,
    },
  }));
}

function loadJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  return {
    path: resolved,
    json: JSON.parse(fs.readFileSync(resolved, "utf8")),
  };
}

function normalizeHostname(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\.$/, "");
}

function hostnameFromUrl(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return null;

  try {
    const url = new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`);
    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

function hostnameMatchesInternal(hostname, internalDomains) {
  const normalized = normalizeHostname(hostname);
  return internalDomains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getRegistryInternalDomains(registry) {
  return uniqueValues(
    (Array.isArray(registry.excludedInternalSystems) ? registry.excludedInternalSystems : [])
      .flatMap((entry) => Array.isArray(entry.domains) ? entry.domains : [])
      .map(normalizeHostname)
  );
}

function getSelection(row, key, labelKey) {
  return normalizeText(row?.selections?.[key])
    || normalizeText(row?.labels?.[labelKey])
    || normalizeText(row?.labels?.[key]);
}

function getSnapshotRows(snapshot) {
  if (Array.isArray(snapshot?.normalizedPriceRows)) return snapshot.normalizedPriceRows;
  if (Array.isArray(snapshot?.normalized_rows)) return snapshot.normalized_rows;
  if (Array.isArray(snapshot?.normalized_price_rows)) return snapshot.normalized_price_rows;
  return [];
}

function getSnapshotSupplierSlug(snapshot) {
  return normalizeText(snapshot?.supplierSlug)
    || normalizeText(snapshot?.supplier_slug)
    || normalizeText(snapshot?.supplier?.slug)
    || null;
}

function getSnapshotSupplierProductKey(snapshot) {
  return normalizeText(snapshot?.supplierProductKey)
    || normalizeText(snapshot?.supplier_product_key)
    || normalizeText(snapshot?.bank_product?.supplier_product_key)
    || null;
}

function getSnapshotProductFamily(snapshot) {
  return normalizeText(snapshot?.productFamily)
    || normalizeText(snapshot?.product_family)
    || normalizeText(snapshot?.bank_product?.product_family)
    || null;
}

function getNormalizedPrice(row) {
  return finiteNumberOrNull(
    row?.finalPriceDkk
    ?? row?.proposedPriceDkk
    ?? row?.final_price_dkk
    ?? row?.proposed_price_dkk
    ?? row?.price_dkk
  );
}

function getComparableRowKey(row) {
  const explicitRowKey = normalizeText(row?.sourceIdentifiers?.rowKey)
    || normalizeText(row?.source_identifiers?.row_key)
    || normalizeText(row?.supplier_row_key);
  if (explicitRowKey) return explicitRowKey;

  const selectionEntries = Object.entries(row?.selections || {})
    .filter(([, value]) => normalizeText(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${normalizeText(value)}`);

  return [
    normalizeText(row?.sourceKey || row?.source_key),
    ...selectionEntries,
    normalizeText(row?.material_original || row?.material_da),
    normalizeText(row?.finish_original || row?.finish_da),
    Number.isFinite(Number(row?.area_m2)) ? `area_m2:${Number(row.area_m2)}` : null,
    Number.isFinite(Number(row?.width_cm)) ? `width_cm:${Number(row.width_cm)}` : null,
    Number.isFinite(Number(row?.height_cm)) ? `height_cm:${Number(row.height_cm)}` : null,
    `quantity:${Number(row?.quantity || 0)}`,
  ].filter(Boolean).join("||");
}

function getComparableRowSelections(row) {
  if (row?.selections && typeof row.selections === "object") return row.selections;
  const selections = {};
  if (row?.material_original || row?.material_da) selections.material = row.material_da || row.material_original;
  if (row?.finish_original || row?.finish_da) selections.finish = row.finish_da || row.finish_original;
  if (Number.isFinite(Number(row?.area_m2))) selections.area_m2 = Number(row.area_m2);
  if (Number.isFinite(Number(row?.width_cm))) selections.width_cm = Number(row.width_cm);
  if (Number.isFinite(Number(row?.height_cm))) selections.height_cm = Number(row.height_cm);
  return Object.keys(selections).length > 0 ? selections : null;
}

function describeComparableRow(row) {
  const selections = row?.selections || row?.labels || {};
  const parts = [
    selections.format,
    selections.material,
    selections.surface,
    selections.fold,
    selections.pages,
    selections.orientation,
    row?.material_da || row?.material_original,
    row?.finish_da || row?.finish_original,
    Number.isFinite(Number(row?.area_m2)) ? `${Number(row.area_m2)} m2` : null,
    Number.isFinite(Number(row?.width_cm)) && Number.isFinite(Number(row?.height_cm))
      ? `${Number(row.width_cm)}x${Number(row.height_cm)} cm`
      : null,
    `qty ${row?.quantity}`,
  ].map(normalizeText).filter(Boolean);
  return parts.join(" / ") || getComparableRowKey(row);
}

function indexNormalizedPriceRows(rows) {
  const indexed = new Map();
  const duplicates = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = getComparableRowKey(row);
    if (!key) return;
    if (indexed.has(key)) {
      duplicates.push(key);
    }
    indexed.set(key, row);
  });

  return { indexed, duplicates };
}

function compareNormalizedSnapshots({ oldSnapshot, newSnapshot, thresholdPct = 0 }) {
  const oldRows = indexNormalizedPriceRows(getSnapshotRows(oldSnapshot));
  const newRows = indexNormalizedPriceRows(getSnapshotRows(newSnapshot));
  const keys = new Set([...oldRows.indexed.keys(), ...newRows.indexed.keys()]);
  const changes = [];
  const added = [];
  const removed = [];
  let unchanged = 0;

  keys.forEach((key) => {
    const before = oldRows.indexed.get(key);
    const after = newRows.indexed.get(key);

    if (!before && after) {
      added.push({ key, row: after });
      return;
    }

    if (before && !after) {
      removed.push({ key, row: before });
      return;
    }

    const beforePrice = getNormalizedPrice(before);
    const afterPrice = getNormalizedPrice(after);
    if (!Number.isFinite(beforePrice) || !Number.isFinite(afterPrice)) return;

    const delta = afterPrice - beforePrice;
    const percent = beforePrice === 0 ? null : (delta / beforePrice) * 100;
    const absPercent = Math.abs(percent ?? 0);

    if (delta === 0 || absPercent < thresholdPct) {
      unchanged += 1;
      return;
    }

    changes.push({
      key,
      row: after,
      beforePrice,
      afterPrice,
      delta,
      percent,
    });
  });

  changes.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  return {
    oldRows: oldRows.indexed.size,
    newRows: newRows.indexed.size,
    duplicateOldKeys: oldRows.duplicates.length,
    duplicateNewKeys: newRows.duplicates.length,
    changed: changes,
    added,
    removed,
    unchanged,
  };
}

function compactDeltaRow(change) {
  return {
    key: change.key,
    label: describeComparableRow(change.row),
    quantity: finiteNumberOrNull(change.row?.quantity),
    beforePriceDkk: finiteNumberOrNull(change.beforePrice),
    afterPriceDkk: finiteNumberOrNull(change.afterPrice),
    deltaDkk: finiteNumberOrNull(change.delta),
    deltaPct: change.percent == null ? null : Number(change.percent.toFixed(4)),
    selections: getComparableRowSelections(change.row),
  };
}

function compactAddedRemovedRow(item) {
  return {
    key: item.key,
    label: describeComparableRow(item.row),
    quantity: finiteNumberOrNull(item.row?.quantity),
    priceDkk: getNormalizedPrice(item.row),
    selections: getComparableRowSelections(item.row),
  };
}

function buildDeltaReviewRecord({
  oldSnapshot,
  newSnapshot,
  oldPath,
  newPath,
  thresholdPct,
  result,
  notes = null,
}) {
  const changedCount = result.changed.length;
  const increasedCount = result.changed.filter((change) => change.delta > 0).length;
  const decreasedCount = result.changed.filter((change) => change.delta < 0).length;
  const totalDelta = result.changed.reduce((sum, change) => sum + change.delta, 0);

  return {
    supplier_product_key: getSnapshotSupplierProductKey(newSnapshot) || getSnapshotSupplierProductKey(oldSnapshot),
    product_family: getSnapshotProductFamily(newSnapshot) || getSnapshotProductFamily(oldSnapshot),
    old_snapshot_path: oldPath,
    new_snapshot_path: newPath,
    threshold_pct: thresholdPct,
    status: "draft",
    change_summary: {
      supplierSlug: getSnapshotSupplierSlug(newSnapshot) || getSnapshotSupplierSlug(oldSnapshot),
      oldRows: result.oldRows,
      newRows: result.newRows,
      changedRows: changedCount,
      increasedRows: increasedCount,
      decreasedRows: decreasedCount,
      addedRows: result.added.length,
      removedRows: result.removed.length,
      unchangedRows: result.unchanged,
      duplicateOldKeys: result.duplicateOldKeys,
      duplicateNewKeys: result.duplicateNewKeys,
      netChangedRowDeltaDkk: Number(totalDelta.toFixed(2)),
    },
    changed_rows: result.changed.map(compactDeltaRow),
    added_rows: result.added.map(compactAddedRemovedRow),
    removed_rows: result.removed.map(compactAddedRemovedRow),
    notes,
  };
}

function normalizeSnapshotPathForCompare(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return path.resolve(normalized);
}

function findSnapshotIdByNormalizedPath(snapshots, snapshotPath) {
  const comparablePath = normalizeSnapshotPathForCompare(snapshotPath);
  if (!comparablePath) return null;

  const match = (Array.isArray(snapshots) ? snapshots : []).find((snapshot) => {
    const metadataPaths = [
      snapshot?.metadata?.normalizedSnapshotPath,
      snapshot?.metadata?.previewSnapshotPath,
      snapshot?.metadata?.sourceSnapshotPath,
      snapshot?.metadata?.rawSnapshotPath,
    ];
    return metadataPaths.some((metadataPath) => normalizeSnapshotPathForCompare(metadataPath) === comparablePath);
  });

  return match?.id || null;
}

async function writeDeltaReviewRecord({ oldSnapshot, newSnapshot, oldPath, newPath, thresholdPct, result, notes }) {
  const client = getSupabaseServiceClient();
  const supplierSlug = getSnapshotSupplierSlug(newSnapshot) || getSnapshotSupplierSlug(oldSnapshot);
  const supplierProductKey = getSnapshotSupplierProductKey(newSnapshot) || getSnapshotSupplierProductKey(oldSnapshot);
  const record = buildDeltaReviewRecord({
    oldSnapshot,
    newSnapshot,
    oldPath,
    newPath,
    thresholdPct,
    result,
    notes,
  });

  let supplierId = null;
  let bankProductId = null;
  let oldPriceSnapshotId = null;
  let newPriceSnapshotId = null;

  if (supplierSlug) {
    const { data: supplier, error: supplierError } = await client
      .from("supplier_bank_suppliers")
      .select("id")
      .eq("slug", supplierSlug)
      .maybeSingle();

    if (supplierError) throw supplierError;
    supplierId = supplier?.id || null;
  }

  if (supplierId && supplierProductKey) {
    const { data: bankProduct, error: productError } = await client
      .from("supplier_bank_products")
      .select("id")
      .eq("supplier_id", supplierId)
      .eq("supplier_product_key", supplierProductKey)
      .maybeSingle();

    if (productError) throw productError;
    bankProductId = bankProduct?.id || null;
  }

  if (bankProductId) {
    const { data: remoteSnapshots, error: snapshotsError } = await client
      .from("supplier_bank_price_snapshots")
      .select("id,metadata")
      .eq("bank_product_id", bankProductId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (snapshotsError) throw snapshotsError;
    oldPriceSnapshotId = findSnapshotIdByNormalizedPath(remoteSnapshots, oldPath);
    newPriceSnapshotId = findSnapshotIdByNormalizedPath(remoteSnapshots, newPath);
  }

  if (bankProductId && oldPriceSnapshotId && newPriceSnapshotId) {
    const { data: existingReview, error: existingError } = await client
      .from("supplier_bank_price_delta_reviews")
      .select("id,status")
      .eq("bank_product_id", bankProductId)
      .eq("old_price_snapshot_id", oldPriceSnapshotId)
      .eq("new_price_snapshot_id", newPriceSnapshotId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingReview) {
      return {
        id: existingReview.id,
        supplierId,
        bankProductId,
        oldPriceSnapshotId,
        newPriceSnapshotId,
        alreadyExisted: true,
      };
    }
  }

  const { data, error } = await client
    .from("supplier_bank_price_delta_reviews")
    .insert({
      ...record,
      supplier_id: supplierId,
      bank_product_id: bankProductId,
      old_price_snapshot_id: oldPriceSnapshotId,
      new_price_snapshot_id: newPriceSnapshotId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, supplierId, bankProductId, oldPriceSnapshotId, newPriceSnapshotId, alreadyExisted: false };
}

function normalizedFolderRowsToTransformedRows(rows) {
  return sortFolderTransformedRows(
    (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const selections = row?.selections || {};
        const labels = row?.labels || {};
        const formatLabel = getSelection(row, "format", "formatLabel");
        const materialLabel = getSelection(row, "material", "materialLabel");
        const surfaceLabel = getSelection(row, "surface", "surfaceLabel");
        const foldLabel = getSelection(row, "fold", "foldLabel");
        const pagesLabel = getSelection(row, "pages", "pagesLabel");
        const orientationLabel = getSelection(row, "orientation", "orientationLabel");
        const quantity = Number(row?.quantity);
        const dkkFinal = finiteNumberOrNull(row?.finalPriceDkk ?? row?.proposedPriceDkk);

        if (
          !formatLabel
          || !materialLabel
          || !surfaceLabel
          || !foldLabel
          || !pagesLabel
          || !orientationLabel
          || !Number.isFinite(quantity)
          || !Number.isFinite(dkkFinal)
        ) {
          return null;
        }

        return {
          foldLabel,
          pagesLabel,
          orientationLabel,
          formatLabel,
          materialLabel,
          surfaceLabel,
          quantity,
          eur: finiteNumberOrNull(row?.supplierPrice),
          dkkBase: finiteNumberOrNull(row?.convertedPriceDkk) ?? dkkFinal,
          tierMultiplier: finiteNumberOrNull(row?.markupInputs?.tierMultiplier) ?? 1,
          dkkFinal,
          detailUrl: normalizeText(row?.sourceUrl),
          widthMm: finiteNumberOrNull(row?.dimensions?.widthMm),
          heightMm: finiteNumberOrNull(row?.dimensions?.heightMm),
          sourceOrigin: normalizeText(row?.sourceType) || "supplier-bank",
          sourceOptionText: normalizeText(row?.extraData?.sourceOptionText),
          sourceKey: normalizeText(row?.sourceKey)
            || [
              foldLabel,
              pagesLabel,
              orientationLabel,
              formatLabel,
              materialLabel,
              surfaceLabel,
            ].join("||"),
          rawExtraData: {
            ...(row?.extraData && typeof row.extraData === "object" ? row.extraData : {}),
            supplierBankImport: true,
          },
        };
      })
      .filter(Boolean)
  );
}

function summarizeDraftImport({ transformedRows, normalizedRows }) {
  const quantities = transformedRows.map((row) => Number(row.quantity)).filter(Number.isFinite);
  const prices = transformedRows.map((row) => Number(row.dkkFinal)).filter(Number.isFinite);
  const unique = (field) => new Set(transformedRows.map((row) => normalizeText(row?.[field])).filter(Boolean)).size;

  return {
    transformedRows: transformedRows.length,
    normalizedRows: normalizedRows.length,
    quantityMin: quantities.length ? Math.min(...quantities) : null,
    quantityMax: quantities.length ? Math.max(...quantities) : null,
    priceMinDkk: prices.length ? Math.min(...prices) : null,
    priceMaxDkk: prices.length ? Math.max(...prices) : null,
    formats: unique("formatLabel"),
    materials: unique("materialLabel"),
    surfaces: unique("surfaceLabel"),
    folds: unique("foldLabel"),
    pages: unique("pagesLabel"),
    orientations: unique("orientationLabel"),
  };
}

function getSupabaseServiceClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createSupabaseFetchWithTimeout(),
    },
  });
}

function formatSupabaseError(error) {
  if (!error) return "unknown Supabase error";
  return [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" | ");
}

function countJsonRows(value) {
  return Array.isArray(value) ? value.length : 0;
}

function formatMaybeDate(value) {
  return value ? new Date(value).toISOString() : "not set";
}

async function createDraftMatrixProduct({ tenantId, productName, productSlug, snapshot, matrixConfig, normalizedRows }) {
  const client = getSupabaseServiceClient();

  const { data: existing, error: existingError } = await client
    .from("products")
    .select("id, slug, is_published")
    .eq("tenant_id", tenantId)
    .eq("slug", productSlug)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    throw new Error(`Refusing to overwrite existing product slug '${productSlug}' (${existing.id}). Choose a fresh --slug.`);
  }

  const { data: product, error: productError } = await client
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: productName,
      slug: productSlug,
      icon_text: productName,
      description: snapshot.descriptionDa || snapshot.descriptionOriginal || "Supplier-bank draft product",
      category: "tryksager",
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: {
        bleed_mm: 3,
        min_dpi: 300,
        source: "supplier-bank",
        supplier: snapshot.supplierSlug || null,
        supplier_product_key: snapshot.supplierProductKey || null,
      },
    })
    .select("id, slug, is_published")
    .single();

  if (productError) throw productError;

  const publishResult = await publishNormalizedMatrixProduct({
    client,
    tenantId,
    productId: product.id,
    productUpdate: {
      name: productName,
      slug: productSlug,
      is_published: false,
    },
    matrixConfig,
    normalizedRows,
    deleteByTenant: true,
  });

  return {
    productId: product.id,
    productSlug: product.slug,
    isPublished: product.is_published,
    rowsInserted: publishResult.rowsInserted,
    quantities: publishResult.quantities,
  };
}

function buildBankProductDraft({ blueprint, supplierSlug, productFamily, rows, rawSnapshotPath }) {
  return {
    schemaVersion: 1,
    supplierSlug,
    supplierProductKey: blueprint.product.slug,
    sourceUrl: blueprint.pricing_import.url,
    productFamily,
    nameOriginal: blueprint.product.name,
    nameDa: blueprint.product.name,
    descriptionOriginal: blueprint.product.description || null,
    descriptionDa: blueprint.product.description || null,
    sourceLanguage: null,
    targetLanguage: "da",
    normalizedAttributes: buildNormalizedAttributes(blueprint),
    normalizedPriceRows: buildNormalizedPriceRows({ blueprint, rows }),
    rawSnapshotPath,
    metadata: {
      source: "supplier-bank-blueprint-ingest",
      blueprintProductSlug: blueprint.product.slug,
      blueprintCategory: blueprint.product.category,
      verticalAxis: blueprint.matrix.vertical_axis,
    },
  };
}

async function writeBankRows({
  supplier,
  bankProductDraft,
  rawSnapshotPath,
  rawPayload,
  pricingSummary,
}) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createSupabaseFetchWithTimeout(),
    },
  });

  const { data: supplierRow, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .upsert(
      {
        name: supplier.name,
        slug: supplier.slug,
        website_url: supplier.websiteUrl || null,
        country_code: supplier.countryCode,
        currency: supplier.currency,
        integration_type: supplier.integrationType,
        enabled: true,
        metadata: {
          source: "supplier-bank-cli",
        },
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (supplierError) throw supplierError;

  const { data: runRow, error: runError } = await client
    .from("supplier_bank_scrape_runs")
    .insert({
      supplier_id: supplierRow.id,
      mode: "product_extract",
      tool: "playwright",
      status: "succeeded",
      input: {
        sourceUrl: bankProductDraft.sourceUrl,
        supplierProductKey: bankProductDraft.supplierProductKey,
      },
      summary: {
        rows: pricingSummary.rows,
        rawSnapshotPath,
      },
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runError) throw runError;

  const { data: existingProductRow, error: existingProductError } = await client
    .from("supplier_bank_products")
    .select("status")
    .eq("supplier_id", supplierRow.id)
    .eq("supplier_product_key", bankProductDraft.supplierProductKey)
    .maybeSingle();

  if (existingProductError) throw existingProductError;

  const preservedStatus = ["approved", "archived"].includes(existingProductRow?.status)
    ? existingProductRow.status
    : "draft";

  const { data: productRow, error: productError } = await client
    .from("supplier_bank_products")
    .upsert(
      {
        supplier_id: supplierRow.id,
        latest_scrape_run_id: runRow.id,
        supplier_product_key: bankProductDraft.supplierProductKey,
        source_url: bankProductDraft.sourceUrl,
        source_hash: null,
        product_family: bankProductDraft.productFamily,
        name_original: bankProductDraft.nameOriginal,
        name_da: bankProductDraft.nameDa,
        description_original: bankProductDraft.descriptionOriginal,
        description_da: bankProductDraft.descriptionDa,
        source_language: bankProductDraft.sourceLanguage,
        target_language: bankProductDraft.targetLanguage,
        status: preservedStatus,
        normalized_attributes: bankProductDraft.normalizedAttributes,
        normalized_pricing_summary: {
          rows: pricingSummary.rows,
          quantityMin: pricingSummary.quantity_min,
          quantityMax: pricingSummary.quantity_max,
          priceMinDkk: pricingSummary.price_min_dkk,
          priceMaxDkk: pricingSummary.price_max_dkk,
        },
        raw_snapshot_path: rawSnapshotPath,
        scrape_status: "fresh",
        last_scraped_at: new Date().toISOString(),
        last_price_checked_at: new Date().toISOString(),
        metadata: bankProductDraft.metadata,
      },
      { onConflict: "supplier_id,supplier_product_key" },
    )
    .select("id")
    .single();

  if (productError) throw productError;

  const { data: snapshotRow, error: snapshotError } = await client
    .from("supplier_bank_price_snapshots")
    .insert({
      bank_product_id: productRow.id,
      supplier_id: supplierRow.id,
      scrape_run_id: runRow.id,
      currency: supplier.currency,
      conversion_rule_key: bankProductDraft.normalizedPriceRows[0]?.conversionRuleKey || null,
      raw_price_rows: rawPayload.rows,
      normalized_price_rows: bankProductDraft.normalizedPriceRows,
      price_min_dkk: pricingSummary.price_min_dkk,
      price_max_dkk: pricingSummary.price_max_dkk,
      quantity_min: pricingSummary.quantity_min,
      quantity_max: pricingSummary.quantity_max,
      metadata: {
        rawSnapshotPath,
      },
    })
    .select("id")
    .single();

  if (snapshotError) throw snapshotError;

  return {
    supplierId: supplierRow.id,
    scrapeRunId: runRow.id,
    bankProductId: productRow.id,
    priceSnapshotId: snapshotRow.id,
  };
}

async function runIngestBlueprint(args) {
  const parsed = parseArgs(args);
  const blueprintPath = parsed.positionals[0];
  if (!blueprintPath) throw new Error(`Missing blueprint path\n\n${usage()}`);

  const supplierSlug = requireValue(parsed.values, "supplier-slug");
  const supplierName = requireValue(parsed.values, "supplier-name");
  const productFamily = requireValue(parsed.values, "product-family");
  if (!PRODUCT_FAMILIES.has(productFamily)) {
    throw new Error(`Unsupported --product-family: ${productFamily}`);
  }

  const supplier = {
    slug: supplierSlug,
    name: supplierName,
    websiteUrl: parsed.values["supplier-website"] || null,
    countryCode: parsed.values["supplier-country"] || "DE",
    currency: parsed.values["supplier-currency"] || "EUR",
    integrationType: parsed.values["integration-type"] || "scrape",
  };

  const { blueprint, filePath } = loadBlueprintFile(blueprintPath);
  const repoRoot = process.cwd();
  ensureDir(path.join(repoRoot, "pricing_raw", "supplier-bank"));
  ensureDir(path.join(repoRoot, "pricing_clean", "supplier-bank"));

  let extraction = {
    provider: "no-extract",
    liTexts: [],
    payload: {},
    firecrawlError: null,
    playwrightError: null,
  };
  let transformed = { rows: [], skipped: [] };

  if (!parsed.flags.has("no-extract")) {
    extraction = await extractLiTexts({
      url: blueprint.pricing_import.url,
      ulSelector: blueprint.pricing_import.ul_selector,
    });
    transformed = transformLiTextsToRows(extraction.liTexts, blueprint.pricing_import);
  }

  const timestamp = timestampForFile();
  const snapshotSlug = path.join("supplier-bank", supplierSlug, blueprint.product.slug);
  const rawPayload = {
    schemaVersion: 1,
    timestamp,
    supplier,
    blueprintFile: filePath,
    source: {
      url: blueprint.pricing_import.url,
      selector: blueprint.pricing_import.ul_selector,
    },
    extractor: {
      provider: extraction.provider,
      firecrawlError: extraction.firecrawlError || null,
      playwrightError: extraction.playwrightError || null,
    },
    liTexts: extraction.liTexts,
    rows: transformed.rows,
    skipped: transformed.skipped,
  };

  const rawSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: snapshotSlug,
    timestamp,
    payload: rawPayload,
  });

  const bankProductDraft = buildBankProductDraft({
    blueprint,
    supplierSlug,
    productFamily,
    rows: transformed.rows,
    rawSnapshotPath,
  });

  const normalizedSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: path.join("supplier-bank-normalized", supplierSlug, blueprint.product.slug),
    timestamp,
    payload: bankProductDraft,
  });

  const pricingSummary = summarizePrices(transformed.rows);

  console.log("Supplier bank ingest prepared");
  console.log(`  Supplier: ${supplier.name} (${supplier.slug})`);
  console.log(`  Product: ${bankProductDraft.nameDa} (${bankProductDraft.supplierProductKey})`);
  console.log(`  Family: ${bankProductDraft.productFamily}`);
  console.log(`  Extractor: ${extraction.provider}`);
  console.log(`  Price rows: ${pricingSummary.rows}`);
  console.log(`  Raw snapshot: ${rawSnapshotPath}`);
  console.log(`  Normalized snapshot: ${normalizedSnapshotPath}`);

  if (!parsed.flags.has("write-bank")) {
    console.log("Dry run complete (no Supabase writes). Add --write-bank to store in supplier bank tables.");
    return;
  }

  const writeResult = await writeBankRows({
    supplier,
    bankProductDraft,
    rawSnapshotPath,
    rawPayload,
    pricingSummary,
  });

  console.log("Supplier bank write complete");
  console.log(`  Supplier ID: ${writeResult.supplierId}`);
  console.log(`  Scrape run ID: ${writeResult.scrapeRunId}`);
  console.log(`  Bank product ID: ${writeResult.bankProductId}`);
  console.log(`  Price snapshot ID: ${writeResult.priceSnapshotId}`);
}

async function runImportNormalizedSnapshot(args) {
  const parsed = parseArgs(args);
  const snapshotPath = parsed.positionals[0];
  if (!snapshotPath) throw new Error(`Missing snapshot path\n\n${usage()}`);

  const { path: resolvedSnapshotPath, json: snapshot } = loadJsonFile(snapshotPath);
  if (snapshot.productFamily !== "folders") {
    throw new Error(`Only folder supplier-bank snapshots are supported for draft import right now. Got: ${snapshot.productFamily || "unknown"}`);
  }

  const transformedRows = normalizedFolderRowsToTransformedRows(snapshot.normalizedPriceRows);
  if (transformedRows.length === 0) {
    throw new Error("Snapshot did not contain any importable normalized folder rows");
  }

  const matrixConfig = buildFoldersMatrixConfig(transformedRows);
  const normalizedRows = createFolderNormalizedRows(transformedRows);
  const summary = summarizeDraftImport({ transformedRows, normalizedRows });
  const productName = parsed.values.name || snapshot.nameDa || snapshot.nameOriginal || "Supplier bank draft";
  const productSlug = parsed.values.slug || slugify(snapshot.supplierProductKey || productName);
  const tenantId = parsed.values.tenant || null;

  const dryRunResult = await publishNormalizedMatrixProduct({
    client: null,
    tenantId: tenantId || "00000000-0000-0000-0000-000000000000",
    productId: "dry-run-product-id",
    matrixConfig,
    normalizedRows,
    dryRun: true,
  });

  console.log("Supplier bank draft import preview");
  console.log(`  Snapshot: ${resolvedSnapshotPath}`);
  console.log(`  Source supplier: ${snapshot.supplierSlug || "unknown"}`);
  console.log(`  Source product key: ${snapshot.supplierProductKey || "unknown"}`);
  console.log(`  Draft product name: ${productName}`);
  console.log(`  Draft product slug: ${productSlug}`);
  console.log(`  Target tenant: ${tenantId || "not set (required for --write-draft-product)"}`);
  console.log(`  Import mode: Matrix Layout V1`);
  console.log(`  Price rows: ${summary.normalizedRows}`);
  console.log(`  Quantities: ${summary.quantityMin}-${summary.quantityMax}`);
  console.log(`  Price range DKK: ${summary.priceMinDkk}-${summary.priceMaxDkk}`);
  console.log(`  Formats/materials/surfaces: ${summary.formats}/${summary.materials}/${summary.surfaces}`);
  console.log(`  Folds/pages/orientations: ${summary.folds}/${summary.pages}/${summary.orientations}`);
  console.log(`  Matrix quantities: ${dryRunResult.quantities.join(", ")}`);

  if (!parsed.flags.has("write-draft-product")) {
    console.log("Preview complete (no Supabase writes). Add --write-draft-product to create an unpublished draft product.");
    return;
  }

  if (!tenantId) {
    throw new Error("Missing --tenant. A target tenant is required for --write-draft-product.");
  }

  const writeResult = await createDraftMatrixProduct({
    tenantId,
    productName,
    productSlug,
    snapshot,
    matrixConfig,
    normalizedRows,
  });

  console.log("Draft product import complete");
  console.log(`  Product ID: ${writeResult.productId}`);
  console.log(`  Product slug: ${writeResult.productSlug}`);
  console.log(`  Published: ${writeResult.isPublished ? "yes" : "no"}`);
  console.log(`  Price rows inserted: ${writeResult.rowsInserted}`);
}

function parseOptionalPositiveNumber(values, key, fallback) {
  if (values[key] == null) return fallback;
  const parsed = Number(values[key]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${key} must be a positive number`);
  }
  return parsed;
}

async function runCompareNormalizedSnapshots(args) {
  const parsed = parseArgs(args);
  const oldPath = parsed.positionals[0];
  const newPath = parsed.positionals[1];
  if (!oldPath || !newPath) throw new Error(`Missing old/new snapshot paths\n\n${usage()}`);

  const { path: resolvedOldPath, json: oldSnapshot } = loadJsonFile(oldPath);
  const { path: resolvedNewPath, json: newSnapshot } = loadJsonFile(newPath);
  const thresholdPct = parseOptionalPositiveNumber(parsed.values, "threshold-pct", 0);
  const limit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 12)));

  const result = compareNormalizedSnapshots({
    oldSnapshot,
    newSnapshot,
    thresholdPct,
  });

  const changedCount = result.changed.length;
  const increasedCount = result.changed.filter((change) => change.delta > 0).length;
  const decreasedCount = result.changed.filter((change) => change.delta < 0).length;
  const totalDelta = result.changed.reduce((sum, change) => sum + change.delta, 0);

  console.log("Supplier bank price delta review");
  console.log(`  Old snapshot: ${resolvedOldPath}`);
  console.log(`  New snapshot: ${resolvedNewPath}`);
  console.log(`  Supplier: ${getSnapshotSupplierSlug(newSnapshot) || getSnapshotSupplierSlug(oldSnapshot) || "unknown"}`);
  console.log(`  Product key: ${getSnapshotSupplierProductKey(newSnapshot) || getSnapshotSupplierProductKey(oldSnapshot) || "unknown"}`);
  console.log(`  Threshold: ${thresholdPct}%`);
  console.log(`  Old rows: ${result.oldRows}`);
  console.log(`  New rows: ${result.newRows}`);
  console.log(`  Changed rows: ${changedCount}`);
  console.log(`  Increased/decreased: ${increasedCount}/${decreasedCount}`);
  console.log(`  Added/removed rows: ${result.added.length}/${result.removed.length}`);
  console.log(`  Unchanged rows: ${result.unchanged}`);
  console.log(`  Duplicate keys old/new: ${result.duplicateOldKeys}/${result.duplicateNewKeys}`);
  console.log(`  Net changed-row delta DKK: ${Number(totalDelta.toFixed(2))}`);

  if (changedCount > 0) {
    console.log("");
    console.log(`Top ${Math.min(limit, changedCount)} changed rows:`);
    result.changed.slice(0, limit).forEach((change, index) => {
      const percentText = change.percent == null ? "n/a" : `${change.percent.toFixed(2)}%`;
      const sign = change.delta > 0 ? "+" : "";
      console.log(
        `  ${index + 1}. ${describeComparableRow(change.row)} | ${change.beforePrice} -> ${change.afterPrice} DKK (${sign}${change.delta}, ${percentText})`
      );
    });
  }

  if (result.added.length > 0) {
    console.log("");
    console.log(`Added rows (first ${Math.min(limit, result.added.length)}):`);
    result.added.slice(0, limit).forEach((item, index) => {
      console.log(`  ${index + 1}. ${describeComparableRow(item.row)} | ${getNormalizedPrice(item.row)} DKK`);
    });
  }

  if (result.removed.length > 0) {
    console.log("");
    console.log(`Removed rows (first ${Math.min(limit, result.removed.length)}):`);
    result.removed.slice(0, limit).forEach((item, index) => {
      console.log(`  ${index + 1}. ${describeComparableRow(item.row)} | ${getNormalizedPrice(item.row)} DKK`);
    });
  }

  console.log("");
  if (!parsed.flags.has("write-delta-review")) {
    console.log("Delta review complete (no Supabase writes). Add --write-delta-review to store this review in supplier-bank tables.");
    return;
  }

  const writeResult = await writeDeltaReviewRecord({
    oldSnapshot,
    newSnapshot,
    oldPath: resolvedOldPath,
    newPath: resolvedNewPath,
    thresholdPct,
    result,
    notes: parsed.values.notes || null,
  });

  console.log("Delta review stored");
  console.log(`  Delta review ID: ${writeResult.id}`);
  console.log(`  Already existed: ${writeResult.alreadyExisted ? "yes" : "no"}`);
  console.log(`  Linked supplier ID: ${writeResult.supplierId || "not linked"}`);
  console.log(`  Linked bank product ID: ${writeResult.bankProductId || "not linked"}`);
  console.log(`  Old price snapshot ID: ${writeResult.oldPriceSnapshotId || "not linked"}`);
  console.log(`  New price snapshot ID: ${writeResult.newPriceSnapshotId || "not linked"}`);
}

function validateSupplierRegistrySource({ source, index, slugs, internalDomains, errors, warnings }) {
  const label = source?.slug || `source[${index}]`;

  if (!source || typeof source !== "object") {
    errors.push(`sources[${index}] must be an object`);
    return;
  }

  const slug = normalizeText(source.slug);
  if (!slug) {
    errors.push(`sources[${index}] is missing slug`);
  } else if (slugs.has(slug)) {
    errors.push(`Duplicate supplier source slug: ${slug}`);
  } else {
    slugs.add(slug);
  }

  if (!normalizeText(source.name)) {
    errors.push(`${label} is missing name`);
  }

  const status = normalizeText(source.status || "candidate");
  if (!SUPPLIER_SOURCE_STATUSES.has(status)) {
    errors.push(`${label} has unsupported status '${status}'`);
  }

  const integrationType = normalizeText(source.integrationType);
  if (!SUPPLIER_INTEGRATION_TYPES.has(integrationType)) {
    errors.push(`${label} has unsupported integrationType '${integrationType}'`);
  }

  const families = Array.isArray(source.productFamilies) ? source.productFamilies : [];
  if (families.length === 0) {
    errors.push(`${label} must list at least one product family`);
  }

  families.forEach((family) => {
    if (!PRODUCT_FAMILIES.has(family)) {
      errors.push(`${label} has unsupported product family '${family}'`);
    }
  });

  const websiteHostname = hostnameFromUrl(source.websiteUrl);
  if (!websiteHostname) {
    errors.push(`${label} has an invalid or missing websiteUrl`);
  } else if (hostnameMatchesInternal(websiteHostname, internalDomains)) {
    errors.push(`${label} points at internal domain '${websiteHostname}' and must be moved to excludedInternalSystems`);
  }

  const sourceUrls = Array.isArray(source.sourceUrls) ? source.sourceUrls : [];
  sourceUrls.forEach((sourceUrl) => {
    const hostname = hostnameFromUrl(sourceUrl);
    if (!hostname) {
      errors.push(`${label} has invalid sourceUrl '${sourceUrl}'`);
    } else if (hostnameMatchesInternal(hostname, internalDomains)) {
      errors.push(`${label} sourceUrl '${sourceUrl}' points at an internal Webprinter domain`);
    }
  });

  const familyUrlCandidates = source?.productFamilyUrlCandidates;
  if (familyUrlCandidates !== undefined && (!familyUrlCandidates || typeof familyUrlCandidates !== "object" || Array.isArray(familyUrlCandidates))) {
    errors.push(`${label} productFamilyUrlCandidates must be an object keyed by product family`);
  } else if (familyUrlCandidates) {
    Object.entries(familyUrlCandidates).forEach(([family, candidates]) => {
      if (!PRODUCT_FAMILIES.has(family)) {
        errors.push(`${label} has productFamilyUrlCandidates for unsupported family '${family}'`);
      }
      if (!families.includes(family)) {
        warnings.push(`${label} has URL candidates for family '${family}' not listed in productFamilies`);
      }
      if (!Array.isArray(candidates)) {
        errors.push(`${label} productFamilyUrlCandidates.${family} must be an array`);
        return;
      }
      candidates.forEach((candidate, candidateIndex) => {
        const candidateLabel = `${label} productFamilyUrlCandidates.${family}[${candidateIndex}]`;
        const candidateUrl = typeof candidate === "string" ? candidate : candidate?.url;
        const hostname = hostnameFromUrl(candidateUrl);
        if (!hostname) {
          errors.push(`${candidateLabel} has invalid or missing url`);
        } else if (hostnameMatchesInternal(hostname, internalDomains)) {
          errors.push(`${candidateLabel} points at an internal Webprinter domain`);
        }
        const candidateStatus = normalizeText(typeof candidate === "string" ? "" : candidate?.status);
        if (!candidateStatus) {
          warnings.push(`${candidateLabel} has no status; use official_candidate_needs_confirmation or confirmed_source_url`);
        } else if (!SUPPLIER_FAMILY_URL_CANDIDATE_STATUSES.has(candidateStatus)) {
          errors.push(`${candidateLabel} has unsupported status '${candidateStatus}'`);
        }
      });
    });
  }

  if (status === "active" && !normalizeText(source.adapter)) {
    warnings.push(`${label} is active but has no adapter reference`);
  }
}

function validateSupplierRegistry(registry) {
  const errors = [];
  const warnings = [];
  const slugs = new Set();

  if (!registry || typeof registry !== "object") {
    return {
      errors: ["Registry root must be an object"],
      warnings,
      internalDomains: [],
      sources: [],
    };
  }

  if (registry.schemaVersion !== 1) {
    errors.push(`Unsupported schemaVersion '${registry.schemaVersion}'`);
  }

  const internalDomains = getRegistryInternalDomains(registry);
  if (internalDomains.length === 0) {
    errors.push("Registry must define excludedInternalSystems domains");
  }

  const sources = Array.isArray(registry.sources) ? registry.sources : [];
  if (sources.length === 0) {
    errors.push("Registry must define at least one external supplier source");
  }

  sources.forEach((source, index) => {
    validateSupplierRegistrySource({
      source,
      index,
      slugs,
      internalDomains,
      errors,
      warnings,
    });
  });

  return {
    errors,
    warnings,
    internalDomains,
    sources,
  };
}

function loadValidatedSupplierRegistry(registryPath) {
  const { path: resolvedPath, json: registry } = loadJsonFile(registryPath);
  const validation = validateSupplierRegistry(registry);
  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `  - ${error}`).join("\n");
    throw new Error(`Supplier source registry validation failed:\n${details}`);
  }

  return {
    resolvedPath,
    registry,
    validation,
  };
}

function runValidateSupplierSources(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const statusCounts = new Map();
  const familyCounts = new Map();

  validation.sources.forEach((source) => {
    const status = normalizeText(source?.status || "candidate");
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    (Array.isArray(source?.productFamilies) ? source.productFamilies : []).forEach((family) => {
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    });
  });

  console.log("Supplier source registry validation");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  External sources: ${validation.sources.length}`);
  console.log(`  Excluded internal domains: ${validation.internalDomains.join(", ") || "none"}`);
  console.log(`  Status counts: ${[...statusCounts.entries()].map(([key, value]) => `${key}:${value}`).join(", ") || "none"}`);
  console.log(`  Product-family coverage: ${[...familyCounts.entries()].map(([key, value]) => `${key}:${value}`).join(", ") || "none"}`);

  if (validation.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    validation.warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (validation.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    validation.errors.forEach((error) => console.log(`  - ${error}`));
    throw new Error(`Supplier source registry validation failed with ${validation.errors.length} error(s)`);
  }

  console.log("");
  console.log("Supplier source registry is valid. Internal Webprinter/Sales Maba domains are excluded from supplier scraping.");
}

function getSupplierUrlCandidateRows({ validation, supplierFilter, familyFilter }) {
  const rows = [];
  validation.sources.forEach((source) => {
    const supplierSlug = normalizeText(source.slug);
    if (supplierFilter && supplierSlug !== supplierFilter) return;

    const families = Array.isArray(source.productFamilies) ? source.productFamilies : [];
    const candidatesByFamily = source.productFamilyUrlCandidates;
    if (!candidatesByFamily || typeof candidatesByFamily !== "object" || Array.isArray(candidatesByFamily)) return;

    Object.entries(candidatesByFamily).forEach(([family, candidates]) => {
      if (familyFilter && family !== familyFilter) return;
      if (!Array.isArray(candidates)) return;

      candidates.forEach((candidate, index) => {
        const row = typeof candidate === "string"
          ? {
            url: candidate,
            status: "candidate_needs_confirmation",
            evidence: "Registry URL candidate; option shape and extractor profile are not confirmed.",
          }
          : {
            url: normalizeText(candidate?.url),
            status: normalizeText(candidate?.status || "candidate_needs_confirmation"),
            evidence: normalizeText(candidate?.evidence || "Registry URL candidate; option shape and extractor profile are not confirmed."),
          };

        if (!row.url) return;
        rows.push({
          supplierSlug,
          supplierName: normalizeText(source.name),
          supplierStatus: normalizeText(source.status || "candidate"),
          family,
          candidateIndex: index + 1,
          url: row.url,
          status: row.status,
          evidence: row.evidence,
          isRegisteredFamily: families.includes(family),
          isConfirmed: row.status === "confirmed_source_url",
          isRejected: row.status === "rejected",
          nextAction: getSupplierUrlCandidateNextAction(row.status),
        });
      });
    });
  });

  return rows.sort((left, right) => {
    const supplierDelta = left.supplierSlug.localeCompare(right.supplierSlug);
    if (supplierDelta !== 0) return supplierDelta;
    const familyDelta = left.family.localeCompare(right.family);
    if (familyDelta !== 0) return familyDelta;
    return left.candidateIndex - right.candidateIndex;
  });
}

function getSupplierUrlCandidateNextAction(status) {
  if (status === "confirmed_source_url") {
    return "Use as exact URL only after the matching extractor profile exists; keep any preview local/no-write first.";
  }
  if (status === "rejected") {
    return "Keep for traceability; do not use for probe/extract.";
  }
  if (status === "official_candidate_needs_confirmation") {
    return "Manually review the supplier page and option shape; promote to confirmed_source_url only when it is the exact product/configurator URL.";
  }
  return "Confirm supplier ownership, product family, and option shape before any probe/extract.";
}

function summarizeSupplierUrlCandidateRows(rows) {
  return rows.reduce((acc, row) => {
    acc.total += 1;
    acc.byStatus[row.status] = (acc.byStatus[row.status] || 0) + 1;
    if (row.isConfirmed) acc.confirmed += 1;
    if (row.isRejected) acc.rejected += 1;
    if (!row.isConfirmed && !row.isRejected) acc.pending += 1;
    if (!row.isRegisteredFamily) acc.unregisteredFamily += 1;
    return acc;
  }, {
    total: 0,
    confirmed: 0,
    pending: 0,
    rejected: 0,
    unregisteredFamily: 0,
    byStatus: {},
  });
}

function buildSupplierUrlCandidateReportMarkdown({ resolvedPath, rows, summary, supplierFilter, familyFilter }) {
  const lines = [
    "# Supplier Bank URL Candidate Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${resolvedPath}`,
    `Supplier filter: ${supplierFilter || "all"}`,
    `Family filter: ${familyFilter || "all"}`,
    "",
    "## Scope",
    "",
    "- Read-only report over `config/supplier-bank/sources.json` URL candidates.",
    "- No supplier probing, scraping, API calls, or browser automation.",
    "- No supplier-bank writes.",
    "- No product creation, publishing changes, or live pricing writes.",
    "- `confirmed_source_url` means the URL may satisfy the exact-URL gate only after the matching extractor profile exists.",
    "",
    "## Summary",
    "",
    `- URL candidates: ${summary.total}`,
    `- Pending confirmation: ${summary.pending}`,
    `- Confirmed exact source URLs: ${summary.confirmed}`,
    `- Rejected: ${summary.rejected}`,
    `- Family not listed in source productFamilies: ${summary.unregisteredFamily}`,
    `- Status counts: ${Object.entries(summary.byStatus).map(([status, count]) => `${status}:${count}`).join(", ") || "none"}`,
    "",
    "## Candidates",
    "",
  ];

  if (rows.length === 0) {
    lines.push("No URL candidates matched the current filter.", "");
  } else {
    rows.forEach((row, index) => {
      lines.push(
        `### ${index + 1}. ${row.supplierName} / ${row.family}`,
        "",
        `Supplier slug: \`${row.supplierSlug}\``,
        `Supplier status: ${row.supplierStatus}`,
        `Registered family: ${row.isRegisteredFamily ? "yes" : "no"}`,
        `Candidate status: ${row.status}`,
        `URL: ${row.url}`,
        `Evidence: ${row.evidence}`,
        `Next action: ${row.nextAction}`,
        ""
      );
    });
  }

  lines.push(
    "## Guardrails",
    "",
    "- Do not infer exact product URLs from category pages.",
    "- Do not promote a candidate to `confirmed_source_url` until manual review proves it is the exact product/configurator URL.",
    "- Do not run Pixart probe/extract unless both the extractor profile and exact URL are confirmed.",
    "- Do not use Salgsmapper/Sales Maba, Onlinetryksager, Webprinter, or localhost as supplier sources.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function runSupplierBankUrlCandidateReport(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const supplierFilter = normalizeText(parsed.values.supplier || "");
  const familyFilter = normalizeText(parsed.values.family || "");
  const shouldWriteReport = parsed.flags.has("write-report");
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const rows = getSupplierUrlCandidateRows({ validation, supplierFilter, familyFilter });
  const summary = summarizeSupplierUrlCandidateRows(rows);

  console.log("Supplier bank URL candidate report");
  console.log("  Scope: read-only supplier URL candidate report");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Supplier filter: ${supplierFilter || "all"}`);
  console.log(`  Family filter: ${familyFilter || "all"}`);
  console.log("  Supplier probes/scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  URL candidates: ${summary.total}`);
  console.log(`  Pending/confirmed/rejected: ${summary.pending}/${summary.confirmed}/${summary.rejected}`);
  console.log(`  Family not listed in source productFamilies: ${summary.unregisteredFamily}`);
  console.log(`  Status counts: ${Object.entries(summary.byStatus).map(([status, count]) => `${status}:${count}`).join(", ") || "none"}`);
  console.log("");
  console.log("Candidates");
  rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.supplierSlug} / ${row.family} | ${row.status}`);
    console.log(`     URL: ${row.url}`);
    console.log(`     Next: ${row.nextAction}`);
  });
  if (rows.length === 0) {
    console.log("  None.");
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const scope = slugify([
      supplierFilter || "all-suppliers",
      familyFilter || "all-families",
    ].join("-"));
    const reportPath = path.join("docs", `SUPPLIER_BANK_URL_CANDIDATES_${scope}_${timestampForFile()}.md`);
    const report = buildSupplierUrlCandidateReportMarkdown({
      resolvedPath,
      rows,
      summary,
      supplierFilter,
      familyFilter,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_URL_CANDIDATES_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_URL_CANDIDATES_LATEST_PATH}`);
  }
}

const SUPPLIER_URL_CONFIRMATION_CHECKLIST = [
  "Open the URL manually as human review only; do not run probe/extract yet.",
  "Confirm the page belongs to the registered external supplier, not Webprinter, Salgsmapper/Sales Maba, Onlinetryksager, or localhost.",
  "Confirm it is the exact product/configurator route for the listed family, not only a broad category or marketing page.",
  "Confirm the visible options roughly match the intended extractor profile: format, material, finish, quantity, and delivery/urgency where relevant.",
  "Confirm whether the first useful price grid is visible without login/cart-only steps; note if Playwright is needed.",
  "Confirm the matching extractor profile exists before treating the family as probe-ready.",
  "If exact, update the registry candidate status to confirmed_source_url with evidence. If wrong, mark rejected with evidence.",
  "Keep all first extractor runs local/no-write until the preview passes quality gates.",
];

function getSupplierUrlConfirmationInstruction(row) {
  if (row.isConfirmed) {
    return "Already marked confirmed_source_url; next check is extractor-profile support and a local/no-write preview.";
  }
  if (row.isRejected) {
    return "Already rejected; keep only for traceability and do not use for probe/extract.";
  }
  return "Pending manual confirmation; keep as candidate until exact URL, option shape, and extractor profile support are proven.";
}

function buildSupplierUrlConfirmationChecklistMarkdown({ resolvedPath, rows, summary, supplierFilter, familyFilter }) {
  const familyCount = new Set(rows.map((row) => `${row.supplierSlug}:${row.family}`)).size;
  const lines = [
    "# Supplier Bank URL Confirmation Checklist",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${resolvedPath}`,
    `Supplier filter: ${supplierFilter || "all"}`,
    `Family filter: ${familyFilter || "all"}`,
    "",
    "## Scope",
    "",
    "- Read-only checklist over `config/supplier-bank/sources.json` URL candidates.",
    "- No supplier probing, scraping, API calls, or browser automation.",
    "- No supplier-bank writes.",
    "- No product creation, publishing changes, or live pricing writes.",
    "- This checklist is for promoting or rejecting registry candidates by human review before extractor work begins.",
    "",
    "## Summary",
    "",
    `- URL candidates: ${summary.total}`,
    `- Supplier/family groups: ${familyCount}`,
    `- Pending confirmation: ${summary.pending}`,
    `- Confirmed exact source URLs: ${summary.confirmed}`,
    `- Rejected: ${summary.rejected}`,
    `- Family not listed in source productFamilies: ${summary.unregisteredFamily}`,
    "",
    "## Manual Confirmation Checklist",
    "",
    ...SUPPLIER_URL_CONFIRMATION_CHECKLIST.map((item) => `- [ ] ${item}`),
    "",
    "## Candidate Review Items",
    "",
  ];

  if (rows.length === 0) {
    lines.push("No URL candidates matched the current filter.", "");
  } else {
    rows.forEach((row, index) => {
      lines.push(
        `### ${index + 1}. ${row.supplierName} / ${row.family} / candidate ${row.candidateIndex}`,
        "",
        `Supplier slug: \`${row.supplierSlug}\``,
        `Supplier status: ${row.supplierStatus}`,
        `Registered family: ${row.isRegisteredFamily ? "yes" : "no"}`,
        `Candidate status: ${row.status}`,
        `URL: ${row.url}`,
        `Evidence: ${row.evidence}`,
        `Checklist result instruction: ${getSupplierUrlConfirmationInstruction(row)}`,
        "",
        "Review notes to fill before promotion/rejection:",
        "- Exact product/configurator route: pending",
        "- Option-shape match: pending",
        "- Login/cart-only blocker: pending",
        "- Extractor profile exists: pending",
        "- Recommended registry status after review: keep candidate until notes are complete",
        ""
      );
    });
  }

  lines.push(
    "## Registry Promotion Rules",
    "",
    "- Promote a candidate to `confirmed_source_url` only after the manual checklist proves the exact product/configurator URL.",
    "- Add evidence with the reviewed product family, visible option shape, and date/person or source note.",
    "- Mark a candidate `rejected` when it is only a category page, wrong family, wrong supplier, or cannot support the intended extractor path.",
    "- Do not run Pixart probe/extract until both the exact URL and the matching extractor profile are confirmed.",
    "- Do not use this checklist as approval for supplier-bank writes, draft imports, publishing, or live pricing changes.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function runSupplierBankUrlConfirmationChecklist(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const supplierFilter = normalizeText(parsed.values.supplier || "");
  const familyFilter = normalizeText(parsed.values.family || "");
  const shouldWriteReport = parsed.flags.has("write-report");
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const rows = getSupplierUrlCandidateRows({ validation, supplierFilter, familyFilter });
  const summary = summarizeSupplierUrlCandidateRows(rows);
  const familyCount = new Set(rows.map((row) => `${row.supplierSlug}:${row.family}`)).size;

  console.log("Supplier bank URL confirmation checklist");
  console.log("  Scope: read-only manual confirmation checklist");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Supplier filter: ${supplierFilter || "all"}`);
  console.log(`  Family filter: ${familyFilter || "all"}`);
  console.log("  Supplier probes/scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  URL candidates: ${summary.total}`);
  console.log(`  Supplier/family groups: ${familyCount}`);
  console.log(`  Pending/confirmed/rejected: ${summary.pending}/${summary.confirmed}/${summary.rejected}`);
  console.log(`  First checklist item: ${SUPPLIER_URL_CONFIRMATION_CHECKLIST[0]}`);
  console.log("");
  console.log("Candidate actions");
  rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.supplierSlug} / ${row.family} | ${row.status}`);
    console.log(`     URL: ${row.url}`);
    console.log(`     Instruction: ${getSupplierUrlConfirmationInstruction(row)}`);
  });
  if (rows.length === 0) {
    console.log("  None.");
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const scope = slugify([
      supplierFilter || "all-suppliers",
      familyFilter || "all-families",
    ].join("-"));
    const reportPath = path.join("docs", `SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_${scope}_${timestampForFile()}.md`);
    const report = buildSupplierUrlConfirmationChecklistMarkdown({
      resolvedPath,
      rows,
      summary,
      supplierFilter,
      familyFilter,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST_PATH}`);
  }
}

function buildSupplierSeedRow(source) {
  const status = normalizeText(source.status || "candidate");
  const isActive = status === "active";

  return {
    name: source.name,
    slug: source.slug,
    website_url: source.websiteUrl,
    country_code: source.countryCode || "DK",
    currency: source.currency || "EUR",
    integration_type: source.integrationType || "manual",
    enabled: isActive,
    notes: source.notes || null,
    metadata: {
      source: "supplier-source-registry",
      registryStatus: status,
      adapter: source.adapter || null,
      productFamilies: Array.isArray(source.productFamilies) ? source.productFamilies : [],
      productFamilyUrlCandidates: source.productFamilyUrlCandidates && typeof source.productFamilyUrlCandidates === "object"
        ? source.productFamilyUrlCandidates
        : {},
      safeFirstSlice: source.safeFirstSlice || null,
      seededAt: new Date().toISOString(),
    },
  };
}

async function writeSupplierSeedRows(rows) {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from("supplier_bank_suppliers")
    .upsert(rows, { onConflict: "slug" })
    .select("id,slug,name,enabled,integration_type,currency");

  if (error) {
    throw new Error(`Supplier registry seed failed. ${formatSupabaseError(error)}`);
  }

  return data || [];
}

async function runSeedSupplierSources(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const shouldWrite = parsed.flags.has("write-bank");
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const rows = validation.sources.map(buildSupplierSeedRow);
  const enabledCount = rows.filter((row) => row.enabled).length;

  console.log("Supplier source seed plan");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Supplier rows: ${rows.length}`);
  console.log(`  Enabled rows: ${enabledCount}`);
  console.log(`  Disabled/candidate rows: ${rows.length - enabledCount}`);
  console.log("  Target table: supplier_bank_suppliers");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Scraping: no");
  console.log("");
  rows.forEach((row) => {
    const families = row.metadata.productFamilies.join(", ") || "none";
    console.log(`  - ${row.name} (${row.slug}) | ${row.integration_type} | ${row.enabled ? "enabled" : "disabled"} | ${families}`);
  });

  if (!shouldWrite) {
    console.log("");
    console.log("Dry run complete (no Supabase writes). Add --write-bank to upsert supplier registry rows.");
    return;
  }

  const writeResult = await writeSupplierSeedRows(rows);
  console.log("");
  console.log("Supplier source seed complete");
  writeResult.forEach((row) => {
    console.log(`  - ${row.name} (${row.slug}) | ${row.enabled ? "enabled" : "disabled"} | ${row.id}`);
  });
}

async function runVerifySupplierSources(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const expectedRows = validation.sources.map(buildSupplierSeedRow);
  const client = getSupabaseServiceClient();
  const slugs = expectedRows.map((row) => row.slug);

  console.log("Supplier source remote verification");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Expected supplier rows: ${expectedRows.length}`);
  console.log("  Scope: read-only supplier_bank_suppliers check");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");

  const { data, error } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,website_url,country_code,currency,integration_type,enabled,metadata,updated_at")
    .in("slug", slugs);

  if (error) {
    throw new Error(
      `Supplier-bank suppliers table is not readable yet. Apply the supplier-bank migration first. ${formatSupabaseError(error)}`
    );
  }

  const bySlug = new Map((data || []).map((row) => [row.slug, row]));
  const mismatches = [];

  expectedRows.forEach((expected) => {
    const actual = bySlug.get(expected.slug);
    if (!actual) {
      mismatches.push(`${expected.slug}: missing remote supplier row`);
      return;
    }

    const checks = [
      ["name", expected.name, actual.name],
      ["website_url", expected.website_url, actual.website_url],
      ["country_code", expected.country_code, actual.country_code],
      ["currency", expected.currency, actual.currency],
      ["integration_type", expected.integration_type, actual.integration_type],
      ["enabled", expected.enabled, actual.enabled],
    ];

    checks.forEach(([field, expectedValue, actualValue]) => {
      if (expectedValue !== actualValue) {
        mismatches.push(`${expected.slug}: ${field} expected '${expectedValue}' but found '${actualValue}'`);
      }
    });

    const registryStatus = actual.metadata?.registryStatus || null;
    if (registryStatus !== expected.metadata.registryStatus) {
      mismatches.push(`${expected.slug}: metadata.registryStatus expected '${expected.metadata.registryStatus}' but found '${registryStatus}'`);
    }
  });

  console.log("");
  console.log("Remote supplier source rows:");
  expectedRows.forEach((expected) => {
    const actual = bySlug.get(expected.slug);
    if (!actual) {
      console.log(`  - ${expected.name} (${expected.slug}) | missing`);
      return;
    }
    console.log(
      `  - ${actual.name} (${actual.slug}) | ${actual.enabled ? "enabled" : "disabled"} | ${actual.integration_type} | ${actual.id}`
    );
  });

  if (mismatches.length > 0) {
    console.log("");
    console.log("Mismatches:");
    mismatches.forEach((mismatch) => console.log(`  - ${mismatch}`));
    throw new Error(`Supplier source remote verification failed with ${mismatches.length} mismatch(es)`);
  }

  console.log("");
  console.log("Supplier source remote verification complete. Registry rows match config and no live products/prices were touched.");
}

function printSmokeSection(title) {
  console.log("");
  console.log(`=== ${title} ===`);
}

function getWmdPilotPaths() {
  const productSlug = "wmd-folder-bank-pilot";
  const normalizedSnapshots = findFiles(
    path.join("pricing_raw", "supplier-bank-normalized", "wir-machen-druck", productSlug),
    (filePath) => filePath.endsWith(".json")
  );

  return {
    cleanCsv: findLatestWmdCleanCsv(productSlug),
    latestSnapshot: normalizedSnapshots[normalizedSnapshots.length - 1] || null,
    previousSnapshot: normalizedSnapshots[normalizedSnapshots.length - 2] || null,
  };
}

function formatReportList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildWmdPilotSmokeReport({ limit }) {
  const { cleanCsv, latestSnapshot, previousSnapshot } = getWmdPilotPaths();
  if (!cleanCsv) throw new Error("No WMD clean CSV found. Run WMD bank snapshot extraction first.");
  if (!latestSnapshot) throw new Error("No WMD normalized supplier-bank snapshot found.");

  const { validation } = loadValidatedSupplierRegistry(DEFAULT_SUPPLIER_SOURCE_REGISTRY);
  const seedRows = validation.sources.map(buildSupplierSeedRow);
  const enabledRows = seedRows.filter((row) => row.enabled);
  const disabledRows = seedRows.filter((row) => !row.enabled);
  const { json: latest } = loadJsonFile(latestSnapshot);
  const { json: previous } = previousSnapshot ? loadJsonFile(previousSnapshot) : { json: null };
  const compareResult = previous
    ? compareNormalizedSnapshots({ oldSnapshot: previous, newSnapshot: latest, thresholdPct: 0 })
    : null;
  const transformedRows = normalizedFolderRowsToTransformedRows(latest.normalizedPriceRows);
  const normalizedRows = createFolderNormalizedRows(transformedRows);
  const importSummary = summarizeDraftImport({
    transformedRows,
    normalizedRows,
  });
  const quantities = uniqueValues(
    transformedRows
      .map((row) => Number(row.quantity))
      .filter(Number.isFinite)
      .sort((left, right) => left - right)
      .map(String)
  );
  const reportDate = new Date().toISOString();

  return [
    "# Supplier Bank WMD Pilot Smoke Report",
    "",
    `Generated: ${reportDate}`,
    "",
    "## Scope",
    "",
    "No Supabase writes, live product writes, publishing, supplier scraping, or live pricing writes were performed.",
    "",
    "## Supplier Registry",
    "",
    `External sources: ${validation.sources.length}`,
    `Enabled sources: ${enabledRows.length}`,
    `Disabled/candidate sources: ${disabledRows.length}`,
    "",
    "### Sources",
    "",
    formatReportList(seedRows.map((row) => `${row.name} (${row.slug}) | ${row.integration_type} | ${row.enabled ? "enabled" : "disabled"} | ${(row.metadata.productFamilies || []).join(", ") || "none"}`)),
    "",
    "### Internal Exclusions",
    "",
    formatReportList(validation.internalDomains),
    "",
    "## WMD Snapshot Inputs",
    "",
    `Clean CSV: \`${cleanCsv}\``,
    `Latest normalized snapshot: \`${latestSnapshot}\``,
    `Previous normalized snapshot: \`${previousSnapshot || "not available"}\``,
    "",
    "## Price Delta Preview",
    "",
    compareResult
      ? [
        `Old rows: ${compareResult.oldRows}`,
        `New rows: ${compareResult.newRows}`,
        `Changed rows: ${compareResult.changed.length}`,
        `Added rows: ${compareResult.added.length}`,
        `Removed rows: ${compareResult.removed.length}`,
        `Unchanged rows: ${compareResult.unchanged}`,
        `Duplicate keys old/new: ${compareResult.duplicateOldKeys}/${compareResult.duplicateNewKeys}`,
        `Displayed change limit: ${limit}`,
      ].join("\n")
      : "Skipped because fewer than two normalized snapshots were available.",
    "",
    "## Draft Import Preview",
    "",
    `Import mode: Matrix Layout V1`,
    `Normalized price rows: ${importSummary.normalizedRows}`,
    `Quantities: ${importSummary.quantityMin}-${importSummary.quantityMax}`,
    `Price range DKK: ${importSummary.priceMinDkk}-${importSummary.priceMaxDkk}`,
    `Formats/materials/surfaces: ${importSummary.formats}/${importSummary.materials}/${importSummary.surfaces}`,
    `Folds/pages/orientations: ${importSummary.folds}/${importSummary.pages}/${importSummary.orientations}`,
    `Matrix quantities: ${quantities.join(", ")}`,
    "",
    "## Guarded Remote Apply Preview",
    "",
    "The confirmed remote command remains:",
    "",
    "```bash",
    "node scripts/supplier-bank-cli.mjs apply-wmd-bank-pilot --confirm-remote-write",
    "```",
    "",
    "It validates supplier sources, applies the supplier-bank migration, seeds supplier registry rows, deploys supplier-bank Edge Functions, runs the WMD bank-only writer, and then performs read-only supplier/WMD verification.",
    "",
    "## Current Blocker",
    "",
    "`SUPABASE_ACCESS_TOKEN` is missing in the current session, so the remote migration, supplier seed, Edge Function deploy, and WMD bank-table write have not been applied.",
    "",
  ].join("\n");
}

function writeWmdPilotSmokeReport({ limit }) {
  const report = buildWmdPilotSmokeReport({ limit });
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join("docs", `SUPPLIER_PRODUCT_BANK_WMD_PILOT_SMOKE_${date}.md`);
  fs.writeFileSync(path.resolve(process.cwd(), reportPath), report, "utf8");
  return reportPath;
}

async function runSmokeWmdBankPilot(args) {
  const parsed = parseArgs(args);
  const limit = String(Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 5))));
  const shouldWriteReport = parsed.flags.has("write-report");
  const { cleanCsv, latestSnapshot, previousSnapshot } = getWmdPilotPaths();

  console.log("Supplier bank WMD pilot smoke run");
  console.log("  Scope: local no-write readiness check");
  console.log("  Supplier: wir-machen-druck");
  console.log("  Product key: wmd-folder-bank-pilot");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Supabase writes: no");

  if (!cleanCsv) {
    throw new Error("No WMD clean CSV found. Run WMD bank snapshot extraction first.");
  }
  if (!latestSnapshot) {
    throw new Error("No WMD normalized supplier-bank snapshot found.");
  }

  printSmokeSection("1. Supplier Source Registry");
  runValidateSupplierSources([]);

  printSmokeSection("2. Supplier Seed Preview");
  await runSeedSupplierSources([]);

  if (previousSnapshot) {
    printSmokeSection("3. Price Delta Preview");
    await runCompareNormalizedSnapshots([previousSnapshot, latestSnapshot, "--limit", limit]);
  } else {
    printSmokeSection("3. Price Delta Preview");
    console.log("Skipped: need at least two normalized WMD snapshots to compare.");
  }

  printSmokeSection("4. Draft Product Import Preview");
  await runImportNormalizedSnapshot([
    latestSnapshot,
    "--tenant",
    "00000000-0000-0000-0000-000000000000",
    "--name",
    "WMD Folder Draft Smoke Preview",
    "--slug",
    "wmd-folder-draft-smoke-preview",
  ]);

  printSmokeSection("5. Remote Apply Preview");
  runApplyWmdBankPilot([]);

  console.log("");
  if (shouldWriteReport) {
    const reportPath = writeWmdPilotSmokeReport({ limit });
    console.log(`Smoke report written: ${reportPath}`);
    console.log("");
  }
  console.log("WMD pilot smoke run complete. No Supabase writes, live product writes, or live pricing writes were performed.");
}

function runPreflightWmdBankPilot(args) {
  const parsed = parseArgs(args);
  const limit = String(Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 3))));
  const nodeBin = resolveLocalNodeBinary();
  const denoBin = resolveDenoBinary();

  if (!denoBin) {
    throw new Error("Deno runtime not found. Install Deno or set DENO_BIN before supplier-bank Edge Function preflight.");
  }

  console.log("Supplier bank WMD local preflight");
  console.log("  Scope: local no-write readiness gate");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Supabase writes: no");

  runCommand(nodeBin, ["--check", "scripts/supplier-bank-cli.mjs"], "supplier-bank CLI syntax");
  runCommand(nodeBin, ["scripts/supplier-bank-cli.mjs", "smoke-wmd-bank-pilot", "--limit", limit], "WMD pilot smoke");
  runCommand(denoBin, ["check", "supabase/functions/supplier-bank-import-draft/index.ts"], "supplier-bank import Edge Function check");
  runCommand(denoBin, ["check", "supabase/functions/supplier-bank-create-delta-review/index.ts"], "supplier-bank delta review Edge Function check");
  runCommand(nodeBin, ["scripts/check-supabase-migration-grants.js"], "Supabase Data API grant check");
  runCommand(nodeBin, ["scripts/check-supabase-function-exposure.js"], "Supabase function exposure check");

  console.log("");
  console.log("Supplier bank WMD local preflight complete. Remote apply still requires SUPABASE_ACCESS_TOKEN and explicit --confirm-remote-write.");
}

function runDoctor() {
  const checks = [];
  const denoBinary = resolveDenoBinary();
  const fullWmdProductSlug = WMD_FULL_BANK_PRODUCT_KEY;
  const normalizedSnapshots = findFiles(
    path.join("pricing_raw", "supplier-bank-normalized", "wir-machen-druck", fullWmdProductSlug),
    (filePath) => filePath.endsWith(".json")
  );
  const cleanCsvs = findFiles(
    path.join("pricing_clean", fullWmdProductSlug),
    (filePath) => filePath.endsWith(".csv")
  );
  const latestNormalizedSnapshot = normalizedSnapshots[normalizedSnapshots.length - 1] || null;
  const latestCleanCsv = cleanCsvs[cleanCsvs.length - 1] || null;

  addDoctorCheck(
    checks,
    "Supplier-bank migration",
    fileExists("supabase/migrations/20260701120000_supplier_product_bank.sql"),
    "supabase/migrations/20260701120000_supplier_product_bank.sql"
  );
  addDoctorCheck(
    checks,
    "Draft import Edge Function",
    fileExists("supabase/functions/supplier-bank-import-draft/index.ts"),
    "supabase/functions/supplier-bank-import-draft/index.ts"
  );
  addDoctorCheck(
    checks,
    "Delta review Edge Function",
    fileExists("supabase/functions/supplier-bank-create-delta-review/index.ts"),
    "supabase/functions/supplier-bank-create-delta-review/index.ts"
  );
  addDoctorCheck(
    checks,
    "Supabase function config",
    fileExists("supabase/config.toml"),
    "supabase/config.toml"
  );
  addDoctorCheck(
    checks,
    "Supplier source registry",
    fileExists(DEFAULT_SUPPLIER_SOURCE_REGISTRY),
    DEFAULT_SUPPLIER_SOURCE_REGISTRY
  );
  addDoctorCheck(
    checks,
    "WMD normalized snapshots",
    normalizedSnapshots.length > 0,
    latestNormalizedSnapshot || "No normalized WMD snapshots found"
  );
  addDoctorCheck(
    checks,
    "WMD clean CSV",
    cleanCsvs.length > 0,
    latestCleanCsv || "No clean WMD CSV found"
  );
  addDoctorCheck(
    checks,
    "Supabase project access token",
    Boolean(process.env.SUPABASE_ACCESS_TOKEN),
    process.env.SUPABASE_ACCESS_TOKEN ? "SUPABASE_ACCESS_TOKEN is set" : "Missing SUPABASE_ACCESS_TOKEN"
  );
  addDoctorCheck(
    checks,
    "Supabase URL",
    Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "Missing SUPABASE_URL/VITE_SUPABASE_URL"
  );
  addDoctorCheck(
    checks,
    "Supabase service role key",
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    process.env.SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY is set" : "Missing SUPABASE_SERVICE_ROLE_KEY"
  );
  addDoctorCheck(
    checks,
    "Deno runtime for Edge Function check",
    Boolean(denoBinary),
    denoBinary || "deno not found",
    false
  );

  console.log("Supplier bank readiness check");
  checks.forEach((check) => {
    console.log(`  [${formatDoctorStatus(check.ok)}] ${check.label}: ${check.detail}`);
  });

  console.log("");
  console.log("Next guarded commands after credentials are available:");
  console.log("  node scripts/supplier-bank-cli.mjs validate-supplier-sources");
  console.log("  node_modules/.bin/supabase migration list");
  console.log("  node_modules/.bin/supabase db query --linked --file supabase/migrations/20260701120000_supplier_product_bank.sql");
  console.log("  node_modules/.bin/supabase migration repair --linked --status applied 20260701120000");
  console.log("  node scripts/supplier-bank-cli.mjs seed-supplier-sources --write-bank");
  console.log("  node_modules/.bin/supabase functions deploy supplier-bank-import-draft supplier-bank-create-delta-review --use-api");
  if (latestCleanCsv) {
    console.log(
      `  ${resolveLocalNodeBinary()} scripts/fetch-folders-import.js import --bank-snapshot-only --write-bank --from-clean-csv ${latestCleanCsv} --name "${WMD_FULL_BANK_PRODUCT_NAME}" --slug ${fullWmdProductSlug}`
    );
  }
  console.log("  node scripts/supplier-bank-cli.mjs verify-supplier-sources");
  console.log(`  node scripts/supplier-bank-cli.mjs verify-wmd-bank-pilot --product-key ${fullWmdProductSlug}`);

  const failedRequired = checks.filter((check) => check.required && !check.ok);
  if (failedRequired.length > 0) {
    console.log("");
    console.log(`Readiness failed: ${failedRequired.length} required item(s) missing.`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("Readiness passed for required items. Optional Deno check may still need local runtime setup.");
}

function runApplyWmdBankPilot(args) {
  const parsed = parseArgs(args);
  const confirmRemoteWrite = parsed.flags.has("confirm-remote-write");
  const skipMigrationApply = parsed.flags.has("skip-migration-apply") || parsed.flags.has("skip-db-push");
  const skipFunctionDeploy = parsed.flags.has("skip-function-deploy");
  const productSlug = parsed.values.slug || "wmd-folder-bank-pilot";
  const cleanCsv = parsed.values["from-clean-csv"] || findLatestWmdCleanCsv(productSlug);
  const productName = parsed.values.name || (productSlug === WMD_FULL_BANK_PRODUCT_KEY ? WMD_FULL_BANK_PRODUCT_NAME : "WMD Folder Bank Pilot");
  const migrationVersion = "20260701120000";
  const migrationFile = path.join("supabase", "migrations", `${migrationVersion}_supplier_product_bank.sql`);
  const supabaseBin = path.resolve(process.cwd(), "node_modules", ".bin", "supabase");
  const nodeBin = resolveLocalNodeBinary();
  const validateSupplierArgs = ["scripts/supplier-bank-cli.mjs", "validate-supplier-sources"];
  const seedSupplierArgs = ["scripts/supplier-bank-cli.mjs", "seed-supplier-sources", "--write-bank"];
  const verifySupplierArgs = ["scripts/supplier-bank-cli.mjs", "verify-supplier-sources"];
  const verifyWmdArgs = ["scripts/supplier-bank-cli.mjs", "verify-wmd-bank-pilot", "--product-key", productSlug];

  if (!cleanCsv) {
    throw new Error("No WMD clean CSV found. Run the WMD bank snapshot extraction before applying remote writes.");
  }

  const writeArgs = [
    "scripts/fetch-folders-import.js",
    "import",
    "--bank-snapshot-only",
    "--write-bank",
    "--from-clean-csv",
    cleanCsv,
    "--name",
    productName,
    "--slug",
    productSlug,
  ];

  console.log("Supplier bank WMD remote apply plan");
  console.log("  Scope: supplier-bank migration plus WMD bank-table rows only");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Clean CSV: ${cleanCsv}`);
  console.log(`  Bank product: ${productName} (${productSlug})`);
  console.log("");
  console.log("Commands:");
  console.log(`  ${nodeBin} ${validateSupplierArgs.join(" ")}`);
  console.log(`  ${supabaseBin} migration list`);
  if (!skipMigrationApply) {
    console.log(`  ${supabaseBin} db query --linked --file ${migrationFile}`);
    console.log(`  ${supabaseBin} migration repair --linked --status applied ${migrationVersion}`);
  }
  console.log(`  ${nodeBin} ${seedSupplierArgs.join(" ")}`);
  if (!skipFunctionDeploy) {
    console.log(`  ${supabaseBin} functions deploy supplier-bank-import-draft supplier-bank-create-delta-review --use-api`);
  }
  console.log(`  ${nodeBin} ${writeArgs.join(" ")}`);
  console.log(`  ${nodeBin} ${verifySupplierArgs.join(" ")}`);
  console.log(`  ${nodeBin} ${verifyWmdArgs.join(" ")}`);

  if (!confirmRemoteWrite) {
    console.log("");
    console.log("Preview only. Add --confirm-remote-write to run the remote migration/write-bank sequence.");
    return;
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN. Refusing remote migration/write-bank run.");
  }
  getSupabaseEnv();
  if (!fs.existsSync(supabaseBin)) {
    throw new Error(`Supabase CLI not found at ${supabaseBin}`);
  }

  runCommand(nodeBin, validateSupplierArgs, "supplier source validation");
  runCommand(supabaseBin, ["migration", "list"], "supabase migration list");
  if (!skipMigrationApply) {
    runCommand(supabaseBin, ["db", "query", "--linked", "--file", migrationFile], "supplier-bank migration apply");
    runCommand(
      supabaseBin,
      ["migration", "repair", "--linked", "--status", "applied", migrationVersion],
      "supplier-bank migration history repair"
    );
  }
  runCommand(nodeBin, seedSupplierArgs, "supplier source seed");
  if (!skipFunctionDeploy) {
    runCommand(
      supabaseBin,
      ["functions", "deploy", "supplier-bank-import-draft", "supplier-bank-create-delta-review", "--use-api"],
      "supabase functions deploy"
    );
  }
  runCommand(nodeBin, writeArgs, "WMD supplier bank writer");
  runCommand(nodeBin, verifySupplierArgs, "supplier source verification");
  runCommand(nodeBin, verifyWmdArgs, "WMD supplier bank verification");

  console.log("");
  console.log("WMD supplier-bank remote apply and verification complete.");
}

function runRefreshWmdBank(args) {
  const parsed = parseArgs(args);
  const confirmBankWrite = parsed.flags.has("confirm-bank-write");
  const productSlug = WMD_FULL_BANK_PRODUCT_KEY;
  const productName = WMD_FULL_BANK_PRODUCT_NAME;
  const nodeBin = resolveLocalNodeBinary();
  const validateSupplierArgs = ["scripts/supplier-bank-cli.mjs", "validate-supplier-sources"];
  const verifySupplierArgs = ["scripts/supplier-bank-cli.mjs", "verify-supplier-sources"];
  const verifyWmdArgs = ["scripts/supplier-bank-cli.mjs", "verify-wmd-bank"];
  const refreshArgs = [
    "scripts/fetch-folders-import.js",
    "import",
    "--bank-snapshot-only",
    "--name",
    productName,
    "--slug",
    productSlug,
  ];

  if (parsed.values["from-clean-csv"]) {
    refreshArgs.push("--from-clean-csv", parsed.values["from-clean-csv"]);
  }

  if (parsed.values["max-detail-pages"]) {
    refreshArgs.push("--max-detail-pages", parsed.values["max-detail-pages"]);
  }

  if (confirmBankWrite) {
    refreshArgs.splice(3, 0, "--write-bank");
  }

  console.log("Supplier bank WMD refresh plan");
  console.log("  Scope: WMD supplier-bank snapshot refresh only");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Bank product: ${productName} (${productSlug})`);
  console.log(`  Source mode: ${parsed.values["from-clean-csv"] ? "clean CSV replay" : "fresh WMD scrape"}`);
  console.log("");
  console.log("Commands:");
  console.log(`  ${nodeBin} ${validateSupplierArgs.join(" ")}`);
  console.log(`  ${nodeBin} ${refreshArgs.join(" ")}`);
  console.log(`  ${nodeBin} ${verifySupplierArgs.join(" ")}`);
  console.log(`  ${nodeBin} ${verifyWmdArgs.join(" ")}`);

  if (!confirmBankWrite) {
    console.log("");
    console.log("Preview only. Add --confirm-bank-write to create a new supplier-bank scrape run and price snapshot.");
    return;
  }

  getSupabaseEnv();
  runCommand(nodeBin, validateSupplierArgs, "supplier source validation");
  runCommand(nodeBin, refreshArgs, "WMD supplier bank snapshot refresh");
  runCommand(nodeBin, verifySupplierArgs, "supplier source verification");
  runCommand(nodeBin, verifyWmdArgs, "WMD supplier bank verification");

  console.log("");
  console.log("WMD supplier-bank refresh and verification complete.");
}

function findLatestPixartExtractionFile(profile) {
  const prefix = PIXART_IMPORT_PREFIX_BY_PROFILE[profile];
  if (!prefix) throw new Error(`Unsupported Pixart profile: ${profile}`);
  const extractionPattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{4}-\\d{2}-\\d{2}T.*\\.json$`);
  const files = findFiles("pricing_raw", (filePath) => {
    const name = path.basename(filePath);
    return extractionPattern.test(name);
  });
  return files[files.length - 1] || null;
}

function runNormalizePixartExtractionPreview(args) {
  const parsed = parseArgs(args);
  const rawPath = parsed.positionals[0];
  if (!rawPath) throw new Error(`Missing Pixart raw extraction path\n\n${usage()}`);
  const requestedProfile = normalizeText(parsed.values.profile);
  const { path: resolvedPath, json } = loadJsonFile(rawPath);
  const profile = requestedProfile || normalizeText(json?.meta?.profile) || (
    path.basename(resolvedPath).startsWith(PIXART_IMPORT_PREFIX_BY_PROFILE.rigids)
      ? "rigids"
      : "flat-surface-adhesive"
  );
  if (!PIXART_PROFILES.has(profile)) {
    throw new Error("--profile must be either 'flat-surface-adhesive' or 'rigids'");
  }

  const rows = Array.isArray(json.rows) ? json.rows : [];
  const validRows = countValidPixartRows(json);
  const errorCounts = rows.reduce((acc, row) => {
    const error = normalizeText(row.error || "none");
    acc[error] = (acc[error] || 0) + 1;
    return acc;
  }, {});
  const completeExtraction = rows.length > 0
    && validRows === rows.length
    && Object.keys(errorCounts).every((key) => key === "none");

  console.log("Supplier bank Pixart extraction normalization preview");
  console.log("  Scope: local raw extraction -> local supplier-bank preview");
  console.log("  Supplier-bank DB writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Profile: ${profile}`);
  console.log(`  Raw extraction: ${resolvedPath}`);
  console.log(`  Attempted rows: ${rows.length}`);
  console.log(`  Valid priced rows: ${validRows}`);
  console.log(`  Error counts: ${JSON.stringify(errorCounts)}`);

  if (!completeExtraction) {
    throw new Error("Pixart raw extraction is partial; refusing to create a normalized supplier-bank preview.");
  }

  const previewSnapshotPath = createPixartBankPreviewSnapshot(profile, json, resolvedPath);
  assertPixartBankPreviewSnapshot(loadJsonFile(previewSnapshotPath).json, path.resolve(previewSnapshotPath));
  console.log(`  Supplier-bank normalized preview: ${previewSnapshotPath}`);
  console.log("");
  console.log("Preview only. No supplier-bank rows, products, published products, or live prices were written.");
}

function countValidPixartRows(payload) {
  const hasFinitePrice = (value) => {
    if (value === null || value === undefined || value === "") return false;
    return Number.isFinite(Number(value));
  };
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.filter((row) => {
    if (row.error) return false;
    return hasFinitePrice(row.cheapest_quote_eur) || hasFinitePrice(row.cheapest_price_per_m2_eur);
  }).length;
}

function stableJsonChecksum(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createPixartBankPreviewSnapshot(profile, payload, sourcePath) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const validRows = rows.filter((row) => {
    if (row.error) return false;
    if (row.cheapest_quote_eur === null || row.cheapest_quote_eur === undefined || row.cheapest_quote_eur === "") return false;
    return Number.isFinite(Number(row.cheapest_quote_eur));
  });

  if (!validRows.length) {
    throw new Error("Cannot create Pixart supplier-bank preview snapshot without valid priced rows");
  }

  const failedRows = rows.length - validRows.length;
  const errorCounts = rows.reduce((acc, row) => {
    const error = normalizeText(row.error || "none");
    acc[error] = (acc[error] || 0) + 1;
    return acc;
  }, {});

  const eurToDkk = 7.6;
  const markupPct = profile === "rigids" ? 0 : 80;
  const factor = eurToDkk * (1 + markupPct / 100);
  const productKey = `pixart-${profile}`;
  const productFamily = profile === "rigids" ? "signs" : "stickers";
  const createdAt = normalizeText(payload?.meta?.extracted_at) || new Date().toISOString();
  const fileStamp = createdAt.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const outputDir = path.join(
    "pricing_raw",
    "supplier-bank-normalized",
    "pixartprinting",
    productKey,
  );
  ensureDir(outputDir);

  const normalizedRows = validRows.map((row) => {
    const cheapestEur = Number(row.cheapest_quote_eur);
    const fastestEur = Number(row.fastest_quote_eur);
    const proposedDkk = Number((cheapestEur * factor).toFixed(2));
    const isRigids = profile === "rigids";
    const category = normalizeText(row.category);
    const material = normalizeText(row.material);
    const printing = normalizeText(row.printing || "Front side only printing");
    const white = normalizeText(row.white || "None");
    const cut = normalizeText(row.cut || "Rectangular");
    const finishLabel = isRigids
      ? `Printing: ${printing} | White: ${white} | Cut: ${cut}`
      : normalizeText(row.lamination || "None");
    return {
      supplier_row_key: isRigids
        ? [
            category,
            material,
            printing,
            white,
            cut,
            Number(row.area_m2),
            Number(row.width_cm),
            Number(row.height_cm),
            Number(row.quantity),
          ].join("|")
        : [
            material,
            finishLabel,
            Number(row.area_m2),
            Number(row.width_cm),
            Number(row.height_cm),
            Number(row.quantity),
          ].join("|"),
      product_family: productFamily,
      category_original: isRigids ? category : null,
      material_original: material,
      material_da: material,
      finish_original: finishLabel,
      finish_da: isRigids ? finishLabel : normalizeText(row.lamination || "Ingen laminering"),
      printing_original: isRigids ? printing : null,
      white_original: isRigids ? white : null,
      cut_original: isRigids ? cut : null,
      area_m2: Number(row.area_m2),
      width_cm: Number(row.width_cm),
      height_cm: Number(row.height_cm),
      quantity: Number(row.quantity),
      supplier_currency: "EUR",
      fastest_quote_eur: Number.isFinite(fastestEur) ? fastestEur : null,
      cheapest_quote_eur: cheapestEur,
      cheapest_price_per_m2_eur: Number(row.cheapest_price_per_m2_eur),
      proposed_price_dkk: proposedDkk,
      conversion: {
        eur_to_dkk: eurToDkk,
        markup_pct: markupPct,
        factor,
      },
    };
  });

  const prices = normalizedRows.map((row) => row.proposed_price_dkk).filter((value) => Number.isFinite(value));
  const quantities = normalizedRows.map((row) => row.quantity).filter((value) => Number.isFinite(value));
  const areas = normalizedRows.map((row) => row.area_m2).filter((value) => Number.isFinite(value));

  const snapshot = {
    schema_version: 1,
    snapshot_type: "supplier-bank-preview",
    created_at: new Date().toISOString(),
    source_snapshot_path: sourcePath,
    supplier: {
      slug: "pixartprinting",
      name: "Pixartprinting",
      website_url: "https://www.pixartprinting.com",
      country_code: "IT",
      currency: "EUR",
      integration_type: "scrape",
    },
    bank_product: {
      supplier_product_key: productKey,
      source_url: payload?.meta?.url || null,
      product_family: productFamily,
      name_original: profile === "rigids" ? "Pixart Rigids" : "Pixart Flat Surface Adhesive",
      name_da: profile === "rigids" ? "Pixart pladematerialer" : "Pixart selvklaebende folie",
      source_language: "en",
      target_language: "da",
      status: "preview",
      scrape_status: "local_preview",
    },
    summary: {
      rows: normalizedRows.length,
      attempted_rows: rows.length,
      valid_rows: validRows.length,
      failed_rows: failedRows,
      error_counts: errorCounts,
      materials: [...new Set(normalizedRows.map((row) => row.material_original))].length,
      finishes: [...new Set(normalizedRows.map((row) => row.finish_original))].length,
      quantity_min: quantities.length ? Math.min(...quantities) : null,
      quantity_max: quantities.length ? Math.max(...quantities) : null,
      area_min_m2: areas.length ? Math.min(...areas) : null,
      area_max_m2: areas.length ? Math.max(...areas) : null,
      price_min_dkk: prices.length ? Math.min(...prices) : null,
      price_max_dkk: prices.length ? Math.max(...prices) : null,
    },
    raw_rows: validRows,
    normalized_rows: normalizedRows,
  };

  const outputPath = path.join(outputDir, `${fileStamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
  return outputPath;
}

function requireAcceptedLatestReviewForStoredPixart(context) {
  if (!context.latestSnapshot) {
    throw new Error("Pixart has no supplier-bank price snapshot.");
  }
  if (context.bankProduct.status !== "approved") {
    throw new Error(`Pixart bank product must be approved before storformat preview. Current status: ${context.bankProduct.status}`);
  }
  if (context.snapshots.length >= 2) {
    if (!context.latestReview) {
      throw new Error("Pixart has multiple snapshots; create and accept the latest delta review before storformat preview.");
    }
    if (context.latestReview.new_price_snapshot_id !== context.latestSnapshot.id) {
      throw new Error("Pixart latest delta review does not target the latest supplier-bank snapshot.");
    }
    if (context.latestReview.status !== "accepted") {
      throw new Error(`Pixart latest delta review is ${context.latestReview.status}; accept it before storformat preview.`);
    }
  }
}

function pixartQuoteToPerM2(row, quoteKey) {
  const area = Number(row.area_m2);
  const quantity = Number(row.quantity);
  const quote = Number(row[quoteKey]);
  const totalArea = area * quantity;
  if (!Number.isFinite(quote) || !Number.isFinite(totalArea) || totalArea <= 0) return null;
  return Number((quote / totalArea).toFixed(6));
}

function buildPixartStorformatImportPayload({ context, productName, productSlug }) {
  const rows = Array.isArray(context.latestSnapshot.normalized_price_rows)
    ? context.latestSnapshot.normalized_price_rows
    : [];
  const transformedRows = rows
    .map((row) => {
      const material = normalizeText(row.material_original || row.material_da);
      const lamination = normalizeText(row.finish_original || row.finish_da || "None");
      const areaM2 = Number(row.area_m2);
      const quantity = Number(row.quantity);
      const cheapestPerM2 = Number.isFinite(Number(row.cheapest_price_per_m2_eur))
        ? Number(row.cheapest_price_per_m2_eur)
        : pixartQuoteToPerM2(row, "cheapest_quote_eur");
      const fastestPerM2 = Number.isFinite(Number(row.fastest_price_per_m2_eur))
        ? Number(row.fastest_price_per_m2_eur)
        : pixartQuoteToPerM2(row, "fastest_quote_eur");

      if (!material || !Number.isFinite(areaM2) || !Number.isFinite(quantity) || !Number.isFinite(cheapestPerM2)) {
        return null;
      }

      return {
        material,
        lamination: lamination || "None",
        area_m2: areaM2,
        width_cm: Number(row.width_cm),
        height_cm: Number(row.height_cm),
        quantity,
        fastest_quote_eur: finiteNumberOrNull(row.fastest_quote_eur),
        cheapest_quote_eur: finiteNumberOrNull(row.cheapest_quote_eur),
        fastest_price_per_m2_eur: fastestPerM2,
        cheapest_price_per_m2_eur: cheapestPerM2,
        supplier_row_key: row.supplier_row_key || null,
      };
    })
    .filter(Boolean);

  if (!transformedRows.length) {
    throw new Error("Pixart supplier-bank snapshot has no rows that can be transformed for storformat dry-run.");
  }

  const materialsUsed = uniqueValues(transformedRows.map((row) => row.material));
  const laminationsUsed = uniqueValues(transformedRows.map((row) => row.lamination));
  const quantitiesUsed = uniqueValues(transformedRows.map((row) => Math.round(Number(row.quantity))).filter((quantity) => quantity > 0))
    .sort((left, right) => left - right);

  return {
    meta: {
      profile: "flat-surface-adhesive",
      source: "supplier-bank",
      source_supplier: context.supplier.slug,
      bank_product_id: context.bankProduct.id,
      bank_product_key: context.bankProduct.supplier_product_key,
      price_snapshot_id: context.latestSnapshot.id,
      extracted_at: context.latestSnapshot.created_at || new Date().toISOString(),
      preview_product_name: productName,
      preview_product_slug: productSlug,
      materials_used: materialsUsed,
      laminations_used: laminationsUsed,
      quantities_used: quantitiesUsed,
      source_snapshot_path: getSnapshotLocalPath(context.latestSnapshot) || null,
    },
    rows: transformedRows,
  };
}

function buildPixartRigidsStorformatImportPayload({ context, productPrefix, productSlugPrefix }) {
  const rows = Array.isArray(context.latestSnapshot.raw_price_rows)
    ? context.latestSnapshot.raw_price_rows
    : [];
  const transformedRows = rows
    .map((row) => {
      const category = normalizeText(row.category);
      const material = normalizeText(row.material);
      const printing = normalizeText(row.printing);
      const white = normalizeText(row.white);
      const cut = normalizeText(row.cut);
      const areaM2 = Number(row.area_m2);
      const quantity = Number(row.quantity);
      const cheapestPerM2 = Number(row.cheapest_price_per_m2_eur);

      if (
        !category
        || !material
        || !Number.isFinite(areaM2)
        || !Number.isFinite(quantity)
        || !Number.isFinite(cheapestPerM2)
      ) {
        return null;
      }

      return {
        category,
        material,
        printing: printing || "Front side only printing",
        white: white || "None",
        cut: cut || "Rectangular",
        area_m2: areaM2,
        width_cm: finiteNumberOrNull(row.width_cm),
        height_cm: finiteNumberOrNull(row.height_cm),
        quantity,
        fastest_quote_eur: finiteNumberOrNull(row.fastest_quote_eur),
        cheapest_quote_eur: finiteNumberOrNull(row.cheapest_quote_eur),
        fastest_price_per_m2_eur: finiteNumberOrNull(row.fastest_price_per_m2_eur),
        cheapest_price_per_m2_eur: cheapestPerM2,
        fastest_unit_price_eur: finiteNumberOrNull(row.fastest_unit_price_eur),
        cheapest_unit_price_eur: finiteNumberOrNull(row.cheapest_unit_price_eur),
        supplier_row_key: row.supplier_row_key || null,
      };
    })
    .filter(Boolean);

  if (!transformedRows.length) {
    throw new Error("Pixart rigids supplier-bank snapshot has no raw rows that can be transformed for storformat dry-run.");
  }

  const categoriesUsed = uniqueValues(transformedRows.map((row) => row.category));
  const materialsUsed = uniqueValues(transformedRows.map((row) => row.material));
  const quantitiesUsed = uniqueValues(transformedRows.map((row) => Math.round(Number(row.quantity))).filter((quantity) => quantity > 0))
    .sort((left, right) => left - right);

  return {
    meta: {
      profile: "rigids",
      source: "supplier-bank",
      source_supplier: context.supplier.slug,
      bank_product_id: context.bankProduct.id,
      bank_product_key: context.bankProduct.supplier_product_key,
      price_snapshot_id: context.latestSnapshot.id,
      extracted_at: context.latestSnapshot.created_at || new Date().toISOString(),
      preview_product_prefix: productPrefix,
      preview_product_slug_prefix: productSlugPrefix,
      categories_used: categoriesUsed,
      materials_used: materialsUsed,
      quantities_used: quantitiesUsed,
      source_snapshot_path: getSnapshotLocalPath(context.latestSnapshot) || null,
    },
    rows: transformedRows,
  };
}

async function getProductByTenantSlug(client, tenantId, productSlug) {
  const { data, error } = await client
    .from("products")
    .select("id,tenant_id,slug,name,is_published,pricing_type,technical_specs")
    .eq("tenant_id", tenantId)
    .eq("slug", productSlug)
    .maybeSingle();
  if (error) throw new Error(`Target product lookup failed. ${formatSupabaseError(error)}`);
  return data || null;
}

async function countProductRows(client, tableName, productId, options = {}) {
  const { count, error } = await client
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) {
    const message = error.message || "";
    if (options.ignoreMissingTable && message.includes("Could not find the table")) return null;
    throw new Error(`Count ${tableName} failed. ${formatSupabaseError(error)}`);
  }
  return count ?? 0;
}

async function cleanupUnpublishedPixartStorformatDraft(client, product) {
  if (!product?.id) return false;
  if (product.is_published) {
    throw new Error(`Refusing cleanup for published product '${product.slug}' (${product.id}).`);
  }
  if (product.pricing_type !== "STORFORMAT") {
    throw new Error(`Refusing cleanup for non-STORFORMAT product '${product.slug}' (${product.id}).`);
  }
  if (product.technical_specs?.source !== "pixart") {
    throw new Error(`Refusing cleanup for non-Pixart product '${product.slug}' (${product.id}).`);
  }

  const deleteByProduct = async (tableName, options = {}) => {
    const { error } = await client.from(tableName).delete().eq("product_id", product.id);
    if (error) {
      const message = error.message || "";
      if (options.ignoreMissingTable && message.includes("Could not find the table")) return;
      throw new Error(`Cleanup ${tableName} failed. ${formatSupabaseError(error)}`);
    }
  };

  await deleteByProduct("storformat_product_m2_prices", { ignoreMissingTable: true });
  await deleteByProduct("storformat_product_price_tiers");
  await deleteByProduct("storformat_product_fixed_prices");
  await deleteByProduct("storformat_m2_prices");
  await deleteByProduct("storformat_finish_prices");
  await deleteByProduct("storformat_material_price_tiers");
  await deleteByProduct("storformat_finish_price_tiers");
  await deleteByProduct("storformat_products");
  await deleteByProduct("storformat_finishes");
  await deleteByProduct("storformat_materials");
  await deleteByProduct("storformat_configs");

  const { error: productError } = await client
    .from("products")
    .delete()
    .eq("id", product.id)
    .eq("is_published", false);
  if (productError) throw new Error(`Cleanup product failed. ${formatSupabaseError(productError)}`);
  return true;
}

async function runPreviewPixartStorformatImport(args) {
  const parsed = parseArgs(args);
  const shouldWriteDraft = parsed.flags.has("write-draft-product");
  const targetTenantId = parsed.values.tenant || MASTER_TENANT_ID;
  const context = await getPixartRemoteContext();
  requireAcceptedLatestReviewForStoredPixart(context);

  const productName = normalizeText(parsed.values["product-name"])
    || context.bankProduct.name_da
    || context.bankProduct.name_original
    || "Pixart selvklaebende folie";
  const productSlug = slugify(
    parsed.values["product-slug"]
    || `${context.bankProduct.supplier_product_key}-storformat-draft`
  );
  const payload = buildPixartStorformatImportPayload({ context, productName, productSlug });
  const outputDir = path.join("pricing_raw", "supplier-bank-storformat-preview", "pixartprinting", context.bankProduct.supplier_product_key);
  ensureDir(outputDir);
  const outputPath = path.join(outputDir, `${timestampForFile()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  const client = getSupabaseServiceClient();
  const existingProduct = await getProductByTenantSlug(client, targetTenantId, productSlug);
  if (shouldWriteDraft && existingProduct) {
    throw new Error(`Refusing to overwrite existing product slug '${productSlug}' (${existingProduct.id}). Choose a fresh --product-slug.`);
  }

  const materialCount = uniqueValues(payload.rows.map((row) => row.material)).length;
  const laminationCount = uniqueValues(payload.rows.map((row) => row.lamination)).length;
  const quantityCount = uniqueValues(payload.rows.map((row) => row.quantity)).length;
  const areaCount = uniqueValues(payload.rows.map((row) => row.area_m2)).length;

  console.log("Supplier bank Pixart storformat import preview");
  console.log(`  Scope: ${shouldWriteDraft ? "guarded unpublished storformat draft import" : "read-only storformat dry-run bridge"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log(`  Product writes: ${shouldWriteDraft ? "yes, unpublished draft only" : "no"}`);
  console.log("  Live pricing writes: no");
  console.log(`  Supplier: ${context.supplier.name} (${context.supplier.slug})`);
  console.log(`  Bank product: ${context.bankProduct.name_da || context.bankProduct.name_original} (${context.bankProduct.supplier_product_key})`);
  console.log(`  Latest snapshot: ${context.latestSnapshot.id}`);
  console.log(`  Latest review: ${context.latestReview?.status || "none"}`);
  console.log(`  Target tenant: ${targetTenantId}`);
  console.log(`  Target product slug: ${productSlug}`);
  console.log(`  Target slug exists: ${existingProduct ? `yes (${existingProduct.id})` : "no"}`);
  console.log(`  Derived preview file: ${outputPath}`);
  console.log(`  Rows/materials/finishes: ${payload.rows.length}/${materialCount}/${laminationCount}`);
  console.log(`  Areas/quantities: ${areaCount}/${quantityCount}`);
  console.log("");
  console.log("Running existing Pixart storformat importer in dry-run mode...");

  const nodeBin = resolveLocalNodeBinary();
  runCommand(nodeBin, [
    "scripts/fetch-pixart-flat-surface-adhesive-import.mjs",
    "import",
    "--profile",
    "flat-surface-adhesive",
    "--input",
    outputPath,
    "--dry-run",
    "--tenant-id",
    targetTenantId,
    "--product-name",
    productName,
    "--product-slug",
    productSlug,
  ], "Pixart supplier-bank storformat dry-run");

  if (!shouldWriteDraft) {
    console.log("");
    console.log("Dry-run complete. Add --write-draft-product to create an unpublished storformat draft after review.");
    return;
  }

  console.log("");
  console.log("Dry-run passed. Creating unpublished Pixart storformat draft...");
  try {
    runCommand(nodeBin, [
      "scripts/fetch-pixart-flat-surface-adhesive-import.mjs",
      "import",
      "--profile",
      "flat-surface-adhesive",
      "--input",
      outputPath,
      "--tenant-id",
      targetTenantId,
      "--product-name",
      productName,
      "--product-slug",
      productSlug,
    ], "Pixart supplier-bank storformat draft import");
  } catch (error) {
    const createdProduct = await getProductByTenantSlug(client, targetTenantId, productSlug);
    if (createdProduct) {
      console.warn(`Import failed after product creation; cleaning up unpublished Pixart draft ${createdProduct.id}.`);
      await cleanupUnpublishedPixartStorformatDraft(client, createdProduct);
    }
    throw error;
  }

  const createdProduct = await getProductByTenantSlug(client, targetTenantId, productSlug);
  if (!createdProduct) {
    throw new Error(`Pixart import finished but target product was not found: ${productSlug}`);
  }
  if (createdProduct.is_published) {
    throw new Error(`Pixart supplier-bank draft import created a published product unexpectedly: ${createdProduct.id}`);
  }
  if (createdProduct.pricing_type !== "STORFORMAT") {
    throw new Error(`Pixart supplier-bank draft import created unexpected pricing_type '${createdProduct.pricing_type}'.`);
  }

  const storformatCounts = {
    materials: await countProductRows(client, "storformat_materials", createdProduct.id),
    finishes: await countProductRows(client, "storformat_finishes", createdProduct.id),
    variants: await countProductRows(client, "storformat_products", createdProduct.id),
    materialTiers: await countProductRows(client, "storformat_material_price_tiers", createdProduct.id),
    materialM2Prices: await countProductRows(client, "storformat_m2_prices", createdProduct.id),
    finishTiers: await countProductRows(client, "storformat_finish_price_tiers", createdProduct.id),
    finishPrices: await countProductRows(client, "storformat_finish_prices", createdProduct.id),
    variantTiers: await countProductRows(client, "storformat_product_price_tiers", createdProduct.id),
    variantM2Prices: await countProductRows(client, "storformat_product_m2_prices", createdProduct.id, { ignoreMissingTable: true }),
  };

  const { data: importJob, error: jobError } = await client
    .from("supplier_bank_import_jobs")
    .insert({
      bank_product_id: context.bankProduct.id,
      target_tenant_id: targetTenantId,
      target_product_id: createdProduct.id,
      import_mode: "storformat",
      status: "imported",
      import_summary: {
        source: "pixart-supplier-bank-storformat",
        priceSnapshotId: context.latestSnapshot.id,
        latestReviewId: context.latestReview?.id || null,
        derivedPreviewPath: outputPath,
        rowsPrepared: payload.rows.length,
        materialCount,
        laminationCount,
        areaCount,
        quantityCount,
        productSlug,
        productIsPublished: createdProduct.is_published,
        storformatCounts,
      },
      rollback_note: "Delete the unpublished STORFORMAT draft product and related storformat_* rows if rollback is needed. Do not publish until reviewed in admin.",
      created_by: null,
    })
    .select("id")
    .single();
  if (jobError) throw new Error(`Supplier-bank import job insert failed. ${formatSupabaseError(jobError)}`);

  console.log("");
  console.log("Pixart storformat draft import complete");
  console.log(`  Product: ${createdProduct.name} (${createdProduct.id})`);
  console.log(`  Slug: ${createdProduct.slug}`);
  console.log(`  Published: ${createdProduct.is_published ? "yes" : "no"}`);
  console.log(`  Import job: ${importJob.id}`);
  console.log(`  Storformat counts: ${JSON.stringify(storformatCounts)}`);
}

async function runPreviewPixartRigidsStorformatImport(args) {
  const parsed = parseArgs(args);
  if (parsed.flags.has("write-draft-product")) {
    throw new Error("Pixart rigids draft creation is not enabled from supplier-bank CLI yet. Run the storformat dry-run first and review the category split.");
  }

  const targetTenantId = parsed.values.tenant || MASTER_TENANT_ID;
  const context = await getPixartRemoteContext(PIXART_RIGIDS_BANK_PRODUCT_KEY);
  requireAcceptedLatestReviewForStoredPixart(context);

  const productPrefix = normalizeText(
    parsed.values["product-prefix"]
    || parsed.values["product-name"]
    || context.bankProduct.name_da
    || context.bankProduct.name_original
    || "Pixart pladematerialer"
  );
  const productSlugPrefix = slugify(
    parsed.values["product-slug-prefix"]
    || parsed.values["product-slug"]
    || `${context.bankProduct.supplier_product_key}-storformat-draft`
  );
  const payload = buildPixartRigidsStorformatImportPayload({ context, productPrefix, productSlugPrefix });
  const outputDir = path.join("pricing_raw", "supplier-bank-storformat-preview", "pixartprinting", context.bankProduct.supplier_product_key);
  ensureDir(outputDir);
  const outputPath = path.join(outputDir, `${timestampForFile()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

  const categoryCount = uniqueValues(payload.rows.map((row) => row.category)).length;
  const materialCount = uniqueValues(payload.rows.map((row) => row.material)).length;
  const optionCount = uniqueValues(payload.rows.map((row) => `${row.printing}|${row.white}|${row.cut}`)).length;
  const quantityCount = uniqueValues(payload.rows.map((row) => row.quantity)).length;
  const areaCount = uniqueValues(payload.rows.map((row) => row.area_m2)).length;
  const categories = normalizeText(parsed.values.categories);

  console.log("Supplier bank Pixart rigids storformat import preview");
  console.log("  Scope: read-only rigids storformat dry-run bridge");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Supplier: ${context.supplier.name} (${context.supplier.slug})`);
  console.log(`  Bank product: ${context.bankProduct.name_da || context.bankProduct.name_original} (${context.bankProduct.supplier_product_key})`);
  console.log(`  Latest snapshot: ${context.latestSnapshot.id}`);
  console.log(`  Latest review: ${context.latestReview?.status || "none"}`);
  console.log(`  Target tenant: ${targetTenantId}`);
  console.log(`  Target product prefix: ${productPrefix}`);
  console.log(`  Target slug prefix: ${productSlugPrefix}`);
  console.log(`  Derived preview file: ${outputPath}`);
  console.log(`  Rows/categories/materials/options: ${payload.rows.length}/${categoryCount}/${materialCount}/${optionCount}`);
  console.log(`  Areas/quantities: ${areaCount}/${quantityCount}`);
  console.log("");
  console.log("Running existing Pixart rigids storformat importer in dry-run mode...");

  const nodeBin = resolveLocalNodeBinary();
  const importArgs = [
    "scripts/fetch-pixart-flat-surface-adhesive-import.mjs",
    "import",
    "--profile",
    "rigids",
    "--input",
    outputPath,
    "--dry-run",
    "--tenant-id",
    targetTenantId,
    "--product-prefix",
    productPrefix,
    "--product-slug-prefix",
    productSlugPrefix,
  ];
  if (categories) importArgs.push("--categories", categories);

  runCommand(nodeBin, importArgs, "Pixart rigids supplier-bank storformat dry-run");

  console.log("");
  console.log("Rigids dry-run complete. Keep this in review until the category split and markup policy are approved.");
}

function findLatestPixartRigidsStorformatPreviewPath() {
  const previewDir = path.join("pricing_raw", "supplier-bank-storformat-preview", "pixartprinting", PIXART_RIGIDS_BANK_PRODUCT_KEY);
  const files = findFiles(previewDir, (filePath) => filePath.endsWith(".json"));
  if (!files.length) return null;
  return files
    .map((filePath) => {
      const resolvedPath = path.resolve(process.cwd(), filePath);
      const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
      return { filePath, mtimeMs: stat?.mtimeMs || 0 };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

function summarizePixartRigidsStorformatPreview(payload, previewPath) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const categories = uniqueValues(rows.map((row) => row.category));
  const materials = uniqueValues(rows.map((row) => row.material));
  const printingOptions = uniqueValues(rows.map((row) => row.printing));
  const whiteOptions = uniqueValues(rows.map((row) => row.white));
  const cutOptions = uniqueValues(rows.map((row) => row.cut));
  const quantities = uniqueValues(rows.map((row) => Number(row.quantity)).filter((value) => Number.isFinite(value)))
    .sort((left, right) => left - right);
  const areas = uniqueValues(rows.map((row) => Number(row.area_m2)).filter((value) => Number.isFinite(value)))
    .sort((left, right) => left - right);
  const cheapestQuotes = rows
    .map((row) => Number(row.cheapest_quote_eur))
    .filter((value) => Number.isFinite(value) && value > 0);
  const fastestQuotes = rows
    .map((row) => Number(row.fastest_quote_eur))
    .filter((value) => Number.isFinite(value) && value > 0);
  const optionCombos = uniqueValues(rows.map((row) => `${row.printing || "unknown"} | ${row.white || "unknown"} | ${row.cut || "unknown"}`));
  const missingPriceRows = rows.filter((row) => !Number.isFinite(Number(row.cheapest_quote_eur)) || Number(row.cheapest_quote_eur) <= 0);

  const reviewItems = [];
  const addItem = (label, ok, detail) => {
    reviewItems.push({ label, ok, detail });
  };

  addItem("Profile is rigids", payload?.meta?.profile === "rigids", `profile=${payload?.meta?.profile || "missing"}`);
  addItem("Supplier-bank product key is pixart-rigids", payload?.meta?.bank_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY, `key=${payload?.meta?.bank_product_key || "missing"}`);
  addItem("Rows exist", rows.length > 0, `${rows.length} rows`);
  addItem("All rows have positive cheapest quote", missingPriceRows.length === 0, `${missingPriceRows.length} missing/invalid rows`);
  addItem("Category split is intentionally narrow", categories.length === 1 && categories[0] === "Plastic", `categories=${categories.join(", ") || "none"}`);
  addItem("Quantities are first-slice only", quantities.length === 3 && quantities[0] === 1 && quantities[2] === 3, `quantities=${quantities.join(", ") || "none"}`);
  addItem("Area coverage is first-slice only", areas.length === 1 && areas[0] === 1, `areas=${areas.join(", ") || "none"}`);
  addItem("Multiple option combinations are present", optionCombos.length >= 2, `${optionCombos.length} option combinations`);

  const blockers = [];
  if (categories.length === 1) blockers.push("Only Plastic is covered; Plexiglass, multi-layer, aluminium, cardboard, and other sign families still need extraction.");
  if (quantities.length <= 3) blockers.push("Only quantities 1-3 are covered; production-ready coverage should include the approved quantity range.");
  if (areas.length === 1) blockers.push("Only 1 m2 is covered; production-ready coverage should include the approved area anchors.");
  blockers.push("Markup policy is still review-only for rigids and currently follows Pixart default markup 0% in the importer.");
  blockers.push("Supplier-bank CLI still blocks rigids draft creation until the category split and pricing policy are approved.");

  return {
    previewPath,
    meta: payload?.meta || {},
    rows: rows.length,
    categories,
    materials,
    printingOptions,
    whiteOptions,
    cutOptions,
    quantities,
    areas,
    optionCombos,
    cheapestQuoteMin: cheapestQuotes.length ? Math.min(...cheapestQuotes) : null,
    cheapestQuoteMax: cheapestQuotes.length ? Math.max(...cheapestQuotes) : null,
    fastestQuoteMin: fastestQuotes.length ? Math.min(...fastestQuotes) : null,
    fastestQuoteMax: fastestQuotes.length ? Math.max(...fastestQuotes) : null,
    reviewItems,
    blockers,
    recommendation: blockers.length
      ? "Keep Pixart rigids in review. Do not create a draft product yet."
      : "Ready for explicit draft-import approval.",
  };
}

function buildPixartRigidsReviewMarkdown(summary) {
  const lines = [
    "# Pixart Rigids Storformat Review",
    "",
    `Date: ${new Date().toISOString()}`,
    "Scope: read-only review of the supplier-bank rigids storformat dry-run",
    "",
    "## Source",
    "",
    `- Preview file: \`${summary.previewPath}\``,
    `- Bank product: \`${summary.meta.bank_product_key || "unknown"}\``,
    `- Bank product id: \`${summary.meta.bank_product_id || "unknown"}\``,
    `- Price snapshot id: \`${summary.meta.price_snapshot_id || "unknown"}\``,
    `- Source snapshot: \`${summary.meta.source_snapshot_path || "unknown"}\``,
    "",
    "## Coverage",
    "",
    `- Rows: ${summary.rows}`,
    `- Categories: ${summary.categories.join(", ") || "none"}`,
    `- Materials: ${summary.materials.join(", ") || "none"}`,
    `- Printing options: ${summary.printingOptions.join(", ") || "none"}`,
    `- White options: ${summary.whiteOptions.join(", ") || "none"}`,
    `- Cut options: ${summary.cutOptions.join(", ") || "none"}`,
    `- Quantities: ${summary.quantities.join(", ") || "none"}`,
    `- Areas m2: ${summary.areas.join(", ") || "none"}`,
    `- Cheapest quote EUR range: ${summary.cheapestQuoteMin ?? "unknown"}-${summary.cheapestQuoteMax ?? "unknown"}`,
    `- Fastest quote EUR range: ${summary.fastestQuoteMin ?? "unknown"}-${summary.fastestQuoteMax ?? "unknown"}`,
    "",
    "## Review Gate",
    "",
    ...summary.reviewItems.map((item) => `- ${item.ok ? "PASS" : "FAIL"}: ${item.label} (${item.detail})`),
    "",
    "## Remaining Blockers",
    "",
    ...summary.blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Recommendation",
    "",
    summary.recommendation,
    "",
  ];
  return lines.join("\n");
}

function loadPixartSourceRowsForSnapshot(snapshot) {
  const sourcePath = normalizeText(snapshot?.source_snapshot_path);
  if (!sourcePath) return [];
  const resolvedSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSourcePath)) return [];
  try {
    const source = JSON.parse(fs.readFileSync(resolvedSourcePath, "utf8"));
    return Array.isArray(source?.rows) ? source.rows : [];
  } catch {
    return [];
  }
}

function runReviewPixartRigidsStorformatPreview(args) {
  const parsed = parseArgs(args);
  const previewPath = parsed.values.preview || findLatestPixartRigidsStorformatPreviewPath();
  if (!previewPath) {
    throw new Error("No Pixart rigids storformat preview found. Run preview-pixart-rigids-storformat-import first.");
  }

  const { path: resolvedPath, json } = loadJsonFile(previewPath);
  const summary = summarizePixartRigidsStorformatPreview(json, resolvedPath);

  console.log("Pixart rigids storformat preview review");
  console.log("  Scope: read-only review gate");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Preview: ${resolvedPath}`);
  console.log(`  Rows: ${summary.rows}`);
  console.log(`  Categories: ${summary.categories.join(", ") || "none"}`);
  console.log(`  Materials: ${summary.materials.join(", ") || "none"}`);
  console.log(`  Printing/white/cut options: ${summary.printingOptions.length}/${summary.whiteOptions.length}/${summary.cutOptions.length}`);
  console.log(`  Areas/quantities: ${summary.areas.join(", ") || "none"} / ${summary.quantities.join(", ") || "none"}`);
  console.log(`  Cheapest quote EUR range: ${summary.cheapestQuoteMin ?? "unknown"}-${summary.cheapestQuoteMax ?? "unknown"}`);

  console.log("");
  console.log("Review gate");
  summary.reviewItems.forEach((item) => {
    console.log(`  ${item.ok ? "PASS" : "FAIL"} ${item.label}: ${item.detail}`);
  });

  console.log("");
  console.log("Remaining blockers");
  summary.blockers.forEach((blocker, index) => {
    console.log(`  ${index + 1}. ${blocker}`);
  });
  console.log("");
  console.log(`Recommendation: ${summary.recommendation}`);

  if (parsed.flags.has("write-report")) {
    ensureDir("docs");
    const reportPath = path.join("docs", `PIXART_RIGIDS_STORFORMAT_REVIEW_${timestampForFile()}.md`);
    fs.writeFileSync(reportPath, buildPixartRigidsReviewMarkdown(summary), "utf8");
    console.log("");
    console.log(`Report written: ${reportPath}`);
  }
}

function getPixartRigidsBankPreviewPaths() {
  return findFiles(
    path.join("pricing_raw", "supplier-bank-normalized", "pixartprinting", PIXART_RIGIDS_BANK_PRODUCT_KEY),
    (filePath) => filePath.endsWith(".json")
  );
}

function getPassingPixartRigidsBankPreviewPaths() {
  return getPixartRigidsBankPreviewPaths().filter((previewPath) => {
    try {
      const { json } = loadJsonFile(previewPath);
      assertPixartBankPreviewSnapshot(json, path.resolve(previewPath));
      return true;
    } catch {
      return false;
    }
  });
}

function resolveDefaultPixartRigidsCandidatePath() {
  const passing = getPassingPixartRigidsBankPreviewPaths();
  return passing[passing.length - 1] || null;
}

function resolveDefaultPixartRigidsBaselinePath(candidatePath) {
  const resolvedCandidate = normalizeSnapshotPathForCompare(candidatePath);
  const passing = getPassingPixartRigidsBankPreviewPaths()
    .filter((previewPath) => normalizeSnapshotPathForCompare(previewPath) !== resolvedCandidate);
  if (!resolvedCandidate) return passing[passing.length - 1] || null;
  const earlier = passing.filter((previewPath) => previewPath < candidatePath);
  return earlier[earlier.length - 1] || passing[passing.length - 1] || null;
}

function summarizePixartRigidsBankSnapshot(snapshot, snapshotPath) {
  const rows = getSnapshotRows(snapshot);
  const sourceRows = loadPixartSourceRowsForSnapshot(snapshot);
  const keys = indexNormalizedPriceRows(rows);
  const categories = uniqueValues([
    ...rows.map((row) => row.category_original || row.category_da || row.category),
    ...sourceRows.map((row) => row.category),
  ]);
  const materials = uniqueValues([
    ...rows.map((row) => row.material_original || row.material_da || row.material),
    ...sourceRows.map((row) => row.material),
  ]);
  const optionCombos = uniqueValues(rows.map((row) => normalizeText(row.finish_original || row.finish_da || row.finish))).filter(Boolean);
  const quantities = uniqueValues(rows.map((row) => Number(row.quantity)).filter((value) => Number.isFinite(value)))
    .sort((left, right) => left - right);
  const areas = uniqueValues(rows.map((row) => Number(row.area_m2)).filter((value) => Number.isFinite(value)))
    .sort((left, right) => left - right);
  const prices = rows.map((row) => getNormalizedPrice(row)).filter((value) => Number.isFinite(value));
  const summary = snapshot.summary || {};

  return {
    snapshotPath,
    sourceSnapshotPath: snapshot.source_snapshot_path || summary.source_snapshot_path || null,
    productKey: getSnapshotSupplierProductKey(snapshot),
    productFamily: getSnapshotProductFamily(snapshot),
    rows: rows.length,
    effectiveRows: keys.indexed.size,
    duplicateKeys: keys.duplicates.length,
    categories,
    materials,
    optionCombos,
    quantities,
    areas,
    priceMinDkk: prices.length ? Math.min(...prices) : summary.price_min_dkk ?? null,
    priceMaxDkk: prices.length ? Math.max(...prices) : summary.price_max_dkk ?? null,
  };
}

function buildPixartRigidsBankCandidateMarkdown({ baseline, candidate, delta, recommendation }) {
  const changedCount = delta.changed.length;
  const increasedCount = delta.changed.filter((change) => change.delta > 0).length;
  const decreasedCount = delta.changed.filter((change) => change.delta < 0).length;
  const totalDelta = delta.changed.reduce((sum, change) => sum + change.delta, 0);
  const lines = [
    "# Pixart Rigids Bank Candidate Review",
    "",
    `Date: ${new Date().toISOString()}`,
    "Scope: read-only review of a local Pixart rigids supplier-bank candidate.",
    "",
    "## Baseline",
    "",
    `- Normalized preview: \`${baseline.snapshotPath}\``,
    `- Source extraction: \`${baseline.sourceSnapshotPath || "unknown"}\``,
    `- Rows/effective rows: \`${baseline.rows}/${baseline.effectiveRows}\``,
    `- Duplicate supplier row keys: \`${baseline.duplicateKeys}\``,
    `- Categories: ${baseline.categories.join(", ") || "none"}`,
    `- Materials: ${baseline.materials.join(", ") || "none"}`,
    `- Quantities: ${baseline.quantities.join(", ") || "none"}`,
    `- Areas m2: ${baseline.areas.join(", ") || "none"}`,
    `- DKK range: \`${baseline.priceMinDkk ?? "unknown"}-${baseline.priceMaxDkk ?? "unknown"}\``,
    "",
    "## Candidate",
    "",
    `- Normalized preview: \`${candidate.snapshotPath}\``,
    `- Source extraction: \`${candidate.sourceSnapshotPath || "unknown"}\``,
    `- Product key/family: \`${candidate.productKey || "unknown"} / ${candidate.productFamily || "unknown"}\``,
    `- Rows/effective rows: \`${candidate.rows}/${candidate.effectiveRows}\``,
    `- Duplicate supplier row keys: \`${candidate.duplicateKeys}\``,
    `- Categories: ${candidate.categories.join(", ") || "none"}`,
    `- Materials: ${candidate.materials.join(", ") || "none"}`,
    `- Option combinations: \`${candidate.optionCombos.length}\``,
    `- Quantities: ${candidate.quantities.join(", ") || "none"}`,
    `- Areas m2: ${candidate.areas.join(", ") || "none"}`,
    `- DKK range: \`${candidate.priceMinDkk ?? "unknown"}-${candidate.priceMaxDkk ?? "unknown"}\``,
    "",
    "## Comparison",
    "",
    `- Old/new effective rows: \`${delta.oldRows}/${delta.newRows}\``,
    `- Changed rows: \`${changedCount}\``,
    `- Increased/decreased rows: \`${increasedCount}/${decreasedCount}\``,
    `- Added/removed rows: \`${delta.added.length}/${delta.removed.length}\``,
    `- Unchanged rows: \`${delta.unchanged}\``,
    `- Duplicate keys old/new: \`${delta.duplicateOldKeys}/${delta.duplicateNewKeys}\``,
    `- Net changed-row delta DKK: \`${Number(totalDelta.toFixed(2))}\``,
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
  ];
  return lines.join("\n");
}

function parseRigidsImportCompleteSummary(output) {
  const marker = "Rigids import complete:";
  const markerIndex = String(output || "").lastIndexOf(marker);
  if (markerIndex < 0) return [];
  const tail = String(output).slice(markerIndex + marker.length);
  const startIndex = tail.indexOf("[");
  const endIndex = tail.lastIndexOf("]");
  if (startIndex < 0 || endIndex < startIndex) return [];
  try {
    const parsed = JSON.parse(tail.slice(startIndex, endIndex + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findLatestPixartRigidsCandidatePacketPath() {
  const files = findFiles("docs", (filePath) => /PIXART_RIGIDS_CANDIDATE_PACKET_\d{8}-\d{6}\.md$/.test(path.basename(filePath)));
  if (!files.length) return null;
  return files
    .map((filePath) => {
      const resolvedPath = path.resolve(filePath);
      const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
      return { filePath, mtimeMs: stat?.mtimeMs || 0 };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

function findLatestPixartRigidsStorformatReviewPath() {
  const files = findFiles("docs", (filePath) => /PIXART_RIGIDS_STORFORMAT_REVIEW_\d{8}-\d{6}\.md$/.test(path.basename(filePath)));
  if (!files.length) return null;
  return files
    .map((filePath) => {
      const resolvedPath = path.resolve(filePath);
      const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
      return { filePath, mtimeMs: stat?.mtimeMs || 0 };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

function findLatestPixartRigidsBankWritePreflightPath() {
  const files = findFiles("docs", (filePath) => /PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_\d{8}-\d{6}\.md$/.test(path.basename(filePath)));
  if (!files.length) return null;
  return files
    .map((filePath) => {
      const resolvedPath = path.resolve(filePath);
      const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
      return { filePath, mtimeMs: stat?.mtimeMs || 0 };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

function findLatestPrintComPlacematsPreflightReportPath() {
  const files = findFiles("docs", (filePath) => /SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_\d{8}-\d{6}\.md$/.test(path.basename(filePath)));
  if (!files.length) return null;
  return files
    .map((filePath) => {
      const resolvedPath = path.resolve(filePath);
      const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
      return { filePath, mtimeMs: stat?.mtimeMs || 0 };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

function findLatestSupplierBankReportPath(pattern) {
  const files = findFiles("docs", (filePath) => pattern.test(path.basename(filePath)));
  if (!files.length) return null;
  return files
    .map((filePath) => {
      const resolvedPath = path.resolve(filePath);
      const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
      return { filePath, mtimeMs: stat?.mtimeMs || 0 };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

function preferStableLatestReportPath(key, timestampedPath) {
  const stablePath = SUPPLIER_BANK_STABLE_LATEST_REPORT_PATHS[key];
  if (!stablePath) return timestampedPath;
  return fs.existsSync(path.resolve(stablePath)) ? stablePath : timestampedPath;
}

function getSupplierBankLatestReportPaths() {
  return {
    reportIndex: preferStableLatestReportPath("reportIndex", findLatestSupplierBankReportPath(/SUPPLIER_BANK_REPORT_INDEX_\d{8}-\d{6}\.md$/)),
    statusReport: preferStableLatestReportPath("statusReport", findLatestSupplierBankReportPath(/SUPPLIER_BANK_STATUS_REPORT_\d{8}-\d{6}\.md$/)),
    goalSnapshot: preferStableLatestReportPath("goalSnapshot", findLatestSupplierBankReportPath(/SUPPLIER_BANK_GOAL_SNAPSHOT_\d{8}-\d{6}\.md$/)),
    completionAudit: preferStableLatestReportPath("completionAudit", findLatestSupplierBankReportPath(/SUPPLIER_BANK_COMPLETION_AUDIT_\d{8}-\d{6}\.md$/)),
    approvalPacket: preferStableLatestReportPath("approvalPacket", findLatestSupplierBankReportPath(/SUPPLIER_BANK_APPROVAL_PACKET_\d{8}-\d{6}\.md$/)),
    decisionQueue: preferStableLatestReportPath("decisionQueue", findLatestSupplierBankReportPath(/SUPPLIER_BANK_DECISION_QUEUE_\d{8}-\d{6}\.md$/)),
    executiveSummary: preferStableLatestReportPath("executiveSummary", findLatestSupplierBankReportPath(/SUPPLIER_BANK_EXECUTIVE_SUMMARY_\d{8}-\d{6}\.md$/)),
    expansionPacket: preferStableLatestReportPath("expansionPacket", findLatestSupplierBankReportPath(/SUPPLIER_BANK_EXPANSION_PACKET_\d{8}-\d{6}\.md$/)),
    coverageGapPlan: preferStableLatestReportPath("coverageGapPlan", findLatestSupplierBankReportPath(/SUPPLIER_BANK_COVERAGE_GAP_PLAN_\d{8}-\d{6}\.md$/)),
    importedDraftQa: preferStableLatestReportPath("importedDraftQa", findLatestSupplierBankReportPath(/SUPPLIER_BANK_IMPORTED_DRAFT_QA_\d{8}-\d{6}\.md$/)),
    gateRoadmap: preferStableLatestReportPath("gateRoadmap", findLatestSupplierBankReportPath(/SUPPLIER_BANK_GATE_ROADMAP_\d{8}-\d{6}\.md$/)),
    pixartAdapterPlan: preferStableLatestReportPath("pixartAdapterPlan", findLatestSupplierBankReportPath(/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_[a-z0-9-]+_\d{8}-\d{6}\.md$/)),
    pixartReadiness: preferStableLatestReportPath("pixartReadiness", findLatestSupplierBankReportPath(/SUPPLIER_BANK_PIXART_READINESS_[a-z0-9-]+_\d{8}-\d{6}\.md$/)),
    urlCandidates: preferStableLatestReportPath("urlCandidates", findLatestSupplierBankReportPath(/SUPPLIER_BANK_URL_CANDIDATES_[a-z0-9-]+_\d{8}-\d{6}\.md$/)),
    urlConfirmationChecklist: preferStableLatestReportPath("urlConfirmationChecklist", findLatestSupplierBankReportPath(/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_[a-z0-9-]+_\d{8}-\d{6}\.md$/)),
    pixartRigidsPreflight: preferStableLatestReportPath("pixartRigidsPreflight", findLatestPixartRigidsBankWritePreflightPath()),
    printComPlacematsPreflight: preferStableLatestReportPath("printComPlacematsPreflight", findLatestPrintComPlacematsPreflightReportPath()),
  };
}

function getSupplierBankReportIndexItems(latestReports = getSupplierBankLatestReportPaths()) {
  return [
    {
      key: "reportIndex",
      title: "Report index",
      gate: "Evidence map",
      path: latestReports.reportIndex,
      required: false,
      note: "Previous generated evidence index, if any.",
    },
    {
      key: "goalSnapshot",
      title: "Goal snapshot",
      gate: "Current goal control",
      path: latestReports.goalSnapshot,
      required: true,
      note: "Single operator view for open gates, exact approval/defer phrases, and proof paths.",
    },
    {
      key: "statusReport",
      title: "Status report",
      gate: "Coverage/import status",
      path: latestReports.statusReport,
      required: true,
      note: "Combined read-only status for coverage, import eligibility, draft QA, and next action.",
    },
    {
      key: "gateRoadmap",
      title: "Gate roadmap",
      gate: "Ordered gates",
      path: latestReports.gateRoadmap,
      required: true,
      note: "Ordered safe/check steps and approval-gated write groups.",
    },
    {
      key: "completionAudit",
      title: "Completion audit",
      gate: "Goal proof",
      path: latestReports.completionAudit,
      required: true,
      note: "Evidence audit proving which supplier-bank requirements are still open.",
    },
    {
      key: "approvalPacket",
      title: "Approval packet",
      gate: "Business decisions",
      path: latestReports.approvalPacket,
      required: true,
      note: "Safe checks, exact approval/defer phrases, and write-gated commands.",
    },
    {
      key: "decisionQueue",
      title: "Decision queue",
      gate: "Prioritized decisions",
      path: latestReports.decisionQueue,
      required: false,
      note: "Queue of current supplier-bank decisions.",
    },
    {
      key: "executiveSummary",
      title: "Executive summary",
      gate: "Business overview",
      path: latestReports.executiveSummary,
      required: false,
      note: "Short business-readable overview.",
    },
    {
      key: "expansionPacket",
      title: "Expansion packet",
      gate: "Missing coverage",
      path: latestReports.expansionPacket,
      required: false,
      note: "Safe local/no-write expansion order for missing supplier families.",
    },
    {
      key: "coverageGapPlan",
      title: "Coverage gap plan",
      gate: "Missing families",
      path: latestReports.coverageGapPlan,
      required: false,
      note: "Family-level gap plan for Print.com other and Pixart missing families.",
    },
    {
      key: "importedDraftQa",
      title: "Imported draft QA",
      gate: "Draft safety",
      path: latestReports.importedDraftQa,
      required: true,
      note: "Checks imported supplier-bank draft products stay clean and unpublished.",
    },
    {
      key: "pixartAdapterPlan",
      title: "Pixart adapter plan",
      gate: "Pixart profile planning",
      path: latestReports.pixartAdapterPlan,
      required: false,
      note: "Mapping plan before unsupported Pixart profile work.",
    },
    {
      key: "pixartReadiness",
      title: "Pixart readiness",
      gate: "Before Pixart probe",
      path: latestReports.pixartReadiness,
      required: true,
      note: "Confirms missing Pixart families remain blocked until profile and exact URL are ready.",
    },
    {
      key: "urlCandidates",
      title: "URL candidates",
      gate: "Pixart URL candidates",
      path: latestReports.urlCandidates,
      required: false,
      note: "Registry-only Pixart URL candidate list.",
    },
    {
      key: "urlConfirmationChecklist",
      title: "URL confirmation checklist",
      gate: "Pixart exact URL gate",
      path: latestReports.urlConfirmationChecklist,
      required: true,
      note: "Manual checklist before promoting candidates to confirmed_source_url.",
    },
    {
      key: "pixartRigidsPreflight",
      title: "Pixart rigids preflight",
      gate: "High-priority Pixart approval",
      path: latestReports.pixartRigidsPreflight,
      required: true,
      note: "No-write preflight for the Plastic+Plexiglass bank-only candidate.",
    },
    {
      key: "printComPlacematsPreflight",
      title: "Print.com placemats preflight",
      gate: "Print.com other approval",
      path: latestReports.printComPlacematsPreflight,
      required: true,
      note: "No-write preflight for the first Print.com other/placemats slice.",
    },
  ];
}

function getReportFileMeta(filePath) {
  if (!filePath) return { exists: false, size: 0, modifiedAt: null };
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) return { exists: false, size: 0, modifiedAt: null };
  const stat = fs.statSync(resolvedPath);
  return {
    exists: true,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function writeReportAndLatest(reportPath, reportMarkdown, latestPath) {
  fs.writeFileSync(reportPath, reportMarkdown, "utf8");
  if (latestPath) fs.writeFileSync(latestPath, reportMarkdown, "utf8");
}

function buildSupplierBankReportIndexMarkdown({ items }) {
  const missingRequired = items.filter((item) => item.required && !item.path);
  const lines = [
    "# Supplier Bank Report Index",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Scope",
    "",
    "- Local read-only index over already generated Supplier Bank report files.",
    "- No supplier probing, scraping, API calls, browser automation, or Supabase reads.",
    "- No supplier-bank writes.",
    "- No product creation, publishing changes, or live pricing writes.",
    "",
    "## Summary",
    "",
    `- Indexed report slots: ${items.length}`,
    `- Present reports: ${items.filter((item) => Boolean(item.path)).length}`,
    `- Missing required reports: ${missingRequired.length}`,
    "",
  ];

  if (missingRequired.length > 0) {
    lines.push("## Missing Required Reports", "");
    missingRequired.forEach((item) => {
      lines.push(`- ${item.title} (${item.key})`);
    });
    lines.push("");
  }

  lines.push("## Reports", "");
  items.forEach((item) => {
    const meta = getReportFileMeta(item.path);
    lines.push(
      `### ${item.title}`,
      "",
      `- Key: \`${item.key}\``,
      `- Gate: ${item.gate}`,
      `- Required: ${item.required ? "yes" : "no"}`,
      `- Path: ${item.path ? `\`${item.path}\`` : "missing"}`,
      `- Exists: ${meta.exists ? "yes" : "no"}`,
      `- Modified: ${meta.modifiedAt || "unknown"}`,
      `- Size bytes: ${meta.size}`,
      `- Note: ${item.note}`,
      ""
    );
  });

  lines.push(
    "## Guardrails",
    "",
    "- Treat this index as evidence navigation, not approval.",
    "- Any write command in linked reports still requires explicit user approval.",
    "- Keep Supplier Bank separate from POD v1 and POD v2.",
    "- Do not use Salgsmapper/Sales Maba, Onlinetryksager, Webprinter, or localhost as supplier sources.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function runSupplierBankReportIndex(args) {
  const parsed = parseArgs(args);
  const shouldWriteReport = parsed.flags.has("write-report");
  const items = getSupplierBankReportIndexItems();
  const missingRequired = items.filter((item) => item.required && !item.path);

  console.log("Supplier bank report index");
  console.log("  Scope: read-only local report index");
  console.log("  Supplier probes/scrapes/API calls: no");
  console.log("  Supabase reads: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Indexed report slots: ${items.length}`);
  console.log(`  Present reports: ${items.filter((item) => Boolean(item.path)).length}`);
  console.log(`  Missing required reports: ${missingRequired.length}`);
  console.log("");
  console.log("Reports");
  items.forEach((item) => {
    console.log(`  ${item.key}: ${item.path || "missing"}`);
  });

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_REPORT_INDEX_${timestampForFile()}.md`);
    const reportItems = getSupplierBankReportIndexItems({
      ...getSupplierBankLatestReportPaths(),
      reportIndex: reportPath,
    });
    let reportMarkdown = buildSupplierBankReportIndexMarkdown({ items: reportItems });
    fs.writeFileSync(reportPath, reportMarkdown, "utf8");
    reportMarkdown = buildSupplierBankReportIndexMarkdown({ items: reportItems });
    fs.writeFileSync(reportPath, reportMarkdown, "utf8");
    fs.writeFileSync(SUPPLIER_BANK_REPORT_INDEX_LATEST_PATH, reportMarkdown, "utf8");
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_REPORT_INDEX_LATEST_PATH}`);
  }
}

function assertPixartRigidsPacketEvidence({ packetPath, baselinePath, candidatePath }) {
  const resolvedPacketPath = path.resolve(packetPath);
  if (!fs.existsSync(resolvedPacketPath)) {
    throw new Error(`Packet report not found: ${packetPath}`);
  }
  const text = fs.readFileSync(resolvedPacketPath, "utf8");
  const requiredSnippets = [
    path.resolve(baselinePath),
    path.resolve(candidatePath),
    "## Candidate Comparison",
    "## Bank Write-Plan Preview",
    "## Dry-Run Result",
    "This packet performs no supplier scrape, no supplier-bank write, no product write, no publishing, and no live pricing write.",
  ];
  const missing = requiredSnippets.filter((snippet) => !text.includes(snippet));
  if (missing.length > 0) {
    throw new Error(`Packet report is missing required evidence: ${missing.join(" | ")}`);
  }
  return { resolvedPacketPath, text };
}

function runReviewPixartRigidsBankCandidate(args) {
  const parsed = parseArgs(args);
  const candidatePath = parsed.positionals[0] || resolveDefaultPixartRigidsCandidatePath();
  if (!candidatePath) {
    throw new Error("No passing Pixart rigids candidate preview found. Run pixart-bank-first-slice --profile rigids first.");
  }

  const baselinePath = parsed.values.baseline || resolveDefaultPixartRigidsBaselinePath(candidatePath);
  if (!baselinePath) {
    throw new Error("No passing Pixart rigids baseline preview found. Pass --baseline <preview.json>.");
  }

  const { path: resolvedCandidatePath, json: candidateSnapshot } = loadJsonFile(candidatePath);
  const { path: resolvedBaselinePath, json: baselineSnapshot } = loadJsonFile(baselinePath);
  assertPixartBankPreviewSnapshot(candidateSnapshot, resolvedCandidatePath);
  assertPixartBankPreviewSnapshot(baselineSnapshot, resolvedBaselinePath);

  const delta = compareNormalizedSnapshots({
    oldSnapshot: baselineSnapshot,
    newSnapshot: candidateSnapshot,
    thresholdPct: 0,
  });
  const baseline = summarizePixartRigidsBankSnapshot(baselineSnapshot, resolvedBaselinePath);
  const candidate = summarizePixartRigidsBankSnapshot(candidateSnapshot, resolvedCandidatePath);
  const recommendation = [
    "Candidate can be considered for explicit supplier-bank-only snapshot write after review.",
    "Do not create products, publish products, or write live storefront pricing from this candidate.",
    "Keep Pixart rigids on the storformat path and keep generic Matrix Layout import blocked.",
  ].join(" ");

  console.log("Pixart rigids bank candidate review");
  console.log("  Scope: read-only local candidate review");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Baseline: ${resolvedBaselinePath}`);
  console.log(`  Candidate: ${resolvedCandidatePath}`);
  console.log(`  Baseline rows/effective rows: ${baseline.rows}/${baseline.effectiveRows}`);
  console.log(`  Candidate rows/effective rows: ${candidate.rows}/${candidate.effectiveRows}`);
  console.log(`  Categories: ${candidate.categories.join(", ") || "none"}`);
  console.log(`  Materials: ${candidate.materials.join(", ") || "none"}`);
  console.log(`  DKK range: ${candidate.priceMinDkk ?? "unknown"}-${candidate.priceMaxDkk ?? "unknown"}`);
  console.log(`  Duplicate keys old/new: ${delta.duplicateOldKeys}/${delta.duplicateNewKeys}`);
  console.log(`  Added/removed rows: ${delta.added.length}/${delta.removed.length}`);
  console.log(`  Changed rows: ${delta.changed.length}`);
  console.log("");
  console.log(`Recommendation: ${recommendation}`);
  console.log("");
  console.log("Preview only. Add --write-bank to write-pixart-bank-snapshot only after explicit approval.");

  if (parsed.flags.has("write-report")) {
    ensureDir("docs");
    const reportPath = path.join("docs", `PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_${timestampForFile()}.md`);
    fs.writeFileSync(reportPath, buildPixartRigidsBankCandidateMarkdown({ baseline, candidate, delta, recommendation }), "utf8");
    console.log("");
    console.log(`Report written: ${reportPath}`);
  }
}

async function runReviewPixartRigidsCandidatePacket(args) {
  const parsed = parseArgs(args);
  const candidatePath = parsed.positionals[0] || resolveDefaultPixartRigidsCandidatePath();
  if (!candidatePath) {
    throw new Error("No passing Pixart rigids candidate preview found. Run pixart-bank-first-slice --profile rigids first.");
  }

  const baselinePath = parsed.values.baseline || resolveDefaultPixartRigidsBaselinePath(candidatePath);
  if (!baselinePath) {
    throw new Error("No passing Pixart rigids baseline preview found. Pass --baseline <preview.json>.");
  }

  const { path: resolvedCandidatePath, json: candidateSnapshot } = loadJsonFile(candidatePath);
  const { path: resolvedBaselinePath, json: baselineSnapshot } = loadJsonFile(baselinePath);
  assertPixartBankPreviewSnapshot(candidateSnapshot, resolvedCandidatePath);
  assertPixartBankPreviewSnapshot(baselineSnapshot, resolvedBaselinePath);
  const baselineSummary = summarizePixartRigidsBankSnapshot(baselineSnapshot, resolvedBaselinePath);
  const candidateSummary = summarizePixartRigidsBankSnapshot(candidateSnapshot, resolvedCandidatePath);
  const delta = compareNormalizedSnapshots({
    oldSnapshot: baselineSnapshot,
    newSnapshot: candidateSnapshot,
    thresholdPct: 0,
  });
  const changedCount = delta.changed.length;
  const increasedCount = delta.changed.filter((change) => change.delta > 0).length;
  const decreasedCount = delta.changed.filter((change) => change.delta < 0).length;
  const totalChangedDelta = delta.changed.reduce((sum, change) => sum + change.delta, 0);
  const sourcePath = candidateSummary.sourceSnapshotPath;
  if (!sourcePath || !fs.existsSync(path.resolve(sourcePath))) {
    throw new Error(`Candidate source extraction is missing or unreadable: ${sourcePath || "missing"}`);
  }

  const categories = parsed.values.categories || candidateSummary.categories.join(",");
  const targetTenantId = parsed.values.tenant || MASTER_TENANT_ID;
  const productPrefix = normalizeText(parsed.values["product-prefix"] || parsed.values["product-name"] || "Pixart pladematerialer");
  const productSlugPrefix = slugify(parsed.values["product-slug-prefix"] || parsed.values["product-slug"] || "pixart-rigids-storformat-candidate-draft");
  const shouldWriteReport = parsed.flags.has("write-report");

  console.log("Pixart rigids candidate decision packet");
  console.log("  Scope: local/no-write candidate review packet");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Baseline: ${resolvedBaselinePath}`);
  console.log(`  Candidate: ${resolvedCandidatePath}`);
  console.log(`  Candidate source extraction: ${sourcePath}`);
  console.log(`  Categories: ${categories || "none"}`);
  console.log("");
  console.log("Step 1/3: candidate comparison review");
  runReviewPixartRigidsBankCandidate([
    resolvedCandidatePath,
    "--baseline",
    path.resolve(baselinePath),
    ...(shouldWriteReport ? ["--write-report"] : []),
  ]);

  console.log("");
  console.log("Step 2/3: supplier-bank snapshot write-plan preview");
  await runWritePixartBankSnapshot([resolvedCandidatePath]);

  console.log("");
  console.log("Step 3/3: candidate storformat dry-run from raw extraction");
  const nodeBin = resolveLocalNodeBinary();
  const importArgs = [
    "scripts/fetch-pixart-flat-surface-adhesive-import.mjs",
    "import",
    "--profile",
    "rigids",
    "--input",
    sourcePath,
    "--dry-run",
    "--tenant-id",
    targetTenantId,
    "--product-prefix",
    productPrefix,
    "--product-slug-prefix",
    productSlugPrefix,
  ];
  if (categories) importArgs.push("--categories", categories);
  const dryRunOutput = runCommandCapture(nodeBin, importArgs, "Pixart rigids candidate storformat dry-run");
  const dryRunSummary = parseRigidsImportCompleteSummary(dryRunOutput);

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `PIXART_RIGIDS_CANDIDATE_PACKET_${timestampForFile()}.md`);
    const reportLines = [
      "# Pixart Rigids Candidate Decision Packet",
      "",
      `Date: ${new Date().toISOString()}`,
      "Scope: no-write packet for Pixart rigids supplier-bank candidate review.",
      "",
      "## Inputs",
      "",
      `- Baseline preview: \`${resolvedBaselinePath}\``,
      `- Candidate preview: \`${resolvedCandidatePath}\``,
      `- Candidate source extraction: \`${sourcePath}\``,
      `- Categories: ${categories || "none"}`,
      `- Target tenant for dry-run: \`${targetTenantId}\``,
      `- Product slug prefix for dry-run: \`${productSlugPrefix}\``,
      "",
      "## Candidate Comparison",
      "",
      `- Baseline rows/effective rows: \`${baselineSummary.rows}/${baselineSummary.effectiveRows}\``,
      `- Candidate rows/effective rows: \`${candidateSummary.rows}/${candidateSummary.effectiveRows}\``,
      `- Baseline categories/materials: ${baselineSummary.categories.join(", ") || "none"} / ${baselineSummary.materials.join(", ") || "none"}`,
      `- Candidate categories/materials: ${candidateSummary.categories.join(", ") || "none"} / ${candidateSummary.materials.join(", ") || "none"}`,
      `- Duplicate keys old/new: \`${delta.duplicateOldKeys}/${delta.duplicateNewKeys}\``,
      `- Changed rows: \`${changedCount}\``,
      `- Increased/decreased rows: \`${increasedCount}/${decreasedCount}\``,
      `- Added/removed rows: \`${delta.added.length}/${delta.removed.length}\``,
      `- Unchanged rows: \`${delta.unchanged}\``,
      `- Net changed-row delta DKK: \`${Number(totalChangedDelta.toFixed(2))}\``,
      "",
      "## Bank Write-Plan Preview",
      "",
      `- Supplier/product: \`pixartprinting / ${candidateSummary.productKey || "unknown"}\``,
      `- Product family: \`${candidateSummary.productFamily || "unknown"}\``,
      `- Rows: \`${candidateSummary.rows}\``,
      `- Quantities: \`${candidateSummary.quantities.join(", ") || "none"}\``,
      `- Areas m2: \`${candidateSummary.areas.join(", ") || "none"}\``,
      `- DKK range: \`${candidateSummary.priceMinDkk ?? "unknown"}-${candidateSummary.priceMaxDkk ?? "unknown"}\``,
      `- Preview command performed no supplier-bank write. Use \`--write-bank\` only after explicit approval.`,
      "",
      "## Evidence Commands",
      "",
      "```bash",
      `node scripts/supplier-bank-cli.mjs review-pixart-rigids-bank-candidate ${quoteShellArg(resolvedCandidatePath)} --baseline ${quoteShellArg(resolvedBaselinePath)}`,
      `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot ${quoteShellArg(resolvedCandidatePath)}`,
      [
        "node",
        "scripts/fetch-pixart-flat-surface-adhesive-import.mjs",
        "import",
        "--profile",
        "rigids",
        "--input",
        quoteShellArg(sourcePath),
        "--dry-run",
        "--tenant-id",
        targetTenantId,
        "--product-prefix",
        quoteShellArg(productPrefix),
        "--product-slug-prefix",
        productSlugPrefix,
        ...(categories ? ["--categories", quoteShellArg(categories)] : []),
      ].join(" "),
      "```",
      "",
      "## Dry-Run Result",
      "",
      ...(dryRunSummary.length > 0
        ? dryRunSummary.flatMap((entry) => [
            `- ${entry.category || "unknown"}: \`${entry.product_slug || "unknown"}\``,
            `  - Rows: \`${entry.rows ?? "unknown"}\``,
            `  - Materials: \`${entry.materials ?? "unknown"}\``,
            `  - Printing/white/cut/delivery options: \`${entry.printing_options ?? "unknown"}/${entry.white_options ?? "unknown"}/${entry.cut_options ?? "unknown"}/${entry.delivery_options ?? "unknown"}\``,
            `  - Transformed input: \`${entry.transformed_input || "unknown"}\``,
          ])
        : ["- Dry-run summary could not be parsed from importer output."]),
      "",
      "## Boundary",
      "",
      "This packet performs no supplier scrape, no supplier-bank write, no product write, no publishing, and no live pricing write.",
      "Use `write-pixart-bank-snapshot <candidate> --write-bank` only after explicit bank-write approval.",
      "",
    ];
    fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");
    console.log("");
    console.log(`Packet report written: ${reportPath}`);
  }

  console.log("");
  console.log("Candidate packet complete. No writes were performed.");
}

async function runPreflightPixartRigidsBankWrite(args) {
  const parsed = parseArgs(args);
  const shouldWriteReport = parsed.flags.has("write-report");
  const candidatePath = parsed.positionals[0] || resolveDefaultPixartRigidsCandidatePath();
  if (!candidatePath) {
    throw new Error("No passing Pixart rigids candidate preview found. Run review-pixart-rigids-candidate-packet first.");
  }

  const baselinePath = parsed.values.baseline || resolveDefaultPixartRigidsBaselinePath(candidatePath);
  if (!baselinePath) {
    throw new Error("No passing Pixart rigids baseline preview found. Pass --baseline <preview.json>.");
  }

  const packetPath = parsed.values.packet || findLatestPixartRigidsCandidatePacketPath();
  if (!packetPath) {
    throw new Error("No Pixart rigids candidate packet report found. Run review-pixart-rigids-candidate-packet --write-report first.");
  }

  const { path: resolvedCandidatePath, json: candidateSnapshot } = loadJsonFile(candidatePath);
  const { path: resolvedBaselinePath, json: baselineSnapshot } = loadJsonFile(baselinePath);
  assertPixartBankPreviewSnapshot(candidateSnapshot, resolvedCandidatePath);
  assertPixartBankPreviewSnapshot(baselineSnapshot, resolvedBaselinePath);
  const candidateSummary = summarizePixartRigidsBankSnapshot(candidateSnapshot, resolvedCandidatePath);
  const baselineSummary = summarizePixartRigidsBankSnapshot(baselineSnapshot, resolvedBaselinePath);
  const delta = compareNormalizedSnapshots({
    oldSnapshot: baselineSnapshot,
    newSnapshot: candidateSnapshot,
    thresholdPct: 0,
  });

  if (candidateSummary.productKey !== PIXART_RIGIDS_BANK_PRODUCT_KEY) {
    throw new Error(`Candidate is not ${PIXART_RIGIDS_BANK_PRODUCT_KEY}: ${candidateSummary.productKey || "unknown"}`);
  }
  if (candidateSummary.duplicateKeys > 0) {
    throw new Error(`Candidate still has duplicate supplier row keys: ${candidateSummary.duplicateKeys}`);
  }
  if (candidateSummary.categories.length < 2) {
    throw new Error(`Candidate does not prove multiple category coverage: ${candidateSummary.categories.join(", ") || "none"}`);
  }

  const packetEvidence = assertPixartRigidsPacketEvidence({
    packetPath,
    baselinePath: resolvedBaselinePath,
    candidatePath: resolvedCandidatePath,
  });

  console.log("Pixart rigids bank-write preflight");
  console.log("  Scope: no-write approval readiness check");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Packet report: ${packetEvidence.resolvedPacketPath}`);
  console.log(`  Baseline: ${resolvedBaselinePath}`);
  console.log(`  Candidate: ${resolvedCandidatePath}`);
  console.log(`  Baseline rows/effective rows: ${baselineSummary.rows}/${baselineSummary.effectiveRows}`);
  console.log(`  Candidate rows/effective rows: ${candidateSummary.rows}/${candidateSummary.effectiveRows}`);
  console.log(`  Candidate categories: ${candidateSummary.categories.join(", ") || "none"}`);
  console.log(`  Candidate materials: ${candidateSummary.materials.join(", ") || "none"}`);
  console.log(`  Duplicate keys old/new: ${delta.duplicateOldKeys}/${delta.duplicateNewKeys}`);
  console.log(`  Added/removed rows: ${delta.added.length}/${delta.removed.length}`);
  console.log(`  Changed rows: ${delta.changed.length}`);
  console.log(`  DKK range: ${candidateSummary.priceMinDkk ?? "unknown"}-${candidateSummary.priceMaxDkk ?? "unknown"}`);

  console.log("");
  console.log("Write-plan preview");
  await runWritePixartBankSnapshot([resolvedCandidatePath]);

  console.log("");
  console.log("Approval commands");
  console.log("  Run these only after explicit supplier-bank write approval:");
  console.log(`  1. node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot ${quoteShellArg(resolvedCandidatePath)} --write-bank`);
  console.log("  After the bank snapshot exists, create/review a stored delta review before any product conversion decision:");
  console.log(`  2. node scripts/supplier-bank-cli.mjs compare-normalized-snapshots ${quoteShellArg(resolvedBaselinePath)} ${quoteShellArg(resolvedCandidatePath)} --write-delta-review --notes "Pixart rigids visible-option two-category candidate"`);
  console.log("  3. Keep Pixart disabled/candidate and keep generic Matrix Layout import blocked.");

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_${timestampForFile()}.md`);
    const reportLines = [
      "# Pixart Rigids Bank-Write Preflight",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Scope",
      "",
      "- No supplier scraping.",
      "- No supplier-bank writes.",
      "- No product writes.",
      "- No publishing changes.",
      "- No live pricing writes.",
      "",
      "## Evidence",
      "",
      `- Packet report: \`${packetEvidence.resolvedPacketPath}\``,
      `- Baseline: \`${resolvedBaselinePath}\``,
      `- Candidate: \`${resolvedCandidatePath}\``,
      `- Baseline rows/effective rows: \`${baselineSummary.rows}/${baselineSummary.effectiveRows}\``,
      `- Candidate rows/effective rows: \`${candidateSummary.rows}/${candidateSummary.effectiveRows}\``,
      `- Candidate categories: \`${candidateSummary.categories.join(", ") || "none"}\``,
      `- Candidate materials: \`${candidateSummary.materials.join(", ") || "none"}\``,
      `- Duplicate keys old/new: \`${delta.duplicateOldKeys}/${delta.duplicateNewKeys}\``,
      `- Added/removed rows: \`${delta.added.length}/${delta.removed.length}\``,
      `- Changed rows: \`${delta.changed.length}\``,
      `- DKK range: \`${candidateSummary.priceMinDkk ?? "unknown"}-${candidateSummary.priceMaxDkk ?? "unknown"}\``,
      "",
      "## Approval Commands",
      "",
      "Run only after explicit supplier-bank write approval:",
      "",
      "```bash",
      `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot ${quoteShellArg(resolvedCandidatePath)} --write-bank`,
      `node scripts/supplier-bank-cli.mjs compare-normalized-snapshots ${quoteShellArg(resolvedBaselinePath)} ${quoteShellArg(resolvedCandidatePath)} --write-delta-review --notes "Pixart rigids visible-option two-category candidate"`,
      "```",
      "",
      "## Guardrails",
      "",
      "- These commands may write only supplier-bank snapshot/review rows after explicit approval.",
      "- They must not create products, publish products, or write live storefront pricing.",
      "- Keep Pixart disabled/candidate and keep generic Matrix Layout import blocked.",
      "",
    ];
    const report = reportLines.join("\n");
    writeReportAndLatest(reportPath, report, PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST_PATH}`);
  }

  console.log("");
  console.log("Preflight complete. No writes were performed.");
}

function runPixartBankFirstSlice(args) {
  const parsed = parseArgs(args);
  const profile = normalizeText(parsed.values.profile || "flat-surface-adhesive");
  if (!PIXART_PROFILES.has(profile)) {
    throw new Error("--profile must be either 'flat-surface-adhesive' or 'rigids'");
  }

  const nodeBin = resolveLocalNodeBinary();
  const validateSupplierArgs = ["scripts/supplier-bank-cli.mjs", "validate-supplier-sources"];
  const pixartScript = "scripts/fetch-pixart-flat-surface-adhesive-import.mjs";
  const url = normalizeText(parsed.values.url);
  const materials = normalizeText(parsed.values.materials);
  const laminations = normalizeText(parsed.values.laminations);
  const categories = normalizeText(parsed.values.categories);
  const useHeadless = parsed.flags.has("headless");
  const useHeadful = parsed.flags.has("headful") || !useHeadless;

  const limitMaterials = String(Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit-materials", 1))));
  const limitLaminations = String(Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit-laminations", 1))));
  const limitAreas = String(Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit-areas", 1))));
  const limitQuantities = String(Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit-quantities", 3))));

  const probeArgs = [pixartScript, "probe", "--profile", profile];
  if (url) probeArgs.push("--url", url);
  if (categories) probeArgs.push("--categories", categories);
  if (useHeadful) probeArgs.push("--headful");
  if (useHeadless) probeArgs.push("--headless");

  const extractArgs = [
    pixartScript,
    "extract",
    "--profile",
    profile,
    "--limit-materials",
    limitMaterials,
    "--limit-laminations",
    limitLaminations,
    "--limit-areas",
    limitAreas,
    "--limit-quantities",
    limitQuantities,
  ];
  if (url) extractArgs.push("--url", url);
  if (materials) extractArgs.push("--materials", materials);
  if (laminations) extractArgs.push("--laminations", laminations);
  if (categories) extractArgs.push("--categories", categories);
  if (useHeadful) extractArgs.push("--headful");
  if (useHeadless) extractArgs.push("--headless");

  console.log("Supplier bank Pixart first-slice preview");
  console.log("  Scope: local Pixart probe and tiny extraction only");
  console.log("  Supplier-bank DB writes: no");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Profile: ${profile}`);
  console.log(`  Source URL: ${url || "Pixart script default"}`);
  if (materials) console.log(`  Materials override: ${materials}`);
  if (laminations) console.log(`  Laminations override: ${laminations}`);
  if (categories) console.log(`  Categories override: ${categories}`);
  console.log(`  Browser mode: ${useHeadful ? "headful" : "headless"}`);
  console.log(`  Extraction limits: materials=${limitMaterials}, laminations=${limitLaminations}, areas=${limitAreas}, quantities=${limitQuantities}`);

  runCommand(nodeBin, validateSupplierArgs, "supplier source validation");
  runCommand(nodeBin, probeArgs, "Pixart probe");

  let latest = null;
  let json = null;
  let rows = [];
  let validRows = 0;
  let errorCounts = {};
  let completeExtraction = false;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const beforeLatest = findLatestPixartExtractionFile(profile);
    runCommand(nodeBin, extractArgs, attempt === 1 ? "Pixart limited extraction" : `Pixart limited extraction retry ${attempt}`);
    latest = findLatestPixartExtractionFile(profile);
    if (!latest || latest === beforeLatest) {
      throw new Error("Pixart extraction did not create a new JSON artifact");
    }

    ({ json } = loadJsonFile(latest));
    rows = Array.isArray(json.rows) ? json.rows : [];
    validRows = countValidPixartRows(json);
    errorCounts = rows.reduce((acc, row) => {
      const error = normalizeText(row.error || "none");
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {});
    completeExtraction = rows.length > 0 && validRows === rows.length && Object.keys(errorCounts).every((key) => key === "none");

    if (completeExtraction || attempt >= 2) break;

    console.log("");
    console.log("Pixart limited extraction produced a partial artifact; retrying once with a fresh browser session.");
    console.log(`  Attempted rows: ${rows.length}`);
    console.log(`  Valid priced rows: ${validRows}`);
    console.log(`  Error counts: ${JSON.stringify(errorCounts)}`);
  }

  console.log("");
  console.log("Pixart first-slice result");
  console.log(`  Artifact: ${latest}`);
  console.log(`  Attempted rows: ${rows.length}`);
  console.log(`  Valid priced rows: ${validRows}`);
  console.log(`  Error counts: ${JSON.stringify(errorCounts)}`);
  console.log(`  Bank write ready: ${completeExtraction ? "yes" : "no"}`);

  if (validRows === 0) {
    console.log("");
    console.log("No bank rows were written. Fix or rerun the Pixart extraction before creating supplier-bank snapshots.");
    if (parsed.flags.has("require-valid-rows")) {
      throw new Error("Pixart first slice produced zero valid priced rows");
    }
    return;
  }

  if (!completeExtraction) {
    console.log("");
    console.log("No bank preview was created because the Pixart extraction was partial. Rerun before creating supplier-bank snapshots.");
    if (parsed.flags.has("require-valid-rows")) {
      throw new Error("Pixart first slice produced a partial extraction");
    }
    return;
  }

  const previewSnapshotPath = createPixartBankPreviewSnapshot(profile, json, latest);
  assertPixartBankPreviewSnapshot(loadJsonFile(previewSnapshotPath).json, path.resolve(previewSnapshotPath));
  console.log(`  Supplier-bank normalized preview: ${previewSnapshotPath}`);
  console.log("");
  console.log("Preview only. No supplier-bank rows, products, published products, or live prices were written.");
}

function groupPixartRowsForAreaSeries(rows) {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const material = normalizeText(row?.material_original || row?.material);
    const finish = normalizeText(row?.finish_original || row?.lamination || "None");
    const area = finiteNumberOrNull(row?.area_m2);
    const quantity = finiteNumberOrNull(row?.quantity);
    const cheapest = finiteNumberOrNull(row?.cheapest_quote_eur);
    const proposed = finiteNumberOrNull(row?.proposed_price_dkk);
    if (!material || !finish || !Number.isFinite(area) || !Number.isFinite(quantity)) return;

    const groupKey = `${material}||${finish}`;
    if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
    const areaKey = String(Number(area.toFixed(4)));
    if (!grouped.get(groupKey).has(areaKey)) grouped.get(groupKey).set(areaKey, new Map());
    grouped.get(groupKey).get(areaKey).set(Number(quantity), {
      cheapest: Number.isFinite(cheapest) ? cheapest : null,
      proposed: Number.isFinite(proposed) ? proposed : null,
      row,
    });
  });
  return grouped;
}

function getPixartAreaSeriesQualityIssues(rows) {
  const issues = [];
  const grouped = groupPixartRowsForAreaSeries(rows);

  for (const [groupKey, areaMap] of grouped.entries()) {
    const areas = [...areaMap.entries()]
      .map(([areaKey, quantities]) => ({ area: Number(areaKey), quantities }))
      .filter((entry) => Number.isFinite(entry.area))
      .sort((left, right) => left.area - right.area);

    for (let leftIndex = 0; leftIndex < areas.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < areas.length; rightIndex += 1) {
        const left = areas[leftIndex];
        const right = areas[rightIndex];
        if (Math.abs(left.area - right.area) < 0.05) continue;

        const sharedQuantities = [...left.quantities.keys()].filter((quantity) => right.quantities.has(quantity));
        if (sharedQuantities.length < 3) continue;

        const identical = sharedQuantities.every((quantity) => {
          const leftValue = left.quantities.get(quantity);
          const rightValue = right.quantities.get(quantity);
          if (!Number.isFinite(leftValue?.cheapest) || !Number.isFinite(rightValue?.cheapest)) return false;
          return Math.abs(leftValue.cheapest - rightValue.cheapest) < 0.005;
        });

        if (identical) {
          issues.push({
            groupKey,
            areaA: left.area,
            areaB: right.area,
            quantities: sharedQuantities.sort((a, b) => a - b),
            reason: "duplicate-cheapest-quote-series-across-areas",
          });
        }
      }
    }
  }

  return issues;
}

function groupPixartRowsForFinishSeries(rows) {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const material = normalizeText(row?.material_original || row?.material);
    const finish = normalizeText(row?.finish_original || row?.lamination || "None");
    const area = finiteNumberOrNull(row?.area_m2);
    const quantity = finiteNumberOrNull(row?.quantity);
    const cheapest = finiteNumberOrNull(row?.cheapest_quote_eur);
    const proposed = finiteNumberOrNull(row?.proposed_price_dkk);
    if (!material || !finish || !Number.isFinite(area) || !Number.isFinite(quantity)) return;

    const groupKey = `${material}||${Number(area.toFixed(4))}`;
    if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
    if (!grouped.get(groupKey).has(finish)) grouped.get(groupKey).set(finish, new Map());
    grouped.get(groupKey).get(finish).set(Number(quantity), {
      cheapest: Number.isFinite(cheapest) ? cheapest : null,
      proposed: Number.isFinite(proposed) ? proposed : null,
      row,
    });
  });
  return grouped;
}

function getPixartFinishSeriesQualityIssues(rows) {
  const issues = [];
  const grouped = groupPixartRowsForFinishSeries(rows);
  const isNoneFinish = (value) => normalizeText(value).toLowerCase() === "none";

  for (const [groupKey, finishMap] of grouped.entries()) {
    const finishes = [...finishMap.entries()].map(([finish, quantities]) => ({ finish, quantities }));

    for (let leftIndex = 0; leftIndex < finishes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < finishes.length; rightIndex += 1) {
        const left = finishes[leftIndex];
        const right = finishes[rightIndex];
        if (left.finish === right.finish) continue;
        if (!isNoneFinish(left.finish) && !isNoneFinish(right.finish)) continue;

        const sharedQuantities = [...left.quantities.keys()].filter((quantity) => right.quantities.has(quantity));
        if (sharedQuantities.length < 3) continue;

        const identical = sharedQuantities.every((quantity) => {
          const leftValue = left.quantities.get(quantity);
          const rightValue = right.quantities.get(quantity);
          if (!Number.isFinite(leftValue?.cheapest) || !Number.isFinite(rightValue?.cheapest)) return false;
          return Math.abs(leftValue.cheapest - rightValue.cheapest) < 0.005;
        });

        if (identical) {
          issues.push({
            groupKey,
            finishA: left.finish,
            finishB: right.finish,
            quantities: sharedQuantities.sort((a, b) => a - b),
            reason: "duplicate-cheapest-quote-series-across-finishes",
          });
        }
      }
    }
  }

  return issues;
}

function getPixartRigidsCategoryMaterialIssues(snapshot) {
  if (snapshot?.bank_product?.supplier_product_key !== PIXART_RIGIDS_BANK_PRODUCT_KEY) return [];
  const rows = Array.isArray(snapshot?.normalized_rows) ? snapshot.normalized_rows : [];
  const categoryMaterials = new Map();

  rows.forEach((row) => {
    const category = normalizeText(row.category_original || row.category);
    const material = normalizeText(row.material_original || row.material_da || row.material);
    if (!category || !material) return;
    if (!categoryMaterials.has(category)) categoryMaterials.set(category, new Set());
    categoryMaterials.get(category).add(material);
  });

  const categories = [...categoryMaterials.keys()].sort();
  if (categories.length <= 1) return [];

  const signatures = categories.map((category) => ({
    category,
    signature: [...categoryMaterials.get(category)].sort().join("||"),
  }));
  const uniqueSignatures = new Set(signatures.map((item) => item.signature));
  if (uniqueSignatures.size > 1) return [];

  return [{
    categories,
    materials: signatures[0]?.signature ? signatures[0].signature.split("||") : [],
    reason: "multi-category rigids preview has identical material set in every category",
  }];
}

function getPixartSourceExtractionQuality(snapshot) {
  const summary = snapshot?.summary || {};
  if (
    Number.isFinite(Number(summary.attempted_rows)) ||
    Number.isFinite(Number(summary.failed_rows)) ||
    summary.error_counts
  ) {
    const attemptedRows = Number.isFinite(Number(summary.attempted_rows))
      ? Number(summary.attempted_rows)
      : countJsonRows(snapshot?.normalized_rows);
    const validRows = Number.isFinite(Number(summary.valid_rows))
      ? Number(summary.valid_rows)
      : countJsonRows(snapshot?.normalized_rows);
    const failedRows = Number.isFinite(Number(summary.failed_rows))
      ? Number(summary.failed_rows)
      : Math.max(0, attemptedRows - validRows);
    return {
      attemptedRows,
      validRows,
      failedRows,
      errorCounts: summary.error_counts || {},
      source: "preview-summary",
    };
  }

  const sourcePath = normalizeText(snapshot?.source_snapshot_path);
  if (!sourcePath) return null;
  const resolvedSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSourcePath)) return null;

  try {
    const source = JSON.parse(fs.readFileSync(resolvedSourcePath, "utf8"));
    const rows = Array.isArray(source?.rows) ? source.rows : [];
    const validRows = countValidPixartRows(source);
    const errorCounts = rows.reduce((acc, row) => {
      const error = normalizeText(row.error || "none");
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {});
    return {
      attemptedRows: rows.length,
      validRows,
      failedRows: Math.max(0, rows.length - validRows),
      errorCounts,
      source: resolvedSourcePath,
    };
  } catch {
    return null;
  }
}

function assertPixartBankPreviewSnapshot(snapshot, snapshotPath) {
  if (snapshot?.snapshot_type !== "supplier-bank-preview") {
    throw new Error(`Not a supplier-bank preview snapshot: ${snapshotPath}`);
  }
  if (snapshot?.supplier?.slug !== "pixartprinting") {
    throw new Error(`Snapshot supplier is not pixartprinting: ${snapshot?.supplier?.slug || "missing"}`);
  }
  if (!snapshot?.bank_product?.supplier_product_key) {
    throw new Error("Pixart preview snapshot is missing bank_product.supplier_product_key");
  }
  if (!PRODUCT_FAMILIES.has(snapshot?.bank_product?.product_family)) {
    throw new Error(`Unsupported Pixart product family: ${snapshot?.bank_product?.product_family}`);
  }
  const rows = Array.isArray(snapshot?.normalized_rows) ? snapshot.normalized_rows : [];
  if (!rows.length) {
    throw new Error("Pixart preview snapshot has zero normalized rows");
  }
  const invalidRows = rows.filter((row) => !Number.isFinite(Number(row.proposed_price_dkk)));
  if (invalidRows.length > 0) {
    throw new Error(`Pixart preview snapshot has ${invalidRows.length} row(s) without proposed_price_dkk`);
  }
  const extractionQuality = getPixartSourceExtractionQuality(snapshot);
  if (extractionQuality) {
    const hasNonNoneErrors = Object.keys(extractionQuality.errorCounts || {}).some((key) => key !== "none");
    if (
      extractionQuality.attemptedRows > 0
      && (
        extractionQuality.failedRows > 0
        || extractionQuality.validRows !== extractionQuality.attemptedRows
        || hasNonNoneErrors
      )
    ) {
      throw new Error(
        `Pixart preview snapshot is partial: ${extractionQuality.validRows}/${extractionQuality.attemptedRows} valid rows (${JSON.stringify(extractionQuality.errorCounts)})`
      );
    }
  }
  const qualityIssues = getPixartAreaSeriesQualityIssues(rows);
  if (qualityIssues.length > 0) {
    const details = qualityIssues
      .slice(0, 5)
      .map((issue) => `${issue.groupKey} area ${issue.areaA} vs ${issue.areaB} qty ${issue.quantities.join(",")}`)
      .join("; ");
    throw new Error(
      `Pixart preview snapshot failed quality gate: duplicate price series across different areas (${details})`
    );
  }
  const finishQualityIssues = getPixartFinishSeriesQualityIssues(rows);
  if (finishQualityIssues.length > 0) {
    const details = finishQualityIssues
      .slice(0, 5)
      .map((issue) => `${issue.groupKey} finish ${issue.finishA} vs ${issue.finishB} qty ${issue.quantities.join(",")}`)
      .join("; ");
    throw new Error(
      `Pixart preview snapshot failed quality gate: duplicate price series across different finishes (${details})`
    );
  }
  const rigidsCategoryIssues = getPixartRigidsCategoryMaterialIssues(snapshot);
  if (rigidsCategoryIssues.length > 0) {
    const details = rigidsCategoryIssues
      .slice(0, 3)
      .map((issue) => `${issue.categories.join(", ")} all use ${issue.materials.join(", ") || "no material"}`)
      .join("; ");
    throw new Error(
      `Pixart rigids preview failed quality gate: category material coverage is suspicious (${details})`
    );
  }
}

function getPixartPreviewPaths() {
  return findFiles(
    path.join("pricing_raw", "supplier-bank-normalized", "pixartprinting", PIXART_FLAT_BANK_PRODUCT_KEY),
    (filePath) => filePath.endsWith(".json")
  );
}

function summarizePixartPreviewPath(previewPath) {
  const resolvedPath = path.resolve(previewPath);
  const stat = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;
  try {
    const { json } = loadJsonFile(previewPath);
    assertPixartBankPreviewSnapshot(json, resolvedPath);
    const rows = Array.isArray(json.normalized_rows) ? json.normalized_rows.length : 0;
    return {
      path: previewPath,
      resolvedPath,
      mtimeMs: stat?.mtimeMs || 0,
      valid: true,
      rows,
      reason: null,
      summary: json.summary || {},
    };
  } catch (error) {
    let rows = 0;
    try {
      const { json } = loadJsonFile(previewPath);
      rows = Array.isArray(json.normalized_rows) ? json.normalized_rows.length : 0;
    } catch {
      rows = 0;
    }
    return {
      path: previewPath,
      resolvedPath,
      mtimeMs: stat?.mtimeMs || 0,
      valid: false,
      rows,
      reason: error.message,
      summary: {},
    };
  }
}

function getPixartLocalPreviewSummaries() {
  return getPixartPreviewPaths()
    .map(summarizePixartPreviewPath)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
}

async function writePixartBankRows({ snapshot, snapshotPath }) {
  assertPixartBankPreviewSnapshot(snapshot, snapshotPath);
  const client = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const normalizedRows = snapshot.normalized_rows;
  const rawRows = Array.isArray(snapshot.raw_rows) ? snapshot.raw_rows : normalizedRows;
  const checksum = stableJsonChecksum(normalizedRows);
  const supplier = snapshot.supplier;
  const bankProduct = snapshot.bank_product;
  const summary = snapshot.summary || {};

  const { data: existingSupplier, error: existingSupplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,enabled")
    .eq("slug", supplier.slug)
    .maybeSingle();

  if (existingSupplierError) {
    throw new Error(`Pixart supplier lookup failed. ${formatSupabaseError(existingSupplierError)}`);
  }

  const supplierRowInput = {
    name: supplier.name,
    slug: supplier.slug,
    website_url: supplier.website_url || null,
    country_code: supplier.country_code || "IT",
    currency: supplier.currency || "EUR",
    integration_type: supplier.integration_type || "scrape",
    enabled: existingSupplier ? existingSupplier.enabled : false,
    metadata: {
      source: "supplier-bank-pixart-preview",
      registryStatus: existingSupplier?.enabled ? "active" : "candidate",
      lastPreviewSnapshotPath: snapshotPath,
    },
  };

  const { data: supplierRow, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .upsert(supplierRowInput, { onConflict: "slug" })
    .select("id,enabled")
    .single();

  if (supplierError) {
    throw new Error(`Pixart supplier upsert failed. ${formatSupabaseError(supplierError)}`);
  }

  const { data: runRow, error: runError } = await client
    .from("supplier_bank_scrape_runs")
    .insert({
      supplier_id: supplierRow.id,
      mode: "product_extract",
      tool: "playwright",
      status: "succeeded",
      input: {
        sourceUrl: bankProduct.source_url,
        supplierProductKey: bankProduct.supplier_product_key,
        productFamily: bankProduct.product_family,
        previewSnapshotPath: snapshotPath,
        sourceSnapshotPath: snapshot.source_snapshot_path || null,
      },
      summary: {
        ...summary,
        previewSnapshotPath: snapshotPath,
        sourceSnapshotPath: snapshot.source_snapshot_path || null,
      },
      finished_at: now,
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(`Pixart scrape-run insert failed. ${formatSupabaseError(runError)}`);
  }

  const { data: existingProductRow, error: existingProductError } = await client
    .from("supplier_bank_products")
    .select("status")
    .eq("supplier_id", supplierRow.id)
    .eq("supplier_product_key", bankProduct.supplier_product_key)
    .maybeSingle();

  if (existingProductError) {
    throw new Error(`Pixart bank product lookup failed. ${formatSupabaseError(existingProductError)}`);
  }

  const preservedStatus = ["approved", "archived"].includes(existingProductRow?.status)
    ? existingProductRow.status
    : "draft";

  const normalizedAttributes = {
    profile: bankProduct.supplier_product_key.replace(/^pixart-/, ""),
    materials: [...new Set(normalizedRows.map((row) => row.material_original).filter(Boolean))],
    finishes: [...new Set(normalizedRows.map((row) => row.finish_original).filter(Boolean))],
    areas_m2: [...new Set(normalizedRows.map((row) => row.area_m2).filter((value) => Number.isFinite(Number(value))))].sort((a, b) => Number(a) - Number(b)),
    quantities: [...new Set(normalizedRows.map((row) => row.quantity).filter((value) => Number.isFinite(Number(value))))].sort((a, b) => Number(a) - Number(b)),
  };

  const { data: productRow, error: productError } = await client
    .from("supplier_bank_products")
    .upsert(
      {
        supplier_id: supplierRow.id,
        latest_scrape_run_id: runRow.id,
        supplier_product_key: bankProduct.supplier_product_key,
        source_url: bankProduct.source_url,
        source_hash: checksum,
        product_family: bankProduct.product_family,
        name_original: bankProduct.name_original,
        name_da: bankProduct.name_da,
        description_original: null,
        description_da: null,
        source_language: bankProduct.source_language || "en",
        target_language: bankProduct.target_language || "da",
        status: preservedStatus,
        normalized_attributes: normalizedAttributes,
        normalized_pricing_summary: {
          rows: summary.rows,
          quantityMin: summary.quantity_min,
          quantityMax: summary.quantity_max,
          areaMinM2: summary.area_min_m2,
          areaMaxM2: summary.area_max_m2,
          priceMinDkk: summary.price_min_dkk,
          priceMaxDkk: summary.price_max_dkk,
        },
        raw_snapshot_path: snapshotPath,
        scrape_status: "fresh",
        last_scraped_at: now,
        last_price_checked_at: now,
        metadata: {
          source: "supplier-bank-pixart-preview",
          previewSnapshotPath: snapshotPath,
          sourceSnapshotPath: snapshot.source_snapshot_path || null,
          supplierEnabledPreserved: supplierRow.enabled,
        },
      },
      { onConflict: "supplier_id,supplier_product_key" },
    )
    .select("id,status")
    .single();

  if (productError) {
    throw new Error(`Pixart bank product upsert failed. ${formatSupabaseError(productError)}`);
  }

  const { data: snapshotRow, error: snapshotError } = await client
    .from("supplier_bank_price_snapshots")
    .insert({
      bank_product_id: productRow.id,
      supplier_id: supplierRow.id,
      scrape_run_id: runRow.id,
      currency: supplier.currency || "EUR",
      conversion_rule_key: `pixart_${bankProduct.supplier_product_key}_fx_${normalizedRows[0]?.conversion?.eur_to_dkk || 7.6}_markup_${normalizedRows[0]?.conversion?.markup_pct ?? "unknown"}`,
      raw_price_rows: rawRows,
      normalized_price_rows: normalizedRows,
      price_min_dkk: summary.price_min_dkk,
      price_max_dkk: summary.price_max_dkk,
      quantity_min: summary.quantity_min,
      quantity_max: summary.quantity_max,
      checksum,
      metadata: {
        previewSnapshotPath: snapshotPath,
        sourceSnapshotPath: snapshot.source_snapshot_path || null,
      },
    })
    .select("id")
    .single();

  if (snapshotError) {
    throw new Error(`Pixart price snapshot insert failed. ${formatSupabaseError(snapshotError)}`);
  }

  return {
    supplierId: supplierRow.id,
    supplierEnabled: supplierRow.enabled,
    scrapeRunId: runRow.id,
    bankProductId: productRow.id,
    bankProductStatus: productRow.status,
    priceSnapshotId: snapshotRow.id,
    checksum,
  };
}

async function runWritePixartBankSnapshot(args) {
  const parsed = parseArgs(args);
  const snapshotPath = parsed.positionals[0];
  if (!snapshotPath) throw new Error(`Missing Pixart preview snapshot path\n\n${usage()}`);

  const { path: resolvedPath, json: snapshot } = loadJsonFile(snapshotPath);
  assertPixartBankPreviewSnapshot(snapshot, resolvedPath);
  const rows = snapshot.normalized_rows || [];
  const summary = snapshot.summary || {};
  const shouldWrite = parsed.flags.has("write-bank");

  console.log("Supplier bank Pixart snapshot write plan");
  console.log("  Scope: Pixart supplier-bank snapshot only");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Product publishing: no");
  console.log(`  Preview snapshot: ${resolvedPath}`);
  console.log(`  Supplier: ${snapshot.supplier.name} (${snapshot.supplier.slug})`);
  console.log(`  Product: ${snapshot.bank_product.name_da} (${snapshot.bank_product.supplier_product_key})`);
  console.log(`  Family: ${snapshot.bank_product.product_family}`);
  console.log(`  Rows: ${rows.length}`);
  console.log(`  Quantities: ${summary.quantity_min ?? "unknown"}-${summary.quantity_max ?? "unknown"}`);
  console.log(`  DKK range: ${summary.price_min_dkk ?? "unknown"}-${summary.price_max_dkk ?? "unknown"}`);

  if (!shouldWrite) {
    console.log("");
    console.log("Preview only. Add --write-bank to store Pixart supplier-bank scrape/product/snapshot rows.");
    return;
  }

  const writeResult = await writePixartBankRows({ snapshot, snapshotPath: resolvedPath });
  console.log("");
  console.log("Pixart supplier-bank write complete");
  console.log(`  Supplier ID: ${writeResult.supplierId}`);
  console.log(`  Supplier enabled preserved: ${writeResult.supplierEnabled ? "yes" : "no"}`);
  console.log(`  Scrape run ID: ${writeResult.scrapeRunId}`);
  console.log(`  Bank product ID: ${writeResult.bankProductId}`);
  console.log(`  Bank product status: ${writeResult.bankProductStatus}`);
  console.log(`  Price snapshot ID: ${writeResult.priceSnapshotId}`);
  console.log(`  Checksum: ${writeResult.checksum}`);
}

async function getPixartRemoteContext(productKey = PIXART_FLAT_BANK_PRODUCT_KEY) {
  const client = getSupabaseServiceClient();
  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled,currency,country_code")
    .eq("slug", "pixartprinting")
    .maybeSingle();

  if (supplierError) throw supplierError;
  if (!supplier) throw new Error("Pixart supplier row not found");

  const { data: bankProduct, error: productError } = await client
    .from("supplier_bank_products")
    .select("id,supplier_product_key,name_da,name_original,status,scrape_status")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) throw productError;
  if (!bankProduct) throw new Error(`Pixart bank product not found: ${productKey}`);

  const { data: snapshots, error: snapshotsError } = await client
    .from("supplier_bank_price_snapshots")
    .select("id,created_at,raw_price_rows,normalized_price_rows,metadata,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (snapshotsError) throw snapshotsError;

  const { data: latestReview, error: reviewError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,status,old_price_snapshot_id,new_price_snapshot_id,change_summary,created_at")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError) throw reviewError;

  return {
    supplier,
    bankProduct,
    latestSnapshot: snapshots?.[0] || null,
    previousSnapshot: snapshots?.[1] || null,
    snapshots: snapshots || [],
    latestReview,
  };
}

function getSnapshotLocalPath(snapshot) {
  return normalizeText(
    snapshot?.metadata?.normalizedSnapshotPath
    || snapshot?.metadata?.previewSnapshotPath
    || snapshot?.metadata?.rawSnapshotPath
  );
}

async function runRestorePixartSafeBaseline(args) {
  const parsed = parseArgs(args);
  const shouldWriteBank = parsed.flags.has("write-bank");
  const shouldWriteDeltaReview = parsed.flags.has("write-delta-review");
  if (shouldWriteDeltaReview && !shouldWriteBank) {
    throw new Error("Pixart baseline recovery delta requires --write-bank so the restored baseline becomes the latest stored snapshot.");
  }

  const context = await getPixartRemoteContext();
  const latestReviewTargetsLatest = context.latestReview?.new_price_snapshot_id === context.latestSnapshot?.id;
  if (!context.latestSnapshot) {
    throw new Error("Pixart has no remote supplier-bank snapshot to restore from.");
  }
  if (!context.latestReview || context.latestReview.status !== "rejected" || !latestReviewTargetsLatest) {
    throw new Error("Pixart safe-baseline restore is allowed only when the latest review is rejected and targets the latest snapshot.");
  }

  const localPreviews = getPixartLocalPreviewSummaries();
  const defaultSafePreview = localPreviews.find((preview) => preview.valid) || null;
  const safePreviewPath = parsed.values["safe-preview"] || defaultSafePreview?.path;
  if (!safePreviewPath) {
    throw new Error("No passing Pixart local preview was found. Rerun the 45-row baseline extraction first.");
  }

  const safePreview = summarizePixartPreviewPath(safePreviewPath);
  if (!safePreview.valid) {
    throw new Error(`Safe Pixart preview does not pass quality gates: ${safePreview.reason}`);
  }

  const rejectedPreviewPath = parsed.values["rejected-preview"] || getSnapshotLocalPath(context.latestSnapshot);
  if (!rejectedPreviewPath) {
    throw new Error("Latest rejected Pixart snapshot has no local preview path in metadata. Pass --rejected-preview <path>.");
  }

  const { path: resolvedSafePath, json: safeSnapshot } = loadJsonFile(safePreview.path);
  assertPixartBankPreviewSnapshot(safeSnapshot, resolvedSafePath);

  const { path: resolvedRejectedPath, json: rejectedSnapshot } = loadJsonFile(rejectedPreviewPath);
  const delta = compareNormalizedSnapshots({
    oldSnapshot: rejectedSnapshot,
    newSnapshot: safeSnapshot,
    thresholdPct: 0,
  });

  const changedCount = delta.changed.length;
  const increasedCount = delta.changed.filter((change) => change.delta > 0).length;
  const decreasedCount = delta.changed.filter((change) => change.delta < 0).length;
  const totalDelta = delta.changed.reduce((sum, change) => sum + change.delta, 0);

  console.log("Supplier bank Pixart safe-baseline restore");
  console.log("  Scope: Pixart supplier-bank snapshot/review recovery");
  console.log("  Supplier scrapes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Product publishing: no");
  console.log(`  Remote supplier: ${context.supplier.name} (${context.supplier.slug})`);
  console.log(`  Bank product: ${context.bankProduct.name_da || context.bankProduct.name_original} (${context.bankProduct.supplier_product_key})`);
  console.log(`  Latest remote snapshot: ${context.latestSnapshot.id}`);
  console.log(`  Latest review: ${context.latestReview.id} (${context.latestReview.status})`);
  console.log(`  Rejected preview: ${resolvedRejectedPath}`);
  console.log(`  Safe baseline preview: ${resolvedSafePath}`);
  console.log(`  Safe baseline rows: ${safePreview.rows}`);
  console.log(`  Write bank snapshot: ${shouldWriteBank ? "yes" : "no"}`);
  console.log(`  Write recovery delta review: ${shouldWriteDeltaReview ? "yes" : "no"}`);

  console.log("");
  console.log("Recovery delta preview");
  console.log(`  Old rows: ${delta.oldRows}`);
  console.log(`  New rows: ${delta.newRows}`);
  console.log(`  Changed rows: ${changedCount}`);
  console.log(`  Increased/decreased: ${increasedCount}/${decreasedCount}`);
  console.log(`  Added/removed rows: ${delta.added.length}/${delta.removed.length}`);
  console.log(`  Unchanged rows: ${delta.unchanged}`);
  console.log(`  Duplicate keys old/new: ${delta.duplicateOldKeys}/${delta.duplicateNewKeys}`);
  console.log(`  Net changed-row delta DKK: ${Number(totalDelta.toFixed(2))}`);

  if (!shouldWriteBank) {
    console.log("");
    console.log("Preview only. Add --write-bank --write-delta-review to store the safe baseline as the latest Pixart bank snapshot and create a draft recovery review.");
    return;
  }

  const writeResult = await writePixartBankRows({ snapshot: safeSnapshot, snapshotPath: resolvedSafePath });
  console.log("");
  console.log("Pixart safe-baseline bank snapshot written");
  console.log(`  Supplier ID: ${writeResult.supplierId}`);
  console.log(`  Supplier enabled preserved: ${writeResult.supplierEnabled ? "yes" : "no"}`);
  console.log(`  Scrape run ID: ${writeResult.scrapeRunId}`);
  console.log(`  Bank product ID: ${writeResult.bankProductId}`);
  console.log(`  Bank product status: ${writeResult.bankProductStatus}`);
  console.log(`  Restored price snapshot ID: ${writeResult.priceSnapshotId}`);

  if (!shouldWriteDeltaReview) {
    console.log("");
    console.log("Bank snapshot written. Add --write-delta-review in the same command on the next run to store the recovery review.");
    return;
  }

  const reviewWrite = await writeDeltaReviewRecord({
    oldSnapshot: rejectedSnapshot,
    newSnapshot: safeSnapshot,
    oldPath: resolvedRejectedPath,
    newPath: resolvedSafePath,
    thresholdPct: 0,
    result: delta,
    notes: parsed.values.notes || "Pixart safe baseline restoration",
  });

  console.log("");
  console.log("Pixart safe-baseline recovery review stored");
  console.log(`  Delta review ID: ${reviewWrite.id}`);
  console.log(`  Already existed: ${reviewWrite.alreadyExisted ? "yes" : "no"}`);
  console.log(`  Linked old snapshot ID: ${reviewWrite.oldPriceSnapshotId || "not linked"}`);
  console.log(`  Linked restored snapshot ID: ${reviewWrite.newPriceSnapshotId || "not linked"}`);
}

function findLatestWmdNormalizedSnapshots(productSlug = WMD_FULL_BANK_PRODUCT_KEY) {
  const normalizedDir = path.join(
    "pricing_raw",
    "supplier-bank-normalized",
    "wir-machen-druck",
    productSlug,
  );
  const snapshots = findFiles(normalizedDir, (filePath) => filePath.endsWith(".json"));
  return snapshots.slice(-2);
}

async function loadRefreshQueueJobs({ jobId, limit }) {
  const client = getSupabaseServiceClient();
  let query = client
    .from("supplier_bank_refresh_jobs")
    .select("id,supplier_id,bank_product_id,mode,tool,status,request_summary,result_summary,error,queued_at,started_at,finished_at")
    .order("queued_at", { ascending: true });

  if (jobId) {
    query = query.eq("id", jobId);
  } else {
    query = query.in("status", ["queued", "running"]).limit(limit);
  }

  const { data: jobs, error: jobError } = await query;
  if (jobError) throw jobError;
  const rows = jobs || [];
  if (rows.length === 0) return [];

  const bankProductIds = [...new Set(rows.map((job) => job.bank_product_id).filter(Boolean))];
  const supplierIds = [...new Set(rows.map((job) => job.supplier_id).filter(Boolean))];

  const { data: products, error: productError } = await client
    .from("supplier_bank_products")
    .select("id,supplier_id,supplier_product_key,name_da,product_family,status")
    .in("id", bankProductIds);
  if (productError) throw productError;

  const productById = new Map((products || []).map((product) => [product.id, product]));
  const missingSupplierIds = (products || []).map((product) => product.supplier_id).filter(Boolean);
  missingSupplierIds.forEach((supplierId) => supplierIds.push(supplierId));

  const { data: suppliers, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,slug,name,integration_type")
    .in("id", [...new Set(supplierIds)]);
  if (supplierError) throw supplierError;

  const supplierById = new Map((suppliers || []).map((supplier) => [supplier.id, supplier]));

  return rows.map((job) => {
    const product = productById.get(job.bank_product_id) || null;
    const supplier = supplierById.get(job.supplier_id || product?.supplier_id) || null;
    return { job, product, supplier };
  });
}

async function updateRefreshJobStatus(client, jobId, status, patch = {}) {
  const { data, error } = await client
    .from("supplier_bank_refresh_jobs")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...patch,
    })
    .eq("id", jobId)
    .select("id,status,updated_at")
    .single();

  if (error) throw error;
  return data;
}

function assertSupportedRefreshQueueJob(entry) {
  const { job, product, supplier } = entry;
  if (!product) throw new Error(`Refresh job ${job.id} is missing linked bank product ${job.bank_product_id}`);
  if (!supplier) throw new Error(`Refresh job ${job.id} is missing linked supplier`);
  if (supplier.slug !== "wir-machen-druck" || product.supplier_product_key !== WMD_FULL_BANK_PRODUCT_KEY) {
    throw new Error(`Refresh job ${job.id} is not supported by this worker yet: ${supplier.slug}/${product.supplier_product_key}`);
  }
  if (job.mode !== "price_refresh") {
    throw new Error(`Refresh job ${job.id} has unsupported mode '${job.mode}'`);
  }
}

async function runProcessRefreshQueue(args) {
  const parsed = parseArgs(args);
  const confirmProcess = parsed.flags.has("confirm-process");
  const limit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 1)));
  const jobId = normalizeText(parsed.values["job-id"]);
  const entries = await loadRefreshQueueJobs({ jobId, limit });

  console.log("Supplier bank refresh queue processor");
  console.log("  Scope: queued supplier-bank refresh jobs");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Supported worker in this slice: WIRmachenDRUCK wmd-folder-bank price_refresh");

  if (entries.length === 0) {
    console.log("");
    console.log("No queued/running refresh jobs found.");
    return;
  }

  console.log("");
  console.log("Queued jobs:");
  entries.forEach(({ job, product, supplier }, index) => {
    console.log(`  ${index + 1}. ${job.id}`);
    console.log(`     Status: ${job.status}`);
    console.log(`     Supplier/product: ${supplier?.slug || "unknown"}/${product?.supplier_product_key || "unknown"}`);
    console.log(`     Mode/tool: ${job.mode}/${job.tool}`);
    console.log(`     Queued: ${formatMaybeDate(job.queued_at)}`);
  });

  if (!confirmProcess) {
    console.log("");
    console.log("Preview only. Add --confirm-process to process the first queued job.");
    return;
  }

  const entry = entries[0];
  const { job } = entry;
  if (job.status !== "queued") {
    throw new Error(`Refusing to process refresh job ${job.id} because status is '${job.status}', not 'queued'.`);
  }
  assertSupportedRefreshQueueJob(entry);

  const client = getSupabaseServiceClient();
  await updateRefreshJobStatus(client, job.id, "running", {
    started_at: new Date().toISOString(),
    result_summary: {
      worker: "supplier-bank-cli",
      phase: "running_wmd_refresh",
    },
    error: null,
  });

  const nodeBin = resolveLocalNodeBinary();
  const refreshArgs = ["scripts/supplier-bank-cli.mjs", "refresh-wmd-bank", "--confirm-bank-write"];
  if (parsed.values["from-clean-csv"]) refreshArgs.push("--from-clean-csv", parsed.values["from-clean-csv"]);
  if (parsed.values["max-detail-pages"]) refreshArgs.push("--max-detail-pages", parsed.values["max-detail-pages"]);

  try {
    runCommand(nodeBin, refreshArgs, "queued WMD supplier-bank refresh");

    const latestSnapshots = findLatestWmdNormalizedSnapshots(WMD_FULL_BANK_PRODUCT_KEY);
    if (latestSnapshots.length < 2) {
      throw new Error("Could not find two WMD normalized snapshots after refresh.");
    }

    const [oldSnapshotPath, newSnapshotPath] = latestSnapshots;
    runCommand(
      nodeBin,
      [
        "scripts/supplier-bank-cli.mjs",
        "compare-normalized-snapshots",
        oldSnapshotPath,
        newSnapshotPath,
        "--write-delta-review",
        "--notes",
        `Created by supplier-bank refresh queue job ${job.id}`,
      ],
      "queued WMD delta review creation",
    );

    await updateRefreshJobStatus(client, job.id, "succeeded", {
      finished_at: new Date().toISOString(),
      result_summary: {
        worker: "supplier-bank-cli",
        oldSnapshotPath,
        newSnapshotPath,
        createdDeltaReview: true,
      },
      error: null,
    });

    console.log("");
    console.log("Refresh queue job completed");
    console.log(`  Job: ${job.id}`);
    console.log(`  Old snapshot: ${oldSnapshotPath}`);
    console.log(`  New snapshot: ${newSnapshotPath}`);
  } catch (error) {
    await updateRefreshJobStatus(client, job.id, "failed", {
      finished_at: new Date().toISOString(),
      result_summary: {
        worker: "supplier-bank-cli",
        failed: true,
      },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function extractProductSlugFromImportJob(job) {
  const summary = job?.import_summary;
  if (summary && typeof summary === "object" && typeof summary.productSlug === "string") {
    return summary.productSlug;
  }
  return null;
}

function formatDecisionValue(value) {
  return value == null ? "unknown" : String(value);
}

function getMatrixDraftImportUnsupportedReason(product) {
  if (product?.supplier_product_key === PIXART_FLAT_BANK_PRODUCT_KEY) {
    return "Pixart flat-surface rows require the storformat conversion path before draft import.";
  }
  if (product?.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY) {
    return "Pixart rigids rows require the storformat conversion path before draft import.";
  }
  return null;
}

function getSupplierBankImportRoute(product, importedJob) {
  if (importedJob?.import_mode === "storformat") return "storformat";
  if (importedJob?.import_mode === "matrix_layout_v1") return "matrix_layout_v1";
  if (getMatrixDraftImportUnsupportedReason(product)) return "storformat";
  return "matrix_layout_v1";
}

function getSupplierBankImportGate({ product, snapshotStats, latestReview, importedJob }) {
  if (importedJob?.target_product_id) {
    return {
      state: "already_imported",
      reason: extractProductSlugFromImportJob(importedJob) || importedJob.target_product_id,
    };
  }

  if (product.status === "archived" || product.status === "failed") {
    return {
      state: "blocked",
      reason: "Produktet er arkiveret eller fejlet.",
    };
  }

  const snapshotCount = snapshotStats?.count || 0;
  if (snapshotCount === 0) {
    return {
      state: "blocked",
      reason: "Kraever mindst et gemt price snapshot.",
    };
  }

  if (snapshotCount >= 2) {
    if (!latestReview) {
      return {
        state: "blocked",
        reason: "Opret og gennemgå prisreview før import.",
      };
    }

    if (latestReview.new_price_snapshot_id !== snapshotStats.latestSnapshotId) {
      return {
        state: "blocked",
        reason: "Prisreview matcher ikke seneste price snapshot.",
      };
    }

    if (latestReview.status === "draft") {
      return {
        state: "blocked",
        reason: "Prisreview er stadig kladde.",
      };
    }

    if (latestReview.status === "reviewed") {
      return {
        state: "blocked",
        reason: "Prisreview skal accepteres før import.",
      };
    }

    if (latestReview.status === "rejected") {
      return {
        state: "blocked",
        reason: "Seneste prisreview er afvist.",
      };
    }
  }

  const unsupportedReason = getMatrixDraftImportUnsupportedReason(product);
  if (unsupportedReason) {
    return {
      state: "blocked",
      reason: unsupportedReason,
    };
  }

  if (product.status !== "approved") {
    return {
      state: "needs_approval",
      reason: `Bank status er ${product.status}; admin-import vil kræve godkendelse først.`,
    };
  }

  return {
    state: "ready",
    reason: "Klar til explicit draft import.",
  };
}

function readBankDraftSelection(row, key) {
  if (row?.selections && Object.prototype.hasOwnProperty.call(row.selections, key)) return row.selections[key];
  if (row?.options && Object.prototype.hasOwnProperty.call(row.options, key)) return row.options[key];
  if (row?.labels && Object.prototype.hasOwnProperty.call(row.labels, `${key}Label`)) return row.labels[`${key}Label`];
  if (row?.labels && Object.prototype.hasOwnProperty.call(row.labels, key)) return row.labels[key];
  return null;
}

function getBankDraftSelection(row, key) {
  return normalizeText(readBankDraftSelection(row, key));
}

function getBankDraftPrice(row) {
  return finiteNumberOrNull(row?.finalPriceDkk ?? row?.proposedPriceDkk ?? row?.proposed_price_dkk);
}

function resolveBankDraftAttributeKey(attribute, index) {
  return normalizeText(attribute?.key || attribute?.slug || `attribute_${index}`);
}

function resolveBankDraftAttributeLabel(attribute, key) {
  return normalizeText(attribute?.labelDa || attribute?.labelOriginal || attribute?.name_da || attribute?.name_original || attribute?.name || key);
}

function resolveBankDraftValueKey(value) {
  return normalizeText(value?.key ?? value?.slug ?? value?.value ?? value?.name_da ?? value?.labelDa ?? value);
}

function resolveBankDraftValueLabel(value, key) {
  return normalizeText(value?.labelDa || value?.labelOriginal || value?.name_da || value?.name_original || value?.name || key);
}

function findBankDraftSampleOption(options, rawValue) {
  const comparable = normalizeText(rawValue);
  return (Array.isArray(options) ? options : [])
    .find((option) => normalizeText(option?.slug ?? option?.key ?? option?.value) === comparable) || null;
}

function buildBankDraftAttributeDefinitions(attributes, rows) {
  if (Array.isArray(attributes)) {
    return attributes
      .map((attribute, index) => {
        const key = resolveBankDraftAttributeKey(attribute, index);
        const values = Array.isArray(attribute?.values) ? attribute.values : [];
        return {
          key,
          labelDa: resolveBankDraftAttributeLabel(attribute, key),
          labelOriginal: normalizeText(attribute?.labelOriginal || attribute?.name_original || attribute?.labelDa || attribute?.name_da || key),
          values: values
            .map((value) => {
              const valueKey = resolveBankDraftValueKey(value);
              return {
                key: valueKey,
                labelDa: resolveBankDraftValueLabel(value, valueKey),
                labelOriginal: normalizeText(value?.labelOriginal || value?.name_original || value?.labelDa || value?.name_da || valueKey),
              };
            })
            .filter((value) => value.key && value.labelDa),
        };
      })
      .filter((attribute) => attribute.key && attribute.values.length > 0);
  }

  const sourceAttributes = Array.isArray(attributes?.attributes) ? attributes.attributes : [];
  return sourceAttributes
    .map((attribute, index) => {
      const key = resolveBankDraftAttributeKey(attribute, index);
      if (!key || key === "copies") return null;

      const rawValues = uniqueValues(
        (Array.isArray(rows) ? rows : [])
          .map((row) => readBankDraftSelection(row, key))
          .filter((value) => value !== null && value !== undefined && normalizeText(value))
          .map((value) => normalizeText(value))
      );
      if (rawValues.length === 0) return null;
      if (rawValues.length === 1 && !PRINT_COM_DRAFT_ANCHOR_OPTION_KEYS.has(key)) return null;

      const sampleOptions = Array.isArray(attribute?.sample_options) ? attribute.sample_options : [];
      const values = rawValues.map((rawValue) => {
        const sample = findBankDraftSampleOption(sampleOptions, rawValue);
        return {
          key: rawValue,
          labelDa: resolveBankDraftValueLabel(sample, rawValue),
          labelOriginal: normalizeText(sample?.name_original || sample?.labelOriginal || sample?.name_da || sample?.labelDa || rawValue),
        };
      });

      return {
        key,
        labelDa: resolveBankDraftAttributeLabel(attribute, key),
        labelOriginal: normalizeText(attribute?.name_original || attribute?.labelOriginal || attribute?.name_da || attribute?.labelDa || key),
        values,
      };
    })
    .filter(Boolean);
}

function summarizeBankDraftImportShape({ product, snapshot, normalizedRows }) {
  const rows = Array.isArray(normalizedRows) ? normalizedRows : [];
  const attributes = buildBankDraftAttributeDefinitions(product.normalized_attributes || [], rows);
  const materialAttribute = attributes.find((attribute) => attribute.key === "material") || attributes[0] || null;
  const sectionAttributes = attributes.filter((attribute) => attribute.key !== materialAttribute?.key);
  const quantities = uniqueValues(rows.map((row) => Number(row?.quantity)).filter(Number.isFinite)).sort((left, right) => left - right);
  const prices = rows.map(getBankDraftPrice).filter((price) => Number.isFinite(price));
  const rowsWithPrice = rows.filter((row) => Number.isFinite(getBankDraftPrice(row)));
  const rowsWithMaterial = materialAttribute
    ? rowsWithPrice.filter((row) => getBankDraftSelection(row, materialAttribute.key))
    : [];
  const missingSelectionCounts = attributes
    .map((attribute) => ({
      key: attribute.key,
      missing: rows.filter((row) => !getBankDraftSelection(row, attribute.key)).length,
    }))
    .filter((entry) => entry.missing > 0);
  const tshirtTechnicalSpecs = product.product_family === "tshirts"
    ? buildTshirtTechnicalSpecs({
        widthMm: SUPPLIER_BANK_TSHIRT_FORMAT.widthMm,
        heightMm: SUPPLIER_BANK_TSHIRT_FORMAT.heightMm,
        formatLabel: SUPPLIER_BANK_TSHIRT_FORMAT.label,
      })
    : null;

  return {
    rowsPrepared: rows.length,
    rowsWithPrice: rowsWithPrice.length,
    genericRowsPrepared: rowsWithMaterial.length,
    quantityMin: quantities[0] ?? snapshot?.quantity_min ?? null,
    quantityMax: quantities[quantities.length - 1] ?? snapshot?.quantity_max ?? null,
    quantities,
    priceMinDkk: prices.length ? Math.min(...prices) : snapshot?.price_min_dkk ?? null,
    priceMaxDkk: prices.length ? Math.max(...prices) : snapshot?.price_max_dkk ?? null,
    attributeCount: attributes.length,
    materialAttribute,
    sectionAttributes,
    missingSelectionCounts,
    tshirtSizeDistribution: tshirtTechnicalSpecs?.size_distribution || null,
  };
}

function resolveSupplierBankDraftGroupKind(key) {
  if (key === "format" || key === "size") return "format";
  if (key === "material") return "material";
  if (key === "fold" || key === "finish") return "finish";
  return "other";
}

function resolveSupplierBankDraftSectionType(key) {
  if (key === "format" || key === "size") return "formats";
  if (key === "material") return "materials";
  if (key === "fold" || key === "finish") return "finishes";
  return "other";
}

function uniqueRowsById(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function buildSupplierBankDraftTechnicalSpecs(product) {
  const specs = {
    bleed_mm: 3,
    min_dpi: 300,
    source: "supplier-bank",
    supplierProductKey: product.supplier_product_key,
    bankProductId: product.id,
  };

  if (product.product_family === "tshirts") {
    return {
      ...specs,
      ...buildTshirtTechnicalSpecs({
        widthMm: SUPPLIER_BANK_TSHIRT_FORMAT.widthMm,
        heightMm: SUPPLIER_BANK_TSHIRT_FORMAT.heightMm,
        formatLabel: SUPPLIER_BANK_TSHIRT_FORMAT.label,
      }),
    };
  }

  return specs;
}

async function cleanupSupplierBankDraftProduct(client, productId) {
  const errors = [];
  const deleteByProductId = async (tableName) => {
    const { error } = await client.from(tableName).delete().eq("product_id", productId);
    if (error) errors.push(`${tableName}: ${formatSupabaseError(error)}`);
  };

  await deleteByProductId("generic_product_prices");
  await deleteByProductId("product_attribute_values");
  await deleteByProductId("product_attribute_groups");

  const { error: jobError } = await client
    .from("supplier_bank_import_jobs")
    .delete()
    .eq("target_product_id", productId);
  if (jobError) errors.push(`supplier_bank_import_jobs: ${formatSupabaseError(jobError)}`);

  const { error: productError } = await client
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("is_published", false);
  if (productError) errors.push(`products: ${formatSupabaseError(productError)}`);

  return {
    attempted: true,
    productId,
    errors,
    success: errors.length === 0,
  };
}

async function createSupplierBankMatrixDraft({
  client,
  supplier,
  product,
  latestSnapshot,
  normalizedRows,
  shape,
  targetTenantId,
  productName,
  productSlug,
  latestReview,
}) {
  const { data: createdProduct, error: createError } = await client
    .from("products")
    .insert({
      tenant_id: targetTenantId,
      name: productName,
      slug: productSlug,
      icon_text: productName,
      description: product.description_da || product.description_original || "Supplier-bank draft product",
      category: "tryksager",
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: buildSupplierBankDraftTechnicalSpecs(product),
    })
    .select("id,slug,is_published")
    .single();
  if (createError) throw new Error(`Draft product insert failed. ${formatSupabaseError(createError)}`);

  const createdDraftProductId = createdProduct.id;

  try {
    const groupByKey = new Map();
    const valueByGroupKey = new Map();
    const allAttributes = [shape.materialAttribute, ...shape.sectionAttributes].filter(Boolean);

    for (let index = 0; index < allAttributes.length; index += 1) {
      const attribute = allAttributes[index];
      const key = attribute.key || `attribute_${index}`;
      const { data: group, error: groupError } = await client
        .from("product_attribute_groups")
        .insert({
          tenant_id: targetTenantId,
          product_id: createdProduct.id,
          name: attribute.labelDa || attribute.labelOriginal || key,
          kind: resolveSupplierBankDraftGroupKind(key),
          source: "product",
          ui_mode: "buttons",
          sort_order: index,
          enabled: true,
        })
        .select("id")
        .single();
      if (groupError) throw new Error(`Attribute group insert failed. ${formatSupabaseError(groupError)}`);

      groupByKey.set(key, group);
      valueByGroupKey.set(key, new Map());

      const values = Array.isArray(attribute.values) ? attribute.values : [];
      for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
        const value = values[valueIndex];
        const label = normalizeText(value.labelDa || value.labelOriginal || value.key);
        const valueKey = normalizeText(value.key || value.slug || value.value || label);
        if (!label) continue;

        const { data: attributeValue, error: valueError } = await client
          .from("product_attribute_values")
          .insert({
            tenant_id: targetTenantId,
            product_id: createdProduct.id,
            group_id: group.id,
            name: label,
            sort_order: valueIndex,
            enabled: true,
            width_mm: finiteNumberOrNull(value.widthMm),
            height_mm: finiteNumberOrNull(value.heightMm),
            meta: value.metadata || {},
          })
          .select("id,name")
          .single();
        if (valueError) throw new Error(`Attribute value insert failed. ${formatSupabaseError(valueError)}`);

        valueByGroupKey.get(key).set(label, attributeValue);
        if (valueKey) valueByGroupKey.get(key).set(valueKey, attributeValue);
      }
    }

    const materialKey = shape.materialAttribute?.key || "material";
    const materialGroup = groupByKey.get(materialKey);
    const sectionRows = shape.sectionAttributes.map((attribute, index) => {
      const group = groupByKey.get(attribute.key);
      const values = uniqueRowsById(Array.from(valueByGroupKey.get(attribute.key)?.values() || []));
      return {
        id: `row-${attribute.key || index}`,
        title: "",
        description: "",
        columns: [{
          id: `${attribute.key || index}-section`,
          sectionType: resolveSupplierBankDraftSectionType(attribute.key),
          groupId: group?.id || null,
          valueIds: values.map((value) => value.id),
          ui_mode: "buttons",
          selection_mode: "required",
          valueSettings: {},
          title: attribute.labelDa || attribute.labelOriginal || attribute.key,
          description: "",
        }],
      };
    });

    const materialValues = uniqueRowsById(Array.from(valueByGroupKey.get(materialKey)?.values() || []));
    const pricingStructure = {
      mode: "matrix_layout_v1",
      version: 1,
      vertical_axis: {
        sectionId: "vertical-axis",
        sectionType: "materials",
        groupId: materialGroup?.id || null,
        valueIds: materialValues.map((value) => value.id),
        ui_mode: "buttons",
        valueSettings: {},
        title: shape.materialAttribute?.labelDa || "Materiale",
        description: "",
      },
      layout_rows: sectionRows,
      quantities: shape.quantities,
    };

    const genericRows = normalizedRows.map((row) => {
      const materialValue = valueByGroupKey.get(materialKey)?.get(getBankDraftSelection(row, materialKey));
      const selectedSections = shape.sectionAttributes
        .map((attribute) => {
          const value = valueByGroupKey.get(attribute.key)?.get(getBankDraftSelection(row, attribute.key));
          return value ? { attribute, value } : null;
        })
        .filter(Boolean);
      const sectionValueIds = selectedSections.map((entry) => entry.value.id);
      const variantValueIds = selectedSections
        .filter((entry) => !["format", "material"].includes(String(entry.attribute.key || "").toLowerCase()))
        .map((entry) => entry.value.id);
      const selectionMap = {};
      if (materialValue) selectionMap[materialKey] = materialValue.id;
      selectedSections.forEach((entry) => {
        if (!entry?.attribute?.key || !entry?.value?.id) return;
        selectionMap[entry.attribute.key] = entry.value.id;
      });
      if (variantValueIds.length > 0) selectionMap.variantValueIds = [...variantValueIds];

      const extraIds = {
        verticalAxisGroupId: materialGroup?.id || null,
        verticalAxisValueId: materialValue?.id || null,
        materialId: materialValue?.id || null,
        variantValueIds,
        selectionMap,
      };
      selectedSections.forEach((entry) => {
        const key = String(entry.attribute.key || "");
        if (key === "format" || key === "size") extraIds.formatId = entry.value.id;
        if (key === "surface") extraIds.surfaceId = entry.value.id;
        if (key === "fold") extraIds.foldId = entry.value.id;
        if (key === "pages") extraIds.pagesId = entry.value.id;
        if (key === "orientation") extraIds.orientationId = entry.value.id;
      });

      const price = getBankDraftPrice(row);
      if (!materialValue || !Number.isFinite(price)) return null;
      return {
        tenant_id: targetTenantId,
        product_id: createdProduct.id,
        variant_name: [...sectionValueIds].sort().join("|") || "none",
        variant_value: materialValue.id,
        quantity: Number(row.quantity),
        price_dkk: price,
        extra_data: {
          ...extraIds,
          supplierBankProductId: product.id,
          supplierBankPriceSnapshotId: latestSnapshot.id,
          supplierPrice: finiteNumberOrNull(row.supplierPrice),
          supplierCurrency: row.supplierCurrency || latestSnapshot.currency || null,
          convertedPriceDkk: finiteNumberOrNull(row.convertedPriceDkk),
          selections: row.selections || row.options || {},
        },
      };
    }).filter(Boolean);

    if (genericRows.length !== shape.rowsPrepared) {
      throw new Error(`Prepared ${shape.rowsPrepared} rows but only ${genericRows.length} generic price rows mapped.`);
    }

    const { error: productUpdateError } = await client
      .from("products")
      .update({ pricing_structure: pricingStructure, pricing_type: "matrix", is_published: false })
      .eq("id", createdProduct.id);
    if (productUpdateError) throw new Error(`Product pricing update failed. ${formatSupabaseError(productUpdateError)}`);

    const priceChunkSize = 500;
    for (let index = 0; index < genericRows.length; index += priceChunkSize) {
      const batch = genericRows.slice(index, index + priceChunkSize);
      const { error: priceError } = await client.from("generic_product_prices").insert(batch);
      if (priceError) throw new Error(`Price row insert failed. ${formatSupabaseError(priceError)}`);
    }

    const { data: importJob, error: jobError } = await client
      .from("supplier_bank_import_jobs")
      .insert({
        bank_product_id: product.id,
        target_tenant_id: targetTenantId,
        target_product_id: createdProduct.id,
        import_mode: "matrix_layout_v1",
        status: "imported",
        import_summary: {
          bankProductId: product.id,
          supplierSlug: supplier.slug,
          supplierProductKey: product.supplier_product_key,
          productFamily: product.product_family,
          productSlug,
          rowsPrepared: shape.rowsPrepared,
          rowsInserted: genericRows.length,
          quantityMin: shape.quantityMin,
          quantityMax: shape.quantityMax,
          priceMinDkk: shape.priceMinDkk,
          priceMaxDkk: shape.priceMaxDkk,
          priceSnapshotId: latestSnapshot.id,
          latestReviewId: latestReview?.id || null,
          attributeGroups: allAttributes.map((attribute) => ({
            key: attribute.key,
            label: attribute.labelDa || attribute.labelOriginal || attribute.key,
            values: Array.isArray(attribute.values) ? attribute.values.length : 0,
          })),
        },
        rollback_note: "Delete created unpublished draft product and related product_attribute_groups/product_attribute_values/generic_product_prices if rollback is needed.",
        created_by: null,
      })
      .select("id")
      .single();
    if (jobError) throw new Error(`Supplier-bank import job insert failed. ${formatSupabaseError(jobError)}`);

    return {
      productId: createdProduct.id,
      productSlug: createdProduct.slug,
      isPublished: createdProduct.is_published,
      rowsInserted: genericRows.length,
      importJobId: importJob.id,
      attributeGroupCount: allAttributes.length,
    };
  } catch (error) {
    const rollback = await cleanupSupplierBankDraftProduct(client, createdDraftProductId);
    if (!rollback.success) {
      console.warn(`Rollback for ${createdDraftProductId} had errors: ${rollback.errors.join("; ")}`);
    }
    throw error;
  }
}

async function runPreviewBankDraftImport(args) {
  const parsed = parseArgs(args);
  const shouldWriteDraft = parsed.flags.has("write-draft-product");
  const supplierSlug = parsed.values["supplier-slug"] || PRINT_COM_SUPPLIER_SLUG;
  const productKey = parsed.values["product-key"] || "flyers";
  const targetTenantId = parsed.values.tenant || MASTER_TENANT_ID;
  const client = getSupabaseServiceClient();

  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled")
    .eq("slug", supplierSlug)
    .maybeSingle();

  if (supplierError) throw new Error(`Supplier lookup failed. ${formatSupabaseError(supplierError)}`);
  if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);

  const { data: product, error: productError } = await client
    .from("supplier_bank_products")
    .select("id,supplier_id,supplier_product_key,name_da,name_original,description_da,description_original,product_family,status,scrape_status,normalized_attributes,normalized_pricing_summary")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) throw new Error(`Bank product lookup failed. ${formatSupabaseError(productError)}`);
  if (!product) throw new Error(`Bank product not found: ${productKey}`);

  const { data: snapshots, error: snapshotsError } = await client
    .from("supplier_bank_price_snapshots")
    .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk,currency,normalized_price_rows")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false });

  if (snapshotsError) throw new Error(`Price snapshot lookup failed. ${formatSupabaseError(snapshotsError)}`);
  const latestSnapshot = snapshots?.[0] || null;

  const { data: reviews, error: reviewsError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,bank_product_id,status,new_price_snapshot_id,change_summary,created_at")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false });

  if (reviewsError) throw new Error(`Delta review lookup failed. ${formatSupabaseError(reviewsError)}`);

  const { data: importJobs, error: importJobsError } = await client
    .from("supplier_bank_import_jobs")
    .select("id,bank_product_id,status,import_mode,target_product_id,import_summary,created_at")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false });

  if (importJobsError) throw new Error(`Import job lookup failed. ${formatSupabaseError(importJobsError)}`);

  const snapshotStats = getSnapshotStatsByProductId(snapshots || []).get(product.id) || null;
  const latestReview = getLatestByProductId(reviews || []).get(product.id) || null;
  const latestImportedJob = getLatestByProductId(
    (importJobs || []).filter((job) => job.status === "imported" && job.target_product_id)
  ).get(product.id) || null;
  const gate = getSupplierBankImportGate({
    product,
    snapshotStats,
    latestReview,
    importedJob: latestImportedJob,
  });

  const normalizedRows = Array.isArray(latestSnapshot?.normalized_price_rows)
    ? latestSnapshot.normalized_price_rows
    : [];
  const shape = summarizeBankDraftImportShape({
    product,
    snapshot: latestSnapshot,
    normalizedRows,
  });
  const productName = parsed.values.name || product.name_da || product.name_original || "Supplier product";
  const productSlug = parsed.values.slug || slugify(`${product.supplier_product_key || productName}-${product.id.slice(0, 8)}`);

  const { data: existingProduct, error: existingError } = await client
    .from("products")
    .select("id,slug,is_published")
    .eq("tenant_id", targetTenantId)
    .eq("slug", productSlug)
    .maybeSingle();

  if (existingError) throw new Error(`Target product slug lookup failed. ${formatSupabaseError(existingError)}`);

  const importWouldCreateUsableRows =
    gate.state === "ready"
    && !existingProduct
    && shape.rowsPrepared > 0
    && shape.genericRowsPrepared === shape.rowsPrepared
    && shape.attributeCount > 0;

  console.log("Supplier bank draft import preview");
  console.log(`  Scope: ${shouldWriteDraft ? "guarded unpublished Matrix Layout draft import" : "read-only draft-import proof"}`);
  console.log(`  Product writes: ${shouldWriteDraft ? "yes, unpublished draft only" : "no"}`);
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Source");
  console.log(`  Supplier: ${supplier.name} (${supplier.slug})`);
  console.log(`  Supplier enabled: ${supplier.enabled ? "yes" : "no"}`);
  console.log(`  Bank product: ${product.name_da || product.name_original || product.supplier_product_key}`);
  console.log(`  Family/status: ${product.product_family} / ${product.status}`);
  console.log(`  Latest snapshot: ${latestSnapshot?.id || "none"}`);
  console.log(`  Stored snapshots: ${(snapshots || []).length}`);
  console.log(`  Latest review: ${latestReview?.status || "none"}`);
  console.log(`  Import gate: ${formatEligibilityState(gate.state)} - ${gate.reason}`);
  console.log("");
  console.log("Draft target");
  console.log(`  Target tenant: ${targetTenantId}`);
  console.log(`  Draft name: ${productName}`);
  console.log(`  Draft slug: ${productSlug}`);
  console.log(`  Existing target slug: ${existingProduct ? `${existingProduct.id} (${existingProduct.is_published ? "published" : "unpublished"})` : "no"}`);
  console.log("");
  console.log("Matrix shape");
  console.log(`  Import mode: Matrix Layout V1`);
  console.log(`  Snapshot rows: ${shape.rowsPrepared}`);
  console.log(`  Rows with price: ${shape.rowsWithPrice}`);
  console.log(`  Rows that would become generic_product_prices: ${shape.genericRowsPrepared}`);
  console.log(`  Quantities: ${shape.quantities.join(", ") || `${formatDecisionValue(shape.quantityMin)}-${formatDecisionValue(shape.quantityMax)}`}`);
  console.log(`  DKK range: ${formatDecisionValue(shape.priceMinDkk)}-${formatDecisionValue(shape.priceMaxDkk)}`);
  console.log(`  Vertical axis: ${shape.materialAttribute ? `${shape.materialAttribute.labelDa} (${shape.materialAttribute.key})` : "none"}`);
  console.log(`  Attribute groups: ${shape.attributeCount}`);
  if (product.product_family === "tshirts") {
    const sizeDistribution = shape.tshirtSizeDistribution;
    console.log(`  T-shirt size distribution: ${sizeDistribution?.enabled ? "yes" : "no"}`);
    if (sizeDistribution?.enabled) {
      console.log(`    ${sizeDistribution.title} | ${sizeDistribution.fields.length} fields | quantity match: ${sizeDistribution.enforce_quantity_match ? "yes" : "no"}`);
    }
  }
  shape.sectionAttributes.slice(0, 12).forEach((attribute, index) => {
    console.log(`    ${index + 1}. ${attribute.labelDa} (${attribute.key}) - ${attribute.values.length} value(s)`);
  });
  if (shape.sectionAttributes.length > 12) {
    console.log(`    ... ${shape.sectionAttributes.length - 12} more group(s)`);
  }
  if (shape.missingSelectionCounts.length > 0) {
    console.log("");
    console.log("Missing selections");
    shape.missingSelectionCounts.slice(0, 8).forEach((entry) => {
      console.log(`  ${entry.key}: ${entry.missing} row(s)`);
    });
  }
  console.log("");
  console.log(`Decision: ${importWouldCreateUsableRows ? "safe preview, explicit admin draft import should create usable rows" : "do not import yet"}`);
  if (gate.state !== "ready") console.log(`  Reason: ${gate.reason}`);
  if (existingProduct) console.log("  Reason: target slug already exists.");
  if (shape.genericRowsPrepared !== shape.rowsPrepared) {
    console.log("  Reason: not all snapshot rows map to material/price rows.");
  }
  if (shape.attributeCount === 0) console.log("  Reason: no draft attribute groups could be built.");

  if (!shouldWriteDraft) {
    console.log("");
    console.log("Preview complete (no Supabase writes). Add --write-draft-product to create an unpublished draft after review.");
    return;
  }

  if (!importWouldCreateUsableRows) {
    throw new Error("Refusing draft import because the preview is not safe to import.");
  }

  console.log("");
  console.log("Preview passed. Creating unpublished Matrix Layout draft...");
  const writeResult = await createSupplierBankMatrixDraft({
    client,
    supplier,
    product,
    latestSnapshot,
    normalizedRows,
    shape,
    targetTenantId,
    productName,
    productSlug,
    latestReview,
  });

  console.log("");
  console.log("Supplier bank Matrix Layout draft import complete");
  console.log(`  Product: ${productName} (${writeResult.productId})`);
  console.log(`  Slug: ${writeResult.productSlug}`);
  console.log(`  Published: ${writeResult.isPublished ? "yes" : "no"}`);
  console.log(`  Rows inserted: ${writeResult.rowsInserted}`);
  console.log(`  Attribute groups: ${writeResult.attributeGroupCount}`);
  console.log(`  Import job: ${writeResult.importJobId}`);
}

function getLatestByProductId(rows) {
  const latestByProductId = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const productId = row.bank_product_id;
    if (!productId || latestByProductId.has(productId)) continue;
    latestByProductId.set(productId, row);
  }
  return latestByProductId;
}

function getSnapshotStatsByProductId(rows) {
  const statsByProductId = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const productId = row.bank_product_id;
    if (!productId) continue;
    const current = statsByProductId.get(productId) || {
      count: 0,
      latestSnapshotId: null,
      latestCreatedAt: null,
      quantityMin: null,
      quantityMax: null,
      priceMinDkk: null,
      priceMaxDkk: null,
    };
    current.count += 1;
    if (!current.latestSnapshotId) {
      current.latestSnapshotId = row.id;
      current.latestCreatedAt = row.created_at || null;
      current.quantityMin = row.quantity_min ?? null;
      current.quantityMax = row.quantity_max ?? null;
      current.priceMinDkk = row.price_min_dkk ?? null;
      current.priceMaxDkk = row.price_max_dkk ?? null;
    }
    statsByProductId.set(productId, current);
  }
  return statsByProductId;
}

function formatEligibilityState(state) {
  if (state === "ready") return "klar";
  if (state === "needs_approval") return "klar efter godkendelse";
  if (state === "already_imported") return "allerede importeret";
  return "blokeret";
}

function getBankProductFamilyCoverage(products) {
  const coverageBySupplierId = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const supplierId = product.supplier_id;
    const family = normalizeText(product.product_family);
    if (!supplierId || !family) continue;
    const current = coverageBySupplierId.get(supplierId) || {
      families: new Set(),
      productCount: 0,
      statusCounts: new Map(),
    };
    current.families.add(family);
    current.productCount += 1;
    current.statusCounts.set(product.status, (current.statusCounts.get(product.status) || 0) + 1);
    coverageBySupplierId.set(supplierId, current);
  }
  return coverageBySupplierId;
}

function formatFamilyList(values) {
  return [...values].sort().join(", ") || "none";
}

function formatStatusCounts(statusCounts) {
  return [...statusCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}:${count}`)
    .join(", ") || "none";
}

function getSupplierReadinessById({ products, snapshotStatsByProductId, latestReviewByProductId, latestImportedJobByProductId }) {
  const readinessBySupplierId = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const current = readinessBySupplierId.get(product.supplier_id) || {
      ready: 0,
      needsApproval: 0,
      imported: 0,
      blocked: 0,
      blockedReasons: [],
    };
    const gate = getSupplierBankImportGate({
      product,
      snapshotStats: snapshotStatsByProductId.get(product.id) || null,
      latestReview: latestReviewByProductId.get(product.id) || null,
      importedJob: latestImportedJobByProductId.get(product.id) || null,
    });

    if (gate.state === "ready") current.ready += 1;
    else if (gate.state === "needs_approval") current.needsApproval += 1;
    else if (gate.state === "already_imported") current.imported += 1;
    else {
      current.blocked += 1;
      current.blockedReasons.push(gate.reason);
    }

    readinessBySupplierId.set(product.supplier_id, current);
  }
  return readinessBySupplierId;
}

function hasStorformatConversionBlock(readiness) {
  return (readiness?.blockedReasons || []).some((reason) => String(reason || "").includes("storformat conversion"));
}

function getNextSupportedPixartExpansionFamily(missingFamilies) {
  const missing = new Set(Array.isArray(missingFamilies) ? missingFamilies : []);
  if (missing.has("signs")) return "signs";
  if (missing.has("stickers")) return "stickers";
  return null;
}

function getCoverageNextAction({ supplierSlug, missingFamilies, stagedFamilies, readiness, supplierEnabled }) {
  if ((readiness?.blocked || 0) > 0) {
    if (hasStorformatConversionBlock(readiness)) {
      return "Kør Pixart storformat dry-run og brug den eksplicitte draft-import, hvis previewet er godkendt.";
    }
    return "Løs blokeret bankprodukt først: gennemgå prisreview eller snapshot-kvalitet før flere familier importeres.";
  }

  if ((readiness?.ready || 0) > 0) {
    return "Importer godkendt bankprodukt som upubliceret draft, eller lad det blive i banken hvis leverandoeren stadig er kandidat.";
  }

  if ((readiness?.needsApproval || 0) > 0) {
    return "Godkend reviewed bankprodukt i banken før draft-import eller videre supplier-udvidelse.";
  }

  if ((readiness?.imported || 0) > 0 && missingFamilies.length === 0) {
    return "Gennemgaa importerede drafts i produktadmin.";
  }

  if (missingFamilies.length > 0 && stagedFamilies.size > 0) {
    if (supplierSlug === "pixartprinting") {
      const supportedFamily = getNextSupportedPixartExpansionFamily(missingFamilies);
      if (supportedFamily) {
        return `Udvid med næste understøttede Pixart dry extraction: ${supportedFamily}.`;
      }
      return `Pixart mangler ${missingFamilies.join(", ")}, men den nuvaerende adapter understoetter kun stickers og signs.`;
    }
    return `Udvid med næste dry extraction: ${missingFamilies[0]}.`;
  }

  if (missingFamilies.length > 0) {
    const prefix = supplierEnabled ? "Start første dry extraction" : "Planlæg første kandidat-slice";
    return `${prefix}: ${missingFamilies[0]}. Vent med bank write til previewet er godkendt.`;
  }

  return "Dækning ser komplet ud. Hold fokus på refresh/review-flow og produktkontrol.";
}

function getExpansionActionKind(row) {
  const readiness = row.readiness || { ready: 0, needsApproval: 0, imported: 0, blocked: 0 };
  if (readiness.blocked > 0) return "fix_blocked";
  if (readiness.ready > 0) return "import_ready";
  if (readiness.needsApproval > 0) return "approve_bank_product";
  if (row.missingFamilies.length > 0 && row.stagedFamilies.size > 0) return "expand_staged_supplier";
  if (row.missingFamilies.length > 0) return "start_supplier_slice";
  if (readiness.imported > 0) return "qa_imported_draft";
  return "monitor";
}

function getExpansionPriority(kind) {
  const priorities = {
    fix_blocked: 0,
    import_ready: 1,
    approve_bank_product: 2,
    expand_staged_supplier: 3,
    start_supplier_slice: 4,
    qa_imported_draft: 5,
    monitor: 6,
  };
  return priorities[kind] ?? 99;
}

function formatExpansionKind(kind) {
  const labels = {
    fix_blocked: "Fix blocked staged product",
    import_ready: "Import approved bank product as draft",
    approve_bank_product: "Approve reviewed bank product",
    expand_staged_supplier: "Expand staged supplier",
    start_supplier_slice: "Start supplier first slice",
    qa_imported_draft: "QA imported draft",
    monitor: "Monitor",
  };
  return labels[kind] || kind;
}

function getPixartRigidsDecisionState() {
  const state = {
    candidatePath: null,
    baselinePath: null,
    packetPath: null,
    preflightReportPath: null,
    storformatReviewPath: null,
    candidateSummary: null,
    baselineSummary: null,
    delta: null,
    packetReady: false,
    preflightReady: false,
    reason: null,
  };

  try {
    const candidatePath = resolveDefaultPixartRigidsCandidatePath();
    if (!candidatePath) {
      state.reason = "No passing local Pixart rigids candidate preview found.";
      return state;
    }
    const baselinePath = resolveDefaultPixartRigidsBaselinePath(candidatePath);
    if (!baselinePath) {
      state.reason = "No passing local Pixart rigids baseline preview found.";
      return state;
    }

    const { path: resolvedCandidatePath, json: candidateSnapshot } = loadJsonFile(candidatePath);
    const { path: resolvedBaselinePath, json: baselineSnapshot } = loadJsonFile(baselinePath);
    assertPixartBankPreviewSnapshot(candidateSnapshot, resolvedCandidatePath);
    assertPixartBankPreviewSnapshot(baselineSnapshot, resolvedBaselinePath);

    const candidateSummary = summarizePixartRigidsBankSnapshot(candidateSnapshot, resolvedCandidatePath);
    const baselineSummary = summarizePixartRigidsBankSnapshot(baselineSnapshot, resolvedBaselinePath);
    const delta = compareNormalizedSnapshots({
      oldSnapshot: baselineSnapshot,
      newSnapshot: candidateSnapshot,
      thresholdPct: 0,
    });

    state.candidatePath = resolvedCandidatePath;
    state.baselinePath = resolvedBaselinePath;
    state.candidateSummary = candidateSummary;
    state.baselineSummary = baselineSummary;
    state.delta = delta;
    state.preflightReportPath = findLatestPixartRigidsBankWritePreflightPath();
    state.storformatReviewPath = findLatestPixartRigidsStorformatReviewPath();

    const packetPath = findLatestPixartRigidsCandidatePacketPath();
    if (packetPath) {
      const packetEvidence = assertPixartRigidsPacketEvidence({
        packetPath,
        baselinePath: resolvedBaselinePath,
        candidatePath: resolvedCandidatePath,
      });
      state.packetPath = packetEvidence.resolvedPacketPath;
      state.packetReady = true;
    }

    state.preflightReady = Boolean(
      state.packetReady
      && candidateSummary.productKey === PIXART_RIGIDS_BANK_PRODUCT_KEY
      && candidateSummary.duplicateKeys === 0
      && candidateSummary.categories.length >= 2
    );
    if (!state.preflightReady) {
      state.reason = "Candidate packet or quality gate still needs review.";
    }
    return state;
  } catch (error) {
    state.reason = error instanceof Error ? error.message : String(error);
    return state;
  }
}

function getExpansionStepCommands(row) {
  const supplierSlug = row.source.slug;
  const nextFamily = row.missingFamilies[0] || null;
  const kind = row.actionKind;
  const pendingApprovalProductKey = row.pendingApprovalProducts?.[0]?.supplier_product_key || PIXART_FLAT_BANK_PRODUCT_KEY;
  const blockedProductKey = row.blockedProducts?.[0]?.supplier_product_key || PIXART_FLAT_BANK_PRODUCT_KEY;

  if (supplierSlug === "pixartprinting") {
    if (kind === "fix_blocked") {
      if (hasStorformatConversionBlock(row.readiness)) {
        if (blockedProductKey === PIXART_RIGIDS_BANK_PRODUCT_KEY) {
          const decisionState = getPixartRigidsDecisionState();
          if (decisionState.preflightReady) {
            return [
              `Review latest no-write decision packet: ${decisionState.packetPath}`,
              `Review stored-snapshot storformat report: ${decisionState.storformatReviewPath || "run review-pixart-rigids-storformat-preview --write-report"}`,
              "Business decision needed: either keep current Plastic-only stored snapshot in review, or explicitly approve the bank-only write of the improved Plastic+Plexiglass candidate.",
              `Only after explicit bank-write approval: node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot ${quoteShellArg(decisionState.candidatePath)} --write-bank`,
              `After bank write only: node scripts/supplier-bank-cli.mjs compare-normalized-snapshots ${quoteShellArg(decisionState.baselinePath)} ${quoteShellArg(decisionState.candidatePath)} --write-delta-review --notes "Pixart rigids visible-option two-category candidate"`,
              "Keep Pixart disabled/candidate and keep generic Matrix Layout import blocked.",
            ];
          }
          return [
            "node scripts/supplier-bank-cli.mjs review-pixart-rigids-candidate-packet --write-report",
            "node scripts/supplier-bank-cli.mjs preflight-pixart-rigids-bank-write",
            "Review the packet/preflight output, then use --write-bank only after explicit supplier-bank write approval.",
            "node scripts/supplier-bank-cli.mjs preview-pixart-rigids-storformat-import",
            "node scripts/supplier-bank-cli.mjs review-pixart-rigids-storformat-preview --write-report",
            "Keep Pixart disabled/candidate and do not use the generic Matrix draft importer for Pixart rigids.",
          ];
        }
        return [
          "npm run supplier-bank:pixart-storformat-preview",
          "Review the dry-run summary from scripts/fetch-pixart-flat-surface-adhesive-import.mjs; keep Pixart disabled/candidate.",
          "Only after explicit approval: node scripts/supplier-bank-cli.mjs preview-pixart-storformat-import --write-draft-product",
        ];
      }
      return [
        "npm run supplier-bank:review-pixart",
        "node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline",
        "After explicit approval only: node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline --write-bank --write-delta-review",
      ];
    }
    if (kind === "approve_bank_product") {
      return [
        "npm run supplier-bank:review-pixart",
        `node scripts/supplier-bank-cli.mjs approve-bank-product --supplier-slug pixartprinting --product-key ${pendingApprovalProductKey}`,
        `After explicit approval only: node scripts/supplier-bank-cli.mjs approve-bank-product --supplier-slug pixartprinting --product-key ${pendingApprovalProductKey} --confirm-status-update`,
      ];
    }
    if (kind === "import_ready") {
      return [
        "Open /admin/supplier-bank and use explicit draft import only if this Pixart product should become a Webprinter draft.",
        "Keep Pixart disabled/candidate until wider extraction and markup policy are approved.",
      ];
    }
    return [
      "node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --profile rigids --categories Plastic --limit-materials 1 --limit-areas 1 --limit-quantities 3 --headful",
      "npm run supplier-bank:pixart-write:preview -- <approved-preview.json>",
    ];
  }

  if (supplierSlug === "wir-machen-druck") {
    if (kind === "qa_imported_draft") {
      return [
        "npm run supplier-bank:review-wmd",
        "npm run supplier-bank:verify-wmd",
      ];
    }
    return [
      "npm run supplier-bank:refresh-wmd:preview",
      "npm run supplier-bank:review-wmd",
    ];
  }

  if (supplierSlug === PRINT_COM_SUPPLIER_SLUG) {
    if (kind === "import_ready") {
      return [
        "Open /admin/supplier-bank and import Print.com flyers only if it should become an unpublished Webprinter draft.",
        "Keep Print.com disabled/candidate until supplier policy and broader catalog coverage are approved.",
        `Next technical expansion after that: npm run supplier-bank:print-com-plan-first-slice -- --family ${nextFamily || "folders"}`,
      ];
    }
    if (kind === "approve_bank_product") {
      return [
        "Validate latest Print.com price preview with npm run supplier-bank:print-com-write-preview -- <preview.json>.",
        "Approve the bank product only after the policy preview is reviewed.",
      ];
    }
    return [
      "Review POD2_README.md before touching Print.com bridge work.",
      `npm run supplier-bank:print-com-plan-first-slice -- --family ${nextFamily || "flyers"}`,
      "Keep Print.com bridge separate from POD v2 tables and do not import/publish products automatically.",
    ];
  }

  return [
    `Validate source adapter for ${supplierSlug}.`,
    `Create local dry extraction for ${nextFamily || "the next missing family"}.`,
    "Write supplier-bank rows only after preview review.",
  ];
}

async function runPlanPrintComBankSlice(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const source = validation.sources.find((item) => item.slug === PRINT_COM_SUPPLIER_SLUG);

  if (!source) {
    throw new Error(`Supplier source registry is missing ${PRINT_COM_SUPPLIER_SLUG}`);
  }

  const sourceFamilies = Array.isArray(source.productFamilies) ? source.productFamilies : [];
  const selectedFamily = normalizeText(parsed.values.family || sourceFamilies[0] || "flyers");
  if (!PRODUCT_FAMILIES.has(selectedFamily)) {
    throw new Error(`Unknown product family: ${selectedFamily}`);
  }
  if (!sourceFamilies.includes(selectedFamily)) {
    throw new Error(
      `Print.com source does not list ${selectedFamily}. Registered families: ${sourceFamilies.join(", ") || "none"}`
    );
  }

  const client = getSupabaseServiceClient();
  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled,integration_type,metadata,updated_at")
    .eq("slug", PRINT_COM_SUPPLIER_SLUG)
    .maybeSingle();

  if (supplierError) {
    throw new Error(`Print.com supplier lookup failed. ${formatSupabaseError(supplierError)}`);
  }

  let products = [];
  if (supplier?.id) {
    const { data: productRows, error: productsError } = await client
      .from("supplier_bank_products")
      .select("id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,updated_at")
      .eq("supplier_id", supplier.id)
      .order("supplier_product_key", { ascending: true });

    if (productsError) {
      throw new Error(`Print.com bank product lookup failed. ${formatSupabaseError(productsError)}`);
    }
    products = productRows || [];
  }

  const stagedFamilies = new Set(products.map((product) => normalizeText(product.product_family)).filter(Boolean));
  const stagedSelectedFamily = products.filter((product) => normalizeText(product.product_family) === selectedFamily);
  const nextMissingFamily = sourceFamilies.find((family) => !stagedFamilies.has(family)) || null;
  const supplierStatus = supplier ? (supplier.enabled ? "enabled" : "disabled") : "not seeded";

  console.log("Print.com supplier-bank first-slice plan");
  console.log("  Scope: read-only adapter plan");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Supplier source: ${source.name} (${source.slug})`);
  console.log(`  Source status: ${normalizeText(source.status || "candidate")} / ${supplierStatus}`);
  console.log(`  Integration type: ${source.integrationType || "api"}`);
  console.log(`  Selected family: ${selectedFamily}`);
  console.log("  Print.com API calls: no");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  POD v2 writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");

  console.log("");
  console.log("Current bank coverage");
  console.log(`  Registered Print.com families: ${sourceFamilies.join(", ") || "none"}`);
  console.log(`  Staged families: ${formatFamilyList(stagedFamilies)}`);
  console.log(`  Existing Print.com bank products: ${products.length}`);
  if (stagedSelectedFamily.length > 0) {
    console.log(`  Existing ${selectedFamily} bank products: ${stagedSelectedFamily.length}`);
    stagedSelectedFamily.slice(0, 5).forEach((product, index) => {
      console.log(
        `    ${index + 1}. ${product.supplier_product_key} | ${product.status} | ${product.name_da || product.name_original || "unnamed"}`
      );
    });
  }

  console.log("");
  console.log("Bridge pieces to reuse");
  console.log("  POD v2 guide: POD2_README.md");
  console.log("  API proxy: supabase/functions/pod2-explorer-request/index.ts");
  console.log("  Browser hook: src/lib/pod2/hooks.ts usePodExplorer");
  console.log("  Danish terms: src/lib/pod2/danishTerms.ts");
  console.log("  Supplier registry note: use POD v2 API knowledge as a catalog bridge only.");

  console.log("");
  console.log("Boundary rules");
  console.log("  Do not write to pod2_catalog_products or other POD v2 tables from this supplier-bank slice.");
  console.log("  Do not call pod2-tenant-import, pod2-tenant-merge, or any publishing flow.");
  console.log("  Do not write products, product_attribute_* rows, or generic_product_prices.");
  console.log("  Store raw API responses and normalized supplier-bank preview JSON first.");
  console.log("  Review row counts, quantities, currencies, and Danish labels before any --write-bank path exists.");

  console.log("");
  console.log("Next implementation steps");
  console.log(`  1. Add a Print.com catalog discovery preview for family ${selectedFamily}.`);
  console.log("  2. Route requests through the existing POD2 explorer proxy so credentials stay server-side.");
  console.log("  3. Save local raw and normalized preview files under pricing_raw/supplier-bank-normalized/print-com/.");
  console.log("  4. Map Print.com names/options through the existing Danish terms helper, keeping original text.");
  console.log("  5. Add quality gates: non-empty variants, explicit quantities, EUR currency, DKK proposal, stable row keys.");
  console.log("  6. Only after review, add a separate preview-only bank writer for the approved normalized file.");

  console.log("");
  console.log("Planner result");
  if (stagedSelectedFamily.length > 0) {
    console.log(`  ${selectedFamily} already has staged bank products. Review those before adding another slice.`);
  } else {
    console.log(`  First slice candidate: ${selectedFamily}.`);
  }
  if (nextMissingFamily && nextMissingFamily !== selectedFamily) {
    console.log(`  Next missing registered family after this: ${nextMissingFamily}.`);
  }
}

function extractPrintComItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getPrintComProductSku(item) {
  return normalizeText(
    item?.sku
    || item?.id
    || item?.productSku
    || item?.product_sku
    || item?.productId
    || item?.product_id
    || item?.slug
  );
}

function getPrintComProductName(item) {
  return normalizeText(
    item?.name
    || item?.title
    || item?.displayName
    || item?.display_name
    || item?.publicName
    || item?.public_name
    || getPrintComProductSku(item)
  );
}

function printComTextForMatching(item) {
  const values = [
    getPrintComProductSku(item),
    getPrintComProductName(item),
    item?.description,
    item?.category,
    item?.type,
    item?.productType,
    item?.product_type,
  ];
  return values.map((value) => normalizeText(value).toLowerCase()).join(" ");
}

function itemMatchesPrintComFamily(item, family) {
  const keywords = PRINT_COM_FAMILY_KEYWORDS[family] || [];
  if (keywords.length === 0) return true;
  const text = printComTextForMatching(item);
  return keywords.some((keyword) => text.includes(keyword));
}

function translatePrintComProductName(name, family) {
  const trimmed = normalizeText(name);
  if (!trimmed) return family === "flyers" ? "Flyers" : family;
  return trimmed
    .replace(/\bbusiness cards\b/gi, "Visitkort")
    .replace(/\bbusiness card\b/gi, "Visitkort")
    .replace(/\bletterheads\b/gi, "Brevpapir")
    .replace(/\bletterhead\b/gi, "Brevpapir")
    .replace(/\bflyers\b/gi, "Flyers")
    .replace(/\bflyer\b/gi, "Flyer")
    .replace(/\bleaflets\b/gi, "Foldere")
    .replace(/\bleaflet\b/gi, "Folder")
    .replace(/\bfolders\b/gi, "Mapper")
    .replace(/\bfolder\b/gi, "Mappe");
}

function translatePrintComAttributeName(nameOrSlug) {
  const text = normalizeText(nameOrSlug);
  const lower = text.toLowerCase();
  const hits = {
    size: "Format",
    material: "Materiale",
    printtype: "Tryktype",
    print_type: "Tryktype",
    finish: "Efterbehandling",
    spot_finish: "Spotlak/finish",
    spot_finish_back: "Spotlak bagside",
    flexibleprintingmethod: "Trykmetode",
    copies: "Oplag",
    quantity: "Antal",
    bundle: "Pakke",
    orientation: "Retning",
    folding: "Falsning",
    corners: "Hjoerner",
  };
  return hits[lower] || text || "Attribut";
}

function summarizePrintComProperty(property) {
  const options = Array.isArray(property?.options) ? property.options : [];
  return {
    slug: normalizeText(property?.slug || property?.id || property?.name),
    name_original: normalizeText(property?.name || property?.title || property?.slug),
    name_da: translatePrintComAttributeName(property?.name || property?.slug),
    locked: Boolean(property?.locked),
    option_count: options.length,
    sample_options: options.slice(0, 8).map((option) => ({
      slug: normalizeText(option?.slug || option?.id || option?.value || option?.name),
      name_original: normalizeText(option?.name || option?.title || option?.label || option?.slug),
      name_da: translatePrintComProductName(
        normalizeText(option?.name || option?.title || option?.label || option?.slug),
        "other"
      ),
    })),
  };
}

async function getActivePrintComConnection(client) {
  const selectColumns = "id,provider_key,base_url,api_key_encrypted,auth_header_mode,auth_header_name,auth_header_prefix,is_active";
  const { data: pod2Connection, error: pod2Error } = await client
    .from("pod2_supplier_connections")
    .select(selectColumns)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (pod2Error) {
    throw new Error(`POD2 Print.com connection lookup failed. ${formatSupabaseError(pod2Error)}`);
  }
  if (pod2Connection) return { ...pod2Connection, sourceTable: "pod2_supplier_connections" };

  const { data: pod1Connection, error: pod1Error } = await client
    .from("pod_supplier_connections")
    .select(selectColumns)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (pod1Error) {
    throw new Error(`POD Print.com fallback connection lookup failed. ${formatSupabaseError(pod1Error)}`);
  }
  return pod1Connection ? { ...pod1Connection, sourceTable: "pod_supplier_connections" } : null;
}

function buildPrintComHeaders(connection, overrideMode = null) {
  const apiKey = connection?.api_key_encrypted;
  if (!apiKey) throw new Error("Active Print.com connection is missing an API key");

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (overrideMode === "x_api_key") {
    headers["X-API-Key"] = apiKey;
    return headers;
  }

  switch (connection.auth_header_mode) {
    case "authorization_bearer":
      headers.Authorization = `Bearer ${apiKey}`;
      break;
    case "authorization_printapikey":
      headers.Authorization = `PrintApiKey ${apiKey}`;
      break;
    case "x_api_key":
      headers["X-API-Key"] = apiKey;
      break;
    case "custom": {
      const headerName = connection.auth_header_name || "Authorization";
      const prefix = connection.auth_header_prefix || "";
      headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
      break;
    }
    default:
      headers.Authorization = `PrintApiKey ${apiKey}`;
      break;
  }

  return headers;
}

async function fetchPrintComJson({ connection, pathName, method = "GET", body = null, baseUrlOverride = null }) {
  const baseUrl = baseUrlOverride || connection.base_url || "https://api.print.com";
  const origin = new URL(baseUrl).origin;
  if (!PRINT_COM_ALLOWED_BASE_URLS.has(origin)) {
    throw new Error(`Print.com base URL is not allowed: ${origin}`);
  }

  const url = new URL(pathName, origin);
  const run = async (headers) => {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    return { response, data };
  };

  let result = await run(buildPrintComHeaders(connection));
  if (result.response.status === 401) {
    result = await run(buildPrintComHeaders(connection, "x_api_key"));
  }
  if (!result.response.ok) {
    const message = typeof result.data === "string"
      ? result.data.slice(0, 400)
      : JSON.stringify(result.data).slice(0, 400);
    throw new Error(`Print.com ${method} ${pathName} failed: ${result.response.status} ${message}`);
  }
  return result.data;
}

async function runPrintComBankFirstSlice(args) {
  const parsed = parseArgs(args);
  const family = normalizeText(parsed.values.family || "flyers");
  const limit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 24)));
  const detailsLimit = Math.max(0, Math.floor(parseOptionalPositiveNumber(parsed.values, "details-limit", 5)));

  if (!PRODUCT_FAMILIES.has(family)) {
    throw new Error(`Unknown product family: ${family}`);
  }

  const { validation } = loadValidatedSupplierRegistry(DEFAULT_SUPPLIER_SOURCE_REGISTRY);
  const source = validation.sources.find((item) => item.slug === PRINT_COM_SUPPLIER_SLUG);
  if (!source) throw new Error(`Supplier source registry is missing ${PRINT_COM_SUPPLIER_SLUG}`);
  if (!source.productFamilies?.includes(family)) {
    throw new Error(`Print.com source does not list ${family}. Registered families: ${source.productFamilies?.join(", ") || "none"}`);
  }

  const client = getSupabaseServiceClient();
  const connection = await getActivePrintComConnection(client);
  if (!connection) {
    throw new Error("No active POD/POD2 Print.com connection found");
  }

  console.log("Print.com supplier-bank first-slice preview");
  console.log("  Scope: local catalog discovery preview");
  console.log(`  Family: ${family}`);
  console.log(`  Connection table: ${connection.sourceTable}`);
  console.log(`  Base URL: ${new URL(connection.base_url || "https://api.print.com").origin}`);
  console.log("  Bank writes: no");
  console.log("  POD v2 writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");

  const listedAt = new Date().toISOString();
  const listData = await fetchPrintComJson({
    connection,
    pathName: "/products",
    method: "GET",
  });
  const listItems = extractPrintComItems(listData);
  const candidates = listItems
    .filter((item) => itemMatchesPrintComFamily(item, family))
    .slice(0, limit);

  const details = [];
  for (const item of candidates.slice(0, detailsLimit)) {
    const sku = getPrintComProductSku(item);
    if (!sku) continue;
    try {
      const detail = await fetchPrintComJson({
        connection,
        pathName: `/products/${encodeURIComponent(sku)}`,
        method: "GET",
      });
      details.push({ sku, ok: true, detail });
    } catch (error) {
      details.push({ sku, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const detailBySku = new Map(details.filter((item) => item.ok).map((item) => [item.sku, item.detail]));
  const normalizedProducts = candidates.map((item, index) => {
    const sku = getPrintComProductSku(item);
    const nameOriginal = getPrintComProductName(item);
    const detail = sku ? detailBySku.get(sku) : null;
    const properties = Array.isArray(detail?.properties) ? detail.properties : [];
    return {
      source_index: index,
      supplier_product_key: sku || `print-com-${family}-${index + 1}`,
      product_family: family,
      name_original: nameOriginal,
      name_da: translatePrintComProductName(nameOriginal, family),
      source_language: "en",
      target_language: "da",
      attribute_group_count: properties.length,
      option_count: properties.reduce((sum, property) => sum + (Array.isArray(property?.options) ? property.options.length : 0), 0),
      normalized_attributes: properties.map(summarizePrintComProperty),
      quantity_options: (properties.find((property) => normalizeText(property?.slug) === "copies")?.options || [])
        .map((option) => normalizeText(option?.slug || option?.name || option?.value))
        .filter(Boolean),
      has_detail: Boolean(detail),
      price_rows: 0,
      bank_write_ready: false,
      notes: "Catalog discovery only. Price rows are not extracted yet.",
    };
  });

  const timestamp = timestampForFile();
  const repoRoot = process.cwd();
  const rawSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: path.join("supplier-bank-raw", "print-com", family),
    timestamp,
    payload: {
      supplier: source,
      listed_at: listedAt,
      family,
      list_count: listItems.length,
      candidate_count: candidates.length,
      detail_count: details.filter((item) => item.ok).length,
      detail_error_count: details.filter((item) => !item.ok).length,
      products: candidates,
      details,
    },
  });
  const normalizedSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: path.join("supplier-bank-normalized", "print-com", family),
    timestamp,
    payload: {
      supplier_slug: PRINT_COM_SUPPLIER_SLUG,
      supplier_name: source.name,
      product_family: family,
      source_url: source.websiteUrl,
      source_language: "en",
      target_language: "da",
      generated_at: new Date().toISOString(),
      raw_snapshot_path: path.relative(repoRoot, rawSnapshotPath),
      bank_write_ready: false,
      reason_not_ready: "Catalog discovery only. Pricing rows and quality gates are required before bank write.",
      normalized_products: normalizedProducts,
    },
  });

  console.log("");
  console.log("Preview result");
  console.log(`  Products listed: ${listItems.length}`);
  console.log(`  ${family} candidates: ${candidates.length}`);
  console.log(`  Details fetched: ${details.filter((item) => item.ok).length}/${details.length}`);
  console.log(`  Bank write ready: no`);
  console.log(`  Raw snapshot: ${path.relative(repoRoot, rawSnapshotPath)}`);
  console.log(`  Normalized preview: ${path.relative(repoRoot, normalizedSnapshotPath)}`);
  normalizedProducts.slice(0, 8).forEach((product, index) => {
    console.log(`  ${index + 1}. ${product.supplier_product_key} | ${product.name_da} | detail:${product.has_detail ? "yes" : "no"}`);
  });
}

function normalizePrintComOptionValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

function pickPrintComOptionSlug(property) {
  const options = Array.isArray(property?.options) ? property.options : [];
  const slug = String(property?.slug || "");
  const findBySlug = (candidates) => {
    for (const candidate of candidates) {
      const match = options.find((option) => String(option?.slug) === candidate);
      if (match) return match;
    }
    return null;
  };

  if (slug === "size") {
    const preferred = findBySlug(["a5", "a4", "a6"]);
    if (preferred) return preferred.slug;
    return options.find((option) => String(option?.slug) !== "custom")?.slug;
  }

  if (slug === "material") {
    const preferred = findBySlug(["135gr_gesatineerd_mc", "170gr_gesatineerd_mc", "135gr_silk_mc", "115gr_gesatineerd_mc"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "printtype") {
    const preferred = findBySlug(["40", "44"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "printingmethod") {
    const preferred = findBySlug(["digital", "offset", "inkjet"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "flexibleprintingmethod") {
    const preferred = findBySlug(["false", "true"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "urgency") {
    const preferred = findBySlug(["standard", "moderate", "quick"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "delivery") {
    const preferred = findBySlug(["box_max_weight_15_kg", "box_max_weight_25_kg"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "box_delivery") {
    const preferred = findBySlug(["15", "25"]);
    if (preferred) return preferred.slug;
  }

  if (slug === "sheet_size") {
    const preferred = findBySlug(["not_defined", "small_indigo_sheet", "large_indigo_sheet"]);
    if (preferred) return preferred.slug;
  }

  if (!property?.required) {
    const preferred = findBySlug(["none", "geen", "no", "false"]);
    if (preferred) return preferred.slug;
  }

  const fallback = options.find((option) => String(option?.slug) !== "custom");
  return fallback?.slug ?? options[0]?.slug;
}

function filterPrintComQuantities(values) {
  const filtered = values.filter((value) => Number.isFinite(value) && value >= PRINT_COM_MIN_PROBE_QUANTITY);
  return [...new Set(filtered)].sort((left, right) => left - right);
}

function buildPrintComPriceTemplate(properties) {
  const baseOptions = {};
  const copiesProperty = properties.find((property) => property?.slug === "copies");
  const bundleProperty = properties.find((property) => property?.slug === "bundle");

  for (const property of properties) {
    if (!property?.slug || property?.locked) continue;
    if (property.slug === "copies" || property.slug === "bundle") continue;
    if (PRINT_COM_INTERNAL_OPTION_KEYS.has(property.slug)) continue;
    const optionSlug = pickPrintComOptionSlug(property);
    if (optionSlug === undefined) continue;
    baseOptions[property.slug] = normalizePrintComOptionValue(optionSlug);
  }

  let quantities = PRINT_COM_DEFAULT_QUANTITIES.slice();
  if (Array.isArray(copiesProperty?.options) && copiesProperty.options.length > 0) {
    const copyValues = copiesProperty.options
      .map((option) => normalizePrintComOptionValue(option?.slug ?? option?.value ?? option?.name))
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    const usableCopyValues = filterPrintComQuantities(copyValues);
    if (usableCopyValues.length > 0) quantities = usableCopyValues;
  }

  const bundleOptions = Array.isArray(bundleProperty?.options) ? bundleProperty.options : [];
  const bundleByQuantity = new Map();
  for (const option of bundleOptions) {
    const match = String(option?.slug || "").match(/(\d+)/);
    if (match) bundleByQuantity.set(Number(match[1]), option);
  }

  return { baseOptions, quantities, bundleByQuantity };
}

function getPrintComPricePolicy(policyKey) {
  if (!policyKey) return null;
  const policy = PRINT_COM_PRICE_POLICIES[policyKey];
  if (!policy) {
    throw new Error(`Unknown Print.com price policy: ${policyKey}. Available policies: ${Object.keys(PRINT_COM_PRICE_POLICIES).join(", ")}`);
  }
  return policy;
}

function validatePrintComPolicyRows({ policyKey, policy, snapshot }) {
  if (!policyKey || !policy) return [];
  const issues = [];
  if (snapshot.supplier_product_key !== policy.supplierProductKey) {
    issues.push(`supplier_product_key ${snapshot.supplier_product_key} does not match policy ${policy.supplierProductKey}`);
  }
  if (snapshot.product_family !== policy.productFamily) {
    issues.push(`product_family ${snapshot.product_family} does not match policy ${policy.productFamily}`);
  }
  if (snapshot.region !== policy.region) {
    issues.push(`region ${snapshot.region} does not match policy ${policy.region}`);
  }
  if (snapshot.currency !== policy.currency) {
    issues.push(`currency ${snapshot.currency} does not match policy ${policy.currency}`);
  }
  if (Number(snapshot.delivery_promise || 0) !== Number(policy.deliveryPromise || 0)) {
    issues.push(`delivery_promise ${snapshot.delivery_promise} does not match policy ${policy.deliveryPromise}`);
  }

  const rows = Array.isArray(snapshot.normalized_rows) ? snapshot.normalized_rows : [];
  const rowQuantities = rows.map((row) => Number(row.quantity)).sort((left, right) => left - right);
  const policyQuantities = [...policy.quantities].sort((left, right) => left - right);
  if (JSON.stringify(rowQuantities) !== JSON.stringify(policyQuantities)) {
    issues.push(`quantities ${rowQuantities.join(",")} do not match policy ${policyQuantities.join(",")}`);
  }

  rows.forEach((row, index) => {
    const options = row.options || {};
    for (const [key, expected] of Object.entries(policy.optionOverrides || {})) {
      if (String(options[key]) !== String(expected)) {
        issues.push(`row ${index + 1} option ${key}=${options[key]} does not match policy ${expected}`);
      }
    }
  });

  return issues;
}

function extractPrintComBatchCost(item, deliveryPromise) {
  if (!item || typeof item !== "object") return null;
  const price = item.price || {};
  if (typeof price.price === "number") return price.price / 100;
  if (deliveryPromise === 1 && typeof price.delivery_promise_insured_price === "number") {
    return price.delivery_promise_insured_price / 100;
  }
  if (deliveryPromise === 2 && typeof price.delivery_promise_premium_price === "number") {
    return price.delivery_promise_premium_price / 100;
  }
  if (typeof price.delivery_promise_standard_price === "number" && price.delivery_promise_standard_price > 0) {
    return price.delivery_promise_standard_price / 100;
  }
  if (typeof item.productPrice === "number") return item.productPrice / 100;
  return null;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getPrintComPropertyOptions(properties, slug) {
  const property = properties.find((item) => item?.slug === slug);
  return Array.isArray(property?.options) ? property.options : [];
}

function orderPrintComCandidates(options, preferred) {
  const slugs = options.map((option) => String(option?.slug)).filter(Boolean);
  return [
    ...preferred.filter((slug) => slugs.includes(slug)),
    ...slugs.filter((slug) => !preferred.includes(slug) && slug !== "custom"),
  ];
}

async function fetchPrintComBatchPrices({ connection, sku, requests, region, currency, deliveryPromise }) {
  return fetchPrintComJson({
    connection,
    pathName: "/products/batch/prices",
    method: "POST",
    baseUrlOverride: "https://platform.print.com",
    body: {
      requests: requests.map((request) => ({
        sku,
        options: request.options,
        region,
        currency,
        delivery_promise: deliveryPromise,
      })),
    },
  });
}

async function runPrintComBankPricePreview(args) {
  const parsed = parseArgs(args);
  const policyKey = normalizeText(parsed.values.policy || "");
  const policy = getPrintComPricePolicy(policyKey);
  const family = normalizeText(parsed.values.family || policy?.productFamily || "flyers");
  const sku = normalizeText(parsed.values.sku || policy?.supplierProductKey || family);
  const quantityLimit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "quantity-limit", policy?.quantities?.length || 4)));
  const region = normalizeText(parsed.values.region || policy?.region || "DK").toUpperCase();
  const currency = normalizeText(parsed.values.currency || policy?.currency || "DKK").toUpperCase();
  const deliveryPromise = Math.max(0, Math.floor(parseOptionalPositiveNumber(parsed.values, "delivery-promise", policy?.deliveryPromise ?? 0)));

  if (!PRODUCT_FAMILIES.has(family)) throw new Error(`Unknown product family: ${family}`);
  if (!sku) throw new Error("Missing --sku");

  const client = getSupabaseServiceClient();
  const connection = await getActivePrintComConnection(client);
  if (!connection) throw new Error("No active POD/POD2 Print.com connection found");

  console.log("Print.com supplier-bank price preview");
  console.log("  Scope: local price-row preview");
  console.log(`  Family/SKU: ${family}/${sku}`);
  console.log(`  Policy: ${policyKey || "none"}`);
  console.log(`  Region/currency: ${region}/${currency}`);
  console.log("  Bank writes: no");
  console.log("  POD v2 writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");

  const detail = await fetchPrintComJson({
    connection,
    pathName: `/products/${encodeURIComponent(sku)}`,
    method: "GET",
  });
  const properties = Array.isArray(detail?.properties) ? detail.properties : [];
  const { baseOptions, quantities, bundleByQuantity } = buildPrintComPriceTemplate(properties);
  const previewQuantities = (policy?.quantities || quantities).slice(0, quantityLimit);

  const buildRequests = (optionsBase, forcedBundleSlug = null) => previewQuantities.map((quantity) => {
    const options = { ...baseOptions, ...(policy?.optionOverrides || {}), copies: quantity };
    Object.assign(options, optionsBase);
    for (const key of policy?.optionOmitKeys || []) {
      delete options[key];
    }
    const bundleOption = forcedBundleSlug
      ? { slug: forcedBundleSlug }
      : bundleByQuantity.get(quantity) || bundleByQuantity.values().next().value;
    if (!policy?.optionOverrides?.bundle && bundleOption?.slug) {
      options.bundle = normalizePrintComOptionValue(bundleOption.slug);
    }
    return { quantity, options };
  });

  const materialCandidates = orderPrintComCandidates(
    getPrintComPropertyOptions(properties, "material"),
    [
      String(baseOptions.material || ""),
      "90gr_hv_bankpost",
      "100gr_hv_bankpost",
      "115gr_gesatineerd_mc",
      "135gr_gesatineerd_mc",
      "170gr_gesatineerd_mc",
      "135gr_silk_mc",
    ].filter(Boolean)
  );
  const bundleCandidates = orderPrintComCandidates(
    getPrintComPropertyOptions(properties, "bundle"),
    [
      "bundle_per_100",
      "bundle_per_250",
      "bundle_per_50",
      "bundle_per_25",
      "bundle_per_500",
    ]
  );

  let requests = buildRequests({});
  let batchData = null;
  let batchError = null;
  let selectedCandidate = {
    material: policy?.optionOverrides?.material ?? baseOptions.material ?? null,
    bundle: policy?.optionOverrides?.bundle ?? "quantity-matched",
  };

  const attempts = policy
    ? [{ material: policy.optionOverrides?.material, bundle: policy.optionOverrides?.bundle }]
    : [
        { material: baseOptions.material, bundle: null },
        ...materialCandidates.flatMap((material) => bundleCandidates.map((bundle) => ({ material, bundle }))),
      ];
  const seenAttempts = new Set();

  for (const attempt of attempts) {
    const key = `${attempt.material || ""}|${attempt.bundle || ""}`;
    if (seenAttempts.has(key)) continue;
    seenAttempts.add(key);

    const optionsBase = {};
    if (attempt.material) optionsBase.material = normalizePrintComOptionValue(attempt.material);
    requests = buildRequests(optionsBase, attempt.bundle);
    try {
      batchData = await fetchPrintComBatchPrices({
        connection,
        sku,
        requests,
        region,
        currency,
        deliveryPromise,
      });
      const responses = Array.isArray(batchData?.responses) ? batchData.responses : [];
      if (responses.length === requests.length) {
        selectedCandidate = {
          material: attempt.material || baseOptions.material || null,
          bundle: attempt.bundle || "quantity-matched",
        };
        batchError = null;
        break;
      }
      batchError = `Batch returned ${responses.length}/${requests.length} rows`;
    } catch (error) {
      batchData = null;
      batchError = error instanceof Error ? error.message : String(error);
    }
  }

  const responses = Array.isArray(batchData?.responses) ? batchData.responses : [];
  const priceRows = requests.map((request, index) => {
    const responseItem = responses[index] || null;
    const supplierPrice = responseItem ? extractPrintComBatchCost(responseItem, deliveryPromise) : null;
    return {
      supplier_row_key: `${sku}|${family}|${request.quantity}|${Object.entries(request.options).map(([key, value]) => `${key}:${value}`).sort().join("|")}`,
      supplier_product_key: sku,
      product_family: family,
      quantity: request.quantity,
      currency,
      supplier_price: typeof supplierPrice === "number" ? roundMoney(supplierPrice) : null,
      proposed_price_dkk: currency === "DKK" && typeof supplierPrice === "number"
        ? roundMoney(supplierPrice)
        : currency === "EUR" && typeof supplierPrice === "number"
          ? roundMoney(supplierPrice * PRINT_COM_EUR_TO_DKK)
          : null,
      options: request.options,
      raw_response: responseItem,
      error: responseItem ? null : batchError || "Missing batch response row",
    };
  });

  const validRows = priceRows.filter((row) => typeof row.supplier_price === "number");
  const readinessProbe = {
    supplier_slug: PRINT_COM_SUPPLIER_SLUG,
    supplier_name: "Print.com",
    product_family: family,
    supplier_product_key: sku,
    currency,
    region,
    delivery_promise: deliveryPromise,
    normalized_rows: priceRows,
    row_count: priceRows.length,
    valid_row_count: validRows.length,
  };
  let policyIssues = validatePrintComPolicyRows({ policyKey, policy, snapshot: readinessProbe });
  try {
    assertPrintComBankPricePreviewSnapshot(readinessProbe, "inline-print-com-price-preview");
  } catch (error) {
    policyIssues = [...policyIssues, error instanceof Error ? error.message : String(error)];
  }
  const bankWriteReady = Boolean(policy && policyIssues.length === 0);
  const timestamp = timestampForFile();
  const repoRoot = process.cwd();
  const rawSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: path.join("supplier-bank-raw", "print-com", family, "prices"),
    timestamp,
    payload: {
      supplier_slug: PRINT_COM_SUPPLIER_SLUG,
      product_family: family,
      sku,
      generated_at: new Date().toISOString(),
      request: {
        region,
        currency,
        delivery_promise: deliveryPromise,
        quantity_limit: quantityLimit,
        base_options: baseOptions,
        selected_candidate: selectedCandidate,
        policy_key: policyKey || null,
        policy_label: policy?.label || null,
      },
      product_detail: detail,
      batch_error: batchError,
      batch_response: batchData,
    },
  });
  const normalizedSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: path.join("supplier-bank-normalized", "print-com", family, "prices"),
    timestamp,
    payload: {
      supplier_slug: PRINT_COM_SUPPLIER_SLUG,
      supplier_name: "Print.com",
      product_family: family,
      supplier_product_key: sku,
      source_language: "en",
      target_language: "da",
      generated_at: new Date().toISOString(),
      raw_snapshot_path: path.relative(repoRoot, rawSnapshotPath),
      currency,
      region,
      delivery_promise: deliveryPromise,
      policy_key: policyKey || null,
      policy_label: policy?.label || null,
      normalized_attributes: properties.map(summarizePrintComProperty),
      normalized_rows: priceRows,
      row_count: priceRows.length,
      valid_row_count: validRows.length,
      bank_write_ready: bankWriteReady,
      reason_not_ready: bankWriteReady
        ? null
        : `Needs named policy and passing quality gates before supplier-bank write.${policyIssues.length ? ` Issues: ${policyIssues.slice(0, 5).join("; ")}` : ""}`,
      quality_gate_summary: {
        policy_key: policyKey || null,
        policy_label: policy?.label || null,
        policy_issues: policyIssues,
        valid_rows: validRows.length,
        row_count: priceRows.length,
      },
    },
  });

  console.log("");
  console.log("Price preview result");
  console.log(`  Requests: ${requests.length}`);
  console.log(`  Valid price rows: ${validRows.length}/${priceRows.length}`);
  console.log(`  Selected material/bundle: ${selectedCandidate.material || "unknown"} / ${selectedCandidate.bundle}`);
  if (batchError) console.log(`  Batch error: ${batchError}`);
  if (policyIssues.length > 0) {
    console.log(`  Policy/quality issues: ${policyIssues.slice(0, 3).join("; ")}`);
  }
  console.log(`  Bank write ready: ${bankWriteReady ? "yes" : "no"}`);
  console.log(`  Raw snapshot: ${path.relative(repoRoot, rawSnapshotPath)}`);
  console.log(`  Normalized preview: ${path.relative(repoRoot, normalizedSnapshotPath)}`);
  priceRows.forEach((row, index) => {
    console.log(`  ${index + 1}. qty ${row.quantity} | ${row.supplier_price ?? "no price"} ${currency} | options ${Object.keys(row.options).length}`);
  });
}

function getPrintComRowOptionSignature(row) {
  const options = row?.options && typeof row.options === "object" ? row.options : {};
  return Object.entries(options)
    .filter(([key]) => key !== "copies")
    .map(([key, value]) => `${key}:${String(value)}`)
    .sort()
    .join("|");
}

function summarizePrintComPriceRows(rows) {
  const quantities = rows
    .map((row) => Number(row.quantity))
    .filter((value) => Number.isFinite(value));
  const prices = rows
    .map((row) => Number(row.proposed_price_dkk))
    .filter((value) => Number.isFinite(value));
  const optionKeys = [...new Set(rows.flatMap((row) => Object.keys(row.options || {})))].sort();

  return {
    rows: rows.length,
    quantity_min: quantities.length ? Math.min(...quantities) : null,
    quantity_max: quantities.length ? Math.max(...quantities) : null,
    price_min_dkk: prices.length ? Math.min(...prices) : null,
    price_max_dkk: prices.length ? Math.max(...prices) : null,
    option_keys: optionKeys,
    option_signature_count: new Set(rows.map(getPrintComRowOptionSignature)).size,
  };
}

function assertPrintComBankPricePreviewSnapshot(snapshot, snapshotPath) {
  if (snapshot?.supplier_slug !== PRINT_COM_SUPPLIER_SLUG) {
    throw new Error(`Snapshot supplier is not ${PRINT_COM_SUPPLIER_SLUG}: ${snapshot?.supplier_slug || "missing"}`);
  }
  if (!snapshot?.supplier_product_key) {
    throw new Error("Print.com price preview is missing supplier_product_key");
  }
  if (!PRODUCT_FAMILIES.has(snapshot?.product_family)) {
    throw new Error(`Unsupported Print.com product family: ${snapshot?.product_family || "missing"}`);
  }
  if (snapshot?.currency !== "DKK") {
    throw new Error(`Print.com price preview must be DKK for the first bank slice: ${snapshot?.currency || "missing"}`);
  }

  const rows = Array.isArray(snapshot?.normalized_rows) ? snapshot.normalized_rows : [];
  if (!rows.length) {
    throw new Error("Print.com price preview has zero normalized rows");
  }
  if (Number(snapshot?.row_count) !== rows.length) {
    throw new Error(`Print.com row_count mismatch: ${snapshot?.row_count} vs ${rows.length}`);
  }
  if (Number(snapshot?.valid_row_count) !== rows.length) {
    throw new Error(`Print.com preview is partial: ${snapshot?.valid_row_count}/${rows.length} valid rows`);
  }

  const duplicateKeys = rows
    .map((row) => row.supplier_row_key)
    .filter((key, index, all) => key && all.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    throw new Error(`Print.com price preview has duplicate row keys: ${[...new Set(duplicateKeys)].slice(0, 3).join(", ")}`);
  }

  const rowsHaveBundleOption = rows.some((row) => row?.options && Object.prototype.hasOwnProperty.call(row.options, "bundle"));
  const rowsHaveFinishOption = rows.some((row) => row?.options && Object.prototype.hasOwnProperty.call(row.options, "finish"));
  const requiredOptions = ["size", "material", "printtype", "printingmethod", "copies"];
  if (rowsHaveFinishOption || Object.prototype.hasOwnProperty.call(snapshot?.policy?.optionOverrides || {}, "finish")) {
    requiredOptions.push("finish");
  }
  if (rowsHaveBundleOption || snapshot?.supplier_product_key === "flyers") {
    requiredOptions.push("bundle");
  }
  const invalidRows = rows.filter((row) => {
    const supplierPrice = Number(row.supplier_price);
    const proposedPrice = Number(row.proposed_price_dkk);
    const quantity = Number(row.quantity);
    const options = row.options || {};
    return Boolean(row.error)
      || row.currency !== snapshot.currency
      || !Number.isFinite(supplierPrice)
      || supplierPrice <= 0
      || !Number.isFinite(proposedPrice)
      || proposedPrice <= 0
      || !Number.isFinite(quantity)
      || quantity < PRINT_COM_MIN_PROBE_QUANTITY
      || requiredOptions.some((key) => options[key] === undefined || options[key] === null || options[key] === "");
  });
  if (invalidRows.length > 0) {
    throw new Error(`Print.com price preview has ${invalidRows.length} invalid row(s)`);
  }

  const rowsBySignature = new Map();
  rows.forEach((row) => {
    const signature = getPrintComRowOptionSignature(row);
    const group = rowsBySignature.get(signature) || [];
    group.push(row);
    rowsBySignature.set(signature, group);
  });

  for (const [signature, group] of rowsBySignature.entries()) {
    const sorted = [...group].sort((left, right) => Number(left.quantity) - Number(right.quantity));
    for (let index = 1; index < sorted.length; index += 1) {
      const previousPrice = Number(sorted[index - 1].proposed_price_dkk);
      const currentPrice = Number(sorted[index].proposed_price_dkk);
      if (currentPrice < previousPrice) {
        throw new Error(
          `Print.com price preview decreases with quantity for ${signature}: ${sorted[index - 1].quantity}=${previousPrice}, ${sorted[index].quantity}=${currentPrice}`
        );
      }
    }
  }

  if (snapshot.bank_write_ready) {
    const policyKey = normalizeText(snapshot.policy_key || "");
    const policy = getPrintComPricePolicy(policyKey);
    const policyIssues = validatePrintComPolicyRows({ policyKey, policy, snapshot });
    if (policyIssues.length > 0) {
      throw new Error(`Print.com bank-write-ready preview failed policy gate: ${policyIssues.slice(0, 5).join("; ")}`);
    }
  }

  return summarizePrintComPriceRows(rows);
}

function findLatestPrintComBankReadyPreview({ productFamily, supplierProductKey, policyKey }) {
  const previewDir = path.join(
    process.cwd(),
    "pricing_raw",
    "supplier-bank-normalized",
    "print-com",
    productFamily,
    "prices"
  );
  if (!fs.existsSync(previewDir)) return null;

  const candidates = fs.readdirSync(previewDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .reverse()
    .map((fileName) => path.join(previewDir, fileName));

  for (const candidatePath of candidates) {
    try {
      const snapshot = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
      if (snapshot?.supplier_slug !== PRINT_COM_SUPPLIER_SLUG) continue;
      if (snapshot?.product_family !== productFamily) continue;
      if (snapshot?.supplier_product_key !== supplierProductKey) continue;
      if (policyKey && snapshot?.policy_key !== policyKey) continue;
      if (!snapshot?.bank_write_ready) continue;
      const summary = assertPrintComBankPricePreviewSnapshot(snapshot, candidatePath);
      return {
        path: path.relative(process.cwd(), candidatePath),
        snapshot,
        summary,
      };
    } catch (error) {
      continue;
    }
  }

  return null;
}

function buildPrintComPlacematsPreflightMarkdown({ preview, coverage, blockers, writeCommand }) {
  const printComRow = coverage.rows.find((row) => row.source.slug === PRINT_COM_SUPPLIER_SLUG) || null;
  const lines = [
    "# Print.com Placemats Bank Write Preflight",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Scope",
    "",
    "- Read-only preflight for the Print.com `placemats` supplier-bank snapshot.",
    "- No Print.com API calls.",
    "- No supplier-bank writes.",
    "- No POD v2 writes.",
    "- No product creation, publishing, or live pricing writes.",
    "",
    "## Verdict",
    "",
    blockers.length === 0
      ? "Ready for explicit bank-only write approval."
      : "Not ready for a bank write yet.",
    "",
    "## Preview Evidence",
    "",
    `- Preview: \`${preview.path}\``,
    `- Supplier/product: ${preview.snapshot.supplier_name || "Print.com"} / ${preview.snapshot.supplier_product_key}`,
    `- Family: ${preview.snapshot.product_family}`,
    `- Policy: ${preview.snapshot.policy_key || "missing"}`,
    `- Region/currency: ${preview.snapshot.region || "unknown"}/${preview.snapshot.currency || "unknown"}`,
    `- Rows: ${preview.summary.rows}`,
    `- Valid rows: ${preview.snapshot.valid_row_count}`,
    `- Quantities: ${preview.summary.quantity_min}-${preview.summary.quantity_max}`,
    `- DKK range: ${formatDecisionValue(preview.summary.price_min_dkk)}-${formatDecisionValue(preview.summary.price_max_dkk)}`,
    `- Option signatures: ${preview.summary.option_signature_count}`,
    "",
    "## Coverage Evidence",
    "",
    `- Print.com staged families: ${printComRow ? formatFamilyList(printComRow.stagedFamilies) : "unknown"}`,
    `- Print.com missing families: ${printComRow ? formatFamilyList(printComRow.missingFamilies) : "unknown"}`,
    `- Print.com supplier state: ${printComRow ? `${printComRow.source.status || "candidate"} / ${printComRow.supplier?.enabled ? "enabled" : "disabled"}` : "unknown"}`,
    "",
    "## Blockers",
    "",
    ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "## Guarded Command",
    "",
    "```bash",
    writeCommand,
    "```",
    "",
    "Run this command only after explicit approval. It may write supplier-bank rows only and must not create products, write POD v2 tables, publish products, or write live storefront pricing.",
    ""
  ];

  return `${lines.join("\n")}\n`;
}

async function runPreflightPrintComPlacematsBankWrite(args) {
  const parsed = parseArgs(args);
  const explicitSnapshotPath = parsed.positionals[0] || parsed.values.snapshot || "";
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({
    registryPath: DEFAULT_SUPPLIER_SOURCE_REGISTRY,
    includeArchived: false,
  });

  let preview = null;
  if (explicitSnapshotPath) {
    const loaded = loadJsonFile(explicitSnapshotPath);
    const summary = assertPrintComBankPricePreviewSnapshot(loaded.json, loaded.path);
    preview = {
      path: path.relative(process.cwd(), loaded.path),
      snapshot: loaded.json,
      summary,
    };
  } else {
    preview = findLatestPrintComBankReadyPreview({
      productFamily: "other",
      supplierProductKey: "placemats",
      policyKey: "placemats-a4-landscape-135gsm-coated-4-0",
    });
  }

  if (!preview) {
    throw new Error("No bank-write-ready Print.com placemats preview found. Run supplier-bank:print-com-placemats-price-preview first.");
  }

  const printComRow = coverage.rows.find((row) => row.source.slug === PRINT_COM_SUPPLIER_SLUG) || null;
  const blockers = [];
  if (preview.snapshot.supplier_slug !== PRINT_COM_SUPPLIER_SLUG) blockers.push("Preview supplier is not Print.com.");
  if (preview.snapshot.product_family !== "other") blockers.push(`Preview family must be other, got ${preview.snapshot.product_family || "missing"}.`);
  if (preview.snapshot.supplier_product_key !== "placemats") blockers.push(`Preview product key must be placemats, got ${preview.snapshot.supplier_product_key || "missing"}.`);
  if (preview.snapshot.policy_key !== "placemats-a4-landscape-135gsm-coated-4-0") blockers.push(`Preview policy key is not placemats-a4-landscape-135gsm-coated-4-0.`);
  if (!preview.snapshot.bank_write_ready) blockers.push("Preview bank_write_ready flag is false.");
  if (!printComRow) blockers.push("Print.com is missing from supplier-source coverage context.");
  if (printComRow && !printComRow.missingFamilies.includes("other")) {
    blockers.push("Print.com `other` is no longer missing from stored coverage; review existing bank rows before another write.");
  }

  const writeCommand = `node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot ${quoteShellArg(preview.path)} --write-bank`;

  console.log("Print.com placemats bank-write preflight");
  console.log("  Scope: read-only Print.com placemats bank-write preflight");
  console.log("  Print.com API calls: no");
  console.log("  Bank writes: no");
  console.log("  POD v2 writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Preview");
  console.log(`  Path: ${preview.path}`);
  console.log(`  Policy: ${preview.snapshot.policy_key || "missing"}`);
  console.log(`  Rows: ${preview.summary.rows}/${preview.snapshot.valid_row_count}`);
  console.log(`  Quantities: ${preview.summary.quantity_min}-${preview.summary.quantity_max}`);
  console.log(`  DKK range: ${formatDecisionValue(preview.summary.price_min_dkk)}-${formatDecisionValue(preview.summary.price_max_dkk)}`);
  console.log("");
  console.log("Coverage");
  console.log(`  Print.com staged families: ${printComRow ? formatFamilyList(printComRow.stagedFamilies) : "unknown"}`);
  console.log(`  Print.com missing families: ${printComRow ? formatFamilyList(printComRow.missingFamilies) : "unknown"}`);
  console.log("");
  console.log("Verdict");
  console.log(blockers.length === 0 ? "  Ready for explicit bank-only write approval." : "  Not ready.");
  if (blockers.length > 0) {
    blockers.forEach((blocker) => console.log(`  - ${blocker}`));
  }
  console.log("");
  console.log("Guarded command after explicit approval");
  console.log(`  ${writeCommand}`);

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_${timestampForFile()}.md`);
    const report = buildPrintComPlacematsPreflightMarkdown({
      preview,
      coverage,
      blockers,
      writeCommand,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST_PATH}`);
  }
}

async function writePrintComBankRows({ snapshot, snapshotPath }) {
  const summary = assertPrintComBankPricePreviewSnapshot(snapshot, snapshotPath);
  const client = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const rows = snapshot.normalized_rows;
  const checksum = stableJsonChecksum(rows);

  const { validation } = loadValidatedSupplierRegistry(DEFAULT_SUPPLIER_SOURCE_REGISTRY);
  const source = validation.sources.find((item) => item.slug === PRINT_COM_SUPPLIER_SLUG);
  if (!source) throw new Error(`Supplier source registry is missing ${PRINT_COM_SUPPLIER_SLUG}`);

  const { data: existingSupplier, error: existingSupplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,enabled")
    .eq("slug", PRINT_COM_SUPPLIER_SLUG)
    .maybeSingle();

  if (existingSupplierError) {
    throw new Error(`Print.com supplier lookup failed. ${formatSupabaseError(existingSupplierError)}`);
  }

  const { data: supplierRow, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .upsert(
      {
        name: source.name,
        slug: source.slug,
        website_url: source.websiteUrl || "https://www.print.com",
        country_code: source.countryCode || "NL",
        currency: source.currency || "EUR",
        integration_type: source.integrationType || "api",
        enabled: existingSupplier ? existingSupplier.enabled : false,
        metadata: {
          source: "supplier-bank-print-com-price-preview",
          registryStatus: source.status || "candidate",
          lastPreviewSnapshotPath: snapshotPath,
        },
      },
      { onConflict: "slug" },
    )
    .select("id,enabled")
    .single();

  if (supplierError) {
    throw new Error(`Print.com supplier upsert failed. ${formatSupabaseError(supplierError)}`);
  }

  const { data: runRow, error: runError } = await client
    .from("supplier_bank_scrape_runs")
    .insert({
      supplier_id: supplierRow.id,
      mode: "product_extract",
      tool: "supplier_api",
      status: "succeeded",
      input: {
        supplierProductKey: snapshot.supplier_product_key,
        productFamily: snapshot.product_family,
        previewSnapshotPath: snapshotPath,
        rawSnapshotPath: snapshot.raw_snapshot_path || null,
        region: snapshot.region,
        currency: snapshot.currency,
      },
      summary: {
        ...summary,
        previewSnapshotPath: snapshotPath,
        rawSnapshotPath: snapshot.raw_snapshot_path || null,
      },
      finished_at: now,
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(`Print.com scrape-run insert failed. ${formatSupabaseError(runError)}`);
  }

  const { data: existingProductRow, error: existingProductError } = await client
    .from("supplier_bank_products")
    .select("status")
    .eq("supplier_id", supplierRow.id)
    .eq("supplier_product_key", snapshot.supplier_product_key)
    .maybeSingle();

  if (existingProductError) {
    throw new Error(`Print.com bank product lookup failed. ${formatSupabaseError(existingProductError)}`);
  }

  const preservedStatus = ["approved", "archived"].includes(existingProductRow?.status)
    ? existingProductRow.status
    : "draft";

  const firstRow = rows[0] || {};
  const normalizedAttributes = {
    attributes: snapshot.normalized_attributes || [],
    optionKeys: summary.option_keys,
    quantities: [...new Set(rows.map((row) => Number(row.quantity)))].sort((left, right) => left - right),
    baseOptions: firstRow.options || {},
    region: snapshot.region,
    currency: snapshot.currency,
    deliveryPromise: snapshot.delivery_promise,
  };

  const { data: productRow, error: productError } = await client
    .from("supplier_bank_products")
    .upsert(
      {
        supplier_id: supplierRow.id,
        latest_scrape_run_id: runRow.id,
        supplier_product_key: snapshot.supplier_product_key,
        source_url: "https://www.print.com",
        source_hash: checksum,
        product_family: snapshot.product_family,
        name_original: snapshot.supplier_product_key,
        name_da: translatePrintComProductName(snapshot.supplier_product_key, snapshot.product_family),
        description_original: null,
        description_da: null,
        source_language: snapshot.source_language || "en",
        target_language: snapshot.target_language || "da",
        status: preservedStatus,
        normalized_attributes: normalizedAttributes,
        normalized_pricing_summary: {
          rows: summary.rows,
          quantityMin: summary.quantity_min,
          quantityMax: summary.quantity_max,
          priceMinDkk: summary.price_min_dkk,
          priceMaxDkk: summary.price_max_dkk,
        },
        raw_snapshot_path: snapshotPath,
        scrape_status: "fresh",
        last_scraped_at: now,
        last_price_checked_at: now,
        metadata: {
          source: "supplier-bank-print-com-price-preview",
          previewSnapshotPath: snapshotPath,
          rawSnapshotPath: snapshot.raw_snapshot_path || null,
          supplierEnabledPreserved: supplierRow.enabled,
          bankWriteReadySourceFlag: Boolean(snapshot.bank_write_ready),
        },
      },
      { onConflict: "supplier_id,supplier_product_key" },
    )
    .select("id,status")
    .single();

  if (productError) {
    throw new Error(`Print.com bank product upsert failed. ${formatSupabaseError(productError)}`);
  }

  const { data: snapshotRow, error: snapshotError } = await client
    .from("supplier_bank_price_snapshots")
    .insert({
      bank_product_id: productRow.id,
      supplier_id: supplierRow.id,
      scrape_run_id: runRow.id,
      currency: snapshot.currency,
      conversion_rule_key: `print_com_${snapshot.supplier_product_key}_${snapshot.currency.toLowerCase()}_preview_v1`,
      raw_price_rows: rows.map((row) => row.raw_response || row),
      normalized_price_rows: rows,
      price_min_dkk: summary.price_min_dkk,
      price_max_dkk: summary.price_max_dkk,
      quantity_min: summary.quantity_min,
      quantity_max: summary.quantity_max,
      checksum,
      metadata: {
        previewSnapshotPath: snapshotPath,
        rawSnapshotPath: snapshot.raw_snapshot_path || null,
        region: snapshot.region,
        deliveryPromise: snapshot.delivery_promise,
      },
    })
    .select("id")
    .single();

  if (snapshotError) {
    throw new Error(`Print.com price snapshot insert failed. ${formatSupabaseError(snapshotError)}`);
  }

  return {
    supplierId: supplierRow.id,
    supplierEnabled: supplierRow.enabled,
    scrapeRunId: runRow.id,
    bankProductId: productRow.id,
    bankProductStatus: productRow.status,
    priceSnapshotId: snapshotRow.id,
    checksum,
    summary,
  };
}

async function runWritePrintComBankSnapshot(args) {
  const parsed = parseArgs(args);
  const snapshotPath = parsed.positionals[0];
  if (!snapshotPath) throw new Error(`Missing Print.com price preview snapshot path\n\n${usage()}`);

  const { path: resolvedPath, json: snapshot } = loadJsonFile(snapshotPath);
  const summary = assertPrintComBankPricePreviewSnapshot(snapshot, resolvedPath);
  const shouldWrite = parsed.flags.has("write-bank");
  const allowPreviewBankWrite = parsed.flags.has("allow-preview-bank-write");

  console.log("Supplier bank Print.com snapshot write plan");
  console.log("  Scope: Print.com supplier-bank price snapshot");
  console.log("  POD v2 writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Product publishing: no");
  console.log(`  Preview snapshot: ${resolvedPath}`);
  console.log(`  Supplier/product: ${snapshot.supplier_name || "Print.com"} / ${snapshot.supplier_product_key}`);
  console.log(`  Family: ${snapshot.product_family}`);
  console.log(`  Region/currency: ${snapshot.region || "unknown"}/${snapshot.currency || "unknown"}`);
  console.log(`  Rows: ${summary.rows}`);
  console.log(`  Quantities: ${summary.quantity_min ?? "unknown"}-${summary.quantity_max ?? "unknown"}`);
  console.log(`  DKK range: ${summary.price_min_dkk ?? "unknown"}-${summary.price_max_dkk ?? "unknown"}`);
  console.log(`  Option signatures: ${summary.option_signature_count}`);
  console.log(`  Source bank_write_ready flag: ${snapshot.bank_write_ready ? "yes" : "no"}`);

  if (!shouldWrite) {
    console.log("");
    console.log("Preview only. Add --write-bank only after the preview is marked bank-write-ready and reviewed.");
    return;
  }

  if (!snapshot.bank_write_ready && !allowPreviewBankWrite) {
    throw new Error(
      "Print.com preview is not bank-write-ready. Add wider option policy and quality gates first, or use --allow-preview-bank-write only after explicit review."
    );
  }

  const writeResult = await writePrintComBankRows({ snapshot, snapshotPath: resolvedPath });
  console.log("");
  console.log("Print.com supplier-bank write complete");
  console.log(`  Supplier ID: ${writeResult.supplierId}`);
  console.log(`  Supplier enabled preserved: ${writeResult.supplierEnabled ? "yes" : "no"}`);
  console.log(`  Scrape run ID: ${writeResult.scrapeRunId}`);
  console.log(`  Bank product ID: ${writeResult.bankProductId}`);
  console.log(`  Bank product status: ${writeResult.bankProductStatus}`);
  console.log(`  Price snapshot ID: ${writeResult.priceSnapshotId}`);
  console.log(`  Checksum: ${writeResult.checksum}`);
}

async function runApproveBankProduct(args) {
  const parsed = parseArgs(args);
  const supplierSlug = requireValue(parsed.values, "supplier-slug");
  const productKey = requireValue(parsed.values, "product-key");
  const confirmStatusUpdate = parsed.flags.has("confirm-status-update");
  const client = getSupabaseServiceClient();

  console.log("Supplier bank product approval");
  console.log("  Scope: bank-only product status transition");
  console.log("  Supplier scrapes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Product publishing: no");
  console.log(`  Supplier slug: ${supplierSlug}`);
  console.log(`  Product key: ${productKey}`);

  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled")
    .eq("slug", supplierSlug)
    .maybeSingle();

  if (supplierError) throw new Error(`Supplier lookup failed. ${formatSupabaseError(supplierError)}`);
  if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);

  const { data: product, error: productError } = await client
    .from("supplier_bank_products")
    .select("id,supplier_id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,updated_at")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) throw new Error(`Bank product lookup failed. ${formatSupabaseError(productError)}`);
  if (!product) throw new Error(`Bank product not found: ${productKey}`);

  const { data: snapshots, error: snapshotsError } = await client
    .from("supplier_bank_price_snapshots")
    .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false });

  if (snapshotsError) {
    throw new Error(`Price snapshot lookup failed. ${formatSupabaseError(snapshotsError)}`);
  }

  const { data: reviews, error: reviewsError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,bank_product_id,status,new_price_snapshot_id,change_summary,created_at")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false });

  if (reviewsError) {
    throw new Error(`Delta review lookup failed. ${formatSupabaseError(reviewsError)}`);
  }

  const snapshotStatsByProductId = getSnapshotStatsByProductId(snapshots || []);
  const latestReviewByProductId = getLatestByProductId(reviews || []);
  const gate = getSupplierBankImportGate({
    product,
    snapshotStats: snapshotStatsByProductId.get(product.id) || null,
    latestReview: latestReviewByProductId.get(product.id) || null,
    importedJob: null,
  });

  console.log("");
  console.log("Current decision");
  console.log(`  Supplier: ${supplier.name} (${supplier.slug})`);
  console.log(`  Supplier enabled: ${supplier.enabled ? "yes" : "no"}`);
  console.log(`  Bank product: ${product.name_da || product.name_original || product.supplier_product_key}`);
  console.log(`  Family/status: ${product.product_family} / ${product.status}`);
  console.log(`  Snapshots: ${(snapshots || []).length}`);
  console.log(`  Latest review: ${latestReviewByProductId.get(product.id)?.status || "none"}`);
  console.log(`  Import gate: ${formatEligibilityState(gate.state)} - ${gate.reason}`);
  console.log(`  Confirmed update: ${confirmStatusUpdate ? "yes" : "no"}`);

  if (product.status === "approved") {
    console.log("");
    console.log("Bank product is already approved. No status change needed.");
    return;
  }

  if (gate.state !== "needs_approval") {
    throw new Error(`Bank product cannot be approved yet: ${gate.reason}`);
  }

  if (!confirmStatusUpdate) {
    console.log("");
    console.log("Preview only. Add --confirm-status-update to approve this bank product.");
    return;
  }

  const updatedAt = new Date().toISOString();
  const { error: updateError } = await client
    .from("supplier_bank_products")
    .update({
      status: "approved",
      updated_at: updatedAt,
    })
    .eq("id", product.id);

  if (updateError) {
    throw new Error(`Bank product approval failed. ${formatSupabaseError(updateError)}`);
  }

  console.log("");
  console.log("Bank product approved");
  console.log(`  Product ID: ${product.id}`);
  console.log("  Status: approved");
  console.log(`  Updated at: ${updatedAt}`);
  console.log("  No product, publishing, or live pricing rows were written.");
}

async function getSupplierSourceCoverageContext({ registryPath, includeArchived }) {
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const client = getSupabaseServiceClient();
  const sourceSlugs = validation.sources.map((source) => source.slug);

  const { data: suppliers, error: suppliersError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled,integration_type,metadata")
    .in("slug", sourceSlugs);

  if (suppliersError) {
    throw new Error(`Supplier-bank supplier lookup failed. ${formatSupabaseError(suppliersError)}`);
  }

  const supplierBySlug = new Map((suppliers || []).map((supplier) => [supplier.slug, supplier]));
  const supplierIds = (suppliers || []).map((supplier) => supplier.id);
  let products = [];

  if (supplierIds.length > 0) {
    let productQuery = client
      .from("supplier_bank_products")
      .select("id,supplier_id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,updated_at")
      .in("supplier_id", supplierIds)
      .order("supplier_product_key", { ascending: true });

    if (!includeArchived) {
      productQuery = productQuery.neq("status", "archived");
    }

    const { data: productRows, error: productsError } = await productQuery;
    if (productsError) {
      throw new Error(`Supplier-bank product lookup failed. ${formatSupabaseError(productsError)}`);
    }
    products = productRows || [];
  }

  const productIds = products.map((product) => product.id);
  let snapshots = [];
  let reviews = [];
  let importJobs = [];

  if (productIds.length > 0) {
    const { data: snapshotRows, error: snapshotsError } = await client
      .from("supplier_bank_price_snapshots")
      .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (snapshotsError) {
      throw new Error(`Supplier-bank price snapshot lookup failed. ${formatSupabaseError(snapshotsError)}`);
    }
    snapshots = snapshotRows || [];

    const { data: reviewRows, error: reviewsError } = await client
      .from("supplier_bank_price_delta_reviews")
      .select("id,bank_product_id,status,new_price_snapshot_id,change_summary,created_at")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      throw new Error(`Supplier-bank delta review lookup failed. ${formatSupabaseError(reviewsError)}`);
    }
    reviews = reviewRows || [];

    const { data: importJobRows, error: importJobsError } = await client
      .from("supplier_bank_import_jobs")
      .select("id,bank_product_id,status,import_mode,target_product_id,import_summary,created_at")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (importJobsError) {
      throw new Error(`Supplier-bank import job lookup failed. ${formatSupabaseError(importJobsError)}`);
    }
    importJobs = importJobRows || [];
  }

  const coverageBySupplierId = getBankProductFamilyCoverage(products);
  const snapshotStatsByProductId = getSnapshotStatsByProductId(snapshots);
  const latestReviewByProductId = getLatestByProductId(reviews);
  const latestImportedJobByProductId = getLatestByProductId(
    (importJobs || []).filter((job) => job.status === "imported" && job.target_product_id)
  );
  const readinessBySupplierId = getSupplierReadinessById({
    products,
    snapshotStatsByProductId,
    latestReviewByProductId,
    latestImportedJobByProductId,
  });

  const rows = validation.sources.map((source) => {
    const supplier = supplierBySlug.get(source.slug) || null;
    const expectedFamilies = new Set(Array.isArray(source.productFamilies) ? source.productFamilies : []);
    const coverage = supplier ? coverageBySupplierId.get(supplier.id) : null;
    const readiness = supplier ? readinessBySupplierId.get(supplier.id) : null;
    const stagedFamilies = coverage?.families || new Set();
    const coveredFamilies = [...expectedFamilies].filter((family) => stagedFamilies.has(family));
    const missingFamilies = [...expectedFamilies].filter((family) => !stagedFamilies.has(family));
    const extraFamilies = [...stagedFamilies].filter((family) => !expectedFamilies.has(family));
    const supplierProducts = supplier
      ? products.filter((product) => product.supplier_id === supplier.id)
      : [];
    const pendingApprovalProducts = supplierProducts.filter((product) => {
      const gate = getSupplierBankImportGate({
        product,
        snapshotStats: snapshotStatsByProductId.get(product.id) || null,
        latestReview: latestReviewByProductId.get(product.id) || null,
        importedJob: latestImportedJobByProductId.get(product.id) || null,
      });
      return gate.state === "needs_approval";
    });
    const blockedProducts = supplierProducts.filter((product) => {
      const gate = getSupplierBankImportGate({
        product,
        snapshotStats: snapshotStatsByProductId.get(product.id) || null,
        latestReview: latestReviewByProductId.get(product.id) || null,
        importedJob: latestImportedJobByProductId.get(product.id) || null,
      });
      return gate.state === "blocked";
    });
    const nextAction = getCoverageNextAction({
      supplierSlug: source.slug,
      missingFamilies,
      stagedFamilies,
      readiness,
      supplierEnabled: Boolean(supplier?.enabled),
    });
    const row = {
      source,
      supplier,
      coverage,
      readiness,
      expectedFamilies,
      stagedFamilies,
      coveredFamilies,
      missingFamilies,
      extraFamilies,
      pendingApprovalProducts,
      blockedProducts,
      nextAction,
    };
    row.actionKind = getExpansionActionKind(row);
    row.stepCommands = getExpansionStepCommands(row);
    return row;
  });

  const summary = rows.reduce((acc, row) => {
    acc.sources += 1;
    if (row.supplier) acc.seeded += 1;
    if (row.coveredFamilies.length > 0) acc.sourcesWithCoverage += 1;
    acc.expectedFamilies += row.expectedFamilies.size;
    acc.coveredFamilies += row.coveredFamilies.length;
    acc.missingFamilies += row.missingFamilies.length;
    return acc;
  }, {
    sources: 0,
    seeded: 0,
    sourcesWithCoverage: 0,
    expectedFamilies: 0,
    coveredFamilies: 0,
    missingFamilies: 0,
  });

  return {
    resolvedPath,
    validation,
    rows,
    summary,
  };
}

function getNextDeltaReviewStatuses(status) {
  if (status === "draft") return ["reviewed"];
  if (status === "reviewed") return ["accepted", "rejected"];
  return [];
}

async function runReviewSourceCoverage(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const { resolvedPath, validation } = loadValidatedSupplierRegistry(registryPath);
  const client = getSupabaseServiceClient();
  const sourceSlugs = validation.sources.map((source) => source.slug);

  console.log("Supplier bank source coverage audit");
  console.log("  Scope: read-only registry-to-bank coverage check");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");

  const { data: suppliers, error: suppliersError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled,integration_type,metadata")
    .in("slug", sourceSlugs);

  if (suppliersError) {
    throw new Error(`Supplier-bank supplier lookup failed. ${formatSupabaseError(suppliersError)}`);
  }

  const supplierBySlug = new Map((suppliers || []).map((supplier) => [supplier.slug, supplier]));
  const supplierIds = (suppliers || []).map((supplier) => supplier.id);
  let products = [];

  if (supplierIds.length > 0) {
    let productQuery = client
      .from("supplier_bank_products")
      .select("id,supplier_id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,updated_at")
      .in("supplier_id", supplierIds)
      .order("supplier_product_key", { ascending: true });

    if (!includeArchived) {
      productQuery = productQuery.neq("status", "archived");
    }

    const { data: productRows, error: productsError } = await productQuery;
    if (productsError) {
      throw new Error(`Supplier-bank product lookup failed. ${formatSupabaseError(productsError)}`);
    }
    products = productRows || [];
  }

  const productIds = products.map((product) => product.id);
  let snapshots = [];
  let reviews = [];
  let importJobs = [];

  if (productIds.length > 0) {
    const { data: snapshotRows, error: snapshotsError } = await client
      .from("supplier_bank_price_snapshots")
      .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (snapshotsError) {
      throw new Error(`Supplier-bank price snapshot lookup failed. ${formatSupabaseError(snapshotsError)}`);
    }
    snapshots = snapshotRows || [];

    const { data: reviewRows, error: reviewsError } = await client
      .from("supplier_bank_price_delta_reviews")
      .select("id,bank_product_id,status,new_price_snapshot_id,change_summary,created_at")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      throw new Error(`Supplier-bank delta review lookup failed. ${formatSupabaseError(reviewsError)}`);
    }
    reviews = reviewRows || [];

    const { data: importJobRows, error: importJobsError } = await client
      .from("supplier_bank_import_jobs")
      .select("id,bank_product_id,status,import_mode,target_product_id,import_summary,created_at")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (importJobsError) {
      throw new Error(`Supplier-bank import job lookup failed. ${formatSupabaseError(importJobsError)}`);
    }
    importJobs = importJobRows || [];
  }

  const coverageBySupplierId = getBankProductFamilyCoverage(products);
  const snapshotStatsByProductId = getSnapshotStatsByProductId(snapshots);
  const latestReviewByProductId = getLatestByProductId(reviews);
  const latestImportedJobByProductId = getLatestByProductId(
    (importJobs || []).filter((job) => job.status === "imported" && job.target_product_id)
  );
  const readinessBySupplierId = getSupplierReadinessById({
    products,
    snapshotStatsByProductId,
    latestReviewByProductId,
    latestImportedJobByProductId,
  });
  const rows = validation.sources.map((source) => {
    const supplier = supplierBySlug.get(source.slug) || null;
    const expectedFamilies = new Set(Array.isArray(source.productFamilies) ? source.productFamilies : []);
    const coverage = supplier ? coverageBySupplierId.get(supplier.id) : null;
    const readiness = supplier ? readinessBySupplierId.get(supplier.id) : null;
    const stagedFamilies = coverage?.families || new Set();
    const coveredFamilies = [...expectedFamilies].filter((family) => stagedFamilies.has(family));
    const missingFamilies = [...expectedFamilies].filter((family) => !stagedFamilies.has(family));
    const extraFamilies = [...stagedFamilies].filter((family) => !expectedFamilies.has(family));
    const nextAction = getCoverageNextAction({
      supplierSlug: source.slug,
      missingFamilies,
      stagedFamilies,
      readiness,
      supplierEnabled: Boolean(supplier?.enabled),
    });

    return {
      source,
      supplier,
      coverage,
      readiness,
      expectedFamilies,
      stagedFamilies,
      coveredFamilies,
      missingFamilies,
      extraFamilies,
      nextAction,
    };
  });

  const summary = rows.reduce((acc, row) => {
    acc.sources += 1;
    if (row.supplier) acc.seeded += 1;
    if (row.coveredFamilies.length > 0) acc.sourcesWithCoverage += 1;
    acc.expectedFamilies += row.expectedFamilies.size;
    acc.coveredFamilies += row.coveredFamilies.length;
    acc.missingFamilies += row.missingFamilies.length;
    return acc;
  }, {
    sources: 0,
    seeded: 0,
    sourcesWithCoverage: 0,
    expectedFamilies: 0,
    coveredFamilies: 0,
    missingFamilies: 0,
  });

  console.log("");
  console.log("Summary");
  console.log(`  Registry sources: ${summary.sources}`);
  console.log(`  Seeded supplier rows: ${summary.seeded}`);
  console.log(`  Sources with bank products: ${summary.sourcesWithCoverage}`);
  console.log(`  Expected families: ${summary.expectedFamilies}`);
  console.log(`  Covered families: ${summary.coveredFamilies}`);
  console.log(`  Missing families: ${summary.missingFamilies}`);

  console.log("");
  console.log("Suppliers");
  rows.forEach((row, index) => {
    const supplierStatus = row.supplier ? (row.supplier.enabled ? "enabled" : "disabled") : "not seeded";
    const sourceStatus = normalizeText(row.source.status || "candidate");
    const productCount = row.coverage?.productCount || 0;
    const statusCounts = formatStatusCounts(row.coverage?.statusCounts || new Map());
    const readiness = row.readiness || { ready: 0, needsApproval: 0, imported: 0, blocked: 0 };

    console.log(`  ${index + 1}. ${row.source.name} (${row.source.slug}) | ${sourceStatus} / ${supplierStatus}`);
    console.log(`     Expected families: ${formatFamilyList(row.expectedFamilies)}`);
    console.log(`     Staged families: ${formatFamilyList(row.stagedFamilies)}`);
    console.log(`     Missing families: ${formatFamilyList(row.missingFamilies)}`);
    if (row.extraFamilies.length > 0) {
      console.log(`     Extra staged families: ${formatFamilyList(row.extraFamilies)}`);
    }
    console.log(`     Bank products: ${productCount} | statuses: ${statusCounts}`);
    console.log(`     Readiness: ready:${readiness.ready} needs_approval:${readiness.needsApproval} imported:${readiness.imported} blocked:${readiness.blocked}`);
    console.log(`     Next action: ${row.nextAction}`);
  });
}

async function runPlanNextExpansion(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const { resolvedPath, rows, summary } = await getSupplierSourceCoverageContext({
    registryPath,
    includeArchived,
  });

  const rankedRows = [...rows].sort((left, right) => {
    const priorityDelta = getExpansionPriority(left.actionKind) - getExpansionPriority(right.actionKind);
    if (priorityDelta !== 0) return priorityDelta;
    const missingDelta = right.missingFamilies.length - left.missingFamilies.length;
    if (missingDelta !== 0) return missingDelta;
    return left.source.name.localeCompare(right.source.name);
  });
  const recommendation = rankedRows[0] || null;

  console.log("Supplier bank next expansion plan");
  console.log("  Scope: read-only step planner");
  console.log(`  Registry: ${resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");

  console.log("");
  console.log("Current coverage");
  console.log(`  Suppliers: ${summary.sources}`);
  console.log(`  Seeded suppliers: ${summary.seeded}`);
  console.log(`  Covered families: ${summary.coveredFamilies}/${summary.expectedFamilies}`);
  console.log(`  Missing families: ${summary.missingFamilies}`);

  if (!recommendation) {
    console.log("");
    console.log("No supplier sources found in the registry.");
    return;
  }

  const readiness = recommendation.readiness || { ready: 0, needsApproval: 0, imported: 0, blocked: 0 };
  const supplierStatus = recommendation.supplier
    ? (recommendation.supplier.enabled ? "enabled" : "disabled")
    : "not seeded";

  console.log("");
  console.log("Recommended next step");
  console.log(`  Supplier: ${recommendation.source.name} (${recommendation.source.slug})`);
  console.log(`  Source status: ${normalizeText(recommendation.source.status || "candidate")} / ${supplierStatus}`);
  console.log(`  Action type: ${formatExpansionKind(recommendation.actionKind)}`);
  console.log(`  Next action: ${recommendation.nextAction}`);
  console.log(`  Expected families: ${formatFamilyList(recommendation.expectedFamilies)}`);
  console.log(`  Staged families: ${formatFamilyList(recommendation.stagedFamilies)}`);
  console.log(`  Missing families: ${formatFamilyList(recommendation.missingFamilies)}`);
  console.log(`  Readiness: ready:${readiness.ready} needs_approval:${readiness.needsApproval} imported:${readiness.imported} blocked:${readiness.blocked}`);

  console.log("");
  console.log("Step plan");
  recommendation.stepCommands.forEach((command, index) => {
    console.log(`  ${index + 1}. ${command}`);
  });
  console.log(`  ${recommendation.stepCommands.length + 1}. Re-run npm run supplier-bank:review-source-coverage`);
  console.log(`  ${recommendation.stepCommands.length + 2}. Re-run npm run supplier-bank:review-import-eligibility`);

  console.log("");
  console.log("Backlog order");
  rankedRows.forEach((row, index) => {
    const rowReadiness = row.readiness || { ready: 0, needsApproval: 0, imported: 0, blocked: 0 };
    console.log(
      `  ${index + 1}. ${row.source.name}: ${formatExpansionKind(row.actionKind)} | missing ${row.missingFamilies.length} | blocked ${rowReadiness.blocked}`
    );
  });
}

async function getSupplierBankImportEligibilityContext({ includeArchived }) {
  const client = getSupabaseServiceClient();

  let productQuery = client
    .from("supplier_bank_products")
    .select([
      "id",
      "supplier_id",
      "supplier_product_key",
      "name_da",
      "name_original",
      "product_family",
      "status",
      "scrape_status",
      "updated_at",
    ].join(","))
    .order("supplier_product_key", { ascending: true });

  if (!includeArchived) {
    productQuery = productQuery.neq("status", "archived");
  }

  const { data: products, error: productsError } = await productQuery;

  if (productsError) {
    throw new Error(`Supplier-bank products lookup failed. ${formatSupabaseError(productsError)}`);
  }

  const bankProducts = Array.isArray(products) ? products : [];
  const productIds = bankProducts.map((product) => product.id);
  const supplierIds = uniqueValues(bankProducts.map((product) => product.supplier_id));
  let suppliers = [];
  let snapshots = [];
  let reviews = [];
  let importJobs = [];

  if (supplierIds.length > 0) {
    const { data: supplierRows, error: suppliersError } = await client
      .from("supplier_bank_suppliers")
      .select("id,name,slug,enabled")
      .in("id", supplierIds);

    if (suppliersError) {
      throw new Error(`Supplier-bank supplier lookup failed. ${formatSupabaseError(suppliersError)}`);
    }
    suppliers = supplierRows || [];
  }

  if (productIds.length > 0) {
    const { data: snapshotRows, error: snapshotsError } = await client
      .from("supplier_bank_price_snapshots")
      .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (snapshotsError) {
      throw new Error(`Supplier-bank price snapshot lookup failed. ${formatSupabaseError(snapshotsError)}`);
    }
    snapshots = snapshotRows || [];

    const { data: reviewRows, error: reviewsError } = await client
      .from("supplier_bank_price_delta_reviews")
      .select("id,bank_product_id,status,new_price_snapshot_id,change_summary,created_at")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      throw new Error(`Supplier-bank delta review lookup failed. ${formatSupabaseError(reviewsError)}`);
    }
    reviews = reviewRows || [];

    const { data: importJobRows, error: importJobsError } = await client
      .from("supplier_bank_import_jobs")
      .select("id,bank_product_id,status,import_mode,target_product_id,import_summary,created_at")
      .in("bank_product_id", productIds)
      .order("created_at", { ascending: false });

    if (importJobsError) {
      throw new Error(`Supplier-bank import job lookup failed. ${formatSupabaseError(importJobsError)}`);
    }
    importJobs = importJobRows || [];
  }

  const supplierById = new Map((suppliers || []).map((supplier) => [supplier.id, supplier]));
  const snapshotStatsByProductId = getSnapshotStatsByProductId(snapshots);
  const latestReviewByProductId = getLatestByProductId(reviews);
  const latestImportedJobByProductId = getLatestByProductId(
    (importJobs || []).filter((job) => job.status === "imported" && job.target_product_id)
  );

  const rows = bankProducts.map((product) => {
    const supplier = supplierById.get(product.supplier_id) || null;
    const snapshotStats = snapshotStatsByProductId.get(product.id) || null;
    const latestReview = latestReviewByProductId.get(product.id) || null;
    const importedJob = latestImportedJobByProductId.get(product.id) || null;
    const gate = getSupplierBankImportGate({
      product,
      snapshotStats,
      latestReview,
      importedJob,
    });

    return {
      product,
      supplier,
      snapshotStats,
      latestReview,
      importedJob,
      gate,
    };
  });

  const summary = rows.reduce((acc, row) => {
    acc.checked += 1;
    if (row.gate.state === "ready") acc.ready += 1;
    else if (row.gate.state === "needs_approval") acc.needsApproval += 1;
    else if (row.gate.state === "already_imported") acc.alreadyImported += 1;
    else acc.blocked += 1;
    return acc;
  }, {
    checked: 0,
    ready: 0,
    needsApproval: 0,
    alreadyImported: 0,
    blocked: 0,
  });

  const sortRank = {
    blocked: 0,
    needs_approval: 1,
    ready: 2,
    already_imported: 3,
  };
  rows.sort((left, right) => {
    const rankDelta = (sortRank[left.gate.state] ?? 9) - (sortRank[right.gate.state] ?? 9);
    if (rankDelta !== 0) return rankDelta;
    const leftName = left.product.name_da || left.product.name_original || left.product.supplier_product_key;
    const rightName = right.product.name_da || right.product.name_original || right.product.supplier_product_key;
    return leftName.localeCompare(rightName);
  });

  return {
    rows,
    summary,
  };
}

async function runReviewImportEligibility(args) {
  const parsed = parseArgs(args);
  const limit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 20)));
  const includeArchived = parsed.flags.has("include-archived");

  console.log("Supplier bank import eligibility audit");
  console.log("  Scope: read-only bank import decision aid");
  console.log("  Supplier scrapes: no");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");

  const { rows, summary } = await getSupplierBankImportEligibilityContext({ includeArchived });
  if (rows.length === 0) {
    console.log("");
    console.log("No supplier-bank products found.");
    return;
  }

  console.log("");
  console.log("Summary");
  console.log(`  Products checked: ${summary.checked}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log(`  Ready now: ${summary.ready}`);
  console.log(`  Ready after bank approval: ${summary.needsApproval}`);
  console.log(`  Already imported: ${summary.alreadyImported}`);
  console.log(`  Blocked: ${summary.blocked}`);

  console.log("");
  console.log(`Products (${Math.min(limit, rows.length)} of ${rows.length})`);
  rows.slice(0, limit).forEach((row, index) => {
    const productName = row.product.name_da || row.product.name_original || row.product.supplier_product_key;
    const supplierName = row.supplier?.name || row.supplier?.slug || row.product.supplier_id;
    const reviewStatus = row.latestReview?.status || "none";
    const reviewTarget = row.latestReview?.new_price_snapshot_id === row.snapshotStats?.latestSnapshotId ? "latest" : "not latest";
    const snapshotCount = row.snapshotStats?.count || 0;
    const latestSnapshot = row.snapshotStats?.latestSnapshotId || "none";
    const importRoute = getSupplierBankImportRoute(row.product, row.importedJob);

    console.log(`  ${index + 1}. ${formatEligibilityState(row.gate.state)} | ${productName}`);
    console.log(`     Supplier/key: ${supplierName} / ${row.product.supplier_product_key}`);
    console.log(`     Family/status: ${row.product.product_family} / ${row.product.status}`);
    console.log(`     Import route: ${importRoute}`);
    console.log(`     Snapshots/latest: ${snapshotCount} / ${latestSnapshot}`);
    console.log(`     Latest review: ${reviewStatus}${row.latestReview ? ` (${reviewTarget})` : ""}`);
    console.log(`     Import note: ${row.gate.reason}`);
    if (row.snapshotStats?.latestCreatedAt) {
      console.log(`     Latest snapshot date: ${formatMaybeDate(row.snapshotStats.latestCreatedAt)}`);
    }
    if (row.snapshotStats?.priceMinDkk != null || row.snapshotStats?.priceMaxDkk != null) {
      console.log(
        `     DKK range: ${formatDecisionValue(row.snapshotStats.priceMinDkk)}-${formatDecisionValue(row.snapshotStats.priceMaxDkk)}`
      );
    }
  });
}

function extractExpectedMatrixRows(importSummary) {
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

function extractExpectedSourceRows(importSummary) {
  return extractExpectedMatrixRows(importSummary);
}

function isMatrixPricingType(value) {
  return ["matrix", "MATRIX", "matrix_layout_v1"].includes(String(value || ""));
}

function getImportedDraftIssueLevel(row) {
  if (row.errors.length > 0) return "error";
  if (row.warnings.length > 0) return "warning";
  return "ok";
}

function formatImportedDraftIssueLevel(level) {
  if (level === "error") return "FEJL";
  if (level === "warning") return "ADVARSEL";
  return "OK";
}

async function countProductRowsSafe(client, tableName, productId, options = {}) {
  try {
    return await countProductRows(client, tableName, productId, options);
  } catch (error) {
    if (options.optional) return null;
    throw error;
  }
}

async function getImportedDraftQaContext({ limit }) {
  const client = getSupabaseServiceClient();
  const { data: importJobs, error: importJobsError } = await client
    .from("supplier_bank_import_jobs")
    .select("id,bank_product_id,status,import_mode,target_tenant_id,target_product_id,import_summary,created_at")
    .eq("status", "imported")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (importJobsError) {
    throw new Error(`Supplier-bank import job lookup failed. ${formatSupabaseError(importJobsError)}`);
  }

  const jobs = (importJobs || []).filter((job) => job.target_product_id);
  const productIds = uniqueValues(jobs.map((job) => job.target_product_id));
  const bankProductIds = uniqueValues(jobs.map((job) => job.bank_product_id));
  let products = [];
  let bankProducts = [];
  let suppliers = [];
  let snapshots = [];

  if (productIds.length > 0) {
    const { data: productRows, error: productsError } = await client
      .from("products")
      .select("id,tenant_id,slug,name,is_published,pricing_type,technical_specs,updated_at")
      .in("id", productIds);
    if (productsError) throw new Error(`Imported draft product lookup failed. ${formatSupabaseError(productsError)}`);
    products = productRows || [];
  }

  if (bankProductIds.length > 0) {
    const { data: bankProductRows, error: bankProductsError } = await client
      .from("supplier_bank_products")
      .select("id,supplier_id,supplier_product_key,name_da,name_original,product_family,status")
      .in("id", bankProductIds);
    if (bankProductsError) throw new Error(`Supplier-bank product lookup failed. ${formatSupabaseError(bankProductsError)}`);
    bankProducts = bankProductRows || [];

    const supplierIds = uniqueValues(bankProducts.map((product) => product.supplier_id));
    if (supplierIds.length > 0) {
      const { data: supplierRows, error: suppliersError } = await client
        .from("supplier_bank_suppliers")
        .select("id,name,slug,enabled")
        .in("id", supplierIds);
      if (suppliersError) throw new Error(`Supplier-bank supplier lookup failed. ${formatSupabaseError(suppliersError)}`);
      suppliers = supplierRows || [];
    }

    const { data: snapshotRows, error: snapshotsError } = await client
      .from("supplier_bank_price_snapshots")
      .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
      .in("bank_product_id", bankProductIds)
      .order("created_at", { ascending: false });
    if (snapshotsError) throw new Error(`Supplier-bank price snapshot lookup failed. ${formatSupabaseError(snapshotsError)}`);
    snapshots = snapshotRows || [];
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const bankProductById = new Map(bankProducts.map((product) => [product.id, product]));
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const latestSnapshotByProductId = getLatestByProductId(snapshots);
  const rows = [];

  for (const job of jobs) {
    const product = productById.get(job.target_product_id) || null;
    const bankProduct = bankProductById.get(job.bank_product_id) || null;
    const supplier = bankProduct ? supplierById.get(bankProduct.supplier_id) || null : null;
    const latestSnapshot = latestSnapshotByProductId.get(job.bank_product_id) || null;
    const importSummary = job.import_summary && typeof job.import_summary === "object" ? job.import_summary : {};
    const expectedSourceRows = extractExpectedSourceRows(importSummary);
    const expectedMatrixRows = job.import_mode === "matrix_layout_v1" ? expectedSourceRows : null;
    const errors = [];
    const warnings = [];
    const counts = {
      genericPrices: null,
      storformatMaterials: null,
      storformatFinishes: null,
      storformatVariants: null,
      storformatMaterialTiers: null,
      storformatMaterialM2Prices: null,
      storformatFinishTiers: null,
      storformatFinishPrices: null,
      storformatVariantTiers: null,
      storformatVariantM2Prices: null,
    };

    if (!product) {
      errors.push("Target product no longer exists.");
    } else {
      if (product.is_published) {
        errors.push("Target product is published; supplier-bank imports should remain unpublished until explicit approval.");
      }

      if (job.import_mode === "matrix_layout_v1") {
        if (!isMatrixPricingType(product.pricing_type)) {
          errors.push(`Target product pricing_type is ${product.pricing_type || "missing"}, expected matrix.`);
        }
        counts.genericPrices = await countProductRowsSafe(client, "generic_product_prices", product.id);
        if (counts.genericPrices === 0) {
          errors.push("Matrix draft has zero generic_product_prices rows.");
        }
        if (expectedMatrixRows != null && counts.genericPrices !== expectedMatrixRows) {
          warnings.push(`Matrix price row count ${counts.genericPrices} does not match import summary ${expectedMatrixRows}.`);
        }
      } else if (job.import_mode === "storformat") {
        if (product.pricing_type !== "STORFORMAT") {
          errors.push(`Target product pricing_type is ${product.pricing_type || "missing"}, expected STORFORMAT.`);
        }
        counts.genericPrices = await countProductRowsSafe(client, "generic_product_prices", product.id);
        counts.storformatMaterials = await countProductRowsSafe(client, "storformat_materials", product.id);
        counts.storformatFinishes = await countProductRowsSafe(client, "storformat_finishes", product.id);
        counts.storformatVariants = await countProductRowsSafe(client, "storformat_products", product.id);
        counts.storformatMaterialTiers = await countProductRowsSafe(client, "storformat_material_price_tiers", product.id);
        counts.storformatMaterialM2Prices = await countProductRowsSafe(client, "storformat_m2_prices", product.id);
        counts.storformatFinishTiers = await countProductRowsSafe(client, "storformat_finish_price_tiers", product.id);
        counts.storformatFinishPrices = await countProductRowsSafe(client, "storformat_finish_prices", product.id);
        counts.storformatVariantTiers = await countProductRowsSafe(client, "storformat_product_price_tiers", product.id);
        counts.storformatVariantM2Prices = await countProductRowsSafe(client, "storformat_product_m2_prices", product.id, { ignoreMissingTable: true, optional: true });
        if (counts.storformatMaterials === 0) errors.push("Storformat draft has zero materials.");
        if (counts.storformatVariants === 0) errors.push("Storformat draft has zero variants.");
        if ((counts.genericPrices || 0) > 0) warnings.push(`Storformat draft has ${counts.genericPrices} generic_product_prices rows; expected storformat tables.`);
        const expectedStorformatCounts = importSummary.storformatCounts && typeof importSummary.storformatCounts === "object"
          ? importSummary.storformatCounts
          : null;
        if (expectedStorformatCounts) {
          const comparisons = [
            ["materials", counts.storformatMaterials],
            ["finishes", counts.storformatFinishes],
            ["variants", counts.storformatVariants],
            ["materialTiers", counts.storformatMaterialTiers],
            ["materialM2Prices", counts.storformatMaterialM2Prices],
            ["finishTiers", counts.storformatFinishTiers],
            ["finishPrices", counts.storformatFinishPrices],
            ["variantTiers", counts.storformatVariantTiers],
            ["variantM2Prices", counts.storformatVariantM2Prices],
          ];
          comparisons.forEach(([key, actual]) => {
            const expected = expectedStorformatCounts[key];
            if (expected == null || actual == null) return;
            if (Number(actual) !== Number(expected)) {
              warnings.push(`Storformat ${key} count ${actual} does not match import summary ${expected}.`);
            }
          });
        }
      } else {
        warnings.push(`Unknown import mode: ${job.import_mode || "missing"}.`);
      }

      const expectedSlug = extractProductSlugFromImportJob(job);
      if (expectedSlug && product.slug !== expectedSlug) {
        warnings.push(`Target slug ${product.slug} differs from import summary slug ${expectedSlug}.`);
      }
    }

    if (!bankProduct) warnings.push("Supplier-bank product row was not found for this import job.");
    if (!latestSnapshot) warnings.push("No supplier-bank price snapshot found for this imported product.");

    rows.push({
      job,
      product,
      bankProduct,
      supplier,
      latestSnapshot,
      expectedMatrixRows,
      expectedSourceRows,
      counts,
      errors,
      warnings,
      level: null,
    });
  }

  rows.forEach((row) => {
    row.level = getImportedDraftIssueLevel(row);
  });

  const summary = rows.reduce((acc, row) => {
    acc.checked += 1;
    if (row.level === "error") acc.errors += 1;
    else if (row.level === "warning") acc.warnings += 1;
    else acc.ok += 1;
    if (row.product?.is_published) acc.published += 1;
    if (row.job.import_mode === "matrix_layout_v1") acc.matrix += 1;
    if (row.job.import_mode === "storformat") acc.storformat += 1;
    return acc;
  }, {
    checked: 0,
    ok: 0,
    warnings: 0,
    errors: 0,
    published: 0,
    matrix: 0,
    storformat: 0,
  });

  return { rows, summary };
}

function buildImportedDraftQaMarkdown({ rows, summary }) {
  const lines = [
    "# Supplier Bank Imported Draft QA",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Scope",
    "",
    "- Read-only QA of supplier-bank imported draft products.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "",
    "## Summary",
    "",
    `- Imported drafts checked: ${summary.checked}`,
    `- OK: ${summary.ok}`,
    `- Warnings: ${summary.warnings}`,
    `- Errors: ${summary.errors}`,
    `- Published targets found: ${summary.published}`,
    `- Matrix/storformat imports: ${summary.matrix}/${summary.storformat}`,
    "",
    "## Drafts",
    "",
  ];

  for (const row of rows) {
    const productName = row.product?.name || row.bankProduct?.name_da || row.bankProduct?.name_original || row.job.target_product_id || "unknown";
    const supplierName = row.supplier?.name || row.supplier?.slug || "unknown";
    lines.push(
      `- ${formatImportedDraftIssueLevel(row.level)} | ${productName}`,
      `  - Supplier/key: ${supplierName} / ${row.bankProduct?.supplier_product_key || "unknown"}`,
      `  - Import job: \`${row.job.id}\``,
      `  - Target product: \`${row.product?.id || row.job.target_product_id || "missing"}\``,
      `  - Slug: ${row.product?.slug || "missing"}`,
      `  - Published: ${row.product ? (row.product.is_published ? "yes" : "no") : "unknown"}`,
      `  - Pricing type/import mode: ${row.product?.pricing_type || "missing"} / ${row.job.import_mode || "missing"}`,
      `  - Latest bank snapshot: ${row.latestSnapshot?.id || "none"}`,
      `  - Source rows prepared: ${formatDecisionValue(row.expectedSourceRows)}`,
      `  - Generic price rows: ${formatDecisionValue(row.counts.genericPrices)}`
    );
    if (row.job.import_mode === "matrix_layout_v1") {
      lines.push(`  - Expected matrix rows: ${formatDecisionValue(row.expectedMatrixRows)}`);
    }
    if (row.job.import_mode === "storformat") {
      lines.push(
        `  - Storformat materials/finishes/variants: ${formatDecisionValue(row.counts.storformatMaterials)}/${formatDecisionValue(row.counts.storformatFinishes)}/${formatDecisionValue(row.counts.storformatVariants)}`,
        `  - Storformat tier rows: material ${formatDecisionValue(row.counts.storformatMaterialTiers)}, finish ${formatDecisionValue(row.counts.storformatFinishTiers)}, variant ${formatDecisionValue(row.counts.storformatVariantTiers)}`
      );
    }
    if (row.errors.length > 0) lines.push(`  - Errors: ${row.errors.join(" | ")}`);
    if (row.warnings.length > 0) lines.push(`  - Warnings: ${row.warnings.join(" | ")}`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function runReviewImportedDrafts(args) {
  const parsed = parseArgs(args);
  const limit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 50)));
  const shouldWriteReport = parsed.flags.has("write-report");

  console.log("Supplier bank imported draft QA");
  console.log("  Scope: read-only imported draft integrity audit");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");

  const { rows, summary } = await getImportedDraftQaContext({ limit });

  console.log("");
  console.log("Summary");
  console.log(`  Imported drafts checked: ${summary.checked}`);
  console.log(`  OK: ${summary.ok}`);
  console.log(`  Warnings: ${summary.warnings}`);
  console.log(`  Errors: ${summary.errors}`);
  console.log(`  Published targets found: ${summary.published}`);
  console.log(`  Matrix/storformat imports: ${summary.matrix}/${summary.storformat}`);

  console.log("");
  console.log(`Drafts (${rows.length})`);
  rows.forEach((row, index) => {
    const productName = row.product?.name || row.bankProduct?.name_da || row.bankProduct?.name_original || row.job.target_product_id || "unknown";
    const supplierName = row.supplier?.name || row.supplier?.slug || "unknown";
    console.log(`  ${index + 1}. ${formatImportedDraftIssueLevel(row.level)} | ${productName}`);
    console.log(`     Supplier/key: ${supplierName} / ${row.bankProduct?.supplier_product_key || "unknown"}`);
    console.log(`     Target: ${row.product?.slug || row.job.target_product_id || "missing"} | published ${row.product?.is_published ? "yes" : "no"} | ${row.product?.pricing_type || "missing"} / ${row.job.import_mode || "missing"}`);
    console.log(`     Source rows prepared: ${formatDecisionValue(row.expectedSourceRows)} | generic price rows: ${formatDecisionValue(row.counts.genericPrices)}`);
    if (row.job.import_mode === "matrix_layout_v1") {
      console.log(`     Expected matrix rows: ${formatDecisionValue(row.expectedMatrixRows)}`);
    }
    if (row.job.import_mode === "storformat") {
      console.log(`     Storformat materials/finishes/variants: ${formatDecisionValue(row.counts.storformatMaterials)}/${formatDecisionValue(row.counts.storformatFinishes)}/${formatDecisionValue(row.counts.storformatVariants)}`);
    }
    if (row.errors.length > 0) console.log(`     Errors: ${row.errors.join(" | ")}`);
    if (row.warnings.length > 0) console.log(`     Warnings: ${row.warnings.join(" | ")}`);
  });

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_IMPORTED_DRAFT_QA_${timestampForFile()}.md`);
    const report = buildImportedDraftQaMarkdown({ rows, summary });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST_PATH}`);
  }
}

function formatReadinessSummary(readiness) {
  const value = readiness || { ready: 0, needsApproval: 0, imported: 0, blocked: 0 };
  return `ready:${value.ready} needs_approval:${value.needsApproval} imported:${value.imported} blocked:${value.blocked}`;
}

function buildSupplierBankStatusMarkdown({ coverage, eligibility, importedDraftQa, rankedRows, recommendation, limit, includeArchived, pixartRigidsDecisionState, latestReports }) {
  const generatedAt = new Date().toISOString();
  const displayedRows = eligibility.rows.slice(0, limit);
  const safeRecommendationSteps = (recommendation?.stepCommands || []).filter((item) => !isSupplierBankApprovalWriteCommand(item));
  const approvalRecommendationSteps = (recommendation?.stepCommands || []).filter((item) => isSupplierBankApprovalWriteCommand(item));
  const lines = [
    "# Supplier Bank Status Report",
    "",
    `Generated: ${generatedAt}`,
    `Registry: ${coverage.resolvedPath}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only supplier-bank status report.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product creation or publishing.",
    "- No live pricing writes.",
    "- Salgsmapper/Sales Maba is internal and excluded as an external supplier source.",
    "",
    "## Coverage",
    "",
    `- Registry suppliers: ${coverage.summary.sources}`,
    `- Seeded suppliers: ${coverage.summary.seeded}`,
    `- Sources with bank products: ${coverage.summary.sourcesWithCoverage}`,
    `- Covered families: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`,
    `- Missing families: ${coverage.summary.missingFamilies}`,
    "",
    "## Current Proof Trail",
    "",
    `- Completion audit: \`${latestReports?.completionAudit || "missing"}\``,
    `- Approval packet: \`${latestReports?.approvalPacket || "missing"}\``,
    `- Decision queue: \`${latestReports?.decisionQueue || "missing"}\``,
    `- Executive summary: \`${latestReports?.executiveSummary || "missing"}\``,
    `- Expansion packet: \`${latestReports?.expansionPacket || "missing"}\``,
    `- Gate roadmap: \`${latestReports?.gateRoadmap || "missing"}\``,
    `- URL candidate report: \`${latestReports?.urlCandidates || "missing"}\``,
    `- URL confirmation checklist: \`${latestReports?.urlConfirmationChecklist || "missing"}\``,
    `- Pixart rigids no-write preflight: \`${latestReports?.pixartRigidsPreflight || "missing"}\``,
    `- Print.com placemats no-write preflight: \`${latestReports?.printComPlacematsPreflight || "missing"}\``,
    "",
    "### Supplier Rows",
    "",
  ];

  for (const row of rankedRows) {
    const supplierStatus = row.supplier ? (row.supplier.enabled ? "enabled" : "disabled") : "not seeded";
    const sourceStatus = normalizeText(row.source.status || "candidate");
    lines.push(
      `- ${row.source.name} (${row.source.slug})`,
      `  - Status: ${sourceStatus} / ${supplierStatus}`,
      `  - Action: ${formatExpansionKind(row.actionKind)}`,
      `  - Expected families: ${formatFamilyList(row.expectedFamilies)}`,
      `  - Staged families: ${formatFamilyList(row.stagedFamilies)}`,
      `  - Missing families: ${formatFamilyList(row.missingFamilies)}`,
      `  - Readiness: ${formatReadinessSummary(row.readiness)}`,
      `  - Next: ${row.nextAction}`
    );
  }

  lines.push(
    "",
    "## Import Eligibility",
    "",
    `- Products checked: ${eligibility.summary.checked}`,
    `- Ready now: ${eligibility.summary.ready}`,
    `- Ready after bank approval: ${eligibility.summary.needsApproval}`,
    `- Already imported: ${eligibility.summary.alreadyImported}`,
    `- Blocked: ${eligibility.summary.blocked}`,
    "",
    `### Products (${displayedRows.length} of ${eligibility.rows.length})`,
    ""
  );

  for (const row of displayedRows) {
    const productName = row.product.name_da || row.product.name_original || row.product.supplier_product_key;
    const supplierName = row.supplier?.name || row.supplier?.slug || row.product.supplier_id;
    const reviewStatus = row.latestReview?.status || "none";
    const reviewTarget = row.latestReview?.new_price_snapshot_id === row.snapshotStats?.latestSnapshotId ? "latest" : "not latest";
    const snapshotCount = row.snapshotStats?.count || 0;
    const latestSnapshot = row.snapshotStats?.latestSnapshotId || "none";
    const importRoute = getSupplierBankImportRoute(row.product, row.importedJob);
    const range = row.snapshotStats?.priceMinDkk != null || row.snapshotStats?.priceMaxDkk != null
      ? `${formatDecisionValue(row.snapshotStats.priceMinDkk)}-${formatDecisionValue(row.snapshotStats.priceMaxDkk)}`
      : "unknown";

    lines.push(
      `- ${formatEligibilityState(row.gate.state)} | ${productName}`,
      `  - Supplier/key: ${supplierName} / ${row.product.supplier_product_key}`,
      `  - Family/status: ${row.product.product_family} / ${row.product.status}`,
      `  - Import route: ${importRoute}`,
      `  - Snapshots/latest: ${snapshotCount} / ${latestSnapshot}`,
      `  - Latest review: ${reviewStatus}${row.latestReview ? ` (${reviewTarget})` : ""}`,
      `  - DKK range: ${range}`,
      `  - Import note: ${row.gate.reason}`
    );
  }

  const importedDraftIssues = (importedDraftQa?.rows || []).filter((row) => row.level !== "ok");
  lines.push(
    "",
    "## Imported Draft QA",
    "",
    `- Imported drafts checked: ${importedDraftQa?.summary?.checked ?? "unknown"}`,
    `- OK: ${importedDraftQa?.summary?.ok ?? "unknown"}`,
    `- Warnings: ${importedDraftQa?.summary?.warnings ?? "unknown"}`,
    `- Errors: ${importedDraftQa?.summary?.errors ?? "unknown"}`,
    `- Published targets found: ${importedDraftQa?.summary?.published ?? "unknown"}`,
    `- Matrix/storformat imports: ${importedDraftQa?.summary ? `${importedDraftQa.summary.matrix}/${importedDraftQa.summary.storformat}` : "unknown"}`,
    ""
  );
  if (importedDraftIssues.length > 0) {
    lines.push("### Draft QA Issues", "");
    importedDraftIssues.slice(0, 10).forEach((row) => {
      const productName = row.product?.name || row.bankProduct?.name_da || row.bankProduct?.name_original || row.job.target_product_id || "unknown";
      lines.push(
        `- ${formatImportedDraftIssueLevel(row.level)} | ${productName}`,
        `  - Supplier/key: ${row.supplier?.name || row.supplier?.slug || "unknown"} / ${row.bankProduct?.supplier_product_key || "unknown"}`,
        `  - Target: ${row.product?.slug || row.job.target_product_id || "missing"}`,
        `  - Errors: ${row.errors.join(" | ") || "none"}`,
        `  - Warnings: ${row.warnings.join(" | ") || "none"}`
      );
    });
  } else {
    lines.push("No imported draft QA issues found.");
  }

  lines.push("", "## Recommended Next Step", "");
  if (recommendation) {
    lines.push(
      `Supplier: ${recommendation.source.name} (${recommendation.source.slug})`,
      `Action type: ${formatExpansionKind(recommendation.actionKind)}`,
      `Next action: ${recommendation.nextAction}`,
      "",
      "### Safe/checklist steps",
      ""
    );
    safeRecommendationSteps.forEach((command, index) => {
      lines.push(`${index + 1}. ${command}`);
    });
    if (safeRecommendationSteps.length === 0) {
      lines.push("No safe/checklist step was returned for this recommendation.");
    }
    if (approvalRecommendationSteps.length > 0) {
      lines.push(
        "",
        "### Approval-gated write commands",
        "",
        "Do not run these until explicit supplier-bank write approval is given.",
        ""
      );
      approvalRecommendationSteps.forEach((command, index) => {
        lines.push(`${index + 1}. ${command}`);
      });
    }
    lines.push(
      "",
      "### Recheck commands",
      "",
      "```bash",
      "npm run supplier-bank:review-source-coverage",
      "npm run supplier-bank:review-import-eligibility",
      "npm run supplier-bank:completion-audit",
      "```"
    );
  } else {
    lines.push("No supplier sources found in the registry.");
  }

  if (pixartRigidsDecisionState?.candidatePath) {
    lines.push(
      "",
      "## Pixart Rigids Decision State",
      "",
      `- Candidate: \`${pixartRigidsDecisionState.candidatePath}\``,
      `- Baseline: \`${pixartRigidsDecisionState.baselinePath || "unknown"}\``,
      `- Packet report: \`${pixartRigidsDecisionState.packetPath || "missing"}\``,
      `- Preflight report: \`${pixartRigidsDecisionState.preflightReportPath || "missing"}\``,
      `- Storformat review: \`${pixartRigidsDecisionState.storformatReviewPath || "missing"}\``,
      `- Packet ready: ${pixartRigidsDecisionState.packetReady ? "yes" : "no"}`,
      `- Preflight ready: ${pixartRigidsDecisionState.preflightReady ? "yes" : "no"}`,
      `- Candidate rows/effective rows: \`${pixartRigidsDecisionState.candidateSummary?.rows ?? "unknown"}/${pixartRigidsDecisionState.candidateSummary?.effectiveRows ?? "unknown"}\``,
      `- Candidate categories: ${pixartRigidsDecisionState.candidateSummary?.categories?.join(", ") || "unknown"}`,
      `- Candidate materials: ${pixartRigidsDecisionState.candidateSummary?.materials?.join(", ") || "unknown"}`,
      `- Candidate DKK range: \`${pixartRigidsDecisionState.candidateSummary?.priceMinDkk ?? "unknown"}-${pixartRigidsDecisionState.candidateSummary?.priceMaxDkk ?? "unknown"}\``,
      `- Duplicate keys old/new: \`${pixartRigidsDecisionState.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState.delta?.duplicateNewKeys ?? "unknown"}\``,
      `- Added/removed rows: \`${pixartRigidsDecisionState.delta?.added?.length ?? "unknown"}/${pixartRigidsDecisionState.delta?.removed?.length ?? "unknown"}\``,
      "",
      "Decision: the improved Pixart rigids candidate is prepared for explicit bank-only write approval, but no write has been performed by this report."
    );
  } else if (pixartRigidsDecisionState?.reason) {
    lines.push(
      "",
      "## Pixart Rigids Decision State",
      "",
      `- Not ready: ${pixartRigidsDecisionState.reason}`
    );
  }

  lines.push(
    "",
    "## Guardrails",
    "",
    "- Keep Pixart wide-format products on the storformat path, not the generic Matrix draft importer.",
    "- Pixart rigids candidate data remains local-only until explicit supplier-bank `--write-bank` approval.",
    "- Print.com supplier-bank data must stay separate from POD v2 tables.",
    "- New imported products should stay unpublished drafts unless publishing is explicitly approved.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankStatusReport(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const limit = Math.max(1, Math.floor(parseOptionalPositiveNumber(parsed.values, "limit", 24)));
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({
    registryPath,
    includeArchived,
  });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const rankedRows = [...coverage.rows].sort((left, right) => {
    const priorityDelta = getExpansionPriority(left.actionKind) - getExpansionPriority(right.actionKind);
    if (priorityDelta !== 0) return priorityDelta;
    const missingDelta = right.missingFamilies.length - left.missingFamilies.length;
    if (missingDelta !== 0) return missingDelta;
    return left.source.name.localeCompare(right.source.name);
  });
  const recommendation = rankedRows[0] || null;
  const latestReports = getSupplierBankLatestReportPaths();
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();

  console.log("Supplier bank status report");
  console.log("  Scope: read-only combined coverage/import/planning report");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");

  console.log("");
  console.log("Coverage");
  console.log(`  Suppliers: ${coverage.summary.sources}`);
  console.log(`  Seeded suppliers: ${coverage.summary.seeded}`);
  console.log(`  Covered families: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`);
  console.log(`  Missing families: ${coverage.summary.missingFamilies}`);

  console.log("");
  console.log("Import eligibility");
  console.log(`  Products checked: ${eligibility.summary.checked}`);
  console.log(`  Ready now: ${eligibility.summary.ready}`);
  console.log(`  Ready after bank approval: ${eligibility.summary.needsApproval}`);
  console.log(`  Already imported: ${eligibility.summary.alreadyImported}`);
  console.log(`  Blocked: ${eligibility.summary.blocked}`);

  console.log("");
  console.log("Imported draft QA");
  console.log(`  Drafts checked: ${importedDraftQa.summary.checked}`);
  console.log(`  OK/warnings/errors: ${importedDraftQa.summary.ok}/${importedDraftQa.summary.warnings}/${importedDraftQa.summary.errors}`);
  console.log(`  Published targets found: ${importedDraftQa.summary.published}`);
  console.log(`  Matrix/storformat imports: ${importedDraftQa.summary.matrix}/${importedDraftQa.summary.storformat}`);

  if (recommendation) {
    const safeSteps = (recommendation.stepCommands || []).filter((item) => !isSupplierBankApprovalWriteCommand(item));
    const approvalSteps = (recommendation.stepCommands || []).filter((item) => isSupplierBankApprovalWriteCommand(item));
    console.log("");
    console.log("Recommended next step");
    console.log(`  Supplier: ${recommendation.source.name} (${recommendation.source.slug})`);
    console.log(`  Action type: ${formatExpansionKind(recommendation.actionKind)}`);
    console.log(`  Next action: ${recommendation.nextAction}`);
    console.log("  Safe/checklist steps:");
    safeSteps.forEach((command, index) => {
      console.log(`    ${index + 1}. ${command}`);
    });
    if (approvalSteps.length > 0) {
      console.log("  Approval-gated write commands:");
      approvalSteps.forEach((command, index) => {
        console.log(`    ${index + 1}. ${command}`);
      });
    }
  }

  if (pixartRigidsDecisionState.candidatePath) {
    console.log("");
    console.log("Pixart rigids decision state");
    console.log(`  Candidate: ${pixartRigidsDecisionState.candidatePath}`);
    console.log(`  Packet ready: ${pixartRigidsDecisionState.packetReady ? "yes" : "no"}`);
    console.log(`  Preflight ready: ${pixartRigidsDecisionState.preflightReady ? "yes" : "no"}`);
    console.log(`  Categories: ${pixartRigidsDecisionState.candidateSummary?.categories?.join(", ") || "unknown"}`);
    console.log(`  Duplicate keys old/new: ${pixartRigidsDecisionState.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState.delta?.duplicateNewKeys ?? "unknown"}`);
  } else if (pixartRigidsDecisionState.reason) {
    console.log("");
    console.log("Pixart rigids decision state");
    console.log(`  Not ready: ${pixartRigidsDecisionState.reason}`);
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_STATUS_REPORT_${timestampForFile()}.md`);
    const report = buildSupplierBankStatusMarkdown({
      coverage,
      eligibility,
      importedDraftQa,
      rankedRows,
      recommendation,
      limit,
      includeArchived,
      pixartRigidsDecisionState,
      latestReports,
    });
    fs.writeFileSync(reportPath, report, "utf8");
    fs.writeFileSync(SUPPLIER_BANK_STATUS_REPORT_LATEST_PATH, report, "utf8");
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_STATUS_REPORT_LATEST_PATH}`);
  }
}

function buildSupplierBankDecisionQueue({ coverage, eligibility, importedDraftQa, pixartRigidsDecisionState }) {
  const decisions = [];
  const pixartRigidsRow = eligibility.rows.find((row) => row.product?.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY) || null;
  const printComCoverageRow = coverage.rows.find((row) => row.source.slug === PRINT_COM_SUPPLIER_SLUG) || null;
  const printComOtherStillMissing = Boolean(printComCoverageRow?.missingFamilies?.includes("other"));
  const printComPlacematsPreview = printComOtherStillMissing
    ? findLatestPrintComBankReadyPreview({
        productFamily: "other",
        supplierProductKey: "placemats",
        policyKey: "placemats-a4-landscape-135gsm-coated-4-0",
      })
    : null;

  if (pixartRigidsDecisionState?.preflightReady && pixartRigidsRow?.gate?.state === "blocked") {
    decisions.push({
      priority: "high",
      title: "Pixart rigids bank-only snapshot approval",
      currentState: "Stored bank snapshot is still Plastic-only; local candidate is prepared for Plastic + Plexiglass.",
      evidence: [
        `Candidate: ${pixartRigidsDecisionState.candidatePath}`,
        `Packet: ${pixartRigidsDecisionState.packetPath || "missing"}`,
        `Preflight: ${pixartRigidsDecisionState.preflightReportPath || "run preflight-pixart-rigids-bank-write --write-report"}`,
        `Storformat review: ${pixartRigidsDecisionState.storformatReviewPath || "missing"}`,
        `Candidate rows/effective rows: ${pixartRigidsDecisionState.candidateSummary?.rows ?? "unknown"}/${pixartRigidsDecisionState.candidateSummary?.effectiveRows ?? "unknown"}`,
        `Duplicate keys old/new: ${pixartRigidsDecisionState.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState.delta?.duplicateNewKeys ?? "unknown"}`,
      ],
      options: [
        "Approve the bank-only write of the improved candidate, then create a stored delta review.",
        "Keep the current Plastic-only stored snapshot in review and do not advance rigids.",
      ],
      approvalCommands: [
        [
          "node scripts/supplier-bank-cli.mjs preflight-pixart-rigids-bank-write",
          quoteShellArg(pixartRigidsDecisionState.candidatePath),
          "--baseline",
          quoteShellArg(pixartRigidsDecisionState.baselinePath),
          pixartRigidsDecisionState.packetPath ? "--packet" : null,
          pixartRigidsDecisionState.packetPath ? quoteShellArg(pixartRigidsDecisionState.packetPath) : null,
          "--write-report",
        ].filter(Boolean).join(" "),
        `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot ${quoteShellArg(pixartRigidsDecisionState.candidatePath)} --write-bank`,
        `node scripts/supplier-bank-cli.mjs compare-normalized-snapshots ${quoteShellArg(pixartRigidsDecisionState.baselinePath)} ${quoteShellArg(pixartRigidsDecisionState.candidatePath)} --write-delta-review --notes "Pixart rigids visible-option two-category candidate"`,
      ],
      guardrails: [
        "Writes only supplier-bank snapshot/review rows after explicit approval.",
        "Does not create products, publish products, or write live storefront pricing.",
        "Keep Pixart disabled/candidate and Matrix draft import blocked.",
      ],
    });
  } else if (pixartRigidsRow?.gate?.state === "blocked") {
    decisions.push({
      priority: "medium",
      title: "Pixart rigids still needs no-write preparation",
      currentState: pixartRigidsDecisionState?.reason || pixartRigidsRow.gate.reason,
      evidence: [],
      options: [
        "Run the Pixart rigids candidate packet and preflight before any approval decision.",
        "Keep rigids blocked and continue with other supplier coverage.",
      ],
      approvalCommands: [
        "node scripts/supplier-bank-cli.mjs review-pixart-rigids-candidate-packet --write-report",
        "node scripts/supplier-bank-cli.mjs preflight-pixart-rigids-bank-write",
      ],
      guardrails: [
        "These commands are no-write checks.",
      ],
    });
  }

  if (printComPlacematsPreview) {
    const printComPlacematsPreflightPath = findLatestPrintComPlacematsPreflightReportPath();
    decisions.push({
      priority: "medium",
      title: "Print.com placemats bank-only snapshot approval",
      currentState: "Print.com `other` is still missing from stored supplier-bank coverage, and the local named-policy placemats preview is bank-write-ready.",
      evidence: [
        `Preview: ${printComPlacematsPreview.path}`,
        `Preflight: ${printComPlacematsPreflightPath || "run preflight-print-com-placemats-bank-write --write-report"}`,
        `Policy: ${printComPlacematsPreview.snapshot.policy_key}`,
        `Rows: ${printComPlacematsPreview.summary.rows}/${printComPlacematsPreview.snapshot.valid_row_count}`,
        `Quantities: ${printComPlacematsPreview.summary.quantity_min}-${printComPlacematsPreview.summary.quantity_max}`,
        `DKK range: ${formatDecisionValue(printComPlacematsPreview.summary.price_min_dkk)}-${formatDecisionValue(printComPlacematsPreview.summary.price_max_dkk)}`,
        `Option signatures: ${printComPlacematsPreview.summary.option_signature_count}`,
      ],
      options: [
        "Approve the bank-only write of the local placemats preview so Print.com `other` has a stored first slice.",
        "Keep `placemats` as local evidence only and continue Pixart adapter mapping work.",
      ],
      approvalCommands: [
        "node scripts/supplier-bank-cli.mjs preflight-print-com-placemats-bank-write --write-report",
        `node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot ${quoteShellArg(printComPlacematsPreview.path)} --write-bank`,
      ],
      guardrails: [
        "Writes only Print.com supplier-bank supplier/product/scrape-run/price-snapshot rows after explicit approval.",
        "Does not write POD v2 tables.",
        "Does not create Webprinter products, publish products, or write live storefront pricing.",
      ],
    });
  }

  const draftQaIssues = (importedDraftQa?.rows || []).filter((row) => row.level !== "ok");
  if (draftQaIssues.length > 0) {
    decisions.push({
      priority: "high",
      title: "Imported draft QA issues need correction before publishing decisions",
      currentState: `${draftQaIssues.length} imported draft issue(s) found.`,
      evidence: draftQaIssues.slice(0, 5).map((row) => {
        const productName = row.product?.name || row.bankProduct?.name_da || row.bankProduct?.name_original || row.job.target_product_id || "unknown";
        return `${formatImportedDraftIssueLevel(row.level)} ${productName}: ${[...row.errors, ...row.warnings].join(" | ")}`;
      }),
      options: [
        "Inspect the imported-draft QA report and correct drafts through explicit admin/product workflows.",
        "Do not publish affected imported drafts until the QA report is clean.",
      ],
      approvalCommands: [
        "node scripts/supplier-bank-cli.mjs review-imported-drafts --write-report",
      ],
      guardrails: [
        "Decision queue does not edit products or publish anything.",
      ],
    });
  } else if ((importedDraftQa?.summary?.checked || 0) > 0) {
    decisions.push({
      priority: "low",
      title: "Imported drafts are QA-clean but still unpublished",
      currentState: `${importedDraftQa.summary.checked} imported draft(s) checked; ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.published} published.`,
      evidence: [
        `Matrix/storformat imports: ${importedDraftQa.summary.matrix}/${importedDraftQa.summary.storformat}`,
        "No imported draft QA issues found.",
      ],
      options: [
        "Keep drafts unpublished while supplier-bank coverage and pricing decisions continue.",
        "Review individual drafts in product admin before any separate publishing decision.",
      ],
      approvalCommands: [],
      guardrails: [
        "No publish command is proposed by supplier-bank decision queue.",
      ],
    });
  }

  const coverageGaps = coverage.rows
    .filter((row) => row.missingFamilies.length > 0)
    .map((row) => `${row.source.name}: ${row.missingFamilies.join(", ")}`);
  if (coverageGaps.length > 0) {
    decisions.push({
      priority: "medium",
      title: "Supplier coverage expansion choices",
      currentState: `Missing registered families remain: ${coverage.summary.missingFamilies}.`,
      evidence: coverageGaps,
      options: [
        "Finish the current Pixart rigids approval gate first.",
        "Choose the next supplier/family adapter after rigids is resolved.",
      ],
      approvalCommands: [
        "node scripts/supplier-bank-cli.mjs review-source-coverage",
      ],
      guardrails: [
        "Coverage review is read-only.",
        "Any new supplier extraction should start as local/no-write preview only.",
      ],
    });
  }

  return decisions;
}

function buildSupplierBankDecisionQueueMarkdown({ decisions }) {
  const lines = [
    "# Supplier Bank Decision Queue",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Scope",
    "",
    "- Read-only decision queue for supplier-bank planning.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "",
    "## Summary",
    "",
    `- Decisions listed: ${decisions.length}`,
    `- High priority: ${decisions.filter((decision) => decision.priority === "high").length}`,
    `- Medium priority: ${decisions.filter((decision) => decision.priority === "medium").length}`,
    `- Low priority: ${decisions.filter((decision) => decision.priority === "low").length}`,
    "",
    "## Decisions",
    "",
  ];

  decisions.forEach((decision, index) => {
    lines.push(
      `### ${index + 1}. ${decision.title}`,
      "",
      `Priority: ${decision.priority}`,
      "",
      `Current state: ${decision.currentState}`,
      "",
      "Evidence:",
      ...(decision.evidence.length ? decision.evidence.map((item) => `- ${item}`) : ["- none"]),
      "",
      "Options:",
      ...decision.options.map((item) => `- ${item}`),
      "",
      "Approval commands:",
      ...(decision.approvalCommands.length
        ? [
            "```bash",
            ...decision.approvalCommands,
            "```",
          ]
        : ["- none"]),
      "",
      "Guardrails:",
      ...decision.guardrails.map((item) => `- ${item}`),
      ""
    );
  });

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankDecisionQueue(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });

  console.log("Supplier bank decision queue");
  console.log("  Scope: read-only decision queue");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Decisions listed: ${decisions.length}`);
  console.log(`  High/medium/low: ${decisions.filter((decision) => decision.priority === "high").length}/${decisions.filter((decision) => decision.priority === "medium").length}/${decisions.filter((decision) => decision.priority === "low").length}`);

  console.log("");
  console.log("Decisions");
  decisions.forEach((decision, index) => {
    console.log(`  ${index + 1}. [${decision.priority}] ${decision.title}`);
    console.log(`     ${decision.currentState}`);
    if (decision.approvalCommands.length > 0) {
      console.log("     Commands after approval/check:");
      decision.approvalCommands.forEach((command) => console.log(`       ${command}`));
    }
  });

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_DECISION_QUEUE_${timestampForFile()}.md`);
    const report = buildSupplierBankDecisionQueueMarkdown({ decisions });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_DECISION_QUEUE_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_DECISION_QUEUE_LATEST_PATH}`);
  }
}

function isSupplierBankApprovalWriteCommand(command) {
  return /--write-bank|--write-delta-review|--write-draft-product|--confirm-remote-write|--confirm-bank-write|--confirm-status-update|--confirm-process/.test(command);
}

function splitSupplierBankDecisionCommands(decision) {
  const checks = [];
  const writes = [];
  (decision.approvalCommands || []).forEach((command) => {
    if (isSupplierBankApprovalWriteCommand(command)) {
      writes.push(command);
    } else {
      checks.push(command);
    }
  });
  return { checks, writes };
}

function buildSupplierBankOpenWorkBuckets({
  decisions = [],
  gapRows = [],
  pixartReadinessRows = [],
  importedDraftQa,
  auditItems = [],
}) {
  const approvalDecisions = decisions
    .map((decision) => ({
      decision,
      commands: splitSupplierBankDecisionCommands(decision),
    }))
    .filter(({ commands }) => commands.writes.length > 0);
  const checkOnlyDecisions = decisions
    .filter((decision) => {
      if (decision.priority === "low") return false;
      return splitSupplierBankDecisionCommands(decision).writes.length === 0;
    });
  const approvalDecisionTitles = new Set(approvalDecisions.map(({ decision }) => decision.title));
  const blockedPixartRows = (pixartReadinessRows || []).filter((row) => !row.readyForProbe);
  const readyPixartRows = (pixartReadinessRows || []).filter((row) => row.readyForProbe);
  const engineeringGaps = gapRows.filter((row) => {
    if (row.supplierSlug === PRINT_COM_SUPPLIER_SLUG && row.family === "other") return false;
    return row.status === "adapter_mapping_needed" || row.status === "adapter_needed";
  });
  const previewGaps = gapRows.filter((row) => {
    if (row.supplierSlug === PRINT_COM_SUPPLIER_SLUG && row.family === "other") return false;
    return row.status === "scoping_needed" || row.status === "preview_supported";
  });
  const draftQaClean =
    importedDraftQa?.summary?.checked > 0 &&
    importedDraftQa.summary.errors === 0 &&
    importedDraftQa.summary.warnings === 0 &&
    importedDraftQa.summary.published === 0;
  const openAuditItems = auditItems.filter((item) => item.status !== "proved");

  return [
    {
      key: "business-approval",
      title: "Business approval gates",
      status: approvalDecisions.length > 0 ? "approval_needed" : "clear",
      meaning: approvalDecisions.length > 0
        ? "These can advance only after an exact approval or deferral decision; checks are safe, writes are not automatic."
        : "No write-approval decision is currently proposed.",
      items: approvalDecisions.length
        ? approvalDecisions.map(({ decision, commands }) => {
            const phrases = getSupplierBankDecisionPhrases(decision);
            return [
              `${decision.priority}: ${decision.title}`,
              `safe checks ${commands.checks.length}, approval-only writes ${commands.writes.length}`,
              phrases?.approval ? "exact approve/defer phrase exists" : "no exact phrase mapped",
            ].join(" | ");
          })
        : ["none"],
    },
    {
      key: "engineering-readiness",
      title: "Engineering readiness gates",
      status: engineeringGaps.length || blockedPixartRows.length || checkOnlyDecisions.length ? "work_needed" : "clear",
      meaning: "These need adapter/profile/URL/readiness work before a supplier probe or import discussion is valid.",
      items: [
        ...engineeringGaps.map((row) => `${row.supplierName} / ${row.family}: ${formatCoverageGapStatus(row.status)} - ${row.nextStep}`),
        ...blockedPixartRows.map((row) => `${row.family}: ${row.blockers.join("; ") || "blocked before probe"}`),
        ...checkOnlyDecisions
          .filter((decision) => !approvalDecisionTitles.has(decision.title))
          .map((decision) => `${decision.priority}: ${decision.title} - ${decision.currentState}`),
      ].slice(0, 12),
    },
    {
      key: "local-preview",
      title: "Local preview gates",
      status: previewGaps.length || readyPixartRows.length ? "preview_or_check_needed" : "clear",
      meaning: "These can move only through local/no-write preview or checklist steps first.",
      items: [
        ...previewGaps.map((row) => `${row.supplierName} / ${row.family}: ${formatCoverageGapStatus(row.status)} - ${row.commands[0] || row.nextStep}`),
        ...readyPixartRows.map((row) => `${row.family}: ready for local/no-write probe with confirmed URL ${row.exactSourceUrl}`),
      ].slice(0, 12),
    },
    {
      key: "draft-qa",
      title: "Imported draft QA",
      status: draftQaClean ? "clean" : "attention_needed",
      meaning: "Imported supplier-bank products must remain unpublished drafts until a separate product-admin decision.",
      items: [
        `${importedDraftQa?.summary?.checked || 0} checked`,
        `${importedDraftQa?.summary?.ok || 0} OK`,
        `${importedDraftQa?.summary?.warnings || 0} warnings`,
        `${importedDraftQa?.summary?.errors || 0} errors`,
        `${importedDraftQa?.summary?.published || 0} published`,
      ],
    },
    {
      key: "completion-proof",
      title: "Completion proof",
      status: openAuditItems.length > 0 ? "not_proven" : "proven",
      meaning: "The goal can close only when the completion audit has no open, partial, contradicted, or unverified requirements.",
      items: openAuditItems.length
        ? openAuditItems.map((item) => `${formatCompletionAuditStatus(item.status)}: ${item.requirement}`)
        : ["all audited requirements proved"],
    },
  ].map((bucket) => ({
    ...bucket,
    items: bucket.items.length ? bucket.items : ["none"],
  }));
}

function pushSupplierBankOpenWorkBucketsMarkdown(lines, buckets) {
  lines.push("## Open Work By Gate Type", "");
  buckets.forEach((bucket) => {
    lines.push(
      `### ${bucket.title}`,
      "",
      `Status: ${bucket.status}`,
      `Meaning: ${bucket.meaning}`,
      "",
      "Items:",
      ...bucket.items.map((item) => `- ${item}`),
      ""
    );
  });
}

function getSupplierBankDecisionPhrases(decision) {
  const title = String(decision?.title || "");
  if (/pixart rigids/i.test(title)) return SUPPLIER_BANK_DECISION_PHRASES.pixartRigids;
  if (/print\.com placemats/i.test(title)) return SUPPLIER_BANK_DECISION_PHRASES.printComPlacemats;
  return null;
}

function buildSupplierBankApprovalPacketMarkdown({
  coverage,
  eligibility,
  importedDraftQa,
  decisions,
  auditItems,
  pixartRigidsDecisionState,
  pixartReadinessRows,
  includeArchived,
}) {
  const highDecisions = decisions.filter((decision) => decision.priority === "high");
  const mediumDecisions = decisions.filter((decision) => decision.priority === "medium");
  const lowDecisions = decisions.filter((decision) => decision.priority === "low");
  const openAuditItems = auditItems.filter((item) => item.status !== "proved");
  const candidates = decisions.filter((decision) => splitSupplierBankDecisionCommands(decision).writes.length > 0);
  const checkOnly = decisions.filter((decision) => splitSupplierBankDecisionCommands(decision).writes.length === 0);
  const pixartReadyRows = (pixartReadinessRows || []).filter((row) => row.readyForProbe);
  const lines = [
    "# Supplier Bank Approval Packet",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only approval packet for the supplier product bank.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "- Commands under write approval must not be run until explicit approval is given.",
    "",
    "## Current State",
    "",
    `- Supplier coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered; ${coverage.summary.missingFamilies} missing.`,
    `- Import eligibility: ${eligibility.summary.alreadyImported} already imported, ${eligibility.summary.blocked} blocked, ${eligibility.summary.ready} ready, ${eligibility.summary.needsApproval} needs approval.`,
    `- Imported draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published.`,
    `- Open decisions: ${decisions.length}; high/medium/low: ${highDecisions.length}/${mediumDecisions.length}/${lowDecisions.length}.`,
    `- Open audit requirements: ${openAuditItems.length}.`,
    `- Pixart missing-family readiness: ${pixartReadyRows.length}/${(pixartReadinessRows || []).length} ready for local/no-write probe.`,
    "",
    "## Approval Candidates",
    "",
  ];

  if (candidates.length === 0) {
    lines.push("No write-approval candidates are currently ready in the decision queue.", "");
  } else {
    candidates.forEach((decision, index) => {
      const { checks, writes } = splitSupplierBankDecisionCommands(decision);
      const phrases = getSupplierBankDecisionPhrases(decision);
      lines.push(
        `### ${index + 1}. ${decision.title}`,
        "",
        `Priority: ${decision.priority}`,
        "",
        `Current state: ${decision.currentState}`,
        "",
        "Evidence:",
        ...(decision.evidence.length ? decision.evidence.map((item) => `- ${item}`) : ["- none"]),
        "",
        "Business options:",
        ...decision.options.map((item) => `- ${item}`),
        "",
        "Safe preflight/check commands:",
        ...(checks.length
          ? [
              "```bash",
              ...checks,
              "```",
            ]
          : ["- none"]),
        "",
        "Write commands requiring explicit approval:",
        ...(writes.length
          ? [
              "```bash",
              ...writes,
              "```",
            ]
          : ["- none"]),
        "",
        "Exact business phrases:",
        phrases ? `- Approve: \`${phrases.approval}\`` : "- Approve: none",
        phrases ? `- Defer: \`${phrases.deferral}\`` : "- Defer: none",
        "",
        "Guardrails:",
        ...decision.guardrails.map((item) => `- ${item}`),
        ""
      );
    });
  }

  lines.push("## Check-Only Decisions", "");
  if (checkOnly.length === 0) {
    lines.push("- None.", "");
  } else {
    checkOnly.forEach((decision) => {
      const { checks } = splitSupplierBankDecisionCommands(decision);
      lines.push(
        `### ${decision.title}`,
        "",
        `Priority: ${decision.priority}`,
        "",
        `Current state: ${decision.currentState}`,
        "",
        "Next check commands:",
        ...(checks.length
          ? [
              "```bash",
              ...checks,
              "```",
            ]
          : ["- none"]),
        ""
      );
    });
  }

  lines.push("## Remaining Open Requirements", "");
  if (openAuditItems.length === 0) {
    lines.push("- None.", "");
  } else {
    openAuditItems.forEach((item) => {
      lines.push(
        `- ${formatCompletionAuditStatus(item.status)}: ${item.requirement}`,
        `  Remaining: ${item.remaining}`
      );
    });
  }

  if (pixartRigidsDecisionState?.candidatePath) {
    lines.push(
      "",
      "## Pixart Rigids Evidence",
      "",
      `- Candidate: \`${pixartRigidsDecisionState.candidatePath}\``,
      `- Baseline: \`${pixartRigidsDecisionState.baselinePath || "unknown"}\``,
      `- Packet report: \`${pixartRigidsDecisionState.packetPath || "missing"}\``,
      `- Storformat review: \`${pixartRigidsDecisionState.storformatReviewPath || "missing"}\``,
      `- Packet/preflight ready: ${pixartRigidsDecisionState.packetReady ? "yes" : "no"}/${pixartRigidsDecisionState.preflightReady ? "yes" : "no"}`,
      `- Categories: ${pixartRigidsDecisionState.candidateSummary?.categories?.join(", ") || "unknown"}`,
      `- Materials: ${pixartRigidsDecisionState.candidateSummary?.materials?.join(", ") || "unknown"}`,
      `- Duplicate keys old/new: ${pixartRigidsDecisionState.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState.delta?.duplicateNewKeys ?? "unknown"}`
    );
  }

  lines.push("## Pixart Missing-Family Readiness", "");
  if (!pixartReadinessRows || pixartReadinessRows.length === 0) {
    lines.push("- No missing Pixart readiness rows matched the current registry coverage.", "");
  } else {
    pixartReadinessRows.forEach((row, index) => {
      lines.push(
        `### ${index + 1}. ${row.family}`,
        "",
        `Readiness: ${row.readiness}`,
        "",
        `Extractor profile supported: ${row.isProfileSupported ? "yes" : "no"}`,
        "",
        `Exact Pixart product URL confirmed: ${row.hasExactSourceUrl ? row.exactSourceUrl : "no"}`,
        "",
        "Blockers:",
        ...(row.blockers.length ? row.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
        ""
      );
    });
  }

  lines.push(
    "",
    "## Recommended Decision Order",
    "",
    "1. Review the high-priority Pixart rigids candidate and choose approve or defer.",
    "2. If approved, run only the listed bank-only write command and delta-review command.",
    "3. Review the medium-priority Print.com placemats candidate as the first `other` slice.",
    "4. Keep all imported supplier-bank drafts unpublished until separate product-admin review.",
    "5. Continue missing Pixart families through adapter plans and local/no-write previews.",
    "",
    "## Guardrails",
    "",
    "- Supplier Bank remains separate from POD v1 and POD v2.",
    "- Print.com bank previews must not write POD v2 tables.",
    "- Pixart wide-format products must stay on the STORFORMAT path.",
    "- Sales Maba/Salgsmapper and Onlinetryksager are internal systems, not supplier sources.",
    "- No command in this report publishes products or writes live storefront pricing.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankApprovalPacket(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const pixartReadinessRows = getPixartReadinessRows({ coverage, requestedFamily: "" });
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });
  const auditItems = createSupplierBankCompletionAuditItems({
    coverage,
    eligibility,
    importedDraftQa,
    decisions,
    pixartRigidsDecisionState,
    pixartReadinessRows,
  });
  const approvalCandidates = decisions.filter((decision) => splitSupplierBankDecisionCommands(decision).writes.length > 0);
  const openAuditItems = auditItems.filter((item) => item.status !== "proved");
  const pixartReadyRows = pixartReadinessRows.filter((row) => row.readyForProbe);

  console.log("Supplier bank approval packet");
  console.log("  Scope: read-only approval packet");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered`);
  console.log(`  Missing families: ${coverage.summary.missingFamilies}`);
  console.log(`  Draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`);
  console.log(`  Decisions high/medium/low: ${decisions.filter((decision) => decision.priority === "high").length}/${decisions.filter((decision) => decision.priority === "medium").length}/${decisions.filter((decision) => decision.priority === "low").length}`);
  console.log(`  Approval candidates: ${approvalCandidates.length}`);
  console.log(`  Open audit requirements: ${openAuditItems.length}`);
  console.log(`  Pixart missing-family readiness: ${pixartReadyRows.length}/${pixartReadinessRows.length} ready for local/no-write probe`);

  if (approvalCandidates.length > 0) {
    console.log("");
    console.log("Approval candidates");
    approvalCandidates.forEach((decision, index) => {
      const { checks, writes } = splitSupplierBankDecisionCommands(decision);
      console.log(`  ${index + 1}. [${decision.priority}] ${decision.title}`);
      console.log(`     Checks: ${checks.length}`);
      console.log(`     Write commands requiring approval: ${writes.length}`);
    });
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_APPROVAL_PACKET_${timestampForFile()}.md`);
    const report = buildSupplierBankApprovalPacketMarkdown({
      coverage,
      eligibility,
      importedDraftQa,
      decisions,
      auditItems,
      pixartRigidsDecisionState,
      pixartReadinessRows,
      includeArchived,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_APPROVAL_PACKET_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_APPROVAL_PACKET_LATEST_PATH}`);
  }
}

function buildSupplierBankExpansionPacketMarkdown({
  coverage,
  gapRows,
  pixartAdapterRows,
  pixartReadinessRows,
  decisions,
  importedDraftQa,
  includeArchived,
}) {
  const approvalCandidates = decisions.filter((decision) => splitSupplierBankDecisionCommands(decision).writes.length > 0);
  const pixartGaps = gapRows.filter((row) => row.supplierSlug === "pixartprinting");
  const printComGaps = gapRows.filter((row) => row.supplierSlug === PRINT_COM_SUPPLIER_SLUG);
  const pixartReadyRows = (pixartReadinessRows || []).filter((row) => row.readyForProbe);
  const lines = [
    "# Supplier Bank Expansion Packet",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${coverage.resolvedPath}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only expansion packet for remaining supplier-bank coverage.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "- Any command with a write flag remains excluded from the safe expansion steps until explicit approval.",
    "",
    "## Current State",
    "",
    `- Supplier coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered; ${coverage.summary.missingFamilies} missing.`,
    `- Gap rows: ${gapRows.length}.`,
    `- Pixart gaps: ${pixartGaps.map((row) => row.family).join(", ") || "none"}.`,
    `- Pixart readiness: ${pixartReadyRows.length}/${(pixartReadinessRows || []).length} missing Pixart families ready for local/no-write probe.`,
    `- Print.com gaps: ${printComGaps.map((row) => row.family).join(", ") || "none"}.`,
    `- Imported draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published.`,
    `- Approval candidates still open: ${approvalCandidates.length}.`,
    "",
    "## Expansion Order",
    "",
    "1. Resolve or explicitly defer the current approval candidates in the approval packet.",
    "2. If Print.com `other` stays local-only, keep using the placemats preflight/preview evidence before any bank write.",
    "3. Add Pixart missing families one profile at a time: banners, posters, rollups, labels.",
    "4. For each Pixart family, confirm exact source URL and implement extractor profile support before any probe/extract command.",
    "5. Regenerate the completion audit after each approved bank-only coverage addition.",
    "",
    "## Approval Gates Still Ahead",
    "",
  ];

  if (approvalCandidates.length === 0) {
    lines.push("- No approval candidates currently require a write decision.", "");
  } else {
    approvalCandidates.forEach((decision) => {
      const { checks, writes } = splitSupplierBankDecisionCommands(decision);
      lines.push(
        `### ${decision.title}`,
        "",
        `Priority: ${decision.priority}`,
        "",
        `Current state: ${decision.currentState}`,
        "",
        "Safe checks:",
        ...(checks.length ? checks.map((command) => `- \`${command}\``) : ["- none"]),
        "",
        `Write commands still approval-gated: ${writes.length}`,
        ""
      );
    });
  }

  lines.push("## Missing Family Plan", "");
  if (gapRows.length === 0) {
    lines.push("- No missing registered supplier/product-family gaps found.", "");
  } else {
    gapRows.forEach((row, index) => {
      const { commands, checklist } = splitExpansionPacketItems(row.commands);
      lines.push(
        `### ${index + 1}. ${row.supplierName} / ${row.family}`,
        "",
        `Status: ${formatCoverageGapStatus(row.status)}`,
        "",
        `Next step: ${row.nextStep}`,
        "",
        "Safe commands:",
        ...(commands.length ? ["```bash", ...commands, "```"] : ["- none"]),
        "",
        "Checklist:",
        ...(checklist.length ? checklist.map((item) => `- ${item}`) : ["- none"]),
        ""
      );
    });
  }

  lines.push("## Pixart Readiness Before Probe", "");
  if (!pixartReadinessRows || pixartReadinessRows.length === 0) {
    lines.push("- No Pixart readiness rows matched the current missing coverage.", "");
  } else {
    pixartReadinessRows.forEach((row, index) => {
      lines.push(
        `### ${index + 1}. ${row.family}`,
        "",
        `Readiness: ${row.readiness}`,
        "",
        `Extractor profile supported: ${row.isProfileSupported ? "yes" : "no"}`,
        "",
        `Exact Pixart product URL confirmed: ${row.hasExactSourceUrl ? row.exactSourceUrl : "no"}`,
        "",
        "Blockers:",
        ...(row.blockers.length ? row.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
        ""
      );
    });
  }

  lines.push("## Pixart Adapter Profiles To Create", "");
  if (pixartAdapterRows.length === 0) {
    lines.push("- No Pixart adapter profile rows matched the current missing coverage.", "");
  } else {
    pixartAdapterRows.forEach((row, index) => {
      const { commands, checklist } = splitExpansionPacketItems(row.commands);
      lines.push(
        `### ${index + 1}. ${row.family}`,
        "",
        `Proposed profile: \`${row.proposedProfile}\``,
        `Conversion path: ${row.conversionPath}`,
        `Safe first slice: ${row.firstSlice}`,
        "",
        "Safe commands:",
        ...(commands.length ? ["```bash", ...commands, "```"] : ["- none"]),
        "",
        "Checklist:",
        ...(checklist.length ? checklist.map((item) => `- ${item}`) : ["- none"]),
        ""
      );
    });
  }

  lines.push(
    "## Guardrails",
    "",
    "- Keep Supplier Bank separate from POD v1 and POD v2.",
    "- Do not use Salgsmapper/Sales Maba, Onlinetryksager, Webprinter, or localhost as supplier sources.",
    "- Keep Print.com expansion separate from POD v2 tables.",
    "- Keep Pixart wide-format families on STORFORMAT unless a fixed Matrix shape is explicitly proven.",
    "- Keep imported drafts unpublished until a separate product-admin publishing decision.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function splitExpansionPacketItems(items) {
  const commands = [];
  const checklist = [];
  for (const item of items || []) {
    if (!item || isSupplierBankApprovalWriteCommand(item)) continue;
    const commandMatch = item.match(/\b(?:node|npm)\s+/);
    if (commandMatch) {
      commands.push(item.slice(commandMatch.index).trim());
    } else {
      checklist.push(item);
    }
  }
  return { commands, checklist };
}

async function runSupplierBankExpansionPacket(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });
  const gapRows = getCoverageGapRows({ coverage });
  const pixartAdapterRows = getPixartAdapterPlanRows({ coverage, requestedFamily: "" });
  const pixartReadinessRows = getPixartReadinessRows({ coverage, requestedFamily: "" });
  const approvalCandidates = decisions.filter((decision) => splitSupplierBankDecisionCommands(decision).writes.length > 0);

  console.log("Supplier bank expansion packet");
  console.log("  Scope: read-only remaining-coverage packet");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered`);
  console.log(`  Missing families: ${coverage.summary.missingFamilies}`);
  console.log(`  Gap rows: ${gapRows.length}`);
  console.log(`  Pixart adapter rows: ${pixartAdapterRows.length}`);
  console.log(`  Pixart ready for local/no-write probe: ${pixartReadinessRows.filter((row) => row.readyForProbe).length}/${pixartReadinessRows.length}`);
  console.log(`  Approval candidates still open: ${approvalCandidates.length}`);
  console.log(`  Draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`);
  console.log("");
  console.log("Next safe expansion rows");
  gapRows.forEach((row, index) => {
    const firstSafe = splitExpansionPacketItems(row.commands).commands[0] || "none";
    console.log(`  ${index + 1}. ${row.supplierName} / ${row.family} | ${formatCoverageGapStatus(row.status)}`);
    console.log(`     First safe check: ${firstSafe}`);
  });
  if (gapRows.length === 0) {
    console.log("  None.");
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_EXPANSION_PACKET_${timestampForFile()}.md`);
    const report = buildSupplierBankExpansionPacketMarkdown({
      coverage,
      gapRows,
      pixartAdapterRows,
      pixartReadinessRows,
      decisions,
      importedDraftQa,
      includeArchived,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_EXPANSION_PACKET_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_EXPANSION_PACKET_LATEST_PATH}`);
  }
}

function buildSupplierBankExecutiveSummaryMarkdown({
  coverage,
  eligibility,
  importedDraftQa,
  rankedRows,
  decisions,
  pixartRigidsDecisionState,
  latestReports,
}) {
  const highDecisions = decisions.filter((decision) => decision.priority === "high");
  const mediumDecisions = decisions.filter((decision) => decision.priority === "medium");
  const supplierRows = rankedRows.slice(0, 6);
  const missingRows = rankedRows.filter((row) => row.missingFamilies.length > 0);
  const recommended = rankedRows[0] || null;
  const lines = [
    "# Supplier Bank Executive Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Kort status",
    "",
    `- Leverandører i registry: ${coverage.summary.sources}; seeded i bank: ${coverage.summary.seeded}.`,
    `- Produktfamilier dækket: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}; mangler: ${coverage.summary.missingFamilies}.`,
    `- Bankprodukter tjekket: ${eligibility.summary.checked}; allerede importeret som drafts: ${eligibility.summary.alreadyImported}; blokeret: ${eligibility.summary.blocked}.`,
    `- Importerede drafts QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} advarsler, ${importedDraftQa.summary.errors} fejl; publicerede targets: ${importedDraftQa.summary.published}.`,
    `- Åbne beslutninger: ${decisions.length}; high/medium/low: ${highDecisions.length}/${mediumDecisions.length}/${decisions.filter((decision) => decision.priority === "low").length}.`,
    "",
    "## CEO-konklusion",
    "",
    "- Supplierbanken fungerer som staging- og review-lag, ikke som automatisk webshop-publisher.",
    "- De importerede drafts er strukturelt rene og upublicerede i den seneste QA.",
    "- Den vigtigste forretningsbeslutning er stadig Pixart rigids: hold Plastic-only snapshot i review, eller godkend den forbedrede Plastic+Plexiglass kandidat som bank-only snapshot.",
    "- Næste udvidelser bør starte som lokale/no-write previews, ikke som produktpublicering.",
    "",
    "## Aktuel evidenspakke",
    "",
    `- Completion audit: \`${latestReports?.completionAudit || "missing"}\``,
    `- Approval packet: \`${latestReports?.approvalPacket || "missing"}\``,
    `- Decision queue: \`${latestReports?.decisionQueue || "missing"}\``,
    `- Expansion packet: \`${latestReports?.expansionPacket || "missing"}\``,
    `- Gate roadmap: \`${latestReports?.gateRoadmap || "missing"}\``,
    `- URL candidate report: \`${latestReports?.urlCandidates || "missing"}\``,
    `- URL confirmation checklist: \`${latestReports?.urlConfirmationChecklist || "missing"}\``,
    `- Pixart rigids no-write preflight: \`${latestReports?.pixartRigidsPreflight || "missing"}\``,
    `- Print.com placemats no-write preflight: \`${latestReports?.printComPlacematsPreflight || "missing"}\``,
    "",
    "## Næste beslutning",
    "",
  ];

  if (highDecisions.length > 0) {
    const decision = highDecisions[0];
    lines.push(
      `**${decision.title}**`,
      "",
      decision.currentState,
      "",
      "Valg:",
      ...decision.options.map((option) => `- ${option}`),
      ""
    );
    const { checks, writes } = splitSupplierBankDecisionCommands(decision);
    if (checks.length > 0) {
      lines.push(
        "Safe preflight/check kommandoer:",
        "",
        "```bash",
        ...checks,
        "```",
        ""
      );
    }
    if (writes.length > 0) {
      lines.push(
        "Kommandoer maa kun bruges efter eksplicit approval:",
        "",
        "```bash",
        ...writes,
        "```",
        ""
      );
    }
  } else if (recommended) {
    lines.push(
      `**${recommended.source.name}**`,
      "",
      `${formatExpansionKind(recommended.actionKind)}: ${recommended.nextAction}`,
      ""
    );
  } else {
    lines.push("Ingen aaben high-priority beslutning fundet.", "");
  }

  lines.push(
    "## Næste praktiske trin",
    "",
    "1. Afklar Pixart rigids beslutningen med udgangspunkt i candidate packet og storformat-review.",
    "2. Hvis den forbedrede kandidat godkendes, skriv kun supplier-bank snapshot og opret derefter draft delta review.",
    "3. Hold Pixart rigids på STORFORMAT-sporet; brug ikke generic Matrix import for wide-format/pladematerialer.",
    "4. Gennemgaa de 10 importerede drafts i produktadmin, men publicer ikke automatisk.",
    "5. Efter Pixart gate er løst, vælg næste local/no-write preview for Pixart banners/labels/posters/rollups eller Print.com other.",
    "",
    "## Leverandørstatus",
    ""
  );

  supplierRows.forEach((row) => {
    const supplierStatus = row.supplier ? (row.supplier.enabled ? "enabled" : "disabled") : "not seeded";
    lines.push(
      `- ${row.source.name}`,
      `  - Status: ${normalizeText(row.source.status || "candidate")} / ${supplierStatus}`,
      `  - I banken: ${formatFamilyList(row.stagedFamilies)}`,
      `  - Mangler: ${formatFamilyList(row.missingFamilies)}`,
      `  - Readiness: ${formatReadinessSummary(row.readiness)}`,
      `  - Næste: ${row.nextAction}`
    );
  });

  lines.push("", "## Manglende familier", "");
  if (missingRows.length === 0) {
    lines.push("- Ingen manglende registrerede familier.");
  } else {
    missingRows.forEach((row) => {
      lines.push(`- ${row.source.name}: ${formatFamilyList(row.missingFamilies)}`);
    });
  }

  if (pixartRigidsDecisionState?.candidatePath) {
    lines.push(
      "",
      "## Pixart rigids evidens",
      "",
      `- Candidate: \`${pixartRigidsDecisionState.candidatePath}\``,
      `- Preflight report: \`${pixartRigidsDecisionState.preflightReportPath || "missing"}\``,
      `- Packet report: \`${pixartRigidsDecisionState.packetPath || "missing"}\``,
      `- Packet ready: ${pixartRigidsDecisionState.packetReady ? "yes" : "no"}`,
      `- Preflight ready: ${pixartRigidsDecisionState.preflightReady ? "yes" : "no"}`,
      `- Categories: ${pixartRigidsDecisionState.candidateSummary?.categories?.join(", ") || "unknown"}`,
      `- Materials: ${pixartRigidsDecisionState.candidateSummary?.materials?.join(", ") || "unknown"}`,
      `- Rows/effective rows: ${pixartRigidsDecisionState.candidateSummary?.rows ?? "unknown"}/${pixartRigidsDecisionState.candidateSummary?.effectiveRows ?? "unknown"}`,
      `- DKK range: ${pixartRigidsDecisionState.candidateSummary?.priceMinDkk ?? "unknown"}-${pixartRigidsDecisionState.candidateSummary?.priceMaxDkk ?? "unknown"}`,
      `- Duplicate keys old/new: ${pixartRigidsDecisionState.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState.delta?.duplicateNewKeys ?? "unknown"}`
    );
  }

  lines.push(
    "",
    "## Guardrails",
    "",
    "- Rapporten er read-only.",
    "- Ingen supplier scraping.",
    "- Ingen supplier-bank writes.",
    "- Ingen produktedits, publicering eller live pricing writes.",
    "- Sales Maba/Salgsmapper og Onlinetryksager er interne systemer, ikke eksterne supplier sources.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankExecutiveSummary(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });
  const latestReports = getSupplierBankLatestReportPaths();
  const rankedRows = [...coverage.rows].sort((left, right) => {
    const priorityDelta = getExpansionPriority(left.actionKind) - getExpansionPriority(right.actionKind);
    if (priorityDelta !== 0) return priorityDelta;
    const missingDelta = right.missingFamilies.length - left.missingFamilies.length;
    if (missingDelta !== 0) return missingDelta;
    return left.source.name.localeCompare(right.source.name);
  });

  console.log("Supplier bank executive summary");
  console.log("  Scope: read-only business overview");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Status");
  console.log(`  Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered`);
  console.log(`  Missing families: ${coverage.summary.missingFamilies}`);
  console.log(`  Draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`);
  console.log(`  Decisions high/medium/low: ${decisions.filter((decision) => decision.priority === "high").length}/${decisions.filter((decision) => decision.priority === "medium").length}/${decisions.filter((decision) => decision.priority === "low").length}`);

  const highDecision = decisions.find((decision) => decision.priority === "high");
  if (highDecision) {
    console.log("");
    console.log("Next business decision");
    console.log(`  ${highDecision.title}`);
    console.log(`  ${highDecision.currentState}`);
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_EXECUTIVE_SUMMARY_${timestampForFile()}.md`);
    const report = buildSupplierBankExecutiveSummaryMarkdown({
      coverage,
      eligibility,
      importedDraftQa,
      rankedRows,
      decisions,
      pixartRigidsDecisionState,
      latestReports,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST_PATH}`);
  }
}

function formatCompletionAuditStatus(status) {
  if (status === "proved") return "PROVED";
  if (status === "contradicted") return "CONTRADICTED";
  if (status === "open") return "OPEN";
  return "PARTIAL";
}

function createSupplierBankCompletionAuditItems({
  coverage,
  eligibility,
  importedDraftQa,
  decisions,
  pixartRigidsDecisionState,
  pixartReadinessRows,
}) {
  const rowBySupplierAndKey = new Map();
  for (const row of eligibility.rows) {
    const supplierSlug = row.supplier?.slug || row.supplier?.name || "unknown";
    rowBySupplierAndKey.set(`${supplierSlug}:${row.product.supplier_product_key}`, row);
  }

  const findRow = (supplierSlug, productKey) => rowBySupplierAndKey.get(`${supplierSlug}:${productKey}`) || null;
  const wmdFull = findRow("wir-machen-druck", WMD_FULL_BANK_PRODUCT_KEY);
  const printComKeys = [
    "flyers",
    "businesscards",
    "presentation-folders",
    "printed-letterheads",
    "businesscard-boxes",
    "t-shirt-basic-7",
  ];
  const printComRows = printComKeys.map((key) => findRow("print-com", key)).filter(Boolean);
  const pixartFlat = findRow("pixartprinting", PIXART_FLAT_BANK_PRODUCT_KEY);
  const pixartRigids = findRow("pixartprinting", PIXART_RIGIDS_BANK_PRODUCT_KEY);
  const draftQaClean =
    importedDraftQa.summary.checked > 0 &&
    importedDraftQa.summary.errors === 0 &&
    importedDraftQa.summary.warnings === 0 &&
    importedDraftQa.summary.published === 0;
  const highDecision = decisions.find((decision) => decision.priority === "high") || null;
  const missingCoverageRows = coverage.rows.filter((row) => row.missingFamilies.length > 0);
  const pixartReadinessReadyRows = (pixartReadinessRows || []).filter((row) => row.readyForProbe);
  const pixartReadinessEvidence = (pixartReadinessRows || []).map((row) => {
    const blockerText = row.blockers.length ? row.blockers.join("; ") : "none";
    return `Pixart ${row.family}: ${row.readiness}; blockers: ${blockerText}`;
  });

  return [
    {
      status: coverage.summary.seeded >= coverage.summary.sources && coverage.summary.sources > 0 ? "proved" : "partial",
      requirement: "Supplier registry and internal-source exclusion are established.",
      evidence: [
        `Registry suppliers: ${coverage.summary.sources}`,
        `Seeded suppliers: ${coverage.summary.seeded}`,
        "Internal Webprinter, Sales Maba/Salgsmapper, Onlinetryksager, and localhost are excluded by the registry.",
      ],
      remaining: coverage.summary.seeded >= coverage.summary.sources ? "None for the current registered suppliers." : "Seed or repair missing supplier rows.",
    },
    {
      status: wmdFull?.gate?.state === "already_imported" ? "proved" : "partial",
      requirement: "WIRmachenDRUCK full folder bank is staged and imported as an unpublished draft.",
      evidence: wmdFull
        ? [
            `Gate: ${formatEligibilityState(wmdFull.gate.state)}`,
            `Import route: ${getSupplierBankImportRoute(wmdFull.product, wmdFull.importedJob)}`,
            `Snapshots: ${wmdFull.snapshotStats?.count || 0}`,
            `Latest row range: ${formatDecisionValue(wmdFull.snapshotStats?.quantityMin)}-${formatDecisionValue(wmdFull.snapshotStats?.quantityMax)}`,
            `Target: ${wmdFull.gate.reason}`,
          ]
        : ["No active WMD full-bank eligibility row found."],
      remaining: wmdFull?.gate?.state === "already_imported" ? "None for the current WMD folder draft." : "Review/import WMD full folder bank before claiming completion.",
    },
    {
      status: printComRows.length === printComKeys.length && printComRows.every((row) => row.gate.state === "already_imported") ? "proved" : "partial",
      requirement: "Initial Print.com slices are bank-staged and imported as unpublished Matrix Layout drafts.",
      evidence: [
        `Expected slices: ${printComKeys.join(", ")}`,
        `Found slices: ${printComRows.map((row) => row.product.supplier_product_key).join(", ") || "none"}`,
        `Imported slices: ${printComRows.filter((row) => row.gate.state === "already_imported").length}/${printComKeys.length}`,
      ],
      remaining: printComRows.length === printComKeys.length && printComRows.every((row) => row.gate.state === "already_imported")
        ? "None for the six first-slice Print.com drafts."
        : "Preview/import the missing Print.com first slices as unpublished drafts only.",
    },
    {
      status: pixartFlat?.gate?.state === "already_imported" ? "proved" : "partial",
      requirement: "Pixart flat-surface adhesive uses the STORFORMAT conversion path, not generic Matrix import.",
      evidence: pixartFlat
        ? [
            `Gate: ${formatEligibilityState(pixartFlat.gate.state)}`,
            `Import route: ${getSupplierBankImportRoute(pixartFlat.product, pixartFlat.importedJob)}`,
            `Target: ${pixartFlat.gate.reason}`,
          ]
        : ["No active Pixart flat-surface eligibility row found."],
      remaining: pixartFlat?.gate?.state === "already_imported" ? "None for the current flat-surface draft." : "Run the guarded STORFORMAT draft import only after review.",
    },
    {
      status: draftQaClean ? "proved" : importedDraftQa.summary.published > 0 || importedDraftQa.summary.errors > 0 ? "contradicted" : "partial",
      requirement: "Imported supplier-bank drafts remain clean, unpublished drafts.",
      evidence: [
        `Drafts checked: ${importedDraftQa.summary.checked}`,
        `OK/warnings/errors: ${importedDraftQa.summary.ok}/${importedDraftQa.summary.warnings}/${importedDraftQa.summary.errors}`,
        `Published targets found: ${importedDraftQa.summary.published}`,
        `Matrix/STORFORMAT imports: ${importedDraftQa.summary.matrix}/${importedDraftQa.summary.storformat}`,
      ],
      remaining: draftQaClean ? "None for the latest QA sample." : "Resolve QA warnings/errors or unpublished-state violations before publishing decisions.",
    },
    {
      status: pixartRigidsDecisionState?.preflightReady && pixartRigids?.gate?.state === "blocked" ? "open" : "partial",
      requirement: "Pixart rigids/signs is resolved beyond the first Plastic-only bank baseline.",
      evidence: [
        `Stored gate: ${pixartRigids ? formatEligibilityState(pixartRigids.gate.state) : "missing"}`,
        `Gate reason: ${pixartRigids?.gate?.reason || "missing"}`,
        `Candidate: ${pixartRigidsDecisionState?.candidatePath || "missing"}`,
        `Preflight report: ${pixartRigidsDecisionState?.preflightReportPath || "missing"}`,
        `Packet report: ${pixartRigidsDecisionState?.packetPath || "missing"}`,
        `Packet/preflight ready: ${pixartRigidsDecisionState?.packetReady ? "yes" : "no"}/${pixartRigidsDecisionState?.preflightReady ? "yes" : "no"}`,
        `Candidate rows/effective rows: ${pixartRigidsDecisionState?.candidateSummary?.rows ?? "unknown"}/${pixartRigidsDecisionState?.candidateSummary?.effectiveRows ?? "unknown"}`,
        `Candidate categories: ${pixartRigidsDecisionState?.candidateSummary?.categories?.join(", ") || "unknown"}`,
        `Candidate materials: ${pixartRigidsDecisionState?.candidateSummary?.materials?.join(", ") || "unknown"}`,
        `Candidate DKK range: ${pixartRigidsDecisionState?.candidateSummary?.priceMinDkk ?? "unknown"}-${pixartRigidsDecisionState?.candidateSummary?.priceMaxDkk ?? "unknown"}`,
        `Duplicate keys old/new: ${pixartRigidsDecisionState?.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState?.delta?.duplicateNewKeys ?? "unknown"}`,
      ],
      remaining: "Business approval is still required before the Plastic+Plexiglass candidate can be written as a bank-only snapshot and reviewed.",
    },
    {
      status: coverage.summary.missingFamilies === 0 ? "proved" : "open",
      requirement: "Registered supplier/product-family coverage is complete.",
      evidence: [
        `Covered families: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`,
        `Missing families: ${coverage.summary.missingFamilies}`,
        `Pixart families ready for local/no-write probe: ${pixartReadinessReadyRows.length}/${(pixartReadinessRows || []).length}`,
        ...missingCoverageRows.map((row) => `${row.source.name}: ${row.missingFamilies.join(", ")}`),
        ...pixartReadinessEvidence,
      ],
      remaining: coverage.summary.missingFamilies === 0
        ? "None for registered families."
        : "Create local/no-write previews for the missing families only after readiness blockers are cleared; Pixart families need supported profiles and exact product URLs first.",
    },
    {
      status: highDecision ? "open" : "proved",
      requirement: "No high-priority supplier-bank decision remains open.",
      evidence: highDecision
        ? [
            highDecision.title,
            highDecision.currentState,
            ...highDecision.evidence,
          ]
        : ["No high-priority decisions returned by the decision queue."],
      remaining: highDecision ? "Resolve the high-priority decision using the guarded approval path or keep it explicitly deferred." : "None.",
    },
  ];
}

function buildSupplierBankCompletionAuditMarkdown({
  coverage,
  eligibility,
  importedDraftQa,
  decisions,
  pixartRigidsDecisionState,
  auditItems,
  includeArchived,
}) {
  const counts = auditItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const openItems = auditItems.filter((item) => item.status !== "proved");
  const gapRows = getCoverageGapRows({ coverage });
  const pixartReadinessRows = getPixartReadinessRows({ coverage, requestedFamily: "" });
  const openWorkBuckets = buildSupplierBankOpenWorkBuckets({
    decisions,
    gapRows,
    pixartReadinessRows,
    importedDraftQa,
    auditItems,
  });
  const lines = [
    "# Supplier Bank Completion Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only completion/evidence audit for the supplier product bank goal.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "- This report is evidence-based and intentionally does not mark the overall goal complete while open requirements remain.",
    "",
    "## Overall Verdict",
    "",
    openItems.length === 0
      ? "The audited supplier-bank requirements are proven by current evidence."
      : "The supplier-bank implementation is materially advanced, but the full goal is not complete yet.",
    "",
    "## Summary",
    "",
    `- Requirements audited: ${auditItems.length}`,
    `- Proved: ${counts.proved || 0}`,
    `- Partial: ${counts.partial || 0}`,
    `- Open: ${counts.open || 0}`,
    `- Contradicted: ${counts.contradicted || 0}`,
    `- Supplier coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families`,
    `- Imported-draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`,
    `- Import eligibility: ${eligibility.summary.alreadyImported} already imported, ${eligibility.summary.blocked} blocked, ${eligibility.summary.ready} ready, ${eligibility.summary.needsApproval} needs approval`,
    `- Decision queue: ${decisions.length} decisions, ${decisions.filter((decision) => decision.priority === "high").length} high priority`,
    "",
  ];

  pushSupplierBankOpenWorkBucketsMarkdown(lines, openWorkBuckets);

  lines.push(
    "## Requirement Evidence",
    ""
  );

  auditItems.forEach((item, index) => {
    lines.push(
      `### ${index + 1}. ${formatCompletionAuditStatus(item.status)} - ${item.requirement}`,
      "",
      "Evidence:",
      ...item.evidence.map((evidence) => `- ${evidence}`),
      "",
      `Remaining: ${item.remaining}`,
      ""
    );
  });

  if (pixartRigidsDecisionState?.candidatePath) {
    lines.push(
      "## Pixart Rigids Open Gate",
      "",
      `- Candidate: \`${pixartRigidsDecisionState.candidatePath}\``,
      `- Baseline: \`${pixartRigidsDecisionState.baselinePath || "unknown"}\``,
      `- Packet report: \`${pixartRigidsDecisionState.packetPath || "missing"}\``,
      `- Preflight report: \`${pixartRigidsDecisionState.preflightReportPath || "missing"}\``,
      `- Storformat review: \`${pixartRigidsDecisionState.storformatReviewPath || "missing"}\``,
      "- Required approval command remains intentionally absent from automatic execution.",
      ""
    );
  }

  lines.push(
    "## Next Safe Steps",
    "",
    "1. Decide whether Pixart rigids Plastic+Plexiglass should be written as a bank-only snapshot.",
    "2. If approved, run only the explicit bank-write and delta-review commands from the decision queue.",
    "3. Keep all imported drafts unpublished until product-admin review and a separate publish decision.",
    "4. Start any missing Pixart/Print.com family as local/no-write preview first.",
    "",
    "## Guardrails",
    "",
    "- The audit did not scrape suppliers.",
    "- The audit did not write supplier-bank rows.",
    "- The audit did not create, edit, or publish products.",
    "- The audit did not write live storefront pricing.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankCompletionAudit(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const pixartReadinessRows = getPixartReadinessRows({ coverage, requestedFamily: "" });
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });
  const auditItems = createSupplierBankCompletionAuditItems({
    coverage,
    eligibility,
    importedDraftQa,
    decisions,
    pixartRigidsDecisionState,
    pixartReadinessRows,
  });
  const counts = auditItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const openItems = auditItems.filter((item) => item.status !== "proved");

  console.log("Supplier bank completion audit");
  console.log("  Scope: read-only evidence audit");
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Verdict");
  console.log(openItems.length === 0
    ? "  Audited supplier-bank requirements are proven."
    : "  Supplier-bank is not complete yet; open requirements remain.");
  console.log("");
  console.log("Summary");
  console.log(`  Requirements audited: ${auditItems.length}`);
  console.log(`  Proved/partial/open/contradicted: ${counts.proved || 0}/${counts.partial || 0}/${counts.open || 0}/${counts.contradicted || 0}`);
  console.log(`  Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered`);
  console.log(`  Draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`);
  console.log(`  Decisions high/medium/low: ${decisions.filter((decision) => decision.priority === "high").length}/${decisions.filter((decision) => decision.priority === "medium").length}/${decisions.filter((decision) => decision.priority === "low").length}`);

  console.log("");
  console.log("Open or partial items");
  openItems.forEach((item, index) => {
    console.log(`  ${index + 1}. ${formatCompletionAuditStatus(item.status)} ${item.requirement}`);
    console.log(`     Remaining: ${item.remaining}`);
  });
  if (openItems.length === 0) {
    console.log("  None.");
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_COMPLETION_AUDIT_${timestampForFile()}.md`);
    const report = buildSupplierBankCompletionAuditMarkdown({
      coverage,
      eligibility,
      importedDraftQa,
      decisions,
      pixartRigidsDecisionState,
      auditItems,
      includeArchived,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_COMPLETION_AUDIT_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_COMPLETION_AUDIT_LATEST_PATH}`);
  }
}

function buildSupplierBankGoalSnapshotMarkdown({
  coverage,
  eligibility,
  importedDraftQa,
  decisions,
  pixartRigidsDecisionState,
  pixartReadinessRows,
  auditItems,
  rankedRows,
  latestReports,
  includeArchived,
}) {
  const counts = auditItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const openItems = auditItems.filter((item) => item.status !== "proved");
  const highDecisions = decisions.filter((decision) => decision.priority === "high");
  const approvalDecisions = decisions
    .map((decision) => ({ decision, commands: splitSupplierBankDecisionCommands(decision) }))
    .filter(({ commands }) => commands.writes.length > 0);
  const nextRecommendation = rankedRows[0] || null;
  const pixartReadyCount = (pixartReadinessRows || []).filter((row) => row.readyForProbe).length;
  const gapRows = getCoverageGapRows({ coverage });
  const openWorkBuckets = buildSupplierBankOpenWorkBuckets({
    decisions,
    gapRows,
    pixartReadinessRows,
    importedDraftQa,
    auditItems,
  });

  const lines = [
    "# Supplier Bank Goal Snapshot",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only goal-control snapshot.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "",
    "## Verdict",
    "",
    openItems.length === 0
      ? "The audited supplier-bank goal is currently proven by the available evidence."
      : "The supplier-bank goal is not complete yet. The system is usable for reviewed slices, but remaining approval and coverage gates are still open.",
    "",
    "## Current Numbers",
    "",
    `- Completion audit: ${counts.proved || 0} proved, ${counts.partial || 0} partial, ${counts.open || 0} open, ${counts.contradicted || 0} contradicted`,
    `- Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} registered families covered`,
    `- Missing families: ${coverage.summary.missingFamilies}`,
    `- Import eligibility: ${eligibility.summary.alreadyImported} imported, ${eligibility.summary.blocked} blocked, ${eligibility.summary.ready} ready, ${eligibility.summary.needsApproval} needs approval`,
    `- Imported draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`,
    `- Pixart missing families ready for probe: ${pixartReadyCount}/${(pixartReadinessRows || []).length}`,
    `- Decision queue: ${decisions.length} decisions, ${highDecisions.length} high priority`,
    "",
  ];

  pushSupplierBankOpenWorkBucketsMarkdown(lines, openWorkBuckets);

  lines.push("## Open Gates", "");

  if (openItems.length === 0) {
    lines.push("- None.", "");
  } else {
    openItems.forEach((item) => {
      lines.push(`- ${formatCompletionAuditStatus(item.status)}: ${item.requirement}`);
      lines.push(`  Remaining: ${item.remaining}`);
    });
    lines.push("");
  }

  lines.push("## Next Safe Action", "");
  if (nextRecommendation) {
    const safeSteps = (nextRecommendation.stepCommands || []).filter((item) => !isSupplierBankApprovalWriteCommand(item));
    lines.push(
      `- Supplier: ${nextRecommendation.source.name} (${nextRecommendation.source.slug})`,
      `- Action: ${formatExpansionKind(nextRecommendation.actionKind)}`,
      `- Meaning: ${nextRecommendation.nextAction}`,
      "- Safe/check-only steps:"
    );
    if (safeSteps.length) {
      safeSteps.slice(0, 5).forEach((step) => lines.push(`  - ${step}`));
    } else {
      lines.push("  - Re-run `npm run supplier-bank:review-source-coverage`.");
    }
  } else {
    lines.push("- No supplier sources found in the registry.");
  }

  lines.push(
    "",
    "## Approval-Gated Writes",
    ""
  );
  if (approvalDecisions.length === 0) {
    lines.push("- None currently proposed by the decision queue.", "");
  } else {
    approvalDecisions.forEach(({ decision, commands }) => {
      lines.push(`### ${decision.priority.toUpperCase()} - ${decision.title}`, "");
      lines.push(`State: ${decision.currentState}`, "");
      lines.push("Safe checks:");
      if (commands.checks.length) {
        commands.checks.forEach((command) => lines.push(`- ${command}`));
      } else {
        lines.push("- none");
      }
      lines.push("", "Write commands after explicit approval only:");
      commands.writes.forEach((command) => lines.push(`- ${command}`));
      lines.push("");
    });
  }

  lines.push("## Exact Approval Phrases", "");
  lines.push(`- Pixart rigids: \`${SUPPLIER_BANK_DECISION_PHRASES.pixartRigids.approval}\``);
  lines.push(`- Print.com placemats: \`${SUPPLIER_BANK_DECISION_PHRASES.printComPlacemats.approval}\``);
  lines.push("");
  lines.push("## Exact Deferral Phrases", "");
  lines.push(`- Pixart rigids: \`${SUPPLIER_BANK_DECISION_PHRASES.pixartRigids.deferral}\``);
  lines.push(`- Print.com placemats: \`${SUPPLIER_BANK_DECISION_PHRASES.printComPlacemats.deferral}\``);
  lines.push("");

  if (pixartRigidsDecisionState?.candidatePath) {
    lines.push(
      "## Pixart Rigids Snapshot",
      "",
      `- Candidate: \`${pixartRigidsDecisionState.candidatePath}\``,
      `- Baseline: \`${pixartRigidsDecisionState.baselinePath || "unknown"}\``,
      `- Packet ready: ${pixartRigidsDecisionState.packetReady ? "yes" : "no"}`,
      `- Preflight ready: ${pixartRigidsDecisionState.preflightReady ? "yes" : "no"}`,
      `- Categories: ${pixartRigidsDecisionState.candidateSummary?.categories?.join(", ") || "unknown"}`,
      `- Duplicate keys old/new: ${pixartRigidsDecisionState.delta?.duplicateOldKeys ?? "unknown"}/${pixartRigidsDecisionState.delta?.duplicateNewKeys ?? "unknown"}`,
      ""
    );
  }

  lines.push("## Latest Proof Files", "");
  Object.entries(latestReports || {}).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value ? `\`${value}\`` : "missing"}`);
  });
  lines.push(
    "",
    "## Guardrails",
    "",
    "- Keep Supplier Bank separate from POD v1 and POD v2.",
    "- Do not use Salgsmapper/Sales Maba, Onlinetryksager, Webprinter, or localhost as supplier sources.",
    "- Keep supplier-bank writes bank-only and approval-gated.",
    "- Keep imported drafts unpublished until a separate product-admin decision.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankGoalSnapshot(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const pixartReadinessRows = getPixartReadinessRows({ coverage, requestedFamily: "" });
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });
  const auditItems = createSupplierBankCompletionAuditItems({
    coverage,
    eligibility,
    importedDraftQa,
    decisions,
    pixartRigidsDecisionState,
    pixartReadinessRows,
  });
  const counts = auditItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const openItems = auditItems.filter((item) => item.status !== "proved");
  const rankedRows = [...coverage.rows].sort((left, right) => {
    const priorityDelta = getExpansionPriority(left.actionKind) - getExpansionPriority(right.actionKind);
    if (priorityDelta !== 0) return priorityDelta;
    const missingDelta = right.missingFamilies.length - left.missingFamilies.length;
    if (missingDelta !== 0) return missingDelta;
    return left.source.name.localeCompare(right.source.name);
  });
  const nextRecommendation = rankedRows[0] || null;
  const latestReports = getSupplierBankLatestReportPaths();
  const approvalDecisions = decisions
    .map((decision) => ({ decision, commands: splitSupplierBankDecisionCommands(decision) }))
    .filter(({ commands }) => commands.writes.length > 0);
  const highDecisions = decisions.filter((decision) => decision.priority === "high");

  console.log("Supplier bank goal snapshot");
  console.log("  Scope: read-only goal-control snapshot");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Verdict");
  console.log(openItems.length === 0
    ? "  Audited supplier-bank goal is proven by current evidence."
    : "  Supplier-bank goal is not complete yet; open gates remain.");
  console.log("");
  console.log("Numbers");
  console.log(`  Completion proved/partial/open/contradicted: ${counts.proved || 0}/${counts.partial || 0}/${counts.open || 0}/${counts.contradicted || 0}`);
  console.log(`  Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families covered; ${coverage.summary.missingFamilies} missing`);
  console.log(`  Import eligibility: ${eligibility.summary.alreadyImported} imported, ${eligibility.summary.blocked} blocked, ${eligibility.summary.ready} ready, ${eligibility.summary.needsApproval} needs approval`);
  console.log(`  Draft QA: ${importedDraftQa.summary.ok} OK, ${importedDraftQa.summary.warnings} warnings, ${importedDraftQa.summary.errors} errors, ${importedDraftQa.summary.published} published`);
  console.log(`  Decisions: ${decisions.length} total, ${highDecisions.length} high priority, ${approvalDecisions.length} approval-gated write group(s)`);
  console.log("");
  console.log("Open gates");
  openItems.forEach((item, index) => {
    console.log(`  ${index + 1}. ${formatCompletionAuditStatus(item.status)} ${item.requirement}`);
    console.log(`     Remaining: ${item.remaining}`);
  });
  if (openItems.length === 0) {
    console.log("  None.");
  }

  if (nextRecommendation) {
    const safeSteps = (nextRecommendation.stepCommands || []).filter((item) => !isSupplierBankApprovalWriteCommand(item));
    console.log("");
    console.log("Next safe action");
    console.log(`  Supplier: ${nextRecommendation.source.name} (${nextRecommendation.source.slug})`);
    console.log(`  Action: ${formatExpansionKind(nextRecommendation.actionKind)}`);
    console.log(`  Meaning: ${nextRecommendation.nextAction}`);
    safeSteps.slice(0, 5).forEach((step, index) => {
      console.log(`  ${index + 1}. ${step}`);
    });
    if (safeSteps.length === 0) {
      console.log("  1. npm run supplier-bank:review-source-coverage");
    }
  }

  console.log("");
  console.log("Approval-gated writes");
  if (approvalDecisions.length === 0) {
    console.log("  None currently proposed by the decision queue.");
  } else {
    approvalDecisions.forEach(({ decision, commands }, index) => {
      console.log(`  ${index + 1}. ${decision.priority.toUpperCase()} ${decision.title}`);
      console.log(`     State: ${decision.currentState}`);
      console.log(`     Safe checks: ${commands.checks.length || 0}`);
      console.log(`     Write commands after explicit approval only: ${commands.writes.length}`);
    });
  }

  console.log("");
  console.log("Exact approval phrases");
  console.log(`  Pixart rigids: ${SUPPLIER_BANK_DECISION_PHRASES.pixartRigids.approval}`);
  console.log(`  Print.com placemats: ${SUPPLIER_BANK_DECISION_PHRASES.printComPlacemats.approval}`);
  console.log("");
  console.log("Exact deferral phrases");
  console.log(`  Pixart rigids: ${SUPPLIER_BANK_DECISION_PHRASES.pixartRigids.deferral}`);
  console.log(`  Print.com placemats: ${SUPPLIER_BANK_DECISION_PHRASES.printComPlacemats.deferral}`);

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_GOAL_SNAPSHOT_${timestampForFile()}.md`);
    const report = buildSupplierBankGoalSnapshotMarkdown({
      coverage,
      eligibility,
      importedDraftQa,
      decisions,
      pixartRigidsDecisionState,
      pixartReadinessRows,
      auditItems,
      rankedRows,
      latestReports,
      includeArchived,
    });
    fs.writeFileSync(reportPath, report, "utf8");
    fs.writeFileSync(SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST_PATH, report, "utf8");
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST_PATH}`);
  }
}

function getCoverageGapStatus({ supplierSlug, family }) {
  if (supplierSlug === "pixartprinting") {
    if (family === "signs" || family === "stickers") return "preview_supported";
    return "adapter_mapping_needed";
  }
  if (supplierSlug === PRINT_COM_SUPPLIER_SLUG) {
    if (family === "other") return "scoping_needed";
    return "preview_supported";
  }
  return "adapter_needed";
}

function getCoverageGapCommands({ supplierSlug, supplierName, family }) {
  if (supplierSlug === "pixartprinting") {
    if (family === "signs") {
      return [
        "node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --profile rigids --categories Plastic --limit-materials 1 --limit-areas 1 --limit-quantities 3 --headful --require-valid-rows",
        "node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot <reviewed-preview.json>",
        "node scripts/supplier-bank-cli.mjs preview-pixart-rigids-storformat-import",
      ];
    }
    if (family === "stickers") {
      return [
        "node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --profile flat-surface-adhesive --headful --require-valid-rows",
        "node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot <reviewed-preview.json>",
        "node scripts/supplier-bank-cli.mjs preview-pixart-storformat-import",
      ];
    }
    return [
      `node scripts/supplier-bank-cli.mjs supplier-bank-pixart-adapter-plan --family ${family}`,
      "Read .agents/skills/pixart/SKILL.md before touching Pixart wide-format extraction.",
      `Add or map a Pixart supplier-bank profile for ${family} in scripts/fetch-pixart-flat-surface-adhesive-import.mjs / supplier-bank-cli.mjs.`,
      `Run a local-only probe/extraction for ${family}; save raw and normalized preview JSON only.`,
      "Run write-pixart-bank-snapshot in preview mode only after the local preview passes quality gates.",
    ];
  }

  if (supplierSlug === PRINT_COM_SUPPLIER_SLUG) {
    if (family === "other") {
      return [
        "node scripts/supplier-bank-cli.mjs plan-print-com-bank-slice --family other",
        "node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family other --limit 80 --details-limit 12",
        "Choose a narrow SKU/category from the local catalog preview before adding a named price policy.",
        "Keep Supplier Bank separate from POD v2 tables; do not write bank rows until a named price policy passes validation.",
      ];
    }
    return [
      `node scripts/supplier-bank-cli.mjs plan-print-com-bank-slice --family ${family}`,
      `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family ${family}`,
      "Add a named Print.com price policy only after catalog preview is reviewed.",
    ];
  }

  return [
    `Validate source adapter for ${supplierName || supplierSlug}.`,
    `Create a local/no-write extraction preview for ${family}.`,
    "Do not write supplier-bank rows until the preview is reviewed.",
  ];
}

function getCoverageGapNextStep({ supplierSlug, family, status }) {
  if (status === "adapter_mapping_needed") {
    return `Create a supplier-bank adapter mapping for ${family} before extraction.`;
  }
  if (status === "scoping_needed") {
    return "Run broad catalog discovery, then choose a narrow Print.com SKU/policy before any price preview.";
  }
  if (supplierSlug === "pixartprinting") {
    return "Run the supported Pixart local/no-write preview and keep wide-format conversion on STORFORMAT.";
  }
  return "Run local/no-write catalog discovery and review the normalized preview.";
}

function getCoverageGapRows({ coverage }) {
  const rows = [];
  for (const row of coverage.rows) {
    for (const family of row.missingFamilies) {
      const status = getCoverageGapStatus({
        supplierSlug: row.source.slug,
        family,
      });
      rows.push({
        supplierSlug: row.source.slug,
        supplierName: row.source.name,
        supplierStatus: row.source.status || "candidate",
        supplierEnabled: Boolean(row.supplier?.enabled),
        family,
        status,
        stagedFamilies: [...row.stagedFamilies].sort(),
        nextStep: getCoverageGapNextStep({
          supplierSlug: row.source.slug,
          family,
          status,
        }),
        commands: getCoverageGapCommands({
          supplierSlug: row.source.slug,
          supplierName: row.source.name,
          family,
        }),
      });
    }
  }
  return rows.sort((left, right) => {
    const statusRank = {
      scoping_needed: 0,
      adapter_mapping_needed: 1,
      adapter_needed: 2,
      preview_supported: 3,
    };
    const rankDelta = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
    if (rankDelta !== 0) return rankDelta;
    const supplierDelta = left.supplierName.localeCompare(right.supplierName);
    if (supplierDelta !== 0) return supplierDelta;
    return left.family.localeCompare(right.family);
  });
}

function formatCoverageGapStatus(status) {
  if (status === "preview_supported") return "preview supported";
  if (status === "adapter_mapping_needed") return "adapter mapping needed";
  if (status === "scoping_needed") return "scoping needed";
  return "adapter needed";
}

const PIXART_ADAPTER_FAMILY_PLANS = {
  posters: {
    proposedProfile: "posters",
    productFamily: "posters",
    conversionPath: "STORFORMAT or fixed-format Matrix only after product shape is proven",
    sourceRoute: "Pixart poster / large-format poster page; exact URL still needs confirmation before scraping.",
    firstSlice: "one common poster size or one m2 anchor, one material, quantities 1/2/3",
    notes: [
      "Do not reuse flat-surface adhesive rows as posters; poster paper/material behavior must be probed separately.",
      "Decide whether the final Webprinter product should be STORFORMAT or a fixed-size Matrix product after the first raw snapshot.",
    ],
  },
  banners: {
    proposedProfile: "banners",
    productFamily: "banners",
    conversionPath: "STORFORMAT",
    sourceRoute: "Pixart banner / PVC banner page; exact URL still needs confirmation before scraping.",
    firstSlice: "one banner material, one finish/edge choice, 1 m2, quantities 1/2/3",
    notes: [
      "Banner finishing options such as eyelets, hems, and pole pockets must be explicit attributes, not hidden defaults.",
      "Keep the storformat output separate from the existing adhesive and rigids profiles.",
    ],
  },
  rollups: {
    proposedProfile: "rollups",
    productFamily: "rollups",
    conversionPath: "Matrix Layout or STORFORMAT depending on Pixart option shape",
    sourceRoute: "Pixart roll-up display page; exact URL still needs confirmation before scraping.",
    firstSlice: "one standard width, one material/hardware bundle, quantities 1/2/3",
    notes: [
      "Rollups usually combine printed media and hardware, so hardware/cassette choices must be visible in the normalized rows.",
      "Do not publish or import until the dry-run proves whether pricing is fixed-size or m2-based.",
    ],
  },
  labels: {
    proposedProfile: "labels",
    productFamily: "labels",
    conversionPath: "Matrix Layout or dedicated label model after shape review",
    sourceRoute: "Pixart labels/stickers page; exact URL still needs confirmation before scraping.",
    firstSlice: "one label shape/size/material, one finish, low quantity range",
    notes: [
      "Do not treat the existing flat-surface adhesive profile as label coverage unless the source product is truly the same label SKU.",
      "Labels may need shape, roll/sheet, and quantity-break handling before bank rows are meaningful.",
    ],
  },
};

function getSupplierFamilyUrlCandidates(source, family) {
  const candidatesByFamily = source?.productFamilyUrlCandidates;
  if (!candidatesByFamily || typeof candidatesByFamily !== "object") return [];
  const candidates = candidatesByFamily[family];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((candidate) => {
    if (typeof candidate === "string") {
      return {
        url: candidate,
        status: "candidate_needs_confirmation",
        evidence: "Registry URL candidate; option shape and extractor profile are not confirmed.",
      };
    }
    return {
      url: normalizeText(candidate?.url),
      status: normalizeText(candidate?.status || "candidate_needs_confirmation"),
      evidence: normalizeText(candidate?.evidence || "Registry URL candidate; option shape and extractor profile are not confirmed."),
    };
  }).filter((candidate) => candidate.url);
}

function getConfirmedSupplierFamilyUrlCandidate(source, family) {
  return getSupplierFamilyUrlCandidates(source, family)
    .find((candidate) => candidate.status === "confirmed_source_url") || null;
}

function getPixartAdapterPlanRows({ coverage, requestedFamily }) {
  const registeredPixartRow = coverage.rows.find((row) => row.source.slug === "pixartprinting");
  const missingFamilies = registeredPixartRow?.missingFamilies || [];
  const candidateFamilies = requestedFamily
    ? [requestedFamily]
    : missingFamilies.filter((family) => PIXART_ADAPTER_FAMILY_PLANS[family]);

  return candidateFamilies.map((family) => {
    const plan = PIXART_ADAPTER_FAMILY_PLANS[family] || {
      proposedProfile: family,
      productFamily: family,
      conversionPath: "adapter mapping required",
      sourceRoute: "No Pixart route proposed yet.",
      urlCandidates: [],
      firstSlice: "define one local/no-write first slice before scraping",
      notes: ["Add this family to PIXART_ADAPTER_FAMILY_PLANS before extraction."],
    };
    const isRegistered = registeredPixartRow?.expectedFamilies?.has(family) || false;
    const isMissing = missingFamilies.includes(family);
    const isAlreadyStaged = registeredPixartRow?.stagedFamilies?.has(family) || false;
    const isExtractorProfileSupported = PIXART_EXTRACTOR_PROFILES.has(plan.proposedProfile);
    const isNormalizerProfileSupported = PIXART_SUPPLIER_BANK_NORMALIZER_PROFILES.has(plan.proposedProfile);
    const isProfileSupported = isExtractorProfileSupported && isNormalizerProfileSupported;
    const registryUrlCandidates = getSupplierFamilyUrlCandidates(registeredPixartRow?.source, family);
    const confirmedUrlCandidate = getConfirmedSupplierFamilyUrlCandidate(registeredPixartRow?.source, family);
    const planUrlCandidates = Array.isArray(plan.urlCandidates) ? plan.urlCandidates : [];
    const commands = isProfileSupported
      ? [
        "Read .agents/skills/pixart/SKILL.md and docs/PIXART_IMPORT_RUNBOOK.md before implementation.",
        `Probe only: node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe --profile ${plan.proposedProfile} --url <confirmed-pixart-url> --headful`,
        `Extract local-only first slice: node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract --profile ${plan.proposedProfile} --url <confirmed-pixart-url> --limit-materials 1 --limit-areas 1 --limit-quantities 3 --headful`,
        `Normalize local preview only: node scripts/supplier-bank-cli.mjs normalize-pixart-extraction-preview pricing_raw/pixart-${plan.proposedProfile}-<timestamp>.json --profile ${plan.proposedProfile}`,
        "Run write-pixart-bank-snapshot in preview mode only after quality gates pass; do not add --write-bank without explicit approval.",
      ]
      : [
        "Read .agents/skills/pixart/SKILL.md and docs/PIXART_IMPORT_RUNBOOK.md before implementation.",
        `Current extractor support: ${isExtractorProfileSupported ? "implemented" : `profile ${plan.proposedProfile} is not implemented yet`}; do not run probe/extract until this is yes.`,
        `Current supplier-bank normalizer support: ${isNormalizerProfileSupported ? "implemented" : `profile ${plan.proposedProfile} is not implemented yet`}; do not normalize or write previews until this is yes.`,
        "Confirm the exact Pixart product URL and product option shape before adding a profile.",
        `Add a no-write Pixart profile mapping for ${plan.proposedProfile} in scripts/fetch-pixart-flat-surface-adhesive-import.mjs and scripts/supplier-bank-cli.mjs.`,
        `Map ${plan.proposedProfile} to supplier-bank family ${plan.productFamily}, source snapshot prefixes, Danish labels, row keys, and quality gates before extraction.`,
        `After profile support exists, rerun this plan and then run pixart-bank-first-slice --profile ${plan.proposedProfile} only as a local/no-write preview.`,
        "Run write-pixart-bank-snapshot in preview mode only after a local preview passes quality gates; do not add --write-bank without explicit approval.",
      ];
    return {
      family,
      ...plan,
      urlCandidates: registryUrlCandidates.length ? registryUrlCandidates : planUrlCandidates,
      confirmedSourceUrl: confirmedUrlCandidate?.url || "",
      confirmedSourceUrlStatus: confirmedUrlCandidate?.status || "",
      isRegistered,
      isMissing,
      isAlreadyStaged,
      isExtractorProfileSupported,
      isNormalizerProfileSupported,
      isProfileSupported,
      commands,
    };
  });
}

function buildSupplierBankPixartAdapterPlanMarkdown({ coverage, rows, includeArchived, requestedFamily }) {
  const lines = [
    "# Supplier Bank Pixart Adapter Mapping Plan",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${coverage.resolvedPath}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    `Family filter: ${requestedFamily || "missing Pixart adapter families"}`,
    "",
    "## Scope",
    "",
    "- Read-only mapping plan for Pixart supplier-bank coverage gaps.",
    "- No Pixart probing or scraping.",
    "- No supplier-bank writes.",
    "- No product creation, product publishing, or live pricing writes.",
    "- Existing implemented mappings remain `flat-surface-adhesive -> stickers` and `rigids -> signs`.",
    "",
    "## Summary",
    "",
    `- Planned families: ${rows.length}`,
    `- Registered missing families planned: ${rows.filter((row) => row.isRegistered && row.isMissing).length}`,
    `- Already staged families in this plan: ${rows.filter((row) => row.isAlreadyStaged).length}`,
    `- Extractor-supported profiles: ${rows.filter((row) => row.isExtractorProfileSupported).length}`,
    `- Normalizer-supported profiles: ${rows.filter((row) => row.isNormalizerProfileSupported).length}`,
    `- Confirmed exact URL candidates: ${rows.filter((row) => row.confirmedSourceUrl).length}`,
    "",
    "## Mapping Plan",
    "",
  ];

  if (rows.length === 0) {
    lines.push("No Pixart adapter-mapping rows matched the current filter.", "");
  }

  rows.forEach((row, index) => {
    lines.push(
      `### ${index + 1}. ${row.family}`,
      "",
      `Registered in source registry: ${row.isRegistered ? "yes" : "no"}`,
      `Currently missing coverage: ${row.isMissing ? "yes" : "no"}`,
      `Already staged: ${row.isAlreadyStaged ? "yes" : "no"}`,
      `Extractor supports profile: ${row.isExtractorProfileSupported ? "yes" : "no"}`,
      `Supplier-bank normalizer supports profile: ${row.isNormalizerProfileSupported ? "yes" : "no"}`,
      `End-to-end local preview profile ready: ${row.isProfileSupported ? "yes" : "no"}`,
      `Proposed profile: \`${row.proposedProfile}\``,
      `Product family: \`${row.productFamily}\``,
      `Conversion path: ${row.conversionPath}`,
      `Source route: ${row.sourceRoute}`,
      `Confirmed exact URL: ${row.confirmedSourceUrl || "no"}`,
      `Safe first slice: ${row.firstSlice}`,
      "",
      "Official URL candidates:",
      ...(row.urlCandidates.length
        ? row.urlCandidates.map((candidate) => `- ${candidate.url} (${candidate.status}) - ${candidate.evidence}`)
        : ["- none recorded"]),
      "",
      "Notes:",
      ...row.notes.map((note) => `- ${note}`),
      "",
      "Commands / checklist:",
      ...row.commands.map((command) => `- ${command}`),
      ""
    );
  });

  lines.push(
    "## Global Gates",
    "",
    "- Confirm the exact Pixart product URL before any probe or extraction.",
    "- Save raw extraction and normalized preview JSON before any bank write discussion.",
    "- Preserve original supplier terms and Danish labels in normalized rows.",
    "- Prove valid rows equal attempted rows for the first slice.",
    "- Reject stale/duplicate price series using the existing Pixart quality gates.",
    "- Keep Pixart wide-format conversion on the STORFORMAT path unless a fixed-format Matrix shape is explicitly proven.",
    "- Never scrape Webprinter, Salgsmapper/Sales Maba, Onlinetryksager, or localhost as supplier sources.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankPixartAdapterPlan(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const requestedFamily = normalizeText(parsed.values.family || "");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const rows = getPixartAdapterPlanRows({
    coverage,
    requestedFamily: requestedFamily || "",
  });

  console.log("Supplier bank Pixart adapter mapping plan");
  console.log("  Scope: read-only Pixart adapter mapping plan");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Family filter: ${requestedFamily || "missing Pixart adapter families"}`);
  console.log("  Pixart probes/scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Planned families: ${rows.length}`);
  console.log(`  Registered missing families planned: ${rows.filter((row) => row.isRegistered && row.isMissing).length}`);
  console.log(`  Extractor-supported profiles: ${rows.filter((row) => row.isExtractorProfileSupported).length}`);
  console.log(`  Normalizer-supported profiles: ${rows.filter((row) => row.isNormalizerProfileSupported).length}`);
  console.log(`  Confirmed exact URL candidates: ${rows.filter((row) => row.confirmedSourceUrl).length}`);
  console.log("");
  console.log("Mappings");
  rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.family} -> profile ${row.proposedProfile} | ${row.conversionPath}`);
    console.log(`     First slice: ${row.firstSlice}`);
    console.log(`     Extractor/normalizer support: ${row.isExtractorProfileSupported ? "yes" : "no"}/${row.isNormalizerProfileSupported ? "yes" : "no"}`);
    console.log(`     URL candidates: ${row.urlCandidates.length}`);
    console.log(`     Confirmed exact URL: ${row.confirmedSourceUrl ? "yes" : "no"}`);
    console.log(`     First check: ${row.commands[0]}`);
  });
  if (rows.length === 0) {
    console.log("  None.");
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportScope = slugify(requestedFamily || "missing-pixart-families");
    const reportPath = path.join("docs", `SUPPLIER_BANK_PIXART_ADAPTER_PLAN_${reportScope}_${timestampForFile()}.md`);
    const report = buildSupplierBankPixartAdapterPlanMarkdown({
      coverage,
      rows,
      includeArchived,
      requestedFamily: requestedFamily || "",
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST_PATH}`);
  }
}

function getPixartReadinessRows({ coverage, requestedFamily }) {
  return getPixartAdapterPlanRows({ coverage, requestedFamily }).map((row) => {
    const exactSourceUrl = normalizeText(row.exactSourceUrl || row.confirmedSourceUrl || "");
    const hasExactSourceUrl = Boolean(exactSourceUrl);
    const urlCandidates = Array.isArray(row.urlCandidates) ? row.urlCandidates : [];
    const readyForProbe = row.isProfileSupported && hasExactSourceUrl;
    const blockers = [];

    if (!row.isRegistered) blockers.push("not registered in Pixart supplier family registry");
    if (!row.isMissing && !row.isAlreadyStaged) blockers.push("not currently a missing registered family");
    if (!row.isExtractorProfileSupported) blockers.push(`extractor profile '${row.proposedProfile}' is not implemented in scripts/fetch-pixart-flat-surface-adhesive-import.mjs`);
    if (!row.isNormalizerProfileSupported) blockers.push(`supplier-bank normalizer profile '${row.proposedProfile}' is not implemented in scripts/supplier-bank-cli.mjs`);
    if (!hasExactSourceUrl) blockers.push("exact Pixart product URL is not confirmed");
    if (row.isAlreadyStaged) blockers.push("family already has staged coverage; use review/import gates instead of first-slice planning");

    return {
      ...row,
      exactSourceUrl,
      hasExactSourceUrl,
      urlCandidates,
      readyForProbe,
      blockers,
      readiness: readyForProbe ? "ready_for_local_probe" : "blocked_before_probe",
    };
  });
}

function buildSupplierBankPixartReadinessMarkdown({ coverage, rows, includeArchived, requestedFamily }) {
  const readyRows = rows.filter((row) => row.readyForProbe);
  const lines = [
    "# Supplier Bank Pixart Readiness Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${coverage.resolvedPath}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    `Family filter: ${requestedFamily || "missing Pixart adapter families"}`,
    "",
    "## Scope",
    "",
    "- Read-only readiness check for missing Pixart supplier-bank families.",
    "- No Pixart probing or scraping.",
    "- No supplier-bank writes.",
    "- No product creation, publishing changes, or live pricing writes.",
    "- A Pixart first-slice probe is allowed only after extractor support, supplier-bank normalizer support, and exact Pixart product URL are confirmed.",
    "",
    "## Summary",
    "",
    `- Families checked: ${rows.length}`,
    `- Ready for local/no-write probe: ${readyRows.length}`,
    `- Blocked before probe: ${rows.length - readyRows.length}`,
    `- Extractor-supported profiles: ${rows.filter((row) => row.isExtractorProfileSupported).length}`,
    `- Normalizer-supported profiles: ${rows.filter((row) => row.isNormalizerProfileSupported).length}`,
    `- Confirmed exact URL candidates: ${rows.filter((row) => row.hasExactSourceUrl).length}`,
    "",
    "## Family Readiness",
    "",
  ];

  if (rows.length === 0) {
    lines.push("No Pixart readiness rows matched the current filter.", "");
  }

  rows.forEach((row, index) => {
    lines.push(
      `### ${index + 1}. ${row.family}`,
      "",
      `Readiness: ${row.readiness}`,
      `Registered: ${row.isRegistered ? "yes" : "no"}`,
      `Missing coverage: ${row.isMissing ? "yes" : "no"}`,
      `Already staged: ${row.isAlreadyStaged ? "yes" : "no"}`,
      `Proposed profile: \`${row.proposedProfile}\``,
      `Extractor supports profile: ${row.isExtractorProfileSupported ? "yes" : "no"}`,
      `Supplier-bank normalizer supports profile: ${row.isNormalizerProfileSupported ? "yes" : "no"}`,
      `End-to-end local preview profile ready: ${row.isProfileSupported ? "yes" : "no"}`,
      `Exact Pixart product URL confirmed: ${row.hasExactSourceUrl ? row.exactSourceUrl : "no"}`,
      `Exact URL confirmation status: ${row.confirmedSourceUrlStatus || "none"}`,
      `Source route note: ${row.sourceRoute}`,
      `Official URL candidates recorded: ${row.urlCandidates.length}`,
      `Conversion path: ${row.conversionPath}`,
      "",
      "Official URL candidates:",
      ...(row.urlCandidates.length
        ? row.urlCandidates.map((candidate) => `- ${candidate.url} (${candidate.status}) - ${candidate.evidence}`)
        : ["- none recorded"]),
      "",
      "Blockers:",
      ...(row.blockers.length ? row.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
      "",
      "Next safe action:",
      row.readyForProbe
        ? `- Run a local/no-write first slice with \`pixart-bank-first-slice --profile ${row.proposedProfile} --url ${row.exactSourceUrl}\`.`
        : `- Complete the blocker list before any Pixart probe/extract command for \`${row.proposedProfile}\`.`,
      ""
    );
  });

  lines.push(
    "## Guardrails",
    "",
    "- Do not infer exact product URLs from Pixart category labels.",
    "- Do not run `probe`, `extract`, or normalization with unsupported Pixart profiles.",
    "- Do not use Salgsmapper/Sales Maba, Onlinetryksager, Webprinter, or localhost as supplier sources.",
    "- Keep any future successful preview local-only until reviewed; add `--write-bank` only after explicit approval.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankPixartReadinessReport(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const requestedFamily = normalizeText(parsed.values.family || "");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const rows = getPixartReadinessRows({
    coverage,
    requestedFamily: requestedFamily || "",
  });
  const readyRows = rows.filter((row) => row.readyForProbe);

  console.log("Supplier bank Pixart readiness report");
  console.log("  Scope: read-only Pixart readiness check");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Family filter: ${requestedFamily || "missing Pixart adapter families"}`);
  console.log("  Pixart probes/scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Families checked: ${rows.length}`);
  console.log(`  Ready for local/no-write probe: ${readyRows.length}`);
  console.log(`  Blocked before probe: ${rows.length - readyRows.length}`);
  console.log(`  Extractor-supported profiles: ${rows.filter((row) => row.isExtractorProfileSupported).length}`);
  console.log(`  Normalizer-supported profiles: ${rows.filter((row) => row.isNormalizerProfileSupported).length}`);
  console.log(`  Confirmed exact URL candidates: ${rows.filter((row) => row.hasExactSourceUrl).length}`);
  console.log("");
  console.log("Rows");
  rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.family} | ${row.readiness}`);
    console.log(`     Extractor/normalizer support: ${row.isExtractorProfileSupported ? "yes" : "no"}/${row.isNormalizerProfileSupported ? "yes" : "no"}`);
    console.log(`     Exact URL confirmed: ${row.hasExactSourceUrl ? "yes" : "no"}`);
    console.log(`     URL candidates: ${row.urlCandidates.length}`);
    console.log(`     First blocker: ${row.blockers[0] || "none"}`);
  });
  if (rows.length === 0) {
    console.log("  None.");
  }

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportScope = slugify(requestedFamily || "missing-pixart-families");
    const reportPath = path.join("docs", `SUPPLIER_BANK_PIXART_READINESS_${reportScope}_${timestampForFile()}.md`);
    const report = buildSupplierBankPixartReadinessMarkdown({
      coverage,
      rows,
      includeArchived,
      requestedFamily: requestedFamily || "",
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_PIXART_READINESS_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_PIXART_READINESS_LATEST_PATH}`);
  }
}

function buildSupplierBankCoverageGapPlanMarkdown({ coverage, gapRows, includeArchived }) {
  const counts = gapRows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const lines = [
    "# Supplier Bank Coverage Gap Plan",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${coverage.resolvedPath}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only plan for missing registered supplier/product families.",
    "- No supplier scraping.",
    "- No supplier-bank writes.",
    "- No product edits, publishing changes, or live pricing writes.",
    "- Commands listed here are planning or local/no-write preview commands unless they explicitly say otherwise.",
    "",
    "## Summary",
    "",
    `- Covered families: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`,
    `- Missing families: ${coverage.summary.missingFamilies}`,
    `- Gap rows: ${gapRows.length}`,
    `- Scoping needed: ${counts.scoping_needed || 0}`,
    `- Adapter mapping needed: ${counts.adapter_mapping_needed || 0}`,
    `- Adapter needed: ${counts.adapter_needed || 0}`,
    `- Preview supported: ${counts.preview_supported || 0}`,
    "",
    "## Gap Plan",
    "",
  ];

  if (gapRows.length === 0) {
    lines.push("No missing registered supplier/product-family gaps found.", "");
  }

  gapRows.forEach((row, index) => {
    lines.push(
      `### ${index + 1}. ${row.supplierName} / ${row.family}`,
      "",
      `Status: ${formatCoverageGapStatus(row.status)}`,
      "",
      `Supplier state: ${row.supplierStatus} / ${row.supplierEnabled ? "enabled" : "disabled"}`,
      "",
      `Already staged families: ${row.stagedFamilies.join(", ") || "none"}`,
      "",
      `Next step: ${row.nextStep}`,
      "",
      "Commands / checklist:",
      "```bash",
      ...row.commands,
      "```",
      ""
    );
  });

  lines.push(
    "## Recommended Order",
    "",
    "1. Resolve or explicitly defer the Pixart rigids Plastic+Plexiglass bank-only decision.",
    "2. Run Print.com `other` catalog scoping, because it can start as a no-write API preview.",
    "3. Add Pixart adapter mappings one family at a time for banners, labels, posters, and rollups.",
    "4. For each new family, save local raw and normalized previews before any bank write.",
    "",
    "## Guardrails",
    "",
    "- Do not use Salgsmapper/Sales Maba, Onlinetryksager, Webprinter, or localhost as supplier sources.",
    "- Keep Print.com Supplier Bank data separate from POD v2 tables.",
    "- Keep Pixart wide-format products on the STORFORMAT conversion path.",
    "- Do not publish imported drafts from coverage work.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankCoverageGapPlan(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const gapRows = getCoverageGapRows({ coverage });
  const counts = gapRows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  console.log("Supplier bank coverage gap plan");
  console.log("  Scope: read-only missing-family plan");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier scrapes: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Covered families: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`);
  console.log(`  Missing families: ${coverage.summary.missingFamilies}`);
  console.log(`  Gap rows: ${gapRows.length}`);
  console.log(`  Scoping/adapter mapping/adapter/preview: ${counts.scoping_needed || 0}/${counts.adapter_mapping_needed || 0}/${counts.adapter_needed || 0}/${counts.preview_supported || 0}`);
  console.log("");
  console.log("Gaps");
  gapRows.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.supplierName} / ${row.family} | ${formatCoverageGapStatus(row.status)}`);
    console.log(`     Next: ${row.nextStep}`);
    if (row.commands.length > 0) console.log(`     First command/check: ${row.commands[0]}`);
  });

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_COVERAGE_GAP_PLAN_${timestampForFile()}.md`);
    const report = buildSupplierBankCoverageGapPlanMarkdown({
      coverage,
      gapRows,
      includeArchived,
    });
    writeReportAndLatest(reportPath, report, SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST_PATH);
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST_PATH}`);
  }
}

function buildSupplierBankGateRoadmapItems({
  coverage,
  eligibility,
  importedDraftQa,
  decisions,
  gapRows,
  pixartReadinessRows,
  urlCandidateSummary,
  latestReports,
}) {
  const items = [];
  const highDecision = decisions.find((decision) => decision.priority === "high") || null;
  const pixartRigidsDecision = highDecision || decisions.find((decision) => /pixart rigids/i.test(decision.title || "")) || null;
  const printComOtherGap = gapRows.find((row) => row.supplierSlug === PRINT_COM_SUPPLIER_SLUG && row.family === "other") || null;
  const pixartMissingGaps = gapRows.filter((row) => row.supplierSlug === "pixartprinting");
  const blockedPixartRows = (pixartReadinessRows || []).filter((row) => !row.readyForProbe);
  const readyPixartRows = (pixartReadinessRows || []).filter((row) => row.readyForProbe);
  const draftQaClean =
    importedDraftQa.summary.checked > 0 &&
    importedDraftQa.summary.errors === 0 &&
    importedDraftQa.summary.warnings === 0 &&
    importedDraftQa.summary.published === 0;
  const safeDecisionSteps = (pixartRigidsDecision?.approvalCommands || []).filter((command) => !isSupplierBankApprovalWriteCommand(command));
  const approvalDecisionSteps = (pixartRigidsDecision?.approvalCommands || []).filter((command) => isSupplierBankApprovalWriteCommand(command));
  const pixartDecisionPhrases = pixartRigidsDecision ? getSupplierBankDecisionPhrases(pixartRigidsDecision) : null;

  if (pixartRigidsDecision) {
    items.push({
      order: 1,
      priority: pixartRigidsDecision.priority || "medium",
      status: highDecision ? "approval_needed" : "preparation_needed",
      title: "Resolve Pixart rigids/signs bank snapshot decision",
      why: "This is the current high-priority gate because stored rigids coverage is still behind the reviewed local Plastic+Plexiglass candidate.",
      evidence: [
        pixartRigidsDecision.currentState || "Pixart rigids decision remains open.",
        ...(pixartRigidsDecision.evidence || []),
        `Latest preflight: ${latestReports.pixartRigidsPreflight || "missing"}`,
        `Latest approval packet: ${latestReports.approvalPacket || "missing"}`,
      ],
      blockers: highDecision ? ["Explicit business approval is required before any bank-only write."] : ["No high-priority Pixart rigids approval item is currently ready."],
      safeSteps: safeDecisionSteps.length ? safeDecisionSteps : [
        "npm run supplier-bank:pixart-rigids-candidate-packet",
        "npm run supplier-bank:pixart-rigids-bank-write-preflight:write",
      ],
      approvalSteps: approvalDecisionSteps,
      approvalPhrase: pixartDecisionPhrases?.approval || null,
      deferralPhrase: pixartDecisionPhrases?.deferral || null,
    });
  }

  if (printComOtherGap) {
    const printComDecision = decisions.find((decision) => /print\.com placemats/i.test(decision.title || "")) || null;
    const printComPhrases = printComDecision ? getSupplierBankDecisionPhrases(printComDecision) : SUPPLIER_BANK_DECISION_PHRASES.printComPlacemats;
    items.push({
      order: 2,
      priority: "medium",
      status: latestReports.printComPlacematsPreflight ? "bank_write_approval_ready" : "local_preview_needed",
      title: "Close Print.com `other` coverage with the placemats first slice",
      why: "Print.com `other` is the missing registered family that already has a narrow local policy candidate.",
      evidence: [
        `Coverage gap status: ${formatCoverageGapStatus(printComOtherGap.status)}`,
        `Latest placemats preflight: ${latestReports.printComPlacematsPreflight || "missing"}`,
        `Current coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families`,
      ],
      blockers: latestReports.printComPlacematsPreflight
        ? ["Explicit bank-only write approval is still required before storing the placemats snapshot."]
        : ["Run the no-write placemats preflight before any bank write discussion."],
      safeSteps: [
        "npm run supplier-bank:print-com-other-first-slice:preview",
        "npm run supplier-bank:print-com-placemats-price-preview",
        "npm run supplier-bank:print-com-placemats-bank-write-preflight:write",
      ],
      approvalSteps: [
        "Use the exact `write-print-com-bank-snapshot <preview.json> --write-bank` command printed by the latest placemats preflight only after explicit approval.",
      ],
      approvalPhrase: printComPhrases.approval,
      deferralPhrase: printComPhrases.deferral,
    });
  }

  if (pixartMissingGaps.length > 0) {
    items.push({
      order: 3,
      priority: "medium",
      status: readyPixartRows.length > 0 ? "local_probe_ready" : "blocked_before_probe",
      title: "Prepare missing Pixart families one at a time",
      why: "Pixart banners, labels, posters, and rollups need exact product URLs and extractor profiles before any local probe/extract.",
      evidence: [
        `Pixart gap families: ${pixartMissingGaps.map((row) => row.family).join(", ")}`,
        `Ready for local/no-write probe: ${readyPixartRows.length}/${pixartReadinessRows.length}`,
        `URL candidates pending/confirmed/rejected: ${urlCandidateSummary.pending}/${urlCandidateSummary.confirmed}/${urlCandidateSummary.rejected}`,
        `Latest URL candidate report: ${latestReports.urlCandidates || "missing"}`,
        `Latest URL confirmation checklist: ${latestReports.urlConfirmationChecklist || "missing"}`,
        `Latest Pixart readiness report: ${latestReports.pixartReadiness || "missing"}`,
        `Latest Pixart adapter plan: ${latestReports.pixartAdapterPlan || "missing"}`,
      ],
      blockers: blockedPixartRows.length
        ? blockedPixartRows.map((row) => `${row.family}: ${row.blockers.join("; ") || "none"}`)
        : ["None for currently checked Pixart rows."],
    safeSteps: [
      "npm run supplier-bank:url-candidates:write -- --supplier pixartprinting",
      "npm run supplier-bank:pixart-adapter-plan:write",
      "npm run supplier-bank:pixart-readiness:write",
    ],
    approvalSteps: [],
    approvalPhrase: null,
    deferralPhrase: null,
  });
  }

  items.push({
    order: 4,
    priority: draftQaClean ? "low" : "high",
    status: draftQaClean ? "qa_clean" : "qa_attention_needed",
    title: "Keep imported supplier-bank drafts unpublished and clean",
    why: "The supplier-bank is useful only if imports stay as admin-reviewed drafts until a separate publishing decision.",
    evidence: [
      `Drafts checked: ${importedDraftQa.summary.checked}`,
      `OK/warnings/errors: ${importedDraftQa.summary.ok}/${importedDraftQa.summary.warnings}/${importedDraftQa.summary.errors}`,
      `Published targets found: ${importedDraftQa.summary.published}`,
    ],
    blockers: draftQaClean ? [] : ["Resolve imported-draft warnings/errors or published-state violations before further product rollout."],
    safeSteps: ["npm run supplier-bank:review-imported-drafts:report"],
    approvalSteps: [],
    approvalPhrase: null,
    deferralPhrase: null,
  });

  items.push({
    order: 5,
    priority: coverage.summary.missingFamilies === 0 && decisions.length === 0 ? "low" : "medium",
    status: coverage.summary.missingFamilies === 0 && decisions.length === 0 ? "ready_for_completion_audit" : "recheck_after_open_gates",
    title: "Re-run completion proof after each gate changes",
    why: "The goal should stay open until current evidence proves registry coverage, draft QA, decisions, and imports are complete.",
    evidence: [
      `Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`,
      `Open decisions: ${decisions.length}`,
      `Import eligibility checked: ${eligibility.summary.checked}`,
      `Latest completion audit: ${latestReports.completionAudit || "missing"}`,
    ],
    blockers: coverage.summary.missingFamilies === 0 && decisions.length === 0 ? [] : [
      "Coverage gaps or approval decisions still remain, so completion is not proven.",
    ],
    safeSteps: [
      "npm run supplier-bank:status-report:write",
      "npm run supplier-bank:decision-queue:write",
      "npm run supplier-bank:completion-audit:write",
    ],
    approvalSteps: [],
    approvalPhrase: null,
    deferralPhrase: null,
  });

  return items;
}

function buildSupplierBankGateRoadmapMarkdown({
  coverage,
  decisions,
  gapRows,
  pixartReadinessRows,
  urlCandidateSummary,
  importedDraftQa,
  auditItems = [],
  latestReports,
  roadmapItems,
  includeArchived,
}) {
  const priorityCounts = roadmapItems.reduce((acc, item) => {
    acc[item.priority] = (acc[item.priority] || 0) + 1;
    return acc;
  }, {});
  const openWorkBuckets = buildSupplierBankOpenWorkBuckets({
    decisions,
    gapRows,
    pixartReadinessRows,
    importedDraftQa,
    auditItems,
  });
  const lines = [
    "# Supplier Bank Gate Roadmap",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Registry: ${coverage.resolvedPath}`,
    `Archived products: ${includeArchived ? "included" : "excluded"}`,
    "",
    "## Scope",
    "",
    "- Read-only gate roadmap for the supplier product bank.",
    "- No supplier probing, scraping, API calls, or browser automation.",
    "- No supplier-bank writes.",
    "- No product creation, publishing changes, or live pricing writes.",
    "- Approval-gated write commands are listed only as business decisions and must not be run without explicit approval.",
    "",
    "## Summary",
    "",
    `- Roadmap items: ${roadmapItems.length}`,
    `- Priority counts: ${Object.entries(priorityCounts).map(([priority, count]) => `${priority}:${count}`).join(", ") || "none"}`,
    `- Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies} families`,
    `- Coverage gaps: ${gapRows.length}`,
    `- Decisions: ${decisions.length}`,
    `- Pixart readiness: ${pixartReadinessRows.filter((row) => row.readyForProbe).length}/${pixartReadinessRows.length} ready`,
    `- Pixart URL candidates pending/confirmed/rejected: ${urlCandidateSummary.pending}/${urlCandidateSummary.confirmed}/${urlCandidateSummary.rejected}`,
    `- Imported draft QA OK/warnings/errors/published: ${importedDraftQa.summary.ok}/${importedDraftQa.summary.warnings}/${importedDraftQa.summary.errors}/${importedDraftQa.summary.published}`,
    "",
    "## Latest Evidence Files",
    "",
    `- Status report: \`${latestReports.statusReport || "missing"}\``,
    `- Completion audit: \`${latestReports.completionAudit || "missing"}\``,
    `- Approval packet: \`${latestReports.approvalPacket || "missing"}\``,
    `- Decision queue: \`${latestReports.decisionQueue || "missing"}\``,
    `- Expansion packet: \`${latestReports.expansionPacket || "missing"}\``,
    `- URL candidate report: \`${latestReports.urlCandidates || "missing"}\``,
    `- URL confirmation checklist: \`${latestReports.urlConfirmationChecklist || "missing"}\``,
    `- Pixart readiness report: \`${latestReports.pixartReadiness || "missing"}\``,
    `- Pixart adapter plan: \`${latestReports.pixartAdapterPlan || "missing"}\``,
    `- Pixart rigids preflight: \`${latestReports.pixartRigidsPreflight || "missing"}\``,
    `- Print.com placemats preflight: \`${latestReports.printComPlacematsPreflight || "missing"}\``,
    "",
    "## Ordered Gates",
    "",
  ];

  const openWorkLines = [];
  pushSupplierBankOpenWorkBucketsMarkdown(openWorkLines, openWorkBuckets);
  const latestEvidenceIndex = lines.indexOf("## Latest Evidence Files");
  if (latestEvidenceIndex >= 0) {
    lines.splice(latestEvidenceIndex, 0, ...openWorkLines);
  }

  roadmapItems.forEach((item) => {
    lines.push(
      `### ${item.order}. ${item.title}`,
      "",
      `Priority: ${item.priority}`,
      `Status: ${item.status}`,
      `Why: ${item.why}`,
      "",
      "Evidence:",
      ...(item.evidence.length ? item.evidence.map((entry) => `- ${entry}`) : ["- none"]),
      "",
      "Blockers:",
      ...(item.blockers.length ? item.blockers.map((entry) => `- ${entry}`) : ["- none"]),
      "",
      "Safe/checklist steps:",
      ...(item.safeSteps.length ? item.safeSteps.map((entry) => `- ${entry}`) : ["- none"]),
      ""
    );
    if (item.approvalSteps.length > 0) {
      lines.push(
        "Approval-gated write steps:",
        ...item.approvalSteps.map((entry) => `- ${entry}`),
        ""
      );
    }
    if (item.approvalPhrase || item.deferralPhrase) {
      lines.push(
        "Exact business phrases:",
        item.approvalPhrase ? `- Approve: \`${item.approvalPhrase}\`` : "- Approve: none",
        item.deferralPhrase ? `- Defer: \`${item.deferralPhrase}\`` : "- Defer: none",
        ""
      );
    }
  });

  lines.push(
    "## Guardrails",
    "",
    "- Keep Sales Maba/Salgsmapper, Onlinetryksager, Webprinter, and localhost out of external supplier scraping.",
    "- Keep Supplier Bank separate from POD v1, POD v2, and live pricing tables until explicit admin import.",
    "- Keep new imports unpublished drafts by default.",
    "- Re-run the completion audit after any approved gate changes.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function runSupplierBankGateRoadmap(args) {
  const parsed = parseArgs(args);
  const registryPath = parsed.values.path || DEFAULT_SUPPLIER_SOURCE_REGISTRY;
  const includeArchived = parsed.flags.has("include-archived");
  const shouldWriteReport = parsed.flags.has("write-report");
  const coverage = await getSupplierSourceCoverageContext({ registryPath, includeArchived });
  const eligibility = await getSupplierBankImportEligibilityContext({ includeArchived });
  const importedDraftQa = await getImportedDraftQaContext({ limit: 50 });
  const pixartRigidsDecisionState = getPixartRigidsDecisionState();
  const decisions = buildSupplierBankDecisionQueue({
    coverage,
    eligibility,
    importedDraftQa,
    pixartRigidsDecisionState,
  });
  const gapRows = getCoverageGapRows({ coverage });
  const pixartReadinessRows = getPixartReadinessRows({ coverage, requestedFamily: "" });
  const { validation } = loadValidatedSupplierRegistry(registryPath);
  const urlCandidateRows = getSupplierUrlCandidateRows({
    validation,
    supplierFilter: "pixartprinting",
    familyFilter: "",
  });
  const urlCandidateSummary = summarizeSupplierUrlCandidateRows(urlCandidateRows);
  const latestReports = getSupplierBankLatestReportPaths();
  const roadmapItems = buildSupplierBankGateRoadmapItems({
    coverage,
    eligibility,
    importedDraftQa,
    decisions,
    gapRows,
    pixartReadinessRows,
    urlCandidateSummary,
    latestReports,
  });
  const auditItems = createSupplierBankCompletionAuditItems({
    coverage,
    eligibility,
    importedDraftQa,
    decisions,
    pixartRigidsDecisionState,
    pixartReadinessRows,
  });

  console.log("Supplier bank gate roadmap");
  console.log("  Scope: read-only gate roadmap");
  console.log(`  Registry: ${coverage.resolvedPath}`);
  console.log(`  Archived products: ${includeArchived ? "included" : "excluded"}`);
  console.log("  Supplier probes/scrapes/API calls: no");
  console.log("  Bank writes: no");
  console.log("  Product writes: no");
  console.log("  Live pricing writes: no");
  console.log("");
  console.log("Summary");
  console.log(`  Roadmap items: ${roadmapItems.length}`);
  console.log(`  Coverage: ${coverage.summary.coveredFamilies}/${coverage.summary.expectedFamilies}`);
  console.log(`  Decisions: ${decisions.length}`);
  console.log(`  Pixart readiness: ${pixartReadinessRows.filter((row) => row.readyForProbe).length}/${pixartReadinessRows.length} ready`);
  console.log(`  Pixart URL candidates pending/confirmed/rejected: ${urlCandidateSummary.pending}/${urlCandidateSummary.confirmed}/${urlCandidateSummary.rejected}`);
  console.log("");
  console.log("Ordered gates");
  roadmapItems.forEach((item) => {
    console.log(`  ${item.order}. [${item.priority}] ${item.title} | ${item.status}`);
    console.log(`     First safe step: ${item.safeSteps[0] || "none"}`);
    if (item.approvalSteps.length > 0) {
      console.log("     Approval-gated write step present: yes");
    }
    if (item.approvalPhrase || item.deferralPhrase) {
      console.log("     Exact approve/defer phrases present: yes");
    }
  });

  if (shouldWriteReport) {
    ensureDir("docs");
    const reportPath = path.join("docs", `SUPPLIER_BANK_GATE_ROADMAP_${timestampForFile()}.md`);
    const report = buildSupplierBankGateRoadmapMarkdown({
      coverage,
      decisions,
      gapRows,
      pixartReadinessRows,
      urlCandidateSummary,
      importedDraftQa,
      auditItems,
      latestReports,
      roadmapItems,
      includeArchived,
    });
    fs.writeFileSync(reportPath, report, "utf8");
    fs.writeFileSync(SUPPLIER_BANK_GATE_ROADMAP_LATEST_PATH, report, "utf8");
    console.log("");
    console.log(`Report written: ${reportPath}`);
    console.log(`Latest copy written: ${SUPPLIER_BANK_GATE_ROADMAP_LATEST_PATH}`);
  }
}

async function runReviewWmdRefresh() {
  const client = getSupabaseServiceClient();
  const supplierSlug = "wir-machen-druck";
  const productKey = WMD_FULL_BANK_PRODUCT_KEY;

  console.log("Supplier bank WMD refresh review");
  console.log("  Scope: read-only import/reimport decision aid");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");

  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug")
    .eq("slug", supplierSlug)
    .maybeSingle();

  if (supplierError) throw supplierError;
  if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);

  const { data: bankProduct, error: productError } = await client
    .from("supplier_bank_products")
    .select("id,supplier_product_key,name_da,name_original,status,scrape_status,normalized_pricing_summary,last_scraped_at,last_price_checked_at")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) throw productError;
  if (!bankProduct) throw new Error(`Bank product not found: ${productKey}`);

  const { data: snapshots, error: snapshotsError } = await client
    .from("supplier_bank_price_snapshots")
    .select("id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk,normalized_price_rows,metadata")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(3);

  if (snapshotsError) throw snapshotsError;

  const latestSnapshot = snapshots?.[0] || null;
  const previousSnapshot = snapshots?.[1] || null;

  const { data: latestReview, error: reviewError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,status,old_price_snapshot_id,new_price_snapshot_id,change_summary,created_at")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError) throw reviewError;

  const { data: importJobs, error: importJobsError } = await client
    .from("supplier_bank_import_jobs")
    .select("id,status,import_mode,target_tenant_id,target_product_id,import_summary,created_at")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (importJobsError) throw importJobsError;

  const latestImportedJob = (importJobs || []).find((job) => job.status === "imported" && job.target_product_id) || null;
  let draftProduct = null;
  let draftPriceRowCount = null;
  let draftSlug = extractProductSlugFromImportJob(latestImportedJob);

  if (latestImportedJob?.target_product_id) {
    const { data: productRow, error: draftError } = await client
      .from("products")
      .select("id,slug,name,is_published,pricing_type,updated_at")
      .eq("id", latestImportedJob.target_product_id)
      .maybeSingle();

    if (draftError) throw draftError;
    draftProduct = productRow || null;
    draftSlug = draftProduct?.slug || draftSlug;

    const { count, error: priceCountError } = await client
      .from("generic_product_prices")
      .select("id", { count: "exact", head: true })
      .eq("product_id", latestImportedJob.target_product_id);

    if (priceCountError) throw priceCountError;
    draftPriceRowCount = count ?? null;
  }

  const latestRows = latestSnapshot ? countJsonRows(latestSnapshot.normalized_price_rows) : null;
  const draftRowsMatchLatest = draftPriceRowCount != null && latestRows != null && draftPriceRowCount === latestRows;
  const latestReviewSummary = latestReview?.change_summary || {};
  const hasUnreviewedDelta = latestReview
    && latestReview.new_price_snapshot_id === latestSnapshot?.id
    && latestReview.status === "draft"
    && (
      Number(latestReviewSummary.changedRows || 0) > 0
      || Number(latestReviewSummary.addedRows || 0) > 0
      || Number(latestReviewSummary.removedRows || 0) > 0
    );
  const draftIsBehind = Boolean(draftProduct && !draftRowsMatchLatest);

  console.log("");
  console.log("Current bank state");
  console.log(`  Supplier: ${supplier.name} (${supplier.slug})`);
  console.log(`  Bank product: ${bankProduct.name_da || bankProduct.name_original} (${bankProduct.supplier_product_key})`);
  console.log(`  Bank status: ${bankProduct.status}`);
  console.log(`  Scrape status: ${bankProduct.scrape_status}`);
  console.log(`  Last scraped: ${formatMaybeDate(bankProduct.last_scraped_at)}`);
  console.log(`  Latest snapshot: ${latestSnapshot?.id || "none"}`);
  console.log(`  Previous snapshot: ${previousSnapshot?.id || "none"}`);
  console.log(`  Stored snapshots checked: ${(snapshots || []).length}`);
  console.log(`  Latest snapshot rows: ${formatDecisionValue(latestRows)}`);
  console.log(`  Latest snapshot DKK range: ${formatDecisionValue(latestSnapshot?.price_min_dkk)}-${formatDecisionValue(latestSnapshot?.price_max_dkk)}`);

  console.log("");
  console.log("Latest delta review");
  if (latestReview) {
    console.log(`  Review: ${latestReview.id}`);
    console.log(`  Status: ${latestReview.status}`);
    console.log(`  Snapshot pair: ${latestReview.old_price_snapshot_id} -> ${latestReview.new_price_snapshot_id}`);
    console.log(`  Changed rows: ${formatDecisionValue(latestReviewSummary.changedRows)}`);
    console.log(`  Added/removed rows: ${formatDecisionValue(latestReviewSummary.addedRows)}/${formatDecisionValue(latestReviewSummary.removedRows)}`);
    console.log(`  Increased/decreased rows: ${formatDecisionValue(latestReviewSummary.increasedRows)}/${formatDecisionValue(latestReviewSummary.decreasedRows)}`);
    console.log(`  Net changed-row delta DKK: ${formatDecisionValue(latestReviewSummary.netChangedRowDeltaDkk)}`);
  } else {
    console.log("  No delta review found.");
  }

  console.log("");
  console.log("Imported draft");
  if (draftProduct) {
    console.log(`  Product: ${draftProduct.name} (${draftProduct.slug})`);
    console.log(`  Product ID: ${draftProduct.id}`);
    console.log(`  Published: ${draftProduct.is_published ? "yes" : "no"}`);
    console.log(`  Pricing type: ${draftProduct.pricing_type}`);
    console.log(`  Draft price rows: ${formatDecisionValue(draftPriceRowCount)}`);
    console.log(`  Latest bank rows: ${formatDecisionValue(latestRows)}`);
    console.log(`  Rows match latest bank snapshot: ${draftRowsMatchLatest ? "yes" : "no"}`);
  } else {
    console.log(`  No imported draft product found${draftSlug ? ` (last known slug: ${draftSlug})` : ""}.`);
  }

  console.log("");
  console.log("Recommendation");
  if (!latestSnapshot) {
    console.log("  No supplier-bank snapshot exists yet. Refresh the bank before importing.");
  } else if (!draftProduct) {
    console.log("  Create a new unpublished draft from the approved bank product before storefront use.");
  } else if (hasUnreviewedDelta) {
    console.log("  Review the latest draft delta before replacing or publishing the draft product.");
    console.log("  Keep the existing imported draft unpublished until the delta is accepted.");
  } else if (draftIsBehind) {
    console.log("  Draft row count differs from the latest bank snapshot. Create a new draft or explicit reimport plan after review.");
  } else {
    console.log("  Draft rows match the latest bank snapshot. Continue normal admin review before any publishing decision.");
  }
}

async function runReviewPixartRefresh() {
  const client = getSupabaseServiceClient();
  const supplierSlug = "pixartprinting";
  const productKey = PIXART_FLAT_BANK_PRODUCT_KEY;

  console.log("Supplier bank Pixart refresh review");
  console.log("  Scope: read-only Pixart supplier-bank decision aid");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log("  Product publishing: no");

  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled,currency,country_code,metadata")
    .eq("slug", supplierSlug)
    .maybeSingle();

  if (supplierError) throw supplierError;
  if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);

  const { data: bankProduct, error: productError } = await client
    .from("supplier_bank_products")
    .select("id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,normalized_attributes,normalized_pricing_summary,last_scraped_at,last_price_checked_at")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) throw productError;
  if (!bankProduct) throw new Error(`Bank product not found: ${productKey}`);

  const { data: snapshots, error: snapshotsError } = await client
    .from("supplier_bank_price_snapshots")
    .select("id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk,normalized_price_rows,metadata")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(3);

  if (snapshotsError) throw snapshotsError;

  const latestSnapshot = snapshots?.[0] || null;
  const previousSnapshot = snapshots?.[1] || null;

  const { data: latestReview, error: reviewError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,status,old_price_snapshot_id,new_price_snapshot_id,change_summary,created_at,notes")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError) throw reviewError;

  const { data: importJobs, error: importJobsError } = await client
    .from("supplier_bank_import_jobs")
    .select("id,status,import_mode,target_tenant_id,target_product_id,import_summary,created_at")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (importJobsError) throw importJobsError;

  const latestRows = latestSnapshot ? countJsonRows(latestSnapshot.normalized_price_rows) : null;
  const previousRows = previousSnapshot ? countJsonRows(previousSnapshot.normalized_price_rows) : null;
  const latestReviewSummary = latestReview?.change_summary || {};
  const latestReviewTargetsLatestSnapshot = latestReview?.new_price_snapshot_id === latestSnapshot?.id;
  const hasUnreviewedDelta = latestReviewTargetsLatestSnapshot
    && latestReview?.status === "draft"
    && (
      Number(latestReviewSummary.changedRows || 0) > 0
      || Number(latestReviewSummary.addedRows || 0) > 0
      || Number(latestReviewSummary.removedRows || 0) > 0
    );
  const hasDraftImport = (importJobs || []).some((job) => job.target_product_id);
  const attributes = bankProduct.normalized_attributes || {};
  const localPreviews = getPixartLocalPreviewSummaries();
  const passingLocalPreviews = localPreviews.filter((preview) => preview.valid);
  const failingLocalPreviews = localPreviews.filter((preview) => !preview.valid);
  const latestPassingLocalPreview = passingLocalPreviews[0] || null;
  const latestLocalPreview = localPreviews[0] || null;

  console.log("");
  console.log("Current Pixart bank state");
  console.log(`  Supplier: ${supplier.name} (${supplier.slug})`);
  console.log(`  Supplier enabled: ${supplier.enabled ? "yes" : "no"}`);
  console.log(`  Currency/country: ${supplier.currency || "unknown"}/${supplier.country_code || "unknown"}`);
  console.log(`  Bank product: ${bankProduct.name_da || bankProduct.name_original} (${bankProduct.supplier_product_key})`);
  console.log(`  Product family: ${bankProduct.product_family}`);
  console.log(`  Bank status: ${bankProduct.status}`);
  console.log(`  Scrape status: ${bankProduct.scrape_status}`);
  console.log(`  Last scraped: ${formatMaybeDate(bankProduct.last_scraped_at)}`);
  console.log(`  Latest snapshot: ${latestSnapshot?.id || "none"}`);
  console.log(`  Previous snapshot: ${previousSnapshot?.id || "none"}`);
  console.log(`  Stored snapshots checked: ${(snapshots || []).length}`);
  console.log(`  Latest/previous rows: ${formatDecisionValue(latestRows)}/${formatDecisionValue(previousRows)}`);
  console.log(`  Latest snapshot DKK range: ${formatDecisionValue(latestSnapshot?.price_min_dkk)}-${formatDecisionValue(latestSnapshot?.price_max_dkk)}`);
  console.log(`  Quantities: ${formatDecisionValue(latestSnapshot?.quantity_min)}-${formatDecisionValue(latestSnapshot?.quantity_max)}`);
  console.log(`  Materials/finishes: ${countJsonRows(attributes.materials)}/${countJsonRows(attributes.finishes)}`);
  console.log(`  Areas/quantities tracked: ${countJsonRows(attributes.areas_m2)}/${countJsonRows(attributes.quantities)}`);

  console.log("");
  console.log("Latest delta review");
  if (latestReview) {
    console.log(`  Review: ${latestReview.id}`);
    console.log(`  Status: ${latestReview.status}`);
    console.log(`  Snapshot pair: ${latestReview.old_price_snapshot_id} -> ${latestReview.new_price_snapshot_id}`);
    console.log(`  Targets latest snapshot: ${latestReviewTargetsLatestSnapshot ? "yes" : "no"}`);
    console.log(`  Changed rows: ${formatDecisionValue(latestReviewSummary.changedRows)}`);
    console.log(`  Added/removed rows: ${formatDecisionValue(latestReviewSummary.addedRows)}/${formatDecisionValue(latestReviewSummary.removedRows)}`);
    console.log(`  Increased/decreased rows: ${formatDecisionValue(latestReviewSummary.increasedRows)}/${formatDecisionValue(latestReviewSummary.decreasedRows)}`);
    console.log(`  Net changed-row delta DKK: ${formatDecisionValue(latestReviewSummary.netChangedRowDeltaDkk)}`);
  } else {
    console.log("  No delta review found.");
  }

  console.log("");
  console.log("Draft imports");
  if ((importJobs || []).length > 0) {
    importJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.status} ${job.import_mode || "unknown"} | target ${job.target_product_id || "none"} | ${formatMaybeDate(job.created_at)}`);
    });
  } else {
    console.log("  No Pixart draft imports found.");
  }

  console.log("");
  console.log("Local preview quality");
  console.log(`  Preview files checked: ${localPreviews.length}`);
  console.log(`  Passing/failing previews: ${passingLocalPreviews.length}/${failingLocalPreviews.length}`);
  if (latestPassingLocalPreview) {
    console.log(`  Latest passing preview: ${latestPassingLocalPreview.path}`);
    console.log(`  Latest passing rows: ${latestPassingLocalPreview.rows}`);
  } else {
    console.log("  Latest passing preview: none");
  }
  if (latestLocalPreview && !latestLocalPreview.valid) {
    console.log(`  Latest local preview is failing: ${latestLocalPreview.path}`);
    console.log(`  Failure: ${latestLocalPreview.reason}`);
  }

  console.log("");
  console.log("Recommendation");
  if (!latestSnapshot) {
    console.log("  No Pixart bank snapshot exists yet. Run a local first slice and bank-only snapshot write before review.");
  } else if (!previousSnapshot) {
    console.log("  Only one Pixart snapshot exists. Add another staged snapshot before creating a delta review.");
  } else if (!latestReview || !latestReviewTargetsLatestSnapshot) {
    console.log("  Create a draft delta review from the latest two Pixart snapshots before expanding or importing.");
  } else if (hasUnreviewedDelta) {
    console.log("  Review the draft Pixart delta. If the added/changed rows look correct, mark it reviewed before any further conversion.");
    console.log("  Keep Pixart as candidate/disabled until a wider extraction policy and markup decision are approved.");
  } else if (latestReviewTargetsLatestSnapshot && latestReview?.status === "rejected") {
    console.log("  Latest Pixart delta review is rejected, so the product must remain blocked and disabled.");
    console.log("  Do not convert the latest 90-row snapshot into a Webprinter product.");
    if (latestPassingLocalPreview) {
      const safePreviewArg = quoteShellArg(latestPassingLocalPreview.path);
      console.log(`  Restore direction: use the latest passing local preview as the safe baseline (${latestPassingLocalPreview.rows} rows).`);
      console.log("  Preview recovery: node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline");
      console.log(`  Confirmed bank-only recovery: node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline --safe-preview ${safePreviewArg} --write-bank --write-delta-review`);
    } else {
      console.log("  No passing local preview was found. Rerun the 45-row baseline extraction before any bank write.");
    }
  } else if (!hasDraftImport) {
    console.log("  Pixart is staged only. Expand the extraction or prepare a draft storformat conversion plan before storefront use.");
  } else {
    console.log("  Pixart has import history. Compare the draft import to the latest accepted bank snapshot before publishing decisions.");
  }
}

async function resolveLatestDeltaReviewForProduct(client, { supplierSlug, productKey }) {
  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id")
    .eq("slug", supplierSlug)
    .maybeSingle();

  if (supplierError) throw supplierError;
  if (!supplier) throw new Error(`${supplierSlug} supplier row not found`);

  const { data: bankProduct, error: productError } = await client
    .from("supplier_bank_products")
    .select("id")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) throw productError;
  if (!bankProduct) throw new Error(`Bank product not found: ${supplierSlug}/${productKey}`);

  const { data: review, error: reviewError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id")
    .eq("bank_product_id", bankProduct.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError) throw reviewError;
  if (!review) throw new Error(`No delta review found for ${supplierSlug}/${productKey}`);
  return review.id;
}

async function resolveLatestWmdDeltaReview(client) {
  return resolveLatestDeltaReviewForProduct(client, {
    supplierSlug: "wir-machen-druck",
    productKey: WMD_FULL_BANK_PRODUCT_KEY,
  });
}

async function resolveLatestPixartDeltaReview(client) {
  return resolveLatestDeltaReviewForProduct(client, {
    supplierSlug: "pixartprinting",
    productKey: PIXART_FLAT_BANK_PRODUCT_KEY,
  });
}

async function runUpdateDeltaReviewStatus(args) {
  const parsed = parseArgs(args);
  const client = getSupabaseServiceClient();
  const requestedStatus = normalizeText(parsed.values.status);
  const confirmStatusUpdate = parsed.flags.has("confirm-status-update");
  let reviewId = normalizeText(parsed.values["review-id"]);

  if (!DELTA_REVIEW_STATUSES.has(requestedStatus) || requestedStatus === "draft") {
    throw new Error("--status must be one of: reviewed, accepted, rejected");
  }

  if (!reviewId && parsed.flags.has("latest-wmd")) {
    reviewId = await resolveLatestWmdDeltaReview(client);
  }

  if (!reviewId && parsed.flags.has("latest-pixart")) {
    reviewId = await resolveLatestPixartDeltaReview(client);
  }

  if (!reviewId) {
    throw new Error("Missing --review-id <uuid>, --latest-wmd, or --latest-pixart");
  }

  const { data: review, error: reviewError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,status,bank_product_id,old_price_snapshot_id,new_price_snapshot_id,change_summary,created_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError) throw reviewError;
  if (!review) throw new Error(`Delta review not found: ${reviewId}`);

  const allowedStatuses = getNextDeltaReviewStatuses(review.status);
  const allowed = allowedStatuses.includes(requestedStatus);
  const summary = review.change_summary || {};

  console.log("Supplier bank delta review status update");
  console.log("  Scope: bank-only review status transition");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Review: ${review.id}`);
  console.log(`  Current status: ${review.status}`);
  console.log(`  Requested status: ${requestedStatus}`);
  console.log(`  Allowed next statuses: ${allowedStatuses.length ? allowedStatuses.join(", ") : "none"}`);
  console.log(`  Snapshot pair: ${review.old_price_snapshot_id || "unknown"} -> ${review.new_price_snapshot_id || "unknown"}`);
  console.log(`  Changed rows: ${formatDecisionValue(summary.changedRows)}`);
  console.log(`  Added/removed rows: ${formatDecisionValue(summary.addedRows)}/${formatDecisionValue(summary.removedRows)}`);

  if (!allowed) {
    throw new Error(`Invalid status transition: ${review.status} -> ${requestedStatus}`);
  }

  if (!confirmStatusUpdate) {
    console.log("");
    console.log("Preview only. Add --confirm-status-update to update this bank-only delta review status.");
    return;
  }

  const { data: updated, error: updateError } = await client
    .from("supplier_bank_price_delta_reviews")
    .update({
      status: requestedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .select("id,status,updated_at")
    .single();

  if (updateError) throw updateError;

  console.log("");
  console.log("Delta review status updated");
  console.log(`  Review: ${updated.id}`);
  console.log(`  Status: ${updated.status}`);
  console.log(`  Updated at: ${formatMaybeDate(updated.updated_at)}`);
}

async function runVerifyWmdBankPilot(args) {
  const parsed = parseArgs(args);
  const supplierSlug = parsed.values["supplier-slug"] || "wir-machen-druck";
  const productKey = parsed.values["product-key"] || "wmd-folder-bank-pilot";
  const client = getSupabaseServiceClient();

  console.log("Supplier bank WMD remote verification");
  console.log("  Scope: read-only supplier-bank table check");
  console.log("  Live product writes: no");
  console.log("  Live pricing writes: no");
  console.log(`  Supplier slug: ${supplierSlug}`);
  console.log(`  Product key: ${productKey}`);

  const { data: supplier, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .select("id,name,slug,enabled,currency,country_code,updated_at")
    .eq("slug", supplierSlug)
    .maybeSingle();

  if (supplierError) {
    throw new Error(
      `Supplier-bank suppliers table is not readable yet. Apply the supplier-bank migration first. ${formatSupabaseError(supplierError)}`
    );
  }

  if (!supplier) {
    throw new Error(`Supplier not found in supplier bank: ${supplierSlug}`);
  }

  const { data: product, error: productError } = await client
    .from("supplier_bank_products")
    .select([
      "id",
      "supplier_product_key",
      "name_da",
      "name_original",
      "product_family",
      "status",
      "scrape_status",
      "normalized_pricing_summary",
      "last_scraped_at",
      "last_price_checked_at",
      "updated_at",
    ].join(","))
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", productKey)
    .maybeSingle();

  if (productError) {
    throw new Error(`Supplier-bank product lookup failed. ${formatSupabaseError(productError)}`);
  }

  if (!product) {
    throw new Error(`Bank product not found for supplier '${supplierSlug}': ${productKey}`);
  }

  const { data: snapshot, error: snapshotError } = await client
    .from("supplier_bank_price_snapshots")
    .select([
      "id",
      "currency",
      "normalized_price_rows",
      "raw_price_rows",
      "quantity_min",
      "quantity_max",
      "price_min_dkk",
      "price_max_dkk",
      "created_at",
    ].join(","))
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(`Supplier-bank price snapshot lookup failed. ${formatSupabaseError(snapshotError)}`);
  }

  if (!snapshot) {
    throw new Error(`No price snapshots found for bank product: ${productKey}`);
  }

  const { count: snapshotCount, error: snapshotCountError } = await client
    .from("supplier_bank_price_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("bank_product_id", product.id);

  if (snapshotCountError) {
    throw new Error(`Supplier-bank price snapshot count failed. ${formatSupabaseError(snapshotCountError)}`);
  }

  const { data: importJobs, error: importJobsError } = await client
    .from("supplier_bank_import_jobs")
    .select("id,status,import_mode,target_product_id,created_at")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (importJobsError) {
    throw new Error(`Supplier-bank import job lookup failed. ${formatSupabaseError(importJobsError)}`);
  }

  const { data: deltaReviews, error: deltaReviewsError } = await client
    .from("supplier_bank_price_delta_reviews")
    .select("id,status,created_at")
    .eq("bank_product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (deltaReviewsError) {
    throw new Error(`Supplier-bank delta review lookup failed. ${formatSupabaseError(deltaReviewsError)}`);
  }

  const summary = product.normalized_pricing_summary || {};

  console.log("");
  console.log("Remote supplier bank verification complete");
  console.log(`  Supplier: ${supplier.name} (${supplier.slug})`);
  console.log(`  Supplier enabled: ${supplier.enabled ? "yes" : "no"}`);
  console.log(`  Supplier country/currency: ${supplier.country_code}/${supplier.currency}`);
  console.log(`  Bank product: ${product.name_da || product.name_original} (${product.supplier_product_key})`);
  console.log(`  Family/status: ${product.product_family}/${product.status}`);
  console.log(`  Scrape status: ${product.scrape_status}`);
  console.log(`  Last scraped: ${formatMaybeDate(product.last_scraped_at)}`);
  console.log(`  Last price checked: ${formatMaybeDate(product.last_price_checked_at)}`);
  console.log(`  Product summary rows: ${summary.rows ?? "unknown"}`);
  console.log(`  Product summary quantities: ${summary.quantityMin ?? "unknown"}-${summary.quantityMax ?? "unknown"}`);
  console.log(`  Product summary DKK range: ${summary.priceMinDkk ?? "unknown"}-${summary.priceMaxDkk ?? "unknown"}`);
  console.log(`  Stored price snapshots: ${snapshotCount ?? 0}`);
  console.log(`  Latest snapshot: ${snapshot.id}`);
  console.log(`  Latest snapshot date: ${formatMaybeDate(snapshot.created_at)}`);
  console.log(`  Latest snapshot rows raw/normalized: ${countJsonRows(snapshot.raw_price_rows)}/${countJsonRows(snapshot.normalized_price_rows)}`);
  console.log(`  Latest snapshot quantities: ${snapshot.quantity_min ?? "unknown"}-${snapshot.quantity_max ?? "unknown"}`);
  console.log(`  Latest snapshot DKK range: ${snapshot.price_min_dkk ?? "unknown"}-${snapshot.price_max_dkk ?? "unknown"}`);
  console.log(`  Recent import jobs: ${importJobs?.length || 0}`);
  console.log(`  Recent delta reviews: ${deltaReviews?.length || 0}`);
}

async function main() {
  installCliTimeout();
  const [, , command, ...args] = process.argv;
  if (!command || ["-h", "--help", "help"].includes(command)) {
    console.log(usage());
    return;
  }

  if (command === "doctor") {
    runDoctor();
    return;
  }

  if (command === "validate-supplier-sources") {
    runValidateSupplierSources(args);
    return;
  }

  if (command === "supplier-bank-url-candidate-report") {
    runSupplierBankUrlCandidateReport(args);
    return;
  }

  if (command === "supplier-bank-url-confirmation-checklist") {
    runSupplierBankUrlConfirmationChecklist(args);
    return;
  }

  if (command === "seed-supplier-sources") {
    await runSeedSupplierSources(args);
    return;
  }

  if (command === "verify-supplier-sources") {
    await runVerifySupplierSources(args);
    return;
  }

  if (command === "smoke-wmd-bank-pilot") {
    await runSmokeWmdBankPilot(args);
    return;
  }

  if (command === "preflight-wmd-bank-pilot") {
    runPreflightWmdBankPilot(args);
    return;
  }

  if (command === "apply-wmd-bank") {
    runApplyWmdBankPilot(["--slug", WMD_FULL_BANK_PRODUCT_KEY, "--name", WMD_FULL_BANK_PRODUCT_NAME, ...args]);
    return;
  }

  if (command === "refresh-wmd-bank") {
    runRefreshWmdBank(args);
    return;
  }

  if (command === "process-refresh-queue") {
    await runProcessRefreshQueue(args);
    return;
  }

  if (command === "pixart-bank-first-slice") {
    runPixartBankFirstSlice(args);
    return;
  }

  if (command === "normalize-pixart-extraction-preview") {
    runNormalizePixartExtractionPreview(args);
    return;
  }

  if (command === "write-pixart-bank-snapshot") {
    await runWritePixartBankSnapshot(args);
    return;
  }

  if (command === "restore-pixart-safe-baseline") {
    await runRestorePixartSafeBaseline(args);
    return;
  }

  if (command === "preview-pixart-storformat-import") {
    await runPreviewPixartStorformatImport(args);
    return;
  }
  if (command === "preview-pixart-rigids-storformat-import") {
    await runPreviewPixartRigidsStorformatImport(args);
    return;
  }

  if (command === "review-pixart-rigids-storformat-preview") {
    runReviewPixartRigidsStorformatPreview(args);
    return;
  }

  if (command === "review-pixart-rigids-bank-candidate") {
    runReviewPixartRigidsBankCandidate(args);
    return;
  }

  if (command === "review-pixart-rigids-candidate-packet") {
    await runReviewPixartRigidsCandidatePacket(args);
    return;
  }

  if (command === "preflight-pixart-rigids-bank-write") {
    await runPreflightPixartRigidsBankWrite(args);
    return;
  }

  if (command === "review-wmd-refresh") {
    await runReviewWmdRefresh(args);
    return;
  }

  if (command === "review-pixart-refresh") {
    await runReviewPixartRefresh(args);
    return;
  }

  if (command === "review-import-eligibility") {
    await runReviewImportEligibility(args);
    return;
  }

  if (command === "review-imported-drafts") {
    await runReviewImportedDrafts(args);
    return;
  }

  if (command === "review-source-coverage") {
    await runReviewSourceCoverage(args);
    return;
  }

  if (command === "plan-next-expansion") {
    await runPlanNextExpansion(args);
    return;
  }

  if (command === "supplier-bank-status-report") {
    await runSupplierBankStatusReport(args);
    return;
  }

  if (command === "supplier-bank-decision-queue") {
    await runSupplierBankDecisionQueue(args);
    return;
  }

  if (command === "supplier-bank-approval-packet") {
    await runSupplierBankApprovalPacket(args);
    return;
  }

  if (command === "supplier-bank-expansion-packet") {
    await runSupplierBankExpansionPacket(args);
    return;
  }

  if (command === "supplier-bank-gate-roadmap") {
    await runSupplierBankGateRoadmap(args);
    return;
  }

  if (command === "supplier-bank-executive-summary") {
    await runSupplierBankExecutiveSummary(args);
    return;
  }

  if (command === "supplier-bank-completion-audit") {
    await runSupplierBankCompletionAudit(args);
    return;
  }

  if (command === "supplier-bank-goal-snapshot") {
    await runSupplierBankGoalSnapshot(args);
    return;
  }

  if (command === "supplier-bank-report-index") {
    runSupplierBankReportIndex(args);
    return;
  }

  if (command === "supplier-bank-coverage-gap-plan") {
    await runSupplierBankCoverageGapPlan(args);
    return;
  }

  if (command === "supplier-bank-pixart-adapter-plan") {
    await runSupplierBankPixartAdapterPlan(args);
    return;
  }

  if (command === "supplier-bank-pixart-readiness-report") {
    await runSupplierBankPixartReadinessReport(args);
    return;
  }

  if (command === "plan-print-com-bank-slice") {
    await runPlanPrintComBankSlice(args);
    return;
  }

  if (command === "print-com-bank-first-slice") {
    await runPrintComBankFirstSlice(args);
    return;
  }

  if (command === "print-com-bank-price-preview") {
    await runPrintComBankPricePreview(args);
    return;
  }

  if (command === "write-print-com-bank-snapshot") {
    await runWritePrintComBankSnapshot(args);
    return;
  }

  if (command === "preflight-print-com-placemats-bank-write") {
    await runPreflightPrintComPlacematsBankWrite(args);
    return;
  }

  if (command === "approve-bank-product") {
    await runApproveBankProduct(args);
    return;
  }

  if (command === "preview-bank-draft-import") {
    await runPreviewBankDraftImport(args);
    return;
  }

  if (command === "update-delta-review-status") {
    await runUpdateDeltaReviewStatus(args);
    return;
  }

  if (command === "verify-wmd-bank") {
    await runVerifyWmdBankPilot(["--product-key", WMD_FULL_BANK_PRODUCT_KEY, ...args]);
    return;
  }

  if (command === "apply-wmd-bank-pilot") {
    runApplyWmdBankPilot(args);
    return;
  }

  if (command === "verify-wmd-bank-pilot") {
    await runVerifyWmdBankPilot(args);
    return;
  }

  if (command === "ingest-blueprint") {
    await runIngestBlueprint(args);
    return;
  }

  if (command === "import-normalized-snapshot") {
    await runImportNormalizedSnapshot(args);
    return;
  }

  if (command === "compare-normalized-snapshots") {
    await runCompareNormalizedSnapshots(args);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
