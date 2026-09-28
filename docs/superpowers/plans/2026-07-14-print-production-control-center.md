# Print Production Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build one master-operated Printproduktion workspace that prepares POD v2 products, sends them only to selected tenant shops, and safely forwards paid orders to production while tenants see ordinary Webprinter products and orders.

**Architecture:** Add a focused React control-center shell and pure read-model modules over the existing POD v2 tables, hooks, edge functions, and selected-tenant transfer RPC. Preserve POD v1, pricing, Supplier Bank, and every legacy POD route; consolidate normal navigation only after the new route passes QA.

**Tech Stack:** React 18, TypeScript, Vite, React Router 6, TanStack Query 5, Supabase JS, shadcn/Radix UI, Lucide icons, Tailwind CSS, Node test runner, Playwright through the in-app browser.

## Global Constraints

- Read POD2_README.md before every POD implementation task.
- Do not modify POD v1 behavior, tables, functions, or routes.
- Do not replace or recalculate the existing product pricing engine.
- Supplier Bank remains separate from POD v2.
- The new route is master-admin only in master-tenant context.
- Tenant-facing UI must not expose supplier names, costs, credentials, POD versions, payloads, matrix mapping, dry runs, or forwarding controls.
- No shop is selected by default; Vælg alle is always an explicit secondary action.
- Live supplier submission remains Print.com-only until another adapter passes the same real-API acceptance contract.
- Never automatically retry a real submission after an uncertain supplier response.
- Keep /admin/pod2, /admin/pod2-katalog, /admin/pod2-ordrer, and /admin/pod2-betaling available for rollback.
- Use correct Danish letters in all customer-visible Danish copy.
- Add no database migration in this plan. Any discovered need for a public table, view, RPC, or function requires a separate approved migration with explicit grants, RLS, indexes, and rollback notes.
- Stage and commit only files named by the active task; the worktree contains unrelated user changes.

---

## File Structure

### Domain and data

- Create src/lib/print-production/types.ts: control-center view types only.
- Create src/lib/print-production/readiness.ts: pure product and order readiness rules.
- Create src/lib/print-production/readiness.test.ts: readiness and business-language tests.
- Create src/lib/print-production/snapshot.ts: aggregate existing POD rows into one read model.
- Create src/lib/print-production/snapshot.test.ts: aggregation, counts, and tenant-leakage tests.
- Create src/lib/print-production/navigation.ts: view URL helpers preserving force_domain.
- Create src/lib/print-production/navigation.test.ts: route-context tests.
- Create src/lib/print-production/distribution.ts: selected-shop request builder and RPC adapter.
- Create src/lib/print-production/distribution.test.ts: empty/default/all-selection safety tests.
- Create src/lib/print-production/orderSubmission.ts: validation/submission request rules.
- Create src/lib/print-production/orderSubmission.test.ts: duplicate-risk and status-gate tests.
- Create src/lib/print-production/supplierPresentation.ts: guided versus advanced supplier-import presentation rules.
- Create src/lib/print-production/supplierPresentation.test.ts: guided-mode visibility tests.
- Create src/lib/print-production/usePrintProductionData.ts: bounded TanStack Query reads over existing POD v2 tables plus lightweight count queries.

### UI

- Create src/pages/admin/PrintProduction.tsx: master-context gate and page entry.
- Create src/components/admin/print-production/PrintProductionShell.tsx: header and five-view navigation.
- Create src/components/admin/print-production/PrintProductionOverview.tsx: readiness, metrics, product rows, action queue, activity.
- Create src/components/admin/print-production/PrintProductionProducts.tsx: dense product table and filters.
- Create src/components/admin/print-production/PrintProductWizard.tsx: prepare/import/check/distribute flow.
- Create src/components/admin/print-production/PrintProductionDistribution.tsx: product-by-shop distribution view.
- Create src/components/admin/print-production/PrintProductionOrders.tsx: validation-first production queue.
- Create src/components/admin/print-production/PrintProductionSettings.tsx: operational settings and supplier capability summary.
- Create src/components/admin/print-production/AdvancedToolsLinks.tsx: legacy rollback and diagnostics links.

### Existing integration points

- Modify src/pages/Admin.tsx: register /admin/printproduktion.
- Modify src/pages/admin/Pod2Admin.tsx: expose the existing supplier browser in guided and advanced presentation modes without changing its persistence logic.
- Modify src/components/admin/AdminSidebar.tsx: consolidate normal POD navigation after QA.
- Modify src/components/admin/TenantUpdates.tsx: replace tenant-visible POD wording with ordinary Webprinter product wording.
- Modify src/components/admin/ShopModules.tsx: remove the tenant-facing POD module card.
- Modify POD2_README.md: document the new shell, safety boundary, and rollback route list.
- Modify AI_CONTINUITY.md: add the current control-center status and next verification point.

---

### Task 1: Pure Readiness And Business-Language Model

**Files:**
- Create: src/lib/print-production/types.ts
- Create: src/lib/print-production/readiness.ts
- Test: src/lib/print-production/readiness.test.ts

**Interfaces:**
- Consumes: PodCatalogProduct, PodFulfillmentJob, and PodSupplierConnection from src/lib/pod2/types.ts.
- Produces: evaluateProductReadiness(), classifyOrder(), getSupplierCapabilities(), ProductReadiness, OrderPresentation, and SupplierCapabilities.

- [ ] **Step 1: Write the failing readiness tests**

Create readiness.test.ts with these cases:

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOrder,
  evaluateProductReadiness,
  getSupplierCapabilities,
} from "./readiness.ts";

const pricedCatalog = {
  id: "catalog-1",
  status: "published",
  public_title: { da: "A5 Flyers", en: "A5 Flyers" },
  public_description: { da: "", en: "" },
  public_images: ["https://example.test/flyer.jpg"],
  supplier_product_ref: "printed-flyers",
  supplier_product_data: { printcom_sku: "printed-flyers" },
  created_at: "2026-07-14T00:00:00Z",
  updated_at: "2026-07-14T00:00:00Z",
  pod2_catalog_attributes: [],
  pod2_catalog_price_matrix: [{
    id: "price-1",
    catalog_product_id: "catalog-1",
    variant_signature: "size:a5",
    quantities: [100],
    base_costs: [100],
    recommended_retail: [160],
    currency: "DKK",
    needs_quote: false,
    updated_at: "2026-07-14T00:00:00Z",
  }],
} as const;

test("ready product requires active connection, prices, image, and master import", () => {
  const result = evaluateProductReadiness({
    connectionActive: true,
    catalog: pricedCatalog,
    masterProduct: {
      id: "product-1",
      name: "A5 Flyers",
      slug: "a5-flyers",
      category: "Flyers",
      image_url: "https://example.test/flyer.jpg",
      is_published: false,
    },
  });
  assert.equal(result.status, "ready");
  assert.equal(result.blockers.length, 0);
  assert.equal(result.minCost, 100);
  assert.equal(result.minRetail, 160);
  assert.equal(result.marginPercent, 37.5);
});

test("missing price data blocks distribution with a Danish recovery action", () => {
  const result = evaluateProductReadiness({
    connectionActive: true,
    catalog: { ...pricedCatalog, pod2_catalog_price_matrix: [] },
    masterProduct: null,
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers[0].code, "missing_prices");
  assert.match(result.blockers[0].actionLabel, /pris/i);
});

test("submitted job without supplier order id requires attention", () => {
  const result = classifyOrder({
    id: "job-1",
    status: "submitted",
    printcom_order_id: null,
  } as never);
  assert.equal(result.group, "attention");
  assert.equal(result.canValidate, true);
  assert.equal(result.canSubmit, false);
});

test("only Print.com reports verified live submission", () => {
  assert.equal(getSupplierCapabilities("print.com").liveSubmission, true);
  assert.equal(getSupplierCapabilities("wir-machen-druck").liveSubmission, false);
});
~~~

- [ ] **Step 2: Run the tests and verify they fail**

Run:

~~~bash
node --test --experimental-strip-types src/lib/print-production/readiness.test.ts
~~~

Expected: FAIL because readiness.ts does not exist.

- [ ] **Step 3: Implement the types and pure functions**

types.ts must define the stable view contracts:

~~~ts
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
  | "master_import_missing";

export interface MasterProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  image_url: string | null;
  is_published: boolean;
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
~~~

readiness.ts must implement exact business rules:

~~~ts
import type { PodCatalogProduct, PodFulfillmentJob } from "../pod2/types.ts";
import type {
  MasterProductRow,
  OrderPresentation,
  ProductBlocker,
  ProductReadiness,
  SupplierCapabilities,
} from "./types.ts";

const firstFinite = (values: unknown[]): number | null => {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? Math.min(...numbers) : null;
};

export function evaluateProductReadiness(input: {
  connectionActive: boolean;
  catalog: PodCatalogProduct;
  masterProduct: MasterProductRow | null;
  distributedTenantCount?: number;
}): ProductReadiness {
  const blockers: ProductBlocker[] = [];
  const matrices = input.catalog.pod2_catalog_price_matrix || [];
  const minCost = firstFinite(matrices.flatMap((row) => row.base_costs || []));
  const minRetail = firstFinite(matrices.flatMap((row) => row.recommended_retail || []));

  if (!input.connectionActive) blockers.push({ code: "connection_missing", label: "Leverandørforbindelsen mangler", actionLabel: "Åbn indstillinger" });
  if (input.catalog.status !== "published") blockers.push({ code: "catalog_draft", label: "Produktet er stadig en kladde", actionLabel: "Klargør produkt" });
  if (!input.catalog.supplier_product_ref && !input.catalog.supplier_product_data?.printcom_sku) blockers.push({ code: "supplier_reference_missing", label: "Leverandørproduktet mangler", actionLabel: "Vælg leverandørprodukt" });
  if (!matrices.length || minCost === null || minRetail === null) blockers.push({ code: "missing_prices", label: "Produktet mangler priser", actionLabel: "Kontrollér priser" });
  if (matrices.length > 0 && matrices.every((row) => row.needs_quote)) blockers.push({ code: "quote_only", label: "Alle kombinationer kræver tilbud", actionLabel: "Vælg faste kombinationer" });
  if (!String(input.catalog.public_title?.da || input.catalog.public_title?.en || "").trim()) blockers.push({ code: "missing_title", label: "Produktnavnet mangler", actionLabel: "Tilføj navn" });
  if (!(input.catalog.public_images || []).length && !input.masterProduct?.image_url) blockers.push({ code: "missing_image", label: "Produktbilledet mangler", actionLabel: "Tilføj billede" });
  if (!input.masterProduct) blockers.push({ code: "master_import_missing", label: "Produktet er ikke oprettet hos Webprinter", actionLabel: "Opret produkt" });

  const marginPercent = minCost !== null && minRetail !== null && minRetail > 0
    ? Math.round(((minRetail - minCost) / minRetail) * 1000) / 10
    : null;

  return {
    status: blockers.length ? "blocked" : input.distributedTenantCount ? "distributed" : "ready",
    blockers,
    minCost,
    minRetail,
    marginPercent,
  };
}

export function classifyOrder(job: PodFulfillmentJob): OrderPresentation {
  if (job.status === "completed") return { group: "completed", label: "Afsluttet", canValidate: false, canSubmit: false };
  if (job.status === "processing" || (job.status === "submitted" && job.printcom_order_id)) return { group: "supplier", label: "Hos leverandøren", canValidate: false, canSubmit: false };
  if (job.status === "paid") return { group: "ready", label: "Klar til produktion", canValidate: true, canSubmit: false };
  if (job.status === "failed" || (job.status === "submitted" && !job.printcom_order_id)) return { group: "attention", label: "Kræver handling", canValidate: true, canSubmit: false };
  return { group: "waiting", label: "Afventer", canValidate: false, canSubmit: false };
}

export function getSupplierCapabilities(providerKey: string): SupplierCapabilities {
  const normalized = providerKey.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isPrintCom = normalized === "printcom";
  return {
    catalog: true,
    pricing: isPrintCom,
    validation: isPrintCom,
    liveSubmission: isPrintCom,
    statusSync: isPrintCom,
    cancellation: false,
  };
}
~~~

- [ ] **Step 4: Run the tests and verify they pass**

Run the same node test command.

Expected: 4 tests pass.

- [ ] **Step 5: Commit the domain model**

~~~bash
git add src/lib/print-production/types.ts src/lib/print-production/readiness.ts src/lib/print-production/readiness.test.ts
git commit -m "feat(pod2): add print production readiness model"
~~~

### Task 2: Aggregated Read Model

**Files:**
- Create: src/lib/print-production/snapshot.ts
- Create: src/lib/print-production/snapshot.test.ts
- Create: src/lib/print-production/usePrintProductionData.ts

**Interfaces:**
- Consumes: evaluateProductReadiness(), existing POD v2 tables/views, and the active supplier connection hook.
- Produces: buildPrintProductionSnapshot() and usePrintProductionData().

- [ ] **Step 1: Write failing snapshot tests**

Cover these exact behaviors:

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildPrintProductionSnapshot } from "./snapshot.ts";

test("snapshot joins catalog, master import, notifications, tenants, and jobs", () => {
  const snapshot = buildPrintProductionSnapshot({
    connections: [{ id: "c", provider_key: "print.com", is_active: true }],
    catalog: [{
      id: "catalog-1",
      status: "published",
      public_title: { da: "Flyer", en: "Flyer" },
      public_description: { da: "", en: "" },
      public_images: ["image"],
      supplier_product_ref: "flyer",
      created_at: "now",
      updated_at: "now",
      pod2_catalog_price_matrix: [{
        id: "p", catalog_product_id: "catalog-1", variant_signature: "a5",
        quantities: [100], base_costs: [100], recommended_retail: [150],
        currency: "DKK", needs_quote: false, updated_at: "now",
      }],
    }],
    imports: [{ catalog_product_id: "catalog-1", product_id: "product-1" }],
    masterProducts: [{ id: "product-1", name: "Flyer", slug: "flyer", category: "Flyers", image_url: "image", is_published: false }],
    tenants: [
      { id: "tenant-a", name: "A", domain: "a.dk", pod2_auto_forward: true },
      { id: "tenant-b", name: "B", domain: "b.dk", pod2_auto_forward: true },
    ],
    notices: [{ id: "notice-1", tenant_id: "tenant-a", status: "accepted", created_at: "2026-07-14T08:00:00Z", data: { product_id: "product-1", delivery_mode: "pod_price_list" } }],
    jobs: [{ id: "job-1", status: "paid", tenant_id: "tenant-a" }],
  } as never);

  assert.equal(snapshot.products[0].distributedTenantIds[0], "tenant-a");
  assert.equal(snapshot.activeProductCount, 1);
  assert.equal(snapshot.distributedShopCount, 1);
  assert.equal(snapshot.attentionCount, 1);
});

test("snapshot never copies supplier data into tenant rows", () => {
  const snapshot = buildPrintProductionSnapshot({
    connections: [], catalog: [], imports: [], masterProducts: [], notices: [], jobs: [],
    tenants: [{ id: "tenant-a", name: "A", domain: "a.dk", pod2_auto_forward: true }],
  } as never);
  assert.equal("supplier_product_data" in snapshot.tenants[0], false);
});
~~~

- [ ] **Step 2: Run the snapshot tests and verify failure**

~~~bash
node --test --experimental-strip-types src/lib/print-production/snapshot.test.ts
~~~

Expected: FAIL because snapshot.ts is missing.

- [ ] **Step 3: Implement buildPrintProductionSnapshot**

Use maps keyed by catalog product ID and master product ID. Count only accepted
POD-price-list notices as distributed. Treat paid, failed, and
submitted-without-provider-ID jobs as requiring master attention. Call
evaluateProductReadiness() for every catalog row. Build activity from catalog
timestamps, accepted notification timestamps, and job timestamps; sort newest
first and retain at most 20 entries.

The exported signature must be:

~~~ts
export function buildPrintProductionSnapshot(input: {
  connections: Array<{ provider_key: string; is_active: boolean }>;
  catalog: PodCatalogProduct[];
  imports: Array<{ catalog_product_id: string; product_id: string }>;
  masterProducts: MasterProductRow[];
  tenants: TenantRow[];
  notices: Array<{
    id?: string;
    tenant_id: string;
    status: string;
    created_at?: string;
    data: { product_id?: string; slug?: string; delivery_mode?: string };
  }>;
  jobs: PodFulfillmentJob[];
  counts?: {
    activeProductCount: number;
    attentionCount: number;
  };
}): PrintProductionSnapshot;
~~~

- [ ] **Step 4: Implement usePrintProductionData**

Use usePodConnections() for the small connection set. Query the control-center
catalog directly with a page size of 30 and a maximum allowed page size of 100.
Query at most 100 current jobs, ordered newest first. Load only imports,
master products, and product-update notifications related to the catalog rows
on the current page.

Fetch lightweight exact counts separately:

- published catalog products linked to a master import;
- jobs with status paid or failed;
- submitted jobs without a supplier order reference;
- distinct tenant IDs from accepted pod_price_list notifications.

Do not reuse usePodCatalogProducts() or usePodAllFulfillmentJobs() in the new
control center because those legacy hooks fetch unbounded rows and complete
matrices. Keep both hooks unchanged for legacy routes.

The hook must return:

~~~ts
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
~~~

Do not query raw supplier catalogs from this hook. Do not query complete price matrices a second time.

- [ ] **Step 5: Run tests and build**

~~~bash
node --test --experimental-strip-types src/lib/print-production/snapshot.test.ts
pnpm exec vite build
~~~

Expected: snapshot tests pass and Vite build succeeds.

- [ ] **Step 6: Commit the read model**

~~~bash
git add src/lib/print-production/snapshot.ts src/lib/print-production/snapshot.test.ts src/lib/print-production/usePrintProductionData.ts
git commit -m "feat(pod2): aggregate print production state"
~~~

### Task 3: Route, Master Gate, And Shell

**Files:**
- Create: src/lib/print-production/navigation.ts
- Create: src/lib/print-production/navigation.test.ts
- Create: src/pages/admin/PrintProduction.tsx
- Create: src/components/admin/print-production/PrintProductionShell.tsx
- Modify: src/pages/Admin.tsx

**Interfaces:**
- Consumes: usePrintProductionData().
- Produces: /admin/printproduktion and view navigation preserving force_domain.

- [ ] **Step 1: Write failing navigation tests**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import { getPrintProductionView, withPrintProductionView } from "./navigation.ts";

test("unknown view falls back to overview", () => {
  assert.equal(getPrintProductionView("?view=nope"), "overview");
});

test("view navigation preserves tenant context", () => {
  assert.equal(
    withPrintProductionView("?force_domain=webprinter.dk&view=overview", "orders"),
    "/admin/printproduktion?force_domain=webprinter.dk&view=orders",
  );
});
~~~

- [ ] **Step 2: Implement navigation.ts and pass the tests**

The allowed values are overview, products, distribution, orders, and settings. Preserve force_domain and discard unrelated transient parameters.

- [ ] **Step 3: Create the master-context page gate**

PrintProduction.tsx resolves the active admin tenant. While resolving, show a centered Loader2. When the user is not a master admin acting in MASTER_TENANT_ID, render Navigate to /admin/products with replace and preserve force_domain.

- [ ] **Step 4: Create PrintProductionShell**

Render:

- title Printproduktion;
- subtitle Vælg produkter, send dem til dine butikker og følg produktionen.;
- primary Tilføj produkt button with Plus icon;
- compact tabs Overblik, Produkter, Distribution, Ordrer, Indstillinger;
- the active view content;
- a discreet Avancerede værktøjer link at the bottom.

Use URL views instead of component-only state so refresh and back navigation work.

- [ ] **Step 5: Register the route**

Import PrintProduction in Admin.tsx and add:

~~~tsx
<Route path="/printproduktion" element={<PrintProduction />} />
~~~

Do not remove any legacy POD route.

- [ ] **Step 6: Run tests and build**

~~~bash
node --test --experimental-strip-types src/lib/print-production/navigation.test.ts
pnpm exec vite build
~~~

Expected: tests pass and route compiles.

- [ ] **Step 7: Commit the shell**

~~~bash
git add src/lib/print-production/navigation.ts src/lib/print-production/navigation.test.ts src/pages/admin/PrintProduction.tsx src/components/admin/print-production/PrintProductionShell.tsx src/pages/Admin.tsx
git commit -m "feat(pod2): add print production control center shell"
~~~

### Task 4: Overview Workspace

**Files:**
- Create: src/components/admin/print-production/PrintProductionOverview.tsx
- Modify: src/components/admin/print-production/PrintProductionShell.tsx

**Interfaces:**
- Consumes: PrintProductionSnapshot and onOpenProduct/onOpenOrder callbacks.
- Produces: approved overview layout with no write actions except navigation.

- [ ] **Step 1: Add a pure overview selector test to snapshot.test.ts**

Add fixtures proving that the overview returns at most three ready/distributed products and at most two attention/ready orders, sorted with failed orders first and then oldest paid orders.

- [ ] **Step 2: Add selectOverviewRows() to snapshot.ts**

Export:

~~~ts
export function selectOverviewRows(snapshot: PrintProductionSnapshot): {
  products: PrintProductionProduct[];
  actionJobs: PodFulfillmentJob[];
};
~~~

- [ ] **Step 3: Implement the overview**

Match the approved mockup:

- a three-segment readiness strip;
- metrics for active products, shops, and required actions;
- a dense product table with product, supplier cost, selling price, margin, readiness, shops, and actions;
- a right-side action queue;
- recent activity derived from catalog/job timestamps.

Use stable table columns and image dimensions. On narrow screens, stack the action queue beneath the product list and preserve readable button labels.

- [ ] **Step 4: Verify tests and build**

Run the snapshot test and Vite build.

- [ ] **Step 5: Commit the overview**

~~~bash
git add src/lib/print-production/snapshot.ts src/lib/print-production/snapshot.test.ts src/components/admin/print-production/PrintProductionOverview.tsx src/components/admin/print-production/PrintProductionShell.tsx
git commit -m "feat(pod2): add print production overview"
~~~

### Task 5: Guided Supplier Intake Without Rewriting POD v2

**Files:**
- Create: src/lib/print-production/supplierPresentation.ts
- Create: src/lib/print-production/supplierPresentation.test.ts
- Modify: src/pages/admin/Pod2Admin.tsx
- Create: src/components/admin/print-production/PrintProductWizard.tsx
- Modify: src/components/admin/print-production/PrintProductionShell.tsx

**Interfaces:**
- Consumes: existing BrowseTab fetching, variant generation, price fetching, matrix persistence, chunk limits, and catalog writes.
- Produces: exported Pod2SupplierImporter with advanced/guided modes and onCatalogProductCreated callback.

- [ ] **Step 1: Write failing presentation tests**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import { getSupplierPresentation } from "./supplierPresentation.ts";

test("guided mode hides technical controls and auto-publishes a validated catalog item", () => {
  assert.deepEqual(getSupplierPresentation("guided"), {
    showPresets: false,
    showApiLimits: false,
    showRegionCurrency: false,
    showBatchToggle: false,
    matrixInitiallyExpanded: false,
    autoPublishDefault: true,
  });
});

test("advanced mode preserves the current POD v2 workbench", () => {
  const result = getSupplierPresentation("advanced");
  assert.equal(result.showPresets, true);
  assert.equal(result.showApiLimits, true);
  assert.equal(result.matrixInitiallyExpanded, true);
  assert.equal(result.autoPublishDefault, false);
});
~~~

- [ ] **Step 2: Implement supplierPresentation.ts and pass the tests**

Use these exported contracts and an exhaustive mode switch. Do not infer
presentation from URL strings inside Pod2Admin.

~~~ts
export type SupplierPresentationMode = "advanced" | "guided";

export interface SupplierPresentation {
  showPresets: boolean;
  showApiLimits: boolean;
  showRegionCurrency: boolean;
  showBatchToggle: boolean;
  matrixInitiallyExpanded: boolean;
  autoPublishDefault: boolean;
}

export function getSupplierPresentation(
  mode: SupplierPresentationMode,
): SupplierPresentation;
~~~

- [ ] **Step 3: Export a guided wrapper around the existing supplier browser**

Keep BrowseTab internal and export this wrapper:

~~~ts
export interface Pod2SupplierImporterProps {
  mode?: "advanced" | "guided";
  onCatalogProductCreated?: (result: {
    catalogProductId: string;
    supplierProductRef: string;
  }) => void;
}

export function Pod2SupplierImporter({
  mode = "advanced",
  onCatalogProductCreated,
}: Pod2SupplierImporterProps) {
  const presentation = getSupplierPresentation(mode);
  return <BrowseTab mode={mode} presentation={presentation} onCatalogProductCreated={onCatalogProductCreated} />;
}
~~~

Change the existing BrowseTab declaration to:

~~~tsx
function BrowseTab({
  mode = "advanced",
  presentation,
  onCatalogProductCreated,
}: Pod2SupplierImporterProps & {
  presentation: SupplierPresentation;
}) {
~~~

Keep its existing body below that declaration and use presentation only when
deciding which controls to render. Pod2Admin must render
Pod2SupplierImporter with mode advanced. This preserves the existing route.

- [ ] **Step 4: Apply guided presentation only to rendering**

In guided mode:

- hide presets, region/currency, batch switch, max variants, max requests, and raw diagnostic copy;
- retain the existing default variant, quantity, markup, and matrix algorithms;
- show matrix mapping inside a collapsed Avanceret section;
- automatically use the derived default matrix mapping when valid;
- automatically open Avanceret and block completion when a valid vertical axis cannot be derived;
- default auto-publication to true only after all current validation checks pass.

Do not change PRICE_MATRIX_INSERT_CHUNK_SIZE, PRICE_BATCH_REQUEST_CHUNK_SIZE, INDIVIDUAL_PRICE_FALLBACK_LIMIT, or the 500-combination safeguard.

- [ ] **Step 5: Emit a completion callback**

After catalog product creation, matrix writes, supplier_product_data update, and successful publication, call:

~~~ts
onCatalogProductCreated?.({
  catalogProductId,
  supplierProductRef: sku,
});
~~~

Call it before closing the current wizard and after refetchCatalog().

- [ ] **Step 6: Create the outer product wizard**

PrintProductWizard has five visible steps:

1. Vælg produkt: published Webprinter catalog plus Hent nyt fra Print.com.
2. Vælg sortiment: summarized variants and quantities.
3. Pris og avance: existing base cost/recommended retail display and the existing markup control from Pod2SupplierImporter for new source products.
4. Kontrollér produkt: readiness checklist and customer-facing preview.
5. Send til butikker: rendered by Task 6 and disabled until at least one shop is selected.

For an already curated catalog item, use usePodImportProduct() to create the master product. Use the returned productId and slug; do not write products or product_price directly from the new wizard.

Render PrintProductWizard as a full-width route panel controlled by
view=products and action=new, not as a second dialog. When the operator chooses
Hent nyt fra Print.com, Pod2SupplierImporter's existing wizard is therefore the
only modal in the interaction.

- [ ] **Step 7: Run tests and build**

~~~bash
node --test --experimental-strip-types src/lib/print-production/supplierPresentation.test.ts
pnpm exec vite build
~~~

Expected: both Pod2Admin and PrintProductWizard compile; advanced mode remains visually and behaviorally available.

- [ ] **Step 8: Commit guided intake**

~~~bash
git add src/lib/print-production/supplierPresentation.ts src/lib/print-production/supplierPresentation.test.ts src/pages/admin/Pod2Admin.tsx src/components/admin/print-production/PrintProductWizard.tsx src/components/admin/print-production/PrintProductionShell.tsx
git commit -m "feat(pod2): add guided supplier product intake"
~~~

### Task 6: Products List And Selected-Shop Distribution

**Files:**
- Create: src/components/admin/print-production/PrintProductionProducts.tsx
- Create: src/lib/print-production/distribution.ts
- Create: src/lib/print-production/distribution.test.ts
- Create: src/components/admin/print-production/PrintProductionDistribution.tsx
- Modify: src/components/admin/print-production/PrintProductWizard.tsx
- Modify: src/components/admin/print-production/PrintProductionShell.tsx

**Interfaces:**
- Consumes: PrintProductionSnapshot and send_product_to_tenants RPC.
- Produces: buildDistributionRequest(), distributeProduct(), and explicit selected-shop UI.

- [ ] **Step 1: Write failing distribution safety tests**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildDistributionRequest, selectAllShops } from "./distribution.ts";

test("distribution rejects an empty selection", () => {
  assert.throws(
    () => buildDistributionRequest({ productId: "product-1", selectedTenantIds: [] }),
    /mindst én butik/i,
  );
});

test("distribution removes master and duplicate ids", () => {
  assert.deepEqual(
    buildDistributionRequest({
      productId: "product-1",
      selectedTenantIds: ["tenant-a", "tenant-a", "00000000-0000-0000-0000-000000000000"],
    }),
    {
      master_product_id: "product-1",
      tenant_ids: ["tenant-a"],
      delivery_mode: "pod_price_list",
    },
  );
});

test("select all is explicit and derives only from eligible shops", () => {
  assert.deepEqual(
    selectAllShops([
      { id: "a", eligible: true },
      { id: "b", eligible: false },
    ]),
    ["a"],
  );
});
~~~

- [ ] **Step 2: Implement distribution.ts**

Export buildDistributionRequest(), selectAllShops(), and an async distributeProduct(client, input) wrapper. The wrapper calls send_product_to_tenants once, returns copied/notified/skipped counts, and throws the RPC message without mutating local selection state.

- [ ] **Step 3: Implement the products list**

Render a dense list with search and filters for status, supplier, category, shop, and price readiness. Each row offers:

- Gennemse;
- Klargør when blocked;
- Send til butikker only when ready or distributed;
- Åbn produkt when imported.

Do not expose raw variant signatures or supplier payloads.

- [ ] **Step 4: Implement the distribution view**

Show products by shop and shops by product. Default selectedTenantIds to an empty array every time the dialog opens. Put Vælg alle beside, not inside, the primary action. Show a final summary listing every selected shop before Send til butikker runs.

For independent tenants with pod2_auto_forward false, mark the shop Ikke klar til automatisk afregning and disable selection. Webprinter-owned tenants already configured with pod2_auto_forward true remain eligible.

- [ ] **Step 5: Connect wizard completion**

After a successful master import, keep the wizard open at Send til butikker. Call distributeProduct() only when the operator confirms. On partial RPC results, show copied/notified counts and retain the selection for retry.

- [ ] **Step 6: Run tests and build**

~~~bash
node --test --experimental-strip-types src/lib/print-production/distribution.test.ts
pnpm exec vite build
~~~

- [ ] **Step 7: Commit products and distribution**

~~~bash
git add src/components/admin/print-production/PrintProductionProducts.tsx src/lib/print-production/distribution.ts src/lib/print-production/distribution.test.ts src/components/admin/print-production/PrintProductionDistribution.tsx src/components/admin/print-production/PrintProductWizard.tsx src/components/admin/print-production/PrintProductionShell.tsx
git commit -m "feat(pod2): add selected shop product distribution"
~~~

### Task 7: Validation-First Production Orders

**Files:**
- Create: src/lib/print-production/orderSubmission.ts
- Create: src/lib/print-production/orderSubmission.test.ts
- Create: src/components/admin/print-production/PrintProductionOrders.tsx
- Modify: src/components/admin/print-production/PrintProductionShell.tsx

**Interfaces:**
- Consumes: usePodSubmitToPrintcom(), usePodSyncPrintcomStatus(), classifyOrder(), and PodFulfillmentJob.
- Produces: buildValidationRequest(), canConfirmRealSubmission(), and the master order queue.

- [ ] **Step 1: Write failing order-safety tests**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValidationRequest,
  canConfirmRealSubmission,
} from "./orderSubmission.ts";

test("validation always uses dry run", () => {
  assert.deepEqual(buildValidationRequest("job-1", "invoice"), {
    jobId: "job-1",
    paymentMethod: "invoice",
    dryRun: true,
  });
});

test("real send requires a successful validation for the same job", () => {
  assert.equal(canConfirmRealSubmission({
    jobId: "job-1",
    status: "paid",
    printcomOrderId: null,
    validatedJobId: "job-1",
    validationPassed: true,
  }), true);
  assert.equal(canConfirmRealSubmission({
    jobId: "job-1",
    status: "paid",
    printcomOrderId: "2106321",
    validatedJobId: "job-1",
    validationPassed: true,
  }), false);
});
~~~

- [ ] **Step 2: Implement orderSubmission.ts**

Allow real submission only for paid, awaiting_approval, or processing jobs, plus submitted jobs with no printcom_order_id. Require a passing dry run tied to the same job ID. A stored printcom_order_id always disables real submission.

- [ ] **Step 3: Implement the order queue**

Group jobs into Kræver handling, Klar til produktion, Hos leverandøren, Afsluttet, and Afventer. Show customer, tenant shop, product, quantity, delivery, file state, supplier state, and next action. Keep job UUID and raw variant signature in an advanced details disclosure only.

- [ ] **Step 4: Implement Kontrollér ordre**

Call usePodSubmitToPrintcom() with dryRun true. Convert the response into:

- green Klar til produktion with summarized options;
- amber Leverandøren skal gennemgå filen when the supplier response indicates MANUALCHECK;
- red blocking message with one recovery action.

Raw payload and raw response remain inside Tekniske detaljer.

- [ ] **Step 5: Implement explicit real-send confirmation**

The confirmation shows supplier, tenant shop, recipient, expected supplier cost, payment method, and a warning that the action creates a supplier order. Call the same hook with dryRun false only after canConfirmRealSubmission() passes.

After an uncertain error, clear validation state, refetch jobs, and instruct the operator to verify whether a supplier order reference was stored. Do not retry automatically.

- [ ] **Step 6: Keep the manual fallback advanced**

Link to the existing /admin/pod2-ordrer dialog for manual forwarding. Do not copy Marker som videresendt manuelt into the normal queue.

- [ ] **Step 7: Run tests and build**

~~~bash
node --test --experimental-strip-types src/lib/print-production/orderSubmission.test.ts
pnpm exec vite build
~~~

- [ ] **Step 8: Commit the order queue**

~~~bash
git add src/lib/print-production/orderSubmission.ts src/lib/print-production/orderSubmission.test.ts src/components/admin/print-production/PrintProductionOrders.tsx src/components/admin/print-production/PrintProductionShell.tsx
git commit -m "feat(pod2): add validation first production queue"
~~~

### Task 8: Operational Settings And Advanced Tools

**Files:**
- Create: src/components/admin/print-production/PrintProductionSettings.tsx
- Create: src/components/admin/print-production/AdvancedToolsLinks.tsx
- Modify: src/components/admin/print-production/PrintProductionShell.tsx
- Modify: src/lib/print-production/usePrintProductionData.ts

**Interfaces:**
- Consumes: active connection, getSupplierCapabilities(), status-sync mutation, and existing legacy routes.
- Produces: operational setup view without exposing credentials by default.

- [ ] **Step 1: Implement operational settings**

Show:

- active supplier configuration;
- verified capabilities;
- an explanation that Webprinter billing identity is server-side and checked by
  Kontrollér ordre before every live submission;
- managed-shop readiness count;
- the last status synchronization result from the current session;
- button to synchronize supplier status.

Do not render API keys, auth headers, raw base URLs, or payloads in the normal settings view.

- [ ] **Step 2: Implement advanced links**

Provide labeled links to:

- /admin/pod2 with label Leverandør og API;
- /admin/pod2-katalog with label Katalog og matrix;
- /admin/pod2-ordrer with label Teknisk ordrebehandling;
- /admin/pod2-betaling with label Historisk tenant-afregning;
- /admin/pod with label POD v1;
- /admin/pod3 with label Flyer Alarm-arbejdsområde.

Preserve force_domain on every internal link.

- [ ] **Step 3: Add honest capability copy**

Print.com shows Katalog, priser, validering, indsendelse, and statussynkronisering as available. Cancellation is shown as Ikke tilgængelig. Any other provider shows live submission disabled.

- [ ] **Step 4: Build and commit**

~~~bash
pnpm exec vite build
git add src/components/admin/print-production/PrintProductionSettings.tsx src/components/admin/print-production/AdvancedToolsLinks.tsx src/components/admin/print-production/PrintProductionShell.tsx src/lib/print-production/usePrintProductionData.ts
git commit -m "feat(pod2): add print production settings"
~~~

### Task 9: Tenant Simplicity And Language Boundary

**Files:**
- Modify: src/components/admin/TenantUpdates.tsx
- Modify: src/components/admin/AdminSidebar.tsx
- Modify: src/components/admin/ShopModules.tsx

**Interfaces:**
- Consumes: existing tenant notification and sync_specific_product flow.
- Produces: ordinary Webprinter product language with no tenant POD navigation.

- [ ] **Step 1: Replace tenant-visible POD wording**

In TenantUpdates:

- replace POD-pris with Webprinter-styret produkt;
- replace Importer Produkt with Tilføj produkt;
- keep the underlying delivery_mode value pod_price_list unchanged;
- keep sync_specific_product and notification acceptance unchanged.

- [ ] **Step 2: Remove tenant POD navigation**

In the non-master sidebar section, remove visible links to pod2-ordrer, pod2-betaling, and pod3. Remove the tenant Print on Demand link to pod-katalog from the normal module/navigation group.

Do not delete or redirect the routes in this task; rollback requires them to remain reachable.

- [ ] **Step 3: Remove the tenant module card**

Remove the print-on-demand object from SHOP_MODULES. Master access is provided by the new Printproduktion sidebar entry in Task 10.

- [ ] **Step 4: Build and manually inspect tenant copy**

~~~bash
pnpm exec vite build
~~~

Expected: build passes; no normal tenant navigation label contains POD, Print.com, or supplier cost wording.

- [ ] **Step 5: Commit tenant simplification**

~~~bash
git add src/components/admin/TenantUpdates.tsx src/components/admin/AdminSidebar.tsx src/components/admin/ShopModules.tsx
git commit -m "feat(pod2): simplify tenant product handoff"
~~~

### Task 10: Master Navigation Consolidation

**Files:**
- Modify: src/components/admin/AdminSidebar.tsx
- Modify: src/pages/Admin.tsx

**Interfaces:**
- Consumes: /admin/printproduktion and existing legacy POD routes.
- Produces: one normal master sidebar entry plus redirects for obsolete convenience URLs only.

- [ ] **Step 1: Add one master entry**

Under Platform, render one Printer-icon link:

~~~tsx
<AdminNavLink to="/admin/printproduktion">
  <Printer className="h-4 w-4" />
  {!collapsed && <span>Printproduktion</span>}
</AdminNavLink>
~~~

- [ ] **Step 2: Remove duplicate master sidebar entries**

Remove visible master entries for /admin/pod, /admin/pod2, /admin/pod3, and /admin/pod2-ordrer. Do not remove their route declarations.

- [ ] **Step 3: Add a compatibility redirect**

Keep every legacy route rendered as before. Add no redirect from legacy routes during this rollout. The only new route is /admin/printproduktion.

- [ ] **Step 4: Build and commit**

~~~bash
pnpm exec vite build
git add src/components/admin/AdminSidebar.tsx src/pages/Admin.tsx
git commit -m "feat(pod2): consolidate print production navigation"
~~~

### Task 11: Documentation, Regression Tests, And Browser QA

**Files:**
- Modify: POD2_README.md
- Modify: AI_CONTINUITY.md
- Test: src/lib/print-production/*.test.ts

**Interfaces:**
- Consumes: every previous task.
- Produces: verified local release candidate and explicit rollback instructions.

- [ ] **Step 1: Update POD2_README.md**

Document:

- /admin/printproduktion as the default master operating route;
- the five normal views;
- selected-shop default behavior;
- tenant ordinary-product boundary;
- Print.com-only live submission;
- legacy route rollback list;
- no changes to POD v1 or pricing.

- [ ] **Step 2: Update AI_CONTINUITY.md**

Add the implementation status, key files, safety decisions, verification commands, and remaining live canary requirement. Do not claim a live supplier order was tested unless one was explicitly approved and completed.

- [ ] **Step 3: Run all focused tests**

~~~bash
node --test --experimental-strip-types src/lib/print-production/*.test.ts
~~~

Expected: all print-production tests pass.

- [ ] **Step 4: Run repository checks**

~~~bash
pnpm exec vite build
pnpm exec eslint src/lib/print-production src/components/admin/print-production src/pages/admin/PrintProduction.tsx
~~~

Expected: production build passes and no new lint error is reported in the new files.

- [ ] **Step 5: Start a fresh local server**

~~~bash
pnpm dev -- --host 127.0.0.1 --port 8086
~~~

Open:

http://127.0.0.1:8086/admin/printproduktion?force_domain=webprinter.dk

- [ ] **Step 6: Run read-only browser QA**

Using the signed-in in-app browser:

- verify master route access and tenant-context redirect;
- verify all five views and browser back/forward behavior;
- verify empty, loading, error, ready, and attention states;
- verify 1440x1000 and 390x844 layouts without overlap or clipped text;
- verify no raw supplier data appears in normal views;
- verify legacy advanced links preserve force_domain;
- verify no tenant sidebar entry exposes POD controls.

Capture screenshots for overview, products, distribution, and orders.

- [ ] **Step 7: Run safe interaction QA**

- use Kontrollér ordre only with dryRun true;
- do not place a live supplier order during automated QA;
- do not import or distribute a real product unless the user explicitly approves the exact product and tenant shops;
- verify the selected-shop dialog starts empty and Vælg alle is explicit;
- verify closing and reopening the dialog clears the selection.

- [ ] **Step 8: Review the final diff**

~~~bash
git diff --check
git diff --stat
git status --short
~~~

Confirm that no pricing engine file, POD v1 file, Supplier Bank file, migration, or unrelated dirty file is staged.

- [ ] **Step 9: Commit documentation and QA fixes**

~~~bash
git add POD2_README.md AI_CONTINUITY.md src/lib/print-production src/components/admin/print-production src/pages/admin/PrintProduction.tsx
git commit -m "docs(pod2): document print production control center"
~~~

- [ ] **Step 10: Record the release decision**

Report:

- local URL;
- focused test result;
- build result;
- browser QA result;
- whether any write action was intentionally skipped;
- legacy rollback routes;
- exact remaining requirement before live supplier use.
