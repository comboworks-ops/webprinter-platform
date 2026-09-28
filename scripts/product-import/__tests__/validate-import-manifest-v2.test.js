import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const validatorPath = path.join(
  repositoryRoot,
  ".agents/skills/import-supplier-product/scripts/validate-import-manifest.mjs",
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeJsonl(directory, filename, rows) {
  const bytes = Buffer.from(`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  writeFileSync(path.join(directory, filename), bytes);
  return {
    path: filename,
    sha256: sha256(bytes),
    bytes: bytes.length,
    rowCount: rows.length,
    format: "jsonl",
  };
}

function baseDocument(template) {
  return {
    sourceOrder: 0,
    documentKey: "a4-standard-4-0-1mm-paper-none",
    match: {
      folder_model: "a4-standard",
    },
    guide: {
      sourceUrl: "https://www.wir-machen-druck.de/guide.pdf",
      nativeGuideKey: "sales-folder-a4-standard",
      factsReviewed: true,
    },
    template: {
      sourceUrl: "https://www.wir-machen-druck.de/template.pdf",
      sanitizedPdfPath: "documents/template.pdf",
      sanitizedPdfSha256: "a".repeat(64),
      widthMm: 450,
      heightMm: 317,
      bleedMm: 5,
      safeMm: 3,
      pageCount: 2,
      metadataRemoved: true,
      supplierBrandingRemoved: true,
      designerTemplateId: null,
      ...template,
    },
  };
}

function writeManifest(directory, document) {
  const pricingArtifact = writeJsonl(directory, "prices.jsonl", [{
    sourceOrder: 0,
    selections: document.match,
    quantity: 50,
    supplierPrice: 10,
    convertedPriceDkk: 75,
    finalPriceDkk: 120,
    conversionRuleKey: "wmd_test",
    sourceEvidence: {
      sourceUrl: "https://www.wir-machen-druck.de/product.html",
    },
  }]);
  const documentsArtifact = writeJsonl(directory, "documents.jsonl", [document]);
  const manifest = {
    schemaVersion: 2,
    runId: "wmd-sales-folders-test",
    source: {
      supplierSlug: "wmd",
      entryUrl: "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html",
      scopeMode: "single_product_family",
      extractor: "test",
      capturedAt: "2026-08-31T00:00:00.000Z",
      allowedHosts: ["www.wir-machen-druck.de"],
    },
    product: {
      sourceKey: "sales-folders",
      nameOriginal: "Praesentationsmappen",
      nameDa: "Salgsmapper med eget design",
      descriptionOriginal: "Presentation folders",
      descriptionDa: "Salgsmapper med eget tryk.",
      sourceLanguage: "de",
      targetLanguage: "da",
      family: "sales_folders",
    },
    optionGroups: [{
      key: "folder_model",
      labelOriginal: "Modell",
      labelDa: "Mappemodel",
      displayType: "dropdown",
      sourceOrder: 0,
      values: [{
        key: "a4-standard",
        labelOriginal: "A4 Standard",
        labelDa: "A4 standard",
        sourceOrder: 0,
      }],
    }],
    pricing: {
      supplierCurrency: "EUR",
      vatState: "excluded",
      conversionRuleKey: "wmd_test",
      recordsArtifact: pricingArtifact,
    },
    documents: { recordsArtifact: documentsArtifact },
    target: {
      mode: "supplier_bank",
      state: "extracted",
      publishProduct: false,
      writeLivePricing: false,
    },
    artifacts: {
      rawSnapshot: "raw/source.json",
      normalizedPricing: "prices.jsonl",
      reviewReport: "review/index.html",
    },
  };
  const manifestPath = path.join(directory, "import-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function validate(manifestPath) {
  return spawnSync(process.execPath, [validatorPath, manifestPath], { encoding: "utf8" });
}

test("schema v2 accepts a hash-pinned online Designer template artifact", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "import-manifest-v2-online-"));
  try {
    const document = baseDocument({
      artworkMode: "online_designer",
      onlineDesignerAllowed: true,
      designerLoadMode: "locked_non_printing_guide_overlay",
      lockedInDesigner: true,
      nonPrintingOverlay: true,
      excludedFromExport: true,
      verificationStatus: "pending",
    });
    const result = validate(writeManifest(directory, document));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Price rows: 1/);
    assert.match(result.stdout, /Document pairs: 1/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v2 accepts professional-upload-only artwork without a Designer template", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "import-manifest-v2-professional-"));
  try {
    const document = baseDocument({
      artworkMode: "professional_pdf_upload_only",
      artworkModeReasonDa: "Efterbehandlingen kræver en separat spotfarvemaske i en professionel PDF.",
      onlineDesignerAllowed: false,
      designerLoadMode: "download_only",
      lockedInDesigner: false,
      nonPrintingOverlay: false,
      excludedFromExport: false,
      verificationStatus: "not_applicable",
    });
    const result = validate(writeManifest(directory, document));
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v2 rejects a professional-only binding wired into Designer", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "import-manifest-v2-reject-"));
  try {
    const document = baseDocument({
      artworkMode: "professional_pdf_upload_only",
      artworkModeReasonDa: "Efterbehandlingen kræver en separat spotfarvemaske i en professionel PDF.",
      onlineDesignerAllowed: false,
      designerLoadMode: "download_only",
      lockedInDesigner: false,
      nonPrintingOverlay: false,
      excludedFromExport: false,
      designerTemplateId: "53122c85-e132-4b63-b621-c82f98cc5e03",
      verificationStatus: "not_applicable",
    });
    const result = validate(writeManifest(directory, document));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /designerTemplateId must be null/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
