import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOptimisticProductAboutUpdate,
  haveTemplateFilesChanged,
  includeTemplateFilesWhenChanged,
} from "./productAboutTemplatePersistence.ts";

test("gallery-only updates omit template_files completely", () => {
  const templateFiles = [{
    name: "calendar.pdf",
    sha256: "abc123",
    guideGeometry: { trim: [1, 2, 3, 4] },
  }];
  const payload = { technical_specs: { product_page_info_v2: { blocks: [] } } };

  const result = includeTemplateFilesWhenChanged(
    payload,
    structuredClone(templateFiles),
    templateFiles,
  );

  assert.equal(haveTemplateFilesChanged(templateFiles, templateFiles), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "template_files"), false);
  assert.equal(result, payload);
});

test("explicit template edits retain every unknown template field", () => {
  const original = [{
    name: "calendar.pdf",
    format: "",
    sha256: "abc123",
    supplierEvidence: {
      sourceUrl: "https://supplier.example/template.pdf",
      sourceIndex: 17,
    },
    guideGeometry: {
      trim: [1, 2, 3, 4],
      folds: [{ x: 24.5, kind: "mountain" }],
    },
  }];
  const current = [{ ...original[0], format: "A4" }];
  const unknownFieldsBefore = JSON.stringify({
    sha256: original[0].sha256,
    supplierEvidence: original[0].supplierEvidence,
    guideGeometry: original[0].guideGeometry,
  });

  const result = includeTemplateFilesWhenChanged(
    { technical_specs: {} },
    current,
    original,
  );

  assert.equal(haveTemplateFilesChanged(current, original), true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "template_files"), true);
  assert.equal((result as { template_files: unknown[] }).template_files, current);

  const persistedTemplate = (result as {
    template_files: Array<Record<string, unknown>>;
  }).template_files[0];
  assert.equal(JSON.stringify({
    sha256: persistedTemplate.sha256,
    supplierEvidence: persistedTemplate.supplierEvidence,
    guideGeometry: persistedTemplate.guideGeometry,
  }), unknownFieldsBefore);
});

test("gallery edits merge onto fresh unrelated technical metadata and carry the optimistic version", () => {
  const original = {
    about_title: "Om kalenderen",
    about_description: "Beskrivelse",
    about_image_url: null,
    technical_specs: {
      supplier_key: "calendar-supplier",
      product_page_info_v2: {
        useSections: true,
        blocks: [{ id: "gallery-a", type: "gallery", images: ["one.png"] }],
      },
    },
    template_files: [{ name: "calendar.pdf", sha256: "original" }],
  };
  const current = {
    ...structuredClone(original),
    updated_at: "2026-08-28T10:15:00.000Z",
    technical_specs: {
      ...structuredClone(original.technical_specs),
      importer_audit: { runId: "run-42" },
    },
  };
  const edited = structuredClone(original);
  edited.technical_specs.product_page_info_v2.blocks[0].images = ["one.png", "two.png"];

  const result = buildOptimisticProductAboutUpdate({ current, original, edited });

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.expectedUpdatedAt, current.updated_at);
  assert.deepEqual(result.payload, {
    technical_specs: {
      supplier_key: "calendar-supplier",
      importer_audit: { runId: "run-42" },
      product_page_info_v2: edited.technical_specs.product_page_info_v2,
    },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(result.payload, "template_files"), false);
});

test("a newer edit to the same gallery returns a clear conflict instead of a payload", () => {
  const originalInfo = {
    useSections: true,
    blocks: [{ id: "gallery-a", type: "gallery", images: ["one.png"] }],
  };
  const base = {
    about_title: null,
    about_description: null,
    about_image_url: null,
    technical_specs: { product_page_info_v2: originalInfo },
    template_files: [],
  };

  const result = buildOptimisticProductAboutUpdate({
    original: base,
    current: {
      ...base,
      updated_at: "2026-08-28T10:16:00.000Z",
      technical_specs: {
        product_page_info_v2: {
          ...originalInfo,
          blocks: [{ id: "gallery-a", type: "gallery", images: ["server.png"] }],
        },
      },
    },
    edited: {
      ...base,
      technical_specs: {
        product_page_info_v2: {
          ...originalInfo,
          blocks: [{ id: "gallery-a", type: "gallery", images: ["local.png"] }],
        },
      },
    },
  });

  assert.deepEqual(result, { status: "conflict", field: "product_page_info_v2" });
});

test("concurrent template edits conflict while gallery-only saves preserve fresh templates", () => {
  const original = {
    about_title: null,
    about_description: null,
    about_image_url: null,
    technical_specs: { product_page_info_v2: { useSections: true, blocks: [] } },
    template_files: [{ name: "calendar.pdf", sha256: "old" }],
  };
  const current = {
    ...structuredClone(original),
    updated_at: "2026-08-28T10:17:00.000Z",
    template_files: [{ name: "calendar.pdf", sha256: "server" }],
  };
  const edited = {
    ...structuredClone(original),
    template_files: [{ name: "calendar.pdf", sha256: "local" }],
  };

  assert.deepEqual(
    buildOptimisticProductAboutUpdate({ current, original, edited }),
    { status: "conflict", field: "template_files" },
  );

  const galleryOnly = structuredClone(original);
  galleryOnly.technical_specs.product_page_info_v2.blocks.push({
    id: "gallery-a",
    type: "gallery",
    images: ["one.png"],
  });
  const safeResult = buildOptimisticProductAboutUpdate({ current, original, edited: galleryOnly });
  assert.equal(safeResult.status, "ready");
  if (safeResult.status !== "ready") return;
  assert.equal(Object.prototype.hasOwnProperty.call(safeResult.payload, "template_files"), false);
});
