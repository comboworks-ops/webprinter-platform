import assert from "node:assert/strict";
import test from "node:test";

import { resolveSelectedDesignerTemplateLaunch } from "../../../src/lib/designer/productTemplateLinks.ts";
import { buildProductTemplateFile } from "../import-wmd-advent-calendar-product-drafts.js";

const uploadedAt = "2026-08-27T12:00:00.000Z";

function buildTemplateFile(manifest, document, index) {
  return buildProductTemplateFile({
    manifest,
    document,
    template: { id: `designer-template-${index}` },
    pdfUrl: `https://example.test/${document.key}.pdf`,
    objectPath: `template-pdfs/${document.key}.pdf`,
    uploadedAt,
  });
}

test("Lindt filling-only bindings resolve both Designer templates without treating PDF format as a selection", () => {
  const manifest = {
    product: { nameDa: "Lindt Lindor bordjulekalender" },
    templateBindingAxes: ["filling"],
    optionGroups: [
      { key: "format" },
      { key: "material" },
      { key: "filling" },
    ],
    documents: [
      {
        key: "lindor-table",
        match: { filling: "Lindt Lindor Liliput" },
        template: {
          finalFormat: "362 × 434 mm",
          widthMm: 368,
          heightMm: 440,
          bleedMm: 3,
          safeMm: 5,
          sanitizedPdfSha256: "a".repeat(64),
          designerLoadMode: "locked_non_printing_guide_overlay",
          lockedInDesigner: true,
          nonPrintingOverlay: true,
          excludedFromExport: true,
        },
      },
      {
        key: "lindor-mix-table",
        match: { filling: "Lindt Lindor chokolademix" },
        template: {
          finalFormat: "362 × 434 mm",
          widthMm: 368,
          heightMm: 440,
          bleedMm: 3,
          safeMm: 5,
          sanitizedPdfSha256: "b".repeat(64),
          designerLoadMode: "locked_non_printing_guide_overlay",
          lockedInDesigner: true,
          nonPrintingOverlay: true,
          excludedFromExport: true,
        },
      },
    ],
  };
  const templates = manifest.documents.map((document, index) => (
    buildTemplateFile(manifest, document, index)
  ));

  for (const template of templates) {
    assert.equal(Object.hasOwn(template, "format"), false);
    assert.equal(template.widthMm, 368);
    assert.equal(template.heightMm, 440);
    assert.equal(template.bleedMm, 3);
    assert.equal(template.safeMm, 5);
  }

  manifest.documents.forEach((document, index) => {
    const launch = resolveSelectedDesignerTemplateLaunch({
      templates,
      selectedFormatLabel: "434 × 362 mm",
      selectedOptionLabels: [
        "434 × 362 mm",
        "300 g/m² GC1-karton",
        document.match.filling,
      ],
    });

    assert.equal(launch?.templateId, `designer-template-${index}`);
    assert.equal(launch?.pdfUrl, `https://example.test/${document.key}.pdf`);
  });
});

test("format-bound manifests keep the exact storefront format constraint and separate PDF geometry", () => {
  const document = {
    key: "a4-folder",
    match: { format: "A4 – lukket format" },
    template: {
      finalFormat: "216 × 303 mm",
      widthMm: 216,
      heightMm: 303,
      bleedMm: 3,
      safeMm: 5,
      sanitizedPdfSha256: "c".repeat(64),
      designerLoadMode: "locked_non_printing_guide_overlay",
      lockedInDesigner: true,
      nonPrintingOverlay: true,
      excludedFromExport: true,
    },
  };
  const manifest = {
    product: { nameDa: "A4-produkt" },
    templateBindingAxes: ["format"],
    optionGroups: [{ key: "format" }],
    documents: [document],
  };
  const template = buildTemplateFile(manifest, document, 0);

  assert.equal(template.format, document.match.format);
  assert.notEqual(template.format, document.template.finalFormat);
  assert.equal(template.widthMm, 216);
  assert.equal(template.heightMm, 303);
  assert.equal(template.bleedMm, 3);
  assert.equal(template.safeMm, 5);

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedFormatLabel: "A4 – lukket format",
    selectedOptionLabels: ["A4 – lukket format"],
  })?.templateId, "designer-template-0");

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedFormatLabel: "A5 – lukket format",
    selectedOptionLabels: ["A5 – lukket format"],
  }), null);
});
