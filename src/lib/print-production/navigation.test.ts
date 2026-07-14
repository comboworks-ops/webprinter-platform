import assert from "node:assert/strict";
import test from "node:test";

import {
  getPrintProductionView,
  withPrintProductionView,
} from "./navigation.ts";

test("unknown view falls back to overview", () => {
  assert.equal(getPrintProductionView("?view=nope"), "overview");
});

test("allowed views are read from the URL", () => {
  for (const view of ["overview", "products", "distribution", "orders", "settings"] as const) {
    assert.equal(getPrintProductionView(`?view=${view}`), view);
  }
});

test("view navigation preserves tenant context", () => {
  assert.equal(
    withPrintProductionView("?force_domain=webprinter.dk&view=overview", "orders"),
    "/admin/printproduktion?force_domain=webprinter.dk&view=orders",
  );
});

test("view navigation discards unrelated transient parameters", () => {
  assert.equal(
    withPrintProductionView("?dialog=product&force_domain=salgsmapper.dk&page=3", "products"),
    "/admin/printproduktion?force_domain=salgsmapper.dk&view=products",
  );
});

test("view navigation omits an empty tenant context", () => {
  assert.equal(
    withPrintProductionView("?force_domain=&notice=done", "settings"),
    "/admin/printproduktion?view=settings",
  );
});
