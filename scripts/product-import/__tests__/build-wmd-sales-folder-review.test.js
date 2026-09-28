import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SalesFolderReviewError,
  applyProposedCatalogScope,
  buildCompatibility,
  buildConsolidatedProductProposal,
  buildEditableOptionImageSettings,
  buildPricingStructure,
  buildProposedPriceRows,
  buildReviewPackage,
  buildTemplateProjectionStubs,
  assertFingerprintsUnchanged,
  loadAndValidateIconManifest,
  loadAndValidateHeroAsset,
  validateCompleteCatalogProfile,
  validateAdditionalOptionProjection,
  validateExtractionGate,
  validateRawPricingProjection,
} from "../build-wmd-sales-folder-review.js";
import { applyConversionRule } from "../shared/conversion.js";
import {
  normalizeWmdSalesFolderRows,
  sortWmdSalesFolderRows,
} from "../shared/wmd-sales-folders.js";

const SOURCE_URL_40 = "https://www.wir-machen-druck.de/mappe-a4-40.html";
const SOURCE_URL_44 = "https://www.wir-machen-druck.de/mappe-a4-44.html";
const SOURCE_ENTRY_URL =
  "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html";

function pricingRow(overrides = {}) {
  const defaults = {
    sourceOrder: 0,
    formatKey: "a4",
    formatLabelDa: "A4",
    widthMm: 210,
    heightMm: 297,
    constructionKey: "2-part-standard",
    constructionLabelDa: "2-delt standardmappe",
    windowPunch: false,
    closure: false,
    printMode: "4+0",
    finishKey: "none",
    paperKey: "chromo-mappekarton",
    spineDepthMm: 1,
    quantity: 50,
    supplierPrice: 34.65,
    currency: "EUR",
    convertedPriceDkk: 259.875,
    finalPriceDkk: 416,
    ruleKey: "wmd_tiered_fx_7_5",
    conversionRule: "wmd_tiered_fx_7_5",
    factor: 12,
    tierMultiplier: 1.6,
    classified: true,
    unclassifiedDimensions: [],
    priceEvidenceMismatch: null,
    selectionKey: "source-selection-1",
    source: {
      index: 0,
      url: SOURCE_URL_40,
      title: "Mappe für DIN A4, 4/0 farbig",
      materialLabel: "0,40 mm starker Chromokarton 255g",
      quantityPriceLabel: "50 Stück (34,65 Euro netto)",
      quantity: 50,
      totalEur: 34.65,
      labelTotalEur: 34.65,
    },
  };
  const row = { ...defaults, ...overrides };
  row.source = { ...defaults.source, ...(overrides.source || {}) };
  return row;
}

function rawPricingRow(row, index) {
  const priceScaleId = String(15000000 + index);
  const materialId = String(460565 + index);
  const sourceProductId = String(19000 + index);
  const request = {
    priceScaleId,
    quantity: row.quantity,
    substrateId: materialId,
    articleId: sourceProductId,
  };
  const response = {
    priceScaleId,
    price: row.supplierPrice,
    currency: "EUR",
  };
  const supplierApiEvidence = {
    endpoint: "/wmdrest/article/get-price",
    request,
    response,
    sha256: createHash("sha256").update(JSON.stringify({ request, response })).digest("hex"),
    sanitized: true,
  };
  return {
    sourceUrl: row.source.url,
    sourceProductId,
    sourceTitle: row.source.title,
    productSourceOrder: index,
    materialId,
    materialLabel: row.source.materialLabel,
    spineDepthMm: row.spineDepthMm,
    quantityOptionId: priceScaleId,
    quantityPriceLabel: row.source.quantityPriceLabel,
    quantity: row.quantity,
    supplierNetPriceEur: row.supplierPrice,
    totalEur: row.supplierPrice,
    currency: "EUR",
    supplierPriceEvidence: {
      endpoint: "/wmdrest/article/get-price",
      priceScaleId,
      optionTotalEur: row.supplierPrice,
      apiVerified: true,
    },
    supplierApiEvidence,
  };
}

function apiEvidenceRow(row) {
  return {
    sourceUrl: row.sourceUrl,
    sourceProductId: row.sourceProductId,
    materialId: row.materialId,
    quantityOptionId: row.quantityOptionId,
    quantity: row.quantity,
    evidence: row.supplierApiEvidence,
  };
}

function documentBinding(row, { materialId = "460565", suffix = "a4-1mm-40" } = {}) {
  const fieldKey = "39";
  return {
    sourceUrl: row.source.url,
    productSourceOrder: row.sourceOrder,
    sourceProductId: String(19000 + row.sourceOrder),
    sourceSku: String(19000 + row.sourceOrder),
    materialId,
    materialSourceOrder: 0,
    materialLabel: row.source.materialLabel,
    classification: {
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
    },
    materialFacts: {
      paperKey: row.paperKey,
      spineDepthMm: row.spineDepthMm,
      grammageGsm: row.paperKey === "chromo-mappekarton" ? 255 : 350,
    },
    documents: [
      {
        role: "guide",
        label: "Datenblatt",
        url: `https://www.wir-machen-druck.de/tpl/${suffix}_1.pdf`,
      },
      {
        role: "template",
        label: "Druckvorlage",
        url: `https://www.wir-machen-druck.de/tpl/${suffix}_2.pdf`,
      },
    ],
    additionalOptions: [
      {
        fieldKey,
        labelOriginal: "Visitenkartentasche",
        isClimateContribution: false,
        supplierFieldId: "650",
        supplierOptionDescription: "feld39",
        mandatory: true,
        choices: [
          {
            sourceId: 2903,
            labelOriginal: "beigelegt",
            sourceOrder: 2,
            supplierSalePriceEur: 0.04,
            supplierPurchasePriceEur: 0.03,
            supplierSaleBasePriceEur: 0,
            supplierSalePercentage: 0,
            preselected: false,
          },
        ],
      },
    ],
    additionalOptionCoverage: {
      visibleOptionKeys: [fieldKey],
      apiOptionKeys: [fieldKey],
      missingFromApi: [],
      unexpectedFromApi: [],
      choiceInventoryIssues: [],
      apiExtendedInventory: false,
      fieldInventoryComplete: true,
      choiceInventoryComplete: true,
      combinationPricingVerified: false,
      eligibleForImport: false,
    },
    capturedAt: `2026-08-31T00:00:0${row.sourceOrder}.000Z`,
  };
}

function additionalOptionBinding(binding) {
  return {
    sourceUrl: binding.sourceUrl,
    productSourceOrder: binding.productSourceOrder,
    materialId: binding.materialId,
    materialSourceOrder: binding.materialSourceOrder,
    materialLabel: binding.materialLabel,
    spineDepthMm: binding.materialFacts.spineDepthMm,
    additionalOptions: binding.additionalOptions,
    additionalOptionCoverage: binding.additionalOptionCoverage,
    capturedAt: binding.capturedAt,
  };
}

function apiExtendedMissingLabelFixture(data = fixture()) {
  const documentBindings = structuredClone(data.documentBindings);
  const targetBinding = documentBindings[1];
  const targetOption = targetBinding.additionalOptions[0];
  targetOption.labelOriginal = null;
  targetBinding.additionalOptionCoverage.visibleOptionKeys = [];
  targetBinding.additionalOptionCoverage.unexpectedFromApi = [targetOption.fieldKey];
  targetBinding.additionalOptionCoverage.apiExtendedInventory = true;
  return {
    ...data,
    documentBindings,
    additionalOptionBindings: documentBindings.map(additionalOptionBinding),
  };
}

function fixture() {
  const first = pricingRow();
  const second = pricingRow({
    sourceOrder: 1,
    printMode: "4+4",
    finishKey: "gloss-lamination",
    paperKey: "matt-billedtrykskarton",
    spineDepthMm: 3,
    quantity: 100,
    supplierPrice: 61.2,
    convertedPriceDkk: 459,
    finalPriceDkk: 734,
    selectionKey: "source-selection-2",
    source: {
      url: SOURCE_URL_44,
      title: "Mappe für DIN A4, 4/4 farbig mit Glanzfolienkaschierung",
      index: 1,
      materialLabel: "0,36 mm starker Bilderdruckkarton 350g matt",
      quantityPriceLabel: "100 Stück (61,20 Euro netto)",
      quantity: 100,
      totalEur: 61.2,
      labelTotalEur: 61.2,
    },
  });
  const rawPricingRows = [first, second].map(rawPricingRow);
  const normalized = normalizeWmdSalesFolderRows(rawPricingRows);
  const pricingRows = sortWmdSalesFolderRows(normalized.rows).map((row, sourceOrder) => ({
    sourceOrder,
    ...row,
    supplierPrice: row.totalEur,
    ...applyConversionRule(row.totalEur, "wmd_tiered_fx_7_5"),
    conversionRule: "wmd_tiered_fx_7_5",
  }));
  const apiEvidenceRows = rawPricingRows.map(apiEvidenceRow);
  const documentBindings = [
    documentBinding(first),
    documentBinding(second, { materialId: "1108986", suffix: "a4-3mm-44-gloss" }),
  ];
  const additionalOptionBindings = documentBindings.map(additionalOptionBinding);
  const catalog = [
    {
      sourceOrder: 0,
      sourceImage: "https://www.wir-machen-druck.de/product-icon/folder-a4.png",
      listingTitle: "Mappe für DIN A4, 4/0 farbig",
      classification: documentBindings[0].classification,
      error: null,
    },
    {
      sourceOrder: 1,
      sourceImage: "https://www.wir-machen-druck.de/product-icon/folder-a4-gloss.png",
      listingTitle: "Mappe für DIN A4, 4/4 farbig mit glänzender Folienkaschierung",
      classification: documentBindings[1].classification,
      error: null,
    },
  ];
  const summary = {
    state: "extracted",
    partial: false,
    eligibleForReview: true,
    eligibleForImport: false,
    sourceCategoryUrl: SOURCE_ENTRY_URL,
    runScope: {
      partial: false,
      selectedProductCount: 2,
      fullDiscoveredProductCount: 2,
      args: { maxProducts: null, maxQuantities: null },
    },
    catalogProducts: 2,
    successfulProducts: 2,
    failedProducts: 0,
    unresolvedCurrentRunFailures: 0,
    rawPriceRows: 2,
    normalizedPriceRows: 2,
    documentBindings: 2,
    evidenceAuditPassedProducts: 2,
    addOnInventoryExtracted: true,
    addOnCombinationPricingVerified: false,
    supplierBankWritten: false,
    productDraftWritten: false,
    pricingWritten: false,
    templatesWritten: false,
    published: false,
    conversionRule: "wmd_tiered_fx_7_5",
    parserCoverage: normalized.coverage,
  };
  const coverage = normalized.coverage;
  const options = {
    formats: [{ key: "a4", labelDa: "A4", widthMm: 210, heightMm: 297 }],
    constructions: [{ key: "2-part-standard", labelDa: "2-delt standardmappe" }],
    prints: [
      { key: "4+0", labelDa: "4+0 – tryk på ydersiden" },
      { key: "4+4", labelDa: "4+4 – tryk på yder- og indersiden" },
    ],
    spineDepths: [1, 3, 5, 10].map((spineDepthMm) => ({
      key: String(spineDepthMm),
      spineDepthMm,
      labelDa: `${spineDepthMm} mm ryg`,
    })),
    papers: [
      { key: "chromo-mappekarton", labelDa: "255g Chromo mappekarton" },
      { key: "matt-billedtrykskarton", labelDa: "350g Mat billedtrykskarton" },
    ],
    finishes: [
      { key: "none", labelDa: "Ingen efterbehandling" },
      { key: "gloss-lamination", labelDa: "Blank laminering" },
    ],
    combinations: pricingRows.map((row) => ({
      selectionKey: row.selectionKey,
      selection: {
        formatKey: row.formatKey,
        constructionKey: row.constructionKey,
        printMode: row.printMode,
        spineDepthMm: row.spineDepthMm,
        paperKey: row.paperKey,
        finishKey: row.finishKey,
      },
      quantities: [row.quantity],
    })),
  };
  const evidenceAudit = [SOURCE_URL_40, SOURCE_URL_44].map((sourceUrl) => ({
    sourceUrl,
    evidenceValid: true,
    requestedScopeSatisfied: true,
    currentRunFailure: null,
  }));
  return {
    summary,
    coverage,
    options,
    pricingRows,
    rawPricingRows,
    apiEvidenceRows,
    additionalOptionBindings,
    documentBindings,
    catalog,
    evidenceAudit,
  };
}

function validatedIconManifestFixture() {
  const key = "a4--2-part-standard";
  return {
    schemaVersion: 1,
    assetVersion: "v1",
    optionAxis: "folder_model",
    manifestRepoPath: "assets/manifest.json",
    manifestSha256: "a".repeat(64),
    manifestByteSize: 1024,
    modelCount: 1,
    modelOrder: [key],
    palette: { primary: "#0EA5E9", neutral: "#64748B", background: "transparent" },
    backendProjection: {
      displayType: "icon_grid",
      imageField: "valueSettings[valueId].customImage",
      orderField: "section.valueIds",
      recommendedSizePx: 128,
      savedBackendImageTakesPrecedence: true,
    },
    provenance: {
      type: "deterministic-svg",
      supplierAssetsCopied: false,
      supplierBrandingIncluded: false,
    },
    models: {
      [key]: {
        modelKey: key,
        sourceOrder: 0,
        labelDa: "A4 · 2-delt standardmappe",
        accessibleNameDa: "Illustration af A4, 2-delt standardmappe",
        formatKey: "a4",
        constructionKey: "2-part-standard",
        formatDimensionsMm: { width: 210, height: 297 },
        svg: {
          repoAssetPath: `assets/${key}.svg`,
          sha256: "b".repeat(64),
          byteSize: 200,
          widthPx: 256,
          heightPx: 256,
          viewBox: "0 0 256 256",
          mimeType: "image/svg+xml",
        },
      },
    },
  };
}

function validatedHeroAssetFixture() {
  return {
    repoAssetPath: "assets/webprinter-sales-folder-hero-v1.png",
    sha256: "c".repeat(64),
    byteSize: 1024,
    mimeType: "image/png",
    widthPx: 1536,
    heightPx: 1024,
    bitDepth: 8,
    colorModel: "RGBA",
    hasAlpha: true,
    interlaced: false,
    state: "local_review_only_verified",
    published: false,
  };
}

async function writeIconFixture(rootDirectory, { models = null } = {}) {
  const assetDirectory = path.join(rootDirectory, "assets");
  await fs.mkdir(assetDirectory, { recursive: true });
  const defaultModels = [
    {
      key: "a4--2-part-standard",
      labelDa: "A4 · 2-delt standardmappe",
      accessibleNameDa: "Illustration af A4, 2-delt standardmappe",
      formatKey: "a4",
      constructionKey: "2-part-standard",
      widthMm: 210,
      heightMm: 297,
    },
  ];
  const selectedModels = models || defaultModels;
  const manifestModels = {};
  for (const [sourceOrder, model] of selectedModels.entries()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false"><path fill="#0EA5E9" d="M20 20h216v216H20z"/></svg>\n`;
    const relativePath = `assets/${model.key}.svg`;
    await fs.writeFile(path.join(rootDirectory, relativePath), svg, "utf8");
    manifestModels[model.key] = {
      modelKey: model.key,
      folderModelKey: model.key,
      formatKey: model.formatKey,
      constructionKey: model.constructionKey,
      labelDa: model.labelDa,
      accessibleNameDa: model.accessibleNameDa,
      sourceOrder,
      formatDimensionsMm: { width: model.widthMm, height: model.heightMm },
      svg: {
        path: relativePath,
        widthPx: 256,
        heightPx: 256,
        viewBox: "0 0 256 256",
        sha256: createHash("sha256").update(svg).digest("hex"),
      },
    };
  }
  const manifest = {
    schemaVersion: 1,
    assetVersion: "v1",
    optionAxis: "folder_model",
    modelKeyConvention: "<formatKey>--<constructionKey>",
    modelCount: selectedModels.length,
    palette: { primary: "#0EA5E9", neutral: "#64748B", background: "transparent" },
    backendProjection: {
      displayType: "icon_grid",
      imageField: "valueSettings[valueId].customImage",
      orderField: "section.valueIds",
      recommendedSizePx: 128,
      savedBackendImageTakesPrecedence: true,
    },
    provenance: {
      type: "deterministic-svg",
      supplierAssetsCopied: false,
      supplierBrandingIncluded: false,
    },
    models: manifestModels,
  };
  const contactSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1216" height="1544" viewBox="0 0 1216 1544" role="img"><title>Salgsmapper – modelikoner v1</title><desc>Kun til review. Ikke en storefront-asset.</desc><rect width="1216" height="1544" fill="#FFFFFF"/><text x="24" y="42" fill="#0F172A">Kun til review</text>${selectedModels.map((model, index) => `<g data-model-key="${model.key}"><path fill="#0EA5E9" d="M20 ${80 + index * 20}h100v10H20z"/><text x="140" y="${90 + index * 20}" fill="#64748B">${model.labelDa}</text></g>`).join("")}</svg>\n`;
  const contactSheetPath = "assets/review-contact-sheet.svg";
  await fs.writeFile(path.join(rootDirectory, contactSheetPath), contactSheet, "utf8");
  manifest.reviewArtifacts = {
    contactSheet: {
      purpose: "review_only",
      storefrontAsset: false,
      backendOptionAsset: false,
      path: contactSheetPath,
      widthPx: 1216,
      heightPx: 1544,
      sha256: createHash("sha256").update(contactSheet).digest("hex"),
      background: "white",
      labels: "Danish labels outside each embedded icon",
    },
    rasterDerivative: {
      status: "not_generated",
    },
  };
  const manifestPath = path.join(assetDirectory, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { assetDirectory, manifestPath, manifest, selectedModels };
}

async function writeFixture(runDirectory, data = fixture()) {
  await fs.mkdir(path.join(runDirectory, "review"), { recursive: true });
  await fs.mkdir(path.join(runDirectory, "normalized"), { recursive: true });
  await fs.mkdir(path.join(runDirectory, "raw"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDirectory, "discovery.json"), JSON.stringify({ sourceCategoryUrl: SOURCE_ENTRY_URL })),
    fs.writeFile(path.join(runDirectory, "review/extraction-summary.json"), JSON.stringify(data.summary)),
    fs.writeFile(path.join(runDirectory, "normalized/coverage.json"), JSON.stringify(data.coverage)),
    fs.writeFile(path.join(runDirectory, "normalized/options.json"), JSON.stringify(data.options)),
    fs.writeFile(path.join(runDirectory, "normalized/pricing-preview.jsonl"), `${data.pricingRows.map(JSON.stringify).join("\n")}\n`),
    fs.writeFile(path.join(runDirectory, "raw/document-bindings.jsonl"), `${data.documentBindings.map(JSON.stringify).join("\n")}\n`),
    fs.writeFile(path.join(runDirectory, "raw/catalog.json"), JSON.stringify(data.catalog)),
    fs.writeFile(path.join(runDirectory, "raw/pricing.jsonl"), `${data.rawPricingRows.map(JSON.stringify).join("\n")}\n`),
    fs.writeFile(
      path.join(runDirectory, "raw/additional-option-bindings.jsonl"),
      `${data.additionalOptionBindings.map(JSON.stringify).join("\n")}\n`
    ),
    fs.writeFile(path.join(runDirectory, "raw/api-evidence.jsonl"), `${data.apiEvidenceRows.map(JSON.stringify).join("\n")}\n`),
    fs.writeFile(path.join(runDirectory, "raw/material-evidence.jsonl"), `${JSON.stringify({ sourceUrl: SOURCE_URL_40, verified: true })}\n`),
    fs.writeFile(path.join(runDirectory, "raw/page-snapshots.jsonl"), `${JSON.stringify({ sourceUrl: SOURCE_URL_40, verified: true })}\n`),
    fs.writeFile(path.join(runDirectory, "raw/retry-failures.jsonl"), ""),
    fs.writeFile(path.join(runDirectory, "review/evidence-audit.json"), JSON.stringify(data.evidenceAudit)),
  ]);
}

test("consolidated proposal uses the required customer option order and keeps print/spine source order", () => {
  const data = fixture();
  validateExtractionGate(data);
  const additionalOptionReview = validateAdditionalOptionProjection({
    documentBindings: data.documentBindings,
    additionalOptionBindings: data.additionalOptionBindings,
    summary: data.summary,
  });
  const proposal = buildConsolidatedProductProposal({
    ...data,
    iconManifest: validatedIconManifestFixture(),
    heroAsset: validatedHeroAssetFixture(),
    additionalOptionReview,
  });
  assert.equal(proposal.proposedProduct.slug, "salgsmapper-med-eget-design");
  assert.equal(proposal.proposedProduct.isPublished, false);
  assert.deepEqual(proposal.axisOrder, ["folder_model", "print", "spine", "paper", "finish"]);
  assert.deepEqual(proposal.optionGroups.map((group) => group.key), proposal.axisOrder);
  assert.deepEqual(
    proposal.optionGroups.find((group) => group.key === "print").values.map((value) => value.key),
    ["4+0", "4+4"]
  );
  assert.deepEqual(
    proposal.optionGroups.find((group) => group.key === "spine").values.map((value) => value.spineDepthMm),
    [1, 3, 5, 10]
  );
  const model = proposal.optionGroups[0].values[0];
  assert.equal(model.icon.palette.primary, "#0EA5E9");
  assert.equal(model.icon.palette.background, "transparent");
  assert.equal(model.icon.assetState, "local_manifest_verified");
  assert.equal(model.icon.svg.repoAssetPath, "assets/a4--2-part-standard.svg");
  assert.equal(model.icon.svg.sha256, "b".repeat(64));
  assert.equal(model.icon.backendProjection.imageField, "valueSettings[valueId].customImage");
  assert.equal(model.icon.provenance.supplierAssetUsedAsProposedIcon, false);
  assert.equal("sourceReferenceUrl" in model, false);
  assert.equal(proposal.visualAssets.productHero.state, "local_review_only_verified");
  assert.equal(proposal.visualAssets.productHero.published, false);
  assert.equal(proposal.addOns.bindingCount, 2);
  assert.equal(proposal.addOns.includedInPricing, false);
  assert.equal(proposal.addOns.projectedToProductOptions, false);
  assert.equal(proposal.addOns.proposedSelectableOptionCount, 0);
});

test("proposed pricing is an exact sparse projection with no generated combinations", () => {
  const { pricingRows } = fixture();
  const rows = buildProposedPriceRows(pricingRows);
  const compatibility = buildCompatibility(rows);
  assert.equal(rows.length, pricingRows.length);
  assert.equal(compatibility.length, 2);
  assert.equal(rows.every((row) => row.noInterpolation === true), true);
  assert.equal(rows[0].supplierPrice, pricingRows[0].supplierPrice);
  assert.equal(rows[0].finalPriceDkk, pricingRows[0].finalPriceDkk);
  assert.equal(rows[0].sourceEvidence.rawPricingEvidencePath, "raw/pricing.jsonl");
  assert.equal(rows[1].selections.print, "4+4");
  assert.equal(rows[1].selections.finish, "gloss-lamination");
});

test("spot finishes require professional PDF upload while ordinary finishes keep online design", () => {
  const data = fixture();
  data.options.finishes.push({ key: "partial-uv", labelDa: "Partiel UV-lak" });
  const additionalOptionReview = validateAdditionalOptionProjection({
    documentBindings: data.documentBindings,
    additionalOptionBindings: data.additionalOptionBindings,
    summary: data.summary,
  });
  const proposal = buildConsolidatedProductProposal({
    ...data,
    iconManifest: validatedIconManifestFixture(),
    heroAsset: validatedHeroAssetFixture(),
    additionalOptionReview,
  });
  const finishValues = new Map(
    proposal.optionGroups.find((group) => group.key === "finish").values
      .map((value) => [value.key, value]),
  );

  assert.equal(finishValues.get("none").artworkMode, "online_designer");
  assert.equal(finishValues.get("gloss-lamination").onlineDesignerAllowed, true);
  assert.equal(finishValues.get("partial-uv").artworkMode, "professional_pdf_upload_only");
  assert.equal(finishValues.get("partial-uv").onlineDesignerAllowed, false);
  assert.match(finishValues.get("partial-uv").artworkModeReasonDa, /staffagefarve/i);

  const spotData = fixture();
  spotData.pricingRows[1].finishKey = "partial-uv";
  spotData.documentBindings[1].classification.finishKey = "partial-uv";
  const projectedRows = buildProposedPriceRows(spotData.pricingRows);
  const stubs = buildTemplateProjectionStubs({
    documentBindings: spotData.documentBindings,
    proposedPriceRows: projectedRows,
  });
  const spotStub = stubs.find((stub) => stub.match.finish === "partial-uv");
  assert.equal(spotStub.template.artworkMode, "professional_pdf_upload_only");
  assert.equal(spotStub.template.onlineDesignerAllowed, false);
  assert.match(spotStub.template.artworkModeReasonDa, /professionel tryk-PDF/i);
});

test("folder-model proposal uses the actual XL picture grid with backend-owned image, order and size", () => {
  const data = fixture();
  const additionalOptionReview = validateAdditionalOptionProjection({
    documentBindings: data.documentBindings,
    additionalOptionBindings: data.additionalOptionBindings,
    summary: data.summary,
  });
  const productProposal = buildConsolidatedProductProposal({
    ...data,
    iconManifest: validatedIconManifestFixture(),
    heroAsset: validatedHeroAssetFixture(),
    additionalOptionReview,
  });
  const proposedPriceRows = buildProposedPriceRows(data.pricingRows);
  const compatibility = buildCompatibility(proposedPriceRows);
  const structure = buildPricingStructure({ productProposal, compatibility, proposedPriceRows });
  const modelSection = structure.proposedMatrixLayoutV1.layout_rows[0].columns[0];
  const modelGroup = productProposal.optionGroups.find((group) => group.key === "folder_model");
  const firstModel = modelGroup.values[0];
  const firstValueId = `pending-value-id:folder_model:${firstModel.key}`;

  assert.equal(modelSection.id, "pending-group-id:folder_model");
  assert.equal(modelSection.ui_mode, "xl");
  assert.equal(modelSection.thumbnail_size, "xl");
  assert.equal(modelSection.thumbnail_custom_px, 128);
  assert.deepEqual(modelSection.valueIds, modelGroup.values.map((value) => `pending-value-id:folder_model:${value.key}`));
  assert.deepEqual(modelSection.valueSettings[firstValueId], {
    showThumbnail: true,
    customImage: null,
    preferCustomImage: true,
    imageSizePx: 128,
    displayName: firstModel.labelDa,
  });
  assert.equal(modelSection.selectorStyling.pictureButtons.displayMode, "text_below_image");
  assert.equal(modelSection.selectorStyling.pictureButtons.transparentBackground, true);
  assert.equal(modelSection.selectorStyling.pictureButtons.labelOutsideImage, true);
  assert.equal(modelSection.neutralWhiteSurface, true);
  assert.equal(modelSection.neutral_white_surface, true);
  assert.equal(structure.proposedMatrixLayoutV1.layout_rows[0].columns[1].ui_mode, "buttons");
  assert.equal(structure.proposedMatrixLayoutV1.layout_rows[0].columns[3].ui_mode, "dropdown");

  const editableImages = buildEditableOptionImageSettings(productProposal);
  assert.equal(editableImages.backendOwnedFields.order, "section.valueIds");
  assert.equal(editableImages.backendOwnedFields.image, "valueSettings[valueId].customImage");
  assert.equal(editableImages.backendOwnedFields.perValueSize, "pricing_structure.layout_rows[].columns[].valueSettings[valueId].imageSizePx");
  assert.equal(editableImages.groupSettings.ui_mode, "xl");
  assert.equal(editableImages.groupSettings.thumbnail_size, "xl");
  assert.equal(editableImages.groupSettings.selectorStyling.pictureButtons.displayMode, "text_below_image");
  assert.equal(editableImages.values[0].proposedBackendSettingsAfterApprovedAssetResolution.imageSizePx, 128);
});

test("normalized prices and API evidence must regenerate exactly from raw supplier rows", () => {
  const data = fixture();
  const verified = validateRawPricingProjection({
    rawPricingRows: data.rawPricingRows,
    normalizedPricingRows: data.pricingRows,
    apiEvidenceRows: data.apiEvidenceRows,
    coverage: data.coverage,
  });
  assert.equal(verified.rawPriceRows, 2);
  assert.equal(verified.regeneratedNormalizedRows, 2);
  assert.equal(verified.apiEvidenceRows, 2);

  const changedNormalized = structuredClone(data.pricingRows);
  changedNormalized[0].supplierPrice += 1;
  changedNormalized[0].source.totalEur += 1;
  Object.assign(
    changedNormalized[0],
    applyConversionRule(changedNormalized[0].supplierPrice, "wmd_tiered_fx_7_5")
  );
  assert.throws(
    () => validateRawPricingProjection({
      rawPricingRows: data.rawPricingRows,
      normalizedPricingRows: changedNormalized,
      apiEvidenceRows: data.apiEvidenceRows,
      coverage: data.coverage,
    }),
    /does not match deterministic regeneration/
  );

  const changedApi = structuredClone(data.apiEvidenceRows);
  changedApi[0].evidence.response.price += 1;
  assert.throws(
    () => validateRawPricingProjection({
      rawPricingRows: data.rawPricingRows,
      normalizedPricingRows: data.pricingRows,
      apiEvidenceRows: changedApi,
      coverage: data.coverage,
    }),
    /API-evidence artifact does not match/
  );
});

test("dedicated add-on inventory must exactly match complete non-importable document evidence", () => {
  const data = fixture();
  const review = validateAdditionalOptionProjection({
    documentBindings: data.documentBindings,
    additionalOptionBindings: data.additionalOptionBindings,
    summary: data.summary,
  });
  assert.equal(review.bindingCount, 2);
  assert.equal(review.optionFieldCount, 2);
  assert.equal(review.choiceCount, 2);
  assert.equal(review.combinationPricingVerified, false);
  assert.throws(
    () => validateAdditionalOptionProjection({
      documentBindings: data.documentBindings,
      additionalOptionBindings: [],
      summary: data.summary,
    }),
    /does not match/
  );
  const changed = structuredClone(data.additionalOptionBindings);
  changed[0].additionalOptions[0].choices[0].supplierSalePriceEur += 1;
  assert.throws(
    () => validateAdditionalOptionProjection({
      documentBindings: data.documentBindings,
      additionalOptionBindings: changed,
      summary: data.summary,
    }),
    /does not match/
  );
});

test("API-extended add-on fields may resolve a missing label only from an exact immutable raw-data identity", () => {
  const data = apiExtendedMissingLabelFixture();
  const review = validateAdditionalOptionProjection({
    documentBindings: data.documentBindings,
    additionalOptionBindings: data.additionalOptionBindings,
    summary: data.summary,
  });
  assert.equal(review.resolvedMissingSupplierLabelCount, 1);
  assert.equal(review.resolvedSupplierLabelIdentityCount, 1);
  assert.deepEqual(review.resolvedSupplierLabels[0].match, {
    fieldKey: "39",
    supplierFieldId: "650",
  });
  assert.equal(review.resolvedSupplierLabels[0].canonicalLabelOriginal, "Visitenkartentasche");
  assert.equal(review.resolvedSupplierLabels[0].targetBindingCount, 1);
  assert.equal(review.resolvedSupplierLabels[0].provenance.sourceArtifact, "raw/document-bindings.jsonl");
  assert.equal(review.resolvedSupplierLabels[0].provenance.rawEvidenceMutated, false);
  assert.equal(data.documentBindings[1].additionalOptions[0].labelOriginal, null);
  assert.equal(data.additionalOptionBindings[1].additionalOptions[0].labelOriginal, null);
  const proposal = buildConsolidatedProductProposal({
    ...data,
    iconManifest: validatedIconManifestFixture(),
    heroAsset: validatedHeroAssetFixture(),
    additionalOptionReview: review,
  });
  assert.equal(proposal.addOns.resolvedMissingSupplierLabelCount, 1);
  assert.equal(proposal.addOns.resolvedSupplierLabelIdentityCount, 1);
  assert.deepEqual(proposal.addOns.resolvedSupplierLabels, review.resolvedSupplierLabels);
  assert.equal(proposal.addOns.rawEvidenceMutatedForLabelResolution, false);
});

test("the CD pocket identity remains raw evidence but is absent from proposed add-on labels and choices", () => {
  const data = apiExtendedMissingLabelFixture();
  const review = validateAdditionalOptionProjection({
    documentBindings: data.documentBindings,
    additionalOptionBindings: data.additionalOptionBindings,
    summary: data.summary,
  });
  review.resolvedSupplierLabels[0].match = { fieldKey: "41", supplierFieldId: "647" };
  review.resolvedSupplierLabels[0].canonicalLabelOriginal = "CD-Tasche";
  const proposal = buildConsolidatedProductProposal({
    ...data,
    iconManifest: validatedIconManifestFixture(),
    heroAsset: validatedHeroAssetFixture(),
    additionalOptionReview: review,
  });
  assert.equal(proposal.addOns.rawResolvedMissingSupplierLabelCount, 1);
  assert.equal(proposal.addOns.rawResolvedSupplierLabelIdentityCount, 1);
  assert.equal(proposal.addOns.resolvedMissingSupplierLabelCount, 0);
  assert.equal(proposal.addOns.resolvedSupplierLabelIdentityCount, 0);
  assert.deepEqual(proposal.addOns.resolvedSupplierLabels, []);
  assert.equal(proposal.addOns.excludedResolvedSupplierLabelIdentityCount, 1);
  assert.equal(proposal.addOns.projectedToProductOptions, false);
  assert.equal(proposal.addOns.proposedSelectableOptionCount, 0);
});

test("missing add-on labels fail closed without one unambiguous canonical supplier label", () => {
  const noCanonical = apiExtendedMissingLabelFixture();
  noCanonical.documentBindings = [noCanonical.documentBindings[1]];
  noCanonical.additionalOptionBindings = noCanonical.documentBindings.map(additionalOptionBinding);
  assert.throws(
    () => validateAdditionalOptionProjection({
      documentBindings: noCanonical.documentBindings,
      additionalOptionBindings: noCanonical.additionalOptionBindings,
      summary: noCanonical.summary,
    }),
    /no canonical supplier label evidence/
  );

  const ambiguous = apiExtendedMissingLabelFixture();
  const conflictingEvidence = structuredClone(ambiguous.documentBindings[0]);
  conflictingEvidence.sourceUrl = `${conflictingEvidence.sourceUrl}#conflicting-label-evidence`;
  conflictingEvidence.productSourceOrder = 99;
  conflictingEvidence.materialId = "conflicting-material";
  conflictingEvidence.additionalOptions[0].labelOriginal = "CD-Tasche";
  ambiguous.documentBindings.push(conflictingEvidence);
  ambiguous.additionalOptionBindings = ambiguous.documentBindings.map(additionalOptionBinding);
  assert.throws(
    () => validateAdditionalOptionProjection({
      documentBindings: ambiguous.documentBindings,
      additionalOptionBindings: ambiguous.additionalOptionBindings,
      summary: ambiguous.summary,
    }),
    /ambiguous canonical supplier label evidence/
  );
});

test("missing add-on labels remain invalid for non-API-extended or visible fields", () => {
  const nonExtended = apiExtendedMissingLabelFixture();
  const targetCoverage = nonExtended.documentBindings[1].additionalOptionCoverage;
  targetCoverage.visibleOptionKeys = ["39"];
  targetCoverage.unexpectedFromApi = [];
  targetCoverage.apiExtendedInventory = false;
  nonExtended.additionalOptionBindings = nonExtended.documentBindings.map(additionalOptionBinding);
  assert.throws(
    () => validateAdditionalOptionProjection({
      documentBindings: nonExtended.documentBindings,
      additionalOptionBindings: nonExtended.additionalOptionBindings,
      summary: nonExtended.summary,
    }),
    /not explicitly API-extended/
  );

  const visible = apiExtendedMissingLabelFixture();
  visible.documentBindings[1].additionalOptionCoverage.visibleOptionKeys = ["39"];
  visible.additionalOptionBindings = visible.documentBindings.map(additionalOptionBinding);
  assert.throws(
    () => validateAdditionalOptionProjection({
      documentBindings: visible.documentBindings,
      additionalOptionBindings: visible.additionalOptionBindings,
      summary: visible.summary,
    }),
    /is visible in the supplier page inventory/
  );
});

test("every unique priced configuration has one exact guide/template projection stub", () => {
  const data = fixture();
  const rows = buildProposedPriceRows(data.pricingRows);
  const stubs = buildTemplateProjectionStubs({
    documentBindings: data.documentBindings,
    proposedPriceRows: rows,
  });
  assert.equal(stubs.length, 2);
  assert.equal(stubs[0].guide.factsReviewed, false);
  assert.equal(stubs[0].template.sanitizedPdfPath, null);
  assert.equal(stubs[0].template.lockedInDesigner, false);
  assert.equal(stubs[0].template.nonPrintingOverlayVerified, false);
  assert.deepEqual(Object.keys(stubs[0].match), ["folder_model", "print", "spine", "paper", "finish"]);
  assert.equal(stubs[0].structuredBinding.profile, "sales_folder_v1");
  assert.equal(stubs[0].selectionConstraintProfile, "sales_folder_v1");
  assert.deepEqual(stubs[0].selectionConstraintSections, {
    folder_model: "pending-group-id:folder_model",
    print: "pending-group-id:print",
    spine: "pending-group-id:spine",
    paper: "pending-group-id:paper",
    finish: "pending-group-id:finish",
  });
  assert.equal("selectionConstraints" in stubs[0], false);
  assert.deepEqual(
    stubs[0].structuredBinding.semanticAxisKeys,
    ["folder_model", "print", "spine", "paper", "finish"]
  );
  assert.deepEqual(Object.keys(stubs[0].structuredBinding.semanticConstraints), stubs[0].structuredBinding.semanticAxisKeys);
  assert.equal(stubs[0].structuredBinding.eventualUuidConstraints.requiredConstraintCount, 5);
  assert.equal(stubs[0].structuredBinding.eventualUuidConstraints.partialConstraintsAllowed, false);
  assert.equal(stubs[0].structuredBinding.eventualUuidConstraints.pdfByteReuseDoesNotRelaxConstraintCompleteness, true);
  assert.equal(stubs[0].template.structuredBindingProfile, "sales_folder_v1");
});

test("review gate fails closed on partial, import-eligible, mismatched, duplicate, or unclassified extraction state", () => {
  for (const mutate of [
    (data) => { data.summary.partial = true; },
    (data) => { data.summary.eligibleForImport = true; },
    (data) => { data.coverage.priceEvidenceMismatchRows = 1; },
    (data) => { data.coverage.duplicateSelectionQuantityKeys = ["duplicate"]; },
    (data) => { data.summary.parserCoverage.unclassifiedRows = 1; },
    (data) => { data.pricingRows[0].ruleKey = "wmd_tiered_fx_7_6"; },
    (data) => { data.pricingRows[0].convertedPriceDkk += 1; },
    (data) => { data.pricingRows[0].finalPriceDkk += 1; },
    (data) => { data.pricingRows[0].tierMultiplier = 1.5; },
    (data) => { data.pricingRows[0].factor = 11.25; },
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => validateExtractionGate(data), SalesFolderReviewError);
  }
});

test("catalog profile gate rejects missing or reordered models, finishes, prints, papers and spines", () => {
  const data = fixture();
  const models = [{ key: "a4--2-part-standard" }];
  const profile = {
    sourceProductCount: 2,
    modelKeys: ["a4--2-part-standard"],
    printKeys: ["4+0", "4+4"],
    spineDepthsMm: [1, 3, 5, 10],
    paperKeys: ["chromo-mappekarton", "matt-billedtrykskarton"],
    finishKeys: ["none", "gloss-lamination"],
  };
  validateCompleteCatalogProfile({ summary: data.summary, options: data.options, models, profile });
  for (const mutate of [
    (copy) => { copy.modelKeys = []; },
    (copy) => { copy.printKeys.reverse(); },
    (copy) => { copy.spineDepthsMm = [1, 3, 5]; },
    (copy) => { copy.paperKeys.reverse(); },
    (copy) => { copy.finishKeys = ["none"]; },
  ]) {
    const wrongProfile = structuredClone(profile);
    mutate(wrongProfile);
    assert.throws(
      () => validateCompleteCatalogProfile({ summary: data.summary, options: data.options, models, profile: wrongProfile }),
      SalesFolderReviewError
    );
  }
});

test("explicit product scope excludes the CD-sized model from every derived collection while preserving raw inputs", () => {
  const data = fixture();
  const cdRow = pricingRow({
    sourceOrder: 2,
    formatKey: "cd-135x135",
    formatLabelDa: "CD-mappe 13,5 × 13,5 cm",
    widthMm: 135,
    heightMm: 135,
    constructionKey: "2-part-closure",
    constructionLabelDa: "2-delt med lukning",
    closure: true,
    spineDepthMm: 3,
    selectionKey: "source-selection-cd",
    source: {
      url: "https://www.wir-machen-druck.de/mappe-cd-40.html",
      title: "Mappe für CD-Verpackung",
      quantity: 50,
      totalEur: 34.65,
      labelTotalEur: 34.65,
    },
  });
  const cdBinding = documentBinding(cdRow, { materialId: "874606", suffix: "cd-3mm-40" });
  const pricingRows = [...data.pricingRows, cdRow];
  const documentBindings = [...data.documentBindings, cdBinding];
  const additionalOptionBindings = [...data.additionalOptionBindings, additionalOptionBinding(cdBinding)];
  const catalog = [...data.catalog, {
    sourceOrder: 2,
    sourceImage: "https://www.wir-machen-druck.de/product-icon/folder-cd.png",
    listingTitle: "Mappe für CD-Verpackung",
    classification: cdBinding.classification,
    error: null,
  }];
  const iconManifest = validatedIconManifestFixture();
  const cdModelKey = "cd-135x135--2-part-closure";
  iconManifest.modelOrder.push(cdModelKey);
  iconManifest.modelCount = 2;
  iconManifest.models[cdModelKey] = {
    modelKey: cdModelKey,
    sourceOrder: 1,
    labelDa: "CD-mappe 13,5 × 13,5 cm · 2-delt med lukning",
    accessibleNameDa: "Illustration af CD-mappe",
    formatKey: "cd-135x135",
    constructionKey: "2-part-closure",
    formatDimensionsMm: { width: 135, height: 135 },
    svg: {
      repoAssetPath: `assets/${cdModelKey}.svg`,
      sha256: "d".repeat(64),
      byteSize: 200,
      widthPx: 256,
      heightPx: 256,
      viewBox: "0 0 256 256",
      mimeType: "image/svg+xml",
    },
  };

  const rawSnapshot = JSON.stringify({ pricingRows, documentBindings, additionalOptionBindings, catalog });
  const scoped = applyProposedCatalogScope({
    pricingRows,
    documentBindings,
    additionalOptionBindings,
    catalog,
    iconManifest,
    requiredSourceModelKeys: [cdModelKey],
  });

  assert.equal(JSON.stringify({ pricingRows, documentBindings, additionalOptionBindings, catalog }), rawSnapshot);
  assert.equal(scoped.pricingRows.length, 2);
  assert.equal(scoped.documentBindings.length, 2);
  assert.equal(scoped.additionalOptionBindings.length, 2);
  assert.equal(scoped.catalog.length, 2);
  assert.equal(scoped.iconManifest.modelCount, 1);
  assert.deepEqual(scoped.iconManifest.modelOrder, ["a4--2-part-standard"]);
  assert.equal(scoped.iconManifest.reviewArtifacts.sourceManifestContactSheetOmitted, true);
  assert.equal(scoped.scope.counts.excluded.sourceProducts, 1);
  assert.equal(scoped.scope.counts.excluded.priceRows, 1);
  assert.equal(scoped.scope.counts.excluded.exactSparseCombinations, 1);
  assert.equal(scoped.scope.counts.excluded.documentBindings, 1);
  assert.equal(scoped.scope.counts.excluded.additionalOptionBindings, 1);
  assert.equal(scoped.scope.counts.excluded.folderModelIcons, 1);
  assert.match(scoped.scope.excludedModels[0].reasonDa, /fravalgt/);
  assert.deepEqual(scoped.scope.excludedAddOns[0].supplierFieldIdentity, {
    fieldKey: "41",
    supplierFieldId: "647",
  });
  assert.equal(scoped.scope.excludedAddOns[0].canonicalLabelOriginal, "CD-Tasche");
  assert.equal(scoped.scope.excludedAddOns[0].sourceEvidencePreserved, true);
  assert.equal(scoped.scope.excludedAddOns[0].projectedToSelectableProductOption, false);
  assert.equal(scoped.scope.excludedAddOns[0].includedInPricing, false);
});

test("document projection fails when a priced configuration is missing or duplicated", () => {
  const data = fixture();
  const rows = buildProposedPriceRows(data.pricingRows);
  assert.throws(
    () => buildTemplateProjectionStubs({ documentBindings: data.documentBindings.slice(0, 1), proposedPriceRows: rows }),
    /do not cover every unique priced configuration/
  );
  assert.throws(
    () => buildTemplateProjectionStubs({ documentBindings: [data.documentBindings[0], data.documentBindings[0]], proposedPriceRows: rows.slice(0, 1) }),
    /Duplicate document projection/
  );
});

test("complete checked-in icon manifest validates all 21 ordered SVG files and hashes", async () => {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(testDirectory, "../../..");
  const manifestPath = path.join(
    repoRoot,
    "src/assets/product-options/sales-folders/models/v1/manifest.json"
  );
  const rawManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const expectedModels = Object.values(rawManifest.models).map((model) => ({
    key: model.modelKey,
    formatKey: model.formatKey,
    constructionKey: model.constructionKey,
    labelDa: model.labelDa,
    widthMm: model.formatDimensionsMm.width,
    heightMm: model.formatDimensionsMm.height,
  }));
  const validated = await loadAndValidateIconManifest({ expectedModels });
  assert.equal(validated.modelCount, 21);
  assert.equal(validated.modelOrder[0], "a4--2-part-standard");
  assert.equal(validated.modelOrder.at(-1), "cd-135x135--2-part-closure");
  assert.equal(validated.backendProjection.recommendedSizePx, 128);
  assert.match(validated.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    validated.models["a4--2-part-standard"].svg.sha256,
    rawManifest.models["a4--2-part-standard"].svg.sha256
  );
});

test("icon manifest fails closed on missing, extra, reordered, hash, or SVG metadata drift", async () => {
  const rootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-icons-"));
  const models = [
    {
      key: "a4--2-part-standard",
      labelDa: "A4 · 2-delt standardmappe",
      accessibleNameDa: "Illustration af A4, 2-delt standardmappe",
      formatKey: "a4",
      constructionKey: "2-part-standard",
      widthMm: 210,
      heightMm: 297,
    },
    {
      key: "a5--2-part-standard",
      labelDa: "A5 · 2-delt standardmappe",
      accessibleNameDa: "Illustration af A5, 2-delt standardmappe",
      formatKey: "a5",
      constructionKey: "2-part-standard",
      widthMm: 148,
      heightMm: 210,
    },
  ];
  try {
    const icons = await writeIconFixture(rootDirectory, { models });
    const validate = () => loadAndValidateIconManifest({
      manifestPath: icons.manifestPath,
      assetRootDirectory: rootDirectory,
      requiredPathPrefix: "assets/",
      expectedModels: models,
    });
    await validate();

    const writeManifest = (manifest) => fs.writeFile(
      icons.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    const missing = structuredClone(icons.manifest);
    delete missing.models[models[1].key];
    missing.modelCount = 1;
    await writeManifest(missing);
    await assert.rejects(validate, /model count does not match extracted folder models/);

    const extra = structuredClone(icons.manifest);
    extra.models["extra--model"] = { ...extra.models[models[0].key], modelKey: "extra--model" };
    extra.modelCount = 3;
    await writeManifest(extra);
    await assert.rejects(validate, /model count does not match extracted folder models/);

    const reordered = structuredClone(icons.manifest);
    reordered.models = {
      [models[1].key]: reordered.models[models[1].key],
      [models[0].key]: reordered.models[models[0].key],
    };
    await writeManifest(reordered);
    await assert.rejects(validate, /missing, extra, or reordered/);

    const badHash = structuredClone(icons.manifest);
    badHash.models[models[0].key].svg.sha256 = "f".repeat(64);
    await writeManifest(badHash);
    await assert.rejects(validate, /SHA-256 does not match/);

    const metadataDrift = structuredClone(icons.manifest);
    const firstSvgPath = path.join(rootDirectory, metadataDrift.models[models[0].key].svg.path);
    const changedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="256" viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false"><path fill="#0EA5E9" d="M20 20h216v216H20z"/></svg>\n`;
    await fs.writeFile(firstSvgPath, changedSvg, "utf8");
    metadataDrift.models[models[0].key].svg.sha256 = createHash("sha256").update(changedSvg).digest("hex");
    await writeManifest(metadataDrift);
    await assert.rejects(validate, /SVG width metadata is inconsistent/);
  } finally {
    await fs.rm(rootDirectory, { recursive: true, force: true });
  }
});

test("icon manifest rejects unsafe, labelled, externally referenced, or off-palette SVG bytes even when hashes are updated", async () => {
  const rootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-icon-safety-"));
  const modelKey = "a4--2-part-standard";
  const maliciousSvgs = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false"><path fill="#0EA5E9" d="M20 20h20v20H20z"/><script>alert(1)</script></svg>\n`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false"><path fill="#0EA5E9" d="M20 20h20v20H20z"/><text x="1" y="1">Logo</text></svg>\n`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false"><path fill="#00AA00" d="M20 20h20v20H20z"/></svg>\n`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false"><path fill="#0EA5E9" d="M20 20h20v20H20z"/><image href="https://example.com/logo.png"/></svg>\n`,
  ];
  try {
    for (const svg of maliciousSvgs) {
      const icons = await writeIconFixture(rootDirectory);
      await fs.writeFile(path.join(rootDirectory, icons.manifest.models[modelKey].svg.path), svg, "utf8");
      icons.manifest.models[modelKey].svg.sha256 = createHash("sha256").update(svg).digest("hex");
      await fs.writeFile(icons.manifestPath, `${JSON.stringify(icons.manifest, null, 2)}\n`, "utf8");
      await assert.rejects(
        () => loadAndValidateIconManifest({
          manifestPath: icons.manifestPath,
          assetRootDirectory: rootDirectory,
          requiredPathPrefix: "assets/",
          expectedModels: icons.selectedModels,
        }),
        SalesFolderReviewError
      );
    }

    const icons = await writeIconFixture(rootDirectory);
    const contactSheetPath = path.join(rootDirectory, icons.manifest.reviewArtifacts.contactSheet.path);
    const unsafeContactSheet = (await fs.readFile(contactSheetPath, "utf8")).replace(
      "</svg>",
      "<foreignObject><script>alert(1)</script></foreignObject></svg>"
    );
    await fs.writeFile(contactSheetPath, unsafeContactSheet, "utf8");
    icons.manifest.reviewArtifacts.contactSheet.sha256 = createHash("sha256").update(unsafeContactSheet).digest("hex");
    await fs.writeFile(icons.manifestPath, `${JSON.stringify(icons.manifest, null, 2)}\n`, "utf8");
    await assert.rejects(
      () => loadAndValidateIconManifest({
        manifestPath: icons.manifestPath,
        assetRootDirectory: rootDirectory,
        requiredPathPrefix: "assets/",
        expectedModels: icons.selectedModels,
      }),
      /unsafe or externally referenceable/
    );
  } finally {
    await fs.rm(rootDirectory, { recursive: true, force: true });
  }
});

test("checked-in product hero is the exact reviewed 1536 by 1024 RGBA PNG", async () => {
  const hero = await loadAndValidateHeroAsset();
  assert.equal(hero.repoAssetPath, "src/assets/product-options/sales-folders/webprinter-sales-folder-hero-v1.png");
  assert.equal(hero.sha256, "44432bcd17bf4e460a8744a37380494836fad0f8a896b7402fac2f506a2ac37d");
  assert.equal(hero.widthPx, 1536);
  assert.equal(hero.heightPx, 1024);
  assert.equal(hero.colorModel, "RGBA");
  assert.equal(hero.hasAlpha, true);
  assert.equal(hero.state, "local_review_only_verified");
  assert.equal(hero.published, false);
});

test("builder writes only the local review package and records every mutation as false", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sales-folder-review-"));
  try {
    await writeFixture(runDirectory);
    const icons = await writeIconFixture(runDirectory);
    const result = await buildReviewPackage({
      runDirectory,
      iconManifestPath: icons.manifestPath,
      iconAssetRootDirectory: runDirectory,
      requiredIconPathPrefix: "assets/",
      catalogProfile: {
        sourceProductCount: 2,
        modelKeys: ["a4--2-part-standard"],
        printKeys: ["4+0", "4+4"],
        spineDepthsMm: [1, 3, 5, 10],
        paperKeys: ["chromo-mappekarton", "matt-billedtrykskarton"],
        finishKeys: ["none", "gloss-lamination"],
      },
    });
    assert.equal(result.status.eligibleForImport, false);
    assert.equal(result.status.externalMutationsPerformed, false);
    assert.match(result.status.generationId, /^[a-f0-9-]{36}$/);
    assert.equal(result.status.counts.proposedPriceRows, 2);
    assert.equal(result.status.counts.rawSourceProducts, 2);
    assert.equal(result.status.counts.sourceProducts, 2);
    assert.equal(result.status.counts.excludedSourceProducts, 0);
    assert.equal(result.status.counts.verifiedFolderModelIcons, 1);
    assert.equal(result.status.counts.verifiedAddOnInventoryBindings, 2);
    assert.equal(result.status.counts.resolvedMissingAddOnSupplierLabels, 0);
    assert.equal(result.status.counts.resolvedAddOnSupplierLabelIdentities, 0);
    assert.equal(result.status.verifiedIconManifest.assetVersion, "v1");
    assert.equal(result.status.verifiedProductHero.state, "local_review_only_verified");
    assert.equal(result.status.verifiedProductHero.published, false);
    assert.equal(result.status.inputFingerprints.some(
      (item) => item.path === "raw/api-evidence.jsonl" && /^[a-f0-9]{64}$/.test(item.sha256)
    ), true);
    assert.equal(result.status.outputFingerprints.length, 9);
    assert.equal(result.status.outputFingerprints.every(
      (item) => item.path.startsWith("review/") && /^[a-f0-9]{64}$/.test(item.sha256)
    ), true);
    const proposal = JSON.parse(await fs.readFile(result.paths.productProposal, "utf8"));
    const catalogScope = JSON.parse(await fs.readFile(result.paths.catalogScope, "utf8"));
    const mutationPlan = JSON.parse(await fs.readFile(result.paths.mutationPlan, "utf8"));
    const imageSettings = JSON.parse(await fs.readFile(result.paths.editableImages, "utf8"));
    const priceLines = (await fs.readFile(result.paths.priceRows, "utf8")).trim().split("\n");
    assert.equal(proposal.proposedProduct.slug, "salgsmapper-med-eget-design");
    assert.equal(catalogScope.rawSupplierEvidenceMutated, false);
    assert.equal(catalogScope.counts.proposed.folderModels, 1);
    assert.equal(priceLines.length, 2);
    assert.equal(proposal.optionGroups[0].values[0].icon.svg.sha256, icons.manifest.models["a4--2-part-standard"].svg.sha256);
    assert.equal(proposal.visualAssets.productHero.sha256, "44432bcd17bf4e460a8744a37380494836fad0f8a896b7402fac2f506a2ac37d");
    assert.deepEqual(proposal.addOns.resolvedSupplierLabels, []);
    assert.equal(imageSettings.values[0].sourceAsset.repoAssetPath, "assets/a4--2-part-standard.svg");
    assert.equal(imageSettings.values[0].proposedBackendSettingsAfterApprovedAssetResolution.customImage, null);
    assert.equal(
      imageSettings.values[0].proposedBackendSettingsAfterApprovedAssetResolution.requiredCustomImageResolution.status,
      "approved_product_draft_asset_publish_pending"
    );
    assert.deepEqual(mutationPlan.performedMutations, {
      supplierBankWritten: false,
      productCreatedOrUpdated: false,
      pricingWritten: false,
      templateRecordsWritten: false,
      filesUploaded: false,
      published: false,
    });
    assert.equal(mutationPlan.stopAt, "supplier_bank_approval");
    await assert.rejects(
      fs.access(path.join(runDirectory, "review/.consolidated-review-builder.lock")),
      { code: "ENOENT" }
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, ".extractor.lock")),
      { code: "ENOENT" }
    );
    const productFingerprint = result.status.outputFingerprints.find(
      (item) => item.path === "review/consolidated-product-proposal.json"
    );
    assert.equal(
      productFingerprint.sha256,
      createHash("sha256").update(await fs.readFile(result.paths.productProposal)).digest("hex")
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("builder refuses an active extractor before reading or writing review output", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sales-folder-locked-review-"));
  try {
    await writeFixture(runDirectory);
    await fs.writeFile(path.join(runDirectory, ".extractor.lock"), "active\n", "utf8");
    await assert.rejects(
      () => buildReviewPackage({ runDirectory }),
      /extractor is active/
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, "review/consolidated-product-proposal.json")),
      { code: "ENOENT" }
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("builder refuses an erased dedicated add-on inventory before writing review output", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sales-folder-addon-review-"));
  try {
    await writeFixture(runDirectory);
    await fs.writeFile(path.join(runDirectory, "raw/additional-option-bindings.jsonl"), "", "utf8");
    await assert.rejects(
      () => buildReviewPackage({ runDirectory }),
      /Dedicated add-on inventory does not match/
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, "review/consolidated-product-proposal.json")),
      { code: "ENOENT" }
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("fingerprint comparison fails closed on path, byte-size, or hash drift", () => {
  const baseline = [{ path: "raw/pricing.jsonl", sha256: "a".repeat(64), byteSize: 10 }];
  assertFingerprintsUnchanged(baseline, structuredClone(baseline));
  for (const changed of [
    [{ path: "raw/other.jsonl", sha256: "a".repeat(64), byteSize: 10 }],
    [{ path: "raw/pricing.jsonl", sha256: "b".repeat(64), byteSize: 10 }],
    [{ path: "raw/pricing.jsonl", sha256: "a".repeat(64), byteSize: 11 }],
  ]) {
    assert.throws(() => assertFingerprintsUnchanged(baseline, changed), SalesFolderReviewError);
  }
});

test("builder source contains no network or external persistence client", async () => {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const source = await fs.readFile(path.join(testDirectory, "../build-wmd-sales-folder-review.js"), "utf8");
  assert.doesNotMatch(source, /@supabase|createClient\s*\(|globalThis\.fetch|chromium\.launch|https\.request/);
});
