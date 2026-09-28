import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditPixartReplacement, PIXART_FLAT_SOURCE_URL } from "./audit-pixart-replacement.mjs";

const expected = () => ({ materials: ["Matt"], laminations: ["None", "Standard Matt"], areas: [1, 2], quantities: [1, 2, 3] });
function fixture(plan = expected()) {
  const rows = [];
  for (const material of plan.materials) for (const lamination of plan.laminations) for (const area of plan.areas) for (const quantity of plan.quantities) {
    const width_cm = Math.round(plan.widthCm || Math.sqrt(area * 10000)), height_cm = Math.round(area * 10000 / width_cm);
    const area_m2 = width_cm * height_cm / 10000;
    const cheapest_quote_eur = Math.round((10 + area_m2 * 8 + (lamination === "None" ? 0 : 5)) * quantity * 100) / 100;
    rows.push({ material, lamination, width_cm, height_cm, area_m2, quantity, error: null,
      cheapest_quote_eur, fastest_quote_eur: cheapest_quote_eur * 1.5,
      cheapest_price_per_m2_eur: Number((cheapest_quote_eur / area_m2 / quantity).toFixed(6)),
      fastest_price_per_m2_eur: Number((cheapest_quote_eur * 1.5 / area_m2 / quantity).toFixed(6)) });
  }
  return { meta: { url: PIXART_FLAT_SOURCE_URL, extracted_at: "2026-09-09T11:51:58.230Z" }, rows };
}
function quote(row, cheapest) {
  row.cheapest_quote_eur = cheapest; row.fastest_quote_eur = cheapest * 1.5;
  row.cheapest_price_per_m2_eur = Number((cheapest / row.area_m2 / row.quantity).toFixed(6));
  row.fastest_price_per_m2_eur = Number((cheapest * 1.5 / row.area_m2 / row.quantity).toFixed(6));
}
const codes = result => [...result.blockers, ...result.reviewFlags].map(issue => issue.code);

test("complete candidate accepts rounded actual geometry without inventing nominal area", () => {
  const result = auditPixartReplacement(fixture(), expected());
  assert.equal(result.status, "ready_for_review");
  assert.equal(result.coverage.validSupported, 12);
  assert.equal(result.coverage.missing, 0);
});
test("coverage rejects missing, duplicate and unexpected tuples even when every quote is priced", () => {
  const data = fixture(); data.rows.pop(); data.rows.push({ ...data.rows[0] }); data.rows.push({ ...data.rows[0], material: "Other" });
  const result = auditPixartReplacement(data, expected());
  for (const code of ["missing-combinations", "duplicate-combination", "unexpected-combination-or-dimensions"]) assert.ok(codes(result).includes(code));
});
test("invalid dimensions, null prices, extraction errors and bad unit math are blocking", () => {
  const data = fixture();
  data.rows[0].width_cm = 99; data.rows[1].area_m2 = 100; data.rows[2].cheapest_quote_eur = null;
  data.rows[3].error = "quantity-row-not-found"; data.rows[4].fastest_unit_price_eur = 999; data.rows[5].fastest_price_per_m2_eur = 1;
  const result = auditPixartReplacement(data, expected());
  assert.equal(result.status, "blocked"); assert.equal(result.coverage.invalid, 5); assert.equal(result.coverage.missing, 1);
});
test("one carried-over area quote is flagged for review and whole stale series are blocked", () => {
  const data = fixture(); quote(data.rows[3], data.rows[0].cheapest_quote_eur);
  let result = auditPixartReplacement(data, expected());
  assert.ok(result.reviewFlags.some(issue => issue.code === "repeated-individual-quote-across-areas"));
  assert.ok(!result.blockers.some(issue => issue.code === "duplicate-cheapest-quote-series-across-areas"));
  quote(data.rows[4], data.rows[1].cheapest_quote_eur); quote(data.rows[5], data.rows[2].cheapest_quote_eur);
  result = auditPixartReplacement(data, expected());
  assert.ok(result.blockers.some(issue => issue.code === "duplicate-cheapest-quote-series-across-areas"));
});
test("None matching paid finish across three quantities is blocked; equal paid finishes are allowed", () => {
  const plan = expected(); plan.laminations.push("Standard Gloss"); const data = fixture(plan);
  assert.equal(auditPixartReplacement(data, plan).status, "ready_for_review");
  for (let index = 0; index < 3; index++) quote(data.rows[6 + index], data.rows[index].cheapest_quote_eur);
  assert.ok(auditPixartReplacement(data, plan).blockers.some(issue => issue.code === "duplicate-cheapest-quote-series-across-finishes"));
});
test("quantity unit increases and decreasing totals require review, with cent-rounding tolerance", () => {
  const data = fixture(); quote(data.rows[1], data.rows[0].cheapest_quote_eur * 2 + 0.01);
  assert.ok(!codes(auditPixartReplacement(data, expected())).includes("quantity-unit-price-increase"));
  quote(data.rows[1], data.rows[0].cheapest_quote_eur * 2 + 5); quote(data.rows[2], data.rows[1].cheapest_quote_eur - 1);
  const result = auditPixartReplacement(data, expected());
  assert.ok(codes(result).includes("quantity-unit-price-increase")); assert.ok(codes(result).includes("quantity-total-price-decrease"));
});
test("documented unsupported combinations remain recorded and need review without fabricated rows", () => {
  const plan = expected(); plan.unsupported = [{ material: "Matt", lamination: "Standard Matt", reason: "Supplier marks this combination unavailable", evidence: "Probe artifact" }];
  const data = fixture(plan); data.rows = data.rows.filter(row => row.lamination === "None");
  const result = auditPixartReplacement(data, plan);
  assert.equal(result.coverage.unsupported, 6); assert.equal(result.coverage.expectedSupported, 6);
  assert.equal(result.coverage.missing, 0); assert.equal(result.blockers.length, 0); assert.equal(result.status, "review_required");
  assert.equal(result.unsupported[0].evidence, "Probe artifact");
});
test("explicit 120 by 80 cm input works and invalid expected plans fail before auditing", () => {
  const plan = { ...expected(), areas: [0.96], widthCm: 120 };
  assert.equal(auditPixartReplacement(fixture(plan), plan).status, "ready_for_review");
  assert.throws(() => auditPixartReplacement(fixture(), { ...expected(), quantities: [1, 1] }), /duplicates/);
  assert.throws(() => auditPixartReplacement(fixture(), { ...expected(), unsupported: [{ material: "Matt", lamination: "None" }] }), /reason/);
  assert.throws(() => auditPixartReplacement(fixture(), { ...expected(), unsupported: [{ material: "Other", lamination: "None", reason: "Unavailable" }] }), /matches no/);
});
test("missing or wrong source metadata and invalid timestamp block a fully priced candidate", () => {
  const data = fixture(); delete data.meta;
  let result = auditPixartReplacement(data, expected());
  assert.ok(codes(result).includes("source-url-mismatch")); assert.ok(codes(result).includes("extraction-timestamp-invalid"));
  data.meta = { url: "https://example.com/another-product", extracted_at: "2026-02-30T12:00:00Z" };
  result = auditPixartReplacement(data, expected());
  assert.equal(result.status, "blocked"); assert.ok(codes(result).includes("extraction-timestamp-invalid"));
  data.meta.extracted_at = "2026-09-09T12:00:00Z";
  result = auditPixartReplacement(data, { ...expected(), sourceUrl: data.meta.url });
  assert.equal(result.status, "ready_for_review"); assert.equal(result.sourceMetadata.url, data.meta.url);
  assert.equal(result.sourceMetadata.currency.basis, "inferred_from_extractor_eur_field_names");
  assert.equal(result.sourceMetadata.currency.independentlyVerified, false);
  data.meta.currency = "USD";
  assert.ok(codes(auditPixartReplacement(data, { ...expected(), sourceUrl: data.meta.url })).includes("currency-field-conflict"));
});
test("fastest-only stale area and finish series are detected independently of cheapest quotes", () => {
  const fastQuote = (row, value) => { row.fastest_quote_eur = value; row.fastest_price_per_m2_eur = Number((value / row.area_m2 / row.quantity).toFixed(6)); };
  const data = fixture(); fastQuote(data.rows[3], data.rows[0].fastest_quote_eur);
  let result = auditPixartReplacement(data, expected());
  assert.ok(result.reviewFlags.some(issue => issue.code === "repeated-individual-quote-across-areas" && issue.column === "fastest"));
  for (let index = 1; index < 3; index++) fastQuote(data.rows[3 + index], data.rows[index].fastest_quote_eur);
  result = auditPixartReplacement(data, expected());
  assert.ok(codes(result).includes("duplicate-fastest-quote-series-across-areas"));
  assert.ok(!codes(result).includes("duplicate-cheapest-quote-series-across-areas"));
  const finishData = fixture();
  for (let index = 0; index < 3; index++) fastQuote(finishData.rows[6 + index], finishData.rows[index].fastest_quote_eur);
  assert.ok(codes(auditPixartReplacement(finishData, expected())).includes("duplicate-fastest-quote-series-across-finishes"));
});
test("equal material price series require review without declaring genuine shared prices invalid", () => {
  const plan = { ...expected(), materials: ["Matt", "Gloss", "Grey Back"] };
  const result = auditPixartReplacement(fixture(plan), plan);
  assert.equal(result.blockers.length, 0); assert.equal(result.status, "review_required");
  assert.equal(result.reviewFlags.filter(issue => issue.code === "repeated-whole-quote-series-across-materials").length, 6);
});
test("CLI records SHA-256 of exact input bytes and preserves provenance metadata", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pixart-audit-test-"));
  try {
    const input = path.join(directory, "input.json"), bytes = JSON.stringify(fixture(), null, 2) + "\n";
    fs.writeFileSync(input, bytes);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./audit-pixart-replacement.mjs", import.meta.url)), "--input", input,
      "--materials", "Matt", "--laminations", "None,Standard Matt", "--areas", "1,2", "--quantities", "1,2,3"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.inputSha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(report.sourceMetadata.url, PIXART_FLAT_SOURCE_URL); assert.equal(report.sourceMetadata.extracted_at, fixture().meta.extracted_at);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
