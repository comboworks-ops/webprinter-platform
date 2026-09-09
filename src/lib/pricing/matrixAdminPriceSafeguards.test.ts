import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDependencyFilteredPriceOnlyRows,
  getDependencyFilteredCombinationKeys,
  getDependencyFilteredGeneratorKeys,
  getMatrixAdminGeneratorKeyFromPriceRow,
  isDependencyFilteredMatrix,
  preserveMatrixAdminPricingStructure,
} from "./matrixAdminPriceSafeguards.ts";

const technicalVerticalId = "technical-calendar";
const modelId = "model-multi";
const kinderId = "filling-kinder";
const lindtId = "filling-lindt";

const dependencyStructure = {
  mode: "matrix_layout_v1",
  version: 1,
  hideUnavailableQuantities: true,
  hide_unavailable_quantities: true,
  customRuntimeFlag: "keep-me",
  vertical_axis: {
    sectionId: "technical-axis",
    sectionType: "products",
    groupId: "technical-group",
    valueIds: [technicalVerticalId],
    valueSettings: {
      [technicalVerticalId]: { displayName: "Julekalender" },
    },
  },
  layout_rows: [
    {
      id: "model-row",
      columns: [
        {
          id: "model-section",
          sectionType: "materials",
          groupId: "model-group",
          valueIds: [modelId],
          ui_mode: "xl",
          valueSettings: {
            [modelId]: {
              displayName: "Multi",
              customImage: "/multi.png",
            },
          },
          focusSelectedValue: true,
          neutralWhiteSurface: true,
        },
      ],
    },
    {
      id: "filling-row",
      columns: [
        {
          id: "filling-section",
          sectionType: "formats",
          groupId: "filling-group",
          valueIds: [kinderId, lindtId],
          ui_mode: "dropdown",
          hideUnavailableValues: true,
          hide_unavailable_values: true,
          valueSettings: {
            [kinderId]: {
              displayName: "Kinder",
              linkedTemplateId: "template-kinder",
            },
            [lindtId]: {
              displayName: "Lindt",
              linkedTemplateId: "template-lindt",
            },
          },
        },
      ],
    },
  ],
  quantities: [1, 10],
};

const existingRows = [
  {
    id: "price-kinder-1",
    product_id: "calendar-product",
    variant_name: [modelId, kinderId].sort().join("|"),
    variant_value: technicalVerticalId,
    quantity: 1,
    price_dkk: 199,
    extra_data: {
      verticalAxisValueId: technicalVerticalId,
      formatId: kinderId,
      materialId: modelId,
      variantId: null,
      linkedTemplateId: "template-kinder",
      supplierPriceEur: 12.34,
      sourceUrl: "https://supplier.example/kinder",
      combinedImportSourceKey: "calendar-import",
    },
  },
  {
    id: "price-lindt-10",
    product_id: "calendar-product",
    variant_name: [modelId, lindtId].sort().join("|"),
    variant_value: technicalVerticalId,
    quantity: 10,
    price_dkk: 699,
    extra_data: {
      verticalAxisValueId: technicalVerticalId,
      formatId: lindtId,
      materialId: modelId,
      variantId: null,
      linkedTemplateId: "template-lindt",
      supplierPriceEur: 54.32,
      sourceUrl: "https://supplier.example/lindt",
      combinedImportSourceKey: "calendar-import",
    },
  },
];

test("recognizes a dependency-filtered Matrix product", () => {
  assert.equal(isDependencyFilteredMatrix(dependencyStructure), true);
  assert.equal(isDependencyFilteredMatrix({
    ...dependencyStructure,
    layout_rows: dependencyStructure.layout_rows.map((row) => ({
      ...row,
      columns: row.columns.map((column) => ({
        ...column,
        hideUnavailableValues: false,
        hide_unavailable_values: false,
      })),
    })),
  }), false);
});

test("preserves dependency flags, linked templates, and unknown structure fields", () => {
  const genericAdminDraft = {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {
      ...dependencyStructure.vertical_axis,
      title: "Julekalender",
    },
    layout_rows: dependencyStructure.layout_rows.map((row) => ({
      id: row.id,
      columns: row.columns.map((column) => ({
        id: column.id,
        sectionType: column.sectionType,
        groupId: column.groupId,
        valueIds: column.valueIds,
        ui_mode: column.ui_mode,
        valueSettings: column.valueSettings,
      })),
    })),
    quantities: [1, 10],
  };

  const preserved = preserveMatrixAdminPricingStructure(
    dependencyStructure,
    genericAdminDraft,
  );
  const modelSection = preserved.layout_rows[0].columns[0];
  const fillingSection = preserved.layout_rows[1].columns[0];

  assert.ok("focusSelectedValue" in modelSection);
  assert.ok("neutralWhiteSurface" in modelSection);
  assert.ok("hideUnavailableValues" in fillingSection);
  assert.ok("hide_unavailable_values" in fillingSection);

  assert.equal(preserved.hideUnavailableQuantities, true);
  assert.equal(preserved.hide_unavailable_quantities, true);
  assert.equal(preserved.customRuntimeFlag, "keep-me");
  assert.equal(modelSection.focusSelectedValue, true);
  assert.equal(modelSection.neutralWhiteSurface, true);
  assert.equal(fillingSection.hideUnavailableValues, true);
  assert.equal(fillingSection.hide_unavailable_values, true);
  assert.equal(
    fillingSection.valueSettings[kinderId].linkedTemplateId,
    "template-kinder",
  );
});

test("price-only rows keep the technical vertical key and supplier provenance", () => {
  const kinderKey = getMatrixAdminGeneratorKeyFromPriceRow(existingRows[0]);
  const lindtKey = getMatrixAdminGeneratorKeyFromPriceRow(existingRows[1]);
  assert.equal(kinderKey, `${kinderId}::${modelId}::none::1`);
  assert.equal(lindtKey, `${lindtId}::${modelId}::none::10`);

  const result = buildDependencyFilteredPriceOnlyRows({
    existingRows,
    finalPricesByGeneratorKey: new Map([
      [kinderKey, 219],
      [lindtKey, 749],
    ]),
    productId: "calendar-product",
    tenantId: "master-tenant",
  });

  assert.deepEqual(result.unsupportedGeneratorKeys, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].variant_value, technicalVerticalId);
  assert.equal(result.rows[0].price_dkk, 219);
  assert.equal(result.rows[0].extra_data.supplierPriceEur, 12.34);
  assert.equal(result.rows[0].extra_data.sourceUrl, "https://supplier.example/kinder");
  assert.equal(result.rows[0].extra_data.linkedTemplateId, "template-kinder");
  assert.equal(result.rows[1].variant_value, technicalVerticalId);
  assert.equal(result.rows[1].price_dkk, 749);
  assert.equal(result.rows[1].extra_data.combinedImportSourceKey, "calendar-import");
});

test("rejects a positive price for a model and filling pair that was not imported", () => {
  const invalidKey = `filling-unsupported::${modelId}::none::1`;
  const result = buildDependencyFilteredPriceOnlyRows({
    existingRows,
    finalPricesByGeneratorKey: new Map([[invalidKey, 999]]),
    productId: "calendar-product",
    tenantId: "master-tenant",
  });

  assert.deepEqual(result.unsupportedGeneratorKeys, [invalidKey]);
  assert.equal(result.rows.length, existingRows.length);
  assert.deepEqual(result.rows.map((row) => row.price_dkk), [199, 699]);
});

test("CSV availability contains only imported model and filling pairs", () => {
  const keys = getDependencyFilteredCombinationKeys(existingRows);

  assert.equal(keys.size, 2);
  assert.equal(
    keys.has(`${kinderId}::${modelId}::none::${technicalVerticalId}`),
    true,
  );
  assert.equal(
    keys.has(`filling-unsupported::${modelId}::none::${technicalVerticalId}`),
    false,
  );
});

test("a sparse 14-model by 30-filling matrix stays at 30 valid pairs and 514 price rows", () => {
  const models = Array.from({ length: 14 }, (_, index) => `model-${index + 1}`);
  const fillings = Array.from({ length: 30 }, (_, index) => `filling-${index + 1}`);
  const sparseRows = fillings.flatMap((fillingId, fillingIndex) => {
    const materialId = models[fillingIndex % models.length];
    const quantities = fillingIndex < 4
      ? Array.from({ length: 18 }, (_, index) => index + 1)
      : Array.from({ length: 17 }, (_, index) => index + 1);
    return quantities.map((quantity) => ({
      variant_name: [materialId, fillingId].sort().join("|"),
      variant_value: technicalVerticalId,
      quantity,
      price_dkk: 100 + quantity,
      extra_data: {
        verticalAxisValueId: technicalVerticalId,
        formatId: fillingId,
        materialId,
        variantId: null,
        sourceUrl: `https://supplier.example/${fillingId}`,
      },
    }));
  });

  const allowedCombinations = getDependencyFilteredCombinationKeys(sparseRows);
  const allowedGeneratorKeys = getDependencyFilteredGeneratorKeys(sparseRows);
  const cartesianCombinations = models.flatMap((modelId) =>
    fillings.map((fillingId) =>
      `${fillingId}::${modelId}::none::${technicalVerticalId}`
    )
  );

  assert.equal(sparseRows.length, 514);
  assert.equal(allowedGeneratorKeys.size, 514);
  assert.equal(allowedCombinations.size, 30);
  assert.equal(
    cartesianCombinations.filter((key) => allowedCombinations.has(key)).length,
    30,
  );
  assert.equal(
    allowedGeneratorKeys.has(`filling-5::${models[4]}::none::18`),
    false,
  );
});
