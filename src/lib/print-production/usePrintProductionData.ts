import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePodConnections } from "@/lib/pod2/hooks";
import type { PodCatalogProduct, PodFulfillmentJob } from "../pod2/types.ts";
import { buildPrintProductionSnapshot } from "./snapshot.ts";
import type { MasterProductRow, PrintProductionSnapshot, TenantRow } from "./types.ts";

// POD v2 and tenant notification tables are not present in generated Supabase types.
/* eslint-disable @typescript-eslint/no-explicit-any */

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const NOTIFICATION_READ_PAGE_SIZE = 500;

export interface UsePrintProductionDataResult {
  snapshot: PrintProductionSnapshot | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UsePrintProductionDataInput {
  page: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "draft" | "published";
}

export function usePrintProductionData(input: UsePrintProductionDataInput): UsePrintProductionDataResult {
  const connectionsQuery = usePodConnections();
  const pageSize = Math.min(Math.max(input.pageSize || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(input.page, 0);
  const search = input.search?.trim() || "";
  const status = input.status || "all";

  const dataQuery = useQuery({
    queryKey: ["print-production", page, pageSize, search, status],
    queryFn: async () => {
      const catalogQuery = (supabase.from("pod2_catalog_products" as any) as any)
        .select(`
          id, status, public_title, public_description, public_images, supplier_product_ref, supplier_product_data, created_at, updated_at,
          pod2_catalog_price_matrix (id, catalog_product_id, variant_signature, quantities, base_costs, recommended_retail, currency, needs_quote, updated_at)
        `)
        .eq("tenant_id", MASTER_TENANT_ID)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status !== "all") catalogQuery.eq("status", status);
      if (search) {
        const escapedSearch = search.replace(/[%_,()]/g, " ");
        catalogQuery.or(`public_title->>da.ilike.%${escapedSearch}%,public_title->>en.ilike.%${escapedSearch}%`);
      }

      const [catalogResult, jobsResult, activeProductsResult, paidOrFailedResult, submittedWithoutProviderResult, distributedTenantRows] = await Promise.all([
        catalogQuery,
        (supabase.from("pod2_fulfillment_jobs" as any) as any)
          .select("*")
          .order("created_at", { ascending: false })
          .range(0, 99),
        (supabase.from("pod2_catalog_products" as any) as any)
          .select("id, pod2_tenant_imports!inner(product_id)", { count: "exact", head: true })
          .eq("tenant_id", MASTER_TENANT_ID)
          .eq("status", "published")
          .eq("pod2_tenant_imports.tenant_id", MASTER_TENANT_ID),
        (supabase.from("pod2_fulfillment_jobs" as any) as any)
          .select("id", { count: "exact", head: true })
          .in("status", ["paid", "failed"]),
        (supabase.from("pod2_fulfillment_jobs" as any) as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted")
          .is("printcom_order_id", null),
        readAllNotificationRows<{ tenant_id: string }>(() => (supabase.from("tenant_notifications" as any) as any)
          .select("tenant_id")
          .eq("type", "product_update")
          .eq("status", "accepted")
          .contains("data", { delivery_mode: "pod_price_list" })),
      ]);

      throwIfError(catalogResult.error);
      throwIfError(jobsResult.error);
      throwIfError(activeProductsResult.error);
      throwIfError(paidOrFailedResult.error);
      throwIfError(submittedWithoutProviderResult.error);

      const catalog = (catalogResult.data || []) as PodCatalogProduct[];
      const catalogProductIds = catalog.map((product) => product.id);
      const jobs = (jobsResult.data || []) as PodFulfillmentJob[];
      const distributedShopCount = new Set(distributedTenantRows.map((row) => row.tenant_id)).size;

      if (!catalogProductIds.length) {
        return {
          catalog,
          imports: [],
          masterProducts: [],
          tenants: [],
          notices: [],
          jobs,
          counts: {
            activeProductCount: activeProductsResult.count || 0,
            attentionCount: (paidOrFailedResult.count || 0) + (submittedWithoutProviderResult.count || 0),
          },
          distributedShopCount,
        };
      }

      const importsResult = await (supabase.from("pod2_tenant_imports" as any) as any)
        .select("catalog_product_id, product_id")
        .eq("tenant_id", MASTER_TENANT_ID)
        .in("catalog_product_id", catalogProductIds);
      throwIfError(importsResult.error);

      const imports = (importsResult.data || []) as Array<{ catalog_product_id: string; product_id: string }>;
      const masterProductIds = imports.map((row) => row.product_id);
      const masterProductsResult = masterProductIds.length
        ? await (supabase.from("products" as any) as any)
          .select("id, name, slug, category, image_url, is_published")
          .eq("tenant_id", MASTER_TENANT_ID)
          .in("id", masterProductIds)
        : { data: [], error: null };
      throwIfError(masterProductsResult.error);

      const masterProducts = (masterProductsResult.data || []) as MasterProductRow[];
      const notices = masterProductIds.length
        ? await readAllNotificationRows<{
          id?: string;
          tenant_id: string;
          status: string;
          created_at?: string;
          data: { product_id?: string; slug?: string; delivery_mode?: string };
        }>(() => (supabase.from("tenant_notifications" as any) as any)
          .select("id, tenant_id, status, created_at, data")
          .eq("type", "product_update")
          .eq("status", "accepted")
          .contains("data", { delivery_mode: "pod_price_list" })
          .in("data->>product_id", masterProductIds))
        : [];
      const tenantIds = [...new Set([...notices.map((notice) => notice.tenant_id), ...jobs.map((job) => job.tenant_id)])];
      const tenantsResult = tenantIds.length
        ? await (supabase.from("tenants" as any) as any)
          .select("id, name, domain, pod2_auto_forward")
          .in("id", tenantIds)
        : { data: [], error: null };
      throwIfError(tenantsResult.error);

      return {
        catalog,
        imports,
        masterProducts,
        tenants: (tenantsResult.data || []) as TenantRow[],
        notices,
        jobs,
        counts: {
          activeProductCount: activeProductsResult.count || 0,
          attentionCount: (paidOrFailedResult.count || 0) + (submittedWithoutProviderResult.count || 0),
        },
        distributedShopCount,
      };
    },
  });

  const snapshot = dataQuery.data
    ? {
      ...buildPrintProductionSnapshot({
        connections: connectionsQuery.data || [],
        catalog: dataQuery.data.catalog,
        imports: dataQuery.data.imports,
        masterProducts: dataQuery.data.masterProducts,
        tenants: dataQuery.data.tenants,
        notices: dataQuery.data.notices,
        jobs: dataQuery.data.jobs,
        counts: dataQuery.data.counts,
      }),
      distributedShopCount: dataQuery.data.distributedShopCount,
    }
    : null;

  return {
    snapshot,
    isLoading: connectionsQuery.isLoading || dataQuery.isLoading,
    error: toError(connectionsQuery.error) || toError(dataQuery.error),
    refetch: async () => {
      const [connectionsResult, dataResult] = await Promise.all([
        connectionsQuery.refetch({ throwOnError: false }),
        dataQuery.refetch({ throwOnError: false }),
      ]);

      if (connectionsResult.error || dataResult.error) {
        throw new Error("Produktionsoversigten kunne ikke opdateres.");
      }
    },
  };
}

function throwIfError(error: Error | null): void {
  if (error) throw error;
}

function toError(error: unknown): Error | null {
  return error instanceof Error ? error : error ? new Error(String(error)) : null;
}

async function readAllNotificationRows<T>(createQuery: () => any): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += NOTIFICATION_READ_PAGE_SIZE) {
    const result = await createQuery()
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + NOTIFICATION_READ_PAGE_SIZE - 1);
    throwIfError(result.error);

    const pageRows = (result.data || []) as T[];
    rows.push(...pageRows);
    if (pageRows.length < NOTIFICATION_READ_PAGE_SIZE) return rows;
  }
}
