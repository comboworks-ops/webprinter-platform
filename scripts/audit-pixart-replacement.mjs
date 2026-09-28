#!/usr/bin/env node
/** Read-only audit of a Pixart extraction candidate. Never imports, smooths, or writes prices. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PIXART_FLAT_SOURCE_URL = "https://www.pixartprinting.eu/wide-format/printing-self-adhesive-pvc/flat-surface-adhesive/";
const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const validTimestamp = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().startsWith(value.slice(0, 10));
const key = (material, lamination, area, quantity) => JSON.stringify([normalize(material), normalize(lamination), area, quantity]);
const dimensions = (area, widthCm) => {
  const width = Math.round(widthCm || Math.sqrt(area * 10000));
  return { width_cm: width, height_cm: Math.max(1, Math.round(area * 10000 / width)) };
};

/** Unsupported combinations must be explicitly documented, never filled with another option's price. */
export function auditPixartReplacement(payload, expected) {
  for (const name of ["materials", "laminations", "areas", "quantities"]) {
    if (!Array.isArray(expected?.[name]) || !expected[name].length) throw new Error(`Expected ${name} must be a nonempty list`);
    const values = expected[name].map(value => ["materials", "laminations"].includes(name) ? normalize(value) : value);
    if (new Set(values).size !== values.length) throw new Error(`Expected ${name} contains duplicates`);
    if (values.some(value => typeof value === "string" ? !value : !positive(value))) throw new Error(`Invalid expected ${name}`);
  }
  if (expected.quantities.some(value => !Number.isSafeInteger(value))) throw new Error("Quantities must be positive integers");
  if (expected.widthCm != null && !positive(expected.widthCm)) throw new Error("widthCm must be positive");
  const blockers = [], reviewFlags = [];
  const expectedSourceUrl = expected.sourceUrl || PIXART_FLAT_SOURCE_URL;
  if (!/^https?:$/.test(new URL(expectedSourceUrl).protocol)) throw new Error("Expected source URL must be HTTP or HTTPS");
  if (payload?.meta?.url !== expectedSourceUrl) blockers.push({ code: "source-url-mismatch", expected: expectedSourceUrl, observed: payload?.meta?.url ?? null });
  if (!validTimestamp(payload?.meta?.extracted_at)) blockers.push({ code: "extraction-timestamp-invalid", observed: payload?.meta?.extracted_at ?? null });
  const declaredCurrency = payload?.meta?.currency ?? null;
  if (declaredCurrency != null && declaredCurrency !== "EUR") blockers.push({ code: "currency-field-conflict", expected: "EUR", observed: declaredCurrency });
  const tuples = new Map();
  for (const material of expected.materials) for (const lamination of expected.laminations)
    for (const area of expected.areas) for (const quantity of expected.quantities) {
      const tuple = { material, lamination, requested_area_m2: area, quantity, ...dimensions(area, expected.widthCm) };
      tuples.set(key(material, lamination, area, quantity), tuple);
    }
  // Two requested areas that round to the same dimensions cannot be independently verified.
  const geometryKeys = expected.areas.map(area => JSON.stringify(dimensions(area, expected.widthCm)));
  if (new Set(geometryKeys).size !== geometryKeys.length) throw new Error("Expected areas resolve to duplicate dimensions");

  const unsupported = new Map();
  for (const declaration of expected.unsupported || []) {
    if (!normalize(declaration.material) || !normalize(declaration.lamination) || !normalize(declaration.reason)) {
      throw new Error("Unsupported declarations require material, lamination, and reason");
    }
    const matches = [...tuples].filter(([, tuple]) => normalize(tuple.material) === normalize(declaration.material)
      && normalize(tuple.lamination) === normalize(declaration.lamination)
      && (declaration.area_m2 == null || tuple.requested_area_m2 === declaration.area_m2)
      && (declaration.quantity == null || tuple.quantity === declaration.quantity));
    if (!matches.length) throw new Error("Unsupported declaration matches no expected combination");
    for (const [id, tuple] of matches) unsupported.set(id, { ...tuple, reason: declaration.reason, evidence: declaration.evidence || null });
  }
  if (unsupported.size) reviewFlags.push({ code: "unsupported-combinations", count: unsupported.size });

  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!Array.isArray(payload?.rows)) blockers.push({ code: "rows-missing" });
  const seen = new Map(), valid = [], invalid = [];
  for (const [index, row] of rows.entries()) {
    const tupleEntry = [...tuples].find(([, tuple]) => normalize(row?.material) === normalize(tuple.material)
      && normalize(row?.lamination) === normalize(tuple.lamination) && row?.quantity === tuple.quantity
      && row?.width_cm === tuple.width_cm && row?.height_cm === tuple.height_cm);
    if (!tupleEntry) {
      blockers.push({ code: "unexpected-combination-or-dimensions", row: index, material: row?.material, lamination: row?.lamination,
        quantity: row?.quantity, width_cm: row?.width_cm, height_cm: row?.height_cm });
      continue;
    }
    const [id, tuple] = tupleEntry;
    if (seen.has(id)) blockers.push({ code: "duplicate-combination", row: index, previousRow: seen.get(id), tuple });
    seen.set(id, index);
    if (unsupported.has(id)) {
      if (!row.error) reviewFlags.push({ code: "priced-declared-unsupported-combination", row: index, tuple });
      continue;
    }
    const errors = [];
    if (row.error) errors.push("extraction-error");
    const actualArea = row.width_cm * row.height_cm / 10000;
    if (!positive(row.area_m2) || Math.abs(row.area_m2 - actualArea) > 0.000001) errors.push("dimension-area-mismatch");
    for (const column of ["cheapest", "fastest"]) {
      const quote = row[`${column}_quote_eur`];
      const rate = row[`${column}_price_per_m2_eur`];
      if (!positive(quote) || !positive(rate)) { errors.push(`${column}-price-missing-or-invalid`); continue; }
      if (Math.abs(rate - quote / (actualArea * row.quantity)) > 0.0000011) errors.push(`${column}-per-m2-math-mismatch`);
      const unit = row[`${column}_unit_price_eur`];
      if (unit != null && (!positive(unit) || Math.abs(unit - quote / row.quantity) > 0.0000011)) errors.push(`${column}-unit-math-mismatch`);
    }
    if (errors.length) {
      const issue = { code: "invalid-row", row: index, tuple, errors, extractionError: row.error || null };
      blockers.push(issue); invalid.push(index); continue;
    }
    if (row.fastest_quote_eur + 0.005 < row.cheapest_quote_eur) reviewFlags.push({ code: "fast-delivery-cheaper-than-standard", row: index });
    valid.push({ ...row, source_row: index, requested_area_m2: tuple.requested_area_m2 });
  }
  const missing = [...tuples].filter(([id]) => !unsupported.has(id) && !seen.has(id)).map(([, tuple]) => tuple);
  if (missing.length) blockers.push({ code: "missing-combinations", count: missing.length, tuples: missing });

  for (const material of expected.materials) for (const lamination of expected.laminations) {
    const group = valid.filter(row => normalize(row.material) === normalize(material) && normalize(row.lamination) === normalize(lamination));
    for (const area of expected.areas) {
      const series = group.filter(row => row.requested_area_m2 === area).sort((a, b) => a.quantity - b.quantity);
      for (let index = 1; index < series.length; index++) {
        const previous = series[index - 1], next = series[index];
        for (const column of ["cheapest", "fastest"]) {
          const field = `${column}_quote_eur`, ratio = next.quantity / previous.quantity;
          const reference = { material, lamination, area_m2: area, column, quantities: [previous.quantity, next.quantity],
            quotes_eur: [previous[field], next[field]], rows: [previous.source_row, next.source_row] };
          if (next[field] < previous[field] - 0.01) reviewFlags.push({ code: "quantity-total-price-decrease", ...reference });
          // Quotes are rounded to cents; tolerate the propagated rounding error when comparing unit prices.
          if (next[field] - previous[field] * ratio > 0.01 * (1 + ratio) + 1e-9) reviewFlags.push({ code: "quantity-unit-price-increase", ...reference });
        }
      }
    }
    for (let a = 0; a < expected.areas.length; a++) for (let b = a + 1; b < expected.areas.length; b++) {
      const areaA = expected.areas[a], areaB = expected.areas[b];
      if (Math.abs(areaA - areaB) < 0.05) continue;
      const shared = expected.quantities.map(quantity => [group.find(row => row.requested_area_m2 === areaA && row.quantity === quantity),
        group.find(row => row.requested_area_m2 === areaB && row.quantity === quantity)]).filter(([left, right]) => left && right);
      for (const column of ["cheapest", "fastest"]) {
        const field = `${column}_quote_eur`;
        const identical = shared.filter(([left, right]) => Math.abs(left[field] - right[field]) < 0.005);
        for (const [left, right] of identical) reviewFlags.push({ code: "repeated-individual-quote-across-areas", material, lamination, column,
          areas_m2: [areaA, areaB], quantity: left.quantity, quote_eur: left[field], rows: [left.source_row, right.source_row] });
        if (shared.length >= 3 && identical.length === shared.length) blockers.push({ code: `duplicate-${column}-quote-series-across-areas`,
          material, lamination, column, areas_m2: [areaA, areaB], quantities: shared.map(([row]) => row.quantity) });
      }
    }
  }
  for (const material of expected.materials) for (const area of expected.areas) for (const lamination of expected.laminations.filter(value => normalize(value) !== "none")) {
    const group = valid.filter(row => normalize(row.material) === normalize(material) && row.requested_area_m2 === area);
    const shared = expected.quantities.map(quantity => [group.find(row => normalize(row.lamination) === "none" && row.quantity === quantity),
      group.find(row => normalize(row.lamination) === normalize(lamination) && row.quantity === quantity)]).filter(([left, right]) => left && right);
    for (const column of ["cheapest", "fastest"]) {
      const field = `${column}_quote_eur`;
      if (shared.length >= 3 && shared.every(([left, right]) => Math.abs(left[field] - right[field]) < 0.005)) {
        blockers.push({ code: `duplicate-${column}-quote-series-across-finishes`, material, column, area_m2: area, finishes: ["None", lamination], quantities: shared.map(([row]) => row.quantity) });
      }
    }
  }
  for (let a = 0; a < expected.materials.length; a++) for (let b = a + 1; b < expected.materials.length; b++) {
    const materialA = expected.materials[a], materialB = expected.materials[b];
    const leftRows = valid.filter(row => normalize(row.material) === normalize(materialA));
    const rightRows = valid.filter(row => normalize(row.material) === normalize(materialB));
    const shared = leftRows.map(left => [left, rightRows.find(right => normalize(right.lamination) === normalize(left.lamination)
      && right.requested_area_m2 === left.requested_area_m2 && right.quantity === left.quantity)]).filter(([, right]) => right);
    for (const column of ["cheapest", "fastest"]) {
      const field = `${column}_quote_eur`;
      if (shared.length >= 3 && shared.every(([left, right]) => Math.abs(left[field] - right[field]) < 0.005)) {
        // Different materials can genuinely share prices. Record a review point, never reject it as stale on this evidence alone.
        reviewFlags.push({ code: "repeated-whole-quote-series-across-materials", materials: [materialA, materialB], column,
          sharedCombinations: shared.length, rows: shared.map(([left, right]) => [left.source_row, right.source_row]) });
      }
    }
  }
  return {
    audit: "pixart-replacement-candidate-v2", status: blockers.length ? "blocked" : reviewFlags.length ? "review_required" : "ready_for_review",
    scope: "Local extraction validation only; no supplier-price verification, smoothing, import, or live write is performed.",
    sourceMetadata: { url: payload?.meta?.url ?? null, extracted_at: payload?.meta?.extracted_at ?? null,
      currency: { code: "EUR", basis: declaredCurrency === "EUR" ? "declared_in_extraction_metadata_and_eur_field_names" : "inferred_from_extractor_eur_field_names",
        declaredInExtractionMetadata: declaredCurrency, independentlyVerified: false } },
    coverage: { expected: tuples.size, expectedSupported: tuples.size - unsupported.size, observed: rows.length,
      validSupported: valid.length, missing: missing.length, invalid: invalid.length, unsupported: unsupported.size },
    expected: { materials: expected.materials, laminations: expected.laminations, areas: expected.areas, quantities: expected.quantities, widthCm: expected.widthCm || null, sourceUrl: expectedSourceUrl },
    unsupported: [...unsupported.values()], blockers, reviewFlags,
  };
}

function main(argv) {
  const allowed = new Set(["input", "materials", "laminations", "areas", "quantities", "width-cm", "source-url", "unsupported", "out"]);
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.replace(/^--/, "");
    if (!argv[index]?.startsWith("--") || !allowed.has(name) || !argv[index + 1] || argv[index + 1].startsWith("--") || args[name]) throw new Error(`Invalid argument ${argv[index]}`);
    args[name] = argv[index + 1];
  }
  for (const name of ["input", "materials", "laminations", "areas", "quantities"]) if (!args[name]) throw new Error(`Missing --${name}`);
  const csv = name => args[name].split(",").map(value => value.trim());
  const inputBytes = fs.readFileSync(args.input);
  const result = auditPixartReplacement(JSON.parse(inputBytes.toString("utf8")), {
    materials: csv("materials"), laminations: csv("laminations"), areas: csv("areas").map(Number), quantities: csv("quantities").map(Number),
    widthCm: args["width-cm"] ? Number(args["width-cm"]) : undefined,
    sourceUrl: args["source-url"],
    unsupported: args.unsupported ? JSON.parse(fs.readFileSync(args.unsupported, "utf8")) : [],
  });
  result.input = path.resolve(args.input);
  result.inputSha256 = createHash("sha256").update(inputBytes).digest("hex");
  const output = JSON.stringify(result, null, 2) + "\n";
  if (args.out) fs.writeFileSync(args.out, output, { flag: "wx" });
  process.stdout.write(output);
  process.exitCode = result.blockers.length ? 1 : result.reviewFlags.length ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
