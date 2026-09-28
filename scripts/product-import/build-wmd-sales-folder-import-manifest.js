#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateNativeGuideFactsArtifact } from "./build-wmd-sales-folder-native-guide-facts.js";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);

const INPUT_PATHS = Object.freeze({
  discovery: "discovery.json",
  productProposal: "review/consolidated-product-proposal.json",
  consolidatedStatus: "review/consolidated-review-status.json",
  priceRows: "review/proposed-price-rows.jsonl",
  templateStubs: "review/template-projection-stubs.jsonl",
  sanitizationPlan: "review/template-sanitization-plan.json",
  sanitizationBatch: "documents/sanitization-batch/manifest.json",
  renderReview: "review/sanitized-pdf-render-review/render-review-manifest.json",
  nativeGuideFacts: "review/native-guide-facts.json",
  canonicalIconGrid: "review/canonical-icon-grid-v1.json",
  visualApprovalDecision: "review/sanitized-pdf-render-approval-decision.json",
});

const OUTPUT_PATHS = Object.freeze({
  bindingMap: "review/import-template-binding-map.jsonl",
  blockers: "review/import-manifest-blockers.json",
  manifest: "import-manifest.json",
});

export const TEMPLATE_BINDING_AXES = Object.freeze([
  "folder_model",
  "print",
  "spine",
  "paper",
  "finish",
]);

export const EXPECTED_COUNTS = Object.freeze({
  sanitizedPdfs: 1420,
  bindings: 3692,
  priceRows: 108348,
  onlineDesignerPdfs: 710,
  onlineDesignerBindings: 1562,
  professionalUploadPdfs: 710,
  professionalUploadBindings: 2130,
  contactSheets: 119,
});

const ARTWORK_MODES = new Set([
  "online_designer",
  "professional_pdf_upload_only",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const BOUNDED_APPROVAL_STATE = "approved_for_manifest_preparation";
const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  supplierNetworkRequested: false,
  sourcePdfModified: false,
  sanitizedPdfModified: false,
  pdfUploaded: false,
  storageWritten: false,
  databaseWritten: false,
  supplierBankWritten: false,
  productOrTemplateRecordWritten: false,
  pricingWritten: false,
  published: false,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function prettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function validSha256(value, label) {
  const normalized = String(value || "");
  assert(SHA256_PATTERN.test(normalized), `${label} is not a lowercase SHA-256`);
  return normalized;
}

function safeRelativePath(value, label, suffix = null) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized.length > 0, `${label} is missing`);
  assert(!path.posix.isAbsolute(normalized), `${label} must be run-relative`);
  assert(path.posix.normalize(normalized) === normalized, `${label} is not normalized`);
  assert(!normalized.split("/").includes(".."), `${label} escapes the run directory`);
  if (suffix) assert(normalized.toLowerCase().endsWith(suffix), `${label} must end in ${suffix}`);
  return normalized;
}

function safeRunPath(runDirectory, relativePath, label, suffix = null) {
  const safe = safeRelativePath(relativePath, label, suffix);
  const resolved = path.resolve(runDirectory, safe);
  assert(resolved.startsWith(`${path.resolve(runDirectory)}${path.sep}`), `${label} resolves outside the run directory`);
  return resolved;
}

function selectionSignature(selections) {
  assert(selections && typeof selections === "object" && !Array.isArray(selections), "Selections must be an object");
  assert(
    sameJson(Object.keys(selections).sort(), [...TEMPLATE_BINDING_AXES].sort()),
    `Selections must contain exactly ${TEMPLATE_BINDING_AXES.join(", ")}`,
  );
  return canonicalJson(TEMPLATE_BINDING_AXES.map((axis) => [axis, String(selections[axis] || "")]));
}

function assertAllFalse(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} is missing`);
  const performed = Object.entries(value).filter(([, state]) => state !== false);
  assert(performed.length === 0, `${label} reports performed actions: ${performed.map(([key]) => key).join(", ")}`);
}

async function readArtifact(runDirectory, relativePath, label) {
  const absolutePath = safeRunPath(runDirectory, relativePath, label);
  const bytes = await fs.readFile(absolutePath);
  return {
    relativePath,
    absolutePath,
    bytes,
    byteSize: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

async function readJsonArtifact(runDirectory, relativePath, label) {
  const artifact = await readArtifact(runDirectory, relativePath, label);
  try {
    artifact.value = JSON.parse(artifact.bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return artifact;
}

function safeRepositoryPath(relativePath, label, suffix = null) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  assert(normalized.length > 0, `${label} is missing`);
  assert(!path.posix.isAbsolute(normalized), `${label} must be repository-relative`);
  assert(path.posix.normalize(normalized) === normalized, `${label} is not normalized`);
  assert(!normalized.split("/").includes(".."), `${label} escapes the repository`);
  if (suffix) assert(normalized.toLowerCase().endsWith(suffix), `${label} must end in ${suffix}`);
  const absolutePath = path.resolve(REPOSITORY_ROOT, normalized);
  assert(absolutePath.startsWith(`${REPOSITORY_ROOT}${path.sep}`), `${label} resolves outside the repository`);
  return { relativePath: normalized, absolutePath };
}

async function readRepositoryArtifact(relativePath, label, suffix = null) {
  const resolved = safeRepositoryPath(relativePath, label, suffix);
  const bytes = await fs.readFile(resolved.absolutePath);
  return {
    ...resolved,
    bytes,
    byteSize: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

function inspectPngHeader(bytes, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(signature), `${label} is not a PNG`);
  assert(bytes.toString("ascii", 12, 16) === "IHDR", `${label} has no leading IHDR chunk`);
  return {
    widthPx: bytes.readUInt32BE(16),
    heightPx: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

export async function validateCanonicalIconGrid({ iconArtifact, proposalArtifact }) {
  const iconGrid = iconArtifact?.value;
  const proposal = proposalArtifact?.value;
  assert(iconGrid?.schemaVersion === 1, "Canonical icon grid schemaVersion must be 1");
  assert(iconGrid?.artifactType === "canonical_sales_folder_icon_grid", "Canonical icon-grid type drifted");
  assert(iconGrid?.state === "extracted", "Canonical icon grid is not extracted");
  assert(iconGrid?.optionAxis === "folder_model", "Canonical icon grid targets another option axis");
  assert(iconGrid?.displayType === "icon_grid", "Canonical icon-grid display type drifted");
  assert(iconGrid?.styleKey === "flat_clean", "Canonical icon-grid style drifted");
  assert(iconGrid?.modelCount === 20, "Canonical icon-grid model count must be 20");
  assert(Array.isArray(iconGrid.values) && iconGrid.values.length === 20, "Canonical icon-grid values must contain 20 models");
  assertAllFalse(iconGrid.mutationBoundary, "Canonical icon-grid mutation boundary");

  const iconGroup = proposal?.optionGroups?.find((group) => group.key === "folder_model");
  assert(iconGroup?.displayType === "icon_grid", "Product proposal folder-model group is not an icon grid");
  const proposalValues = iconGroup.values || [];
  const expectedOrder = proposalValues.map((value) => value.key);
  assert(expectedOrder.length === 20, "Product proposal folder-model count must be 20");
  assert(sameJson(iconGrid.modelOrder, expectedOrder), "Canonical icon-grid model order drifted from the product proposal");
  assert(
    sameJson(iconGrid.excludedModels?.map((entry) => entry.modelKey), ["cd-135x135--2-part-closure"]),
    "Canonical icon grid must explicitly exclude only the CD folder",
  );
  assert(!iconGrid.modelOrder.includes("cd-135x135--2-part-closure"), "Canonical icon grid includes the excluded CD folder");
  assert(iconGrid.sourceProposal?.path === proposalArtifact.relativePath, "Canonical icon grid pins another proposal path");
  assert(iconGrid.sourceProposal?.sha256 === proposalArtifact.sha256, "Canonical icon grid proposal hash drifted");
  assert(iconGrid.sourceProposal?.writePerformed === false, "Canonical icon artifact reports proposal mutation");

  const [sourceManifestArtifact, rasterManifestArtifact] = await Promise.all([
    readRepositoryArtifact(
      iconGrid.sourceSvgManifest?.repoAssetPath,
      "Canonical icon source SVG manifest",
      ".json",
    ),
    readRepositoryArtifact(
      iconGrid.rasterManifest?.repoAssetPath,
      "Canonical icon raster manifest",
      ".json",
    ),
  ]);
  assert(sourceManifestArtifact.sha256 === validSha256(iconGrid.sourceSvgManifest.sha256, "Source SVG manifest SHA-256"), "Source SVG manifest SHA-256 drifted");
  assert(rasterManifestArtifact.sha256 === validSha256(iconGrid.rasterManifest.sha256, "Raster manifest SHA-256"), "Raster manifest SHA-256 drifted");
  let rasterManifest;
  try {
    rasterManifest = JSON.parse(rasterManifestArtifact.bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Canonical icon raster manifest is invalid JSON: ${error.message}`);
  }
  assert(sameJson(rasterManifest.modelOrder, expectedOrder), "Raster manifest model order drifted");
  assert(
    sameJson(rasterManifest.excludedModels?.map((entry) => entry.modelKey), ["cd-135x135--2-part-closure"]),
    "Raster manifest CD exclusion drifted",
  );

  const assets = [];
  for (const [index, value] of iconGrid.values.entries()) {
    const proposalValue = proposalValues[index];
    assert(value?.key === expectedOrder[index] && value?.modelKey === expectedOrder[index], `Canonical icon value order drifted at ${index}`);
    assert(value?.sourceOrder === index, `${value?.key || index} sourceOrder drifted`);
    assert(value?.labelDa === proposalValue.labelDa, `${value.key} Danish label drifted from proposal`);
    assert(value?.accessibleNameDa === proposalValue.icon?.accessibleNameDa, `${value.key} accessible name drifted from proposal`);
    assert(value?.icon?.styleKey === iconGrid.styleKey, `${value.key} icon style drifted`);
    assert(value?.icon?.transparent === true, `${value.key} is not marked transparent`);
    assert(value?.icon?.supplierBrandingRemoved === true, `${value.key} retains supplier branding`);
    assert(value?.icon?.sourceSvg?.repoAssetPath === proposalValue.icon?.svg?.repoAssetPath, `${value.key} source SVG path drifted`);
    assert(value?.icon?.sourceSvg?.sha256 === proposalValue.icon?.svg?.sha256, `${value.key} source SVG hash drifted`);
    const rasterModel = rasterManifest.models?.[value.key];
    assert(rasterModel?.modelKey === value.key, `${value.key} is absent from the raster manifest`);
    for (const [variant, expectedSize] of [["master", 1024], ["ui", 512]]) {
      const record = value.icon[variant];
      assert(record?.mimeType === "image/png", `${value.key} ${variant} MIME type drifted`);
      assert(record?.widthPx === expectedSize && record?.heightPx === expectedSize, `${value.key} ${variant} dimensions drifted`);
      assert(record?.alpha?.hasAlpha === true && record?.alpha?.colorType === "rgba", `${value.key} ${variant} lacks RGBA alpha evidence`);
      assert(record?.alpha?.minimumAlpha === 0 && record?.alpha?.transparentPixelCount > 0, `${value.key} ${variant} has no transparent pixels`);
      assert(sameJson(rasterModel[variant], record), `${value.key} ${variant} drifted from raster manifest`);
      const asset = await readRepositoryArtifact(record.repoAssetPath, `${value.key} ${variant} PNG`, ".png");
      assert(asset.byteSize === Number(record.byteSize), `${value.key} ${variant} byte size drifted`);
      assert(asset.sha256 === validSha256(record.sha256, `${value.key} ${variant} SHA-256`), `${value.key} ${variant} SHA-256 drifted`);
      const png = inspectPngHeader(asset.bytes, `${value.key} ${variant}`);
      assert(png.widthPx === expectedSize && png.heightPx === expectedSize, `${value.key} ${variant} PNG header dimensions drifted`);
      assert(png.bitDepth === 8 && png.colorType === 6, `${value.key} ${variant} is not 8-bit RGBA`);
      assets.push({
        modelKey: value.key,
        variant,
        path: asset.relativePath,
        sha256: asset.sha256,
        bytes: asset.byteSize,
        transparent: true,
      });
    }
  }
  return {
    artifact: iconGrid,
    modelOrder: expectedOrder,
    valuesByKey: new Map(iconGrid.values.map((value) => [value.key, value])),
    assets,
    sourceManifest: {
      path: sourceManifestArtifact.relativePath,
      sha256: sourceManifestArtifact.sha256,
      bytes: sourceManifestArtifact.byteSize,
    },
    rasterManifest: {
      path: rasterManifestArtifact.relativePath,
      sha256: rasterManifestArtifact.sha256,
      bytes: rasterManifestArtifact.byteSize,
    },
  };
}

async function readPinnedJson(runDirectory, record, label) {
  assert(record && typeof record === "object", `${label} record is missing`);
  const relativePath = safeRelativePath(record.path, `${label}.path`, ".json");
  const artifact = await readJsonArtifact(runDirectory, relativePath, label);
  assert(artifact.byteSize === Number(record.bytes), `${label} byte size drifted`);
  assert(artifact.sha256 === validSha256(record.sha256, `${label}.sha256`), `${label} SHA-256 drifted`);
  return artifact;
}

async function readSha256Sidecar(runDirectory, artifact, label) {
  const relativePath = `${artifact.relativePath}.sha256`;
  const sidecar = await readArtifact(runDirectory, relativePath, `${label} SHA-256 sidecar`);
  const expected = `${artifact.sha256}  ${path.basename(artifact.relativePath)}`;
  assert(sidecar.bytes.toString("utf8").trim() === expected, `${label} SHA-256 sidecar drifted`);
  return sidecar;
}

async function readJsonlArtifact(runDirectory, relativePath, label, onRow) {
  const absolutePath = safeRunPath(runDirectory, relativePath, label, ".jsonl");
  const hash = createHash("sha256");
  let byteSize = 0;
  let rowCount = 0;
  const input = createReadStream(absolutePath);
  input.on("data", (chunk) => {
    byteSize += chunk.length;
    hash.update(chunk);
  });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} row ${rowCount + 1} is not valid JSON: ${error.message}`);
    }
    await onRow(row, rowCount);
    rowCount += 1;
  }
  return {
    relativePath,
    absolutePath,
    byteSize,
    sha256: hash.digest("hex"),
    rowCount,
  };
}

function assertFingerprint(status, artifact, label) {
  const fingerprint = status.outputFingerprints.find((entry) => entry.path === artifact.relativePath);
  assert(fingerprint, `${label} is not pinned by consolidated-review-status.json`);
  assert(fingerprint.sha256 === artifact.sha256, `${label} SHA-256 drifted from consolidated review`);
  assert(Number(fingerprint.byteSize) === artifact.byteSize, `${label} byte size drifted from consolidated review`);
}

function pageGeometryFromContract(contract, label) {
  const pageBoxes = contract?.sourceEvidence?.pageBoxes;
  assert(Array.isArray(pageBoxes) && pageBoxes.length > 0, `${label} has no source page boxes`);
  const pageSizes = pageBoxes.map((entry, index) => {
    const mediaBox = entry?.mediabox;
    assert(Array.isArray(mediaBox) && mediaBox.length === 4, `${label} page ${index + 1} has no MediaBox`);
    const [x0, y0, x1, y1] = mediaBox.map(Number);
    assert([x0, y0, x1, y1].every(Number.isFinite), `${label} page ${index + 1} MediaBox is invalid`);
    return {
      widthMm: Math.round(((x1 - x0) * 25.4 / 72) * 1000) / 1000,
      heightMm: Math.round(((y1 - y0) * 25.4 / 72) * 1000) / 1000,
    };
  });
  assert(pageSizes.every((entry) => sameJson(entry, pageSizes[0])), `${label} has unequal page dimensions`);
  const bleedMm = Number(contract?.productionMeasurements?.bleedMm);
  const safeMm = Number(contract?.productionMeasurements?.safetyMm);
  assert(Number.isFinite(bleedMm) && bleedMm >= 0, `${label} has no source-backed bleed measurement`);
  assert(Number.isFinite(safeMm) && safeMm >= 0, `${label} has no source-backed safety measurement`);
  return { ...pageSizes[0], bleedMm, safeMm, pageCount: pageBoxes.length };
}

export function validateInspection(inspection, batchJob, planJob) {
  assert(inspection?.outputSha256 === batchJob.sanitizedPdf.sha256, `${batchJob.jobId} inspection output hash drifted`);
  assert(inspection?.fullPageRasterization === false, `${batchJob.jobId} was flattened`);
  const validation = inspection?.validation || {};
  for (const field of [
    "pageBoxesPreserved",
    "supplierTextAndBrandingRemoved",
    "metadataXmpThumbnailsAttachmentsActionsLinksAndCommentsRemoved",
    "danishInformationContained",
    "webprinterBluePanelPaintVerified",
    "supplierGreenPaintAbsent",
  ]) {
    assert(validation[field] === true, `${batchJob.jobId} inspection did not prove ${field}`);
  }
  assert(Array.isArray(validation.layers) && validation.layers.length > 0, `${batchJob.jobId} has no verified layers`);
  assert(
    validation.layers.every((layer) => layer.viewState === "/ON" && layer.printState === "/OFF" && layer.exportState === "/OFF"),
    `${batchJob.jobId} has a helper layer that can print or export`,
  );
  const expectedOnline = planJob.artwork.mode === "online_designer";
  if (expectedOnline) {
    assert(planJob.finish?.spotFinish === false, `${batchJob.jobId} online artwork cannot require a spot-finish mask`);
    assert(validation.finishWorkflow === "not_applicable", `${batchJob.jobId} online artwork has an unexpected finish-mask workflow`);
    assert(
      validation.onlineDesignerEligibleForFinish == null,
      `${batchJob.jobId} non-spot finish eligibility must remain not applicable`,
    );
    assert(validation.professionalUploadWarningVerified === false, `${batchJob.jobId} online artwork has a professional-upload warning`);
  } else {
    assert(planJob.finish?.spotFinish === true, `${batchJob.jobId} professional-upload artwork must identify a spot finish`);
    assert(validation.onlineDesignerEligibleForFinish === false, `${batchJob.jobId} professional-upload finish was not blocked from Designer`);
    assert(
      validation.finishWorkflow === "professional_upload_only_no_source_finish_mask",
      `${batchJob.jobId} lacks professional-upload-only finish evidence`,
    );
    assert(validation.professionalUploadWarningVerified === true, `${batchJob.jobId} lacks a verified upload warning`);
  }
}

export function templateModeProjection(planJob, contract, label = planJob?.jobId || "template") {
  assert(ARTWORK_MODES.has(planJob?.artwork?.mode), `${label} has an unsupported artwork mode`);
  const onlineDesigner = planJob.artwork.mode === "online_designer";
  const artworkModeReasonDa = onlineDesigner
    ? null
    : String(contract?.professionalUploadWarningDa || "").trim();
  assert(onlineDesigner || artworkModeReasonDa.length > 0, `${label} professional-upload mode lacks a Danish reason`);
  return {
    designerLoadMode: onlineDesigner
      ? "locked_non_printing_guide_overlay"
      : "download_only",
    lockedInDesigner: onlineDesigner,
    nonPrintingOverlay: onlineDesigner,
    excludedFromExport: onlineDesigner,
    artworkMode: planJob.artwork.mode,
    artworkModeReasonDa,
    onlineDesignerAllowed: planJob.artwork.onlineDesignerAllowed,
    verificationStatus: onlineDesigner ? "pending" : "not_applicable",
  };
}

async function verifySanitizedPdf(runDirectory, batchJob) {
  const relativePath = safeRelativePath(batchJob?.sanitizedPdf?.path, `${batchJob.jobId}.sanitizedPdf.path`, ".pdf");
  const artifact = await readArtifact(runDirectory, relativePath, `${batchJob.jobId} sanitized PDF`);
  assert(artifact.byteSize === Number(batchJob.sanitizedPdf.bytes), `${batchJob.jobId} sanitized PDF byte size drifted`);
  assert(artifact.sha256 === validSha256(batchJob.sanitizedPdf.sha256, `${batchJob.jobId} sanitized PDF SHA-256`), `${batchJob.jobId} sanitized PDF SHA-256 drifted`);
  return artifact;
}

function validateProductionInputs(inputs) {
  const { proposal, status, plan, batch, renderReview, discovery } = inputs;
  assert(discovery.sourceCategoryUrl === "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html", "Supplier category URL drifted");
  assert(sameJson(discovery.allowedHosts, ["www.wir-machen-druck.de"]), "Supplier allowlist drifted");
  assert(discovery.state === "extracted", "Discovery state must remain extracted");
  assert(discovery.templatesWritten === false && discovery.productDraftWritten === false && discovery.published === false, "Discovery reports an external mutation");
  assert(proposal.schemaVersion === 1 && proposal.state === "local_review_only", "Product proposal is not local review only");
  assert(sameJson(proposal.axisOrder, TEMPLATE_BINDING_AXES), "Product proposal does not retain all five template axes");
  assert(status.state === "local_consolidated_review_built", "Consolidated status is not the reviewed local proposal");
  assert(plan.counts.bindings === EXPECTED_COUNTS.bindings, "Sanitization plan binding count drifted");
  assert(plan.counts.outputJobs === EXPECTED_COUNTS.sanitizedPdfs, "Sanitization plan PDF count drifted");
  assert(batch.counts.jobs === EXPECTED_COUNTS.sanitizedPdfs, "Sanitization batch job count drifted");
  assert(renderReview.counts.jobs === EXPECTED_COUNTS.sanitizedPdfs, "Render-review job count drifted");
  assert(renderReview.counts.coveredBindings === EXPECTED_COUNTS.bindings, "Render-review binding count drifted");
  assert(renderReview.counts.contactSheets === EXPECTED_COUNTS.contactSheets, "Render-review contact-sheet count drifted");
  assert(renderReview.counts.failedJobs === 0 && renderReview.automatedReview?.passed === true, "Render review has automated failures");
  assert(renderReview.reviewDecision?.status === "not_recorded", "Render manifest must remain immutable and decision-free");
  assert(renderReview.inputEvidence?.batchManifest?.sha256 === inputs.batchArtifact.sha256, "Render review is stale relative to the batch manifest");
  assert(batch.inputEvidence?.sanitizationProposalPlan?.sha256 === inputs.planArtifact.sha256, "Sanitization batch is stale relative to the plan");
  assertAllFalse(batch.prohibitedActionsPerformed, "Sanitization batch prohibited actions");
  assertAllFalse(renderReview.prohibitedActionsPerformed, "Render-review prohibited actions");
}

export async function loadPreparationInputs({ runDirectory = DEFAULT_RUN_DIRECTORY } = {}) {
  const [
    discoveryArtifact,
    proposalArtifact,
    statusArtifact,
    planArtifact,
    batchArtifact,
    renderArtifact,
    canonicalIconGridArtifact,
  ] = await Promise.all([
    readJsonArtifact(runDirectory, INPUT_PATHS.discovery, "discovery"),
    readJsonArtifact(runDirectory, INPUT_PATHS.productProposal, "product proposal"),
    readJsonArtifact(runDirectory, INPUT_PATHS.consolidatedStatus, "consolidated status"),
    readJsonArtifact(runDirectory, INPUT_PATHS.sanitizationPlan, "sanitization plan"),
    readJsonArtifact(runDirectory, INPUT_PATHS.sanitizationBatch, "sanitization batch"),
    readJsonArtifact(runDirectory, INPUT_PATHS.renderReview, "render review"),
    readJsonArtifact(runDirectory, INPUT_PATHS.canonicalIconGrid, "canonical icon grid"),
  ]);

  const inputs = {
    runDirectory: path.resolve(runDirectory),
    discovery: discoveryArtifact.value,
    proposal: proposalArtifact.value,
    status: statusArtifact.value,
    plan: planArtifact.value,
    batch: batchArtifact.value,
    renderReview: renderArtifact.value,
    canonicalIconGrid: canonicalIconGridArtifact.value,
    discoveryArtifact,
    proposalArtifact,
    statusArtifact,
    planArtifact,
    batchArtifact,
    renderArtifact,
    canonicalIconGridArtifact,
  };
  validateProductionInputs(inputs);
  assertFingerprint(inputs.status, proposalArtifact, "Product proposal");
  inputs.canonicalIconGridSidecarArtifact = await readSha256Sidecar(
    inputs.runDirectory,
    canonicalIconGridArtifact,
    "Canonical icon grid",
  );
  inputs.canonicalIconGridValidation = await validateCanonicalIconGrid({
    iconArtifact: canonicalIconGridArtifact,
    proposalArtifact,
  });

  const stubs = [];
  inputs.stubsArtifact = await readJsonlArtifact(
    inputs.runDirectory,
    INPUT_PATHS.templateStubs,
    "template projection stubs",
    (row) => stubs.push(row),
  );
  assertFingerprint(inputs.status, inputs.stubsArtifact, "Template projection stubs");
  assert(stubs.length === EXPECTED_COUNTS.bindings, "Template projection stub count drifted");
  inputs.stubs = stubs;

  const pricedSignatures = new Set();
  inputs.priceRowsArtifact = await readJsonlArtifact(
    inputs.runDirectory,
    INPUT_PATHS.priceRows,
    "proposed price rows",
    (row, index) => {
      assert(row.sourceOrder === index, `Price row ${index} sourceOrder drifted`);
      pricedSignatures.add(selectionSignature(row.selections));
    },
  );
  assertFingerprint(inputs.status, inputs.priceRowsArtifact, "Proposed price rows");
  assert(inputs.priceRowsArtifact.rowCount === EXPECTED_COUNTS.priceRows, "Proposed price-row count drifted");
  assert(pricedSignatures.size === EXPECTED_COUNTS.bindings, "Priced configuration count drifted");
  inputs.pricedSignatures = pricedSignatures;
  return inputs;
}

export async function buildTemplateBindingMap(inputs) {
  const planJobs = new Map(inputs.plan.jobs.map((job) => [job.jobId, job]));
  const batchJobs = new Map(inputs.batch.jobs.map((job) => [job.jobId, job]));
  const stubsByKey = new Map(inputs.stubs.map((stub) => [stub.key, stub]));
  assert(planJobs.size === EXPECTED_COUNTS.sanitizedPdfs, "Sanitization plan has duplicate job IDs");
  assert(batchJobs.size === EXPECTED_COUNTS.sanitizedPdfs, "Sanitization batch has duplicate job IDs");
  assert(stubsByKey.size === EXPECTED_COUNTS.bindings, "Template projection contains duplicate keys");

  const bindings = [];
  const usedStubKeys = new Set();
  const usedPdfPaths = new Set();
  const modePdfCounts = { online_designer: 0, professional_pdf_upload_only: 0 };
  const modeBindingCounts = { online_designer: 0, professional_pdf_upload_only: 0 };

  for (const planJob of inputs.plan.jobs) {
    const batchJob = batchJobs.get(planJob.jobId);
    assert(batchJob, `Sanitization batch omits ${planJob.jobId}`);
    assert(ARTWORK_MODES.has(planJob.artwork?.mode), `${planJob.jobId} has an unsupported artwork mode`);
    assert(planJob.artwork.onlineDesignerAllowed === (planJob.artwork.mode === "online_designer"), `${planJob.jobId} artwork flags disagree`);
    assert(batchJob.coveredBindingCount === planJob.coveredBindings.length, `${planJob.jobId} covered-binding count drifted`);
    assert(sameJson(batchJob.geometry, {
      format: planJob.geometry.format,
      construction: planJob.geometry.construction,
      print: planJob.geometry.print,
      spineMm: planJob.geometry.spineMm,
      expectedGeometryKey: planJob.geometry.expectedGeometryKey,
    }), `${planJob.jobId} batch geometry drifted`);
    assert(batchJob.finishKey === planJob.finish.key, `${planJob.jobId} finish drifted`);

    const [contractArtifact, inspectionArtifact, sanitizedPdf] = await Promise.all([
      readPinnedJson(inputs.runDirectory, batchJob.contract, `${planJob.jobId} contract`),
      readPinnedJson(inputs.runDirectory, batchJob.inspection, `${planJob.jobId} inspection`),
      verifySanitizedPdf(inputs.runDirectory, batchJob),
    ]);
    const contract = contractArtifact.value;
    const inspection = inspectionArtifact.value;
    assert(contract.reviewState === "approved_for_sanitization", `${planJob.jobId} contract was not approved for sanitization`);
    assert(contract.eligibleForTemplateImport === false, `${planJob.jobId} contract incorrectly claims template-import approval`);
    validateInspection(inspection, batchJob, planJob);
    const pageGeometry = pageGeometryFromContract(contract, `${planJob.jobId} contract`);
    assert(pageGeometry.pageCount === inspection.validation.pageCount, `${planJob.jobId} page count drifted`);
    assert(!usedPdfPaths.has(sanitizedPdf.relativePath), `${planJob.jobId} reuses another job's output path`);
    usedPdfPaths.add(sanitizedPdf.relativePath);
    modePdfCounts[planJob.artwork.mode] += 1;

    for (const covered of planJob.coveredBindings) {
      const stub = stubsByKey.get(covered.stubKey);
      assert(stub, `${planJob.jobId} references missing template stub ${covered.stubKey}`);
      assert(!usedStubKeys.has(stub.key), `Template stub ${stub.key} is mapped more than once`);
      usedStubKeys.add(stub.key);
      assert(sameJson(stub.match, covered.selections), `${stub.key} match drifted from the sanitization plan`);
      const signature = selectionSignature(stub.match);
      assert(inputs.pricedSignatures.has(signature), `${stub.key} does not match a priced configuration`);
      assert(stub.guide?.factsReviewed === false, `${stub.key} unexpectedly claims native-guide review`);
      assert(typeof stub.guide?.sourceUrl === "string" && stub.guide.sourceUrl.startsWith("https://www.wir-machen-druck.de/"), `${stub.key} guide URL is invalid`);
      assert(typeof planJob.source?.executionIdentity?.sourceUrl === "string", `${planJob.jobId} has no exact template source URL`);
      assert(covered.artworkMode === planJob.artwork.mode, `${stub.key} artwork mode drifted`);
      const templateMode = templateModeProjection(planJob, contract, stub.key);

      bindings.push({
        sourceOrder: stub.sourceOrder,
        documentKey: stub.key,
        match: Object.fromEntries(TEMPLATE_BINDING_AXES.map((axis) => [axis, stub.match[axis]])),
        guide: {
          sourceUrl: stub.guide.sourceUrl,
          nativeGuideKey: stub.guide.nativeGuideKey,
          factsReviewed: false,
          reviewState: stub.guide.status,
        },
        template: {
          sourceUrl: planJob.source.executionIdentity.sourceUrl,
          sanitizedPdfPath: sanitizedPdf.relativePath,
          sanitizedPdfSha256: sanitizedPdf.sha256,
          widthMm: pageGeometry.widthMm,
          heightMm: pageGeometry.heightMm,
          bleedMm: pageGeometry.bleedMm,
          safeMm: pageGeometry.safeMm,
          pageCount: pageGeometry.pageCount,
          metadataRemoved: true,
          supplierBrandingRemoved: true,
          ...templateMode,
          designerTemplateId: null,
        },
        evidence: {
          sanitizationJobId: planJob.jobId,
          sanitizationJobSignatureSha256: planJob.safeOutputSignatureSha256,
          contractPath: contractArtifact.relativePath,
          contractSha256: contractArtifact.sha256,
          inspectionPath: inspectionArtifact.relativePath,
          inspectionSha256: inspectionArtifact.sha256,
          renderReviewManifestPath: inputs.renderArtifact.relativePath,
          renderReviewManifestSha256: inputs.renderArtifact.sha256,
        },
      });
      modeBindingCounts[planJob.artwork.mode] += 1;
    }
  }

  bindings.sort((left, right) => left.sourceOrder - right.sourceOrder);
  bindings.forEach((binding, index) => assert(binding.sourceOrder === index, `Template binding sourceOrder drifted at ${index}`));
  assert(bindings.length === EXPECTED_COUNTS.bindings, "Template binding-map count drifted");
  assert(usedStubKeys.size === stubsByKey.size, "At least one template stub is unused");
  assert(usedPdfPaths.size === EXPECTED_COUNTS.sanitizedPdfs, "Sanitized PDF path count drifted");
  assert(modePdfCounts.online_designer === EXPECTED_COUNTS.onlineDesignerPdfs, "Online Designer PDF count drifted");
  assert(modePdfCounts.professional_pdf_upload_only === EXPECTED_COUNTS.professionalUploadPdfs, "Professional-upload PDF count drifted");
  assert(modeBindingCounts.online_designer === EXPECTED_COUNTS.onlineDesignerBindings, "Online Designer binding count drifted");
  assert(modeBindingCounts.professional_pdf_upload_only === EXPECTED_COUNTS.professionalUploadBindings, "Professional-upload binding count drifted");
  assert(new Set(bindings.map((entry) => selectionSignature(entry.match))).size === EXPECTED_COUNTS.bindings, "Template binding map is ambiguous");
  return { bindings, modePdfCounts, modeBindingCounts };
}

function buildBoundedVisualApprovalDecision({ renderArtifact, reviewer, reviewedAt, approvalQuote }) {
  assert(typeof reviewer === "string" && reviewer.trim().length >= 2, "Visual reviewer is required");
  assert(typeof reviewedAt === "string" && !Number.isNaN(Date.parse(reviewedAt)), "Visual reviewedAt must be an ISO date");
  assert(typeof approvalQuote === "string" && approvalQuote.length > 0, "Exact visual approval quote is required");
  return {
    schemaVersion: 1,
    kind: "wmd_sales_folder_sanitized_pdf_render_approval_decision",
    state: BOUNDED_APPROVAL_STATE,
    reviewState: BOUNDED_APPROVAL_STATE,
    decision: {
      action: "approve_bounded_local_manifest_preparation",
      reviewer: reviewer.trim(),
      reviewedAt: new Date(reviewedAt).toISOString(),
      exactUserQuote: approvalQuote,
      exactUserQuoteSha256: sha256Bytes(Buffer.from(approvalQuote, "utf8")),
    },
    renderReviewManifest: {
      path: renderArtifact.relativePath,
      sha256: renderArtifact.sha256,
      bytes: renderArtifact.byteSize,
    },
    authorizationBoundary: {
      authorized: [
        "local_schema_version_2_manifest_preparation",
        "local_exact_template_binding_map",
        "local_machine_readable_blocker_report",
      ],
      explicitlyNotAuthorized: [
        "claim_that_all_119_contact_sheets_were_individually_reviewed",
        "native_guide_facts_approval",
        "designer_lock_or_export_verification",
        "storage_upload",
        "database_or_supplier_bank_write",
        "product_or_price_write",
        "publication",
      ],
      localOnly: true,
    },
    humanReviewScope: {
      allContactSheetsIndividuallyReviewedClaimed: false,
      nativeGuideFactsReviewed: false,
      designerRuntimeVerified: false,
      exportExclusionVerified: false,
    },
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
}

function validateBoundedVisualApprovalDecision(decision, renderArtifact) {
  assert(decision?.schemaVersion === 1, "Visual approval decision schemaVersion must be 1");
  assert(decision?.kind === "wmd_sales_folder_sanitized_pdf_render_approval_decision", "Visual approval decision kind drifted");
  assert(decision?.state === BOUNDED_APPROVAL_STATE && decision?.reviewState === BOUNDED_APPROVAL_STATE, "Visual approval decision is not bounded manifest-preparation approval");
  assert(decision?.renderReviewManifest?.path === renderArtifact.relativePath, "Visual approval decision pins another render manifest path");
  assert(decision?.renderReviewManifest?.sha256 === renderArtifact.sha256, "Visual approval decision is stale relative to the render manifest");
  assert(decision?.renderReviewManifest?.bytes === renderArtifact.byteSize, "Visual approval decision render byte size drifted");
  assert(decision?.humanReviewScope?.allContactSheetsIndividuallyReviewedClaimed === false, "Visual approval decision overstates individual review");
  assert(decision?.humanReviewScope?.nativeGuideFactsReviewed === false, "Visual approval decision overstates guide review");
  assert(decision?.humanReviewScope?.designerRuntimeVerified === false, "Visual approval decision overstates Designer verification");
  assert(decision?.humanReviewScope?.exportExclusionVerified === false, "Visual approval decision overstates export verification");
  assertAllFalse(decision.prohibitedActionsPerformed, "Visual approval prohibited actions");
}

async function loadOrRecordVisualApproval(inputs, options) {
  const decisionPath = safeRunPath(inputs.runDirectory, INPUT_PATHS.visualApprovalDecision, "visual approval decision", ".json");
  let exists = true;
  try {
    await fs.access(decisionPath);
  } catch {
    exists = false;
  }
  if (!exists && options.recordBoundedVisualApproval) {
    const decision = buildBoundedVisualApprovalDecision({
      renderArtifact: inputs.renderArtifact,
      reviewer: options.reviewer,
      reviewedAt: options.reviewedAt,
      approvalQuote: options.approvalQuote,
    });
    await atomicWrite(decisionPath, prettyJsonBytes(decision));
    const bytes = await fs.readFile(decisionPath);
    await atomicWrite(`${decisionPath}.sha256`, Buffer.from(`${sha256Bytes(bytes)}  ${path.basename(decisionPath)}\n`, "utf8"));
  }
  if (!exists && !options.recordBoundedVisualApproval) return null;
  const artifact = await readJsonArtifact(inputs.runDirectory, INPUT_PATHS.visualApprovalDecision, "visual approval decision");
  validateBoundedVisualApprovalDecision(artifact.value, inputs.renderArtifact);
  return artifact;
}

function compactArtifactEvidence(artifact, rows = null) {
  return {
    path: artifact.relativePath,
    sha256: artifact.sha256,
    bytes: artifact.byteSize,
    ...(rows === null ? {} : { rows }),
  };
}

function projectDisplayedFact(fact) {
  return {
    status: fact.status,
    value: fact.value,
    displayDa: fact.displayDa,
  };
}

async function assessNativeGuideFacts(inputs, bindingResult) {
  let artifact;
  let sidecarArtifact;
  try {
    artifact = await readJsonArtifact(
      inputs.runDirectory,
      INPUT_PATHS.nativeGuideFacts,
      "native guide facts",
    );
    sidecarArtifact = await readSha256Sidecar(
      inputs.runDirectory,
      artifact,
      "Native guide facts",
    );
    const assessment = validateNativeGuideFactsArtifact(artifact.value, {
      expectedBindings: bindingResult.bindings,
      expectedInputEvidence: {
        templateProjectionStubs: compactArtifactEvidence(
          inputs.stubsArtifact,
          inputs.stubsArtifact.rowCount,
        ),
        sanitizationPlan: compactArtifactEvidence(inputs.planArtifact),
        sanitizationBatch: compactArtifactEvidence(inputs.batchArtifact),
      },
    });
    return { artifact, sidecarArtifact, assessment, error: null };
  } catch (error) {
    return {
      artifact: artifact || null,
      sidecarArtifact: sidecarArtifact || null,
      assessment: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function applyNativeGuideFacts(bindingResult, nativeGuideFactsAssessment) {
  if (!nativeGuideFactsAssessment?.assessment?.factsReviewed) return bindingResult;
  const nativeArtifact = nativeGuideFactsAssessment.artifact;
  const nativeBindings = new Map(
    nativeArtifact.value.bindings.map((binding) => [binding.documentKey, binding]),
  );
  const bindings = bindingResult.bindings.map((binding) => {
    const nativeBinding = nativeBindings.get(binding.documentKey);
    assert(nativeBinding, `Native guide facts omit ${binding.documentKey}`);
    assert(nativeBinding.factsReviewed === true, `${binding.documentKey} displayed facts are not reviewed`);
    assert(nativeBinding.requiredFactGaps.length === 0, `${binding.documentKey} has required native-guide fact gaps`);
    assert(nativeBinding.conflicts.length === 0, `${binding.documentKey} has native-guide fact conflicts`);
    const displayedFacts = Object.fromEntries(
      nativeArtifact.value.requiredDisplayFactKeys.map((key) => [
        key,
        projectDisplayedFact(nativeBinding.facts[key]),
      ]),
    );
    return {
      ...binding,
      guide: {
        ...binding.guide,
        factsReviewed: true,
        reviewState: nativeArtifact.value.reviewState,
        nativeGuideFactsBindingKey: nativeBinding.documentKey,
        nativeGuideFactsBindingSha256: sha256Bytes(
          Buffer.from(canonicalJson(nativeBinding), "utf8"),
        ),
        displayedFacts,
        optionalOmissions: nativeBinding.optionalOmissions,
        sourceDisagreements: nativeBinding.sourceDisagreements,
      },
      evidence: {
        ...binding.evidence,
        nativeGuideFactsPath: nativeArtifact.relativePath,
        nativeGuideFactsSha256: nativeArtifact.sha256,
      },
    };
  });
  return {
    ...bindingResult,
    bindings,
    nativeGuideFacts: {
      artifact: compactArtifactEvidence(nativeArtifact),
      sidecar: compactArtifactEvidence(nativeGuideFactsAssessment.sidecarArtifact),
      assessment: nativeGuideFactsAssessment.assessment,
    },
  };
}

async function detectBlockers(
  inputs,
  bindingResult,
  visualDecisionArtifact,
  nativeGuideFactsAssessment,
) {
  const blockers = [];
  if (!visualDecisionArtifact) {
    blockers.push({
      id: "bounded_visual_approval_decision_missing",
      severity: "blocking",
      affectedCount: EXPECTED_COUNTS.sanitizedPdfs,
      message: "A separate decision must hash-pin the immutable render-review manifest before manifest preparation can advance.",
    });
  }

  if (nativeGuideFactsAssessment?.error) {
    blockers.push({
      id: "native_danish_guide_facts_invalid_or_missing",
      severity: "blocking",
      affectedCount: bindingResult.bindings.length,
      requiredArtifact: INPUT_PATHS.nativeGuideFacts,
      requiredState: "reviewed_source_facts_with_optional_omissions",
      factsReviewedWritten: false,
      validationError: nativeGuideFactsAssessment.error,
      message: "The native Danish guide-facts package is missing, stale, or invalid for the exact 3,692 document bindings.",
    });
  } else if (
    nativeGuideFactsAssessment?.assessment?.factsReviewed !== true
    || nativeGuideFactsAssessment.assessment.displayedFactsUnreviewedBindings > 0
    || nativeGuideFactsAssessment.assessment.bindingsWithRequiredFactGaps > 0
    || nativeGuideFactsAssessment.assessment.bindingsWithConflicts > 0
  ) {
    blockers.push({
      id: "native_danish_guide_display_facts_not_reviewed",
      severity: "blocking",
      affectedCount: nativeGuideFactsAssessment?.assessment?.displayedFactsUnreviewedBindings
        ?? bindingResult.bindings.length,
      requiredArtifact: INPUT_PATHS.nativeGuideFacts,
      requiredState: "reviewed_source_facts_with_optional_omissions",
      factsReviewedWritten: false,
      coverage: nativeGuideFactsAssessment?.assessment || null,
      message: "At least one required displayed guide fact or exact document binding is unreviewed or conflicting. Optional panel widths and numeric fold coordinates may remain explicitly omitted.",
    });
  }
  return blockers;
}

async function atomicWrite(destination, bytes) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: "wx" });
  await fs.rename(temporary, destination);
}

async function writeOutputWithSidecar(runDirectory, relativePath, bytes) {
  const destination = safeRunPath(runDirectory, relativePath, `output ${relativePath}`);
  await atomicWrite(destination, bytes);
  const sha256 = sha256Bytes(bytes);
  await atomicWrite(`${destination}.sha256`, Buffer.from(`${sha256}  ${path.basename(destination)}\n`, "utf8"));
  return { path: relativePath, sha256, bytes: bytes.length };
}

function inputEvidence(inputs, visualDecisionArtifact, nativeGuideFactsAssessment) {
  const artifacts = [
    inputs.discoveryArtifact,
    inputs.proposalArtifact,
    inputs.statusArtifact,
    inputs.priceRowsArtifact,
    inputs.stubsArtifact,
    inputs.planArtifact,
    inputs.batchArtifact,
    inputs.renderArtifact,
    inputs.canonicalIconGridArtifact,
    inputs.canonicalIconGridSidecarArtifact,
  ];
  if (visualDecisionArtifact) artifacts.push(visualDecisionArtifact);
  if (nativeGuideFactsAssessment?.artifact) artifacts.push(nativeGuideFactsAssessment.artifact);
  if (nativeGuideFactsAssessment?.sidecarArtifact) artifacts.push(nativeGuideFactsAssessment.sidecarArtifact);
  return artifacts.map((artifact) => ({
    path: artifact.relativePath,
    sha256: artifact.sha256,
    bytes: artifact.byteSize,
  }));
}

export async function prepareSalesFolderImportManifest({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  recordBoundedVisualApproval = false,
  reviewer = null,
  reviewedAt = null,
  approvalQuote = null,
  writeOutputs = true,
} = {}) {
  const inputs = await loadPreparationInputs({ runDirectory });
  let bindingResult = await buildTemplateBindingMap(inputs);
  const visualDecisionArtifact = await loadOrRecordVisualApproval(inputs, {
    recordBoundedVisualApproval,
    reviewer,
    reviewedAt,
    approvalQuote,
  });
  const nativeGuideFactsAssessment = await assessNativeGuideFacts(inputs, bindingResult);
  bindingResult = applyNativeGuideFacts(bindingResult, nativeGuideFactsAssessment);
  const blockers = await detectBlockers(
    inputs,
    bindingResult,
    visualDecisionArtifact,
    nativeGuideFactsAssessment,
  );

  const result = {
    inputs,
    bindingResult,
    visualDecisionArtifact,
    nativeGuideFactsAssessment,
    canonicalIconGrid: inputs.canonicalIconGridValidation,
    blockers,
    manifestWritten: false,
    outputs: {},
  };
  if (!writeOutputs) return result;

  const manifestPath = safeRunPath(inputs.runDirectory, OUTPUT_PATHS.manifest, "canonical import manifest", ".json");
  let manifestAlreadyExists = true;
  try {
    await fs.access(manifestPath);
  } catch {
    manifestAlreadyExists = false;
  }
  assert(!manifestAlreadyExists, "A canonical import-manifest.json already exists; refusing to leave a stale manifest beside blockers");

  const bindingBytes = Buffer.from(`${bindingResult.bindings.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  result.outputs.bindingMap = await writeOutputWithSidecar(inputs.runDirectory, OUTPUT_PATHS.bindingMap, bindingBytes);

  const blockerArtifact = {
    schemaVersion: 1,
    kind: "wmd_sales_folder_import_manifest_preflight",
    state: blockers.length === 0 ? "ready_to_assemble_extracted_manifest" : "blocked_before_import_manifest",
    localOnly: true,
    eligibleForImportManifest: blockers.length === 0,
    eligibleForSupplierBankWrite: false,
    eligibleForProductDraftWrite: false,
    eligibleForTemplateAttachment: false,
    targetManifest: {
      path: OUTPUT_PATHS.manifest,
      schemaVersion: 2,
      targetState: "extracted",
      written: false,
      reason: blockers.length === 0
        ? "Assembly is a separate deterministic step."
        : "A canonical manifest must not encode unresolved or unreviewed facts.",
    },
    templateBindingAxes: [...TEMPLATE_BINDING_AXES],
    counts: {
      sanitizedPdfs: EXPECTED_COUNTS.sanitizedPdfs,
      exactTemplateBindings: bindingResult.bindings.length,
      exactPricedConfigurations: inputs.pricedSignatures.size,
      priceRows: inputs.priceRowsArtifact.rowCount,
      onlineDesigner: {
        pdfs: bindingResult.modePdfCounts.online_designer,
        bindings: bindingResult.modeBindingCounts.online_designer,
      },
      professionalPdfUploadOnly: {
        pdfs: bindingResult.modePdfCounts.professional_pdf_upload_only,
        bindings: bindingResult.modeBindingCounts.professional_pdf_upload_only,
      },
      blockers: blockers.length,
    },
    inputEvidence: inputEvidence(inputs, visualDecisionArtifact, nativeGuideFactsAssessment),
    canonicalIconGrid: {
      artifact: compactArtifactEvidence(inputs.canonicalIconGridArtifact),
      sidecar: compactArtifactEvidence(inputs.canonicalIconGridSidecarArtifact),
      modelCount: inputs.canonicalIconGridValidation.modelOrder.length,
      modelOrder: inputs.canonicalIconGridValidation.modelOrder,
      assetCount: inputs.canonicalIconGridValidation.assets.length,
      sourceManifest: inputs.canonicalIconGridValidation.sourceManifest,
      rasterManifest: inputs.canonicalIconGridValidation.rasterManifest,
      excludedModelKeys: ["cd-135x135--2-part-closure"],
    },
    nativeGuideFacts: nativeGuideFactsAssessment?.artifact
      ? {
          artifact: compactArtifactEvidence(nativeGuideFactsAssessment.artifact),
          sidecar: compactArtifactEvidence(nativeGuideFactsAssessment.sidecarArtifact),
          state: nativeGuideFactsAssessment.artifact.value.state,
          reviewState: nativeGuideFactsAssessment.artifact.value.reviewState,
          factsReviewed: nativeGuideFactsAssessment.assessment?.factsReviewed === true,
          coverage: nativeGuideFactsAssessment.assessment,
        }
      : null,
    visualApprovalBoundary: visualDecisionArtifact
      ? {
          decisionPath: visualDecisionArtifact.relativePath,
          decisionSha256: visualDecisionArtifact.sha256,
          state: visualDecisionArtifact.value.state,
          allContactSheetsIndividuallyReviewedClaimed: false,
          nativeGuideFactsReviewed: nativeGuideFactsAssessment?.assessment?.factsReviewed === true,
          designerRuntimeVerified: false,
          exportExclusionVerified: false,
        }
      : null,
    bindingMap: result.outputs.bindingMap,
    blockers,
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
  result.outputs.blockers = await writeOutputWithSidecar(
    inputs.runDirectory,
    OUTPUT_PATHS.blockers,
    prettyJsonBytes(blockerArtifact),
  );
  return result;
}

function parseCli(argv) {
  const options = {
    runDirectory: DEFAULT_RUN_DIRECTORY,
    recordBoundedVisualApproval: false,
    reviewer: null,
    reviewedAt: null,
    approvalQuote: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run-dir") options.runDirectory = path.resolve(argv[++index]);
    else if (argument === "--record-bounded-visual-approval") options.recordBoundedVisualApproval = true;
    else if (argument === "--reviewer") options.reviewer = argv[++index];
    else if (argument === "--reviewed-at") options.reviewedAt = argv[++index];
    else if (argument === "--approval-quote") options.approvalQuote = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.recordBoundedVisualApproval) {
    assert(options.reviewer && options.reviewedAt && options.approvalQuote, "Recording bounded approval requires --reviewer, --reviewed-at, and --approval-quote");
  }
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const result = await prepareSalesFolderImportManifest(options);
  console.log(`Exact template bindings: ${result.bindingResult.bindings.length}`);
  console.log(`Sanitized PDFs: ${EXPECTED_COUNTS.sanitizedPdfs}`);
  console.log(`Online Designer: ${result.bindingResult.modePdfCounts.online_designer} PDFs / ${result.bindingResult.modeBindingCounts.online_designer} bindings`);
  console.log(`Professional PDF upload only: ${result.bindingResult.modePdfCounts.professional_pdf_upload_only} PDFs / ${result.bindingResult.modeBindingCounts.professional_pdf_upload_only} bindings`);
  console.log(`Binding map: ${result.outputs.bindingMap.path} (${result.outputs.bindingMap.sha256})`);
  console.log(`Blockers: ${result.outputs.blockers.path} (${result.blockers.length})`);
  console.log("Canonical import-manifest.json: not written");
  if (result.blockers.length > 0) process.exitCode = 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
