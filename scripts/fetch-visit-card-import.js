#!/usr/bin/env node
/**
 * fetch-visit-card-import.js
 *
 * Imports matrix pricing from wir-machen-druck:
 *   https://www.wir-machen-druck.de/visitenkarten-quer-44-farbig-85-x-55-mm-beidseitiger-druck.html
 *
 * Product:
 *   - Name: Visit card
 *   - Vertical axis: material
 *   - Hidden format: Standard (85x55 mm)
 *   - Required selector: Motive (1..20)
 *   - Quantities: 100,250,500,1000,1500,2000,2500,3000,4000,5000
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
  "https://www.wir-machen-druck.de/visitenkarten-quer-44-farbig-85-x-55-mm-beidseitiger-druck.html";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Visit card";
const DEFAULT_PRODUCT_SLUG = "visit-card";
const DEFAULT_FORMAT_LABEL = "Standard";
const DEFAULT_WIDTH_MM = 85;
const DEFAULT_HEIGHT_MM = 55;

const EUR_TO_DKK = 7.6;
const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

const TARGET_QUANTITIES = [100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
const TARGET_MOTIVES = Array.from({ length: 20 }, (_, index) => index + 1);

const TARGET_MATERIALS = [
  "350 g/m² hochwertiger Qualitätsdruck matt",
  "400 g/m² hochwertiger Qualitätsdruck auf Premium-Naturkarton Munken Polar hochweiß (1,13-faches Volumen, holzfrei, FSC-zertifiziert)",
  "300 g/m² hochwertiger Qualitätsdruck auf Recyclingkarton weiß",
  "283 g/m² hochwertiger Qualitätsdruck auf Kraftkarton braun mit glatter Vorderseite",
];

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-visit-card-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>] [--url <supplier-url>] [--format-label <format>] [--width-mm <num>] [--height-mm <num>] [--from-targeted-json <path>]",
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

async function extractTargetedRows(page, sourceUrl) {
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

  const materialValueByLabel = new Map(materialOptions.map((item) => [item.label, item.value]));

  const missingMaterials = TARGET_MATERIALS.filter((label) => !materialValueByLabel.has(label));
  if (missingMaterials.length > 0) {
    throw new Error(
      `Missing required materials on supplier page: ${missingMaterials.join(" | ")}`
    );
  }

  const motiveSelectExists = await page.$("select[name='menge']");
  if (!motiveSelectExists) {
    throw new Error("Motive selector (select[name='menge']) not found on supplier page");
  }

  const extractedRows = [];
  const missingByMaterialMotive = [];

  for (const materialLabel of TARGET_MATERIALS) {
    const materialValue = materialValueByLabel.get(materialLabel);
    if (!materialValue) continue;

    await withRetry(async () => {
      await page.selectOption("#sorten", materialValue);
      await page.waitForTimeout(900);
    }, 3);

    for (const motive of TARGET_MOTIVES) {
      await withRetry(async () => {
        await page.selectOption("select[name='menge']", String(motive));
        await page.waitForTimeout(700);
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
        const parsed = parseQuantityPriceText(text);
        if (!parsed) return;
        if (!TARGET_QUANTITIES.includes(parsed.quantity)) return;
        perCombination.set(parsed.quantity, {
          sourceMaterialLabel: materialLabel,
          motive,
          quantity: parsed.quantity,
          eur: parsed.eur,
          sourceOptionText: text,
        });
      });

      const rows = Array.from(perCombination.values()).sort((a, b) => a.quantity - b.quantity);
      extractedRows.push(...rows);

      const missingQuantities = TARGET_QUANTITIES.filter((qty) => !perCombination.has(qty));
      if (missingQuantities.length > 0) {
        missingByMaterialMotive.push({
          materialLabel,
          motive,
          missingQuantities,
        });
      }

      console.log(
        `  ${materialLabel.substring(0, 62).padEnd(62)} | motive ${String(motive).padStart(
          2,
          " "
        )} -> found ${String(rows.length).padStart(2, " ")} / ${TARGET_QUANTITIES.length}`
      );
    }
  }

  return {
    extractedRows,
    materialLabels: TARGET_MATERIALS,
    motives: TARGET_MOTIVES,
    missingByMaterialMotive,
  };
}

function buildTransformedSourceRows(sourceRows) {
  const dedupe = new Map();
  sourceRows.forEach((row) => {
    const pricing = transformedPrice(row.eur);
    dedupe.set(`${row.sourceMaterialLabel}||${row.motive}||${row.quantity}`, {
      ...row,
      dkkBase: pricing.dkkBase,
      tierMultiplier: pricing.tierMultiplier,
      dkkFinal: pricing.dkkFinal,
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => {
    if (a.sourceMaterialLabel !== b.sourceMaterialLabel) {
      return a.sourceMaterialLabel.localeCompare(b.sourceMaterialLabel);
    }
    if (a.motive !== b.motive) return a.motive - b.motive;
    return a.quantity - b.quantity;
  });
}

function buildMappedRows(transformedSourceRows, { formatLabel, sourceUrl }) {
  return transformedSourceRows.map((row) => ({
    rowType: "base_material_motive",
    formatLabel,
    materialLabel: row.sourceMaterialLabel,
    motive: row.motive,
    quantity: row.quantity,
    eur: row.eur,
    dkkBase: row.dkkBase,
    tierMultiplier: row.tierMultiplier,
    dkkFinal: row.dkkFinal,
    sourceMaterialLabel: row.sourceMaterialLabel,
    sourceUrl,
    inferredFromQuantity: row.inferredFromQuantity || null,
  }));
}

function serializeCsv(rows) {
  const header = [
    "row_type",
    "format",
    "material",
    "motive",
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
      row.motive,
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
      const motive = Number(row.motive);
      const quantity = Number(row.quantity);
      const eur = Number(row.eur);
      if (!sourceMaterialLabel || !Number.isFinite(motive) || !Number.isFinite(quantity) || !Number.isFinite(eur)) {
        return null;
      }
      return {
        sourceMaterialLabel,
        motive,
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
      icon_text: "Visit Card",
      description: "Visit card - auto-imported from wir-machen-druck.de",
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
  motiveGroup,
  motiveValues,
  quantities,
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
        id: "row-motive",
        title: "",
        description: "",
        columns: [
          {
            id: "motive-section",
            sectionType: "other",
            groupId: motiveGroup.id,
            valueIds: motiveValues.map((value) => value.id),
            ui_mode: "dropdown",
            selection_mode: "required",
            valueSettings: {},
            title: "Motive",
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

  const activeMaterialLabels = TARGET_MATERIALS.filter((materialLabel) =>
    mappedRows.some((row) => row.materialLabel === materialLabel)
  );
  const activeMotives = TARGET_MOTIVES.filter((motive) =>
    mappedRows.some((row) => row.motive === motive)
  );
  const quantities = Array.from(new Set(mappedRows.map((row) => row.quantity))).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: mappedRows.length,
      uniqueMaterials: activeMaterialLabels.length,
      uniqueMotives: activeMotives.length,
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
  const motiveGroup = await ensureGroup(client, context, {
    name: "Motive",
    kind: "other",
    sortOrder: 2,
    uiMode: "dropdown",
  });

  const formatValue = await ensureValue(client, context, formatGroup, formatLabel, {
    widthMm,
    heightMm,
  });

  const materialMap = new Map();
  for (const materialLabel of activeMaterialLabels) {
    materialMap.set(
      materialLabel,
      await ensureValue(client, context, materialGroup, materialLabel)
    );
  }

  const motiveMap = new Map();
  for (const motive of activeMotives) {
    motiveMap.set(
      motive,
      await ensureValue(client, context, motiveGroup, String(motive))
    );
  }

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValues: activeMaterialLabels.map((name) => materialMap.get(name)).filter(Boolean),
    formatGroup,
    formatValue,
    motiveGroup,
    motiveValues: activeMotives.map((motive) => motiveMap.get(motive)).filter(Boolean),
    quantities,
  });

  const dedupeRows = new Map();
  mappedRows.forEach((row) => {
    const materialValue = materialMap.get(row.materialLabel);
    const motiveValue = motiveMap.get(row.motive);
    if (!materialValue || !motiveValue) return;

    const variantIds = [formatValue.id, motiveValue.id].sort();
    const variantName = variantIds.join("|");

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
        motiveId: motiveValue.id,
        variantValueIds: [motiveValue.id],
        selectionMap: {
          format: formatValue.id,
          material: materialValue.id,
          motive: motiveValue.id,
          variant: motiveValue.id,
          variantValueIds: [motiveValue.id],
        },
        source: "visit_card_fetch_import",
        sourceUrl: row.sourceUrl,
        sourceMaterialLabel: row.sourceMaterialLabel,
        rowType: row.rowType,
        motive: row.motive,
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
    uniqueMotives: activeMotives.length,
    quantities,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command !== "import") {
    console.log(usage());
    process.exit(1);
  }

  console.log("=== Visit Card Import ===");
  console.log(`Source URL: ${args.sourceUrl}`);
  console.log(`Tenant: ${args.tenantId}`);
  console.log(`Product: ${args.productName} (${args.productSlug})`);
  console.log(`Dry run: ${args.dryRun}`);

  let extractionMeta = {
    materialLabels: TARGET_MATERIALS,
    motives: TARGET_MOTIVES,
    missingByMaterialMotive: [],
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
  const slugDir = kebabCase(args.productSlug || "visit-card");
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
        material_labels: extractionMeta.materialLabels || TARGET_MATERIALS,
        motive_values: extractionMeta.motives || TARGET_MOTIVES,
        missing_by_material_motive: extractionMeta.missingByMaterialMotive || [],
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
    console.log(`  Materials: ${result.uniqueMaterials}`);
    console.log(`  Motives: ${result.uniqueMotives}`);
    console.log(`  Quantities: ${result.quantities.join(", ")}`);
    return;
  }

  console.log("Import complete.");
  console.log(`  Product ID: ${result.productId}`);
  console.log(`  Product slug: ${result.productSlug}`);
  console.log(`  Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
  console.log(`  Rows inserted: ${result.rowsInserted}`);
  console.log(`  Materials: ${result.uniqueMaterials}`);
  console.log(`  Motives: ${result.uniqueMotives}`);
  console.log(`  Quantities: ${result.quantities.join(", ")}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
