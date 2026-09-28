import assert from "node:assert/strict";
import test from "node:test";

import { buildCompanyOrderConfiguration } from "./requestService.ts";

test("company order configuration stores choices but never becomes a copied price source", () => {
  const configuration = buildCompanyOrderConfiguration({
    selectedVariant: "300 g mat",
    selectedFormat: "A4",
    optionSelections: { finish: { optionId: "finish-1", name: "Mat lak", extraPrice: 20 } },
    companyWorkingDesignId: "design-1",
    productPrice: 500,
    totalPrice: 550,
  });

  assert.equal(configuration.selectedVariant, "300 g mat");
  assert.equal(configuration.companyWorkingDesignId, "design-1");
  assert.equal(Object.prototype.hasOwnProperty.call(configuration, "productPrice"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(configuration, "totalPrice"), false);
});
