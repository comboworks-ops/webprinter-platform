// POD v2: Submit a paid fulfillment job to Print.com as a single POST /orders.
//
// Architecture (post-rewrite):
//   - Tenants NEVER call Print.com. Master curates products in WebPrinter,
//     shares them via the existing product-transfer system, and when a
//     tenant order arrives master forwards it here.
//   - The tenant-cloned product carries no Print.com awareness. The master
//     keeps a `pod2_catalog_products` row with a `supplier_product_data`
//     blob describing:
//       { printcom_sku, supplier_country?, fixed_options, attribute_map }
//     This tells us how to translate the customer's config string
//     (e.g. "size:a4|paper:130g|copies:500") into Print.com option slugs.
//
// This replaces the older `pod2-submit-to-printcom` function, which was
// built against a fictional 7-step cart/contacts/stickyslip API. Print.com
// does not have a cart concept, separate contact registration, or split
// logo upload step. Senders, logos, and file URLs all live inline on the
// order item per:
//   https://developer.print.com/reference/introduction
//
// Input:  { jobId: string, paymentMethod?: "invoice" | "psp", dryRun?: boolean }
// Output: { success, job?, payload?, response?, error? }
//
// MASTER ONLY. The tenant-side UI does not (and must not) invoke this.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

import { requireRole } from "../_shared/auth.ts";
import {
  fingerprintSubmissionPayload,
  getSubmissionEligibility,
  MASTER_TENANT_ID,
  normalizePrintcomBaseUrl,
  parseSubmissionRequest,
  shouldReleaseSubmissionClaim,
  validateSubmissionPayload,
} from "../_shared/pod2PrintcomSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyStripePayment(job: Record<string, any>): Promise<void> {
  const secret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!secret) throw new Error("Stripe payment verification is not configured");
  const paymentIntentId = String(job.stripe_payment_intent_id || "").trim();
  if (!paymentIntentId) throw new Error("Stripe payment reference is missing");

  const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const expectedAmount = Math.round(Number(job.tenant_cost || 0) * 100);
  const expectedCurrency = String(job.currency || "DKK").toLowerCase();
  const metadata = paymentIntent.metadata || {};

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Stripe payment is not completed");
  }
  if (
    !Number.isInteger(expectedAmount) || expectedAmount <= 0 ||
    paymentIntent.amount !== expectedAmount
  ) {
    throw new Error("Stripe payment amount does not match the production job");
  }
  if (paymentIntent.currency !== expectedCurrency) {
    throw new Error(
      "Stripe payment currency does not match the production job",
    );
  }
  if (
    metadata.job_id !== job.id || metadata.order_id !== job.order_id ||
    metadata.tenant_id !== job.tenant_id
  ) {
    throw new Error(
      "Stripe payment metadata does not match the production job",
    );
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

// Parse a variant signature / product_configuration string like
// "size:a4|paper:130g|copies:500" into { size: "a4", paper: "130g", copies: "500" }.
function parseConfig(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const pair of String(raw).split("|")) {
    const idx = pair.indexOf(":");
    if (idx <= 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function splitName(
  full: string | null | undefined,
): { firstName: string; lastName: string } {
  const parts = String(full || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

// Print.com requires an ISO-2 country code, but Danish orders often save the
// country as "Danmark" / "DANMARK" (or the English word). Normalize common
// variants so we don't have to clean up historical order data.
function normalizeCountry(raw: string | null | undefined): string {
  const v = String(raw || "").trim().toUpperCase();
  if (!v) return "DK";
  if (v.length === 2) return v;
  const map: Record<string, string> = {
    "DANMARK": "DK",
    "DENMARK": "DK",
    "SVERIGE": "SE",
    "SWEDEN": "SE",
    "NORGE": "NO",
    "NORWAY": "NO",
    "TYSKLAND": "DE",
    "GERMANY": "DE",
    "DEUTSCHLAND": "DE",
    "HOLLAND": "NL",
    "NEDERLAND": "NL",
    "NETHERLANDS": "NL",
    "FINLAND": "FI",
    "ISLAND": "IS",
    "ICELAND": "IS",
  };
  return map[v] || v.slice(0, 2);
}

// Split a Danish-style address ("Stationsvej 17" / "Testvej 1B") into
// { street, houseNumber }. Print.com wants them in separate fields. If we
// can't see a trailing number, we return the whole thing as the street and
// an empty house number — Print.com may still accept that for some countries.
function splitStreet(
  full: string | null | undefined,
): { street: string; houseNumber: string } {
  const raw = String(full || "").trim();
  if (!raw) return { street: "", houseNumber: "" };
  // Match trailing "<digits><optional letter or /<digits>>" as house number.
  const match = raw.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$/);
  if (match) {
    return { street: match[1].trim(), houseNumber: match[2].trim() };
  }
  return { street: raw, houseNumber: "" };
}

// Build the Print.com `options` dict from the curated attribute map + the
// customer's config + the job quantity.
//
// supplier_product_data shape (set during master curation):
//   {
//     "printcom_sku": "printed-letterheads",
//     "supplier_country"?: "NL",
//     "fixed_options": { "material": "90gr-offset", ... },
//     "attribute_map": [
//       { "webprinter_attr": "size", "printcom_option": "size", "values": {...} },
//       { "webprinter_attr": "copies", "printcom_option": "copies", "from_qty": true }
//     ]
//   }
function buildPrintcomOptions(
  supplierData: Record<string, any>,
  customerConfig: Record<string, string>,
  qty: number,
): { options: Record<string, string>; warnings: string[] } {
  const warnings: string[] = [];
  const options: Record<string, string> = {
    ...(supplierData.fixed_options || {}),
  };

  const attrMap: any[] = Array.isArray(supplierData.attribute_map)
    ? supplierData.attribute_map
    : [];

  // Passthrough fallback: if the master hasn't curated attribute_map or
  // fixed_options for this catalog product yet, treat the customer's
  // variant_signature as already being in Print.com key:value format and
  // pass it straight through. Imported POD v2 catalog rows store variants
  // in Print.com's native slug vocabulary, so this is a safe default until
  // curation overrides specific keys.
  const hasCuration = attrMap.length > 0 ||
    Object.keys(supplierData.fixed_options || {}).length > 0;
  if (!hasCuration) {
    for (const [k, v] of Object.entries(customerConfig)) {
      if (k && v !== undefined && v !== null && v !== "") {
        options[k] = String(v);
      }
    }
    warnings.push(
      "No curated attribute_map — forwarding variant_signature to Print.com as-is",
    );
  }

  for (const entry of attrMap) {
    const optionSlug: string = entry.printcom_option || entry.webprinter_attr;
    if (!optionSlug) continue;

    let rawValue: string | null = null;

    if (entry.from_qty === true) {
      rawValue = String(qty);
    } else {
      const configKey: string = entry.webprinter_attr || entry.printcom_option;
      const val = customerConfig[configKey];
      if (val !== undefined && val !== null && val !== "") {
        rawValue = String(val);
      }
    }

    if (rawValue === null) {
      if (entry.required === true) {
        warnings.push(
          `Missing required attribute "${entry.webprinter_attr}" in customer config`,
        );
      }
      if (entry.default !== undefined) {
        options[optionSlug] = String(entry.default);
      }
      continue;
    }

    // Translate value through the `values` map if provided.
    if (
      entry.values && typeof entry.values === "object" &&
      rawValue in entry.values
    ) {
      options[optionSlug] = String(entry.values[rawValue]);
    } else {
      options[optionSlug] = rawValue;
    }
  }

  // Print.com expects `copies` on options (the number of printed copies), in
  // addition to the item-level `quantity`. Variant signatures never carry
  // this and curated maps often omit it too, so fill it in from qty when
  // missing. `quantity` on the item stays as-is (Print.com treats them as
  // separate — copies per shipment vs. total shipped units).
  if (!options.copies && Number.isFinite(qty) && qty > 0) {
    options.copies = String(qty);
  }

  return { options, warnings };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    let request;
    try {
      request = parseSubmissionRequest(await req.json());
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : "Invalid request",
      }, 400);
    }
    const { jobId, paymentMethod, dryRun } = request;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ---------- load job ----------
    const { data: job, error: jobError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError || !job) return json({ error: "Job not found" }, 404);

    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("id, pod2_auto_forward")
      .eq("id", job.tenant_id)
      .maybeSingle();
    if (!tenant) return json({ error: "Tenant not found" }, 404);

    const eligibility = getSubmissionEligibility({
      job,
      tenantAutoForward: tenant.pod2_auto_forward === true,
    });
    if (!eligibility.ok) {
      return json({
        error: eligibility.message,
        code: eligibility.code,
        uncertain: false,
      }, 409);
    }

    // ---------- load order ----------
    const { data: order } = await serviceClient
      .from("orders")
      .select(
        "id, tenant_id, quantity, delivery_address, delivery_city, delivery_zip, delivery_country, customer_name, customer_email, customer_phone, product_configuration, order_number",
      )
      .eq("id", job.order_id)
      .maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.tenant_id !== job.tenant_id) {
      return json({
        error: "Order tenant does not match production job",
        uncertain: false,
      }, 409);
    }

    // ---------- load catalog + curated mapping ----------
    const { data: catalog } = await serviceClient
      .from("pod2_catalog_products")
      .select(
        "id, tenant_id, status, supplier_product_ref, supplier_product_data",
      )
      .eq("id", job.catalog_product_id)
      .maybeSingle();
    if (!catalog) return json({ error: "Catalog product not found" }, 404);
    if (
      catalog.tenant_id !== MASTER_TENANT_ID || catalog.status !== "published"
    ) {
      return json({
        error: "Catalog product is not published in the master catalog",
        uncertain: false,
      }, 409);
    }

    const supplierData = (catalog.supplier_product_data || {}) as Record<
      string,
      any
    >;
    const printcomSku: string = supplierData.printcom_sku ||
      catalog.supplier_product_ref;
    if (!printcomSku) {
      return json({
        error:
          "Catalog product is missing printcom_sku in supplier_product_data",
      }, 400);
    }

    // ---------- load Print.com supplier connection ----------
    const { data: connections } = await serviceClient
      .from("pod2_supplier_connections")
      .select(
        "id, tenant_id, provider_key, base_url, api_key_encrypted, auth_header_mode, auth_header_name, auth_header_prefix",
      )
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("is_active", true)
      .limit(10);
    const connection = (connections || []).find((candidate: any) =>
      String(candidate.provider_key || "").toLowerCase().replace(
        /[^a-z0-9]/g,
        "",
      ) === "printcom"
    );
    if (!connection) {
      return json({ error: "No active Print.com supplier connection" }, 404);
    }

    let baseUrl: string;
    try {
      baseUrl = normalizePrintcomBaseUrl(connection.base_url);
    } catch (error) {
      return json({
        error: error instanceof Error
          ? error.message
          : "Invalid Print.com base URL",
      }, 400);
    }

    // Real Print.com auth = `Authorization: PrintApiKey <key>`. Honor the
    // explicitly stored mode and fail closed when that configuration is invalid.
    const primaryAuth = (): Record<string, string> => {
      const h: Record<string, string> = { Accept: "application/json" };
      const key = String(connection.api_key_encrypted || "").trim();
      if (!key) throw new Error("Print.com credentials are missing");
      if (/[\u0000-\u001f\u007f]/.test(key)) {
        throw new Error(
          "Print.com credentials contain invalid header characters",
        );
      }
      switch (connection.auth_header_mode) {
        case "authorization_bearer":
          h["Authorization"] = `Bearer ${key}`;
          break;
        case "authorization_printapikey":
          h["Authorization"] = `PrintApiKey ${key}`;
          break;
        case "x_api_key":
          h["X-API-Key"] = key;
          break;
        case "custom":
          if (
            !/^[A-Za-z0-9-]+$/.test(String(connection.auth_header_name || ""))
          ) {
            throw new Error("Print.com custom auth header is invalid");
          }
          if (
            /[\u0000-\u001f\u007f]/.test(
              String(connection.auth_header_prefix || ""),
            )
          ) {
            throw new Error(
              "Print.com auth prefix contains invalid header characters",
            );
          }
          h[connection.auth_header_name] = connection.auth_header_prefix
            ? `${String(connection.auth_header_prefix).trim()} ${key}`
            : key;
          break;
        default:
          // Default to the verified working mode.
          h["Authorization"] = `PrintApiKey ${key}`;
      }
      return h;
    };

    // ---------- build customer config + Print.com options ----------
    // Prefer the job's variant_signature (frozen at job creation);
    // fall back to the live order.product_configuration.
    const configString = (job.variant_signature as string | null) ||
      (order.product_configuration as string | null) ||
      "";
    const customerConfig = parseConfig(configString);
    const qty = Number(job.qty || order.quantity || 1);

    const { options: printcomOptions, warnings: optionWarnings } =
      buildPrintcomOptions(
        supplierData,
        customerConfig,
        qty,
      );

    // ---------- load customer print file ----------
    // Print.com's order endpoint takes file URLs inline on the item. We
    // use the most recently uploaded current file for this order.
    const { data: files } = await serviceClient
      .from("order_files")
      .select(
        "file_name, file_url, file_size, file_type, uploaded_at, is_current",
      )
      .eq("order_id", job.order_id)
      .eq("is_current", true)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    const primaryFile = Array.isArray(files) && files.length > 0
      ? files[0]
      : null;
    if (!primaryFile && !dryRun) {
      return json({
        error: "No current print file on order_files for this order",
      }, 400);
    }

    // ---------- build recipient address ----------
    const recipientFullName = job.recipient_name || order.customer_name || "";
    const recipientSplit = splitName(recipientFullName);
    const recipientStreet = splitStreet(order.delivery_address);
    const recipientAddress = {
      companyName: job.recipient_company || "",
      firstName: recipientSplit.firstName,
      lastName: recipientSplit.lastName,
      fullstreet: recipientStreet.street,
      houseNumber: recipientStreet.houseNumber,
      postcode: order.delivery_zip || "",
      city: order.delivery_city || "",
      country: normalizeCountry(order.delivery_country),
      email: job.customer_email || order.customer_email || "",
      telephone: order.customer_phone || "",
    };

    // ---------- build sender address (custom mode only) ----------
    let senderAddress: Record<string, any> | undefined;
    if (job.sender_mode === "custom" && job.sender_address_json) {
      const addr = job.sender_address_json as Record<string, any>;
      const contactSplit = splitName(addr.contact_name);
      // If the profile stored the house number separately use that, else
      // attempt to split it off the street (tenants can enter either way).
      let senderStreet = String(addr.street || "").trim();
      let senderHouseNumber = String(addr.house_number || "").trim();
      if (!senderHouseNumber && senderStreet) {
        const split = splitStreet(senderStreet);
        senderStreet = split.street;
        senderHouseNumber = split.houseNumber;
      }
      senderAddress = {
        companyName: addr.company_name || job.sender_name || "",
        firstName: contactSplit.firstName,
        lastName: contactSplit.lastName,
        fullstreet: senderStreet,
        houseNumber: senderHouseNumber,
        postcode: addr.postcode || "",
        city: addr.city || "",
        country: normalizeCountry(addr.country),
        email: addr.email || "",
        telephone: addr.phone || "",
        vatNr: addr.vat_number || "",
      };
    }

    // ---------- billing = master (WebPrinter pays Print.com) ----------
    // Pulled from the master connection's billing defaults, falling back
    // to env. This is WebPrinter's own address, not the tenant's.
    const billingAddress = {
      companyName: Deno.env.get("PRINTCOM_BILLING_COMPANY") || "WebPrinter",
      firstName: Deno.env.get("PRINTCOM_BILLING_FIRST_NAME") || "WebPrinter",
      lastName: Deno.env.get("PRINTCOM_BILLING_LAST_NAME") || "Admin",
      fullstreet: Deno.env.get("PRINTCOM_BILLING_STREET") || "",
      houseNumber: Deno.env.get("PRINTCOM_BILLING_HOUSE_NUMBER") || "",
      postcode: Deno.env.get("PRINTCOM_BILLING_POSTCODE") || "",
      city: Deno.env.get("PRINTCOM_BILLING_CITY") || "",
      country: String(Deno.env.get("PRINTCOM_BILLING_COUNTRY") || "DK")
        .toUpperCase(),
      email: Deno.env.get("PRINTCOM_BILLING_EMAIL") || "info@webprinter.dk",
      telephone: Deno.env.get("PRINTCOM_BILLING_PHONE") || "",
      vatNr: Deno.env.get("PRINTCOM_BILLING_VAT") || "",
    };

    // ---------- build the single POST /orders payload ----------
    const item: Record<string, any> = {
      sku: printcomSku,
      options: printcomOptions,
      quantity: qty,
      shipments: [
        {
          quantity: qty,
          address: recipientAddress,
        },
      ],
      fileUrl: primaryFile?.file_url || null,
    };

    if (senderAddress) {
      item.senderAddress = senderAddress;
    }
    if (job.sender_logo_url) {
      // Print.com accepts an inline logo URL on the item (sticky slip image).
      item.stickySlipImageUrl = job.sender_logo_url;
    }
    if (supplierData.supplier_country) {
      item.supplierCountry = supplierData.supplier_country;
    }
    if (supplierData.supplier_id) {
      item.supplierId = supplierData.supplier_id;
    }

    const orderPayload = {
      customerReference: `wp-${job.id}`,
      paymentMethod,
      billingAddress,
      items: [item],
    };

    const payloadErrors = validateSubmissionPayload({
      payload: orderPayload,
      expectedJobId: job.id,
      warnings: optionWarnings,
    });
    const validationFingerprint = await fingerprintSubmissionPayload(
      orderPayload,
    );

    if (payloadErrors.length > 0) {
      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          printcom_validation_fingerprint: null,
          printcom_validation_payment_method: null,
          printcom_validated_at: null,
          printcom_validated_by_user_id: null,
          printcom_last_attempt_at: new Date().toISOString(),
          printcom_last_error: payloadErrors.join("; ").slice(0, 2000),
        })
        .eq("id", job.id)
        .is("printcom_order_id", null)
        .is("printcom_submission_lock_token", null);
      return json({
        success: false,
        dryRun,
        error: "Server-side Print.com validation failed",
        validationErrors: payloadErrors,
        warnings: optionWarnings,
        payload: orderPayload,
        uncertain: false,
      }, 422);
    }

    // ---------- dryRun: store the exact server validation binding ----------
    if (dryRun) {
      const validatedAt = new Date().toISOString();
      const { data: validatedJob, error: validationError } = await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          printcom_validation_fingerprint: validationFingerprint,
          printcom_validation_payment_method: paymentMethod,
          printcom_validated_at: validatedAt,
          printcom_validated_by_user_id: user.id,
          printcom_last_attempt_at: validatedAt,
          printcom_last_error: null,
        })
        .eq("id", job.id)
        .eq("status", "paid")
        .is("printcom_order_id", null)
        .is("provider_job_ref", null)
        .is("printcom_submission_lock_token", null)
        .select("id")
        .maybeSingle();

      if (validationError || !validatedJob) {
        return json({
          error: "The production job changed during validation",
          uncertain: false,
        }, 409);
      }

      return json({
        success: true,
        dryRun: true,
        payload: orderPayload,
        warnings: [],
        validationFingerprint,
        validatedAt,
      });
    }

    // Validate all local request headers before acquiring the one-use claim.
    // A configuration error is definitive because no supplier request started.
    let supplierAuthHeaders: Record<string, string>;
    try {
      supplierAuthHeaders = primaryAuth();
    } catch (error) {
      return json({
        error: error instanceof Error
          ? error.message
          : "Print.com credentials are invalid",
        uncertain: false,
      }, 409);
    }

    // ---------- payment proof + atomic duplicate claim ----------
    if (eligibility.paymentVerification === "stripe") {
      try {
        await verifyStripePayment(job);
      } catch (error) {
        return json({
          error: error instanceof Error
            ? error.message
            : "Stripe payment could not be verified",
          uncertain: false,
        }, 409);
      }
    }

    const { data: claimData, error: claimError } = await serviceClient.rpc(
      "pod2_claim_printcom_submission",
      {
        p_job_id: job.id,
        p_validation_fingerprint: validationFingerprint,
        p_payment_method: paymentMethod,
        p_requested_by: user.id,
        p_payment_verification: eligibility.paymentVerification,
      },
    );
    const claim = asRecord(Array.isArray(claimData) ? claimData[0] : claimData);
    const lockToken = typeof claim.lock_token === "string"
      ? claim.lock_token
      : "";
    if (claimError || claim.claimed !== true || !lockToken) {
      return json({
        error: "The production job was not claimed for submission",
        reason: claim.reason || claimError?.message || "claim_failed",
        uncertain: false,
      }, 409);
    }

    // ---------- real submission (the first outbound write) ----------
    const ordersUrl = new URL("/orders", baseUrl).toString();
    let ordersResp: Response;
    let responseData: unknown;
    try {
      ordersResp = await fetch(ordersUrl, {
        method: "POST",
        headers: {
          ...supplierAuthHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      const contentType = ordersResp.headers.get("content-type") || "";
      responseData = contentType.includes("application/json")
        ? await ordersResp.json().catch(() => null)
        : await ordersResp.text();
    } catch (error) {
      const errorMsg = `Print.com submission result is uncertain: ${
        error instanceof Error ? error.message : String(error)
      }`;
      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          printcom_last_attempt_at: new Date().toISOString(),
          printcom_last_error: errorMsg.slice(0, 2000),
        })
        .eq("id", job.id)
        .eq("printcom_submission_lock_token", lockToken);
      return json({ success: false, error: errorMsg, uncertain: true }, 502);
    }

    if (!ordersResp.ok) {
      const errorMsg = `Print.com POST /orders failed: ${ordersResp.status} ${
        typeof responseData === "string"
          ? responseData
          : JSON.stringify(responseData)
      }`;
      const releaseClaim = shouldReleaseSubmissionClaim(ordersResp.status);
      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          printcom_last_attempt_at: new Date().toISOString(),
          printcom_last_error: errorMsg.slice(0, 2000),
          ...(releaseClaim
            ? {
              printcom_submission_lock_token: null,
              printcom_submission_locked_at: null,
              printcom_submission_step: null,
              printcom_validation_fingerprint: null,
              printcom_validation_payment_method: null,
              printcom_validated_at: null,
              printcom_validated_by_user_id: null,
            }
            : {}),
        })
        .eq("id", job.id)
        .eq("printcom_submission_lock_token", lockToken);
      return json({
        success: false,
        error: errorMsg,
        payload: orderPayload,
        response: responseData,
        uncertain: !releaseClaim,
      }, 502);
    }

    const printcomOrderId: string | null = (responseData as any)?.orderId ||
      (responseData as any)?.id ||
      (responseData as any)?.order?.id ||
      null;

    const printcomOrderNumber: string | null =
      (responseData as any)?.orderNumber ||
      (responseData as any)?.order?.orderNumber ||
      null;

    const supplierOrderReference = String(
      printcomOrderId || printcomOrderNumber || "",
    ).trim();
    if (!supplierOrderReference) {
      const errorMsg =
        "Print.com accepted the request without returning an order reference; manual reconciliation is required";
      await serviceClient
        .from("pod2_fulfillment_jobs")
        .update({
          printcom_order_raw: responseData ?? null,
          printcom_last_attempt_at: new Date().toISOString(),
          printcom_last_error: errorMsg,
        })
        .eq("id", job.id)
        .eq("printcom_submission_lock_token", lockToken);
      return json({
        success: false,
        error: errorMsg,
        response: responseData,
        uncertain: true,
      }, 502);
    }

    const { data: finalJob, error: finalUpdateError } = await serviceClient
      .from("pod2_fulfillment_jobs")
      .update({
        status: "submitted",
        submitted_by_master_at: new Date().toISOString(),
        submitted_by_master_user_id: user.id,
        provider_job_ref: printcomOrderNumber || supplierOrderReference,
        printcom_order_id: supplierOrderReference,
        printcom_order_raw: responseData ?? null,
        printcom_submission_step: "submit",
        printcom_last_attempt_at: new Date().toISOString(),
        printcom_last_error: null,
        printcom_submission_lock_token: null,
        printcom_submission_locked_at: null,
        printcom_validation_fingerprint: null,
        printcom_validation_payment_method: null,
        printcom_validated_at: null,
        printcom_validated_by_user_id: null,
      })
      .eq("id", job.id)
      .eq("printcom_submission_lock_token", lockToken)
      .select("*")
      .maybeSingle();

    if (finalUpdateError || !finalJob) {
      return json({
        success: false,
        error:
          "Print.com returned an order, but the local supplier reference could not be stored. Manual reconciliation is required.",
        response: responseData,
        uncertain: true,
      }, 502);
    }

    return json({
      success: true,
      job: finalJob,
      payload: orderPayload,
      response: responseData,
      warnings: optionWarnings,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pod2-order-submit fatal:", msg);
    return json({ error: msg }, 500);
  }
});
