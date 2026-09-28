import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED,
  MASTER_TENANT_ID,
  MODEL_SECTION_ID,
  SIZE_GROUPS,
  TARGET_PRODUCT_ID,
  TARGET_SLUG,
  buildFolderModelPresentationPatch,
  parseArgs,
} from "../apply-wmd-sales-folder-model-grouping.js";

function fixture() {
  const groupId = "folder-model-group";
  const attributeValues = [];
  let index = 0;
  for (const group of SIZE_GROUPS) {
    for (let groupIndex = 0; groupIndex < group.expectedCount; groupIndex += 1) {
      const id = `model-${String(index + 1).padStart(2, "0")}`;
      const sourceKey = `${group.sourcePrefix}model-${groupIndex + 1}`;
      attributeValues.push({
        id,
        product_id: TARGET_PRODUCT_ID,
        group_id: groupId,
        name: `${group.id === "m65" ? "DIN lang" : group.label} · model ${groupIndex + 1}`,
        key: sourceKey,
        sort_order: index,
        enabled: true,
        meta: { sourceKey, image: `https://assets.example.test/${sourceKey}.png` },
      });
      index += 1;
    }
  }
  assert.equal(attributeValues.length, EXPECTED.modelValues);

  const valueIds = attributeValues.map((value) => value.id);
  const valueSettings = Object.fromEntries(attributeValues.map((value) => [
    value.id,
    {
      displayName: value.name,
      showThumbnail: true,
      customImage: value.meta.image,
      preferCustomImage: true,
      imageSizePx: 128,
    },
  ]));
  const product = {
    id: TARGET_PRODUCT_ID,
    tenant_id: MASTER_TENANT_ID,
    slug: TARGET_SLUG,
    is_published: false,
    is_available_to_tenants: false,
    is_ready: false,
    pricing_type: "matrix",
    updated_at: "2026-09-01T10:00:00.000Z",
    technical_specs: { supplierProductKey: TARGET_SLUG },
    template_files: Array.from({ length: EXPECTED.templateFiles }, (_, templateIndex) => ({
      id: `template-${templateIndex + 1}`,
    })),
    pricing_structure: {
      mode: "matrix_layout_v1",
      version: 1,
      vertical_axis: {
        id: "sales-folder-paper",
        sectionId: "sales-folder-paper",
        groupId: "paper-group",
        valueIds: ["paper"],
      },
      layout_rows: [{
        id: "row",
        columns: [{
          id: MODEL_SECTION_ID,
          sectionId: MODEL_SECTION_ID,
          groupId,
          sectionType: "formats",
          ui_mode: "xl",
          thumbnail_size: "xl",
          thumbnail_custom_px: 128,
          valueIds,
          valueSettings,
        }],
      }],
    },
  };
  return { product, attributeValues };
}

test("presentation updater is dry-run by default and needs an explicit write flag", () => {
  assert.equal(parseArgs([]).confirmWrite, false);
  assert.equal(parseArgs(["--confirm-presentation-write"]).confirmWrite, true);
  assert.throws(() => parseArgs(["--confirm-presentation-write", "--confirm-presentation-write"]));
  assert.throws(() => parseArgs(["--unknown"]));
});

test("groups all 20 models by size without changing model UUIDs or editable images", () => {
  const { product, attributeValues } = fixture();
  const before = structuredClone(product.pricing_structure);
  const result = buildFolderModelPresentationPatch({ product, attributeValues });
  const section = result.pricing_structure.layout_rows[0].columns[0];

  assert.equal(section.ui_mode, "buttons");
  assert.deepEqual(section.valueIds, before.layout_rows[0].columns[0].valueIds);
  assert.deepEqual(section.valueGroups.map((group) => group.label), [
    "A4",
    "A5",
    "A6",
    "M65",
    "21 × 21 cm",
  ]);
  assert.deepEqual(section.valueGroups.map((group) => group.valueIds.length), [7, 4, 4, 3, 2]);
  assert.equal(new Set(section.valueGroups.flatMap((group) => group.valueIds)).size, 20);
  assert.equal(result.summary.hiddenThumbnails, 20);
  assert.equal(result.summary.preservedCustomImages, 20);
  assert.equal(Object.values(section.valueSettings).every((setting) => setting.showThumbnail === false), true);
  assert.equal(
    Object.values(section.valueSettings).every((setting) => Boolean(setting.customImage)),
    true,
  );
  assert.equal(result.summary.m65DisplayNames.length, 3);
  assert.equal(result.summary.m65DisplayNames.every((name) => name.startsWith("M65 ·")), true);
  assert.equal(before.layout_rows[0].columns[0].ui_mode, "xl");
  assert.equal(
    Object.values(before.layout_rows[0].columns[0].valueSettings)
      .every((setting) => setting.showThumbnail === true),
    true,
  );
});

test("fails closed when a size group is incomplete", () => {
  const { product, attributeValues } = fixture();
  assert.throws(
    () => buildFolderModelPresentationPatch({
      product,
      attributeValues: attributeValues.slice(1),
    }),
    /incomplete|exactly/,
  );
});
