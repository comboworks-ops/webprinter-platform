#!/usr/bin/env node
/**
 * fetch-pixart-flat-surface-adhesive-import.mjs
 *
 * Extracts Pixart wide-format quotes for material/lamination/size combinations
 * and saves import-ready m² tier data.
 *
 * Current scope:
 * - probe: discover available options
 * - extract: capture quote grid (EUR) and derive per-m² tiers
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const PROFILE_FLAT = "flat-surface-adhesive";
const PROFILE_RIGIDS = "rigids";

const DEFAULT_URL_BY_PROFILE = {
  [PROFILE_FLAT]:
    "https://www.pixartprinting.eu/wide-format/printing-self-adhesive-pvc/flat-surface-adhesive/",
  [PROFILE_RIGIDS]:
    "https://www.pixartprinting.eu/wide-format/printing-flat-bed-rigid-materials/rigids/",
};

const DEFAULT_MATERIALS = [
  "Matt Monomeric Self-Adhesive Vinyl",
  "Gloss Monomeric Self-Adhesive Vinyl",
  "Matt Monomeric Self-Adhesive Vinyl with Grey Back",
  "Gloss Polymeric Self-Adhesive Vinyl with grey back",
  "Transparent Self-Adhesive Vinyl",
  "Matt PVC-Free Film with Grey Back",
  "White PVC-Free EasyWall",
];

const DEFAULT_LAMINATIONS = [
  "None",
  "Standard Matt",
  "Standard Gloss",
  "UV Filter 5 Matt",
  "UV Filter 5 Gloss",
];

const DEFAULT_AREAS_M2 = [1, 2, 3, 4, 5, 10, 12, 15, 20];
const DEFAULT_QUANTITIES = Array.from({ length: 20 }, (_, idx) => idx + 1);
const DEFAULT_RIGIDS_CATEGORIES = [
  "Plastic",
  "Plexiglass",
  "Multi-layer materials",
  "Aluminium",
  "Cardboard",
];

const DEFAULT_OUT_DIR = "pricing_raw";
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME_BY_PROFILE = {
  [PROFILE_FLAT]: "Pixart Flat Surface Adhesive",
  [PROFILE_RIGIDS]: "Pixart Rigids",
};
const DEFAULT_PRODUCT_SLUG_BY_PROFILE = {
  [PROFILE_FLAT]: "pixart-flat-surface-adhesive",
  [PROFILE_RIGIDS]: "pixart-rigids",
};
const DEFAULT_CATEGORY = "storformat";
const DEFAULT_DESCRIPTION_BY_PROFILE = {
  [PROFILE_FLAT]: "Pixart wide-format self-adhesive import",
  [PROFILE_RIGIDS]: "Pixart wide-format rigid materials import",
};
const DEFAULT_EUR_TO_DKK = 7.6;
const DEFAULT_MARKUP_PCT = 80;
const DEFAULT_ROUNDING_STEP = 1;
const DEFAULT_PRICE_COLUMN = "cheapest";
const DEFAULT_IMPORT_FILE_PREFIX_BY_PROFILE = {
  [PROFILE_FLAT]: "pixart-flat-surface-adhesive-",
  [PROFILE_RIGIDS]: "pixart-rigids-",
};
const NONE_LAMINATION_KEY = "none";

function getProfileDefaults(profile) {
  const safeProfile = profile === PROFILE_RIGIDS ? PROFILE_RIGIDS : PROFILE_FLAT;
  return {
    profile: safeProfile,
    url: DEFAULT_URL_BY_PROFILE[safeProfile],
    productName: DEFAULT_PRODUCT_NAME_BY_PROFILE[safeProfile],
    productSlug: DEFAULT_PRODUCT_SLUG_BY_PROFILE[safeProfile],
    description: DEFAULT_DESCRIPTION_BY_PROFILE[safeProfile],
    importFilePrefix: DEFAULT_IMPORT_FILE_PREFIX_BY_PROFILE[safeProfile],
  };
}

function shouldLaunchHeadless(args, profile) {
  if (args.forceHeadless) return true;
  if (args.headful) return false;
  // Pixart rigids often suppresses quote grids in headless mode.
  if (profile === PROFILE_RIGIDS) return false;
  return true;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe [--profile flat-surface-adhesive|rigids] [--url <url>] [--categories <csv>] [--headful|--headless]",
    "  node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract [--profile flat-surface-adhesive|rigids] [--url <url>] [--headful|--headless] [--materials <csv>] [--laminations <csv>] [--categories <csv>] [--areas <csv>] [--quantities <csv>] [--width-cm <n>] [--limit-materials <n>] [--limit-laminations <n>] [--limit-areas <n>] [--limit-quantities <n>] [--out-dir <path>]",
    "  node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import [--profile flat-surface-adhesive|rigids] [--input <json>] [--dry-run] [--tenant-id <uuid>] [--product-name <name>] [--product-slug <slug>] [--product-prefix <name>] [--product-slug-prefix <slug>] [--category <name>] [--description <text>] [--categories <csv>] [--quantities <csv>] [--eur-to-dkk <number>] [--markup-pct <number>] [--rounding-step <number>] [--price-column cheapest|fastest] [--publish]",
  ].join("\n");
}

function normalizeLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return normalizeLabel(value).toLowerCase();
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeLabel(item))
    .filter(Boolean);
}

function parseNumberList(value) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num) && num > 0);
}

function getArgValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

function parseArgs(argv) {
  const command = argv[2] || "";
  const profileRaw = normalizeKey(getArgValue(argv, "--profile") || PROFILE_FLAT);
  if (![PROFILE_FLAT, PROFILE_RIGIDS].includes(profileRaw)) {
    throw new Error("--profile must be either 'flat-surface-adhesive' or 'rigids'");
  }
  const profileDefaults = getProfileDefaults(profileRaw);
  const url = getArgValue(argv, "--url") || profileDefaults.url;
  const headful = argv.includes("--headful");
  const forceHeadless = argv.includes("--headless");
  const materials = parseCsv(getArgValue(argv, "--materials") || "") || [];
  const laminations = parseCsv(getArgValue(argv, "--laminations") || "") || [];
  const categories = parseCsv(getArgValue(argv, "--categories") || "") || [];
  const areas = parseNumberList(getArgValue(argv, "--areas") || "") || [];
  const quantities = parseNumberList(getArgValue(argv, "--quantities") || "") || [];
  const quantitiesExplicit = argv.includes("--quantities");
  const widthCmRaw = getArgValue(argv, "--width-cm");
  const widthCm = widthCmRaw ? Number(widthCmRaw) : null;
  const outDir = getArgValue(argv, "--out-dir") || DEFAULT_OUT_DIR;
  const limitMaterials = Number(getArgValue(argv, "--limit-materials") || 0) || 0;
  const limitLaminations = Number(getArgValue(argv, "--limit-laminations") || 0) || 0;
  const limitAreas = Number(getArgValue(argv, "--limit-areas") || 0) || 0;
  const limitQuantities = Number(getArgValue(argv, "--limit-quantities") || 0) || 0;
  const inputPath = getArgValue(argv, "--input");
  const dryRun = argv.includes("--dry-run");
  const tenantId = getArgValue(argv, "--tenant-id") || DEFAULT_TENANT_ID;
  const productName = getArgValue(argv, "--product-name") || profileDefaults.productName;
  const productSlug = getArgValue(argv, "--product-slug") || profileDefaults.productSlug;
  const productPrefix = getArgValue(argv, "--product-prefix") || "";
  const productSlugPrefix = getArgValue(argv, "--product-slug-prefix") || "";
  const category = getArgValue(argv, "--category") || DEFAULT_CATEGORY;
  const description = getArgValue(argv, "--description") || profileDefaults.description;
  const eurToDkk = Number(getArgValue(argv, "--eur-to-dkk") || DEFAULT_EUR_TO_DKK);
  const markupArg = getArgValue(argv, "--markup-pct");
  const markupPct = Number(
    markupArg ?? (profileRaw === PROFILE_RIGIDS ? 0 : DEFAULT_MARKUP_PCT)
  );
  const roundingStep = Number(getArgValue(argv, "--rounding-step") || DEFAULT_ROUNDING_STEP);
  const priceColumn = normalizeKey(getArgValue(argv, "--price-column") || DEFAULT_PRICE_COLUMN);
  const publish = argv.includes("--publish");

  if (widthCm !== null && (!Number.isFinite(widthCm) || widthCm <= 0)) {
    throw new Error("--width-cm must be a positive number");
  }
  if (!Number.isFinite(eurToDkk) || eurToDkk <= 0) {
    throw new Error("--eur-to-dkk must be a positive number");
  }
  if (!Number.isFinite(markupPct) || markupPct < 0) {
    throw new Error("--markup-pct must be zero or a positive number");
  }
  if (!Number.isFinite(roundingStep) || roundingStep <= 0) {
    throw new Error("--rounding-step must be a positive number");
  }
  if (!["cheapest", "fastest"].includes(priceColumn)) {
    throw new Error("--price-column must be either 'cheapest' or 'fastest'");
  }

  return {
    profile: profileRaw,
    command,
    url,
    headful,
    forceHeadless,
    categories: categories.length ? categories : DEFAULT_RIGIDS_CATEGORIES,
    materials:
      profileRaw === PROFILE_FLAT
        ? materials.length
          ? materials
          : DEFAULT_MATERIALS
        : materials,
    laminations:
      profileRaw === PROFILE_FLAT
        ? laminations.length
          ? laminations
          : DEFAULT_LAMINATIONS
        : laminations,
    areas: areas.length ? areas : DEFAULT_AREAS_M2,
    quantities: quantities.length ? quantities : DEFAULT_QUANTITIES,
    quantitiesExplicit,
    widthCm,
    outDir,
    limitMaterials,
    limitLaminations,
    limitAreas,
    limitQuantities,
    inputPath,
    dryRun,
    tenantId,
    productName: normalizeLabel(productName),
    productSlug: normalizeLabel(productSlug),
    productPrefix: normalizeLabel(productPrefix),
    productSlugPrefix: normalizeLabel(productSlugPrefix),
    category: normalizeLabel(category),
    description: normalizeLabel(description),
    eurToDkk,
    markupPct,
    roundingStep,
    priceColumn,
    publish,
    importFilePrefix: profileDefaults.importFilePrefix,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseEuro(value) {
  const parseCandidate = (candidate) => {
    const raw = String(candidate || "").replace(/[^0-9.,]/g, "");
    if (!raw) return null;

    const lastDot = raw.lastIndexOf(".");
    const lastComma = raw.lastIndexOf(",");
    let normalized = raw;

    if (lastDot !== -1 && lastComma !== -1) {
      if (lastDot > lastComma) {
        normalized = raw.replace(/,/g, "");
      } else {
        normalized = raw.replace(/\./g, "").replace(/,/g, ".");
      }
    } else if (lastComma !== -1) {
      const parts = raw.split(",");
      if (parts.length > 2) {
        const maybeDecimal = parts[parts.length - 1];
        if (maybeDecimal.length === 2) {
          normalized = `${parts.slice(0, -1).join("")}.${maybeDecimal}`;
        } else {
          normalized = parts.join("");
        }
      } else {
        const digitsAfter = raw.length - lastComma - 1;
        normalized = digitsAfter === 3 ? raw.replace(/,/g, "") : raw.replace(/,/g, ".");
      }
    } else if (lastDot !== -1) {
      const parts = raw.split(".");
      if (parts.length > 2) {
        const maybeDecimal = parts[parts.length - 1];
        if (maybeDecimal.length === 2) {
          normalized = `${parts.slice(0, -1).join("")}.${maybeDecimal}`;
        } else {
          normalized = parts.join("");
        }
      } else {
        const digitsAfter = raw.length - lastDot - 1;
        if (digitsAfter === 3) {
          normalized = raw.replace(/\./g, "");
        }
      }
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const candidates = String(value || "").match(/[0-9][0-9.,]*/g) || [];
  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatCsvValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function areaToDimensionsCm(areaM2, widthCm) {
  const totalCm2 = areaM2 * 10000;
  if (widthCm && widthCm > 0) {
    const h = Math.max(1, Math.round(totalCm2 / widthCm));
    return { widthCm: Math.round(widthCm), heightCm: h };
  }

  const w = Math.max(1, Math.round(Math.sqrt(totalCm2)));
  const h = Math.max(1, Math.round(totalCm2 / w));
  return { widthCm: w, heightCm: h };
}

function buildTierRows(rows) {
  const grouped = new Map();

  rows
    .filter((row) => Number.isFinite(row.cheapest_price_per_m2_eur))
    .forEach((row) => {
      const key = `${row.material}||${row.lamination}||${row.quantity}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

  const tierRows = [];

  for (const [key, values] of grouped.entries()) {
    const [material, lamination, quantityStr] = key.split("||");
    const quantity = Number(quantityStr);
    const sorted = [...values].sort((a, b) => a.area_m2 - b.area_m2);

    sorted.forEach((item, idx) => {
      const next = sorted[idx + 1];
      tierRows.push({
        material,
        lamination,
        quantity,
        from_m2: item.area_m2,
        to_m2: next ? next.area_m2 : null,
        price_per_m2_eur: item.cheapest_price_per_m2_eur,
      });
    });
  }

  return tierRows;
}

function slugify(value) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findLatestExtractionFile(outDir, prefix) {
  const dirPath = path.resolve(process.cwd(), outDir);
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Output directory does not exist: ${dirPath}`);
  }

  const candidates = fs
    .readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => {
      const full = path.join(dirPath, name);
      const stat = fs.statSync(full);
      return { full, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No extraction JSON files found in ${dirPath}`);
  }

  return candidates[0].full;
}

function resolveInputPath(args) {
  if (args.inputPath) {
    const input = path.resolve(process.cwd(), args.inputPath);
    if (!fs.existsSync(input)) {
      throw new Error(`Input file not found: ${input}`);
    }
    return input;
  }
  return findLatestExtractionFile(args.outDir, args.importFilePrefix);
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
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

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeLaminationKey(value) {
  const normalized = normalizeKey(value)
    .replace(/lamination/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return NONE_LAMINATION_KEY;
  if (
    normalized === "none" ||
    normalized === "without" ||
    normalized === "without lam" ||
    normalized === "no"
  ) {
    return NONE_LAMINATION_KEY;
  }
  return normalized;
}

function finishDisplayNameFromLamination(value) {
  const key = normalizeLaminationKey(value);
  if (key === "standard matt") return "Standard matte";
  if (key === "standard gloss") return "Standard gloss";
  if (key === "uv filter 5 matt") return "UV matte";
  if (key === "uv filter matt") return "UV matte";
  if (key === "uv matt") return "UV matte";
  if (key === "uv filter 5 gloss") return "UV gloss";
  if (key === "uv filter gloss") return "UV gloss";
  if (key === "uv gloss") return "UV gloss";
  if (key === NONE_LAMINATION_KEY) return "No lamination";
  return normalizeLabel(value);
}

function materialGroupLabel(name) {
  const key = normalizeKey(name);
  if (key.includes("pvc-free") || key.includes("easywall")) return "PVC-free";
  return "PVC";
}

function computeConvertedPricePerM2(pricePerM2Eur, args) {
  const converted = pricePerM2Eur * args.eurToDkk * (1 + args.markupPct / 100);
  return Number(converted.toFixed(6));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildPointBuckets() {
  return new Map();
}

function addPointBucketValue(map, point, value) {
  if (!Number.isFinite(point) || !Number.isFinite(value)) return;
  if (!map.has(point)) map.set(point, []);
  map.get(point).push(value);
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
    } else if (strategy === "mean_non_zero") {
      const nonZero = values.filter((value) => Math.abs(value) > 1e-9);
      const sample = nonZero.length ? nonZero : values;
      picked = sample.reduce((sum, value) => sum + value, 0) / sample.length;
    } else {
      picked = median(values);
    }
    if (Number.isFinite(picked)) reduced.set(point, picked);
  }
  return reduced;
}

function buildTierSeriesFromPoints(pointToPriceMap, args) {
  const sorted = [...pointToPriceMap.entries()].sort((a, b) => a[0] - b[0]);
  return sorted.map(([fromM2, pricePerM2Eur], idx) => {
    const next = sorted[idx + 1];
    return {
      from_m2: Number(fromM2),
      to_m2: next ? Number(next[0]) : null,
      price_per_m2: computeConvertedPricePerM2(pricePerM2Eur, args),
      is_anchor: true,
      sort_order: idx,
    };
  });
}

function parseImportRows(payload, args) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const selectedField =
    args.priceColumn === "fastest" ? "fastest_price_per_m2_eur" : "cheapest_price_per_m2_eur";

  return rows
    .map((row) => {
      const areaM2 = toFiniteNumber(row.area_m2);
      const quantity = toFiniteNumber(row.quantity);
      const fastestPerM2 = toFiniteNumber(row.fastest_price_per_m2_eur);
      const cheapestPerM2 = toFiniteNumber(row.cheapest_price_per_m2_eur);
      const selectedPerM2 = toFiniteNumber(row[selectedField]);

      if (!Number.isFinite(areaM2) || !Number.isFinite(quantity) || !Number.isFinite(selectedPerM2)) {
        return null;
      }

      return {
        material: normalizeLabel(row.material),
        material_key: normalizeKey(row.material),
        lamination: normalizeLabel(row.lamination),
        lamination_key: normalizeLaminationKey(row.lamination),
        area_m2: areaM2,
        quantity,
        total_area_m2: Number((areaM2 * quantity).toFixed(6)),
        selected_price_per_m2_eur: selectedPerM2,
        fastest_price_per_m2_eur: fastestPerM2,
        cheapest_price_per_m2_eur: cheapestPerM2,
      };
    })
    .filter(Boolean);
}

async function acceptCookies(page) {
  await page.evaluate(() => {
    const btnText = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const candidates = Array.from(document.querySelectorAll("button"));
    const target = candidates.find((btn) => {
      const text = btnText(btn);
      return (
        text === "accept" ||
        text === "accept all" ||
        text.includes("accept all cookies")
      );
    });
    if (target) target.click();
  });
  await page.waitForTimeout(1000);
}

async function loadConfigurator(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await acceptCookies(page);
  await page.waitForTimeout(1800);
}

async function ensurePriceGridVisible(page) {
  const clicked = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], .btn, .grid-btn")
    );
    const target = candidates.find((el) => {
      const text = normalize(el.textContent);
      return text.includes("show prices") || text.includes("show price");
    });
    if (!target) return false;
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });

  if (clicked) {
    await page.waitForTimeout(1200);
  }

  return clicked;
}

async function discoverOptions(page) {
  const data = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

    const readRadioGroup = (name) => {
      const radios = Array.from(document.querySelectorAll(`input[type=\"radio\"][name=\"${name}\"]`));
      const values = [];
      const byKey = new Set();

      radios.forEach((input) => {
        const key = normalize(input.value).toLowerCase();
        if (!key || byKey.has(key)) return;
        byKey.add(key);

        const id = input.id;
        const labelEl = id ? document.querySelector(`label[for='${id}']`) : null;
        const label = normalize(labelEl?.textContent || input.value);
        values.push({
          value: normalize(input.value),
          label,
          disabled: !!input.disabled,
        });
      });

      return values;
    };

    const widthInput = document.querySelector("#Finished_Sheet_Width___LOR");
    const heightInput = document.querySelector("#Finished_Sheet_Height___LOR");
    const customQtyInput = document.querySelector("[data-test='custom-quantity-item']");
    const quantityButtons = Array.from(
      document.querySelectorAll(".quantities-column .quantity-container .qty-btn")
    )
      .map((el) => Number(normalize(el.textContent)))
      .filter((num) => Number.isFinite(num));
    const hasPriceGrid = !!document.querySelector(".price-grid.price-grid-container");

    return {
      title: normalize(document.title),
      materials: readRadioGroup("Paper_Type"),
      laminations: readRadioGroup("Lamination___LOV"),
      widthInputFound: !!widthInput,
      heightInputFound: !!heightInput,
      customQuantityInputFound: !!customQtyInput,
      quantityButtons,
      hasPriceGrid,
    };
  });

  return data;
}

async function setRadioByValue(page, name, wantedValue) {
  const result = await page.evaluate(
    ({ nameArg, valueArg }) => {
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
      const radios = Array.from(document.querySelectorAll(`input[type=\"radio\"][name=\"${nameArg}\"]`));
      const wanted = normalize(valueArg);
      const match = radios.find((input) => normalize(input.value) === wanted);

      if (!match) {
        return { ok: false, reason: "not-found", selected: radios.filter((r) => r.checked).map((r) => r.value) };
      }

      const id = match.id;
      let clicked = false;

      if (id) {
        const label = document.querySelector(`label[for='${id}']`);
        if (label) {
          label.click();
          clicked = true;
        }
      }

      if (!clicked) {
        match.click();
      }

      const selected = radios.filter((r) => r.checked).map((r) => r.value);
      return { ok: true, selected };
    },
    { nameArg: name, valueArg: wantedValue }
  );

  if (!result.ok) {
    throw new Error(`Could not set ${name}=${wantedValue} (${result.reason})`);
  }

  return result;
}

async function setDimensions(page, widthCm, heightCm) {
  const selectors = {
    width: [
      "#Finished_Sheet_Width___LOR",
      "[name='Finished_Sheet_Width___LOR']",
      "[data-test='custom-width-input']",
      "input[id*='Width']",
      "input[name*='Width']",
    ],
    height: [
      "#Finished_Sheet_Height___LOR",
      "[name='Finished_Sheet_Height___LOR']",
      "[data-test='custom-height-input']",
      "input[id*='Height']",
      "input[name*='Height']",
    ],
  };

  const getFirstVisible = async (candidates) => {
    for (const selector of candidates) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) continue;
      const visible = await locator.isVisible().catch(() => false);
      if (visible) return locator;
    }
    return null;
  };

  const readAppliedDimensions = async () =>
    page.evaluate(({ widthSelectors, heightSelectors }) => {
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const parseLocalizedFloat = (value) => {
        const raw = normalize(value);
        if (!raw) return null;
        const tokens = raw.match(/[0-9][0-9.,]*/g) || [];
        for (const token of tokens) {
          const cleaned = token.replace(/[^0-9.,]/g, "");
          if (!cleaned) continue;
          const normalized = cleaned.includes(",") && !cleaned.includes(".")
            ? cleaned.replace(",", ".")
            : cleaned.replace(/,/g, "");
          const parsed = Number(normalized);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      };
      const isVisible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const findValue = (selectorList) => {
        for (const selector of selectorList) {
          const candidate = document.querySelector(selector);
          if (!candidate || !isVisible(candidate)) continue;
          const value = parseLocalizedFloat(candidate.value || candidate.textContent || "");
          if (Number.isFinite(value)) return value;
        }
        return null;
      };
      return {
        widthCm: findValue(widthSelectors),
        heightCm: findValue(heightSelectors),
      };
    }, { widthSelectors: selectors.width, heightSelectors: selectors.height });

  const widthInput = await getFirstVisible(selectors.width);
  const heightInput = await getFirstVisible(selectors.height);
  if (!widthInput || !heightInput) {
    throw new Error("dimension-input-not-found");
  }

  let lastApplied = { widthCm: null, heightCm: null };
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await widthInput.fill(String(widthCm));
    await heightInput.fill(String(heightCm));
    await page.keyboard.press("Tab");
    await page.waitForTimeout(700);

    const applied = await readAppliedDimensions();
    lastApplied = applied;
    const widthOk =
      Number.isFinite(applied.widthCm) &&
      Math.abs(applied.widthCm - widthCm) <= Math.max(0.5, Math.abs(widthCm) * 0.02);
    const heightOk =
      Number.isFinite(applied.heightCm) &&
      Math.abs(applied.heightCm - heightCm) <= Math.max(0.5, Math.abs(heightCm) * 0.02);
    if (widthOk && heightOk) {
      return {
        widthCm: Number(applied.widthCm),
        heightCm: Number(applied.heightCm),
      };
    }
  }

  if (Number.isFinite(lastApplied.widthCm) && Number.isFinite(lastApplied.heightCm)) {
    return {
      widthCm: Number(lastApplied.widthCm),
      heightCm: Number(lastApplied.heightCm),
    };
  }

  throw new Error("dimension-input-not-applied");
}

async function setCustomQuantity(page, quantity) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const input = page.locator("[data-test='custom-quantity-item']").first();
    if ((await input.count()) > 0) {
      await input.fill(String(quantity));
      await input.press("Enter");
      await page.waitForTimeout(500);

      const applied = await page.evaluate((qtyArg) => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const parseLocalizedInt = (value) => {
          const tokens = normalize(value).match(/[0-9][0-9.,]*/g) || [];
          for (const token of tokens) {
            const cleaned = token.replace(/[^0-9]/g, "");
            if (!cleaned) continue;
            const parsed = Number(cleaned);
            if (Number.isFinite(parsed)) return Math.round(parsed);
          }
          return null;
        };

        const target = Number(qtyArg);
        const qtyInput = document.querySelector("[data-test='custom-quantity-item']");
        const inputValue = parseLocalizedInt(qtyInput?.value || qtyInput?.textContent || "");
        if (Number.isFinite(inputValue) && inputValue === target) return true;

        const qtyButtons = Array.from(
          document.querySelectorAll(".quantities-column .quantity-container .qty-btn")
        )
          .map((node) => parseLocalizedInt(node.textContent))
          .filter((num) => Number.isFinite(num));

        return qtyButtons.includes(target);
      }, quantity);

      if (applied) {
        return;
      }
    }

    const clickedExistingQuantity = await page.evaluate((qtyArg) => {
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const parseQuantity = (value) => {
        const match = normalize(value).match(/([0-9]+(?:[.,][0-9]+)?)/);
        if (!match) return null;
        const parsed = Number(match[1].replace(",", "."));
        return Number.isFinite(parsed) ? Math.round(parsed) : null;
      };
      const qty = String(qtyArg);
      const qtyNum = Number(qtyArg);
      const containers = Array.from(
        document.querySelectorAll(".quantities-column .quantity-container")
      );
      const match = containers.find((container) => {
        const btn = container.querySelector(".qty-btn");
        const text = normalize(btn?.textContent);
        return text === qty || parseQuantity(text) === qtyNum;
      });
      if (!match) return false;
      match.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const btn = match.querySelector(".qty-btn");
      if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }, quantity);

    if (clickedExistingQuantity) {
      await page.waitForTimeout(450);
      const applied = await page.evaluate((qtyArg) => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const parseQuantity = (value) => {
          const match = normalize(value).match(/([0-9]+(?:[.,][0-9]+)?)/);
          if (!match) return null;
          const parsed = Number(match[1].replace(",", "."));
          return Number.isFinite(parsed) ? Math.round(parsed) : null;
        };
        const qtyButtons = Array.from(
          document.querySelectorAll(".quantities-column .quantity-container .qty-btn")
        )
          .map((node) => parseQuantity(node.textContent))
          .filter((num) => Number.isFinite(num));
        return qtyButtons.includes(Number(qtyArg));
      }, quantity);
      if (applied) {
        return;
      }
    }

    await page.waitForTimeout(450);
  }

  throw new Error("quantity-selector-not-found-or-not-applied");
}

async function readGridRows(page) {
  const rows = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const parseLocalizedNumber = (value) => {
      const parseCandidate = (candidate) => {
        const raw = String(candidate || "").replace(/[^0-9.,]/g, "");
        if (!raw) return null;

        const lastDot = raw.lastIndexOf(".");
        const lastComma = raw.lastIndexOf(",");
        let normalized = raw;

        if (lastDot !== -1 && lastComma !== -1) {
          if (lastDot > lastComma) {
            normalized = raw.replace(/,/g, "");
          } else {
            normalized = raw.replace(/\./g, "").replace(/,/g, ".");
          }
        } else if (lastComma !== -1) {
          const parts = raw.split(",");
          if (parts.length > 2) {
            const maybeDecimal = parts[parts.length - 1];
            if (maybeDecimal.length === 2) {
              normalized = `${parts.slice(0, -1).join("")}.${maybeDecimal}`;
            } else {
              normalized = parts.join("");
            }
          } else {
            const digitsAfter = raw.length - lastComma - 1;
            normalized = digitsAfter === 3 ? raw.replace(/,/g, "") : raw.replace(/,/g, ".");
          }
        } else if (lastDot !== -1) {
          const parts = raw.split(".");
          if (parts.length > 2) {
            const maybeDecimal = parts[parts.length - 1];
            if (maybeDecimal.length === 2) {
              normalized = `${parts.slice(0, -1).join("")}.${maybeDecimal}`;
            } else {
              normalized = parts.join("");
            }
          } else {
            const digitsAfter = raw.length - lastDot - 1;
            if (digitsAfter === 3) {
              normalized = raw.replace(/\./g, "");
            }
          }
        }

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const candidates = normalize(value).match(/[0-9][0-9.,]*/g) || [];
      for (const candidate of candidates) {
        const parsed = parseCandidate(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return null;
    };
    const parseQuantity = (value) => {
      const parsed = parseLocalizedNumber(value);
      return Number.isFinite(parsed) ? Math.round(parsed) : null;
    };
    const parsePrice = (value) => {
      return parseLocalizedNumber(value);
    };

    const grid = document.querySelector(".price-grid.price-grid-container");
    if (!grid) return [];

    const quantityNodes = Array.from(
      grid.querySelectorAll(".quantities-column .quantity-container .qty-btn")
    );
    const quantityValues = quantityNodes
      .map((node) => parseQuantity(node.textContent))
      .filter((num) => Number.isFinite(num));

    const cellRows = Array.from(grid.querySelectorAll(".grid-overflow .cells-row"));

    if (!quantityValues.length && cellRows.length) {
      const customQtyInput = grid.querySelector("[data-test='custom-quantity-item']");
      const fallbackQty = parseQuantity(customQtyInput?.value || customQtyInput?.textContent || "1");
      if (Number.isFinite(fallbackQty)) {
        quantityValues.push(fallbackQty);
      }
    }

    const parsedRows = [];
    const count = cellRows.length;

    for (let i = 0; i < count; i += 1) {
      const quantity =
        quantityValues[i] ??
        quantityValues[quantityValues.length - 1] ??
        1;
      const cellContainers = Array.from(cellRows[i].children).filter((el) =>
        (el.className || "").includes("cell-container")
      );
      const prices = cellContainers
        .map((cell) => parsePrice(cell.textContent))
        .filter((price) => Number.isFinite(price));
      if (!Number.isFinite(quantity) || !prices.length) continue;

      parsedRows.push({
        quantity,
        fastest_price_eur: prices[0],
        cheapest_price_eur: prices[prices.length - 1],
        price_columns_count: prices.length,
      });
    }

    return parsedRows;
  });

  return rows;
}

async function waitForQuantityRow(page, quantity, timeoutMs = 15000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const rows = await readGridRows(page);
    const match = rows.find((row) => Number(row.quantity) === Number(quantity));
    if (match && Number.isFinite(match.cheapest_price_eur)) {
      return match;
    }
    await page.waitForTimeout(550);
  }

  return null;
}

async function waitForGridRows(page, timeoutMs = 15000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const rows = await readGridRows(page);
    if (rows.length > 0) {
      return rows;
    }
    await page.waitForTimeout(550);
  }

  return [];
}

function gridRowsSignature(rows) {
  return rows
    .slice()
    .sort((a, b) => Number(a.quantity) - Number(b.quantity))
    .map((row) => {
      const q = Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0;
      const fast = Number.isFinite(Number(row.fastest_price_eur))
        ? Number(row.fastest_price_eur).toFixed(4)
        : "na";
      const cheap = Number.isFinite(Number(row.cheapest_price_eur))
        ? Number(row.cheapest_price_eur).toFixed(4)
        : "na";
      return `${q}:${fast}:${cheap}`;
    })
    .join("|");
}

async function waitForGridStability(page, timeoutMs = 22000, pollMs = 600, stableReads = 2) {
  const started = Date.now();
  let lastSignature = "";
  let stableCount = 0;
  let lastRows = [];

  while (Date.now() - started < timeoutMs) {
    const rows = await readGridRows(page);
    if (rows.length > 0) {
      const signature = gridRowsSignature(rows);
      if (signature === lastSignature) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastSignature = signature;
      }
      lastRows = rows;
      if (stableCount >= stableReads) {
        return rows;
      }
    }
    await page.waitForTimeout(pollMs);
  }

  return lastRows;
}

function matchOptionByNeedle(options, needles = []) {
  const loweredNeedles = needles.map((needle) => normalizeKey(needle));
  return options.find((option) =>
    loweredNeedles.some((needle) => normalizeKey(option.label).includes(needle))
  );
}

function chooseDefaultRigidsOption(options, fallbackNeedles = []) {
  const candidates = options.filter((option) => !option.disabled);
  if (!candidates.length) return null;
  const preferred = matchOptionByNeedle(candidates, fallbackNeedles);
  return preferred || candidates[0];
}

function buildRigidsLaminationLabel(printing, white, cut) {
  return `Printing: ${printing} | White: ${white} | Cut: ${cut}`;
}

function buildCategoryProductName(args, categoryLabel) {
  const explicitPrefix =
    args.productPrefix ||
    (args.productName &&
    normalizeKey(args.productName) !== normalizeKey(DEFAULT_PRODUCT_NAME_BY_PROFILE[PROFILE_RIGIDS])
      ? args.productName
      : "");
  return explicitPrefix ? `${explicitPrefix} ${categoryLabel}` : categoryLabel;
}

function buildCategoryProductSlug(args, categoryLabel) {
  const explicitPrefix =
    args.productSlugPrefix ||
    (args.productSlug &&
    normalizeKey(args.productSlug) !== normalizeKey(DEFAULT_PRODUCT_SLUG_BY_PROFILE[PROFILE_RIGIDS])
      ? args.productSlug
      : "");
  const categorySlug = slugify(categoryLabel);
  return explicitPrefix ? `${slugify(explicitPrefix)}-${categorySlug}` : categorySlug;
}

async function listRigidsTabs(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return Array.from(document.querySelectorAll("[role='tab'][aria-controls]"))
      .filter((tab) => isVisible(tab))
      .map((tab) => {
        const label = normalize(tab.textContent || tab.getAttribute("aria-label") || "");
        const panelId = normalize(tab.getAttribute("aria-controls") || "");
        const selected =
          tab.getAttribute("aria-selected") === "true" || tab.classList.contains("active");
        const disabled =
          tab.getAttribute("aria-disabled") === "true" ||
          tab.hasAttribute("disabled") ||
          tab.classList.contains("disabled");
        return {
          label,
          panel_id: panelId,
          selected,
          disabled,
        };
      })
      .filter((item) => item.label && item.panel_id);
  });
}

async function clickRigidsTab(page, categoryLabel) {
  const result = await page.evaluate((wantedLabel) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const wanted = normalize(wantedLabel);
    const tabs = Array.from(document.querySelectorAll("[role='tab'][aria-controls]")).filter((tab) =>
      isVisible(tab)
    );
    const tab = tabs.find((node) => normalize(node.textContent || node.getAttribute("aria-label")) === wanted);
    if (!tab) return { ok: false, reason: "tab-not-found" };
    if (tab.getAttribute("aria-disabled") === "true" || tab.hasAttribute("disabled")) {
      return { ok: false, reason: "tab-disabled" };
    }
    tab.scrollIntoView({ block: "center", inline: "nearest" });
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return { ok: true };
  }, categoryLabel);

  if (!result.ok) {
    throw new Error(`Could not select category tab "${categoryLabel}" (${result.reason})`);
  }
  await page.waitForTimeout(1200);

  const selectedOk = await page.evaluate((wantedLabel) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const selectedTab = Array.from(document.querySelectorAll("[role='tab'][aria-controls]"))
      .filter((tab) => isVisible(tab))
      .find((tab) => tab.getAttribute("aria-selected") === "true" || tab.classList.contains("active"));
    if (!selectedTab) return false;
    return normalize(selectedTab.textContent || selectedTab.getAttribute("aria-label")) === normalize(wantedLabel);
  }, categoryLabel);

  if (!selectedOk) {
    throw new Error(`Could not activate category tab "${categoryLabel}" (selection-not-applied)`);
  }
}

async function discoverRigidsOptions(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const readGroup = (prefix) => {
      const nodes = Array.from(document.querySelectorAll(`[data-test^='${prefix}']`));
      const values = [];
      const byDataTest = new Map();
      nodes.forEach((node) => {
        const dataTest = node.getAttribute("data-test");
        if (!dataTest) return;
        if (!byDataTest.has(dataTest)) byDataTest.set(dataTest, []);
        byDataTest.get(dataTest).push(node);
      });

      for (const [dataTest, groupNodes] of byDataTest.entries()) {
        const visibleNode = groupNodes.find((node) => isVisible(node));
        const node = visibleNode || groupNodes[0];
        const label = normalize(node.textContent || node.getAttribute("aria-label") || "");
        const selected = groupNodes.some(
          (candidate) =>
            candidate.getAttribute("aria-checked") === "true" ||
            candidate.classList.contains("active") ||
            !!candidate.querySelector("input:checked")
        );
        const disabled = groupNodes.every(
          (candidate) =>
            candidate.getAttribute("aria-disabled") === "true" ||
            candidate.hasAttribute("disabled") ||
            !!candidate.querySelector("input:disabled")
        );

        values.push({
          data_test: dataTest,
          value: normalize(dataTest.replace(prefix, "")),
          label: label || normalize(dataTest.replace(prefix, "")),
          selected,
          disabled,
        });
      }
      return values;
    };

    return {
      materials: readGroup("select-Substrate_Merch-"),
      printing: readGroup("select-Printing Layout-"),
      white: readGroup("select-Printing White-"),
      cut: readGroup("select-Cut Shape-"),
      format: readGroup("select-Finished_Sheet-"),
    };
  });
}

async function ensureRigidsCustomFormat(page) {
  const result = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const options = Array.from(document.querySelectorAll("[data-test^='select-Finished_Sheet-']"));
    const customOption = options.find((option) => {
      const label = normalize(option.textContent || option.getAttribute("aria-label") || "");
      return label.includes("custom");
    });
    if (!customOption) return { ok: false, reason: "custom-format-not-found" };
    const isSelected =
      customOption.getAttribute("aria-checked") === "true" ||
      customOption.classList.contains("active") ||
      !!customOption.querySelector("input:checked");
    if (!isSelected) {
      customOption.scrollIntoView({ block: "center", inline: "nearest" });
      customOption.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    return { ok: true };
  });
  if (result.ok) {
    await page.waitForTimeout(700);
  }
}

async function setRigidsOptionByDataTest(page, dataTest) {
  const result = await page.evaluate((dataTestArg) => {
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const candidates = Array.from(document.querySelectorAll(`[data-test='${dataTestArg}']`));
    const node = candidates.find((candidate) => isVisible(candidate)) || candidates[0];
    if (!node) return { ok: false, reason: "not-found" };

    const disabled =
      node.getAttribute("aria-disabled") === "true" ||
      node.hasAttribute("disabled") ||
      !!node.querySelector("input:disabled");
    if (disabled) return { ok: false, reason: "disabled" };

    node.scrollIntoView({ block: "center", inline: "nearest" });
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const input = node.querySelector("input[type='radio'], input[type='checkbox']");
    if (input && !input.checked) {
      input.click();
    }
    return { ok: true };
  }, dataTest);

  if (!result.ok) {
    throw new Error(`Could not select ${dataTest} (${result.reason})`);
  }
  await page.waitForTimeout(550);
}

function selectRequestedCategories(requested, tabs) {
  const availableMap = new Map(tabs.map((tab) => [normalizeKey(tab.label), tab]));
  const selected = [];
  const missing = [];
  (requested || []).forEach((label) => {
    const found = availableMap.get(normalizeKey(label));
    if (found) selected.push(found);
    else missing.push(label);
  });

  if (!selected.length && !requested?.length) {
    return { selected: tabs, missing: [] };
  }
  return { selected, missing };
}

function buildRigidsTierRows(rows) {
  const grouped = new Map();
  rows
    .filter((row) => Number.isFinite(row.cheapest_price_per_m2_eur))
    .forEach((row) => {
      const key = [
        row.category,
        row.material,
        row.printing,
        row.white,
        row.cut,
        row.quantity,
      ].join("||");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

  const tiers = [];
  for (const [key, values] of grouped.entries()) {
    const [category, material, printing, white, cut, quantityStr] = key.split("||");
    const quantity = Number(quantityStr);
    const sorted = [...values].sort((a, b) => a.area_m2 - b.area_m2);
    sorted.forEach((item, idx) => {
      const next = sorted[idx + 1];
      tiers.push({
        category,
        material,
        printing,
        white,
        cut,
        quantity,
        from_m2: item.area_m2,
        to_m2: next ? next.area_m2 : null,
        price_per_m2_eur: item.cheapest_price_per_m2_eur,
      });
    });
  }
  return tiers;
}

function selectRequested(requested, availableItems) {
  const byKey = new Map(availableItems.map((item) => [normalizeKey(item.value), item.value]));
  const selected = [];
  const missing = [];

  requested.forEach((item) => {
    const found = byKey.get(normalizeKey(item));
    if (found) selected.push(found);
    else missing.push(item);
  });

  return { selected, missing };
}

async function runProbe(args) {
  const browser = await chromium.launch({ headless: shouldLaunchHeadless(args, PROFILE_FLAT) });
  const page = await browser.newPage();

  try {
    await loadConfigurator(page, args.url);

    const options = await discoverOptions(page);

    console.log("Probe result:");
    console.log(JSON.stringify(options, null, 2));
  } finally {
    await browser.close();
  }
}

async function runExtract(args) {
  const browser = await chromium.launch({ headless: shouldLaunchHeadless(args, PROFILE_FLAT) });
  const page = await browser.newPage();

  try {
    await loadConfigurator(page, args.url);

    const discovered = await discoverOptions(page);

    const materialSelection = selectRequested(args.materials, discovered.materials || []);
    const laminationSelection = selectRequested(args.laminations, discovered.laminations || []);

    let materials = materialSelection.selected;
    let laminations = laminationSelection.selected;
    let areas = [...args.areas];
    let quantities = [...args.quantities];

    if (args.limitMaterials > 0) materials = materials.slice(0, args.limitMaterials);
    if (args.limitLaminations > 0) laminations = laminations.slice(0, args.limitLaminations);
    if (args.limitAreas > 0) areas = areas.slice(0, args.limitAreas);
    if (args.limitQuantities > 0) quantities = quantities.slice(0, args.limitQuantities);

    console.log(
      `Using ${materials.length} materials, ${laminations.length} laminations, ${areas.length} area points, ${quantities.length} quantities.`
    );

    if (!materials.length) throw new Error("No requested materials found on page");
    if (!laminations.length) throw new Error("No requested laminations found on page");

    const rows = [];

    for (const material of materials) {
      for (const lamination of laminations) {
        try {
          await loadConfigurator(page, args.url);
          await setRadioByValue(page, "Paper_Type", material);
          await page.waitForTimeout(900);
          await setRadioByValue(page, "Lamination___LOV", lamination);
          await page.waitForTimeout(900);
        } catch (error) {
          const setupError = error instanceof Error ? error.message : String(error);
          console.log(
            `failed setup | material=${material} | lamination=${lamination} | error=${setupError}`
          );
          for (const areaM2 of areas) {
            const { widthCm, heightCm } = areaToDimensionsCm(areaM2, args.widthCm);
            for (const quantity of quantities) {
              rows.push({
                material,
                lamination,
                area_m2: areaM2,
                width_cm: widthCm,
                height_cm: heightCm,
                quantity,
                fastest_quote_eur: null,
                cheapest_quote_eur: null,
                fastest_price_per_m2_eur: null,
                cheapest_price_per_m2_eur: null,
                fastest_unit_price_eur: null,
                cheapest_unit_price_eur: null,
                price_columns_count: null,
                error: `combo-setup-failed:${setupError}`,
              });
            }
          }
          continue;
        }

        for (const areaM2 of areas) {
          const { widthCm, heightCm } = areaToDimensionsCm(areaM2, args.widthCm);
          try {
            const appliedDimensions = await setDimensions(page, widthCm, heightCm);
            const appliedAreaM2 = Number(
              ((Number(appliedDimensions.widthCm) * Number(appliedDimensions.heightCm)) / 10000).toFixed(6)
            );
            await page.waitForTimeout(1200);
            await ensurePriceGridVisible(page);

            const visibleGridRows = await waitForGridRows(page, 15000);
            const visibleRowByQuantity = new Map(
              visibleGridRows.map((gridRow) => [Number(gridRow.quantity), gridRow])
            );
            if (!visibleGridRows.length) {
              console.log(
                `No visible grid rows after setup | material=${material} | lamination=${lamination} | area=${areaM2}`
              );
            }

            for (const quantity of quantities) {
              const row = {
                material,
                lamination,
                area_m2: Number.isFinite(appliedAreaM2) ? appliedAreaM2 : areaM2,
                width_cm: Number.isFinite(appliedDimensions.widthCm) ? appliedDimensions.widthCm : widthCm,
                height_cm: Number.isFinite(appliedDimensions.heightCm) ? appliedDimensions.heightCm : heightCm,
                quantity,
                fastest_quote_eur: null,
                cheapest_quote_eur: null,
                fastest_price_per_m2_eur: null,
                cheapest_price_per_m2_eur: null,
                fastest_unit_price_eur: null,
                cheapest_unit_price_eur: null,
                price_columns_count: null,
                error: null,
              };

              process.stdout.write(
                `Extracting | material=${material} | lamination=${lamination} | area=${areaM2} m2 | qty=${quantity} ... `
              );

              try {
                let gridRow = visibleRowByQuantity.get(Number(quantity)) || null;
                if (!gridRow) {
                  await setCustomQuantity(page, quantity);
                  gridRow = await waitForQuantityRow(page, quantity, 15000);
                }

                if (!gridRow) {
                  row.error = "quantity-row-not-found";
                  console.log("failed (quantity-row-not-found)");
                } else {
                  const normalizedAreaM2 = Number.isFinite(row.area_m2) ? row.area_m2 : areaM2;
                  const totalAreaM2 = normalizedAreaM2 * quantity;
                  row.fastest_quote_eur = Number(gridRow.fastest_price_eur.toFixed(4));
                  row.cheapest_quote_eur = Number(gridRow.cheapest_price_eur.toFixed(4));
                  row.price_columns_count = gridRow.price_columns_count;

                  row.fastest_price_per_m2_eur = Number(
                    (row.fastest_quote_eur / totalAreaM2).toFixed(6)
                  );
                  row.cheapest_price_per_m2_eur = Number(
                    (row.cheapest_quote_eur / totalAreaM2).toFixed(6)
                  );
                  row.fastest_unit_price_eur = Number(
                    (row.fastest_quote_eur / quantity).toFixed(6)
                  );
                  row.cheapest_unit_price_eur = Number(
                    (row.cheapest_quote_eur / quantity).toFixed(6)
                  );

                  console.log(
                    `ok (fast €${row.fastest_quote_eur} | cheap €${row.cheapest_quote_eur})`
                  );
                }
              } catch (error) {
                row.error = error instanceof Error ? error.message : String(error);
                console.log(`failed (${row.error})`);
              }

              rows.push(row);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(
              `failed configuring combo material=${material} lamination=${lamination} area=${areaM2}: ${errorMessage}`
            );
            for (const quantity of quantities) {
              rows.push({
                material,
                lamination,
                area_m2: areaM2,
                width_cm: widthCm,
                height_cm: heightCm,
                quantity,
                fastest_quote_eur: null,
                cheapest_quote_eur: null,
                fastest_price_per_m2_eur: null,
                cheapest_price_per_m2_eur: null,
                fastest_unit_price_eur: null,
                cheapest_unit_price_eur: null,
                price_columns_count: null,
                error: `combo-setup-failed:${errorMessage}`,
              });
            }
          }
        }
      }
    }

    const tierRows = buildTierRows(rows);

    ensureDir(args.outDir);
    const stamp = timestamp();
    const base = `${args.importFilePrefix}${stamp}`;
    const jsonPath = path.resolve(process.cwd(), args.outDir, `${base}.json`);
    const csvPath = path.resolve(process.cwd(), args.outDir, `${base}.csv`);

    const payload = {
      meta: {
        extracted_at: new Date().toISOString(),
        url: args.url,
        materials_requested: args.materials,
        laminations_requested: args.laminations,
        areas_requested_m2: args.areas,
        quantities_requested: args.quantities,
        materials_used: materials,
        laminations_used: laminations,
        quantities_used: quantities,
      },
      discovered,
      missing: {
        materials: materialSelection.missing,
        laminations: laminationSelection.missing,
      },
      rows,
      tiers: tierRows,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

    const csvHeaders = [
      "material",
      "lamination",
      "area_m2",
      "width_cm",
      "height_cm",
      "quantity",
      "fastest_quote_eur",
      "cheapest_quote_eur",
      "fastest_price_per_m2_eur",
      "cheapest_price_per_m2_eur",
      "fastest_unit_price_eur",
      "cheapest_unit_price_eur",
      "price_columns_count",
      "error",
    ];

    const csvLines = [
      csvHeaders.join(","),
      ...rows.map((row) =>
        [
          row.material,
          row.lamination,
          row.area_m2,
          row.width_cm,
          row.height_cm,
          row.quantity,
          row.fastest_quote_eur,
          row.cheapest_quote_eur,
          row.fastest_price_per_m2_eur,
          row.cheapest_price_per_m2_eur,
          row.fastest_unit_price_eur,
          row.cheapest_unit_price_eur,
          row.price_columns_count,
          row.error,
        ]
          .map(formatCsvValue)
          .join(",")
      ),
    ];

    fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");

    const successCount = rows.filter((row) => Number.isFinite(row.cheapest_quote_eur)).length;

    console.log("\nExtraction complete:");
    console.log(`  Success rows: ${successCount}/${rows.length}`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  CSV:  ${csvPath}`);

    if (materialSelection.missing.length || laminationSelection.missing.length) {
      console.log("\nMissing requested options:");
      if (materialSelection.missing.length) {
        console.log(`  Materials: ${materialSelection.missing.join(" | ")}`);
      }
      if (laminationSelection.missing.length) {
        console.log(`  Laminations: ${laminationSelection.missing.join(" | ")}`);
      }
    }
  } finally {
    await browser.close();
  }
}

async function runProbeRigids(args) {
  const browser = await chromium.launch({ headless: shouldLaunchHeadless(args, PROFILE_RIGIDS) });
  const page = await browser.newPage();

  try {
    await loadConfigurator(page, args.url);

    const tabs = await listRigidsTabs(page);
    const requestedCategories = args.categories || [];
    const categorySelection = selectRequestedCategories(requestedCategories, tabs);

    const discoveredByCategory = {};
    for (const category of categorySelection.selected) {
      await clickRigidsTab(page, category.label);
      await ensureRigidsCustomFormat(page);
      discoveredByCategory[category.label] = await discoverRigidsOptions(page);
    }

    const result = {
      profile: PROFILE_RIGIDS,
      url: args.url,
      categories_requested: requestedCategories,
      categories_missing: categorySelection.missing,
      categories_used: categorySelection.selected.map((item) => item.label),
      tabs,
      discovered_by_category: discoveredByCategory,
    };

    console.log("Probe result:");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

async function runExtractRigids(args) {
  const browser = await chromium.launch({ headless: shouldLaunchHeadless(args, PROFILE_RIGIDS) });
  const page = await browser.newPage();

  try {
    await loadConfigurator(page, args.url);

    const tabs = await listRigidsTabs(page);
    const requestedCategories = args.categories || [];
    const categorySelection = selectRequestedCategories(requestedCategories, tabs);

    if (!categorySelection.selected.length) {
      throw new Error("No requested rigids categories were found on the page");
    }

    let areas = [...args.areas];
    let quantities = [...args.quantities];
    if (args.limitAreas > 0) areas = areas.slice(0, args.limitAreas);
    if (args.limitQuantities > 0) quantities = quantities.slice(0, args.limitQuantities);

    const rows = [];
    const discoveredByCategory = {};
    const categoryMaterialsSummary = {};

    for (const category of categorySelection.selected) {
      await clickRigidsTab(page, category.label);
      await ensureRigidsCustomFormat(page);

      const baseOptions = await discoverRigidsOptions(page);
      discoveredByCategory[category.label] = baseOptions;

      const allMaterials = (baseOptions.materials || []).filter((option) => !option.disabled);
      const materialLookup = new Map(allMaterials.map((option) => [normalizeKey(option.label), option]));

      let materials = allMaterials;
      const missingMaterials = [];

      if (args.materials.length) {
        materials = [];
        args.materials.forEach((materialLabel) => {
          const found = materialLookup.get(normalizeKey(materialLabel));
          if (found) materials.push(found);
          else missingMaterials.push(materialLabel);
        });
      }

      if (args.limitMaterials > 0) {
        materials = materials.slice(0, args.limitMaterials);
      }

      categoryMaterialsSummary[category.label] = {
        materials_available: allMaterials.map((item) => item.label),
        materials_used: materials.map((item) => item.label),
        materials_missing: missingMaterials,
      };

      for (const material of materials) {
        try {
          await setRigidsOptionByDataTest(page, material.data_test);
          await ensureRigidsCustomFormat(page);
          await ensurePriceGridVisible(page);
          await waitForGridStability(page, 20000, 600, 1);
        } catch (error) {
          const setupError = error instanceof Error ? error.message : String(error);
          console.log(
            `failed setup | category=${category.label} | material=${material.label} | error=${setupError}`
          );

          for (const areaM2 of areas) {
            const { widthCm, heightCm } = areaToDimensionsCm(areaM2, args.widthCm);
            for (const quantity of quantities) {
              rows.push({
                category: category.label,
                material: material.label,
                printing: "",
                white: "",
                cut: "",
                area_m2: areaM2,
                width_cm: widthCm,
                height_cm: heightCm,
                quantity,
                fastest_quote_eur: null,
                cheapest_quote_eur: null,
                fastest_price_per_m2_eur: null,
                cheapest_price_per_m2_eur: null,
                fastest_unit_price_eur: null,
                cheapest_unit_price_eur: null,
                price_columns_count: null,
                error: `material-setup-failed:${setupError}`,
              });
            }
          }
          continue;
        }

        const optionsForMaterial = await discoverRigidsOptions(page);
        const printingOptions = (optionsForMaterial.printing || []).filter((option) => !option.disabled);
        const selectedPrinting =
          printingOptions.length > 0
            ? printingOptions
            : [{ data_test: null, label: "One side", value: "one-side", selected: true, disabled: false }];

        for (const printing of selectedPrinting) {
          try {
            if (printing?.data_test) {
              await setRigidsOptionByDataTest(page, printing.data_test);
              await ensurePriceGridVisible(page);
              await waitForGridStability(page, 20000, 600, 1);
            }
          } catch (error) {
            const setupError = error instanceof Error ? error.message : String(error);
            console.log(
              `failed setup | category=${category.label} | material=${material.label} | printing=${printing.label} | error=${setupError}`
            );
            continue;
          }

          const optionsForPrinting = await discoverRigidsOptions(page);
          const whiteOptions =
            (optionsForPrinting.white || []).filter((option) => !option.disabled).length > 0
              ? (optionsForPrinting.white || []).filter((option) => !option.disabled)
              : [{ data_test: null, label: "None", value: "none", selected: true, disabled: false }];
          const cutOptions =
            (optionsForPrinting.cut || []).filter((option) => !option.disabled).length > 0
              ? (optionsForPrinting.cut || []).filter((option) => !option.disabled)
              : [{ data_test: null, label: "Rectangular", value: "rectangular", selected: true, disabled: false }];

          for (const white of whiteOptions) {
            if (white?.data_test) {
              try {
                await setRigidsOptionByDataTest(page, white.data_test);
                await ensurePriceGridVisible(page);
                await waitForGridStability(page, 20000, 600, 1);
              } catch {
                continue;
              }
            }

            for (const cut of cutOptions) {
              if (cut?.data_test) {
                try {
                  await setRigidsOptionByDataTest(page, cut.data_test);
                  await ensurePriceGridVisible(page);
                  await waitForGridStability(page, 20000, 600, 1);
                } catch {
                  continue;
                }
              }

              for (const areaM2 of areas) {
                const { widthCm, heightCm } = areaToDimensionsCm(areaM2, args.widthCm);
                try {
                  await ensureRigidsCustomFormat(page);
                  const appliedDimensions = await setDimensions(page, widthCm, heightCm);
                  const appliedAreaM2 = Number(
                    ((Number(appliedDimensions.widthCm) * Number(appliedDimensions.heightCm)) / 10000).toFixed(6)
                  );
                  await page.waitForTimeout(1400);
                  await ensurePriceGridVisible(page);

                  const visibleGridRows = await waitForGridStability(page, 22000, 600, 2);
                  const visibleRowByQuantity = new Map(
                    visibleGridRows.map((gridRow) => [Number(gridRow.quantity), gridRow])
                  );
                  if (!visibleGridRows.length) {
                    const debugGrid = await page.evaluate(() => ({
                      has_grid: !!document.querySelector(".price-grid.price-grid-container"),
                      qty_nodes: document.querySelectorAll(
                        ".quantities-column .quantity-container .qty-btn"
                      ).length,
                      cell_rows: document.querySelectorAll(".grid-overflow .cells-row").length,
                      first_qty_text:
                        document.querySelector(".quantities-column .quantity-container .qty-btn")
                          ?.textContent || null,
                    }));
                    console.log(
                      `No visible grid rows | category=${category.label} | material=${material.label} | printing=${printing.label} | white=${white.label} | cut=${cut.label} | area=${areaM2} | debug=${JSON.stringify(debugGrid)}`
                    );
                  }

                  for (const quantity of quantities) {
                    const row = {
                      category: category.label,
                      material: material.label,
                      printing: printing.label,
                      white: white.label,
                      cut: cut.label,
                      area_m2: Number.isFinite(appliedAreaM2) ? appliedAreaM2 : areaM2,
                      width_cm: Number.isFinite(appliedDimensions.widthCm)
                        ? appliedDimensions.widthCm
                        : widthCm,
                      height_cm: Number.isFinite(appliedDimensions.heightCm)
                        ? appliedDimensions.heightCm
                        : heightCm,
                      quantity,
                      fastest_quote_eur: null,
                      cheapest_quote_eur: null,
                      fastest_price_per_m2_eur: null,
                      cheapest_price_per_m2_eur: null,
                      fastest_unit_price_eur: null,
                      cheapest_unit_price_eur: null,
                      price_columns_count: null,
                      error: null,
                    };

                    process.stdout.write(
                      `Extracting | category=${category.label} | material=${material.label} | printing=${printing.label} | white=${white.label} | cut=${cut.label} | area=${areaM2} m2 | qty=${quantity} ... `
                    );

                    try {
                      let gridRow = visibleRowByQuantity.get(Number(quantity)) || null;
                      if (!gridRow) {
                        await setCustomQuantity(page, quantity);
                        const stabilizedRows = await waitForGridStability(page, 20000, 600, 1);
                        gridRow =
                          stabilizedRows.find((candidate) => Number(candidate.quantity) === Number(quantity)) ||
                          (await waitForQuantityRow(page, quantity, 15000));
                      }

                      if (!gridRow) {
                        row.error = "quantity-row-not-found";
                        console.log("failed (quantity-row-not-found)");
                      } else {
                        const normalizedAreaM2 = Number.isFinite(row.area_m2) ? row.area_m2 : areaM2;
                        const totalAreaM2 = normalizedAreaM2 * quantity;
                        row.fastest_quote_eur = Number(gridRow.fastest_price_eur.toFixed(4));
                        row.cheapest_quote_eur = Number(gridRow.cheapest_price_eur.toFixed(4));
                        row.price_columns_count = gridRow.price_columns_count;
                        row.fastest_price_per_m2_eur = Number(
                          (row.fastest_quote_eur / totalAreaM2).toFixed(6)
                        );
                        row.cheapest_price_per_m2_eur = Number(
                          (row.cheapest_quote_eur / totalAreaM2).toFixed(6)
                        );
                        row.fastest_unit_price_eur = Number(
                          (row.fastest_quote_eur / quantity).toFixed(6)
                        );
                        row.cheapest_unit_price_eur = Number(
                          (row.cheapest_quote_eur / quantity).toFixed(6)
                        );
                        console.log(
                          `ok (fast €${row.fastest_quote_eur} | cheap €${row.cheapest_quote_eur})`
                        );
                      }
                    } catch (error) {
                      row.error = error instanceof Error ? error.message : String(error);
                      console.log(`failed (${row.error})`);
                    }

                    rows.push(row);
                  }
                } catch (error) {
                  const setupError = error instanceof Error ? error.message : String(error);
                  console.log(
                    `failed combo | category=${category.label} | material=${material.label} | printing=${printing.label} | white=${white.label} | cut=${cut.label} | area=${areaM2} | error=${setupError}`
                  );
                  for (const quantity of quantities) {
                    rows.push({
                      category: category.label,
                      material: material.label,
                      printing: printing.label,
                      white: white.label,
                      cut: cut.label,
                      area_m2: areaM2,
                      width_cm: widthCm,
                      height_cm: heightCm,
                      quantity,
                      fastest_quote_eur: null,
                      cheapest_quote_eur: null,
                      fastest_price_per_m2_eur: null,
                      cheapest_price_per_m2_eur: null,
                      fastest_unit_price_eur: null,
                      cheapest_unit_price_eur: null,
                      price_columns_count: null,
                      error: `combo-setup-failed:${setupError}`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    const tierRows = buildRigidsTierRows(rows);
    ensureDir(args.outDir);
    const stamp = timestamp();
    const base = `${args.importFilePrefix}${stamp}`;
    const jsonPath = path.resolve(process.cwd(), args.outDir, `${base}.json`);
    const csvPath = path.resolve(process.cwd(), args.outDir, `${base}.csv`);

    const payload = {
      meta: {
        profile: PROFILE_RIGIDS,
        extracted_at: new Date().toISOString(),
        url: args.url,
        categories_requested: requestedCategories,
        categories_used: categorySelection.selected.map((item) => item.label),
        categories_missing: categorySelection.missing,
        areas_requested_m2: args.areas,
        quantities_requested: args.quantities,
        areas_used_m2: areas,
        quantities_used: quantities,
      },
      discovered_by_category: discoveredByCategory,
      category_materials_summary: categoryMaterialsSummary,
      rows,
      tiers: tierRows,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

    const csvHeaders = [
      "category",
      "material",
      "printing",
      "white",
      "cut",
      "area_m2",
      "width_cm",
      "height_cm",
      "quantity",
      "fastest_quote_eur",
      "cheapest_quote_eur",
      "fastest_price_per_m2_eur",
      "cheapest_price_per_m2_eur",
      "fastest_unit_price_eur",
      "cheapest_unit_price_eur",
      "price_columns_count",
      "error",
    ];

    const csvLines = [
      csvHeaders.join(","),
      ...rows.map((row) =>
        [
          row.category,
          row.material,
          row.printing,
          row.white,
          row.cut,
          row.area_m2,
          row.width_cm,
          row.height_cm,
          row.quantity,
          row.fastest_quote_eur,
          row.cheapest_quote_eur,
          row.fastest_price_per_m2_eur,
          row.cheapest_price_per_m2_eur,
          row.fastest_unit_price_eur,
          row.cheapest_unit_price_eur,
          row.price_columns_count,
          row.error,
        ]
          .map(formatCsvValue)
          .join(",")
      ),
    ];
    fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");

    const successCount = rows.filter((row) => Number.isFinite(row.cheapest_quote_eur)).length;
    console.log("\nExtraction complete:");
    console.log(`  Success rows: ${successCount}/${rows.length}`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  CSV:  ${csvPath}`);

    if (categorySelection.missing.length) {
      console.log(`Missing categories: ${categorySelection.missing.join(" | ")}`);
    }
  } finally {
    await browser.close();
  }
}

function ensureQuantityList(args, payload, parsedRows) {
  if (args.quantitiesExplicit && args.quantities.length) {
    return [...new Set(args.quantities.map((q) => Math.round(q)).filter((q) => q > 0))].sort(
      (a, b) => a - b
    );
  }

  const payloadQuantities = Array.isArray(payload?.meta?.quantities_used)
    ? payload.meta.quantities_used
    : [];
  if (payloadQuantities.length) {
    return [...new Set(payloadQuantities.map((q) => Math.round(Number(q))).filter((q) => q > 0))].sort(
      (a, b) => a - b
    );
  }

  const rowQuantities = [...new Set(parsedRows.map((row) => Math.round(row.quantity)).filter((q) => q > 0))].sort(
    (a, b) => a - b
  );
  return rowQuantities.length ? rowQuantities : [...DEFAULT_QUANTITIES];
}

function buildMaterialModels(parsedRows, payload, args) {
  const materialOrder = [];
  const pushMaterial = (name) => {
    const normalized = normalizeLabel(name);
    if (!normalized) return;
    if (!materialOrder.some((item) => normalizeKey(item) === normalizeKey(normalized))) {
      materialOrder.push(normalized);
    }
  };

  (payload?.meta?.materials_used || []).forEach(pushMaterial);
  parsedRows.forEach((row) => pushMaterial(row.material));

  const baseRows = parsedRows.filter((row) => row.lamination_key === NONE_LAMINATION_KEY);
  const models = [];

  for (const materialName of materialOrder) {
    const materialKey = normalizeKey(materialName);
    const preferredRows = baseRows.filter((row) => row.material_key === materialKey);
    const sourceRows = preferredRows.length
      ? preferredRows
      : parsedRows.filter((row) => row.material_key === materialKey);
    if (!sourceRows.length) continue;

    const pointBuckets = buildPointBuckets();
    sourceRows.forEach((row) => {
      addPointBucketValue(pointBuckets, row.total_area_m2, row.selected_price_per_m2_eur);
    });
    const reduced = reducePointBuckets(pointBuckets, "min");
    const tiers = sanitizeTierSeries(buildTierSeriesFromPoints(reduced, args), {
      allowNegative: false,
    });
    if (!tiers.length) continue;

    models.push({
      name: materialName,
      group_label: materialGroupLabel(materialName),
      tiers,
    });
  }

  return models;
}

function buildFinishModels(parsedRows, payload, args) {
  const laminationOrder = [];
  const pushLamination = (name) => {
    const normalized = normalizeLabel(name);
    if (!normalized) return;
    const key = normalizeLaminationKey(normalized);
    if (key === NONE_LAMINATION_KEY) return;
    if (!laminationOrder.some((item) => normalizeLaminationKey(item) === key)) {
      laminationOrder.push(normalized);
    }
  };

  (payload?.meta?.laminations_used || []).forEach(pushLamination);
  parsedRows.forEach((row) => pushLamination(row.lamination));

  const baseLookup = new Map();
  parsedRows
    .filter((row) => row.lamination_key === NONE_LAMINATION_KEY)
    .forEach((row) => {
      const key = `${row.material_key}||${row.area_m2}||${row.quantity}`;
      const existing = baseLookup.get(key);
      if (!Number.isFinite(existing) || row.selected_price_per_m2_eur < existing) {
        baseLookup.set(key, row.selected_price_per_m2_eur);
      }
    });

  const finishModels = [];

  for (const laminationName of laminationOrder) {
    const laminationKey = normalizeLaminationKey(laminationName);
    const rowsForLamination = parsedRows.filter((row) => row.lamination_key === laminationKey);
    if (!rowsForLamination.length) continue;

    const pointBuckets = buildPointBuckets();
    rowsForLamination.forEach((row) => {
      const baseKey = `${row.material_key}||${row.area_m2}||${row.quantity}`;
      const basePrice = baseLookup.get(baseKey);
      if (!Number.isFinite(basePrice)) return;
      // Finishes are modeled as add-ons in storformat, so keep non-negative surcharge deltas.
      const deltaPerM2 = Math.max(0, row.selected_price_per_m2_eur - basePrice);
      addPointBucketValue(pointBuckets, row.total_area_m2, deltaPerM2);
    });

    const reduced = reducePointBuckets(pointBuckets, "mean_non_zero");
    const tiers = buildTierSeriesFromPoints(reduced, args);
    if (!tiers.length) continue;

    finishModels.push({
      key: laminationKey,
      name: finishDisplayNameFromLamination(laminationName),
      tiers,
    });
  }

  return finishModels;
}

function buildDeliveryVariantModels(parsedRows, args) {
  const variants = [
    {
      key: "standard-delivery",
      name: "Standard delivery",
      pricing_mode: "fixed",
      tiers: [],
    },
  ];

  if (args.priceColumn !== "cheapest") {
    return variants;
  }

  const pointBuckets = buildPointBuckets();
  parsedRows.forEach((row) => {
    if (
      !Number.isFinite(row.fastest_price_per_m2_eur) ||
      !Number.isFinite(row.cheapest_price_per_m2_eur)
    ) {
      return;
    }
    const delta = row.fastest_price_per_m2_eur - row.cheapest_price_per_m2_eur;
    if (delta <= 0) return;
    addPointBucketValue(pointBuckets, row.total_area_m2, delta);
  });

  const reduced = reducePointBuckets(pointBuckets, "median");
  const tiers = buildTierSeriesFromPoints(reduced, args);
  if (!tiers.length) return variants;

  variants.push({
    key: "fast-delivery",
    name: "Fast delivery",
    pricing_mode: "per_m2",
    tiers,
  });

  return variants;
}

async function runImport(args) {
  const inputPath = resolveInputPath(args);
  const payload = readJsonFile(inputPath);
  const parsedRows = parseImportRows(payload, args);

  if (!parsedRows.length) {
    throw new Error(
      `No valid rows in input file (${inputPath}). Run extract again and ensure quotes are captured.`
    );
  }

  const quantities = ensureQuantityList(args, payload, parsedRows);
  const materialModels = buildMaterialModels(parsedRows, payload, args);
  if (!materialModels.length) {
    throw new Error("No material tiers could be built from extracted rows.");
  }
  const finishModels = buildFinishModels(parsedRows, payload, args);
  const variantModels = buildDeliveryVariantModels(parsedRows, args);

  const flatDefaults = getProfileDefaults(PROFILE_FLAT);
  const productName = normalizeLabel(args.productName) || flatDefaults.productName;
  const productSlug =
    slugify(args.productSlug || productName || flatDefaults.productSlug) || flatDefaults.productSlug;
  const productDescription = normalizeLabel(args.description) || flatDefaults.description;
  const roundingStep = Math.max(1, Math.round(args.roundingStep));

  const summary = {
    input: inputPath,
    tenant_id: args.tenantId,
    product: {
      name: productName,
      slug: productSlug,
      category: args.category,
      publish: args.publish,
    },
    rows: {
      parsed: parsedRows.length,
      materials: materialModels.length,
      finishes: finishModels.length,
      variants: variantModels.length,
      quantities: quantities.length,
    },
    transform: {
      price_column: args.priceColumn,
      eur_to_dkk: args.eurToDkk,
      markup_pct: args.markupPct,
      factor: Number((args.eurToDkk * (1 + args.markupPct / 100)).toFixed(4)),
    },
  };

  if (args.dryRun) {
    console.log("Import dry-run summary:");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const client = createSupabaseServiceClient();

  const assertNoError = (error, context) => {
    if (!error) return;
    const message = error.message || String(error);
    throw new Error(`${context}: ${message}`);
  };
  const isMissingTableError = (error) => {
    const message = error?.message || "";
    return message.includes("Could not find the table");
  };

  const productPayload = {
    tenant_id: args.tenantId,
    name: productName,
    slug: productSlug,
    icon_text: productName,
    description: productDescription,
    category: normalizeLabel(args.category) || DEFAULT_CATEGORY,
    pricing_type: "STORFORMAT",
    is_published: !!args.publish,
    preset_key: "custom",
    technical_specs: {
      source: "pixart",
      import_type: "wide-format",
      import_script: "fetch-pixart-flat-surface-adhesive-import.mjs",
      price_column: args.priceColumn,
      eur_to_dkk: args.eurToDkk,
      markup_pct: args.markupPct,
    },
  };

  const { data: existingProduct, error: existingProductError } = await client
    .from("products")
    .select("id")
    .eq("tenant_id", args.tenantId)
    .eq("slug", productSlug)
    .maybeSingle();
  assertNoError(existingProductError, "Fetch existing product");

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
      console.warn(`Skipping ${tableName}: table not found in this Supabase schema`);
      return;
    }
    assertNoError(error, `Delete ${tableName}`);
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

  const itemVisibility = args.tenantId === DEFAULT_TENANT_ID ? "public" : "tenant";

  const materialRows = materialModels.map((material, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    visibility: itemVisibility,
    name: material.name,
    group_label: material.group_label,
    bleed_mm: 3,
    safe_area_mm: 3,
    allow_split: true,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
  }));

  const materialIdByName = new Map(materialRows.map((row) => [normalizeKey(row.name), row.id]));
  const materialTierRows = [];
  const materialM2Rows = [];
  materialModels.forEach((material) => {
    const materialId = materialIdByName.get(normalizeKey(material.name));
    if (!materialId) return;
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
  });

  const finishRows = finishModels.map((finish, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    name: finish.name,
    group_label: "Lamination",
    pricing_mode: "per_m2",
    fixed_price_per_unit: 0,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
  }));

  const finishIdByKey = new Map(
    finishModels.map((finish, idx) => [finish.key, finishRows[idx].id])
  );
  const finishTierRows = [];
  const finishPriceRows = [];
  finishModels.forEach((finish) => {
    const finishId = finishIdByKey.get(finish.key);
    if (!finishId) return;
    finish.tiers.forEach((tier, idx) => {
      finishTierRows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        finish_id: finishId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
    });

    finishPriceRows.push({
      id: crypto.randomUUID(),
      tenant_id: args.tenantId,
      product_id: productId,
      finish_id: finishId,
      pricing_mode: "per_m2",
      fixed_price: 0,
      price_per_m2: finish.tiers[0]?.price_per_m2 || 0,
    });
  });

  const productVariantRows = variantModels.map((variant, idx) => ({
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

  const variantIdByKey = new Map(
    variantModels.map((variant, idx) => [variant.key, productVariantRows[idx].id])
  );
  const productTierRows = [];
  const productM2Rows = [];
  variantModels.forEach((variant) => {
    if (variant.pricing_mode !== "per_m2") return;
    const variantId = variantIdByKey.get(variant.key);
    if (!variantId) return;
    variant.tiers.forEach((tier, idx) => {
      productTierRows.push({
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
      productM2Rows.push({
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
  });

  if (materialRows.length) {
    const { error } = await client.from("storformat_materials").insert(materialRows);
    assertNoError(error, "Insert storformat_materials");
  }
  if (finishRows.length) {
    const { error } = await client.from("storformat_finishes").insert(finishRows);
    assertNoError(error, "Insert storformat_finishes");
  }
  if (productVariantRows.length) {
    const { error } = await client.from("storformat_products").insert(productVariantRows);
    assertNoError(error, "Insert storformat_products");
  }
  if (materialTierRows.length) {
    const { error } = await client.from("storformat_material_price_tiers").insert(materialTierRows);
    assertNoError(error, "Insert storformat_material_price_tiers");
  }
  if (materialM2Rows.length) {
    const { error } = await client.from("storformat_m2_prices").insert(materialM2Rows);
    assertNoError(error, "Insert storformat_m2_prices");
  }
  if (finishTierRows.length) {
    const { error } = await client.from("storformat_finish_price_tiers").insert(finishTierRows);
    assertNoError(error, "Insert storformat_finish_price_tiers");
  }
  if (finishPriceRows.length) {
    const { error } = await client.from("storformat_finish_prices").insert(finishPriceRows);
    assertNoError(error, "Insert storformat_finish_prices");
  }
  if (productTierRows.length) {
    const { error } = await client.from("storformat_product_price_tiers").insert(productTierRows);
    assertNoError(error, "Insert storformat_product_price_tiers");
  }
  if (productM2Rows.length) {
    const { error } = await client.from("storformat_product_m2_prices").insert(productM2Rows);
    if (error && isMissingTableError(error)) {
      console.warn(
        "Skipping storformat_product_m2_prices insert: table not found in this Supabase schema"
      );
    } else {
      assertNoError(error, "Insert storformat_product_m2_prices");
    }
  }

  const finishSectionValueIds = finishModels
    .map((finish) => finishIdByKey.get(finish.key))
    .filter(Boolean);
  const variantSectionValueIds = variantModels
    .map((variant) => variantIdByKey.get(variant.key))
    .filter(Boolean);
  const materialValueIds = materialRows.map((row) => row.id);

  const layoutSections = [];
  if (variantSectionValueIds.length) {
    layoutSections.push({
      id: "section-products",
      sectionType: "products",
      ui_mode: "buttons",
      selection_mode: "required",
      valueIds: variantSectionValueIds,
    });
  }
  if (finishSectionValueIds.length) {
    layoutSections.push({
      id: "section-finishes",
      sectionType: "finishes",
      ui_mode: "buttons",
      selection_mode: "optional",
      valueIds: finishSectionValueIds,
    });
  }

  const layoutRows = layoutSections.length
    ? [{ id: "row-variants-finishes", title: "Options", sections: layoutSections }]
    : [];

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
      valueIds: materialValueIds,
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

function selectedRigidsPricePerM2(row, args) {
  const selected =
    args.priceColumn === "fastest" ? row.fastest_price_per_m2_eur : row.cheapest_price_per_m2_eur;
  return toFiniteNumber(selected);
}

function rigidsPointKey(material, areaM2, quantity) {
  const areaPart = Number(areaM2).toFixed(6);
  const qtyPart = Math.round(Number(quantity));
  return `${normalizeKey(material)}||${areaPart}||${qtyPart}`;
}

function sanitizeTierSeries(
  tiers,
  { allowNegative = false, maxRiseRatio = 1.6, minFallRatio = 0.6, enforceLowerBound = true } = {}
) {
  if (!Array.isArray(tiers) || !tiers.length) return [];
  const sanitized = tiers.map((tier) => ({ ...tier }));
  const values = sanitized.map((tier) => toFiniteNumber(tier.price_per_m2));

  for (let idx = 0; idx < values.length; idx += 1) {
    const value = values[idx];
    if (!Number.isFinite(value)) continue;

    let nextPositiveValue = null;
    let hasLaterFiniteValue = false;
    for (let j = idx + 1; j < values.length; j += 1) {
      if (Number.isFinite(values[j])) {
        hasLaterFiniteValue = true;
        if (values[j] > 0) {
          nextPositiveValue = values[j];
          break;
        }
      }
    }

    let adjusted = value;
    if (!allowNegative && adjusted < 0) {
      adjusted = 0;
    }

    if (Number.isFinite(nextPositiveValue) && adjusted > nextPositiveValue * 2.5) {
      adjusted = nextPositiveValue * 1.15;
    } else if (
      !allowNegative &&
      hasLaterFiniteValue &&
      !Number.isFinite(nextPositiveValue) &&
      adjusted > 0
    ) {
      // Treat a lone leading spike with only zero-valued later tiers as extraction noise.
      adjusted = 0;
    }

    if (!allowNegative && adjusted < 0) {
      adjusted = 0;
    }

    values[idx] = adjusted;
    sanitized[idx].price_per_m2 = Number(adjusted.toFixed(6));
  }

  if (!allowNegative && values.length > 1) {
    for (let idx = values.length - 2; idx >= 0; idx -= 1) {
      const current = values[idx];
      const next = values[idx + 1];
      if (!Number.isFinite(current) || !Number.isFinite(next)) continue;

      const upper = next > 0 ? next * Math.max(1, maxRiseRatio) : Number.POSITIVE_INFINITY;
      const lower =
        enforceLowerBound && next > 0 ? next * Math.max(0, Math.min(1, minFallRatio)) : Number.NEGATIVE_INFINITY;

      let adjusted = current;
      if (Number.isFinite(upper) && adjusted > upper) adjusted = upper;
      if (Number.isFinite(lower) && adjusted < lower) adjusted = lower;
      if (!allowNegative && adjusted < 0) adjusted = 0;

      values[idx] = adjusted;
      sanitized[idx].price_per_m2 = Number(adjusted.toFixed(6));
    }
  }

  return sanitized;
}

function buildZeroTiersFromPoints(pointValues) {
  const sorted = [...new Set(pointValues.filter((value) => Number.isFinite(value)))].sort((a, b) => a - b);
  return sorted.map((fromM2, idx) => ({
    from_m2: Number(fromM2),
    to_m2: idx + 1 < sorted.length ? Number(sorted[idx + 1]) : null,
    price_per_m2: 0,
    is_anchor: true,
    sort_order: idx,
  }));
}

function buildRigidsDefaultsByMaterial(rows) {
  const byMaterial = new Map();
  rows.forEach((row) => {
    const materialKey = normalizeKey(row.material);
    if (!byMaterial.has(materialKey)) {
      byMaterial.set(materialKey, []);
    }
    byMaterial.get(materialKey).push(row);
  });

  const defaultsByMaterial = new Map();
  for (const [materialKey, materialRows] of byMaterial.entries()) {
    const printingOptions = [
      ...new Map(materialRows.map((row) => [normalizeKey(row.printing), row.printing])).values(),
    ]
      .filter(Boolean)
      .map((label) => ({ label, disabled: false }));
    const whiteOptions = [
      ...new Map(materialRows.map((row) => [normalizeKey(row.white), row.white])).values(),
    ]
      .filter(Boolean)
      .map((label) => ({ label, disabled: false }));
    const cutOptions = [
      ...new Map(materialRows.map((row) => [normalizeKey(row.cut), row.cut])).values(),
    ]
      .filter(Boolean)
      .map((label) => ({ label, disabled: false }));

    const defaultPrinting =
      chooseDefaultRigidsOption(printingOptions, ["single", "one side", "front only"])?.label ||
      printingOptions[0]?.label ||
      "";
    const defaultWhite =
      chooseDefaultRigidsOption(whiteOptions, ["none", "without", "no white"])?.label ||
      whiteOptions[0]?.label ||
      "";
    const defaultCut =
      chooseDefaultRigidsOption(cutOptions, ["rect", "rectangle"])?.label || cutOptions[0]?.label || "";

    defaultsByMaterial.set(materialKey, {
      printing: defaultPrinting,
      white: defaultWhite,
      cut: defaultCut,
    });
  }

  return defaultsByMaterial;
}

function buildRigidsBaselineLookup(rows, defaultsByMaterial, args) {
  const baselineByPoint = new Map();
  const bestScoreByPoint = new Map();

  rows.forEach((row) => {
    const materialKey = normalizeKey(row.material);
    const defaults = defaultsByMaterial.get(materialKey) || {
      printing: row.printing,
      white: row.white,
      cut: row.cut,
    };

    const selectedPerM2 = selectedRigidsPricePerM2(row, args);
    if (!Number.isFinite(selectedPerM2)) return;

    const score =
      (normalizeKey(row.printing) === normalizeKey(defaults.printing) ? 0 : 1) +
      (normalizeKey(row.white) === normalizeKey(defaults.white) ? 0 : 1) +
      (normalizeKey(row.cut) === normalizeKey(defaults.cut) ? 0 : 1);

    const key = rigidsPointKey(row.material, row.area_m2, row.quantity);
    const bestScore = bestScoreByPoint.get(key);
    if (bestScore == null || score < bestScore) {
      bestScoreByPoint.set(key, score);
      baselineByPoint.set(key, row);
      return;
    }

    if (score === bestScore) {
      const current = baselineByPoint.get(key);
      const currentPrice = current ? selectedRigidsPricePerM2(current, args) : null;
      if (!Number.isFinite(currentPrice) || selectedPerM2 < currentPrice) {
        baselineByPoint.set(key, row);
      }
    }
  });

  return baselineByPoint;
}

function buildRigidsMaterialModels(rows, baselineByPoint, args) {
  const materialOrder = [];
  rows.forEach((row) => {
    const normalized = normalizeLabel(row.material);
    const key = normalizeKey(normalized);
    if (normalized && !materialOrder.some((existing) => normalizeKey(existing) === key)) {
      materialOrder.push(normalized);
    }
  });

  const models = [];
  for (const materialName of materialOrder) {
    const materialKey = normalizeKey(materialName);
    const pointBuckets = buildPointBuckets();

    rows
      .filter((row) => normalizeKey(row.material) === materialKey)
      .forEach((row) => {
        const pointKey = rigidsPointKey(row.material, row.area_m2, row.quantity);
        const baseline = baselineByPoint.get(pointKey);
        const selectedPerM2 = baseline ? selectedRigidsPricePerM2(baseline, args) : null;
        if (!Number.isFinite(selectedPerM2)) return;
        const totalArea = Number((Number(row.area_m2) * Number(row.quantity)).toFixed(6));
        addPointBucketValue(pointBuckets, totalArea, selectedPerM2);
      });

    const reduced = reducePointBuckets(pointBuckets, "min");
    const tiers = sanitizeTierSeries(buildTierSeriesFromPoints(reduced, args), {
      allowNegative: false,
      maxRiseRatio: 1.45,
      minFallRatio: 1,
      enforceLowerBound: true,
    });
    if (!tiers.length) continue;

    models.push({
      name: materialName,
      group_label: materialGroupLabel(materialName),
      tiers,
    });
  }

  return models;
}

function buildRigidsDimensionModels({
  rows,
  args,
  defaultsByMaterial,
  baselineByPoint,
  dimension,
  groupLabel,
  defaultNeedles,
  fixedDimensions,
  maxDeltaRatio = null,
  reductionStrategy = "median",
}) {
  const optionOrder = [];
  const pushOption = (value) => {
    const label = normalizeLabel(value);
    if (!label) return;
    const key = normalizeKey(label);
    if (!optionOrder.some((existing) => normalizeKey(existing) === key)) {
      optionOrder.push(label);
    }
  };

  rows.forEach((row) => {
    pushOption(row[dimension]);
  });

  if (!optionOrder.length) return [];

  const optionCandidates = optionOrder.map((label) => ({ label, disabled: false }));
  const defaultOption =
    chooseDefaultRigidsOption(optionCandidates, defaultNeedles)?.label || optionOrder[0];
  const orderedOptions = [
    defaultOption,
    ...optionOrder.filter((label) => normalizeKey(label) !== normalizeKey(defaultOption)),
  ];

  const observedTotals = [
    ...new Set(
      rows
        .map((row) => Number((Number(row.area_m2) * Number(row.quantity)).toFixed(6)))
        .filter((value) => Number.isFinite(value))
    ),
  ].sort((a, b) => a - b);

  const models = [];
  orderedOptions.forEach((optionLabel, sortOrder) => {
    const optionKey = normalizeKey(optionLabel);
    const pointBuckets = buildPointBuckets();

    if (normalizeKey(optionLabel) === normalizeKey(defaultOption)) {
      observedTotals.forEach((totalArea) => addPointBucketValue(pointBuckets, totalArea, 0));
    } else {
      rows.forEach((row) => {
        const defaults = defaultsByMaterial.get(normalizeKey(row.material));
        if (!defaults) return;
        if (normalizeKey(row[dimension]) !== optionKey) return;

        const baseline = rows.find((candidate) => {
          if (normalizeKey(candidate.material) !== normalizeKey(row.material)) return false;
          if (Number(candidate.area_m2).toFixed(6) !== Number(row.area_m2).toFixed(6)) return false;
          if (Math.round(Number(candidate.quantity)) !== Math.round(Number(row.quantity))) return false;
          if (normalizeKey(candidate[dimension]) !== normalizeKey(defaults[dimension])) return false;

          return fixedDimensions.every(
            (fixedDimension) =>
              normalizeKey(candidate[fixedDimension]) === normalizeKey(row[fixedDimension])
          );
        });

        const baselinePerM2 = baseline ? selectedRigidsPricePerM2(baseline, args) : null;
        const optionPerM2 = selectedRigidsPricePerM2(row, args);
        if (!Number.isFinite(optionPerM2) || !Number.isFinite(baselinePerM2)) return;

        const totalArea = Number((Number(row.area_m2) * Number(row.quantity)).toFixed(6));
        let deltaPerM2 = Math.max(0, optionPerM2 - baselinePerM2);
        if (Number.isFinite(maxDeltaRatio) && maxDeltaRatio >= 0 && baselinePerM2 > 0) {
          deltaPerM2 = Math.min(deltaPerM2, baselinePerM2 * maxDeltaRatio);
        }
        addPointBucketValue(pointBuckets, totalArea, deltaPerM2);
      });
    }

    const reduced = reducePointBuckets(pointBuckets, reductionStrategy);
    const tiers = sanitizeTierSeries(buildTierSeriesFromPoints(reduced, args), {
      allowNegative: false,
      maxRiseRatio: 1.6,
      minFallRatio: 0,
      enforceLowerBound: false,
    });
    if (!tiers.length) return;

    models.push({
      key: `${normalizeKey(groupLabel)}::${optionKey}`,
      name: optionLabel,
      group_label: groupLabel,
      pricing_mode: "per_m2",
      tiers,
      sort_order: sortOrder,
    });
  });

  return models;
}

function buildRigidsDeliveryModels(rows, args) {
  const observedTotals = [
    ...new Set(
      rows
        .map((row) => Number((Number(row.area_m2) * Number(row.quantity)).toFixed(6)))
        .filter((value) => Number.isFinite(value))
    ),
  ].sort((a, b) => a - b);

  if (!observedTotals.length) {
    return [];
  }

  const deltaBuckets = buildPointBuckets();
  rows.forEach((row) => {
    const fastest = toFiniteNumber(row.fastest_price_per_m2_eur);
    const cheapest = toFiniteNumber(row.cheapest_price_per_m2_eur);
    if (!Number.isFinite(fastest) || !Number.isFinite(cheapest)) return;
    const totalArea = Number((Number(row.area_m2) * Number(row.quantity)).toFixed(6));
    const rawDelta = Math.max(0, fastest - cheapest);
    const deltaPerM2 = cheapest > 0 ? Math.min(rawDelta, cheapest * 0.8) : rawDelta;
    addPointBucketValue(deltaBuckets, totalArea, deltaPerM2);
  });

  const reduced = reducePointBuckets(deltaBuckets, "median");
  const fastTiers = sanitizeTierSeries(buildTierSeriesFromPoints(reduced, args), {
    allowNegative: false,
    maxRiseRatio: 1.6,
    minFallRatio: 0,
    enforceLowerBound: false,
  });
  const pointsForStandard = fastTiers.length
    ? fastTiers.map((tier) => Number(tier.from_m2))
    : observedTotals;
  const standardTiers = buildZeroTiersFromPoints(pointsForStandard);
  const normalizedFastTiers = fastTiers.length
    ? fastTiers
    : buildZeroTiersFromPoints(pointsForStandard);

  return [
    {
      key: "delivery::standard",
      name: "Standard production",
      group_label: "Production",
      pricing_mode: "per_m2",
      tiers: standardTiers,
      sort_order: 0,
    },
    {
      key: "delivery::fast",
      name: "Fast production",
      group_label: "Production",
      pricing_mode: "per_m2",
      tiers: normalizedFastTiers,
      sort_order: 1,
    },
  ];
}

async function importRigidsCategory({
  args,
  categoryLabel,
  inputPath,
  productName,
  productSlug,
  productDescription,
  quantities,
  materialModels,
  whiteModels,
  printingModels,
  cutModels,
  deliveryModels,
}) {
  const summary = {
    input: inputPath,
    tenant_id: args.tenantId,
    product: {
      name: productName,
      slug: productSlug,
      category: args.category,
      publish: args.publish,
    },
    rows: {
      materials: materialModels.length,
      white_options: whiteModels.length,
      printing_options: printingModels.length,
      cut_options: cutModels.length,
      delivery_options: deliveryModels.length,
      quantities: quantities.length,
    },
    transform: {
      price_column: args.priceColumn,
      eur_to_dkk: args.eurToDkk,
      markup_pct: args.markupPct,
      factor: Number((args.eurToDkk * (1 + args.markupPct / 100)).toFixed(4)),
    },
  };

  if (args.dryRun) {
    console.log("Rigids import dry-run summary:");
    console.log(JSON.stringify(summary, null, 2));
    return null;
  }

  const client = createSupabaseServiceClient();

  const assertNoError = (error, context) => {
    if (!error) return;
    const message = error.message || String(error);
    throw new Error(`${context}: ${message}`);
  };
  const isMissingTableError = (error) => {
    const message = error?.message || "";
    return message.includes("Could not find the table");
  };

  const productPayload = {
    tenant_id: args.tenantId,
    name: productName,
    slug: productSlug,
    icon_text: productName,
    description: productDescription,
    category: normalizeLabel(args.category) || DEFAULT_CATEGORY,
    pricing_type: "STORFORMAT",
    is_published: !!args.publish,
    preset_key: "custom",
    technical_specs: {
      source: "pixart",
      import_type: "wide-format-rigids",
      import_script: "fetch-pixart-flat-surface-adhesive-import.mjs",
      import_category: categoryLabel,
      price_column: args.priceColumn,
      eur_to_dkk: args.eurToDkk,
      markup_pct: args.markupPct,
    },
  };

  const { data: existingProduct, error: existingProductError } = await client
    .from("products")
    .select("id")
    .eq("tenant_id", args.tenantId)
    .eq("slug", productSlug)
    .maybeSingle();
  assertNoError(existingProductError, "Fetch existing product");

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
      console.warn(`Skipping ${tableName}: table not found in this Supabase schema`);
      return;
    }
    assertNoError(error, `Delete ${tableName}`);
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

  const materialRows = materialModels.map((material, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    name: material.name,
    group_label: material.group_label,
    bleed_mm: 3,
    safe_area_mm: 3,
    allow_split: true,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
  }));
  const materialIdByName = new Map(materialRows.map((row) => [normalizeKey(row.name), row.id]));
  const materialTierRows = [];
  const materialM2Rows = [];
  materialModels.forEach((material) => {
    const materialId = materialIdByName.get(normalizeKey(material.name));
    if (!materialId) return;
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
  });

  const finishRows = whiteModels.map((finish, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    visibility: itemVisibility,
    name: finish.name,
    group_label: finish.group_label || "White",
    pricing_mode: "per_m2",
    fixed_price_per_unit: 0,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
  }));
  const finishIdByKey = new Map(whiteModels.map((finish, idx) => [finish.key, finishRows[idx].id]));
  const finishTierRows = [];
  const finishPriceRows = [];
  whiteModels.forEach((finish) => {
    const finishId = finishIdByKey.get(finish.key);
    if (!finishId) return;
    finish.tiers.forEach((tier, idx) => {
      finishTierRows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        finish_id: finishId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
    });
    finishPriceRows.push({
      id: crypto.randomUUID(),
      tenant_id: args.tenantId,
      product_id: productId,
      finish_id: finishId,
      pricing_mode: "per_m2",
      fixed_price: 0,
      price_per_m2: finish.tiers[0]?.price_per_m2 || 0,
    });
  });

  const optionModels = [
    ...printingModels.map((model) => ({ ...model, section: "printing" })),
    ...cutModels.map((model) => ({ ...model, section: "cut" })),
    ...deliveryModels.map((model) => ({ ...model, section: "delivery" })),
  ];
  const optionRows = optionModels.map((option, idx) => ({
    id: crypto.randomUUID(),
    tenant_id: args.tenantId,
    product_id: productId,
    visibility: itemVisibility,
    name: option.name,
    group_label: option.group_label || "Option",
    pricing_mode: "per_m2",
    initial_price: 0,
    interpolation_enabled: true,
    markup_pct: 0,
    sort_order: idx,
    pricing_type: "m2",
    percentage_markup: 0,
    min_price: 0,
  }));
  const optionIdByKey = new Map(optionModels.map((option, idx) => [option.key, optionRows[idx].id]));
  const optionTierRows = [];
  const optionM2Rows = [];
  optionModels.forEach((option) => {
    const optionId = optionIdByKey.get(option.key);
    if (!optionId) return;
    option.tiers.forEach((tier, idx) => {
      optionTierRows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        product_item_id: optionId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
        markup_pct: 0,
        sort_order: idx,
      });
      optionM2Rows.push({
        id: crypto.randomUUID(),
        tenant_id: args.tenantId,
        product_id: productId,
        storformat_product_id: optionId,
        from_m2: tier.from_m2,
        to_m2: tier.to_m2,
        price_per_m2: tier.price_per_m2,
        is_anchor: true,
      });
    });
  });

  if (materialRows.length) {
    const { error } = await client.from("storformat_materials").insert(materialRows);
    assertNoError(error, "Insert storformat_materials");
  }
  if (finishRows.length) {
    const { error } = await client.from("storformat_finishes").insert(finishRows);
    assertNoError(error, "Insert storformat_finishes");
  }
  if (optionRows.length) {
    const { error } = await client.from("storformat_products").insert(optionRows);
    assertNoError(error, "Insert storformat_products");
  }
  if (materialTierRows.length) {
    const { error } = await client.from("storformat_material_price_tiers").insert(materialTierRows);
    assertNoError(error, "Insert storformat_material_price_tiers");
  }
  if (materialM2Rows.length) {
    const { error } = await client.from("storformat_m2_prices").insert(materialM2Rows);
    assertNoError(error, "Insert storformat_m2_prices");
  }
  if (finishTierRows.length) {
    const { error } = await client.from("storformat_finish_price_tiers").insert(finishTierRows);
    assertNoError(error, "Insert storformat_finish_price_tiers");
  }
  if (finishPriceRows.length) {
    const { error } = await client.from("storformat_finish_prices").insert(finishPriceRows);
    assertNoError(error, "Insert storformat_finish_prices");
  }
  if (optionTierRows.length) {
    const { error } = await client.from("storformat_product_price_tiers").insert(optionTierRows);
    assertNoError(error, "Insert storformat_product_price_tiers");
  }
  if (optionM2Rows.length) {
    const { error } = await client.from("storformat_product_m2_prices").insert(optionM2Rows);
    if (error && isMissingTableError(error)) {
      console.warn(
        "Skipping storformat_product_m2_prices insert: table not found in this Supabase schema"
      );
    } else {
      assertNoError(error, "Insert storformat_product_m2_prices");
    }
  }

  const printingValueIds = printingModels.map((model) => optionIdByKey.get(model.key)).filter(Boolean);
  const cutValueIds = cutModels.map((model) => optionIdByKey.get(model.key)).filter(Boolean);
  const deliveryValueIds = deliveryModels.map((model) => optionIdByKey.get(model.key)).filter(Boolean);
  const whiteValueIds = whiteModels.map((model) => finishIdByKey.get(model.key)).filter(Boolean);
  const materialValueIds = materialRows.map((row) => row.id);

  const sections = [];
  if (printingValueIds.length) {
    sections.push({
      id: "section-printing",
      sectionType: "products",
      title: "Printing",
      ui_mode: "buttons",
      selection_mode: "required",
      valueIds: printingValueIds,
    });
  }
  if (whiteValueIds.length) {
    sections.push({
      id: "section-white",
      sectionType: "finishes",
      title: "White",
      ui_mode: "buttons",
      selection_mode: "required",
      valueIds: whiteValueIds,
    });
  }
  if (cutValueIds.length) {
    sections.push({
      id: "section-cut",
      sectionType: "products",
      title: "Cut",
      ui_mode: "buttons",
      selection_mode: "required",
      valueIds: cutValueIds,
    });
  }
  if (deliveryValueIds.length) {
    sections.push({
      id: "section-production",
      sectionType: "products",
      title: "Production",
      ui_mode: "buttons",
      selection_mode: "required",
      valueIds: deliveryValueIds,
    });
  }

  const configRow = {
    tenant_id: args.tenantId,
    product_id: productId,
    pricing_mode: "m2_rates",
    rounding_step: Math.max(1, Math.round(args.roundingStep)),
    global_markup_pct: 0,
    quantities,
    layout_rows: sections.length
      ? [
          {
            id: "row-options",
            title: "Options",
            sections,
          },
        ]
      : [],
    vertical_axis: {
      id: "vertical-axis",
      sectionType: "materials",
      valueIds: materialValueIds,
      valueSettings: {},
    },
    is_published: !!args.publish,
  };

  const { error: configError } = await client
    .from("storformat_configs")
    .upsert(configRow, { onConflict: "product_id" });
  assertNoError(configError, "Upsert storformat_configs");

  console.log("Rigids import complete:");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Product id: ${productId}`);
  return productId;
}

async function runImportRigids(args) {
  const inputPath = resolveInputPath(args);
  const payload = readJsonFile(inputPath);
  const sourceRows = Array.isArray(payload?.rows) ? payload.rows : [];

  const requestedCategories = args.categories || [];
  const rawCategories = [...new Set(sourceRows.map((row) => normalizeLabel(row?.category)).filter(Boolean))];

  const selectedCategories = requestedCategories.length
    ? requestedCategories.filter((requested) =>
        rawCategories.some((available) => normalizeKey(available) === normalizeKey(requested))
      )
    : rawCategories;

  if (!selectedCategories.length) {
    throw new Error(`No category rows found in ${inputPath} for rigids import.`);
  }

  const summary = [];

  for (const categoryLabel of selectedCategories) {
    const categoryRows = sourceRows.filter(
      (row) => normalizeKey(row?.category) === normalizeKey(categoryLabel)
    );

    const validRows = categoryRows
      .map((row) => ({
        category: normalizeLabel(row.category),
        material: normalizeLabel(row.material),
        printing: normalizeLabel(row.printing),
        white: normalizeLabel(row.white),
        cut: normalizeLabel(row.cut),
        area_m2: toFiniteNumber(row.area_m2),
        quantity: toFiniteNumber(row.quantity),
        fastest_quote_eur: toFiniteNumber(row.fastest_quote_eur),
        cheapest_quote_eur: toFiniteNumber(row.cheapest_quote_eur),
        fastest_price_per_m2_eur: toFiniteNumber(row.fastest_price_per_m2_eur),
        cheapest_price_per_m2_eur: toFiniteNumber(row.cheapest_price_per_m2_eur),
        fastest_unit_price_eur: toFiniteNumber(row.fastest_unit_price_eur),
        cheapest_unit_price_eur: toFiniteNumber(row.cheapest_unit_price_eur),
      }))
      .filter(
        (row) =>
          row.material &&
          Number.isFinite(row.area_m2) &&
          Number.isFinite(row.quantity) &&
          Number.isFinite(row.cheapest_price_per_m2_eur)
      );

    if (!validRows.length) {
      console.warn(`Skipping category "${categoryLabel}" - no valid rows`);
      continue;
    }

    const defaultsByMaterial = buildRigidsDefaultsByMaterial(validRows);
    const baselineByPoint = buildRigidsBaselineLookup(validRows, defaultsByMaterial, args);

    const materialModels = buildRigidsMaterialModels(validRows, baselineByPoint, args);
    const whiteModels = buildRigidsDimensionModels({
      rows: validRows,
      args,
      defaultsByMaterial,
      baselineByPoint,
      dimension: "white",
      groupLabel: "White",
      defaultNeedles: ["none", "without", "no white"],
      fixedDimensions: ["printing", "cut"],
      maxDeltaRatio: 0.75,
      reductionStrategy: "mean_non_zero",
    });
    const printingModels = buildRigidsDimensionModels({
      rows: validRows,
      args,
      defaultsByMaterial,
      baselineByPoint,
      dimension: "printing",
      groupLabel: "Printing",
      defaultNeedles: ["single", "one side", "front only"],
      fixedDimensions: ["white", "cut"],
      maxDeltaRatio: 0.6,
    });
    const cutModels = buildRigidsDimensionModels({
      rows: validRows,
      args,
      defaultsByMaterial,
      baselineByPoint,
      dimension: "cut",
      groupLabel: "Cut",
      defaultNeedles: ["rect", "rectangle"],
      fixedDimensions: ["printing", "white"],
      maxDeltaRatio: 0.5,
    });
    const deliveryModels = buildRigidsDeliveryModels(validRows, args);

    if (!materialModels.length) {
      console.warn(`Skipping category "${categoryLabel}" - could not build material tiers`);
      continue;
    }

    const materialOrder = [
      ...new Map(validRows.map((row) => [normalizeKey(row.material), row.material])).values(),
    ];
    const whiteOrder = whiteModels.map((model) => model.name);
    const printingOrder = printingModels.map((model) => model.name);
    const cutOrder = cutModels.map((model) => model.name);
    const quantitiesUsed = [
      ...new Set(
        validRows
          .map((row) => Math.round(Number(row.quantity)))
          .filter((value) => Number.isFinite(value) && value > 0)
      ),
    ].sort((a, b) => a - b);

    const transformedPayload = {
      meta: {
        profile: PROFILE_RIGIDS,
        source_input: inputPath,
        category: categoryLabel,
        extracted_at: payload?.meta?.extracted_at || new Date().toISOString(),
        url: payload?.meta?.url || args.url,
        materials_used: materialOrder,
        white_options: whiteOrder,
        printing_options: printingOrder,
        cut_options: cutOrder,
        quantities_used: quantitiesUsed,
      },
      rows: validRows,
    };

    ensureDir(args.outDir);
    const tempFilePath = path.resolve(
      process.cwd(),
      args.outDir,
      `${args.importFilePrefix}${slugify(categoryLabel)}-transformed-${timestamp()}.json`
    );
    fs.writeFileSync(tempFilePath, JSON.stringify(transformedPayload, null, 2), "utf8");

    const categoryProductName = buildCategoryProductName(args, categoryLabel);
    const categoryProductSlug = buildCategoryProductSlug(args, categoryLabel);
    const categoryDescription = `${normalizeLabel(args.description) || DEFAULT_DESCRIPTION_BY_PROFILE[PROFILE_RIGIDS]} (${categoryLabel})`;

    console.log(`\nImporting category "${categoryLabel}" -> ${categoryProductName} (${categoryProductSlug})`);
    await importRigidsCategory({
      args,
      categoryLabel,
      inputPath: tempFilePath,
      productName: categoryProductName,
      productSlug: categoryProductSlug,
      productDescription: categoryDescription,
      quantities: args.quantities.length
        ? [...new Set(args.quantities.map((q) => Math.round(q)).filter((q) => q > 0))].sort((a, b) => a - b)
        : quantitiesUsed,
      materialModels,
      whiteModels,
      printingModels,
      cutModels,
      deliveryModels,
    });

    summary.push({
      category: categoryLabel,
      product_name: categoryProductName,
      product_slug: categoryProductSlug,
      rows: validRows.length,
      materials: materialModels.length,
      white_options: whiteModels.length,
      printing_options: printingModels.length,
      cut_options: cutModels.length,
      delivery_options: deliveryModels.length,
      transformed_input: tempFilePath,
    });
  }

  console.log("\nRigids import complete:");
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }

  if (!args.command || args.command === "--help" || args.command === "help") {
    console.log(usage());
    process.exit(0);
  }

  if (args.command === "probe") {
    if (args.profile === PROFILE_RIGIDS) {
      await runProbeRigids(args);
    } else {
      await runProbe(args);
    }
    return;
  }

  if (args.command === "extract") {
    if (args.profile === PROFILE_RIGIDS) {
      await runExtractRigids(args);
    } else {
      await runExtract(args);
    }
    return;
  }

  if (args.command === "import") {
    if (args.profile === PROFILE_RIGIDS) {
      await runImportRigids(args);
    } else {
      await runImport(args);
    }
    return;
  }

  console.error(`Unknown command: ${args.command}`);
  console.error(usage());
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
