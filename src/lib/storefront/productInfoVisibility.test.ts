import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProductInfoGalleryLayout,
  normalizeProductInfoShowWhen,
  productInfoBlockMatchesSelection,
} from "./productInfoVisibility.ts";

test("keeps legacy galleries as slideshows and accepts the grid layout", () => {
  assert.equal(normalizeProductInfoGalleryLayout(undefined), "slideshow");
  assert.equal(normalizeProductInfoGalleryLayout("fade"), "slideshow");
  assert.equal(normalizeProductInfoGalleryLayout("grid"), "grid");
});

test("normalizes model conditions and removes duplicate value ids", () => {
  assert.deepEqual(normalizeProductInfoShowWhen([
    {
      sectionId: " calendar-model ",
      valueIds: ["model-a, model-b", " model-a ", ""],
    },
  ]), [
    {
      sectionId: "calendar-model",
      valueIds: ["model-a", "model-b"],
    },
  ]);
});

test("leaves unscoped legacy blocks visible", () => {
  assert.equal(productInfoBlockMatchesSelection(undefined, {}), true);
  assert.equal(productInfoBlockMatchesSelection([], {}), true);
});

test("shows a scoped gallery only for the selected model", () => {
  const showWhen = [{ sectionId: "calendar-model", valueIds: ["model-a"] }];

  assert.equal(productInfoBlockMatchesSelection(showWhen, {
    "calendar-model": "model-a",
  }), true);
  assert.equal(productInfoBlockMatchesSelection(showWhen, {
    "calendar-model": "model-b",
  }), false);
  assert.equal(productInfoBlockMatchesSelection(showWhen, {}), false);
});

test("requires every configured condition to match", () => {
  const showWhen = [
    { sectionId: "calendar-model", valueIds: ["model-a"] },
    { sectionId: "orientation", valueIds: ["portrait"] },
  ];

  assert.equal(productInfoBlockMatchesSelection(showWhen, {
    "calendar-model": "model-a",
    orientation: "portrait",
  }), true);
  assert.equal(productInfoBlockMatchesSelection(showWhen, {
    "calendar-model": "model-a",
    orientation: "landscape",
  }), false);
});

test("fails closed for an incomplete condition", () => {
  assert.equal(productInfoBlockMatchesSelection([
    { sectionId: "calendar-model", valueIds: [] },
  ], {
    "calendar-model": "model-a",
  }), false);
});
