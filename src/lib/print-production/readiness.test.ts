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
