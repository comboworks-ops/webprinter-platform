#!/usr/bin/env node
/**
 * fetch-roll-up-import.js
 *
 * Imports matrix pricing from wir-machen-druck:
 *   - Silver housing:
 *     https://www.wir-machen-druck.de/topseller-rollup-bannerdisplay-kassette-silber-85-cm-x-200-cm-inklusive-druck-pvcfrei-und-versand.html
 *   - Black housing:
 *     https://www.wir-machen-druck.de/topseller-rollup-bannerdisplay-kassette-schwarz-85-cm-x-200-cm-inklusive-druck-pvcfrei-und-versand.html
 *
 * Product:
 *   - Name: roll up
 *   - Vertical axis: material
 *   - One hidden format value: Standard (850 x 2000 mm)
 *   - One target material: "Jedes Rollup anderes Motiv: ..."
 *   - One required selector row: Housing (Silver Housing / Silver Black Housing)
 *   - Quantities: 2..15
 *   - Ignore custom quantity mode.
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

const SILVER_SOURCE_URL =
  "https://www.wir-machen-druck.de/topseller-rollup-bannerdisplay-kassette-silber-85-cm-x-200-cm-inklusive-druck-pvcfrei-und-versand.html";
const BLACK_SOURCE_URL =
  "https://www.wir-machen-druck.de/topseller-rollup-bannerdisplay-kassette-schwarz-85-cm-x-200-cm-inklusive-druck-pvcfrei-und-versand.html";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "roll up";
const DEFAULT_PRODUCT_SLUG = "roll-up";
const DEFAULT_FORMAT_LABEL = "Standard";
const DEFAULT_WIDTH_MM = 850;
const DEFAULT_HEIGHT_MM = 2000;
const DEFAULT_HOUSING_GROUP_NAME = "Housing";

const TARGET_MATERIAL_TOKEN = "jedes rollup anderes motiv";
const TARGET_QUANTITIES = Array.from({ length: 14 }, (_, i) => i + 2); // 2..15
const HOUSING_VARIANTS = [
  { key: "silver", label: "Silver Housing", sourceUrl: SILVER_SOURCE_URL },
  { key: "silver_black", label: "Silver Black Housing", sourceUrl: BLACK_SOURCE_URL },
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
    "  node scripts/fetch-roll-up-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--url <silver-url>] [--black-url <black-url>] [--housing-group-name <name>] [--format-label <format>] [--width-mm <num>] [--height-mm <num>] [--from-targeted-json <path>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || "",
    dryRun: argv.includes("--dry-run"),
    tenantId: DEFAULT_TENANT_ID,
    productName: DEFAULT_PRODUCT_NAME,
    productSlug: DEFAULT_PRODUCT_SLUG,
    sourceUrl: SILVER_SOURCE_URL,
    blackSourceUrl: BLACK_SOURCE_URL,
    housingGroupName: DEFAULT_HOUSING_GROUP_NAME,
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

  const blackUrlIdx = argv.indexOf("--black-url");
  if (blackUrlIdx !== -1 && argv[blackUrlIdx + 1]) args.blackSourceUrl = argv[blackUrlIdx + 1];

  const housingNameIdx = argv.indexOf("--housing-group-name");
  if (housingNameIdx !== -1 && argv[housingNameIdx + 1]) args.housingGroupName = argv[housingNameIdx + 1];

  const formatIdx = argv.indexOf("--format-label");
  if (formatIdx !== -1 && argv[formatIdx + 1]) args.formatLabel = argv[formatIdx + 1];

  const widthIdx = argv.indexOf("--width-mm");
  if (widthIdx !== -1 && argv[widthIdx + 1]) {
    const parsed = Number(argv[widthIdx + 1]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("--width-mm must be a positive number");
    }
    args.widthMm = parsed;
  }

  const heightIdx = argv.indexOf("--height-mm");
  if (heightIdx !== -1 && argv[heightIdx + 1]) {
    const parsed = Number(argv[heightIdx + 1]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("--height-mm must be a positive number");
    }
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

function isTargetMaterial(label) {
  const normalized = normalizeLabel(label).toLowerCase();
  return normalized.includes(TARGET_MATERIAL_TOKEN);
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

async function extractTargetedRows(page, sourceUrl, housingLabel) {
  await page.goto(sourceUrl, { waitUntil: "networkidle", timeout: 120_000 });
  try {
    await page
      .locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler")
      .click({ timeout: 4_000 });
  } catch {
    // Cookie banner may not be visible.
  }

  await selectStandardQuantityMode(page);

  const materials = await withRetry(() =>
    page.$$eval("#sorten option", (nodes) =>
      nodes.map((node) => ({
        value: node.getAttribute("value") || "",
        label: (node.textContent || "").trim(),
      }))
    )
  );

  const materialOptions = materials
    .map((item) => ({ value: item.value, label: normalizeLabel(item.label) }))
    .filter((item) => item.value && item.label)
    .filter((item) => !/^bitte/i.test(item.label));

  const material = materialOptions.find((item) => isTargetMaterial(item.label));
  if (!material) {
    throw new Error(
      `Target material not found. Expected label containing: "${TARGET_MATERIAL_TOKEN}"`
    );
  }

  await withRetry(async () => {
    await page.selectOption("#sorten", material.value);
    await page.waitForTimeout(1200);
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
      sourceMaterialLabel: material.label,
      housingLabel,
      sourceUrl,
      quantity: parsed.quantity,
      eur: parsed.eur,
      sourceOptionText: text,
    });
  });

  const parsedRows = Array.from(perMaterialMap.values()).sort((a, b) => a.quantity - b.quantity);
  const missingQuantities = TARGET_QUANTITIES.filter((qty) => !perMaterialMap.has(qty));

  console.log(
    `  [${housingLabel}] ${material.label.substring(0, 60).padEnd(60)} -> found ${parsedRows.length
      .toString()
      .padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
  );
  if (missingQuantities.length > 0) {
    console.log(`  Missing quantities on source page: ${missingQuantities.join(", ")}`);
  }

  return {
    extractedRows: parsedRows,
    materialLabels: [material.label],
    missingQuantities,
  };
}

function buildTransformedSourceRows(sourceRows) {
  const dedupe = new Map();
  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.eur);
    dedupe.set(`${row.sourceMaterialLabel}||${row.housingLabel}||${row.quantity}`, {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => {
    if (a.housingLabel !== b.housingLabel) return a.housingLabel.localeCompare(b.housingLabel);
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedSourceRows, { formatLabel }) {
  return transformedSourceRows.map((row) => ({
    rowType: "base_material_housing",
    formatLabel,
    materialLabel: row.sourceMaterialLabel,
    housingLabel: row.housingLabel,
    quantity: row.quantity,
    eur: row.eur,
    dkkBase: row.dkkBase,
    tierMultiplier: row.tierMultiplier,
    dkkFinal: row.dkkFinal,
    sourceMaterialLabel: row.sourceMaterialLabel,
    sourceUrl: row.sourceUrl,
    inferredFromQuantity: row.inferredFromQuantity || null,
  }));
}

function serializeCsv(rows) {
  const header = [
    "row_type",
    "format",
    "material",
    "housing",
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
      row.housingLabel || "",
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
  const rows = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.extracted_rows)
      ? payload.extracted_rows
      : [];

  return rows
    .map((row) => {
      const sourceMaterialLabel = normalizeLabel(row.sourceMaterialLabel || row.materialLabel || "");
      const housingLabel = normalizeLabel(row.housingLabel || "");
      const quantity = Number(row.quantity);
      const eur = Number(row.eur);
      if (!sourceMaterialLabel || !housingLabel || !Number.isFinite(quantity) || !Number.isFinite(eur))
        return null;
      return {
        sourceMaterialLabel,
        housingLabel,
        sourceUrl: row.sourceUrl || "",
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
    throw new Error("Missing Supabase env. Expected VITE_SUPABASE_URL and a Supabase key.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureProduct(
  client,
  tenantId,
  productName,
  productSlug,
  { formatLabel, widthMm, heightMm }
) {
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
      description: "Roll up - auto-imported from wir-machen-druck.de",
      category: "tryksager",
      pricing_type: "matrix",
      is_published: false,
      preset_key: "custom",
      technical_specs: {
        width_mm: widthMm,
        height_mm: heightMm,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: formatLabel,
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

function buildPricingStructure({
  materialGroup,
  materialValues,
  formatGroup,
  formatValue,
  housingGroup,
  housingValues,
  housingGroupName,
}) {
  const quantities = Array.from(new Set(materialValues.flatMap((value) => value.__quantities || []))).sort(
    (a, b) => a - b
  );

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
        id: "row-housing",
        title: "",
        description: "",
        columns: [
          {
            id: "housing-section",
            sectionType: "products",
            groupId: housingGroup.id,
            valueIds: housingValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: housingGroupName,
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
  housingGroupName,
  formatLabel,
  widthMm,
  heightMm,
  mappedRows,
  dryRun,
}) {
  if (mappedRows.length === 0) throw new Error("No mapped rows to import.");

  const activeMaterialLabels = Array.from(new Set(mappedRows.map((row) => row.materialLabel)));
  const activeHousingLabels = Array.from(new Set(mappedRows.map((row) => row.housingLabel)));
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      uniqueMaterials: activeMaterialLabels.length,
      uniqueHousingOptions: activeHousingLabels.length,
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
  const housingGroup = await ensureGroup(client, context, {
    name: housingGroupName,
    kind: "other",
    sortOrder: 2,
    uiMode: "buttons",
  });

  const formatValue = await ensureValue(client, context, formatGroup, formatLabel, {
    widthMm,
    heightMm,
  });

  const materialMap = new Map();
  for (const materialLabel of activeMaterialLabels) {
    const value = await ensureValue(client, context, materialGroup, materialLabel);
    value.__quantities = quantities;
    materialMap.set(materialLabel, value);
  }
  const housingMap = new Map();
  for (const housingLabel of activeHousingLabels) {
    const value = await ensureValue(client, context, housingGroup, housingLabel);
    housingMap.set(housingLabel, value);
  }

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValues: activeMaterialLabels.map((name) => materialMap.get(name)).filter(Boolean),
    formatGroup,
    formatValue,
    housingGroup,
    housingValues: activeHousingLabels.map((name) => housingMap.get(name)).filter(Boolean),
    housingGroupName,
  });

  const dedupeRows = new Map();
  mappedRows.forEach((row) => {
    const materialValue = materialMap.get(row.materialLabel);
    const housingValue = housingMap.get(row.housingLabel);
    if (!materialValue || !housingValue) return;

    const variantName = `${formatValue.id}::${housingValue.id}`;
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
          variantValueIds: [housingValue.id],
        },
        source: "roll_up_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceMaterialLabel: row.sourceMaterialLabel,
        sourceHousingLabel: row.housingLabel,
        rowType: row.rowType,
        eur: row.eur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
        inferredFromQuantity: row.inferredFromQuantity,
      },
    };

    const key = `${payload.product_id}|${payload.variant_name}|${payload.variant_value}|${housingValue.id}|${payload.quantity}`;
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
      technical_specs: {
        width_mm: widthMm,
        height_mm: heightMm,
        bleed_mm: 3,
        min_dpi: 300,
        is_free_form: false,
        standard_format: formatLabel,
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
    uniqueMaterials: activeMaterialLabels.length,
    uniqueHousingOptions: activeHousingLabels.length,
    quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Roll Up Import ===");
  console.log(`Silver URL: ${args.sourceUrl}`);
  console.log(`Black URL:  ${args.blackSourceUrl}`);
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  let extractedRows = [];
  let materialLabels = [];
  let missingQuantities = [];
  if (args.fromTargetedJson) {
    extractedRows = loadSourceRowsFromTargetedJson(args.fromTargetedJson);
    materialLabels = Array.from(new Set(extractedRows.map((row) => row.sourceMaterialLabel)));
  } else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      const sources = [
        { label: "Silver Housing", sourceUrl: args.sourceUrl },
        { label: "Silver Black Housing", sourceUrl: args.blackSourceUrl },
      ];
      for (const source of sources) {
        const extractionResult = await extractTargetedRows(page, source.sourceUrl, source.label);
        extractedRows.push(...extractionResult.extractedRows);
        materialLabels.push(...extractionResult.materialLabels);
        missingQuantities.push(
          ...extractionResult.missingQuantities.map((quantity) => `${source.label}:${quantity}`)
        );
      }
    } finally {
      await browser.close();
    }
    materialLabels = Array.from(new Set(materialLabels));
  }

  if (!extractedRows || extractedRows.length === 0) {
    throw new Error("No source rows extracted from supplier page.");
  }

  const transformedRows = buildTransformedSourceRows(extractedRows);
  const mappedRows = buildMappedRows(transformedRows, { formatLabel: args.formatLabel });

  const ts = timestampForFile();
  const slugDir = kebabCase(args.productSlug || "roll-up");
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
          source_urls: {
            silver: args.sourceUrl,
            black: args.blackSourceUrl,
          },
        },
        housing_variants: HOUSING_VARIANTS,
        material_labels: materialLabels,
        extracted_rows: transformedRows,
        missing_quantities: missingQuantities,
      },
      null,
      2
    )
  );
  fs.writeFileSync(cleanPath, serializeCsv(mappedRows));

  const importResult = await importToSupabase({
    tenantId: args.tenantId,
    productName: args.productName,
    productSlug: args.productSlug,
    housingGroupName: args.housingGroupName,
    formatLabel: args.formatLabel,
    widthMm: args.widthMm,
    heightMm: args.heightMm,
    mappedRows,
    dryRun: args.dryRun,
  });

  console.log("");
  console.log("=== Snapshot Files ===");
  console.log(`Raw JSON:   ${path.relative(process.cwd(), rawPath)}`);
  console.log(`Clean CSV:  ${path.relative(process.cwd(), cleanPath)}`);
  console.log("");
  console.log("=== Import Result ===");
  console.log(JSON.stringify(importResult, null, 2));
  if (missingQuantities.length > 0) {
    console.log("");
    console.log(`Missing requested quantities (2..15): ${missingQuantities.join(" | ")}`);
  }
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
