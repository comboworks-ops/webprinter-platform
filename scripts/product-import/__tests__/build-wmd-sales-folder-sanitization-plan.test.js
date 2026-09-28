import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_SANITIZATION_COUNTS,
  buildSanitizationPlan,
  canonicalJson,
  loadSanitizationInputs,
  sha256Json,
  validateResolutionReviewState,
} from "../build-wmd-sales-folder-sanitization-plan.js";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../../..");
const RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);

let actualPromise;

async function actualContext() {
  if (!actualPromise) {
    actualPromise = loadSanitizationInputs({ runDirectory: RUN_DIRECTORY }).then((inputs) => ({
      inputs,
      plan: buildSanitizationPlan(inputs),
    }));
  }
  return actualPromise;
}

test("production sanitization plan has 1,420 safe finish-aware outputs for all 3,692 non-CD bindings", async () => {
  const { plan } = await actualContext();
  assert.equal(plan.kind, "wmd_sales_folder_sanitization_batch_plan");
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.state, "pending_review");
  assert.equal(plan.reviewState, "pending_review");
  assert.equal(plan.localOnly, true);
  assert.equal(plan.eligibleForSanitization, false);
  assert.deepEqual(plan.approval, {
    approved: false,
    reviewer: null,
    reviewedAt: null,
    approvedJobSignatureHashes: [],
  });
  assert.equal(plan.counts.bindings, EXPECTED_SANITIZATION_COUNTS.bindings);
  assert.equal(plan.counts.outputJobs, EXPECTED_SANITIZATION_COUNTS.outputJobs);
  assert.equal(plan.counts.resolvedSourceUrls, EXPECTED_SANITIZATION_COUNTS.resolvedSourceUrls);
  assert.equal(plan.counts.distinctSourcePayloads, EXPECTED_SANITIZATION_COUNTS.distinctSourcePayloads);
  assert.equal(plan.counts.expectedReviewedContracts, 1420);
  assert.equal(plan.counts.expectedSanitizedPdfs, 1420);
  assert.equal(plan.counts.expectedInspections, 1420);
  assert.equal(plan.scope.excludedFolderModel, "cd-135x135--2-part-closure");
  assert.equal(plan.scope.excludedFolderModelBindingCount, 52);
  assert.deepEqual(plan.scope.excludedPdfAddOns, ["CD-Tasche"]);
  assert.equal(plan.scope.rawSupplierEvidencePreserved, true);
  assert.equal(plan.scope.selectedBindingsContainCdModel, false);
  assert.equal(plan.catalogScope.excludedModels.length, 1);
  assert.equal(plan.catalogScope.excludedModels[0].modelKey, "cd-135x135--2-part-closure");
  assert.equal(plan.catalogScope.counts.raw.exactSparseCombinations, 3744);
  assert.equal(plan.catalogScope.counts.proposed.exactSparseCombinations, 3692);
  assert.equal(plan.catalogScope.counts.excluded.exactSparseCombinations, 52);
  assert.equal(plan.sourceScopeProjection.rawBindingCount, 3744);
  assert.equal(plan.sourceScopeProjection.proposedBindingCount, 3692);
  assert.equal(plan.sourceScopeProjection.excludedBindingCount, 52);
  assert.equal(plan.groupingPolicy.resolvedSourceUrlCountIsNotOutputCount, true);
  assert.equal(plan.groupingPolicy.distinctSourcePayloadCountIsNotOutputCount, true);
  assert.match(plan.groupingPolicy.warning, /1,099 source URLs or 285 distinct byte payloads/);
  assert.match(plan.groupingPolicy.warning, /1,420 separately reviewed outputs/);
  assert.equal(plan.jobs.length, 1420);
  assert.equal(new Set(plan.jobs.map((job) => job.jobId)).size, 1420);
  assert.equal(new Set(plan.jobs.map((job) => canonicalJson(job.safeOutputSignature))).size, 1420);
  assert.equal(
    plan.jobs.reduce((total, job) => total + job.coveredBindingCount, 0),
    3692
  );
  assert.equal(JSON.stringify(plan.jobs).includes("cd-135x135"), false);
  assert.equal(JSON.stringify(plan.jobs).includes("mappe_cd_"), false);
  assert.ok(Object.values(plan.prohibitedActionsPerformed).every((value) => value === false));
});

test("every planned job pins exact source/evidence identities and three unique, supplier-free future output paths", async () => {
  const { plan } = await actualContext();
  const allPaths = [];
  const allBindings = [];
  for (const job of plan.jobs) {
    assert.equal(job.safeOutputSignatureSha256, sha256Json(job.safeOutputSignature));
    assert.equal(job.safeOutputSignature.expectedGeometryKey, job.geometry.expectedGeometryKey);
    assert.equal(job.safeOutputSignature.finishKey, job.finish.key);
    assert.equal(job.safeOutputSignature.resolvedSourceSha256, job.source.executionIdentity.sha256);
    assert.match(job.source.executionIdentity.sha256, /^[a-f0-9]{64}$/);
    assert.ok(job.source.executionIdentity.localRelativePath.endsWith(".pdf"));
    assert.ok(job.source.executionIdentity.byteSize > 0);
    assert.match(job.source.executionIdentity.inventoryRowSha256, /^[a-f0-9]{64}$/);
    assert.equal(job.gate.sanitizationAllowed, false);
    assert.equal(job.gate.contractExists, false);
    assert.equal(job.gate.contractApproved, false);
    assert.equal(job.executionEvidence.geometryAudit.reportSha256, plan.inputEvidence.geometryAudit.sha256);
    assert.match(job.executionEvidence.geometryAudit.bindingSha256, /^[a-f0-9]{64}$/);
    assert.equal(job.mappingEvidence.templateResolutionPlanSha256, plan.inputEvidence.templateResolutionPlan.sha256);
    assert.equal(job.coveredBindingCount, job.coveredBindings.length);
    assert.ok(job.coveredBindings.every((binding) => binding.resolvedSourceIdentityKey));
    allBindings.push(...job.coveredBindings.map((binding) => binding.bindingKey));
    for (const outputPath of Object.values(job.outputs)) {
      assert.equal(path.isAbsolute(outputPath), false);
      assert.equal(/wir-machen-druck|mappe_/i.test(outputPath), false);
      allPaths.push(outputPath);
    }
  }
  assert.equal(new Set(allPaths).size, 1420 * 3);
  assert.equal(new Set(allBindings).size, 3692);
  assert.equal(plan.contractRequirements.layerPolicy.cdTascheWhenPresent.action, "remove");
  assert.equal(plan.contractRequirements.layerPolicy.cdTascheWhenPresent.role, "unused-accessory");
  assert.equal(plan.contractRequirements.layerPolicy.cdTascheWhenPresent.outputNameDa, null);
  assert.equal(plan.contractRequirements.layerPolicy.everyPreservedLayerRequiresNonEmptyOutputNameDa, true);
  assert.equal(plan.contractRequirements.layerPolicy.technicalStanzenIsCutGeometryNeverFinishMask, true);
});

test("spot-finish jobs remain professional-upload-only until a real source finish mask is reviewed", async () => {
  const { plan } = await actualContext();
  const spotJobs = plan.jobs.filter((job) => job.finish.spotFinish);
  assert.ok(spotJobs.length > 0);
  assert.ok(spotJobs.every((job) => job.artwork.mode === "professional_pdf_upload_only"));
  assert.ok(spotJobs.every((job) => job.artwork.onlineDesignerAllowed === false));
  assert.ok(spotJobs.every((job) => job.artwork.sourceFinishMaskMustBeHumanReviewed === true));
  assert.ok(spotJobs.every((job) => job.artwork.missingSourceFinishMaskKeepsProfessionalUploadOnly === true));
  assert.ok(spotJobs.every((job) => job.artwork.technicalStanzenRole === "cut_not_finish"));
});

test("the plan is deterministic for the same hash-pinned local evidence", async () => {
  const { plan } = await actualContext();
  assert.equal(sha256Json(plan), sha256Json(JSON.parse(canonicalJson(plan))));
  assert.deepEqual(
    plan.jobs.map((job) => canonicalJson(job.safeOutputSignature)),
    [...plan.jobs.map((job) => canonicalJson(job.safeOutputSignature))].sort((left, right) =>
      left.localeCompare(right, "en", { numeric: true })
    )
  );
  for (const job of plan.jobs) {
    assert.deepEqual(
      job.coveredBindings.map((binding) => binding.selectionKey),
      [...job.coveredBindings.map((binding) => binding.selectionKey)].sort((left, right) =>
        left.localeCompare(right, "en", { numeric: true })
      )
    );
  }
});

test("CD leakage is refused before any job can be planned", async () => {
  const { inputs } = await actualContext();
  const stubs = [...inputs.stubs];
  stubs[0] = {
    ...stubs[0],
    match: {
      ...stubs[0].match,
      folder_model: "cd-135x135--2-part-closure",
    },
  };
  assert.throws(
    () => buildSanitizationPlan({ ...inputs, stubs }),
    /excluded CD model\/template leakage/
  );
});

test("missing bindings, duplicate classifications, and stale hash pins fail closed", async () => {
  const { inputs } = await actualContext();
  assert.throws(
    () => buildSanitizationPlan({ ...inputs, stubs: inputs.stubs.slice(1) }),
    /count drifted/
  );

  const duplicateClassifications = [...inputs.resolutionPlan.bindingClassifications];
  duplicateClassifications[duplicateClassifications.length - 1] = duplicateClassifications[0];
  assert.throws(
    () => buildSanitizationPlan({
      ...inputs,
      resolutionPlan: {
        ...inputs.resolutionPlan,
        bindingClassifications: duplicateClassifications,
      },
    }),
    /duplicate key/
  );

  assert.throws(
    () => buildSanitizationPlan({
      ...inputs,
      inputEvidence: {
        ...inputs.inputEvidence,
        geometryAudit: {
          ...inputs.inputEvidence.geometryAudit,
          sha256: "a".repeat(64),
        },
      },
    }),
    /stale relative to the geometry audit/
  );
});

test("an approved resolution plan must carry the full exact sanitizer authorization contract", () => {
  const entrySha256 = "a".repeat(64);
  const approved = {
    reviewState: "approved",
    approval: {
      approved: true,
      reviewer: "PDF reviewer",
      reviewedAt: "2026-08-31T12:00:00.000Z",
    },
    approvalContract: {
      currentArtifactMayAuthorizeSanitization: true,
      requiredArtifactReviewState: "approved",
      requiredEntryReviewState: "approved",
      requireNonEmptyReviewer: true,
      requireIsoReviewedAt: true,
      approvedEntryHashesMustExactlyMatchFingerprints: true,
      inputHashesMustRemainEqual: true,
      pendingSupplementRequiresPlanRegenerationAfterApproval: true,
    },
    approvedEntryHashes: [entrySha256],
    bindingClassificationFingerprints: [{ bindingKey: "binding-1", entrySha256 }],
    bindingClassifications: [{ bindingKey: "binding-1", entryReviewState: "approved" }],
  };
  assert.doesNotThrow(() => validateResolutionReviewState(approved));

  assert.throws(
    () => validateResolutionReviewState({
      ...approved,
      approvalContract: {
        ...approved.approvalContract,
        currentArtifactMayAuthorizeSanitization: false,
      },
    }),
    /does not exactly authorize/
  );
  assert.throws(
    () => validateResolutionReviewState({
      ...approved,
      approvalContract: {
        ...approved.approvalContract,
        unexpectedAuthorizationFlag: true,
      },
    }),
    /keys drifted/
  );
  assert.throws(
    () => validateResolutionReviewState({
      ...approved,
      bindingClassifications: [{ bindingKey: "binding-1", entryReviewState: "pending_review" }],
    }),
    /non-approved classification entry/
  );
});
