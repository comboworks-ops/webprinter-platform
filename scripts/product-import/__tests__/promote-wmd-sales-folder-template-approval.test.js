import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTemplateApprovalRequest,
  canonicalJson,
  createDecisionFromExplicitLocalSanitizationApproval,
  loadCurrentApprovalContext,
  promoteTemplateApproval,
} from "../promote-wmd-sales-folder-template-approval.js";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../../..");
const RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);

let contextPromise;
let approvalRequestPromise;

function currentContext() {
  if (!contextPromise) {
    contextPromise = loadCurrentApprovalContext({
      runDirectory: RUN_DIRECTORY,
      verifyRegeneration: false,
    });
  }
  return contextPromise;
}

async function currentApprovalRequestArtifact() {
  if (!approvalRequestPromise) {
    approvalRequestPromise = (async () => {
      const relativePath = "review/template-approval-request.json";
      const absolutePath = path.join(RUN_DIRECTORY, relativePath);
      const bytes = await fs.readFile(absolutePath);
      return {
        value: JSON.parse(bytes.toString("utf8")),
        bytes,
        absolutePath,
        evidence: {
          path: relativePath,
          sha256: sha256Bytes(bytes),
          bytes: bytes.length,
        },
      };
    })();
  }
  return approvalRequestPromise;
}

function completeHumanDecision(context, approvalRequestArtifact) {
  return createDecisionFromExplicitLocalSanitizationApproval({
    context,
    approvalRequestArtifact,
    reviewer: "Thomas Printmaker",
    reviewedAt: "2026-08-31T09:30:00.000Z",
  });
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function replaceArtifactValue(artifact, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  return {
    ...artifact,
    value,
    bytes,
    evidence: {
      ...artifact.evidence,
      sha256: sha256Bytes(bytes),
      bytes: bytes.length,
    },
  };
}

test("request is pending-only and pins the exact 3,692-binding CD-excluded scope", async () => {
  const context = await currentContext();
  const request = buildTemplateApprovalRequest(context);
  assert.equal(request.reviewState, "pending_human_completion");
  assert.equal(request.reviewer, null);
  assert.equal(request.reviewedAt, null);
  assert.equal(request.humanAttestation.confirmed, false);
  assert.equal(request.approvalScope.counts.rawBindings, 3744);
  assert.equal(request.approvalScope.counts.proposedBindings, 3692);
  assert.equal(request.approvalScope.counts.explicitlyExcludedCdBindings, 52);
  assert.equal(request.approvalScope.counts.baseAuditVerifiedBindings, 3170);
  assert.equal(request.approvalScope.counts.nonBaseRecoveryBindings, 522);
  assert.equal(request.approvalScope.counts.titleSupplementEntries, 121);
  assert.equal(request.approvalScope.counts.titleSupplementCoveredBindings, 306);
  assert.equal(request.approvalScope.counts.renderPairs, 23);
  assert.equal(request.approvalScope.counts.extendedEvidenceFamilies, 4);
  assert.equal(request.approvalScope.counts.extendedEvidenceTargets, 10);
  assert.equal(request.approvalScope.catalogScope.excludedModelKey, "cd-135x135--2-part-closure");
  assert.equal(request.titleSupplementDecisions.length, 121);
  assert.equal(request.resolutionEntryDecisions.length, 522);
  assert.equal(request.extendedEvidenceTargetDecisions.length, 10);
  assert.ok(request.titleSupplementDecisions.every((entry) => entry.status === "pending"));
  assert.ok(request.resolutionEntryDecisions.every((entry) => entry.status === "pending"));
  assert.equal(request.safetyBoundary.scriptMaySelfApprove, false);
  assert.equal(request.safetyBoundary.currentPendingArtifactsRemainUnchanged, true);
});

test("the original exact-entry human-review route remains available without a bulk-policy claim", async () => {
  const context = await currentContext();
  const decision = structuredClone(buildTemplateApprovalRequest(context));
  decision.reviewState = "complete_human_review";
  decision.reviewer = "Human Geometry Reviewer";
  decision.reviewedAt = "2026-08-31T09:00:00.000Z";
  decision.humanAttestation = {
    ...decision.humanAttestation,
    confirmed: true,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
  };
  decision.titleSupplementDecisions = decision.titleSupplementDecisions.map((entry) => ({
    ...entry,
    status: "passed",
    sourceHasWindowCut: false,
    counterpartHasWindowCut: true,
    reviewerNote: `Individually reviewed ${entry.renderPairId} against both exact rendered PDFs.`,
  }));
  decision.resolutionEntryDecisions = decision.resolutionEntryDecisions.map((entry) => ({
    ...entry,
    status: "approved",
    reviewerNote: `Individually reviewed exact ${entry.classification} classification and hashes.`,
  }));
  decision.extendedEvidenceTargetDecisions = decision.extendedEvidenceTargetDecisions.map((entry) => ({
    ...entry,
    status: "approved",
    reviewerNote: `Individually reviewed extended target ${entry.targetKey} and its pinned evidence.`,
  }));
  const promoted = promoteTemplateApproval({ context, decision });
  assert.equal(promoted.manifest.value.approval.decisionMode, "exact_entry_human_review");
  assert.equal(promoted.manifest.value.approval.individualJsonEntryReviewClaimed, true);
  assert.equal(promoted.manifest.value.authorizationBoundary, null);
});

test("complete decision regenerates all dependent fingerprints without mutating pending inputs", async () => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  const before = canonicalJson({
    supplement: context.geometrySupplement.value,
    plan: context.resolutionPlan.value,
  });
  const decision = completeHumanDecision(context, approvalRequestArtifact);
  assert.deepEqual(decision.approvalRequest, approvalRequestArtifact.evidence);
  assert.equal(decision.authorizationBoundary.purpose, "local_pdf_template_sanitization_only");
  assert.equal(decision.authorizationBoundary.localOnly, true);
  assert.ok(decision.authorizationBoundary.explicitlyNotAuthorized.includes("storage_write_or_upload"));
  assert.ok(decision.authorizationBoundary.explicitlyNotAuthorized.includes("publication"));
  assert.match(decision.authorizationBoundary.attestation, /do not authorize product, price, database/i);
  assert.equal(decision.decisionMode, "user_directed_bulk_local_sanitization_policy");
  assert.equal(decision.humanAttestation.confirmed, false);
  assert.equal(decision.bulkAuthorization.individualJsonEntryReviewClaimed, false);
  assert.equal(decision.bulkAuthorization.downstreamSanitizedPdfOutputQaRequired, true);
  assert.equal(decision.bulkAuthorization.userInstructionEvidence.length, 2);
  const promoted = promoteTemplateApproval({
    context,
    decision,
    approvalRequestArtifact,
    approvedDirectoryRelativePath: "review/test-approved-template-package",
  });
  const supplement = promoted.approvedSupplement.value;
  const plan = promoted.approvedPlan.value;
  assert.equal(supplement.reviewState, "approved_title_only_construction_text_error");
  assert.equal(supplement.reviewer, decision.reviewer);
  assert.equal(supplement.reviewedAt, decision.reviewedAt);
  assert.equal(supplement.counts.pendingRenderedReviewEntries, 0);
  assert.ok(supplement.entries.every((entry) => entry.renderedReviewEvidence.status === "passed"));
  assert.ok(supplement.entries.every((entry) => entry.renderedReviewEvidence.sourceRenderSha256s.length > 0));
  assert.ok(supplement.entries.every((entry) => entry.renderedReviewEvidence.counterpartRenderSha256s.length > 0));
  assert.ok(supplement.entries.every((entry) => entry.renderedReviewEvidence.reviewerNote.length >= 12));
  assert.deepEqual(
    supplement.entryFingerprints.map((entry) => entry.entrySha256),
    supplement.entries.map((entry) => createHash("sha256").update(canonicalJson(entry)).digest("hex"))
  );
  assert.equal(plan.reviewState, "approved");
  assert.equal(plan.approval.approved, true);
  assert.equal(plan.approvalContract.currentArtifactMayAuthorizeSanitization, true);
  assert.equal(plan.inputEvidence.geometrySupplement.sha256, promoted.approvedSupplement.evidence.sha256);
  assert.equal(plan.inputEvidence.geometrySupplement.path, "review/test-approved-template-package/template-geometry-supplement.json");
  assert.equal(plan.extendedEvidence.reviewState, "approved");
  assert.equal(plan.extendedEvidence.titleSupplementSha256, promoted.approvedSupplement.evidence.sha256);
  assert.ok(plan.extendedEvidence.families.flatMap((family) => family.targetEntries).every((entry) => entry.entryReviewState === "approved"));
  const approvedSupplementHashes = new Set(supplement.entryFingerprints.map((entry) => entry.entrySha256));
  const approvedExtendedTargetHashes = new Set(plan.extendedEvidence.targetFingerprints.map((entry) => entry.entrySha256));
  const approvedExtendedFamilyHashes = new Set(plan.extendedEvidence.familyFingerprints.map((entry) => entry.familySha256));
  for (const entry of plan.bindingClassifications) {
    const dependencies = entry.evidence.dependencies;
    assert.ok(dependencies.titleSupplementEntrySha256s.every((hash) => approvedSupplementHashes.has(hash)));
    if (entry.classification === "extended_exact_evidence") {
      assert.ok(approvedExtendedTargetHashes.has(dependencies.extendedEvidenceTargetSha256));
      assert.ok(approvedExtendedFamilyHashes.has(dependencies.extendedEvidenceFamilySha256));
    }
  }
  assert.ok(plan.bindingClassifications.every((entry) => entry.entryReviewState === "approved"));
  assert.equal(plan.bindingClassifications.length, 3692);
  assert.equal(plan.counts.recoveredBindingsPendingReview, 0);
  assert.deepEqual(
    plan.bindingClassificationFingerprints,
    plan.bindingClassifications.map((entry) => ({
      bindingKey: entry.bindingKey,
      entrySha256: createHash("sha256").update(canonicalJson(entry)).digest("hex"),
    }))
  );
  assert.deepEqual(plan.approvedEntryHashes, plan.bindingClassificationFingerprints.map((entry) => entry.entrySha256));
  assert.equal(JSON.stringify(plan.bindingClassifications).includes("folder_model=cd-135x135--2-part-closure"), false);
  assert.equal(canonicalJson({
    supplement: context.geometrySupplement.value,
    plan: context.resolutionPlan.value,
  }), before);
});

test("stale artifact hash is refused even when all decisions say approved", async () => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  const decision = completeHumanDecision(context, approvalRequestArtifact);
  decision.approvalScope.pendingArtifacts.resolutionPlan.sha256 = "a".repeat(64);
  assert.throws(
    () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
    /stale relative to the current pending artifacts|scope differs/
  );
});

test("partial approval is refused", async () => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  const decision = completeHumanDecision(context, approvalRequestArtifact);
  decision.titleSupplementDecisions.pop();
  assert.throws(
    () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
    /partial or contains arbitrary additions/
  );
});

test("decision must pin the exact pending request and retain the local-only authorization boundary", async (t) => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  await t.test("request SHA drift", () => {
    const decision = completeHumanDecision(context, approvalRequestArtifact);
    decision.approvalRequest.sha256 = "b".repeat(64);
    assert.throws(
      () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
      /does not pin the exact current pending request/
    );
  });
  await t.test("authorization expansion", () => {
    const decision = completeHumanDecision(context, approvalRequestArtifact);
    decision.authorizationBoundary.explicitlyNotAuthorized = decision.authorizationBoundary.explicitlyNotAuthorized.filter(
      (entry) => entry !== "storage_write_or_upload"
    );
    assert.throws(
      () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
      /broader than local PDF template sanitization|weakens the explicit no-write boundary/
    );
  });
});

test("arbitrary exclusion is refused", async () => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  const decision = completeHumanDecision(context, approvalRequestArtifact);
  decision.resolutionEntryDecisions[0].status = "excluded";
  assert.throws(
    () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
    /must be authorized without exclusions/
  );
});

test("CD scope cannot be weakened or reintroduced by a substituted plan", async () => {
  const context = await currentContext();
  const badPlan = structuredClone(context.resolutionPlan.value);
  badPlan.catalogScope.excludedModels = [];
  const badContext = {
    ...context,
    resolutionPlan: replaceArtifactValue(context.resolutionPlan, badPlan),
  };
  assert.throws(
    () => buildTemplateApprovalRequest(badContext),
    /one explicit model exclusion/
  );
});

test("forged reviewer identity or time mismatch is refused", async (t) => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  await t.test("software identity", () => {
    const decision = completeHumanDecision(context, approvalRequestArtifact);
    decision.reviewer = "Codex automation";
    decision.bulkAuthorization.authorizedBy = decision.reviewer;
    assert.throws(
      () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
      /human, not software or a placeholder/
    );
  });
  await t.test("non-canonical time", () => {
    const decision = completeHumanDecision(context, approvalRequestArtifact);
    decision.reviewedAt = "2026-08-31";
    decision.bulkAuthorization.authorizedAt = decision.reviewedAt;
    assert.throws(
      () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
      /canonical ISO-8601 UTC/
    );
  });
  await t.test("bulk authorization mismatch", () => {
    const decision = completeHumanDecision(context, approvalRequestArtifact);
    decision.bulkAuthorization.authorizedAt = "2026-08-31T09:31:00.000Z";
    assert.throws(
      () => promoteTemplateApproval({ context, decision, approvalRequestArtifact }),
      /Bulk authorization time differs/
    );
  });
});

test("promotion is byte-for-byte deterministic for identical decision and output path", async () => {
  const context = await currentContext();
  const approvalRequestArtifact = await currentApprovalRequestArtifact();
  const decision = completeHumanDecision(context, approvalRequestArtifact);
  const first = promoteTemplateApproval({
    context,
    decision,
    approvalRequestArtifact,
    approvedDirectoryRelativePath: "review/deterministic-approved-package",
  });
  const second = promoteTemplateApproval({
    context,
    decision,
    approvalRequestArtifact,
    approvedDirectoryRelativePath: "review/deterministic-approved-package",
  });
  assert.deepEqual(first.approvedSupplement.bytes, second.approvedSupplement.bytes);
  assert.deepEqual(first.approvedPlan.bytes, second.approvedPlan.bytes);
  assert.deepEqual(first.manifest.bytes, second.manifest.bytes);
  assert.equal(first.approvedSupplement.evidence.sha256, second.approvedSupplement.evidence.sha256);
  assert.equal(first.approvedPlan.evidence.sha256, second.approvedPlan.evidence.sha256);
  assert.equal(first.manifest.evidence.sha256, second.manifest.evidence.sha256);
});
