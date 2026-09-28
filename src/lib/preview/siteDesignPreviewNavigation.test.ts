import assert from "node:assert/strict";
import test from "node:test";

import {
  SITE_DESIGN_PREVIEW_EXIT_LINK_PROPS,
  getSiteDesignPreviewPathname,
  getSiteDesignPreviewProductSlug,
  normalizeSiteDesignPreviewPath,
} from "./siteDesignPreviewNavigation.ts";

test("explicit preview exits bypass virtual navigation and leave an iframe", () => {
  assert.deepEqual(SITE_DESIGN_PREVIEW_EXIT_LINK_PROPS, {
    "data-preview-exit": "true",
    target: "_top",
  });
});

test("preview paths remove editor context without losing product options", () => {
  assert.equal(
    normalizeSiteDesignPreviewPath(
      "/produkt/aluminium?tenantId=master&force_domain=webprinter.dk&format=a3",
    ),
    "/produkt/aluminium?format=a3",
  );
});

test("product slugs are extracted without tenant query parameters", () => {
  assert.equal(
    getSiteDesignPreviewProductSlug(
      "/produkt/standard-sales-mapper?tenantId=master",
    ),
    "standard-sales-mapper",
  );
  assert.equal(getSiteDesignPreviewProductSlug("/produkter"), null);
});

test("pathname resolution is stable for absolute and missing values", () => {
  assert.equal(
    getSiteDesignPreviewPathname(
      "https://webprinter.dk/checkout?force_domain=webprinter.dk",
    ),
    "/checkout",
  );
  assert.equal(normalizeSiteDesignPreviewPath(undefined), "/");
});
