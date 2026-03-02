#!/usr/bin/env node
/**
 * fetch-color-tshirt-4x4-import.mjs
 *
 * Creates/updates one combined color t-shirt product with two print scopes:
 * - Front only (prices from one-position URL)
 * - Front + back (prices from two-position URL)
 *
 * Matrix model:
 * - Vertical axis: material
 * - Hidden format: Standard
 * - Buttons: Trykområde (Print position 1 / 4+4)
 * - Buttons: Silketryk (1/0 .. 4/0)
 * - Dropdown: T-shirt farve (non-pricing selector)
 * - Dropdown: Print position 1
 * - Dropdown: Print position 2 (includes "Ingen print position 2" for position-1 scope)
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

const FRONT_ONLY_URL =
  "https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-einer-druckposition.html";
const FRONT_BACK_URL =
  "https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-zwei-druckpositionen.html";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Color T-shirt 4+4";
const DEFAULT_PRODUCT_SLUG = "color-t-shirt-4-plus-4";
const DEFAULT_FORMAT_LABEL = "Standard";
const DEFAULT_WIDTH_MM = 300;
const DEFAULT_HEIGHT_MM = 400;

const PRINT_SCOPE_FRONT_ONLY_LABEL = "Print position 1";
const PRINT_SCOPE_FRONT_BACK_LABEL = "4+4";
const NO_BACK_PRINT_LABEL = "Ingen print position 2";

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
    "  node scripts/fetch-color-tshirt-4x4-import.mjs import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--front-only-url <url>] [--front-back-url <url>] [--format-label <format>] [--width-mm <num>] [--height-mm <num>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || "",
    dryRun: argv.includes("--dry-run"),
    tenantId: DEFAULT_TENANT_ID,
    productName: DEFAULT_PRODUCT_NAME,
    productSlug: DEFAULT_PRODUCT_SLUG,
    frontOnlyUrl: FRONT_ONLY_URL,
    frontBackUrl: FRONT_BACK_URL,
    formatLabel: DEFAULT_FORMAT_LABEL,
    widthMm: DEFAULT_WIDTH_MM,
    heightMm: DEFAULT_HEIGHT_MM,
  };

  const tenantIdx = argv.indexOf("--tenant");
  if (tenantIdx !== -1 && argv[tenantIdx + 1]) args.tenantId = argv[tenantIdx + 1];

  const nameIdx = argv.indexOf("--name");
  if (nameIdx !== -1 && argv[nameIdx + 1]) args.productName = argv[nameIdx + 1];

  const slugIdx = argv.indexOf("--slug");
  if (slugIdx !== -1 && argv[slugIdx + 1]) args.productSlug = argv[slugIdx + 1];

  const frontOnlyIdx = argv.indexOf("--front-only-url");
  if (frontOnlyIdx !== -1 && argv[frontOnlyIdx + 1]) args.frontOnlyUrl = argv[frontOnlyIdx + 1];

  const frontBackIdx = argv.indexOf("--front-back-url");
  if (frontBackIdx !== -1 && argv[frontBackIdx + 1]) args.frontBackUrl = argv[frontBackIdx + 1];

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

  return args;
}

function normalizeLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text) {
  return normalizeLabel(text).toLowerCase().replace(/\s+/g, "");
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

function positionFieldOrder(field) {
  const nameMatch = String(field.name || "").match(/zusatzfeld\[(\d+)\]/i);
  if (nameMatch) return Number(nameMatch[1]);

  const idMatch = String(field.id || "").match(/(\d+)/);
  if (idMatch) return Number(idMatch[1]);

  return Number.MAX_SAFE_INTEGER;
}

function normalizeFieldOptions(field) {
  return (field.options || [])
    .map((opt) => ({
      value: String(opt.value || ""),
      label: normalizeLabel(opt.label || ""),
    }))
    .filter((opt) => opt.value && opt.label && !/bitte ausw/i.test(opt.label));
}

function isPositionField(field) {
  return normalizeFieldOptions(field).some((opt) => /bedruckt|druck/i.test(opt.label));
}

function isColorField(field) {
  return normalizeFieldOptions(field).some((opt) => /pantone|black|navy|royal|fuchsia|bottle green/i.test(opt.label));
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

  return fields
    .map((field) => ({
      ...field,
      options: normalizeFieldOptions(field),
      _order: positionFieldOrder(field),
    }))
    .filter((field) => field.options.length > 0)
    .sort((a, b) => {
      if (a._order !== b._order) return a._order - b._order;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
}

function detectPositionFields(selectFields) {
  const named = selectFields.filter((field) => /^zusatzfeld\[\d+\]$/i.test(field.name));
  const candidates = named.length > 0 ? named : selectFields;
  return candidates.filter((field) => isPositionField(field));
}

function detectColorField(selectFields) {
  const named = selectFields.filter((field) => /^zusatzfeld\[\d+\]$/i.test(field.name));
  const candidates = named.length > 0 ? named : selectFields;
  return candidates.find((field) => isColorField(field)) || null;
}

async function readFieldOptionsByName(page, fieldName) {
  const options = await page.$$eval(
    `select[name='${fieldName}'] option`,
    (nodes) => nodes.map((node) => ({
      value: node.getAttribute("value") || "",
      label: (node.textContent || "").trim(),
    }))
  );
  return normalizeFieldOptions({ options });
}

async function extractRowsForScope(page, {
  sourceUrl,
  printScopeLabel,
  requireBackPosition,
}) {
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

  const normalizedSorten = sortenOptions.map((opt) => ({
    ...opt,
    compact: compactText(opt.label),
  }));

  const resolvedModes = TARGET_PRINT_MODES.map((mode) => {
    const exact = sortenByLabel.get(mode.sourceLabel);
    if (exact) {
      return {
        displayLabel: mode.displayLabel,
        sourceLabel: mode.sourceLabel,
        sourceValue: exact,
      };
    }

    const ratio = mode.displayLabel.match(/(\d)\s*\/\s*0/i)?.[1];
    if (!ratio) return null;

    const fuzzy = normalizedSorten.find((opt) => {
      const compact = opt.compact;
      const hasSiebdruck = compact.includes("siebdruck");
      const hasRatio =
        compact.includes(`${ratio}/0`) ||
        compact.includes(`${ratio}/${ratio}`) ||
        compact.includes(`${ratio}-0`) ||
        compact.includes(`${ratio}-${ratio}`) ||
        compact.includes(`${ratio}0`) ||
        compact.includes(`${ratio}${ratio}`);
      return hasSiebdruck && hasRatio;
    });

    if (!fuzzy) return null;

    return {
      displayLabel: mode.displayLabel,
      sourceLabel: normalizeLabel(fuzzy.label),
      sourceValue: String(fuzzy.value),
    };
  });

  const missingModes = resolvedModes.filter((mode) => !mode?.sourceValue);
  if (missingModes.length > 0) {
    const available = sortenOptions.map((opt) => normalizeLabel(opt.label)).slice(0, 12).join(" | ");
    throw new Error(
      `Missing required print-mode options on ${sourceUrl}. Available options: ${available}`
    );
  }

  const selectFields = await detectSelectFields(page);
  const colorField = detectColorField(selectFields);
  if (!colorField || !colorField.name) {
    throw new Error(`Could not detect T-shirt color selector on ${sourceUrl}.`);
  }

  const tshirtColorOptions = normalizeFieldOptions(colorField);
  if (tshirtColorOptions.length === 0) {
    throw new Error(`No usable T-shirt color options found on ${sourceUrl}.`);
  }

  const extractionColor = tshirtColorOptions[0];

  const positionFields = detectPositionFields(
    selectFields.filter((field) => field.name !== colorField.name)
  );
  if (positionFields.length === 0) {
    throw new Error(`Could not detect print-position selector(s) on ${sourceUrl}.`);
  }

  const frontField = positionFields[0];
  const backField = positionFields[1] || null;

  if (requireBackPosition && !backField) {
    throw new Error(`Expected two print-position selectors on ${sourceUrl}, but found only one.`);
  }

  const frontOptions = normalizeFieldOptions(frontField);
  if (frontOptions.length === 0) {
    throw new Error(`No usable front-position options found on ${sourceUrl}.`);
  }

  const staticBackOptions = requireBackPosition && backField
    ? normalizeFieldOptions(backField)
    : [{ value: "__none__", label: NO_BACK_PRINT_LABEL }];

  if (requireBackPosition && staticBackOptions.length === 0) {
    throw new Error(`No usable back-position options found on ${sourceUrl}.`);
  }

  const extractedRows = [];
  const missingByCombination = [];

  for (const mode of resolvedModes) {
    if (!mode?.sourceValue) continue;

    await withRetry(async () => {
      await page.selectOption("#sorten", mode.sourceValue);
      await page.waitForTimeout(900);
    }, 3);

    await withRetry(async () => {
      await page.selectOption(`select[name='${colorField.name}']`, extractionColor.value);
      await page.waitForTimeout(700);
    }, 3);

    for (const frontPosition of frontOptions) {
      await withRetry(async () => {
        await page.selectOption(`select[name='${frontField.name}']`, frontPosition.value);
        await page.waitForTimeout(700);
      }, 3);

      let backOptions = staticBackOptions;
      if (requireBackPosition && backField?.name) {
        const dynamicBack = await withRetry(
          () => readFieldOptionsByName(page, backField.name),
          2
        );
        if (dynamicBack.length > 0) backOptions = dynamicBack;
      }

      for (const backPosition of backOptions) {
        if (requireBackPosition && backField?.name) {
          await withRetry(async () => {
            await page.selectOption(`select[name='${backField.name}']`, backPosition.value);
            await page.waitForTimeout(700);
          }, 3);
        }

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
            printScopeLabel,
            printModeLabel: mode.displayLabel,
            frontPositionLabel: frontPosition.label,
            backPositionLabel: requireBackPosition ? backPosition.label : NO_BACK_PRINT_LABEL,
            quantity: parsed.quantity,
            unitEur: parsed.unitEur,
            totalEur: parsed.totalEur,
            sourceModeLabel: mode.sourceLabel,
            sourceModeValue: mode.sourceValue,
            sourceFrontPositionLabel: frontPosition.label,
            sourceFrontPositionValue: frontPosition.value,
            sourceBackPositionLabel: requireBackPosition ? backPosition.label : "",
            sourceBackPositionValue: requireBackPosition ? backPosition.value : "",
            sourceColorLabel: extractionColor.label,
            sourceColorValue: extractionColor.value,
            sourceUrl,
          });
        });

        const rows = Array.from(perCombination.values()).sort((a, b) => a.quantity - b.quantity);
        extractedRows.push(...rows);

        const missingQuantities = TARGET_QUANTITIES.filter((qty) => !perCombination.has(qty));
        if (missingQuantities.length > 0) {
          missingByCombination.push({
            printScopeLabel,
            printModeLabel: mode.displayLabel,
            frontPositionLabel: frontPosition.label,
            backPositionLabel: requireBackPosition ? backPosition.label : NO_BACK_PRINT_LABEL,
            missingQuantities,
          });
        }

        console.log(
          `  ${printScopeLabel.substring(0, 18).padEnd(18)} | ${mode.displayLabel.substring(0, 20).padEnd(20)} | ${frontPosition.label.substring(0, 20).padEnd(20)} | ${String((requireBackPosition ? backPosition.label : NO_BACK_PRINT_LABEL)).substring(0, 20).padEnd(20)} | ${extractionColor.label.substring(0, 18).padEnd(18)} -> ${String(rows.length).padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
        );
      }
    }
  }

  return {
    extractedRows,
    materialLabel: TARGET_MATERIAL,
    printScopeLabel,
    printModes: TARGET_PRINT_MODES.map((mode) => mode.displayLabel),
    frontPositions: frontOptions.map((position) => position.label),
    backPositions: requireBackPosition
      ? staticBackOptions.map((position) => position.label)
      : [NO_BACK_PRINT_LABEL],
    tshirtColors: tshirtColorOptions.map((color) => color.label),
    positionFieldNames: [frontField?.name || "", backField?.name || ""].filter(Boolean),
    colorFieldName: colorField?.name || "",
    extractionColorLabel: extractionColor.label,
    missingByCombination,
  };
}

function buildTransformedSourceRows(sourceRows) {
  const dedupe = new Map();
  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.totalEur);
    const key = [
      row.materialLabel,
      row.printScopeLabel,
      row.printModeLabel,
      row.frontPositionLabel,
      row.backPositionLabel,
      row.quantity,
    ].join("||");

    dedupe.set(key, {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => {
    if (a.printScopeLabel !== b.printScopeLabel) return a.printScopeLabel.localeCompare(b.printScopeLabel);
    if (a.printModeLabel !== b.printModeLabel) return a.printModeLabel.localeCompare(b.printModeLabel);
    if (a.frontPositionLabel !== b.frontPositionLabel) return a.frontPositionLabel.localeCompare(b.frontPositionLabel);
    if (a.backPositionLabel !== b.backPositionLabel) return a.backPositionLabel.localeCompare(b.backPositionLabel);
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedRows, { formatLabel, tshirtColors }) {
  const mappedRows = [];
  const normalizedColors =
    Array.isArray(tshirtColors) && tshirtColors.length > 0
      ? tshirtColors.map((label) => normalizeLabel(label)).filter(Boolean)
      : ["Standard"];

  transformedRows.forEach((row) => {
    normalizedColors.forEach((tshirtColorLabel) => {
      mappedRows.push({
        rowType: "color_tshirt_4x4",
        formatLabel,
        materialLabel: row.materialLabel,
        printScopeLabel: row.printScopeLabel,
        printModeLabel: row.printModeLabel,
        frontPositionLabel: row.frontPositionLabel,
        backPositionLabel: row.backPositionLabel,
        tshirtColorLabel,
        quantity: row.quantity,
        unitEur: row.unitEur,
        totalEur: row.totalEur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
        dkkFinal: row.dkkFinal,
        sourceModeLabel: row.sourceModeLabel,
        sourceModeValue: row.sourceModeValue,
        sourceFrontPositionLabel: row.sourceFrontPositionLabel,
        sourceFrontPositionValue: row.sourceFrontPositionValue,
        sourceBackPositionLabel: row.sourceBackPositionLabel,
        sourceBackPositionValue: row.sourceBackPositionValue,
        sourceColorLabel: row.sourceColorLabel || tshirtColorLabel,
        sourceColorValue: row.sourceColorValue || "",
        sourceUrl: row.sourceUrl,
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
    "print_scope",
    "print_mode",
    "front_position",
    "back_position",
    "tshirt_color",
    "quantity",
    "unit_eur",
    "total_eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "source_mode_label",
    "source_front_position_label",
    "source_back_position_label",
    "source_color_label",
    "detail_url",
  ];

  const lines = [header.join(",")];
  rows.forEach((row) => {
    const fields = [
      row.rowType,
      row.formatLabel,
      row.materialLabel,
      row.printScopeLabel,
      row.printModeLabel,
      row.frontPositionLabel,
      row.backPositionLabel,
      row.tshirtColorLabel,
      row.quantity,
      row.unitEur,
      row.totalEur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.sourceModeLabel || "",
      row.sourceFrontPositionLabel || "",
      row.sourceBackPositionLabel || "",
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
      description: "Color t-shirt (print position 1 + 4+4) - auto-imported from wir-machen-druck.de",
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
  printScopeGroup,
  printScopeValues,
  printModeGroup,
  printModeValues,
  tshirtColorGroup,
  tshirtColorValues,
  frontPositionGroup,
  frontPositionValues,
  backPositionGroup,
  backPositionValues,
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
        id: "row-print-scope",
        title: "",
        description: "",
        columns: [
          {
            id: "print-scope-section",
            sectionType: "finishes",
            groupId: printScopeGroup.id,
            valueIds: printScopeValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Trykområde",
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
      {
        id: "row-front-position",
        title: "",
        description: "",
        columns: [
          {
            id: "front-position-section",
            sectionType: "finishes",
            groupId: frontPositionGroup.id,
            valueIds: frontPositionValues.map((value) => value.id),
            ui_mode: "dropdown",
            selection_mode: "required",
            valueSettings: {},
            title: "Print position 1",
            description: "",
          },
        ],
      },
      {
        id: "row-back-position",
        title: "",
        description: "",
        columns: [
          {
            id: "back-position-section",
            sectionType: "finishes",
            groupId: backPositionGroup.id,
            valueIds: backPositionValues.map((value) => value.id),
            ui_mode: "dropdown",
            selection_mode: "required",
            valueSettings: {},
            title: "Print position 2",
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

  const activePrintScopes = Array.from(new Set(mappedRows.map((row) => row.printScopeLabel))).sort();
  const activePrintModes = Array.from(new Set(mappedRows.map((row) => row.printModeLabel))).sort();
  const activeTshirtColors = Array.from(new Set(mappedRows.map((row) => row.tshirtColorLabel))).sort();
  const activeFrontPositions = Array.from(new Set(mappedRows.map((row) => row.frontPositionLabel))).sort();
  const activeBackPositions = Array.from(new Set(mappedRows.map((row) => row.backPositionLabel))).sort();
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      uniquePrintScopes: activePrintScopes.length,
      uniquePrintModes: activePrintModes.length,
      uniqueTshirtColors: activeTshirtColors.length,
      uniqueFrontPositions: activeFrontPositions.length,
      uniqueBackPositions: activeBackPositions.length,
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
  const printScopeGroup = await ensureGroup(client, context, {
    name: "Trykområde",
    kind: "finish",
    sortOrder: 2,
    uiMode: "buttons",
  });
  const printModeGroup = await ensureGroup(client, context, {
    name: "Silketryk",
    kind: "finish",
    sortOrder: 3,
    uiMode: "buttons",
  });
  const tshirtColorGroup = await ensureGroup(client, context, {
    name: "T-shirt farve",
    kind: "finish",
    sortOrder: 4,
    uiMode: "dropdown",
  });
  const frontPositionGroup = await ensureGroup(client, context, {
    name: "Print position 1",
    kind: "finish",
    sortOrder: 5,
    uiMode: "dropdown",
  });
  const backPositionGroup = await ensureGroup(client, context, {
    name: "Print position 2",
    kind: "finish",
    sortOrder: 6,
    uiMode: "dropdown",
  });

  const formatValue = await ensureValue(client, context, formatGroup, formatLabel, {
    widthMm,
    heightMm,
  });
  const materialValue = await ensureValue(client, context, materialGroup, TARGET_MATERIAL);

  const printScopeMap = new Map();
  for (const printScopeLabel of activePrintScopes) {
    printScopeMap.set(
      printScopeLabel,
      await ensureValue(client, context, printScopeGroup, printScopeLabel)
    );
  }

  const printModeMap = new Map();
  for (const printModeLabel of activePrintModes) {
    printModeMap.set(
      printModeLabel,
      await ensureValue(client, context, printModeGroup, printModeLabel)
    );
  }

  const tshirtColorMap = new Map();
  for (const tshirtColorLabel of activeTshirtColors) {
    tshirtColorMap.set(
      tshirtColorLabel,
      await ensureValue(client, context, tshirtColorGroup, tshirtColorLabel)
    );
  }

  const frontPositionMap = new Map();
  for (const frontPositionLabel of activeFrontPositions) {
    frontPositionMap.set(
      frontPositionLabel,
      await ensureValue(client, context, frontPositionGroup, frontPositionLabel)
    );
  }

  const backPositionMap = new Map();
  for (const backPositionLabel of activeBackPositions) {
    backPositionMap.set(
      backPositionLabel,
      await ensureValue(client, context, backPositionGroup, backPositionLabel)
    );
  }

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValue,
    formatGroup,
    formatValue,
    printScopeGroup,
    printScopeValues: activePrintScopes.map((label) => printScopeMap.get(label)).filter(Boolean),
    printModeGroup,
    printModeValues: activePrintModes.map((label) => printModeMap.get(label)).filter(Boolean),
    tshirtColorGroup,
    tshirtColorValues: activeTshirtColors.map((label) => tshirtColorMap.get(label)).filter(Boolean),
    frontPositionGroup,
    frontPositionValues: activeFrontPositions.map((label) => frontPositionMap.get(label)).filter(Boolean),
    backPositionGroup,
    backPositionValues: activeBackPositions.map((label) => backPositionMap.get(label)).filter(Boolean),
    quantities,
  });

  const dedupeRows = new Map();
  mappedRows.forEach((row) => {
    const printScopeValue = printScopeMap.get(row.printScopeLabel);
    const printModeValue = printModeMap.get(row.printModeLabel);
    const tshirtColorValue = tshirtColorMap.get(row.tshirtColorLabel);
    const frontPositionValue = frontPositionMap.get(row.frontPositionLabel);
    const backPositionValue = backPositionMap.get(row.backPositionLabel);
    if (!printScopeValue || !printModeValue || !tshirtColorValue || !frontPositionValue || !backPositionValue) return;

    const variantName = [
      formatValue.id,
      printScopeValue.id,
      printModeValue.id,
      tshirtColorValue.id,
      frontPositionValue.id,
      backPositionValue.id,
    ].sort().join("|");

    const variantValueIds = [
      printScopeValue.id,
      printModeValue.id,
      tshirtColorValue.id,
      frontPositionValue.id,
      backPositionValue.id,
    ].sort();

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
        printScopeId: printScopeValue.id,
        printModeId: printModeValue.id,
        tshirtColorId: tshirtColorValue.id,
        frontPositionId: frontPositionValue.id,
        backPositionId: backPositionValue.id,
        variantValueIds,
        selectionMap: {
          format: formatValue.id,
          material: materialValue.id,
          printScope: printScopeValue.id,
          printMode: printModeValue.id,
          tshirtColor: tshirtColorValue.id,
          frontPosition: frontPositionValue.id,
          backPosition: backPositionValue.id,
          variantValueIds,
        },
        source: "color_tshirt_4x4_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceModeLabel: row.sourceModeLabel,
        sourceModeValue: row.sourceModeValue,
        sourceFrontPositionLabel: row.sourceFrontPositionLabel,
        sourceFrontPositionValue: row.sourceFrontPositionValue,
        sourceBackPositionLabel: row.sourceBackPositionLabel,
        sourceBackPositionValue: row.sourceBackPositionValue,
        sourceColorLabel: row.sourceColorLabel,
        sourceColorValue: row.sourceColorValue,
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
    uniquePrintScopes: activePrintScopes.length,
    uniquePrintModes: activePrintModes.length,
    uniqueTshirtColors: activeTshirtColors.length,
    uniqueFrontPositions: activeFrontPositions.length,
    uniqueBackPositions: activeBackPositions.length,
    quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Color T-shirt 4+4 Import ===");
  console.log(`Front-only URL: ${args.frontOnlyUrl}`);
  console.log(`Front+back URL: ${args.frontBackUrl}`);
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let frontOnlyResult;
  let frontBackResult;

  try {
    frontOnlyResult = await extractRowsForScope(page, {
      sourceUrl: args.frontOnlyUrl,
      printScopeLabel: PRINT_SCOPE_FRONT_ONLY_LABEL,
      requireBackPosition: false,
    });

    frontBackResult = await extractRowsForScope(page, {
      sourceUrl: args.frontBackUrl,
      printScopeLabel: PRINT_SCOPE_FRONT_BACK_LABEL,
      requireBackPosition: true,
    });
  } finally {
    await browser.close();
  }

  const extractedRows = [
    ...(frontOnlyResult?.extractedRows || []),
    ...(frontBackResult?.extractedRows || []),
  ];

  if (extractedRows.length === 0) {
    throw new Error("No source rows extracted from supplier pages.");
  }

  const transformedRows = buildTransformedSourceRows(extractedRows);
  const allTshirtColors = Array.from(
    new Set([
      ...(frontOnlyResult?.tshirtColors || []),
      ...(frontBackResult?.tshirtColors || []),
    ].map((label) => normalizeLabel(label)).filter(Boolean))
  ).sort();
  const mappedRows = buildMappedRows(transformedRows, {
    formatLabel: args.formatLabel,
    tshirtColors: allTshirtColors,
  });

  const ts = timestampForFile();
  const slugDir = kebabCase(args.productSlug || "color-t-shirt-4-plus-4");
  ensureDir(path.join(process.cwd(), "pricing_raw", slugDir));
  ensureDir(path.join(process.cwd(), "pricing_clean", slugDir));

  const rawPath = path.join(process.cwd(), "pricing_raw", slugDir, `${ts}.json`);
  const cleanPath = path.join(process.cwd(), "pricing_clean", slugDir, `${ts}.csv`);

  const allPrintModes = Array.from(new Set(mappedRows.map((row) => row.printModeLabel))).sort();
  const allTshirtColorsForRows = Array.from(new Set(mappedRows.map((row) => row.tshirtColorLabel))).sort();
  const allFrontPositions = Array.from(new Set(mappedRows.map((row) => row.frontPositionLabel))).sort();
  const allBackPositions = Array.from(new Set(mappedRows.map((row) => row.backPositionLabel))).sort();

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
          front_only_url: args.frontOnlyUrl,
          front_back_url: args.frontBackUrl,
        },
        material_label: TARGET_MATERIAL,
        print_scopes: [PRINT_SCOPE_FRONT_ONLY_LABEL, PRINT_SCOPE_FRONT_BACK_LABEL],
        print_modes: allPrintModes,
        tshirt_colors: allTshirtColorsForRows,
        front_positions: allFrontPositions,
        back_positions: allBackPositions,
        front_only_meta: {
          position_fields: frontOnlyResult?.positionFieldNames || [],
          color_field: frontOnlyResult?.colorFieldName || "",
          extraction_color: frontOnlyResult?.extractionColorLabel || "",
          missing_by_combination: frontOnlyResult?.missingByCombination || [],
        },
        front_back_meta: {
          position_fields: frontBackResult?.positionFieldNames || [],
          color_field: frontBackResult?.colorFieldName || "",
          extraction_color: frontBackResult?.extractionColorLabel || "",
          missing_by_combination: frontBackResult?.missingByCombination || [],
        },
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
    console.log(`  Print scopes: ${result.uniquePrintScopes}`);
    console.log(`  Print modes: ${result.uniquePrintModes}`);
    console.log(`  T-shirt colors: ${result.uniqueTshirtColors}`);
    console.log(`  Front positions: ${result.uniqueFrontPositions}`);
    console.log(`  Back positions: ${result.uniqueBackPositions}`);
    console.log(`  Quantities: ${result.quantities.join(", ")}`);
    return;
  }

  console.log("Import complete.");
  console.log(`  Product ID: ${result.productId}`);
  console.log(`  Product slug: ${result.productSlug}`);
  console.log(`  Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
  console.log(`  Rows inserted: ${result.rowsInserted}`);
  console.log(`  Print scopes: ${result.uniquePrintScopes}`);
  console.log(`  Print modes: ${result.uniquePrintModes}`);
  console.log(`  T-shirt colors: ${result.uniqueTshirtColors}`);
  console.log(`  Front positions: ${result.uniqueFrontPositions}`);
  console.log(`  Back positions: ${result.uniqueBackPositions}`);
  console.log(`  Quantities: ${result.quantities.join(", ")}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
