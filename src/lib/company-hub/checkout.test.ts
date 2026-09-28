import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanyHubCheckoutState,
  CompanyHubCheckoutError,
  type CompanyHubCheckoutContext,
} from "./checkout.ts";
import type { SiteCheckoutState } from "../checkout/siteCheckoutSession.ts";

const context: CompanyHubCheckoutContext = {
  companyId: "company-1",
  companyOfficeId: "office-1",
  companyAddressId: "address-1",
  companyCatalogItemId: "item-1",
  companyOrderRequestId: "request-1",
};

const validState: SiteCheckoutState = {
  productId: "product-1",
  productSlug: "visitkort",
  productName: "Visitkort",
  quantity: 100,
  productPrice: 450,
  totalPrice: 500,
  pricingQuote: {
    productId: "product-1",
    productSlug: "visitkort",
    quantity: 100,
  },
};

test("Company Hub checkout rejects a zero-price handoff", () => {
  assert.throws(
    () => buildCompanyHubCheckoutState({ ...validState, productPrice: 0, totalPrice: 0 }, context),
    (error) => error instanceof CompanyHubCheckoutError
      && error.code === "invalid_price"
      && /gyldig pris/i.test(error.message),
  );
});

test("Company Hub checkout requires the existing verified quote contract", () => {
  assert.throws(
    () => buildCompanyHubCheckoutState({ ...validState, pricingQuote: null }, context),
    (error) => error instanceof CompanyHubCheckoutError && error.code === "missing_quote",
  );
});

test("Company Hub checkout rejects a quote for another product or quantity", () => {
  assert.throws(
    () => buildCompanyHubCheckoutState({
      ...validState,
      pricingQuote: { productId: "another-product", quantity: 50 },
    }, context),
    (error) => error instanceof CompanyHubCheckoutError && error.code === "quote_mismatch",
  );
});

test("Company Hub checkout carries scoped context into the existing state", () => {
  const result = buildCompanyHubCheckoutState(validState, context);

  assert.equal(result.companyId, context.companyId);
  assert.equal(result.companyOfficeId, context.companyOfficeId);
  assert.equal(result.companyAddressId, context.companyAddressId);
  assert.equal(result.companyCatalogItemId, context.companyCatalogItemId);
  assert.equal(result.companyOrderRequestId, context.companyOrderRequestId);
  assert.deepEqual(result.pricingQuote, validState.pricingQuote);
  assert.equal(result.totalPrice, validState.totalPrice);
});
