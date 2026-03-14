import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const ROOT_DOMAIN = Deno.env.get("ROOT_DOMAIN") || Deno.env.get("VITE_ROOT_DOMAIN") || "webprinter.dk";
const FALLBACK_OVERVIEW_ID = "__default_overview__";
const FALLBACK_OVERVIEW_NAME = "Produkter";

type TenantRow = {
  id: string;
  name: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  name: string;
  icon_text: string | null;
  image_url: string | null;
  description: string | null;
  slug: string;
  category: string | null;
  technical_specs: Record<string, unknown> | null;
  pricing_type: string | null;
  default_variant: string | null;
  default_quantity: number | null;
  banner_config: Record<string, unknown> | null;
  tooltip_product: string | null;
  tooltip_price: string | null;
};

type ProductOverviewRecord = {
  id: string;
  name: string;
  slug: string;
  sort_order?: number | null;
};

type ProductCategoryRecord = {
  id?: string;
  name: string;
  slug: string;
  sort_order?: number | null;
  overview_id?: string | null;
  parent_category_id?: string | null;
  navigation_mode?: "all_in_one" | "submenu" | null;
  frontend_product_id?: string | null;
};

type EnrichedProduct = ProductRow & {
  categoryKey: string;
  categoryLabel: string;
  categoryId: string | null;
  categoryOverviewId: string | null;
  categoryParentId: string | null;
  categoryNavigationMode: "all_in_one" | "submenu" | null;
  isCategoryLanding: boolean;
};

type RequestInput = {
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
  overview?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeHostname(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function normalizeKey(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toLooseKey(value?: string | null): string {
  return normalizeKey(value).replace(/-/g, "");
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

function isMissingProductOverviewsTable(error: unknown): boolean {
  const anyError = error as Record<string, unknown> | null;
  const code = String(anyError?.code || "");
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("product_overviews") || details.includes("product_overviews");
}

function isMissingCategoryHierarchyColumns(error: unknown): boolean {
  const anyError = error as Record<string, unknown> | null;
  const code = String(anyError?.code || "");
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  return code === "42703" || code === "PGRST204" || message.includes("parent_category_id") || message.includes("navigation_mode") || details.includes("parent_category_id") || details.includes("navigation_mode");
}

function isMissingFrontendCategoryColumns(error: unknown): boolean {
  const anyError = error as Record<string, unknown> | null;
  const code = String(anyError?.code || "");
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  return code === "42703" || code === "PGRST204" || message.includes("frontend_product_id") || details.includes("frontend_product_id");
}

function buildFallbackOverview(): ProductOverviewRecord {
  return {
    id: FALLBACK_OVERVIEW_ID,
    name: FALLBACK_OVERVIEW_NAME,
    slug: normalizeKey(FALLBACK_OVERVIEW_NAME),
    sort_order: 0,
  };
}

function buildCategoryLookup(categories: ProductCategoryRecord[]) {
  const byKey = new Map<string, ProductCategoryRecord>();
  categories.forEach((category) => {
    [
      normalizeKey(category.slug),
      normalizeKey(category.name),
      toLooseKey(category.slug),
      toLooseKey(category.name),
    ].filter(Boolean).forEach((key) => {
      if (!byKey.has(key)) {
        byKey.set(key, category);
      }
    });
  });
  return byKey;
}

function toDisplayLabel(value?: string | null): string {
  const source = String(value || "").trim();
  if (!source) return "Ukategoriseret";
  if (source.includes(" ") || /[A-ZÆØÅ]/.test(source) || source === source.toUpperCase()) {
    return source;
  }
  return source
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveProductCategory(value: string | null | undefined, categories: ProductCategoryRecord[]) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return {
      key: "uncategorized",
      label: "Ukategoriseret",
      id: null,
      overviewId: null,
      parentCategoryId: null,
      navigationMode: null,
    };
  }

  const lookup = buildCategoryLookup(categories);
  const normalizedKey = normalizeKey(rawValue);
  const looseKey = toLooseKey(rawValue);
  const matched = lookup.get(normalizedKey) || lookup.get(looseKey);

  if (matched) {
    return {
      key: normalizeKey(matched.slug || matched.name),
      label: matched.name || toDisplayLabel(rawValue),
      id: matched.id ?? null,
      overviewId: matched.overview_id ?? null,
      parentCategoryId: matched.parent_category_id ?? null,
      navigationMode: matched.navigation_mode ?? null,
    };
  }

  return {
    key: normalizedKey || looseKey || "uncategorized",
    label: toDisplayLabel(rawValue),
    id: null,
    overviewId: null,
    parentCategoryId: null,
    navigationMode: null,
  };
}

function readCategoryLandingEnabled(technicalSpecs: Record<string, unknown> | null | undefined): boolean {
  const raw = technicalSpecs?.category_landing;
  return typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).enabled === true;
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
    overview: String(body.overview || url.searchParams.get("overview") || ""),
    category: String(body.category || url.searchParams.get("category") || ""),
    subcategory: String(body.subcategory || url.searchParams.get("subcategory") || ""),
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

function enrichProducts(products: ProductRow[], categories: ProductCategoryRecord[]): EnrichedProduct[] {
  return products.map((product) => {
    const resolvedCategory = resolveProductCategory(product.category, categories);
    return {
      ...product,
      category: product.category || resolvedCategory.label,
      categoryKey: resolvedCategory.key,
      categoryLabel: resolvedCategory.label,
      categoryId: resolvedCategory.id,
      categoryOverviewId: resolvedCategory.overviewId,
      categoryParentId: resolvedCategory.parentCategoryId,
      categoryNavigationMode: resolvedCategory.navigationMode,
      isCategoryLanding: readCategoryLandingEnabled(product.technical_specs),
    };
  });
}

function filterProducts(
  products: EnrichedProduct[],
  categories: ProductCategoryRecord[],
  overviews: ProductOverviewRecord[],
  input: Required<RequestInput>,
) {
  const normalizedOverview = normalizeKey(input.overview);
  const normalizedCategory = normalizeKey(input.category);
  const normalizedSubcategory = normalizeKey(input.subcategory);

  const matchedOverview = normalizedOverview
    ? overviews.find((overview) => normalizeKey(overview.slug || overview.name) === normalizedOverview) || null
    : null;

  const matchedCategory = normalizedCategory
    ? categories.find((category) => !category.parent_category_id && normalizeKey(category.slug || category.name) === normalizedCategory) || null
    : null;

  const matchedSubcategory = normalizedSubcategory
    ? categories.find((category) => normalizeKey(category.slug || category.name) === normalizedSubcategory) || null
    : null;

  const descendantIds = new Set<string>();
  if (matchedCategory?.id) {
    descendantIds.add(matchedCategory.id);
    categories.forEach((category) => {
      if (category.parent_category_id === matchedCategory.id && category.id) {
        descendantIds.add(category.id);
      }
    });
  }

  const filteredProducts = products.filter((product) => {
    if (matchedOverview && product.categoryOverviewId !== matchedOverview.id) return false;
    if (matchedSubcategory?.id) return product.categoryId === matchedSubcategory.id;
    if (descendantIds.size > 0) return Boolean(product.categoryId && descendantIds.has(product.categoryId));
    return true;
  });

  return {
    matchedOverview,
    matchedCategory,
    matchedSubcategory,
    filteredProducts,
    listingProducts: filteredProducts.filter((product) => !product.isCategoryLanding),
  };
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

    const [productsResponse, hierarchyCategoriesResponse, fallbackCategoriesResponse, overviewsResponse] = await Promise.all([
      serviceClient
        .from("products")
        .select("id, name, icon_text, image_url, description, slug, category, technical_specs, pricing_type, default_variant, default_quantity, banner_config, tooltip_product, tooltip_price")
        .eq("is_published", true)
        .eq("tenant_id", tenant.id)
        .order("name"),
      serviceClient
        .from("product_categories")
        .select("id, name, slug, sort_order, overview_id, parent_category_id, navigation_mode, frontend_product_id")
        .eq("tenant_id", tenant.id)
        .order("sort_order"),
      serviceClient
        .from("product_categories")
        .select("id, name, slug, sort_order, overview_id")
        .eq("tenant_id", tenant.id)
        .order("sort_order"),
      serviceClient
        .from("product_overviews")
        .select("id, name, slug, sort_order")
        .eq("tenant_id", tenant.id)
        .order("sort_order"),
    ]);

    if (productsResponse.error) throw productsResponse.error;

    let categoryRows: ProductCategoryRecord[] = [];
    if (!hierarchyCategoriesResponse.error) {
      categoryRows = ((hierarchyCategoriesResponse.data as ProductCategoryRecord[]) || []).map((row) => ({
        ...row,
        navigation_mode: row.navigation_mode || "all_in_one",
      }));
    } else if (
      isMissingCategoryHierarchyColumns(hierarchyCategoriesResponse.error)
      || isMissingFrontendCategoryColumns(hierarchyCategoriesResponse.error)
    ) {
      categoryRows = ((fallbackCategoriesResponse.error ? [] : fallbackCategoriesResponse.data) || []) as ProductCategoryRecord[];
    } else {
      throw hierarchyCategoriesResponse.error;
    }

    const overviewRows = overviewsResponse.error
      ? (isMissingProductOverviewsTable(overviewsResponse.error) ? [buildFallbackOverview()] : (() => { throw overviewsResponse.error; })())
      : ((((overviewsResponse.data as ProductOverviewRecord[]) || []).length > 0)
          ? ((overviewsResponse.data as ProductOverviewRecord[]) || [])
          : [buildFallbackOverview()]);

    const enrichedProducts = enrichProducts(((productsResponse.data as ProductRow[]) || []), categoryRows);
    const filtered = filterProducts(enrichedProducts, categoryRows, overviewRows, input);

    return jsonResponse(200, {
      success: true,
      source: resolution.source,
      request: {
        hostname: input.hostname || null,
        pathname: input.pathname || null,
        tenantId: input.tenantId || input.tenant_id || null,
        forceDomain: input.force_domain || null,
        overview: input.overview || null,
        category: input.category || null,
        subcategory: input.subcategory || null,
        rootDomain: ROOT_DOMAIN,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        isMasterTenant: tenant.id === MASTER_TENANT_ID,
      },
      overviews: overviewRows,
      categories: categoryRows,
      filters: {
        matchedOverview: filtered.matchedOverview,
        matchedCategory: filtered.matchedCategory,
        matchedSubcategory: filtered.matchedSubcategory,
      },
      products: enrichedProducts,
      filteredProducts: filtered.filteredProducts,
      listingProducts: filtered.listingProducts,
    });
  } catch (error) {
    console.error("catalog-read error:", error);
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
