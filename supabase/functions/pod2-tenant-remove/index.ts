// POD v2 Tenant Remove
// Deletes an imported POD v2 product and its related data

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

        const { importId } = await req.json();
        if (!importId) {
            return new Response(JSON.stringify({ error: "importId required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: importRow, error: importError } = await serviceClient
            .from("pod2_tenant_imports")
            .select("id, tenant_id, product_id")
            .eq("id", importId)
            .single();

        if (importError || !importRow) {
            return new Response(JSON.stringify({ error: "Import not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: canAccess } = await supabaseClient.rpc("can_access_tenant", {
            _tenant_id: importRow.tenant_id,
        });

        if (!canAccess) {
            return new Response(JSON.stringify({ error: "Access denied" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Remove product option groups created for this POD v2 product
        const groupPrefix = `pod2_${importRow.product_id}_`;
        const { data: podGroups } = await serviceClient
            .from("product_option_groups")
            .select("id")
            .like("name", `${groupPrefix}%`);

        const groupIds = (podGroups || []).map((group: any) => group.id);
        if (groupIds.length > 0) {
            await serviceClient
                .from("product_option_groups")
                .delete()
                .in("id", groupIds);
        }

        // Delete product (cascades prices + assignments)
        await serviceClient
            .from("products")
            .delete()
            .eq("id", importRow.product_id);

        // Remove import record
        await serviceClient
            .from("pod2_tenant_imports")
            .delete()
            .eq("id", importRow.id);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("POD2 Remove error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
