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
};

type ProductRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  pricing_type: string | null;
  pricing_structure: unknown;
  is_published: boolean | null;
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
  formatId?: string | null;
  materialId?: string | null;
  verticalValueId?: string | null;
  variantKey?: string | null;
  quantity?: number | null;
  variantValueIds?: string[] | null;
  variantDisplayLabels?: string[] | null;
  selectedSectionValues?: Record<string, string | null> | null;
};

type SelectorSectionConfig = {
  id: string;
  sectionType: string;
  groupId: string;
  valueIds: string[];
};

type AttributeValue = {
  id: string;
  name?: string | null;
};

type AttributeGroup = {
  id: string;
  name?: string | null;
  values?: AttributeValue[] | null;
};

type PreparedPriceRow = {
  id: string | null;
  quantity: number;
  price_dkk: number;
  variant_name: string | null;
  variant_value: string | null;
  extra_data: Record<string, unknown>;
  verticalIds: string[];
  selectionMapFormat: string | null;
  selectionMapMaterial: string | null;
  selectionMapVariantValueIds: string[];
  selectionMapVariantSortedKey: string;
  variantNameLooseNorm: string;
  variantNameNorm: string;
};

const RESERVED_SELECTION_MAP_KEYS = new Set([
  "format",
  "material",
  "variant",
  "variantvalueids",
  "formatid",
  "materialid",
]);

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

function normalizeIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort();
}

function normalizeVariantKey(value?: string | null): string {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

function normalizeLooseText(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " og ")
    .replace(/\buv[\s-]*varnish\b/g, "uv lak")
    .replace(/\buv[\s-]*lak\b/g, "uv lak")
    .replace(/\bgloss(?:y)?\b/g, "glans")
    .replace(/\bmatte\b/g, "matt")
    .replace(/\bmat\b/g, "matt")
    .replace(/\b(?:cashiering|cachering|kachering|kachering|kashering|kasjering)\b/g, "kashering")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function normalizeLooseVariantKey(value?: string | null): string {
  return String(value || "")
    .split("|")
    .map((part) => normalizeLooseText(part))
    .filter(Boolean)
    .sort()
    .join("|");
}

function collectSelectionMapVariantIds(selectionMap: unknown): string[] {
  if (!isObjectRecord(selectionMap)) return [];

  const rawValues = [
    ...(Array.isArray(selectionMap.variantValueIds) ? selectionMap.variantValueIds : []),
    ...Object.entries(selectionMap).flatMap(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (RESERVED_SELECTION_MAP_KEYS.has(normalizedKey)) return [];
      if (Array.isArray(value)) return value.map((entry) => String(entry));
      if (typeof value === "string" || typeof value === "number") return [String(value)];
      return [];
    }),
  ]
    .map((value) => String(value).trim())
    .filter(Boolean);

  return normalizeIds(rawValues);
}

function collectLegacyVariantIds(extra: Record<string, unknown>): string[] {
  return normalizeIds([
    extra.printModeId,
    extra.uvLakId,
    extra.kacheringId,
    extra.glossCachingId,
    extra.surfaceId,
    extra.foldId,
    extra.pagesId,
    extra.orientationId,
  ]
    .filter(Boolean)
    .map((value) => String(value)));
}

function preparePriceRow(row: Record<string, unknown>): PreparedPriceRow {
  const extra = isObjectRecord(row.extra_data) ? row.extra_data : {};
  const selectionMap = isObjectRecord(extra.selectionMap) ? extra.selectionMap : {};
  const variantIds = normalizeIds([
    ...collectSelectionMapVariantIds(selectionMap),
    ...collectLegacyVariantIds(extra),
  ]);

  return {
    id: typeof row.id === "string" ? row.id : null,
    quantity: Number(row.quantity || 0),
    price_dkk: Number(row.price_dkk || 0),
    variant_name: typeof row.variant_name === "string" ? row.variant_name : null,
    variant_value: typeof row.variant_value === "string" ? row.variant_value : null,
    extra_data: extra,
    verticalIds: Array.from(new Set(
      [row.variant_value, extra.verticalAxisValueId, extra.formatId, extra.materialId]
        .filter(Boolean)
        .map((value) => String(value))
    )),
    selectionMapFormat: typeof selectionMap.format === "string"
      ? selectionMap.format
      : typeof extra.formatId === "string"
        ? extra.formatId
        : null,
    selectionMapMaterial: typeof selectionMap.material === "string"
      ? selectionMap.material
      : typeof extra.materialId === "string"
        ? extra.materialId
        : null,
    selectionMapVariantValueIds: variantIds,
    selectionMapVariantSortedKey: variantIds.join("|"),
    variantNameLooseNorm: normalizeLooseVariantKey(typeof row.variant_name === "string" ? row.variant_name : null),
    variantNameNorm: normalizeVariantKey(typeof row.variant_name === "string" ? row.variant_name : null),
  };
}

function getEffectiveRequestedVariantIds(
  row: PreparedPriceRow,
  requestedVariantIds: string[],
  requestedFormatId: string | null,
  requestedMaterialId: string | null,
): string[] {
  let effective = [...requestedVariantIds];

  if (row.selectionMapFormat && requestedFormatId) {
    effective = effective.filter((valueId) => valueId !== requestedFormatId);
  }

  if (row.selectionMapMaterial && requestedMaterialId) {
    effective = effective.filter((valueId) => valueId !== requestedMaterialId);
  }

  return normalizeIds(effective);
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
    formatId: String(body.formatId || url.searchParams.get("formatId") || ""),
    materialId: String(body.materialId || url.searchParams.get("materialId") || ""),
    verticalValueId: String(body.verticalValueId || url.searchParams.get("verticalValueId") || ""),
    variantKey: String(body.variantKey || url.searchParams.get("variantKey") || ""),
    quantity: Number(body.quantity ?? url.searchParams.get("quantity") ?? 0) || 0,
    variantValueIds: Array.isArray(body.variantValueIds)
      ? body.variantValueIds.map((value) => String(value))
      : url.searchParams.getAll("variantValueId"),
    variantDisplayLabels: Array.isArray(body.variantDisplayLabels)
      ? body.variantDisplayLabels.map((value) => String(value))
      : [],
    selectedSectionValues: isObjectRecord(body.selectedSectionValues)
      ? Object.fromEntries(Object.entries(body.selectedSectionValues).map(([key, value]) => [String(key), value == null ? null : String(value)]))
      : {},
  };
}

function buildSelectorSections(pricingStructure: unknown): SelectorSectionConfig[] {
  if (!isObjectRecord(pricingStructure)) return [];
  const verticalAxis = isObjectRecord(pricingStructure.vertical_axis) ? pricingStructure.vertical_axis : null;
  const layoutRows = Array.isArray(pricingStructure.layout_rows) ? pricingStructure.layout_rows : [];

  const sections: SelectorSectionConfig[] = [];

  if (verticalAxis && typeof verticalAxis.sectionId === "string" && typeof verticalAxis.sectionType === "string") {
    sections.push({
      id: verticalAxis.sectionId,
      sectionType: verticalAxis.sectionType,
      groupId: typeof verticalAxis.groupId === "string" ? verticalAxis.groupId : "",
      valueIds: Array.isArray(verticalAxis.valueIds) ? verticalAxis.valueIds.map((value) => String(value)) : [],
    });
  }

  for (const row of layoutRows) {
    if (!isObjectRecord(row) || !Array.isArray(row.columns)) continue;
    for (const col of row.columns) {
      if (!isObjectRecord(col)) continue;
      const uiMode = String(col.ui_mode || col.uiMode || "");
      if (uiMode === "hidden" || col.hidden === true) continue;
      if (typeof col.id !== "string" || typeof col.sectionType !== "string") continue;
      sections.push({
        id: col.id,
        sectionType: col.sectionType,
        groupId: typeof col.groupId === "string" ? col.groupId : "",
        valueIds: Array.isArray(col.valueIds) ? col.valueIds.map((value) => String(value)) : [],
      });
    }
  }

  return sections;
}

function getSectionValueIdForPreparedRow(section: SelectorSectionConfig, row: PreparedPriceRow): string | null {
  const extra = isObjectRecord(row.extra_data) ? row.extra_data : {};
  const selectionMap = isObjectRecord(extra.selectionMap) ? extra.selectionMap : {};
  const sectionValueIds = Array.isArray(section.valueIds) ? section.valueIds.map((value) => String(value)) : [];

  if (section.sectionType === "formats") {
    return row.selectionMapFormat || (typeof extra.formatId === "string" ? extra.formatId : null) || null;
  }

  if (section.sectionType === "materials") {
    return row.selectionMapMaterial || (typeof extra.materialId === "string" ? extra.materialId : null) || row.variant_value || null;
  }

  const variantValueIds = normalizeIds([
    ...collectSelectionMapVariantIds(selectionMap),
    ...(Array.isArray(extra.variantValueIds) ? extra.variantValueIds.map((value) => String(value)) : []),
    ...collectLegacyVariantIds(extra),
  ]);

  const matched = sectionValueIds.find((valueId) => variantValueIds.includes(String(valueId)));
  if (matched) return matched;

  const directLegacyId = collectLegacyVariantIds(extra).find((valueId) => sectionValueIds.includes(String(valueId)));
  if (directLegacyId) return directLegacyId;

  return null;
}

function getSectionValueIdForPreparedRowWithAttributes(
  section: SelectorSectionConfig,
  row: PreparedPriceRow,
  attributeGroups: AttributeGroup[],
): string | null {
  const baseValueId = getSectionValueIdForPreparedRow(section, row);
  if (baseValueId) return baseValueId;

  const extra = isObjectRecord(row.extra_data) ? row.extra_data : {};
  const groupName = String(attributeGroups.find((group) => group.id === section.groupId)?.name || "").toLowerCase();

  if (groupName === "papirfinish" || groupName.includes("papirfinish")) {
    return typeof extra.surfaceId === "string" ? extra.surfaceId : null;
  }
  if (groupName === "foldetype" || groupName.includes("foldetype")) {
    return typeof extra.foldId === "string" ? extra.foldId : null;
  }
  if (groupName === "sider" || groupName.includes("sider")) {
    return typeof extra.pagesId === "string" ? extra.pagesId : null;
  }
  if (groupName === "retning" || groupName.includes("retning")) {
    return typeof extra.orientationId === "string" ? extra.orientationId : null;
  }
  if (groupName.includes("uv-lak") || groupName.includes("uv lak")) {
    return typeof extra.uvLakId === "string" ? extra.uvLakId : null;
  }
  if (groupName.includes("gloss") && (groupName.includes("cach") || groupName.includes("kasher") || groupName.includes("kacher"))) {
    return typeof extra.glossCachingId === "string" ? extra.glossCachingId : null;
  }
  if (groupName.includes("kacher") || groupName.includes("kasher")) {
    return typeof extra.kacheringId === "string" ? extra.kacheringId : null;
  }

  if (section.valueIds?.length) {
    const groupValues = attributeGroups.find((group) => group.id === section.groupId)?.values || [];
    const rowText = normalizeLooseText([
      row.variant_name,
      row.variant_value,
      JSON.stringify(extra || {}),
    ].filter(Boolean).join(" | "));

    if (rowText) {
      const matchedByName = section.valueIds
        .map((valueId) => ({
          valueId,
          label: String(groupValues.find((value) => value.id === valueId)?.name || ""),
        }))
        .filter((entry) => !!entry.label)
        .sort((a, b) => b.label.length - a.label.length)
        .find((entry) => {
          const candidate = normalizeLooseText(entry.label);
          return candidate.length >= 4 && rowText.includes(candidate);
        });

      if (matchedByName) return matchedByName.valueId;
    }
  }

  return null;
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
    .select("id, name, domain")
    .eq("id", id)
    .maybeSingle();
  return (data as TenantRow | null) ?? null;
}

async function findTenantByDomain(serviceClient: ReturnType<typeof createClient>, domain: string | null | undefined): Promise<TenantRow | null> {
  const variants = getDomainVariants(domain);
  if (!variants.length) return null;
  const { data } = await serviceClient
    .from("tenants")
    .select("id, name, domain")
    .in("domain", variants)
    .limit(1)
    .maybeSingle();
  if (data) return data as TenantRow;

  const normalized = variants[0].replace(/^www\./, "");
  if (normalized && normalized.endsWith(`.${ROOT_DOMAIN}`)) {
    const { data: byConstructedDomain } = await serviceClient
      .from("tenants")
      .select("id, name, domain")
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
  const productSelect = "id, tenant_id, name, slug, pricing_type, pricing_structure, is_published";
  const lookupBy = isUuid(identifier.productId) ? { field: "id", value: identifier.productId } : { field: "slug", value: identifier.slug };
  if (!lookupBy.value) return { product: null, source: "missing_identifier" };

  const { data: tenantRows, error: tenantError } = await serviceClient
    .from("products")
    .select(productSelect)
    .eq(lookupBy.field, lookupBy.value)
    .eq("tenant_id", tenantId)
    .limit(1);
  if (tenantError) throw tenantError;
  const tenantProduct = ((tenantRows as ProductRow[] | null) || [])[0] || null;
  if (tenantProduct) return { product: tenantProduct, source: "tenant_scoped" };

  if (tenantId !== MASTER_TENANT_ID) {
    const { data: masterRows, error: masterError } = await serviceClient
      .from("products")
      .select(productSelect)
      .eq(lookupBy.field, lookupBy.value)
      .eq("tenant_id", MASTER_TENANT_ID)
      .limit(1);
    if (masterError) throw masterError;
    const masterProduct = ((masterRows as ProductRow[] | null) || [])[0] || null;
    if (masterProduct) return { product: masterProduct, source: "master_fallback" };
  }

  const { data: publishedRows, error: publishedError } = await serviceClient
    .from("products")
    .select(productSelect)
    .eq(lookupBy.field, lookupBy.value)
    .eq("is_published", true)
    .limit(1);
  if (publishedError) throw publishedError;
  const publishedProduct = ((publishedRows as ProductRow[] | null) || [])[0] || null;
  if (publishedProduct) return { product: publishedProduct, source: "published_fallback" };

  return { product: null, source: "not_found" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { success: false, error: "Missing Supabase environment configuration" });
    }

    const url = new URL(req.url);
    const body = await parseRequestBody(req);
    const input = pickRequestInput(req, url, body);
    const identifier = {
      slug: input.slug,
      productId: input.productId || input.product_id,
    };

    if (!identifier.slug && !isUuid(identifier.productId)) {
      return jsonResponse(400, { success: false, error: "slug or productId is required" });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const resolution = await resolveTenant(serviceClient, input);
    const tenant = resolution.tenant;

    if (!tenant) {
      return jsonResponse(404, { success: false, error: "Tenant not found", source: resolution.source });
    }

    const productResolution = await fetchProduct(serviceClient, tenant.id, identifier);
    const product = productResolution.product;
    if (!product) {
      return jsonResponse(404, { success: false, error: "Product not found", source: productResolution.source });
    }

    // Extract DB-level pre-filters from the request. Filtering by material
    // (variant_value) and/or format (variant_name LIKE) dramatically reduces
    // the row count for large products (new-folders has ~10,887 rows).
    // Without filters Supabase returns at most 1000 rows (default), which
    // only covers the lowest quantity levels and causes price misses.
    const filterMaterialId =
      typeof input.materialId === "string" && input.materialId ? input.materialId : null;
    const filterFormatId =
      typeof input.formatId === "string" && input.formatId ? input.formatId : null;

    // deno-lint-ignore no-explicit-any
    let priceQuery: any = serviceClient
      .from("generic_product_prices")
      .select("id, variant_name, variant_value, quantity, price_dkk, extra_data")
      .eq("product_id", product.id)
      .order("quantity", { ascending: true });

    if (filterMaterialId) priceQuery = priceQuery.eq("variant_value", filterMaterialId);
    if (filterFormatId) priceQuery = priceQuery.like("variant_name", `%${filterFormatId}%`);
    // Raise the row cap when at least one filter is active so all quantity
    // tiers are reachable (materialId alone still yields ~2 000 rows).
    if (filterMaterialId || filterFormatId) priceQuery = priceQuery.limit(5000);

    const { data, error } = (await priceQuery) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };
    if (error) throw error;

    const { data: attributeRows, error: attributeError } = await serviceClient
      .from("product_attribute_groups")
      .select("id, name, values:product_attribute_values(id, name)")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true });
    if (attributeError) throw attributeError;

    const preparedRows = (((data as Record<string, unknown>[] | null) || []).map(preparePriceRow));
    const attributeGroups = ((attributeRows as AttributeGroup[] | null) || []).map((group) => ({
      id: String(group.id),
      name: group.name || "",
      values: Array.isArray(group.values)
        ? group.values.map((value) => ({ id: String(value.id), name: value.name || "" }))
        : [],
    }));
    const selectorSections = buildSelectorSections(product.pricing_structure);
    const verticalSectionId = isObjectRecord(product.pricing_structure) && isObjectRecord(product.pricing_structure.vertical_axis)
      ? String(product.pricing_structure.vertical_axis.sectionId || "")
      : "";
    const mappableSectionIds = new Set(
      selectorSections
        .filter((section) =>
          preparedRows.some((row) => !!getSectionValueIdForPreparedRowWithAttributes(section, row, attributeGroups))
        )
        .map((section) => section.id)
    );
    const selectedSectionEntries = Object.entries(input.selectedSectionValues || {})
      .map(([sectionId, valueId]) => ({ sectionId: String(sectionId), valueId: valueId == null ? "" : String(valueId) }))
      .filter((entry) => !!entry.valueId)
      .filter((entry) => entry.sectionId !== verticalSectionId)
      .filter((entry) => mappableSectionIds.has(entry.sectionId));

    const requestedVariantIds = normalizeIds((input.variantValueIds || []).map((value) => String(value)));
    const requestedDisplayKey = normalizeLooseVariantKey((input.variantDisplayLabels || []).join("|"));
    const requestedQuantity = input.quantity > 0 ? input.quantity : null;
    const requestedFormatId = input.formatId || null;
    const requestedMaterialId = input.materialId || null;
    const requestedVerticalValueId = input.verticalValueId || null;
    const requestedVariantKey = input.variantKey || "";
    const requestedVariantKeyNorm = normalizeVariantKey(requestedVariantKey);

    const sectionMatchedRows = selectedSectionEntries.length > 0
      ? preparedRows.filter((row) => {
          if (requestedVerticalValueId && !row.verticalIds.includes(requestedVerticalValueId)) return false;
          if (requestedQuantity && row.quantity !== requestedQuantity) return false;
          if (requestedFormatId && row.selectionMapFormat && row.selectionMapFormat !== requestedFormatId) return false;
          if (requestedMaterialId && row.selectionMapMaterial && row.selectionMapMaterial !== requestedMaterialId) return false;

          return selectedSectionEntries.every(({ sectionId, valueId }) => {
            const section = selectorSections.find((entry) => entry.id === sectionId);
            if (!section) return true;
            return getSectionValueIdForPreparedRowWithAttributes(section, row, attributeGroups) === valueId;
          });
        })
      : [];

    const fallbackMatchedRows = preparedRows.filter((row) => {
      if (requestedVerticalValueId && !row.verticalIds.includes(requestedVerticalValueId)) return false;
      if (requestedFormatId && row.selectionMapFormat && row.selectionMapFormat !== requestedFormatId) return false;
      if (requestedMaterialId && row.selectionMapMaterial && row.selectionMapMaterial !== requestedMaterialId) return false;
      const effectiveRequestedVariantIds = getEffectiveRequestedVariantIds(
        row,
        requestedVariantIds,
        requestedFormatId,
        requestedMaterialId,
      );
      const effectiveRequestedVariantKey = effectiveRequestedVariantIds.join("|");
      const matchesSelectionMap = !effectiveRequestedVariantKey
        || !row.selectionMapVariantSortedKey
        || row.selectionMapVariantSortedKey === effectiveRequestedVariantKey;
      const matchesLegacyDisplayNames = !requestedDisplayKey || row.variantNameLooseNorm === requestedDisplayKey;
      const matchesVariantName = requestedVariantKey === "none"
        ? (row.variant_name === "none" || !row.variant_name)
        : !requestedVariantKey
          || row.variant_name === requestedVariantKey
          || row.variantNameNorm === requestedVariantKeyNorm
          || row.selectionMapVariantSortedKey === requestedVariantKey;
      if (!matchesVariantName && !matchesSelectionMap && !matchesLegacyDisplayNames) return false;
      if (requestedQuantity && row.quantity !== requestedQuantity) return false;
      return true;
    });

    const matchedRows = sectionMatchedRows.length > 0 ? sectionMatchedRows : fallbackMatchedRows;

    const availableQuantities = Array.from(new Set(matchedRows.map((row) => row.quantity))).sort((a, b) => a - b);
    const bestMatch = requestedQuantity
      ? matchedRows.find((row) => row.quantity === requestedQuantity) || null
      : matchedRows[0] || null;

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
        formatId: requestedFormatId,
        materialId: requestedMaterialId,
        verticalValueId: requestedVerticalValueId,
        variantKey: requestedVariantKey || null,
        quantity: requestedQuantity,
        variantValueIds: requestedVariantIds,
        variantDisplayLabels: (input.variantDisplayLabels || []).map((value) => String(value)),
        selectedSectionValues: Object.fromEntries(selectedSectionEntries.map((entry) => [entry.sectionId, entry.valueId])),
        rootDomain: ROOT_DOMAIN,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        isMasterTenant: tenant.id === MASTER_TENANT_ID,
      },
      product: {
        id: product.id,
        tenant_id: product.tenant_id,
        name: product.name,
        slug: product.slug,
        pricing_type: product.pricing_type,
        pricing_structure: product.pricing_structure,
      },
      summary: {
        totalRows: preparedRows.length,
        matchedRows: matchedRows.length,
        availableQuantities,
      },
      bestMatch,
      matchedRows,
    });
  } catch (error) {
    console.error("pricing-read error:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === "object") {
      const e = error as Record<string, unknown>;
      errorMessage = String(e.message || e.details || e.code || JSON.stringify(error));
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    return jsonResponse(500, {
      success: false,
      error: errorMessage,
      errorDetail: error && typeof error === "object" ? error : String(error),
    });
  }
});
