import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowInitialMatrixSkeleton } from "./matrixLoadingPresentation.ts";

test("shows the full skeleton only while the current product is loading for the first time", () => {
  assert.equal(shouldShowInitialMatrixSkeleton({
    productId: "sales-folders",
    lastPresentedProductId: null,
    matrixLoading: true,
    hasResolvedPriceRows: false,
  }), true);
});

test("keeps the mounted configurator visible while another variant price is loading", () => {
  assert.equal(shouldShowInitialMatrixSkeleton({
    productId: "sales-folders",
    lastPresentedProductId: "sales-folders",
    matrixLoading: true,
    hasResolvedPriceRows: false,
  }), false);
});

test("shows the initial skeleton again when the renderer receives a different product", () => {
  assert.equal(shouldShowInitialMatrixSkeleton({
    productId: "new-product",
    lastPresentedProductId: "sales-folders",
    matrixLoading: true,
    hasResolvedPriceRows: false,
  }), true);
});

test("never shows the full skeleton once loading has completed", () => {
  assert.equal(shouldShowInitialMatrixSkeleton({
    productId: "sales-folders",
    lastPresentedProductId: null,
    matrixLoading: false,
    hasResolvedPriceRows: false,
  }), false);
});
