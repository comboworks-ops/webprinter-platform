#!/usr/bin/env node
/**
 * fetch-silketryk-tshirt-import.js
 *
 * Imports matrix pricing from wir-machen-druck:
 *   https://www.wir-machen-druck.de/tshirt-herren-budget-weiss-fruit-of-the-loom-mit-einer-druckposition.html
 *
 * Product:
 *   - Name: silketryk t-shirt
 *   - Vertical axis: material (single value)
 *   - Hidden format: Standard
 *   - Buttons: Siebdruck - 1/0, 2/0, 3/0, 4/0 farbig
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

const SOURCE_URL =
  "https://www.wir-machen-druck.de/tshirt-herren-budget-weiss-fruit-of-the-loom-mit-einer-druckposition.html";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "silketryk t-shirt";
const DEFAULT_PRODUCT_SLUG = "silketryk-t-shirt";
const DEFAULT_FORMAT_LABEL = "Standard";
const DEFAULT_WIDTH_MM = 300;
const DEFAULT_HEIGHT_MM = 400;

const TARGET_QUANTITIES = [
  25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75,
  100, 125, 150, 200, 250, 300, 400, 500, 700, 1000,
];

const TARGET_MATERIAL = "T-Shirt Herren Budget, weiß - Fruit of the Loom";

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
    "  node scripts/fetch-silketryk-tshirt-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--url <supplier-url>] [--format-label <format>] [--width-mm <num>] [--height-mm <num>] [--from-targeted-json <path>]",
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
  const dkkBase = totalEur * EUR_TO_DKK;
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

async function detectPositionField(page) {
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

  const byName = fields.find((f) => /^zusatzfeld\[\d+\]$/.test(f.name));
  if (byName) return byName;

  const byContent = fields.find((f) =>
    f.options.some((opt) => /bedruckt/i.test(opt.label))
  );
  if (byContent) return byContent;

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

  const positionField = await detectPositionField(page);
  if (!positionField || !positionField.name) {
    throw new Error("Could not detect print-position selector (zusatzfeld field) on supplier page.");
  }

  const positionOptions = positionField.options
    .map((opt) => ({
      value: String(opt.value || ""),
      label: normalizeLabel(opt.label),
    }))
    .filter((opt) => opt.value && !/bitte ausw/i.test(opt.label));

  if (positionOptions.length === 0) {
    throw new Error("No usable print-position options found.");
  }

  const extractedRows = [];
  const missingByCombination = [];

  for (const mode of TARGET_PRINT_MODES) {
    const modeValue = sortenByLabel.get(mode.sourceLabel);
    if (!modeValue) continue;

    await withRetry(async () => {
      await page.selectOption("#sorten", modeValue);
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
        `  ${mode.displayLabel.padEnd(24)} | ${position.label.substring(0, 58).padEnd(58)} -> ${String(
          rows.length
        ).padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
      );
    }
  }

  return {
    extractedRows,
    materialLabel: TARGET_MATERIAL,
    printModes: TARGET_PRINT_MODES.map((mode) => mode.displayLabel),
    printPositions: positionOptions.map((position) => position.label),
    positionFieldName: positionField.name,
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
    if (a.printPositionLabel !== b.printPositionLabel) return a.printPositionLabel.localeCompare(b.printPositionLabel);
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedRows, { formatLabel, sourceUrl }) {
  return transformedRows.map((row) => ({
    rowType: "silketryk_tshirt",
    formatLabel,
    materialLabel: row.materialLabel,
    printModeLabel: row.printModeLabel,
    printPositionLabel: row.printPositionLabel,
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
    sourceUrl,
  }));
}

function serializeCsv(rows) {
  const header = [
    "row_type",
    "format",
    "material",
    "print_mode",
    "print_position",
    "quantity",
    "unit_eur",
    "total_eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "source_mode_label",
    "source_position_label",
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
      row.quantity,
      row.unitEur,
      row.totalEur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.sourceModeLabel || "",
      row.sourcePositionLabel || "",
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
      const quantity = Number(row.quantity);
      const unitEur = Number(row.unitEur);
      const totalEur = Number(row.totalEur);

      if (
        !materialLabel ||
        !printModeLabel ||
        !printPositionLabel ||
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
        quantity,
        unitEur,
        totalEur,
        sourceModeLabel: row.sourceModeLabel || "",
        sourceModeValue: row.sourceModeValue || "",
        sourcePositionLabel: row.sourcePositionLabel || "",
        sourcePositionValue: row.sourcePositionValue || "",
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
      description: "Silketryk t-shirt - auto-imported from wir-machen-druck.de",
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
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      uniquePrintModes: activePrintModes.length,
      uniquePrintPositions: activePrintPositions.length,
      quantities,
    };
  }

  const client = getSupabaseClient();
  const ensured = await ensureProduct(client, tenantId, productName, productSlug, {
    formatLabel,
    widthMm,
    heightMm,
  });

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
  const printModeGroup = await ensureGroup(client, context, {
    name: "Silketryk",
    kind: "finish",
    sortOrder: 2,
    uiMode: "buttons",
  });
  const printPositionGroup = await ensureGroup(client, context, {
    name: "Trykposition",
    kind: "finish",
    sortOrder: 3,
    uiMode: "dropdown",
  });

  const formatValue = await ensureValue(client, context, formatGroup, formatLabel, {
    widthMm,
    heightMm,
  });
  const materialValue = await ensureValue(client, context, materialGroup, TARGET_MATERIAL);

  const printModeMap = new Map();
  for (const printModeLabel of activePrintModes) {
    printModeMap.set(
      printModeLabel,
      await ensureValue(client, context, printModeGroup, printModeLabel)
    );
  }

  const printPositionMap = new Map();
  for (const printPositionLabel of activePrintPositions) {
    printPositionMap.set(
      printPositionLabel,
      await ensureValue(client, context, printPositionGroup, printPositionLabel)
    );
  }

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValue,
    formatGroup,
    formatValue,
    printModeGroup,
    printModeValues: activePrintModes.map((label) => printModeMap.get(label)).filter(Boolean),
    printPositionGroup,
    printPositionValues: activePrintPositions.map((label) => printPositionMap.get(label)).filter(Boolean),
    quantities,
  });

  const dedupeRows = new Map();
  mappedRows.forEach((row) => {
    const printModeValue = printModeMap.get(row.printModeLabel);
    const printPositionValue = printPositionMap.get(row.printPositionLabel);
    if (!printModeValue || !printPositionValue) return;

    const variantName = [formatValue.id, printModeValue.id, printPositionValue.id].sort().join("|");
    const variantValueIds = [printModeValue.id, printPositionValue.id].sort();

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
        printModeId: printModeValue.id,
        printPositionId: printPositionValue.id,
        variantValueIds,
        selectionMap: {
          format: formatValue.id,
          material: materialValue.id,
          printMode: printModeValue.id,
          printPosition: printPositionValue.id,
          variantValueIds,
        },
        source: "silketryk_tshirt_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceModeLabel: row.sourceModeLabel,
        sourceModeValue: row.sourceModeValue,
        sourcePositionLabel: row.sourcePositionLabel,
        sourcePositionValue: row.sourcePositionValue,
        unitEur: row.unitEur,
        totalEur: row.totalEur,
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
      pricing_type: "matrix",
      pricing_structure: pricingStructure,
      category: "tekstiltryk",
      technical_specs: buildTshirtTechnicalSpecs({ widthMm, heightMm, formatLabel }),
    })
    .eq("id", ensured.product.id);
  if (productUpdateError) throw productUpdateError;

  const { error: deleteError } = await client
    .from("generic_product_prices")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("product_id", ensured.product.id);
  if (deleteError) throw deleteError;

  let inserted = 0;
  for (let i = 0; i < priceRows.length; i += 500) {
    const chunk = priceRows.slice(i, i + 500);
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
    uniquePrintModes: activePrintModes.length,
    uniquePrintPositions: activePrintPositions.length,
    quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Silketryk T-shirt Import ===");
  console.log(`Source URL: ${args.sourceUrl}`);
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  let extractionMeta = {
    materialLabel: TARGET_MATERIAL,
    printModes: TARGET_PRINT_MODES.map((mode) => mode.displayLabel),
    printPositions: [],
    positionFieldName: "",
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
  });

  const ts = timestampForFile();
  const slugDir = kebabCase(args.productSlug || "silketryk-t-shirt");
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
        position_field_name: extractionMeta.positionFieldName || "",
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
  console.log(`  Quantities: ${result.quantities.join(", ")}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
