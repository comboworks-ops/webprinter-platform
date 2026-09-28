import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_AXIS_ORDER,
  FOLDER_MODEL_SIZE_GROUPS,
  MASTER_TENANT_ID,
  TARGET_SLUG,
  buildDesignerTemplateRow,
  buildGenericPriceRow,
  buildPricingStructure,
  buildProductPayload,
  buildResolvedCatalog,
  buildTemplateFile,
  immutableObjectPath,
  parseArgs,
  refuseTargetCollision,
} from "../import-wmd-sales-folder-product-draft.js";
import { templateMatchesSelectedConfiguration } from "../../../src/lib/designer/productTemplateLinks.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WRITER_PATH = path.resolve(TEST_DIR, "../import-wmd-sales-folder-product-draft.js");

const groups = [
  {
    key: "folder_model",
    labelDa: "Mappemodel",
    displayType: "icon_grid",
    sourceOrder: 0,
    values: [{ key: "a4-standard", labelDa: "A4 standard", formatKey: "a4", sourceOrder: 0 }],
  },
  {
    key: "print",
    labelDa: "Tryk",
    displayType: "buttons",
    sourceOrder: 1,
    values: [
      { key: "4+0", labelDa: "4+0", sourceOrder: 0 },
      { key: "4+4", labelDa: "4+4", sourceOrder: 1 },
    ],
  },
  {
    key: "spine",
    labelDa: "Rygbredde",
    displayType: "buttons",
    sourceOrder: 2,
    values: [{ key: "1mm", labelDa: "1 mm", sourceOrder: 0 }],
  },
  {
    key: "paper",
    labelDa: "Papir og karton",
    displayType: "buttons",
    sourceOrder: 3,
    values: [{ key: "chromo", labelDa: "Chromo", sourceOrder: 0 }],
  },
  {
    key: "finish",
    labelDa: "Efterbehandling",
    displayType: "dropdown",
    sourceOrder: 4,
    values: [
      { key: "none", labelDa: "Ingen", sourceOrder: 0 },
      { key: "partial-uv", labelDa: "Partiel UV", sourceOrder: 1 },
    ],
  },
];

function fixture() {
  const productId = "11111111-1111-4111-8111-111111111111";
  const iconUrls = new Map([["a4-standard", "https://assets.example.test/a4.png"]]);
  const resolved = buildResolvedCatalog(groups, productId, iconUrls);
  const pricingStructure = buildPricingStructure(groups, resolved, [50, 100], iconUrls);
  return { productId, iconUrls, resolved, pricingStructure };
}

test("write gates are independent and product draft requires the bank-write gate", () => {
  assert.equal(parseArgs([]).dryRun, true);
  const bank = parseArgs(["--confirm-bank-write"]);
  assert.equal(bank.confirmBankWrite, true);
  assert.equal(bank.confirmProductDraft, false);
  assert.equal(bank.dryRun, false);
  assert.throws(
    () => parseArgs(["--confirm-product-draft"]),
    /requires --confirm-bank-write/,
  );
  const product = parseArgs(["--confirm-bank-write", "--confirm-product-draft"]);
  assert.equal(product.confirmBankWrite, true);
  assert.equal(product.confirmProductDraft, true);
});

test("immutable paths are run- and SHA-addressed", () => {
  const hash = "a".repeat(64);
  assert.equal(
    immutableObjectPath({
      runId: "Sales Folder 2026",
      sha256: hash,
      fileName: "source.PDF",
      namespace: "template-pdfs/sales-folders",
    }),
    `template-pdfs/sales-folders/sales-folder-2026/${hash}.pdf`,
  );
});

test("catalog preserves five-axis order and backend-editable model visuals", () => {
  const { resolved, pricingStructure } = fixture();
  assert.deepEqual(pricingStructure.customerSelectionOrder, EXPECTED_AXIS_ORDER);
  assert.equal(pricingStructure.autoResolveExactCombination, true);
  assert.equal(pricingStructure.vertical_axis.sectionId, "sales-folder-paper");
  assert.equal(pricingStructure.vertical_axis.sectionType, "materials");
  assert.deepEqual(
    pricingStructure.layout_rows[0].columns.map((column) => column.id),
    ["sales-folder-folder_model", "sales-folder-print", "sales-folder-spine", "sales-folder-finish"],
  );
  const modelValue = resolved.get("folder_model").values[0];
  const modelSection = pricingStructure.layout_rows[0].columns[0];
  const spineSection = pricingStructure.layout_rows[0].columns[2];
  assert.deepEqual(modelSection.valueIds, [modelValue.id]);
  assert.equal(modelSection.ui_mode, "buttons");
  assert.deepEqual(modelSection.valueGroups, [{ id: "a4", label: "A4", valueIds: [modelValue.id] }]);
  assert.equal(modelSection.valueSettings[modelValue.id].customImage, "https://assets.example.test/a4.png");
  assert.equal(modelSection.valueSettings[modelValue.id].imageSizePx, 128);
  assert.equal(modelSection.valueSettings[modelValue.id].showThumbnail, false);
  assert.equal(spineSection.hideUnavailableValues, true);
  assert.equal(resolved.get("finish").group.ui_mode, "dropdown");
});

test("folder models are grouped by customer-facing size while DIN lang is presented as M65", () => {
  const folderValues = FOLDER_MODEL_SIZE_GROUPS.map((group, index) => ({
    key: `${group.formatKey}--model`,
    labelDa: `${group.formatKey === "din-lang" ? "DIN lang" : group.label} · model ${index + 1}`,
    formatKey: group.formatKey,
    sourceOrder: index,
  }));
  const groupedFixture = groups.map((group) => (
    group.key === "folder_model" ? { ...group, values: folderValues } : group
  ));
  const productId = "11111111-1111-4111-8111-111111111111";
  const iconUrls = new Map(folderValues.map((value) => [
    value.key,
    `https://assets.example.test/${value.key}.png`,
  ]));
  const resolved = buildResolvedCatalog(groupedFixture, productId, iconUrls);
  const pricingStructure = buildPricingStructure(groupedFixture, resolved, [50], iconUrls);
  const modelSection = pricingStructure.layout_rows[0].columns[0];

  assert.deepEqual(
    modelSection.valueGroups.map((group) => group.label),
    ["A4", "A5", "A6", "M65", "21 × 21 cm"],
  );
  assert.deepEqual(modelSection.valueGroups.map((group) => group.valueIds.length), [1, 1, 1, 1, 1]);
  const m65Value = resolved.get("folder_model").valueByKey.get("din-lang--model");
  assert.match(modelSection.valueSettings[m65Value.id].displayName, /^M65 ·/);
  assert.equal(modelSection.valueSettings[m65Value.id].showThumbnail, false);
  assert.ok(modelSection.valueSettings[m65Value.id].customImage);
});

test("exact sparse price rows use paper vertically and all other UUIDs as the variant", () => {
  const { productId, resolved, pricingStructure } = fixture();
  const record = {
    sourceOrder: 0,
    selections: {
      folder_model: "a4-standard",
      print: "4+0",
      spine: "1mm",
      paper: "chromo",
      finish: "none",
    },
    quantity: 50,
    supplierPrice: 34.65,
    supplierCurrency: "EUR",
    convertedPriceDkk: 259.875,
    finalPriceDkk: 416,
    conversionRuleKey: "wmd_tiered_fx_7_5",
    sourceEvidence: { sourceUrl: "https://www.wir-machen-druck.de/product" },
  };
  const row = buildGenericPriceRow({
    record,
    productId,
    resolved,
    pricingStructure,
    bank: { bankProductId: "bank-product", priceSnapshotId: "snapshot" },
  });
  const paperId = resolved.get("paper").valueByKey.get("chromo").id;
  assert.equal(row.variant_value, paperId);
  assert.equal(row.price_dkk, 416);
  assert.equal(row.extra_data.selectionMap.paper, paperId);
  assert.equal(row.extra_data.selectionMap.folder_model, row.extra_data.formatId);
  assert.equal(row.extra_data.materialId, paperId);
  assert.equal(row.extra_data.noInterpolation, true);
  assert.deepEqual(
    row.variant_name.split("|").sort(),
    row.extra_data.variantValueIds.slice().sort(),
  );
});

test("online and professional template bindings stay distinct", () => {
  const { resolved, pricingStructure } = fixture();
  const common = {
    sourceOrder: 0,
    documentKey: "a4-standard-4-0-1mm-chromo-none",
    match: {
      folder_model: "a4-standard",
      print: "4+0",
      spine: "1mm",
      paper: "chromo",
      finish: "none",
    },
    guide: { nativeGuideKey: "native-guide" },
  };
  const online = buildTemplateFile({
    document: {
      ...common,
      template: {
        artworkMode: "online_designer",
        sanitizedPdfSha256: "b".repeat(64),
        storageObjectPath: "template-pdfs/online.pdf",
        widthMm: 450,
        heightMm: 317,
        bleedMm: 5,
        safeMm: 3,
        pageCount: 2,
      },
    },
    resolved,
    pricingStructure,
    pdfUrl: "https://assets.example.test/online.pdf",
    designerTemplateId: "22222222-2222-4222-8222-222222222222",
    uploadedAt: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(online.selectionConstraintProfile, "sales_folder_v1");
  assert.equal(online.format, "A4 standard");
  assert.equal(online.configuration, "4+0 · 1 mm · Chromo · Ingen");
  assert.equal(online.sourceConfigurationKey, common.documentKey);
  assert.equal(templateMatchesSelectedConfiguration(
    online,
    null,
    "A4 standard",
    ["A4 standard", "4+0", "1 mm", "Chromo", "Ingen"],
  ), true);
  assert.equal(templateMatchesSelectedConfiguration(
    online,
    null,
    "A4 standard",
    ["A4 standard", "4+0", "1 mm", "Chromo", "Partiel UV"],
  ), false);
  assert.deepEqual(Object.keys(online.selectionConstraintSections), EXPECTED_AXIS_ORDER);
  assert.equal(Object.keys(online.selectionConstraints).length, 5);
  assert.equal(online.lockedInDesigner, true);
  assert.equal(online.excludedFromExport, true);
  assert.ok(online.designerTemplateId);

  const professional = buildTemplateFile({
    document: {
      ...common,
      documentKey: "a4-standard-4-0-1mm-chromo-partial-uv",
      match: { ...common.match, finish: "partial-uv" },
      template: {
        artworkMode: "professional_pdf_upload_only",
        artworkModeReasonDa: "Kræver staffagefarve og professionel tryk-PDF.",
        sanitizedPdfSha256: "c".repeat(64),
        storageObjectPath: "template-pdfs/professional.pdf",
        widthMm: 450,
        heightMm: 317,
        bleedMm: 5,
        safeMm: 3,
        pageCount: 2,
      },
    },
    resolved,
    pricingStructure,
    pdfUrl: "https://assets.example.test/professional.pdf",
    designerTemplateId: null,
    uploadedAt: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(professional.designerTemplateId, null);
  assert.equal(professional.designerLoadMode, "download_only");
  assert.equal(professional.lockedInDesigner, false);
  assert.equal(professional.nonPrintingOverlay, false);
  assert.equal(professional.excludedFromExport, false);
  assert.match(professional.artworkModeReasonDa, /professionel/);
  assert.throws(
    () => buildTemplateFile({
      document: {
        ...common,
        match: { ...common.match, finish: "partial-uv" },
        template: {
          artworkMode: "professional_pdf_upload_only",
          sanitizedPdfSha256: "d".repeat(64),
          storageObjectPath: "professional.pdf",
        },
      },
      resolved,
      pricingStructure,
      pdfUrl: "https://assets.example.test/professional.pdf",
      designerTemplateId: "33333333-3333-4333-8333-333333333333",
      uploadedAt: "2026-09-01T00:00:00.000Z",
    }),
    /must not receive a Designer ID/,
  );
});

test("only reviewed, explicitly axis-labelled guide geometry reaches storefront template files", () => {
  const { resolved, pricingStructure } = fixture();
  const document = {
    sourceOrder: 0,
    documentKey: "reviewed-guide",
    match: {
      folder_model: "a4-standard",
      print: "4+0",
      spine: "1mm",
      paper: "chromo",
      finish: "none",
    },
    guide: {
      nativeGuideKey: "native-guide",
      factsReviewed: true,
      displayedFacts: {
        minimumResolutionDpi: { status: "evidenced", value: 300 },
        colorMode: { status: "evidenced", value: "CMYK" },
        folds: {
          status: "evidenced",
          value: {
            supplierFoldLinesPresent: true,
            count: 2,
            positionsMm: [110, 220],
            sanitizedTemplateFoldLayerPreserved: true,
          },
        },
      },
      facts: {
        minimumResolutionDpi: { status: "evidenced", value: 72 },
        colorMode: { status: "evidenced", value: "RGB" },
      },
      guideGeometry: {
        pages: [{
          page: 1,
          label: "Forside",
          widthMm: 450,
          heightMm: 317,
          foldLines: [
            { axis: "vertical", positionMm: 110 },
            { axis: "vertical", positionMm: 220 },
          ],
        }],
      },
    },
    template: {
      artworkMode: "online_designer",
      sanitizedPdfSha256: "9".repeat(64),
      storageObjectPath: "reviewed.pdf",
      widthMm: 450,
      heightMm: 317,
      bleedMm: 5,
      safeMm: 3,
      pageCount: 1,
    },
  };
  const linked = buildTemplateFile({
    document,
    resolved,
    pricingStructure,
    pdfUrl: "https://assets.example.test/reviewed.pdf",
    designerTemplateId: "55555555-5555-4555-8555-555555555555",
    uploadedAt: "2026-09-01T00:00:00.000Z",
  });
  assert.deepEqual(linked.guideGeometry, document.guide.guideGeometry);
  assert.equal(linked.nativeGuideFacts.minimumResolutionDpi, 300);
  assert.equal(linked.nativeGuideFacts.colorMode, "CMYK");
  assert.deepEqual(linked.nativeGuideFacts.folds.positionsMm, [110, 220]);

  const unreviewed = buildTemplateFile({
    document: { ...document, guide: { ...document.guide, factsReviewed: false } },
    resolved,
    pricingStructure,
    pdfUrl: "https://assets.example.test/unreviewed.pdf",
    designerTemplateId: "66666666-6666-4666-8666-666666666666",
    uploadedAt: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(unreviewed.guideGeometry, undefined);
  assert.equal(unreviewed.nativeGuideFacts, undefined);
});

test("Designer rows are active but stay private while the product is an unpublished draft", () => {
  const row = buildDesignerTemplateRow({
    pdf: {
      artworkMode: "online_designer",
      sha256: "7".repeat(64),
      widthMm: 450,
      heightMm: 317,
      bleedMm: 5,
      safeMm: 3,
    },
    uploadedPdf: { url: "https://assets.example.test/template.pdf" },
    id: "77777777-7777-4777-8777-777777777777",
    sortOrder: 0,
  });
  assert.equal(row.tenant_id, MASTER_TENANT_ID);
  assert.equal(row.is_active, true);
  assert.equal(row.is_public, false);
  assert.equal(row.template_pdf_url, "https://assets.example.test/template.pdf");
  assert.equal(row.dpi_default, 300);
  assert.equal(row.color_profile, "FOGRA39");
  assert.throws(
    () => buildDesignerTemplateRow({
      pdf: { artworkMode: "professional_pdf_upload_only", sha256: "8".repeat(64) },
      uploadedPdf: { url: "https://assets.example.test/professional.pdf" },
      id: "88888888-8888-4888-8888-888888888888",
      sortOrder: 0,
    }),
    /only online_designer PDFs/,
  );
});

test("product payload is always an unavailable unpublished tryksager draft", () => {
  const { productId, pricingStructure } = fixture();
  const payload = buildProductPayload({
    manifest: {
      runId: "run-1",
      product: {
        sourceKey: "wmd-sales-folders",
        nameDa: "Salgsmapper med eget design",
        descriptionDa: "Beskrivelse",
        categoryDa: "Salgsmapper",
      },
      storefront: { category: "wrong-category" },
    },
    productId,
    heroUrl: "https://assets.example.test/hero.png",
    pricingStructure,
    templateFiles: [],
    preflight: {
      manifestSha256: "e".repeat(64),
      pricingArtifact: { sha256: "f".repeat(64) },
      documentArtifact: { sha256: "1".repeat(64) },
      pricingSummary: { quantities: [50] },
      documentSummary: { minimumDpi: 300, colorMode: "CMYK" },
    },
    bank: { bankProductId: "bank-product", priceSnapshotId: "snapshot" },
  });
  assert.equal(payload.tenant_id, MASTER_TENANT_ID);
  assert.equal(payload.slug, TARGET_SLUG);
  assert.equal(payload.category, "tryksager");
  assert.equal(payload.default_quantity, 50);
  assert.equal(payload.is_published, false);
  assert.equal(payload.is_available_to_tenants, false);
  assert.equal(payload.is_ready, false);
  assert.equal(payload.technical_specs.min_dpi, 300);
  assert.equal(payload.technical_specs.min_dpi_source, "reviewed_native_guide_facts");
  assert.equal(payload.technical_specs.color_mode, "CMYK");
  assert.equal(payload.technical_specs.color_mode_source, "reviewed_native_guide_facts");
});

function collisionClient(row) {
  const query = {
    select() { return query; },
    eq() { return query; },
    async maybeSingle() { return { data: row, error: null }; },
  };
  return { from() { return query; } };
}

test("exact master-tenant slug collisions always refuse instead of updating", async () => {
  await refuseTargetCollision(collisionClient(null));
  await assert.rejects(
    refuseTargetCollision(collisionClient({
      id: "44444444-4444-4444-8444-444444444444",
      tenant_id: MASTER_TENANT_ID,
      slug: TARGET_SLUG,
      is_published: false,
    })),
    /Collision:.*no existing product was changed/,
  );
});

test("writer contains no upsert, update, delete, overwrite, or live publication path", () => {
  const source = fs.readFileSync(WRITER_PATH, "utf8");
  assert.doesNotMatch(source, /\.upsert\s*\(/);
  assert.doesNotMatch(source, /\.from\([^)]*\)[\s\S]{0,120}\.update\s*\(/);
  assert.doesNotMatch(source, /\.delete\s*\(/);
  assert.match(source, /upsert:\s*false/);
  assert.doesNotMatch(source, /is_published:\s*true/);
  assert.doesNotMatch(source, /is_available_to_tenants:\s*true/);
  assert.doesNotMatch(source, /is_ready:\s*true/);
});
