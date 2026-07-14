import type { PodCatalogProduct, PodFulfillmentJob } from "../pod2/types.ts";
import { classifyOrder, evaluateProductReadiness } from "./readiness.ts";
import type {
  MasterProductRow,
  PrintProductionActivity,
  PrintProductionProduct,
  PrintProductionSnapshot,
  TenantRow,
} from "./types.ts";

type ProductUpdateNotice = {
  id?: string;
  tenant_id: string;
  status: string;
  created_at?: string;
  data: { product_id?: string; slug?: string; delivery_mode?: string };
};

export function selectOverviewRows(snapshot: PrintProductionSnapshot): {
  products: PrintProductionProduct[];
  actionJobs: PodFulfillmentJob[];
} {
  const products = snapshot.products
    .filter((product) => product.readiness.status === "ready" || product.readiness.status === "distributed")
    .slice(0, 3);
  const actionJobs = snapshot.jobs
    .filter((job) => {
      const group = classifyOrder(job).group;
      return group === "attention" || group === "ready";
    })
    .sort((left, right) => {
      const priorityDifference = overviewJobPriority(left) - overviewJobPriority(right);
      return priorityDifference || toTimestamp(left.created_at) - toTimestamp(right.created_at);
    })
    .slice(0, 2);

  return { products, actionJobs };
}

export function buildPrintProductionSnapshot(input: {
  connections: Array<{ provider_key: string; is_active: boolean }>;
  catalog: PodCatalogProduct[];
  imports: Array<{ catalog_product_id: string; product_id: string }>;
  masterProducts: MasterProductRow[];
  tenants: TenantRow[];
  notices: ProductUpdateNotice[];
  jobs: PodFulfillmentJob[];
  counts?: {
    activeProductCount: number;
    attentionCount: number;
  };
}): PrintProductionSnapshot {
  const connectionReady = input.connections.some((connection) => connection.is_active);
  const masterProductById = new Map(input.masterProducts.map((product) => [product.id, product]));
  const masterProductBySlug = new Map(input.masterProducts.map((product) => [product.slug, product]));
  const importedProductIdByCatalogId = new Map(input.imports.map((row) => [row.catalog_product_id, row.product_id]));
  const distributedTenantIdsByProductId = new Map<string, Set<string>>();

  const acceptedPodNotices = input.notices.filter((notice) =>
    notice.status === "accepted" && notice.data.delivery_mode === "pod_price_list",
  );

  for (const notice of acceptedPodNotices) {
    const productId = notice.data.product_id || masterProductBySlug.get(notice.data.slug || "")?.id;
    if (!productId) continue;

    const tenantIds = distributedTenantIdsByProductId.get(productId) || new Set<string>();
    tenantIds.add(notice.tenant_id);
    distributedTenantIdsByProductId.set(productId, tenantIds);
  }

  const products: PrintProductionProduct[] = input.catalog.map((catalog) => {
    const importedProductId = importedProductIdByCatalogId.get(catalog.id) || null;
    const masterProduct = importedProductId ? masterProductById.get(importedProductId) || null : null;
    const distributedTenantIds = masterProduct
      ? [...(distributedTenantIdsByProductId.get(masterProduct.id) || new Set<string>())]
      : [];

    return {
      catalog,
      masterProduct,
      importedProductId,
      distributedTenantIds,
      readiness: evaluateProductReadiness({
        connectionActive: connectionReady,
        catalog,
        masterProduct,
        distributedTenantCount: distributedTenantIds.length,
      }),
    };
  });

  const activity = buildActivity({
    catalog: input.catalog,
    notices: acceptedPodNotices,
    jobs: input.jobs,
    masterProductById,
    masterProductBySlug,
    tenantById: new Map(input.tenants.map((tenant) => [tenant.id, tenant])),
  });

  const attentionCount = input.counts?.attentionCount ?? input.jobs.filter((job) =>
    job.status === "paid" || job.status === "failed" || (job.status === "submitted" && !job.printcom_order_id),
  ).length;

  return {
    products,
    jobs: input.jobs,
    tenants: input.tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      pod2_auto_forward: tenant.pod2_auto_forward,
    })),
    activity,
    connectionReady,
    activeProductCount: input.counts?.activeProductCount
      ?? products.filter((product) => product.catalog.status === "published" && product.masterProduct).length,
    distributedShopCount: new Set(acceptedPodNotices.map((notice) => notice.tenant_id)).size,
    attentionCount,
  };
}

function buildActivity(input: {
  catalog: PodCatalogProduct[];
  notices: ProductUpdateNotice[];
  jobs: PodFulfillmentJob[];
  masterProductById: Map<string, MasterProductRow>;
  masterProductBySlug: Map<string, MasterProductRow>;
  tenantById: Map<string, TenantRow>;
}): PrintProductionActivity[] {
  const productActivity = input.catalog.map((catalog) => ({
    id: `product-${catalog.id}`,
    kind: "product" as const,
    label: catalog.public_title.da || catalog.public_title.en || "POD-produkt",
    occurredAt: catalog.updated_at || catalog.created_at,
  }));

  const distributionActivity = input.notices.flatMap((notice, index) => {
    const masterProduct = notice.data.product_id
      ? input.masterProductById.get(notice.data.product_id)
      : input.masterProductBySlug.get(notice.data.slug || "");
    if (!notice.created_at) return [];

    return [{
      id: notice.id || `distribution-${notice.tenant_id}-${index}`,
      kind: "distribution" as const,
      label: `${masterProduct?.name || "Produkt"} distribueret til ${input.tenantById.get(notice.tenant_id)?.name || "shop"}`,
      occurredAt: notice.created_at,
    }];
  });

  const jobActivity = input.jobs.flatMap((job) => {
    const occurredAt = job.updated_at || job.created_at;
    if (!occurredAt) return [];

    return [{
      id: `order-${job.id}`,
      kind: "order" as const,
      label: job.product_name || `POD-ordre (${job.status})`,
      occurredAt,
    }];
  });

  return [...productActivity, ...distributionActivity, ...jobActivity]
    .sort((left, right) => toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt))
    .slice(0, 20);
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function overviewJobPriority(job: PodFulfillmentJob): number {
  if (job.status === "failed") return 0;
  if (classifyOrder(job).group === "attention") return 1;
  return 2;
}
