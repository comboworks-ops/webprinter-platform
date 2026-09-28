import assert from "node:assert/strict";
import test from "node:test";

import { buildCompanyAuthUrl, withCompanyTenantContext } from "./navigation.ts";

test("Company Hub login returns to the same tenant and view", () => {
  const url = buildCompanyAuthUrl("?force_domain=webprinter.dk&view=orders");
  const params = new URLSearchParams(url.split("?")[1]);

  assert.equal(params.get("force_domain"), "webprinter.dk");
  assert.equal(params.get("redirect"), "/company?force_domain=webprinter.dk&view=orders");
});

test("Company Hub login remains an internal redirect without tenant parameters", () => {
  const url = buildCompanyAuthUrl("");
  const params = new URLSearchParams(url.split("?")[1]);

  assert.equal(params.get("redirect"), "/company");
});

test("product navigation keeps tenant context but drops the Company Hub view", () => {
  assert.equal(
    withCompanyTenantContext("/produkt/flyer", "?force_domain=webprinter.dk&view=products"),
    "/produkt/flyer?force_domain=webprinter.dk",
  );
});
