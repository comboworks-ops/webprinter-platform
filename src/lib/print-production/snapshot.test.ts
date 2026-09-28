import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrintProductionSnapshot,
  hasActiveOrderFlow,
  selectOverviewRows,
} from "./snapshot.ts";

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
    masterProducts: [{ id: "product-1", name: "Flyer", slug: "flyer", category: "Flyers", image_url: "image", is_published: true, is_ready: true }],
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
    tenants: [{
      id: "tenant-a",
      name: "A",
      domain: "a.dk",
      pod2_auto_forward: true,
      supplier_product_data: { supplier_secret: "must-not-leak" },
    }],
  } as never);
  assert.equal("supplier_product_data" in snapshot.tenants[0], false);
  assert.deepEqual(snapshot.tenants[0], {
    id: "tenant-a",
    name: "A",
    domain: "a.dk",
    pod2_auto_forward: true,
  });
});

test("overview selects at most three ready or distributed products", () => {
  const product = (id: string, status: "blocked" | "ready" | "distributed") => ({
    catalog: { id },
    readiness: { status },
  });
  const snapshot = {
    products: [
      product("ready-1", "ready"),
      product("blocked-1", "blocked"),
      product("distributed-1", "distributed"),
      product("ready-2", "ready"),
      product("distributed-2", "distributed"),
    ],
    jobs: [],
  } as never;

  const result = selectOverviewRows(snapshot);

  assert.deepEqual(result.products.map((row) => row.catalog.id), [
    "ready-1",
    "distributed-1",
    "ready-2",
  ]);
});

test("overview selects two action jobs with failures before the oldest paid jobs", () => {
  const snapshot = {
    products: [],
    jobs: [
      { id: "paid-new", status: "paid", created_at: "2026-07-14T10:00:00Z" },
      { id: "completed", status: "completed", created_at: "2026-07-10T10:00:00Z" },
      { id: "paid-old", status: "paid", created_at: "2026-07-12T10:00:00Z" },
      { id: "submitted-without-provider", status: "submitted", printcom_order_id: null, created_at: "2026-07-11T10:00:00Z" },
      { id: "failed", status: "failed", created_at: "2026-07-14T11:00:00Z" },
    ],
  } as never;

  const result = selectOverviewRows(snapshot);

  assert.deepEqual(result.actionJobs.map((job) => job.id), ["failed", "paid-old"]);
});

test("order flow is active only while a job is currently in flight", () => {
  assert.equal(hasActiveOrderFlow([
    { status: "failed" },
    { status: "completed" },
  ] as never), false);
  assert.equal(hasActiveOrderFlow([{ status: "paid" }] as never), true);
  assert.equal(hasActiveOrderFlow([{ status: "processing" }] as never), true);
});

test("activity labels communicate catalog, distribution, and actual job status events", () => {
  const snapshot = buildPrintProductionSnapshot({
    connections: [],
    catalog: [{
      id: "catalog-activity",
      status: "draft",
      public_title: { da: "Flyer", en: "Flyer" },
      public_description: { da: "", en: "" },
      public_images: [],
      created_at: "2026-07-14T08:00:00Z",
      updated_at: "2026-07-14T09:00:00Z",
      pod2_catalog_price_matrix: [],
    }],
    imports: [{ catalog_product_id: "catalog-activity", product_id: "product-activity" }],
    masterProducts: [{
      id: "product-activity",
      name: "Flyer",
      slug: "flyer",
      category: "Tryksager",
      image_url: null,
      is_published: false,
      is_ready: false,
    }],
    tenants: [{
      id: "tenant-activity",
      name: "Butik A",
      domain: "butik-a.dk",
      pod2_auto_forward: true,
    }],
    notices: [{
      id: "notice-activity",
      tenant_id: "tenant-activity",
      status: "accepted",
      created_at: "2026-07-14T10:00:00Z",
      data: { product_id: "product-activity", delivery_mode: "pod_price_list" },
    }],
    jobs: [{
      id: "job-activity",
      tenant_id: "tenant-activity",
      product_name: "Flyer",
      status: "paid",
      created_at: "2026-07-14T11:00:00Z",
      updated_at: "2026-07-14T11:30:00Z",
    }],
  } as never);

  assert.equal(
    snapshot.activity.find((item) => item.id === "product-catalog-activity")?.label,
    "Produkt opdateret: Flyer",
  );
  assert.equal(
    snapshot.activity.find((item) => item.id === "notice-activity")?.label,
    "Distribution accepteret: Flyer hos Butik A",
  );
  assert.equal(
    snapshot.activity.find((item) => item.id === "order-job-activity")?.label,
    "Ordrestatus: Flyer · Betalt og klar til produktion",
  );
});
