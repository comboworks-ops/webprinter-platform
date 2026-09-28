#!/usr/bin/env node

/**
 * Build a consolidated, local-only review package for WIRmachenDRUCK sales
 * folders. This script deliberately has no network, database, upload, product
 * mutation, price publication, or publishing path.
 */

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  WMD_SALES_FOLDER_SOURCE_ORDER,
  buildWmdSalesFolderCoverageReport,
  normalizeWmdSalesFolderRow,
  sortWmdSalesFolderRows,
} from "./shared/wmd-sales-folders.js";
import { applyConversionRule } from "./shared/conversion.js";

const SCRIPT_VERSION = 5;
const PRODUCT_SLUG = "salgsmapper-med-eget-design";
const SOURCE_HOST = "www.wir-machen-druck.de";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_ICON_MANIFEST_REPO_PATH =
  "src/assets/product-options/sales-folders/models/v1/manifest.json";
const DEFAULT_ICON_MANIFEST_PATH = path.join(REPO_ROOT, DEFAULT_ICON_MANIFEST_REPO_PATH);
const DEFAULT_ICON_PATH_PREFIX = "src/assets/product-options/sales-folders/models/v1/";
const DEFAULT_HERO_REPO_PATH =
  "src/assets/product-options/sales-folders/webprinter-sales-folder-hero-v1.png";
const DEFAULT_HERO_PATH = path.join(REPO_ROOT, DEFAULT_HERO_REPO_PATH);
const DEFAULT_HERO_SHA256 =
  "44432bcd17bf4e460a8744a37380494836fad0f8a896b7402fac2f506a2ac37d";
const PRICE_CONVERSION_RULE = "wmd_tiered_fx_7_5";
const SOURCE_ENTRY_URL =
  "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html";
const AXIS_ORDER = Object.freeze([
  "folder_model",
  "print",
  "spine",
  "paper",
  "finish",
]);
const TEMPLATE_BINDING_AXES = Object.freeze([...AXIS_ORDER]);
const PROFESSIONAL_PDF_ONLY_FINISHES = new Set([
  "partial-uv",
  "soft-touch-partial-uv",
  "hot-foil-gold",
  "hot-foil-silver",
  "blind-emboss",
]);
const PROFESSIONAL_PDF_ONLY_REASON_DA =
  "Denne efterbehandling kræver en separat staffagefarve med korrekte overprint-indstillinger. Download skabelonen og upload en færdig professionel tryk-PDF; Webprinter Designer kan ikke oprette denne maske sikkert endnu.";
const FULL_CATALOG_PROFILE = Object.freeze({
  sourceProductCount: 420,
  modelKeys: Object.freeze([
    "a4--2-part-standard",
    "a4--2-part-2-flaps",
    "a4--2-part-3-flaps",
    "a4--3-part-1-flap",
    "a4--2-part-standard-window",
    "a4--2-part-2-flaps-window",
    "a4--2-part-3-flaps-window",
    "a5--2-part-standard",
    "a5--2-part-2-flaps",
    "a5--2-part-3-flaps",
    "a5--3-part-1-flap",
    "a6--2-part-2-flaps",
    "a6--2-part-3-flaps",
    "a6--2-part-closure",
    "a6--3-part-1-flap",
    "din-lang--2-part-2-flaps",
    "din-lang--2-part-3-flaps",
    "din-lang--2-part-closure",
    "square-21x21--2-part-2-flaps",
    "square-21x21--2-part-3-flaps",
    "cd-135x135--2-part-closure",
  ]),
  printKeys: Object.freeze(["4+0", "4+4"]),
  spineDepthsMm: Object.freeze([1, 3, 5, 10]),
  paperKeys: Object.freeze([
    "chromo-mappekarton",
    "matt-billedtrykskarton",
    "hoejhvid-naturkarton",
    "hvid-genbrugskarton",
  ]),
  finishKeys: Object.freeze([
    "none",
    "high-gloss-uv",
    "partial-uv",
    "matt-lamination",
    "gloss-lamination",
    "soft-touch-lamination",
    "soft-touch-partial-uv",
    "hot-foil-gold",
    "hot-foil-silver",
    "blind-emboss",
  ]),
});
const PROPOSED_MODEL_EXCLUSIONS = Object.freeze([
  Object.freeze({
    modelKey: "cd-135x135--2-part-closure",
    reasonDa:
      "CD-mappen er fravalgt af produktejeren og skal ikke indgå i den samlede Webprinter-vare.",
    decision: "exclude_from_proposed_webprinter_product",
  }),
]);
const PROPOSED_ADD_ON_EXCLUSIONS = Object.freeze([
  Object.freeze({
    fieldKey: "41",
    supplierFieldId: "647",
    canonicalLabelOriginal: "CD-Tasche",
    reasonDa:
      "CD-lommen er fravalgt af produktejeren og må ikke blive et valgbart tilbehør eller indgå i priserne.",
    decision: "exclude_from_proposed_webprinter_product",
  }),
]);

const FINISH_LABELS_ORIGINAL = Object.freeze({
  none: "Ohne Veredelung",
  "high-gloss-uv": "Hochglanz-UV-Lack",
  "partial-uv": "Partieller UV-Lack",
  "matt-lamination": "Matte Folienkaschierung",
  "gloss-lamination": "Glänzende Folienkaschierung",
  "soft-touch-lamination": "Soft-Touch-Folienkaschierung",
  "soft-touch-partial-uv": "Soft-Touch-Folienkaschierung mit partiellem UV-Lack",
  "hot-foil-gold": "Heißfolienprägung Gold",
  "hot-foil-silver": "Heißfolienprägung Silber",
  "blind-emboss": "Blindprägung",
});

const PRINT_LABELS_ORIGINAL = Object.freeze({
  "4+0": "4/0-farbig, Außenseite bedruckt",
  "4+4": "4/4-farbig, Außen- und Innenseite bedruckt",
});

export class SalesFolderReviewError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "SalesFolderReviewError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new SalesFolderReviewError(message, details);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableSelectionSignature(selection) {
  return AXIS_ORDER.map((axis) => `${axis}=${encodeURIComponent(String(selection[axis]))}`).join("|");
}

function priceSignature(selection, quantity) {
  return `${stableSelectionSignature(selection)}|quantity=${Number(quantity)}`;
}

function sourceUrl(value, field) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new SalesFolderReviewError(`${field} is not a valid URL`);
  }
  assert(
    parsed.protocol === "https:" && parsed.hostname === SOURCE_HOST,
    `${field} must use the exact reviewed WIRmachenDRUCK HTTPS host`,
    { value: parsed.href }
  );
  return parsed.href;
}

function folderModelKey(value) {
  return `${String(value.formatKey)}--${String(value.constructionKey)}`;
}

function documentBindingIdentity(binding) {
  return canonicalJson([
    binding?.sourceUrl || null,
    binding?.productSourceOrder ?? null,
    binding?.materialId == null ? null : String(binding.materialId),
    binding?.materialSourceOrder ?? null,
    binding?.capturedAt || null,
  ]);
}

function matchesAddOnExclusion(option, exclusion) {
  return String(option?.fieldKey) === String(exclusion?.fieldKey)
    && String(option?.supplierFieldId) === String(exclusion?.supplierFieldId);
}

function countExcludedAddOnEvidence(bindings, exclusion) {
  let bindingsWithField = 0;
  let fieldOccurrences = 0;
  let choiceOccurrences = 0;
  let labelledFieldOccurrences = 0;
  let missingLabelFieldOccurrences = 0;
  for (const binding of asArray(bindings)) {
    const matchingOptions = asArray(binding?.additionalOptions).filter((option) =>
      matchesAddOnExclusion(option, exclusion)
    );
    if (matchingOptions.length > 0) bindingsWithField += 1;
    fieldOccurrences += matchingOptions.length;
    for (const option of matchingOptions) {
      choiceOccurrences += asArray(option?.choices).length;
      if (typeof option?.labelOriginal === "string" && option.labelOriginal.trim()) {
        labelledFieldOccurrences += 1;
      } else {
        missingLabelFieldOccurrences += 1;
      }
    }
  }
  return {
    bindingsWithField,
    fieldOccurrences,
    choiceOccurrences,
    labelledFieldOccurrences,
    missingLabelFieldOccurrences,
  };
}

function scopedIconManifest(iconManifest, includedModelKeys, exclusions) {
  const includedKeySet = new Set(includedModelKeys);
  const modelOrder = iconManifest.modelOrder.filter((key) => includedKeySet.has(key));
  assert(
    modelOrder.join("\n") === includedModelKeys.join("\n"),
    "Scoped icon order does not match the proposed folder-model order",
    { expected: includedModelKeys, actual: modelOrder }
  );
  const models = Object.fromEntries(modelOrder.map((key, sourceOrder) => {
    const model = iconManifest.models[key];
    assert(model, `Validated source icon manifest is missing proposed model ${key}`);
    return [key, { ...model, sourceOrder }];
  }));
  return {
    ...iconManifest,
    modelCount: modelOrder.length,
    modelOrder,
    models,
    sourceManifestScope: {
      modelCount: iconManifest.modelCount,
      modelOrder: iconManifest.modelOrder,
      excludedModels: exclusions.map((entry) => ({
        modelKey: entry.modelKey,
        reasonDa: entry.reasonDa,
        decision: entry.decision,
      })),
    },
    reviewArtifacts: {
      scopedContactSheet: null,
      sourceManifestContactSheetOmitted: true,
      reasonDa:
        "Kildemanifestets samleark er ikke en del af den foreslåede godkendelsespakke, fordi det også viser den fravalgte CD-mappe. De enkelte inkluderede SVG-filer er fortsat hash-kontrollerede.",
    },
  };
}

function exactSparseCombinationCount(rows) {
  return new Set(asArray(rows).map((row) => stableSelectionSignature(
    proposedSelectionFromPricingRow(row)
  ))).size;
}

/**
 * Project the reviewed full supplier extraction into the explicitly selected
 * Webprinter product scope. Raw extraction artifacts are never rewritten.
 */
export function applyProposedCatalogScope({
  pricingRows,
  documentBindings,
  additionalOptionBindings,
  catalog,
  iconManifest,
  exclusions = PROPOSED_MODEL_EXCLUSIONS,
  requiredSourceModelKeys = [],
}) {
  const exclusionByKey = new Map(asArray(exclusions).map((entry) => [entry.modelKey, entry]));
  assert(exclusionByKey.size === asArray(exclusions).length, "Proposed model exclusions contain duplicate keys");
  for (const entry of exclusionByKey.values()) {
    assert(entry?.modelKey && entry?.reasonDa && entry?.decision, "Proposed model exclusion is incomplete");
  }

  const rawModelKeys = uniqueInOrder(pricingRows, (row) => folderModelKey(row))
    .map((row) => folderModelKey(row));
  for (const key of asArray(requiredSourceModelKeys)) {
    if (exclusionByKey.has(key)) {
      assert(rawModelKeys.includes(key), `Required excluded source model is missing: ${key}`);
    }
  }

  const includeModel = (value) => !exclusionByKey.has(folderModelKey(value));
  const scopedPricingRows = asArray(pricingRows).filter(includeModel);
  const scopedDocumentBindings = asArray(documentBindings).filter((binding) =>
    includeModel(binding?.classification || {})
  );
  const scopedCatalog = asArray(catalog).filter((item) =>
    includeModel(item?.classification || {})
  );
  const includedBindingIdentities = new Set(scopedDocumentBindings.map(documentBindingIdentity));
  const scopedAdditionalOptionBindings = asArray(additionalOptionBindings).filter((binding) =>
    includedBindingIdentities.has(documentBindingIdentity(binding))
  );
  assert(
    scopedAdditionalOptionBindings.length === scopedDocumentBindings.length,
    "Scoped add-on inventory no longer maps one-to-one to scoped document bindings",
    {
      documentBindings: scopedDocumentBindings.length,
      additionalOptionBindings: scopedAdditionalOptionBindings.length,
    }
  );

  const includedRawModelKeys = rawModelKeys.filter((key) => !exclusionByKey.has(key));
  const includedRawModelKeySet = new Set(includedRawModelKeys);
  const includedModelKeys = iconManifest.modelOrder.filter((key) => includedRawModelKeySet.has(key));
  assert(
    includedModelKeys.length === includedRawModelKeys.length
      && includedModelKeys.every((key) => includedRawModelKeySet.has(key)),
    "Validated icon manifest and scoped supplier models no longer contain the same keys"
  );
  assert(includedModelKeys.length > 0, "Proposed catalog scope removed every folder model");
  const proposedIconManifest = scopedIconManifest(iconManifest, includedModelKeys, exclusions);
  const excludedSourceProducts = asArray(catalog).length - scopedCatalog.length;
  const excludedPriceRows = asArray(pricingRows).length - scopedPricingRows.length;
  const excludedDocumentBindings = asArray(documentBindings).length - scopedDocumentBindings.length;
  const excludedAdditionalOptionBindings = asArray(additionalOptionBindings).length
    - scopedAdditionalOptionBindings.length;
  const rawSparseCombinations = exactSparseCombinationCount(pricingRows);
  const includedSparseCombinations = exactSparseCombinationCount(scopedPricingRows);
  const exclusionEvidence = asArray(exclusions).map((entry) => {
    const key = entry.modelKey;
    const hasModel = (value) => folderModelKey(value) === key;
    const excludedDocumentIdentitySet = new Set(
      asArray(documentBindings)
        .filter((binding) => hasModel(binding?.classification || {}))
        .map(documentBindingIdentity)
    );
    return {
      modelKey: key,
      reasonDa: entry.reasonDa,
      decision: entry.decision,
      sourceEvidencePreserved: true,
      excludedCounts: {
        sourceProducts: asArray(catalog).filter((item) => hasModel(item?.classification || {})).length,
        priceRows: asArray(pricingRows).filter(hasModel).length,
        exactSparseCombinations: new Set(
          asArray(pricingRows)
            .filter(hasModel)
            .map((row) => stableSelectionSignature(proposedSelectionFromPricingRow(row)))
        ).size,
        documentBindings: excludedDocumentIdentitySet.size,
        additionalOptionBindings: asArray(additionalOptionBindings).filter((binding) =>
          excludedDocumentIdentitySet.has(documentBindingIdentity(binding))
        ).length,
        folderModelIcons: iconManifest.modelOrder.includes(key) ? 1 : 0,
      },
    };
  });
  const excludedAddOns = PROPOSED_ADD_ON_EXCLUSIONS.map((entry) => ({
    supplierFieldIdentity: {
      fieldKey: entry.fieldKey,
      supplierFieldId: entry.supplierFieldId,
    },
    canonicalLabelOriginal: entry.canonicalLabelOriginal,
    reasonDa: entry.reasonDa,
    decision: entry.decision,
    sourceArtifact: "raw/additional-option-bindings.jsonl",
    sourceEvidencePreserved: true,
    projectedToSelectableProductOption: false,
    includedInPricing: false,
    evidenceCounts: {
      raw: countExcludedAddOnEvidence(additionalOptionBindings, entry),
      afterFolderModelScope: countExcludedAddOnEvidence(scopedAdditionalOptionBindings, entry),
    },
  }));
  const scope = {
    schemaVersion: 1,
    state: "explicit_product_scope_projection",
    rawSupplierEvidenceMutated: false,
    policy: "exclude_only_explicitly_listed_models_and_add_ons_from_the_proposed_product",
    excludedModels: exclusionEvidence,
    excludedAddOns,
    counts: {
      raw: {
        sourceProducts: asArray(catalog).length,
        folderModels: rawModelKeys.length,
        priceRows: asArray(pricingRows).length,
        exactSparseCombinations: rawSparseCombinations,
        documentBindings: asArray(documentBindings).length,
        additionalOptionBindings: asArray(additionalOptionBindings).length,
        folderModelIcons: iconManifest.modelCount,
      },
      proposed: {
        sourceProducts: scopedCatalog.length,
        folderModels: includedModelKeys.length,
        priceRows: scopedPricingRows.length,
        exactSparseCombinations: includedSparseCombinations,
        documentBindings: scopedDocumentBindings.length,
        additionalOptionBindings: scopedAdditionalOptionBindings.length,
        folderModelIcons: proposedIconManifest.modelCount,
      },
      excluded: {
        sourceProducts: excludedSourceProducts,
        folderModels: rawModelKeys.length - includedModelKeys.length,
        priceRows: excludedPriceRows,
        exactSparseCombinations: rawSparseCombinations - includedSparseCombinations,
        documentBindings: excludedDocumentBindings,
        additionalOptionBindings: excludedAdditionalOptionBindings,
        folderModelIcons: iconManifest.modelCount - proposedIconManifest.modelCount,
      },
    },
  };
  const expectedExcluded = exclusionEvidence.reduce((total, entry) => total + entry.excludedCounts.priceRows, 0);
  assert(expectedExcluded === scope.counts.excluded.priceRows, "Excluded model evidence does not reconcile with scoped price rows");

  return {
    scope,
    pricingRows: scopedPricingRows,
    documentBindings: scopedDocumentBindings,
    additionalOptionBindings: scopedAdditionalOptionBindings,
    catalog: scopedCatalog,
    iconManifest: proposedIconManifest,
  };
}

function proposedSelectionFromPricingRow(row) {
  return {
    folder_model: folderModelKey(row),
    print: String(row.printMode),
    spine: `${Number(row.spineDepthMm)}mm`,
    paper: String(row.paperKey),
    finish: String(row.finishKey),
  };
}

function proposedSelectionFromDocumentBinding(binding) {
  const classification = binding?.classification || {};
  const material = binding?.materialFacts || {};
  return {
    folder_model: folderModelKey(classification),
    print: String(classification.printMode),
    spine: `${Number(material.spineDepthMm)}mm`,
    paper: String(material.paperKey),
    finish: String(classification.finishKey),
  };
}

function proposedSelectionFromOptionCombination(combination) {
  const selection = combination?.selection || {};
  return {
    folder_model: `${String(selection.formatKey)}--${String(selection.constructionKey)}`,
    print: String(selection.printMode),
    spine: `${Number(selection.spineDepthMm)}mm`,
    paper: String(selection.paperKey),
    finish: String(selection.finishKey),
  };
}

function compareIndex(order, left, right) {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
    - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
}

function compareProposedSelections(left, right) {
  const leftModel = String(left.folder_model).split("--");
  const rightModel = String(right.folder_model).split("--");
  return (
    compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.format, leftModel[0], rightModel[0])
    || compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.construction, leftModel.slice(1).join("--"), rightModel.slice(1).join("--"))
    || compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.print, left.print, right.print)
    || compareIndex(
      WMD_SALES_FOLDER_SOURCE_ORDER.spineDepthMm,
      Number(String(left.spine).replace("mm", "")),
      Number(String(right.spine).replace("mm", ""))
    )
    || compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.paper, left.paper, right.paper)
    || compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.finish, left.finish, right.finish)
  );
}

function fingerprintForBytes(relativePath, bytes) {
  return {
    path: relativePath,
    sha256: sha256Buffer(bytes),
    byteSize: bytes.length,
  };
}

async function readJson(filePath, relativePath) {
  try {
    const bytes = await fs.readFile(filePath);
    return {
      value: JSON.parse(bytes.toString("utf8")),
      fingerprint: fingerprintForBytes(relativePath, bytes),
    };
  } catch (error) {
    throw new SalesFolderReviewError(`Unable to read JSON ${filePath}: ${error.message}`);
  }
}

async function readJsonl(filePath, relativePath, projector = (value) => value) {
  const rows = [];
  const hash = createHash("sha256");
  let byteSize = 0;
  const input = createReadStream(filePath);
  input.on("data", (chunk) => {
    byteSize += chunk.length;
    hash.update(chunk);
  });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let index = 0;
  try {
    for await (const rawLine of lines) {
      index += 1;
      const line = rawLine.trim();
      if (!line) continue;
      try {
        rows.push(projector(JSON.parse(line), rows.length));
      } catch (error) {
        throw new SalesFolderReviewError(`${filePath}:${index} is invalid or unsupported JSON: ${error.message}`);
      }
    }
  } catch (error) {
    if (error instanceof SalesFolderReviewError) throw error;
    throw new SalesFolderReviewError(`Unable to read JSONL ${filePath}: ${error.message}`);
  } finally {
    lines.close();
    input.destroy();
  }
  return {
    value: rows,
    fingerprint: {
      path: relativePath,
      sha256: hash.digest("hex"),
      byteSize,
    },
  };
}

async function readJsonlReduce(filePath, relativePath, initialValue, reducer) {
  const hash = createHash("sha256");
  let byteSize = 0;
  const input = createReadStream(filePath);
  input.on("data", (chunk) => {
    byteSize += chunk.length;
    hash.update(chunk);
  });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  let rowIndex = 0;
  let value = initialValue;
  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();
      if (!line) continue;
      try {
        value = reducer(value, JSON.parse(line), rowIndex);
        rowIndex += 1;
      } catch (error) {
        throw new SalesFolderReviewError(`${filePath}:${lineNumber} is invalid or unsupported JSON: ${error.message}`);
      }
    }
  } catch (error) {
    if (error instanceof SalesFolderReviewError) throw error;
    throw new SalesFolderReviewError(`Unable to read JSONL ${filePath}: ${error.message}`);
  } finally {
    lines.close();
    input.destroy();
  }
  return {
    value,
    fingerprint: {
      path: relativePath,
      sha256: hash.digest("hex"),
      byteSize,
    },
  };
}

async function writeAtomic(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, contents);
  await fs.rename(temporaryPath, filePath);
}

async function writeJson(filePath, value) {
  await writeAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonl(filePath, rows) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const handle = await fs.open(temporaryPath, "w");
  try {
    let batch = "";
    for (const row of rows) {
      batch += `${JSON.stringify(row)}\n`;
      if (batch.length >= 1024 * 1024) {
        await handle.write(batch);
        batch = "";
      }
    }
    if (batch) await handle.write(batch);
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
  await handle.close();
  await fs.rename(temporaryPath, filePath);
}

async function artifactFingerprint(runDirectory, relativePath) {
  const absolutePath = path.join(runDirectory, relativePath);
  const hash = createHash("sha256");
  let byteSize = 0;
  const input = createReadStream(absolutePath);
  for await (const chunk of input) {
    byteSize += chunk.length;
    hash.update(chunk);
  }
  return {
    path: relativePath,
    sha256: hash.digest("hex"),
    byteSize,
  };
}

async function artifactFingerprints(runDirectory, relativePaths) {
  const fingerprints = [];
  for (const relativePath of relativePaths) {
    fingerprints.push(await artifactFingerprint(runDirectory, relativePath));
  }
  return fingerprints;
}

export function assertFingerprintsUnchanged(before, after, context = "Extraction artifacts") {
  const expected = asArray(before);
  const actual = asArray(after);
  assert(expected.length === actual.length, `${context} changed while the review package was built`, {
    before: expected,
    after: actual,
  });
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = actual[index];
    assert(
      left?.path === right?.path
        && left?.sha256 === right?.sha256
        && left?.byteSize === right?.byteSize,
      `${context} changed while the review package was built`,
      { before: left, after: right }
    );
  }
}

async function assertExtractorIdle(runDirectory, stage) {
  const lockPath = path.join(runDirectory, ".extractor.lock");
  try {
    await fs.lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw new SalesFolderReviewError(`Unable to inspect extractor lock during ${stage}: ${error.message}`);
  }
  throw new SalesFolderReviewError(
    `Refusing to build while the sales-folder extractor is active during ${stage}: ${lockPath}`
  );
}

async function assertSharedRunLockOwned(lockPath, token, stage) {
  let lock;
  try {
    lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
  } catch (error) {
    throw new SalesFolderReviewError(`Shared run lock was lost during ${stage}: ${error.message}`);
  }
  assert(
    lock?.role === "consolidated_review_builder" && lock?.token === token,
    `Shared run lock ownership changed during ${stage}`
  );
}

async function releaseOwnedSharedRunLock(lockHandle, lockPath, token) {
  await lockHandle?.close().catch(() => {});
  let lock;
  try {
    lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    return;
  }
  if (lock?.role === "consolidated_review_builder" && lock?.token === token) {
    await fs.unlink(lockPath).catch(() => {});
  }
}

function pathWithin(rootDirectory, candidatePath) {
  const relative = path.relative(rootDirectory, candidatePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function svgAttribute(svgTag, attribute) {
  const match = svgTag.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function validateCommonSvgSafety(svgText, assetLabel) {
  assert(/^\s*<svg\b/i.test(svgText), `${assetLabel} must start with an SVG root`);
  assert((svgText.match(/<svg\b/gi) || []).length === 1, `${assetLabel} must contain exactly one SVG root`);
  assert(
    !/<(?:script|image|foreignObject|iframe|object|embed|audio|video|canvas|style|link|a|use|animate|set)\b/i.test(svgText),
    `${assetLabel} contains an unsafe or externally referenceable SVG element`
  );
  assert(!/<!(?:DOCTYPE|ENTITY)\b/i.test(svgText), `${assetLabel} contains forbidden XML declarations`);
  assert(!/\s(?:href|xlink:href)\s*=/i.test(svgText), `${assetLabel} contains a forbidden external reference`);
  assert(!/\sstyle\s*=|url\s*\(|@import/i.test(svgText), `${assetLabel} contains forbidden CSS or URL references`);
  assert(!/\son[a-z][a-z0-9:_-]*\s*=/i.test(svgText), `${assetLabel} contains an event handler`);
  assert(
    !/wir[\s._-]*machen[\s._-]*druck|manns[\s._-]*partner|\b(?:supplier|webprinter|logo|wmd)\b/i.test(svgText),
    `${assetLabel} contains supplier or brand text`
  );
}

function validateSvgPalette(svgText, allowedColors, assetLabel) {
  const normalizedAllowed = new Set(allowedColors.map((color) => String(color).toUpperCase()));
  const colors = [...svgText.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0].toUpperCase());
  assert(colors.length > 0, `${assetLabel} contains no verifiable palette colors`);
  assert(
    colors.every((color) => normalizedAllowed.has(color)),
    `${assetLabel} contains a color outside the approved palette`,
    { colors: [...new Set(colors)], allowedColors: [...normalizedAllowed] }
  );
  for (const match of svgText.matchAll(/\b(?:fill|stroke|color)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1].trim().toUpperCase();
    assert(value === "NONE" || normalizedAllowed.has(value), `${assetLabel} contains an unsupported paint value`, {
      value: match[1],
    });
  }
}

function validateModelSvgContent(svgText, key, palette) {
  const assetLabel = `Icon SVG for ${key}`;
  validateCommonSvgSafety(svgText, assetLabel);
  assert(!/<(?:text|title|desc|metadata)\b|\baria-label(?:ledby)?\s*=/i.test(svgText), `${assetLabel} must remain label-free`);
  const tags = [...svgText.matchAll(/<\s*\/?\s*([a-z][a-z0-9:-]*)\b/gi)]
    .map((match) => match[1].toLowerCase());
  const allowedTags = new Set(["svg", "path", "rect", "circle"]);
  assert(tags.every((tag) => allowedTags.has(tag)), `${assetLabel} contains an unsupported SVG element`, {
    tags: [...new Set(tags)],
  });
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0];
  assert(svgAttribute(svgTag, "aria-hidden") === "true", `${assetLabel} must be aria-hidden`);
  assert(svgAttribute(svgTag, "focusable") === "false", `${assetLabel} must not be focusable`);
  assert(svgAttribute(svgTag, "fill") === "none", `${assetLabel} must keep a transparent root`);
  validateSvgPalette(svgText, [palette.primary, palette.neutral], assetLabel);

  const canvasWidth = Number(svgAttribute(svgTag, "width"));
  const canvasHeight = Number(svgAttribute(svgTag, "height"));
  for (const rectTag of svgText.match(/<rect\b[^>]*>/gi) || []) {
    const x = Number(svgAttribute(rectTag, "x") ?? 0);
    const y = Number(svgAttribute(rectTag, "y") ?? 0);
    const width = Number(svgAttribute(rectTag, "width"));
    const height = Number(svgAttribute(rectTag, "height"));
    const fill = String(svgAttribute(rectTag, "fill") || "none").toLowerCase();
    assert(
      !(x === 0 && y === 0 && width === canvasWidth && height === canvasHeight && fill !== "none"),
      `${assetLabel} contains a non-transparent full-canvas background`
    );
  }
}

function validateReviewContactSheetContent(svgText, expectedModels, palette) {
  const assetLabel = "Icon review contact sheet";
  validateCommonSvgSafety(svgText, assetLabel);
  const tags = [...svgText.matchAll(/<\s*\/?\s*([a-z][a-z0-9:-]*)\b/gi)]
    .map((match) => match[1].toLowerCase());
  const allowedTags = new Set(["svg", "title", "desc", "rect", "text", "g", "tspan", "path", "circle"]);
  assert(tags.every((tag) => allowedTags.has(tag)), `${assetLabel} contains an unsupported SVG element`, {
    tags: [...new Set(tags)],
  });
  validateSvgPalette(
    svgText,
    [palette.primary, palette.neutral, "#FFFFFF", "#0F172A", "#E2E8F0"],
    assetLabel
  );
  assert(/<rect\b[^>]*width=["']1216["'][^>]*height=["']1544["'][^>]*fill=["']#FFFFFF["']/i.test(svgText), `${assetLabel} must retain its white review-only background`);
  const modelKeyMatches = [...svgText.matchAll(/\bdata-model-key\s*=\s*["']([^"']+)["']/gi)];
  const contactSheetKeys = modelKeyMatches.map((match) => match[1]);
  const expectedKeys = expectedModels.map((model) => model.key);
  assert(contactSheetKeys.join("\n") === expectedKeys.join("\n"), `${assetLabel} models are missing, extra, or reordered`, {
    expected: expectedKeys,
    actual: contactSheetKeys,
  });
  for (const [index, model] of expectedModels.entries()) {
    const start = modelKeyMatches[index].index;
    const end = modelKeyMatches[index + 1]?.index ?? svgText.length;
    const visibleText = svgText
      .slice(start, end)
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    const expectedLabel = String(model.labelDa).replace(/\s+/g, " ").trim();
    assert(visibleText.includes(expectedLabel), `${assetLabel} is missing the Danish label for ${model.key}`);
  }
}

export async function loadAndValidateHeroAsset({
  assetPath = DEFAULT_HERO_PATH,
  assetRootDirectory = REPO_ROOT,
  requiredRepoAssetPath = DEFAULT_HERO_REPO_PATH,
  expectedSha256 = DEFAULT_HERO_SHA256,
  expectedWidthPx = 1536,
  expectedHeightPx = 1024,
} = {}) {
  const resolvedAssetPath = path.resolve(assetPath);
  const resolvedAssetRoot = path.resolve(assetRootDirectory);
  assert(pathWithin(resolvedAssetRoot, resolvedAssetPath), "Product hero must remain inside the reviewed asset root");
  const repoAssetPath = path.relative(resolvedAssetRoot, resolvedAssetPath).split(path.sep).join("/");
  assert(repoAssetPath === requiredRepoAssetPath, "Product hero path is inconsistent with the reviewed versioned asset");
  const fileStat = await fs.lstat(resolvedAssetPath);
  assert(fileStat.isFile() && !fileStat.isSymbolicLink(), "Product hero is not a regular file");
  const bytes = await fs.readFile(resolvedAssetPath);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(pngSignature), "Product hero does not have a valid PNG signature");
  assert(bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR", "Product hero has no canonical PNG IHDR chunk");
  const widthPx = bytes.readUInt32BE(16);
  const heightPx = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compressionMethod = bytes[26];
  const filterMethod = bytes[27];
  const interlaceMethod = bytes[28];
  assert(widthPx === expectedWidthPx && heightPx === expectedHeightPx, "Product hero dimensions are inconsistent", {
    expected: { widthPx: expectedWidthPx, heightPx: expectedHeightPx },
    actual: { widthPx, heightPx },
  });
  assert(bitDepth === 8 && colorType === 6, "Product hero must be an 8-bit RGBA PNG with an alpha channel");
  assert(compressionMethod === 0 && filterMethod === 0 && interlaceMethod === 0, "Product hero uses unsupported PNG encoding metadata");

  let offset = 8;
  let foundIend = false;
  while (offset < bytes.length) {
    assert(offset + 12 <= bytes.length, "Product hero contains a truncated PNG chunk");
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    const nextOffset = offset + 12 + chunkLength;
    assert(/^[A-Za-z]{4}$/.test(chunkType) && nextOffset <= bytes.length, "Product hero contains an invalid PNG chunk");
    if (chunkType === "IEND") {
      assert(chunkLength === 0 && nextOffset === bytes.length, "Product hero has invalid data after its PNG IEND chunk");
      foundIend = true;
    }
    offset = nextOffset;
  }
  assert(foundIend, "Product hero has no PNG IEND chunk");
  const sha256 = sha256Buffer(bytes);
  assert(/^[a-f0-9]{64}$/.test(String(expectedSha256 || "")) && sha256 === expectedSha256, "Product hero SHA-256 does not match the reviewed asset");
  return {
    repoAssetPath,
    sha256,
    byteSize: bytes.length,
    mimeType: "image/png",
    widthPx,
    heightPx,
    bitDepth,
    colorModel: "RGBA",
    hasAlpha: true,
    interlaced: false,
    state: "local_review_only_verified",
    published: false,
  };
}

export async function loadAndValidateIconManifest({
  manifestPath = DEFAULT_ICON_MANIFEST_PATH,
  assetRootDirectory = REPO_ROOT,
  requiredPathPrefix = DEFAULT_ICON_PATH_PREFIX,
  expectedModels,
}) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const resolvedAssetRoot = path.resolve(assetRootDirectory);
  assert(pathWithin(resolvedAssetRoot, resolvedManifestPath), "Icon manifest must remain inside the reviewed asset root");
  const manifestBytes = await fs.readFile(resolvedManifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    throw new SalesFolderReviewError(`Icon manifest is invalid JSON: ${error.message}`);
  }

  assert(manifest?.schemaVersion === 1, "Icon manifest schemaVersion must be 1");
  assert(manifest?.assetVersion === "v1", "Icon manifest assetVersion must be v1");
  assert(manifest?.optionAxis === "folder_model", "Icon manifest optionAxis must be folder_model");
  assert(manifest?.modelKeyConvention === "<formatKey>--<constructionKey>", "Icon manifest model-key convention is unsupported");
  assert(manifest?.palette?.primary === "#0EA5E9", "Icon manifest must use Webprinter blue #0EA5E9");
  assert(manifest?.palette?.neutral === "#64748B", "Icon manifest must use the reviewed neutral grey #64748B");
  assert(manifest?.palette?.background === "transparent", "Icon manifest background must be transparent");
  assert(manifest?.backendProjection?.displayType === "icon_grid", "Icon manifest backend display type must be icon_grid");
  assert(manifest?.backendProjection?.imageField === "valueSettings[valueId].customImage", "Icon manifest backend image field is inconsistent");
  assert(manifest?.backendProjection?.orderField === "section.valueIds", "Icon manifest backend order field is inconsistent");
  assert(Number.isInteger(manifest?.backendProjection?.recommendedSizePx) && manifest.backendProjection.recommendedSizePx >= 44, "Icon manifest recommended size is invalid");
  assert(manifest?.backendProjection?.savedBackendImageTakesPrecedence === true, "Saved backend icon must take precedence");
  assert(manifest?.provenance?.supplierAssetsCopied === false, "Supplier assets must not be copied into the proposed icons");
  assert(manifest?.provenance?.supplierBrandingIncluded === false, "Supplier branding must not be present in the proposed icons");

  const expected = asArray(expectedModels);
  assert(expected.length > 0, "No expected folder models were supplied for icon validation");
  const expectedKeys = expected.map((model) => model.key);
  assert(new Set(expectedKeys).size === expectedKeys.length, "Expected folder models contain duplicate keys");
  const manifestKeys = Object.keys(manifest?.models || {});
  assert(manifest?.modelCount === manifestKeys.length, "Icon manifest modelCount does not match its models object");
  assert(manifestKeys.length === expectedKeys.length, "Icon manifest model count does not match extracted folder models", {
    expected: expectedKeys.length,
    actual: manifestKeys.length,
  });
  assert(manifestKeys.join("\n") === expectedKeys.join("\n"), "Icon manifest models are missing, extra, or reordered", {
    expected: expectedKeys,
    actual: manifestKeys,
  });

  const normalizedModels = {};
  const expectedFileNames = [];
  for (const [index, expectedModel] of expected.entries()) {
    const key = expectedModel.key;
    const model = manifest.models[key];
    assert(model?.modelKey === key && model?.folderModelKey === key, `Icon manifest identity is inconsistent for ${key}`);
    assert(model?.sourceOrder === index, `Icon manifest sourceOrder is inconsistent for ${key}`);
    assert(model?.formatKey === expectedModel.formatKey, `Icon manifest formatKey is inconsistent for ${key}`);
    assert(model?.constructionKey === expectedModel.constructionKey, `Icon manifest constructionKey is inconsistent for ${key}`);
    assert(model?.labelDa === expectedModel.labelDa, `Icon manifest Danish label is inconsistent for ${key}`);
    assert(typeof model?.accessibleNameDa === "string" && model.accessibleNameDa.trim(), `Icon manifest accessible name is missing for ${key}`);
    assert(Number(model?.formatDimensionsMm?.width) === Number(expectedModel.widthMm), `Icon manifest width is inconsistent for ${key}`);
    assert(Number(model?.formatDimensionsMm?.height) === Number(expectedModel.heightMm), `Icon manifest height is inconsistent for ${key}`);

    const repoAssetPath = String(model?.svg?.path || "");
    assert(repoAssetPath && !path.isAbsolute(repoAssetPath) && !repoAssetPath.split(/[\\/]+/).includes(".."), `Icon path is unsafe for ${key}`);
    if (requiredPathPrefix) {
      assert(repoAssetPath === `${requiredPathPrefix}${key}.svg`, `Icon path is inconsistent for ${key}`);
    }
    const absoluteSvgPath = path.resolve(resolvedAssetRoot, repoAssetPath);
    assert(pathWithin(resolvedAssetRoot, absoluteSvgPath), `Icon path escapes the asset root for ${key}`);
    assert(path.dirname(absoluteSvgPath) === path.dirname(resolvedManifestPath), `Icon file is not colocated with the manifest for ${key}`);
    const fileStat = await fs.lstat(absoluteSvgPath);
    assert(fileStat.isFile() && !fileStat.isSymbolicLink(), `Icon asset is not a regular file for ${key}`);
    const svgBytes = await fs.readFile(absoluteSvgPath);
    const actualSha256 = sha256Buffer(svgBytes);
    assert(/^[a-f0-9]{64}$/.test(String(model?.svg?.sha256 || "")), `Icon SHA-256 metadata is invalid for ${key}`);
    assert(actualSha256 === model.svg.sha256, `Icon SHA-256 does not match the file for ${key}`);
    const svgText = svgBytes.toString("utf8");
    const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0];
    assert(svgTag, `Icon file has no SVG root for ${key}`);
    validateModelSvgContent(svgText, key, manifest.palette);
    assert(Number(svgAttribute(svgTag, "width")) === Number(model?.svg?.widthPx), `Icon SVG width metadata is inconsistent for ${key}`);
    assert(Number(svgAttribute(svgTag, "height")) === Number(model?.svg?.heightPx), `Icon SVG height metadata is inconsistent for ${key}`);
    assert(svgAttribute(svgTag, "viewBox") === model?.svg?.viewBox, `Icon SVG viewBox metadata is inconsistent for ${key}`);
    assert(Number(model?.svg?.widthPx) > 0 && Number(model?.svg?.heightPx) > 0, `Icon pixel dimensions are invalid for ${key}`);
    expectedFileNames.push(path.basename(repoAssetPath));

    normalizedModels[key] = {
      modelKey: key,
      sourceOrder: index,
      labelDa: model.labelDa,
      accessibleNameDa: model.accessibleNameDa,
      formatKey: model.formatKey,
      constructionKey: model.constructionKey,
      formatDimensionsMm: model.formatDimensionsMm,
      svg: {
        repoAssetPath,
        sha256: actualSha256,
        byteSize: svgBytes.length,
        widthPx: Number(model.svg.widthPx),
        heightPx: Number(model.svg.heightPx),
        viewBox: model.svg.viewBox,
        mimeType: "image/svg+xml",
      },
    };
  }

  const reviewContactSheet = manifest?.reviewArtifacts?.contactSheet || null;
  let normalizedReviewArtifacts = null;
  assert(reviewContactSheet, "Icon manifest must declare its review-only contact sheet");
  if (reviewContactSheet) {
    assert(reviewContactSheet.purpose === "review_only", "Icon contact sheet must be review-only");
    assert(reviewContactSheet.storefrontAsset === false, "Icon contact sheet must not be a storefront asset");
    assert(reviewContactSheet.backendOptionAsset === false, "Icon contact sheet must not be a backend option asset");
    assert(reviewContactSheet.background === "white", "Icon contact sheet must declare its white review background");
    assert(reviewContactSheet.labels === "Danish labels outside each embedded icon", "Icon contact-sheet label metadata is inconsistent");
    const contactSheetRepoPath = String(reviewContactSheet.path || "");
    assert(contactSheetRepoPath && !path.isAbsolute(contactSheetRepoPath) && !contactSheetRepoPath.split(/[\\/]+/).includes(".."), "Icon contact-sheet path is unsafe");
    const absoluteContactSheetPath = path.resolve(resolvedAssetRoot, contactSheetRepoPath);
    assert(pathWithin(resolvedAssetRoot, absoluteContactSheetPath), "Icon contact-sheet path escapes the asset root");
    assert(path.dirname(absoluteContactSheetPath) === path.dirname(resolvedManifestPath), "Icon contact sheet is not colocated with its manifest");
    const contactSheetStat = await fs.lstat(absoluteContactSheetPath);
    assert(contactSheetStat.isFile() && !contactSheetStat.isSymbolicLink(), "Icon contact sheet is not a regular file");
    const contactSheetBytes = await fs.readFile(absoluteContactSheetPath);
    const contactSheetSha256 = sha256Buffer(contactSheetBytes);
    assert(/^[a-f0-9]{64}$/.test(String(reviewContactSheet.sha256 || "")), "Icon contact-sheet SHA-256 metadata is invalid");
    assert(contactSheetSha256 === reviewContactSheet.sha256, "Icon contact-sheet SHA-256 does not match the file");
    const contactSheetText = contactSheetBytes.toString("utf8");
    const contactSheetTag = contactSheetText.match(/<svg\b[^>]*>/i)?.[0];
    assert(contactSheetTag, "Icon contact sheet has no SVG root");
    validateReviewContactSheetContent(contactSheetText, expected, manifest.palette);
    assert(Number(svgAttribute(contactSheetTag, "width")) === Number(reviewContactSheet.widthPx), "Icon contact-sheet width metadata is inconsistent");
    assert(Number(svgAttribute(contactSheetTag, "height")) === Number(reviewContactSheet.heightPx), "Icon contact-sheet height metadata is inconsistent");
    expectedFileNames.push(path.basename(contactSheetRepoPath));
    normalizedReviewArtifacts = {
      contactSheet: {
        purpose: reviewContactSheet.purpose,
        storefrontAsset: false,
        backendOptionAsset: false,
        repoAssetPath: contactSheetRepoPath,
        sha256: contactSheetSha256,
        byteSize: contactSheetBytes.length,
        widthPx: Number(reviewContactSheet.widthPx),
        heightPx: Number(reviewContactSheet.heightPx),
      },
      rasterDerivative: manifest.reviewArtifacts.rasterDerivative || null,
    };
  }

  const actualSvgFileNames = (await fs.readdir(path.dirname(resolvedManifestPath)))
    .filter((name) => name.toLowerCase().endsWith(".svg"))
    .sort();
  assert(actualSvgFileNames.join("\n") === [...expectedFileNames].sort().join("\n"), "Icon directory contains missing or extra SVG files", {
    expected: [...expectedFileNames].sort(),
    actual: actualSvgFileNames,
  });

  return {
    schemaVersion: manifest.schemaVersion,
    assetVersion: manifest.assetVersion,
    optionAxis: manifest.optionAxis,
    manifestRepoPath: path.relative(resolvedAssetRoot, resolvedManifestPath).split(path.sep).join("/"),
    manifestSha256: sha256Buffer(manifestBytes),
    manifestByteSize: manifestBytes.length,
    modelCount: manifestKeys.length,
    modelOrder: manifestKeys,
    palette: manifest.palette,
    backendProjection: manifest.backendProjection,
    provenance: manifest.provenance,
    reviewArtifacts: normalizedReviewArtifacts,
    models: normalizedModels,
  };
}

function compactPricingRow(row) {
  return {
    sourceOrder: row.sourceOrder,
    formatKey: row.formatKey,
    formatLabelDa: row.formatLabelDa,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    constructionKey: row.constructionKey,
    constructionLabelDa: row.constructionLabelDa,
    windowPunch: row.windowPunch,
    closure: row.closure,
    printMode: row.printMode,
    finishKey: row.finishKey,
    paperKey: row.paperKey,
    spineDepthMm: row.spineDepthMm,
    quantity: row.quantity,
    supplierPrice: row.supplierPrice,
    currency: row.currency,
    convertedPriceDkk: row.convertedPriceDkk,
    finalPriceDkk: row.finalPriceDkk,
    ruleKey: row.ruleKey,
    conversionRule: row.conversionRule,
    factor: row.factor,
    tierMultiplier: row.tierMultiplier,
    classified: row.classified,
    unclassifiedDimensions: row.unclassifiedDimensions,
    priceEvidenceMismatch: row.priceEvidenceMismatch,
    selectionKey: row.selectionKey,
    source: row.source,
  };
}

function compactDocumentBinding(binding) {
  return {
    sourceUrl: binding.sourceUrl,
    productSourceOrder: binding.productSourceOrder,
    sourceProductId: binding.sourceProductId,
    sourceSku: binding.sourceSku,
    materialId: binding.materialId,
    materialSourceOrder: binding.materialSourceOrder,
    materialLabel: binding.materialLabel,
    classification: binding.classification,
    materialFacts: binding.materialFacts,
    documents: binding.documents,
    additionalOptions: binding.additionalOptions,
    additionalOptionCoverage: binding.additionalOptionCoverage,
    capturedAt: binding.capturedAt,
  };
}

function compactCatalog(catalog) {
  return asArray(catalog).map((item) => ({
    sourceOrder: item.sourceOrder,
    sourceImage: item.sourceImage,
    listingImageUrl: item.listingImageUrl,
    listingTitle: item.listingTitle,
    name: item.name,
    title: item.title,
    classification: item.classification,
    error: item.error,
  }));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function projectRawPricingEvidence(row, index) {
  assert(sourceUrl(row?.sourceUrl, `raw pricing row ${index + 1} source URL`), "unreachable");
  assert(row?.currency === "EUR", `Raw pricing row ${index + 1} must use EUR`);
  assert(asInteger(row?.quantity) > 0, `Raw pricing row ${index + 1} has an invalid quantity`);
  assert(finiteNumber(row?.totalEur) > 0, `Raw pricing row ${index + 1} has an invalid supplier total`);
  const priceEvidence = row?.supplierPriceEvidence;
  assert(priceEvidence && priceEvidence.priceScaleId, `Raw pricing row ${index + 1} has no supplier price evidence`);
  assert(
    Math.abs(Number(priceEvidence.optionTotalEur) - Number(row.totalEur)) <= 0.0001,
    `Raw pricing row ${index + 1} supplier price evidence does not match its total`
  );
  let expectedApiFingerprint = null;
  if (priceEvidence.apiVerified === true) {
    const api = row?.supplierApiEvidence;
    assert(api?.endpoint === "/wmdrest/article/get-price" && api?.sanitized === true, `Raw pricing row ${index + 1} has invalid API evidence metadata`);
    assert(/^[a-f0-9]{64}$/i.test(String(api?.sha256 || "")), `Raw pricing row ${index + 1} has invalid API evidence SHA-256`);
    assert(
      sha256Buffer(JSON.stringify({ request: api.request, response: api.response })) === api.sha256,
      `Raw pricing row ${index + 1} API evidence SHA-256 does not match its request/response`
    );
    assert(String(api?.request?.priceScaleId || "") === String(priceEvidence.priceScaleId), `Raw pricing row ${index + 1} API request uses a different price scale`);
    assert(String(api?.response?.priceScaleId || "") === String(priceEvidence.priceScaleId), `Raw pricing row ${index + 1} API response uses a different price scale`);
    assert(Number(api?.request?.quantity) === Number(row.quantity), `Raw pricing row ${index + 1} API quantity is inconsistent`);
    assert(String(api?.request?.substrateId || "") === String(row.materialId || ""), `Raw pricing row ${index + 1} API material is inconsistent`);
    assert(String(api?.request?.articleId || "") === String(row.sourceProductId || ""), `Raw pricing row ${index + 1} API article is inconsistent`);
    assert(Number(api?.response?.price) === Number(row.totalEur), `Raw pricing row ${index + 1} API price is inconsistent`);
    assert(api?.response?.currency === "EUR", `Raw pricing row ${index + 1} API currency is inconsistent`);
    expectedApiFingerprint = sha256Buffer(canonicalJson({
      sourceUrl: row.sourceUrl,
      sourceProductId: row.sourceProductId,
      materialId: row.materialId,
      quantityOptionId: row.quantityOptionId,
      quantity: row.quantity,
      evidence: row.supplierApiEvidence,
    }));
  } else {
    assert(
      priceEvidence.apiVerified === false && priceEvidence.endpoint === "supplier_quantity_option_label",
      `Raw pricing row ${index + 1} has unsupported non-API price evidence`
    );
    assert(row?.supplierApiEvidence == null, `Raw pricing row ${index + 1} has unverified API evidence attached`);
  }
  return {
    normalizedRow: normalizeWmdSalesFolderRow(row, { sourceIndex: index }),
    expectedApiFingerprint,
  };
}

const RAW_COVERAGE_DIMENSIONS = Object.freeze({
  format: "formatKey",
  construction: "constructionKey",
  print: "printMode",
  finish: "finishKey",
  paper: "paperKey",
  spineDepthMm: "spineDepthMm",
  quantity: "quantity",
  totalEur: "totalEur",
});

function createRawPricingIndex() {
  return {
    rowCount: 0,
    rowHashesBySelectionKey: new Map(),
    uniqueSelections: new Set(),
    dimensionValues: Object.fromEntries(
      Object.keys(RAW_COVERAGE_DIMENSIONS).map((key) => [key, new Set()])
    ),
    expectedApiFingerprints: [],
  };
}

function indexRawPricingEvidence(indexState, rawRow, rowIndex) {
  const projection = projectRawPricingEvidence(rawRow, rowIndex);
  const row = projection.normalizedRow;
  assert(row.classified === true, `Raw pricing row ${rowIndex + 1} does not deterministically classify`);
  assert(row.priceEvidenceMismatch == null, `Raw pricing row ${rowIndex + 1} has conflicting price evidence`);
  const converted = compactPricingRow({
    ...row,
    supplierPrice: row.totalEur,
    ...applyConversionRule(row.totalEur, PRICE_CONVERSION_RULE),
    conversionRule: PRICE_CONVERSION_RULE,
  });
  const { sourceOrder: ignoredSourceOrder, ...withoutSourceOrder } = converted;
  void ignoredSourceOrder;
  assert(
    row.selectionKey && !indexState.rowHashesBySelectionKey.has(row.selectionKey),
    `Raw supplier pricing contains duplicate selection key ${row.selectionKey}`
  );
  indexState.rowHashesBySelectionKey.set(
    row.selectionKey,
    sha256Buffer(canonicalJson(withoutSourceOrder))
  );
  indexState.uniqueSelections.add(stableSelectionSignature(proposedSelectionFromPricingRow(row)));
  for (const [coverageKey, rowField] of Object.entries(RAW_COVERAGE_DIMENSIONS)) {
    indexState.dimensionValues[coverageKey].add(row[rowField]);
  }
  if (projection.expectedApiFingerprint) {
    indexState.expectedApiFingerprints.push(projection.expectedApiFingerprint);
  }
  indexState.rowCount += 1;
  return indexState;
}

function validateRawPricingIndex({ rawPricingIndex, normalizedPricingRows, apiEvidenceFingerprints, coverage }) {
  const normalizedRows = asArray(normalizedPricingRows).map(compactPricingRow);
  assert(rawPricingIndex.rowCount > 0, "Raw supplier pricing evidence is empty");
  assert(rawPricingIndex.rowCount === normalizedRows.length, "Raw and normalized pricing row counts differ");
  for (const [index, row] of normalizedRows.entries()) {
    assert(row.sourceOrder === index, `Normalized pricing row ${index + 1} has inconsistent source order`);
    const { sourceOrder: ignoredSourceOrder, ...withoutSourceOrder } = row;
    void ignoredSourceOrder;
    const expectedHash = rawPricingIndex.rowHashesBySelectionKey.get(row.selectionKey);
    assert(expectedHash, `Normalized pricing row ${index + 1} has no exact raw supplier selection`);
    assert(
      sha256Buffer(canonicalJson(withoutSourceOrder)) === expectedHash,
      `Normalized pricing row ${index + 1} does not match deterministic regeneration from raw supplier evidence`
    );
    rawPricingIndex.rowHashesBySelectionKey.delete(row.selectionKey);
  }
  assert(rawPricingIndex.rowHashesBySelectionKey.size === 0, "One or more raw supplier prices are missing from normalized pricing");
  const expectedCoverage = {
    totalSourceRows: rawPricingIndex.rowCount,
    classifiedRows: rawPricingIndex.rowCount,
    unclassifiedRows: 0,
    coveragePct: 100,
    uniqueSelections: rawPricingIndex.uniqueSelections.size,
    uniqueSelectionQuantities: rawPricingIndex.rowCount,
    duplicateSelectionQuantityKeys: [],
    priceEvidenceMismatchRows: 0,
    priceEvidenceMismatches: [],
    dimensions: Object.fromEntries(
      Object.entries(rawPricingIndex.dimensionValues).map(([key, values]) => [key, {
        classified: rawPricingIndex.rowCount,
        unclassified: 0,
        values: [...values],
      }])
    ),
    unclassified: [],
  };
  assert(
    canonicalJson(expectedCoverage) === canonicalJson(coverage),
    "Normalized coverage does not match deterministic streaming regeneration from raw pricing evidence"
  );
  assert(
    canonicalJson(rawPricingIndex.expectedApiFingerprints) === canonicalJson(asArray(apiEvidenceFingerprints)),
    "Raw API-evidence artifact does not match the API evidence attached to raw supplier prices"
  );
  return {
    rawPriceRows: rawPricingIndex.rowCount,
    regeneratedNormalizedRows: normalizedRows.length,
    apiEvidenceRows: rawPricingIndex.expectedApiFingerprints.length,
  };
}

function validateProjectedRawPricing({ projectedRawRows, normalizedPricingRows, apiEvidenceFingerprints, coverage }) {
  const projectedRows = asArray(projectedRawRows);
  const normalizedRows = asArray(normalizedPricingRows).map(compactPricingRow);
  const recordedApiFingerprints = asArray(apiEvidenceFingerprints);
  assert(projectedRows.length > 0, "Raw supplier pricing evidence is empty");
  assert(projectedRows.length === normalizedRows.length, "Raw and normalized pricing row counts differ");
  const regeneratedCoverage = buildWmdSalesFolderCoverageReport(
    projectedRows.map((row) => row.normalizedRow)
  );
  assert(
    canonicalJson(regeneratedCoverage) === canonicalJson(coverage),
    "Normalized coverage does not match deterministic regeneration from raw pricing evidence"
  );
  const regeneratedRows = sortWmdSalesFolderRows(
    projectedRows.map((row) => row.normalizedRow).filter((row) => row.classified)
  ).map((row, sourceOrder) => compactPricingRow({
    sourceOrder,
    ...row,
    supplierPrice: row.totalEur,
    ...applyConversionRule(row.totalEur, PRICE_CONVERSION_RULE),
    conversionRule: PRICE_CONVERSION_RULE,
  }));
  assert(regeneratedRows.length === normalizedRows.length, "Deterministic raw-price regeneration changed the normalized row count");
  for (let index = 0; index < regeneratedRows.length; index += 1) {
    assert(
      canonicalJson(regeneratedRows[index]) === canonicalJson(normalizedRows[index]),
      `Normalized pricing row ${index + 1} does not match deterministic regeneration from raw supplier evidence`,
      {
        expectedSelectionKey: regeneratedRows[index]?.selectionKey,
        actualSelectionKey: normalizedRows[index]?.selectionKey,
        expected: regeneratedRows[index],
        actual: normalizedRows[index],
      }
    );
  }

  const expectedApiFingerprints = projectedRows
    .map((row) => row.expectedApiFingerprint)
    .filter(Boolean);
  assert(
    canonicalJson(expectedApiFingerprints) === canonicalJson(recordedApiFingerprints),
    "Raw API-evidence artifact does not match the API evidence attached to raw supplier prices"
  );
  return {
    rawPriceRows: projectedRows.length,
    regeneratedNormalizedRows: regeneratedRows.length,
    apiEvidenceRows: expectedApiFingerprints.length,
  };
}

export function validateRawPricingProjection({ rawPricingRows, normalizedPricingRows, apiEvidenceRows, coverage }) {
  const projectedRawRows = asArray(rawPricingRows).map(projectRawPricingEvidence);
  const apiEvidenceFingerprints = asArray(apiEvidenceRows)
    .map((row) => sha256Buffer(canonicalJson(row)));
  return validateProjectedRawPricing({
    projectedRawRows,
    normalizedPricingRows,
    apiEvidenceFingerprints,
    coverage,
  });
}

function canonicalSupplierLabel(value) {
  if (typeof value !== "string") return null;
  const canonical = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return canonical || null;
}

function additionalOptionIdentity(option) {
  const fieldKey = option?.fieldKey == null ? "" : String(option.fieldKey);
  const supplierFieldId = option?.supplierFieldId == null ? "" : String(option.supplierFieldId);
  if (!fieldKey.trim() || !supplierFieldId.trim()) return null;
  return {
    fieldKey,
    supplierFieldId,
    key: canonicalJson([fieldKey, supplierFieldId]),
  };
}

function additionalOptionBindingReference(binding, option, optionIndex) {
  return {
    sourceUrl: binding?.sourceUrl || null,
    productSourceOrder: binding?.productSourceOrder ?? null,
    materialId: binding?.materialId == null ? null : String(binding.materialId),
    materialSourceOrder: binding?.materialSourceOrder ?? null,
    capturedAt: binding?.capturedAt || null,
    optionSourceOrder: option?.sourceOrder ?? optionIndex,
  };
}

function buildAdditionalOptionLabelEvidence(documentBindings) {
  const evidenceByIdentity = new Map();
  for (const binding of asArray(documentBindings)) {
    for (const [optionIndex, option] of asArray(binding?.additionalOptions).entries()) {
      const canonicalLabelOriginal = canonicalSupplierLabel(option?.labelOriginal);
      const identity = additionalOptionIdentity(option);
      if (!canonicalLabelOriginal || !identity) continue;
      if (!evidenceByIdentity.has(identity.key)) {
        evidenceByIdentity.set(identity.key, {
          match: { fieldKey: identity.fieldKey, supplierFieldId: identity.supplierFieldId },
          labels: new Map(),
        });
      }
      const identityEvidence = evidenceByIdentity.get(identity.key);
      if (!identityEvidence.labels.has(canonicalLabelOriginal)) {
        identityEvidence.labels.set(canonicalLabelOriginal, []);
      }
      identityEvidence.labels.get(canonicalLabelOriginal).push({
        ...additionalOptionBindingReference(binding, option, optionIndex),
        labelOriginal: option.labelOriginal,
      });
    }
  }
  return evidenceByIdentity;
}

export function validateAdditionalOptionProjection({ documentBindings, additionalOptionBindings, summary }) {
  assert(summary?.addOnInventoryExtracted === true, "Extraction summary does not confirm add-on inventory capture");
  assert(summary?.addOnCombinationPricingVerified === false, "Add-on combination pricing must remain unverified");
  const labelEvidenceByIdentity = buildAdditionalOptionLabelEvidence(documentBindings);
  const resolvedLabelsByIdentity = new Map();
  const expectedBindings = asArray(documentBindings)
    .filter((binding) => asArray(binding?.additionalOptions).length > 0)
    .map((binding, index) => {
      const options = asArray(binding.additionalOptions);
      const coverage = binding?.additionalOptionCoverage;
      assert(coverage, `Add-on document binding ${index + 1} has no inventory coverage record`);
      assert(coverage.fieldInventoryComplete === true, `Add-on document binding ${index + 1} has incomplete field inventory`);
      assert(coverage.choiceInventoryComplete === true, `Add-on document binding ${index + 1} has incomplete choice inventory`);
      assert(asArray(coverage.missingFromApi).length === 0, `Add-on document binding ${index + 1} is missing supplier API fields`);
      assert(asArray(coverage.choiceInventoryIssues).length === 0, `Add-on document binding ${index + 1} has incomplete supplier choices`);
      assert(coverage.combinationPricingVerified === false, `Add-on document binding ${index + 1} incorrectly claims verified combination pricing`);
      assert(coverage.eligibleForImport === false, `Add-on document binding ${index + 1} is incorrectly import-eligible`);
      const optionKeys = options.map((option) => String(option?.fieldKey));
      assert(optionKeys.every((key) => key && key !== "undefined"), `Add-on document binding ${index + 1} has an invalid field key`);
      assert(new Set(optionKeys).size === optionKeys.length, `Add-on document binding ${index + 1} has duplicate field keys`);
      assert(
        optionKeys.join("\n") === asArray(coverage.apiOptionKeys).map(String).join("\n"),
        `Add-on document binding ${index + 1} options do not match its API inventory`
      );
      for (const [optionIndex, option] of options.entries()) {
        const canonicalLabelOriginal = canonicalSupplierLabel(option?.labelOriginal);
        if (!canonicalLabelOriginal) {
          const fieldKey = option?.fieldKey == null ? "" : String(option.fieldKey);
          const unexpectedFromApi = asArray(coverage.unexpectedFromApi).map(String);
          const visibleOptionKeys = asArray(coverage.visibleOptionKeys).map(String);
          assert(
            coverage.apiExtendedInventory === true,
            `Add-on field ${fieldKey} has no supplier label and is not explicitly API-extended`
          );
          assert(
            unexpectedFromApi.includes(fieldKey),
            `Add-on field ${fieldKey} has no supplier label and is not marked unexpectedFromApi`
          );
          assert(
            !visibleOptionKeys.includes(fieldKey),
            `Add-on field ${fieldKey} has no supplier label but is visible in the supplier page inventory`
          );
          const identity = additionalOptionIdentity(option);
          assert(
            identity,
            `Add-on field ${fieldKey} has no supplier label and no exact supplierFieldId identity`
          );
          const identityEvidence = labelEvidenceByIdentity.get(identity.key);
          assert(
            identityEvidence && identityEvidence.labels.size > 0,
            `Add-on field ${fieldKey} / ${identity.supplierFieldId} has no canonical supplier label evidence elsewhere in the raw dataset`
          );
          assert(
            identityEvidence.labels.size === 1,
            `Add-on field ${fieldKey} / ${identity.supplierFieldId} has ambiguous canonical supplier label evidence in the raw dataset`,
            { labels: [...identityEvidence.labels.keys()] }
          );
          const [[resolvedLabelOriginal, supportingBindings]] = identityEvidence.labels.entries();
          if (!resolvedLabelsByIdentity.has(identity.key)) {
            resolvedLabelsByIdentity.set(identity.key, {
              match: identityEvidence.match,
              canonicalLabelOriginal: resolvedLabelOriginal,
              targetBindings: [],
              provenance: {
                sourceArtifact: "raw/document-bindings.jsonl",
                resolutionRule: "unique_canonical_supplier_label_for_exact_field_key_and_supplier_field_id",
                supportingBindingCount: supportingBindings.length,
                supportingBindingsSha256: sha256Buffer(canonicalJson(supportingBindings)),
                supportingBindings,
                rawEvidenceMutated: false,
              },
            });
          }
          resolvedLabelsByIdentity.get(identity.key).targetBindings.push(
            additionalOptionBindingReference(binding, option, optionIndex)
          );
        }
        const choices = asArray(option?.choices);
        assert(choices.length > 0, `Add-on field ${option.fieldKey} has no supplier choices`);
        for (const choice of choices) {
          assert(choice?.sourceId != null && typeof choice?.labelOriginal === "string" && choice.labelOriginal.trim(), `Add-on field ${option.fieldKey} has an incomplete supplier choice`);
          assert(
            [
              choice.supplierSalePriceEur,
              choice.supplierSaleBasePriceEur,
              choice.supplierSalePercentage,
              choice.supplierMinimumSalePriceEur,
            ].some((value) => value != null && Number.isFinite(Number(value))),
            `Add-on field ${option.fieldKey} choice ${choice.sourceId} has no supplier price evidence`
          );
        }
      }
      return {
        sourceUrl: binding.sourceUrl,
        productSourceOrder: binding.productSourceOrder,
        materialId: binding.materialId,
        materialSourceOrder: binding.materialSourceOrder,
        materialLabel: binding.materialLabel,
        spineDepthMm: binding.materialFacts?.spineDepthMm ?? null,
        additionalOptions: options,
        additionalOptionCoverage: coverage,
        capturedAt: binding.capturedAt,
      };
    });
  assert(expectedBindings.length > 0, "No captured add-on inventory is attached to the document evidence");
  assert(
    canonicalJson(expectedBindings) === canonicalJson(asArray(additionalOptionBindings)),
    "Dedicated add-on inventory does not match the raw document-binding evidence"
  );
  const resolvedSupplierLabels = [...resolvedLabelsByIdentity.values()].map((resolution) => ({
    match: resolution.match,
    canonicalLabelOriginal: resolution.canonicalLabelOriginal,
    targetBindingCount: resolution.targetBindings.length,
    targetBindings: resolution.targetBindings,
    provenance: resolution.provenance,
  }));
  return {
    inventoryExtracted: true,
    combinationPricingVerified: false,
    bindingCount: expectedBindings.length,
    optionFieldCount: expectedBindings.reduce((total, binding) => total + binding.additionalOptions.length, 0),
    choiceCount: expectedBindings.reduce(
      (total, binding) => total + binding.additionalOptions.reduce(
        (optionTotal, option) => optionTotal + asArray(option.choices).length,
        0
      ),
      0
    ),
    apiExtendedBindingCount: expectedBindings.filter(
      (binding) => binding.additionalOptionCoverage.apiExtendedInventory === true
    ).length,
    resolvedMissingSupplierLabelCount: resolvedSupplierLabels.reduce(
      (total, resolution) => total + resolution.targetBindingCount,
      0
    ),
    resolvedSupplierLabelIdentityCount: resolvedSupplierLabels.length,
    resolvedSupplierLabels,
    sourceArtifact: "raw/additional-option-bindings.jsonl",
  };
}

export function validateExtractionGate({ summary, coverage, options, pricingRows, documentBindings, catalog, evidenceAudit }) {
  assert(summary?.state === "extracted", "Extraction state must be extracted");
  assert(summary?.partial === false, "Refusing to build a review package from a partial extraction");
  assert(summary?.eligibleForReview === true, "Extraction is not eligible for review");
  assert(summary?.eligibleForImport === false, "Extraction must remain explicitly ineligible for import");
  assert(summary?.supplierBankWritten === false, "Supplier Bank must not already be written");
  assert(summary?.productDraftWritten === false, "Product draft must not already be written");
  assert(summary?.pricingWritten === false, "Pricing must not already be written");
  assert(summary?.templatesWritten === false, "Templates must not already be written");
  assert(summary?.published === false, "Product must not already be published");
  assert(summary?.failedProducts === 0, "Extraction contains failed products");
  assert(summary?.unresolvedCurrentRunFailures === 0, "Extraction contains unresolved failures");
  assert(summary?.catalogProducts > 0, "Extraction contains no supplier products");
  assert(summary?.successfulProducts === summary?.catalogProducts, "Not every supplier product completed successfully");
  assert(summary?.runScope?.partial === false, "Run scope is not a full extraction");
  assert(
    summary?.runScope?.selectedProductCount === summary?.runScope?.fullDiscoveredProductCount,
    "Run scope did not select every discovered supplier product"
  );
  assert(
    summary?.runScope?.selectedProductCount === summary?.catalogProducts,
    "Run scope product count does not match the extracted catalog"
  );
  assert(summary?.runScope?.args?.maxProducts == null, "Full review package cannot use --max-products");
  assert(summary?.runScope?.args?.maxQuantities == null, "Full review package cannot use --max-quantities");
  assert(summary?.conversionRule === PRICE_CONVERSION_RULE, "Extraction summary uses an unreviewed price conversion rule");
  assert(summary?.rawPriceRows === summary?.normalizedPriceRows, "Raw and normalized price row counts differ");
  assert(summary?.normalizedPriceRows === pricingRows.length, "Summary price count does not match normalized pricing JSONL");
  assert(summary?.documentBindings === documentBindings.length, "Summary document count does not match document bindings JSONL");
  assert(summary?.evidenceAuditPassedProducts === summary?.successfulProducts, "Not every supplier product passed the evidence audit");
  assert(summary?.addOnInventoryExtracted === true, "Extraction summary does not confirm add-on inventory capture");
  assert(summary?.addOnCombinationPricingVerified === false, "Add-on combination pricing must remain excluded until separately verified");

  const parserCoverage = summary?.parserCoverage || {};
  assert(parserCoverage?.unclassifiedRows === 0, "Summary contains unclassified rows");
  assert(parserCoverage?.priceEvidenceMismatchRows === 0, "Summary contains price evidence mismatches");
  assert(asArray(parserCoverage?.duplicateSelectionQuantityKeys).length === 0, "Summary contains duplicate selection/quantity keys");
  assert(coverage?.unclassifiedRows === 0, "Coverage report contains unclassified rows");
  assert(coverage?.priceEvidenceMismatchRows === 0, "Coverage report contains price evidence mismatches");
  assert(asArray(coverage?.duplicateSelectionQuantityKeys).length === 0, "Coverage report contains duplicate selection/quantity keys");
  assert(coverage?.classifiedRows === pricingRows.length, "Coverage classified count does not match pricing rows");

  assert(asArray(options?.combinations).length > 0, "Normalized option catalog has no sparse combinations");
  assert(catalog.length === summary.catalogProducts, "Catalog row count does not match extraction summary");
  assert(catalog.every((item) => !item?.error), "Catalog contains one or more product errors");
  assert(evidenceAudit.length === summary.successfulProducts, "Evidence audit row count does not match successful products");
  assert(
    evidenceAudit.every((item) => item?.evidenceValid === true && item?.requestedScopeSatisfied === true && !item?.currentRunFailure),
    "Evidence audit contains an invalid, out-of-scope, or failed product"
  );

  const priceSignatures = new Set();
  const pricedCombinations = new Set();
  const optionValueSets = {
    format: new Set(asArray(options?.formats).map((item) => String(item.key))),
    construction: new Set(asArray(options?.constructions).map((item) => String(item.key))),
    print: new Set(asArray(options?.prints).map((item) => String(item.key))),
    spine: new Set(asArray(options?.spineDepths).map((item) => `${Number(item.spineDepthMm)}mm`)),
    paper: new Set(asArray(options?.papers).map((item) => String(item.key))),
    finish: new Set(asArray(options?.finishes).map((item) => String(item.key))),
  };
  for (const [index, row] of pricingRows.entries()) {
    assert(row?.classified === true, `Pricing row ${index + 1} is not classified`);
    assert(asArray(row?.unclassifiedDimensions).length === 0, `Pricing row ${index + 1} contains unclassified dimensions`);
    assert(row?.priceEvidenceMismatch == null, `Pricing row ${index + 1} contains a price evidence mismatch`);
    assert(sourceUrl(row?.source?.url, `pricing row ${index + 1} source URL`), "unreachable");
    assert(asInteger(row?.quantity) > 0, `Pricing row ${index + 1} has an invalid quantity`);
    assert(finiteNumber(row?.supplierPrice) >= 0, `Pricing row ${index + 1} has an invalid supplier price`);
    assert(row?.currency === "EUR", `Pricing row ${index + 1} must use the reviewed supplier currency EUR`);
    assert(row?.ruleKey === PRICE_CONVERSION_RULE, `Pricing row ${index + 1} uses an unreviewed conversion rule`);
    if (row?.conversionRule != null) {
      assert(row.conversionRule === PRICE_CONVERSION_RULE, `Pricing row ${index + 1} conversion-rule alias is inconsistent`);
    }
    const derivedPrice = applyConversionRule(Number(row.supplierPrice), PRICE_CONVERSION_RULE);
    for (const field of ["supplierPrice", "convertedPriceDkk", "finalPriceDkk", "tierMultiplier", "factor"]) {
      assert(
        Number(row?.[field]) === Number(derivedPrice[field]),
        `Pricing row ${index + 1} ${field} does not match ${PRICE_CONVERSION_RULE}`,
        { expected: derivedPrice[field], actual: row?.[field] }
      );
    }
    assert(asInteger(row?.finalPriceDkk) > 0, `Pricing row ${index + 1} has an invalid final DKK price`);
    assert(Number(row?.source?.quantity) === Number(row?.quantity), `Pricing row ${index + 1} quantity does not match source evidence`);
    assert(Math.abs(Number(row?.source?.totalEur) - Number(row?.supplierPrice)) <= 0.0001, `Pricing row ${index + 1} supplier price does not match source evidence`);
    const selection = proposedSelectionFromPricingRow(row);
    assert(!Object.values(selection).some((value) => value.includes("undefined") || value.includes("NaN")), `Pricing row ${index + 1} has an incomplete proposed selection`);
    assert(optionValueSets.format.has(String(row.formatKey)), `Pricing row ${index + 1} format is missing from normalized options`);
    assert(optionValueSets.construction.has(String(row.constructionKey)), `Pricing row ${index + 1} construction is missing from normalized options`);
    for (const axis of ["print", "spine", "paper", "finish"]) {
      assert(optionValueSets[axis].has(selection[axis]), `Pricing row ${index + 1} ${axis} is missing from normalized options`);
    }
    pricedCombinations.add(stableSelectionSignature(selection));
    const signature = priceSignature(selection, row.quantity);
    assert(!priceSignatures.has(signature), `Duplicate proposed price signature: ${signature}`);
    priceSignatures.add(signature);
  }

  const optionCombinations = new Set();
  for (const [index, combination] of asArray(options.combinations).entries()) {
    const selection = proposedSelectionFromOptionCombination(combination);
    assert(!Object.values(selection).some((value) => value.includes("undefined") || value.includes("NaN")), `Option combination ${index + 1} is incomplete`);
    const signature = stableSelectionSignature(selection);
    assert(!optionCombinations.has(signature), `Normalized option catalog contains duplicate combination ${signature}`);
    optionCombinations.add(signature);
  }
  assert(optionCombinations.size === pricedCombinations.size, "Normalized option combinations do not match priced combinations");
  for (const signature of pricedCombinations) {
    assert(optionCombinations.has(signature), `Normalized option catalog is missing priced combination ${signature}`);
  }

  return { priceSignatures, pricedCombinations };
}

function uniqueInOrder(rows, keySelector) {
  const seen = new Set();
  const values = [];
  for (const row of rows) {
    const key = keySelector(row);
    if (!seen.has(key)) {
      seen.add(key);
      values.push(row);
    }
  }
  return values;
}

function firstCatalogByModel(catalog) {
  const map = new Map();
  for (const item of [...catalog].sort((left, right) => Number(left.sourceOrder) - Number(right.sourceOrder))) {
    const classification = item?.classification || {};
    const key = folderModelKey(classification);
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

function materialOriginalByKey(documentBindings) {
  const map = new Map();
  for (const binding of documentBindings) {
    const key = binding?.materialFacts?.paperKey;
    if (key && !map.has(key)) map.set(key, binding.materialLabel || key);
  }
  return map;
}

function sourceTitleByFinish(catalog) {
  const map = new Map();
  for (const item of [...catalog].sort((left, right) => Number(left.sourceOrder) - Number(right.sourceOrder))) {
    const key = item?.classification?.finishKey;
    if (key && !map.has(key)) map.set(key, item.listingTitle || item.name || item.title || key);
  }
  return map;
}

function optionGroupValues({ options, pricingRows, documentBindings, catalog }) {
  const modelCatalog = firstCatalogByModel(catalog);
  const paperOriginals = materialOriginalByKey(documentBindings);
  const finishSources = sourceTitleByFinish(catalog);

  const models = uniqueInOrder(pricingRows, (row) => folderModelKey(row))
    .map((row) => {
      const key = folderModelKey(row);
      const reference = modelCatalog.get(key);
      return {
        key,
        labelOriginal: reference?.listingTitle || reference?.name || `${row.formatLabelDa} ${row.constructionKey}`,
        labelDa: `${row.formatLabelDa} · ${row.constructionLabelDa}`,
        widthMm: Number(row.widthMm),
        heightMm: Number(row.heightMm),
        constructionKey: row.constructionKey,
        formatKey: row.formatKey,
        windowPunch: Boolean(row.windowPunch),
        closure: Boolean(row.closure),
        sourceReferenceUrl: sourceUrl(reference?.sourceImage || reference?.listingImageUrl, `folder model ${key} reference image`),
      };
    })
    // The supplier's model order is not a simple format × construction
    // Cartesian sort. A6 closure appears before the A6 three-part model, for
    // example, so use the reviewed 21-model catalog profile verbatim.
    .sort((left, right) => compareIndex(
      FULL_CATALOG_PROFILE.modelKeys,
      left.key,
      right.key
    ));

  const prints = asArray(options?.prints)
    .map((item) => ({
      key: item.key,
      labelOriginal: PRINT_LABELS_ORIGINAL[item.key] || item.key,
      labelDa: item.labelDa,
    }))
    .sort((left, right) => compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.print, left.key, right.key));

  const spines = asArray(options?.spineDepths)
    .map((item) => ({
      key: `${Number(item.spineDepthMm)}mm`,
      labelOriginal: `${Number(item.spineDepthMm)} mm`,
      labelDa: item.labelDa,
      spineDepthMm: Number(item.spineDepthMm),
    }))
    .sort((left, right) => compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.spineDepthMm, left.spineDepthMm, right.spineDepthMm));

  const papers = asArray(options?.papers)
    .map((item) => ({
      key: item.key,
      labelOriginal: paperOriginals.get(item.key) || item.key,
      labelDa: item.labelDa,
    }))
    .sort((left, right) => compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.paper, left.key, right.key));

  const finishes = asArray(options?.finishes)
    .map((item) => {
      const professionalPdfUploadOnly = PROFESSIONAL_PDF_ONLY_FINISHES.has(item.key);
      return {
        key: item.key,
        labelOriginal: FINISH_LABELS_ORIGINAL[item.key] || finishSources.get(item.key) || item.key,
        labelDa: item.labelDa,
        sourceExampleTitle: finishSources.get(item.key) || null,
        artworkMode: professionalPdfUploadOnly
          ? "professional_pdf_upload_only"
          : "online_designer",
        onlineDesignerAllowed: !professionalPdfUploadOnly,
        ...(professionalPdfUploadOnly
          ? { artworkModeReasonDa: PROFESSIONAL_PDF_ONLY_REASON_DA }
          : {}),
      };
    })
    .sort((left, right) => compareIndex(WMD_SALES_FOLDER_SOURCE_ORDER.finish, left.key, right.key));

  assert(prints.map((item) => item.key).join(",") === "4+0,4+4", "Print values must be ordered 4+0 then 4+4");
  assert(spines.map((item) => item.spineDepthMm).join(",") === "1,3,5,10", "Spine values must be ordered 1, 3, 5, 10 mm");

  return { models, prints, spines, papers, finishes };
}

function groupWithOrders(group, sourceOrder) {
  return {
    ...group,
    sourceOrder,
    values: group.values.map((value, valueOrder) => ({ ...value, sourceOrder: valueOrder })),
  };
}

export function validateCompleteCatalogProfile({ summary, options, models, profile = FULL_CATALOG_PROFILE }) {
  const actual = {
    sourceProductCount: Number(summary?.catalogProducts),
    modelKeys: asArray(models).map((model) => model.key),
    printKeys: asArray(options?.prints).map((item) => item.key),
    spineDepthsMm: asArray(options?.spineDepths).map((item) => Number(item.spineDepthMm)),
    paperKeys: asArray(options?.papers).map((item) => item.key),
    finishKeys: asArray(options?.finishes).map((item) => item.key),
  };
  assert(actual.sourceProductCount === profile.sourceProductCount, `Full sales-folder catalog must contain ${profile.sourceProductCount} supplier products`);
  for (const field of ["modelKeys", "printKeys", "spineDepthsMm", "paperKeys", "finishKeys"]) {
    assert(
      actual[field].join("\n") === asArray(profile[field]).join("\n"),
      `Full sales-folder catalog ${field} are missing, extra, or reordered`,
      { expected: profile[field], actual: actual[field] }
    );
  }
  return actual;
}

export function buildConsolidatedProductProposal({
  options,
  pricingRows,
  documentBindings,
  catalog,
  iconManifest,
  heroAsset,
  additionalOptionReview,
  catalogScope = null,
}) {
  const values = optionGroupValues({ options, pricingRows, documentBindings, catalog });
  assert(iconManifest?.optionAxis === "folder_model", "A validated folder_model icon manifest is required");
  assert(heroAsset?.state === "local_review_only_verified" && heroAsset?.published === false, "A validated local-only product hero is required");
  assert(
    additionalOptionReview?.inventoryExtracted === true
      && additionalOptionReview?.combinationPricingVerified === false
      && additionalOptionReview?.bindingCount > 0,
    "A reconciled, non-priced add-on inventory is required"
  );
  assert(
    Number.isInteger(additionalOptionReview.resolvedMissingSupplierLabelCount)
      && additionalOptionReview.resolvedMissingSupplierLabelCount >= 0
      && Number.isInteger(additionalOptionReview.resolvedSupplierLabelIdentityCount)
      && additionalOptionReview.resolvedSupplierLabelIdentityCount >= 0
      && asArray(additionalOptionReview.resolvedSupplierLabels).length
        === additionalOptionReview.resolvedSupplierLabelIdentityCount,
    "Reconciled add-on inventory has incomplete resolved-label provenance"
  );
  const excludedAddOnIdentities = new Set(PROPOSED_ADD_ON_EXCLUSIONS.map((entry) =>
    `${String(entry.fieldKey)}:${String(entry.supplierFieldId)}`
  ));
  const proposedResolvedSupplierLabels = asArray(additionalOptionReview.resolvedSupplierLabels).filter(
    (entry) => !excludedAddOnIdentities.has(
      `${String(entry?.match?.fieldKey)}:${String(entry?.match?.supplierFieldId)}`
    )
  );
  const excludedResolvedSupplierLabels = asArray(additionalOptionReview.resolvedSupplierLabels).filter(
    (entry) => excludedAddOnIdentities.has(
      `${String(entry?.match?.fieldKey)}:${String(entry?.match?.supplierFieldId)}`
    )
  );
  assert(
    iconManifest.modelOrder.join("\n") === values.models.map((model) => model.key).join("\n"),
    "Validated icon manifest order no longer matches the proposed folder models"
  );
  const optionGroups = [
    groupWithOrders({
      key: "folder_model",
      labelOriginal: "Mappenmodell",
      labelDa: "Mappemodel",
      displayType: "icon_grid",
      assetManifest: {
        repoAssetPath: iconManifest.manifestRepoPath,
        sha256: iconManifest.manifestSha256,
        assetVersion: iconManifest.assetVersion,
        modelCount: iconManifest.modelCount,
        palette: iconManifest.palette,
        backendProjection: iconManifest.backendProjection,
        provenance: iconManifest.provenance,
        reviewArtifacts: iconManifest.reviewArtifacts,
      },
      values: values.models.map((model) => {
        const { sourceReferenceUrl, ...modelFields } = model;
        return {
          ...modelFields,
          icon: {
          assetVersion: iconManifest.assetVersion,
          assetState: "local_manifest_verified",
          svg: iconManifest.models[model.key].svg,
          accessibleNameDa: iconManifest.models[model.key].accessibleNameDa,
          palette: iconManifest.palette,
          backendProjection: {
            ...iconManifest.backendProjection,
            sourceRepoAssetPath: iconManifest.models[model.key].svg.repoAssetPath,
            resolvedPublicCustomImageUrl: null,
            publicAssetResolutionRequiredAtApprovedProductDraftGate: true,
          },
          provenance: {
            supplierReferenceUrl: sourceReferenceUrl,
            supplierReferencePurpose: "structural evidence only",
            supplierAssetUsedAsProposedIcon: false,
            supplierAssetsCopied: false,
            supplierBrandingIncluded: false,
          },
          },
        };
      }),
    }, 0),
    groupWithOrders({
      key: "print",
      labelOriginal: "Druck",
      labelDa: "Tryk",
      displayType: "buttons",
      values: values.prints,
    }, 1),
    groupWithOrders({
      key: "spine",
      labelOriginal: "Füllhöhe",
      labelDa: "Rygbredde",
      displayType: "buttons",
      values: values.spines,
    }, 2),
    groupWithOrders({
      key: "paper",
      labelOriginal: "Material",
      labelDa: "Papir og karton",
      displayType: "buttons",
      values: values.papers,
    }, 3),
    groupWithOrders({
      key: "finish",
      labelOriginal: "Veredelung",
      labelDa: "Efterbehandling",
      displayType: "dropdown",
      values: values.finishes,
    }, 4),
  ];

  return {
    schemaVersion: 1,
    state: "local_review_only",
    catalogScope,
    proposedProduct: {
      slug: PRODUCT_SLUG,
      nameOriginal: "Individuelle Präsentationsmappen",
      nameDa: "Salgsmapper med eget design",
      family: "sales_folders",
      categoryDa: "Salgsmapper",
      pricingType: "matrix",
      isPublished: false,
      tenantVisibility: "pending_product_draft_approval",
      shortDescriptionDa:
        "Professionelle salgsmapper med eget design. Vælg mappemodel, tryk, rygbredde, karton og efterbehandling; kun dokumenterede kombinationer får en pris.",
      aboutTitleDa: "Salgsmapper til tilbud, præsentationer og salgsmateriale",
      aboutDescriptionDa:
        "Saml tilbud, produktark og præsentationsmateriale i en salgsmappe med eget tryk. Sortimentet omfatter flere formater og konstruktioner, tryk på ydersiden eller på begge sider, rygbredder på 1, 3, 5 og 10 mm samt forskellige kartoner og efterbehandlinger. Den tekniske skabelon og de præcise mål skal følge den valgte kombination. Mapperne leveres udstanset og rillede; prislisten viser kun kombinationer, der er dokumenteret i leverandørens udtræk.",
      unsupportedClaimsExcluded: true,
    },
    axisOrder: [...AXIS_ORDER],
    optionGroups,
    visualAssets: {
      productHero: heroAsset,
    },
    addOns: {
      inventoryExtracted: true,
      inventoryScope: "raw_additional_option_evidence_only",
      sourceArtifact: additionalOptionReview.sourceArtifact,
      bindingCount: additionalOptionReview.bindingCount,
      optionFieldCount: additionalOptionReview.optionFieldCount,
      choiceCount: additionalOptionReview.choiceCount,
      apiExtendedBindingCount: additionalOptionReview.apiExtendedBindingCount,
      rawResolvedMissingSupplierLabelCount: additionalOptionReview.resolvedMissingSupplierLabelCount,
      rawResolvedSupplierLabelIdentityCount: additionalOptionReview.resolvedSupplierLabelIdentityCount,
      resolvedMissingSupplierLabelCount: proposedResolvedSupplierLabels.reduce(
        (total, entry) => total + Number(entry.targetBindingCount || 0),
        0
      ),
      resolvedSupplierLabelIdentityCount: proposedResolvedSupplierLabels.length,
      resolvedSupplierLabels: proposedResolvedSupplierLabels,
      excludedResolvedSupplierLabelIdentityCount: excludedResolvedSupplierLabels.length,
      rawEvidenceMutatedForLabelResolution: false,
      combinationPricingVerified: false,
      includedInPricing: false,
      projectedToProductOptions: false,
      proposedSelectableOptionCount: 0,
      reason: "Leverandørens tilbehør er kun bevaret som råt revisionsbevis og er ikke projiceret til produktvalg eller priser.",
    },
    status: {
      productCreated: false,
      pricesWritten: false,
      templatesWritten: false,
      published: false,
      eligibleForImport: false,
    },
  };
}

export function buildProposedPriceRows(pricingRows) {
  return pricingRows.map((row, index) => {
    const selection = proposedSelectionFromPricingRow(row);
    return {
      sourceOrder: index,
      proposedSelectionKey: priceSignature(selection, row.quantity),
      selections: selection,
      quantity: Number(row.quantity),
      supplierPrice: Number(row.supplierPrice),
      supplierCurrency: row.currency,
      convertedPriceDkk: Number(row.convertedPriceDkk),
      finalPriceDkk: Number(row.finalPriceDkk),
      conversionRuleKey: row.ruleKey || row.conversionRule,
      conversionFactor: finiteNumber(row.factor),
      tierMultiplier: finiteNumber(row.tierMultiplier),
      sourceEvidence: {
        normalizedSourceOrder: row.sourceOrder,
        normalizedSelectionKey: row.selectionKey,
        sourceUrl: sourceUrl(row?.source?.url, `pricing row ${index + 1} source URL`),
        sourceProductTitle: row?.source?.title || null,
        sourceMaterialLabel: row?.source?.materialLabel || null,
        sourceQuantityPriceLabel: row?.source?.quantityPriceLabel || null,
        sourceQuantity: Number(row?.source?.quantity),
        sourceTotalEur: Number(row?.source?.totalEur),
        labelTotalEur: finiteNumber(row?.source?.labelTotalEur),
        rawPricingEvidencePath: "raw/pricing.jsonl",
        apiEvidencePath: "raw/api-evidence.jsonl",
        materialEvidencePath: "raw/material-evidence.jsonl",
      },
      noInterpolation: true,
    };
  });
}

export function buildCompatibility(proposedPriceRows) {
  const combinations = new Map();
  for (const row of proposedPriceRows) {
    const key = stableSelectionSignature(row.selections);
    let entry = combinations.get(key);
    if (!entry) {
      entry = { selectionKey: key, selections: row.selections, quantities: [] };
      combinations.set(key, entry);
    }
    entry.quantities.push(row.quantity);
  }
  return [...combinations.values()]
    .map((entry) => ({ ...entry, quantities: [...new Set(entry.quantities)].sort((a, b) => a - b) }))
    .sort((left, right) => compareProposedSelections(left.selections, right.selections));
}

export function buildPricingStructure({ productProposal, compatibility, proposedPriceRows }) {
  const groups = new Map(productProposal.optionGroups.map((group) => [group.key, group]));
  const placeholderValueIds = (key) => groups.get(key).values.map((value) => `pending-value-id:${key}:${value.key}`);
  const modelGroup = groups.get("folder_model");
  assert(modelGroup, "Consolidated product proposal has no folder_model group");
  const modelImageSizePx = modelGroup.assetManifest?.backendProjection?.recommendedSizePx;
  assert(
    Number.isFinite(modelImageSizePx) && modelImageSizePx > 0,
    "Consolidated folder_model group has no valid backend-controlled image size"
  );
  const modelValueSettings = Object.fromEntries(modelGroup.values.map((value) => [
    `pending-value-id:folder_model:${value.key}`,
    {
      showThumbnail: true,
      customImage: null,
      preferCustomImage: true,
      imageSizePx: modelImageSizePx,
      displayName: value.labelDa,
    },
  ]));
  return {
    schemaVersion: 1,
    proposalOnly: true,
    catalogScope: productProposal.catalogScope,
    pricingType: "matrix",
    customerSelectionOrder: [...AXIS_ORDER],
    sparseCompatibilityRequired: true,
    interpolationAllowed: false,
    proposedMatrixLayoutV1: {
      mode: "matrix_layout_v1",
      version: 1,
      note: "Database UUIDs are deliberately unresolved until an approved unpublished product-draft write.",
      vertical_axis: {
        sectionId: "pending-group-id:paper",
        sectionType: "materials",
        groupId: "pending-group-id:paper",
        valueIds: placeholderValueIds("paper"),
        ui_mode: "buttons",
        title: "Papir og karton",
      },
      layout_rows: [
        {
          id: "sales-folder-configuration",
          title: "Konfigurér din salgsmappe",
          columns: ["folder_model", "print", "spine", "finish"].map((key) => {
            const isFolderModel = key === "folder_model";
            return {
              id: `pending-group-id:${key}`,
              sectionType: isFolderModel ? "formats" : key === "finish" ? "finishes" : "other",
              groupId: `pending-group-id:${key}`,
              valueIds: placeholderValueIds(key),
              ui_mode: isFolderModel ? "xl" : groups.get(key).displayType,
              selection_mode: "required",
              title: groups.get(key).labelDa,
              ...(isFolderModel ? {
                thumbnail_size: "xl",
                thumbnail_custom_px: modelImageSizePx,
                valueSettings: modelValueSettings,
                preferCustomImage: true,
                prefer_custom_image: true,
                neutralWhiteSurface: true,
                neutral_white_surface: true,
                selectorStyling: {
                  pictureButtons: {
                    size: "xl",
                    displayMode: "text_below_image",
                    transparentBackground: true,
                    labelOutsideImage: true,
                    backgroundColor: "#FFFFFF",
                  },
                },
              } : {}),
            };
          }),
        },
      ],
      quantities: [...new Set(proposedPriceRows.map((row) => row.quantity))].sort((a, b) => a - b),
    },
    exactSparseCombinationCount: compatibility.length,
    exactPriceRowCount: proposedPriceRows.length,
    compatibilityArtifact: "review/proposed-compatibility.json",
    priceRowsArtifact: "review/proposed-price-rows.jsonl",
  };
}

export function buildTemplateProjectionStubs({ documentBindings, proposedPriceRows }) {
  const pricedSelectionKeys = new Set(proposedPriceRows.map((row) => stableSelectionSignature(row.selections)));
  const seen = new Set();
  const stubs = documentBindings.map((binding, index) => {
    const selection = proposedSelectionFromDocumentBinding(binding);
    const selectionKey = stableSelectionSignature(selection);
    assert(pricedSelectionKeys.has(selectionKey), `Document binding ${index + 1} has no priced configuration: ${selectionKey}`);
    assert(!seen.has(selectionKey), `Duplicate document projection: ${selectionKey}`);
    seen.add(selectionKey);

    const documents = asArray(binding?.documents);
    const guides = documents.filter((document) => document?.role === "guide");
    const templates = documents.filter((document) => document?.role === "template");
    assert(guides.length === 1 && templates.length === 1 && documents.length === 2, `Document binding ${index + 1} must contain exactly one guide and one template`);
    const guideUrl = sourceUrl(guides[0].url, `document binding ${index + 1} guide URL`);
    const templateUrl = sourceUrl(templates[0].url, `document binding ${index + 1} template URL`);
    assert(guideUrl !== templateUrl, `Document binding ${index + 1} uses one PDF for both roles`);

    const key = safeKey(`${selection.folder_model}-${selection.print}-${selection.spine}-${selection.paper}-${selection.finish}`);
    const professionalPdfUploadOnly = PROFESSIONAL_PDF_ONLY_FINISHES.has(selection.finish);
    return {
      sourceOrder: index,
      key,
      match: selection,
      selectionConstraintProfile: "sales_folder_v1",
      selectionConstraintSections: Object.fromEntries(
        TEMPLATE_BINDING_AXES.map((axis) => [axis, `pending-group-id:${axis}`])
      ),
      selectionConstraintStatus: "pending_all_five_real_section_and_value_uuids_at_approved_product_draft",
      structuredBinding: {
        profile: "sales_folder_v1",
        semanticAxisKeys: [...TEMPLATE_BINDING_AXES],
        semanticConstraints: Object.fromEntries(
          TEMPLATE_BINDING_AXES.map((axis) => [axis, selection[axis]])
        ),
        eventualUuidConstraints: {
          state: "pending_approved_product_draft_section_and_value_ids",
          requiredSemanticAxisKeys: [...TEMPLATE_BINDING_AXES],
          requiredConstraintCount: TEMPLATE_BINDING_AXES.length,
          exactFiveConstraintsRequired: true,
          partialConstraintsAllowed: false,
          pdfByteReuseDoesNotRelaxConstraintCompleteness: true,
        },
      },
      sourceBinding: {
        sourceUrl: sourceUrl(binding.sourceUrl, `document binding ${index + 1} source URL`),
        sourceProductId: binding.sourceProductId || null,
        sourceSku: binding.sourceSku || null,
        productSourceOrder: binding.productSourceOrder,
        materialId: String(binding.materialId),
        materialSourceOrder: binding.materialSourceOrder,
        materialLabel: binding.materialLabel,
        materialFacts: binding.materialFacts,
        rawBindingArtifact: "raw/document-bindings.jsonl",
      },
      guide: {
        sourceUrl: guideUrl,
        sourceLabel: guides[0].label || null,
        nativeGuideKey: `sales-folder-${key}`,
        factsReviewed: false,
        status: "source_pdf_extracted_content_review_pending",
      },
      template: {
        sourceUrl: templateUrl,
        sourceLabel: templates[0].label || null,
        sanitizedPdfPath: null,
        sanitizedPdfSha256: null,
        designerTemplateId: null,
        widthMm: null,
        heightMm: null,
        bleedMm: null,
        safeMm: null,
        metadataRemoved: false,
        supplierBrandingRemoved: false,
        vectorGeometryVerified: false,
        layersVerified: false,
        danishLegendVerified: false,
        webprinterBluePanelsVerified: false,
        textContainmentVerified: false,
        lockedInDesigner: false,
        nonPrintingOverlayVerified: false,
        excludedFromExportVerified: false,
        structuredBindingProfile: "sales_folder_v1",
        eventualUuidConstraintStatus: "all_five_required_pending_product_draft_ids",
        artworkMode: professionalPdfUploadOnly
          ? "professional_pdf_upload_only"
          : "online_designer",
        onlineDesignerAllowed: !professionalPdfUploadOnly,
        ...(professionalPdfUploadOnly
          ? { artworkModeReasonDa: PROFESSIONAL_PDF_ONLY_REASON_DA }
          : {}),
        status: "source_pdf_extracted_download_and_pdf_review_pending",
      },
    };
  });

  assert(seen.size === pricedSelectionKeys.size, "Document projections do not cover every unique priced configuration", {
    pricedConfigurations: pricedSelectionKeys.size,
    projectedDocuments: seen.size,
  });
  return stubs;
}

export function buildEditableOptionImageSettings(productProposal) {
  const modelGroup = productProposal.optionGroups.find((group) => group.key === "folder_model");
  assert(modelGroup, "Consolidated product proposal has no folder_model group");
  const manifestProjection = modelGroup.assetManifest?.backendProjection;
  assert(manifestProjection, "Consolidated folder_model group has no verified backend icon projection");
  return {
    schemaVersion: 1,
    state: "local_icon_manifest_verified_backend_roundtrip_pending",
    catalogScope: productProposal.catalogScope,
    optionGroupKey: "folder_model",
    storageModel: "matrix_layout_v1",
    assetManifest: modelGroup.assetManifest,
    backendOwnedFields: {
      order: manifestProjection.orderField,
      image: manifestProjection.imageField,
      showImage: "pricing_structure.layout_rows[].columns[].valueSettings[valueId].showThumbnail",
      groupSize: "pricing_structure.layout_rows[].columns[].thumbnail_custom_px",
      perValueSize: "pricing_structure.layout_rows[].columns[].valueSettings[valueId].imageSizePx",
    },
    groupSettings: {
      ui_mode: "xl",
      thumbnail_size: "xl",
      thumbnail_custom_px: manifestProjection.recommendedSizePx,
      neutralWhiteSurface: true,
      neutral_white_surface: true,
      selectorStyling: {
        pictureButtons: {
          size: "xl",
          displayMode: "text_below_image",
          transparentBackground: true,
          labelOutsideImage: true,
          backgroundColor: "#FFFFFF",
        },
      },
      savedBackendPictureTakesPrecedence: manifestProjection.savedBackendImageTakesPrecedence,
      visualOnlySaveRequired: true,
    },
    productHero: {
      ...productProposal.visualAssets.productHero,
      purpose: "Verified local review-only product hero; it must not replace the distinct editable model images or be published by this package.",
    },
    values: modelGroup.values.map((value) => ({
      optionKey: value.key,
      initialOrder: value.sourceOrder,
      sourceAsset: {
        ...value.icon.svg,
        assetVersion: value.icon.assetVersion,
        palette: value.icon.palette,
        state: value.icon.assetState,
      },
      proposedBackendSettingsAfterApprovedAssetResolution: {
        showThumbnail: true,
        customImage: null,
        customImageSha256: value.icon.svg.sha256,
        customImageAssetVersion: value.icon.assetVersion,
        imageSizePx: manifestProjection.recommendedSizePx,
        displayName: value.labelDa,
        accessibleNameDa: value.icon.accessibleNameDa,
        requiredCustomImageResolution: {
          sourceRepoAssetPath: value.icon.svg.repoAssetPath,
          publicUrl: null,
          status: "approved_product_draft_asset_publish_pending",
          rule: "Never write a repo path to customImage; resolve an approved, browser-fetchable public URL and verify its bytes against customImageSha256 first.",
        },
      },
      provenance: value.icon.provenance,
    })),
    requiredProductDraftProof: {
      publishEachHashedSvgToApprovedPublicAssetStorage: "pending",
      replaceRepoPathWithResolvedPublicCustomImageUrl: "pending",
      publicAssetBytesMatchReviewedSha256: "pending",
      replaceOnePicture: "pending",
      changeSupportedSize: "pending",
      reorderTwoValues: "pending",
      storefrontReflectsChanges: "pending",
      priceTemplateVisibilityAndPublicationFingerprintsUnchanged: "pending",
      reviewedSettingsRestored: "pending",
    },
  };
}

function markdownReport({ summary, productProposal, compatibility, proposedPriceRows, templateStubs }) {
  const group = (key) => productProposal.optionGroups.find((item) => item.key === key);
  const quantities = [...new Set(proposedPriceRows.map((row) => row.quantity))].sort((a, b) => a - b);
  const scope = productProposal.catalogScope;
  const exclusionLines = asArray(scope?.excludedModels).map((entry) =>
    `- \`${entry.modelKey}\`: ${entry.reasonDa} `
      + `Udeladt: ${entry.excludedCounts.sourceProducts.toLocaleString("da-DK")} kildesider, `
      + `${entry.excludedCounts.priceRows.toLocaleString("da-DK")} prisrækker, `
      + `${entry.excludedCounts.documentBindings.toLocaleString("da-DK")} dokumentbindinger og `
      + `${entry.excludedCounts.folderModelIcons.toLocaleString("da-DK")} modelikon.`
  ).join("\n");
  return `# Lokal review: Salgsmapper med eget design

## Status

- Forslag: én samlet, upubliceret vare med slug \`${PRODUCT_SLUG}\`.
- Råt kildeudtræk: ${summary.successfulProducts}/${summary.catalogProducts} sider gennemført uden fejl og bevaret uændret.
- Foreslået produktscope: ${scope.counts.proposed.sourceProducts.toLocaleString("da-DK")} kildesider og ${scope.counts.proposed.folderModels.toLocaleString("da-DK")} mappemodeller.
- Prisrækker: ${proposedPriceRows.length.toLocaleString("da-DK")} eksakte rækker; ingen interpolation.
- Kompatible konfigurationer: ${compatibility.length.toLocaleString("da-DK")}.
- Dokumentsammenkoblinger: ${templateStubs.length.toLocaleString("da-DK")} kildepar med datablad og trykskabelon.
- Importklar: nej. Der er ikke skrevet til Supplier Bank, produkt, priser, skabeloner eller publicering.

## Bevidste fravalg

${exclusionLines}

Fravalget gælder kun de afledte produkt- og reviewfiler. Rå leverandørdata er bevaret som revisionsbevis og er ikke ændret.

## Foreslået valgflow

1. Mappemodel (${group("folder_model").values.length} modeller)
2. Tryk (${group("print").values.map((value) => value.labelDa).join("; ")})
3. Rygbredde (${group("spine").values.map((value) => value.labelDa).join("; ")})
4. Papir og karton (${group("paper").values.length} valg)
5. Efterbehandling (${group("finish").values.length} valg)

Oplag går fra ${quantities[0].toLocaleString("da-DK")} til ${quantities.at(-1).toLocaleString("da-DK")} stk., men hvert valg viser kun de oplag og priser, som findes i det dokumenterede udtræk.

## Billeder og backend-redigering

Alle ${group("folder_model").assetManifest.modelCount} mappemodeller er bundet til den versionsstyrede SVG-manifest \`${group("folder_model").assetManifest.repoAssetPath}\`. Hver SVG-fil er kontrolleret mod sin SHA-256, filmetadata, sikre vektorelementer, transparent baggrund, Webprinter-blå/grå palette og manifest-rækkefølge. Leverandørbillederne er kun bevaret som strukturel kildeproveniens og bruges ikke som de foreslåede ikoner. Repo-stierne er kildeproveniens, ikke browser-URL'er: ved en senere godkendt produktkladde skal hver fil publiceres til godkendt asset-lager, dens offentlige bytes kontrolleres mod SHA-256, og først derefter må URL'en gemmes i \`customImage\`.

Produkthelten \`${productProposal.visualAssets.productHero.repoAssetPath}\` er lokalt verificeret som en ${productProposal.visualAssets.productHero.widthPx} × ${productProposal.visualAssets.productHero.heightPx} px RGBA-PNG med SHA-256 \`${productProposal.visualAssets.productHero.sha256}\`. Den er fortsat review-only og er ikke uploadet eller publiceret.

## PDF og Designer

Hver prissat konfiguration er bundet til præcis ét udtrukket datablad og én udtrukket trykskabelon. Kilde-PDF'erne er ikke i dette trin erklæret korrekte, rensede eller Designer-klare. Download, sidebokse, mål, vektorgeometri, lag, dansk tegnforklaring, Webprinter-blå informationsfelter, tekstplacering og en virkelig ikke-printende Designer-overlay skal alle bestå separat.

## Afgrænsning

Det særskilte rå kildeinventar \`${productProposal.addOns.sourceArtifact}\` er indholdsmæssigt afstemt med ${productProposal.addOns.bindingCount.toLocaleString("da-DK")} dokumentbindinger, ${productProposal.addOns.optionFieldCount.toLocaleString("da-DK")} tilbehørsfelter og ${productProposal.addOns.choiceCount.toLocaleString("da-DK")} leverandørvalg. Inventaret er kun revisionsbevis: det er ikke projiceret til valgbare tilbehørsfelter, produktkonfigurationer eller priser. Kildebeviset er uændret, og de eksplicitte fravalg er registreret i \`review/proposed-catalog-scope.json\`. Næste mulige mutation er kun en særskilt godkendt Supplier Bank-skrivning efter samlet review; produktkladde, prisimport, skabelonoprettelse og publicering har hver sin senere godkendelse.
`;
}

export function buildMutationPlan({ summary, templateStubs, productProposal }) {
  const modelGroup = productProposal.optionGroups.find((group) => group.key === "folder_model");
  return {
    schemaVersion: 1,
    currentState: "extracted_local_review",
    catalogScope: productProposal.catalogScope,
    sourceExtractionEligibleForReview: summary.eligibleForReview === true,
    eligibleForImport: false,
    performedMutations: {
      supplierBankWritten: false,
      productCreatedOrUpdated: false,
      pricingWritten: false,
      templateRecordsWritten: false,
      filesUploaded: false,
      published: false,
    },
    verifiedLocalVisualAssets: {
      manifestPath: modelGroup.assetManifest.repoAssetPath,
      manifestSha256: modelGroup.assetManifest.sha256,
      assetVersion: modelGroup.assetManifest.assetVersion,
      modelCount: modelGroup.assetManifest.modelCount,
      backendProjection: modelGroup.assetManifest.backendProjection,
      backendRoundtripStatus: "pending_until_approved_product_draft_exists",
      publicCustomImageResolutionStatus: "pending_approved_asset_publish_and_hash_verified_public_urls",
      productHero: productProposal.visualAssets.productHero,
    },
    pendingBeforeSupplierBankApprovalRequest: [
      `${templateStubs.length} source document bindings must complete PDF download, structural inspection, sanitization, and rendered review`,
      "The canonical import-manifest.json must be assembled and pass the tracked validator after reviewed PDF hashes exist",
    ],
    approvalGates: [
      {
        state: "bank_draft",
        status: "not_approved",
        exactScope: "Write the reviewed supplier snapshot and normalized rows to Supplier Bank only",
      },
      {
        state: "product_draft",
        status: "blocked_until_separate_explicit_approval",
        exactScope: "Create one unpublished Webprinter draft and its backend-owned options, prices, and template links",
      },
      {
        state: "published",
        status: "blocked_until_separate_explicit_approval",
        exactScope: "Publish the product and make live pricing available",
      },
    ],
    stopAt: "supplier_bank_approval",
    rollback: "No rollback is required because this review builder performs local artifact writes only.",
  };
}

function buildStatus({
  summary,
  compatibility,
  proposedPriceRows,
  templateStubs,
  productProposal,
  outputs,
  inputFingerprints,
  outputFingerprints,
  generationId,
}) {
  const iconManifest = productProposal.optionGroups.find((group) => group.key === "folder_model").assetManifest;
  return {
    schemaVersion: 1,
    scriptVersion: SCRIPT_VERSION,
    state: "local_consolidated_review_built",
    generationId,
    productSlug: PRODUCT_SLUG,
    sourceCategoryUrl: SOURCE_ENTRY_URL,
    sourceExtractionEligibleForReview: true,
    eligibleForImport: false,
    catalogScope: productProposal.catalogScope,
    counts: {
      rawSourceProducts: summary.successfulProducts,
      sourceProducts: productProposal.catalogScope.counts.proposed.sourceProducts,
      excludedSourceProducts: productProposal.catalogScope.counts.excluded.sourceProducts,
      proposedPriceRows: proposedPriceRows.length,
      exactSparseCombinations: compatibility.length,
      templateProjectionStubs: templateStubs.length,
      verifiedFolderModelIcons: iconManifest.modelCount,
      verifiedAddOnInventoryBindings: productProposal.addOns.bindingCount,
      verifiedAddOnOptionFields: productProposal.addOns.optionFieldCount,
      verifiedAddOnChoices: productProposal.addOns.choiceCount,
      resolvedMissingAddOnSupplierLabels: productProposal.addOns.resolvedMissingSupplierLabelCount,
      resolvedAddOnSupplierLabelIdentities: productProposal.addOns.resolvedSupplierLabelIdentityCount,
      rawResolvedMissingAddOnSupplierLabels: productProposal.addOns.rawResolvedMissingSupplierLabelCount,
      rawResolvedAddOnSupplierLabelIdentities: productProposal.addOns.rawResolvedSupplierLabelIdentityCount,
      excludedAddOnSupplierLabelIdentities: productProposal.addOns.excludedResolvedSupplierLabelIdentityCount,
      proposedSelectableAddOnOptions: productProposal.addOns.proposedSelectableOptionCount,
    },
    verifiedIconManifest: {
      repoAssetPath: iconManifest.repoAssetPath,
      sha256: iconManifest.sha256,
      assetVersion: iconManifest.assetVersion,
      backendProjection: iconManifest.backendProjection,
    },
    verifiedProductHero: productProposal.visualAssets.productHero,
    noInterpolation: true,
    externalMutationsPerformed: false,
    outputs,
    inputFingerprints,
    outputFingerprints,
  };
}

export async function buildReviewPackage({
  runDirectory,
  iconManifestPath = DEFAULT_ICON_MANIFEST_PATH,
  iconAssetRootDirectory = REPO_ROOT,
  requiredIconPathPrefix = DEFAULT_ICON_PATH_PREFIX,
  heroAssetPath = DEFAULT_HERO_PATH,
  heroAssetRootDirectory = REPO_ROOT,
  requiredHeroRepoAssetPath = DEFAULT_HERO_REPO_PATH,
  expectedHeroSha256 = DEFAULT_HERO_SHA256,
  catalogProfile = FULL_CATALOG_PROFILE,
}) {
  const resolvedRunDirectory = path.resolve(runDirectory);
  const files = {
    discovery: "discovery.json",
    summary: "review/extraction-summary.json",
    coverage: "normalized/coverage.json",
    options: "normalized/options.json",
    pricing: "normalized/pricing-preview.jsonl",
    documents: "raw/document-bindings.jsonl",
    catalog: "raw/catalog.json",
    rawPricing: "raw/pricing.jsonl",
    additionalOptions: "raw/additional-option-bindings.jsonl",
    apiEvidence: "raw/api-evidence.jsonl",
    materialEvidence: "raw/material-evidence.jsonl",
    pageSnapshots: "raw/page-snapshots.jsonl",
    retryFailures: "raw/retry-failures.jsonl",
    evidenceAudit: "review/evidence-audit.json",
  };
  const inputPaths = Object.values(files);
  await assertExtractorIdle(resolvedRunDirectory, "initial review gate");
  const reviewDirectory = path.join(resolvedRunDirectory, "review");
  await fs.mkdir(reviewDirectory, { recursive: true });
  const lockPath = path.join(reviewDirectory, ".consolidated-review-builder.lock");
  let lockHandle;
  try {
    lockHandle = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new SalesFolderReviewError(`Another consolidated review build is active: ${lockPath}`);
    }
    throw error;
  }

  const generationId = randomUUID();
  const sharedRunLockPath = path.join(resolvedRunDirectory, ".extractor.lock");
  let sharedRunLockHandle;
  try {
    sharedRunLockHandle = await fs.open(sharedRunLockPath, "wx");
    await sharedRunLockHandle.writeFile(`${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      role: "consolidated_review_builder",
      token: generationId,
      readOnly: true,
    })}\n`);
  } catch (error) {
    await sharedRunLockHandle?.close().catch(() => {});
    if (sharedRunLockHandle) await fs.unlink(sharedRunLockPath).catch(() => {});
    await lockHandle.close().catch(() => {});
    await fs.unlink(lockPath).catch(() => {});
    if (error?.code === "EEXIST") {
      throw new SalesFolderReviewError(`The extractor started before the review builder could lock this run: ${sharedRunLockPath}`);
    }
    throw error;
  }
  let stagingDirectory = null;

  try {
    await assertSharedRunLockOwned(sharedRunLockPath, generationId, "input snapshot");
    const inputFingerprints = await artifactFingerprints(resolvedRunDirectory, inputPaths);
    const snapshots = await Promise.all([
      readJson(path.join(resolvedRunDirectory, files.discovery), files.discovery),
      readJson(path.join(resolvedRunDirectory, files.summary), files.summary),
      readJson(path.join(resolvedRunDirectory, files.coverage), files.coverage),
      readJson(path.join(resolvedRunDirectory, files.options), files.options),
      readJsonl(path.join(resolvedRunDirectory, files.pricing), files.pricing, compactPricingRow),
      readJsonlReduce(
        path.join(resolvedRunDirectory, files.rawPricing),
        files.rawPricing,
        createRawPricingIndex(),
        indexRawPricingEvidence
      ),
      readJsonl(
        path.join(resolvedRunDirectory, files.apiEvidence),
        files.apiEvidence,
        (row) => sha256Buffer(canonicalJson(row))
      ),
      readJsonl(path.join(resolvedRunDirectory, files.documents), files.documents, compactDocumentBinding),
      readJsonl(path.join(resolvedRunDirectory, files.additionalOptions), files.additionalOptions),
      readJson(path.join(resolvedRunDirectory, files.catalog), files.catalog),
      readJsonl(path.join(resolvedRunDirectory, files.retryFailures), files.retryFailures),
      readJson(path.join(resolvedRunDirectory, files.evidenceAudit), files.evidenceAudit),
    ]);
    const [
      discoverySnapshot,
      summarySnapshot,
      coverageSnapshot,
      optionsSnapshot,
      pricingSnapshot,
      rawPricingSnapshot,
      apiEvidenceSnapshot,
      documentSnapshot,
      additionalOptionSnapshot,
      catalogSnapshot,
      retryFailureSnapshot,
      evidenceAuditSnapshot,
    ] = snapshots;
    const fingerprintsByPath = new Map(inputFingerprints.map((item) => [item.path, item]));
    for (const snapshot of snapshots) {
      assertFingerprintsUnchanged(
        [fingerprintsByPath.get(snapshot.fingerprint.path)],
        [snapshot.fingerprint],
        `Exact read of ${snapshot.fingerprint.path}`
      );
    }

    const discovery = discoverySnapshot.value;
    const summary = summarySnapshot.value;
    const coverage = coverageSnapshot.value;
    const options = optionsSnapshot.value;
    const pricingRows = pricingSnapshot.value;
    const rawPricingIndex = rawPricingSnapshot.value;
    const apiEvidenceFingerprints = apiEvidenceSnapshot.value;
    const documentBindings = documentSnapshot.value;
    const additionalOptionBindings = additionalOptionSnapshot.value;
    const catalog = compactCatalog(catalogSnapshot.value);
    const retryFailures = retryFailureSnapshot.value;
    const evidenceAudit = evidenceAuditSnapshot.value;
    assert(discovery?.sourceCategoryUrl === SOURCE_ENTRY_URL, "Discovery source category does not match the reviewed sales-folder category");
    assert(summary.sourceCategoryUrl === SOURCE_ENTRY_URL, "Extraction summary source category does not match the reviewed sales-folder category");
    assert(retryFailures.length === 0, "Raw retry-failure evidence is not empty");
    const rawPricingValidation = validateRawPricingIndex({
      rawPricingIndex,
      normalizedPricingRows: pricingRows,
      apiEvidenceFingerprints,
      coverage,
    });
    assert(rawPricingValidation.rawPriceRows === summary.rawPriceRows, "Summary raw-price count does not match verified raw evidence");
    assert(rawPricingValidation.regeneratedNormalizedRows === summary.normalizedPriceRows, "Summary normalized-price count does not match deterministic raw regeneration");
    rawPricingIndex.rowHashesBySelectionKey.clear();
    rawPricingIndex.uniqueSelections.clear();
    for (const values of Object.values(rawPricingIndex.dimensionValues)) values.clear();
    rawPricingIndex.expectedApiFingerprints.length = 0;
    validateAdditionalOptionProjection({
      documentBindings,
      additionalOptionBindings,
      summary,
    });
    validateExtractionGate({ summary, coverage, options, pricingRows, documentBindings, catalog, evidenceAudit });

    const expectedIconModels = optionGroupValues({ options, pricingRows, documentBindings, catalog }).models;
    validateCompleteCatalogProfile({ summary, options, models: expectedIconModels, profile: catalogProfile });
    const [sourceIconManifest, heroAsset] = await Promise.all([
      loadAndValidateIconManifest({
        manifestPath: iconManifestPath,
        assetRootDirectory: iconAssetRootDirectory,
        requiredPathPrefix: requiredIconPathPrefix,
        expectedModels: expectedIconModels,
      }),
      loadAndValidateHeroAsset({
        assetPath: heroAssetPath,
        assetRootDirectory: heroAssetRootDirectory,
        requiredRepoAssetPath: requiredHeroRepoAssetPath,
        expectedSha256: expectedHeroSha256,
      }),
    ]);
    const scoped = applyProposedCatalogScope({
      pricingRows,
      documentBindings,
      additionalOptionBindings,
      catalog,
      iconManifest: sourceIconManifest,
      requiredSourceModelKeys: catalogProfile.modelKeys,
    });
    const additionalOptionReview = validateAdditionalOptionProjection({
      documentBindings: scoped.documentBindings,
      additionalOptionBindings: scoped.additionalOptionBindings,
      summary,
    });
    const productProposal = buildConsolidatedProductProposal({
      options,
      pricingRows: scoped.pricingRows,
      documentBindings: scoped.documentBindings,
      catalog: scoped.catalog,
      iconManifest: scoped.iconManifest,
      heroAsset,
      additionalOptionReview,
      catalogScope: scoped.scope,
    });
    const proposedPriceRows = buildProposedPriceRows(scoped.pricingRows);
    const compatibility = buildCompatibility(proposedPriceRows);
    const pricingStructure = buildPricingStructure({ productProposal, compatibility, proposedPriceRows });
    const templateStubs = buildTemplateProjectionStubs({
      documentBindings: scoped.documentBindings,
      proposedPriceRows,
    });
    const imageSettings = buildEditableOptionImageSettings(productProposal);
    const mutationPlan = buildMutationPlan({ summary, templateStubs, productProposal });

    const outputRelativePaths = {
      productProposal: "review/consolidated-product-proposal.json",
      pricingStructure: "review/proposed-pricing-structure.json",
      priceRows: "review/proposed-price-rows.jsonl",
      compatibility: "review/proposed-compatibility.json",
      templateProjections: "review/template-projection-stubs.jsonl",
      editableImages: "review/editable-option-image-settings.json",
      mutationPlan: "review/mutation-plan.json",
      catalogScope: "review/proposed-catalog-scope.json",
      report: "review/consolidated-product-report.md",
      status: "review/consolidated-review-status.json",
    };

    stagingDirectory = path.join(reviewDirectory, `.consolidated-review-${generationId}.staging`);
    await fs.mkdir(stagingDirectory);
    const stagedPath = (key) => path.join(stagingDirectory, path.basename(outputRelativePaths[key]));
    await writeJson(stagedPath("productProposal"), productProposal);
    await writeJson(stagedPath("pricingStructure"), pricingStructure);
    await writeJsonl(stagedPath("priceRows"), proposedPriceRows);
    await writeJson(stagedPath("compatibility"), {
      schemaVersion: 1,
      sparse: true,
      interpolationAllowed: false,
      catalogScope: scoped.scope,
      combinations: compatibility,
    });
    await writeJsonl(stagedPath("templateProjections"), templateStubs);
    await writeJson(stagedPath("editableImages"), imageSettings);
    await writeJson(stagedPath("mutationPlan"), mutationPlan);
    await writeJson(stagedPath("catalogScope"), scoped.scope);
    await writeAtomic(
      stagedPath("report"),
      markdownReport({ summary, productProposal, compatibility, proposedPriceRows, templateStubs })
    );
    const outputFingerprints = [];
    for (const [key, relativePath] of Object.entries(outputRelativePaths)) {
      if (key === "status") continue;
      const fingerprint = await artifactFingerprint(stagingDirectory, path.basename(relativePath));
      outputFingerprints.push({ ...fingerprint, path: relativePath });
    }
    const status = buildStatus({
      summary,
      compatibility,
      proposedPriceRows,
      templateStubs,
      productProposal,
      outputs: outputRelativePaths,
      inputFingerprints,
      outputFingerprints,
      generationId,
    });
    await writeJson(stagedPath("status"), status);

    const finalInputFingerprints = await artifactFingerprints(resolvedRunDirectory, inputPaths);
    assertFingerprintsUnchanged(inputFingerprints, finalInputFingerprints);
    await assertSharedRunLockOwned(sharedRunLockPath, generationId, "staged output gate");

    const finalStatusPath = path.join(resolvedRunDirectory, outputRelativePaths.status);
    await fs.unlink(finalStatusPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    for (const [key, relativePath] of Object.entries(outputRelativePaths)) {
      if (key === "status") continue;
      await fs.rename(stagedPath(key), path.join(resolvedRunDirectory, relativePath));
    }
    await assertSharedRunLockOwned(sharedRunLockPath, generationId, "status commit gate");
    await fs.rename(stagedPath("status"), finalStatusPath);
    try {
      await assertSharedRunLockOwned(sharedRunLockPath, generationId, "completed output generation");
    } catch (error) {
      await fs.unlink(finalStatusPath).catch(() => {});
      throw error;
    }
    return {
      runDirectory: resolvedRunDirectory,
      status,
      paths: Object.fromEntries(Object.entries(outputRelativePaths).map(([key, value]) => [
        key,
        path.join(resolvedRunDirectory, value),
      ])),
    };
  } finally {
    if (stagingDirectory) await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
    await releaseOwnedSharedRunLock(sharedRunLockHandle, sharedRunLockPath, generationId);
    await lockHandle.close().catch(() => {});
    await fs.unlink(lockPath).catch(() => {});
  }
}

function parseArgs(argv) {
  const args = { runDirectory: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--run") args.runDirectory = argv[++index];
    else if (token === "--help") {
      console.log([
        "Usage: node scripts/product-import/build-wmd-sales-folder-review.js --run DIR",
        "",
        "Builds local review artifacts only. It has no Supplier Bank, product, price, upload, template-record, or publishing write path.",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new SalesFolderReviewError(`Unknown argument: ${token}`);
    }
  }
  assert(args.runDirectory, "--run DIR is required");
  return args;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  buildReviewPackage({ runDirectory: args.runDirectory })
    .then((result) => {
      console.log(`Local consolidated review built: ${result.runDirectory}`);
      console.log(`Product proposal: ${result.paths.productProposal}`);
      console.log(`Exact price rows: ${result.status.counts.proposedPriceRows}`);
      console.log(`Template projection stubs: ${result.status.counts.templateProjectionStubs}`);
      console.log("External writes: none");
      console.log("Import-ready: no");
    })
    .catch((error) => {
      console.error(`Error: ${error.message}`);
      if (error.details) console.error(JSON.stringify(error.details));
      process.exitCode = 1;
    });
}
