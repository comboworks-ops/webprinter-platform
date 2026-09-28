import assert from "node:assert/strict";
import test from "node:test";

import { resolveActiveSiteCatalogId } from "./activeSiteCatalog.ts";

test("does not scope the catalog for localhost storefront previews", () => {
  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: "banner-builder-pro",
    hostname: "127.0.0.1",
    rootDomain: "webprinter.dk",
  }), null);

  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: "banner-builder-pro",
    hostname: "localhost",
    rootDomain: "webprinter.dk",
  }), null);
});

test("does not scope the Webprinter root catalog", () => {
  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: "banner-builder-pro",
    hostname: "webprinter.dk",
    rootDomain: "webprinter.dk",
  }), null);

  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: "banner-builder-pro",
    hostname: "www.webprinter.dk",
    rootDomain: "webprinter.dk",
  }), null);
});

test("keeps site-specific filtering on a tenant domain", () => {
  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: "tee-design-hub",
    hostname: "shirtshop.example.dk",
    rootDomain: "webprinter.dk",
  }), "tee-design-hub");
});

test("ignores missing or malformed active site ids", () => {
  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: "",
    hostname: "shop.example.dk",
  }), null);
  assert.equal(resolveActiveSiteCatalogId({
    activeSiteId: 42,
    hostname: "shop.example.dk",
  }), null);
});
