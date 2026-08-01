import assert from "node:assert/strict";
import test from "node:test";

import {
  readLatestTenantBusinessEvidence,
  type TenantBusinessEvidenceReadClient,
} from "./businessEvidenceRead.ts";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";

test("evidence reads bind VIES and CVR rows to the exact saved identifier", async () => {
  const calls: Array<readonly [string, unknown, unknown?]> = [];
  const query = {
    eq(column: string, value: string) {
      calls.push(["eq", column, value]);
      return this;
    },
    in(column: string, values: readonly string[]) {
      calls.push(["in", column, values]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push(["order", column, options]);
      return this;
    },
    limit(value: number) {
      calls.push(["limit", value]);
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: {
          normalized_identifier: "DK12345678",
          result_status: "valid",
          provider: "EU VIES",
          checked_at: "2026-08-01T08:03:04.000Z",
        },
        error: null,
      });
    },
  };
  const client: TenantBusinessEvidenceReadClient = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return query;
        },
      };
    },
  };

  const result = await readLatestTenantBusinessEvidence(
    client,
    TENANT_ID,
    "DK12345678",
  );
  assert.equal(result?.normalizedIdentifier, "DK12345678");
  assert.deepEqual(calls.slice(2, 5), [
    ["eq", "tenant_id", TENANT_ID],
    ["in", "evidence_type", ["vies", "danish_company"]],
    ["eq", "normalized_identifier", "DK12345678"],
  ]);
});

test("evidence reads fail closed for missing, invalid, or mismatched identifiers", async () => {
  let queryCalls = 0;
  const client: TenantBusinessEvidenceReadClient = {
    from() {
      queryCalls += 1;
      throw new Error("must not query");
    },
  };
  assert.equal(
    await readLatestTenantBusinessEvidence(client, TENANT_ID, null),
    null,
  );
  assert.equal(
    await readLatestTenantBusinessEvidence(client, TENANT_ID, "DK123"),
    null,
  );
  assert.equal(queryCalls, 0);

  const mismatchQuery = {
    eq() {
      return this;
    },
    in() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: {
          normalized_identifier: "DK87654321",
          result_status: "valid",
          provider: "EU VIES",
          checked_at: "2026-08-01T08:03:04.000Z",
        },
        error: null,
      });
    },
  };
  const mismatchClient = {
    from() {
      return { select: () => mismatchQuery };
    },
  } as TenantBusinessEvidenceReadClient;
  assert.equal(
    await readLatestTenantBusinessEvidence(
      mismatchClient,
      TENANT_ID,
      "DK12345678",
    ),
    null,
  );
});
