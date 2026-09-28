#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import {
  AXIS_ORDER,
  AVAILABILITY_SECTION_IDS,
  SPINES,
  STRATEGIES,
} from "./plan-wmd-sales-folder-spine-price-parity.js";

export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const TARGET_PRODUCT_ID = "42a270bb-d2b1-4e98-9d04-aaa7d3d33401";
export const TARGET_SLUG = "salgsmapper-med-eget-design";
export const TARGET_SOURCE_KEY = "salgsmapper-med-eget-design";
export const EXPECTED_SOURCE_PRICE_SHA256 =
  "77517e3f9758bb1288c58fdbfd997814fe384e740854f1c2351088c210c1c385";
export const EXPECTED = Object.freeze({
  priceRows: 108_348,
  priceUpdates: 274,
  templateFiles: 3_692,
  attributeAxes: 5,
  attributeValues: 40,
});

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_RUN_DIR = path.join(
  REPO_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);
const SHA256_RE = /^[a-f0-9]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGET_READ_BATCH_SIZE = 8;
const WRITE_BATCH_SIZE = 8;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value, field) {
  const text = String(value ?? "").trim();
  invariant(text, `${field} must be a non-empty string`);
  return text;
}

function exactSha256(value, field) {
  const digest = nonEmpty(value, field).toLowerCase();
  invariant(SHA256_RE.test(digest), `${field} must be a SHA-256 hex digest`);
  return digest;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Json(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function sha256File(filePath) {
  const hash = createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function readFlagValue(argv, flag) {
  const positions = argv.reduce((result, value, index) => (
    value === flag ? [...result, index] : result
  ), []);
  invariant(positions.length <= 1, `${flag} may be provided only once`);
  if (!positions.length) return null;
  const value = argv[positions[0] + 1];
  invariant(value && !value.startsWith("--"), `${flag} requires a value`);
  return value;
}

export function parseArgs(argv) {
  const valueFlags = new Set([
    "--run-dir",
    "--plan",
    "--receipt",
    "--expected-product-id",
    "--expected-slug",
    "--expected-plan-sha256",
    "--expected-source-price-sha256",
  ]);
  const allowedFlags = new Set([
    "--confirm-write",
    "--run-dir",
    "--plan",
    "--receipt",
    "--expected-product-id",
    "--expected-slug",
    "--expected-plan-sha256",
    "--expected-source-price-sha256",
  ]);
  for (const argument of argv) {
    if (argument.startsWith("--")) {
      invariant(allowedFlags.has(argument), `Unknown flag: ${argument}`);
    }
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument.startsWith("--")) {
      if (valueFlags.has(argument)) index += 1;
      continue;
    }
    invariant(false, `Unexpected positional argument: ${argument}`);
  }
  invariant(argv.filter((argument) => argument === "--confirm-write").length === 1,
    "A real correction requires exactly one explicit --confirm-write flag");

  const runDir = path.resolve(readFlagValue(argv, "--run-dir") || DEFAULT_RUN_DIR);
  const productId = nonEmpty(readFlagValue(argv, "--expected-product-id"), "--expected-product-id");
  const slug = nonEmpty(readFlagValue(argv, "--expected-slug"), "--expected-slug");
  const planSha256 = exactSha256(readFlagValue(argv, "--expected-plan-sha256"), "--expected-plan-sha256");
  const sourcePriceSha256 = exactSha256(
    readFlagValue(argv, "--expected-source-price-sha256"),
    "--expected-source-price-sha256",
  );

  invariant(UUID_RE.test(productId), "--expected-product-id must be a UUID");
  invariant(productId === TARGET_PRODUCT_ID, `Expected product id must be exactly ${TARGET_PRODUCT_ID}`);
  invariant(slug === TARGET_SLUG, `Expected slug must be exactly ${TARGET_SLUG}`);
  invariant(
    sourcePriceSha256 === EXPECTED_SOURCE_PRICE_SHA256,
    `Expected source price SHA-256 must be exactly ${EXPECTED_SOURCE_PRICE_SHA256}`,
  );

  return {
    confirmWrite: true,
    runDir,
    planPath: path.resolve(
      readFlagValue(argv, "--plan") || path.join(runDir, "review/spine-price-parity-plan.json"),
    ),
    receiptPath: path.resolve(
      readFlagValue(argv, "--receipt") || path.join(runDir, "review/spine-price-parity-write-receipt.json"),
    ),
    expectedProductId: productId,
    expectedSlug: slug,
    expectedPlanSha256: planSha256,
    expectedSourcePriceSha256: sourcePriceSha256,
  };
}

function sameMoney(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return Number.isFinite(Number(left))
    && Number.isFinite(Number(right))
    && Math.abs(Number(left) - Number(right)) < 1e-6;
}

function sameSupplierValues(left, right) {
  return stableJson(left) === stableJson(right);
}

export function validatePlan(plan, { expectedPlanSha256 = null, expected = EXPECTED } = {}) {
  invariant(isObject(plan), "Parity plan must be an object");
  invariant(plan.schemaVersion === 1, "Parity plan schemaVersion must be 1");
  invariant(plan.readyForSeparateReviewedWrite === true, "Parity plan is not ready for its separate reviewed write");
  invariant(Array.isArray(plan.blockers) && plan.blockers.length === 0, "Parity plan contains blockers");
  invariant(plan.proposedStrategy === STRATEGIES.maxExisting,
    `Parity plan strategy must be ${STRATEGIES.maxExisting}`);
  invariant(plan.before?.priceRows === expected.priceRows,
    `Parity plan must cover exactly ${expected.priceRows} existing price rows`);
  invariant(plan.before?.templateBindingRows === expected.templateFiles,
    `Parity plan must cover exactly ${expected.templateFiles} template bindings`);
  invariant(plan.inputs?.prices?.sha256 === EXPECTED_SOURCE_PRICE_SHA256,
    "Parity plan source-price artifact SHA-256 changed");
  invariant(plan.invariants?.sparseCompatibilityPreserved === true,
    "Parity plan must preserve sparse compatibility");
  invariant(plan.invariants?.targetSupplierValuesPreservedOnUpdate === true,
    "Parity plan must preserve target-spine supplier values");
  invariant(plan.invariants?.onlySellingPriceCanonicalized === true,
    "Parity plan may canonicalize only the selling price");
  invariant(plan.invariants?.missingPriceRowsAreNeverInferred === true,
    "Parity plan may not infer missing price rows");

  const strategy = plan.strategies?.[STRATEGIES.maxExisting];
  invariant(isObject(strategy), "Max-existing strategy is missing from parity plan");
  invariant(strategy.updateRows === expected.priceUpdates,
    `Parity plan must contain exactly ${expected.priceUpdates} updates`);
  invariant(strategy.insertRows === 0, "Parity plan may not contain inserts");
  invariant(strategy.afterRows === expected.priceRows, "Parity plan row count must stay unchanged");
  invariant(strategy.plannedSignatureCollisionCount === 0, "Parity plan contains signature collisions");
  invariant(strategy.commercialSafety?.totals?.belowSupplierCostRows === 0,
    "Parity plan contains selling prices below supplier cost");
  invariant(Array.isArray(strategy.delta) && strategy.delta.length === expected.priceUpdates,
    `Parity plan delta must contain exactly ${expected.priceUpdates} rows`);

  const signatures = new Set();
  for (const [index, item] of strategy.delta.entries()) {
    const label = `Parity delta ${index + 1}`;
    invariant(item.operation === "update", `${label} is not an update`);
    invariant(Array.isArray(item.writeBoundary)
      && item.writeBoundary.length === 1
      && item.writeBoundary[0] === "price_dkk", `${label} has an unsafe write boundary`);
    invariant(!signatures.has(item.priceSignature), `${label} duplicates price signature ${item.priceSignature}`);
    signatures.add(item.priceSignature);
    invariant(AXIS_ORDER.every((axis) => nonEmpty(item.selections?.[axis], `${label}.${axis}`)),
      `${label} is missing selections`);
    invariant(SPINES.includes(item.selections.spine), `${label} has an unsupported spine`);
    invariant(Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0,
      `${label} has an invalid quantity`);
    invariant(Number.isFinite(Number(item.before?.finalPriceDkk)), `${label} has no before price`);
    invariant(Number.isFinite(Number(item.after?.finalPriceDkk)), `${label} has no after price`);
    invariant(Number(item.after.finalPriceDkk) >= Number(item.before.finalPriceDkk),
      `${label} would lower an existing Webprinter price`);
    invariant(!sameMoney(item.after.finalPriceDkk, item.before.finalPriceDkk),
      `${label} does not actually change price_dkk`);
    invariant(item.canonicalPriceSource?.strategy === STRATEGIES.maxExisting,
      `${label} does not use the reviewed max-existing strategy`);
    invariant(isObject(item.exactTemplateBinding), `${label} has no exact template binding`);
    invariant(
      sameSupplierValues(item.before?.targetSupplierValues, item.after?.targetSupplierValues),
      `${label} changes target-spine supplier evidence`,
    );
    const supplierCost = Number(item.before?.targetSupplierValues?.convertedPriceDkk);
    invariant(!Number.isFinite(supplierCost) || Number(item.after.finalPriceDkk) >= supplierCost,
      `${label} would sell below its exact target-spine supplier cost`);
  }

  if (expectedPlanSha256) exactSha256(expectedPlanSha256, "expectedPlanSha256");
  return { strategy, delta: strategy.delta };
}

export function findPricingSection(pricingStructure, sectionId) {
  const sections = [
    pricingStructure?.vertical_axis,
    ...(Array.isArray(pricingStructure?.layout_rows)
      ? pricingStructure.layout_rows.flatMap((row) => (Array.isArray(row?.columns) ? row.columns : []))
      : []),
  ].filter(isObject);
  return sections.find((section) => section.id === sectionId || section.sectionId === sectionId) || null;
}

export function sourceKeyForAttributeValue(value) {
  if (typeof value?.meta?.sourceKey === "string" && value.meta.sourceKey.trim()) {
    return value.meta.sourceKey.trim();
  }
  return typeof value?.key === "string" ? value.key.trim() : "";
}

export function buildAxisValueIdMaps({ product, attributeValues, requiredSelections, expected = EXPECTED }) {
  invariant(Array.isArray(attributeValues), "Attribute values are required");
  const axisSections = product?.pricing_structure?.templateBinding?.axisSections;
  invariant(isObject(axisSections), "Product templateBinding.axisSections is missing");
  const requiredByAxis = new Map(AXIS_ORDER.map((axis) => [axis, new Set()]));
  for (const selections of requiredSelections) {
    for (const axis of AXIS_ORDER) requiredByAxis.get(axis).add(nonEmpty(selections?.[axis], `${axis} source key`));
  }

  const result = new Map();
  for (const axis of AXIS_ORDER) {
    const sectionId = nonEmpty(axisSections[axis], `templateBinding.axisSections.${axis}`);
    const section = findPricingSection(product.pricing_structure, sectionId);
    invariant(section, `Pricing section ${sectionId} for ${axis} is missing`);
    const groupId = nonEmpty(section.groupId, `${sectionId}.groupId`);
    const values = attributeValues.filter((value) => value.group_id === groupId);
    const bySourceKey = new Map();
    for (const value of values) {
      const key = sourceKeyForAttributeValue(value);
      invariant(key, `${axis} attribute value ${value.id} has no meta.sourceKey or key`);
      invariant(!bySourceKey.has(key), `${axis} source key '${key}' maps to more than one live value`);
      invariant(value.product_id === product.id, `${axis} value ${value.id} belongs to another product`);
      bySourceKey.set(key, value.id);
    }
    for (const requiredKey of requiredByAxis.get(axis)) {
      invariant(bySourceKey.has(requiredKey), `${axis} source key '${requiredKey}' is missing from the live product`);
    }
    result.set(axis, { sectionId, groupId, bySourceKey });
  }
  invariant(result.size === expected.attributeAxes, "Not all live pricing axes could be resolved");
  return result;
}

function idSelectionSignature(selectionMap, quantity) {
  const numericQuantity = Number(quantity);
  invariant(Number.isInteger(numericQuantity) && numericQuantity > 0, "Price quantity must be a positive integer");
  return AXIS_ORDER.map((axis) => `${axis}=${nonEmpty(selectionMap?.[axis], `selectionMap.${axis}`)}`)
    .concat(`quantity=${numericQuantity}`)
    .join("|");
}

export function validateAndSignLivePriceRow(row) {
  const selectionMap = row?.extra_data?.selectionMap;
  invariant(isObject(selectionMap), `Live price ${row?.id || "unknown"} has no exact selectionMap`);
  const signature = idSelectionSignature(selectionMap, row.quantity);
  const paperId = selectionMap.paper;
  const variantIds = AXIS_ORDER.filter((axis) => axis !== "paper").map((axis) => selectionMap[axis]);
  const expectedVariantName = [...variantIds].sort().join("|") || "none";
  invariant(row.variant_value === paperId, `Live price ${row.id} vertical paper ID disagrees with selectionMap`);
  invariant(row.variant_name === expectedVariantName, `Live price ${row.id} variant IDs disagree with selectionMap`);
  const storedVariantIds = selectionMap.variantValueIds ?? row.extra_data?.variantValueIds;
  invariant(Array.isArray(storedVariantIds), `Live price ${row.id} has no variantValueIds`);
  invariant(stableJson([...storedVariantIds].sort()) === stableJson([...variantIds].sort()),
    `Live price ${row.id} variantValueIds disagree with its exact axis selections`);
  return signature;
}

function sourceEvidenceFromLiveRow(row) {
  const extra = row.extra_data || {};
  return {
    supplierPrice: extra.supplierPrice == null ? null : Number(extra.supplierPrice),
    supplierCurrency: extra.supplierCurrency ?? null,
    convertedPriceDkk: extra.convertedPriceDkk == null ? null : Number(extra.convertedPriceDkk),
    conversionRuleKey: extra.conversionRuleKey ?? null,
    sourceUrl: extra.sourceUrl ?? null,
  };
}

function assertLiveSupplierEvidenceMatchesPlan(row, item) {
  const expected = item.before.targetSupplierValues || {};
  const actual = sourceEvidenceFromLiveRow(row);
  invariant(sameMoney(actual.supplierPrice, expected.supplierPrice),
    `Live price ${row.id} supplierPrice changed after planning`);
  invariant(actual.supplierCurrency === (expected.supplierCurrency ?? null),
    `Live price ${row.id} supplierCurrency changed after planning`);
  invariant(sameMoney(actual.convertedPriceDkk, expected.convertedPriceDkk),
    `Live price ${row.id} convertedPriceDkk changed after planning`);
  invariant(actual.conversionRuleKey === (expected.conversionRuleKey ?? null),
    `Live price ${row.id} conversionRuleKey changed after planning`);
  const expectedSourceUrl = expected.sourceEvidence?.sourceUrl ?? null;
  invariant(actual.sourceUrl === expectedSourceUrl, `Live price ${row.id} source URL changed after planning`);
}

export function validateTargetProduct(
  product,
  expectedSourcePriceSha256 = EXPECTED_SOURCE_PRICE_SHA256,
  expected = EXPECTED,
) {
  invariant(isObject(product), "Target product is missing");
  invariant(product.id === TARGET_PRODUCT_ID, "Target product ID changed");
  invariant(product.tenant_id === MASTER_TENANT_ID, "Target tenant changed");
  invariant(product.slug === TARGET_SLUG, "Target product slug changed");
  invariant(typeof product.updated_at === "string" && product.updated_at,
    "Target product updated_at is required for the optimistic write guard");
  invariant(product.is_published === false, "Refusing to correct a published product");
  invariant(product.is_available_to_tenants === false, "Refusing to correct a tenant-available product");
  invariant(product.is_ready === false, "Refusing to correct a ready product");
  invariant(product.technical_specs?.supplierProductKey === TARGET_SOURCE_KEY,
    "Target supplier product key changed");
  invariant(product.technical_specs?.priceArtifactSha256 === expectedSourcePriceSha256,
    "Target source-price artifact SHA-256 changed");
  invariant(Array.isArray(product.template_files), "Target template_files is not an array");
  invariant(product.template_files.length === expected.templateFiles,
    `Target must still contain exactly ${expected.templateFiles} template bindings`);
  return product;
}

function indexedPriceKey({ variantName, variantValue, quantity }) {
  return `${variantName}|paper=${variantValue}|quantity=${Number(quantity)}`;
}

export function buildPlannedPriceTargets({ plan, product, attributeValues, expected = EXPECTED }) {
  const { delta } = validatePlan(plan, { expected });
  validateTargetProduct(product, EXPECTED_SOURCE_PRICE_SHA256, expected);
  invariant(Array.isArray(attributeValues) && attributeValues.length === expected.attributeValues,
    `Live product must contain exactly ${expected.attributeValues} attribute values`);
  const axisMaps = buildAxisValueIdMaps({
    product,
    attributeValues,
    requiredSelections: delta.map((item) => item.selections),
    expected,
  });
  const targets = delta.map((item) => {
    const selectionIds = Object.fromEntries(AXIS_ORDER.map((axis) => [
      axis,
      axisMaps.get(axis).bySourceKey.get(item.selections[axis]),
    ]));
    const variantValueIds = AXIS_ORDER
      .filter((axis) => axis !== "paper")
      .map((axis) => selectionIds[axis]);
    const variantName = [...variantValueIds].sort().join("|") || "none";
    const variantValue = selectionIds.paper;
    return {
      priceSignature: item.priceSignature,
      selectionIds,
      selectionIdSignature: idSelectionSignature(selectionIds, item.quantity),
      variantName,
      variantValue,
      quantity: Number(item.quantity),
      indexedKey: indexedPriceKey({ variantName, variantValue, quantity: item.quantity }),
      item,
    };
  });
  invariant(targets.length === expected.priceUpdates, `Planned target count must be ${expected.priceUpdates}`);
  invariant(new Set(targets.map((target) => target.indexedKey)).size === expected.priceUpdates,
    "More than one planned update maps to the same indexed live price key");
  return targets;
}

export function mapPlanUpdatesToLiveRows({
  plan,
  product,
  attributeValues,
  prices,
  plannedTargets = null,
  expected = EXPECTED,
}) {
  const targets = plannedTargets || buildPlannedPriceTargets({ plan, product, attributeValues, expected });
  invariant(Array.isArray(prices) && prices.length === expected.priceUpdates,
    `Exact target read must return exactly ${expected.priceUpdates} price rows`);
  const liveByIndexedKey = new Map();
  for (const row of prices) {
    invariant(row.product_id === TARGET_PRODUCT_ID, `Price ${row.id} belongs to another product`);
    if (row.tenant_id !== undefined) {
      invariant(row.tenant_id === MASTER_TENANT_ID, `Price ${row.id} belongs to another tenant`);
    }
    validateAndSignLivePriceRow(row);
    const key = indexedPriceKey({
      variantName: row.variant_name,
      variantValue: row.variant_value,
      quantity: row.quantity,
    });
    invariant(!liveByIndexedKey.has(key), `Duplicate exact live price key: ${key}`);
    liveByIndexedKey.set(key, row);
  }

  const mapped = targets.map((target) => {
    const { item, selectionIds } = target;
    const row = liveByIndexedKey.get(target.indexedKey);
    invariant(row, `No live price row matches planned signature ${item.priceSignature}`);
    invariant(validateAndSignLivePriceRow(row) === target.selectionIdSignature,
      `Live price ${row.id} selectionMap does not match the planned source selections`);
    invariant(sameMoney(row.price_dkk, item.before.finalPriceDkk),
      `Live price ${row.id} changed after planning: expected ${item.before.finalPriceDkk}, found ${row.price_dkk}`);
    assertLiveSupplierEvidenceMatchesPlan(row, item);
    const afterPrice = Number(item.after.finalPriceDkk);
    const supplierCost = Number(row.extra_data?.convertedPriceDkk);
    invariant(!Number.isFinite(supplierCost) || afterPrice >= supplierCost,
      `Live price ${row.id} would be below its preserved supplier cost`);
    return {
      id: row.id,
      productId: row.product_id,
      tenantId: row.tenant_id,
      variantName: row.variant_name,
      variantValue: row.variant_value,
      quantity: Number(row.quantity),
      updatedAt: row.updated_at ?? null,
      priceSignature: item.priceSignature,
      selectionIds,
      beforePriceDkk: Number(row.price_dkk),
      afterPriceDkk: afterPrice,
      supplierCostDkk: Number.isFinite(supplierCost) ? supplierCost : null,
      sourceEvidenceSha256: sha256Json(row.extra_data),
    };
  });

  invariant(mapped.length === expected.priceUpdates, `Mapped update count must be ${expected.priceUpdates}`);
  invariant(new Set(mapped.map((item) => item.id)).size === expected.priceUpdates,
    "More than one planned update maps to the same live price row");
  return mapped;
}

export function buildCorrectedProductPatch({ product, plan, planSha256, appliedAt, expected = EXPECTED }) {
  validatePlan(plan, { expected });
  validateTargetProduct(product, EXPECTED_SOURCE_PRICE_SHA256, expected);
  exactSha256(planSha256, "planSha256");
  nonEmpty(appliedAt, "appliedAt");

  const pricingStructure = clone(product.pricing_structure);
  const spineSection = findPricingSection(pricingStructure, AVAILABILITY_SECTION_IDS.spine);
  invariant(spineSection, `Pricing section ${AVAILABILITY_SECTION_IDS.spine} is missing`);
  spineSection.hideUnavailableValues = true;
  pricingStructure.autoResolveExactCombination = true;

  const technicalSpecs = {
    ...clone(product.technical_specs),
    spinePriceParityPolicy: {
      schemaVersion: 1,
      strategy: STRATEGIES.maxExisting,
      priceDrivingAxis: false,
      customerPricePolicy:
        "highest_existing_webprinter_price_within_exact_model_print_paper_finish_quantity_group",
      groupedBy: ["folder_model", "print", "paper", "finish", "quantity"],
      spines: [...SPINES],
      sparseCompatibilityPreserved: true,
      finishingCompatibility: "exact_documented_paper_and_finish_combinations_only",
      autoResolveExactCombination: true,
      exactTemplateRequired: true,
      unsupportedSpinesRemainUnavailable: true,
      sourceEvidencePreserved: true,
      missingRowsInserted: 0,
      updatedRows: expected.priceUpdates,
      belowSupplierCostUpdatedRows: 0,
      planSha256,
      appliedAt,
    },
  };
  return { pricing_structure: pricingStructure, technical_specs: technicalSpecs };
}

function protectedPriceRow(row) {
  const copy = clone(row);
  delete copy.price_dkk;
  delete copy.updated_at;
  return copy;
}

function protectedProductRow(product) {
  const copy = clone(product);
  delete copy.pricing_structure;
  delete copy.technical_specs;
  delete copy.updated_at;
  return copy;
}

function sortedById(rows) {
  return [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

export function fingerprintState(state) {
  const product = state.product;
  const prices = sortedById(state.targetPrices);
  return {
    productProtectedSha256: sha256Json(protectedProductRow(product)),
    pricingStructureSha256: sha256Json(product.pricing_structure),
    technicalSpecsSha256: sha256Json(product.technical_specs),
    templateFilesSha256: sha256Json(product.template_files),
    templateFiles: Array.isArray(product.template_files) ? product.template_files.length : null,
    totalPriceRows: Number(state.priceRowCount),
    targetPriceRows: prices.length,
    targetPriceRowsProtectedSha256: sha256Json(prices.map(protectedPriceRow)),
    targetPriceSourceEvidenceSha256: sha256Json(
      prices.map((row) => ({ id: row.id, extra_data: row.extra_data })),
    ),
    isPublished: product.is_published,
    isAvailableToTenants: product.is_available_to_tenants,
    isReady: product.is_ready,
  };
}

export function assertReadback({ before, after, mappedUpdates, expectedProductPatch, expected = EXPECTED }) {
  validateTargetProduct(after.product, EXPECTED_SOURCE_PRICE_SHA256, expected);
  invariant(before.priceRowCount === expected.priceRows,
    `Before-state exact price count must be ${expected.priceRows}`);
  invariant(after.priceRowCount === expected.priceRows,
    `Readback exact price count must remain ${expected.priceRows}`);
  invariant(before.targetPrices.length === expected.priceUpdates,
    `Before-state must contain exactly ${expected.priceUpdates} target prices`);
  invariant(after.targetPrices.length === expected.priceUpdates,
    `Readback must contain exactly ${expected.priceUpdates} target prices`);
  invariant(mappedUpdates.length === expected.priceUpdates,
    `Readback must verify exactly ${expected.priceUpdates} intended updates`);

  const beforeFingerprint = fingerprintState(before);
  const afterFingerprint = fingerprintState(after);
  invariant(afterFingerprint.productProtectedSha256 === beforeFingerprint.productProtectedSha256,
    "An unapproved product column changed");
  invariant(afterFingerprint.templateFiles === expected.templateFiles,
    `Readback must retain exactly ${expected.templateFiles} template bindings`);
  invariant(afterFingerprint.templateFilesSha256 === beforeFingerprint.templateFilesSha256,
    "template_files changed during the price correction");
  invariant(afterFingerprint.targetPriceRowsProtectedSha256 === beforeFingerprint.targetPriceRowsProtectedSha256,
    "A target price column other than price_dkk/updated_at changed");
  invariant(afterFingerprint.targetPriceSourceEvidenceSha256 === beforeFingerprint.targetPriceSourceEvidenceSha256,
    "Supplier/source evidence changed during the price correction");
  invariant(stableJson(after.product.pricing_structure) === stableJson(expectedProductPatch.pricing_structure),
    "pricing_structure readback does not equal the reviewed patch");
  invariant(stableJson(after.product.technical_specs) === stableJson(expectedProductPatch.technical_specs),
    "technical_specs readback does not equal the reviewed patch");

  const beforeById = new Map(before.targetPrices.map((row) => [row.id, row]));
  const afterById = new Map(after.targetPrices.map((row) => [row.id, row]));
  const intendedById = new Map(mappedUpdates.map((item) => [item.id, item]));
  const changedIds = [];
  for (const [id, beforeRow] of beforeById) {
    const afterRow = afterById.get(id);
    invariant(afterRow, `Price ${id} disappeared during correction`);
    if (!sameMoney(beforeRow.price_dkk, afterRow.price_dkk)) changedIds.push(id);
  }
  invariant(changedIds.length === expected.priceUpdates,
    `Readback changed ${changedIds.length} prices; expected ${expected.priceUpdates}`);
  invariant(changedIds.every((id) => intendedById.has(id)), "An unplanned price row changed");

  for (const update of mappedUpdates) {
    const row = afterById.get(update.id);
    invariant(row, `Updated price ${update.id} is missing from readback`);
    invariant(sameMoney(row.price_dkk, update.afterPriceDkk),
      `Updated price ${update.id} did not read back at ${update.afterPriceDkk}`);
    invariant(sha256Json(row.extra_data) === update.sourceEvidenceSha256,
      `Updated price ${update.id} source evidence changed`);
    const supplierCost = Number(row.extra_data?.convertedPriceDkk);
    invariant(!Number.isFinite(supplierCost) || Number(row.price_dkk) >= supplierCost,
      `Updated price ${update.id} is below supplier cost after readback`);
  }

  return {
    verifiedPriceUpdates: changedIds.length,
    unchangedPriceRowCount: after.priceRowCount,
    rereadTargetPriceRows: after.targetPrices.length,
    noBelowCostUpdatedRows: true,
    sourceEvidenceUnchanged: true,
    templateFiles: afterFingerprint.templateFiles,
    flagsRemainFalse: true,
    beforeFingerprint,
    afterFingerprint,
  };
}

async function requireData(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function exactProductPriceCount(client) {
  const { count, error } = await client
    .from("generic_product_prices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("product_id", TARGET_PRODUCT_ID);
  if (error) throw new Error(`Count sales-folder prices: ${error.message}`);
  invariant(Number.isInteger(Number(count)), "Exact sales-folder price count was not returned");
  return Number(count);
}

async function inSmallBatches(items, batchSize, action) {
  invariant(Number.isInteger(batchSize) && batchSize > 0, "Batch size must be a positive integer");
  const rows = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    rows.push(...await Promise.all(items.slice(offset, offset + batchSize).map(action)));
  }
  return rows;
}

export async function loadExactTargetPriceRows(
  client,
  plannedTargets,
  { batchSize = TARGET_READ_BATCH_SIZE } = {},
) {
  invariant(Array.isArray(plannedTargets), "Planned exact price targets are required");
  return inSmallBatches(plannedTargets, batchSize, async (target) => {
    const row = await requireData(
      client
        .from("generic_product_prices")
        .select("id,tenant_id,product_id,variant_name,variant_value,quantity,price_dkk,extra_data,created_at,updated_at,updated_by")
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("product_id", TARGET_PRODUCT_ID)
        .eq("variant_name", target.variantName)
        .eq("variant_value", target.variantValue)
        .eq("quantity", target.quantity)
        .maybeSingle(),
      `Read exact target price ${target.priceSignature}`,
    );
    invariant(row, `Exact target price is missing for ${target.priceSignature}`);
    invariant(row.variant_name === target.variantName
      && row.variant_value === target.variantValue
      && Number(row.quantity) === target.quantity,
    `Exact target price read returned the wrong indexed key for ${target.priceSignature}`);
    return row;
  });
}

export async function loadTargetEnvelope(client, expected = EXPECTED) {
  const product = await requireData(
    client
      .from("products")
      .select("*")
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("id", TARGET_PRODUCT_ID)
      .eq("slug", TARGET_SLUG)
      .single(),
    "Read sales-folder product",
  );
  const [attributeValues, priceRowCount] = await Promise.all([
    requireData(
      client
        .from("product_attribute_values")
        .select("id,tenant_id,product_id,group_id,key,meta,enabled")
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("product_id", TARGET_PRODUCT_ID)
        .limit(100),
      "Read sales-folder attribute values",
    ),
    exactProductPriceCount(client),
  ]);
  invariant(Array.isArray(attributeValues) && attributeValues.length === expected.attributeValues,
    `Target must contain exactly ${expected.attributeValues} attribute values`);
  invariant(priceRowCount === expected.priceRows,
    `Target must contain exactly ${expected.priceRows} price rows`);
  return { product, attributeValues, priceRowCount };
}

function writeJsonExclusive(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, filePath);
}

function buildBeforeSnapshot({ before, mappedUpdates, planSha256, capturedAt }) {
  invariant(mappedUpdates.length === before.targetPrices.length,
    "Snapshot must contain every exact target price and no broad price-table state");
  return {
    schemaVersion: 1,
    purpose: "Pre-write snapshot for the reviewed sales-folder spine price-parity correction",
    capturedAt,
    planSha256,
    target: {
      tenantId: MASTER_TENANT_ID,
      productId: TARGET_PRODUCT_ID,
      slug: TARGET_SLUG,
      publicationApproved: false,
    },
    intendedDatabaseColumns: {
      generic_product_prices: ["price_dkk"],
      products: ["pricing_structure", "technical_specs"],
    },
    rollbackNote:
      "If a manual rollback is explicitly approved, restore only the 274 recorded price_dkk values and the recorded pricing_structure/technical_specs after checking row IDs, current prices, product updated_at and all false publication flags. Never publish as part of rollback.",
    beforeFingerprint: fingerprintState(before),
    productBefore: {
      id: before.product.id,
      tenant_id: before.product.tenant_id,
      slug: before.product.slug,
      updated_at: before.product.updated_at,
      is_published: before.product.is_published,
      is_available_to_tenants: before.product.is_available_to_tenants,
      is_ready: before.product.is_ready,
      pricing_structure: before.product.pricing_structure,
      technical_specs: before.product.technical_specs,
      templateFilesCount: before.product.template_files.length,
      templateFilesSha256: sha256Json(before.product.template_files),
    },
    exactPriceRowCountBefore: before.priceRowCount,
    pricesBefore: before.targetPrices.map((row) => clone(row)),
  };
}

export function buildPriceUpdatePayload(update) {
  const payload = { price_dkk: Number(update.afterPriceDkk) };
  invariant(Number.isFinite(payload.price_dkk) && payload.price_dkk >= 0,
    "Price update payload requires a non-negative afterPriceDkk");
  invariant(Object.keys(payload).length === 1 && Object.keys(payload)[0] === "price_dkk",
    "Price update payload crossed its approved column boundary");
  return payload;
}

async function updateOnePrice(client, update) {
  const payload = buildPriceUpdatePayload(update);
  let query = client
    .from("generic_product_prices")
    .update(payload)
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("product_id", TARGET_PRODUCT_ID)
    .eq("id", update.id)
    .eq("variant_name", update.variantName)
    .eq("variant_value", update.variantValue)
    .eq("quantity", update.quantity)
    .eq("price_dkk", update.beforePriceDkk);
  query = update.updatedAt == null ? query.is("updated_at", null) : query.eq("updated_at", update.updatedAt);
  const data = await requireData(query.select("id,price_dkk").maybeSingle(), `Update price ${update.id}`);
  invariant(data?.id === update.id && sameMoney(data.price_dkk, update.afterPriceDkk),
    `Update price ${update.id} matched no row or returned an unexpected price`);
  return update.id;
}

async function applyPriceUpdates(client, mappedUpdates, receipt, receiptPath) {
  for (let offset = 0; offset < mappedUpdates.length; offset += WRITE_BATCH_SIZE) {
    const batch = mappedUpdates.slice(offset, offset + WRITE_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((update) => updateOnePrice(client, update)));
    const errors = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") receipt.progress.updatedPriceIds.push(result.value);
      else errors.push(`${batch[index].id}: ${result.reason?.message || result.reason}`);
    });
    receipt.progress.priceUpdatesCompleted = receipt.progress.updatedPriceIds.length;
    writeJsonAtomic(receiptPath, receipt);
    invariant(errors.length === 0, `Price update batch failed after a possible partial write: ${errors.join("; ")}`);
  }
}

async function updateProduct(client, beforeProduct, patch) {
  invariant(stableJson(Object.keys(patch).sort()) === stableJson(["pricing_structure", "technical_specs"]),
    "Product patch crossed its approved column boundary");
  let query = client
    .from("products")
    .update(patch)
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("id", TARGET_PRODUCT_ID)
    .eq("slug", TARGET_SLUG)
    .eq("updated_at", beforeProduct.updated_at)
    .eq("is_published", false)
    .eq("is_available_to_tenants", false)
    .eq("is_ready", false);
  const data = await requireData(
    query.select("id,slug,is_published,is_available_to_tenants,is_ready,pricing_structure,technical_specs").maybeSingle(),
    "Update sales-folder product configuration",
  );
  invariant(data?.id === TARGET_PRODUCT_ID, "Product update matched no row");
  invariant(data.is_published === false && data.is_available_to_tenants === false && data.is_ready === false,
    "Product update changed a publication/readiness flag");
  return data;
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(url && key,
    "SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required for the confirmed correction");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function run(argv = process.argv.slice(2), dependencies = {}) {
  const args = parseArgs(argv);
  invariant(fs.existsSync(args.planPath) && fs.statSync(args.planPath).isFile(),
    `Reviewed parity plan does not exist: ${args.planPath}`);
  const actualPlanSha256 = sha256File(args.planPath);
  invariant(actualPlanSha256 === args.expectedPlanSha256,
    `Reviewed parity plan SHA-256 mismatch: expected ${args.expectedPlanSha256}, found ${actualPlanSha256}`);
  const plan = JSON.parse(fs.readFileSync(args.planPath, "utf8"));
  validatePlan(plan, { expectedPlanSha256: actualPlanSha256 });
  invariant(!fs.existsSync(args.receiptPath), `Refusing to overwrite existing receipt: ${args.receiptPath}`);

  const client = dependencies.client || getSupabaseClient();
  const now = dependencies.now || (() => new Date());
  const beforeEnvelope = await loadTargetEnvelope(client);
  validateTargetProduct(beforeEnvelope.product, args.expectedSourcePriceSha256);
  const plannedTargets = buildPlannedPriceTargets({
    plan,
    product: beforeEnvelope.product,
    attributeValues: beforeEnvelope.attributeValues,
  });
  const before = {
    ...beforeEnvelope,
    targetPrices: await loadExactTargetPriceRows(client, plannedTargets),
  };
  const mappedUpdates = mapPlanUpdatesToLiveRows({
    plan,
    product: before.product,
    attributeValues: before.attributeValues,
    prices: before.targetPrices,
    plannedTargets,
  });
  const appliedAt = now().toISOString();
  const productPatch = buildCorrectedProductPatch({
    product: before.product,
    plan,
    planSha256: actualPlanSha256,
    appliedAt,
  });

  const snapshot = buildBeforeSnapshot({
    before,
    mappedUpdates,
    planSha256: actualPlanSha256,
    capturedAt: appliedAt,
  });
  const snapshotPath = path.join(
    path.dirname(args.receiptPath),
    "rollback",
    `spine-price-parity-before-${timestampForPath(now())}.json`,
  );
  writeJsonExclusive(snapshotPath, snapshot);
  const snapshotSha256 = sha256File(snapshotPath);

  const receipt = {
    schemaVersion: 1,
    operation: "sales_folder_spine_price_parity_correction",
    status: "running",
    startedAt: appliedAt,
    target: {
      tenantId: MASTER_TENANT_ID,
      productId: TARGET_PRODUCT_ID,
      slug: TARGET_SLUG,
      remainsPublished: false,
      remainsAvailableToTenants: false,
      remainsReady: false,
      publicationApproved: false,
    },
    approvals: { explicitConfirmWrite: true, publicationApproved: false },
    reviewedPlan: {
      path: path.relative(REPO_ROOT, args.planPath),
      sha256: actualPlanSha256,
      sourcePriceArtifactSha256: args.expectedSourcePriceSha256,
      strategy: STRATEGIES.maxExisting,
      plannedPriceUpdates: EXPECTED.priceUpdates,
      plannedInserts: 0,
      plannedDeletes: 0,
    },
    snapshot: {
      path: path.relative(REPO_ROOT, snapshotPath),
      sha256: snapshotSha256,
    },
    intendedDatabaseColumns: {
      generic_product_prices: ["price_dkk"],
      products: ["pricing_structure", "technical_specs"],
    },
    progress: {
      priceUpdatesCompleted: 0,
      updatedPriceIds: [],
      productPatchCompleted: false,
    },
    readback: null,
    rollback: {
      automaticRollbackPerformed: false,
      note: snapshot.rollbackNote,
    },
  };
  writeJsonExclusive(args.receiptPath, receipt);

  try {
    await applyPriceUpdates(client, mappedUpdates, receipt, args.receiptPath);
    invariant(receipt.progress.priceUpdatesCompleted === EXPECTED.priceUpdates,
      `Only ${receipt.progress.priceUpdatesCompleted} of ${EXPECTED.priceUpdates} prices were updated`);
    await updateProduct(client, before.product, productPatch);
    receipt.progress.productPatchCompleted = true;
    writeJsonAtomic(args.receiptPath, receipt);

    const afterEnvelope = await loadTargetEnvelope(client);
    const after = {
      ...afterEnvelope,
      targetPrices: await loadExactTargetPriceRows(client, plannedTargets),
    };
    receipt.readback = assertReadback({ before, after, mappedUpdates, expectedProductPatch: productPatch });
    receipt.status = "completed_unpublished_draft_correction";
    receipt.completedAt = now().toISOString();
    writeJsonAtomic(args.receiptPath, receipt);
    return { receipt, receiptPath: args.receiptPath, snapshotPath };
  } catch (error) {
    receipt.status = "failed_partial_write_possible";
    receipt.failedAt = now().toISOString();
    receipt.error = String(error?.message || error);
    writeJsonAtomic(args.receiptPath, receipt);
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  run()
    .then(({ receiptPath, snapshotPath, receipt }) => {
      process.stdout.write(`${JSON.stringify({
        receiptPath,
        snapshotPath,
        status: receipt.status,
        updatedPrices: receipt.readback.verifiedPriceUpdates,
        priceRows: receipt.readback.unchangedPriceRowCount,
        templateFiles: receipt.readback.templateFiles,
        remainsUnpublished: receipt.target.remainsPublished === false,
      }, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
      process.exitCode = 1;
    });
}
