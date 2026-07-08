import { createClient } from "@supabase/supabase-js";
import { createNormalizedMatrixRecord } from "./shared/normalized-pricing.js";
import { publishNormalizedMatrixProduct } from "./shared/matrix-publisher.js";

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

function buildValueSpec(config, kind) {
  return {
    name: config.value_name,
    widthMm: kind === "format" ? config.width_mm ?? null : null,
    heightMm: kind === "format" ? config.height_mm ?? null : null,
    meta: withImageMeta(null, config.image_url || null),
  };
}

function buildMatrixPublishConfig(blueprint) {
  const formatValue = buildValueSpec(blueprint.matrix.format, "format");
  const materialValue = buildValueSpec(blueprint.matrix.material, "material");

  const verticalAxis =
    blueprint.matrix.vertical_axis === "materials"
      ? {
          key: "material",
          groupName: blueprint.matrix.material.group_name,
          kind: "material",
          sectionType: "materials",
          sortOrder: 1,
          sectionId: "vertical-axis",
          uiMode: "buttons",
          title: "Materiale",
          description: "",
          selectionMapKey: "material",
          extraDataIdField: "materialId",
          valueSpecs: [materialValue],
          includeInSelectionMap: true,
        }
      : {
          key: "format",
          groupName: blueprint.matrix.format.group_name,
          kind: "format",
          sectionType: "formats",
          sortOrder: 0,
          sectionId: "vertical-axis",
          uiMode: "buttons",
          title: "Format",
          description: "",
          selectionMapKey: "format",
          extraDataIdField: "formatId",
          valueSpecs: [formatValue],
          includeInSelectionMap: true,
          requireDimensions: true,
        };

  const selector =
    blueprint.matrix.vertical_axis === "materials"
      ? {
          key: "format",
          rowId: "row-1",
          sectionId: "selector-section",
          groupName: blueprint.matrix.format.group_name,
          kind: "format",
          sectionType: "formats",
          sortOrder: 0,
          uiMode: "buttons",
          selectionMode: "required",
          title: "Format",
          description: "",
          selectionMapKey: "format",
          extraDataIdField: "formatId",
          valueSpecs: [formatValue],
          requireDimensions: true,
        }
      : {
          key: "material",
          rowId: "row-1",
          sectionId: "selector-section",
          groupName: blueprint.matrix.material.group_name,
          kind: "material",
          sectionType: "materials",
          sortOrder: 1,
          uiMode: "buttons",
          selectionMode: "required",
          title: "Materiale",
          description: "",
          selectionMapKey: "material",
          extraDataIdField: "materialId",
          valueSpecs: [materialValue],
        };

  return {
    verticalAxis,
    sections: [selector],
  };
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

export async function importBlueprintPricing({ blueprint, transformedRows, dryRun }) {
  const quantities = transformedRows.map((row) => row.quantity).sort((a, b) => a - b);
  const matrixConfig = buildMatrixPublishConfig(blueprint);
  const verticalKey = matrixConfig.verticalAxis.key;
  const selectorKey = matrixConfig.sections[0].key;
  const verticalValueName = matrixConfig.verticalAxis.valueSpecs[0].name;
  const selectorValueName = matrixConfig.sections[0].valueSpecs[0].name;
  const normalizedRows = transformedRows.map((row) =>
    createNormalizedMatrixRecord({
      supplier: "wir-machen-druck",
      sourceType: "blueprint_ul",
      importerKey: "blueprint_ul_prices",
      productFamily: blueprint.product?.category || "tryksager",
      sourceUrl: blueprint.source?.url || blueprint.url || null,
      supplierProductType: blueprint.product?.name || blueprint.product?.slug || null,
      quantity: row.quantity,
      supplierCurrency: "EUR",
      supplierPrice: row.eur,
      convertedPriceDkk: row.dkk_base,
      finalPriceDkk: row.dkk_final,
      selections: {
        [verticalKey]: verticalValueName,
        [selectorKey]: selectorValueName,
      },
      extraData: {
        source: "blueprint_ul_prices",
        sourceIndex: row.source_index,
        sourceLiText: row.li_text,
        eur: row.eur,
        dkkBase: row.dkk_base,
        tierMultiplier: row.tier_multiplier,
      },
      rawPayload: {
        source_index: row.source_index,
        li_text: row.li_text,
      },
    })
  );

  if (dryRun) {
    return {
      dryRun: true,
      productSlug: blueprint.product.slug,
      tenantId: blueprint.tenant_id,
      rowsPrepared: normalizedRows.length,
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
  const result = await publishNormalizedMatrixProduct({
    client,
    tenantId: blueprint.tenant_id,
    productId: ensuredProduct.product.id,
    matrixConfig,
    normalizedRows,
    productUpdate: {},
  });

  return {
    dryRun: false,
    productId: ensuredProduct.product.id,
    productSlug: ensuredProduct.product.slug,
    productCreated: ensuredProduct.created,
    rowsInserted: result.rowsInserted,
    quantities: result.quantities,
  };
}
