type MatrixStructureLike = {
  mode?: string;
  vertical_axis?: Record<string, any>;
  layout_rows?: Array<{
    id?: string;
    columns?: Array<Record<string, any>>;
    sections?: Array<Record<string, any>>;
    [key: string]: any;
  }>;
  [key: string]: any;
};

export type MatrixAdminPersistedPriceRow = {
  id?: string | null;
  product_id?: string | null;
  tenant_id?: string | null;
  variant_name: string;
  variant_value: string;
  quantity: number;
  price_dkk: number;
  extra_data?: Record<string, any> | null;
  [key: string]: any;
};

export type MatrixAdminPriceContext = {
  generatorKey: string;
  formatId: string;
  materialId: string;
  variantId: string;
  verticalValueId: string;
  quantity: number;
};

const normalizeIdList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeIdList(entry));
  }
  if (value == null) return [];
  const normalized = String(value).trim();
  return normalized ? [normalized] : [];
};

const normalizeVariantId = (extra: Record<string, any>, selectionMap: Record<string, any>): string => {
  const direct = normalizeIdList(extra.variantId ?? selectionMap.variant);
  if (direct.length > 0) {
    return Array.from(new Set(direct)).sort().join("|");
  }

  const valueIds = [
    ...normalizeIdList(selectionMap.variantValueIds ?? selectionMap.variant_value_ids),
    ...normalizeIdList(extra.variantValueIds ?? extra.variant_value_ids),
  ];
  return valueIds.length > 0
    ? Array.from(new Set(valueIds)).sort().join("|")
    : "none";
};

export function getMatrixAdminPriceContext(
  row: MatrixAdminPersistedPriceRow,
): MatrixAdminPriceContext | null {
  const extra = row.extra_data && typeof row.extra_data === "object"
    ? row.extra_data
    : {};
  const selectionMap = extra.selectionMap && typeof extra.selectionMap === "object"
    ? extra.selectionMap
    : {};

  const formatId = String(
    extra.formatId
    ?? extra.format_id
    ?? selectionMap.format
    ?? selectionMap.formatId
    ?? selectionMap.format_id
    ?? "",
  ).trim();
  const materialId = String(
    extra.materialId
    ?? extra.material_id
    ?? selectionMap.material
    ?? selectionMap.materialId
    ?? selectionMap.material_id
    ?? "",
  ).trim();
  const verticalValueId = String(
    extra.verticalAxisValueId
    ?? extra.vertical_axis_value_id
    ?? row.variant_value
    ?? "",
  ).trim();
  const quantity = Number(row.quantity);

  if (!formatId || !materialId || !verticalValueId || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const variantId = normalizeVariantId(extra, selectionMap);
  return {
    generatorKey: `${formatId}::${materialId}::${variantId}::${quantity}`,
    formatId,
    materialId,
    variantId,
    verticalValueId,
    quantity,
  };
}

export function getMatrixAdminGeneratorKeyFromPriceRow(
  row: MatrixAdminPersistedPriceRow,
): string | null {
  return getMatrixAdminPriceContext(row)?.generatorKey || null;
}

export function isDependencyFilteredMatrix(structure: MatrixStructureLike | null | undefined): boolean {
  if (!structure || structure.mode !== "matrix_layout_v1") return false;
  return (structure.layout_rows || []).some((row) =>
    (row.columns || row.sections || []).some((column) =>
      column.hideUnavailableValues === true
      || column.hide_unavailable_values === true
    )
  );
}

export function preserveMatrixAdminPricingStructure<
  TPrevious extends MatrixStructureLike,
  TNext extends MatrixStructureLike,
>(
  previous: TPrevious | null | undefined,
  next: TNext,
): TPrevious & TNext {
  if (!previous || previous.mode !== "matrix_layout_v1" || next.mode !== "matrix_layout_v1") {
    return next as TPrevious & TNext;
  }

  const previousRowsById = new Map(
    (previous.layout_rows || []).map((row) => [String(row.id || ""), row]),
  );
  const nextRows = (next.layout_rows || []).map((nextRow) => {
    const previousRow = previousRowsById.get(String(nextRow.id || ""));
    const previousColumns = previousRow?.columns || previousRow?.sections || [];
    const previousColumnsById = new Map(
      previousColumns.map((column) => [String(column.id || ""), column]),
    );
    const nextColumns = nextRow.columns || nextRow.sections || [];
    const mergedColumns = nextColumns.map((nextColumn) => {
      const previousColumn = previousColumnsById.get(String(nextColumn.id || ""));
      return {
        ...(previousColumn || {}),
        ...nextColumn,
        valueSettings: {
          ...((previousColumn?.valueSettings || {}) as Record<string, any>),
          ...((nextColumn.valueSettings || {}) as Record<string, any>),
        },
      };
    });

    return {
      ...(previousRow || {}),
      ...nextRow,
      columns: mergedColumns,
    };
  });

  return {
    ...previous,
    ...next,
    vertical_axis: {
      ...(previous.vertical_axis || {}),
      ...(next.vertical_axis || {}),
      valueSettings: {
        ...((previous.vertical_axis?.valueSettings || {}) as Record<string, any>),
        ...((next.vertical_axis?.valueSettings || {}) as Record<string, any>),
      },
    },
    layout_rows: nextRows,
  } as TPrevious & TNext;
}

export function buildDependencyFilteredPriceOnlyRows({
  existingRows,
  finalPricesByGeneratorKey,
  productId,
  tenantId,
}: {
  existingRows: MatrixAdminPersistedPriceRow[];
  finalPricesByGeneratorKey: ReadonlyMap<string | null, number | null | undefined>;
  productId: string;
  tenantId: string;
}): {
  rows: MatrixAdminPersistedPriceRow[];
  unsupportedGeneratorKeys: string[];
} {
  const existingKeys = new Set<string>();
  existingRows.forEach((row) => {
    const key = getMatrixAdminGeneratorKeyFromPriceRow(row);
    if (key) existingKeys.add(key);
  });

  const unsupportedGeneratorKeys = Array.from(finalPricesByGeneratorKey.entries())
    .filter(([key, price]) =>
      typeof key === "string"
      && key.length > 0
      && Number.isFinite(Number(price))
      && Number(price) > 0
      && !existingKeys.has(key)
    )
    .map(([key]) => String(key));

  const rows = existingRows.map((existingRow) => {
    const key = getMatrixAdminGeneratorKeyFromPriceRow(existingRow);
    const editedPrice = key ? finalPricesByGeneratorKey.get(key) : undefined;
    const hasPositiveEdit = Number.isFinite(Number(editedPrice)) && Number(editedPrice) > 0;
    const { id: _id, ...persistedFields } = existingRow;

    return {
      ...persistedFields,
      product_id: productId,
      tenant_id: tenantId,
      price_dkk: hasPositiveEdit ? Number(editedPrice) : Number(existingRow.price_dkk),
      extra_data: existingRow.extra_data || {},
    };
  });

  return { rows, unsupportedGeneratorKeys };
}

export function getDependencyFilteredCombinationKeys(
  rows: MatrixAdminPersistedPriceRow[],
): Set<string> {
  const keys = new Set<string>();
  rows.forEach((row) => {
    const context = getMatrixAdminPriceContext(row);
    if (!context) return;
    keys.add([
      context.formatId,
      context.materialId,
      context.variantId,
      context.verticalValueId,
    ].join("::"));
  });
  return keys;
}

export function getDependencyFilteredGeneratorKeys(
  rows: MatrixAdminPersistedPriceRow[],
): Set<string> {
  const keys = new Set<string>();
  rows.forEach((row) => {
    const key = getMatrixAdminGeneratorKeyFromPriceRow(row);
    if (key) keys.add(key);
  });
  return keys;
}

export function getMatrixAdminPriceContexts(
  rows: MatrixAdminPersistedPriceRow[],
): MatrixAdminPriceContext[] {
  return rows
    .map((row) => getMatrixAdminPriceContext(row))
    .filter((context): context is MatrixAdminPriceContext => Boolean(context));
}
