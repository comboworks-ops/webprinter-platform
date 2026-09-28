#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  generateTemplateResolutionPlan,
  sha256Json,
} from "./build-wmd-sales-folder-template-resolution-plan.js";

const SCRIPT_PATH = "scripts/product-import/promote-wmd-sales-folder-template-approval.js";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);
const DEFAULT_REQUEST_PATH = "review/template-approval-request.json";
const DEFAULT_DECISION_PATH = "review/template-approval-decision.json";
const DEFAULT_APPROVED_DIRECTORY = "review/approved-template-package";
const INPUT_PATHS = Object.freeze({
  geometrySupplement: "review/template-geometry-supplement.json",
  renderManifest: "review/template-geometry-render-review/render-manifest.json",
  resolutionPlan: "review/template-resolution-plan.json",
});
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CANONICAL_ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const HUMAN_ATTESTATION =
  "I am a human reviewer and personally reviewed every exact entry pinned by this decision.";
const LOCAL_SANITIZATION_ATTESTATION =
  "I authorize only local PDF template sanitization: Danish and Webprinter wording, removal of supplier branding and metadata, and preservation of the exact cut, fold, and page-box geometry. I do not authorize product, price, database, supplier-bank, storage, upload, or publication changes.";
const LOCAL_SANITIZATION_AUTHORIZATION = Object.freeze({
  purpose: "local_pdf_template_sanitization_only",
  attestation: LOCAL_SANITIZATION_ATTESTATION,
  approvedChanges: Object.freeze([
    "danish_and_webprinter_instructional_wording",
    "remove_supplier_branding",
    "remove_supplier_metadata",
    "preserve_exact_cut_fold_and_page_box_geometry",
  ]),
  explicitlyNotAuthorized: Object.freeze([
    "canonical_pending_input_mutation",
    "database_write",
    "product_or_template_record_write",
    "pricing_write",
    "supplier_bank_write",
    "storage_write_or_upload",
    "source_pdf_overwrite",
    "publication",
  ]),
  localOnly: true,
  approvedPackageMustRemainSeparate: true,
});
const USER_INSTRUCTION_QUOTES = Object.freeze([
  "all these PDFs has to be cleaned with no metadata from Viermarkentryk or anything, and it has to be changed to Danish, and then where we have some color green, we change it to the bluish print web printer color and translate everything into Danish, basically, on the PDF that lands.",
  "we do not need this CD Tasche anymore.",
]);
const USER_INSTRUCTION_EVIDENCE = Object.freeze(
  USER_INSTRUCTION_QUOTES.map((quote) => Object.freeze({
    quote,
    sha256: createHash("sha256").update(quote, "utf8").digest("hex"),
  }))
);
const BASE_CLASSIFICATION = "base_verified";
const EXPECTED_SCOPED_COUNTS = Object.freeze({
  rawBindings: 3744,
  proposedBindings: 3692,
  excludedBindings: 52,
  baseBindings: 3170,
  nonBaseBindings: 522,
  titleSupplementEntries: 121,
  titleBindings: 306,
  renderPairs: 23,
  extendedFamilies: 4,
  extendedTargets: 10,
});
const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  approvalDecisionInvented: false,
  pendingArtifactModified: false,
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  sourcePdfUploaded: false,
  databaseWritten: false,
  supplierBankWritten: false,
  productOrTemplateRecordWritten: false,
  pricingWritten: false,
  published: false,
});

export class TemplateApprovalPromotionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "TemplateApprovalPromotionError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new TemplateApprovalPromotionError(message, details);
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

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function prettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sorted(values) {
  return [...values].sort((left, right) =>
    String(left).localeCompare(String(right), "en", { numeric: true })
  );
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  assert(sameJson(Object.keys(value).sort(), [...keys].sort()), `${label} has an unexpected schema`);
  return value;
}

function validSha256(value, label) {
  const normalized = String(value || "");
  assert(SHA256_PATTERN.test(normalized), `${label} is not a lowercase SHA-256`);
  return normalized;
}

function safeRelativePath(value, label, requiredPrefix = null) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized && !path.posix.isAbsolute(normalized), `${label} must be relative`);
  assert(!normalized.split("/").includes(".."), `${label} cannot escape the run directory`);
  if (requiredPrefix) assert(normalized.startsWith(requiredPrefix), `${label} must start with ${requiredPrefix}`);
  return normalized;
}

function nonEmptyReviewNote(value, label) {
  const note = String(value || "");
  assert(note === note.trim(), `${label} cannot have leading or trailing whitespace`);
  assert(note.length >= 12 && note.length <= 2000, `${label} must be a specific 12-2000 character note`);
  assert(!/^(approved|ok|okay|passed|looks good|godkendt)$/iu.test(note), `${label} is too generic`);
  return note;
}

function validateHumanReviewer(value) {
  const reviewer = String(value || "");
  assert(reviewer === reviewer.trim(), "Reviewer cannot have leading or trailing whitespace");
  assert(reviewer.length >= 2 && reviewer.length <= 120, "Reviewer must be a non-empty human identity");
  assert(
    !/(^|\b)(codex|chatgpt|openai|automation|automated|system|bot|pending|todo|null|unknown)(\b|$)/iu.test(reviewer),
    "Reviewer must identify a human, not software or a placeholder"
  );
  return reviewer;
}

function validateReviewedAt(value) {
  const reviewedAt = String(value || "");
  assert(CANONICAL_ISO_UTC_PATTERN.test(reviewedAt), "reviewedAt must be canonical ISO-8601 UTC with milliseconds");
  const parsed = new Date(reviewedAt);
  assert(!Number.isNaN(parsed.valueOf()) && parsed.toISOString() === reviewedAt, "reviewedAt is not a real canonical timestamp");
  return reviewedAt;
}

function assertAllFalse(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  for (const [key, state] of Object.entries(value)) {
    assert(state === false, `${label} reports a prohibited action: ${key}`);
  }
}

function validateArtifactRecord(artifact, label) {
  assert(artifact && typeof artifact === "object", `${label} artifact is missing`);
  assert(Buffer.isBuffer(artifact.bytes), `${label} raw bytes are missing`);
  assert(artifact.evidence && typeof artifact.evidence === "object", `${label} evidence is missing`);
  safeRelativePath(artifact.evidence.path, `${label} evidence path`, "review/");
  assert(artifact.evidence.bytes === artifact.bytes.length, `${label} byte count drifted`);
  assert(validSha256(artifact.evidence.sha256, `${label} SHA-256`) === sha256Bytes(artifact.bytes), `${label} SHA-256 drifted`);
  let parsed;
  try {
    parsed = JSON.parse(artifact.bytes.toString("utf8"));
  } catch (error) {
    throw new TemplateApprovalPromotionError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
  assert(sameJson(parsed, artifact.value), `${label} value differs from its pinned raw bytes`);
}

function validateFingerprintList(entries, fingerprints, entryKey, hashKey, label) {
  assert(Array.isArray(entries), `${label} entries are missing`);
  assert(Array.isArray(fingerprints), `${label} fingerprints are missing`);
  const expected = entries.map((entry) => ({
    key: String(entry[entryKey] || ""),
    hash: sha256Json(entry),
  }));
  const actual = fingerprints.map((fingerprint) => ({
    key: String(fingerprint[entryKey] || ""),
    hash: validSha256(fingerprint[hashKey], `${label} fingerprint`),
  }));
  assert(sameJson(actual, expected), `${label} fingerprints drifted`);
}

function supplementEntriesByHash(supplement) {
  assert(supplement?.kind === "wmd_sales_folder_geometry_supplement", "Unexpected geometry-supplement kind");
  assert(supplement?.schemaVersion === 1, "Geometry supplement schemaVersion must be 1");
  assert(supplement?.reviewState === "pending_review", "Only the pending geometry supplement can be promoted");
  assert(!Object.hasOwn(supplement, "reviewer") && !Object.hasOwn(supplement, "reviewedAt"), "Pending geometry supplement already carries approval identity");
  assert(Array.isArray(supplement.entries) && supplement.entries.length > 0, "Geometry supplement has no entries");
  assert(Array.isArray(supplement.entryFingerprints), "Geometry supplement has no fingerprints");
  assertAllFalse(supplement.prohibitedActionsPerformed || {}, "Geometry-supplement prohibitedActionsPerformed");
  const entries = new Map();
  for (const entry of supplement.entries) {
    const hash = sha256Json(entry);
    assert(!entries.has(hash), "Geometry supplement duplicates an entry hash", hash);
    assert(entry?.renderedReviewEvidence?.status === "pending_review", "Geometry-supplement entry is not pending rendered review", hash);
    assert(sameJson(entry.renderedReviewEvidence.sourceRenderSha256s, []), "Pending source renders must be empty", hash);
    assert(sameJson(entry.renderedReviewEvidence.counterpartRenderSha256s, []), "Pending counterpart renders must be empty", hash);
    assert(entry.renderedReviewEvidence.reviewerNote === "", "Pending geometry entry invents a reviewer note", hash);
    entries.set(hash, entry);
  }
  const recorded = supplement.entryFingerprints.map((entry) => validSha256(entry.entrySha256, "Supplement entry fingerprint"));
  assert(sameJson(sorted(recorded), sorted(entries.keys())), "Geometry-supplement entry fingerprints drifted");
  return entries;
}

function renderPairsByEntryHash(renderManifest, supplementArtifact) {
  assert(renderManifest?.kind === "wmd_sales_folder_geometry_render_review", "Unexpected render-manifest kind");
  assert(renderManifest?.schemaVersion === 1, "Render manifest schemaVersion must be 1");
  assert(renderManifest?.reviewState === "pending_human_review", "Render manifest is not pending human review");
  assert(sameJson(renderManifest.reviewDecision, { status: "not_recorded", reviewer: null, reviewedAt: null }), "Render manifest already carries an approval decision");
  assert(renderManifest?.sourceSupplement?.sha256 === supplementArtifact.evidence.sha256, "Render manifest is stale relative to the geometry supplement");
  assert(renderManifest?.sourceSupplement?.reviewState === "pending_review", "Render manifest was not built from a pending supplement");
  assertAllFalse(renderManifest.prohibitedActionsPerformed || {}, "Render-manifest prohibitedActionsPerformed");
  assert(Array.isArray(renderManifest.pairs), "Render manifest has no pairs array");
  const byEntry = new Map();
  const seenPairIds = new Set();
  for (const pair of renderManifest.pairs) {
    assert(pair?.pairId && !seenPairIds.has(pair.pairId), "Render manifest has a missing or duplicate pairId", pair?.pairId);
    seenPairIds.add(pair.pairId);
    validSha256(pair.sourceSha256, "Render pair source SHA-256");
    validSha256(pair.counterpartSha256, "Render pair counterpart SHA-256");
    assert(pair.sourceSha256 !== pair.counterpartSha256, "Render pair source and counterpart must be independent PDFs");
    for (const side of ["sourceRender", "counterpartRender"]) {
      const outputs = pair?.[side]?.outputs;
      assert(Array.isArray(outputs) && outputs.length > 0, `Render pair ${pair.pairId} has no ${side} outputs`);
      assert(outputs.every((output, index) => output.pageNumber === index + 1), `Render pair ${pair.pairId} ${side} page numbers drifted`);
      for (const output of outputs) validSha256(output.sha256, `Render pair ${pair.pairId} output SHA-256`);
    }
    assert(Array.isArray(pair.entrySha256s) && pair.entrySha256s.length > 0, `Render pair ${pair.pairId} has no supplement entries`);
    for (const entrySha256 of pair.entrySha256s) {
      validSha256(entrySha256, "Render pair supplement entry SHA-256");
      assert(!byEntry.has(entrySha256), "One supplement entry is mapped to more than one render pair", entrySha256);
      byEntry.set(entrySha256, pair);
    }
  }
  return byEntry;
}

function validateScopedPendingPlan(plan) {
  assert(plan?.kind === "wmd_sales_folder_template_resolution_plan", "Unexpected template-resolution plan kind");
  assert(plan?.schemaVersion === 1, "Template-resolution plan schemaVersion must be 1");
  assert(plan?.reviewState === "pending_review", "Only the pending template-resolution plan can be promoted");
  assert(sameJson(plan.approval, { approved: false, reviewer: null, reviewedAt: null }), "Pending plan already carries an approval");
  assert(plan?.approvalContract?.currentArtifactMayAuthorizeSanitization === false, "Pending plan may not authorize sanitization");
  assert(sameJson(plan.approvedEntryHashes, []), "Pending plan carries approved entry hashes");
  assertAllFalse(plan.prohibitedActionsPerformed || {}, "Template-resolution prohibitedActionsPerformed");
  assert(Array.isArray(plan.bindingClassifications), "Template-resolution classifications are missing");
  assert(Array.isArray(plan.bindingClassificationFingerprints), "Template-resolution fingerprints are missing");
  assert(plan.bindingClassifications.length === EXPECTED_SCOPED_COUNTS.proposedBindings, "Scoped plan must contain exactly 3,692 proposed bindings");
  assert(plan.counts?.totalBindings === EXPECTED_SCOPED_COUNTS.proposedBindings, "Scoped plan total binding count drifted");
  assert(plan.counts?.baseVerifiedBindings === EXPECTED_SCOPED_COUNTS.baseBindings, "Scoped plan base-verified count drifted");
  assert(plan.counts?.recoveredBindingsPendingReview === EXPECTED_SCOPED_COUNTS.nonBaseBindings, "Scoped plan non-base pending count drifted");
  assert(plan.counts?.classifications?.pending_title_only === EXPECTED_SCOPED_COUNTS.titleBindings, "Scoped plan title-only count drifted");
  assert(plan.counts?.extendedEvidenceFamilies === EXPECTED_SCOPED_COUNTS.extendedFamilies, "Scoped plan extended-family count drifted");
  assert(plan.counts?.extendedEvidenceTargets === EXPECTED_SCOPED_COUNTS.extendedTargets, "Scoped plan extended-target count drifted");
  assert(plan.counts?.unresolvedBindings === 0, "Scoped plan contains unresolved bindings");

  const fingerprints = plan.bindingClassifications.map((entry) => ({
    bindingKey: entry.bindingKey,
    entrySha256: sha256Json(entry),
  }));
  assert(sameJson(plan.bindingClassificationFingerprints, fingerprints), "Template-resolution classification fingerprints drifted");
  assert(new Set(plan.bindingClassifications.map((entry) => entry.bindingKey)).size === plan.bindingClassifications.length, "Template-resolution plan duplicates a binding");
  const nonBase = plan.bindingClassifications.filter((entry) => entry.classification !== BASE_CLASSIFICATION);
  assert(nonBase.length === EXPECTED_SCOPED_COUNTS.nonBaseBindings, "Scoped plan must contain exactly 522 non-base recoveries");
  assert(nonBase.every((entry) => entry.entryReviewState === "pending_review"), "Every non-base recovery must remain pending before promotion");
  assert(plan.bindingClassifications.filter((entry) => entry.classification === BASE_CLASSIFICATION).every((entry) => entry.entryReviewState === "base_audit_verified"), "Base entries must be independently audit verified");

  const filtered = plan.filteredCandidates || {};
  assert(filtered?.templateProjection?.withheldBindings === 0, "Arbitrary template exclusions are not allowed");
  assert(filtered?.compatibility?.withheldSelections === 0, "Arbitrary compatibility exclusions are not allowed");
  assert(filtered?.proposedPriceRows?.withheldRows === 0, "Arbitrary price-row exclusions are not allowed");
  assert(sameJson(filtered.candidateBindingKeys, plan.bindingClassifications.map((entry) => entry.bindingKey)), "Candidate binding coverage drifted");

  const scope = plan.catalogScope;
  assert(scope?.schemaVersion === 1 && scope?.rawSupplierEvidenceMutated === false, "Catalog scope is missing or mutates supplier evidence");
  assert(scope?.counts?.raw?.documentBindings === EXPECTED_SCOPED_COUNTS.rawBindings, "Raw catalog scope must retain 3,744 bindings");
  assert(scope?.counts?.proposed?.documentBindings === EXPECTED_SCOPED_COUNTS.proposedBindings, "Proposed catalog scope must contain 3,692 bindings");
  assert(scope?.counts?.excluded?.documentBindings === EXPECTED_SCOPED_COUNTS.excludedBindings, "Catalog scope must exclude exactly 52 CD bindings");
  assert(Array.isArray(scope.excludedModels) && scope.excludedModels.length === 1, "Catalog scope must contain one explicit model exclusion");
  assert(scope.excludedModels[0]?.modelKey === "cd-135x135--2-part-closure", "Only the explicitly reviewed CD-sized folder may be excluded");
  assert(scope.excludedModels[0]?.sourceEvidencePreserved === true, "Excluded CD source evidence must remain preserved");
  assert(plan.sourceScopeProjection?.rawBindingCount === EXPECTED_SCOPED_COUNTS.rawBindings, "Raw scope projection drifted");
  assert(plan.sourceScopeProjection?.proposedBindingCount === EXPECTED_SCOPED_COUNTS.proposedBindings, "Proposed scope projection drifted");
  assert(plan.sourceScopeProjection?.excludedBindingCount === EXPECTED_SCOPED_COUNTS.excludedBindings, "Excluded scope projection drifted");
  assert(plan.sourceScopeProjection?.rawSupplierEvidenceMutated === false, "Scope projection mutates raw supplier evidence");
  assert(!plan.bindingClassifications.some((entry) => entry.selectionKey?.includes("folder_model=cd-135x135--2-part-closure")), "CD-sized folder leaked into the proposed plan");
  assert(!canonicalJson(plan.extendedEvidence).includes("mappe_cd"), "CD-sized extended evidence leaked into the proposed plan");
  return { fingerprints, nonBase };
}

function validateExtendedPendingEvidence(plan) {
  const extended = plan.extendedEvidence;
  assert(extended?.kind === "wmd_sales_folder_extended_exact_evidence", "Unexpected extended-evidence kind");
  assert(extended?.schemaVersion === 1 && extended?.reviewState === "pending_review", "Extended evidence is not pending review");
  assert(extended?.titleSupplementSha256 === plan.inputEvidence.geometrySupplement.sha256, "Extended evidence is stale relative to the title supplement");
  assert(Array.isArray(extended.families) && extended.families.length === EXPECTED_SCOPED_COUNTS.extendedFamilies, "Extended evidence family scope drifted");
  const familyFingerprints = extended.families.map((family) => ({
    familyKey: family.familyKey,
    familySha256: sha256Json(family),
  }));
  assert(sameJson(extended.familyFingerprints, familyFingerprints), "Extended-evidence family fingerprints drifted");
  const targets = extended.families.flatMap((family) => family.targetEntries.map((target) => ({ family, target })));
  assert(targets.length === EXPECTED_SCOPED_COUNTS.extendedTargets, "Extended-evidence target scope drifted");
  assert(targets.every(({ target }) => target.entryReviewState === "pending_review"), "Every extended target must remain pending before promotion");
  const targetFingerprints = targets
    .map(({ target }) => ({ targetKey: target.targetKey, entrySha256: sha256Json(target) }))
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey, "en", { numeric: true }));
  assert(sameJson(extended.targetFingerprints, targetFingerprints), "Extended-evidence target fingerprints drifted");
  return { targets, familyFingerprints, targetFingerprints };
}

function buildApprovalScope(context) {
  for (const key of Object.keys(INPUT_PATHS)) validateArtifactRecord(context[key], key);
  const supplement = context.geometrySupplement.value;
  const renderManifest = context.renderManifest.value;
  const plan = context.resolutionPlan.value;
  const supplementEntries = supplementEntriesByHash(supplement);
  const renderPairs = renderPairsByEntryHash(renderManifest, context.geometrySupplement);
  const { fingerprints, nonBase } = validateScopedPendingPlan(plan);
  const extended = validateExtendedPendingEvidence(plan);
  assert(plan.inputEvidence?.geometrySupplement?.sha256 === context.geometrySupplement.evidence.sha256, "Template-resolution plan is stale relative to the geometry supplement");
  assert(plan.inputEvidence?.geometrySupplement?.bytes === context.geometrySupplement.evidence.bytes, "Template-resolution supplement byte count drifted");
  assert(supplement.baseAuditSha256 === plan.inputEvidence?.baseAudit?.sha256, "Geometry supplement and resolution plan pin different base audits");
  assert(renderManifest.counts?.supplementEntries === supplementEntries.size, "Render manifest supplement-entry count drifted");
  assert(renderManifest.counts?.uniquePairs === EXPECTED_SCOPED_COUNTS.renderPairs, "Render manifest must contain exactly 23 pairs");
  assert(renderPairs.size === supplementEntries.size, "Render manifest does not cover every exact supplement entry once");
  for (const hash of supplementEntries.keys()) assert(renderPairs.has(hash), "Render manifest omits a supplement entry", hash);

  const pendingArtifacts = Object.fromEntries(Object.keys(INPUT_PATHS).map((key) => [key, {
    path: context[key].evidence.path,
    sha256: context[key].evidence.sha256,
    bytes: context[key].evidence.bytes,
  }]));
  const titleSupplementEntries = sorted(supplementEntries.keys()).map((entrySha256) => {
    const pair = renderPairs.get(entrySha256);
    return {
      entrySha256,
      renderPairId: pair.pairId,
      sourceRenderSha256s: pair.sourceRender.outputs.map((output) => output.sha256),
      counterpartRenderSha256s: pair.counterpartRender.outputs.map((output) => output.sha256),
    };
  });
  const resolutionEntries = nonBase
    .map((entry) => {
      const fingerprint = fingerprints.find((candidate) => candidate.bindingKey === entry.bindingKey);
      return {
        bindingKey: entry.bindingKey,
        classification: entry.classification,
        entrySha256: fingerprint.entrySha256,
      };
    })
    .sort((left, right) => left.bindingKey.localeCompare(right.bindingKey, "en", { numeric: true }));
  const extendedEvidenceTargets = extended.targetFingerprints.map((entry) => ({ ...entry }));
  return {
    schemaVersion: 1,
    pendingArtifacts,
    counts: {
      rawBindings: EXPECTED_SCOPED_COUNTS.rawBindings,
      proposedBindings: plan.bindingClassifications.length,
      explicitlyExcludedCdBindings: EXPECTED_SCOPED_COUNTS.excludedBindings,
      baseAuditVerifiedBindings: plan.counts.baseVerifiedBindings,
      nonBaseRecoveryBindings: nonBase.length,
      titleSupplementEntries: titleSupplementEntries.length,
      titleSupplementCoveredBindings: supplement.counts.coveredBindingKeys,
      renderPairs: renderManifest.pairs.length,
      extendedEvidenceFamilies: plan.extendedEvidence.families.length,
      extendedEvidenceTargets: extendedEvidenceTargets.length,
    },
    catalogScope: {
      excludedModelKey: scopeModelKey(plan),
      excludedBindingCount: plan.sourceScopeProjection.excludedBindingCount,
      rawSupplierEvidenceMutated: plan.sourceScopeProjection.rawSupplierEvidenceMutated,
    },
    titleSupplementEntries,
    resolutionEntries,
    extendedEvidenceTargets,
  };
}

function scopeModelKey(plan) {
  return plan.catalogScope?.excludedModels?.[0]?.modelKey || "";
}

export function buildTemplateApprovalRequest(context) {
  const approvalScope = buildApprovalScope(context);
  return {
    kind: "wmd_sales_folder_template_approval_decision",
    schemaVersion: 1,
    reviewState: "pending_human_completion",
    action: "approve_all_exact_entries",
    approvalScopeSha256: sha256Json(approvalScope),
    approvalScope,
    reviewer: null,
    reviewedAt: null,
    humanAttestation: {
      confirmed: false,
      reviewer: null,
      reviewedAt: null,
      statement: HUMAN_ATTESTATION,
    },
    titleSupplementDecisions: approvalScope.titleSupplementEntries.map((entry) => ({
      ...entry,
      status: "pending",
      sourceHasWindowCut: null,
      counterpartHasWindowCut: null,
      reviewerNote: "",
    })),
    resolutionEntryDecisions: approvalScope.resolutionEntries.map((entry) => ({
      ...entry,
      status: "pending",
      reviewerNote: "",
    })),
    extendedEvidenceTargetDecisions: approvalScope.extendedEvidenceTargets.map((entry) => ({
      ...entry,
      status: "pending",
      reviewerNote: "",
    })),
    safetyBoundary: {
      completeExactCoverageRequired: true,
      partialApprovalAllowed: false,
      exclusionsAllowed: false,
      scriptMaySelfApprove: false,
      currentPendingArtifactsRemainUnchanged: true,
      localOnly: true,
      databaseWritesAuthorized: false,
      productOrPricingWritesAuthorized: false,
      publishingAuthorized: false,
    },
  };
}

function validateApprovalRequestArtifact(context, approvalRequestArtifact) {
  validateArtifactRecord(approvalRequestArtifact, "Approval request");
  assert(
    approvalRequestArtifact.evidence.path === DEFAULT_REQUEST_PATH,
    `Approval request must be the exact current ${DEFAULT_REQUEST_PATH}`
  );
  const expected = buildTemplateApprovalRequest(context);
  assert(
    sameJson(approvalRequestArtifact.value, expected),
    "Approval request is stale relative to the exact current pending artifacts"
  );
  assert(
    approvalRequestArtifact.value.reviewState === "pending_human_completion"
      && approvalRequestArtifact.value.reviewer === null
      && approvalRequestArtifact.value.reviewedAt === null
      && approvalRequestArtifact.value.humanAttestation?.confirmed === false,
    "Approval request is not a pristine pending human-review request"
  );
  return approvalRequestArtifact.evidence;
}

export function createDecisionFromExplicitLocalSanitizationApproval({
  context,
  approvalRequestArtifact,
  reviewer,
  reviewedAt,
}) {
  const requestEvidence = validateApprovalRequestArtifact(context, approvalRequestArtifact);
  reviewer = validateHumanReviewer(reviewer);
  reviewedAt = validateReviewedAt(reviewedAt);
  const decision = structuredClone(approvalRequestArtifact.value);
  decision.reviewState = "complete_user_directed_policy_authorization";
  decision.decisionMode = "user_directed_bulk_local_sanitization_policy";
  decision.reviewer = reviewer;
  decision.reviewedAt = reviewedAt;
  decision.approvalRequest = { ...requestEvidence };
  decision.authorizationBoundary = structuredClone(LOCAL_SANITIZATION_AUTHORIZATION);
  decision.bulkAuthorization = {
    confirmed: true,
    authorizedBy: reviewer,
    authorizedAt: reviewedAt,
    attestation: LOCAL_SANITIZATION_ATTESTATION,
    userInstructionEvidence: structuredClone(USER_INSTRUCTION_EVIDENCE),
    deterministicFullCoverageRequired: true,
    individualJsonEntryReviewClaimed: false,
    downstreamSanitizedPdfOutputQaRequired: true,
  };
  decision.titleSupplementDecisions = decision.titleSupplementDecisions.map((entry) => ({
    ...entry,
    status: "authorized_for_local_sanitization",
    sourceHasWindowCut: false,
    counterpartHasWindowCut: true,
    reviewerNote: `Brugerens synlige review og bulkpolitik dækker lokal sanitering for ${entry.renderPairId}; de eksakte renderhashes er fastlåst. Dette er ikke en påstand om individuel JSON-inspektion, og efterfølgende PDF-output-QA er påkrævet.`,
  }));
  decision.resolutionEntryDecisions = decision.resolutionEntryDecisions.map((entry) => ({
    ...entry,
    status: "authorized_for_local_sanitization",
    reviewerNote: `Brugerens bulkpolitik autoriserer den mekanisk fuldt dækkede ${entry.classification}-binding til lokal PDF-sanitering. Individuel JSON-inspektion hævdes ikke; efterfølgende PDF-output-QA er påkrævet.`,
  }));
  decision.extendedEvidenceTargetDecisions = decision.extendedEvidenceTargetDecisions.map((entry) => ({
    ...entry,
    status: "authorized_for_local_sanitization",
    reviewerNote: "Brugerens bulkpolitik autoriserer det mekanisk fastlåste mål og dets underliggende beviser til lokal PDF-sanitering. Individuel JSON-inspektion hævdes ikke; uændret geometri og efterfølgende PDF-output-QA er påkrævet.",
  }));
  return decision;
}

function exactDecisionMap(decisions, expected, keyOf, label) {
  assert(Array.isArray(decisions), `${label} must be an array`);
  assert(decisions.length === expected.length, `${label} is partial or contains arbitrary additions`, {
    expected: expected.length,
    actual: decisions.length,
  });
  const expectedByKey = new Map(expected.map((entry) => [keyOf(entry), entry]));
  assert(expectedByKey.size === expected.length, `${label} expected scope contains duplicate identities`);
  const actualByKey = new Map();
  for (const entry of decisions) {
    const key = keyOf(entry);
    assert(key && expectedByKey.has(key), `${label} contains an unknown or excluded entry`, key);
    assert(!actualByKey.has(key), `${label} duplicates an entry`, key);
    actualByKey.set(key, entry);
  }
  assert(actualByKey.size === expectedByKey.size, `${label} does not cover the exact scope`);
  return { expectedByKey, actualByKey };
}

function validateApprovalDecision(context, decision, approvalRequestArtifact) {
  const baseKeys = [
    "kind", "schemaVersion", "reviewState", "action", "approvalScopeSha256",
    "approvalScope", "reviewer", "reviewedAt", "humanAttestation",
    "titleSupplementDecisions", "resolutionEntryDecisions",
    "extendedEvidenceTargetDecisions", "safetyBoundary",
  ];
  const bulkMode = decision?.decisionMode === "user_directed_bulk_local_sanitization_policy";
  exactKeys(
    decision,
    bulkMode
      ? [...baseKeys, "decisionMode", "approvalRequest", "authorizationBoundary", "bulkAuthorization"]
      : baseKeys,
    "Approval decision"
  );
  assert(decision.kind === "wmd_sales_folder_template_approval_decision" && decision.schemaVersion === 1, "Unsupported approval decision kind or schemaVersion");
  assert(
    decision.reviewState === (bulkMode
      ? "complete_user_directed_policy_authorization"
      : "complete_human_review"),
    "Approval decision is still pending or has an unsupported state"
  );
  assert(decision.action === "approve_all_exact_entries", "Only complete exact approval is supported; exclusions are refused");
  const expectedScope = buildApprovalScope(context);
  assert(validSha256(decision.approvalScopeSha256, "Approval-scope SHA-256") === sha256Json(expectedScope), "Approval decision is stale relative to the current pending artifacts");
  assert(sameJson(decision.approvalScope, expectedScope), "Approval decision scope differs from the current exact scope");
  const reviewer = validateHumanReviewer(decision.reviewer);
  const reviewedAt = validateReviewedAt(decision.reviewedAt);
  exactKeys(decision.humanAttestation, ["confirmed", "reviewer", "reviewedAt", "statement"], "Human attestation");
  if (bulkMode) {
    const requestEvidence = validateApprovalRequestArtifact(context, approvalRequestArtifact);
    exactKeys(decision.approvalRequest, ["path", "sha256", "bytes"], "Approval-request pin");
    assert(sameJson(decision.approvalRequest, requestEvidence), "Approval decision does not pin the exact current pending request SHA-256 and bytes");
    assert(
      sameJson(decision.authorizationBoundary, LOCAL_SANITIZATION_AUTHORIZATION),
      "Approval decision is broader than local PDF template sanitization or weakens the explicit no-write boundary"
    );
    exactKeys(decision.bulkAuthorization, [
      "confirmed", "authorizedBy", "authorizedAt", "attestation",
      "userInstructionEvidence", "deterministicFullCoverageRequired",
      "individualJsonEntryReviewClaimed", "downstreamSanitizedPdfOutputQaRequired",
    ], "Bulk authorization");
    assert(decision.bulkAuthorization.confirmed === true, "Bulk authorization is not confirmed");
    assert(decision.bulkAuthorization.authorizedBy === reviewer, "Bulk authorization identity differs from the user approval identity");
    assert(decision.bulkAuthorization.authorizedAt === reviewedAt, "Bulk authorization time differs from the user approval time");
    assert(decision.bulkAuthorization.attestation === LOCAL_SANITIZATION_ATTESTATION, "Local-only bulk attestation was weakened or forged");
    assert(sameJson(decision.bulkAuthorization.userInstructionEvidence, USER_INSTRUCTION_EVIDENCE), "Pinned user-instruction quotes or hashes drifted");
    assert(decision.bulkAuthorization.deterministicFullCoverageRequired === true, "Bulk authorization does not require deterministic full coverage");
    assert(decision.bulkAuthorization.individualJsonEntryReviewClaimed === false, "Bulk authorization falsely claims individual JSON-entry review");
    assert(decision.bulkAuthorization.downstreamSanitizedPdfOutputQaRequired === true, "Bulk authorization does not require downstream sanitized-PDF output QA");
    assert(
      sameJson(decision.humanAttestation, buildTemplateApprovalRequest(context).humanAttestation),
      "Bulk authorization must not claim that the user personally reviewed every exact JSON entry"
    );
  } else {
    assert(decision.humanAttestation.confirmed === true, "Human attestation is not confirmed");
    assert(decision.humanAttestation.reviewer === reviewer, "Attestation reviewer differs from the approval reviewer");
    assert(decision.humanAttestation.reviewedAt === reviewedAt, "Attestation time differs from the approval time");
    assert(decision.humanAttestation.statement === HUMAN_ATTESTATION, "Human attestation statement was weakened or forged");
  }
  assert(sameJson(decision.safetyBoundary, buildTemplateApprovalRequest(context).safetyBoundary), "Approval decision weakens the safety boundary");

  const title = exactDecisionMap(
    decision.titleSupplementDecisions,
    expectedScope.titleSupplementEntries,
    (entry) => entry.entrySha256,
    "Title-supplement decisions"
  );
  for (const [entrySha256, expected] of title.expectedByKey) {
    const actual = exactKeys(title.actualByKey.get(entrySha256), [
      "entrySha256", "renderPairId", "sourceRenderSha256s", "counterpartRenderSha256s",
      "status", "sourceHasWindowCut", "counterpartHasWindowCut", "reviewerNote",
    ], "Title-supplement decision");
    const expectedStatus = bulkMode ? "authorized_for_local_sanitization" : "passed";
    assert(actual.status === expectedStatus, `Every title-supplement entry must have status=${expectedStatus}`, entrySha256);
    assert(actual.renderPairId === expected.renderPairId, "Title-supplement render-pair identity drifted", entrySha256);
    assert(sameJson(actual.sourceRenderSha256s, expected.sourceRenderSha256s), "Title-supplement source render hashes drifted", entrySha256);
    assert(sameJson(actual.counterpartRenderSha256s, expected.counterpartRenderSha256s), "Title-supplement counterpart render hashes drifted", entrySha256);
    assert(actual.sourceHasWindowCut === false && actual.counterpartHasWindowCut === true, "Rendered review must explicitly confirm no source window cut and a counterpart window cut", entrySha256);
    nonEmptyReviewNote(actual.reviewerNote, `Title-supplement reviewer note ${entrySha256}`);
  }

  const resolution = exactDecisionMap(
    decision.resolutionEntryDecisions,
    expectedScope.resolutionEntries,
    (entry) => `${entry.bindingKey}|${entry.entrySha256}`,
    "Resolution-entry decisions"
  );
  for (const [key, expected] of resolution.expectedByKey) {
    const actual = exactKeys(resolution.actualByKey.get(key), [
      "bindingKey", "classification", "entrySha256", "status", "reviewerNote",
    ], "Resolution-entry decision");
    assert(actual.classification === expected.classification, "Resolution-entry classification drifted", key);
    const expectedStatus = bulkMode ? "authorized_for_local_sanitization" : "approved";
    assert(actual.status === expectedStatus, "Every exact non-base resolution entry must be authorized without exclusions", key);
    nonEmptyReviewNote(actual.reviewerNote, `Resolution-entry reviewer note ${expected.bindingKey}`);
  }

  const targets = exactDecisionMap(
    decision.extendedEvidenceTargetDecisions,
    expectedScope.extendedEvidenceTargets,
    (entry) => `${entry.targetKey}|${entry.entrySha256}`,
    "Extended-evidence target decisions"
  );
  for (const [key] of targets.expectedByKey) {
    const actual = exactKeys(targets.actualByKey.get(key), [
      "targetKey", "entrySha256", "status", "reviewerNote",
    ], "Extended-evidence target decision");
    const expectedStatus = bulkMode ? "authorized_for_local_sanitization" : "approved";
    assert(actual.status === expectedStatus, "Every nested extended-evidence target must be authorized without exclusions", key);
    nonEmptyReviewNote(actual.reviewerNote, `Extended-evidence reviewer note ${actual.targetKey}`);
  }
  if (bulkMode) {
    const expectedBulkDecision = createDecisionFromExplicitLocalSanitizationApproval({
      context,
      approvalRequestArtifact,
      reviewer,
      reviewedAt,
    });
    assert(sameJson(decision, expectedBulkDecision), "Bulk-policy decision differs from deterministic full-coverage generation");
  }
  return {
    expectedScope,
    reviewer,
    reviewedAt,
    title,
    resolution,
    targets,
    decisionMode: bulkMode ? decision.decisionMode : "exact_entry_human_review",
    downstreamSanitizedPdfOutputQaRequired: bulkMode,
  };
}

function buildApprovedSupplement(context, validated) {
  const pending = context.geometrySupplement.value;
  const selectionByOldHash = new Map(
    (pending.counterpartSelectionEvidence || []).map((entry) => [entry.entrySha256, entry])
  );
  const approvedItems = pending.entries.map((entry) => {
    const oldHash = sha256Json(entry);
    const decision = validated.title.actualByKey.get(oldHash);
    assert(decision, "Approved supplement is missing a reviewed entry", oldHash);
    const approvedEntry = structuredClone(entry);
    approvedEntry.renderedReviewEvidence = {
      status: "passed",
      sourceRenderSha256s: [...decision.sourceRenderSha256s],
      counterpartRenderSha256s: [...decision.counterpartRenderSha256s],
      sourceHasWindowCut: false,
      counterpartHasWindowCut: true,
      reviewerNote: decision.reviewerNote,
    };
    const newHash = sha256Json(approvedEntry);
    return { oldHash, newHash, entry: approvedEntry };
  }).sort((left, right) => left.newHash.localeCompare(right.newHash, "en"));
  const entryHashMap = new Map(approvedItems.map((item) => [item.oldHash, item.newHash]));
  const approved = structuredClone(pending);
  approved.reviewState = "approved_title_only_construction_text_error";
  approved.reviewer = validated.reviewer;
  approved.reviewedAt = validated.reviewedAt;
  approved.entries = approvedItems.map((item) => item.entry);
  approved.entryFingerprints = approvedItems.map((item) => ({
    entrySha256: item.newHash,
    sourceTemplateSha256: item.entry.sourceTemplateSha256,
    expectedGeometry: item.entry.expectedGeometry,
    finishKey: item.entry.finishKey,
    coveredBindingCount: item.entry.coveredBindingKeys.length,
  }));
  approved.counterpartSelectionEvidence = approvedItems.map((item) => {
    const selection = selectionByOldHash.get(item.oldHash);
    assert(selection, "Geometry supplement selection evidence is missing", item.oldHash);
    return { ...selection, entrySha256: item.newHash };
  });
  approved.counts = {
    ...approved.counts,
    pendingRenderedReviewEntries: 0,
  };
  assert(approved.entryFingerprints.every((fingerprint, index) => fingerprint.entrySha256 === sha256Json(approved.entries[index])), "Approved supplement fingerprint regeneration failed");
  return { approved, entryHashMap };
}

function buildApprovedExtendedEvidence(pendingExtended, approvedSupplementSha256, validated) {
  const targetHashMap = new Map();
  const familyHashMap = new Map();
  const oldFamilyHashes = new Map(
    pendingExtended.familyFingerprints.map((entry) => [entry.familyKey, entry.familySha256])
  );
  const families = pendingExtended.families.map((family) => {
    const approvedFamily = structuredClone(family);
    approvedFamily.targetEntries = family.targetEntries.map((target) => {
      const oldHash = sha256Json(target);
      const key = `${target.targetKey}|${oldHash}`;
      assert(validated.targets.actualByKey.has(key), "Extended target lacks an exact human decision", key);
      const approvedTarget = { ...structuredClone(target), entryReviewState: "approved" };
      targetHashMap.set(oldHash, sha256Json(approvedTarget));
      return approvedTarget;
    });
    const oldFamilyHash = oldFamilyHashes.get(family.familyKey);
    assert(oldFamilyHash === sha256Json(family), "Pending extended family hash drifted", family.familyKey);
    familyHashMap.set(oldFamilyHash, sha256Json(approvedFamily));
    return approvedFamily;
  });
  const approved = {
    ...structuredClone(pendingExtended),
    reviewState: "approved",
    titleSupplementSha256: approvedSupplementSha256,
    families,
  };
  approved.familyFingerprints = families.map((family) => ({
    familyKey: family.familyKey,
    familySha256: sha256Json(family),
  }));
  approved.targetFingerprints = families
    .flatMap((family) => family.targetEntries.map((target) => ({
      targetKey: target.targetKey,
      entrySha256: sha256Json(target),
    })))
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey, "en", { numeric: true }));
  return { approved, targetHashMap, familyHashMap };
}

function approvedResolutionFacts(record, approvedSupplementState) {
  const facts = structuredClone(record.evidence.resolutionFacts);
  if (["pending_title_only", "indirect_pending_title_rebind"].includes(record.classification)) {
    facts.geometryAxesVerified = true;
    facts.sourceGeometryVerified = true;
    facts.supplementReviewState = approvedSupplementState;
    facts.renderedReviewStatus = "passed";
  }
  return facts;
}

function approvedReason(record) {
  if (record.classification === "pending_title_only") return "approved_title_only_construction_text_error";
  if (record.classification === "indirect_pending_title_rebind") return "approved_indirect_title_only_rebind";
  if (record.classification === "extended_exact_evidence") {
    return `approved_extended_exact_evidence:${record.evidence.resolutionFacts.extendedFamilyKey}`;
  }
  return record.reason;
}

function buildApprovedPlan(context, validated, approvedSupplementArtifact, supplementHashMap) {
  const pending = context.resolutionPlan.value;
  const extendedResult = buildApprovedExtendedEvidence(
    pending.extendedEvidence,
    approvedSupplementArtifact.evidence.sha256,
    validated
  );
  const pendingFingerprintByBinding = new Map(
    pending.bindingClassificationFingerprints.map((entry) => [entry.bindingKey, entry.entrySha256])
  );
  const classifications = pending.bindingClassifications.map((record) => {
    const oldHash = sha256Json(record);
    assert(pendingFingerprintByBinding.get(record.bindingKey) === oldHash, "Pending plan classification fingerprint drifted", record.bindingKey);
    if (record.classification !== BASE_CLASSIFICATION) {
      const decisionKey = `${record.bindingKey}|${oldHash}`;
      assert(validated.resolution.actualByKey.has(decisionKey), "Non-base classification lacks an exact human decision", record.bindingKey);
    }
    const approved = structuredClone(record);
    approved.entryReviewState = "approved";
    approved.reason = approvedReason(record);
    const dependencies = approved.evidence.dependencies;
    if (dependencies.titleSupplementEntrySha256s.length > 0) {
      dependencies.titleSupplementReportSha256 = approvedSupplementArtifact.evidence.sha256;
      dependencies.titleSupplementEntrySha256s = dependencies.titleSupplementEntrySha256s.map((hash) => {
        const mapped = supplementHashMap.get(hash);
        assert(mapped, "Resolution entry pins a stale or unknown supplement entry", record.bindingKey);
        return mapped;
      }).sort();
    }
    if (dependencies.extendedEvidenceTargetSha256 !== null) {
      const mapped = extendedResult.targetHashMap.get(dependencies.extendedEvidenceTargetSha256);
      assert(mapped, "Resolution entry pins a stale extended target", record.bindingKey);
      dependencies.extendedEvidenceTargetSha256 = mapped;
    }
    if (dependencies.extendedEvidenceFamilySha256 !== null) {
      const mapped = extendedResult.familyHashMap.get(dependencies.extendedEvidenceFamilySha256);
      assert(mapped, "Resolution entry pins a stale extended family", record.bindingKey);
      dependencies.extendedEvidenceFamilySha256 = mapped;
    }
    approved.evidence.resolutionFacts = approvedResolutionFacts(
      record,
      "approved_title_only_construction_text_error"
    );
    return approved;
  });
  const fingerprints = classifications.map((entry) => ({
    bindingKey: entry.bindingKey,
    entrySha256: sha256Json(entry),
  }));
  const approved = structuredClone(pending);
  approved.reviewState = "approved";
  approved.approval = {
    approved: true,
    reviewer: validated.reviewer,
    reviewedAt: validated.reviewedAt,
  };
  approved.approvalContract = {
    ...approved.approvalContract,
    currentArtifactMayAuthorizeSanitization: true,
  };
  approved.inputEvidence.geometrySupplement = { ...approvedSupplementArtifact.evidence };
  approved.extendedEvidence = extendedResult.approved;
  approved.bindingClassifications = classifications;
  approved.bindingClassificationFingerprints = fingerprints;
  approved.approvedEntryHashes = fingerprints.map((entry) => entry.entrySha256);
  approved.counts = {
    ...approved.counts,
    recoveredBindingsPendingReview: 0,
  };
  approved.filteredCandidates = {
    ...approved.filteredCandidates,
    policy: "all_bindings_hash_pinned_and_approved_after_complete_human_review",
    pendingReviewBoundary: {
      candidateDoesNotMeanApproved: false,
      nonBaseRecoveryBindingsPendingReview: 0,
      titleOnlyBindingsPendingReview: 0,
      indirectRebindBindingsPendingTitleOnlyDependency: 0,
      extendedEvidenceBindingsPendingReview: 0,
    },
  };
  approved.nextGate = validated.downstreamSanitizedPdfOutputQaRequired
    ? "approved_for_hash_pinned_local_sanitization_execution_only; every_sanitized_pdf_requires_downstream_output_qa; no_database_product_pricing_storage_upload_or_publication_write_authorized"
    : "approved_artifact_may_authorize_hash_pinned_local_sanitization_contracts_only; no_database_product_pricing_storage_or_publication_write_authorized";
  assert(approved.bindingClassifications.every((entry) => entry.entryReviewState === "approved"), "Approved plan still has a pending entry");
  assert(sameJson(approved.bindingClassificationFingerprints, approved.bindingClassifications.map((entry) => ({ bindingKey: entry.bindingKey, entrySha256: sha256Json(entry) }))), "Approved plan fingerprint regeneration failed");
  assert(sameJson(approved.approvedEntryHashes, approved.bindingClassificationFingerprints.map((entry) => entry.entrySha256)), "Approved-entry hash regeneration failed");
  return approved;
}

export function promoteTemplateApproval({
  context,
  decision,
  approvalRequestArtifact,
  approvedDirectoryRelativePath = DEFAULT_APPROVED_DIRECTORY,
  decisionEvidence = null,
}) {
  const approvedDirectory = safeRelativePath(approvedDirectoryRelativePath, "Approved output directory", "review/").replace(/\/$/u, "");
  assert(approvedDirectory !== "review", "Approved output directory must not overwrite the pending review directory");
  assert(!Object.values(INPUT_PATHS).some((input) => input.startsWith(`${approvedDirectory}/`)), "Approved output directory overlaps pending inputs");
  const validated = validateApprovalDecision(context, decision, approvalRequestArtifact);
  const supplementResult = buildApprovedSupplement(context, validated);
  const approvedSupplementBytes = prettyJsonBytes(supplementResult.approved);
  const approvedSupplementRelativePath = `${approvedDirectory}/template-geometry-supplement.json`;
  const approvedSupplementArtifact = {
    value: supplementResult.approved,
    bytes: approvedSupplementBytes,
    evidence: {
      path: approvedSupplementRelativePath,
      sha256: sha256Bytes(approvedSupplementBytes),
      bytes: approvedSupplementBytes.length,
    },
  };
  const approvedPlan = buildApprovedPlan(
    context,
    validated,
    approvedSupplementArtifact,
    supplementResult.entryHashMap
  );
  const approvedPlanBytes = prettyJsonBytes(approvedPlan);
  const approvedPlanArtifact = {
    value: approvedPlan,
    bytes: approvedPlanBytes,
    evidence: {
      path: `${approvedDirectory}/template-resolution-plan.json`,
      sha256: sha256Bytes(approvedPlanBytes),
      bytes: approvedPlanBytes.length,
    },
  };
  const normalizedDecisionEvidence = decisionEvidence || {
    path: null,
    sha256: sha256Bytes(prettyJsonBytes(decision)),
    bytes: prettyJsonBytes(decision).length,
  };
  validSha256(normalizedDecisionEvidence.sha256, "Approval decision SHA-256");
  assert(Number.isInteger(normalizedDecisionEvidence.bytes) && normalizedDecisionEvidence.bytes > 0, "Approval decision byte count is invalid");
  const manifest = {
    kind: "wmd_sales_folder_template_approval_promotion",
    schemaVersion: 1,
    reviewState: "approved",
    approval: {
      reviewer: validated.reviewer,
      reviewedAt: validated.reviewedAt,
      decisionMode: validated.decisionMode,
      individualJsonEntryReviewClaimed: !validated.downstreamSanitizedPdfOutputQaRequired,
      downstreamSanitizedPdfOutputQaRequired: validated.downstreamSanitizedPdfOutputQaRequired,
      decision: normalizedDecisionEvidence,
    },
    authorizationBoundary: validated.downstreamSanitizedPdfOutputQaRequired
      ? structuredClone(LOCAL_SANITIZATION_AUTHORIZATION)
      : null,
    generator: {
      script: SCRIPT_PATH,
      schemaVersion: 1,
      deterministicForIdenticalInputs: true,
    },
    pendingInputs: validated.expectedScope.pendingArtifacts,
    approvedOutputs: {
      geometrySupplement: approvedSupplementArtifact.evidence,
      resolutionPlan: approvedPlanArtifact.evidence,
    },
    counts: validated.expectedScope.counts,
    approvalContract: approvedPlan.approvalContract,
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
  const manifestBytes = prettyJsonBytes(manifest);
  return {
    approvedSupplement: approvedSupplementArtifact,
    approvedPlan: approvedPlanArtifact,
    manifest: {
      value: manifest,
      bytes: manifestBytes,
      evidence: {
        path: `${approvedDirectory}/promotion-manifest.json`,
        sha256: sha256Bytes(manifestBytes),
        bytes: manifestBytes.length,
      },
    },
  };
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let bytes = 0;
    const input = createReadStream(filePath);
    input.on("data", (chunk) => {
      bytes += chunk.length;
      hash.update(chunk);
    });
    input.on("error", reject);
    input.on("end", () => resolve({ sha256: hash.digest("hex"), bytes }));
  });
}

function pathWithin(runDirectory, relativePath, label) {
  const resolvedRun = path.resolve(runDirectory);
  const resolved = path.resolve(resolvedRun, safeRelativePath(relativePath, label));
  assert(resolved.startsWith(`${resolvedRun}${path.sep}`), `${label} escapes the run directory`);
  return resolved;
}

async function assertRegularNonSymlink(filePath, runDirectory, label) {
  const stat = await fs.lstat(filePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  const [realFile, realRun] = await Promise.all([fs.realpath(filePath), fs.realpath(runDirectory)]);
  assert(realFile.startsWith(`${realRun}${path.sep}`), `${label} resolves outside the run directory`);
}

async function readJsonArtifact(runDirectory, relativePath, label) {
  const normalized = safeRelativePath(relativePath, `${label} path`, "review/");
  const filePath = pathWithin(runDirectory, normalized, `${label} path`);
  await assertRegularNonSymlink(filePath, runDirectory, label);
  const bytes = await fs.readFile(filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new TemplateApprovalPromotionError(`${label} is not valid JSON: ${error.message}`);
  }
  return {
    value,
    bytes,
    absolutePath: filePath,
    evidence: { path: normalized, sha256: sha256Bytes(bytes), bytes: bytes.length },
  };
}

async function verifySidecar(artifact, label) {
  const sidecarPath = `${artifact.absolutePath}.sha256`;
  await assertRegularNonSymlink(sidecarPath, path.dirname(path.dirname(artifact.absolutePath)), `${label} sidecar`);
  const sidecar = await fs.readFile(sidecarPath, "utf8");
  assert(sidecar === `${artifact.evidence.sha256}  ${path.basename(artifact.absolutePath)}\n`, `${label} SHA-256 sidecar drifted`);
}

async function verifyPlanEvidence(runDirectory, plan) {
  const records = [
    plan.inputEvidence.baseAudit,
    plan.inputEvidence.geometrySupplement,
    plan.inputEvidence.templateProjectionStubs,
    plan.inputEvidence.proposedCompatibility,
    plan.inputEvidence.proposedPriceRows,
    ...(plan.inputEvidence.extendedEvidenceFiles || []),
  ];
  for (const evidence of records) {
    const relativePath = safeRelativePath(evidence?.path, "Plan input evidence path");
    const absolutePath = pathWithin(runDirectory, relativePath, "Plan input evidence path");
    await assertRegularNonSymlink(absolutePath, runDirectory, "Plan input evidence");
    const actual = await hashFile(absolutePath);
    assert(actual.bytes === evidence.bytes, "Plan input evidence byte count changed", relativePath);
    assert(actual.sha256 === evidence.sha256, "Plan input evidence SHA-256 changed", relativePath);
  }
}

async function verifyRenderFiles(runDirectory, renderArtifact) {
  const manifest = renderArtifact.value;
  const renderDirectory = path.dirname(renderArtifact.absolutePath);
  for (const pair of manifest.pairs || []) {
    for (const side of ["sourceRender", "counterpartRender"]) {
      const input = pair[side]?.input;
      const inputPath = pathWithin(runDirectory, input.relativePath, "Render input path");
      await assertRegularNonSymlink(inputPath, runDirectory, "Render input PDF");
      const inputActual = await hashFile(inputPath);
      assert(inputActual.sha256 === input.sha256 && inputActual.bytes === input.bytes, "Render input PDF changed", input.relativePath);
      for (const output of pair[side].outputs || []) {
        const relative = safeRelativePath(output.relativePath, "Render output path");
        const outputPath = path.resolve(renderDirectory, relative);
        assert(outputPath.startsWith(`${renderDirectory}${path.sep}`), "Render output escapes its directory");
        await assertRegularNonSymlink(outputPath, runDirectory, "Render output");
        const actual = await hashFile(outputPath);
        assert(actual.sha256 === output.sha256 && actual.bytes === output.bytes, "Rendered PNG changed", output.relativePath);
      }
    }
  }
  const checksumPath = path.join(renderDirectory, "checksums.sha256");
  await assertRegularNonSymlink(checksumPath, runDirectory, "Render checksum manifest");
  const lines = (await fs.readFile(checksumPath, "utf8")).trim().split("\n");
  const checksumByPath = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
    assert(match, "Render checksum manifest contains an invalid line");
    assert(!checksumByPath.has(match[2]), "Render checksum manifest duplicates a path", match[2]);
    checksumByPath.set(match[2], match[1]);
  }
  assert(checksumByPath.get("render-manifest.json") === renderArtifact.evidence.sha256, "Render manifest checksum sidecar drifted");
}

export async function loadCurrentApprovalContext({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  verifyRegeneration = true,
} = {}) {
  const resolvedRun = path.resolve(runDirectory);
  const stat = await fs.lstat(resolvedRun);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), "Run directory must be a real non-symlink directory");
  const [geometrySupplement, renderManifest, resolutionPlan] = await Promise.all([
    readJsonArtifact(resolvedRun, INPUT_PATHS.geometrySupplement, "Geometry supplement"),
    readJsonArtifact(resolvedRun, INPUT_PATHS.renderManifest, "Render manifest"),
    readJsonArtifact(resolvedRun, INPUT_PATHS.resolutionPlan, "Template-resolution plan"),
  ]);
  await Promise.all([
    verifySidecar(geometrySupplement, "Geometry supplement"),
    verifySidecar(resolutionPlan, "Template-resolution plan"),
    verifyPlanEvidence(resolvedRun, resolutionPlan.value),
    verifyRenderFiles(resolvedRun, renderManifest),
  ]);
  const context = { geometrySupplement, renderManifest, resolutionPlan };
  buildApprovalScope(context);
  if (verifyRegeneration) {
    const regenerated = await generateTemplateResolutionPlan({
      runDirectory: resolvedRun,
      writeOutput: false,
    });
    assert(regenerated.outputSha256 === resolutionPlan.evidence.sha256, "Current template-resolution plan is stale and must be regenerated before an approval request is created");
    assert(sameJson(regenerated.plan, resolutionPlan.value), "Current template-resolution plan differs from deterministic regeneration");
  }
  return context;
}

async function readDecision(runDirectory, relativePath) {
  const artifact = await readJsonArtifact(runDirectory, relativePath, "Approval decision");
  return artifact;
}

async function readApprovalRequest(runDirectory) {
  const artifact = await readJsonArtifact(runDirectory, DEFAULT_REQUEST_PATH, "Approval request");
  await verifySidecar(artifact, "Approval request");
  return artifact;
}

async function atomicWriteNew(filePath, bytes) {
  await fs.writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
}

async function writeRequest(runDirectory, relativePath, request) {
  const outputPath = pathWithin(runDirectory, safeRelativePath(relativePath, "Approval request path", "review/"), "Approval request path");
  const bytes = prettyJsonBytes(request);
  await atomicWriteNew(outputPath, bytes);
  await atomicWriteNew(`${outputPath}.sha256`, Buffer.from(`${sha256Bytes(bytes)}  ${path.basename(outputPath)}\n`, "utf8"));
  return { path: outputPath, sha256: sha256Bytes(bytes), bytes: bytes.length };
}

async function writeApprovedPackage(runDirectory, relativeDirectory, promoted) {
  const normalized = safeRelativePath(relativeDirectory, "Approved package directory", "review/").replace(/\/$/u, "");
  const target = pathWithin(runDirectory, normalized, "Approved package directory");
  const parent = path.dirname(target);
  const temporary = path.join(parent, `.${path.basename(target)}.tmp-${process.pid}`);
  await fs.lstat(target).then(
    () => {
      throw new TemplateApprovalPromotionError(`Approved package output already exists; refusing to overwrite: ${normalized}`);
    },
    (error) => {
      if (error?.code !== "ENOENT") throw error;
    }
  );
  await fs.mkdir(temporary, { recursive: false, mode: 0o700 });
  let complete = false;
  try {
    for (const artifact of [promoted.approvedSupplement, promoted.approvedPlan, promoted.manifest]) {
      const name = path.basename(artifact.evidence.path);
      await atomicWriteNew(path.join(temporary, name), artifact.bytes);
      await atomicWriteNew(
        path.join(temporary, `${name}.sha256`),
        Buffer.from(`${artifact.evidence.sha256}  ${name}\n`, "utf8")
      );
    }
    await fs.rename(temporary, target);
    complete = true;
  } finally {
    if (!complete) await fs.rm(temporary, { recursive: true, force: true });
  }
  return target;
}

function parseArguments(argv) {
  const args = {
    mode: null,
    runDirectory: DEFAULT_RUN_DIRECTORY,
    requestPath: DEFAULT_REQUEST_PATH,
    decisionPath: DEFAULT_DECISION_PATH,
    approvedDirectory: DEFAULT_APPROVED_DIRECTORY,
    reviewer: null,
    reviewedAt: null,
    authorization: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["request", "record", "validate", "promote"].includes(argument) && args.mode === null) args.mode = argument;
    else if (argument === "--run-dir") args.runDirectory = argv[++index];
    else if (argument === "--output") args.requestPath = argv[++index];
    else if (argument === "--decision") args.decisionPath = argv[++index];
    else if (argument === "--approved-dir") args.approvedDirectory = argv[++index];
    else if (argument === "--reviewer") args.reviewer = argv[++index];
    else if (argument === "--reviewed-at") args.reviewedAt = argv[++index];
    else if (argument === "--authorization") args.authorization = argv[++index];
    else throw new TemplateApprovalPromotionError(`Unknown argument: ${argument}`);
  }
  assert(args.mode, "Mode is required: request, record, validate, or promote");
  if (args.mode === "record") {
    assert(args.reviewer, "record requires --reviewer");
    assert(args.reviewedAt, "record requires --reviewed-at");
    assert(
      args.authorization === "local-pdf-template-sanitization-only",
      "record requires the exact --authorization local-pdf-template-sanitization-only boundary"
    );
  }
  return args;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const context = await loadCurrentApprovalContext({ runDirectory: args.runDirectory });
  if (args.mode === "request") {
    const request = buildTemplateApprovalRequest(context);
    const result = await writeRequest(args.runDirectory, args.requestPath, request);
    process.stdout.write(`${JSON.stringify({
      state: request.reviewState,
      approvalRecorded: false,
      output: result,
      counts: request.approvalScope.counts,
      prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
    }, null, 2)}\n`);
    return;
  }
  const approvalRequestArtifact = await readApprovalRequest(args.runDirectory);
  if (args.mode === "record") {
    const decision = createDecisionFromExplicitLocalSanitizationApproval({
      context,
      approvalRequestArtifact,
      reviewer: args.reviewer,
      reviewedAt: args.reviewedAt,
    });
    const result = await writeRequest(args.runDirectory, args.decisionPath, decision);
    process.stdout.write(`${JSON.stringify({
      state: decision.reviewState,
      authorizationBoundary: decision.authorizationBoundary,
      approvalRequest: decision.approvalRequest,
      output: result,
      counts: decision.approvalScope.counts,
      promotionPerformed: false,
      prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
    }, null, 2)}\n`);
    return;
  }
  const decisionArtifact = await readDecision(args.runDirectory, args.decisionPath);
  const promoted = promoteTemplateApproval({
    context,
    decision: decisionArtifact.value,
    approvalRequestArtifact,
    approvedDirectoryRelativePath: args.approvedDirectory,
    decisionEvidence: decisionArtifact.evidence,
  });
  if (args.mode === "promote") {
    const outputDirectory = await writeApprovedPackage(args.runDirectory, args.approvedDirectory, promoted);
    process.stdout.write(`${JSON.stringify({
      state: "approved",
      outputDirectory,
      outputs: promoted.manifest.value.approvedOutputs,
      approvalContract: promoted.approvedPlan.value.approvalContract,
      prohibitedActionsPerformed: promoted.manifest.value.prohibitedActionsPerformed,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    state: promoted.manifest.value.approval.decisionMode === "user_directed_bulk_local_sanitization_policy"
      ? "valid_complete_user_directed_policy_authorization"
      : "valid_complete_human_decision",
    wroteApprovedArtifacts: false,
    wouldWrite: promoted.manifest.value.approvedOutputs,
    approvalContract: promoted.approvedPlan.value.approvalContract,
    prohibitedActionsPerformed: promoted.manifest.value.prohibitedActionsPerformed,
  }, null, 2)}\n`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      error: error?.name || "Error",
      message: error?.message || String(error),
      details: error?.details || null,
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
