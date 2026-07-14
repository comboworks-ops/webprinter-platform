export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

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

function readCount(value: unknown, key: keyof DistributionResult): number {
  if (!isRecord(value)) return 0;
  const count = Number(value[key]);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}
