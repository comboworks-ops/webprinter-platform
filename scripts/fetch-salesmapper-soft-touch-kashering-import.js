#!/usr/bin/env node
/**
 * fetch-salesmapper-soft-touch-kashering-import.js
 *
 * Imports one matrix-v1 product from wir-machen-druck:
 *   - A4 folder, Softfeel-Folie (4+0 / 4+4), with optional Spot Lak toggle
 *
 * Product:
 *   - Name: Salgsmapper soft touch kashering
 *   - Format: A4 salgsmappe soft touch
 *   - Vertical axis: material (single material)
 *   - Rows:
 *       1) Tryk: 4+0 / 4+4 (required)
 *       2) Spot Lak: Uden Spot Lak / Med Spot Lak (required)
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
const DEFAULT_PRODUCT_NAME = "Salgsmapper soft touch kashering";
const DEFAULT_PRODUCT_SLUG = "salgsmapper-soft-touch-kashering";
const DEFAULT_FORMAT_LABEL = "A4 salgsmappe soft touch";

const EUR_TO_DKK = 7.5;
const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

// Same ladder used in existing salesmapper folder imports.
const TARGET_QUANTITIES = [
  50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000,
  5000,
];

const PRINT_MODES = ["4+0", "4+4"];
const SPOT_LAK_VALUES = ["Uden Spot Lak", "Med Spot Lak"];

const MATERIAL_LABEL =
  "0,36 mm starker Bilderdruckkarton 350g matt für 1mm Mappen-Füllhöhe (zertifiziert mit FSC-Siegel), mittlere Steifigkeit";

const SOURCE_PAGES = [
  {
    printMode: "4+0",
    spotLak: "Uden Spot Lak",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-softfeelfolie-kaschiert.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    printMode: "4+4",
    spotLak: "Uden Spot Lak",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-softfeelfolie-kaschiert.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    printMode: "4+0",
    spotLak: "Med Spot Lak",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-softfeelfolie-und-partieller-uvlackveredelung.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    printMode: "4+4",
    spotLak: "Med Spot Lak",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-softfeelfolie-und-partieller-uvlackveredelung.html",
    targetQuantities: TARGET_QUANTITIES,
  },
];

const MATERIAL_PATTERN =
  /Bilderdruckkarton\s+350g\s+matt\s+für\s+1mm\s+Mappen[-\s]*Füllhöhe/i;

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-salesmapper-soft-touch-kashering-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || "",
    dryRun: argv.includes("--dry-run"),
    tenantId: DEFAULT_TENANT_ID,
    productName: DEFAULT_PRODUCT_NAME,
    productSlug: DEFAULT_PRODUCT_SLUG,
  };

  const tenantIdx = argv.indexOf("--tenant");
  if (tenantIdx !== -1 && argv[tenantIdx + 1]) args.tenantId = argv[tenantIdx + 1];

  const nameIdx = argv.indexOf("--name");
  if (nameIdx !== -1 && argv[nameIdx + 1]) args.productName = argv[nameIdx + 1];

  const slugIdx = argv.indexOf("--slug");
  if (slugIdx !== -1 && argv[slugIdx + 1]) args.productSlug = argv[slugIdx + 1];

  return args;
}

function normalizeLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuantityPriceText(text) {
  const match = String(text || "").match(
    /([\d.]+)\s*Stück\s*\(([-\d.,]+)\s*Euro/i
  );
  if (!match) return null;

  const quantity = Number(String(match[1]).replace(/\./g, ""));
  const eur = parseLocalizedNumber(match[2]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
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
      const retryable = /Execution context|Target page|Timeout/i.test(message);
      if (!retryable || i === retries) throw error;
    }
  }
  throw lastError;
}

async function extractRowsForPage(page, sourcePage) {
  console.log(`  Navigating to: ${sourcePage.url}`);
  await page.goto(sourcePage.url, { waitUntil: "networkidle", timeout: 90_000 });

  const materials = await withRetry(() =>
    page.$$eval("#sorten option", (nodes) =>
      nodes.map((node) => ({
        value: node.getAttribute("value") || "",
        label: (node.textContent || "").trim(),
      }))
    )
  );

  const targetMaterial = materials
    .map((item) => ({ ...item, label: normalizeLabel(item.label) }))
    .find((item) => item.value && MATERIAL_PATTERN.test(item.label));

  if (!targetMaterial) {
    console.warn(`  ⚠ Missing target material on page: ${sourcePage.url}`);
    return [];
  }

  await withRetry(async () => {
    await page.selectOption("#sorten", targetMaterial.value);
    await page.waitForTimeout(1200);
  });

  const qtyTexts = await withRetry(() =>
    page.$$eval("#wmd_shirt_auflage option", (nodes) =>
      nodes.map((node) => (node.textContent || "").trim())
    )
  );

  const rows = [];
  qtyTexts.forEach((text) => {
    const parsed = parseQuantityPriceText(text);
    if (!parsed) return;
    if (!sourcePage.targetQuantities.includes(parsed.quantity)) return;
    rows.push({
      formatLabel: DEFAULT_FORMAT_LABEL,
      printMode: sourcePage.printMode,
      spotLakLabel: sourcePage.spotLak,
      materialLabel: MATERIAL_LABEL,
      quantity: parsed.quantity,
      eur: parsed.eur,
      sourceOptionText: text,
      sourceMaterialLabel: targetMaterial.label,
      detailUrl: sourcePage.url,
    });
  });

  console.log(`    ${MATERIAL_LABEL.substring(0, 70)} → ${rows.length} prices`);
  return rows;
}

function serializeCsv(rows) {
  const header = [
    "format",
    "tryk",
    "spot_lak",
    "material",
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
      row.formatLabel,
      row.printMode,
      row.spotLakLabel,
      row.materialLabel,
      row.quantity,
      row.eur,
      row.dkkBase,
      row.tierMultiplier,
      row.dkkFinal,
      row.detailUrl,
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
      description: "Salgsmapper soft touch kashering – auto-imported",
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
    .select(
      "id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)"
    )
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function ensureGroup(client, context, { name, kind, sortOrder }) {
  const normalizedName = normalizeLabel(name).toLowerCase();
  const existing = context.groups.find(
    (group) =>
      group.kind === kind &&
      normalizeLabel(group.name).toLowerCase() === normalizedName
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
    .select(
      "id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)"
    )
    .single();
  if (error) throw error;

  const normalized = { ...data, values: data.values || [] };
  context.groups.push(normalized);
  return normalized;
}

async function ensureValue(client, context, group, valueName) {
  const normalizedName = normalizeLabel(valueName);
  const existing = (group.values || []).find(
    (value) =>
      String(value.name || "").toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) return existing;

  const { data, error } = await client
    .from("product_attribute_values")
    .insert({
      tenant_id: context.tenantId,
      product_id: context.productId,
      group_id: group.id,
      name: normalizedName,
      sort_order: (group.values || []).length,
      enabled: true,
    })
    .select("id, name, width_mm, height_mm, meta")
    .single();
  if (error) throw error;

  group.values = [...(group.values || []), data];
  return data;
}

function buildPricingStructure({
  materialGroup,
  materialValues,
  formatGroup,
  formatValues,
  printModeGroup,
  printModeValues,
  spotLakGroup,
  spotLakValues,
  allQuantities,
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
            title: "Tryk",
            description: "",
          },
        ],
      },
      {
        id: "row-spot-lak",
        title: "",
        description: "",
        columns: [
          {
            id: "spot-lak-section",
            sectionType: "finishes",
            groupId: spotLakGroup.id,
            valueIds: spotLakValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Spot Lak",
            description: "",
          },
        ],
      },
    ],
    quantities: allQuantities,
  };
}

async function importToSupabase({
  tenantId,
  productName,
  productSlug,
  transformedRows,
  dryRun,
}) {
  if (!transformedRows.length) throw new Error("No rows to import");

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: transformedRows.length,
      uniquePrintModes: new Set(transformedRows.map((row) => row.printMode)).size,
      uniqueSpotLakValues: new Set(
        transformedRows.map((row) => row.spotLakLabel)
      ).size,
      uniqueMaterials: new Set(transformedRows.map((row) => row.materialLabel)).size,
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
  const printModeGroup = await ensureGroup(client, context, {
    name: "Tryk",
    kind: "finish",
    sortOrder: 1,
  });
  const spotLakGroup = await ensureGroup(client, context, {
    name: "Spot Lak",
    kind: "finish",
    sortOrder: 2,
  });
  const materialGroup = await ensureGroup(client, context, {
    name: "Materiale",
    kind: "material",
    sortOrder: 3,
  });

  const formatValue = await ensureValue(
    client,
    context,
    formatGroup,
    DEFAULT_FORMAT_LABEL
  );
  const printModeMap = new Map();
  for (const valueName of PRINT_MODES) {
    printModeMap.set(
      valueName,
      await ensureValue(client, context, printModeGroup, valueName)
    );
  }
  const spotLakMap = new Map();
  for (const valueName of SPOT_LAK_VALUES) {
    spotLakMap.set(
      valueName,
      await ensureValue(client, context, spotLakGroup, valueName)
    );
  }
  const materialValue = await ensureValue(
    client,
    context,
    materialGroup,
    MATERIAL_LABEL
  );

  const allQuantities = Array.from(
    new Set(transformedRows.map((row) => row.quantity))
  ).sort((a, b) => a - b);

  const pricingStructure = buildPricingStructure({
    materialGroup,
    materialValues: [materialValue],
    formatGroup,
    formatValues: [formatValue],
    printModeGroup,
    printModeValues: PRINT_MODES.map((name) => printModeMap.get(name)).filter(
      Boolean
    ),
    spotLakGroup,
    spotLakValues: SPOT_LAK_VALUES.map((name) => spotLakMap.get(name)).filter(
      Boolean
    ),
    allQuantities,
  });

  const dedupe = new Map();
  transformedRows.forEach((row) => {
    const printModeValue = printModeMap.get(row.printMode);
    const spotLakValue = spotLakMap.get(row.spotLakLabel);
    if (!printModeValue || !spotLakValue) return;

    const variantName = [formatValue.id, printModeValue.id, spotLakValue.id]
      .sort()
      .join("|");
    const variantValueIds = [printModeValue.id, spotLakValue.id].sort();
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
        spotLakId: spotLakValue.id,
        variantValueIds,
        selectionMap: {
          format: formatValue.id,
          material: materialValue.id,
          variantValueIds,
        },
        source: "salesmapper_soft_touch_kashering_fetch_import",
        sourceUrl: row.detailUrl,
        sourceMaterialLabel: row.sourceMaterialLabel,
        eur: row.eur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
      },
    };

    dedupe.set(
      `${payload.product_id}|${variantName}|${payload.variant_value}|${row.quantity}`,
      payload
    );
  });

  const priceRows = Array.from(dedupe.values());
  const { error: updateError } = await client
    .from("products")
    .update({
      name: productName,
      slug: productSlug,
      pricing_type: "matrix",
      pricing_structure: pricingStructure,
    })
    .eq("id", ensured.product.id);
  if (updateError) throw updateError;

  const { error: deleteError } = await client
    .from("generic_product_prices")
    .delete()
    .eq("product_id", ensured.product.id);
  if (deleteError) throw deleteError;

  let inserted = 0;
  for (let i = 0; i < priceRows.length; i += 500) {
    const batch = priceRows.slice(i, i + 500);
    const { error } = await client.from("generic_product_prices").insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }

  return {
    dryRun: false,
    productId: ensured.product.id,
    productSlug,
    productCreated: ensured.created,
    rowsInserted: inserted,
  };
}

async function runImport(args) {
  const root = process.cwd();
  ensureDir(path.join(root, "pricing_raw"));
  ensureDir(path.join(root, "pricing_clean"));

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("https://www.wir-machen-druck.de", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    try {
      await page
        .locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler")
        .click({ timeout: 5_000 });
      console.log("Accepted cookies");
    } catch {
      // Cookie banner may not be present.
    }

    const extractedRows = [];
    for (const sourcePage of SOURCE_PAGES) {
      console.log(
        `\n── ${DEFAULT_FORMAT_LABEL} (${sourcePage.printMode}) [${sourcePage.spotLak}] ──`
      );
      const rows = await extractRowsForPage(page, sourcePage);
      extractedRows.push(...rows);
      console.log(`  Total rows from page: ${rows.length}`);
    }

    if (!extractedRows.length) throw new Error("No rows extracted");

    const dedupe = new Map();
    extractedRows.forEach((row) => {
      const pricing = transformedPrice(row.eur);
      dedupe.set(
        [
          row.formatLabel,
          row.printMode,
          row.spotLakLabel,
          row.materialLabel,
          row.quantity,
        ].join("||"),
        { ...row, ...pricing }
      );
    });

    const transformedRows = Array.from(dedupe.values()).sort(
      (a, b) =>
        a.formatLabel.localeCompare(b.formatLabel) ||
        a.printMode.localeCompare(b.printMode) ||
        a.spotLakLabel.localeCompare(b.spotLakLabel) ||
        a.materialLabel.localeCompare(b.materialLabel) ||
        a.quantity - b.quantity
    );

    const timestamp = timestampForFile();
    const rawPath = path.join(root, "pricing_raw", args.productSlug, `${timestamp}.json`);
    const cleanPath = path.join(
      root,
      "pricing_clean",
      args.productSlug,
      `${timestamp}.csv`
    );
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
          },
          source_pages: SOURCE_PAGES,
          extracted_rows: extractedRows,
          transformed_rows: transformedRows,
        },
        null,
        2
      ),
      "utf8"
    );
    fs.writeFileSync(cleanPath, serializeCsv(transformedRows), "utf8");

    console.log(`\nRaw snapshot: ${rawPath}`);
    console.log(`Clean CSV: ${cleanPath}`);
    console.log(`Extracted rows: ${extractedRows.length}`);
    console.log(`Prepared rows: ${transformedRows.length}`);

    const result = await importToSupabase({
      tenantId: args.tenantId,
      productName: args.productName,
      productSlug: args.productSlug,
      transformedRows,
      dryRun: args.dryRun,
    });

    if (result.dryRun) {
      console.log("\nDry-run complete");
      console.log(`  Slug: ${result.productSlug}`);
      console.log(`  Rows prepared: ${result.rowsPrepared}`);
      console.log(`  Print modes: ${result.uniquePrintModes}`);
      console.log(`  Spot Lak values: ${result.uniqueSpotLakValues}`);
      console.log(`  Materials: ${result.uniqueMaterials}`);
      return;
    }

    console.log("\n✅ Import complete");
    console.log(`  Product ID: ${result.productId}`);
    console.log(`  Slug: ${result.productSlug}`);
    console.log(`  Created: ${result.productCreated ? "yes" : "no (existing)"}`);
    console.log(`  Rows inserted: ${result.rowsInserted}`);
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
    throw new Error(`Unknown command: ${args.command}`);
  }
  await runImport(args);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
