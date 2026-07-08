import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const PRICE_CHUNK_SIZE = 500;
const PIXART_FLAT_BANK_PRODUCT_KEY = "pixart-flat-surface-adhesive";
const PIXART_RIGIDS_BANK_PRODUCT_KEY = "pixart-rigids";
const PRINT_COM_ANCHOR_OPTION_KEYS = new Set(["material", "size", "printtype", "finish"]);
const SUPPLIER_BANK_TSHIRT_FORMAT = {
  label: "Standard",
  widthMm: 300,
  heightMm: 400,
};
const TSHIRT_SIZE_DISTRIBUTION_LOCK = {
  enabled: true,
  title: "Størrelsesfordeling",
  enforce_quantity_match: true,
  fields: [
    { key: "small", label: "Small" },
    { key: "medium", label: "Medium" },
    { key: "large", label: "Large" },
    { key: "xl", label: "XL" },
    { key: "2xl", label: "2XL" },
    { key: "3xl", label: "3XL" },
    { key: "4xl", label: "4XL" },
    { key: "5xl", label: "5XL" },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeText = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

const slugify = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const addLookupAliasesToSet = (bucket: Set<string>, value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return;
  bucket.add(normalized);
  bucket.add(normalized.toLowerCase());
  const slug = slugify(normalized);
  if (slug) bucket.add(slug);
};

const addLookupAliasesToMap = (bucket: Map<string, any>, value: unknown, resolved: any) => {
  const normalized = normalizeText(value);
  if (!normalized) return;
  bucket.set(normalized, resolved);
  bucket.set(normalized.toLowerCase(), resolved);
  const slug = slugify(normalized);
  if (slug) bucket.set(slug, resolved);
};

const getLookupAliases = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const aliases = new Set<string>([normalized, normalized.toLowerCase()]);
  const slug = slugify(normalized);
  if (slug) aliases.add(slug);
  return Array.from(aliases);
};

const getLookupValueFromMap = (lookup: Map<string, any> | undefined, value: unknown) => {
  for (const alias of getLookupAliases(value)) {
    if (!alias) continue;
    const found = lookup?.get(alias);
    if (found) return found;
  }
  return undefined;
};

const hasLookupInMap = (lookup: Map<string, any> | undefined, value: unknown) => {
  for (const alias of getLookupAliases(value)) {
    if (!alias) continue;
    if (lookup?.has(alias)) return true;
  }
  return false;
};

const hasLookupInSet = (lookup: Set<string> | undefined, value: unknown) => {
  if (!lookup) return false;
  for (const alias of getLookupAliases(value)) {
    if (!alias) continue;
    if (lookup.has(alias)) return true;
  }
  return false;
};

const lookupValuesMatch = (left: unknown, right: unknown) => {
  const leftAliases = getLookupAliases(left);
  const rightAliases = new Set(getLookupAliases(right));
  if (leftAliases.length === 0 || rightAliases.size === 0) return false;
  return leftAliases.some((alias) => rightAliases.has(alias));
};

const isUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const finiteNumberOrNull = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const readSelection = (row: any, key: string) => {
  if (row?.selections && Object.prototype.hasOwnProperty.call(row.selections, key)) return row.selections[key];
  if (row?.options && Object.prototype.hasOwnProperty.call(row.options, key)) return row.options[key];
  if (row?.labels && Object.prototype.hasOwnProperty.call(row.labels, `${key}Label`)) return row.labels[`${key}Label`];
  if (row?.labels && Object.prototype.hasOwnProperty.call(row.labels, key)) return row.labels[key];
  return null;
};

const getSelection = (row: any, key: string) => normalizeText(readSelection(row, key));

const normalizePriceString = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const comma = raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(comma);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPrice = (row: any) => {
  const rawPrice = row?.finalPriceDkk ?? row?.proposedPriceDkk ?? row?.proposed_price_dkk;
  const parsedText = normalizePriceString(rawPrice);
  return parsedText !== null ? parsedText : finiteNumberOrNull(rawPrice);
};

const normalizeRowFilter = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce((acc, [rawKey, rawValue]) => {
    const key = normalizeText(rawKey);
    const selected = normalizeText(rawValue);
    if (key && selected) acc[key] = selected;
    return acc;
  }, {} as Record<string, string>);
};

const getRowFilterEntries = (rowFilter: Record<string, string>) =>
  Object.entries(rowFilter).filter(([key, value]) => Boolean(key && value));

const readSelectionCandidates = (row: any, key: string) => {
  const candidates = [
    readSelection(row, key),
    row?.labels?.[`${key}Label`],
    row?.labels?.[key],
  ];
  return Array.from(new Set(candidates.map(normalizeText).filter(Boolean)));
};

const rowMatchesFilter = (row: any, rowFilter: Record<string, string>) =>
  getRowFilterEntries(rowFilter).every(([key, selected]) => (
    readSelectionCandidates(row, key).some((candidate) => (
      candidate === selected || slugify(candidate) === slugify(selected)
    ))
  ));

const getSelectedValuesByKey = (rows: any[]) => {
  const selectedValues = new Map<string, Set<string>>();
  for (const row of rows) {
    const selections = row?.selections && typeof row.selections === "object" ? row.selections : {};
    const options = row?.options && typeof row.options === "object" ? row.options : {};
    const labels = row?.labels && typeof row.labels === "object" ? row.labels : {};
    const rowKeys = new Set<string>([
      ...Object.keys(selections).map((key) => normalizeText(key).replace(/label$/i, "")),
      ...Object.keys(options).map((key) => normalizeText(key).replace(/label$/i, "")),
      ...Object.keys(labels).map((key) => normalizeText(key).replace(/label$/i, "")),
    ]);
    for (const normalizedKey of rowKeys) {
      if (!normalizedKey) continue;
      const values = readSelectionCandidates(row, normalizedKey);
      if (values.length === 0) continue;
      if (!selectedValues.has(normalizedKey)) selectedValues.set(normalizedKey, new Set());
      const set = selectedValues.get(normalizedKey);
      if (!set) continue;
      for (const value of values) {
        addLookupAliasesToSet(set, value);
      }
    }
  }
  return selectedValues;
};

const getPriceReviewGate = (
  snapshotCount: number,
  latestPriceSnapshotId: string,
  latestReview: any,
) => {
  if (snapshotCount < 2) {
    return {
      allowed: true,
      reason: null,
      snapshotCount,
      latestReviewStatus: latestReview?.status || null,
      latestReviewId: latestReview?.id || null,
    };
  }

  if (!latestReview) {
    return {
      allowed: false,
      reason: "At least two price snapshots exist; create and accept a price-delta review before draft import",
      snapshotCount,
      latestReviewStatus: null,
      latestReviewId: null,
    };
  }

  if (latestReview.new_price_snapshot_id !== latestPriceSnapshotId) {
    return {
      allowed: false,
      reason: "Latest price-delta review does not target the latest price snapshot",
      snapshotCount,
      latestReviewStatus: latestReview.status || null,
      latestReviewId: latestReview.id || null,
    };
  }

  if (latestReview.status !== "accepted") {
    return {
      allowed: false,
      reason: `Latest price-delta review is ${latestReview.status}; accept it before draft import`,
      snapshotCount,
      latestReviewStatus: latestReview.status || null,
      latestReviewId: latestReview.id || null,
    };
  }

  return {
    allowed: true,
    reason: null,
    snapshotCount,
    latestReviewStatus: latestReview.status,
    latestReviewId: latestReview.id,
  };
};

const getMatrixDraftImportUnsupportedReason = (bankProduct: any) => {
  if (bankProduct?.supplier_product_key === PIXART_FLAT_BANK_PRODUCT_KEY) {
    return "Pixart flat-surface rows require the storformat conversion path before draft import.";
  }
  if (bankProduct?.supplier_product_key === PIXART_RIGIDS_BANK_PRODUCT_KEY) {
    return "Pixart rigids rows require the storformat conversion path before draft import.";
  }
  return null;
};

const resolveGroupKind = (key: string) => {
  if (key === "format" || key === "size") return "format";
  if (key === "material") return "material";
  if (key === "fold" || key === "finish") return "finish";
  return "other";
};

const resolveSectionType = (key: string) => {
  if (key === "format" || key === "size") return "formats";
  if (key === "material") return "materials";
  if (key === "fold" || key === "finish") return "finishes";
  return "other";
};

const resolveAttributeKey = (attribute: any, index: number) =>
  normalizeText(attribute?.key || attribute?.slug || `attribute_${index}`);

const resolveAttributeLabel = (attribute: any, key: string) =>
  normalizeText(attribute?.labelDa || attribute?.labelOriginal || attribute?.name_da || attribute?.name_original || attribute?.name || key);

const resolveValueKey = (value: any) => normalizeText(value?.key ?? value?.slug ?? value?.value ?? value?.name_da ?? value?.labelDa ?? value);

const resolveValueLabel = (value: any, key: string) =>
  normalizeText(value?.labelDa || value?.labelOriginal || value?.name_da || value?.name_original || value?.name || key);

const findSampleOption = (options: any[], rawValue: unknown) => {
  const comparable = getLookupAliases(rawValue);
  if (comparable.length === 0) return null;
  return options.find((option) => {
    const candidate = getLookupAliases(option?.slug ?? option?.key ?? option?.value);
    return candidate.some((alias) => comparable.includes(alias));
  }) || null;
};

const normalizeAttributeDefinitions = (attributes: any, rows: any[]) => {
  const selectedValuesByKey = getSelectedValuesByKey(rows);

  if (Array.isArray(attributes)) {
    return attributes
      .map((attribute, index) => {
        const key = resolveAttributeKey(attribute, index);
        const values = Array.isArray(attribute?.values) ? attribute.values : [];
        const selectedValues = selectedValuesByKey.get(key);
        return {
          ...attribute,
          key,
          labelDa: attribute?.labelDa || attribute?.name_da || attribute?.labelOriginal || attribute?.name_original || key,
          labelOriginal: attribute?.labelOriginal || attribute?.name_original || attribute?.labelDa || attribute?.name_da || key,
          values: values
            .map((value: any) => {
              const valueKey = resolveValueKey(value);
              return {
                ...value,
                key: valueKey,
                labelDa: value?.labelDa || value?.name_da || value?.labelOriginal || value?.name_original || valueKey,
                labelOriginal: value?.labelOriginal || value?.name_original || value?.labelDa || value?.name_da || valueKey,
              };
            })
            .filter((value: any) => {
              if (!selectedValues || selectedValues.size === 0) return true;
              return hasLookupInSet(selectedValues, value.key)
                || hasLookupInSet(selectedValues, value.labelDa)
                || hasLookupInSet(selectedValues, value.labelOriginal);
            }),
        };
      })
      .filter((attribute) => attribute.key && Array.isArray(attribute.values) && attribute.values.length > 0);
  }

  const printComAttributes = Array.isArray(attributes?.attributes) ? attributes.attributes : [];
  return printComAttributes
    .map((attribute: any, index: number) => {
      const key = resolveAttributeKey(attribute, index);
      if (!key || key === "copies") return null;

      const rawValues = Array.from(new Set(
        rows
          .map((row) => readSelection(row, key))
          .filter((value) => value !== null && value !== undefined && normalizeText(value))
          .map((value) => normalizeText(value)),
      ));
      if (rawValues.length === 0) return null;
      if (rawValues.length === 1 && !PRINT_COM_ANCHOR_OPTION_KEYS.has(key)) return null;

      const sampleOptions = Array.isArray(attribute?.sample_options) ? attribute.sample_options : [];
      const values = rawValues.map((rawValue) => {
        const sample = findSampleOption(sampleOptions, rawValue);
        return {
          key: rawValue,
          labelDa: resolveValueLabel(sample, rawValue),
          labelOriginal: normalizeText(sample?.name_original || sample?.labelOriginal || sample?.name_da || sample?.labelDa || rawValue),
          metadata: {
            supplierOptionKey: key,
            supplierOptionValue: rawValue,
            locked: Boolean(attribute?.locked),
          },
        };
      });

      return {
        key,
        labelDa: resolveAttributeLabel(attribute, key),
        labelOriginal: normalizeText(attribute?.name_original || attribute?.labelOriginal || attribute?.name_da || attribute?.labelDa || key),
        values,
      };
    })
    .filter(Boolean);
};

const buildAttributeDefinitions = (attributes: any, rows: any[]) => {
  const source = normalizeAttributeDefinitions(attributes, rows);
  const material = source.find((attribute: any) => attribute?.key === "material") || source[0];
  const sections = source.filter((attribute: any) => attribute?.key !== material?.key);
  return { material, sections };
};

const summarizeMatrixDraftConversion = (attributeDefinitions: any, rows: any[]) => {
  const materialKey = attributeDefinitions.material?.key || "material";
  const rowsWithPrice = rows.filter((row: any) => Number.isFinite(getPrice(row)));
  const rowsWithMaterial = attributeDefinitions.material
    ? rowsWithPrice.filter((row: any) => getSelection(row, materialKey))
    : [];
  const allAttributes = [attributeDefinitions.material, ...attributeDefinitions.sections].filter(Boolean);
  const missingSelectionCounts = allAttributes
    .map((attribute: any) => ({
      key: attribute.key,
      missing: rows.filter((row: any) => !getSelection(row, attribute.key)).length,
    }))
    .filter((entry: any) => entry.missing > 0);

  let reason = null;
  if (allAttributes.length === 0 || !attributeDefinitions.material) {
    reason = "No Matrix Layout attribute groups could be built from this supplier-bank product";
  } else if (rowsWithPrice.length !== rows.length) {
    reason = "Not all supplier-bank rows contain a usable DKK price";
  } else if (rowsWithMaterial.length !== rows.length) {
    reason = "Not all supplier-bank rows map to a Matrix Layout material row";
  }

  return {
    allowed: !reason,
    reason,
    rowsWithPrice: rowsWithPrice.length,
    rowsWithMaterial: rowsWithMaterial.length,
    attributeCount: allAttributes.length,
    missingSelectionCounts,
  };
};

const buildSupplierBankTechnicalSpecs = (
  bankProduct: any,
  bankProductId: string,
  rowFilter: Record<string, string> = {},
) => {
  const specs: any = {
    bleed_mm: 3,
    min_dpi: 300,
    source: "supplier-bank",
    supplierProductKey: bankProduct.supplier_product_key,
    bankProductId,
  };

  if (getRowFilterEntries(rowFilter).length > 0) {
    specs.supplier_bank_row_filter = rowFilter;
  }

  if (bankProduct.product_family === "tshirts") {
    specs.width_mm = SUPPLIER_BANK_TSHIRT_FORMAT.widthMm;
    specs.height_mm = SUPPLIER_BANK_TSHIRT_FORMAT.heightMm;
    specs.bleed_mm = 0;
    specs.is_free_form = false;
    specs.standard_format = SUPPLIER_BANK_TSHIRT_FORMAT.label;
    specs.size_distribution = {
      enabled: TSHIRT_SIZE_DISTRIBUTION_LOCK.enabled,
      title: TSHIRT_SIZE_DISTRIBUTION_LOCK.title,
      enforce_quantity_match: TSHIRT_SIZE_DISTRIBUTION_LOCK.enforce_quantity_match,
      fields: TSHIRT_SIZE_DISTRIBUTION_LOCK.fields.map((field) => ({
        key: field.key,
        label: field.label,
      })),
    };
  }

  return specs;
};

const cleanupCreatedDraftProduct = async (serviceClient: any, productId: string) => {
  const errors: string[] = [];
  const deleteByProductId = async (table: string) => {
    const { error } = await serviceClient.from(table).delete().eq("product_id", productId);
    if (error) errors.push(`${table}: ${error.message || "delete failed"}`);
  };

  await deleteByProductId("generic_product_prices");
  await deleteByProductId("product_attribute_values");
  await deleteByProductId("product_attribute_groups");

  const { error: jobError } = await serviceClient
    .from("supplier_bank_import_jobs")
    .delete()
    .eq("target_product_id", productId);
  if (jobError) errors.push(`supplier_bank_import_jobs: ${jobError.message || "delete failed"}`);

  const { error: productError } = await serviceClient
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("is_published", false);
  if (productError) errors.push(`products: ${productError.message || "delete failed"}`);

  return {
    attempted: true,
    productId,
    errors,
    success: errors.length === 0,
  };
};

const buildMatrixGenericRows = ({
  rows,
  attributeDefinitions,
  materialKey,
  groupByKey,
  valueByGroupKey,
  bankProductId,
  priceSnapshot,
  targetTenantId,
  targetProductId,
  includeInvalidRows = false,
}: {
  rows: any[];
  attributeDefinitions: any;
  materialKey: string;
  groupByKey: Map<string, any>;
  valueByGroupKey: Map<string, Map<string, any>>;
  bankProductId: string;
  priceSnapshot: any;
  targetTenantId: string;
  targetProductId: string;
  includeInvalidRows?: boolean;
}) => {
  const materialGroup = groupByKey.get(materialKey);
  const genericRows = rows
    .map((row: any) => {
      const materialValue = getLookupValueFromMap(valueByGroupKey.get(materialKey), getSelection(row, materialKey));
      const selectedSections = attributeDefinitions.sections
        .map((attribute: any) => {
          const value = getLookupValueFromMap(valueByGroupKey.get(attribute.key), getSelection(row, attribute.key));
          return value ? { attribute, value } : null;
        })
        .filter(Boolean);
      const sectionValueIds = selectedSections.map((entry: any) => entry.value.id);
      const variantValueIds = selectedSections
        .filter((entry: any) => !["format", "material"].includes(String(entry.attribute.key || "").toLowerCase()))
        .map((entry: any) => entry.value.id);
      const selectionMap: Record<string, string | string[]> = {};

      if (materialValue) selectionMap[materialKey] = materialValue.id;
      for (const entry of selectedSections as any[]) {
        if (!entry?.attribute?.key || !entry?.value?.id) continue;
        selectionMap[entry.attribute.key] = entry.value.id;
      }
      if (variantValueIds.length > 0) selectionMap.variantValueIds = [...variantValueIds];

      const extraIds: Record<string, unknown> = {
        verticalAxisGroupId: materialGroup?.id || null,
        verticalAxisValueId: materialValue?.id || null,
        materialId: materialValue?.id || null,
        variantValueIds,
        selectionMap,
      };

      for (const entry of selectedSections as any[]) {
        const key = String(entry.attribute.key || "");
        if (key === "format" || key === "size") extraIds.formatId = entry.value.id;
        if (key === "surface") extraIds.surfaceId = entry.value.id;
        if (key === "fold") extraIds.foldId = entry.value.id;
        if (key === "pages") extraIds.pagesId = entry.value.id;
        if (key === "orientation") extraIds.orientationId = entry.value.id;
      }

      const price = getPrice(row);
      if (!includeInvalidRows && (!materialValue || !Number.isFinite(price))) return null;
      if (materialValue === undefined || !Number.isFinite(price)) {
        return includeInvalidRows ? {
          tenant_id: targetTenantId,
          product_id: targetProductId,
          variant_name: sectionValueIds.sort().join("|") || "none",
          variant_value: materialValue?.id || null,
          quantity: Number(row.quantity),
          price_dkk: Number.isFinite(price) ? price : 0,
          extra_data: {
            ...extraIds,
            supplierBankProductId: bankProductId,
            supplierBankPriceSnapshotId: priceSnapshot.id,
            supplierPrice: finiteNumberOrNull(row.supplierPrice),
            supplierCurrency: row.supplierCurrency || priceSnapshot.currency || null,
            convertedPriceDkk: finiteNumberOrNull(row.convertedPriceDkk),
            selections: row.selections || row.options || {},
            sourceRowMissingMapping: true,
          },
        } : null;
      }

      return {
        tenant_id: targetTenantId,
        product_id: targetProductId,
        variant_name: sectionValueIds.sort().join("|") || "none",
        variant_value: materialValue.id,
        quantity: Number(row.quantity),
        price_dkk: price,
        extra_data: {
          ...extraIds,
          supplierBankProductId: bankProductId,
          supplierBankPriceSnapshotId: priceSnapshot.id,
          supplierPrice: finiteNumberOrNull(row.supplierPrice),
          supplierCurrency: row.supplierCurrency || priceSnapshot.currency || null,
          convertedPriceDkk: finiteNumberOrNull(row.convertedPriceDkk),
          selections: row.selections || row.options || {},
        },
      };
    })
    .filter(Boolean);

  if (genericRows.length === 0) {
    throw new Error("Ingen gyldige matrix-prisrækker blev bygget ud fra bank-data.");
  }

  return genericRows;
};

const loadRepairAttributeMaps = async (
  serviceClient: any,
  productId: string,
  attributeDefinitions: any,
  normalizedRows: any[],
) => {
  const { data: attributeGroups, error: groupError } = await serviceClient
    .from("product_attribute_groups")
    .select("id,name,kind,sort_order")
    .eq("product_id", productId)
    .order("sort_order");

  if (groupError) throw groupError;

  const { data: attributeValues, error: valueError } = await serviceClient
    .from("product_attribute_values")
    .select("id,name,group_id,width_mm,height_mm,sort_order,meta")
    .eq("product_id", productId)
    .order("sort_order");

  if (valueError) throw valueError;

  const allAttributes = [attributeDefinitions.material, ...attributeDefinitions.sections]
    .filter(Boolean)
    .map((attribute: any) => ({
      ...attribute,
      key: attribute.key || "",
      label: normalizeText(attribute.labelDa || attribute.labelOriginal || attribute.key),
    }));

  if (!Array.isArray(attributeGroups) || attributeGroups.length === 0) {
    throw new Error("Draft produktet har ingen attribut-grupper at reparere imod.");
  }

  const valuesByGroup = (attributeValues || []).reduce((acc: Record<string, any[]>, row: any) => {
    const key = row.group_id as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {} as Record<string, any[]>);

  const selectedValuesByKey = getSelectedValuesByKey(normalizedRows);
  const consumedGroupIds = new Set<string>();
  const groupByKey = new Map<string, any>();
  const valueByGroupKey = new Map<string, Map<string, any>>();
  const missingParts: string[] = [];

  for (let index = 0; index < allAttributes.length; index += 1) {
    const attribute = allAttributes[index];
    const key = attribute.key || `attribute_${index}`;
    const kind = resolveGroupKind(key);
    const expectedName = normalizeText(attribute.label);
    const expectedNameAliases = getLookupAliases(expectedName);
    const expectedValues = Array.from(selectedValuesByKey.get(key) || new Set<string>());

    let group = (attributeGroups || []).find((entry: any) => (
      !consumedGroupIds.has(entry.id)
        && (expectedNameAliases.length === 0 ? false : lookupValuesMatch(entry.name, expectedName))
    ));
    if (!group && key === "material") {
      group = (attributeGroups || []).find((entry: any) => entry.kind === "material" && !consumedGroupIds.has(entry.id));
    }
    if (!group && kind !== "material") {
      group = (attributeGroups || []).find((entry: any) => entry.kind === kind && !consumedGroupIds.has(entry.id));
    }
    if (!group) {
      missingParts.push(`Manglende gruppe: ${attribute.key}`);
      continue;
    }

    consumedGroupIds.add(group.id);
    groupByKey.set(key, group);
    const existingValues = valuesByGroup[group.id] || [];
    const byName = new Map<string, any>();
    for (const existingValue of existingValues) {
      addLookupAliasesToMap(byName, existingValue.name, existingValue);
      const metadata = existingValue.meta && typeof existingValue.meta === "object" ? existingValue.meta : {};
      addLookupAliasesToMap(byName, metadata.supplierOptionValue, existingValue);
      addLookupAliasesToMap(byName, metadata.key, existingValue);
    }

    for (const expectedValue of expectedValues) {
      if (expectedValue && !hasLookupInMap(byName, expectedValue)) {
        missingParts.push(`Manglende værdi i ${attribute.key}: ${expectedValue}`);
      }
    }

    valueByGroupKey.set(key, byName);
  }

  if (missingParts.length > 0) {
    throw new Error(`Draft produktets struktur afviger fra bank-layout: ${missingParts.join(", ")}. Gentag import som ny draft.`);
  }

  return {
    groupByKey,
    valueByGroupKey,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let serviceClient: any = null;
  let createdDraftProductId: string | null = null;

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRows, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "master_admin");

    if (roleError) throw roleError;
    if (!Array.isArray(roleRows) || roleRows.length === 0) {
      return json({ error: "Master admin access required" }, 403);
    }

    const body = await req.json();
    const bankProductId = body?.bankProductId;
    const targetTenantId = isUuid(body?.targetTenantId) ? body.targetTenantId : MASTER_TENANT_ID;
    const dryRun = body?.dryRun !== false;
    if (!isUuid(bankProductId)) return json({ error: "bankProductId required" }, 400);

    const { data: bankProduct, error: productError } = await serviceClient
      .from("supplier_bank_products")
      .select("id,supplier_id,supplier_product_key,product_family,name_da,name_original,description_da,description_original,status,normalized_attributes,normalized_pricing_summary,raw_snapshot_path")
      .eq("id", bankProductId)
      .single();

    if (productError || !bankProduct) return json({ error: "Bank product not found" }, 404);

    const { data: priceSnapshot, error: snapshotError } = await serviceClient
      .from("supplier_bank_price_snapshots")
      .select("id,normalized_price_rows,currency,created_at")
      .eq("bank_product_id", bankProductId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) throw snapshotError;
    if (!priceSnapshot) return json({ error: "No price snapshot found for bank product" }, 409);

    const { data: snapshotRows, count: snapshotCountRaw, error: snapshotCountError } = await serviceClient
      .from("supplier_bank_price_snapshots")
      .select("id,created_at", { count: "exact" })
      .eq("bank_product_id", bankProductId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (snapshotCountError) throw snapshotCountError;

    const snapshotCount = Number.isFinite(Number(snapshotCountRaw))
      ? Number(snapshotCountRaw)
      : Array.isArray(snapshotRows)
        ? snapshotRows.length
        : 0;

    const { data: latestReview, error: latestReviewError } = await serviceClient
      .from("supplier_bank_price_delta_reviews")
      .select("id,status,new_price_snapshot_id,created_at")
      .eq("bank_product_id", bankProductId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestReviewError) throw latestReviewError;

    const priceReviewGate = getPriceReviewGate(snapshotCount, priceSnapshot.id, latestReview);

    const storedNormalizedRows = Array.isArray(priceSnapshot.normalized_price_rows)
      ? priceSnapshot.normalized_price_rows
      : [];
    const rowFilter = normalizeRowFilter(body?.rowFilter);
    const rowFilterEntries = getRowFilterEntries(rowFilter);
    const normalizedRows = rowFilterEntries.length > 0
      ? storedNormalizedRows.filter((row: any) => rowMatchesFilter(row, rowFilter))
      : storedNormalizedRows;
    if (normalizedRows.length === 0) {
      return json({
        error: rowFilterEntries.length > 0
          ? "Selected supplier-bank option filter matches no normalized price rows"
          : "Price snapshot has no normalized rows",
        rowFilter,
        rowsAvailableInSnapshot: storedNormalizedRows.length,
      }, 409);
    }

    const repairProductId = isUuid(body?.repairProductId) ? body.repairProductId : null;
    const repairImportMode = Boolean(repairProductId);
    const repairImportJobId = isUuid(body?.repairImportJobId) ? body.repairImportJobId : null;
    const productName = normalizeText(body?.productName) || bankProduct.name_da || bankProduct.name_original;
    const productSlug = slugify(body?.productSlug || bankProduct.supplier_product_key || productName);
    if (!productSlug) return json({ error: "Valid product slug required" }, 400);

    const quantityValues = normalizedRows.map((row: any) => Number(row?.quantity)).filter(finiteNumber);
    const quantities = Array.from(new Set<number>(quantityValues)).sort((a, b) => a - b);
    const prices = normalizedRows.map(getPrice).filter((value: number | null): value is number => Number.isFinite(value));
    const attributeDefinitions = buildAttributeDefinitions(bankProduct.normalized_attributes || [], normalizedRows);
    const previewAttributes = [attributeDefinitions.material, ...attributeDefinitions.sections].filter(Boolean);
    const conversionGate = summarizeMatrixDraftConversion(attributeDefinitions, normalizedRows);
    const unsupportedMatrixReason = getMatrixDraftImportUnsupportedReason(bankProduct);

    const preview = {
      dryRun,
      bankProductId,
      targetTenantId,
      productName,
      productSlug,
      importMode: "matrix_layout_v1",
      rowFilter,
      rowFilterActive: rowFilterEntries.length > 0,
      statusRequired: "approved",
      bankProductStatus: bankProduct.status,
      rowsAvailableInSnapshot: storedNormalizedRows.length,
      rowsPrepared: normalizedRows.length,
      quantityMin: quantities[0] ?? null,
      quantityMax: quantities[quantities.length - 1] ?? null,
      priceMinDkk: prices.length ? Math.min(...prices) : null,
      priceMaxDkk: prices.length ? Math.max(...prices) : null,
      rowsWithPrice: conversionGate.rowsWithPrice,
      rowsThatWouldBecomeGenericProductPrices: conversionGate.rowsWithMaterial,
      attributeGroups: previewAttributes.map((attribute: any) => ({
        key: attribute.key,
        label: attribute.labelDa || attribute.labelOriginal || attribute.key,
        values: Array.isArray(attribute.values) ? attribute.values.length : 0,
      })),
      conversionGate: {
        allowed: !unsupportedMatrixReason && conversionGate.allowed,
        reason: unsupportedMatrixReason || conversionGate.reason,
        missingSelectionCounts: conversionGate.missingSelectionCounts,
      },
      technicalSpecs: {
        productFamily: bankProduct.product_family,
        sourceRowsFiltered: rowFilterEntries.length > 0,
        hasTshirtSizeDistribution: bankProduct.product_family === "tshirts",
        sizeDistributionFields: bankProduct.product_family === "tshirts"
          ? TSHIRT_SIZE_DISTRIBUTION_LOCK.fields.map((field) => field.key)
          : [],
      },
      priceSnapshotId: priceSnapshot.id,
      priceReview: priceReviewGate,
    };

    if (dryRun) return json(preview);
    if (!priceReviewGate.allowed) {
      return json({ error: priceReviewGate.reason, preview }, 409);
    }
    if (unsupportedMatrixReason) {
      return json({ error: unsupportedMatrixReason, preview }, 409);
    }
    if (!conversionGate.allowed) {
      return json({ error: conversionGate.reason, preview }, 409);
    }
    if (bankProduct.status !== "approved") {
      return json({ error: "Bank product must be approved before draft import", preview }, 409);
    }

    let createdProductId: string | null = null;
    if (repairImportMode) {
      const { data: targetProduct, error: targetProductError } = await serviceClient
        .from("products")
        .select("id,tenant_id,is_published,name,slug")
        .eq("id", repairProductId)
        .single();
      if (targetProductError || !targetProduct) return json({ error: "Repair target product not found" }, 404);
      if (targetProduct.tenant_id !== targetTenantId) {
        return json({ error: "Repair target tenant mismatch for selected target product" }, 409);
      }
      if (targetProduct.is_published) {
        return json({ error: "Repair can only run on an unpublished import draft." }, 409);
      }
      createdProductId = repairProductId;
    } else {
      const { data: existing, error: existingError } = await serviceClient
        .from("products")
        .select("id")
        .eq("tenant_id", targetTenantId)
        .eq("slug", productSlug)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ error: "Product slug already exists for target tenant", productSlug }, 409);

      const { data: createdProduct, error: createError } = await serviceClient
        .from("products")
        .insert({
          tenant_id: targetTenantId,
          name: productName,
          slug: productSlug,
          icon_text: productName,
          description: bankProduct.description_da || bankProduct.description_original || "Supplier-bank draft product",
          category: "tryksager",
          pricing_type: "matrix",
          is_published: false,
          preset_key: "custom",
          technical_specs: buildSupplierBankTechnicalSpecs(bankProduct, bankProductId, rowFilter),
        })
        .select("id,slug,is_published")
        .single();
      if (createError) throw createError;
      createdDraftProductId = createdProduct.id;
      createdProductId = createdProduct.id;
    }

    if (!createdProductId) return json({ error: "Unable to resolve import target product id." }, 500);

    const groupByKey = new Map<string, any>();
    const valueByGroupKey = new Map<string, Map<string, any>>();
    const allAttributes = [attributeDefinitions.material, ...attributeDefinitions.sections].filter(Boolean);
    const restoredMaps = repairImportMode
      ? await loadRepairAttributeMaps(serviceClient, repairProductId as string, attributeDefinitions, normalizedRows)
      : null;

    if (repairImportMode && restoredMaps) {
      restoredMaps.groupByKey.forEach((group, key) => groupByKey.set(key, group));
      restoredMaps.valueByGroupKey.forEach((values, key) => valueByGroupKey.set(key, values));
      createdProductId = repairProductId;
    } else {
      for (let index = 0; index < allAttributes.length; index += 1) {
        const attribute = allAttributes[index];
        const key = attribute.key || `attribute_${index}`;
        const { data: group, error: groupError } = await serviceClient
          .from("product_attribute_groups")
          .insert({
            tenant_id: targetTenantId,
            product_id: createdProductId,
            name: attribute.labelDa || attribute.labelOriginal || key,
            kind: resolveGroupKind(key),
            source: "product",
            ui_mode: "buttons",
            sort_order: index,
            enabled: true,
          })
          .select("id")
          .single();
        if (groupError) throw groupError;
        groupByKey.set(key, group);
        valueByGroupKey.set(key, new Map());

        const values = Array.isArray(attribute.values) ? attribute.values : [];
        for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
          const value = values[valueIndex];
          const label = normalizeText(value.labelDa || value.labelOriginal || value.key);
          const valueKey = normalizeText(value.key || value.slug || value.value || label);
          if (!label) continue;
          const { data: attributeValue, error: valueError } = await serviceClient
            .from("product_attribute_values")
            .insert({
              tenant_id: targetTenantId,
              product_id: createdProductId,
              group_id: group.id,
              name: label,
              sort_order: valueIndex,
              enabled: true,
              width_mm: finiteNumberOrNull(value.widthMm),
              height_mm: finiteNumberOrNull(value.heightMm),
              meta: value.metadata || {},
            })
            .select("id,name")
            .single();
          if (valueError) throw valueError;
          const groupValueBucket = valueByGroupKey.get(key);
          if (groupValueBucket) {
            addLookupAliasesToMap(groupValueBucket, label, attributeValue);
            if (valueKey) addLookupAliasesToMap(groupValueBucket, valueKey, attributeValue);
            if (value?.metadata) {
              addLookupAliasesToMap(groupValueBucket, value.metadata.supplierOptionValue, attributeValue);
              addLookupAliasesToMap(groupValueBucket, value.metadata.key, attributeValue);
            }
          }
        }
      }
    }

    const materialKey = attributeDefinitions.material?.key || "material";
    const materialGroup = groupByKey.get(materialKey);
    const sectionRows = attributeDefinitions.sections.map((attribute: any, index: number) => {
      const group = groupByKey.get(attribute.key);
      const values = Array.from(valueByGroupKey.get(attribute.key)?.values() || []);
      return {
        id: `row-${attribute.key || index}`,
        title: "",
        description: "",
        columns: [{
          id: `${attribute.key || index}-section`,
          sectionType: resolveSectionType(attribute.key),
          groupId: group?.id,
          valueIds: values.map((value: any) => value.id),
          ui_mode: "buttons",
          selection_mode: "required",
          valueSettings: {},
          title: attribute.labelDa || attribute.labelOriginal || attribute.key,
          description: "",
        }],
      };
    });

    const materialValues = Array.from(valueByGroupKey.get(materialKey)?.values() || []);
    const safeTargetProductId = createdProductId || null;
    if (!safeTargetProductId) {
      throw new Error("Import må ikke fortsætte uden et aktivt målprodukt.");
    }

    const pricingStructure = {
      mode: "matrix_layout_v1",
      version: 1,
      vertical_axis: {
        sectionId: "vertical-axis",
        sectionType: "materials",
        groupId: materialGroup?.id,
        valueIds: materialValues.map((value: any) => value.id),
        ui_mode: "buttons",
        valueSettings: {},
        title: attributeDefinitions.material?.labelDa || "Materiale",
        description: "",
      },
      layout_rows: sectionRows,
      quantities,
    };

    const genericRows = buildMatrixGenericRows({
      rows: normalizedRows,
      attributeDefinitions,
      materialKey,
      groupByKey,
      valueByGroupKey,
      bankProductId,
      priceSnapshot,
      targetTenantId,
      targetProductId: safeTargetProductId,
      includeInvalidRows: false,
    });

    const { error: productUpdateError } = await serviceClient
      .from("products")
      .update({
        pricing_structure: pricingStructure,
        pricing_type: "matrix",
        is_published: false,
        technical_specs: buildSupplierBankTechnicalSpecs(bankProduct, bankProductId, rowFilter),
      })
      .eq("id", createdProductId);
    if (productUpdateError) throw productUpdateError;

    if (repairImportMode) {
      const { error: deleteExistingPricesError } = await serviceClient
        .from("generic_product_prices")
        .delete()
        .eq("product_id", createdProductId);
      if (deleteExistingPricesError) throw deleteExistingPricesError;
    }

    for (let index = 0; index < genericRows.length; index += PRICE_CHUNK_SIZE) {
      const batch = genericRows.slice(index, index + PRICE_CHUNK_SIZE);
      const { error: priceError } = await serviceClient.from("generic_product_prices").insert(batch);
      if (priceError) throw priceError;
    }

    const importSummary = {
      ...preview,
      rowsInserted: genericRows.length,
      rowsPrepared: preview.rowsPrepared,
      rowFilter,
      priceSnapshotId: priceSnapshot.id,
      repairMode: repairImportMode,
    };

    let importJobId = null;
    if (repairImportMode && repairImportJobId) {
      const { data: updatedImportJob, error: updateError } = await serviceClient
        .from("supplier_bank_import_jobs")
        .update({
          import_summary: importSummary,
          target_product_id: createdProductId,
          target_tenant_id: targetTenantId,
          status: "imported",
          import_mode: "matrix_layout_v1",
        })
        .eq("id", repairImportJobId)
        .select("id")
        .single();

      if (!updateError && updatedImportJob?.id) {
        importJobId = updatedImportJob.id;
      } else {
        const { data: recreatedImportJob, error: recreateError } = await serviceClient
          .from("supplier_bank_import_jobs")
          .insert({
            bank_product_id: bankProductId,
            target_tenant_id: targetTenantId,
            target_product_id: createdProductId,
            import_mode: "matrix_layout_v1",
            status: "imported",
            import_summary: importSummary,
            rollback_note: "Recreated by repair flow when original job was missing.",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (recreateError) throw recreateError;
        importJobId = recreatedImportJob?.id ?? null;
      }
    } else {
      const { data: importJob, error: jobError } = await serviceClient
        .from("supplier_bank_import_jobs")
        .insert({
          bank_product_id: bankProductId,
          target_tenant_id: targetTenantId,
          target_product_id: createdProductId,
          import_mode: "matrix_layout_v1",
          status: "imported",
          import_summary: importSummary,
          rollback_note: "Delete created draft product and related product_attribute_groups/product_attribute_values/generic_product_prices if rollback is needed.",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (jobError) throw jobError;
      importJobId = importJob?.id ?? null;
    }

    const { data: createdProduct, error: createdProductError } = await serviceClient
      .from("products")
      .select("id,slug,is_published")
      .eq("id", createdProductId)
      .single();
    if (createdProductError) throw createdProductError;
    if (!createdProduct) throw new Error("Import blev gennemført, men den oprettede draft kunne ikke hentes til bekræftelse.");

    return json({
      ...preview,
      dryRun: false,
      productId: createdProductId,
      productSlug: createdProduct?.slug || productSlug,
      isPublished: createdProduct?.is_published ?? false,
      rowsInserted: genericRows.length,
      importJobId,
      repairMode: repairImportMode,
    });
  } catch (error) {
    console.error("supplier-bank-import-draft error", error);
    let rollback = null;
    if (serviceClient && createdDraftProductId) {
      rollback = await cleanupCreatedDraftProduct(serviceClient, createdDraftProductId);
      if (!rollback.success) console.error("supplier-bank-import-draft rollback errors", rollback.errors);
    }

    return json({
      error: error instanceof Error ? error.message : "Unexpected error",
      rollback,
    }, 500);
  }
});
