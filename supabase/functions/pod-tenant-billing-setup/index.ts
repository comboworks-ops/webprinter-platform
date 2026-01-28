// POD Tenant Billing - Setup Intent for off-session charging
// Creates Stripe SetupIntent for tenant to save payment method

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
            apiVersion: "2023-10-16",
        });

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

        // Get tenant ID for this user
        const { data: roleData } = await supabaseClient
            .from("user_roles")
            .select("tenant_id")
            .eq("user_id", user.id)
            .in("role", ["admin", "staff"])
            .single();

        if (!roleData?.tenant_id) {
            return new Response(JSON.stringify({ error: "No tenant found" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const tenantId = roleData.tenant_id;
        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Check if tenant already has billing setup
        const { data: existingBilling } = await serviceClient
            .from("pod_tenant_billing")
            .select("stripe_customer_id")
            .eq("tenant_id", tenantId)
            .single();

        let stripeCustomerId: string;

        if (existingBilling?.stripe_customer_id) {
            stripeCustomerId = existingBilling.stripe_customer_id;
        } else {
            // Get tenant info for customer creation
            const { data: tenant } = await serviceClient
                .from("tenants")
                .select("name, subdomain")
                .eq("id", tenantId)
                .single();

            // Create Stripe customer
            const customer = await stripe.customers.create({
                metadata: {
                    tenant_id: tenantId,
                    platform: "webprinter_pod",
                },
                name: tenant?.name || `Tenant ${tenantId}`,
                description: `Webprinter POD - ${tenant?.subdomain || tenantId}`,
            });

            stripeCustomerId = customer.id;

            // Save billing record
            await serviceClient.from("pod_tenant_billing").upsert({
                tenant_id: tenantId,
                stripe_customer_id: stripeCustomerId,
                is_ready: false,
                updated_at: new Date().toISOString(),
            });
        }

        // Create SetupIntent
        const setupIntent = await stripe.setupIntents.create({
            customer: stripeCustomerId,
            payment_method_types: ["card"],
            usage: "off_session",
            metadata: {
                tenant_id: tenantId,
                purpose: "pod_fulfillment",
            },
        });

        return new Response(JSON.stringify({
            clientSecret: setupIntent.client_secret,
            customerId: stripeCustomerId,
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("POD Billing Setup error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
