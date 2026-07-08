// Stripe PaymentIntent creation with tenant-aware destination charges
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_DELIVERY_METHODS = [
  { id: "standard", name: "Standard levering", price: 49 },
  { id: "express", name: "Express levering", price: 199 },
];

type CheckoutQuote = {
  productId?: string | null;
  productSlug?: string | null;
  quantity?: number | null;
  formatId?: string | null;
  materialId?: string | null;
  verticalValueId?: string | null;
  variantKey?: string | null;
  variantValueIds?: string[] | null;
  variantDisplayLabels?: string[] | null;
  selectedSectionValues?: Record<string, string | null> | null;
  optionIds?: string[] | null;
  shippingSelected?: string | null;
  areaM2?: number | null;
};

type QuoteResult = {
  amountOre: number;
  productPriceOre: number;
  optionExtraOre: number;
  shippingOre: number;
  pricingSource: string;
  matchedPriceRowId: string | null;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(isUuid))).sort();
}

function resolveDeliveryMethodCost(method?: { id?: string | null; price?: number | null } | null): number {
  if (!method) return 0;
  const explicitPrice = Number(method.price);
  if (Number.isFinite(explicitPrice)) return Math.max(0, Math.round(explicitPrice));
  const normalizedId = String(method.id || "").trim().toLowerCase();
  if (normalizedId === "standard") return 49;
  if (normalizedId === "express" || normalizedId === "ekspres") return 199;
  return 0;
}

function normalizeDeliveryMethods(raw: unknown): Array<{ id: string; name?: string; price?: number | null }> {
  const methods = Array.isArray(raw) ? raw : [];
  const normalized = methods
    .map((method: any, index) => ({
      id: String(method?.id || DEFAULT_DELIVERY_METHODS[index]?.id || `delivery-${index + 1}`),
      name: String(method?.name || DEFAULT_DELIVERY_METHODS[index]?.name || ""),
      price: Number.isFinite(Number(method?.price))
        ? Math.max(0, Math.round(Number(method.price)))
        : DEFAULT_DELIVERY_METHODS[index]?.price ?? null,
    }))
    .filter((method) => !!method.id);

  return normalized.length > 0 ? normalized : DEFAULT_DELIVERY_METHODS;
}

async function fetchPricingRead(
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  quote: CheckoutQuote,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/pricing-read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    },
    body: JSON.stringify({
      tenantId,
      productId: quote.productId || null,
      slug: quote.productSlug || null,
      quantity: Number(quote.quantity || 0) || null,
      formatId: quote.formatId || null,
      materialId: quote.materialId || null,
      verticalValueId: quote.verticalValueId || null,
      variantKey: quote.variantKey || null,
      variantValueIds: Array.isArray(quote.variantValueIds) ? quote.variantValueIds : [],
      variantDisplayLabels: Array.isArray(quote.variantDisplayLabels) ? quote.variantDisplayLabels : [],
      selectedSectionValues: quote.selectedSectionValues || {},
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Could not verify product price");
  }
  if (!data.bestMatch || !Number.isFinite(Number(data.bestMatch.price_dkk))) {
    throw new Error("No server price matched the checkout selection");
  }
  return data;
}

async function calculateOptionExtras(
  serviceClient: ReturnType<typeof createClient>,
  productId: string,
  quote: CheckoutQuote,
): Promise<number> {
  const optionIds = normalizeIds(quote.optionIds);
  if (optionIds.length === 0) return 0;

  const { data: assignments, error: assignmentError } = await serviceClient
    .from("product_option_group_assignments")
    .select("option_group_id")
    .eq("product_id", productId);
  if (assignmentError) throw assignmentError;

  const allowedGroupIds = new Set(((assignments || []) as Array<{ option_group_id: string }>).map((entry) => entry.option_group_id));
  if (allowedGroupIds.size === 0) {
    throw new Error("Selected options are not available for this product");
  }

  const { data: options, error: optionsError } = await serviceClient
    .from("product_options")
    .select("id, group_id, extra_price, price_mode")
    .in("id", optionIds);
  if (optionsError) throw optionsError;

  const optionRows = (options || []) as Array<{ id: string; group_id: string; extra_price: number; price_mode: string | null }>;
  if (optionRows.length !== optionIds.length) {
    throw new Error("One or more selected options could not be verified");
  }

  const quantity = Math.max(0, Math.floor(Number(quote.quantity || 0)));
  const areaM2 = Math.max(0, Number(quote.areaM2 || 1) || 1);

  return optionRows.reduce((sum, option) => {
    if (!allowedGroupIds.has(option.group_id)) {
      throw new Error("Selected option is not available for this product");
    }
    const extraPrice = Math.max(0, Number(option.extra_price || 0));
    const priceMode = option.price_mode || "fixed";
    if (priceMode === "per_quantity") return sum + extraPrice * quantity;
    if (priceMode === "per_area") return sum + extraPrice * areaM2 * quantity;
    return sum + extraPrice;
  }, 0);
}

async function calculateCheckoutQuote(
  serviceClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  quote: CheckoutQuote,
): Promise<QuoteResult> {
  if (!quote?.productId && !quote?.productSlug) {
    throw new Error("checkout_quote.productId or productSlug required");
  }
  if (!Number.isFinite(Number(quote.quantity)) || Number(quote.quantity) <= 0) {
    throw new Error("checkout_quote.quantity must be a positive number");
  }

  const pricing = await fetchPricingRead(supabaseUrl, serviceKey, tenantId, quote);
  const product = pricing.product;
  const productId = String(product?.id || quote.productId || "");
  if (!isUuid(productId)) throw new Error("Could not resolve product for checkout quote");

  const productPrice = Math.max(0, Number(pricing.bestMatch.price_dkk || 0));
  const optionExtra = await calculateOptionExtras(serviceClient, productId, quote);

  const { data: productRow, error: productError } = await serviceClient
    .from("products")
    .select("banner_config")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw productError;

  const methods = normalizeDeliveryMethods((productRow as any)?.banner_config?.order_delivery?.delivery?.methods);
  const selectedShipping = String(quote.shippingSelected || "").trim();
  const deliveryMethod = methods.find((method) => method.id === selectedShipping) || methods[0] || null;
  const shipping = resolveDeliveryMethodCost(deliveryMethod);

  return {
    amountOre: Math.round((productPrice + optionExtra + shipping) * 100),
    productPriceOre: Math.round(productPrice * 100),
    optionExtraOre: Math.round(optionExtra * 100),
    shippingOre: Math.round(shipping * 100),
    pricingSource: String(pricing.source || "pricing-read"),
    matchedPriceRowId: typeof pricing.bestMatch.id === "string" ? pricing.bestMatch.id : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, {
    keyPrefix: "stripe-create-payment-intent",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id as string | undefined;
    const currency = (body.currency as string | undefined) || "dkk";
    const metadata = body.metadata as Record<string, string> | undefined;
    const checkoutQuote = body.checkout_quote as CheckoutQuote | undefined;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    if (!checkoutQuote) {
      return jsonResponse({ error: "checkout_quote required" }, 400);
    }

    const quoteResult = await calculateCheckoutQuote(
      serviceClient,
      supabaseUrl,
      supabaseServiceKey,
      tenantId,
      checkoutQuote,
    );
    const amountOre = quoteResult.amountOre;
    if (!Number.isFinite(amountOre) || amountOre <= 0) {
      return jsonResponse({ error: "Could not calculate a positive checkout amount" }, 400);
    }

    const clientAmountOre = Number(body.amount_ore);
    if (Number.isFinite(clientAmountOre) && Math.abs(Math.round(clientAmountOre) - amountOre) > 1) {
      return jsonResponse({
        error: "Checkout amount mismatch",
        server_amount_ore: amountOre,
        client_amount_ore: Math.round(clientAmountOre),
      }, 409);
    }

    const { data: settings } = await serviceClient
      .from("tenant_payment_settings")
      .select("stripe_account_id, status, charges_enabled, platform_fee_percent, platform_fee_flat_ore")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const canUseConnected =
      !!settings?.stripe_account_id &&
      settings?.charges_enabled &&
      settings?.status !== "disabled";

    const percentFee = Number(settings?.platform_fee_percent || 0);
    const flatFee = Number(settings?.platform_fee_flat_ore || 0);
    const percentAmount = Math.round(amountOre * (percentFee / 100));
    const applicationFee = Math.max(0, Math.min(amountOre, percentAmount + flatFee));

    if (canUseConnected) {
      // Destination charge: PI lives on the platform account, funds transfer
      // to the connected account. This is simpler than direct charges because
      // the client can use the platform publishable key without any
      // `stripeAccount` option — Elements just works.
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amountOre),
        currency,
        application_fee_amount: applicationFee > 0 ? applicationFee : undefined,
        on_behalf_of: settings!.stripe_account_id!,
        transfer_data: { destination: settings!.stripe_account_id! },
        automatic_payment_methods: { enabled: true },
        metadata: {
          tenant_id: tenantId,
          ...(metadata || {}),
          amount_source: "server_checkout_quote",
          product_price_ore: String(quoteResult.productPriceOre),
          option_extra_ore: String(quoteResult.optionExtraOre),
          shipping_ore: String(quoteResult.shippingOre),
          pricing_source: quoteResult.pricingSource,
          matched_price_row_id: quoteResult.matchedPriceRowId || "",
        },
      });

      return jsonResponse({
        client_secret: paymentIntent.client_secret,
        // Destination charges don't need stripeAccount on the client, so
        // report `connected: false` to keep the frontend on the platform
        // publishable key path.
        connected: false,
        mode: "destination",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountOre),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        tenant_id: tenantId,
        ...(metadata || {}),
        amount_source: "server_checkout_quote",
        product_price_ore: String(quoteResult.productPriceOre),
        option_extra_ore: String(quoteResult.optionExtraOre),
        shipping_ore: String(quoteResult.shippingOre),
        pricing_source: quoteResult.pricingSource,
        matched_price_row_id: quoteResult.matchedPriceRowId || "",
      },
    });

    return jsonResponse({
      client_secret: paymentIntent.client_secret,
      connected: false,
      mode: "platform",
    });
  } catch (error: any) {
    console.error("stripe-create-payment-intent error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 500);
  }
});
