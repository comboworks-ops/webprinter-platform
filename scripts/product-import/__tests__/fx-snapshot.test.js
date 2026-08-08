import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeFxSnapshot,
  parseFrankfurterEurDkkSnapshot,
  parseFxSnapshot,
} from "../shared/fx-snapshot.js";

const FETCHED_AT = "2026-07-31T08:15:00.000Z";
const VALID_HASH = "a".repeat(64);
const VALID_RAW =
  '{"date":"2026-07-30","base":"EUR","quote":"DKK","rate":7.4601,"notice":"synthetic-test-fixture"}';
const VALID_RAW_SHA256 = "64ab9a4267b130de257b91952583bb9b6f6037447c2fda01fb384c9df60de4e6";

function rawBytes(value) {
  return Buffer.from(value, "utf8");
}

function validSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    provider: "frankfurter_ecb",
    baseCurrency: "EUR",
    quoteCurrency: "DKK",
    rate: 7.4601,
    rateDate: "2026-07-30",
    fetchedAt: FETCHED_AT,
    sourcePayloadSha256: VALID_HASH,
    ...overrides,
  };
}

test("valid Frankfurter EUR/DKK bytes become the exact immutable versioned contract", () => {
  const snapshot = parseFrankfurterEurDkkSnapshot(Buffer.from(VALID_RAW, "utf8"), FETCHED_AT);

  assert.deepEqual(snapshot, {
    schemaVersion: 1,
    provider: "frankfurter_ecb",
    baseCurrency: "EUR",
    quoteCurrency: "DKK",
    rate: 7.4601,
    rateDate: "2026-07-30",
    fetchedAt: FETCHED_AT,
    sourcePayloadSha256: VALID_RAW_SHA256,
  });
  assert.deepEqual(Object.keys(snapshot), [
    "schemaVersion",
    "provider",
    "baseCurrency",
    "quoteCurrency",
    "rate",
    "rateDate",
    "fetchedAt",
    "sourcePayloadSha256",
  ]);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.throws(() => {
    snapshot.rate = 8;
  }, TypeError);
});

test("rateDate is provider supplied while fetchedAt is exactly caller supplied", () => {
  const laterFetch = "2027-01-02T03:04:05.006Z";
  const snapshot = parseFrankfurterEurDkkSnapshot(rawBytes(VALID_RAW), laterFetch);

  assert.equal(snapshot.rateDate, "2026-07-30");
  assert.equal(snapshot.fetchedAt, laterFetch);
  assert.equal(snapshot.sourcePayloadSha256, VALID_RAW_SHA256);
});

test("hashing covers exact raw bytes before extra provider fields are ignored", () => {
  const withoutExtra = '{"date":"2026-07-30","base":"EUR","quote":"DKK","rate":7.4601}';
  const withExtra =
    '{"date":"2026-07-30","base":"EUR","quote":"DKK","rate":7.4601,"metadata":{"trace":"synthetic-only"}}';

  const first = parseFrankfurterEurDkkSnapshot(rawBytes(withoutExtra), FETCHED_AT);
  const second = parseFrankfurterEurDkkSnapshot(rawBytes(withExtra), FETCHED_AT);

  assert.equal(first.rate, second.rate);
  assert.equal(first.rateDate, second.rateDate);
  assert.notEqual(first.sourcePayloadSha256, second.sourcePayloadSha256);
  assert.equal("metadata" in second, false);
  assert.equal("evidence" in second, false);
});

test("semantically identical JSON with different raw bytes keeps distinct evidence hashes", () => {
  const compact = '{"date":"2026-07-30","base":"EUR","quote":"DKK","rate":7.4601}';
  const reordered =
    '{\n  "rate": 7.4601,\n  "quote": "DKK",\n  "base": "EUR",\n  "date": "2026-07-30"\n}\n';

  const first = parseFrankfurterEurDkkSnapshot(rawBytes(compact), FETCHED_AT);
  const second = parseFrankfurterEurDkkSnapshot(rawBytes(reordered), FETCHED_AT);

  assert.deepEqual(
    { ...first, sourcePayloadSha256: "omitted" },
    { ...second, sourcePayloadSha256: "omitted" },
  );
  assert.notEqual(first.sourcePayloadSha256, second.sourcePayloadSha256);
  assert.match(first.sourcePayloadSha256, /^[a-f0-9]{64}$/);
  assert.match(second.sourcePayloadSha256, /^[a-f0-9]{64}$/);
});

test("only exact Buffer, Uint8Array, and ArrayBuffer response bytes are accepted", () => {
  const buffer = Buffer.from(VALID_RAW, "utf8");
  const views = [
    buffer,
    new Uint8Array(buffer),
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  ];

  const snapshots = views.map((rawBody) =>
    parseFrankfurterEurDkkSnapshot(rawBody, FETCHED_AT),
  );

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.sourcePayloadSha256),
    Array.from({ length: views.length }, () => VALID_RAW_SHA256),
  );
  assert.throws(() => parseFrankfurterEurDkkSnapshot(VALID_RAW, FETCHED_AT), /Frankfurter/i);
});

test("official provider response shape fails closed", () => {
  const validPayload = {
    date: "2026-07-30",
    base: "EUR",
    quote: "DKK",
    rate: 7.4601,
  };
  const invalidPayloads = [
    { base: "EUR", quote: "DKK", rate: 7.4601 },
    { date: "2026-07-30", quote: "DKK", rate: 7.4601 },
    { date: "2026-07-30", base: "EUR", rate: 7.4601 },
    { date: "2026-07-30", base: "EUR", quote: "DKK" },
    { ...validPayload, base: "USD" },
    { ...validPayload, base: "eur" },
    { ...validPayload, quote: "EUR" },
    { ...validPayload, quote: "dkk" },
    { ...validPayload, rate: "7.4601" },
    { ...validPayload, rate: null },
    { ...validPayload, amount: 1 },
    { ...validPayload, rates: { DKK: 7.4601 } },
  ];

  for (const payload of invalidPayloads) {
    assert.throws(
      () => parseFrankfurterEurDkkSnapshot(rawBytes(JSON.stringify(payload)), FETCHED_AT),
      /Frankfurter/i,
    );
  }

  assert.throws(
    () => parseFrankfurterEurDkkSnapshot(rawBytes("not-json"), FETCHED_AT),
    /Frankfurter/i,
  );
  assert.throws(
    () => parseFrankfurterEurDkkSnapshot(new Uint8Array([0xff, 0xfe]), FETCHED_AT),
    /Frankfurter/i,
  );
  assert.throws(() => parseFrankfurterEurDkkSnapshot({ payload: validPayload }, FETCHED_AT));
});

test("duplicate top-level JSON keys and legacy rate fields are rejected as ambiguous", () => {
  const duplicateRate =
    '{"date":"2026-07-30","base":"EUR","quote":"DKK","rate":7.4601,"rate":7.4601}';
  const duplicateQuote =
    '{"date":"2026-07-30","base":"EUR","quote":"EUR","quote":"DKK","rate":7.4601}';
  const mixedV1V2 =
    '{"date":"2026-07-30","base":"EUR","quote":"DKK","rate":7.4601,"amount":1,"rates":{"DKK":7.4601}}';

  for (const rawBody of [duplicateRate, duplicateQuote, mixedV1V2]) {
    assert.throws(
      () => parseFrankfurterEurDkkSnapshot(rawBytes(rawBody), FETCHED_AT),
      /Frankfurter/i,
    );
  }
});

test("raw provider evidence accepts sixteen KiB and rejects the next byte", () => {
  const payload = {
    date: "2026-07-30",
    base: "EUR",
    quote: "DKK",
    rate: 7.4601,
    padding: "",
  };
  const emptyPadding = rawBytes(JSON.stringify(payload));
  const exact = rawBytes(
    JSON.stringify({ ...payload, padding: "x".repeat(16 * 1024 - emptyPadding.byteLength) }),
  );
  const oversized = rawBytes(
    JSON.stringify({
      ...payload,
      padding: "x".repeat(16 * 1024 - emptyPadding.byteLength + 1),
    }),
  );

  assert.equal(exact.byteLength, 16 * 1024);
  assert.equal(parseFrankfurterEurDkkSnapshot(exact, FETCHED_AT).rate, 7.4601);
  assert.equal(oversized.byteLength, 16 * 1024 + 1);
  assert.throws(() => parseFrankfurterEurDkkSnapshot(oversized, FETCHED_AT), /Frankfurter/i);
});

test("raw byte limits cannot be spoofed by typed-array subclasses or proxies", () => {
  let subclassIteratorCalls = 0;
  class SpoofedUint8Array extends Uint8Array {
    get byteLength() {
      return 1;
    }

    *[Symbol.iterator]() {
      subclassIteratorCalls += 1;
      yield* rawBytes(VALID_RAW);
    }
  }

  const spoofedView = new SpoofedUint8Array(16 * 1024 + 1);
  assert.throws(
    () => parseFrankfurterEurDkkSnapshot(spoofedView, FETCHED_AT),
    /Frankfurter/i,
  );
  assert.equal(subclassIteratorCalls, 0);

  let proxyIteratorCalls = 0;
  const proxiedView = new Proxy(new Uint8Array(16 * 1024 + 1), {
    get(target, property, receiver) {
      if (property === "byteLength") return 1;
      if (property === Symbol.iterator) {
        return function* spoofedIterator() {
          proxyIteratorCalls += 1;
          yield* rawBytes(VALID_RAW);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });

  assert.throws(
    () => parseFrankfurterEurDkkSnapshot(proxiedView, FETCHED_AT),
    /Frankfurter/i,
  );
  assert.equal(proxyIteratorCalls, 0);
});

test("in-bounds typed-array subclasses are copied without invoking iteration", () => {
  let iteratorCalls = 0;
  class HostileIteratorUint8Array extends Uint8Array {
    *[Symbol.iterator]() {
      iteratorCalls += 1;
      throw new Error("typed-array iterator must not run");
    }
  }

  const source = rawBytes(VALID_RAW);
  const hostileView = new HostileIteratorUint8Array(source.byteLength);
  hostileView.set(source);

  const snapshot = parseFrankfurterEurDkkSnapshot(hostileView, FETCHED_AT);
  assert.equal(snapshot.sourcePayloadSha256, VALID_RAW_SHA256);
  assert.equal(iteratorCalls, 0);
});

test("raw byte limits use the intrinsic ArrayBuffer length", () => {
  class SpoofedArrayBuffer extends ArrayBuffer {
    get byteLength() {
      return 1;
    }
  }

  const spoofedBuffer = new SpoofedArrayBuffer(16 * 1024 + 1);
  const spoofedBytes = new Uint8Array(spoofedBuffer);
  spoofedBytes.fill(0x20);
  spoofedBytes.set(rawBytes(VALID_RAW));

  assert.throws(
    () => parseFrankfurterEurDkkSnapshot(spoofedBuffer, FETCHED_AT),
    /Frankfurter/i,
  );
});

test("hostile raw byte proxies fail with a normalized provider error", () => {
  const leakedError = new Error("hostile byteLength trap leaked");
  const hostileBytes = new Proxy(rawBytes(VALID_RAW), {
    get(target, property, receiver) {
      if (property === "byteLength") throw leakedError;
      return Reflect.get(target, property, receiver);
    },
  });

  assert.throws(
    () => parseFrankfurterEurDkkSnapshot(hostileBytes, FETCHED_AT),
    (error) => {
      assert.notEqual(error, leakedError);
      assert.equal(error?.constructor, TypeError);
      assert.equal(error?.message, "Invalid Frankfurter EUR/DKK response");
      return true;
    },
  );
});

test("snapshot validation rejects unknown providers and non-EUR/DKK contracts", () => {
  const invalidSnapshots = [
    validSnapshot({ schemaVersion: 2 }),
    validSnapshot({ schemaVersion: "1" }),
    validSnapshot({ provider: "unknown" }),
    validSnapshot({ provider: "ecb" }),
    validSnapshot({ baseCurrency: "USD" }),
    validSnapshot({ baseCurrency: "eur" }),
    validSnapshot({ quoteCurrency: "EUR" }),
    validSnapshot({ quoteCurrency: "dkk" }),
  ];

  for (const snapshot of invalidSnapshots) {
    assert.throws(() => parseFxSnapshot(snapshot), /FX snapshot/i);
  }
});

test("snapshot validation requires a finite positive explicitly bounded numeric rate", () => {
  const invalidRates = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "7.4601", null, 100.0001];

  for (const rate of invalidRates) {
    assert.throws(() => parseFxSnapshot(validSnapshot({ rate })), /FX snapshot/i);
  }

  assert.equal(parseFxSnapshot(validSnapshot({ rate: 0.000001 })).rate, 0.000001);
  assert.equal(parseFxSnapshot(validSnapshot({ rate: 100 })).rate, 100);
});

test("snapshot validation requires exact real ISO rate and fetch dates", () => {
  const invalidDateSnapshots = [
    validSnapshot({ rateDate: "2026-02-29" }),
    validSnapshot({ rateDate: "2026-2-03" }),
    validSnapshot({ rateDate: "2026-07-30T00:00:00.000Z" }),
    validSnapshot({ fetchedAt: "2026-07-31T08:15:00Z" }),
    validSnapshot({ fetchedAt: "2026-07-31T10:15:00.000+02:00" }),
    validSnapshot({ fetchedAt: "2026-02-29T08:15:00.000Z" }),
    validSnapshot({ fetchedAt: "not-a-date" }),
  ];

  for (const snapshot of invalidDateSnapshots) {
    assert.throws(() => parseFxSnapshot(snapshot), /FX snapshot/i);
  }

  assert.equal(parseFxSnapshot(validSnapshot({ rateDate: "2024-02-29" })).rateDate, "2024-02-29");
});

test("snapshot chronology is bounded by the UTC calendar date of fetchedAt", () => {
  const sameDayAtBoundary = parseFxSnapshot(
    validSnapshot({
      rateDate: "2026-07-31",
      fetchedAt: "2026-07-31T00:00:00.000Z",
    }),
  );
  const previousDayAtBoundary = parseFxSnapshot(
    validSnapshot({
      rateDate: "2026-07-30",
      fetchedAt: "2026-07-31T00:00:00.000Z",
    }),
  );

  assert.equal(sameDayAtBoundary.rateDate, "2026-07-31");
  assert.equal(previousDayAtBoundary.rateDate, "2026-07-30");
  assert.throws(
    () =>
      parseFxSnapshot(
        validSnapshot({
          rateDate: "2026-08-01",
          fetchedAt: "2026-07-31T23:59:59.999Z",
        }),
      ),
    /FX snapshot/i,
  );
});

test("raw Frankfurter chronology accepts the UTC boundary and rejects future rates", () => {
  const sameDayRaw = rawBytes(
    JSON.stringify({ date: "2026-07-31", base: "EUR", quote: "DKK", rate: 7.4601 }),
  );
  const futureRaw = rawBytes(
    JSON.stringify({ date: "2026-08-01", base: "EUR", quote: "DKK", rate: 7.4601 }),
  );

  assert.equal(
    parseFrankfurterEurDkkSnapshot(sameDayRaw, "2026-07-31T00:00:00.000Z").rateDate,
    "2026-07-31",
  );
  assert.throws(
    () =>
      parseFrankfurterEurDkkSnapshot(futureRaw, "2026-07-31T23:59:59.999Z"),
    /Frankfurter/i,
  );
});

test("snapshot validation requires an exact lowercase SHA-256 digest", () => {
  const invalidHashes = [
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(64),
    `${"a".repeat(63)}g`,
    123,
    null,
  ];

  for (const sourcePayloadSha256 of invalidHashes) {
    assert.throws(
      () => parseFxSnapshot(validSnapshot({ sourcePayloadSha256 })),
      /FX snapshot/i,
    );
  }
});

test("canonical serialization uses one stable key order regardless of input order", () => {
  const ordered = validSnapshot();
  const reversed = Object.fromEntries(Object.entries(ordered).reverse());
  const expected =
    '{"schemaVersion":1,"provider":"frankfurter_ecb","baseCurrency":"EUR","quoteCurrency":"DKK","rate":7.4601,"rateDate":"2026-07-30","fetchedAt":"2026-07-31T08:15:00.000Z","sourcePayloadSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}';

  assert.equal(canonicalizeFxSnapshot(ordered), expected);
  assert.equal(canonicalizeFxSnapshot(reversed), expected);
  assert.equal(canonicalizeFxSnapshot(parseFxSnapshot(reversed)), expected);
});

test("parsing returns a new deeply frozen normalized contract and drops input extras", () => {
  const input = validSnapshot({
    providerEvidence: { raw: { shouldNotSurvive: true } },
  });

  const parsed = parseFxSnapshot(input);

  assert.notEqual(parsed, input);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal("providerEvidence" in parsed, false);
  assert.deepEqual(input.providerEvidence, { raw: { shouldNotSurvive: true } });
  assert.throws(() => {
    parsed.sourcePayloadSha256 = "b".repeat(64);
  }, TypeError);
});

test("snapshot fields are captured exactly once before validation and normalization", () => {
  const expected = validSnapshot();
  const reads = {};
  const accessorBacked = {};

  for (const [field, value] of Object.entries(expected)) {
    Object.defineProperty(accessorBacked, field, {
      enumerable: true,
      get() {
        reads[field] = (reads[field] ?? 0) + 1;
        if (reads[field] === 1) return value;
        if (field === "rate") return Number.NaN;
        return `changed-${field}`;
      },
    });
  }

  assert.deepEqual(parseFxSnapshot(accessorBacked), expected);
  assert.deepEqual(
    reads,
    Object.fromEntries(Object.keys(expected).map((field) => [field, 1])),
  );
});

test("hostile snapshot access failures are normalized without leaking trap errors", () => {
  const leakedError = new Error("hostile snapshot getter leaked");
  const hostileSnapshot = new Proxy(validSnapshot(), {
    get(target, property, receiver) {
      if (property === "rate") throw leakedError;
      return Reflect.get(target, property, receiver);
    },
  });

  assert.throws(
    () => parseFxSnapshot(hostileSnapshot),
    (error) => {
      assert.notEqual(error, leakedError);
      assert.equal(error?.constructor, TypeError);
      assert.equal(error?.message, "Invalid FX snapshot contract");
      return true;
    },
  );

  const revoked = Proxy.revocable(validSnapshot(), {});
  revoked.revoke();
  assert.throws(
    () => parseFxSnapshot(revoked.proxy),
    (error) => {
      assert.equal(error?.constructor, TypeError);
      assert.equal(error?.message, "Invalid FX snapshot contract");
      return true;
    },
  );
});
