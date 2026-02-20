import { createClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }

  return { url, serviceRoleKey };
}

function withImageMeta(existingMeta, imageUrl) {
  const base =
    existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)
      ? { ...existingMeta }
      : {};

  if (imageUrl) {
    base.image = imageUrl;
  }

  return Object.keys(base).length > 0 ? base : null;
}

function getMatrixConfig(blueprint, refs) {
  const isVerticalMaterials = blueprint.matrix.vertical_axis === "materials";

  const verticalGroup = isVerticalMaterials ? refs.materialGroup : refs.formatGroup;
  const verticalValue = isVerticalMaterials ? refs.materialValue : refs.formatValue;

  const selectorGroup = isVerticalMaterials ? refs.formatGroup : refs.materialGroup;
  const selectorValue = isVerticalMaterials ? refs.formatValue : refs.materialValue;

  const verticalSectionType = isVerticalMaterials ? "materials" : "formats";
  const selectorSectionType = isVerticalMaterials ? "formats" : "materials";
  const selectorTitle = isVerticalMaterials ? "Format" : "Materiale";
  const verticalTitle = isVerticalMaterials ? "Materiale" : "Format";

  return {
    verticalGroup,
    verticalValue,
    selectorGroup,
    selectorValue,
    verticalSectionType,
    selectorSectionType,
    selectorTitle,
    verticalTitle,
  };
}

function buildPricingStructure(blueprint, refs, quantities) {
  const cfg = getMatrixConfig(blueprint, refs);

  return {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {
      sectionId: "vertical-axis",
      sectionType: cfg.verticalSectionType,
      groupId: cfg.verticalGroup.id,
      valueIds: [cfg.verticalValue.id],
      ui_mode: "buttons",
      valueSettings: {},
      title: cfg.verticalTitle,
      description: "",
    },
    layout_rows: [
      {
        id: "row-1",
        title: "",
        description: "",
        columns: [
          {
            id: "selector-section",
            sectionType: cfg.selectorSectionType,
            groupId: cfg.selectorGroup.id,
            valueIds: [cfg.selectorValue.id],
            ui_mode: "buttons",
            selection_mode: "required",
            valueSettings: {},
            title: cfg.selectorTitle,
            description: "",
          },
        ],
      },
    ],
    quantities,
  };
}

function buildPriceRows(blueprint, refs, transformedRows) {
  const cfg = getMatrixConfig(blueprint, refs);

  const variantName = [cfg.selectorValue.id].sort().join("|") || "none";

  return transformedRows.map((row) => ({
    tenant_id: blueprint.tenant_id,
    product_id: refs.product.id,
    variant_name: variantName,
    variant_value: cfg.verticalValue.id,
    quantity: row.quantity,
    price_dkk: row.dkk_final,
    extra_data: {
      verticalAxisGroupId: cfg.verticalGroup.id,
      verticalAxisValueId: cfg.verticalValue.id,
      formatId: refs.formatValue.id,
      materialId: refs.materialValue.id,
      selectionMap: {
        format: refs.formatValue.id,
        material: refs.materialValue.id,
      },
      source: "blueprint_ul_prices",
      sourceIndex: row.source_index,
      sourceLiText: row.li_text,
      eur: row.eur,
      dkkBase: row.dkk_base,
      tierMultiplier: row.tier_multiplier,
    },
  }));
}

async function ensureProduct(client, blueprint) {
  const { tenant_id: tenantId, product } = blueprint;

  const { data: existing, error: fetchError } = await client
    .from("products")
    .select("id, tenant_id, slug, name, is_published")
    .eq("tenant_id", tenantId)
    .eq("slug", product.slug)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    return {
      product: existing,
      created: false,
    };
  }

  const insertPayload = {
    tenant_id: tenantId,
    name: product.name,
    icon_text: product.icon_text,
    slug: product.slug,
    description: product.description,
    category: product.category,
    pricing_type: "matrix",
    is_published: false,
    preset_key: product.preset_key,
    image_url: product.image_url,
    technical_specs: product.technical_specs,
  };

  const { data: inserted, error: insertError } = await client
    .from("products")
    .insert(insertPayload)
    .select("id, tenant_id, slug, name, is_published")
    .single();

  if (insertError) throw insertError;

  return {
    product: inserted,
    created: true,
  };
}

async function loadGroups(client, tenantId, productId) {
  const { data, error } = await client
    .from("product_attribute_groups")
    .select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function ensureGroup(client, context, kind, groupName, sortOrder) {
  const existing = context.groups.find((group) => group.kind === kind);
  if (existing) return existing;

  const { data: inserted, error } = await client
    .from("product_attribute_groups")
    .insert({
      tenant_id: context.tenantId,
      product_id: context.productId,
      name: groupName,
      kind,
      ui_mode: "buttons",
      source: "product",
      sort_order: sortOrder,
      enabled: true,
    })
    .select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)")
    .single();

  if (error) throw error;

  const normalized = {
    ...inserted,
    values: inserted.values || [],
  };
  context.groups.push(normalized);
  return normalized;
}

async function ensureValue(client, context, group, config, kind) {
  const valueName = config.value_name.trim();

  let existing = (group.values || []).find(
    (value) => String(value.name || "").toLowerCase() === valueName.toLowerCase()
  );

  const widthMm = kind === "format" ? config.width_mm ?? null : null;
  const heightMm = kind === "format" ? config.height_mm ?? null : null;
  const meta = withImageMeta(existing?.meta || null, config.image_url || null);

  if (!existing) {
    const { data: inserted, error } = await client
      .from("product_attribute_values")
      .insert({
        tenant_id: context.tenantId,
        product_id: context.productId,
        group_id: group.id,
        name: valueName,
        sort_order: (group.values || []).length,
        enabled: true,
        width_mm: widthMm,
        height_mm: heightMm,
        meta,
      })
      .select("id, name, width_mm, height_mm, meta")
      .single();

    if (error) throw error;

    group.values = [...(group.values || []), inserted];
    return inserted;
  }

  const updatePayload = {};
  if (kind === "format") {
    if (widthMm && Number(existing.width_mm || 0) !== widthMm) updatePayload.width_mm = widthMm;
    if (heightMm && Number(existing.height_mm || 0) !== heightMm) updatePayload.height_mm = heightMm;
  }

  if (meta) {
    const currentImage =
      existing.meta && typeof existing.meta === "object" && !Array.isArray(existing.meta)
        ? existing.meta.image
        : undefined;

    if (meta.image && currentImage !== meta.image) {
      updatePayload.meta = meta;
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const { data: updated, error } = await client
      .from("product_attribute_values")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("id, name, width_mm, height_mm, meta")
      .single();

    if (error) throw error;

    group.values = (group.values || []).map((value) =>
      value.id === updated.id ? updated : value
    );
    existing = updated;
  }

  return existing;
}

export async function importBlueprintPricing({ blueprint, transformedRows, dryRun }) {
  const quantities = transformedRows.map((row) => row.quantity).sort((a, b) => a - b);

  if (dryRun) {
    return {
      dryRun: true,
      productSlug: blueprint.product.slug,
      tenantId: blueprint.tenant_id,
      rowsPrepared: transformedRows.length,
      quantities,
    };
  }

  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const ensuredProduct = await ensureProduct(client, blueprint);

  const context = {
    tenantId: blueprint.tenant_id,
    productId: ensuredProduct.product.id,
    groups: await loadGroups(client, blueprint.tenant_id, ensuredProduct.product.id),
  };

  const formatGroup = await ensureGroup(
    client,
    context,
    "format",
    blueprint.matrix.format.group_name,
    0
  );
  const materialGroup = await ensureGroup(
    client,
    context,
    "material",
    blueprint.matrix.material.group_name,
    1
  );

  const formatValue = await ensureValue(client, context, formatGroup, blueprint.matrix.format, "format");
  const materialValue = await ensureValue(client, context, materialGroup, blueprint.matrix.material, "material");

  const refs = {
    product: ensuredProduct.product,
    formatGroup,
    materialGroup,
    formatValue,
    materialValue,
  };

  const pricingStructure = buildPricingStructure(blueprint, refs, quantities);
  const priceRows = buildPriceRows(blueprint, refs, transformedRows);

  const { error: productUpdateError } = await client
    .from("products")
    .update({
      pricing_type: "matrix",
      pricing_structure: pricingStructure,
    })
    .eq("id", refs.product.id);

  if (productUpdateError) throw productUpdateError;

  const { error: deleteError } = await client
    .from("generic_product_prices")
    .delete()
    .eq("product_id", refs.product.id);

  if (deleteError) throw deleteError;

  if (priceRows.length > 0) {
    const { error: insertError } = await client
      .from("generic_product_prices")
      .insert(priceRows);

    if (insertError) throw insertError;
  }

  return {
    dryRun: false,
    productId: refs.product.id,
    productSlug: refs.product.slug,
    productCreated: ensuredProduct.created,
    rowsInserted: priceRows.length,
    quantities,
  };
}
