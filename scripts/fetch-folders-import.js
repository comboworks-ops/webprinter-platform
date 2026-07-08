#!/usr/bin/env node
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { parseLocalizedNumber, resolveTierMultiplier, roundToStep } from "./product-import/ul-prices.js";
import { ensureDir, timestampForFile } from "./product-import/snapshot-io.js";
import { publishNormalizedMatrixProduct } from "./product-import/shared/matrix-publisher.js";
import {
  buildFoldersMatrixConfig,
  createFolderNormalizedRows,
  mergeFolderTransformedRows,
  sortFolderTransformedRows,
} from "./product-import/shared/folders-matrix.js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "new folders";
const DEFAULT_PRODUCT_SLUG = "new-folders";
const EUR_TO_DKK = 7.5;

const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

const TARGET_QUANTITIES = [
  50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000,
  7000, 8000, 9000, 10000, 12500, 15000, 20000,
];

const PAGES_ORDER = ["4 sider", "6 sider", "8 sider", "10 sider"];
const ORIENTATION_ORDER = ["Lodret", "Vandret"];
const SURFACE_ORDER = ["Matsilk", "Glans"];
const DIN_FORMAT_DIMS_MM = {
  "DIN Lang": { widthMm: 99, heightMm: 210 },
  "DIN A7": { widthMm: 74, heightMm: 105 },
  "DIN A6": { widthMm: 105, heightMm: 148 },
  "DIN A5": { widthMm: 148, heightMm: 210 },
  "DIN A4": { widthMm: 210, heightMm: 297 },
};

const MATERIAL_PATTERNS = [
  /^115g hochwertiger Qualitätsdruck (matt|glänzend)$/i,
  /^135g hochwertiger Qualitätsdruck (matt|glänzend)$/i,
  /^170g hochwertiger Qualitätsdruck (matt|glänzend)$/i,
  /^250g hochwertiger Qualitätsdruck (matt|glänzend)$/i,
  /^Offset:\s*80g Qualitätsdruck auf Offsetpapier/i,
  /^Recycling:\s*135g Qualitätsdruck auf hochwertigem Recyclingpapier weiß$/i,
];

const SOURCE_GROUPS = [
  {
    key: "mittelfalz",
    foldLabel: "Folder midterfalset",
    categoryKeyword: "mittelfalz",
    seedCategoryUrls: [
      "https://www.wir-machen-druck.de/falzflyer-mittelfalz-auf-din-lang-bedrucken-lassen-online,category,22288.html",
      "https://www.wir-machen-druck.de/falzflyer-mittelfalz-auf-din-a7-bedrucken-lassen-online,category,22289.html",
      "https://www.wir-machen-druck.de/falzflyer-mittelfalz-auf-din-a6-bedrucken-lassen-online,category,22290.html",
      "https://www.wir-machen-druck.de/falzflyer-mittelfalz-auf-din-a5-bedrucken-lassen-online,category,22291.html",
      "https://www.wir-machen-druck.de/falzflyer-mittelfalz-auf-din-a4-bedrucken-lassen-online,category,22292.html",
      "https://www.wir-machen-druck.de/falzflyer-mittelfalz-auf-quadrat-bedrucken-lassen-online,category,22293.html",
    ],
    includeDetail(url) {
      if (!url.includes("mittelfalz")) return false;
      const sides = extractSides(url);
      if (sides !== 4) return false;
      return true;
    },
    selectionInfo(url) {
      return {
        pagesLabel: "4 sider",
        orientationLabel: orientationLabelFromUrl(url),
      };
    },
  },
  {
    key: "wickelfalz",
    foldLabel: "Rullefalset",
    categoryKeyword: "wickelfalz",
    seedCategoryUrls: [
      "https://www.wir-machen-druck.de/falzflyer-wickelfalz,category,22428.html",
      "https://www.wir-machen-druck.de/falzflyer-wickelfalz-auf-quadrat-bedrucken-lassen-online,category,22300.html",
    ],
    includeDetail(url) {
      if (!url.includes("wickelfalz")) return false;
      const sides = extractSides(url);
      if (!sides) return false;
      if (sides === 12) return false;
      return [6, 8, 10].includes(sides);
    },
    selectionInfo(url) {
      const sides = extractSides(url);
      return {
        pagesLabel: pagesLabelFromSides(sides),
        orientationLabel: orientationLabelFromUrl(url),
      };
    },
  },
  {
    key: "zickzackfalz",
    foldLabel: "zigzag falset",
    categoryKeyword: "zickzackfalz",
    seedCategoryUrls: [
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz,category,22429.html",
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz-auf-din-lang-bedrucken-lassen-online,category,22302.html",
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz-auf-din-a7-bedrucken-lassen-online,category,22303.html",
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz-auf-din-a6-bedrucken-lassen-online,category,22304.html",
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz-auf-din-a5-bedrucken-lassen-online,category,22305.html",
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz-auf-din-a4-bedrucken-lassen-online,category,22306.html",
      "https://www.wir-machen-druck.de/falzflyer-zickzackfalz-auf-quadrat-bedrucken-lassen-online,category,22307.html",
    ],
    includeDetail(url) {
      if (!url.includes("zickzackfalz")) return false;
      const sides = extractSides(url);
      if (!sides) return false;
      if (sides === 12) return false;
      return [6, 8, 10].includes(sides);
    },
    selectionInfo(url) {
      const sides = extractSides(url);
      return {
        pagesLabel: pagesLabelFromSides(sides),
        orientationLabel: orientationLabelFromUrl(url),
      };
    },
  },
];

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-folders-import.js import [--dry-run] [--bank-snapshot-only] [--write-bank] [--allow-partial-bank-snapshot] [--merge-existing] [--prefer-source] [--from-existing-product] [--max-detail-pages N] [--tenant <uuid>] [--name <product name>] [--slug <slug>] [--from-clean-csv <path>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || "",
    dryRun: argv.includes("--dry-run"),
    bankSnapshotOnly: argv.includes("--bank-snapshot-only"),
    writeBank: argv.includes("--write-bank"),
    allowPartialBankSnapshot: argv.includes("--allow-partial-bank-snapshot"),
    mergeExisting: argv.includes("--merge-existing"),
    preferSource: argv.includes("--prefer-source"),
    fromExistingProduct: argv.includes("--from-existing-product"),
    maxDetailPages: null,
    tenantId: DEFAULT_TENANT_ID,
    productName: DEFAULT_PRODUCT_NAME,
    productSlug: DEFAULT_PRODUCT_SLUG,
    fromCleanCsv: null,
  };

  const maxIdx = argv.indexOf("--max-detail-pages");
  if (maxIdx !== -1) {
    const raw = argv[maxIdx + 1];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("--max-detail-pages must be a positive integer");
    }
    args.maxDetailPages = parsed;
  }

  const tenantIdx = argv.indexOf("--tenant");
  if (tenantIdx !== -1 && argv[tenantIdx + 1]) {
    args.tenantId = argv[tenantIdx + 1];
  }

  const nameIdx = argv.indexOf("--name");
  if (nameIdx !== -1 && argv[nameIdx + 1]) {
    args.productName = argv[nameIdx + 1];
  }

  const slugIdx = argv.indexOf("--slug");
  if (slugIdx !== -1 && argv[slugIdx + 1]) {
    args.productSlug = argv[slugIdx + 1];
  }

  const fromCsvIdx = argv.indexOf("--from-clean-csv");
  if (fromCsvIdx !== -1 && argv[fromCsvIdx + 1]) {
    args.fromCleanCsv = argv[fromCsvIdx + 1];
  }

  if (args.writeBank && !args.bankSnapshotOnly) {
    throw new Error("--write-bank must be used together with --bank-snapshot-only");
  }

  if (args.writeBank && args.allowPartialBankSnapshot) {
    throw new Error("--allow-partial-bank-snapshot cannot be used together with --write-bank");
  }

  return args;
}

function extractSides(url) {
  const match = url.match(/(\d+)-?seitig/i);
  if (!match) return null;
  return Number(match[1]);
}

function pagesLabelFromSides(sides) {
  if (!sides || !Number.isFinite(sides)) return "Ukendt";
  if (PAGES_ORDER.includes(`${sides} sider`)) return `${sides} sider`;
  return `${sides} sider`;
}

function orientationLabelFromUrl(url) {
  const normalized = String(url || "").toLowerCase();
  if (normalized.includes("horizontaler") || normalized.includes("-quer-")) {
    return "Vandret";
  }
  return "Lodret";
}

function normalizeLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function materialWanted(label) {
  const normalized = normalizeLabel(label);
  return MATERIAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function mapImportedMaterial(label) {
  const normalized = normalizeLabel(label);
  const lower = normalized.toLowerCase();

  // Hidden by request from active matrix.
  if (lower.startsWith("offset: 80g qualitätsdruck auf offsetpapier")) {
    return null;
  }

  if (/^115g hochwertiger qualitätsdruck matt$/i.test(normalized)) {
    return { materialLabel: "115g papir", surfaceLabel: "Matsilk" };
  }
  if (/^115g hochwertiger qualitätsdruck glänzend$/i.test(normalized)) {
    return { materialLabel: "115g papir", surfaceLabel: "Glans" };
  }

  if (/^135g hochwertiger qualitätsdruck matt$/i.test(normalized)) {
    return { materialLabel: "135g papir", surfaceLabel: "Matsilk" };
  }
  if (/^135g hochwertiger qualitätsdruck glänzend$/i.test(normalized)) {
    return { materialLabel: "135g papir", surfaceLabel: "Glans" };
  }

  if (/^170g hochwertiger qualitätsdruck matt$/i.test(normalized)) {
    return { materialLabel: "170g papir", surfaceLabel: "Matsilk" };
  }
  if (/^170g hochwertiger qualitätsdruck glänzend$/i.test(normalized)) {
    return { materialLabel: "170g papir", surfaceLabel: "Glans" };
  }

  if (/^250g hochwertiger qualitätsdruck matt$/i.test(normalized)) {
    return { materialLabel: "250g papir", surfaceLabel: "Matsilk" };
  }
  if (/^250g hochwertiger qualitätsdruck glänzend$/i.test(normalized)) {
    return { materialLabel: "250g papir", surfaceLabel: "Glans" };
  }

  if (/^recycling:\s*135g qualitätsdruck auf hochwertigem recyclingpapier weiß$/i.test(normalized)) {
    // Recycling is exposed as a single matsilk-backed paper option in the live folder matrix.
    return {
      materialLabel: "135g 100% genbrugspapir",
      surfaceLabel: "Matsilk",
    };
  }

  return null;
}

function formatCm(mmText) {
  const value = Number(mmText);
  if (!Number.isFinite(value) || value <= 0) return null;
  const cm = value / 10;
  if (Math.abs(cm - Math.round(cm)) < 0.0001) {
    return `${Math.round(cm)}`;
  }
  return cm.toFixed(1);
}

function parseFormatFromUrl(url) {
  const lower = url.toLowerCase();

  if (lower.includes("din-lang")) return { label: "DIN Lang", ...DIN_FORMAT_DIMS_MM["DIN Lang"] };
  if (lower.includes("din-a7")) return { label: "DIN A7", ...DIN_FORMAT_DIMS_MM["DIN A7"] };
  if (lower.includes("din-a6")) return { label: "DIN A6", ...DIN_FORMAT_DIMS_MM["DIN A6"] };
  if (lower.includes("din-a5")) return { label: "DIN A5", ...DIN_FORMAT_DIMS_MM["DIN A5"] };
  if (lower.includes("din-a4")) return { label: "DIN A4", ...DIN_FORMAT_DIMS_MM["DIN A4"] };

  const dimMatch = lower.match(/(\d+)-cm-x-(\d+)-cm/);
  if (dimMatch) {
    const widthMm = Number(dimMatch[1]);
    const heightMm = Number(dimMatch[2]);

    const allowedSquares = new Set([98, 105, 148, 210]);
    if (widthMm === heightMm && allowedSquares.has(widthMm)) {
      return {
        label: `${formatCm(dimMatch[1])} x ${formatCm(dimMatch[2])} cm`,
        widthMm,
        heightMm,
      };
    }
  }

  return null;
}

function parseQuantityPriceText(text) {
  const raw = normalizeLabel(text);
  if (!raw) return null;

  const qtyMatch = raw.match(/([\d.,]+)\s*St(?:ü|u)ck/i);
  if (!qtyMatch) return null;
  const quantity = Number(String(qtyMatch[1]).replace(/[^\d]/g, ""));

  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (!parenMatch) return null;
  const eurMatch = parenMatch[1].match(/([-+]?\d[\d.,]*)\s*(?:€|eur|euro)?/i);
  if (!eurMatch) return null;
  const eur = parseLocalizedNumber(eurMatch[1]);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(eur) || eur <= 0) {
    return null;
  }

  return { quantity, eur };
}

function transformedPrice(eur) {
  const dkkBase = eur * EUR_TO_DKK;
  const tierMultiplier = resolveTierMultiplier(dkkBase, TIERS);
  const dkkFinal = Math.round(roundToStep(dkkBase * tierMultiplier, 1));

  return {
    dkkBase: Number(dkkBase.toFixed(4)),
    tierMultiplier,
    dkkFinal,
  };
}

async function withRetry(fn, retries = 2) {
  let lastError;

  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /Execution context was destroyed|Target page, context or browser has been closed|ERR_NETWORK_CHANGED|ERR_TIMED_OUT|ERR_CONNECTION_RESET/i.test(
        message
      );
      if (!retryable || i === retries) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function collectDetailUrlsFromCategory(page, categoryUrl) {
  await withRetry(async () => {
    await page.goto(categoryUrl, { waitUntil: "networkidle", timeout: 90_000 });
  });

  const links = await page.$$eval("a[href]", (nodes) =>
    nodes.map((node) => ({
      href: node.href,
      text: (node.textContent || "").trim(),
    }))
  );

  return Array.from(
    new Set(
      links
        .map((item) => item.href)
        .filter((href) => href.includes(".html"))
        .filter((href) => !href.includes(",category,"))
        .filter((href) => href.includes("wir-machen-druck.de"))
    )
  );
}

async function collectCategoryUrlsForSource(page, source) {
  const urls = new Set(source.seedCategoryUrls || []);

  for (const seedUrl of source.seedCategoryUrls || []) {
    await withRetry(async () => {
      await page.goto(seedUrl, { waitUntil: "networkidle", timeout: 90_000 });
    });
    const categoryLinks = await page.$$eval("a[href]", (nodes) =>
      nodes.map((node) => node.href || "")
    );

    categoryLinks
      .filter((href) => href.includes(",category,"))
      .filter((href) => href.includes("wir-machen-druck.de"))
      .filter((href) => href.toLowerCase().includes(String(source.categoryKeyword || "").toLowerCase()))
      .forEach((href) => urls.add(href));
  }

  return Array.from(urls);
}

async function discoverDetailPages(page, maxDetailPages) {
  const discovered = [];
  const debug = process.env.FOLDERS_FETCH_DEBUG === "1";

  for (const source of SOURCE_GROUPS) {
    const categoryUrls = await collectCategoryUrlsForSource(page, source);

    if (debug) {
      console.log(`[discover] ${source.key} category URLs: ${categoryUrls.length}`);
    }

    for (const categoryUrl of categoryUrls) {
      const detailUrls = await collectDetailUrlsFromCategory(page, categoryUrl);
      if (debug) {
        console.log(`[discover] ${source.key} ${categoryUrl} -> ${detailUrls.length} candidates`);
      }

      detailUrls.forEach((detailUrl) => {
        if (!source.includeDetail(detailUrl)) return;

        const format = parseFormatFromUrl(detailUrl);
        if (!format) return;

        const selection = source.selectionInfo(detailUrl);
        if (!selection) return;

        discovered.push({
          sourceKey: source.key,
          foldLabel: source.foldLabel,
          categoryUrl,
          detailUrl,
          pagesLabel: selection.pagesLabel,
          orientationLabel: selection.orientationLabel,
          formatLabel: format.label,
          widthMm: format.widthMm,
          heightMm: format.heightMm,
        });
      });
    }
  }

  const dedupedByUrl = Array.from(
    new Map(discovered.map((item) => [item.detailUrl, item])).values()
  );
  const scoreUrl = (item) => {
    const url = String(item?.detailUrl || "");
    let score = 0;
    if (url.includes("vertikaler")) score += 20;
    if (url.includes("horizontaler")) score += 5;
    if (!url.includes("-quer-")) score += 10;
    // For 10-page roll-folded folders, use Sonderwickelfalz as the intended supplier source.
    if (item?.foldLabel === "Rullefalset" && item?.pagesLabel === "10 sider") {
      if (url.includes("sonderwickelfalz")) score += 100;
      else score -= 100;
    }
    return score;
  };

  const dedupedByCombo = Array.from(
    dedupedByUrl.reduce((map, item) => {
      const comboKey = `${item.foldLabel}||${item.formatLabel}||${item.pagesLabel}||${item.orientationLabel}`;
      const existing = map.get(comboKey);
      if (!existing) {
        map.set(comboKey, item);
        return map;
      }
      if (scoreUrl(item) > scoreUrl(existing)) {
        map.set(comboKey, item);
      }
      return map;
    }, new Map()).values()
  );

  dedupedByCombo.sort((a, b) => {
    if (a.foldLabel !== b.foldLabel) return a.foldLabel.localeCompare(b.foldLabel);
    if (a.pagesLabel !== b.pagesLabel) return a.pagesLabel.localeCompare(b.pagesLabel);
    if (a.orientationLabel !== b.orientationLabel) return a.orientationLabel.localeCompare(b.orientationLabel);
    if (a.formatLabel !== b.formatLabel) return a.formatLabel.localeCompare(b.formatLabel);
    return a.detailUrl.localeCompare(b.detailUrl);
  });

  if (debug) {
    console.log(`[discover] total before dedupe: ${discovered.length}`);
    console.log(`[discover] total after dedupe: ${dedupedByUrl.length}`);
    console.log(`[discover] total after combo dedupe: ${dedupedByCombo.length}`);
  }

  if (maxDetailPages && dedupedByCombo.length > maxDetailPages) {
    return dedupedByCombo.slice(0, maxDetailPages);
  }

  return dedupedByCombo;
}

async function extractRowsForDetailPage(page, detailMeta) {
  await page.goto(detailMeta.detailUrl, { waitUntil: "networkidle", timeout: 90_000 });

  const materials = await withRetry(async () => {
    return page.$$eval("#sorten option", (nodes) =>
      nodes.map((node) => ({
        value: node.getAttribute("value") || "",
        label: (node.textContent || "").trim(),
      }))
    );
  });

  const targetMaterials = materials
    .map((item) => ({ ...item, label: normalizeLabel(item.label) }))
    .filter((item) => item.value)
    .filter((item) => materialWanted(item.label));

  const rows = [];

  for (const material of targetMaterials) {
    let bestMaterialLabel = normalizeLabel(material.label);
    let bestParsedRows = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await withRetry(async () => {
        await page.selectOption("#sorten", material.value);
        await page.waitForTimeout(900 + attempt * 350);
      });

      const selectedMaterial = await withRetry(async () => {
        return page.$eval("#sorten", (node) => {
          const select = node;
          const selected = select.options[select.selectedIndex];
          return (selected ? selected.textContent : "") || "";
        });
      });

      const qtyOptionTexts = await withRetry(async () => {
        return page.$$eval("#wmd_shirt_auflage option, select[name*='auflage'] option", (nodes) =>
          Array.from(new Set(nodes.map((node) => (node.textContent || "").trim()).filter(Boolean)))
        );
      });

      const parsedRows = qtyOptionTexts
        .map((optionText) => {
          const parsed = parseQuantityPriceText(optionText);
          if (!parsed) return null;
          if (!TARGET_QUANTITIES.includes(parsed.quantity)) return null;
          return {
            quantity: parsed.quantity,
            eur: parsed.eur,
            sourceOptionText: optionText,
          };
        })
        .filter(Boolean);

      if (parsedRows.length > bestParsedRows.length) {
        bestParsedRows = parsedRows;
        bestMaterialLabel = normalizeLabel(selectedMaterial);
      }

      // We expect around 20 target quantities. Stop early when a near-complete set is loaded.
      if (parsedRows.length >= 18) {
        break;
      }

      await withRetry(async () => {
        await page.dispatchEvent("#sorten", "change");
        await page.waitForTimeout(300 + attempt * 200);
      });
    }

    bestParsedRows.forEach((parsed) => {
      rows.push({
        ...detailMeta,
        materialLabel: bestMaterialLabel,
        quantity: parsed.quantity,
        eur: parsed.eur,
        sourceOptionText: parsed.sourceOptionText,
      });
    });
  }

  return rows;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractRowsForDetailPageWithRetry(browser, detailMeta, maxAttempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const detailPage = await browser.newPage();
    try {
      const rows = await extractRowsForDetailPage(detailPage, detailMeta);
      if (rows.length === 0) {
        throw new Error("No rows extracted from detail page");
      }
      return rows;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(1_500 * attempt);
      }
    } finally {
      await detailPage.close().catch(() => {});
    }
  }

  throw lastError || new Error("Detail page extraction failed");
}

function serializeCsv(rows) {
  const header = [
    "fold_type",
    "pages",
    "orientation",
    "format",
    "material",
    "surface",
    "quantity",
    "eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "detail_url",
  ];

  const lines = [header.join(",")];
  rows.forEach((row) => {
    const fields = [
      row.foldLabel,
      row.pagesLabel,
      row.orientationLabel,
      row.formatLabel,
      row.materialLabel,
      row.surfaceLabel,
      row.quantity,
      row.eur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.detailUrl,
    ].map((field) => {
      const text = String(field ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    });

    lines.push(fields.join(","));
  });

  return `${lines.join("\n")}\n`;
}

function summarizeFolderRows(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const quantities = sourceRows.map((row) => Number(row.quantity)).filter(Number.isFinite);
  const prices = sourceRows.map((row) => Number(row.dkkFinal)).filter(Number.isFinite);
  const unique = (field) => new Set(sourceRows.map((row) => normalizeLabel(row?.[field])).filter(Boolean)).size;

  return {
    rows: sourceRows.length,
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

function buildSupplierBankAttributesFromFolderRows(rows) {
  const config = buildFoldersMatrixConfig(rows);
  return [
    {
      key: config.verticalAxis.key,
      labelDa: config.verticalAxis.title,
      labelOriginal: config.verticalAxis.title,
      values: config.verticalAxis.valueSpecs.map((value) => ({
        key: value.name,
        labelDa: value.name,
        labelOriginal: value.name,
        widthMm: value.widthMm ?? null,
        heightMm: value.heightMm ?? null,
        metadata: {},
      })),
    },
    ...config.sections.map((section) => ({
      key: section.key,
      labelDa: section.title,
      labelOriginal: section.title,
      values: section.valueSpecs.map((value) => ({
        key: value.name,
        labelDa: value.name,
        labelOriginal: value.name,
        widthMm: value.widthMm ?? null,
        heightMm: value.heightMm ?? null,
        metadata: {},
      })),
    })),
  ];
}

function writeSupplierBankFolderSnapshots({
  repoRoot,
  timestamp,
  rawPath,
  cleanPath,
  transformedRows,
  extractedRows = [],
  discovered = [],
  failedDetails = [],
  args,
  mergeStats = null,
  inferredCount = 0,
}) {
  const summary = summarizeFolderRows(transformedRows);
  const normalizedRows = createFolderNormalizedRows(transformedRows);
  const snapshotSlug = path.join("supplier-bank-normalized", "wir-machen-druck", args.productSlug);
  const normalizedPath = path.join(repoRoot, "pricing_raw", snapshotSlug, `${timestamp}.json`);
  ensureDir(path.dirname(normalizedPath));

  const payload = {
    schemaVersion: 1,
    supplierSlug: "wir-machen-druck",
    supplierProductKey: args.productSlug,
    sourceUrl: "https://www.wir-machen-druck.de",
    productFamily: "folders",
    nameOriginal: args.productName,
    nameDa: args.productName,
    descriptionOriginal: "WIRmachenDRUCK folder extraction staged for supplier bank.",
    descriptionDa: "WIRmachenDRUCK folder-ekstraktion klargjort til supplier bank.",
    sourceLanguage: "de",
    targetLanguage: "da",
    status: "draft",
    scrapeStatus: "fresh",
    normalizedAttributes: buildSupplierBankAttributesFromFolderRows(transformedRows),
    normalizedPricingSummary: summary,
    normalizedPriceRows: normalizedRows,
    rawSnapshotPath: rawPath,
    cleanCsvPath: cleanPath,
    sourceSnapshot: {
      discoveredDetailPages: discovered.length,
      failedDetailPages: failedDetails.length,
      extractedRows: extractedRows.length,
      transformedRows: transformedRows.length,
      mergeStats,
      inferredCount,
    },
    metadata: {
      source: "fetch-folders-import.js --bank-snapshot-only",
      supplier: "wir-machen-druck",
      importScript: "fetch-folders-import.js",
    },
  };

  fs.writeFileSync(normalizedPath, JSON.stringify(payload, null, 2), "utf8");
  return { normalizedPath, summary, payload };
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getSupabaseServiceRoleClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role env. Expected SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function writeSupplierBankFolderRows({ bankSnapshot, rawPath, cleanPath, rawPriceRows }) {
  const client = getSupabaseServiceRoleClient();
  const payload = bankSnapshot.payload;
  const now = new Date().toISOString();
  const priceRowsChecksum = hashJson(payload.normalizedPriceRows);

  const { data: supplierRow, error: supplierError } = await client
    .from("supplier_bank_suppliers")
    .upsert(
      {
        name: "WIRmachenDRUCK",
        slug: "wir-machen-druck",
        website_url: "https://www.wir-machen-druck.de",
        country_code: "DE",
        currency: "EUR",
        integration_type: "playwright",
        enabled: true,
        metadata: {
          source: "supplier-source-registry",
          registryStatus: "active",
          adapter: "scripts/fetch-folders-import.js",
          productFamilies: ["folders"],
          safeFirstSlice:
            "WMD folder pilot writes raw, clean, and normalized snapshots, then supplier-bank rows only after guarded remote apply.",
          lastWriter: "fetch-folders-import.js",
          note: "External supplier source. Salgsmapper/Sales Maba is internal and intentionally excluded.",
        },
      },
      { onConflict: "slug" }
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
        sourceUrl: payload.sourceUrl,
        supplierProductKey: payload.supplierProductKey,
        productFamily: payload.productFamily,
      },
      summary: {
        ...payload.sourceSnapshot,
        rawSnapshotPath: rawPath,
        cleanCsvPath: cleanPath,
        normalizedSnapshotPath: bankSnapshot.normalizedPath,
      },
      finished_at: now,
    })
    .select("id")
    .single();

  if (runError) throw runError;

  const { data: existingProductRow, error: existingProductError } = await client
    .from("supplier_bank_products")
    .select("status")
    .eq("supplier_id", supplierRow.id)
    .eq("supplier_product_key", payload.supplierProductKey)
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
        supplier_product_key: payload.supplierProductKey,
        source_url: payload.sourceUrl,
        source_hash: priceRowsChecksum,
        product_family: payload.productFamily,
        name_original: payload.nameOriginal,
        name_da: payload.nameDa,
        description_original: payload.descriptionOriginal,
        description_da: payload.descriptionDa,
        source_language: payload.sourceLanguage,
        target_language: payload.targetLanguage,
        status: preservedStatus,
        normalized_attributes: payload.normalizedAttributes,
        normalized_pricing_summary: payload.normalizedPricingSummary,
        raw_snapshot_path: rawPath,
        scrape_status: "fresh",
        last_scraped_at: now,
        last_price_checked_at: now,
        metadata: {
          ...payload.metadata,
          cleanCsvPath: cleanPath,
          normalizedSnapshotPath: bankSnapshot.normalizedPath,
        },
      },
      { onConflict: "supplier_id,supplier_product_key" }
    )
    .select("id")
    .single();

  if (productError) throw productError;

  const { data: priceSnapshotRow, error: priceSnapshotError } = await client
    .from("supplier_bank_price_snapshots")
    .insert({
      bank_product_id: productRow.id,
      supplier_id: supplierRow.id,
      scrape_run_id: runRow.id,
      currency: "EUR",
      conversion_rule_key: `wmd_folder_fx_${EUR_TO_DKK}_tiered`,
      raw_price_rows: rawPriceRows,
      normalized_price_rows: payload.normalizedPriceRows,
      price_min_dkk: payload.normalizedPricingSummary.priceMinDkk,
      price_max_dkk: payload.normalizedPricingSummary.priceMaxDkk,
      quantity_min: payload.normalizedPricingSummary.quantityMin,
      quantity_max: payload.normalizedPricingSummary.quantityMax,
      checksum: priceRowsChecksum,
      metadata: {
        rawSnapshotPath: rawPath,
        cleanCsvPath: cleanPath,
        normalizedSnapshotPath: bankSnapshot.normalizedPath,
      },
    })
    .select("id")
    .single();

  if (priceSnapshotError) throw priceSnapshotError;

  return {
    supplierId: supplierRow.id,
    scrapeRunId: runRow.id,
    bankProductId: productRow.id,
    priceSnapshotId: priceSnapshotRow.id,
  };
}

async function maybeWriteSupplierBankFolderRows({ args, bankSnapshot, rawPath, cleanPath, rawPriceRows }) {
  if (!args.writeBank) return null;

  const writeResult = await writeSupplierBankFolderRows({
    bankSnapshot,
    rawPath,
    cleanPath,
    rawPriceRows,
  });

  console.log("Supplier bank DB write complete");
  console.log(`Supplier ID: ${writeResult.supplierId}`);
  console.log(`Scrape run ID: ${writeResult.scrapeRunId}`);
  console.log(`Bank product ID: ${writeResult.bankProductId}`);
  console.log(`Price snapshot ID: ${writeResult.priceSnapshotId}`);
  return writeResult;
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function parseFormatDims(formatLabel) {
  const dinDims = DIN_FORMAT_DIMS_MM[String(formatLabel || "").trim()];
  if (dinDims) return dinDims;

  const match = String(formatLabel || "").match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*cm$/i);
  if (!match) return { widthMm: null, heightMm: null };
  const widthMm = Number(match[1]) * 10;
  const heightMm = Number(match[2]) * 10;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
    return { widthMm: null, heightMm: null };
  }
  return { widthMm, heightMm };
}

function normalizePagesLabel(raw) {
  const text = normalizeLabel(raw).toLowerCase();
  if (!text) return "Ukendt";

  const fromDigits = text.match(/(\d+)\s*sider?/);
  if (fromDigits) {
    return pagesLabelFromSides(Number(fromDigits[1]));
  }

  if (text.includes("3 fløjet") || text.includes("3 fluejet")) {
    return "6 sider";
  }

  return "Ukendt";
}

function normalizeOrientationLabel(raw) {
  const text = normalizeLabel(raw).toLowerCase();
  if (text.includes("vandret") || text.includes("horizontal")) return "Vandret";
  return "Lodret";
}

function loadTransformedRowsFromCleanCsv(filePath) {
  const resolved = path.resolve(filePath);
  const text = fs.readFileSync(resolved, "utf8");
  const lines = text.trim().split(/\r\n|\n|\r/);
  if (lines.length < 2) {
    throw new Error(`Clean CSV has no data rows: ${resolved}`);
  }

  const headerCols = parseCsvLine(lines[0]).map((value) => normalizeLabel(value).toLowerCase());
  const colIndex = Object.fromEntries(headerCols.map((name, idx) => [name, idx]));
  const idx = (name) => colIndex[name];

  const requiredCols = ["fold_type", "format", "material", "quantity", "eur", "dkk_base", "tier_multiplier", "dkk_final"];
  const missingRequired = requiredCols.filter((name) => idx(name) === undefined);
  if (missingRequired.length > 0) {
    throw new Error(`Clean CSV is missing required columns: ${missingRequired.join(", ")}`);
  }

  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const foldLabel = cols[idx("fold_type")] || "";
    const formatLabel = cols[idx("format")] || "";
    const rawMaterialLabel = cols[idx("material")] || "";
    const rawSurfaceLabel = idx("surface") !== undefined ? cols[idx("surface")] : "";
    const pagesRaw = idx("pages") !== undefined ? cols[idx("pages")] : cols[idx("side")] || "";
    const orientationRaw = idx("orientation") !== undefined ? cols[idx("orientation")] : cols[idx("side")] || "";
    const pagesLabel = normalizePagesLabel(pagesRaw);
    const orientationLabel = normalizeOrientationLabel(orientationRaw);
    const mapped = mapImportedMaterial(rawMaterialLabel);
    const hasSurfaceColumn = idx("surface") !== undefined;

    if (!hasSurfaceColumn && !mapped) {
      return null;
    }

    const materialLabel = mapped?.materialLabel || rawMaterialLabel;
    const surfaceLabel = normalizeLabel(rawSurfaceLabel) || mapped?.surfaceLabel || "Matsilk";
    const dims = parseFormatDims(formatLabel);
    return {
      foldLabel,
      pagesLabel,
      orientationLabel,
      formatLabel,
      materialLabel,
      surfaceLabel,
      quantity: Number(cols[idx("quantity")]),
      eur: Number(cols[idx("eur")]),
      dkkBase: Number(cols[idx("dkk_base")]),
      tierMultiplier: Number(cols[idx("tier_multiplier")]),
      dkkFinal: Number(cols[idx("dkk_final")]),
      detailUrl: cols[idx("detail_url")] || "",
      widthMm: dims.widthMm,
      heightMm: dims.heightMm,
      sourceOrigin: "csv",
      sourceKey: [
        foldLabel,
        pagesLabel,
        orientationLabel,
        formatLabel,
        materialLabel,
        surfaceLabel,
      ].join("||"),
    };
  });

  return rows.filter(
    (row) =>
      row
      && Number.isFinite(row.quantity)
      && Number.isFinite(row.dkkFinal)
      && !!row.materialLabel
      && !!row.surfaceLabel
  );
}

function fillMissingTargetQuantities(rows) {
  const grouped = new Map();
  const sortedTargets = [...TARGET_QUANTITIES].sort((a, b) => a - b);

  rows.forEach((row) => {
    const key = [
      row.foldLabel,
      row.pagesLabel,
      row.orientationLabel,
      row.formatLabel,
      row.materialLabel,
      row.surfaceLabel,
    ].join("||");

    if (!grouped.has(key)) grouped.set(key, new Map());
    grouped.get(key).set(row.quantity, row);
  });

  const output = [...rows];
  let inferredCount = 0;

  const getNearestTemplate = (qtyToFill, qtyMap) => {
    const quantities = Array.from(qtyMap.keys()).sort((a, b) => a - b);
    let nearestQty = quantities[0];
    let nearestDistance = Math.abs(nearestQty - qtyToFill);
    quantities.forEach((q) => {
      const distance = Math.abs(q - qtyToFill);
      if (distance < nearestDistance) {
        nearestQty = q;
        nearestDistance = distance;
      }
    });
    return qtyMap.get(nearestQty);
  };

  const interpolate = (qtyToFill, qtyMap) => {
    const quantities = Array.from(qtyMap.keys()).sort((a, b) => a - b);
    if (quantities.length === 0) return null;
    if (quantities.length === 1) return Number(qtyMap.get(quantities[0]).dkkFinal);

    let lower = null;
    let upper = null;

    quantities.forEach((q) => {
      if (q <= qtyToFill) lower = q;
      if (upper == null && q >= qtyToFill) upper = q;
    });

    if (lower != null && upper != null && lower !== upper) {
      const lowerPrice = Number(qtyMap.get(lower).dkkFinal);
      const upperPrice = Number(qtyMap.get(upper).dkkFinal);
      const ratio = (qtyToFill - lower) / (upper - lower);
      return lowerPrice + (upperPrice - lowerPrice) * ratio;
    }

    if (lower != null && (upper == null || lower === upper)) {
      const lastIdx = quantities.length - 1;
      const q1 = quantities[lastIdx];
      const q0 = quantities[lastIdx - 1];
      const p1 = Number(qtyMap.get(q1).dkkFinal);
      const p0 = Number(qtyMap.get(q0).dkkFinal);
      const slope = (p1 - p0) / (q1 - q0 || 1);
      return p1 + slope * (qtyToFill - q1);
    }

    if (upper != null && lower == null) {
      const q0 = quantities[0];
      const q1 = quantities[1];
      const p0 = Number(qtyMap.get(q0).dkkFinal);
      const p1 = Number(qtyMap.get(q1).dkkFinal);
      const slope = (p1 - p0) / (q1 - q0 || 1);
      return p0 - slope * (q0 - qtyToFill);
    }

    return null;
  };

  grouped.forEach((qtyMap) => {
    sortedTargets.forEach((qty) => {
      if (qtyMap.has(qty)) return;

      const interpolated = interpolate(qty, qtyMap);
      if (!Number.isFinite(interpolated)) return;

      const template = getNearestTemplate(qty, qtyMap);
      if (!template) return;

      const dkkFinal = Math.max(1, Math.round(interpolated));

      const inferredRow = {
        ...template,
        quantity: qty,
        eur: Number((dkkFinal / EUR_TO_DKK).toFixed(4)),
        dkkBase: Number(dkkFinal.toFixed(4)),
        tierMultiplier: 1,
        dkkFinal,
        sourceOptionText: "[inferred-missing-quantity]",
      };

      output.push(inferredRow);
      qtyMap.set(qty, inferredRow);
      inferredCount += 1;
    });
  });

  return { rows: output, inferredCount };
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env. Expected VITE_SUPABASE_URL and a Supabase key.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function findProduct(client, tenantId, productSlug) {
  const { data, error } = await client
    .from("products")
    .select("id, slug, name, is_published")
    .eq("tenant_id", tenantId)
    .eq("slug", productSlug)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureProduct(client, tenantId, productName, productSlug) {
  const existing = await findProduct(client, tenantId, productSlug);

  if (existing) {
    return { product: existing, created: false };
  }

  const { data: created, error: createError } = await client
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: productName,
      slug: productSlug,
      icon_text: productName,
      description: "Auto-imported folder product",
      category: "tryksager",
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: {
        width_mm: 210,
        height_mm: 297,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: "A4",
      },
    })
    .select("id, slug, name, is_published")
    .single();

  if (createError) throw createError;

  return { product: created, created: true };
}

async function loadGroups(client, tenantId, productId) {
  const { data, error } = await client
    .from("product_attribute_groups")
    .select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function loadAllGenericProductPrices(client, productId, pageSize = 1000) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("generic_product_prices")
      .select("variant_name, variant_value, quantity, price_dkk, extra_data")
      .eq("product_id", productId)
      .range(from, to);

    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function loadExistingTransformedRows(client, tenantId, productId) {
  const [groups, priceRows, productResult] = await Promise.all([
    loadGroups(client, tenantId, productId),
    loadAllGenericProductPrices(client, productId),
    client.from("products").select("pricing_structure").eq("id", productId).single(),
  ]);

  if (productResult.error) throw productResult.error;

  const pricingStructure = productResult.data?.pricing_structure || {};
  const sectionGroupIds = {
    material: pricingStructure?.vertical_axis?.groupId || null,
    format: null,
    surface: null,
    fold: null,
    pages: null,
    orientation: null,
  };

  for (const row of pricingStructure?.layout_rows || []) {
    for (const column of row?.columns || []) {
      if (column?.id === "format-section") sectionGroupIds.format = column.groupId || null;
      if (column?.id === "surface-section") sectionGroupIds.surface = column.groupId || null;
      if (column?.id === "fold-section") sectionGroupIds.fold = column.groupId || null;
      if (column?.id === "pages-section") sectionGroupIds.pages = column.groupId || null;
      if (column?.id === "orientation-section") sectionGroupIds.orientation = column.groupId || null;
    }
  }

  const valueById = new Map();
  groups.forEach((group) => {
    (group.values || []).forEach((value) => {
      valueById.set(value.id, {
        ...value,
        groupId: group.id,
        groupName: group.name,
        groupKind: group.kind,
      });
    });
  });

  const unresolved = [];
  const rows = [];

  for (const priceRow of priceRows) {
    const extraData =
      priceRow?.extra_data && typeof priceRow.extra_data === "object" ? priceRow.extra_data : {};

    const variantIds = Array.from(
      new Set(
        [
          ...(String(priceRow.variant_name || "").split("|").filter(Boolean)),
          ...(Array.isArray(extraData.variantValueIds) ? extraData.variantValueIds : []),
          ...(Array.isArray(extraData.selectionMap?.variantValueIds)
            ? extraData.selectionMap.variantValueIds
            : []),
          extraData.formatId,
          extraData.materialId,
          extraData.verticalAxisValueId,
          priceRow.variant_value,
        ].filter(Boolean)
      )
    );

    const resolveSectionValue = (explicitId, sectionKey) => {
      if (explicitId && valueById.has(explicitId)) {
        return valueById.get(explicitId);
      }

      const targetGroupId = sectionGroupIds[sectionKey];
      if (!targetGroupId) return null;

      const matches = variantIds
        .map((id) => valueById.get(id))
        .filter((value) => value?.groupId === targetGroupId);

      if (matches.length === 1) {
        return matches[0];
      }

      return null;
    };

    const formatValue = resolveSectionValue(extraData.formatId, "format");
    const materialValue = resolveSectionValue(
      extraData.materialId || extraData.verticalAxisValueId || priceRow.variant_value,
      "material"
    );
    const surfaceValue = resolveSectionValue(extraData.surfaceId, "surface");
    const foldValue = resolveSectionValue(extraData.foldId, "fold");
    const pagesValue = resolveSectionValue(extraData.pagesId, "pages");
    const orientationValue = resolveSectionValue(extraData.orientationId, "orientation");

    if (!formatValue || !materialValue || !surfaceValue || !foldValue || !pagesValue || !orientationValue) {
      unresolved.push({
        quantity: priceRow.quantity,
        variantValueId: extraData.verticalAxisValueId || extraData.materialId || null,
        formatId: extraData.formatId || null,
        surfaceId: extraData.surfaceId || null,
        foldId: extraData.foldId || null,
        pagesId: extraData.pagesId || null,
        orientationId: extraData.orientationId || null,
      });
      continue;
    }

    rows.push({
      foldLabel: foldValue.name,
      pagesLabel: pagesValue.name,
      orientationLabel: orientationValue.name,
      formatLabel: formatValue.name,
      materialLabel: materialValue.name,
      surfaceLabel: surfaceValue.name,
      quantity: Number(priceRow.quantity),
      eur: finiteNumberOrNull(extraData.eur),
      dkkBase:
        finiteNumberOrNull(extraData.dkkBase)
        ?? finiteNumberOrNull(extraData.supplierPriceDkk)
        ?? Number(priceRow.price_dkk),
      tierMultiplier: finiteNumberOrNull(extraData.tierMultiplier) ?? 1,
      dkkFinal: Number(priceRow.price_dkk),
      detailUrl: normalizeLabel(extraData.sourceUrl || ""),
      widthMm: finiteNumberOrNull(formatValue.width_mm),
      heightMm: finiteNumberOrNull(formatValue.height_mm),
      sourceOptionText: normalizeLabel(extraData.sourceOptionText || "[existing-live-row]"),
      rawExtraData: extraData,
      sourceOrigin: "database",
      sourceKey: [
        foldValue.name,
        pagesValue.name,
        orientationValue.name,
        formatValue.name,
        materialValue.name,
        surfaceValue.name,
      ].join("||"),
    });
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Could not resolve ${unresolved.length} existing price rows for merge. Aborting to avoid dropping live combinations. Example: ${JSON.stringify(
        unresolved[0]
      )}`
    );
  }

  return rows;
}

async function ensureGroup(client, context, { name, kind, sortOrder }) {
  const normalizedName = normalizeLabel(name).toLowerCase();
  const found = context.groups.find(
    (group) => group.kind === kind && normalizeLabel(group.name).toLowerCase() === normalizedName
  );

  if (found) return found;

  const { data, error } = await client
    .from("product_attribute_groups")
    .insert({
      tenant_id: context.tenantId,
      product_id: context.productId,
      name,
      kind,
      source: "product",
      ui_mode: "buttons",
      sort_order: sortOrder,
      enabled: true,
    })
    .select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)")
    .single();

  if (error) throw error;

  const normalized = { ...data, values: data.values || [] };
  context.groups.push(normalized);
  return normalized;
}

async function ensureValue(client, context, group, valueName, extras = {}) {
  const normalizedName = normalizeLabel(valueName);

  let existing = (group.values || []).find(
    (value) => String(value.name || "").toLowerCase() === normalizedName.toLowerCase()
  );

  if (existing) {
    const updatePayload = {};

    if (extras.widthMm && Number(existing.width_mm || 0) !== Number(extras.widthMm)) {
      updatePayload.width_mm = Number(extras.widthMm);
    }

    if (extras.heightMm && Number(existing.height_mm || 0) !== Number(extras.heightMm)) {
      updatePayload.height_mm = Number(extras.heightMm);
    }

    if (Object.keys(updatePayload).length > 0) {
      const { data: updated, error: updateError } = await client
        .from("product_attribute_values")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id, name, width_mm, height_mm, meta")
        .single();

      if (updateError) throw updateError;

      group.values = group.values.map((value) => (value.id === updated.id ? updated : value));
      existing = updated;
    }

    return existing;
  }

  const { data: inserted, error: insertError } = await client
    .from("product_attribute_values")
    .insert({
      tenant_id: context.tenantId,
      product_id: context.productId,
      group_id: group.id,
      name: normalizedName,
      sort_order: (group.values || []).length,
      enabled: true,
      width_mm: extras.widthMm || null,
      height_mm: extras.heightMm || null,
    })
    .select("id, name, width_mm, height_mm, meta")
    .single();

  if (insertError) throw insertError;

  group.values = [...(group.values || []), inserted];
  return inserted;
}

function buildPricingStructure({
  materialGroup,
  materialValues,
  formatGroup,
  formatValues,
  surfaceGroup,
  surfaceValues,
  foldGroup,
  foldValues,
  pagesGroup,
  pagesValues,
  orientationGroup,
  orientationValues,
}) {
  return {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {
      sectionId: "vertical-axis",
      sectionType: "materials",
      groupId: materialGroup.id,
      valueIds: materialValues.map((value) => value.id),
      ui_mode: "buttons",
      valueSettings: {},
      title: "Materiale",
      description: "",
    },
    layout_rows: [
      {
        id: "row-format",
        title: "",
        description: "",
        columns: [
          {
            id: "format-section",
            sectionType: "formats",
            groupId: formatGroup.id,
            valueIds: formatValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Format",
            description: "",
          },
        ],
      },
      {
        id: "row-surface",
        title: "",
        description: "",
        columns: [
          {
            id: "surface-section",
            sectionType: "other",
            groupId: surfaceGroup.id,
            valueIds: surfaceValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Papirfinish",
            description: "",
          },
        ],
      },
      {
        id: "row-fold",
        title: "",
        description: "",
        columns: [
          {
            id: "fold-section",
            sectionType: "finishes",
            groupId: foldGroup.id,
            valueIds: foldValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Foldetype",
            description: "",
          },
        ],
      },
      {
        id: "row-pages",
        title: "",
        description: "",
        columns: [
          {
            id: "pages-section",
            sectionType: "products",
            groupId: pagesGroup.id,
            valueIds: pagesValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Sider",
            description: "",
          },
        ],
      },
      {
        id: "row-orientation",
        title: "",
        description: "",
        columns: [
          {
            id: "orientation-section",
            sectionType: "other",
            groupId: orientationGroup.id,
            valueIds: orientationValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Retning",
            description: "",
          },
        ],
      },
    ],
    quantities: TARGET_QUANTITIES,
  };
}

async function importToSupabase({ tenantId, productName, productSlug, transformedRows, dryRun }) {
  if (transformedRows.length === 0) {
    throw new Error("No transformed rows to import");
  }

  const sortedRows = sortFolderTransformedRows(transformedRows);
  const normalizedRows = createFolderNormalizedRows(sortedRows);
  const matrixConfig = buildFoldersMatrixConfig(sortedRows);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: normalizedRows.length,
      uniqueFormats: new Set(sortedRows.map((row) => row.formatLabel)).size,
      uniqueMaterials: new Set(sortedRows.map((row) => row.materialLabel)).size,
      uniqueSurfaceValues: new Set(sortedRows.map((row) => row.surfaceLabel)).size,
      uniqueFoldTypes: new Set(sortedRows.map((row) => row.foldLabel)).size,
      uniquePages: new Set(sortedRows.map((row) => row.pagesLabel)).size,
      uniqueOrientations: new Set(sortedRows.map((row) => row.orientationLabel)).size,
    };
  }

  const client = getSupabaseClient();
  const ensured = await ensureProduct(client, tenantId, productName, productSlug);
  const result = await publishNormalizedMatrixProduct({
    client,
    tenantId,
    productId: ensured.product.id,
    matrixConfig,
    normalizedRows,
    deleteByTenant: true,
    productUpdate: {
      name: productName,
      slug: productSlug,
    },
  });

  return {
    dryRun: false,
    productId: ensured.product.id,
    productSlug,
    productCreated: ensured.created,
    rowsInserted: result.rowsInserted,
    uniqueFormats: new Set(sortedRows.map((row) => row.formatLabel)).size,
    uniqueMaterials: new Set(sortedRows.map((row) => row.materialLabel)).size,
    uniqueSurfaceValues: new Set(sortedRows.map((row) => row.surfaceLabel)).size,
    uniqueFoldTypes: new Set(sortedRows.map((row) => row.foldLabel)).size,
    uniquePages: new Set(sortedRows.map((row) => row.pagesLabel)).size,
    uniqueOrientations: new Set(sortedRows.map((row) => row.orientationLabel)).size,
  };
}

async function mergeExistingRowsIfRequested(args, sourceRows) {
  const sortedSourceRows = sortFolderTransformedRows(sourceRows);
  if (!args.mergeExisting) {
    return { rows: sortedSourceRows, mergeStats: null };
  }

  const client = getSupabaseClient();
  const existingProduct = await findProduct(client, args.tenantId, args.productSlug);

  if (!existingProduct) {
    return {
      rows: sortedSourceRows,
      mergeStats: {
        existingRows: 0,
        sourceRows: sortedSourceRows.length,
        mergedRows: sortedSourceRows.length,
        addedFromSource: sortedSourceRows.length,
        preservedExistingRows: 0,
        skippedExistingKeys: 0,
      },
    };
  }

  const existingRows = await loadExistingTransformedRows(client, args.tenantId, existingProduct.id);
  const merged = mergeFolderTransformedRows({
    existingRows,
    sourceRows: sortedSourceRows,
    preferSource: args.preferSource,
  });

  return {
    rows: merged.rows,
    mergeStats: merged.stats,
  };
}

async function runImport(args) {
  const repoRoot = process.cwd();
  ensureDir(path.join(repoRoot, "pricing_raw"));
  ensureDir(path.join(repoRoot, "pricing_clean"));

  if (args.fromExistingProduct) {
    const client = getSupabaseClient();
    const existingProduct = await findProduct(client, args.tenantId, args.productSlug);
    if (!existingProduct) {
      throw new Error(
        `Could not find existing product '${args.productSlug}' for tenant ${args.tenantId}`
      );
    }

    const existingRows = await loadExistingTransformedRows(client, args.tenantId, existingProduct.id);
    const filled = fillMissingTargetQuantities(existingRows);
    const transformedRows = sortFolderTransformedRows(filled.rows);

    console.log(`Loaded existing product rows: ${existingRows.length}`);
    console.log(`Inferred rows added: ${filled.inferredCount}`);
    console.log(`Prepared rows: ${transformedRows.length}`);

    if (args.bankSnapshotOnly) {
      const timestamp = timestampForFile();
      const rawPath = path.join(repoRoot, "pricing_raw", "supplier-bank", "wir-machen-druck", args.productSlug, `${timestamp}.json`);
      const cleanPath = path.join(repoRoot, "pricing_clean", "supplier-bank", "wir-machen-druck", args.productSlug, `${timestamp}.csv`);
      ensureDir(path.dirname(rawPath));
      ensureDir(path.dirname(cleanPath));
      fs.writeFileSync(
        rawPath,
        JSON.stringify(
          {
            timestamp,
            product: { name: args.productName, slug: args.productSlug, tenant_id: args.tenantId },
            source: "existing-product",
            transformed_rows: transformedRows,
            inferred_rows_added: filled.inferredCount,
          },
          null,
          2
        ),
        "utf8"
      );
      fs.writeFileSync(cleanPath, serializeCsv(transformedRows), "utf8");
      const bankSnapshot = writeSupplierBankFolderSnapshots({
        repoRoot,
        timestamp,
        rawPath,
        cleanPath,
        transformedRows,
        args,
        inferredCount: filled.inferredCount,
      });
      console.log("Supplier bank snapshot complete (no live product/pricing DB writes)");
      console.log(`Bank normalized snapshot: ${bankSnapshot.normalizedPath}`);
      console.log(`Bank rows: ${bankSnapshot.summary.rows}`);
      await maybeWriteSupplierBankFolderRows({
        args,
        bankSnapshot,
        rawPath,
        cleanPath,
        rawPriceRows: transformedRows,
      });
      return;
    }

    const result = await importToSupabase({
      tenantId: args.tenantId,
      productName: args.productName,
      productSlug: args.productSlug,
      transformedRows,
      dryRun: args.dryRun,
    });

    if (result.dryRun) {
      console.log("Dry-run complete (no DB writes)");
      console.log(`Product slug: ${result.productSlug}`);
      console.log(`Rows prepared: ${result.rowsPrepared}`);
      console.log(`Formats: ${result.uniqueFormats}`);
      console.log(`Materials: ${result.uniqueMaterials}`);
      console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
      console.log(`Fold types: ${result.uniqueFoldTypes}`);
      console.log(`Sider values: ${result.uniquePages}`);
      console.log(`Retning values: ${result.uniqueOrientations}`);
      return;
    }

    console.log("Import complete");
    console.log(`Product ID: ${result.productId}`);
    console.log(`Product slug: ${result.productSlug}`);
    console.log(`Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
    console.log(`Rows inserted: ${result.rowsInserted}`);
    console.log(`Formats: ${result.uniqueFormats}`);
    console.log(`Materials: ${result.uniqueMaterials}`);
    console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
    console.log(`Fold types: ${result.uniqueFoldTypes}`);
    console.log(`Sider values: ${result.uniquePages}`);
    console.log(`Retning values: ${result.uniqueOrientations}`);
    return;
  }

  if (args.fromCleanCsv) {
    const loadedRows = loadTransformedRowsFromCleanCsv(args.fromCleanCsv);
    if (loadedRows.length === 0) {
      throw new Error(`No rows loaded from clean CSV: ${args.fromCleanCsv}`);
    }

    const merged = await mergeExistingRowsIfRequested(args, loadedRows);
    const filled = fillMissingTargetQuantities(merged.rows);
    const transformedRows = filled.rows;

    console.log(`Loaded rows from clean CSV: ${args.fromCleanCsv}`);
    console.log(`Loaded rows: ${loadedRows.length}`);
    if (merged.mergeStats) {
      console.log(`Merged existing rows: ${merged.mergeStats.existingRows}`);
      console.log(`Added source rows not already live: ${merged.mergeStats.addedFromSource}`);
      console.log(`Replaced existing rows from source: ${merged.mergeStats.replacedExistingRows}`);
      console.log(`Kept existing rows in place: ${merged.mergeStats.skippedExistingKeys}`);
      console.log(`Merged base rows: ${merged.mergeStats.mergedRows}`);
    }
    console.log(`Inferred rows added: ${filled.inferredCount}`);
    console.log(`Prepared rows: ${transformedRows.length}`);

    if (args.bankSnapshotOnly) {
      const timestamp = timestampForFile();
      const rawPath = path.join(repoRoot, "pricing_raw", "supplier-bank", "wir-machen-druck", args.productSlug, `${timestamp}.json`);
      const cleanPath = path.join(repoRoot, "pricing_clean", "supplier-bank", "wir-machen-druck", args.productSlug, `${timestamp}.csv`);
      ensureDir(path.dirname(rawPath));
      ensureDir(path.dirname(cleanPath));
      fs.writeFileSync(
        rawPath,
        JSON.stringify(
          {
            timestamp,
            product: { name: args.productName, slug: args.productSlug, tenant_id: args.tenantId },
            source: "clean-csv",
            source_csv: args.fromCleanCsv,
            transformed_rows: transformedRows,
            merge_stats: merged.mergeStats || null,
            inferred_rows_added: filled.inferredCount,
          },
          null,
          2
        ),
        "utf8"
      );
      fs.writeFileSync(cleanPath, serializeCsv(transformedRows), "utf8");
      const bankSnapshot = writeSupplierBankFolderSnapshots({
        repoRoot,
        timestamp,
        rawPath,
        cleanPath,
        transformedRows,
        args,
        mergeStats: merged.mergeStats || null,
        inferredCount: filled.inferredCount,
      });
      console.log("Supplier bank snapshot complete (no live product/pricing DB writes)");
      console.log(`Bank normalized snapshot: ${bankSnapshot.normalizedPath}`);
      console.log(`Bank rows: ${bankSnapshot.summary.rows}`);
      await maybeWriteSupplierBankFolderRows({
        args,
        bankSnapshot,
        rawPath,
        cleanPath,
        rawPriceRows: transformedRows,
      });
      return;
    }

    const result = await importToSupabase({
      tenantId: args.tenantId,
      productName: args.productName,
      productSlug: args.productSlug,
      transformedRows,
      dryRun: args.dryRun,
    });

    if (result.dryRun) {
      console.log("Dry-run complete (no DB writes)");
      console.log(`Product slug: ${result.productSlug}`);
      console.log(`Rows prepared: ${result.rowsPrepared}`);
      console.log(`Formats: ${result.uniqueFormats}`);
      console.log(`Materials: ${result.uniqueMaterials}`);
      console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
      console.log(`Fold types: ${result.uniqueFoldTypes}`);
      console.log(`Sider values: ${result.uniquePages}`);
      console.log(`Retning values: ${result.uniqueOrientations}`);
      return;
    }

    console.log("Import complete");
    console.log(`Product ID: ${result.productId}`);
    console.log(`Product slug: ${result.productSlug}`);
    console.log(`Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
    console.log(`Rows inserted: ${result.rowsInserted}`);
    console.log(`Formats: ${result.uniqueFormats}`);
    console.log(`Materials: ${result.uniqueMaterials}`);
    console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
    console.log(`Fold types: ${result.uniqueFoldTypes}`);
    console.log(`Sider values: ${result.uniquePages}`);
    console.log(`Retning values: ${result.uniqueOrientations}`);
    return;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto("https://www.wir-machen-druck.de", { waitUntil: "domcontentloaded", timeout: 90_000 });

    const discovered = await discoverDetailPages(page, args.maxDetailPages);

    if (discovered.length === 0) {
      throw new Error("No detail pages discovered");
    }

    await page.close().catch(() => {});

    const extractedRows = [];
    const failedDetails = [];

    for (const detail of discovered) {
      try {
        const rows = await extractRowsForDetailPageWithRetry(browser, detail);
        extractedRows.push(...rows);
        console.log(
          `Fetched ${rows.length.toString().padStart(4, " ")} rows | ${detail.foldLabel} | ${detail.pagesLabel} | ${detail.orientationLabel} | ${detail.formatLabel}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedDetails.push({ ...detail, error: message });
        console.warn(
          `Skipped detail page | ${detail.foldLabel} | ${detail.pagesLabel} | ${detail.orientationLabel} | ${detail.formatLabel} | ${message}`
        );
      }
    }

    if (args.bankSnapshotOnly && failedDetails.length > 0 && (args.writeBank || !args.allowPartialBankSnapshot)) {
      const failures = failedDetails
        .slice(0, 8)
        .map((detail) => `${detail.foldLabel} / ${detail.pagesLabel} / ${detail.orientationLabel} / ${detail.formatLabel}: ${detail.error}`)
        .join("\n  - ");
      throw new Error(
        `Refusing to create supplier-bank snapshot because ${failedDetails.length} detail page(s) failed. ` +
        `Rerun the refresh${args.writeBank ? "" : " or pass --allow-partial-bank-snapshot for an intentional partial local snapshot"}.\n  - ${failures}`
      );
    }

    const transformedMap = new Map();

    extractedRows.forEach((row) => {
      const mappedMaterial = mapImportedMaterial(row.materialLabel);
      if (!mappedMaterial) return;

      const pricing = transformedPrice(row.eur);
      const key = [
        row.foldLabel,
        row.pagesLabel,
        row.orientationLabel,
        row.formatLabel,
        mappedMaterial.materialLabel,
        mappedMaterial.surfaceLabel,
        row.quantity,
      ].join("||");
      transformedMap.set(key, {
        ...row,
        materialLabel: mappedMaterial.materialLabel,
        surfaceLabel: mappedMaterial.surfaceLabel,
        dkkBase: pricing.dkkBase,
        tierMultiplier: pricing.tierMultiplier,
        dkkFinal: pricing.dkkFinal,
        sourceOrigin: "playwright",
        sourceKey: [
          row.foldLabel,
          row.pagesLabel,
          row.orientationLabel,
          row.formatLabel,
          mappedMaterial.materialLabel,
          mappedMaterial.surfaceLabel,
        ].join("||"),
      });
    });

    const transformedRowsBase = sortFolderTransformedRows(Array.from(transformedMap.values()));
    const merged = await mergeExistingRowsIfRequested(args, transformedRowsBase);
    const filled = fillMissingTargetQuantities(merged.rows);
    const transformedRows = sortFolderTransformedRows(filled.rows);

    const timestamp = timestampForFile();
    const rawPath = path.join(repoRoot, "pricing_raw", args.productSlug, `${timestamp}.json`);
    const cleanPath = path.join(repoRoot, "pricing_clean", args.productSlug, `${timestamp}.csv`);

    ensureDir(path.dirname(rawPath));
    ensureDir(path.dirname(cleanPath));

    fs.writeFileSync(
      rawPath,
      JSON.stringify(
        {
          timestamp,
          product: { name: args.productName, slug: args.productSlug, tenant_id: args.tenantId },
          source_groups: SOURCE_GROUPS.map((group) => ({
            key: group.key,
            fold_label: group.foldLabel,
            category_keyword: group.categoryKeyword,
            seed_category_urls: group.seedCategoryUrls,
          })),
          target_quantities: TARGET_QUANTITIES,
          material_patterns: MATERIAL_PATTERNS.map((p) => p.source),
          discovered_detail_pages: discovered,
          failed_detail_pages: failedDetails,
          extracted_rows: extractedRows,
        },
        null,
        2
      ),
      "utf8"
    );

    fs.writeFileSync(cleanPath, serializeCsv(transformedRows), "utf8");

    console.log(`Raw snapshot: ${rawPath}`);
    console.log(`Clean CSV: ${cleanPath}`);
    console.log(`Discovered pages: ${discovered.length}`);
    console.log(`Failed detail pages: ${failedDetails.length}`);
    console.log(`Extracted rows: ${extractedRows.length}`);
    if (merged.mergeStats) {
      console.log(`Merged existing rows: ${merged.mergeStats.existingRows}`);
      console.log(`Added source rows not already live: ${merged.mergeStats.addedFromSource}`);
      console.log(`Replaced existing rows from source: ${merged.mergeStats.replacedExistingRows}`);
      console.log(`Kept existing rows in place: ${merged.mergeStats.skippedExistingKeys}`);
      console.log(`Merged base rows: ${merged.mergeStats.mergedRows}`);
    }
    console.log(`Inferred rows added: ${filled.inferredCount}`);
    console.log(`Prepared rows: ${transformedRows.length}`);

    if (args.bankSnapshotOnly) {
      const bankSnapshot = writeSupplierBankFolderSnapshots({
        repoRoot,
        timestamp,
        rawPath,
        cleanPath,
        transformedRows,
        extractedRows,
        discovered,
        failedDetails,
        args,
        mergeStats: merged.mergeStats || null,
        inferredCount: filled.inferredCount,
      });
      console.log("Supplier bank snapshot complete (no live product/pricing DB writes)");
      console.log(`Bank normalized snapshot: ${bankSnapshot.normalizedPath}`);
      console.log(`Bank rows: ${bankSnapshot.summary.rows}`);
      await maybeWriteSupplierBankFolderRows({
        args,
        bankSnapshot,
        rawPath,
        cleanPath,
        rawPriceRows: extractedRows,
      });
      return;
    }

    const result = await importToSupabase({
      tenantId: args.tenantId,
      productName: args.productName,
      productSlug: args.productSlug,
      transformedRows,
      dryRun: args.dryRun,
    });

    if (result.dryRun) {
      console.log("Dry-run complete (no DB writes)");
      console.log(`Product slug: ${result.productSlug}`);
      console.log(`Rows prepared: ${result.rowsPrepared}`);
      console.log(`Formats: ${result.uniqueFormats}`);
      console.log(`Materials: ${result.uniqueMaterials}`);
      console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
      console.log(`Fold types: ${result.uniqueFoldTypes}`);
      console.log(`Sider values: ${result.uniquePages}`);
      console.log(`Retning values: ${result.uniqueOrientations}`);
      return;
    }

    console.log("Import complete");
    console.log(`Product ID: ${result.productId}`);
    console.log(`Product slug: ${result.productSlug}`);
    console.log(`Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
    console.log(`Rows inserted: ${result.rowsInserted}`);
    console.log(`Formats: ${result.uniqueFormats}`);
    console.log(`Materials: ${result.uniqueMaterials}`);
    console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
    console.log(`Fold types: ${result.uniqueFoldTypes}`);
    console.log(`Sider values: ${result.uniquePages}`);
    console.log(`Retning values: ${result.uniqueOrientations}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.command || ["-h", "--help", "help"].includes(args.command)) {
    console.log(usage());
    return;
  }

  if (args.command !== "import") {
    throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
  }

  await runImport(args);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
