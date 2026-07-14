export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const PENDING_DISTRIBUTIONS_QUERY_KEY = [
  "print-production",
  "pending-distributions",
] as const;

export interface DistributionInput {
  productId: string;
  selectedTenantIds: string[];
}

export interface DistributionRequest {
  master_product_id: string;
  tenant_ids: string[];
  delivery_mode: "pod_price_list";
}

export interface DistributionResult {
  copied: number;
  notified: number;
  skipped_existing: number;
}

export interface DistributionShop {
  id: string;
  name: string;
  domain: string | null;
  eligible: boolean;
}

export interface PendingDistribution {
  id: string;
  tenantId: string;
  productId: string;
  createdAt: string;
}

interface QueryError {
  message?: string;
}

export interface DistributionRpcClient {
  rpc: (
    name: "send_product_to_tenants",
    request: DistributionRequest,
  ) => PromiseLike<{ data: unknown; error: QueryError | null }>;
}

export interface DistributionShopClient {
  from: (table: "tenants") => {
    select: (columns: string) => {
      neq: (column: string, value: string) => {
        order: (column: string) => PromiseLike<{
          data: unknown;
          error: QueryError | null;
        }>;
      };
    };
  };
}

interface PendingNotificationQuery {
  eq: (column: string, value: string) => PendingNotificationQuery;
  contains: (column: string, value: Record<string, unknown>) => PendingNotificationQuery;
  order: (
    column: string,
    options?: { ascending: boolean },
  ) => PendingNotificationQuery;
  range: (from: number, to: number) => PromiseLike<{
    data: unknown;
    error: QueryError | null;
  }>;
}

export interface PendingNotificationClient {
  from: (table: "tenant_notifications") => {
    select: (columns: string) => PendingNotificationQuery;
  };
}

interface PendingReadOptions {
  pageSize?: number;
  maxPages?: number;
}

const DEFAULT_PENDING_PAGE_SIZE = 200;
const DEFAULT_PENDING_MAX_PAGES = 5;
const MAX_PENDING_PAGE_SIZE = 500;
const MAX_PENDING_PAGES = 10;

export function buildDistributionRequest(input: DistributionInput): DistributionRequest {
  const tenantIds = [...new Set(
    input.selectedTenantIds
      .map((tenantId) => tenantId.trim())
      .filter((tenantId) => tenantId && tenantId !== MASTER_TENANT_ID),
  )];

  if (!tenantIds.length) {
    throw new Error("Vælg mindst én butik.");
  }

  if (!input.productId.trim()) {
    throw new Error("Vælg et produkt, der skal sendes.");
  }

  return {
    master_product_id: input.productId,
    tenant_ids: tenantIds,
    delivery_mode: "pod_price_list",
  };
}

export function selectAllShops(
  shops: Array<Pick<DistributionShop, "id" | "eligible">>,
): string[] {
  return [...new Set(
    shops
      .filter((shop) => shop.eligible)
      .map((shop) => shop.id.trim())
      .filter((tenantId) => tenantId && tenantId !== MASTER_TENANT_ID),
  )];
}

export function validateDistributionSelection(
  selectedTenantIds: string[],
  latestShops: DistributionShop[],
): DistributionShop[] {
  const tenantIds = [...new Set(selectedTenantIds.map((tenantId) => tenantId.trim()))]
    .filter(Boolean);
  if (!tenantIds.length) {
    throw new Error("Vælg mindst én butik.");
  }

  const shopById = new Map(latestShops.map((shop) => [shop.id, shop]));
  return tenantIds.map((tenantId) => {
    if (tenantId === MASTER_TENANT_ID) {
      throw new Error("Masterbutikken kan ikke vælges til distribution.");
    }

    const shop = shopById.get(tenantId);
    if (!shop) {
      throw new Error("En valgt butik findes ikke længere. Gennemgå valget igen.");
    }
    if (!shop.eligible) {
      throw new Error("En valgt butik er ikke længere klar til automatisk afregning. Gennemgå valget igen.");
    }
    return shop;
  });
}

export async function loadDistributionShops(
  client: DistributionShopClient,
): Promise<DistributionShop[]> {
  const { data, error } = await client
    .from("tenants")
    .select("id, name, domain, pod2_auto_forward")
    .neq("id", MASTER_TENANT_ID)
    .order("name");

  if (error) {
    throw new Error(error.message || "Butikkerne kunne ikke indlæses.");
  }

  if (!Array.isArray(data)) return [];

  return data.flatMap((row) => {
    if (!isRecord(row)) return [];
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name : "";
    if (!id || !name || id === MASTER_TENANT_ID) return [];

    return [{
      id,
      name,
      domain: typeof row.domain === "string" ? row.domain : null,
      eligible: row.pod2_auto_forward === true,
    }];
  });
}

export async function loadPendingDistributions(
  client: PendingNotificationClient,
  productIds: string[],
  options: PendingReadOptions = {},
): Promise<PendingDistribution[]> {
  const requestedProductIds = new Set(
    productIds.map((productId) => productId.trim()).filter(Boolean),
  );
  if (!requestedProductIds.size) return [];

  const pageSize = Math.min(
    Math.max(Math.floor(options.pageSize || DEFAULT_PENDING_PAGE_SIZE), 1),
    MAX_PENDING_PAGE_SIZE,
  );
  const maxPages = Math.min(
    Math.max(Math.floor(options.maxPages || DEFAULT_PENDING_MAX_PAGES), 1),
    MAX_PENDING_PAGES,
  );
  const pendingByPair = new Map<string, PendingDistribution>();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await client
      .from("tenant_notifications")
      .select("id, tenant_id, status, created_at, data")
      .eq("type", "product_update")
      .eq("status", "pending")
      .contains("data", { delivery_mode: "pod_price_list" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message || "Afventende distributioner kunne ikke indlæses.");
    }

    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const pending = normalizePendingDistribution(row, requestedProductIds);
      if (!pending) continue;

      const pairKey = `${pending.productId}:${pending.tenantId}`;
      const existing = pendingByPair.get(pairKey);
      if (!existing || toTimestamp(pending.createdAt) > toTimestamp(existing.createdAt)) {
        pendingByPair.set(pairKey, pending);
      }
    }

    if (rows.length < pageSize) break;
  }

  return [...pendingByPair.values()].sort((left, right) => (
    toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
  ));
}

export async function distributeProduct(
  client: DistributionRpcClient,
  input: DistributionInput,
): Promise<DistributionResult> {
  const request = buildDistributionRequest(input);
  const { data, error } = await client.rpc("send_product_to_tenants", request);

  if (error) {
    throw new Error(error.message || "Produktet kunne ikke sendes til butikkerne.");
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (isRecord(result) && typeof result.error === "string" && result.error) {
    throw new Error(result.error);
  }

  return {
    copied: readCount(result, "copied"),
    notified: readCount(result, "notified"),
    skipped_existing: readCount(result, "skipped_existing"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePendingDistribution(
  value: unknown,
  requestedProductIds: Set<string>,
): PendingDistribution | null {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const tenantId = typeof value.tenant_id === "string" ? value.tenant_id : "";
  const status = typeof value.status === "string" ? value.status : "";
  const createdAt = typeof value.created_at === "string" ? value.created_at : "";
  const productId = typeof value.data.product_id === "string" ? value.data.product_id : "";
  const deliveryMode = value.data.delivery_mode;

  if (!id || !tenantId || !createdAt || status !== "pending") return null;
  if (deliveryMode !== "pod_price_list" || !requestedProductIds.has(productId)) return null;
  if (tenantId === MASTER_TENANT_ID) return null;

  return { id, tenantId, productId, createdAt };
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readCount(value: unknown, key: keyof DistributionResult): number {
  if (!isRecord(value)) return 0;
  const count = Number(value[key]);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}
