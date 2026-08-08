#!/usr/bin/env node
/**
 * fetch2-wmd-roll-labels.mjs
 *
 * Extract + import helper for WIRmachenDRUCK free-size roll labels.
 * Uses the site's own JSON endpoints (wmdrest/article/*) instead of fragile
 * rendered-price scraping.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { applyConversionRule } from "./product-import/shared/conversion.js";
import { parseFxSnapshot } from "./product-import/shared/fx-snapshot.js";
import {
  applySnapshotPricing,
  assertSnapshotDraftWriteConfirmation,
  assertSnapshotDraftWriteTarget,
  buildSnapshotDraftTarget,
  deriveSnapshotUnitPrice,
  deriveSnapshotChildUuid,
  parsePositiveSupplierPrice,
  resolveSnapshotRoundingPolicy,
} from "./product-import/shared/snapshot-pricing.js";

const DEFAULT_URL =
  "https://www.wir-machen-druck.de/hochwertige-etiketten-auf-rolle-freie-groesse-rechteckig.html#content-view";
const DEFAULT_OUT_DIR = "pricing_raw";

const DEFAULT_SIZES_CM = [
  { widthCm: 1, heightCm: 1 },
  { widthCm: 2, heightCm: 2 },
  { widthCm: 3, heightCm: 3 },
  { widthCm: 4, heightCm: 4 },
  { widthCm: 5, heightCm: 5 },
  { widthCm: 7, heightCm: 7 },
  { widthCm: 10, heightCm: 10 },
  { widthCm: 12, heightCm: 12 },
  { widthCm: 15, heightCm: 15 },
  { widthCm: 20, heightCm: 20 },
];

const DEFAULT_QUANTITIES = [
  10, 100, 200, 250, 500, 1000, 2000, 3000, 4000, 5000, 7000, 10000, 15000, 20000,
  30000,
];
const DEFAULT_SHAPES = ["rectangle", "circle"];

const DEFAULT_FX = 7.6;
const DEFAULT_MARKUP_UNDER_OR_EQ_THRESHOLD = 70;
const DEFAULT_MARKUP_OVER_THRESHOLD = 60;
const DEFAULT_THRESHOLD_DKK = 3000;
const DEFAULT_ROUNDING_STEP = 1;
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "WMD Roll Labels Free Size";
const DEFAULT_PRODUCT_SLUG = "wmd-roll-labels-free-size";
const DEFAULT_PRODUCT_CATEGORY = "storformat";
const DEFAULT_PRODUCT_DESCRIPTION = "WIRmachenDRUCK roll labels import (free size)";
const DEFAULT_IMPORT_PREFIX = "wmd-roll-labels-free-size-";
const DEFAULT_DELIVERY_MODE = "both";
const DEFAULT_SHAPE_OPTIONS = [
  { key: "shape-rectangle", name: "Rectangular" },
  { key: "shape-circle", name: "Circle" },
];

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch2-wmd-roll-labels.mjs probe [--url <url>] [--headful|--headless]",
    "  node scripts/fetch2-wmd-roll-labels.mjs extract [--url <url>] [--headful|--headless]",
    "    [--materials <csv values|ids>]",
    "    [--quantities <csv>]",
    "    [--sizes <csv WxH cm, e.g. 1x1,2x2,3x5>]",
    "    [--shapes rectangle,circle]",
    "    [--limit-materials <n>] [--limit-quantities <n>] [--limit-sizes <n>] [--limit-deliveries <n>]",
    "    [--out-dir <path>]",
    "    [--eur-to-dkk <n>] [--markup-low-pct <n>] [--markup-high-pct <n>] [--threshold-dkk <n>] [--rounding-step <n>]",
    "    [--fx-snapshot-file <json>] [--pricing-buffer-pct <non-negative-number>]",
    "  node scripts/fetch2-wmd-roll-labels.mjs import [--input <json>] [--dry-run]",
    "    [--out-dir <path>]",
    "    [--tenant-id <uuid>] [--product-name <name>] [--product-slug <slug>] [--category <name>] [--description <text>]",
    "    [--quantities <csv>] [--delivery-mode cheapest|fastest|both] [--rounding-step <integer>] [--publish]",
    "    [--fx-snapshot-file <json>] [--pricing-buffer-pct <non-negative-number>] [--write-snapshot-draft]",
    "    [--target-product-id <uuid> --expected-target-revision <positive-integer>] [--import-id <uuid>]",
    "",
    "Notes:",
    "  - Uses /wmdrest/article/get-price and related endpoints.",
    "  - Circle rows are derived from rectangle quotes (same price, radius = min(width,height)/2).",
    "  - Markup rule default: EUR*7.6 then +70%, but when base DKK > 3000 then +60%.",
    "  - Snapshot mode reads an already captured local file; it never fetches an FX provider.",
    "  - Snapshot-priced writes require --write-snapshot-draft, --import-id <uuid>, and one atomic draft-only RPC.",
    "  - Base extraction price source is supplier net price (response.price).",
  ].join("\n");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function parseCsv(value) {
  return normalizeText(value)
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function parseNumberList(value) {
  return normalizeText(value)
    .split(",")
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num) && num > 0);
}

function parseSizeList(value) {
  const sizes = [];
  for (const token of parseCsv(value)) {
    const m = token.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
    if (!m) {
      throw new Error(`Invalid size token '${token}'. Use WxH in cm, e.g. 3x5`);
    }
    const widthCm = Number(m[1]);
    const heightCm = Number(m[2]);
    if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
      throw new Error(`Invalid size values in token '${token}'`);
    }
    sizes.push({ widthCm, heightCm });
  }
  return sizes;
}

function getArgValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

function parseArgs(argv) {
  const command = argv[2] || "";
  const url = getArgValue(argv, "--url") || DEFAULT_URL;
  const outDir = getArgValue(argv, "--out-dir") || DEFAULT_OUT_DIR;
  const headless = argv.includes("--headless");
  const headful = argv.includes("--headful");

  const materials = parseCsv(getArgValue(argv, "--materials") || "");
  const quantities = parseNumberList(getArgValue(argv, "--quantities") || "");
  const sizesRaw = getArgValue(argv, "--sizes");
  const sizes = sizesRaw ? parseSizeList(sizesRaw) : DEFAULT_SIZES_CM;
  const shapes = parseCsv(getArgValue(argv, "--shapes") || DEFAULT_SHAPES.join(","))
    .map((x) => normalizeKey(x))
    .filter((x) => x === "rectangle" || x === "circle");

  const limitMaterials = Number(getArgValue(argv, "--limit-materials") || 0) || 0;
  const limitQuantities = Number(getArgValue(argv, "--limit-quantities") || 0) || 0;
  const limitSizes = Number(getArgValue(argv, "--limit-sizes") || 0) || 0;
  const limitDeliveries = Number(getArgValue(argv, "--limit-deliveries") || 0) || 0;

  const eurToDkk = Number(getArgValue(argv, "--eur-to-dkk") || DEFAULT_FX);
  const markupLowPct = Number(
    getArgValue(argv, "--markup-low-pct") || DEFAULT_MARKUP_UNDER_OR_EQ_THRESHOLD
  );
  const markupHighPct = Number(
    getArgValue(argv, "--markup-high-pct") || DEFAULT_MARKUP_OVER_THRESHOLD
  );
  const thresholdDkk = Number(getArgValue(argv, "--threshold-dkk") || DEFAULT_THRESHOLD_DKK);
  const hasRoundingStepFlag = argv.includes("--rounding-step");
  const roundingStep = Number(getArgValue(argv, "--rounding-step") || DEFAULT_ROUNDING_STEP);
  const hasFxSnapshotFlag = argv.includes("--fx-snapshot-file");
  const fxSnapshotFile = getArgValue(argv, "--fx-snapshot-file");
  const hasPricingBufferFlag = argv.includes("--pricing-buffer-pct");
  const pricingBufferValue = getArgValue(argv, "--pricing-buffer-pct");
  const pricingBufferPct = pricingBufferValue === null ? null : Number(pricingBufferValue);
  const inputPath = getArgValue(argv, "--input");
  const dryRun = argv.includes("--dry-run");
  const publish = argv.includes("--publish");
  const tenantId = getArgValue(argv, "--tenant-id") || DEFAULT_TENANT_ID;
  const productName = normalizeText(getArgValue(argv, "--product-name") || DEFAULT_PRODUCT_NAME);
  const productSlug = normalizeText(getArgValue(argv, "--product-slug") || DEFAULT_PRODUCT_SLUG);
  const category = normalizeText(getArgValue(argv, "--category") || DEFAULT_PRODUCT_CATEGORY);
  const description = normalizeText(getArgValue(argv, "--description") || DEFAULT_PRODUCT_DESCRIPTION);
  const deliveryMode = normalizeKey(getArgValue(argv, "--delivery-mode") || DEFAULT_DELIVERY_MODE);
  const targetProductId = getArgValue(argv, "--target-product-id");
  const expectedTargetRevisionValue = getArgValue(argv, "--expected-target-revision");
  const expectedTargetRevision = expectedTargetRevisionValue === null
    ? null
    : Number(expectedTargetRevisionValue);
  const importId = getArgValue(argv, "--import-id");
  const writeSnapshotDraft = argv.includes("--write-snapshot-draft");

  if (!["probe", "extract", "import"].includes(command)) {
    throw new Error("Command must be 'probe', 'extract', or 'import'");
  }
  if (!Number.isFinite(eurToDkk) || eurToDkk <= 0) throw new Error("--eur-to-dkk must be > 0");
  if (!Number.isFinite(markupLowPct) || markupLowPct < 0) throw new Error("--markup-low-pct must be >= 0");
  if (!Number.isFinite(markupHighPct) || markupHighPct < 0)
    throw new Error("--markup-high-pct must be >= 0");
  if (!Number.isFinite(thresholdDkk) || thresholdDkk <= 0) throw new Error("--threshold-dkk must be > 0");
  if (!Number.isFinite(roundingStep) || roundingStep <= 0) throw new Error("--rounding-step must be > 0");
  if (
    expectedTargetRevisionValue !== null &&
    (!Number.isSafeInteger(expectedTargetRevision) || expectedTargetRevision < 0)
  ) {
    throw new Error("--expected-target-revision must be a non-negative integer");
  }
  if (hasFxSnapshotFlag && !fxSnapshotFile) {
    throw new Error("--fx-snapshot-file requires a JSON file path");
  }
  if (hasPricingBufferFlag && pricingBufferValue === null) {
    throw new Error("--pricing-buffer-pct requires a value");
  }
  if (pricingBufferPct !== null && (!Number.isFinite(pricingBufferPct) || pricingBufferPct < 0)) {
    throw new Error("--pricing-buffer-pct must be a non-negative number");
  }
  if (hasPricingBufferFlag && !hasFxSnapshotFlag) {
    throw new Error("--pricing-buffer-pct requires --fx-snapshot-file");
  }
  if (command === "probe" && hasFxSnapshotFlag) {
    throw new Error("--fx-snapshot-file is supported only for extract or import");
  }
  if (command === "extract" && !shapes.length) {
    throw new Error("--shapes must include rectangle and/or circle");
  }
  if (command === "import" && !["cheapest", "fastest", "both"].includes(deliveryMode)) {
    throw new Error("--delivery-mode must be one of: cheapest, fastest, both");
  }
  if (writeSnapshotDraft && !importId) {
    throw new Error("--write-snapshot-draft requires --import-id <uuid>");
  }

  return {
    command,
    url,
    outDir,
    headless: headful ? false : headless ? true : true,
    materials,
    quantities: quantities.length ? quantities : DEFAULT_QUANTITIES,
    sizes,
    shapes,
    limitMaterials,
    limitQuantities,
    limitSizes,
    limitDeliveries,
    eurToDkk,
    markupLowPct,
    markupHighPct,
    thresholdDkk,
    roundingStep,
    hasRoundingStepFlag,
    fxSnapshotFile,
    pricingBufferPct,
    hasPricingBufferFlag,
    inputPath,
    dryRun,
    publish,
    writeSnapshotDraft: argv.includes("--write-snapshot-draft"),
    tenantId,
    productName,
    productSlug,
    category,
    description,
    deliveryMode,
    targetProductId,
    expectedTargetRevision,
    importId,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function convertEurToDkk(eurNet, cfg) {
  const converted = applyConversionRule(eurNet, {
    type: "threshold_markup",
    eurToDkk: cfg.eurToDkk,
    thresholdDkk: cfg.thresholdDkk,
    markupLowPct: cfg.markupLowPct,
    markupHighPct: cfg.markupHighPct,
    roundingStep: cfg.roundingStep,
  });
  return {
    eurNet,
    baseDkk: converted.convertedPriceDkk,
    markupPct: converted.markupPct,
    finalDkk: converted.finalPriceDkk,
  };
}

function convertSupplierEurToDkk(eurNet, cfg, snapshotPricing) {
  if (!snapshotPricing) return convertEurToDkk(eurNet, cfg);

  const pricingEvidence = applySnapshotPricing({
    supplierPrice: eurNet,
    fxSnapshot: snapshotPricing.fxSnapshot.snapshot,
    fxSnapshotId: snapshotPricing.fxSnapshot.id,
    pricingBuffer: {
      type: "percent",
      value: snapshotPricing.pricingBufferPct,
    },
    markupPolicy: {
      type: "threshold_percent",
      thresholdDkk: cfg.thresholdDkk,
      atOrBelowValue: cfg.markupLowPct,
      aboveValue: cfg.markupHighPct,
    },
    roundingStepDkk: cfg.roundingStep,
  });

  return {
    eurNet,
    baseDkk: pricingEvidence.convertedPriceDkk,
    markupPct: pricingEvidence.markup.value,
    unroundedFinalDkk: pricingEvidence.unroundedFinalPriceDkk,
    finalDkk: pricingEvidence.finalPriceDkk,
    pricingEvidence,
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filePath, rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findLatestExtractionFile(outDir, prefix = DEFAULT_IMPORT_PREFIX) {
  const absDir = path.resolve(process.cwd(), outDir);
  if (!fs.existsSync(absDir)) {
    throw new Error(`Output directory does not exist: ${absDir}`);
  }

  const candidates = fs
    .readdirSync(absDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => {
      const full = path.join(absDir, name);
      const stat = fs.statSync(full);
      return { full, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!candidates.length) {
    throw new Error(`No extraction JSON found in ${absDir}`);
  }

  return candidates[0].full;
}

function resolveImportInputPath(args) {
  if (args.inputPath) {
    const input = path.resolve(process.cwd(), args.inputPath);
    if (!fs.existsSync(input)) {
      throw new Error(`Input file not found: ${input}`);
    }
    return input;
  }
  return findLatestExtractionFile(args.outDir);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactStringKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.every((key) => typeof key === "string") &&
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => keys.includes(key))
  );
}

function normalizeFxSnapshotBundle(value) {
  try {
    let id;
    let snapshotInput;
    if (isPlainObject(value) && Object.hasOwn(value, "snapshot")) {
      const keys = Reflect.ownKeys(value);
      const validWrapper =
        hasExactStringKeys(value, ["id", "snapshot"]) ||
        hasExactStringKeys(value, ["id", "replayed", "snapshot"]);
      if (!validWrapper || keys.some((key) => typeof key !== "string")) {
        throw new Error("invalid wrapper");
      }
      if (
        Object.hasOwn(value, "replayed") &&
        typeof value.replayed !== "boolean"
      ) {
        throw new Error("invalid replay flag");
      }
      id = value.id;
      snapshotInput = value.snapshot;
    } else {
      snapshotInput = value;
    }

    const snapshot = parseFxSnapshot(snapshotInput);
    const deterministicId =
      `frankfurter_ecb:${snapshot.rateDate}:${snapshot.sourcePayloadSha256}`;
    const resolvedId = id ?? deterministicId;
    if (
      typeof resolvedId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(resolvedId)
    ) {
      throw new Error("invalid snapshot id");
    }
    return { id: resolvedId, snapshot };
  } catch {
    throw new Error("Invalid immutable FX snapshot file");
  }
}

function readFxSnapshotFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    throw new Error("FX snapshot file was not found");
  }
  if (!stat.isFile() || stat.size <= 0 || stat.size > 64 * 1024) {
    throw new Error("FX snapshot file must be a non-empty JSON file below 64 KiB");
  }
  try {
    return normalizeFxSnapshotBundle(readJsonFile(absolutePath));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid immutable")) {
      throw error;
    }
    throw new Error("Invalid immutable FX snapshot file");
  }
}

function parseEmbeddedSnapshotPricing(value) {
  if (value === undefined) return null;
  if (!hasExactStringKeys(value, ["schemaVersion", "fxSnapshot", "pricingBufferPct"])) {
    throw new Error("Invalid embedded snapshot pricing evidence");
  }
  if (
    value.schemaVersion !== 1 ||
    !Number.isFinite(value.pricingBufferPct) ||
    value.pricingBufferPct < 0
  ) {
    throw new Error("Invalid embedded snapshot pricing evidence");
  }
  return {
    schemaVersion: 1,
    fxSnapshot: normalizeFxSnapshotBundle(value.fxSnapshot),
    pricingBufferPct: value.pricingBufferPct,
  };
}

function resolveSnapshotPricing(args, payload = null) {
  const embedded = parseEmbeddedSnapshotPricing(payload?.config?.snapshotPricing);
  const explicitBundle = args.fxSnapshotFile
    ? readFxSnapshotFile(args.fxSnapshotFile)
    : null;

  if (
    embedded &&
    explicitBundle &&
    (embedded.fxSnapshot.id !== explicitBundle.id ||
      JSON.stringify(embedded.fxSnapshot.snapshot) !==
        JSON.stringify(explicitBundle.snapshot))
  ) {
    throw new Error("The supplied FX snapshot does not match the extraction evidence");
  }
  if (!embedded && !explicitBundle) return null;

  return {
    schemaVersion: 1,
    fxSnapshot: explicitBundle ?? embedded.fxSnapshot,
    pricingBufferPct: args.hasPricingBufferFlag
      ? args.pricingBufferPct
      : (embedded?.pricingBufferPct ?? 0),
  };
}

function serializeSnapshotPricing(snapshotPricing) {
  if (!snapshotPricing) return null;
  return {
    schemaVersion: 1,
    fxSnapshot: {
      id: snapshotPricing.fxSnapshot.id,
      snapshot: snapshotPricing.fxSnapshot.snapshot,
    },
    pricingBufferPct: snapshotPricing.pricingBufferPct,
  };
}

function createSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Expected SUPABASE_URL/VITE_SUPABASE_URL and a Supabase key."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createSnapshotDraftServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing server-only Supabase env for snapshot draft write. Expected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildPointBuckets() {
  return new Map();
}

function addPointBucketValue(map, point, value) {
  if (!Number.isFinite(point) || !Number.isFinite(value)) return;
  if (!map.has(point)) map.set(point, []);
  map.get(point).push(value);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function reducePointBuckets(pointBuckets, strategy = "median") {
  const reduced = new Map();
  for (const [point, values] of pointBuckets.entries()) {
    if (!values.length) continue;
    let picked = null;
    if (strategy === "min") {
      picked = Math.min(...values);
    } else if (strategy === "max") {
      picked = Math.max(...values);
    } else {
      picked = median(values);
    }
    if (Number.isFinite(picked)) reduced.set(Number(point), Number(picked));
  }
  return reduced;
}

function buildTierSeriesFromPoints(pointToPriceMap) {
  const sorted = [...pointToPriceMap.entries()].sort((a, b) => a[0] - b[0]);
  return sorted.map(([fromM2, pricePerM2], idx) => {
    const next = sorted[idx + 1];
    return {
      from_m2: Number(fromM2),
      to_m2: next ? Number(next[0]) : null,
      price_per_m2: Number(pricePerM2),
      is_anchor: true,
      sort_order: idx,
    };
  });
}

function parseImportRows(payload, snapshotPricing = null, pricingConfig = null) {
  const sourceRows = Array.isArray(payload?.combinations) ? payload.combinations : [];
  const parsed = [];

  for (const row of sourceRows) {
    const materialId = normalizeText(row?.materialId || "");
    const materialLabel = normalizeText(row?.materialLabel || materialId || "Material");
    const areaM2 = toFiniteNumber(row?.areaM2);
    const quantity = toFiniteNumber(row?.quantity);
    let cheapestDkkFinal = toFiniteNumber(row?.cheapestDkkFinal);
    let fastestDkkFinal = toFiniteNumber(row?.fastestDkkFinal);
    let cheapestUnroundedDkkFinal = cheapestDkkFinal;
    let fastestUnroundedDkkFinal = fastestDkkFinal;
    if (snapshotPricing) {
      const cheapestEurNet = toFiniteNumber(row?.cheapestEurNet);
      const fastestEurNet = toFiniteNumber(row?.fastestEurNet);
      const cheapestConversion = Number.isFinite(cheapestEurNet)
        ? convertSupplierEurToDkk(cheapestEurNet, pricingConfig, snapshotPricing)
        : null;
      const fastestConversion = Number.isFinite(fastestEurNet)
        ? convertSupplierEurToDkk(fastestEurNet, pricingConfig, snapshotPricing)
        : null;
      cheapestDkkFinal = toFiniteNumber(cheapestConversion?.finalDkk);
      fastestDkkFinal = toFiniteNumber(fastestConversion?.finalDkk);
      cheapestUnroundedDkkFinal = toFiniteNumber(cheapestConversion?.unroundedFinalDkk);
      fastestUnroundedDkkFinal = toFiniteNumber(fastestConversion?.unroundedFinalDkk);
    }

    if (!Number.isFinite(areaM2) || !Number.isFinite(quantity)) continue;
    const totalAreaM2 = areaM2 * quantity;
    if (!Number.isFinite(totalAreaM2) || totalAreaM2 <= 0) continue;

    const cheapestPerM2Dkk = Number.isFinite(cheapestUnroundedDkkFinal)
      ? snapshotPricing
        ? deriveSnapshotUnitPrice(cheapestUnroundedDkkFinal, totalAreaM2)
        : cheapestUnroundedDkkFinal / totalAreaM2
      : null;
    const fastestPerM2Dkk = Number.isFinite(fastestUnroundedDkkFinal)
      ? snapshotPricing
        ? deriveSnapshotUnitPrice(fastestUnroundedDkkFinal, totalAreaM2)
        : fastestUnroundedDkkFinal / totalAreaM2
      : null;
    const fastestSurchargePerM2Dkk =
      snapshotPricing &&
      Number.isFinite(fastestUnroundedDkkFinal) &&
      Number.isFinite(cheapestUnroundedDkkFinal) &&
      fastestUnroundedDkkFinal > cheapestUnroundedDkkFinal
        ? deriveSnapshotUnitPrice(
            fastestUnroundedDkkFinal - cheapestUnroundedDkkFinal,
            totalAreaM2,
          )
        : null;

    parsed.push({
      materialId,
      materialLabel,
      quantity: Number(quantity),
      areaM2: Number(areaM2),
      totalAreaM2: Number(totalAreaM2),
      cheapestDeliveryOption: row?.cheapestDeliveryOption || null,
      fastestDeliveryOption: row?.fastestDeliveryOption || null,
      cheapestDkkFinal,
      fastestDkkFinal,
      cheapestPerM2Dkk,
      fastestPerM2Dkk,
      fastestSurchargePerM2Dkk,
    });
  }

  return parsed;
}

function buildSnapshotPricingPreview(payload, snapshotPricing, pricingConfig) {
  if (!snapshotPricing) return null;
  for (const row of Array.isArray(payload?.combinations) ? payload.combinations : []) {
    for (const candidate of [row?.cheapestEurNet, row?.fastestEurNet]) {
      const supplierPrice = toFiniteNumber(candidate);
      if (!Number.isFinite(supplierPrice)) continue;
      const evidence = convertSupplierEurToDkk(
        supplierPrice,
        pricingConfig,
        snapshotPricing,
      ).pricingEvidence;
      return {
        supplier_price_eur: evidence.supplierPrice,
        fx_rate: evidence.fxRate,
        converted_price_dkk: evidence.convertedPriceDkk,
        pricing_buffer_pct: evidence.pricingBuffer.value,
        pricing_buffer_amount_dkk: evidence.pricingBuffer.amountDkk,
        buffered_cost_dkk: evidence.bufferedCostDkk,
        markup_type: evidence.markup.type,
        markup_pct: evidence.markup.value,
        markup_amount_dkk: evidence.markup.amountDkk,
        final_price_dkk: evidence.finalPriceDkk,
      };
    }
  }
  return null;
}

function ensureImportQuantities(args, payload, parsedRows) {
  if (args.quantities?.length) {
    return [...new Set(args.quantities.map((q) => Math.round(q)).filter((q) => q > 0))].sort(
      (a, b) => a - b
    );
  }
  const payloadQuantities = Array.isArray(payload?.config?.quantities) ? payload.config.quantities : [];
  if (payloadQuantities.length) {
    return [...new Set(payloadQuantities.map((q) => Math.round(Number(q))).filter((q) => q > 0))].sort(
      (a, b) => a - b
    );
  }
  return [...new Set(parsedRows.map((row) => Math.round(row.quantity)).filter((q) => q > 0))].sort(
    (a, b) => a - b
  );
}

function basePerM2ForMode(row, deliveryMode) {
  if (deliveryMode === "fastest") {
    if (Number.isFinite(row.fastestPerM2Dkk)) return row.fastestPerM2Dkk;
    if (Number.isFinite(row.cheapestPerM2Dkk)) return row.cheapestPerM2Dkk;
    return null;
  }
  if (Number.isFinite(row.cheapestPerM2Dkk)) return row.cheapestPerM2Dkk;
  if (Number.isFinite(row.fastestPerM2Dkk)) return row.fastestPerM2Dkk;
  return null;
}

function deriveMaterialGroupLabel(name) {
  const label = normalizeText(name);
  const parts = label.split(":");
  if (parts.length >= 2) {
    return normalizeText(parts[0]);
  }
  return "Material";
}

function buildImportMaterialModels(parsedRows, deliveryMode) {
  const order = [];
  const byMaterial = new Map();

  for (const row of parsedRows) {
    const key = normalizeKey(row.materialLabel || row.materialId);
    if (!key) continue;
    if (!byMaterial.has(key)) {
      byMaterial.set(key, {
        materialId: row.materialId,
        materialLabel: row.materialLabel,
        pointBuckets: buildPointBuckets(),
      });
      order.push(key);
    }
    const selectedPerM2 = basePerM2ForMode(row, deliveryMode);
    addPointBucketValue(byMaterial.get(key).pointBuckets, row.totalAreaM2, selectedPerM2);
  }

  const models = [];
  for (const key of order) {
    const item = byMaterial.get(key);
    const reduced = reducePointBuckets(item.pointBuckets, "median");
    const tiers = buildTierSeriesFromPoints(reduced);
    if (!tiers.length) continue;
    models.push({
      materialId: item.materialId,
      name: item.materialLabel,
      groupLabel: deriveMaterialGroupLabel(item.materialLabel),
      tiers,
    });
  }
  return models;
}

function buildImportDeliveryVariants(parsedRows, deliveryMode) {
  if (deliveryMode !== "both") return [];

  const deltaBuckets = buildPointBuckets();
  for (const row of parsedRows) {
    if (!Number.isFinite(row.fastestPerM2Dkk) || !Number.isFinite(row.cheapestPerM2Dkk)) continue;
    const delta = Number.isFinite(row.fastestSurchargePerM2Dkk)
      ? row.fastestSurchargePerM2Dkk
      : row.fastestPerM2Dkk - row.cheapestPerM2Dkk;
    if (!Number.isFinite(delta) || delta <= 0) continue;
    addPointBucketValue(deltaBuckets, row.totalAreaM2, delta);
  }

  const reduced = reducePointBuckets(deltaBuckets, "median");
  const fastTiers = buildTierSeriesFromPoints(reduced);
  if (!fastTiers.length) {
    return [];
  }

  return [
    {
      key: "standard-production",
      name: "Standard production",
      pricing_mode: "fixed",
      tiers: [],
    },
    {
      key: "fast-production",
      name: "Fast production",
      pricing_mode: "per_m2",
      tiers: fastTiers,
    },
  ];
}

function buildShapeVariants() {
  return DEFAULT_SHAPE_OPTIONS.map((shape) => ({
    key: shape.key,
    name: shape.name,
    pricing_mode: "fixed",
    tiers: [],
  }));
}

function isMissingTableError(error) {
  const message = error?.message || "";
  return message.includes("Could not find the table");
}

function assertNoError(error, context) {
  if (!error) return;
  const message = error.message || String(error);
  throw new Error(`${context}: ${message}`);
}

async function bootstrapPage(url, headless) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);

  for (const label of ["Ich stimme zu", "Accept", "Akzeptieren"]) {
    const btn = page.getByRole("button", { name: label });
    if ((await btn.count()) > 0) {
      try {
        await btn.first().click({ timeout: 1500 });
        await page.waitForTimeout(400);
      } catch {
        // ignore
      }
      break;
    }
  }

  return { browser, page };
}

async function readConfigFromPage(page) {
  return page.evaluate(() => {
    const q = (selector) => document.querySelector(selector);
    const qa = (selector) => Array.from(document.querySelectorAll(selector));
    const val = (selector) => q(selector)?.value || "";
    const txt = (selector) => (q(selector)?.textContent || "").replace(/\s+/g, " ").trim();
    const getFieldId = (name) => {
      const a = (name || "").indexOf("[");
      const b = (name || "").indexOf("]");
      if (a === -1 || b === -1 || b <= a + 1) return null;
      return name.slice(a + 1, b);
    };

    const materials = qa("#sorten option").map((opt) => ({
      id: String(opt.value),
      label: (opt.textContent || "").replace(/\s+/g, " ").trim(),
      selected: opt.selected,
    }));

    const additionalUpsells = {};
    const additionalUpsellsMeta = [];
    qa("select[name^='zusatzfeld[']").forEach((sel) => {
      const fieldId = getFieldId(sel.name);
      if (!fieldId) return;
      const selected = sel.options[sel.selectedIndex];
      const options = Array.from(sel.options).map((opt) => {
        let optionId = null;
        if (opt.id && opt.id.includes("_")) {
          const parts = opt.id.split("_");
          optionId = Number(parts[1]) || null;
        }
        return {
          optionId,
          value: opt.value,
          label: (opt.textContent || "").replace(/\s+/g, " ").trim(),
          selected: opt.selected,
        };
      });
      additionalUpsellsMeta.push({
        fieldId,
        name: sel.name,
        options,
      });
      if (selected && selected.value !== "-1") {
        let optionId = null;
        if (selected.id && selected.id.includes("_")) {
          const parts = selected.id.split("_");
          optionId = Number(parts[1]) || null;
        }
        additionalUpsells[fieldId] = {
          id: optionId,
          value: selected.value,
        };
      }
    });

    const articleOptions = qa("input[type='checkbox']")
      .filter((el) => el.checked && el.name && el.name.startsWith("option["))
      .map((el) => Number(getFieldId(el.name)))
      .filter((num) => Number.isFinite(num));

    const deliveryOptions = qa("input[name='deliveryOption']").map((el) => ({
      value: String(el.value),
      id: el.id || "",
      checked: !!el.checked,
    }));

    return {
      token: val("input[name='_token']"),
      articleId: val("input[name='c']"),
      categoryId: val("input[name='categoryId']"),
      shopId: val("input[name='shopId']"),
      userId: val("input[name='userId']"),
      forwardingShipment: val("input[name='forwardingShipment']"),
      keyword: val("#stichwort"),
      ownPrintData: q("#own_print_data_option")?.checked ? "1" : "0",
      materials,
      articleOptions,
      additionalUpsells,
      additionalUpsellsMeta,
      deliveryOptions,
      minWidthCmHint:
        Number((txt("body").match(/Mindestbreite von\s*([0-9]+)\s*cm/i) || [])[1]) || null,
      minHeightCmHint:
        Number((txt("body").match(/Mindesthöhe von\s*([0-9]+)\s*cm/i) || [])[1]) || null,
      maxCmHint:
        Number((txt("body").match(/max\.\s*Druckbreite[^0-9]*([0-9]+)\s*cm/i) || [])[1]) || 20,
    };
  });
}

async function callGetPrice(page, payload, retries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await page.evaluate(async (body) => {
        const res = await fetch("/wmdrest/article/get-price", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        return {
          status: res.status,
          ok: res.ok,
          json,
        };
      }, payload);
      if (!result?.ok || result?.status !== 200) {
        throw new Error(`get-price failed with status ${result?.status ?? "unknown"}`);
      }
      return result.json;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(350 * attempt);
    }
  }
  throw lastErr || new Error("get-price failed");
}

function buildPayload(base, dynamic) {
  return {
    token: base.token,
    isIndividualQuantity: false,
    categoryId: base.categoryId,
    shopId: base.shopId,
    userId: base.userId,
    articleId: base.articleId,
    quantity: String(dynamic.quantity),
    substrateId: String(dynamic.substrateId),
    additionalUpsells: base.additionalUpsells,
    width: String(dynamic.widthCm),
    height: String(dynamic.heightCm),
    ownPrintData: base.ownPrintData,
    articleOptions: base.articleOptions,
    deliveryOption: String(dynamic.deliveryOption),
    forwardingShipment: base.forwardingShipment || "",
    keyword: base.keyword || "",
    remarks: "",
    referenceTxt: "",
    voucherCode: "",
  };
}

function pickFastestAndCheapest(deliveries) {
  if (!deliveries.length) return { cheapest: null, fastest: null };
  const sortedByPrice = [...deliveries].sort((a, b) => a.priceEurNet - b.priceEurNet);
  const sortedByCharge = [...deliveries].sort((a, b) => a.deliveryChargeEur - b.deliveryChargeEur);
  const cheapest = sortedByPrice[0] || null;
  const fastest = sortedByCharge[sortedByCharge.length - 1] || sortedByPrice[sortedByPrice.length - 1] || null;
  return { cheapest, fastest };
}

function materialMatch(material, filters) {
  if (!filters.length) return true;
  const labelKey = normalizeKey(material.label);
  const idKey = normalizeKey(material.id);
  return filters.some((f) => {
    const key = normalizeKey(f);
    return key === idKey || labelKey.includes(key);
  });
}

async function runProbe(args) {
  const { browser, page } = await bootstrapPage(args.url, args.headless);
  try {
    const cfg = await readConfigFromPage(page);
    const output = {
      url: args.url,
      articleId: cfg.articleId,
      categoryId: cfg.categoryId,
      shopId: cfg.shopId,
      userId: cfg.userId,
      maxCmHint: cfg.maxCmHint,
      minWidthCmHint: cfg.minWidthCmHint,
      minHeightCmHint: cfg.minHeightCmHint,
      materialsCount: cfg.materials.length,
      materials: cfg.materials,
      deliveryOptions: cfg.deliveryOptions,
      additionalUpsellsMeta: cfg.additionalUpsellsMeta,
      articleOptionsDefault: cfg.articleOptions,
    };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await browser.close();
  }
}

async function runExtract(args) {
  const snapshotPricing = resolveSnapshotPricing(args);
  const { browser, page } = await bootstrapPage(args.url, args.headless);
  try {
    const cfg = await readConfigFromPage(page);

    let materials = cfg.materials.filter((m) => materialMatch(m, args.materials));
    if (args.limitMaterials > 0) materials = materials.slice(0, args.limitMaterials);

    let quantities = [...args.quantities];
    if (args.limitQuantities > 0) quantities = quantities.slice(0, args.limitQuantities);

    let sizes = [...args.sizes].filter(
      (s) =>
        Number.isFinite(s.widthCm) &&
        Number.isFinite(s.heightCm) &&
        s.widthCm > 0 &&
        s.heightCm > 0 &&
        s.widthCm <= cfg.maxCmHint &&
        s.heightCm <= cfg.maxCmHint
    );
    if (args.limitSizes > 0) sizes = sizes.slice(0, args.limitSizes);

    let deliveryOptions = [...cfg.deliveryOptions];
    if (args.limitDeliveries > 0) deliveryOptions = deliveryOptions.slice(0, args.limitDeliveries);

    if (!materials.length) {
      throw new Error("No materials matched. Use --materials or run probe.");
    }
    if (!quantities.length) throw new Error("No quantities selected.");
    if (!sizes.length) throw new Error("No valid sizes selected.");
    if (!deliveryOptions.length) throw new Error("No delivery options found.");

    const quotes = [];
    const skipped = [];

    for (const material of materials) {
      for (const size of sizes) {
        for (const quantity of quantities) {
          const deliveryRows = [];
          for (const delivery of deliveryOptions) {
            const payload = buildPayload(cfg, {
              quantity,
              substrateId: material.id,
              widthCm: size.widthCm,
              heightCm: size.heightCm,
              deliveryOption: delivery.value,
            });

            try {
              const json = await callGetPrice(page, payload);
              const resp = json?.data?.response;
              if (!resp || resp.currency !== "EUR") {
                throw new Error("Malformed get-price response");
              }

              const eurNet = parsePositiveSupplierPrice(resp.price);
              const deliveryChargeEur = Number(resp.deliveryCharge || 0) || 0;
              const converted = convertSupplierEurToDkk(
                eurNet,
                args,
                snapshotPricing,
              );
              const areaCm2 = size.widthCm * size.heightCm;
              const areaM2 = areaCm2 / 10000;
              const pricePerM2Eur = areaM2 > 0 ? eurNet / areaM2 : null;
              const pricePerM2Dkk = areaM2 > 0 ? converted.finalDkk / areaM2 : null;

              const row = {
                sourceUrl: args.url,
                articleId: cfg.articleId,
                categoryId: cfg.categoryId,
                materialId: material.id,
                materialLabel: material.label,
                quantity,
                widthCm: size.widthCm,
                heightCm: size.heightCm,
                areaCm2,
                areaM2,
                deliveryOption: delivery.value,
                deliveryInputId: delivery.id,
                deliveryChargeEur,
                currency: resp.currency,
                priceScaleId: resp.priceScaleId || null,
                eurNet,
                eurWithTax: Number(resp.priceWithTax || 0) || null,
                basePriceEur: Number(resp.basePrice || 0) || null,
                dkkBase: converted.baseDkk,
                appliedMarkupPct: converted.markupPct,
                dkkFinal: converted.finalDkk,
                dkkPerM2: pricePerM2Dkk,
                eurPerM2: pricePerM2Eur,
                payload,
                ...(converted.pricingEvidence
                  ? { pricingEvidence: converted.pricingEvidence }
                  : {}),
              };

              deliveryRows.push(row);
              quotes.push({ ...row, shape: "rectangle", radiusCm: null });
            } catch (err) {
              skipped.push({
                materialId: material.id,
                materialLabel: material.label,
                quantity,
                widthCm: size.widthCm,
                heightCm: size.heightCm,
                deliveryOption: delivery.value,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          if (args.shapes.includes("circle") && deliveryRows.length) {
            const radiusCm = Math.min(size.widthCm, size.heightCm) / 2;
            for (const row of deliveryRows) {
              quotes.push({
                ...row,
                shape: "circle",
                radiusCm,
              });
            }
          }
        }
      }
    }

    const grouped = new Map();
    for (const row of quotes.filter((r) => r.shape === "rectangle")) {
      const key = [
        row.materialId,
        row.quantity,
        row.widthCm,
        row.heightCm,
      ].join("|");
      const arr = grouped.get(key) || [];
      arr.push(row);
      grouped.set(key, arr);
    }

    const combinations = [];
    for (const [key, rows] of grouped.entries()) {
      const [materialId, quantity, widthCm, heightCm] = key.split("|");
      const first = rows[0];
      const { cheapest, fastest } = pickFastestAndCheapest(
        rows.map((r) => ({
          deliveryOption: r.deliveryOption,
          deliveryChargeEur: r.deliveryChargeEur,
          priceEurNet: r.eurNet,
          priceDkkFinal: r.dkkFinal,
          pricingEvidence: r.pricingEvidence ?? null,
        }))
      );
      combinations.push({
        materialId,
        materialLabel: first.materialLabel,
        quantity: Number(quantity),
        widthCm: Number(widthCm),
        heightCm: Number(heightCm),
        areaCm2: first.areaCm2,
        areaM2: first.areaM2,
        cheapestDeliveryOption: cheapest?.deliveryOption ?? null,
        cheapestEurNet: cheapest?.priceEurNet ?? null,
        cheapestDkkFinal: cheapest?.priceDkkFinal ?? null,
        ...(cheapest?.pricingEvidence
          ? { cheapestPricingEvidence: cheapest.pricingEvidence }
          : {}),
        fastestDeliveryOption: fastest?.deliveryOption ?? null,
        fastestEurNet: fastest?.priceEurNet ?? null,
        fastestDkkFinal: fastest?.priceDkkFinal ?? null,
        ...(fastest?.pricingEvidence
          ? { fastestPricingEvidence: fastest.pricingEvidence }
          : {}),
      });
    }

    ensureDir(args.outDir);
    const stamp = timestamp();
    const baseName = `wmd-roll-labels-free-size-${stamp}`;
    const jsonPath = path.join(args.outDir, `${baseName}.json`);
    const csvPath = path.join(args.outDir, `${baseName}.csv`);
    const summaryCsvPath = path.join(args.outDir, `${baseName}.summary.csv`);

    const output = {
      generatedAt: new Date().toISOString(),
      source: {
        url: args.url,
        articleId: cfg.articleId,
        categoryId: cfg.categoryId,
        maxCmHint: cfg.maxCmHint,
      },
      config: {
        quantities,
        sizes,
        shapes: args.shapes,
        materialsFilter: args.materials,
        deliveryOptions: deliveryOptions.map((d) => d.value),
        fx: args.eurToDkk,
        markupLowPct: args.markupLowPct,
        markupHighPct: args.markupHighPct,
        thresholdDkk: args.thresholdDkk,
        roundingStep: args.roundingStep,
        ...(snapshotPricing
          ? { snapshotPricing: serializeSnapshotPricing(snapshotPricing) }
          : {}),
      },
      counts: {
        quotes: quotes.length,
        combinations: combinations.length,
        skipped: skipped.length,
      },
      quotes,
      combinations,
      skipped,
    };

    fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

    writeCsv(
      csvPath,
      quotes.map((r) => ({
        shape: r.shape,
        radius_cm: r.radiusCm ?? "",
        material_id: r.materialId,
        material_label: r.materialLabel,
        quantity: r.quantity,
        width_cm: r.widthCm,
        height_cm: r.heightCm,
        area_cm2: r.areaCm2,
        area_m2: r.areaM2,
        delivery_option: r.deliveryOption,
        delivery_charge_eur: r.deliveryChargeEur,
        eur_net: r.eurNet,
        eur_with_tax: r.eurWithTax ?? "",
        dkk_base: r.dkkBase,
        markup_pct: r.appliedMarkupPct,
        dkk_final: r.dkkFinal,
        eur_per_m2: r.eurPerM2 ?? "",
        dkk_per_m2: r.dkkPerM2 ?? "",
        price_scale_id: r.priceScaleId ?? "",
        fx_snapshot_id: r.pricingEvidence?.fxSnapshotId ?? "",
        fx_provider: r.pricingEvidence?.fxProvider ?? "",
        fx_rate: r.pricingEvidence?.fxRate ?? "",
        fx_rate_date: r.pricingEvidence?.fxRateDate ?? "",
        fx_digest: r.pricingEvidence?.fxSourcePayloadSha256 ?? "",
        converted_price_dkk: r.pricingEvidence?.convertedPriceDkk ?? "",
        pricing_buffer_pct: r.pricingEvidence?.pricingBuffer?.value ?? "",
        pricing_buffer_amount_dkk:
          r.pricingEvidence?.pricingBuffer?.amountDkk ?? "",
        buffered_cost_dkk: r.pricingEvidence?.bufferedCostDkk ?? "",
        markup_type: r.pricingEvidence?.markup?.type ?? "",
        snapshot_markup_pct: r.pricingEvidence?.markup?.value ?? "",
        markup_amount_dkk: r.pricingEvidence?.markup?.amountDkk ?? "",
        snapshot_final_price_dkk: r.pricingEvidence?.finalPriceDkk ?? "",
      })),
      [
        "shape",
        "radius_cm",
        "material_id",
        "material_label",
        "quantity",
        "width_cm",
        "height_cm",
        "area_cm2",
        "area_m2",
        "delivery_option",
        "delivery_charge_eur",
        "eur_net",
        "eur_with_tax",
        "dkk_base",
        "markup_pct",
        "dkk_final",
        "eur_per_m2",
        "dkk_per_m2",
        "price_scale_id",
        ...(snapshotPricing
          ? [
              "fx_snapshot_id",
              "fx_provider",
              "fx_rate",
              "fx_rate_date",
              "fx_digest",
              "converted_price_dkk",
              "pricing_buffer_pct",
              "pricing_buffer_amount_dkk",
              "buffered_cost_dkk",
              "markup_type",
              "snapshot_markup_pct",
              "markup_amount_dkk",
              "snapshot_final_price_dkk",
            ]
          : []),
      ]
    );

    writeCsv(
      summaryCsvPath,
      combinations.map((r) => ({
        material_id: r.materialId,
        material_label: r.materialLabel,
        quantity: r.quantity,
        width_cm: r.widthCm,
        height_cm: r.heightCm,
        area_cm2: r.areaCm2,
        area_m2: r.areaM2,
        cheapest_delivery_option: r.cheapestDeliveryOption ?? "",
        cheapest_eur_net: r.cheapestEurNet ?? "",
        cheapest_dkk_final: r.cheapestDkkFinal ?? "",
        fastest_delivery_option: r.fastestDeliveryOption ?? "",
        fastest_eur_net: r.fastestEurNet ?? "",
        fastest_dkk_final: r.fastestDkkFinal ?? "",
      })),
      [
        "material_id",
        "material_label",
        "quantity",
        "width_cm",
        "height_cm",
        "area_cm2",
        "area_m2",
        "cheapest_delivery_option",
        "cheapest_eur_net",
        "cheapest_dkk_final",
        "fastest_delivery_option",
        "fastest_eur_net",
        "fastest_dkk_final",
      ]
    );

    const report = {
      jsonPath,
      csvPath,
      summaryCsvPath,
      counts: output.counts,
      materialsUsed: [...new Set(quotes.map((q) => `${q.materialId} ${q.materialLabel}`))].length,
      deliveriesUsed: [...new Set(quotes.map((q) => q.deliveryOption))],
      notes: [
        "Cheapest/Fastest summary computed from delivery-option quotes per material+size+quantity.",
        "Circle entries are derived from rectangle quotes.",
      ],
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

function buildSnapshotDraftImportPayload({
  importId,
  product,
  materialModels,
  variantModels,
  shapeModels,
  deliveryModels,
  maxMm,
  quantities,
  roundingStep,
  roundingMode,
}) {
  const stableChildId = (kind, index, content) => {
    const contentDigest = crypto
      .createHash("sha256")
      .update(JSON.stringify(content), "utf8")
      .digest("hex");
    return deriveSnapshotChildUuid(
      importId,
      `${kind}:${index}:${contentDigest}`,
    );
  };
  const materials = materialModels.map((material, idx) => ({
    id: stableChildId("material", idx, {
      name: material.name,
      groupLabel: material.groupLabel || "Material",
    }),
    name: material.name,
    group_label: material.groupLabel || "Material",
    bleed_mm: 3,
    safe_area_mm: 3,
    max_width_mm: maxMm,
    max_height_mm: maxMm,
    allow_split: false,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
  }));
  const materialIdByName = new Map(
    materials.map((row) => [normalizeKey(row.name), row.id]),
  );
  const materialPriceTiers = [];
  const materialM2Prices = [];
  materialModels.forEach((material, materialIndex) => {
    const materialId = materialIdByName.get(normalizeKey(material.name));
    if (!materialId) return;
    material.tiers.forEach((tier, idx) => {
      materialPriceTiers.push({
        id: stableChildId("material-price-tier", materialIndex, { idx, tier }),
        material_id: materialId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
      materialM2Prices.push({
        id: stableChildId("material-m2-price", materialIndex, { idx, tier }),
        material_id: materialId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
      });
    });
  });

  const variants = variantModels.map((variant, idx) => ({
    id: stableChildId("variant", idx, {
      key: variant.key,
      name: variant.name,
      pricingMode: variant.pricing_mode,
    }),
    name: variant.name,
    group_label: "Delivery",
    pricing_mode: variant.pricing_mode,
    initial_price: 0,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
    pricing_type: variant.pricing_mode === "per_m2" ? "m2" : "fixed",
    percentage_markup: 0,
    min_price: 0,
  }));
  const variantIdByKey = new Map(
    variantModels
      .map((variant, idx) => [variant.key, variants[idx]?.id])
      .filter((entry) => entry[1]),
  );
  const variantPriceTiers = [];
  const variantM2Prices = [];
  variantModels.forEach((variant, variantIndex) => {
    if (variant.pricing_mode !== "per_m2") return;
    const variantId = variantIdByKey.get(variant.key);
    if (!variantId) return;
    variant.tiers.forEach((tier, idx) => {
      variantPriceTiers.push({
        id: stableChildId("variant-price-tier", variantIndex, { idx, tier }),
        variant_id: variantId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
      variantM2Prices.push({
        id: stableChildId("variant-m2-price", variantIndex, { idx, tier }),
        variant_id: variantId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
      });
    });
  });

  const layoutRows = [];
  const shapeVariantIds = shapeModels
    .map((variant) => variantIdByKey.get(variant.key))
    .filter(Boolean);
  const deliveryVariantIds = deliveryModels
    .map((variant) => variantIdByKey.get(variant.key))
    .filter(Boolean);
  if (shapeVariantIds.length) {
    layoutRows.push({
      id: "row-shape",
      title: "Shape",
      sections: [
        {
          id: "section-shape-products",
          sectionType: "products",
          ui_mode: "buttons",
          selection_mode: "required",
          valueIds: shapeVariantIds,
          valueSettings: {},
        },
      ],
    });
  }
  if (deliveryVariantIds.length) {
    layoutRows.push({
      id: "row-delivery",
      title: "Delivery",
      sections: [
        {
          id: "section-delivery-products",
          sectionType: "products",
          ui_mode: "buttons",
          selection_mode: "required",
          valueIds: deliveryVariantIds,
          valueSettings: {},
        },
      ],
    });
  }

  return {
    product,
    materials,
    material_price_tiers: materialPriceTiers,
    material_m2_prices: materialM2Prices,
    variants,
    variant_price_tiers: variantPriceTiers,
    variant_m2_prices: variantM2Prices,
    config: {
      rounding_step: roundingStep,
      rounding_mode: roundingMode,
      quantities,
      layout_rows: layoutRows,
      vertical_axis: {
        id: "vertical-axis",
        sectionType: "materials",
        valueIds: materials.map((row) => row.id),
        valueSettings: {},
      },
    },
  };
}

async function runImport(args) {
  const inputPath = resolveImportInputPath(args);
  const payload = readJsonFile(inputPath);
  const snapshotPricing = resolveSnapshotPricing(args, payload);
  const embeddedRoundingStep =
    toFiniteNumber(payload?.config?.roundingStep) ?? args.roundingStep;
  const snapshotRoundingPolicy = snapshotPricing
    ? resolveSnapshotRoundingPolicy({
        embeddedRoundingStepDkk: embeddedRoundingStep,
        explicitRoundingStepDkk: args.roundingStep,
        hasExplicitRoundingStep: args.hasRoundingStepFlag,
      })
    : null;
  const pricingConfig = {
    ...args,
    markupLowPct:
      toFiniteNumber(payload?.config?.markupLowPct) ?? args.markupLowPct,
    markupHighPct:
      toFiniteNumber(payload?.config?.markupHighPct) ?? args.markupHighPct,
    thresholdDkk:
      toFiniteNumber(payload?.config?.thresholdDkk) ?? args.thresholdDkk,
    roundingStep: snapshotRoundingPolicy?.stepDkk ?? embeddedRoundingStep,
  };
  const parsedRows = parseImportRows(payload, snapshotPricing, pricingConfig);
  const snapshotPricingPreview = buildSnapshotPricingPreview(
    payload,
    snapshotPricing,
    pricingConfig,
  );

  if (!parsedRows.length) {
    throw new Error(
      `No importable rows found in ${inputPath}. Run extract first and verify combinations were captured.`
    );
  }

  const quantities = ensureImportQuantities(args, payload, parsedRows);
  if (!quantities.length) {
    throw new Error("No quantities available for storformat config.");
  }

  const materialModels = buildImportMaterialModels(parsedRows, args.deliveryMode);
  if (!materialModels.length) {
    throw new Error("No material m2 tiers could be built from extracted data.");
  }

  const shapeModels = buildShapeVariants();
  const deliveryModels = buildImportDeliveryVariants(parsedRows, args.deliveryMode);
  const variantModels = [...shapeModels, ...deliveryModels];
  const productName = normalizeText(args.productName) || DEFAULT_PRODUCT_NAME;
  const productSlug = slugify(args.productSlug || productName || DEFAULT_PRODUCT_SLUG) || DEFAULT_PRODUCT_SLUG;
  const productDescription = normalizeText(args.description) || DEFAULT_PRODUCT_DESCRIPTION;
  const roundingStep = snapshotRoundingPolicy?.stepDkk ??
    Math.max(1, Math.round(args.roundingStep));
  const roundingMode = snapshotRoundingPolicy?.mode ?? "nearest_v1";
  const maxCmHint = toFiniteNumber(payload?.source?.maxCmHint);
  const maxMm = Number.isFinite(maxCmHint) && maxCmHint > 0 ? Math.round(maxCmHint * 10) : null;

  const summary = {
    input: inputPath,
    tenant_id: args.tenantId,
    product: {
      name: productName,
      slug: productSlug,
      category: args.category,
      publish: !!args.publish,
    },
    delivery_mode: args.deliveryMode,
    counts: {
      parsed_rows: parsedRows.length,
      materials: materialModels.length,
      material_tiers: materialModels.reduce((acc, item) => acc + item.tiers.length, 0),
      product_variants: variantModels.length,
      shape_variants: shapeModels.length,
      delivery_variants: deliveryModels.length,
      quantities: quantities.length,
    },
    price_source: "supplier response.price (net)",
    ...(snapshotPricing
      ? {
          snapshot_pricing: {
            fx_snapshot_id: snapshotPricing.fxSnapshot.id,
            provider: snapshotPricing.fxSnapshot.snapshot.provider,
            rate: snapshotPricing.fxSnapshot.snapshot.rate,
            rate_date: snapshotPricing.fxSnapshot.snapshot.rateDate,
            source_payload_sha256:
              snapshotPricing.fxSnapshot.snapshot.sourcePayloadSha256,
            pricing_buffer_pct: snapshotPricing.pricingBufferPct,
            markup_at_or_below_pct: pricingConfig.markupLowPct,
            markup_above_pct: pricingConfig.markupHighPct,
            threshold_dkk: pricingConfig.thresholdDkk,
            rounding_step_dkk: pricingConfig.roundingStep,
            rounding_mode: roundingMode,
            preview: snapshotPricingPreview,
          },
        }
      : {}),
  };

  const draftProductPayload = {
    name: productName,
    slug: productSlug,
    icon_text: productName,
    description: productDescription,
    category: normalizeText(args.category) || DEFAULT_PRODUCT_CATEGORY,
    pricing_type: "STORFORMAT",
    preset_key: "custom",
    technical_specs: {
      source: "wmd",
      import_type: "fetch2-roll-labels",
      import_script: "fetch2-wmd-roll-labels.mjs",
      delivery_mode: args.deliveryMode,
      net_price_source: "response.price",
      ...(snapshotPricing
        ? {
            fx_snapshot_id: snapshotPricing.fxSnapshot.id,
            fx_provider: snapshotPricing.fxSnapshot.snapshot.provider,
            fx_rate: snapshotPricing.fxSnapshot.snapshot.rate,
            fx_rate_date: snapshotPricing.fxSnapshot.snapshot.rateDate,
            fx_fetched_at: snapshotPricing.fxSnapshot.snapshot.fetchedAt,
            fx_source_payload_sha256:
              snapshotPricing.fxSnapshot.snapshot.sourcePayloadSha256,
            pricing_buffer_pct: snapshotPricing.pricingBufferPct,
            rounding_step_dkk: roundingStep,
            rounding_mode: roundingMode,
          }
        : { eur_to_dkk: payload?.config?.fx ?? args.eurToDkk }),
      markup_low_pct: payload?.config?.markupLowPct ?? args.markupLowPct,
      markup_high_pct: payload?.config?.markupHighPct ?? args.markupHighPct,
      threshold_dkk: payload?.config?.thresholdDkk ?? args.thresholdDkk,
      max_size_cm: maxCmHint,
    },
  };

  if (args.dryRun) {
    console.log("Import dry-run summary:");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  assertSnapshotDraftWriteConfirmation({
    snapshotMode: Boolean(snapshotPricing),
    writeConfirmed: Boolean(args.writeSnapshotDraft),
  });
  assertSnapshotDraftWriteTarget({
    snapshotMode: Boolean(snapshotPricing),
    isPublished: Boolean(args.publish),
  });
  if (snapshotPricing) {
    const rpcPayload = buildSnapshotDraftImportPayload({
      importId: args.importId,
      product: draftProductPayload,
      materialModels,
      variantModels,
      shapeModels,
      deliveryModels,
      maxMm,
      quantities,
      roundingStep,
      roundingMode,
    });
    const payloadDigest = crypto
      .createHash("sha256")
      .update(JSON.stringify(rpcPayload), "utf8")
      .digest("hex");
    const target = buildSnapshotDraftTarget({
      mode: args.targetProductId ? "replace" : "create",
      productId: args.targetProductId,
      expectedRevision: args.expectedTargetRevision ?? 0,
      importId: args.importId,
      payloadDigest,
    });
    const client = createSnapshotDraftServiceClient();
    const { data: snapshotProductId, error: snapshotImportError } = await client
      .rpc("apply_wmd_roll_label_snapshot_draft_import", {
        _tenant_id: args.tenantId,
        _payload: { target, ...rpcPayload },
      });
    assertNoError(snapshotImportError, "Atomic snapshot draft import");
    if (typeof snapshotProductId !== "string" || !snapshotProductId) {
      throw new Error("Atomic snapshot draft import did not return a product id");
    }

    console.log("Import complete:");
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Product id: ${snapshotProductId}`);
    return;
  }

  const client = createSupabaseServiceClient();

  const productPayload = {
    tenant_id: args.tenantId,
    ...draftProductPayload,
    is_published: !!args.publish,
  };

  const { data: existingProduct, error: existingProductError } = await client
    .from("products")
    .select("id,is_published")
    .eq("tenant_id", args.tenantId)
    .eq("slug", productSlug)
    .maybeSingle();
  assertNoError(existingProductError, "Fetch existing product");

  assertSnapshotDraftWriteTarget({
    snapshotMode: Boolean(snapshotPricing),
    isPublished: Boolean(args.publish || existingProduct?.is_published),
  });

  let productId = existingProduct?.id || null;
  if (productId) {
    const { error } = await client.from("products").update(productPayload).eq("id", productId);
    assertNoError(error, "Update product");
  } else {
    const { data, error } = await client
      .from("products")
      .insert(productPayload)
      .select("id")
      .single();
    assertNoError(error, "Insert product");
    productId = data.id;
  }

  const deleteByProduct = async (tableName, options = {}) => {
    const { error } = await client.from(tableName).delete().eq("product_id", productId);
    if (error && options.ignoreMissingTable && isMissingTableError(error)) {
      console.warn(`Skipping ${tableName}: table not found in this schema`);
      return;
    }
    assertNoError(error, `Delete ${tableName}`);
  };

  await deleteByProduct("storformat_product_m2_prices", { ignoreMissingTable: true });
  await deleteByProduct("storformat_product_price_tiers");
  await deleteByProduct("storformat_product_fixed_prices");
  await deleteByProduct("storformat_m2_prices", { ignoreMissingTable: true });
  await deleteByProduct("storformat_finish_prices", { ignoreMissingTable: true });
  await deleteByProduct("storformat_material_price_tiers");
  await deleteByProduct("storformat_finish_price_tiers");
  await deleteByProduct("storformat_products");
  await deleteByProduct("storformat_finishes");
  await deleteByProduct("storformat_materials");

  const materialRows = materialModels.map((material, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    name: material.name,
    group_label: material.groupLabel || "Material",
    bleed_mm: 3,
    safe_area_mm: 3,
    max_width_mm: maxMm,
    max_height_mm: maxMm,
    allow_split: false,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
  }));

  if (materialRows.length) {
    const { error } = await client.from("storformat_materials").insert(materialRows);
    assertNoError(error, "Insert storformat_materials");
  }

  const materialIdByName = new Map(
    materialRows.map((row) => [normalizeKey(row.name), row.id])
  );
  const materialTierRows = [];
  const materialM2Rows = [];
  for (const material of materialModels) {
    const materialId = materialIdByName.get(normalizeKey(material.name));
    if (!materialId) continue;
    material.tiers.forEach((tier, idx) => {
      materialTierRows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        material_id: materialId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
      materialM2Rows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        material_id: materialId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
      });
    });
  }

  if (materialTierRows.length) {
    const { error } = await client.from("storformat_material_price_tiers").insert(materialTierRows);
    assertNoError(error, "Insert storformat_material_price_tiers");
  }
  if (materialM2Rows.length) {
    const { error } = await client.from("storformat_m2_prices").insert(materialM2Rows);
    if (error && isMissingTableError(error)) {
      console.warn("Skipping storformat_m2_prices insert: table not found in this schema");
    } else {
      assertNoError(error, "Insert storformat_m2_prices");
    }
  }

  const variantRows = variantModels.map((variant, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    name: variant.name,
    group_label: "Delivery",
    pricing_mode: variant.pricing_mode,
    initial_price: 0,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
    pricing_type: variant.pricing_mode === "per_m2" ? "m2" : "fixed",
    percentage_markup: 0,
    min_price: 0,
  }));
  if (variantRows.length) {
    const { error } = await client.from("storformat_products").insert(variantRows);
    assertNoError(error, "Insert storformat_products");
  }

  const variantIdByKey = new Map(
    variantModels.map((variant, idx) => [variant.key, variantRows[idx]?.id]).filter((entry) => entry[1])
  );
  const variantTierRows = [];
  const variantM2Rows = [];
  for (const variant of variantModels) {
    if (variant.pricing_mode !== "per_m2") continue;
    const variantId = variantIdByKey.get(variant.key);
    if (!variantId) continue;
    variant.tiers.forEach((tier, idx) => {
      variantTierRows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        product_item_id: variantId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
      variantM2Rows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        storformat_product_id: variantId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
      });
    });
  }

  if (variantTierRows.length) {
    const { error } = await client.from("storformat_product_price_tiers").insert(variantTierRows);
    assertNoError(error, "Insert storformat_product_price_tiers");
  }
  if (variantM2Rows.length) {
    const { error } = await client.from("storformat_product_m2_prices").insert(variantM2Rows);
    if (error && isMissingTableError(error)) {
      console.warn("Skipping storformat_product_m2_prices insert: table not found in this schema");
    } else {
      assertNoError(error, "Insert storformat_product_m2_prices");
    }
  }

  const shapeVariantIds = shapeModels
    .map((variant) => variantIdByKey.get(variant.key))
    .filter(Boolean);
  const deliveryVariantIds = deliveryModels
    .map((variant) => variantIdByKey.get(variant.key))
    .filter(Boolean);

  const layoutRows = [];
  if (shapeVariantIds.length) {
    layoutRows.push({
      id: "row-shape",
      title: "Shape",
      sections: [
        {
          id: "section-shape-products",
          sectionType: "products",
          ui_mode: "buttons",
          selection_mode: "required",
          valueIds: shapeVariantIds,
          valueSettings: {},
        },
      ],
    });
  }
  if (deliveryVariantIds.length) {
    layoutRows.push({
      id: "row-delivery",
      title: "Delivery",
      sections: [
        {
          id: "section-delivery-products",
          sectionType: "products",
          ui_mode: "buttons",
          selection_mode: "required",
          valueIds: deliveryVariantIds,
          valueSettings: {},
        },
      ],
    });
  }

  const configRow = {
    tenant_id: args.tenantId,
    product_id: productId,
    pricing_mode: "m2_rates",
    rounding_step: roundingStep,
    global_markup_pct: 0,
    quantities,
    layout_rows: layoutRows,
    vertical_axis: {
      id: "vertical-axis",
      sectionType: "materials",
      valueIds: materialRows.map((row) => row.id),
      valueSettings: {},
    },
    is_published: !!args.publish,
  };

  const { error: configError } = await client
    .from("storformat_configs")
    .upsert(configRow, { onConflict: "product_id" });
  assertNoError(configError, "Upsert storformat_configs");

  console.log("Import complete:");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Product id: ${productId}`);
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    if (args.command === "probe") {
      await runProbe(args);
      return;
    }
    if (args.command === "extract") {
      await runExtract(args);
      return;
    }
    if (args.command === "import") {
      await runImport(args);
      return;
    }
    throw new Error(`Unknown command '${args.command}'`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error("\n" + usage());
    process.exit(1);
  }
}

await main();
