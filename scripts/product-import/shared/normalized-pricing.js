export const NORMALIZED_PRICING_SCHEMA_VERSION = 1;

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
    supplierPrice: toFiniteNumberOrNull(input.supplierPrice),
    convertedPriceDkk: toFiniteNumberOrNull(input.convertedPriceDkk),
    finalPriceDkk,
    conversionRuleKey: normalizeText(input.conversionRuleKey) || null,
    markupInputs: clonePlainObject(input.markupInputs),
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
