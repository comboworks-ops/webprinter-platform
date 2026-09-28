#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const TARGET_PRODUCT_ID = "42a270bb-d2b1-4e98-9d04-aaa7d3d33401";
export const TARGET_SLUG = "salgsmapper-med-eget-design";
export const MODEL_SECTION_ID = "sales-folder-folder_model";
export const EXPECTED = Object.freeze({
  modelValues: 20,
  priceRows: 108_348,
  templateFiles: 3_692,
});
export const SIZE_GROUPS = Object.freeze([
  { id: "a4", label: "A4", sourcePrefix: "a4--", expectedCount: 7 },
  { id: "a5", label: "A5", sourcePrefix: "a5--", expectedCount: 4 },
  { id: "a6", label: "A6", sourcePrefix: "a6--", expectedCount: 4 },
  { id: "m65", label: "M65", sourcePrefix: "din-lang--", expectedCount: 3 },
  { id: "square-21x21", label: "21 × 21 cm", sourcePrefix: "square-21x21--", expectedCount: 2 },
]);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_RUN_DIR = path.join(
  REPO_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);
const DEFAULT_PRICE_AUDIT_RECEIPT = path.join(
  DEFAULT_RUN_DIR,
  "review/spine-price-parity-write-receipt.json",
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Json(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function readFlagValue(argv, flag) {
  const indexes = argv.flatMap((argument, index) => argument === flag ? [index] : []);
  invariant(indexes.length <= 1, `${flag} may be provided only once`);
  if (!indexes.length) return null;
  const value = argv[indexes[0] + 1];
  invariant(value && !value.startsWith("--"), `${flag} requires a value`);
  return value;
}

export function parseArgs(argv) {
  const valueFlags = new Set(["--run-dir", "--receipt", "--snapshot"]);
  const allowedFlags = new Set(["--confirm-presentation-write", ...valueFlags]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    invariant(allowedFlags.has(argument), `Unknown argument: ${argument}`);
    if (valueFlags.has(argument)) index += 1;
  }
  invariant(
    argv.filter((argument) => argument === "--confirm-presentation-write").length <= 1,
    "--confirm-presentation-write may be provided only once",
  );

  const runDir = path.resolve(readFlagValue(argv, "--run-dir") || DEFAULT_RUN_DIR);
  const stamp = timestampForPath();
  return {
    confirmWrite: argv.includes("--confirm-presentation-write"),
    runDir,
    receiptPath: path.resolve(
      readFlagValue(argv, "--receipt")
        || path.join(runDir, "review/model-size-grouping-write-receipt.json"),
    ),
    snapshotPath: path.resolve(
      readFlagValue(argv, "--snapshot")
        || path.join(runDir, `review/rollback/model-size-grouping-before-${stamp}.json`),
    ),
  };
}

export function findPricingSection(pricingStructure, sectionId) {
  const columns = Array.isArray(pricingStructure?.layout_rows)
    ? pricingStructure.layout_rows.flatMap((row) => Array.isArray(row?.columns) ? row.columns : [])
    : [];
  return columns.find((column) => column?.id === sectionId || column?.sectionId === sectionId) || null;
}

export function sourceKeyForAttributeValue(value) {
  const metaKey = typeof value?.meta?.sourceKey === "string" ? value.meta.sourceKey.trim() : "";
  if (metaKey) return metaKey;
  return typeof value?.key === "string" ? value.key.trim() : "";
}

function validateTargetProduct(product) {
  invariant(isObject(product), "Target product is missing");
  invariant(product.id === TARGET_PRODUCT_ID, "Target product ID changed");
  invariant(product.tenant_id === MASTER_TENANT_ID, "Target tenant changed");
  invariant(product.slug === TARGET_SLUG, "Target slug changed");
  invariant(product.is_published === false, "Refusing to edit a published product");
  invariant(product.is_available_to_tenants === false, "Refusing to edit a tenant-available product");
  invariant(product.is_ready === false, "Refusing to edit a ready product");
  invariant(product.pricing_type === "matrix", "Target product is no longer Matrix pricing");
  invariant(product.pricing_structure?.mode === "matrix_layout_v1", "Target pricing structure changed");
  invariant(Array.isArray(product.template_files), "Target template_files is not an array");
  invariant(
    product.template_files.length === EXPECTED.templateFiles,
    `Target must retain exactly ${EXPECTED.templateFiles} PDF bindings`,
  );
  invariant(
    product.technical_specs?.supplierProductKey === TARGET_SLUG,
    "Target supplier provenance changed",
  );
  invariant(typeof product.updated_at === "string" && product.updated_at, "Target updated_at is required");
}

export function buildFolderModelPresentationPatch({ product, attributeValues }) {
  validateTargetProduct(product);
  invariant(Array.isArray(attributeValues), "Attribute values are required");

  const pricingStructure = clone(product.pricing_structure);
  const section = findPricingSection(pricingStructure, MODEL_SECTION_ID);
  invariant(section, `Pricing section ${MODEL_SECTION_ID} is missing`);
  invariant(Array.isArray(section.valueIds), "Folder-model valueIds are missing");
  invariant(
    section.valueIds.length === EXPECTED.modelValues,
    `Folder-model section must contain exactly ${EXPECTED.modelValues} values`,
  );

  const sectionIds = new Set(section.valueIds);
  const values = attributeValues
    .filter((value) => value.group_id === section.groupId && sectionIds.has(value.id))
    .sort((left, right) => section.valueIds.indexOf(left.id) - section.valueIds.indexOf(right.id));
  invariant(values.length === EXPECTED.modelValues, "Live folder-model attribute values are incomplete");
  invariant(new Set(values.map((value) => value.id)).size === EXPECTED.modelValues, "Duplicate model UUIDs found");

  const groups = SIZE_GROUPS.map((definition) => {
    const valueIds = values
      .filter((value) => sourceKeyForAttributeValue(value).startsWith(definition.sourcePrefix))
      .map((value) => value.id);
    invariant(
      valueIds.length === definition.expectedCount,
      `${definition.label} must contain exactly ${definition.expectedCount} model values`,
    );
    return { id: definition.id, label: definition.label, valueIds };
  });
  const groupedIds = groups.flatMap((group) => group.valueIds);
  invariant(groupedIds.length === EXPECTED.modelValues, "Size groups do not cover every model value");
  invariant(new Set(groupedIds).size === EXPECTED.modelValues, "A model value appears in multiple size groups");
  invariant(
    section.valueIds.every((valueId) => groupedIds.includes(valueId)),
    "A folder-model value would disappear from the grouped selector",
  );

  section.ui_mode = "buttons";
  section.valueGroups = groups;
  section.valueSettings = Object.fromEntries(section.valueIds.map((valueId) => {
    const value = values.find((candidate) => candidate.id === valueId);
    const sourceKey = sourceKeyForAttributeValue(value);
    const previous = isObject(section.valueSettings?.[valueId])
      ? clone(section.valueSettings[valueId])
      : {};
    const storedName = String(previous.displayName || value?.name || "").trim();
    invariant(storedName, `Model value ${valueId} has no display name`);
    invariant(previous.customImage || value?.meta?.image, `Model value ${valueId} lost its editable image`);
    return [valueId, {
      ...previous,
      displayName: sourceKey.startsWith("din-lang--")
        ? storedName.replace(/^DIN lang\b/i, "M65")
        : storedName,
      showThumbnail: false,
    }];
  }));

  return {
    pricing_structure: pricingStructure,
    summary: {
      sectionId: MODEL_SECTION_ID,
      uiMode: section.ui_mode,
      valueCount: section.valueIds.length,
      groups: groups.map((group) => ({ ...group, valueCount: group.valueIds.length })),
      hiddenThumbnails: Object.values(section.valueSettings)
        .filter((setting) => setting.showThumbnail === false).length,
      preservedCustomImages: Object.values(section.valueSettings)
        .filter((setting) => Boolean(setting.customImage)).length,
      m65DisplayNames: values
        .filter((value) => sourceKeyForAttributeValue(value).startsWith("din-lang--"))
        .map((value) => section.valueSettings[value.id].displayName),
    },
  };
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(url && key, "SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readProduct(client) {
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("id", TARGET_PRODUCT_ID)
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("slug", TARGET_SLUG)
    .single();
  if (error) throw new Error(`Product read failed: ${error.message}`);
  validateTargetProduct(data);
  return data;
}

async function readAttributeValues(client, product) {
  const section = findPricingSection(product.pricing_structure, MODEL_SECTION_ID);
  invariant(section, `Pricing section ${MODEL_SECTION_ID} is missing`);
  const { data, error } = await client
    .from("product_attribute_values")
    .select("id,product_id,group_id,name,key,sort_order,enabled,meta")
    .eq("product_id", TARGET_PRODUCT_ID)
    .eq("group_id", section.groupId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Attribute-value read failed: ${error.message}`);
  return data || [];
}

function readPriceAuditReceipt() {
  invariant(fs.existsSync(DEFAULT_PRICE_AUDIT_RECEIPT), "Reviewed price-audit receipt is missing");
  const receipt = JSON.parse(fs.readFileSync(DEFAULT_PRICE_AUDIT_RECEIPT, "utf8"));
  invariant(receipt.status === "completed_unpublished_draft_correction", "Price-audit receipt is incomplete");
  invariant(receipt.target?.productId === TARGET_PRODUCT_ID, "Price-audit receipt targets another product");
  invariant(receipt.target?.tenantId === MASTER_TENANT_ID, "Price-audit receipt targets another tenant");
  invariant(receipt.target?.slug === TARGET_SLUG, "Price-audit receipt targets another slug");
  invariant(
    receipt.readback?.unchangedPriceRowCount === EXPECTED.priceRows,
    `Reviewed price audit must confirm exactly ${EXPECTED.priceRows} rows`,
  );
  invariant(
    receipt.readback?.templateFiles === EXPECTED.templateFiles,
    `Reviewed price audit must confirm exactly ${EXPECTED.templateFiles} PDF bindings`,
  );
  const reviewedIds = Array.isArray(receipt.progress?.updatedPriceIds)
    ? receipt.progress.updatedPriceIds
    : [];
  invariant(reviewedIds.length >= 16, "Price-audit receipt has too few reviewed sentinel IDs");
  const sentinelIds = [...reviewedIds.slice(0, 8), ...reviewedIds.slice(-8)];
  return {
    path: DEFAULT_PRICE_AUDIT_RECEIPT,
    sha256: createHash("sha256").update(fs.readFileSync(DEFAULT_PRICE_AUDIT_RECEIPT)).digest("hex"),
    exactRowCount: receipt.readback.unchangedPriceRowCount,
    sentinelIds,
  };
}

async function readPriceSentinels(client, sentinelIds) {
  const { data, error } = await client
    .from("generic_product_prices")
    .select("id,tenant_id,product_id,variant_name,variant_value,quantity,price_dkk,extra_data,updated_at")
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("product_id", TARGET_PRODUCT_ID)
    .in("id", sentinelIds);
  if (error) throw new Error(`Live price-sentinel read failed: ${error.message || error.code || "unknown error"}`);
  invariant(data?.length === sentinelIds.length, "One or more reviewed live price sentinels are missing");
  return [...data].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function protectedProduct(product) {
  const result = clone(product);
  delete result.pricing_structure;
  delete result.updated_at;
  return result;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const client = getSupabaseClient();
  const productBefore = await readProduct(client);
  const attributeValuesBefore = await readAttributeValues(client, productBefore);
  const priceAudit = readPriceAuditReceipt();
  const priceSentinelsBefore = await readPriceSentinels(client, priceAudit.sentinelIds);
  const patch = buildFolderModelPresentationPatch({
    product: productBefore,
    attributeValues: attributeValuesBefore,
  });
  const plan = {
    schemaVersion: 1,
    mode: args.confirmWrite ? "confirmed_write" : "dry_run",
    target: {
      productId: TARGET_PRODUCT_ID,
      tenantId: MASTER_TENANT_ID,
      slug: TARGET_SLUG,
    },
    writeBoundary: ["products.pricing_structure"],
    protected: [
      "generic_product_prices",
      "products.template_files",
      "products.technical_specs",
      "products.is_published",
      "products.is_available_to_tenants",
      "products.is_ready",
      "product_attribute_values",
    ],
    before: {
      productProtectedSha256: sha256Json(protectedProduct(productBefore)),
      pricingStructureSha256: sha256Json(productBefore.pricing_structure),
      templateFilesSha256: sha256Json(productBefore.template_files),
      attributeValuesSha256: sha256Json(attributeValuesBefore),
      priceRows: priceAudit.exactRowCount,
      priceAuditReceipt: path.relative(REPO_ROOT, priceAudit.path),
      priceAuditReceiptSha256: priceAudit.sha256,
      livePriceSentinels: priceSentinelsBefore.length,
      livePriceSentinelsSha256: sha256Json(priceSentinelsBefore),
    },
    proposed: {
      pricingStructureSha256: sha256Json(patch.pricing_structure),
      ...patch.summary,
    },
  };

  if (!args.confirmWrite) {
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }

  writeJson(args.snapshotPath, {
    ...plan,
    capturedAt: new Date().toISOString(),
    purpose: "Recoverable snapshot before presentation-only folder-model grouping",
    rollbackNote: "Restore productBefore.pricing_structure to the exact target product if this scoped presentation change is rolled back.",
    productBefore,
    attributeValuesBefore,
  });

  const { data: updated, error: updateError } = await client
    .from("products")
    .update({ pricing_structure: patch.pricing_structure })
    .eq("id", TARGET_PRODUCT_ID)
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("slug", TARGET_SLUG)
    .eq("is_published", false)
    .eq("is_available_to_tenants", false)
    .eq("is_ready", false)
    .eq("updated_at", productBefore.updated_at)
    .select("id,updated_at")
    .maybeSingle();
  if (updateError) throw new Error(`Presentation update failed: ${updateError.message}`);
  invariant(updated?.id === TARGET_PRODUCT_ID, "Optimistic product update did not match exactly one draft row");

  const productAfter = await readProduct(client);
  const attributeValuesAfter = await readAttributeValues(client, productAfter);
  const priceSentinelsAfter = await readPriceSentinels(client, priceAudit.sentinelIds);
  invariant(
    sha256Json(protectedProduct(productAfter)) === sha256Json(protectedProduct(productBefore)),
    "A product column outside pricing_structure changed",
  );
  invariant(
    sha256Json(productAfter.pricing_structure) === sha256Json(patch.pricing_structure),
    "pricing_structure readback differs from the reviewed patch",
  );
  invariant(
    sha256Json(productAfter.template_files) === sha256Json(productBefore.template_files),
    "PDF template bindings changed",
  );
  invariant(
    sha256Json(attributeValuesAfter) === sha256Json(attributeValuesBefore),
    "Attribute values or editable image metadata changed",
  );
  invariant(
    sha256Json(priceSentinelsAfter) === sha256Json(priceSentinelsBefore),
    "A protected live price sentinel changed",
  );

  const receipt = {
    ...plan,
    status: "presentation_grouping_applied",
    appliedAt: new Date().toISOString(),
    rollbackSnapshot: path.relative(REPO_ROOT, args.snapshotPath),
    after: {
      productProtectedSha256: sha256Json(protectedProduct(productAfter)),
      pricingStructureSha256: sha256Json(productAfter.pricing_structure),
      templateFilesSha256: sha256Json(productAfter.template_files),
      attributeValuesSha256: sha256Json(attributeValuesAfter),
      priceRows: priceAudit.exactRowCount,
      livePriceSentinels: priceSentinelsAfter.length,
      livePriceSentinelsSha256: sha256Json(priceSentinelsAfter),
      isPublished: productAfter.is_published,
      isAvailableToTenants: productAfter.is_available_to_tenants,
      isReady: productAfter.is_ready,
    },
  };
  writeJson(args.receiptPath, receipt);
  console.log(JSON.stringify(receipt, null, 2));
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
