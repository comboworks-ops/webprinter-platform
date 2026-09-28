import type {
  PodCatalogProduct,
  PodFulfillmentJob,
} from "../pod2/types.ts";

export type ProductReadinessStatus = "draft" | "blocked" | "ready" | "distributed";
export type ProductBlockerCode =
  | "connection_missing"
  | "catalog_draft"
  | "supplier_reference_missing"
  | "missing_prices"
  | "quote_only"
  | "missing_title"
  | "missing_image"
  | "master_import_missing"
  | "master_product_not_ready";

export interface MasterProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  image_url: string | null;
  is_published: boolean;
  is_ready: boolean;
}

export interface TenantRow {
  id: string;
  name: string;
  domain: string | null;
  pod2_auto_forward: boolean;
}

export interface ProductBlocker {
  code: ProductBlockerCode;
  label: string;
  actionLabel: string;
}

export interface ProductReadiness {
  status: ProductReadinessStatus;
  blockers: ProductBlocker[];
  minCost: number | null;
  minRetail: number | null;
  marginPercent: number | null;
}

export interface PrintProductionProduct {
  catalog: PodCatalogProduct;
  masterProduct: MasterProductRow | null;
  importedProductId: string | null;
  distributedTenantIds: string[];
  readiness: ProductReadiness;
}

export type OrderGroup = "attention" | "ready" | "supplier" | "completed" | "waiting";

export interface OrderPresentation {
  group: OrderGroup;
  label: string;
  canValidate: boolean;
  canSubmit: boolean;
}

export interface SupplierCapabilities {
  catalog: boolean;
  pricing: boolean;
  validation: boolean;
  liveSubmission: boolean;
  statusSync: boolean;
  cancellation: boolean;
}

export interface PrintProductionActivity {
  id: string;
  kind: "product" | "distribution" | "order";
  label: string;
  occurredAt: string;
}

export interface PrintProductionSnapshot {
  products: PrintProductionProduct[];
  jobs: PodFulfillmentJob[];
  tenants: TenantRow[];
  activity: PrintProductionActivity[];
  connectionReady: boolean;
  activeProductCount: number;
  distributedShopCount: number;
  attentionCount: number;
}
