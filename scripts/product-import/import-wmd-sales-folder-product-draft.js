#!/usr/bin/env node
import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const TARGET_SLUG = "salgsmapper-med-eget-design";
export const EXPECTED_AXIS_ORDER = ["folder_model", "print", "spine", "paper", "finish"];
export const EXPECTED_COUNTS = Object.freeze({
  optionGroups: 5,
  folderModels: 20,
  priceRows: 108_348,
  documentBindings: 3_692,
  uniquePdfs: 1_420,
  onlineDesignerPdfs: 710,
  onlineDesignerBindings: 1_562,
  professionalUploadBindings: 2_130,
});

export const FOLDER_MODEL_SIZE_GROUPS = Object.freeze([
  { id: "a4", label: "A4", formatKey: "a4" },
  { id: "a5", label: "A5", formatKey: "a5" },
  { id: "a6", label: "A6", formatKey: "a6" },
  { id: "m65", label: "M65", formatKey: "din-lang" },
  { id: "square-21x21", label: "21 × 21 cm", formatKey: "square-21x21" },
]);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_RUN_DIR = path.join(
  REPO_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);
const DEFAULT_MANIFEST_NAME = "import-manifest.json";
const PRICE_CHUNK_SIZE = 500;
const PDF_BUCKET = "design-library";
const IMAGE_BUCKET = "product-images";
const HERO_FALLBACK = "src/assets/product-options/sales-folders/webprinter-sales-folder-hero-v1.png";
const RASTER_MANIFEST_FALLBACK =
  "src/assets/product-options/sales-folders/models/v1/raster-manifest.json";
const SHA256_RE = /^[a-f0-9]{64}$/i;

function nonEmpty(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} must be a non-empty string`);
  return text;
}

function exactInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${field} must be a non-negative integer`);
  return number;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  const handle = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest("hex");
}

function assertSha256(value, field) {
  const hash = nonEmpty(value, field).toLowerCase();
  if (!SHA256_RE.test(hash)) throw new Error(`${field} must be a SHA-256 hex digest`);
  return hash;
}

function safeRelativePath(value, field) {
  const relative = nonEmpty(value, field);
  if (path.isAbsolute(relative) || relative.split(/[\\/]+/).includes("..")) {
    throw new Error(`${field} must be a safe relative path`);
  }
  return relative;
}

function resolveArtifactPath(manifestPath, relativePath, field) {
  const safe = safeRelativePath(relativePath, field);
  const base = path.dirname(manifestPath);
  const absolute = path.resolve(base, safe);
  if (!absolute.startsWith(`${base}${path.sep}`)) throw new Error(`${field} escapes the run directory`);
  return absolute;
}

function resolveRepoOrRunPath(manifestPath, relativePath, field) {
  const safe = safeRelativePath(relativePath, field);
  const candidate = safe.startsWith("src/") || safe.startsWith("public/")
    ? path.resolve(REPO_ROOT, safe)
    : resolveArtifactPath(manifestPath, safe, field);
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
    throw new Error(`${field} does not resolve to a file: ${safe}`);
  }
  return candidate;
}

export function parseArgs(argv) {
  const readValue = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  const runDir = path.resolve(readValue("--run-dir") || DEFAULT_RUN_DIR);
  const manifestPath = path.resolve(readValue("--manifest") || path.join(runDir, DEFAULT_MANIFEST_NAME));
  const confirmBankWrite = argv.includes("--confirm-bank-write");
  const confirmProductDraft = argv.includes("--confirm-product-draft");
  if (confirmProductDraft && !confirmBankWrite) {
    throw new Error("--confirm-product-draft requires --confirm-bank-write in the same reviewed run");
  }
  return {
    runDir,
    manifestPath,
    confirmBankWrite,
    confirmProductDraft,
    dryRun: !confirmBankWrite && !confirmProductDraft,
    receiptPath: path.resolve(
      readValue("--receipt") || path.join(runDir, "review", "product-draft-write-receipt.json"),
    ),
  };
}

export function immutableObjectPath({ runId, sha256, fileName, namespace }) {
  const digest = assertSha256(sha256, "sha256");
  const safeRun = nonEmpty(runId, "runId").replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const extension = path.extname(fileName).toLowerCase();
  if (!extension || !/^\.[a-z0-9]+$/.test(extension)) throw new Error("fileName must have a safe extension");
  const safeNamespace = nonEmpty(namespace, "namespace")
    .split("/")
    .map((part) => part.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase())
    .filter(Boolean)
    .join("/");
  return `${safeNamespace}/${safeRun}/${digest}${extension}`;
}

async function* readJsonl(filePath) {
  const input = fs.createReadStream(filePath);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let index = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new Error(`${path.basename(filePath)} row ${index + 1} is invalid JSON: ${error.message}`);
    }
    yield { row, index };
    index += 1;
  }
}

function verifyArtifactDescriptor(manifestPath, descriptor, field, expectedRows) {
  if (!descriptor || typeof descriptor !== "object") throw new Error(`${field} is required`);
  const filePath = resolveArtifactPath(manifestPath, descriptor.path, `${field}.path`);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error(`${field}.path does not exist`);
  if (descriptor.format !== "jsonl") throw new Error(`${field}.format must be jsonl`);
  const bytes = exactInteger(descriptor.bytes, `${field}.bytes`);
  const rowCount = exactInteger(descriptor.rowCount, `${field}.rowCount`);
  if (bytes !== fs.statSync(filePath).size) throw new Error(`${field}.bytes does not match the file`);
  const expectedHash = assertSha256(descriptor.sha256, `${field}.sha256`);
  if (sha256File(filePath) !== expectedHash) throw new Error(`${field}.sha256 does not match the file`);
  if (rowCount !== expectedRows) throw new Error(`${field}.rowCount must be ${expectedRows}`);
  return { filePath, rowCount, bytes, sha256: expectedHash };
}

function manifestSlug(manifest) {
  return String(manifest.product?.slug || manifest.product?.slugDa || manifest.storefront?.slug || "").trim();
}

function sourceUrlForPrice(row, manifest) {
  return row.sourceUrl || row.sourceEvidence?.sourceUrl || manifest.source?.entryUrl || null;
}

function normalizeOptionGroups(manifest) {
  const groups = Array.isArray(manifest.optionGroups) ? manifest.optionGroups : [];
  return [...groups]
    .sort((a, b) => Number(a.sourceOrder) - Number(b.sourceOrder))
    .map((group) => ({
      ...group,
      values: [...(Array.isArray(group.values) ? group.values : [])]
        .sort((a, b) => Number(a.sourceOrder) - Number(b.sourceOrder)),
    }));
}

function resolveHeroAsset(manifest, manifestPath) {
  const relative = manifest.visualAssets?.hero?.generatedAssetPath
    || manifest.visualAssets?.hero?.repoAssetPath
    || manifest.artifacts?.hero?.path
    || HERO_FALLBACK;
  return resolveRepoOrRunPath(manifestPath, relative, "hero asset");
}

function resolveRasterManifest(manifest, manifestPath) {
  const relative = manifest.visualAssets?.folderModelRasterManifest?.path
    || manifest.artifacts?.folderModelRasterManifest?.path
    || RASTER_MANIFEST_FALLBACK;
  const filePath = resolveRepoOrRunPath(manifestPath, relative, "folder model raster manifest");
  const value = readJson(filePath);
  if (value.approvedModelCount !== EXPECTED_COUNTS.folderModels) {
    throw new Error(`folder model raster manifest must contain ${EXPECTED_COUNTS.folderModels} approved models`);
  }
  if (value.models?.["cd-135x135--2-part-closure"]) throw new Error("CD folder must not be in the raster manifest");
  return { value, filePath };
}

function resolveIconAsset(groupValue, rasterManifest, manifestPath) {
  const manifestEntry = rasterManifest.models?.[groupValue.key];
  const relative = groupValue.icon?.generatedAssetPath || manifestEntry?.ui?.repoAssetPath;
  if (!relative) throw new Error(`folder_model '${groupValue.key}' has no canonical PNG`);
  const filePath = resolveRepoOrRunPath(manifestPath, relative, `folder_model '${groupValue.key}' icon`);
  if (path.extname(filePath).toLowerCase() !== ".png") throw new Error(`${groupValue.key} icon must be PNG`);
  const actualHash = sha256File(filePath);
  const expectedHash = groupValue.icon?.sha256 || manifestEntry?.ui?.sha256;
  if (expectedHash && actualHash !== assertSha256(expectedHash, `${groupValue.key} icon sha256`)) {
    throw new Error(`${groupValue.key} icon SHA-256 mismatch`);
  }
  return { filePath, sha256: actualHash };
}

function validateManifestEnvelope(manifest) {
  if (manifest.schemaVersion !== 2) throw new Error("sales-folder draft import requires schemaVersion 2");
  if (manifestSlug(manifest) !== TARGET_SLUG) throw new Error(`manifest target slug must be ${TARGET_SLUG}`);
  if (manifest.target?.publishProduct !== false || manifest.target?.writeLivePricing !== false) {
    throw new Error("manifest publication/live-pricing safeguards must both be false");
  }
  if (!new Set(["extracted", "bank_draft"]).has(manifest.target?.state)) {
    throw new Error("pre-write manifest target.state must be extracted or bank_draft");
  }
  const groups = normalizeOptionGroups(manifest);
  const axes = groups.map((group) => group.key);
  if (JSON.stringify(axes) !== JSON.stringify(EXPECTED_AXIS_ORDER)) {
    throw new Error(`option axes must be exactly ${EXPECTED_AXIS_ORDER.join(", ")}`);
  }
  if (groups.length !== EXPECTED_COUNTS.optionGroups) throw new Error("sales-folder import must have five option groups");
  if (groups[0].values.length !== EXPECTED_COUNTS.folderModels) throw new Error("sales-folder import must have 20 folder models");
  if (groups[0].values.some((value) => value.key === "cd-135x135--2-part-closure")) {
    throw new Error("CD folder is explicitly excluded");
  }
  for (const group of groups) {
    if (!group.values.length) throw new Error(`option group '${group.key}' has no values`);
    group.values.forEach((value, index) => {
      if (Number(value.sourceOrder) !== index) throw new Error(`${group.key} value order is not contiguous`);
    });
  }
  return groups;
}

async function inspectPrices({ artifact, manifest, groups }) {
  const known = new Map(groups.map((group) => [group.key, new Set(group.values.map((value) => value.key))]));
  const signatures = new Set();
  const quantities = new Set();
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minQuantity = Infinity;
  let maxQuantity = -Infinity;
  let count = 0;
  for await (const { row, index } of readJsonl(artifact.filePath)) {
    if (Number(row.sourceOrder) !== index) throw new Error(`price sourceOrder ${row.sourceOrder} must equal row ${index}`);
    const selections = row.selections || {};
    if (JSON.stringify(Object.keys(selections)) !== JSON.stringify(EXPECTED_AXIS_ORDER)) {
      throw new Error(`price row ${index} must contain the exact five ordered axes`);
    }
    for (const axis of EXPECTED_AXIS_ORDER) {
      if (!known.get(axis)?.has(selections[axis])) throw new Error(`price row ${index} has unknown ${axis}`);
    }
    const quantity = Number(row.quantity);
    const price = Number(row.finalPriceDkk);
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(price) || price <= 0) {
      throw new Error(`price row ${index} has invalid quantity/finalPriceDkk`);
    }
    const signature = JSON.stringify([EXPECTED_AXIS_ORDER.map((axis) => selections[axis]), quantity]);
    if (signatures.has(signature)) throw new Error(`duplicate price identity at row ${index}`);
    signatures.add(signature);
    quantities.add(quantity);
    minPrice = Math.min(minPrice, price);
    maxPrice = Math.max(maxPrice, price);
    minQuantity = Math.min(minQuantity, quantity);
    maxQuantity = Math.max(maxQuantity, quantity);
    count += 1;
  }
  if (count !== EXPECTED_COUNTS.priceRows) throw new Error(`expected ${EXPECTED_COUNTS.priceRows} prices, found ${count}`);
  return {
    rowCount: count,
    quantities: [...quantities].sort((a, b) => a - b),
    minPrice,
    maxPrice,
    minQuantity,
    maxQuantity,
    supplierCurrency: manifest.pricing.supplierCurrency,
    conversionRuleKey: manifest.pricing.conversionRuleKey,
  };
}

function assertDocumentMode(template, index) {
  if (template.artworkMode === "online_designer") {
    if (
      template.onlineDesignerAllowed !== true
      || template.designerTemplateId !== null
      || template.designerLoadMode !== "locked_non_printing_guide_overlay"
      || template.lockedInDesigner !== true
      || template.nonPrintingOverlay !== true
      || template.excludedFromExport !== true
    ) throw new Error(`online Designer document row ${index} has unsafe overlay flags`);
    return;
  }
  if (template.artworkMode === "professional_pdf_upload_only") {
    if (
      template.onlineDesignerAllowed !== false
      || template.designerTemplateId !== null
      || template.designerLoadMode !== "download_only"
      || template.lockedInDesigner !== false
      || template.nonPrintingOverlay !== false
      || template.excludedFromExport !== false
      || !String(template.artworkModeReasonDa || "").trim()
    ) throw new Error(`professional-upload document row ${index} has unsafe mode flags`);
    return;
  }
  throw new Error(`document row ${index} has unsupported artworkMode`);
}

function reviewedGuideFacts(document) {
  if (document?.guide?.factsReviewed !== true) return null;
  const facts = document.guide.displayedFacts
    || document.guide.facts
    || document.guide.reviewedFacts
    || null;
  return facts && typeof facts === "object" && !Array.isArray(facts) ? facts : null;
}

function evidencedFactValue(facts, key) {
  const fact = facts?.[key];
  return fact?.status === "evidenced" ? fact.value : null;
}

function conciseReviewedGuideFacts(document) {
  const facts = reviewedGuideFacts(document);
  if (!facts) return null;
  const compact = {};
  for (const key of [
    "dataFormatMm",
    "finalFormatMm",
    "foldedFinalFormatMm",
    "bleedMm",
    "safetyMm",
    "panelWidthsMm",
    "colorMode",
    "minimumResolutionDpi",
    "pageOrder",
    "deliveryRules",
  ]) {
    const value = evidencedFactValue(facts, key);
    if (value != null) compact[key] = value;
  }
  const folds = evidencedFactValue(facts, "folds");
  if (folds && typeof folds === "object") {
    compact.folds = {
      supplierFoldLinesPresent: folds.supplierFoldLinesPresent === true,
      count: Number.isInteger(Number(folds.count)) ? Number(folds.count) : null,
      positionsMm: Array.isArray(folds.positionsMm)
        ? folds.positionsMm.filter((value) => Number.isFinite(Number(value))).map(Number)
        : null,
      templateFoldLayerSha256: SHA256_RE.test(String(folds.templateFoldLayerSha256 || ""))
        ? folds.templateFoldLayerSha256
        : null,
      sanitizedTemplateFoldLayerPreserved: folds.sanitizedTemplateFoldLayerPreserved === true,
    };
  }
  return Object.keys(compact).length ? compact : null;
}

function reviewedGuideGeometry(document) {
  if (document?.guide?.factsReviewed !== true) return null;
  const raw = document.guide.guideGeometry || document.guide.guide_geometry || null;
  if (!raw || !Array.isArray(raw.pages) || raw.pages.length === 0) return null;
  const pages = raw.pages.map((page, index) => {
    const widthMm = Number(page?.widthMm);
    const heightMm = Number(page?.heightMm);
    if (!(widthMm > 0) || !(heightMm > 0) || !Array.isArray(page?.foldLines)) return null;
    const foldLines = page.foldLines.map((line) => {
      const positionMm = Number(line?.positionMm);
      if (
        !new Set(["vertical", "horizontal"]).has(line?.axis)
        || !(positionMm > 0)
        || positionMm >= (line.axis === "vertical" ? widthMm : heightMm)
      ) return null;
      return { axis: line.axis, positionMm };
    });
    if (foldLines.some((line) => line === null)) return null;
    return {
      page: Number.isInteger(Number(page?.page)) ? Number(page.page) : index + 1,
      ...(String(page?.label || "").trim() ? { label: String(page.label).trim() } : {}),
      widthMm,
      heightMm,
      foldLines,
    };
  });
  return pages.some((page) => page === null) ? null : { pages };
}

async function inspectDocuments({ artifact, manifestPath, groups }) {
  const known = new Map(groups.map((group) => [group.key, new Set(group.values.map((value) => value.key))]));
  const matches = new Set();
  const pdfs = new Map();
  const minimumDpiValues = new Set();
  const colorModeValues = new Set();
  let onlineDesignerBindings = 0;
  let professionalUploadBindings = 0;
  let count = 0;
  for await (const { row, index } of readJsonl(artifact.filePath)) {
    if (Number(row.sourceOrder) !== index) throw new Error(`document sourceOrder ${row.sourceOrder} must equal row ${index}`);
    const match = row.match || {};
    if (JSON.stringify(Object.keys(match)) !== JSON.stringify(EXPECTED_AXIS_ORDER)) {
      throw new Error(`document row ${index} must contain the exact five ordered axes`);
    }
    for (const axis of EXPECTED_AXIS_ORDER) {
      if (!known.get(axis)?.has(match[axis])) throw new Error(`document row ${index} has unknown ${axis}`);
    }
    const signature = JSON.stringify(EXPECTED_AXIS_ORDER.map((axis) => match[axis]));
    if (matches.has(signature)) throw new Error(`duplicate document match at row ${index}`);
    matches.add(signature);
    if (row.guide?.factsReviewed !== true) throw new Error(`document row ${index} has unreviewed native guide facts`);
    const template = row.template || {};
    assertDocumentMode(template, index);
    if (template.artworkMode === "online_designer") onlineDesignerBindings += 1;
    else professionalUploadBindings += 1;
    const facts = reviewedGuideFacts(row);
    const minimumDpi = Number(evidencedFactValue(facts, "minimumResolutionDpi"));
    const colorMode = evidencedFactValue(facts, "colorMode");
    if (minimumDpi > 0) minimumDpiValues.add(minimumDpi);
    if (typeof colorMode === "string" && colorMode.trim()) colorModeValues.add(colorMode.trim().toUpperCase());
    if ((row.guide?.guideGeometry || row.guide?.guide_geometry) && !reviewedGuideGeometry(row)) {
      throw new Error(`document row ${index} has invalid or unreviewed guideGeometry`);
    }
    if (template.metadataRemoved !== true || template.supplierBrandingRemoved !== true) {
      throw new Error(`document row ${index} has an unsanitized PDF`);
    }
    const filePath = resolveArtifactPath(
      manifestPath,
      template.sanitizedPdfPath,
      `document row ${index} sanitizedPdfPath`,
    );
    if (!fs.existsSync(filePath)) throw new Error(`document row ${index} PDF is missing`);
    const sha256 = assertSha256(template.sanitizedPdfSha256, `document row ${index} sanitizedPdfSha256`);
    const existing = pdfs.get(sha256);
    const pdf = {
      sha256,
      filePath,
      relativePath: template.sanitizedPdfPath,
      artworkMode: template.artworkMode,
      widthMm: Number(template.widthMm),
      heightMm: Number(template.heightMm),
      bleedMm: Number(template.bleedMm),
      safeMm: Number(template.safeMm),
      pageCount: Number(template.pageCount),
    };
    if (existing && existing.relativePath !== pdf.relativePath) {
      throw new Error(`PDF hash ${sha256} is assigned to multiple paths`);
    }
    pdfs.set(sha256, pdf);
    count += 1;
  }
  if (count !== EXPECTED_COUNTS.documentBindings) {
    throw new Error(`expected ${EXPECTED_COUNTS.documentBindings} document bindings, found ${count}`);
  }
  if (pdfs.size !== EXPECTED_COUNTS.uniquePdfs) {
    throw new Error(`expected ${EXPECTED_COUNTS.uniquePdfs} unique PDFs, found ${pdfs.size}`);
  }
  for (const pdf of pdfs.values()) {
    if (sha256File(pdf.filePath) !== pdf.sha256) throw new Error(`PDF SHA-256 mismatch: ${pdf.relativePath}`);
  }
  const onlineCount = [...pdfs.values()].filter((pdf) => pdf.artworkMode === "online_designer").length;
  if (onlineCount !== EXPECTED_COUNTS.onlineDesignerPdfs) {
    throw new Error(`expected ${EXPECTED_COUNTS.onlineDesignerPdfs} online Designer PDFs, found ${onlineCount}`);
  }
  if (onlineDesignerBindings !== EXPECTED_COUNTS.onlineDesignerBindings) {
    throw new Error(`expected ${EXPECTED_COUNTS.onlineDesignerBindings} online Designer bindings, found ${onlineDesignerBindings}`);
  }
  if (professionalUploadBindings !== EXPECTED_COUNTS.professionalUploadBindings) {
    throw new Error(`expected ${EXPECTED_COUNTS.professionalUploadBindings} professional-upload bindings, found ${professionalUploadBindings}`);
  }
  if (minimumDpiValues.size > 1) throw new Error("reviewed native guide facts disagree on minimum DPI");
  if (colorModeValues.size > 1) throw new Error("reviewed native guide facts disagree on color mode");
  return {
    rowCount: count,
    pdfs,
    onlineDesignerBindings,
    professionalUploadBindings,
    minimumDpi: minimumDpiValues.size === 1 ? [...minimumDpiValues][0] : null,
    colorMode: colorModeValues.size === 1 ? [...colorModeValues][0] : null,
  };
}

export async function preflightLocal(manifestPath) {
  const manifest = readJson(manifestPath);
  const groups = validateManifestEnvelope(manifest);
  const pricingArtifact = verifyArtifactDescriptor(
    manifestPath,
    manifest.pricing?.recordsArtifact,
    "pricing.recordsArtifact",
    EXPECTED_COUNTS.priceRows,
  );
  const documentArtifact = verifyArtifactDescriptor(
    manifestPath,
    manifest.documents?.recordsArtifact,
    "documents.recordsArtifact",
    EXPECTED_COUNTS.documentBindings,
  );
  const rasterManifest = resolveRasterManifest(manifest, manifestPath);
  const iconAssets = new Map();
  for (const value of groups[0].values) {
    iconAssets.set(value.key, resolveIconAsset(value, rasterManifest.value, manifestPath));
  }
  const heroPath = resolveHeroAsset(manifest, manifestPath);
  const hero = { filePath: heroPath, sha256: sha256File(heroPath) };
  const pricingSummary = await inspectPrices({ artifact: pricingArtifact, manifest, groups });
  const documentSummary = await inspectDocuments({ artifact: documentArtifact, manifestPath, groups });
  return {
    manifest,
    manifestPath,
    manifestSha256: sha256File(manifestPath),
    groups,
    pricingArtifact,
    documentArtifact,
    pricingSummary,
    documentSummary,
    iconAssets,
    hero,
  };
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required for confirmed writes");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function maybeSingle(query, label) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function refuseTargetCollision(client) {
  const existing = await maybeSingle(
    client
      .from("products")
      .select("id,tenant_id,slug,is_published")
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("slug", TARGET_SLUG),
    "target collision check",
  );
  if (existing) {
    throw new Error(`Collision: ${MASTER_TENANT_ID}/${TARGET_SLUG} already exists as ${existing.id}; no existing product was changed`);
  }
}

async function insertOne(client, table, payload, select, receipt, receiptKey) {
  const { data, error } = await client.from(table).insert(payload).select(select).single();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  if (data?.id) receipt.created[receiptKey].push(data.id);
  return data;
}

async function ensureSupplier(client, receipt) {
  const existing = await maybeSingle(
    client.from("supplier_bank_suppliers").select("id,slug").eq("slug", "wir-machen-druck"),
    "supplier lookup",
  );
  if (existing) return existing;
  return insertOne(
    client,
    "supplier_bank_suppliers",
    {
      name: "WIRmachenDRUCK",
      slug: "wir-machen-druck",
      website_url: "https://www.wir-machen-druck.de",
      country_code: "DE",
      currency: "EUR",
      integration_type: "playwright",
      enabled: true,
      metadata: { writer: "import-wmd-sales-folder-product-draft.js", insertOnly: true },
    },
    "id,slug",
    receipt,
    "supplierRows",
  );
}

async function writeBankDraft(client, preflight, receipt) {
  const { manifest, pricingSummary } = preflight;
  const supplier = await ensureSupplier(client, receipt);
  const sourceKey = nonEmpty(manifest.product.sourceKey, "product.sourceKey");
  const existing = await maybeSingle(
    client
      .from("supplier_bank_products")
      .select("id,supplier_product_key,status")
      .eq("supplier_id", supplier.id)
      .eq("supplier_product_key", sourceKey),
    "Supplier Bank product collision check",
  );
  if (existing) {
    throw new Error(`Collision: Supplier Bank product '${sourceKey}' already exists as ${existing.id}; no row was overwritten`);
  }
  const now = new Date().toISOString();
  const scrapeRun = await insertOne(
    client,
    "supplier_bank_scrape_runs",
    {
      supplier_id: supplier.id,
      mode: "product_extract",
      tool: "playwright",
      status: "succeeded",
      input: { sourceUrl: manifest.source.entryUrl, runId: manifest.runId, manifestSha256: preflight.manifestSha256 },
      summary: {
        productFamily: "sales_folders",
        priceRows: EXPECTED_COUNTS.priceRows,
        exactCombinations: EXPECTED_COUNTS.documentBindings,
        documentPdfs: EXPECTED_COUNTS.uniquePdfs,
      },
      finished_at: now,
    },
    "id",
    receipt,
    "scrapeRuns",
  );
  const bankProduct = await insertOne(
    client,
    "supplier_bank_products",
    {
      supplier_id: supplier.id,
      latest_scrape_run_id: scrapeRun.id,
      supplier_product_key: sourceKey,
      source_url: manifest.source.entryUrl,
      source_hash: preflight.pricingArtifact.sha256,
      product_family: "sales_folders",
      name_original: manifest.product.nameOriginal,
      name_da: manifest.product.nameDa,
      description_original: manifest.product.descriptionOriginal,
      description_da: manifest.product.descriptionDa,
      source_language: manifest.product.sourceLanguage,
      target_language: "da",
      status: "draft",
      normalized_attributes: {
        axisOrder: EXPECTED_AXIS_ORDER,
        groups: preflight.groups.map((group) => ({
          key: group.key,
          labelDa: group.labelDa,
          sourceOrder: group.sourceOrder,
          values: group.values.map((value) => ({ key: value.key, labelDa: value.labelDa, sourceOrder: value.sourceOrder })),
        })),
      },
      normalized_pricing_summary: {
        rowCount: pricingSummary.rowCount,
        exactCombinationCount: EXPECTED_COUNTS.documentBindings,
        quantityMin: pricingSummary.minQuantity,
        quantityMax: pricingSummary.maxQuantity,
        priceMinDkk: pricingSummary.minPrice,
        priceMaxDkk: pricingSummary.maxPrice,
        sparse: true,
        interpolationAllowed: false,
      },
      raw_snapshot_path: manifest.artifacts?.rawSnapshot || null,
      scrape_status: "fresh",
      last_scraped_at: now,
      last_price_checked_at: now,
      metadata: {
        runId: manifest.runId,
        manifestSha256: preflight.manifestSha256,
        pricingArtifact: manifest.pricing.recordsArtifact,
        documentArtifact: manifest.documents.recordsArtifact,
        externalArtifactsAreAuthoritative: true,
      },
    },
    "id",
    receipt,
    "bankProducts",
  );
  const priceSnapshot = await insertOne(
    client,
    "supplier_bank_price_snapshots",
    {
      bank_product_id: bankProduct.id,
      supplier_id: supplier.id,
      scrape_run_id: scrapeRun.id,
      currency: manifest.pricing.supplierCurrency,
      conversion_rule_key: manifest.pricing.conversionRuleKey,
      raw_price_rows: [],
      normalized_price_rows: [],
      price_min_dkk: pricingSummary.minPrice,
      price_max_dkk: pricingSummary.maxPrice,
      quantity_min: pricingSummary.minQuantity,
      quantity_max: pricingSummary.maxQuantity,
      checksum: preflight.pricingArtifact.sha256,
      metadata: {
        runId: manifest.runId,
        recordsExternalByDesign: true,
        recordsArtifact: manifest.pricing.recordsArtifact,
        rowCount: pricingSummary.rowCount,
      },
    },
    "id",
    receipt,
    "priceSnapshots",
  );
  receipt.bank = {
    supplierId: supplier.id,
    scrapeRunId: scrapeRun.id,
    bankProductId: bankProduct.id,
    priceSnapshotId: priceSnapshot.id,
  };
  return receipt.bank;
}

async function uploadImmutable(client, { bucket, objectPath, filePath, contentType }, receipt) {
  const { error } = await client.storage.from(bucket).upload(objectPath, fs.readFileSync(filePath), {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`immutable upload failed for ${bucket}/${objectPath}: ${error.message}`);
  receipt.created.storageObjects.push({ bucket, objectPath });
  return client.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

function groupKind(key) {
  if (key === "folder_model") return "format";
  if (key === "paper") return "material";
  if (key === "finish") return "finish";
  return "other";
}

function sectionType(key) {
  if (key === "folder_model") return "formats";
  if (key === "paper") return "materials";
  if (key === "finish") return "finishes";
  return "other";
}

export function buildResolvedCatalog(groups, productId, iconUrls = new Map()) {
  const resolved = new Map();
  for (const [groupIndex, definition] of groups.entries()) {
    const group = {
      id: randomUUID(),
      tenant_id: MASTER_TENANT_ID,
      product_id: productId,
      library_group_id: null,
      name: definition.labelDa,
      kind: groupKind(definition.key),
      ui_mode: definition.displayType === "dropdown" ? "dropdown" : "buttons",
      source: "product",
      sort_order: groupIndex,
      enabled: true,
    };
    const values = definition.values.map((value, valueIndex) => ({
      id: randomUUID(),
      tenant_id: MASTER_TENANT_ID,
      product_id: productId,
      group_id: group.id,
      name: value.labelDa,
      key: value.key,
      sort_order: valueIndex,
      enabled: true,
      width_mm: value.widthMm ?? null,
      height_mm: value.heightMm ?? null,
      meta: {
        sourceKey: value.key,
        ...(iconUrls.get(value.key) ? { image: iconUrls.get(value.key), generatedSupplierNeutral: true } : {}),
      },
    }));
    resolved.set(definition.key, {
      definition,
      group,
      values,
      valueByKey: new Map(values.map((value) => [value.key, value])),
    });
  }
  return resolved;
}

export function buildPricingStructure(groups, resolved, quantities, iconUrls = new Map()) {
  const sectionIdByAxis = Object.fromEntries(EXPECTED_AXIS_ORDER.map((axis) => [axis, `sales-folder-${axis}`]));
  const buildSection = (definition) => {
    const catalog = resolved.get(definition.key);
    const isIcons = definition.key === "folder_model";
    const valueGroups = isIcons
      ? FOLDER_MODEL_SIZE_GROUPS.map((group) => ({
          id: group.id,
          label: group.label,
          valueIds: definition.values
            .filter((value) => value.formatKey === group.formatKey)
            .map((value) => catalog.valueByKey.get(value.key)?.id)
            .filter(Boolean),
        })).filter((group) => group.valueIds.length > 0)
      : null;
    return {
      id: sectionIdByAxis[definition.key],
      sectionId: sectionIdByAxis[definition.key],
      sectionType: sectionType(definition.key),
      groupId: catalog.group.id,
      valueIds: catalog.values.map((value) => value.id),
      ui_mode: definition.displayType === "dropdown" ? "dropdown" : "buttons",
      selection_mode: "required",
      thumbnail_size: isIcons ? "xl" : "medium",
      ...(isIcons ? { thumbnail_custom_px: 128 } : {}),
      ...(valueGroups ? { valueGroups } : {}),
      ...(definition.key === "spine" ? { hideUnavailableValues: true } : {}),
      valueSettings: Object.fromEntries(catalog.values.map((value) => [
        value.id,
        {
          displayName: isIcons && value.key.startsWith("din-lang--")
            ? value.name.replace(/^DIN lang\b/i, "M65")
            : value.name,
          ...(isIcons ? {
            showThumbnail: false,
            customImage: iconUrls.get(value.key),
            preferCustomImage: true,
            imageSizePx: 128,
          } : {}),
        },
      ])),
      title: definition.labelDa,
      description: "",
    };
  };
  const paper = groups.find((group) => group.key === "paper");
  const layoutDefinitions = groups.filter((group) => group.key !== "paper");
  const vertical = buildSection(paper);
  return {
    mode: "matrix_layout_v1",
    version: 1,
    sparseCompatibilityRequired: true,
    interpolationAllowed: false,
    autoResolveExactCombination: true,
    customerSelectionOrder: EXPECTED_AXIS_ORDER,
    vertical_axis: vertical,
    layout_rows: [{
      id: "sales-folder-configuration",
      title: "Konfigurér din salgsmappe",
      description: "Kun dokumenterede kombinationer viser en pris.",
      columns: layoutDefinitions.map(buildSection),
    }],
    quantities,
    templateBinding: {
      profile: "sales_folder_v1",
      axisSections: sectionIdByAxis,
    },
  };
}

function selectionIdsFor(row, resolved) {
  return Object.fromEntries(EXPECTED_AXIS_ORDER.map((axis) => {
    const value = resolved.get(axis)?.valueByKey.get(row[axis]);
    if (!value) throw new Error(`cannot resolve ${axis}='${row[axis]}'`);
    return [axis, value.id];
  }));
}

export function buildTemplateFile({ document, resolved, pricingStructure, pdfUrl, designerTemplateId, uploadedAt }) {
  const selectionIds = selectionIdsFor(document.match, resolved);
  const selectionLabels = Object.fromEntries(EXPECTED_AXIS_ORDER.map((axis) => [
    axis,
    resolved.get(axis).valueByKey.get(document.match[axis]).name,
  ]));
  const sectionMap = pricingStructure.templateBinding.axisSections;
  const constraints = Object.fromEntries(EXPECTED_AXIS_ORDER.map((axis) => [sectionMap[axis], selectionIds[axis]]));
  const template = document.template;
  const isOnline = template.artworkMode === "online_designer";
  const nativeGuideFacts = conciseReviewedGuideFacts(document);
  const guideGeometry = reviewedGuideGeometry(document);
  if (!isOnline && designerTemplateId) throw new Error("professional-upload template must not receive a Designer ID");
  if (isOnline && !designerTemplateId) throw new Error("online Designer template requires a Designer ID");
  return {
    name: `Salgsmappe – ${EXPECTED_AXIS_ORDER.map((axis) => selectionLabels[axis]).join(" · ")}`,
    url: pdfUrl,
    pdfUrl,
    path: template.storageObjectPath,
    format: selectionLabels.folder_model,
    configuration: EXPECTED_AXIS_ORDER
      .filter((axis) => axis !== "folder_model")
      .map((axis) => selectionLabels[axis])
      .join(" · "),
    sourceConfigurationKey: document.documentKey,
    selectionConstraints: constraints,
    selectionConstraintProfile: "sales_folder_v1",
    selectionConstraintSections: sectionMap,
    designerTemplateId: isOnline ? designerTemplateId : null,
    designerLoadMode: isOnline ? "locked_non_printing_guide_overlay" : "download_only",
    lockedInDesigner: isOnline,
    nonPrintingOverlay: isOnline,
    excludedFromExport: isOnline,
    artworkMode: template.artworkMode,
    artworkModeReasonDa: template.artworkModeReasonDa || null,
    templatePdfSha256: template.sanitizedPdfSha256,
    widthMm: Number(template.widthMm),
    heightMm: Number(template.heightMm),
    bleedMm: Number(template.bleedMm),
    safeMm: Number(template.safeMm),
    pageCount: Number(template.pageCount),
    nativeGuideKey: document.guide.nativeGuideKey,
    ...(nativeGuideFacts ? { nativeGuideFacts } : {}),
    ...(guideGeometry ? { guideGeometry } : {}),
    uploadedAt,
  };
}

export function buildGenericPriceRow({ record, productId, resolved, pricingStructure, bank }) {
  const selectionIds = selectionIdsFor(record.selections, resolved);
  const verticalAxis = "paper";
  const variantValueIds = EXPECTED_AXIS_ORDER.filter((axis) => axis !== verticalAxis).map((axis) => selectionIds[axis]);
  const variantName = [...variantValueIds].sort().join("|") || "none";
  return {
    tenant_id: MASTER_TENANT_ID,
    product_id: productId,
    variant_name: variantName,
    variant_value: selectionIds[verticalAxis],
    quantity: Number(record.quantity),
    price_dkk: Number(record.finalPriceDkk),
    extra_data: {
      verticalAxisGroupId: resolved.get(verticalAxis).group.id,
      verticalAxisValueId: selectionIds[verticalAxis],
      selectionMap: { ...selectionIds, variantValueIds },
      variantValueIds,
      formatId: selectionIds.folder_model,
      materialId: selectionIds.paper,
      supplierBankProductId: bank.bankProductId,
      supplierBankPriceSnapshotId: bank.priceSnapshotId,
      supplierPrice: Number(record.supplierPrice),
      supplierCurrency: record.supplierCurrency,
      convertedPriceDkk: Number(record.convertedPriceDkk),
      conversionRuleKey: record.conversionRuleKey,
      sourceUrl: sourceUrlForPrice(record, { source: {} }),
      sourceOrder: Number(record.sourceOrder),
      noInterpolation: true,
      templateBindingProfile: pricingStructure.templateBinding.profile,
    },
  };
}

export function buildProductPayload({ manifest, productId, heroUrl, pricingStructure, templateFiles, preflight, bank }) {
  return {
    id: productId,
    tenant_id: MASTER_TENANT_ID,
    name: manifest.product.nameDa,
    slug: TARGET_SLUG,
    description: manifest.product.descriptionDa,
    category: "tryksager",
    pricing_type: "matrix",
    pricing_structure: pricingStructure,
    image_url: heroUrl,
    about_title: manifest.storefront?.aboutTitleDa || manifest.product.aboutTitleDa || "Salgsmapper med eget design",
    about_description: manifest.storefront?.aboutDescriptionDa || manifest.product.aboutDescriptionDa || manifest.product.descriptionDa,
    about_image_url: heroUrl,
    is_published: false,
    is_available_to_tenants: false,
    is_ready: false,
    preset_key: "custom",
    icon_text: manifest.product.nameDa,
    default_quantity: preflight.pricingSummary.quantities[0],
    template_files: templateFiles,
    technical_specs: {
      source: "supplier-bank",
      supplierProductKey: manifest.product.sourceKey,
      supplierBankProductId: bank.bankProductId,
      supplierBankPriceSnapshotId: bank.priceSnapshotId,
      importRunId: manifest.runId,
      importManifestSha256: preflight.manifestSha256,
      priceArtifactSha256: preflight.pricingArtifact.sha256,
      documentArtifactSha256: preflight.documentArtifact.sha256,
      templateBindingAxes: EXPECTED_AXIS_ORDER,
      templateBindingProfile: "sales_folder_v1",
      ...(preflight.documentSummary.minimumDpi
        ? {
            min_dpi: preflight.documentSummary.minimumDpi,
            min_dpi_source: "reviewed_native_guide_facts",
          }
        : {}),
      ...(preflight.documentSummary.colorMode
        ? {
            color_mode: preflight.documentSummary.colorMode,
            color_mode_source: "reviewed_native_guide_facts",
          }
        : {}),
      color_profile: "FOGRA39",
      professionalArtworkWarningDa:
        "Visse efterbehandlinger kræver en professionel tryk-PDF med staffagefarver. Download den valgte skabelon; online Designer er deaktiveret for disse valg.",
      sparseCompatibilityRequired: true,
      interpolationAllowed: false,
      autoResolveExactCombination: true,
    },
  };
}

async function uploadDraftAssets(client, preflight, receipt) {
  const runId = preflight.manifest.runId;
  const safeRunId = nonEmpty(runId, "runId").replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const heroObjectPath = `supplier-imports/wmd-sales-folders/${safeRunId}/hero/hero-${preflight.hero.sha256}.png`;
  const heroUrl = await uploadImmutable(client, {
    bucket: IMAGE_BUCKET,
    objectPath: heroObjectPath,
    filePath: preflight.hero.filePath,
    contentType: "image/png",
  }, receipt);
  const iconUrls = new Map();
  for (const [modelKey, asset] of preflight.iconAssets) {
    const safeModelKey = nonEmpty(modelKey, "modelKey").replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
    const objectPath = `supplier-imports/wmd-sales-folders/${safeRunId}/models/${safeModelKey}-${asset.sha256}.png`;
    const url = await uploadImmutable(client, {
      bucket: IMAGE_BUCKET,
      objectPath,
      filePath: asset.filePath,
      contentType: "image/png",
    }, receipt);
    iconUrls.set(modelKey, url);
  }
  const pdfUrls = new Map();
  for (const pdf of preflight.documentSummary.pdfs.values()) {
    const objectPath = `template-pdfs/${MASTER_TENANT_ID}/supplier-imports/wmd-sales-folders/${safeRunId}/${pdf.sha256}.pdf`;
    const url = await uploadImmutable(client, {
      bucket: PDF_BUCKET,
      objectPath,
      filePath: pdf.filePath,
      contentType: "application/pdf",
    }, receipt);
    pdfUrls.set(pdf.sha256, { url, objectPath });
  }
  return { heroUrl, iconUrls, pdfUrls };
}

export function buildDesignerTemplateRow({ pdf, uploadedPdf, id, sortOrder }) {
  if (pdf.artworkMode !== "online_designer") {
    throw new Error("only online_designer PDFs may create designer_templates rows");
  }
  return {
    id,
    tenant_id: MASTER_TENANT_ID,
    name: `Salgsmappe – trykskabelon ${pdf.sha256.slice(0, 12)}`,
    description: "Leverandørneutral, hash-kontrolleret trykskabelon til salgsmapper.",
    template_type: "format",
    category: "Salgsmapper",
    width_mm: pdf.widthMm,
    height_mm: pdf.heightMm,
    bleed_mm: pdf.bleedMm,
    safe_area_mm: pdf.safeMm,
    dpi_default: 300,
    dpi_min_required: 150,
    color_profile: "FOGRA39",
    template_pdf_url: uploadedPdf.url,
    is_public: false,
    is_active: true,
    library_kind: "blank",
    source_kind: "native",
    tags: ["salgsmappe", "leverandoerskabelon", TARGET_SLUG, pdf.sha256],
    sort_order: sortOrder,
  };
}

async function createDesignerTemplates(client, preflight, uploaded, receipt) {
  const templates = new Map();
  const rows = [];
  let sortOrder = 0;
  for (const pdf of preflight.documentSummary.pdfs.values()) {
    if (pdf.artworkMode !== "online_designer") continue;
    const uploadedPdf = uploaded.pdfUrls.get(pdf.sha256);
    const id = randomUUID();
    rows.push(buildDesignerTemplateRow({ pdf, uploadedPdf, id, sortOrder }));
    templates.set(pdf.sha256, id);
    sortOrder += 1;
  }
  if (templates.size !== EXPECTED_COUNTS.onlineDesignerPdfs) {
    throw new Error(`prepared ${templates.size} Designer templates; expected ${EXPECTED_COUNTS.onlineDesignerPdfs}`);
  }
  for (let index = 0; index < rows.length; index += 250) {
    const chunk = rows.slice(index, index + 250);
    const { error } = await client.from("designer_templates").insert(chunk);
    if (error) throw new Error(`designer_templates insert failed after ${index} rows: ${error.message}`);
    receipt.created.designerTemplates.push(...chunk.map((row) => row.id));
  }
  return templates;
}

async function buildAllTemplateFiles(preflight, uploaded, designerTemplates, resolved, pricingStructure) {
  const templateFiles = [];
  const uploadedAt = new Date().toISOString();
  for await (const { row } of readJsonl(preflight.documentArtifact.filePath)) {
    const uploadedPdf = uploaded.pdfUrls.get(row.template.sanitizedPdfSha256);
    row.template.storageObjectPath = uploadedPdf.objectPath;
    templateFiles.push(buildTemplateFile({
      document: row,
      resolved,
      pricingStructure,
      pdfUrl: uploadedPdf.url,
      designerTemplateId: designerTemplates.get(row.template.sanitizedPdfSha256) || null,
      uploadedAt,
    }));
  }
  if (templateFiles.length !== EXPECTED_COUNTS.documentBindings) throw new Error("template_files count mismatch");
  return templateFiles;
}

async function insertCatalog(client, resolved, receipt) {
  const groups = [...resolved.values()].map((entry) => entry.group);
  const values = [...resolved.values()].flatMap((entry) => entry.values);
  const { error: groupError } = await client.from("product_attribute_groups").insert(groups);
  if (groupError) throw new Error(`attribute group insert failed: ${groupError.message}`);
  receipt.created.attributeGroups.push(...groups.map((group) => group.id));
  const { error: valueError } = await client.from("product_attribute_values").insert(values);
  if (valueError) throw new Error(`attribute value insert failed: ${valueError.message}`);
  receipt.created.attributeValues.push(...values.map((value) => value.id));
}

async function insertPrices(client, preflight, productId, resolved, pricingStructure, bank, receipt) {
  let chunk = [];
  let inserted = 0;
  for await (const { row: record } of readJsonl(preflight.pricingArtifact.filePath)) {
    chunk.push(buildGenericPriceRow({ record, productId, resolved, pricingStructure, bank }));
    if (chunk.length === PRICE_CHUNK_SIZE) {
      const { error } = await client.from("generic_product_prices").insert(chunk);
      if (error) throw new Error(`price insert failed after ${inserted} rows: ${error.message}`);
      inserted += chunk.length;
      chunk = [];
    }
  }
  if (chunk.length) {
    const { error } = await client.from("generic_product_prices").insert(chunk);
    if (error) throw new Error(`price insert failed after ${inserted} rows: ${error.message}`);
    inserted += chunk.length;
  }
  if (inserted !== EXPECTED_COUNTS.priceRows) throw new Error(`inserted ${inserted} prices; expected ${EXPECTED_COUNTS.priceRows}`);
  receipt.created.genericPriceRows = inserted;
}

async function createProductDraft(client, preflight, bank, receipt) {
  await refuseTargetCollision(client);
  const uploaded = await uploadDraftAssets(client, preflight, receipt);
  const designerTemplates = await createDesignerTemplates(client, preflight, uploaded, receipt);
  const productId = randomUUID();
  const resolved = buildResolvedCatalog(preflight.groups, productId, uploaded.iconUrls);
  const pricingStructure = buildPricingStructure(
    preflight.groups,
    resolved,
    preflight.pricingSummary.quantities,
    uploaded.iconUrls,
  );
  const templateFiles = await buildAllTemplateFiles(
    preflight,
    uploaded,
    designerTemplates,
    resolved,
    pricingStructure,
  );
  const payload = buildProductPayload({
    manifest: preflight.manifest,
    productId,
    heroUrl: uploaded.heroUrl,
    pricingStructure,
    templateFiles,
    preflight,
    bank,
  });

  // A second collision check immediately before the product row is created
  // closes the race window introduced by the immutable asset uploads.
  await refuseTargetCollision(client);
  const product = await insertOne(client, "products", payload, "id,slug,is_published,is_ready", receipt, "products");
  if (product.is_published !== false) throw new Error("database did not preserve is_published=false");
  await insertCatalog(client, resolved, receipt);
  await insertPrices(client, preflight, productId, resolved, pricingStructure, bank, receipt);
  const importJob = await insertOne(client, "supplier_bank_import_jobs", {
    bank_product_id: bank.bankProductId,
    target_tenant_id: MASTER_TENANT_ID,
    target_product_id: productId,
    import_mode: "matrix_layout_v1",
    status: "imported",
    import_summary: {
      runId: preflight.manifest.runId,
      manifestSha256: preflight.manifestSha256,
      slug: TARGET_SLUG,
      unpublished: true,
      priceRows: EXPECTED_COUNTS.priceRows,
      documentBindings: EXPECTED_COUNTS.documentBindings,
      uniquePdfs: EXPECTED_COUNTS.uniquePdfs,
      onlineDesignerTemplates: EXPECTED_COUNTS.onlineDesignerPdfs,
      optionGroups: EXPECTED_COUNTS.optionGroups,
      folderModels: EXPECTED_COUNTS.folderModels,
    },
    rollback_note:
      "This writer is insert-only. Remove only the IDs and immutable object paths recorded in its receipt, in dependency order, if rollback is explicitly approved.",
  }, "id", receipt, "importJobs");
  receipt.product = { id: productId, slug: TARGET_SLUG, isPublished: false, importJobId: importJob.id };
  return receipt.product;
}

async function exactCount(client, table, column, value) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) throw new Error(`${table} readback failed: ${error.message}`);
  return Number(count || 0);
}

async function verifyDesignerTemplateReadback(client, ids) {
  let count = 0;
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data, error } = await client
      .from("designer_templates")
      .select("id,is_public,is_active,template_pdf_url")
      .in("id", chunk);
    if (error) throw new Error(`designer_templates readback failed: ${error.message}`);
    if ((data || []).length !== chunk.length) throw new Error("designer_templates readback count mismatch");
    for (const row of data || []) {
      if (row.is_active !== true || row.is_public !== false || !String(row.template_pdf_url || "").trim()) {
        throw new Error(`designer_templates readback has unsafe draft visibility for ${row.id}`);
      }
    }
    count += (data || []).length;
  }
  return count;
}

async function verifyReadback(client, receipt) {
  if (!receipt.product) return null;
  const product = await maybeSingle(
    client
      .from("products")
      .select("id,tenant_id,slug,is_published,is_available_to_tenants,is_ready,pricing_type,pricing_structure,template_files,technical_specs")
      .eq("id", receipt.product.id)
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("slug", TARGET_SLUG),
    "product readback",
  );
  if (!product || product.is_published !== false) throw new Error("unpublished product readback failed");
  const [groups, values, prices, designerTemplates, bankProduct, priceSnapshot] = await Promise.all([
    exactCount(client, "product_attribute_groups", "product_id", product.id),
    exactCount(client, "product_attribute_values", "product_id", product.id),
    exactCount(client, "generic_product_prices", "product_id", product.id),
    verifyDesignerTemplateReadback(client, receipt.created.designerTemplates),
    maybeSingle(
      client.from("supplier_bank_products").select("id,status,source_hash").eq("id", receipt.bank.bankProductId),
      "Supplier Bank product readback",
    ),
    maybeSingle(
      client.from("supplier_bank_price_snapshots").select("id,checksum").eq("id", receipt.bank.priceSnapshotId),
      "Supplier Bank price snapshot readback",
    ),
  ]);
  const templateFiles = Array.isArray(product.template_files) ? product.template_files : [];
  const onlineBindings = templateFiles.filter((template) => template?.artworkMode === "online_designer");
  const professionalBindings = templateFiles.filter(
    (template) => template?.artworkMode === "professional_pdf_upload_only",
  );
  const templateBindingModesSafe = onlineBindings.every((template) => (
    Boolean(template.designerTemplateId)
    && template.lockedInDesigner === true
    && template.nonPrintingOverlay === true
    && template.excludedFromExport === true
  )) && professionalBindings.every((template) => (
    !template.designerTemplateId
    && template.designerLoadMode === "download_only"
    && template.lockedInDesigner === false
    && template.nonPrintingOverlay === false
    && template.excludedFromExport === false
    && Boolean(String(template.artworkModeReasonDa || "").trim())
  ));
  const checks = {
    productId: product.id,
    slug: product.slug,
    isPublished: product.is_published,
    isAvailableToTenants: product.is_available_to_tenants,
    isReady: product.is_ready,
    pricingType: product.pricing_type,
    pricingMode: product.pricing_structure?.mode,
    attributeGroups: groups,
    attributeValues: values,
    priceRows: prices,
    templateFiles: templateFiles.length,
    onlineDesignerBindings: onlineBindings.length,
    professionalUploadBindings: professionalBindings.length,
    templateBindingModesSafe,
    designerTemplates,
    storageObjects: receipt.created.storageObjects.length,
    bankProductStatus: bankProduct?.status || null,
    bankSourceHash: bankProduct?.source_hash || null,
    priceSnapshotChecksum: priceSnapshot?.checksum || null,
    technicalMinDpi: product.technical_specs?.min_dpi || null,
    technicalColorMode: product.technical_specs?.color_mode || null,
  };
  if (
    checks.isPublished !== false
    || checks.isAvailableToTenants !== false
    || checks.isReady !== false
    || checks.pricingType !== "matrix"
    || checks.pricingMode !== "matrix_layout_v1"
    || groups !== EXPECTED_COUNTS.optionGroups
    || values !== receipt.expected.attributeValues
    || prices !== EXPECTED_COUNTS.priceRows
    || checks.templateFiles !== EXPECTED_COUNTS.documentBindings
    || checks.onlineDesignerBindings !== EXPECTED_COUNTS.onlineDesignerBindings
    || checks.professionalUploadBindings !== EXPECTED_COUNTS.professionalUploadBindings
    || checks.templateBindingModesSafe !== true
    || checks.designerTemplates !== EXPECTED_COUNTS.onlineDesignerPdfs
    || checks.storageObjects !== 1 + EXPECTED_COUNTS.folderModels + EXPECTED_COUNTS.uniquePdfs
    || checks.bankProductStatus !== "draft"
    || checks.bankSourceHash !== receipt.expected.pricingArtifactSha256
    || checks.priceSnapshotChecksum !== receipt.expected.pricingArtifactSha256
    || checks.technicalMinDpi !== receipt.expected.minimumDpi
    || checks.technicalColorMode !== receipt.expected.colorMode
  ) throw new Error(`post-write readback failed: ${JSON.stringify(checks)}`);
  return checks;
}

function createReceipt(preflight, args) {
  return {
    schemaVersion: 1,
    runId: preflight.manifest.runId,
    manifestPath: path.relative(REPO_ROOT, preflight.manifestPath),
    manifestSha256: preflight.manifestSha256,
    target: { tenantId: MASTER_TENANT_ID, slug: TARGET_SLUG, isPublished: false },
    approvalGates: {
      confirmBankWrite: args.confirmBankWrite,
      confirmProductDraft: args.confirmProductDraft,
      publicationApproved: false,
    },
    expected: {
      attributeValues: preflight.groups.reduce((total, group) => total + group.values.length, 0),
      pricingArtifactSha256: preflight.pricingArtifact.sha256,
      priceRows: EXPECTED_COUNTS.priceRows,
      documentBindings: EXPECTED_COUNTS.documentBindings,
      onlineDesignerBindings: EXPECTED_COUNTS.onlineDesignerBindings,
      professionalUploadBindings: EXPECTED_COUNTS.professionalUploadBindings,
      minimumDpi: preflight.documentSummary.minimumDpi,
      colorMode: preflight.documentSummary.colorMode,
    },
    startedAt: new Date().toISOString(),
    status: "running",
    bank: null,
    product: null,
    readback: null,
    created: {
      supplierRows: [],
      scrapeRuns: [],
      bankProducts: [],
      priceSnapshots: [],
      products: [],
      attributeGroups: [],
      attributeValues: [],
      designerTemplates: [],
      importJobs: [],
      genericPriceRows: 0,
      storageObjects: [],
    },
    rollback: {
      automaticRollbackPerformed: false,
      note:
        "No automatic destructive cleanup is attempted. If explicitly approved, delete only recorded new rows in dependency order and then recorded immutable storage objects.",
      dependencyOrder: [
        "supplier_bank_import_jobs",
        "generic_product_prices",
        "product_attribute_values",
        "product_attribute_groups",
        "products",
        "designer_templates",
        "supplier_bank_price_snapshots",
        "supplier_bank_products",
        "supplier_bank_scrape_runs",
        "new supplier row only if created by this receipt",
        "storage objects",
      ],
    },
  };
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const preflight = await preflightLocal(args.manifestPath);
  const summary = {
    mode: args.dryRun ? "dry_run" : args.confirmProductDraft ? "product_draft" : "bank_draft",
    target: `${MASTER_TENANT_ID}/${TARGET_SLUG}`,
    optionGroups: preflight.groups.length,
    folderModels: preflight.groups[0].values.length,
    priceRows: preflight.pricingSummary.rowCount,
    documentBindings: preflight.documentSummary.rowCount,
    uniquePdfs: preflight.documentSummary.pdfs.size,
    onlineDesignerPdfs: [...preflight.documentSummary.pdfs.values()]
      .filter((pdf) => pdf.artworkMode === "online_designer").length,
    publishProduct: false,
  };
  if (args.dryRun) return { summary, receipt: null };

  const receipt = createReceipt(preflight, args);
  writeJson(args.receiptPath, receipt);
  const client = getSupabaseClient();
  try {
    await refuseTargetCollision(client);
    const bank = await writeBankDraft(client, preflight, receipt);
    writeJson(args.receiptPath, receipt);
    if (args.confirmProductDraft) {
      await createProductDraft(client, preflight, bank, receipt);
      receipt.readback = await verifyReadback(client, receipt);
    }
    receipt.status = args.confirmProductDraft ? "product_draft_created_unpublished" : "bank_draft_created";
    receipt.completedAt = new Date().toISOString();
    writeJson(args.receiptPath, receipt);
    return { summary, receipt };
  } catch (error) {
    receipt.status = "failed_partial_write_possible";
    receipt.failedAt = new Date().toISOString();
    receipt.error = String(error?.message || error);
    writeJson(args.receiptPath, receipt);
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run()
    .then(({ summary, receipt }) => {
      console.log(JSON.stringify({ ...summary, receiptPath: receipt ? "written" : null }, null, 2));
    })
    .catch((error) => {
      console.error(`Sales-folder import stopped: ${error.message}`);
      process.exitCode = 1;
    });
}
