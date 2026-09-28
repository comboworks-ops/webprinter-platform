#!/usr/bin/env node
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_RUN_DIR = path.resolve(
  process.cwd(),
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);
const EXPECTED_FAMILY_COUNT = 14;
const EXPECTED_PRICE_COUNT = 514;

function parseArgs(argv) {
  const runDirIndex = argv.indexOf("--run-dir");
  return {
    runDir:
      runDirIndex >= 0 && argv[runDirIndex + 1]
        ? path.resolve(argv[runDirIndex + 1])
        : DEFAULT_RUN_DIR,
    writeBank: argv.includes("--write-bank"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return { url, serviceRoleKey };
}

function loadFamilies(runDir) {
  const familiesDir = path.join(runDir, "families");
  const families = fs
    .readdirSync(familiesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const familyDir = path.join(familiesDir, entry.name);
      const manifestPath = path.join(familyDir, "import-manifest.json");
      return {
        familyDir,
        manifestPath,
        manifest: readJson(manifestPath),
      };
    })
    .sort((a, b) => a.manifest.product.slugDa.localeCompare(b.manifest.product.slugDa, "da"));

  if (families.length !== EXPECTED_FAMILY_COUNT) {
    throw new Error(`Expected ${EXPECTED_FAMILY_COUNT} families, found ${families.length}`);
  }

  const sourceKeys = new Set();
  let priceCount = 0;
  for (const family of families) {
    const { manifest } = family;
    if (manifest.target?.state !== "extracted") {
      throw new Error(
        `${manifest.product?.slugDa}: expected target.state=extracted, got ${manifest.target?.state}`,
      );
    }
    if (manifest.target?.publishProduct !== false || manifest.target?.writeLivePricing !== false) {
      throw new Error(`${manifest.product?.slugDa}: bank stage must not publish or write live pricing`);
    }
    if (!manifest.product?.sourceKey || sourceKeys.has(manifest.product.sourceKey)) {
      throw new Error(`${manifest.product?.slugDa}: missing or duplicate product.sourceKey`);
    }
    sourceKeys.add(manifest.product.sourceKey);
    if (!Array.isArray(manifest.pricing?.records) || manifest.pricing.records.length === 0) {
      throw new Error(`${manifest.product?.slugDa}: missing pricing.records`);
    }
    priceCount += manifest.pricing.records.length;
  }

  if (priceCount !== EXPECTED_PRICE_COUNT) {
    throw new Error(`Expected ${EXPECTED_PRICE_COUNT} prices, found ${priceCount}`);
  }
  return families;
}

function summarizePricing(records) {
  const quantities = records.map((row) => Number(row.quantity));
  const prices = records.map((row) => Number(row.finalPriceDkk));
  if (quantities.some((value) => !Number.isFinite(value)) || prices.some((value) => !Number.isFinite(value))) {
    throw new Error("Pricing contains invalid quantities or final DKK prices");
  }
  return {
    rows: records.length,
    quantityMin: Math.min(...quantities),
    quantityMax: Math.max(...quantities),
    priceMinDkk: Math.min(...prices),
    priceMaxDkk: Math.max(...prices),
  };
}

function normalizedAttributes(manifest) {
  return manifest.optionGroups.map((group) => ({
    key: group.key,
    labelDa: group.labelDa,
    displayType: group.displayType,
    sourceOrder: group.sourceOrder,
    values: group.values.map((value) => ({
      key: value.key,
      labelDa: value.labelDa,
      sourceOrder: value.sourceOrder,
      imagePath: value.imagePath || null,
      sourceReferenceUrl: value.sourceReferenceUrl || null,
    })),
  }));
}

function rawPriceRows(records) {
  return records.map((row) => ({
    sourceOrder: row.sourceOrder,
    sourceUrl: row.sourceUrl,
    quantity: row.quantity,
    supplierPriceEur: row.supplierPrice,
    selections: row.selections,
    evidence: row.evidence,
  }));
}

function normalizedPriceRows(manifest) {
  return manifest.pricing.records.map((row) => ({
    sourceOrder: row.sourceOrder,
    sourceUrl: row.sourceUrl,
    quantity: row.quantity,
    supplierPriceEur: row.supplierPrice,
    convertedPriceDkk: row.convertedPriceDkk,
    finalPriceDkk: row.finalPriceDkk,
    selections: row.selections,
    conversionRuleKey: manifest.pricing.conversionRuleKey,
    vatState: manifest.pricing.vatState,
    evidence: row.evidence,
  }));
}

async function upsertSupplier(client) {
  const { data, error } = await client
    .from("supplier_bank_suppliers")
    .upsert(
      {
        name: "WIRmachenDRUCK",
        slug: "wir-machen-druck",
        website_url: "https://www.wir-machen-druck.de/",
        country_code: "DE",
        currency: "EUR",
        integration_type: "playwright",
        enabled: true,
        metadata: {
          source: "write-wmd-advent-calendar-bank-drafts",
        },
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function writeFamily(client, supplier, family, runDir) {
  const { manifest, manifestPath, familyDir } = family;
  const records = manifest.pricing.records;
  const normalizedRows = normalizedPriceRows(manifest);
  const rawRows = rawPriceRows(records);
  const summary = summarizePricing(records);
  const capturedAt = manifest.source.capturedAt || new Date().toISOString();
  const rawSnapshotPath = path.relative(
    process.cwd(),
    path.join(familyDir, manifest.artifacts?.rawSnapshot || "raw/source-configurations.json"),
  );

  const { data: runRow, error: runError } = await client
    .from("supplier_bank_scrape_runs")
    .insert({
      supplier_id: supplier.id,
      mode: "product_extract",
      tool: "playwright",
      status: "succeeded",
      input: {
        sourceUrl: manifest.source.entryUrl,
        supplierProductKey: manifest.product.sourceKey,
        runId: manifest.runId,
      },
      summary: {
        rows: summary.rows,
        optionGroups: manifest.optionGroups.length,
        documents: manifest.documents.length,
        rawSnapshotPath,
      },
      started_at: capturedAt,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError) throw runError;

  const { data: existing, error: existingError } = await client
    .from("supplier_bank_products")
    .select("status")
    .eq("supplier_id", supplier.id)
    .eq("supplier_product_key", manifest.product.sourceKey)
    .maybeSingle();
  if (existingError) throw existingError;
  const status = ["approved", "archived"].includes(existing?.status) ? existing.status : "draft";

  const productPayload = {
    supplier_id: supplier.id,
    latest_scrape_run_id: runRow.id,
    supplier_product_key: manifest.product.sourceKey,
    source_url: manifest.source.entryUrl,
    source_hash: sha256({ product: manifest.product, optionGroups: manifest.optionGroups }),
    product_family: manifest.product.family,
    name_original: manifest.product.nameOriginal,
    name_da: manifest.product.nameDa,
    description_original: manifest.product.descriptionOriginal,
    description_da: manifest.product.descriptionDa,
    source_language: manifest.product.sourceLanguage,
    target_language: manifest.product.targetLanguage,
    status,
    normalized_attributes: normalizedAttributes(manifest),
    normalized_pricing_summary: summary,
    raw_snapshot_path: rawSnapshotPath,
    scrape_status: "fresh",
    last_scraped_at: capturedAt,
    last_price_checked_at: capturedAt,
    metadata: {
      importRunId: manifest.runId,
      manifestPath: path.relative(process.cwd(), manifestPath),
      productSlugDa: manifest.product.slugDa,
      documentCount: manifest.documents.length,
      conversionRuleKey: manifest.pricing.conversionRuleKey,
      publishProduct: false,
      writeLivePricing: false,
    },
  };
  const { data: productRow, error: productError } = await client
    .from("supplier_bank_products")
    .upsert(productPayload, { onConflict: "supplier_id,supplier_product_key" })
    .select("id,status")
    .single();
  if (productError) throw productError;

  const { data: snapshotRow, error: snapshotError } = await client
    .from("supplier_bank_price_snapshots")
    .insert({
      bank_product_id: productRow.id,
      supplier_id: supplier.id,
      scrape_run_id: runRow.id,
      currency: manifest.pricing.supplierCurrency,
      conversion_rule_key: manifest.pricing.conversionRuleKey,
      raw_price_rows: rawRows,
      normalized_price_rows: normalizedRows,
      price_min_dkk: summary.priceMinDkk,
      price_max_dkk: summary.priceMaxDkk,
      quantity_min: summary.quantityMin,
      quantity_max: summary.quantityMax,
      checksum: sha256(normalizedRows),
      metadata: {
        importRunId: manifest.runId,
        manifestPath: path.relative(process.cwd(), manifestPath),
        capturedAt,
      },
    })
    .select("id")
    .single();
  if (snapshotError) throw snapshotError;

  manifest.target.state = "bank_draft";
  manifest.artifacts = {
    ...(manifest.artifacts || {}),
    supplierBank: {
      supplierId: supplier.id,
      scrapeRunId: runRow.id,
      bankProductId: productRow.id,
      priceSnapshotId: snapshotRow.id,
      writtenAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    slug: manifest.product.slugDa,
    sourceKey: manifest.product.sourceKey,
    rows: summary.rows,
    status: productRow.status,
    bankProductId: productRow.id,
    priceSnapshotId: snapshotRow.id,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const families = loadFamilies(args.runDir);
  const preview = families.map(({ manifest }) => ({
    slug: manifest.product.slugDa,
    sourceKey: manifest.product.sourceKey,
    rows: manifest.pricing.records.length,
    options: manifest.optionGroups.map((group) => `${group.labelDa}: ${group.values.length}`),
    documents: manifest.documents.length,
  }));

  if (!args.writeBank) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          runDir: args.runDir,
          publishProduct: false,
          writeLivePricing: false,
          families: preview,
          totals: {
            families: preview.length,
            prices: preview.reduce((sum, item) => sum + item.rows, 0),
            documents: preview.reduce((sum, item) => sum + item.documents, 0),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const supplier = await upsertSupplier(client);
  const results = [];
  for (const family of families) {
    results.push(await writeFamily(client, supplier, family, args.runDir));
    console.log(`bank draft: ${results.at(-1).slug} (${results.at(-1).rows} prices)`);
  }

  const output = {
    writtenAt: new Date().toISOString(),
    supplierId: supplier.id,
    publishProduct: false,
    writeLivePricing: false,
    totals: {
      families: results.length,
      prices: results.reduce((sum, item) => sum + item.rows, 0),
    },
    results,
  };
  const outputPath = path.join(args.runDir, "bank-write-summary.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...output.totals }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
