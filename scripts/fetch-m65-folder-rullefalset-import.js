#!/usr/bin/env node
/**
 * fetch-m65-folder-rullefalset-import.js
 *
 * Imports one matrix-v1 product from wir-machen-druck:
 *   https://www.wir-machen-druck.de/faltblatt-gefalzt-auf-din-lang-vertikaler-wickelfalz-6seitig.html
 *
 * Product:
 *   - Name: M65 Folder rullefalset
 *   - Format: M65 (10.5 x 21.0 cm) – DIN lang
 *   - Vertical axis: material
 *   - Rows:
 *       1) Papirfinish: Matt / Gloss (required)
 *       2) UV-lak: UV-lak front / UV-lak front og bag (optional)
 *       3) Kachering: Mat kachering front / Mat kachering front og bag (optional)
 *       4) Gloss Caching: Gloss kachering front / Gloss kachering front og bag (optional)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import {
  parseLocalizedNumber,
  resolveTierMultiplier,
  roundToStep,
} from "./product-import/ul-prices.js";
import { ensureDir, timestampForFile } from "./product-import/snapshot-io.js";

const SOURCE_URL =
  "https://www.wir-machen-druck.de/faltblatt-gefalzt-auf-din-lang-vertikaler-wickelfalz-6seitig.html";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "M65 Folder rullefalset";
const DEFAULT_PRODUCT_SLUG = "m65-folder-rullefalset";
const DEFAULT_FORMAT_LABEL = "M65";

const EUR_TO_DKK = 7.5;
const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

const TARGET_QUANTITIES = [
  50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000,
  8000, 9000, 10000, 12000, 15000, 20000,
];

const SURFACE_VALUES = ["Matt", "Gloss"];
const UV_LAK_VALUES = ["UV-lak front", "UV-lak front og bag"];
const KACHERING_VALUES = ["Mat kachering front", "Mat kachering front og bag"];
const GLOSS_CACHING_VALUES = [
  "Gloss kachering front",
  "Gloss kachering front og bag",
];

const BASE_SURFACE_SOURCES = [
  {
    materialLabel: "90g hochwertiger Qualitätsdruck",
    mattSource: "90g hochwertiger Qualitätsdruck matt",
    glossSource: "90g hochwertiger Qualitätsdruck glänzend",
  },
  {
    materialLabel: "115g hochwertiger Qualitätsdruck",
    mattSource: "115g hochwertiger Qualitätsdruck matt",
    glossSource: "115g hochwertiger Qualitätsdruck glänzend",
  },
  {
    materialLabel: "135g hochwertiger Qualitätsdruck",
    mattSource: "135g hochwertiger Qualitätsdruck matt",
    glossSource: "135g hochwertiger Qualitätsdruck glänzend",
  },
  {
    materialLabel: "170g hochwertiger Qualitätsdruck",
    mattSource: "170g hochwertiger Qualitätsdruck matt",
    glossSource: "170g hochwertiger Qualitätsdruck glänzend",
  },
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    mattSource: "250g hochwertiger Qualitätsdruck matt",
    glossSource: "250g hochwertiger Qualitätsdruck glänzend",
  },
  {
    materialLabel: "300g hochwertiger Qualitätsdruck",
    mattSource: "300g hochwertiger Qualitätsdruck matt",
    glossSource: "300g hochwertiger Qualitätsdruck glänzend",
  },
];

const RECYCLING_SOURCES = [
  {
    materialLabel:
      "Recycling: 80g Qualitätsdruck auf hochwertigem Recyclingpapier weiß",
    source: "Recycling: 80g Qualitätsdruck auf hochwertigem Recyclingpapier weiß",
  },
  {
    materialLabel:
      "Recycling: 135g Qualitätsdruck auf hochwertigem Recyclingpapier weiß",
    source: "Recycling: 135g Qualitätsdruck auf hochwertigem Recyclingpapier weiß",
  },
  {
    materialLabel:
      "Recycling: 170g hochwertiger Qualitätsdruck auf Recyclingpapier weiß matt",
    source:
      "Recycling: 170g hochwertiger Qualitätsdruck auf Recyclingpapier weiß matt",
  },
  {
    materialLabel:
      "Recycling: 300g hochwertiger Qualitätsdruck auf Recyclingkarton weiß matt",
    source:
      "Recycling: 300g hochwertiger Qualitätsdruck auf Recyclingkarton weiß matt",
  },
];

const UV_LAK_SOURCES = [
  {
    materialLabel: "135g hochwertiger Qualitätsdruck",
    uvLakLabel: "UV-lak front",
    source:
      "135g hochwertiger Qualitätsdruck mit einseitig exklusivem Hochglanz-UV-Lack",
  },
  {
    materialLabel: "135g hochwertiger Qualitätsdruck",
    uvLakLabel: "UV-lak front og bag",
    source:
      "135g hochwertiger Qualitätsdruck mit beidseitig exklusivem Hochglanz-UV-Lack",
  },
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    uvLakLabel: "UV-lak front",
    source:
      "250g hochwertiger Qualitätsdruck mit einseitig exklusivem Hochglanz-UV-Lack",
  },
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    uvLakLabel: "UV-lak front og bag",
    source:
      "250g hochwertiger Qualitätsdruck mit beidseitig exklusivem Hochglanz-UV-Lack",
  },
];

const KACHERING_SOURCES = [
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    kacheringLabel: "Mat kachering front",
    source:
      "Folienkaschiert: 250g hochwertiger Qualitätsdruck einseitig folienkaschiert matt",
  },
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    kacheringLabel: "Mat kachering front og bag",
    source:
      "Folienkaschiert: 250g hochwertiger Qualitätsdruck beidseitig folienkaschiert matt",
  },
  {
    materialLabel: "300g hochwertiger Qualitätsdruck",
    kacheringLabel: "Mat kachering front",
    source:
      "Folienkaschiert: 300g hochwertiger Qualitätsdruck einseitig folienkaschiert matt",
  },
  {
    materialLabel: "300g hochwertiger Qualitätsdruck",
    kacheringLabel: "Mat kachering front og bag",
    source:
      "Folienkaschiert: 300g hochwertiger Qualitätsdruck beidseitig folienkaschiert matt",
  },
  {
    materialLabel: "350g hochwertiger Qualitätsdruck",
    kacheringLabel: "Mat kachering front",
    source:
      "Folienkaschiert: 350g hochwertiger Qualitätsdruck einseitig folienkaschiert matt",
  },
  {
    materialLabel: "350g hochwertiger Qualitätsdruck",
    kacheringLabel: "Mat kachering front og bag",
    source:
      "Folienkaschiert: 350g hochwertiger Qualitätsdruck beidseitig folienkaschiert matt",
  },
];

const GLOSS_CACHING_SOURCES = [
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    glossCachingLabel: "Gloss kachering front",
    source:
      "Folienkaschiert: 250g hochwertiger Qualitätsdruck einseitig folienkaschiert glänzend",
  },
  {
    materialLabel: "250g hochwertiger Qualitätsdruck",
    glossCachingLabel: "Gloss kachering front og bag",
    source:
      "Folienkaschiert: 250g hochwertiger Qualitätsdruck beidseitig folienkaschiert glänzend",
  },
  {
    materialLabel: "300g hochwertiger Qualitätsdruck",
    glossCachingLabel: "Gloss kachering front",
    source:
      "Folienkaschiert: 300g hochwertiger Qualitätsdruck einseitig folienkaschiert glänzend",
  },
  {
    materialLabel: "300g hochwertiger Qualitätsdruck",
    glossCachingLabel: "Gloss kachering front og bag",
    source:
      "Folienkaschiert: 300g hochwertiger Qualitätsdruck beidseitig folienkaschiert glänzend",
  },
  {
    materialLabel: "350g hochwertiger Qualitätsdruck",
    glossCachingLabel: "Gloss kachering front",
    source:
      "Folienkaschiert: 350g hochwertiger Qualitätsdruck einseitig folienkaschiert glänzend",
  },
  {
    materialLabel: "350g hochwertiger Qualitätsdruck",
    glossCachingLabel: "Gloss kachering front og bag",
    source:
      "Folienkaschiert: 350g hochwertiger Qualitätsdruck beidseitig folienkaschiert glänzend",
  },
];

const MATERIAL_ORDER = [
  "90g hochwertiger Qualitätsdruck",
  "115g hochwertiger Qualitätsdruck",
  "135g hochwertiger Qualitätsdruck",
  "170g hochwertiger Qualitätsdruck",
  "250g hochwertiger Qualitätsdruck",
  "300g hochwertiger Qualitätsdruck",
  "350g hochwertiger Qualitätsdruck",
  "Recycling: 80g Qualitätsdruck auf hochwertigem Recyclingpapier weiß",
  "Recycling: 135g Qualitätsdruck auf hochwertigem Recyclingpapier weiß",
  "Recycling: 170g hochwertiger Qualitätsdruck auf Recyclingpapier weiß matt",
  "Recycling: 300g hochwertiger Qualitätsdruck auf Recyclingkarton weiß matt",
];

const REQUIRED_SOURCE_LABELS = Array.from(
  new Set([
    ...BASE_SURFACE_SOURCES.flatMap((item) => [item.mattSource, item.glossSource]),
    ...RECYCLING_SOURCES.map((item) => item.source),
    ...UV_LAK_SOURCES.map((item) => item.source),
    ...KACHERING_SOURCES.map((item) => item.source),
    ...GLOSS_CACHING_SOURCES.map((item) => item.source),
  ])
);

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-m65-folder-rullefalset-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--from-targeted-json <path>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || "",
    dryRun: argv.includes("--dry-run"),
    tenantId: DEFAULT_TENANT_ID,
    productName: DEFAULT_PRODUCT_NAME,
    productSlug: DEFAULT_PRODUCT_SLUG,
    fromTargetedJson: null,
  };

  const tenantIdx = argv.indexOf("--tenant");
  if (tenantIdx !== -1 && argv[tenantIdx + 1]) args.tenantId = argv[tenantIdx + 1];

  const nameIdx = argv.indexOf("--name");
  if (nameIdx !== -1 && argv[nameIdx + 1]) args.productName = argv[nameIdx + 1];

  const slugIdx = argv.indexOf("--slug");
  if (slugIdx !== -1 && argv[slugIdx + 1]) args.productSlug = argv[slugIdx + 1];

  const fromIdx = argv.indexOf("--from-targeted-json");
  if (fromIdx !== -1 && argv[fromIdx + 1]) args.fromTargetedJson = argv[fromIdx + 1];

  return args;
}

function normalizeLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuantityPriceText(text) {
  const raw = normalizeLabel(text);
  if (!raw) return null;

  const qtyMatch = raw.match(/([\d.]+)\s*St(?:ü|u)ck/i);
  if (!qtyMatch) return null;
  const quantity = Number(String(qtyMatch[1]).replace(/[^\d]/g, ""));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (!parenMatch) return null;
  const eurMatch = parenMatch[1].match(/([-+]?\d[\d.,]*)\s*(?:€|eur|euro)?/i);
  if (!eurMatch) return null;

  const eur = parseLocalizedNumber(eurMatch[1]);
  if (!Number.isFinite(eur) || eur <= 0) return null;

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
      const retryable =
        /Execution context was destroyed|Target page, context or browser has been closed|Timeout/i.test(
          message
        );
      if (!retryable || i === retries) throw error;
    }
  }
  throw lastError;
}

async function extractTargetedRows(page) {
  await page.goto(SOURCE_URL, { waitUntil: "networkidle", timeout: 90_000 });
  try {
    await page
      .locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler")
      .click({ timeout: 4_000 });
  } catch {
    // Cookie banner may not be present.
  }

  const materials = await withRetry(() =>
    page.$$eval("#sorten option", (nodes) =>
      nodes.map((node) => ({
        value: node.getAttribute("value") || "",
        label: (node.textContent || "").trim(),
      }))
    )
  );

  const materialByLabel = new Map(
    materials
      .map((item) => ({ ...item, label: normalizeLabel(item.label) }))
      .filter((item) => item.value)
      .map((item) => [item.label, item.value])
  );

  const missingLabels = REQUIRED_SOURCE_LABELS.filter((label) => !materialByLabel.has(label));
  if (missingLabels.length > 0) {
    throw new Error(
      `Missing required supplier materials: ${missingLabels.slice(0, 5).join(" | ")}${
        missingLabels.length > 5 ? ` (+${missingLabels.length - 5} more)` : ""
      }`
    );
  }

  const extractedRows = [];

  for (const sourceMaterialLabel of REQUIRED_SOURCE_LABELS) {
    const value = materialByLabel.get(sourceMaterialLabel);
    if (!value) continue;

    await withRetry(async () => {
      await page.selectOption("#sorten", value);
      await page.waitForTimeout(1300);
    }, 3);

    const qtyTexts = await withRetry(
      () =>
        page.$$eval("#wmd_shirt_auflage option, select[name*='auflage'] option", (nodes) =>
          Array.from(new Set(nodes.map((node) => (node.textContent || "").trim()).filter(Boolean)))
        ),
      3
    );

    const perMaterialMap = new Map();
    qtyTexts.forEach((text) => {
      const parsed = parseQuantityPriceText(text);
      if (!parsed) return;
      if (!TARGET_QUANTITIES.includes(parsed.quantity)) return;

      perMaterialMap.set(parsed.quantity, {
        sourceMaterialLabel,
        quantity: parsed.quantity,
        eur: parsed.eur,
        sourceOptionText: text,
      });
    });

    const parsedRows = Array.from(perMaterialMap.values()).sort((a, b) => a.quantity - b.quantity);
    extractedRows.push(...parsedRows);

    const missingForMaterial = TARGET_QUANTITIES.filter(
      (qty) => !perMaterialMap.has(qty)
    );
    console.log(
      `  ${sourceMaterialLabel.substring(0, 74).padEnd(74)} -> found ${parsedRows.length
        .toString()
        .padStart(2, " ")} / ${TARGET_QUANTITIES.length} | missing: ${missingForMaterial.length}`
    );
  }

  return extractedRows;
}

function fillMissingTargetQuantities(sourceRows) {
  const grouped = new Map();
  sourceRows.forEach((row) => {
    if (!grouped.has(row.sourceMaterialLabel)) grouped.set(row.sourceMaterialLabel, new Map());
    grouped.get(row.sourceMaterialLabel).set(row.quantity, row);
  });

  const output = [...sourceRows];
  let inferredCount = 0;

  grouped.forEach((qtyMap, sourceMaterialLabel) => {
    const existingQuantities = Array.from(qtyMap.keys()).sort((a, b) => a - b);
    if (existingQuantities.length === 0) return;

    TARGET_QUANTITIES.forEach((targetQty) => {
      if (qtyMap.has(targetQty)) return;

      let nearestQty = existingQuantities[0];
      let nearestDistance = Math.abs(nearestQty - targetQty);
      existingQuantities.forEach((q) => {
        const distance = Math.abs(q - targetQty);
        if (distance < nearestDistance) {
          nearestQty = q;
          nearestDistance = distance;
        }
      });

      const template = qtyMap.get(nearestQty);
      if (!template) return;

      const inferred = {
        ...template,
        sourceMaterialLabel,
        quantity: targetQty,
        sourceOptionText: "[inferred-missing-quantity]",
        inferredFromQuantity: nearestQty,
      };

      output.push(inferred);
      qtyMap.set(targetQty, inferred);
      inferredCount += 1;
    });
  });

  return { rows: output, inferredCount };
}

function buildTransformedSourceRows(sourceRows) {
  const dedup = new Map();
  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.eur);
    const payload = {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    };
    dedup.set(`${row.sourceMaterialLabel}||${row.quantity}`, payload);
  });
  return Array.from(dedup.values()).sort((a, b) => {
    if (a.sourceMaterialLabel !== b.sourceMaterialLabel) {
      return a.sourceMaterialLabel.localeCompare(b.sourceMaterialLabel);
    }
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedSourceRows) {
  const bySourceQty = new Map();
  transformedSourceRows.forEach((row) => {
    if (!bySourceQty.has(row.sourceMaterialLabel)) bySourceQty.set(row.sourceMaterialLabel, new Map());
    bySourceQty.get(row.sourceMaterialLabel).set(row.quantity, row);
  });

  const getSourceRow = (sourceLabel, qty) => bySourceQty.get(sourceLabel)?.get(qty) || null;
  const rows = [];

  // Base row: Matt/Gloss.
  BASE_SURFACE_SOURCES.forEach((entry) => {
    TARGET_QUANTITIES.forEach((qty) => {
      const matt = getSourceRow(entry.mattSource, qty);
      const gloss = getSourceRow(entry.glossSource, qty);
      if (matt) {
        rows.push({
          rowType: "base_surface",
          formatLabel: DEFAULT_FORMAT_LABEL,
          materialLabel: entry.materialLabel,
          surfaceLabel: "Matt",
          uvLakLabel: null,
          kacheringLabel: null,
          glossCachingLabel: null,
          quantity: qty,
          eur: matt.eur,
          dkkBase: matt.dkkBase,
          tierMultiplier: matt.tierMultiplier,
          dkkFinal: matt.dkkFinal,
          sourceMaterialLabel: matt.sourceMaterialLabel,
          sourceUrl: SOURCE_URL,
          inferredFromQuantity: matt.inferredFromQuantity || null,
        });
      }
      if (gloss) {
        rows.push({
          rowType: "base_surface",
          formatLabel: DEFAULT_FORMAT_LABEL,
          materialLabel: entry.materialLabel,
          surfaceLabel: "Gloss",
          uvLakLabel: null,
          kacheringLabel: null,
          glossCachingLabel: null,
          quantity: qty,
          eur: gloss.eur,
          dkkBase: gloss.dkkBase,
          tierMultiplier: gloss.tierMultiplier,
          dkkFinal: gloss.dkkFinal,
          sourceMaterialLabel: gloss.sourceMaterialLabel,
          sourceUrl: SOURCE_URL,
          inferredFromQuantity: gloss.inferredFromQuantity || null,
        });
      }
    });
  });

  // Recycling: duplicate same source prices for Matt and Gloss.
  RECYCLING_SOURCES.forEach((entry) => {
    TARGET_QUANTITIES.forEach((qty) => {
      const source = getSourceRow(entry.source, qty);
      if (!source) return;
      SURFACE_VALUES.forEach((surfaceLabel) => {
        rows.push({
          rowType: "recycling_surface",
          formatLabel: DEFAULT_FORMAT_LABEL,
          materialLabel: entry.materialLabel,
          surfaceLabel,
          uvLakLabel: null,
          kacheringLabel: null,
          glossCachingLabel: null,
          quantity: qty,
          eur: source.eur,
          dkkBase: source.dkkBase,
          tierMultiplier: source.tierMultiplier,
          dkkFinal: source.dkkFinal,
          sourceMaterialLabel: source.sourceMaterialLabel,
          sourceUrl: SOURCE_URL,
          inferredFromQuantity: source.inferredFromQuantity || null,
        });
      });
    });
  });

  // UV-lak: duplicate for both surface selections so UV row can be used regardless of Matt/Gloss.
  UV_LAK_SOURCES.forEach((entry) => {
    TARGET_QUANTITIES.forEach((qty) => {
      const source = getSourceRow(entry.source, qty);
      if (!source) return;
      SURFACE_VALUES.forEach((surfaceLabel) => {
        rows.push({
          rowType: "uv_lak",
          formatLabel: DEFAULT_FORMAT_LABEL,
          materialLabel: entry.materialLabel,
          surfaceLabel,
          uvLakLabel: entry.uvLakLabel,
          kacheringLabel: null,
          glossCachingLabel: null,
          quantity: qty,
          eur: source.eur,
          dkkBase: source.dkkBase,
          tierMultiplier: source.tierMultiplier,
          dkkFinal: source.dkkFinal,
          sourceMaterialLabel: source.sourceMaterialLabel,
          sourceUrl: SOURCE_URL,
          inferredFromQuantity: source.inferredFromQuantity || null,
        });
      });
    });
  });

  // Matte kachering row.
  KACHERING_SOURCES.forEach((entry) => {
    TARGET_QUANTITIES.forEach((qty) => {
      const source = getSourceRow(entry.source, qty);
      if (!source) return;
      SURFACE_VALUES.forEach((surfaceLabel) => {
        rows.push({
          rowType: "kachering_matte",
          formatLabel: DEFAULT_FORMAT_LABEL,
          materialLabel: entry.materialLabel,
          surfaceLabel,
          uvLakLabel: null,
          kacheringLabel: entry.kacheringLabel,
          glossCachingLabel: null,
          quantity: qty,
          eur: source.eur,
          dkkBase: source.dkkBase,
          tierMultiplier: source.tierMultiplier,
          dkkFinal: source.dkkFinal,
          sourceMaterialLabel: source.sourceMaterialLabel,
          sourceUrl: SOURCE_URL,
          inferredFromQuantity: source.inferredFromQuantity || null,
        });
      });
    });
  });

  // Gloss kachering row.
  GLOSS_CACHING_SOURCES.forEach((entry) => {
    TARGET_QUANTITIES.forEach((qty) => {
      const source = getSourceRow(entry.source, qty);
      if (!source) return;
      SURFACE_VALUES.forEach((surfaceLabel) => {
        rows.push({
          rowType: "kachering_gloss",
          formatLabel: DEFAULT_FORMAT_LABEL,
          materialLabel: entry.materialLabel,
          surfaceLabel,
          uvLakLabel: null,
          kacheringLabel: null,
          glossCachingLabel: entry.glossCachingLabel,
          quantity: qty,
          eur: source.eur,
          dkkBase: source.dkkBase,
          tierMultiplier: source.tierMultiplier,
          dkkFinal: source.dkkFinal,
          sourceMaterialLabel: source.sourceMaterialLabel,
          sourceUrl: SOURCE_URL,
          inferredFromQuantity: source.inferredFromQuantity || null,
        });
      });
    });
  });

  const dedupe = new Map();
  rows.forEach((row) => {
    const key = [
      row.formatLabel,
      row.materialLabel,
      row.surfaceLabel,
      row.uvLakLabel || "",
      row.kacheringLabel || "",
      row.glossCachingLabel || "",
      row.quantity,
    ].join("||");
    dedupe.set(key, row);
  });

  return Array.from(dedupe.values()).sort((a, b) => {
    if (a.rowType !== b.rowType) return a.rowType.localeCompare(b.rowType);
    if (a.materialLabel !== b.materialLabel) return a.materialLabel.localeCompare(b.materialLabel);
    if (a.surfaceLabel !== b.surfaceLabel) return a.surfaceLabel.localeCompare(b.surfaceLabel);
    if ((a.uvLakLabel || "") !== (b.uvLakLabel || "")) return (a.uvLakLabel || "").localeCompare(b.uvLakLabel || "");
    if ((a.kacheringLabel || "") !== (b.kacheringLabel || "")) return (a.kacheringLabel || "").localeCompare(b.kacheringLabel || "");
    if ((a.glossCachingLabel || "") !== (b.glossCachingLabel || "")) return (a.glossCachingLabel || "").localeCompare(b.glossCachingLabel || "");
    return a.quantity - b.quantity;
  });
}

function serializeCsv(rows) {
  const header = [
    "row_type",
    "format",
    "material",
    "surface",
    "uv_lak",
    "kachering",
    "gloss_caching",
    "quantity",
    "eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "source_material",
    "inferred_from_quantity",
    "detail_url",
  ];

  const lines = [header.join(",")];
  rows.forEach((row) => {
    const fields = [
      row.rowType,
      row.formatLabel,
      row.materialLabel,
      row.surfaceLabel,
      row.uvLakLabel || "",
      row.kacheringLabel || "",
      row.glossCachingLabel || "",
      row.quantity,
      row.eur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.sourceMaterialLabel || "",
      row.inferredFromQuantity || "",
      row.sourceUrl || "",
    ].map((field) => {
      const text = String(field ?? "");
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    });
    lines.push(fields.join(","));
  });

  return `${lines.join("\n")}\n`;
}

function loadSourceRowsFromTargetedJson(filePath) {
  const resolved = path.resolve(filePath);
  const payload = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows
    .map((row) => {
      const sourceMaterialLabel = normalizeLabel(row.sourceMaterialLabel || row.materialLabel || "");
      const quantity = Number(row.quantity);
      const eur = Number(row.eur);
      if (!sourceMaterialLabel || !Number.isFinite(quantity) || !Number.isFinite(eur)) return null;
      return {
        sourceMaterialLabel,
        quantity,
        eur,
        sourceOptionText: row.sourceOptionText || "",
        inferredFromQuantity: row.inferredFromQuantity || null,
      };
    })
    .filter(Boolean);
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Expected VITE_SUPABASE_URL and a Supabase key."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureProduct(client, tenantId, productName, productSlug) {
  const { data: existing, error: existingError } = await client
    .from("products")
    .select("id, slug, name, is_published")
    .eq("tenant_id", tenantId)
    .eq("slug", productSlug)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { product: existing, created: false };

  const { data: created, error: createError } = await client
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: productName,
      slug: productSlug,
      icon_text: "Folder",
      description: "M65 Folder rullefalset - auto-imported from wir-machen-druck.de",
      category: "tryksager",
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: {
        width_mm: 105,
        height_mm: 210,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: "A7",
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

async function ensureGroup(client, context, { name, kind, sortOrder }) {
  const normalizedName = normalizeLabel(name).toLowerCase();
  const existing = context.groups.find(
    (group) => group.kind === kind && normalizeLabel(group.name).toLowerCase() === normalizedName
  );
  if (existing) return existing;

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
    const patch = {};
    if (extras.widthMm && Number(existing.width_mm || 0) !== Number(extras.widthMm)) {
      patch.width_mm = Number(extras.widthMm);
    }
    if (extras.heightMm && Number(existing.height_mm || 0) !== Number(extras.heightMm)) {
      patch.height_mm = Number(extras.heightMm);
    }
    if (Object.keys(patch).length > 0) {
      const { data: updated, error: updateError } = await client
        .from("product_attribute_values")
        .update(patch)
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
  uvLakGroup,
  uvLakValues,
  kacheringGroup,
  kacheringValues,
  glossCachingGroup,
  glossCachingValues,
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
            ui_mode: "hidden",
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
        id: "row-uv-lak",
        title: "",
        description: "",
        columns: [
          {
            id: "uv-lak-section",
            sectionType: "finishes",
            groupId: uvLakGroup.id,
            valueIds: uvLakValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "optional",
            valueSettings: {},
            title: "UV-lak",
            description: "",
          },
        ],
      },
      {
        id: "row-kachering",
        title: "",
        description: "",
        columns: [
          {
            id: "kachering-section",
            sectionType: "finishes",
            groupId: kacheringGroup.id,
            valueIds: kacheringValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "optional",
            valueSettings: {},
            title: "Kachering",
            description: "",
          },
        ],
      },
      {
        id: "row-gloss-caching",
        title: "",
        description: "",
        columns: [
          {
            id: "gloss-caching-section",
            sectionType: "finishes",
            groupId: glossCachingGroup.id,
            valueIds: glossCachingValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "optional",
            valueSettings: {},
            title: "Gloss Caching",
            description: "",
          },
        ],
      },
    ],
    quantities: TARGET_QUANTITIES,
  };
}

async function importToSupabase({
  tenantId,
  productName,
  productSlug,
  mappedRows,
  dryRun,
}) {
  if (mappedRows.length === 0) throw new Error("No mapped rows to import.");

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      uniqueMaterials: new Set(mappedRows.map((row) => row.materialLabel)).size,
      uniqueSurfaceValues: new Set(mappedRows.map((row) => row.surfaceLabel)).size,
      uniqueUvLakValues: new Set(mappedRows.map((row) => row.uvLakLabel).filter(Boolean)).size,
      uniqueKacheringValues: new Set(mappedRows.map((row) => row.kacheringLabel).filter(Boolean)).size,
      uniqueGlossCachingValues: new Set(
        mappedRows.map((row) => row.glossCachingLabel).filter(Boolean)
      ).size,
    };
  }

  const client = getSupabaseClient();
  const ensured = await ensureProduct(client, tenantId, productName, productSlug);

  const context = {
    tenantId,
    productId: ensured.product.id,
    groups: await loadGroups(client, tenantId, ensured.product.id),
  };

  const formatGroup = await ensureGroup(client, context, {
    name: "Format",
    kind: "format",
    sortOrder: 0,
  });
  const materialGroup = await ensureGroup(client, context, {
    name: "Materiale",
    kind: "material",
    sortOrder: 1,
  });
  const surfaceGroup = await ensureGroup(client, context, {
    name: "Papirfinish",
    kind: "other",
    sortOrder: 2,
  });
  const uvLakGroup = await ensureGroup(client, context, {
    name: "UV-lak",
    kind: "finish",
    sortOrder: 3,
  });
  const kacheringGroup = await ensureGroup(client, context, {
    name: "Kachering",
    kind: "finish",
    sortOrder: 4,
  });
  const glossCachingGroup = await ensureGroup(client, context, {
    name: "Gloss Caching",
    kind: "finish",
    sortOrder: 5,
  });

  const formatMap = new Map();
  const materialMap = new Map();
  const surfaceMap = new Map();
  const uvLakMap = new Map();
  const kacheringMap = new Map();
  const glossCachingMap = new Map();

  formatMap.set(
    DEFAULT_FORMAT_LABEL,
    await ensureValue(client, context, formatGroup, DEFAULT_FORMAT_LABEL, {
      widthMm: 105,
      heightMm: 210,
    })
  );

  for (const materialLabel of MATERIAL_ORDER) {
    materialMap.set(
      materialLabel,
      await ensureValue(client, context, materialGroup, materialLabel)
    );
  }

  for (const surfaceLabel of SURFACE_VALUES) {
    surfaceMap.set(
      surfaceLabel,
      await ensureValue(client, context, surfaceGroup, surfaceLabel)
    );
  }

  for (const uvLakLabel of UV_LAK_VALUES) {
    uvLakMap.set(
      uvLakLabel,
      await ensureValue(client, context, uvLakGroup, uvLakLabel)
    );
  }

  for (const kacheringLabel of KACHERING_VALUES) {
    kacheringMap.set(
      kacheringLabel,
      await ensureValue(client, context, kacheringGroup, kacheringLabel)
    );
  }

  for (const glossCachingLabel of GLOSS_CACHING_VALUES) {
    glossCachingMap.set(
      glossCachingLabel,
      await ensureValue(client, context, glossCachingGroup, glossCachingLabel)
    );
  }

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValues: MATERIAL_ORDER.map((name) => materialMap.get(name)).filter(Boolean),
    formatGroup,
    formatValues: [formatMap.get(DEFAULT_FORMAT_LABEL)].filter(Boolean),
    surfaceGroup,
    surfaceValues: SURFACE_VALUES.map((name) => surfaceMap.get(name)).filter(Boolean),
    uvLakGroup,
    uvLakValues: UV_LAK_VALUES.map((name) => uvLakMap.get(name)).filter(Boolean),
    kacheringGroup,
    kacheringValues: KACHERING_VALUES.map((name) => kacheringMap.get(name)).filter(Boolean),
    glossCachingGroup,
    glossCachingValues: GLOSS_CACHING_VALUES.map((name) => glossCachingMap.get(name)).filter(Boolean),
  });

  const dedupeRows = new Map();

  mappedRows.forEach((row) => {
    const formatValue = formatMap.get(row.formatLabel);
    const materialValue = materialMap.get(row.materialLabel);
    const surfaceValue = surfaceMap.get(row.surfaceLabel);
    const uvLakValue = row.uvLakLabel ? uvLakMap.get(row.uvLakLabel) : null;
    const kacheringValue = row.kacheringLabel ? kacheringMap.get(row.kacheringLabel) : null;
    const glossCachingValue = row.glossCachingLabel
      ? glossCachingMap.get(row.glossCachingLabel)
      : null;

    if (!formatValue || !materialValue || !surfaceValue) return;
    if (row.uvLakLabel && !uvLakValue) return;
    if (row.kacheringLabel && !kacheringValue) return;
    if (row.glossCachingLabel && !glossCachingValue) return;

    const variantValueIds = [surfaceValue.id];
    if (uvLakValue) variantValueIds.push(uvLakValue.id);
    if (kacheringValue) variantValueIds.push(kacheringValue.id);
    if (glossCachingValue) variantValueIds.push(glossCachingValue.id);
    const sortedVariantValueIds = Array.from(new Set(variantValueIds)).sort();
    const variantName = [formatValue.id, ...sortedVariantValueIds].sort().join("|");

    const payload = {
      tenant_id: tenantId,
      product_id: ensured.product.id,
      variant_name: variantName,
      variant_value: materialValue.id,
      quantity: row.quantity,
      price_dkk: row.dkkFinal,
      extra_data: {
        verticalAxisGroupId: materialGroup.id,
        verticalAxisValueId: materialValue.id,
        formatId: formatValue.id,
        materialId: materialValue.id,
        surfaceId: surfaceValue.id,
        uvLakId: uvLakValue?.id || null,
        kacheringId: kacheringValue?.id || null,
        glossCachingId: glossCachingValue?.id || null,
        variantValueIds: sortedVariantValueIds,
        selectionMap: {
          format: formatValue.id,
          material: materialValue.id,
          variantValueIds: sortedVariantValueIds,
        },
        source: "m65_folder_rullefalset_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceMaterialLabel: row.sourceMaterialLabel,
        rowType: row.rowType,
        eur: row.eur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
        inferredFromQuantity: row.inferredFromQuantity,
      },
    };

    const key = `${payload.product_id}|${payload.variant_name}|${payload.variant_value}|${payload.quantity}`;
    dedupeRows.set(key, payload);
  });

  const priceRows = Array.from(dedupeRows.values());

  const { error: productUpdateError } = await client
    .from("products")
    .update({
      name: productName,
      slug: productSlug,
      pricing_type: "matrix",
      pricing_structure: pricingStructure,
    })
    .eq("id", ensured.product.id);
  if (productUpdateError) throw productUpdateError;

  const { error: deleteError } = await client
    .from("generic_product_prices")
    .delete()
    .eq("product_id", ensured.product.id);
  if (deleteError) throw deleteError;

  let inserted = 0;
  for (let i = 0; i < priceRows.length; i += 500) {
    const batch = priceRows.slice(i, i + 500);
    const { error: insertError } = await client.from("generic_product_prices").insert(batch);
    if (insertError) throw insertError;
    inserted += batch.length;
  }

  return {
    dryRun: false,
    productId: ensured.product.id,
    productSlug,
    productCreated: ensured.created,
    rowsInserted: inserted,
    uniqueMaterials: MATERIAL_ORDER.length,
    uniqueSurfaceValues: SURFACE_VALUES.length,
    uniqueUvLakValues: UV_LAK_VALUES.length,
    uniqueKacheringValues: KACHERING_VALUES.length,
    uniqueGlossCachingValues: GLOSS_CACHING_VALUES.length,
  };
}

async function runImport(args) {
  const repoRoot = process.cwd();
  ensureDir(path.join(repoRoot, "pricing_raw"));
  ensureDir(path.join(repoRoot, "pricing_clean"));

  let extractedRows = [];

  if (args.fromTargetedJson) {
    extractedRows = loadSourceRowsFromTargetedJson(args.fromTargetedJson);
    if (extractedRows.length === 0) {
      throw new Error(`No source rows loaded from JSON: ${args.fromTargetedJson}`);
    }
    console.log(`Loaded source rows from ${args.fromTargetedJson}: ${extractedRows.length}`);
  } else {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      extractedRows = await extractTargetedRows(page);
    } finally {
      await browser.close();
    }
  }

  if (extractedRows.length === 0) {
    throw new Error("No source rows extracted");
  }

  const fillResult = fillMissingTargetQuantities(extractedRows);
  const transformedSourceRows = buildTransformedSourceRows(fillResult.rows);
  const mappedRows = buildMappedRows(transformedSourceRows);

  if (mappedRows.length === 0) {
    throw new Error("Mapped rows are empty after transformation");
  }

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
        product: {
          name: args.productName,
          slug: args.productSlug,
          tenant_id: args.tenantId,
          format: DEFAULT_FORMAT_LABEL,
          source_url: SOURCE_URL,
        },
        target_quantities: TARGET_QUANTITIES,
        source_labels: REQUIRED_SOURCE_LABELS,
        extracted_rows: extractedRows,
        inferred_rows_added: fillResult.inferredCount,
        transformed_source_rows: transformedSourceRows,
        mapped_rows: mappedRows,
      },
      null,
      2
    ),
    "utf8"
  );

  fs.writeFileSync(cleanPath, serializeCsv(mappedRows), "utf8");

  console.log(`Raw snapshot: ${rawPath}`);
  console.log(`Clean CSV: ${cleanPath}`);
  console.log(`Extracted source rows: ${extractedRows.length}`);
  console.log(`Inferred source rows added: ${fillResult.inferredCount}`);
  console.log(`Transformed source rows: ${transformedSourceRows.length}`);
  console.log(`Mapped product rows: ${mappedRows.length}`);

  const result = await importToSupabase({
    tenantId: args.tenantId,
    productName: args.productName,
    productSlug: args.productSlug,
    mappedRows,
    dryRun: args.dryRun,
  });

  if (result.dryRun) {
    console.log("Dry-run complete (no DB writes)");
    console.log(`Product slug: ${result.productSlug}`);
    console.log(`Rows prepared: ${result.rowsPrepared}`);
    console.log(`Materials: ${result.uniqueMaterials}`);
    console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
    console.log(`UV-lak values: ${result.uniqueUvLakValues}`);
    console.log(`Kachering values: ${result.uniqueKacheringValues}`);
    console.log(`Gloss Caching values: ${result.uniqueGlossCachingValues}`);
    return;
  }

  console.log("Import complete");
  console.log(`Product ID: ${result.productId}`);
  console.log(`Product slug: ${result.productSlug}`);
  console.log(`Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
  console.log(`Rows inserted: ${result.rowsInserted}`);
  console.log(`Materials: ${result.uniqueMaterials}`);
  console.log(`Papirfinish values: ${result.uniqueSurfaceValues}`);
  console.log(`UV-lak values: ${result.uniqueUvLakValues}`);
  console.log(`Kachering values: ${result.uniqueKacheringValues}`);
  console.log(`Gloss Caching values: ${result.uniqueGlossCachingValues}`);
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
