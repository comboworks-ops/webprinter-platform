import assert from "node:assert/strict";
import test from "node:test";

import {
  AXIS_ORDER,
  assertOutputCollision,
  assertZeroBlockers,
  descriptorForArtifact,
  projectOptionGroups,
  validateDocumentMode,
} from "../assemble-wmd-sales-folder-import-manifest.js";

test("zero-blocker preflight is required before manifest assembly", () => {
  assert.throws(() => assertZeroBlockers({
    counts: { blockers: 1 },
    blockers: [{ id: "guide_missing" }],
    eligibleForImportManifest: false,
    targetManifest: { schemaVersion: 2 },
  }), /remains blocked/);

  assert.doesNotThrow(() => assertZeroBlockers({
    counts: { blockers: 0 },
    blockers: [],
    eligibleForImportManifest: true,
    targetManifest: { schemaVersion: 2 },
  }));
});

test("external JSONL descriptors are byte, hash, and row pinned", () => {
  assert.deepEqual(descriptorForArtifact({
    path: "review/rows.jsonl",
    sha256: "a".repeat(64),
    byteSize: 42,
  }, 7), {
    path: "review/rows.jsonl",
    sha256: "a".repeat(64),
    bytes: 42,
    rowCount: 7,
    format: "jsonl",
  });
});

test("output collisions require check mode and identical bytes", () => {
  const expected = Buffer.from("same");
  assert.throws(() => assertOutputCollision({
    existingBytes: expected,
    expectedBytes: expected,
    check: false,
    label: "import-manifest.json",
  }), /already exists/);
  assert.doesNotThrow(() => assertOutputCollision({
    existingBytes: expected,
    expectedBytes: expected,
    check: true,
    label: "import-manifest.json",
  }));
  assert.throws(() => assertOutputCollision({
    existingBytes: Buffer.from("drift"),
    expectedBytes: expected,
    check: true,
    label: "import-manifest.json",
  }), /differs/);
});

test("online and professional PDF modes remain mutually exclusive", () => {
  assert.equal(validateDocumentMode({
    artworkMode: "online_designer",
    onlineDesignerAllowed: true,
    designerTemplateId: null,
    verificationStatus: "pending",
    designerLoadMode: "locked_non_printing_guide_overlay",
    lockedInDesigner: true,
    nonPrintingOverlay: true,
    excludedFromExport: true,
  }), "online_designer");

  assert.equal(validateDocumentMode({
    artworkMode: "professional_pdf_upload_only",
    onlineDesignerAllowed: false,
    designerTemplateId: null,
    verificationStatus: "not_applicable",
    designerLoadMode: "download_only",
    lockedInDesigner: false,
    nonPrintingOverlay: false,
    excludedFromExport: false,
    artworkModeReasonDa: "Kræver en særskilt staffagefil.",
  }), "professional_pdf_upload_only");

  assert.throws(() => validateDocumentMode({
    artworkMode: "professional_pdf_upload_only",
    onlineDesignerAllowed: true,
  }), /must disable Designer/);
});

test("the 20 canonical PNGs replace proposal SVGs without changing axis order", () => {
  const modelValues = Array.from({ length: 20 }, (_, sourceOrder) => ({
    key: `model-${sourceOrder}`,
    labelOriginal: `Modell ${sourceOrder}`,
    labelDa: `Model ${sourceOrder}`,
    sourceOrder,
    icon: { provenance: { supplierReferenceUrl: `https://www.wir-machen-druck.de/icons/${sourceOrder}.png` } },
  }));
  const proposal = {
    axisOrder: [...AXIS_ORDER],
    optionGroups: AXIS_ORDER.map((key, sourceOrder) => ({
      key,
      labelOriginal: key,
      labelDa: key,
      displayType: key === "folder_model" ? "icon_grid" : "buttons",
      sourceOrder,
      values: key === "folder_model" ? modelValues : [{ key: `${key}-value`, labelOriginal: key, labelDa: key, sourceOrder: 0 }],
    })),
  };
  const iconGrid = {
    modelCount: 20,
    modelOrder: modelValues.map((value) => value.key),
    backendProjection: { recommendedSizePx: 128 },
    values: modelValues.map((value) => ({
      key: value.key,
      sourceOrder: value.sourceOrder,
      accessibleNameDa: value.labelDa,
      icon: {
        styleKey: "flat_clean",
        transparent: true,
        supplierBrandingRemoved: true,
        ui: { sha256: "a".repeat(64), byteSize: 10, widthPx: 512, heightPx: 512 },
      },
    })),
  };
  const projected = projectOptionGroups({
    proposal,
    canonicalIconGrid: iconGrid,
    stagedIconPathForKey: (key) => `assets/icons/${key}.png`,
  });

  assert.deepEqual(projected.map((group) => group.key), AXIS_ORDER);
  assert.equal(projected[0].values.length, 20);
  assert.equal(projected[0].values[0].icon.generatedAssetPath, "assets/icons/model-0.png");
  assert.equal(projected[0].values[0].icon.transparent, true);
  assert.equal(projected[0].values[0].icon.supplierBrandingRemoved, true);
  assert.notStrictEqual(projected, proposal.optionGroups);
  assert.equal(proposal.optionGroups[0].values[0].icon.generatedAssetPath, undefined);
});
