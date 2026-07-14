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
