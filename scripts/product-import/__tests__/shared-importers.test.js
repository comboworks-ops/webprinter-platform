import test from "node:test";
import assert from "node:assert/strict";

import { CONVERSION_RULES, applyConversionRule } from "../shared/conversion.js";
import { createNormalizedMatrixRecord } from "../shared/normalized-pricing.js";
import {
  buildGenericPriceRowsFromNormalized,
  buildMatrixLayoutV1,
} from "../shared/matrix-publisher.js";
import { assertValidNormalizedPricingRecords } from "../shared/validation.js";
import {
  buildFoldersMatrixConfig,
  createFolderNormalizedRows,
  mergeFolderTransformedRows,
} from "../shared/folders-matrix.js";

function buildResolvedFixture() {
  return {
    verticalAxis: {
      definition: {
        key: "material",
        sectionId: "vertical-axis",
        sectionType: "materials",
        uiMode: "buttons",
        title: "Materiale",
        description: "",
      },
      group: { id: "group-material" },
      values: [{ id: "mat-1", name: "PVC" }],
      valueByName: new Map([["PVC", { id: "mat-1", name: "PVC" }]]),
    },
    sections: [
      {
        key: "format",
        rowId: "row-format",
        sectionId: "format-section",
        sectionType: "formats",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Format",
        description: "",
        includeInVariantName: true,
        includeInSelectionMap: true,
        extraDataIdField: "formatId",
        selectionMapKey: "format",
        isVariantDimension: false,
      },
      {
        key: "printMode",
        rowId: "row-print",
        sectionId: "print-section",
        sectionType: "finishes",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Tryk",
        description: "",
        includeInVariantName: true,
        includeInSelectionMap: false,
        extraDataIdField: "printModeId",
        selectionMapKey: "printMode",
        isVariantDimension: true,
      },
    ],
    resolvedSections: new Map([
      [
        "format",
        {
          group: { id: "group-format" },
          values: [{ id: "fmt-a4", name: "A4" }],
          valueByName: new Map([["A4", { id: "fmt-a4", name: "A4" }]]),
        },
      ],
      [
        "printMode",
        {
          group: { id: "group-print" },
          values: [{ id: "pm-44", name: "4+4" }],
          valueByName: new Map([["4+4", { id: "pm-44", name: "4+4" }]]),
        },
      ],
    ]),
  };
}

test("conversion rules preserve tiered and threshold outputs", () => {
  const tiered = applyConversionRule(100, CONVERSION_RULES.wmd_tiered_fx_7_5);
  assert.equal(tiered.convertedPriceDkk, 750);
  assert.equal(tiered.tierMultiplier, 1.6);
  assert.equal(tiered.finalPriceDkk, 1200);

  const threshold = applyConversionRule(500, CONVERSION_RULES.wmd_roll_labels_threshold_fx_7_6);
  assert.equal(threshold.convertedPriceDkk, 3800);
  assert.equal(threshold.markupPct, 60);
  assert.equal(threshold.finalPriceDkk, 6080);
});

test("matrix publisher builds exact variant semantics from normalized rows", () => {
  const normalizedRows = [
    createNormalizedMatrixRecord({
      supplier: "wir-machen-druck",
      sourceType: "playwright",
      importerKey: "salesmapper_import",
      productFamily: "salesmapper",
      sourceUrl: "https://example.com/product",
      quantity: 100,
      supplierCurrency: "EUR",
      supplierPrice: 50,
      convertedPriceDkk: 375,
      finalPriceDkk: 600,
      selections: {
        material: "PVC",
        format: "A4",
        printMode: "4+4",
      },
      extraData: {
        source: "salesmapper_fetch_import",
      },
    }),
  ];

  const matrixConfig = {
    verticalAxis: {
      key: "material",
      groupName: "Materiale",
      kind: "material",
      sectionType: "materials",
      sectionId: "vertical-axis",
      uiMode: "buttons",
      title: "Materiale",
      description: "",
      selectionMapKey: "material",
      extraDataIdField: "materialId",
    },
    sections: [
      {
        key: "format",
        rowId: "row-format",
        sectionId: "format-section",
        groupName: "Format",
        kind: "format",
        sectionType: "formats",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Format",
        description: "",
        selectionMapKey: "format",
        extraDataIdField: "formatId",
        includeInSelectionMap: true,
        includeInVariantName: true,
        isVariantDimension: false,
      },
      {
        key: "printMode",
        rowId: "row-print",
        sectionId: "print-section",
        groupName: "Tryk",
        kind: "finish",
        sectionType: "finishes",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Tryk",
        description: "",
        selectionMapKey: "printMode",
        extraDataIdField: "printModeId",
        includeInSelectionMap: false,
        includeInVariantName: true,
        isVariantDimension: true,
      },
    ],
  };

  assert.doesNotThrow(() =>
    assertValidNormalizedPricingRecords(normalizedRows, { matrixConfig })
  );

  const resolved = buildResolvedFixture();
  const priceRows = buildGenericPriceRowsFromNormalized({
    tenantId: "tenant-1",
    productId: "product-1",
    matrixConfig,
    resolved,
    normalizedRows,
  });

  assert.equal(priceRows.length, 1);
  assert.equal(priceRows[0].variant_name, "fmt-a4|pm-44");
  assert.equal(priceRows[0].variant_value, "mat-1");
  assert.deepEqual(priceRows[0].extra_data.selectionMap, {
    material: "mat-1",
    format: "fmt-a4",
    variantValueIds: ["pm-44"],
  });
  assert.equal(priceRows[0].extra_data.materialId, "mat-1");
  assert.equal(priceRows[0].extra_data.formatId, "fmt-a4");
  assert.equal(priceRows[0].extra_data.printModeId, "pm-44");

  const pricingStructure = buildMatrixLayoutV1(matrixConfig, resolved, [100]);
  assert.equal(pricingStructure.vertical_axis.groupId, "group-material");
  assert.equal(pricingStructure.layout_rows.length, 2);
  assert.equal(pricingStructure.layout_rows[0].columns[0].groupId, "group-format");
  assert.equal(pricingStructure.layout_rows[1].columns[0].groupId, "group-print");
});

test("matrix publisher preserves salesmapper multi-option variant semantics", () => {
  const normalizedRows = [
    createNormalizedMatrixRecord({
      supplier: "wir-machen-druck",
      sourceType: "playwright",
      importerKey: "salesmapper_kachering_fetch_import",
      productFamily: "salesmapper_folders",
      sourceUrl: "https://example.com/folder",
      quantity: 250,
      supplierCurrency: "EUR",
      supplierPrice: 80,
      convertedPriceDkk: 600,
      finalPriceDkk: 960,
      selections: {
        material: "Chromokarton 255g",
        format: "A4 salgsmappe med Kachering",
        printMode: "4+4",
        kachering: "Softfeel-Folie",
      },
      extraData: {
        source: "salesmapper_kachering_fetch_import",
      },
    }),
  ];

  const matrixConfig = {
    verticalAxis: {
      key: "material",
      groupName: "Materiale",
      kind: "material",
      sectionType: "materials",
      sectionId: "vertical-axis",
      uiMode: "buttons",
      title: "Materiale",
      description: "",
      selectionMapKey: "material",
      extraDataIdField: "materialId",
    },
    sections: [
      {
        key: "format",
        rowId: "row-format",
        sectionId: "format-section",
        groupName: "Format",
        kind: "format",
        sectionType: "formats",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Format",
        description: "",
        selectionMapKey: "format",
        extraDataIdField: "formatId",
      },
      {
        key: "printMode",
        rowId: "row-print-mode",
        sectionId: "print-mode-section",
        groupName: "Tryk",
        kind: "finish",
        sectionType: "finishes",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Tryk",
        description: "",
        selectionMapKey: "printMode",
        extraDataIdField: "printModeId",
        includeInSelectionMap: false,
        isVariantDimension: true,
      },
      {
        key: "kachering",
        rowId: "row-kachering",
        sectionId: "kachering-section",
        groupName: "Kachering",
        kind: "finish",
        sectionType: "options",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Kachering",
        description: "",
        selectionMapKey: "kachering",
        extraDataIdField: "kacheringId",
        includeInSelectionMap: false,
        isVariantDimension: true,
      },
    ],
  };

  const resolved = {
    verticalAxis: {
      definition: {
        key: "material",
        sectionId: "vertical-axis",
        sectionType: "materials",
        uiMode: "buttons",
        title: "Materiale",
        description: "",
      },
      group: { id: "group-material" },
      values: [{ id: "mat-1", name: "Chromokarton 255g" }],
      valueByName: new Map([["Chromokarton 255g", { id: "mat-1", name: "Chromokarton 255g" }]]),
    },
    sections: [
      {
        key: "format",
        rowId: "row-format",
        sectionId: "format-section",
        sectionType: "formats",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Format",
        description: "",
        includeInVariantName: true,
        includeInSelectionMap: true,
        extraDataIdField: "formatId",
        selectionMapKey: "format",
        isVariantDimension: false,
      },
      {
        key: "printMode",
        rowId: "row-print-mode",
        sectionId: "print-mode-section",
        sectionType: "finishes",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Tryk",
        description: "",
        includeInVariantName: true,
        includeInSelectionMap: false,
        extraDataIdField: "printModeId",
        selectionMapKey: "printMode",
        isVariantDimension: true,
      },
      {
        key: "kachering",
        rowId: "row-kachering",
        sectionId: "kachering-section",
        sectionType: "options",
        uiMode: "buttons",
        selectionMode: "required",
        title: "Kachering",
        description: "",
        includeInVariantName: true,
        includeInSelectionMap: false,
        extraDataIdField: "kacheringId",
        selectionMapKey: "kachering",
        isVariantDimension: true,
      },
    ],
    resolvedSections: new Map([
      [
        "format",
        {
          group: { id: "group-format" },
          values: [{ id: "fmt-a4", name: "A4 salgsmappe med Kachering" }],
          valueByName: new Map([["A4 salgsmappe med Kachering", { id: "fmt-a4", name: "A4 salgsmappe med Kachering" }]]),
        },
      ],
      [
        "printMode",
        {
          group: { id: "group-print" },
          values: [{ id: "pm-44", name: "4+4" }],
          valueByName: new Map([["4+4", { id: "pm-44", name: "4+4" }]]),
        },
      ],
      [
        "kachering",
        {
          group: { id: "group-kachering" },
          values: [{ id: "kach-soft", name: "Softfeel-Folie" }],
          valueByName: new Map([["Softfeel-Folie", { id: "kach-soft", name: "Softfeel-Folie" }]]),
        },
      ],
    ]),
  };

  const priceRows = buildGenericPriceRowsFromNormalized({
    tenantId: "tenant-1",
    productId: "product-1",
    matrixConfig,
    resolved,
    normalizedRows,
  });

  assert.equal(priceRows.length, 1);
  assert.equal(priceRows[0].variant_name, "fmt-a4|kach-soft|pm-44");
  assert.equal(priceRows[0].variant_value, "mat-1");
  assert.deepEqual(priceRows[0].extra_data.variantValueIds, ["pm-44", "kach-soft"]);
  assert.deepEqual(priceRows[0].extra_data.selectionMap, {
    material: "mat-1",
    format: "fmt-a4",
    variantValueIds: ["pm-44", "kach-soft"],
  });
  assert.equal(priceRows[0].extra_data.printModeId, "pm-44");
  assert.equal(priceRows[0].extra_data.kacheringId, "kach-soft");
});

test("folder merge preserves live rows and only appends missing source rows by default", () => {
  const existingRows = [
    {
      foldLabel: "Rullefalset",
      pagesLabel: "10 sider",
      orientationLabel: "Lodret",
      formatLabel: "DIN Lang",
      materialLabel: "135g papir",
      surfaceLabel: "Glans",
      quantity: 100,
      dkkFinal: 900,
    },
  ];

  const sourceRows = [
    {
      foldLabel: "Rullefalset",
      pagesLabel: "10 sider",
      orientationLabel: "Lodret",
      formatLabel: "DIN Lang",
      materialLabel: "135g papir",
      surfaceLabel: "Glans",
      quantity: 100,
      dkkFinal: 950,
    },
    {
      foldLabel: "Rullefalset",
      pagesLabel: "10 sider",
      orientationLabel: "Lodret",
      formatLabel: "DIN Lang",
      materialLabel: "135g papir",
      surfaceLabel: "Glans",
      quantity: 250,
      dkkFinal: 1200,
    },
  ];

  const merged = mergeFolderTransformedRows({ existingRows, sourceRows });

  assert.equal(merged.rows.length, 2);
  assert.equal(merged.stats.preservedExistingRows, 1);
  assert.equal(merged.stats.replacedExistingRows, 0);
  assert.equal(merged.stats.addedFromSource, 1);
  assert.equal(merged.stats.skippedExistingKeys, 1);
  assert.equal(merged.rows.find((row) => row.quantity === 100)?.dkkFinal, 900);
  assert.equal(merged.rows.find((row) => row.quantity === 250)?.dkkFinal, 1200);
});

test("folder merge can prefer supplier rows over existing live rows", () => {
  const existingRows = [
    {
      foldLabel: "Rullefalset",
      pagesLabel: "6 sider",
      orientationLabel: "Lodret",
      formatLabel: "DIN Lang",
      materialLabel: "135g papir",
      surfaceLabel: "Matsilk",
      quantity: 50,
      dkkFinal: 112,
    },
  ];

  const sourceRows = [
    {
      foldLabel: "Rullefalset",
      pagesLabel: "6 sider",
      orientationLabel: "Lodret",
      formatLabel: "DIN Lang",
      materialLabel: "135g papir",
      surfaceLabel: "Matsilk",
      quantity: 50,
      dkkFinal: 258,
    },
  ];

  const merged = mergeFolderTransformedRows({
    existingRows,
    sourceRows,
    preferSource: true,
  });

  assert.equal(merged.rows.length, 1);
  assert.equal(merged.stats.preservedExistingRows, 0);
  assert.equal(merged.stats.replacedExistingRows, 1);
  assert.equal(merged.stats.addedFromSource, 0);
  assert.equal(merged.stats.skippedExistingKeys, 0);
  assert.equal(merged.rows[0]?.dkkFinal, 258);
  assert.equal(merged.rows[0]?.mergeSource, "source_override");
});

test("folder helper preserves live matrix variant semantics", () => {
  const transformedRows = [
    {
      foldLabel: "Rullefalset",
      pagesLabel: "10 sider",
      orientationLabel: "Lodret",
      formatLabel: "DIN Lang",
      materialLabel: "135g papir",
      surfaceLabel: "Glans",
      quantity: 100,
      eur: 100,
      dkkBase: 750,
      tierMultiplier: 1.2,
      dkkFinal: 900,
      sourceOrigin: "playwright",
    },
  ];

  const normalizedRows = createFolderNormalizedRows(transformedRows);
  const matrixConfig = buildFoldersMatrixConfig(transformedRows);
  const resolved = {
    verticalAxis: {
      definition: matrixConfig.verticalAxis,
      group: { id: "group-material" },
      values: [{ id: "mat-1", name: "135g papir" }],
      valueByName: new Map([["135g papir", { id: "mat-1", name: "135g papir" }]]),
    },
    sections: matrixConfig.sections.map((section) => ({
      ...section,
      includeInVariantName: true,
    })),
    resolvedSections: new Map([
      [
        "format",
        {
          group: { id: "group-format" },
          values: [{ id: "a-format", name: "DIN Lang" }],
          valueByName: new Map([["DIN Lang", { id: "a-format", name: "DIN Lang" }]]),
        },
      ],
      [
        "surface",
        {
          group: { id: "group-surface" },
          values: [{ id: "b-surface", name: "Glans" }],
          valueByName: new Map([["Glans", { id: "b-surface", name: "Glans" }]]),
        },
      ],
      [
        "fold",
        {
          group: { id: "group-fold" },
          values: [{ id: "c-fold", name: "Rullefalset" }],
          valueByName: new Map([["Rullefalset", { id: "c-fold", name: "Rullefalset" }]]),
        },
      ],
      [
        "pages",
        {
          group: { id: "group-pages" },
          values: [{ id: "d-pages", name: "10 sider" }],
          valueByName: new Map([["10 sider", { id: "d-pages", name: "10 sider" }]]),
        },
      ],
      [
        "orientation",
        {
          group: { id: "group-orientation" },
          values: [{ id: "e-orient", name: "Lodret" }],
          valueByName: new Map([["Lodret", { id: "e-orient", name: "Lodret" }]]),
        },
      ],
    ]),
  };

  const priceRows = buildGenericPriceRowsFromNormalized({
    tenantId: "tenant-1",
    productId: "product-1",
    matrixConfig,
    resolved,
    normalizedRows,
  });

  assert.equal(priceRows.length, 1);
  assert.equal(priceRows[0].variant_name, "a-format|b-surface|c-fold|d-pages|e-orient");
  assert.equal(priceRows[0].variant_value, "mat-1");
  assert.deepEqual(priceRows[0].extra_data.selectionMap, {
    material: "mat-1",
    format: "a-format",
    variantValueIds: ["b-surface", "c-fold", "d-pages", "e-orient"],
  });
  assert.deepEqual(priceRows[0].extra_data.variantValueIds, [
    "b-surface",
    "c-fold",
    "d-pages",
    "e-orient",
  ]);
  assert.equal(priceRows[0].extra_data.formatId, "a-format");
  assert.equal(priceRows[0].extra_data.surfaceId, "b-surface");
  assert.equal(priceRows[0].extra_data.foldId, "c-fold");
  assert.equal(priceRows[0].extra_data.pagesId, "d-pages");
  assert.equal(priceRows[0].extra_data.orientationId, "e-orient");
});

test("validation rejects duplicate normalized rows", () => {
  const record = createNormalizedMatrixRecord({
    supplier: "wir-machen-druck",
    sourceType: "playwright",
    importerKey: "dup-test",
    quantity: 100,
    finalPriceDkk: 500,
    selections: {
      material: "PVC",
      format: "A4",
    },
  });

  assert.throws(
    () =>
      assertValidNormalizedPricingRecords([record, record], {
        requiredSelectionKeys: ["material", "format"],
      }),
    /Duplicate normalized price key/
  );
});
