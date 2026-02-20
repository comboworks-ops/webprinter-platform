#!/usr/bin/env node
import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { loadBlueprintFile } from "./product-import/blueprint-schema.js";
import { extractLiTexts } from "./product-import/extractors.js";
import { transformLiTextsToRows } from "./product-import/ul-prices.js";
import {
  ensureDir,
  timestampForFile,
  writeRawSnapshot,
  writeCleanCsv,
} from "./product-import/snapshot-io.js";
import { importBlueprintPricing } from "./product-import/supabase-import.js";

function usage() {
  return [
    "Usage:",
    "  node scripts/product-blueprint-cli.js validate <blueprint.yml>",
    "  node scripts/product-blueprint-cli.js import <blueprint.yml> [--dry-run]",
  ].join("\n");
}

function requireBlueprintPath(args) {
  const maybePath = args.find((arg) => !arg.startsWith("-"));
  if (!maybePath) {
    throw new Error(`Missing blueprint path\n\n${usage()}`);
  }
  return maybePath;
}

function logValidationSummary(blueprint, filePath) {
  console.log("Blueprint OK");
  console.log(`  File: ${filePath}`);
  console.log(`  Tenant: ${blueprint.tenant_id}`);
  console.log(`  Product: ${blueprint.product.name} (${blueprint.product.slug})`);
  console.log(`  Import: ${blueprint.pricing_import.type}`);
  console.log(`  URL: ${blueprint.pricing_import.url}`);
  console.log(`  Selector: ${blueprint.pricing_import.ul_selector}`);
}

async function runValidate(args) {
  const blueprintPath = requireBlueprintPath(args);
  const { blueprint, filePath } = loadBlueprintFile(blueprintPath);
  logValidationSummary(blueprint, filePath);
}

async function runImport(args) {
  const dryRun = args.includes("--dry-run");
  const blueprintPath = requireBlueprintPath(args);
  const repoRoot = process.cwd();

  ensureDir(path.join(repoRoot, "blueprints"));
  ensureDir(path.join(repoRoot, "pricing_raw"));
  ensureDir(path.join(repoRoot, "pricing_clean"));

  const { blueprint, filePath } = loadBlueprintFile(blueprintPath);
  logValidationSummary(blueprint, filePath);

  console.log("Extracting UL items...");
  const extraction = await extractLiTexts({
    url: blueprint.pricing_import.url,
    ulSelector: blueprint.pricing_import.ul_selector,
  });

  console.log(`  Provider: ${extraction.provider}`);
  if (extraction.firecrawlError) {
    console.log(`  Firecrawl fallback reason: ${extraction.firecrawlError}`);
  }
  if (extraction.playwrightError) {
    console.log(`  Playwright fallback reason: ${extraction.playwrightError}`);
  }
  console.log(`  LI items: ${extraction.liTexts.length}`);

  const transformed = transformLiTextsToRows(extraction.liTexts, blueprint.pricing_import);
  if (transformed.rows.length === 0) {
    throw new Error("No valid EUR rows could be parsed from UL data");
  }

  const timestamp = timestampForFile();
  const rawSnapshotPath = writeRawSnapshot({
    repoRoot,
    slug: blueprint.product.slug,
    timestamp,
    payload: {
      timestamp,
      blueprint_file: filePath,
      source: {
        type: blueprint.pricing_import.type,
        url: blueprint.pricing_import.url,
        ul_selector: blueprint.pricing_import.ul_selector,
      },
      extractor: {
        provider: extraction.provider,
        firecrawl_error: extraction.firecrawlError || null,
        playwright_error: extraction.playwrightError || null,
      },
      li_texts: extraction.liTexts,
      extracted_payload: extraction.payload,
      skipped_rows: transformed.skipped,
    },
  });

  const cleanCsvPath = writeCleanCsv({
    repoRoot,
    slug: blueprint.product.slug,
    timestamp,
    rows: transformed.rows,
  });

  console.log(`  Raw snapshot: ${rawSnapshotPath}`);
  console.log(`  Clean CSV: ${cleanCsvPath}`);
  console.log(`  Parsed price rows: ${transformed.rows.length}`);

  const result = await importBlueprintPricing({
    blueprint,
    transformedRows: transformed.rows,
    dryRun,
  });

  if (result.dryRun) {
    console.log("Dry-run complete (no database writes)");
    console.log(`  Product slug: ${result.productSlug}`);
    console.log(`  Tenant: ${result.tenantId}`);
    console.log(`  Rows prepared: ${result.rowsPrepared}`);
    console.log(`  Quantities: ${result.quantities.join(", ")}`);
    return;
  }

  console.log("Import complete");
  console.log(`  Product ID: ${result.productId}`);
  console.log(`  Product slug: ${result.productSlug}`);
  console.log(`  Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
  console.log(`  Rows inserted: ${result.rowsInserted}`);
  console.log(`  Quantities: ${result.quantities.join(", ")}`);
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || ["-h", "--help", "help"].includes(command)) {
    console.log(usage());
    return;
  }

  if (command === "validate") {
    await runValidate(args);
    return;
  }

  if (command === "import") {
    await runImport(args);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
