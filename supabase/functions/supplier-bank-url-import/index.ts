import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/http.ts";
import { extractSupplierProductHtml, type ExtractedPriceCandidate } from "./extractor.ts";

const OPERATOR_ROLE_MAP: Record<string, "admin" | "master_admin"> = {
  "admin@webprinter.dk": "master_admin",
  "info@webprinter.dk": "master_admin",
  "result-admin@webprinter.dk": "admin",
  "online-trukserre@gmail.com": "admin",
};

const MAX_HTML_BYTES = 4_000_000;
const REQUEST_TIMEOUT_MS = 25_000;
const EUR_TO_DKK = 7.6;
const LOW_PRICE_MARKUP = 1.7;
const HIGH_PRICE_MARKUP = 1.6;
const HIGH_PRICE_THRESHOLD_DKK = 3_000;
const INTERNAL_HOSTS = new Set([
  "webprinter.dk",
  "www.webprinter.dk",
  "salgsmapper.dk",
  "www.salgsmapper.dk",
  "onlinetryksager.dk",
  "www.onlinetryksager.dk",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

type ProductFamily =
  | "flyers"
  | "folders"
  | "sales_folders"
  | "business_cards"
  | "posters"
  | "banners"
  | "signs"
  | "rollups"
  | "stickers"
  | "labels"
  | "books"
  | "letterheads"
  | "tshirts"
  | "packaging"
  | "other";

const PRODUCT_FAMILIES = new Set<ProductFamily>([
  "flyers", "folders", "sales_folders", "business_cards", "posters", "banners",
  "signs", "rollups", "stickers", "labels", "books", "letterheads", "tshirts",
  "packaging", "other",
]);

const normalizeText = (value: unknown, max = 500) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const slugify = (value: unknown) => normalizeText(value, 160)
  .toLowerCase()
  .replace(/æ/g, "ae")
  .replace(/ø/g, "oe")
  .replace(/å/g, "aa")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 96);

const hostMatches = (candidate: string, supplierHost: string) =>
  candidate === supplierHost || candidate.endsWith(`.${supplierHost}`);

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const parseFamily = (value: unknown): ProductFamily => {
  const family = normalizeText(value, 40) as ProductFamily;
  return PRODUCT_FAMILIES.has(family) ? family : "other";
};

const parseSupplierHost = (websiteUrl: unknown) => {
  try {
    return new URL(String(websiteUrl || "")).hostname.toLowerCase();
  } catch {
    return null;
  }
};

async function requireMasterAdmin(req: Request, serviceClient: any) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const { data: roles, error } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);

  if (error) {
    return { ok: false as const, response: jsonResponse({ error: "Kunne ikke kontrollere adminrollen." }, 500) };
  }

  const roleNames = (roles || []).map((entry: any) => entry.role);
  const operatorRole = OPERATOR_ROLE_MAP[String(auth.user.email || "").toLowerCase()] || null;
  if (!roleNames.includes("master_admin") && operatorRole !== "master_admin") {
    return { ok: false as const, response: jsonResponse({ error: "Master-admin adgang er påkrævet." }, 403) };
  }

  return { ok: true as const, user: auth.user };
}

function convertPrice(row: ExtractedPriceCandidate, supplierSlug: string, sourceUrl: string, family: ProductFamily, variant: string) {
  const convertedPriceDkk = Math.round(row.supplierPrice * EUR_TO_DKK * 100) / 100;
  const markup = convertedPriceDkk > HIGH_PRICE_THRESHOLD_DKK ? HIGH_PRICE_MARKUP : LOW_PRICE_MARKUP;
  const proposedPriceDkk = Math.max(1, Math.round(convertedPriceDkk * markup));
  return {
    schemaVersion: 1,
    target: "matrix-layout-v1",
    supplier: supplierSlug,
    sourceType: "supplier_url",
    sourceUrl,
    productFamily: family,
    importerKey: "supplier-url-import-v1",
    sourceKey: `${variant}:${row.quantity}`,
    extractedAt: new Date().toISOString(),
    quantity: row.quantity,
    supplierCurrency: row.currency,
    supplierPrice: row.supplierPrice,
    convertedPriceDkk,
    finalPriceDkk: proposedPriceDkk,
    proposedPriceDkk,
    conversionRuleKey: "eur-dkk-threshold-markup-v1",
    selections: { variant },
    labels: { variant },
    sourceIdentifiers: { extractionSource: row.source },
    metadata: { extractionSource: row.source, requiresReview: true },
  };
}

function normalizePriceRows(prices: ExtractedPriceCandidate[], supplierSlug: string, sourceUrl: string, family: ProductFamily) {
  const quantityCounts = new Map<number, number>();
  prices.forEach((row) => quantityCounts.set(row.quantity, (quantityCounts.get(row.quantity) || 0) + 1));
  const seenForQuantity = new Map<number, number>();

  return prices.map((row) => {
    const position = (seenForQuantity.get(row.quantity) || 0) + 1;
    seenForQuantity.set(row.quantity, position);
    const variant = (quantityCounts.get(row.quantity) || 0) > 1 ? `Prisvalg ${position}` : "Standard";
    return convertPrice(row, supplierSlug, sourceUrl, family, variant);
  });
}

function summarizeRows(rows: any[]) {
  const quantities = rows.map((row) => Number(row.quantity)).filter((value) => Number.isFinite(value));
  const prices = rows.map((row) => Number(row.proposedPriceDkk)).filter((value) => Number.isFinite(value));
  return {
    rows: rows.length,
    quantityMin: quantities.length ? Math.min(...quantities) : null,
    quantityMax: quantities.length ? Math.max(...quantities) : null,
    priceMinDkk: prices.length ? Math.min(...prices) : null,
    priceMaxDkk: prices.length ? Math.max(...prices) : null,
  };
}

async function fetchSupplierPage(sourceUrl: URL, supplierHost: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "da,en;q=0.8,de;q=0.7",
        "User-Agent": "Webprinter-SupplierBank/1.0 (+https://www.webprinter.dk)",
      },
    });
    if (!response.ok) throw new Error(`Leverandørsiden svarede med HTTP ${response.status}.`);
    const finalUrl = new URL(response.url);
    if (!hostMatches(finalUrl.hostname.toLowerCase(), supplierHost)) {
      throw new Error("Leverandørsiden viderestillede til et ikke-godkendt domæne.");
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("URL'en returnerede ikke en HTML-produktside.");
    }
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { html, finalUrl: finalUrl.toString() };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const auth = await requireMasterAdmin(req, serviceClient);
  if (!auth.ok) return auth.response;

  let scrapeRunId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "save" ? "save" : "preview";
    const rawUrl = normalizeText(body?.url, 2_000);
    const nameDaInput = normalizeText(body?.nameDa, 180);
    const note = normalizeText(body?.note, 1_000);
    const productFamily = parseFamily(body?.productFamily);

    let sourceUrl: URL;
    try {
      sourceUrl = new URL(rawUrl);
    } catch {
      return jsonResponse({ error: "Indtast en gyldig produkt-URL." }, 400);
    }
    if (!["https:", "http:"].includes(sourceUrl.protocol)) {
      return jsonResponse({ error: "Kun HTTP- og HTTPS-adresser kan bruges." }, 400);
    }
    const sourceHost = sourceUrl.hostname.toLowerCase();
    if (INTERNAL_HOSTS.has(sourceHost)) {
      return jsonResponse({ error: "Webprinters egne domæner kan ikke bruges som leverandørkilde." }, 400);
    }

    const { data: supplierRows, error: supplierError } = await serviceClient
      .from("supplier_bank_suppliers")
      .select("id,name,slug,website_url,currency,integration_type,enabled")
      .eq("enabled", true);
    if (supplierError) throw supplierError;

    const supplier = (supplierRows || []).find((row: any) => {
      const supplierHost = parseSupplierHost(row.website_url);
      return supplierHost && hostMatches(sourceHost, supplierHost);
    });
    if (!supplier) {
      return jsonResponse({
        error: "Domænet er ikke oprettet som en aktiv leverandør i produktbanken.",
        supportedSuppliers: (supplierRows || []).map((row: any) => row.name),
      }, 400);
    }

    const supplierHost = parseSupplierHost(supplier.website_url);
    if (!supplierHost) throw new Error("Leverandørens website-adresse er ugyldig.");
    const fetched = await fetchSupplierPage(sourceUrl, supplierHost);
    const extraction = extractSupplierProductHtml(fetched.html);
    const contentHash = await sha256(fetched.html);
    const urlHash = await sha256(fetched.finalUrl);
    const supplierProductKey = `url-${slugify(sourceUrl.pathname.split("/").filter(Boolean).pop() || "product")}-${urlHash.slice(0, 10)}`;
    const nameOriginal = extraction.title || nameDaInput || sourceUrl.pathname.split("/").filter(Boolean).pop() || "Leverandørprodukt";
    const nameDa = nameDaInput || nameOriginal;
    const normalizedRows = normalizePriceRows(extraction.prices, supplier.slug, fetched.finalUrl, productFamily);
    const pricingSummary = summarizeRows(normalizedRows);
    const variants = Array.from(new Set(normalizedRows.map((row) => row.selections.variant)));
    const normalizedAttributes = normalizedRows.length > 0
      ? [{
        key: "variant",
        labelDa: "Variant",
        labelOriginal: "Variante",
        values: variants.map((variant) => ({ key: slugify(variant), labelDa: variant, labelOriginal: variant })),
      }]
      : [];
    const needsDynamicExtraction = normalizedRows.length === 0;
    const preview = {
      supplier: { id: supplier.id, name: supplier.name, slug: supplier.slug, currency: supplier.currency },
      sourceUrl: fetched.finalUrl,
      supplierProductKey,
      productFamily,
      nameOriginal,
      nameDa,
      descriptionOriginal: extraction.description,
      warnings: extraction.warnings,
      needsDynamicExtraction,
      extractionMode: needsDynamicExtraction ? "playwright_required" : "static_price_rows",
      pricingSummary,
      priceRows: normalizedRows.slice(0, 100),
      totalPriceRows: normalizedRows.length,
    };

    if (action === "preview") return jsonResponse({ ok: true, preview });
    if (body?.confirmDraftWrite !== true) {
      return jsonResponse({ error: "Bankdraft-skrivning kræver udtrykkelig bekræftelse." }, 400);
    }

    const now = new Date().toISOString();
    const { data: scrapeRun, error: scrapeRunError } = await serviceClient
      .from("supplier_bank_scrape_runs")
      .insert({
        supplier_id: supplier.id,
        started_by: auth.user.id,
        mode: "product_extract",
        tool: needsDynamicExtraction ? "playwright" : "static_fetch",
        status: needsDynamicExtraction ? "partial" : "succeeded",
        input: { sourceUrl: fetched.finalUrl, productFamily, nameDa: nameDaInput || null, note: note || null },
        summary: { ...pricingSummary, needsDynamicExtraction, warnings: extraction.warnings },
        started_at: now,
        finished_at: now,
      })
      .select("id")
      .single();
    if (scrapeRunError) throw scrapeRunError;
    scrapeRunId = scrapeRun.id;

    const { data: existingProduct, error: existingError } = await serviceClient
      .from("supplier_bank_products")
      .select("id,status,scrape_status,metadata,normalized_attributes,normalized_pricing_summary,last_price_checked_at")
      .eq("supplier_id", supplier.id)
      .eq("supplier_product_key", supplierProductKey)
      .maybeSingle();
    if (existingError) throw existingError;

    const productPayload = {
      supplier_id: supplier.id,
      latest_scrape_run_id: scrapeRunId,
      supplier_product_key: supplierProductKey,
      source_url: fetched.finalUrl,
      source_hash: contentHash,
      product_family: productFamily,
      name_original: nameOriginal,
      name_da: nameDa,
      description_original: extraction.description,
      description_da: note || extraction.description,
      source_language: supplier.slug === "wir-machen-druck" ? "de" : null,
      target_language: "da",
      normalized_attributes: normalizedRows.length > 0
        ? normalizedAttributes
        : existingProduct?.normalized_attributes || normalizedAttributes,
      normalized_pricing_summary: normalizedRows.length > 0
        ? pricingSummary
        : existingProduct?.normalized_pricing_summary || pricingSummary,
      scrape_status: needsDynamicExtraction
        ? existingProduct?.scrape_status === "fresh" ? "stale" : existingProduct?.scrape_status || "pending"
        : "fresh",
      last_scraped_at: now,
      last_price_checked_at: normalizedRows.length > 0 ? now : existingProduct?.last_price_checked_at || null,
      metadata: {
        ...((existingProduct?.metadata && typeof existingProduct.metadata === "object") ? existingProduct.metadata : {}),
        createdFromUrlImport: true,
        urlImportVersion: 1,
        note: note || null,
        extractionMode: preview.extractionMode,
        warnings: extraction.warnings,
      },
      updated_at: now,
    };

    let bankProduct: any;
    if (existingProduct) {
      const { data, error } = await serviceClient
        .from("supplier_bank_products")
        .update(productPayload)
        .eq("id", existingProduct.id)
        .select("id,status,scrape_status,name_da")
        .single();
      if (error) throw error;
      bankProduct = data;
    } else {
      const { data, error } = await serviceClient
        .from("supplier_bank_products")
        .insert({ ...productPayload, status: "draft" })
        .select("id,status,scrape_status,name_da")
        .single();
      if (error) throw error;
      bankProduct = data;
    }

    let snapshotId: string | null = null;
    if (normalizedRows.length > 0) {
      const supplierPrices = extraction.prices.map((row) => row.supplierPrice);
      const quantities = normalizedRows.map((row) => row.quantity);
      const proposedPrices = normalizedRows.map((row) => row.proposedPriceDkk);
      const { data: snapshot, error: snapshotError } = await serviceClient
        .from("supplier_bank_price_snapshots")
        .insert({
          bank_product_id: bankProduct.id,
          supplier_id: supplier.id,
          scrape_run_id: scrapeRunId,
          currency: supplier.currency || "EUR",
          conversion_rule_key: "eur-dkk-threshold-markup-v1",
          raw_price_rows: extraction.prices,
          normalized_price_rows: normalizedRows,
          price_min_dkk: proposedPrices.length ? Math.min(...proposedPrices) : null,
          price_max_dkk: proposedPrices.length ? Math.max(...proposedPrices) : null,
          quantity_min: quantities.length ? Math.min(...quantities) : null,
          quantity_max: quantities.length ? Math.max(...quantities) : null,
          checksum: await sha256(JSON.stringify(normalizedRows)),
          metadata: { sourceUrl: fetched.finalUrl, supplierPriceMin: Math.min(...supplierPrices), supplierPriceMax: Math.max(...supplierPrices), requiresReview: true },
        })
        .select("id")
        .single();
      if (snapshotError) throw snapshotError;
      snapshotId = snapshot.id;
    }

    let refreshQueued = false;
    if (needsDynamicExtraction) {
      const { error: refreshError } = await serviceClient
        .from("supplier_bank_refresh_jobs")
        .insert({
          supplier_id: supplier.id,
          bank_product_id: bankProduct.id,
          mode: "product_extract",
          tool: "playwright",
          status: "queued",
          requested_by: auth.user.id,
          request_summary: {
            sourceUrl: fetched.finalUrl,
            requestedFrom: "supplier_url_import",
            reason: "dynamic_configurator_prices",
            productFamily,
          },
        });
      refreshQueued = !refreshError;
      if (refreshError) extraction.warnings.push(`Dynamisk udtræk kunne ikke sættes i kø: ${refreshError.message}`);
    }

    return jsonResponse({
      ok: true,
      preview,
      saved: {
        bankProductId: bankProduct.id,
        scrapeRunId,
        snapshotId,
        refreshQueued,
        status: bankProduct.status,
        scrapeStatus: bankProduct.scrape_status,
      },
    });
  } catch (error) {
    if (scrapeRunId) {
      await serviceClient
        .from("supplier_bank_scrape_runs")
        .update({ status: "failed", error: error instanceof Error ? error.message : String(error), finished_at: new Date().toISOString() })
        .eq("id", scrapeRunId);
    }
    console.error("[supplier-bank-url-import]", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "URL-importen fejlede." }, 500);
  }
});
