import assert from "node:assert/strict";
import test from "node:test";

import { stripPdfTemplateOverlaysFromCanvasJson } from "./templateOverlaySerialization.ts";

test("page-draft canvas JSON excludes locked PDF template overlays", () => {
  const snapshot = {
    version: "5.3.0",
    objects: [
      { id: "customer-artwork", type: "image" },
      { id: "technical-template", __isPdfTemplate: true, data: { kind: "pdf_template_overlay" } },
      { id: "legacy-template", data: { kind: "pdf_template_overlay" } },
    ],
  };

  assert.deepEqual(stripPdfTemplateOverlaysFromCanvasJson(snapshot), {
    version: "5.3.0",
    objects: [{ id: "customer-artwork", type: "image" }],
  });
  assert.equal(snapshot.objects.length, 3);
});
