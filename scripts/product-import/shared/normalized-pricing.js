import { parseFxSnapshot } from "./fx-snapshot.js";

export const NORMALIZED_PRICING_SCHEMA_VERSION = 1;

const SNAPSHOT_EVIDENCE_KEYS = Object.freeze([
  "id",
  "schemaVersion",
  "provider",
  "baseCurrency",
  "quoteCurrency",
  "rate",
  "rateDate",
  "fetchedAt",
  "sourcePayloadSha256",
]);
const PRICING_BUFFER_KEYS = Object.freeze(["type", "value", "amountDkk"]);
const SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CANONICAL_EVIDENCE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPositiveInteger(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || Math.round(num) !== num) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return num;
}

function toFiniteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("Expected a finite number");
  }
  return num;
}

function normalizeSelections(value) {
  if (!isPlainObject(value)) {
    throw new Error("selections must be an object");
  }

  const normalized = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const selectionKey = normalizeText(key);
    const selectionValue = normalizeText(rawValue);
    if (!selectionKey || !selectionValue) continue;
    normalized[selectionKey] = selectionValue;
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error("selections must contain at least one non-empty value");
  }

  return normalized;
}

function normalizeDimensions(dimensions) {
  const safe = isPlainObject(dimensions) ? dimensions : {};
  return {
    widthMm: toFiniteNumberOrNull(safe.widthMm),
    heightMm: toFiniteNumberOrNull(safe.heightMm),
    areaM2: toFiniteNumberOrNull(safe.areaM2),
  };
}

function clonePlainObject(value) {
  return isPlainObject(value) ? { ...value } : {};
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.every((key) => typeof key === "string") &&
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => keys.includes(key))
  );
}

function toEvidenceDecimal(value, fieldName, { positive = false } = {}) {
  const validNumber =
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Object.is(value, -0) &&
    Number.isSafeInteger(value) === Number.isInteger(value);
  const validString =
    typeof value === "string" &&
    CANONICAL_EVIDENCE_DECIMAL.test(value) &&
    Number.isFinite(Number(value));
  if (!validNumber && !validString) {
    throw new Error(`${fieldName} must be an exact non-negative decimal`);
  }
  if (Number(value) < 0 || (positive && Number(value) <= 0)) {
    throw new Error(`${fieldName} must be ${positive ? "positive" : "non-negative"}`);
  }
  return value;
}

function normalizeFxSnapshotEvidence(value) {
  if (!hasExactKeys(value, SNAPSHOT_EVIDENCE_KEYS)) {
    throw new Error("fxSnapshot must be an exact evidence object");
  }
  if (typeof value.id !== "string" || !SNAPSHOT_ID.test(value.id)) {
    throw new Error("fxSnapshot.id is invalid");
  }
  const snapshot = parseFxSnapshot({
    schemaVersion: value.schemaVersion,
    provider: value.provider,
    baseCurrency: value.baseCurrency,
    quoteCurrency: value.quoteCurrency,
    rate: value.rate,
    rateDate: value.rateDate,
    fetchedAt: value.fetchedAt,
    sourcePayloadSha256: value.sourcePayloadSha256,
  });
  return { id: value.id, ...snapshot };
}

function normalizePricingBuffer(value) {
  if (!hasExactKeys(value, PRICING_BUFFER_KEYS) || value.type !== "percent") {
    throw new Error("pricingBuffer must be explicit percent evidence");
  }
  return {
    type: "percent",
    value: toEvidenceDecimal(value.value, "pricingBuffer.value"),
    amountDkk: toEvidenceDecimal(value.amountDkk, "pricingBuffer.amountDkk"),
  };
}

/**
 * Canonical in-memory pricing payload used between extractor-specific scripts
 * and shared publishers. It is intentionally richer than the current DB rows
 * so free-size, storformat, matrix, and supplier-specific metadata can coexist
 * without changing existing table contracts.
 */
export function createNormalizedPricingRecord(input) {
  if (!isPlainObject(input)) {
    throw new Error("Normalized pricing input must be an object");
  }

  const supplier = normalizeText(input.supplier);
  const sourceType = normalizeText(input.sourceType);
  const target = normalizeText(input.target || "matrix-layout-v1");
  const importerKey = normalizeText(input.importerKey);
  const quantity = toPositiveInteger(input.quantity, "quantity");
  const finalPriceDkk = toPositiveInteger(
    Math.round(Number(input.finalPriceDkk)),
    "finalPriceDkk"
  );

  if (!supplier) throw new Error("supplier is required");
  if (!sourceType) throw new Error("sourceType is required");
  if (!importerKey) throw new Error("importerKey is required");

  const hasSnapshotEvidence = input.fxSnapshot !== undefined;
  const fxSnapshot = hasSnapshotEvidence
    ? normalizeFxSnapshotEvidence(input.fxSnapshot)
    : null;
  const pricingBuffer = hasSnapshotEvidence
    ? normalizePricingBuffer(input.pricingBuffer)
    : null;
  const bufferedCostDkk = hasSnapshotEvidence
    ? toEvidenceDecimal(input.bufferedCostDkk, "bufferedCostDkk")
    : null;
  const markupAmountDkk = hasSnapshotEvidence
    ? toEvidenceDecimal(input.markupAmountDkk, "markupAmountDkk")
    : null;

  if (
    !hasSnapshotEvidence &&
    (input.pricingBuffer !== undefined ||
      input.bufferedCostDkk !== undefined ||
      input.markupAmountDkk !== undefined)
  ) {
    throw new Error("Snapshot pricing evidence requires fxSnapshot");
  }

  return {
    schemaVersion: NORMALIZED_PRICING_SCHEMA_VERSION,
    target,
    supplier,
    sourceType,
    sourceUrl: normalizeText(input.sourceUrl) || null,
    supplierProductType: normalizeText(input.supplierProductType) || null,
    productFamily: normalizeText(input.productFamily) || null,
    importerKey,
    sourceKey: normalizeText(input.sourceKey) || null,
    extractedAt: normalizeText(input.extractedAt) || new Date().toISOString(),
    quantity,
    supplierCurrency: normalizeText(input.supplierCurrency || "EUR") || "EUR",
    supplierPrice: hasSnapshotEvidence
      ? toEvidenceDecimal(input.supplierPrice, "supplierPrice")
      : toFiniteNumberOrNull(input.supplierPrice),
    convertedPriceDkk: hasSnapshotEvidence
      ? toEvidenceDecimal(input.convertedPriceDkk, "convertedPriceDkk")
      : toFiniteNumberOrNull(input.convertedPriceDkk),
    finalPriceDkk,
    conversionRuleKey: normalizeText(input.conversionRuleKey) || null,
    markupInputs: clonePlainObject(input.markupInputs),
    ...(hasSnapshotEvidence
      ? {
          fxSnapshot,
          pricingBuffer,
          bufferedCostDkk,
          markupAmountDkk,
        }
      : {}),
    dimensions: normalizeDimensions(input.dimensions),
    selections: normalizeSelections(input.selections),
    labels: clonePlainObject(input.labels),
    sourceIdentifiers: clonePlainObject(input.sourceIdentifiers),
    extraData: clonePlainObject(input.extraData),
    rawPayload: input.rawPayload ?? null,
  };
}

export function createNormalizedMatrixRecord(input) {
  const record = createNormalizedPricingRecord({
    ...input,
    target: "matrix-layout-v1",
  });

  return record;
}

export function collectNormalizedQuantities(records) {
  return Array.from(
    new Set((Array.isArray(records) ? records : []).map((record) => Number(record.quantity)))
  )
    .filter((quantity) => Number.isFinite(quantity) && quantity > 0)
    .sort((a, b) => a - b);
}

export function collectSelectionValues(records, selectionKey, preferredOrder = []) {
  const ordered = [];
  const seen = new Set();

  preferredOrder.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    ordered.push(normalized);
  });

  for (const record of Array.isArray(records) ? records : []) {
    const value = normalizeText(record?.selections?.[selectionKey]);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(value);
  }

  return ordered;
}

export function summarizeNormalizedRecords(records) {
  const rows = Array.isArray(records) ? records : [];
  const targets = new Set();
  const suppliers = new Set();
  const importers = new Set();

  rows.forEach((record) => {
    if (record?.target) targets.add(record.target);
    if (record?.supplier) suppliers.add(record.supplier);
    if (record?.importerKey) importers.add(record.importerKey);
  });

  return {
    rows: rows.length,
    targets: Array.from(targets).sort(),
    suppliers: Array.from(suppliers).sort(),
    importers: Array.from(importers).sort(),
    quantities: collectNormalizedQuantities(rows),
  };
}
