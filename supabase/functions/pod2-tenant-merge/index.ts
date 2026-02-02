// POD v2 Tenant Merge
// Merges multiple POD v2 imported products into a single target product by
// unioning attribute values/quantities and upserting prices.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PricingStructure = {
  mode?: string;
  version?: number;
  quantities?: number[];
  vertical_axis?: {
    groupId?: string;
    valueIds?: string[];
    sectionId?: string;
    sectionType?: string;
  } | null;
  layout_rows?: Array<{
    id?: string;
    title?: string;
    columns?: Array<{
      id?: string;
      groupId?: string;
      valueIds?: string[];
      sectionType?: string;
      ui_mode?: string;
      selection_mode?: string;
    }>;
  }>;
};

type AttributeValueRow = {
  id: string;
  key?: string | null;
  name?: string | null;
  sort_order?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  meta?: Record<string, unknown> | null;
  enabled?: boolean | null;
};

type AttributeGroupRow = {
  id: string;
  name: string;
  kind?: string | null;
  sort_order?: number | null;
  enabled?: boolean | null;
  values?: AttributeValueRow[] | null;
};

type ProductRow = {
  id: string;
  tenant_id: string;
  pricing_type?: string | null;
  pricing_structure?: PricingStructure | string | null;
  technical_specs?: Record<string, unknown> | null;
  name?: string | null;
};

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalize = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

const groupKey = (group: { kind?: string | null; name?: string | null }) =>
  `${normalize(group.kind)}::${normalize(group.name)}`;

const parsePricingStructure = (raw: ProductRow["pricing_structure"]) => {
  if (!raw) return null as PricingStructure | null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PricingStructure;
    } catch {
      return null as PricingStructure | null;
    }
  }
  return raw as PricingStructure;
};

const listStructureGroupIds = (structure: PricingStructure | null) => {
  const ids = new Set<string>();
  if (!structure) return ids;
  const verticalId = structure.vertical_axis?.groupId;
  if (verticalId && isUuid(verticalId)) ids.add(verticalId);
  for (const row of structure.layout_rows || []) {
    for (const col of row.columns || []) {
      if (col.groupId && isUuid(col.groupId)) ids.add(col.groupId);
    }
  }
  return ids;
};

const unionSortedNumbers = (values: number[]) =>
  Array.from(new Set(values.filter((v) => Number.isFinite(v) && v > 0)))
    .map((v) => Number(v))
    .sort((a, b) => a - b);

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const targetProductId = body?.targetProductId;
    const sourceProductIds: string[] = Array.isArray(body?.sourceProductIds)
      ? body.sourceProductIds.filter((id: unknown) => isUuid(id))
      : [];

    if (!isUuid(targetProductId)) {
      return new Response(JSON.stringify({ error: "targetProductId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueSourceIds = Array.from(new Set(sourceProductIds)).filter(
      (id) => id !== targetProductId,
    );

    if (uniqueSourceIds.length === 0) {
      return new Response(JSON.stringify({ error: "sourceProductIds required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProduct, error: targetError } = await serviceClient
      .from("products")
      .select("id, tenant_id, pricing_type, pricing_structure, technical_specs, name")
      .eq("id", targetProductId)
      .maybeSingle();

    if (targetError || !targetProduct?.id) {
      return new Response(JSON.stringify({ error: "Target product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = (targetProduct as ProductRow).tenant_id;
    if (!tenantId || !isUuid(tenantId)) {
      return new Response(JSON.stringify({ error: "Target tenant missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Access check: user must be able to access target tenant.
    let canAccessTenant = false;
    try {
      const { data: access } = await userClient.rpc("can_access_tenant", {
        _tenant_id: tenantId,
      });
      canAccessTenant = !!access;
    } catch {
      canAccessTenant = false;
    }

    if (!canAccessTenant) {
      const { data: roleRows } = await serviceClient
        .from("user_roles")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .in("role", ["admin", "staff", "master_admin"]);
      const validRoleRows = Array.isArray(roleRows) ? roleRows : [];
      const hasTenantRole = validRoleRows.some((row: any) => row.tenant_id === tenantId);
      const isMasterAdmin = validRoleRows.some((row: any) => row.role === "master_admin");
      canAccessTenant = hasTenantRole || isMasterAdmin;
    }

    if (!canAccessTenant) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetStructure = parsePricingStructure((targetProduct as ProductRow).pricing_structure);
    if (!targetStructure || targetStructure.mode !== "matrix_layout_v1") {
      return new Response(
        JSON.stringify({ error: "Target must use matrix_layout_v1" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const structureGroupIds = listStructureGroupIds(targetStructure);

    const { data: targetGroupsData, error: targetGroupsError } = await serviceClient
      .from("product_attribute_groups")
      .select(
        "id, name, kind, sort_order, enabled, values:product_attribute_values(id, key, name, sort_order, width_mm, height_mm, meta, enabled)",
      )
      .eq("tenant_id", tenantId)
      .eq("product_id", targetProductId);

    if (targetGroupsError) {
      return new Response(JSON.stringify({ error: targetGroupsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetGroups = (targetGroupsData || []) as AttributeGroupRow[];
    const targetGroupsByComposite = new Map<string, AttributeGroupRow>();
    const targetGroupById = new Map<string, AttributeGroupRow>();
    const targetValueByGroupIdKey = new Map<string, Map<string, AttributeValueRow>>();
    const targetValueByGroupIdName = new Map<string, Map<string, AttributeValueRow>>();
    const maxSortOrderByGroupId = new Map<string, number>();

    let maxGroupSortOrder = 0;
    for (const group of targetGroups) {
      targetGroupsByComposite.set(groupKey(group), group);
      targetGroupById.set(group.id, group);
      maxGroupSortOrder = Math.max(maxGroupSortOrder, Number(group.sort_order || 0));

      const keyMap = new Map<string, AttributeValueRow>();
      const nameMap = new Map<string, AttributeValueRow>();
      let maxValueSort = 0;
      for (const value of group.values || []) {
        if (value.key) keyMap.set(normalize(value.key), value);
        if (value.name) nameMap.set(normalize(value.name), value);
        maxValueSort = Math.max(maxValueSort, Number(value.sort_order || 0));
      }
      targetValueByGroupIdKey.set(group.id, keyMap);
      targetValueByGroupIdName.set(group.id, nameMap);
      maxSortOrderByGroupId.set(group.id, maxValueSort);
    }

    const targetVerticalGroup = targetStructure.vertical_axis?.groupId
      ? targetGroupById.get(targetStructure.vertical_axis.groupId)
      : null;

    const missingGroups: Array<{ productId: string; groups: string[] }> = [];

    // First pass: validate sources are compatible with target structure.
    const sourceProducts: ProductRow[] = [];
    for (const sourceId of uniqueSourceIds) {
      const { data: sourceProduct, error: sourceError } = await serviceClient
        .from("products")
        .select("id, tenant_id, pricing_type, pricing_structure, technical_specs, name")
        .eq("id", sourceId)
        .maybeSingle();

      if (sourceError || !sourceProduct?.id) {
        return new Response(JSON.stringify({ error: `Source not found: ${sourceId}` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sourceRow = sourceProduct as ProductRow;
      if (sourceRow.tenant_id !== tenantId) {
        return new Response(JSON.stringify({ error: "All products must be in the same tenant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sourceStructure = parsePricingStructure(sourceRow.pricing_structure);
      if (!sourceStructure || sourceStructure.mode !== "matrix_layout_v1") {
        return new Response(JSON.stringify({ error: "All sources must use matrix_layout_v1" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sourceGroupsData, error: sourceGroupsError } = await serviceClient
        .from("product_attribute_groups")
        .select("id, name, kind")
        .eq("tenant_id", tenantId)
        .eq("product_id", sourceId);

      if (sourceGroupsError) {
        return new Response(JSON.stringify({ error: sourceGroupsError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sourceGroups = (sourceGroupsData || []) as Array<{ id: string; name: string; kind?: string | null }>;
      const sourceGroupById = new Map(sourceGroups.map((g) => [g.id, g]));

      const sourceStructureGroupIds = listStructureGroupIds(sourceStructure);
      const missing: string[] = [];
      for (const groupId of sourceStructureGroupIds) {
        const group = sourceGroupById.get(groupId);
        if (!group) continue;
        const composite = groupKey(group);
        if (!targetGroupsByComposite.has(composite)) {
          missing.push(`${group.kind || "other"}:${group.name}`);
        }
      }

      // Vertical axis must match in kind+name.
      if (targetVerticalGroup && sourceStructure.vertical_axis?.groupId) {
        const sourceVerticalGroup = sourceGroupById.get(sourceStructure.vertical_axis.groupId);
        if (sourceVerticalGroup) {
          const targetVerticalKey = groupKey(targetVerticalGroup);
          const sourceVerticalKey = groupKey(sourceVerticalGroup);
          if (targetVerticalKey !== sourceVerticalKey) {
            missing.push(`vertical:${sourceVerticalGroup.kind || "other"}:${sourceVerticalGroup.name}`);
          }
        }
      }

      if (missing.length > 0) {
        missingGroups.push({ productId: sourceId, groups: missing });
      }

      sourceProducts.push(sourceRow);
    }

    if (missingGroups.length > 0) {
      return new Response(JSON.stringify({ error: "Group mismatch", details: missingGroups }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Second pass: merge values and build id maps.
    const valueIdMap = new Map<string, string>();
    const groupIdMap = new Map<string, string>();
    const structureValueIdsByGroupId = new Map<string, Set<string>>();

    const ensureStructureValueSet = (groupId: string) => {
      if (!structureValueIdsByGroupId.has(groupId)) {
        structureValueIdsByGroupId.set(groupId, new Set<string>());
      }
      return structureValueIdsByGroupId.get(groupId)!;
    };

    // Seed with current structure value ids so we can safely union.
    if (targetStructure.vertical_axis?.groupId && structureGroupIds.has(targetStructure.vertical_axis.groupId)) {
      const set = ensureStructureValueSet(targetStructure.vertical_axis.groupId);
      for (const valueId of targetStructure.vertical_axis.valueIds || []) {
        if (isUuid(valueId)) set.add(valueId);
      }
    }
    for (const row of targetStructure.layout_rows || []) {
      for (const col of row.columns || []) {
        if (!col.groupId || !structureGroupIds.has(col.groupId)) continue;
        const set = ensureStructureValueSet(col.groupId);
        for (const valueId of col.valueIds || []) {
          if (isUuid(valueId)) set.add(valueId);
        }
      }
    }

    const quantities = new Set<number>(targetStructure.quantities || []);

    for (const sourceProduct of sourceProducts) {
      const sourceStructure = parsePricingStructure(sourceProduct.pricing_structure);
      for (const qty of sourceStructure?.quantities || []) {
        const parsed = Number(qty);
        if (Number.isFinite(parsed) && parsed > 0) quantities.add(parsed);
      }

      const { data: sourceGroupsData, error: sourceGroupsError } = await serviceClient
        .from("product_attribute_groups")
        .select(
          "id, name, kind, sort_order, enabled, values:product_attribute_values(id, key, name, sort_order, width_mm, height_mm, meta, enabled)",
        )
        .eq("tenant_id", tenantId)
        .eq("product_id", sourceProduct.id);

      if (sourceGroupsError) {
        return new Response(JSON.stringify({ error: sourceGroupsError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sourceGroups = (sourceGroupsData || []) as AttributeGroupRow[];

      for (const sourceGroup of sourceGroups) {
        const composite = groupKey(sourceGroup);
        let targetGroup = targetGroupsByComposite.get(composite);

        if (!targetGroup) {
          // Safe fallback: create group only if it exists in structure.
          const shouldCreate = Array.from(structureGroupIds).some((id) => {
            const group = targetGroupById.get(id);
            return group ? groupKey(group) === composite : false;
          });
          if (!shouldCreate) continue;

          maxGroupSortOrder += 1;
          const { data: insertedGroup, error: insertGroupError } = await serviceClient
            .from("product_attribute_groups")
            .insert({
              tenant_id: tenantId,
              product_id: targetProductId,
              name: sourceGroup.name,
              kind: sourceGroup.kind || "other",
              sort_order: maxGroupSortOrder,
              enabled: sourceGroup.enabled ?? true,
            })
            .select("id, name, kind, sort_order, enabled")
            .single();

          if (insertGroupError || !insertedGroup?.id) {
            return new Response(
              JSON.stringify({ error: "Failed to create missing group", details: insertGroupError?.message }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          targetGroup = { ...insertedGroup, values: [] } as AttributeGroupRow;
          targetGroupsByComposite.set(composite, targetGroup);
          targetGroupById.set(targetGroup.id, targetGroup);
          targetValueByGroupIdKey.set(targetGroup.id, new Map());
          targetValueByGroupIdName.set(targetGroup.id, new Map());
          maxSortOrderByGroupId.set(targetGroup.id, 0);
        }

        groupIdMap.set(sourceGroup.id, targetGroup.id);

        const keyMap = targetValueByGroupIdKey.get(targetGroup.id) || new Map();
        const nameMap = targetValueByGroupIdName.get(targetGroup.id) || new Map();
        let maxValueSort = maxSortOrderByGroupId.get(targetGroup.id) || 0;

        for (const sourceValue of sourceGroup.values || []) {
          const sourceKey = normalize(sourceValue.key);
          const sourceName = normalize(sourceValue.name);
          const existing =
            (sourceKey && keyMap.get(sourceKey)) ||
            (sourceName && nameMap.get(sourceName)) ||
            null;

          let targetValueId: string | null = existing?.id || null;

          if (!targetValueId) {
            maxValueSort += 1;
            const { data: insertedValue, error: insertValueError } = await serviceClient
              .from("product_attribute_values")
              .insert({
                tenant_id: tenantId,
                product_id: targetProductId,
                group_id: targetGroup.id,
                name: sourceValue.name || sourceValue.key || "Værdi",
                key: sourceValue.key || sourceValue.name || undefined,
                sort_order: sourceValue.sort_order ?? maxValueSort,
                enabled: sourceValue.enabled ?? true,
                width_mm: sourceValue.width_mm ?? undefined,
                height_mm: sourceValue.height_mm ?? undefined,
                meta: sourceValue.meta ?? undefined,
              })
              .select("id, key, name, sort_order, width_mm, height_mm, meta, enabled")
              .single();

            if (insertValueError || !insertedValue?.id) {
              return new Response(
                JSON.stringify({ error: "Failed to create value", details: insertValueError?.message }),
                {
                  status: 500,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              );
            }

            const insertedRow = insertedValue as AttributeValueRow;
            targetValueId = insertedRow.id;
            if (insertedRow.key) keyMap.set(normalize(insertedRow.key), insertedRow);
            if (insertedRow.name) nameMap.set(normalize(insertedRow.name), insertedRow);
          }

          if (targetValueId) {
            valueIdMap.set(sourceValue.id, targetValueId);
            maxSortOrderByGroupId.set(targetGroup.id, maxValueSort);

            if (structureGroupIds.has(targetGroup.id)) {
              ensureStructureValueSet(targetGroup.id).add(targetValueId);
            }
          }
        }

        targetValueByGroupIdKey.set(targetGroup.id, keyMap);
        targetValueByGroupIdName.set(targetGroup.id, nameMap);
      }
    }

    const mapValueId = (valueId: string | null | undefined) => {
      if (!valueId || !isUuid(valueId)) return null;
      return valueIdMap.get(valueId) || valueId;
    };

    const mapGroupId = (groupId: string | null | undefined) => {
      if (!groupId || !isUuid(groupId)) return null;
      return groupIdMap.get(groupId) || groupId;
    };

    const mapVariantName = (variantName: string | null | undefined) => {
      if (!variantName) return null;
      const mapped = variantName
        .split("|")
        .map((id) => mapValueId(id))
        .filter((id): id is string => !!id);
      if (mapped.length === 0) return null;
      return mapped.slice().sort().join("|");
    };

    const mapExtraData = (extra: unknown) => {
      if (!extra) return null;
      let parsed: Record<string, unknown> | null = null;
      if (typeof extra === "string") {
        try {
          parsed = JSON.parse(extra);
        } catch {
          parsed = null;
        }
      } else if (typeof extra === "object") {
        parsed = { ...(extra as Record<string, unknown>) };
      }
      if (!parsed) return null;

      const selectionMap = parsed.selectionMap as Record<string, string> | undefined;
      if (selectionMap && typeof selectionMap === "object") {
        const nextSelection: Record<string, string> = {};
        for (const [key, valueId] of Object.entries(selectionMap)) {
          const mapped = mapValueId(valueId);
          if (mapped) nextSelection[key] = mapped;
        }
        parsed.selectionMap = nextSelection;
      }

      const mappedVariantValueIds = Array.isArray(parsed.variantValueIds)
        ? (parsed.variantValueIds as string[])
            .map((id) => mapValueId(id))
            .filter((id): id is string => !!id)
        : [];
      if (mappedVariantValueIds.length > 0) {
        parsed.variantValueIds = mappedVariantValueIds;
      }

      const formatId = mapValueId(parsed.formatId as string | undefined);
      if (formatId) parsed.formatId = formatId;
      const materialId = mapValueId(parsed.materialId as string | undefined);
      if (materialId) parsed.materialId = materialId;
      const verticalAxisValueId = mapValueId(parsed.verticalAxisValueId as string | undefined);
      if (verticalAxisValueId) parsed.verticalAxisValueId = verticalAxisValueId;
      const verticalAxisGroupId = mapGroupId(parsed.verticalAxisGroupId as string | undefined);
      if (verticalAxisGroupId) parsed.verticalAxisGroupId = verticalAxisGroupId;

      return parsed;
    };

    // Merge pricing structure quantities + valueIds.
    const mergedStructure: PricingStructure = JSON.parse(JSON.stringify(targetStructure));
    mergedStructure.quantities = unionSortedNumbers(Array.from(quantities));

    if (mergedStructure.vertical_axis?.groupId) {
      const groupId = mergedStructure.vertical_axis.groupId;
      const set = structureValueIdsByGroupId.get(groupId);
      if (set && set.size > 0) {
        mergedStructure.vertical_axis.valueIds = Array.from(set);
      }
    }
    for (const row of mergedStructure.layout_rows || []) {
      for (const col of row.columns || []) {
        if (!col.groupId) continue;
        const set = structureValueIdsByGroupId.get(col.groupId);
        if (set && set.size > 0) {
          col.valueIds = Array.from(set);
        }
      }
    }

    const { error: structureUpdateError } = await serviceClient
      .from("products")
      .update({ pricing_structure: mergedStructure, pricing_type: "matrix" })
      .eq("id", targetProductId)
      .eq("tenant_id", tenantId);

    if (structureUpdateError) {
      return new Response(JSON.stringify({ error: structureUpdateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge prices.
    const { data: sourcePrices, error: sourcePricesError } = await serviceClient
      .from("generic_product_prices")
      .select("product_id, tenant_id, variant_name, variant_value, quantity, price_dkk, extra_data")
      .in("product_id", uniqueSourceIds)
      .eq("tenant_id", tenantId);

    if (sourcePricesError) {
      return new Response(JSON.stringify({ error: sourcePricesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upserts: Array<Record<string, unknown>> = [];
    let skipped = 0;

    for (const row of sourcePrices || []) {
      const mappedVariantName = mapVariantName(row.variant_name as string | undefined);
      const mappedVariantValue = mapValueId(row.variant_value as string | undefined);

      if (!mappedVariantName || !mappedVariantValue) {
        skipped += 1;
        continue;
      }

      upserts.push({
        tenant_id: tenantId,
        product_id: targetProductId,
        variant_name: mappedVariantName,
        variant_value: mappedVariantValue,
        quantity: row.quantity,
        price_dkk: row.price_dkk,
        extra_data: mapExtraData(row.extra_data),
      });
    }

    const batches = chunk(upserts, 500);
    for (const batch of batches) {
      const { error: upsertError } = await serviceClient
        .from("generic_product_prices")
        .upsert(batch, { onConflict: "product_id,variant_name,variant_value,quantity" });
      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        targetProductId,
        sourcesMerged: uniqueSourceIds.length,
        pricesProcessed: upserts.length,
        pricesSkipped: skipped,
        quantities: mergedStructure.quantities || [],
        message: "Merge completed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("POD2 merge error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
