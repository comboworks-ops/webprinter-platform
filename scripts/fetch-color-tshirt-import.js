#!/usr/bin/env node
/**
 * fetch-color-tshirt-import.mjs
 *
 * Imports matrix pricing from wir-machen-druck:
 *   https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-einer-druckposition.html
 *
 * Product:
 *   - Name: Color T-shirts
 *   - Vertical axis: material (single value)
 *   - Hidden format: Standard
 *   - Buttons: Siebdruck - 1/0, 2/0, 3/0, 4/0 farbig
 *   - Selector: T-shirt color (non-pricing)
 *   - Selector: print position (4 positions from supplier dropdown)
 *   - Quantities:
 *       25,30,35,40,45,50,55,60,65,70,75,100,125,150,200,250,300,400,500,700,1000
 *
 * Notes:
 *   Supplier quantity labels expose EUR per shirt. This importer converts to total EUR per quantity
 *   before DKK transform/tier markup:
 *     total_eur = unit_eur * quantity
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
import { buildTshirtTechnicalSpecs } from "./product-import/tshirt-size-distribution-lock.js";
import { CONVERSION_RULES, applyConversionRule } from "./product-import/shared/conversion.js";
import { createNormalizedMatrixRecord } from "./product-import/shared/normalized-pricing.js";
import { publishNormalizedMatrixProduct } from "./product-import/shared/matrix-publisher.js";

const SOURCE_URL =
  "https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-einer-druckposition.html";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Color T-shirts";
const DEFAULT_PRODUCT_SLUG = "color-t-shirts";
const DEFAULT_FORMAT_LABEL = "Standard";
const DEFAULT_WIDTH_MM = 300;
const DEFAULT_HEIGHT_MM = 400;

const TARGET_QUANTITIES = [
  25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75,
  100, 125, 150, 200, 250, 300, 400, 500, 700, 1000,
];

const TARGET_MATERIAL = "T-Shirt Herren Budget, farbig - Fruit of the Loom";

const TARGET_PRINT_MODES = [
  {
    sourceLabel: "Alle T-Shirts gleiches Motiv: hochwertiger Siebdruck - 1/0-farbig",
    displayLabel: "Siebdruck - 1/0-farbig",
  },
  {
    sourceLabel: "Alle T-Shirts gleiches Motiv: hochwertiger Siebdruck - 2/0-farbig",
    displayLabel: "Siebdruck - 2/0-farbig",
  },
  {
    sourceLabel: "Alle T-Shirts gleiches Motiv: hochwertiger Siebdruck - 3/0-farbig",
    displayLabel: "Siebdruck - 3/0-farbig",
  },
  {
    sourceLabel: "Alle T-Shirts gleiches Motiv: hochwertiger Siebdruck - 4/0-farbig",
    displayLabel: "Siebdruck - 4/0-farbig",
  },
];

const EUR_TO_DKK = 7.6;
const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-color-tshirt-import.mjs import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--url <supplier-url>] [--format-label <format>] [--width-mm <num>] [--height-mm <num>] [--from-targeted-json <path>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || "",
    dryRun: argv.includes("--dry-run"),
    tenantId: DEFAULT_TENANT_ID,
    productName: DEFAULT_PRODUCT_NAME,
    productSlug: DEFAULT_PRODUCT_SLUG,
    sourceUrl: SOURCE_URL,
    formatLabel: DEFAULT_FORMAT_LABEL,
    widthMm: DEFAULT_WIDTH_MM,
    heightMm: DEFAULT_HEIGHT_MM,
    fromTargetedJson: null,
  };

  const tenantIdx = argv.indexOf("--tenant");
  if (tenantIdx !== -1 && argv[tenantIdx + 1]) args.tenantId = argv[tenantIdx + 1];

  const nameIdx = argv.indexOf("--name");
  if (nameIdx !== -1 && argv[nameIdx + 1]) args.productName = argv[nameIdx + 1];

  const slugIdx = argv.indexOf("--slug");
  if (slugIdx !== -1 && argv[slugIdx + 1]) args.productSlug = argv[slugIdx + 1];

  const urlIdx = argv.indexOf("--url");
  if (urlIdx !== -1 && argv[urlIdx + 1]) args.sourceUrl = argv[urlIdx + 1];

  const formatIdx = argv.indexOf("--format-label");
  if (formatIdx !== -1 && argv[formatIdx + 1]) args.formatLabel = argv[formatIdx + 1];

  const widthIdx = argv.indexOf("--width-mm");
  if (widthIdx !== -1 && argv[widthIdx + 1]) {
    const parsed = Number(argv[widthIdx + 1]);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("--width-mm must be positive");
    args.widthMm = parsed;
  }

  const heightIdx = argv.indexOf("--height-mm");
  if (heightIdx !== -1 && argv[heightIdx + 1]) {
    const parsed = Number(argv[heightIdx + 1]);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("--height-mm must be positive");
    args.heightMm = parsed;
  }

  const fromIdx = argv.indexOf("--from-targeted-json");
  if (fromIdx !== -1 && argv[fromIdx + 1]) args.fromTargetedJson = argv[fromIdx + 1];

  return args;
}

function normalizeLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function kebabCase(text) {
  return normalizeLabel(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseQuantityPerUnitText(text) {
  const raw = normalizeLabel(text);
  if (!raw) return null;

  const qtyMatch = raw.match(/([\d.]+)\s*St(?:ü|u)ck/i);
  if (!qtyMatch) return null;
  const quantity = Number(String(qtyMatch[1]).replace(/[^\d]/g, ""));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const unitEurMatch = raw.match(/\(([-+]?\d[\d.,]*)\s*Euro\s*netto/i);
  if (!unitEurMatch) return null;
  const unitEur = parseLocalizedNumber(unitEurMatch[1]);
  if (!Number.isFinite(unitEur) || unitEur <= 0) return null;

  const totalEur = Number((unitEur * quantity).toFixed(4));
  return { quantity, unitEur, totalEur };
}

function transformedPrice(totalEur) {
  const converted = applyConversionRule(totalEur, CONVERSION_RULES.wmd_tiered_fx_7_6);
  return {
    dkkBase: converted.convertedPriceDkk,
    tierMultiplier: converted.tierMultiplier,
    dkkFinal: converted.finalPriceDkk,
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

async function acceptCookies(page) {
  try {
    await page
      .locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler")
      .click({ timeout: 4_000 });
  } catch {
    // banner not visible
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
  await page.waitForTimeout(500);
}

function parseSelectFields(fields) {
  return fields
    .map((field) => ({
      ...field,
      options: field.options
        .map((opt) => ({
          value: String(opt.value || ""),
          label: normalizeLabel(opt.label),
        }))
        .filter((opt) => opt.value),
    }))
    .filter((field) => field.options.length > 0);
}

async function detectSelectFields(page) {
  const fields = await page.$$eval("select", (nodes) =>
    nodes
      .map((node) => ({
        id: node.id || "",
        name: node.getAttribute("name") || "",
        options: Array.from(node.querySelectorAll("option")).map((o) => ({
          value: o.getAttribute("value") || "",
          label: (o.textContent || "").trim(),
        })),
      }))
      .filter((row) => row.options.length > 0)
  );
  return parseSelectFields(fields);
}

function isPlaceholderLabel(label) {
  return /bitte ausw/i.test(label);
}

function getUsableOptions(field) {
  return (field?.options || []).filter((opt) => !isPlaceholderLabel(opt.label));
}

function detectPositionField(fields) {
  const byContent = fields.find((field) =>
    getUsableOptions(field).some((opt) => /bedruckt/i.test(opt.label))
  );
  if (byContent) return byContent;

  const byName = fields.find((field) => /^zusatzfeld\[\d+\]$/.test(field.name));
  if (byName) return byName;

  return null;
}

function detectColorField(fields, positionFieldName) {
  const candidates = fields.filter((field) => field.name && field.name !== positionFieldName);

  const byPantone = candidates.find((field) =>
    getUsableOptions(field).some((opt) => /pantone/i.test(opt.label))
  );
  if (byPantone) return byPantone;

  const byFallback = candidates.find((field) => {
    const options = getUsableOptions(field);
    if (options.length < 2) return false;
    const hasBedruckt = options.some((opt) => /bedruckt/i.test(opt.label));
    return !hasBedruckt;
  });
  if (byFallback) return byFallback;

  return null;
}

async function extractTargetedRows(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "networkidle", timeout: 120_000 });
  await acceptCookies(page);
  await selectStandardQuantityMode(page);

  const sortenOptions = await withRetry(
    () =>
      page.$$eval("#sorten option", (nodes) =>
        nodes
          .map((node) => ({
            value: node.getAttribute("value") || "",
            label: (node.textContent || "").trim(),
          }))
          .filter((row) => row.value && row.label)
      ),
    3
  );

  const sortenByLabel = new Map(
    sortenOptions.map((opt) => [normalizeLabel(opt.label), String(opt.value)])
  );

  const missingModes = TARGET_PRINT_MODES.filter((mode) => !sortenByLabel.has(mode.sourceLabel));
  if (missingModes.length > 0) {
    throw new Error(
      `Missing required print-mode options: ${missingModes.map((m) => m.sourceLabel).join(" | ")}`
    );
  }

  const selectFields = await detectSelectFields(page);
  const positionField = detectPositionField(selectFields);
  if (!positionField || !positionField.name) {
    throw new Error("Could not detect print-position selector (zusatzfeld field) on supplier page.");
  }

  const colorField = detectColorField(selectFields, positionField.name);
  if (!colorField || !colorField.name) {
    throw new Error("Could not detect T-shirt color selector (zusatzfeld field) on supplier page.");
  }

  const positionOptions = getUsableOptions(positionField);
  const tshirtColorOptions = getUsableOptions(colorField);

  if (positionOptions.length === 0) {
    throw new Error("No usable print-position options found.");
  }
  if (tshirtColorOptions.length === 0) {
    throw new Error("No usable T-shirt color options found.");
  }

  const extractionColor = tshirtColorOptions[0];

  const extractedRows = [];
  const missingByCombination = [];

  for (const mode of TARGET_PRINT_MODES) {
    const modeValue = sortenByLabel.get(mode.sourceLabel);
    if (!modeValue) continue;

    await withRetry(async () => {
      await page.selectOption("#sorten", modeValue);
      await page.waitForTimeout(900);
    }, 3);

    await withRetry(async () => {
      await page.selectOption(`select[name='${colorField.name}']`, extractionColor.value);
      await page.waitForTimeout(900);
    }, 3);

    for (const position of positionOptions) {
      await withRetry(async () => {
        await page.selectOption(`select[name='${positionField.name}']`, position.value);
        await page.waitForTimeout(900);
      }, 3);

      const qtyTexts = await withRetry(
        () =>
          page.$$eval("#wmd_shirt_auflage option", (nodes) =>
            Array.from(new Set(nodes.map((node) => (node.textContent || "").trim()).filter(Boolean)))
          ),
        3
      );

      const perCombination = new Map();
      qtyTexts.forEach((text) => {
        const parsed = parseQuantityPerUnitText(text);
        if (!parsed) return;
        if (!TARGET_QUANTITIES.includes(parsed.quantity)) return;
        perCombination.set(parsed.quantity, {
          materialLabel: TARGET_MATERIAL,
          printModeLabel: mode.displayLabel,
          printPositionLabel: position.label,
          quantity: parsed.quantity,
          unitEur: parsed.unitEur,
          totalEur: parsed.totalEur,
          sourceModeLabel: mode.sourceLabel,
          sourceModeValue: modeValue,
          sourcePositionLabel: position.label,
          sourcePositionValue: position.value,
          sourceColorLabel: extractionColor.label,
          sourceColorValue: extractionColor.value,
          sourceOptionText: text,
        });
      });

      const rows = Array.from(perCombination.values()).sort((a, b) => a.quantity - b.quantity);
      extractedRows.push(...rows);

      const missingQuantities = TARGET_QUANTITIES.filter((qty) => !perCombination.has(qty));
      if (missingQuantities.length > 0) {
        missingByCombination.push({
          printModeLabel: mode.displayLabel,
          printPositionLabel: position.label,
          missingQuantities,
        });
      }

      console.log(
        `  ${mode.displayLabel.padEnd(24)} | ${position.label.substring(0, 48).padEnd(48)} | ${
          extractionColor.label.substring(0, 28).padEnd(28)
        } -> ${String(rows.length).padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
      );
    }
  }

  return {
    extractedRows,
    materialLabel: TARGET_MATERIAL,
    printModes: TARGET_PRINT_MODES.map((mode) => mode.displayLabel),
    printPositions: positionOptions.map((position) => position.label),
    tshirtColors: tshirtColorOptions.map((color) => color.label),
    positionFieldName: positionField.name,
    colorFieldName: colorField.name,
    extractionColorLabel: extractionColor.label,
    missingByCombination,
  };
}

function buildTransformedSourceRows(sourceRows) {
  const dedupe = new Map();
  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.totalEur);
    const key = `${row.materialLabel}||${row.printModeLabel}||${row.printPositionLabel}||${row.quantity}`;
    dedupe.set(key, {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => {
    if (a.printModeLabel !== b.printModeLabel) return a.printModeLabel.localeCompare(b.printModeLabel);
    if (a.printPositionLabel !== b.printPositionLabel)
      return a.printPositionLabel.localeCompare(b.printPositionLabel);
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedRows, { formatLabel, sourceUrl, tshirtColors }) {
  const mappedRows = [];
  const normalizedColors =
    Array.isArray(tshirtColors) && tshirtColors.length > 0
      ? tshirtColors.map((label) => normalizeLabel(label)).filter(Boolean)
      : ["Standard"];

  transformedRows.forEach((row) => {
    normalizedColors.forEach((tshirtColorLabel) => {
      mappedRows.push({
        rowType: "color_tshirt",
        formatLabel,
        materialLabel: row.materialLabel,
        printModeLabel: row.printModeLabel,
        printPositionLabel: row.printPositionLabel,
        tshirtColorLabel,
        quantity: row.quantity,
        unitEur: row.unitEur,
        totalEur: row.totalEur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
        dkkFinal: row.dkkFinal,
        sourceModeLabel: row.sourceModeLabel,
        sourceModeValue: row.sourceModeValue,
        sourcePositionLabel: row.sourcePositionLabel,
        sourcePositionValue: row.sourcePositionValue,
        sourceColorLabel: row.sourceColorLabel || tshirtColorLabel,
        sourceColorValue: row.sourceColorValue || "",
        sourceUrl,
      });
    });
  });

  return mappedRows;
}

function serializeCsv(rows) {
  const header = [
    "row_type",
    "format",
    "material",
    "print_mode",
    "print_position",
    "tshirt_color",
    "quantity",
    "unit_eur",
    "total_eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "source_mode_label",
    "source_position_label",
    "source_color_label",
    "detail_url",
  ];

  const lines = [header.join(",")];
  rows.forEach((row) => {
    const fields = [
      row.rowType,
      row.formatLabel,
      row.materialLabel,
      row.printModeLabel,
      row.printPositionLabel,
      row.tshirtColorLabel,
      row.quantity,
      row.unitEur,
      row.totalEur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.sourceModeLabel || "",
      row.sourcePositionLabel || "",
      row.sourceColorLabel || "",
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
  const rows = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.extracted_rows)
      ? payload.extracted_rows
      : [];

  return rows
    .map((row) => {
      const materialLabel = normalizeLabel(row.materialLabel || TARGET_MATERIAL);
      const printModeLabel = normalizeLabel(row.printModeLabel || "");
      const printPositionLabel = normalizeLabel(row.printPositionLabel || "");
      const tshirtColorLabel = normalizeLabel(row.tshirtColorLabel || row.sourceColorLabel || "");
      const quantity = Number(row.quantity);
      const unitEur = Number(row.unitEur);
      const totalEur = Number(row.totalEur);

      if (
        !materialLabel ||
        !printModeLabel ||
        !printPositionLabel ||
        !tshirtColorLabel ||
        !Number.isFinite(quantity) ||
        !Number.isFinite(unitEur) ||
        !Number.isFinite(totalEur)
      ) {
        return null;
      }

      return {
        materialLabel,
        printModeLabel,
        printPositionLabel,
        tshirtColorLabel,
        quantity,
        unitEur,
        totalEur,
        sourceModeLabel: row.sourceModeLabel || "",
        sourceModeValue: row.sourceModeValue || "",
        sourcePositionLabel: row.sourcePositionLabel || "",
        sourcePositionValue: row.sourcePositionValue || "",
        sourceColorLabel: row.sourceColorLabel || tshirtColorLabel,
        sourceColorValue: row.sourceColorValue || "",
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
  if (!url || !key) throw new Error("Missing Supabase env vars.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureProduct(client, tenantId, productName, productSlug, { formatLabel, widthMm, heightMm }) {
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
      icon_text: "T-shirt",
      description: "Color T-shirts - auto-imported from wir-machen-druck.de",
      category: "tekstiltryk",
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: buildTshirtTechnicalSpecs({ widthMm, heightMm, formatLabel }),
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
  const existing = (group.values || []).find(
    (value) => String(value.name || "").toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) return existing;

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
  materialValue,
  formatGroup,
  formatValue,
  printModeGroup,
  printModeValues,
  printPositionGroup,
  printPositionValues,
  tshirtColorGroup,
  tshirtColorValues,
  quantities,
}) {
  return {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {
      sectionId: "vertical-axis",
      sectionType: "materials",
      groupId: materialGroup.id,
      valueIds: [materialValue.id],
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
            valueIds: [formatValue.id],
            ui_mode: "hidden",
            selection_mode: "required",
            valueSettings: {},
            title: "Format",
            description: "",
          },
        ],
      },
      {
        id: "row-print-mode",
        title: "",
        description: "",
        columns: [
          {
            id: "print-mode-section",
            sectionType: "finishes",
            groupId: printModeGroup.id,
            valueIds: printModeValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Trykfarve",
            description: "",
          },
        ],
      },
      {
        id: "row-print-position",
        title: "",
        description: "",
        columns: [
          {
            id: "print-position-section",
            sectionType: "finishes",
            groupId: printPositionGroup.id,
            valueIds: printPositionValues.map((value) => value.id),
            ui_mode: "dropdown",
            selection_mode: "required",
            valueSettings: {},
            title: "Trykposition",
            description: "",
          },
        ],
      },
      {
        id: "row-tshirt-color",
        title: "",
        description: "",
        columns: [
          {
            id: "tshirt-color-section",
            sectionType: "finishes",
            groupId: tshirtColorGroup.id,
            valueIds: tshirtColorValues.map((value) => value.id),
            ui_mode: "dropdown",
            selection_mode: "required",
            valueSettings: {},
            title: "T-shirt farve",
            description: "",
          },
        ],
      },
    ],
    quantities,
  };
}

async function importToSupabase({
  tenantId,
  productName,
  productSlug,
  formatLabel,
  widthMm,
  heightMm,
  mappedRows,
  dryRun,
}) {
  if (mappedRows.length === 0) throw new Error("No mapped rows to import.");

  const activePrintModes = Array.from(new Set(mappedRows.map((row) => row.printModeLabel))).sort();
  const activePrintPositions = Array.from(new Set(mappedRows.map((row) => row.printPositionLabel))).sort();
  const activeTshirtColors = Array.from(new Set(mappedRows.map((row) => row.tshirtColorLabel))).sort();
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);
  const normalizedRows = mappedRows.map((row) =>
    createNormalizedMatrixRecord({
      supplier: "wir-machen-druck",
      sourceType: "playwright",
      importerKey: "color_tshirt_fetch_import",
      productFamily: "tshirt",
      sourceUrl: row.sourceUrl,
      supplierProductType: "color-tshirt",
      quantity: row.quantity,
      supplierCurrency: "EUR",
      supplierPrice: row.totalEur,
      convertedPriceDkk: row.dkkBase,
      finalPriceDkk: row.dkkFinal,
      conversionRuleKey: CONVERSION_RULES.wmd_tiered_fx_7_6.key,
      selections: {
        material: TARGET_MATERIAL,
        format: formatLabel,
        printMode: row.printModeLabel,
        printPosition: row.printPositionLabel,
        tshirtColor: row.tshirtColorLabel,
      },
      extraData: {
        source: "color_tshirt_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceModeLabel: row.sourceModeLabel,
        sourceModeValue: row.sourceModeValue,
        sourcePositionLabel: row.sourcePositionLabel,
        sourcePositionValue: row.sourcePositionValue,
        sourceColorLabel: row.sourceColorLabel,
        sourceColorValue: row.sourceColorValue,
        unitEur: row.unitEur,
        totalEur: row.totalEur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
      },
      rawPayload: {
        sourceModeValue: row.sourceModeValue,
        sourcePositionValue: row.sourcePositionValue,
        sourceColorValue: row.sourceColorValue,
      },
    })
  );

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: normalizedRows.length,
      uniquePrintModes: activePrintModes.length,
      uniquePrintPositions: activePrintPositions.length,
      uniqueTshirtColors: activeTshirtColors.length,
      quantities,
    };
  }

  const client = getSupabaseClient();
  const ensured = await ensureProduct(client, tenantId, productName, productSlug, {
    formatLabel,
    widthMm,
    heightMm,
  });
  const result = await publishNormalizedMatrixProduct({
    client,
    tenantId,
    productId: ensured.product.id,
    deleteByTenant: true,
    matrixConfig: {
      verticalAxis: {
        key: "material",
        groupName: "Materiale",
        kind: "material",
        sectionType: "materials",
        sortOrder: 1,
        sectionId: "vertical-axis",
        uiMode: "buttons",
        title: "Materiale",
        description: "",
        selectionMapKey: "material",
        extraDataIdField: "materialId",
        valueSpecs: [{ name: TARGET_MATERIAL }],
      },
      sections: [
        {
          key: "format",
          rowId: "row-format",
          sectionId: "format-section",
          groupName: "Format",
          kind: "format",
          sectionType: "formats",
          sortOrder: 0,
          uiMode: "hidden",
          selectionMode: "required",
          title: "Format",
          description: "",
          selectionMapKey: "format",
          extraDataIdField: "formatId",
          requireDimensions: true,
          valueSpecs: [{ name: formatLabel, widthMm, heightMm }],
        },
        {
          key: "printMode",
          rowId: "row-print-mode",
          sectionId: "print-mode-section",
          groupName: "Silketryk",
          kind: "finish",
          sectionType: "finishes",
          sortOrder: 2,
          uiMode: "buttons",
          selectionMode: "required",
          title: "Trykfarve",
          description: "",
          selectionMapKey: "printMode",
          extraDataIdField: "printModeId",
          isVariantDimension: true,
          valueSpecs: activePrintModes.map((name) => ({ name })),
        },
        {
          key: "printPosition",
          rowId: "row-print-position",
          sectionId: "print-position-section",
          groupName: "Trykposition",
          kind: "finish",
          sectionType: "finishes",
          sortOrder: 3,
          uiMode: "dropdown",
          selectionMode: "required",
          title: "Trykposition",
          description: "",
          selectionMapKey: "printPosition",
          extraDataIdField: "printPositionId",
          isVariantDimension: true,
          valueSpecs: activePrintPositions.map((name) => ({ name })),
        },
        {
          key: "tshirtColor",
          rowId: "row-tshirt-color",
          sectionId: "tshirt-color-section",
          groupName: "T-shirt farve",
          kind: "finish",
          sectionType: "finishes",
          sortOrder: 4,
          uiMode: "dropdown",
          selectionMode: "required",
          title: "T-shirt farve",
          description: "",
          selectionMapKey: "tshirtColor",
          extraDataIdField: "tshirtColorId",
          isVariantDimension: true,
          valueSpecs: activeTshirtColors.map((name) => ({ name })),
        },
      ],
    },
    normalizedRows,
    productUpdate: {
      name: productName,
      slug: productSlug,
      category: "tekstiltryk",
      technical_specs: buildTshirtTechnicalSpecs({ widthMm, heightMm, formatLabel }),
    },
  });

  return {
    dryRun: false,
    productId: ensured.product.id,
    productSlug,
    productCreated: ensured.created,
    rowsInserted: result.rowsInserted,
    uniquePrintModes: activePrintModes.length,
    uniquePrintPositions: activePrintPositions.length,
    uniqueTshirtColors: activeTshirtColors.length,
    quantities: result.quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Color T-shirts Import ===");
  console.log(`Source URL: ${args.sourceUrl}`);
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  let extractionMeta = {
    materialLabel: TARGET_MATERIAL,
    printModes: TARGET_PRINT_MODES.map((mode) => mode.displayLabel),
    printPositions: [],
    tshirtColors: [],
    positionFieldName: "",
    colorFieldName: "",
    extractionColorLabel: "",
    missingByCombination: [],
  };
  let extractedRows;

  if (args.fromTargetedJson) {
    extractedRows = loadSourceRowsFromTargetedJson(args.fromTargetedJson);
  } else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      const extractionResult = await extractTargetedRows(page, args.sourceUrl);
      extractedRows = extractionResult.extractedRows;
      extractionMeta = extractionResult;
    } finally {
      await browser.close();
    }
  }

  if (!extractedRows || extractedRows.length === 0) {
    throw new Error("No source rows extracted from supplier page.");
  }

  const transformedRows = buildTransformedSourceRows(extractedRows);
  const mappedRows = buildMappedRows(transformedRows, {
    formatLabel: args.formatLabel,
    sourceUrl: args.sourceUrl,
    tshirtColors: extractionMeta.tshirtColors,
  });

  const ts = timestampForFile();
  const slugDir = kebabCase(args.productSlug || "color-t-shirts");
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
          format: args.formatLabel,
          source_url: args.sourceUrl,
        },
        material_label: extractionMeta.materialLabel || TARGET_MATERIAL,
        print_modes: extractionMeta.printModes || TARGET_PRINT_MODES.map((mode) => mode.displayLabel),
        print_positions: extractionMeta.printPositions || [],
        tshirt_colors: extractionMeta.tshirtColors || [],
        position_field_name: extractionMeta.positionFieldName || "",
        color_field_name: extractionMeta.colorFieldName || "",
        extraction_color_label: extractionMeta.extractionColorLabel || "",
        missing_by_combination: extractionMeta.missingByCombination || [],
        extracted_rows: transformedRows,
      },
      null,
      2
    )
  );
  fs.writeFileSync(cleanPath, serializeCsv(mappedRows));

  console.log(`Raw snapshot: ${path.relative(process.cwd(), rawPath)}`);
  console.log(`Clean CSV: ${path.relative(process.cwd(), cleanPath)}`);
  console.log(`Mapped rows: ${mappedRows.length}`);

  const result = await importToSupabase({
    tenantId: args.tenantId,
    productName: args.productName,
    productSlug: args.productSlug,
    formatLabel: args.formatLabel,
    widthMm: args.widthMm,
    heightMm: args.heightMm,
    mappedRows,
    dryRun: args.dryRun,
  });

  if (result.dryRun) {
    console.log("Dry-run complete (no DB writes).");
    console.log(`  Product slug: ${result.productSlug}`);
    console.log(`  Rows prepared: ${result.rowsPrepared}`);
    console.log(`  Print modes: ${result.uniquePrintModes}`);
    console.log(`  Print positions: ${result.uniquePrintPositions}`);
    console.log(`  T-shirt colors: ${result.uniqueTshirtColors}`);
    console.log(`  Quantities: ${result.quantities.join(", ")}`);
    return;
  }

  console.log("Import complete.");
  console.log(`  Product ID: ${result.productId}`);
  console.log(`  Product slug: ${result.productSlug}`);
  console.log(`  Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
  console.log(`  Rows inserted: ${result.rowsInserted}`);
  console.log(`  Print modes: ${result.uniquePrintModes}`);
  console.log(`  Print positions: ${result.uniquePrintPositions}`);
  console.log(`  T-shirt colors: ${result.uniqueTshirtColors}`);
  console.log(`  Quantities: ${result.quantities.join(", ")}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
