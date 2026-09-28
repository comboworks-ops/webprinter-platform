import assert from "node:assert/strict";
import test from "node:test";

import {
  getPrintProductionAccessDecision,
  getPrintProductionView,
  withPrintProductionView,
} from "./navigation.ts";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

test("stale authorized resolution is unresolved for a different requested domain", () => {
  assert.equal(
    getPrintProductionAccessDecision({
      requestedForceDomain: "tenant-b.dk",
      resolution: {
        forceDomain: "tenant-a.dk",
        tenantId: MASTER_TENANT_ID,
        isMasterAdmin: true,
      },
      masterTenantId: MASTER_TENANT_ID,
    }),
    "loading",
  );
});

test("matching authorized master resolution is allowed", () => {
  assert.equal(
    getPrintProductionAccessDecision({
      requestedForceDomain: "webprinter.dk",
      resolution: {
        forceDomain: "webprinter.dk",
        tenantId: MASTER_TENANT_ID,
        isMasterAdmin: true,
      },
      masterTenantId: MASTER_TENANT_ID,
    }),
    "allowed",
  );
});

test("matching unauthorized resolutions redirect", () => {
  for (const resolution of [
    {
      forceDomain: "tenant-a.dk",
      tenantId: "tenant-a",
      isMasterAdmin: true,
    },
    {
      forceDomain: "tenant-a.dk",
      tenantId: MASTER_TENANT_ID,
      isMasterAdmin: false,
    },
  ]) {
    assert.equal(
      getPrintProductionAccessDecision({
        requestedForceDomain: "tenant-a.dk",
        resolution,
        masterTenantId: MASTER_TENANT_ID,
      }),
      "redirect",
    );
  }
});

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
