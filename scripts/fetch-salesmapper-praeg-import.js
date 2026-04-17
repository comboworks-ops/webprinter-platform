#!/usr/bin/env node
/**
 * fetch-salesmapper-praeg-import.js
 *
 * Scrapes prices for "salgsmapper med præg" from wir-machen-druck.de and imports
 * into matrix-v1 product pricing.
 *
 * Axes:
 *   - Format: A4 / A5
 *   - Tryk: 4+0 / 4+4
 *   - Prægning: Gold / Silver / Blindprægning
 *   - Materiale (vertical): 3 fixed folder materials (1mm fill height)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import {
  parseLocalizedNumber,
} from "./product-import/ul-prices.js";
import { ensureDir, timestampForFile } from "./product-import/snapshot-io.js";
import {
  buildSalesmapperFormatSection,
  buildSalesmapperMaterialAxis,
  buildSalesmapperNormalizedRows,
  buildSalesmapperOptionSection,
  publishSalesmapperMatrix,
  salesmapperTransformedPrice,
} from "./product-import/shared/salesmapper-matrix.js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Salgsmapper med præg";
const DEFAULT_PRODUCT_SLUG = "salgsmapper-med-praeg";
const EUR_TO_DKK = 7.5;

const TIERS = [
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

// Same as other sales folder imports.
const TARGET_QUANTITIES = [
  50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000,
  5000,
];

const SOURCE_PAGES = [
  // A4 4+0
  {
    formatLabel: "A4 salgsmappe med præg",
    printMode: "4+0",
    embossingLabel: "Gold",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-heissfolienpraegung-gold.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A4 salgsmappe med præg",
    printMode: "4+0",
    embossingLabel: "Silver",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-heissfolienpraegung-silber.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A4 salgsmappe med præg",
    printMode: "4+0",
    embossingLabel: "Blindprægning",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-blindpraegung.html",
    targetQuantities: TARGET_QUANTITIES,
  },

  // A4 4+4
  {
    formatLabel: "A4 salgsmappe med præg",
    printMode: "4+4",
    embossingLabel: "Gold",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-heissfolienpraegung-gold.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A4 salgsmappe med præg",
    printMode: "4+4",
    embossingLabel: "Silver",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-heissfolienpraegung-silber.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A4 salgsmappe med præg",
    printMode: "4+4",
    embossingLabel: "Blindprægning",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-blindpraegung.html",
    targetQuantities: TARGET_QUANTITIES,
  },

  // A5 4+0
  {
    formatLabel: "A5 salgsmappe med præg",
    printMode: "4+0",
    embossingLabel: "Gold",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-heissfolienpraegung-gold.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A5 salgsmappe med præg",
    printMode: "4+0",
    embossingLabel: "Silver",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-heissfolienpraegung-silber.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A5 salgsmappe med præg",
    printMode: "4+0",
    embossingLabel: "Blindprægning",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-blindpraegung.html",
    targetQuantities: TARGET_QUANTITIES,
  },

  // A5 4+4
  {
    formatLabel: "A5 salgsmappe med præg",
    printMode: "4+4",
    embossingLabel: "Gold",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-heissfolienpraegung-gold.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A5 salgsmappe med præg",
    printMode: "4+4",
    embossingLabel: "Silver",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-heissfolienpraegung-silber.html",
    targetQuantities: TARGET_QUANTITIES,
  },
  {
    formatLabel: "A5 salgsmappe med præg",
    printMode: "4+4",
    embossingLabel: "Blindprægning",
    url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-blindpraegung.html",
    targetQuantities: TARGET_QUANTITIES,
  },
];

const FORMAT_ORDER = ["A4 salgsmappe med præg", "A5 salgsmappe med præg"];
const PRINT_MODE_ORDER = ["4+0", "4+4"];
const EMBOSSING_ORDER = ["Gold", "Silver", "Blindprægning"];

const MATERIAL_MATCHERS = [
  {
    pattern: /Chromokarton\s+255g\s+für\s+1mm\s+Mappen[-\s]*Füllhöhe/i,
    label: "0,40 mm starker Chromokarton 255g für 1mm Mappen-Füllhöhe",
  },
  {
    pattern: /Bilderdruckkarton\s+350g\s+matt\s+für\s+1mm\s+Mappen[-\s]*Füllhöhe/i,
    label:
      "0,36 mm starker Bilderdruckkarton 350g matt für 1mm Mappen-Füllhöhe (zertifiziert mit FSC-Siegel), mittlere Steifigkeit",
  },
  {
    pattern: /Recyclingkarton\s+300g\s+weiß\s+für\s+1mm\s+Mappen[-\s]*Füllhöhe/i,
    label: "0,36 mm starker Recyclingkarton 300g weiß für 1mm Mappen-Füllhöhe",
  },
];

function usage() {
  return [
    "Usage:",
    "  node scripts/fetch-salesmapper-praeg-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]",
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
  return salesmapperTransformedPrice(eur);
}

function resolveMaterialLabel(rawLabel) {
  const normalized = normalizeLabel(rawLabel);
  const match = MATERIAL_MATCHERS.find((entry) => entry.pattern.test(normalized));
  return match ? match.label : null;
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

  const targetMaterials = materials
    .map((item) => ({ ...item, label: normalizeLabel(item.label) }))
    .map((item) => ({ ...item, mappedLabel: resolveMaterialLabel(item.label) }))
    .filter((item) => item.value && item.mappedLabel);

  if (!targetMaterials.length) {
    console.warn(`  ⚠ No matching materials on page: ${sourcePage.url}`);
    return [];
  }

  const rows = [];
  for (const material of targetMaterials) {
    await withRetry(async () => {
      await page.selectOption("#sorten", material.value);
      await page.waitForTimeout(1200);
    });

    const qtyTexts = await withRetry(() =>
      page.$$eval("#wmd_shirt_auflage option", (nodes) =>
        nodes.map((node) => (node.textContent || "").trim())
      )
    );

    qtyTexts.forEach((text) => {
      const parsed = parseQuantityPriceText(text);
      if (!parsed) return;
      if (!sourcePage.targetQuantities.includes(parsed.quantity)) return;
      rows.push({
        formatLabel: sourcePage.formatLabel,
        printMode: sourcePage.printMode,
        embossingLabel: sourcePage.embossingLabel,
        materialLabel: material.mappedLabel,
        quantity: parsed.quantity,
        eur: parsed.eur,
        sourceOptionText: text,
        sourceMaterialLabel: material.label,
        detailUrl: sourcePage.url,
      });
    });
  }

  console.log(`  Total rows from page: ${rows.length}`);
  return rows;
}

function serializeCsv(rows) {
  const header = [
    "format",
    "tryk",
    "praegning",
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
      row.embossingLabel,
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
      description: "Salgsmapper med præg – auto-imported",
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
  embossingGroup,
  embossingValues,
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
        id: "row-embossing",
        title: "",
        description: "",
        columns: [
          {
            id: "embossing-section",
            sectionType: "finishes",
            groupId: embossingGroup.id,
            valueIds: embossingValues.map((value) => value.id),
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: "Prægning",
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
  if (!transformedRows.length) throw new Error("No rows");

  if (dryRun) {
    return {
      dryRun: true,
      productSlug,
      rowsPrepared: transformedRows.length,
      uniqueFormats: new Set(transformedRows.map((row) => row.formatLabel)).size,
      uniquePrintModes: new Set(transformedRows.map((row) => row.printMode)).size,
      uniqueEmbossing: new Set(transformedRows.map((row) => row.embossingLabel)).size,
      uniqueMaterials: new Set(transformedRows.map((row) => row.materialLabel)).size,
    };
  }

  const client = getSupabaseClient();
  const ensured = await ensureProduct(client, tenantId, productName, productSlug);
  const materialNames = MATERIAL_MATCHERS.map((entry) => entry.label);
  const normalizedRows = buildSalesmapperNormalizedRows(transformedRows, {
    importerKey: "salesmapper_praeg_fetch_import",
    productFamily: "salesmapper_folders",
    selectionsForRow: (row) => ({
      material: row.materialLabel,
      format: row.formatLabel,
      printMode: row.printMode,
      embossing: row.embossingLabel,
    }),
    extraDataForRow: (row) => ({
      sourceMaterialLabel: row.sourceMaterialLabel,
    }),
  });

  const result = await publishSalesmapperMatrix({
    client,
    tenantId,
    productId: ensured.product.id,
    normalizedRows,
    matrixConfig: {
      verticalAxis: buildSalesmapperMaterialAxis(materialNames, 3),
      sections: [
        buildSalesmapperFormatSection(FORMAT_ORDER),
        buildSalesmapperOptionSection({
          key: "printMode",
          rowId: "row-print-mode",
          sectionId: "print-mode-section",
          groupName: "Tryk",
          title: "Tryk",
          valueNames: PRINT_MODE_ORDER,
          sortOrder: 1,
          extraDataIdField: "printModeId",
        }),
        buildSalesmapperOptionSection({
          key: "embossing",
          rowId: "row-embossing",
          sectionId: "embossing-section",
          groupName: "Prægning",
          title: "Prægning",
          valueNames: EMBOSSING_ORDER,
          sortOrder: 2,
          extraDataIdField: "embossingId",
        }),
      ],
    },
    productUpdate: {
      name: productName,
      slug: productSlug,
      pricing_type: "matrix",
    },
  });

  return {
    dryRun: false,
    productId: ensured.product.id,
    productSlug,
    productCreated: ensured.created,
    rowsInserted: result.rowsInserted,
    uniqueFormats: FORMAT_ORDER.length,
    uniquePrintModes: PRINT_MODE_ORDER.length,
    uniqueEmbossing: EMBOSSING_ORDER.length,
    uniqueMaterials: MATERIAL_MATCHERS.length,
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
        `\n── ${sourcePage.formatLabel} (${sourcePage.printMode}) [${sourcePage.embossingLabel}] ──`
      );
      const rows = await extractRowsForPage(page, sourcePage);
      extractedRows.push(...rows);
    }

    if (!extractedRows.length) throw new Error("No rows extracted");

    const dedupe = new Map();
    extractedRows.forEach((row) => {
      const pricing = transformedPrice(row.eur);
      dedupe.set(
        [
          row.formatLabel,
          row.printMode,
          row.embossingLabel,
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
        a.embossingLabel.localeCompare(b.embossingLabel) ||
        a.materialLabel.localeCompare(b.materialLabel) ||
        a.quantity - b.quantity
    );

    const timestamp = timestampForFile();
    const rawPath = path.join(root, "pricing_raw", args.productSlug, `${timestamp}.json`);
    const cleanPath = path.join(root, "pricing_clean", args.productSlug, `${timestamp}.csv`);
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
          materials: MATERIAL_MATCHERS.map((entry) => ({
            pattern: entry.pattern.source,
            label: entry.label,
          })),
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
      console.log(`  Rows: ${result.rowsPrepared}`);
      console.log(
        `  Formats: ${result.uniqueFormats}, Tryk: ${result.uniquePrintModes}, Prægning: ${result.uniqueEmbossing}, Materialer: ${result.uniqueMaterials}`
      );
      return;
    }

    console.log("\n✅ Import complete");
    console.log(`  Product ID: ${result.productId}`);
    console.log(`  Slug: ${result.productSlug}`);
    console.log(`  Created: ${result.productCreated ? "yes" : "no (existing)"}`);
    console.log(`  Rows inserted: ${result.rowsInserted}`);
    console.log(
      `  Formats: ${result.uniqueFormats}, Tryk: ${result.uniquePrintModes}, Prægning: ${result.uniqueEmbossing}, Materialer: ${result.uniqueMaterials}`
    );
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
