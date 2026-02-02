// POD v2 Tenant Import
// Creates a normal tenant product from POD v2 catalog product

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const PRICE_CHUNK_SIZE = 500;

const resolveGroupKind = (groupKey: string) => {
    const value = groupKey.toLowerCase();
    if (value.includes("size") || value.includes("format")) return "format";
    if (value.includes("material") || value.includes("paper")) return "material";
    if (value.includes("finish") || value.includes("lamination") || value.includes("spot") || value.includes("foil")) return "finish";
    return "other";
};

const resolveSectionType = (kind: string) => {
    if (kind === "format") return "formats";
    if (kind === "material") return "materials";
    if (kind === "finish") return "finishes";
    return "products";
};

const shouldHideGroupKey = (groupKey: string) => {
    return groupKey.toLowerCase() === "sheet_size";
};

const parseVariantSignature = (signature: string) => {
    const map: Record<string, string> = {};
    if (!signature) return map;
    signature.split("|").forEach((part) => {
        const [key, value] = part.split(":");
        if (key && value) {
            map[key] = value;
        }
    });
    return map;
};

const parseDimensionsFromLabel = (label: string) => {
    if (!label) return null;
    const match = label.match(/(\\d+(?:[.,]\\d+)?)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)/i);
    if (!match) return null;
    const toNumber = (value: string) => Number(value.replace(",", "."));
    const width = toNumber(match[1]);
    const height = toNumber(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const isCm = label.toLowerCase().includes("cm");
    const factor = isCm ? 10 : 1;
    return { width_mm: width * factor, height_mm: height * factor };
};

const normalizeMatrixMapping = (raw: any, groupKeys: string[]) => {
    const rows = Array.isArray(raw?.rows)
        ? raw.rows.map((row: any, index: number) => ({
            id: String(row?.id || `row-${index + 1}`),
            title: String(row?.title || `Række ${index + 1}`),
            groupKeys: Array.isArray(row?.groupKeys)
                ? row.groupKeys.filter((key: string) => groupKeys.includes(key))
                : [],
        }))
        : [];
    const fixed = Array.isArray(raw?.fixed)
        ? raw.fixed.filter((key: string) => groupKeys.includes(key))
        : [];
    let verticalAxis = typeof raw?.verticalAxis === "string" && groupKeys.includes(raw.verticalAxis)
        ? raw.verticalAxis
        : null;

    if (!verticalAxis && groupKeys.length > 0) {
        verticalAxis = groupKeys.find((key) => key === "size" || key.includes("size") || key.includes("format"))
            || groupKeys[0];
    }

    if (rows.length === 0) {
        rows.push({ id: "row-1", title: "Række 1", groupKeys: [] });
    }

    if (verticalAxis) {
        rows.forEach((row) => {
            row.groupKeys = row.groupKeys.filter((key) => key !== verticalAxis);
        });
    }

    const cleanedFixed = verticalAxis ? fixed.filter((key) => key !== verticalAxis) : fixed;
    const used = new Set<string>([
        ...(verticalAxis ? [verticalAxis] : []),
        ...cleanedFixed,
        ...rows.flatMap((row) => row.groupKeys),
    ]);
    const missing = groupKeys.filter((key) => !used.has(key));
    if (missing.length > 0) {
        rows[0].groupKeys = [...rows[0].groupKeys, ...missing];
    }

    return {
        version: 1,
        verticalAxis,
        rows,
        fixed: cleanedFixed,
    };
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { catalogProductId, customName, customDescription, customCategory, tenantId: requestedTenantId } = await req.json();
        if (!catalogProductId) {
            return new Response(JSON.stringify({ error: "catalogProductId required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const isValidUuid = (value: unknown) =>
            typeof value === "string"
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let canAccessMaster = false;
        try {
            const { data: canAccessMasterData } = await supabaseClient.rpc("can_access_tenant", {
                _tenant_id: MASTER_TENANT_ID,
            });
            canAccessMaster = !!canAccessMasterData;
        } catch (e) {
            canAccessMaster = false;
        }

        // Get tenant IDs for this user
        const { data: roleData, error: roleError } = await serviceClient
            .from("user_roles")
            .select("tenant_id, role")
            .eq("user_id", user.id)
            .in("role", ["admin", "staff", "master_admin"]);

        const roleRows = Array.isArray(roleData) ? roleData : [];

        const hasMaster = (roleRows || []).some((row: any) => row.role === "master_admin");
        const roleTenantIds = (roleRows || [])
            .map((row: any) => row.tenant_id)
            .filter((tenantId: any) => isValidUuid(tenantId));
        let tenantId = isValidUuid(requestedTenantId) ? requestedTenantId : null;

        const { data: ownedTenant } = await serviceClient
            .from("tenants")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();
        const ownedTenantId = ownedTenant?.id || null;

        if (tenantId) {
            let canAccessRequested = false;
            try {
                const { data: canAccessTenant } = await supabaseClient.rpc("can_access_tenant", {
                    _tenant_id: tenantId,
                });
                canAccessRequested = !!canAccessTenant;
            } catch (e) {
                canAccessRequested = hasMaster || ownedTenantId === tenantId || roleTenantIds.includes(tenantId);
            }

            if (!canAccessRequested) {
                return new Response(JSON.stringify({ error: "Access denied" }), {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        } else {
            tenantId = roleTenantIds[0]
                || ownedTenantId
                || (hasMaster || canAccessMaster ? MASTER_TENANT_ID : null);
        }

        if (!tenantId) {
            const details = {
                roleError: roleError?.message || null,
                hasMaster,
                canAccessMaster,
                roleTenantIds,
                ownedTenantId,
            };
            return new Response(JSON.stringify({ error: "No tenant found", details }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (tenantId !== MASTER_TENANT_ID) {
            return new Response(JSON.stringify({ error: "POD v2 imports are restricted to the master tenant." }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Fetch catalog product (with attributes and pricing)
        const { data: catalogProduct, error: catalogError } = await serviceClient
            .from("pod2_catalog_products")
            .select(`
        id,
        public_title,
        public_description,
        public_images,
        supplier_product_data,
        pod2_catalog_attributes (
          id,
          group_key,
          group_label,
          sort_order,
          pod2_catalog_attribute_values (
            id,
            value_key,
            value_label,
            supplier_value_ref,
            is_default,
            sort_order
          )
        ),
        pod2_catalog_price_matrix (
          variant_signature,
          quantities,
          recommended_retail,
          base_costs,
          currency
        )
      `)
            .eq("id", catalogProductId)
            .eq("status", "published")
            .single();

        if (catalogError || !catalogProduct) {
            return new Response(JSON.stringify({ error: "Catalog product not found or not published" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Check if already imported
        const { data: existingImport } = await serviceClient
            .from("pod2_tenant_imports")
            .select("id, product_id")
            .eq("tenant_id", tenantId)
            .eq("catalog_product_id", catalogProductId)
            .single();

        if (existingImport) {
            return new Response(JSON.stringify({
                error: "Product already imported",
                productId: existingImport.product_id,
            }), {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const catalogAttributes = Array.isArray((catalogProduct as any).pod2_catalog_attributes)
            ? (catalogProduct as any).pod2_catalog_attributes
            : [];
        const attributeKeys = catalogAttributes.map((attr: any) => String(attr.group_key));
        const matrixMapping = normalizeMatrixMapping(
            (catalogProduct as any).supplier_product_data?.matrix_mapping,
            attributeKeys,
        );

        // Generate product slug
        const baseName = customName || (catalogProduct as any).public_title?.da || (catalogProduct as any).public_title?.en || "POD v2 Product";
        let baseSlug = baseName
            .toLowerCase()
            .replace(/[æ]/g, "ae")
            .replace(/[ø]/g, "oe")
            .replace(/[å]/g, "aa")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const reservedSlugs = new Set([
            "flyers",
            "foldere",
            "visitkort",
            "plakater",
            "klistermaerker",
            "klistermærker",
            "bannere",
            "beachflag",
            "skilte",
            "folie",
            "messeudstyr",
            "displayplakater",
            "haefter",
            "hæfter",
            "salgsmapper",
        ]);
        if (reservedSlugs.has(baseSlug)) {
            baseSlug = `pod2-${baseSlug}`;
        }

        // Ensure unique slug
        let slug = baseSlug;
        let counter = 1;
        while (true) {
            const { data: existing } = await serviceClient
                .from("products")
                .select("id")
                .eq("slug", slug)
                .eq("tenant_id", tenantId)
                .single();

            if (!existing) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Create normal product
        const defaultVariant = (catalogProduct as any).pod2_catalog_price_matrix?.[0]?.variant_signature || null;
        const defaultQuantity = (catalogProduct as any).pod2_catalog_price_matrix?.[0]?.quantities?.[0] || null;

        const pricingTypeRaw = String((catalogProduct as any).supplier_product_data?.pricing_type || "matrix").toLowerCase();
        const selectedCategory = customCategory || "tryksager";
        const normalizedCategory = selectedCategory.toLowerCase();
        const shouldUseStorformat = customCategory
            ? normalizedCategory === "storformat"
            : pricingTypeRaw === "storformat";
        const pricingType = shouldUseStorformat ? "STORFORMAT" : "matrix";

        const { data: newProduct, error: productError } = await serviceClient
            .from("products")
            .insert({
                tenant_id: tenantId,
                name: customName || (catalogProduct as any).public_title?.da || "POD v2 Produkt",
                description: customDescription || (catalogProduct as any).public_description?.da || "",
                slug: slug,
                category: selectedCategory,
                is_published: false,
                pricing_type: pricingType,
                default_variant: defaultVariant,
                default_quantity: defaultQuantity,
                image_url: (catalogProduct as any).public_images?.[0] || null,
                banner_config: {
                    config_section_choice: shouldUseStorformat ? "storformat" : "format",
                },
                technical_specs: {
                    is_pod_v2: true,
                    pod2_catalog_id: catalogProductId,
                },
            })
            .select()
            .single();

        if (productError || !newProduct) {
            console.error("Product creation error:", productError);
            return new Response(JSON.stringify({ error: "Failed to create product", details: productError?.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const groupIdByKey: Record<string, string> = {};
        const valueIdByGroupKey: Record<string, Record<string, string>> = {};
        const valueIdsByGroupKey: Record<string, string[]> = {};
        const groupKindByKey: Record<string, string> = {};

        let sortCounter = 0;
        const sortOrderByKey = new Map<string, number>();
        if (matrixMapping.verticalAxis) {
            sortOrderByKey.set(matrixMapping.verticalAxis, sortCounter++);
        }
        for (const row of matrixMapping.rows) {
            for (const key of row.groupKeys) {
                if (!sortOrderByKey.has(key)) {
                    sortOrderByKey.set(key, sortCounter++);
                }
            }
        }
        for (const key of matrixMapping.fixed || []) {
            if (!sortOrderByKey.has(key)) {
                sortOrderByKey.set(key, sortCounter++);
            }
        }

        for (const attr of catalogAttributes) {
            const groupKey = String(attr.group_key);
            const kind = resolveGroupKind(groupKey);
            groupKindByKey[groupKey] = kind;
            const groupLabel = attr.group_label?.da || attr.group_label?.en || groupKey;
            const sortOrder = sortOrderByKey.has(groupKey) ? sortOrderByKey.get(groupKey)! : (attr.sort_order || 0);

            const { data: groupRow, error: groupError } = await serviceClient
                .from("product_attribute_groups")
                .insert({
                    tenant_id: tenantId,
                    product_id: newProduct.id,
                    name: groupLabel,
                    kind,
                    ui_mode: "buttons",
                    source: "product",
                    sort_order: sortOrder,
                    enabled: true,
                })
                .select("id")
                .single();

            if (groupError || !groupRow?.id) {
                console.error("Attribute group creation error:", groupError);
                continue;
            }

            groupIdByKey[groupKey] = groupRow.id;

            const values = Array.isArray(attr.pod2_catalog_attribute_values)
                ? attr.pod2_catalog_attribute_values
                : [];
            const payload = values.map((val: any, index: number) => {
                const label = val.value_label?.da || val.value_label?.en || val.value_key;
                const dimensions = kind === "format" ? parseDimensionsFromLabel(label || "") : null;
                return {
                    tenant_id: tenantId,
                    product_id: newProduct.id,
                    group_id: groupRow.id,
                    name: label,
                    key: String(val.value_key),
                    sort_order: val.sort_order ?? index,
                    enabled: true,
                    width_mm: dimensions?.width_mm,
                    height_mm: dimensions?.height_mm,
                    meta: val.supplier_value_ref ? { supplier_value_ref: val.supplier_value_ref } : undefined,
                };
            });

            if (payload.length > 0) {
                const { data: insertedValues, error: valueError } = await serviceClient
                    .from("product_attribute_values")
                    .insert(payload)
                    .select("id, key");

                if (valueError) {
                    console.error("Attribute value creation error:", valueError);
                } else {
                    const valueMap: Record<string, string> = {};
                    for (const row of insertedValues || []) {
                        if (row?.key) {
                            valueMap[String(row.key)] = row.id;
                        }
                    }
                    valueIdByGroupKey[groupKey] = valueMap;
                    valueIdsByGroupKey[groupKey] = payload
                        .map((item) => valueMap[String(item.key)])
                        .filter((value) => value);
                }
            }
        }

        const verticalAxisKey = matrixMapping.verticalAxis;
        const verticalAxisGroupId = verticalAxisKey ? groupIdByKey[verticalAxisKey] : null;
        const verticalAxisValueIds = verticalAxisKey ? (valueIdsByGroupKey[verticalAxisKey] || []) : [];
        const layoutRows = matrixMapping.rows
            .map((row, rowIndex) => ({
                id: row.id,
                title: row.title || `Række ${rowIndex + 1}`,
                columns: row.groupKeys
                    .filter((key) => groupIdByKey[key])
                    .map((key) => ({
                        id: `${row.id}-${key}`,
                        sectionType: resolveSectionType(groupKindByKey[key] || resolveGroupKind(key)),
                        groupId: groupIdByKey[key],
                        valueIds: valueIdsByGroupKey[key] || [],
                        ui_mode: shouldHideGroupKey(key) ? "hidden" : "buttons",
                        selection_mode: "required",
                    })),
            }))
            .filter((row) => row.columns.length > 0);

        const preferredQuantities = Array.isArray((catalogProduct as any).supplier_product_data?.matrix_quantities)
            ? (catalogProduct as any).supplier_product_data.matrix_quantities
                .filter((value: any) => typeof value === "number" && Number.isFinite(value))
            : [];
        const selectedQuantities = preferredQuantities.length > 0
            ? preferredQuantities
            : ((catalogProduct as any).pod2_catalog_price_matrix?.[0]?.quantities || []);

        if (verticalAxisGroupId && pricingType !== "STORFORMAT") {
            const quantities = selectedQuantities;
            const pricingStructure = {
                mode: "matrix_layout_v1",
                version: 1,
                vertical_axis: {
                    sectionId: `vertical-${verticalAxisKey}`,
                    sectionType: resolveSectionType(groupKindByKey[verticalAxisKey || ""] || resolveGroupKind(verticalAxisKey || "")),
                    groupId: verticalAxisGroupId,
                    valueIds: verticalAxisValueIds,
                },
                layout_rows: layoutRows,
                quantities,
            };

            await serviceClient
                .from("products")
                .update({ pricing_structure: pricingStructure, pricing_type: "matrix" })
                .eq("id", newProduct.id);
        }

        // Create option groups from catalog attributes
        const attributes = catalogAttributes;
        for (const attr of attributes) {
            const groupName = `pod2_${newProduct.id}_${attr.group_key}`;
            let groupId: string | null = null;

            const { data: existingGroup } = await serviceClient
                .from("product_option_groups")
                .select("id")
                .eq("name", groupName)
                .maybeSingle();

            if (existingGroup?.id) {
                groupId = existingGroup.id;
            } else {
                const { data: group, error: groupError } = await serviceClient
                    .from("product_option_groups")
                    .insert({
                        tenant_id: tenantId,
                        name: groupName,
                        label: attr.group_label?.da || attr.group_key,
                        display_type: "buttons",
                    })
                    .select()
                    .single();

                if (groupError) {
                    console.error("Option group creation error:", groupError);
                }
                groupId = group?.id || null;
            }

            if (!groupId) continue;

            await serviceClient
                .from("product_option_group_assignments")
                .insert({
                    tenant_id: tenantId,
                    product_id: newProduct.id,
                    option_group_id: groupId,
                    sort_order: attr.sort_order,
                    is_required: true,
                });

            const values = attr.pod2_catalog_attribute_values || [];
            for (const val of values) {
                await serviceClient
                    .from("product_options")
                    .insert({
                        tenant_id: tenantId,
                        group_id: groupId,
                        name: val.value_key,
                        label: val.value_label?.da || val.value_key,
                        extra_price: 0,
                        price_mode: "fixed",
                        sort_order: val.sort_order,
                    });
            }
        }

        // Create pricing matrix from catalog pricing (chunked for stability)
        const priceMatrix = (catalogProduct as any).pod2_catalog_price_matrix || [];
        const visibleGroupKeys = matrixMapping.rows.flatMap((row) => row.groupKeys);
        const formatGroupKey = attributeKeys.find((key) => groupKindByKey[key] === "format") || null;
        const materialGroupKey = attributeKeys.find((key) => groupKindByKey[key] === "material") || null;

        let priceRows: Array<{
            tenant_id: string;
            product_id: string;
            variant_name: string;
            variant_value: string;
            quantity: number;
            price_dkk: number;
            extra_data: Record<string, any>;
        }> = [];
        let totalInserted = 0;

        const flushPrices = async () => {
            if (priceRows.length === 0) return;
            const { error: priceError } = await serviceClient
                .from("generic_product_prices")
                .upsert(priceRows, { onConflict: "product_id,variant_name,variant_value,quantity" });

            if (priceError) {
                console.error("Price insert error:", priceError);
                throw new Error(priceError.message);
            }
            totalInserted += priceRows.length;
            priceRows = [];
        };

        const allowedQuantities = new Set<number>(
            (selectedQuantities || []).filter((value: any) => typeof value === "number" && Number.isFinite(value))
        );

        for (const matrix of priceMatrix) {
            const quantities = matrix.quantities || [];
            const filteredQuantities = allowedQuantities.size > 0
                ? quantities.filter((qty: number) => allowedQuantities.has(qty))
                : quantities;
            const prices = (matrix.recommended_retail && matrix.recommended_retail.length > 0)
                ? matrix.recommended_retail
                : (matrix.base_costs || []);
            const priceMap = new Map<number, number>();
            for (let i = 0; i < quantities.length; i++) {
                const qty = Number(quantities[i]);
                const rawPrice = prices[i];
                const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
                if (Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price > 0) {
                    priceMap.set(qty, price);
                }
            }
            const signatureMap = parseVariantSignature(matrix.variant_signature || "");
            const verticalValueKey = matrixMapping.verticalAxis ? signatureMap[matrixMapping.verticalAxis] : null;
            const verticalValueId = matrixMapping.verticalAxis && verticalValueKey
                ? valueIdByGroupKey[matrixMapping.verticalAxis]?.[String(verticalValueKey)] || null
                : null;

            const variantValueIds = visibleGroupKeys
                .map((key) => {
                    const valueKey = signatureMap[key];
                    return valueIdByGroupKey[key]?.[String(valueKey)];
                })
                .filter((value) => value);

            const variantName = variantValueIds.length > 0
                ? variantValueIds.slice().sort().join("|")
                : "none";
            const variantValue = verticalValueId || (verticalValueKey ? String(verticalValueKey) : matrix.variant_signature);

            const selectionMap: Record<string, string> = {};
            for (const key of attributeKeys) {
                const valueKey = signatureMap[key];
                const valueId = valueIdByGroupKey[key]?.[String(valueKey)];
                if (valueId) {
                    selectionMap[key] = valueId;
                }
            }

            const formatId = formatGroupKey
                ? valueIdByGroupKey[formatGroupKey]?.[String(signatureMap[formatGroupKey] || "")]
                : null;
            const materialId = materialGroupKey
                ? valueIdByGroupKey[materialGroupKey]?.[String(signatureMap[materialGroupKey] || "")]
                : null;

            if (formatId) selectionMap.format = formatId;
            if (materialId) selectionMap.material = materialId;

            const extraData = {
                verticalAxisGroupId: verticalAxisGroupId,
                verticalAxisValueId: verticalValueId,
                formatId,
                materialId,
                variantValueIds,
                selectionMap,
            };

            for (let i = 0; i < filteredQuantities.length; i++) {
                const qty = Number(filteredQuantities[i]);
                const price = priceMap.get(qty);
                if (!Number.isFinite(qty) || qty <= 0) continue;
                if (!Number.isFinite(price) || price <= 0) continue;

                priceRows.push({
                    tenant_id: tenantId,
                    product_id: newProduct.id,
                    variant_name: variantName,
                    variant_value: variantValue,
                    quantity: qty,
                    price_dkk: price,
                    extra_data: extraData,
                });

                if (priceRows.length >= PRICE_CHUNK_SIZE) {
                    await flushPrices();
                }
            }
        }

        try {
            await flushPrices();
        } catch (priceError) {
            return new Response(JSON.stringify({ error: "Failed to insert prices", details: priceError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Create import record
        await serviceClient
            .from("pod2_tenant_imports")
            .insert({
                tenant_id: tenantId,
                catalog_product_id: catalogProductId,
                product_id: newProduct.id,
                variant_mapping: {},
            });

        return new Response(JSON.stringify({
            success: true,
            productId: newProduct.id,
            slug: newProduct.slug,
            pricesInserted: totalInserted,
            message: "POD v2 product imported successfully",
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("POD2 Import error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
