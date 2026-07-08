import { createNormalizedMatrixRecord } from "./normalized-pricing.js";

const FORMAT_ORDER = [
  "DIN Lang",
  "DIN A7",
  "DIN A6",
  "DIN A5",
  "DIN A4",
  "9.8 x 9.8 cm",
  "10.5 x 10.5 cm",
  "14.8 x 14.8 cm",
  "21 x 21 cm",
];

const MATERIAL_ORDER = [
  "115g papir",
  "135g papir",
  "170g papir",
  "250g papir",
  "135g 100% genbrugspapir",
];

const SURFACE_ORDER = ["Matsilk", "Glans"];
const FOLD_ORDER = ["Folder midterfalset", "Rullefalset", "zigzag falset"];
const PAGES_ORDER = ["4 sider", "6 sider", "8 sider", "10 sider"];
const ORIENTATION_ORDER = ["Lodret", "Vandret"];

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function collectOrderedValues(rows, field, preferredOrder) {
  const ordered = [];
  const seen = new Set();

  preferredOrder.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    const hasMatch = (Array.isArray(rows) ? rows : []).some(
      (row) => normalizeText(row?.[field]).toLowerCase() === key
    );
    if (!hasMatch) return;
    seen.add(key);
    ordered.push(normalized);
  });

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeText(row?.[field]);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(normalized);
  });

  return ordered;
}

function collectOrderedFormatSpecs(rows) {
  const orderedNames = collectOrderedValues(rows, "formatLabel", FORMAT_ORDER);
  const specByName = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const name = normalizeText(row?.formatLabel);
    if (!name || specByName.has(name)) return;
    specByName.set(name, {
      name,
      widthMm: finiteNumberOrNull(row?.widthMm),
      heightMm: finiteNumberOrNull(row?.heightMm),
    });
  });

  return orderedNames.map((name) => specByName.get(name) || { name });
}

export function sortFolderTransformedRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aFold = normalizeText(a?.foldLabel);
    const bFold = normalizeText(b?.foldLabel);
    if (aFold !== bFold) return aFold.localeCompare(bFold);

    const aPages = normalizeText(a?.pagesLabel);
    const bPages = normalizeText(b?.pagesLabel);
    if (aPages !== bPages) return aPages.localeCompare(bPages);

    const aOrientation = normalizeText(a?.orientationLabel);
    const bOrientation = normalizeText(b?.orientationLabel);
    if (aOrientation !== bOrientation) return aOrientation.localeCompare(bOrientation);

    const aFormat = normalizeText(a?.formatLabel);
    const bFormat = normalizeText(b?.formatLabel);
    if (aFormat !== bFormat) return aFormat.localeCompare(bFormat);

    const aMaterial = normalizeText(a?.materialLabel);
    const bMaterial = normalizeText(b?.materialLabel);
    if (aMaterial !== bMaterial) return aMaterial.localeCompare(bMaterial);

    const aSurface = normalizeText(a?.surfaceLabel);
    const bSurface = normalizeText(b?.surfaceLabel);
    if (aSurface !== bSurface) return aSurface.localeCompare(bSurface);

    return Number(a?.quantity || 0) - Number(b?.quantity || 0);
  });
}

export function buildFolderRowKey(row, { includeQuantity = true } = {}) {
  const parts = [
    normalizeText(row?.foldLabel),
    normalizeText(row?.pagesLabel),
    normalizeText(row?.orientationLabel),
    normalizeText(row?.formatLabel),
    normalizeText(row?.materialLabel),
    normalizeText(row?.surfaceLabel),
  ];

  if (includeQuantity) {
    parts.push(String(Number(row?.quantity || 0)));
  }

  return parts.join("||");
}

export function mergeFolderTransformedRows({
  existingRows = [],
  sourceRows = [],
  preferSource = false,
} = {}) {
  const merged = new Map();

  existingRows.forEach((row) => {
    merged.set(buildFolderRowKey(row), { ...row, mergeSource: "existing" });
  });

  let addedFromSource = 0;
  let skippedExistingKeys = 0;
  let replacedExistingRows = 0;

  sourceRows.forEach((row) => {
    const key = buildFolderRowKey(row);
    if (merged.has(key)) {
      if (preferSource) {
        merged.set(key, { ...row, mergeSource: "source_override" });
        replacedExistingRows += 1;
        return;
      }
      skippedExistingKeys += 1;
      return;
    }
    merged.set(key, { ...row, mergeSource: "source" });
    addedFromSource += 1;
  });

  return {
    rows: sortFolderTransformedRows(Array.from(merged.values())),
    stats: {
      existingRows: existingRows.length,
      sourceRows: sourceRows.length,
      mergedRows: merged.size,
      addedFromSource,
      preservedExistingRows: Math.max(0, existingRows.length - replacedExistingRows),
      replacedExistingRows,
      skippedExistingKeys,
    },
  };
}

export function buildFoldersMatrixConfig(rows) {
  const formatSpecs = collectOrderedFormatSpecs(rows);
  const materials = collectOrderedValues(rows, "materialLabel", MATERIAL_ORDER);
  const surfaces = collectOrderedValues(rows, "surfaceLabel", SURFACE_ORDER);
  const foldTypes = collectOrderedValues(rows, "foldLabel", FOLD_ORDER);
  const pages = collectOrderedValues(rows, "pagesLabel", PAGES_ORDER);
  const orientations = collectOrderedValues(rows, "orientationLabel", ORIENTATION_ORDER);

  return {
    verticalAxis: {
      key: "material",
      groupName: "Materiale",
      kind: "material",
      sectionType: "materials",
      sortOrder: 1,
      sectionId: "vertical-axis",
      uiMode: "buttons",
      title: "Materiale",
      description: "",
      selectionMapKey: "material",
      extraDataIdField: "materialId",
      valueSpecs: materials.map((name) => ({ name })),
    },
    sections: [
      {
        key: "format",
        rowId: "row-format",
        sectionId: "format-section",
        groupName: "Format",
        kind: "format",
        sectionType: "formats",
        sortOrder: 0,
        uiMode: "buttons",
        selectionMode: "required",
        title: "Format",
        description: "",
        selectionMapKey: "format",
        extraDataIdField: "formatId",
        valueSpecs: formatSpecs,
      },
      {
        key: "surface",
        rowId: "row-surface",
        sectionId: "surface-section",
        groupName: "Papirfinish",
        kind: "other",
        sectionType: "other",
        sortOrder: 2,
        uiMode: "buttons",
        selectionMode: "required",
        title: "Papirfinish",
        description: "",
        includeInSelectionMap: false,
        isVariantDimension: true,
        extraDataIdField: "surfaceId",
        valueSpecs: surfaces.map((name) => ({ name })),
      },
      {
        key: "fold",
        rowId: "row-fold",
        sectionId: "fold-section",
        groupName: "Foldetype",
        kind: "finish",
        sectionType: "finishes",
        sortOrder: 3,
        uiMode: "buttons",
        selectionMode: "required",
        title: "Foldetype",
        description: "",
        includeInSelectionMap: false,
        isVariantDimension: true,
        extraDataIdField: "foldId",
        valueSpecs: foldTypes.map((name) => ({ name })),
      },
      {
        key: "pages",
        rowId: "row-pages",
        sectionId: "pages-section",
        groupName: "Sider",
        kind: "other",
        sectionType: "products",
        sortOrder: 4,
        uiMode: "buttons",
        selectionMode: "required",
        title: "Sider",
        description: "",
        includeInSelectionMap: false,
        isVariantDimension: true,
        extraDataIdField: "pagesId",
        valueSpecs: pages.map((name) => ({ name })),
      },
      {
        key: "orientation",
        rowId: "row-orientation",
        sectionId: "orientation-section",
        groupName: "Retning",
        kind: "other",
        sectionType: "other",
        sortOrder: 5,
        uiMode: "buttons",
        selectionMode: "required",
        title: "Retning",
        description: "",
        includeInSelectionMap: false,
        isVariantDimension: true,
        extraDataIdField: "orientationId",
        valueSpecs: orientations.map((name) => ({ name })),
      },
    ],
  };
}

export function createFolderNormalizedRows(rows) {
  return sortFolderTransformedRows(rows).map((row) => {
    const rawExtraData = isPlainObject(row?.rawExtraData) ? { ...row.rawExtraData } : {};
    const sourceOrigin = normalizeText(row?.sourceOrigin).toLowerCase();
    const sourceType =
      sourceOrigin === "database"
        ? "database"
        : sourceOrigin === "csv"
          ? "csv"
          : "playwright";

    const extraData = {
      ...rawExtraData,
      source: rawExtraData.source || "folders_fetch_import",
      sourceUrl: normalizeText(row?.detailUrl) || rawExtraData.sourceUrl || "",
      eur: finiteNumberOrNull(row?.eur),
      dkkBase: finiteNumberOrNull(row?.dkkBase),
      tierMultiplier: finiteNumberOrNull(row?.tierMultiplier) ?? 1,
      sourceOptionText:
        normalizeText(row?.sourceOptionText) || rawExtraData.sourceOptionText || "",
    };

    if (Object.prototype.hasOwnProperty.call(rawExtraData, "supplierPriceDkk") || sourceType === "database") {
      extraData.supplierPriceDkk = finiteNumberOrNull(row?.dkkBase);
    }
    if (Object.prototype.hasOwnProperty.call(rawExtraData, "basePrice")) {
      extraData.basePrice = Number(row?.dkkFinal);
    }

    return createNormalizedMatrixRecord({
      supplier: "wir-machen-druck",
      sourceType,
      importerKey: "folders_fetch_import",
      productFamily: "folders",
      sourceUrl: extraData.sourceUrl || null,
      supplierProductType: "folders",
      sourceKey: row?.sourceKey || buildFolderRowKey(row, { includeQuantity: false }),
      quantity: Number(row?.quantity),
      supplierCurrency: "EUR",
      supplierPrice: finiteNumberOrNull(row?.eur),
      convertedPriceDkk:
        finiteNumberOrNull(row?.dkkBase) ?? Number(row?.dkkFinal),
      finalPriceDkk: Number(row?.dkkFinal),
      markupInputs: {
        tierMultiplier: finiteNumberOrNull(row?.tierMultiplier) ?? 1,
      },
      dimensions: {
        widthMm: finiteNumberOrNull(row?.widthMm),
        heightMm: finiteNumberOrNull(row?.heightMm),
      },
      selections: {
        material: row?.materialLabel,
        format: row?.formatLabel,
        surface: row?.surfaceLabel,
        fold: row?.foldLabel,
        pages: row?.pagesLabel,
        orientation: row?.orientationLabel,
      },
      labels: {
        materialLabel: row?.materialLabel,
        formatLabel: row?.formatLabel,
        surfaceLabel: row?.surfaceLabel,
        foldLabel: row?.foldLabel,
        pagesLabel: row?.pagesLabel,
        orientationLabel: row?.orientationLabel,
      },
      sourceIdentifiers: {
        rowKey: buildFolderRowKey(row),
      },
      extraData,
      rawPayload: {
        sourceOrigin: sourceType,
        mergeSource: row?.mergeSource || null,
        sourceUrl: extraData.sourceUrl || null,
      },
    });
  });
}
