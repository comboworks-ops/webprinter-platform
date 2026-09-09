import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDesignerDocumentParams,
  buildCurrentInternalPath,
  buildDesignerCheckoutPath,
  buildProductFallbackPath,
  getSafeInternalPath,
} from "./orderFlowNavigation.ts";

test("designer launch keeps the format label and exact numeric dimensions", () => {
  const params = new URLSearchParams();

  applyDesignerDocumentParams(params, {
    formatLabel: "74 x 105 mm",
    widthMm: 74,
    heightMm: 105,
    bleedMm: 3,
    safeMm: 3,
  });

  assert.equal(params.get("format"), "74 x 105 mm");
  assert.equal(params.get("widthMm"), "74");
  assert.equal(params.get("heightMm"), "105");
  assert.equal(params.get("bleedMm"), "3");
  assert.equal(params.get("safeMm"), "3");
});

test("only same-site internal return paths are accepted", () => {
  assert.equal(getSafeInternalPath("/produkt/aluminium?force_domain=webprinter.dk"), "/produkt/aluminium?force_domain=webprinter.dk");
  assert.equal(getSafeInternalPath("//example.com/checkout"), null);
  assert.equal(getSafeInternalPath("/\\example.com/checkout"), null);
  assert.equal(getSafeInternalPath("https://example.com/checkout"), null);
  assert.equal(getSafeInternalPath("checkout/konfigurer"), null);
});

test("current product path keeps its complete local query", () => {
  assert.equal(
    buildCurrentInternalPath("/produkt/aluminium", "?force_domain=webprinter.dk&debug=true"),
    "/produkt/aluminium?force_domain=webprinter.dk&debug=true",
  );
});

test("designer checkout destination keeps storefront context only", () => {
  assert.equal(
    buildDesignerCheckoutPath(new URLSearchParams("force_domain=webprinter.dk&debug=true")),
    "/checkout/konfigurer?force_domain=webprinter.dk",
  );
});

test("product fallback keeps storefront context and encodes the slug", () => {
  assert.equal(
    buildProductFallbackPath(
      "standard salgsmappe",
      new URLSearchParams("force_domain=www.salgsmapper.dk&payment_intent=ignored"),
    ),
    "/produkt/standard%20salgsmappe?force_domain=www.salgsmapper.dk",
  );
});
