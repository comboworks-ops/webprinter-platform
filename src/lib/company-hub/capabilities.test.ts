import assert from "node:assert/strict";
import test from "node:test";

import { classifyCompanyHubCapability } from "./capabilities.ts";

test("successful V2 probe reports the workspace as available", () => {
  assert.deepEqual(classifyCompanyHubCapability(null), { status: "available" });
});

test("missing table and column errors keep the V1 fallback available", () => {
  assert.deepEqual(
    classifyCompanyHubCapability({ code: "42P01", message: "relation does not exist" }),
    { status: "unavailable", reason: "migration_missing" },
  );
  assert.deepEqual(
    classifyCompanyHubCapability({ code: "42703", message: "column does not exist" }),
    { status: "unavailable", reason: "migration_missing" },
  );
  assert.deepEqual(
    classifyCompanyHubCapability({ code: "PGRST205", message: "table missing from schema cache" }),
    { status: "unavailable", reason: "migration_missing" },
  );
});

test("transport and permission failures are surfaced instead of hidden", () => {
  const result = classifyCompanyHubCapability({ code: "42501", message: "permission denied" });
  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.code, "42501");
    assert.match(result.message, /kunne ikke kontrolleres/i);
  }
});
