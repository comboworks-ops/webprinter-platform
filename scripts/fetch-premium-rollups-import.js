#!/usr/bin/env node
/**
 * fetch-premium-rollups-import.js
 *
 * Imports premium roll-up pricing from wir-machen-druck into Webprinter.
 *
 * - Product: Premium Rollups
 * - Formats: 9 premium format categories
 * - Materials: 6 "Alle Rollups gleiches Motiv" materials
 * - Quantities: 1..10
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

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Premium Rollups";
const DEFAULT_PRODUCT_SLUG = "premium-rollups";
const DEFAULT_CATEGORY = "tryksager";

const SOURCE_FORMATS = [
  {
    key: "rollup_60x200",
    label: "Roll up 60 x 200 cm",
    widthMm: 600,
    heightMm: 2000,
    url: "https://www.wir-machen-druck.de/premium-rollup-60-x-200-cm-extrem-guenstig-online-bestellen,category,14137.html",
  },
  {
    key: "rollup_85x200",
    label: "Roll up 85 x 200 cm",
    widthMm: 850,
    heightMm: 2000,
    url: "https://www.wir-machen-druck.de/premium-rollup-85-x-200-cm-extrem-guenstig-online-bestellen,category,14136.html",
  },
  {
    key: "rollup_100x200",
    label: "Roll up 100 x 200 cm",
    widthMm: 1000,
    heightMm: 2000,
    url: "https://www.wir-machen-druck.de/premium-rollup-100-x-200-cm-extrem-guenstig-online-bestellen,category,14138.html",
  },
  {
    key: "rollup_120x200",
    label: "Roll up 120 x 200 cm",
    widthMm: 1200,
    heightMm: 2000,
    url: "https://www.wir-machen-druck.de/premium-rollup-120-x-200-cm-extrem-guenstig-online-bestellen,category,14139.html",
  },
  {
    key: "rollup_150x200",
    label: "Roll up 150 x 200 cm",
    widthMm: 1500,
    heightMm: 2000,
    url: "https://www.wir-machen-druck.de/premium-rollup-150-x-200-cm-extrem-guenstig-online-bestellen,category,14140.html",
  },
  {
    key: "rollup_200x170",
    label: "Roll up 200 x 170 cm",
    widthMm: 2000,
    heightMm: 1700,
    url: "https://www.wir-machen-druck.de/premium-rollup-200-x-170-cm-extrem-guenstig-online-bestellen,category,17954.html",
  },
  {
    key: "rollup_200x200",
    label: "Roll up 200 x 200 cm",
    widthMm: 2000,
    heightMm: 2000,
    url: "https://www.wir-machen-druck.de/premium-rollup-200-x-200-cm-extrem-guenstig-online-bestellen,category,17955.html",
  },
  {
    key: "rollup_200x250",
    label: "Roll up 200 x 250 cm",
    widthMm: 2000,
    heightMm: 2500,
    url: "https://www.wir-machen-druck.de/premium-rollup-200-x-250-cm-extrem-guenstig-online-bestellen,category,17956.html",
  },
  {
    key: "rollup_200x300",
    label: "Roll up 200 x 300 cm",
    widthMm: 2000,
    heightMm: 3000,
    url: "https://www.wir-machen-druck.de/premium-rollup-200-x-300-cm-extrem-guenstig-online-bestellen,category,17957.html",
  },
];

const TARGET_MATERIALS = [
  {
    key: "frontlit_pvc_510",
    token: "510 g/m² frontlit pvc-banner",
    label:
      "Alle Rollups gleiches Motiv: Qualitätsdruck auf 510 g/m² Frontlit PVC-Banner (B1 zertifiziert - schwer entflammbar)",
  },
  {
    key: "fineart_canvas_260",
    token: "260 g/m² exklusivem fineart-canvas-leinenstoff",
    label:
      "Alle Rollups gleiches Motiv: Qualitätsdruck auf 260 g/m² exklusivem Fineart-Canvas-Leinenstoff",
  },
  {
    key: "polyester_300",
    token: "300 g/m² polyester-gewebe mit blickdichter grauer rückseite",
    label:
      "Alle Rollups gleiches Motiv: Qualitätsdruck auf 300 g/m² Polyester-Gewebe mit blickdichter grauer Rückseite (B1 zertifiziert - schwer entflammbar)",
  },
  {
    key: "pp_film",
    token: "pp-banner rollup-film, blickdicht, reißfest und pvc-frei",
    label:
      "Alle Rollups gleiches Motiv: Qualitätsdruck auf 240 g/m² PP-Banner Rollup-Film, blickdicht, reißfest und PVC-frei (ideal geeignet für brillanten Farbdruck in höchster Qualität)",
  },
  {
    key: "stone_display_195",
    token: "195 g/m² stone display rollup-film",
    label:
      "Alle Rollups gleiches Motiv: Qualitätsdruck auf 195 g/m² STONE DISPLAY Rollup-Film mit Blockoutschicht und Sandstrahloberfläche",
  },
  {
    key: "textilgewebe_250",
    token: "250 g/m² hochwertigem textilgewebe mit erstklassiger bedruckbarkeit",
    label:
      "Alle Rollups gleiches Motiv: Qualitätsdruck auf 250 g/m² hochwertigem Textilgewebe mit erstklassiger Bedruckbarkeit",
  },
];

const TARGET_QUANTITIES = Array.from({ length: 10 }, (_, i) => i + 1);

const EUR_TO_DKK = 7.6;
const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

const SHORT_DESCRIPTION_DA =
  "Premium roll-up bannerdisplays i flere formater inkl. tryk og levering.";
const ABOUT_TITLE_DA = "Produktdetaljer";
const ABOUT_DESCRIPTION_DA = [
  "Premium roll-up bannerdisplays leveres inkl. tryk og forsendelse.",
  "Produktet findes i flere formater fra 60 x 200 cm op til 200 x 300 cm.",
  "",
  "Materialevalg:",
  "- 510 g/m² Frontlit PVC-banner (B1, flammehæmmende)",
  "- 260 g/m² Fineart canvas-leinen",
  "- 300 g/m² polyester-gewebe med grå blockout bagside (B1)",
  "- 240 g/m² PP-rollup film, PVC-fri, rivefast og lystæt",
  "- 195 g/m² STONE DISPLAY rollup-film med blockoutlag",
  "- 250 g/m² tekstilgewebe med høj printkvalitet",
  "",
  "Anbefaling: Hold vigtige tekster og logoer væk fra monteringszoner ved top og bund.",
  "Roll-up leveres med kassette/stativ og transportløsning egnet til messer, showroom og butik.",
].join("\n");

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-premium-rollups-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--from-targeted-json <path>]",
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

function normalizeForMatch(text) {
  return normalizeLabel(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/-/g, " ");
}

function kebabCase(text) {
  return normalizeLabel(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseQuantityPriceText(text) {
  const raw = normalizeLabel(text);
  if (!raw) return null;

  const qtyMatch = raw.match(/(^|\s)(\d{1,3}(?:[.\s]\d{3})*)\s*St(?:u|ü)ck/i);
  if (!qtyMatch) return null;

  const quantity = Number(String(qtyMatch[2]).replace(/[^\d]/g, ""));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const parenMatch = raw.match(/\(([^)]+)\)/);
  let eur = null;

  if (parenMatch?.[1]) {
    const eurMatch = parenMatch[1].match(/([-+]?\d[\d.,]*)\s*(?:€|eur|euro)?/i);
    if (eurMatch?.[1]) {
      eur = parseLocalizedNumber(eurMatch[1]);
    }
  }

  if (!Number.isFinite(eur || NaN)) {
    const eurMatch = raw.match(/([-+]?\d[\d.,]*)\s*(?:€|eur|euro)\b/i);
    if (eurMatch?.[1]) {
      eur = parseLocalizedNumber(eurMatch[1]);
    }
  }

  if (!Number.isFinite(eur || NaN) || (eur || 0) <= 0) return null;

  const hasPerUnitMarker = /\bje\b|pro\s*(?:stk|stück|roll-up)|\/\s*(?:stk|stück|roll-up)/i.test(raw);
  if (hasPerUnitMarker && quantity > 1) {
    eur = eur * quantity;
  }

  return {
    quantity,
    eur,
  };
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

async function acceptCookieBanner(page) {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "button:has-text('Alle akzeptieren')",
    "button:has-text('Akzeptieren')",
  ];

  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      await button.click({ timeout: 2500 });
      await page.waitForTimeout(250);
      return;
    } catch {
      // ignore and try next selector
    }
  }
}

async function selectStandardQuantityMode(page) {
  await page.evaluate(() => {
    const standard = document.querySelector('input[name="auflage_type"][value="1"]');
    if (!standard) return;
    if (!standard.checked) {
      standard.click();
      standard.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(400);
}

async function extractQuantityTexts(page) {
  return withRetry(
    () =>
      page.evaluate(() => {
        const selectors = [
          "#wmd_shirt_auflage option",
          "select[name*='auflage'] option",
          "select[id*='auflage'] option",
        ];

        const seen = new Set();
        const values = [];

        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((node) => {
            const text = (node.textContent || "").trim();
            if (!text || seen.has(text)) return;
            seen.add(text);
            values.push(text);
          });
        }

        return values;
      }),
    3
  );
}

async function extractMaterialOptions(page) {
  return withRetry(
    () =>
      page.$$eval("#sorten option", (nodes) =>
        nodes.map((node) => ({
          value: node.getAttribute("value") || "",
          label: (node.textContent || "").trim(),
        }))
      ),
    3
  );
}

function findMaterialOption(materialOptions, targetMaterial) {
  const token = normalizeForMatch(targetMaterial.token);
  return materialOptions.find((option) => {
    const labelNorm = normalizeForMatch(option.label);
    return labelNorm.includes("alle rollups gleiches motiv") && labelNorm.includes(token);
  });
}

async function resolveDetailUrlIfCategory(page) {
  const materialOptions = await extractMaterialOptions(page);
  if (materialOptions.length > 0) return page.url();

  const detailUrl = await withRetry(
    () =>
      page.evaluate(() => {
        const selectors = [
          "a[href*='inklusive-druck-und-versand.html']",
          "a[href*='inklusive-druck-und-versand']",
          ".product-overview a[href]",
          ".product-price-and-button a[href]",
          "a[href*='bannerdisplay'][href*='versand']",
        ];

        for (const selector of selectors) {
          const anchor = document.querySelector(selector);
          const href = anchor?.getAttribute("href");
          if (!href) continue;
          try {
            return new URL(href, window.location.href).href;
          } catch {
            // ignore malformed URL
          }
        }

        return null;
      }),
    2
  );

  if (!detailUrl) return page.url();

  await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 120_000 });
  await acceptCookieBanner(page);
  await selectStandardQuantityMode(page);
  return page.url();
}

async function extractRowsForFormat(page, formatConfig) {
  await page.goto(formatConfig.url, { waitUntil: "networkidle", timeout: 120_000 });
  await acceptCookieBanner(page);
  await selectStandardQuantityMode(page);

  const detailUrl = await resolveDetailUrlIfCategory(page);

  const rawMaterialOptions = await extractMaterialOptions(page);
  const materialOptions = rawMaterialOptions
    .map((item) => ({ value: item.value, label: normalizeLabel(item.label) }))
    .filter((item) => item.value && item.label)
    .filter((item) => !/^bitte/i.test(item.label));

  const extractedRows = [];
  const missingEntries = [];

  for (const targetMaterial of TARGET_MATERIALS) {
    const matchedMaterial = findMaterialOption(materialOptions, targetMaterial);

    if (!matchedMaterial) {
      missingEntries.push({
        format: formatConfig.label,
        material: targetMaterial.label,
        reason: "material_not_found",
      });
      continue;
    }

    await withRetry(async () => {
      await page.selectOption("#sorten", matchedMaterial.value);
      await page.waitForTimeout(1300);
    }, 3);

    const qtyTexts = await extractQuantityTexts(page);
    const perQuantity = new Map();

    qtyTexts.forEach((text) => {
      const parsed = parseQuantityPriceText(text);
      if (!parsed) return;
      if (!TARGET_QUANTITIES.includes(parsed.quantity)) return;

      perQuantity.set(parsed.quantity, {
        formatKey: formatConfig.key,
        formatLabel: formatConfig.label,
        formatWidthMm: formatConfig.widthMm,
        formatHeightMm: formatConfig.heightMm,
        materialKey: targetMaterial.key,
        materialLabel: targetMaterial.label,
        sourceMaterialLabel: matchedMaterial.label,
        sourceUrl: detailUrl,
        quantity: parsed.quantity,
        eur: parsed.eur,
        sourceOptionText: text,
      });
    });

    const missingQuantities = TARGET_QUANTITIES.filter((qty) => !perQuantity.has(qty));
    missingQuantities.forEach((quantity) => {
      missingEntries.push({
        format: formatConfig.label,
        material: matchedMaterial.label,
        quantity,
        reason: "quantity_not_found",
      });
    });

    const rows = Array.from(perQuantity.values()).sort((a, b) => a.quantity - b.quantity);
    extractedRows.push(...rows);

    console.log(
      `  [${formatConfig.label}] ${targetMaterial.key.padEnd(20)} -> found ${rows.length
        .toString()
        .padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
    );
  }

  return {
    extractedRows,
    missingEntries,
    detailUrl,
  };
}

function buildTransformedSourceRows(sourceRows) {
  const dedupe = new Map();

  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.eur);
    const key = `${row.formatKey}|${row.materialKey}|${row.quantity}`;

    dedupe.set(key, {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => {
    if (a.formatLabel !== b.formatLabel) return a.formatLabel.localeCompare(b.formatLabel);
    if (a.materialLabel !== b.materialLabel) return a.materialLabel.localeCompare(b.materialLabel);
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedSourceRows) {
  return transformedSourceRows.map((row) => ({
    rowType: "base_material_format",
    formatKey: row.formatKey,
    formatLabel: row.formatLabel,
    formatWidthMm: row.formatWidthMm,
    formatHeightMm: row.formatHeightMm,
    materialKey: row.materialKey,
    materialLabel: row.materialLabel,
    quantity: row.quantity,
    eur: row.eur,
    dkkBase: row.dkkBase,
    tierMultiplier: row.tierMultiplier,
    dkkFinal: row.dkkFinal,
    sourceMaterialLabel: row.sourceMaterialLabel,
    sourceUrl: row.sourceUrl,
    sourceOptionText: row.sourceOptionText,
  }));
}

function serializeCsv(rows) {
  const header = [
    "row_type",
    "format_key",
    "format_label",
    "material_key",
    "material",
    "quantity",
    "eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "source_material",
    "detail_url",
  ];

  const lines = [header.join(",")];

  rows.forEach((row) => {
    const fields = [
      row.rowType,
      row.formatKey,
      row.formatLabel,
      row.materialKey,
      row.materialLabel,
      row.quantity,
      row.eur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.sourceMaterialLabel,
      row.sourceUrl,
    ].map((value) => {
      const text = String(value ?? "");
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
  const rows = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.extracted_rows)
      ? payload.extracted_rows
      : [];

  return rows
    .map((row) => {
      const formatKey = normalizeLabel(row.formatKey || "");
      const formatLabel = normalizeLabel(row.formatLabel || "");
      const materialKey = normalizeLabel(row.materialKey || "");
      const materialLabel = normalizeLabel(row.materialLabel || row.sourceMaterialLabel || "");
      const quantity = Number(row.quantity);
      const eur = Number(row.eur);

      if (!formatKey || !formatLabel || !materialKey || !materialLabel) return null;
      if (!Number.isFinite(quantity) || !Number.isFinite(eur)) return null;

      return {
        formatKey,
        formatLabel,
        formatWidthMm: Number(row.formatWidthMm) || null,
        formatHeightMm: Number(row.formatHeightMm) || null,
        materialKey,
        materialLabel,
        sourceMaterialLabel: normalizeLabel(row.sourceMaterialLabel || materialLabel),
        sourceUrl: String(row.sourceUrl || ""),
        quantity,
        eur,
        sourceOptionText: String(row.sourceOptionText || ""),
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
    throw new Error("Missing Supabase env. Expected VITE_SUPABASE_URL and a Supabase key.");
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
      icon_text: "Roll Up",
      description: SHORT_DESCRIPTION_DA,
      about_title: ABOUT_TITLE_DA,
      about_description: ABOUT_DESCRIPTION_DA,
      category: DEFAULT_CATEGORY,
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: {
        width_mm: 1000,
        height_mm: 2000,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: "Roll up 100 x 200 cm",
        import_script: "fetch-premium-rollups-import.js",
        product_details_da: ABOUT_DESCRIPTION_DA,
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

async function ensureGroup(client, context, { name, kind, sortOrder, uiMode = "buttons" }) {
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
      ui_mode: uiMode,
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

function buildPricingStructure({ materialGroup, materialValues, formatGroup, formatValues, quantities }) {
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
    ],
    quantities,
  };
}

async function importToSupabase({ tenantId, productName, productSlug, mappedRows, sourceUrlsByFormat, dryRun }) {
  if (mappedRows.length === 0) {
    throw new Error("No mapped rows to import.");
  }

  const activeMaterials = Array.from(new Set(mappedRows.map((row) => row.materialLabel)));
  const activeFormats = Array.from(new Set(mappedRows.map((row) => row.formatLabel)));
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      uniqueMaterials: activeMaterials.length,
      uniqueFormats: activeFormats.length,
      quantities,
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
    uiMode: "buttons",
  });

  const materialGroup = await ensureGroup(client, context, {
    name: "Materiale",
    kind: "material",
    sortOrder: 1,
    uiMode: "buttons",
  });

  const formatMap = new Map();
  for (const formatConfig of SOURCE_FORMATS) {
    const value = await ensureValue(client, context, formatGroup, formatConfig.label, {
      widthMm: formatConfig.widthMm,
      heightMm: formatConfig.heightMm,
    });
    formatMap.set(formatConfig.label, value);
  }

  const materialMap = new Map();
  for (const materialLabel of activeMaterials) {
    const value = await ensureValue(client, context, materialGroup, materialLabel);
    materialMap.set(materialLabel, value);
  }

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValues: activeMaterials.map((name) => materialMap.get(name)).filter(Boolean),
    formatGroup,
    formatValues: activeFormats.map((name) => formatMap.get(name)).filter(Boolean),
    quantities,
  });

  const dedupeRows = new Map();

  mappedRows.forEach((row) => {
    const materialValue = materialMap.get(row.materialLabel);
    const formatValue = formatMap.get(row.formatLabel);
    if (!materialValue || !formatValue) return;

    const variantName = formatValue.id;

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
        selectionMap: {
          format: formatValue.id,
          material: materialValue.id,
        },
        source: "premium_rollups_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceMaterialLabel: row.sourceMaterialLabel,
        sourceFormatLabel: row.formatLabel,
        rowType: row.rowType,
        eur: row.eur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
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
      description: SHORT_DESCRIPTION_DA,
      about_title: ABOUT_TITLE_DA,
      about_description: ABOUT_DESCRIPTION_DA,
      category: DEFAULT_CATEGORY,
      pricing_type: "matrix",
      pricing_structure: pricingStructure,
      technical_specs: {
        width_mm: 1000,
        height_mm: 2000,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: "Roll up 100 x 200 cm",
        import_script: "fetch-premium-rollups-import.js",
        product_details_da: ABOUT_DESCRIPTION_DA,
        source_urls: sourceUrlsByFormat,
      },
    })
    .eq("id", ensured.product.id);

  if (productUpdateError) throw productUpdateError;

  const { error: deleteError } = await client
    .from("generic_product_prices")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("product_id", ensured.product.id);

  if (deleteError) throw deleteError;

  const chunkSize = 500;
  let inserted = 0;

  for (let i = 0; i < priceRows.length; i += chunkSize) {
    const chunk = priceRows.slice(i, i + chunkSize);
    const { error: insertError } = await client.from("generic_product_prices").insert(chunk);
    if (insertError) throw insertError;
    inserted += chunk.length;
  }

  return {
    dryRun: false,
    productId: ensured.product.id,
    productSlug,
    productCreated: ensured.created,
    rowsInserted: inserted,
    uniqueMaterials: activeMaterials.length,
    uniqueFormats: activeFormats.length,
    quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Premium Rollups Import ===");
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  let extractedRows = [];
  let missingEntries = [];
  const sourceUrlsByFormat = {};

  if (args.fromTargetedJson) {
    extractedRows = loadSourceRowsFromTargetedJson(args.fromTargetedJson);
  } else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      for (const formatConfig of SOURCE_FORMATS) {
        const result = await extractRowsForFormat(page, formatConfig);
        extractedRows.push(...result.extractedRows);
        missingEntries.push(...result.missingEntries);
        sourceUrlsByFormat[formatConfig.key] = result.detailUrl;
      }
    } finally {
      await browser.close();
    }
  }

  if (!extractedRows || extractedRows.length === 0) {
    throw new Error("No source rows extracted from supplier pages.");
  }

  const transformedRows = buildTransformedSourceRows(extractedRows);
  const mappedRows = buildMappedRows(transformedRows);

  // If importing from prebuilt json, recover source URL mapping from rows.
  if (args.fromTargetedJson) {
    for (const row of mappedRows) {
      const fmt = SOURCE_FORMATS.find((f) => f.label === row.formatLabel);
      if (fmt && row.sourceUrl && !sourceUrlsByFormat[fmt.key]) {
        sourceUrlsByFormat[fmt.key] = row.sourceUrl;
      }
    }
  }

  const ts = timestampForFile();
  const slugDir = kebabCase(args.productSlug || "premium-rollups");

  ensureDir(path.join(process.cwd(), "pricing_raw", slugDir));
  ensureDir(path.join(process.cwd(), "pricing_clean", slugDir));

  const rawPath = path.join(process.cwd(), "pricing_raw", slugDir, `${ts}.json`);
  const cleanPath = path.join(process.cwd(), "pricing_clean", slugDir, `${ts}.csv`);

  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      {
        timestamp: ts,
        product: {
          name: args.productName,
          slug: args.productSlug,
          tenant_id: args.tenantId,
        },
        formats: SOURCE_FORMATS,
        materials: TARGET_MATERIALS,
        target_quantities: TARGET_QUANTITIES,
        source_urls: sourceUrlsByFormat,
        extracted_rows: transformedRows,
        missing_entries: missingEntries,
      },
      null,
      2
    )
  );

  fs.writeFileSync(cleanPath, serializeCsv(mappedRows));

  const result = await importToSupabase({
    tenantId: args.tenantId,
    productName: args.productName,
    productSlug: args.productSlug,
    mappedRows,
    sourceUrlsByFormat,
    dryRun: args.dryRun,
  });

  console.log("");
  console.log("=== Snapshot Files ===");
  console.log(`Raw JSON:   ${path.relative(process.cwd(), rawPath)}`);
  console.log(`Clean CSV:  ${path.relative(process.cwd(), cleanPath)}`);

  console.log("");
  console.log("=== Import Result ===");
  console.log(JSON.stringify(result, null, 2));

  if (missingEntries.length > 0) {
    console.log("");
    console.log("Missing entries detected:");
    missingEntries.forEach((entry) => {
      console.log(`- ${entry.format} | ${entry.material} | ${entry.reason}${entry.quantity ? ` | qty ${entry.quantity}` : ""}`);
    });
  }
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
