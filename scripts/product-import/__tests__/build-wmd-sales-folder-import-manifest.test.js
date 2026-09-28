import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  templateModeProjection,
  validateCanonicalIconGrid,
  validateInspection,
} from "../build-wmd-sales-folder-import-manifest.js";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../../..");
const RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);

async function jsonArtifact(relativePath) {
  const absolutePath = path.join(RUN_DIRECTORY, relativePath);
  const bytes = await fs.readFile(absolutePath);
  return {
    relativePath,
    absolutePath,
    bytes,
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    value: JSON.parse(bytes.toString("utf8")),
  };
}

const batchJob = {
  jobId: "sales-folder-test-job",
  sanitizedPdf: { sha256: "a".repeat(64) },
};

const baseValidation = {
  pageBoxesPreserved: true,
  supplierTextAndBrandingRemoved: true,
  metadataXmpThumbnailsAttachmentsActionsLinksAndCommentsRemoved: true,
  danishInformationContained: true,
  webprinterBluePanelPaintVerified: true,
  supplierGreenPaintAbsent: true,
  layers: [{ viewState: "/ON", printState: "/OFF", exportState: "/OFF" }],
};

const inspection = (validation) => ({
  outputSha256: batchJob.sanitizedPdf.sha256,
  fullPageRasterization: false,
  validation: { ...baseValidation, ...validation },
});

test("non-spot finishes remain Designer eligible without claiming spot-mask eligibility", () => {
  assert.doesNotThrow(() => validateInspection(
    inspection({
      finishWorkflow: "not_applicable",
      onlineDesignerEligibleForFinish: null,
      professionalUploadWarningVerified: false,
    }),
    batchJob,
    {
      artwork: { mode: "online_designer" },
      finish: { spotFinish: false },
    },
  ));
});

test("spot finishes require the professional-upload-only inspection evidence", () => {
  assert.doesNotThrow(() => validateInspection(
    inspection({
      finishWorkflow: "professional_upload_only_no_source_finish_mask",
      onlineDesignerEligibleForFinish: false,
      professionalUploadWarningVerified: true,
    }),
    batchJob,
    {
      artwork: { mode: "professional_pdf_upload_only" },
      finish: { spotFinish: true },
    },
  ));
});

test("an online job fails closed if the inspection marks it ineligible", () => {
  assert.throws(() => validateInspection(
    inspection({
      finishWorkflow: "not_applicable",
      onlineDesignerEligibleForFinish: false,
      professionalUploadWarningVerified: false,
    }),
    batchJob,
    {
      artwork: { mode: "online_designer" },
      finish: { spotFinish: false },
    },
  ), /non-spot finish eligibility/);
});

test("a spot-finish job fails closed without the verified upload warning", () => {
  assert.throws(() => validateInspection(
    inspection({
      finishWorkflow: "professional_upload_only_no_source_finish_mask",
      onlineDesignerEligibleForFinish: false,
      professionalUploadWarningVerified: false,
    }),
    batchJob,
    {
      artwork: { mode: "professional_pdf_upload_only" },
      finish: { spotFinish: true },
    },
  ), /verified upload warning/);
});

test("online templates use the locked non-printing guide-overlay contract", () => {
  assert.deepEqual(templateModeProjection({
    artwork: { mode: "online_designer", onlineDesignerAllowed: true },
  }, {}), {
    designerLoadMode: "locked_non_printing_guide_overlay",
    lockedInDesigner: true,
    nonPrintingOverlay: true,
    excludedFromExport: true,
    artworkMode: "online_designer",
    artworkModeReasonDa: null,
    onlineDesignerAllowed: true,
    verificationStatus: "pending",
  });
});

test("professional-upload templates use download-only mode with a Danish reason", () => {
  assert.deepEqual(templateModeProjection({
    artwork: { mode: "professional_pdf_upload_only", onlineDesignerAllowed: false },
  }, {
    professionalUploadWarningDa: "Denne variant kræver en separat efterbehandlingsmaske.",
  }), {
    designerLoadMode: "download_only",
    lockedInDesigner: false,
    nonPrintingOverlay: false,
    excludedFromExport: false,
    artworkMode: "professional_pdf_upload_only",
    artworkModeReasonDa: "Denne variant kræver en separat efterbehandlingsmaske.",
    onlineDesignerAllowed: false,
    verificationStatus: "not_applicable",
  });
  assert.throws(
    () => templateModeProjection({
      artwork: { mode: "professional_pdf_upload_only", onlineDesignerAllowed: false },
    }, {}),
    /Danish reason/u,
  );
});

test("canonical icon-grid validation pins exact order, PNG bytes, and transparency", async () => {
  const [iconArtifact, proposalArtifact] = await Promise.all([
    jsonArtifact("review/canonical-icon-grid-v1.json"),
    jsonArtifact("review/consolidated-product-proposal.json"),
  ]);
  const validation = await validateCanonicalIconGrid({ iconArtifact, proposalArtifact });
  assert.equal(validation.modelOrder.length, 20);
  assert.equal(validation.assets.length, 40);
  assert(validation.assets.every((asset) => asset.transparent === true));
  assert(!validation.modelOrder.includes("cd-135x135--2-part-closure"));
});
