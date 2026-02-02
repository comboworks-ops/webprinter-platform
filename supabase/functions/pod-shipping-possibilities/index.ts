// POD Shipping Possibilities - Fetch delivery options from Print.com
// Uses stored supplier connection credentials to avoid exposing API keys.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedBaseUrls = new Set([
    "https://api.print.com",
    "https://api.stg.print.com",
    "https://platform.print.com",
]);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const {
            productId,
            quantity,
            variantKey,
            verticalValueId,
            selectionMap,
            address,
            dateFrom,
            numberOfDays,
            respectUrgency,
            respectDeliveryPromise,
            deliveryPromise,
        } = body || {};

        const qty = Number(quantity);
        if (!productId || !Number.isFinite(qty) || qty <= 0 || !address?.country) {
            return new Response(JSON.stringify({ error: "Missing productId, quantity, or address.country" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const serviceClient = createClient(supabaseUrl, serviceKey);

        const { data: product } = await serviceClient
            .from("products")
            .select("id, technical_specs")
            .eq("id", productId)
            .maybeSingle();

        if (!product?.technical_specs?.is_pod) {
            return new Response(JSON.stringify({ error: "Product is not marked as POD." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: podImport } = await serviceClient
            .from("pod_tenant_imports")
            .select("catalog_product_id")
            .eq("product_id", productId)
            .maybeSingle();

        if (!podImport?.catalog_product_id) {
            return new Response(JSON.stringify({ error: "No POD catalog mapping found." }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: catalogProduct } = await serviceClient
            .from("pod_catalog_products")
            .select("supplier_product_ref")
            .eq("id", podImport.catalog_product_id)
            .maybeSingle();

        if (!catalogProduct?.supplier_product_ref) {
            return new Response(JSON.stringify({ error: "Missing supplier SKU for POD product." }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        let resolvedSelectionMap = selectionMap as Record<string, string> | undefined;
        if (!resolvedSelectionMap) {
            let priceQuery = serviceClient
                .from("generic_product_prices")
                .select("extra_data")
                .eq("product_id", productId)
                .eq("quantity", qty);

            if (variantKey) {
                priceQuery = priceQuery.eq("variant_name", variantKey);
            }
            if (verticalValueId) {
                priceQuery = priceQuery.eq("variant_value", verticalValueId);
            }

            const { data: priceRow } = await priceQuery.maybeSingle();
            resolvedSelectionMap = priceRow?.extra_data?.selectionMap || undefined;
        }

        if (!resolvedSelectionMap) {
            return new Response(JSON.stringify({ error: "Could not resolve POD selection map." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const selectionEntries = Object.entries(resolvedSelectionMap)
            .filter(([key, value]) => !!value)
            // Exclude the internal format alias; Print.com expects "size" or other group keys.
            .filter(([key]) => key !== "format");
        const valueIds = selectionEntries.map(([, valueId]) => String(valueId));

        let valueRows: Array<{ id: string; key?: string; meta?: any }> = [];
        if (valueIds.length > 0) {
            const { data } = await serviceClient
                .from("product_attribute_values")
                .select("id, key, meta")
                .in("id", valueIds);
            valueRows = data || [];
        }

        const valueById = new Map(valueRows.map((row) => [row.id, row]));
        const resolveValue = (row?: { key?: string; meta?: any }) => {
            if (!row) return undefined;
            let meta = row.meta;
            if (typeof meta === "string") {
                try {
                    meta = JSON.parse(meta);
                } catch {
                    meta = null;
                }
            }
            const ref = meta?.supplier_value_ref ?? meta;
            if (typeof ref === "string" || typeof ref === "number") return ref;
            if (ref?.slug) return ref.slug;
            if (ref?.value) return ref.value;
            return row.key;
        };

        const options: Record<string, any> = {};
        for (const [groupKey, valueId] of selectionEntries) {
            const row = valueById.get(String(valueId));
            const resolved = resolveValue(row);
            if (resolved !== undefined && resolved !== null && resolved !== "") {
                options[groupKey] = resolved;
            }
        }

        options.copies = qty;
        if (!options.urgency) {
            options.urgency = "standard";
        }

        const { data: connection } = await serviceClient
            .from("pod_supplier_connections")
            .select("*")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (!connection?.base_url || !connection?.api_key_encrypted) {
            return new Response(JSON.stringify({ error: "No active supplier connection found." }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const baseUrl = allowedBaseUrls.has(connection.base_url)
            ? connection.base_url
            : "https://api.print.com";

        const apiKey = connection.api_key_encrypted;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        switch (connection.auth_header_mode) {
            case "authorization_bearer":
                headers["Authorization"] = `Bearer ${apiKey}`;
                break;
            case "x_api_key":
                headers["X-API-Key"] = apiKey;
                break;
            case "custom":
                if (connection.auth_header_name) {
                    const prefix = connection.auth_header_prefix || "";
                    headers[connection.auth_header_name] = prefix ? `${prefix} ${apiKey}` : apiKey;
                }
                break;
            default:
                headers["Authorization"] = `PrintApiKey ${apiKey}`;
        }

        const requestBody: Record<string, any> = {
            item: {
                sku: catalogProduct.supplier_product_ref,
                options,
            },
            address: {
                country: address.country,
                postcode: address.postcode,
                vatNr: address.vatNr,
            },
            dateFrom,
            numberOfDays,
            respectUrgency,
            respectDeliveryPromise,
        };

        if (typeof deliveryPromise === "number") {
            requestBody.item.deliveryPromise = deliveryPromise;
        }

        const response = await fetch(new URL("/shipping/shipping-possibilities", baseUrl).toString(), {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        let responseJson: any = null;
        try {
            responseJson = responseText ? JSON.parse(responseText) : null;
        } catch {
            responseJson = null;
        }

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: "Levering kunne ikke hentes.",
                status: response.status,
                details: responseJson || responseText,
            }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const results = responseJson?.results || [];
        const optionsList = results.flatMap((group: any, groupIndex: number) =>
            (group.possibilities || []).map((possibility: any, index: number) => ({
                id: `${group.deliveryDate || possibility.deliveryDate || "date"}-${possibility.carrier || "carrier"}-${possibility.method || "method"}-${possibility.urgency || "urgency"}-${groupIndex}-${index}`,
                carrier: possibility.carrier,
                method: possibility.method,
                urgency: possibility.urgency,
                deliveryDate: possibility.deliveryDate || group.deliveryDate,
                submission: possibility.submission,
                pickupDate: possibility.pickupDate,
                price: typeof possibility.price?.cost === "number"
                    ? possibility.price.cost
                    : typeof possibility.price?.base === "number"
                        ? possibility.price.base
                        : 0,
                priceBreakdown: possibility.price,
                reliability: possibility.reliability,
                transitDuration: possibility.transitDuration,
                allowedDeliveryPromises: possibility.allowedDeliveryPromises,
            })),
        );

        return new Response(JSON.stringify({
            options: optionsList,
            raw: responseJson,
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
