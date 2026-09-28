#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = "scripts/product-import/build-wmd-sales-folder-sanitized-render-review.js";
const REPOSITORY_DIRECTORY = fileURLToPath(new URL("../../", import.meta.url));
const SANITIZER_IMPLEMENTATION_PATH = "scripts/product-templates/sanitize_wmd_sales_folder_template.py";
const DEFAULT_BATCH_MANIFEST_PATH = "documents/sanitization-batch/manifest.json";
const SANITIZATION_PLAN_PATH = "review/template-sanitization-plan.json";
const DEFAULT_OUTPUT_PATH = "review/sanitized-pdf-render-review";
const DEFAULT_PYTHON_HELPER = fileURLToPath(
  new URL("./analyze_wmd_sales_folder_sanitized_renders.py", import.meta.url)
);
const DEFAULT_FONTCONFIG_FILE = fileURLToPath(
  new URL("./wmd-sanitized-render-fonts.conf", import.meta.url)
);
const DEFAULT_PDFTOPPM = "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm";
const DEFAULT_PYTHON = "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

export const PIXEL_POLICY = Object.freeze({
  palette: Object.freeze({
    webprinterBlue: "#0EA5E9",
    webprinterBlueBorder: "#0284C7",
    noPrintGray: "#D1D5DB",
  }),
  nonBlank: Object.freeze({
    minimumNonWhiteRatio: 0.0005,
    minimumNonWhitePixels: 100,
    minimumQuantizedColors: 2,
    minimumChannelRange: 8,
  }),
  pageOneWebprinterPanel: Object.freeze({
    minimumBlueRatio: 0.00005,
    minimumBluePixels: 50,
  }),
  supplierGreen: Object.freeze({ maximumHighConfidencePixels: 0 }),
  fullPageNoPrintGray: Object.freeze({
    minimumGrayRatio: 0.65,
    exactOperatorColor: "#D1D5DB",
    effectiveCompositeMinimumChannel: 175,
    effectiveCompositeMaximumChannel: 250,
    effectiveCompositeMaximumChannelSpread: 12,
  }),
  expectedPageCount: 2,
});

const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  batchManifestModified: false,
  sanitizedPdfModified: false,
  sanitizedPdfApproved: false,
  visualApprovalRecorded: false,
  designerTemplateAttached: false,
  designerExported: false,
  sourcePdfModified: false,
  uploaded: false,
  databaseWritten: false,
  productWritten: false,
  pricingWritten: false,
  published: false,
});

export class SanitizedRenderReviewError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "SanitizedRenderReviewError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new SanitizedRenderReviewError(message, details);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function validSha256(value, label) {
  const normalized = String(value || "");
  assert(SHA256_PATTERN.test(normalized), `${label} must be a lowercase SHA-256`);
  return normalized;
}

function safeRelativePath(value, label, requiredPrefix = null) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized && !path.posix.isAbsolute(normalized), `${label} must be a relative path`);
  assert(!normalized.split("/").includes(".."), `${label} cannot escape the run directory`);
  if (requiredPrefix) assert(normalized.startsWith(requiredPrefix), `${label} must start with ${requiredPrefix}`);
  return normalized;
}

function pathWithin(root, relativePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label} escapes its allowed root`);
  return resolved;
}

function assertAllFalse(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const entries = Object.entries(value);
  assert(entries.length > 0, `${label} cannot be empty`);
  for (const [key, state] of entries) assert(state === false, `${label}.${key} must remain false`);
}

async function defaultProcessRunner(command, args, {
  timeoutMs = 600_000,
  env = process.env,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], env });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new SanitizedRenderReviewError(`Timed out running ${path.basename(command)}`)));
    }, timeoutMs);
    const capture = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 8 * 1024 * 1024) {
        child.kill("SIGKILL");
        finish(() => reject(new SanitizedRenderReviewError(`${path.basename(command)} output exceeded 8 MiB`)));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code !== 0) {
        reject(new SanitizedRenderReviewError(
          `${path.basename(command)} exited ${code}: ${result.stderr.trim() || "no stderr"}`
        ));
        return;
      }
      resolve(result);
    }));
  });
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function verifyRegularEvidence(allowedRoot, reference, label, {
  signature = null,
  allowedRootLabel = "run directory",
} = {}) {
  assert(reference && typeof reference === "object" && !Array.isArray(reference), `${label} must be an object`);
  const relativePath = safeRelativePath(reference.path, `${label}.path`);
  const expectedSha256 = validSha256(reference.sha256, `${label}.sha256`);
  assert(Number.isInteger(reference.bytes) && reference.bytes > 0, `${label}.bytes must be a positive integer`);
  const absolutePath = pathWithin(allowedRoot, relativePath, `${label}.path`);
  let stat;
  try {
    stat = await fs.lstat(absolutePath);
  } catch (error) {
    throw new SanitizedRenderReviewError(`${label} is missing: ${relativePath}`, { cause: error.message });
  }
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular non-symlink file: ${relativePath}`);
  assert(stat.size === reference.bytes, `${label} byte count changed: ${relativePath}`);
  const realRoot = await fs.realpath(allowedRoot);
  const realPath = await fs.realpath(absolutePath);
  assert(realPath.startsWith(`${realRoot}${path.sep}`), `${label} resolves outside the ${allowedRootLabel}`);
  if (signature) {
    const handle = await fs.open(absolutePath, "r");
    try {
      const prefix = Buffer.alloc(signature.length);
      const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
      assert(bytesRead === signature.length && prefix.equals(signature), `${label} has an unexpected file signature`);
    } finally {
      await handle.close();
    }
  }
  const actualSha256 = await sha256File(absolutePath);
  assert(actualSha256 === expectedSha256, `${label} SHA-256 changed: ${relativePath}`);
  return { relativePath, absolutePath, sha256: actualSha256, bytes: stat.size };
}

function validateJob(job, index) {
  const label = `Batch job ${index + 1}`;
  assert(job && typeof job === "object" && !Array.isArray(job), `${label} must be an object`);
  const jobId = String(job.jobId || "");
  assert(/^[a-z0-9][a-z0-9._-]{0,159}$/u.test(jobId), `${label}.jobId is unsafe`);
  validSha256(job.safeOutputSignatureSha256, `${label}.safeOutputSignatureSha256`);
  assert(job.state === "sanitized_render_review_required", `${label} has an unexpected state`);
  assert(job.visualReviewPending === true, `${label} must remain pending visual review`);
  assert(job.designerLockedOverlayVerificationPending === true, `${label} must keep Designer overlay verification pending`);
  assert(job.designerExportExclusionVerificationPending === true, `${label} must keep Designer export-exclusion verification pending`);
  assert(job.eligibleForTemplateImport === false, `${label} cannot be template-import eligible`);
  assert(job.eligibleForImport === false, `${label} cannot be import eligible`);
  assertAllFalse(job.prohibitedActionsPerformed, `${label}.prohibitedActionsPerformed`);
  assert(job.geometry && typeof job.geometry === "object", `${label}.geometry is missing`);
  for (const key of ["format", "construction", "expectedGeometryKey"]) {
    assert(typeof job.geometry[key] === "string" && job.geometry[key], `${label}.geometry.${key} is missing`);
  }
  assert(["4+0", "4+4"].includes(job.geometry.print), `${label}.geometry.print must be 4+0 or 4+4`);
  assert(
    job.geometry.spineMm === null || Number.isFinite(Number(job.geometry.spineMm)),
    `${label}.geometry.spineMm is invalid`
  );
  assert(typeof job.finishKey === "string" && job.finishKey, `${label}.finishKey is missing`);
  assert(Number.isInteger(job.coveredBindingCount) && job.coveredBindingCount > 0, `${label}.coveredBindingCount is invalid`);
  validSha256(job.coveredBindingKeysSha256, `${label}.coveredBindingKeysSha256`);
  for (const key of ["source", "contract", "sanitizedPdf", "inspection"]) {
    assert(job[key] && typeof job[key] === "object", `${label}.${key} is missing`);
    safeRelativePath(job[key].path, `${label}.${key}.path`);
    validSha256(job[key].sha256, `${label}.${key}.sha256`);
    assert(Number.isInteger(job[key].bytes) && job[key].bytes > 0, `${label}.${key}.bytes is invalid`);
  }
  safeRelativePath(job.sanitizedPdf.path, `${label}.sanitizedPdf.path`, "documents/sanitized-pdfs/");
  safeRelativePath(job.inspection.path, `${label}.inspection.path`, "documents/sanitization-inspections/");
  assert(job.executionEvidence && typeof job.executionEvidence === "object", `${label}.executionEvidence is missing`);
  assert(
    Object.keys(job.executionEvidence).sort().join("|") === "geometryAudit|geometrySupplement|templateResolutionPlan|verifiedBeschnittGuideDonorReport",
    `${label}.executionEvidence has an unexpected shape`
  );
  assert(job.executionEvidence.geometryAudit && typeof job.executionEvidence.geometryAudit === "object", `${label}.executionEvidence.geometryAudit is missing`);
  for (const key of ["geometryAudit", "geometrySupplement", "templateResolutionPlan", "verifiedBeschnittGuideDonorReport"]) {
    const reference = job.executionEvidence[key];
    if (reference === null) continue;
    assert(reference && typeof reference === "object" && !Array.isArray(reference), `${label}.executionEvidence.${key} is invalid`);
    safeRelativePath(reference.path, `${label}.executionEvidence.${key}.path`);
    validSha256(reference.sha256, `${label}.executionEvidence.${key}.sha256`);
    assert(Number.isInteger(reference.bytes) && reference.bytes > 0, `${label}.executionEvidence.${key}.bytes is invalid`);
    if (key === "verifiedBeschnittGuideDonorReport") {
      validSha256(reference.entrySha256, `${label}.executionEvidence.${key}.entrySha256`);
    } else {
      assert(!("entrySha256" in reference), `${label}.executionEvidence.${key} cannot claim a donor entry`);
    }
  }
  return jobId;
}

export function validateBatchManifest(
  manifest,
  { expectedJobs = 1420, expectedPlanJobs = null, expectedDonorJobs = 5 } = {}
) {
  assert(manifest?.kind === "wmd_sales_folder_sanitization_batch_manifest", "Unexpected batch manifest kind");
  assert(manifest?.schemaVersion === 1, "Batch manifest schemaVersion must be 1");
  assert(manifest?.state === "sanitized_render_review_required", "Batch manifest state is not render-review ready");
  assert(manifest?.reviewState === "sanitized_render_review_required", "Batch manifest reviewState is not render-review ready");
  assert(manifest?.localOnly === true, "Batch manifest must be local-only");
  assert(manifest?.eligibleForTemplateImport === false, "Batch manifest cannot be template-import eligible");
  assert(manifest?.eligibleForImport === false, "Batch manifest cannot be import eligible");
  assert(manifest?.visualReviewPending === true, "Batch manifest must remain pending visual review");
  assert(manifest?.designerLockedOverlayVerificationPending === true, "Batch manifest must keep Designer overlay verification pending");
  assert(manifest?.designerExportExclusionVerificationPending === true, "Batch manifest must keep Designer export-exclusion verification pending");
  assertAllFalse(manifest?.prohibitedActionsPerformed, "Batch manifest prohibitedActionsPerformed");
  assert(manifest?.inputEvidence && typeof manifest.inputEvidence === "object", "Batch inputEvidence is missing");
  assert(Array.isArray(manifest?.jobs), "Batch manifest jobs must be an array");
  assert(Number.isInteger(expectedJobs) && expectedJobs > 0, "Expected job count must be a positive integer");
  assert(
    Number.isInteger(expectedDonorJobs) && expectedDonorJobs >= 0 && expectedDonorJobs <= expectedJobs,
    "Expected Beschnitt donor-job count is invalid"
  );
  assert(manifest.jobs.length === expectedJobs, `Expected ${expectedJobs} batch jobs, found ${manifest.jobs.length}`);
  const jobIds = manifest.jobs.map(validateJob);
  assert(new Set(jobIds).size === jobIds.length, "Batch jobId values are not unique");
  assert(
    new Set(manifest.jobs.map((job) => job.safeOutputSignatureSha256)).size === manifest.jobs.length,
    "Batch safeOutputSignatureSha256 values are not unique"
  );
  assert(
    new Set(manifest.jobs.map((job) => job.sanitizedPdf.path)).size === manifest.jobs.length,
    "Batch sanitized PDF paths are not unique"
  );
  assert(manifest.counts && typeof manifest.counts === "object", "Batch counts are missing");
  assert(manifest.counts.expectedOutputCount === manifest.jobs.length, "Batch counts.expectedOutputCount differs from jobs.length");
  assert(manifest.counts.sanitizedPdfs === manifest.jobs.length, "Batch counts.sanitizedPdfs differs from jobs.length");
  assert(manifest.counts.inspections === manifest.jobs.length, "Batch counts.inspections differs from jobs.length");
  assert(manifest.counts.jobs === manifest.jobs.length, "Batch counts.jobs differs from jobs.length");
  assert(
    manifest.counts.coveredBindingReferences === manifest.jobs.reduce((sum, job) => sum + job.coveredBindingCount, 0),
    "Batch counts.coveredBindingReferences differs from job coverage"
  );
  const donorJobs = manifest.jobs.filter(
    (job) => job.executionEvidence.verifiedBeschnittGuideDonorReport !== null
  );
  assert(
    donorJobs.length === expectedDonorJobs,
    `Expected exactly ${expectedDonorJobs} verified Beschnitt donor jobs, found ${donorJobs.length}`
  );
  if (expectedPlanJobs !== null) {
    assert(Array.isArray(expectedPlanJobs) && expectedPlanJobs.length === manifest.jobs.length, "Pinned plan job coverage is incomplete");
    for (const [index, job] of manifest.jobs.entries()) {
      const planJob = expectedPlanJobs[index];
      assert(
        job.jobId === planJob.jobId,
        `Batch job order differs from the hash-pinned plan at position ${index + 1}: expected ${planJob.jobId}, found ${job.jobId}`
      );
      assert(
        job.safeOutputSignatureSha256 === planJob.safeOutputSignatureSha256,
        `Batch safe-output signature differs from the hash-pinned plan for ${job.jobId}`
      );
    }
  }
  return manifest.jobs;
}

export function validateDonorContractEvidence(job, contract) {
  assert(contract && typeof contract === "object" && !Array.isArray(contract), `${job.jobId} contract JSON is invalid`);
  assert(
    Object.prototype.hasOwnProperty.call(contract, "verifiedBeschnittGuideDonor"),
    `${job.jobId} contract does not explicitly classify Beschnitt donor evidence`
  );
  const batchDonor = job.executionEvidence.verifiedBeschnittGuideDonorReport;
  const contractDonor = contract.verifiedBeschnittGuideDonor;
  if (batchDonor === null) {
    assert(contractDonor === null, `${job.jobId} contract claims donor evidence omitted by the batch manifest`);
    return { donor: false };
  }
  assert(contractDonor && typeof contractDonor === "object" && !Array.isArray(contractDonor), `${job.jobId} batch donor evidence is not pinned by its contract`);
  assert(contractDonor.reportSha256 === batchDonor.sha256, `${job.jobId} donor report SHA differs between contract and batch manifest`);
  assert(contractDonor.entrySha256 === batchDonor.entrySha256, `${job.jobId} donor entry SHA differs between contract and batch manifest`);
  const contractReport = contract?.batchEvidence?.verifiedBeschnittGuideDonors;
  assert(contractReport && typeof contractReport === "object", `${job.jobId} contract lacks donor report file evidence`);
  for (const key of ["path", "sha256", "bytes"]) {
    assert(contractReport[key] === batchDonor[key], `${job.jobId} donor report ${key} differs between contract and batch manifest`);
  }
  if ("verifiedBeschnittGuideDonorEntrySha256" in (contract.batchEvidence || {})) {
    assert(
      contract.batchEvidence.verifiedBeschnittGuideDonorEntrySha256 === batchDonor.entrySha256,
      `${job.jobId} contract batchEvidence donor entry SHA is inconsistent`
    );
  }
  return { donor: true, reportSha256: batchDonor.sha256, entrySha256: batchDonor.entrySha256 };
}

function validatePinnedPlan(plan, expectedJobs) {
  assert(plan?.kind === "wmd_sales_folder_sanitization_batch_plan", "Sanitization proposal plan kind is invalid");
  assert(plan?.schemaVersion === 1, "Sanitization proposal plan schemaVersion must be 1");
  assert(plan?.state === "pending_review" && plan?.reviewState === "pending_review", "Sanitization proposal plan must remain pending review");
  assert(plan?.localOnly === true, "Sanitization proposal plan must remain local-only");
  assert(plan?.eligibleForSanitization === false, "Sanitization proposal plan cannot self-authorize sanitization");
  assert(plan?.eligibleForTemplateImport === false, "Sanitization proposal plan cannot authorize template import");
  assert(Array.isArray(plan?.jobs) && plan.jobs.length === expectedJobs, "Sanitization proposal plan has incomplete job coverage");
  assert(plan?.counts?.outputJobs === expectedJobs, "Sanitization proposal plan outputJobs count is inconsistent");
  assert(plan?.counts?.expectedReviewedContracts === expectedJobs, "Sanitization proposal plan contract count is inconsistent");
  assert(plan?.counts?.expectedSanitizedPdfs === expectedJobs, "Sanitization proposal plan PDF count is inconsistent");
  assert(plan?.counts?.expectedInspections === expectedJobs, "Sanitization proposal plan inspection count is inconsistent");
  const seenJobIds = new Set();
  const seenSignatures = new Set();
  return plan.jobs.map((job, index) => {
    assert(job && typeof job === "object" && !Array.isArray(job), `Sanitization proposal plan job ${index + 1} is invalid`);
    const jobId = String(job.jobId || "");
    assert(/^[a-z0-9][a-z0-9._-]{0,159}$/u.test(jobId), `Sanitization proposal plan job ${index + 1} has an unsafe id`);
    assert(!seenJobIds.has(jobId), `Sanitization proposal plan repeats jobId ${jobId}`);
    seenJobIds.add(jobId);
    const signatureSha256 = validSha256(job.safeOutputSignatureSha256, `Sanitization proposal plan ${jobId} signature`);
    assert(job.safeOutputSignature && typeof job.safeOutputSignature === "object", `Sanitization proposal plan ${jobId} lacks its signature payload`);
    assert(sha256Json(job.safeOutputSignature) === signatureSha256, `Sanitization proposal plan ${jobId} signature hash is invalid`);
    assert(!seenSignatures.has(signatureSha256), `Sanitization proposal plan repeats signature ${signatureSha256}`);
    seenSignatures.add(signatureSha256);
    return { jobId, safeOutputSignatureSha256: signatureSha256 };
  });
}

function parseShaSidecar(text, expectedBasename) {
  const lines = String(text).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  assert(lines.length === 1, "Batch manifest SHA-256 sidecar must contain exactly one record");
  const match = lines[0].match(/^([a-f0-9]{64})(?:\s+\*?(.+))?$/u);
  assert(match, "Batch manifest SHA-256 sidecar is malformed");
  if (match[2]) assert(path.posix.basename(match[2].replaceAll("\\", "/")) === expectedBasename, "Batch manifest SHA-256 sidecar names a different file");
  return match[1];
}

function parseChecksums(text) {
  const records = [];
  for (const rawLine of String(text).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/u);
    assert(match, `Malformed checksums.sha256 line: ${line}`);
    records.push({ sha256: match[1], path: match[2].replaceAll("\\", "/") });
  }
  assert(records.length > 0, "checksums.sha256 is empty");
  assert(new Set(records.map((record) => record.path)).size === records.length, "checksums.sha256 repeats a path");
  return records;
}

function checksumRecordFor(records, runDirectory, batchDirectory, absolutePath) {
  const matches = records.filter((record) => {
    if (path.posix.isAbsolute(record.path) || record.path.split("/").includes("..")) return false;
    const fromRun = path.resolve(runDirectory, record.path);
    const fromBatch = path.resolve(batchDirectory, record.path);
    return fromRun === absolutePath || fromBatch === absolutePath;
  });
  assert(matches.length === 1, `checksums.sha256 must pin exactly one record for ${path.relative(runDirectory, absolutePath)}`);
  return matches[0];
}

function collectNestedEvidence(value, output = [], seenObjects = new Set()) {
  if (!value || typeof value !== "object" || seenObjects.has(value)) return output;
  seenObjects.add(value);
  if (!Array.isArray(value) && "path" in value && "sha256" in value && "bytes" in value) output.push(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) collectNestedEvidence(child, output, seenObjects);
  return output;
}

async function readBatchInput(runDirectory, batchManifestRelativePath, expectedJobs, expectedDonorJobs) {
  const relativePath = safeRelativePath(batchManifestRelativePath, "Batch manifest path", "documents/sanitization-batch/");
  const absolutePath = pathWithin(runDirectory, relativePath, "Batch manifest path");
  const stat = await fs.lstat(absolutePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), "Batch manifest must be a regular non-symlink file");
  const bytes = await fs.readFile(absolutePath);
  const sha256 = sha256Bytes(bytes);
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new SanitizedRenderReviewError(`Cannot parse batch manifest: ${error.message}`);
  }
  const planReference = manifest?.inputEvidence?.sanitizationProposalPlan;
  assert(planReference?.path === SANITIZATION_PLAN_PATH, `Batch manifest must pin ${SANITIZATION_PLAN_PATH}`);
  const verifiedPlan = await verifyRegularEvidence(runDirectory, planReference, "Sanitization proposal plan");
  const planBytes = await fs.readFile(verifiedPlan.absolutePath);
  assert(planBytes.length === verifiedPlan.bytes && sha256Bytes(planBytes) === verifiedPlan.sha256, "Sanitization proposal plan changed while it was parsed");
  let plan;
  try {
    plan = JSON.parse(planBytes.toString("utf8"));
  } catch (error) {
    throw new SanitizedRenderReviewError(`Cannot parse sanitization proposal plan: ${error.message}`);
  }
  const expectedPlanJobs = validatePinnedPlan(plan, expectedJobs);
  const jobs = validateBatchManifest(manifest, { expectedJobs, expectedPlanJobs, expectedDonorJobs });
  const batchDirectory = path.dirname(absolutePath);
  const sidecarPath = `${absolutePath}.sha256`;
  const sidecarStat = await fs.lstat(sidecarPath);
  assert(sidecarStat.isFile() && !sidecarStat.isSymbolicLink(), "Batch manifest SHA-256 sidecar is missing or unsafe");
  const sidecarBytes = await fs.readFile(sidecarPath);
  assert(parseShaSidecar(sidecarBytes.toString("utf8"), path.basename(absolutePath)) === sha256, "Batch manifest SHA-256 sidecar is stale");

  const checksumsPath = path.join(batchDirectory, "checksums.sha256");
  const checksumsStat = await fs.lstat(checksumsPath);
  assert(checksumsStat.isFile() && !checksumsStat.isSymbolicLink(), "Batch checksums.sha256 is missing or unsafe");
  const checksumsBytes = await fs.readFile(checksumsPath);
  const checksumRecords = parseChecksums(checksumsBytes.toString("utf8"));
  assert(checksumRecordFor(checksumRecords, runDirectory, batchDirectory, absolutePath).sha256 === sha256, "Batch checksums.sha256 has a stale manifest hash");
  assert(
    checksumRecords.length === 1 + jobs.length * 2,
    `Batch checksums.sha256 must contain exactly manifest + PDF + inspection rows; found ${checksumRecords.length}`
  );
  for (const job of jobs) {
    const sanitizedAbsolutePath = pathWithin(runDirectory, job.sanitizedPdf.path, `${job.jobId} sanitized PDF path`);
    const inspectionAbsolutePath = pathWithin(runDirectory, job.inspection.path, `${job.jobId} inspection path`);
    assert(
      checksumRecordFor(checksumRecords, runDirectory, batchDirectory, sanitizedAbsolutePath).sha256 === job.sanitizedPdf.sha256,
      `Batch checksums.sha256 has a stale sanitized PDF hash for ${job.jobId}`
    );
    assert(
      checksumRecordFor(checksumRecords, runDirectory, batchDirectory, inspectionAbsolutePath).sha256 === job.inspection.sha256,
      `Batch checksums.sha256 has a stale inspection hash for ${job.jobId}`
    );
  }

  return {
    manifest,
    jobs,
    absolutePath,
    relativePath,
    sha256,
    bytes: bytes.length,
    sidecar: {
      path: `${relativePath}.sha256`,
      sha256: sha256Bytes(sidecarBytes),
      bytes: sidecarBytes.length,
    },
    checksums: {
      path: path.posix.join(path.posix.dirname(relativePath), "checksums.sha256"),
      absolutePath: checksumsPath,
      sha256: sha256Bytes(checksumsBytes),
      bytes: checksumsBytes.length,
      records: checksumRecords,
    },
    sanitizationPlan: {
      path: planReference.path,
      sha256: verifiedPlan.sha256,
      bytes: verifiedPlan.bytes,
      absolutePath: verifiedPlan.absolutePath,
      jobIdsSha256: sha256Json(expectedPlanJobs.map((job) => job.jobId)),
    },
  };
}

async function verifyBatchEvidence(runDirectory, batchInput) {
  const cache = new Map();
  async function verify(reference, label, options = {}) {
    const normalizedPath = safeRelativePath(reference.path, `${label}.path`);
    const identity = `${normalizedPath}|${reference.sha256}|${reference.bytes}|${options.signature ? options.signature.toString("hex") : ""}`;
    if (!cache.has(identity)) cache.set(identity, verifyRegularEvidence(runDirectory, reference, label, options));
    const evidence = await cache.get(identity);
    if (options.requireBatchChecksum === true) {
      const checksum = checksumRecordFor(
        batchInput.checksums.records,
        runDirectory,
        path.dirname(batchInput.absolutePath),
        evidence.absolutePath
      );
      assert(checksum.sha256 === evidence.sha256, `Batch checksums.sha256 is stale for ${normalizedPath}`);
    }
    return evidence;
  }

  const sanitizerImplementation = batchInput.manifest.inputEvidence?.sanitizerImplementation;
  assert(
    sanitizerImplementation && typeof sanitizerImplementation === "object" && !Array.isArray(sanitizerImplementation),
    "Batch inputEvidence.sanitizerImplementation must be an object"
  );
  assert(
    sanitizerImplementation.path === SANITIZER_IMPLEMENTATION_PATH,
    `Batch sanitizer implementation must pin ${SANITIZER_IMPLEMENTATION_PATH}`
  );
  assert(
    sanitizerImplementation.entrypoint === "run_sanitize",
    "Batch sanitizer implementation must pin the run_sanitize entrypoint"
  );
  const verifiedSanitizerImplementation = await verifyRegularEvidence(
    REPOSITORY_DIRECTORY,
    sanitizerImplementation,
    "batch sanitizer implementation",
    { allowedRootLabel: "repository directory" }
  );

  const batchExecutionEvidence = [];
  for (const [index, reference] of collectNestedEvidence(batchInput.manifest.inputEvidence).entries()) {
    batchExecutionEvidence.push(
      reference === sanitizerImplementation
        ? verifiedSanitizerImplementation
        : await verify(reference, `batch input evidence ${index + 1}`)
    );
  }
  assert(batchExecutionEvidence.length >= 3, "Batch inputEvidence does not contain the required hash-pinned plan, contract, and sanitizer files");

  const verifiedJobs = [];
  for (const job of batchInput.jobs) {
    const source = await verify(job.source, `${job.jobId} source`, { signature: PDF_SIGNATURE });
    const contract = await verify(job.contract, `${job.jobId} contract`);
    let contractValue;
    try {
      contractValue = JSON.parse(await fs.readFile(contract.absolutePath, "utf8"));
    } catch (error) {
      throw new SanitizedRenderReviewError(`${job.jobId} contract is not valid UTF-8 JSON: ${error.message}`);
    }
    validateDonorContractEvidence(job, contractValue);
    const sanitizedPdf = await verify(job.sanitizedPdf, `${job.jobId} sanitized PDF`, {
      signature: PDF_SIGNATURE,
      requireBatchChecksum: true,
    });
    const inspection = await verify(job.inspection, `${job.jobId} inspection`, { requireBatchChecksum: true });
    const nested = [];
    for (const [index, reference] of collectNestedEvidence(job.executionEvidence).entries()) {
      nested.push(await verify(reference, `${job.jobId} execution evidence ${index + 1}`));
    }
    assert(nested.length > 0, `${job.jobId} executionEvidence contains no hash-pinned files`);
    verifiedJobs.push({ job, source, contract, sanitizedPdf, inspection, nested });
  }
  return { verifiedJobs, batchExecutionEvidence, cache };
}

async function rendererVersion(rendererBinary, processRunner) {
  const result = await processRunner(rendererBinary, ["-v"], { timeoutMs: 30_000 });
  const version = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^pdftoppm version /iu.test(line));
  assert(version, "Could not read a pdftoppm version line");
  return {
    version,
    stdoutSha256: sha256Bytes(Buffer.from(result.stdout, "utf8")),
    stderrSha256: sha256Bytes(Buffer.from(result.stderr, "utf8")),
  };
}

async function pythonVersion(pythonBinary, processRunner) {
  const result = await processRunner(pythonBinary, ["--version"], { timeoutMs: 30_000 });
  const version = `${result.stdout}\n${result.stderr}`.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
  assert(/^Python \d+\.\d+/u.test(version || ""), "Could not read the Python version");
  return String(version);
}

async function defaultRenderPdf({
  rendererBinary,
  processRunner,
  dpi,
  inputPath,
  outputDirectory,
  fontConfigFile,
  fontCacheDirectory,
}) {
  await fs.mkdir(outputDirectory, { recursive: false, mode: 0o700 });
  const outputPrefix = path.join(outputDirectory, "page");
  await processRunner(rendererBinary, ["-png", "-r", String(dpi), inputPath, outputPrefix], {
    timeoutMs: 600_000,
    env: {
      ...process.env,
      FONTCONFIG_FILE: fontConfigFile,
      XDG_CACHE_HOME: fontCacheDirectory,
    },
  });
  const files = (await fs.readdir(outputDirectory))
    .map((name) => {
      const match = name.match(/^page-(\d+)\.png$/u);
      return match ? { name, pageNumber: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  assert(files.length > 0, `pdftoppm produced no pages for ${path.basename(inputPath)}`);
  assert(files.every((file, index) => file.pageNumber === index + 1), "pdftoppm produced an incomplete page sequence");
  return files.map((file) => ({ pageNumber: file.pageNumber, absolutePath: path.join(outputDirectory, file.name) }));
}

async function defaultPixelAnalyzer({
  pythonBinary,
  helperPath,
  processRunner,
  images,
  workDirectory,
  analysisConcurrency,
}) {
  const requestPath = path.join(workDirectory, "pixel-analysis-request.json");
  const outputPath = path.join(workDirectory, "pixel-analysis-result.json");
  await fs.writeFile(requestPath, `${JSON.stringify({ images, concurrency: analysisConcurrency }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await processRunner(pythonBinary, [helperPath, "analyze", "--request", requestPath, "--output", outputPath], { timeoutMs: 1_800_000 });
  return JSON.parse(await fs.readFile(outputPath, "utf8"));
}

async function defaultContactSheetBuilder({ pythonBinary, helperPath, processRunner, sheets, workDirectory }) {
  const requestPath = path.join(workDirectory, "contact-sheet-request.json");
  const outputPath = path.join(workDirectory, "contact-sheet-result.json");
  await fs.writeFile(requestPath, `${JSON.stringify({ sheets }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await processRunner(pythonBinary, [helperPath, "contact-sheets", "--request", requestPath, "--output", outputPath], { timeoutMs: 1_800_000 });
  return JSON.parse(await fs.readFile(outputPath, "utf8"));
}

function evaluateCheck(id, passed, evidence) {
  return { id, status: passed ? "passed" : "failed", evidence };
}

export function evaluateJobPixelChecks(job, pages, policy = PIXEL_POLICY) {
  const checks = [];
  checks.push(evaluateCheck(
    "exact_two_page_render",
    pages.length === policy.expectedPageCount,
    { expected: policy.expectedPageCount, observed: pages.length }
  ));
  for (const page of pages) {
    checks.push(evaluateCheck(
      `page_${page.pageNumber}_nonblank`,
      page.analysis.nonBlankPassed === true,
      {
        nonWhitePixels: page.analysis.nonWhitePixels,
        nonWhiteRatio: page.analysis.nonWhiteRatio,
        quantizedColorCount: page.analysis.quantizedColorCount,
        channelRange: page.analysis.channelRange,
      }
    ));
    checks.push(evaluateCheck(
      `page_${page.pageNumber}_no_supplier_green`,
      page.analysis.supplierGreenPixels <= policy.supplierGreen.maximumHighConfidencePixels,
      {
        supplierGreenPixels: page.analysis.supplierGreenPixels,
        maximumHighConfidencePixels: policy.supplierGreen.maximumHighConfidencePixels,
      }
    ));
  }
  const pageOne = pages.find((page) => page.pageNumber === 1);
  checks.push(evaluateCheck(
    "page_1_webprinter_blue_panel",
    Boolean(pageOne) &&
      pageOne.analysis.webprinterBluePixels >= policy.pageOneWebprinterPanel.minimumBluePixels &&
      pageOne.analysis.webprinterBlueRatio >= policy.pageOneWebprinterPanel.minimumBlueRatio,
    {
      webprinterBluePixels: pageOne?.analysis.webprinterBluePixels ?? 0,
      webprinterBlueRatio: pageOne?.analysis.webprinterBlueRatio ?? 0,
      minimumBluePixels: policy.pageOneWebprinterPanel.minimumBluePixels,
      minimumBlueRatio: policy.pageOneWebprinterPanel.minimumBlueRatio,
    }
  ));
  const pageTwo = pages.find((page) => page.pageNumber === 2);
  if (job.geometry.print === "4+0") {
    checks.push(evaluateCheck(
      "four_plus_zero_page_2_full_no_print_gray",
      Boolean(pageTwo) && pageTwo.analysis.effectiveNoPrintGrayRatio >= policy.fullPageNoPrintGray.minimumGrayRatio,
      {
        pageTwoPresent: Boolean(pageTwo),
        exactNoPrintGrayRatio: pageTwo?.analysis.noPrintGrayRatio ?? 0,
        effectiveNoPrintGrayRatio: pageTwo?.analysis.effectiveNoPrintGrayRatio ?? 0,
        minimumGrayRatio: policy.fullPageNoPrintGray.minimumGrayRatio,
      }
    ));
  } else {
    const grayPages = pages.filter(
      (page) => page.analysis.effectiveNoPrintGrayRatio >= policy.fullPageNoPrintGray.minimumGrayRatio
    );
    checks.push(evaluateCheck(
      "four_plus_four_has_no_generated_full_page_gray",
      grayPages.length === 0,
      {
        grayPageNumbers: grayPages.map((page) => page.pageNumber),
        fullPageGrayThreshold: policy.fullPageNoPrintGray.minimumGrayRatio,
      }
    ));
  }
  const failedCheckIds = checks.filter((check) => check.status === "failed").map((check) => check.id);
  return {
    state: failedCheckIds.length === 0
      ? "automated_pixel_checks_passed_human_review_pending"
      : "automated_pixel_checks_failed_human_review_pending",
    passed: failedCheckIds.length === 0,
    failedCheckIds,
    checks,
  };
}

function geometryLabel(job) {
  const spine = job.geometry.spineMm === null ? "uden ryg" : `${job.geometry.spineMm} mm ryg`;
  return `${job.geometry.format} · ${job.geometry.construction} · ${job.geometry.print} · ${spine} · ${job.finishKey}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildReviewHtml(manifest) {
  const contactSheets = manifest.contactSheets.map((sheet) => `
    <a class="sheet" href="${escapeHtml(sheet.path)}">
      <img loading="lazy" src="${escapeHtml(sheet.path)}" alt="${escapeHtml(sheet.labelDa)}">
      <span>${escapeHtml(sheet.labelDa)} · ${sheet.itemCount} dokumentgrupper</span>
    </a>`).join("\n");
  const failures = manifest.jobs.filter((job) => !job.automatedChecks.passed).map((job) => `
    <tr data-search="${escapeHtml(`${job.jobId} ${geometryLabel(job)} ${job.automatedChecks.failedCheckIds.join(" ")}`.toLowerCase())}">
      <td><code>${escapeHtml(job.jobId)}</code></td>
      <td>${escapeHtml(geometryLabel(job))}</td>
      <td>${escapeHtml(job.automatedChecks.failedCheckIds.join(", "))}</td>
      <td><a href="#${escapeHtml(job.documentRenderGroupSha256)}">Vis rendergruppe</a></td>
    </tr>`).join("\n");
  const documentGroups = manifest.documentRenderGroups.map((group) => {
    const representative = manifest.jobs.find((job) => job.jobId === group.representativeJobId);
    const images = group.pages.map((page) => `
      <figure><a href="${escapeHtml(page.path)}"><img loading="lazy" src="${escapeHtml(page.path)}" alt="Side ${page.pageNumber}"></a><figcaption>Side ${page.pageNumber} · <code>${escapeHtml(page.sha256.slice(0, 16))}…</code></figcaption></figure>`).join("");
    return `
      <article class="document ${group.automatedCheckState.includes("failed") ? "failed" : "passed"}" id="${escapeHtml(group.sha256)}" data-state="${group.automatedCheckState.includes("failed") ? "failed" : "passed"}" data-search="${escapeHtml(`${group.representativeJobId} ${geometryLabel(representative)} ${group.jobIds.join(" ")}`.toLowerCase())}">
        <header><div><h3>${escapeHtml(geometryLabel(representative))}</h3><p><code>${escapeHtml(group.sha256)}</code></p></div><span>${group.jobCount} job${group.jobCount === 1 ? "" : "s"}</span></header>
        <div class="pages">${images}</div>
      </article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Salgsmapper · visuel QA af saniterede PDF'er</title>
  <style>
    :root { color-scheme: light; --blue:#0EA5E9; --blue-dark:#0284C7; --ink:#0f172a; --muted:#64748b; --line:#cbd5e1; --soft:#f8fafc; --bad:#b91c1c; --good:#15803d; }
    * { box-sizing:border-box; } body { margin:0; background:#fff; color:var(--ink); font:15px/1.5 Inter,ui-sans-serif,system-ui,sans-serif; }
    body > header, main, footer { width:min(1560px,calc(100% - 40px)); margin:0 auto; }
    body > header { padding:42px 0 26px; } h1,h2,h3,p { margin-top:0; } h1 { margin-bottom:10px; font-size:clamp(30px,4vw,48px); letter-spacing:-.035em; }
    .eyebrow { color:var(--blue-dark); font-size:12px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
    .notice { max-width:1050px; padding:16px 18px; border-left:6px solid var(--blue); background:#e0f2fe; }
    .summary { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; } .summary span { padding:7px 12px; border:1px solid var(--line); border-radius:999px; }
    section { margin:0 0 38px; } .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; } input,select { min-height:42px; padding:8px 10px; border:1px solid var(--line); border-radius:9px; background:#fff; }
    input { flex:1; min-width:260px; } .sheets { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; }
    .sheet { color:inherit; text-decoration:none; border:1px solid var(--line); border-radius:14px; overflow:hidden; } .sheet img { display:block; width:100%; height:auto; } .sheet span { display:block; padding:10px 12px; }
    table { width:100%; border-collapse:collapse; } th,td { padding:10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; } th { background:var(--soft); }
    code { overflow-wrap:anywhere; font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .documents { display:grid; gap:22px; } .document { border:1px solid var(--line); border-radius:16px; overflow:hidden; } .document.failed { border-color:#fecaca; }
    .document > header { display:flex; justify-content:space-between; gap:18px; padding:16px 18px; background:var(--soft); } .document.failed > header { background:#fef2f2; } .document h3 { margin-bottom:4px; }
    .pages { display:grid; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); gap:1px; background:var(--line); } figure { margin:0; background:#fff; } figure img { display:block; width:100%; height:auto; background:#fff; } figcaption { padding:8px 10px; color:var(--muted); }
    .empty { color:var(--good); } footer { padding:0 0 45px; color:var(--muted); }
    @media (max-width:760px) { body > header,main,footer { width:min(100% - 24px,1560px); } .document > header { display:block; } table { display:block; overflow:auto; } }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Kun lokalt QA-materiale</p>
    <h1>Visuel QA af saniterede salgsmappe-PDF'er</h1>
    <p class="notice"><strong>Afventer menneskelig visuel kontrol.</strong> Automatiske pixelchecks er kun et stopfilter. Denne side godkender, importerer, uploader eller publicerer intet, og den ændrer ikke PDF-filerne.</p>
    <div class="summary">
      <span>${manifest.counts.jobs} jobs</span><span>${manifest.counts.renderedPageOccurrences} renderede sider</span><span>${manifest.counts.uniquePageRenders} unikke sider</span><span>${manifest.counts.uniqueDocumentRenders} unikke dokumentrenderinger</span><span>${manifest.counts.failedJobs} automatiske fejl</span><span>${manifest.renderer.dpi} DPI</span>
    </div>
  </header>
  <main>
    <section><h2>Kontaktark</h2><p>Alle unikke dokumentrenderinger er medtaget; identiske renderinger deler billedfiler, men deres jobdækning er bevaret i manifestet.</p><div class="sheets">${contactSheets}</div></section>
    <section><h2>Automatiske stopfund</h2>${manifest.counts.failedJobs === 0 ? '<p class="empty">Ingen automatiske pixelchecks fejlede. Menneskelig kontrol er stadig påkrævet.</p>' : `<div class="toolbar"><input id="failureSearch" type="search" placeholder="Søg efter job, format eller check"></div><table><thead><tr><th>Job</th><th>Variant</th><th>Fejl</th><th>Bevis</th></tr></thead><tbody id="failureRows">${failures}</tbody></table>`}</section>
    <section><h2>Unikke dokumentrenderinger</h2><div class="toolbar"><input id="documentSearch" type="search" placeholder="Søg efter job, format, konstruktion eller finish"><select id="stateFilter"><option value="all">Alle</option><option value="failed">Kun fejl</option><option value="passed">Kun bestået</option></select></div><div class="documents" id="documents">${documentGroups}</div></section>
  </main>
  <footer>Batchmanifest SHA-256: <code>${escapeHtml(manifest.inputEvidence.batchManifest.sha256)}</code></footer>
  <script>
    const normalize = value => String(value || '').trim().toLowerCase();
    const filterRows = () => { const query = normalize(document.getElementById('failureSearch')?.value); document.querySelectorAll('#failureRows tr').forEach(row => { row.hidden = query && !row.dataset.search.includes(query); }); };
    document.getElementById('failureSearch')?.addEventListener('input', filterRows);
    const filterDocuments = () => { const query = normalize(document.getElementById('documentSearch')?.value); const state = document.getElementById('stateFilter')?.value || 'all'; document.querySelectorAll('#documents .document').forEach(card => { card.hidden = Boolean((query && !card.dataset.search.includes(query)) || (state !== 'all' && card.dataset.state !== state)); }); };
    document.getElementById('documentSearch')?.addEventListener('input', filterDocuments); document.getElementById('stateFilter')?.addEventListener('change', filterDocuments);
  </script>
</body>
</html>\n`;
}

async function atomicWrite(filePath, bytes) {
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

function chunks(values, size) {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

function relativeOutputPath(...parts) {
  return path.posix.join(...parts.map((part) => String(part).replaceAll("\\", "/")));
}

export async function buildSanitizedRenderReview({
  runDirectory,
  batchManifestRelativePath = DEFAULT_BATCH_MANIFEST_PATH,
  outputRelativePath = DEFAULT_OUTPUT_PATH,
  rendererBinary = DEFAULT_PDFTOPPM,
  pythonBinary = DEFAULT_PYTHON,
  pythonHelperPath = DEFAULT_PYTHON_HELPER,
  fontConfigFile = DEFAULT_FONTCONFIG_FILE,
  dpi = 120,
  renderConcurrency = 4,
  pixelAnalysisConcurrency = 4,
  expectedJobs = 1420,
  expectedDonorJobs = 5,
  contactSheetSize = 12,
  processRunner = defaultProcessRunner,
  renderPdf = defaultRenderPdf,
  pixelAnalyzer = defaultPixelAnalyzer,
  contactSheetBuilder = defaultContactSheetBuilder,
}) {
  assert(runDirectory, "--run is required");
  assert(Number.isInteger(dpi) && dpi >= 96 && dpi <= 180, "DPI must be an integer from 96 to 180");
  assert(Number.isInteger(renderConcurrency) && renderConcurrency >= 1 && renderConcurrency <= 8, "Render concurrency must be an integer from 1 to 8");
  assert(Number.isInteger(pixelAnalysisConcurrency) && pixelAnalysisConcurrency >= 1 && pixelAnalysisConcurrency <= 8, "Pixel-analysis concurrency must be an integer from 1 to 8");
  assert(Number.isInteger(contactSheetSize) && contactSheetSize >= 1 && contactSheetSize <= 12, "Contact-sheet size must be 1 to 12");
  for (const [label, value] of Object.entries({ processRunner, renderPdf, pixelAnalyzer, contactSheetBuilder })) {
    assert(typeof value === "function", `${label} must be a function`);
  }
  const resolvedRun = path.resolve(runDirectory);
  const runStat = await fs.lstat(resolvedRun);
  assert(runStat.isDirectory() && !runStat.isSymbolicLink(), "Run directory must be a real non-symlink directory");
  const reviewDirectory = pathWithin(resolvedRun, "review", "Review directory");
  const reviewStat = await fs.lstat(reviewDirectory);
  assert(reviewStat.isDirectory() && !reviewStat.isSymbolicLink(), "Review directory must be a real non-symlink directory");
  const safeOutputRelativePath = safeRelativePath(outputRelativePath, "Output path", "review/");
  const outputDirectory = pathWithin(resolvedRun, safeOutputRelativePath, "Output directory");
  try {
    await fs.lstat(outputDirectory);
    throw new SanitizedRenderReviewError(`Output already exists; refusing to overwrite: ${safeOutputRelativePath}`);
  } catch (error) {
    if (error instanceof SanitizedRenderReviewError) throw error;
    if (error?.code !== "ENOENT") throw error;
  }

  const batchInput = await readBatchInput(
    resolvedRun,
    batchManifestRelativePath,
    expectedJobs,
    expectedDonorJobs
  );
  const evidence = await verifyBatchEvidence(resolvedRun, batchInput);
  const renderer = await rendererVersion(rendererBinary, processRunner);
  const python = await pythonVersion(pythonBinary, processRunner);
  const helperStat = await fs.lstat(pythonHelperPath);
  assert(helperStat.isFile() && !helperStat.isSymbolicLink(), "Pixel-analysis helper is missing or unsafe");
  const helperSha256 = await sha256File(pythonHelperPath);
  const fontConfigStat = await fs.lstat(fontConfigFile);
  assert(fontConfigStat.isFile() && !fontConfigStat.isSymbolicLink(), "Render font configuration is missing or unsafe");
  const fontConfigSha256 = await sha256File(fontConfigFile);

  const temporaryDirectory = await fs.mkdtemp(path.join(reviewDirectory, ".sanitized-pdf-render-review.tmp-"));
  let completed = false;
  try {
    const rendersDirectory = path.join(temporaryDirectory, "renders");
    const contactSheetsDirectory = path.join(temporaryDirectory, "contact-sheets");
    const workDirectory = path.join(temporaryDirectory, ".work");
    const fontCacheDirectory = path.join(workDirectory, "font-cache");
    await fs.mkdir(rendersDirectory, { mode: 0o700 });
    await fs.mkdir(contactSheetsDirectory, { mode: 0o700 });
    await fs.mkdir(workDirectory, { mode: 0o700 });
    await fs.mkdir(fontCacheDirectory, { mode: 0o700 });

    const uniquePageFiles = new Map();
    const renderedJobs = [];
    const indexedJobs = evidence.verifiedJobs.map((verified, jobIndex) => ({ verified, jobIndex }));
    for (const jobChunk of chunks(indexedJobs, renderConcurrency)) {
      const stagedResults = await Promise.allSettled(jobChunk.map(async ({ verified, jobIndex }) => {
        const jobWorkDirectory = path.join(workDirectory, `job-${String(jobIndex + 1).padStart(4, "0")}`);
        const rawPages = await renderPdf({
          rendererBinary,
          processRunner,
          dpi,
          inputPath: verified.sanitizedPdf.absolutePath,
          outputDirectory: jobWorkDirectory,
          job: verified.job,
          fontConfigFile,
          fontCacheDirectory,
        });
        assert(Array.isArray(rawPages) && rawPages.length > 0, `${verified.job.jobId} rendered no pages`);
        assert(rawPages.every((page, index) => page.pageNumber === index + 1), `${verified.job.jobId} rendered an incomplete page sequence`);
        return { verified, jobWorkDirectory, rawPages };
      }));
      const firstRejected = stagedResults.find((result) => result.status === "rejected");
      if (firstRejected) throw firstRejected.reason;

      for (const stagedResult of stagedResults) {
        const { verified, jobWorkDirectory, rawPages } = stagedResult.value;
        const pages = [];
        for (const rawPage of rawPages) {
          const stat = await fs.lstat(rawPage.absolutePath);
          assert(stat.isFile() && !stat.isSymbolicLink(), `${verified.job.jobId} rendered an unsafe page`);
          const bytes = await fs.readFile(rawPage.absolutePath);
          assert(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `${verified.job.jobId} page ${rawPage.pageNumber} is not a PNG`);
          const sha256 = sha256Bytes(bytes);
          const renderRelativePath = relativeOutputPath("renders", `${sha256}.png`);
          if (!uniquePageFiles.has(sha256)) {
            const destination = path.join(temporaryDirectory, renderRelativePath);
            await fs.rename(rawPage.absolutePath, destination);
            uniquePageFiles.set(sha256, {
              sha256,
              bytes: stat.size,
              relativePath: renderRelativePath,
              absolutePath: destination,
              occurrences: [],
            });
          } else {
            const existing = uniquePageFiles.get(sha256);
            assert(existing.bytes === stat.size, "SHA-identical renders have inconsistent byte counts");
            await fs.unlink(rawPage.absolutePath);
          }
          uniquePageFiles.get(sha256).occurrences.push({ jobId: verified.job.jobId, pageNumber: rawPage.pageNumber });
          pages.push({ pageNumber: rawPage.pageNumber, sha256, path: renderRelativePath, bytes: stat.size });
        }
        await fs.rm(jobWorkDirectory, { recursive: true, force: true });
        renderedJobs.push({ verified, pages });
      }
    }
    assert(renderedJobs.length === evidence.verifiedJobs.length, "Concurrent rendering did not preserve exact job coverage");

    const analysisRequestImages = [...uniquePageFiles.values()]
      .sort((left, right) => left.sha256.localeCompare(right.sha256, "en"))
      .map((render) => ({ sha256: render.sha256, path: render.absolutePath }));
    const analysisResult = await pixelAnalyzer({
      pythonBinary,
      helperPath: pythonHelperPath,
      processRunner,
      images: analysisRequestImages,
      workDirectory,
      analysisConcurrency: pixelAnalysisConcurrency,
    });
    assert(analysisResult?.kind === "wmd_sales_folder_render_pixel_analysis", "Pixel helper returned an unexpected kind");
    assert(analysisResult?.schemaVersion === 1, "Pixel helper returned an unexpected schemaVersion");
    assert(Array.isArray(analysisResult.images), "Pixel helper returned no image array");
    const analysisBySha = new Map(analysisResult.images.map((item) => [validSha256(item.sha256, "Pixel analysis SHA-256"), item]));
    assert(analysisBySha.size === uniquePageFiles.size, "Pixel helper did not return exact unique-render coverage");
    for (const sha256 of uniquePageFiles.keys()) assert(analysisBySha.has(sha256), `Pixel helper omitted render ${sha256}`);

    const jobs = renderedJobs.map(({ verified, pages }) => {
      const evaluatedPages = pages.map((page) => ({ ...page, analysis: analysisBySha.get(page.sha256) }));
      const automatedChecks = evaluateJobPixelChecks(verified.job, evaluatedPages);
      const documentRenderGroupSha256 = sha256Json(evaluatedPages.map((page) => ({ pageNumber: page.pageNumber, sha256: page.sha256 })));
      return {
        jobId: verified.job.jobId,
        safeOutputSignatureSha256: verified.job.safeOutputSignatureSha256,
        geometry: structuredClone(verified.job.geometry),
        finishKey: verified.job.finishKey,
        coveredBindingCount: verified.job.coveredBindingCount,
        coveredBindingKeysSha256: verified.job.coveredBindingKeysSha256,
        source: structuredClone(verified.job.source),
        contract: structuredClone(verified.job.contract),
        sanitizedPdf: structuredClone(verified.job.sanitizedPdf),
        inspection: structuredClone(verified.job.inspection),
        executionEvidence: structuredClone(verified.job.executionEvidence),
        rendererArgs: ["-png", "-r", String(dpi), `<run>/${verified.job.sanitizedPdf.path}`, `<work>/${verified.job.jobId}/page`],
        pages: evaluatedPages.map((page) => ({
          pageNumber: page.pageNumber,
          renderSha256: page.sha256,
          renderPath: page.path,
          renderBytes: page.bytes,
        })),
        documentRenderGroupSha256,
        automatedChecks,
        visualReviewPending: true,
        eligibleForTemplateImport: false,
        eligibleForImport: false,
        prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
      };
    });

    const documentGroupMap = new Map();
    for (const job of jobs) {
      if (!documentGroupMap.has(job.documentRenderGroupSha256)) {
        documentGroupMap.set(job.documentRenderGroupSha256, {
          sha256: job.documentRenderGroupSha256,
          representativeJobId: job.jobId,
          jobIds: [],
          pages: job.pages.map((page) => ({ pageNumber: page.pageNumber, sha256: page.renderSha256, path: page.renderPath })),
          automatedStates: new Set(),
        });
      }
      const group = documentGroupMap.get(job.documentRenderGroupSha256);
      group.jobIds.push(job.jobId);
      group.automatedStates.add(job.automatedChecks.state);
    }
    const documentGroups = [...documentGroupMap.values()]
      .sort((left, right) => left.sha256.localeCompare(right.sha256, "en"))
      .map((group) => ({
        sha256: group.sha256,
        representativeJobId: group.representativeJobId,
        jobIds: group.jobIds.sort((left, right) => left.localeCompare(right, "en", { numeric: true })),
        jobCount: group.jobIds.length,
        pages: group.pages,
        automatedCheckState: [...group.automatedStates].some((state) => state.includes("failed"))
          ? "automated_pixel_checks_failed_human_review_pending"
          : "automated_pixel_checks_passed_human_review_pending",
      }));

    const contactSheetSpecs = chunks(documentGroups, contactSheetSize).map((groupChunk, index) => ({
      id: `contact-sheet-${String(index + 1).padStart(3, "0")}`,
      outputPath: path.join(contactSheetsDirectory, `contact-sheet-${String(index + 1).padStart(3, "0")}.png`),
      title: `Saniterede salgsmapper · ark ${index + 1} af ${Math.ceil(documentGroups.length / contactSheetSize)}`,
      items: groupChunk.map((group) => {
        const representative = jobs.find((job) => job.jobId === group.representativeJobId);
        return {
          label: geometryLabel(representative),
          details: `${group.jobCount} job${group.jobCount === 1 ? "" : "s"} · ${group.sha256.slice(0, 16)}`,
          status: group.automatedCheckState.includes("failed") ? "failed" : "passed",
          pagePaths: group.pages.map((page) => path.join(temporaryDirectory, page.path)),
        };
      }),
    }));
    const contactResult = await contactSheetBuilder({
      pythonBinary,
      helperPath: pythonHelperPath,
      processRunner,
      sheets: contactSheetSpecs,
      workDirectory,
    });
    assert(contactResult?.kind === "wmd_sales_folder_render_contact_sheets", "Contact-sheet helper returned an unexpected kind");
    assert(Array.isArray(contactResult.sheets) && contactResult.sheets.length === contactSheetSpecs.length, "Contact-sheet helper returned incomplete coverage");
    const contactSheets = [];
    for (const [index, sheet] of contactResult.sheets.entries()) {
      const spec = contactSheetSpecs[index];
      assert(sheet.id === spec.id, "Contact-sheet helper changed the sheet order or id");
      const stat = await fs.lstat(spec.outputPath);
      assert(stat.isFile() && !stat.isSymbolicLink(), `Contact sheet ${spec.id} is missing or unsafe`);
      const bytes = await fs.readFile(spec.outputPath);
      assert(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `Contact sheet ${spec.id} is not a PNG`);
      contactSheets.push({
        id: spec.id,
        labelDa: `Kontaktark ${index + 1}`,
        path: relativeOutputPath("contact-sheets", path.basename(spec.outputPath)),
        sha256: sha256Bytes(bytes),
        bytes: bytes.length,
        widthPx: sheet.widthPx,
        heightPx: sheet.heightPx,
        itemCount: spec.items.length,
        documentRenderGroupSha256s: documentGroups
          .slice(index * contactSheetSize, index * contactSheetSize + spec.items.length)
          .map((group) => group.sha256),
      });
    }

    const pageRenderGroups = [...uniquePageFiles.values()]
      .sort((left, right) => left.sha256.localeCompare(right.sha256, "en"))
      .map((render) => ({
        sha256: render.sha256,
        path: render.relativePath,
        bytes: render.bytes,
        widthPx: analysisBySha.get(render.sha256).widthPx,
        heightPx: analysisBySha.get(render.sha256).heightPx,
        pixelAnalysis: analysisBySha.get(render.sha256),
        coverageCount: render.occurrences.length,
        coveredJobCount: new Set(render.occurrences.map((occurrence) => occurrence.jobId)).size,
        occurrences: render.occurrences,
      }));

    const manifestBefore = await fs.readFile(batchInput.absolutePath);
    assert(sha256Bytes(manifestBefore) === batchInput.sha256, "Batch manifest changed during rendering");
    const planAfterRender = await fs.readFile(batchInput.sanitizationPlan.absolutePath);
    assert(
      planAfterRender.length === batchInput.sanitizationPlan.bytes && sha256Bytes(planAfterRender) === batchInput.sanitizationPlan.sha256,
      "Sanitization proposal plan changed during rendering"
    );
    for (const { verified } of renderedJobs) {
      const currentSha256 = await sha256File(verified.sanitizedPdf.absolutePath);
      assert(currentSha256 === verified.sanitizedPdf.sha256, `Sanitized PDF changed during rendering: ${verified.sanitizedPdf.relativePath}`);
    }

    const failedJobs = jobs.filter((job) => !job.automatedChecks.passed);
    const manifest = {
      kind: "wmd_sales_folder_sanitized_pdf_render_review",
      schemaVersion: 1,
      state: "pending_human_visual_review",
      reviewState: "pending_human_visual_review",
      reviewDecision: {
        status: "not_recorded",
        reviewer: null,
        reviewedAt: null,
        note: null,
      },
      localOnly: true,
      eligibleForTemplateImport: false,
      eligibleForImport: false,
      promotionAllowed: false,
      inputEvidence: {
        batchManifest: {
          path: batchInput.relativePath,
          sha256: batchInput.sha256,
          bytes: batchInput.bytes,
          state: batchInput.manifest.state,
          reviewState: batchInput.manifest.reviewState,
        },
        batchManifestSha256Sidecar: batchInput.sidecar,
        batchChecksums: {
          path: batchInput.checksums.path,
          sha256: batchInput.checksums.sha256,
          bytes: batchInput.checksums.bytes,
        },
        sanitizationProposalPlan: {
          path: batchInput.sanitizationPlan.path,
          sha256: batchInput.sanitizationPlan.sha256,
          bytes: batchInput.sanitizationPlan.bytes,
          jobIdsSha256: batchInput.sanitizationPlan.jobIdsSha256,
          orderMatchedPositionByPosition: true,
        },
      },
      generator: {
        script: SCRIPT_PATH,
        schemaVersion: 1,
        pixelHelper: {
          path: path.relative(process.cwd(), pythonHelperPath).replaceAll("\\", "/"),
          sha256: helperSha256,
          pythonVersion: python,
          analysisConcurrency: pixelAnalysisConcurrency,
        },
      },
      renderer: {
        tool: "pdftoppm",
        executable: String(rendererBinary),
        version: renderer.version,
        versionArgs: ["-v"],
        versionStdoutSha256: renderer.stdoutSha256,
        versionStderrSha256: renderer.stderrSha256,
        dpi,
        concurrency: renderConcurrency,
        renderCommitOrder: "hash_pinned_plan_order",
        format: "png",
        everyPdfRendered: true,
        everyPageRendered: true,
        fontConfiguration: {
          path: path.relative(process.cwd(), fontConfigFile).replaceAll("\\", "/"),
          sha256: fontConfigSha256,
          bytes: fontConfigStat.size,
          cache: "ephemeral_per_review_build",
        },
      },
      pixelPolicy: PIXEL_POLICY,
      automatedReview: {
        state: failedJobs.length === 0
          ? "automated_pixel_checks_passed_human_review_pending"
          : "automated_pixel_checks_failed_human_review_pending",
        passed: failedJobs.length === 0,
        humanVisualReviewStillRequired: true,
        automatedPassDoesNotApprove: true,
      },
      counts: {
        jobs: jobs.length,
        fourPlusZeroJobs: jobs.filter((job) => job.geometry.print === "4+0").length,
        fourPlusFourJobs: jobs.filter((job) => job.geometry.print === "4+4").length,
        coveredBindings: jobs.reduce((sum, job) => sum + job.coveredBindingCount, 0),
        renderedPageOccurrences: jobs.reduce((sum, job) => sum + job.pages.length, 0),
        uniquePageRenders: pageRenderGroups.length,
        deduplicatedPageOccurrences: jobs.reduce((sum, job) => sum + job.pages.length, 0) - pageRenderGroups.length,
        uniqueDocumentRenders: documentGroups.length,
        passedJobs: jobs.length - failedJobs.length,
        failedJobs: failedJobs.length,
        verifiedBeschnittGuideDonorJobs: jobs.filter(
          (job) => job.executionEvidence.verifiedBeschnittGuideDonorReport !== null
        ).length,
        contactSheets: contactSheets.length,
      },
      jobs,
      pageRenderGroups,
      documentRenderGroups: documentGroups,
      contactSheets,
      nextGate: {
        state: "human_visual_review_required",
        required: [
          "Review every contact sheet and every automated failure against the full-resolution PNG pages.",
          "Confirm Danish/Webprinter information panels, preserved cut/fold geometry, and correct grey no-print semantics.",
          "Record a separate hash-pinned visual decision; this manifest records no approval.",
          "Verify locked Designer overlay visibility and print/export exclusion in a later separate gate.",
        ],
        blockedUntilThen: [
          "template import",
          "Designer attachment",
          "upload or storage write",
          "database, product, pricing, or publication write",
        ],
      },
      prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
    };

    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const htmlBytes = Buffer.from(buildReviewHtml(manifest), "utf8");
    await atomicWrite(path.join(temporaryDirectory, "render-review-manifest.json"), manifestBytes);
    await atomicWrite(path.join(temporaryDirectory, "index.html"), htmlBytes);
    await fs.rm(workDirectory, { recursive: true, force: true });

    const checksumEntries = [
      ...pageRenderGroups.map((render) => ({ path: render.path, sha256: render.sha256 })),
      ...contactSheets.map((sheet) => ({ path: sheet.path, sha256: sheet.sha256 })),
      { path: "index.html", sha256: sha256Bytes(htmlBytes) },
      { path: "render-review-manifest.json", sha256: sha256Bytes(manifestBytes) },
    ].sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
    const checksumsBytes = Buffer.from(`${checksumEntries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`, "utf8");
    await atomicWrite(path.join(temporaryDirectory, "checksums.sha256"), checksumsBytes);
    await fs.rename(temporaryDirectory, outputDirectory);
    completed = true;
    return {
      outputDirectory,
      indexPath: path.join(outputDirectory, "index.html"),
      manifestPath: path.join(outputDirectory, "render-review-manifest.json"),
      manifestSha256: sha256Bytes(manifestBytes),
      checksumsSha256: sha256Bytes(checksumsBytes),
      reviewState: manifest.reviewState,
      automatedReview: manifest.automatedReview,
      counts: manifest.counts,
    };
  } finally {
    if (!completed) await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = {
    runDirectory: null,
    batchManifestRelativePath: DEFAULT_BATCH_MANIFEST_PATH,
    outputRelativePath: DEFAULT_OUTPUT_PATH,
    rendererBinary: DEFAULT_PDFTOPPM,
    pythonBinary: DEFAULT_PYTHON,
    pythonHelperPath: DEFAULT_PYTHON_HELPER,
    fontConfigFile: DEFAULT_FONTCONFIG_FILE,
    dpi: 120,
    renderConcurrency: 4,
    pixelAnalysisConcurrency: 4,
    expectedJobs: 1420,
    contactSheetSize: 12,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--run") args.runDirectory = argv[++index];
    else if (item === "--batch-manifest") args.batchManifestRelativePath = argv[++index];
    else if (item === "--output") args.outputRelativePath = argv[++index];
    else if (item === "--pdftoppm") args.rendererBinary = argv[++index];
    else if (item === "--python") args.pythonBinary = argv[++index];
    else if (item === "--pixel-helper") args.pythonHelperPath = path.resolve(argv[++index]);
    else if (item === "--fontconfig") args.fontConfigFile = path.resolve(argv[++index]);
    else if (item === "--dpi") args.dpi = Number(argv[++index]);
    else if (item === "--render-concurrency") args.renderConcurrency = Number(argv[++index]);
    else if (item === "--pixel-concurrency") args.pixelAnalysisConcurrency = Number(argv[++index]);
    else if (item === "--expected-jobs") args.expectedJobs = Number(argv[++index]);
    else if (item === "--contact-sheet-size") args.contactSheetSize = Number(argv[++index]);
    else if (item === "--help") args.help = true;
    else throw new SanitizedRenderReviewError(`Unknown argument: ${item}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node ${SCRIPT_PATH} --run <run-directory> [--batch-manifest ${DEFAULT_BATCH_MANIFEST_PATH}] [--output ${DEFAULT_OUTPUT_PATH}] [--pdftoppm <path>] [--python <path>] [--fontconfig <path>] [--dpi 120] [--render-concurrency 4] [--pixel-concurrency 4] [--expected-jobs 1420] [--contact-sheet-size 12]`);
    return;
  }
  const result = await buildSanitizedRenderReview(args);
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
