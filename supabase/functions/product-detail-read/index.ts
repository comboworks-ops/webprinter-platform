import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const ROOT_DOMAIN = Deno.env.get("ROOT_DOMAIN") || Deno.env.get("VITE_ROOT_DOMAIN") || "webprinter.dk";

type TenantRow = {
  id: string;
  name: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  about_title: string | null;
  about_description: string | null;
  about_image_url: string | null;
  template_files: unknown;
  technical_specs: Record<string, unknown> | null;
  pricing_structure: unknown;
  pricing_type: string | null;
  banner_config: Record<string, unknown> | null;
  default_variant: string | null;
  default_quantity: number | null;
  tooltip_product: string | null;
  tooltip_price: string | null;
  category: string | null;
  icon_text: string | null;
  is_published: boolean | null;
};

type ProductOptionGroupRow = {
  id: string;
  name: string;
  label: string | null;
  display_type: string | null;
  description: string | null;
};

type ProductOptionRow = {
  id: string;
  group_id: string;
  name: string;
  label: string | null;
  description: string | null;
  icon_url: string | null;
  extra_price: number | null;
  price_mode: string | null;
  sort_order: number | null;
};

type CustomFieldRow = {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  default_value: unknown;
  is_required: boolean | null;
  product_id: string;
};

type RequestInput = {
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
  slug?: string | null;
  productId?: string | null;
  product_id?: string | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized === undefined ? String(error) : serialized;
  } catch {
    return String(error);
  }
}

function normalizeHostname(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function getDomainVariants(value: string | null | undefined): string[] {
  const normalized = normalizeHostname(value);
  if (!normalized) return [];
  const withoutWww = normalized.replace(/^www\./, "");
  return Array.from(new Set([normalized, withoutWww, `www.${withoutWww}`]));
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isPlatformRoot(hostname: string): boolean {
  return hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`;
}

function isUuid(value: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProductInfoV2(technicalSpecs: unknown) {
  if (!isObjectRecord(technicalSpecs)) {
    return { useSections: false, imagePosition: "above", blocks: [] };
  }

  const raw = technicalSpecs.product_page_info_v2;
  if (!isObjectRecord(raw)) {
    return { useSections: false, imagePosition: "above", blocks: [] };
  }

  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks = rawBlocks
    .map((item, index) => {
      if (!isObjectRecord(item)) return null;
      const type = item.type;
      if (type !== "text" && type !== "image" && type !== "gallery") return null;
      return {
        id: typeof item.id === "string" && item.id ? item.id : `block-${index + 1}`,
        type,
        title: typeof item.title === "string" ? item.title : "",
        text: typeof item.text === "string" ? item.text : "",
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
        caption: typeof item.caption === "string" ? item.caption : "",
        images: Array.isArray(item.images)
          ? item.images.filter((url): url is string => typeof url === "string" && url.length > 0)
          : [],
        effect: item.effect === "fade-zoom" || item.effect === "fade-up" ? item.effect : "fade",
        intervalMs: typeof item.intervalMs === "number" && Number.isFinite(item.intervalMs)
          ? Math.max(2000, Math.min(12000, Math.round(item.intervalMs)))
          : 4500,
      };
    })
    .filter(Boolean);

  return {
    useSections: raw.useSections === true,
    imagePosition: raw.imagePosition === "below" ? "below" : "above",
    blocks,
  };
}

function pickRequestInput(req: Request, url: URL, body: RequestInput): Required<RequestInput> {
  const headerHost = normalizeHostname(
    req.headers.get("x-forwarded-host")
    || req.headers.get("host")
    || url.searchParams.get("hostname")
    || body.hostname,
  );

  return {
    hostname: headerHost,
    pathname: String(body.pathname || url.searchParams.get("pathname") || ""),
    tenantId: String(body.tenantId || body.tenant_id || url.searchParams.get("tenantId") || url.searchParams.get("tenant_id") || ""),
    tenant_id: String(body.tenant_id || url.searchParams.get("tenant_id") || ""),
    force_domain: String(body.force_domain || url.searchParams.get("force_domain") || ""),
    slug: String(body.slug || url.searchParams.get("slug") || ""),
    productId: String(body.productId || body.product_id || url.searchParams.get("productId") || url.searchParams.get("product_id") || ""),
    product_id: String(body.product_id || url.searchParams.get("product_id") || ""),
  };
}

async function parseRequestBody(req: Request): Promise<RequestInput> {
  if (req.method === "GET") return {};
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    return (await req.json()) as RequestInput;
  } catch {
    return {};
  }
}

async function findTenantById(serviceClient: ReturnType<typeof createClient>, tenantId: string | null | undefined): Promise<TenantRow | null> {
  const id = String(tenantId || "").trim();
  if (!id) return null;
  const { data } = await serviceClient
    .from("tenants")
    .select("id, name, domain, settings")
    .eq("id", id)
    .maybeSingle();
  return (data as TenantRow | null) ?? null;
}

async function findTenantByDomain(serviceClient: ReturnType<typeof createClient>, domain: string | null | undefined): Promise<TenantRow | null> {
  const variants = getDomainVariants(domain);
  if (!variants.length) return null;
  const { data } = await serviceClient
    .from("tenants")
    .select("id, name, domain, settings")
    .in("domain", variants)
    .limit(1)
    .maybeSingle();
  if (data) return data as TenantRow;

  const normalized = variants[0].replace(/^www\./, "");
  if (normalized && normalized.endsWith(`.${ROOT_DOMAIN}`)) {
    const { data: byConstructedDomain } = await serviceClient
      .from("tenants")
      .select("id, name, domain, settings")
      .eq("domain", normalized)
      .maybeSingle();
    return (byConstructedDomain as TenantRow | null) ?? null;
  }

  return null;
}

async function resolveTenant(serviceClient: ReturnType<typeof createClient>, input: Required<RequestInput>): Promise<{ tenant: TenantRow | null; source: string }> {
  const explicitTenantId = input.tenantId || input.tenant_id;
  if (explicitTenantId) {
    const tenant = await findTenantById(serviceClient, explicitTenantId);
    return { tenant, source: tenant ? "tenant_id" : "tenant_id_missing" };
  }

  if (input.force_domain) {
    const tenant = await findTenantByDomain(serviceClient, input.force_domain);
    return { tenant, source: tenant ? "force_domain" : "force_domain_missing" };
  }

  if (input.hostname && !isLocalhost(input.hostname) && !isPlatformRoot(input.hostname)) {
    const tenant = await findTenantByDomain(serviceClient, input.hostname);
    return { tenant, source: tenant ? "hostname" : "hostname_missing" };
  }

  const masterTenant = await findTenantById(serviceClient, MASTER_TENANT_ID);
  return { tenant: masterTenant, source: "master_fallback" };
}

async function fetchProduct(
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string,
  identifier: { slug: string; productId: string },
): Promise<{ product: ProductRow | null; source: string }> {
  const productSelect = "id, tenant_id, name, slug, description, image_url, about_title, about_description, about_image_url, template_files, technical_specs, pricing_structure, pricing_type, banner_config, default_variant, default_quantity, tooltip_product, tooltip_price, category, icon_text, is_published";

  const lookupBy = isUuid(identifier.productId) ? { field: "id", value: identifier.productId } : { field: "slug", value: identifier.slug };
  if (!lookupBy.value) {
    return { product: null, source: "missing_identifier" };
  }

  const tenantScopedQuery = serviceClient
    .from("products")
    .select(productSelect)
    .eq(lookupBy.field, lookupBy.value)
    .eq("tenant_id", tenantId)
    .limit(1);
  const { data: tenantRows, error: tenantError } = await tenantScopedQuery;
  if (tenantError) throw tenantError;
  const tenantProduct = ((tenantRows as ProductRow[] | null) || [])[0] || null;
  if (tenantProduct) return { product: tenantProduct, source: "tenant_scoped" };

  if (tenantId !== MASTER_TENANT_ID) {
    const masterQuery = serviceClient
      .from("products")
      .select(productSelect)
      .eq(lookupBy.field, lookupBy.value)
      .eq("tenant_id", MASTER_TENANT_ID)
      .limit(1);
    const { data: masterRows, error: masterError } = await masterQuery;
    if (masterError) throw masterError;
    const masterProduct = ((masterRows as ProductRow[] | null) || [])[0] || null;
    if (masterProduct) return { product: masterProduct, source: "master_fallback" };
  }

  const publishedQuery = serviceClient
    .from("products")
    .select(productSelect)
    .eq(lookupBy.field, lookupBy.value)
    .eq("is_published", true)
    .limit(1);
  const { data: publishedRows, error: publishedError } = await publishedQuery;
  if (publishedError) throw publishedError;
  const publishedProduct = ((publishedRows as ProductRow[] | null) || [])[0] || null;
  if (publishedProduct) return { product: publishedProduct, source: "published_fallback" };

  return { product: null, source: "not_found" };
}

async function fetchOptionGroups(serviceClient: ReturnType<typeof createClient>, productId: string) {
  const { data: assignments, error: assignmentError } = await serviceClient
    .from("product_option_group_assignments")
    .select("option_group_id, sort_order")
    .eq("product_id", productId)
    .order("sort_order");

  if (assignmentError) {
    throw new Error(`fetchOptionGroups.assignments: ${assignmentError.message}`);
  }

  const assignmentRows = (assignments as Array<{ option_group_id: string; sort_order: number | null }> | null) || [];
  if (assignmentRows.length === 0) {
    return [];
  }

  const groupIds = assignmentRows.map((row) => row.option_group_id);
  const { data: groups, error: groupsError } = await serviceClient
    .from("product_option_groups")
    .select("id, name, label, display_type, description")
    .in("id", groupIds);
  if (groupsError) {
    throw new Error(`fetchOptionGroups.groups: ${groupsError.message}`);
  }

  const { data: options, error: optionsError } = await serviceClient
    .from("product_options")
    .select("id, group_id, name, label, description, icon_url, extra_price, price_mode, sort_order")
    .in("group_id", groupIds)
    .order("sort_order");
  if (optionsError) {
    throw new Error(`fetchOptionGroups.options: ${optionsError.message}`);
  }

  const optionsByGroupId = new Map<string, ProductOptionRow[]>();
  (((options as ProductOptionRow[] | null) || [])).forEach((option) => {
    const existing = optionsByGroupId.get(option.group_id) || [];
    existing.push(option);
    optionsByGroupId.set(option.group_id, existing);
  });

  return (((groups as ProductOptionGroupRow[] | null) || [])
    .sort((a, b) => {
      const orderA = assignmentRows.find((row) => row.option_group_id === a.id)?.sort_order ?? 0;
      const orderB = assignmentRows.find((row) => row.option_group_id === b.id)?.sort_order ?? 0;
      return orderA - orderB;
    })
    .map((group) => ({
      ...group,
      label: group.label || group.name,
      display_type: group.display_type || "buttons",
      options: (optionsByGroupId.get(group.id) || []).map((option) => ({
        ...option,
        label: option.label || option.name,
        extra_price: option.extra_price || 0,
        price_mode: option.price_mode || "fixed",
      })),
    })));
}

async function fetchCustomFields(serviceClient: ReturnType<typeof createClient>, productId: string) {
  const { data, error } = await serviceClient
    .from("custom_fields")
    .select("id, field_name, field_label, field_type, default_value, is_required, product_id")
    .eq("product_id", productId)
    .order("created_at");
  if (error) {
    throw new Error(`fetchCustomFields: ${error.message}`);
  }
  return ((data as CustomFieldRow[] | null) || []).map((field) => ({
    ...field,
    is_required: field.is_required ?? false,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { error: "Missing Supabase environment configuration" });
    }

    const url = new URL(req.url);
    const body = await parseRequestBody(req);
    const input = pickRequestInput(req, url, body);
    const identifier = {
      slug: input.slug,
      productId: input.productId || input.product_id,
    };

    if (!identifier.slug && !isUuid(identifier.productId)) {
      return jsonResponse(400, {
        success: false,
        error: "slug or productId is required",
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const resolution = await resolveTenant(serviceClient, input);
    const tenant = resolution.tenant;

    if (!tenant) {
      return jsonResponse(404, {
        success: false,
        error: "Tenant not found",
        source: resolution.source,
      });
    }

    const productResolution = await fetchProduct(serviceClient, tenant.id, identifier);
    const product = productResolution.product;
    if (!product) {
      return jsonResponse(404, {
        success: false,
        error: "Product not found",
        source: productResolution.source,
      });
    }

    const relatedReads = await Promise.allSettled([
      fetchOptionGroups(serviceClient, product.id),
      fetchCustomFields(serviceClient, product.id),
    ]);

    const relatedWarnings: string[] = [];
    const optionGroups = relatedReads[0].status === "fulfilled"
      ? relatedReads[0].value
      : (() => {
        const message = relatedReads[0].reason instanceof Error
          ? relatedReads[0].reason.message
          : "fetchOptionGroups failed";
        console.warn("product-detail-read warning:", message);
        relatedWarnings.push(message);
        return [];
      })();

    const customFields = relatedReads[1].status === "fulfilled"
      ? relatedReads[1].value
      : (() => {
        const message = relatedReads[1].reason instanceof Error
          ? relatedReads[1].reason.message
          : "fetchCustomFields failed";
        console.warn("product-detail-read warning:", message);
        relatedWarnings.push(message);
        return [];
      })();

    return jsonResponse(200, {
      success: true,
      source: productResolution.source,
      request: {
        hostname: input.hostname || null,
        pathname: input.pathname || null,
        tenantId: input.tenantId || input.tenant_id || null,
        forceDomain: input.force_domain || null,
        slug: identifier.slug || null,
        productId: identifier.productId || null,
        rootDomain: ROOT_DOMAIN,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        isMasterTenant: tenant.id === MASTER_TENANT_ID,
      },
      product: {
        ...product,
        product_info_v2: readProductInfoV2(product.technical_specs),
      },
      optionGroups,
      customFields,
      warnings: relatedWarnings,
    });
  } catch (error) {
    const errorText = describeUnknownError(error);
    console.error("product-detail-read error:", errorText, error);
    return jsonResponse(500, {
      success: false,
      error: errorText,
    });
  }
});
