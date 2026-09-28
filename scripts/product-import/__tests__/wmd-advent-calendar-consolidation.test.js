import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  resolveSelectedDesignerTemplateLaunch,
  templateHasSelectionConstraints,
} from "../../../src/lib/designer/productTemplateLinks.ts";
import { resolveMatrixLinkedTemplateId } from "../../../src/lib/designer/linkedTemplates.ts";
import {
  buildCombinedCalendarPackage,
  buildCombinedPriceRows,
  buildCombinedPricingStructure,
  buildCombinedTemplateFiles,
  mergeExistingCalendarPriceRows,
  validateExistingCalendarPriceCoverage,
} from "../build-wmd-advent-calendar-consolidated-product.js";

const RUN_DIR = path.resolve(
  process.cwd(),
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);

function buildFixture() {
  return buildCombinedCalendarPackage({
    runDir: RUN_DIR,
    materialize: false,
    generatedAt: "2026-08-28T00:00:00.000Z",
  });
}

function buildResolvedGroups(manifest) {
  return new Map(manifest.optionGroups.map((group, groupIndex) => [
    group.key,
    {
      group: { id: `group-${groupIndex}-${group.key}` },
      valueByKey: new Map(group.values.map((value, valueIndex) => [
        value.key,
        { id: `value-${groupIndex}-${String(valueIndex).padStart(2, "0")}` },
      ])),
    },
  ]));
}

function buildSourceAssets(manifest) {
  const models = manifest.optionGroups.find((group) => group.key === "calendar_model").values;
  const variants = manifest.optionGroups.find((group) => group.key === "variant").values;
  return {
    modelImageUrlByKey: new Map(
      models.map((model) => [model.key, `https://assets.example.test/models/${model.key}.png`]),
    ),
    variantImageUrlByKey: new Map(
      variants
        .filter((variant) => ["filling", "format"].includes(variant.presentationKind))
        .map((variant) => [variant.key, `https://assets.example.test/options/${variant.key}.png`]),
    ),
    sourceTemplateFileByDocumentKey: new Map(
      manifest.documents.map((document) => [document.key, {
        name: `Source ${document.key}`,
        format: document.match.calendar_model === "julekalender-multi"
          ? "412 × 307 mm"
          : (document.template.finalFormat || "Kildeformat"),
        designerTemplateId: document.template.designerTemplateId,
        pdfUrl: `https://assets.example.test/templates/${document.key}.pdf`,
      }]),
    ),
    pdfUrlByDocumentKey: new Map(
      manifest.documents.map((document) => [
        document.key,
        `https://assets.example.test/templates/${document.key}.pdf`,
      ]),
    ),
  };
}

test("combined calendar extraction has 14 models, 30 compatible variants, 514 exact prices and 28 exact templates", () => {
  const bundle = buildFixture();
  const { manifest, validation } = bundle;
  const modelGroup = manifest.optionGroups.find((group) => group.key === "calendar_model");
  const variantGroup = manifest.optionGroups.find((group) => group.key === "variant");

  assert.deepEqual(validation, {
    models: 14,
    variants: 30,
    prices: 514,
    documents: 28,
    uniquePriceRows: 514,
    uniqueTemplateIds: 28,
    auditedVerifiedRuntimeProofs: 2,
    auditedPendingRuntimeProofs: 26,
    canonicalPendingRuntimeProofs: 28,
  });
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.target.state, "extracted");
  assert.equal(manifest.target.publishProduct, false);
  assert.equal(manifest.target.writeLivePricing, false);
  assert.deepEqual(manifest.templateBindingAxes, ["calendar_model", "technical_template_variant"]);

  assert.equal(modelGroup.displayType, "buttons");
  assert.equal(modelGroup.values.length, 14);
  assert.ok(modelGroup.values.every((model) => model.visual.transparent === false));
  assert.ok(modelGroup.values.every((model) => model.visual.status === "clean_white_background_draft"));
  assert.ok(modelGroup.values.every((model) => model.details.descriptionDa));
  assert.ok(modelGroup.values.every((model) => model.details.formatLabels.length > 0));
  assert.ok(modelGroup.values.every((model) => model.details.materialLabels.length > 0));
  assert.ok(modelGroup.values.some((model) => model.details.printLabelDa === "4/0-farvet tryk"));
  assert.equal(variantGroup.displayType, "dropdown");
  assert.equal(variantGroup.hideUnavailableValues, true);
  assert.equal(variantGroup.values.length, 30);

  const premiumWallVariants = variantGroup.values.filter(
    (variant) => variant.modelKey === "premium-vaegjulekalender",
  );
  assert.equal(premiumWallVariants.length, 4);
  assert.equal(new Set(premiumWallVariants.map((variant) => variant.technicalTemplateVariant)).size, 2);

  assert.ok(manifest.documents.every((document) => (
    document.template.designerVerification.status === "pending"
    && document.template.designerVerification.evidencePath === null
  )));
  assert.deepEqual(manifest.verification.sourceDesignerRuntimeProofAudit, {
    verified: 2,
    pending: 26,
    total: 28,
  });

  for (const record of manifest.pricing.records) {
    assert.equal(record.quantity, record.sourceRecord.quantity);
    assert.equal(record.supplierPrice, record.sourceRecord.supplierPrice);
    assert.equal(record.convertedPriceDkk, record.sourceRecord.convertedPriceDkk);
    assert.equal(record.finalPriceDkk, record.sourceRecord.finalPriceDkk);
    assert.equal(record.sourceUrl, record.sourceRecord.sourceUrl);
  }
});

test("database plan uses one technical vertical, large editable model pictures and a filtered variant dropdown", () => {
  const { manifest } = buildFixture();
  const resolvedGroups = buildResolvedGroups(manifest);
  const sourceAssets = buildSourceAssets(manifest);
  const firstModel = manifest.optionGroups.find((group) => group.key === "calendar_model").values[0];
  const firstVariant = manifest.optionGroups.find((group) => group.key === "variant").values[0];
  const firstModelId = resolvedGroups.get("calendar_model").valueByKey.get(firstModel.key).id;
  const firstVariantId = resolvedGroups.get("variant").valueByKey.get(firstVariant.key).id;
  const existingStructure = {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {},
    layout_rows: [
      {
        columns: [{
          id: "calendar-model-section",
          valueIds: [firstModelId],
          ui_mode: "xl",
          thumbnail_size: "xl",
          thumbnail_custom_px: 212,
          valueSettings: {
            [firstModelId]: {
              showThumbnail: true,
              customImage: "https://assets.example.test/admin-edited-model.png",
              imageSizePx: 204,
            },
          },
        }],
      },
      {
        columns: [{
          id: "calendar-variant-section",
          valueIds: [firstVariantId],
          valueSettings: {
            [firstVariantId]: {
              showThumbnail: true,
              customImage: "https://assets.example.test/admin-edited-option.png",
              imageSizePx: 72,
            },
          },
        }],
      },
    ],
  };

  const pricingStructure = buildCombinedPricingStructure({
    manifest,
    resolvedGroups,
    sourceAssets,
    existingStructure,
  });
  const modelSection = pricingStructure.layout_rows[0].columns[0];
  const variantSection = pricingStructure.layout_rows[1].columns[0];

  assert.equal(pricingStructure.vertical_axis.sectionType, "products");
  assert.equal(pricingStructure.vertical_axis.valueIds.length, 1);
  assert.equal(modelSection.sectionType, "materials");
  assert.equal(modelSection.ui_mode, "xl");
  assert.equal(modelSection.thumbnail_custom_px, 212);
  assert.equal(modelSection.valueIds.length, 14);
  assert.equal(modelSection.valueSettings[firstModelId].customImage, "https://assets.example.test/admin-edited-model.png");
  assert.equal(modelSection.valueSettings[firstModelId].imageSizePx, 204);
  assert.equal(modelSection.focusSelectedValue, true);
  assert.equal(modelSection.neutralWhiteSurface, true);
  assert.equal(variantSection.sectionType, "formats");
  assert.equal(variantSection.ui_mode, "dropdown");
  assert.equal(variantSection.hideUnavailableValues, true);
  assert.equal(variantSection.hide_unavailable_values, true);
  assert.equal(variantSection.adaptiveImageSelector, true);
  assert.equal(variantSection.hideSingleAvailableValue, true);
  assert.equal(variantSection.neutralWhiteSurface, true);
  assert.equal(variantSection.valueIds.length, 30);
  assert.equal(
    variantSection.valueSettings[firstVariantId].customImage,
    "https://assets.example.test/admin-edited-option.png",
  );
  assert.equal(variantSection.valueSettings[firstVariantId].imageSizePx, 72);
  assert.equal(pricingStructure.hideUnavailableQuantities, true);
  assert.equal(pricingStructure.hide_unavailable_quantities, true);

  const variants = manifest.optionGroups.find((group) => group.key === "variant").values;
  for (const variant of variants) {
    const valueId = resolvedGroups.get("variant").valueByKey.get(variant.key).id;
    assert.equal(variantSection.valueSettings[valueId].linkedTemplateId, variant.linkedTemplateId);
    assert.equal(variantSection.valueSettings[valueId].showThumbnail, true);
    if (valueId !== firstVariantId) {
      assert.ok(variantSection.valueSettings[valueId].customImage.startsWith("https://assets.example.test/options/"));
    }
  }

  const rows = buildCombinedPriceRows({
    manifest,
    productId: "combined-product-id",
    resolvedGroups,
    pricingStructure,
  });
  assert.equal(rows.length, 514);
  assert.equal(new Set(rows.map((row) => [
    row.variant_name,
    row.variant_value,
    row.quantity,
  ].join("::"))).size, 514);
  rows.forEach((row, index) => {
    assert.equal(row.price_dkk, manifest.pricing.records[index].finalPriceDkk);
    assert.equal(row.extra_data.supplierPriceEur, manifest.pricing.records[index].supplierPrice);
    assert.equal(row.extra_data.convertedPriceDkk, manifest.pricing.records[index].convertedPriceDkk);
    assert.equal(row.extra_data.verificationDraft, true);
  });
});

test("combined product reuses all existing Designer ids and PDF URLs without creating template records", () => {
  const { manifest } = buildFixture();
  const sourceAssets = buildSourceAssets(manifest);
  const templateFiles = buildCombinedTemplateFiles({ manifest, sourceAssets });

  assert.equal(templateFiles.length, 28);
  assert.equal(new Set(templateFiles.map((file) => file.designerTemplateId)).size, 28);
  assert.ok(templateFiles.every((file) => file.pdfUrl.startsWith("https://assets.example.test/templates/")));
  assert.ok(templateFiles.every((file) => file.url === file.pdfUrl));
  assert.ok(templateFiles.every((file) => file.designerVerification.status === "pending"));
  assert.ok(templateFiles.every((file) => file.format === null));
  assert.ok(templateFiles.every((file) => file.sourceFormat));

  const premiumWallFiles = templateFiles.filter(
    (file) => file.calendarModelKey === "premium-vaegjulekalender",
  );
  assert.equal(premiumWallFiles.length, 2);
  assert.ok(premiumWallFiles.every((file) => file.compatibleVariantKeys.length === 2));
});

test("refreshing the unpublished draft preserves backend-edited prices and provenance without changing matrix routing", () => {
  const { manifest } = buildFixture();
  const resolvedGroups = buildResolvedGroups(manifest);
  const sourceAssets = buildSourceAssets(manifest);
  const pricingStructure = buildCombinedPricingStructure({ manifest, resolvedGroups, sourceAssets });
  const desiredRows = buildCombinedPriceRows({
    manifest,
    productId: "combined-product-id",
    resolvedGroups,
    pricingStructure,
  });
  const desired = desiredRows[0];
  const existing = {
    ...desired,
    price_dkk: 987.65,
    extra_data: {
      ...desired.extra_data,
      adminNote: "Manuelt justeret",
      verticalAxisValueId: "unsafe-stale-value",
    },
  };

  const merged = mergeExistingCalendarPriceRows({
    desiredRows,
    existingRows: [existing],
  });
  assert.equal(merged.preservedExistingPrices, 1);
  assert.equal(merged.rows[0].price_dkk, 987.65);
  assert.equal(merged.rows[0].extra_data.adminNote, "Manuelt justeret");
  assert.equal(
    merged.rows[0].extra_data.verticalAxisValueId,
    desired.extra_data.verticalAxisValueId,
  );
  assert.deepEqual(merged.rows[0].extra_data.selectionMap, desired.extra_data.selectionMap);
  assert.equal(merged.rows[1].price_dkk, desiredRows[1].price_dkk);

  const protectedCoverage = validateExistingCalendarPriceCoverage({
    desiredRows,
    existingRows: merged.rows,
  });
  assert.equal(protectedCoverage.writeSkipped, true);
  assert.equal(protectedCoverage.preservedExistingPrices, 514);
});

test("Celebrations resolves its exact Designer template without requiring the source physical format as a hidden choice", () => {
  const { manifest } = buildFixture();
  const resolvedGroups = buildResolvedGroups(manifest);
  const sourceAssets = buildSourceAssets(manifest);
  const pricingStructure = buildCombinedPricingStructure({
    manifest,
    resolvedGroups,
    sourceAssets,
  });
  const templateFiles = buildCombinedTemplateFiles({ manifest, sourceAssets });
  const models = manifest.optionGroups.find((group) => group.key === "calendar_model").values;
  const variants = manifest.optionGroups.find((group) => group.key === "variant").values;
  const model = models.find((value) => value.key === "julekalender-multi");
  const variant = variants.find((value) => (
    value.modelKey === model.key && value.labelDa === "Celebrations"
  ));
  const modelValueId = resolvedGroups.get("calendar_model").valueByKey.get(model.key).id;
  const variantValueId = resolvedGroups.get("variant").valueByKey.get(variant.key).id;
  const technicalValueId = resolvedGroups.get("technical_product").valueByKey.get("julekalender").id;
  const selectedSectionValues = {
    [pricingStructure.vertical_axis.sectionId]: technicalValueId,
    [pricingStructure.layout_rows[0].columns[0].id]: modelValueId,
    [pricingStructure.layout_rows[1].columns[0].id]: variantValueId,
  };

  const matchingFile = templateFiles.find((file) => (
    file.designerTemplateId === variant.linkedTemplateId
  ));
  assert.equal(matchingFile.sourceFormat, "412 × 307 mm");
  assert.equal(matchingFile.format, null);
  assert.equal(templateFiles.some(templateHasSelectionConstraints), true);

  const launch = resolveSelectedDesignerTemplateLaunch({
    templates: templateFiles,
    selectedFormat: variantValueId,
    selectedFormatLabel: variant.labelDa,
    selectedOptionLabels: [model.labelDa, variant.labelDa],
  });
  assert.equal(launch?.templateId, variant.linkedTemplateId);
  assert.equal(
    resolveMatrixLinkedTemplateId(pricingStructure, selectedSectionValues),
    variant.linkedTemplateId,
  );
});
