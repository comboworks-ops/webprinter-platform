#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);
const VALIDATOR_PATH = path.join(
  REPOSITORY_ROOT,
  ".agents/skills/import-supplier-product/scripts/validate-import-manifest.mjs",
);

export const AXIS_ORDER = Object.freeze([
  "folder_model",
  "print",
  "spine",
  "paper",
  "finish",
]);

export const EXPECTED_COUNTS = Object.freeze({
  folderModels: 20,
  priceRows: 108348,
  documentBindings: 3692,
  onlineDesignerBindings: 1562,
  professionalUploadBindings: 2130,
});

const INPUT_PATHS = Object.freeze({
  discovery: "discovery.json",
  proposal: "review/consolidated-product-proposal.json",
  consolidatedStatus: "review/consolidated-review-status.json",
  preflight: "review/import-manifest-blockers.json",
  iconGrid: "review/canonical-icon-grid-v1.json",
  nativeGuideFacts: "review/native-guide-facts.json",
  pricing: "review/proposed-price-rows.jsonl",
  documents: "review/import-template-binding-map.jsonl",
  visualApproval: "review/sanitized-pdf-render-approval-decision.json",
  productDraftApproval: "review/product-draft-approval-decision.json",
  reviewReport: "review/consolidated-product-report.md",
});

const OUTPUT_PATHS = Object.freeze({
  manifest: "import-manifest.json",
  sidecar: "import-manifest.json.sha256",
  hero: "assets/product-hero/webprinter-sales-folder-hero-v1.png",
  iconDirectory: "assets/icons/folder-models/v1",
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedRelativePath(value, label) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized.length > 0, `${label} is missing`);
  assert(!path.posix.isAbsolute(normalized), `${label} must be run-relative`);
  assert(path.posix.normalize(normalized) === normalized, `${label} is not normalized`);
  assert(!normalized.split("/").includes(".."), `${label} escapes its package root`);
  return normalized;
}

function resolveInside(root, relativePath, label) {
  const safe = normalizedRelativePath(relativePath, label);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, safe);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label} resolves outside its package root`);
  return resolved;
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function prettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readBytes(root, relativePath, label) {
  const safe = normalizedRelativePath(relativePath, label);
  const absolutePath = resolveInside(root, safe, label);
  const bytes = await fs.readFile(absolutePath);
  return {
    path: safe,
    absolutePath,
    bytes,
    sha256: sha256Bytes(bytes),
    byteSize: bytes.length,
  };
}

async function readJson(root, relativePath, label) {
  const artifact = await readBytes(root, relativePath, label);
  try {
    artifact.value = JSON.parse(artifact.bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return artifact;
}

export function descriptorForArtifact(artifact, rowCount = undefined) {
  const descriptor = {
    path: artifact.path,
    sha256: artifact.sha256,
    bytes: artifact.byteSize,
  };
  if (rowCount !== undefined) {
    descriptor.rowCount = rowCount;
    descriptor.format = "jsonl";
  }
  return descriptor;
}

async function scanJsonl(root, relativePath, label, onRow) {
  const safe = normalizedRelativePath(relativePath, label);
  const absolutePath = resolveInside(root, safe, label);
  const hash = createHash("sha256");
  let byteSize = 0;
  let rowCount = 0;
  const input = createReadStream(absolutePath);
  input.on("data", (chunk) => {
    hash.update(chunk);
    byteSize += chunk.length;
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
    path: safe,
    absolutePath,
    sha256: hash.digest("hex"),
    byteSize,
    rowCount,
  };
}

function sameStringSet(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

export function assertZeroBlockers(preflight) {
  const blockers = Array.isArray(preflight?.blockers) ? preflight.blockers : [];
  const count = Number(preflight?.counts?.blockers);
  assert(Number.isInteger(count), "Preflight does not report a blocker count");
  assert(count === blockers.length, "Preflight blocker count does not match its blocker list");
  assert(count === 0, `Import manifest remains blocked by ${count} unresolved blocker(s)`);
  assert(preflight?.eligibleForImportManifest === true, "Preflight has not approved manifest assembly");
  assert(preflight?.targetManifest?.schemaVersion === 2, "Preflight does not target schema version 2");
}

function assertPinnedByPreflight(preflight, artifact, label) {
  const evidence = [
    ...(preflight.inputEvidence || []),
    preflight.bindingMap,
    preflight.nativeGuideFacts?.artifact,
    preflight.canonicalIconGrid?.artifact,
  ].filter(Boolean).find((entry) => entry.path === artifact.path);
  assert(evidence, `${label} is not hash-pinned by the zero-blocker preflight`);
  assert(evidence.sha256 === artifact.sha256, `${label} hash drifted after preflight`);
  assert(Number(evidence.bytes) === artifact.byteSize, `${label} byte size drifted after preflight`);
}

function assertAxisIdentity(selections, label) {
  assert(selections && typeof selections === "object" && !Array.isArray(selections), `${label} selections are missing`);
  assert(sameStringSet(Object.keys(selections), AXIS_ORDER), `${label} must contain exactly the five reviewed axes`);
  for (const axis of AXIS_ORDER) assert(String(selections[axis] || "").length > 0, `${label}.${axis} is empty`);
}

export function validateDocumentMode(template, label = "document template") {
  assert(template && typeof template === "object", `${label} is missing`);
  if (template.artworkMode === "online_designer") {
    assert(template.onlineDesignerAllowed === true, `${label} online mode must be Designer-enabled`);
    assert(template.designerTemplateId === null, `${label} must not have a Designer ID at extracted state`);
    assert(template.verificationStatus === "pending", `${label} online verification must remain pending`);
    assert(template.designerLoadMode === "locked_non_printing_guide_overlay", `${label} has the wrong Designer load mode`);
    assert(template.lockedInDesigner === true, `${label} must be locked in Designer`);
    assert(template.nonPrintingOverlay === true, `${label} must be non-printing`);
    assert(template.excludedFromExport === true, `${label} must be excluded from export`);
    return "online_designer";
  }
  assert(template.artworkMode === "professional_pdf_upload_only", `${label} has an unsupported artwork mode`);
  assert(template.onlineDesignerAllowed === false, `${label} professional mode must disable Designer`);
  assert(template.designerTemplateId === null, `${label} professional mode must not have a Designer ID`);
  assert(template.verificationStatus === "not_applicable", `${label} professional verification must be not applicable`);
  assert(template.designerLoadMode === "download_only", `${label} professional mode must be download-only`);
  assert(template.lockedInDesigner === false, `${label} professional mode cannot claim a Designer lock`);
  assert(template.nonPrintingOverlay === false, `${label} professional mode cannot claim a Designer overlay`);
  assert(template.excludedFromExport === false, `${label} professional mode cannot claim Designer export exclusion`);
  assert(String(template.artworkModeReasonDa || "").trim(), `${label} professional mode needs a Danish reason`);
  return "professional_pdf_upload_only";
}

export function projectOptionGroups({ proposal, canonicalIconGrid, stagedIconPathForKey }) {
  assert(JSON.stringify(proposal.axisOrder) === JSON.stringify(AXIS_ORDER), "Proposal axis order drifted");
  assert(Array.isArray(proposal.optionGroups) && proposal.optionGroups.length === AXIS_ORDER.length, "Proposal must contain five option groups");
  assert(proposal.optionGroups.every((group, index) => group.key === AXIS_ORDER[index] && group.sourceOrder === index), "Proposal option groups are not in reviewed source order");
  assert(canonicalIconGrid?.modelCount === EXPECTED_COUNTS.folderModels, "Canonical icon grid must contain 20 models");
  assert(Array.isArray(canonicalIconGrid.values) && canonicalIconGrid.values.length === EXPECTED_COUNTS.folderModels, "Canonical icon values are incomplete");
  assert(!canonicalIconGrid.modelOrder.includes("cd-135x135--2-part-closure"), "CD folder is present in the canonical icon order");

  const sourceModelGroup = proposal.optionGroups[0];
  const canonicalByKey = new Map(canonicalIconGrid.values.map((value) => [value.key, value]));
  assert(sourceModelGroup.values.length === EXPECTED_COUNTS.folderModels, "Proposal folder-model count drifted");
  assert(
    JSON.stringify(sourceModelGroup.values.map((value) => value.key)) === JSON.stringify(canonicalIconGrid.modelOrder),
    "Canonical icon order does not match the frozen product proposal",
  );

  return proposal.optionGroups.map((group) => ({
    ...group,
    values: group.values.map((value) => {
      if (group.key !== "folder_model") return { ...value };
      const canonical = canonicalByKey.get(value.key);
      assert(canonical, `Canonical PNG is missing for ${value.key}`);
      assert(canonical.sourceOrder === value.sourceOrder, `Canonical PNG source order drifted for ${value.key}`);
      assert(canonical.icon?.transparent === true, `${value.key} PNG is not approved as transparent`);
      assert(canonical.icon?.supplierBrandingRemoved === true, `${value.key} PNG still has supplier branding`);
      const referenceUrl = value.icon?.provenance?.supplierReferenceUrl;
      assert(String(referenceUrl || "").startsWith("https://"), `${value.key} has no source reference URL`);
      return {
        ...value,
        icon: {
          referenceUrl,
          generatedAssetPath: stagedIconPathForKey(value.key),
          styleKey: canonical.icon.styleKey,
          transparent: true,
          supplierBrandingRemoved: true,
          sha256: canonical.icon.ui.sha256,
          bytes: canonical.icon.ui.byteSize,
          widthPx: canonical.icon.ui.widthPx,
          heightPx: canonical.icon.ui.heightPx,
          accessibleNameDa: canonical.accessibleNameDa,
          backendProjection: canonicalIconGrid.backendProjection,
        },
      };
    }),
  }));
}

export function assertOutputCollision({ existingBytes, expectedBytes, check, label }) {
  if (existingBytes == null) {
    assert(!check, `${label} does not exist; --check never creates missing outputs`);
    return;
  }
  assert(check, `${label} already exists; rerun with --check to verify identical bytes`);
  assert(Buffer.compare(existingBytes, expectedBytes) === 0, `${label} differs from the deterministic candidate`);
}

async function maybeRead(absolutePath) {
  try {
    return await fs.readFile(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function validateCandidate(runDirectory, manifestBytes) {
  const temporaryPath = path.join(runDirectory, `.import-manifest.${process.pid}.validation.json`);
  await fs.writeFile(temporaryPath, manifestBytes, { flag: "wx" });
  try {
    const result = spawnSync(process.execPath, [VALIDATOR_PATH, temporaryPath], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    assert(
      result.status === 0,
      `Canonical validator rejected the assembled manifest:\n${String(result.stderr || result.stdout).trim()}`,
    );
  } finally {
    await fs.unlink(temporaryPath).catch(() => {});
  }
}

async function buildAssetPlan({ proposal, iconGrid }) {
  const plans = [];
  const hero = proposal.visualAssets?.productHero;
  assert(hero, "Frozen proposal has no product hero artifact");
  const heroSource = resolveInside(REPOSITORY_ROOT, hero.repoAssetPath, "product hero source");
  const heroBytes = await fs.readFile(heroSource);
  assert(sha256Bytes(heroBytes) === hero.sha256, "Product hero hash drifted from the frozen proposal");
  assert(heroBytes.length === Number(hero.byteSize), "Product hero byte size drifted from the frozen proposal");
  plans.push({
    kind: "product_hero",
    sourcePath: heroSource,
    sourceRepositoryPath: hero.repoAssetPath,
    destinationPath: OUTPUT_PATHS.hero,
    bytes: heroBytes,
    sha256: hero.sha256,
  });

  for (const value of iconGrid.values) {
    const sourceRepositoryPath = normalizedRelativePath(value.icon?.ui?.repoAssetPath, `${value.key} canonical PNG path`);
    const sourcePath = resolveInside(REPOSITORY_ROOT, sourceRepositoryPath, `${value.key} canonical PNG source`);
    const bytes = await fs.readFile(sourcePath);
    assert(sha256Bytes(bytes) === value.icon.ui.sha256, `${value.key} canonical PNG hash drifted`);
    assert(bytes.length === Number(value.icon.ui.byteSize), `${value.key} canonical PNG byte size drifted`);
    plans.push({
      kind: "folder_model_icon",
      key: value.key,
      sourcePath,
      sourceRepositoryPath,
      destinationPath: `${OUTPUT_PATHS.iconDirectory}/${value.key}.png`,
      bytes,
      sha256: value.icon.ui.sha256,
    });
  }
  return plans;
}

async function verifyEvidencePins(preflight, artifacts) {
  for (const [label, artifact] of Object.entries(artifacts)) {
    if (["preflight", "visualApproval", "productDraftApproval"].includes(label)) continue;
    assertPinnedByPreflight(preflight, artifact, label);
  }
}

export async function assembleManifest(runDirectory = DEFAULT_RUN_DIRECTORY) {
  const root = path.resolve(runDirectory);
  const [
    discovery,
    proposal,
    consolidatedStatus,
    preflight,
    iconGrid,
    nativeGuideFacts,
    visualApproval,
    productDraftApproval,
    reviewReport,
  ] = await Promise.all([
    readJson(root, INPUT_PATHS.discovery, "discovery"),
    readJson(root, INPUT_PATHS.proposal, "frozen product proposal"),
    readJson(root, INPUT_PATHS.consolidatedStatus, "frozen consolidated status"),
    readJson(root, INPUT_PATHS.preflight, "manifest preflight"),
    readJson(root, INPUT_PATHS.iconGrid, "canonical icon grid"),
    readJson(root, INPUT_PATHS.nativeGuideFacts, "native guide facts"),
    readJson(root, INPUT_PATHS.visualApproval, "visual approval decision"),
    readJson(root, INPUT_PATHS.productDraftApproval, "product draft approval decision"),
    readBytes(root, INPUT_PATHS.reviewReport, "review report"),
  ]);

  assertZeroBlockers(preflight.value);
  assert(preflight.value.counts?.priceRows === EXPECTED_COUNTS.priceRows, "Preflight price-row count drifted");
  assert(preflight.value.counts?.exactTemplateBindings === EXPECTED_COUNTS.documentBindings, "Preflight document count drifted");
  assert(visualApproval.value?.state === "approved_for_manifest_preparation", "Visual/PDF review is not approved for manifest preparation");
  assert(
    productDraftApproval.value?.state === "approved_for_supplier_bank_and_unpublished_product_draft",
    "Unpublished product-draft approval is missing",
  );
  assert(productDraftApproval.value?.target?.isPublished === false, "Product-draft approval unexpectedly permits publication");
  assert(productDraftApproval.value?.target?.productSlug === proposal.value?.proposedProduct?.slug, "Approved slug differs from the frozen proposal");
  assert(Array.isArray(nativeGuideFacts.value?.bindings), "Native guide facts has no exact binding projection");
  assert(nativeGuideFacts.value.bindings.length === EXPECTED_COUNTS.documentBindings, "Native guide facts does not cover every exact binding");

  await verifyEvidencePins(preflight.value, {
    discovery,
    proposal,
    consolidatedStatus,
    preflight,
    iconGrid,
    nativeGuideFacts,
    visualApproval,
    productDraftApproval,
  });

  const knownValues = new Map(
    proposal.value.optionGroups.map((group) => [group.key, new Set(group.values.map((value) => value.key))]),
  );
  const pricing = await scanJsonl(root, INPUT_PATHS.pricing, "exact sparse price rows", (row, index) => {
    assert(row.sourceOrder === index, `Price row ${index + 1} sourceOrder is not contiguous`);
    assertAxisIdentity(row.selections, `Price row ${index + 1}`);
    for (const axis of AXIS_ORDER) assert(knownValues.get(axis)?.has(row.selections[axis]), `Price row ${index + 1} has unknown ${axis}`);
    assert(row.noInterpolation === true, `Price row ${index + 1} does not prohibit interpolation`);
  });
  assert(pricing.rowCount === EXPECTED_COUNTS.priceRows, "Exact sparse price-row count drifted");

  const modeCounts = { online_designer: 0, professional_pdf_upload_only: 0 };
  const documents = await scanJsonl(root, INPUT_PATHS.documents, "exact document bindings", (row, index) => {
    assert(row.sourceOrder === index, `Document binding ${index + 1} sourceOrder is not contiguous`);
    assertAxisIdentity(row.match, `Document binding ${index + 1}`);
    for (const axis of AXIS_ORDER) assert(knownValues.get(axis)?.has(row.match[axis]), `Document binding ${index + 1} has unknown ${axis}`);
    assert(row.guide?.factsReviewed === true, `Document binding ${index + 1} guide facts are not reviewed`);
    const mode = validateDocumentMode(row.template, `Document binding ${index + 1}`);
    modeCounts[mode] += 1;
  });
  assert(documents.rowCount === EXPECTED_COUNTS.documentBindings, "Exact document-binding count drifted");
  assert(modeCounts.online_designer === EXPECTED_COUNTS.onlineDesignerBindings, "Online Designer binding count drifted");
  assert(modeCounts.professional_pdf_upload_only === EXPECTED_COUNTS.professionalUploadBindings, "Professional-upload binding count drifted");

  assertPinnedByPreflight(preflight.value, pricing, "pricing JSONL");
  assertPinnedByPreflight(preflight.value, documents, "document binding JSONL");

  const assetPlans = await buildAssetPlan({ proposal: proposal.value, iconGrid: iconGrid.value });
  const assetByKey = new Map(assetPlans.filter((entry) => entry.key).map((entry) => [entry.key, entry]));
  const optionGroups = projectOptionGroups({
    proposal: proposal.value,
    canonicalIconGrid: iconGrid.value,
    stagedIconPathForKey: (key) => {
      const asset = assetByKey.get(key);
      assert(asset, `No staged canonical PNG exists for ${key}`);
      return asset.destinationPath;
    },
  });

  const inputEvidence = [
    discovery,
    proposal,
    consolidatedStatus,
    preflight,
    iconGrid,
    nativeGuideFacts,
    pricing,
    documents,
    reviewReport,
  ].map((artifact) => descriptorForArtifact(artifact, artifact.rowCount));

  const approvalEvidence = [visualApproval, productDraftApproval].map((artifact) => ({
    ...descriptorForArtifact(artifact),
    state: artifact.value.state,
  }));
  const heroPlan = assetPlans.find((entry) => entry.kind === "product_hero");
  const product = proposal.value.proposedProduct;
  const discoveryValue = discovery.value;
  const manifest = {
    schemaVersion: 2,
    runId: path.basename(root),
    source: {
      supplierSlug: "wir-machen-druck",
      entryUrl: discoveryValue.sourceCategoryUrl,
      scopeMode: "single_product_family",
      extractor: `fetch-wmd-sales-folders-v${discoveryValue.extractorVersion}`,
      capturedAt: discoveryValue.capturedAt,
      allowedHosts: discoveryValue.allowedHosts,
    },
    product: {
      sourceKey: product.slug,
      slug: product.slug,
      nameOriginal: product.nameOriginal,
      nameDa: product.nameDa,
      descriptionOriginal: discoveryValue.categories?.[0]?.title || product.nameOriginal,
      descriptionDa: product.aboutDescriptionDa,
      shortDescriptionDa: product.shortDescriptionDa,
      aboutTitleDa: product.aboutTitleDa,
      categoryDa: product.categoryDa,
      sourceLanguage: "de",
      targetLanguage: "da",
      family: product.family,
      pricingType: product.pricingType,
      isPublished: false,
    },
    catalogScope: proposal.value.catalogScope,
    optionAxisOrder: AXIS_ORDER,
    optionGroups,
    pricing: {
      supplierCurrency: "EUR",
      vatState: "excluded",
      conversionRuleKey: discoveryValue.conversionRule,
      sparseCombinationsOnly: true,
      interpolationAllowed: false,
      recordsArtifact: descriptorForArtifact(pricing, pricing.rowCount),
    },
    documents: {
      templateBindingAxes: AXIS_ORDER,
      recordsArtifact: descriptorForArtifact(documents, documents.rowCount),
      artworkModeCounts: modeCounts,
      nativeGuideFactsArtifact: descriptorForArtifact(nativeGuideFacts),
    },
    visualAssets: {
      productHero: {
        path: heroPlan.destinationPath,
        sha256: heroPlan.sha256,
        bytes: heroPlan.bytes.length,
        mimeType: "image/png",
        sourceRepositoryPath: heroPlan.sourceRepositoryPath,
      },
      hero: {
        generatedAssetPath: heroPlan.destinationPath,
        sha256: heroPlan.sha256,
        bytes: heroPlan.bytes.length,
        mimeType: "image/png",
      },
      canonicalIconGrid: descriptorForArtifact(iconGrid),
      folderModelIcons: assetPlans
        .filter((entry) => entry.kind === "folder_model_icon")
        .map((entry) => ({ key: entry.key, path: entry.destinationPath, sha256: entry.sha256, bytes: entry.bytes.length })),
    },
    evidence: {
      inputs: inputEvidence,
      approvals: approvalEvidence,
      zeroBlockerPreflight: descriptorForArtifact(preflight),
    },
    target: {
      mode: "supplier_bank",
      state: "extracted",
      publishProduct: false,
      writeLivePricing: false,
      productSlug: product.slug,
      tenantId: productDraftApproval.value.target.tenantId,
      collisionPolicy: productDraftApproval.value.target.collisionPolicy,
      approvedNextState: "product_draft",
    },
    artifacts: {
      rawSnapshot: INPUT_PATHS.discovery,
      normalizedPricing: INPUT_PATHS.pricing,
      reviewReport: INPUT_PATHS.reviewReport,
      importPreflight: INPUT_PATHS.preflight,
      nativeGuideFacts: INPUT_PATHS.nativeGuideFacts,
      canonicalIconGrid: INPUT_PATHS.iconGrid,
    },
    mutationBoundary: {
      localAssemblyOnly: true,
      supplierBankWritten: false,
      productWritten: false,
      pricingWritten: false,
      storageWritten: false,
      published: false,
    },
  };

  return { manifest, manifestBytes: prettyJsonBytes(manifest), assetPlans };
}

async function materialize({ runDirectory, manifestBytes, assetPlans, check }) {
  const manifestPath = resolveInside(runDirectory, OUTPUT_PATHS.manifest, "manifest output");
  const sidecarPath = resolveInside(runDirectory, OUTPUT_PATHS.sidecar, "manifest sidecar output");
  const manifestSha256 = sha256Bytes(manifestBytes);
  const sidecarBytes = Buffer.from(`${manifestSha256}  ${path.basename(manifestPath)}\n`, "utf8");
  const targets = [
    ...assetPlans.map((asset) => ({ label: asset.destinationPath, path: resolveInside(runDirectory, asset.destinationPath, asset.destinationPath), bytes: asset.bytes })),
    { label: OUTPUT_PATHS.manifest, path: manifestPath, bytes: manifestBytes },
    { label: OUTPUT_PATHS.sidecar, path: sidecarPath, bytes: sidecarBytes },
  ];

  for (const target of targets) {
    assertOutputCollision({ existingBytes: await maybeRead(target.path), expectedBytes: target.bytes, check, label: target.label });
  }
  if (check) return { manifestPath, manifestSha256, checked: true };

  for (const target of targets) await fs.mkdir(path.dirname(target.path), { recursive: true });
  const createdPaths = [];
  try {
    for (const target of targets) {
      await fs.writeFile(target.path, target.bytes, { flag: "wx" });
      createdPaths.push(target.path);
    }
  } catch (error) {
    for (const createdPath of createdPaths.reverse()) await fs.unlink(createdPath).catch(() => {});
    throw error;
  }
  return { manifestPath, manifestSha256, checked: false };
}

export async function runAssembler({ runDirectory = DEFAULT_RUN_DIRECTORY, check = false } = {}) {
  const root = path.resolve(runDirectory);
  const assembled = await assembleManifest(root);
  await validateCandidate(root, assembled.manifestBytes);
  return materialize({ runDirectory: root, ...assembled, check });
}

function parseArguments(argv) {
  let runDirectory = DEFAULT_RUN_DIRECTORY;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") check = true;
    else if (argument === "--run-dir") {
      runDirectory = argv[index + 1];
      index += 1;
      assert(runDirectory, "--run-dir requires a path");
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return { runDirectory, check };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await runAssembler(options);
    console.log(`${result.checked ? "Verified" : "Wrote"} ${result.manifestPath}`);
    console.log(`SHA-256: ${result.manifestSha256}`);
    console.log("Target state: extracted (local only; no database, storage, pricing, or publication write)");
  } catch (error) {
    console.error(`Sales-folder manifest assembly failed: ${error.message}`);
    process.exitCode = 1;
  }
}
