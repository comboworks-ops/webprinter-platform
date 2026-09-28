import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PIXEL_POLICY,
  SanitizedRenderReviewError,
  buildSanitizedRenderReview,
  validateDonorContractEvidence,
  evaluateJobPixelChecks,
  validateBatchManifest,
} from "../build-wmd-sales-folder-sanitized-render-review.js";

const PYTHON = "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const HELPER = fileURLToPath(new URL("../analyze_wmd_sales_folder_sanitized_renders.py", import.meta.url));
const REPOSITORY_DIRECTORY = fileURLToPath(new URL("../../../", import.meta.url));
const SANITIZER_IMPLEMENTATION_PATH = "scripts/product-templates/sanitize_wmd_sales_folder_template.py";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pdf(label) {
  return Buffer.from(`%PDF-1.7\n${label}\n%%EOF\n`, "utf8");
}

function evidence(relativePath, bytes) {
  return { path: relativePath, sha256: sha256(bytes), bytes: bytes.length };
}

async function writeEvidence(runDirectory, relativePath, bytes) {
  const absolutePath = path.join(runDirectory, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);
  return evidence(relativePath, bytes);
}

function prohibited() {
  return {
    uploaded: false,
    databaseWritten: false,
    productOrTemplateAttached: false,
    published: false,
  };
}

async function createBatchFixture(runDirectory) {
  await fs.mkdir(path.join(runDirectory, "review"), { recursive: true });
  const sanitizerImplementationBytes = await fs.readFile(
    path.join(REPOSITORY_DIRECTORY, SANITIZER_IMPLEMENTATION_PATH)
  );
  const sanitizerImplementation = evidence(
    SANITIZER_IMPLEMENTATION_PATH,
    sanitizerImplementationBytes
  );
  const sourceBytes = pdf("SOURCE");
  const auditBytes = Buffer.from('{"state":"approved"}\n', "utf8");
  const donorReportBytes = Buffer.from('{"kind":"wmd_sales_folder_verified_beschnitt_guide_donors"}\n', "utf8");
  const source = await writeEvidence(runDirectory, "documents/source-pdfs/source.pdf", sourceBytes);
  const audit = await writeEvidence(runDirectory, "review/approved-template-package/template-geometry-audit.json", auditBytes);
  const donorReport = await writeEvidence(
    runDirectory,
    "review/approved-template-package/verified-beschnitt-guide-donors.json",
    donorReportBytes
  );
  const jobs = [];
  const planJobs = [];
  const contractValues = [];
  const jobIds = ["salgsmappe-zeta-output-001", "salgsmappe-alpha-output-002"];
  for (const [index, print] of ["4+0", "4+4"].entries()) {
    const jobId = jobIds[index];
    const sanitizedBytes = pdf(`SANITIZED ${jobId}`);
    const inspectionBytes = Buffer.from(`${JSON.stringify({
      state: "sanitized_render_review_required",
      outputSha256: sha256(sanitizedBytes),
      visualReviewPending: true,
    })}\n`, "utf8");
    const sanitizedPdf = await writeEvidence(runDirectory, `documents/sanitized-pdfs/${jobId}.pdf`, sanitizedBytes);
    const inspection = await writeEvidence(runDirectory, `documents/sanitization-inspections/${jobId}.json`, inspectionBytes);
    const expectedGeometryKey = `a4|${index === 0 ? "2-part-2-flaps" : "3-part-3-flaps"}|${print}|${index === 0 ? 5 : "none"}`;
    const safeOutputSignature = {
      expectedGeometryKey,
      finishKey: index === 0 ? "none" : "soft-touch",
      resolvedSourceSha256: source.sha256,
    };
    const safeOutputSignatureSha256 = sha256(Buffer.from(JSON.stringify(safeOutputSignature), "utf8"));
    const donorEntrySha256 = index === 0 ? sha256(Buffer.from(`donor-entry:${jobId}`, "utf8")) : null;
    const contractValue = {
      kind: "wmd_sales_folder_sanitization_contract",
      state: "approved_for_sanitization",
      verifiedBeschnittGuideDonor: donorEntrySha256 === null
        ? null
        : { reportSha256: donorReport.sha256, entrySha256: donorEntrySha256 },
      batchEvidence: {
        verifiedBeschnittGuideDonors: donorReport,
        verifiedBeschnittGuideDonorEntrySha256: donorEntrySha256,
      },
    };
    const contractBytes = Buffer.from(`${JSON.stringify(contractValue, null, 2)}\n`, "utf8");
    const contract = await writeEvidence(
      runDirectory,
      `documents/sanitization-contracts/${jobId}.json`,
      contractBytes
    );
    contractValues.push(contractValue);
    jobs.push({
      jobId,
      safeOutputSignatureSha256,
      geometry: {
        format: "a4",
        construction: index === 0 ? "2-part-2-flaps" : "3-part-3-flaps",
        print,
        spineMm: index === 0 ? 5 : null,
        expectedGeometryKey,
      },
      finishKey: index === 0 ? "none" : "soft-touch",
      coveredBindingCount: index + 1,
      coveredBindingKeysSha256: sha256(Buffer.from(`bindings:${jobId}`)),
      source,
      contract,
      sanitizedPdf,
      inspection,
      executionEvidence: {
        geometryAudit: audit,
        geometrySupplement: null,
        templateResolutionPlan: null,
        verifiedBeschnittGuideDonorReport: donorEntrySha256 === null
          ? null
          : { ...donorReport, entrySha256: donorEntrySha256 },
      },
      state: "sanitized_render_review_required",
      reviewState: "sanitized_render_review_required",
      visualReviewPending: true,
      designerLockedOverlayVerificationPending: true,
      designerExportExclusionVerificationPending: true,
      eligibleForTemplateImport: false,
      eligibleForImport: false,
      prohibitedActionsPerformed: prohibited(),
    });
    planJobs.push({ jobId, safeOutputSignature, safeOutputSignatureSha256 });
  }
  const plan = {
    kind: "wmd_sales_folder_sanitization_batch_plan",
    schemaVersion: 1,
    state: "pending_review",
    reviewState: "pending_review",
    localOnly: true,
    eligibleForSanitization: false,
    eligibleForTemplateImport: false,
    counts: {
      outputJobs: jobs.length,
      expectedReviewedContracts: jobs.length,
      expectedSanitizedPdfs: jobs.length,
      expectedInspections: jobs.length,
    },
    jobs: planJobs,
  };
  const planBytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const planEvidence = await writeEvidence(runDirectory, "review/template-sanitization-plan.json", planBytes);
  const contractManifestBytes = Buffer.from(`${JSON.stringify({
    kind: "wmd_sales_folder_sanitization_contract_manifest",
    state: "approved_for_sanitization",
    derivedEvidence: { verifiedBeschnittGuideDonorJobs: 1 },
    contractFiles: jobs.map((job) => ({ jobId: job.jobId, ...job.contract })),
  }, null, 2)}\n`, "utf8");
  const contractManifest = await writeEvidence(
    runDirectory,
    "documents/sanitization-contracts/manifest.json",
    contractManifestBytes
  );
  const manifest = {
    kind: "wmd_sales_folder_sanitization_batch_manifest",
    schemaVersion: 1,
    state: "sanitized_render_review_required",
    reviewState: "sanitized_render_review_required",
    localOnly: true,
    eligibleForTemplateImport: false,
    eligibleForImport: false,
    inputEvidence: {
      sanitizationProposalPlan: planEvidence,
      approvedContractManifest: contractManifest,
      sanitizerImplementation: { ...sanitizerImplementation, entrypoint: "run_sanitize" },
      approvalEvidence: { templatePromotion: audit },
    },
    counts: {
      expectedOutputCount: jobs.length,
      sanitizedPdfs: jobs.length,
      inspections: jobs.length,
      jobs: jobs.length,
      coveredBindingReferences: jobs.reduce((sum, job) => sum + job.coveredBindingCount, 0),
    },
    jobs,
    visualReviewPending: true,
    designerLockedOverlayVerificationPending: true,
    designerExportExclusionVerificationPending: true,
    prohibitedActionsPerformed: prohibited(),
  };
  const manifestPath = path.join(runDirectory, "documents/sanitization-batch/manifest.json");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(manifestPath, manifestBytes);
  await fs.writeFile(`${manifestPath}.sha256`, `${sha256(manifestBytes)}  manifest.json\n`);
  const checksumRows = [
    { path: "documents/sanitization-batch/manifest.json", sha256: sha256(manifestBytes) },
    ...jobs.flatMap((job) => [job.sanitizedPdf, job.inspection]),
  ].sort((left, right) => left.path.localeCompare(right.path, "en"));
  await fs.writeFile(
    path.join(runDirectory, "documents/sanitization-batch/checksums.sha256"),
    `${checksumRows.map((row) => `${row.sha256}  ${row.path}`).join("\n")}\n`
  );
  return {
    manifest,
    jobs,
    manifestPath,
    plan,
    contractValues,
    donorReport,
    sanitizerImplementation,
  };
}

async function rewriteBatchManifest(runDirectory, manifest) {
  const relativePath = "documents/sanitization-batch/manifest.json";
  const manifestPath = path.join(runDirectory, relativePath);
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const digest = sha256(bytes);
  await fs.writeFile(manifestPath, bytes);
  await fs.writeFile(`${manifestPath}.sha256`, `${digest}  manifest.json\n`);
  const checksumsPath = path.join(
    runDirectory,
    "documents/sanitization-batch/checksums.sha256"
  );
  const rows = (await fs.readFile(checksumsPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => (
      line.endsWith(`  ${relativePath}`)
        ? `${digest}  ${relativePath}`
        : line
    ));
  await fs.writeFile(checksumsPath, `${rows.join("\n")}\n`);
}

function fakeProcessRunner(command, args) {
  if (args.length === 1 && args[0] === "-v") {
    return Promise.resolve({ code: 0, stdout: "", stderr: "pdftoppm version 99.1.0\n" });
  }
  if (args.length === 1 && args[0] === "--version") {
    return Promise.resolve({ code: 0, stdout: "Python 3.12.9\n", stderr: "" });
  }
  throw new Error(`Unexpected process call: ${command} ${args.join(" ")}`);
}

async function fakeRenderPdf({ outputDirectory, job }) {
  await fs.mkdir(outputDirectory, { recursive: false });
  const pageLabels = job.geometry.print === "4+0"
    ? ["shared-blue-page", "four-plus-zero-gray-page"]
    : ["shared-blue-page", "four-plus-four-color-page"];
  const pages = [];
  for (const [index, label] of pageLabels.entries()) {
    const absolutePath = path.join(outputDirectory, `page-${index + 1}.png`);
    await fs.writeFile(absolutePath, Buffer.concat([PNG_SIGNATURE, Buffer.from(label, "utf8")]));
    pages.push({ pageNumber: index + 1, absolutePath });
  }
  return pages;
}

function metrics(sha, label) {
  const base = {
    sha256: sha,
    widthPx: 1200,
    heightPx: 1600,
    pixelCount: 1_920_000,
    nonWhitePixels: 500_000,
    nonWhiteRatio: 0.260416667,
    quantizedColorCount: 4,
    channelRange: 255,
    nonBlankPassed: true,
    webprinterBluePixels: 0,
    webprinterBlueRatio: 0,
    supplierGreenPixels: 0,
    supplierGreenRatio: 0,
    noPrintGrayPixels: 0,
    noPrintGrayRatio: 0,
    neutralGrayPixels: 0,
    neutralGrayRatio: 0,
    effectiveNoPrintGrayPixels: 0,
    effectiveNoPrintGrayRatio: 0,
    colorfulPixels: 10_000,
    colorfulRatio: 0.005208333,
  };
  if (label.includes("shared-blue")) return { ...base, webprinterBluePixels: 20_000, webprinterBlueRatio: 0.010416667 };
  if (label.includes("gray")) return {
    ...base,
    noPrintGrayPixels: 1_850_000,
    noPrintGrayRatio: 0.963541667,
    neutralGrayPixels: 1_850_000,
    neutralGrayRatio: 0.963541667,
    effectiveNoPrintGrayPixels: 1_850_000,
    effectiveNoPrintGrayRatio: 0.963541667,
  };
  return base;
}

async function fakePixelAnalyzer({ images }) {
  const rows = [];
  for (const image of images) {
    const bytes = await fs.readFile(image.path);
    rows.push(metrics(image.sha256, bytes.subarray(PNG_SIGNATURE.length).toString("utf8")));
  }
  return {
    kind: "wmd_sales_folder_render_pixel_analysis",
    schemaVersion: 1,
    images: rows.sort((left, right) => left.sha256.localeCompare(right.sha256, "en")),
  };
}

async function fakeContactSheetBuilder({ sheets }) {
  const outputs = [];
  for (const sheet of sheets) {
    await fs.writeFile(sheet.outputPath, Buffer.concat([PNG_SIGNATURE, Buffer.from(sheet.id, "utf8")]));
    outputs.push({ id: sheet.id, outputPath: sheet.outputPath, widthPx: 2400, heightPx: 2700, itemCount: sheet.items.length });
  }
  return { kind: "wmd_sales_folder_render_contact_sheets", schemaVersion: 1, sheets: outputs };
}

async function runBuilder(runDirectory, overrides = {}) {
  return buildSanitizedRenderReview({
    runDirectory,
    expectedJobs: 2,
    expectedDonorJobs: 1,
    rendererBinary: "fake-pdftoppm",
    pythonBinary: "fake-python",
    processRunner: fakeProcessRunner,
    renderPdf: fakeRenderPdf,
    pixelAnalyzer: fakePixelAnalyzer,
    contactSheetBuilder: fakeContactSheetBuilder,
    ...overrides,
  });
}

function pageAnalysis(overrides = {}) {
  return {
    nonBlankPassed: true,
    nonWhitePixels: 1000,
    nonWhiteRatio: 0.1,
    quantizedColorCount: 3,
    channelRange: 255,
    webprinterBluePixels: 500,
    webprinterBlueRatio: 0.01,
    supplierGreenPixels: 0,
    supplierGreenRatio: 0,
    noPrintGrayPixels: 0,
    noPrintGrayRatio: 0,
    effectiveNoPrintGrayPixels: 0,
    effectiveNoPrintGrayRatio: 0,
    ...overrides,
  };
}

test("pixel policy distinguishes 4+0 grey from 4+4 and fails supplier green", () => {
  const fourPlusZero = { geometry: { print: "4+0" } };
  const passed = evaluateJobPixelChecks(fourPlusZero, [
    { pageNumber: 1, analysis: pageAnalysis() },
    { pageNumber: 2, analysis: pageAnalysis({ webprinterBluePixels: 0, webprinterBlueRatio: 0, effectiveNoPrintGrayRatio: 0.9 }) },
  ]);
  assert.equal(passed.passed, true);

  const forbiddenGray = evaluateJobPixelChecks({ geometry: { print: "4+4" } }, [
    { pageNumber: 1, analysis: pageAnalysis() },
    { pageNumber: 2, analysis: pageAnalysis({ effectiveNoPrintGrayRatio: 0.9 }) },
  ]);
  assert.equal(forbiddenGray.passed, false);
  assert.ok(forbiddenGray.failedCheckIds.includes("four_plus_four_has_no_generated_full_page_gray"));

  const supplierGreen = evaluateJobPixelChecks(fourPlusZero, [
    { pageNumber: 1, analysis: pageAnalysis({ supplierGreenPixels: 1 }) },
    { pageNumber: 2, analysis: pageAnalysis({ effectiveNoPrintGrayRatio: 0.9 }) },
  ]);
  assert.ok(supplierGreen.failedCheckIds.includes("page_1_no_supplier_green"));
  assert.equal(PIXEL_POLICY.supplierGreen.maximumHighConfidencePixels, 0);
});

test("batch validator accepts non-global pinned plan and exact donor coverage, then rejects order, donor, and contract-pin tampering", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sanitized-render-schema-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const { manifest, plan, contractValues, donorReport } = await createBatchFixture(root);
  const validationOptions = { expectedJobs: 2, expectedPlanJobs: plan.jobs, expectedDonorJobs: 1 };
  assert.ok(manifest.jobs[0].jobId.localeCompare(manifest.jobs[1].jobId, "en") > 0, "fixture must use a valid non-global-sort plan order");
  assert.equal(validateBatchManifest(manifest, validationOptions).length, 2);
  assert.deepEqual(validateDonorContractEvidence(manifest.jobs[0], contractValues[0]), {
    donor: true,
    reportSha256: donorReport.sha256,
    entrySha256: manifest.jobs[0].executionEvidence.verifiedBeschnittGuideDonorReport.entrySha256,
  });
  assert.deepEqual(validateDonorContractEvidence(manifest.jobs[1], contractValues[1]), { donor: false });
  assert.throws(() => validateBatchManifest({ ...manifest, jobs: manifest.jobs.slice(0, 1) }, validationOptions), /Expected 2 batch jobs/);
  assert.throws(
    () => validateBatchManifest({ ...manifest, jobs: [...manifest.jobs].reverse() }, validationOptions),
    /order differs from the hash-pinned plan at position 1/
  );
  assert.throws(
    () => validateBatchManifest({ ...manifest, prohibitedActionsPerformed: { ...manifest.prohibitedActionsPerformed, uploaded: true } }, validationOptions),
    /uploaded must remain false/
  );
  const extraDonorJob = structuredClone(manifest.jobs[1]);
  extraDonorJob.executionEvidence.verifiedBeschnittGuideDonorReport = {
    ...manifest.jobs[0].executionEvidence.verifiedBeschnittGuideDonorReport,
    entrySha256: sha256(Buffer.from("unexpected second donor", "utf8")),
  };
  assert.throws(
    () => validateBatchManifest({ ...manifest, jobs: [manifest.jobs[0], extraDonorJob] }, validationOptions),
    /Expected exactly 1 verified Beschnitt donor jobs, found 2/
  );
  const tamperedContract = structuredClone(contractValues[0]);
  tamperedContract.verifiedBeschnittGuideDonor.entrySha256 = sha256(Buffer.from("tampered donor entry", "utf8"));
  assert.throws(
    () => validateDonorContractEvidence(manifest.jobs[0], tamperedContract),
    /donor entry SHA differs between contract and batch manifest/
  );
});

test("builder resolves repository implementation evidence separately from run evidence", async (t) => {
  const roots = [];
  t.after(async () => Promise.all(
    roots.map((root) => fs.rm(root, { recursive: true, force: true }))
  ));

  const validRun = await fs.mkdtemp(
    path.join(os.tmpdir(), "wmd-sanitized-render-evidence-roots-")
  );
  roots.push(validRun);
  const { sanitizerImplementation } = await createBatchFixture(validRun);
  assert.equal(sanitizerImplementation.path, SANITIZER_IMPLEMENTATION_PATH);
  await assert.rejects(
    fs.lstat(path.join(validRun, SANITIZER_IMPLEMENTATION_PATH)),
    (error) => error?.code === "ENOENT"
  );
  const result = await runBuilder(validRun);
  assert.equal(result.reviewState, "pending_human_visual_review");

  const missingRunEvidence = await fs.mkdtemp(
    path.join(os.tmpdir(), "wmd-sanitized-render-run-evidence-")
  );
  roots.push(missingRunEvidence);
  await createBatchFixture(missingRunEvidence);
  await fs.rm(path.join(
    missingRunEvidence,
    "review/template-sanitization-plan.json"
  ));
  await assert.rejects(
    runBuilder(missingRunEvidence),
    (error) => (
      error instanceof SanitizedRenderReviewError
      && /Sanitization proposal plan is missing: review\/template-sanitization-plan\.json/u.test(error.message)
    )
  );

  async function assertBoundaryRefusal(label, mutate, expectedMessage) {
    const run = await fs.mkdtemp(
      path.join(os.tmpdir(), `wmd-sanitized-render-${label}-`)
    );
    roots.push(run);
    const fixture = await createBatchFixture(run);
    const manifest = structuredClone(fixture.manifest);
    mutate(manifest, fixture.sanitizerImplementation);
    await rewriteBatchManifest(run, manifest);
    await assert.rejects(
      runBuilder(run),
      (error) => (
        error instanceof SanitizedRenderReviewError
        && expectedMessage.test(error.message)
      )
    );
  }

  await assertBoundaryRefusal(
    "wrong-sanitizer-path",
    (manifest) => {
      manifest.inputEvidence.sanitizerImplementation.path = (
        "scripts/product-templates/not-the-approved-sanitizer.py"
      );
    },
    /Batch sanitizer implementation must pin scripts\/product-templates\/sanitize_wmd_sales_folder_template\.py/u
  );
  await assertBoundaryRefusal(
    "wrong-entrypoint",
    (manifest) => {
      manifest.inputEvidence.sanitizerImplementation.entrypoint = "main";
    },
    /Batch sanitizer implementation must pin the run_sanitize entrypoint/u
  );
  await assertBoundaryRefusal(
    "tampered-sanitizer-sha",
    (manifest) => {
      manifest.inputEvidence.sanitizerImplementation.sha256 = "0".repeat(64);
    },
    /batch sanitizer implementation SHA-256 changed/u
  );
  await assertBoundaryRefusal(
    "tampered-sanitizer-bytes",
    (manifest) => {
      manifest.inputEvidence.sanitizerImplementation.bytes += 1;
    },
    /batch sanitizer implementation byte count changed/u
  );
  await assertBoundaryRefusal(
    "nested-repo-looking-run-evidence",
    (manifest, implementation) => {
      manifest.inputEvidence.approvalEvidence.nestedImplementationLookalike = {
        path: implementation.path,
        sha256: implementation.sha256,
        bytes: implementation.bytes,
      };
    },
    /batch input evidence \d+ is missing: scripts\/product-templates\/sanitize_wmd_sales_folder_template\.py/u
  );
});

test("builder deduplicates page renders, preserves coverage, and emits only pending review deterministically", async (t) => {
  const roots = [];
  t.after(async () => Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))));
  const outputs = [];
  for (let index = 0; index < 2; index += 1) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sanitized-render-build-"));
    roots.push(root);
    await createBatchFixture(root);
    const result = await runBuilder(root);
    assert.equal(result.reviewState, "pending_human_visual_review");
    assert.equal(result.automatedReview.passed, true);
    assert.equal(result.counts.jobs, 2);
    assert.equal(result.counts.renderedPageOccurrences, 4);
    assert.equal(result.counts.uniquePageRenders, 3);
    assert.equal(result.counts.deduplicatedPageOccurrences, 1);
    assert.equal(result.counts.verifiedBeschnittGuideDonorJobs, 1);

    const outputDirectory = path.join(root, "review/sanitized-pdf-render-review");
    const manifestBytes = await fs.readFile(path.join(outputDirectory, "render-review-manifest.json"));
    const htmlBytes = await fs.readFile(path.join(outputDirectory, "index.html"));
    const checksumsBytes = await fs.readFile(path.join(outputDirectory, "checksums.sha256"));
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.reviewDecision.status, "not_recorded");
    assert.equal(manifest.eligibleForImport, false);
    assert.equal(manifest.promotionAllowed, false);
    assert.equal(manifest.prohibitedActionsPerformed.sanitizedPdfModified, false);
    const sharedPage = manifest.pageRenderGroups.find((group) => group.coverageCount === 2);
    assert.ok(sharedPage);
    assert.deepEqual(sharedPage.occurrences, [
      { jobId: "salgsmappe-zeta-output-001", pageNumber: 1 },
      { jobId: "salgsmappe-alpha-output-002", pageNumber: 1 },
    ]);
    assert.match(htmlBytes.toString("utf8"), /Afventer menneskelig visuel kontrol/);
    assert.match(htmlBytes.toString("utf8"), /godkender, importerer, uploader eller publicerer intet/);
    assert.match(checksumsBytes.toString("utf8"), /render-review-manifest\.json/);
    outputs.push({ manifestBytes, htmlBytes, checksumsBytes });
  }
  assert.deepEqual(outputs[0].manifestBytes, outputs[1].manifestBytes);
  assert.deepEqual(outputs[0].htmlBytes, outputs[1].htmlBytes);
  assert.deepEqual(outputs[0].checksumsBytes, outputs[1].checksumsBytes);
});

test("chunked rendering caps concurrency while committing pages and occurrences in plan order", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sanitized-render-concurrency-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  await createBatchFixture(root);

  let activeRenders = 0;
  let maximumActiveRenders = 0;
  const completionOrder = [];
  async function reverseCompletionRender(options) {
    activeRenders += 1;
    maximumActiveRenders = Math.max(maximumActiveRenders, activeRenders);
    try {
      const delayMs = options.job.jobId === "salgsmappe-zeta-output-001" ? 40 : 5;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return await fakeRenderPdf(options);
    } finally {
      completionOrder.push(options.job.jobId);
      activeRenders -= 1;
    }
  }

  await runBuilder(root, {
    renderConcurrency: 2,
    renderPdf: reverseCompletionRender,
  });

  assert.equal(maximumActiveRenders, 2);
  assert.deepEqual(completionOrder, [
    "salgsmappe-alpha-output-002",
    "salgsmappe-zeta-output-001",
  ]);
  const manifest = JSON.parse(await fs.readFile(
    path.join(root, "review/sanitized-pdf-render-review/render-review-manifest.json"),
    "utf8"
  ));
  assert.equal(manifest.renderer.concurrency, 2);
  assert.deepEqual(manifest.jobs.map((job) => job.jobId), [
    "salgsmappe-zeta-output-001",
    "salgsmappe-alpha-output-002",
  ]);
  const sharedPage = manifest.pageRenderGroups.find((group) => group.coverageCount === 2);
  assert.ok(sharedPage);
  assert.deepEqual(sharedPage.occurrences, [
    { jobId: "salgsmappe-zeta-output-001", pageNumber: 1 },
    { jobId: "salgsmappe-alpha-output-002", pageNumber: 1 },
  ]);
});

test("chunked rendering rejects invalid concurrency and reports the lower plan-index failure", async (t) => {
  for (const renderConcurrency of [0, 1.5, 9]) {
    await assert.rejects(
      buildSanitizedRenderReview({ runDirectory: ".", renderConcurrency }),
      (error) => (
        error instanceof SanitizedRenderReviewError
        && error.message === "Render concurrency must be an integer from 1 to 8"
      )
    );
  }
  for (const pixelAnalysisConcurrency of [0, 1.5, 9]) {
    await assert.rejects(
      buildSanitizedRenderReview({ runDirectory: ".", pixelAnalysisConcurrency }),
      (error) => (
        error instanceof SanitizedRenderReviewError
        && error.message === "Pixel-analysis concurrency must be an integer from 1 to 8"
      )
    );
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sanitized-render-failure-order-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  await createBatchFixture(root);
  const completionOrder = [];
  let activeRenders = 0;
  let maximumActiveRenders = 0;
  async function reverseFailureRender({ job }) {
    activeRenders += 1;
    maximumActiveRenders = Math.max(maximumActiveRenders, activeRenders);
    try {
      const delayMs = job.jobId === "salgsmappe-zeta-output-001" ? 40 : 5;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      throw new Error(`render failed: ${job.jobId}`);
    } finally {
      completionOrder.push(job.jobId);
      activeRenders -= 1;
    }
  }

  await assert.rejects(
    runBuilder(root, {
      renderConcurrency: 2,
      renderPdf: reverseFailureRender,
    }),
    (error) => error?.message === "render failed: salgsmappe-zeta-output-001"
  );
  assert.equal(maximumActiveRenders, 2);
  assert.deepEqual(completionOrder, [
    "salgsmappe-alpha-output-002",
    "salgsmappe-zeta-output-001",
  ]);
  await assert.rejects(
    fs.lstat(path.join(root, "review/sanitized-pdf-render-review")),
    (error) => error?.code === "ENOENT"
  );
});

test("builder refuses stale batch PDF hashes and leaves no review output", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sanitized-render-stale-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const { jobs } = await createBatchFixture(root);
  await fs.appendFile(path.join(root, jobs[0].sanitizedPdf.path), "changed");
  await assert.rejects(
    runBuilder(root),
    (error) => error instanceof SanitizedRenderReviewError && /byte count changed|SHA-256 changed/.test(error.message)
  );
  await assert.rejects(
    fs.lstat(path.join(root, "review/sanitized-pdf-render-review")),
    (error) => error?.code === "ENOENT"
  );
});

function ppm(width, height, background, rectangles = []) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    pixels[pixel * 3] = background[0];
    pixels[pixel * 3 + 1] = background[1];
    pixels[pixel * 3 + 2] = background[2];
  }
  for (const rectangle of rectangles) {
    for (let y = rectangle.y; y < rectangle.y + rectangle.height; y += 1) {
      for (let x = rectangle.x; x < rectangle.x + rectangle.width; x += 1) {
        const offset = (y * width + x) * 3;
        pixels[offset] = rectangle.color[0];
        pixels[offset + 1] = rectangle.color[1];
        pixels[offset + 2] = rectangle.color[2];
      }
    }
  }
  return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii"), pixels]);
}

function runPython(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stderr = [];
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(Buffer.concat(stderr).toString("utf8")));
      else resolve();
    });
  });
}

test("Python helper performs pixel-level palette checks and writes useful-resolution contact sheets", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sanitized-render-pixels-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const images = [
    { name: "blue.ppm", bytes: ppm(160, 120, [255, 255, 255], [{ x: 10, y: 10, width: 80, height: 35, color: [14, 165, 233] }, { x: 0, y: 0, width: 160, height: 2, color: [0, 0, 0] }]) },
    { name: "gray.ppm", bytes: ppm(160, 120, [209, 213, 219], [{ x: 0, y: 0, width: 160, height: 2, color: [0, 0, 0] }]) },
    { name: "green.ppm", bytes: ppm(160, 120, [255, 255, 255], [{ x: 10, y: 10, width: 80, height: 35, color: [20, 180, 40] }, { x: 0, y: 0, width: 160, height: 2, color: [0, 0, 0] }]) },
    { name: "composited-light-gray.ppm", bytes: ppm(160, 120, [246, 247, 248], [{ x: 0, y: 0, width: 160, height: 2, color: [0, 0, 0] }]) },
  ];
  const requestImages = [];
  for (const image of images) {
    const imagePath = path.join(root, image.name);
    await fs.writeFile(imagePath, image.bytes);
    requestImages.push({ sha256: sha256(image.bytes), path: imagePath });
  }
  const analysisRequest = path.join(root, "analysis-request.json");
  const analysisOutput = path.join(root, "analysis-output.json");
  await fs.writeFile(analysisRequest, JSON.stringify({ images: requestImages, concurrency: 2 }));
  await runPython([HELPER, "analyze", "--request", analysisRequest, "--output", analysisOutput]);
  const analysis = JSON.parse(await fs.readFile(analysisOutput, "utf8"));
  const bySha = new Map(analysis.images.map((row) => [row.sha256, row]));
  assert.ok(bySha.get(requestImages[0].sha256).webprinterBluePixels > 1000);
  assert.ok(bySha.get(requestImages[1].sha256).noPrintGrayRatio > 0.95);
  assert.ok(bySha.get(requestImages[2].sha256).supplierGreenPixels > 1000);
  assert.ok(bySha.get(requestImages[3].sha256).noPrintGrayRatio < 0.01);
  assert.ok(bySha.get(requestImages[3].sha256).effectiveNoPrintGrayRatio > 0.95);
  assert.ok(bySha.get(requestImages[0].sha256).effectiveNoPrintGrayRatio < 0.01);
  assert.equal(bySha.get(requestImages[0].sha256).nonBlankPassed, true);

  const contactPath = path.join(root, "contact.png");
  const contactRequest = path.join(root, "contact-request.json");
  const contactOutput = path.join(root, "contact-output.json");
  await fs.writeFile(contactRequest, JSON.stringify({
    sheets: [{
      id: "contact-sheet-001",
      outputPath: contactPath,
      title: "QA",
      items: [{ label: "A4 · 4+0", details: "1 job", status: "passed", pagePaths: requestImages.slice(0, 2).map((item) => item.path) }],
    }],
  }));
  await runPython([HELPER, "contact-sheets", "--request", contactRequest, "--output", contactOutput]);
  const contact = JSON.parse(await fs.readFile(contactOutput, "utf8"));
  const contactBytes = await fs.readFile(contactPath);
  assert.ok(contactBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE));
  assert.ok(contact.sheets[0].widthPx >= 2000);
  assert.ok(contact.sheets[0].heightPx >= 700);
});
