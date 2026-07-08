import { CONVERSION_RULES, applyConversionRule } from "./conversion.js";
import { createNormalizedMatrixRecord } from "./normalized-pricing.js";
import { publishNormalizedMatrixProduct } from "./matrix-publisher.js";

export function salesmapperTransformedPrice(eur, ruleKey = CONVERSION_RULES.wmd_tiered_fx_7_5.key) {
  const converted = applyConversionRule(eur, ruleKey);
  return {
    dkkBase: converted.convertedPriceDkk,
    tierMultiplier: converted.tierMultiplier,
    dkkFinal: converted.finalPriceDkk,
  };
}

export function buildSalesmapperNormalizedRows(
  transformedRows,
  {
    importerKey,
    productFamily = "salesmapper",
    supplierProductType = "salesmapper",
    selectionsForRow,
    extraDataForRow,
    sourceType = "playwright",
  }
) {
  return transformedRows.map((row) =>
    createNormalizedMatrixRecord({
      supplier: "wir-machen-druck",
      sourceType,
      importerKey,
      productFamily,
      sourceUrl: row.detailUrl || row.sourceUrl || null,
      supplierProductType,
      quantity: row.quantity,
      supplierCurrency: "EUR",
      supplierPrice: row.totalEur ?? row.eur,
      convertedPriceDkk: row.dkkBase,
      finalPriceDkk: row.dkkFinal,
      conversionRuleKey: CONVERSION_RULES.wmd_tiered_fx_7_5.key,
      selections: selectionsForRow(row),
      extraData: {
        source: importerKey,
        sourceUrl: row.detailUrl || row.sourceUrl || null,
        eur: row.eur,
        totalEur: row.totalEur,
        dkkBase: row.dkkBase,
        tierMultiplier: row.tierMultiplier,
        ...(typeof extraDataForRow === "function" ? extraDataForRow(row) : {}),
      },
      rawPayload: {
        detailUrl: row.detailUrl || row.sourceUrl || null,
      },
    })
  );
}

export function buildSalesmapperMaterialAxis(materialNames, sortOrder = 2) {
  return {
    key: "material",
    groupName: "Materiale",
    kind: "material",
    sectionType: "materials",
    sortOrder,
    sectionId: "vertical-axis",
    uiMode: "buttons",
    title: "Materiale",
    description: "",
    selectionMapKey: "material",
    extraDataIdField: "materialId",
    valueSpecs: materialNames.map((name) => ({ name })),
  };
}

export function buildSalesmapperFormatSection(
  formatSpecs,
  {
    rowId = "row-format",
    sectionId = "format-section",
    title = "Format",
    uiMode = "buttons",
    sortOrder = 0,
    groupName = "Format",
    requireDimensions = false,
  } = {}
) {
  return {
    key: "format",
    rowId,
    sectionId,
    groupName,
    kind: "format",
    sectionType: "formats",
    sortOrder,
    uiMode,
    selectionMode: "required",
    title,
    description: "",
    selectionMapKey: "format",
    extraDataIdField: "formatId",
    requireDimensions,
    valueSpecs: formatSpecs.map((spec) => (typeof spec === "string" ? { name: spec } : spec)),
  };
}

export function buildSalesmapperOptionSection({
  key,
  rowId,
  sectionId,
  groupName,
  title,
  valueNames,
  sortOrder,
  uiMode = "buttons",
  sectionType = "finishes",
  kind = "finish",
  extraDataIdField,
}) {
  return {
    key,
    rowId,
    sectionId,
    groupName,
    kind,
    sectionType,
    sortOrder,
    uiMode,
    selectionMode: "required",
    title,
    description: "",
    selectionMapKey: key,
    extraDataIdField,
    includeInSelectionMap: false,
    isVariantDimension: true,
    valueSpecs: valueNames.map((name) => ({ name })),
  };
}

export async function publishSalesmapperMatrix({
  client,
  tenantId,
  productId,
  normalizedRows,
  matrixConfig,
  productUpdate,
}) {
  return publishNormalizedMatrixProduct({
    client,
    tenantId,
    productId,
    normalizedRows,
    matrixConfig,
    productUpdate,
  });
}
