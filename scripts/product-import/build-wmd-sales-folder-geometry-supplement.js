#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const INSPECTION_HELPER = path.join(
  SCRIPT_DIRECTORY,
  "inspect_wmd_sales_folder_supplement_geometry.py"
);
const DEFAULT_PYTHON_BINARY =
  "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const SUPPLIER_ORIGIN = "https://www.wir-machen-druck.de";
const PRIMARY_BLOCKER = "PDF_TEXT_CONSTRUCTION_MISMATCH";
const DERIVED_BLOCKER = "CONSTRUCTION_SOURCE_CONFLICT";
const ALLOWED_BASE_BLOCKERS = new Set([PRIMARY_BLOCKER, DERIVED_BLOCKER]);
const SOURCE_CONSTRUCTIONS = new Set([
  "2-part-standard",
  "2-part-2-flaps",
  "2-part-3-flaps",
]);
const REQUIRED_LAYERS = Object.freeze({
  rillen: "Rillen",
  schneiden: "Schneiden",
  beschnitt: "Beschnitt Seite",
});
const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  sourcePdfUploaded: false,
  databaseWritten: false,
  productOrTemplateRecordWritten: false,
  published: false,
});

export class GeometrySupplementError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "GeometrySupplementError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new GeometrySupplementError(message, details);
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) =>
    String(left).localeCompare(String(right), "en", { numeric: true })
  );
}

function blockerCodes(row) {
  return sortedUnique((row?.blockers || []).map((blocker) => String(blocker?.code || "")));
}

function geometryFromRow(row) {
  const geometry = row?.expectedGeometry || {};
  return {
    format: String(geometry.format || ""),
    construction: String(geometry.construction || ""),
    print: String(geometry.print || ""),
    spine: Number(geometry.spine),
  };
}

function geometryKey(geometry) {
  return `${geometry.format}|${geometry.construction}|${geometry.print}|${geometry.spine}mm`;
}

function exactValues(fact, expected) {
  return Array.isArray(fact?.values)
    && fact.values.length === 1
    && String(fact.values[0]) === String(expected);
}

function derivedConstructionConflictMatches(row, expectedWindowConstruction) {
  const conflicts = (row?.blockers || []).filter((blocker) => blocker?.code === DERIVED_BLOCKER);
  return conflicts.length === 1
    && String(conflicts[0]?.evidence?.url || "") === String(row.expectedGeometry.construction)
    && String(conflicts[0]?.evidence?.pdfText || "") === expectedWindowConstruction;
}

/**
 * The strict audit emits CONSTRUCTION_SOURCE_CONFLICT as a mechanical
 * consequence of the one PDF title mismatch.  We treat it as derived, never as
 * a second independent exception.  Any other code fails this candidate gate.
 */
export function classifyTitleOnlyCandidate(row) {
  const codes = blockerCodes(row);
  const geometry = geometryFromRow(row);
  const windowConstruction = `${geometry.construction}-window`;
  const hasOnlyAllowedCodes = codes.length > 0
    && codes.includes(PRIMARY_BLOCKER)
    && codes.every((code) => ALLOWED_BASE_BLOCKERS.has(code));
  const literalSolePrimary = codes.length === 1 && codes[0] === PRIMARY_BLOCKER;
  const primaryWithDerivedConflict = codes.length === 2
    && codes.includes(DERIVED_BLOCKER)
    && derivedConstructionConflictMatches(row, windowConstruction);
  const axes = row?.facts?.axes || {};
  const pdfFacts = row?.facts?.pdfText?.facts || {};
  const urlFacts = row?.facts?.url || {};
  const expectedProblems = row?.expectedGeometry?.problems;
  const reasons = [];

  if (!hasOnlyAllowedCodes) reasons.push("NON_TITLE_ONLY_BLOCKER_CODES");
  if (!literalSolePrimary && !primaryWithDerivedConflict) {
    reasons.push("PRIMARY_BLOCKER_NOT_SOLE_AFTER_DERIVED_CONFLICT_NORMALIZATION");
  }
  if (!SOURCE_CONSTRUCTIONS.has(geometry.construction)) reasons.push("UNSUPPORTED_NON_WINDOW_CONSTRUCTION");
  if (!Array.isArray(expectedProblems) || expectedProblems.length !== 0) reasons.push("EXPECTED_GEOMETRY_HAS_PROBLEMS");
  if (!exactValues(urlFacts.construction, geometry.construction)) reasons.push("URL_CONSTRUCTION_NOT_EXACT");
  if (!exactValues(pdfFacts.construction, windowConstruction)) reasons.push("PDF_TITLE_NOT_EXACT_WINDOW_COUNTERPART");
  for (const axis of ["format", "print", "spine"]) {
    if (axes[axis]?.verified !== true) reasons.push(`${axis.toUpperCase()}_AXIS_NOT_VERIFIED`);
    if (!exactValues(urlFacts[axis], geometry[axis])) reasons.push(`URL_${axis.toUpperCase()}_NOT_EXACT`);
    if (!exactValues(pdfFacts[axis], geometry[axis])) reasons.push(`PDF_${axis.toUpperCase()}_NOT_EXACT`);
  }
  if (row?.geometryVerified !== false) reasons.push("BASE_ROW_NOT_BLOCKED");
  if (row?.templateReadyForSanitization !== false) reasons.push("BASE_ROW_ALREADY_SANITIZATION_READY");
  if (row?.templateReadyForImport !== false) reasons.push("BASE_ROW_ALREADY_IMPORT_READY");
  if (!String(row?.bindingKey || "")) reasons.push("MISSING_BINDING_KEY");
  if (!/^[a-f0-9]{64}$/.test(String(row?.templateSha256 || ""))) reasons.push("INVALID_SOURCE_TEMPLATE_SHA256");

  return {
    accepted: reasons.length === 0,
    reasons: sortedUnique(reasons),
    codes,
    primaryBlockerCodes: codes.filter((code) => code !== DERIVED_BLOCKER),
    literalSolePrimary,
    derivedConflictNormalized: primaryWithDerivedConflict,
    geometry,
    windowConstruction,
  };
}

function validateSupplierTemplateUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new GeometrySupplementError(`${label} is not a valid URL`);
  }
  assert(parsed.origin === SUPPLIER_ORIGIN, `${label} must use the exact WMD supplier origin`);
  assert(parsed.username === "" && parsed.password === "" && parsed.hash === "", `${label} contains forbidden URL components`);
  assert(parsed.search === "" && /\.pdf$/i.test(parsed.pathname), `${label} must be an exact PDF URL without query parameters`);
  return parsed.href;
}

function validateRelativePdfPath(value, label) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized !== "" && !path.posix.isAbsolute(normalized), `${label} must be relative`);
  assert(!normalized.split("/").includes(".."), `${label} cannot escape the run directory`);
  assert(normalized.startsWith("documents/source-pdfs/") && /\.pdf$/i.test(normalized), `${label} must identify a local source PDF`);
  return normalized;
}

function validateAuditShape(audit) {
  assert(audit?.schemaVersion === 1, "Geometry audit schemaVersion must be 1");
  assert(Array.isArray(audit?.bindingAudits), "Geometry audit has no bindingAudits array");
  assert(audit?.prohibitedActionsPerformed?.sourcePdfModified === false, "Base audit reports a source-PDF mutation");
  assert(audit?.prohibitedActionsPerformed?.sourcePdfSanitized === false, "Base audit reports source sanitation");
  assert(audit?.prohibitedActionsPerformed?.sourcePdfUploaded === false, "Base audit reports a source upload");
}

function exactGeometryMatch(row, expected) {
  const candidate = geometryFromRow(row);
  return candidate.format === expected.format
    && candidate.construction === expected.construction
    && candidate.print === expected.print
    && candidate.spine === expected.spine;
}

function verifiedCounterpartRows(auditRows, sourceRow) {
  const sourceGeometry = geometryFromRow(sourceRow);
  const expected = { ...sourceGeometry, construction: `${sourceGeometry.construction}-window` };
  return auditRows
    .filter((row) => exactGeometryMatch(row, expected))
    .filter((row) => (row.blockers || []).length === 0)
    .filter((row) => row.geometryVerified === true && row.templateReadyForSanitization === true)
    .filter((row) => row.templateReadyForImport === false)
    .filter((row) => String(row.templateSha256 || "") !== String(sourceRow.templateSha256 || ""))
    .sort((left, right) => {
      const leftSameFinish = left.finishKey === sourceRow.finishKey ? 0 : 1;
      const rightSameFinish = right.finishKey === sourceRow.finishKey ? 0 : 1;
      return leftSameFinish - rightSameFinish
        || Number(left.paperKey !== sourceRow.paperKey) - Number(right.paperKey !== sourceRow.paperKey)
        || String(left.finishKey).localeCompare(String(right.finishKey), "en")
        || String(left.templateSha256).localeCompare(String(right.templateSha256), "en")
        || String(left.bindingKey).localeCompare(String(right.bindingKey), "en", { numeric: true });
    });
}

function layerComparison(source, counterpart) {
  return {
    sourceFingerprint: source.sha256,
    counterpartFingerprint: counterpart.sha256,
    sourcePathOperatorCount: source.pathOperatorCount,
    counterpartPathOperatorCount: counterpart.pathOperatorCount,
    sourceStrokePaintCount: source.strokePaintCount,
    counterpartStrokePaintCount: counterpart.strokePaintCount,
  };
}

export function compareTitleOnlyGeometry(sourceInspection, counterpartInspection) {
  const missing = [];
  for (const layerName of Object.values(REQUIRED_LAYERS)) {
    if (!sourceInspection?.geometryFingerprints?.[layerName]) missing.push(`source:${layerName}`);
    if (!counterpartInspection?.geometryFingerprints?.[layerName]) missing.push(`counterpart:${layerName}`);
  }
  if (missing.length > 0) return { accepted: false, reason: "REQUIRED_LAYER_MISSING", details: missing };
  const sourceRillen = sourceInspection.geometryFingerprints.Rillen;
  const counterpartRillen = counterpartInspection.geometryFingerprints.Rillen;
  const sourceCut = sourceInspection.geometryFingerprints.Schneiden;
  const counterpartCut = counterpartInspection.geometryFingerprints.Schneiden;
  const sourceBleed = sourceInspection.geometryFingerprints["Beschnitt Seite"];
  const counterpartBleed = counterpartInspection.geometryFingerprints["Beschnitt Seite"];
  const checks = {
    pageBoxesEqual: sourceInspection.pageCount === counterpartInspection.pageCount
      && sourceInspection.pageBoxesSha256 === counterpartInspection.pageBoxesSha256,
    rillenExact: canonicalJson(sourceRillen) === canonicalJson(counterpartRillen),
    schneidenDifferent: sourceCut.sha256 !== counterpartCut.sha256,
    schneidenHasMoreCutStrokes: counterpartCut.strokePaintCount > sourceCut.strokePaintCount,
    beschnittDifferent: sourceBleed.sha256 !== counterpartBleed.sha256,
    beschnittHasMorePaths: counterpartBleed.pathOperatorCount > sourceBleed.pathOperatorCount,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) return { accepted: false, reason: "GEOMETRY_COMPARISON_FAILED", details: failed };
  return {
    accepted: true,
    comparisons: {
      pageBoxes: {
        equal: true,
        sourceSha256: sourceInspection.pageBoxesSha256,
        counterpartSha256: counterpartInspection.pageBoxesSha256,
      },
      rillen: layerComparison(sourceRillen, counterpartRillen),
      schneiden: layerComparison(sourceCut, counterpartCut),
      beschnitt: layerComparison(sourceBleed, counterpartBleed),
    },
  };
}

function identityKey(row) {
  const geometry = geometryFromRow(row);
  return [
    row.templateSha256,
    row.templateSourceUrl,
    row.templateLocalRelativePath,
    geometryKey(geometry),
    row.finishKey,
  ].join("|");
}

function summarizeExcludedBindings(rows) {
  return rows.map((row) => {
    const codes = blockerCodes(row);
    const pdfPrintValues = row?.facts?.pdfText?.facts?.print?.values || [];
    const expectedPrint = String(row?.expectedGeometry?.print || "");
    const flags = {
      printConflict: codes.some((code) => code.includes("PRINT")),
      spineConflict: codes.some((code) => code.includes("SPINE")),
      reuseConflict: codes.some((code) => code.includes("REUSED_ACROSS_GEOMETRIES")),
      expected4Plus0ButPdfTextSays4Plus4: expectedPrint === "4+0" && pdfPrintValues.includes("4+4"),
    };
    return {
      bindingKey: String(row.bindingKey || ""),
      blockerCodes: codes,
      flags,
    };
  }).sort((left, right) => left.bindingKey.localeCompare(right.bindingKey, "en", { numeric: true }));
}

export async function buildGeometrySupplementCandidate({
  audit,
  baseAuditSha256,
  inspectPdf,
}) {
  validateAuditShape(audit);
  assert(/^[a-f0-9]{64}$/.test(String(baseAuditSha256 || "")), "Base-audit SHA-256 is invalid");
  assert(typeof inspectPdf === "function", "A read-only PDF inspector is required");

  const auditRows = [...audit.bindingAudits].sort((left, right) =>
    String(left.bindingKey).localeCompare(String(right.bindingKey), "en", { numeric: true })
  );
  const blockedRows = auditRows.filter((row) => (row.blockers || []).length > 0);
  const classifications = blockedRows.map((row) => ({ row, classification: classifyTitleOnlyCandidate(row) }));
  const candidateRows = classifications.filter((item) => item.classification.accepted).map((item) => item.row);
  const nonCandidateRows = classifications.filter((item) => !item.classification.accepted).map((item) => item.row);
  const literalSoleMismatchBindings = classifications.filter((item) =>
    item.classification.accepted && item.classification.literalSolePrimary
  ).length;
  const derivedConflictNormalizedBindings = classifications.filter((item) =>
    item.classification.accepted && item.classification.derivedConflictNormalized
  ).length;
  const groups = new Map();
  for (const row of candidateRows) {
    const key = identityKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const entries = [];
  const selectionEvidence = [];
  const excludedCandidateGroups = [];
  for (const [groupKey, groupRows] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))) {
    const sourceRow = groupRows[0];
    const sourceGeometry = geometryFromRow(sourceRow);
    const coveredBindingKeys = sortedUnique(groupRows.map((row) => String(row.bindingKey)));
    let sourceInspection;
    try {
      sourceInspection = await inspectPdf(sourceRow);
    } catch (error) {
      excludedCandidateGroups.push({
        groupKey,
        sourceTemplateSha256: sourceRow.templateSha256,
        coveredBindingKeys,
        reason: "SOURCE_INSPECTION_FAILED",
        details: String(error?.message || error),
      });
      continue;
    }
    if (sourceInspection.sha256 !== sourceRow.templateSha256) {
      excludedCandidateGroups.push({
        groupKey,
        sourceTemplateSha256: sourceRow.templateSha256,
        coveredBindingKeys,
        reason: "SOURCE_INSPECTION_HASH_MISMATCH",
      });
      continue;
    }

    const counterpartRows = verifiedCounterpartRows(auditRows, sourceRow);
    let selected = null;
    const rejectedCounterparts = [];
    for (const counterpartRow of counterpartRows) {
      let counterpartInspection;
      try {
        counterpartInspection = await inspectPdf(counterpartRow);
      } catch (error) {
        rejectedCounterparts.push({
          bindingKey: counterpartRow.bindingKey,
          reason: "COUNTERPART_INSPECTION_FAILED",
          details: String(error?.message || error),
        });
        continue;
      }
      if (counterpartInspection.sha256 !== counterpartRow.templateSha256) {
        rejectedCounterparts.push({
          bindingKey: counterpartRow.bindingKey,
          reason: "COUNTERPART_INSPECTION_HASH_MISMATCH",
        });
        continue;
      }
      const comparison = compareTitleOnlyGeometry(sourceInspection, counterpartInspection);
      if (!comparison.accepted) {
        rejectedCounterparts.push({
          bindingKey: counterpartRow.bindingKey,
          reason: comparison.reason,
          details: comparison.details,
        });
        continue;
      }
      selected = { counterpartRow, comparison };
      break;
    }
    if (!selected) {
      excludedCandidateGroups.push({
        groupKey,
        sourceTemplateSha256: sourceRow.templateSha256,
        coveredBindingKeys,
        reason: counterpartRows.length === 0 ? "NO_VERIFIED_WINDOW_COUNTERPART" : "NO_COUNTERPART_PASSED_GEOMETRY_COMPARISON",
        rejectedCounterparts,
      });
      continue;
    }

    const { counterpartRow, comparison } = selected;
    const counterpartGeometry = geometryFromRow(counterpartRow);
    const sourceClassification = classifyTitleOnlyCandidate(sourceRow);
    const entry = {
      sourceTemplateSha256: sourceRow.templateSha256,
      expectedGeometry: sourceGeometry,
      finishKey: sourceRow.finishKey,
      coveredBindingKeys,
      sourceTemplate: {
        sourceUrl: validateSupplierTemplateUrl(sourceRow.templateSourceUrl, "Source template URL"),
        localRelativePath: validateRelativePdfPath(sourceRow.templateLocalRelativePath, "Source template path"),
        sha256: sourceRow.templateSha256,
      },
      verifiedWindowCounterpart: {
        sourceUrl: validateSupplierTemplateUrl(counterpartRow.templateSourceUrl, "Counterpart template URL"),
        localRelativePath: validateRelativePdfPath(counterpartRow.templateLocalRelativePath, "Counterpart template path"),
        sha256: counterpartRow.templateSha256,
        geometry: counterpartGeometry,
      },
      baseBlockerAssessment: {
        blockerCodes: [PRIMARY_BLOCKER, DERIVED_BLOCKER]
          .filter((code) => sourceClassification.codes.includes(code)),
        constructionSourceConflictDerivedFromTitleMismatch:
          sourceClassification.derivedConflictNormalized,
      },
      comparisons: comparison.comparisons,
      renderedReviewEvidence: {
        status: "pending_review",
        sourceRenderSha256s: [],
        counterpartRenderSha256s: [],
        sourceHasWindowCut: null,
        counterpartHasWindowCut: null,
        reviewerNote: "",
      },
      verdict: "title_only_construction_text_error",
    };
    const entrySha256 = sha256Json(entry);
    entries.push(entry);
    selectionEvidence.push({
      entrySha256,
      sourceBindingKey: sourceRow.bindingKey,
      counterpartBindingKey: counterpartRow.bindingKey,
      counterpartFinishKey: counterpartRow.finishKey,
      sameFinish: counterpartRow.finishKey === sourceRow.finishKey,
    });
  }

  const ordered = entries
    .map((entry) => ({ entry, entrySha256: sha256Json(entry) }))
    .sort((left, right) => left.entrySha256.localeCompare(right.entrySha256, "en"));
  const orderedEntries = ordered.map((item) => item.entry);
  const evidenceByHash = new Map(selectionEvidence.map((item) => [item.entrySha256, item]));
  const orderedSelectionEvidence = ordered.map((item) => evidenceByHash.get(item.entrySha256));
  const excludedBindings = summarizeExcludedBindings(nonCandidateRows);
  const countFlag = (flag) => excludedBindings.filter((item) => item.flags[flag]).length;

  return {
    kind: "wmd_sales_folder_geometry_supplement",
    schemaVersion: 1,
    baseAuditSha256,
    reviewState: "pending_review",
    selectionPolicy: {
      primaryBlockerCode: PRIMARY_BLOCKER,
      mechanicallyDerivedCodeAllowedOnlyWithExactEvidence: DERIVED_BLOCKER,
      allOtherBlockerCodesExcluded: true,
      exactGeometryAxesRequired: ["format", "construction", "print", "spine"],
      counterpartConstructionRule: "same non-window construction plus -window",
      sameFinishPreferred: true,
      pageBoxesMustMatch: true,
      rillenFingerprintMustMatch: true,
      schneidenFingerprintMustDifferWithMoreCounterpartStrokes: true,
      beschnittFingerprintMustDifferWithMoreCounterpartPaths: true,
      renderedReviewRequiredBeforeApproval: true,
    },
    counts: {
      baseAuditedBindings: auditRows.length,
      baseBlockedBindings: blockedRows.length,
      primaryTitleOnlyCandidateBindings: candidateRows.length,
      literalSoleMismatchBindings,
      derivedConflictNormalizedBindings,
      candidateGroups: groups.size,
      acceptedEntries: orderedEntries.length,
      coveredBindingKeys: orderedEntries.reduce((sum, entry) => sum + entry.coveredBindingKeys.length, 0),
      sameFinishCounterpartEntries: orderedSelectionEvidence.filter((item) => item.sameFinish).length,
      fallbackFinishCounterpartEntries: orderedSelectionEvidence.filter((item) => !item.sameFinish).length,
      excludedCandidateGroups: excludedCandidateGroups.length,
      excludedNonTitleOnlyBindings: excludedBindings.length,
      excludedPrintConflictBindings: countFlag("printConflict"),
      excludedSpineConflictBindings: countFlag("spineConflict"),
      excludedReuseConflictBindings: countFlag("reuseConflict"),
      excludedExpected4Plus0PdfText4Plus4Bindings: countFlag("expected4Plus0ButPdfTextSays4Plus4"),
      pendingRenderedReviewEntries: orderedEntries.length,
    },
    inputEvidence: {
      baseAuditPath: "review/template-geometry-audit.json",
      localPdfRoot: "documents/source-pdfs",
      inspectionImplementation: "scripts/product-templates/sanitize_wmd_sales_folder_template.py#describe_source",
      localOnly: true,
    },
    entryFingerprints: ordered.map((item) => ({
      entrySha256: item.entrySha256,
      sourceTemplateSha256: item.entry.sourceTemplateSha256,
      expectedGeometry: item.entry.expectedGeometry,
      finishKey: item.entry.finishKey,
      coveredBindingCount: item.entry.coveredBindingKeys.length,
    })),
    counterpartSelectionEvidence: orderedSelectionEvidence,
    explicitlyExcludedBindings: excludedBindings,
    excludedCandidateGroups: excludedCandidateGroups.sort((left, right) =>
      left.groupKey.localeCompare(right.groupKey, "en", { numeric: true })
    ),
    entries: orderedEntries,
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
}

async function runProcess(command, args, { input, timeoutMs = 600_000, maxOutputBytes = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new GeometrySupplementError(`Timed out running ${path.basename(command)}`)));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) {
        child.kill("SIGKILL");
        finish(() => reject(new GeometrySupplementError("Geometry inspector stdout exceeded the safety limit")));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxOutputBytes) stderr.push(chunk);
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => {
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        reject(new GeometrySupplementError(`Geometry inspector exited ${code}: ${errorOutput || "no stderr"}`));
        return;
      }
      resolve(output);
    }));
    child.stdin.end(input || "");
  });
}

async function regularLocalPdf(runDirectory, row) {
  const relativePath = validateRelativePdfPath(row.templateLocalRelativePath, "Template local path");
  const absolutePath = path.resolve(runDirectory, relativePath);
  const resolvedRun = path.resolve(runDirectory);
  assert(absolutePath.startsWith(`${resolvedRun}${path.sep}`), "Template PDF escapes the run directory");
  const stat = await fs.lstat(absolutePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `Template PDF is not a regular non-symlink file: ${relativePath}`);
  const realPath = await fs.realpath(absolutePath);
  assert(realPath.startsWith(`${resolvedRun}${path.sep}`), `Template PDF resolves outside the run directory: ${relativePath}`);
  const bytes = await fs.readFile(absolutePath);
  assert(bytes.subarray(0, 5).toString("ascii") === "%PDF-", `Template file is not a PDF: ${relativePath}`);
  assert(sha256Bytes(bytes) === row.templateSha256, `Template PDF hash differs from the base audit: ${relativePath}`);
  return { absolutePath, relativePath };
}

async function createBatchInspector({ auditRows, runDirectory, pythonBinary }) {
  const uniqueRows = new Map();
  for (const row of auditRows) {
    if (!row?.templateSha256 || !row?.templateLocalRelativePath) continue;
    const key = `${row.templateSha256}|${row.templateLocalRelativePath}`;
    if (!uniqueRows.has(key)) uniqueRows.set(key, row);
  }
  const request = [];
  for (const [requestKey, row] of [...uniqueRows.entries()].sort(([left], [right]) => left.localeCompare(right, "en"))) {
    const local = await regularLocalPdf(runDirectory, row);
    request.push({
      requestKey,
      sourcePath: local.absolutePath,
      geometry: geometryFromRow(row),
      finishKey: row.finishKey,
    });
  }
  const stdout = await runProcess(pythonBinary, [INSPECTION_HELPER], {
    input: JSON.stringify(request),
  });
  let rows;
  try {
    rows = JSON.parse(stdout);
  } catch (error) {
    throw new GeometrySupplementError(`Geometry inspector returned invalid JSON: ${error.message}`);
  }
  assert(Array.isArray(rows) && rows.length === request.length, "Geometry inspector returned incomplete results");
  const byKey = new Map(rows.map((row) => [row.requestKey, row]));
  return async (row) => {
    const key = `${row.templateSha256}|${row.templateLocalRelativePath}`;
    const result = byKey.get(key);
    assert(result, `No geometry inspection exists for ${key}`);
    return result;
  };
}

function parseArgs(argv) {
  const args = {
    runDirectory: null,
    auditRelativePath: "review/template-geometry-audit.json",
    outputRelativePath: "review/template-geometry-supplement.json",
    pythonBinary: DEFAULT_PYTHON_BINARY,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--run") args.runDirectory = argv[++index];
    else if (item === "--audit") args.auditRelativePath = argv[++index];
    else if (item === "--output") args.outputRelativePath = argv[++index];
    else if (item === "--python") args.pythonBinary = argv[++index];
    else if (item === "--help") args.help = true;
    else throw new GeometrySupplementError(`Unknown argument: ${item}`);
  }
  return args;
}

function safeRunPath(runDirectory, relativePath, label) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  assert(normalized && !path.posix.isAbsolute(normalized), `${label} must be relative to the run directory`);
  assert(!normalized.split("/").includes(".."), `${label} cannot escape the run directory`);
  return path.resolve(runDirectory, normalized);
}

async function atomicWrite(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

export async function runGeometrySupplementBuild({
  runDirectory,
  auditRelativePath = "review/template-geometry-audit.json",
  outputRelativePath = "review/template-geometry-supplement.json",
  pythonBinary = DEFAULT_PYTHON_BINARY,
}) {
  assert(runDirectory, "--run is required");
  const resolvedRun = path.resolve(runDirectory);
  const auditPath = safeRunPath(resolvedRun, auditRelativePath, "Audit path");
  const outputPath = safeRunPath(resolvedRun, outputRelativePath, "Output path");
  const sidecarPath = `${outputPath}.sha256`;
  const lockPath = path.join(resolvedRun, "review/.geometry-supplement-builder.lock");
  assert(auditPath !== outputPath && auditPath !== sidecarPath, "Audit and output paths must be distinct");
  let lockHandle;
  try {
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    lockHandle = await fs.open(lockPath, "wx", 0o600);
    await lockHandle.writeFile(`${process.pid}\n`, "utf8");
    const auditStat = await fs.lstat(auditPath);
    assert(auditStat.isFile() && !auditStat.isSymbolicLink(), "Base geometry audit must be a regular non-symlink file");
    const auditBytes = await fs.readFile(auditPath);
    const baseAuditSha256 = sha256Bytes(auditBytes);
    let audit;
    try {
      audit = JSON.parse(auditBytes.toString("utf8"));
    } catch (error) {
      throw new GeometrySupplementError(`Cannot parse base geometry audit: ${error.message}`);
    }
    validateAuditShape(audit);
    const rowsNeededForInspection = audit.bindingAudits.filter((row) => {
      const classification = classifyTitleOnlyCandidate(row);
      if (classification.accepted) return true;
      return row.geometryVerified === true
        && String(row?.expectedGeometry?.construction || "").endsWith("-window")
        && (row.blockers || []).length === 0;
    });
    const inspectPdf = await createBatchInspector({
      auditRows: rowsNeededForInspection,
      runDirectory: resolvedRun,
      pythonBinary,
    });
    const supplement = await buildGeometrySupplementCandidate({ audit, baseAuditSha256, inspectPdf });
    const auditBytesAfterInspection = await fs.readFile(auditPath);
    assert(
      sha256Bytes(auditBytesAfterInspection) === baseAuditSha256,
      "Base geometry audit changed during supplement generation"
    );
    const outputBytes = Buffer.from(`${JSON.stringify(supplement, null, 2)}\n`, "utf8");
    const outputSha256 = sha256Bytes(outputBytes);
    const sidecarBytes = Buffer.from(`${outputSha256}  ${path.basename(outputPath)}\n`, "utf8");
    await atomicWrite(outputPath, outputBytes);
    await atomicWrite(sidecarPath, sidecarBytes);
    return {
      outputPath,
      sidecarPath,
      outputSha256,
      byteSize: outputBytes.length,
      counts: supplement.counts,
    };
  } finally {
    await lockHandle?.close();
    await fs.unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/product-import/build-wmd-sales-folder-geometry-supplement.js --run <run-directory> [--audit review/template-geometry-audit.json] [--output review/template-geometry-supplement.json]");
    return;
  }
  const result = await runGeometrySupplementBuild(args);
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`REFUSED: ${error.message}`);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 2;
  });
}
