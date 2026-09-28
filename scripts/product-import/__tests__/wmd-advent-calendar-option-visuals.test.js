import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImportedOptionVisualSettings,
  buildImportedSectionVisualSettings,
} from "../import-wmd-advent-calendar-product-drafts.js";

test("calendar option pictures inherit one editable section size", () => {
  const settings = buildImportedOptionVisualSettings("/calendar-option.png");

  assert.deepEqual(settings, {
    showThumbnail: true,
    customImage: "/calendar-option.png",
  });
  assert.equal(Object.hasOwn(settings, "imageSizePx"), false);
});

test("calendar icon grids use a picture layout with a supported editable size", () => {
  assert.deepEqual(buildImportedSectionVisualSettings({ displayType: "icon_grid" }), {
    ui_mode: "xl",
    thumbnail_size: "xl",
    thumbnail_custom_px: 160,
  });
});

test("ordinary text choices keep their compact button layout", () => {
  assert.deepEqual(buildImportedSectionVisualSettings({ displayType: "buttons" }), {
    ui_mode: "buttons",
    thumbnail_size: "medium",
  });
});
