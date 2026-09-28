#!/usr/bin/env node

/**
 * Build a deterministic, local-only storefront review for the consolidated
 * WIRmachenDRUCK sales-folder package. This script has no network, database,
 * upload, product-write, price-write, or publication path.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_VERSION = 2;
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPO_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);
const AXIS_ORDER = Object.freeze(["folder_model", "print", "spine", "paper", "finish"]);
const EXPECTED_AXIS_VALUES = Object.freeze({
  print: Object.freeze(["4+0", "4+4"]),
  spine: Object.freeze(["1mm", "3mm", "5mm", "10mm"]),
  paper: Object.freeze([
    "chromo-mappekarton",
    "matt-billedtrykskarton",
    "hoejhvid-naturkarton",
    "hvid-genbrugskarton",
  ]),
  finish: Object.freeze([
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
const PROFESSIONAL_PDF_ONLY_FINISHES = new Set([
  "partial-uv",
  "soft-touch-partial-uv",
  "hot-foil-gold",
  "hot-foil-silver",
  "blind-emboss",
]);
const PROFESSIONAL_PDF_REASON_DA =
  "Denne efterbehandling kræver en separat staffagefarve med korrekte overprint-indstillinger. Brug den præcise skabelon og upload en færdig professionel tryk-PDF.";
const ONLINE_DESIGNER_REASON_DA =
  "Den valgte efterbehandling kræver ikke en separat staffagemaske og kan derfor fortsætte til Webprinter Designer, når produktudkastet senere er godkendt og oprettet.";

export class SalesFolderStorefrontProposalError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "SalesFolderStorefrontProposalError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new SalesFolderStorefrontProposalError(message, details);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJsonForInlineScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function stableSelectionKey(selection) {
  return AXIS_ORDER
    .map((axis) => `${axis}=${encodeURIComponent(String(selection?.[axis] ?? ""))}`)
    .join("|");
}

function exactPriceKey(selectionKey, quantity) {
  return `${selectionKey}|quantity=${Number(quantity)}`;
}

export function resolveClosestExactCombination(
  combinations,
  axisOrder,
  currentSelection,
  requestedAxis,
  requestedValue
) {
  if (!Array.isArray(combinations) || !Array.isArray(axisOrder)) return null;
  const requestedIndex = axisOrder.indexOf(requestedAxis);
  if (requestedIndex < 0) return null;

  const modelIndex = axisOrder.indexOf("folder_model");
  const currentModel = modelIndex >= 0 ? currentSelection?.folder_model : null;
  let bestCombination = null;
  let bestChangedCount = Number.POSITIVE_INFINITY;
  let bestPreservation = null;

  for (const combination of combinations) {
    if (!Array.isArray(combination) || combination[requestedIndex] !== requestedValue) continue;
    if (
      requestedAxis !== "folder_model"
      && currentModel != null
      && combination[modelIndex] !== currentModel
    ) {
      continue;
    }

    let changedCount = 0;
    const preservation = [];
    axisOrder.forEach((axis, axisIndex) => {
      if (axisIndex === requestedIndex || currentSelection?.[axis] == null) return;
      const preserved = combination[axisIndex] === currentSelection[axis];
      preservation.push(preserved ? 1 : 0);
      if (!preserved) changedCount += 1;
    });

    let preferred = bestCombination == null || changedCount < bestChangedCount;
    if (!preferred && changedCount === bestChangedCount) {
      for (let index = 0; index < preservation.length; index += 1) {
        const current = preservation[index];
        const previous = bestPreservation[index];
        if (current === previous) continue;
        preferred = current > previous;
        break;
      }
    }
    if (!preferred) continue;

    bestCombination = combination;
    bestChangedCount = changedCount;
    bestPreservation = preservation;
  }

  return bestCombination;
}

function valuesInSourceOrder(group) {
  const values = asArray(group?.values);
  values.forEach((value, index) => {
    assert(value?.sourceOrder === index, `${group?.key || "Option"} values are not in exact source order`, {
      key: value?.key,
      expectedSourceOrder: index,
      actualSourceOrder: value?.sourceOrder,
    });
  });
  return values;
}

function assertExactKeys(actual, expected, label) {
  assert(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `${label} must remain in the reviewed order`,
    { expected, actual }
  );
}

function validateProposal(proposal) {
  assert(proposal?.schemaVersion === 1, "Consolidated proposal schemaVersion must be 1");
  assert(proposal?.state === "local_review_only", "Consolidated proposal must remain local review only");
  assert(proposal?.status?.productCreated === false, "Review cannot represent a created product");
  assert(proposal?.status?.pricesWritten === false, "Review cannot represent written prices");
  assert(proposal?.status?.templatesWritten === false, "Review cannot represent written templates");
  assert(proposal?.status?.published === false, "Review cannot represent a published product");
  assert(proposal?.proposedProduct?.isPublished === false, "Proposed product must remain unpublished");
  assertExactKeys(asArray(proposal?.axisOrder), AXIS_ORDER, "Customer-flow axes");

  const groups = new Map(asArray(proposal?.optionGroups).map((group) => [group?.key, group]));
  assert(groups.size === AXIS_ORDER.length, "Proposal must contain exactly the five reviewed option groups");
  for (const axis of AXIS_ORDER) assert(groups.has(axis), `Proposal is missing option group ${axis}`);

  const normalizedGroups = {};
  for (const axis of AXIS_ORDER) {
    const group = groups.get(axis);
    const values = valuesInSourceOrder(group);
    assert(values.length > 0, `${axis} contains no values`);
    assert(new Set(values.map((value) => value?.key)).size === values.length, `${axis} contains duplicate keys`);
    normalizedGroups[axis] = {
      key: axis,
      labelDa: String(group?.labelDa || axis),
      values,
    };
  }

  const scope = proposal?.catalogScope;
  if (scope) {
    assert(scope?.rawSupplierEvidenceMutated === false, "Catalog scope must preserve raw supplier evidence");
    assert(
      normalizedGroups.folder_model.values.length === scope?.counts?.proposed?.folderModels,
      "Visible folder-model count does not match the explicit proposed catalog scope"
    );
    const visibleKeys = new Set(normalizedGroups.folder_model.values.map((value) => value.key));
    for (const exclusion of asArray(scope?.excludedModels)) {
      assert(
        !visibleKeys.has(exclusion?.modelKey),
        `Explicitly excluded folder model is still visible: ${exclusion?.modelKey}`
      );
    }
  } else {
    assert(normalizedGroups.folder_model.values.length === 21, "Legacy review must contain all 21 folder models");
  }
  for (const [axis, expected] of Object.entries(EXPECTED_AXIS_VALUES)) {
    assertExactKeys(normalizedGroups[axis].values.map((value) => value.key), expected, axis);
  }

  const hero = proposal?.visualAssets?.productHero;
  assert(hero?.repoAssetPath, "Proposal is missing the Webprinter sales-folder hero");
  assert(hero?.published === false, "Review hero must remain unpublished");
  for (const model of normalizedGroups.folder_model.values) {
    assert(model?.icon?.svg?.repoAssetPath, `Folder model ${model?.key} is missing its local SVG`);
  }

  return normalizedGroups;
}

function validateCompatibility(compatibility, groups) {
  assert(compatibility?.schemaVersion === 1, "Compatibility schemaVersion must be 1");
  assert(compatibility?.sparse === true, "Compatibility must remain sparse");
  assert(compatibility?.interpolationAllowed === false, "Price interpolation must remain disabled");

  const combinations = asArray(compatibility?.combinations);
  assert(combinations.length > 0, "Compatibility contains no exact combinations");
  const allowedByAxis = Object.fromEntries(
    AXIS_ORDER.map((axis) => [axis, new Set(groups[axis].values.map((value) => value.key))])
  );
  const combinationSlots = new Map();
  const modelCoverage = new Set();
  let expectedPriceRowCount = 0;

  for (const [index, combination] of combinations.entries()) {
    const selection = combination?.selections;
    for (const axis of AXIS_ORDER) {
      assert(
        allowedByAxis[axis].has(selection?.[axis]),
        `Compatibility row ${index} contains an unknown ${axis} value`,
        { value: selection?.[axis] }
      );
    }
    const selectionKey = stableSelectionKey(selection);
    assert(combination?.selectionKey === selectionKey, `Compatibility row ${index} has a non-canonical key`);
    assert(!combinationSlots.has(selectionKey), `Compatibility contains duplicate combination ${selectionKey}`);

    const quantities = asArray(combination?.quantities).map(Number);
    assert(quantities.length > 0, `Compatibility combination ${selectionKey} has no quantities`);
    assert(
      quantities.every((quantity) => Number.isInteger(quantity) && quantity > 0),
      `Compatibility combination ${selectionKey} contains an invalid quantity`
    );
    assert(new Set(quantities).size === quantities.length, `Compatibility combination ${selectionKey} has duplicate quantities`);
    assert(
      quantities.every((quantity, quantityIndex) => quantityIndex === 0 || quantity > quantities[quantityIndex - 1]),
      `Compatibility quantities are not strictly increasing for ${selectionKey}`
    );

    combinationSlots.set(selectionKey, {
      selection,
      quantities,
      expectedQuantities: new Set(quantities),
      prices: new Map(),
    });
    expectedPriceRowCount += quantities.length;
    modelCoverage.add(selection.folder_model);
  }

  assert(
    modelCoverage.size === groups.folder_model.values.length,
    "Compatibility does not cover every visible folder model",
    { expected: groups.folder_model.values.length, actual: modelCoverage.size }
  );

  return { combinations, combinationSlots, expectedPriceRowCount };
}

function ingestExactPriceRow(state, row, index) {
  assert(row && typeof row === "object" && !Array.isArray(row), `Price row ${index} is not an object`);
  assert(row?.noInterpolation === true, `Price row ${index} does not explicitly prohibit interpolation`);
  const selectionKey = stableSelectionKey(row?.selections);
  const slot = state.combinationSlots.get(selectionKey);
  assert(slot, `Price row ${index} is outside sparse compatibility`, { selectionKey });
  const quantity = Number(row?.quantity);
  assert(
    Number.isInteger(quantity) && slot.expectedQuantities.has(quantity),
    `Price row ${index} uses an unavailable exact quantity`,
    { selectionKey, quantity }
  );
  assert(
    row?.proposedSelectionKey === exactPriceKey(selectionKey, quantity),
    `Price row ${index} has a non-canonical selection key`
  );
  const priceDkk = Number(row?.finalPriceDkk);
  assert(Number.isInteger(priceDkk) && priceDkk > 0, `Price row ${index} has an invalid final DKK price`);
  assert(!slot.prices.has(quantity), `Duplicate exact price row for ${selectionKey}, quantity ${quantity}`);
  slot.prices.set(quantity, priceDkk);
  state.actualPriceRowCount += 1;
}

function finalizeDataset({ proposal, groups, compatibilityState, assetHrefs, inputFingerprints = null }) {
  assert(
    compatibilityState.actualPriceRowCount === compatibilityState.expectedPriceRowCount,
    "Exact price-row count does not match compatibility",
    {
      expected: compatibilityState.expectedPriceRowCount,
      actual: compatibilityState.actualPriceRowCount,
    }
  );

  const compactCombinations = compatibilityState.combinations.map((combination) => {
    const slot = compatibilityState.combinationSlots.get(combination.selectionKey);
    const exactPrices = slot.quantities.map((quantity) => {
      assert(slot.prices.has(quantity), `Missing exact price for ${combination.selectionKey}, quantity ${quantity}`);
      return [quantity, slot.prices.get(quantity)];
    });
    assert(slot.prices.size === slot.quantities.length, `Unexpected price count for ${combination.selectionKey}`);
    return [
      ...AXIS_ORDER.map((axis) => combination.selections[axis]),
      exactPrices,
    ];
  });

  const optionGroups = Object.fromEntries(
    AXIS_ORDER.map((axis) => [
      axis,
      {
        key: axis,
        labelDa: groups[axis].labelDa,
        values: groups[axis].values.map((value) => {
          const normalized = {
            key: value.key,
            labelDa: String(value.labelDa || value.key),
            sourceOrder: value.sourceOrder,
          };
          if (axis === "folder_model") {
            normalized.widthMm = Number(value.widthMm);
            normalized.heightMm = Number(value.heightMm);
            normalized.iconHref = assetHrefs[value.icon.svg.repoAssetPath];
            normalized.accessibleNameDa = String(value.icon.accessibleNameDa || `Illustration af ${normalized.labelDa}`);
          }
          if (axis === "finish") {
            const uploadOnly = PROFESSIONAL_PDF_ONLY_FINISHES.has(value.key);
            normalized.artworkMode = uploadOnly ? "professional_pdf_upload_only" : "online_designer";
            normalized.artworkModeLabelDa = uploadOnly ? "Professionel PDF-upload" : "Online Designer";
            normalized.artworkModeReasonDa = uploadOnly
              ? PROFESSIONAL_PDF_REASON_DA
              : ONLINE_DESIGNER_REASON_DA;
          }
          return normalized;
        }),
      },
    ])
  );

  return {
    schemaVersion: 1,
    generatorVersion: SCRIPT_VERSION,
    state: "local_review_only",
    catalogScope: proposal.catalogScope || null,
    mutationBoundary: {
      databaseWrites: false,
      productCreated: false,
      pricesWritten: false,
      templatesWritten: false,
      published: false,
    },
    product: {
      slug: String(proposal.proposedProduct.slug),
      nameDa: String(proposal.proposedProduct.nameDa),
      shortDescriptionDa: String(proposal.proposedProduct.shortDescriptionDa),
      aboutTitleDa: String(proposal.proposedProduct.aboutTitleDa),
      aboutDescriptionDa: String(proposal.proposedProduct.aboutDescriptionDa),
      heroHref: assetHrefs[proposal.visualAssets.productHero.repoAssetPath],
    },
    axisOrder: [...AXIS_ORDER],
    optionGroups,
    sparse: true,
    interpolationAllowed: false,
    combinationCount: compactCombinations.length,
    priceRowCount: compatibilityState.actualPriceRowCount,
    combinations: compactCombinations,
    inputFingerprints,
  };
}

export function buildStorefrontDataset({ proposal, compatibility, priceRows, assetHrefs }) {
  const groups = validateProposal(proposal);
  const compatibilityState = {
    ...validateCompatibility(compatibility, groups),
    actualPriceRowCount: 0,
  };
  asArray(priceRows).forEach((row, index) => ingestExactPriceRow(compatibilityState, row, index));
  return finalizeDataset({ proposal, groups, compatibilityState, assetHrefs });
}

async function readJsonWithFingerprint(filePath, displayPath) {
  const bytes = await fs.readFile(filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new SalesFolderStorefrontProposalError(`${displayPath} is invalid JSON: ${error.message}`);
  }
  return {
    value,
    fingerprint: {
      path: displayPath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteSize: bytes.length,
    },
  };
}

async function hashFile(filePath, displayPath) {
  const hash = createHash("sha256");
  let byteSize = 0;
  const input = createReadStream(filePath);
  for await (const chunk of input) {
    hash.update(chunk);
    byteSize += chunk.length;
  }
  return { path: displayPath, sha256: hash.digest("hex"), byteSize };
}

async function ingestPriceJsonl(filePath, displayPath, state) {
  const hash = createHash("sha256");
  let byteSize = 0;
  const input = createReadStream(filePath);
  input.on("data", (chunk) => {
    hash.update(chunk);
    byteSize += chunk.length;
  });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();
      if (!line) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch (error) {
        throw new SalesFolderStorefrontProposalError(`${displayPath}:${lineNumber} is invalid JSON: ${error.message}`);
      }
      ingestExactPriceRow(state, row, state.actualPriceRowCount);
    }
  } finally {
    lines.close();
    input.destroy();
  }
  return { path: displayPath, sha256: hash.digest("hex"), byteSize };
}

function isPathInside(rootDirectory, candidatePath) {
  const relative = path.relative(rootDirectory, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveAssetHref(repoRoot, outputPath, repoAssetPath) {
  assert(
    typeof repoAssetPath === "string"
      && repoAssetPath.length > 0
      && !path.isAbsolute(repoAssetPath)
      && !repoAssetPath.split(/[\\/]+/).includes(".."),
    `Unsafe review asset path: ${repoAssetPath}`
  );
  const absoluteAssetPath = path.resolve(repoRoot, repoAssetPath);
  assert(isPathInside(repoRoot, absoluteAssetPath), `Review asset escapes repository root: ${repoAssetPath}`);
  const stat = await fs.lstat(absoluteAssetPath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `Review asset is not a regular file: ${repoAssetPath}`);
  const relative = path.relative(path.dirname(outputPath), absoluteAssetPath).split(path.sep).join("/");
  assert(relative && !path.isAbsolute(relative), `Review asset did not resolve to a local relative path: ${repoAssetPath}`);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

async function resolveAllAssetHrefs(proposal, repoRoot, outputPath) {
  const repoAssetPaths = [
    proposal?.visualAssets?.productHero?.repoAssetPath,
    ...asArray(proposal?.optionGroups)
      .find((group) => group?.key === "folder_model")
      ?.values?.map((value) => value?.icon?.svg?.repoAssetPath) || [],
  ];
  const assetHrefs = {};
  for (const repoAssetPath of repoAssetPaths) {
    assert(repoAssetPath, "Review proposal references an empty asset path");
    assetHrefs[repoAssetPath] = await resolveAssetHref(repoRoot, outputPath, repoAssetPath);
  }
  return assetHrefs;
}

function joinDanishList(values) {
  if (values.length <= 1) return values[0] || "";
  return `${values.slice(0, -1).join(", ")} og ${values.at(-1)}`;
}

function modelSpineSummary(modelKey, combinations) {
  const spines = EXPECTED_AXIS_VALUES.spine.filter((spine) =>
    combinations.some((combination) => combination[0] === modelKey && combination[2] === spine)
  );
  const depths = spines.map((spine) => spine.replace(/mm$/, ""));
  return spines.length === 1
    ? `Fast ${depths[0]} mm ryg`
    : `${joinDanishList(depths)} mm ryg`;
}

function renderModelTiles(models, combinations) {
  return models.map((model) => `
    <button class="model-tile" type="button" data-model-key="${escapeHtml(model.key)}" aria-pressed="false">
      <span class="model-visual"><img src="${escapeHtml(model.iconHref)}" alt="${escapeHtml(model.accessibleNameDa)}"></span>
      <span class="model-label">${escapeHtml(model.labelDa)}</span>
      <span class="model-size">${escapeHtml(model.widthMm)} × ${escapeHtml(model.heightMm)} mm</span>
      <span class="model-spines">${escapeHtml(modelSpineSummary(model.key, combinations))}</span>
    </button>`).join("");
}

export function renderStorefrontProposalHtml(dataset) {
  const models = dataset.optionGroups.folder_model.values;
  const embeddedData = safeJsonForInlineScript(dataset);
  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(dataset.product.nameDa)} · lokalt review</title>
  <style>
    :root { --blue:#0ea5e9; --blue-dark:#0369a1; --ink:#0f172a; --muted:#64748b; --line:#dbeafe; --soft:#f8fafc; --violet:#7c3aed; }
    * { box-sizing:border-box; }
    body { margin:0; background:#fff; color:var(--ink); font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    button, select { font:inherit; }
    button:focus-visible, select:focus-visible { outline:3px solid rgba(14,165,233,.35); outline-offset:3px; }
    .review-bar { background:#0f172a; color:#fff; padding:12px 22px; text-align:center; font-size:14px; font-weight:750; letter-spacing:.01em; }
    .review-bar span { color:#7dd3fc; }
    .page { width:min(1220px,calc(100% - 32px)); margin:0 auto; padding:34px 0 72px; }
    .hero { display:grid; grid-template-columns:minmax(0,1.03fr) minmax(360px,.97fr); gap:34px; align-items:center; border:1px solid #e2e8f0; border-radius:26px; padding:38px; background:#fff; box-shadow:0 18px 50px rgba(15,23,42,.08); }
    .eyebrow { color:var(--blue-dark); font-size:13px; font-weight:850; letter-spacing:.11em; text-transform:uppercase; }
    h1 { margin:10px 0 16px; font-size:clamp(34px,5vw,58px); line-height:1.01; letter-spacing:-.045em; }
    .lede { margin:0; max-width:66ch; color:#475569; font-size:18px; line-height:1.65; }
    .hero-visual { min-height:350px; display:grid; place-items:center; background:#fff; overflow:hidden; }
    .hero-visual img { display:block; width:100%; max-height:450px; object-fit:contain; }
    .proofs { display:flex; flex-wrap:wrap; gap:9px; margin-top:22px; }
    .proof { border:1px solid #bae6fd; background:#f0f9ff; color:#075985; border-radius:999px; padding:8px 12px; font-size:13px; font-weight:750; }
    .section { margin-top:38px; }
    .section-heading { display:flex; align-items:end; justify-content:space-between; gap:18px; margin-bottom:15px; }
    .step { margin:0 0 5px; color:var(--blue-dark); font-size:12px; font-weight:850; letter-spacing:.11em; text-transform:uppercase; }
    h2 { margin:0; font-size:clamp(24px,3vw,34px); letter-spacing:-.025em; }
    .section-note { margin:6px 0 0; color:var(--muted); line-height:1.55; }
    .count { color:var(--muted); font-size:14px; white-space:nowrap; }
    .model-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .model-tile { min-height:208px; border:1px solid #e2e8f0; border-radius:18px; background:#fff; padding:14px; color:var(--ink); cursor:pointer; text-align:left; transition:border-color .16s,box-shadow .16s,transform .16s; }
    .model-tile:hover:not(:disabled) { border-color:#7dd3fc; transform:translateY(-2px); box-shadow:0 10px 24px rgba(14,165,233,.12); }
    .model-tile[aria-pressed="true"] { border:2px solid var(--blue); padding:13px; box-shadow:0 0 0 4px rgba(14,165,233,.12); }
    .model-tile:disabled { opacity:.38; cursor:not-allowed; }
    .model-visual { display:grid; place-items:center; height:118px; border-radius:12px; background:#fff; }
    .model-visual img { width:108px; height:108px; object-fit:contain; }
    .model-label { display:block; margin-top:10px; font-size:14px; font-weight:800; line-height:1.28; }
    .model-size { display:block; margin-top:5px; color:var(--muted); font-size:12px; }
    .model-spines { display:block; margin-top:4px; color:var(--blue-dark); font-size:12px; font-weight:780; }
    .configuration { margin-top:22px; border:1px solid #cbd5e1; border-radius:24px; background:#fff; overflow:hidden; box-shadow:0 14px 36px rgba(15,23,42,.07); }
    .configuration-title { padding:24px 26px 20px; border-bottom:1px solid #e2e8f0; background:#f8fafc; }
    .configuration-title h2 { font-size:27px; }
    .axis { padding:24px 26px; border-bottom:1px solid #e2e8f0; }
    .axis:last-child { border-bottom:0; }
    .axis-head { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .axis-number { width:30px; height:30px; display:grid; place-items:center; flex:0 0 auto; border-radius:999px; background:var(--blue); color:#fff; font-size:13px; font-weight:900; }
    .axis h3 { margin:0; font-size:19px; }
    .choices { display:flex; flex-wrap:wrap; gap:10px; }
    .choice { min-height:48px; border:1px solid #cbd5e1; border-radius:12px; background:#fff; color:var(--ink); padding:10px 15px; cursor:pointer; font-weight:720; text-align:left; }
    .choice:hover:not(:disabled) { border-color:#38bdf8; }
    .choice[aria-pressed="true"] { border-color:var(--blue); background:#f0f9ff; color:#075985; box-shadow:inset 0 0 0 1px var(--blue); }
    .choice.auto-adjusted { animation:auto-adjusted 1.2s ease-out; }
    .choice:disabled { opacity:.32; cursor:not-allowed; text-decoration:line-through; }
    .axis-help { max-width:90ch; margin:12px 0 0; color:#475569; font-size:13px; line-height:1.55; }
    .auto-adjustment { margin:18px 26px 0; border:1px solid #7dd3fc; border-radius:12px; background:#f0f9ff; color:#075985; padding:12px 15px; font-size:14px; font-weight:720; line-height:1.5; }
    .finish-choice { min-width:210px; display:flex; flex-direction:column; align-items:flex-start; gap:5px; }
    .mode-badge { display:inline-flex; border-radius:999px; padding:3px 8px; font-size:11px; line-height:1.35; font-weight:850; }
    .mode-badge.online { color:#075985; background:#e0f2fe; }
    .mode-badge.upload { color:#5b21b6; background:#ede9fe; }
    .mode-panel { margin-top:14px; border-left:4px solid var(--blue); border-radius:10px; background:#f8fafc; padding:14px 16px; color:#334155; line-height:1.55; }
    .mode-panel.upload { border-left-color:var(--violet); background:#faf5ff; }
    .price-layout { display:grid; grid-template-columns:minmax(250px,.72fr) minmax(0,1.28fr); gap:22px; }
    .price-card { border:1px solid #bae6fd; border-radius:18px; background:#f0f9ff; padding:20px; }
    .price-card label { display:block; margin-bottom:8px; color:#075985; font-size:13px; font-weight:850; }
    .price-card select { width:100%; min-height:50px; border:1px solid #7dd3fc; border-radius:11px; background:#fff; padding:0 12px; color:var(--ink); }
    .price { margin-top:18px; font-size:38px; line-height:1; font-weight:900; letter-spacing:-.035em; }
    .price-meta { margin:8px 0 0; color:#475569; font-size:13px; line-height:1.5; }
    .examples-title { margin:0 0 10px; font-size:15px; }
    .examples { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
    .example { border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#fff; }
    .example-qty { color:var(--muted); font-size:12px; }
    .example-price { margin-top:3px; font-size:17px; font-weight:850; }
    .summary { margin-top:22px; border-radius:18px; background:#0f172a; color:#fff; padding:22px; }
    .summary h3 { margin:0 0 11px; font-size:18px; }
    .summary-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
    .summary-item { color:#cbd5e1; font-size:12px; line-height:1.4; }
    .summary-item strong { display:block; margin-top:3px; color:#fff; font-size:13px; }
    .boundary { margin-top:38px; border:1px solid #bae6fd; border-radius:18px; padding:22px; background:#f0f9ff; }
    .boundary h2 { font-size:22px; }
    .boundary p { margin:8px 0 0; color:#334155; line-height:1.6; }
    noscript { display:block; margin:18px 0; padding:14px; color:#7f1d1d; background:#fef2f2; border-radius:12px; }
    @keyframes auto-adjusted { 0% { box-shadow:0 0 0 5px rgba(14,165,233,.34); } 100% { box-shadow:inset 0 0 0 1px var(--blue); } }
    @media (prefers-reduced-motion:reduce) { .choice.auto-adjusted { animation:none; } }
    @media (max-width:1020px) { .hero { grid-template-columns:1fr; } .model-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .price-layout { grid-template-columns:1fr; } }
    @media (max-width:680px) { .page { width:min(100% - 20px,1220px); padding-top:18px; } .hero { padding:22px; border-radius:20px; } .hero-visual { min-height:230px; } .model-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; } .model-tile { min-height:188px; padding:11px; } .model-tile[aria-pressed="true"] { padding:10px; } .model-visual { height:105px; } .model-visual img { width:96px; height:96px; } .axis { padding:20px 17px; } .configuration-title { padding:20px 17px; } .auto-adjustment { margin:14px 17px 0; } .choice,.finish-choice { width:100%; } .examples { grid-template-columns:repeat(2,minmax(0,1fr)); } .summary-grid { grid-template-columns:1fr 1fr; } }
  </style>
</head>
<body>
  <div class="review-bar"><span>LOKALT REVIEW</span> · Ingen databaseændringer · Ingen prispublicering · Produktet er ikke publiceret</div>
  <main class="page">
    <section class="hero" aria-labelledby="page-title">
      <div>
        <div class="eyebrow">Webprinter · samlet produktforslag</div>
        <h1 id="page-title">${escapeHtml(dataset.product.nameDa)}</h1>
        <p class="lede">${escapeHtml(dataset.product.shortDescriptionDa)}</p>
        <div class="proofs" aria-label="Datadækning">
          <span class="proof">21 mappemodeller</span>
          <span class="proof">${escapeHtml(dataset.combinationCount.toLocaleString("da-DK"))} dokumenterede kombinationer</span>
          <span class="proof">${escapeHtml(dataset.priceRowCount.toLocaleString("da-DK"))} eksakte prisrækker</span>
          <span class="proof">Ingen interpolation</span>
        </div>
      </div>
      <div class="hero-visual"><img src="${escapeHtml(dataset.product.heroHref)}" alt="Webprinter-præsentation af salgsmapper med eget design"></div>
    </section>

    <section class="section" aria-labelledby="models-title">
      <div class="section-heading">
        <div><p class="step">Trin 1</p><h2 id="models-title">Vælg mappemodel</h2><p class="section-note">Alle 21 modeller vises i leverandørens dokumenterede rækkefølge. Illustrationerne ligger på hvid baggrund og er supplier-frie.</p></div>
        <span class="count">21 modeller</span>
      </div>
      <div class="model-grid" id="model-grid">${renderModelTiles(models, dataset.combinations)}</div>
    </section>

    <section class="configuration" aria-labelledby="configuration-title">
      <div class="configuration-title"><p class="step">Valgt model</p><h2 id="configuration-title">Konfigurér den valgte salgsmappe</h2><p class="section-note">Rygbredden er et konstruktions- og skabelonvalg. Utilgængelige rygbredder mangler en matchende leverandørskabelon til netop modellen. Hvis et valg kræver en anden papir- eller efterbehandlingskombination, vælger reviewet automatisk den nærmeste dokumenterede kombination med en eksakt pris.</p></div>
      <div class="auto-adjustment" id="auto-adjustment" role="status" aria-live="polite" hidden></div>
      <div id="axes"></div>
      <div class="axis">
        <div class="axis-head"><span class="axis-number">6</span><h3>Oplag og eksakt pris</h3></div>
        <div class="price-layout">
          <div class="price-card">
            <label for="quantity">Vælg dokumenteret oplag</label>
            <select id="quantity"></select>
            <div class="price" id="price" aria-live="polite"></div>
            <p class="price-meta" id="price-meta"></p>
          </div>
          <div><h4 class="examples-title">Priseksempler fra den valgte kombination</h4><div class="examples" id="examples"></div></div>
        </div>
        <div class="summary"><h3>Din dokumenterede konfiguration</h3><div class="summary-grid" id="summary"></div></div>
      </div>
    </section>

    <section class="boundary">
      <h2>${escapeHtml(dataset.product.aboutTitleDa)}</h2>
      <p>${escapeHtml(dataset.product.aboutDescriptionDa)}</p>
      <p><strong>Reviewgrænse:</strong> Denne side er en lokal, interaktiv gennemgang. Den opretter ikke et Webprinter-produkt, skriver ikke priser eller PDF-skabeloner til databasen og publicerer intet.</p>
    </section>
    <noscript>JavaScript skal være slået til for at afprøve de dokumenterede kombinationer og eksakte prisrækker.</noscript>
  </main>
  <script>
    const DATA = ${embeddedData};
    const AXES = DATA.axisOrder;
    const GROUPS = DATA.optionGroups;
    const selection = {};
    let selectedQuantity = null;
    let autoAdjustedAxes = [];
    let autoAdjustmentMessage = "";
    const comboValue = (combo, axisIndex) => combo[axisIndex];
    const exactPrices = (combo) => combo[5];
    const formatDkk = new Intl.NumberFormat("da-DK", { style:"currency", currency:"DKK", maximumFractionDigits:0 });
    const formatNumber = new Intl.NumberFormat("da-DK");

    ${resolveClosestExactCombination.toString()}

    function resolvableValueKeys(axis) {
      return new Set(GROUPS[axis].values.filter((value) =>
        resolveClosestExactCombination(DATA.combinations, AXES, selection, axis, value.key) != null
      ).map((value) => value.key));
    }

    function applyExactCombination(combo) {
      AXES.forEach((axis, index) => { selection[axis] = comboValue(combo, index); });
    }

    function selectedCombo() {
      return DATA.combinations.find((combo) => AXES.every((axis, index) => comboValue(combo, index) === selection[axis])) ?? null;
    }

    function optionByKey(axis, key) {
      return GROUPS[axis].values.find((value) => value.key === key);
    }

    function selectAxis(axis, value) {
      const previousSelection = { ...selection };
      const resolved = resolveClosestExactCombination(DATA.combinations, AXES, selection, axis, value);
      if (!resolved) return;
      applyExactCombination(resolved);
      autoAdjustedAxes = AXES.filter((candidateAxis) =>
        candidateAxis !== axis && previousSelection[candidateAxis] !== selection[candidateAxis]
      );
      const requestedLabel = optionByKey(axis, value)?.labelDa || value;
      const changes = autoAdjustedAxes.map((changedAxis) =>
        GROUPS[changedAxis].labelDa + " blev automatisk ændret til " + optionByKey(changedAxis, selection[changedAxis]).labelDa
      );
      autoAdjustmentMessage = changes.length
        ? changes.join(". ") + ", så " + requestedLabel + " kan vise en eksakt dokumenteret pris."
        : "";
      render();
      if (axis === "folder_model") document.querySelector(".configuration").scrollIntoView({ behavior:"smooth", block:"start" });
    }

    function renderModels() {
      const available = resolvableValueKeys("folder_model");
      document.querySelectorAll("[data-model-key]").forEach((button) => {
        const key = button.dataset.modelKey;
        button.disabled = !available.has(key);
        button.setAttribute("aria-pressed", String(selection.folder_model === key));
        button.onclick = () => selectAxis("folder_model", key);
      });
    }

    function buildChoice(axis, value, enabled) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice" + (axis === "finish" ? " finish-choice" : "");
      if (autoAdjustedAxes.includes(axis) && selection[axis] === value.key) button.classList.add("auto-adjusted");
      button.disabled = !enabled;
      button.dataset.axis = axis;
      button.dataset.value = value.key;
      if (!enabled) button.title = "Ingen eksakt dokumenteret pris findes for dette valg på den valgte mappemodel.";
      button.setAttribute("aria-pressed", String(selection[axis] === value.key));
      const label = document.createElement("span");
      label.textContent = value.labelDa;
      button.append(label);
      if (axis === "finish") {
        const badge = document.createElement("span");
        badge.className = "mode-badge " + (value.artworkMode === "professional_pdf_upload_only" ? "upload" : "online");
        badge.textContent = value.artworkModeLabelDa;
        button.append(badge);
      }
      button.onclick = () => selectAxis(axis, value.key);
      return button;
    }

    function spinePriceBehavior() {
      const matches = DATA.combinations.filter((combo) =>
        comboValue(combo, 0) === selection.folder_model
        && comboValue(combo, 1) === selection.print
        && comboValue(combo, 3) === selection.paper
        && comboValue(combo, 4) === selection.finish
      );
      const spineCount = new Set(matches.map((combo) => comboValue(combo, 2))).size;
      if (spineCount < 2) return null;
      return new Set(matches.map((combo) => JSON.stringify(exactPrices(combo)))).size === 1;
    }

    function spineHelpText(available) {
      const availableLabels = GROUPS.spine.values
        .filter((value) => available.has(value.key))
        .map((value) => value.labelDa);
      if (availableLabels.length === 1) {
        return "Denne konstruktion har kun én dokumenteret rygskabelon (" + availableLabels[0] + "). De øvrige rygbredder er deaktiveret, fordi der ikke findes en matchende leverandørskabelon til modellen – ikke på grund af prisen.";
      }
      const samePrice = spinePriceBehavior();
      const priceExplanation = samePrice
        ? "Prisen er identisk på tværs af de tilgængelige rygbredder ved den aktuelle papir- og efterbehandlingskombination."
        : "Leverandørens eksakte prisrækker afviger lidt mellem enkelte rygbredder ved den aktuelle papir- og efterbehandlingskombination; reviewet bevarer disse dokumenterede priser.";
      return "Rygbredden ændrer den færdige mappedybde og vælger den tilsvarende PDF-skabelon med korrekte skære- og falselinjer. " + priceExplanation;
    }

    function renderAxes() {
      const host = document.getElementById("axes");
      host.replaceChildren();
      AXES.slice(1).forEach((axis, relativeIndex) => {
        const axisIndex = relativeIndex + 1;
        const section = document.createElement("section");
        section.className = "axis";
        const head = document.createElement("div");
        head.className = "axis-head";
        const number = document.createElement("span");
        number.className = "axis-number";
        number.textContent = String(axisIndex + 1);
        const title = document.createElement("h3");
        title.textContent = GROUPS[axis].labelDa;
        head.append(number, title);
        const choices = document.createElement("div");
        choices.className = "choices";
        const available = resolvableValueKeys(axis);
        GROUPS[axis].values.forEach((value) => choices.append(buildChoice(axis, value, available.has(value.key))));
        section.append(head, choices);
        if (axis === "spine") {
          const help = document.createElement("p");
          help.className = "axis-help";
          help.textContent = spineHelpText(available);
          section.append(help);
        }
        if (axis === "finish") {
          const selected = optionByKey(axis, selection[axis]);
          const panel = document.createElement("div");
          panel.className = "mode-panel" + (selected.artworkMode === "professional_pdf_upload_only" ? " upload" : "");
          panel.textContent = selected.artworkModeLabelDa + ": " + selected.artworkModeReasonDa;
          section.append(panel);
        }
        host.append(section);
      });
    }

    function renderAutoAdjustment() {
      const message = document.getElementById("auto-adjustment");
      message.textContent = autoAdjustmentMessage;
      message.hidden = !autoAdjustmentMessage;
    }

    function sampleExactPrices(prices) {
      const candidates = [0, 1, Math.floor(prices.length / 4), Math.floor(prices.length / 2), Math.floor(prices.length * 3 / 4), prices.length - 1];
      return [...new Set(candidates)].filter((index) => index >= 0 && index < prices.length).map((index) => prices[index]);
    }

    function renderPrices() {
      const combo = selectedCombo();
      if (!combo) throw new Error("Ingen eksakt kompatibel kombination kunne findes");
      const prices = exactPrices(combo);
      const quantity = document.getElementById("quantity");
      if (!prices.some(([value]) => value === selectedQuantity)) selectedQuantity = prices[0][0];
      quantity.replaceChildren(...prices.map(([value]) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = formatNumber.format(value) + " stk.";
        option.selected = value === selectedQuantity;
        return option;
      }));
      quantity.onchange = () => { selectedQuantity = Number(quantity.value); renderPrices(); };
      const current = prices.find(([value]) => value === selectedQuantity);
      document.getElementById("price").textContent = formatDkk.format(current[1]);
      document.getElementById("price-meta").textContent = formatNumber.format(selectedQuantity) + " stk. · eksakt prisrække · ingen beregning mellem oplag";
      const examples = document.getElementById("examples");
      examples.replaceChildren(...sampleExactPrices(prices).map(([qty, price]) => {
        const card = document.createElement("div");
        card.className = "example";
        const qtyLabel = document.createElement("div");
        qtyLabel.className = "example-qty";
        qtyLabel.textContent = formatNumber.format(qty) + " stk.";
        const priceLabel = document.createElement("div");
        priceLabel.className = "example-price";
        priceLabel.textContent = formatDkk.format(price);
        card.append(qtyLabel, priceLabel);
        return card;
      }));

      const summary = document.getElementById("summary");
      summary.replaceChildren(...AXES.map((axis) => {
        const item = document.createElement("div");
        item.className = "summary-item";
        item.textContent = GROUPS[axis].labelDa;
        const strong = document.createElement("strong");
        strong.textContent = optionByKey(axis, selection[axis]).labelDa;
        item.append(strong);
        return item;
      }));
    }

    function render() { renderModels(); renderAutoAdjustment(); renderAxes(); renderPrices(); }
    applyExactCombination(DATA.combinations[0]);
    render();
  </script>
</body>
</html>
`;
}

async function writeAtomic(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, contents);
  await fs.rename(temporaryPath, filePath);
}

function fingerprintsEqual(left, right) {
  return left.path === right.path && left.sha256 === right.sha256 && left.byteSize === right.byteSize;
}

export async function buildStorefrontProposal({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  outputPath = null,
  repoRoot = REPO_ROOT,
} = {}) {
  const resolvedRunDirectory = path.resolve(runDirectory);
  const reviewDirectory = path.join(resolvedRunDirectory, "review");
  const resolvedOutputPath = path.resolve(outputPath || path.join(reviewDirectory, "storefront-proposal.html"));
  assert(
    path.dirname(resolvedOutputPath) === path.resolve(reviewDirectory),
    "Storefront proposal output must stay in the run review directory"
  );

  const proposalPath = path.join(reviewDirectory, "consolidated-product-proposal.json");
  const compatibilityPath = path.join(reviewDirectory, "proposed-compatibility.json");
  const priceRowsPath = path.join(reviewDirectory, "proposed-price-rows.jsonl");
  const proposalRelativePath = "review/consolidated-product-proposal.json";
  const compatibilityRelativePath = "review/proposed-compatibility.json";
  const priceRowsRelativePath = "review/proposed-price-rows.jsonl";

  const proposalRead = await readJsonWithFingerprint(proposalPath, proposalRelativePath);
  const compatibilityRead = await readJsonWithFingerprint(compatibilityPath, compatibilityRelativePath);
  const groups = validateProposal(proposalRead.value);
  const compatibilityState = {
    ...validateCompatibility(compatibilityRead.value, groups),
    actualPriceRowCount: 0,
  };
  const priceFingerprint = await ingestPriceJsonl(priceRowsPath, priceRowsRelativePath, compatibilityState);
  const assetHrefs = await resolveAllAssetHrefs(proposalRead.value, path.resolve(repoRoot), resolvedOutputPath);
  const inputFingerprints = [proposalRead.fingerprint, compatibilityRead.fingerprint, priceFingerprint];
  const dataset = finalizeDataset({
    proposal: proposalRead.value,
    groups,
    compatibilityState,
    assetHrefs,
    inputFingerprints,
  });
  const html = renderStorefrontProposalHtml(dataset);
  await writeAtomic(resolvedOutputPath, html);

  const afterFingerprints = await Promise.all([
    hashFile(proposalPath, proposalRelativePath),
    hashFile(compatibilityPath, compatibilityRelativePath),
    hashFile(priceRowsPath, priceRowsRelativePath),
  ]);
  assert(
    inputFingerprints.every((fingerprint, index) => fingerprintsEqual(fingerprint, afterFingerprints[index])),
    "Review inputs changed while the storefront proposal was generated"
  );

  return {
    outputPath: resolvedOutputPath,
    byteSize: Buffer.byteLength(html),
    sha256: createHash("sha256").update(html).digest("hex"),
    modelCount: dataset.optionGroups.folder_model.values.length,
    combinationCount: dataset.combinationCount,
    priceRowCount: dataset.priceRowCount,
    state: dataset.state,
    databaseWrites: false,
    published: false,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") options.runDirectory = argv[++index];
    else if (argument === "--output") options.outputPath = argv[++index];
    else if (argument === "--help") options.help = true;
    else throw new SalesFolderStorefrontProposalError(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/product-import/build-wmd-sales-folder-storefront-proposal.js [--run <directory>] [--output <review/storefront-proposal.html>]\n");
    return;
  }
  const result = await buildStorefrontProposal(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.name}: ${error.message}\n`);
    if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    process.exitCode = 1;
  });
}
