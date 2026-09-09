import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_PRICING_PREVIEW_CLEAR,
  PRODUCT_PRICING_PREVIEW_UPDATE,
  buildProductPricingPreviewMessages,
  reduceProductPricingPreviewMessage,
} from "./productPricingPreview.ts";

test("clean editor snapshots clear preview overrides instead of shadowing the database", () => {
  const messages = buildProductPricingPreviewMessages({
    previousProductId: "folder-product",
    preview: {
      productId: "folder-product",
      pricingStructure: { mode: "matrix_layout_v1", version: 1 },
      isDirty: false,
    },
  });

  assert.deepEqual(messages, [{
    type: PRODUCT_PRICING_PREVIEW_CLEAR,
    productId: "folder-product",
  }]);

  const reduced = reduceProductPricingPreviewMessage(
    { "folder-product": { stale: true } },
    messages[0],
  );
  assert.deepEqual(reduced.overrides, {});
  assert.equal(reduced.shouldRefreshProduct, true);
});

test("only dirty editor state becomes a product pricing preview override", () => {
  const pricingStructure = {
    mode: "matrix_layout_v1",
    autoResolveExactCombination: true,
  };
  const [message] = buildProductPricingPreviewMessages({
    preview: {
      productId: "folder-product",
      pricingStructure,
      isDirty: true,
    },
  });

  assert.deepEqual(message, {
    type: PRODUCT_PRICING_PREVIEW_UPDATE,
    productId: "folder-product",
    pricingStructure,
    isDirty: true,
  });

  const reduced = reduceProductPricingPreviewMessage({}, message);
  assert.equal(reduced.overrides["folder-product"], pricingStructure);
  assert.equal(reduced.shouldRefreshProduct, false);
});

test("switching products clears the previous override before applying a dirty next one", () => {
  const messages = buildProductPricingPreviewMessages({
    previousProductId: "old-product",
    preview: {
      productId: "new-product",
      pricingStructure: { mode: "matrix_layout_v1" },
      isDirty: true,
    },
  });

  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], {
    type: PRODUCT_PRICING_PREVIEW_CLEAR,
    productId: "old-product",
  });
  assert.equal(messages[1].type, PRODUCT_PRICING_PREVIEW_UPDATE);
});

test("legacy unversioned updates are treated as clean and cannot replace database rules", () => {
  const previous = {
    "folder-product": {
      mode: "matrix_layout_v1",
      autoResolveExactCombination: true,
    },
  };
  const reduced = reduceProductPricingPreviewMessage(previous, {
    type: PRODUCT_PRICING_PREVIEW_UPDATE,
    productId: "folder-product",
    pricingStructure: { mode: "matrix_layout_v1" },
  });

  assert.deepEqual(reduced.overrides, {});
  assert.equal(reduced.shouldRefreshProduct, true);
});
