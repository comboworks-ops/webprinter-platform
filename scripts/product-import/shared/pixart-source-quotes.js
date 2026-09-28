/** Pure Pixart source-quote preparation. No database, browser, or filesystem access. */
export const PIXART_FLAT_URL = "https://www.pixartprinting.eu/wide-format/printing-self-adhesive-pvc/flat-surface-adhesive/";
export const REGULAR_PRICE_BASIS = "REGULAR_LIST_PRICE_EX_VAT_BEFORE_TEMPORARY_PROMOTION";
const label = value => String(value ?? "").trim().replace(/\s+/g, " ");
const normalized = value => label(value).toLowerCase();
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;
const tupleKey = row => JSON.stringify([normalized(row.material), normalized(row.lamination), row.area_m2, row.quantity]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unique = values => [...new Set(values)];

export function normalizePixartLamination(value) {
  const name = normalized(value).replace(/lamination/g, "").replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  return !name || ["none", "without", "without lam", "no"].includes(name) ? "none" : name;
}

export function assertPixartEurSourceUrl(url) {
  if (url !== PIXART_FLAT_URL) throw new Error(`Flat source quotes currently support only the reviewed EUR source ${PIXART_FLAT_URL}; refusing to label an arbitrary regional URL as EUR`);
}

export class PixartSourceQuoteError extends Error {
  constructor(report) {
    super(`Pixart source quotes rejected: ${report.errors.map(error => error.code).join(", ")}`);
    this.report = report;
  }
}

/** A known product requires a separate guarded update that preserves its IDs and original config. */
export function assertNewPixartImportTarget(existingProduct) {
  if (existingProduct?.id) throw new Error(`Existing Pixart product ${existingProduct.id}: refusing to recreate its material/finish/delivery IDs or replace prices. Use dry-run and prepare an explicitly reviewed, ID-preserving config update.`);
}

/** Called again after grid stabilization, since the supplier can reject or clamp an earlier input asynchronously. */
export function assertPixartSettledDimensions(state, requested) {
  if (Array.isArray(state?.errors) && state.errors.length) throw new Error(`supplier-dimension-validation-error:${state.errors.join("; ")}`);
  if (!positive(state?.widthCm) || !positive(state?.heightCm)
    || Math.abs(state.widthCm - requested.widthCm) > 0.01 || Math.abs(state.heightCm - requested.heightCm) > 0.01) {
    throw new Error(`supplier-dimensions-changed-after-settlement:${state?.widthCm}x${state?.heightCm};requested:${requested.widthCm}x${requested.heightCm}`);
  }
}

function declaredCoverage(payload) {
  if (Array.isArray(payload?.meta?.quote_coverage)) return payload.meta.quote_coverage;
  const meta = payload?.meta || {};
  const lists = [meta.materials_used, meta.laminations_used, meta.areas_used_m2 || meta.areas_requested_m2, meta.quantities_used];
  if (lists.some(list => !Array.isArray(list) || !list.length)) return [];
  return lists[0].flatMap(material => lists[1].flatMap(lamination => lists[2].flatMap(area_m2 => lists[3].map(quantity => ({ material, lamination, area_m2, quantity })))));
}

export function buildPixartSourceQuotePlan(payload, options = {}) {
  const errors = [], warnings = [];
  const meta = payload?.meta || {};
  const sourceUrl = options.sourceUrl || PIXART_FLAT_URL;
  assertPixartEurSourceUrl(sourceUrl);
  if (meta.url !== sourceUrl) errors.push({ code: "source-url-mismatch", expected: sourceUrl, observed: meta.url ?? null });
  if (typeof meta.extracted_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(meta.extracted_at)
    || !Number.isFinite(Date.parse(meta.extracted_at))
    || !new Date(`${meta.extracted_at.slice(0, 10)}T00:00:00Z`).toISOString().startsWith(meta.extracted_at.slice(0, 10))) errors.push({ code: "extraction-timestamp-invalid" });
  if (!["regular", REGULAR_PRICE_BASIS].includes(meta.price_basis)) errors.push({ code: "regular-price-basis-not-declared", observed: meta.price_basis ?? null });
  const sourceCurrency = meta.currency || options.sourceCurrency;
  if (sourceCurrency !== "EUR") errors.push({ code: "source-currency-must-be-explicit-EUR", observed: sourceCurrency ?? null });
  const eurToDkk = options.eurToDkk ?? 7.6, markupPct = options.markupPct ?? 80;
  if (!positive(eurToDkk) || typeof markupPct !== "number" || !Number.isFinite(markupPct) || markupPct < 0) errors.push({ code: "conversion-invalid" });
  if (Object.values(payload?.missing || {}).some(value => Array.isArray(value) && value.length)) errors.push({ code: "source-options-missing", missing: payload.missing });
  const declared = options.coverage || declaredCoverage(payload);
  const expected = new Map();
  if (!Array.isArray(declared) || !declared.length) errors.push({ code: "coverage-not-declared" });
  for (const row of Array.isArray(declared) ? declared : []) {
    if (!label(row?.material) || !label(row?.lamination) || !positive(row?.area_m2) || !Number.isSafeInteger(row?.quantity) || row.quantity <= 0) {
      errors.push({ code: "coverage-tuple-invalid", tuple: row }); continue;
    }
    const key = tupleKey(row);
    if (expected.has(key)) errors.push({ code: "coverage-tuple-duplicate", tuple: row });
    expected.set(key, { material: label(row.material), lamination: label(row.lamination), area_m2: row.area_m2, quantity: row.quantity });
  }
  const unsupported = Array.isArray(meta.unsupported_combinations) ? meta.unsupported_combinations : [];
  if (unsupported.length) warnings.push({ code: "unsupported-combinations-not-priced", combinations: unsupported });
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!rows.length) errors.push({ code: "source-rows-missing" });
  const seen = new Set(), parsed = [];
  rows.forEach((row, index) => {
    const candidateAreas = unique([...expected.values()].filter(tuple => normalized(tuple.material) === normalized(row.material)
      && normalized(tuple.lamination) === normalized(row.lamination) && tuple.quantity === row.quantity).map(tuple => tuple.area_m2));
    const requestedArea = row.requested_area_m2 ?? (candidateAreas.includes(row.area_m2) ? row.area_m2
      : candidateAreas.find(area => Math.abs(area - row.area_m2) <= Math.max(0.01, area * 0.005)));
    const id = tupleKey({ ...row, area_m2: requestedArea });
    const rowErrors = [];
    if (!expected.has(id)) rowErrors.push("undeclared-combination");
    if (seen.has(id)) rowErrors.push("duplicate-combination");
    seen.add(id);
    if (row.error) rowErrors.push("extraction-error");
    if (!positive(row.width_cm) || !positive(row.height_cm) || !positive(row.area_m2)
      || Math.abs(row.width_cm * row.height_cm / 10000 - row.area_m2) > 0.000001) rowErrors.push("dimension-area-mismatch");
    if (!positive(requestedArea) || Math.abs(row.area_m2 - requestedArea) > Math.max(0.01, requestedArea * 0.005)) rowErrors.push("declared-area-mismatch");
    if (!Number.isSafeInteger(row.quantity) || row.quantity <= 0) rowErrors.push("quantity-invalid");
    for (const column of ["cheapest", "fastest"]) {
      const quote = row[`${column}_quote_eur`], rate = row[`${column}_price_per_m2_eur`], unit = row[`${column}_unit_price_eur`];
      if (!positive(quote) || !positive(rate)) rowErrors.push(`${column}-quote-invalid`);
      else {
        if (Math.abs(rate - quote / (row.area_m2 * row.quantity)) > 0.0000011) rowErrors.push(`${column}-per-m2-math-invalid`);
        if (unit != null && (!positive(unit) || Math.abs(unit - quote / row.quantity) > 0.0000011)) rowErrors.push(`${column}-unit-math-invalid`);
      }
    }
    if (rowErrors.length) errors.push({ code: "invalid-source-row", row: index, errors: rowErrors, extractionError: row.error || null });
    else parsed.push({ ...row, material: label(row.material), lamination: label(row.lamination), requested_area_m2: requestedArea });
  });
  const missing = [...expected].filter(([key]) => !seen.has(key)).map(([, row]) => row);
  if (missing.length) errors.push({ code: "declared-coverage-missing", tuples: missing });
  for (const row of parsed.filter(row => normalizePixartLamination(row.lamination) !== "none")) {
    if (!parsed.some(base => normalized(base.material) === normalized(row.material) && normalizePixartLamination(base.lamination) === "none"
      && base.area_m2 === row.area_m2 && base.quantity === row.quantity)) {
      errors.push({ code: "no-finish-baseline-missing", material: row.material, lamination: row.lamination, area_m2: row.area_m2, quantity: row.quantity });
    }
  }
  const coverage = { declared: expected.size, observed: rows.length, valid: parsed.length, missing: missing.length, unsupported };
  if (errors.length) throw new PixartSourceQuoteError({ status: "blocked", errors, warnings, coverage });
  const factor = eurToDkk * (1 + markupPct / 100);
  if (!positive(factor)) throw new PixartSourceQuoteError({ status: "blocked", errors: [{ code: "conversion-factor-invalid" }], warnings, coverage });
  const combinations = new Map();
  for (const row of parsed) for (const [delivery, column] of [["standard-delivery", "cheapest"], ["fast-delivery", "fastest"]]) {
    const key = JSON.stringify([normalized(row.material), normalized(row.lamination), delivery]);
    if (!combinations.has(key)) combinations.set(key, { material: row.material, lamination: row.lamination, delivery, points: [] });
    const points = combinations.get(key).points;
    if (points.some(point => point.area_m2 === row.area_m2 && point.quantity === row.quantity)) {
      throw new PixartSourceQuoteError({ status: "blocked", errors: [{ code: "duplicate-actual-area-and-quantity", material: row.material, lamination: row.lamination, area_m2: row.area_m2, quantity: row.quantity }], warnings, coverage });
    }
    const totalPrice = Number((row[`${column}_quote_eur`] * factor).toFixed(6));
    if (!positive(totalPrice)) throw new PixartSourceQuoteError({ status: "blocked", errors: [{ code: "converted-order-total-invalid" }], warnings, coverage });
    points.push({ area_m2: row.area_m2, quantity: row.quantity, total_price: totalPrice });
  }
  const result = [...combinations.values()];
  result.forEach(combination => combination.points.sort((a, b) => a.quantity - b.quantity || a.area_m2 - b.area_m2));
  return {
    version: 1, area_pricing_basis: "per_piece_quotes", currency: "DKK", price_basis: "regular",
    source: { url: meta.url, extracted_at: meta.extracted_at, currency: "EUR", currency_basis: meta.currency ? "extraction_metadata" : "explicit_import_argument",
      price_basis: meta.price_basis, temporary_promotions_included: false, vat_included: false,
      proof_boundary: "Validated extraction data; not an independently verified supplier invoice or payable promotional quote." },
    conversion: { eur_to_dkk: eurToDkk, markup_pct: markupPct, factor }, coverage, warnings,
    materials: unique(parsed.map(row => row.material)), laminations: unique(parsed.map(row => row.lamination)),
    quantities: unique(parsed.map(row => row.quantity)).sort((a, b) => a - b),
    combinations: result,
  };
}

/** Bind only IDs that will actually be inserted, or existing IDs from an explicitly reviewed update. */
export function bindPixartSourceQuoteModel(plan, { materialIds, finishIds, productIds }) {
  const lookup = (mapping, name) => mapping instanceof Map ? mapping.get(normalized(name)) : mapping?.[normalized(name)];
  const required = (mapping, name, kind) => {
    const id = lookup(mapping, name) ?? (kind === "finish" ? lookup(mapping, normalizePixartLamination(name)) : undefined);
    if (!uuid.test(String(id))) throw new Error(`Missing or invalid ${kind} UUID for ${name}`);
    return id;
  };
  const standard = required(productIds, "standard-delivery", "production");
  const usedMaterials = plan.materials.map(name => required(materialIds, name, "material"));
  const usedFinishes = plan.laminations.filter(name => normalizePixartLamination(name) !== "none").map(name => required(finishIds, name, "finish"));
  const usedProducts = unique(plan.combinations.map(item => item.delivery)).map(name => required(productIds, name, "production"));
  const allIds = [...usedMaterials, ...usedFinishes, ...usedProducts];
  if (new Set(allIds).size !== allIds.length) throw new Error("Selection ID mappings collide; refusing ambiguous quote combinations");
  return {
    version: 1, currency: "DKK", price_basis: "regular", base_product_ids: [standard],
    combinations: plan.combinations.map(item => ({
      material_id: required(materialIds, item.material, "material"),
      finish_ids: normalizePixartLamination(item.lamination) === "none" ? [] : [required(finishIds, item.lamination, "finish")],
      product_ids: [required(productIds, item.delivery, "production")],
      points: item.points.map(point => ({ ...point })),
    })),
  };
}

export function summarizePixartSourceQuotePlan(plan) {
  return {
    area_pricing_basis: plan.area_pricing_basis, source: plan.source, conversion: plan.conversion, coverage: plan.coverage,
    warnings: plan.warnings, quantities: plan.quantities, interpolation: "Full order total between bounded piece-area points at the exact selected quantity and combination; no quantity interpolation or extrapolation.",
    combinations: plan.combinations.map(item => ({ material: item.material, lamination: item.lamination, delivery: item.delivery,
      quantities: unique(item.points.map(point => point.quantity)), areas_m2: unique(item.points.map(point => point.area_m2)).sort((a, b) => a - b), point_count: item.points.length })),
    review_examples: plan.combinations.slice(0, 2).map(item => ({ material: item.material, lamination: item.lamination, delivery: item.delivery,
      points: item.points.filter(point => point.quantity <= 3 && point.area_m2 <= 2).map(point => ({ ...point, price_per_piece: Number((point.total_price / point.quantity).toFixed(6)) })) })),
    existing_product_policy: "Existing products are not recreated or overwritten. Prepare an ID-preserving config proposal and retain the original before an approved update.",
  };
}
