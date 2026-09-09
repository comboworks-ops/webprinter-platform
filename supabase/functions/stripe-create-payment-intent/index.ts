// Stripe PaymentIntent creation with tenant-aware destination charges
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { assertCheckoutIdentity, canonicalJson, CheckoutError, sha256, validateCheckoutOrder } from "../_shared/storefrontCheckout.ts";
import { assertQuoteableProduct, calculateVerifiedOptionExtras, roundCheckoutAmounts, verifiedFormatArea } from "../_shared/storefrontQuoteAmounts.ts";
import { calculateVerifiedStorformatQuote, loadStorformatQuoteRows, type StorformatQuoteSelection } from "../_shared/storefrontStorformatQuote.ts";
import { bindCheckoutPayment, checkoutFailure, getAttempt, prepareCheckoutArtifacts } from "../_shared/storefrontCheckoutRuntime.ts";

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
  widthMm?: number | null;
  heightMm?: number | null;
  storformat?: StorformatQuoteSelection | null;
};

type QuoteResult = {
  amountOre: number;
  productPriceOre: number;
  optionExtraOre: number;
  shippingOre: number;
  pricingSource: string;
  matchedPriceRowId: string | null;
  verifiedDimensions?: { widthMm: number; heightMm: number; areaM2: number } | null;
  product: { id: string; name: string; slug: string; podV2: boolean };
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
    throw new CheckoutError("checkout_quote_unavailable", 409);
  }
  if (data.product?.tenant_id !== tenantId || data.product?.id !== quote.productId
    || Number(data.summary?.matchedRows) !== 1 || Number(data.bestMatch.quantity) !== Number(quote.quantity)) {
    throw new CheckoutError("checkout_quote_ambiguous", 409);
  }
  return data;
}

async function calculateOptionExtras(
  serviceClient: SupabaseClient,
  productId: string,
  quote: CheckoutQuote,
  verifiedAreaM2: number | null,
  priceRow: any,
  tenantId: string,
): Promise<number> {
  if (quote.optionIds != null && (!Array.isArray(quote.optionIds)
    || quote.optionIds.some(value => !isUuid(value)) || new Set(quote.optionIds).size !== quote.optionIds.length)) {
    throw new CheckoutError("checkout_invalid_options");
  }
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

  for (const option of optionRows) {
    if (!allowedGroupIds.has(option.group_id)) throw new CheckoutError("checkout_invalid_options",409);
  }
  let area = verifiedAreaM2;
  if (area == null && optionRows.some(option => option.price_mode === "per_area")) {
    const {data: format,error} = await serviceClient.from("product_attribute_values")
      .select("id,width_mm,height_mm,group_id").eq("product_id",productId).eq("tenant_id",tenantId).eq("id",quote.formatId || "").maybeSingle();
    if (error) throw new CheckoutError("checkout_format_dimensions_unverified",409);
    const {data: group,error: groupError} = await serviceClient.from("product_attribute_groups").select("id")
      .eq("id",format?.group_id || "").eq("product_id",productId).eq("tenant_id",tenantId).eq("kind","format").maybeSingle();
    if (groupError || !group) throw new CheckoutError("checkout_format_dimensions_unverified",409);
    area = verifiedFormatArea(format,quote,priceRow);
  }
  return calculateVerifiedOptionExtras(optionRows,Number(quote.quantity),area);
}

async function calculateCheckoutQuote(
  serviceClient: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  quote: CheckoutQuote,
): Promise<QuoteResult> {
  if (!quote?.productId && !quote?.productSlug) {
    throw new Error("checkout_quote.productId or productSlug required");
  }
  if (!Number.isSafeInteger(Number(quote.quantity)) || Number(quote.quantity) <= 0) {
    throw new Error("checkout_quote.quantity must be a positive number");
  }

  const lookup = serviceClient.from("products").select("id,name,slug,tenant_id,pricing_type,is_published,banner_config,technical_specs")
    .eq("tenant_id", tenantId).eq("is_published", true);
  const {data: sourceProduct, error: sourceError} = await (isUuid(quote.productId)
    ? lookup.eq("id", quote.productId!) : lookup.eq("slug", quote.productSlug!)).maybeSingle();
  if (sourceError) throw new CheckoutError("checkout_product_unavailable", 409);
  assertQuoteableProduct(sourceProduct, tenantId);
  quote = {...quote, productId: sourceProduct!.id};
  const productId = sourceProduct!.id;
  let productPrice: number;
  let pricingSource: string;
  let matchedPriceRowId: string | null = null;
  let verifiedDimensions: QuoteResult["verifiedDimensions"] = null;
  let priceRow: any = null;
  if (String(sourceProduct!.pricing_type).toUpperCase() === "STORFORMAT") {
    const rows = await loadStorformatQuoteRows(serviceClient,productId,tenantId);
    const result = calculateVerifiedStorformatQuote(rows,quote.storformat!,Number(quote.quantity),quote.areaM2);
    productPrice = result.totalPrice;
    pricingSource = result.source;
    verifiedDimensions = {widthMm: result.selection.widthMm,heightMm: result.selection.heightMm,areaM2: result.areaM2};
  } else {
    const pricing = await fetchPricingRead(supabaseUrl,serviceKey,tenantId,quote);
    productPrice = Number(pricing.bestMatch.price_dkk);
    pricingSource = String(pricing.source || "pricing-read");
    matchedPriceRowId = typeof pricing.bestMatch.id === "string" ? pricing.bestMatch.id : null;
    priceRow = pricing.bestMatch;
  }
  const optionExtra = await calculateOptionExtras(serviceClient,productId,quote,verifiedDimensions?.areaM2 ?? null,priceRow,tenantId);

  const { data: productRow, error: productError } = await serviceClient
    .from("products")
    .select("banner_config")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw productError;

  const methods = normalizeDeliveryMethods((productRow as any)?.banner_config?.order_delivery?.delivery?.methods);
  const selectedShipping = String(quote.shippingSelected || "").trim();
  const deliveryMethod = methods.find((method) => method.id === selectedShipping) || (!selectedShipping ? methods[0] : null);
  if (!deliveryMethod) throw new CheckoutError("checkout_delivery_unavailable", 409);
  const shipping = resolveDeliveryMethodCost(deliveryMethod);

  return {
    product: {id: sourceProduct!.id,name: sourceProduct!.name,slug: sourceProduct!.slug,
      podV2: isUuid((sourceProduct as any)?.technical_specs?.pod2_catalog_id)},
    ...roundCheckoutAmounts(productPrice,optionExtra,shipping),
    pricingSource,matchedPriceRowId,verifiedDimensions,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return jsonResponse({error: "method_not_allowed"}, 405);
  const limited = checkRateLimit(req, {keyPrefix: "stripe-create-payment-intent",limit: 20,windowMs: 60_000});
  if (limited) return limited;
  try {
    // Default off: enabling requires the migration and the dedicated signed webhook.
    if (Deno.env.get("STOREFRONT_CHECKOUT_ENABLED") !== "true"
      || !Deno.env.get("STOREFRONT_CHECKOUT_WEBHOOK_SECRET")) throw new CheckoutError("checkout_backend_not_ready", 503);
    const raw = await req.text();
    if (raw.length > 100_000) throw new CheckoutError("checkout_request_too_large", 413);
    const body = JSON.parse(raw);
    if (body.contract_version !== 2) throw new CheckoutError("checkout_upgrade_required", 409);
    assertCheckoutIdentity(body.checkout_attempt_id, body.checkout_access_token);
    if (!isUuid(body.tenant_id) || body.currency !== "dkk") throw new CheckoutError("checkout_invalid_request");
    const checkoutQuote = body.checkout_quote as CheckoutQuote;
    const order = validateCheckoutOrder(body.checkout_order);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = bearer ? (await serviceClient.auth.getUser(bearer)).data?.user : null;
    const userId = user?.id || null;
    const tokenHash = await sha256(body.checkout_access_token);
    const requestHash = await sha256(canonicalJson({tenantId: body.tenant_id,userId,order,quote: checkoutQuote,amount: body.amount_ore}));
    let attempt = await getAttempt(serviceClient, body.checkout_attempt_id);
    if (attempt && (attempt.access_token_hash !== tokenHash || attempt.tenant_id !== body.tenant_id
      || attempt.user_id !== userId)) throw new CheckoutError("checkout_access_denied", 403);
    if (attempt && attempt.request_hash !== requestHash) throw new CheckoutError("checkout_attempt_changed", 409);
    if (attempt?.state === "cancelled") throw new CheckoutError("checkout_attempt_cancelled", 409);
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!/^(sk|rk)_(test|live)_/.test(secretKey)) throw new CheckoutError("checkout_backend_not_ready", 503);
    const stripe = new Stripe(secretKey, {apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any});
    if (!attempt) {
      const result = await calculateCheckoutQuote(serviceClient,supabaseUrl,serviceKey,body.tenant_id,checkoutQuote);
      if (!Number.isSafeInteger(result.amountOre) || result.amountOre <= 0) throw new CheckoutError("checkout_invalid_amount");
      if (!Number.isSafeInteger(body.amount_ore) || body.amount_ore !== result.amountOre) {
        return jsonResponse({contract_version: 2,error: "checkout_amount_mismatch",server_amount_ore: result.amountOre}, 409);
      }
      const {data: settings,error: settingsError} = await serviceClient.from("tenant_payment_settings")
        .select("stripe_account_id,status,charges_enabled,platform_fee_percent,platform_fee_flat_ore")
        .eq("tenant_id", body.tenant_id).maybeSingle();
      if (settingsError) throw new CheckoutError("checkout_payment_settings_unavailable", 503);
      const connected = !!settings?.stripe_account_id && settings?.charges_enabled && settings?.status !== "disabled";
      // A configured but disabled/unready shop must never silently charge the platform.
      if (settings?.stripe_account_id && !connected) throw new CheckoutError("checkout_payments_unavailable", 409);
      const fee = Math.max(0,Math.min(result.amountOre,Math.round(result.amountOre * Number(settings?.platform_fee_percent || 0) / 100)
        + Number(settings?.platform_fee_flat_ore || 0)));
      if (!Number.isSafeInteger(fee)) throw new CheckoutError("checkout_invalid_fee", 503);
      const candidate = {
        id: body.checkout_attempt_id,tenant_id: body.tenant_id,user_id: userId,
        access_token_hash: tokenHash,request_hash: requestHash,
        order_snapshot: {...order,product_name: result.product.name,product_slug: result.product.slug,quantity: Number(checkoutQuote.quantity)},
        quote_snapshot: {...result,selection: checkoutQuote},amount_ore: result.amountOre,
        stripe_destination: connected ? settings!.stripe_account_id : null,stripe_application_fee: fee,
        livemode: /^(sk|rk)_live_/.test(secretKey),
      };
      const {error} = await serviceClient.from("storefront_checkout_attempts").insert(candidate);
      // A concurrent identical request may have inserted first. Never overwrite it.
      attempt = await getAttempt(serviceClient, candidate.id);
      if (!attempt) throw new CheckoutError("checkout_attempt_save_failed", 503);
      if (attempt.access_token_hash !== tokenHash || attempt.request_hash !== requestHash) throw new CheckoutError("checkout_attempt_changed", 409);
      if (error && error.code !== "23505") throw new CheckoutError("checkout_attempt_save_failed", 503);
    }
    attempt = await prepareCheckoutArtifacts(serviceClient,supabaseUrl,attempt,order);
    if (attempt.livemode !== /^(sk|rk)_live_/.test(secretKey)) throw new CheckoutError("checkout_payment_mode_changed", 409);
    if (!attempt.payment_intent_id && Date.now() - Date.parse(attempt.created_at) > 23 * 60 * 60 * 1000) {
      // Stripe can prune idempotency keys after 24h. Never risk a second intent.
      throw new CheckoutError("checkout_reconciliation_required", 409);
    }
    const payment = attempt.payment_intent_id
      ? await stripe.paymentIntents.retrieve(attempt.payment_intent_id)
      : await stripe.paymentIntents.create({
        amount: attempt.amount_ore,currency: "dkk",automatic_payment_methods: {enabled: true},
        ...(attempt.stripe_destination ? {on_behalf_of: attempt.stripe_destination,
          transfer_data: {destination: attempt.stripe_destination},
          ...(attempt.stripe_application_fee > 0 ? {application_fee_amount: attempt.stripe_application_fee} : {})} : {}),
        metadata: {contract_version: "2",checkout_attempt_id: attempt.id,tenant_id: attempt.tenant_id,
          request_hash: attempt.request_hash,amount_source: "server_checkout_quote"},
      }, {idempotencyKey: `storefront-checkout-v2:${attempt.id}`});
    attempt = await bindCheckoutPayment(serviceClient,attempt,payment);
    return jsonResponse({contract_version: 2,checkout_attempt_id: attempt.id,payment_intent_id: payment.id,
      client_secret: payment.client_secret,connected: false,mode: attempt.stripe_destination ? "destination" : "platform"});
  } catch (error) {
    return checkoutFailure(error);
  }
});
