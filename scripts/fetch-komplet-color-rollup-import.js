#!/usr/bin/env node
/**
 * fetch-komplet-color-rollup-import.js
 *
 * Imports matrix pricing for:
 *   Komplet Color roll up
 *   https://www.wir-machen-druck.de/color-rollup-bannerdisplay-100-cm-x-200-cm-inklusive-druck-und-versand.html
 *
 * Requirements:
 * - One format: 100 x 200 cm
 * - First four materials from supplier dropdown (#sorten)
 * - Quantities: 1..10
 * - Extra selector row (no price difference): Roll Up farve
 *
 * Implementation note:
 * Pricing is independent from color on supplier side. To keep matrix selection stable
 * in storefront/admin, this importer duplicates each material+quantity price across all
 * color selector values.
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
const DEFAULT_PRODUCT_NAME = "Komplet Color roll up";
const DEFAULT_PRODUCT_SLUG = "komplet-color-roll-up";
const DEFAULT_CATEGORY = "tryksager";

const SOURCE_URL =
  "https://www.wir-machen-druck.de/color-rollup-bannerdisplay-100-cm-x-200-cm-inklusive-druck-und-versand.html";

const FORMAT = {
  key: "rollup_100x200",
  label: "Roll up 100 x 200 cm",
  widthMm: 1000,
  heightMm: 2000,
};

const MATERIAL_LIMIT = 4;
const TARGET_QUANTITIES = Array.from({ length: 10 }, (_, i) => i + 1);

const COLOR_GROUP_NAME = "Roll Up farve";
const COLOR_OPTION_HINTS = ["silber", "dunkelgrau", "gelb", "orange", "rot", "grun", "gruen", "blau", "magenta", "ral"];

const EUR_TO_DKK = 7.6;
const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

const SHORT_DESCRIPTION_DA =
  "Color roll-up bannerdisplay 100 x 200 cm inkl. tryk og levering.";
const ABOUT_TITLE_DA = "Produktdetaljer";
const ABOUT_DESCRIPTION_DA = [
  "Komplet Color roll-up i format 100 x 200 cm inkl. tryk og forsendelse.",
  "",
  "Produktet importeres med de første fire materialer fra leverandørens materialeliste.",
  "Du kan vælge systemfarve under \"Roll Up farve\" uden pristillæg.",
  "",
  "Tryk: 4/0 farvetryk (forside trykt, bagside utrykt).",
].join("\n");

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-komplet-color-rollup-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--url <supplier-url>] [--from-targeted-json <path>]",
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
    .replace(/ß/g, "ss");
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
    if (eurMatch?.[1]) eur = parseLocalizedNumber(eurMatch[1]);
  }

  if (!Number.isFinite(eur || NaN)) {
    const eurMatch = raw.match(/([-+]?\d[\d.,]*)\s*(?:€|eur|euro)\b/i);
    if (eurMatch?.[1]) eur = parseLocalizedNumber(eurMatch[1]);
  }

  if (!Number.isFinite(eur || NaN) || (eur || 0) <= 0) return null;

  const hasPerUnitMarker = /\bje\b|pro\s*(?:stk|stück|roll-up)|\/\s*(?:stk|stück|roll-up)/i.test(raw);
  if (hasPerUnitMarker && quantity > 1) eur *= quantity;

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

async function acceptCookieBanner(page) {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "button:has-text('Alle akzeptieren')",
    "button:has-text('Akzeptieren')",
  ];

  for (const selector of selectors) {
    try {
      await page.locator(selector).first().click({ timeout: 2500 });
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

  return fields.map((field) => ({
    ...field,
    options: field.options.map((opt) => ({
      value: String(opt.value || ""),
      label: normalizeLabel(opt.label),
    })),
  }));
}

function isPlaceholderLabel(label) {
  const normalized = normalizeForMatch(label);
  return !normalized || normalized.includes("bitte ausw");
}

function getUsableOptions(field) {
  return (field?.options || []).filter((opt) => opt.value && !isPlaceholderLabel(opt.label));
}

function detectColorField(fields) {
  const isQuantityField = (field) =>
    /auflage|menge|quantity/i.test(field.id || "") || /auflage|menge|quantity/i.test(field.name || "");

  const candidates = fields.filter((field) => {
    const idOrName = normalizeForMatch(`${field.id} ${field.name}`);
    if (idOrName.includes("sorten")) return false;
    if (isQuantityField(field)) return false;
    return getUsableOptions(field).length > 1;
  });

  const byHint = candidates.find((field) =>
    getUsableOptions(field).some((opt) => {
      const hay = normalizeForMatch(opt.label);
      return COLOR_OPTION_HINTS.some((hint) => hay.includes(hint));
    })
  );
  if (byHint) return byHint;

  return candidates[0] || null;
}

async function extractRows(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "networkidle", timeout: 120_000 });
  await acceptCookieBanner(page);
  await selectStandardQuantityMode(page);

  const rawMaterialOptions = await extractMaterialOptions(page);
  const materialOptions = rawMaterialOptions
    .map((item) => ({ value: item.value, label: normalizeLabel(item.label) }))
    .filter((item) => item.value && item.label)
    .filter((item) => !/^bitte/i.test(item.label));

  if (materialOptions.length < MATERIAL_LIMIT) {
    throw new Error(
      `Expected at least ${MATERIAL_LIMIT} materials in supplier dropdown, found ${materialOptions.length}.`
    );
  }

  const targetMaterials = materialOptions.slice(0, MATERIAL_LIMIT).map((item, index) => ({
    key: `material_${index + 1}`,
    value: item.value,
    label: item.label,
  }));

  const selectFields = await detectSelectFields(page);
  const colorField = detectColorField(selectFields);
  if (!colorField || !colorField.name) {
    throw new Error("Could not detect Roll Up color selector on supplier page.");
  }

  const colorOptions = getUsableOptions(colorField).map((opt, index) => ({
    key: `rollup_color_${index + 1}`,
    value: opt.value,
    label: opt.label,
  }));
  if (colorOptions.length === 0) {
    throw new Error("No usable Roll Up color options found.");
  }

  // Price is color-independent. Use first color while scraping.
  const extractionColor = colorOptions[0];

  const extractedRows = [];
  const missingEntries = [];

  for (const material of targetMaterials) {
    await withRetry(async () => {
      await page.selectOption("#sorten", material.value);
      await page.selectOption(`select[name='${colorField.name}']`, extractionColor.value);
      await page.waitForTimeout(1200);
    }, 3);

    const qtyTexts = await extractQuantityTexts(page);
    const perQuantity = new Map();

    qtyTexts.forEach((text) => {
      const parsed = parseQuantityPriceText(text);
      if (!parsed) return;
      if (!TARGET_QUANTITIES.includes(parsed.quantity)) return;

      perQuantity.set(parsed.quantity, {
        formatKey: FORMAT.key,
        formatLabel: FORMAT.label,
        formatWidthMm: FORMAT.widthMm,
        formatHeightMm: FORMAT.heightMm,
        materialKey: material.key,
        materialLabel: material.label,
        sourceMaterialLabel: material.label,
        sourceUrl,
        quantity: parsed.quantity,
        eur: parsed.eur,
        sourceOptionText: text,
      });
    });

    const missingQuantities = TARGET_QUANTITIES.filter((qty) => !perQuantity.has(qty));
    missingQuantities.forEach((quantity) => {
      missingEntries.push({
        material: material.label,
        quantity,
        reason: "quantity_not_found",
      });
    });

    const rows = Array.from(perQuantity.values()).sort((a, b) => a.quantity - b.quantity);
    extractedRows.push(...rows);

    console.log(
      `  [${FORMAT.label}] ${material.key.padEnd(11)} -> found ${rows.length
        .toString()
        .padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
    );
  }

  return {
    extractedRows,
    missingEntries,
    targetMaterials,
    colorFieldName: colorField.name,
    colorOptions,
    extractionColorLabel: extractionColor.label,
  };
}

function buildTransformedSourceRows(sourceRows) {
  const dedupe = new Map();

  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.eur);
    const key = `${row.materialKey}|${row.quantity}`;

    dedupe.set(key, {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => {
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
      const materialKey = normalizeLabel(row.materialKey || "");
      const materialLabel = normalizeLabel(row.materialLabel || row.sourceMaterialLabel || "");
      const quantity = Number(row.quantity);
      const eur = Number(row.eur);

      if (!materialKey || !materialLabel) return null;
      if (!Number.isFinite(quantity) || !Number.isFinite(eur)) return null;

      return {
        formatKey: FORMAT.key,
        formatLabel: FORMAT.label,
        formatWidthMm: FORMAT.widthMm,
        formatHeightMm: FORMAT.heightMm,
        materialKey,
        materialLabel,
        sourceMaterialLabel: normalizeLabel(row.sourceMaterialLabel || materialLabel),
        sourceUrl: String(row.sourceUrl || SOURCE_URL),
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
        width_mm: FORMAT.widthMm,
        height_mm: FORMAT.heightMm,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: FORMAT.label,
        import_script: "fetch-komplet-color-rollup-import.js",
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

function buildPricingStructure({ materialGroup, materialValues, formatGroup, formatValue, colorGroup, colorValues, quantities }) {
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
        id: "row-rollup-color",
        title: "",
        description: "",
        columns: [
          {
            id: "rollup-color-section",
            sectionType: "finishes",
            groupId: colorGroup.id,
            valueIds: colorValues.map((value) => value.id),
            ui_mode: "dropdown",
            selection_mode: "required",
            valueSettings: {},
            title: COLOR_GROUP_NAME,
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
  mappedRows,
  colorOptions,
  sourceUrl,
  colorFieldName,
  dryRun,
}) {
  if (mappedRows.length === 0) throw new Error("No mapped rows to import.");
  if (!Array.isArray(colorOptions) || colorOptions.length === 0) {
    throw new Error("No color options available for Roll Up farve.");
  }

  const activeMaterials = Array.from(new Set(mappedRows.map((row) => row.materialLabel)));
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      colorsDetected: colorOptions.length,
      uniqueMaterials: activeMaterials.length,
      quantities,
      rowsExpectedAfterColorExpansion: mappedRows.length * colorOptions.length,
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

  const colorGroup = await ensureGroup(client, context, {
    name: COLOR_GROUP_NAME,
    kind: "finish",
    sortOrder: 2,
    uiMode: "dropdown",
  });

  const formatValue = await ensureValue(client, context, formatGroup, FORMAT.label, {
    widthMm: FORMAT.widthMm,
    heightMm: FORMAT.heightMm,
  });

  const materialMap = new Map();
  for (const materialLabel of activeMaterials) {
    const value = await ensureValue(client, context, materialGroup, materialLabel);
    materialMap.set(materialLabel, value);
  }

  const colorMap = new Map();
  for (const color of colorOptions) {
    const value = await ensureValue(client, context, colorGroup, color.label);
    colorMap.set(color.label, value);
  }

  const colorValues = colorOptions.map((color) => colorMap.get(color.label)).filter(Boolean);

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValues: activeMaterials.map((name) => materialMap.get(name)).filter(Boolean),
    formatGroup,
    formatValue,
    colorGroup,
    colorValues,
    quantities,
  });

  const dedupeRows = new Map();

  mappedRows.forEach((row) => {
    const materialValue = materialMap.get(row.materialLabel);
    if (!materialValue) return;

    colorValues.forEach((colorValue) => {
      const variantName = `${formatValue.id}::${colorValue.id}`;

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
          rollUpColorId: colorValue.id,
          selectionMap: {
            format: formatValue.id,
            material: materialValue.id,
            variantValueIds: [colorValue.id],
          },
          source: "komplet_color_rollup_fetch_import",
          sourceUrl: row.sourceUrl,
          sourceMaterialLabel: row.sourceMaterialLabel,
          sourceFormatLabel: row.formatLabel,
          sourceColorFieldName: colorFieldName,
          sourceRollupColorLabel: colorValue.name,
          rowType: row.rowType,
          eur: row.eur,
          dkkBase: row.dkkBase,
          tierMultiplier: row.tierMultiplier,
        },
      };

      const key = `${payload.product_id}|${payload.variant_name}|${payload.variant_value}|${payload.quantity}`;
      dedupeRows.set(key, payload);
    });
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
        width_mm: FORMAT.widthMm,
        height_mm: FORMAT.heightMm,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: FORMAT.label,
        import_script: "fetch-komplet-color-rollup-import.js",
        product_details_da: ABOUT_DESCRIPTION_DA,
        source_url: sourceUrl,
        rollup_color_selector: COLOR_GROUP_NAME,
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
    uniqueColors: colorValues.length,
    quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Komplet Color roll up Import ===");
  console.log(`URL: ${args.sourceUrl}`);
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  let extractedRows = [];
  let missingEntries = [];
  let targetMaterials = [];
  let colorOptions = [];
  let colorFieldName = "";
  let extractionColorLabel = "";

  if (args.fromTargetedJson) {
    extractedRows = loadSourceRowsFromTargetedJson(args.fromTargetedJson);
    const payload = JSON.parse(fs.readFileSync(path.resolve(args.fromTargetedJson), "utf8"));
    targetMaterials = Array.isArray(payload?.materials) ? payload.materials : [];
    colorOptions = Array.isArray(payload?.rollup_colors)
      ? payload.rollup_colors
          .map((color, index) => {
            if (typeof color === "string") {
              return {
                key: `rollup_color_${index + 1}`,
                label: normalizeLabel(color),
                value: normalizeLabel(color),
              };
            }
            return {
              key: normalizeLabel(color?.key || `rollup_color_${index + 1}`),
              label: normalizeLabel(color?.label || color?.name || ""),
              value: normalizeLabel(color?.value || color?.label || color?.name || ""),
            };
          })
          .filter((color) => color.label)
      : [];
    colorFieldName = String(payload?.color_field_name || "");
    extractionColorLabel = String(payload?.extraction_color_label || "");
  } else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      const result = await extractRows(page, args.sourceUrl);
      extractedRows = result.extractedRows;
      missingEntries = result.missingEntries;
      targetMaterials = result.targetMaterials;
      colorOptions = result.colorOptions;
      colorFieldName = result.colorFieldName;
      extractionColorLabel = result.extractionColorLabel;
    } finally {
      await browser.close();
    }
  }

  if (!extractedRows || extractedRows.length === 0) {
    throw new Error("No source rows extracted from supplier page.");
  }
  if (!colorOptions || colorOptions.length === 0) {
    throw new Error("No Roll Up farve options extracted.");
  }

  const transformedRows = buildTransformedSourceRows(extractedRows);
  const mappedRows = buildMappedRows(transformedRows);

  const ts = timestampForFile();
  const slugDir = kebabCase(args.productSlug || DEFAULT_PRODUCT_SLUG);

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
          source_url: args.sourceUrl,
          format: FORMAT,
        },
        materials: targetMaterials,
        rollup_colors: colorOptions.map((option) => option.label),
        color_field_name: colorFieldName,
        extraction_color_label: extractionColorLabel,
        target_quantities: TARGET_QUANTITIES,
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
    colorOptions,
    sourceUrl: args.sourceUrl,
    colorFieldName,
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
      console.log(`- ${entry.material} | ${entry.reason}${entry.quantity ? ` | qty ${entry.quantity}` : ""}`);
    });
  }
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
