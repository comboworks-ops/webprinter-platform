import assert from "node:assert/strict";
import test from "node:test";

import { updateProductOptionValueSetting } from "./productOptionSettings.ts";

test("updates only the selected product option and preserves pricing data", () => {
  const original = {
    mode: "matrix_layout_v1",
    version: 1,
    quantities: [1, 5, 10],
    vertical_axis: {
      sectionId: "format-axis",
      valueIds: ["shared"],
      valueSettings: {
        shared: { displayName: "Format" },
      },
    },
    layout_rows: [
      {
        id: "row-1",
        columns: [
          {
            id: "filling-section",
            valueIds: ["shared", "other"],
            valueSettings: {
              shared: { displayName: "Lindt", imageSizePx: 176 },
              other: { displayName: "Milka", imageSizePx: 96 },
            },
          },
          {
            id: "other-section",
            valueIds: ["shared"],
            valueSettings: {
              shared: { displayName: "Do not change", imageSizePx: 52 },
            },
          },
        ],
      },
    ],
    template_files: [{ id: "template-1" }],
  };

  const result = updateProductOptionValueSetting(
    original,
    "filling-section",
    "shared",
    { imageSizePx: 80 },
  );

  assert.equal(result.updated, true);
  assert.equal(
    result.pricingStructure.layout_rows[0].columns[0].valueSettings.shared.imageSizePx,
    80,
  );
  assert.equal(
    result.pricingStructure.layout_rows[0].columns[0].valueSettings.other.imageSizePx,
    96,
  );
  assert.equal(
    result.pricingStructure.layout_rows[0].columns[1].valueSettings.shared.imageSizePx,
    52,
  );
  assert.deepEqual(result.pricingStructure.quantities, [1, 5, 10]);
  assert.deepEqual(result.pricingStructure.template_files, [{ id: "template-1" }]);
  assert.deepEqual(original.layout_rows[0].columns[0].valueSettings.shared, {
    displayName: "Lindt",
    imageSizePx: 176,
  });
});

test("seeds editable image settings for a known value and preserves value order", () => {
  const original = {
    mode: "matrix_layout_v1",
    layout_rows: [
      {
        id: "row-1",
        columns: [
          {
            id: "calendar-models",
            valueIds: ["classic", "premium", "table"],
            valueSettings: {
              classic: { displayName: "Klassisk" },
            } as Record<string, { displayName?: string; customImage?: string; showThumbnail?: boolean; imageSizePx?: number }>,
          },
        ],
      },
    ],
  };

  const result = updateProductOptionValueSetting(
    original,
    "calendar-models",
    "premium",
    {
      customImage: "/images/premium.png",
      showThumbnail: true,
      imageSizePx: 112,
    },
  );

  assert.equal(result.updated, true);
  assert.deepEqual(
    result.pricingStructure.layout_rows[0].columns[0].valueSettings.premium,
    {
      customImage: "/images/premium.png",
      showThumbnail: true,
      imageSizePx: 112,
    },
  );
  assert.deepEqual(
    result.pricingStructure.layout_rows[0].columns[0].valueIds,
    ["classic", "premium", "table"],
  );
  assert.equal(original.layout_rows[0].columns[0].valueSettings.premium, undefined);
});

test("reports no update for a value that does not belong to the selected section", () => {
  const original = {
    mode: "matrix_layout_v1",
    layout_rows: [
      {
        id: "row-1",
        columns: [
          {
            id: "known-section",
            valueIds: ["known-value"],
            valueSettings: {},
          },
        ],
      },
    ],
  };

  const result = updateProductOptionValueSetting(
    original,
    "known-section",
    "unknown-value",
    { imageSizePx: 80 },
  );

  assert.equal(result.updated, false);
  assert.equal(result.pricingStructure, original);
});
