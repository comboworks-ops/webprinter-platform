import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExpectedRateDate,
  buildFrankfurterEcbRequest,
  fetchFrankfurterEurDkkSnapshot,
  FRANKFURTER_ECB_URL,
  FRANKFURTER_MAX_BODY_BYTES,
  FRANKFURTER_TIMEOUT_MS,
  type FxSnapshotRepository,
  isAllowedFrankfurterEcbUrl,
  parseReferenceFxRequest,
  persistReferenceFxSnapshot,
  ReferenceFxError,
  type ReferenceFxSnapshot,
  toPublicReferenceFxSnapshot,
} from "./referenceFx.ts";

const NOW = new Date("2026-08-01T08:00:00.000Z");
const VALID_BODY =
  '{"date":"2026-07-31","base":"EUR","quote":"DKK","rate":7.4601}';
const VALID_DIGEST =
  "1483de53741a6a2d977f45b027c696a2a93bab981b7ec43cd46a607600a4e583";
const SNAPSHOT_ID = "30000000-0000-4000-8000-000000000003";

function jsonResponse(
  body = VALID_BODY,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(body, {
    ...init,
    status: init.status ?? 200,
    headers,
  });
}

function validSnapshot(
  overrides: Partial<ReferenceFxSnapshot> = {},
): ReferenceFxSnapshot {
  return {
    schemaVersion: 1,
    provider: "frankfurter_ecb",
    baseCurrency: "EUR",
    quoteCurrency: "DKK",
    rate: 7.4601,
    rateDate: "2026-07-31",
    fetchedAt: NOW.toISOString(),
    sourcePayloadSha256: VALID_DIGEST,
    ...overrides,
  };
}

test("request construction pins the official Frankfurter ECB EUR/DKK URL", () => {
  assert.equal(
    FRANKFURTER_ECB_URL,
    "https://api.frankfurter.dev/v2/rate/EUR/DKK?providers=ECB",
  );
  assert.equal(isAllowedFrankfurterEcbUrl(FRANKFURTER_ECB_URL), true);
  for (
    const candidate of [
      "https://api.frankfurter.dev/v2/rate/EUR/DKK",
      "https://api.frankfurter.dev/v2/rate/EUR/DKK?providers=DNB",
      "https://api.frankfurter.dev/v2/rate/USD/DKK?providers=ECB",
      "https://api.frankfurter.dev.evil.test/v2/rate/EUR/DKK?providers=ECB",
      "http://api.frankfurter.dev/v2/rate/EUR/DKK?providers=ECB",
    ]
  ) {
    assert.equal(isAllowedFrankfurterEcbUrl(candidate), false, candidate);
  }

  const request = buildFrankfurterEcbRequest();
  assert.equal(request.url, FRANKFURTER_ECB_URL);
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.redirect, "manual");
  assert.deepEqual(request.init.headers, { Accept: "application/json" });
});

test("fetch always uses the fixed request, a signal, and a bounded timeout", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  const snapshot = await fetchFrankfurterEurDkkSnapshot({
    now: NOW,
    fetchImpl: (url, init) => {
      observedUrl = String(url);
      observedInit = init;
      return Promise.resolve(jsonResponse());
    },
  });

  assert.equal(observedUrl, FRANKFURTER_ECB_URL);
  assert.equal(observedInit?.method, "GET");
  assert.equal(observedInit?.redirect, "manual");
  assert.equal(observedInit?.signal instanceof AbortSignal, true);
  assert.equal(FRANKFURTER_TIMEOUT_MS >= 1_000, true);
  assert.equal(FRANKFURTER_TIMEOUT_MS <= 10_000, true);
  assert.equal(snapshot.baseCurrency, "EUR");
  assert.equal(snapshot.quoteCurrency, "DKK");
});

test("redirects and responses from any other URL fail closed", async () => {
  await assert.rejects(
    fetchFrankfurterEurDkkSnapshot({
      now: NOW,
      fetchImpl: () =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: "https://evil.test/rate" },
          }),
        ),
    }),
    (error) =>
      error instanceof ReferenceFxError &&
      error.code === "provider_unavailable",
  );

  const wrongOrigin = jsonResponse();
  Object.defineProperty(wrongOrigin, "url", {
    configurable: true,
    value: "https://evil.test/rate",
  });
  await assert.rejects(
    fetchFrankfurterEurDkkSnapshot({
      now: NOW,
      fetchImpl: () => Promise.resolve(wrongOrigin),
    }),
    (error) =>
      error instanceof ReferenceFxError &&
      error.code === "provider_unavailable",
  );
});

test("bad status, media type, size, schema, dates, and staleness are sanitized", async () => {
  const cases: Array<() => Response> = [
    () => jsonResponse('{"message":"upstream secret detail"}', { status: 503 }),
    () =>
      new Response(VALID_BODY, {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    () =>
      jsonResponse("x".repeat(FRANKFURTER_MAX_BODY_BYTES + 1), {
        headers: { "content-length": String(FRANKFURTER_MAX_BODY_BYTES + 1) },
      }),
    () => jsonResponse("x".repeat(FRANKFURTER_MAX_BODY_BYTES + 1)),
    () => jsonResponse('{"date":"2026-07-31","base":"EUR","quote":"DKK"}'),
    () =>
      jsonResponse(
        '{"date":"2026-02-30","base":"EUR","quote":"DKK","rate":7.46}',
      ),
    () =>
      jsonResponse(
        '{"date":"2026-07-31","base":"USD","quote":"DKK","rate":7.46}',
      ),
    () =>
      jsonResponse(
        '{"date":"2026-07-31","base":"EUR","quote":"DKK","rate":"7.46"}',
      ),
    () =>
      jsonResponse('{"date":"2026-07-31","base":"EUR","quote":"DKK","rate":0}'),
    () =>
      jsonResponse(
        '{"date":"2026-07-20","base":"EUR","quote":"DKK","rate":7.46}',
      ),
    () =>
      jsonResponse(
        '{"date":"2026-08-02","base":"EUR","quote":"DKK","rate":7.46}',
      ),
    () =>
      jsonResponse(
        '{"date":"2026-07-31","base":"EUR","quote":"DKK","rate":7.46,"rate":8}',
      ),
  ];

  for (const response of cases) {
    await assert.rejects(
      fetchFrankfurterEurDkkSnapshot({
        now: NOW,
        fetchImpl: () => Promise.resolve(response()),
      }),
      (error) => {
        assert.equal(error instanceof ReferenceFxError, true);
        assert.doesNotMatch(
          String((error as Error).message),
          /secret|503|evil|upstream/i,
        );
        return true;
      },
    );
  }
});

test("streamed response bytes accept the exact limit and reject the next byte", async () => {
  const skeleton = JSON.stringify({
    date: "2026-07-31",
    base: "EUR",
    quote: "DKK",
    rate: 7.4601,
    padding: "",
  });
  const exact = JSON.stringify({
    date: "2026-07-31",
    base: "EUR",
    quote: "DKK",
    rate: 7.4601,
    padding: "x".repeat(FRANKFURTER_MAX_BODY_BYTES - skeleton.length),
  });
  assert.equal(
    new TextEncoder().encode(exact).byteLength,
    FRANKFURTER_MAX_BODY_BYTES,
  );

  const snapshot = await fetchFrankfurterEurDkkSnapshot({
    now: NOW,
    fetchImpl: () => Promise.resolve(jsonResponse(exact)),
  });
  assert.equal(snapshot.rate, 7.4601);

  await assert.rejects(
    fetchFrankfurterEurDkkSnapshot({
      now: NOW,
      fetchImpl: () => Promise.resolve(jsonResponse(`${exact} `)),
    }),
    ReferenceFxError,
  );
});

test("the exact raw bytes are hashed before JSON parsing", async () => {
  const first = await fetchFrankfurterEurDkkSnapshot({
    now: NOW,
    fetchImpl: () => Promise.resolve(jsonResponse(VALID_BODY)),
  });
  const second = await fetchFrankfurterEurDkkSnapshot({
    now: NOW,
    fetchImpl: () => Promise.resolve(jsonResponse(`${VALID_BODY}\n`)),
  });

  assert.equal(first.sourcePayloadSha256, VALID_DIGEST);
  assert.notEqual(second.sourcePayloadSha256, first.sourcePayloadSha256);
  assert.equal(second.rate, first.rate);
  assert.equal(Object.isFrozen(first), true);
});

test("request body accepts only EUR/DKK and an optional real expected date", () => {
  assert.deepEqual(
    parseReferenceFxRequest({ baseCurrency: "EUR", quoteCurrency: "DKK" }),
    { baseCurrency: "EUR", quoteCurrency: "DKK" },
  );
  assert.deepEqual(
    parseReferenceFxRequest({
      baseCurrency: "EUR",
      quoteCurrency: "DKK",
      expectedRateDate: "2026-07-31",
    }),
    {
      baseCurrency: "EUR",
      quoteCurrency: "DKK",
      expectedRateDate: "2026-07-31",
    },
  );

  for (
    const input of [
      null,
      {},
      { baseCurrency: "USD", quoteCurrency: "DKK" },
      { baseCurrency: "EUR", quoteCurrency: "EUR" },
      {
        baseCurrency: "EUR",
        quoteCurrency: "DKK",
        expectedRateDate: "2026-02-30",
      },
      { baseCurrency: "EUR", quoteCurrency: "DKK", url: FRANKFURTER_ECB_URL },
      Object.create({ baseCurrency: "EUR", quoteCurrency: "DKK" }),
    ]
  ) {
    assert.throws(() => parseReferenceFxRequest(input), ReferenceFxError);
  }

  assert.doesNotThrow(() =>
    assertExpectedRateDate(validSnapshot(), "2026-07-31")
  );
  assert.throws(
    () => assertExpectedRateDate(validSnapshot(), "2026-07-30"),
    (error) =>
      error instanceof ReferenceFxError && error.code === "rate_date_mismatch",
  );
});

test("request fields are captured once and inherited or symbol inputs fail closed", () => {
  const reads = new Map<string, number>();
  const input = Object.defineProperties({}, {
    baseCurrency: {
      enumerable: true,
      get() {
        reads.set("base", (reads.get("base") ?? 0) + 1);
        return "EUR";
      },
    },
    quoteCurrency: {
      enumerable: true,
      get() {
        reads.set("quote", (reads.get("quote") ?? 0) + 1);
        return "DKK";
      },
    },
  });

  assert.deepEqual(parseReferenceFxRequest(input), {
    baseCurrency: "EUR",
    quoteCurrency: "DKK",
  });
  assert.deepEqual(Object.fromEntries(reads), { base: 1, quote: 1 });
  assert.throws(
    () =>
      parseReferenceFxRequest({
        baseCurrency: "EUR",
        quoteCurrency: "DKK",
        [Symbol("providerUrl")]: FRANKFURTER_ECB_URL,
      }),
    ReferenceFxError,
  );
});

test("an exact replay returns the existing ID without inserting", async () => {
  let insertCalls = 0;
  const storedSnapshot = validSnapshot({
    fetchedAt: "2026-07-31T08:00:00.000Z",
  });
  const repository: FxSnapshotRepository = {
    findExact: () =>
      Promise.resolve({ id: SNAPSHOT_ID, snapshot: storedSnapshot }),
    insert: () => {
      insertCalls += 1;
      return Promise.resolve({
        status: "inserted" as const,
        row: { id: SNAPSHOT_ID, snapshot: validSnapshot() },
      });
    },
  };

  const result = await persistReferenceFxSnapshot(validSnapshot(), repository);
  assert.equal(result.id, SNAPSHOT_ID);
  assert.equal(result.replayed, true);
  assert.equal(result.snapshot.fetchedAt, storedSnapshot.fetchedAt);
  assert.equal(insertCalls, 0);
});

test("a concurrent uniqueness conflict is re-read instead of duplicated", async () => {
  let findCalls = 0;
  let insertCalls = 0;
  const repository: FxSnapshotRepository = {
    findExact: () => {
      findCalls += 1;
      return Promise.resolve(
        findCalls === 1 ? null : { id: SNAPSHOT_ID, snapshot: validSnapshot() },
      );
    },
    insert: () => {
      insertCalls += 1;
      return Promise.resolve({ status: "conflict" as const });
    },
  };

  const result = await persistReferenceFxSnapshot(validSnapshot(), repository);
  assert.deepEqual(
    { id: result.id, replayed: result.replayed, findCalls, insertCalls },
    { id: SNAPSHOT_ID, replayed: true, findCalls: 2, insertCalls: 1 },
  );
});

test("stale or malformed persistence inputs and repository failures stay sanitized", async () => {
  const repository: FxSnapshotRepository = {
    findExact: () =>
      Promise.reject(new Error("database password and internal query")),
    insert: () => Promise.resolve({ status: "conflict" }),
  };

  for (
    const candidate of [
      validSnapshot({ rateDate: "2026-07-01" }),
      validSnapshot({ sourcePayloadSha256: "not-a-hash" }),
      validSnapshot(),
    ]
  ) {
    await assert.rejects(
      persistReferenceFxSnapshot(candidate, repository),
      (error) => {
        assert.equal(error instanceof ReferenceFxError, true);
        assert.equal(
          (error as ReferenceFxError).code,
          "persistence_failed",
        );
        assert.doesNotMatch(
          String((error as Error).message),
          /password|query|database/i,
        );
        return true;
      },
    );
  }
});

test("public response contains only snapshot metadata and no internal error or key", () => {
  const response = toPublicReferenceFxSnapshot({
    id: SNAPSHOT_ID,
    replayed: false,
    snapshot: validSnapshot(),
  });
  assert.deepEqual(Object.keys(response), ["id", "replayed", "snapshot"]);
  assert.deepEqual(Object.keys(response.snapshot), [
    "schemaVersion",
    "provider",
    "baseCurrency",
    "quoteCurrency",
    "rate",
    "rateDate",
    "fetchedAt",
    "sourcePayloadSha256",
  ]);
  assert.doesNotMatch(
    JSON.stringify(response),
    /service.role|authorization|bearer|rawBody|internal|error|secret/i,
  );
});
