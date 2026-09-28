#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants as fsConstants, createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);
const DEFAULT_OUTPUT_RELATIVE_PATH = "review/template-sanitization-plan.json";

const INPUT_PATHS = Object.freeze({
  templateProjectionStubs: "review/template-projection-stubs.jsonl",
  geometryAudit: "review/template-geometry-audit.json",
  geometrySupplement: "review/template-geometry-supplement.json",
  templateResolutionPlan: "review/template-resolution-plan.json",
  documentInventory: "documents/document-files.jsonl",
});

export const EXPECTED_SANITIZATION_COUNTS = Object.freeze({
  bindings: 3692,
  outputJobs: 1420,
  resolvedSourceUrls: 1099,
  distinctSourcePayloads: 285,
});

const SEMANTIC_AXES = Object.freeze(["folder_model", "print", "spine", "paper", "finish"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HTTPS_WMD_TEMPLATE_PATTERN = /^https:\/\/www\.wir-machen-druck\.de\/tpl\//;
const ALLOWED_CLASSIFICATIONS = new Set([
  "base_verified",
  "pending_title_only",
  "exact_verified_rebind",
  "collateral_original_after_bad_alias_quarantine",
  "indirect_pending_title_rebind",
  "extended_exact_evidence",
]);
const EXECUTION_CLASSIFICATION_PRIORITY = Object.freeze({
  base_verified: 0,
  pending_title_only: 1,
  collateral_original_after_bad_alias_quarantine: 2,
  extended_exact_evidence: 3,
  indirect_pending_title_rebind: 4,
  exact_verified_rebind: 5,
});
const SPOT_FINISHES = new Set([
  "partial-uv",
  "soft-touch-partial-uv",
  "hot-foil-gold",
  "hot-foil-silver",
  "blind-emboss",
]);
const FINISH_LABELS_DA = Object.freeze({
  none: "Ingen efterbehandling",
  "high-gloss-uv": "Højglans UV-lak",
  "partial-uv": "Partiel UV-lak",
  "matt-lamination": "Mat laminering",
  "gloss-lamination": "Blank laminering",
  "soft-touch-lamination": "Soft-touch laminering",
  "soft-touch-partial-uv": "Soft-touch laminering og partiel UV-lak",
  "hot-foil-gold": "Guldfolie",
  "hot-foil-silver": "Sølvfolie",
  "blind-emboss": "Blindprægning",
});
const CONSTRUCTION_LABELS_DA = Object.freeze({
  "2-part-standard": "2-delt standardmappe",
  "2-part-standard-window": "2-delt standardmappe med vindue",
  "2-part-2-flaps": "2-delt mappe med 2 flapper",
  "2-part-2-flaps-window": "2-delt mappe med 2 flapper og vindue",
  "2-part-3-flaps": "2-delt mappe med 3 flapper",
  "2-part-3-flaps-window": "2-delt mappe med 3 flapper og vindue",
  "2-part-closure": "2-delt mappe med lukning",
  "3-part-1-flap": "3-delt mappe med 1 flap",
});
const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  supplierNetworkRequested: false,
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  sourcePdfCreated: false,
  sourcePdfUploaded: false,
  contractApproved: false,
  sanitizedPdfCreated: false,
  inspectionCreated: false,
  databaseWritten: false,
  supplierBankWritten: false,
  productOrTemplateRecordWritten: false,
  pricingWritten: false,
  proposalMutated: false,
  published: false,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function exactObjectKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  assert(
    canonicalJson(actual) === canonicalJson([...expected].sort()),
    `${label} keys drifted: expected ${[...expected].sort().join(", ")}; got ${actual.join(", ")}`
  );
}

function validSha256(value, label) {
  assert(SHA256_PATTERN.test(String(value || "")), `${label} is not a lowercase SHA-256`);
  return String(value);
}

function safeRelativePath(value, label, suffix = null) {
  assert(typeof value === "string" && value.length > 0, `${label} is missing`);
  assert(!path.isAbsolute(value), `${label} must be run-relative`);
  assert(value === value.replaceAll("\\", "/"), `${label} must use forward slashes`);
  const normalized = path.posix.normalize(value);
  assert(normalized === value && !normalized.startsWith("../") && normalized !== "..", `${label} escapes the run directory`);
  if (suffix) assert(value.toLowerCase().endsWith(suffix), `${label} must end in ${suffix}`);
  return value;
}

function safeRunPath(runDirectory, relativePath, label) {
  const safe = safeRelativePath(relativePath, label);
  const resolved = path.resolve(runDirectory, safe);
  assert(
    resolved.startsWith(`${path.resolve(runDirectory)}${path.sep}`),
    `${label} resolves outside the run directory`
  );
  return resolved;
}

function assertAllFalse(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} is missing`);
  const performed = Object.entries(value).filter(([, state]) => state !== false);
  assert(performed.length === 0, `${label} contains performed actions: ${performed.map(([key]) => key).join(", ")}`);
}

function assertExpectedCount(label, actual, expected) {
  assert(actual === expected, `${label} count drifted: expected ${expected}, got ${actual}`);
}

function mapUnique(rows, keyFor, label) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    assert(typeof key === "string" && key.length > 0, `${label} contains an empty key`);
    assert(!result.has(key), `${label} contains duplicate key: ${key}`);
    result.set(key, row);
  }
  return result;
}

function cdLeakageText(value) {
  return /cd-135x135|mappe[_-]cd(?:_|-)|cd[-_ ]tasche/i.test(String(value || ""));
}

export function assertNoCdModelLeakage(value, label = "Proposed sanitization scope") {
  const serialized = JSON.stringify(value);
  assert(!cdLeakageText(serialized), `${label} contains excluded CD model/template leakage`);
}

function stubBindingKey(stub) {
  const sourceUrl = String(stub?.sourceBinding?.sourceUrl || "");
  const materialId = String(stub?.sourceBinding?.materialId || "");
  assert(sourceUrl && materialId, `Template stub ${stub?.key || "(unknown)"} has no exact source URL/material identity`);
  return `${sourceUrl}|${materialId}`;
}

function selectionKey(selections) {
  exactObjectKeys(selections, SEMANTIC_AXES, "Template-stub match");
  return SEMANTIC_AXES.map((axis) => `${axis}=${encodeURIComponent(String(selections[axis]))}`).join("|");
}

function parseExpectedGeometryKey(value) {
  const parts = String(value || "").split("|");
  assert(parts.length === 4, `Invalid expected geometry key: ${value}`);
  const [format, construction, printMode, spineToken] = parts;
  const match = /^(\d+)mm$/.exec(spineToken);
  assert(match, `Invalid spine in expected geometry key: ${value}`);
  const geometry = {
    format,
    construction,
    print: printMode,
    spineMm: Number(match[1]),
  };
  assert(geometry.format && geometry.construction && ["4+0", "4+4"].includes(geometry.print), `Invalid expected geometry: ${value}`);
  assert([1, 3, 5, 10].includes(geometry.spineMm), `Unsupported expected spine: ${value}`);
  return geometry;
}

function auditGeometryKey(row) {
  const geometry = row?.expectedGeometry;
  assert(geometry && Array.isArray(geometry.problems), `Geometry-audit row ${row?.bindingKey || "(unknown)"} is malformed`);
  assert(geometry.problems.length === 0, `Geometry-audit row ${row.bindingKey} has unresolved expected-geometry problems`);
  return `${geometry.format}|${geometry.construction}|${geometry.print}|${geometry.spine}mm`;
}

function sourceIdentityFromAudit(row) {
  return {
    bindingKey: row.bindingKey,
    sourceUrl: row.templateSourceUrl,
    localRelativePath: row.templateLocalRelativePath,
    sha256: row.templateSha256,
  };
}

function assertTemplateIdentity(actual, expected, label) {
  exactObjectKeys(actual, ["bindingKey", "sourceUrl", "localRelativePath", "sha256"], label);
  assert(canonicalJson(actual) === canonicalJson(expected), `${label} differs from hash-pinned geometry-audit identity`);
  assert(HTTPS_WMD_TEMPLATE_PATTERN.test(actual.sourceUrl), `${label} is not an exact WIRmachenDRUCK template URL`);
  safeRelativePath(actual.localRelativePath, `${label} local path`, ".pdf");
  validSha256(actual.sha256, `${label} SHA-256`);
}

function inventoryIdentity(row) {
  return {
    sourceUrl: row.sourceUrl,
    localRelativePath: row.localRelativePath,
    sha256: row.sha256,
  };
}

function inventoryIdentityKey(value) {
  return canonicalJson({
    sourceUrl: value.sourceUrl,
    localRelativePath: value.localRelativePath,
    sha256: value.sha256,
  });
}

function compactInventoryRow(row) {
  const inspection = row?.inspection || {};
  const optionalContent = inspection?.optionalContentInspection?.optionalContent || {};
  const compact = {
    sourceUrl: String(row?.sourceUrl || ""),
    role: String(row?.role || ""),
    documentRole: String(row?.documentRole || inspection?.documentRole || ""),
    localRelativePath: String(row?.localRelativePath || ""),
    sha256: String(row?.sha256 || ""),
    byteSize: Number(row?.byteSize),
    selectionBindingKeys: (row?.selectionBindings || [])
      .map((binding) => String(binding?.bindingKey || ""))
      .sort((left, right) => left.localeCompare(right, "en", { numeric: true })),
    inspection: {
      structurallyReadable: inspection.structurallyReadable === true,
      pageCount: Number(inspection.pageCount),
      pageBoxesSha256: sha256Json((inspection.pages || []).map((page) => page.boxes || null)),
      layerNames: [...(optionalContent.layerNames || [])].map(String).sort(),
      spotColorantNames: [
        ...(inspection?.optionalContentInspection?.spotColors?.colorantNames || []),
      ].map(String).sort(),
    },
    inventoryRowSha256: sha256Json(row),
  };
  assert(compact.sourceUrl, "Document inventory contains a row without sourceUrl");
  safeRelativePath(compact.localRelativePath, `Inventory path for ${compact.sourceUrl}`, ".pdf");
  validSha256(compact.sha256, `Inventory SHA-256 for ${compact.sourceUrl}`);
  assert(Number.isSafeInteger(compact.byteSize) && compact.byteSize > 0, `Inventory byte size is invalid for ${compact.sourceUrl}`);
  assert(compact.selectionBindingKeys.length > 0, `Inventory row has no exact selection bindings: ${compact.sourceUrl}`);
  assert(new Set(compact.selectionBindingKeys).size === compact.selectionBindingKeys.length, `Inventory row duplicates a binding key: ${compact.sourceUrl}`);
  return compact;
}

function slugPart(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("+", "plus")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ukendt";
}

function outputJobId(geometry, finishKey, sourceSha256) {
  return [
    "salgsmappe",
    slugPart(geometry.format),
    slugPart(geometry.construction),
    slugPart(geometry.print),
    `${geometry.spineMm}mm`,
    slugPart(finishKey),
    sourceSha256.slice(0, 16),
  ].join("-");
}

function displayNameDa(geometry, finishKey) {
  const format = geometry.format === "din-lang"
    ? "DIN Lang"
    : geometry.format === "square-21x21"
      ? "21 x 21 cm"
      : geometry.format.toUpperCase();
  return `${format}, ${CONSTRUCTION_LABELS_DA[geometry.construction] || geometry.construction}, ${geometry.print}, ${geometry.spineMm} mm, ${FINISH_LABELS_DA[finishKey] || finishKey}`;
}

function safeOutputSignature(geometryKey, finishKey, sourceSha256) {
  return {
    expectedGeometryKey: geometryKey,
    finishKey,
    resolvedSourceSha256: sourceSha256,
  };
}

function sourceReviewState(classification) {
  if (classification.classification === "base_verified") return "base_audit_verified";
  return classification.entryReviewState === "approved" ? "approved" : "pending_review";
}

export function validateResolutionReviewState(plan) {
  assert(["pending_review", "approved"].includes(plan.reviewState), "Template-resolution plan has an invalid review state");
  assert(plan.approval && typeof plan.approval === "object", "Template-resolution plan approval record is missing");
  const expectedApprovalContract = {
    currentArtifactMayAuthorizeSanitization: plan.reviewState === "approved",
    requiredArtifactReviewState: "approved",
    requiredEntryReviewState: "approved",
    requireNonEmptyReviewer: true,
    requireIsoReviewedAt: true,
    approvedEntryHashesMustExactlyMatchFingerprints: true,
    inputHashesMustRemainEqual: true,
    pendingSupplementRequiresPlanRegenerationAfterApproval: true,
  };
  exactObjectKeys(
    plan.approvalContract,
    Object.keys(expectedApprovalContract),
    "Template-resolution approvalContract"
  );
  assert(
    canonicalJson(plan.approvalContract) === canonicalJson(expectedApprovalContract),
    "Template-resolution approvalContract does not exactly authorize its current review state"
  );
  if (plan.reviewState === "pending_review") {
    assert(plan.approval.approved === false, "Pending template-resolution plan cannot be approved");
    assert(plan.approval.reviewer === null && plan.approval.reviewedAt === null, "Pending template-resolution plan carries reviewer approval");
    assert(Array.isArray(plan.approvedEntryHashes) && plan.approvedEntryHashes.length === 0, "Pending template-resolution plan contains approved entry hashes");
    return;
  }
  assert(plan.approval.approved === true, "Approved template-resolution plan lacks approval=true");
  assert(String(plan.approval.reviewer || "").trim(), "Approved template-resolution plan lacks reviewer");
  assert(
    typeof plan.approval.reviewedAt === "string"
      && /(?:Z|[+-]\d{2}:\d{2})$/.test(plan.approval.reviewedAt)
      && !Number.isNaN(Date.parse(plan.approval.reviewedAt)),
    "Approved template-resolution plan has invalid or timezone-free reviewedAt"
  );
  const expected = plan.bindingClassificationFingerprints.map((entry) => entry.entrySha256).sort();
  const actual = [...(plan.approvedEntryHashes || [])].sort();
  assert(canonicalJson(actual) === canonicalJson(expected), "Approved entry hashes do not exactly match classification fingerprints");
  assert(
    (plan.bindingClassifications || []).every((entry) => entry.entryReviewState === "approved"),
    "Approved template-resolution plan still contains a non-approved classification entry"
  );
}

function validateInputHashPins({ inputEvidence, audit, supplement, resolutionPlan }) {
  assert(
    resolutionPlan?.inputEvidence?.baseAudit?.sha256 === inputEvidence.geometryAudit.sha256,
    "Template-resolution plan is stale relative to the geometry audit"
  );
  assert(
    resolutionPlan?.inputEvidence?.geometrySupplement?.sha256 === inputEvidence.geometrySupplement.sha256,
    "Template-resolution plan is stale relative to the geometry supplement"
  );
  assert(
    resolutionPlan?.inputEvidence?.templateProjectionStubs?.sha256 === inputEvidence.templateProjectionStubs.sha256,
    "Template-resolution plan is stale relative to the CD-excluded template stubs"
  );
  assert(
    audit?.inputEvidence?.documentInventory?.sha256 === inputEvidence.documentInventory.sha256,
    "Geometry audit is stale relative to the document inventory"
  );
  assert(
    supplement?.baseAuditSha256 === inputEvidence.geometryAudit.sha256,
    "Geometry supplement is stale relative to the geometry audit"
  );
  const excludedModels = resolutionPlan?.catalogScope?.excludedModels;
  assert(
    Array.isArray(excludedModels)
      && excludedModels.length === 1
      && excludedModels[0].modelKey === "cd-135x135--2-part-closure",
    "Template-resolution plan must exclude exactly the CD model and no other model"
  );
  assert(
    resolutionPlan?.catalogScope?.counts?.raw?.exactSparseCombinations === 3744
      && resolutionPlan?.catalogScope?.counts?.proposed?.exactSparseCombinations === 3692
      && resolutionPlan?.catalogScope?.counts?.excluded?.exactSparseCombinations === 52,
    "Template-resolution catalog scope must prove the exact 3,744 -> 3,692 -> 52 binding projection"
  );
  assert(
    resolutionPlan?.sourceScopeProjection?.proposedBindingCount === EXPECTED_SANITIZATION_COUNTS.bindings,
    "Template-resolution source projection count drifted"
  );
  assert(resolutionPlan?.sourceScopeProjection?.excludedBindingCount === 52, "CD exclusion count drifted from 52 bindings");
  assert(resolutionPlan?.sourceScopeProjection?.rawSupplierEvidenceMutated === false, "Raw supplier evidence was mutated during CD exclusion");
}

function evidenceForRepresentative({ representative, auditByBinding, classificationFingerprintByBinding, supplement, inputEvidence }) {
  const originalAudit = auditByBinding.get(representative.bindingKey);
  const resolutionEntrySha256 = classificationFingerprintByBinding.get(representative.bindingKey).entrySha256;
  const dependency = representative.evidence?.dependencies || {};
  const needsSupplement = representative.classification === "pending_title_only";
  const needsResolutionPlan = !["base_verified", "pending_title_only"].includes(representative.classification);
  let geometrySupplement = null;
  if (needsSupplement) {
    const hashes = dependency.titleSupplementEntrySha256s || [];
    assert(hashes.length === 1, `Pending-title binding must select exactly one geometry-supplement entry: ${representative.bindingKey}`);
    const entrySha256 = hashes[0];
    const fingerprint = (supplement.entryFingerprints || []).find((entry) => entry.entrySha256 === entrySha256);
    assert(fingerprint, `Geometry-supplement entry hash is missing for ${representative.bindingKey}`);
    const entry = (supplement.entries || []).find((candidate) => sha256Json(candidate) === entrySha256);
    assert(entry && entry.coveredBindingKeys.includes(representative.bindingKey), `Geometry-supplement entry does not cover ${representative.bindingKey}`);
    geometrySupplement = {
      requiredForSanitizerExecution: true,
      reportPath: inputEvidence.geometrySupplement.path,
      reportSha256: inputEvidence.geometrySupplement.sha256,
      entrySha256,
      reviewState: supplement.reviewState,
    };
  }
  return {
    executionBindingKey: representative.bindingKey,
    executionClassification: representative.classification,
    sourceReviewState: sourceReviewState(representative),
    geometryAudit: {
      reportPath: inputEvidence.geometryAudit.path,
      reportSha256: inputEvidence.geometryAudit.sha256,
      bindingKey: representative.bindingKey,
      bindingSha256: sha256Json(originalAudit),
    },
    geometrySupplement,
    templateResolutionPlan: needsResolutionPlan
      ? {
          requiredForSanitizerExecution: true,
          reportPath: inputEvidence.templateResolutionPlan.path,
          reportSha256: inputEvidence.templateResolutionPlan.sha256,
          entrySha256: resolutionEntrySha256,
          verdictAfterApproval: representative.sanitizerVerdictAfterApproval,
          reviewState: representative.entryReviewState,
        }
      : {
          requiredForSanitizerExecution: false,
          reportPath: inputEvidence.templateResolutionPlan.path,
          reportSha256: inputEvidence.templateResolutionPlan.sha256,
          entrySha256: resolutionEntrySha256,
          verdictAfterApproval: null,
          reviewState: representative.entryReviewState,
        },
  };
}

export function buildSanitizationPlan({
  stubs,
  audit,
  supplement,
  resolutionPlan,
  inventory,
  verifiedSourceFiles,
  inputEvidence,
}) {
  assert(Array.isArray(stubs), "Template projection stubs must be an array");
  assert(Array.isArray(audit?.bindingAudits), "Geometry audit has no bindingAudits array");
  assert(Array.isArray(supplement?.entries), "Geometry supplement has no entries array");
  assert(Array.isArray(resolutionPlan?.bindingClassifications), "Template-resolution plan has no classifications");
  assert(Array.isArray(inventory), "Document inventory must be an array");
  assert(verifiedSourceFiles instanceof Map, "Verified source-file map is missing");
  assertAllFalse(audit.prohibitedActionsPerformed, "Geometry-audit prohibited actions");
  assertAllFalse(supplement.prohibitedActionsPerformed, "Geometry-supplement prohibited actions");
  assertAllFalse(resolutionPlan.prohibitedActionsPerformed, "Template-resolution prohibited actions");
  validateResolutionReviewState(resolutionPlan);
  validateInputHashPins({ inputEvidence, audit, supplement, resolutionPlan });

  assertExpectedCount("CD-excluded template binding", stubs.length, EXPECTED_SANITIZATION_COUNTS.bindings);
  assertExpectedCount("Scoped template-resolution binding", resolutionPlan.bindingClassifications.length, EXPECTED_SANITIZATION_COUNTS.bindings);
  assertExpectedCount("Template-resolution total binding", resolutionPlan?.counts?.totalBindings, EXPECTED_SANITIZATION_COUNTS.bindings);
  assert(resolutionPlan?.counts?.unresolvedBindings === 0, "Template-resolution plan still contains unresolved bindings");
  assertNoCdModelLeakage(stubs, "CD-excluded template stubs");
  assertNoCdModelLeakage(resolutionPlan.bindingClassifications, "Scoped template-resolution classifications");

  const auditByBinding = mapUnique(audit.bindingAudits, (row) => String(row.bindingKey || ""), "Geometry audit");
  const stubByBinding = mapUnique(stubs, stubBindingKey, "Template projection stubs");
  const classificationByBinding = mapUnique(
    resolutionPlan.bindingClassifications,
    (entry) => String(entry.bindingKey || ""),
    "Template-resolution classifications"
  );
  const classificationFingerprintByBinding = mapUnique(
    resolutionPlan.bindingClassificationFingerprints || [],
    (entry) => String(entry.bindingKey || ""),
    "Template-resolution fingerprints"
  );
  assertExpectedCount("Unique template stubs", stubByBinding.size, EXPECTED_SANITIZATION_COUNTS.bindings);
  assertExpectedCount("Unique template classifications", classificationByBinding.size, EXPECTED_SANITIZATION_COUNTS.bindings);
  assertExpectedCount("Unique classification fingerprints", classificationFingerprintByBinding.size, EXPECTED_SANITIZATION_COUNTS.bindings);
  assert(
    canonicalJson([...stubByBinding.keys()].sort()) === canonicalJson([...classificationByBinding.keys()].sort()),
    "Template stubs and template-resolution classifications do not have the same exact binding keys"
  );

  const supplementFingerprintHashes = new Set(
    (supplement.entryFingerprints || []).map((entry) => validSha256(entry.entrySha256, "Geometry-supplement entry hash"))
  );
  assert(
    supplementFingerprintHashes.size === (supplement.entryFingerprints || []).length,
    "Geometry supplement contains duplicate entry fingerprints"
  );
  const extendedTargetHashes = new Set(
    (resolutionPlan?.extendedEvidence?.targetFingerprints || []).map((entry) =>
      validSha256(entry.entrySha256, "Extended-evidence target hash")
    )
  );
  const extendedFamilyHashes = new Set(
    (resolutionPlan?.extendedEvidence?.familyFingerprints || []).map((entry) =>
      validSha256(entry.familySha256, "Extended-evidence family hash")
    )
  );

  const inventoryByIdentity = mapUnique(inventory, inventoryIdentityKey, "Document inventory identities");
  const resolved = [];
  for (const bindingKey of [...stubByBinding.keys()].sort((left, right) => left.localeCompare(right, "en", { numeric: true }))) {
    const stub = stubByBinding.get(bindingKey);
    const classification = classificationByBinding.get(bindingKey);
    const fingerprint = classificationFingerprintByBinding.get(bindingKey);
    assert(fingerprint, `Template-resolution fingerprint is missing for ${bindingKey}`);
    assert(fingerprint.entrySha256 === sha256Json(classification), `Template-resolution entry fingerprint drifted for ${bindingKey}`);
    assert(ALLOWED_CLASSIFICATIONS.has(classification.classification), `Unsupported resolution classification for ${bindingKey}`);
    if (classification.classification === "base_verified") {
      assert(
        classification.entryReviewState === "base_audit_verified",
        `Base-verified binding has an unresolved review state: ${bindingKey}`
      );
    } else {
      assert(
        ["pending_review", "approved"].includes(classification.entryReviewState),
        `Resolved binding has an invalid review state: ${bindingKey}`
      );
    }
    const dependencies = classification?.evidence?.dependencies;
    assert(dependencies && typeof dependencies === "object", `Resolution dependencies are missing for ${bindingKey}`);
    assert(dependencies.baseAuditSha256 === inputEvidence.geometryAudit.sha256, `Resolution entry has a stale base-audit hash for ${bindingKey}`);
    const supplementHashes = dependencies.titleSupplementEntrySha256s || [];
    if (supplementHashes.length > 0) {
      assert(
        dependencies.titleSupplementReportSha256 === inputEvidence.geometrySupplement.sha256,
        `Resolution entry has a stale geometry-supplement hash for ${bindingKey}`
      );
      assert(
        supplementHashes.every((entrySha256) => supplementFingerprintHashes.has(entrySha256)),
        `Resolution entry selects an unknown geometry-supplement entry for ${bindingKey}`
      );
    } else {
      assert(
        dependencies.titleSupplementReportSha256 === null,
        `Resolution entry pins a supplement report without an entry for ${bindingKey}`
      );
    }
    if (classification.classification === "pending_title_only") {
      assert(supplementHashes.length === 1, `Pending-title resolution must pin exactly one supplement entry for ${bindingKey}`);
    }
    if (classification.classification === "extended_exact_evidence") {
      assert(
        extendedTargetHashes.has(dependencies.extendedEvidenceTargetSha256),
        `Extended resolution target hash is unknown for ${bindingKey}`
      );
      assert(
        extendedFamilyHashes.has(dependencies.extendedEvidenceFamilySha256),
        `Extended resolution family hash is unknown for ${bindingKey}`
      );
    } else {
      assert(
        dependencies.extendedEvidenceTargetSha256 === null
          && dependencies.extendedEvidenceFamilySha256 === null,
        `Non-extended resolution unexpectedly pins extended evidence for ${bindingKey}`
      );
    }
    assert(classification.selectionKey === selectionKey(stub.match), `Selection key differs between stub and resolution for ${bindingKey}`);
    assert(classification.finishKey === stub.match.finish, `Finish differs between stub and resolution for ${bindingKey}`);
    const geometry = parseExpectedGeometryKey(classification.expectedGeometryKey);
    assert(stub.match.folder_model === `${geometry.format}--${geometry.construction}`, `Folder model differs from expected geometry for ${bindingKey}`);
    assert(stub.match.print === geometry.print, `Print mode differs from expected geometry for ${bindingKey}`);
    assert(stub.match.spine === `${geometry.spineMm}mm`, `Spine differs from expected geometry for ${bindingKey}`);

    const originalAudit = auditByBinding.get(bindingKey);
    assert(originalAudit, `Geometry audit does not contain original binding ${bindingKey}`);
    assert(auditGeometryKey(originalAudit) === classification.expectedGeometryKey, `Original audit geometry differs for ${bindingKey}`);
    assert(originalAudit.finishKey === classification.finishKey, `Original audit finish differs for ${bindingKey}`);
    assert(originalAudit.paperKey === stub.match.paper, `Original audit paper differs for ${bindingKey}`);
    assertTemplateIdentity(classification.oldTemplate, sourceIdentityFromAudit(originalAudit), `Old template identity for ${bindingKey}`);
    assert(stub.template?.sourceUrl === classification.oldTemplate.sourceUrl, `Template stub source URL differs from original audit for ${bindingKey}`);

    const resolvedSourceAudit = auditByBinding.get(classification.newTemplate?.bindingKey);
    assert(resolvedSourceAudit, `Geometry audit does not contain resolved source binding ${classification.newTemplate?.bindingKey}`);
    assert(auditGeometryKey(resolvedSourceAudit) === classification.expectedGeometryKey, `Resolved source audit geometry differs for ${bindingKey}`);
    assertTemplateIdentity(classification.newTemplate, sourceIdentityFromAudit(resolvedSourceAudit), `Resolved template identity for ${bindingKey}`);

    const identityKey = inventoryIdentityKey(classification.newTemplate);
    const inventoryRow = inventoryByIdentity.get(identityKey);
    assert(inventoryRow, `Resolved source identity is absent from document inventory for ${bindingKey}`);
    assert(inventoryRow.role === "template" && inventoryRow.documentRole === "template", `Resolved document is not an exact template for ${bindingKey}`);
    assert(inventoryRow.inspection.structurallyReadable, `Resolved template is not structurally readable for ${bindingKey}`);
    assert(inventoryRow.selectionBindingKeys.includes(classification.newTemplate.bindingKey), `Inventory template does not contain resolved binding ${classification.newTemplate.bindingKey}`);
    const verified = verifiedSourceFiles.get(classification.newTemplate.localRelativePath);
    assert(verified, `Resolved source file was not verified: ${classification.newTemplate.localRelativePath}`);
    assert(
      verified.sha256 === classification.newTemplate.sha256 && verified.byteSize === inventoryRow.byteSize,
      `Resolved source file bytes differ from inventory for ${bindingKey}`
    );

    const artworkMode = String(stub.template?.artworkMode || "");
    assert(["online_designer", "professional_pdf_upload_only"].includes(artworkMode), `Artwork mode is unresolved for ${bindingKey}`);
    resolved.push({
      stub,
      classification,
      classificationEntrySha256: fingerprint.entrySha256,
      originalAudit,
      resolvedSourceAudit,
      inventoryRow,
      geometry,
      geometryKey: classification.expectedGeometryKey,
      finishKey: classification.finishKey,
      sourceIdentityKey: sha256Json(inventoryIdentity(inventoryRow)),
      artworkMode,
    });
  }

  const resolvedUrls = new Set(resolved.map((entry) => entry.classification.newTemplate.sourceUrl));
  const resolvedPayloads = new Set(resolved.map((entry) => entry.classification.newTemplate.sha256));
  assertExpectedCount("Resolved source URL", resolvedUrls.size, EXPECTED_SANITIZATION_COUNTS.resolvedSourceUrls);
  assertExpectedCount("Distinct resolved source payload", resolvedPayloads.size, EXPECTED_SANITIZATION_COUNTS.distinctSourcePayloads);

  const groups = new Map();
  for (const entry of resolved) {
    const signature = safeOutputSignature(entry.geometryKey, entry.finishKey, entry.classification.newTemplate.sha256);
    const key = canonicalJson(signature);
    if (!groups.has(key)) groups.set(key, { signature, entries: [] });
    groups.get(key).entries.push(entry);
  }
  assertExpectedCount("Safe sanitized output signature", groups.size, EXPECTED_SANITIZATION_COUNTS.outputJobs);

  const jobs = [];
  for (const group of [...groups.values()].sort((left, right) => canonicalJson(left.signature).localeCompare(canonicalJson(right.signature), "en", { numeric: true }))) {
    group.entries.sort((left, right) => {
      const priority = EXECUTION_CLASSIFICATION_PRIORITY[left.classification.classification]
        - EXECUTION_CLASSIFICATION_PRIORITY[right.classification.classification];
      return priority || left.classification.bindingKey.localeCompare(right.classification.bindingKey, "en", { numeric: true });
    });
    const representative = group.entries[0].classification;
    const first = group.entries[0];
    const geometry = first.geometry;
    const finishKey = first.finishKey;
    const sourceSha256 = first.classification.newTemplate.sha256;
    const signatureSha256 = sha256Json(group.signature);
    const jobId = outputJobId(geometry, finishKey, sourceSha256);
    const sourceIdentities = new Map();
    for (const entry of group.entries) {
      const identity = {
        key: entry.sourceIdentityKey,
        ...inventoryIdentity(entry.inventoryRow),
        byteSize: entry.inventoryRow.byteSize,
        inventoryRowSha256: entry.inventoryRow.inventoryRowSha256,
        inventoryInspection: entry.inventoryRow.inspection,
      };
      if (sourceIdentities.has(identity.key)) {
        assert(
          canonicalJson(sourceIdentities.get(identity.key)) === canonicalJson(identity),
          `Resolved source identity conflicts within ${jobId}: ${identity.key}`
        );
      } else {
        sourceIdentities.set(identity.key, identity);
      }
    }
    const sourceIdentityList = [...sourceIdentities.values()].sort((left, right) => left.key.localeCompare(right.key));
    const executionSourceIdentity = sourceIdentityList.find(
      (identity) => identity.key === first.sourceIdentityKey
    );
    assert(executionSourceIdentity, `Execution source identity is missing for ${jobId}`);
    const artworkModes = [...new Set(group.entries.map((entry) => entry.artworkMode))];
    assert(artworkModes.length === 1, `One safe output signature has conflicting artwork modes: ${jobId}`);
    const classifications = [...new Set(group.entries.map((entry) => entry.classification.classification))].sort();
    const reviewStates = [...new Set(group.entries.map((entry) => sourceReviewState(entry.classification)))].sort();
    const resolutionEntrySha256s = group.entries
      .map((entry) => entry.classificationEntrySha256)
      .sort();
    assert(new Set(resolutionEntrySha256s).size === resolutionEntrySha256s.length, `Resolution entry hashes repeat within ${jobId}`);
    const coveredBindings = group.entries
      .map((entry) => ({
        bindingKey: entry.classification.bindingKey,
        stubKey: entry.stub.key,
        selectionKey: entry.classification.selectionKey,
        selections: Object.fromEntries(SEMANTIC_AXES.map((axis) => [axis, entry.stub.match[axis]])),
        classification: entry.classification.classification,
        entryReviewState: sourceReviewState(entry.classification),
        resolutionEntrySha256: entry.classificationEntrySha256,
        resolutionDependencies: {
          baseAuditSha256: entry.classification.evidence.dependencies.baseAuditSha256,
          geometrySupplementReportSha256:
            entry.classification.evidence.dependencies.titleSupplementReportSha256,
          geometrySupplementEntrySha256s: [
            ...entry.classification.evidence.dependencies.titleSupplementEntrySha256s,
          ],
          extendedEvidenceTargetSha256:
            entry.classification.evidence.dependencies.extendedEvidenceTargetSha256,
          extendedEvidenceFamilySha256:
            entry.classification.evidence.dependencies.extendedEvidenceFamilySha256,
        },
        resolvedSourceBindingKey: entry.classification.newTemplate.bindingKey,
        resolvedSourceIdentityKey: entry.sourceIdentityKey,
        artworkMode: entry.artworkMode,
      }))
      .sort((left, right) => left.selectionKey.localeCompare(right.selectionKey, "en", { numeric: true }));
    const outputs = {
      reviewedContract: `documents/sanitization-contracts/${jobId}.json`,
      sanitizedPdf: `documents/sanitized-pdfs/${jobId}.pdf`,
      inspection: `documents/sanitization-inspections/${jobId}.json`,
    };
    Object.entries(outputs).forEach(([key, value]) => safeRelativePath(value, `${jobId} ${key}`));
    jobs.push({
      jobId,
      displayNameDa: displayNameDa(geometry, finishKey),
      safeOutputSignature: group.signature,
      safeOutputSignatureSha256: signatureSha256,
      geometry: { ...geometry, expectedGeometryKey: first.geometryKey },
      finish: {
        key: finishKey,
        labelDa: FINISH_LABELS_DA[finishKey] || finishKey,
        changesDanishInformationOverlay: true,
        spotFinish: SPOT_FINISHES.has(finishKey),
      },
      source: {
        executionIdentity: executionSourceIdentity,
        exactResolvedIdentities: sourceIdentityList,
        exactResolvedIdentityCount: sourceIdentityList.length,
        identitySelectionPolicy: "execution_binding_exact_identity; aliases are retained only when URL/path differ but SHA-256 bytes are identical",
      },
      artwork: {
        mode: artworkModes[0],
        onlineDesignerAllowed: artworkModes[0] === "online_designer",
        sourceFinishMaskMustBeHumanReviewed: SPOT_FINISHES.has(finishKey),
        missingSourceFinishMaskKeepsProfessionalUploadOnly: SPOT_FINISHES.has(finishKey),
        technicalStanzenRole: "cut_not_finish",
      },
      executionEvidence: evidenceForRepresentative({
        representative,
        auditByBinding,
        classificationFingerprintByBinding,
        supplement,
        inputEvidence,
      }),
      mappingEvidence: {
        templateResolutionPlanPath: inputEvidence.templateResolutionPlan.path,
        templateResolutionPlanSha256: inputEvidence.templateResolutionPlan.sha256,
        classifications,
        reviewStates,
        resolutionEntrySha256s,
        allNonBaseMappingsRequireExactApprovedResolutionEntryBeforeAttachment: true,
      },
      coveredBindingCount: coveredBindings.length,
      coveredBindings,
      outputs,
      sanitizerArgumentsAfterAllApprovals: {
        source: executionSourceIdentity.localRelativePath,
        contract: outputs.reviewedContract,
        geometryAudit: inputEvidence.geometryAudit.path,
        geometrySupplement: first.classification.classification === "pending_title_only"
          ? inputEvidence.geometrySupplement.path
          : null,
        templateResolutionPlan: !["base_verified", "pending_title_only"].includes(first.classification.classification)
          ? inputEvidence.templateResolutionPlan.path
          : null,
        output: outputs.sanitizedPdf,
        inspection: outputs.inspection,
      },
      gate: {
        state: "pending_review_contract_and_batch_approval",
        sanitizationAllowed: false,
        contractExists: false,
        contractApproved: false,
        sourceIdentityApprovedOrPending: reviewStates,
      },
    });
  }

  const jobIds = new Set(jobs.map((job) => job.jobId));
  const outputPaths = jobs.flatMap((job) => Object.values(job.outputs));
  assertExpectedCount("Unique sanitization job ID", jobIds.size, EXPECTED_SANITIZATION_COUNTS.outputJobs);
  assertExpectedCount("Unique sanitization artifact path", new Set(outputPaths).size, EXPECTED_SANITIZATION_COUNTS.outputJobs * 3);
  assertExpectedCount("Covered sanitization binding", jobs.reduce((sum, job) => sum + job.coveredBindingCount, 0), EXPECTED_SANITIZATION_COUNTS.bindings);

  const jobCountsByFinish = Object.fromEntries(
    [...new Set(jobs.map((job) => job.finish.key))]
      .sort()
      .map((finishKey) => [finishKey, jobs.filter((job) => job.finish.key === finishKey).length])
  );
  const bindingCountsByClassification = Object.fromEntries(
    [...ALLOWED_CLASSIFICATIONS]
      .sort()
      .map((classification) => [
        classification,
        resolved.filter((entry) => entry.classification.classification === classification).length,
      ])
  );
  return {
    schemaVersion: 1,
    kind: "wmd_sales_folder_sanitization_batch_plan",
    state: "pending_review",
    reviewState: "pending_review",
    localOnly: true,
    eligibleForSanitization: false,
    eligibleForTemplateImport: false,
    approval: {
      approved: false,
      reviewer: null,
      reviewedAt: null,
      approvedJobSignatureHashes: [],
    },
    scope: {
      productFamily: "sales_folders",
      proposedBindingCount: EXPECTED_SANITIZATION_COUNTS.bindings,
      excludedFolderModel: "cd-135x135--2-part-closure",
      excludedFolderModelBindingCount: 52,
      excludedPdfAddOns: ["CD-Tasche"],
      rawSupplierEvidencePreserved: true,
      selectedBindingsContainCdModel: false,
    },
    catalogScope: structuredClone(resolutionPlan.catalogScope),
    sourceScopeProjection: structuredClone(resolutionPlan.sourceScopeProjection),
    groupingPolicy: {
      safeOutputSignature: ["expectedGeometryKey", "finishKey", "resolvedSourceSha256"],
      reason: "Danish information and finish instructions vary by expected geometry and finish even when supplier PDF bytes are shared.",
      resolvedSourceUrlCountIsNotOutputCount: true,
      distinctSourcePayloadCountIsNotOutputCount: true,
      resolvedSourceUrlCount: resolvedUrls.size,
      distinctSourcePayloadCount: resolvedPayloads.size,
      expectedOutputCount: jobs.length,
      warning: "Do not use the 1,099 source URLs or 285 distinct byte payloads as the output count; finish-specific Danish overlays require 1,420 separately reviewed outputs.",
    },
    counts: {
      bindings: resolved.length,
      resolvedSourceUrls: resolvedUrls.size,
      distinctSourcePayloads: resolvedPayloads.size,
      outputJobs: jobs.length,
      expectedReviewedContracts: jobs.length,
      expectedSanitizedPdfs: jobs.length,
      expectedInspections: jobs.length,
      jobCountsByFinish,
      bindingCountsByClassification,
    },
    inputEvidence,
    contractRequirements: {
      schemaVersion: 1,
      reviewState: "approved_for_sanitization",
      createdFromExactSourceWithDescribeMode: true,
      humanReviewRequired: true,
      immutablePins: [
        "source SHA-256",
        "geometry binding SHA-256",
        "page-box SHA-256",
        "layer inventory SHA-256",
        "color inventory SHA-256",
        "text SHA-256",
        "spot-paint usage",
        "fill-paint inventory",
        "painting-feature inventory",
        "vector geometry fingerprints",
        "geometry-audit report SHA-256 and exact binding key",
        "geometry-supplement report and entry SHA-256 when required",
        "template-resolution report and entry SHA-256 when required",
      ],
      layerPolicy: {
        everySourceLayerMustBeClassifiedExactlyOnce: true,
        everyPreservedLayerRequiresNonEmptyOutputNameDa: true,
        cdTascheWhenPresent: {
          action: "remove",
          role: "unused-accessory",
          outputNameDa: null,
        },
        supplierInformationAndBrandingRemoved: true,
        technicalStanzenIsCutGeometryNeverFinishMask: true,
      },
      visualPolicy: {
        addedInformationPanelFill: "#0EA5E9",
        addedInformationPanelBorder: "#0284C7",
        noPrintOrHiddenAreaFill: "#D1D5DB",
        allAddedTextMustFitReviewedBoxesWithPadding: true,
        allHelperLayersViewOnPrintOffExportOff: true,
      },
      spotFinishPolicy: {
        sourceFinishMaskMayBeAbsent: true,
        absenceMustBeExplicitlyRecorded: true,
        absenceKeepsProfessionalUploadOnly: true,
        neverTreatTechnicalStanzenAsFinishMask: true,
      },
    },
    prohibitedUntilExplicitApproval: [
      "approve or synthesize a sanitization contract automatically",
      "sanitize, create, overwrite, or upload any PDF",
      "attach any PDF to Designer or a product/template record",
      "write Supplier Bank, database, product, template, pricing, or publication state",
      "use a URL count or byte-payload count as the output batch count",
      "infer a source identity, geometry, finish mask, or fallback template",
    ],
    prohibitedActionsPerformed: { ...PROHIBITED_ACTIONS_PERFORMED },
    nextGate: "Review and approve the hash-pinned resolution evidence and every generated contract; then run the PDF edit marker once with expected-output-count 1420 immediately before the first sanitizer authoring command.",
    jobs,
  };
}

async function readJsonEvidence(absolutePath, relativePath, label) {
  const bytes = await fs.readFile(absolutePath);
  let value;
  try {
    value = JSON.parse(bytes);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return {
    value,
    evidence: {
      path: relativePath,
      sha256: sha256Bytes(bytes),
      bytes: bytes.length,
    },
  };
}

async function readJsonlEvidence(absolutePath, relativePath, label, projector = (row) => row) {
  const hash = createHash("sha256");
  const stream = createReadStream(absolutePath);
  stream.on("data", (chunk) => hash.update(chunk));
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const rows = [];
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    assert(line.trim().length > 0, `${label} contains a blank row at ${lineNumber}`);
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} row ${lineNumber} is not valid JSON: ${error.message}`);
    }
    rows.push(projector(row));
  }
  const stat = await fs.stat(absolutePath);
  return {
    value: rows,
    evidence: {
      path: relativePath,
      sha256: hash.digest("hex"),
      bytes: stat.size,
      rows: rows.length,
    },
  };
}

async function sha256File(absolutePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(absolutePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyRegularSourceFile(runDirectory, relativePath, expectedSha256) {
  const absolutePath = safeRunPath(runDirectory, relativePath, "Resolved source PDF path");
  const before = await fs.lstat(absolutePath);
  assert(before.isFile() && !before.isSymbolicLink(), `Resolved source PDF must be a regular non-symlink: ${relativePath}`);
  const real = await fs.realpath(absolutePath);
  assert(real.startsWith(`${path.resolve(runDirectory)}${path.sep}`), `Resolved source PDF real path escapes the run: ${relativePath}`);
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0);
  const handle = await fs.open(absolutePath, flags);
  let bytes;
  try {
    const status = await handle.stat();
    assert(status.isFile(), `Resolved source PDF is not a regular file: ${relativePath}`);
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  const observedSha256 = sha256Bytes(bytes);
  assert(observedSha256 === expectedSha256, `Resolved source PDF hash drifted: ${relativePath}`);
  return { relativePath, sha256: observedSha256, byteSize: bytes.length };
}

async function validateSidecar(runDirectory, evidence, sidecarRelativePath) {
  const absolutePath = safeRunPath(runDirectory, sidecarRelativePath, "SHA-256 sidecar path");
  const text = await fs.readFile(absolutePath, "utf8");
  const expected = `${evidence.sha256}  ${path.posix.basename(evidence.path)}\n`;
  assert(text === expected, `SHA-256 sidecar is stale: ${sidecarRelativePath}`);
}

export async function loadSanitizationInputs({ runDirectory = DEFAULT_RUN_DIRECTORY } = {}) {
  const resolvedRun = path.resolve(runDirectory);
  const paths = Object.fromEntries(
    Object.entries(INPUT_PATHS).map(([key, relativePath]) => [
      key,
      safeRunPath(resolvedRun, relativePath, `${key} input path`),
    ])
  );
  const [stubs, audit, supplement, resolutionPlan, inventory] = await Promise.all([
    readJsonlEvidence(paths.templateProjectionStubs, INPUT_PATHS.templateProjectionStubs, "Template projection stubs"),
    readJsonEvidence(paths.geometryAudit, INPUT_PATHS.geometryAudit, "Geometry audit"),
    readJsonEvidence(paths.geometrySupplement, INPUT_PATHS.geometrySupplement, "Geometry supplement"),
    readJsonEvidence(paths.templateResolutionPlan, INPUT_PATHS.templateResolutionPlan, "Template-resolution plan"),
    readJsonlEvidence(
      paths.documentInventory,
      INPUT_PATHS.documentInventory,
      "Document inventory",
      compactInventoryRow
    ),
  ]);
  await validateSidecar(
    resolvedRun,
    supplement.evidence,
    `${INPUT_PATHS.geometrySupplement}.sha256`
  );
  await validateSidecar(
    resolvedRun,
    resolutionPlan.evidence,
    `${INPUT_PATHS.templateResolutionPlan}.sha256`
  );
  const inputEvidence = {
    templateProjectionStubs: stubs.evidence,
    geometryAudit: audit.evidence,
    geometrySupplement: supplement.evidence,
    templateResolutionPlan: resolutionPlan.evidence,
    documentInventory: inventory.evidence,
  };
  const sourceRequirements = new Map();
  for (const entry of resolutionPlan.value.bindingClassifications || []) {
    const relativePath = safeRelativePath(
      entry?.newTemplate?.localRelativePath,
      `Resolved source path for ${entry?.bindingKey || "(unknown)"}`,
      ".pdf"
    );
    const expectedSha256 = validSha256(
      entry?.newTemplate?.sha256,
      `Resolved source SHA-256 for ${entry?.bindingKey || "(unknown)"}`
    );
    if (sourceRequirements.has(relativePath)) {
      assert(sourceRequirements.get(relativePath) === expectedSha256, `One source path is assigned conflicting hashes: ${relativePath}`);
    } else {
      sourceRequirements.set(relativePath, expectedSha256);
    }
  }
  const verifiedSourceFiles = new Map();
  for (const [relativePath, expectedSha256] of [...sourceRequirements].sort(([left], [right]) => left.localeCompare(right))) {
    const verified = await verifyRegularSourceFile(resolvedRun, relativePath, expectedSha256);
    verifiedSourceFiles.set(relativePath, verified);
  }
  return {
    runDirectory: resolvedRun,
    paths,
    stubs: stubs.value,
    audit: audit.value,
    supplement: supplement.value,
    resolutionPlan: resolutionPlan.value,
    inventory: inventory.value,
    verifiedSourceFiles,
    inputEvidence,
  };
}

async function assertEvidenceUnchanged(context) {
  for (const [key, absolutePath] of Object.entries(context.paths)) {
    const observed = await sha256File(absolutePath);
    assert(observed === context.inputEvidence[key].sha256, `${key} changed while the sanitization plan was built`);
  }
  for (const [relativePath, expected] of context.verifiedSourceFiles) {
    const observed = await verifyRegularSourceFile(context.runDirectory, relativePath, expected.sha256);
    assert(observed.byteSize === expected.byteSize, `Resolved source PDF byte size drifted: ${relativePath}`);
  }
}

async function assertExpectedArtifactsAbsent(runDirectory, jobs) {
  for (const job of jobs) {
    for (const [kind, relativePath] of Object.entries(job.outputs)) {
      const absolutePath = safeRunPath(runDirectory, relativePath, `${job.jobId} ${kind}`);
      try {
        await fs.lstat(absolutePath);
        throw new Error(`Refusing a pending plan whose expected ${kind} path already exists: ${relativePath}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }
}

export async function generateSanitizationPlan({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  outputPath = null,
  writeOutput = true,
} = {}) {
  const context = await loadSanitizationInputs({ runDirectory });
  const plan = buildSanitizationPlan(context);
  await assertExpectedArtifactsAbsent(context.runDirectory, plan.jobs);
  await assertEvidenceUnchanged(context);
  const outputBytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const outputSha256 = sha256Bytes(outputBytes);
  const resolvedOutputPath = path.resolve(
    outputPath || safeRunPath(context.runDirectory, DEFAULT_OUTPUT_RELATIVE_PATH, "Sanitization-plan output path")
  );
  assert(
    resolvedOutputPath.startsWith(`${context.runDirectory}${path.sep}`),
    "Sanitization-plan output must remain inside the run directory"
  );
  const sidecarPath = `${resolvedOutputPath}.sha256`;
  if (writeOutput) {
    await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    const temporaryPath = `${resolvedOutputPath}.${process.pid}.tmp`;
    const temporarySidecarPath = `${sidecarPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, outputBytes, { mode: 0o600 });
    await fs.writeFile(
      temporarySidecarPath,
      `${outputSha256}  ${path.basename(resolvedOutputPath)}\n`,
      { mode: 0o600 }
    );
    await fs.rename(temporaryPath, resolvedOutputPath);
    await fs.rename(temporarySidecarPath, sidecarPath);
  }
  return { plan, outputPath: resolvedOutputPath, sidecarPath, outputSha256 };
}

function parseArguments(argv) {
  const result = {
    runDirectory: DEFAULT_RUN_DIRECTORY,
    outputPath: null,
    writeOutput: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") result.runDirectory = argv[++index];
    else if (argument === "--output") result.outputPath = argv[++index];
    else if (argument === "--no-write") result.writeOutput = false;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

async function main() {
  const result = await generateSanitizationPlan(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    state: result.plan.state,
    outputJobs: result.plan.counts.outputJobs,
    bindings: result.plan.counts.bindings,
    outputPath: result.outputPath,
    outputSha256: result.outputSha256,
    wroteOutput: process.argv.includes("--no-write") ? false : true,
    eligibleForSanitization: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`REFUSED: ${error.message}\n`);
    process.exitCode = 2;
  });
}
