import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const parseTaggedValue = (note: string | null | undefined, tag: string) => {
  const source = String(note || "");
  const match = source.match(new RegExp(`\\[${tag}\\]\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

const parseSenderMode = (note: string | null | undefined) => {
  const blindValue = parseTaggedValue(note, "BLIND_SHIPPING");
  if (blindValue && blindValue.toLowerCase() === "ja") return "blind" as const;
  const sender = parseTaggedValue(note, "AFSENDER");
  if (sender && sender !== "Standard WebPrinter-afsender") return "custom" as const;
  return "standard" as const;
};

const resolveTenantCost = (quantities: number[] = [], baseCosts: number[] = [], qty: number) => {
  let resolved = 0;
  for (let i = quantities.length - 1; i >= 0; i -= 1) {
    const tierQty = Number(quantities[i]);
    const tierCost = Number(baseCosts[i]);
    if (Number.isFinite(tierQty) && Number.isFinite(tierCost) && qty >= tierQty) {
      resolved = tierCost;
      break;
    }
  }
  if (!resolved && baseCosts.length > 0) {
    const fallback = Number(baseCosts[0]);
    if (Number.isFinite(fallback)) resolved = fallback;
  }
  return resolved;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .select("id, tenant_id, product_slug, product_name, quantity, customer_email, customer_name, delivery_type, delivery_address, delivery_city, delivery_zip, status_note, product_configuration")
      .eq("id", orderId)
      .maybeSingle();

    // Pull the tenant's POD v2 auto-forward flag. Self-owned tenants skip
    // the approve+charge gate so the job lands straight in master queue.
    // Defensive: if the column hasn't been migrated yet, fall back to false
    // so existing tenants keep the normal approve flow.
    let autoForward = false;
    try {
      const { data: tenantRow } = await serviceClient
        .from("tenants")
        .select("pod2_auto_forward")
        .eq("id", order?.tenant_id || "")
        .maybeSingle();
      autoForward = Boolean((tenantRow as any)?.pod2_auto_forward);
    } catch {
      autoForward = false;
    }

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Access gate: allow either
    //   (a) a tenant-scoped role on the order's tenant, OR
    //   (b) a platform-wide master_admin (tenant_id IS NULL)
    // Platform-wide admins can act on any tenant — the tenant-scoped
    // `.eq("tenant_id", ...)` alone was wrongly excluding them.
    const { data: tenantRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", order.tenant_id)
      .in("role", ["admin", "staff", "master_admin"])
      .limit(1)
      .maybeSingle();

    const { data: platformRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("tenant_id", null)
      .eq("role", "master_admin")
      .limit(1)
      .maybeSingle();

    if (!tenantRole && !platformRole) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: product } = await serviceClient
      .from("products")
      .select("id, name, slug, default_variant, technical_specs")
      .eq("tenant_id", order.tenant_id)
      .eq("slug", order.product_slug)
      .maybeSingle();

    if (!product) {
      return new Response(JSON.stringify({ error: "Product for order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const technicalSpecs = (product.technical_specs || {}) as Record<string, any>;
    const catalogProductId = technicalSpecs.pod2_catalog_id;
    if (!technicalSpecs.is_pod_v2 || !catalogProductId) {
      return new Response(JSON.stringify({ error: "Order product is not linked to POD v2" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingJob } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .select("id")
      .eq("order_id", order.id)
      .eq("catalog_product_id", catalogProductId)
      .maybeSingle();

    if (existingJob) {
      return new Response(JSON.stringify({
        success: true,
        jobsCreated: 0,
        jobs: [],
        message: "Job already exists for this order",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedVariant = parseTaggedValue(order.status_note, "VARIANT")
      || String(order.product_configuration || "").trim()
      || String(product.default_variant || "default");

    let { data: priceMatrix } = await serviceClient
      .from("pod2_catalog_price_matrix")
      .select("variant_signature, quantities, base_costs, currency")
      .eq("catalog_product_id", catalogProductId)
      .eq("variant_signature", requestedVariant)
      .maybeSingle();

    if (!priceMatrix) {
      const { data: fallbackMatrix } = await serviceClient
        .from("pod2_catalog_price_matrix")
        .select("variant_signature, quantities, base_costs, currency")
        .eq("catalog_product_id", catalogProductId)
        .limit(1)
        .maybeSingle();
      priceMatrix = fallbackMatrix || null;
    }

    if (!priceMatrix) {
      return new Response(JSON.stringify({ error: "No POD v2 price matrix found for product" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qty = Number(order.quantity || 1);
    const tenantCost = resolveTenantCost(priceMatrix.quantities, priceMatrix.base_costs, qty);
    const deliverySummary = parseTaggedValue(order.status_note, "LEVERING")
      || [order.delivery_address, `${order.delivery_zip || ""} ${order.delivery_city || ""}`.trim()].filter(Boolean).join(", ")
      || null;
    const recipientName = parseTaggedValue(order.status_note, "MODTAGER") || order.customer_name || null;
    const recipientCompany = parseTaggedValue(order.status_note, "MODTAGER-FIRMA");
    const shippingMethod = parseTaggedValue(order.status_note, "LEVERINGSMETODE") || order.delivery_type || null;
    const statusNoteSenderMode = parseSenderMode(order.status_note);
    const statusNoteHasExplicitSender = statusNoteSenderMode !== "standard";

    // Look up the tenant's POD shipping profile (white-label sender identity).
    // Missing row is the normal case -> fall back to "standard".
    const { data: tenantProfile } = await serviceClient
      .from("tenant_pod_shipping_profile")
      .select("sender_mode, sender_company_name, sender_contact_name, sender_email, sender_phone, sender_street, sender_house_number, sender_postcode, sender_city, sender_country, sender_vat_number, sender_logo_url")
      .eq("tenant_id", order.tenant_id)
      .maybeSingle();

    // Priority:
    //   1. explicit per-order status_note override (blind / custom w/ AFSENDER tag)
    //   2. tenant-wide profile (if non-standard)
    //   3. "standard"
    let senderMode: "standard" | "blind" | "custom" = statusNoteSenderMode;
    let senderName: string | null = null;
    let senderAddressJson: Record<string, unknown> | null = null;
    let senderLogoUrl: string | null = null;

    if (statusNoteHasExplicitSender) {
      senderMode = statusNoteSenderMode;
      senderName = senderMode === "custom"
        ? parseTaggedValue(order.status_note, "AFSENDER")
        : null;
    } else if (tenantProfile && tenantProfile.sender_mode && tenantProfile.sender_mode !== "standard") {
      senderMode = tenantProfile.sender_mode as "standard" | "blind" | "custom";
      if (senderMode === "custom") {
        senderName = tenantProfile.sender_company_name || null;
        senderAddressJson = {
          company_name: tenantProfile.sender_company_name,
          contact_name: tenantProfile.sender_contact_name,
          email: tenantProfile.sender_email,
          phone: tenantProfile.sender_phone,
          street: tenantProfile.sender_street,
          house_number: tenantProfile.sender_house_number,
          postcode: tenantProfile.sender_postcode,
          city: tenantProfile.sender_city,
          country: tenantProfile.sender_country,
          vat_number: tenantProfile.sender_vat_number,
        };
      }
      // Always carry the logo snapshot when the profile has one, so the
      // master forwarding queue can show it regardless of mode. The
      // submission adapter decides later whether/how to use it.
      senderLogoUrl = tenantProfile.sender_logo_url || null;
    }

    const { data: createdJob, error: jobError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .insert({
        tenant_id: order.tenant_id,
        order_id: order.id,
        order_item_id: order.id,
        catalog_product_id: catalogProductId,
        product_id: product.id,
        product_name: product.name || order.product_name,
        variant_signature: priceMatrix.variant_signature || requestedVariant,
        qty,
        tenant_cost: tenantCost,
        currency: priceMatrix.currency || "DKK",
        status: autoForward ? "paid" : "awaiting_approval",
        customer_email: order.customer_email || null,
        recipient_name: recipientName,
        recipient_company: recipientCompany,
        delivery_summary: deliverySummary,
        shipping_method: shippingMethod,
        sender_mode: senderMode,
        sender_name: senderName,
        sender_address_json: senderAddressJson,
        sender_logo_url: senderLogoUrl,
      })
      .select()
      .maybeSingle();

    if (jobError || !createdJob) {
      throw jobError || new Error("Failed to create POD v2 job");
    }

    return new Response(JSON.stringify({
      success: true,
      jobsCreated: 1,
      jobs: [createdJob],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POD2 Create Jobs error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
