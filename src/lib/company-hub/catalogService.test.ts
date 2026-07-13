import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanyCatalogItemInsert,
  buildCompanyCatalogItemUpdate,
} from "./catalogService.ts";

const scope = { tenantId: "tenant-1", companyId: "company-1" };

test("catalogue item stores a product reference without copied pricing", () => {
  const payload = buildCompanyCatalogItemInsert(scope, {
    productId: "product-1",
    title: "Visitkort",
    defaultQuantity: 250,
    status: "draft",
  });

  assert.equal(payload.tenant_id, "tenant-1");
  assert.equal(payload.company_id, "company-1");
  assert.equal(payload.product_id, "product-1");
  assert.equal(payload.default_quantity, 250);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "price"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "pricing_rows"), false);
});

test("catalogue item rejects zero quantity", () => {
  assert.throws(
    () => buildCompanyCatalogItemInsert(scope, {
      productId: "product-1",
      title: "Visitkort",
      defaultQuantity: 0,
    }),
    /positivt heltal/i,
  );
});

test("catalogue updates cannot alter tenant, company, or product identity", () => {
  const payload = buildCompanyCatalogItemUpdate({
    title: "Nyt navn",
    status: "active",
    requiresApproval: true,
  });
  assert.deepEqual(payload, {
    title: "Nyt navn",
    status: "active",
    requires_approval: true,
  });
});
