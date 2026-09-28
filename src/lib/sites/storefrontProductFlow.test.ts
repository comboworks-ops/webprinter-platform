import assert from "node:assert/strict";
import test from "node:test";

import { resolveStorefrontProductFlow } from "./storefrontProductFlow.ts";

test("a linked PDF template selects the template Designer flow when the product has no explicit mode", () => {
  const flow = resolveStorefrontProductFlow({
    name: "Julekalender Multi med mærkechokolade",
    pricing_type: "matrix",
    technical_specs: {},
    template_files: [{ url: "https://example.test/calendar-template.pdf" }],
  });

  assert.equal(flow.designerMode, "pdf_template");
  assert.equal(flow.pricingModel, "template_product");
  assert.equal(flow.prefersTemplateOverlay, true);
  assert.equal(flow.designerCtaLabel, "Design i skabelon");
});

test("an explicit non-template mode is not overridden by a downloadable PDF", () => {
  const flow = resolveStorefrontProductFlow({
    name: "Dokumentprodukt",
    pricing_type: "matrix",
    technical_specs: {
      site_modes: {
        designer_mode: "flat_print",
        pricing_model: "matrix",
      },
    },
    template_files: [{ url: "https://example.test/instructions.pdf" }],
  });

  assert.equal(flow.designerMode, "flat_print");
  assert.equal(flow.pricingModel, "matrix");
});
