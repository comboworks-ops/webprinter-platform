import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGeometrySupplementCandidate,
  canonicalJson,
  classifyTitleOnlyCandidate,
  compareTitleOnlyGeometry,
  sha256Json,
} from "../build-wmd-sales-folder-geometry-supplement.js";

const SHA = {
  source: "1".repeat(64),
  counterpart: "2".repeat(64),
  alternate: "3".repeat(64),
  rillen: "4".repeat(64),
  sourceCut: "5".repeat(64),
  counterpartCut: "6".repeat(64),
  sourceBleed: "7".repeat(64),
  counterpartBleed: "8".repeat(64),
  boxes: "9".repeat(64),
};

function fact(value) {
  return { values: [value], evidence: [String(value)] };
}

function geometry(construction = "2-part-2-flaps") {
  return { format: "a4", construction, print: "4+0", spine: 5, problems: [] };
}

function candidateRow(overrides = {}) {
  const expected = { ...geometry(), ...(overrides.expectedGeometry || {}) };
  const windowConstruction = `${expected.construction}-window`;
  const bindingKey = overrides.bindingKey || "https://www.wir-machen-druck.de/source-product.html|100";
  return {
    bindingKey,
    paperKey: "chromo-mappekarton",
    finishKey: "matt-lamination",
    expectedGeometry: expected,
    templateSourceUrl: "https://www.wir-machen-druck.de/tpl/source.pdf",
    templateSha256: SHA.source,
    templateLocalRelativePath: "documents/source-pdfs/source.pdf",
    facts: {
      url: {
        format: fact(expected.format),
        construction: fact(expected.construction),
        print: fact(expected.print),
        spine: fact(expected.spine),
      },
      pdfText: {
        facts: {
          format: fact(expected.format),
          construction: fact(windowConstruction),
          print: fact(expected.print),
          spine: fact(expected.spine),
        },
      },
      axes: {
        format: { verified: true },
        construction: { verified: false },
        print: { verified: true },
        spine: { verified: true },
      },
    },
    blockers: [
      {
        code: "PDF_TEXT_CONSTRUCTION_MISMATCH",
        message: "PDF title says window",
      },
      {
        code: "CONSTRUCTION_SOURCE_CONFLICT",
        message: "URL and PDF title differ",
        evidence: { url: expected.construction, pdfText: windowConstruction },
      },
    ],
    geometryVerified: false,
    templateReadyForSanitization: false,
    templateReadyForImport: false,
    ...overrides,
    expectedGeometry: expected,
  };
}

function counterpartRow(overrides = {}) {
  const expected = { ...geometry("2-part-2-flaps-window"), ...(overrides.expectedGeometry || {}) };
  return {
    bindingKey: overrides.bindingKey || "https://www.wir-machen-druck.de/window-product.html|200",
    paperKey: "chromo-mappekarton",
    finishKey: "matt-lamination",
    expectedGeometry: expected,
    templateSourceUrl: "https://www.wir-machen-druck.de/tpl/counterpart.pdf",
    templateSha256: SHA.counterpart,
    templateLocalRelativePath: "documents/source-pdfs/counterpart.pdf",
    facts: {},
    blockers: [],
    geometryVerified: true,
    templateReadyForSanitization: true,
    templateReadyForImport: false,
    ...overrides,
    expectedGeometry: expected,
  };
}

function layer(sha256, pathOperatorCount, strokePaintCount) {
  return { sha256, eventCount: pathOperatorCount + strokePaintCount, pathOperatorCount, strokePaintCount, fillPaintCount: 0 };
}

function inspection(sha256, { broken = null } = {}) {
  const result = {
    sha256,
    pageCount: 2,
    pageBoxesSha256: SHA.boxes,
    geometryFingerprints: {
      Rillen: layer(SHA.rillen, 6, 2),
      Schneiden: layer(sha256 === SHA.source ? SHA.sourceCut : SHA.counterpartCut, sha256 === SHA.source ? 10 : 12, sha256 === SHA.source ? 2 : 4),
      "Beschnitt Seite": layer(sha256 === SHA.source ? SHA.sourceBleed : SHA.counterpartBleed, sha256 === SHA.source ? 8 : 13, 1),
    },
  };
  if (broken === "page-boxes") result.pageBoxesSha256 = "a".repeat(64);
  if (broken === "rillen") result.geometryFingerprints.Rillen = layer("b".repeat(64), 7, 2);
  if (broken === "cut-count") result.geometryFingerprints.Schneiden.strokePaintCount = 1;
  if (broken === "bleed-count") result.geometryFingerprints["Beschnitt Seite"].pathOperatorCount = 7;
  return result;
}

function audit(rows) {
  return {
    schemaVersion: 1,
    bindingAudits: rows,
    prohibitedActionsPerformed: {
      sourcePdfModified: false,
      sourcePdfSanitized: false,
      sourcePdfUploaded: false,
    },
  };
}

function inspectorFor(rowsBySha = {}) {
  return async (row) => rowsBySha[row.templateSha256] || inspection(row.templateSha256);
}

test("title-only classifier permits only the one primary mismatch plus its exact derived conflict", () => {
  const paired = classifyTitleOnlyCandidate(candidateRow());
  assert.equal(paired.accepted, true);
  assert.deepEqual(paired.primaryBlockerCodes, ["PDF_TEXT_CONSTRUCTION_MISMATCH"]);
  assert.equal(paired.derivedConflictNormalized, true);

  const sole = candidateRow({ blockers: [{ code: "PDF_TEXT_CONSTRUCTION_MISMATCH" }] });
  const literal = classifyTitleOnlyCandidate(sole);
  assert.equal(literal.accepted, true);
  assert.equal(literal.literalSolePrimary, true);

  const printConflict = candidateRow({
    blockers: [
      ...candidateRow().blockers,
      { code: "PDF_TEXT_PRINT_MISMATCH" },
      { code: "PRINT_SOURCE_CONFLICT" },
    ],
  });
  assert.equal(classifyTitleOnlyCandidate(printConflict).accepted, false);
  assert.ok(classifyTitleOnlyCandidate(printConflict).reasons.includes("NON_TITLE_ONLY_BLOCKER_CODES"));
});

test("geometry comparison requires equal boxes and Rillen but a stronger window cut and bleed", () => {
  const accepted = compareTitleOnlyGeometry(inspection(SHA.source), inspection(SHA.counterpart));
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.comparisons.pageBoxes.equal, true);
  assert.equal(accepted.comparisons.rillen.sourceFingerprint, accepted.comparisons.rillen.counterpartFingerprint);
  assert.notEqual(accepted.comparisons.schneiden.sourceFingerprint, accepted.comparisons.schneiden.counterpartFingerprint);
  assert.ok(accepted.comparisons.schneiden.counterpartStrokePaintCount > accepted.comparisons.schneiden.sourceStrokePaintCount);
  assert.ok(accepted.comparisons.beschnitt.counterpartPathOperatorCount > accepted.comparisons.beschnitt.sourcePathOperatorCount);

  for (const broken of ["page-boxes", "rillen", "cut-count", "bleed-count"]) {
    assert.equal(
      compareTitleOnlyGeometry(inspection(SHA.source), inspection(SHA.counterpart, { broken })).accepted,
      false,
      broken
    );
  }
});

test("candidate groups exact source identity and prefers a verified same-finish window counterpart", async () => {
  const sourceOne = candidateRow();
  const sourceTwo = candidateRow({ bindingKey: "https://www.wir-machen-druck.de/source-product.html|101" });
  const otherFinish = counterpartRow({
    bindingKey: "https://www.wir-machen-druck.de/a-window-product.html|201",
    finishKey: "none",
    templateSourceUrl: "https://www.wir-machen-druck.de/tpl/alternate.pdf",
    templateSha256: SHA.alternate,
    templateLocalRelativePath: "documents/source-pdfs/alternate.pdf",
  });
  const sameFinish = counterpartRow();
  const report = await buildGeometrySupplementCandidate({
    audit: audit([otherFinish, sourceTwo, sameFinish, sourceOne]),
    baseAuditSha256: "c".repeat(64),
    inspectPdf: inspectorFor({
      [SHA.source]: inspection(SHA.source),
      [SHA.counterpart]: inspection(SHA.counterpart),
      [SHA.alternate]: { ...inspection(SHA.counterpart), sha256: SHA.alternate },
    }),
  });

  assert.equal(report.kind, "wmd_sales_folder_geometry_supplement");
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.reviewState, "pending_review");
  assert.equal("reviewer" in report, false);
  assert.equal("reviewedAt" in report, false);
  assert.equal(report.counts.acceptedEntries, 1);
  assert.equal(report.counts.coveredBindingKeys, 2);
  assert.equal(report.counts.sameFinishCounterpartEntries, 1);
  assert.equal(report.counts.fallbackFinishCounterpartEntries, 0);
  assert.deepEqual(report.entries[0].coveredBindingKeys, [sourceOne.bindingKey, sourceTwo.bindingKey]);
  assert.equal(report.entries[0].verifiedWindowCounterpart.sha256, SHA.counterpart);
  assert.deepEqual(report.entries[0].baseBlockerAssessment, {
    blockerCodes: [
      "PDF_TEXT_CONSTRUCTION_MISMATCH",
      "CONSTRUCTION_SOURCE_CONFLICT",
    ],
    constructionSourceConflictDerivedFromTitleMismatch: true,
  });
  assert.equal(report.entries[0].renderedReviewEvidence.status, "pending_review");
  assert.deepEqual(report.entries[0].renderedReviewEvidence.sourceRenderSha256s, []);
  assert.equal(report.entries[0].verdict, "title_only_construction_text_error");
  assert.equal(report.entryFingerprints[0].entrySha256, sha256Json(report.entries[0]));
  assert.equal(report.prohibitedActionsPerformed.databaseWritten, false);
});

test("print, spine, reuse and 4+0-versus-4+4 conflicts are explicitly excluded", async () => {
  const printConflict = candidateRow({
    bindingKey: "print-conflict",
    facts: {
      ...candidateRow().facts,
      pdfText: {
        facts: {
          ...candidateRow().facts.pdfText.facts,
          print: fact("4+4"),
        },
      },
      axes: { ...candidateRow().facts.axes, print: { verified: false } },
    },
    blockers: [
      ...candidateRow().blockers,
      { code: "PDF_TEXT_PRINT_MISMATCH" },
      { code: "PRINT_SOURCE_CONFLICT" },
    ],
  });
  const spineConflict = candidateRow({
    bindingKey: "spine-conflict",
    blockers: [{ code: "PDF_TEXT_SPINE_MISMATCH" }, { code: "SPINE_SOURCE_CONFLICT" }],
  });
  const reuseConflict = candidateRow({
    bindingKey: "reuse-conflict",
    blockers: [
      { code: "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES" },
      { code: "TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES" },
    ],
  });
  const report = await buildGeometrySupplementCandidate({
    audit: audit([printConflict, spineConflict, reuseConflict]),
    baseAuditSha256: "c".repeat(64),
    inspectPdf: inspectorFor(),
  });
  assert.equal(report.entries.length, 0);
  assert.equal(report.counts.excludedNonTitleOnlyBindings, 3);
  assert.equal(report.counts.excludedPrintConflictBindings, 1);
  assert.equal(report.counts.excludedSpineConflictBindings, 1);
  assert.equal(report.counts.excludedReuseConflictBindings, 1);
  assert.equal(report.counts.excludedExpected4Plus0PdfText4Plus4Bindings, 1);
  assert.equal(report.explicitlyExcludedBindings.find((row) => row.bindingKey === "print-conflict").flags.expected4Plus0ButPdfTextSays4Plus4, true);
});

test("a candidate remains excluded when no counterpart passes the exact layer comparison", async () => {
  const source = candidateRow();
  const counterpart = counterpartRow();
  const report = await buildGeometrySupplementCandidate({
    audit: audit([source, counterpart]),
    baseAuditSha256: "c".repeat(64),
    inspectPdf: inspectorFor({
      [SHA.source]: inspection(SHA.source),
      [SHA.counterpart]: inspection(SHA.counterpart, { broken: "rillen" }),
    }),
  });
  assert.equal(report.entries.length, 0);
  assert.equal(report.counts.excludedCandidateGroups, 1);
  assert.equal(report.excludedCandidateGroups[0].reason, "NO_COUNTERPART_PASSED_GEOMETRY_COMPARISON");
});

test("report and entry hashes are deterministic when base rows arrive in another order", async () => {
  const rows = [
    candidateRow(),
    candidateRow({ bindingKey: "https://www.wir-machen-druck.de/source-product.html|101" }),
    counterpartRow(),
  ];
  const options = {
    baseAuditSha256: "c".repeat(64),
    inspectPdf: inspectorFor({
      [SHA.source]: inspection(SHA.source),
      [SHA.counterpart]: inspection(SHA.counterpart),
    }),
  };
  const first = await buildGeometrySupplementCandidate({ ...options, audit: audit(rows) });
  const second = await buildGeometrySupplementCandidate({ ...options, audit: audit([...rows].reverse()) });
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(sha256Json(first), sha256Json(second));
});
