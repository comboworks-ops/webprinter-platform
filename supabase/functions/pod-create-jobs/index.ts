// POD Create Jobs for Order
// Scans order items for POD-linked products and creates fulfillment jobs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

        const { orderId } = await req.json();
        if (!orderId) {
            return new Response(JSON.stringify({ error: "orderId required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Get order and items
        const { data: order, error: orderError } = await serviceClient
            .from("orders")
            .select(`
        id,
        tenant_id,
        order_items (
          id,
          product_id,
          quantity,
          unit_price,
          options
        )
      `)
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: "Order not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Verify user has access to this tenant
        const { data: roleData } = await supabaseClient
            .from("user_roles")
            .select("tenant_id")
            .eq("user_id", user.id)
            .eq("tenant_id", order.tenant_id)
            .in("role", ["admin", "staff"])
            .single();

        if (!roleData) {
            return new Response(JSON.stringify({ error: "Access denied" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const orderItems = order.order_items || [];
        const createdJobs: any[] = [];

        for (const item of orderItems) {
            // Check if this product is a POD import
            const { data: podImport } = await serviceClient
                .from("pod_tenant_imports")
                .select(`
          id,
          catalog_product_id,
          pod_catalog_products:catalog_product_id (
            id
          )
        `)
                .eq("product_id", item.product_id)
                .eq("tenant_id", order.tenant_id)
                .single();

            if (!podImport) continue; // Not a POD product

            // Check if job already exists for this order item
            const { data: existingJob } = await serviceClient
                .from("pod_fulfillment_jobs")
                .select("id")
                .eq("order_item_id", item.id)
                .single();

            if (existingJob) continue; // Job already exists

            // Get catalog pricing to calculate tenant cost
            const options = item.options || {};
            const variantSignature = Object.entries(options)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}:${v}`)
                .join("|") || "default";
            const variantSignatureLegacy = Object.entries(options)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}=${v}`)
                .join("|") || "default";

            let priceMatrix: { quantities: number[]; base_costs: number[] } | null = null;
            const { data: matrixPrimary } = await serviceClient
                .from("pod_catalog_price_matrix")
                .select("quantities, base_costs")
                .eq("catalog_product_id", podImport.catalog_product_id)
                .eq("variant_signature", variantSignature)
                .single();

            if (matrixPrimary) {
                priceMatrix = matrixPrimary as any;
            } else if (variantSignatureLegacy !== variantSignature) {
                const { data: matrixLegacy } = await serviceClient
                    .from("pod_catalog_price_matrix")
                    .select("quantities, base_costs")
                    .eq("catalog_product_id", podImport.catalog_product_id)
                    .eq("variant_signature", variantSignatureLegacy)
                    .single();
                if (matrixLegacy) {
                    priceMatrix = matrixLegacy as any;
                }
            }

            let tenantCost = 0;
            if (priceMatrix) {
                const qty = item.quantity;
                const quantities = priceMatrix.quantities || [];
                const baseCosts = priceMatrix.base_costs || [];

                // Find appropriate tier
                for (let i = quantities.length - 1; i >= 0; i--) {
                    if (qty >= quantities[i]) {
                        tenantCost = baseCosts[i] || 0;
                        break;
                    }
                }
                // If qty is below all tiers, use first tier
                if (tenantCost === 0 && baseCosts.length > 0) {
                    tenantCost = baseCosts[0];
                }
            }

            // Create fulfillment job
            const { data: job, error: jobError } = await serviceClient
                .from("pod_fulfillment_jobs")
                .insert({
                    tenant_id: order.tenant_id,
                    order_id: orderId,
                    order_item_id: item.id,
                    catalog_product_id: podImport.catalog_product_id,
                    variant_signature: variantSignature,
                    qty: item.quantity,
                    tenant_cost: tenantCost,
                    currency: "DKK",
                    status: "awaiting_approval",
                })
                .select()
                .single();

            if (!jobError && job) {
                createdJobs.push(job);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            jobsCreated: createdJobs.length,
            jobs: createdJobs,
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("POD Create Jobs error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
