import {
  collectNormalizedQuantities,
  collectSelectionValues,
  summarizeNormalizedRecords,
} from "./normalized-pricing.js";
import { assertValidNormalizedPricingRecords } from "./validation.js";

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneMeta(value) {
  return isPlainObject(value) ? { ...value } : null;
}

function normalizeValueSpec(value) {
  if (typeof value === "string") {
    return { name: normalizeText(value) };
  }

  if (!isPlainObject(value)) {
    throw new Error("Matrix value spec must be a string or object");
  }

  return {
    name: normalizeText(value.name),
    widthMm: value.widthMm ?? null,
    heightMm: value.heightMm ?? null,
    meta: cloneMeta(value.meta),
  };
}

function buildDesiredValueSpecs(definition, rows) {
  const ordered = [];
  const seen = new Set();
  const configured = Array.isArray(definition.valueSpecs) ? definition.valueSpecs : [];

  configured.forEach((value) => {
    const spec = normalizeValueSpec(value);
    if (!spec.name) return;
    const key = spec.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(spec);
  });

  if (definition.includeUnconfiguredValues === false) {
    return ordered;
  }

  const dynamicValues = collectSelectionValues(rows, definition.key);
  dynamicValues.forEach((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push({ name });
  });

  return ordered;
}

async function loadGroups(client, tenantId, productId) {
  const { data, error } = await client
    .from("product_attribute_groups")
    .select(
      "id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)"
    )
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function ensureGroup(client, context, definition) {
  const normalizedName = normalizeText(definition.groupName).toLowerCase();
  const existing = context.groups.find(
    (group) =>
      group.kind === definition.kind &&
      normalizeText(group.name).toLowerCase() === normalizedName
  );

  if (existing) return existing;

  const { data, error } = await client
    .from("product_attribute_groups")
    .insert({
      tenant_id: context.tenantId,
      product_id: context.productId,
      name: definition.groupName,
      kind: definition.kind,
      source: "product",
      ui_mode: definition.groupUiMode || definition.uiMode || "buttons",
      sort_order: definition.sortOrder,
      enabled: true,
    })
    .select(
      "id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)"
    )
    .single();

  if (error) throw error;

  const normalized = { ...data, values: data.values || [] };
  context.groups.push(normalized);
  return normalized;
}

async function ensureValue(client, context, group, valueSpec) {
  const normalizedName = normalizeText(valueSpec.name);
  let existing = (group.values || []).find(
    (value) => String(value.name || "").toLowerCase() === normalizedName.toLowerCase()
  );

  const desiredWidth = valueSpec.widthMm != null ? Number(valueSpec.widthMm) : null;
  const desiredHeight = valueSpec.heightMm != null ? Number(valueSpec.heightMm) : null;
  const desiredMeta = cloneMeta(valueSpec.meta);

  if (!existing) {
    const { data, error } = await client
      .from("product_attribute_values")
      .insert({
        tenant_id: context.tenantId,
        product_id: context.productId,
        group_id: group.id,
        name: normalizedName,
        sort_order: (group.values || []).length,
        enabled: true,
        width_mm: desiredWidth,
        height_mm: desiredHeight,
        meta: desiredMeta,
      })
      .select("id, name, width_mm, height_mm, meta")
      .single();

    if (error) throw error;

    group.values = [...(group.values || []), data];
    return data;
  }

  const patch = {};
  if (desiredWidth != null && Number(existing.width_mm || 0) !== desiredWidth) {
    patch.width_mm = desiredWidth;
  }
  if (desiredHeight != null && Number(existing.height_mm || 0) !== desiredHeight) {
    patch.height_mm = desiredHeight;
  }
  if (desiredMeta) {
    const currentMeta = cloneMeta(existing.meta) || {};
    const desiredMetaKey = JSON.stringify(desiredMeta);
    const currentMetaKey = JSON.stringify(currentMeta);
    if (desiredMetaKey !== currentMetaKey) {
      patch.meta = desiredMeta;
    }
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const { data, error } = await client
    .from("product_attribute_values")
    .update(patch)
    .eq("id", existing.id)
    .select("id, name, width_mm, height_mm, meta")
    .single();

  if (error) throw error;

  group.values = (group.values || []).map((value) => (value.id === data.id ? data : value));
  existing = data;
  return existing;
}

function groupSectionsByRow(sections) {
  const rows = [];
  const rowMap = new Map();

  for (const section of sections) {
    const rowId = section.rowId;
    let row = rowMap.get(rowId);
    if (!row) {
      row = {
        id: rowId,
        title: section.rowTitle || "",
        description: section.rowDescription || "",
        columns: [],
      };
      rowMap.set(rowId, row);
      rows.push(row);
    }

    row.columns.push(section);
  }

  return rows;
}

export async function provisionMatrixDefinitions(client, { tenantId, productId, matrixConfig, normalizedRows }) {
  const context = {
    tenantId,
    productId,
    groups: await loadGroups(client, tenantId, productId),
  };

  const verticalDefinition = {
    sectionId: matrixConfig.verticalAxis.sectionId || "vertical-axis",
    uiMode: matrixConfig.verticalAxis.uiMode || "buttons",
    groupUiMode: matrixConfig.verticalAxis.groupUiMode || matrixConfig.verticalAxis.uiMode || "buttons",
    title: matrixConfig.verticalAxis.title || matrixConfig.verticalAxis.groupName,
    description: matrixConfig.verticalAxis.description || "",
    selectionMode: matrixConfig.verticalAxis.selectionMode,
    sortOrder: matrixConfig.verticalAxis.sortOrder ?? 0,
    ...matrixConfig.verticalAxis,
  };

  const sections = (matrixConfig.sections || []).map((section, index) => ({
    uiMode: section.uiMode || "buttons",
    groupUiMode: section.groupUiMode || section.uiMode || "buttons",
    title: section.title || section.groupName,
    description: section.description || "",
    selectionMode: section.selectionMode || "required",
    includeInVariantName: section.includeInVariantName !== false,
    includeInSelectionMap: section.includeInSelectionMap !== false,
    isVariantDimension: Boolean(section.isVariantDimension),
    sortOrder:
      section.sortOrder ??
      (verticalDefinition.sortOrder ?? 0) + index + 1,
    ...section,
  }));

  const verticalGroup = await ensureGroup(client, context, verticalDefinition);
  const verticalSpecs = buildDesiredValueSpecs(verticalDefinition, normalizedRows);
  const verticalValues = [];
  const verticalValueByName = new Map();

  for (const spec of verticalSpecs) {
    const value = await ensureValue(client, context, verticalGroup, spec);
    verticalValues.push(value);
    verticalValueByName.set(spec.name, value);
  }

  const resolvedSections = new Map();

  for (const section of sections) {
    const group = await ensureGroup(client, context, section);
    const desiredSpecs = buildDesiredValueSpecs(section, normalizedRows);
    const values = [];
    const valueByName = new Map();

    for (const spec of desiredSpecs) {
      const value = await ensureValue(client, context, group, spec);
      values.push(value);
      valueByName.set(spec.name, value);
    }

    resolvedSections.set(section.key, {
      definition: section,
      group,
      values,
      valueByName,
    });
  }

  return {
    context,
    verticalAxis: {
      definition: verticalDefinition,
      group: verticalGroup,
      values: verticalValues,
      valueByName: verticalValueByName,
    },
    sections,
    resolvedSections,
  };
}

export function buildMatrixLayoutV1(matrixConfig, resolved, quantities) {
  const rows = groupSectionsByRow(
    resolved.sections.map((section) => {
      const sectionRef = resolved.resolvedSections.get(section.key);
      return {
        id: section.sectionId,
        rowId: section.rowId,
        rowTitle: section.rowTitle || "",
        rowDescription: section.rowDescription || "",
        sectionType: section.sectionType,
        groupId: sectionRef.group.id,
        valueIds: sectionRef.values.map((value) => value.id),
        ui_mode: section.uiMode,
        selection_mode: section.selectionMode,
        valueSettings: section.valueSettings || {},
        title: section.title,
        description: section.description,
      };
    })
  );

  return {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {
      sectionId: resolved.verticalAxis.definition.sectionId || "vertical-axis",
      sectionType: resolved.verticalAxis.definition.sectionType,
      groupId: resolved.verticalAxis.group.id,
      valueIds: resolved.verticalAxis.values.map((value) => value.id),
      ui_mode: resolved.verticalAxis.definition.uiMode,
      valueSettings: resolved.verticalAxis.definition.valueSettings || {},
      title: resolved.verticalAxis.definition.title,
      description: resolved.verticalAxis.definition.description,
    },
    layout_rows: rows,
    quantities,
  };
}

export function buildGenericPriceRowsFromNormalized({
  tenantId,
  productId,
  matrixConfig,
  resolved,
  normalizedRows,
}) {
  const dedupeRows = new Map();

  for (const row of normalizedRows) {
    const verticalValueName = row.selections[matrixConfig.verticalAxis.key];
    const verticalValue = resolved.verticalAxis.valueByName.get(verticalValueName);
    if (!verticalValue) {
      throw new Error(
        `Missing resolved vertical axis value '${verticalValueName}' for ${matrixConfig.verticalAxis.key}`
      );
    }

    const selectedSections = resolved.sections.map((section) => {
      const sectionRef = resolved.resolvedSections.get(section.key);
      const valueName = row.selections[section.key];
      const value = sectionRef.valueByName.get(valueName);
      if (!value) {
        throw new Error(
          `Missing resolved section value '${valueName}' for ${section.key}`
        );
      }
      return { section, value };
    });

    const variantName = selectedSections
      .filter(({ section }) => section.includeInVariantName !== false)
      .map(({ value }) => value.id)
      .sort()
      .join("|") || "none";

    const variantValueIds = selectedSections
      .filter(({ section }) => section.isVariantDimension)
      .map(({ value }) => value.id);

    const selectionMap = {};

    if (matrixConfig.verticalAxis.includeInSelectionMap !== false) {
      const selectionKey =
        matrixConfig.verticalAxis.selectionMapKey || matrixConfig.verticalAxis.key;
      selectionMap[selectionKey] = verticalValue.id;
    }

    for (const { section, value } of selectedSections) {
      if (section.includeInSelectionMap === false) continue;
      selectionMap[section.selectionMapKey || section.key] = value.id;
    }

    if (variantValueIds.length > 0) {
      selectionMap.variantValueIds = [...variantValueIds];
    }

    const generatedExtraData = {
      verticalAxisGroupId: resolved.verticalAxis.group.id,
      verticalAxisValueId: verticalValue.id,
      selectionMap,
    };

    if (matrixConfig.verticalAxis.extraDataIdField) {
      generatedExtraData[matrixConfig.verticalAxis.extraDataIdField] = verticalValue.id;
    }

    for (const { section, value } of selectedSections) {
      if (section.extraDataIdField) {
        generatedExtraData[section.extraDataIdField] = value.id;
      }
    }

    if (variantValueIds.length > 0) {
      generatedExtraData.variantValueIds = [...variantValueIds];
    }

    const rowExtraData = isPlainObject(row.extraData) ? row.extraData : {};
    const mergedExtraData = {
      ...generatedExtraData,
      ...rowExtraData,
    };

    if (isPlainObject(rowExtraData.selectionMap)) {
      mergedExtraData.selectionMap = {
        ...generatedExtraData.selectionMap,
        ...rowExtraData.selectionMap,
      };
    }

    const payload = {
      tenant_id: tenantId,
      product_id: productId,
      variant_name: variantName,
      variant_value: verticalValue.id,
      quantity: row.quantity,
      price_dkk: row.finalPriceDkk,
      extra_data: mergedExtraData,
    };

    const dedupeKey = `${payload.product_id}|${payload.variant_name}|${payload.variant_value}|${payload.quantity}`;
    dedupeRows.set(dedupeKey, payload);
  }

  return Array.from(dedupeRows.values());
}

export async function replaceGenericProductPrices(
  client,
  { tenantId, productId, rows, deleteByTenant = false, batchSize = 500 }
) {
  let query = client.from("generic_product_prices").delete().eq("product_id", productId);
  if (deleteByTenant) {
    query = query.eq("tenant_id", tenantId);
  }

  const { error: deleteError } = await query;
  if (deleteError) throw deleteError;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.from("generic_product_prices").insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }

  return inserted;
}

export async function publishNormalizedMatrixProduct({
  client,
  tenantId,
  productId,
  productUpdate = {},
  matrixConfig,
  normalizedRows,
  deleteByTenant = false,
  dryRun = false,
}) {
  assertValidNormalizedPricingRecords(normalizedRows, {
    matrixConfig,
  });

  const quantities = collectNormalizedQuantities(normalizedRows);
  const summary = summarizeNormalizedRecords(normalizedRows);

  if (dryRun) {
    return {
      dryRun: true,
      productId,
      quantities,
      summary,
    };
  }

  const resolved = await provisionMatrixDefinitions(client, {
    tenantId,
    productId,
    matrixConfig,
    normalizedRows,
  });

  const pricingStructure = buildMatrixLayoutV1(matrixConfig, resolved, quantities);
  const priceRows = buildGenericPriceRowsFromNormalized({
    tenantId,
    productId,
    matrixConfig,
    resolved,
    normalizedRows,
  });

  const { error: productUpdateError } = await client
    .from("products")
    .update({
      pricing_type: "matrix",
      pricing_structure: pricingStructure,
      ...productUpdate,
    })
    .eq("id", productId);

  if (productUpdateError) throw productUpdateError;

  const inserted = await replaceGenericProductPrices(client, {
    tenantId,
    productId,
    rows: priceRows,
    deleteByTenant,
  });

  return {
    dryRun: false,
    productId,
    quantities,
    pricingStructure,
    rowsInserted: inserted,
    summary,
  };
}
